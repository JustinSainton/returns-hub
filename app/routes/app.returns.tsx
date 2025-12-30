import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
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
  Filters,
  ChoiceList,
  DataTable,
  Modal,
  TextField,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import {
  getReturnRequests,
  approveReturnRequest,
  declineReturnRequest,
} from "../services/returns.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") as "pending" | "approved" | "declined" | "completed" | undefined;

  const returns = await getReturnRequests(session.shop, { status: status || undefined });

  return json({ returns, currentStatus: status });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("_action");
  const returnId = formData.get("returnId") as string;
  const notes = formData.get("notes") as string | undefined;

  if (action === "approve") {
    await approveReturnRequest(returnId, notes);
    return json({ success: true, action: "approved" });
  }

  if (action === "decline") {
    await declineReturnRequest(returnId, notes);
    return json({ success: true, action: "declined" });
  }

  return json({ success: false, error: "Unknown action" });
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

export function ErrorBoundary() {
  return (
    <Page backAction={{ content: "Dashboard", url: "/app" }} title="Returns">
      <Banner tone="critical" title="Error loading returns">
        <p>There was a problem loading returns. Please try refreshing the page.</p>
      </Banner>
    </Page>
  );
}

export default function Returns() {
  const { returns, currentStatus } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [selectedReturn, setSelectedReturn] = useState<typeof returns[0] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>(currentStatus ? [currentStatus] : []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const handleApprove = useCallback((returnRequest: typeof returns[0]) => {
    setSelectedReturn(returnRequest);
    setModalOpen(true);
  }, []);

  const handleDecline = useCallback((returnRequest: typeof returns[0]) => {
    setSelectedReturn(returnRequest);
    setModalOpen(true);
  }, []);

  const submitAction = useCallback((action: "approve" | "decline") => {
    if (!selectedReturn) return;
    
    fetcher.submit(
      { _action: action, returnId: selectedReturn.id, notes },
      { method: "POST" }
    );
    setModalOpen(false);
    setNotes("");
    setSelectedReturn(null);
  }, [selectedReturn, notes, fetcher]);

  const handleStatusFilterChange = useCallback((value: string[]) => {
    setStatusFilter(value);
  }, []);

  const handleFiltersClearAll = useCallback(() => {
    setStatusFilter([]);
  }, []);

  const filters = [
    {
      key: "status",
      label: "Status",
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          choices={[
            { label: "Pending", value: "pending" },
            { label: "Approved", value: "approved" },
            { label: "Completed", value: "completed" },
            { label: "Declined", value: "declined" },
          ]}
          selected={statusFilter}
          onChange={handleStatusFilterChange}
          allowMultiple
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = statusFilter.length > 0
    ? [
        {
          key: "status",
          label: `Status: ${statusFilter.join(", ")}`,
          onRemove: () => setStatusFilter([]),
        },
      ]
    : [];

  const filteredReturns = statusFilter.length > 0
    ? returns.filter((r) => statusFilter.includes(r.status))
    : returns;

  const rows = filteredReturns.map((returnRequest) => [
    <InlineStack gap="200" blockAlign="center" key={`order-${returnRequest.id}`}>
      <Text as="span" variant="bodyMd" fontWeight="semibold">
        {returnRequest.shopifyOrderName}
      </Text>
    </InlineStack>,
    returnRequest.customerName,
    `${returnRequest.items.length} item(s)`,
    formatCurrency(returnRequest.totalRefundAmount),
    <StatusBadge key={`status-${returnRequest.id}`} status={returnRequest.status} />,
    new Date(returnRequest.createdAt).toLocaleDateString(),
    <InlineStack gap="200" key={`actions-${returnRequest.id}`}>
      {returnRequest.status === "pending" && (
        <>
          <Button size="slim" onClick={() => handleApprove(returnRequest)}>
            Approve
          </Button>
          <Button size="slim" variant="secondary" onClick={() => handleDecline(returnRequest)}>
            Decline
          </Button>
        </>
      )}
      {returnRequest.status !== "pending" && (
        <Button size="slim" variant="plain">View</Button>
      )}
    </InlineStack>,
  ]);

  return (
    <Page
      backAction={{ content: "Dashboard", url: "/app" }}
      title="Returns"
      subtitle={`${filteredReturns.length} return requests`}
    >
      <TitleBar title="Returns" />
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <Box padding="400">
              <Filters
                queryValue=""
                filters={filters}
                appliedFilters={appliedFilters}
                onQueryChange={() => {}}
                onQueryClear={() => {}}
                onClearAll={handleFiltersClearAll}
              />
            </Box>
            {filteredReturns.length === 0 ? (
              <Box padding="400">
                <BlockStack gap="200" inlineAlign="center">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    No returns found matching your criteria.
                  </Text>
                </BlockStack>
              </Box>
            ) : (
              <DataTable
                columnContentTypes={["text", "text", "text", "numeric", "text", "text", "text"]}
                headings={["Order", "Customer", "Items", "Amount", "Status", "Date", "Actions"]}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedReturn(null);
          setNotes("");
        }}
        title={selectedReturn ? `Return for ${selectedReturn.shopifyOrderName}` : "Return Details"}
        primaryAction={{
          content: "Approve",
          onAction: () => submitAction("approve"),
        }}
        secondaryActions={[
          {
            content: "Decline",
            destructive: true,
            onAction: () => submitAction("decline"),
          },
        ]}
      >
        <Modal.Section>
          {selectedReturn && (
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">Customer</Text>
                <Text as="p">{selectedReturn.customerName}</Text>
                <Text as="p" tone="subdued">{selectedReturn.customerEmail}</Text>
              </BlockStack>

              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">Items</Text>
                {selectedReturn.items.map((item) => (
                  <Box key={item.id} padding="200" background="bg-surface-secondary" borderRadius="100">
                    <InlineStack align="space-between">
                      <BlockStack gap="100">
                        <Text as="span" fontWeight="semibold">{item.title}</Text>
                        {item.variantTitle && (
                          <Text as="span" tone="subdued">{item.variantTitle}</Text>
                        )}
                      </BlockStack>
                      <Text as="span">
                        {item.quantity} × {formatCurrency(item.pricePerItem)}
                      </Text>
                    </InlineStack>
                  </Box>
                ))}
              </BlockStack>

              {selectedReturn.reason && (
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">Reason</Text>
                  <Text as="p">{selectedReturn.reason}</Text>
                </BlockStack>
              )}

              <TextField
                label="Notes (optional)"
                value={notes}
                onChange={setNotes}
                multiline={3}
                autoComplete="off"
              />
            </BlockStack>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
