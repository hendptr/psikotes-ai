import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { UserModel } from "@/lib/models";
import { connectMongo } from "@/lib/MongoDB";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectMongo();
  const doc = await UserModel.findById(user.id).lean<{
    _id: string;
    email: string;
    name: string | null;
    lastSeenAt: Date | null;
    createdAt: Date;
  }>();

  if (!doc) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const previousLastSeen = doc.lastSeenAt ?? doc.createdAt;
  const now = new Date();
  await UserModel.updateOne({ _id: doc._id }, { $set: { lastSeenAt: now } });

  const status =
    previousLastSeen && now.getTime() - new Date(previousLastSeen).getTime() < ONLINE_THRESHOLD_MS
      ? "online"
      : "offline";

  return NextResponse.json({
    status,
    now: now.toISOString(),
    lastOnlineAt: previousLastSeen?.toISOString() ?? null,
    user: {
      id: doc._id,
      email: doc.email,
      name: doc.name,
    },
  });
}
