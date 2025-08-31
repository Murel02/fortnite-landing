// middleware/owner.js
module.exports = function owner(req, res, next) {
  const secret = process.env.DEV_OWNER_SECRET || "";
  const fromQuery = req.query.owner;
  const fromBody = req.body && req.body.owner;
  const incoming = fromQuery || fromBody || "";

  const isHttps =
    req.secure ||
    (req.headers["x-forwarded-proto"] || "").toString().includes("https");

  let isOwner = false;

  // Hvis korrekt secret følger med i denne request → sæt cookie og markér owner STRAKS
  if (secret && incoming === secret) {
    res.cookie("owner", secret, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dage
      httpOnly: false,
      sameSite: "Lax",
      secure: !!isHttps,
      path: "/",
    });
    isOwner = true; // <- vigtigt: gælder også for denne request
  } else {
    // ellers læs fra cookie
    const cookieVal = (req.cookies && String(req.cookies.owner || "")) || "";
    isOwner = !!secret && cookieVal === secret;
  }

  res.locals.__owner = isOwner;
  req.isOwner = isOwner;

  next();
};
