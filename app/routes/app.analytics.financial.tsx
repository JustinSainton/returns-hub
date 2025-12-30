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
  DataTable,
  ProgressBar,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useCallback } from "react";
import { authenticate } from "../shopify.server";
import {
  getFinancialMetrics,
  type DateRange,
} from "../services/analytics.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const range = (url.searchParams.get("range") || "30d") as DateRange;

  const metrics = await getFinancialMetrics(session.shop, { range });

  return json({ metrics, range });
};

function MetricCard({
  title,
  value,
  description,
  tone,
}: {
  title: string;
  value: string;
  description?: string;
  tone?: "success" | "critical";
}) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="p" variant="bodyMd" tone="subdued">
          {title}
        </Text>
        <Text
          as="p"
          variant="headingXl"
          tone={tone}
        >
          {value}
        </Text>
        {description && (
          <Text as="p" variant="bodySm" tone="subdued">
            {description}
          </Text>
        )}
      </BlockStack>
    </Card>
  );
}

export function ErrorBoundary() {
  return (
    <Page
      backAction={{ content: "Analytics", url: "/app/analytics" }}
      title="Financial Impact"
    >
      <Banner tone="critical" title="Error loading financial analytics">
        <p>There was a problem loading data. Please try refreshing.</p>
      </Banner>
    </Page>
  );
}

export default function FinancialAnalytics() {
  const { metrics, range } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleRangeChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("range", value);
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const breakdownRows = [
    ["Refunds Issued", formatCurrency(metrics.totalRefunds)],
    ["Store Credit Issued", formatCurrency(metrics.storeCreditIssued)],
    ["Bonus Credit Cost", formatCurrency(metrics.bonusCreditCost)],
    ["Exchange Value", formatCurrency(metrics.exchangeValue)],
    ["Shipping Label Costs", formatCurrency(metrics.shippingLabelCosts)],
  ];

  return (
    <Page
      backAction={{ content: "Analytics", url: "/app/analytics" }}
      title="Financial Impact"
    >
      <TitleBar title="Financial Impact" />
      <BlockStack gap="500">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="300">
            <Link to="/app/analytics">
              <Button variant="plain">Overview</Button>
            </Link>
            <Link to="/app/analytics/products">
              <Button variant="plain">Products</Button>
            </Link>
            <Link to="/app/analytics/reasons">
              <Button variant="plain">Reasons</Button>
            </Link>
            <Button variant="primary" disabled>
              Financial
            </Button>
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

        <Layout>
          <Layout.Section>
            <InlineStack gap="400" wrap={false}>
              <Box minWidth="200px">
                <MetricCard
                  title="Total Refunds"
                  value={formatCurrency(metrics.totalRefunds)}
                  description="Cash returned to customers"
                  tone="critical"
                />
              </Box>
              <Box minWidth="200px">
                <MetricCard
                  title="Revenue Retained"
                  value={formatCurrency(metrics.revenueRetained)}
                  description="Via store credit & exchanges"
                  tone="success"
                />
              </Box>
              <Box minWidth="200px">
                <MetricCard
                  title="Net Return Cost"
                  value={formatCurrency(metrics.netReturnCost)}
                  description="Total cost of returns"
                />
              </Box>
              <Box minWidth="200px">
                <MetricCard
                  title="Retention Rate"
                  value={`${metrics.revenueRetainedPercentage.toFixed(1)}%`}
                  description="Value kept in store"
                  tone={metrics.revenueRetainedPercentage > 30 ? "success" : undefined}
                />
              </Box>
            </InlineStack>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Cost Breakdown
                </Text>
                <DataTable
                  columnContentTypes={["text", "numeric"]}
                  headings={["Category", "Amount"]}
                  rows={breakdownRows}
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Revenue Retention
                </Text>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">
                      Retention Rate
                    </Text>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {metrics.revenueRetainedPercentage.toFixed(1)}%
                    </Text>
                  </InlineStack>
                  <ProgressBar
                    progress={Math.min(metrics.revenueRetainedPercentage, 100)}
                    tone={metrics.revenueRetainedPercentage > 30 ? "success" : "primary"}
                  />
                  <Text as="p" variant="bodySm" tone="subdued">
                    {formatCurrency(metrics.revenueRetained)} of return value kept as
                    store credit or exchanges.
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Financial Insights
                </Text>
                <BlockStack gap="200">
                  {metrics.revenueRetainedPercentage > 40 && (
                    <Banner tone="success">
                      <p>
                        Excellent retention! Over 40% of return value is being kept as
                        store credit or exchanges.
                      </p>
                    </Banner>
                  )}
                  {metrics.revenueRetainedPercentage < 20 && (
                    <Banner tone="warning">
                      <p>
                        Low retention rate. Consider increasing store credit bonus or
                        promoting exchange options to customers.
                      </p>
                    </Banner>
                  )}
                  {metrics.bonusCreditCost > 0 && (
                    <Banner tone="info">
                      <p>
                        Bonus credit cost: {formatCurrency(metrics.bonusCreditCost)}. This
                        investment helped retain {formatCurrency(metrics.storeCreditIssued)} in
                        store credit.
                      </p>
                    </Banner>
                  )}
                  {metrics.shippingLabelCosts > 0 && (
                    <Banner tone="info">
                      <p>
                        Shipping costs: {formatCurrency(metrics.shippingLabelCosts)}. Consider
                        enabling returnless refunds for low-value items to reduce this.
                      </p>
                    </Banner>
                  )}
                  {metrics.totalRefunds === 0 &&
                    metrics.revenueRetained === 0 && (
                      <Text as="p" variant="bodyMd" tone="subdued">
                        No return data available for this period.
                      </Text>
                    )}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
