import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { connectMongo } from "@/lib/MongoDB";
import { UserModel } from "@/lib/models";

export const runtime = "nodejs";

const updateSchema = z.object({
  membershipType: z.enum(["member", "non_member"]).optional(),
  membershipExpiresAt: z.string().trim().nullable().optional(),
  role: z.enum(["user", "admin"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "ID pengguna tidak valid." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data pembaruan tidak valid." }, { status: 400 });
    }

    await connectMongo();
    const updatePayload: Record<string, unknown> = {};

    if (parsed.data.role) {
      updatePayload.role = parsed.data.role;
    }

    if (parsed.data.membershipType) {
      updatePayload.membershipType = parsed.data.membershipType;
      if (parsed.data.membershipType === "non_member") {
        updatePayload.membershipExpiresAt = null;
      }
    }

    if (Object.prototype.hasOwnProperty.call(parsed.data, "membershipExpiresAt")) {
      const raw = parsed.data.membershipExpiresAt;
      if (raw && parsed.data.membershipType !== "non_member") {
        const parsedDate = new Date(raw);
        if (!Number.isNaN(parsedDate.getTime())) {
          updatePayload.membershipExpiresAt = parsedDate;
        } else {
          return NextResponse.json({ error: "Tanggal kedaluwarsa tidak valid." }, { status: 400 });
        }
      } else if (parsed.data.membershipType === "non_member" || !raw) {
        updatePayload.membershipExpiresAt = null;
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "Tidak ada perubahan yang dikirim." }, { status: 400 });
    }

    const updated = await UserModel.findByIdAndUpdate(userId, updatePayload, {
      new: true,
    }).lean<{
      _id: string;
      email: string;
      name: string | null;
      role: "user" | "admin";
      membershipType: "member" | "non_member";
      membershipExpiresAt: Date | null;
    }>();

    if (!updated) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: updated._id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        membershipType: updated.membershipType,
        membershipExpiresAt: updated.membershipExpiresAt,
      },
    });
  } catch (error) {
    console.error("Admin update user error:", error);
    return NextResponse.json({ error: "Gagal memperbarui status pengguna." }, { status: 500 });
  }
}
