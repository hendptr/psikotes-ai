'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";
import { API_BASE } from "@/lib/config";
import { useToast } from "@/components/toast-provider";

type StartPublicDuelButtonProps = {
  publicId: string;
  className?: string;
};

export default function StartPublicDuelButton({ publicId, className }: StartPublicDuelButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function handleStart() {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/test-duels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "public", publicId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.sessionId || !payload?.duel?.id) {
        throw new Error(payload?.error ?? "Tidak dapat membuat duel.");
      }
      showToast(`Kode duel: ${payload.duel.roomCode}`, { variant: "success" });
      router.push(`/test/${payload.sessionId}?duelId=${payload.duel.id}&role=host&room=${payload.duel.roomCode}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal membuat duel.";
      showToast(message, { variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  const classes = [
    "inline-flex",
    "items-center",
    "justify-center",
    "rounded-full",
    "border",
    "border-emerald-200",
    "bg-emerald-50",
    "px-4",
    "py-2",
    "text-sm",
    "font-semibold",
    "text-emerald-700",
    "transition",
    "hover:border-emerald-300",
    "hover:bg-emerald-100",
    "disabled:opacity-60",
    "focus-visible:outline",
    "focus-visible:outline-2",
    "focus-visible:outline-offset-2",
    "focus-visible:outline-emerald-400",
  ];

  if (className) {
    classes.push(className);
  }

  return (
    <button
      type="button"
      onClick={handleStart}
      disabled={loading}
      className={classes.join(" ")}
    >
      {loading ? "Menyiapkan duel..." : "Duelkan sesi ini"}
    </button>
  );
}
