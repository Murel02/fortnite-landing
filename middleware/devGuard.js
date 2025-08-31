module.exports = function devGuard(req, res, next) {
  const enabled = String(process.env.DEV_MODE_ENABLED || "false") === "true";
  const secret = process.env.DEV_MODE_SECRET || "";

  const q = req.query.dev;
  const hasQueryTrue = q === "1" || q === "true";
  const hasSecretOK = secret && q === secret;

  // acceptér cookie fra tidligere
  const cookieDev =
    req.cookies &&
    (req.cookies.dev === "1" ||
      req.cookies.dev === "true" ||
      (secret && req.cookies.dev === secret));

  let isDev = false;

  // 1) hvis secret er sat: kræv enten korrekt secret i query ELLER cookie
  if (secret) {
    isDev = !!(hasSecretOK || cookieDev);
  } else {
    // 2) uden secret: tillad dev hvis enabled globalt, query=true, eller cookie
    isDev = !!(enabled || hasQueryTrue || cookieDev);
  }

  // hvis der kom en dev-query, gem den i cookie (12 timer)
  if (q) {
    res.cookie("dev", q, {
      httpOnly: false,
      maxAge: 12 * 60 * 60 * 1000,
      sameSite: "lax",
      path: "/",
    });
  }

  res.locals.__dev = isDev;

  if (!isDev && req.path.startsWith("/api/dev/")) {
    return res.status(403).json({ error: "Dev mode required" });
  }
  next();
};
