import { describe, it, expect, vi, beforeEach } from "vitest";
import db from "../db.server";
import {
  getShopSettings,
  updateShopSettings,
  getReturnRequests,
  getReturnRequestById,
  createReturnRequest,
  approveReturnRequest,
  declineReturnRequest,
  completeReturnRequest,
  getReturnDestinations,
  createReturnDestination,
  getRoutingRules,
  createRoutingRule,
  getReturnStats,
} from "./returns.server";
import {
  mockShop,
  mockShopSettings,
  mockReturnRequest,
  mockReturnItem,
  mockReturnDestination,
  mockRoutingRule,
  createMockReturnRequest,
} from "../../test/fixtures";

vi.mock("../db.server", () => ({
  default: {
    shopSettings: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    returnRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
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
  },
}));

describe("Returns Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getShopSettings", () => {
    it("returns existing settings when found", async () => {
      vi.mocked(db.shopSettings.findUnique).mockResolvedValue(mockShopSettings);

      const result = await getShopSettings(mockShop);

      expect(db.shopSettings.findUnique).toHaveBeenCalledWith({
        where: { shop: mockShop },
      });
      expect(result).toEqual(mockShopSettings);
    });

    it("creates default settings when not found", async () => {
      vi.mocked(db.shopSettings.findUnique).mockResolvedValue(null);
      vi.mocked(db.shopSettings.create).mockResolvedValue(mockShopSettings);

      const result = await getShopSettings(mockShop);

      expect(db.shopSettings.create).toHaveBeenCalledWith({
        data: { shop: mockShop },
      });
      expect(result).toEqual(mockShopSettings);
    });
  });

  describe("updateShopSettings", () => {
    it("upserts shop settings with provided data", async () => {
      const updates = { returnWindowDays: 60, autoApproveEnabled: true };
      const updatedSettings = { ...mockShopSettings, ...updates };
      vi.mocked(db.shopSettings.upsert).mockResolvedValue(updatedSettings);

      const result = await updateShopSettings(mockShop, updates);

      expect(db.shopSettings.upsert).toHaveBeenCalledWith({
        where: { shop: mockShop },
        update: updates,
        create: { shop: mockShop, ...updates },
      });
      expect(result).toEqual(updatedSettings);
    });
  });

  describe("getReturnRequests", () => {
    it("returns all return requests for shop", async () => {
      const mockReturns = [
        { ...mockReturnRequest, items: [mockReturnItem], label: null },
      ];
      vi.mocked(db.returnRequest.findMany).mockResolvedValue(mockReturns);

      const result = await getReturnRequests(mockShop);

      expect(db.returnRequest.findMany).toHaveBeenCalledWith({
        where: { shop: mockShop },
        include: { items: true, label: true },
        orderBy: { createdAt: "desc" },
        take: 50,
        skip: 0,
      });
      expect(result).toEqual(mockReturns);
    });

    it("filters by status when provided", async () => {
      vi.mocked(db.returnRequest.findMany).mockResolvedValue([]);

      await getReturnRequests(mockShop, { status: "pending" });

      expect(db.returnRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shop: mockShop, status: "pending" },
        })
      );
    });

    it("respects limit and offset", async () => {
      vi.mocked(db.returnRequest.findMany).mockResolvedValue([]);

      await getReturnRequests(mockShop, { limit: 10, offset: 20 });

      expect(db.returnRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });
  });

  describe("createReturnRequest", () => {
    it("creates return request with pending status when auto-approve is disabled", async () => {
      vi.mocked(db.shopSettings.findUnique).mockResolvedValue(mockShopSettings);
      vi.mocked(db.shopSettings.create).mockResolvedValue(mockShopSettings);
      
      const createdReturn = {
        ...mockReturnRequest,
        status: "pending",
        items: [mockReturnItem],
      };
      vi.mocked(db.returnRequest.create).mockResolvedValue(createdReturn);

      const input = {
        shop: mockShop,
        shopifyOrderId: "gid://shopify/Order/123456",
        shopifyOrderName: "#1001",
        customerEmail: "customer@example.com",
        customerName: "John Doe",
        reason: "Defective",
        items: [
          {
            shopifyLineItemId: "gid://shopify/LineItem/789",
            title: "Premium Widget",
            quantity: 1,
            pricePerItem: 99.99,
          },
        ],
      };

      const result = await createReturnRequest(input);

      expect(db.returnRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "pending",
            approvedAt: null,
          }),
        })
      );
      expect(result.status).toBe("pending");
    });

    it("auto-approves when enabled and under max value", async () => {
      const autoApproveSettings = {
        ...mockShopSettings,
        autoApproveEnabled: true,
        autoApproveMaxValue: 100,
      };
      vi.mocked(db.shopSettings.findUnique).mockResolvedValue(autoApproveSettings);

      const createdReturn = {
        ...mockReturnRequest,
        status: "approved",
        approvedAt: new Date(),
        items: [mockReturnItem],
      };
      vi.mocked(db.returnRequest.create).mockResolvedValue(createdReturn);

      const input = {
        shop: mockShop,
        shopifyOrderId: "gid://shopify/Order/123456",
        shopifyOrderName: "#1001",
        customerEmail: "customer@example.com",
        customerName: "John Doe",
        items: [
          {
            shopifyLineItemId: "gid://shopify/LineItem/789",
            title: "Widget",
            quantity: 1,
            pricePerItem: 50,
          },
        ],
      };

      await createReturnRequest(input);

      expect(db.returnRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "approved",
          }),
        })
      );
    });

    it("does not auto-approve when over max value", async () => {
      const autoApproveSettings = {
        ...mockShopSettings,
        autoApproveEnabled: true,
        autoApproveMaxValue: 50,
      };
      vi.mocked(db.shopSettings.findUnique).mockResolvedValue(autoApproveSettings);

      const createdReturn = {
        ...mockReturnRequest,
        status: "pending",
        items: [mockReturnItem],
      };
      vi.mocked(db.returnRequest.create).mockResolvedValue(createdReturn);

      const input = {
        shop: mockShop,
        shopifyOrderId: "gid://shopify/Order/123456",
        shopifyOrderName: "#1001",
        customerEmail: "customer@example.com",
        customerName: "John Doe",
        items: [
          {
            shopifyLineItemId: "gid://shopify/LineItem/789",
            title: "Widget",
            quantity: 1,
            pricePerItem: 100,
          },
        ],
      };

      await createReturnRequest(input);

      expect(db.returnRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "pending",
          }),
        })
      );
    });
  });

  describe("approveReturnRequest", () => {
    it("updates status to approved with timestamp", async () => {
      const approvedReturn = {
        ...mockReturnRequest,
        status: "approved",
        approvedAt: new Date(),
        items: [mockReturnItem],
        label: null,
      };
      vi.mocked(db.returnRequest.update).mockResolvedValue(approvedReturn);

      const result = await approveReturnRequest("return_123", "Approved by merchant");

      expect(db.returnRequest.update).toHaveBeenCalledWith({
        where: { id: "return_123" },
        data: {
          status: "approved",
          approvedAt: expect.any(Date),
          merchantNotes: "Approved by merchant",
        },
        include: { items: true, label: true },
      });
      expect(result.status).toBe("approved");
    });
  });

  describe("declineReturnRequest", () => {
    it("updates status to declined", async () => {
      const declinedReturn = {
        ...mockReturnRequest,
        status: "declined",
        items: [mockReturnItem],
      };
      vi.mocked(db.returnRequest.update).mockResolvedValue(declinedReturn);

      const result = await declineReturnRequest("return_123", "Outside return window");

      expect(db.returnRequest.update).toHaveBeenCalledWith({
        where: { id: "return_123" },
        data: {
          status: "declined",
          merchantNotes: "Outside return window",
        },
        include: { items: true },
      });
      expect(result.status).toBe("declined");
    });
  });

  describe("completeReturnRequest", () => {
    it("updates status to completed with timestamp", async () => {
      const completedReturn = {
        ...mockReturnRequest,
        status: "completed",
        completedAt: new Date(),
        items: [mockReturnItem],
        label: null,
      };
      vi.mocked(db.returnRequest.update).mockResolvedValue(completedReturn);

      const result = await completeReturnRequest("return_123");

      expect(db.returnRequest.update).toHaveBeenCalledWith({
        where: { id: "return_123" },
        data: {
          status: "completed",
          completedAt: expect.any(Date),
        },
        include: { items: true, label: true },
      });
      expect(result.status).toBe("completed");
    });
  });

  describe("getReturnDestinations", () => {
    it("returns destinations ordered by default first", async () => {
      const destinations = [mockReturnDestination];
      vi.mocked(db.returnDestination.findMany).mockResolvedValue(destinations);

      const result = await getReturnDestinations(mockShop);

      expect(db.returnDestination.findMany).toHaveBeenCalledWith({
        where: { shop: mockShop },
        orderBy: { isDefault: "desc" },
      });
      expect(result).toEqual(destinations);
    });
  });

  describe("createReturnDestination", () => {
    it("creates destination and sets as default when specified", async () => {
      vi.mocked(db.returnDestination.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(db.returnDestination.create).mockResolvedValue(mockReturnDestination);

      const input = {
        name: "Main Warehouse",
        addressLine1: "123 Warehouse St",
        city: "San Francisco",
        state: "CA",
        postalCode: "94102",
        isDefault: true,
      };

      await createReturnDestination(mockShop, input);

      expect(db.returnDestination.updateMany).toHaveBeenCalledWith({
        where: { shop: mockShop },
        data: { isDefault: false },
      });
      expect(db.returnDestination.create).toHaveBeenCalled();
    });
  });

  describe("getReturnStats", () => {
    it("returns aggregated stats for shop", async () => {
      vi.mocked(db.returnRequest.count)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(18);

      vi.mocked(db.returnRequest.aggregate).mockResolvedValue({
        _sum: { totalRefundAmount: 1500 },
        _count: {},
        _avg: {},
        _min: {},
        _max: {},
      });

      const result = await getReturnStats(mockShop);

      expect(result).toEqual({
        pending: 5,
        approved: 3,
        completed: 10,
        totalThisMonth: 18,
        refundedThisMonth: 1500,
      });
    });

    it("handles null refund sum", async () => {
      vi.mocked(db.returnRequest.count).mockResolvedValue(0);
      vi.mocked(db.returnRequest.aggregate).mockResolvedValue({
        _sum: { totalRefundAmount: null },
        _count: {},
        _avg: {},
        _min: {},
        _max: {},
      });

      const result = await getReturnStats(mockShop);

      expect(result.refundedThisMonth).toBe(0);
    });
  });
});
