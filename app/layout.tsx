import "./globals.css";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Navbar from "@/components/navbar";
import { getCurrentUserFromCookies } from "@/lib/auth";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Winniee Cantikkkkk!!!",
  description:
    "Tsuki ga kirei desu ne!",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUserFromCookies();

  return (
    <html lang="id">
      <body
        className={`${fontSans.variable} bg-gradient-to-b from-sky-50 via-white to-blue-50 text-slate-900 antialiased`}
      >
        <div className="flex min-h-screen flex-col">
          <Navbar user={user} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
            {children}
          </main>
          <footer className="border-t border-slate-200 bg-white/90">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 text-xs text-slate-500 sm:px-6 lg:px-8">
              <p>I love uu Winnie!</p>
              <span>Winnie Cantik</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

