// Deterministic checks of the tools against the synthetic dataset's planted facts (no LLM needed).
const assert = require("assert");
const { TOOLS } = require("../lib/tools");
const { groundingCheck } = require("../lib/agent");
assert.strictEqual(TOOLS.list_cycles({}).count, 38);
assert.strictEqual(TOOLS.stuck_cycles({ stage: "Check" }).count, 11);
assert.strictEqual(TOOLS.list_actions({ overdue_only: true }).count, 27);
assert.strictEqual(TOOLS.list_cycles({ status: "closed", kpi_verified: false }).count, 9);
const e = TOOLS.kpi_effect({ cycle_id: "PDCA-017" }); assert.strictEqual(e.verdict, "improved_target_not_met");
assert.ok(TOOLS.search_lessons({ query: "pinholes in welds" }).matches.length > 0);
assert.strictEqual(TOOLS.search_lessons({ query: "canteen food quality" }).matches.length, 0);
assert.strictEqual(TOOLS.get_cycle({ id: "PDCA-099" }).found, false);
const t = [JSON.stringify(e)];
assert.ok(groundingCheck(`Scrap ${e.before.mean}% to ${e.after.mean}% [PDCA-017]`, t, "q").passed);
assert.ok(!groundingCheck("Scrap fell to 1.9% [PDCA-017]", t, "q").passed);
console.log("all tool checks passed");
