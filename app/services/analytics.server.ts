import db from "../db.server";

export type DateRange = "7d" | "30d" | "90d" | "custom";

interface DateRangeFilter {
  range: DateRange;
  startDate?: Date;
  endDate?: Date;
}

function getDateRange(filter: DateRangeFilter): { start: Date; end: Date } {
  const end = filter.endDate || new Date();
  let start: Date;

  if (filter.range === "custom" && filter.startDate) {
    start = filter.startDate;
  } else {
    const days = filter.range === "7d" ? 7 : filter.range === "30d" ? 30 : 90;
    start = new Date(end);
    start.setDate(start.getDate() - days);
  }

  return { start, end };
}

function getPreviousPeriod(
  start: Date,
  end: Date
): { start: Date; end: Date } {
  const duration = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - duration),
    end: new Date(start.getTime()),
  };
}

export interface AnalyticsOverview {
  totalReturns: number;
  previousPeriodReturns: number;
  returnRate: number;
  previousReturnRate: number;
  revenueRetained: number;
  previousRevenueRetained: number;
  avgProcessingDays: number;
  previousAvgProcessingDays: number;
  storeCreditVsRefundRatio: number;
}

export async function getAnalyticsOverview(
  shop: string,
  filter: DateRangeFilter = { range: "30d" }
): Promise<AnalyticsOverview> {
  const { start, end } = getDateRange(filter);
  const previous = getPreviousPeriod(start, end);

  const [currentReturns, previousReturns] = await Promise.all([
    db.returnRequest.count({
      where: {
        shop,
        createdAt: { gte: start, lte: end },
      },
    }),
    db.returnRequest.count({
      where: {
        shop,
        createdAt: { gte: previous.start, lte: previous.end },
      },
    }),
  ]);

  const [currentRetainedAgg, previousRetainedAgg] = await Promise.all([
    db.returnRequest.aggregate({
      where: {
        shop,
        createdAt: { gte: start, lte: end },
        OR: [
          { resolutionType: "store_credit" },
          { resolutionType: "exchange" },
        ],
      },
      _sum: {
        storeCreditIssued: true,
        exchangeValueUsed: true,
      },
    }),
    db.returnRequest.aggregate({
      where: {
        shop,
        createdAt: { gte: previous.start, lte: previous.end },
        OR: [
          { resolutionType: "store_credit" },
          { resolutionType: "exchange" },
        ],
      },
      _sum: {
        storeCreditIssued: true,
        exchangeValueUsed: true,
      },
    }),
  ]);

  const [currentProcessed, previousProcessed] = await Promise.all([
    db.returnRequest.findMany({
      where: {
        shop,
        createdAt: { gte: start, lte: end },
        OR: [{ status: "approved" }, { status: "completed" }],
        approvedAt: { not: null },
      },
      select: {
        createdAt: true,
        approvedAt: true,
      },
    }),
    db.returnRequest.findMany({
      where: {
        shop,
        createdAt: { gte: previous.start, lte: previous.end },
        OR: [{ status: "approved" }, { status: "completed" }],
        approvedAt: { not: null },
      },
      select: {
        createdAt: true,
        approvedAt: true,
      },
    }),
  ]);

  const calcAvgDays = (
    items: { createdAt: Date; approvedAt: Date | null }[]
  ) => {
    if (items.length === 0) return 0;
    const totalDays = items.reduce((sum, item) => {
      if (!item.approvedAt) return sum;
      const days =
        (new Date(item.approvedAt).getTime() -
          new Date(item.createdAt).getTime()) /
        (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);
    return totalDays / items.length;
  };

  const [storeCreditCount, refundCount] = await Promise.all([
    db.returnRequest.count({
      where: {
        shop,
        createdAt: { gte: start, lte: end },
        resolutionType: "store_credit",
      },
    }),
    db.returnRequest.count({
      where: {
        shop,
        createdAt: { gte: start, lte: end },
        resolutionType: "refund",
      },
    }),
  ]);

  const revenueRetained =
    (currentRetainedAgg._sum.storeCreditIssued || 0) +
    (currentRetainedAgg._sum.exchangeValueUsed || 0);

  const previousRevenueRetained =
    (previousRetainedAgg._sum.storeCreditIssued || 0) +
    (previousRetainedAgg._sum.exchangeValueUsed || 0);

  return {
    totalReturns: currentReturns,
    previousPeriodReturns: previousReturns,
    returnRate: 0,
    previousReturnRate: 0,
    revenueRetained,
    previousRevenueRetained,
    avgProcessingDays: calcAvgDays(currentProcessed),
    previousAvgProcessingDays: calcAvgDays(previousProcessed),
    storeCreditVsRefundRatio:
      storeCreditCount + refundCount > 0
        ? storeCreditCount / (storeCreditCount + refundCount)
        : 0,
  };
}

export interface ReasonBreakdown {
  reason: string;
  count: number;
  percentage: number;
  totalValue: number;
}

export async function getReturnsByReason(
  shop: string,
  filter: DateRangeFilter = { range: "30d" }
): Promise<ReasonBreakdown[]> {
  const { start, end } = getDateRange(filter);

  const returns = await db.returnRequest.findMany({
    where: {
      shop,
      createdAt: { gte: start, lte: end },
    },
    include: {
      items: true,
    },
  });

  const reasonMap = new Map<string, { count: number; totalValue: number }>();

  for (const request of returns) {
    const reasons = request.reason
      ? [request.reason]
      : [...new Set(request.items.map((i) => i.reason).filter(Boolean))];

    for (const reason of reasons) {
      const key = reason || "Not specified";
      const existing = reasonMap.get(key) || { count: 0, totalValue: 0 };
      existing.count += 1;
      existing.totalValue += request.totalRefundAmount;
      reasonMap.set(key, existing);
    }
  }

  const total = returns.length || 1;
  const result: ReasonBreakdown[] = [];

  for (const [reason, data] of reasonMap.entries()) {
    result.push({
      reason,
      count: data.count,
      percentage: (data.count / total) * 100,
      totalValue: data.totalValue,
    });
  }

  return result.sort((a, b) => b.count - a.count);
}

export interface ProductReturnRate {
  productId: string;
  productTitle: string;
  variantTitle: string | null;
  unitsReturned: number;
  returnValue: number;
  topReason: string | null;
  returnRate: number;
  isHighReturnRate: boolean;
}

export async function getProductReturnRates(
  shop: string,
  filter: DateRangeFilter = { range: "30d" }
): Promise<ProductReturnRate[]> {
  const { start, end } = getDateRange(filter);

  const items = await db.returnItem.findMany({
    where: {
      returnRequest: {
        shop,
        createdAt: { gte: start, lte: end },
      },
    },
    include: {
      returnRequest: true,
    },
  });

  const productMap = new Map<
    string,
    {
      productId: string;
      title: string;
      variantTitle: string | null;
      units: number;
      value: number;
      reasons: string[];
    }
  >();

  for (const item of items) {
    const productId = item.shopifyProductId || item.shopifyLineItemId;
    const existing = productMap.get(productId) || {
      productId,
      title: item.title,
      variantTitle: item.variantTitle,
      units: 0,
      value: 0,
      reasons: [],
    };

    existing.units += item.quantity;
    existing.value += item.pricePerItem * item.quantity;
    if (item.reason) {
      existing.reasons.push(item.reason);
    }
    productMap.set(productId, existing);
  }

  const result: ProductReturnRate[] = [];

  for (const [, data] of productMap.entries()) {
    const reasonCounts = new Map<string, number>();
    for (const reason of data.reasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }
    const topReason =
      [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const estimatedReturnRate = Math.min(data.units * 5, 100);

    result.push({
      productId: data.productId,
      productTitle: data.title,
      variantTitle: data.variantTitle,
      unitsReturned: data.units,
      returnValue: data.value,
      topReason,
      returnRate: estimatedReturnRate,
      isHighReturnRate: estimatedReturnRate > 15,
    });
  }

  return result.sort((a, b) => b.unitsReturned - a.unitsReturned);
}

export interface FinancialMetrics {
  totalRefunds: number;
  storeCreditIssued: number;
  bonusCreditCost: number;
  exchangeValue: number;
  shippingLabelCosts: number;
  netReturnCost: number;
  revenueRetained: number;
  revenueRetainedPercentage: number;
}

export async function getFinancialMetrics(
  shop: string,
  filter: DateRangeFilter = { range: "30d" }
): Promise<FinancialMetrics> {
  const { start, end } = getDateRange(filter);

  const returns = await db.returnRequest.findMany({
    where: {
      shop,
      createdAt: { gte: start, lte: end },
    },
    include: {
      label: true,
    },
  });

  let totalRefunds = 0;
  let storeCreditIssued = 0;
  let bonusCreditCost = 0;
  let exchangeValue = 0;
  let shippingLabelCosts = 0;

  for (const request of returns) {
    if (request.resolutionType === "refund") {
      totalRefunds += request.totalRefundAmount;
    } else if (request.resolutionType === "store_credit") {
      storeCreditIssued += request.storeCreditIssued || 0;
      const bonus = (request.storeCreditIssued || 0) - request.totalRefundAmount;
      if (bonus > 0) {
        bonusCreditCost += bonus;
      }
    } else if (request.resolutionType === "exchange") {
      exchangeValue += request.exchangeValueUsed || 0;
      bonusCreditCost += request.exchangeBonusApplied || 0;
    }

    if (request.label?.cost) {
      shippingLabelCosts += request.label.cost;
    }
  }

  const revenueRetained = exchangeValue + storeCreditIssued;
  const netReturnCost = totalRefunds + shippingLabelCosts + bonusCreditCost;

  const totalReturnValue = returns.reduce(
    (sum, r) => sum + r.totalRefundAmount,
    0
  );
  const revenueRetainedPercentage =
    totalReturnValue > 0 ? (revenueRetained / totalReturnValue) * 100 : 0;

  return {
    totalRefunds,
    storeCreditIssued,
    bonusCreditCost,
    exchangeValue,
    shippingLabelCosts,
    netReturnCost,
    revenueRetained,
    revenueRetainedPercentage,
  };
}

export interface TrendDataPoint {
  date: string;
  returns: number;
  refunds: number;
  storeCredit: number;
  exchanges: number;
  totalValue: number;
}

export async function getReturnTrends(
  shop: string,
  filter: DateRangeFilter = { range: "30d" }
): Promise<TrendDataPoint[]> {
  const { start, end } = getDateRange(filter);

  const returns = await db.returnRequest.findMany({
    where: {
      shop,
      createdAt: { gte: start, lte: end },
    },
    orderBy: { createdAt: "asc" },
  });

  const dateMap = new Map<
    string,
    {
      returns: number;
      refunds: number;
      storeCredit: number;
      exchanges: number;
      totalValue: number;
    }
  >();

  const current = new Date(start);
  while (current <= end) {
    const dateKey = current.toISOString().split("T")[0];
    dateMap.set(dateKey, {
      returns: 0,
      refunds: 0,
      storeCredit: 0,
      exchanges: 0,
      totalValue: 0,
    });
    current.setDate(current.getDate() + 1);
  }

  for (const request of returns) {
    const dateKey = new Date(request.createdAt).toISOString().split("T")[0];
    const existing = dateMap.get(dateKey);
    if (existing) {
      existing.returns += 1;
      existing.totalValue += request.totalRefundAmount;
      if (request.resolutionType === "refund") {
        existing.refunds += 1;
      } else if (request.resolutionType === "store_credit") {
        existing.storeCredit += 1;
      } else if (request.resolutionType === "exchange") {
        existing.exchanges += 1;
      }
    }
  }

  return Array.from(dateMap.entries())
    .map(([date, data]) => ({
      date,
      ...data,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}


