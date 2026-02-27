import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

const DARK = rgb(0.06, 0.09, 0.16);
const MID = rgb(0.2, 0.22, 0.26);
const GOLD = rgb(0.89, 0.79, 0.49);
const LINE_COL = rgb(0.82, 0.84, 0.86);

interface PathwayStepData {
  stepOrder?: number;
  title?: string;
  description?: string;
  stageLabel?: string;
  definiteDate?: string;
  timelineMonths?: number;
  estimatedCost?: number;
  costNote?: string;
  tips?: string;
  checklist?: string[];
  sources?: string[] | { names?: string[] } | unknown[];
}

interface PathwayData {
  goal?: string;
  summary?: string;
  totalEstimatedYears?: number;
  totalEstimatedCost?: number;
  costContext?: string;
  steps?: PathwayStepData[];
}

function money(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function wrapText(
  text: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function generatePathwayPdf(
  pathway: PathwayData,
  goalTitle: string
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  }

  function drawText(
    text: string,
    opts: {
      font?: typeof helvetica;
      size?: number;
      color?: typeof DARK;
      indent?: number;
    } = {}
  ) {
    const font = opts.font ?? helvetica;
    const size = opts.size ?? 11;
    const color = opts.color ?? DARK;
    const indent = opts.indent ?? 0;
    const lines = wrapText(text, font, size, CONTENT_W - indent);

    for (const line of lines) {
      ensureSpace(size + 4);
      page.drawText(line, { x: MARGIN + indent, y, size, font, color });
      y -= size + 4;
    }
    y -= 4;
  }

  function drawLine() {
    ensureSpace(12);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.6,
      color: LINE_COL,
    });
    y -= 12;
  }

  // Header
  drawText("Athro Goals", { font: helveticaBold, size: 22, color: DARK });
  drawText("Life-goal pathway with real dates and costs", { size: 12, color: MID });
  y -= 8;

  // Goal
  drawText((goalTitle || pathway.goal) ?? "Pathway", {
    font: helveticaBold,
    size: 16,
    color: DARK,
  });
  y -= 4;

  if (pathway.summary) {
    drawText(pathway.summary, { size: 11 });
  }
  if (pathway.totalEstimatedYears != null) {
    drawText(`Estimated timeline: ${pathway.totalEstimatedYears} years`, {
      size: 10,
      color: MID,
    });
  }
  if (pathway.totalEstimatedCost != null) {
    drawText(`Estimated total: ${money(pathway.totalEstimatedCost)}`, {
      size: 10,
      color: MID,
    });
  }
  if (pathway.costContext) {
    drawText(pathway.costContext, { size: 10, color: MID });
  }
  y -= 8;

  // Steps
  const steps = pathway.steps ?? [];
  if (steps.length > 0) {
    drawText("Step-by-step pathway", { font: helveticaBold, size: 14 });
    y -= 4;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const order = step.stepOrder ?? i + 1;
      const title = step.title ?? `Step ${order}`;

      ensureSpace(80);
      drawLine();

      const dateStr = step.definiteDate ? ` — ${step.definiteDate}` : "";
      drawText(`Step ${order}: ${title}${dateStr}`, {
        font: helveticaBold,
        size: 13,
      });

      if (step.description) {
        drawText(step.description, { size: 11 });
      }
      if (step.stageLabel) {
        drawText(`Stage: ${step.stageLabel}`, { size: 10, color: MID });
      }
      if (step.timelineMonths != null) {
        drawText(
          `Duration: ${step.timelineMonths >= 12 ? `${Math.round(step.timelineMonths / 12)} year(s)` : `${step.timelineMonths} months`}`,
          { size: 10, color: MID }
        );
      }
      if (step.estimatedCost != null) {
        drawText(`Est. cost: ${money(step.estimatedCost)}`, {
          size: 10,
          color: GOLD,
        });
      }
      if (step.costNote) {
        drawText(step.costNote, { size: 10, color: MID });
      }
      if (step.tips) {
        drawText(`Tips: ${step.tips}`, { size: 10, color: MID });
      }
      const checklist = Array.isArray(step.checklist)
        ? step.checklist.filter((x): x is string => typeof x === "string")
        : [];
      if (checklist.length > 0) {
        drawText("Checklist:", { size: 10, color: MID });
        for (const item of checklist) {
          drawText(`  ☐ ${item}`, { size: 10, indent: 12 });
        }
      }
      const sources = Array.isArray(step.sources)
        ? step.sources.filter((x): x is string => typeof x === "string")
        : (step.sources as { names?: string[] })?.names ?? [];
      if (sources.length > 0) {
        drawText(`Sources: ${sources.join(", ")}`, { size: 9, color: MID });
      }
    }
  }

  y -= 16;
  drawText("Generated by Athro Goals — athrogoals.co.uk", {
    size: 9,
    color: MID,
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
