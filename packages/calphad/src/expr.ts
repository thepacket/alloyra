/**
 * TDB expression parser/evaluator (B-501). Grammar of Thermo-Calc TDB
 * FUNCTION bodies: numbers (incl. 1.2E-3), T, R? (rare — treated as an
 * unknown symbol error), + − * / **, parentheses, LN(x)/LOG(x) (both
 * natural log in TDB usage), EXP(x), and references to other FUNCTIONs
 * (NAME or NAME#). Compiles to a closure of T with function references
 * resolved lazily so declaration order does not matter.
 */

export type Resolver = (name: string) => (t: number) => number;

type Tok =
  | { k: "num"; v: number }
  | { k: "ident"; v: string }
  | { k: "op"; v: string }
  | { k: "lparen" }
  | { k: "rparen" };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const s = src;
  while (i < s.length) {
    const ch = s[i]!;
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }
    if (ch === "(") {
      toks.push({ k: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      toks.push({ k: "rparen" });
      i++;
      continue;
    }
    if (ch === "*" && s[i + 1] === "*") {
      toks.push({ k: "op", v: "**" });
      i += 2;
      continue;
    }
    if ("+-*/".includes(ch)) {
      toks.push({ k: "op", v: ch });
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      // number: digits, decimal point, optional exponent E±dd
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
      if (!m) throw new Error(`Bad number at "${s.slice(i, i + 12)}"`);
      toks.push({ k: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*#?/.exec(s.slice(i))!;
      toks.push({ k: "ident", v: m[0].replace(/#$/, "").toUpperCase() });
      i += m[0].length;
      continue;
    }
    if (ch === "#") {
      i++; // stray reference marker
      continue;
    }
    throw new Error(`Unexpected character "${ch}" in TDB expression`);
  }
  return toks;
}

type Node =
  | { k: "num"; v: number }
  | { k: "T" }
  | { k: "ref"; name: string }
  | { k: "call"; fn: "LN" | "EXP"; arg: Node }
  | { k: "bin"; op: string; l: Node; r: Node }
  | { k: "neg"; arg: Node };

/** Pratt parser: ** binds tightest (right-assoc), then unary −, * /, + −. */
function parse(toks: Tok[]): Node {
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];

  function primary(): Node {
    const t = next();
    if (!t) throw new Error("Unexpected end of TDB expression");
    if (t.k === "num") return { k: "num", v: t.v };
    if (t.k === "lparen") {
      const e = expr(0);
      const close = next();
      if (!close || close.k !== "rparen") throw new Error("Missing ) in TDB expression");
      return e;
    }
    if (t.k === "op" && (t.v === "-" || t.v === "+")) {
      const arg = unaryOperand();
      return t.v === "-" ? { k: "neg", arg } : arg;
    }
    if (t.k === "ident") {
      const name = t.v;
      if (name === "T") return { k: "T" };
      if ((name === "LN" || name === "LOG" || name === "EXP") && peek()?.k === "lparen") {
        next();
        const arg = expr(0);
        const close = next();
        if (!close || close.k !== "rparen") throw new Error(`Missing ) after ${name}(`);
        return { k: "call", fn: name === "EXP" ? "EXP" : "LN", arg };
      }
      if (name === "P") return { k: "num", v: 101325 }; // fixed 1 atm scope
      if (name === "R") return { k: "num", v: 8.3145 }; // SGTE convention
      return { k: "ref", name };
    }
    throw new Error(`Unexpected token in TDB expression: ${JSON.stringify(t)}`);
  }

  function unaryOperand(): Node {
    // A unary minus binds looser than ** (−T**2 = −(T²)), tighter than * /.
    let base = primary();
    const p = peek();
    if (p && p.k === "op" && p.v === "**") {
      next();
      const exp = unaryOperand();
      base = { k: "bin", op: "**", l: base, r: exp };
    }
    return base;
  }

  const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

  function expr(minPrec: number): Node {
    let left = unaryOperand();
    for (;;) {
      const t = peek();
      if (!t || t.k !== "op" || t.v === "**") break;
      const prec = PREC[t.v];
      if (prec === undefined || prec < minPrec) break;
      next();
      const right = expr(prec + 1);
      left = { k: "bin", op: t.v, l: left, r: right };
    }
    return left;
  }

  const root = expr(0);
  if (pos !== toks.length) {
    throw new Error(`Trailing tokens in TDB expression at ${pos}/${toks.length}`);
  }
  return root;
}

function evaluate(node: Node, t: number, resolve: Resolver): number {
  switch (node.k) {
    case "num":
      return node.v;
    case "T":
      return t;
    case "ref":
      return resolve(node.name)(t);
    case "call":
      return node.fn === "LN" ? Math.log(evaluate(node.arg, t, resolve)) : Math.exp(evaluate(node.arg, t, resolve));
    case "neg":
      return -evaluate(node.arg, t, resolve);
    case "bin": {
      const l = evaluate(node.l, t, resolve);
      const r = evaluate(node.r, t, resolve);
      switch (node.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return l / r;
        case "**":
          return l ** r;
        default:
          throw new Error(`Unknown operator ${node.op}`);
      }
    }
  }
}

export function compileExpression(src: string, resolve: Resolver): (t: number) => number {
  const ast = parse(tokenize(src));
  return (t: number) => evaluate(ast, t, resolve);
}

export interface PiecewiseSegment {
  lo: number;
  hi: number;
  fn: (t: number) => number;
}

/** Evaluate a piecewise function; clamps to the nearest segment outside range. */
export function evalPiecewise(segments: PiecewiseSegment[], t: number): number {
  for (const s of segments) {
    if (t >= s.lo && t <= s.hi) return s.fn(t);
  }
  if (segments.length === 0) return 0;
  const first = segments[0]!;
  const last = segments[segments.length - 1]!;
  return t < first.lo ? first.fn(t) : last.fn(t);
}
