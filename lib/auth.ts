import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { connectMongo } from "./MongoDB";
import { UserModel } from "./models";
import { AUTH_COOKIE_NAME, AUTH_MAX_AGE } from "./constants";

const envJwtSecret = process.env.JWT_SECRET;

if (!envJwtSecret) {
  throw new Error("JWT_SECRET is not configured.");
}

const JWT_SECRET: string = envJwtSecret;

const BCRYPT_ROUNDS = 12;

export type AuthTokenPayload = {
  userId: string;
  iat?: number;
  exp?: number;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signJwt(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "7d",
  });
}

export function verifyJwt(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch (error) {
    console.error("Failed to verify JWT:", error);
    return null;
  }
}

async function fetchUserById(userId: string): Promise<PublicUser | null> {
  await connectMongo();
  const user = await UserModel.findById(userId).lean<{
    _id: string;
    email: string;
    name: string | null;
    createdAt: Date;
  }>();

  if (!user) {
    return null;
  }

  return {
    id: user._id,
    email: user.email,
    name: user.name ?? null,
    createdAt: user.createdAt,
  };
}

export async function getCurrentUser(req: NextRequest): Promise<PublicUser | null> {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  const payload = verifyJwt(token);
  if (!payload?.userId) {
    return null;
  }
  return fetchUserById(payload.userId);
}

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export async function getCurrentUserFromCookies(
  cookieStore?: CookieStore
): Promise<PublicUser | null> {
  const store = cookieStore ?? (await cookies());
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  const payload = verifyJwt(token);
  if (!payload?.userId) {
    return null;
  }
  return fetchUserById(payload.userId);
}

export async function setAuthCookie(token: string) {
  const store = await cookies();
  store.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
}

export async function clearAuthCookie() {
  const store = await cookies();
  store.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });
}
