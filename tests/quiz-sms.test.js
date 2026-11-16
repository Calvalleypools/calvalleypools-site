const test = require("node:test");
const assert = require("node:assert/strict");
const sms = require("../netlify/functions/submission-created/quiz-sms");
const entry = require("../netlify/functions/submission-created");

const SIGNATURE = sms.SIGNATURE;

function prodEnv(extra) {
  return Object.assign({
    QUO_API_KEY: "test-key",
    QUO_FROM_NUMBER: "+16617480859",
    CONTEXT: "production"
  }, extra || {});
}

function lead(extra) {
  return Object.assign({
    water: "green",
    area: "in",
    zip: "93311",
    name: "Sarah",
    phone: "(661) 555-0100",
    address: "1234 Stockdale Hwy, Bakersfield, CA 93311",
    consent: "yes"
  }, extra || {});
}

function noon() {
  return new Date("2026-11-16T20:00:00Z");
}

test("signature and variants stay under 300 characters", function () {
  var cases = [
    lead(),
    lead({ water: "cloudy" }),
    lead({ water: "clear" }),
    lead({ area: "out", zip: "93301", services: "tile" }),
    lead({ area: "out", zip: "93301", services: ["repairs", "equipment", "tile", "drain"] }),
    lead({ address: "n/a" }),
    lead({ address: "93311" }),
    lead({
      name: "Christopher",
      address: "12345 Very Long Street Name That Goes On, Bakersfield, CA 93314"
    })
  ];
  cases.forEach(function (data) {
    var decision = sms.decideText({ data: data, env: prodEnv(), now: noon() });
    assert.equal(decision.action, "send");
    assert.ok(decision.content.length <= 300, decision.content);
    assert.ok(decision.content.endsWith(SIGNATURE), decision.content);
    assert.equal(decision.content.includes("748"), false);
    assert.equal(decision.content.includes("661-748-0859"), false);
  });
});

test("message variants match the spec", function () {
  var green = sms.decideText({ data: lead(), env: prodEnv(), now: noon() });
  assert.equal(green.variant, "in-green");
  assert.match(green.content, /Got your quiz: green pool/);
  assert.match(green.content, /1234 Stockdale Hwy/);

  var cloudy = sms.decideText({ data: lead({ water: "cloudy" }), env: prodEnv(), now: noon() });
  assert.match(cloudy.content, /Cloudy water is usually a quick fix/);

  var clear = sms.decideText({ data: lead({ water: "clear" }), env: prodEnv(), now: noon() });
  assert.match(clear.content, /Clear water\? Let's keep it that way/);

  var out = sms.decideText({
    data: lead({ area: "out", zip: "93308", services: "tile, drain" }),
    env: prodEnv(),
    now: noon()
  });
  assert.equal(out.variant, "out");
  assert.match(out.content, /don't run weekly routes/);
  assert.match(out.content, /tile cleaning and drain & clean/);

  var missing = sms.decideText({ data: lead({ address: "pool" }), env: prodEnv(), now: noon() });
  assert.equal(missing.variant, "missing-address");
  assert.match(missing.content, /What's the pool address so I can quote it\?/);
});

test("93306 not sure is out of area, yes is in area", function () {
  var unsure = sms.decideText({
    data: lead({ zip: "93306", area: "in", east_of_morning: "not-sure" }),
    env: prodEnv(),
    now: noon()
  });
  assert.equal(unsure.variant, "out");
  var east = sms.decideText({
    data: lead({ zip: "93306", area: "out", east_of_morning: "yes" }),
    env: prodEnv(),
    now: noon()
  });
  assert.equal(east.variant, "in-green");
});

test("does nothing without the key, outside production, without consent, or during quiet hours", function () {
  assert.equal(sms.decideText({ data: lead(), env: prodEnv({ QUO_API_KEY: "" }), now: noon() }).reason, "no-api-key");
  assert.equal(sms.decideText({ data: lead(), env: prodEnv({ CONTEXT: "deploy-preview" }), now: noon() }).reason, "not-production");
  assert.equal(sms.decideText({ data: lead({ consent: "" }), env: prodEnv(), now: noon() }).reason, "no-consent");
  assert.equal(sms.decideText({ data: lead({ bot: "spam" }), env: prodEnv(), now: noon() }).reason, "honeypot");
  var late = sms.decideText({ data: lead(), env: prodEnv(), now: new Date("2026-11-17T04:30:00Z") });
  assert.equal(late.reason, "quiet-hours");
  var early = sms.decideText({ data: lead(), env: prodEnv(), now: new Date("2026-11-16T15:30:00Z") });
  assert.equal(early.reason, "quiet-hours");
});

test("quiet hours follow Pacific time, including daylight saving", function () {
  assert.equal(sms.isWithinTextingHours(new Date("2026-11-16T16:00:00Z")), true);
  assert.equal(sms.isWithinTextingHours(new Date("2026-11-16T15:59:00Z")), false);
  assert.equal(sms.isWithinTextingHours(new Date("2026-11-17T03:59:00Z")), true);
  assert.equal(sms.isWithinTextingHours(new Date("2026-11-17T04:00:00Z")), false);
  assert.equal(sms.isWithinTextingHours(new Date("2026-07-15T15:00:00Z")), true);
  assert.equal(sms.isWithinTextingHours(new Date("2026-07-15T14:59:00Z")), false);
  assert.equal(sms.isWithinTextingHours(new Date("2026-07-16T02:59:00Z")), true);
  assert.equal(sms.isWithinTextingHours(new Date("2026-07-16T03:00:00Z")), false);
});

test("from number accepts E.164, local format, or a Quo phone id", function () {
  assert.equal(sms.normalizeFrom("+16617480859"), "+16617480859");
  assert.equal(sms.normalizeFrom("661-748-0859"), "+16617480859");
  assert.equal(sms.normalizeFrom("PN123abc"), "PN123abc");
  assert.equal(sms.toE164("(661) 555-0100"), "+16615550100");
});

test("handler posts the Quo payload only for a real production lead", async function () {
  var calls = [];
  var logs = [];
  var handler = sms.createHandler({
    env: prodEnv(),
    now: function () { return noon(); },
    log: function (entry) { logs.push(entry); },
    fetch: function (url, init) {
      calls.push({ url: url, init: init });
      return Promise.resolve({ status: 202, text: function () { return Promise.resolve("{\"data\":{\"id\":\"m1\"}}"); } });
    }
  });
  var event = {
    body: JSON.stringify({
      payload: {
        id: "sub-1",
        form_name: "pool-quiz",
        data: lead()
      }
    })
  };
  var result = await handler(event);
  assert.equal(result.statusCode, 200);
  assert.equal(result.body, "sent");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.quo.com/v1/messages");
  assert.equal(calls[0].init.headers.Authorization, "test-key");
  assert.equal(String(calls[0].init.headers.Authorization).startsWith("Bearer "), false);
  var body = JSON.parse(calls[0].init.body);
  assert.equal(body.from, "+16617480859");
  assert.deepEqual(body.to, ["+16615550100"]);
  assert.match(body.content, /Hi Sarah,/);
  assert.equal(logs.some(function (entry) { return entry.action === "sent"; }), true);
});

test("handler ignores other forms and deploy previews", async function () {
  var calls = 0;
  var handler = sms.createHandler({
    env: prodEnv({ CONTEXT: "deploy-preview" }),
    now: function () { return noon(); },
    log: function () {},
    fetch: function () { calls += 1; return Promise.resolve({ status: 202, text: function () { return Promise.resolve(""); } }); }
  });
  var other = await handler({ body: JSON.stringify({ payload: { form_name: "pool-quote", data: lead() } }) });
  assert.equal(other.body, "ignored");
  var preview = await handler({ body: JSON.stringify({ payload: { form_name: "pool-quiz", data: lead() } }) });
  assert.equal(preview.body, "not-production");
  assert.equal(calls, 0);
});

test("entry exports the Netlify handler", function () {
  assert.equal(typeof entry.handler, "function");
  assert.equal(entry.default, entry.handler);
});
