// Builds data/inbox/*.eml from data/inbox-src/*.json.
// Purchase orders become real PDF attachments, so the pipeline has to read
// them the way it would read a customer's file.

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import PDFDocument from "pdfkit";
import { InboxSource, type PurchaseOrder } from "@orderly/core/inbox-source";

const SRC = "data/inbox-src";
const OUT = "data/inbox";

function renderPurchaseOrder(po: PurchaseOrder): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Purchase order ${po.number}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(16).text(po.buyer.company);
    doc.font("Helvetica").fontSize(9).fillColor("#444").text(po.buyer.address.join("\n"));
    doc.moveDown(1.2).fillColor("#000");

    doc.font("Helvetica-Bold").fontSize(13).text(`PURCHASE ORDER  ${po.number}`);
    doc.font("Helvetica").fontSize(9.5);
    doc.text(`Date: ${po.issuedOn}`);
    doc.text(`Contact: ${po.buyer.contact}`);
    if (po.requestedDelivery) doc.text(`Requested delivery: ${po.requestedDelivery}`);
    doc.moveDown(0.6).text(`Deliver to:\n${po.deliverTo.join("\n")}`);
    doc.moveDown(1);

    const cols = [48, 118, 360, 420, 480];
    const header = ["Our code", "Description", "Qty", "Unit", "Unit €"];
    let y = doc.y;
    doc.font("Helvetica-Bold");
    header.forEach((h, i) => doc.text(h, cols[i]!, y, { width: (cols[i + 1] ?? 548) - cols[i]! - 6 }));
    doc.moveTo(48, y + 14).lineTo(548, y + 14).strokeColor("#999").stroke();
    doc.font("Helvetica");
    y += 20;
    for (const line of po.lines) {
      const cells = [
        line.buyerCode ?? "",
        line.description,
        String(line.qty),
        line.unit,
        line.unitPriceEur == null ? "" : line.unitPriceEur.toFixed(2),
      ];
      const height = doc.heightOfString(line.description, { width: cols[2]! - cols[1]! - 6 });
      cells.forEach((c, i) => doc.text(c, cols[i]!, y, { width: (cols[i + 1] ?? 548) - cols[i]! - 6 }));
      y += Math.max(height, 12) + 6;
    }
    if (po.notes) {
      doc.moveDown(2).text(`Notes: ${po.notes}`, 48, y + 12, { width: 500 });
    }
    doc.end();
  });
}

async function build(file: string): Promise<string> {
  const src = InboxSource.parse(JSON.parse(await readFile(path.join(SRC, file), "utf8")));
  const attachments = await Promise.all(
    src.attachments.map(async (a) => ({
      filename: a.filename,
      contentType: "application/pdf",
      content: await renderPurchaseOrder(a.po),
    })),
  );
  const mail = new MailComposer({
    from: src.from,
    to: src.to,
    cc: src.cc.length ? src.cc : undefined,
    subject: src.subject,
    date: new Date(src.receivedAt),
    messageId: src.messageId,
    inReplyTo: src.inReplyTo ?? undefined,
    references: src.inReplyTo ?? undefined,
    text: src.body,
    attachments,
  });
  const raw = await mail.compile().build();
  await writeFile(path.join(OUT, `${src.id}.eml`), raw);
  return src.id;
}

await mkdir(OUT, { recursive: true });
const files = (await readdir(SRC)).filter((f) => f.endsWith(".json")).sort();
const built = await Promise.all(files.map(build));
console.log(`built ${built.length} emails into ${OUT}/`);
