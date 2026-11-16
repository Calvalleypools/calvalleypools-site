/* Shared quiz rules for the /quote page and the text-back function.
   Loaded in the browser as a classic script (window.CVPSQuote) and
   required from the Netlify function. No secrets in this file. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CVPSQuote = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var IN_AREA_ZIPS = ["93311", "93312", "93314"];
  var BORDER_ZIP = "93306";
  var VERIFY_FLAG = "verify 93306";
  var SERVICE_ORDER = [
    ["weekly", "weekly pool service"],
    ["green", "green pool cleanup"],
    ["repairs", "repairs"],
    ["equipment", "equipment"],
    ["tile", "tile cleaning"],
    ["drain", "drain & clean"]
  ];

  function classifyZip(zip, eastAnswer) {
    var z = String(zip || "").trim();
    var base = { ok: false, error: "", area: null, needsEast: false, verify93306: false, east: "" };
    if (!/^\d{5}$/.test(z)) {
      base.error = "Enter a 5-digit ZIP code.";
      return base;
    }
    if (IN_AREA_ZIPS.indexOf(z) !== -1) {
      return { ok: true, error: "", area: "in", needsEast: false, verify93306: false, east: "" };
    }
    if (z === BORDER_ZIP) {
      var east = String(eastAnswer || "").trim().toLowerCase();
      if (!east) {
        return { ok: true, error: "", area: null, needsEast: true, verify93306: false, east: "" };
      }
      if (east === "yes" || east === "y") {
        return { ok: true, error: "", area: "in", needsEast: false, verify93306: false, east: "yes" };
      }
      if (east === "not-sure" || east === "not sure" || east === "unsure") {
        return { ok: true, error: "", area: "out", needsEast: false, verify93306: true, east: "not-sure" };
      }
      if (east === "no" || east === "n") {
        return { ok: true, error: "", area: "out", needsEast: false, verify93306: false, east: "no" };
      }
      return { ok: true, error: "", area: null, needsEast: true, verify93306: false, east: "" };
    }
    return { ok: true, error: "", area: "out", needsEast: false, verify93306: false, east: "" };
  }

  function flattenServices(input, out) {
    if (input == null || input === false) return;
    if (Array.isArray(input)) {
      for (var i = 0; i < input.length; i++) flattenServices(input[i], out);
      return;
    }
    String(input).split(",").forEach(function (part) {
      var trimmed = part.trim();
      if (trimmed) out.push(trimmed);
    });
  }

  function serviceKey(value) {
    var key = String(value || "").trim().toLowerCase();
    if (key === "weekly" || key === "weekly service" || key === "weekly pool service") return "weekly";
    if (key === "green" || key === "green pool cleanup" || key === "green cleanup") return "green";
    if (key === "repair" || key === "repairs") return "repairs";
    if (key === "equipment") return "equipment";
    if (key === "tile" || key === "tile cleaning") return "tile";
    if (key === "drain" || key === "drain & clean" || key === "drain and clean") return "drain";
    return "";
  }

  function joinAnd(labels) {
    if (!labels.length) return "";
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return labels[0] + " and " + labels[1];
    return labels.slice(0, -1).join(", ") + ", and " + labels[labels.length - 1];
  }

  function serviceKeys(input) {
    var raw = [];
    var keys = [];
    var seen = {};
    flattenServices(input, raw);
    raw.forEach(function (item) {
      var key = serviceKey(item);
      if (key && !seen[key]) {
        seen[key] = true;
        keys.push(key);
      }
    });
    return keys;
  }

  function servicePhrase(input, options) {
    var omit = (options && options.omit) || [];
    var have = {};
    serviceKeys(input).forEach(function (key) { have[key] = true; });
    var labels = [];
    SERVICE_ORDER.forEach(function (pair) {
      if (have[pair[0]] && omit.indexOf(pair[0]) === -1) labels.push(pair[1]);
    });
    return joinAnd(labels);
  }

  function hasWeekly(input) {
    var keys = serviceKeys(input);
    if (!keys.length) return true;
    return keys.indexOf("weekly") !== -1;
  }

  function extraSentence(input) {
    var extra = servicePhrase(input, { omit: ["weekly"] });
    if (!extra) return "";
    return " You also asked about " + extra + ".";
  }

  function pageName(raw) {
    var token = String(raw || "").trim().split(/\s+/)[0] || "";
    token = token.replace(/[^\p{L}\p{M}'-]/gu, "");
    return token.slice(0, 24);
  }

  function thanksPath(area, water, services) {
    if (area !== "in") return "/thanks-out/";
    if (!hasWeekly(services)) return "/thanks-services/";
    if (water === "cloudy") return "/thanks-in-cloudy/";
    if (water === "clear") return "/thanks-in-clear/";
    return "/thanks-in-green/";
  }

  function thankYou(kind, name, services) {
    var who = pageName(name);
    var phrase = servicePhrase(services);
    var extra = extraSentence(services);
    var titles = {
      "in-green": who ? "Got it, " + who + ". Let's kill the green." : "Got it. Let's kill the green.",
      "in-cloudy": who ? "Got it, " + who + ". Crystal clear is close." : "Got it. Crystal clear is close.",
      "in-clear": who ? "Nice pool, " + who + ". Let's keep it that way." : "Nice pool. Let's keep it that way.",
      services: who ? "Thanks, " + who + ". We're on it." : "Thanks. We're on it.",
      out: who ? "Thanks, " + who + ". We're on it." : "Thanks. We're on it."
    };
    var listed = phrase
      ? "Brandon is texting you within a minute about your " + phrase + " quote."
      : "Brandon is texting you within a minute about your quote.";
    var bodies = {
      "in-green": "Check your phone. Brandon is texting you within a minute to confirm your address. Green pools get priority." + extra,
      "in-cloudy": "Brandon is texting you right now to lock in your quote." + extra,
      "in-clear": "Same day every week, a text before, a report after. Your quote text is on the way." + extra,
      services: listed,
      out: listed
    };
    return {
      title: titles[kind] || titles.out,
      body: bodies[kind] || bodies.out
    };
  }

  return {
    IN_AREA_ZIPS: IN_AREA_ZIPS,
    BORDER_ZIP: BORDER_ZIP,
    VERIFY_FLAG: VERIFY_FLAG,
    classifyZip: classifyZip,
    serviceKeys: serviceKeys,
    servicePhrase: servicePhrase,
    hasWeekly: hasWeekly,
    extraSentence: extraSentence,
    pageName: pageName,
    thanksPath: thanksPath,
    thankYou: thankYou
  };
});
