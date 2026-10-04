/* ELAK exercise plugin: load skill points earned from finished home exercises. */
(function () {
  var user = "guest";
  try {
    user = new URLSearchParams(location.search).get("user") || "guest";
  } catch (err) {
    user = "guest";
  }
  user = String(user).replace(/[^a-zA-Z0-9._-]+/g, "").slice(0, 40) || "guest";
  var box = { total: 0, log: [] };
  try {
    var raw = localStorage.getItem("elak-neon-drift-v1:" + user);
    if (raw) box = JSON.parse(raw) || box;
  } catch (err) {
    box = { total: 0, log: [] };
  }
  window.EXTERNAL_POINTS = {
    total: Math.max(0, Math.floor(Number(box.total) || 0)),
    log: Array.isArray(box.log) ? box.log : []
  };
})();
