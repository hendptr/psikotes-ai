import { redirect } from "next/navigation";
import { getCurrentUserFromCookies } from "@/lib/auth";
import { listSessionsForUser } from "@/lib/test-sessions";
import SessionsList from "@/components/sessions-list";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const user = await getCurrentUserFromCookies();
  if (!user) {
    redirect("/login");
  }

  const sessions = await listSessionsForUser(user.id);
  const serializableSessions = sessions.map((session) => ({
    id: session.id,
    userType: session.userType,
    category: session.category,
    difficulty: session.difficulty,
    questionCount: session.questionCount,
    customDurationSeconds: session.customDurationSeconds,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt ? session.completedAt.toISOString() : null,
    score: session.score,
    totalAnswered: session.totalAnswered,
    totalCorrect: session.totalCorrect,
    isPublic: session.isPublic,
    publicId: session.publicId,
    isDraft: session.isDraft,
    draftSavedAt: session.draftSavedAt ? session.draftSavedAt.toISOString() : null,
    draftQuestionIndex: session.draftQuestionIndex,
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Arsip sesi</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Sesi latihan tersimpan</h1>
        <p className="mt-3 text-sm text-slate-600">
          Lihat progres latihanmu, hapus sesi yang tidak diperlukan, atau ulangi konfigurasi yang
          sama untuk memperkuat pemahamanmu.
        </p>
      </section>

      <SessionsList initialSessions={serializableSessions} />
    </div>
  );
}
