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
  Tabs,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { authenticate } from "../shopify.server";
import {
  getAnalyticsOverview,
  getReturnTrends,
  type DateRange,
} from "../services/analytics.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const range = (url.searchParams.get("range") || "30d") as DateRange;

  const [overview, trends] = await Promise.all([
    getAnalyticsOverview(session.shop, { range }),
    getReturnTrends(session.shop, { range }),
  ]);

  return json({ overview, trends, range });
};

function MetricCard({
  title,
  value,
  previousValue,
  format = "number",
}: {
  title: string;
  value: number;
  previousValue?: number;
  format?: "number" | "currency" | "percentage" | "days";
}) {
  const formatValue = (val: number) => {
    switch (format) {
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(val);
      case "percentage":
        return `${val.toFixed(1)}%`;
      case "days":
        return `${val.toFixed(1)} days`;
      default:
        return val.toLocaleString();
    }
  };

  const change =
    previousValue !== undefined && previousValue > 0
      ? ((value - previousValue) / previousValue) * 100
      : 0;

  const changeLabel =
    change > 0 ? `+${change.toFixed(0)}%` : `${change.toFixed(0)}%`;

  return (
    <Card>
      <BlockStack gap="200">
        <Text as="p" variant="bodyMd" tone="subdued">
          {title}
        </Text>
        <Text as="p" variant="headingXl">
          {formatValue(value)}
        </Text>
        {previousValue !== undefined && (
          <InlineStack gap="100" blockAlign="center">
            <Badge tone={change >= 0 ? "success" : "critical"}>
              {changeLabel}
            </Badge>
            <Text as="span" variant="bodySm" tone="subdued">
              vs previous period
            </Text>
          </InlineStack>
        )}
      </BlockStack>
    </Card>
  );
}

export function ErrorBoundary() {
  return (
    <Page backAction={{ content: "Dashboard", url: "/app" }} title="Analytics">
      <Banner tone="critical" title="Error loading analytics">
        <p>There was a problem loading analytics. Please try refreshing.</p>
      </Banner>
    </Page>
  );
}

export default function Analytics() {
  const { overview, trends, range } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTab, setSelectedTab] = useState(0);

  const handleRangeChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("range", value);
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const tabs = [
    { id: "overview", content: "Overview", url: "/app/analytics" },
    { id: "products", content: "Products", url: "/app/analytics/products" },
    { id: "reasons", content: "Reasons", url: "/app/analytics/reasons" },
    { id: "financial", content: "Financial", url: "/app/analytics/financial" },
  ];

  return (
    <Page backAction={{ content: "Dashboard", url: "/app" }} title="Analytics">
      <TitleBar title="Analytics" />
      <BlockStack gap="500">
        <InlineStack align="space-between" blockAlign="center">
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
            <Box paddingBlockStart="400">
              {tabs.map((tab, index) =>
                index === selectedTab ? null : (
                  <Link key={tab.id} to={tab.url}>
                    <Button variant="plain">{tab.content}</Button>
                  </Link>
                )
              )}
            </Box>
          </Tabs>
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
                  title="Total Returns"
                  value={overview.totalReturns}
                  previousValue={overview.previousPeriodReturns}
                />
              </Box>
              <Box minWidth="200px">
                <MetricCard
                  title="Revenue Retained"
                  value={overview.revenueRetained}
                  previousValue={overview.previousRevenueRetained}
                  format="currency"
                />
              </Box>
              <Box minWidth="200px">
                <MetricCard
                  title="Avg Processing Time"
                  value={overview.avgProcessingDays}
                  previousValue={overview.previousAvgProcessingDays}
                  format="days"
                />
              </Box>
              <Box minWidth="200px">
                <MetricCard
                  title="Store Credit Rate"
                  value={overview.storeCreditVsRefundRatio * 100}
                  format="percentage"
                />
              </Box>
            </InlineStack>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Return Trends
                </Text>
                <Box minHeight="300px">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) =>
                          new Date(value).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        }
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) =>
                          new Date(value).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })
                        }
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="returns"
                        stroke="#5C6AC4"
                        name="Total Returns"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="refunds"
                        stroke="#DE3618"
                        name="Refunds"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="storeCredit"
                        stroke="#50B83C"
                        name="Store Credit"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="exchanges"
                        stroke="#47C1BF"
                        name="Exchanges"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Quick Links
                </Text>
                <BlockStack gap="200">
                  <Link to="/app/analytics/products">
                    <Button fullWidth variant="secondary">
                      View Product Analysis
                    </Button>
                  </Link>
                  <Link to="/app/analytics/reasons">
                    <Button fullWidth variant="secondary">
                      View Reason Breakdown
                    </Button>
                  </Link>
                  <Link to="/app/analytics/financial">
                    <Button fullWidth variant="secondary">
                      View Financial Impact
                    </Button>
                  </Link>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Insights
                </Text>
                <BlockStack gap="200">
                  {overview.storeCreditVsRefundRatio > 0.3 ? (
                    <Banner tone="success">
                      <p>
                        Great job! {(overview.storeCreditVsRefundRatio * 100).toFixed(0)}% of
                        customers chose store credit over refunds.
                      </p>
                    </Banner>
                  ) : (
                    <Banner tone="info">
                      <p>
                        Consider increasing your store credit bonus to encourage more
                        customers to choose store credit over refunds.
                      </p>
                    </Banner>
                  )}
                  {overview.avgProcessingDays > 2 && (
                    <Banner tone="warning">
                      <p>
                        Average processing time is {overview.avgProcessingDays.toFixed(1)} days.
                        Consider enabling auto-approve to speed things up.
                      </p>
                    </Banner>
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
