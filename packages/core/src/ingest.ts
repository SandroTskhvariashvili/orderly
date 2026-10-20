import { readFile } from "node:fs/promises";
import { simpleParser, type AddressObject } from "mailparser";
import { extractText, getDocumentProxy } from "unpdf";

export interface Attachment {
  filename: string;
  contentType: string;
  text: string;
}

export interface Email {
  id: string;
  messageId: string | null;
  inReplyTo: string | null;
  receivedAt: string;
  from: { name: string; address: string };
  subject: string;
  text: string;
  attachments: Attachment[];
}

function firstAddress(field: AddressObject | AddressObject[] | undefined) {
  const list = Array.isArray(field) ? field : field ? [field] : [];
  const value = list.flatMap((a) => a.value)[0];
  return { name: value?.name ?? "", address: (value?.address ?? "").toLowerCase() };
}

async function pdfToText(content: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(content));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

/** Reads a raw RFC 822 message the way a mailbox integration would. */
export async function readEml(file: string, id: string): Promise<Email> {
  const mail = await simpleParser(await readFile(file));
  const attachments: Attachment[] = [];
  for (const a of mail.attachments) {
    const isPdf = a.contentType === "application/pdf" || a.filename?.toLowerCase().endsWith(".pdf");
    attachments.push({
      filename: a.filename ?? "attachment",
      contentType: a.contentType,
      text: isPdf ? await pdfToText(a.content) : "",
    });
  }
  return {
    id,
    messageId: mail.messageId ?? null,
    inReplyTo: typeof mail.inReplyTo === "string" ? mail.inReplyTo : null,
    receivedAt: (mail.date ?? new Date()).toISOString(),
    from: firstAddress(mail.from),
    subject: mail.subject ?? "",
    text: (mail.text ?? "").replace(/\r\n/g, "\n").trimEnd(),
    attachments,
  };
}
