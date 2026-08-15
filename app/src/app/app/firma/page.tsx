import Link from "next/link";
import { getFirmaById } from "@/lib/pb";
import { requireFirmaSession } from "@/lib/session";
import { FirmaForm } from "@/modules/platform/firma-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string; saved?: string; created?: string }>;

export default async function FirmaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const firma = await getFirmaById(session.firmaId);
  const sp = await searchParams;

  if (!firma) {
    return <p className="text-muted-foreground">Keine Firma vorhanden.</p>;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Firma
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stammdaten, Steuer-Modus, Dokumenten-Layout und Nummernkreise der
            aktiven Firma. Festgeschriebene Belege bleiben beim
            Steuer-Modus-Wechsel unverändert.
          </p>
        </div>
        <Link
          href="/app/firma/neu"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
        >
          Weitere Firma anlegen
        </Link>
      </div>

      <FirmaForm firma={firma} error={sp.error ?? null} />
    </div>
  );
}
