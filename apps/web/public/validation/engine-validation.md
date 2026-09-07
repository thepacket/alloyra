# In-browser CALPHAD engine — validation against pycalphad

Generated 2026-08-29T02:27:48.544Z · `@alloyra/calphad` at DEFAULT budgets (what a visitor's browser runs) vs pycalphad with the hosted service's exact semantics (same TDBs, same auxiliary-phase suspension, same wt%→mole conversion). Compositions are the DATASET's own mid-specs (max-only elements at half-max). Regenerate: `node scripts/gen-cases.ts` → `crosscheck_oracle.py` → `node scripts/crosscheck.ts` in `packages/calphad`.

## Summary

- **52 equilibria** across 14 compositions and 4 databases
- Phase-set agreement (phases > 0.5 %, duplicates merged): **44/52**
- Max phase-fraction deviation: **100.00 %** (mean 4.15 %)
- Max |ΔG|: **1200.3 J/mol-atom** (mean 44.1)

| database | equilibria | set match | max Δfraction | max \|ΔG\| (J/mol-atom) |
|---|---|---|---|---|
| mc_fe_v2.059.pycalphad | 30 | 26/30 | 4.63 % | 51.9 |
| mc_ni_v2.034.pycalphad | 9 | 5/9 | 100.00 % | 1200.3 |
| mc_al_v2.032.pycalphad | 9 | 9/9 | 0.01 % | 0.0 |
| NIST-solder | 4 | 4/4 | 0.00 % | 0.0 |

## Every equilibrium

| case | T (°C) | sets agree | TS engine set | pycalphad set | max Δfrac | \|ΔG\| | TS ms |
|---|---|---|---|---|---|---|---|
| 316L | 500 | ✓ | BCC_A2+CR3NI2SIN+FCC_A1+LAVES_PHASE+SIGMA | BCC_A2+CR3NI2SIN+FCC_A1+LAVES_PHASE+SIGMA | 0.01 % | 0.0 | 3675 |
| 316L | 700 | **✗** | FCC_A1+LAVES_PHASE+SIGMA | FCC_A1+LAVES_PHASE | 1.22 % | 0.3 | 4472 |
| 316L | 900 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 0.6 | 7457 |
| 316L | 1100 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 7.3 | 6883 |
| 316L | 1300 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 7.8 | 6236 |
| 304 | 500 | ✓ | BCC_A2+CR3NI2SIN+FCC_A1+M23C6+SIGMA | BCC_A2+CR3NI2SIN+FCC_A1+M23C6+SIGMA | 0.00 % | 0.0 | 2871 |
| 304 | 700 | ✓ | FCC_A1+M23C6+SIGMA | FCC_A1+M23C6+SIGMA | 0.04 % | 0.0 | 2811 |
| 304 | 900 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 0.2 | 4235 |
| 304 | 1100 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 1.3 | 5959 |
| 304 | 1300 | **✗** | BCC_A2+FCC_A1 | FCC_A1 | 2.74 % | 5.8 | 8198 |
| 2205 | 500 | ✓ | BCC_A2+CR3NI2SIN+HCP_A3+LAVES_PHASE+SIGMA | BCC_A2+CR3NI2SIN+HCP_A3+LAVES_PHASE+SIGMA | 0.48 % | 0.7 | 3491 |
| 2205 | 700 | ✓ | FCC_A1+HCP_A3+LAVES_PHASE+SIGMA | FCC_A1+HCP_A3+LAVES_PHASE+SIGMA | 0.02 % | 0.0 | 5008 |
| 2205 | 900 | ✓ | FCC_A1+HCP_A3+SIGMA | FCC_A1+HCP_A3+SIGMA | 0.05 % | 0.0 | 7352 |
| 2205 | 1100 | ✓ | BCC_A2+FCC_A1 | BCC_A2+FCC_A1 | 0.33 % | 0.4 | 5448 |
| 2205 | 1300 | ✓ | BCC_A2+FCC_A1 | BCC_A2+FCC_A1 | 0.22 % | 0.2 | 5827 |
| 2507 super duplex | 500 | ✓ | BCC_A2+CR3NI2SIN+FCC_A1+HCP_A3+LAVES_PHASE+SIGMA | BCC_A2+CR3NI2SIN+FCC_A1+HCP_A3+LAVES_PHASE+SIGMA | 0.09 % | 0.0 | 2248 |
| 2507 super duplex | 700 | ✓ | FCC_A1+HCP_A3+LAVES_PHASE+SIGMA | FCC_A1+HCP_A3+LAVES_PHASE+SIGMA | 0.01 % | 0.0 | 3928 |
| 2507 super duplex | 900 | ✓ | FCC_A1+HCP_A3+SIGMA | FCC_A1+HCP_A3+SIGMA | 0.03 % | 0.3 | 4340 |
| 2507 super duplex | 1100 | ✓ | BCC_A2+FCC_A1+SIGMA | BCC_A2+FCC_A1+SIGMA | 0.31 % | 0.4 | 2679 |
| 2507 super duplex | 1300 | ✓ | BCC_A2+FCC_A1 | BCC_A2+FCC_A1 | 1.23 % | 2.0 | 3509 |
| 410 | 500 | ✓ | BCC_A2+M23C6 | BCC_A2+M23C6 | 0.00 % | 0.0 | 2191 |
| 410 | 700 | ✓ | BCC_A2+M23C6 | BCC_A2+M23C6 | 0.00 % | 0.0 | 2286 |
| 410 | 900 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 0.1 | 1808 |
| 410 | 1100 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 0.0 | 1709 |
| 410 | 1300 | ✓ | BCC_A2+FCC_A1 | BCC_A2+FCC_A1 | 0.03 % | 0.0 | 1288 |
| 17-4 PH | 500 | **✗** | BCC_A2+FCC_A1+SIGMA | BCC_A2+FCC_A1+G_PHASE+M23C6+SIGMA | 2.65 % | 51.9 | 2178 |
| 17-4 PH | 700 | **✗** | BCC_A2+FCC_A1+SIGMA | BCC_A2+FCC_A1 | 3.06 % | 0.1 | 2657 |
| 17-4 PH | 900 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 0.0 | 3630 |
| 17-4 PH | 1100 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 0.2 | 3232 |
| 17-4 PH | 1300 | ✓ | BCC_A2+FCC_A1 | BCC_A2+FCC_A1 | 4.63 % | 4.2 | 2905 |
| Alloy 625 | 650 | ✓ | DELTA+FCC_A1+P_PHASE | DELTA+FCC_A1+P_PHASE | 0.00 % | 0.0 | 642 |
| Alloy 625 | 900 | ✓ | DELTA+FCC_A1 | DELTA+FCC_A1 | 0.00 % | 0.0 | 766 |
| Alloy 625 | 1150 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 0.0 | 1090 |
| Alloy 718 | 650 | **✗** | BCC_A2+DELTA+FCC_A1+GAMMA_PRIME+M23C6+SIGMA | DELTA+FCC_A1+GAMMA_PRIME+M23C6+SIGMA | 1.41 % | 3.3 | 2061 |
| Alloy 718 | 900 | **✗** | DELTA+FCC_A1 | GAMMA_DP+GAMMA_PRIME+SIGMA | 89.08 % | 916.3 | 3167 |
| Alloy 718 | 1150 | **✗** | FCC_A1 | GAMMA_DP+LIQUID+SIGMA | 100.00 % | 1200.3 | 3965 |
| Alloy C-276 | 650 | **✗** | FCC_A1+GAMMA_PRIME+MU_PHASE+P_PHASE | FCC_A1+GAMMA_PRIME+MU_PHASE | 8.35 % | 91.1 | 1757 |
| Alloy C-276 | 900 | ✓ | FCC_A1+GAMMA_PRIME+MU_PHASE | FCC_A1+GAMMA_PRIME+MU_PHASE | 0.01 % | 0.0 | 1788 |
| Alloy C-276 | 1150 | ✓ | FCC_A1+MU_PHASE | FCC_A1+MU_PHASE | 0.00 % | 0.0 | 2908 |
| 6061 | 200 | ✓ | AL12MN+ALCRFEMNSI_A+FCC_A1+MG2SI_B | AL12MN+ALCRFEMNSI_A+FCC_A1+MG2SI_B | 0.01 % | 0.0 | 2650 |
| 6061 | 400 | ✓ | AL12MN+ALCRFEMNSI_A+FCC_A1+MG2SI_B | AL12MN+ALCRFEMNSI_A+FCC_A1+MG2SI_B | 0.00 % | 0.0 | 6397 |
| 6061 | 550 | ✓ | ALCRFEMNSI_A+FCC_A1 | ALCRFEMNSI_A+FCC_A1 | 0.00 % | 0.0 | 6937 |
| 7075 | 200 | ✓ | AL12MN+ALCRFEMNSI_A+FCC_A1+LC14_ZN2MG+MG2SI_B+MGALCUZN_T+S_PHASE | AL12MN+ALCRFEMNSI_A+FCC_A1+LC14_ZN2MG+MG2SI_B+MGALCUZN_T+S_PHASE | 0.00 % | 0.0 | 1801 |
| 7075 | 400 | ✓ | AL12MN+ALCRFEMNSI_A+FCC_A1+MGALCUZN_T+S_PHASE | AL12MN+ALCRFEMNSI_A+FCC_A1+MGALCUZN_T+S_PHASE | 0.00 % | 0.0 | 5716 |
| 7075 | 550 | ✓ | AL13CR2+ALCRCU_TAU+FCC_A1+LIQUID | AL13CR2+ALCRCU_TAU+FCC_A1+LIQUID | 0.01 % | 0.0 | 10077 |
| 5083 | 200 | ✓ | AL12MN+AL6MN+ALCRFEMNSI_A+FCC_A1+MG2SI_B | AL12MN+AL6MN+ALCRFEMNSI_A+FCC_A1+MG2SI_B | 0.01 % | 0.0 | 390 |
| 5083 | 400 | ✓ | AL12MN+AL6MN+ALCRFEMNSI_A+FCC_A1 | AL12MN+AL6MN+ALCRFEMNSI_A+FCC_A1 | 0.00 % | 0.0 | 852 |
| 5083 | 550 | ✓ | AL11CR2+AL6MN+FCC_A1 | AL11CR2+AL6MN+FCC_A1 | 0.00 % | 0.0 | 1510 |
| SAC305 (Sn-3.0Ag-0.5Cu) | 120 | ✓ | BCT_A5+CU6SN5_L+EPSILON | BCT_A5+CU6SN5_L+EPSILON | 0.00 % | 0.0 | 33 |
| SAC305 (Sn-3.0Ag-0.5Cu) | 200 | ✓ | BCT_A5+CU6SN5+EPSILON | BCT_A5+CU6SN5+EPSILON | 0.00 % | 0.0 | 30 |
| Sn-37Pb eutectic | 120 | ✓ | BCT_A5+FCC_A1 | BCT_A5+FCC_A1 | 0.00 % | 0.0 | 11 |
| Sn-37Pb eutectic | 200 | ✓ | LIQUID | LIQUID | 0.00 % | 0.0 | 15 |

## Disagreements investigated (repricing verdicts)

Method: pycalphad equilibrium RESTRICTED to the engine's phase set at the same composition and temperature, compared with pycalphad's free equilibrium (`services/calphad/scripts/reprice_disagreements.py`). A negative Δ means the engine found a DEEPER minimum than the reference solver.

- **316L @ 700 °C** — repriced: engine's set +9.4 J/mol-atom above pycalphad's — near-degenerate sliver (engine adds 1.2 % SIGMA).
- **304 @ 1300 °C** — repriced: −0.0 J/mol-atom — EXACT DEGENERACY: the engine's 2.7 % BCC sliver sits at the same energy (two-phase boundary).
- **17-4 PH @ 500 °C** — repriced: +50.1 J/mol-atom — the engine's worst genuine miss (5-phase 500 °C assemblage; misses G_PHASE+M23C6). Was +221 before the 2026-08-28 solver tuning.
- **17-4 PH @ 700 °C** — repriced: −0.3 J/mol-atom — degenerate; the engine's extra SIGMA sliver is marginally deeper.
- **Alloy 718 @ 650 °C** — repriced: −3.3 J/mol-atom — ENGINE DEEPER; degenerate BCC sliver.
- **Alloy 718 @ 900 °C** — repriced: −916.3 J/mol-atom — ENGINE DEEPER: pycalphad's own pricing of the engine's DELTA+FCC state beats its free equilibrium; pycalphad solver miss on the GAMMA_DP system.
- **Alloy 718 @ 1150 °C** — repriced: −1201.2 J/mol-atom — ENGINE DEEPER: pycalphad prices FCC-only at −91215.2 vs its equilibrium −90014.0. Single-phase γ at 1150 °C also matches 718's known solidus (~1260 °C).
- **Alloy C-276 @ 650 °C** — repriced: +5.4 J/mol-atom — degenerate (engine adds P_PHASE).

## Reading the numbers honestly

- A set disagreement is not automatically an engine error: near-degenerate assemblages (two states within ~1 J/mol-atom) can legitimately tip either way between two minimizers. Every disagreement above is listed, not averaged away.
- The battery covers the dataset's mid-spec compositions on the four shipped databases. It says nothing about compositions far outside those windows, other databases, or properties the engine does not compute.
- The hosted pycalphad service remains the reference implementation; the cross-check line in the studio compares the two live on demand.
