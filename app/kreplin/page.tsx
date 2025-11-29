import Link from "next/link";
import { getCurrentUserFromCookies } from "@/lib/auth";
import { listKreplinResults } from "@/lib/kreplin";

export const dynamic = "force-dynamic";

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function KreplinPage() {
  const user = await getCurrentUserFromCookies();
  const history = user ? await listKreplinResults(user.id, 6) : [];

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Tes Koran / Kreplin</p>
            <h1 className="text-3xl font-semibold text-slate-900">Latihan fokus & konsistensi</h1>
            <p className="text-sm leading-relaxed text-slate-600">
              Pilih mode latihan ringan atau langsung simulasi 60 kolom ala tes kerja asli. Hasilnya
              disimpan otomatis lengkap dengan grafik per kolom dan kecepatan per menit supaya
              bisa memantau perkembangan winniee.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/kreplin/test?mode=tryout"
                className="rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-sky-500"
              >
                Mulai Try Out (60 kolom)
              </Link>
              <Link
                href="/kreplin/test?mode=auto&duration=600"
                className="rounded-full border border-sky-200 px-5 py-3 text-sm font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-50"
              >
                Latihan 10 menit
              </Link>
              <Link
                href="/kreplin/duel"
                className="rounded-full border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
              >
                Duel mode (beta)
              </Link>
            </div>
          </div>
          <div className="space-y-5 rounded-3xl border border-slate-100 bg-slate-50 p-6">
            <h2 className="text-base font-semibold text-slate-900">Mode latihan bebas</h2>
            <div className="space-y-3 text-sm text-slate-600">
              <p>Pilih durasi cepat:</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[300, 600, 900].map((seconds) => (
                  <Link
                    key={seconds}
                    href={`/kreplin/test?mode=auto&duration=${seconds}`}
                    className="rounded-2xl border border-sky-100 bg-white px-4 py-3 text-center font-semibold text-sky-800 transition hover:border-sky-300 hover:bg-sky-50"
                  >
                    {Math.round(seconds / 60)} menit
                  </Link>
                ))}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                <p className="text-sm font-semibold text-slate-700">Atau durasi custom (menit)</p>
                <form action="/kreplin/test" className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="mode" value="auto" />
                  <input
                    type="number"
                    name="minutes"
                    min={1}
                    max={120}
                    placeholder="contoh 12"
                    required
                    className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-center text-sm focus:border-slate-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
                  >
                    Mulai
                  </button>
                  <span className="text-xs text-slate-500">
                    Mode manual bisa dipilih di layar tes.
                  </span>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Riwayat terbaru</p>
            <h2 className="text-xl font-semibold text-slate-900">Progress Tes Koran</h2>
          </div>
          <Link
            href="/kreplin/results"
            className="text-sm font-semibold text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
          >
            Lihat semua hasil
          </Link>
        </div>

        {history.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            Belum ada hasil tersimpan. Mulai satu sesi dan grafik akurasi akan muncul di sini.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.25em] text-slate-400">
                  <th className="py-3 pr-4">Tanggal</th>
                  <th className="py-3 pr-4">Mode</th>
                  <th className="py-3 pr-4">Durasi</th>
                  <th className="py-3 pr-4">Akurasi</th>
                  <th className="py-3 pr-4">Jawaban</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pr-4">{formatDate(item.createdAt)}</td>
                    <td className="py-3 pr-4 capitalize">{item.mode}</td>
                    <td className="py-3 pr-4">{Math.round(item.durationSeconds / 60)} menit</td>
                    <td className="py-3 pr-4 font-semibold text-slate-900">
                      {item.accuracy.toFixed(1)}%
                    </td>
                    <td className="py-3 pr-4">
                      {item.totalCorrect}/{item.totalAnswered}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
