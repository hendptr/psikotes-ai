const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function normalizeBasePath(value: string) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "";
  const stripped = trimmed.replace(/^\/+|\/+$/g, "");
  return stripped ? `/${stripped}` : "";
}

export const BASE_PATH = normalizeBasePath(rawBasePath);
export const API_BASE = `${BASE_PATH || ""}/api`;
