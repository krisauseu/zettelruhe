import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session-token";

export {
  SESSION_COOKIE,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session-token";

/** Secure-Flag nur bei HTTPS-APP_URL (Self-hosted oft HTTP hinter Caddy) */
function cookieSecure(): boolean {
  return (process.env.APP_URL ?? "").startsWith("https://");
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("Nicht angemeldet.");
  }
  return session;
}

/**
 * Session + aktive Firma.
 * firmaId kommt aus der Session; ungültig/leer fällt auf die erste Firma zurück.
 */
export async function requireFirmaSession(): Promise<
  SessionPayload & { firmaId: string }
> {
  const session = await requireSession();
  // lazy import um Zirkel mit pb↔session zu vermeiden
  const { resolveAktiveFirmaId } = await import("./pb");
  const firmaId = await resolveAktiveFirmaId(session.firmaId);
  if (!firmaId) {
    throw new Error("Keine Firma vorhanden.");
  }
  return { ...session, firmaId };
}

/** Aktive Firma in der Session setzen und als users.firma merken. */
export async function activateFirma(
  session: SessionPayload,
  firmaId: string,
): Promise<void> {
  await setSessionCookie({
    userId: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
    firmaId,
  });
  const { setUserFirma } = await import("./pb");
  await setUserFirma(session.userId, firmaId);
}
