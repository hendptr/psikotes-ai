'use client';

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastVariant = "info" | "success" | "error";

type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (message: string, options?: { variant?: ToastVariant; durationMs?: number }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, options?: { variant?: ToastVariant; durationMs?: number }) => {
      const id = generateId();
      const toast: Toast = {
        id,
        message,
        variant: options?.variant ?? "info",
      };
      setToasts((prev) => [...prev, toast]);
      const duration = options?.durationMs ?? 4000;
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, duration);
    },
    []
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg transition ${
              toast.variant === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : toast.variant === "error"
                ? "border-rose-200 bg-rose-50 text-rose-600"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
