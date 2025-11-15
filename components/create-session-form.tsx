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
  const activeCategoryLabel = useMemo(
    () => CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category,
    [category]
  );
  const activeDifficultyLabel = useMemo(
    () => DIFFICULTY_OPTIONS.find((option) => option.value === difficulty)?.label ?? difficulty,
    [difficulty]
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
    <div className="rounded-[32px] border border-slate-100 bg-white/90 p-8 shadow-xl">
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="flex flex-col gap-6 rounded-3xl border border-slate-100 bg-slate-50/80 p-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Mode latihan</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Mood latihan harianmu</h2>
            <p className="mt-2 text-sm text-slate-500">
              Pilih ritme favorit sebelum menyetel kategori, tingkat, dan timer.
            </p>
          </div>
          <nav className="space-y-2">
            {MODE_OPTIONS.map((mode, index) => {
              const active = mode.value === userType;
              const indexLabel = String(index + 1).padStart(2, "0");
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setUserType(mode.value)}
                  className={`group flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white shadow-lg"
                      : "border-transparent bg-white/80 text-slate-600 hover:border-slate-200 hover:bg-white"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold ${
                      active ? "border-white/30 bg-white/10 text-white" : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    {indexLabel}
                  </span>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold">{mode.label}</p>
                    <p className={`text-xs ${active ? "text-white/80" : "text-slate-500"}`}>
                      {mode.description}
                    </p>
                    <p
                      className={`text-[11px] uppercase tracking-[0.25em] ${
                        active ? "text-white/70" : "text-slate-400"
                      }`}
                    >
                      Timer standar {formatSeconds(mode.defaultSeconds)}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/90 p-4 text-sm text-slate-600">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Konfigurasi aktif</p>
            <p className="mt-3 text-base font-semibold text-slate-900">{activeMode.label}</p>
            <p className="text-xs text-slate-500">{timerLabel}</p>
            <div className="mt-3 space-y-1 text-xs text-slate-500">
              <p>{activeCategoryLabel}</p>
              <p>{activeDifficultyLabel}</p>
              <p>{count} soal</p>
            </div>
          </div>
        </aside>

        <section className="space-y-5">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Kategori soal</p>
            <div className="mt-4 grid gap-2">
              {CATEGORY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                    option.value === category
                      ? "border-slate-900 bg-white text-slate-900 shadow-sm"
                      : "border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200"
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

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Tingkat kesulitan</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {DIFFICULTY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDifficulty(option.value)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      option.value === difficulty
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-slate-400">
                <span>Jumlah soal</span>
                <span className="text-slate-600">{count} butir</span>
              </div>
              <input
                type="range"
                min={5}
                max={30}
                step={1}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
                className="mt-4 w-full accent-slate-900"
              />
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>5 soal</span>
                <span>30 soal</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-slate-400">
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
              <div className="mt-4 space-y-4">
                <p className="text-sm text-slate-500">
                  Timer custom:{" "}
                  <span className="font-semibold text-slate-900">{formatSeconds(customSeconds)}</span>
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
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Mengikuti standar mode:{" "}
                <span className="font-semibold text-slate-900">
                  {formatSeconds(activeMode.defaultSeconds)}
                </span>
              </p>
            )}
          </div>
        </section>
      </div>

      {error && (
        <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-100 bg-white/90 px-5 py-4">
        <div className="min-w-[220px] flex-1 text-xs text-slate-500">
          <p className="text-sm font-semibold text-slate-900">
            Mode {activeMode.label} • {timerLabel}
          </p>
          <p className="mt-1 text-slate-500">
            {activeCategoryLabel} • {activeDifficultyLabel} • {count} soal
          </p>
        </div>
        <button
          type="button"
          onClick={handleStart}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 disabled:opacity-70"
        >
          {loading ? "Menyiapkan soal..." : "Mulai Latihan"}
          <span aria-hidden className="text-lg">{">"}</span>
        </button>
      </div>
    </div>
  );
}

