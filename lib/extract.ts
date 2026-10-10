export type Progress = (fraction: number, status: string) => void;

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|html?|log|ya?ml|vcf|ics|rtf)$/i;
const MAX_SCANNED_PDF_PAGES = 5;

export const DOCUMENT_ACCEPT =
  ".pdf,.docx,.txt,.md,.csv,.tsv,.json,.xml,.html,.htm,.log,.yaml,.yml,.vcf,.ics,.rtf,application/pdf,text/*";

export async function extractText(file: File, lang: string, onProgress: Progress): Promise<string> {
  const name = file.name.toLowerCase();
  let text: string;

  if (file.type.startsWith("image/")) {
    text = await ocr([file], lang, onProgress);
  } else if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    text = await extractPdf(file, lang, onProgress);
  } else if (name.endsWith(".docx")) {
    onProgress(0.3, "Reading Word document");
    const mammoth = await import("mammoth");
    const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = res.value;
  } else if (file.type.startsWith("text/") || TEXT_EXT.test(name)) {
    text = await file.text();
  } else {
    throw new Error("Unsupported file type. Try a PDF, DOCX, TXT or an image.");
  }

  onProgress(1, "Done");
  return tidy(text);
}

function tidy(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function ocr(images: (File | HTMLCanvasElement)[], lang: string, onProgress: Progress) {
  const { createWorker } = await import("tesseract.js");
  let index = 0;
  onProgress(0, "Loading OCR engine");
  const worker = await createWorker(lang, 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        onProgress((index + m.progress) / images.length, `Reading text${images.length > 1 ? ` · page ${index + 1}/${images.length}` : ""}`);
      } else {
        onProgress(0, m.status.charAt(0).toUpperCase() + m.status.slice(1));
      }
    },
  });
  try {
    const parts: string[] = [];
    for (; index < images.length; index++) {
      const { data } = await worker.recognize(images[index]);
      parts.push(data.text);
    }
    return parts.join("\n\n");
  } finally {
    await worker.terminate();
  }
}

async function extractPdf(file: File, lang: string, onProgress: Progress) {
  onProgress(0.05, "Opening PDF");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : "") : "")).join(""));
    onProgress(i / doc.numPages, `Reading page ${i}/${doc.numPages}`);
  }

  const text = pages.join("\n\n");
  if (text.replace(/\s/g, "").length > 20) return text;

  // No embedded text layer: the PDF is a scan, so render pages and OCR them.
  const canvases: HTMLCanvasElement[] = [];
  const count = Math.min(doc.numPages, MAX_SCANNED_PDF_PAGES);
  for (let i = 1; i <= count; i++) {
    onProgress(0, `Rendering scanned page ${i}/${count}`);
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
    canvases.push(canvas);
  }
  return ocr(canvases, lang, onProgress);
}
