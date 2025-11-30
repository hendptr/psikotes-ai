import { NextResponse, type NextRequest } from "next/server";
import { UserModel } from "@/lib/models";
import { connectMongo } from "@/lib/MongoDB";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await connectMongo();
  const users = await UserModel.find({})
    .sort({ lastSeenAt: -1 })
    .lean<
      Array<{
        _id: string;
        email: string;
        name: string | null;
        lastSeenAt: Date | null;
        createdAt: Date;
      }>
    >();

  const now = new Date();
  const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

  return NextResponse.json({
    users: users.map((item) => {
      const lastSeen = item.lastSeenAt ?? item.createdAt;
      const status =
        lastSeen && now.getTime() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS
          ? "online"
          : "offline";
      return {
        id: item._id,
        email: item.email,
        name: item.name,
        lastOnlineAt: lastSeen ? new Date(lastSeen).toISOString() : null,
        status,
      };
    }),
    now: now.toISOString(),
  });
}
