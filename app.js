document.querySelector('.menu').addEventListener('click',function(){let open=this.getAttribute('aria-expanded')==='true';this.setAttribute('aria-expanded',!open);document.querySelector('nav').classList.toggle('open',!open)});const form=document.querySelector('#quote');if(form){const requested=new URLSearchParams(location.search).get('service');const choices={'regular-pool-maintenance':'Weekly pool service','pool-repair':'Pool equipment repair','pool-tile-cleaning':'Pool tile cleaning','green-pool-cleanup':'Green pool cleanup','filter-cleaning':'Filter cleaning','water-change':'Water change'};if(choices[requested])form.querySelector('select').value=choices[requested];}if(form)form.addEventListener('submit',e=>{if(location.hostname==='127.0.0.1'||location.hostname==='localhost'){e.preventDefault();document.querySelector('#form-status').textContent='This local preview cannot send requests. Use the hosted site to submit, or call 661-747-9184.';}else if(form.checkValidity()){form.querySelector('button[type=submit]').disabled=true;form.querySelector('button[type=submit]').textContent='Sending…';}});
const currentPath=location.pathname;document.querySelectorAll('header nav a').forEach(a=>{const h=a.getAttribute('href');if(h===currentPath||(h.length>1&&h.startsWith('/')&&currentPath.startsWith(h)))a.setAttribute('aria-current','page')});

/* google-ads-start
 * The Google tag (GTM-PVFHC29N plus AW-18485766053) is in each page head.
 * This only records the quiz conversion. The page head loads the Google tag once.
 * send_to is GOOGLE_ADS_ID + "/" + QUIZ_CONVERSION_LABEL.
 * The conversion fires only on quiz thank-you pages, once per browser session.
 */
var GOOGLE_ADS_ID = "AW-18485766053";
var QUIZ_CONVERSION_LABEL = "ch54CI7HnLkdEKXP2e5E";

function isGoogleAdsConfigured(id, label) {
  if (typeof id !== "string" || !/^AW-\d{6,15}$/.test(id)) return false;
  if (typeof label !== "string" || !/^[A-Za-z0-9_-]{4,80}$/.test(label)) return false;
  if (/PASTE|PLACEHOLDER|XXXX|TODO/i.test(label)) return false;
  return true;
}

function quizConversionSeen(win) {
  try {
    return !!(win.sessionStorage && win.sessionStorage.getItem("cvps-quiz-conversion") === "1");
  } catch (err) {
    return false;
  }
}

function markQuizConversion(win) {
  try {
    if (win.sessionStorage) win.sessionStorage.setItem("cvps-quiz-conversion", "1");
  } catch (err) {}
}

function installGoogleAds(win, id, label) {
  if (!win || !win.document || !win.document.body) return false;
  if (!isGoogleAdsConfigured(id, label)) return false;
  if (win.__cvpsAds) return false;
  win.__cvpsAds = true;
  if (win.document.body.getAttribute("data-quiz-conversion") !== "true") return true;
  if (quizConversionSeen(win)) return true;
  if (typeof win.gtag !== "function") return false;
  win.gtag("event", "conversion", { send_to: id + "/" + label });
  markQuizConversion(win);
  return true;
}

if (typeof window !== "undefined" && window.document) {
  installGoogleAds(window, GOOGLE_ADS_ID, QUIZ_CONVERSION_LABEL);
}
