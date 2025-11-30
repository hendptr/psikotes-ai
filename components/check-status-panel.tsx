'use client';

import { useEffect, useState } from "react";

type StatusUser = {
  id: string;
  email: string;
  name: string | null;
  status: "online" | "offline";
  lastOnlineAt: string | null;
};

type StatusResponse = {
  now: string;
  users: StatusUser[];
};

export default function CheckStatusPanel() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/user-status", { cache: "no-store" });
        const json = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(json?.error ?? "Gagal memuat status.");
        }
        if (active) {
          setData(json as StatusResponse);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Gagal memuat status.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchStatus();
    const intervalId = window.setInterval(fetchStatus, 60_000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  const formatTime = (value: string | null) => {
    if (!value) return "-";
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <p className="text-sm text-slate-600">Memuat status...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-lg">
        <p className="text-sm text-rose-600">{error ?? "Status tidak tersedia."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Check Status</p>
          <h1 className="text-2xl font-semibold text-slate-900">Status semua pengguna</h1>
          <p className="text-sm text-slate-600">
            Halaman admin tersembunyi. Menampilkan status online/offline seluruh user.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Server: {formatTime(data.now)}
        </div>
      </div>

      <div className="overflow-x-auto">
        {data.users && data.users.length > 0 ? (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.3em] text-slate-400">
                <th className="py-3 pr-4">User</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Terakhir online</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {data.users.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-slate-900">{item.name ?? "Tidak ada nama"}</p>
                    <p className="text-xs text-slate-500">{item.email}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        item.status === "online"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.status === "online" ? "Online" : "Offline"}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-600">
                    {formatTime(item.lastOnlineAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Belum ada data pengguna atau kredensial tidak valid.
          </p>
        )}
      </div>
    </div>
  );
}
