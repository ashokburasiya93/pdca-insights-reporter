const { load } = require("./_boot");
module.exports = async (req, res) => {
  try {
    const { PROVIDERS, META } = await load("agent.js");
    res.status(200).json({ ok: true, as_of: META.as_of, synthetic: true, models: PROVIDERS.map((p) => ({ provider: p.name, model: p.model, configured: !!p.key() })) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
};
