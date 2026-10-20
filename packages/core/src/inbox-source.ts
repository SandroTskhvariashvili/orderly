import { z } from "zod";

// Hand-written source for each test email. scripts/build-inbox.ts turns these
// into real RFC 822 .eml files (with PDF attachments where present), and the
// pipeline only ever reads the .eml files, the same way it would read a mailbox.

export const Address = z.object({
  name: z.string(),
  address: z.string().email(),
});

export const PurchaseOrder = z.object({
  number: z.string(),
  issuedOn: z.string().date(),
  buyer: z.object({
    company: z.string(),
    contact: z.string(),
    address: z.array(z.string()).min(1),
  }),
  deliverTo: z.array(z.string()).min(1),
  requestedDelivery: z.string().date().nullable(),
  lines: z
    .array(
      z.object({
        // Buyers use their own codes or none at all, never ours reliably.
        buyerCode: z.string().nullable(),
        description: z.string(),
        qty: z.number().positive(),
        unit: z.string(),
        unitPriceEur: z.number().positive().nullable(),
      }),
    )
    .min(1),
  notes: z.string().nullable(),
});
export type PurchaseOrder = z.infer<typeof PurchaseOrder>;

export const InboxSource = z.object({
  id: z.string().regex(/^E-\d{3}$/),
  receivedAt: z.string().datetime({ offset: true }),
  from: Address,
  to: Address,
  cc: z.array(Address).default([]),
  subject: z.string(),
  messageId: z.string().regex(/^<.+@.+>$/),
  inReplyTo: z.string().regex(/^<.+@.+>$/).nullable().default(null),
  body: z.string().min(1),
  attachments: z
    .array(z.object({ filename: z.string().endsWith(".pdf"), po: PurchaseOrder }))
    .default([]),
});
export type InboxSource = z.infer<typeof InboxSource>;
