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
  Checkbox,
  Banner,
  Divider,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import { getShopSettings, updateShopSettings } from "../services/returns.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getShopSettings(session.shop);
  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const returnWindowDays = parseInt(formData.get("returnWindowDays") as string) || 30;
  const autoApproveEnabled = formData.get("autoApproveEnabled") === "true";
  const autoApproveMaxValue = formData.get("autoApproveMaxValue")
    ? parseFloat(formData.get("autoApproveMaxValue") as string)
    : null;
  const requirePhotos = formData.get("requirePhotos") === "true";
  const requireReason = formData.get("requireReason") === "true";
  const restockAutomatically = formData.get("restockAutomatically") === "true";
  const notifyOnNewReturn = formData.get("notifyOnNewReturn") === "true";
  const notifyOnStatusChange = formData.get("notifyOnStatusChange") === "true";
  const shippoApiKey = (formData.get("shippoApiKey") as string) || null;
  const easypostApiKey = (formData.get("easypostApiKey") as string) || null;

  await updateShopSettings(session.shop, {
    returnWindowDays,
    autoApproveEnabled,
    autoApproveMaxValue,
    requirePhotos,
    requireReason,
    restockAutomatically,
    notifyOnNewReturn,
    notifyOnStatusChange,
    shippoApiKey,
    easypostApiKey,
  });

  return json({ success: true });
};

export function ErrorBoundary() {
  return (
    <Page backAction={{ content: "Dashboard", url: "/app" }} title="Settings">
      <Banner tone="critical" title="Error loading settings">
        <p>There was a problem loading settings. Please try refreshing the page.</p>
      </Banner>
    </Page>
  );
}

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [returnWindowDays, setReturnWindowDays] = useState(settings.returnWindowDays.toString());
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(settings.autoApproveEnabled);
  const [autoApproveMaxValue, setAutoApproveMaxValue] = useState(
    settings.autoApproveMaxValue?.toString() || ""
  );
  const [requirePhotos, setRequirePhotos] = useState(settings.requirePhotos);
  const [requireReason, setRequireReason] = useState(settings.requireReason);
  const [restockAutomatically, setRestockAutomatically] = useState(settings.restockAutomatically);
  const [notifyOnNewReturn, setNotifyOnNewReturn] = useState(settings.notifyOnNewReturn);
  const [notifyOnStatusChange, setNotifyOnStatusChange] = useState(settings.notifyOnStatusChange);
  const [shippoApiKey, setShippoApiKey] = useState(settings.shippoApiKey || "");
  const [easypostApiKey, setEasypostApiKey] = useState(settings.easypostApiKey || "");

  const isSubmitting = fetcher.state === "submitting";

  useEffect(() => {
    const data = fetcher.data as { success?: boolean } | undefined;
    if (data?.success) {
      shopify.toast.show("Settings saved");
    }
  }, [fetcher.data, shopify]);

  const handleSave = () => {
    fetcher.submit(
      {
        returnWindowDays,
        autoApproveEnabled: autoApproveEnabled.toString(),
        autoApproveMaxValue,
        requirePhotos: requirePhotos.toString(),
        requireReason: requireReason.toString(),
        restockAutomatically: restockAutomatically.toString(),
        notifyOnNewReturn: notifyOnNewReturn.toString(),
        notifyOnStatusChange: notifyOnStatusChange.toString(),
        shippoApiKey,
        easypostApiKey,
      },
      { method: "POST" }
    );
  };

  return (
    <Page
      backAction={{ content: "Dashboard", url: "/app" }}
      title="Settings"
      primaryAction={{
        content: "Save",
        onAction: handleSave,
        loading: isSubmitting,
      }}
    >
      <TitleBar title="Settings" />
      <Layout>
        <Layout.AnnotatedSection
          id="returnPolicy"
          title="Return Policy"
          description="Configure your store's return policy settings."
        >
          <Card>
            <BlockStack gap="400">
              <TextField
                label="Return Window (days)"
                type="number"
                value={returnWindowDays}
                onChange={setReturnWindowDays}
                helpText="Number of days after delivery customers can request a return"
                autoComplete="off"
              />
              <Checkbox
                label="Require return reason"
                checked={requireReason}
                onChange={setRequireReason}
                helpText="Customers must select a reason for their return"
              />
              <Checkbox
                label="Require photos"
                checked={requirePhotos}
                onChange={setRequirePhotos}
                helpText="Customers must upload photos of the item being returned"
              />
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          id="automation"
          title="Automation"
          description="Automate common return tasks to save time."
        >
          <Card>
            <BlockStack gap="400">
              <Checkbox
                label="Auto-approve returns"
                checked={autoApproveEnabled}
                onChange={setAutoApproveEnabled}
                helpText="Automatically approve return requests that meet criteria"
              />
              {autoApproveEnabled && (
                <TextField
                  label="Maximum auto-approve value"
                  type="number"
                  value={autoApproveMaxValue}
                  onChange={setAutoApproveMaxValue}
                  prefix="$"
                  helpText="Returns above this value require manual approval (leave empty for no limit)"
                  autoComplete="off"
                />
              )}
              <Divider />
              <Checkbox
                label="Automatically restock returned items"
                checked={restockAutomatically}
                onChange={setRestockAutomatically}
                helpText="Add inventory back when returns are completed"
              />
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          id="notifications"
          title="Notifications"
          description="Configure when you receive notifications about returns."
        >
          <Card>
            <BlockStack gap="400">
              <Checkbox
                label="Notify on new return requests"
                checked={notifyOnNewReturn}
                onChange={setNotifyOnNewReturn}
              />
              <Checkbox
                label="Notify on status changes"
                checked={notifyOnStatusChange}
                onChange={setNotifyOnStatusChange}
              />
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          id="shipping"
          title="Shipping Labels"
          description="Connect a shipping provider to generate return labels automatically."
        >
          <Card>
            <BlockStack gap="400">
              <Banner tone="info">
                Connect either Shippo or EasyPost to generate return shipping labels. Only one provider is needed.
              </Banner>
              <TextField
                label="Shippo API Key"
                type="password"
                value={shippoApiKey}
                onChange={setShippoApiKey}
                helpText="Get your API key from goshippo.com"
                autoComplete="off"
              />
              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                — or —
              </Text>
              <TextField
                label="EasyPost API Key"
                type="password"
                value={easypostApiKey}
                onChange={setEasypostApiKey}
                helpText="Get your API key from easypost.com"
                autoComplete="off"
              />
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>
      </Layout>
    </Page>
  );
}
