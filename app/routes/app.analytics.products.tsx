import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  InlineStack,
  Box,
  Button,
  Select,
  Banner,
  Badge,
  IndexTable,
  useIndexResourceState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useCallback } from "react";
import { authenticate } from "../shopify.server";
import {
  getProductReturnRates,
  type DateRange,
} from "../services/analytics.server";
import { exportToCSV } from "../utils/csv";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const range = (url.searchParams.get("range") || "30d") as DateRange;

  const products = await getProductReturnRates(session.shop, { range });

  return json({ products, range });
};

export function ErrorBoundary() {
  return (
    <Page
      backAction={{ content: "Analytics", url: "/app/analytics" }}
      title="Product Analysis"
    >
      <Banner tone="critical" title="Error loading product analytics">
        <p>There was a problem loading data. Please try refreshing.</p>
      </Banner>
    </Page>
  );
}

export default function ProductAnalytics() {
  const { products, range } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const resourceName = {
    singular: "product",
    plural: "products",
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(products.map((p) => ({ id: p.productId })));

  const handleRangeChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("range", value);
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const handleExport = useCallback(() => {
    exportToCSV(products, `product-returns-${range}`);
  }, [products, range]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const highReturnCount = products.filter((p) => p.isHighReturnRate).length;

  const rowMarkup = products.map((product, index) => (
    <IndexTable.Row
      id={product.productId}
      key={product.productId}
      selected={selectedResources.includes(product.productId)}
      position={index}
    >
      <IndexTable.Cell>
        <BlockStack gap="100">
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {product.productTitle}
          </Text>
          {product.variantTitle && (
            <Text as="span" variant="bodySm" tone="subdued">
              {product.variantTitle}
            </Text>
          )}
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" alignment="end">
          {product.unitsReturned}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" alignment="end">
          {formatCurrency(product.returnValue)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="100" blockAlign="center">
          <Text as="span" variant="bodyMd">
            {product.returnRate.toFixed(1)}%
          </Text>
          {product.isHighReturnRate && (
            <Badge tone="critical">High</Badge>
          )}
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {product.topReason || "—"}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      backAction={{ content: "Analytics", url: "/app/analytics" }}
      title="Product Analysis"
      primaryAction={{
        content: "Export CSV",
        onAction: handleExport,
      }}
    >
      <TitleBar title="Product Analysis" />
      <BlockStack gap="500">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="300">
            <Link to="/app/analytics">
              <Button variant="plain">Overview</Button>
            </Link>
            <Button variant="primary" disabled>
              Products
            </Button>
            <Link to="/app/analytics/reasons">
              <Button variant="plain">Reasons</Button>
            </Link>
            <Link to="/app/analytics/financial">
              <Button variant="plain">Financial</Button>
            </Link>
          </InlineStack>
          <Box minWidth="150px">
            <Select
              label="Date range"
              labelHidden
              options={[
                { label: "Last 7 days", value: "7d" },
                { label: "Last 30 days", value: "30d" },
                { label: "Last 90 days", value: "90d" },
              ]}
              value={range}
              onChange={handleRangeChange}
            />
          </Box>
        </InlineStack>

        {highReturnCount > 0 && (
          <Banner tone="warning" title={`${highReturnCount} products with high return rates`}>
            <p>
              These products have return rates above 15%. Consider reviewing product
              descriptions, sizing guides, or quality.
            </p>
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <Card padding="0">
              <IndexTable
                resourceName={resourceName}
                itemCount={products.length}
                selectedItemsCount={
                  allResourcesSelected ? "All" : selectedResources.length
                }
                onSelectionChange={handleSelectionChange}
                headings={[
                  { title: "Product" },
                  { title: "Units Returned", alignment: "end" },
                  { title: "Return Value", alignment: "end" },
                  { title: "Return Rate" },
                  { title: "Top Reason" },
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            </Card>
          </Layout.Section>
        </Layout>

        {products.length === 0 && (
          <Card>
            <BlockStack gap="300" inlineAlign="center">
              <Text as="p" variant="bodyMd" tone="subdued">
                No return data for this period.
              </Text>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
