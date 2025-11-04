'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

type NavItem = {
  label: string;
  href: string;
};

type LayoutShellProps = {
  navItems: NavItem[];
  children: ReactNode;
};

export default function LayoutShell({ navItems, children }: LayoutShellProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }
  }, []);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/" || pathname === "" || pathname === undefined;
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className="relative min-h-screen bg-slate-100 text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-200 bg-white px-6 py-8 transition-transform duration-200 ease-out ${
          isSidebarOpen
            ? "translate-x-0 lg:translate-x-0 lg:opacity-100"
            : "-translate-x-full lg:-translate-x-full lg:pointer-events-none lg:opacity-0"
        }`}
        aria-hidden={!isSidebarOpen}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              WM
            </div>
            <div>
              <p className="text-base font-semibold">Loveee uuu Winnieeee!!!</p>
              <p className="text-xs text-slate-500">Tsuki Ga Kireiii Desunee???</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSidebar}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-900 hover:text-slate-900 lg:hidden"
            aria-label="Tutup sidebar"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="mt-10 space-y-1 text-sm">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const baseClass =
              "flex items-center gap-2 rounded-lg px-3 py-2 transition";
            const activeClass = active
              ? "bg-slate-900 text-white shadow"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900";

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`${baseClass} ${activeClass}`}
                onClick={() => {
                  if (typeof window !== "undefined" && window.innerWidth < 1024) {
                    closeSidebar();
                  }
                }}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {isSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          aria-label="Tutup sidebar (overlay)"
          onClick={closeSidebar}
        />
      )}

      <div
        className={`relative flex min-h-screen flex-col transition-[padding] duration-200 ease-out ${isSidebarOpen ? "lg:pl-64" : "lg:pl-0"}`}
      >
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 shadow-sm md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSidebar}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-900 hover:text-slate-900"
              aria-label="Toggle sidebar"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">WINNIEEE MANUELAAAA</p>
              <p className="text-sm font-semibold text-slate-800">Semoga bisa bantu winniee!</p>
            </div>
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
  );
}
