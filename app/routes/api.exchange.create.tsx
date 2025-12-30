import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getReturnRequestById } from "../services/returns.server";
import {
  createExchangeDraftOrder,
  completeDraftOrder,
  updateReturnWithExchange,
  createGiftCard,
  updateReturnWithStoreCredit,
  getExchangeSettings,
  calculateStoreCreditValue,
} from "../services/exchange.server";

interface ExchangeLineItem {
  variantId: string;
  quantity: number;
  title: string;
  variantTitle?: string;
  price: number;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const {
    returnRequestId,
    lineItems,
    completeImmediately = false,
  }: {
    returnRequestId: string;
    lineItems: ExchangeLineItem[];
    completeImmediately?: boolean;
  } = body;

  if (!returnRequestId) {
    return json({ error: "Return request ID required" }, { status: 400 });
  }

  if (!lineItems || lineItems.length === 0) {
    return json({ error: "At least one line item required" }, { status: 400 });
  }

  const returnRequest = await getReturnRequestById(returnRequestId);
  if (!returnRequest) {
    return json({ error: "Return request not found" }, { status: 404 });
  }

  if (returnRequest.shop !== session.shop) {
    return json({ error: "Unauthorized" }, { status: 403 });
  }

  if (returnRequest.resolutionType) {
    return json(
      { error: "Return already has a resolution" },
      { status: 400 }
    );
  }

  const cartTotal = lineItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const returnValue = returnRequest.totalRefundAmount;
  const discountAmount = Math.min(returnValue, cartTotal);
  const customerOwes = cartTotal > returnValue;
  const remainingCredit = returnValue > cartTotal ? returnValue - cartTotal : 0;

  const draftOrderLineItems = lineItems.map((item) => ({
    variantId: item.variantId,
    quantity: item.quantity,
  }));

  const draftOrderResult = await createExchangeDraftOrder(admin, {
    email: returnRequest.customerEmail,
    lineItems: draftOrderLineItems,
    discountAmount,
    note: `Exchange for return ${returnRequest.shopifyOrderName}`,
    returnRequestId: returnRequest.id,
  });

  const draftOrderData = await draftOrderResult;

  if (draftOrderData.data?.draftOrderCreate?.userErrors?.length > 0) {
    return json(
      { error: draftOrderData.data.draftOrderCreate.userErrors[0].message },
      { status: 400 }
    );
  }

  const draftOrder = draftOrderData.data?.draftOrderCreate?.draftOrder;
  if (!draftOrder) {
    return json({ error: "Failed to create draft order" }, { status: 500 });
  }

  await updateReturnWithExchange(returnRequestId, {
    resolutionType: "exchange",
    exchangeType: "shop_now",
    exchangeOrderId: draftOrder.id,
    exchangeValueUsed: discountAmount,
    exchangeBonusApplied: 0,
  });

  let completedOrder = null;
  if (completeImmediately && !customerOwes) {
    const completeResult = await completeDraftOrder(admin, draftOrder.id, false);
    const completeData = await completeResult;
    
    if (completeData.data?.draftOrderComplete?.draftOrder?.order) {
      completedOrder = completeData.data.draftOrderComplete.draftOrder.order;
    }
  }

  let storeCreditCode = null;
  if (remainingCredit > 0) {
    const settings = await getExchangeSettings(session.shop);
    const expiresOn = settings.storeCreditExpiryDays
      ? new Date(Date.now() + settings.storeCreditExpiryDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
      : undefined;

    const giftCardResult = await createGiftCard(admin, {
      initialValue: remainingCredit,
      note: `Remaining credit from exchange - Return #${returnRequest.id}`,
      expiresOn,
    });

    const giftCardData = await giftCardResult;
    if (giftCardData.data?.giftCardCreate?.giftCardCode) {
      storeCreditCode = giftCardData.data.giftCardCreate.giftCardCode;
    }
  }

  return json({
    success: true,
    draftOrder: {
      id: draftOrder.id,
      name: draftOrder.name,
      invoiceUrl: draftOrder.invoiceUrl,
      totalPrice: draftOrder.totalPriceSet?.shopMoney?.amount,
    },
    completedOrder: completedOrder
      ? {
          id: completedOrder.id,
          name: completedOrder.name,
        }
      : null,
    summary: {
      returnValue,
      cartTotal,
      discountApplied: discountAmount,
      customerOwes,
      amountDue: customerOwes ? cartTotal - returnValue : 0,
      remainingCredit,
      storeCreditCode,
    },
  });
};
