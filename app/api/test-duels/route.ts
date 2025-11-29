import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createTestDuel } from "@/lib/test-duel";

const generatedSchema = z.object({
  type: z.literal("generated"),
  userType: z.string().min(1),
  category: z.string().min(1),
  difficulty: z.string().min(1),
  count: z.number().int().min(1).max(30),
  customDurationSeconds: z.number().int().min(10).max(900).nullable().optional(),
});

const publicSchema = z.object({
  type: z.literal("public"),
  publicId: z.string().min(1),
});

const payloadSchema = z.discriminatedUnion("type", [generatedSchema, publicSchema]);

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Konfigurasi duel tidak valid." }, { status: 400 });
    }

    const { duel, sessionId } = await createTestDuel(user, parsed.data);
    return NextResponse.json({ duel, sessionId });
  } catch (error) {
    console.error("Create test duel error:", error);
    return NextResponse.json({ error: "Gagal membuat duel." }, { status: 500 });
  }
}
