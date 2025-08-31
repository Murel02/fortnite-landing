// middleware/basicAuth.js
module.exports = function basicAuth(req, res, next) {
  // Ejer (owner-cookie) må passere uden login
  if (req.isOwner) return next();

  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type?.toLowerCase() !== "basic" || !token) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Restricted"');
    return res.status(401).send("Auth required");
  }

  const decoded = Buffer.from(token, "base64").toString("utf8");
  const [user, pass] = decoded.split(":");

  const EXP_USER = process.env.BASIC_AUTH_USER || "fortnite";
  const EXP_PASS = process.env.BASIC_AUTH_PASS || "Medina";

  if (user === EXP_USER && pass === EXP_PASS) return next();

  res.setHeader("WWW-Authenticate", 'Basic realm="Restricted"');
  return res.status(401).send("Auth required");
};
