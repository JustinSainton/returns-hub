export const GET_ORDERS_WITH_FULFILLMENTS = `#graphql
  query getOrdersWithFulfillments($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query) {
      edges {
        node {
          id
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          customer {
            id
            email
            firstName
            lastName
          }
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                variantTitle
                quantity
                sku
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                variant {
                  id
                  product {
                    id
                  }
                }
              }
            }
          }
          fulfillments {
            id
            status
            createdAt
            fulfillmentLineItems(first: 50) {
              edges {
                node {
                  id
                  quantity
                  lineItem {
                    id
                  }
                }
              }
            }
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`;

export const GET_ORDER_BY_ID = `#graphql
  query getOrderById($id: ID!) {
    order(id: $id) {
      id
      name
      createdAt
      displayFinancialStatus
      displayFulfillmentStatus
      totalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      customer {
        id
        email
        firstName
        lastName
      }
      shippingAddress {
        address1
        address2
        city
        province
        zip
        country
        phone
      }
      lineItems(first: 50) {
        edges {
          node {
            id
            title
            variantTitle
            quantity
            sku
            originalUnitPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            variant {
              id
              product {
                id
              }
            }
          }
        }
      }
      fulfillments {
        id
        status
        createdAt
        fulfillmentLineItems(first: 50) {
          edges {
            node {
              id
              quantity
              lineItem {
                id
              }
            }
          }
        }
      }
      returns(first: 10) {
        edges {
          node {
            id
            status
            createdAt
          }
        }
      }
    }
  }
`;

export const GET_RETURNS = `#graphql
  query getReturns($first: Int!, $after: String, $query: String) {
    returns(first: $first, after: $after, query: $query) {
      edges {
        node {
          id
          status
          createdAt
          order {
            id
            name
            customer {
              email
              firstName
              lastName
            }
          }
          returnLineItems(first: 50) {
            edges {
              node {
                id
                quantity
                returnReason
                customerNote
                fulfillmentLineItem {
                  id
                  lineItem {
                    id
                    title
                    variantTitle
                    sku
                    originalUnitPriceSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`;

export const GET_RETURN_BY_ID = `#graphql
  query getReturnById($id: ID!) {
    return(id: $id) {
      id
      status
      createdAt
      order {
        id
        name
        customer {
          id
          email
          firstName
          lastName
        }
        shippingAddress {
          address1
          address2
          city
          province
          zip
          country
          phone
        }
      }
      returnLineItems(first: 50) {
        edges {
          node {
            id
            quantity
            returnReason
            customerNote
            fulfillmentLineItem {
              id
              lineItem {
                id
                title
                variantTitle
                sku
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                variant {
                  id
                  inventoryItem {
                    id
                  }
                }
              }
            }
          }
        }
      }
      reverseFulfillmentOrders(first: 5) {
        edges {
          node {
            id
            status
          }
        }
      }
    }
  }
`;

export const RETURN_REQUEST = `#graphql
  mutation returnRequest($input: ReturnRequestInput!) {
    returnRequest(input: $input) {
      return {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const RETURN_APPROVE_REQUEST = `#graphql
  mutation returnApproveRequest($input: ReturnApproveRequestInput!) {
    returnApproveRequest(input: $input) {
      return {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const RETURN_DECLINE_REQUEST = `#graphql
  mutation returnDeclineRequest($input: ReturnDeclineRequestInput!) {
    returnDeclineRequest(input: $input) {
      return {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const RETURN_CREATE = `#graphql
  mutation returnCreate($returnInput: ReturnInput!) {
    returnCreate(returnInput: $returnInput) {
      return {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const RETURN_CLOSE = `#graphql
  mutation returnClose($id: ID!) {
    returnClose(id: $id) {
      return {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const REFUND_CREATE = `#graphql
  mutation refundCreate($input: RefundInput!) {
    refundCreate(input: $input) {
      refund {
        id
        createdAt
        totalRefundedSet {
          shopMoney {
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

export const INVENTORY_ADJUST_QUANTITY = `#graphql
  mutation inventoryAdjustQuantity($input: InventoryAdjustQuantityInput!) {
    inventoryAdjustQuantity(input: $input) {
      inventoryLevel {
        id
        available
      }
      userErrors {
        field
        message
      }
    }
  }
`;
