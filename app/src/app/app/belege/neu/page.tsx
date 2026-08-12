import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { getFirstFirma } from "@/lib/pb";
import { listKontakte } from "@/modules/contacts";
import { createBelegAction } from "@/modules/expenses";
import { BelegForm } from "@/modules/expenses/beleg-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function BelegNeuPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;
  const firma = await getFirstFirma();
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
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Beleg anlegen
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Zuerst als Entwurf speichern, optional Datei anhängen, dann
          festschreiben.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entwurf</CardTitle>
          <CardDescription>
            Metadaten und Datei sind editierbar, bis der Beleg festgeschrieben
            wird.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BelegForm
            action={createBelegAction}
            steuermodus={steuermodus}
            lieferanten={lieferanten}
            error={sp.error ?? null}
            mode="create"
          />
        </CardContent>
      </Card>
    </div>
  );
}
