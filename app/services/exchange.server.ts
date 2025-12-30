import db from "../db.server";
import {
  GET_PRODUCTS,
  GET_PRODUCT_BY_ID,
  DRAFT_ORDER_CREATE,
  DRAFT_ORDER_COMPLETE,
  DRAFT_ORDER_CALCULATE,
  GIFT_CARD_CREATE,
  GET_COLLECTIONS,
  GET_COLLECTION_PRODUCTS,
  METAFIELD_SET,
} from "../graphql/exchange";

type AdminGraphQL = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

export type ResolutionType = "refund" | "store_credit" | "exchange";
export type ExchangeType = "variant" | "product" | "shop_now";

export interface ExchangeCartItem {
  variantId: string;
  quantity: number;
  title: string;
  variantTitle?: string;
  price: number;
}

export async function fetchProducts(
  admin: AdminGraphQL,
  options: { first?: number; after?: string; query?: string } = {}
) {
  const response = await admin.graphql(GET_PRODUCTS, {
    variables: {
      first: options.first ?? 24,
      after: options.after,
      query: options.query ?? "status:active",
    },
  });
  return response.json();
}

export async function fetchProductById(admin: AdminGraphQL, productId: string) {
  const response = await admin.graphql(GET_PRODUCT_BY_ID, {
    variables: { id: productId },
  });
  return response.json();
}

export async function fetchCollections(
  admin: AdminGraphQL,
  options: { first?: number; after?: string } = {}
) {
  const response = await admin.graphql(GET_COLLECTIONS, {
    variables: {
      first: options.first ?? 20,
      after: options.after,
    },
  });
  return response.json();
}

export async function fetchCollectionProducts(
  admin: AdminGraphQL,
  collectionId: string,
  options: { first?: number; after?: string } = {}
) {
  const response = await admin.graphql(GET_COLLECTION_PRODUCTS, {
    variables: {
      id: collectionId,
      first: options.first ?? 24,
      after: options.after,
    },
  });
  return response.json();
}

export async function calculateExchangeOrder(
  admin: AdminGraphQL,
  input: {
    customerId?: string;
    email: string;
    lineItems: { variantId: string; quantity: number }[];
    discountAmount: number;
    note?: string;
  }
) {
  const draftOrderInput = {
    customerId: input.customerId,
    email: input.email,
    lineItems: input.lineItems,
    appliedDiscount: input.discountAmount > 0 ? {
      value: input.discountAmount,
      valueType: "FIXED_AMOUNT",
      title: "Return Credit",
      description: "Credit from return exchange",
    } : undefined,
    note: input.note,
  };

  const response = await admin.graphql(DRAFT_ORDER_CALCULATE, {
    variables: { input: draftOrderInput },
  });
  return response.json();
}

export async function createExchangeDraftOrder(
  admin: AdminGraphQL,
  input: {
    customerId?: string;
    email: string;
    lineItems: { variantId: string; quantity: number }[];
    discountAmount: number;
    shippingAddress?: {
      address1: string;
      address2?: string;
      city: string;
      province: string;
      zip: string;
      country: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
    };
    note?: string;
    returnRequestId: string;
  }
) {
  const draftOrderInput = {
    customerId: input.customerId,
    email: input.email,
    lineItems: input.lineItems,
    shippingAddress: input.shippingAddress,
    appliedDiscount: input.discountAmount > 0 ? {
      value: input.discountAmount,
      valueType: "FIXED_AMOUNT",
      title: "Return Credit",
      description: `Credit from return #${input.returnRequestId}`,
    } : undefined,
    note: input.note ?? `Exchange order for return #${input.returnRequestId}`,
    tags: ["exchange", `return:${input.returnRequestId}`],
  };

  const response = await admin.graphql(DRAFT_ORDER_CREATE, {
    variables: { input: draftOrderInput },
  });
  return response.json();
}

export async function completeDraftOrder(
  admin: AdminGraphQL,
  draftOrderId: string,
  paymentPending: boolean = false
) {
  const response = await admin.graphql(DRAFT_ORDER_COMPLETE, {
    variables: {
      id: draftOrderId,
      paymentPending,
    },
  });
  return response.json();
}

export async function createGiftCard(
  admin: AdminGraphQL,
  input: {
    initialValue: number;
    customerId?: string;
    note?: string;
    expiresOn?: string;
  }
) {
  const giftCardInput = {
    initialValue: input.initialValue.toString(),
    customerId: input.customerId,
    note: input.note,
    expiresOn: input.expiresOn,
  };

  const response = await admin.graphql(GIFT_CARD_CREATE, {
    variables: { input: giftCardInput },
  });
  return response.json();
}

export async function linkExchangeToReturn(
  admin: AdminGraphQL,
  orderId: string,
  returnRequestId: string
) {
  const response = await admin.graphql(METAFIELD_SET, {
    variables: {
      metafields: [
        {
          ownerId: orderId,
          namespace: "returns_hub",
          key: "return_request_id",
          value: returnRequestId,
          type: "single_line_text_field",
        },
      ],
    },
  });
  return response.json();
}

export async function updateReturnWithExchange(
  returnRequestId: string,
  data: {
    resolutionType: ResolutionType;
    exchangeType?: ExchangeType;
    exchangeOrderId?: string;
    exchangeValueUsed?: number;
    exchangeBonusApplied?: number;
  }
) {
  return db.returnRequest.update({
    where: { id: returnRequestId },
    data: {
      resolutionType: data.resolutionType,
      exchangeType: data.exchangeType,
      exchangeOrderId: data.exchangeOrderId,
      exchangeValueUsed: data.exchangeValueUsed,
      exchangeBonusApplied: data.exchangeBonusApplied,
    },
  });
}

export async function updateReturnWithStoreCredit(
  returnRequestId: string,
  data: {
    storeCreditIssued: number;
    storeCreditCode: string;
  }
) {
  return db.returnRequest.update({
    where: { id: returnRequestId },
    data: {
      resolutionType: "store_credit",
      storeCreditIssued: data.storeCreditIssued,
      storeCreditCode: data.storeCreditCode,
    },
  });
}

export async function getExchangeSettings(shop: string) {
  const settings = await db.shopSettings.findUnique({
    where: { shop },
    select: {
      storeCreditEnabled: true,
      storeCreditBonusPercent: true,
      storeCreditExpiryDays: true,
      exchangeEnabled: true,
      shopNowExchangeEnabled: true,
    },
  });

  return settings ?? {
    storeCreditEnabled: true,
    storeCreditBonusPercent: 10,
    storeCreditExpiryDays: null,
    exchangeEnabled: true,
    shopNowExchangeEnabled: true,
  };
}

export { calculateStoreCreditValue, calculateExchangeDifference } from "../utils/exchange";
