import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createKreplinDuel } from "@/lib/kreplin-duel";

const createSchema = z.object({
  durationSeconds: z.number().int().min(60).max(3600),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
    }

    const duel = await createKreplinDuel(user, parsed.data.durationSeconds);
    return NextResponse.json({ duel });
  } catch (error) {
    console.error("Create Kreplin duel error:", error);
    return NextResponse.json({ error: "Gagal membuat duel." }, { status: 500 });
  }
}
