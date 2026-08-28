# Vetted thermodynamic database sources (B-507)

License-verified 2026-08-28 (research record: `docs/competitive-analysis.md`
context; ground rule 4 — professional-grade data only, no demo databases).
This file is the authority on what may be baked into the hosted service
image vs what users must fetch themselves.

## Safe to redistribute (bake into the image)

| Database | Coverage | License | Source |
|---|---|---|---|
| **MatCalc mc_fe** (pycalphad-converted, v2.059) | Fe + 23 elements — stainless, low-alloy, high-Mn steels (Cr, Ni, Mo, N, C, Mn, Nb, Ti, V, W…) | **ODbL 1.0 + DbCL 1.0** (stated on matcalc.at open-databases page and in the file header) — redistribution permitted with attribution + license-notice preservation | <https://raw.githubusercontent.com/pycalphad/pycalphad/develop/examples/databases/mc_fe_v2.059.pycalphad.tdb> (pycalphad, MIT repo, ships it the same way) |
| **MatCalc mc_ni** (converted, v2.034) | Ni + Al, B, C, Co, Cr, Cu, Fe, Mn, Mo, N, Nb, Si, Ti, V, W… — covers 625 / 718 / C-276 chemistries | ODbL 1.0 + DbCL 1.0 | <https://raw.githubusercontent.com/materialsgenomefoundation/2022-workshop-material/main/pycalphad/databases/mc_ni_v2.034.pycalphad.tdb> |
| **MatCalc mc_al** (converted, v2.032) | Al + Cu, Mg, Mn, Si, Zn, Zr, Sc… incl. metastable age-hardening phases — covers 2xxx/5xxx/6xxx/7xxx | ODbL 1.0 + DbCL 1.0 | <https://raw.githubusercontent.com/materialsgenomefoundation/2022-workshop-material/main/pycalphad/databases/mc_al_v2.032.pycalphad.tdb> |
| **NIST solder** | Sn-Ag-Bi-Cu-Pb | US public domain (NIST employee work, 17 U.S.C. §105); attribute NIST | <https://www.metallurgy.nist.gov/phase/solder/NIST-solder.tdb> |
| **kawin example assessments** (NiCrAl Dupin 2001, AlMgSi metastable, AlScZr, CuTi) | Focused published ternaries/binaries | MIT repo (materialsgenomefoundation/kawin); per-file provenance in headers; the FeCrNi extract carries ODbL — keep its notice | <https://github.com/materialsgenomefoundation/kawin/tree/main/examples> |
| **pycalphad bundled assessments** (NI_AL_DUPIN_2001, Al-Fe Sundman 2009, CrFeNb Jacob 2016, Al-Cu-Y Zhang 2011…) | Various published binaries/ternaries | Distributed inside the MIT pycalphad repo (community practice) | <https://github.com/pycalphad/pycalphad/tree/develop/examples/databases> |

Attribution requirements when shipping the MatCalc files: credit
E. Povoden-Karadeniz / TU Wien MatCalc open databases, link ODbL 1.0 and
DbCL 1.0, keep the license header inside each `.tdb`, and never relicense
the data files themselves (they remain ODbL inside this MIT product — a
standard collective-work arrangement; pycalphad is the precedent).

## Do NOT redistribute

- **OpenCalphad steel TDBs** (`steel1`, `steel7`, `saf2507`, `FECRMNC`):
  their own headers say "extract of the SGTE SSOL2 database" — commercial
  provenance. Best on-paper Fe-Cr-Ni-Mo-N match, but mc_fe covers the space
  legitimately.
- **NIMS CPDDB**: explicit no-redistribution terms; free registration —
  point users at <https://cpddb.nims.go.jp/> to fetch for themselves.
- **COST 507**: no formal license grant (1999 EC project output, de-facto
  public, redistributed in the MIT pycalphad repo for years). Gray — prefer
  mc_al; if ever shipped, cite the EC report and record the risk decision.
- **Hallstedt PrecHiMn / mpea-02b**: no author license statement; ask RWTH
  Aachen (B. Hallstedt) for permission or point users at the MGF workshop
  repos.
- **Journal supplementary TDBs**: under the article's copyright unless the
  paper is CC-BY; CC-BY supplements are redistributable with attribution.
  TDBDB (<https://avdwgroup.engin.brown.edu/>) is the search index.

## Status — baked-in set (downloaded with owner approval 2026-08-28)

`alzn_mey.tdb` (Al-Zn teaching binary) REMOVED per ground rule 4. Current
committed set, verified to parse and compute in pycalphad 0.11.2
(service venv):

| File | sha256 | Verification |
|---|---|---|
| `mc_fe_v2.059.pycalphad.tdb` | `467211ab854400ac6d247bdfb97069d37e021cfced6b8dbb30c0334b74ee1508` | 25 el / 122 phases; Fe-18Cr-13Ni-1.6Mo @ 800 °C → FCC_A1 0.951 + CHI_A12 0.049 in 1.2 s |
| `mc_ni_v2.034.pycalphad.tdb` | `73e349f0bf946b0be4b57ef22bb0fd66ada9fe1a7ff5f6b7037de3ca03d7c8ec` | 23 el / 97 phases; Ni-24Cr-5.5Mo-2.3Nb-4Fe @ 900 °C → FCC_A1 0.986 + DELTA 0.014 in 1.4 s |
| `mc_al_v2.032.pycalphad.tdb` | `54624a7b064106333d541d2a5e81d972d8a83a549f6ecee8ead2aa66900d6d20` | 13 el / 183 phases; parses in 0.8 s |
| `NIST-solder.tdb` | `56a0b25021f5dd4d2efbb9ed89ad8ad06929796e963c40ede857fcc9f72df8f3` | 8 el / 15 phases; parses in 0.1 s |

Known-benign parser note: pycalphad warns about a `%` type-definition
character in the MatCalc conversions; upstream-known, does not affect
results. `/health` reports per-database sha256 at runtime; the hosted image
copies exactly these four files (see `services/calphad/Dockerfile`).
Still open from B-507: surface license + citation in the studio's database
picker UI.
