import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";
import { getCurrentUserFromCookies } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

function serializeDashboard(data: Awaited<ReturnType<typeof getDashboardData>>) {
  return {
    totalSessionsCompleted: data.totalSessionsCompleted,
    totalQuestionsAnswered: data.totalQuestionsAnswered,
    totalCorrect: data.totalCorrect,
    totalIncorrect: data.totalIncorrect,
    averageAccuracy: data.averageAccuracy,
    averageTimePerQuestionSeconds: data.averageTimePerQuestionSeconds,
    categoryAccuracy: Object.entries(data.categoryAccuracy).map(([category, value]) => ({
      category,
      correct: value.correct,
      total: value.total,
      accuracy: value.accuracy,
    })),
    sessions: data.sessions.map((session) => ({
      ...session,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt ? session.completedAt.toISOString() : null,
    })),
  };
}

export default async function DashboardPage() {
  const user = await getCurrentUserFromCookies();
  if (!user) {
    redirect("/login");
  }

  const data = await getDashboardData(user.id);
  const serialized = serializeDashboard(data);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Dashboard pribadi</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          Halo, {user.name ?? user.email}! Ini progres latihanmu.
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Terus lanjutkan latihanmu. Kami rekap semua skor, waktu, dan akurasi supaya kamu tinggal
          fokus jadi versi terbaikmu.
        </p>
      </section>
      <DashboardClient data={serialized} />
    </div>
  );
}

