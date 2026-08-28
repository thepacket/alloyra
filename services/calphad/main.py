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
import hashlib
import os
from typing import Optional

import time
from collections import defaultdict, deque

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import threading
from collections import OrderedDict

import pycalphad
from pycalphad import Database, equilibrium, variables as v
from pycalphad.codegen.phase_record_factory import PhaseRecordFactory
from pycalphad.core.utils import filter_phases, instantiate_models, unpack_species

app = FastAPI(title="alloyra-calphad")

# The workbench is served as static files and calls this bridge directly
# from the browser. Allow the dev origin by default; add your deployed
# origin via CALPHAD_CORS_ORIGINS (comma-separated).
_origins = [
    o.strip()
    for o in os.environ.get(
        "CALPHAD_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["content-type"],
)

# Hosted endpoint: equilibrium is CPU-bound, so cap per-client rate.
RATE_LIMIT_PER_MIN = int(os.environ.get("CALPHAD_RATE_LIMIT_PER_MIN", "12"))
_hits: dict[str, deque] = defaultdict(deque)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    if request.url.path == "/equilibrium" and request.method == "POST":
        ip = request.headers.get("fly-client-ip") or (
            request.client.host if request.client else "unknown"
        )
        now = time.time()
        q = _hits[ip]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= RATE_LIMIT_PER_MIN:
            return JSONResponse(
                {"detail": f"Rate limit: {RATE_LIMIT_PER_MIN} equilibrium calls per minute. Try again shortly."},
                status_code=429,
            )
        q.append(now)
    return await call_next(request)


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


# MatCalc auxiliary phases: GP-zone/cluster matrix duplicates (GP_*, CL_*)
# and the dislocation-modified BCC variant deliberately duplicate parent-
# phase energetics for MatCalc's kinetic coupling. Left active they tie
# degenerately with the real matrix phase in plain equilibrium (verified:
# mc_al Al-Zn returns GP_MAT in place of FCC_A1), so they are suspended by
# default — reported in /health for transparency.
import re as _re

AUX_PHASE_RE = _re.compile(r"^(GP_|CL_)|^BCC_DISL$")


class LoadedDb:
    def __init__(self, db_id: str, path: str, db: Database):
        self.id = db_id
        self.path = path
        self.db = db
        with open(path, "rb") as fh:
            self.sha256 = hashlib.sha256(fh.read()).hexdigest()
        self.elements = sorted(
            e for e in (str(x).upper() for x in db.elements) if e not in ("VA", "/-")
        )
        all_phases = sorted(db.phases.keys())
        self.suspended = [p for p in all_phases if AUX_PHASE_RE.match(p)]
        self.phases = [p for p in all_phases if not AUX_PHASE_RE.match(p)]


DATABASES: dict[str, LoadedDb] = {}

# Compiled-model cache. Building Model objects and the PhaseRecordFactory
# (symengine codegen) is the expensive, memory-hungry step — with a real
# assessed database it dwarfs the equilibrium solve and must not repeat on
# every request. Keyed by (database, active components); small LRU because
# each entry holds compiled callables for dozens of phases. Fly's
# suspend-on-idle snapshots RAM, so the warm cache survives idle periods.
_MODEL_CACHE_MAX = int(os.environ.get("CALPHAD_MODEL_CACHE_MAX", "6"))
_model_cache: OrderedDict[tuple, tuple] = OrderedDict()
_model_cache_lock = threading.Lock()


def compiled_system(loaded: "LoadedDb", comps: list[str]) -> tuple:
    """(phases, models, phase_record_factory) for a db + component set."""
    key = (loaded.id, tuple(comps))
    with _model_cache_lock:
        hit = _model_cache.get(key)
        if hit is not None:
            _model_cache.move_to_end(key)
            return hit
        # Build inside the lock: concurrent first calls for the same system
        # would otherwise compile twice and double peak memory.
        species = unpack_species(loaded.db, comps)
        # Candidate list is the curated one — auxiliary phases stay suspended.
        phases = filter_phases(loaded.db, species, loaded.phases)
        models = instantiate_models(loaded.db, comps, phases)
        prf = PhaseRecordFactory(loaded.db, species, {v.N, v.P, v.T}, models)
        _model_cache[key] = (phases, models, prf)
        while len(_model_cache) > _MODEL_CACHE_MAX:
            _model_cache.popitem(last=False)
        return _model_cache[key]


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
            {
                "id": d.id,
                "elements": d.elements,
                "phases": d.phases,
                "suspended_auxiliary_phases": d.suspended,
            }
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
        phases, models, prf = compiled_system(loaded, comps)
        eq = equilibrium(
            loaded.db, comps, phases, conditions, model=models, phase_records=prf
        )
    except HTTPException:
        raise
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
        "database_sha256": loaded.sha256,
        "pycalphad_version": pycalphad.__version__,
        "temp_c": req.temp_c,
        "pressure_pa": req.pressure_pa,
        "moles": 1.0,
        # Phases with at least one active component for THIS composition —
        # the set actually offered to the minimizer, not the whole TDB.
        "phases_considered": phases,
        "mole_fractions": x,
        "phases": [
            {"phase": name, "fraction": frac}
            for name, frac in sorted(fractions.items(), key=lambda kv: -kv[1])
        ],
        "note": (
            "EQUILIBRIUM assumption: lever-rule phase fractions in moles over "
            "all phases in the named TDB. The manufactured microstructure "
            "depends on kinetics and process history and WILL differ from "
            "equilibrium. Reliability is bounded by the TDB's underlying "
            "assessed data; convergence/mass-balance diagnostics are not "
            "exposed by this bridge version. Verify the database licence "
            "and cite its publication in any report."
        ),
    }
