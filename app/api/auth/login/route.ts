import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/MongoDB";
import { UserModel } from "@/lib/models";
import { setAuthCookie, signJwt, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Email atau password tidak valid." }, { status: 400 });
    }

    const { email, password } = parsed.data;
    await connectMongo();

    const user = await UserModel.findOne({ email: email.toLowerCase() }).lean<{
      _id: string;
      email: string;
      name: string | null;
      passwordHash: string;
      role?: "user" | "admin";
      membershipType?: "member" | "non_member";
      membershipExpiresAt?: Date | null;
    }>();

    if (!user) {
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
    }

    const token = signJwt({ userId: user._id });
    await setAuthCookie(token);
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const ua = req.headers.get("user-agent") ?? "unknown";
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: "login-success",
        userId: user._id,
        ip,
        ua,
      })
    );

    return NextResponse.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name ?? null,
        role: user.role ?? "user",
        membershipType: user.membershipType ?? "non_member",
        membershipExpiresAt: user.membershipExpiresAt ?? null,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}
