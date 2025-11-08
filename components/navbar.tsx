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
];

export default function Navbar({ user }: NavbarProps) {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur shadow-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 text-base font-bold text-white shadow-sm">
            WL
          </span>
          <div className="leading-tight">
            <p className="text-base font-semibold text-slate-900">Winnie Cantik</p>
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
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
                className="rounded-full px-4 py-2 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
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
              className="rounded-full border border-slate-200 px-4 py-2 text-slate-700 transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

