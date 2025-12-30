export const GET_PRODUCTS = `#graphql
  query getProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      edges {
        node {
          id
          title
          handle
          status
          featuredImage {
            url
            altText
          }
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                sku
                availableForSale
                price
                compareAtPrice
                inventoryQuantity
                selectedOptions {
                  name
                  value
                }
                image {
                  url
                  altText
                }
              }
            }
          }
          options {
            id
            name
            values
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_PRODUCT_BY_ID = `#graphql
  query getProductById($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      description
      status
      featuredImage {
        url
        altText
      }
      images(first: 10) {
        edges {
          node {
            url
            altText
          }
        }
      }
      priceRangeV2 {
        minVariantPrice {
          amount
          currencyCode
        }
        maxVariantPrice {
          amount
          currencyCode
        }
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            sku
            availableForSale
            price
            compareAtPrice
            inventoryQuantity
            selectedOptions {
              name
              value
            }
            image {
              url
              altText
            }
          }
        }
      }
      options {
        id
        name
        values
      }
    }
  }
`;

export const DRAFT_ORDER_CREATE = `#graphql
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
        invoiceUrl
        status
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        subtotalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalDiscountsSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        lineItems(first: 50) {
          edges {
            node {
              id
              title
              quantity
              originalUnitPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
        order {
          id
          name
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const DRAFT_ORDER_COMPLETE = `#graphql
  mutation draftOrderComplete($id: ID!, $paymentPending: Boolean) {
    draftOrderComplete(id: $id, paymentPending: $paymentPending) {
      draftOrder {
        id
        status
        order {
          id
          name
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const DRAFT_ORDER_CALCULATE = `#graphql
  mutation draftOrderCalculate($input: DraftOrderInput!) {
    draftOrderCalculate(input: $input) {
      calculatedDraftOrder {
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        subtotalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalDiscountsSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        lineItemsSubtotalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        availableShippingRates {
          handle
          title
          price {
            amount
            currencyCode
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const GIFT_CARD_CREATE = `#graphql
  mutation giftCardCreate($input: GiftCardCreateInput!) {
    giftCardCreate(input: $input) {
      giftCard {
        id
        maskedCode
        lastCharacters
        initialValue {
          amount
          currencyCode
        }
        balance {
          amount
          currencyCode
        }
        expiresOn
        customer {
          id
          email
        }
      }
      giftCardCode
      userErrors {
        field
        message
      }
    }
  }
`;

export const GET_COLLECTIONS = `#graphql
  query getCollections($first: Int!, $after: String) {
    collections(first: $first, after: $after) {
      edges {
        node {
          id
          title
          handle
          image {
            url
            altText
          }
          productsCount {
            count
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_COLLECTION_PRODUCTS = `#graphql
  query getCollectionProducts($id: ID!, $first: Int!, $after: String) {
    collection(id: $id) {
      id
      title
      products(first: $first, after: $after) {
        edges {
          node {
            id
            title
            handle
            status
            featuredImage {
              url
              altText
            }
            priceRangeV2 {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  availableForSale
                  price
                }
              }
            }
          }
          cursor
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

export const GET_CUSTOMER_GIFT_CARDS = `#graphql
  query getCustomerGiftCards($customerId: ID!) {
    customer(id: $customerId) {
      id
      email
    }
  }
`;

export const METAFIELD_SET = `#graphql
  mutation metafieldSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        value
      }
      userErrors {
        field
        message
      }
    }
  }
`;
