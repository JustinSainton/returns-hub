import db from "../db.server";

export interface Address {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface LabelResult {
  success: boolean;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  labelUrl?: string;
  labelPdfUrl?: string;
  transactionId?: string;
  cost?: number;
  error?: string;
}

export interface ShippingProvider {
  name: string;
  createLabel(
    fromAddress: Address,
    toAddress: Address,
    parcel: { weight: number; length?: number; width?: number; height?: number }
  ): Promise<LabelResult>;
  validateApiKey(): Promise<boolean>;
}

export class ShippoProvider implements ShippingProvider {
  name = "shippo";
  private apiKey: string;
  private baseUrl = "https://api.goshippo.com";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/addresses`, {
        method: "GET",
        headers: {
          Authorization: `ShippoToken ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async createLabel(
    fromAddress: Address,
    toAddress: Address,
    parcel: { weight: number; length?: number; width?: number; height?: number }
  ): Promise<LabelResult> {
    try {
      const shipmentResponse = await fetch(`${this.baseUrl}/shipments`, {
        method: "POST",
        headers: {
          Authorization: `ShippoToken ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address_from: {
            name: fromAddress.name,
            company: fromAddress.company,
            street1: fromAddress.street1,
            street2: fromAddress.street2,
            city: fromAddress.city,
            state: fromAddress.state,
            zip: fromAddress.zip,
            country: fromAddress.country,
            phone: fromAddress.phone,
            email: fromAddress.email,
          },
          address_to: {
            name: toAddress.name,
            company: toAddress.company,
            street1: toAddress.street1,
            street2: toAddress.street2,
            city: toAddress.city,
            state: toAddress.state,
            zip: toAddress.zip,
            country: toAddress.country,
            phone: toAddress.phone,
            email: toAddress.email,
          },
          parcels: [
            {
              length: parcel.length?.toString() || "10",
              width: parcel.width?.toString() || "10",
              height: parcel.height?.toString() || "5",
              distance_unit: "in",
              weight: parcel.weight.toString(),
              mass_unit: "lb",
            },
          ],
          async: false,
        }),
      });

      if (!shipmentResponse.ok) {
        const error = await shipmentResponse.text();
        return { success: false, error: `Shippo API error: ${error}` };
      }

      const shipment = await shipmentResponse.json();

      if (!shipment.rates || shipment.rates.length === 0) {
        return { success: false, error: "No shipping rates available" };
      }

      const cheapestRate = shipment.rates.reduce(
        (min: { amount: string }, rate: { amount: string }) =>
          parseFloat(rate.amount) < parseFloat(min.amount) ? rate : min
      );

      const transactionResponse = await fetch(`${this.baseUrl}/transactions`, {
        method: "POST",
        headers: {
          Authorization: `ShippoToken ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rate: cheapestRate.object_id,
          label_file_type: "PDF",
          async: false,
        }),
      });

      if (!transactionResponse.ok) {
        const error = await transactionResponse.text();
        return { success: false, error: `Failed to create label: ${error}` };
      }

      const transaction = await transactionResponse.json();

      if (transaction.status !== "SUCCESS") {
        return {
          success: false,
          error: transaction.messages?.map((m: { text: string }) => m.text).join(", ") || "Label creation failed",
        };
      }

      return {
        success: true,
        carrier: cheapestRate.provider,
        trackingNumber: transaction.tracking_number,
        trackingUrl: transaction.tracking_url_provider,
        labelUrl: transaction.label_url,
        labelPdfUrl: transaction.label_url,
        transactionId: transaction.object_id,
        cost: parseFloat(cheapestRate.amount),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error creating label",
      };
    }
  }
}

export class EasyPostProvider implements ShippingProvider {
  name = "easypost";
  private apiKey: string;
  private baseUrl = "https://api.easypost.com/v2";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getAuthHeader(): string {
    return `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/addresses`, {
        method: "GET",
        headers: {
          Authorization: this.getAuthHeader(),
          "Content-Type": "application/json",
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async createLabel(
    fromAddress: Address,
    toAddress: Address,
    parcel: { weight: number; length?: number; width?: number; height?: number }
  ): Promise<LabelResult> {
    try {
      const shipmentResponse = await fetch(`${this.baseUrl}/shipments`, {
        method: "POST",
        headers: {
          Authorization: this.getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shipment: {
            from_address: {
              name: fromAddress.name,
              company: fromAddress.company,
              street1: fromAddress.street1,
              street2: fromAddress.street2,
              city: fromAddress.city,
              state: fromAddress.state,
              zip: fromAddress.zip,
              country: fromAddress.country,
              phone: fromAddress.phone,
              email: fromAddress.email,
            },
            to_address: {
              name: toAddress.name,
              company: toAddress.company,
              street1: toAddress.street1,
              street2: toAddress.street2,
              city: toAddress.city,
              state: toAddress.state,
              zip: toAddress.zip,
              country: toAddress.country,
              phone: toAddress.phone,
              email: toAddress.email,
            },
            parcel: {
              length: parcel.length || 10,
              width: parcel.width || 10,
              height: parcel.height || 5,
              weight: parcel.weight * 16,
            },
          },
        }),
      });

      if (!shipmentResponse.ok) {
        const error = await shipmentResponse.text();
        return { success: false, error: `EasyPost API error: ${error}` };
      }

      const shipment = await shipmentResponse.json();

      if (!shipment.rates || shipment.rates.length === 0) {
        return { success: false, error: "No shipping rates available" };
      }

      const lowestRate = shipment.lowestRate || shipment.rates[0];

      const buyResponse = await fetch(`${this.baseUrl}/shipments/${shipment.id}/buy`, {
        method: "POST",
        headers: {
          Authorization: this.getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rate: { id: lowestRate.id },
        }),
      });

      if (!buyResponse.ok) {
        const error = await buyResponse.text();
        return { success: false, error: `Failed to purchase label: ${error}` };
      }

      const purchasedShipment = await buyResponse.json();

      return {
        success: true,
        carrier: purchasedShipment.selected_rate?.carrier || lowestRate.carrier,
        trackingNumber: purchasedShipment.tracking_code,
        trackingUrl: purchasedShipment.tracker?.public_url,
        labelUrl: purchasedShipment.postage_label?.label_url,
        labelPdfUrl: purchasedShipment.postage_label?.label_pdf_url,
        transactionId: purchasedShipment.id,
        cost: parseFloat(purchasedShipment.selected_rate?.rate || lowestRate.rate),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error creating label",
      };
    }
  }
}

export async function getShippingProvider(shop: string): Promise<ShippingProvider | null> {
  const settings = await db.shopSettings.findUnique({
    where: { shop },
  });

  if (!settings) {
    return null;
  }

  if (settings.shippoApiKey) {
    return new ShippoProvider(settings.shippoApiKey);
  }

  if (settings.easypostApiKey) {
    return new EasyPostProvider(settings.easypostApiKey);
  }

  return null;
}

export async function createReturnLabel(
  shop: string,
  returnRequestId: string,
  customerAddress: Address,
  parcel: { weight: number; length?: number; width?: number; height?: number } = { weight: 1 }
): Promise<LabelResult> {
  const provider = await getShippingProvider(shop);

  if (!provider) {
    return { success: false, error: "No shipping provider configured" };
  }

  const destination = await db.returnDestination.findFirst({
    where: { shop, isDefault: true },
  });

  if (!destination) {
    return { success: false, error: "No default return destination configured" };
  }

  const warehouseAddress: Address = {
    name: destination.name,
    street1: destination.addressLine1,
    street2: destination.addressLine2 || undefined,
    city: destination.city,
    state: destination.state,
    zip: destination.postalCode,
    country: destination.country,
    phone: destination.phone || undefined,
  };

  const result = await provider.createLabel(customerAddress, warehouseAddress, parcel);

  if (result.success) {
    await db.shippingLabel.create({
      data: {
        returnRequestId,
        carrier: result.carrier || "Unknown",
        trackingNumber: result.trackingNumber,
        trackingUrl: result.trackingUrl,
        labelUrl: result.labelUrl || "",
        labelPdfUrl: result.labelPdfUrl,
        shippoTransactionId: provider.name === "shippo" ? result.transactionId : null,
        easypostShipmentId: provider.name === "easypost" ? result.transactionId : null,
        cost: result.cost,
      },
    });
  }

  return result;
}

export async function getLabelForReturn(returnRequestId: string) {
  return db.shippingLabel.findUnique({
    where: { returnRequestId },
  });
}
