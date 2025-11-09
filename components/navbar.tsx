import Link from "next/link";
import type { PublicUser } from "@/lib/auth";
import LogoutButton from "./logout-button";

type NavbarProps = {
  user: PublicUser | null;
};

const navItems = [
  { href: "/", label: "Beranda" },
  { href: "/public-sessions", label: "Soal Soal" },
  { href: "/sessions", label: "Arsip Sesi" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/kreplin", label: "Tes Koran" },
  { href: "/brain-games", label: "Brain Games" },
];

export default function Navbar({ user }: NavbarProps) {
  return (
    <header className="border-b border-slate-100 bg-gradient-to-b from-white via-white/95 to-sky-50/60 backdrop-blur shadow-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-600 via-sky-500 to-blue-500 text-base font-bold text-white shadow-sm">
            WL
          </span>
          <div className="leading-tight">
            <p className="text-base font-semibold text-sky-900">Winnie Cantik</p>
            <p className="text-[11px] uppercase tracking-[0.28em] text-sky-400">
              Winnie Cantikk Lovee u Winniee!
            </p>
          </div>
        </Link>

        {user && (
          <nav className="hidden items-center gap-1 text-sm font-medium text-slate-600 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 transition hover:bg-sky-50 hover:text-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
          {user ? (
            <>
              <span className="hidden text-slate-500 sm:inline">Hi, {user.name ?? user.email}</span>
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-sky-200 px-4 py-2 text-sky-700 transition hover:bg-sky-600 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
            >
              Login
            </Link>
          )}
        </div>
      </div>

      {user && (
        <div className="mx-auto w-full max-w-6xl px-4 pb-3 pt-1 md:hidden">
          <nav className="flex flex-wrap gap-2 text-sm font-medium text-slate-600">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 rounded-full border border-sky-100 px-3 py-2 text-center transition hover:border-sky-300 hover:text-sky-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
