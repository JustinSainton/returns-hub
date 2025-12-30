import { describe, it, expect, vi, beforeEach } from "vitest";
import { json } from "@remix-run/node";

vi.mock("../../app/shopify.server", () => ({
  unauthenticated: {
    admin: vi.fn(),
  },
}));

vi.mock("../../app/db.server", () => ({
  default: {
    shopSettings: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    returnRequest: {
      create: vi.fn(),
    },
  },
}));

import { unauthenticated } from "../../app/shopify.server";
import db from "../../app/db.server";

const mockUnauthenticated = unauthenticated as unknown as { admin: ReturnType<typeof vi.fn> };

describe("Customer API Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/customer/lookup", () => {
    it("returns 404 when order not found", async () => {
      mockUnauthenticated.admin.mockResolvedValue({
        admin: {
          graphql: vi.fn().mockResolvedValue({
            json: () => Promise.resolve({
              data: { orders: { nodes: [] } },
            }),
          }),
        },
      });

      const mockSettings = { returnWindowDays: 30 };
      (db.shopSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockSettings);
      (db.shopSettings.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockSettings);

      const { action } = await import("../../app/routes/api.customer.lookup");

      const request = new Request("http://localhost/api/customer/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: "9999",
          email: "customer@example.com",
          shop: "test-shop.myshopify.com",
        }),
      });

      const response = await action({ request, params: {}, context: {} });

      expect(response.status).toBe(404);
    });

    it("returns 404 when email does not match", async () => {
      mockUnauthenticated.admin.mockResolvedValue({
        admin: {
          graphql: vi.fn().mockResolvedValue({
            json: () => Promise.resolve({
              data: {
                orders: {
                  nodes: [{
                    id: "gid://shopify/Order/123",
                    name: "#1001",
                    email: "other@example.com",
                  }],
                },
              },
            }),
          }),
        },
      });

      const mockSettings = { returnWindowDays: 30 };
      (db.shopSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockSettings);
      (db.shopSettings.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockSettings);

      const { action } = await import("../../app/routes/api.customer.lookup");

      const request = new Request("http://localhost/api/customer/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: "1001",
          email: "wrong@example.com",
          shop: "test-shop.myshopify.com",
        }),
      });

      const response = await action({ request, params: {}, context: {} });

      expect(response.status).toBe(404);
    });

    it("returns 400 for missing required fields", async () => {
      const { action } = await import("../../app/routes/api.customer.lookup");

      const request = new Request("http://localhost/api/customer/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: "1001",
        }),
      });

      const response = await action({ request, params: {}, context: {} });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/customer/returns", () => {
    it("creates a return request successfully", async () => {
      (db.shopSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        returnWindowDays: 30,
        autoApproveEnabled: false,
        requireReason: true,
      });

      (db.shopSettings.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        returnWindowDays: 30,
        autoApproveEnabled: false,
        requireReason: true,
      });

      (db.returnRequest.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "return-123",
        status: "pending",
      });

      const { action } = await import("../../app/routes/api.customer.returns");

      const request = new Request("http://localhost/api/customer/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: "test-shop.myshopify.com",
          orderId: "gid://shopify/Order/123",
          orderName: "#1001",
          customerEmail: "customer@example.com",
          customerName: "John Doe",
          items: [
            {
              lineItemId: "gid://shopify/LineItem/1",
              title: "Test Product",
              quantity: 1,
              price: 29.99,
              reason: "defective",
            },
          ],
        }),
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json() as { success: boolean; returnId: string };

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.returnId).toBe("return-123");
    });

    it("auto-approves when enabled and under threshold", async () => {
      (db.shopSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        returnWindowDays: 30,
        autoApproveEnabled: true,
        autoApproveMaxValue: 100,
        requireReason: true,
      });

      (db.returnRequest.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "return-456",
        status: "approved",
      });

      const { action } = await import("../../app/routes/api.customer.returns");

      const request = new Request("http://localhost/api/customer/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: "test-shop.myshopify.com",
          orderId: "gid://shopify/Order/123",
          orderName: "#1001",
          customerEmail: "customer@example.com",
          customerName: "John Doe",
          items: [
            {
              lineItemId: "gid://shopify/LineItem/1",
              title: "Test Product",
              quantity: 1,
              price: 29.99,
              reason: "defective",
            },
          ],
        }),
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json() as { status: string };

      expect(data.status).toBe("approved");
    });

    it("returns 400 for missing items", async () => {
      const { action } = await import("../../app/routes/api.customer.returns");

      const request = new Request("http://localhost/api/customer/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: "test-shop.myshopify.com",
          orderId: "gid://shopify/Order/123",
          orderName: "#1001",
          customerEmail: "customer@example.com",
          customerName: "John Doe",
          items: [],
        }),
      });

      const response = await action({ request, params: {}, context: {} });

      expect(response.status).toBe(400);
    });
  });
});
