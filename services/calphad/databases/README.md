# Thermodynamic databases

Alloyra ships the license-vetted assessed set recorded in `SOURCES.md`
(MatCalc mc_fe / mc_ni / mc_al under ODbL 1.0 + DbCL 1.0, NIST solder in
the US public domain) — real published assessments, no demo/teaching
databases (ground rule 4). Drop additional `.tdb` files here and restart
the service; every valid file becomes selectable in the studio's
phase-equilibrium panel. Licensing of anything you add is yours to clear
(blueprint N-5).

License-vetted redistributable databases (and the do-not-ship list) are
documented in `SOURCES.md` — the professional core is the MatCalc open
databases (mc_fe / mc_ni / mc_al, ODbL) plus published assessments carried
by the MIT pycalphad/kawin repos. Commercial databases (Thermo-Calc
TCFE/TCAL, SGTE SSOL, NIMS CPDDB downloads) work if your license permits
local use — never commit them to this repo.

`.tdb` files in this directory are gitignored.
