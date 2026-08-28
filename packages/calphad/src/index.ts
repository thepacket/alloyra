/**
 * @alloyra/calphad — experimental in-browser CALPHAD engine (backlog
 * B-501, competitive-analysis § 5 path B). Scope of this first slice:
 * TDB parsing, compound-energy-formalism Gibbs energies (R-K excess +
 * IHJ magnetics), and binary point equilibrium by dense sampling + lower
 * convex hull. Validated against pycalphad-generated reference fixtures;
 * NOT yet wired into the product UI — the hosted pycalphad service stays
 * authoritative until this engine matches it across the shipped
 * databases.
 */
export { compileExpression, evalPiecewise, type PiecewiseSegment } from "./expr.ts";
export { parseTdb, type TdbDatabase, type TdbParameter, type TdbPhase } from "./tdb.ts";
export { R_GAS, buildPhaseModel, type PhaseModel } from "./gibbs.ts";
export {
  binaryPointEquilibrium,
  type BinaryEquilibriumResult,
  type EquilibriumPhase,
} from "./equilibrium.ts";
export { solveTangentLp } from "./lp.ts";
export { ATOMIC_MASS, wtToMoleFractions } from "./composition.ts";
export {
  pointEquilibrium,
  type MulticomponentPhase,
  type MulticomponentResult,
} from "./multicomponent.ts";
export { stepTemperature, type StepPoint } from "./step.ts";
export { scheilSolidify, type ScheilResult, type ScheilStep } from "./scheil.ts";
