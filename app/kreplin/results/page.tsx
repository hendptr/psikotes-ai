'use client';

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ResultGraph, { type GraphDatum } from "@/components/kreplin/result-graph";

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
  const useLocal = searchParams.get("local") === "1";

  const [result, setResult] = useState<KreplinResult | null>(null);
  const [history, setHistory] = useState<KreplinResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        if (useLocal) {
          const cached = typeof window !== "undefined"
            ? sessionStorage.getItem("kreplinFallbackResult")
            : null;
          if (!cached) {
            setError("Tidak ada hasil lokal ditemukan.");
          } else {
            setResult(JSON.parse(cached));
          }
        } else if (resultId) {
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
        setLoading(false);
      }
    }
    void fetchData();
  }, [resultId, useLocal]);

  useEffect(() => {
    async function fetchHistory() {
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
    }
    void fetchHistory();
  }, []);

  useEffect(() => {
    if (!result && !useLocal && !resultId && history.length > 0) {
      setResult(history[0]);
    }
  }, [history, result, resultId, useLocal]);

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

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Memuat...</div>;
  }

  const handleDelete = async (id: string) => {
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
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push("/kreplin")}
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Mulai sesi baru
              </button>
              {result.id !== "local" && (
                <button
                  type="button"
                  onClick={() => handleDelete(result.id)}
                  className="rounded-full border border-rose-200 px-5 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:opacity-60"
                  disabled={deletingId === result.id}
                >
                  {deletingId === result.id ? "Menghapus..." : "Hapus hasil ini"}
                </button>
              )}
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
