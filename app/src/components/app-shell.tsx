import Link from "next/link";
import { LogOut } from "lucide-react";
import type { SessionPayload } from "@/lib/session";
import { logoutAction } from "@/modules/platform/auth-actions";
import { Button } from "@/components/ui/button";
import { AppNav, type NavItem } from "@/components/app-nav";
import { ThemeToggle } from "@/components/theme-toggle";

/** Serializable nav config (icon keys, not React components). Gruppen light BA14. */
const NAV: NavItem[] = [
  { href: "/app", label: "Übersicht", icon: "dashboard" },
  { href: "/app/suche", label: "Suche", icon: "suche" },
  { type: "group", label: "Stammdaten" },
  { href: "/app/kontakte", label: "Kontakte", icon: "kontakte" },
  { href: "/app/katalog", label: "Katalog", icon: "katalog" },
  { href: "/app/projekte", label: "Projekte", icon: "projekte" },
  { href: "/app/firma", label: "Firma", icon: "firma" },
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
  { href: "/app/export", label: "Export", icon: "export" },
];

export function AppShell({
  session,
  children,
}: {
  session: SessionPayload;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 bg-background">
      <aside className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="border-b border-sidebar-border px-4 py-5">
          <Link
            href="/app"
            className="text-lg font-semibold tracking-tight text-sidebar-foreground"
          >
            Zettelruhe
          </Link>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {session.name}
          </p>
        </div>

        <AppNav items={NAV} />

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
        <div className="mx-auto min-h-full p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
