/**
 * Multi-Firma dünn: Anlegen und Wechseln (ohne Redirect).
 * Genutzt von Server Actions und Route-Handlern (Caddy-taugliche POSTs).
 */

import {
  createFirma,
  getFirmaById,
  type FirmaRecord,
} from "@/lib/pb";
import { activateFirma, type SessionPayload } from "@/lib/session";
import {
  FIRMA_NAME_DOPPELT_ERROR,
  isDuplicateFirmaNameError,
  validateFirmaWechselZiel,
  validateNeueFirmaInput,
  type NeueFirmaInput,
} from "./firma-invariants";

export async function createAndActivateFirma(
  session: SessionPayload,
  input: NeueFirmaInput,
): Promise<FirmaRecord> {
  try {
    const created = await createFirma(input);
    await activateFirma(session, created.id);
    return created;
  } catch (e) {
    if (isDuplicateFirmaNameError(e)) {
      throw new Error(FIRMA_NAME_DOPPELT_ERROR);
    }
    throw e;
  }
}

export async function switchActiveFirma(
  session: SessionPayload,
  rawFirmaId: string,
): Promise<FirmaRecord> {
  const firmaId = validateFirmaWechselZiel(rawFirmaId);
  const firma = await getFirmaById(firmaId);
  if (!firma) {
    throw new Error("Firma nicht gefunden.");
  }
  if (session.firmaId !== firma.id) {
    await activateFirma(session, firma.id);
  }
  return firma;
}
