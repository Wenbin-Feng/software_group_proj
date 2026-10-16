/// <reference types="vite/client" />

import { ChevronLeft, ChevronRight, FileWarning, LoaderCircle } from 'lucide-react';
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState } from 'react';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type PdfPreviewProps = { url: string; title: string };

export function PdfPreview(props: PdfPreviewProps) {
  const [attempt, setAttempt] = useState(0);
  return (
    <PdfDocumentPreview
      key={`${props.url}-${attempt}`}
      {...props}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}

function PdfDocumentPreview({ url, title, onRetry }: PdfPreviewProps & { onRetry: () => void }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageWidth, setPageWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      setPageWidth(Math.max(1, Math.floor(entry.contentRect.width)));
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | undefined;

    async function loadDocument() {
      try {
        task = getDocument({ url });
        const document = await task.promise;
        if (!cancelled) setPdf(document);
      } catch (reason) {
        if (cancelled) return;
        setLoading(false);
        setError(
          reason instanceof Error && reason.name === 'PasswordException'
            ? 'This PDF needs a password. Download it to open it in your PDF reader.'
            : 'This PDF could not be opened. Reselect the original file or download it to view it.',
        );
      }
    }

    void loadDocument();
    return () => {
      cancelled = true;
      // StrictMode and file changes can dispose a task before its worker has started.
      void task?.destroy().catch(() => {});
    };
  }, [url]);

  useEffect(() => {
    const container = pageRef.current;
    if (!pdf || !pageWidth || !container) return;
    let cancelled = false;
    let page: PDFPageProxy | undefined;
    let task: RenderTask | undefined;
    setLoading(true);
    setError('');

    const renderPage = async () => {
      try {
        page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const naturalSize = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: pageWidth / naturalSize.width });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        // Each task owns its canvas, so a cancelled render cannot paint over the next page.
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width * pixelRatio);
        canvas.height = Math.ceil(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `${title}, page ${pageNumber} of ${pdf.numPages}`);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas rendering is unavailable.');
        task = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        await task.promise;
        if (cancelled) return;
        container.replaceChildren(canvas);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setLoading(false);
        setError(
          'This page could not be displayed. Try reloading the preview or download the PDF.',
        );
      } finally {
        page?.cleanup();
      }
    };

    void renderPage();
    return () => {
      cancelled = true;
      task?.cancel();
      container.replaceChildren();
    };
  }, [pdf, pageNumber, pageWidth, title]);

  function changePage(offset: number) {
    setLoading(true);
    setError('');
    setPageNumber((current) => current + offset);
    viewportRef.current?.scrollTo({ top: 0 });
  }

  return (
    <div className="pdf-viewer" aria-label={`PDF preview of ${title}`}>
      <div className="pdf-navigation">
        <span aria-live="polite">
          {pdf ? `Page ${pageNumber} of ${pdf.numPages}` : 'PDF preview'}
        </span>
        <div>
          <button
            type="button"
            aria-label="Previous PDF page"
            disabled={!pdf || pageNumber <= 1}
            onClick={() => changePage(-1)}
          >
            <ChevronLeft size={15} />
            Previous
          </button>
          <button
            type="button"
            aria-label="Next PDF page"
            disabled={!pdf || pageNumber >= pdf.numPages}
            onClick={() => changePage(1)}
          >
            Next
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <div className="pdf-page-viewport" ref={viewportRef} aria-busy={loading}>
        <div className="pdf-rendered-page" ref={pageRef} />
        {loading && !error && (
          <div className="pdf-preview-message" role="status">
            <LoaderCircle size={24} className="pdf-loading-spinner" aria-hidden="true" />
            <p>{pdf ? `Rendering page ${pageNumber}…` : 'Loading your PDF…'}</p>
          </div>
        )}
        {error && (
          <div className="pdf-preview-message" role="alert">
            <FileWarning size={26} aria-hidden="true" />
            <p>{error}</p>
            <button className="button secondary" onClick={onRetry}>
              Reload preview
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
