/* Instant text-back for the pool-quiz form.
   Sends nothing unless QUO_API_KEY is set and Netlify CONTEXT is production.
   Day-1 and day-3 follow-ups are intentionally not built. See the TODO below. */

const https = require("https");
const quote = require("../../../quote-logic");

const SIGNATURE = "\u2013 Brandon, Cal Valley Pool & Spa, 661-747-9184. Reply STOP to opt out.";
const QUO_URL = "https://api.quo.com/v1/messages";
const MAX_CHARS = 300;

/* TODO: Day-1 and day-3 follow-ups are not sent.
   If there is no reply, the spec's later texts are:
   Day 1, green or cloudy: "{Name}, the longer a pool sits green, the longer it takes to clear. Want me to come take a look? Just reply with your address or YES."
   Day 1, clear: "{Name}, still want that free quote for weekly service? Reply YES and I'll send it today."
   Day 1, out of area: "{Name}, still need help with the {service}? Reply with a pic and I'll get you a quote."
   Day 3, all: "Last check-in, {Name}. If the pool's handled, no worries. If not, reply QUOTE and I'll take care of you."
   Each one still ends with the same signature. A reply, a call, or STOP cancels whatever is left.
   Quiet hours still apply. Do not add that scheduler in this change. */

function pacificHour(date) {
  var parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  var raw = null;
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].type === "hour") raw = parts[i].value;
  }
  var hour = Number(raw);
  if (hour === 24) hour = 0;
  return hour;
}

function isWithinTextingHours(date) {
  var hour = pacificHour(date);
  return hour >= 8 && hour < 20;
}

function toE164(value) {
  var digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.charAt(0) === "1") return "+" + digits;
  return "";
}

function normalizeFrom(value) {
  var v = String(value || "").trim();
  if (/^PN.+$/.test(v)) return v;
  return toE164(v);
}

function consentGranted(value) {
  if (value === true) return true;
  if (value === false || value == null) return false;
  if (Array.isArray(value)) {
    for (var i = 0; i < value.length; i++) {
      if (consentGranted(value[i])) return true;
    }
    return false;
  }
  var v = String(value).trim().toLowerCase();
  if (!v || v === "no" || v === "false" || v === "off" || v === "0") return false;
  return true;
}

function oneLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function firstName(raw) {
  var token = oneLine(raw).split(" ")[0] || "";
  token = token.replace(/[^\p{L}\p{M}'-]/gu, "");
  if (!token) return "there";
  return token.slice(0, 24);
}

function addressLooksMissing(address) {
  var a = oneLine(address);
  if (a.length < 8) return true;
  if (!/\d/.test(a)) return true;
  if (/^\d{5}(-\d{4})?$/.test(a)) return true;
  return false;
}

function servicesFrom(data) {
  if (!data) return "";
  if (data.services != null && String(data.services).trim() !== "") return data.services;
  if (data.service_list != null && String(data.service_list).trim() !== "") return data.service_list;
  return "";
}

function alsoAsked(services) {
  return quote.extraSentence(services);
}

function buildBody(lead) {
  var who = firstName(lead.name);
  if (lead.missing) {
    return "Hi " + who + ", it's Brandon with Cal Valley Pool & Spa. Got your quiz. What's the pool address so I can quote it?";
  }
  var addr = oneLine(lead.address);
  if (lead.area === "out") {
    var what = quote.servicePhrase(lead.services, { omit: ["weekly"] }) || quote.servicePhrase("repairs, equipment, tile, drain");
    return "Hi " + who + ", Brandon with Cal Valley Pool & Spa. We don't run weekly routes in your zip, but we do " + what + " anywhere in Kern County. Is " + addr + " the pool address? Send a photo or two and I'll quote it.";
  }
  if (!quote.hasWeekly(lead.services)) {
    var requested = quote.servicePhrase(lead.services) || "pool service";
    return "Hi " + who + ", Brandon with Cal Valley Pool & Spa. Got your request for " + requested + ". Is " + addr + " the pool address? I'll quote it.";
  }
  var extra = alsoAsked(lead.services);
  if (lead.water === "green") {
    return "Hi " + who + ", it's Brandon with Cal Valley Pool & Spa. Got your quiz: green pool, we're on it." + extra + " Is " + addr + " the right pool address for your free quote? Reply YES or send the correct one.";
  }
  if (lead.water === "cloudy") {
    return "Hi " + who + ", Brandon here, Cal Valley Pool & Spa. Cloudy water is usually a quick fix." + extra + " Confirm " + addr + " is the pool and I'll put your free quote together today.";
  }
  if (lead.water === "clear") {
    return "Hi " + who + ", Brandon with Cal Valley Pool & Spa. Clear water? Let's keep it that way: same day every week, a text before, a report after, chemicals included." + extra + " Is " + addr + " right for your free quote?";
  }
  return "Hi " + who + ", it's Brandon with Cal Valley Pool & Spa. Got your quiz." + extra + " Is " + addr + " the right pool address for your free quote?";
}

function fitMessage(body, address) {
  var sig = " " + SIGNATURE;
  var text = body + sig;
  if (text.length <= MAX_CHARS) return text;
  var addr = oneLine(address);
  if (addr && body.indexOf(addr) !== -1) {
    var over = text.length - MAX_CHARS;
    var keep = Math.max(12, addr.length - over - 1);
    var shortened = addr.slice(0, keep).trim() + "\u2026";
    text = body.replace(addr, shortened) + sig;
    if (text.length <= MAX_CHARS) return text;
  }
  var room = MAX_CHARS - sig.length;
  if (room < 1) return sig.trim();
  return body.slice(0, room).trim() + sig;
}

function buildMessage(lead) {
  var missing = lead.missing != null ? lead.missing : addressLooksMissing(lead.address);
  var body = buildBody({
    name: lead.name,
    address: lead.address,
    area: lead.area,
    water: lead.water,
    services: lead.services,
    missing: missing
  });
  return fitMessage(body, missing ? "" : lead.address);
}

function messageVariant(area, water, missing, services) {
  if (missing) return "missing-address";
  if (area === "out") return "out";
  if (!quote.hasWeekly(services)) return "in-services";
  if (water === "green" || water === "cloudy" || water === "clear") return "in-" + water;
  return "in-unknown";
}

function decideText(input) {
  var data = (input && input.data) || {};
  var env = (input && input.env) || {};
  var now = (input && input.now) || new Date();
  var key = String(env.QUO_API_KEY || "").trim();
  if (!key) return { action: "skip", reason: "no-api-key" };
  if (env.CONTEXT !== "production") return { action: "skip", reason: "not-production" };
  if (oneLine(data.bot)) return { action: "skip", reason: "honeypot" };
  if (!consentGranted(data.consent)) return { action: "skip", reason: "no-consent" };
  if (!isWithinTextingHours(now)) return { action: "skip", reason: "quiet-hours" };

  var from = normalizeFrom(env.QUO_FROM_NUMBER);
  if (!from) return { action: "skip", reason: "no-from-number" };
  var to = toE164(data.phone);
  if (!to) return { action: "skip", reason: "bad-phone" };
  if (to === from) return { action: "skip", reason: "to-is-from" };

  var east = data.east_of_morning || data.east || "";
  var classified = quote.classifyZip(data.zip, east);
  var area = data.area === "in" || data.area === "out" ? data.area : "out";
  if (classified.ok && classified.area) area = classified.area;
  var water = String(data.water || "").trim().toLowerCase();
  var address = oneLine(data.address);
  var missing = addressLooksMissing(address);
  var services = servicesFrom(data);
  var content = buildMessage({
    name: data.name,
    address: address,
    area: area,
    water: water,
    services: services,
    missing: missing
  });
  return {
    action: "send",
    reason: "ok",
    variant: messageVariant(area, water, missing, services),
    from: from,
    to: to,
    content: content
  };
}

function redact(text, secret) {
  var out = String(text || "");
  if (secret) out = out.split(secret).join("[key]");
  out = out.replace(/\+\d{10,15}/g, "[phone]");
  return out;
}

function postJson(urlString, headers, payload, fetchImpl) {
  var body = JSON.stringify(payload);
  if (fetchImpl) {
    var init = {
      method: "POST",
      headers: headers,
      body: body
    };
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      init.signal = AbortSignal.timeout(10000);
    }
    return fetchImpl(urlString, init).then(function (res) {
      return res.text().then(function (text) {
        return { status: res.status, body: text };
      });
    });
  }
  return new Promise(function (resolve, reject) {
    var req = https.request(urlString, {
      method: "POST",
      headers: Object.assign({
        "Content-Length": Buffer.byteLength(body)
      }, headers)
    }, function (res) {
      var chunks = [];
      res.on("data", function (chunk) { chunks.push(chunk); });
      res.on("end", function () {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") });
      });
    });
    req.setTimeout(10000, function () {
      req.destroy(new Error("timeout"));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function readBody(event) {
  if (!event) return {};
  if (typeof event.json === "function") return event.json();
  if (event.body == null || event.body === "") return {};
  if (typeof event.body === "string") return JSON.parse(event.body);
  if (typeof event.body === "object") return event.body;
  return {};
}

function extractPayload(body) {
  if (!body || typeof body !== "object") return null;
  if (body.payload && typeof body.payload === "object") return body.payload;
  if (body.form_name || body.data) return body;
  return null;
}

function formNameOf(payload) {
  if (!payload) return "";
  if (payload.form_name) return payload.form_name;
  if (payload.data && payload.data["form-name"]) return payload.data["form-name"];
  return "";
}

function createHandler(options) {
  var opts = options || {};
  var fetchImpl = opts.fetch || null;
  var env = opts.env || process.env;
  var now = opts.now || function () { return new Date(); };
  var log = opts.log || function (entry) { console.log(JSON.stringify(entry)); };
  var send = opts.postJson || function (url, headers, payload) {
    return postJson(url, headers, payload, fetchImpl || (typeof fetch === "function" ? fetch : null));
  };

  return async function handler(event) {
    var body;
    try {
      body = await readBody(event);
    } catch (err) {
      log({ source: "pool-quiz-sms", action: "skip", reason: "bad-json" });
      return { statusCode: 200, body: "bad-json" };
    }
    var payload = extractPayload(body);
    if (formNameOf(payload) !== "pool-quiz") {
      return { statusCode: 200, body: "ignored" };
    }
    var decision = decideText({
      data: payload.data || {},
      env: env,
      now: now()
    });
    log({
      source: "pool-quiz-sms",
      action: decision.action,
      reason: decision.reason,
      variant: decision.variant || null,
      submissionId: payload.id || null
    });
    if (decision.action !== "send") {
      return { statusCode: 200, body: decision.reason };
    }
    var apiKey = String(env.QUO_API_KEY || "").trim();
    try {
      var res = await send(QUO_URL, {
        Authorization: apiKey,
        "Content-Type": "application/json",
        Accept: "application/json"
      }, {
        content: decision.content,
        from: decision.from,
        to: [decision.to]
      });
      if (res.status >= 200 && res.status < 300) {
        log({ source: "pool-quiz-sms", action: "sent", status: res.status, submissionId: payload.id || null });
        return { statusCode: 200, body: "sent" };
      }
      log({
        source: "pool-quiz-sms",
        action: "error",
        status: res.status,
        detail: redact(res.body, apiKey).slice(0, 300),
        submissionId: payload.id || null
      });
      if (res.status >= 500) return { statusCode: 500, body: "quo-error" };
      return { statusCode: 200, body: "quo-rejected" };
    } catch (err) {
      log({
        source: "pool-quiz-sms",
        action: "error",
        reason: "network",
        detail: redact(err && err.name, apiKey),
        submissionId: payload.id || null
      });
      return { statusCode: 500, body: "network" };
    }
  };
}

module.exports = {
  SIGNATURE: SIGNATURE,
  QUO_URL: QUO_URL,
  pacificHour: pacificHour,
  isWithinTextingHours: isWithinTextingHours,
  toE164: toE164,
  normalizeFrom: normalizeFrom,
  consentGranted: consentGranted,
  addressLooksMissing: addressLooksMissing,
  buildMessage: buildMessage,
  decideText: decideText,
  createHandler: createHandler,
  readBody: readBody,
  extractPayload: extractPayload
};
