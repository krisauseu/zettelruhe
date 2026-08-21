import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import { getFirmaById } from "@/lib/pb";
import { formatMoneyDe } from "@/lib/money";
import {
  BELEG_STATUS_LABELS,
  BUCHUNGSRICHTUNG_LABELS,
  formatDateDe,
  formatDateTimeDe,
  STEUERSATZ_LABELS,
} from "@/lib/labels";
import {
  kategorieNamenFuerSelect,
  listAllKategorien,
} from "@/modules/categories";
import { listKontakte, getKontakt } from "@/modules/contacts";
import {
  deleteBelegAction,
  festschreibenBelegAction,
  getBeleg,
  updateBelegAction,
} from "@/modules/expenses";
import { BelegForm } from "@/modules/expenses/beleg-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  error?: string;
  saved?: string;
  festgeschrieben?: string;
}>;

export default async function BelegDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const { id } = await params;
  const sp = await searchParams;

  const beleg = await getBeleg(session.firmaId, id);
  if (!beleg) notFound();

  const firma = await getFirmaById(session.firmaId);
  const steuermodus = firma?.steuermodus ?? "kleinunternehmer";

  const lieferantenResult = await listKontakte(
    session.firmaId,
    { rolle: "lieferant" },
    1,
    200,
  );
  const lieferanten = lieferantenResult.items.map((k) => ({
    id: k.id,
    name: k.name,
  }));
  const kategorien = kategorieNamenFuerSelect(
    (await listAllKategorien(session.firmaId, { nurAktiv: true })).map(
      (k) => k.name,
    ),
    beleg.kategorie,
  );

  let lieferantName: string | null = null;
  if (beleg.lieferant) {
    const k = await getKontakt(session.firmaId, beleg.lieferant);
    lieferantName = k?.name ?? null;
  }

  const istEntwurf = beleg.status === "entwurf";
  const title =
    beleg.belegnummer ||
    beleg.kategorie ||
    (istEntwurf ? "Beleg-Entwurf" : "Beleg");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/app/belege"
            className="hover:text-foreground hover:underline"
          >
            ← Belege
          </Link>
        </p>
        <PageHeader
          className="mt-2"
          title={
            <span className="inline-flex flex-wrap items-center gap-2">
              {title}
              <Badge
                variant={
                  beleg.status === "festgeschrieben" ? "success" : "secondary"
                }
              >
                {BELEG_STATUS_LABELS[beleg.status]}
              </Badge>
              <Badge
                variant={beleg.richtung === "einnahme" ? "success" : "muted"}
              >
                {BUCHUNGSRICHTUNG_LABELS[beleg.richtung]}
              </Badge>
            </span>
          }
          description={
            beleg.festgeschrieben_am
              ? `Festgeschrieben am ${formatDateTimeDe(beleg.festgeschrieben_am)}`
              : "Entwurf — editierbar bis zur Festschreibung."
          }
        />
        {sp.error ? (
          <p className="mt-2 text-sm text-destructive">{sp.error}</p>
        ) : null}
        {sp.saved ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            Gespeichert.
          </p>
        ) : null}
        {sp.festgeschrieben ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            Beleg festgeschrieben und ins Buchungsjournal übernommen.
          </p>
        ) : null}
      </div>

      {!istEntwurf ? (
        <Card>
          <CardHeader>
            <CardTitle>Beleg</CardTitle>
            <CardDescription>
              Nur Lesen — festgeschriebene Belege und Dateien sind
              unveränderbar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              {beleg.belegnummer ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Belegnummer
                  </dt>
                  <dd className="mt-1 font-mono text-sm">{beleg.belegnummer}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Belegdatum
                </dt>
                <dd className="mt-1 text-sm">
                  {formatDateDe(beleg.belegdatum)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Buchungsdatum
                </dt>
                <dd className="mt-1 text-sm">
                  {formatDateDe(beleg.buchungsdatum || beleg.belegdatum)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Lieferant:in
                </dt>
                <dd className="mt-1 text-sm">
                  {lieferantName || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Kategorie
                </dt>
                <dd className="mt-1 text-sm">{beleg.kategorie || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Netto
                </dt>
                <dd className="mt-1 font-mono text-sm tabular-nums">
                  {formatMoneyDe(beleg.betrag_netto, { currency: true })}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  USt
                  {beleg.steuersatz
                    ? ` (${STEUERSATZ_LABELS[beleg.steuersatz] ?? beleg.steuersatz})`
                    : ""}
                </dt>
                <dd className="mt-1 font-mono text-sm tabular-nums">
                  {formatMoneyDe(beleg.betrag_ust, { currency: true })}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Brutto
                </dt>
                <dd className="mt-1 font-mono text-sm font-medium tabular-nums">
                  {formatMoneyDe(beleg.betrag_brutto, { currency: true })}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Konto
                </dt>
                <dd className="mt-1 text-sm">{beleg.konto || "—"}</dd>
              </div>
              {beleg.notiz ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Notiz
                  </dt>
                  <dd className="mt-1 text-sm whitespace-pre-wrap">
                    {beleg.notiz}
                  </dd>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Datei
                </dt>
                <dd className="mt-1 text-sm">
                  {beleg.datei.length > 0 ? (
                    <ul className="flex flex-col gap-1">
                      {beleg.datei.map((name) => (
                        <li key={name}>
                          <Link
                            href={`/app/belege/${beleg.id}/datei?${new URLSearchParams({ name }).toString()}`}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {name} (anzeigen/herunterladen)
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              {beleg.journal_eintrag ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Buchungsjournal
                  </dt>
                  <dd className="mt-1 text-sm">
                    <Link
                      href={`/app/journal/${beleg.journal_eintrag}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Journal-Eintrag öffnen
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Entwurf bearbeiten</CardTitle>
              <CardDescription>
                Speichern aktualisiert den Entwurf. Festschreiben erzeugt den
                Journal-Eintrag.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BelegForm
                action={updateBelegAction}
                steuermodus={steuermodus}
                lieferanten={lieferanten}
                kategorien={kategorien}
                error={sp.error ?? null}
                beleg={beleg}
                mode="edit"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Festschreiben</CardTitle>
              <CardDescription>
                Vergibt die Belegnummer, schreibt ins Buchungsjournal und
                sperrt danach Metadaten sowie Datei (GoBD-Mindeststandard).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={festschreibenBelegAction}>
                <input type="hidden" name="id" value={id} />
                <Button type="submit">Beleg festschreiben</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entwurf löschen</CardTitle>
              <CardDescription>
                Nur möglich, solange der Beleg nicht festgeschrieben ist.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={deleteBelegAction}>
                <input type="hidden" name="id" value={id} />
                <Button type="submit" variant="danger" size="sm">
                  Entwurf löschen
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
