'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";
import { API_BASE } from "@/lib/config";
import { useToast } from "@/components/toast-provider";

type JoinTestDuelCardProps = {
  className?: string;
};

export default function JoinTestDuelCard({ className }: JoinTestDuelCardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!roomCode.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/test-duels/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: roomCode.trim().toUpperCase() }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.sessionId || !payload?.duel?.id) {
        throw new Error(payload?.error ?? "Kode duel tidak ditemukan.");
      }
      router.push(
        `/test/${payload.sessionId}?duelId=${payload.duel.id}&role=guest&room=${payload.duel.roomCode}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal bergabung duel.";
      showToast(message, { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={[
        "rounded-3xl border border-slate-200 bg-white p-5 shadow-lg",
        className ?? "",
      ].join(" ")}
    >
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Masuk duel</p>
      <p className="mt-2 text-sm text-slate-600">Punya kode duel? Masukkan di sini.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="contoh: AB12CD"
          className="w-40 rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase tracking-wide focus:border-slate-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleJoin}
          disabled={loading}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Memproses..." : "Gabung"}
        </button>
      </div>
    </div>
  );
}
