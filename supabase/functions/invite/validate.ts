export type Role = "staff" | "manager";
export interface Invite {
  email: string;
  full_name: string;
  role: Role;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateInvite(body: unknown): Invite | null {
  if (!body || typeof body !== "object") return null;
  const { email, full_name, role } = body as Record<string, unknown>;
  if (typeof email !== "string" || typeof full_name !== "string") return null;
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = full_name.trim();
  if (!EMAIL.test(cleanEmail) || cleanName === "") return null;
  if (role !== "staff" && role !== "manager") return null;
  return { email: cleanEmail, full_name: cleanName, role };
}
