import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  TextField,
  Button,
  Modal,
  Select,
  DataTable,
  EmptyState,
  InlineStack,
  Badge,
  Box,
  Banner,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useState, useCallback, useEffect } from "react";
import { authenticate } from "../shopify.server";
import {
  getRoutingRules,
  getReturnDestinations,
  createRoutingRule,
  createReturnDestination,
} from "../services/returns.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const [rules, destinations] = await Promise.all([
    getRoutingRules(session.shop),
    getReturnDestinations(session.shop),
  ]);

  return json({ rules, destinations, shop: session.shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("_action");

  if (actionType === "createDestination") {
    const destination = await createReturnDestination(session.shop, {
      name: formData.get("name") as string,
      addressLine1: formData.get("addressLine1") as string,
      addressLine2: (formData.get("addressLine2") as string) || undefined,
      city: formData.get("city") as string,
      state: formData.get("state") as string,
      postalCode: formData.get("postalCode") as string,
      country: (formData.get("country") as string) || "US",
      phone: (formData.get("phone") as string) || undefined,
      isDefault: formData.get("isDefault") === "true",
    });
    return json({ success: true, destination });
  }

  if (actionType === "createRule") {
    const rule = await createRoutingRule(session.shop, {
      name: formData.get("name") as string,
      priority: parseInt(formData.get("priority") as string) || 0,
      conditionType: formData.get("conditionType") as string,
      conditionValue: formData.get("conditionValue") as string,
      destinationId: formData.get("destinationId") as string,
    });
    return json({ success: true, rule });
  }

  return json({ success: false, error: "Unknown action" });
};

export function ErrorBoundary() {
  return (
    <Page backAction={{ content: "Dashboard", url: "/app" }} title="Routing Rules">
      <Banner tone="critical" title="Error loading routing rules">
        <p>There was a problem loading routing rules. Please try refreshing the page.</p>
      </Banner>
    </Page>
  );
}

export default function RoutingRules() {
  const { rules, destinations } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [destinationModalOpen, setDestinationModalOpen] = useState(false);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);

  const [destName, setDestName] = useState("");
  const [destAddress1, setDestAddress1] = useState("");
  const [destAddress2, setDestAddress2] = useState("");
  const [destCity, setDestCity] = useState("");
  const [destState, setDestState] = useState("");
  const [destPostal, setDestPostal] = useState("");
  const [destCountry, setDestCountry] = useState("US");
  const [destPhone, setDestPhone] = useState("");
  const [destIsDefault, setDestIsDefault] = useState(false);

  const [ruleName, setRuleName] = useState("");
  const [rulePriority, setRulePriority] = useState("0");
  const [ruleConditionType, setRuleConditionType] = useState("product_type");
  const [ruleConditionValue, setRuleConditionValue] = useState("");
  const [ruleDestinationId, setRuleDestinationId] = useState("");

  useEffect(() => {
    const data = fetcher.data as { success?: boolean } | undefined;
    if (data?.success) {
      shopify.toast.show("Saved successfully");
      setDestinationModalOpen(false);
      setRuleModalOpen(false);
      resetDestinationForm();
      resetRuleForm();
    }
  }, [fetcher.data, shopify]);

  const resetDestinationForm = () => {
    setDestName("");
    setDestAddress1("");
    setDestAddress2("");
    setDestCity("");
    setDestState("");
    setDestPostal("");
    setDestCountry("US");
    setDestPhone("");
    setDestIsDefault(false);
  };

  const resetRuleForm = () => {
    setRuleName("");
    setRulePriority("0");
    setRuleConditionType("product_type");
    setRuleConditionValue("");
    setRuleDestinationId("");
  };

  const handleCreateDestination = useCallback(() => {
    fetcher.submit(
      {
        _action: "createDestination",
        name: destName,
        addressLine1: destAddress1,
        addressLine2: destAddress2,
        city: destCity,
        state: destState,
        postalCode: destPostal,
        country: destCountry,
        phone: destPhone,
        isDefault: destIsDefault.toString(),
      },
      { method: "POST" }
    );
  }, [fetcher, destName, destAddress1, destAddress2, destCity, destState, destPostal, destCountry, destPhone, destIsDefault]);

  const handleCreateRule = useCallback(() => {
    fetcher.submit(
      {
        _action: "createRule",
        name: ruleName,
        priority: rulePriority,
        conditionType: ruleConditionType,
        conditionValue: ruleConditionValue,
        destinationId: ruleDestinationId,
      },
      { method: "POST" }
    );
  }, [fetcher, ruleName, rulePriority, ruleConditionType, ruleConditionValue, ruleDestinationId]);

  const conditionTypeOptions = [
    { label: "Product Type", value: "product_type" },
    { label: "Product Tag", value: "product_tag" },
    { label: "SKU Contains", value: "sku_contains" },
    { label: "Order Value Above", value: "order_value_above" },
    { label: "Order Value Below", value: "order_value_below" },
    { label: "Return Reason", value: "return_reason" },
  ];

  const destinationOptions = destinations.map((d) => ({
    label: d.name,
    value: d.id,
  }));

  const ruleRows = rules.map((rule) => [
    rule.name,
    <Badge key={`type-${rule.id}`}>{rule.conditionType.replace("_", " ")}</Badge>,
    rule.conditionValue,
    rule.destination?.name || "Unknown",
    rule.priority,
    <Badge key={`status-${rule.id}`} tone={rule.isActive ? "success" : "warning"}>
      {rule.isActive ? "Active" : "Inactive"}
    </Badge>,
  ]);

  return (
    <Page
      backAction={{ content: "Dashboard", url: "/app" }}
      title="Routing Rules"
      subtitle="Route returns to different destinations based on conditions"
    >
      <TitleBar title="Routing Rules" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">Return Destinations</Text>
                <Button onClick={() => setDestinationModalOpen(true)}>
                  Add Destination
                </Button>
              </InlineStack>

              {destinations.length === 0 ? (
                <EmptyState
                  heading="No destinations yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  action={{
                    content: "Add destination",
                    onAction: () => setDestinationModalOpen(true),
                  }}
                >
                  <p>Add warehouses or locations where returns should be sent.</p>
                </EmptyState>
              ) : (
                <BlockStack gap="200">
                  {destinations.map((dest) => (
                    <Box
                      key={dest.id}
                      padding="300"
                      background="bg-surface-secondary"
                      borderRadius="200"
                    >
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <InlineStack gap="200">
                            <Text as="span" fontWeight="semibold">{dest.name}</Text>
                            {dest.isDefault && <Badge tone="info">Default</Badge>}
                          </InlineStack>
                          <Text as="span" tone="subdued">
                            {dest.addressLine1}, {dest.city}, {dest.state} {dest.postalCode}
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

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">Routing Rules</Text>
                <Button
                  onClick={() => setRuleModalOpen(true)}
                  disabled={destinations.length === 0}
                >
                  Add Rule
                </Button>
              </InlineStack>

              {destinations.length === 0 ? (
                <Text as="p" tone="subdued">
                  Add at least one destination before creating routing rules.
                </Text>
              ) : rules.length === 0 ? (
                <EmptyState
                  heading="No routing rules yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  action={{
                    content: "Create rule",
                    onAction: () => setRuleModalOpen(true),
                  }}
                >
                  <p>Create rules to automatically route returns based on product type, value, or other conditions.</p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "numeric", "text"]}
                  headings={["Name", "Condition", "Value", "Destination", "Priority", "Status"]}
                  rows={ruleRows}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={destinationModalOpen}
        onClose={() => {
          setDestinationModalOpen(false);
          resetDestinationForm();
        }}
        title="Add Return Destination"
        primaryAction={{
          content: "Save",
          onAction: handleCreateDestination,
          loading: fetcher.state === "submitting",
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setDestinationModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Location Name"
              value={destName}
              onChange={setDestName}
              autoComplete="off"
              placeholder="Main Warehouse"
            />
            <TextField
              label="Address Line 1"
              value={destAddress1}
              onChange={setDestAddress1}
              autoComplete="address-line1"
            />
            <TextField
              label="Address Line 2"
              value={destAddress2}
              onChange={setDestAddress2}
              autoComplete="address-line2"
            />
            <InlineStack gap="400">
              <Box minWidth="200px">
                <TextField
                  label="City"
                  value={destCity}
                  onChange={setDestCity}
                  autoComplete="address-level2"
                />
              </Box>
              <Box minWidth="100px">
                <TextField
                  label="State"
                  value={destState}
                  onChange={setDestState}
                  autoComplete="address-level1"
                />
              </Box>
              <Box minWidth="120px">
                <TextField
                  label="ZIP Code"
                  value={destPostal}
                  onChange={setDestPostal}
                  autoComplete="postal-code"
                />
              </Box>
            </InlineStack>
            <TextField
              label="Phone"
              value={destPhone}
              onChange={setDestPhone}
              autoComplete="tel"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal
        open={ruleModalOpen}
        onClose={() => {
          setRuleModalOpen(false);
          resetRuleForm();
        }}
        title="Add Routing Rule"
        primaryAction={{
          content: "Save",
          onAction: handleCreateRule,
          loading: fetcher.state === "submitting",
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setRuleModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Rule Name"
              value={ruleName}
              onChange={setRuleName}
              autoComplete="off"
              placeholder="Electronics to Warehouse B"
            />
            <Select
              label="Condition Type"
              options={conditionTypeOptions}
              value={ruleConditionType}
              onChange={setRuleConditionType}
            />
            <TextField
              label="Condition Value"
              value={ruleConditionValue}
              onChange={setRuleConditionValue}
              autoComplete="off"
              placeholder={
                ruleConditionType === "product_type"
                  ? "Electronics"
                  : ruleConditionType === "order_value_above"
                  ? "100"
                  : "Enter value"
              }
            />
            <Select
              label="Send To"
              options={destinationOptions}
              value={ruleDestinationId}
              onChange={setRuleDestinationId}
              placeholder="Select destination"
            />
            <TextField
              label="Priority"
              type="number"
              value={rulePriority}
              onChange={setRulePriority}
              helpText="Lower numbers = higher priority. Rules are evaluated in order."
              autoComplete="off"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
