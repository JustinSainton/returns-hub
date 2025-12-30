import {
  Card,
  BlockStack,
  SkeletonBodyText,
  SkeletonDisplayText,
  Box,
  InlineStack,
  Layout,
} from "@shopify/polaris";

export function LoadingCard() {
  return (
    <Card>
      <BlockStack gap="400">
        <SkeletonDisplayText size="small" />
        <SkeletonBodyText lines={3} />
      </BlockStack>
    </Card>
  );
}

export function LoadingMetrics() {
  return (
    <InlineStack gap="400" wrap={false}>
      {[1, 2, 3, 4].map((i) => (
        <Box key={i} minWidth="200px">
          <Card>
            <BlockStack gap="200">
              <SkeletonBodyText lines={1} />
              <SkeletonDisplayText size="medium" />
              <SkeletonBodyText lines={1} />
            </BlockStack>
          </Card>
        </Box>
      ))}
    </InlineStack>
  );
}

export function LoadingTable() {
  return (
    <Card>
      <BlockStack gap="400">
        <SkeletonDisplayText size="small" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Box key={i} padding="300" background="bg-surface-secondary" borderRadius="200">
            <InlineStack align="space-between">
              <BlockStack gap="100">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={1} />
              </BlockStack>
              <SkeletonBodyText lines={1} />
            </InlineStack>
          </Box>
        ))}
      </BlockStack>
    </Card>
  );
}

export function LoadingPage() {
  return (
    <Layout>
      <Layout.Section>
        <LoadingMetrics />
      </Layout.Section>
      <Layout.Section>
        <LoadingTable />
      </Layout.Section>
    </Layout>
  );
}

export function LoadingSettings() {
  return (
    <Layout>
      {[1, 2, 3].map((i) => (
        <Layout.AnnotatedSection
          key={i}
          title=""
          description=""
        >
          <Card>
            <BlockStack gap="400">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={4} />
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>
      ))}
    </Layout>
  );
}
