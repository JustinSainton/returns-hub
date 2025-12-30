import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../app/db.server", () => ({
  default: {
    shopSettings: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    returnRequest: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    returnDestination: {
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    routingRule: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    returnItem: {
      update: vi.fn(),
    },
  },
}));

import db from "../../app/db.server";

describe("Services Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Returns Service", () => {
    it("getShopSettings creates default settings if not exists", async () => {
      (db.shopSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (db.shopSettings.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "settings-1",
        shop: "test-shop.myshopify.com",
        returnWindowDays: 30,
        autoApproveEnabled: false,
      });

      const { getShopSettings } = await import("../../app/services/returns.server");
      const settings = await getShopSettings("test-shop.myshopify.com");

      expect(db.shopSettings.create).toHaveBeenCalledWith({
        data: { shop: "test-shop.myshopify.com" },
      });
      expect(settings.returnWindowDays).toBe(30);
    });

    it("getReturnRequests filters by status", async () => {
      const mockReturns = [
        { id: "return-1", status: "pending" },
        { id: "return-2", status: "pending" },
      ];

      (db.returnRequest.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockReturns);

      const { getReturnRequests } = await import("../../app/services/returns.server");
      const returns = await getReturnRequests("test-shop.myshopify.com", { status: "pending" });

      expect(db.returnRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            shop: "test-shop.myshopify.com",
            status: "pending",
          }),
        })
      );
      expect(returns).toHaveLength(2);
    });

    it("createReturnRequest calculates total refund amount", async () => {
      (db.shopSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        autoApproveEnabled: false,
      });

      (db.returnRequest.create as ReturnType<typeof vi.fn>).mockImplementation((args) => {
        return Promise.resolve({
          id: "return-new",
          ...args.data,
          items: args.data.items.create,
        });
      });

      const { createReturnRequest } = await import("../../app/services/returns.server");

      const result = await createReturnRequest({
        shop: "test-shop.myshopify.com",
        shopifyOrderId: "gid://shopify/Order/123",
        shopifyOrderName: "#1001",
        customerEmail: "customer@example.com",
        customerName: "John Doe",
        items: [
          {
            shopifyLineItemId: "item-1",
            title: "Product A",
            quantity: 2,
            pricePerItem: 25.0,
          },
          {
            shopifyLineItemId: "item-2",
            title: "Product B",
            quantity: 1,
            pricePerItem: 50.0,
          },
        ],
      });

      expect(result.totalRefundAmount).toBe(100);
    });

    it("getReturnStats returns correct counts", async () => {
      (db.returnRequest.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(18);

      (db.returnRequest.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
        _sum: { totalRefundAmount: 1500.0 },
      });

      const { getReturnStats } = await import("../../app/services/returns.server");
      const stats = await getReturnStats("test-shop.myshopify.com");

      expect(stats.pending).toBe(5);
      expect(stats.approved).toBe(3);
      expect(stats.completed).toBe(10);
      expect(stats.totalThisMonth).toBe(18);
      expect(stats.refundedThisMonth).toBe(1500.0);
    });
  });

  describe("Routing Service", () => {
    it("findMatchingDestination returns destination from highest priority matching rule", async () => {
      const { findMatchingDestination } = await import("../../app/services/routing.server");

      const mockRules = [
        {
          id: "rule-1",
          shop: "test-shop",
          name: "Rule 1",
          priority: 10,
          isActive: true,
          conditionType: "product_type",
          conditionValue: "Electronics",
          destinationId: "dest-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          destination: { id: "dest-1", name: "Warehouse A", shop: "test-shop", addressLine1: "", city: "", state: "", postalCode: "", country: "US", isDefault: false, createdAt: new Date(), updatedAt: new Date() },
        },
        {
          id: "rule-2",
          shop: "test-shop",
          name: "Rule 2",
          priority: 5,
          isActive: true,
          conditionType: "product_type",
          conditionValue: "Electronics",
          destinationId: "dest-2",
          createdAt: new Date(),
          updatedAt: new Date(),
          destination: { id: "dest-2", name: "Warehouse B", shop: "test-shop", addressLine1: "", city: "", state: "", postalCode: "", country: "US", isDefault: false, createdAt: new Date(), updatedAt: new Date() },
        },
      ];

      const context = {
        orderValue: 100,
        returnReason: "defective",
        customerTags: [],
        items: [{ productType: "Electronics", productTags: [], sku: "ELEC-001", productVendor: "ACME" }],
      };

      const match = findMatchingDestination(mockRules as any, context);

      expect(match).not.toBeNull();
      expect(match?.id).toBe("dest-2");
    });

    it("evaluateCondition matches product_tag correctly", async () => {
      const { evaluateCondition } = await import("../../app/services/routing.server");

      const rule = {
        id: "rule-1",
        shop: "test-shop",
        name: "Tag Rule",
        priority: 0,
        isActive: true,
        conditionType: "product_tag",
        conditionValue: "electronics",
        destinationId: "dest-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context = {
        orderValue: 0,
        items: [{ productTags: ["sale", "new-arrival", "electronics"] }],
      };

      expect(evaluateCondition(rule as any, context)).toBe(true);

      const context2 = {
        orderValue: 0,
        items: [{ productTags: ["sale", "new-arrival"] }],
      };

      expect(evaluateCondition(rule as any, context2)).toBe(false);
    });

    it("evaluateCondition matches order_value_above correctly", async () => {
      const { evaluateCondition } = await import("../../app/services/routing.server");

      const rule = {
        id: "rule-1",
        shop: "test-shop",
        name: "Value Rule",
        priority: 0,
        isActive: true,
        conditionType: "order_value_above",
        conditionValue: "100",
        destinationId: "dest-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context1 = { orderValue: 150, items: [] };
      const context2 = { orderValue: 50, items: [] };

      expect(evaluateCondition(rule as any, context1)).toBe(true);
      expect(evaluateCondition(rule as any, context2)).toBe(false);
    });
  });

  describe("Notification Service", () => {
    it("sendReturnConfirmation logs to console in dev mode", async () => {
      const consoleSpy = vi.spyOn(console, "log");

      const { sendReturnConfirmation } = await import("../../app/services/notifications.server");

      const result = await sendReturnConfirmation({
        returnRequest: {
          id: "return-123",
          shop: "test-shop.myshopify.com",
          shopifyOrderId: "order-1",
          shopifyOrderName: "#1001",
          customerEmail: "customer@example.com",
          customerName: "John Doe",
          status: "pending",
          reason: "defective",
          customerNotes: null,
          merchantNotes: null,
          totalRefundAmount: 50.0,
          resolutionType: null,
          exchangeType: null,
          exchangeOrderId: null,
          exchangeValueUsed: null,
          exchangeBonusApplied: null,
          storeCreditIssued: null,
          storeCreditCode: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          approvedAt: null,
          completedAt: null,
          items: [
            {
              id: "item-1",
              returnRequestId: "return-123",
              shopifyLineItemId: "line-1",
              shopifyVariantId: null,
              shopifyProductId: null,
              title: "Test Product",
              variantTitle: null,
              sku: null,
              quantity: 1,
              pricePerItem: 50.0,
              reason: "defective",
              condition: null,
              photoUrls: null,
              restocked: false,
              restockedAt: null,
              createdAt: new Date(),
            },
          ],
        },
        shopName: "Test Shop",
      });

      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Email Notification"));
    });
  });
});
