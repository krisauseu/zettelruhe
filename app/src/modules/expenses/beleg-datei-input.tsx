"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  compressBelegImage,
  isPdfBelegDatei,
  isRasterBelegBild,
} from "./compress-beleg-image";

const ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif";

type Props = {
  mode: "create" | "edit";
  currentName?: string;
};

function formatDateiGroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} Byte`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}

function setSubmitBusy(form: HTMLFormElement | null, busy: boolean): void {
  if (!form) return;
  for (const el of form.querySelectorAll<HTMLButtonElement>(
    "button[type=submit], button:not([type]), input[type=submit]",
  )) {
    el.disabled = busy;
  }
}

export function BelegDateiInput({ mode, currentName }: Props) {
  const genRef = useRef(0);
  const [status, setStatus] = useState<string | null>(null);

  async function onChange(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = e.target;
    const file = input.files?.[0];
    const gen = ++genRef.current;
    const form = input.closest("form");
    if (!file) {
      setStatus(null);
      setSubmitBusy(form, false);
      return;
    }

    if (isPdfBelegDatei(file) || !isRasterBelegBild(file)) {
      setStatus(null);
      setSubmitBusy(form, false);
      return;
    }

    setStatus("Foto wird verkleinert…");
    setSubmitBusy(form, true);
    try {
      const next = await compressBelegImage(file);
      if (gen !== genRef.current) return;
      if (next !== file) {
        const dt = new DataTransfer();
        dt.items.add(next);
        input.files = dt.files;
      }
      setStatus(`Bereit (ca. ${formatDateiGroesse(next.size)})`);
    } catch {
      if (gen !== genRef.current) return;
      setStatus("Verkleinerung fehlgeschlagen, Original wird verwendet.");
    } finally {
      if (gen === genRef.current) {
        setSubmitBusy(form, false);
      }
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="datei">
        Datei {mode === "edit" && currentName ? "(ersetzen)" : "(PDF/Bild)"}
      </Label>
      <Input
        id="datei"
        name="datei"
        type="file"
        accept={ACCEPT}
        onChange={onChange}
        className="cursor-pointer file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
      />
      {status ? (
        <p className="text-xs text-muted-foreground">{status}</p>
      ) : null}
      {currentName ? (
        <p className="text-xs text-muted-foreground">Aktuell: {currentName}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Fotos werden vor dem Speichern verkleinert. PDF bleibt unverändert.
      </p>
    </div>
  );
}
