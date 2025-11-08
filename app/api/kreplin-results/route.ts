import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  listKreplinResults,
  saveKreplinResult,
  type KreplinResultInput,
} from "@/lib/kreplin";

const perSectionSchema = z.object({
  index: z.number().int().min(1),
  correct: z.number().int().min(0),
  total: z.number().int().min(0),
});

const speedBucketSchema = z.object({
  index: z.number().int().min(0),
  correct: z.number().int().min(0),
  total: z.number().int().min(0),
});

const payloadSchema = z.object({
  mode: z.enum(["manual", "auto", "tryout"]),
  durationSeconds: z.number().int().min(1),
  totalSections: z.number().int().min(1).nullable(),
  totalAnswered: z.number().int().min(0),
  totalCorrect: z.number().int().min(0),
  totalIncorrect: z.number().int().min(0),
  accuracy: z.number().min(0),
  perSectionStats: z.array(perSectionSchema).optional().default([]),
  speedTimeline: z.array(speedBucketSchema).optional().default([]),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await listKreplinResults(user.id, 20);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("List Kreplin results error:", error);
    return NextResponse.json({ error: "Gagal memuat riwayat hasil." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Payload tidak valid." },
        { status: 400 }
      );
    }

    const payload: KreplinResultInput = {
      ...parsed.data,
      perSectionStats: parsed.data.perSectionStats ?? [],
      speedTimeline: parsed.data.speedTimeline ?? [],
    };

    const result = await saveKreplinResult(user.id, payload);
    return NextResponse.json({ resultId: result.id });
  } catch (error) {
    console.error("Save Kreplin result error:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan hasil Tes Koran." },
      { status: 500 }
    );
  }
}
