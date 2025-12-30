import db from "../db.server";

type AdminGraphQL = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

const GET_INVENTORY_LEVELS = `#graphql
  query GetInventoryLevels($variantId: ID!) {
    productVariant(id: $variantId) {
      id
      inventoryItem {
        id
        inventoryLevels(first: 10) {
          nodes {
            id
            location {
              id
              name
            }
            quantities(names: ["available"]) {
              name
              quantity
            }
          }
        }
      }
    }
  }
`;

const ADJUST_INVENTORY = `#graphql
  mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!) {
    inventoryAdjustQuantities(input: $input) {
      inventoryAdjustmentGroup {
        createdAt
        reason
        changes {
          name
          delta
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface RestockResult {
  success: boolean;
  itemId: string;
  variantId: string;
  quantity: number;
  locationId?: string;
  error?: string;
}

interface InventoryLevel {
  id: string;
  location: {
    id: string;
    name: string;
  };
  quantities: Array<{
    name: string;
    quantity: number;
  }>;
}

export async function restockReturnedItems(
  admin: AdminGraphQL,
  returnRequestId: string,
  locationId?: string
): Promise<RestockResult[]> {
  const returnRequest = await db.returnRequest.findUnique({
    where: { id: returnRequestId },
    include: {
      items: true,
      shopSettings: true,
    },
  });

  if (!returnRequest) {
    throw new Error(`Return request not found: ${returnRequestId}`);
  }

  if (!returnRequest.shopSettings.restockAutomatically) {
    return returnRequest.items.map((item) => ({
      success: false,
      itemId: item.id,
      variantId: item.shopifyVariantId || "",
      quantity: item.quantity,
      error: "Automatic restocking is disabled",
    }));
  }

  const results: RestockResult[] = [];

  for (const item of returnRequest.items) {
    if (item.restocked) {
      results.push({
        success: true,
        itemId: item.id,
        variantId: item.shopifyVariantId || "",
        quantity: item.quantity,
        error: "Already restocked",
      });
      continue;
    }

    if (!item.shopifyVariantId) {
      results.push({
        success: false,
        itemId: item.id,
        variantId: "",
        quantity: item.quantity,
        error: "No variant ID available",
      });
      continue;
    }

    try {
      const result = await restockVariant(
        admin,
        item.shopifyVariantId,
        item.quantity,
        locationId
      );

      if (result.success) {
        await db.returnItem.update({
          where: { id: item.id },
          data: {
            restocked: true,
            restockedAt: new Date(),
          },
        });
      }

      results.push({
        ...result,
        itemId: item.id,
      });
    } catch (error) {
      results.push({
        success: false,
        itemId: item.id,
        variantId: item.shopifyVariantId,
        quantity: item.quantity,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

async function restockVariant(
  admin: AdminGraphQL,
  variantId: string,
  quantity: number,
  preferredLocationId?: string
): Promise<Omit<RestockResult, "itemId">> {
  const inventoryResponse = await admin.graphql(GET_INVENTORY_LEVELS, {
    variables: { variantId },
  });

  const inventoryData = await inventoryResponse.json();
  const variant = inventoryData.data?.productVariant;

  if (!variant?.inventoryItem) {
    return {
      success: false,
      variantId,
      quantity,
      error: "Could not find inventory item for variant",
    };
  }

  const inventoryItemId = variant.inventoryItem.id;
  const inventoryLevels: InventoryLevel[] = variant.inventoryItem.inventoryLevels?.nodes || [];

  if (inventoryLevels.length === 0) {
    return {
      success: false,
      variantId,
      quantity,
      error: "No inventory locations found for variant",
    };
  }

  let targetLocation = inventoryLevels[0];
  
  if (preferredLocationId) {
    const preferred = inventoryLevels.find(
      (level) => level.location.id === preferredLocationId
    );
    if (preferred) {
      targetLocation = preferred;
    }
  }

  const adjustResponse = await admin.graphql(ADJUST_INVENTORY, {
    variables: {
      input: {
        reason: "returned",
        name: "available",
        changes: [
          {
            delta: quantity,
            inventoryItemId,
            locationId: targetLocation.location.id,
          },
        ],
      },
    },
  });

  const adjustData = await adjustResponse.json();
  const userErrors = adjustData.data?.inventoryAdjustQuantities?.userErrors || [];

  if (userErrors.length > 0) {
    return {
      success: false,
      variantId,
      quantity,
      locationId: targetLocation.location.id,
      error: userErrors.map((e: { message: string }) => e.message).join(", "),
    };
  }

  return {
    success: true,
    variantId,
    quantity,
    locationId: targetLocation.location.id,
  };
}

export async function getRestockStatus(returnRequestId: string): Promise<{
  fullyRestocked: boolean;
  items: Array<{
    id: string;
    title: string;
    restocked: boolean;
    restockedAt: Date | null;
  }>;
}> {
  const returnRequest = await db.returnRequest.findUnique({
    where: { id: returnRequestId },
    include: {
      items: {
        select: {
          id: true,
          title: true,
          restocked: true,
          restockedAt: true,
        },
      },
    },
  });

  if (!returnRequest) {
    throw new Error(`Return request not found: ${returnRequestId}`);
  }

  const fullyRestocked = returnRequest.items.every((item) => item.restocked);

  return {
    fullyRestocked,
    items: returnRequest.items,
  };
}
