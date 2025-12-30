import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  InlineStack,
  Box,
  Badge,
  Button,
  EmptyState,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getReturnStats, getReturnRequests } from "../services/returns.server";
import { LoadingPage } from "../components";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [stats, recentReturns] = await Promise.all([
    getReturnStats(shop),
    getReturnRequests(shop, { limit: 5 }),
  ]);

  return { stats, recentReturns, shop };
};

function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { tone: "info" | "success" | "warning" | "critical" | "attention"; label: string }> = {
    pending: { tone: "attention", label: "Pending" },
    approved: { tone: "info", label: "Approved" },
    completed: { tone: "success", label: "Completed" },
    declined: { tone: "critical", label: "Declined" },
    cancelled: { tone: "warning", label: "Cancelled" },
  };

  const config = statusMap[status] ?? { tone: "info" as const, label: status };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

function MetricCard({ title, value, subtitle }: { title: string; value: string | number; subtitle?: string }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="p" variant="bodyMd" tone="subdued">{title}</Text>
        <Text as="p" variant="headingXl">{value}</Text>
        {subtitle && <Text as="p" variant="bodySm" tone="subdued">{subtitle}</Text>}
      </BlockStack>
    </Card>
  );
}

export function ErrorBoundary() {
  return (
    <Page>
      <Banner tone="critical" title="Error loading dashboard">
        <p>There was a problem loading the dashboard. Please try refreshing the page.</p>
      </Banner>
    </Page>
  );
}

export default function Dashboard() {
  const { stats, recentReturns } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  if (navigation.state === "loading") {
    return (
      <Page>
        <TitleBar title="Returns Hub" />
        <LoadingPage />
      </Page>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <Page>
      <TitleBar title="Returns Hub" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <InlineStack gap="400" wrap={false}>
              <Box minWidth="200px">
                <MetricCard
                  title="Pending Returns"
                  value={stats.pending}
                  subtitle="Awaiting review"
                />
              </Box>
              <Box minWidth="200px">
                <MetricCard
                  title="Approved"
                  value={stats.approved}
                  subtitle="Ready for shipping"
                />
              </Box>
              <Box minWidth="200px">
                <MetricCard
                  title="This Month"
                  value={stats.totalThisMonth}
                  subtitle="Total returns"
                />
              </Box>
              <Box minWidth="200px">
                <MetricCard
                  title="Refunded"
                  value={formatCurrency(stats.refundedThisMonth)}
                  subtitle="This month"
                />
              </Box>
            </InlineStack>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Recent Returns</Text>
                  <Link to="/app/returns">
                    <Button variant="plain">View all</Button>
                  </Link>
                </InlineStack>

                {recentReturns.length === 0 ? (
                  <EmptyState
                    heading="No returns yet"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>When customers request returns, they will appear here.</p>
                  </EmptyState>
                ) : (
                  <BlockStack gap="300">
                    {recentReturns.map((returnRequest) => (
                      <Box
                        key={returnRequest.id}
                        padding="300"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="100">
                            <InlineStack gap="200" blockAlign="center">
                              <Text as="span" variant="bodyMd" fontWeight="semibold">
                                {returnRequest.shopifyOrderName}
                              </Text>
                              <StatusBadge status={returnRequest.status} />
                            </InlineStack>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {returnRequest.customerName} • {returnRequest.items.length} item(s)
                            </Text>
                          </BlockStack>
                          <BlockStack gap="100" inlineAlign="end">
                            <Text as="span" variant="bodyMd" fontWeight="semibold">
                              {formatCurrency(returnRequest.totalRefundAmount)}
                            </Text>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {new Date(returnRequest.createdAt).toLocaleDateString()}
                            </Text>
                          </BlockStack>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Quick Actions</Text>
                  <BlockStack gap="200">
                    <Link to="/app/returns">
                      <Button fullWidth>View All Returns</Button>
                    </Link>
                    <Link to="/app/settings">
                      <Button fullWidth variant="secondary">Configure Settings</Button>
                    </Link>
                    <Link to="/app/routing-rules">
                      <Button fullWidth variant="secondary">Routing Rules</Button>
                    </Link>
                  </BlockStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Getting Started</Text>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm">
                      1. Configure your return window and policies
                    </Text>
                    <Text as="p" variant="bodySm">
                      2. Set up return destinations (warehouses)
                    </Text>
                    <Text as="p" variant="bodySm">
                      3. Create routing rules for different product types
                    </Text>
                    <Text as="p" variant="bodySm">
                      4. Connect Shippo or EasyPost for labels
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
