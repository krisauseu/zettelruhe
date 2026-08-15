import Link from "next/link";
import { Select } from "@/components/ui/select";

type Props = {
  id?: string;
  name?: string;
  namen: string[];
  defaultValue?: string;
};

/** Auswahlliste; leer = keine Kategorie. Namen kommen aus den Stammdaten. */
export function KategorieSelect({
  id = "kategorie",
  name = "kategorie",
  namen,
  defaultValue = "",
}: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <Select id={id} name={name} defaultValue={defaultValue}>
        <option value="">— optional —</option>
        {namen.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Select>
      {namen.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Noch keine Kategorien.{" "}
          <Link
            href="/app/kategorien/neu"
            className="text-primary underline-offset-4 hover:underline"
          >
            Anlegen
          </Link>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Liste unter{" "}
          <Link
            href="/app/kategorien"
            className="text-primary underline-offset-4 hover:underline"
          >
            Kategorien
          </Link>
          .
        </p>
      )}
    </div>
  );
}
