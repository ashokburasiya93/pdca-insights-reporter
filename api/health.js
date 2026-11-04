const { PROVIDERS, META } = require("../lib/agent");
module.exports = (req, res) => res.status(200).json({ ok: true, as_of: META.as_of, synthetic: true, models: PROVIDERS.map((p) => ({ provider: p.name, model: p.model, configured: !!p.key() })) });
