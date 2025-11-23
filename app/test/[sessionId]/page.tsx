import { notFound, redirect } from "next/navigation";
import { getCurrentUserFromCookies } from "@/lib/auth";
import { getSessionForUser, type SessionDetail } from "@/lib/test-sessions";
import TestRunner from "./test-runner";

export const dynamic = "force-dynamic";

function serializeSession(session: SessionDetail) {
  return {
    sessionId: session.id,
    userType: session.userType,
    category: session.category,
    difficulty: session.difficulty,
    questionCount: session.questionCount,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt ? session.completedAt.toISOString() : null,
    score: session.score,
    customDurationSeconds: session.customDurationSeconds,
    questions: session.questions,
    answers: session.answers,
    isDraft: session.isDraft,
    draftQuestionIndex: session.draftQuestionIndex,
    draftTimerSeconds: session.draftTimerSeconds,
  };
}

const labels: Record<string, string> = {
  santai: "Santai",
  serius: "Serius",
  simulasi: "Simulasi",
  mixed: "Campuran",
  padanan_kata: "Padanan Kata",
  sinonim_antonim: "Sinonim & Antonim",
  hafalan_kata: "Hafalan Kata",
  deret_matematika: "Deret Matematika",
  perbandingan_senilai_berbalik: "Perbandingan Senilai & Berbalik Nilai",
  mudah: "Mudah",
  sedang: "Sedang",
  sulit: "Sulit",
};

type SessionParams = { sessionId: string };

export default async function SessionPage({
  params,
}: {
  params: SessionParams | Promise<SessionParams>;
}) {
  const { sessionId } = await Promise.resolve(params);
  const user = await getCurrentUserFromCookies();
  if (!user) {
    redirect("/login");
  }

  const session = await getSessionForUser(user.id, sessionId);
  if (!session) {
    notFound();
  }

  const clientSession = serializeSession(session);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Sesi latihan psikotes
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">Tetap fokus selesaikan sesi ini.</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
              Mode: {labels[session.userType] ?? session.userType}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
              Tema: {labels[session.category] ?? session.category}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
              Level: {labels[session.difficulty] ?? session.difficulty}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
              {session.questionCount} Soal
            </span>
          </div>
        </div>
      </div>
      <TestRunner session={clientSession} />
    </div>
  );
}

