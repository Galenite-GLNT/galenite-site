const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const PDF_MAX_BYTES = 20 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

let pdfModulePromise = null;

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export function validateAttachment(file) {
  if (!file) return { ok: false, error: "Файл не выбран." };
  if (file.type === "application/pdf") {
    if (file.size > PDF_MAX_BYTES) {
      return { ok: false, error: "PDF больше 20MB. Сократите размер файла." };
    }
    return { ok: true, type: "pdf" };
  }

  if (SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    if (file.size > IMAGE_MAX_BYTES) {
      return { ok: false, error: "Изображение больше 8MB. Сократите размер файла." };
    }
    return { ok: true, type: "image" };
  }

  return {
    ok: false,
    error: "Разрешены только PNG/JPEG/WebP и PDF файлы.",
  };
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("FILE_READ_FAILED"));
    reader.readAsDataURL(file);
  });
}

async function loadPdfModule() {
  if (!pdfModulePromise) {
    pdfModulePromise = import(
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.min.mjs"
    );
  }
  return pdfModulePromise;
}

export async function extractPdfText(file, maxChars = 50000) {
  try {
    const pdfjs = await loadPdfModule();
    pdfjs.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.worker.min.mjs";
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    const pageCount = pdf.numPages;
    let text = "";

    for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const strings = content.items.map((item) => item.str);
      text += `${strings.join(" ")}\n`;
      if (text.length >= maxChars) break;
    }

    const trimmed = text.trim().slice(0, maxChars);
    return { text: trimmed, pageCount, truncated: text.length > maxChars };
  } catch (error) {
    return { text: "", pageCount: null, error };
  }
}
