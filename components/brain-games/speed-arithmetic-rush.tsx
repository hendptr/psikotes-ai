'use client';

import { useEffect, useMemo, useState } from "react";

type Question = {
  expression: string;
  options: number[];
  answer: number;
};

function generateQuestion(): Question {
  const a = Math.floor(Math.random() * 40) + 10;
  const b = Math.floor(Math.random() * 15) + 1;
  const op = Math.random() < 0.5 ? "+" : "-";
  let answer = a + b;
  if (op === "-") {
    answer = a - b;
  }
  const expression = `${a} ${op} ${b}`;
  const options = new Set<number>([answer]);
  while (options.size < 4) {
    const delta = Math.floor(Math.random() * 20) - 10;
    const candidate = answer + delta;
    if (candidate !== answer) {
      options.add(candidate);
    }
  }
  return {
    expression,
    answer,
    options: Array.from(options).sort(() => Math.random() - 0.5),
  };
}

export default function SpeedArithmeticRush() {
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [question, setQuestion] = useState<Question>(() => generateQuestion());
  const [score, setScore] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  function startGame() {
    setTimeLeft(60);
    setIsRunning(true);
    setScore(0);
    setAttempted(0);
    setStreak(0);
    setBestStreak(0);
    setQuestion(generateQuestion());
  }

  function handleAnswer(option: number) {
    if (!isRunning) return;
    setAttempted((prev) => prev + 1);
    if (option === question.answer) {
      setScore((prev) => prev + 1);
      setStreak((prev) => {
        const next = prev + 1;
        setBestStreak((best) => Math.max(best, next));
        return next;
      });
    } else {
      setStreak(0);
    }
    setQuestion(generateQuestion());
  }

  const accuracy = useMemo(() => {
    if (attempted === 0) return 0;
    return (score / attempted) * 100;
  }, [score, attempted]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Brain Game</p>
          <h2 className="text-2xl font-semibold text-slate-900">Speed Arithmetic Rush</h2>
          <p className="text-sm text-slate-600">
            Jawab sebanyak mungkin operasi dasar dalam 60 detik. Kecepatan dan akurasi dihitung!
          </p>
        </div>
        <button
          type="button"
          onClick={startGame}
          className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
        >
          {isRunning ? "Mulai ulang" : "Mulai"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sisa waktu" value={`${timeLeft}s`} />
        <StatCard label="Skor" value={`${score}`} />
        <StatCard label="Akurasi" value={`${accuracy.toFixed(1)}%`} />
        <StatCard label="Streak terbaik" value={`${bestStreak}`} />
      </div>

      <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Ekspresi</p>
        <p className="mt-2 text-4xl font-semibold text-slate-900">{question.expression}</p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {question.options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handleAnswer(option)}
            disabled={!isRunning}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60"
          >
            {option}
          </button>
        ))}
      </div>
    </section>
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
