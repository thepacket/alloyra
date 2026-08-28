"""Reprice engine-found states with pycalphad (B-501 promotion evidence).

For each cross-check disagreement, run pycalphad RESTRICTED to the TS
engine's phase set at the same composition/T. If the restricted GM is
LOWER than pycalphad's own free equilibrium, the ENGINE found the deeper
minimum (a pycalphad solver miss); if higher, the engine missed. Prints a
verdict per disagreement for the validation report.

Run: .venv/bin/python scripts/reprice_disagreements.py <disagreements.json>
where the file holds [{id, tempC, tsSet: ["FCC_A1", ...]}].
"""

from __future__ import annotations

import json
import os
import re
import sys
from functools import lru_cache

from pycalphad import Database, equilibrium, variables as v
from pycalphad.codegen.phase_record_factory import PhaseRecordFactory

_og = PhaseRecordFactory.get


@lru_cache(maxsize=None)
def _g(self, pn):
    return _og(self, str(pn))


PhaseRecordFactory.get = _g
PhaseRecordFactory.__getitem__ = _g

HERE = os.path.dirname(os.path.abspath(__file__))
AM = {"H": 1.008, "B": 10.81, "C": 12.011, "N": 14.007, "O": 15.999, "MG": 24.305,
      "AL": 26.982, "SI": 28.085, "P": 30.974, "S": 32.06, "TI": 47.867, "V": 50.942,
      "CR": 51.996, "MN": 54.938, "FE": 55.845, "CO": 58.933, "NI": 58.693,
      "CU": 63.546, "ZN": 65.38, "ZR": 91.224, "NB": 92.906, "MO": 95.95,
      "SN": 118.71, "TA": 180.95, "W": 183.84, "PB": 207.2, "AG": 107.87,
      "BI": 208.98, "SB": 121.76}


def main() -> None:
    disagreements = json.load(open(sys.argv[1]))
    cases = {c["id"]: c for c in json.load(
        open(os.path.join(HERE, "../../../packages/calphad/scripts/crosscheck-cases.json")))}
    oracle = {(r["id"], r["tempC"]): r for r in json.load(
        open(os.path.join(HERE, "../../../packages/calphad/scripts/crosscheck-oracle.json")))}
    dbs: dict[str, Database] = {}

    for d in disagreements:
        c = cases[d["id"]]
        ref = oracle[(d["id"], d["tempC"])]
        if c["db"] not in dbs:
            dbs[c["db"]] = Database(os.path.join(HERE, "..", "databases", f"{c['db']}.tdb"))
        db = dbs[c["db"]]
        moles = {el.upper(): p / AM[el.upper()] for el, p in c["wt"].items() if p > 0}
        tot = sum(moles.values())
        x = {el: m / tot for el, m in moles.items()}
        comps = sorted(x) + ["VA"]
        dep = max(x, key=lambda e: x[e])
        conds = {v.T: d["tempC"] + 273.15, v.P: 101325.0, v.N: 1.0}
        for el, f in x.items():
            if el != dep:
                conds[v.X(el)] = f
        # Strip the engine's miscibility-gap suffix ("×2") for the phase list.
        ts_set = sorted({re.sub(r"×\d+$", "", p) for p in d["tsSet"]})
        try:
            eq = equilibrium(db, comps, ts_set, conds)
            gm_ts_state = float(eq.GM.values.flatten()[0])
        except Exception as exc:  # noqa: BLE001
            print(f"{d['id']} @ {d['tempC']}: reprice failed — {exc}")
            continue
        gm_free = ref["gm"]
        delta = gm_ts_state - gm_free
        verdict = ("ENGINE DEEPER (pycalphad solver missed this state)" if delta < -0.5
                   else "ENGINE SHALLOWER (engine missed pycalphad's state)" if delta > 0.5
                   else "DEGENERATE (within 0.5 J/mol-atom)")
        print(f"{d['id']} @ {d['tempC']}: TS-set GM {gm_ts_state:.1f} vs free {gm_free:.1f} "
              f"(Δ {delta:+.1f} J/mol-atom) -> {verdict}")


if __name__ == "__main__":
    main()
