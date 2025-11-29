'use client';

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type DuelParticipant = {
  userId: string | null;
  name: string | null;
  email: string | null;
  ready: boolean;
  resultId: string | null;
  totalCorrect: number | null;
  totalAnswered: number | null;
  accuracy: number | null;
};

type Duel = {
  id: string;
  roomCode: string;
  status: "waiting" | "ready" | "active" | "completed";
  mode: "auto";
  durationSeconds: number;
  host: DuelParticipant;
  guest: DuelParticipant | null;
  startedAt: string | null;
  endedAt: string | null;
};

type Role = "host" | "guest" | null;

export default function KreplinDuelPage() {
  const router = useRouter();
  const [duration, setDuration] = useState(600);
  const [roomCode, setRoomCode] = useState("");
  const [duel, setDuel] = useState<Duel | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const ready = useMemo(() => {
    if (!duel || !role) return false;
    return role === "host" ? duel.host.ready : Boolean(duel.guest?.ready);
  }, [duel, role]);

  const partner = useMemo(() => {
    if (!duel) return null;
    return role === "host" ? duel.guest : duel.host;
  }, [duel, role]);

  const persistRole = useCallback(
    (value: Role, duelId?: string) => {
      if (value && duelId) {
        sessionStorage.setItem(`kreplin-duel-role-${duelId}`, value);
      }
      setRole(value);
    },
    []
  );

  const restoreRole = useCallback((duelId?: string) => {
    if (!duelId) return null;
    const stored = sessionStorage.getItem(`kreplin-duel-role-${duelId}`) as Role | null;
    if (stored === "host" || stored === "guest") {
      setRole(stored);
      return stored;
    }
    return null;
  }, []);

  const fetchDuel = useCallback(
    async (duelId: string) => {
      try {
        const response = await fetch(`/api/kreplin-duels/${duelId}`);
        if (!response.ok) {
          throw new Error("Gagal memuat duel.");
        }
        const json = await response.json();
        setDuel(json.duel as Duel);
        if (!role) {
          restoreRole(json.duel?.id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat duel.");
      }
    },
    [restoreRole, role]
  );

  useEffect(() => {
    if (!duel?.id) return undefined;
    const interval = setInterval(() => {
      void fetchDuel(duel.id);
    }, 2000);
    return () => clearInterval(interval);
  }, [duel?.id, fetchDuel]);

  useEffect(() => {
    if (!duel || !duel.startedAt || !role) return;
    const startAtMs = new Date(duel.startedAt).getTime();
    router.replace(
      `/kreplin/test?mode=auto&duration=${duel.durationSeconds}&duelId=${duel.id}&role=${role}&startAt=${startAtMs}`
    );
  }, [duel, role, router]);

  const createDuel = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch("/api/kreplin-duels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds: duration }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Gagal membuat duel.");
      }
      const json = await response.json();
      setDuel(json.duel as Duel);
      persistRole("host", json.duel?.id);
      setInfo("Bagikan kode ke temanmu untuk mulai duel.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat duel.");
    } finally {
      setLoading(false);
    }
  };

  const joinDuel = async () => {
    if (!roomCode.trim()) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch("/api/kreplin-duels/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: roomCode.trim().toUpperCase() }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Gagal bergabung duel.");
      }
      const json = await response.json();
      setDuel(json.duel as Duel);
      persistRole("guest", json.duel?.id);
      setInfo("Berhasil bergabung. Tandai siap untuk memulai.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal bergabung duel.");
    } finally {
      setLoading(false);
    }
  };

  const toggleReady = async (next: boolean) => {
    if (!duel) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/kreplin-duels/${duel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ready: next }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Gagal memperbarui status.");
      }
      const json = await response.json();
      setDuel(json.duel as Duel);
      if (json.duel?.id) {
        persistRole(role, json.duel.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui status.");
    } finally {
      setLoading(false);
    }
  };

  const duelStatusLabel = duel
    ? duel.status === "waiting"
      ? "Menunggu lawan"
      : duel.status === "ready"
        ? "Siap mulai"
        : duel.status === "active"
          ? "Sedang berjalan"
          : "Selesai"
    : "Belum ada duel";

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Kreplin Duel</p>
            <h1 className="text-3xl font-semibold text-slate-900">1 vs 1, sinkron waktu</h1>
            <p className="text-sm text-slate-600">
              Buat ruang, bagikan kode, keduanya klik siap. Timer akan mulai bersamaan dan hasil akan tersimpan.
            </p>
          </div>
          <Link
            href="/kreplin"
            className="text-sm font-semibold text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
          >
            Kembali ke Tes Kreplin
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Buat duel</p>
            <div className="mt-3 flex items-center gap-3">
              <label className="text-sm text-slate-700">
                Durasi (menit)
                <input
                  type="number"
                  min={2}
                  max={60}
                  value={Math.round(duration / 60)}
                  onChange={(e) => setDuration(Math.min(3600, Math.max(120, Number(e.target.value) * 60)))}
                  className="ml-2 w-20 rounded-xl border border-slate-200 px-3 py-2 text-center text-sm focus:border-slate-400 focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={createDuel}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Memproses..." : "Buat duel"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Mode duel hanya memakai mode otomatis (angka terakhir penjumlahan).
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Gabung dengan kode</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="contoh: AB12CD"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-40 rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase tracking-wide focus:border-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={joinDuel}
                className="rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Memproses..." : "Gabung"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Gunakan kode dari teman yang membuat duel.</p>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        {info && !error && (
          <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {info}
          </p>
        )}
      </section>

      {duel && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Ruang duel</p>
              <h2 className="text-2xl font-semibold text-slate-900">Kode: {duel.roomCode}</h2>
              <p className="text-sm text-slate-600">
                Status: {duelStatusLabel} - Durasi {Math.round(duel.durationSeconds / 60)} menit
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(duel.roomCode)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Salin kode
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Muat ulang
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Kamu ({role ?? "?"})</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {role === "host" ? duel.host.name ?? "Host" : duel.guest?.name ?? "Kamu"}
              </p>
              <p className="text-xs text-slate-500">{role === "host" ? duel.host.email : duel.guest?.email}</p>
              <p className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-slate-700">
                {ready ? "Siap" : "Belum siap"}
              </p>
              <button
                type="button"
                onClick={() => toggleReady(!ready)}
                className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                disabled={loading}
              >
                {ready ? "Batal siap" : "Tandai siap"}
              </button>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Lawan</p>
              {partner?.userId ? (
                <>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {partner.name ?? "Peserta"}
                  </p>
                  <p className="text-xs text-slate-500">{partner.email}</p>
                  <p className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-slate-700">
                    {partner.ready ? "Siap" : "Belum siap"}
                  </p>
                </>
              ) : (
                <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  Menunggu lawan bergabung dengan kode di atas.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Saat kedua peserta menekan "Tandai siap", duel akan dimulai otomatis dan layar dialihkan ke tes dengan timer sinkron.
          </div>
        </section>
      )}
    </div>
  );
}
