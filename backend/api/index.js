let app, loadError;
try {
  app = require("../server");
} catch (e) {
  loadError = e;
}

module.exports = (req, res) => {
  if (loadError) {
    return res.status(500).json({ startupError: loadError.message });
  }
  return app(req, res);
};