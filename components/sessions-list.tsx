'use client';

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/config";

type SessionItem = {
  id: string;
  userType: string;
  category: string;
  difficulty: string;
  questionCount: number;
  customDurationSeconds: number | null;
  startedAt: string;
  completedAt: string | null;
  score: number | null;
  totalAnswered: number;
  totalCorrect: number;
  isPublic: boolean;
  publicId: string | null;
  isDraft: boolean;
  draftSavedAt: string | null;
  draftQuestionIndex: number | null;
};

type SessionsListProps = {
  initialSessions: SessionItem[];
};

const MODE_LABELS: Record<string, string> = {
  santai: "Santai",
  serius: "Serius",
  simulasi: "Simulasi",
};

const CATEGORY_LABELS: Record<string, string> = {
  mixed: "Campuran Variatif",
  padanan_kata: "Padanan Kata",
  sinonim_antonim: "Sinonim & Antonim",
  hafalan_kata: "Hafalan Kata",
  deret_matematika: "Deret Matematika",
  perbandingan_senilai_berbalik: "Perbandingan Senilai & Berbalik Nilai",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  mudah: "Mudah",
  sedang: "Sedang",
  sulit: "Sulit",
};

const MODE_DEFAULT_SECONDS: Record<string, number> = {
  santai: 45,
  serius: 30,
  simulasi: 25,
};

function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch (error) {
    return "Tanggal tidak diketahui";
  }
}

function formatSeconds(seconds: number | null) {
  if (seconds == null) return "-";
  if (seconds < 60) return `${seconds} detik/soal`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) return `${minutes} menit/soal`;
  return `${minutes} menit ${secs} detik/soal`;
}

function formatPercentage(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(1)}%`;
}

export default function SessionsList({ initialSessions }: SessionsListProps) {
  const [sessions, setSessions] = useState<SessionItem[]>(initialSessions);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [retakeId, setRetakeId] = useState<string | null>(null);
  const [visibilityId, setVisibilityId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const summary = useMemo(() => {
    const totals = sessions.reduce(
      (acc, session) => {
        acc.questions += session.questionCount;
        acc.answered += session.totalAnswered;
        acc.correct += session.totalCorrect;
        return acc;
      },
      { questions: 0, answered: 0, correct: 0 }
    );

    return {
      totalSessions: sessions.length,
      totalQuestions: totals.questions,
      averageAccuracy: totals.answered > 0 ? (totals.correct / totals.answered) * 100 : 0,
    };
  }, [sessions]);

  async function handleDelete(sessionId: string) {
    if (!window.confirm("Hapus sesi ini beserta seluruh data jawabannya?")) {
      return;
    }

    setError(null);
    setDeleteId(sessionId);
    try {
      const response = await fetch(`${API_BASE}/test-sessions/${sessionId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Gagal menghapus sesi.");
      }
      setSessions((prev) => prev.filter((session) => session.id !== sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus sesi.");
    } finally {
      setDeleteId(null);
    }
  }

  async function handleRetake(session: SessionItem) {
    setError(null);
    setRetakeId(session.id);
    try {
      const response = await fetch(`${API_BASE}/test-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userType: session.userType,
          category: session.category,
          difficulty: session.difficulty,
          count: session.questionCount,
          customDurationSeconds: session.customDurationSeconds,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.sessionId) {
        throw new Error(payload?.error ?? "Gagal membuat sesi baru.");
      }
      router.push(`/test/${payload.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengulang sesi.");
    } finally {
      setRetakeId(null);
    }
  }

  async function handleVisibility(session: SessionItem, publish: boolean) {
    setError(null);
    setVisibilityId(session.id);
    try {
      const response = await fetch(`${API_BASE}/test-sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: publish ? "publish" : "unpublish" }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Gagal memperbarui status publikasi.");
      }
      setSessions((prev) =>
        prev.map((item) =>
          item.id === session.id
            ? {
                ...item,
                isPublic: publish,
                publicId: publish ? (payload?.publicId ?? item.publicId) : null,
              }
            : item
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui publikasi.");
    } finally {
      setVisibilityId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </p>
      )}

      {sessions.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 shadow-lg">
          Belum ada sesi tersimpan. Mulai latihan baru dan arsipnya akan muncul di sini.
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <SummaryCard title="Total sesi" value={`${summary.totalSessions}`} />
            <SummaryCard title="Total soal" value={`${summary.totalQuestions}`} />
            <SummaryCard title="Rata-rata akurasi" value={formatPercentage(summary.averageAccuracy)} />
          </div>

          <div className="grid gap-4">
            {sessions.map((session) => {
              const accuracy =
                session.totalAnswered > 0
                  ? (session.totalCorrect / session.totalAnswered) * 100
                  : session.score ?? 0;
              const timerSeconds =
                session.customDurationSeconds ?? MODE_DEFAULT_SECONDS[session.userType] ?? null;
              const timerLabel = formatSeconds(timerSeconds);
              const timerBadge = session.customDurationSeconds ? "Timer custom" : "Timer standar";
              const isDraft = session.isDraft && !session.completedAt;
              const draftSavedLabel =
                isDraft && session.draftSavedAt
                  ? formatDateTime(session.draftSavedAt)
                  : null;
              const openLabel = isDraft ? "Lanjutkan draft" : "Buka sesi";

              return (
                <article
                  key={session.id}
                  className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-lg"
                >
                  <div className="flex-1 space-y-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      {formatDateTime(session.startedAt)}
                    </p>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {CATEGORY_LABELS[session.category] ?? session.category} - {
                        DIFFICULTY_LABELS[session.difficulty] ?? session.difficulty
                      }
                    </h2>
                    <p className="text-xs text-slate-500">
                      Mode {MODE_LABELS[session.userType] ?? session.userType} - {session.questionCount} soal
                    </p>
                    <p className="text-xs text-slate-500">
                      {timerBadge}: <span className="font-semibold text-slate-700">{timerLabel}</span>
                    </p>
                    {session.isPublic && (
                      <span className="inline-flex items-center rounded-full bg-slate-900/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-700">
                        Publik
                      </span>
                    )}
                    {isDraft && (
                      <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
                        Draft tersimpan
                      </span>
                    )}
                    {draftSavedLabel && (
                      <p className="text-xs text-slate-500">Disimpan: {draftSavedLabel}</p>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>ID sesi: {session.id}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/test/${session.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
                      >
                        {openLabel}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleRetake(session)}
                        disabled={retakeId === session.id || isDraft}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:opacity-60"
                      >
                        {retakeId === session.id ? "Mempersiapkan..." : "Retake"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVisibility(session, !session.isPublic)}
                        disabled={visibilityId === session.id}
                        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 disabled:opacity-60 ${
                          session.isPublic
                            ? "border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900"
                            : "border-slate-900 text-slate-900 hover:border-slate-900 hover:bg-slate-900 hover:text-white"
                        }`}
                      >
                        {visibilityId === session.id
                          ? "Memperbarui..."
                          : session.isPublic
                          ? "Batalkan publikasi"
                          : "Publikasikan"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(session.id)}
                        disabled={deleteId === session.id}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2 font-semibold text-rose-600 transition hover:border-rose-400 hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:opacity-60"
                      >
                        {deleteId === session.id ? "Menghapus..." : "Hapus"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

