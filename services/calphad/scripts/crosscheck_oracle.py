"""Engine-validation oracle (B-501 promotion evidence).

Runs the cross-check battery (packages/calphad/scripts/crosscheck-cases.json)
through pycalphad with EXACTLY the hosted service's semantics (same phase
filtering, same auxiliary-phase suspension, same wt%->mole conversion) and
writes per-equilibrium phase fractions and molar Gibbs energy for the TS
engine comparator.

Run:  .venv/bin/python scripts/crosscheck_oracle.py \
        ../../packages/calphad/scripts/crosscheck-cases.json \
        ../../packages/calphad/scripts/crosscheck-oracle.json
"""

from __future__ import annotations

import json
import os
import re
import sys
import time

from pycalphad import Database, equilibrium, variables as v
from pycalphad.codegen.phase_record_factory import PhaseRecordFactory
from pycalphad.core.utils import filter_phases, instantiate_models, unpack_species

# pycalphad's cython PhaseRecord requires a builtin str; the eq solver can
# hand PhaseRecordFactory a numpy.str_ from the grid (seen on mc_ni C-276 @
# 1150 °C and the mc_al cases). Coerce — pure type adaptation, no
# thermodynamic effect. NOTE: get is @lru_cache-decorated and the class
# aliases __getitem__ = get at definition time, so BOTH must be replaced.
from functools import lru_cache as _lru_cache

_orig_prf_get = PhaseRecordFactory.get


@_lru_cache(maxsize=None)
def _prf_get(self, phase_name):
    return _orig_prf_get(self, str(phase_name))


PhaseRecordFactory.get = _prf_get
PhaseRecordFactory.__getitem__ = _prf_get

HERE = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.path.join(HERE, "..", "databases")
AUX_PHASE_RE = re.compile(r"^(GP_|CL_)|^BCC_DISL$")

ATOMIC_MASS = {
    "H": 1.008, "B": 10.81, "C": 12.011, "N": 14.007, "O": 15.999,
    "MG": 24.305, "AL": 26.982, "SI": 28.085, "P": 30.974, "S": 32.06,
    "TI": 47.867, "V": 50.942, "CR": 51.996, "MN": 54.938, "FE": 55.845,
    "CO": 58.933, "NI": 58.693, "CU": 63.546, "ZN": 65.38, "ZR": 91.224,
    "NB": 92.906, "MO": 95.95, "SN": 118.71, "TA": 180.95, "W": 183.84,
    "PB": 207.2, "AG": 107.87, "BI": 208.98, "SB": 121.76,
}


def wt_to_x(wt: dict[str, float]) -> dict[str, float]:
    moles = {el.upper(): pct / ATOMIC_MASS[el.upper()] for el, pct in wt.items() if pct > 0}
    total = sum(moles.values())
    return {el: m / total for el, m in moles.items()}


def main() -> None:
    cases = json.load(open(sys.argv[1]))
    out_path = sys.argv[2]
    dbs: dict[str, Database] = {}
    compiled: dict[tuple, tuple] = {}
    results = []

    for case in cases:
        db_id = case["db"]
        if db_id not in dbs:
            dbs[db_id] = Database(os.path.join(DB_DIR, f"{db_id}.tdb"))
        db = dbs[db_id]
        curated = [p for p in sorted(db.phases) if not AUX_PHASE_RE.match(p)]
        x = wt_to_x(case["wt"])
        comps = sorted(x) + ["VA"]
        key = (db_id, tuple(comps))
        if key not in compiled:
            species = unpack_species(db, comps)
            phases = filter_phases(db, species, curated)
            # Some ordered/disordered pairs (e.g. mc_ni BCC_B2/BCC_A2 with
            # certain interstitial subsets) cannot be instantiated by
            # pycalphad's partitioned model. Drop the named ordered phase and
            # retry, RECORDING the exclusion so the TS comparator suspends
            # the same phase — the comparison must stay apples-to-apples.
            excluded: list[str] = []
            models = None
            for _ in range(4):
                try:
                    models = instantiate_models(db, comps, phases)
                    break
                except ValueError as exc:
                    m = re.search(r"Order \((\w+)\)", str(exc))
                    if not m or m.group(1) not in phases:
                        raise
                    excluded.append(m.group(1))
                    phases = [p for p in phases if p != m.group(1)]
            if models is None:
                raise RuntimeError(f"could not instantiate models for {key}")
            prf = PhaseRecordFactory(db, species, {v.N, v.P, v.T}, models)
            compiled[key] = (phases, models, prf, excluded)
        phases, models, prf, excluded = compiled[key]
        dependent = max(x, key=lambda el: x[el])

        for temp_c in case["tempsC"]:
            conditions = {v.T: temp_c + 273.15, v.P: 101325.0, v.N: 1.0}
            for el, frac in x.items():
                if el != dependent:
                    conditions[v.X(el)] = frac
            t0 = time.time()
            try:
                eq = equilibrium(db, comps, phases, conditions, model=models, phase_records=prf)
            except Exception as exc:  # noqa: BLE001 — record, don't kill the battery
                print(f"{case['id']} @ {temp_c} C: ORACLE FAILED — {exc}")
                results.append(
                    {"id": case["id"], "tempC": temp_c, "error": str(exc), "excluded": excluded}
                )
                continue
            fractions: dict[str, float] = {}
            for name, frac in zip(eq.Phase.values.flatten(), eq.NP.values.flatten()):
                if name and frac == frac and frac > 1e-9:
                    fractions[str(name)] = fractions.get(str(name), 0.0) + float(frac)
            gm = float(eq.GM.values.flatten()[0])
            results.append(
                {
                    "id": case["id"],
                    "tempC": temp_c,
                    "phases": [
                        {"phase": n, "fraction": f}
                        for n, f in sorted(fractions.items(), key=lambda kv: -kv[1])
                    ],
                    "gm": gm,
                    "excluded": excluded,
                    "seconds": round(time.time() - t0, 2),
                }
            )
            print(f"{case['id']} @ {temp_c} C: "
                  + " + ".join(f"{n} {f:.3f}" for n, f in sorted(fractions.items(), key=lambda kv: -kv[1]))
                  + f"  GM={gm:.1f}")

    with open(out_path, "w") as fh:
        json.dump(results, fh, indent=1)
    print(f"{len(results)} equilibria -> {out_path}")


if __name__ == "__main__":
    main()
