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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { authenticate } from "../shopify.server";
import {
  getReturnsByReason,
  type DateRange,
} from "../services/analytics.server";
import { exportToCSV } from "../utils/csv";

const COLORS = [
  "#5C6AC4",
  "#DE3618",
  "#50B83C",
  "#47C1BF",
  "#9C6ADE",
  "#F49342",
  "#EEC200",
  "#8A8A8A",
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const range = (url.searchParams.get("range") || "30d") as DateRange;

  const reasons = await getReturnsByReason(session.shop, { range });

  return json({ reasons, range });
};

export function ErrorBoundary() {
  return (
    <Page
      backAction={{ content: "Analytics", url: "/app/analytics" }}
      title="Return Reasons"
    >
      <Banner tone="critical" title="Error loading reason analytics">
        <p>There was a problem loading data. Please try refreshing.</p>
      </Banner>
    </Page>
  );
}

export default function ReasonsAnalytics() {
  const { reasons, range } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleRangeChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("range", value);
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const handleExport = useCallback(() => {
    exportToCSV(reasons, `return-reasons-${range}`);
  }, [reasons, range]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const chartData = reasons.map((r) => ({
    name: r.reason,
    value: r.count,
  }));

  const tableRows = reasons.map((r) => [
    r.reason,
    r.count.toString(),
    `${r.percentage.toFixed(1)}%`,
    formatCurrency(r.totalValue),
  ]);

  const topReason = reasons[0];

  return (
    <Page
      backAction={{ content: "Analytics", url: "/app/analytics" }}
      title="Return Reasons"
      primaryAction={{
        content: "Export CSV",
        onAction: handleExport,
      }}
    >
      <TitleBar title="Return Reasons" />
      <BlockStack gap="500">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="300">
            <Link to="/app/analytics">
              <Button variant="plain">Overview</Button>
            </Link>
            <Link to="/app/analytics/products">
              <Button variant="plain">Products</Button>
            </Link>
            <Button variant="primary" disabled>
              Reasons
            </Button>
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

        {topReason && (
          <Banner tone="info" title="Top return reason">
            <p>
              "{topReason.reason}" accounts for {topReason.percentage.toFixed(0)}% of
              returns ({formatCurrency(topReason.totalValue)} in value).
            </p>
          </Banner>
        )}

        <Layout>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Reason Distribution
                </Text>
                {reasons.length > 0 ? (
                  <Box minHeight="300px">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                          }
                        >
                          {chartData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                ) : (
                  <Text as="p" variant="bodyMd" tone="subdued">
                    No return data for this period.
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Reason Breakdown
                </Text>
                <DataTable
                  columnContentTypes={["text", "numeric", "numeric", "numeric"]}
                  headings={["Reason", "Count", "Percentage", "Value"]}
                  rows={tableRows}
                  footerContent={
                    reasons.length > 0
                      ? `${reasons.reduce((sum, r) => sum + r.count, 0)} total returns`
                      : undefined
                  }
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Actionable Insights
                </Text>
                <BlockStack gap="200">
                  {reasons.some(
                    (r) =>
                      r.reason.toLowerCase().includes("size") ||
                      r.reason.toLowerCase().includes("fit")
                  ) && (
                    <Banner tone="info">
                      <p>
                        Size/fit issues detected. Consider adding detailed size guides
                        or fit recommendations to product pages.
                      </p>
                    </Banner>
                  )}
                  {reasons.some(
                    (r) =>
                      r.reason.toLowerCase().includes("quality") ||
                      r.reason.toLowerCase().includes("defect")
                  ) && (
                    <Banner tone="warning">
                      <p>
                        Quality concerns detected. Review supplier quality or add more
                        detailed product photos.
                      </p>
                    </Banner>
                  )}
                  {reasons.some((r) =>
                    r.reason.toLowerCase().includes("wrong")
                  ) && (
                    <Banner tone="critical">
                      <p>
                        "Wrong item" returns detected. Check fulfillment accuracy and
                        consider adding order verification steps.
                      </p>
                    </Banner>
                  )}
                  {reasons.length === 0 && (
                    <Text as="p" variant="bodyMd" tone="subdued">
                      No return data available to generate insights.
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
