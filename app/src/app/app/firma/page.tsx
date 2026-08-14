import { getFirstFirma } from "@/lib/pb";
import { FirmaForm } from "@/modules/platform/firma-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string; saved?: string }>;

export default async function FirmaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const firma = await getFirstFirma();
  const sp = await searchParams;

  if (!firma) {
    return <p className="text-muted-foreground">Keine Firma vorhanden.</p>;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Firma
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stammdaten, Steuer-Modus, Dokumenten-Layout und Nummernkreise.
          Festgeschriebene Belege bleiben beim Steuer-Modus-Wechsel
          unverändert.
        </p>
      </div>

      <FirmaForm firma={firma} error={sp.error ?? null} />
    </div>
  );
}
