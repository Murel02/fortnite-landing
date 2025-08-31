// middleware/owner.js
module.exports = function owner(req, res, next) {
  const secret = process.env.DEV_OWNER_SECRET || ""; // vælg dit eget i .env
  const key = req.query.owner;
  // Sæt owner-cookie ved korrekt nøgle i query
  if (secret && key === secret) {
    res.cookie("owner", secret, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dage
      httpOnly: false,
      sameSite: "Lax",
    });
  }
  const isOwner =
    !!secret && !!req.cookies && String(req.cookies.owner || "") === secret;

  res.locals.__owner = isOwner;
  req.isOwner = isOwner;
  next();
};
