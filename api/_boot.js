// Loads the app modules. Uses the bundled lib/ when present (git deploys); otherwise
// downloads lib/, data/ and evals/ from the public repo into /tmp once per cold start (inline deploys).
const fs = require("fs"), path = require("path");
const FILES = ["lib/agent.js", "lib/tools.js", "lib/evals.js", "data/pdca.json", "data/kpi_readings.json", "evals/dev.json", "evals/holdout.json"];
let ready;
function load(mod) {
  if (!ready) ready = (async () => {
    const local = path.join(__dirname, "..");
    if (fs.existsSync(path.join(local, "lib", "agent.js")) && fs.existsSync(path.join(local, "data", "pdca.json"))) return local;
    const ref = process.env.SOURCE_REF || "main";
    const base = `https://raw.githubusercontent.com/ashokburasiya93/pdca-insights-reporter/${ref}/`;
    const root = "/tmp/pdca-app";
    await Promise.all(FILES.map(async (f) => {
      const r = await fetch(base + f); if (!r.ok) throw new Error(`load ${f}: ${r.status}`);
      const p = path.join(root, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, await r.text());
    }));
    return root;
  })().catch((e) => { ready = null; throw e; });
  return ready.then((root) => require(path.join(root, "lib", mod)));
}
module.exports = { load };
