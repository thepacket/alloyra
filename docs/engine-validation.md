# In-browser CALPHAD engine — validation against pycalphad

Generated 2026-08-28T22:19:28.733Z · `@alloyra/calphad` at DEFAULT budgets (what a visitor's browser runs) vs pycalphad with the hosted service's exact semantics (same TDBs, same auxiliary-phase suspension, same wt%→mole conversion). Compositions are the DATASET's own mid-specs (max-only elements at half-max). Regenerate: `node scripts/gen-cases.ts` → `crosscheck_oracle.py` → `node scripts/crosscheck.ts` in `packages/calphad`.

## Summary

- **52 equilibria** across 14 compositions and 4 databases
- Phase-set agreement (phases > 0.5 %, duplicates merged): **45/52**
- Max phase-fraction deviation: **100.00 %** (mean 5.83 %)
- Max |ΔG|: **1201.1 J/mol-atom** (mean 46.5)

| database | equilibria | set match | max Δfraction | max \|ΔG\| (J/mol-atom) |
|---|---|---|---|---|
| mc_fe_v2.059.pycalphad | 30 | 27/30 | 85.77 % | 133.4 |
| mc_ni_v2.034.pycalphad | 9 | 5/9 | 100.00 % | 1201.1 |
| mc_al_v2.032.pycalphad | 9 | 9/9 | 0.01 % | 0.0 |
| NIST-solder | 4 | 4/4 | 0.00 % | 0.0 |

## Every equilibrium

| case | T (°C) | sets agree | TS engine set | pycalphad set | max Δfrac | \|ΔG\| | TS ms |
|---|---|---|---|---|---|---|---|
| 316L | 500 | ✓ | BCC_A2+CR3NI2SIN+FCC_A1+LAVES_PHASE+SIGMA | BCC_A2+CR3NI2SIN+FCC_A1+LAVES_PHASE+SIGMA | 0.02 % | 0.0 | 5519 |
| 316L | 700 | **✗** | FCC_A1+LAVES_PHASE+SIGMA | FCC_A1+LAVES_PHASE | 1.23 % | 0.3 | 5556 |
| 316L | 900 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 0.1 | 10837 |
| 316L | 1100 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 0.0 | 11500 |
| 316L | 1300 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 1.6 | 12025 |
| 304 | 500 | ✓ | BCC_A2+CR3NI2SIN+FCC_A1+M23C6+SIGMA | BCC_A2+CR3NI2SIN+FCC_A1+M23C6+SIGMA | 0.01 % | 0.0 | 2497 |
| 304 | 700 | ✓ | FCC_A1+M23C6+SIGMA | FCC_A1+M23C6+SIGMA | 0.00 % | 0.0 | 3481 |
| 304 | 900 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 0.0 | 6728 |
| 304 | 1100 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 0.1 | 5732 |
| 304 | 1300 | ✓ | FCC_A1 | FCC_A1 | 0.42 % | 0.5 | 5445 |
| 2205 | 500 | **✗** | BCC_A2+FCC_A1+HCP_A3+LAVES_PHASE+SIGMA | BCC_A2+CR3NI2SIN+HCP_A3+LAVES_PHASE+SIGMA | 10.28 % | 10.5 | 3837 |
| 2205 | 700 | ✓ | FCC_A1+HCP_A3+LAVES_PHASE+SIGMA | FCC_A1+HCP_A3+LAVES_PHASE+SIGMA | 0.00 % | 0.0 | 6040 |
| 2205 | 900 | ✓ | FCC_A1+HCP_A3+SIGMA | FCC_A1+HCP_A3+SIGMA | 0.01 % | 0.0 | 11296 |
| 2205 | 1100 | ✓ | BCC_A2+FCC_A1 | BCC_A2+FCC_A1 | 0.32 % | 0.1 | 9771 |
| 2205 | 1300 | ✓ | BCC_A2+FCC_A1 | BCC_A2+FCC_A1 | 0.26 % | 1.1 | 8741 |
| 2507 super duplex | 500 | ✓ | BCC_A2+CR3NI2SIN+FCC_A1+HCP_A3+LAVES_PHASE+SIGMA | BCC_A2+CR3NI2SIN+FCC_A1+HCP_A3+LAVES_PHASE+SIGMA | 0.03 % | 0.0 | 7491 |
| 2507 super duplex | 700 | ✓ | FCC_A1+HCP_A3+LAVES_PHASE+SIGMA | FCC_A1+HCP_A3+LAVES_PHASE+SIGMA | 0.00 % | 0.0 | 5440 |
| 2507 super duplex | 900 | ✓ | FCC_A1+HCP_A3+SIGMA | FCC_A1+HCP_A3+SIGMA | 0.00 % | 0.0 | 9362 |
| 2507 super duplex | 1100 | ✓ | BCC_A2+FCC_A1+SIGMA | BCC_A2+FCC_A1+SIGMA | 0.34 % | 0.1 | 9302 |
| 2507 super duplex | 1300 | ✓ | BCC_A2+FCC_A1 | BCC_A2+FCC_A1 | 0.90 % | 0.5 | 8881 |
| 410 | 500 | ✓ | BCC_A2+M23C6 | BCC_A2+M23C6 | 0.00 % | 0.0 | 3251 |
| 410 | 700 | ✓ | BCC_A2+M23C6 | BCC_A2+M23C6 | 0.00 % | 0.0 | 3316 |
| 410 | 900 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 0.0 | 3711 |
| 410 | 1100 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 0.0 | 3713 |
| 410 | 1300 | ✓ | BCC_A2+FCC_A1 | BCC_A2+FCC_A1 | 0.02 % | 0.0 | 3105 |
| 17-4 PH | 500 | **✗** | BCC_A2+MNNI+SIGMA | BCC_A2+FCC_A1+G_PHASE+M23C6+SIGMA | 3.55 % | 57.4 | 5249 |
| 17-4 PH | 700 | ✓ | BCC_A2+FCC_A1 | BCC_A2+FCC_A1 | 85.77 % | 133.4 | 11143 |
| 17-4 PH | 900 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 0.1 | 11874 |
| 17-4 PH | 1100 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 0.0 | 12118 |
| 17-4 PH | 1300 | ✓ | BCC_A2+FCC_A1 | BCC_A2+FCC_A1 | 0.91 % | 1.8 | 9460 |
| Alloy 625 | 650 | ✓ | DELTA+FCC_A1+P_PHASE | DELTA+FCC_A1+P_PHASE | 0.00 % | 0.0 | 1412 |
| Alloy 625 | 900 | ✓ | DELTA+FCC_A1 | DELTA+FCC_A1 | 0.00 % | 0.0 | 1618 |
| Alloy 625 | 1150 | ✓ | FCC_A1 | FCC_A1 | 0.00 % | 0.0 | 2213 |
| Alloy 718 | 650 | **✗** | BCC_A2+DELTA+FCC_A1+GAMMA_PRIME+M23C6+SIGMA | DELTA+FCC_A1+GAMMA_PRIME+M23C6+SIGMA | 1.41 % | 3.3 | 5480 |
| Alloy 718 | 900 | **✗** | DELTA+FCC_A1 | GAMMA_DP+GAMMA_PRIME+SIGMA | 89.09 % | 916.3 | 8365 |
| Alloy 718 | 1150 | **✗** | FCC_A1 | GAMMA_DP+LIQUID+SIGMA | 100.00 % | 1201.1 | 12502 |
| Alloy C-276 | 650 | **✗** | FCC_A1+GAMMA_PRIME+MU_PHASE+P_PHASE | FCC_A1+GAMMA_PRIME+MU_PHASE | 8.35 % | 91.1 | 4662 |
| Alloy C-276 | 900 | ✓ | FCC_A1+GAMMA_PRIME+MU_PHASE | FCC_A1+GAMMA_PRIME+MU_PHASE | 0.00 % | 0.0 | 4799 |
| Alloy C-276 | 1150 | ✓ | FCC_A1+MU_PHASE | FCC_A1+MU_PHASE | 0.00 % | 0.0 | 7354 |
| 6061 | 200 | ✓ | AL12MN+ALCRFEMNSI_A+FCC_A1+MG2SI_B | AL12MN+ALCRFEMNSI_A+FCC_A1+MG2SI_B | 0.01 % | 0.0 | 3710 |
| 6061 | 400 | ✓ | AL12MN+ALCRFEMNSI_A+FCC_A1+MG2SI_B | AL12MN+ALCRFEMNSI_A+FCC_A1+MG2SI_B | 0.00 % | 0.0 | 10078 |
| 6061 | 550 | ✓ | ALCRFEMNSI_A+FCC_A1 | ALCRFEMNSI_A+FCC_A1 | 0.00 % | 0.0 | 13322 |
| 7075 | 200 | ✓ | AL12MN+ALCRFEMNSI_A+FCC_A1+LC14_ZN2MG+MG2SI_B+MGALCUZN_T+S_PHASE | AL12MN+ALCRFEMNSI_A+FCC_A1+LC14_ZN2MG+MG2SI_B+MGALCUZN_T+S_PHASE | 0.00 % | 0.0 | 2328 |
| 7075 | 400 | ✓ | AL12MN+ALCRFEMNSI_A+FCC_A1+MGALCUZN_T+S_PHASE | AL12MN+ALCRFEMNSI_A+FCC_A1+MGALCUZN_T+S_PHASE | 0.00 % | 0.0 | 6235 |
| 7075 | 550 | ✓ | AL13CR2+ALCRCU_TAU+FCC_A1+LIQUID | AL13CR2+ALCRCU_TAU+FCC_A1+LIQUID | 0.00 % | 0.0 | 19194 |
| 5083 | 200 | ✓ | AL12MN+AL6MN+ALCRFEMNSI_A+FCC_A1+MG2SI_B | AL12MN+AL6MN+ALCRFEMNSI_A+FCC_A1+MG2SI_B | 0.01 % | 0.0 | 584 |
| 5083 | 400 | ✓ | AL12MN+AL6MN+ALCRFEMNSI_A+FCC_A1 | AL12MN+AL6MN+ALCRFEMNSI_A+FCC_A1 | 0.00 % | 0.0 | 1286 |
| 5083 | 550 | ✓ | AL11CR2+AL6MN+FCC_A1 | AL11CR2+AL6MN+FCC_A1 | 0.00 % | 0.0 | 2253 |
| SAC305 (Sn-3.0Ag-0.5Cu) | 120 | ✓ | BCT_A5+CU6SN5_L+EPSILON | BCT_A5+CU6SN5_L+EPSILON | 0.00 % | 0.0 | 51 |
| SAC305 (Sn-3.0Ag-0.5Cu) | 200 | ✓ | BCT_A5+CU6SN5+EPSILON | BCT_A5+CU6SN5+EPSILON | 0.00 % | 0.0 | 52 |
| Sn-37Pb eutectic | 120 | ✓ | BCT_A5+FCC_A1 | BCT_A5+FCC_A1 | 0.00 % | 0.0 | 19 |
| Sn-37Pb eutectic | 200 | ✓ | LIQUID | LIQUID | 0.00 % | 0.0 | 23 |

## Disagreements investigated (repricing verdicts)

Method: pycalphad equilibrium RESTRICTED to the engine's phase set at the same composition and temperature, compared with pycalphad's free equilibrium (`services/calphad/scripts/reprice_disagreements.py`). A negative Δ means the engine found a DEEPER minimum than the reference solver.

- **316L @ 700 °C** — repriced: engine's set +9.4 J/mol-atom above pycalphad's — near-degenerate sliver (engine adds 1.2 % SIGMA).
- **2205 @ 500 °C** — repriced: +24.0 J/mol-atom — engine trades CR3NI2SIN for FCC in a 5-phase 500 °C assemblage.
- **17-4 PH @ 500 °C** — repriced: +221.0 J/mol-atom — engine's worst genuine miss (5-phase 500 °C assemblage; missed FCC+G_PHASE+M23C6).
- **Alloy 718 @ 650 °C** — repriced: −3.3 J/mol-atom — ENGINE DEEPER; degenerate BCC sliver.
- **Alloy 718 @ 900 °C** — repriced: −916.3 J/mol-atom — ENGINE DEEPER: pycalphad's own pricing of the engine's DELTA+FCC state beats its free equilibrium; pycalphad solver miss on the GAMMA_DP system.
- **Alloy 718 @ 1150 °C** — repriced: −1201.2 J/mol-atom — ENGINE DEEPER: pycalphad prices FCC-only at −91215.2 vs its equilibrium −90014.0. Single-phase γ at 1150 °C also matches 718's known solidus (~1260 °C).
- **Alloy C-276 @ 650 °C** — repriced: +5.4 J/mol-atom — degenerate (engine adds P_PHASE).

## Reading the numbers honestly

- This battery also caught two REFERENCE-side defects during development: the numpy.str_ TypeError that 500'd the hosted service on mc_al compositions (shim deployed), and pycalphad's non-global convergence on the 718/GAMMA_DP system (repriced above). Cross-checks cut both ways.
- A set disagreement is not automatically an engine error: near-degenerate assemblages (two states within ~1 J/mol-atom) can legitimately tip either way between two minimizers. Every disagreement above is listed, not averaged away.
- The battery covers the dataset's mid-spec compositions on the four shipped databases. It says nothing about compositions far outside those windows, other databases, or properties the engine does not compute.
- The hosted pycalphad service remains the reference implementation; the cross-check line in the studio compares the two live on demand.
