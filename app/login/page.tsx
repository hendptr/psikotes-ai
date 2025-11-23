import { redirect } from "next/navigation";
import AuthForm from "@/components/auth-form";
import { getCurrentUserFromCookies } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUserFromCookies();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="grid gap-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-lg lg:grid-cols-2">
      <div className="space-y-4">
        <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-500">
          Selamat datang kembali
        </span>
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          Lanjutkan latihan psikotes
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Masuk untuk memulihkan sesi terakhir, meninjau analitik kategori, dan menyelesaikan rencana belajar yang telah dijadwalkan.
        </p>
        <p className="text-xs text-slate-500">
          Belum punya akun? Silakan buat akun baru melalui form pendaftaran.
        </p>
      </div>
      <AuthForm mode="login" />
    </div>
  );
}
