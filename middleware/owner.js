// middleware/owner.js
module.exports = function owner(req, res, next) {
  // TRIM miljøvariabler (fjerner utilsigtede mellemrum/linjeskift)
  const secret = (process.env.DEV_OWNER_SECRET || "").trim();
  const fromQuery = (req.query.owner || "").toString().trim();
  const fromBody = (req.body && req.body.owner ? req.body.owner : "")
    .toString()
    .trim();
  const incoming = fromQuery || fromBody || "";

  const isHttps =
    req.secure ||
    (req.headers["x-forwarded-proto"] || "").toString().includes("https");

  let isOwner = false;

  // Hvis korrekt secret følger med i denne request → sæt cookie og markér owner STRAKS
  if (secret && incoming && incoming === secret) {
    res.cookie("owner", secret, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: false,
      sameSite: "Lax",
      secure: !!isHttps,
      path: "/",
    });
    isOwner = true;
  } else {
    // ellers læs fra cookie (også trimmet)
    const cookieVal = ((req.cookies && req.cookies.owner) || "")
      .toString()
      .trim();
    isOwner = !!secret && cookieVal === secret;
  }

  res.locals.__owner = isOwner;
  req.isOwner = isOwner;
  console.log(
    "DEV_OWNER_SECRET len:",
    (process.env.DEV_OWNER_SECRET || "").length
  );

  next();
};
