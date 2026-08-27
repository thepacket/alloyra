# Thermodynamic databases

Alloyra ships **no** TDB files (blueprint N-5: licensing is yours to
clear). Drop `.tdb` files here and restart the service; every valid file
becomes selectable in the studio's phase-equilibrium panel.

Openly available starting points:

- **Al-Zn (Mey 1993)** — the small binary database used throughout the
  pycalphad documentation:
  https://raw.githubusercontent.com/pycalphad/pycalphad/develop/examples/alzn_mey.tdb
- **COST 507** (light-alloy database, Al/Mg/Ti systems) — published by the
  COST 507 action; check the distribution terms of the copy you obtain.
- Commercial databases (Thermo-Calc TCFE/TCAL, etc.) work if your license
  permits local use — never commit them to this repo.

`.tdb` files in this directory are gitignored.
