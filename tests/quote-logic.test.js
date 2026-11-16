const test = require("node:test");
const assert = require("node:assert/strict");
const quote = require("../quote-logic");

test("weekly zips go straight in area", function () {
  ["93311", "93312", "93314"].forEach(function (zip) {
    var result = quote.classifyZip(zip, "");
    assert.equal(result.ok, true);
    assert.equal(result.area, "in");
    assert.equal(result.needsEast, false);
    assert.equal(result.verify93306, false);
  });
});

test("93306 waits for the Morning Dr answer", function () {
  var pending = quote.classifyZip("93306", "");
  assert.equal(pending.needsEast, true);
  assert.equal(pending.area, null);
  assert.equal(quote.classifyZip("93306", "yes").area, "in");
  assert.equal(quote.classifyZip("93306", "yes").verify93306, false);
  var no = quote.classifyZip("93306", "no");
  assert.equal(no.area, "out");
  assert.equal(no.verify93306, false);
  var unsure = quote.classifyZip("93306", "not-sure");
  assert.equal(unsure.area, "out");
  assert.equal(unsure.verify93306, true);
  assert.equal(unsure.east, "not-sure");
});

test("any other zip is out of area", function () {
  ["93301", "93308", "93263", "90210"].forEach(function (zip) {
    var result = quote.classifyZip(zip, "");
    assert.equal(result.area, "out");
    assert.equal(result.verify93306, false);
  });
});

test("zip must be five digits", function () {
  ["", "9331", "933110", "93a11", "93311-1234"].forEach(function (zip) {
    assert.equal(quote.classifyZip(zip, "").ok, false);
  });
});

test("thank-you copy matches the spec, with the first name when we have one", function () {
  assert.deepEqual(quote.thankYou("in-green", "Sarah", ""), {
    title: "Got it, Sarah. Let's kill the green.",
    body: "Check your phone. Brandon is texting you within a minute to confirm your address. Green pools get priority."
  });
  assert.equal(quote.thankYou("in-cloudy", "Sarah Jane", "").title, "Got it, Sarah. Crystal clear is close.");
  assert.equal(quote.thankYou("in-cloudy", "Sarah", "").body, "Brandon is texting you right now to lock in your quote.");
  assert.equal(quote.thankYou("in-clear", "Sarah", "").title, "Nice pool, Sarah. Let's keep it that way.");
  assert.equal(quote.thankYou("in-clear", "", "").body, "Same day every week, a text before, a report after. Your quote text is on the way.");
  assert.equal(quote.thankYou("out", "Sarah", "tile").title, "Thanks, Sarah. We're on it.");
  assert.equal(
    quote.thankYou("out", "Sarah", "tile").body,
    "Brandon is texting you within a minute about your tile cleaning quote."
  );
  assert.equal(
    quote.thankYou("out", "Sarah", "drain,repairs").body,
    "Brandon is texting you within a minute about your repairs and drain & clean quote."
  );
  assert.equal(
    quote.thankYou("out", "", "").body,
    "Brandon is texting you within a minute about your quote."
  );
  assert.equal(quote.thankYou("in-green", "", "").title, "Got it. Let's kill the green.");
});

test("thanks paths", function () {
  assert.equal(quote.thanksPath("in", "green"), "/thanks-in-green/");
  assert.equal(quote.thanksPath("in", "cloudy"), "/thanks-in-cloudy/");
  assert.equal(quote.thanksPath("in", "clear"), "/thanks-in-clear/");
  assert.equal(quote.thanksPath("out", "green"), "/thanks-out/");
});
