"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchreibenSession } from "@/lib/session";
import { markRechnungStorniert } from "@/modules/sales/repository";
import {
  festschreibenBuchung,
  getJournalEintrag,
  storniereBuchung,
} from "./repository";
import type { Buchungsrichtung, JournalBuchungInput, Steuersatz } from "./types";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function requireFirmaId(): Promise<string> {
  const session = await requireSchreibenSession();
  return session.firmaId;
}

function parseBuchungForm(formData: FormData): JournalBuchungInput {
  const richtungRaw = formString(formData, "richtung");
  const richtung: Buchungsrichtung =
    richtungRaw === "einnahme" ? "einnahme" : "ausgabe";

  const satzRaw = formString(formData, "steuersatz");
  let steuersatz: Steuersatz | "" = "";
  if (satzRaw === "0" || satzRaw === "7" || satzRaw === "19") {
    steuersatz = satzRaw;
  }

  return {
    buchungsdatum: formString(formData, "buchungsdatum"),
    belegdatum: formString(formData, "belegdatum") || undefined,
    buchungstext: formString(formData, "buchungstext"),
    richtung,
    betrag_netto: formString(formData, "betrag_netto"),
    betrag_ust: formString(formData, "betrag_ust") || undefined,
    betrag_brutto: formString(formData, "betrag_brutto") || undefined,
    steuersatz,
    konto: formString(formData, "konto") || undefined,
    quelle_typ: "manuell",
  };
}

/** Manuelle Buchung anlegen (= Festschreibung). */
export async function festschreibenManuelleBuchungAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const input = parseBuchungForm(formData);

  let id: string;
  try {
    const eintrag = await festschreibenBuchung(firmaId, input);
    id = eintrag.id;
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Festschreibung fehlgeschlagen.";
    redirect(`/app/journal/neu?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/journal");
  redirect(`/app/journal/${id}?created=1`);
}

/** Storno/Gegenbuchung zu einem festgeschriebenen Eintrag. */
export async function storniereBuchungAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/journal");

  const buchungsdatum = formString(formData, "buchungsdatum") || undefined;
  const buchungstext = formString(formData, "buchungstext") || undefined;

  const original = await getJournalEintrag(firmaId, id);
  if (!original) {
    redirect("/app/journal");
  }

  let stornoId: string;
  try {
    const storno = await storniereBuchung(firmaId, id, {
      buchungsdatum,
      buchungstext,
    });
    stornoId = storno.id;
    if (original.quelle_typ === "rechnung" && original.quelle_id) {
      await markRechnungStorniert(firmaId, original.quelle_id);
      const { listZahlungenForRechnung } = await import(
        "@/modules/payments/repository"
      );
      const { storniereZahlungsjournaleFuerRechnung } = await import(
        "@/modules/payments/journal"
      );
      const zahlungen = await listZahlungenForRechnung(
        firmaId,
        original.quelle_id,
      );
      if (zahlungen.length > 0) {
        await storniereZahlungsjournaleFuerRechnung(firmaId, zahlungen, {
          buchungsdatum,
          buchungstext: `Storno Zahlung zu Rechnung ${original.quelle_id}`,
        });
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Storno fehlgeschlagen.";
    redirect(`/app/journal/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/journal");
  revalidatePath("/app/rechnungen");
  revalidatePath("/app/auswertungen");
  revalidatePath("/app/eur");
  revalidatePath("/app/ust");
  revalidatePath("/app/zm");
  revalidatePath(`/app/journal/${id}`);
  redirect(`/app/journal/${stornoId}?storniert=1`);
}
