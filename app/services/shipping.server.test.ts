import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ShippoProvider,
  EasyPostProvider,
  type Address,
  type LabelResult,
} from "./shipping.server";

global.fetch = vi.fn();

describe("Shipping Providers", () => {
  const mockFromAddress: Address = {
    name: "John Doe",
    street1: "123 Customer St",
    city: "Los Angeles",
    state: "CA",
    zip: "90001",
    country: "US",
    phone: "310-555-1234",
    email: "customer@example.com",
  };

  const mockToAddress: Address = {
    name: "Returns Warehouse",
    company: "Acme Corp",
    street1: "456 Warehouse Way",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
    country: "US",
    phone: "415-555-5678",
  };

  const mockParcel = { weight: 2, length: 12, width: 8, height: 4 };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ShippoProvider", () => {
    const provider = new ShippoProvider("test_shippo_api_key");

    describe("validateApiKey", () => {
      it("returns true when API key is valid", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        } as Response);

        const result = await provider.validateApiKey();

        expect(result).toBe(true);
        expect(fetch).toHaveBeenCalledWith(
          "https://api.goshippo.com/addresses",
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: "ShippoToken test_shippo_api_key",
            }),
          })
        );
      });

      it("returns false when API key is invalid", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: false,
        } as Response);

        const result = await provider.validateApiKey();

        expect(result).toBe(false);
      });

      it("returns false on network error", async () => {
        vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

        const result = await provider.validateApiKey();

        expect(result).toBe(false);
      });
    });

    describe("createLabel", () => {
      it("creates label successfully", async () => {
        vi.mocked(fetch)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              rates: [
                { object_id: "rate_123", amount: "8.50", provider: "USPS" },
                { object_id: "rate_456", amount: "12.00", provider: "UPS" },
              ],
            }),
          } as Response)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              status: "SUCCESS",
              tracking_number: "9400111899223456789012",
              tracking_url_provider: "https://tools.usps.com/track",
              label_url: "https://shippo.com/labels/abc.pdf",
              object_id: "txn_abc123",
            }),
          } as Response);

        const result = await provider.createLabel(mockFromAddress, mockToAddress, mockParcel);

        expect(result.success).toBe(true);
        expect(result.carrier).toBe("USPS");
        expect(result.trackingNumber).toBe("9400111899223456789012");
        expect(result.cost).toBe(8.5);
      });

      it("returns error when shipment creation fails", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: false,
          text: async () => "Invalid address",
        } as Response);

        const result = await provider.createLabel(mockFromAddress, mockToAddress, mockParcel);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Shippo API error");
      });

      it("returns error when no rates available", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ rates: [] }),
        } as Response);

        const result = await provider.createLabel(mockFromAddress, mockToAddress, mockParcel);

        expect(result.success).toBe(false);
        expect(result.error).toBe("No shipping rates available");
      });

      it("returns error when transaction fails", async () => {
        vi.mocked(fetch)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              rates: [{ object_id: "rate_123", amount: "8.50", provider: "USPS" }],
            }),
          } as Response)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              status: "ERROR",
              messages: [{ text: "Insufficient postage" }],
            }),
          } as Response);

        const result = await provider.createLabel(mockFromAddress, mockToAddress, mockParcel);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Insufficient postage");
      });

      it("handles network errors gracefully", async () => {
        vi.mocked(fetch).mockRejectedValueOnce(new Error("Connection refused"));

        const result = await provider.createLabel(mockFromAddress, mockToAddress, mockParcel);

        expect(result.success).toBe(false);
        expect(result.error).toBe("Connection refused");
      });
    });
  });

  describe("EasyPostProvider", () => {
    const provider = new EasyPostProvider("test_easypost_api_key");

    describe("validateApiKey", () => {
      it("returns true when API key is valid", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
        } as Response);

        const result = await provider.validateApiKey();

        expect(result).toBe(true);
        expect(fetch).toHaveBeenCalledWith(
          "https://api.easypost.com/v2/addresses",
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: expect.stringContaining("Basic"),
            }),
          })
        );
      });

      it("returns false when API key is invalid", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: false,
        } as Response);

        const result = await provider.validateApiKey();

        expect(result).toBe(false);
      });
    });

    describe("createLabel", () => {
      it("creates label successfully", async () => {
        vi.mocked(fetch)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              id: "shp_abc123",
              rates: [{ id: "rate_123", rate: "7.99", carrier: "USPS" }],
              lowestRate: { id: "rate_123", rate: "7.99", carrier: "USPS" },
            }),
          } as Response)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              id: "shp_abc123",
              tracking_code: "9400111899223456789012",
              selected_rate: { rate: "7.99", carrier: "USPS" },
              postage_label: {
                label_url: "https://easypost.com/labels/abc.png",
                label_pdf_url: "https://easypost.com/labels/abc.pdf",
              },
              tracker: { public_url: "https://track.easypost.com/abc" },
            }),
          } as Response);

        const result = await provider.createLabel(mockFromAddress, mockToAddress, mockParcel);

        expect(result.success).toBe(true);
        expect(result.carrier).toBe("USPS");
        expect(result.trackingNumber).toBe("9400111899223456789012");
        expect(result.cost).toBe(7.99);
      });

      it("returns error when shipment creation fails", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: false,
          text: async () => "Invalid API key",
        } as Response);

        const result = await provider.createLabel(mockFromAddress, mockToAddress, mockParcel);

        expect(result.success).toBe(false);
        expect(result.error).toContain("EasyPost API error");
      });

      it("returns error when no rates available", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "shp_abc123", rates: [] }),
        } as Response);

        const result = await provider.createLabel(mockFromAddress, mockToAddress, mockParcel);

        expect(result.success).toBe(false);
        expect(result.error).toBe("No shipping rates available");
      });

      it("returns error when purchase fails", async () => {
        vi.mocked(fetch)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              id: "shp_abc123",
              rates: [{ id: "rate_123", rate: "7.99", carrier: "USPS" }],
            }),
          } as Response)
          .mockResolvedValueOnce({
            ok: false,
            text: async () => "Insufficient funds",
          } as Response);

        const result = await provider.createLabel(mockFromAddress, mockToAddress, mockParcel);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Failed to purchase label");
      });
    });
  });
});
