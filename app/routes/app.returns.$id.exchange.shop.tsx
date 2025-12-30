import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSearchParams, useNavigate, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  InlineStack,
  Box,
  Button,
  TextField,
  Thumbnail,
  Grid,
  Divider,
  Banner,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState, useCallback, useMemo } from "react";
import { authenticate } from "../shopify.server";
import { getReturnRequestById } from "../services/returns.server";
import {
  fetchProducts,
  createExchangeDraftOrder,
  updateReturnWithExchange,
} from "../services/exchange.server";
import { calculateExchangeDifference } from "../utils/exchange";

interface CartItem {
  variantId: string;
  productId: string;
  title: string;
  variantTitle: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const returnId = params.id;
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("q") || "";
  const cursor = url.searchParams.get("cursor") || undefined;

  if (!returnId) {
    throw new Response("Return ID required", { status: 400 });
  }

  const returnRequest = await getReturnRequestById(returnId);
  if (!returnRequest) {
    throw new Response("Return not found", { status: 404 });
  }

  if (returnRequest.shop !== session.shop) {
    throw new Response("Unauthorized", { status: 403 });
  }

  const query = searchQuery
    ? `status:active AND (title:*${searchQuery}* OR product_type:*${searchQuery}*)`
    : "status:active";

  const productsResult = await fetchProducts(admin, {
    first: 24,
    after: cursor,
    query,
  });

  const productsData = await productsResult;
  const products = productsData.data?.products?.edges?.map((edge: { node: unknown }) => edge.node) || [];
  const pageInfo = productsData.data?.products?.pageInfo || { hasNextPage: false, endCursor: null };

  return json({
    returnRequest,
    products,
    pageInfo,
    searchQuery,
    returnValue: returnRequest.totalRefundAmount,
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("_action") as string;
  const returnId = params.id;

  if (!returnId) {
    return json({ error: "Return ID required" }, { status: 400 });
  }

  const returnRequest = await getReturnRequestById(returnId);
  if (!returnRequest || returnRequest.shop !== session.shop) {
    return json({ error: "Return not found" }, { status: 404 });
  }

  if (action === "create_exchange") {
    const cartData = formData.get("cart") as string;
    const cart: CartItem[] = JSON.parse(cartData);

    if (cart.length === 0) {
      return json({ error: "Cart is empty" }, { status: 400 });
    }

    const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const { difference, customerOwes, remainingCredit } = calculateExchangeDifference(
      returnRequest.totalRefundAmount,
      cartTotal
    );

    const lineItems = cart.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
    }));

    const draftOrderResult = await createExchangeDraftOrder(admin, {
      email: returnRequest.customerEmail,
      lineItems,
      discountAmount: Math.min(returnRequest.totalRefundAmount, cartTotal),
      note: `Exchange for return ${returnRequest.shopifyOrderName}`,
      returnRequestId: returnRequest.id,
    });

    const draftOrderData = await draftOrderResult;
    
    if (draftOrderData.data?.draftOrderCreate?.userErrors?.length > 0) {
      return json({
        error: draftOrderData.data.draftOrderCreate.userErrors[0].message,
      }, { status: 400 });
    }

    const draftOrder = draftOrderData.data?.draftOrderCreate?.draftOrder;
    if (!draftOrder) {
      return json({ error: "Failed to create exchange order" }, { status: 500 });
    }

    await updateReturnWithExchange(returnId, {
      resolutionType: "exchange",
      exchangeType: "shop_now",
      exchangeOrderId: draftOrder.id,
      exchangeValueUsed: Math.min(returnRequest.totalRefundAmount, cartTotal),
      exchangeBonusApplied: 0,
    });

    return json({
      success: true,
      draftOrder: {
        id: draftOrder.id,
        name: draftOrder.name,
        invoiceUrl: draftOrder.invoiceUrl,
        totalPrice: draftOrder.totalPriceSet?.shopMoney?.amount,
      },
      customerOwes,
      difference,
      remainingCredit,
    });
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

function ProductCard({
  product,
  onAddToCart,
}: {
  product: {
    id: string;
    title: string;
    handle: string;
    featuredImage?: { url: string; altText?: string };
    priceRangeV2: { minVariantPrice: { amount: string } };
    variants: { edges: Array<{ node: { id: string; title: string; price: string; availableForSale: boolean } }> };
  };
  onAddToCart: (item: CartItem) => void;
}) {
  const [selectedVariant, setSelectedVariant] = useState(
    product.variants.edges[0]?.node
  );

  const variants = product.variants.edges.map((e) => e.node);
  const hasMultipleVariants = variants.length > 1;

  const handleAdd = () => {
    if (!selectedVariant) return;
    onAddToCart({
      variantId: selectedVariant.id,
      productId: product.id,
      title: product.title,
      variantTitle: selectedVariant.title,
      price: parseFloat(selectedVariant.price),
      quantity: 1,
      imageUrl: product.featuredImage?.url,
    });
  };

  return (
    <Card>
      <BlockStack gap="300">
        <Box>
          {product.featuredImage ? (
            <img
              src={product.featuredImage.url}
              alt={product.featuredImage.altText || product.title}
              style={{
                width: "100%",
                height: "200px",
                objectFit: "cover",
                borderRadius: "8px",
              }}
            />
          ) : (
            <Box
              background="bg-surface-secondary"
              minHeight="200px"
              borderRadius="200"
            />
          )}
        </Box>
        <BlockStack gap="100">
          <Text as="h3" variant="headingMd" truncate>
            {product.title}
          </Text>
          <Text as="span" variant="bodyLg" fontWeight="semibold">
            ${parseFloat(product.priceRangeV2.minVariantPrice.amount).toFixed(2)}
          </Text>
        </BlockStack>
        {hasMultipleVariants && (
          <InlineStack gap="100" wrap>
            {variants.slice(0, 4).map((variant) => (
              <Button
                key={variant.id}
                size="slim"
                pressed={selectedVariant?.id === variant.id}
                onClick={() => setSelectedVariant(variant)}
                disabled={!variant.availableForSale}
              >
                {variant.title}
              </Button>
            ))}
            {variants.length > 4 && (
              <Text as="span" variant="bodySm" tone="subdued">
                +{variants.length - 4} more
              </Text>
            )}
          </InlineStack>
        )}
        <Button
          fullWidth
          onClick={handleAdd}
          disabled={!selectedVariant?.availableForSale}
        >
          Add to Exchange
        </Button>
      </BlockStack>
    </Card>
  );
}

export default function ExchangeShop() {
  const { returnRequest, products, pageInfo, searchQuery, returnValue } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState(searchQuery);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const { difference, customerOwes, remainingCredit } = useMemo(
    () => calculateExchangeDifference(returnValue, cartTotal),
    [returnValue, cartTotal]
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const handleSearch = useCallback(() => {
    setSearchParams({ q: search });
  }, [search, setSearchParams]);

  const handleAddToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId);
      if (existing) {
        return prev.map((i) =>
          i.variantId === item.variantId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, item];
    });
  }, []);

  const handleRemoveFromCart = useCallback((variantId: string) => {
    setCart((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const handleUpdateQuantity = useCallback((variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.variantId === variantId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const handleCompleteExchange = useCallback(() => {
    fetcher.submit(
      { _action: "create_exchange", cart: JSON.stringify(cart) },
      { method: "POST" }
    );
  }, [cart, fetcher]);

  const exchangeResult = fetcher.data as { 
    success?: boolean; 
    draftOrder?: { invoiceUrl: string; name: string };
    error?: string;
    customerOwes?: boolean;
    difference?: number;
  } | undefined;

  return (
    <Page
      backAction={{ content: "Resolution", url: `/app/returns/${returnRequest.id}/exchange` }}
      title="Shop for Exchange"
      subtitle={`Credit available: ${formatCurrency(returnValue)}`}
    >
      <TitleBar title="Exchange Shop" />
      
      {exchangeResult?.success && (
        <Box paddingBlockEnd="400">
          <Banner
            title="Exchange order created!"
            tone="success"
            action={{
              content: "View Invoice",
              url: exchangeResult.draftOrder?.invoiceUrl || "#",
              external: true,
            }}
          >
            <p>
              Order {exchangeResult.draftOrder?.name} has been created.
              {exchangeResult.customerOwes && exchangeResult.difference && (
                <> Customer owes {formatCurrency(exchangeResult.difference)}.</>
              )}
            </p>
          </Banner>
        </Box>
      )}

      {exchangeResult?.error && (
        <Box paddingBlockEnd="400">
          <Banner title="Error creating exchange" tone="critical">
            <p>{exchangeResult.error}</p>
          </Banner>
        </Box>
      )}

      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <InlineStack gap="200">
                <Box minWidth="300px" maxWidth="400px">
                  <TextField
                    label="Search products"
                    labelHidden
                    placeholder="Search products..."
                    value={search}
                    onChange={setSearch}
                    autoComplete="off"
                    connectedRight={
                      <Button onClick={handleSearch}>Search</Button>
                    }
                  />
                </Box>
              </InlineStack>
            </Card>

            {products.length === 0 ? (
              <Card>
                <EmptyState
                  heading="No products found"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Try a different search term.</p>
                </EmptyState>
              </Card>
            ) : (
              <Grid columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}>
                {products.map((product: Parameters<typeof ProductCard>[0]["product"]) => (
                  <Grid.Cell key={product.id}>
                    <ProductCard product={product} onAddToCart={handleAddToCart} />
                  </Grid.Cell>
                ))}
              </Grid>
            )}

            {pageInfo.hasNextPage && (
              <InlineStack align="center">
                <Button
                  onClick={() =>
                    setSearchParams({ q: search, cursor: pageInfo.endCursor })
                  }
                >
                  Load More
                </Button>
              </InlineStack>
            )}
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Exchange Cart
              </Text>
              <Divider />

              {cart.length === 0 ? (
                <Text as="p" tone="subdued">
                  Add items to your exchange cart
                </Text>
              ) : (
                <BlockStack gap="300">
                  {cart.map((item) => (
                    <Box key={item.variantId}>
                      <InlineStack gap="200" blockAlign="start">
                        {item.imageUrl && (
                          <Thumbnail
                            source={item.imageUrl}
                            alt={item.title}
                            size="small"
                          />
                        )}
                        <BlockStack gap="100">
                          <Text as="span" variant="bodyMd" fontWeight="medium">
                            {item.title}
                          </Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {item.variantTitle}
                          </Text>
                          <InlineStack gap="200" blockAlign="center">
                            <Button
                              size="slim"
                              onClick={() =>
                                handleUpdateQuantity(item.variantId, -1)
                              }
                            >
                              -
                            </Button>
                            <Text as="span">{item.quantity}</Text>
                            <Button
                              size="slim"
                              onClick={() =>
                                handleUpdateQuantity(item.variantId, 1)
                              }
                            >
                              +
                            </Button>
                            <Button
                              size="slim"
                              variant="plain"
                              tone="critical"
                              onClick={() => handleRemoveFromCart(item.variantId)}
                            >
                              Remove
                            </Button>
                          </InlineStack>
                          <Text as="span" variant="bodyMd">
                            {formatCurrency(item.price * item.quantity)}
                          </Text>
                        </BlockStack>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              )}

              <Divider />

              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="span">Return Credit</Text>
                  <Text as="span" tone="success">
                    -{formatCurrency(returnValue)}
                  </Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span">Cart Total</Text>
                  <Text as="span">{formatCurrency(cartTotal)}</Text>
                </InlineStack>
                <Divider />
                <InlineStack align="space-between">
                  <Text as="span" variant="headingMd" fontWeight="semibold">
                    {customerOwes ? "Amount Due" : "Remaining Credit"}
                  </Text>
                  <Text
                    as="span"
                    variant="headingMd"
                    fontWeight="semibold"
                    tone={customerOwes ? "critical" : "success"}
                  >
                    {customerOwes
                      ? formatCurrency(difference)
                      : formatCurrency(remainingCredit)}
                  </Text>
                </InlineStack>
              </BlockStack>

              {remainingCredit > 0 && (
                <Banner tone="info">
                  Remaining {formatCurrency(remainingCredit)} will be issued as store credit.
                </Banner>
              )}

              <Button
                variant="primary"
                fullWidth
                disabled={cart.length === 0}
                loading={fetcher.state !== "idle"}
                onClick={handleCompleteExchange}
              >
                Complete Exchange
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
