import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Steuermodus } from "@/lib/pb";
import type { Beleg } from "./types";
import { todayBerlin } from "./invariants";

export type LieferantOption = { id: string; name: string };

type Props = {
  action: (formData: FormData) => Promise<void>;
  steuermodus: Steuermodus;
  lieferanten: LieferantOption[];
  error?: string | null;
  beleg?: Beleg | null;
  /** true = Entwurf speichern; false = neu anlegen */
  mode: "create" | "edit";
};

export function BelegForm({
  action,
  steuermodus,
  lieferanten,
  error,
  beleg,
  mode,
}: Props) {
  const showUst = steuermodus === "regelbesteuerung_ist";
  const datum = beleg?.belegdatum || todayBerlin();
  const buchungsdatum = beleg?.buchungsdatum || "";

  return (
    <form action={action} className="flex flex-col gap-4" encType="multipart/form-data">
      {beleg ? <input type="hidden" name="id" value={beleg.id} /> : null}

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="belegdatum">Belegdatum *</Label>
          <Input
            id="belegdatum"
            name="belegdatum"
            type="date"
            required
            defaultValue={datum}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="buchungsdatum">Buchungsdatum</Label>
          <Input
            id="buchungsdatum"
            name="buchungsdatum"
            type="date"
            defaultValue={buchungsdatum}
          />
          <p className="text-xs text-muted-foreground">
            Leer = Belegdatum bei der Festschreibung.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="richtung">Richtung *</Label>
          <select
            id="richtung"
            name="richtung"
            required
            defaultValue={beleg?.richtung ?? "ausgabe"}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="ausgabe">Ausgabe</option>
            <option value="einnahme">Einnahme</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lieferant">Lieferant:in</Label>
          <select
            id="lieferant"
            name="lieferant"
            defaultValue={beleg?.lieferant ?? ""}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">— optional —</option>
            {lieferanten.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kategorie">Kategorie</Label>
          <Input
            id="kategorie"
            name="kategorie"
            maxLength={120}
            placeholder="z. B. Büromaterial"
            defaultValue={beleg?.kategorie ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="konto">Konto (SKR)</Label>
          <Input
            id="konto"
            name="konto"
            maxLength={20}
            placeholder="optional"
            defaultValue={beleg?.konto ?? ""}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="betrag_netto">Netto *</Label>
          <Input
            id="betrag_netto"
            name="betrag_netto"
            required
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={beleg?.betrag_netto ?? ""}
          />
        </div>
        {showUst ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="steuersatz">USt-Satz</Label>
              <select
                id="steuersatz"
                name="steuersatz"
                defaultValue={beleg?.steuersatz || "19"}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="19">19 %</option>
                <option value="7">7 %</option>
                <option value="0">0 %</option>
                <option value="">—</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="betrag_ust">USt (optional)</Label>
              <Input
                id="betrag_ust"
                name="betrag_ust"
                inputMode="decimal"
                placeholder="auto"
                defaultValue={beleg?.betrag_ust && beleg.betrag_ust !== "0.00" ? beleg.betrag_ust : ""}
              />
            </div>
          </>
        ) : (
          <input type="hidden" name="steuersatz" value="" />
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="betrag_brutto">Brutto (optional)</Label>
          <Input
            id="betrag_brutto"
            name="betrag_brutto"
            inputMode="decimal"
            placeholder="auto"
            defaultValue={beleg?.betrag_brutto ?? ""}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notiz">Notiz</Label>
        <Textarea
          id="notiz"
          name="notiz"
          rows={2}
          maxLength={2000}
          placeholder="optional"
          defaultValue={beleg?.notiz ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="datei">
          Datei {mode === "edit" && beleg?.datei ? "(ersetzen)" : "(PDF/Bild)"}
        </Label>
        <Input
          id="datei"
          name="datei"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,.pdf,.jpg,.jpeg,.png,.webp,.gif"
          className="cursor-pointer file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
        />
        {beleg?.datei ? (
          <p className="text-xs text-muted-foreground">
            Aktuell: {beleg.datei}
          </p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        {mode === "create"
          ? "Wird als Entwurf gespeichert. Festschreibung erfolgt auf der Detailseite und schreibt ins Buchungsjournal."
          : "Nur Entwürfe sind editierbar. Nach der Festschreibung sind Metadaten und Datei unveränderbar."}
      </p>

      <div>
        <Button type="submit">
          {mode === "create" ? "Entwurf anlegen" : "Entwurf speichern"}
        </Button>
      </div>
    </form>
  );
}
