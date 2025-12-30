import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  InlineStack,
  Box,
  Button,
  Banner,
  Divider,
  Icon,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import {
  CashDollarIcon,
  GiftCardIcon,
  RefreshIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getReturnRequestById } from "../services/returns.server";
import {
  getExchangeSettings,
  calculateStoreCreditValue,
  updateReturnWithStoreCredit,
  createGiftCard,
} from "../services/exchange.server";
import { sendStoreCreditNotification } from "../services/notifications.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const returnId = params.id;

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

  const settings = await getExchangeSettings(session.shop);
  const storeCreditValue = calculateStoreCreditValue(
    returnRequest.totalRefundAmount,
    settings.storeCreditBonusPercent
  );

  return json({
    returnRequest,
    settings,
    storeCreditValue,
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const resolution = formData.get("resolution") as string;
  const returnId = params.id;

  if (!returnId) {
    return json({ error: "Return ID required" }, { status: 400 });
  }

  const returnRequest = await getReturnRequestById(returnId);
  if (!returnRequest || returnRequest.shop !== session.shop) {
    return json({ error: "Return not found" }, { status: 404 });
  }

  if (resolution === "store_credit") {
    const settings = await getExchangeSettings(session.shop);
    const creditValue = calculateStoreCreditValue(
      returnRequest.totalRefundAmount,
      settings.storeCreditBonusPercent
    );

    const expiresOn = settings.storeCreditExpiryDays
      ? new Date(Date.now() + settings.storeCreditExpiryDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
      : undefined;

    const giftCardResult = await createGiftCard(admin, {
      initialValue: creditValue.totalValue,
      note: `Store credit for return #${returnRequest.id}`,
      expiresOn,
    });

    const data = await giftCardResult;
    if (data.data?.giftCardCreate?.userErrors?.length > 0) {
      return json({ 
        error: data.data.giftCardCreate.userErrors[0].message 
      }, { status: 400 });
    }

    const giftCardCode = data.data?.giftCardCreate?.giftCardCode;
    if (giftCardCode) {
      await updateReturnWithStoreCredit(returnId, {
        storeCreditIssued: creditValue.totalValue,
        storeCreditCode: giftCardCode,
      });

      const shopName = session.shop.replace(".myshopify.com", "");
      await sendStoreCreditNotification({
        customerEmail: returnRequest.customerEmail,
        customerName: returnRequest.customerName,
        shopName,
        orderName: returnRequest.shopifyOrderName,
        giftCardCode,
        creditAmount: returnRequest.totalRefundAmount,
        bonusAmount: creditValue.bonusValue,
        expiresOn,
      });
    }

    return json({ 
      success: true, 
      resolution: "store_credit",
      giftCardCode,
      amount: creditValue.totalValue,
    });
  }

  if (resolution === "exchange") {
    return redirect(`/app/returns/${returnId}/exchange/shop`);
  }

  return json({ error: "Invalid resolution type" }, { status: 400 });
};

interface ResolutionOptionProps {
  icon: typeof CashDollarIcon;
  title: string;
  description: string;
  value: string;
  amount: string;
  bonus?: string;
  recommended?: boolean;
  disabled?: boolean;
}

function ResolutionOption({
  icon,
  title,
  description,
  value,
  amount,
  bonus,
  recommended,
  disabled,
}: ResolutionOptionProps) {
  return (
    <Box
      padding="400"
      background={recommended ? "bg-surface-success" : "bg-surface-secondary"}
      borderRadius="200"
      borderWidth="025"
      borderColor={recommended ? "border-success" : "border"}
    >
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="start">
          <InlineStack gap="300" blockAlign="center">
            <Box
              background={recommended ? "bg-fill-success" : "bg-fill-secondary"}
              padding="200"
              borderRadius="200"
            >
              <Icon source={icon} tone={recommended ? "success" : "base"} />
            </Box>
            <BlockStack gap="100">
              <InlineStack gap="200" blockAlign="center">
                <Text as="span" variant="headingMd" fontWeight="semibold">
                  {title}
                </Text>
                {recommended && (
                  <Box
                    background="bg-fill-success"
                    padding="050"
                    paddingInlineStart="150"
                    paddingInlineEnd="150"
                    borderRadius="100"
                  >
                    <Text as="span" variant="bodySm" fontWeight="medium">
                      Recommended
                    </Text>
                  </Box>
                )}
              </InlineStack>
              <Text as="span" variant="bodySm" tone="subdued">
                {description}
              </Text>
            </BlockStack>
          </InlineStack>
          <BlockStack gap="050" inlineAlign="end">
            <Text as="span" variant="headingLg" fontWeight="bold">
              {amount}
            </Text>
            {bonus && (
              <Text as="span" variant="bodySm" tone="success" fontWeight="medium">
                {bonus}
              </Text>
            )}
          </BlockStack>
        </InlineStack>
        <Form method="post">
          <input type="hidden" name="resolution" value={value} />
          <Button
            submit
            fullWidth
            variant={recommended ? "primary" : "secondary"}
            disabled={disabled}
          >
            {value === "exchange" ? "Browse Products" : `Choose ${title}`}
          </Button>
        </Form>
      </BlockStack>
    </Box>
  );
}

export default function ExchangeOptions() {
  const { returnRequest, settings, storeCreditValue } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const hasResolution = !!returnRequest.resolutionType;

  return (
    <Page
      backAction={{ content: "Returns", url: "/app/returns" }}
      title={`Return Resolution - ${returnRequest.shopifyOrderName}`}
    >
      <TitleBar title="Choose Resolution" />
      <Layout>
        <Layout.Section>
          {hasResolution && (
            <Box paddingBlockEnd="400">
              <Banner tone="info">
                This return already has a resolution: {returnRequest.resolutionType}
                {returnRequest.storeCreditCode && ` (Gift Card: ${returnRequest.storeCreditCode})`}
              </Banner>
            </Box>
          )}

          <Card>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text as="h2" variant="headingLg">
                  How would you like to resolve this return?
                </Text>
                <Text as="p" tone="subdued">
                  Return value: {formatCurrency(returnRequest.totalRefundAmount)}
                </Text>
              </BlockStack>

              <Divider />

              <BlockStack gap="300">
                {settings.storeCreditEnabled && (
                  <ResolutionOption
                    icon={GiftCardIcon}
                    title="Store Credit"
                    description="Get bonus credit to shop anytime"
                    value="store_credit"
                    amount={formatCurrency(storeCreditValue.totalValue)}
                    bonus={`+${formatCurrency(storeCreditValue.bonusValue)} bonus (${settings.storeCreditBonusPercent}%)`}
                    recommended
                    disabled={hasResolution}
                  />
                )}

                {settings.exchangeEnabled && settings.shopNowExchangeEnabled && (
                  <ResolutionOption
                    icon={RefreshIcon}
                    title="Exchange"
                    description="Browse our catalog and pick something new"
                    value="exchange"
                    amount={formatCurrency(returnRequest.totalRefundAmount)}
                    disabled={hasResolution}
                  />
                )}

                <ResolutionOption
                  icon={CashDollarIcon}
                  title="Original Payment"
                  description="Refund to your original payment method"
                  value="refund"
                  amount={formatCurrency(returnRequest.totalRefundAmount)}
                  disabled={hasResolution}
                />
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingMd">
                Return Summary
              </Text>
              <Divider />
              {returnRequest.items.map((item) => (
                <InlineStack key={item.id} align="space-between">
                  <BlockStack gap="050">
                    <Text as="span" variant="bodyMd">
                      {item.title}
                    </Text>
                    {item.variantTitle && (
                      <Text as="span" variant="bodySm" tone="subdued">
                        {item.variantTitle}
                      </Text>
                    )}
                  </BlockStack>
                  <Text as="span" variant="bodyMd">
                    {item.quantity} × {formatCurrency(item.pricePerItem)}
                  </Text>
                </InlineStack>
              ))}
              <Divider />
              <InlineStack align="space-between">
                <Text as="span" variant="headingMd" fontWeight="semibold">
                  Total
                </Text>
                <Text as="span" variant="headingMd" fontWeight="semibold">
                  {formatCurrency(returnRequest.totalRefundAmount)}
                </Text>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
