const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const facebook = JSON.parse(fs.readFileSync(path.join(root, "site.json"), "utf8")).facebook;
const link = '<a href="' + facebook + '" target="_blank" rel="noopener">Facebook</a>';
const sameAs = '"sameAs": ["' + facebook + '"]';

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    if (entry.name === ".git" || entry.name === "node_modules") return;
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  });
  return out;
}

const files = walk(root, []).filter(function (file) {
  return !file.split(path.sep).includes(".git");
});
const htmlFiles = files.filter(function (file) { return file.endsWith(".html"); });

test("facebook url is the username page, not a numeric profile or None placeholder", function () {
  var noneUrl = "facebook.com" + "/None";
  var numericProfile = "profile" + ".php?id=" + "6159480448" + "4592";
  var numericId = "6159480448" + "4592";
  assert.equal(facebook, "https://www.facebook.com/calvalleypools");
  assert.equal(facebook.toLowerCase().includes(noneUrl.toLowerCase()), false);
  assert.equal(facebook.includes(numericProfile), false);
  assert.equal(facebook.includes(numericId), false);
  files.forEach(function (file) {
    if (!file.endsWith(".html") && !file.endsWith(".js") && !file.endsWith(".json") && !file.endsWith(".css") && !file.endsWith(".xml") && !file.endsWith(".txt") && !file.endsWith(".md")) return;
    var text = fs.readFileSync(file, "utf8");
    var rel = path.relative(root, file);
    assert.equal(text.toLowerCase().includes(noneUrl.toLowerCase()), false, rel);
    assert.equal(text.includes(numericProfile), false, rel);
    assert.equal(text.includes(numericId), false, rel);
  });
});

test("every page footer links to the configured facebook page", function () {
  htmlFiles.forEach(function (file) {
    var html = fs.readFileSync(file, "utf8");
    var rel = path.relative(root, file);
    assert.equal(html.split(link).length - 1, 1, rel);
    assert.equal(/facebook\.com\/None/i.test(html), false, rel);
    assert.equal(/https?:\/\/[^"'\s]*\/None\b/i.test(html), false, rel);
  });
});

test("local business schema sameAs uses the configured facebook page", function () {
  htmlFiles.forEach(function (file) {
    var html = fs.readFileSync(file, "utf8");
    var rel = path.relative(root, file);
    var hasBusiness = html.includes('"@type": ["LocalBusiness", "HomeAndConstructionBusiness"]');
    var count = html.split(sameAs).length - 1;
    assert.equal(count, hasBusiness ? 1 : 0, rel);
    if (hasBusiness) {
      var match = html.match(/<script type="application\/ld\+json">(\{"@context": "https:\/\/schema\.org", "@type": \["LocalBusiness", "HomeAndConstructionBusiness"\].*?)<\/script>/);
      assert.ok(match, rel);
      var data = JSON.parse(match[1]);
      assert.deepEqual(data.sameAs, [facebook]);
    }
  });
});
