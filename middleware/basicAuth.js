// middleware/basicAuth.js
module.exports = function basicAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [, base64] = header.split(" ");
  if (!base64) {
    res.set("WWW-Authenticate", 'Basic realm="Restricted"');
    return res.status(401).send("Auth required");
  }
  try {
    const [user, pass] = Buffer.from(base64, "base64").toString().split(":");
    const U = process.env.BASIC_USER || "fortnite";
    const P = process.env.BASIC_PASS || "Medina";
    if (user === U && pass === P) return next();
  } catch (_) {}
  res.set("WWW-Authenticate", 'Basic realm="Restricted"');
  return res.status(401).send("Auth failed");
};
