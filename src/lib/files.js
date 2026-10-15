export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_FILES = ".pdf,.txt,.md,.markdown";

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function readMaterialFile(file) {
  if (!file.size)
    throw new Error(
      "This file is empty. Please choose a file with readable content.",
    );
  if (file.size > MAX_UPLOAD_BYTES)
    throw new Error(
      "This file exceeds the 10 MB limit. Please choose a smaller file.",
    );
  const extension = file.name.split(".").pop().toLowerCase();
  if (!["pdf", "txt", "md", "markdown"].includes(extension))
    throw new Error("Please choose a PDF, Markdown or plain text file.");
  let pages;
  if (extension === "pdf") {
    const [{ getDocument, GlobalWorkerOptions }, { default: workerUrl }] =
      await Promise.all([
        import("pdfjs-dist/legacy/build/pdf.mjs"),
        import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
      ]);
    GlobalWorkerOptions.workerSrc = workerUrl;
    let loadingTask;
    try {
      loadingTask = getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        isEvalSupported: false,
      });
      const document = await loadingTask.promise;
      pages = [];
      for (
        let pageNumber = 1;
        pageNumber <= document.numPages;
        pageNumber += 1
      ) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) =>
            item.str ? `${item.str}${item.hasEOL ? "\n" : " "}` : "",
          )
          .join("")
          .trim();
        pages.push({ page: pageNumber, text });
        page.cleanup();
      }
    } catch (error) {
      if (error.name === "PasswordException")
        throw new Error(
          "This PDF is password protected. Please upload an unlocked copy.",
        );
      throw new Error(
        "This PDF could not be read. Try another PDF or export it as a text-based PDF.",
      );
    } finally {
      if (loadingTask) await loadingTask.destroy();
    }
  } else {
    const text = (await file.text()).replace(/\u0000/g, "").trim();
    pages = [{ page: 1, text }];
  }
  const text = pages
    .map((page) => page.text)
    .join("\n\n")
    .trim();
  if (text.replace(/\s/g, "").length < 5)
    throw new Error(
      "No readable text was found. Scanned or image-only PDFs need OCR before upload; this prototype does not run OCR.",
    );
  return {
    name: file.name,
    type: extension === "markdown" ? "md" : extension,
    size: file.size,
    pages,
    text,
  };
}
