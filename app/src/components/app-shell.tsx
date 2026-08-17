import Link from "next/link";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import type { SessionPayload } from "@/lib/session";
import { logoutAction } from "@/modules/platform/auth-actions";
import { FirmaSwitcher } from "@/modules/platform/firma-switcher";
import { Button } from "@/components/ui/button";
import { AppNav, type NavItem } from "@/components/app-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark } from "@/components/brand-mark";
import { FlashToast } from "@/components/ui/flash-toast";
import { MITGLIEDSCHAFT_ROLLE_LABELS } from "@/lib/labels";
import type { MitgliedschaftRolle } from "@/modules/platform/rechte";

/** Serializable nav config (icon keys, not React components). Gruppen kollabierbar. */
function buildNav(kannVerwalten: boolean): NavItem[] {
  const stammdaten: NavItem[] = [
    { type: "group", label: "Stammdaten" },
    { href: "/app/kontakte", label: "Kontakte", icon: "kontakte" },
    { href: "/app/katalog", label: "Katalog", icon: "katalog" },
    { href: "/app/projekte", label: "Projekte", icon: "projekte" },
    { href: "/app/firma", label: "Firma", icon: "firma" },
    { href: "/app/kategorien", label: "Kategorien", icon: "kategorien" },
  ];
  if (kannVerwalten) {
    stammdaten.push({
      href: "/app/nutzer",
      label: "Nutzer:innen",
      icon: "nutzer",
    });
  }
  return [
    { href: "/app", label: "Übersicht", icon: "dashboard" },
    { href: "/app/suche", label: "Suche", icon: "suche" },
    ...stammdaten,
    { type: "group", label: "Zeit & Fahrten" },
    { href: "/app/zeiten", label: "Zeiten", icon: "zeiten" },
    { href: "/app/fahrten", label: "Fahrten", icon: "fahrten" },
    { type: "group", label: "Verkauf" },
    { href: "/app/angebote", label: "Angebote", icon: "angebote" },
    { href: "/app/rechnungen", label: "Rechnungen", icon: "rechnungen" },
    {
      href: "/app/wiederkehrende-rechnungen",
      label: "Wiederkehrend",
      icon: "wiederkehrend",
    },
    { href: "/app/zahlungen", label: "Zahlungen", icon: "zahlungen" },
    { type: "group", label: "Belege & Kasse" },
    { href: "/app/belege", label: "Belege", icon: "belege" },
    { href: "/app/e-rechnungen", label: "E-Rechnungen", icon: "e-rechnungen" },
    { href: "/app/kassenbuch", label: "Kassenbuch", icon: "kassenbuch" },
    { href: "/app/bankkonten", label: "Bankkonten", icon: "bankkonten" },
    { href: "/app/kontoauszug", label: "Kontoauszug", icon: "kontoauszug" },
    { href: "/app/journal", label: "Buchungsjournal", icon: "journal" },
    { type: "group", label: "Auswertungen" },
    { href: "/app/auswertungen", label: "Auswertungen", icon: "auswertungen" },
    { href: "/app/eur", label: "EÜR", icon: "eur" },
    { href: "/app/ust", label: "USt-Übersicht", icon: "ust" },
    { href: "/app/zm", label: "ZM-Übersicht", icon: "zm" },
    { href: "/app/export", label: "Export", icon: "export" },
  ];
}

export function AppShell({
  session,
  firmen,
  children,
  kannFirmaAnlegen,
  kannVerwalten,
  kannSchreiben,
  mitgliedschaftRolle,
}: {
  session: SessionPayload;
  firmen: { id: string; name: string }[];
  children: React.ReactNode;
  kannFirmaAnlegen: boolean;
  kannVerwalten: boolean;
  kannSchreiben: boolean;
  mitgliedschaftRolle: MitgliedschaftRolle | null;
}) {
  return (
    <div className="flex min-h-full flex-1 bg-background">
      <aside className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="relative border-b border-sidebar-border px-4 py-5">
          <div
            className="absolute inset-x-0 top-0 h-0.5 bg-primary"
            aria-hidden
          />
          <Link href="/app" className="inline-flex rounded-sm">
            <BrandMark />
          </Link>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {session.name}
            {mitgliedschaftRolle
              ? ` · ${MITGLIEDSCHAFT_ROLLE_LABELS[mitgliedschaftRolle]}`
              : ""}
          </p>
          <FirmaSwitcher
            firmen={firmen}
            activeFirmaId={session.firmaId}
            kannFirmaAnlegen={kannFirmaAnlegen}
          />
        </div>

        <AppNav items={buildNav(kannVerwalten)} />

        <div className="mt-auto space-y-1 border-t border-sidebar-border p-3">
          <ThemeToggle />
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground/80"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Abmelden
            </Button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Suspense fallback={null}>
          <FlashToast />
        </Suspense>
        {!kannSchreiben && mitgliedschaftRolle === "lesen" ? (
          <div
            className="border-b border-border bg-muted/40 px-6 py-2 text-sm text-muted-foreground md:px-8"
            role="status"
          >
            Lesezugriff auf diese Firma — Änderungen sind nicht erlaubt.
          </div>
        ) : null}
        <div className="mx-auto min-h-full p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
