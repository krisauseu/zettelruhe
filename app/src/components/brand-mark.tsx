import Image from "next/image";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { px: 32, className: "size-8" },
  md: { px: 48, className: "size-12" },
} as const;

/**
 * App-Marke Zettelruhe (nicht firmen.logo auf Angebot/Rechnung).
 * Transparentes Z — taugt für Hell- und Dunkelmodus.
 */
export function BrandMark({
  size = "sm",
  wordmark = true,
  className,
}: {
  size?: keyof typeof SIZES;
  wordmark?: boolean;
  className?: string;
}) {
  const spec = SIZES[size];
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/brand/zettelruhe-mark.png"
        alt=""
        width={spec.px}
        height={spec.px}
        className={cn("shrink-0", spec.className)}
        preload
      />
      {wordmark ? (
        <span className="text-lg font-semibold tracking-tight text-primary">
          Zettelruhe
        </span>
      ) : (
        <span className="sr-only">Zettelruhe</span>
      )}
    </span>
  );
}
