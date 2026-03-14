  const GA_MEASUREMENT_ID = "G-QVZM8C85VW";
  const COOKIE_CONSENT_KEY = "zl_cookie_consent_v1";
  const RATING_FORM_URL = "";
  const HEALTH_CHAT_ENDPOINT = "";

  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}

  function loadGoogleAnalytics(){
    if(window.__gaLoaded) return;
    window.__gaLoaded = true;
    window[`ga-disable-${GA_MEASUREMENT_ID}`] = false;

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    gtag("js", new Date());
    gtag("config", GA_MEASUREMENT_ID);
  }

  function hideCookieBanner(){
    const banner = document.getElementById("cookieBanner");
    if(!banner) return;
    banner.classList.add("hidden");
  }

  function showCookieBanner(){
    const banner = document.getElementById("cookieBanner");
    if(!banner) return;
    banner.classList.remove("hidden");
  }

  function setCookieConsent(state){
    localStorage.setItem(COOKIE_CONSENT_KEY, state);
    if(state === "accepted"){
      loadGoogleAnalytics();
    } else {
      window[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
    }
    hideCookieBanner();
  }

  function initCookieConsent(){
    const saved = localStorage.getItem(COOKIE_CONSENT_KEY);
    if(saved === "accepted"){
      loadGoogleAnalytics();
      hideCookieBanner();
      return;
    }

    if(saved === "rejected"){
      window[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
      hideCookieBanner();
      return;
    }

    showCookieBanner();
  }

  window.showCookieBanner = showCookieBanner;
  window.acceptCookies = ()=> setCookieConsent("accepted");
  window.rejectCookies = ()=> setCookieConsent("rejected");
  window.openBugReport = ()=>{
    window.location.href = "bug-report.html";
  };
  window.openRatingForm = ()=>{
    if(RATING_FORM_URL && /^https?:\/\//.test(RATING_FORM_URL)){
      window.open(RATING_FORM_URL, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.href = "mailto:znajdzlekarzaopolskie@gmail.com?subject=Ocena%20strony%20ZnajdzLekarza%20Opolskie";
  };

  const TRIAGE_STATE = {
    open: false,
    session: null,
    chatHistory: []
  };

  function normalizePolishText(input){
    return String(input || "")
      .toLowerCase()
      .replace(/[ąćęłńóśźż]/g, (char)=>{
        const map = { "ą":"a", "ć":"c", "ę":"e", "ł":"l", "ń":"n", "ó":"o", "ś":"s", "ź":"z", "ż":"z" };
        return map[char] || char;
      });
  }

  function triageDangerFromText(text){
    const t = normalizePolishText(text);
    const dangerPatterns = [
      /duszno|nie moge oddychac|brak oddechu|sinieje/,
      /bol.*klat|klat.*bol|ucisk w klatce/,
      /udar|opadniety kacik|belkot|niedowlad|paraliz/,
      /utrata przytomnosci|nieprzytom|zemdl|drgawk/,
      /krwotok|silne krwawienie|krwioplucie/,
      /samoboj|chce sie zabic|mysli samobojcze/,
      /najgorszy bol glowy|bardzo silny bol glowy/
    ];
    return dangerPatterns.some((r)=>r.test(t));
  }

  function createTriageSession(){
    return {
      step: "symptoms",
      answers: {
        symptoms: "",
        age: "",
        duration: "",
        fever: "",
        redFlags: "",
        dehydration: ""
      }
    };
  }

  function triageAsk(question, options){
    triageAddMessage(question, "bot");
    if(Array.isArray(options) && options.length){
      triageAddOptions(options);
    }
  }

  function triageBegin(){
    TRIAGE_STATE.session = createTriageSession();
    TRIAGE_STATE.chatHistory = [];
    triageAsk(
      "Napisz swoje pytanie zdrowotne własnymi słowami. Odpowiadam tylko na tematy zdrowia i kierowania do właściwej pomocy (POZ/NPL/SOR/112).",
      null
    );
  }

  function triageParseYesNo(input){
    const t = normalizePolishText(input);
    if(/^(tak|yes|y|prawda|wystepuje)$/.test(t) || /\b(tak|wystepuje|sa|jest)\b/.test(t)) return "yes";
    if(/^(nie|no|n|brak|nie ma|nie wystepuje)$/.test(t) || /\b(nie|brak)\b/.test(t)) return "no";
    return "";
  }

  function triageParseAge(input){
    const t = normalizePolishText(input);
    if(/age:(infant|child|adult|senior)/.test(t)) return t.split(":")[1];
    if(/niemowle|noworod|0[- ]?1|miesiac|roczek/.test(t)) return "infant";
    if(/dziecko|nastolat|lat 1[0-7]|lat [2-9]\b|ma \d+ lat/.test(t)){
      const m = t.match(/(\d{1,2})\s*lat/);
      if(m){
        const years = Number(m[1]);
        if(years <= 1) return "infant";
        if(years <= 17) return "child";
      }
      if(/nastolat/.test(t)) return "child";
    }
    if(/senior|emeryt|65\+|lat 6[5-9]|lat [7-9]\d/.test(t)) return "senior";
    if(/dorosl|pelnolet|18\+|lat [1-5]\d|lat 6[0-4]/.test(t)) return "adult";
    return "";
  }

  function triageParseDuration(input){
    const t = normalizePolishText(input);
    if(/duration:(lt1|1-3|gt3)/.test(t)) return t.split(":")[1];
    if(/od dzis|kilka godzin|od rana|od wieczora|< ?24|mniej niz 24|ponizej doby|1 dzien/.test(t)) return "lt1";
    if(/1-3|2 dni|3 dni|od 2 dni|od 3 dni|dwa dni|trzy dni/.test(t)) return "1-3";
    if(/ponad 3|wiecej niz 3|od tygod|od kilku dni|od 4 dni|od 5 dni|od miesi/.test(t)) return "gt3";
    return "";
  }

  function triageParseFever(input){
    const t = normalizePolishText(input).replace(",", ".");
    if(/fever:(none|mid|high)/.test(t)) return t.split(":")[1];
    if(/brak goraczki|bez goraczki|bez temperatury/.test(t)) return "none";
    const numMatch = t.match(/(\d{2}\.\d|\d{2})/);
    if(numMatch){
      const temp = Number(numMatch[1]);
      if(Number.isFinite(temp)){
        if(temp >= 39) return "high";
        if(temp >= 37.5) return "mid";
        return "none";
      }
    }
    if(/wysoka goracz|39|40/.test(t)) return "high";
    if(/goracz|stan podgoraczk|37/.test(t)) return "mid";
    return "";
  }

  function triageExtractQuickFacts(input){
    return {
      age: triageParseAge(input),
      duration: triageParseDuration(input),
      fever: triageParseFever(input),
      yesNo: triageParseYesNo(input)
    };
  }


  function isHealthTopic(input){
    const t = normalizePolishText(input);
    return /(goracz|temperatur|wymiot|biegun|kaszel|katar|bol|duszn|omdlen|drgawk|lekarz|przychodni|szpital|sor|npl|poz|recept|skierowan|zwolnien|badan|wynik|cisnien|cukrzyc|alerg|serc|udar|gryp|infekc|zdrow|medycz|objaw|lek|tablet)/.test(t);
  }

	  async function getHealthAiReply(userText){
    const messages = [
      {
        role: "system",
        content:
`Jestes polskim asystentem zdrowotnym na stronie lokalnej wyszukiwarki lekarzy.
Zasady bez wyjatku:
- Odpowiadasz WYLACZNIE na pytania o zdrowie, objawy, profilaktyke i gdzie zglosic sie po pomoc.
- Jesli pytanie nie dotyczy zdrowia: krotko odmow i popros o pytanie zdrowotne.
- Nie stawiaj diagnozy.
- Oceniaj pilnosc i sugeruj sciezke: 112/SOR, NPL, POZ, specjalista.
- Gdy sa czerwone flagi (dusznosc, bol w klatce, udarowe, utrata przytomnosci, drgawki, silne krwawienie), zawsze 112/SOR natychmiast.
- Odpowiedz ma byc krotka, konkretna, po polsku, max 8 zdan + 3 krotkie punkty dzialania.
- Zawsze dodaj zdanie: "To informacja, nie diagnoza lekarska."`
      },
      ...TRIAGE_STATE.chatHistory.slice(-8),
      { role: "user", content: userText }
    ];

    if(!HEALTH_CHAT_ENDPOINT){
      return null;
    }

    try{
      const res = await fetch(HEALTH_CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages })
      });
      if(!res.ok) return null;
      const data = await res.json();
      const reply = String(data.reply || data.output_text || data.text || "").trim();
      return reply || null;
    }catch{
      return null;
    }
	  }

	  // Fallback "AI" (bez backendu): analizuje tekst uzytkownika i buduje decyzje pilnosci.
	  // Wczesniej fallback wolal triageEvaluate(), ale ta funkcja nie istniala, co psulo odpowiedzi.
	  function triageEvaluate(userText){
	    // Ensure session exists
	    if(!TRIAGE_STATE.session){
	      TRIAGE_STATE.session = createTriageSession();
	    }

	    const value = String(userText || "").trim();
	    const a = TRIAGE_STATE.session.answers;
	    a.symptoms = value;

	    // Quick facts from the same message (best-effort, user rarely odpowiada krokami)
	    const facts = triageExtractQuickFacts(value);
	    if(facts.age) a.age = facts.age;
	    if(facts.duration) a.duration = facts.duration;
	    if(facts.fever) a.fever = facts.fever;

	    // Simple heuristics for dehydration / red flags from free text
	    const t = normalizePolishText(value);
	    if(/krew w stolcu|smolisty stol|czarny stol|odwodn|sucho w ustach|brak moczu|zawrot glowy|omdlen/.test(t)){
	      a.dehydration = "yes";
	    }
	    if(triageDangerFromText(value) || /krew w stolcu|bardzo silny bol brzucha|sztywnosc karku/.test(t)){
	      a.redFlags = "yes";
	    }

	    return triageBuildDecision();
	  }

	  function fallbackHealthReply(userText){
	    try{
	      const decision = triageEvaluate(userText);

	      // Add a tiny symptom-specific hint for common cases (keeps it useful even without backend AI)
	      const t = normalizePolishText(userText);
	      const extra = [];
	      if(/biegun/.test(t)){
	        extra.push("Pij często małymi porcjami (woda/elektrolity).");
	        extra.push("Pilnie skontaktuj się z lekarzem, jeśli jest krew w stolcu, wysoka gorączka lub objawy odwodnienia.");
	      } else if(/wymiot/.test(t)){
	        extra.push("Nawadniaj się małymi porcjami; jeśli nie utrzymujesz płynów lub pojawia się odwodnienie, kontakt pilny.");
	      }

	      const lines = [
	        `${triageLevelIcon(decision.level)} ${decision.title}`,
	        decision.text,
	        ...decision.bullets.map((b)=>`- ${b}`),
	        ...(extra.length ? ["", ...extra.map((x)=>`- ${x}`)] : []),
	        "To informacja, nie diagnoza lekarska."
	      ];
	      return lines.join("\n");
	    }catch{
	      return [
	        "Nie potrafię teraz ocenić pilności na podstawie tej wiadomości.",
	        "Napisz proszę: wiek, od kiedy trwają objawy i czy jest gorączka, krew w stolcu lub silny ból.",
	        "To informacja, nie diagnoza lekarska."
	      ].join("\n");
	    }
	  }
  function triageBuildDecision(){
    const a = TRIAGE_STATE.session?.answers || {};
    const reasons = [];
    let urgentScore = 0;

    if(a.age === "infant"){
      urgentScore += 2;
      reasons.push("dotyczy małego dziecka");
    } else if(a.age === "child" || a.age === "senior"){
      urgentScore += 1;
      reasons.push("większe ryzyko ze względu na wiek");
    }

    if(a.duration === "gt3"){
      urgentScore += 1;
      reasons.push("objawy trwają ponad 3 dni");
    } else if(a.duration === "1-3"){
      urgentScore += 0.5;
    }

    if(a.fever === "high"){
      urgentScore += 2;
      reasons.push("wysoka gorączka (>=39)");
    } else if(a.fever === "mid"){
      urgentScore += 1;
      reasons.push("podwyższona temperatura");
    }

    if(a.dehydration === "yes"){
      urgentScore += 2;
      reasons.push("ryzyko odwodnienia / utrzymujących się wymiotów");
    }

    const symptomText = normalizePolishText(a.symptoms);
    if(/silny bol brzucha|bardzo silny bol/.test(symptomText)){
      urgentScore += 1.5;
      reasons.push("silny ból");
    }
    if(/wymiot|biegun/.test(symptomText)){
      urgentScore += 0.5;
    }

    if(a.redFlags === "yes" || triageDangerFromText(a.symptoms)){
      return {
        level: "danger",
        title: "Pilne: 112 / SOR teraz",
        text: "Na podstawie odpowiedzi wygląda to na stan wymagający pilnej pomocy.",
        bullets: [
          "Nie czekaj na dalszą konsultację online.",
          "Dzwoń 112 albo jedź na SOR.",
          "Jeśli możesz, nie jedź sam/a."
        ],
        reasons: ["występują objawy alarmowe"]
      };
    }

    if(urgentScore >= 3){
      return {
        level: "urgent",
        title: "Pilne: NPL dzisiaj (lub SOR przy pogorszeniu)",
        text: "Objawy wymagają pilnej oceny medycznej jeszcze dziś.",
        bullets: [
          "Skontaktuj się z NPL dzisiaj.",
          "Nawadniaj się małymi porcjami.",
          "Jeśli pojawi się duszność, silne osłabienie lub zaburzenia świadomości: 112/SOR."
        ],
        reasons
      };
    }

    if(urgentScore >= 1.5){
      return {
        level: "soon",
        title: "POZ: umów wizytę w 24h",
        text: "Najlepszy pierwszy krok to lekarz rodzinny (POZ), najlepiej jeszcze dziś lub jutro.",
        bullets: [
          "Przygotuj listę objawów i czas trwania.",
          "Weź listę leków i chorób przewlekłych.",
          "Przy pogorszeniu: NPL lub SOR."
        ],
        reasons
      };
    }

    return {
      level: "low",
      title: "POZ / obserwacja",
      text: "Na ten moment wygląda na sytuację niewymagającą SOR. Obserwuj objawy i skontaktuj się z POZ, jeśli się utrzymują.",
      bullets: [
        "Nawadniaj się i odpoczywaj.",
        "Mierz temperaturę i zapisuj objawy.",
        "W razie pogorszenia lub objawów alarmowych: 112/SOR."
      ],
      reasons
    };
  }

  function triageLevelClass(level){
    if(level === "danger") return "triage-level triage-level-danger";
    if(level === "urgent") return "triage-level triage-level-urgent";
    if(level === "soon") return "triage-level triage-level-soon";
    return "triage-level triage-level-low";
  }

  function triageLevelIcon(level){
    if(level === "danger") return "🚨";
    if(level === "urgent") return "⚠️";
    if(level === "soon") return "✅";
    return "ℹ️";
  }

  function triageAddMessage(text, role){
    const box = document.getElementById("triageMessages");
    if(!box) return;
    const item = document.createElement("div");
    item.className = `triage-bubble ${role === "user" ? "triage-user" : "triage-bot"}`;
    item.textContent = text;
    box.appendChild(item);
    box.scrollTop = box.scrollHeight;
  }

  function triageAddOptions(options){
    const box = document.getElementById("triageMessages");
    if(!box) return;
    const wrap = document.createElement("div");
    wrap.className = "triage-options";
    options.forEach((option)=>{
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "triage-option-btn";
      btn.textContent = option.label;
      btn.dataset.value = option.value;
      wrap.appendChild(btn);
    });
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
  }

  function triageAddDecision(decision){
    const box = document.getElementById("triageMessages");
    if(!box) return;
    const wrap = document.createElement("div");
    wrap.className = "triage-bubble triage-bot";

    const title = document.createElement("div");
    title.className = triageLevelClass(decision.level);
    title.textContent = `${triageLevelIcon(decision.level)} ${decision.title}`;
    wrap.appendChild(title);

    const p = document.createElement("p");
    p.style.margin = "8px 0 0";
    p.textContent = decision.text;
    wrap.appendChild(p);

    const ul = document.createElement("ul");
    ul.style.margin = "8px 0 0";
    ul.style.paddingLeft = "17px";
    decision.bullets.forEach((line)=>{
      const li = document.createElement("li");
      li.textContent = line;
      ul.appendChild(li);
    });
    wrap.appendChild(ul);

    if(Array.isArray(decision.reasons) && decision.reasons.length){
      const why = document.createElement("p");
      why.style.margin = "8px 0 0";
      why.style.fontSize = "12px";
      why.style.color = "#334155";
      why.textContent = `Na to wpłynęło: ${decision.reasons.join(", ")}.`;
      wrap.appendChild(why);
    }

    const note = document.createElement("p");
    note.style.margin = "8px 0 0";
    note.style.fontSize = "12px";
    note.style.color = "#64748b";
    note.textContent = "Uwaga: To wsparcie informacyjne, nie porada lekarska.";
    wrap.appendChild(note);

    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
  }

  async function triageHandleInput(text){
    const value = String(text || "").trim();
    if(!value) return;

    const normalized = normalizePolishText(value);
    if(/^(od nowa|reset|restart|start)$/.test(normalized)){
      triageAddMessage("Rozpocznijmy od nowa.", "bot");
      triageBegin();
      return;
    }

    if(!isHealthTopic(value)){
      triageAddMessage("Pomagam tylko w pytaniach zdrowotnych i medycznych. Napisz prosze objawy albo pytanie o zdrowie.", "bot");
      return;
    }

    TRIAGE_STATE.chatHistory.push({ role: "user", content: value });

    const aiReply = await getHealthAiReply(value);
    if(aiReply){
      triageAddMessage(aiReply, "bot");
      TRIAGE_STATE.chatHistory.push({ role: "assistant", content: aiReply });
      return;
    }

    const fallback = fallbackHealthReply(value);
    triageAddMessage(fallback, "bot");
    TRIAGE_STATE.chatHistory.push({ role: "assistant", content: fallback });
  }

  function triageSubmit(){
    const input = document.getElementById("triageInput");
    if(!input) return;
    const text = String(input.value || "").trim();
    if(!text) return;
    triageAddMessage(text, "user");
    input.value = "";
    window.setTimeout(()=>{
      triageHandleInput(text);
    }, 160);
  }

  function openTriageAssistant(){
    const panel = document.getElementById("triagePanel");
    const launcher = document.getElementById("triageLauncher");
    if(!panel || !launcher) return;
    panel.hidden = false;
    launcher.hidden = true;
    TRIAGE_STATE.open = true;
    const messages = document.getElementById("triageMessages");
    if(messages){
      messages.scrollTop = messages.scrollHeight;
    }
    const input = document.getElementById("triageInput");
    if(input) input.focus();
  }

  function closeTriageAssistant(){
    const panel = document.getElementById("triagePanel");
    const launcher = document.getElementById("triageLauncher");
    if(!panel || !launcher) return;
    panel.hidden = true;
    launcher.hidden = false;
    TRIAGE_STATE.open = false;
  }

  function initTriageAssistant(){
    if(document.getElementById("triageAssistantRoot")) return;

    const root = document.createElement("div");
    root.id = "triageAssistantRoot";
    root.innerHTML = `
      <button id="triageLauncher" type="button" class="triage-launcher" aria-label="Otwórz asystenta objawów">
        🤖 Asystent objawów
      </button>
      <section id="triagePanel" class="triage-panel" hidden aria-live="polite">
        <div class="triage-head">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
            <div>
              <p class="triage-title">Asystent objawów (beta)</p>
              <p class="triage-sub">Tryb AI: analiza Twojej wiadomości, tylko tematy zdrowotne.</p>
            </div>
            <button id="triageClose" class="triage-close" type="button" aria-label="Zamknij">×</button>
          </div>
        </div>
        <div id="triageMessages" class="triage-messages">
          <div class="triage-bubble triage-bot">
            Cześć! Opisz swój problem zdrowotny. Odpowiem jak asystent AI, ale tylko w tematach zdrowotnych.
          </div>
        </div>
        <div class="triage-input-wrap">
          <input id="triageInput" class="triage-input" type="text" placeholder="Opisz objawy..." autocomplete="off">
          <button id="triageSend" class="btn-primary triage-send" type="button">Wyślij</button>
        </div>
      </section>
    `;
    document.body.appendChild(root);

    document.getElementById("triageLauncher").addEventListener("click", openTriageAssistant);
    document.getElementById("triageClose").addEventListener("click", closeTriageAssistant);
    document.getElementById("triageSend").addEventListener("click", triageSubmit);
    document.getElementById("triageInput").addEventListener("keydown", (event)=>{
      if(event.key === "Enter"){
        event.preventDefault();
        triageSubmit();
      }
    });
    document.getElementById("triageMessages").addEventListener("click", (event)=>{
      const target = event.target;
      if(!(target instanceof HTMLElement)) return;
      if(!target.classList.contains("triage-option-btn")) return;
      const value = String(target.dataset.value || "").trim();
      if(!value) return;
      triageAddMessage(target.textContent || value, "user");
      window.setTimeout(()=> triageHandleInput(value), 120);
    });

    triageBegin();
  }

  window.openTriageAssistant = openTriageAssistant;
  window.closeTriageAssistant = closeTriageAssistant;

  document.addEventListener("DOMContentLoaded", initCookieConsent);

const app = document.getElementById("app");
const RESULTS_BATCH_SIZE = 12;
let lastSearchResults = [];
let renderedResultsCount = 0;
let doctorsById = new Map();
let doctorsByFacility = new Map();
let specializationList = [];
let specializationNormSet = new Set();
let facilityRecords = [];
let facilityById = new Map();
let searchCache = new Map();
let activeSearchRunId = 0;
let searchWorker = null;
let searchWorkerReadyPromise = null;
let searchWorkerRequestSeq = 0;
const searchWorkerPending = new Map();


let doctors = window.DOCTORS_DATA || [];

const contactOverrideRules = [
  {
    includes: "ambasada usmiechu",
    phone: "691 777 197",
    address: "ul. Bielska 31, 45-401 Opole",
    mapsQuery: "Ambasada Uśmiechu, ul. Bielska 31, Opole"
  },
  {
    includes: "adenta",
    phone: "77 888 10 52",
    address: "ul. Książąt Opolskich 48-50/3B, 45-006 Opole",
    mapsQuery: "Adenta, ul. Książąt Opolskich 48-50/3B, Opole"
  },
  {
    includes: "laserdent",
    phone: "604 608 908",
    address: "ul. Skromna 1, 45-351 Opole",
    mapsQuery: "LASERDENT, ul. Skromna 1, Opole"
  },
  {
    includes: "dentistar",
    phone: "77 400 74 96",
    address: "ul. Chmielowicka 13A, 45-758 Opole",
    mapsQuery: "Dentistar, ul. Chmielowicka 13A, Opole"
  },
  {
    includes: "galeria usmiechu opole",
    phone: "736 841 664",
    address: "ul. Ozimska 59/1B, 45-368 Opole",
    mapsQuery: "Galeria Uśmiechu, ul. Ozimska 59/1B, Opole"
  },
  {
    includes: "panaceum centrum implantologii i stomatologii",
    phone: "77 474 60 56",
    address: "ul. Kazimierza Pużaka 9, 45-272 Opole",
    mapsQuery: "Panaceum, ul. Kazimierza Pużaka 9, Opole"
  },
  {
    includes: "medicinae stomatologia",
    phone: "500 424 940",
    address: "ul. Kośnego 45, 45-372 Opole",
    mapsQuery: "Medicinae Stomatologia, ul. Kośnego 45, Opole"
  },
  {
    includes: "opolskie centrum stomatologiczne tanczak",
    phone: "77 453 88 33",
    address: "ul. Budowlanych 33, 45-121 Opole",
    mapsQuery: "Opolskie Centrum Stomatologiczne Tańczak, ul. Budowlanych 33, Opole"
  },
  {
    includes: "zespol opieki zdrowotnej w nysie",
    phone: "77 40 87 800",
    address: "ul. Bohaterów Warszawy 34, 48-300 Nysa",
    mapsQuery: "Zespół Opieki Zdrowotnej w Nysie, ul. Bohaterów Warszawy 34, Nysa"
  },
  {
    includes: "nzoz nowa-med",
    phone: "77 448 00 33",
    address: "ul. Marcinkowskiego 2-4, 48-300 Nysa",
    mapsQuery: "NZOZ Nowa-Med, ul. Marcinkowskiego 2-4, Nysa"
  },
  {
    includes: "przychodnia rondo nysa",
    phone: "77 409 17 25",
    address: "ul. Kolejowa 2B, 48-300 Nysa",
    mapsQuery: "Przychodnia RONDO, ul. Kolejowa 2B, Nysa"
  },
  {
    includes: "nzoz \"rondo\"",
    phone: "77 409 17 25",
    address: "ul. Kolejowa 2B, 48-300 Nysa",
    mapsQuery: "NZOZ RONDO, ul. Kolejowa 2B, Nysa"
  },
  {
    includes: "przychodnia marcinkowskiego",
    phone: "77 448 00 33",
    address: "ul. Marcinkowskiego 2-4, 48-300 Nysa",
    mapsQuery: "NZOZ Nowa-Med, ul. Marcinkowskiego 2-4, Nysa"
  },
  {
    includes: "nzoz rondo",
    phone: "77 409 17 25",
    address: "ul. Kolejowa 2B, 48-300 Nysa",
    mapsQuery: "Przychodnia RONDO, ul. Kolejowa 2B, Nysa"
  },
  {
    includes: "city hospital health care center",
    phone: "77 40 87 800",
    address: "ul. Bohaterów Warszawy 23, 48-300 Nysa",
    mapsQuery: "Szpital Miejski w Nysie, ul. Bohaterów Warszawy 23, Nysa"
  },
  {
    includes: "prudnickie centrum medyczne",
    phone: "77 40 67 800",
    address: "ul. Szpitalna 14, 48-200 Prudnik",
    mapsQuery: "Prudnickie Centrum Medyczne, ul. Szpitalna 14, Prudnik"
  },
  {
    includes: "powiatowe centrum zdrowia s.a. w kluczborku",
    phone: "77 417 35 00",
    address: "ul. M. Skłodowskiej-Curie 23, 46-200 Kluczbork",
    mapsQuery: "Powiatowe Centrum Zdrowia SA, ul. M. Skłodowskiej-Curie 23, Kluczbork"
  },
  {
    includes: "szpital powiatowy w kluczborku",
    phone: "77 417 35 00",
    address: "ul. M. Skłodowskiej-Curie 23, 46-200 Kluczbork",
    mapsQuery: "Szpital Powiatowy w Kluczborku, ul. M. Skłodowskiej-Curie 23, Kluczbork"
  },
  {
    includes: "audika – aparaty sluchowe nysa",
    phone: "733 006 849",
    address: "ul. Rynek 13/1b, 48-300 Nysa",
    mapsQuery: "Audika, ul. Rynek 13/1b, Nysa"
  },
  {
    includes: "medin klinika",
    phone: "77 707 70 70",
    address: "ul. Częstochowska 54, 45-424 Opole",
    mapsQuery: "Medin Klinika, ul. Częstochowska 54, Opole"
  },
  {
    includes: "panmedica",
    phone: "690 346 214",
    address: "ul. Częstochowska 50, 45-424 Opole",
    mapsQuery: "PanMedica, ul. Częstochowska 50, Opole"
  },
  {
    includes: "endopractica",
    phone: "536 508 501",
    address: "ul. Horoszkiewicza 6, 45-301 Opole",
    mapsQuery: "EndoPractica, ul. Horoszkiewicza 6, Opole"
  },
  {
    includes: "nzoz specjalistyka",
    phone: "77 454 54 27",
    address: "ul. Ozimska 20, 45-057 Opole",
    mapsQuery: "NZOZ Specjalistyka, ul. Ozimska 20, Opole"
  },
  {
    includes: "centrum medyczne ars-med",
    phone: "77 542 18 17",
    address: "ul. Sergiusza Mossora 6, 49-300 Brzeg",
    mapsQuery: "Centrum Medyczne ARS-MED, ul. Sergiusza Mossora 6, Brzeg"
  },
  {
    includes: "brzeskie centrum medyczne",
    phone: "77 444 66 66",
    address: "ul. Mossora 1, 49-301 Brzeg",
    mapsQuery: "Brzeskie Centrum Medyczne, ul. Mossora 1, Brzeg"
  },
  {
    includes: "sp zoz w prudniku",
    phone: "77 40 67 800",
    address: "ul. Szpitalna 14, 48-200 Prudnik",
    mapsQuery: "Prudnickie Centrum Medyczne, ul. Szpitalna 14, Prudnik"
  },
  {
    includes: "sp zoz w glubczycach",
    phone: "77 480 11 70",
    address: "ul. M. Skłodowskiej-Curie 26, 48-100 Głubczyce",
    mapsQuery: "SP ZOZ w Głubczycach, ul. M. Skłodowskiej-Curie 26, Głubczyce"
  },
  {
    includes: "kluczborskie centrum medyczne",
    phone: "77 417 35 00",
    address: "ul. M. Skłodowskiej-Curie 23, 46-200 Kluczbork",
    mapsQuery: "Powiatowe Centrum Zdrowia, ul. M. Skłodowskiej-Curie 23, Kluczbork"
  },
  {
    includes: "medrem-poliklinika",
    phone: "77 423 26 60",
    address: "ul. Katowicka 55, 45-061 Opole",
    mapsQuery: "MEDREM-Poliklinika, ul. Katowicka 55, Opole"
  },
  {
    includes: "nzoz medrem-poliklinika",
    phone: "77 423 26 60",
    address: "ul. Katowicka 55, 45-061 Opole",
    mapsQuery: "MEDREM-Poliklinika, ul. Katowicka 55, Opole"
  },
  {
    includes: "mediclinica",
    phone: "534 798 968",
    address: "ul. Ozimska 77D, 45-370 Opole",
    mapsQuery: "MediClinica, ul. Ozimska 77D, Opole"
  },
  {
    includes: "optima medycyna",
    phone: "77 887 21 21",
    address: "ul. Dambonia 171, 45-860 Opole",
    mapsQuery: "Optima Medycyna, ul. Dambonia 171, Opole"
  },
  {
    includes: "spzoz mswia w opolu",
    phone: "77 401 11 70",
    address: "ul. Krakowska 44, 45-075 Opole",
    mapsQuery: "SP ZOZ MSWiA, ul. Krakowska 44, Opole"
  },
  {
    includes: "spzoz mswia",
    phone: "77 401 11 70",
    address: "ul. Krakowska 44, 45-075 Opole",
    mapsQuery: "SP ZOZ MSWiA, ul. Krakowska 44, Opole"
  },
  {
    includes: "szpital wojewodzki w opolu",
    phone: "77 44 33 100",
    address: "ul. Kośnego 53, 45-372 Opole",
    mapsQuery: "Szpital Wojewódzki w Opolu, ul. Kośnego 53, Opole"
  },
  {
    includes: "opolskie centrum onkologii",
    phone: "77 441 60 01",
    address: "ul. Katowicka 66A, 45-061 Opole",
    mapsQuery: "Opolskie Centrum Onkologii, ul. Katowicka 66A, Opole"
  },
  {
    includes: "uniwersytecki szpital kliniczny w opolu",
    phone: "77 45 20 745",
    address: "al. W. Witosa 26, 45-401 Opole",
    mapsQuery: "Uniwersytecki Szpital Kliniczny, al. Witosa 26, Opole"
  },
  {
    includes: "na dobre i na zle",
    phone: "77 474 32 09",
    address: "ul. Oleska 97, 45-222 Opole",
    mapsQuery: "Centrum Medyczne Na Dobre i Na Złe, ul. Oleska 97, Opole"
  },
  {
    includes: "lux med diagnostyka",
    phone: "22 275 96 28",
    address: "ul. Krakowska 44, 45-075 Opole",
    mapsQuery: "LUX MED Diagnostyka, ul. Krakowska 44, Opole"
  },
  {
    includes: "lux med",
    phone: "22 33 22 888",
    address: "ul. Fieldorfa 2, 45-273 Opole",
    mapsQuery: "LUX MED, ul. Fieldorfa 2, Opole"
  }
];

function stripDiacritics(txt){
  return String(txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"");
}

doctors = doctors.map((d)=>{
  const normalizedName = stripDiacritics(d.name);
  const rule = contactOverrideRules.find(r => normalizedName.includes(stripDiacritics(r.includes)));
  if(!rule) return d;
  return {
    ...d,
    phone: rule.phone,
    address: rule.address,
    mapsQuery: rule.mapsQuery,
    mapsExact: true
  };
});

function normalizeForMatch(txt){
  return stripDiacritics(txt).replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
}

function primaryNamePart(name){
  const normalized = normalizeForMatch(name);
  const parts = normalized.split(/\s+[–-]\s+|\s+\|\s+|\s+\/\s+/).map(p=>p.trim()).filter(Boolean);
  return (parts[0] || normalized || "").trim();
}

function hasUsefulPhone(phone){
  const p = String(phone || "").trim();
  return p !== "" && p !== "—";
}

const donors = doctors
  .filter(d => hasUsefulPhone(d.phone))
  .map(d => ({
    ...d,
    __nameNorm: normalizeForMatch(d.name),
    __nameHead: primaryNamePart(d.name),
    __cityNorm: normalizeForMatch(d.city)
  }));

doctors = doctors.map((d)=>{
  if(hasUsefulPhone(d.phone) && (d.address || d.mapsQuery)) return d;

  const nameNorm = normalizeForMatch(d.name);
  const nameHead = primaryNamePart(d.name);
  const cityNorm = normalizeForMatch(d.city);

  const candidates = donors
    .map(src => {
      let score = 0;
      if(src.__nameNorm === nameNorm) score += 100;
      if(src.__nameHead === nameHead) score += 75;
      if(nameNorm.includes(src.__nameHead) || src.__nameNorm.includes(nameHead)) score += 40;
      if(nameNorm.includes(src.__nameNorm) || src.__nameNorm.includes(nameNorm)) score += 25;
      if(src.__cityNorm === cityNorm) score += 15;
      return { src, score };
    })
    .filter(x => x.score > 0)
    .sort((a,b)=>b.score-a.score);

  if(!candidates.length) return d;

  const best = candidates[0].src;
  return {
    ...d,
    phone: hasUsefulPhone(d.phone) ? d.phone : best.phone,
    address: d.address || best.address || null,
    mapsQuery: d.mapsQuery || best.mapsQuery || null,
    mapsExact: Boolean(d.mapsExact || d.address || best.mapsExact || best.address)
  };
});

const cityFallbackContacts = {
  "Brzeg": {
    phone: "77 444 66 66",
    address: "ul. Mossora 1, 49-301 Brzeg",
    mapsQuery: "Brzeskie Centrum Medyczne, ul. Mossora 1, Brzeg"
  },
  "Kluczbork": {
    phone: "77 417 35 00",
    address: "ul. M. Skłodowskiej-Curie 23, 46-200 Kluczbork",
    mapsQuery: "Powiatowe Centrum Zdrowia, ul. M. Skłodowskiej-Curie 23, Kluczbork"
  },
  "Prudnik": {
    phone: "77 40 67 800",
    address: "ul. Szpitalna 14, 48-200 Prudnik",
    mapsQuery: "Prudnickie Centrum Medyczne, ul. Szpitalna 14, Prudnik"
  },
  "Głubczyce": {
    phone: "77 480 11 70",
    address: "ul. M. Skłodowskiej-Curie 26, 48-100 Głubczyce",
    mapsQuery: "SP ZOZ w Głubczycach, ul. M. Skłodowskiej-Curie 26, Głubczyce"
  }
};

doctors = doctors.map((d)=>{
  if(hasUsefulPhone(d.phone)) return d;
  const fallback = cityFallbackContacts[d.city];
  if(!fallback) return d;
  return {
    ...d,
    phone: fallback.phone,
    address: d.address || fallback.address,
    mapsQuery: d.mapsQuery || `${d.name}, ${d.city}` || fallback.mapsQuery,
    mapsExact: Boolean(d.mapsExact || d.address)
  };
});

doctors = doctors.map((d)=>{
  const fallbackMapsQuery = [d.name, d.city, "Polska"].filter(Boolean).join(", ");
  return {
    ...d,
    mapsQuery: d.mapsQuery || d.address || fallbackMapsQuery,
    mapsExact: Boolean(d.mapsExact || d.address || d.placeId || (d.lat != null && d.lon != null))
  };
});

function enrichMissingSpecializations(data){
  const byFacility = new Map();
  const makeKey = (d)=>`${normalize(d.name)}__${normalize(d.city)}`;

  data.forEach((d)=>{
    const key = makeKey(d);
    if(!byFacility.has(key)) byFacility.set(key, []);
    byFacility.get(key).push(d);
  });

  let nextId = Math.max(...data.map(d => Number(d.id) || 0), 0) + 1;
  const inferred = [];

  const inferSpecsFromName = (name)=>{
    const n = normalize(name);
    const specs = new Set();

    if(/stomat|dent|implant/.test(n)) specs.add("Dentysta");
    if(/ginek|polozn/.test(n)) specs.add("Ginekolog");
    if(/pediatr|dziecie/.test(n)) specs.add("Pediatra");
    if(/medycynapracy/.test(n)) specs.add("Medycyna pracy");
    if(/rehab|fizjo/.test(n)) specs.add("Rehabilitacja medyczna");
    if(/chirurgnaczyni|naczyniow/.test(n)) specs.add("Chirurg naczyniowy");
    if(/ortoped|uraz/.test(n)) specs.add("Ortopeda");
    if(/laryng|otolaryng/.test(n)) specs.add("Laryngolog");
    if(/okul|vision|optyk/.test(n)) specs.add("Okulista");
    if(/pulmon|oddech|tlen/.test(n)) specs.add("Pulmonolog");
    if(/kardiolog/.test(n)) specs.add("Kardiolog");
    if(/neurolog/.test(n)) specs.add("Neurolog");
    if(/dermatolog/.test(n)) specs.add("Dermatolog");
    if(/psychiatr/.test(n)) specs.add("Psychiatra");
    if(/przychodnia|poz|lekarzarodzinnego|rodzinna/.test(n)) specs.add("Lekarz rodzinny");

    return specs;
  };

  byFacility.forEach((list)=>{
    const existing = new Set(list.map(x => normalize(x.specialization)));
    const fromName = inferSpecsFromName(list[0].name);

    // POZ usually implies internal medicine and vice versa in this dataset.
    if(existing.has(normalize("Lekarz rodzinny"))) fromName.add("Internista");
    if(existing.has(normalize("Internista"))) fromName.add("Lekarz rodzinny");

    const base = list[0];
    fromName.forEach((spec)=>{
      const normalizedSpec = normalize(spec);
      if(existing.has(normalizedSpec)) return;

      inferred.push({
        ...base,
        id: nextId++,
        specialization: spec,
        reviews: [
          "Specjalizacja uzupełniona automatycznie na podstawie profilu placówki",
          "Skontaktuj się z placówką, aby potwierdzić zakres świadczeń"
        ]
      });
      existing.add(normalizedSpec);
    });
  });

  return [...data, ...inferred];
}

doctors = enrichMissingSpecializations(doctors);

function normalizeFacilityLabel(name, city){
  const raw = String(name || "").trim().replace(/\s+/g, " ");
  if(!raw) return raw;

  const n = normalize(raw);
  if(
    n === "prywatne" ||
    n === "gabinety" ||
    n === "gabinetyprywatne" ||
    n === "prywatnegabinety" ||
    n === "gabinetyprywatnewmiescie"
  ){
    return `Gabinety prywatne (${city})`;
  }

  if(n === "poradnieprywatne"){
    return `Poradnie prywatne (${city})`;
  }

  return raw;
}

function isPrivateFacilityName(name){
  const n = normalize(String(name || ""));
  return n.includes("prywat") || n.includes("gabinet");
}

const cityCoverageBlueprint = [
  {
    city: "Byczyna",
    facilities: [
      { name: "Przychodnia „Rodzina” – Anna Gulewicz", specs: ["Lekarz rodzinny", "Internista", "POZ"] },
      { name: "NZOZ Remedium", specs: ["Internista", "Lekarz rodzinny", "Medycyna paliatywna"] },
      { name: "Poradnia Profilaktyki Medycznej (Dworcowa 4)", specs: ["Medycyna pracy", "Lekarz rodzinny", "Pediatra"] },
      { name: "Gabinety prywatne w mieście", specs: ["Dentysta", "Rehabilitacja medyczna", "Diagnostyka laboratoryjna"] }
    ]
  },
  {
    city: "Dobrodzień",
    facilities: [
      { name: "Przychodnia Rejonowa Dobrodzień", specs: ["Lekarz rodzinny", "Internista", "Pediatra"] },
      { name: "Gabinety prywatne", specs: ["Dentysta", "Rehabilitacja medyczna", "Fizjoterapia"] }
    ]
  },
  {
    city: "Głuchołazy",
    facilities: [
      { name: "SP ZOZ Głuchołazy", specs: ["Lekarz rodzinny", "Pediatra", "Chirurg ogólny", "Ginekolog", "Ortopeda", "Kardiolog", "Neurolog"] },
      { name: "Poradnie prywatne", specs: ["Okulista", "Dermatolog", "Dentysta"] }
    ]
  },
  {
    city: "Gogolin",
    facilities: [
      { name: "Nowa Przychodnia Gogolin", specs: ["Lekarz rodzinny", "Internista", "Pediatra", "Ginekolog"] },
      { name: "Prywatne gabinety", specs: ["Dentysta", "Rehabilitacja medyczna"] }
    ]
  },
  {
    city: "Grodków",
    facilities: [
      { name: "SPZOZ Grodków", specs: ["Lekarz rodzinny", "Internista", "Pediatra", "Chirurg ogólny", "Ginekolog", "Kardiolog"] },
      { name: "Prywatne gabinety", specs: ["Dentysta", "Ortopeda"] }
    ]
  },
  {
    city: "Kietrz",
    facilities: [
      { name: "Przychodnia Rejonowa Kietrz", specs: ["Lekarz rodzinny", "Internista", "Pediatra"] },
      { name: "Gabinety prywatne", specs: ["Dentysta", "Rehabilitacja medyczna"] }
    ]
  },
  {
    city: "Korfantów",
    facilities: [
      { name: "Przychodnia Korfantów", specs: ["Lekarz rodzinny", "Internista", "Pediatra"] },
      { name: "Gabinety", specs: ["Dentysta"] }
    ]
  },
  {
    city: "Lewin Brzeski",
    facilities: [
      { name: "Centrum Medyczne Lewin Brzeski", specs: ["Lekarz rodzinny", "Internista", "Pediatra", "Ginekolog"] },
      { name: "Prywatne", specs: ["Dentysta", "Rehabilitacja medyczna"] }
    ]
  },
  {
    city: "Niemodlin",
    facilities: [
      { name: "Przychodnia Niemodlin", specs: ["Lekarz rodzinny", "Internista", "Pediatra", "Ginekolog"] },
      { name: "Gabinety", specs: ["Dentysta", "Fizjoterapia"] }
    ]
  },
  {
    city: "Otmuchów",
    facilities: [
      { name: "Przychodnia Otmuchów", specs: ["Lekarz rodzinny", "Internista", "Pediatra"] },
      { name: "Prywatne", specs: ["Dentysta", "Rehabilitacja medyczna"] }
    ]
  },
  {
    city: "Ozimek",
    facilities: [
      { name: "Przychodnia Ozimek", specs: ["Lekarz rodzinny", "Internista", "Pediatra", "Ginekolog"] },
      { name: "Prywatne", specs: ["Dentysta", "Rehabilitacja medyczna"] }
    ]
  },
  {
    city: "Paczków",
    facilities: [
      { name: "Centrum Medyczne Paczków", specs: ["Lekarz rodzinny", "Internista", "Pediatra", "Ginekolog"] },
      { name: "Gabinety", specs: ["Dentysta"] }
    ]
  },
  {
    city: "Praszka",
    facilities: [
      { name: "Centrum Medyczne Praszka", specs: ["Lekarz rodzinny", "Internista", "Pediatra", "Ginekolog", "Chirurg ogólny"] },
      { name: "Prywatne", specs: ["Dentysta", "Rehabilitacja medyczna"] }
    ]
  },
  {
    city: "Zdzieszowice",
    facilities: [
      { name: "Centrum Medyczne Zdzieszowice", specs: ["Lekarz rodzinny", "Internista", "Pediatra", "Ginekolog"] },
      { name: "Prywatne", specs: ["Dentysta", "Rehabilitacja medyczna"] }
    ]
  }
];

function ensureCoverageFromBlueprint(data, blueprint){
  const result = [...data];
  const keys = new Set(result.map(d => `${normalize(normalizeFacilityLabel(d.name, d.city))}__${normalize(d.city)}__${normalize(d.specialization)}`));
  let nextId = Math.max(...result.map(d => Number(d.id) || 0), 0) + 1;

  blueprint.forEach((cityEntry)=>{
    const city = cityEntry.city;
    cityEntry.facilities.forEach((facility)=>{
      const normalizedFacilityName = normalizeFacilityLabel(facility.name, city);
      const isPrivate = isPrivateFacilityName(normalizedFacilityName);
      const mode = facility.mode || (isPrivate ? "private" : "nfz");

      facility.specs.forEach((spec)=>{
        const key = `${normalize(normalizedFacilityName)}__${normalize(city)}__${normalize(spec)}`;
        if(keys.has(key)) return;

        result.push({
          id: nextId++,
          name: normalizedFacilityName,
          specialization: spec,
          city,
          phone: "",
          price: mode !== "nfz" ? 180 : null,
          nfz: mode !== "private",
          privateVisit: mode !== "nfz",
          featured: false,
          rating: 4.1,
          address: `${city}`,
          mapsQuery: `${normalizedFacilityName}, ${city}`,
          reviews: [
            "Zakres specjalizacji uzupełniony według listy miasta",
            "Skontaktuj się z placówką, aby potwierdzić dostępność lekarza"
          ]
        });
        keys.add(key);
      });
    });
  });

  return result;
}

function dedupeDoctorsData(data){
  const bestByKey = new Map();

  const scoreDoctor = (d)=>{
    let score = 0;
    if(hasUsefulPhone(d.phone)) score += 5;
    if(String(d.address || "").trim()) score += 3;
    if(String(d.mapsQuery || "").trim()) score += 2;
    if(Array.isArray(d.reviews) && d.reviews.length) score += 1;
    return score;
  };

  const mergeDoctor = (a, b)=>{
    const preferred = scoreDoctor(b) > scoreDoctor(a) ? b : a;
    const fallback = preferred === a ? b : a;

    return {
      ...preferred,
      nfz: Boolean(a.nfz || b.nfz),
      privateVisit: Boolean(a.privateVisit || b.privateVisit),
      phone: hasUsefulPhone(preferred.phone) ? preferred.phone : (hasUsefulPhone(fallback.phone) ? fallback.phone : ""),
      address: preferred.address || fallback.address || "",
      mapsQuery: preferred.mapsQuery || fallback.mapsQuery || "",
      reviews: (Array.isArray(preferred.reviews) && preferred.reviews.length) ? preferred.reviews : (fallback.reviews || [])
    };
  };

  data.forEach((d)=>{
    const normalizedName = normalizeFacilityLabel(d.name, d.city);
    const row = { ...d, name: normalizedName };
    const key = `${normalize(row.name)}__${normalize(row.city)}__${normalize(row.specialization)}`;

    if(!bestByKey.has(key)){
      bestByKey.set(key, row);
      return;
    }

    bestByKey.set(key, mergeDoctor(bestByKey.get(key), row));
  });

  return [...bestByKey.values()];
}

doctors = doctors.map((d)=>({
  ...d,
  name: normalizeFacilityLabel(d.name, d.city)
}));
doctors = ensureCoverageFromBlueprint(doctors, cityCoverageBlueprint);
doctors = dedupeDoctorsData(doctors);

/* =========================
 DISTANCE (Haversine)
========================= */

function distance(a,b){
if(!a || !b) return 9999;

const R = 6371;
const dLat = (b.lat-a.lat)*Math.PI/180;
const dLon = (b.lon-a.lon)*Math.PI/180;

const x =
Math.sin(dLat/2)**2 +
Math.cos(a.lat*Math.PI/180)*
Math.cos(b.lat*Math.PI/180)*
Math.sin(dLon/2)**2;

return R * 2 * Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

/* =========================
 UI HOME
========================= */

function home(){
app.innerHTML=`
<div class="glass-panel border border-white/70 p-3 sm:p-6 sm:rounded-3xl shadow-[0_20px_64px_-32px_rgba(15,23,42,.35)]">

<div class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-blue-900 to-cyan-700 p-5 sm:p-8 mb-5">
<div class="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10"></div>
<div class="absolute -left-10 -bottom-10 w-36 h-36 rounded-full bg-cyan-200/20"></div>
<div class="absolute right-8 bottom-6 hidden lg:block text-7xl text-white/15 font-black select-none">OPOLSKIE</div>
<h1 class="relative text-2xl sm:text-4xl font-extrabold text-white leading-tight">
Znajdź lekarza i placówkę w Wojewódstwie Opolskim
</h1>
<p class="relative text-sm sm:text-base text-blue-100 mt-2 max-w-2xl">
Jedna wyszukiwarka, która łączy specjalizacje, numery telefonu i szybki dojazd do placówki.
</p>
<div class="relative mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
<span class="px-3 py-1 rounded-full bg-white/15 text-blue-50 border border-white/20">Aktualizowane dane</span>
<span class="px-3 py-1 rounded-full bg-white/15 text-blue-50 border border-white/20">NFZ i prywatnie</span>
<span class="px-3 py-1 rounded-full bg-white/15 text-blue-50 border border-white/20">Najważniejsze miasta regionu</span>
</div>
</div>

<div class="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
<p class="text-sm text-amber-900">
Widzisz błąd w danych placówki? Zgłoś to jednym kliknięciem.
</p>
<button onclick="openBugReport()" class="h-10 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold shadow-sm">
Zgłoś błąd
</button>
</div>

<section class="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
<article class="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
<p class="text-xs uppercase tracking-wide font-semibold text-slate-500">Szybkie wyszukiwanie</p>
<p class="mt-1 text-sm text-slate-700">Wpisz specjalizację, wybierz miasto i od razu sprawdź dostępne placówki.</p>
</article>
<article class="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
<p class="text-xs uppercase tracking-wide font-semibold text-slate-500">Kontakt i dojazd</p>
<p class="mt-1 text-sm text-slate-700">Każdy wynik ma telefon i przycisk mapy prowadzący bezpośrednio do placówki.</p>
</article>
<article class="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
<p class="text-xs uppercase tracking-wide font-semibold text-slate-500">Opolskie lokalnie</p>
<p class="mt-1 text-sm text-slate-700">Serwis skupia się na województwie opolskim, więc wyniki są konkretne i lokalne.</p>
</article>
</section>

<div id="specButtons"
class="flex gap-2 overflow-x-auto pb-3 mb-4 sm:mb-5 [scrollbar-width:thin]">
</div>

<div class="mb-5">
<div class="-mx-1 px-1">
<div class="rounded-2xl border border-slate-200/90 bg-white/95 p-3 sm:p-4 shadow-[0_16px_38px_-26px_rgba(15,23,42,.35)] space-y-3">

<!-- GŁÓWNA WYSZUKIWARKA -->
<div class="flex flex-col md:flex-row md:items-end gap-3">

<div class="relative flex-1 min-w-[260px]">
<label for="spec" class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
Specjalizacja
</label>
<input id="spec"
oninput="showSpecSuggestions()"
class="border border-slate-300 bg-white px-3 py-3 rounded-xl w-full text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
placeholder="Jakiego specjalisty szukasz?">

<div id="specSuggestions"
class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow hidden z-10 max-h-40 overflow-auto"></div>
</div>

<div id="cityDropdownWrap" class="relative min-w-[220px]">
<label for="city" class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
Miasto
</label>
<select id="city" class="hidden">
  <option value="">Wszystkie miasta</option>
</select>
<button id="cityDropdownButton" type="button" onclick="toggleCityDropdown()"
class="w-full border border-slate-300 bg-white pl-9 pr-10 py-3 rounded-xl text-sm font-medium text-left text-slate-700 shadow-sm hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400">
Wszystkie miasta
</button>
<span class="pointer-events-none absolute left-3 top-[35px] text-slate-400">📍</span>
<span class="pointer-events-none absolute right-3 top-[35px] text-slate-400">▾</span>

<div id="cityDropdownMenu" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-56 overflow-auto"></div>
</div>

<button id="searchBtn" onclick="search()"
class="btn-primary h-[46px] w-full md:w-auto px-6">
Szukaj
</button>

</div>

<!-- FILTRY -->
<div class="bg-slate-50/80 border border-slate-200 p-3 sm:p-4 rounded-2xl space-y-3">

<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
Filtry wyników
</p>

<div class="flex flex-col lg:flex-row gap-3 lg:items-center">

<select id="visitType"
class="border border-slate-300 bg-white px-3 py-2 rounded-xl text-sm font-medium text-slate-700 shadow-sm">
<option value="all">NFZ + Prywatnie</option>
<option value="nfz">Tylko NFZ</option>
<option value="private">Tylko prywatnie</option>
</select>

<div class="flex flex-wrap gap-2">

<label data-filter-card="sortBest" class="inline-flex items-center gap-2 cursor-pointer bg-white border border-slate-200 hover:border-blue-300 px-3 py-2.5 rounded-xl text-sm transition">
<input type="checkbox" id="sortBest" onchange="syncSortFilterStyles()" class="h-4 w-4 accent-blue-600">
<span class="font-medium text-slate-700">⭐ Najlepiej oceniani</span>
</label>

<label data-filter-card="sortDistance" class="inline-flex items-center gap-2 cursor-pointer bg-white border border-slate-200 hover:border-blue-300 px-3 py-2.5 rounded-xl text-sm transition">
<input type="checkbox" id="sortDistance" onchange="syncSortFilterStyles()" class="h-4 w-4 accent-blue-600">
<span class="font-medium text-slate-700">📍 Najbliżej</span>
</label>

<label data-filter-card="sortPrice" class="inline-flex items-center gap-2 cursor-pointer bg-white border border-slate-200 hover:border-blue-300 px-3 py-2.5 rounded-xl text-sm transition">
<input type="checkbox" id="sortPrice" onchange="syncSortFilterStyles()" class="h-4 w-4 accent-blue-600">
<span class="font-medium text-slate-700">💰 Najtaniej</span>
</label>

</div>
</div>
</div>
</div>
</div>

</div>

<section class="mt-6 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-4 sm:p-5 shadow-[0_14px_34px_-22px_rgba(37,99,235,.45)]">
<div class="flex items-center gap-2 mb-3">
<span class="h-7 w-7 rounded-full bg-blue-100 text-blue-700 inline-flex items-center justify-center text-sm">🔎</span>
<h3 class="text-base sm:text-lg font-semibold text-slate-800">Popularne wyszukiwania w regionie</h3>
</div>

<p class="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-2">Miasta</p>
<div class="flex flex-wrap gap-2">
  <a href="lekarz-opole.html" class="px-3 py-1 rounded-full bg-white border border-slate-200 text-sm text-slate-700 hover:border-blue-300 hover:text-blue-700">Opole</a>
  <a href="lekarz-nysa.html" class="px-3 py-1 rounded-full bg-white border border-slate-200 text-sm text-slate-700 hover:border-blue-300 hover:text-blue-700">Nysa</a>
  <a href="lekarz-brzeg.html" class="px-3 py-1 rounded-full bg-white border border-slate-200 text-sm text-slate-700 hover:border-blue-300 hover:text-blue-700">Brzeg</a>
  <a href="lekarz-kedzierzyn-kozle.html" class="px-3 py-1 rounded-full bg-white border border-slate-200 text-sm text-slate-700 hover:border-blue-300 hover:text-blue-700">Kędzierzyn-Koźle</a>
  <a href="lekarz-kluczbork.html" class="px-3 py-1 rounded-full bg-white border border-slate-200 text-sm text-slate-700 hover:border-blue-300 hover:text-blue-700">Kluczbork</a>
  <a href="lekarz-prudnik.html" class="px-3 py-1 rounded-full bg-white border border-slate-200 text-sm text-slate-700 hover:border-blue-300 hover:text-blue-700">Prudnik</a>
  <a href="lekarz-glubczyce.html" class="px-3 py-1 rounded-full bg-white border border-slate-200 text-sm text-slate-700 hover:border-blue-300 hover:text-blue-700">Głubczyce</a>
  <a href="lekarz-namyslow.html" class="px-3 py-1 rounded-full bg-white border border-slate-200 text-sm text-slate-700 hover:border-blue-300 hover:text-blue-700">Namysłów</a>
  <a href="lekarz-strzelce-opolskie.html" class="px-3 py-1 rounded-full bg-white border border-slate-200 text-sm text-slate-700 hover:border-blue-300 hover:text-blue-700">Strzelce Opolskie</a>
  <a href="lekarz-krapkowice.html" class="px-3 py-1 rounded-full bg-white border border-slate-200 text-sm text-slate-700 hover:border-blue-300 hover:text-blue-700">Krapkowice</a>
  <a href="lekarz-olesno.html" class="px-3 py-1 rounded-full bg-white border border-slate-200 text-sm text-slate-700 hover:border-blue-300 hover:text-blue-700">Olesno</a>
</div>

<p class="text-xs uppercase tracking-wide font-semibold text-slate-500 mt-4 mb-2">Frazy</p>
<div class="flex flex-wrap gap-2">
  <span class="px-3 py-1 rounded-full bg-blue-600 text-white text-sm">Lekarz Opole</span>
  <span class="px-3 py-1 rounded-full bg-blue-600 text-white text-sm">Lekarz Nysa</span>
  <span class="px-3 py-1 rounded-full bg-blue-600 text-white text-sm">Lekarz Brzeg</span>
  <span class="px-3 py-1 rounded-full bg-blue-600 text-white text-sm">Przychodnia Opole</span>
  <span class="px-3 py-1 rounded-full bg-blue-600 text-white text-sm">Przychodnia Nysa</span>
  <span class="px-3 py-1 rounded-full bg-blue-600 text-white text-sm">Przychodnia Kędzierzyn-Koźle</span>
</div>
<div class="mt-4 flex flex-wrap gap-2">
  <a href="miasta-opolskie.html" class="btn-secondary text-sm">Zobacz wszystkie miasta</a>
  <a href="specjalizacje-opolskie.html" class="btn-secondary text-sm">Zobacz specjalizacje</a>
  <a href="poradnik-zdrowia.html" class="btn-secondary text-sm">Czytaj poradnik zdrowia</a>
</div>
</section>

<section class="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-3">
<article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
<p class="text-xs uppercase tracking-wide font-semibold text-slate-500">Jak działa serwis</p>
<h3 class="mt-1 text-base font-bold text-slate-900">3 proste kroki</h3>
<ol class="mt-2 text-sm text-slate-700 space-y-1.5">
<li><span class="font-semibold">1.</span> Wybierz specjalizację i miasto.</li>
<li><span class="font-semibold">2.</span> Ustaw filtry (NFZ, prywatnie, ocena, cena).</li>
<li><span class="font-semibold">3.</span> Otwórz placówkę i przejdź do telefonu lub mapy.</li>
</ol>
</article>
<article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
<p class="text-xs uppercase tracking-wide font-semibold text-slate-500">Skąd dane</p>
<h3 class="mt-1 text-base font-bold text-slate-900">Aktualizacja i wiarygodność</h3>
<p class="mt-2 text-sm text-slate-700">Dane placówek są regularnie uzupełniane i porządkowane na podstawie publicznych informacji lokalnych. Przy każdej zmianie zgłoszonej przez użytkowników wykonujemy ręczną korektę.</p>
<p class="mt-2 text-xs text-slate-500">Przed wizytą zawsze potwierdź numer telefonu i adres.</p>
</article>
<article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
<p class="text-xs uppercase tracking-wide font-semibold text-slate-500">FAQ</p>
<h3 class="mt-1 text-base font-bold text-slate-900">Najczęstsze pytania</h3>
<div class="mt-2 space-y-2 text-sm text-slate-700">
<p><span class="font-semibold">Czy serwis jest darmowy?</span> Tak, wyszukiwanie placówek jest bezpłatne.</p>
<p><span class="font-semibold">Czy pokazujecie NFZ i prywatnie?</span> Tak, możesz filtrować oba typy wizyt.</p>
<p><span class="font-semibold">Jak zgłosić błąd?</span> Kliknij przycisk „Zgłoś błąd”.</p>
</div>
</article>
</section>

<div id="resultsTitle" class="mt-6 text-2xl font-extrabold tracking-tight text-slate-900"></div>
<div id="resultsInfo" class="mt-1 text-base font-semibold text-slate-700"></div>
<div id="results" class="mt-3"></div>
`;
}

/* =========================
 SEARCH ENGINE
========================= */
async function getGeoFromPostal(postalCode){

  const url =
  `https://nominatim.openstreetmap.org/search?postalcode=${postalCode}&country=Poland&format=json`;

  const res = await fetch(url);
  const data = await res.json();

  if(!data.length) return null;

  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon)
  };
}
function normalize(txt){
return txt
.toLowerCase()
.normalize("NFD")
.replace(/[\u0300-\u036f]/g,"")
.replace(/[^a-z0-9]/g,"");
}
function normalizeCity(txt){
  return txt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"") // usuwa polskie znaki
    .replace(/[^a-z0-9\-]/g,"");     // zostawia tylko litery, cyfry i myślniki
}
function normalizePhoneForTel(phone){
  return String(phone || "").replace(/[^\d+]/g,"");
}
function formatRating(value){
  const num = Number(value);
  if(!Number.isFinite(num)) return "-";
  return num.toFixed(1);
}
function withSearchContext(results, specNorm, exactSpec = false){
  if(!specNorm) return results;

  const mapped = [];
  results.forEach((item)=>{
    const facilityKey = item.__facilityKey || `${item.name}__${item.city}`;
    const variants = doctorsByFacility.get(facilityKey) || [];
    let matched = null;

    if(exactSpec){
      matched = variants.find((v)=>(v._specNorm || "") === specNorm) || null;
    }
    if(!matched){
      matched = variants.find((v)=>(v._specNorm || "").includes(specNorm)) || null;
    }
    if(!matched) return;

    mapped.push({
      ...item,
      specialization: matched.specialization || item.specialization,
      rating: Number(matched.rating ?? item.rating),
      price: matched.price ?? item.price,
      reviews: (Array.isArray(matched.reviews) && matched.reviews.length) ? matched.reviews : item.reviews
    });
  });

  return mapped;
}
function buildDoctorIndexes(){
  doctorsById = new Map();
  doctorsByFacility = new Map();
  facilityRecords = [];
  facilityById = new Map();
  searchCache = new Map();
  specializationList = [...new Set(doctors.map(d => d.specialization))].sort((a,b)=>a.localeCompare(b,"pl"));
  specializationNormSet = new Set(specializationList.map((s)=>normalize(s)));

  doctors = doctors.map((doctor)=>{
    const enriched = {
      ...doctor,
      _specNorm: normalize(doctor.specialization || doctor.spec || doctor.speciality || ""),
      _cityNorm: normalize(doctor.city || ""),
      __facilityKey: `${doctor.name}__${doctor.city}`
    };

    doctorsById.set(Number(enriched.id), enriched);

    const facilityKey = enriched.__facilityKey;
    if(!doctorsByFacility.has(facilityKey)){
      doctorsByFacility.set(facilityKey, []);
    }
    doctorsByFacility.get(facilityKey).push(enriched);

    return enriched;
  });

  const pickBestDoctor = (list)=>{
    return [...list].sort((a,b)=>{
      const scoreA = (a.rating || 0) + (a.featured ? 0.35 : 0) + (a.phone ? 0.25 : 0) + (a.address ? 0.2 : 0);
      const scoreB = (b.rating || 0) + (b.featured ? 0.35 : 0) + (b.phone ? 0.25 : 0) + (b.address ? 0.2 : 0);
      return scoreB - scoreA;
    })[0];
  };

  doctorsByFacility.forEach((list, facilityKey)=>{
    if(!list.length) return;
    const best = pickBestDoctor(list);
    const specs = [...new Set(list.map((d)=>d.specialization).filter(Boolean))];
    const specNormJoined = `|${specs.map((s)=>normalize(s)).join("|")}|`;
    const city = best.city || "";
    const name = best.name || "";

    const record = {
      ...best,
      name,
      city,
      __facilityKey: facilityKey,
      nfz: list.some((d)=>Boolean(d.nfz)),
      privateVisit: list.some((d)=>Boolean(d.privateVisit)),
      price: list.reduce((acc, d)=>{
        if(d.price == null) return acc;
        return acc == null ? d.price : Math.min(acc, d.price);
      }, null),
      rating: Number((list.reduce((acc,d)=>acc + Number(d.rating || 0), 0) / list.length).toFixed(1)),
      reviews: best.reviews || [],
      _specNormList: specNormJoined
    };
    facilityRecords.push(record);
    facilityById.set(Number(record.id), record);
  });

  if(searchWorker){
    searchWorker.terminate();
    searchWorker = null;
  }
  searchWorkerReadyPromise = null;
  searchWorkerPending.clear();
}
function nextFrame(){
  return new Promise((resolve)=>requestAnimationFrame(()=>resolve()));
}
function initSearchWorker(){
  if(!("Worker" in window)) return Promise.resolve(false);
  if(searchWorkerReadyPromise) return searchWorkerReadyPromise;

  searchWorkerReadyPromise = new Promise((resolve)=>{
    let settled = false;
    const finish = (ok)=>{
      if(settled) return;
      settled = true;
      resolve(ok);
    };

    try{
      searchWorker = new Worker("assets/search-worker.js");
    }
    catch(e){
      finish(false);
      return;
    }

    searchWorker.onmessage = (event)=>{
      const msg = event.data || {};

      if(msg.type === "ready"){
        finish(true);
        return;
      }

      if(msg.type === "result"){
        const pending = searchWorkerPending.get(msg.requestId);
        if(!pending) return;
        searchWorkerPending.delete(msg.requestId);
        pending.resolve(msg);
      }
    };

    searchWorker.onerror = ()=>{
      finish(false);
    };

    const slimRecords = facilityRecords.map((d)=>({
      id: Number(d.id),
      specNormList: d._specNormList || "",
      cityNorm: d._cityNorm || "",
      nfz: Boolean(d.nfz),
      privateVisit: Boolean(d.privateVisit),
      rating: Number(d.rating || 0),
      distance: d.distance ?? null,
      price: d.price ?? null
    }));

    searchWorker.postMessage({ type: "init", records: slimRecords });
    setTimeout(()=>finish(false), 2200);
  });

  return searchWorkerReadyPromise;
}
async function searchWithWorker(params){
  const ready = await initSearchWorker();
  if(!ready || !searchWorker) return null;

  return await new Promise((resolve)=>{
    const requestId = ++searchWorkerRequestSeq;
    searchWorkerPending.set(requestId, { resolve });
    searchWorker.postMessage({ type: "search", requestId, ...params });

    setTimeout(()=>{
      const pending = searchWorkerPending.get(requestId);
      if(!pending) return;
      searchWorkerPending.delete(requestId);
      resolve(null);
    }, 4200);
  });
}
function setSearchBusy(isBusy){
  const searchBtn = document.getElementById("searchBtn");
  if(!searchBtn) return;
  if(isBusy){
    searchBtn.disabled = true;
    searchBtn.classList.add("opacity-70","cursor-not-allowed");
    searchBtn.textContent = "Szukam...";
  }
  else{
    searchBtn.disabled = false;
    searchBtn.classList.remove("opacity-70","cursor-not-allowed");
    searchBtn.textContent = "Szukaj";
  }
}
function buildMapsQuery(item){
  const rawQuery =
    item.mapsQuery ||
    item.address ||
    [item.street, item.postal, item.city, item.name].filter(Boolean).join(", ") ||
    [item.name, item.city].filter(Boolean).join(", ");

  return encodeURIComponent(rawQuery || "Opolskie");
}
function getMapsSearchLink(item){
  const latLon =
    (item.lat != null && item.lon != null)
      ? `${item.lat},${item.lon}`
      : null;

  const query = latLon ? encodeURIComponent(latLon) : buildMapsQuery(item);

  if(item.placeId){
    return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${encodeURIComponent(item.placeId)}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
function trackGaEvent(eventName, params = {}){
  if(typeof gtag !== "function") return;
  gtag("event", eventName, params);
}
function safeDecodeURIComponent(value){
  try{
    return decodeURIComponent(String(value || ""));
  }
  catch(e){
    return String(value || "");
  }
}
function trackPhoneClick(source, facilityNameEncoded, cityEncoded){
  trackGaEvent("click_phone", {
    source: source || "unknown",
    facility_name: safeDecodeURIComponent(facilityNameEncoded),
    city: safeDecodeURIComponent(cityEncoded)
  });
}
function trackMapsClick(source, facilityNameEncoded, cityEncoded){
  trackGaEvent("click_maps", {
    source: source || "unknown",
    facility_name: safeDecodeURIComponent(facilityNameEncoded),
    city: safeDecodeURIComponent(cityEncoded)
  });
}
function syncSortFilterStyles(){
  const ids = ["sortBest","sortDistance","sortPrice"];
  ids.forEach((id)=>{
    const input = document.getElementById(id);
    if(!input) return;
    const card = document.querySelector(`[data-filter-card="${id}"]`);
    if(!card) return;
    if(input.checked){
      card.classList.add("bg-blue-50","border-blue-400","text-blue-800","shadow-sm");
      card.classList.remove("bg-white","border-slate-200","text-slate-700");
    }
    else{
      card.classList.remove("bg-blue-50","border-blue-400","text-blue-800","shadow-sm");
      card.classList.add("bg-white","border-slate-200","text-slate-700");
    }
  });
}
function toggleCityDropdown(){
  const menu = document.getElementById("cityDropdownMenu");
  if(!menu) return;
  menu.classList.toggle("hidden");
}
function getCityListFromDoctors(){
  const opolskieCoreCities = [
    "Opole",
    "Kędzierzyn-Koźle",
    "Nysa",
    "Brzeg",
    "Kluczbork",
    "Prudnik",
    "Głubczyce",
    "Namysłów",
    "Strzelce Opolskie",
    "Krapkowice",
    "Olesno"
  ];
  return [...new Set([...opolskieCoreCities, ...doctors.map(d => d.city).filter(Boolean)])]
    .sort((a,b)=>a.localeCompare(b,"pl"));
}
function populateCityDropdown(){
  const cityInput = document.getElementById("city");
  const menu = document.getElementById("cityDropdownMenu");
  if(!cityInput || !menu) return;

  cityInput.innerHTML = `<option value="">Wszystkie miasta</option>`;
  const cities = getCityListFromDoctors();
  cities.forEach((city)=>{
    const option = document.createElement("option");
    option.value = city;
    option.textContent = city;
    cityInput.appendChild(option);
  });

  menu.innerHTML =
    `<button type="button" onclick="chooseCity('', 'Wszystkie miasta')" class="block w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50">Wszystkie miasta</button>` +
    cities.map((city)=>{
      const safe = city.replace(/'/g,"\\'");
      return `<button type="button" onclick="chooseCity('${safe}', '${safe}')" class="block w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50">${city}</button>`;
    }).join("");
}
function chooseCity(value,label){
  const cityInput = document.getElementById("city");
  const button = document.getElementById("cityDropdownButton");
  const menu = document.getElementById("cityDropdownMenu");
  if(!cityInput || !button || !menu) return;
  cityInput.value = value;
  button.textContent = label;
  menu.classList.add("hidden");
}
function initCityDropdown(){
  const cityInput = document.getElementById("city");
  const button = document.getElementById("cityDropdownButton");
  if(cityInput && button){
    const selected = cityInput.options[cityInput.selectedIndex];
    button.textContent = selected ? selected.textContent : "Wszystkie miasta";
  }
  document.addEventListener("click",(event)=>{
    const wrap = document.getElementById("cityDropdownWrap");
    const menu = document.getElementById("cityDropdownMenu");
    if(!wrap || !menu) return;
    if(!wrap.contains(event.target)){
      menu.classList.add("hidden");
    }
  });
}

function buildResultCard(d,index){
  let mapsLink = getMapsSearchLink(d);
  let phoneText = (d.phone || "").trim();
  let telPhone = normalizePhoneForTel(phoneText);
  let facilityNameEncoded = encodeURIComponent(String(d.name || ""));
  let cityEncoded = encodeURIComponent(String(d.city || ""));
  let phoneHtml = telPhone
  ? `<a href="tel:${telPhone}" onclick="event.stopPropagation(); trackPhoneClick('result_card','${facilityNameEncoded}','${cityEncoded}')" class="text-blue-700 hover:underline">📞 ${phoneText}</a>`
  : `📞 Brak numeru`;
  let mapAction = `<a href="${mapsLink}" target="_blank" onclick="event.stopPropagation(); trackMapsClick('result_card','${facilityNameEncoded}','${cityEncoded}')"
  class="btn-primary text-sm w-full">
  Mapa
  </a>`;

  let visitBadge = "";
  if(d.nfz && d.privateVisit)
    visitBadge = `<span class="badge badge-nfz-private">NFZ + Prywatnie</span>`;
  else if(d.nfz)
    visitBadge = `<span class="badge badge-nfz">NFZ</span>`;
  else
    visitBadge = `<span class="badge badge-private">Prywatnie</span>`;

  let rank = "";
  if(index === 0) rank = "🥇 Najlepszy wybór";
  else if(index === 1) rank = "🥈 Popularny";
  else if(index === 2) rank = "🥉 Polecany";

  return `
  <div onclick="openFacilityById(${Number(d.id)})"
  class="result-card result-card-lite">
  <div class="result-main">
  <div class="result-text">

  <div class="result-head">
  ${visitBadge}
  ${rank ? `<span class="badge badge-rank">${rank}</span>` : ""}
  ${d.featured ? `<span class="badge badge-featured">⭐ Polecane</span>` : ""}
  </div>

  <h3 class="result-title">
  ${d.name}
  </h3>

  <p class="result-sub">
  ${d.specialization} • ${d.city}
  </p>

  <div class="result-meta">
  <span class="meta-pill meta-neutral">
  ⭐ ${formatRating(d.rating)}
  </span>
  ${d.distance ? `
  <span class="meta-pill meta-neutral">
  📍 ${d.distance} km
  </span>` : ""}
  ${d.price != null ?
  `<span class="meta-pill meta-price">
  💰 od ${d.price} zł
  </span>` : ""}
  </div>

  <p class="result-quote">
  "${d.reviews?.[0] || 'Brak opinii'}"
  </p>

  <p class="result-phone">
  ${phoneHtml}
  </p>
  </div>

  <div class="result-actions">
  ${mapAction}

  <button onclick="event.stopPropagation(); openFacilityById(${Number(d.id)})" class="btn-secondary text-sm w-full">
  Zobacz placówkę
  </button>

  </div>
  </div>
  </div>
  `;
}

async function renderResultsBatch(reset = false){
  const resultsDiv = document.getElementById("results");
  const resultsInfo = document.getElementById("resultsInfo");
  if(!resultsDiv) return;

  let cardsHost = document.getElementById("resultsCards");
  let moreHost = document.getElementById("resultsMore");

  if(reset){
    renderedResultsCount = 0;
    resultsDiv.innerHTML = `<div id="resultsCards"></div><div id="resultsMore"></div>`;
    cardsHost = document.getElementById("resultsCards");
    moreHost = document.getElementById("resultsMore");
  }

  if(!cardsHost || !moreHost) return;

  const previousCount = renderedResultsCount;
  const nextCount = Math.min(
    renderedResultsCount + RESULTS_BATCH_SIZE,
    lastSearchResults.length
  );
  const chunk = lastSearchResults.slice(previousCount,nextCount);
  renderedResultsCount = nextCount;

  if(resultsInfo){
    const baseInfo = resultsInfo.innerHTML;
    const cleanBaseInfo = baseInfo.replace(/<span class="text-slate-500 text-sm">[\s\S]*?<\/span>/g,"").trim();
    if(lastSearchResults.length > RESULTS_BATCH_SIZE){
      resultsInfo.innerHTML = `${cleanBaseInfo} <span class="text-slate-500 text-sm">(pokazano ${renderedResultsCount} z ${lastSearchResults.length})</span>`;
    }
    else{
      resultsInfo.innerHTML = cleanBaseInfo;
    }
  }

  let moreButton = "";
  if(renderedResultsCount < lastSearchResults.length){
    moreButton = `
    <div class="mt-3 flex justify-center">
      <button type="button" onclick="renderResultsBatch(false)" class="btn-secondary text-sm">
        Pokaż więcej (${lastSearchResults.length - renderedResultsCount} pozostało)
      </button>
    </div>`;
  }

  for(let i = 0; i < chunk.length; i += 4){
    const part = chunk
      .slice(i, i + 4)
      .map((d,index)=>buildResultCard(d, previousCount + i + index))
      .join("");
    cardsHost.insertAdjacentHTML("beforeend", part);
    await nextFrame();
  }
  moreHost.innerHTML = moreButton;
}

async function search(){
const runId = ++activeSearchRunId;
setSearchBusy(true);
try{

const resultsDiv = document.getElementById("results");
const resultsInfo = document.getElementById("resultsInfo");
const resultsTitle = document.getElementById("resultsTitle");
const specVal = document.getElementById("spec").value.trim().toLowerCase();
const specNorm = normalize(specVal);
const exactSpec = specializationNormSet.has(specNorm);
const cityVal = normalize(document.getElementById("city").value);
const visit = document.getElementById("visitType").value;
const sortBest = document.getElementById("sortBest").checked;
const sortDistance = document.getElementById("sortDistance").checked;
const sortPrice = document.getElementById("sortPrice").checked;
const cacheKey = `${specNorm}__${cityVal}__${visit}__${sortBest ? 1 : 0}${sortDistance ? 1 : 0}${sortPrice ? 1 : 0}`;

if(!specNorm && !cityVal){
  resultsTitle.innerHTML = "Wyszukaj lekarza";
  resultsInfo.innerHTML = "";
  resultsDiv.innerHTML = `
  <div class="bg-red-50 border border-red-200 rounded-xl p-5 text-center shadow-sm">
  <p class="text-base font-semibold text-red-700">Wybierz specjalizację.</p>
  </div>
  `;
  resultsDiv.scrollIntoView({ behavior: "smooth", block: "start" });
  return;
}

resultsDiv.innerHTML = `
<div class="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
  <p class="text-base font-semibold text-slate-800 mb-1">Trwa wyszukiwanie...</p>
  <p class="text-sm text-slate-500">Przy dużej liczbie danych może to potrwać chwilę.</p>
</div>`;

if(searchCache.has(cacheKey)){
  if(runId !== activeSearchRunId) return;
  lastSearchResults = withSearchContext(searchCache.get(cacheKey), specNorm, exactSpec);
}
else{
  const workerResult = await searchWithWorker({
    specNorm,
    exactSpec,
    cityNorm: cityVal,
    visit,
    sortBest,
    sortDistance,
    sortPrice
  });
  if(runId !== activeSearchRunId) return;

  if(workerResult && Array.isArray(workerResult.ids)){
    lastSearchResults = workerResult.ids
      .map((id)=>facilityById.get(Number(id)))
      .filter(Boolean);
    lastSearchResults = withSearchContext(lastSearchResults, specNorm, exactSpec);
  }
  else{
    const results = [];
    for(let i = 0; i < facilityRecords.length; i++){
      const d = facilityRecords[i];
      if(specNorm){
        const list = d._specNormList || "";
        if(exactSpec){
          if(!list.includes(`|${specNorm}|`)) continue;
        }
        else if(!list.includes(specNorm)) continue;
      }
      if(visit === "nfz" && !d.nfz) continue;
      if(visit === "private" && !d.privateVisit) continue;
      if(cityVal && d._cityNorm !== cityVal) continue;
      results.push(d);
      if(i % 150 === 0){
        await nextFrame();
      }
    }

    results.sort((a,b)=>{
      let scoreA = 0;
      let scoreB = 0;
      if(sortBest){
        scoreA += a.rating || 0;
        scoreB += b.rating || 0;
      }
      if(sortDistance){
        scoreA -= Number(a.distance ?? 9999);
        scoreB -= Number(b.distance ?? 9999);
      }
      if(sortPrice){
        scoreA -= (a.price ?? 9999);
        scoreB -= (b.price ?? 9999);
      }
      return scoreB - scoreA;
    });
    lastSearchResults = withSearchContext(results, specNorm, exactSpec);
  }

  searchCache.set(cacheKey, lastSearchResults);
}

if(runId !== activeSearchRunId) return;

const specName = specVal ? specVal : "lekarze";
let visitLabel = "";
if(visit === "nfz") visitLabel = " NFZ";
else if(visit === "private") visitLabel = " prywatnie";
resultsTitle.innerHTML = `Najlepsi ${specName}${visitLabel}`;

const nfzCount = lastSearchResults.filter(d => d.nfz).length;
const privateCount = lastSearchResults.filter(d => d.privateVisit).length;
if(visit === "nfz"){
  resultsInfo.innerHTML = `Znaleziono <b>${nfzCount}</b> placówek NFZ`;
}
else if(visit === "private"){
  resultsInfo.innerHTML = `Znaleziono <b>${privateCount}</b> wizyt prywatnych`;
}
else{
  resultsInfo.innerHTML = `Znaleziono <b>${lastSearchResults.length}</b> lekarzy (NFZ + prywatnie)`;
}

if(!lastSearchResults.length){
  renderedResultsCount = 0;
  resultsDiv.innerHTML = `
  <div class="bg-white border border-slate-200 rounded-xl p-7 text-center shadow-sm">
  <p class="text-lg font-semibold text-slate-800 mb-1">Brak wyników dla wybranych filtrów</p>
  <p class="text-sm text-slate-500">Spróbuj wybrać inne miasto, specjalizację albo odznaczyć część filtrów.</p>
  </div>
  `;
  return;
}

await renderResultsBatch(true);
}
finally{
  if(runId === activeSearchRunId){
    setSearchBusy(false);
  }
}
}
/* =========================
 SPECJALIZACJE AUTO
========================= */
function getSpecializations(){
  return specializationList;
}

function renderSpecButtons(){

const box = document.getElementById("specButtons");

box.innerHTML = getSpecializations().map(spec=>`
<button
onclick="selectSpec('${spec}')"
class="whitespace-nowrap bg-white/90 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition px-4 py-2.5 rounded-full text-slate-700 font-medium shadow-sm min-h-[42px]">
${spec}
</button>
`).join("");

}
function selectSpec(spec){
document.getElementById("spec").value = spec;
search();
}

/* =========================
 AUTOCOMPLETE
========================= */

function showSpecSuggestions(){

const input = document.getElementById("spec").value.toLowerCase();
const box = document.getElementById("specSuggestions");

if(!input){
  box.classList.add("hidden");
  return;
}

const matches = getSpecializations()
.filter(s=>s.toLowerCase().startsWith(input));

box.innerHTML = matches.map(s=>`
<div onclick="chooseSuggestion('${s}')"
class="px-3 py-2.5 hover:bg-gray-100 cursor-pointer text-sm">
${s}
</div>
`).join("");

box.classList.remove("hidden");
}

function chooseSuggestion(spec){
  document.getElementById("spec").value = spec;
  document.getElementById("specSuggestions").classList.add("hidden");
  search();
}
function openFacilityById(facilityId){
const numericId = Number(facilityId);
if(Number.isNaN(numericId)) return;
const base = doctorsById.get(numericId);
if(!base) return;
openFacility(base.__facilityKey || `${base.name}__${base.city}`);
}

function openFacility(facilityKey){

const box = document.getElementById("modalRoot");

/* wszystkie wpisy tej placówki */
const facilityDoctors = doctorsByFacility.get(facilityKey) || [];
if(!facilityDoctors.length){
  box.innerHTML = "";
  return;
}

/* unikalne specjalizacje */
const specs =
  [...new Set(facilityDoctors.map(d => d.specialization))];

/* opinie */
const reviews =
  facilityDoctors.flatMap(d => d.reviews).slice(0,5);

const main = facilityDoctors[0];
const name = main.name;
const phone = main.phone;
const city = main.city;
const mapsLink = getMapsSearchLink(main);
const telPhone = normalizePhoneForTel(phone);
const facilityNameEncoded = encodeURIComponent(String(name || ""));
const cityEncoded = encodeURIComponent(String(city || ""));
const phoneHtml = telPhone
  ? `<a href="tel:${telPhone}" onclick="trackPhoneClick('facility_modal','${facilityNameEncoded}','${cityEncoded}')" class="text-blue-700 hover:underline">📞 ${phone}</a>`
  : "📞 Brak numeru";

trackGaEvent("open_facility", {
  source: "results",
  facility_name: name || "",
  city: city || ""
});

if(document.body){
  document.body.style.overflow = "hidden";
}

box.innerHTML = `
<div onclick="closeFacility()" class="fixed inset-0 bg-slate-900/65 p-2 sm:p-6 flex items-start sm:items-center justify-center overflow-y-auto" style="z-index:1000;">

<div onclick="event.stopPropagation()" class="bg-white rounded-3xl shadow-2xl overflow-y-auto relative border border-slate-200 w-full max-w-3xl max-h-[92vh] mt-2 sm:mt-0" style="width:min(960px,calc(100vw - 16px));max-height:92vh;">

<div class="sticky top-0 z-20 flex justify-end p-2 bg-white/95 backdrop-blur border-b border-slate-200">
<button onclick="closeFacility()"
class="h-11 w-11 inline-flex items-center justify-center rounded-full bg-white text-slate-700 hover:bg-slate-100 shadow border border-slate-200 font-bold">✕</button>
</div>

<div class="bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-700 p-5 sm:p-6">
<p class="text-xs uppercase tracking-wide font-semibold text-blue-200 mb-1">Placówka medyczna</p>
<h2 class="text-2xl sm:text-3xl font-bold text-white leading-tight">
${name}
</h2>
<p class="text-blue-100 mt-2">📍 ${city}</p>
</div>

<div class="p-4 sm:p-6 space-y-5">

<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
<div class="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-2xl p-4 shadow-sm">
<div class="flex items-center gap-2 mb-2">
<span class="h-7 w-7 rounded-full bg-blue-100 text-blue-700 inline-flex items-center justify-center text-sm">📞</span>
<p class="text-xs uppercase tracking-wide font-semibold text-blue-700">Kontakt</p>
</div>
<p class="text-slate-800 text-lg font-semibold leading-tight">${phoneHtml}</p>
<p class="text-xs text-slate-500 mt-2">Kliknij numer, aby od razu zadzwonić.</p>
</div>
<div class="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-2xl p-4 shadow-sm">
<div class="flex items-center gap-2 mb-2">
<span class="h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center text-sm">📍</span>
<p class="text-xs uppercase tracking-wide font-semibold text-emerald-700">Lokalizacja</p>
</div>
<p class="text-sm text-slate-700 mb-3">Otwórz dokładny punkt placówki w mapach.</p>
<a target="_blank"
href="${mapsLink}"
onclick="trackMapsClick('facility_modal','${facilityNameEncoded}','${cityEncoded}')"
class="w-full inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition">
🗺️ Otwórz w Google Maps
</a>
</div>
</div>

<div>
<h3 class="text-sm uppercase tracking-wide font-semibold text-slate-500 mb-2">Dostępne specjalizacje</h3>
<div class="flex flex-wrap gap-2">
${specs.map(s=>`
<span class="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-sm font-medium">
${s}
</span>`).join("")}
</div>
</div>

<div>
<h3 class="text-sm uppercase tracking-wide font-semibold text-slate-500 mb-2">Opinie pacjentów</h3>
<div class="space-y-2">
${reviews.map(r=>`
<div class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">
"${r}"
</div>`).join("")}
</div>
</div>

</div>
</div>
</div>
`;
}

function handleModalEsc(event){
  if(event.key === "Escape"){
    if(TRIAGE_STATE.open){
      closeTriageAssistant();
      return;
    }
    closeFacility();
  }
}

function closeFacility(){
  const modalRoot = document.getElementById("modalRoot");
  if(modalRoot) modalRoot.innerHTML = "";
  if(document.body){
    document.body.style.overflow = "";
  }
}

/* START */
buildDoctorIndexes();
initSearchWorker();
home();
initTriageAssistant();

setTimeout(()=>{
  populateCityDropdown();
  initCityDropdown();
  renderSpecButtons();
  syncSortFilterStyles();
  document.getElementById("resultsTitle").innerHTML = "Wyszukaj lekarza";
  document.getElementById("resultsInfo").innerHTML = "Uzupełnij filtry i kliknij <b>Szukaj</b>, aby zobaczyć wyniki.";
  document.getElementById("results").innerHTML = `
  <div class="bg-white border border-slate-200 rounded-xl p-7 text-center shadow-sm">
  <p class="text-lg font-semibold text-slate-800 mb-1">Wyniki pojawią się po wyszukaniu</p>
  <p class="text-sm text-slate-500">Możesz wpisać specjalizację albo wybrać miasto i rodzaj wizyty.</p>
  </div>
  `;
},100);

document.addEventListener("keydown", handleModalEsc);


