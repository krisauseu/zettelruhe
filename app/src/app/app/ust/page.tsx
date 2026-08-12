import { requireFirmaSession } from "@/lib/session";
import { formatMoneyDe } from "@/lib/money";
import { formatDateDe, STEUERMODUS_LABELS, STEUERSATZ_LABELS } from "@/lib/labels";
import {
  getUstUebersicht,
  zeitraumFromSearchParams,
} from "@/modules/reporting";
import { ZeitraumFilter } from "@/modules/reporting/zeitraum-filter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  preset?: string;
  von?: string;
  bis?: string;
}>;

function satzLabel(s: string): string {
  if (s === "ohne") return "ohne Satz";
  return STEUERSATZ_LABELS[s] ?? s;
}

export default async function UstPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;
  const preset = (sp.preset ?? "monat").trim() || "monat";
  const zeitraum = zeitraumFromSearchParams(sp);
  const ust = await getUstUebersicht(session.firmaId, zeitraum);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          USt-Übersicht
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vorbereitung Mein Elster — kein ELSTER-Versand ·{" "}
          {formatDateDe(zeitraum.von)} – {formatDateDe(zeitraum.bis)}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Zeitraum</CardTitle>
          <CardDescription>
            Steuer-Modus: {STEUERMODUS_LABELS[ust.steuermodus]}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ZeitraumFilter zeitraum={zeitraum} preset={preset} />
        </CardContent>
      </Card>

      {!ust.verfuegbar ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Nicht relevant unter Kleinunternehmerregelung
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>{ust.hinweis}</p>
            <p className="mt-3">
              Die EÜR steht weiterhin unter{" "}
              <a href="/app/eur" className="text-primary hover:underline">
                EÜR
              </a>{" "}
              zur Verfügung.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Umsatzsteuer</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {formatMoneyDe(ust.summe_ust_einnahmen, { currency: true })}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Vorsteuer</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {formatMoneyDe(ust.summe_vorsteuer, { currency: true })}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Zahllast light</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {formatMoneyDe(ust.zahllast, { currency: true })}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                USt − Vorsteuer (negativ = Erstattung light)
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nach Steuersatz</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {ust.zeilen.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  Keine Journal-Buchungen mit USt im Zeitraum.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Steuersatz</TableHead>
                      <TableHead className="text-right">
                        Netto Einnahmen
                      </TableHead>
                      <TableHead className="text-right">USt</TableHead>
                      <TableHead className="text-right">
                        Netto Ausgaben
                      </TableHead>
                      <TableHead className="text-right">Vorsteuer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ust.zeilen.map((z) => (
                      <TableRow key={z.steuersatz}>
                        <TableCell className="font-medium">
                          {satzLabel(z.steuersatz)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoneyDe(z.netto_einnahmen, { currency: true })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoneyDe(z.ust_einnahmen, { currency: true })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoneyDe(z.netto_ausgaben, { currency: true })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoneyDe(z.vorsteuer, { currency: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hinweis</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {ust.hinweis}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
