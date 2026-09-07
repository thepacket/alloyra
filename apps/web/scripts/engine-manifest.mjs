import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, relative } from "node:path";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const walk = (dir) => readdirSync(dir, {withFileTypes:true}).flatMap((e) => e.isDirectory() ? walk(resolve(dir,e.name)) : [resolve(dir,e.name)]);
const files = [...walk(resolve(root,"packages/calphad/src")).filter((f) => f.endsWith(".ts")), resolve(root,"apps/web/workers/calphadEngine.worker.ts")].sort();
const hash = createHash("sha256");
for(const f of files) { hash.update(relative(root,f)); hash.update(readFileSync(f)); }
const dbHashes = Object.fromEntries(walk(resolve(root,"apps/web/public/tdb")).filter((f)=>f.endsWith(".tdb")).map((f)=>[f.split("/").at(-1).replace(/\.tdb$/, ""),createHash("sha256").update(readFileSync(f)).digest("hex")]));
writeFileSync(resolve(root,"apps/web/lib/engineManifest.json"), JSON.stringify({version:"alloyra-calphad-1",codeSha256:hash.digest("hex"),dbHashes},null,2)+"\n");
