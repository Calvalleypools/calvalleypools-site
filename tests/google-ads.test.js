const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function fakeWindow(conversion) {
  var scripts = [];
  var win = {
    __scripts: scripts,
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

test("placeholders do not load gtag or contact Google", function () {
  var sandbox = loadAds();
  assert.equal(sandbox.GOOGLE_ADS_ID, "AW-XXXXXXXXX");
  assert.equal(sandbox.QUIZ_CONVERSION_LABEL, "PASTE_QUIZ_CONVERSION_LABEL");
  assert.equal(sandbox.isGoogleAdsConfigured(sandbox.GOOGLE_ADS_ID, sandbox.QUIZ_CONVERSION_LABEL), false);
  assert.equal(sandbox.window.__scripts.length, 0);
  assert.equal(sandbox.window.dataLayer, undefined);
});

test("a real id and label load async gtag and fire one conversion on thank-you pages", function () {
  var sandbox = loadAds();
  var plain = fakeWindow(false);
  assert.equal(sandbox.installGoogleAds(plain, "AW-1234567890", "AbCdEf1234"), true);
  assert.equal(plain.__scripts.length, 1);
  assert.equal(plain.__scripts[0].async, true);
  assert.equal(plain.__scripts[0].src, "https://www.googletagmanager.com/gtag/js?id=AW-1234567890");
  var events = [];
  plain.dataLayer.forEach(function (args) { events.push(args[0]); });
  assert.deepEqual(events, ["js", "config"]);
  assert.equal(plain.dataLayer[1][1], "AW-1234567890");

  var thanks = fakeWindow(true);
  sandbox.installGoogleAds(thanks, "AW-1234567890", "AbCdEf1234");
  assert.equal(thanks.dataLayer[2][0], "event");
  assert.equal(thanks.dataLayer[2][1], "conversion");
  assert.equal(thanks.dataLayer[2][2].send_to, "AW-1234567890/AbCdEf1234");
  sandbox.installGoogleAds(thanks, "AW-1234567890", "AbCdEf1234");
  assert.equal(thanks.__scripts.length, 1);
});

test("either placeholder blocks the tag", function () {
  var sandbox = loadAds();
  assert.equal(sandbox.isGoogleAdsConfigured("AW-1234567890", "PASTE_QUIZ_CONVERSION_LABEL"), false);
  assert.equal(sandbox.isGoogleAdsConfigured("AW-XXXXXXXXX", "AbCdEf1234"), false);
  assert.equal(sandbox.installGoogleAds(fakeWindow(true), "AW-1234567890", "PASTE_ME"), false);
});
