import { z } from "zod";

export const OrderLookupSchema = z.object({
  orderNumber: z
    .string()
    .min(1, "Order number is required")
    .transform((val) => val.replace(/^#/, "").trim()),
  email: z
    .string()
    .email("Please enter a valid email address")
    .transform((val) => val.toLowerCase().trim()),
  shop: z.string().min(1, "Shop domain is required"),
});

export type OrderLookupInput = z.infer<typeof OrderLookupSchema>;

export const ReturnItemSchema = z.object({
  lineItemId: z.string().min(1, "Line item ID is required"),
  variantId: z.string().optional(),
  productId: z.string().optional(),
  title: z.string().min(1, "Item title is required"),
  variantTitle: z.string().optional(),
  sku: z.string().optional(),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  price: z.number().nonnegative("Price must be non-negative"),
  reason: z.enum([
    "defective",
    "wrong_item",
    "not_as_described",
    "no_longer_needed",
    "wrong_size",
    "wrong_color",
    "better_price",
    "other",
  ]),
  notes: z.string().optional(),
});

export type ReturnItemInput = z.infer<typeof ReturnItemSchema>;

export const CreateReturnRequestSchema = z.object({
  shop: z.string().min(1, "Shop domain is required"),
  orderId: z.string().min(1, "Order ID is required"),
  orderName: z.string().min(1, "Order name is required"),
  customerEmail: z.string().email("Valid customer email is required"),
  customerName: z.string().min(1, "Customer name is required"),
  items: z
    .array(ReturnItemSchema)
    .min(1, "At least one item is required for a return"),
});

export type CreateReturnRequestInput = z.infer<typeof CreateReturnRequestSchema>;

export const ShopSettingsSchema = z.object({
  returnWindowDays: z
    .number()
    .int()
    .min(1, "Return window must be at least 1 day")
    .max(365, "Return window cannot exceed 365 days")
    .optional(),
  autoApproveEnabled: z.boolean().optional(),
  autoApproveMaxValue: z
    .number()
    .nonnegative("Max value must be non-negative")
    .nullable()
    .optional(),
  requirePhotos: z.boolean().optional(),
  requireReason: z.boolean().optional(),
  restockAutomatically: z.boolean().optional(),
  notifyOnNewReturn: z.boolean().optional(),
  notifyOnStatusChange: z.boolean().optional(),
  shippoApiKey: z.string().nullable().optional(),
  easypostApiKey: z.string().nullable().optional(),
});

export type ShopSettingsInput = z.infer<typeof ShopSettingsSchema>;

export const ReturnDestinationSchema = z.object({
  name: z.string().min(1, "Destination name is required"),
  addressLine1: z.string().min(1, "Address line 1 is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().length(2, "Country must be a 2-letter code").default("US"),
  phone: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export type ReturnDestinationInput = z.infer<typeof ReturnDestinationSchema>;

export const RoutingRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required"),
  priority: z.number().int().nonnegative().optional(),
  isActive: z.boolean().default(true),
  conditionType: z.enum([
    "product_type",
    "product_tag",
    "sku_contains",
    "order_value_above",
    "order_value_below",
    "return_reason",
    "customer_tag",
    "product_vendor",
  ]),
  conditionValue: z.string().min(1, "Condition value is required"),
  destinationId: z.string().min(1, "Destination ID is required"),
});

export type RoutingRuleInput = z.infer<typeof RoutingRuleSchema>;

export const ShippingAddressSchema = z.object({
  name: z.string().min(1, "Name is required"),
  street1: z.string().min(1, "Street address is required"),
  street2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(1, "ZIP code is required"),
  country: z.string().length(2, "Country must be a 2-letter code").default("US"),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export type ShippingAddressInput = z.infer<typeof ShippingAddressSchema>;

export const CreateLabelRequestSchema = z.object({
  returnRequestId: z.string().min(1, "Return request ID is required"),
  fromAddress: ShippingAddressSchema,
  weight: z.object({
    value: z.number().positive("Weight must be positive"),
    unit: z.enum(["lb", "kg", "oz", "g"]).default("lb"),
  }),
  dimensions: z
    .object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive(),
      unit: z.enum(["in", "cm"]).default("in"),
    })
    .optional(),
});

export type CreateLabelRequestInput = z.infer<typeof CreateLabelRequestSchema>;

export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

export function formatZodErrors(zodError: z.ZodError): string {
  return zodError.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
}
