'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import PdfViewer from "./pdf-viewer";

type BookReaderProps = {
  title: string;
  fileUrl: string;
  initialPage?: number;
  onPageChange?: (page: number, totalPages: number | null) => void;
  renderOverlay?: (info: { width: number; height: number }) => React.ReactNode;
};

export default function BookReader({
  title,
  fileUrl,
  initialPage = 1,
  onPageChange,
  renderOverlay,
}: BookReaderProps) {
  const [dualViewEnabled, setDualViewEnabled] = useState(false);
  const leftSeedRef = useRef(initialPage);
  const [rightSeed, setRightSeed] = useState(initialPage + 1);
  const latestLeftPageRef = useRef(initialPage);

  const handlePageChange = useCallback(
    (page: number, total: number | null) => {
      latestLeftPageRef.current = page;
      onPageChange?.(page, total);
    },
    [onPageChange]
  );

  useEffect(() => {
    if (dualViewEnabled) {
      setRightSeed(latestLeftPageRef.current + 1);
    }
  }, [dualViewEnabled]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Mode tampilan</p>
          <p>
            {dualViewEnabled
              ? "Aktif! Atur halaman berbeda di kiri dan kanan untuk membandingkan konten."
              : "Aktifkan tampilan ganda jika ingin membaca dua halaman sekaligus."}
          </p>
        </div>
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setDualViewEnabled((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-full border border-sky-200 px-4 py-2 font-semibold text-sky-700 transition hover:border-sky-300 hover:text-sky-900"
          >
            {dualViewEnabled ? "Matikan tampilan ganda" : "Aktifkan tampilan ganda"}
          </button>
        </div>
      </div>

      {dualViewEnabled ? (
        <div className="grid gap-6 items-start lg:grid-cols-2">
          <div className="min-w-0 rounded-3xl border border-slate-100 bg-white/70 p-2">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Panel kiri - mis. soal
            </p>
            <PdfViewer
              key="dual-left"
              title={`${title} (kiri)`}
              fileUrl={fileUrl}
              initialScale={1}
              initialPage={leftSeedRef.current}
              onPageChange={handlePageChange}
              renderOverlay={renderOverlay}
            />
          </div>
          <div className="min-w-0 rounded-3xl border border-slate-100 bg-white/70 p-2">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Panel kanan - mis. jawaban
            </p>
            <PdfViewer
              key={`dual-right-${rightSeed}`}
              title={`${title} (kanan)`}
              fileUrl={fileUrl}
              initialScale={1}
              initialPage={rightSeed}
            />
          </div>
        </div>
      ) : (
        <PdfViewer
          title={title}
          fileUrl={fileUrl}
          initialPage={leftSeedRef.current}
          onPageChange={handlePageChange}
          renderOverlay={renderOverlay}
        />
      )}
    </div>
  );
}
