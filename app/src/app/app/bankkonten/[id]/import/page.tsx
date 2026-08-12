import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import {
  BANK_CSV_DEFAULT_HEADER,
  getBankkonto,
  importBankCsvAction,
} from "@/modules/banking";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

export default async function BankImportPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const { id } = await params;
  const sp = await searchParams;

  const konto = await getBankkonto(session.firmaId, id);
  if (!konto) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/app/bankkonten/${id}`}
            className="hover:text-foreground hover:underline"
          >
            ← {konto.name}
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Kontoauszug importieren
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CSV light (de-DE). Doppelte Zeilen werden über den
          Idempotenz-Schlüssel übersprungen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CSV-Datei</CardTitle>
          <CardDescription>
            Default-Vorlage (Semikolon). Delimiter <code>;</code> oder{" "}
            <code>,</code>; Betrag mit Komma oder Punkt; negativ = Ausgang.
            MT940 ist für v1 nicht implementiert (Follow-up).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sp.error ? (
            <p className="text-sm text-destructive" role="alert">
              {sp.error}
            </p>
          ) : null}

          {!konto.aktiv ? (
            <p className="text-sm text-destructive" role="alert">
              Dieses Bankkonto ist deaktiviert. Import ist nicht möglich.
            </p>
          ) : (
            <form action={importBankCsvAction} className="flex flex-col gap-4">
              <input type="hidden" name="bankkonto" value={id} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="file">CSV-Datei</Label>
                <input
                  id="file"
                  name="file"
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  required
                  className="block w-full text-sm text-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
                />
              </div>
              <Button type="submit">Importieren</Button>
            </form>
          )}

          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Beispiel-Header
            </p>
            <pre className="mt-1 overflow-x-auto text-xs text-foreground">
              {BANK_CSV_DEFAULT_HEADER}
              {"\n"}
              12.08.2026;119,00;Rechnung R-0001;Muster GmbH;DE89370400440532013000;R-0001
              {"\n"}
              13.08.2026;-25,50;Lastschrift Hosting;Provider AG;;
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
