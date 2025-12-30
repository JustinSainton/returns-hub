import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getShopSettings } from "../services/returns.server";

interface ReturnRequestWebhookPayload {
  id: number;
  admin_graphql_api_id: string;
  order: {
    id: number;
    admin_graphql_api_id: string;
    name: string;
  };
  return_line_items: Array<{
    id: number;
    return_reason: string;
    return_reason_note: string | null;
    fulfillment_line_item: {
      id: number;
      line_item: {
        id: number;
        name: string;
        quantity: number;
        price: string;
      };
    };
  }>;
  status: string;
  customer_email: string | null;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const returnData = payload as ReturnRequestWebhookPayload;

  console.log(`Return request ${returnData.id} for order ${returnData.order.name}`);
  console.log(`Status: ${returnData.status}`);
  console.log(`Items: ${returnData.return_line_items.length}`);

  const settings = await getShopSettings(shop);

  const existingReturn = await db.returnRequest.findFirst({
    where: {
      shop,
      shopifyOrderId: returnData.order.admin_graphql_api_id,
    },
  });

  if (!existingReturn && returnData.customer_email) {
    const totalRefundAmount = returnData.return_line_items.reduce((sum, item) => {
      const price = parseFloat(item.fulfillment_line_item.line_item.price);
      const quantity = item.fulfillment_line_item.line_item.quantity;
      return sum + price * quantity;
    }, 0);

    const shouldAutoApprove =
      settings.autoApproveEnabled &&
      (!settings.autoApproveMaxValue || totalRefundAmount <= settings.autoApproveMaxValue);

    await db.returnRequest.create({
      data: {
        shop,
        shopifyOrderId: returnData.order.admin_graphql_api_id,
        shopifyOrderName: returnData.order.name,
        customerEmail: returnData.customer_email,
        customerName: "Customer",
        status: shouldAutoApprove ? "approved" : "pending",
        approvedAt: shouldAutoApprove ? new Date() : null,
        totalRefundAmount,
        items: {
          create: returnData.return_line_items.map((item) => ({
            shopifyLineItemId: String(item.fulfillment_line_item.line_item.id),
            title: item.fulfillment_line_item.line_item.name,
            quantity: item.fulfillment_line_item.line_item.quantity,
            pricePerItem: parseFloat(item.fulfillment_line_item.line_item.price),
            reason: item.return_reason,
          })),
        },
      },
    });

    console.log(`Created return request in database for order ${returnData.order.name}`);
  }

  return new Response();
};
