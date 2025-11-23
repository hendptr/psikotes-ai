import { redirect } from "next/navigation";
import { getCurrentUserFromCookies } from "@/lib/auth";
import { connectMongo } from "@/lib/MongoDB";
import { BookModel, TestSessionModel, UserModel } from "@/lib/models";
import AdminDashboard from "@/components/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUserFromCookies();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  await connectMongo();

  const [userDocs, bookDocs, sessionDocs] = await Promise.all([
    UserModel.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean<
        Array<{
          _id: string;
          name: string | null;
          email: string;
          role: "user" | "admin";
          membershipType: "member" | "non_member";
          membershipExpiresAt: Date | null;
          createdAt: Date;
        }>
      >(),
    BookModel.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean<
        Array<{
          _id: string;
          title: string;
          author: string;
          isPublic?: boolean;
          createdAt: Date;
          createdBy?: string | null;
        }>
      >(),
    TestSessionModel.find()
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean<
        Array<{
          _id: string;
          category: string;
          difficulty: string;
          isPublic?: boolean;
          publicId?: string | null;
          updatedAt: Date;
          userId: string;
        }>
      >(),
  ]);

  const referencedUserIds = new Set<string>();
  for (const book of bookDocs) {
    if (book.createdBy) referencedUserIds.add(book.createdBy);
  }
  for (const session of sessionDocs) {
    referencedUserIds.add(session.userId);
  }

  const knownUserIds = new Set(userDocs.map((doc) => doc._id));
  const missingIds = Array.from(referencedUserIds).filter((id) => !knownUserIds.has(id));

  const extraUsers =
    missingIds.length > 0
      ? await UserModel.find({ _id: { $in: missingIds } })
          .lean<
            Array<{
              _id: string;
              name: string | null;
              email: string;
              role: "user" | "admin";
              membershipType: "member" | "non_member";
              membershipExpiresAt: Date | null;
              createdAt: Date;
            }>
          >()
      : [];

  const userMap = new Map(
    [...userDocs, ...extraUsers].map((doc) => [
      doc._id,
      {
        name: doc.name ?? null,
        email: doc.email,
        role: doc.role,
      },
    ])
  );

  function serializeDate(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }
    try {
      const parsed = new Date(value as string);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    } catch {
      return null;
    }
  }

  const users = userDocs.map((doc) => ({
    id: doc._id,
    name: doc.name ?? null,
    email: doc.email,
    role: doc.role,
    membershipType: doc.membershipType,
    membershipExpiresAt: serializeDate(doc.membershipExpiresAt),
    createdAt: doc.createdAt.toISOString(),
  }));

  const books = bookDocs.map((doc) => {
    const owner = doc.createdBy ? userMap.get(doc.createdBy) : null;
    return {
      id: doc._id,
      title: doc.title,
      author: doc.author,
      isPublic: doc.isPublic !== false,
      createdAt: doc.createdAt?.toISOString?.() ?? new Date().toISOString(),
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? "Tidak diketahui",
    };
  });

  const sessions = sessionDocs.map((doc) => {
    const owner = userMap.get(doc.userId);
    return {
      id: doc._id,
      category: doc.category,
      difficulty: doc.difficulty,
      isPublic: doc.isPublic ?? false,
      updatedAt: doc.updatedAt?.toISOString?.() ?? new Date().toISOString(),
      userName: owner?.name ?? null,
      userEmail: owner?.email ?? "Tidak diketahui",
      publicId: doc.publicId ?? null,
    };
  });

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Administrator</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Panel pengelolaan platform</h1>
        <p className="mt-3 text-sm text-slate-600">
          Tambah pengguna, atur status membership, dan kelola visibilitas buku maupun arsip sesi publik.
        </p>
      </section>
      <AdminDashboard users={users} books={books} sessions={sessions} />
    </div>
  );
}
