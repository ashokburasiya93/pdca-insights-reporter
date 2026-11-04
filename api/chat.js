const { load } = require("./_boot");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const { answer } = await load("agent.js");
    let q, history;
    if (req.method === "POST") { const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}; q = b.message; history = b.history; }
    else { q = req.query.q; }
    const r = await answer(q, history);
    res.status(200).json(r);
  } catch (e) {
    console.error("chat_error", e.message, e.details || "");
    res.status(503).json({ state: "error", answer: "Both AI models are unavailable right now. Please try again in a minute. No answer was guessed.", error: e.message, details: e.details });
  }
};
