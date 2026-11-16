document.querySelector('.menu').addEventListener('click',function(){let open=this.getAttribute('aria-expanded')==='true';this.setAttribute('aria-expanded',!open);document.querySelector('nav').classList.toggle('open',!open)});const form=document.querySelector('#quote');if(form){const requested=new URLSearchParams(location.search).get('service');const choices={'regular-pool-maintenance':'Weekly pool service','pool-repair':'Pool equipment repair','pool-tile-cleaning':'Pool tile cleaning','green-pool-cleanup':'Green pool cleanup','filter-cleaning':'Filter cleaning','water-change':'Water change'};if(choices[requested])form.querySelector('select').value=choices[requested];}if(form)form.addEventListener('submit',e=>{if(location.hostname==='127.0.0.1'||location.hostname==='localhost'){e.preventDefault();document.querySelector('#form-status').textContent='This local preview cannot send requests. Use the hosted site to submit, or call 661-747-9184.';}else if(form.checkValidity()){form.querySelector('button[type=submit]').disabled=true;form.querySelector('button[type=submit]').textContent='Sending…';}});
const currentPath=location.pathname;document.querySelectorAll('header nav a').forEach(a=>{const h=a.getAttribute('href');if(h===currentPath||(h.length>1&&h.startsWith('/')&&currentPath.startsWith(h)))a.setAttribute('aria-current','page')});

/* google-ads-start
 * Paste the two Google Ads values below. This is the only place they go.
 * GOOGLE_ADS_ID looks like AW-1234567890 (the AW- account id).
 * QUIZ_CONVERSION_LABEL is the label after the slash in the conversion
 * send_to value. If Google shows AW-1234567890/AbCdEfGhIj, the label is AbCdEfGhIj.
 * Leave both placeholders until you have the real values. While either one
 * is still a placeholder, gtag.js is not loaded and nothing contacts Google.
 */
var GOOGLE_ADS_ID = "AW-XXXXXXXXX";
var QUIZ_CONVERSION_LABEL = "PASTE_QUIZ_CONVERSION_LABEL";

function isGoogleAdsConfigured(id, label) {
  if (typeof id !== "string" || !/^AW-\d{6,15}$/.test(id)) return false;
  if (typeof label !== "string" || !/^[A-Za-z0-9_-]{4,80}$/.test(label)) return false;
  if (/PASTE|PLACEHOLDER|XXXX|TODO/i.test(label)) return false;
  return true;
}

function installGoogleAds(win, id, label) {
  if (!win || !win.document || !win.document.head) return false;
  if (!isGoogleAdsConfigured(id, label)) return false;
  if (win.__cvpsAds) return false;
  win.__cvpsAds = true;
  win.dataLayer = win.dataLayer || [];
  win.gtag = win.gtag || function () { win.dataLayer.push(arguments); };
  win.gtag("js", new Date());
  win.gtag("config", id);
  var body = win.document.body;
  if (body && body.getAttribute("data-quiz-conversion") === "true") {
    win.gtag("event", "conversion", { send_to: id + "/" + label });
  }
  var script = win.document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
  win.document.head.appendChild(script);
  return true;
}

if (typeof window !== "undefined" && window.document) {
  installGoogleAds(window, GOOGLE_ADS_ID, QUIZ_CONVERSION_LABEL);
}
