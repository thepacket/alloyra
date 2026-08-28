import type { Designation } from "../types.ts";

/**
 * Cross-standard designations (B-302), keyed by UNS. Only cross-references
 * the maintainers are confident of are listed — anything uncertain is
 * OMITTED rather than guessed (ground rule 4). GB rows follow GB/T 20878's
 * systematic designations (Annex C carries the foreign cross-reference
 * table); GOST rows are the classic GOST 5632 counterparts and exist only
 * for grades that standard actually covers. Every equivalence is NOMINAL:
 * composition and property limits differ between standards; verify against
 * the target standard's own tables before use.
 */

const EN_SS = "EN 10088-1 designation (nominal cross-reference)";
const GB_SS = "GB/T 20878 Annex C (nominal cross-reference)";
const GOST_SS = "GOST 5632 (nominal cross-reference)";
const JIS_SS = "JIS G4303/G4304 SUS series (nominal cross-reference)";
const EN_AW = "EN 573-3 — international AA registration carries the same number";
const WNR = "DIN W.-Nr. system (nominal cross-reference)";
const CEN_CW = "CEN copper CW-number system (nominal cross-reference)";
const NEAREST = "Published class comparison — NEAREST grade, not an equivalence; chemistry and limits differ";

export const designations: Record<string, Designation[]> = {
  S30400: [
    { system: "AISI/SAE", code: "304", source: "SAE J405" },
    { system: "EN number", code: "1.4301", source: EN_SS },
    { system: "EN name", code: "X5CrNi18-10", source: EN_SS },
    { system: "JIS", code: "SUS 304", source: JIS_SS },
    { system: "GB", code: "06Cr19Ni10", source: GB_SS },
    { system: "GOST", code: "08Х18Н10", source: GOST_SS },
  ],
  S30403: [
    { system: "AISI/SAE", code: "304L", source: "SAE J405" },
    { system: "EN number", code: "1.4307", note: "1.4306 (X2CrNi19-11) is the higher-Ni variant", source: EN_SS },
    { system: "EN name", code: "X2CrNi18-9", source: EN_SS },
    { system: "JIS", code: "SUS 304L", source: JIS_SS },
    { system: "GB", code: "022Cr19Ni10", source: GB_SS },
    { system: "GOST", code: "03Х18Н11", source: GOST_SS },
  ],
  S31603: [
    { system: "AISI/SAE", code: "316L", source: "SAE J405" },
    { system: "EN number", code: "1.4404", note: "1.4435 is the higher-Mo variant", source: EN_SS },
    { system: "EN name", code: "X2CrNiMo17-12-2", source: EN_SS },
    { system: "JIS", code: "SUS 316L", source: JIS_SS },
    { system: "GB", code: "022Cr17Ni12Mo2", source: GB_SS },
    { system: "GOST", code: "03Х17Н14М3", note: "closest GOST CrNiMo austenitic — its Mo window (3–4 %) sits above 316L's", source: GOST_SS },
  ],
  S31703: [
    { system: "AISI/SAE", code: "317L", source: "SAE J405" },
    { system: "EN number", code: "1.4438", source: EN_SS },
    { system: "EN name", code: "X2CrNiMo18-15-4", source: EN_SS },
    { system: "JIS", code: "SUS 317L", source: JIS_SS },
    { system: "GB", code: "022Cr19Ni13Mo3", source: GB_SS },
  ],
  S32205: [
    { system: "EN number", code: "1.4462", source: EN_SS },
    { system: "EN name", code: "X2CrNiMoN22-5-3", source: EN_SS },
    { system: "JIS", code: "SUS 329J3L", source: JIS_SS },
    { system: "GB", code: "022Cr22Ni5Mo3N", source: GB_SS },
  ],
  S32750: [
    { system: "EN number", code: "1.4410", source: EN_SS },
    { system: "EN name", code: "X2CrNiMoN25-7-4", source: EN_SS },
    { system: "GB", code: "022Cr25Ni7Mo4N", source: GB_SS },
  ],
  S31254: [
    { system: "EN number", code: "1.4547", source: EN_SS },
    { system: "EN name", code: "X1CrNiMoCuN20-18-7", source: EN_SS },
  ],
  N08904: [
    { system: "EN number", code: "1.4539", source: EN_SS },
    { system: "EN name", code: "X1NiCrMoCu25-20-5", source: EN_SS },
    { system: "GB", code: "015Cr21Ni26Mo5Cu2", source: GB_SS },
  ],
  S41000: [
    { system: "AISI/SAE", code: "410", source: "SAE J405" },
    { system: "EN number", code: "1.4006", source: EN_SS },
    { system: "EN name", code: "X12Cr13", source: EN_SS },
    { system: "JIS", code: "SUS 410", source: JIS_SS },
    { system: "GB", code: "12Cr13", source: GB_SS },
    { system: "GOST", code: "12Х13", source: GOST_SS },
  ],
  S43000: [
    { system: "AISI/SAE", code: "430", source: "SAE J405" },
    { system: "EN number", code: "1.4016", source: EN_SS },
    { system: "EN name", code: "X6Cr17", source: EN_SS },
    { system: "JIS", code: "SUS 430", source: JIS_SS },
    { system: "GB", code: "10Cr17", source: GB_SS },
    { system: "GOST", code: "12Х17", source: GOST_SS },
  ],
  S17400: [
    { system: "AISI/SAE", code: "630", source: "SAE J405" },
    { system: "EN number", code: "1.4542", source: EN_SS },
    { system: "EN name", code: "X5CrNiCuNb16-4", source: EN_SS },
    { system: "JIS", code: "SUS 630", source: JIS_SS },
    { system: "GB", code: "05Cr17Ni4Cu4Nb", source: GB_SS },
  ],
  K02600: [
    { system: "EN", code: "S235JR / S275JR", note: "nearest by strength class — A36 is property-specified; chemistry differs", source: NEAREST },
    { system: "JIS", code: "SS400", note: "nearest by strength class — chemistry differs", source: NEAREST },
  ],
  G43400: [
    { system: "AISI/SAE", code: "4340", source: "SAE J404" },
    { system: "EN", code: "34CrNiMo6 (1.6582)", note: "nearest — slightly leaner Ni than 4340", source: NEAREST },
    { system: "JIS", code: "SNCM439", note: "nearest", source: NEAREST },
  ],
  G41300: [
    { system: "AISI/SAE", code: "4130", source: "SAE J404" },
    { system: "EN", code: "25CrMo4 (1.7218)", note: "nearest", source: NEAREST },
    { system: "JIS", code: "SCM430", note: "nearest", source: NEAREST },
  ],
  A96061: [
    { system: "EN AW", code: "EN AW-6061", source: EN_AW },
    { system: "ISO", code: "AlMg1SiCu", source: "ISO 209 chemical designation" },
  ],
  A97075: [
    { system: "EN AW", code: "EN AW-7075", source: EN_AW },
    { system: "ISO", code: "AlZn5.5MgCu", source: "ISO 209 chemical designation" },
  ],
  A92024: [
    { system: "EN AW", code: "EN AW-2024", source: EN_AW },
    { system: "ISO", code: "AlCu4Mg1", source: "ISO 209 chemical designation" },
  ],
  A95083: [
    { system: "EN AW", code: "EN AW-5083", source: EN_AW },
    { system: "ISO", code: "AlMg4.5Mn0.7", source: "ISO 209 chemical designation" },
  ],
  R50400: [
    { system: "ASTM", code: "Titanium Grade 2", source: "ASTM B265/B348 grade system" },
    { system: "W.-Nr.", code: "3.7035", source: WNR },
  ],
  R56400: [
    { system: "ASTM", code: "Titanium Grade 5", source: "ASTM B265/B348 grade system" },
    { system: "W.-Nr.", code: "3.7165", source: WNR },
  ],
  R56320: [
    { system: "ASTM", code: "Titanium Grade 9", source: "ASTM B265/B348 grade system" },
    { system: "W.-Nr.", code: "3.7195", source: WNR },
  ],
  N06625: [
    { system: "W.-Nr.", code: "2.4856", source: WNR },
    { system: "EN name", code: "NiCr22Mo9Nb", source: "EN 10095 / ISO designation (nominal)" },
  ],
  N07718: [
    { system: "W.-Nr.", code: "2.4668", source: WNR },
    { system: "EN name", code: "NiCr19Fe19Nb5Mo3", source: "EN 10302 / ISO designation (nominal)" },
  ],
  N10276: [
    { system: "W.-Nr.", code: "2.4819", source: WNR },
    { system: "EN name", code: "NiMo16Cr15W", source: "ISO designation (nominal)" },
  ],
  N04400: [
    { system: "W.-Nr.", code: "2.4360", source: WNR },
    { system: "EN name", code: "NiCu30Fe", source: "ISO designation (nominal)" },
  ],
  C26000: [
    { system: "CEN CW", code: "CW505L", source: CEN_CW },
    { system: "ISO", code: "CuZn30", source: "ISO 426 chemical designation" },
    { system: "JIS", code: "C2600", source: "JIS H3100 (nominal cross-reference)" },
  ],
  C70600: [
    { system: "CEN CW", code: "CW352H", source: CEN_CW },
    { system: "ISO", code: "CuNi10Fe1Mn", source: "ISO 429 chemical designation" },
    { system: "JIS", code: "C7060", source: "JIS H3300 (nominal cross-reference)" },
  ],
};
