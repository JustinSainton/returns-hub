import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { unauthenticated } from "../shopify.server";
import { getShopSettings } from "../services/returns.server";

const GET_ORDER_BY_NAME = `#graphql
  query GetOrderByName($query: String!) {
    orders(first: 1, query: $query) {
      nodes {
        id
        name
        email
        createdAt
        displayFinancialStatus
        displayFulfillmentStatus
        customer {
          firstName
          lastName
          email
        }
        lineItems(first: 50) {
          nodes {
            id
            name
            title
            variantTitle
            quantity
            originalUnitPriceSet {
              shopMoney {
                amount
              }
            }
            image {
              url(transform: { maxWidth: 200 })
            }
            variant {
              id
              sku
              product {
                id
              }
            }
          }
        }
        fulfillments(first: 10) {
          createdAt
          status
          fulfillmentLineItems(first: 50) {
            nodes {
              id
              lineItem {
                id
              }
              quantity
            }
          }
        }
      }
    }
  }
`;

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { orderNumber, email, shop } = body;

    if (!orderNumber || !email || !shop) {
      return json(
        { error: "Order number, email, and shop are required" },
        { status: 400 }
      );
    }

    const normalizedOrderNumber = orderNumber.replace(/^#/, "").trim();
    const normalizedEmail = email.toLowerCase().trim();

    const { admin } = await unauthenticated.admin(shop);
    const settings = await getShopSettings(shop);

    const response = await admin.graphql(GET_ORDER_BY_NAME, {
      variables: {
        query: `name:#${normalizedOrderNumber}`,
      },
    });

    const data = await response.json();
    const order = data.data?.orders?.nodes?.[0];

    if (!order) {
      return json(
        { error: "Order not found. Please check your order number." },
        { status: 404 }
      );
    }

    if (order.email?.toLowerCase() !== normalizedEmail) {
      return json(
        { error: "Email does not match the order. Please check your information." },
        { status: 404 }
      );
    }

    const latestFulfillment = order.fulfillments?.[0];
    if (latestFulfillment) {
      const fulfillmentDate = new Date(latestFulfillment.createdAt);
      const daysSinceFulfillment = Math.floor(
        (Date.now() - fulfillmentDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceFulfillment > settings.returnWindowDays) {
        return json(
          {
            error: `This order is outside the ${settings.returnWindowDays}-day return window.`,
          },
          { status: 400 }
        );
      }
    }

    const fulfilledLineItemIds = new Set<string>();
    order.fulfillments?.forEach((fulfillment: { fulfillmentLineItems: { nodes: Array<{ lineItem: { id: string } }> } }) => {
      fulfillment.fulfillmentLineItems?.nodes?.forEach((fli: { lineItem: { id: string } }) => {
        fulfilledLineItemIds.add(fli.lineItem.id);
      });
    });

    const lineItems = order.lineItems.nodes
      .filter((item: { id: string }) => fulfilledLineItemIds.has(item.id))
      .map((item: {
        id: string;
        title: string;
        variantTitle: string | null;
        quantity: number;
        originalUnitPriceSet: { shopMoney: { amount: string } };
        image: { url: string } | null;
        variant: { id: string; sku: string | null; product: { id: string } } | null;
      }) => ({
        id: item.id,
        title: item.title,
        variantTitle: item.variantTitle,
        quantity: item.quantity,
        price: parseFloat(item.originalUnitPriceSet.shopMoney.amount),
        image: item.image?.url,
        variantId: item.variant?.id,
        productId: item.variant?.product?.id,
        sku: item.variant?.sku,
        alreadyReturned: false,
      }));

    if (lineItems.length === 0) {
      return json(
        { error: "No fulfilled items available for return." },
        { status: 400 }
      );
    }

    const customerName = order.customer
      ? `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim()
      : "Customer";

    return json({
      order: {
        id: order.id,
        name: order.name,
        email: order.email,
        createdAt: order.createdAt,
        customerName,
        lineItems,
        returnWindowDays: settings.returnWindowDays,
      },
    });
  } catch (error) {
    console.error("Order lookup error:", error);
    return json(
      { error: "An error occurred while looking up your order." },
      { status: 500 }
    );
  }
}
