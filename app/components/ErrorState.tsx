import {
  Card,
  BlockStack,
  Text,
  Button,
  Banner,
  Box,
} from "@shopify/polaris";
import { useRouteError, isRouteErrorResponse, Link } from "@remix-run/react";

interface ErrorStateProps {
  title?: string;
  message?: string;
  retry?: () => void;
}

export function ErrorState({ title, message, retry }: ErrorStateProps) {
  return (
    <Card>
      <BlockStack gap="400" inlineAlign="center">
        <Box padding="400">
          <BlockStack gap="300" inlineAlign="center">
            <Text as="h2" variant="headingLg">
              {title || "Something went wrong"}
            </Text>
            <Text as="p" tone="subdued">
              {message || "We encountered an error while loading this page."}
            </Text>
            {retry && (
              <Button onClick={retry}>Try again</Button>
            )}
            <Link to="/app">
              <Button variant="plain">Return to dashboard</Button>
            </Link>
          </BlockStack>
        </Box>
      </BlockStack>
    </Card>
  );
}

export function RouteErrorState() {
  const error = useRouteError();

  let title = "Unexpected Error";
  let message = "Something went wrong. Please try again.";

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    message = error.data?.message || "The requested page could not be loaded.";
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <Box padding="400">
      <Banner tone="critical" title={title}>
        <p>{message}</p>
      </Banner>
      <Box paddingBlockStart="400">
        <Link to="/app">
          <Button>Return to dashboard</Button>
        </Link>
      </Box>
    </Box>
  );
}
