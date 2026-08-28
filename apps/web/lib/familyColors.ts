/** Family color identities (theme v2, backlog B-701) — one hue per base metal. */
export const FAMILY_COLOR: Record<string, string> = {
  Fe: "var(--fam-fe)",
  Al: "var(--fam-al)",
  Ti: "var(--fam-ti)",
  Ni: "var(--fam-ni)",
  Cu: "var(--fam-cu)",
};

export function familyColor(root: string | undefined): string {
  return FAMILY_COLOR[root ?? ""] ?? "var(--accent)";
}
