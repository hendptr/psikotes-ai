"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type StoredQuestion = {
  questionType: string;
  questionText: string;
  options: Array<{ label: string; text: string }>;
  correctOptionLabel: string;
  explanation: string;
};

type StoredAnswer = {
  selected: string | null;
  isCorrect: boolean | null;
  timeSpent: number;
  autoAdvance?: boolean;
};

type StoredSession = {
  sessionId: string;
  questions: StoredQuestion[];
  answers: Record<number, StoredAnswer>;
  currentIndex: number;
  completed: boolean;
  config: {
    userType: string;
    category: string;
    difficulty: string;
    count: number;
    customTimeSeconds?: number | null;
  };
  startedAt: number;
  updatedAt: number;
};

type FetchState = "idle" | "loading" | "error";
const API_SESSION_ENDPOINT = "/winnieloveuu/api/session";

function formatTimestamp(timestamp: number) {
  try {
    return new Date(timestamp).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "Tanggal tidak diketahui";
  }
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) {
    return "Default mode";
  }
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const secs = rounded % 60;
  if (minutes && secs) {
    return `${minutes} menit ${secs} detik`;
  }
  if (minutes) {
    return `${minutes} menit`;
  }
  return `${secs} detik`;
}

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [state, setState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const response = await fetch(API_SESSION_ENDPOINT, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as { sessions?: StoredSession[]; error?: string };
      if (!response.ok) {
        throw new Error(payload?.error || "Gagal memuat daftar sesi.");
      }
      const data = Array.isArray(payload.sessions) ? payload.sessions : [];
      setSessions(data);
      if (!data.length) {
        setExpanded(null);
      }
      setState("idle");
    } catch (err: unknown) {
      setState("error");
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleDelete = async (sessionId: string) => {
    const confirmDelete = window.confirm(
      "Yakin mau hapus sesi ini? Semua soal dan progresnya bakal hilang."
    );
    if (!confirmDelete) return;

    try {
      const response = await fetch(`${API_SESSION_ENDPOINT}/${sessionId}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload?.error || "Gagal menghapus sesi.");
      }
      setSessions((prev) => prev.filter((item) => item.sessionId !== sessionId));
      if (expanded === sessionId) {
        setExpanded(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menghapus sesi.");
    }
  };

  const handleReview = (sessionId: string) => {
    router.push(`/test?sessionId=${sessionId}`);
  };

  const totalQuestions = useMemo(
    () => sessions.reduce((sum, session) => sum + (Array.isArray(session.questions) ? session.questions.length : 0), 0),
    [sessions]
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Arsip Sesi</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Sesi latihan tersimpan</h1>
            <p className="mt-2 text-sm text-slate-600">
              Lihat kembali soal yang pernah digenerate. Kamu bisa review tanpa regenerasi AI.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadSessions()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-900 hover:text-slate-900"
            >
              Segarkan daftar
            </button>
            <div className="rounded-2xl bg-slate-900 px-4 py-3 text-right text-white">
              <p className="text-xs uppercase tracking-wide text-white/70">Total soal tersimpan</p>
              <p className="text-lg font-semibold">{totalQuestions}</p>
            </div>
          </div>
        </div>
        {state === "loading" && <p className="mt-4 text-sm text-slate-500">Memuat sesi...</p>}
        {state === "error" && error && <p className="mt-4 text-sm text-rose-500">{error}</p>}
        {state !== "loading" && sessions.length === 0 && (
          <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            Belum ada sesi tersimpan. Mulai latihan dulu, nanti arsipnya muncul di sini.
          </p>
        )}
      </section>

      {sessions.length > 0 && (
        <section className="space-y-4">
          {sessions.map((session) => {
            const questions = Array.isArray(session.questions) ? session.questions : [];
            const isExpanded = expanded === session.sessionId;
            const questionCount = questions.length;
            const answeredCount = Object.values(session.answers ?? {}).filter((answer) => !!answer?.selected).length;

            return (
              <article
                key={session.sessionId}
                className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm transition hover:border-slate-300"
              >
                <header className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1 text-sm text-slate-600">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Session ID</p>
                    <p className="font-semibold text-slate-900">{session.sessionId}</p>
                    <p>
                      {session.config.category} • {session.config.difficulty} • {questionCount} soal
                    </p>
                    <p>
                      Mode: <span className="font-semibold capitalize">{session.config.userType}</span> • Timer:{" "}
                      <span className="font-semibold">{formatDuration(session.config.customTimeSeconds)}</span>
                    </p>
                    <p>
                      Terakhir diperbarui: {formatTimestamp(session.updatedAt)} • Mulai:{" "}
                      {formatTimestamp(session.startedAt)}
                    </p>
                    <p>
                      Progres: {answeredCount}/{questionCount} terjawab • Status:{" "}
                      <span className={session.completed ? "text-emerald-600" : "text-slate-500"}>
                        {session.completed ? "Selesai" : "Belum selesai"}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => handleReview(session.sessionId)}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800"
                    >
                      Review di halaman test
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : session.sessionId)}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 font-semibold text-slate-600 transition hover:border-slate-900 hover:text-slate-900"
                    >
                      {isExpanded ? "Sembunyikan detail" : "Lihat detail soal"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(session.sessionId)}
                      className="inline-flex items-center justify-center rounded-full border border-rose-200 px-4 py-2 font-semibold text-rose-500 transition hover:border-rose-400 hover:text-rose-600"
                    >
                      Hapus dari arsip
                    </button>
                  </div>
                </header>

                {isExpanded && (
                  <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    {questions.map((question, index) => {
                      const answer = session.answers?.[index];
                      const status =
                        answer?.isCorrect === true
                          ? "border-emerald-300 bg-white"
                          : answer?.selected
                          ? "border-rose-300 bg-white"
                          : "border-slate-200 bg-white";

                      return (
                        <div
                          key={index}
                          className={`space-y-3 rounded-2xl border px-4 py-3 text-sm text-slate-700 ${status}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs uppercase tracking-wide text-slate-400">
                              Soal {index + 1} • {question.questionType}
                            </p>
                            <p className="text-xs text-slate-500">
                              Jawaban kamu:{" "}
                              <span className="font-semibold">{answer?.selected ?? "Belum dijawab"}</span>{" "}
                              • Kunci:{" "}
                              <span className="font-semibold text-slate-900">{question.correctOptionLabel}</span>
                            </p>
                          </div>
                          <div className="prose prose-sm max-w-none text-slate-700">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {question.questionText}
                            </ReactMarkdown>
                          </div>
                          <div className="grid gap-2">
                            {question.options.map((option) => (
                              <div
                                key={option.label}
                                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                                  option.label === question.correctOptionLabel
                                    ? "border-emerald-300 bg-emerald-50"
                                    : "border-slate-200 bg-white"
                                }`}
                              >
                                <span className="font-semibold text-slate-900">{option.label}.</span>
                                <span>{option.text}</span>
                              </div>
                            ))}
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                            <p className="font-semibold text-slate-900">Pembahasan</p>
                            <div className="prose prose-sm max-w-none text-slate-700">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {question.explanation}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
