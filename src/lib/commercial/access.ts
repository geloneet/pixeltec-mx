import "server-only";
import { requireUserSession, type UserSession } from "@/lib/auth/session";

export class CommercialError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(code);
  }
}
export async function requireCommercialAccess(
  admin = false,
): Promise<UserSession> {
  const session = await requireUserSession();
  if (!session) throw new CommercialError("Necesitas iniciar sesión.", 401);
  if (
    (session.role !== "admin" && session.role !== "staff") ||
    (admin && session.role !== "admin")
  ) {
    throw new CommercialError("No tienes permiso para esta acción.", 403);
  }
  return session;
}
