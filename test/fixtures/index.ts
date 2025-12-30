export const mockShop = "test-store.myshopify.com";

export const mockShopSettings = {
  id: "settings_123",
  shop: mockShop,
  returnWindowDays: 30,
  autoApproveEnabled: false,
  autoApproveMaxValue: null,
  requirePhotos: false,
  requireReason: true,
  restockAutomatically: false,
  notifyOnNewReturn: true,
  notifyOnStatusChange: true,
  shippoApiKey: null,
  easypostApiKey: null,
  storeCreditEnabled: true,
  storeCreditBonusPercent: 10,
  storeCreditExpiryDays: null,
  exchangeEnabled: true,
  shopNowExchangeEnabled: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

export const mockReturnRequest = {
  id: "return_123",
  shop: mockShop,
  shopifyOrderId: "gid://shopify/Order/123456",
  shopifyOrderName: "#1001",
  customerEmail: "customer@example.com",
  customerName: "John Doe",
  status: "pending",
  reason: "Defective product",
  customerNotes: "Item arrived damaged",
  merchantNotes: null,
  totalRefundAmount: 99.99,
  resolutionType: null,
  exchangeType: null,
  exchangeOrderId: null,
  exchangeValueUsed: null,
  exchangeBonusApplied: null,
  storeCreditIssued: null,
  storeCreditCode: null,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
  approvedAt: null,
  completedAt: null,
};

export const mockReturnItem = {
  id: "item_123",
  returnRequestId: "return_123",
  shopifyLineItemId: "gid://shopify/LineItem/789",
  shopifyVariantId: "gid://shopify/ProductVariant/456",
  shopifyProductId: "gid://shopify/Product/123",
  title: "Premium Widget",
  variantTitle: "Blue / Large",
  sku: "WIDGET-BL-LG",
  quantity: 1,
  pricePerItem: 99.99,
  reason: "Defective",
  condition: null,
  photoUrls: null,
  restocked: false,
  restockedAt: null,
  createdAt: new Date("2024-01-15"),
};

export const mockReturnDestination = {
  id: "dest_123",
  shop: mockShop,
  name: "Main Warehouse",
  addressLine1: "123 Warehouse St",
  addressLine2: "Suite 100",
  city: "San Francisco",
  state: "CA",
  postalCode: "94102",
  country: "US",
  phone: "415-555-1234",
  isDefault: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

export const mockRoutingRule = {
  id: "rule_123",
  shop: mockShop,
  name: "Electronics to Warehouse B",
  priority: 1,
  isActive: true,
  conditionType: "product_type",
  conditionValue: "Electronics",
  destinationId: "dest_123",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  destination: mockReturnDestination,
};

export const mockShippingLabel = {
  id: "label_123",
  returnRequestId: "return_123",
  carrier: "USPS",
  trackingNumber: "9400111899223456789012",
  trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223456789012",
  labelUrl: "https://shippo.com/labels/abc123.png",
  labelPdfUrl: "https://shippo.com/labels/abc123.pdf",
  shippoTransactionId: "txn_abc123",
  easypostShipmentId: null,
  cost: 8.50,
  createdAt: new Date("2024-01-16"),
};

export const mockShopifyOrder = {
  id: "gid://shopify/Order/123456",
  name: "#1001",
  createdAt: "2024-01-10T10:00:00Z",
  displayFinancialStatus: "PAID",
  displayFulfillmentStatus: "FULFILLED",
  totalPriceSet: {
    shopMoney: {
      amount: "99.99",
      currencyCode: "USD",
    },
  },
  customer: {
    id: "gid://shopify/Customer/789",
    email: "customer@example.com",
    firstName: "John",
    lastName: "Doe",
  },
  shippingAddress: {
    address1: "456 Customer Ave",
    address2: "Apt 2B",
    city: "Los Angeles",
    province: "CA",
    zip: "90001",
    country: "US",
    phone: "310-555-9876",
  },
  lineItems: {
    edges: [
      {
        node: {
          id: "gid://shopify/LineItem/789",
          title: "Premium Widget",
          variantTitle: "Blue / Large",
          quantity: 1,
          sku: "WIDGET-BL-LG",
          originalUnitPriceSet: {
            shopMoney: {
              amount: "99.99",
              currencyCode: "USD",
            },
          },
          variant: {
            id: "gid://shopify/ProductVariant/456",
            product: {
              id: "gid://shopify/Product/123",
            },
          },
        },
      },
    ],
  },
  fulfillments: [
    {
      id: "gid://shopify/Fulfillment/111",
      status: "SUCCESS",
      createdAt: "2024-01-11T14:00:00Z",
      fulfillmentLineItems: {
        edges: [
          {
            node: {
              id: "gid://shopify/FulfillmentLineItem/222",
              quantity: 1,
              lineItem: {
                id: "gid://shopify/LineItem/789",
              },
            },
          },
        ],
      },
    },
  ],
};

export function createMockReturnRequest(overrides: Partial<typeof mockReturnRequest> = {}) {
  return { ...mockReturnRequest, ...overrides };
}

export function createMockReturnItem(overrides: Partial<typeof mockReturnItem> = {}) {
  return { ...mockReturnItem, ...overrides };
}

export function createMockRoutingRule(overrides: Partial<typeof mockRoutingRule> = {}) {
  return { ...mockRoutingRule, ...overrides };
}

export function createMockDestination(overrides: Partial<typeof mockReturnDestination> = {}) {
  return { ...mockReturnDestination, ...overrides };
}
