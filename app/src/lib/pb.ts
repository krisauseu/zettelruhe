/**
 * PocketBase-Zugriff (server-only).
 * Admin/Service über Superuser für Setup und spätere Finanz-Writes (ADR-0006).
 * Bevorzugt fetch statt SDK-XHR, um Edge/Server-Action-Stolpersteine zu vermeiden.
 */

function pbUrl(): string {
  const url = process.env.PB_URL;
  if (!url) {
    throw new Error("PB_URL ist nicht gesetzt.");
  }
  return url.replace(/\/$/, "");
}

export type NummernkreisConfig = {
  prefix: string;
  digits: number;
  next: number;
};

export type Nummernkreise = {
  angebot: NummernkreisConfig;
  rechnung: NummernkreisConfig;
  gutschrift: NummernkreisConfig;
  beleg: NummernkreisConfig;
  kasse: NummernkreisConfig;
};

export const DEFAULT_NUMMERNKREISE: Nummernkreise = {
  angebot: { prefix: "A-", digits: 4, next: 1 },
  rechnung: { prefix: "R-", digits: 4, next: 1 },
  gutschrift: { prefix: "G-", digits: 4, next: 1 },
  beleg: { prefix: "B-", digits: 4, next: 1 },
  kasse: { prefix: "K-", digits: 4, next: 1 },
};

export type Steuermodus = "kleinunternehmer" | "regelbesteuerung_ist";
export type SkrWahl = "skr03" | "skr04";

export type FirmaRecord = {
  id: string;
  name: string;
  steuermodus: Steuermodus;
  skr: SkrWahl;
  nummernkreise: Nummernkreise;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  steuernummer?: string;
  ust_id?: string;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  firma: string | null;
};

type PbList<T> = {
  items: T[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
};

let adminToken: string | null = null;
let adminTokenAt = 0;
const ADMIN_TTL_MS = 10 * 60 * 1000;

async function pbFetch<T>(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers: extraHeaders, ...rest } = init;
  const headers = new Headers(extraHeaders);
  // JSON nur bei string-Body; FormData braucht Boundary (Browser/fetch setzt Content-Type)
  if (
    !headers.has("Content-Type") &&
    rest.body &&
    typeof rest.body === "string"
  ) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", token);
  }

  const res = await fetch(`${pbUrl()}${path}`, {
    ...rest,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as {
        message?: string;
        data?: Record<string, { message?: string; code?: string }>;
      };
      detail = body.message || JSON.stringify(body);
      // Feldfehler anhängen (z. B. sortierung: Cannot be blank)
      if (body.data && typeof body.data === "object") {
        const fieldMsgs = Object.entries(body.data)
          .map(([field, err]) => {
            const msg =
              err && typeof err === "object" && "message" in err
                ? String(err.message)
                : JSON.stringify(err);
            return `${field}: ${msg}`;
          })
          .filter(Boolean);
        if (fieldMsgs.length) {
          detail = `${detail} (${fieldMsgs.join("; ")})`;
        }
      }
    } catch {
      /* ignore */
    }
    throw new Error(`PocketBase ${res.status}: ${detail}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

/** Roh-Response (Dateien, Binär) mit Superuser-Token */
export async function pbFetchRaw(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<Response> {
  const { token, headers: extraHeaders, ...rest } = init;
  const headers = new Headers(extraHeaders);
  if (token) {
    headers.set("Authorization", token);
  }
  const res = await fetch(`${pbUrl()}${path}`, {
    ...rest,
    headers,
    cache: "no-store",
  });
  return res;
}

export async function getAdminToken(): Promise<string> {
  const now = Date.now();
  if (adminToken && now - adminTokenAt < ADMIN_TTL_MS) {
    return adminToken;
  }

  const email = process.env.PB_SUPERUSER_EMAIL;
  const password = process.env.PB_SUPERUSER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD fehlen.",
    );
  }

  const result = await pbFetch<{ token: string }>(
    "/api/collections/_superusers/auth-with-password",
    {
      method: "POST",
      body: JSON.stringify({ identity: email, password }),
    },
  );

  adminToken = result.token;
  adminTokenAt = now;
  return adminToken;
}

/** True, wenn noch keine Firma existiert → Setup-Wizard */
export async function isSetupRequired(): Promise<boolean> {
  try {
    const token = await getAdminToken();
    const list = await pbFetch<PbList<{ id: string }>>(
      "/api/collections/firmen/records?page=1&perPage=1&fields=id",
      { token },
    );
    return list.totalItems === 0;
  } catch {
    return true;
  }
}

type PbFirma = {
  id: string;
  name: string;
  steuermodus: Steuermodus;
  skr: SkrWahl;
  nummernkreise: Nummernkreise;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  steuernummer?: string;
  ust_id?: string;
};

function mapFirma(r: PbFirma): FirmaRecord {
  return {
    id: r.id,
    name: r.name,
    steuermodus: r.steuermodus,
    skr: r.skr,
    nummernkreise: r.nummernkreise ?? DEFAULT_NUMMERNKREISE,
    strasse: r.strasse ?? "",
    plz: r.plz ?? "",
    ort: r.ort ?? "",
    land: r.land ?? "DE",
    steuernummer: r.steuernummer ?? "",
    ust_id: r.ust_id ?? "",
  };
}

export async function getFirstFirma(): Promise<FirmaRecord | null> {
  const token = await getAdminToken();
  const list = await pbFetch<PbList<PbFirma>>(
    "/api/collections/firmen/records?page=1&perPage=1",
    { token },
  );

  if (list.totalItems === 0) return null;
  return mapFirma(list.items[0]);
}

export async function createFirma(input: {
  name: string;
  steuermodus: Steuermodus;
  skr: SkrWahl;
}): Promise<FirmaRecord> {
  const token = await getAdminToken();
  const r = await pbFetch<{
    id: string;
    name: string;
    steuermodus: Steuermodus;
    skr: SkrWahl;
    nummernkreise: Nummernkreise;
  }>("/api/collections/firmen/records", {
    method: "POST",
    token,
    body: JSON.stringify({
      name: input.name,
      steuermodus: input.steuermodus,
      skr: input.skr,
      nummernkreise: DEFAULT_NUMMERNKREISE,
      land: "DE",
    }),
  });
  return {
    id: r.id,
    name: r.name,
    steuermodus: r.steuermodus,
    skr: r.skr,
    nummernkreise: r.nummernkreise,
  };
}

export async function createEigentuemer(input: {
  email: string;
  password: string;
  name: string;
  firmaId: string;
}): Promise<AuthUser> {
  const token = await getAdminToken();
  const r = await pbFetch<{
    id: string;
    email: string;
    name: string;
    role: string;
    firma: string;
  }>("/api/collections/users/records", {
    method: "POST",
    token,
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      passwordConfirm: input.password,
      name: input.name,
      role: "eigentuemer",
      firma: input.firmaId,
      emailVisibility: true,
    }),
  });
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    firma: r.firma || null,
  };
}

/** Login der Eigentümer:in gegen PocketBase Auth */
export async function authWithPassword(
  email: string,
  password: string,
): Promise<AuthUser> {
  const result = await pbFetch<{
    record: {
      id: string;
      email: string;
      name?: string;
      role?: string;
      firma?: string;
    };
  }>("/api/collections/users/auth-with-password", {
    method: "POST",
    body: JSON.stringify({ identity: email, password }),
  });

  const record = result.record;
  return {
    id: record.id,
    email: record.email,
    name: record.name || email,
    role: record.role || "eigentuemer",
    firma: record.firma || null,
  };
}

// --- Generische Superuser-CRUD-Helfer (ADR-0006: Writes nur serverseitig) ---

export type PbListResult<T> = {
  items: T[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
};

export type ListRecordsOptions = {
  page?: number;
  perPage?: number;
  filter?: string;
  sort?: string;
  fields?: string;
};

function encodeFilter(filter: string): string {
  return encodeURIComponent(filter);
}

export async function listRecords<T>(
  collection: string,
  options: ListRecordsOptions = {},
): Promise<PbListResult<T>> {
  const token = await getAdminToken();
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 50;
  const params = new URLSearchParams({
    page: String(page),
    perPage: String(perPage),
  });
  if (options.filter) params.set("filter", options.filter);
  if (options.sort) params.set("sort", options.sort);
  if (options.fields) params.set("fields", options.fields);

  return pbFetch<PbListResult<T>>(
    `/api/collections/${collection}/records?${params.toString()}`,
    { token },
  );
}

export async function getRecord<T>(
  collection: string,
  id: string,
): Promise<T> {
  const token = await getAdminToken();
  return pbFetch<T>(`/api/collections/${collection}/records/${id}`, {
    token,
  });
}

export async function createRecord<T>(
  collection: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = await getAdminToken();
  return pbFetch<T>(`/api/collections/${collection}/records`, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export async function updateRecord<T>(
  collection: string,
  id: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = await getAdminToken();
  return pbFetch<T>(`/api/collections/${collection}/records/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

/**
 * Record anlegen mit Datei(en) — multipart/form-data.
 * Skalare Felder als Strings; Dateien als File/Blob unter dem Feldnamen.
 */
export async function createRecordMultipart<T>(
  collection: string,
  fields: Record<string, string | Blob | null | undefined>,
): Promise<T> {
  const token = await getAdminToken();
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      fd.append(key, value);
    } else {
      fd.append(key, value);
    }
  }
  return pbFetch<T>(`/api/collections/${collection}/records`, {
    method: "POST",
    token,
    body: fd,
  });
}

/**
 * Record patchen mit optionaler Datei — multipart/form-data.
 * Zum Löschen eines File-Feldes: leeren String senden (PB-Konvention).
 */
export async function updateRecordMultipart<T>(
  collection: string,
  id: string,
  fields: Record<string, string | Blob | null | undefined>,
): Promise<T> {
  const token = await getAdminToken();
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      fd.append(key, value);
    } else {
      fd.append(key, value);
    }
  }
  return pbFetch<T>(`/api/collections/${collection}/records/${id}`, {
    method: "PATCH",
    token,
    body: fd,
  });
}

/**
 * Datei eines Records streamen (Superuser).
 * PB-Pfad: /api/files/{collection}/{recordId}/{filename}
 */
export async function fetchRecordFile(
  collection: string,
  recordId: string,
  filename: string,
): Promise<Response> {
  const token = await getAdminToken();
  const path = `/api/files/${encodeURIComponent(collection)}/${encodeURIComponent(recordId)}/${encodeURIComponent(filename)}`;
  const res = await pbFetchRaw(path, { token });
  if (!res.ok) {
    throw new Error(`Datei nicht ladbar (${res.status}).`);
  }
  return res;
}

export async function deleteRecord(
  collection: string,
  id: string,
): Promise<void> {
  const token = await getAdminToken();
  await pbFetch<void>(`/api/collections/${collection}/records/${id}`, {
    method: "DELETE",
    token,
  });
}

/** Firma per ID laden (Nummernkreise, Adresse für PDF etc.) */
export async function getFirmaById(id: string): Promise<FirmaRecord | null> {
  try {
    const token = await getAdminToken();
    const r = await pbFetch<PbFirma>(
      `/api/collections/firmen/records/${id}`,
      { token },
    );
    return mapFirma(r);
  } catch {
    return null;
  }
}

type NummernkreisKey = keyof Nummernkreise;

/**
 * Nächste Nummer aus Firmeneinstellung vergeben und Zähler erhöhen.
 * Solo-Betrieb: kein verteilter Lock.
 */
async function allocateNummernkreis(
  firmaId: string,
  key: NummernkreisKey,
  defaultPrefix: string,
): Promise<string> {
  const firma = await getFirmaById(firmaId);
  if (!firma) {
    throw new Error("Firma nicht gefunden.");
  }
  const nk = {
    ...DEFAULT_NUMMERNKREISE[key],
    ...(firma.nummernkreise?.[key] ?? {}),
  };
  const next = Number(nk.next) || 1;
  const digits = Math.max(1, Number(nk.digits) || 4);
  const prefix = typeof nk.prefix === "string" ? nk.prefix : defaultPrefix;
  const nummer = `${prefix}${String(next).padStart(digits, "0")}`;

  const updatedKreise: Nummernkreise = {
    ...DEFAULT_NUMMERNKREISE,
    ...firma.nummernkreise,
    [key]: { ...nk, next: next + 1 },
  };

  await updateRecord("firmen", firmaId, { nummernkreise: updatedKreise });
  return nummer;
}

/**
 * Nächste Belegnummer aus Firmeneinstellung vergeben und Zähler erhöhen.
 */
export async function allocateBelegnummer(firmaId: string): Promise<string> {
  return allocateNummernkreis(firmaId, "beleg", "B-");
}

/**
 * Nächste Rechnungsnummer aus Firmeneinstellung vergeben und Zähler erhöhen.
 * Erst bei Festschreibung aufrufen (Entwürfe verbrauchen keinen Nummernkreis).
 */
export async function allocateRechnungsnummer(
  firmaId: string,
): Promise<string> {
  return allocateNummernkreis(firmaId, "rechnung", "R-");
}

/**
 * Nächste Angebotsnummer aus Firmeneinstellung vergeben und Zähler erhöhen.
 * Erst beim Senden aufrufen (Entwürfe verbrauchen keinen Nummernkreis).
 */
export async function allocateAngebotsnummer(
  firmaId: string,
): Promise<string> {
  return allocateNummernkreis(firmaId, "angebot", "A-");
}

/**
 * Nächste Kassenbuch-Belegnummer aus Firmeneinstellung vergeben und Zähler erhöhen.
 * Bei Festschreibung (= Anlegen) aufrufen.
 */
export async function allocateKassenbuchBelegnummer(
  firmaId: string,
): Promise<string> {
  return allocateNummernkreis(firmaId, "kasse", "K-");
}

/** PocketBase-Filter: exakte String-Gleichheit (escaped) */
export function pbEq(field: string, value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `${field}="${escaped}"`;
}

/** LIKE-Suche (case-insensitive via PocketBase ~) */
export function pbLike(field: string, value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/%/g, "\\%");
  return `${field}~"${escaped}"`;
}

// encodeFilter exportiert für seltene manuelle Filter-Konstruktion
export { encodeFilter };
