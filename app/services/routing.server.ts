import db from "../db.server";
import type { RoutingRule, ReturnDestination } from "@prisma/client";

export type ConditionType =
  | "product_type"
  | "product_tag"
  | "sku_contains"
  | "order_value_above"
  | "order_value_below"
  | "return_reason"
  | "customer_tag"
  | "product_vendor";

export interface RoutingContext {
  orderValue: number;
  returnReason?: string;
  customerTags?: string[];
  items: Array<{
    productType?: string;
    productTags?: string[];
    productVendor?: string;
    sku?: string;
  }>;
}

export interface RuleWithDestination extends RoutingRule {
  destination: ReturnDestination;
}

export function evaluateCondition(
  rule: RoutingRule,
  context: RoutingContext
): boolean {
  const { conditionType, conditionValue } = rule;
  const normalizedValue = conditionValue.toLowerCase().trim();

  switch (conditionType as ConditionType) {
    case "product_type":
      return context.items.some(
        (item) => item.productType?.toLowerCase() === normalizedValue
      );

    case "product_tag":
      return context.items.some((item) =>
        item.productTags?.some((tag) => tag.toLowerCase() === normalizedValue)
      );

    case "product_vendor":
      return context.items.some(
        (item) => item.productVendor?.toLowerCase() === normalizedValue
      );

    case "sku_contains":
      return context.items.some((item) =>
        item.sku?.toLowerCase().includes(normalizedValue)
      );

    case "order_value_above":
      const minValue = parseFloat(conditionValue);
      return !isNaN(minValue) && context.orderValue > minValue;

    case "order_value_below":
      const maxValue = parseFloat(conditionValue);
      return !isNaN(maxValue) && context.orderValue < maxValue;

    case "return_reason":
      return context.returnReason?.toLowerCase() === normalizedValue;

    case "customer_tag":
      return (
        context.customerTags?.some(
          (tag) => tag.toLowerCase() === normalizedValue
        ) ?? false
      );

    default:
      return false;
  }
}

export function findMatchingDestination(
  rules: RuleWithDestination[],
  context: RoutingContext
): ReturnDestination | null {
  const sortedRules = [...rules]
    .filter((rule) => rule.isActive)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    if (evaluateCondition(rule, context)) {
      return rule.destination;
    }
  }

  return null;
}

export async function getDestinationForReturn(
  shop: string,
  context: RoutingContext
): Promise<ReturnDestination | null> {
  const rules = await db.routingRule.findMany({
    where: { shop, isActive: true },
    include: { destination: true },
    orderBy: { priority: "asc" },
  });

  const matchedDestination = findMatchingDestination(
    rules as RuleWithDestination[],
    context
  );

  if (matchedDestination) {
    return matchedDestination;
  }

  const defaultDestination = await db.returnDestination.findFirst({
    where: { shop, isDefault: true },
  });

  return defaultDestination;
}

export async function routeReturnRequest(
  shop: string,
  returnRequestId: string,
  context: RoutingContext
): Promise<{ destination: ReturnDestination | null; matchedRule: RoutingRule | null }> {
  const rules = await db.routingRule.findMany({
    where: { shop, isActive: true },
    include: { destination: true },
    orderBy: { priority: "asc" },
  });

  for (const rule of rules as RuleWithDestination[]) {
    if (evaluateCondition(rule, context)) {
      return {
        destination: rule.destination,
        matchedRule: rule,
      };
    }
  }

  const defaultDestination = await db.returnDestination.findFirst({
    where: { shop, isDefault: true },
  });

  return {
    destination: defaultDestination,
    matchedRule: null,
  };
}

export function buildRoutingContext(
  orderData: {
    totalValue: number;
    lineItems: Array<{
      productType?: string;
      productTags?: string[];
      productVendor?: string;
      sku?: string;
    }>;
  },
  returnData: {
    reason?: string;
  },
  customerData?: {
    tags?: string[];
  }
): RoutingContext {
  return {
    orderValue: orderData.totalValue,
    returnReason: returnData.reason,
    customerTags: customerData?.tags,
    items: orderData.lineItems,
  };
}

export async function validateRoutingRules(shop: string): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  const rules = await db.routingRule.findMany({
    where: { shop },
    include: { destination: true },
  });

  const destinations = await db.returnDestination.findMany({
    where: { shop },
  });

  if (destinations.length === 0) {
    issues.push("No return destinations configured");
  }

  const hasDefault = destinations.some((d) => d.isDefault);
  if (!hasDefault && destinations.length > 0) {
    issues.push("No default destination set - returns without matching rules will have no destination");
  }

  for (const rule of rules) {
    if (!rule.destination) {
      issues.push(`Rule "${rule.name}" references a deleted destination`);
    }

    if (rule.conditionType === "order_value_above" || rule.conditionType === "order_value_below") {
      const value = parseFloat(rule.conditionValue);
      if (isNaN(value)) {
        issues.push(`Rule "${rule.name}" has invalid numeric value: ${rule.conditionValue}`);
      }
    }
  }

  const priorityCounts = new Map<number, number>();
  for (const rule of rules.filter((r) => r.isActive)) {
    const count = priorityCounts.get(rule.priority) || 0;
    priorityCounts.set(rule.priority, count + 1);
  }

  for (const [priority, count] of priorityCounts) {
    if (count > 1) {
      issues.push(`Multiple active rules have the same priority (${priority}) - order may be unpredictable`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
