'use client';

import { useEffect, useMemo, useState } from "react";
import { pdfjs } from "react-pdf";
import { API_BASE } from "@/lib/config";

const WORKER_SRC = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

if (typeof window !== "undefined" && pdfjs.GlobalWorkerOptions.workerSrc !== WORKER_SRC) {
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
}

const CACHE_PREFIX = "pdf-cover:";

type PdfThumbnailProps = {
  bookId: string;
  fileUrl: string;
  title: string;
  className?: string;
  coverUrl?: string;
};

export default function PdfThumbnail({ bookId, fileUrl, title, className, coverUrl }: PdfThumbnailProps) {
  const cacheKey = useMemo(() => `${CACHE_PREFIX}${fileUrl}`, [fileUrl]);
  const [localCoverUrl, setLocalCoverUrl] = useState<string | null>(coverUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (coverUrl) {
      setLocalCoverUrl(coverUrl);
    }
  }, [coverUrl]);

  useEffect(() => {
    if (coverUrl) {
      return;
    }

    let cancelled = false;
    let task: ReturnType<typeof pdfjs.getDocument> | null = null;

    function readCache(): string | null {
      try {
        return localStorage.getItem(cacheKey);
      } catch {
        return null;
      }
    }

    const cached = typeof window !== "undefined" ? readCache() : null;
    if (cached) {
      setLocalCoverUrl(cached);
      return () => {};
    }

    async function renderCover() {
      try {
        task = pdfjs.getDocument(fileUrl);
        const pdf = await task.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.4 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Canvas context unavailable");
        }
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport, canvas }).promise;
        const dataUrl = canvas.toDataURL("image/png");
        if (!cancelled) {
          setLocalCoverUrl(dataUrl);
          try {
            localStorage.setItem(cacheKey, dataUrl);
          } catch {
            // ignore quota errors
          }
          if (!saving) {
            setSaving(true);
            fetch(`${API_BASE}/books/${bookId}/cover`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ dataUrl }),
            })
              .catch(() => {})
              .finally(() => {
                setSaving(false);
              });
          }
        }
      } catch (error) {
        console.error("Thumbnail load error:", error);
        if (!cancelled) {
          setErrored(true);
        }
      }
    }

    renderCover();
    return () => {
      cancelled = true;
      task?.destroy();
    };
  }, [API_BASE, bookId, cacheKey, coverUrl, fileUrl, saving]);

  if (errored) {
    return (
      <div
        className={`flex h-64 w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-xs font-medium text-slate-500 ${
          className ?? ""
        }`}
      >
        Preview tidak tersedia
      </div>
    );
  }

  return (
    <div
      className={`flex h-64 w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-slate-50 shadow-inner ${
        className ?? ""
      }`}
      aria-label={`Preview halaman pertama ${title}`}
    >
      {localCoverUrl ? (
        <img
          src={localCoverUrl}
          alt={`Cover ${title}`}
          className="h-full max-h-64 w-auto object-contain drop-shadow-md"
        />
      ) : (
        <div className="text-xs font-medium text-slate-500">Menyiapkan cover...</div>
      )}
    </div>
  );
}
