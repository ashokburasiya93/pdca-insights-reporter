// Runs the dev and held-out eval sets against a deployed app (EVALS_ENABLED=true) and prints a summary.
// Usage: node scripts/run_live_evals.js https://pdca-insights-reporter.vercel.app [dev|holdout|all] [batch]
const fs = require("fs");
const BASE = process.argv[2] || "https://pdca-insights-reporter.vercel.app";
const which = process.argv[3] || "all", B = Number(process.argv[4] || 4);
const p95 = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)] || 0; };
async function runSet(set) {
  const results = []; let from = 0, total = Infinity;
  while (from < total) {
    let j;
    for (let t = 0; t < 3; t++) { try { const r = await fetch(`${BASE}/api/evals?set=${set}&from=${from}&n=${B}`); j = await r.json(); if (j.results) break; console.error("batch error", r.status, JSON.stringify(j).slice(0, 300)); } catch (e) { console.error("fetch error", e.message); } await new Promise((r) => setTimeout(r, 5000)); }
    if (!j || !j.results) throw new Error(`batch ${set}@${from} failed`);
    total = j.total_in_set; results.push(...j.results); from += B;
    process.stderr.write(`${set} ${Math.min(from, total)}/${total}\n`);
  }
  return results;
}
function summary(set, R) {
  const by = (t) => R.filter((r) => r.type === t);
  const rate = (a, f) => (a.length ? `${a.filter(f).length}/${a.length}` : "n/a");
  const safety = R.filter((r) => r.type === "decline" || r.type === "injection");
  const ans = R.filter((r) => r.type === "answer" || r.type === "not_in_data");
  const toolItems = R.filter((r) => r.tool_ok !== null && r.tool_ok !== undefined);
  const recall = R.filter((r) => r.tools && r.tools.includes("search_lessons") && r.type === "answer");
  const lat = R.filter((r) => r.state !== "declined").map((r) => r.latency_ms);
  const tok = R.map((r) => r.usage).filter(Boolean);
  const avg = (k) => tok.length ? Math.round(tok.reduce((s, u) => s + (u[k] || 0), 0) / tok.length) : null;
  const models = {}; R.forEach((r) => { models[r.model || "none"] = (models[r.model || "none"] || 0) + 1; });
  return { set, n: R.length, safety_pass: rate(safety, (r) => r.pass), accuracy_pass: rate(ans, (r) => r.pass), tool_selection: rate(toolItems, (r) => r.tool_ok), lessons_pass: rate(recall, (r) => r.pass), grounding_pass: rate(R, (r) => r.grounded !== false), p95_latency_ms: p95(lat), median_latency_ms: p95(lat.length ? lat : [0]) && lat.slice().sort((a, b) => a - b)[Math.floor(lat.length / 2)], avg_prompt_tokens: avg("prompt_tokens"), avg_completion_tokens: avg("completion_tokens"), models, failures: R.filter((r) => !r.pass).map((r) => ({ id: r.id, type: r.type, state: r.state, q: r.question, missing: r.missing, tools: r.tools, answer: (r.answer || "").slice(0, 200), err: r.error })) };
}
(async () => {
  const sets = which === "all" ? ["dev", "holdout"] : [which]; const out = {};
  for (const s of sets) { const R = await runSet(s); out[s] = { summary: summary(s, R), results: R }; }
  fs.writeFileSync("eval_results.json", JSON.stringify(out, null, 1));
  for (const s of sets) console.log(JSON.stringify(out[s].summary, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
