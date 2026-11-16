(function () {
  var form = document.getElementById("pool-quiz");
  var fallback = document.getElementById("quiz-fallback");
  if (!form || !window.CVPSQuote) {
    if (fallback) fallback.hidden = false;
    return;
  }

  var steps = {
    water: document.getElementById("step-water"),
    zip: document.getElementById("step-zip"),
    services: document.getElementById("step-services"),
    out: document.getElementById("step-out"),
    contact: document.getElementById("step-contact")
  };
  var current = "water";
  var advanceTimer = null;
  var submitting = false;

  function field(name) {
    return form.elements.namedItem(name);
  }

  function show(name) {
    current = name;
    Object.keys(steps).forEach(function (key) {
      var el = steps[key];
      if (!el) return;
      var on = key === name;
      el.hidden = !on;
    });
    var main = document.getElementById("main");
    if (main) main.classList.toggle("is-started", name !== "water");
    var kicker = document.getElementById("quiz-kicker");
    var labels = {
      water: "Step 1 of 4",
      zip: "Step 2 of 4",
      services: "Step 3 of 4",
      out: "Step 3 of 4",
      contact: "Step 4 of 4"
    };
    if (kicker) kicker.textContent = labels[name] || "";
    if (name === "zip") {
      var east = document.getElementById("east");
      if (east) east.hidden = field("zip").value.trim() !== CVPSQuote.BORDER_ZIP;
    }
    var heading = steps[name] && steps[name].querySelector("h2, h3");
    if (heading) {
      if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
      heading.focus();
    }
  }

  function setReply(water) {
    var replies = {
      green: "We've seen worse. We'll turn it around.",
      cloudy: "Usually a chemistry or filter problem. Easy fix.",
      clear: "Let's keep it that way, every single week."
    };
    var reply = document.getElementById("water-reply");
    if (reply) reply.textContent = replies[water] || "";
  }

  function clearZipError() {
    var err = document.getElementById("zip-error");
    if (err) err.textContent = "";
    field("zip").removeAttribute("aria-invalid");
  }

  function setServiceGroup(area) {
    var inBoxes = document.querySelectorAll("#step-services input[type=checkbox]");
    var outBoxes = document.querySelectorAll("#step-out input[type=checkbox]");
    for (var i = 0; i < inBoxes.length; i++) inBoxes[i].disabled = area !== "in";
    for (var i = 0; i < outBoxes.length; i++) outBoxes[i].disabled = area === "in";
  }

  function applyArea(result) {
    field("area").value = result.area || "";
    field("east_of_morning").value = result.east || "";
    field("verify_93306").value = result.verify93306 ? CVPSQuote.VERIFY_FLAG : "";
    setServiceGroup(result.area);
    if (result.area === "in") show("services");
    else if (result.area === "out") show("out");
  }

  function onZipNext() {
    clearZipError();
    var zip = field("zip").value.replace(/\D/g, "").slice(0, 5);
    field("zip").value = zip;
    var result = CVPSQuote.classifyZip(zip, field("east_of_morning").value);
    if (!result.ok) {
      var err = document.getElementById("zip-error");
      if (err) err.textContent = result.error;
      field("zip").setAttribute("aria-invalid", "true");
      field("zip").focus();
      return;
    }
    if (result.needsEast) {
      var east = document.getElementById("east");
      if (east) east.hidden = false;
      var title = document.getElementById("east-title");
      if (title) {
        title.setAttribute("tabindex", "-1");
        title.focus();
      }
      return;
    }
    applyArea(result);
  }

  document.querySelectorAll("[data-water]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var water = btn.getAttribute("data-water");
      field("water").value = water;
      document.querySelectorAll("[data-water]").forEach(function (other) {
        other.setAttribute("aria-pressed", other === btn ? "true" : "false");
      });
      setReply(water);
      window.clearTimeout(advanceTimer);
      advanceTimer = window.setTimeout(function () {
        show("zip");
        field("zip").focus();
      }, 900);
    });
  });

  document.getElementById("zip-next").addEventListener("click", onZipNext);

  field("zip").addEventListener("input", function () {
    var digits = field("zip").value.replace(/\D/g, "").slice(0, 5);
    if (field("zip").value !== digits) field("zip").value = digits;
    clearZipError();
    if (digits !== CVPSQuote.BORDER_ZIP) {
      field("east_of_morning").value = "";
      field("verify_93306").value = "";
      var east = document.getElementById("east");
      if (east) east.hidden = true;
    }
  });

  document.querySelectorAll("[data-east]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      field("east_of_morning").value = btn.getAttribute("data-east");
      var result = CVPSQuote.classifyZip(field("zip").value.trim(), field("east_of_morning").value);
      if (result.needsEast || !result.area) return;
      applyArea(result);
    });
  });

  document.querySelectorAll("[data-back]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      show(btn.getAttribute("data-back"));
    });
  });

  document.getElementById("contact-back").addEventListener("click", function () {
    show(field("area").value === "out" ? "out" : "services");
  });

  document.getElementById("out-next").addEventListener("click", function () {
    show("contact");
  });

  document.getElementById("services-next").addEventListener("click", function () {
    var codes = checkedServices();
    var err = document.getElementById("services-error");
    if (!codes.length) {
      if (err) err.textContent = "Choose at least one.";
      var first = document.querySelector("#step-services input[type=checkbox]");
      if (first) first.focus();
      return;
    }
    if (err) err.textContent = "";
    show("contact");
  });

  function checkedServices() {
    var selector = field("area").value === "out"
      ? '#step-out input[name="services"]'
      : '#step-services input[name="services"]';
    var codes = [];
    var boxes = form.querySelectorAll(selector);
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i].checked && !boxes[i].disabled) codes.push(boxes[i].value);
    }
    field("service_list").value = codes.join(", ");
    return codes;
  }

  function setError(id, input, message) {
    var el = document.getElementById(id);
    if (el) el.textContent = message || "";
    if (input) {
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }

  function phoneOk(value) {
    var digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 10) return true;
    if (digits.length === 11 && digits.charAt(0) === "1") return true;
    return false;
  }

  function validateContact() {
    var name = field("name");
    var phone = field("phone");
    var address = field("address");
    var consent = field("consent");
    name.value = name.value.trim();
    phone.value = phone.value.trim();
    address.value = address.value.trim();
    setError("name-error", name, "");
    setError("phone-error", phone, "");
    setError("address-error", address, "");
    setError("consent-error", consent, "");

    if (!field("water").value) {
      show("water");
      return false;
    }
    if (!field("area").value) {
      show("zip");
      return false;
    }
    if (!name.value) {
      setError("name-error", name, "Enter your first name.");
      name.focus();
      return false;
    }
    if (!phoneOk(phone.value)) {
      setError("phone-error", phone, "Enter a mobile number with an area code.");
      phone.focus();
      return false;
    }
    if (address.value.length < 5) {
      setError("address-error", address, "Enter the pool address, city, and ZIP.");
      address.focus();
      return false;
    }
    if (!consent.checked) {
      setError("consent-error", consent, "Check the box to get a text about your quote.");
      consent.focus();
      return false;
    }
    return true;
  }

  function thanksUrl(codes) {
    var clean = CVPSQuote.pageName(field("name").value);
    var params = new URLSearchParams();
    if (clean) params.set("name", clean);
    if (codes.length) params.set("services", codes.join(","));
    var path = CVPSQuote.thanksPath(field("area").value, field("water").value, codes.join(","));
    var qs = params.toString();
    return path + (qs ? "?" + qs : "");
  }

  function remember(codes) {
    try {
      sessionStorage.setItem("cvps-quiz", JSON.stringify({
        name: field("name").value.trim(),
        services: codes.join(","),
        water: field("water").value,
        area: field("area").value
      }));
    } catch (err) {}
  }

  function failSubmit(message) {
    submitting = false;
    var button = document.getElementById("quiz-submit");
    button.disabled = false;
    button.textContent = "GET MY FREE QUOTE \u2192";
    var status = document.getElementById("form-status");
    status.textContent = message;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (current === "zip") {
      onZipNext();
      return;
    }
    if (current === "out") {
      show("contact");
      return;
    }
    if (current === "services") {
      document.getElementById("services-next").click();
      return;
    }
    if (current !== "contact" || submitting) return;
    if (field("bot") && field("bot").value) return;
    if (!validateContact()) return;

    var codes = checkedServices();
    var url = thanksUrl(codes);
    form.setAttribute("action", url.split("?")[0]);
    remember(codes);

    var host = location.hostname;
    var local = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "";
    if (local) {
      location.assign(url);
      return;
    }

    submitting = true;
    var button = document.getElementById("quiz-submit");
    button.disabled = true;
    button.textContent = "Sending\u2026";
    var body = new URLSearchParams(new FormData(form)).toString();
    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body
    }).then(function (res) {
      if (!res.ok) throw new Error("status " + res.status);
      location.assign(url);
    }).catch(function () {
      failSubmit("We couldn't send that. Call or text Brandon at 661-747-9184.");
    });
  });
})();
