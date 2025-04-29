const normalizeUrl = (url) => {
  return url.replace(/\/+$/, "");
};

module.exports = { normalizeUrl };
