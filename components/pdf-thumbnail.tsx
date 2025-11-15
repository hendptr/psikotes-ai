'use client';

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

const WORKER_SRC = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

if (typeof window !== "undefined" && pdfjs.GlobalWorkerOptions.workerSrc !== WORKER_SRC) {
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
}

type PdfThumbnailProps = {
  fileUrl: string;
  title: string;
  className?: string;
};

export default function PdfThumbnail({ fileUrl, title, className }: PdfThumbnailProps) {
  const [errored, setErrored] = useState(false);

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
      <Document
        file={fileUrl}
        loading={
          <div className="text-xs font-medium text-slate-500">Menyiapkan cover...</div>
        }
        onLoadError={(error) => {
          console.error("Thumbnail load error:", error);
          setErrored(true);
        }}
      >
        <Page
          pageNumber={1}
          width={220}
          renderAnnotationLayer={false}
          renderTextLayer={false}
          className="drop-shadow-md"
        />
      </Document>
    </div>
  );
}
