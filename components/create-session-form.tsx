'use client';

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/config";
import { useToast } from "@/components/toast-provider";

type CreateSessionFormProps = {
  isAuthenticated: boolean;
};

type ModeOption = {
  value: string;
  label: string;
  description: string;
  defaultSeconds: number;
};

const MODE_OPTIONS: ModeOption[] = [
  {
    value: "santai",
    label: "Santai",
    description: "Tempo lembut cocok untuk pemanasan.",
    defaultSeconds: 45,
  },
  {
    value: "serius",
    label: "Serius",
    description: "Ritme stabil untuk latihan harian.",
    defaultSeconds: 30,
  },
  {
    value: "simulasi",
    label: "Simulasi",
    description: "Tekanan mirip ujian asli.",
    defaultSeconds: 25,
  },
];

const CATEGORY_OPTIONS = [
  { value: "mixed", label: "Campuran Variatif" },
  { value: "padanan_kata", label: "Padanan Kata" },
  { value: "sinonim_antonim", label: "Sinonim & Antonim" },
  { value: "hafalan_kata", label: "Hafalan Kata" },
  { value: "deret_matematika", label: "Deret Matematika" },
  {
    value: "perbandingan_senilai_berbalik",
    label: "Perbandingan Senilai & Berbalik Nilai",
  },
];

const DIFFICULTY_OPTIONS = [
  { value: "mudah", label: "Mudah" },
  { value: "sedang", label: "Sedang" },
  { value: "sulit", label: "Sulit" },
];

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds} detik/soal`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) return `${minutes} menit/soal`;
  return `${minutes} menit ${secs} detik/soal`;
}

type SessionSnapshot = {
  id: string;
  startedAt: string;
  questionCount: number;
  userType: string;
  category: string;
  difficulty: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function recoverCreatedSession(
  attemptStartedAt: number,
  criteria: { count: number; userType: string; category: string; difficulty: string }
): Promise<SessionSnapshot | null> {
  try {
    const response = await fetch(`${API_BASE}/test-sessions`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json().catch(() => null);
    const sessions = Array.isArray(data?.sessions) ? (data.sessions as SessionSnapshot[]) : [];
    if (!sessions.length) {
      return null;
    }
    const toleranceMs = 5 * 60 * 1000; // 5 minutes
    const candidate = sessions.find((session) => {
      const startedMs = new Date(session.startedAt).getTime();
      if (!Number.isFinite(startedMs)) return false;
      const delta = Math.abs(startedMs - attemptStartedAt);
      return (
        delta <= toleranceMs &&
        session.questionCount === criteria.count &&
        session.userType === criteria.userType &&
        session.category === criteria.category &&
        session.difficulty === criteria.difficulty
      );
    });
    return candidate ?? null;
  } catch {
    return null;
  }
}

async function waitForRecoveredSession(
  params: {
    attemptStartedAt: number;
    criteria: { count: number; userType: string; category: string; difficulty: string };
  },
  timeoutMs = 180_000,
  intervalMs = 4_000
): Promise<SessionSnapshot | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const recovered = await recoverCreatedSession(params.attemptStartedAt, params.criteria);
    if (recovered) {
      return recovered;
    }
    await sleep(intervalMs);
  }
  return null;
}

export default function CreateSessionForm({ isAuthenticated }: CreateSessionFormProps) {
  const router = useRouter();
  const [userType, setUserType] = useState<string>(MODE_OPTIONS[0].value);
  const [category, setCategory] = useState<string>(CATEGORY_OPTIONS[0].value);
  const [difficulty, setDifficulty] = useState<string>(DIFFICULTY_OPTIONS[1].value);
  const [count, setCount] = useState<number>(15);
  const [useCustomTimer, setUseCustomTimer] = useState<boolean>(false);
  const [customSeconds, setCustomSeconds] = useState<number>(MODE_OPTIONS[0].defaultSeconds);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeMode = useMemo(
    () => MODE_OPTIONS.find((mode) => mode.value === userType) ?? MODE_OPTIONS[0],
    [userType]
  );

  const timerLabel = useMemo(
    () => formatSeconds(useCustomTimer ? customSeconds : activeMode.defaultSeconds),
    [useCustomTimer, customSeconds, activeMode]
  );
  const { showToast } = useToast();

  useEffect(() => {
    if (!useCustomTimer) {
      setCustomSeconds(activeMode.defaultSeconds);
    }
  }, [activeMode, useCustomTimer]);

  async function handleStart() {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    setError(null);
    setLoading(true);
    const attemptStartedAt = Date.now();
    const recoveryCriteria = { count, userType, category, difficulty };

    try {
      const payload: Record<string, unknown> = {
        userType,
        category,
        difficulty,
        count,
      };

      if (useCustomTimer) {
        payload.customDurationSeconds = customSeconds;
      }

      const response = await fetch(`${API_BASE}/test-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        const recovered = await waitForRecoveredSession({
          attemptStartedAt,
          criteria: recoveryCriteria,
        });
        if (recovered) {
          showToast("Sesi sudah siap. Membuka sesi tersebut ya.", { variant: "success" });
          router.push(`/test/${recovered.id}`);
          return;
        }
        throw new Error(result?.error ?? "Tidak bisa membuat sesi. Coba lagi ya.");
      }

      const json = await response.json();
      router.push(`/test/${json.sessionId}`);
    } catch (err) {
      const recovered = await waitForRecoveredSession({
        attemptStartedAt,
        criteria: recoveryCriteria,
      });
      if (recovered) {
        showToast("Sesi sudah siap. Membuka sesi tersebut ya.", { variant: "success" });
        router.push(`/test/${recovered.id}`);
        return;
      }

      const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setError(message);
      showToast(message, { variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <span className="text-xs uppercase tracking-[0.35em] text-slate-500">Mood latihan</span>
          <div className="grid gap-3">
            {MODE_OPTIONS.map((mode) => {
              const active = mode.value === userType;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setUserType(mode.value)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-semibold">{mode.label}</p>
                  <p className={`text-xs ${active ? "text-slate-100/90" : "text-slate-500"}`}>
                    {mode.description}
                  </p>
                  <p
                    className={`text-[11px] uppercase tracking-[0.2em] ${
                      active ? "text-slate-200" : "text-slate-400"
                    }`}
                  >
                    Timer standar: {formatSeconds(mode.defaultSeconds)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Kategori</p>
            <div className="mt-3 grid gap-2">
              {CATEGORY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                    option.value === category
                      ? "border-slate-900 bg-white text-slate-900 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span>{option.label}</span>
                  <input
                    type="radio"
                    name="category"
                    className="accent-slate-900"
                    checked={category === option.value}
                    onChange={() => setCategory(option.value)}
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Tingkat</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DIFFICULTY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDifficulty(option.value)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    option.value === difficulty
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
              <span>Jumlah soal</span>
              <span className="text-slate-700">{count} butir</span>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
              className="mt-2 w-full accent-slate-900"
            />
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
              <span>Timer per soal</span>
              <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={useCustomTimer}
                  onChange={(event) => setUseCustomTimer(event.target.checked)}
                  className="accent-slate-900"
                />
                Custom
              </label>
            </div>
            {useCustomTimer ? (
              <>
                <p className="text-xs text-slate-500">
                  Timer custom:{" "}
                  <span className="font-semibold text-slate-700">{formatSeconds(customSeconds)}</span>
                </p>
                <input
                  type="range"
                  min={10}
                  max={120}
                  step={5}
                  value={customSeconds}
                  onChange={(event) => setCustomSeconds(Number(event.target.value))}
                  className="w-full accent-slate-900"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>10 detik</span>
                  <span>120 detik</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">
                Mengikuti standar mode:{" "}
                <span className="font-semibold text-slate-700">
                  {formatSeconds(activeMode.defaultSeconds)}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          Mode {activeMode.label} - {timerLabel}
        </div>
        <button
          type="button"
          onClick={handleStart}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:opacity-70"
        >
          {loading ? "Menyiapkan soal..." : "Mulai Latihan"}
          <span aria-hidden className="text-lg">{">"}</span>
        </button>
      </div>
    </div>
  );
}

