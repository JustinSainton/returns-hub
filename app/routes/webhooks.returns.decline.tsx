import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

interface ReturnDeclineWebhookPayload {
  id: number;
  admin_graphql_api_id: string;
  order: {
    id: number;
    admin_graphql_api_id: string;
    name: string;
  };
  status: string;
  decline_reason: string | null;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const returnData = payload as ReturnDeclineWebhookPayload;

  console.log(`Return ${returnData.id} declined for order ${returnData.order.name}`);
  if (returnData.decline_reason) {
    console.log(`Reason: ${returnData.decline_reason}`);
  }

  await db.returnRequest.updateMany({
    where: {
      shop,
      shopifyOrderId: returnData.order.admin_graphql_api_id,
      status: { in: ["pending", "approved"] },
    },
    data: {
      status: "declined",
      merchantNotes: returnData.decline_reason,
    },
  });

  return new Response();
};
