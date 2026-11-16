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
    assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
    assert.match(html, /661-747-9184/);
    assert.equal(/661-748|748-0859|16617480859/.test(html), false, file);
    assert.equal(/licensed/i.test(html), false, file);
    assert.equal(/no contract|no minimum/i.test(html), false, file);
    assert.equal(/\$\d/.test(html), false, file);
    assert.equal(/leave a review/i.test(html), false, file);
    assert.equal(/href="\/quote(\/|")/.test(html), false, file);
    assert.equal(/href="\/thanks-in-|href="\/thanks-out(\/|")|href="\/thanks-services(\/|")/.test(html), false, file);
  });

  htmlFiles.forEach(function (file) {
    var html = fs.readFileSync(file, "utf8");
    assert.equal(/href="\/quote(\/|")/.test(html), false, file);
    assert.equal(/href="\/thanks-in-|href="\/thanks-out(\/|")|href="\/thanks-services(\/|")/.test(html), false, file);
  });

  var sitemap = read("sitemap.xml");
  assert.equal(sitemap.includes("/quote"), false);
  assert.equal(sitemap.includes("/thanks-"), false);
  assert.match(read("robots.txt"), /Disallow: \/quote\//);
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
});

test("existing homepage copy is unchanged aside from files we meant to add", function () {
  var home = read("index.html");
  assert.equal(home.includes("/quote"), false);
  assert.match(home, /Pool Service in Bakersfield/);
  assert.equal(home.includes("google-ads"), false);
});
