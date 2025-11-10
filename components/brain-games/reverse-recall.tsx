'use client';

import { useEffect, useMemo, useState } from "react";

const ITEMS = [
  "apel",
  "kopi",
  "tas",
  "kunci",
  "buku",
  "kursi",
  "baju",
  "lampu",
  "piring",
  "gelas",
];

function generateList(length: number) {
  const shuffled = [...ITEMS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, length);
}

export default function ReverseRecall() {
  const [length, setLength] = useState(3);
  const [items, setItems] = useState<string[]>(() => generateList(3));
  const [showList, setShowList] = useState(true);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!showList) return;
    const timer = window.setTimeout(() => setShowList(false), 2500 + length * 400);
    return () => window.clearTimeout(timer);
  }, [items, showList, length]);

  const target = useMemo(() => items.slice().reverse().join(" "), [items]);

  function resetGame(nextLength: number) {
    setLength(nextLength);
    setItems(generateList(Math.min(nextLength, ITEMS.length)));
    setShowList(true);
    setInput("");
    setFeedback(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (showList || !input.trim()) return;
    const normalized = input.trim().toLowerCase();
    if (normalized === target) {
      setScore((prev) => prev + 1);
      setFeedback("Keren! Urutan terbalikmu tepat.");
      window.setTimeout(() => resetGame(length + 1), 1200);
    } else {
      setFeedback(`Jawabannya: ${target}`);
      window.setTimeout(() => resetGame(Math.max(3, length - 1)), 1800);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Brain Game</p>
          <h2 className="text-xl font-semibold text-slate-900">Reverse Recall</h2>
          <p className="text-xs text-slate-600">
            Hafalkan daftar benda yang muncul, lalu ketik ulang urutan terbaliknya.
          </p>
        </div>
        <button
          type="button"
          onClick={() => resetGame(3)}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
        >
          Ulang dari awal
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Chip label="Jumlah item" value={`${length}`} />
        <Chip label="Skor" value={`${score}`} />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Daftar</p>
        <p className="mt-1 text-base font-semibold text-slate-900">
          {showList ? items.join(", ") : "— Daftar disembunyikan —"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs text-slate-600">
        <label className="block text-[11px] uppercase tracking-[0.3em] text-slate-500">
          Ketik urutan terbalik (pisahkan dengan spasi)
        </label>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={showList}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-slate-900 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={showList || !input.trim()}
          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          Cek urutan
        </button>
      </form>

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
