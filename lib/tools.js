// Read-only PDCA query tools. All counting, date maths and KPI comparisons happen here, never in the model.
const DB = require("../data/pdca.json");
const READINGS = require("../data/kpi_readings.json");

const META = DB.meta;
const AS_OF = new Date(META.as_of + "T00:00:00Z");
const DAY = 86400000;
const days = (a, b) => Math.round((b - a) / DAY);
const d = (s) => (s ? new Date(s + "T00:00:00Z") : null);
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const norm = (s) => (s || "").toString().trim().toLowerCase();
const lineOf = (x) => {
  if (!x) return null;
  const m = String(x).match(/(\d)/);
  return m ? `Line ${m[1]}` : null;
};
const KPI_ALIASES = { oee: "oee", scrap: "scrap_pct", scrap_pct: "scrap_pct", "scrap %": "scrap_pct", downtime: "downtime_min", downtime_min: "downtime_min", fpy: "fpy", "first pass yield": "fpy", "first-pass yield": "fpy", yield: "fpy" };
const kpiOf = (x) => (x ? KPI_ALIASES[norm(x)] || null : null);
const STAGES = ["plan", "do", "check", "act"];

function cycleRow(c) {
  const inStage = days(d(c.stage_entered), AS_OF);
  return {
    id: c.id, title: c.title, line: c.line, area: c.area, kpi: META.kpis[c.kpi], stage: c.stage, status: c.status,
    days_in_stage: c.status === "Open" ? inStage : null, owner: c.owner || "Unassigned",
    baseline: c.baseline, target: c.target, due_date: c.due_date,
    overdue_cycle: c.status === "Open" && c.due_date ? d(c.due_date) < AS_OF : false,
    duplicate_of: c.duplicate_of || null,
  };
}

function list_cycles(a = {}) {
  let rows = DB.cycles.slice();
  const status = norm(a.status || "open");
  if (status !== "all") rows = rows.filter((c) => norm(c.status) === status);
  const line = lineOf(a.line); if (line) rows = rows.filter((c) => c.line === line);
  if (a.stage && STAGES.includes(norm(a.stage))) rows = rows.filter((c) => norm(c.stage) === norm(a.stage));
  const kpi = kpiOf(a.kpi); if (kpi) rows = rows.filter((c) => c.kpi === kpi);
  if (a.owner) rows = rows.filter((c) => norm(c.owner || "unassigned").includes(norm(a.owner)));
  let out = rows.map(cycleRow);
  if (a.min_days_in_stage != null) out = out.filter((r) => r.days_in_stage != null && r.days_in_stage > Number(a.min_days_in_stage));
  if (a.kpi_verified === false) out = out.filter((r) => { const c = DB.cycles.find((x) => x.id === r.id); return c.status === "Closed" && !c.kpi_verified; });
  out.sort((x, y) => (y.days_in_stage || 0) - (x.days_in_stage || 0) || x.id.localeCompare(y.id));
  return { as_of: META.as_of, filters: a, count: out.length, cycles: out };
}

function stuck_cycles(a = {}) {
  const th = a.min_days != null ? Number(a.min_days) : META.stuck_threshold_days;
  const r = list_cycles({ status: "open", line: a.line, stage: a.stage || null, min_days_in_stage: th });
  return { as_of: META.as_of, rule: `open cycles in their current stage for more than ${th} days` + (a.stage ? ` (stage ${a.stage})` : ""), count: r.count, cycles: r.cycles };
}

function get_cycle(a = {}) {
  const id = String(a.id || "").toUpperCase().replace(/^PDCA-?(\d+)$/, (m, n) => `PDCA-${n.padStart(3, "0")}`);
  const c = DB.cycles.find((x) => x.id === id);
  if (!c) return { as_of: META.as_of, found: false, id };
  const acts = DB.actions.filter((x) => x.cycle_id === id).map(actionRow);
  const lesson = DB.lessons.find((l) => l.cycle_id === id) || null;
  return { as_of: META.as_of, found: true, cycle: { ...cycleRow(c), problem: c.problem, root_cause: c.root_cause || "not recorded", countermeasure: c.countermeasure || "not recorded", countermeasure_date: c.countermeasure_date, start_date: c.start_date, stage_entered: c.stage_entered, closed_date: c.closed_date, kpi_verified: c.kpi_verified }, actions: acts, lesson };
}

function actionRow(x) {
  const due = d(x.due_date);
  const overdue = x.status !== "Done" && due && due < AS_OF;
  return { id: x.id, cycle_id: x.cycle_id, line: x.line, action: x.action, owner: x.owner || "Unassigned", due_date: x.due_date || "no due date", status: x.status, days_overdue: overdue ? days(due, AS_OF) : 0 };
}

function list_actions(a = {}) {
  let rows = DB.actions.slice();
  const line = lineOf(a.line); if (line) rows = rows.filter((x) => x.line === line);
  if (a.cycle_id) rows = rows.filter((x) => x.cycle_id === String(a.cycle_id).toUpperCase());
  if (a.owner) rows = rows.filter((x) => norm(x.owner || "unassigned").includes(norm(a.owner)));
  let out = rows.map(actionRow);
  if (a.overdue_only) out = out.filter((x) => x.days_overdue > 0);
  if (a.status) out = out.filter((x) => norm(x.status) === norm(a.status));
  if (a.no_due_date) out = out.filter((x) => x.due_date === "no due date");
  out.sort((x, y) => y.days_overdue - x.days_overdue || x.id.localeCompare(y.id));
  const byOwner = {};
  out.forEach((x) => (byOwner[x.owner] = (byOwner[x.owner] || 0) + 1));
  return { as_of: META.as_of, rule: a.overdue_only ? "not Done and due date before the as-of date" : "all matching actions", count: out.length, by_owner: byOwner, actions: out };
}

function series(line, kpi, from, to, shift) {
  return READINGS.filter((r) => r.line === line && r.date >= from && r.date <= to && (!shift || r.shift === shift)).map((r) => r[kpi]);
}
const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
const iso = (t) => new Date(t).toISOString().slice(0, 10);

function kpi_effect(a = {}) {
  const g = get_cycle({ id: a.cycle_id });
  if (!g.found) return { found: false, cycle_id: a.cycle_id };
  const c = DB.cycles.find((x) => x.id === g.cycle.id);
  const win = Math.min(Math.max(Number(a.window_days) || 28, 7), 90);
  if (!c.countermeasure_date) return { as_of: META.as_of, cycle_id: c.id, verdict: "no_countermeasure_date", explanation: "This cycle has no countermeasure date recorded, so before/after cannot be compared." };
  const cm = d(c.countermeasure_date).getTime();
  const lastData = d(READINGS[READINGS.length - 1].date).getTime();
  const bFrom = iso(cm - win * DAY), bTo = iso(cm - DAY), aFrom = iso(cm), aTo = iso(Math.min(cm + (win - 1) * DAY, lastData));
  const before = series(c.line, c.kpi, bFrom, bTo), after = series(c.line, c.kpi, aFrom, aTo);
  const afterDays = new Set(READINGS.filter((r) => r.line === c.line && r.date >= aFrom && r.date <= aTo).map((r) => r.date)).size;
  const beforeDays = new Set(READINGS.filter((r) => r.line === c.line && r.date >= bFrom && r.date <= bTo).map((r) => r.date)).size;
  const hb = META.higher_is_better[c.kpi];
  const res = { as_of: META.as_of, cycle_id: c.id, title: c.title, line: c.line, kpi: META.kpis[c.kpi], higher_is_better: hb, countermeasure: c.countermeasure, countermeasure_date: c.countermeasure_date, target: c.target,
    before: { window: `${bFrom} to ${bTo}`, days_with_data: beforeDays, readings: before.length, mean: r1(mean(before)) },
    after: { window: `${aFrom} to ${aTo}`, days_with_data: afterDays, readings: after.length, mean: r1(mean(after)) } };
  if (beforeDays < META.min_days_for_effect || afterDays < META.min_days_for_effect) {
    return { ...res, verdict: "insufficient_data", explanation: `Fewer than ${META.min_days_for_effect} days of readings on one side; effectiveness cannot be judged yet.` };
  }
  const change = res.after.mean - res.before.mean;
  const improved = hb ? change > 0 : change < 0;
  const meaningful = Math.abs(change) >= Math.abs(res.before.mean) * 0.05;
  const met = c.target == null ? null : hb ? res.after.mean >= c.target : res.after.mean <= c.target;
  const verdict = met ? "target_met" : improved && meaningful ? "improved_target_not_met" : "no_clear_improvement";
  return { ...res, change: r1(change), change_pct: r1((change / res.before.mean) * 100), target_met: met, verdict,
    wording_rule: "Describe as 'associated with' the countermeasure, never 'caused by'." };
}

function kpi_trend(a = {}) {
  const line = lineOf(a.line); const kpi = kpiOf(a.kpi);
  if (!line || !kpi) return { error: "line and kpi are required (kpi: oee, scrap, downtime, fpy)" };
  const weeks = Math.min(Math.max(Number(a.weeks) || 8, 2), 26);
  const end = d(READINGS[READINGS.length - 1].date).getTime();
  const shift = a.shift ? (norm(a.shift).startsWith("b") || norm(a.shift).includes("night") ? "B" : "A") : null;
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const to = iso(end - w * 7 * DAY), from = iso(end - w * 7 * DAY - 6 * DAY);
    const xs = series(line, kpi, from, to, shift);
    out.push({ week: `${from} to ${to}`, readings: xs.length, mean: r1(mean(xs)) });
  }
  const linked = DB.cycles.filter((c) => c.line === line && c.kpi === kpi && c.status === "Open").map((c) => ({ id: c.id, title: c.title, stage: c.stage }));
  return { as_of: META.as_of, line, kpi: META.kpis[kpi], shift: shift || "both", weeks: out, open_cycles_on_this_kpi: linked,
    note: "Trend only; the data cannot show what caused a change." };
}

// ---- BM25 search over lessons learned (local, no embedding API)
const SYN = { porosity: ["pinholes", "blowholes"], pinholes: ["porosity"], misalignment: ["misaligned", "offset"], downtime: ["stoppage", "stops", "breakdown"], stoppage: ["downtime", "stop"], crack: ["split", "cracks"], scrap: ["reject", "defect"], dust: ["dirt", "inclusion"], torque: ["nutrunner", "fastener"], changeover: ["setup", "smed", "die change"], leak: ["leakage", "seal"], paint: ["coating"], run: ["sag", "runs"] };
const STOP = new Set(["quality", "line", "issue", "issues", "problem", "problems", "seen", "before", "have", "the", "and", "what", "with", "similar", "case", "cases", "root", "cause", "worked", "keywords", "repeat", "shift", "plant", "any", "past", "fix", "fixed"]);
const tok = (s) => norm(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2);
const DOCS = DB.lessons.map((l) => { const c = DB.cycles.find((x) => x.id === l.cycle_id); return { l, c, toks: tok(`${c.title} ${l.notes} ${l.root_cause} ${l.countermeasure}`) }; });
const N = DOCS.length, avgdl = DOCS.reduce((s, x) => s + x.toks.length, 0) / N;
const df = {}; DOCS.forEach((x) => new Set(x.toks).forEach((t) => (df[t] = (df[t] || 0) + 1)));
function search_lessons(a = {}) {
  let q = tok(a.query); q = q.concat(...q.map((t) => (SYN[t] || []).flatMap(tok)));
  const scored = DOCS.map((x) => {
    let s = 0, hits = 0;
    for (const t of new Set(q)) { if (STOP.has(t)) continue; const f = x.toks.filter((y) => y === t).length; if (!f) continue; const idf = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5)); s += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * x.toks.length / avgdl)); hits++; }
    return { x, s, hits };
  }).filter((y) => y.s >= 3 && y.hits >= 2).sort((p, q2) => q2.s - p.s).slice(0, 3);
  return { as_of: META.as_of, query: a.query, threshold: "BM25 score of 3 or more and at least 2 matching terms", matches: scored.map(({ x, s }) => ({ lesson_id: x.l.id, cycle_id: x.c.id, title: x.c.title, line: x.c.line, closed_date: x.c.closed_date, root_cause: x.l.root_cause, countermeasure: x.l.countermeasure, result: x.l.result, note: x.l.notes, score: r1(s) })),
    note: scored.length ? undefined : "No similar case found above the threshold." };
}

function data_quality(a = {}) {
  const line = lineOf(a.line);
  const oc = DB.cycles.filter((c) => c.status === "Open" && (!line || c.line === line));
  const oa = DB.actions.filter((x) => x.status !== "Done" && (!line || x.line === line));
  return { as_of: META.as_of, line: line || "all lines",
    cycles_without_owner: oc.filter((c) => !c.owner).map((c) => c.id),
    cycles_without_baseline_or_target: oc.filter((c) => c.baseline == null || c.target == null).map((c) => c.id),
    possible_duplicates: oc.filter((c) => c.duplicate_of).map((c) => ({ id: c.id, duplicate_of: c.duplicate_of })),
    open_actions_without_owner: oa.filter((x) => !x.owner).map((x) => x.id),
    open_actions_without_due_date: oa.filter((x) => !x.due_date).map((x) => x.id) };
}

function pdca_summary(a = {}) {
  const line = lineOf(a.line);
  const oc = DB.cycles.filter((c) => c.status === "Open" && (!line || c.line === line));
  const byStage = { Plan: 0, Do: 0, Check: 0, Act: 0 }; oc.forEach((c) => byStage[c.stage]++);
  const stuck = stuck_cycles({ line, stage: "Check" });
  const od = list_actions({ line, overdue_only: true });
  const closedUnverified = DB.cycles.filter((c) => c.status === "Closed" && !c.kpi_verified && (!line || c.line === line)).map((c) => c.id);
  const effects = oc.filter((c) => c.countermeasure_date).map((c) => kpi_effect({ cycle_id: c.id })).filter((e) => e.verdict === "target_met" || e.verdict === "improved_target_not_met")
    .map((e) => ({ cycle_id: e.cycle_id, title: e.title, kpi: e.kpi, before: e.before.mean, after: e.after.mean, target: e.target, verdict: e.verdict }));
  return { as_of: META.as_of, scope: line || "all lines", open_cycles: oc.length, open_by_stage: byStage,
    stuck_in_check_over_14_days: { count: stuck.count, ids: stuck.cycles.map((c) => c.id) },
    overdue_actions: { count: od.count, by_owner: od.by_owner },
    closed_cycles_without_kpi_verification: { count: closedUnverified.length, ids: closedUnverified },
    countermeasures_showing_improvement: effects, data_quality: data_quality({ line }) };
}

const TOOLS = { list_cycles, stuck_cycles, get_cycle, list_actions, kpi_effect, kpi_trend, search_lessons, data_quality, pdca_summary };

const SCHEMAS = [
  { name: "list_cycles", description: "List PDCA cycles with filters. Use for status questions such as 'which cycles are in Check on Line 2' or 'cycles owned by Priya' or 'closed cycles without KPI verification' (status closed, kpi_verified false).", parameters: { type: "object", properties: { status: { type: "string", enum: ["open", "closed", "all"] }, line: { type: "string", description: "e.g. 'Line 2'" }, stage: { type: "string", enum: ["Plan", "Do", "Check", "Act"] }, kpi: { type: "string", enum: ["oee", "scrap", "downtime", "fpy"] }, owner: { type: "string" }, min_days_in_stage: { type: "number" }, kpi_verified: { type: "boolean" } } } },
  { name: "stuck_cycles", description: "Open cycles stuck in their current stage for more than N days (default 14). Optional stage filter, e.g. stage 'Check'.", parameters: { type: "object", properties: { line: { type: "string" }, stage: { type: "string", enum: ["Plan", "Do", "Check", "Act"] }, min_days: { type: "number" } } } },
  { name: "get_cycle", description: "Full detail of one PDCA cycle by ID (e.g. PDCA-017): problem, root cause, countermeasure, owner, stage, actions and lesson.", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "list_actions", description: "List PDCA actions. Use overdue_only=true for overdue actions. Filters: line, owner, cycle_id, status, no_due_date.", parameters: { type: "object", properties: { overdue_only: { type: "boolean" }, line: { type: "string" }, owner: { type: "string" }, cycle_id: { type: "string" }, status: { type: "string", enum: ["Open", "In progress", "Done"] }, no_due_date: { type: "boolean" } } } },
  { name: "kpi_effect", description: "Did a countermeasure work? Compares the cycle KPI before vs after the countermeasure date against target, computed in code.", parameters: { type: "object", properties: { cycle_id: { type: "string" }, window_days: { type: "number", description: "days each side, default 28" } }, required: ["cycle_id"] } },
  { name: "kpi_trend", description: "Weekly KPI trend for a line (optionally one shift) plus open cycles on that KPI.", parameters: { type: "object", properties: { line: { type: "string" }, kpi: { type: "string", enum: ["oee", "scrap", "downtime", "fpy"] }, shift: { type: "string", enum: ["A", "B"] }, weeks: { type: "number" } }, required: ["line", "kpi"] } },
  { name: "search_lessons", description: "Find similar past PDCA cases and lessons learned for a problem description ('have we seen weld porosity before?').", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "data_quality", description: "Data quality gaps: cycles without owner, baseline or target, possible duplicates, actions without owner or due date.", parameters: { type: "object", properties: { line: { type: "string" } } } },
  { name: "pdca_summary", description: "Overall PDCA status for the weekly review or plant head brief: counts by stage, stuck cycles, overdue actions, unverified closures, improvements, data quality.", parameters: { type: "object", properties: { line: { type: "string" } } } },
  { name: "decline", description: "Call this INSTEAD of other tools when the question is outside manufacturing PDCA (HR, salary, finance, sales, general knowledge, coding, chit-chat) or unsafe (machine settings, process parameters, bypassing safety, maintenance instructions).", parameters: { type: "object", properties: { reason: { type: "string", enum: ["out_of_scope", "unsafe"] } }, required: ["reason"] } },
];

module.exports = { TOOLS, SCHEMAS, META };
