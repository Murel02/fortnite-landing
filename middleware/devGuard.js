// middleware/devGuard.js
module.exports = function devGuard(req, res, next) {
  const enabled =
    String(process.env.DEV_MODE_ENABLED || "false").toLowerCase() === "true";
  const secret = process.env.DEV_MODE_SECRET || "";

  const q = String(req.query.dev || "").toLowerCase();

  const qEnable =
    q === "1" ||
    q === "true" ||
    q === "on" ||
    (secret && req.query.dev === secret);
  const qDisable = q === "0" || q === "false" || q === "off";

  const cookieVal = (req.cookies && String(req.cookies.dev || "")) || "";
  const cookieEnable =
    cookieVal === "1" ||
    cookieVal.toLowerCase() === "true" ||
    (secret && cookieVal === secret);

  // compute isDev
  let isDev;
  if (secret) {
    // kræv korrekt secret i query eller cookie, uanset enabled-flag
    isDev = qEnable || cookieEnable;
  } else {
    // uden secret: tillad via global enable, query enable, eller cookie
    isDev = enabled || qEnable || cookieEnable;
  }

  // persistér valg i cookie (12 timer)
  if (qEnable) {
    const val = secret && req.query.dev === secret ? secret : "1";
    res.cookie("dev", val, {
      maxAge: 12 * 60 * 60 * 1000,
      httpOnly: false,
      sameSite: "Lax",
    });
  } else if (qDisable) {
    res.clearCookie("dev");
    isDev = false;
  }

  // GØR DETTE: brug den beregnede værdi
  res.locals.__dev = isDev;
  req.isDev = isDev;

  // beskyt dev-API'er
  if (!isDev && req.path.startsWith("/api/dev/")) {
    return res.status(403).json({ error: "Dev mode required" });
  }

  next();
};
