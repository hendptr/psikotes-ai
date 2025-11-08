'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/config";
import type { PsychotestQuestion } from "@/lib/models";
import type { AnswerSummary } from "@/lib/test-sessions";

const DEFAULT_TIMER_PER_MODE: Record<string, number> = {
  santai: 45,
  serius: 30,
  simulasi: 25,
};

type SerializableAnswer = Omit<AnswerSummary, never>;

type SessionPayload = {
  sessionId: string;
  userType: string;
  category: string;
  difficulty: string;
  questionCount: number;
  customDurationSeconds: number | null;
  startedAt: string;
  completedAt: string | null;
  score: number | null;
  questions: PsychotestQuestion[];
  answers: SerializableAnswer[];
};

type AnswerMap = Record<number, SerializableAnswer>;

type CompletionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "completed"; score: number; correct: number; answered: number };

type TestRunnerProps = {
  session: SessionPayload;
};

const OPTION_COLORS: Record<string, string> = {
  A: "from-slate-900 to-slate-700",
  B: "from-slate-800 to-slate-600",
  C: "from-slate-700 to-slate-500",
  D: "from-slate-600 to-slate-400",
};

function resolveInitialIndex(session: SessionPayload) {
  const answered = new Set(session.answers.map((answer) => answer.questionIndex));
  for (let index = 0; index < session.questionCount; index += 1) {
    if (!answered.has(index)) {
      return index;
    }
  }
  return Math.max(0, session.questionCount - 1);
}

function formatSeconds(seconds: number | null) {
  if (seconds == null) return null;
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

function formatTimerCountdown(seconds: number | null) {
  if (seconds == null) return null;
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function TestRunner({ session }: TestRunnerProps) {
  const router = useRouter();
  const timerSeconds =
    session.customDurationSeconds ?? DEFAULT_TIMER_PER_MODE[session.userType] ?? null;
  const timerLabel = formatSeconds(timerSeconds);
  const isCustomTimer = Boolean(session.customDurationSeconds);

  const [currentIndex, setCurrentIndex] = useState(() => resolveInitialIndex(session));
  const [answers, setAnswers] = useState<AnswerMap>(() =>
    session.answers.reduce<AnswerMap>((map, answer) => {
      map[answer.questionIndex] = answer;
      return map;
    }, {})
  );
  const [questionStart, setQuestionStart] = useState(() => Date.now());
  const [timerDeadline, setTimerDeadline] = useState<number | null>(() =>
    typeof timerSeconds === "number" ? Date.now() + timerSeconds * 1000 : null
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    typeof timerSeconds === "number" ? timerSeconds : null
  );
  const [pendingQuestions, setPendingQuestions] = useState<Record<number, true>>({});
  const [pendingSaves, setPendingSaves] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<CompletionState>(() => {
    if (session.completedAt && typeof session.score === "number") {
      return {
        status: "completed",
        score: session.score ?? 0,
        correct: Object.values(answers).filter((item) => item.isCorrect).length,
        answered: Object.keys(answers).length,
      };
    }
    return { status: "idle" };
  });

  const questions = session.questions;
  const totalQuestions = session.questionCount;
  const hasTimer = typeof timerSeconds === "number";
  const isSessionActive = completion.status === "idle";
  const isComplete = completion.status === "completed";
  const showTimerCountdown = hasTimer && isSessionActive;

  function resetTimingForCurrentQuestion() {
    if (!isSessionActive) {
      return;
    }
    setQuestionStart(Date.now());
    if (typeof timerSeconds === "number") {
      const deadline = Date.now() + timerSeconds * 1000;
      setTimerDeadline(deadline);
      setRemainingSeconds(timerSeconds);
    } else {
      setTimerDeadline(null);
      setRemainingSeconds(null);
    }
  }

  useEffect(() => {
    if (!isSessionActive) {
      return;
    }
    setQuestionStart(Date.now());
  }, [currentIndex, isSessionActive]);

  useEffect(() => {
    if (!showTimerCountdown || typeof timerSeconds !== "number") {
      setTimerDeadline(null);
      setRemainingSeconds(null);
      return;
    }
    const deadline = Date.now() + timerSeconds * 1000;
    setTimerDeadline(deadline);
    setRemainingSeconds(timerSeconds);
  }, [currentIndex, showTimerCountdown, timerSeconds]);

  useEffect(() => {
    if (!showTimerCountdown || timerDeadline == null) {
      return;
    }
    const tick = () => {
      const diff = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
      setRemainingSeconds(diff);
    };
    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [timerDeadline, showTimerCountdown]);

  const totalAnswered = Object.keys(answers).length;
  const correctCount = useMemo(
    () => Object.values(answers).filter((entry) => entry.isCorrect).length,
    [answers]
  );
  const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

  const finalizeSession = useCallback(async () => {
    if (completion.status === "loading" || completion.status === "completed") {
      return;
    }
    if (pendingSaves > 0) {
      setError("Tunggu sebentar, jawaban masih disimpan.");
      return;
    }
    setCompletion({ status: "loading" });
    try {
      const response = await fetch(`${API_BASE}/test-sessions/${session.sessionId}/complete`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Gagal menyelesaikan sesi.");
      }
      const data = await response.json();
      setCompletion({
        status: "completed",
        score: data.score,
        correct: data.correct,
        answered: data.answered,
      });
    } catch (err) {
      setCompletion({ status: "idle" });
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    }
  }, [completion.status, pendingSaves, session.sessionId]);

  useEffect(() => {
    if (
      completion.status === "idle" &&
      pendingSaves === 0 &&
      totalQuestions > 0 &&
      totalAnswered === totalQuestions
    ) {
      void finalizeSession();
    }
  }, [completion.status, finalizeSession, pendingSaves, totalAnswered, totalQuestions]);

  async function submitAnswer(optionLabel: string) {
    if (isComplete || pendingQuestions[currentIndex]) {
      return;
    }
    const questionIndex = currentIndex;
    const currentQuestion = questions[questionIndex];
    const elapsed = Date.now() - questionStart;
    const optimisticAnswer: SerializableAnswer = {
      questionIndex,
      selectedLabel: optionLabel,
      correctLabel: currentQuestion.correctOptionLabel,
      isCorrect: optionLabel === currentQuestion.correctOptionLabel,
      timeSpentMs: elapsed,
    };
    const advanced = questionIndex < totalQuestions - 1;

    setPendingQuestions((prev) => ({ ...prev, [questionIndex]: true }));
    setPendingSaves((value) => value + 1);
    setError(null);
    setAnswers((prev) => ({
      ...prev,
      [questionIndex]: optimisticAnswer,
    }));

    if (advanced) {
      setCurrentIndex(questionIndex + 1);
    }

    try {
      const response = await fetch(`${API_BASE}/test-sessions/${session.sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIndex,
          selectedLabel: optionLabel,
          correctLabel: currentQuestion.correctOptionLabel,
          timeSpentMs: elapsed,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Gagal menyimpan jawaban.");
      }

      const payload = await response.json();
      setAnswers((prev) => ({
        ...prev,
        [questionIndex]: {
          ...optimisticAnswer,
          isCorrect: payload.isCorrect ?? optimisticAnswer.isCorrect,
        },
      }));
    } catch (err) {
      setAnswers((prev) => {
        const updated = { ...prev };
        delete updated[questionIndex];
        return updated;
      });
      setCurrentIndex(questionIndex);
      if (!advanced) {
        resetTimingForCurrentQuestion();
      }
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setPendingQuestions((prev) => {
        const next = { ...prev };
        delete next[questionIndex];
        return next;
      });
      setPendingSaves((value) => Math.max(0, value - 1));
    }
  }

  function handleReturnToDashboard() {
    if (completion.status === "loading") {
      return;
    }
    if (isSessionActive && totalAnswered < totalQuestions) {
      const confirmed = window.confirm(
        "Sesi masih berlangsung. Yakin mau kembali ke dashboard?"
      );
      if (!confirmed) {
        return;
      }
    }
    router.push("/dashboard");
  }

  function goTo(index: number) {
    if (index >= 0 && index < totalQuestions) {
      setCurrentIndex(index);
    }
  }

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentIndex];
  const progressValue = ((currentIndex + 1) / totalQuestions) * 100;
  const isCurrentPending = Boolean(pendingQuestions[currentIndex]);
  const countdownLabel = showTimerCountdown ? formatTimerCountdown(remainingSeconds) : null;
  const timerRemainingPercent =
    showTimerCountdown && typeof remainingSeconds === "number" && timerSeconds
      ? Math.max(0, Math.min(100, (remainingSeconds / timerSeconds) * 100))
      : 0;
  const timerCritical =
    showTimerCountdown && typeof remainingSeconds === "number" && remainingSeconds <= 10;
  const finalizeDisabled = completion.status === "loading" || isComplete || pendingSaves > 0;
  const finalizeLabel =
    completion.status === "loading"
      ? "Menghitung..."
      : isComplete
      ? "Sesi selesai"
      : pendingSaves > 0
      ? "Menyimpan jawaban..."
      : "Selesaikan sesi";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Soal {currentIndex + 1} dari {totalQuestions}
            </span>
            <span>{Math.round(progressValue)}% progress</span>
          </div>
          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 transition-all"
              style={{ width: `${progressValue}%` }}
            />
          </div>

          <div className="mt-8 space-y-5">
            <h2 className="text-3xl font-semibold text-slate-900">
              {currentQuestion.questionType}
            </h2>
            {hasTimer ? (
              showTimerCountdown ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Timer:{" "}
                      <span
                        className={`font-semibold ${
                          timerCritical ? "text-rose-600" : "text-slate-700"
                        }`}
                      >
                        {countdownLabel}
                      </span>
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                      {isCustomTimer ? "Custom" : "Standar"}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-2 transition-all ${
                        timerCritical ? "bg-rose-500" : "bg-slate-900"
                      }`}
                      style={{ width: `${timerRemainingPercent}%` }}
                    />
                  </div>
                </div>
              ) : (
                timerLabel && (
                  <p className="text-xs text-slate-500">
                    Timer dihentikan{isSessionActive ? "" : " karena sesi selesai"} (
                    <span className="font-semibold text-slate-700">{timerLabel}</span>{" "}
                    {isCustomTimer ? "custom" : "standar"}).
                  </p>
                )
              )
            ) : (
              timerLabel && (
                <p className="text-xs text-slate-500">
                  Timer: <span className="font-semibold text-slate-700">{timerLabel}</span>{" "}
                  {isCustomTimer ? "(custom)" : "(standar)"}
                </p>
              )
            )}
            <p className="text-lg leading-relaxed text-slate-700">
              {currentQuestion.questionText}
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {currentQuestion.options.map((option) => {
              const isSelected = currentAnswer?.selectedLabel === option.label;
              const isCorrect = currentAnswer?.correctLabel === option.label;
              const showState = Boolean(currentAnswer);
              const gradient = OPTION_COLORS[option.label] ?? "from-indigo-400 to-indigo-600";
              const stateClass = showState
                ? isCorrect
                  ? "border-slate-900 bg-slate-900 text-white"
                  : isSelected
                  ? "border-rose-300 bg-rose-50 text-rose-600"
                  : "border-slate-200 bg-slate-50 text-slate-600"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50";
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => submitAnswer(option.label)}
                  disabled={isComplete || isCurrentPending}
                  className={`flex w-full items-center justify-between rounded-2xl border px-5 py-5 text-left text-base transition ${stateClass}`}
                >
                  <span className="flex items-center gap-4">
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-base font-semibold text-white ${gradient}`}
                    >
                      {option.label}
                    </span>
                    <span className="text-slate-700">{option.text}</span>
                  </span>
                  {showState && isCorrect && (
                    <span className="text-xs font-semibold text-white">Benar!</span>
                  )}
                </button>
              );
            })}
          </div>

          {currentAnswer && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
              <p className="text-sm font-semibold text-slate-900">Pembahasan</p>
              <p className="mt-2 leading-relaxed">{currentQuestion.explanation}</p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="rounded-full border border-slate-200 px-4 py-2 text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: totalQuestions }, (_, index) => {
                const answered = Boolean(answers[index]);
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => goTo(index)}
                    className={`h-10 w-10 rounded-full text-sm font-semibold transition ${
                      index === currentIndex
                        ? "bg-slate-900 text-white"
                        : answered
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                    }`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={finalizeSession}
                disabled={finalizeDisabled}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {finalizeLabel}
              </button>
              <button
                type="button"
                onClick={handleReturnToDashboard}
                disabled={completion.status === "loading"}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
              >
                Kembali ke Dashboard
              </button>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
              {error}
            </p>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-lg">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Progress kamu</p>
          <div className="mt-4 space-y-3">
            <SummaryStat label="Soal dijawab" value={`${totalAnswered}/${totalQuestions}`} />
            <SummaryStat label="Benar" value={`${correctCount} soal`} />
            <SummaryStat label="Akurasi" value={formatPercentage(accuracy)} />
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-lg">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Catatan dari Kedak</p>
          <p className="mt-4 leading-relaxed">
            {accuracy >= 80
              ? "Wow! KERENNNNNNNNNN, SS dan ku traktir eskrim!"
              : accuracy >= 60
              ? "Winnie winniiee lovee uuuuu"
              : "Lovee u Winniee!!."}
          </p>
        </div>
        {isComplete && completion.status === "completed" && (
          <div className="rounded-3xl border border-slate-900/15 bg-slate-900/5 p-6 text-sm text-slate-700 shadow-lg">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-600">Sesi selesai</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Skor {completion.score.toFixed(1)}%
            </h2>
            <p className="mt-2 text-sm">
              Jawaban benar {completion.correct} dari {completion.answered} soal. Ayo cek detailnya di
              dashboard!
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}


