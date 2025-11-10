'use client';

import { useEffect, useMemo, useState } from "react";

type Mode = "forward" | "reverse";

const SYMBOLS = ["A", "S", "D", "F", "G", "H", "J"];

function generateSequence(length: number) {
  return Array.from({ length }).map(
    () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
  );
}

export default function SequenceEcho() {
  const [mode, setMode] = useState<Mode>("forward");
  const [round, setRound] = useState(1);
  const [sequence, setSequence] = useState<string[]>(() => generateSequence(3));
  const [showSequence, setShowSequence] = useState(true);
  const [input, setInput] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!showSequence) return;
    const timer = window.setTimeout(() => setShowSequence(false), 2000 + round * 300);
    return () => window.clearTimeout(timer);
  }, [sequence, showSequence, round]);

  const targetSequence = useMemo(
    () => (mode === "reverse" ? [...sequence].reverse() : sequence),
    [mode, sequence]
  );

  function resetGame(nextRound: number, nextMode = mode) {
    setMode(nextMode);
    setRound(nextRound);
    setSequence(generateSequence(Math.min(3 + nextRound - 1, 10)));
    setShowSequence(true);
    setInput([]);
    setFeedback(null);
  }

  function handleSymbol(symbol: string) {
    if (showSequence || feedback) return;
    setInput((prev) => {
      const next = [...prev, symbol];
      if (next.length === targetSequence.length) {
        const correct = next.every((value, index) => value === targetSequence[index]);
        if (correct) {
          setScore((prevScore) => prevScore + 1);
          setFeedback("Bagus! Lanjut ke ronde berikutnya.");
          window.setTimeout(() => resetGame(round + 1), 1200);
        } else {
          setFeedback("Belum cocok, ulang ya.");
          window.setTimeout(() => resetGame(Math.max(1, round - 1)), 1200);
        }
      }
      return next;
    });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Brain Game</p>
          <h2 className="text-xl font-semibold text-slate-900">Sequence Echo</h2>
          <p className="text-xs text-slate-600">
            Hafalkan urutan huruf yang tampil, lalu ulangi (atau balikkan) urutannya.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => resetGame(1, "forward")}
            className={`rounded-full border px-3 py-1 font-semibold transition ${
              mode === "forward"
                ? "border-slate-900 text-slate-900"
                : "border-slate-200 text-slate-600 hover:border-slate-400"
            }`}
          >
            Mode normal
          </button>
          <button
            type="button"
            onClick={() => resetGame(1, "reverse")}
            className={`rounded-full border px-3 py-1 font-semibold transition ${
              mode === "reverse"
                ? "border-slate-900 text-slate-900"
                : "border-slate-200 text-slate-600 hover:border-slate-400"
            }`}
          >
            Mode reverse
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Chip label="Ronde" value={`${round}`} />
        <Chip label="Panjang urutan" value={`${sequence.length}`} />
        <Chip label="Skor" value={`${score}`} />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Urutan</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">
          {showSequence ? sequence.join(" ") : "?"}
        </p>
        {!showSequence && (
          <p className="mt-1 text-xs text-slate-500">
            {mode === "forward" ? "Ulangi urutan" : "Ulangi urutan terbalik"}
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {SYMBOLS.map((symbol) => (
          <button
            key={symbol}
            type="button"
            onClick={() => handleSymbol(symbol)}
            disabled={showSequence || Boolean(feedback)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-lg font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
          >
            {symbol}
          </button>
        ))}
      </div>

      {feedback && <p className="mt-3 text-center text-xs font-semibold text-slate-700">{feedback}</p>}
    </section>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex flex-col rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-600 shadow-sm">
      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{label}</span>
      <span className="text-base text-slate-900">{value}</span>
    </span>
  );
}
