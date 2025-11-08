import Link from "next/link";
import { redirect } from "next/navigation";
import AuthForm from "@/components/auth-form";
import { getCurrentUserFromCookies } from "@/lib/auth";

export default async function RegisterPage() {
  const user = await getCurrentUserFromCookies();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="grid gap-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-lg lg:grid-cols-2">
      <div className="space-y-4">
        <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-500">
          Mulai baru
        </span>
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          Buat akun dan koleksi sesi psikotes favoritmu.
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Dashboard pribadi, catatan waktu, dan statistik akurasi bakal bantu kamu berlatih lebih
          efektif. Kami sudah siapkan semuanya, tinggal kamu daftar dan mulai petualangan belajar.
        </p>
        <p className="text-xs text-slate-500">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-slate-700 underline underline-offset-4">
            Masuk di sini
          </Link>
          .
        </p>
      </div>
      <AuthForm mode="register" />
    </div>
  );
}
