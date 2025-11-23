export default function AboutPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <section className="rounded-3xl bg-white px-6 py-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Profil platform</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Tentang Psikotes AI</h1>
        <p className="mt-3 text-sm text-slate-600">
          Psikotes AI dibangun untuk membantu kandidat dan tim HR melatih kemampuan psikotes secara
          konsisten. Kami memadukan bank soal adaptif, perhitungan skor otomatis, serta insight
          berbasis data agar setiap sesi latihan memiliki tujuan yang jelas.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Tim kami berasal dari praktisi assessment, product engineer, dan content specialist yang
          fokus menyiapkan materi terbaru sesuai standar rekrutmen modern.
        </p>
      </section>

      <section className="rounded-3xl bg-white px-6 py-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Fondasi produk</h2>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-slate-600">
          <li>Bank soal terkurasi dengan tingkat kesulitan bertahap.</li>
          <li>Analitik realtime yang menyorot kecepatan, akurasi, dan pola jawaban.</li>
          <li>Perpustakaan digital lengkap dengan workspace anotasi untuk kolaborasi.</li>
        </ul>
        <p className="mt-4 text-sm text-slate-600">
          Kami terus mengembangkan ekosistem fitur agar pengguna dapat merancang eksperimen belajar
          dan memantau hasilnya tanpa perlu berpindah platform.
        </p>
      </section>
    </div>
  );
}
