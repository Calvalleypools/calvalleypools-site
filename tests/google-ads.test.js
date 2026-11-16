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

test("the live ids load the base tag and do not convert a normal page", function () {
  var sandbox = loadAds();
  assert.equal(sandbox.GOOGLE_ADS_ID, "AW-18485766053");
  assert.equal(sandbox.QUIZ_CONVERSION_LABEL, "ch54CI7HnLkdEKXP2e5E");
  assert.equal(sandbox.window.__scripts.length, 1);
  assert.equal(sandbox.window.__scripts[0].async, true);
  assert.equal(sandbox.window.__scripts[0].src, "https://www.googletagmanager.com/gtag/js?id=AW-18485766053");
  var events = [];
  sandbox.window.dataLayer.forEach(function (args) { events.push(args[0]); });
  assert.deepEqual(events, ["js", "config"]);
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
  sandbox.installGoogleAds(thanks, "AW-18485766053", "ch54CI7HnLkdEKXP2e5E");
  assert.equal(thanks.dataLayer[2][0], "event");
  assert.equal(thanks.dataLayer[2][1], "conversion");
  assert.equal(thanks.dataLayer[2][2].send_to, "AW-18485766053/ch54CI7HnLkdEKXP2e5E");
  assert.equal(thanks.dataLayer.filter(function (args) { return args[0] === "event"; }).length, 1);
  sandbox.installGoogleAds(thanks, "AW-18485766053", "ch54CI7HnLkdEKXP2e5E");
  assert.equal(thanks.__scripts.length, 1);

  var refresh = fakeWindow(true, thanks.sessionStorage);
  sandbox.installGoogleAds(refresh, "AW-18485766053", "ch54CI7HnLkdEKXP2e5E");
  var refreshEvents = [];
  refresh.dataLayer.forEach(function (args) { refreshEvents.push(args[0]); });
  assert.deepEqual(refreshEvents, ["js", "config"]);
});

test("either placeholder blocks the tag", function () {
  var sandbox = loadAds();
  assert.equal(sandbox.isGoogleAdsConfigured("AW-1234567890", "PASTE_QUIZ_CONVERSION_LABEL"), false);
  assert.equal(sandbox.isGoogleAdsConfigured("AW-XXXXXXXXX", "AbCdEf1234"), false);
  assert.equal(sandbox.installGoogleAds(fakeWindow(true), "AW-1234567890", "PASTE_ME"), false);
});
