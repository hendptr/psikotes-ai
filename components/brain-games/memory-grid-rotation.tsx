'use client';

import { useEffect, useState } from "react";

type GridCell = {
  id: number;
  active: boolean;
};

const GRID_SIZE = 4;
const FLASH_DURATION_MS = 2500;

function generatePattern(round: number): GridCell[] {
  const totalCells = GRID_SIZE * GRID_SIZE;
  const activeCount = Math.min(3 + round, totalCells);
  const activeIndices = new Set<number>();
  while (activeIndices.size < activeCount) {
    activeIndices.add(Math.floor(Math.random() * totalCells));
  }
  return Array.from({ length: totalCells }).map((_, index) => ({
    id: index,
    active: activeIndices.has(index),
  }));
}

export default function MemoryGridRotation() {
  const [round, setRound] = useState(1);
  const [pattern, setPattern] = useState<GridCell[]>(() => generatePattern(1));
  const [showPattern, setShowPattern] = useState(true);
  const [selections, setSelections] = useState<Set<number>>(new Set());
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!showPattern) return;
    const timer = window.setTimeout(() => setShowPattern(false), FLASH_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [pattern, showPattern]);

  function resetRound(nextRound: number) {
    setRound(nextRound);
    setPattern(generatePattern(nextRound));
    setShowPattern(true);
    setSelections(new Set());
    setFeedback(null);
  }

  function handleCellClick(index: number) {
    if (showPattern || feedback) return;
    setSelections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function checkAnswer() {
    if (showPattern) return;
    const activeIndices = pattern.filter((cell) => cell.active).map((cell) => cell.id);
    const selectedIndices = Array.from(selections);
    const correct =
      selectedIndices.length === activeIndices.length &&
      selectedIndices.every((idx) => activeIndices.includes(idx));
    setAttempts((prev) => prev + 1);
    if (correct) {
      setScore((prev) => prev + 1);
      setFeedback("Benar! Kamu mengingat pola dengan tepat.");
      window.setTimeout(() => resetRound(round + 1), 1500);
    } else {
      setFeedback("Belum tepat. Pola akan diulang.");
      window.setTimeout(() => resetRound(Math.max(1, round - 1)), 1500);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Brain Game</p>
          <h2 className="text-xl font-semibold text-slate-900">Memory Grid</h2>
          <p className="text-xs text-slate-600">
            Pola muncul sebentar lalu hilang. Ingat sel aktif dan pilih kembali.
          </p>
        </div>
        <button
          type="button"
          onClick={() => resetRound(1)}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
        >
          Ulang dari awal
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Chip label="Ronde" value={`${round}`} />
        <Chip label="Skor" value={`${score}/${attempts || 1}`} />
        <Chip label="Sel aktif" value={pattern.filter((cell) => cell.active).length.toString()} />
      </div>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Pola</p>
        <p className="text-xs text-slate-600">
          Hafalkan pola biru. Setelah hilang, pilih sel yang sama.
        </p>
        <GridView
          cells={pattern}
          highlight={showPattern}
          disabled={showPattern}
          selections={selections}
          onSelect={handleCellClick}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={checkAnswer}
          disabled={showPattern || selections.size === 0 || Boolean(feedback)}
          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          Cek Jawaban
        </button>
        {feedback && <p className="text-xs font-semibold text-slate-700">{feedback}</p>}
      </div>
    </section>
  );
}

function GridView({
  cells,
  highlight,
  disabled,
  selections,
  onSelect,
}: {
  cells: GridCell[];
  highlight: boolean;
  disabled?: boolean;
  selections?: Set<number>;
  onSelect?: (index: number) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-4 gap-2">
      {cells.map((cell) => {
        const isSelected = selections?.has(cell.id);
        return (
          <button
            key={cell.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect?.(cell.id)}
            className={`aspect-square rounded-xl border transition ${
              highlight && cell.active
                ? "border-sky-400 bg-sky-100"
                : isSelected
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white hover:border-slate-400"
            }`}
          />
        );
      })}
    </div>
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
