import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  evaluateCondition,
  findMatchingDestination,
  buildRoutingContext,
  type RoutingContext,
  type RuleWithDestination,
} from "./routing.server";
import {
  mockRoutingRule,
  mockReturnDestination,
  createMockRoutingRule,
  createMockDestination,
} from "../../test/fixtures";
import type { RoutingRule } from "@prisma/client";

describe("Routing Engine", () => {
  describe("evaluateCondition", () => {
    const baseContext: RoutingContext = {
      orderValue: 100,
      returnReason: "defective",
      customerTags: ["vip", "wholesale"],
      items: [
        {
          productType: "Electronics",
          productTags: ["featured", "sale"],
          productVendor: "Acme Corp",
          sku: "ELEC-001-BLK",
        },
      ],
    };

    describe("product_type condition", () => {
      it("matches when product type equals condition value", () => {
        const rule = createMockRoutingRule({
          conditionType: "product_type",
          conditionValue: "Electronics",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(true);
      });

      it("matches case-insensitively", () => {
        const rule = createMockRoutingRule({
          conditionType: "product_type",
          conditionValue: "ELECTRONICS",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(true);
      });

      it("does not match when product type differs", () => {
        const rule = createMockRoutingRule({
          conditionType: "product_type",
          conditionValue: "Clothing",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(false);
      });
    });

    describe("product_tag condition", () => {
      it("matches when any product has the tag", () => {
        const rule = createMockRoutingRule({
          conditionType: "product_tag",
          conditionValue: "featured",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(true);
      });

      it("does not match when no products have the tag", () => {
        const rule = createMockRoutingRule({
          conditionType: "product_tag",
          conditionValue: "clearance",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(false);
      });
    });

    describe("sku_contains condition", () => {
      it("matches when SKU contains the value", () => {
        const rule = createMockRoutingRule({
          conditionType: "sku_contains",
          conditionValue: "ELEC",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(true);
      });

      it("matches partial SKU case-insensitively", () => {
        const rule = createMockRoutingRule({
          conditionType: "sku_contains",
          conditionValue: "blk",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(true);
      });

      it("does not match when SKU does not contain value", () => {
        const rule = createMockRoutingRule({
          conditionType: "sku_contains",
          conditionValue: "CLOTH",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(false);
      });
    });

    describe("order_value_above condition", () => {
      it("matches when order value is above threshold", () => {
        const rule = createMockRoutingRule({
          conditionType: "order_value_above",
          conditionValue: "50",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(true);
      });

      it("does not match when order value equals threshold", () => {
        const rule = createMockRoutingRule({
          conditionType: "order_value_above",
          conditionValue: "100",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(false);
      });

      it("does not match when order value is below threshold", () => {
        const rule = createMockRoutingRule({
          conditionType: "order_value_above",
          conditionValue: "150",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(false);
      });

      it("returns false for invalid numeric value", () => {
        const rule = createMockRoutingRule({
          conditionType: "order_value_above",
          conditionValue: "not-a-number",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(false);
      });
    });

    describe("order_value_below condition", () => {
      it("matches when order value is below threshold", () => {
        const rule = createMockRoutingRule({
          conditionType: "order_value_below",
          conditionValue: "150",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(true);
      });

      it("does not match when order value equals threshold", () => {
        const rule = createMockRoutingRule({
          conditionType: "order_value_below",
          conditionValue: "100",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(false);
      });
    });

    describe("return_reason condition", () => {
      it("matches when reason equals condition value", () => {
        const rule = createMockRoutingRule({
          conditionType: "return_reason",
          conditionValue: "defective",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(true);
      });

      it("matches case-insensitively", () => {
        const rule = createMockRoutingRule({
          conditionType: "return_reason",
          conditionValue: "DEFECTIVE",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(true);
      });
    });

    describe("customer_tag condition", () => {
      it("matches when customer has the tag", () => {
        const rule = createMockRoutingRule({
          conditionType: "customer_tag",
          conditionValue: "vip",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(true);
      });

      it("does not match when customer lacks the tag", () => {
        const rule = createMockRoutingRule({
          conditionType: "customer_tag",
          conditionValue: "new-customer",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(false);
      });
    });

    describe("product_vendor condition", () => {
      it("matches when vendor equals condition value", () => {
        const rule = createMockRoutingRule({
          conditionType: "product_vendor",
          conditionValue: "Acme Corp",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(true);
      });
    });

    describe("unknown condition type", () => {
      it("returns false for unknown condition type", () => {
        const rule = createMockRoutingRule({
          conditionType: "unknown_type",
          conditionValue: "value",
        }) as RoutingRule;

        expect(evaluateCondition(rule, baseContext)).toBe(false);
      });
    });
  });

  describe("findMatchingDestination", () => {
    const destA = createMockDestination({ id: "dest_a", name: "Warehouse A" });
    const destB = createMockDestination({ id: "dest_b", name: "Warehouse B" });
    const destC = createMockDestination({ id: "dest_c", name: "Warehouse C" });

    it("returns destination from first matching rule by priority", () => {
      const rules: RuleWithDestination[] = [
        {
          ...createMockRoutingRule({
            id: "rule_1",
            priority: 2,
            conditionType: "product_type",
            conditionValue: "Electronics",
          }),
          destination: destB,
        } as RuleWithDestination,
        {
          ...createMockRoutingRule({
            id: "rule_2",
            priority: 1,
            conditionType: "order_value_above",
            conditionValue: "50",
          }),
          destination: destA,
        } as RuleWithDestination,
      ];

      const context: RoutingContext = {
        orderValue: 100,
        items: [{ productType: "Electronics" }],
      };

      const result = findMatchingDestination(rules, context);

      expect(result?.id).toBe("dest_a");
    });

    it("skips inactive rules", () => {
      const rules: RuleWithDestination[] = [
        {
          ...createMockRoutingRule({
            id: "rule_1",
            priority: 1,
            isActive: false,
            conditionType: "product_type",
            conditionValue: "Electronics",
          }),
          destination: destA,
        } as RuleWithDestination,
        {
          ...createMockRoutingRule({
            id: "rule_2",
            priority: 2,
            isActive: true,
            conditionType: "order_value_above",
            conditionValue: "50",
          }),
          destination: destB,
        } as RuleWithDestination,
      ];

      const context: RoutingContext = {
        orderValue: 100,
        items: [{ productType: "Electronics" }],
      };

      const result = findMatchingDestination(rules, context);

      expect(result?.id).toBe("dest_b");
    });

    it("returns null when no rules match", () => {
      const rules: RuleWithDestination[] = [
        {
          ...createMockRoutingRule({
            conditionType: "product_type",
            conditionValue: "Clothing",
          }),
          destination: destA,
        } as RuleWithDestination,
      ];

      const context: RoutingContext = {
        orderValue: 100,
        items: [{ productType: "Electronics" }],
      };

      const result = findMatchingDestination(rules, context);

      expect(result).toBeNull();
    });

    it("returns null for empty rules array", () => {
      const context: RoutingContext = {
        orderValue: 100,
        items: [],
      };

      const result = findMatchingDestination([], context);

      expect(result).toBeNull();
    });
  });

  describe("buildRoutingContext", () => {
    it("builds context from order, return, and customer data", () => {
      const orderData = {
        totalValue: 199.99,
        lineItems: [
          {
            productType: "Electronics",
            productTags: ["featured"],
            productVendor: "Acme",
            sku: "ELEC-001",
          },
          {
            productType: "Accessories",
            productTags: ["sale"],
            productVendor: "Widgets Inc",
            sku: "ACC-002",
          },
        ],
      };

      const returnData = {
        reason: "Wrong size",
      };

      const customerData = {
        tags: ["vip", "repeat-customer"],
      };

      const context = buildRoutingContext(orderData, returnData, customerData);

      expect(context).toEqual({
        orderValue: 199.99,
        returnReason: "Wrong size",
        customerTags: ["vip", "repeat-customer"],
        items: orderData.lineItems,
      });
    });

    it("handles missing optional data", () => {
      const orderData = {
        totalValue: 50,
        lineItems: [],
      };

      const returnData = {};

      const context = buildRoutingContext(orderData, returnData);

      expect(context).toEqual({
        orderValue: 50,
        returnReason: undefined,
        customerTags: undefined,
        items: [],
      });
    });
  });
});
