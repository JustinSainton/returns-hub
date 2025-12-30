import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

interface ReturnCloseWebhookPayload {
  id: number;
  admin_graphql_api_id: string;
  order: {
    id: number;
    admin_graphql_api_id: string;
    name: string;
  };
  status: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const returnData = payload as ReturnCloseWebhookPayload;

  console.log(`Return ${returnData.id} closed for order ${returnData.order.name}`);

  await db.returnRequest.updateMany({
    where: {
      shop,
      shopifyOrderId: returnData.order.admin_graphql_api_id,
    },
    data: {
      status: "completed",
      completedAt: new Date(),
    },
  });

  return new Response();
};
