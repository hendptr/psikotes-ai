'use client';

import { useEffect, useState } from "react";
import type { PublicUser } from "@/lib/auth";
import Sidebar from "./sidebar";

type SidebarUser = Pick<PublicUser, "id" | "email" | "name" | "role" | "membershipType"> & {
  membershipExpiresAt: string | null;
};

type AppShellProps = {
  user: SidebarUser | null;
  children: React.ReactNode;
};

export default function AppShell({ user, children }: AppShellProps) {
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const hasSidebar = Boolean(user);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!mobileSidebarOpen || !hasSidebar) {
      return;
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [hasSidebar, mobileSidebarOpen]);

  useEffect(() => {
    if (!hasSidebar) {
      setDesktopSidebarOpen(false);
      setMobileSidebarOpen(false);
      return;
    }
    setDesktopSidebarOpen(true);
  }, [hasSidebar]);

  function handleMenuButtonClick() {
    if (!hasSidebar) return;
    const isDesktop =
      typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false;
    if (isDesktop) {
      setDesktopSidebarOpen((prev) => !prev);
      return;
    }
    setMobileSidebarOpen(true);
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {hasSidebar && (
        <Sidebar
          user={user}
          className={`${desktopSidebarOpen ? "hidden lg:flex" : "hidden"} lg:static lg:shadow-none`}
        />
      )}

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
            <div className="flex items-center gap-3">
              {hasSidebar && (
                <button
                  type="button"
                  onClick={handleMenuButtonClick}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  <MenuIcon />
                  <span>Menu</span>
                </button>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900">Psikotes AI</p>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                  Platform latihan psikotes
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <span className="text-xs text-slate-500">
                  Hi, {user.name ?? user.email}
                </span>
              ) : (
                <span className="text-xs text-slate-500">Belum login</span>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>

        <footer className="border-t border-slate-200 bg-white/90">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 text-xs text-slate-500 sm:px-6 lg:px-10">
            <p>© {currentYear} Psikotes AI</p>
            <span>Latihan psikotes profesional</span>
          </div>
        </footer>
      </div>

      {hasSidebar && mobileSidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <Sidebar
            user={user}
            className="fixed inset-y-0 left-0 z-40 flex h-full w-72 border-r border-slate-200 bg-white shadow-2xl lg:hidden"
          />
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed top-4 right-4 z-40 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-slate-600 shadow lg:hidden"
          >
            Tutup
          </button>
        </>
      )}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      className="h-4 w-4 text-slate-500"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 6h14M3 10h10M3 14h14"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}
