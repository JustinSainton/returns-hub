import db from "../db.server";
import {
  GET_ORDERS_WITH_FULFILLMENTS,
  GET_ORDER_BY_ID,
  GET_RETURNS,
  RETURN_REQUEST,
  RETURN_APPROVE_REQUEST,
  RETURN_DECLINE_REQUEST,
} from "../graphql/returns";

type AdminGraphQL = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

export type ReturnStatus = "pending" | "approved" | "declined" | "completed" | "cancelled";

export interface CreateReturnRequestInput {
  shop: string;
  shopifyOrderId: string;
  shopifyOrderName: string;
  customerEmail: string;
  customerName: string;
  reason?: string;
  customerNotes?: string;
  items: {
    shopifyLineItemId: string;
    shopifyVariantId?: string;
    shopifyProductId?: string;
    title: string;
    variantTitle?: string;
    sku?: string;
    quantity: number;
    pricePerItem: number;
    reason?: string;
  }[];
}

export async function getShopSettings(shop: string) {
  let settings = await db.shopSettings.findUnique({
    where: { shop },
  });

  if (!settings) {
    settings = await db.shopSettings.create({
      data: { shop },
    });
  }

  return settings;
}

export async function updateShopSettings(
  shop: string,
  data: Partial<{
    returnWindowDays: number;
    autoApproveEnabled: boolean;
    autoApproveMaxValue: number | null;
    requirePhotos: boolean;
    requireReason: boolean;
    restockAutomatically: boolean;
    notifyOnNewReturn: boolean;
    notifyOnStatusChange: boolean;
    shippoApiKey: string | null;
    easypostApiKey: string | null;
  }>
) {
  return db.shopSettings.upsert({
    where: { shop },
    update: data,
    create: { shop, ...data },
  });
}

export async function getReturnRequests(
  shop: string,
  options: {
    status?: ReturnStatus;
    limit?: number;
    offset?: number;
  } = {}
) {
  const { status, limit = 50, offset = 0 } = options;

  return db.returnRequest.findMany({
    where: {
      shop,
      ...(status && { status }),
    },
    include: {
      items: true,
      label: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
}

export async function getReturnRequestById(id: string) {
  return db.returnRequest.findUnique({
    where: { id },
    include: {
      items: true,
      label: true,
      shopSettings: true,
    },
  });
}

export async function createReturnRequest(input: CreateReturnRequestInput) {
  const settings = await getShopSettings(input.shop);

  const totalRefundAmount = input.items.reduce(
    (sum, item) => sum + item.pricePerItem * item.quantity,
    0
  );

  const shouldAutoApprove =
    settings.autoApproveEnabled &&
    (!settings.autoApproveMaxValue || totalRefundAmount <= settings.autoApproveMaxValue);

  return db.returnRequest.create({
    data: {
      shop: input.shop,
      shopifyOrderId: input.shopifyOrderId,
      shopifyOrderName: input.shopifyOrderName,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      reason: input.reason,
      customerNotes: input.customerNotes,
      totalRefundAmount,
      status: shouldAutoApprove ? "approved" : "pending",
      approvedAt: shouldAutoApprove ? new Date() : null,
      items: {
        create: input.items.map((item) => ({
          shopifyLineItemId: item.shopifyLineItemId,
          shopifyVariantId: item.shopifyVariantId,
          shopifyProductId: item.shopifyProductId,
          title: item.title,
          variantTitle: item.variantTitle,
          sku: item.sku,
          quantity: item.quantity,
          pricePerItem: item.pricePerItem,
          reason: item.reason,
        })),
      },
    },
    include: {
      items: true,
    },
  });
}

export async function approveReturnRequest(id: string, merchantNotes?: string) {
  return db.returnRequest.update({
    where: { id },
    data: {
      status: "approved",
      approvedAt: new Date(),
      merchantNotes,
    },
    include: {
      items: true,
      label: true,
    },
  });
}

export async function declineReturnRequest(id: string, merchantNotes?: string) {
  return db.returnRequest.update({
    where: { id },
    data: {
      status: "declined",
      merchantNotes,
    },
    include: {
      items: true,
    },
  });
}

export async function completeReturnRequest(id: string) {
  return db.returnRequest.update({
    where: { id },
    data: {
      status: "completed",
      completedAt: new Date(),
    },
    include: {
      items: true,
      label: true,
    },
  });
}

export async function getReturnDestinations(shop: string) {
  return db.returnDestination.findMany({
    where: { shop },
    orderBy: { isDefault: "desc" },
  });
}

export async function createReturnDestination(
  shop: string,
  data: {
    name: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
    phone?: string;
    isDefault?: boolean;
  }
) {
  if (data.isDefault) {
    await db.returnDestination.updateMany({
      where: { shop },
      data: { isDefault: false },
    });
  }

  return db.returnDestination.create({
    data: {
      shop,
      ...data,
    },
  });
}

export async function getRoutingRules(shop: string) {
  return db.routingRule.findMany({
    where: { shop },
    include: {
      destination: true,
    },
    orderBy: { priority: "asc" },
  });
}

export async function createRoutingRule(
  shop: string,
  data: {
    name: string;
    priority?: number;
    conditionType: string;
    conditionValue: string;
    destinationId: string;
  }
) {
  return db.routingRule.create({
    data: {
      shop,
      ...data,
    },
    include: {
      destination: true,
    },
  });
}

export async function fetchShopifyOrders(
  admin: AdminGraphQL,
  options: { first?: number; after?: string; query?: string } = {}
) {
  const response = await admin.graphql(GET_ORDERS_WITH_FULFILLMENTS, {
    variables: {
      first: options.first ?? 25,
      after: options.after,
      query: options.query,
    },
  });

  return response.json();
}

export async function fetchShopifyOrderById(
  admin: AdminGraphQL,
  orderId: string
) {
  const response = await admin.graphql(GET_ORDER_BY_ID, {
    variables: { id: orderId },
  });

  return response.json();
}

export async function fetchShopifyReturns(
  admin: AdminGraphQL,
  options: { first?: number; after?: string; query?: string } = {}
) {
  const response = await admin.graphql(GET_RETURNS, {
    variables: {
      first: options.first ?? 25,
      after: options.after,
      query: options.query,
    },
  });

  return response.json();
}

export async function createShopifyReturnRequest(
  admin: AdminGraphQL,
  orderId: string,
  lineItems: { lineItemId: string; quantity: number; returnReason?: string }[]
) {
  const response = await admin.graphql(RETURN_REQUEST, {
    variables: {
      input: {
        orderId,
        returnLineItems: lineItems.map((item) => ({
          fulfillmentLineItemId: item.lineItemId,
          quantity: item.quantity,
          returnReason: item.returnReason ?? "OTHER",
        })),
      },
    },
  });

  return response.json();
}

export async function approveShopifyReturn(
  admin: AdminGraphQL,
  returnId: string
) {
  const response = await admin.graphql(RETURN_APPROVE_REQUEST, {
    variables: {
      input: { id: returnId },
    },
  });

  return response.json();
}

export async function declineShopifyReturn(
  admin: AdminGraphQL,
  returnId: string,
  declineReason?: string
) {
  const response = await admin.graphql(RETURN_DECLINE_REQUEST, {
    variables: {
      input: {
        id: returnId,
        declineReason,
      },
    },
  });

  return response.json();
}

export async function getReturnStats(shop: string) {
  const [pending, approved, completed, totalThisMonth] = await Promise.all([
    db.returnRequest.count({ where: { shop, status: "pending" } }),
    db.returnRequest.count({ where: { shop, status: "approved" } }),
    db.returnRequest.count({ where: { shop, status: "completed" } }),
    db.returnRequest.count({
      where: {
        shop,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
  ]);

  const totalRefundedThisMonth = await db.returnRequest.aggregate({
    where: {
      shop,
      status: "completed",
      completedAt: {
        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    },
    _sum: {
      totalRefundAmount: true,
    },
  });

  return {
    pending,
    approved,
    completed,
    totalThisMonth,
    refundedThisMonth: totalRefundedThisMonth._sum.totalRefundAmount ?? 0,
  };
}
