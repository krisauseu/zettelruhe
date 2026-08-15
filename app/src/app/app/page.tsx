import Link from "next/link";
import { getSession, requireFirmaSession } from "@/lib/session";
import { getFirmaById } from "@/lib/pb";
import { formatMoneyDe } from "@/lib/money";
import {
  formatDateDe,
  SKR_LABELS,
  STEUERMODUS_LABELS,
} from "@/lib/labels";
import {
  getDashboardKennzahlen,
  periodMonth,
} from "@/modules/reporting";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const QUICK_LINKS = [
  { href: "/app/rechnungen/neu", label: "Rechnung" },
  { href: "/app/belege/neu", label: "Beleg" },
  { href: "/app/kontakte/neu", label: "Kontakt" },
  { href: "/app/zeiten/neu", label: "Zeit" },
  { href: "/app/suche", label: "Suche" },
  { href: "/app/export", label: "Export" },
] as const;

export default async function AppHomePage() {
  const session = await getSession();

  let firma: Awaited<ReturnType<typeof getFirmaById>> = null;
  let dash: Awaited<ReturnType<typeof getDashboardKennzahlen>> | null = null;
  try {
    const s = await requireFirmaSession();
    firma = await getFirmaById(s.firmaId);
    dash = await getDashboardKennzahlen(s.firmaId, periodMonth());
  } catch {
    dash = null;
  }

  const isZeroMoney = (v: string) =>
    v === "0" || v === "0.00" || v === "0,00" || Number.parseFloat(v) === 0;

  const quietMonth =
    dash != null &&
    isZeroMoney(dash.einnahmen_brutto) &&
    isZeroMoney(dash.ausgaben_brutto) &&
    dash.offene_posten_anzahl === 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Übersicht
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stammdaten und Kennzahlen light
            {dash
              ? ` · Monat ${formatDateDe(dash.zeitraum.von)} – ${formatDateDe(dash.zeitraum.bis)}`
              : ""}
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/app/suche"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Suche
          </Link>
          <Link
            href="/app/auswertungen"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Auswertungen
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Willkommen, {session?.name}</CardTitle>
          <CardDescription>
            Du bist als Eigentümer:in angemeldet.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-foreground">
          {firma ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Firma
                </dt>
                <dd className="mt-1 font-medium">{firma.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Steuer-Modus
                </dt>
                <dd className="mt-1 font-medium">
                  {STEUERMODUS_LABELS[firma.steuermodus]}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Kontenrahmen
                </dt>
                <dd className="mt-1 font-medium">{SKR_LABELS[firma.skr]}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted-foreground">
              Keine Firma gefunden. Bitte Setup erneut durchlaufen oder Support
              prüfen.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Schnellstart</CardTitle>
          <CardDescription>
            Häufige Schritte im Alltag.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {QUICK_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}
            >
              {l.label}
            </Link>
          ))}
        </CardContent>
      </Card>

      {dash ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Einnahmen (Monat)</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {formatMoneyDe(dash.einnahmen_brutto, { currency: true })}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ausgaben (Monat)</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {formatMoneyDe(dash.ausgaben_brutto, { currency: true })}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Offene Posten</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {formatMoneyDe(dash.offene_posten_summe, { currency: true })}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              <Link href="/app/zahlungen" className="text-primary hover:underline">
                {dash.offene_posten_anzahl} offen
              </Link>
            </CardContent>
          </Card>
          {dash.ust_zahllast != null ? (
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>USt-Zahllast light</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {formatMoneyDe(dash.ust_zahllast, { currency: true })}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                <Link href="/app/ust" className="text-primary hover:underline">
                  USt-Übersicht
                </Link>
                {" · "}
                <Link href="/app/zm" className="text-primary hover:underline">
                  ZM-Übersicht
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Überschuss light</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {formatMoneyDe(dash.ueberschuss_brutto, { currency: true })}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                <Link href="/app/eur" className="text-primary hover:underline">
                  zur EÜR
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {quietMonth ? (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Noch ruhiger Monat</CardTitle>
            <CardDescription>
              Keine Journal-Bewegungen und keine offenen Posten in diesem Monat.
              Starte mit Kontakt, Rechnung oder Beleg — oder importiere einen
              Kontoauszug.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-sm">
            <Link
              href="/app/kontakte/neu"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Kontakt anlegen
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link
              href="/app/rechnungen/neu"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Rechnung anlegen
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link
              href="/app/belege/neu"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Beleg anlegen
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {dash ? (
        <p className="text-xs text-muted-foreground">
          Kennzahlen basieren auf dem Buchungsjournal (Einnahmen/Ausgaben) bzw.
          Zahlungen (offene Posten). Zahlungen erzeugen in v1 kein Journal.
        </p>
      ) : null}
    </div>
  );
}
