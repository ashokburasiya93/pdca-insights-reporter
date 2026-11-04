const { load } = require("./_boot");
module.exports = async (req, res) => {
  if (process.env.EVALS_ENABLED !== "true") return res.status(404).json({ error: "evals disabled" });
  const set = req.query.set === "holdout" ? "holdout" : "dev";
  const from = Number(req.query.from || 0), n = Math.min(Number(req.query.n || 10), 16);
  try { const { runBatch } = await load("evals.js"); res.status(200).json(await runBatch(set, from, n)); } catch (e) { res.status(500).json({ error: e.message }); }
};
