import "./globals.css";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "I LOVEE UUU WINNNIEEE",
  description: "Kelola sesi latihan psikotes modern dengan antarmuka yang bersih dan responsif.",
};

const NAV_ITEMS = [
  { label: "Dashboard", href: "/winnieloveuu" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={`${fontSans.variable} bg-slate-100 text-slate-900 antialiased`}>
        <div className="flex min-h-screen">
          <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white px-6 py-8 lg:flex">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                PS
              </div>
              <div>
                <p className="text-base font-semibold">Loveee uuu Winnieeee!!!</p>
                <p className="text-xs text-slate-500">Tsuki Ga Kireiii Desunee???</p>
              </div>
            </div>
            <nav className="mt-10 space-y-1 text-sm">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <span>{item.label}</span>
                </a>
              ))}
            </nav>
            <div className="mt-auto rounded-2xl bg-slate-900 px-4 py-4 text-xs text-slate-200">
              <p className="font-semibold text-white">Tips cepat</p>
              <p className="mt-2">
                Simpan Session ID setiap kali selesai agar progres bisa dilanjutkan dari perangkat lain.
              </p>
            </div>
          </aside>

          <div className="flex min-h-screen flex-1 flex-col">
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">WINNIEEE MANUELAAAA</p>
                <p className="text-sm font-semibold text-slate-800">Semoga bisa bantu winniee!</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>Winnie Winnieeeeee Cantikkkkkkkkkk</span>
              </div>
            </header>

            <main className="flex-1 px-5 py-8 md:px-8 md:py-10">{children}</main>

            <footer className="border-t border-slate-200 bg-white px-5 py-4 text-xs text-slate-500 md:px-8">
              <span>Lovee u Winnieee -Kadek.</span>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
