import StartPublicSessionButton from "@/components/start-public-session-button";
import StartPublicDuelButton from "@/components/start-public-duel-button";
import JoinTestDuelCard from "@/components/join-test-duel-card";
import { listPublicSessions } from "@/lib/test-sessions";

export const dynamic = "force-dynamic";

const MODE_LABELS: Record<string, string> = {
  santai: "Santai",
  serius: "Serius",
  simulasi: "Simulasi",
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatSeconds(seconds: number | null) {
  if (seconds == null) return "-";
  if (seconds < 60) return `${seconds} detik/soal`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) return `${minutes} menit/soal`;
  return `${minutes} menit ${secs} detik/soal`;
}

export default async function PublicSessionsPage() {
  const sessions = await listPublicSessions();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Soal publik</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Koleksi Soal Bersama</h1>
        <p className="mt-3 text-sm text-slate-600">
          Pilih soal publik untuk langsung memulai sesi latihan tanpa harus menunggu proses
          generasi AI.
        </p>
      </section>

      <JoinTestDuelCard />

      {sessions.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 shadow-lg">
          Belum ada soal publik. Publikasikan salah satu sesi pribadimu agar teman-teman dapat
          latihan bersama.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sessions.map((session) => (
            <article
              key={session.publicId}
              className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-lg"
            >
              <div className="flex-1 space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  {formatDateTime(session.publishedAt)}
                </p>
                <h2 className="text-lg font-semibold text-slate-900">{session.title}</h2>
                <p className="text-xs text-slate-500">
                  Mode {MODE_LABELS[session.userType] ?? session.userType} - {session.questionCount} soal
                  - Timer {formatSeconds(session.customDurationSeconds)}
                </p>
                <p className="text-xs text-slate-500">
                  Dibagikan oleh {session.author.name ?? session.author.email}
                </p>
              </div>
              <div className="mt-6">
                <div className="flex gap-2">
                  <StartPublicSessionButton publicId={session.publicId} className="w-full" />
                  <StartPublicDuelButton publicId={session.publicId} className="w-full" />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

