import "./globals.css";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import LayoutShell from "@/components/layout-shell";

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
  { label: "Dashboard", href: "/" },
  { label: "Arsip Soal", href: "/sessions" },
  { label: "About", href: "/about" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={`${fontSans.variable} bg-slate-100 text-slate-900 antialiased`}>
        <LayoutShell navItems={NAV_ITEMS}>{children}</LayoutShell>
      </body>
    </html>
  );
}
