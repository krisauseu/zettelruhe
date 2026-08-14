"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import {
  clearBelegDatei,
  createBeleg,
  deleteBeleg,
  festschreibenBeleg,
  setBelegDatei,
  updateBeleg,
} from "./repository";
import type { BelegInput, Buchungsrichtung, Steuersatz } from "./types";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function requireFirmaId(): Promise<string> {
  const session = await requireFirmaSession();
  return session.firmaId;
}

function parseBelegForm(formData: FormData): BelegInput {
  const richtungRaw = formString(formData, "richtung");
  const richtung: Buchungsrichtung =
    richtungRaw === "einnahme" ? "einnahme" : "ausgabe";

  const satzRaw = formString(formData, "steuersatz");
  let steuersatz: Steuersatz | "" = "";
  if (satzRaw === "0" || satzRaw === "7" || satzRaw === "19") {
    steuersatz = satzRaw;
  }

  const lieferant = formString(formData, "lieferant");

  return {
    belegdatum: formString(formData, "belegdatum"),
    buchungsdatum: formString(formData, "buchungsdatum") || undefined,
    richtung,
    lieferant: lieferant || null,
    betrag_netto: formString(formData, "betrag_netto") || undefined,
    betrag_ust: formString(formData, "betrag_ust") || undefined,
    betrag_brutto: formString(formData, "betrag_brutto") || undefined,
    steuersatz,
    kategorie: formString(formData, "kategorie") || undefined,
    notiz: formString(formData, "notiz") || undefined,
    konto: formString(formData, "konto") || undefined,
  };
}

function formFile(formData: FormData, key: string): File | null {
  const v = formData.get(key);
  if (v instanceof File && v.size > 0) return v;
  return null;
}

/** Neuen Beleg-Entwurf anlegen (optional mit Datei). */
export async function createBelegAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const input = parseBelegForm(formData);
  const datei = formFile(formData, "datei");

  let id: string;
  try {
    const beleg = await createBeleg(firmaId, input, { datei });
    id = beleg.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlegen fehlgeschlagen.";
    redirect(`/app/belege/neu?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/belege");
  redirect(`/app/belege/${id}?created=1`);
}

/** Entwurf speichern. */
export async function updateBelegAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/belege");

  const input = parseBelegForm(formData);

  try {
    await updateBeleg(firmaId, id, input);
    const datei = formFile(formData, "datei");
    if (datei) {
      await setBelegDatei(firmaId, id, datei);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
    redirect(`/app/belege/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/belege");
  revalidatePath(`/app/belege/${id}`);
  redirect(`/app/belege/${id}?saved=1`);
}

/** Entwurf löschen. */
export async function deleteBelegAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/belege");

  try {
    await deleteBeleg(firmaId, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen.";
    redirect(`/app/belege/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/belege");
  redirect("/app/belege");
}

/** Datei vom Entwurf entfernen. */
export async function clearBelegDateiAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/belege");

  try {
    await clearBelegDatei(firmaId, id);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Datei konnte nicht entfernt werden.";
    redirect(`/app/belege/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath(`/app/belege/${id}`);
  redirect(`/app/belege/${id}?saved=1`);
}

/**
 * Festschreiben: Status + Journal-Eintrag (quelle_typ=beleg).
 * Danach Metadaten/Datei immutable.
 */
export async function festschreibenBelegAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/belege");

  try {
    await festschreibenBeleg(firmaId, id);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Festschreibung fehlgeschlagen.";
    redirect(`/app/belege/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/belege");
  revalidatePath("/app/journal");
  revalidatePath(`/app/belege/${id}`);
  redirect(`/app/belege/${id}?festgeschrieben=1`);
}
