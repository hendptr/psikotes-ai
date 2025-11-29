'use client';

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ResultGraph, { type GraphDatum } from "@/components/kreplin/result-graph";
import {
  getOfflineKreplinQueue,
  removeOfflineKreplinResult,
  syncOfflineKreplinResults,
  type OfflineKreplinResult,
} from "@/lib/kreplin-offline";

type SectionStat = { index: number; correct: number; total: number };
type SpeedBucket = { index: number; correct: number; total: number };

type KreplinResult = {
  id: string;
  createdAt: string;
  mode: string;
  durationSeconds: number;
  totalSections: number | null;
  totalAnswered: number;
  totalCorrect: number;
  totalIncorrect: number;
  accuracy: number;
  perSectionStats: SectionStat[];
  speedTimeline: SpeedBucket[];
};

export default function KreplinResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resultId = searchParams.get("resultId");
  const localParam = searchParams.get("local");
  const offlineId = localParam && localParam !== "1" ? localParam : null;
  const hasLocalFlag = Boolean(localParam);

  const [result, setResult] = useState<KreplinResult | null>(null);
  const [history, setHistory] = useState<KreplinResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<OfflineKreplinResult[]>([]);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      try {
        setError(null);
        const offlineEntries =
          typeof window !== "undefined" ? getOfflineKreplinQueue() : [];
        if (!mounted) return;
        setOfflineQueue(offlineEntries);

        if (offlineId) {
          const targeted = offlineEntries.find((item) => item.id === offlineId);
          if (targeted) {
            setResult(targeted as KreplinResult);
            return;
          }
        }

        if (hasLocalFlag && !resultId) {
          const cached =
            offlineEntries[0] ??
            (typeof window !== "undefined"
              ? JSON.parse(sessionStorage.getItem("kreplinFallbackResult") ?? "null")
              : null);
          if (!cached) {
            setError("Tidak ada hasil lokal ditemukan.");
          } else {
            setResult(cached as KreplinResult);
          }
          return;
        }

        if (resultId) {
          const response = await fetch(`/api/kreplin-results/${resultId}`);
          if (!response.ok) {
            throw new Error("Gagal memuat hasil.");
          }
          const json = await response.json();
          setResult(json.result);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat hasil.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    setLoading(true);
    void fetchData();
    return () => {
      mounted = false;
    };
  }, [resultId, hasLocalFlag, offlineId]);

  const reloadHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/kreplin-results");
      if (!response.ok) {
        throw new Error("Gagal memuat riwayat.");
      }
      const json = await response.json();
      setHistory(json.results ?? []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    void reloadHistory();
  }, [reloadHistory]);

  useEffect(() => {
    if (!result && !hasLocalFlag && !resultId && history.length > 0) {
      setResult(history[0]);
    }
  }, [history, result, resultId, hasLocalFlag]);

  const syncOfflineQueue = useCallback(async () => {
    setActionError(null);
    setSyncMessage(null);

    const currentQueue = typeof window !== "undefined" ? getOfflineKreplinQueue() : [];
    setOfflineQueue(currentQueue);
    if (currentQueue.length === 0) {
      return;
    }

    setSyncingOffline(true);
    try {
      const { synced, remaining } = await syncOfflineKreplinResults();
      setOfflineQueue(remaining);

      if (synced.length === 0) {
        if (remaining.length > 0) {
          setActionError("Belum bisa mengunggah hasil offline. Pastikan koneksi internet dan status login masih aktif.");
        }
        return;
      }

      await reloadHistory();
      const currentOfflineId =
        result && result.id.startsWith("offline-") ? result.id : null;
      const matched = currentOfflineId
        ? synced.find((item) => item.offlineId === currentOfflineId)
        : null;
      if (matched?.serverId) {
        router.replace(`/kreplin/results?resultId=${matched.serverId}`);
      }
      setSyncMessage(`${synced.length} hasil offline berhasil diunggah.`);
    } catch (err) {
      setActionError("Gagal mengunggah hasil offline. Coba lagi setelah koneksi stabil.");
    } finally {
      setSyncingOffline(false);
    }
  }, [reloadHistory, result, router]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleOnline = () => {
      void syncOfflineQueue();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncOfflineQueue]);

  useEffect(() => {
    if (offlineQueue.length === 0) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    void syncOfflineQueue();
  }, [offlineQueue.length, syncOfflineQueue]);

  const sectionData: GraphDatum[] =
    result?.perSectionStats?.map((item) => ({
      label: `Kolom ${item.index}`,
      value: item.correct,
    })) ?? [];

  const speedData: GraphDatum[] =
    result?.speedTimeline?.map((item) => ({
      label: `Menit ${item.index + 1}`,
      value: item.correct,
    })) ?? [];

  const historyGraphData: GraphDatum[] = history
    .slice()
    .reverse()
    .map((item, idx) => ({
      label: `#${history.length - idx}`,
      value: Number(item.accuracy.toFixed(1)),
    }));

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  const isOfflineResult = Boolean(result?.id?.startsWith("offline-"));

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Memuat...</div>;
  }

  const handleDelete = async (id: string) => {
    if (offlineQueue.some((item) => item.id === id)) {
      setDeletingId(id);
      const updatedQueue = removeOfflineKreplinResult(id);
      setOfflineQueue(updatedQueue);
      if (result?.id === id) {
        const nextResult = updatedQueue[0] ?? history[0] ?? null;
        setResult(nextResult);
        if (nextResult) {
          const isOfflineResult = nextResult.id.startsWith("offline-");
          router.replace(
            isOfflineResult ? `/kreplin/results?local=${nextResult.id}` : `/kreplin/results?resultId=${nextResult.id}`
          );
        } else {
          router.replace("/kreplin/results");
        }
      }
      setDeletingId(null);
      return;
    }

    if (id === "local") {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("kreplinFallbackResult");
      }
      setResult(null);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      router.replace("/kreplin/results");
      return;
    }

    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Hapus hasil ini dari riwayat?");
      if (!confirmed) {
        return;
      }
    }

    setDeletingId(id);
    setActionError(null);
    try {
      const response = await fetch(`/api/kreplin-results/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Gagal menghapus hasil.");
      }

      setHistory((prev) => {
        const updated = prev.filter((item) => item.id !== id);
        if (result?.id === id) {
          const nextResult = updated[0] ?? null;
          setResult(nextResult);
          if (nextResult) {
            router.replace(`/kreplin/results?resultId=${nextResult.id}`);
          } else {
            router.replace("/kreplin/results");
          }
        }
        return updated;
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal menghapus hasil.");
    } finally {
      setDeletingId(null);
    }
  };

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-sm text-rose-600">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/kreplin")}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
        >
          Kembali ke Tes Koran
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {offlineQueue.length > 0 && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-700">Unggahan tertunda</p>
              <p className="text-sm text-amber-800">
                {offlineQueue.length} hasil Tes Kreplin disimpan di perangkat. Akan diunggah otomatis saat koneksi kembali.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push(`/kreplin/results?local=${offlineQueue[0].id}`)}
                className="rounded-full border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
              >
                Lihat terbaru
              </button>
              <button
                type="button"
                onClick={() => syncOfflineQueue()}
                className="rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:opacity-60"
                disabled={syncingOffline}
              >
                {syncingOffline ? "Mengunggah..." : "Unggah sekarang"}
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {offlineQueue.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/70 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-amber-900">{formatDate(item.createdAt)}</p>
                  <p className="text-xs text-amber-700">
                    Mode {item.mode} - {Math.round(item.durationSeconds / 60)} menit - {item.totalCorrect}/{item.totalAnswered} benar
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                    onClick={() => router.push(`/kreplin/results?local=${item.id}`)}
                  >
                    Buka
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {syncMessage && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {syncMessage}
        </p>
      )}

      {result ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Hasil terbaru</p>
              <h1 className="text-3xl font-semibold text-slate-900">
                Mode {result.mode === "tryout" ? "Try Out" : "Latihan"} -{" "}
                {Math.round(result.durationSeconds / 60)} menit
              </h1>
              <p className="text-sm text-slate-500">{formatDate(result.createdAt)}</p>
              {isOfflineResult && (
                <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  Belum tersinkron - tersimpan lokal
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push("/kreplin")}
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Mulai sesi baru
              </button>
              {isOfflineResult ? (
                <>
                  <button
                    type="button"
                    onClick={() => syncOfflineQueue()}
                    className="rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
                    disabled={syncingOffline}
                  >
                    {syncingOffline ? "Mengunggah..." : "Unggah hasil"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(result.id)}
                    className="rounded-full border border-rose-200 px-5 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:opacity-60"
                    disabled={deletingId === result.id}
                  >
                    {deletingId === result.id ? "Menghapus..." : "Hapus offline"}
                  </button>
                </>
              ) : result.id !== "local" ? (
                <button
                  type="button"
                  onClick={() => handleDelete(result.id)}
                  className="rounded-full border border-rose-200 px-5 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:opacity-60"
                  disabled={deletingId === result.id}
                >
                  {deletingId === result.id ? "Menghapus..." : "Hapus hasil ini"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Akurasi</p>
              <p className="mt-2 text-4xl font-semibold text-slate-900">
                {result.accuracy.toFixed(1)}%
              </p>
            </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Benar</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-600">
                {result.totalCorrect}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Salah</p>
              <p className="mt-2 text-3xl font-semibold text-rose-600">
                {result.totalIncorrect}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Total soal</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {result.totalAnswered}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <p className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Pilih salah satu hasil Tes Koran untuk melihat detailnya.
        </p>
      )}

      {result && sectionData.length > 0 && (
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Analitik kolom</p>
            <h2 className="text-xl font-semibold text-slate-900">Jumlah benar per kolom</h2>
          </div>
          <ResultGraph data={sectionData} barLabel="Jawaban Benar" />
        </section>
      )}

      {result && speedData.length > 0 && (
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Kecepatan</p>
            <h2 className="text-xl font-semibold text-slate-900">Jawaban benar per menit</h2>
            <p className="text-sm text-slate-500">
              Membantu melihat konsistensi ritme selama sesi berlangsung.
            </p>
          </div>
          <ResultGraph data={speedData} barLabel="Benar / menit" />
        </section>
      )}

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        {actionError && (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {actionError}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Riwayat</p>
            <h2 className="text-xl font-semibold text-slate-900">Perkembangan akurasi</h2>
          </div>
          <button
            type="button"
            onClick={() => router.push("/kreplin/test?mode=tryout")}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
          >
            Tes lagi
          </button>
        </div>
        {history.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Belum ada riwayat tersimpan.
          </p>
        ) : (
          <>
            {historyGraphData.length > 0 && (
              <ResultGraph data={historyGraphData} barLabel="Akurasi (%)" />
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.3em] text-slate-400">
                    <th className="py-3 pr-4">Tanggal</th>
                    <th className="py-3 pr-4">Mode</th>
                    <th className="py-3 pr-4">Durasi</th>
                    <th className="py-3 pr-4">Akurasi</th>
                    <th className="py-3 pr-4">Jawaban</th>
                    <th className="py-3 pr-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {history.map((item) => (
                    <tr
                      key={item.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => router.push(`/kreplin/results?resultId=${item.id}`)}
                    >
                      <td className="py-3 pr-4">{formatDate(item.createdAt)}</td>
                      <td className="py-3 pr-4 capitalize">{item.mode}</td>
                      <td className="py-3 pr-4">{Math.round(item.durationSeconds / 60)} menit</td>
                      <td className="py-3 pr-4 font-semibold text-slate-900">
                        {item.accuracy.toFixed(1)}%
                      </td>
                      <td className="py-3 pr-4">
                        {item.totalCorrect}/{item.totalAnswered}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-60"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(item.id);
                          }}
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id ? "..." : "Hapus"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
