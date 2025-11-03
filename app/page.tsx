"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const MODE_CARDS = [
  {
    id: "santai",
    title: "Tempo Santai",
    subtitle: "45 detik per soal",
    highlight: "Ideal untuk pemanasan lahhh",
    stats: ["Timer longgar", "Penjelasan lengkap", "Konsentrasi ringan"],
  },
  {
    id: "serius",
    title: "Fokus Stabil",
    subtitle: "30 detik per soal",
    highlight: "Okelah untuk latihan harian",
    stats: ["Variasi soal seimbang", "Analisis kategori"],
  },
  {
    id: "simulasi",
    title: "Simulasi Tes",
    subtitle: "25 detik per soal",
    highlight: "mulai tekanan realistis",
    stats: ["Auto-advance",],
  },
  {
    id: "tantangan",
    title: "Mode Sprint",
    subtitle: "15 detik per soal",
    highlight: "Gasss Jagooo",
    stats: ["Soal tricky",  "Statistik ketat"],
  },
];

const CATEGORY_OPTIONS = [
  { value: "mixed", label: "Campuran" },
  { value: "padanan_kata", label: "Padanan Kata" },
  { value: "sinonim_antonim", label: "Sinonim / Antonim" },
  { value: "hafalan_kata", label: "Hafalan Kata" },
  { value: "deret_matematika", label: "Deret Matematika" },
];

const DIFFICULTY_OPTIONS = [
  { value: "mudah", label: "Mudah" },
  { value: "sedang", label: "Sedang" },
  { value: "sulit", label: "Sulit" },
];

const SNAPSHOTS = [
  { label: "Total Sesi", value: "∞" },
  { label: "Timer", value: "15 - 45 detik" },
  { label: "Skor Akurasi", value: "Otomatis" },
  { label: "Format Pembahasan", value: "Markdown" },
];

export default function LandingPage() {
  const router = useRouter();

  const [userType, setUserType] = useState<string>("serius");
  const [category, setCategory] = useState<string>("mixed");
  const [difficulty, setDifficulty] = useState<string>("sulit");
  const [count, setCount] = useState<number>(20);
  const [resumeSessionId, setResumeSessionId] = useState<string>("");
  const [resumeError, setResumeError] = useState<string>("");

  const activeMode = useMemo(
    () => MODE_CARDS.find((mode) => mode.id === userType) ?? MODE_CARDS[1],
    [userType]
  );

  function handleStart() {
    const params = new URLSearchParams({
      userType,
      category,
      difficulty,
      count: String(count),
    });
    router.push(`/test?${params.toString()}`);
  }

  function handleResume(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = resumeSessionId.trim();
    if (!trimmed) {
      setResumeError("Masukkan Session ID terlebih dahulu.");
      return;
    }
    setResumeError("");
    router.push(`/test?sessionId=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-white px-6 py-8 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3 md:max-w-xl">
            <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Winnie Tsuki Ga Kireii Desune ?</p>
            <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">
              Winnie Te Amooo!!!!!
            </h1>
            <p className="text-sm text-slate-500">
              Pilih mode latihan win.
            </p>
          </div>
          <div className="grid gap-3 text-center text-xs text-slate-500 sm:grid-cols-2">
            {SNAPSHOTS.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{item.label}</p>
                <p className="text-lg font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Paket latihan</h2>
          <span className="text-xs text-slate-500">Geser kartu di mobile untuk melihat semua mode</span>
        </header>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {MODE_CARDS.map((mode) => {
            const active = mode.id === userType;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setUserType(mode.id)}
                className={[
                  "flex h-full flex-col gap-3 rounded-3xl border px-5 py-5 text-left transition",
                  active
                    ? "border-slate-900 bg-slate-900 text-slate-50 shadow-lg shadow-slate-900/25"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow"
                ].join(" ")}
              >
                <div className="flex items-center justify-between text-xs uppercase tracking-wide">
                  <span className={active ? "text-slate-100" : "text-slate-500"}>{mode.subtitle}</span>
                  {active && <span className="rounded-full bg-white/15 px-2 py-1 text-[11px] text-white">Dipilih</span>}
                </div>
                <h3 className="text-lg font-semibold">{mode.title}</h3>
                <p className={active ? "text-slate-200" : "text-slate-500"}>{mode.highlight}</p>
                <ul className="space-y-2 text-xs">
                  {mode.stats.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span
                        className={
                          active
                            ? "h-1.5 w-1.5 rounded-full bg-white"
                            : "h-1.5 w-1.5 rounded-full bg-slate-400"
                        }
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Konfigurasi sesi</h2>
          <p className="text-xs text-slate-500">Atur kategori, tingkat kesulitan, dan jumlah soal.</p>
          <div className="mt-5 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kategori soal</label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                {CATEGORY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tingkat kesulitan</label>
              <select
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                {DIFFICULTY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Jumlah soal</span>
                <span className="rounded-full bg-slate-900/5 px-2 py-1 text-[11px] text-slate-700">{count} soal</span>
              </div>
              <input
                type="range"
                min={10}
                max={50}
                step={5}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
                className="range-accent w-full"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>10</span>
                <span>30</span>
                <span>50</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleStart}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white transition hover:scale-[1.01] hover:bg-slate-800"
            >
              Mulai sesi baru
            </button>
          </div>
        </div>

        <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Lanjutkan sesi</h2>
          <p className="text-xs text-slate-500">
            Masukkan Session ID untuk memuat ulang soal, jawaban, dan statistik terakhir.
          </p>
          <form className="mt-4 space-y-3" onSubmit={handleResume}>
            <input
              type="text"
              value={resumeSessionId}
              onChange={(event) => setResumeSessionId(event.target.value)}
              placeholder="contoh: 9a2c4d44-1234-4b7a-a1ef-78ad1c8e1c22"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
            {resumeError ? (
              <p className="text-xs font-semibold text-rose-500">{resumeError}</p>
            ) : (
              <p className="text-xs text-slate-400">
                Sesi tersimpan otomatis. Simpan ID ini setiap kali selesai latihan.
              </p>
            )}
            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-slate-900 bg-white text-sm font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white"
            >
              Muat ulang sesi
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-3xl bg-white px-6 py-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Detail mode terpilih</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mode</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{activeMode.title}</p>
            <p className="text-sm text-slate-500">{activeMode.highlight}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Konfigurasi</p>
            <p className="mt-1 text-sm text-slate-500">
              Kategori: {CATEGORY_OPTIONS.find((item) => item.value === category)?.label}
            </p>
            <p className="text-sm text-slate-500">
              Tingkat: {DIFFICULTY_OPTIONS.find((item) => item.value === difficulty)?.label}
            </p>
            <p className="text-sm text-slate-500">Jumlah soal: {count}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
