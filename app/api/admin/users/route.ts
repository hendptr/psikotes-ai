import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { connectMongo } from "@/lib/MongoDB";
import { UserModel } from "@/lib/models";

export const runtime = "nodejs";

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(80),
  password: z.string().min(6),
  role: z.enum(["user", "admin"]).optional().default("user"),
  membershipType: z.enum(["member", "non_member"]).optional().default("non_member"),
  membershipExpiresAt: z.string().trim().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data pengguna tidak valid." }, { status: 400 });
    }

    const { email, name, password, role, membershipType, membershipExpiresAt } = parsed.data;
    await connectMongo();

    const existing = await UserModel.findOne({ email: email.toLowerCase() }).lean();
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    let expiresAt: Date | null = null;
    if (membershipType === "member" && membershipExpiresAt) {
      const parsedDate = new Date(membershipExpiresAt);
      if (!Number.isNaN(parsedDate.getTime())) {
        expiresAt = parsedDate;
      }
    }

    const user = await UserModel.create({
      email: email.toLowerCase(),
      name,
      passwordHash,
      role,
      membershipType,
      membershipExpiresAt: expiresAt,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        membershipType: user.membershipType,
        membershipExpiresAt: user.membershipExpiresAt,
      },
    });
  } catch (error) {
    console.error("Admin create user error:", error);
    return NextResponse.json({ error: "Gagal membuat pengguna baru." }, { status: 500 });
  }
}
