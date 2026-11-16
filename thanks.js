(function () {
  if (!window.CVPSQuote) return;
  var kind = document.body.getAttribute("data-thanks");
  if (!kind) return;
  var params = new URLSearchParams(location.search);
  var saved = {};
  try {
    saved = JSON.parse(sessionStorage.getItem("cvps-quiz") || "{}") || {};
  } catch (err) {
    saved = {};
  }
  var name = params.get("name") || saved.name || "";
  var services = params.get("services") || saved.services || "";
  var copy = CVPSQuote.thankYou(kind, name, services);
  var title = document.getElementById("thanks-title");
  var body = document.getElementById("thanks-body");
  if (title) title.textContent = copy.title;
  if (body) body.textContent = copy.body;
})();
