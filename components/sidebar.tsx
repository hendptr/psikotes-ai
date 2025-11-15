'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PublicUser } from "@/lib/auth";
import LogoutButton from "./logout-button";

type NavItem = {
  href: string;
  label: string;
  description: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const SIDEBAR_SECTIONS: NavSection[] = [
  {
    title: "Menu utama",
    items: [
      { href: "/dashboard", label: "Dashboard", description: "Ringkasan progres latihan" },
      { href: "/sessions", label: "Arsip Sesi", description: "Semua sesi tersimpan" },
      { href: "/public-sessions", label: "Bank Soal Publik", description: "Latihan soal siap pakai" },
      { href: "/brain-games", label: "Brain Games", description: "Mini games fokus & memori" },
    ],
  },
  {
    title: "Eksplorasi",
    items: [
      { href: "/", label: "Buat Sesi", description: "Konfigurasi latihan personal" },
      { href: "/kreplin", label: "Tes Koran", description: "Simulasi kreplin digital" },
      { href: "/books", label: "Perpustakaan", description: "Buku referensi psikotes" },
      { href: "/about", label: "Tentang Aplikasi", description: "Winniee! Love U!" },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SidebarUser = Pick<PublicUser, "id" | "email" | "name">;

type SidebarProps = {
  user: SidebarUser | null;
  className?: string;
};

export default function Sidebar({ user, className }: SidebarProps) {
  const pathname = usePathname();
  const mergedClassName = [
    "flex h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-slate-100 bg-white/90 px-6 py-8 shadow-sm",
    className ?? "hidden lg:flex",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={mergedClassName}>
      <Link href="/" className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-lg font-semibold text-white shadow">
          WL
        </span>
        <div className="leading-tight">
          <p className="text-base font-semibold text-slate-900">I Love U Winnie</p>
          <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Latihan harian</p>
        </div>
      </Link>

      <nav className="mt-10 space-y-8">
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">{section.title}</p>
            <div className="space-y-2">
              {section.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-2xl border px-4 py-3 transition ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white shadow-lg"
                        : "border-slate-100 bg-white/70 text-slate-600 hover:border-slate-200 hover:bg-white"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className={`text-xs ${active ? "text-white/75" : "text-slate-500"}`}>
                      {item.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-8 space-y-4 text-sm text-slate-600">
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 p-4">
          <p className="text-sm font-semibold text-slate-900">Sesi cepat</p>
          <p className="mt-1 text-xs">
            Konfigurasi favoritmu tersimpan otomatis. Buka kembali kapan saja.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            Buat sesi baru
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white/90 p-4">
          {user ? (
            <>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Akun</p>
              <p className="mt-2 text-base font-semibold text-slate-900">
                {user.name ?? user.email}
              </p>
              <p className="text-xs text-slate-500">{user.email}</p>
              <LogoutButton className="mt-4 w-full" />
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-900">Belum masuk</p>
              <p className="text-xs text-slate-500">Login dulu untuk menyimpan progres latihanmu.</p>
              <Link
                href="/login"
                className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
              >
                Masuk
              </Link>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
