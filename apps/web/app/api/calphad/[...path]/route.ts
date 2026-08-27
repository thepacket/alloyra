import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy to the CALPHAD bridge (services/calphad). Keeps the browser on
 * one origin and the service address in one env var. Only the two known
 * endpoints pass through; unavailability degrades to a clean 503 the UI
 * understands (never a stack trace).
 */
const CALPHAD_URL = process.env.CALPHAD_URL ?? "http://127.0.0.1:8791";
const ALLOWED = new Set(["health", "equilibrium"]);

async function forward(req: NextRequest, path: string[]): Promise<NextResponse> {
  const endpoint = path.join("/");
  if (!ALLOWED.has(endpoint)) {
    return NextResponse.json({ error: "unknown endpoint" }, { status: 404 });
  }
  try {
    const init: RequestInit = { method: req.method, signal: AbortSignal.timeout(30_000) };
    if (req.method === "POST") {
      init.headers = { "content-type": "application/json" };
      init.body = await req.text();
    }
    const res = await fetch(`${CALPHAD_URL}/${endpoint}`, init);
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      {
        error: "calphad-offline",
        detail: `CALPHAD bridge not reachable at ${CALPHAD_URL}. Start it with: cd services/calphad && .venv/bin/uvicorn main:app --port 8791`,
      },
      { status: 503 },
    );
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path);
}
