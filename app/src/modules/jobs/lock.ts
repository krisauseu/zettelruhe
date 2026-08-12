/**
 * DB-Lock in PocketBase gegen Doppelausführung (ADR-0010).
 * Create-with-unique-key + TTL; abgelaufene Locks werden übernommen.
 */

import {
  createRecord,
  getRecord,
  listRecords,
  pbEq,
  updateRecord,
} from "@/lib/pb";
import type { JobLock } from "./types";

const COL = "job_locks";

/** Default Lock-TTL (Job sollte kürzer laufen) */
export const DEFAULT_LOCK_TTL_MS = 5 * 60 * 1000;

type PbLock = {
  id: string;
  key: string;
  holder: string;
  expires_at: string;
};

function mapLock(r: PbLock): JobLock {
  return {
    id: r.id,
    key: r.key,
    holder: r.holder,
    expires_at: r.expires_at,
  };
}

function expiresAtIso(now: Date, ttlMs: number): string {
  return new Date(now.getTime() + ttlMs).toISOString();
}

export async function getLockByKey(key: string): Promise<JobLock | null> {
  try {
    const result = await listRecords<PbLock>(COL, {
      page: 1,
      perPage: 1,
      filter: pbEq("key", key),
    });
    if (result.items.length === 0) return null;
    return mapLock(result.items[0]);
  } catch {
    return null;
  }
}

/**
 * Versucht Lock zu erwerben.
 * @returns Lock bei Erfolg, null wenn von anderem Holder gehalten und nicht abgelaufen.
 */
export async function tryAcquireLock(
  key: string,
  holder: string,
  opts?: { now?: Date; ttlMs?: number },
): Promise<JobLock | null> {
  const now = opts?.now ?? new Date();
  const ttlMs = opts?.ttlMs ?? DEFAULT_LOCK_TTL_MS;
  const expires_at = expiresAtIso(now, ttlMs);
  const nowIso = now.toISOString();

  const existing = await getLockByKey(key);

  if (!existing) {
    try {
      const r = await createRecord<PbLock>(COL, {
        key,
        holder,
        expires_at,
      });
      return mapLock(r);
    } catch {
      // Race: anderer Process hat gerade angelegt
      const raced = await getLockByKey(key);
      if (!raced) return null;
      return tryTakeOver(raced, holder, now, nowIso, expires_at);
    }
  }

  return tryTakeOver(existing, holder, now, nowIso, expires_at);
}

function tryTakeOver(
  existing: JobLock,
  holder: string,
  now: Date,
  nowIso: string,
  expires_at: string,
): Promise<JobLock | null> {
  const expired = !existing.expires_at || existing.expires_at <= nowIso;
  const sameHolder = existing.holder === holder;

  if (!expired && !sameHolder) {
    return Promise.resolve(null);
  }

  return updateRecord<PbLock>(COL, existing.id, {
    holder,
    expires_at,
  }).then(mapLock);
}

/** Lock freigeben (nur eigener Holder). */
export async function releaseLock(
  key: string,
  holder: string,
): Promise<void> {
  const existing = await getLockByKey(key);
  if (!existing) return;
  if (existing.holder !== holder) return;
  // expires_at in die Vergangenheit → sofort freigeben
  await updateRecord(COL, existing.id, {
    expires_at: new Date(0).toISOString(),
  });
}

/** Prüft, ob Lock von holder gehalten und noch gültig. */
export function isLockHeldBy(
  lock: JobLock | null,
  holder: string,
  now: Date = new Date(),
): boolean {
  if (!lock) return false;
  if (lock.holder !== holder) return false;
  return lock.expires_at > now.toISOString();
}

/** Reine Hilfsfunktion für Tests: Lock abgelaufen? */
export function isLockExpired(
  lock: Pick<JobLock, "expires_at">,
  now: Date = new Date(),
): boolean {
  return !lock.expires_at || lock.expires_at <= now.toISOString();
}

export async function getLockRecord(id: string): Promise<JobLock | null> {
  try {
    const r = await getRecord<PbLock>(COL, id);
    return mapLock(r);
  } catch {
    return null;
  }
}
