'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type CategoryAccuracy = {
  category: string;
  correct: number;
  total: number;
  accuracy: number;
};

type SessionSummary = {
  id: string;
  startedAt: string;
  completedAt: string | null;
  questionCount: number;
  correctCount: number;
  accuracy: number;
};

type DashboardClientProps = {
  data: {
    totalSessionsCompleted: number;
    totalQuestionsAnswered: number;
    totalCorrect: number;
    totalIncorrect: number;
    averageAccuracy: number;
    averageTimePerQuestionSeconds: number;
    categoryAccuracy: CategoryAccuracy[];
    sessions: SessionSummary[];
  };
};

function formatDateLabel(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
}

const summaryCards = [
  {
    label: "Sesi selesai",
    key: "totalSessionsCompleted",
    formatter: (value: number) => `${value} sesi`,
  },
  {
    label: "Soal terjawab",
    key: "totalQuestionsAnswered",
    formatter: (value: number) => `${value} butir`,
  },
  {
    label: "Akurasi rata-rata",
    key: "averageAccuracy",
    formatter: (value: number) => `${value.toFixed(1)}%`,
  },
  {
    label: "Waktu per soal",
    key: "averageTimePerQuestionSeconds",
    formatter: (value: number) => `${value.toFixed(1)} detik`,
  },
] as const;

export default function DashboardClient({ data }: DashboardClientProps) {
  const sessionData = data.sessions.map((session) => ({
    ...session,
    dateLabel: formatDateLabel(session.startedAt),
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.key}
            className="rounded-3xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600 shadow-lg"
          >
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {card.formatter(data[card.key])}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-lg">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Akurasi tiap sesi
          </p>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer>
              <LineChart data={sessionData}>
                <CartesianGrid strokeDasharray="4 8" stroke="rgba(148, 163, 184, 0.25)" />
                <XAxis dataKey="dateLabel" stroke="rgba(100,116,139,0.7)" tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  stroke="rgba(100,116,139,0.7)"
                  tickLine={false}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: "#ffffff",
                    borderRadius: "16px",
                    border: "1px solid #e2e8f0",
                    color: "#0f172a",
                  }}
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, "Akurasi"]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  name="Akurasi (%)"
                  stroke="#1d4ed8"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-lg">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Akurasi per kategori
          </p>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer>
              <BarChart data={data.categoryAccuracy}>
                <CartesianGrid strokeDasharray="4 8" stroke="rgba(148, 163, 184, 0.25)" />
                <XAxis
                  dataKey="category"
                  stroke="rgba(100,116,139,0.7)"
                  tickLine={false}
                  tickFormatter={(value) => value.replace(/_/g, " ")}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="rgba(100,116,139,0.7)"
                  tickLine={false}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: "#ffffff",
                    borderRadius: "16px",
                    border: "1px solid #e2e8f0",
                    color: "#0f172a",
                  }}
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, "Akurasi"]}
                />
                <Legend />
                <Bar dataKey="accuracy" name="Akurasi (%)" fill="#1e3a8a" radius={[12, 12, 12, 12]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-lg">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Sesi terbaru</p>
          <span className="text-xs text-slate-500">
            {data.totalSessionsCompleted > 0
              ? "Terus lanjut, progresmu indah sekali!"
              : "Mulai satu sesi dan lihat keajaibannya."}
          </span>
        </div>
        <div className="mt-4 divide-y divide-slate-200">
          {sessionData.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Belum ada sesi tersimpan. Yuk mulai latihan pertama kamu!
            </p>
          ) : (
            sessionData.map((session) => (
              <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{session.dateLabel}</p>
                  <p className="text-xs text-slate-500">
                    {session.questionCount} soal - {session.correctCount} benar
                  </p>
                </div>
                <div className="text-xs font-semibold text-slate-900">
                  {session.accuracy.toFixed(1)}%
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}



