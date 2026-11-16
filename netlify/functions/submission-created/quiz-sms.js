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

function buildBody(lead) {
  var who = firstName(lead.name);
  var phrase = quote.servicePhrase(lead.services);
  var body = "Got it, " + who + ". I'll send your quote soon";
  if (phrase) body += " for " + phrase;
  body += ".";
  if (lead.missing) body += " What's the pool address?";
  return body;
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

function postJson(urlString, headers, payload, fetchImpl, timeoutMs) {
  var body = JSON.stringify(payload);
  var limit = timeoutMs || 10000;
  if (fetchImpl) {
    var init = {
      method: "POST",
      headers: headers,
      body: body
    };
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      init.signal = AbortSignal.timeout(limit);
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
    req.setTimeout(limit, function () {
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

var QUOTE_DESK_STATUS = {
  201: "created",
  200: "duplicate-or-skipped",
  401: "bad-secret",
  422: "missing-name-or-phone"
};

function quoteDeskConfigured(env) {
  return Boolean(
    String(env.QUOTE_DESK_INTAKE_URL || "").trim() &&
    String(env.QUOTE_DESK_APIKEY || "").trim() &&
    String(env.QUOTE_DESK_INTAKE_SECRET || "").trim()
  );
}

/* Forwards a pool-quiz submission to the internal quote desk. Runs in every
   Netlify context. Creates a draft only; it does not text or email the customer.
   Missing env vars are logged and skipped. Errors never escape. */
async function forwardQuoteDesk(payload, env, fetchImpl, log) {
  var url = String(env.QUOTE_DESK_INTAKE_URL || "").trim();
  var apiKey = String(env.QUOTE_DESK_APIKEY || "").trim();
  var secret = String(env.QUOTE_DESK_INTAKE_SECRET || "").trim();
  if (!url || !apiKey || !secret) {
    log({ source: "quote-desk", action: "skip", reason: "missing-env", submissionId: payload.id || null });
    return;
  }
  try {
    var body = JSON.stringify({
      id: payload.id,
      form_name: payload.form_name || (payload.data && payload.data["form-name"]) || "",
      data: payload.data || {}
    });
    var headers = {
      "content-type": "application/json",
      apikey: apiKey,
      "x-quiz-secret": secret
    };
    var doFetch = fetchImpl || (typeof fetch === "function" ? fetch : null);
    var status;
    if (doFetch) {
      var init = { method: "POST", headers: headers, body: body };
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        init.signal = AbortSignal.timeout(5000);
      }
      var res = await doFetch(url, init);
      status = res.status;
    } else {
      var fallback = await postJson(url, headers, JSON.parse(body), null, 5000);
      status = fallback.status;
    }
    log({
      source: "quote-desk",
      action: "forwarded",
      status: status,
      result: QUOTE_DESK_STATUS[status] || "unexpected",
      submissionId: payload.id || null
    });
  } catch (err) {
    var reason = "network";
    if (err && (err.name === "TimeoutError" || err.name === "AbortError")) reason = "timeout";
    log({
      source: "quote-desk",
      action: "error",
      reason: reason,
      submissionId: payload.id || null
    });
  }
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
    try {
      await forwardQuoteDesk(payload, env, fetchImpl, log);
    } catch (err) {
      log({ source: "quote-desk", action: "error", reason: "unexpected", submissionId: payload.id || null });
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
  extractPayload: extractPayload,
  forwardQuoteDesk: forwardQuoteDesk,
  quoteDeskConfigured: quoteDeskConfigured
};
