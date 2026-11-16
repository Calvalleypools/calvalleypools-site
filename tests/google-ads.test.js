const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function memoryStorage(initial) {
  var data = Object.assign({}, initial || {});
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem: function (key, value) { data[key] = String(value); }
  };
}

function fakeWindow(conversion, storage) {
  var scripts = [];
  var win = {
    __scripts: scripts,
    sessionStorage: storage || memoryStorage(),
    document: {
      head: {
        appendChild: function (node) { scripts.push(node); }
      },
      body: {
        getAttribute: function (name) {
          if (name === "data-quiz-conversion") return conversion ? "true" : null;
          return null;
        }
      },
      createElement: function () { return { async: false, src: "" }; }
    }
  };
  win.document.head.appended = scripts;
  return win;
}

function loadAds() {
  var src = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  var start = src.indexOf("/* google-ads-start");
  assert.ok(start !== -1);
  var sandbox = { window: fakeWindow(false), console: console };
  vm.createContext(sandbox);
  vm.runInContext(src.slice(start), sandbox);
  return sandbox;
}

test("app.js does not load a second gtag.js", function () {
  var src = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  assert.equal(src.includes("googletagmanager.com"), false);
  assert.equal(src.includes("gtag(\"js\""), false);
  assert.equal(src.includes("gtag('js'"), false);
  var sandbox = loadAds();
  assert.equal(sandbox.GOOGLE_ADS_ID, "AW-18485766053");
  assert.equal(sandbox.QUIZ_CONVERSION_LABEL, "ch54CI7HnLkdEKXP2e5E");
  assert.equal(sandbox.window.__scripts.length, 0);
  assert.equal(sandbox.window.dataLayer, undefined);
});

test("the quiz conversion still fires once when the page tag defined gtag", function () {
  var sandbox = loadAds();
  function withGtag(win) {
    var calls = [];
    win.dataLayer = [];
    win.gtag = function () { calls.push(Array.prototype.slice.call(arguments)); win.dataLayer.push(arguments); };
    win.__calls = calls;
    return win;
  }
  var plain = withGtag(fakeWindow(false));
  assert.equal(sandbox.installGoogleAds(plain, "AW-18485766053", "ch54CI7HnLkdEKXP2e5E"), true);
  assert.equal(plain.__calls.length, 0);

  var thanks = withGtag(fakeWindow(true));
  assert.equal(sandbox.installGoogleAds(thanks, "AW-18485766053", "ch54CI7HnLkdEKXP2e5E"), true);
  assert.equal(thanks.__calls.length, 1);
  assert.equal(thanks.__calls[0][0], "event");
  assert.equal(thanks.__calls[0][1], "conversion");
  assert.equal(thanks.__calls[0][2].send_to, "AW-18485766053/ch54CI7HnLkdEKXP2e5E");
  sandbox.installGoogleAds(thanks, "AW-18485766053", "ch54CI7HnLkdEKXP2e5E");
  assert.equal(thanks.__calls.length, 1);

  var refresh = withGtag(fakeWindow(true, thanks.sessionStorage));
  sandbox.installGoogleAds(refresh, "AW-18485766053", "ch54CI7HnLkdEKXP2e5E");
  assert.equal(refresh.__calls.length, 0);

  var missing = fakeWindow(true);
  assert.equal(sandbox.installGoogleAds(missing, "AW-18485766053", "ch54CI7HnLkdEKXP2e5E"), false);
});

test("every html page has one Google tag immediately after head", function () {
  var snippet = "<head><script async src=\"https://www.googletagmanager.com/gtag/js?id=GTM-PVFHC29N\"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','GTM-PVFHC29N');gtag('config','AW-18485766053');</script>";
  var files = [];
  function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
      if (entry.name === ".git" || entry.name === "node_modules") return;
      var full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".html")) files.push(full);
    });
  }
  walk(path.join(__dirname, ".."));
  assert.ok(files.length > 40);
  files.forEach(function (file) {
    var html = fs.readFileSync(file, "utf8");
    assert.equal(html.includes(snippet), true, file);
    assert.equal(html.split("googletagmanager.com/gtag/js").length - 1, 1, file);
    assert.equal(html.split("gtag('js'").length - 1, 1, file);
  });
});

test("either placeholder blocks the tag", function () {
  var sandbox = loadAds();
  assert.equal(sandbox.isGoogleAdsConfigured("AW-1234567890", "PASTE_QUIZ_CONVERSION_LABEL"), false);
  assert.equal(sandbox.isGoogleAdsConfigured("AW-XXXXXXXXX", "AbCdEf1234"), false);
  assert.equal(sandbox.installGoogleAds(fakeWindow(true), "AW-1234567890", "PASTE_ME"), false);
});
