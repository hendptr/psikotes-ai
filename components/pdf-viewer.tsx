'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

const WORKER_SRC = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

if (typeof window !== "undefined" && pdfjs.GlobalWorkerOptions.workerSrc !== WORKER_SRC) {
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
}

type PdfViewerProps = {
  fileUrl: string;
  title: string;
  initialScale?: number;
  initialPage?: number;
  onPageChange?: (page: number, totalPages: number | null) => void;
  renderOverlay?: (info: { width: number; height: number }) => React.ReactNode;
};

export default function PdfViewer({
  fileUrl,
  title,
  initialScale = 1.2,
  initialPage = 1,
  onPageChange,
  renderOverlay,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [pendingPage, setPendingPage] = useState(initialPage);
  const [scale, setScale] = useState(initialScale);
  const [error, setError] = useState<string | null>(null);
  const disablePrev = pageNumber <= 1;
  const disableNext = numPages !== null && pageNumber >= numPages;
  const sliderDisabled = !numPages || numPages <= 1;

  const zoomLevels = useMemo(() => ({ min: 0.8, max: 2.2, step: 0.2 }), []);
  const documentFile = useMemo(() => ({ url: fileUrl }), [fileUrl]);
  const pageWrapperRef = useRef<HTMLDivElement | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    setScale(initialScale);
  }, [initialScale]);

  useEffect(() => {
    setPageNumber(initialPage);
    setPendingPage(initialPage);
  }, [initialPage]);

  useEffect(() => {
    onPageChange?.(pageNumber, numPages);
  }, [pageNumber, numPages, onPageChange]);

  const setPageWrapperNode = useCallback((node: HTMLDivElement | null) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (node) {
      pageWrapperRef.current = node;
      const rect = node.getBoundingClientRect();
      if (rect.width && rect.height) {
        setPageSize({ width: rect.width, height: rect.height });
      }
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          setPageSize({ width: entry.contentRect.width, height: entry.contentRect.height });
        }
      });
      observer.observe(node);
      resizeObserverRef.current = observer;
    } else {
      pageWrapperRef.current = null;
    }
  }, []);

  const clampPage = useCallback(
    (value: number) => {
      const max = numPages ?? Number.POSITIVE_INFINITY;
      return Math.min(Math.max(1, value), max);
    },
    [numPages]
  );

  const commitPendingPage = useCallback(() => {
    setPendingPage((current) => {
      const next = clampPage(current);
      setPageNumber((prev) => (prev === next ? prev : next));
      return next;
    });
  }, [clampPage]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600">
        <span className="text-xs uppercase tracking-[0.25em] text-slate-400">Navigasi</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disablePrev}
            onClick={() =>
              setPageNumber((prev) => {
                const next = Math.max(1, prev - 1);
                setPendingPage(next);
                return next;
              })
            }
            className="rounded-full border border-slate-200 px-3 py-1 transition hover:border-slate-300 disabled:opacity-50"
          >
            Prev
          </button>
          <span className="font-semibold text-slate-800">
            {pageNumber}/{numPages ?? "?"}
          </span>
          <button
            type="button"
            disabled={disableNext}
            onClick={() =>
              setPageNumber((prev) => {
                const next = numPages ? Math.min(numPages, prev + 1) : prev + 1;
                setPendingPage(next);
                return next;
              })
            }
            className="rounded-full border border-slate-200 px-3 py-1 transition hover:border-slate-300 disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <div className="flex-1 min-w-[200px] px-4">
          <input
            type="range"
            min={1}
            max={numPages ?? 1}
            value={pendingPage}
            disabled={sliderDisabled}
            onChange={(event) => setPendingPage(Number(event.target.value))}
            onPointerUp={commitPendingPage}
            onTouchEnd={commitPendingPage}
            onBlur={commitPendingPage}
            className="w-full accent-sky-500"
          />
          <p className="mt-1 text-[11px] font-semibold text-slate-400">
            {sliderDisabled
              ? "Menunggu buku selesai dimuat..."
              : `Halaman ${pendingPage} dari ${numPages}`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScale((value) => Math.max(zoomLevels.min, value - zoomLevels.step))}
            className="rounded-full border border-slate-200 px-3 py-1 transition hover:border-slate-300 disabled:opacity-50"
            disabled={scale <= zoomLevels.min}
          >
            -
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={() => setScale((value) => Math.min(zoomLevels.max, value + zoomLevels.step))}
            className="rounded-full border border-slate-200 px-3 py-1 transition hover:border-slate-300 disabled:opacity-50"
            disabled={scale >= zoomLevels.max}
          >
            +
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-inner overflow-auto">
        {error ? (
          <p className="text-sm font-semibold text-rose-500">{error}</p>
        ) : (
          <Document
            file={documentFile}
            loading={<p className="text-sm text-slate-500">Memuat buku...</p>}
            onLoadError={(err) => {
              console.error("PDF viewer error:", err);
              setError("Gagal memuat PDF. Coba unduh lalu buka manual.");
            }}
            onLoadSuccess={({ numPages: totalPages }) => {
              setNumPages(totalPages);
              setError(null);
              setPageNumber((prev) => {
                const next = Math.min(prev, totalPages);
                setPendingPage(next);
                return next;
              });
            }}
          >
            <div ref={setPageWrapperNode} className="relative mx-auto inline-block drop-shadow-lg transition duration-200">
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                loading={<p className="text-sm text-slate-500">Menyiapkan halaman...</p>}
              />
              {renderOverlay && pageSize.width > 0 && pageSize.height > 0 ? (
                <div className="absolute inset-0">
                  {renderOverlay({ width: pageSize.width, height: pageSize.height })}
                </div>
              ) : null}
            </div>
          </Document>
        )}
      </div>

      <a
        href={fileUrl}
        download
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
      >
        Unduh PDF&nbsp;
        <span className="text-slate-900">&ldquo;{title}&rdquo;</span>
      </a>
    </div>
  );
}
