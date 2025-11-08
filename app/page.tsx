import { getCurrentUserFromCookies } from "@/lib/auth";
import CreateSessionForm from "@/components/create-session-form";

export const dynamic = "force-dynamic";

const highlights = [
  {
    title: "Soal adaptif",
    description: "Tsuki ga kirei desu ne Winnie chan, jadi soal soal selaluu freshh.",
  },
  {
    title: "Statistik",
    description: "I love u Winniee, ada statistiknya rapi biar kamu gampang lihat progres tiap sesi",
  },
  {
    title: "Love U Winnieeeeee",
    description: "Winniee wa totemo utsukushi desu",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUserFromCookies();

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-10 shadow-lg">
        <div className="mx-auto grid max-w-4xl gap-6 text-center">
          <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Winniee Cantikk Woy!
          </h1>
          <p className="text-base leading-relaxed text-slate-600">
            Winnie wa totemoooo utsukushii desu ne! 
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600"
            >
              <p className="text-base font-semibold text-slate-900">{item.title}</p>
              <p className="text-sm text-slate-500">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-5xl">
          <CreateSessionForm isAuthenticated={Boolean(user)} />
        </div>
      </section>
    </div>
  );
}



