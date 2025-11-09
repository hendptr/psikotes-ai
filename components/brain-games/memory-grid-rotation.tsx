'use client';

import { useEffect, useMemo, useState } from "react";

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

  const rotatedPattern = useMemo(() => {
    const rotated = [...pattern];
    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let col = 0; col < GRID_SIZE; col += 1) {
        const srcIndex = row * GRID_SIZE + col;
        const newRow = col;
        const newCol = GRID_SIZE - 1 - row;
        const destIndex = newRow * GRID_SIZE + newCol;
        rotated[destIndex] = { ...pattern[srcIndex] };
      }
    }
    return rotated;
  }, [pattern]);

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
    const activeIndices = rotatedPattern
      .filter((cell) => cell.active)
      .map((cell) => cell.id);
    const selectedIndices = Array.from(selections);
    const correct =
      selectedIndices.length === activeIndices.length &&
      selectedIndices.every((idx) => activeIndices.includes(idx));
    setAttempts((prev) => prev + 1);
    if (correct) {
      setScore((prev) => prev + 1);
      setFeedback("Benar! Pola diingat dengan sempurna.");
      window.setTimeout(() => resetRound(round + 1), 1500);
    } else {
      setFeedback("Belum tepat. Pola akan diulang.");
      window.setTimeout(() => resetRound(Math.max(1, round - 1)), 1500);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Brain Game</p>
          <h2 className="text-2xl font-semibold text-slate-900">Memory Grid & Rotation</h2>
          <p className="text-sm text-slate-600">
            Hafalkan pola yang muncul, lalu pilih sel yang aktif setelah grid diputar 90°. Setiap
            ronde jadi lebih menantang!
          </p>
        </div>
        <button
          type="button"
          onClick={() => resetRound(1)}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
        >
          Ulang dari awal
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Ronde" value={`${round}`} />
        <StatCard label="Skor" value={`${score}/${attempts || 1}`} />
        <StatCard label="Sel aktif" value={pattern.filter((cell) => cell.active).length.toString()} />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Langkah 1</p>
          <p className="text-sm text-slate-600">Ingat posisi sel yang menyala.</p>
          <GridView
            cells={pattern}
            highlight={showPattern}
            disabled
          />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Langkah 2</p>
          <p className="text-sm text-slate-600">
            Setelah diputar 90°, pilih sel yang tadi menyala.
          </p>
          <GridView
            cells={rotatedPattern}
            highlight={false}
            disabled={showPattern}
            selections={selections}
            onSelect={handleCellClick}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={checkAnswer}
          disabled={showPattern || selections.size === 0 || Boolean(feedback)}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          Cek Jawaban
        </button>
        {feedback && <p className="text-sm font-semibold text-slate-700">{feedback}</p>}
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
