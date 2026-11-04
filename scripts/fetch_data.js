// Build step for inline Vercel deploys: downloads the synthetic data and eval sets
// from the public GitHub repo when they are not already present (git deploys have them).
const fs = require("fs"), path = require("path");
const BASE = "https://raw.githubusercontent.com/ashokburasiya93/pdca-insights-reporter/main/";
const FILES = ["data/pdca.json", "data/kpi_readings.json", "evals/dev.json", "evals/holdout.json"];
(async () => {
  for (const f of FILES) {
    const p = path.join(__dirname, "..", f);
    if (fs.existsSync(p)) { console.log("present", f); continue; }
    const r = await fetch(BASE + f);
    if (!r.ok) throw new Error(`fetch ${f}: ${r.status}`);
    const t = await r.text(); JSON.parse(t);
    fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, t);
    console.log("fetched", f, t.length);
  }
})().catch((e) => { console.error(e); process.exit(1); });
