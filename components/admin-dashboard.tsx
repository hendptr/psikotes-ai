'use client';

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/config";
import { useToast } from "@/components/toast-provider";

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  role: "user" | "admin";
  membershipType: "member" | "non_member";
  membershipExpiresAt: string | null;
  createdAt: string;
};

type AdminBook = {
  id: string;
  title: string;
  author: string;
  isPublic: boolean;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string;
};

type AdminSession = {
  id: string;
  category: string;
  difficulty: string;
  isPublic: boolean;
  updatedAt: string;
  userName: string | null;
  userEmail: string;
  publicId: string | null;
};

type AdminDashboardProps = {
  users: AdminUser[];
  books: AdminBook[];
  sessions: AdminSession[];
};

const MEMBERSHIP_LABELS: Record<AdminUser["membershipType"], string> = {
  member: "Member",
  non_member: "Non member",
};

const ROLE_LABELS: Record<AdminUser["role"], string> = {
  user: "User",
  admin: "Admin",
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDateOnly(value: string | null) {
  if (!value) return "";
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export default function AdminDashboard({ users, books, sessions }: AdminDashboardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [updatingBookId, setUpdatingBookId] = useState<string | null>(null);
  const [updatingSessionId, setUpdatingSessionId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "user" as "user" | "admin",
    membershipType: "non_member" as "member" | "non_member",
    membershipExpiresAt: "",
  });

  const totalMembers = useMemo(
    () => users.filter((user) => user.membershipType === "member").length,
    [users]
  );

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    setError(null);
    setCreating(true);
    try {
      const payload = {
        ...newUser,
        membershipExpiresAt:
          newUser.membershipType === "member" && newUser.membershipExpiresAt
            ? newUser.membershipExpiresAt
            : null,
      };
      const response = await fetch(`${API_BASE}/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal membuat pengguna.");
      }
      showToast("Pengguna baru berhasil dibuat.", { variant: "success" });
      setNewUser({
        name: "",
        email: "",
        password: "",
        role: "user",
        membershipType: "non_member",
        membershipExpiresAt: "",
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat pengguna.");
    } finally {
      setCreating(false);
    }
  }

  async function handleUserUpdate(event: React.FormEvent<HTMLFormElement>, userId: string) {
    event.preventDefault();
    if (updatingUserId) return;
    const formData = new FormData(event.currentTarget);
    const membershipType = (formData.get("membershipType") as AdminUser["membershipType"]) ?? "non_member";
    const role = (formData.get("role") as AdminUser["role"]) ?? "user";
    const rawExpiry =
      membershipType === "member" ? (formData.get("membershipExpiresAt") as string | null) : null;

    setError(null);
    setUpdatingUserId(userId);
    try {
      const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipType,
          membershipExpiresAt: rawExpiry || null,
          role,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal memperbarui pengguna.");
      }
      showToast("Status pengguna diperbarui.", { variant: "success" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui pengguna.");
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function handleBookToggle(bookId: string, isPublic: boolean) {
    if (updatingBookId) return;
    setError(null);
    setUpdatingBookId(bookId);
    try {
      const response = await fetch(`${API_BASE}/admin/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal memperbarui status buku.");
      }
      showToast("Status buku diperbarui.", { variant: "success" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui status buku.");
    } finally {
      setUpdatingBookId(null);
    }
  }

  async function handleSessionToggle(sessionId: string, isPublic: boolean) {
    if (updatingSessionId) return;
    setError(null);
    setUpdatingSessionId(sessionId);
    try {
      const response = await fetch(`${API_BASE}/admin/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal memperbarui status arsip.");
      }
      showToast("Status arsip diperbarui.", { variant: "success" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui status arsip.");
    } finally {
      setUpdatingSessionId(null);
    }
  }

  return (
    <div className="space-y-10">
      {error && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </p>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Pengguna aktif</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{users.length} pengguna</h2>
          </div>
          <div className="text-sm text-slate-600">
            <p>Total member aktif: {totalMembers}</p>
            <p>{books.length} buku · {sessions.length} arsip terbaru</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Buat pengguna baru</h2>
        <p className="mt-1 text-sm text-slate-500">
          Gunakan untuk menambahkan anggota tim atau akun percobaan dengan status membership tertentu.
        </p>
        <form onSubmit={handleCreateUser} className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Nama</label>
            <input
              name="name"
              value={newUser.name}
              onChange={(event) => setNewUser((prev) => ({ ...prev, name: event.target.value }))}
              required
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Email</label>
            <input
              name="email"
              type="email"
              value={newUser.email}
              onChange={(event) => setNewUser((prev) => ({ ...prev, email: event.target.value }))}
              required
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Password</label>
            <input
              name="password"
              type="password"
              value={newUser.password}
              onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
              required
              minLength={6}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Role</label>
              <select
                name="role"
                value={newUser.role}
                onChange={(event) =>
                  setNewUser((prev) => ({ ...prev, role: event.target.value as "user" | "admin" }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Membership</label>
              <select
                name="membershipType"
                value={newUser.membershipType}
                onChange={(event) =>
                  setNewUser((prev) => ({
                    ...prev,
                    membershipType: event.target.value as "member" | "non_member",
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              >
                <option value="non_member">Non member</option>
                <option value="member">Member</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Berakhir (opsional)
            </label>
            <input
              type="date"
              name="membershipExpiresAt"
              value={newUser.membershipExpiresAt}
              onChange={(event) =>
                setNewUser((prev) => ({ ...prev, membershipExpiresAt: event.target.value }))
              }
              disabled={newUser.membershipType !== "member"}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm disabled:bg-slate-50"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {creating ? "Menyimpan..." : "Buat pengguna"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Daftar pengguna</h2>
        <p className="mt-1 text-sm text-slate-500">Edit membership, tanggal berakhir, dan role.</p>
        <div className="mt-4 space-y-4">
          {users.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada pengguna.</p>
          ) : (
            users.map((user) => (
              <form
                key={user.id}
                onSubmit={(event) => handleUserUpdate(event, user.id)}
                className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{user.name ?? "-"}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                  <div className="text-xs text-slate-500">
                    Dibuat {formatDate(user.createdAt)}
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-4">
                  <label className="text-xs text-slate-500">
                    Role
                    <select
                      name="role"
                      defaultValue={user.role}
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <label className="text-xs text-slate-500">
                    Membership
                    <select
                      name="membershipType"
                      defaultValue={user.membershipType}
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="non_member">Non member</option>
                      <option value="member">Member</option>
                    </select>
                  </label>
                  <label className="text-xs text-slate-500">
                    Berakhir
                    <input
                      type="date"
                      name="membershipExpiresAt"
                      defaultValue={formatDateOnly(user.membershipExpiresAt)}
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={updatingUserId === user.id}
                      className="w-full rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
                    >
                      {updatingUserId === user.id ? "Menyimpan..." : "Simpan"}
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Status: {ROLE_LABELS[user.role]} · {MEMBERSHIP_LABELS[user.membershipType]}
                  {user.membershipType === "member" && user.membershipExpiresAt
                    ? ` · s/d ${formatDate(user.membershipExpiresAt)}`
                    : ""}
                </div>
              </form>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Perpustakaan digital</h2>
            <p className="text-sm text-slate-500">Atur visibilitas buku.</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {books.length === 0 ? (
            <p className="text-sm text-slate-500">Tidak ada buku terbaru.</p>
          ) : (
            books.map((book) => (
              <div
                key={book.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{book.title}</p>
                  <p className="text-xs text-slate-500">
                    {book.author || "Anonim"} · unggah: {book.ownerName ?? book.ownerEmail}
                  </p>
                  <p className="text-xs text-slate-400">Dibuat {formatDate(book.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      book.isPublic ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {book.isPublic ? "Publik" : "Privat"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleBookToggle(book.id, !book.isPublic)}
                    disabled={updatingBookId === book.id}
                    className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
                  >
                    {updatingBookId === book.id
                      ? "Memproses..."
                      : book.isPublic
                      ? "Jadikan privat"
                      : "Terbitkan publik"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Arsip sesi</h2>
            <p className="text-sm text-slate-500">Kendalikan sesi mana yang tersedia publik.</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-500">Tidak ada arsip terbaru.</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {session.category} · {session.difficulty}
                  </p>
                  <p className="text-xs text-slate-500">
                    {session.userName ?? session.userEmail} · update {formatDate(session.updatedAt)}
                  </p>
                  {session.publicId && (
                    <p className="text-xs text-slate-400">Public ID: {session.publicId}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      session.isPublic
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {session.isPublic ? "Publik" : "Privat"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSessionToggle(session.id, !session.isPublic)}
                    disabled={updatingSessionId === session.id}
                    className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
                  >
                    {updatingSessionId === session.id
                      ? "Memproses..."
                      : session.isPublic
                      ? "Tarik publik"
                      : "Publikasikan"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
