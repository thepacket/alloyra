"""Alloyra CALPHAD bridge (blueprint § 9, milestone M3).

A thin HTTP wrapper around pycalphad implementing the equilibrium half of
the ModelProvider interface. Thermodynamic databases (.tdb) are USER-
SUPPLIED: drop them into ./databases and restart. Alloyra ships none —
database licensing is the user's responsibility (blueprint N-5); see
databases/README.md for openly available options.

Run:  uvicorn main:app --port 8791
"""

from __future__ import annotations

import glob
import os
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import pycalphad
from pycalphad import Database, equilibrium, variables as v

app = FastAPI(title="alloyra-calphad")

DB_DIR = os.path.join(os.path.dirname(__file__), "databases")

# Standard atomic weights (g/mol), CIAAW 2021 abridged — for wt% → mole
# fraction conversion only.
ATOMIC_MASS = {
    "H": 1.008, "B": 10.81, "C": 12.011, "N": 14.007, "O": 15.999,
    "MG": 24.305, "AL": 26.982, "SI": 28.085, "P": 30.974, "S": 32.06,
    "TI": 47.867, "V": 50.942, "CR": 51.996, "MN": 54.938, "FE": 55.845,
    "CO": 58.933, "NI": 58.693, "CU": 63.546, "ZN": 65.38, "ZR": 91.224,
    "NB": 92.906, "MO": 95.95, "SN": 118.71, "TA": 180.95, "W": 183.84,
    "PB": 207.2,
}


class LoadedDb:
    def __init__(self, db_id: str, path: str, db: Database):
        self.id = db_id
        self.path = path
        self.db = db
        self.elements = sorted(
            e for e in (str(x).upper() for x in db.elements) if e not in ("VA", "/-")
        )
        self.phases = sorted(db.phases.keys())


DATABASES: dict[str, LoadedDb] = {}


def load_databases() -> None:
    DATABASES.clear()
    for path in sorted(glob.glob(os.path.join(DB_DIR, "*.tdb")) + glob.glob(os.path.join(DB_DIR, "*.TDB"))):
        db_id = os.path.splitext(os.path.basename(path))[0]
        try:
            DATABASES[db_id] = LoadedDb(db_id, path, Database(path))
        except Exception as exc:  # noqa: BLE001 — a bad TDB must not kill the service
            print(f"[calphad] failed to load {path}: {exc}")


load_databases()


def wt_to_mole_fractions(wt_pct: dict[str, float]) -> dict[str, float]:
    """Convert wt% to mole fractions. Keys are element symbols (any case)."""
    moles: dict[str, float] = {}
    for el, pct in wt_pct.items():
        key = el.upper()
        if key not in ATOMIC_MASS:
            raise HTTPException(422, f"No atomic mass on file for element '{el}'.")
        if pct < 0:
            raise HTTPException(422, f"Negative content for '{el}'.")
        moles[key] = pct / ATOMIC_MASS[key]
    total = sum(moles.values())
    if total <= 0:
        raise HTTPException(422, "Empty composition.")
    return {el: m / total for el, m in moles.items()}


class EquilibriumRequest(BaseModel):
    database_id: str
    # wt% by element; must sum to ~100 (balance included by the caller).
    composition_wt: dict[str, float]
    temp_c: float
    pressure_pa: float = 101325.0


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "pycalphad": pycalphad.__version__,
        "databases": [
            {"id": d.id, "elements": d.elements, "phases": d.phases}
            for d in DATABASES.values()
        ],
    }


@app.post("/equilibrium")
def run_equilibrium(req: EquilibriumRequest) -> dict:
    loaded = DATABASES.get(req.database_id)
    if loaded is None:
        raise HTTPException(404, f"Unknown database '{req.database_id}'. Loaded: {sorted(DATABASES)}")

    x = wt_to_mole_fractions(req.composition_wt)
    missing = [el for el in x if el not in loaded.elements]
    if missing:
        raise HTTPException(
            422,
            f"Database '{loaded.id}' does not cover: {', '.join(missing)} "
            f"(covers {', '.join(loaded.elements)}).",
        )

    comps = sorted(x) + ["VA"]
    # Fix N−1 compositions; the balance element is implicit.
    dependent = max(x, key=lambda el: x[el])
    conditions: dict = {
        v.T: req.temp_c + 273.15,
        v.P: req.pressure_pa,
        v.N: 1.0,
    }
    for el, frac in x.items():
        if el != dependent:
            conditions[v.X(el)] = frac

    try:
        eq = equilibrium(loaded.db, comps, loaded.phases, conditions)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"pycalphad equilibrium failed: {exc}") from exc

    fractions: dict[str, float] = {}
    phase_arr = eq.Phase.values.flatten()
    np_arr = eq.NP.values.flatten()
    for name, frac in zip(phase_arr, np_arr):
        if name and frac == frac and frac > 1e-9:  # skip '' and NaN
            fractions[str(name)] = fractions.get(str(name), 0.0) + float(frac)

    return {
        "database_id": loaded.id,
        "database_file": os.path.basename(loaded.path),
        "temp_c": req.temp_c,
        "mole_fractions": x,
        "phases": [
            {"phase": name, "fraction": frac}
            for name, frac in sorted(fractions.items(), key=lambda kv: -kv[1])
        ],
        "note": (
            "Equilibrium (lever-rule) phase fractions in moles from the named "
            "TDB. Metastable/as-quenched microstructures will differ."
        ),
    }
