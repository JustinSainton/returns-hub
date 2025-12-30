import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { createReturnRequest, getShopSettings } from "../services/returns.server";

interface ReturnItemInput {
  lineItemId: string;
  variantId?: string;
  productId?: string;
  title: string;
  variantTitle?: string;
  sku?: string;
  quantity: number;
  price: number;
  reason: string;
  notes?: string;
}

interface CreateReturnBody {
  shop: string;
  orderId: string;
  orderName: string;
  customerEmail: string;
  customerName: string;
  items: ReturnItemInput[];
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body: CreateReturnBody = await request.json();
    const { shop, orderId, orderName, customerEmail, customerName, items } = body;

    if (!shop || !orderId || !orderName || !customerEmail || !items?.length) {
      return json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const settings = await getShopSettings(shop);

    for (const item of items) {
      if (!item.lineItemId || !item.title || !item.quantity || !item.reason) {
        return json(
          { error: "Each item must have lineItemId, title, quantity, and reason" },
          { status: 400 }
        );
      }

      if (settings.requireReason && !item.reason) {
        return json(
          { error: "A return reason is required for each item" },
          { status: 400 }
        );
      }
    }

    const aggregatedReason = items
      .map((item) => `${item.title}: ${item.reason}`)
      .join("; ");

    const aggregatedNotes = items
      .filter((item) => item.notes)
      .map((item) => `${item.title}: ${item.notes}`)
      .join("\n");

    const returnRequest = await createReturnRequest({
      shop,
      shopifyOrderId: orderId,
      shopifyOrderName: orderName,
      customerEmail,
      customerName,
      reason: aggregatedReason,
      customerNotes: aggregatedNotes || undefined,
      items: items.map((item) => ({
        shopifyLineItemId: item.lineItemId,
        shopifyVariantId: item.variantId,
        shopifyProductId: item.productId,
        title: item.title,
        variantTitle: item.variantTitle,
        sku: item.sku,
        quantity: item.quantity,
        pricePerItem: item.price,
        reason: item.reason,
      })),
    });

    return json({
      success: true,
      returnId: returnRequest.id,
      status: returnRequest.status,
      message: returnRequest.status === "approved"
        ? "Your return has been automatically approved!"
        : "Your return request has been submitted and is pending review.",
    });
  } catch (error) {
    console.error("Return submission error:", error);
    return json(
      { error: "An error occurred while submitting your return request." },
      { status: 500 }
    );
  }
}
