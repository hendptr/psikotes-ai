import "./globals.css";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import AppShell from "@/components/app-shell";
import { ToastProvider } from "@/components/toast-provider";
import { getCurrentUserFromCookies } from "@/lib/auth";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Psikotes AI - Platform Latihan Psikotes Profesional",
  description: "Kelola sesi latihan adaptif, statistik mendalam, dan perpustakaan materi psikotes.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUserFromCookies();
  const membershipExpiresAt = (() => {
    if (!user?.membershipExpiresAt) return null;
    if (user.membershipExpiresAt instanceof Date) {
      return Number.isNaN(user.membershipExpiresAt.getTime())
        ? null
        : user.membershipExpiresAt.toISOString();
    }
    try {
      const parsed = new Date(user.membershipExpiresAt as string);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    } catch {
      return null;
    }
  })();

  const sidebarUser = user
    ? {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        membershipType: user.membershipType,
        membershipExpiresAt,
      }
    : null;

  return (
    <html lang="id">
      <body className={`${fontSans.variable} bg-slate-50 text-slate-900 antialiased`}>
        <ToastProvider>
          <AppShell user={sidebarUser}>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
