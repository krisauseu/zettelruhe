import { getFirstFirma } from "@/lib/pb";
import { SKR_LABELS, STEUERMODUS_LABELS } from "@/lib/labels";
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

export default async function FirmaPage() {
  const firma = await getFirstFirma();

  if (!firma) {
    return <p className="text-muted-foreground">Keine Firma vorhanden.</p>;
  }

  const nk = firma.nummernkreise;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Firma
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stammdaten und Nummernkreise-Config (ohne Nummernverbrauch).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{firma.name}</CardTitle>
          <CardDescription>Firmeneinstellungen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <dl className="grid gap-4 sm:grid-cols-2">
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

          <div>
            <h3 className="mb-3 text-sm font-medium text-foreground">
              Nummernkreise
            </h3>
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Art</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Stellen</TableHead>
                    <TableHead>Nächste Nr.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(
                    [
                      ["Angebot", nk.angebot],
                      ["Rechnung", nk.rechnung],
                      ["Gutschrift", nk.gutschrift],
                      ["Beleg", nk.beleg],
                      ["Kassenbuch", nk.kasse],
                    ] as const
                  ).map(([label, cfg]) => (
                    <TableRow key={label}>
                      <TableCell className="font-medium">{label}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {cfg.prefix}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cfg.digits}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cfg.next}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Nummern werden erst bei Festschreiben/Senden vergeben — Entwürfe
              verbrauchen keinen Nummernkreis.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
