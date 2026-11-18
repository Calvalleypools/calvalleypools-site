const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    if (entry.name === ".git" || entry.name === "node_modules") return;
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  });
  return out;
}

const files = walk(root, []);
const htmlFiles = files.filter(function (file) { return file.endsWith(".html"); });
const quizPages = [
  "quote/index.html",
  "thanks-in-green/index.html",
  "thanks-in-cloudy/index.html",
  "thanks-in-clear/index.html",
  "thanks-out/index.html",
  "thanks-services/index.html"
].map(function (rel) { return path.join(root, rel); });

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

test("quiz pages are noindex and not linked from the site", function () {
  quizPages.forEach(function (file) {
    var html = fs.readFileSync(file, "utf8");
    var rel = path.relative(root, file);
    if (rel === "quote/index.html") {
      assert.match(html, /<meta name="robots" content="index,follow">/);
      assert.equal(html.includes("noindex"), false);
    } else {
      assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
    }
    assert.match(html, /661-747-9184/);
    assert.equal(/661-748|748-0859|16617480859/.test(html), false, file);
    assert.equal(/licensed/i.test(html), false, file);
    assert.equal(/no contract|no minimum/i.test(html), false, file);
    assert.equal(/\$\d/.test(html), false, file);
    assert.equal(/leave a review/i.test(html), false, file);
    assert.equal(/href="\/thanks-in-|href="\/thanks-out(\/|")|href="\/thanks-services(\/|")/.test(html), false, file);
    assert.equal(/within a minute|right now|Check your phone|on the way/i.test(html), false, file);
  });

  htmlFiles.forEach(function (file) {
    var html = fs.readFileSync(file, "utf8");
    assert.match(html, /<a class="button small" href="\/quote\/">Get a quote<\/a>/);
    assert.match(html, /<a class="button small" href="tel:\+16617479184">661-747-9184<\/a>/);
    assert.equal(/href="\/thanks-in-|href="\/thanks-out(\/|")|href="\/thanks-services(\/|")/.test(html), false, file);
  });

  var sitemap = read("sitemap.xml");
  assert.match(sitemap, /https:\/\/calvalleypools\.com\/quote\//);
  assert.equal(sitemap.includes("/thanks-"), false);
  assert.equal(read("robots.txt").includes("Disallow: /quote/"), false);
  assert.match(read("quote/index.html"), /name="pool-quiz"/);
  assert.match(read("quote/index.html"), /netlify-honeypot="bot"/);
  assert.match(read("quote/index.html"), /Text me about my quote\. Msg &amp; data rates may apply\. Reply STOP to opt out\./);
  assert.match(read("quote/index.html"), /value="weekly" checked/);
  var emailTag = read("quote/index.html").match(/<input id="quiz-email"[^>]*>/);
  assert.ok(emailTag, "email field");
  assert.match(emailTag[0], /name="email"/);
  assert.match(emailTag[0], /type="email"/);
  assert.equal(/required/.test(emailTag[0]), false);
  assert.match(read("quote/index.html"), /Email \(optional\)/);
  ["name", "phone", "address", "consent", "services", "water", "zip", "area", "verify_93306"].forEach(function (field) {
    assert.match(read("quote/index.html"), new RegExp("name=\"" + field + "\""));
  });
  assert.match(read("robots.txt"), /Disallow: \/thanks-services\//);
  ["in-green", "in-cloudy", "in-clear", "out", "services"].forEach(function (kind) {
    var matches = htmlFiles.filter(function (file) {
      return fs.readFileSync(file, "utf8").includes('data-thanks="' + kind + '"');
    });
    assert.equal(matches.length, 1, kind);
  });
  assert.equal(read("quote/index.html").includes("data-quiz-conversion"), false);
  assert.match(read("thanks-in-green/index.html"), /data-quiz-conversion="true"/);
  var conversionPages = {
    "thanks-in-green/index.html": true,
    "thanks-in-cloudy/index.html": true,
    "thanks-in-clear/index.html": true,
    "thanks-services/index.html": true,
    "thanks-out/index.html": true
  };
  htmlFiles.forEach(function (file) {
    var rel = path.relative(root, file);
    var has = fs.readFileSync(file, "utf8").includes('data-quiz-conversion="true"');
    assert.equal(has, !!conversionPages[rel], rel);
  });
});

test("homepage hero has a quiz button and a text button", function () {
  var home = read("index.html");
  assert.match(home, /<div class="actions"><a class="button" href="\/quote\/">Get a quote<\/a><a class="button secondary" href="sms:\+16617479184">Text us<\/a><\/div>/);
  assert.equal(/Get a free quote/.test(home), false);
  assert.equal(/<a class="plain" href="sms:\+16617479184">Text us<\/a>/.test(home), false);
  assert.match(home, /661-747-9184/);
  assert.match(home, /Pool Service in Bakersfield/);
  assert.equal(home.includes("google-ads"), false);
  assert.equal(/661-748|748-0859|16617480859/.test(home), false);
  assert.equal(/licensed/i.test(home), false);
});

test("quote calls to action point at the quiz", function () {
  htmlFiles.forEach(function (file) {
    var html = fs.readFileSync(file, "utf8");
    var rel = path.relative(root, file);
    assert.equal(/Get a free quote/.test(html), false, rel);
    assert.equal(/href="\/contact\/[^"]*"[^>]*>[^<]*quote/i.test(html), false, rel);
    assert.equal(/661-748|748-0859|16617480859/.test(html), false, rel);
    assert.match(html, /<div class="mobile-cta"><a href="tel:\+16617479184">Call now<\/a><a href="\/quote\/">Get a quote (?:↗|&#8599;)<\/a><\/div>/, rel);
    assert.match(html, /<a class="button small" href="\/quote\/">Get a quote<\/a>/);
  });
});
