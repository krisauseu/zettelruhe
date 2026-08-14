"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const FLASH_KEYS = [
  "saved",
  "created",
  "festgeschrieben",
  "gesendet",
  "storniert",
  "deleted",
  "status",
  "fromAngebot",
  "zahlung",
  "zahlungGeloescht",
  "mail",
  "erinnerung",
  "success",
] as const;

const FLASH_MESSAGES: Record<(typeof FLASH_KEYS)[number], string> = {
  saved: "Gespeichert.",
  created: "Angelegt.",
  festgeschrieben: "Festgeschrieben.",
  gesendet: "Gesendet.",
  storniert: "Storno ausgeführt.",
  deleted: "Gelöscht.",
  status: "Status aktualisiert.",
  fromAngebot: "Rechnung aus Angebot übernommen.",
  zahlung: "Zahlung erfasst.",
  zahlungGeloescht: "Zahlung gelöscht.",
  mail: "E-Mail gesendet.",
  erinnerung: "Zahlungserinnerung gesendet.",
  success: "Erfolgreich.",
};

function resolveFlash(params: URLSearchParams): {
  text: string;
  tone: "ok";
} | null {
  const success = params.get("success");
  if (success) {
    return { text: success, tone: "ok" };
  }
  for (const key of FLASH_KEYS) {
    if (key === "success") continue;
    if (params.has(key)) {
      return { text: FLASH_MESSAGES[key], tone: "ok" };
    }
  }
  return null;
}

export function FlashToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useMemo(() => resolveFlash(params), [params]);

  function dismiss() {
    const next = new URLSearchParams(params.toString());
    next.delete("success");
    for (const key of FLASH_KEYS) {
      next.delete(key);
    }
    next.delete("mailTo");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(dismiss, 4500);
    return () => window.clearTimeout(t);
    // dismiss closes over current params; toast identity is enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto fixed right-4 top-4 z-50 max-w-sm rounded-lg border border-success/30 border-l-4 border-l-success bg-card px-4 py-3 text-sm text-foreground shadow-lg",
      )}
    >
      <div className="flex items-start gap-3">
        <p className="flex-1 leading-snug">{toast.text}</p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Hinweis schließen"
        >
          Schließen
        </button>
      </div>
    </div>
  );
}
