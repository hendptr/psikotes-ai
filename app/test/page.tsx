"use client";

export const dynamic = "force-dynamic";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import confetti from "canvas-confetti";
import type { Components } from "react-markdown";
import type { HTMLAttributes, ReactNode } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

type QuestionOption = {
  label: string;
  text: string;
};

type PsychotestQuestion = {
  category: string;
  difficulty: string;
  questionType: string;
  questionText: string;
  options: QuestionOption[];
  correctOptionLabel: string;
  explanation: string;
};

type AnswerState = {
  selected: string | null;
  isCorrect: boolean | null;
  timeSpent: number;
  autoAdvance?: boolean;
};

type SessionConfig = {
  userType: string;
  category: string;
  difficulty: string;
  count: number;
};

type GenerateQuestionsResponse = {
  sessionId: string;
  questions: PsychotestQuestion[];
  progress: {
    answers: Record<number, AnswerState>;
    currentIndex: number;
    completed: boolean;
  };
  config: SessionConfig;
  source: "resume" | "cache" | "fresh";
};

type CodeComponentProps = {
  inline?: boolean;
  className?: string;
  children?: ReactNode;
} & HTMLAttributes<HTMLElement>;

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-3 whitespace-pre-wrap leading-relaxed text-slate-700 last:mb-0">
      {children}
    </p>
  ),
  strong: ({ children }) => <span className="font-semibold text-slate-900">{children}</span>,
  em: ({ children }) => <em className="text-slate-700 italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="mb-3 ml-4 list-disc space-y-1 text-slate-700 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-4 list-decimal space-y-1 text-slate-700 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-slate-200 pl-3 text-slate-600">
      {children}
    </blockquote>
  ),
  code: ({ inline, children, className, ...props }: CodeComponentProps) =>
    inline ? (
      <code
        className={`rounded bg-slate-100 px-1.5 py-0.5 text-[13px] text-slate-700 ${className ?? ""}`}
        {...props}
      >
        {children}
      </code>
    ) : (
      <pre
        className={`mb-3 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-700 last:mb-0 ${className ?? ""}`}
        {...props}
      >
        <code>{children}</code>
      </pre>
    ),
};

const TIMER_RULES: Record<string, number> = {
  santai: 45,
  serius: 30,
  simulasi: 25,
  tantangan: 15,
};

const PIE_COLORS = ["#10b981", "#f97316", "#6b7280"];

function getTimerForMode(mode: string) {
  return TIMER_RULES[mode] ?? 30;
}

function buildAnalysis(
  questions: PsychotestQuestion[],
  answers: Record<number, AnswerState>
) {
  if (!questions.length) {
    return { insights: [], message: "Belum ada data yang bisa dianalisis." };
  }

  const summary = new Map<string, { total: number; correct: number; skipped: number }>();

  questions.forEach((question, index) => {
    const snapshot = answers[index];
    const data = summary.get(question.category) ?? {
      total: 0,
      correct: 0,
      skipped: 0,
    };
    data.total += 1;
    if (snapshot?.isCorrect) data.correct += 1;
    if (!snapshot?.selected) data.skipped += 1;
    summary.set(question.category, data);
  });

  const insights = Array.from(summary.entries())
    .map(([category, stat]) => ({
      category,
      accuracy: stat.total ? stat.correct / stat.total : 0,
      skipped: stat.skipped,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  const weakest = insights[0];
  let message = "Terus latihan untuk meningkatkan konsistensi pada semua kategori.";
  if (weakest) {
    if (weakest.accuracy < 0.4) {
      message = `Kategori "${weakest.category}" membutuhkan sesi tambahan.`;
    } else if (weakest.accuracy < 0.7) {
      message = `Kategori "${weakest.category}" sudah cukup baik, pertahankan ritmenya.`;
    }
  }

  return { insights, message };
}

function formatSeconds(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `00:${String(safe).padStart(2, "0")}`;
}

// The main component logic is moved into TestView
function TestView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialConfig: SessionConfig = {
    userType: searchParams.get("userType") ?? "serius",
    category: searchParams.get("category") ?? "mixed",
    difficulty: searchParams.get("difficulty") ?? "sulit",
    count: Number(searchParams.get("count") ?? 20),
  };

  const resumeParam = searchParams.get("sessionId");
  const requestConfigRef = useRef<SessionConfig>(initialConfig);

  const [sessionConfig, setSessionConfig] = useState<SessionConfig>(initialConfig);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [resumeSession, setResumeSession] = useState<string | null>(resumeParam);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PsychotestQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"test" | "results">("test");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    getTimerForMode(initialConfig.userType)
  );
  const [reloadToken, setReloadToken] = useState<number>(0);
  const [, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [openExplanation, setOpenExplanation] = useState<number | null>(null);

  const timeoutHandledRef = useRef<boolean>(false);
  const geniusCelebratedRef = useRef<boolean>(false);

  const total = questions.length;
  const answeredCount = useMemo(
    () => Object.keys(answers).length,
    [answers]
  );
  const correctCount = useMemo(
    () => Object.values(answers).filter((entry) => entry?.isCorrect).length,
    [answers]
  );
  const wrongCount = useMemo(
    () =>
      Object.values(answers).filter(
        (entry) => entry && entry.isCorrect === false && entry.selected
      ).length,
    [answers]
  );
  const skippedCount = Math.max(0, answeredCount - correctCount - wrongCount);

  const answeredPercentage = total ? Math.round((answeredCount / total) * 100) : 0;
  const currentProgress = total ? Math.round(((currentIndex + 1) / total) * 100) : 0;
  const accuracy = answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0;
  const allAnswered = total > 0 && answeredCount === total;

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentIndex];

  const pieData = useMemo(
    () =>
      [
        { name: "Benar", value: correctCount, fill: PIE_COLORS[0] },
        { name: "Salah", value: wrongCount, fill: PIE_COLORS[1] },
        { name: "Lewat", value: skippedCount, fill: PIE_COLORS[2] },
      ].filter((item) => item.value > 0),
    [correctCount, wrongCount, skippedCount]
  );

  const analysis = useMemo(
    () => buildAnalysis(questions, answers),
    [questions, answers]
  );

  useEffect(() => {
    timeoutHandledRef.current = false;
    if (viewMode === "test") {
      setSecondsRemaining(getTimerForMode(sessionConfig.userType));
    }
  }, [currentIndex, sessionConfig.userType, viewMode]);

  useEffect(() => {
    let active = true;

    async function fetchQuestions() {
      setLoading(true);
      setError(null);

      try {
        const payload: Record<string, unknown> = {
          ...requestConfigRef.current,
          count: requestConfigRef.current.count,
        };

        if (resumeSession) {
          payload.sessionId = resumeSession;
        }

        const res = await fetch("/winnieloveuu/api/generate-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Gagal memuat soal.");
        }

        const data = (await res.json()) as GenerateQuestionsResponse;
        if (!active) return;

        setSessionId(data.sessionId);
        setQuestions(data.questions);
        setAnswers(data.progress?.answers ?? {});
        setCurrentIndex(data.progress?.currentIndex ?? 0);
        setSessionConfig(data.config);
        requestConfigRef.current = data.config;
        setViewMode(data.progress?.completed ? "results" : "test");
        setSecondsRemaining(getTimerForMode(data.config.userType));
        timeoutHandledRef.current = false;
        geniusCelebratedRef.current = false;

        if (resumeSession && typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          params.delete("sessionId");
          const query = params.toString();
          router.replace(query ? `/test?${query}` : "/test", { scroll: false });
        }
        setResumeSession(null);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Terjadi kesalahan." );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchQuestions();
    return () => {
      active = false;
    };
  }, [reloadToken, resumeSession, router]);

  useEffect(() => {
    if (
      viewMode === "results" &&
      sessionConfig.userType === "tantangan" &&
      accuracy >= 90 &&
      !geniusCelebratedRef.current
    ) {
      geniusCelebratedRef.current = true;
      confetti({ particleCount: 200, spread: 70, origin: { y: 0.25 }, scalar: 1.05 });
    }
  }, [accuracy, sessionConfig.userType, viewMode]);

  useEffect(() => {
    if (viewMode !== "test" || loading || !questions.length) {
      return;
    }

    const interval = window.setInterval(() => {
      setSecondsRemaining((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [loading, questions.length, viewMode]);

  const timerRatio =
    getTimerForMode(sessionConfig.userType) > 0
      ? Math.max(0, secondsRemaining / getTimerForMode(sessionConfig.userType))
      : 0;

  const persistProgress = useCallback(
    async (payload: {
      answers: Record<number, AnswerState>;
      currentIndex?: number;
      completed?: boolean;
    }) => {
      if (!sessionId) return;
      try {
        await fetch(`/api/session/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: payload.answers,
            currentIndex: payload.currentIndex,
            completed: payload.completed,
          }),
        });
      } catch (err) {
        console.error("Gagal menyimpan progres:", err);
      }
    },
    [sessionId]
  );

  const handleTimeout = useCallback(() => {
    if (!currentQuestion) return;
    if (answers[currentIndex]) return;

    const nextAnswers = {
      ...answers,
      [currentIndex]: {
        selected: null,
        isCorrect: false,
        timeSpent: getTimerForMode(sessionConfig.userType),
        autoAdvance: true,
      },
    };

    const completed = Object.keys(nextAnswers).length === total;
    const nextIndex = currentIndex < total - 1 ? currentIndex + 1 : currentIndex;

    setAnswers(nextAnswers);
    if (currentIndex < total - 1) {
      setCurrentIndex(nextIndex);
    }

    void persistProgress({
      answers: nextAnswers,
      currentIndex: nextIndex,
      completed,
    });

    if (completed) {
      setViewMode("results");
    }
  }, [
    answers,
    currentIndex,
    currentQuestion,
    persistProgress,
    sessionConfig.userType,
    total,
  ]);

  useEffect(() => {
    if (
      viewMode === "test" &&
      !loading &&
      secondsRemaining === 0 &&
      !timeoutHandledRef.current
    ) {
      timeoutHandledRef.current = true;
      handleTimeout();
    }
  }, [handleTimeout, loading, secondsRemaining, viewMode]);

  const handleSelect = useCallback(
    (label: string) => {
      if (viewMode !== "test" || !currentQuestion || answers[currentIndex]) {
        return;
      }

      const isCorrect = label === currentQuestion.correctOptionLabel;
      const timeSpent = getTimerForMode(sessionConfig.userType) - secondsRemaining;
      const nextAnswers = {
        ...answers,
        [currentIndex]: {
          selected: label,
          isCorrect,
          timeSpent: Math.max(0, timeSpent),
        },
      };

      setAnswers(nextAnswers);
      setFeedback(isCorrect ? "correct" : "wrong");

      if (isCorrect) {
        confetti({ particleCount: 120, spread: 60, origin: { y: 0.4 } });
      }

      const completed = Object.keys(nextAnswers).length === total;
      const nextIndex = currentIndex < total - 1 ? currentIndex + 1 : currentIndex;

      void persistProgress({
        answers: nextAnswers,
        currentIndex: nextIndex,
        completed,
      });

      if (currentIndex < total - 1) {
        window.setTimeout(() => {
          setCurrentIndex((prev) => (prev < total - 1 ? prev + 1 : prev));
        }, 360);
      } else if (completed) {
        setViewMode("results");
      }
    },
    [
      answers,
      currentIndex,
      currentQuestion,
      persistProgress,
      secondsRemaining,
      sessionConfig.userType,
      total,
      viewMode,
    ]
  );

  const goNext = useCallback(() => {
    if (currentIndex >= total - 1) return;
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    void persistProgress({ answers, currentIndex: nextIndex, completed: allAnswered });
  }, [allAnswered, answers, currentIndex, persistProgress, total]);

  const goPrev = useCallback(() => {
    if (currentIndex <= 0) return;
    const prevIndex = currentIndex - 1;
    setCurrentIndex(prevIndex);
    void persistProgress({ answers, currentIndex: prevIndex, completed: allAnswered });
  }, [allAnswered, answers, currentIndex, persistProgress]);

  const handleSubmit = useCallback(() => {
    if (!allAnswered) return;
    setViewMode("results");
    void persistProgress({ answers, currentIndex, completed: true });
  }, [allAnswered, answers, currentIndex, persistProgress]);

  const handleReplay = useCallback(() => {
    setViewMode("test");
    setAnswers({});
    setCurrentIndex(0);
    setSessionId(null);
    setOpenExplanation(null);
    geniusCelebratedRef.current = false;
    setReloadToken((prev) => prev + 1);
  }, []);

  const handleCopySessionId = useCallback(() => {
    if (!sessionId || typeof navigator === "undefined") return;
    navigator.clipboard.writeText(sessionId).catch(() => {
      console.warn("Gagal menyalin Session ID.");
    });
  }, [sessionId]);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-5xl items-center justify-center px-5">
        <div className="rounded-3xl bg-white px-6 py-6 text-sm text-slate-500 shadow-sm">
          Menyiapkan soal ....
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-5xl items-center justify-center px-5">
        <div className="space-y-4 rounded-3xl bg-white px-6 py-6 shadow-sm">
          <p className="text-sm text-rose-500">{error}</p>
          <button
            type="button"
            onClick={() => setReloadToken((prev) => prev + 1)}
            className="inline-flex items-center justify-center rounded-full border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white"
          >
            Coba muat ulang soal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10">
      <header className="rounded-3xl bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.32em] text-slate-400">
              {sessionConfig.userType === "tantangan"
                ? "Mode Sprint"
                : sessionConfig.userType === "simulasi"
                ? "Simulasi Tes"
                : sessionConfig.userType === "santai"
                ? "Tempo Santai"
                : "Fokus Stabil"}
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">
              {viewMode === "results" ? "Rekap latihan" : "Sesi latihan sedang berjalan"}
            </h1>
            <p className="text-sm text-slate-500">
              {sessionConfig.category} • {sessionConfig.difficulty} • {sessionConfig.count} soal
            </p>
            {sessionId && (
              <button
                type="button"
                onClick={handleCopySessionId}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-900 hover:text-slate-900"
              >
                Session ID: <span className="text-slate-900">{sessionId.slice(0, 8)}…</span>
              </button>
            )}
          </div>
          <div className="grid gap-3 text-xs text-slate-500 sm:grid-cols-3">
            <SummaryCell title="Terjawab" value={`${answeredCount}/${total || 0}`} />
            <SummaryCell title="Akurasi" value={`${accuracy}%`} />
            <SummaryCell title="Progress" value={`${answeredPercentage}%`} />
          </div>
        </div>
      </header>

      {viewMode === "results" ? (
        <ResultsView
          accuracy={accuracy}
          answers={answers}
          analysis={analysis}
          pieData={pieData}
          questions={questions}
          onReplay={handleReplay}
          onBackHome={() => router.push("/")}
          openExplanation={openExplanation}
          setOpenExplanation={setOpenExplanation}
        />
      ) : currentQuestion ? (
        <>
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
            <article className="rounded-3xl bg-white px-6 py-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-500">
                  Soal {currentIndex + 1}
                </div>
                {currentAnswer && (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      currentAnswer.isCorrect
                        ? "bg-emerald-50 text-emerald-600"
                        : currentAnswer.selected
                        ? "bg-rose-50 text-rose-600"
                        : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {currentAnswer.isCorrect
                      ? "Benar"
                      : currentAnswer.selected
                      ? "Kurang tepat"
                      : "Lewat"}
                  </span>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {currentQuestion.questionText}
                </ReactMarkdown>
              </div>

              <div className="mt-4 space-y-3">
                {currentQuestion.options.map((option) => {
                  const answered = Boolean(currentAnswer);
                  const isSelected = answered && currentAnswer?.selected === option.label;
                  const isCorrectOption =
                    answered && option.label === currentQuestion.correctOptionLabel;
                  const isWrongSelection = isSelected && currentAnswer?.isCorrect === false;

                  let variant = "border-slate-200 bg-white hover:border-slate-400";
                  if (isCorrectOption) {
                    variant = "border-emerald-200 bg-emerald-50 text-emerald-700";
                  } else if (isWrongSelection) {
                    variant = "border-rose-200 bg-rose-50 text-rose-600";
                  } else if (isSelected) {
                    variant = "border-slate-900 bg-slate-900 text-white";
                  } else if (answered) {
                    variant = "border-slate-200 bg-slate-50 text-slate-400";
                  }

                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => handleSelect(option.label)}
                      disabled={answered}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left text-sm transition focus:outline-none ${variant}`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold">
                        {option.label}
                      </span>
                      <span className="leading-relaxed">{option.text}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Progress soal {currentProgress}% • Timer tersisa {formatSeconds(secondsRemaining)}
                </span>
                <div className="flex flex-wrap gap-2 text-sm font-semibold">
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={currentIndex === 0}
                    className="rounded-full border border-slate-300 px-4 py-2 text-slate-600 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Sebelumnya
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!allAnswered}
                    className="rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Selesai
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={currentIndex >= total - 1}
                    className="rounded-full border border-slate-300 px-4 py-2 text-slate-600 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            </article>

            <aside className="space-y-4">
              <div className="rounded-3xl bg-white px-5 py-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">Timer &amp; progres</h3>
                <div className="mt-3 space-y-2 text-xs text-slate-500">
                  <div className="flex justify-between">
                    <span>Tersisa</span>
                    <span className="font-semibold text-slate-900">
                      {formatSeconds(secondsRemaining)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-900 transition-all"
                      style={{ width: `${Math.max(6, timerRatio * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-white px-5 py-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">Navigasi soal</h3>
                <div className="mt-3 grid grid-cols-6 gap-2 text-xs">
                  {questions.map((_item, index) => {
                    const state = answers[index];
                    const isCurrent = index === currentIndex;
                    const classes = state
                      ? state.isCorrect
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : state.selected
                        ? "border-rose-200 bg-rose-50 text-rose-600"
                        : "border-amber-200 bg-amber-50 text-amber-600"
                      : "border-slate-200 bg-white text-slate-500";

                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setCurrentIndex(index)}
                        className={`flex h-9 w-full items-center justify-center rounded-xl border text-xs font-semibold transition hover:border-slate-900 hover:text-slate-900 ${classes} ${
                          isCurrent ? "ring-2 ring-slate-900" : ""
                        }`}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl bg-white px-5 py-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">Ringkasan cepat</h3>
                <ul className="mt-3 space-y-2 text-xs text-slate-500">
                  <li>• Terjawab benar: {correctCount}</li>
                  <li>• Terjawab salah: {wrongCount}</li>
                  <li>• Dilewati: {skippedCount}</li>
                </ul>
              </div>
            </aside>
          </section>
        </>
      ) : null}
    </div>
  );
}

// The page is now a wrapper that uses Suspense
export default function TestPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto flex min-h-[70vh] w-full max-w-5xl items-center justify-center px-5">
        <div className="rounded-3xl bg-white px-6 py-6 text-sm text-slate-500 shadow-sm">
          Menyiapkan sesi latihan...
        </div>
      </div>
    }>
      <TestView />
    </Suspense>
  );
}


type ResultsProps = {
  accuracy: number;
  answers: Record<number, AnswerState>;
  analysis: ReturnType<typeof buildAnalysis>;
  pieData: { name: string; value: number; fill: string }[];
  questions: PsychotestQuestion[];
  onReplay: () => void;
  onBackHome: () => void;
  openExplanation: number | null;
  setOpenExplanation: (index: number | null) => void;
};

function ResultsView({
  accuracy,
  answers,
  analysis,
  pieData,
  questions,
  onReplay,
  onBackHome,
  openExplanation,
  setOpenExplanation,
}: ResultsProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 rounded-3xl bg-white px-6 py-6 shadow-sm lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Skor akhir</p>
          <p className="text-4xl font-semibold text-slate-900">{accuracy}%</p>
          <p className="text-sm text-slate-500">
            {accuracy >= 90
              ? "Eksekusi rapi! Pertahankan ritme secepat ini."
              : accuracy >= 70
              ? "Sudah solid. Sisihkan sesi tambahan untuk kategori yang belum maksimal."
              : "Gunakan hasil ini sebagai pijakan awal, ulangi beberapa mode untuk meningkatkan akurasi."}
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={onReplay}
              className="inline-flex items-center justify-center rounded-full border border-slate-900 bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800"
            >
              Mulai sesi baru
            </button>
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 font-semibold text-slate-600 transition hover:border-slate-900 hover:text-slate-900"
            >
              Kembali ke beranda
            </button>
          </div>
        </div>
        <div className="mx-auto h-48 w-full max-w-xs">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={pieData.length ? pieData : [{ name: "Belum", value: 1, fill: "rgba(148,163,184,0.35)" }]}
                dataKey="value"
                nameKey="name"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={2}
              >
                {(pieData.length ? pieData : [{ fill: "rgba(148,163,184,0.35)" }]).map((entry, index) => (
                  <Cell key={index} fill={(entry as { fill: string }).fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Analisis kategori</h3>
        <p className="text-xs text-slate-500">{analysis.message}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {analysis.insights.map((item) => (
            <div
              key={item.category}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600"
            >
              <p className="font-semibold text-slate-900">{item.category}</p>
              <p>Akurasi: {(item.accuracy * 100).toFixed(0)}%</p>
              {item.skipped > 0 && <p>Lewat karena waktu: {item.skipped} soal</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Review soal</h3>
        <p className="text-xs text-slate-500">Ketuk kartu untuk membuka pembahasan.</p>
        <div className="mt-4 space-y-3">
          {questions.map((question, index) => {
            const snapshot = answers[index];
            const isOpen = openExplanation === index;
            const status =
              snapshot?.isCorrect === true
                ? "border-emerald-200 bg-emerald-50"
                : snapshot?.selected
                ? "border-rose-200 bg-rose-50"
                : "border-slate-200 bg-slate-50";

            return (
              <div key={index} className={`rounded-3xl border ${status} px-4 py-3 transition`}>
                <button
                  type="button"
                  onClick={() => setOpenExplanation(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Soal {index + 1}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {question.questionType}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">
                    {isOpen ? "Sembunyikan" : "Lihat pembahasan"}
                  </span>
                </button>
                {isOpen && (
                  <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {question.questionText}
                    </ReactMarkdown>
                    <p>
                      Jawaban kamu: <span className="font-semibold">{snapshot?.selected ?? "Lewat"}</span>
                      {" • "}
                      Kunci: <span className="font-semibold text-slate-900">{question.correctOptionLabel}</span>
                    </p>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {question.explanation}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type SummaryCellProps = {
  title: string;
  value: string;
};

function SummaryCell({ title, value }: SummaryCellProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{title}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}