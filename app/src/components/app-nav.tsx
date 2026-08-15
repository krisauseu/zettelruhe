"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  BarChart3,
  BookOpen,
  Building2,
  Calculator,
  Tags,
  Car,
  ClipboardList,
  Clock,
  Contact,
  Download,
  FileCode2,
  FileText,
  FolderKanban,
  Landmark,
  LayoutDashboard,
  Package,
  Percent,
  Receipt,
  RefreshCw,
  ScrollText,
  Search,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Icon keys only — never pass component functions from Server Components. */
export type NavIconKey =
  | "dashboard"
  | "suche"
  | "kontakte"
  | "katalog"
  | "projekte"
  | "zeiten"
  | "fahrten"
  | "angebote"
  | "rechnungen"
  | "wiederkehrend"
  | "zahlungen"
  | "belege"
  | "e-rechnungen"
  | "kassenbuch"
  | "bankkonten"
  | "kontoauszug"
  | "journal"
  | "auswertungen"
  | "eur"
  | "ust"
  | "export"
  | "firma"
  | "kategorien";

export type NavLinkItem = {
  type?: "link";
  href: string;
  label: string;
  icon: NavIconKey;
};

export type NavGroupItem = {
  type: "group";
  label: string;
};

export type NavItem = NavLinkItem | NavGroupItem;

const ICONS: Record<NavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  suche: Search,
  kontakte: Contact,
  katalog: Package,
  projekte: FolderKanban,
  zeiten: Clock,
  fahrten: Car,
  angebote: ClipboardList,
  rechnungen: FileText,
  wiederkehrend: RefreshCw,
  zahlungen: Banknote,
  belege: Receipt,
  "e-rechnungen": FileCode2,
  kassenbuch: Wallet,
  bankkonten: Landmark,
  kontoauszug: ScrollText,
  journal: BookOpen,
  auswertungen: BarChart3,
  eur: Calculator,
  ust: Percent,
  export: Download,
  firma: Building2,
  kategorien: Tags,
};

export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
      {items.map((item, idx) => {
        if (item.type === "group") {
          return (
            <div
              key={`group-${item.label}-${idx}`}
              className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-1"
            >
              {item.label}
            </div>
          );
        }

        const Icon = ICONS[item.icon];
        const active =
          item.href === "/app"
            ? pathname === "/app"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                active ? "text-sidebar-primary" : "opacity-70",
              )}
              aria-hidden
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
