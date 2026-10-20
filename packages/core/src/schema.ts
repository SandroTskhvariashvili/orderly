import { z } from "zod";

// ---------------------------------------------------------------------------
// Master data: what the business already knows. Lives in data/fixtures.
// ---------------------------------------------------------------------------

export const Unit = z.enum(["case", "bottle", "bag", "kg", "each", "box", "tray"]);
export type Unit = z.infer<typeof Unit>;

export const Product = z.object({
  sku: z.string().regex(/^[A-Z]{2,4}-[A-Z0-9]{2,6}-[A-Z0-9]{1,4}$/),
  name: z.string(),
  brand: z.string(),
  category: z.enum([
    "coffee",
    "tea",
    "dairy",
    "plant-milk",
    "syrup",
    "bakery",
    "chocolate",
    "packaging",
    "cleaning",
    "juice",
    "water",
  ]),
  unit: Unit,
  packSize: z.string(),
  priceEur: z.number().positive(),
  aliases: z.array(z.string()),
  stock: z.number().int().nonnegative(),
  active: z.boolean(),
});
export type Product = z.infer<typeof Product>;

export const Weekday = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
export type Weekday = z.infer<typeof Weekday>;

export const Customer = z.object({
  id: z.string().regex(/^C-\d{4}$/),
  name: z.string(),
  contactName: z.string(),
  emails: z.array(z.string().email()).min(1),
  language: z.enum(["en", "de", "es"]),
  city: z.string(),
  deliveryDays: z.array(Weekday).min(1),
  creditHold: z.boolean(),
  // Typical order size for this customer, used to spot outliers.
  usualCasesPerOrder: z.number().positive(),
});
export type Customer = z.infer<typeof Customer>;

export const OrderLine = z.object({
  sku: z.string(),
  qty: z.number().positive(),
  unit: Unit,
});
export type OrderLine = z.infer<typeof OrderLine>;

export const PastOrder = z.object({
  id: z.string().regex(/^SO-\d{5}$/),
  customerId: z.string(),
  placedOn: z.string().date(),
  deliveryDate: z.string().date(),
  lines: z.array(OrderLine).min(1),
});
export type PastOrder = z.infer<typeof PastOrder>;

// ---------------------------------------------------------------------------
// Ground truth for each email. Lives in data/labels/<emailId>.json.
// Written by hand, checked by scripts/check-data.ts. Never shown to the model.
// ---------------------------------------------------------------------------

export const Intent = z.enum([
  "new_order",
  "change_order",
  "cancel_order",
  "question",
  "complaint",
  "not_business",
]);
export type Intent = z.infer<typeof Intent>;

export const Route = z.enum(["create_draft", "needs_review", "not_an_order"]);
export type Route = z.infer<typeof Route>;

export const ReviewReason = z.enum([
  "unknown_customer",
  "ambiguous_product",
  "unknown_product",
  "unusual_quantity",
  "invalid_delivery_date",
  "credit_hold",
  "out_of_stock",
  "change_or_cancel",
  "suspicious_instructions",
  "possible_duplicate",
  "missing_information",
  "low_confidence",
]);
export type ReviewReason = z.infer<typeof ReviewReason>;

export const Label = z.object({
  emailId: z.string(),
  split: z.enum(["dev", "test"]),
  intent: Intent,
  customerId: z.string().nullable(),
  lines: z.array(OrderLine),
  deliveryDate: z.string().date().nullable(),
  route: Route,
  // Reasons a careful human reviewer would give. Order does not matter.
  reasons: z.array(ReviewReason),
  // For change/cancel: the order being changed.
  refersToOrderId: z.string().nullable(),
  // Why this email is in the set. Shown in the "what it gets wrong" table.
  purpose: z.string(),
});
export type Label = z.infer<typeof Label>;
