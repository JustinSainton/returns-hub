import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

interface FulfillmentWebhookPayload {
  id: number;
  order_id: number;
  status: string;
  created_at: string;
  tracking_number: string | null;
  tracking_url: string | null;
  line_items: Array<{
    id: number;
    variant_id: number;
    title: string;
    quantity: number;
  }>;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const fulfillment = payload as FulfillmentWebhookPayload;

  console.log(`Order ${fulfillment.order_id} fulfilled at ${fulfillment.created_at}`);
  console.log(`Fulfillment status: ${fulfillment.status}`);
  console.log(`Items fulfilled: ${fulfillment.line_items.length}`);

  if (fulfillment.tracking_number) {
    console.log(`Tracking: ${fulfillment.tracking_number}`);
  }

  return new Response();
};
