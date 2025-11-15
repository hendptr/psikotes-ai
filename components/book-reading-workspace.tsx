'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import { useToast } from "@/components/toast-provider";
import BookReader from "./book-reader";
import BookProgressPanel from "./book-progress-panel";
import BookAnnotationLayer, { AnnotationStroke } from "./book-annotation-layer";

type ProgressState = {
  status: "not_started" | "reading" | "completed";
  lastPage: number;
  note: string;
  updatedAt?: string;
};

type BookReadingWorkspaceProps = {
  bookId: string;
  title: string;
  fileUrl: string;
  initialProgress: ProgressState | null;
  initialAnnotations?: Record<number, AnnotationStroke[]>;
};

const DEFAULT_PROGRESS: ProgressState = {
  status: "not_started",
  lastPage: 1,
  note: "",
};

export default function BookReadingWorkspace({
  bookId,
  title,
  fileUrl,
  initialProgress,
  initialAnnotations = {},
}: BookReadingWorkspaceProps) {
  const { showToast } = useToast();
  const [progress, setProgress] = useState<ProgressState>(initialProgress ?? DEFAULT_PROGRESS);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [pendingAutoSave, setPendingAutoSave] = useState(false);
  const [strokes, setStrokes] = useState<Record<number, AnnotationStroke[]>>(initialAnnotations);
  const [activePage, setActivePage] = useState(initialProgress?.lastPage ?? 1);

  const autoSaveTimeout = useRef<number | null>(null);
  const annotationTimeout = useRef<number | null>(null);
  const latestProgressRef = useRef(progress);
  const latestAnnotationRef = useRef<{ page: number; strokes: AnnotationStroke[] }>({
    page: activePage,
    strokes: initialAnnotations[activePage] ?? [],
  });

  useEffect(() => {
    latestProgressRef.current = progress;
  }, [progress]);

  const sendBeaconProgress = useCallback(
    (snapshot: ProgressState) => {
      try {
        const payload = JSON.stringify({
          status: snapshot.status,
          lastPage: snapshot.lastPage,
          note: snapshot.note,
        });
        const url = `${API_BASE}/books/${bookId}/progress`;
        if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
          navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
        } else {
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch (error) {
        console.error("Beacon progress error:", error);
      }
    },
    [API_BASE, bookId]
  );

  const persistProgress = useCallback(
    async (next: ProgressState, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (silent) {
        setAutoSaving(true);
      } else {
        setSaving(true);
      }
      try {
        const response = await fetch(`${API_BASE}/books/${bookId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          if (!silent) {
            showToast(payload?.error ?? "Gagal menyimpan progres.", { variant: "error" });
          }
          return;
        }
        if (payload?.progress) {
          setProgress((prev) => ({
            ...prev,
            ...payload.progress,
            updatedAt: payload.progress.updatedAt ?? prev.updatedAt,
          }));
        }
        if (!silent) {
          showToast("Progres buku disimpan.", { variant: "success" });
        }
      } catch (error) {
        console.error("Persist progress error:", error);
        if (!silent) {
          showToast("Terjadi kesalahan jaringan.", { variant: "error" });
        }
      } finally {
        if (silent) {
          setAutoSaving(false);
        } else {
          setSaving(false);
        }
      }
    },
    [API_BASE, bookId, showToast]
  );

  useEffect(() => {
    if (!pendingAutoSave) return;
    if (autoSaveTimeout.current) {
      window.clearTimeout(autoSaveTimeout.current);
    }
    autoSaveTimeout.current = window.setTimeout(() => {
      setPendingAutoSave(false);
      persistProgress(latestProgressRef.current, { silent: true });
    }, 1500);
    return () => {
      if (autoSaveTimeout.current) {
        window.clearTimeout(autoSaveTimeout.current);
        autoSaveTimeout.current = null;
      }
    };
  }, [pendingAutoSave, persistProgress]);

  const handleManualSave = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      persistProgress(progress, { silent: false });
    },
    [persistProgress, progress]
  );

  const handleProgressChange = useCallback((value: ProgressState) => {
    setProgress(value);
    setPendingAutoSave(true);
  }, []);

  const currentStrokes = useMemo(() => strokes[activePage] ?? [], [activePage, strokes]);

  useEffect(() => {
    latestAnnotationRef.current = { page: activePage, strokes: currentStrokes };
  }, [activePage, currentStrokes]);

  const saveAnnotations = useCallback(
    async (page: number, strokesForPage: AnnotationStroke[], options?: { silent?: boolean }) => {
      const silent = options?.silent ?? true;
      try {
        const response = await fetch(`${API_BASE}/books/${bookId}/annotations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page, strokes: strokesForPage }),
          keepalive: true,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          if (!silent) {
            showToast(payload?.error ?? "Gagal menyimpan coretan.", { variant: "error" });
          }
          return;
        }
        if (!silent) {
          showToast("Coretan tersimpan.", { variant: "success" });
        }
      } catch (error) {
        console.error("Save annotations error:", error);
        if (!silent) {
          showToast("Terjadi kesalahan saat menyimpan coretan.", { variant: "error" });
        }
      }
    },
    [API_BASE, bookId, showToast]
  );

  const flushAnnotations = useCallback(() => {
    const { page, strokes } = latestAnnotationRef.current;
    if (strokes.length) {
      saveAnnotations(page, strokes, { silent: true });
    }
  }, [saveAnnotations]);

  const handlePageChange = useCallback(
    (page: number, total: number | null) => {
      if (annotationTimeout.current) {
        window.clearTimeout(annotationTimeout.current);
        annotationTimeout.current = null;
      }
      flushAnnotations();
      setActivePage(page);
      setProgress((prev) => {
        let nextStatus = prev.status;
        if (total && page >= total) {
          nextStatus = "completed";
        } else if (page > prev.lastPage && prev.status === "not_started") {
          nextStatus = "reading";
        }
        const next = { ...prev, lastPage: page, status: nextStatus };
        persistProgress(next, { silent: true });
        return next;
      });
    },
    [flushAnnotations, persistProgress]
  );

  const initialPage = useMemo(() => progress.lastPage ?? 1, [progress.lastPage]);

  const handleAnnotationChange = useCallback(
    (updated: AnnotationStroke[]) => {
      setStrokes((prev) => ({ ...prev, [activePage]: updated }));
    },
    [activePage]
  );

  const handleAnnotationSave = useCallback(async () => {
    await saveAnnotations(activePage, currentStrokes, { silent: false });
  }, [activePage, currentStrokes, saveAnnotations]);

  useEffect(() => {
    async function loadAnnotations(page: number) {
      try {
        const response = await fetch(`${API_BASE}/books/${bookId}/annotations?page=${page}`);
        const payload = await response.json().catch(() => null);
        if (response.ok && payload?.annotation?.strokes) {
          setStrokes((prev) => ({ ...prev, [page]: payload.annotation.strokes }));
        }
      } catch (error) {
        console.error("Load annotations error:", error);
      }
    }
    if (!strokes[activePage]) {
      loadAnnotations(activePage);
    }
  }, [API_BASE, activePage, bookId]);

  useEffect(() => {
    if (annotationTimeout.current) {
      window.clearTimeout(annotationTimeout.current);
    }
    annotationTimeout.current = window.setTimeout(() => {
      saveAnnotations(activePage, currentStrokes, { silent: true });
    }, 1500);
    return () => {
      if (annotationTimeout.current) {
        window.clearTimeout(annotationTimeout.current);
        annotationTimeout.current = null;
      }
    };
  }, [activePage, currentStrokes, saveAnnotations]);

  useEffect(() => {
    return () => {
      if (annotationTimeout.current) {
        window.clearTimeout(annotationTimeout.current);
        annotationTimeout.current = null;
      }
      flushAnnotations();
    };
  }, [flushAnnotations]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (autoSaveTimeout.current) {
        window.clearTimeout(autoSaveTimeout.current);
        autoSaveTimeout.current = null;
      }
      if (annotationTimeout.current) {
        window.clearTimeout(annotationTimeout.current);
        annotationTimeout.current = null;
      }
      sendBeaconProgress(latestProgressRef.current);
      flushAnnotations();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      sendBeaconProgress(latestProgressRef.current);
      flushAnnotations();
    };
  }, [flushAnnotations, sendBeaconProgress]);

  return (
    <div className="space-y-6">
      <BookReader
        fileUrl={fileUrl}
        title={title}
        initialPage={initialPage}
        onPageChange={handlePageChange}
        renderOverlay={({ width, height }) => (
          <BookAnnotationLayer
            width={width}
            height={height}
            strokes={currentStrokes}
            onChange={handleAnnotationChange}
            onSave={handleAnnotationSave}
          />
        )}
      />
      <BookProgressPanel
        value={progress}
        onChange={handleProgressChange}
        onSubmit={handleManualSave}
        saving={saving}
        autoSaving={autoSaving}
      />
    </div>
  );
}
