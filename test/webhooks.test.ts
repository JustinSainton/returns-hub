import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../app/shopify.server", () => ({
  authenticate: {
    webhook: vi.fn(),
  },
}));

vi.mock("../app/db.server", () => ({
  default: {
    session: {
      deleteMany: vi.fn(),
    },
    returnRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("../app/services/returns.server", () => ({
  getShopSettings: vi.fn(() =>
    Promise.resolve({
      returnWindowDays: 30,
      autoApproveEnabled: false,
      autoApproveMaxValue: null,
      requirePhotos: false,
      requireReason: true,
    })
  ),
}));

import { authenticate } from "../app/shopify.server";
import db from "../app/db.server";
import { getShopSettings } from "../app/services/returns.server";

const mockWebhook = authenticate.webhook as ReturnType<typeof vi.fn>;
const mockGetShopSettings = getShopSettings as ReturnType<typeof vi.fn>;

function createMockRequest(method = "POST"): Request {
  return new Request("http://localhost/webhooks/test", {
    method,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Webhook Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("orders/fulfilled webhook", () => {
    it("logs fulfillment details", async () => {
      const consoleSpy = vi.spyOn(console, "log");
      mockWebhook.mockResolvedValue({
        shop: "test-shop.myshopify.com",
        topic: "orders/fulfilled",
        payload: {
          id: 123456,
          order_id: 789,
          status: "success",
          created_at: "2024-12-29T12:00:00Z",
          tracking_number: "1Z999AA10123456784",
          tracking_url: "https://tracking.url",
          line_items: [{ id: 1, title: "Test Product", quantity: 2 }],
        },
      });

      const { action } = await import("../app/routes/webhooks.orders.fulfilled");
      const response = await action({ request: createMockRequest(), params: {}, context: {} });

      expect(response).toBeInstanceOf(Response);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("orders/fulfilled")
      );
    });
  });

  describe("returns/request webhook", () => {
    it("creates a return request when one does not exist", async () => {
      mockWebhook.mockResolvedValue({
        shop: "test-shop.myshopify.com",
        topic: "returns/request",
        payload: {
          id: 111,
          admin_graphql_api_id: "gid://shopify/Return/111",
          order: {
            id: 222,
            admin_graphql_api_id: "gid://shopify/Order/222",
            name: "#1001",
          },
          return_line_items: [
            {
              id: 1,
              return_reason: "DEFECTIVE",
              return_reason_note: "Product arrived damaged",
              fulfillment_line_item: {
                id: 1,
                line_item: {
                  id: 1,
                  name: "Test Product",
                  quantity: 1,
                  price: "29.99",
                },
              },
            },
          ],
          status: "REQUESTED",
          customer_email: "customer@example.com",
        },
      });

      (db.returnRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (db.returnRequest.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new-return" });

      const { action } = await import("../app/routes/webhooks.returns.request");
      const response = await action({ request: createMockRequest(), params: {}, context: {} });

      expect(response).toBeInstanceOf(Response);
      expect(db.returnRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shop: "test-shop.myshopify.com",
            shopifyOrderName: "#1001",
            customerEmail: "customer@example.com",
          }),
        })
      );
    });

    it("auto-approves when settings allow", async () => {
      mockGetShopSettings.mockResolvedValue({
        returnWindowDays: 30,
        autoApproveEnabled: true,
        autoApproveMaxValue: 100,
        requirePhotos: false,
        requireReason: true,
      });

      mockWebhook.mockResolvedValue({
        shop: "test-shop.myshopify.com",
        topic: "returns/request",
        payload: {
          id: 111,
          admin_graphql_api_id: "gid://shopify/Return/111",
          order: {
            id: 222,
            admin_graphql_api_id: "gid://shopify/Order/222",
            name: "#1001",
          },
          return_line_items: [
            {
              id: 1,
              return_reason: "DEFECTIVE",
              return_reason_note: null,
              fulfillment_line_item: {
                id: 1,
                line_item: {
                  id: 1,
                  name: "Test Product",
                  quantity: 1,
                  price: "29.99",
                },
              },
            },
          ],
          status: "REQUESTED",
          customer_email: "customer@example.com",
        },
      });

      (db.returnRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (db.returnRequest.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new-return" });

      const { action } = await import("../app/routes/webhooks.returns.request");
      await action({ request: createMockRequest(), params: {}, context: {} });

      expect(db.returnRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "approved",
            approvedAt: expect.any(Date),
          }),
        })
      );
    });

    it("skips creation when return already exists", async () => {
      mockWebhook.mockResolvedValue({
        shop: "test-shop.myshopify.com",
        topic: "returns/request",
        payload: {
          id: 111,
          admin_graphql_api_id: "gid://shopify/Return/111",
          order: {
            id: 222,
            admin_graphql_api_id: "gid://shopify/Order/222",
            name: "#1001",
          },
          return_line_items: [],
          status: "REQUESTED",
          customer_email: "customer@example.com",
        },
      });

      (db.returnRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "existing" });

      const { action } = await import("../app/routes/webhooks.returns.request");
      await action({ request: createMockRequest(), params: {}, context: {} });

      expect(db.returnRequest.create).not.toHaveBeenCalled();
    });
  });

  describe("returns/approve webhook", () => {
    it("updates return status to approved", async () => {
      mockWebhook.mockResolvedValue({
        shop: "test-shop.myshopify.com",
        topic: "returns/approve",
        payload: {
          id: 111,
          admin_graphql_api_id: "gid://shopify/Return/111",
          order: {
            id: 222,
            admin_graphql_api_id: "gid://shopify/Order/222",
            name: "#1001",
          },
          status: "APPROVED",
        },
      });

      (db.returnRequest.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

      const { action } = await import("../app/routes/webhooks.returns.approve");
      const response = await action({ request: createMockRequest(), params: {}, context: {} });

      expect(response).toBeInstanceOf(Response);
      expect(db.returnRequest.updateMany).toHaveBeenCalledWith({
        where: {
          shop: "test-shop.myshopify.com",
          shopifyOrderId: "gid://shopify/Order/222",
          status: "pending",
        },
        data: {
          status: "approved",
          approvedAt: expect.any(Date),
        },
      });
    });
  });

  describe("returns/decline webhook", () => {
    it("updates return status to declined with reason", async () => {
      mockWebhook.mockResolvedValue({
        shop: "test-shop.myshopify.com",
        topic: "returns/decline",
        payload: {
          id: 111,
          admin_graphql_api_id: "gid://shopify/Return/111",
          order: {
            id: 222,
            admin_graphql_api_id: "gid://shopify/Order/222",
            name: "#1001",
          },
          status: "DECLINED",
          decline_reason: "Item was used",
        },
      });

      (db.returnRequest.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

      const { action } = await import("../app/routes/webhooks.returns.decline");
      const response = await action({ request: createMockRequest(), params: {}, context: {} });

      expect(response).toBeInstanceOf(Response);
      expect(db.returnRequest.updateMany).toHaveBeenCalledWith({
        where: {
          shop: "test-shop.myshopify.com",
          shopifyOrderId: "gid://shopify/Order/222",
          status: { in: ["pending", "approved"] },
        },
        data: {
          status: "declined",
          merchantNotes: "Item was used",
        },
      });
    });
  });

  describe("returns/close webhook", () => {
    it("updates return status to completed", async () => {
      mockWebhook.mockResolvedValue({
        shop: "test-shop.myshopify.com",
        topic: "returns/close",
        payload: {
          id: 111,
          admin_graphql_api_id: "gid://shopify/Return/111",
          order: {
            id: 222,
            admin_graphql_api_id: "gid://shopify/Order/222",
            name: "#1001",
          },
          status: "CLOSED",
        },
      });

      (db.returnRequest.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

      const { action } = await import("../app/routes/webhooks.returns.close");
      const response = await action({ request: createMockRequest(), params: {}, context: {} });

      expect(response).toBeInstanceOf(Response);
      expect(db.returnRequest.updateMany).toHaveBeenCalledWith({
        where: {
          shop: "test-shop.myshopify.com",
          shopifyOrderId: "gid://shopify/Order/222",
        },
        data: {
          status: "completed",
          completedAt: expect.any(Date),
        },
      });
    });
  });
});
