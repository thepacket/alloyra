"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items: { href: string; label: string; phase?: string }[] = [
  { href: "/studies", label: "Saved studies" },
  { href: "/", label: "Study overview" },
  { href: "/database", label: "Alloy database" },
  { href: "/screening", label: "Staged screening" },
  { href: "/profiles", label: "Duty profiles" },
  { href: "/records", label: "Material records" },
  { href: "/decisions", label: "Decision record" },
  { href: "/verification", label: "Verification plan" },
  { href: "/comparisons", label: "Comparisons" },
  { href: "/rules", label: "Failure rules" },
  { href: "/studio", label: "Composition studio" },
];

export function Rail() {
  const pathname = usePathname();
  return (
    <nav className="rail" aria-label="Primary">
      <span className="group-label">Workbench</span>
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={(it.href === "/" ? pathname === "/" : pathname.startsWith(it.href)) ? "active" : ""}
        >
          <span>{it.label}</span>
          {it.phase && <span className="phase">{it.phase}</span>}
        </Link>
      ))}
    </nav>
  );
}
