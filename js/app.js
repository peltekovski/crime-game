/* ============================================================================
 * app.js — UI controller, styled to the classic reference skin.
 *
 * Navigation is a small state machine: pick a LOCATION (only the Tavern works),
 * then a tavern TOOL. Menus switch as you choose. Making drinks is per-click
 * ("Mix the drink."); selling is automatic on the update timer.
 * Event delegation keeps handlers alive across frequent re-renders.
 * ========================================================================== */
(function () {
  "use strict";

  var ui = {
    place: "account",           // 'account' (default home) | 'tavern' | 'house' | 'slum' | 'streets'
    tool: null,                 // null = tavern landing; else a TOOLS id / 'debug'
    houseView: null,            // null = room list; 'craftcabinet' | 'station' | 'finished'
    houseStation: null,         // which work station is open
    slumCounter: null,          // null = counter list; 'craft'
    culSel: "", culLot: null, culNotice: null, culError: null,   // Culinary exchange
    craftSel: "Pieces of leather", craftNotice: null,
    craftItemSel: {}, craftMadeNotice: null, craftLevelUp: null, finishedSel: null, finishedQty: "1",
    anvilSel: "", anvilQty: 1, anvilNotice: null, anvilError: null, anvilLevelUp: null,
    weaponSel: null, weaponQty: "1", bwSel: null, bwQty: "1",
    chemNotice: null, chemError: null, chemLevelUp: null,          // room 2 (Drug lab)
    drugNarc: "", drugJuice: "", drugQty: "84",                    // Drug lab mix selectors
    juicerPlant: "", juicerQty: "50",                             // Juicer
    labJuiceSel: null, labSellQty: "",                            // Laboratory Cabinet
    streetGrams: "", beltSel: null, streetCountry: "Estonia", streetCity: "Sadala",  // Streets
    chemHelpOpen: false, beltBuySel: null,                        // Chemist help popup + Drug belt counter
    buyNarcSel: "", lastMixDrug: null,                            // Streets buy-selection + last drug crafted
    streetNotice: null, streetError: null,                        // street-only notices (kept apart from lab notices)
    gardenTab: "greenhouse",                                      // default tab (per the reference)
    gardenNotice: null, gardenError: null, gardenPtsMsg: null, gardenBackpackBar: false, gardenLevelUp: null,
    gardenErrors: null,         // the "[Become a gardener]" requirement list
    stealPlantSel: "", stealEdibleSel: "", stealMedSel: "", gardenHelpOpen: false,
    medView: "beds", medSeedSel: "", medPackets: "1", medDurSel: "", medHelpOpen: false,   // medicinal beds
    // harbor
    hbTab: "vessel", hbView: "control", hbUpg: null, hbHold: ["", "", ""],
    hbHire: { fishing: null, defense: null }, hbMen: { fishing: "", defense: "" },
    hbNotice: null, hbError: null,
    // canteen (tavern 2nd floor)
    canRoom: null, canLiquid: "", canLiters: "", canDairy: "", canHelpOpen: false, cookBook: null,
    canFish: "", canFruit1: "", canFruit2: "", canCookDairy: "", canHours: "",
    canNotice: null, canError: null, canLevelUp: null,
    // medicine laboratory (house room 5)
    medMachineTab: "use", medMake: "", medMakeQty: 1, medSell: null, medSellQty: null,
    medNotice: null, medError: null, medErrors: null, medLevelUp: null,
    edView: "garden", edSeedSel: "", edCount: "1", edHelpOpen: false,   // edible herb garden
    tavernBuyView: false,                                         // the "buy the tavern?" page
    bankNotice: null, bankError: null,                            // Bank
    casNotice: null, casError: null,                              // Casino
    sportsFac: "trail", sportNotice: null, sportError: null,      // Sports complex
    runHours: 1, runSteroids: false,
    calcOpen: false,            // the Calculator is a floating popup, not a page
    debugOpen: false, dbgSkill: "Barkeeping", dbgTab: "skills",
    q: { tel: 1000, j1: 500 },
    telMat: "", j1Mat: "", mix: {}, calc: {},
    lastUpdate: null, lastMix: {}, mixLevelUp: null,
    /* Seconds to the next update / the next tavern wave. NOT countdowns we own —
     * both are re-read from the wall clock every tick, so reloading the page
     * mid-hour resumes at the right number instead of starting a fresh one. */
    timer: CF.clock.secondsToNext(),
    tavernTimer: CF.clock.tavernSecondsToNext(),
  };
  var skillPopEl = null;
  function hideSkillPop() { if (skillPopEl) skillPopEl.style.display = "none"; }

  /* The tavern's nine pages, in the user's order and under the user's names. */
  var TOOLS = [
    { id: "telephone",   label: "Phone",     desc: "order additional raw materials" },
    { id: "juicer1",     label: "Juicer",    desc: "make raw juice" },
    { id: "readytosell", label: "Drinks",    desc: "make sure there is always something for customers to drink" },
    { id: "kitchen",     label: "Kitchen",   desc: "make tea, coffee, milk, etc.",             station: "Kitchen" },
    { id: "winecellar",  label: "Cellar",    desc: "makes beverages that require aging",       station: "Cellar" },
    { id: "carbonation", label: "Aerator",   desc: "make carbonated drinks",                   station: "Aerator" },
    { id: "distilling",  label: "Distiller", desc: "prepare spirits and spirits-based drinks", station: "Distiller" },
    { id: "cider",       label: "Cider",     desc: "make various ciders",                      station: "Cider" },
    { id: "juicer2",     label: "Blender",   desc: "make ready-to-sell juices and nectars",    station: "Blender" },
  ];
  function tool(id) { for (var i = 0; i < TOOLS.length; i++) if (TOOLS[i].id === id) return TOOLS[i]; return null; }

  /* Where each skill is trained. `act` = we've built it, so the row navigates;
   * otherwise the row just reports where it would lead. */
  var SKILL_PLACE = {
    "Barkeeping":    { where: "the Tavern and Canteen", act: "go-tavern" },
    "Crafting":      { where: "the Crafts room",        act: "house-craft" },
    "Cooking":         { where: "the Canteen", act: "go-canteen" },
    "Fighting":        { where: "the Sports complex" },
    "Weapon handling": { where: "the sewer", act: "go-houses" },
    "Defence":      { where: "the Sports complex", act: "go-sports" },
    "Strength":           { where: "the Gym", act: "go-sports", fac: "gym" },
    "Endurance":      { where: "the Forest Trail", act: "go-sports", fac: "trail" },
    "Speed":           { where: "the Stadium", act: "go-sports", fac: "stadium" },
    "Dexterity":           { where: "the Boxing Hall", act: "go-sports", fac: "boxing" },
    "Gardening":       { where: "the Garden", act: "go-garden" },
    "Stealing":        { where: "the Garden", act: "go-garden" },
    "Chemist":         { where: "the Drug lab", act: "go-druglab" }, "Smithing": { where: "the Blacksmith", act: "go-anvil" },
    "Medical science": { where: "the Packing table", act: "go-medpacking" },
    "Mining":          { where: "Mining" },
  };

  /* Which skill the place you're standing in trains — that row lights up. */
  function activeSkill() {
    if (ui.place === "tavern") return "Barkeeping";
    if (ui.place === "canteen") return "Cooking";
    if (ui.place === "house") {
      if (ui.houseView === "craftcabinet" || ui.houseView === "station" || ui.houseView === "finished") return "Crafting";
      if (ui.houseView === "anvil" || ui.houseView === "anvilupgrade" ||
          ui.houseView === "armory" || ui.houseView === "blackwarehouse") return "Smithing";
      if (ui.houseView === "druglab" || ui.houseView === "chemjuicer" || ui.houseView === "labcabinet") return "Chemist";
      if (ui.houseView === "medmachine" || ui.houseView === "medpacking" ||
          ui.houseView === "medwarehouse") return "Medical science";
    }
    // the street trains Stealing; the sewer under it trains Weapon handling
    if (ui.place === "houses") return CF.houses.inSewer() ? "Weapon handling" : "Stealing";
    if (ui.place === "sports") {
      if (ui.sportsFac === "gym") return "Strength";
      if (ui.sportsFac === "trail") return "Endurance";
      if (ui.sportsFac === "boxing") return "Dexterity";
      if (ui.sportsFac === "stadium") return "Speed";
    }
    return null;
  }

  // third entry = the action that opens it; absent = not built yet
  var LOC_LEFT = [
    ["Bank", "(to settle with cash)", "go-bank"], ["Sports complex", "(work out)", "go-sports"],
    ["Villas and sewer", "(steal)", "go-houses"], ["Tavern and Canteen", "(earn money)", "go-tavern"],
    ["Casino", "(play gambling)", "go-casino"], ["Your house", "(many necessities)", "go-house"],
    ["Racing complex", "", "go-racing"],
  ];
  var LOC_RIGHT = [
    ["Garden", "(horticulture)", "go-garden"], ["Slum", "(market and fighting)", "go-slum"],
    ["Hospital", "(treating patients)", "go-hospital"],
    ["Seaport", "(get fish)", "go-harbor"], ["Mining", ""], ["Streets", "(dealing in drugs)", "go-streets"],
  ];

  /* Your house — rooms and their stations. (Room 4 is absent in the reference,
   * so the numbering gap is preserved.) Placeholders for now. */
  var HOUSE_ROOMS = [
    { n: 0, name: "LIVING SPACES", items: [["Storage", "Your weapons and fuses"]] },
    { n: 1, name: "CRAFTS ROOM", items: [
      ["Armchair", "You can sew comfortably here"],
      ["Woodworking corner", "You can make wooden items here"],
      ["Furnaces", "This is where you melt metal and heat clay"],
      ["Finished Items Cabinet", "Your finished items"],
      ["Craft cabinet", "Materials for making items"]] },
    { n: 2, name: "DRUG LAB", items: [
      ["Juicer", "They make juice from plants there"],
      ["Drug lab", "This is where drugs are produced"],
      ["Laboratory Cabinet", "Your plants and juices are there"]] },
    { n: 3, name: "GARAGE", items: [["Garage", "Manage your cars and spare parts"]] },
    { n: 5, name: "MEDICINE LABORATORY", items: [
      ["Medicine Machine", "Make medicines from plants"],
      ["Packing table", "Prepare medicine packages for sale and use"],
      ["Laboratory warehouse", "Medicinal herbs and finished medicines"]] },
    { n: 6, name: "BLACKSMITH", items: [
      ["Anvil", "Make weapons for your soldiers"],
      ["Armory", "Collect and sell your own weapons"],
      ["Blacksmith Warehouse", "Remaining forged items"]] },
  ];

  /* Slum — the four areas, and the Market's counters (the focus for now). */
  // name + whether access is granted; rendered on two lines (name / Access : YES|NO)
  var SLUM_AREAS = [
    ["Highway", true], ["Betting Bunker", true], ["Parking", false], ["Market", true],
  ];
  var MARKET_COUNTERS = [
    ["Culinary exchange", ["used"]],
    ["Drug belt counter", ["new", "used"]],
    ["Car parts counter", ["new", "used"]],
    ["Craft supplies counter", ["new"]],
    // "for credit" options are omitted — Credits are premium and unused in this build
    ["Bank items counter", ["for money"]],
    ["Chemist's juice counter", ["used"]],
    ["Greenhouse ticket counter", ["new"]],
    ["Medical supplies counter", ["new"]],
    ["Cold weapons counter", ["used"]],
    ["Body armor counter", ["used"]],
    ["Ticket counter", ["new"]],
  ];

  /* ---- helpers ---------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var toastTimer;
  function toast(msg, type) {
    var t = $("toast"); t.textContent = msg;
    t.className = "toast show" + (type === "err" ? " err" : "");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.className = "toast"; }, 3000);
  }
  function act(res) { toast(res.msg, res.ok ? "" : "err"); if (res.ok) CF.autosave(); renderPlace(); renderModal(); }
  function num(id, dflt) { var v = $(id); if (!v) return dflt; var n = parseInt(v.value, 10); return isNaN(n) ? dflt : n; }

  /* ============================ TOP BAR ================================= */

  /* The interface scale in force (see the INTERFACE SCALE block in style.css —
   * it is automatic, by viewport). getBoundingClientRect returns ALREADY-ZOOMED
   * coordinates, so anything positioned from one has to divide this back out. */
  function uiZoom() {
    var z = parseFloat(getComputedStyle(document.body).zoom);
    return z > 0 ? z : 1;
  }

  function renderTop() {
    $("topbar").innerHTML =
      '<div class="logo" data-act="account" title="Account overview">' +
        '<span class="title">Crime&nbsp;Factory</span></div>' +
      // Debug sits first, styled like the rest of the nav; Save/Load/Reset now
      // live in the debug popup's General tab.
      '<div class="topnav">' +
        '<a data-act="debug" class="live" title="Debug tools">🛠 Debug</a>' +
        ["Account overview", "Settings"].map(function (l) {
          return l === "Account overview"
            ? '<a data-act="account" class="live" title="Account overview">' + l + "</a>"
            : '<a title="Coming soon">' + l + "</a>"; }).join("") +
        '<a data-act="help" class="live" title="Game guide">Help</a></div>';

    $("strip").innerHTML = "";   // empty -> hidden by CSS, no dead space
  }

  /* ============================ SIDEBAR ================================= */
  function renderSidebar() {
    hideSkillPop();
    CF.settleUpdates();   // pay any updates that landed while we weren't looking
    var p = CF.state.player, c = CF.ruleset.cosmeticStats;
    function srow(ico, k, v, o) {
      o = o || {};
      // skill rows lead to where that skill is trained; `act` rows go somewhere fixed
      var ds = o.skill ? ' data-skill="' + esc(o.skill) + '" data-act="skill" class="srow clickable' +
        (o.cls ? " " + o.cls : "") + '"'
        : o.act ? ' data-act="' + esc(o.act) + '" class="srow' + (o.cls ? " " + o.cls : "") + '"'
        : ' class="srow' + (o.cls ? " " + o.cls : "") + '"';
      return "<div" + ds + '><span class="ico">' + ico +
        '</span><span class="k">' + k + '</span><span class="v' + (o.vcls ? " " + o.vcls : "") + '">' + v + "</span></div>";
    }
    // "Drink" = total drinks in the tavern. CONFIRMED: the colour tracks whether
    // the tavern is OPEN (green) or CLOSED (red) — not the stock level.
    var totalDrinks = 0; CF.finishedNames.forEach(function (n) { totalDrinks += CF.state.inv.finished[n] || 0; });
    var customers = Math.round(CF.formulas.clientsPer10Min(p.reputation));
    var enough = p.tavernOpen;

    /* CURRENT over MAX, not level over level. Showing the level twice meant the
       bar always read full: you could lose a fight in the sewer, be sitting on
       0, and the sidebar would still say 27 / 27. The reference shows the pool
       ("Durability : 0 / 45"), and that is the number combat actually uses. */
    var durLvl = CF.sports.enduranceMax();
    var rows =
      srow("👤", "Name", esc(p.name), { act: "name-edit", cls: "clickable", vcls: "nameval" }) +
      srow("⭐", "Fame", fmt(totalFame()), { skill: "Fame" }) +
      '<div class="srow sep"></div>' +   // breathing room before the stat block
      srow("🛡️", "Endurance", fmt(CF.sports.enduranceCur()) + " / " + fmt(durLvl),
        { cls: lit0() === "Endurance" ? "hl" : "", skill: "Endurance" });
    function lit0() { return activeSkill(); }
    var icons = { "Fighting": "🥊", "Weapon handling": "🔫", "Defence": "🦺", "Strength": "💪",
      "Speed": "⚡", "Dexterity": "🎯", "Cooking": "🍳", "Gardening": "🌱", "Stealing": "🕵️",
      "Chemist": "⚗️", "Crafting": "🔨", "Smithing": "🔥", "Medical science": "⚕️",
      "Mining": "⛏️" };
    // the skill trained where you're standing is the highlighted one
    var lit = activeSkill();
    c.rows.forEach(function (r) {
      if (r[0] === "Medical science") {
        rows += srow("🍺", "Barkeeping", fmt(p.drinkMasterLevel),
          { cls: lit === "Barkeeping" ? "hl" : "", skill: "Barkeeping" });
      }
      var val = r[0] === "Crafting" ? fmt(CF.craft.progress().level)
              : r[0] === "Smithing" ? fmt(CF.blacksmith.forgingProgress().level)
              : r[0] === "Chemist" ? fmt(CF.chemist.progress().level)
              : r[0] === "Stealing" ? fmt(CF.garden.stealProgress().level)
              : r[0] === "Gardening" ? fmt(CF.garden.gardenProgress().level)
              : r[0] === "Strength" ? fmt(CF.sports.power().level)
              : r[0] === "Medical science" ? fmt(CF.medicine.progress().level)
              : r[0] === "Cooking" ? fmt(CF.canteen.progress().level)
              : r[0] === "Weapon handling" ? fmt(CF.houses.weaponHandling().level)
              : r[0] === "Fighting" ? fightingValue() : r[1];
      rows += srow(icons[r[0]] || "•", r[0], val,
        { cls: lit === r[0] ? "hl" : "", skill: r[0] });
    });
    rows += '<div class="srow sep"></div>';
    var drinkRow = srow("🍹", "Drink", fmt(totalDrinks), { vcls: enough ? "enough" : "low", cls: "clickable", act: "go-tavern" });
    // when open, show how long the stock lasts as a LIVE countdown: the whole-wave
    // projection minus the time already elapsed in the current wave (which is why
    // the reference always reads just under a round multiple of the wave length).
    if (p.tavernOpen && customers > 0) {
      drinkRow += '<div class="srow subline"><span class="ico"></span><span class="k">The drink continues:</span>' +
        '<span class="v" id="drinkContinues" style="color:var(--muted)">' + hms(continuesSeconds()) + "</span></div>";
    }
    // Credits row omitted — nothing in this build spends the premium currency.
    // Money and Bank both lead to the Bank.
    rows += srow("💰", "Money", fmt(p.money), { cls: "clickable", act: "go-bank" }) +
      srow("🏦", "Bank", fmt(p.bank), { cls: "clickable", act: "go-bank" }) +
      srow("🎫", "Tokens", fmt(p.tokens), { cls: "clickable", act: "go-casino" }) + drinkRow;
    // the backpack panel appears above the timer whenever you're carrying goods
    // (craft supplies from the market, or plants stolen at the garden)
    /* ONE backpack panel holding everything you are carrying, the way the
     * reference does it — it used to emit a separate panel per kind, which
     * stacked up two identical headers as soon as you carried two things. */
    var bp = CF.state.craft && CF.state.craft.backpack;
    var plantBp = CF.state.chemist && CF.state.chemist.backpackPlants;
    var stolen = CF.houses ? CF.houses.items() : 0;
    var parts = [], n = 0;
    if (plantBp) {
      parts.push('<div class="bp-skill">Plants: (holds <b>' + fmt(CF.ruleset.garden.plantBackpackSize) + "</b> )</div>" +
        '<div class="bp-item"><a data-act="go-labcabinet">' + esc(plantBp.item) + " (" + fmt(plantBp.qty) + ")</a></div>");
    }
    if (bp) {
      parts.push('<div class="bp-skill">' + esc(CF.ruleset.craft.backpackSkill) + ": (holds <b>" + fmt(CF.craft.capacity()) + "</b> )</div>" +
        '<div class="bp-item"><a data-act="craft-cabinet">' + esc(bp.item) + " (" + fmt(bp.qty) + ")</a></div>");
    }
    if (stolen > 0) {
      parts.push('<div class="bp-item bp-num"><b>' + (++n) + '.</b> <a data-act="go-houses">' +
        fmt(stolen) + " stolen item" + (stolen === 1 ? "" : "s") + "</a></div>");
    }
    var bpHtml = parts.length
      ? '<div class="panel bpack"><div class="bar">🎒 Your backpack</div><div class="bp-body">' +
        parts.join("") + "</div></div>"
      : "";
    $("yourdata").innerHTML = '<div class="panel ydata"><div class="bar">Your data</div><div class="rows">' + rows + "</div></div>" + bpHtml;
    /* The update is a wall-clock event on the hour, so the box names the hour it
     * lands on — otherwise a countdown that starts at 43:07 looks like a bug. */
    $("timerbox").innerHTML = '<div class="panel timer"><div class="bar">Time until the update</div>' +
      '<div class="val" id="timerVal">' + mmss(ui.timer) + "</div>" +
      '<div class="timer-at">at <b id="timerAt">' + hhmm(CF.clock.nextAt()) + "</b></div></div>";
  }

  /* Dexterity hover panel (level, XP progress, fame, mini-ranking).
   * Barkeeping and Crafting are real skills with live figures; the rest are
   * placeholders. Every skill shares the same level curve. */
  /* Fighting is a DERIVED stat — the mean of the six body stats, never trained
   * directly (official help). Verified against the reference: Speed 10 + Strength 13
   * + Endurance 37 + Defence 10 + Dexterity 10 + Weapon handling 2 = 82/6 = 13.67. */
  function fightingValue() {
    var s = CF.sportsStatic;
    var vals = [s.Speed, CF.sports.power().level, CF.sports.endurance().level,
                s.Defence, s.Dexterity, CF.houses.weaponHandling().level];
    var sum = vals.reduce(function (a, b) { return a + b; }, 0);
    return (sum / vals.length).toFixed(2);
  }

  /* Every skill's live level, for the fame breakdown. Skills we simulate read
   * from state; the rest fall back to their placeholder rows. */
  function allSkillLevels() {
    var p = CF.state.player, out = [];
    function add(icon, name, lvl) { out.push({ icon: icon, name: name, level: lvl }); }
    add("🍺", "Barkeeping", p.drinkMasterLevel);
    add("🔨", "Crafting", CF.craft.progress().level);
    add("🔥", "Smithing", CF.blacksmith.forgingProgress().level);
    add("⚗️", "Chemist", CF.chemist.progress().level);
    add("🕵️", "Stealing", CF.garden.stealProgress().level);
    add("🌱", "Gardening", CF.garden.gardenProgress().level);
    add("🛡️", "Endurance", CF.sports.endurance().level);
    add("💪", "Strength", CF.sports.power().level);
    add("🔫", "Weapon handling", CF.houses.weaponHandling().level);
    add("🦺", "Defence", CF.sportsStatic["Defence"]);
    add("⚡", "Speed", CF.sportsStatic["Speed"]);
    add("🎯", "Dexterity", CF.sportsStatic["Dexterity"]);
    add("🍳", "Cooking", CF.canteen.progress().level);
    add("⚕️", "Medical science", CF.medicine.progress().level);
    add("⛏️", "Mining", 1);
    return out;
  }
  /* Fame is the SUM of every skill's fame contribution (confirmed: a 2,830-fame
   * account broke down as 1,296 from Barkeeping 12 (12²·9) + 1,452 from
   * Endurance 27 ((27−5)²·3) + the level-1 remainder, summing exactly). */
  function fameParts() {
    return allSkillLevels().map(function (s) {
      return { icon: s.icon, name: s.name, level: s.level, fame: CF.formulas.fameFor(s.name, s.level) };
    });
  }
  function totalFame() {
    var t = 0; fameParts().forEach(function (x) { t += x.fame; }); return t;
  }
  /* The Fame hover: the ranking strip, then every skill's share with a bar. */
  function famePopHTML() {
    var parts = fameParts(), total = totalFame(), p = CF.state.player;
    var rk = [
      { pl: 215, nm: "Kaspar", fa: Math.round(total * 2.2) },
      { pl: 216, nm: p.name, fa: total, you: true },
      { pl: 217, nm: "Mikk", fa: Math.round(total * 0.62) },
    ].map(function (r) {
      var diff = r.you ? "-" : (r.fa - total >= 0 ? fmt(r.fa - total) : "-" + fmt(total - r.fa));
      return '<tr class="' + (r.you ? "you" : "") + '"><td>' + r.pl + ".</td><td>" + esc(r.nm) +
        '</td><td class="r">' + fmt(r.fa) + '</td><td class="r">' + diff + "</td></tr>";
    }).join("");
    var cells = parts.map(function (x) {
      var pct = total > 0 ? (x.fame / total * 100) : 0;
      return '<div class="fp"><div class="fp-top"><span class="fp-ico">' + x.icon + "</span>" +
        '<span class="fp-val">' + fmt(x.fame) + '</span><span class="fp-pct">' + pct.toFixed(2) + "%</span></div>" +
        '<div class="fp-bar"><i style="width:' + Math.min(100, pct).toFixed(1) + '%"></i></div>' +
        '<div class="fp-name">' + esc(x.name) + " " + x.level + "</div></div>";
    }).join("");
    // the ranking is only meaningful with real accounts — kept, gated on the flag
    var rank = CF.ruleset.showLeaderboards
      ? '<table class="sp-rank"><tr><th>Place</th><th>Name</th><th class="r">Fame</th><th class="r">Difference</th></tr>' + rk + "</table>" +
        '<div class="sp-more">see the full ranking</div>'
      : "";
    return '<div class="sp-head"><span>⭐ Fame</span><span class="sp-lvl">' + fmt(total) + "</span></div>" +
      rank + '<div class="fame-grid">' + cells + "</div>";
  }

  function skillPopHTML(skill, valText) {
    if (skill === "Fame") return famePopHTML();
    var p = CF.state.player, info = null;
    // Fighting is derived — the reference shows NO panel for it at all.
    if (skill === "Fighting") return "";
    if (skill === "Barkeeping") {
      info = { icon: "🍺", level: p.drinkMasterLevel, into: p.drinkMasterPoints,
               lifetime: p.dmLifetime || 0 };
    } else if (skill === "Crafting") {
      var cp = CF.craft.progress(), needC = CF.formulas.pointsToNextLevel(cp.level);
      info = { icon: "🔨", level: cp.level, into: needC - cp.pointsToLevel, lifetime: cp.lifetime };
    } else if (skill === "Smithing") {
      var fp = CF.blacksmith.forgingProgress(), needF = CF.formulas.pointsToNextLevel(fp.level);
      info = { icon: "🔥", level: fp.level, into: needF - fp.pointsToLevel, lifetime: fp.lifetime };
    } else if (skill === "Chemist") {
      var chp = CF.chemist.progress(), needCh = CF.formulas.pointsToNextLevel(chp.level);
      info = { icon: "⚗️", level: chp.level, into: needCh - chp.pointsToLevel, lifetime: chp.lifetime };
    } else if (skill === "Stealing") {
      var sp2 = CF.garden.stealProgress();
      info = { icon: "🕵️", level: sp2.level, into: sp2.into, lifetime: sp2.lifetime };
    } else if (skill === "Gardening") {
      var gp2 = CF.garden.gardenProgress();
      info = { icon: "🌱", level: gp2.level, into: gp2.into, lifetime: gp2.lifetime };
    } else if (skill === "Endurance") {
      var dp = CF.sports.endurance();
      info = { icon: "🛡️", level: dp.level, into: dp.into, lifetime: dp.lifetime };
    } else if (skill === "Strength") {
      var pw = CF.sports.power();
      info = { icon: "💪", level: pw.level, into: pw.into, lifetime: pw.lifetime };
    } else if (skill === "Cooking") {
      var ck = CF.canteen.progress();
      info = { icon: "🍳", level: ck.level, into: ck.into, lifetime: ck.lifetime };
    } else if (skill === "Medical science") {
      var ms = CF.medicine.progress();
      info = { icon: "⚕️", level: ms.level, into: ms.into, lifetime: ms.lifetime };
    } else if (skill === "Weapon handling") {
      var wh = CF.houses.weaponHandling();
      info = { icon: "🔫", level: wh.level, into: wh.into, lifetime: wh.lifetime };
    }
    if (!info) {
      return '<div class="sp-head"><span>' + esc(skill) + '</span><span class="sp-lvl">' + esc(valText) + "</span></div>" +
        '<div class="sp-note">This skill isn\'t active in the prototype yet.</div>';
    }

    var lvl = info.level, into = info.into, need = CF.formulas.pointsToNextLevelFor(skill, lvl);
    var rem = Math.max(0, need - into), pct = need > 0 ? Math.min(100, into / need * 100) : 0;
    var life = info.lifetime;
    // Fame group varies by skill (level²·9 / level²·3 / (level-9)²·3 / (level-5)²·3)
    var fame = CF.formulas.fameFor(skill, lvl), next = CF.formulas.fameFor(skill, lvl + 1);
    var rk = [
      { pl: 180, nm: "Kaspar", lv: lvl + 2, xp: Math.round(life * 1.48) },
      { pl: 181, nm: p.name, lv: lvl, xp: life, you: true },
      { pl: 182, nm: "Mikk", lv: lvl, xp: Math.round(life * 0.97) },
    ].map(function (r) {
      var diff = r.you ? "-" : (r.xp - life >= 0 ? fmt(r.xp - life) : "-" + fmt(life - r.xp));
      return '<tr class="' + (r.you ? "you" : "") + '"><td>' + r.pl + ".</td><td>" + esc(r.nm) +
        '</td><td class="c">' + r.lv + '</td><td class="r">' + fmt(r.xp) + '</td><td class="r">' + diff + "</td></tr>";
    }).join("");
    // ranking kept but hidden until real accounts exist (ruleset.showLeaderboards)
    var rank = CF.ruleset.showLeaderboards
      ? '<table class="sp-rank"><tr><th>Place</th><th>Name</th><th class="c">Level</th><th class="r">XP</th><th class="r">Difference</th></tr>' + rk + "</table>" +
        '<div class="sp-more">see the full ranking</div>'
      : "";
    return '<div class="sp-head"><span>' + info.icon + " " + esc(skill) + '</span><span class="sp-lvl">' + lvl + "</span></div>" +
      '<div class="sp-xp">XP: ' + fmt(into) + " / " + fmt(need) + "<br>to XP level: " + fmt(rem) + "</div>" +
      '<div class="sp-barwrap"><div class="sp-bar"><i style="width:' + pct.toFixed(1) + '%"></i></div><span class="sp-pct">' + pct.toFixed(2) + "%</span></div>" +
      '<div class="sp-fame">Fame: ' + fmt(fame) + "<br>Next level: " + fmt(next) + "</div>" + rank;
  }
  function mmss(s) { var m = Math.floor(s / 60), r = s % 60; return m + ":" + (r < 10 ? "0" : "") + r; }
  function hms(s) { s = Math.max(0, Math.round(s)); var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m + ":" + (x < 10 ? "0" : "") + x; }
  /* Wall-clock HH:MM for a timestamp — the update lands on clock times, so the
   * screens that talk about it show clock times. */
  function hhmm(ms) {
    var d = new Date(ms);
    return (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes();
  }
  function fmtkg(n) { if (typeof n !== "number" || !isFinite(n)) return String(n);
    return (Math.round(n * 10) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 }); }

  /* Live "drink continues": whole-wave projection minus the elapsed part of the
   * current wave, so it ticks down second by second like the reference. */
  function continuesSeconds() {
    var p = CF.state.player;
    if (!p.tavernOpen) return 0;
    var total = 0; CF.finishedNames.forEach(function (n) { total += CF.state.inv.finished[n] || 0; });
    var w = CF.formulas.drinkContinuesWaves(total, p.reputation, p.drinkMasterLevel);
    // waves are 10 minutes apart, not an hour — the tavern has its own clock
    return w <= 0 ? 0 : (w - 1) * CF.ruleset.tavernIntervalSec + (ui.tavernTimer || CF.clock.tavernSecondsToNext());
  }

  /* ========================== WHERE TO GO ============================== */
  function renderWhere() {
    function col(list) {
      return "<div>" + list.map(function (l) {
        var act = l[2];
        return '<div class="loc"><a class="' + (act ? "live" : "dead") + '"' +
          (act ? ' data-act="' + act + '"' : ' data-act="loc-todo" data-loc="' + esc(l[0]) + '" title="Coming soon"') + ">" + esc(l[0]) + "</a>" +
          (l[1] ? ' <span class="desc">' + esc(l[1]) + "</span>" : "") + "</div>";
      }).join("") + "</div>";
    }
    $("whereToGo").innerHTML = '<div class="panel where"><div class="bar">Where to go? <span class="collapse">▲</span></div>' +
      '<div class="cols">' + col(LOC_LEFT) + col(LOC_RIGHT) + "</div></div>";
  }

  /* ===================== PLACE ROUTING / ACCOUNT =======================
   * A notice belongs to the action that produced it, not to the game. Walking
   * out of the tavern and coming back should not re-announce a drink you mixed
   * ten minutes ago, so ARRIVING ON A DIFFERENT SCREEN wipes every notice, error
   * and level-up banner. Re-rendering the SAME screen leaves them alone, which
   * is what keeps a mix result on screen while you keep mixing.
   *
   * Matched by NAME rather than listed one by one, so a notice added later is
   * covered without anyone remembering to come back here. The two modal-scoped
   * errors are exempt: they belong to a popup, not to a screen. */
  var NOTICE_RE = /(Notice|Error|Errors|LevelUp)$/;
  var NOTICE_EXEMPT = { welcomeError: 1, nameError: 1 };
  function clearScreenNotices() {
    for (var k in ui) if (!NOTICE_EXEMPT[k] && NOTICE_RE.test(k)) ui[k] = null;
    /* The ones the naming rule cannot catch. `lastMix` is what makes the tavern
     * say "You made drinks and earned N points" — it is a per-tool record rather
     * than a field called *Notice, which is exactly why it outlived every other
     * banner and kept greeting you on the way back in. */
    ui.lastMix = {};
    ui.lastUpdate = null;
    ui.gardenPtsMsg = null; ui.gardenBackpackBar = false;
  }
  /* Everything that counts as "where you are standing". Sub-tabs are in here
   * too: opening a different tool in the tavern is leaving the last one. */
  function screenKey() {
    return [ui.place, ui.houseView || "", ui.tool || "", ui.sportsFac || "",
            ui.gardenTab || "", ui.medView || "", ui.canRoom || "", ui.hbView || "",
            ui.slumCounter || "", ui.slumArea || "", ui.bunkerTab || "",
            (CF.state.casino && CF.state.casino.game) || ""].join("|");
  }

  function renderPlace() {
    var here = screenKey();
    if (here !== ui.screenAt) { clearScreenNotices(); ui.screenAt = here; }
    renderSidebar();   // the highlighted skill depends on where you are
    if (ui.place === "account") renderAccount();
    else if (ui.place === "house") renderHouse();
    else if (ui.place === "slum") houseGate("slum", "Slum", "To get to the slum, your house must be at least level ") || renderSlum();
    else if (ui.place === "streets") renderStreets();
    else if (ui.place === "bank") renderBank();
    else if (ui.place === "casino") houseGate("casino", "Casino", "Your house must be at least level ") || renderCasino();
    else if (ui.place === "racing") houseGate("racing", "Racing complex", "To reach the racing complex your house must be at least level ") || renderRacing();
    else if (ui.place === "garden") houseGate("garden", "Garden", "To access the garden, your house must be at least level ") || renderGarden();
    else if (ui.place === "houses") renderHouses();
    else if (ui.place === "sports") renderSports();
    else if (ui.place === "canteen") renderCanteen();
    else if (ui.place === "harbor") renderHarbor();
    else if (ui.place === "hospital") renderHospital();
    else renderTavern();
  }

  /* The "you can't get in yet" page: a dashed notice saying which house level is
   * missing, then the way to fix it. ONE renderer, so the house's own rooms are
   * turned away exactly the way the outdoor locations are. */
  function lockedPage(title, message, need) {
    $("locationPanel").innerHTML = '<div class="panel"><div class="bar">' + esc(title) + "</div>" +
      '<div class="loc-locked"><div class="ll-box">' + esc(message) + "<b>" + need + "</b>!</div>" +
      '<p class="acc-note"><span class="tlink" data-act="go-house">Go to your house to build it &raquo;</span></p></div></div>';
    return true;
  }
  /* Locations that need a house level. Returns true when the place is still
   * locked, so callers read `gate(...) || render(...)`. */
  function houseGate(key, title, message) {
    var need = CF.ruleset.locationHouseReq[key] || 0;
    if ((CF.state.player.houseLevel || 0) >= need) return false;
    return lockedPage(title, message, need);
  }

  /* Each room of the house unlocks at house level = its own number. The house
   * page already greys out locked rooms, but the sidebar's skill rows link
   * STRAIGHT into a room — clicking "Chemist" walked you into a fully working
   * drug lab you had not built. So the gate belongs on the room itself, where
   * every route in has to pass it. */
  var ROOM_OF_VIEW = {
    craftcabinet: 1, station: 1, finished: 1,
    chemjuicer: 2, druglab: 2, labcabinet: 2,
    medmachine: 5, medpacking: 5, medwarehouse: 5,
    anvil: 6, anvilupgrade: 6, armory: 6, blackwarehouse: 6,
  };
  function titleCase(s) {
    return String(s).toLowerCase().replace(/(^|\s)([a-z])/g, function (m, sp, c) { return sp + c.toUpperCase(); });
  }
  function roomGate(view) {
    var n = ROOM_OF_VIEW[view];
    if (n == null || (CF.state.player.houseLevel || 0) >= n) return false;
    var room = null;
    HOUSE_ROOMS.forEach(function (r) { if (r.n === n) room = r; });
    var name = titleCase(room ? room.name : "this room");
    return lockedPage(name, "To access the " + name.toLowerCase() + ", your house must be at least level ", n);
  }

  /* ---------------------------- YOUR HOUSE ----------------------------- */
  // Room-1 links that are built; anything else reports "not built".
  var HOUSE_LINKS = {
    "Craft cabinet": { act: "house-craft", view: "craftcabinet" },
    "Finished Items Cabinet": { act: "house-finished", view: "finished" },
    "Armchair": { act: "house-station", station: "armchair" },
    "Woodworking corner": { act: "house-station", station: "woodworking" },
    "Furnaces": { act: "house-station", station: "furnaces" },
    "Anvil": { act: "go-anvil", view: "anvil" },
    "Armory": { act: "go-armory", view: "armory" },
    "Blacksmith Warehouse": { act: "go-blackwh", view: "blackwarehouse" },
    "Juicer": { act: "go-chemjuicer", view: "chemjuicer" },
    "Drug lab": { act: "go-druglab", view: "druglab" },
    "Laboratory Cabinet": { act: "go-labcabinet", view: "labcabinet" },
    "Medicine Machine": { act: "go-medmachine", view: "medmachine" },
    "Packing table": { act: "go-medpacking", view: "medpacking" },
    "Laboratory warehouse": { act: "go-medwarehouse", view: "medwarehouse" },
  };
  function roomItemLink(name) {
    var l = HOUSE_LINKS[name];
    if (!l) return '<a data-act="todo" data-what="' + esc(name) + '">' + esc(name) + "</a>";
    var cur = (l.station && ui.houseStation === l.station && ui.houseView === "station") ||
              (l.view && ui.houseView === l.view) ||
              (l.act === "go-anvil" && ui.houseView === "anvilupgrade");
    return '<a class="' + (cur ? "cur" : "") + '" data-act="' + l.act + '"' +
      (l.station ? ' data-station="' + l.station + '"' : "") + ">" + esc(name) + "</a>";
  }
  function roomBlock(r) {
    var locked = (CF.state.player.houseLevel || 0) < r.n;   // a room unlocks at house level = its number
    var items = r.items.map(function (it) {
      var inner = locked ? '<span class="rdead">' + esc(it[0]) + "</span>" : roomItemLink(it[0]);
      return '<div class="ritem">' + inner + ' <span class="desc">(' + esc(it[1]) + ")</span></div>";
    }).join("");
    var lockTag = locked ? ' <span class="rlock">🔒 needs house level ' + r.n + "</span>" : "";
    return '<div class="room' + (locked ? " locked" : "") + '"><div class="rnum">' + r.n + "</div>" +
      '<div class="rbody"><div class="rname">' + esc(r.name) + ":" + lockTag + "</div>" + items + "</div></div>";
  }

  /* House-level building (official docs): cost 3× per level, gated by Crafting. */
  function houseNextCost(lvl) { var h = CF.ruleset.house; return Math.round(h.costBase * Math.pow(h.costRatio, lvl)); }
  /* What the NEXT house level needs. Level 1 is gated on Barkeeping (you have
   * no crafts room yet); every level after that on Crafting = current x 10. */
  function houseReq(lvl) {
    var h = CF.ruleset.house;
    if (lvl === 0) return { skill: h.firstLevelSkill, need: h.firstLevelReq, have: CF.state.player.drinkMasterLevel };
    return { skill: "Crafting", need: lvl * h.craftLevelsPerHouseLevel, have: CF.craft.progress().level };
  }
  function houseUpgrade() {
    var h = CF.ruleset.house, p = CF.state.player, lvl = p.houseLevel || 0;
    if (lvl >= h.maxLevel) return { ok: false, msg: "House is already at the maximum level (" + h.maxLevel + ")." };
    var next = lvl + 1, r = houseReq(lvl), cost = houseNextCost(lvl);
    if (r.have < r.need) return { ok: false, msg: "Needs " + r.skill + " level " + r.need + " to build house level " + next + " (you are " + r.have + ")." };
    if (p.money < cost) return { ok: false, msg: "Needs " + fmt(cost) + " CC to build house level " + next + "." };
    p.money -= cost; p.houseLevel = next;
    return { ok: true, msg: "The house is now level " + next + "!" };
  }
  // House-upgrade widget for the BOTTOM of the house page: the current house's
  // picture, "House level: N", then a dashed box with the build control or the
  // reason it's blocked (mirrors the reference screenshot).
  function houseLevelPanel() {
    var h = CF.ruleset.house, p = CF.state.player, lvl = p.houseLevel || 0, box;
    if (lvl >= h.maxLevel) {
      box = "<b>Your house is at the maximum level (" + h.maxLevel + ").</b>";
    } else {
      var next = lvl + 1, r = houseReq(lvl), cost = houseNextCost(lvl);
      if (r.have < r.need) {
        box = "<b>The house cannot be built further at the moment!</b>" +
          '<div class="hsub">You need <b>Level ' + r.need + "</b> " + esc(r.skill.toLowerCase()) + " to upgrade the house&hellip;</div>";
      } else if (p.money < cost) {
        box = "<b>Upgrade to house level " + next + "</b>" +
          '<div class="hsub">Costs <b>' + fmt(cost) + "</b> CC — not enough money.</div>";
      } else {
        // the reference renders this as one button: "Level N » Build … (X CC)"
        box = '<div class="cbtn"><button class="btn go" data-act="house-upgrade">Level ' + next +
          " &raquo; " + (lvl === 0 ? "Build the wagon house" : "Build the house one level higher") +
          " (" + fmt(cost) + " CC)</button></div>";
      }
    }
    return '<div class="hpanel">' + houseArt(lvl) +
      '<div class="hlevel">House level: <b>' + lvl + "</b></div>" +
      '<div class="hbox">' + box + "</div></div>";
  }

  function renderHouse() {
    if (ui.houseView && roomGate(ui.houseView)) return;
    if (ui.houseView === "craftcabinet") return renderCraftCabinet();
    if (ui.houseView === "station") return renderStation();
    if (ui.houseView === "finished") return renderFinishedCabinet();
    if (ui.houseView === "anvil") return renderAnvil();
    if (ui.houseView === "anvilupgrade") return renderAnvilUpgrade();
    if (ui.houseView === "armory") return renderArmory();
    if (ui.houseView === "blackwarehouse") return renderBlackWarehouse();
    if (ui.houseView === "chemjuicer") return renderChemJuicer();
    if (ui.houseView === "druglab") return renderDrugLab();
    if (ui.houseView === "labcabinet") return renderLabCabinet();
    if (ui.houseView === "medmachine") return renderMedMachine();
    if (ui.houseView === "medpacking") return renderPackingTable();
    if (ui.houseView === "medwarehouse") return renderMedWarehouse();
    $("locationPanel").innerHTML =
      '<div class="panel"><div class="bar">Your house</div><div class="house">' +
      HOUSE_ROOMS.map(roomBlock).join("") + "</div>" +
      '<p class="acc-note">Built so far: Crafts room and Blacksmith. Locked rooms need a higher house level.</p>' +
      houseLevelPanel() + "</div>";
  }

  /* Craft cabinet: your hand tools and the craft-supply closet. */
  function renderCraftCabinet() {
    var craftRoom = HOUSE_ROOMS.filter(function (r) { return r.n === 1; })[0];
    var bp = CF.state.craft.backpack;
    // yellow bar: either "go shopping" or "unload the backpack"
    var bar = bp
      ? '<div class="ybar">You have <b>' + esc(bp.item) + "</b> x <b>" + fmt(bp.qty) + "</b> in your backpack .</div>" +
        '<div class="cbtn"><button class="btn" data-act="craft-empty">Put craft supplies from your backpack into your closet</button></div>'
      : '<div class="ybar"><a data-act="market-craft">Go to the market</a></div>';

    // tools you don't own yet link to the counter where they're sold
    var tools = CF.ruleset.craft.handTools.map(function (t) {
      var owned = !!CF.state.craft.tools[t];
      return "<tr><td>" + esc(t) + "</td>" + (owned
        ? '<td class="ex">Yes</td>'
        : '<td class="c"><a data-act="market-craft" data-tool="' + esc(t) + '"><b class="no">No</b></a></td>') + "</tr>";
    }).join("");
    var sup = CF.ruleset.craft.materials.map(function (m) {
      // the quantity links to the market counter AND pre-selects this material
      return "<tr><td>" + esc(m[0]) + '</td><td class="c"><a data-act="market-craft" data-mat="' + esc(m[0]) + '">' +
        fmt(CF.state.craft.supplies[m[0]] || 0) + "</a></td></tr>";
    }).join("");

    $("locationPanel").innerHTML =
      '<div class="panel"><div class="bar">Your house</div>' +
      '<div class="house">' + roomBlock(craftRoom) + "</div>" + bar +
      '<div class="craft-tables">' +
        '<table class="ctab"><tr><th colspan="2">Your hand tools</th></tr>' + tools + "</table>" +
        '<table class="ctab"><tr><th colspan="2">Your craft supplies</th></tr>' + sup + "</table>" +
      "</div>" +
      '<p class="acc-note"><span class="tlink" data-act="go-house">« back to the whole house</span></p></div>';
  }

  /* ---- shared chrome for house sub-pages ------------------------------ */
  function houseRoomHeaderN(n, extraHtml) {
    var room = HOUSE_ROOMS.filter(function (r) { return r.n === n; })[0];
    return '<div class="panel"><div class="bar">Your house</div>' +
      '<div class="house">' + roomBlock(room) + "</div>" + (extraHtml || "");
  }
  function craftsRoomHeader(noticeHtml) { return houseRoomHeaderN(1, noticeHtml); }
  function craftFooter() {
    return '<p class="acc-note"><span class="tlink" data-act="go-house">« back to the whole house</span></p></div>';
  }
  /* The Craft level / points block shown under every station. */
  function craftProgressTable() {
    var p = CF.craft.progress();
    return '<table class="ctbl">' +
      '<tr><td class="k">Craft level:</td><td class="v">' + fmt(p.level) + "</td></tr>" +
      '<tr><td class="k">Craft items:</td><td class="v">' + fmt(p.lifetime) + "</td></tr>" +
      '<tr><td class="k">Points to level:</td><td class="v">' + fmt(p.pointsToLevel) + "</td></tr></table>";
  }
  /* Quantity with its unit — alloys are measured in kg. */
  function madeQty(name) {
    var it = CF.craft.itemByName(name), q = CF.state.craft.made[name] || 0;
    var v = it && it.unit === "kg" ? (Math.round(q * 10) / 10).toLocaleString("en-US") : fmt(q);
    return v + (it && it.unit ? " " + it.unit : "");
  }

  /* ---- station fragments (also used by the fast in-place craft update) --- */
  // The notice slot always reserves its height (hidden placeholder when empty)
  // so the Craft button NEVER moves — that is what keeps an autoclicker aimed.
  /* ---------------------------------------------------------------------
   * ONE notice renderer for the whole game.
   * Every system used to carry its own near-identical copy of this (there
   * were eleven); they varied only in the label, whether they reserve height
   * when empty, whether figures get bolded, and the level-up line. All four
   * are options now, so notice behaviour changes in exactly one place.
   *   err/msg   - the strings to show (error wins)
   *   errors    - optional list, one row each (medicine's missing ingredients)
   *   label     - the chip text: NOTICE (default) / MESSAGE / ERROR!
   *   errLabel  - chip text for the error row, when it differs from `label`
   *   reserve   - keep an invisible row when empty so buttons never jump
   *   nums      - bold the figures (hiNums) instead of plain escaping
   *   levelUp   - {skill, level} or a bare number with `skill`
   *   before/after - extra html around the notice rows
   * ------------------------------------------------------------------- */
  function noticeHtml(o) {
    o = o || {};
    var label = o.label || "NOTICE", errLabel = o.errLabel || label;
    var body = o.nums ? hiNums : esc;
    var h = o.before || "";
    (o.errors || []).forEach(function (m) {
      h += '<div class="notice err"><b>' + errLabel + "</b> " + esc(m).replace(/([A-Z][\w ]*?)\s!$/, "<b>$1</b> !") + "</div>";
    });
    if (o.err) h += '<div class="notice err"><b>' + errLabel + "</b> " + body(o.err) + "</div>";
    else if (o.msg) h += '<div class="notice"><b>' + label + "</b> " + body(o.msg) + "</div>";
    else if (o.reserve && !(o.errors || []).length) h += '<div class="notice" style="visibility:hidden"><b>' + label + "</b> &nbsp;</div>";
    /* A plain yellow follow-up line, same box as a level-up. The sewer uses it
     * for "This was delivered to you in the bank vault." and the like. */
    if (o.note) h += '<div class="levelup">' + body(o.note) + "</div>";
    if (o.levelUp != null && o.levelUp !== false) {
      var lu = o.levelUp, skill = o.skill || (lu && lu.skill), level = (lu && lu.level != null) ? lu.level : lu;
      h += '<div class="levelup">Your ' + esc(String(skill).toLowerCase()) + " level is now <b>" + fmt(level) + "</b>.</div>";
    }
    return h + (o.after || "");
  }

  function craftNoticeHtml() {
    return noticeHtml({ err: ui.craftError, msg: ui.craftMadeNotice, reserve: true,
                        levelUp: ui.craftLevelUp, skill: "Crafting" });
  }
  function stMaterialsHtml(stId) {
    return CF.craft.materialsFor(stId).map(function (k) {
      return "<tr><td>" + esc(k) + ':</td><td class="c"><a data-act="market-craft" data-mat="' + esc(k) + '">' +
        fmt(CF.state.craft.supplies[k] || 0) + "</a></td></tr>";
    }).join("");
  }
  function stFinishedHtml(stId) {
    var madeNames = CF.craft.itemsFor(stId).filter(function (i) { return (CF.state.craft.made[i.name] || 0) > 0; });
    if (!madeNames.length) return "";
    return '<div class="bar">Finished products</div><table class="ctab">' +
      madeNames.map(function (i) {
        return "<tr><td>" + esc(i.name) + ':</td><td class="c"><a data-act="house-finished">' + madeQty(i.name) + "</a></td></tr>";
      }).join("") + "</table>";
  }

  function renderStation() {
    var st = CF.craftStations.filter(function (s) { return s.id === ui.houseStation; })[0];
    if (!st) { ui.houseView = null; return renderHouse(); }
    var items = CF.craft.itemsFor(st.id);
    var sel = ui.craftItemSel[st.id] || "";

    var opts = '<option value="">-- What item would you like to make? --</option>' + items.map(function (i) {
      var lock = !CF.craft.isUnlocked(i);
      return '<option value="' + esc(i.name) + '"' + (lock ? " disabled" : "") + (sel === i.name ? " selected" : "") +
        ">Level " + i.lvl + " - " + esc(i.name) + " (" + esc(i.mats.join(" + ")) + ")" + (lock ? "  🔒" : "") + "</option>";
    }).join("");

    $("locationPanel").innerHTML = craftsRoomHeader("") +
      '<div id="craftNotice" class="notice-slot">' + craftNoticeHtml() + "</div>" +
      '<div class="station">' +
        '<div class="st-left"><div class="bar">' + esc(st.panel) + "</div>" +
          '<div class="st-body"><select id="craftItemSel" data-role="craftitem">' + opts + "</select>" +
          '<div class="cbtn"><button class="btn" data-act="craft-make">Craft</button></div></div>' +
          '<div id="stProgress">' + craftProgressTable() + "</div>" +
        "</div>" +
        '<div class="st-right"><div class="bar">Materials</div><table class="ctab" id="stMaterials">' + stMaterialsHtml(st.id) + "</table>" +
          '<div id="stFinished">' + stFinishedHtml(st.id) + "</div>" +
        "</div>" +
      "</div>" + craftFooter();
  }

  /* Fast in-place craft — updates only the changing panels, leaving the Craft
   * button element untouched and immobile so rapid clicks / an autoclicker keep
   * landing on it. Feedback goes in the notice slot (no toast spam). */
  function fastCraft() {
    var stId = ui.houseStation;
    var iname = ($("craftItemSel") && $("craftItemSel").value) || ui.craftItemSel[stId] || "";
    ui.craftError = null;
    if (!iname) { ui.craftError = "Choose an item to make."; ui.craftLevelUp = null; if ($("craftNotice")) $("craftNotice").innerHTML = craftNoticeHtml(); return; }
    ui.craftItemSel[stId] = iname;

    var beforeLvl = CF.craft.progress().level;
    var res = CF.craft.craftItem(CF.craft.itemByName(iname));
    if (!res.ok) { ui.craftError = res.msg; ui.craftLevelUp = null; if ($("craftNotice")) $("craftNotice").innerHTML = craftNoticeHtml(); return; }

    ui.craftMadeNotice = res.msg;
    var afterLvl = CF.craft.progress().level;
    CF.autosave();
    // a level-up unlocks new items -> rebuild the whole page (rare; huge XP gaps)
    if (afterLvl !== beforeLvl) { ui.craftLevelUp = afterLvl; renderPlace(); return; }
    ui.craftLevelUp = null;
    if ($("craftNotice")) $("craftNotice").innerHTML = craftNoticeHtml();
    if ($("stMaterials")) $("stMaterials").innerHTML = stMaterialsHtml(stId);
    if ($("stFinished")) $("stFinished").innerHTML = stFinishedHtml(stId);
    if ($("stProgress")) $("stProgress").innerHTML = craftProgressTable();
  }

  /* ------------------- Finished Items Cabinet (room 1) ----------------- */
  // The inline sell menu that drops in under the selected item's row.
  function finishedSellRow(item) {
    var price = CF.craftPrices[item.name];
    if (price == null) {
      return '<tr class="sellrow"><td colspan="5"><div class="sellbox">' +
        "This item can't be sold yet — its price isn't known.</div></td></tr>";
    }
    var q = ui.finishedQty != null ? ui.finishedQty : "1";
    var qn = parseFloat(q) || 0;
    return '<tr class="sellrow"><td colspan="5"><div class="sellbox">' +
      '<div class="sq">How many items do you want to sell?</div>' +
      '<div class="sqline">Quantity: <input type="number" id="sellQty" data-role="sellqty" min="1" value="' + esc(q) + '"> ' +
        "x " + fmt(price) + ' = <b id="sellTotal">' + fmt(qn * price) + "</b> CC " +
        '<button class="btn" data-act="sell-finished">Sell</button></div>' +
      "</div></td></tr>";
  }

  function renderFinishedCabinet() {
    var made = CF.craftItems.filter(function (i) { return (CF.state.craft.made[i.name] || 0) > 0; })
      .sort(function (a, b) { return a.lvl - b.lvl; });
    var body = made.length
      ? '<table class="mktab"><tr><th></th><th>Items you made</th><th class="c">Level</th>' +
        '<th class="c">Price</th><th class="c">Quantity</th></tr>' +
        made.map(function (i) {
          var on = ui.finishedSel === i.name;
          var price = CF.craftPrices[i.name];
          var row = '<tr class="pick' + (on ? " on" : "") + '" data-act="finished-row" data-item="' + esc(i.name) + '">' +
            '<td class="c"><input type="radio" name="finsel"' + (on ? " checked" : "") + "></td>" +
            "<td><b>" + esc(i.name) + '</b></td><td class="c">' + i.lvl + "</td>" +
            '<td class="c">' + (price != null ? fmt(price) + ' <span class="cc">CC</span>' : "&mdash;") + "</td>" +
            '<td class="c"><b>' + madeQty(i.name) + "</b></td></tr>";
          return on ? row + finishedSellRow(i) : row;
        }).join("") + "</table>"
      : '<p class="acc-note">You haven\'t made anything yet.</p>';
    $("locationPanel").innerHTML = craftsRoomHeader("") + body + craftFooter();
  }

  /* =========================== ROOM 6: ANVIL ========================== */
  var ANVIL_SVG =
    '<svg class="anvilimg" viewBox="0 0 120 84" xmlns="http://www.w3.org/2000/svg">' +
    '<g fill="#c3c8ce" stroke="#8a9098" stroke-width="1">' +
    '<path d="M8 20 h104 l-14 14 h-30 v10 c26 2 30 12 30 12 h-76 s4 -10 30 -12 v-10 h-16 z"/>' +
    '<rect x="40" y="58" width="40" height="8"/><path d="M34 66 h52 l-8 12 h-36 z"/></g></svg>';
  // Swap a broken <img> for inline fallback HTML (shown until the img/*.png assets are added).
  CF.assetFallback = function (el, html) { var d = document.createElement("div"); d.innerHTML = html; if (d.firstChild) el.replaceWith(d.firstChild); else el.remove(); };
  CF._anvilSvg = ANVIL_SVG;
  CF._housePlaceholder = function (level) { return '<div class="house-img placeholder">🏠<span>House level ' + level + "</span></div>"; };
  // Anvil art = the user's img/anvil.png if present, else the SVG fallback.
  function anvilArt() { return '<img src="img/anvil.png" class="anvilimg" alt="Anvil" onerror="CF.assetFallback(this, CF._anvilSvg)">'; }
  // House art for a level = img/house-<level>.png, else a labelled placeholder.
  function houseArt(level) { return '<div class="house-art"><img src="img/house-' + level + '.gif" class="house-img" alt="House level ' + level + '" onerror="CF.assetFallback(this, CF._housePlaceholder(' + level + '))"></div>'; }
  /* Location artwork — the user's GIFs, each falling back to our inline SVG. */
  CF._svg = {};
  function locArt(file, cls, svgKey, alt) {
    CF._svg[svgKey] = CF._svg[svgKey] || "";
    return '<img src="img/' + file + '" class="' + cls + '" alt="' + esc(alt) + '" onerror="CF.assetFallback(this, CF._svg[\'' + svgKey + '\'])">';
  }

  function anvilNoticeHtml() {
    return noticeHtml({ err: ui.anvilError, msg: ui.anvilNotice, label: "MESSAGE", reserve: true,
                        levelUp: ui.anvilLevelUp, skill: "Smithing" });
  }
  function anvilNeedHtml() {
    var w = ui.anvilSel;
    if (!w) return "";
    var r = CF.blacksmith.recipe(w);
    if (!r) return '<div class="anvil-need">This item\'s recipe isn\'t set yet.</div>';
    var qty = ui.anvilQty || 1, parts = [];
    var mc = CF.blacksmith.moneyCost(r, qty);
    if (mc) parts.push("<b>" + fmt(mc) + "</b> CC");
    r.mats.forEach(function (m) { parts.push("<b>" + fmtkg(m.perUnit * qty) + "</b> kg of material " + esc(m.disp)); });
    return '<div class="anvil-need">Need ' + parts.join(", ") + "</div>";
  }
  function anvilForgingHtml() {
    var p = CF.blacksmith.forgingProgress();
    return '<table class="ctbl">' +
      '<tr><td class="k">Smithing level:</td><td class="v">' + fmt(p.level) + "</td></tr>" +
      '<tr><td class="k">Smithing points:</td><td class="v">' + fmt(p.lifetime) + "</td></tr>" +
      '<tr><td class="k">Points to level:</td><td class="v">' + fmt(p.pointsToLevel) + "</td></tr></table>";
  }
  function anvilMaterialsHtml() {
    return CF.anvilMaterials.map(function (m) {
      var to = m.src === "craft" ? ' data-act="house-station" data-station="furnaces"' : ' data-act="todo" data-what="' + esc(m.disp) + '"';
      return "<tr><td>" + esc(m.disp) + ':</td><td class="c"><a' + to + ">" + fmtkg(CF.blacksmith.matQty(m.disp)) + " kg</a></td></tr>";
    }).join("");
  }
  function anvilFinishedHtml() {
    var made = CF.forgeOrder.filter(function (nm) {
      return CF.weaponRecipes[nm].output !== "material" && (CF.state.blacksmith.made[nm] || 0) > 0;
    });
    if (!made.length) return "";
    return '<div class="bar">Finished products</div><table class="ctab">' +
      made.map(function (nm) {
        var to = CF.weaponByName[nm] ? "go-armory" : "go-blackwh";   // weapons -> Armory, Steel plate -> Warehouse
        return "<tr><td>" + esc(nm) + ':</td><td class="c"><a data-act="' + to + '">' + fmt(CF.state.blacksmith.made[nm] || 0) + "</a></td></tr>";
      }).join("") + "</table>";
  }

  function renderAnvil() {
    var lvl = CF.blacksmith.anvilLevel();
    var flvl = CF.blacksmith.forgingProgress().level;
    var sel = ui.anvilSel || "";
    var opts = '<option value="">-- What item would you like to make? --</option>' + CF.forgeOrder.map(function (nm) {
      var r = CF.weaponRecipes[nm], lock = r.level > flvl;
      return '<option value="' + esc(nm) + '"' + (lock ? " disabled" : "") + (sel === nm ? " selected" : "") +
        ">Level " + r.level + " - " + esc(nm) + (lock ? "  🔒" : "") + "</option>";
    }).join("");
    var qopts = "";
    for (var q = 1; q <= lvl; q++) qopts += '<option value="' + q + '"' + ((ui.anvilQty || 1) === q ? " selected" : "") + ">" + q + "</option>";

    $("locationPanel").innerHTML = houseRoomHeaderN(6, "") +
      '<div id="anvilNotice" class="notice-slot">' + anvilNoticeHtml() + "</div>" +
      '<div class="station">' +
        '<div class="st-left"><div class="bar">Anvil</div>' +
          '<div class="st-body"><select id="anvilSel" data-role="anvilsel">' + opts + "</select>" +
            '<div style="margin:8px 0">How many items do you make? <select id="anvilQty" class="qtybox" data-role="anvilqty">' + qopts + "</select></div>" +
            '<div id="anvilNeed">' + anvilNeedHtml() + "</div>" +
            '<div class="cbtn"><button class="btn" data-act="anvil-forge">Craft</button></div></div>' +
          '<div id="anvilForging">' + anvilForgingHtml() + "</div>" +
        "</div>" +
        '<div class="st-right">' + anvilArt() +
          '<div class="anvil-lvl"><a data-act="anvil-upgrade">Level ' + lvl + " anvil</a></div>" +
          '<div class="bar">Materials</div><table class="ctab" id="anvilMats">' + anvilMaterialsHtml() + "</table>" +
          '<div id="anvilFinished">' + anvilFinishedHtml() + "</div>" +
        "</div>" +
      "</div>" + craftFooter();
  }

  /* Fast in-place forge (autoclicker-safe; button never rebuilt). */
  function fastForge() {
    var name = ($("anvilSel") && $("anvilSel").value) || ui.anvilSel || "";
    var qty = ($("anvilQty") && parseInt($("anvilQty").value, 10)) || ui.anvilQty || 1;
    ui.anvilError = null;
    if (!name) { ui.anvilError = "Choose a weapon to forge."; ui.anvilLevelUp = null; if ($("anvilNotice")) $("anvilNotice").innerHTML = anvilNoticeHtml(); return; }
    ui.anvilSel = name; ui.anvilQty = qty;
    var beforeLvl = CF.blacksmith.forgingProgress().level;
    var res = CF.blacksmith.forge(name, qty);
    if (!res.ok) { ui.anvilError = res.msg; ui.anvilLevelUp = null; if ($("anvilNotice")) $("anvilNotice").innerHTML = anvilNoticeHtml(); return; }
    ui.anvilNotice = res.msg;
    var afterLvl = CF.blacksmith.forgingProgress().level;
    CF.autosave();
    if (afterLvl !== beforeLvl) { ui.anvilLevelUp = afterLvl; renderPlace(); return; }   // new unlocks + level-up banner
    ui.anvilLevelUp = null;
    if ($("anvilNotice")) $("anvilNotice").innerHTML = anvilNoticeHtml();
    if ($("anvilNeed")) $("anvilNeed").innerHTML = anvilNeedHtml();
    if ($("anvilMats")) $("anvilMats").innerHTML = anvilMaterialsHtml();
    if ($("anvilFinished")) $("anvilFinished").innerHTML = anvilFinishedHtml();
    if ($("anvilForging")) $("anvilForging").innerHTML = anvilForgingHtml();
  }

  function renderAnvilUpgrade() {
    var s = CF.blacksmith.upgradeStatus(), lvl = CF.blacksmith.anvilLevel();
    function req(label, ok) { return '<span class="' + (ok ? "on" : "no") + '">' + label + "</span>"; }
    $("locationPanel").innerHTML = houseRoomHeaderN(6, "") +
      '<div class="station">' +
        '<div class="st-left"><div class="bar">Improve the anvil</div>' +
          '<table class="ctab up">' +
            '<tr><td>To improve you need:</td><td>' + req("Level " + s.reqForging + " Smithing", s.forgingOk) +
              "<br>" + req("Level " + s.reqHouse + " House", s.houseOk) + "</td></tr>" +
            '<tr><td>Upgrade price:</td><td>' + req(fmt(s.priceQty) + " kg x " + esc(s.priceMat), s.matOk) + "</td></tr>" +
          "</table>" +
          '<div class="cbtn"><button class="btn" data-act="do-upgrade">Improve the anvil</button></div>' +
          '<div id="anvilNotice">' + anvilNoticeHtml() + "</div>" +
          '<p class="acc-note" style="padding:6px 0 0">House level isn\'t a built feature yet, so this upgrade stays gated.</p>' +
        "</div>" +
        '<div class="st-right">' + anvilArt() +
          '<div class="anvil-lvl"><a data-act="go-anvil">Level ' + lvl + " anvil</a></div>" +
          '<div class="bar">Materials</div><table class="ctab">' + anvilMaterialsHtml() + "</table>" +
        "</div>" +
      "</div>" + craftFooter();
  }

  /* --------------------------- ROOM 6: ARMORY ------------------------- */
  function armorySellRow(w) {
    var price = CF.blacksmith.sellPrice(w);
    var q = ui.weaponQty != null ? ui.weaponQty : "1";
    return '<tr class="sellrow"><td colspan="6"><div class="sellbox">' +
      "You need at least a <b>Level " + Math.max(1, w.level) + "</b> (" + esc(w.buyer) + ") soldier to use it." +
      '<div class="sq" style="margin-top:8px">How many guns do you want to sell?</div>' +
      '<div class="sqline">Quantity: <input type="number" id="weaponQty" data-role="weaponqty" min="1" value="' + esc(q) + '"> ' +
        "x " + fmt(price) + ' = <b id="weaponTotal">' + fmt((parseFloat(q) || 0) * price) + "</b> CC " +
        '<button class="btn" data-act="sell-weapon">Sell</button></div>' +
      "</div></td></tr>";
  }
  function renderArmory() {
    var rows = CF.weapons.map(function (a) {
      var w = CF.weaponByName[a[0]], on = ui.weaponSel === w.name, qty = CF.state.blacksmith.made[w.name] || 0;
      var row = '<tr class="pick' + (on ? " on" : "") + '" data-act="weapon-row" data-item="' + esc(w.name) + '">' +
        '<td class="c"><input type="radio" name="wsel"' + (on ? " checked" : "") + "></td>" +
        "<td><b>" + esc(w.name) + '</b><br><span class="wtype">( ' + esc(w.type) + " )</span></td>" +
        '<td class="c">Level ' + w.level + "</td><td><b>" + esc(w.buyer) + "</b></td>" +
        '<td class="c">' + fmt(w.price) + ' <span class="cc">CC</span></td>' +
        '<td class="c"><b>' + fmt(qty) + "</b></td></tr>";
      return on ? row + armorySellRow(w) : row;
    }).join("");
    $("locationPanel").innerHTML = houseRoomHeaderN(6, "") +
      '<table class="mktab wtab"><tr><th></th><th>Weapon name ( Type )</th><th class="c">Level</th>' +
      '<th>To whom ( From... )</th><th class="c">Price</th><th class="c">Quantity</th></tr>' + rows + "</table>" +
      craftFooter();
  }

  /* --------------------- ROOM 6: BLACKSMITH WAREHOUSE ----------------- */
  function renderBlackWarehouse() {
    var rows = CF.blacksmithWarehouse.map(function (it) {
      var on = ui.bwSel === it.name;
      var qv = CF.blacksmith.warehouseQty(it);
      var qty = qv === Infinity ? "&#8734;" : fmt(qv);
      var row = '<tr class="pick' + (on ? " on" : "") + '" data-act="bw-row" data-item="' + esc(it.name) + '">' +
        '<td class="c"><input type="radio" name="bwsel"' + (on ? " checked" : "") + "></td>" +
        "<td><b>" + esc(it.name) + "</b></td>" +
        '<td class="c">' + (it.level != null ? "Level " + it.level : "-") + "</td>" +
        '<td class="c">' + (it.price != null ? fmt(it.price) + ' <span class="cc">CC</span>' : "-") + "</td>" +
        '<td class="c"><b>' + qty + "</b></td></tr>";
      if (on && it.price != null && qv !== Infinity) {
        var q = ui.bwQty != null ? ui.bwQty : "1";
        row += '<tr class="sellrow"><td colspan="5"><div class="sellbox">' +
          '<div class="sq">How many items do you want to sell?</div>' +
          '<div class="sqline">Quantity: <input type="number" id="bwQty" data-role="bwqty" min="1" value="' + esc(q) + '"> ' +
          "x " + fmt(it.price) + ' = <b id="bwTotal">' + fmt((parseFloat(q) || 0) * it.price) + "</b> CC " +
          '<button class="btn" data-act="sell-bw">Sell</button></div></div></td></tr>';
      }
      return row;
    }).join("");
    $("locationPanel").innerHTML = houseRoomHeaderN(6, "") +
      '<table class="mktab"><tr><th></th><th>Item name</th><th class="c">Level</th>' +
      '<th class="c">Price</th><th class="c">Quantity</th></tr>' + rows + "</table>" + craftFooter();
  }

  /* ===================== ROOM 2 — DRUG LAB (Chemist) =================== */
  function chemNoticeHtml() {
    return noticeHtml({ err: ui.chemError, msg: ui.chemNotice, reserve: true,
                        levelUp: ui.chemLevelUp, skill: "Chemist" });
  }
  // Street notices are kept separate from lab notices, so a "sold drugs" message
  // never shows at the lab and a "level up" banner never shows on the street.
  function streetNoticeHtml() {
    return noticeHtml({ err: ui.streetError, msg: ui.streetNotice, reserve: true });
  }
  function chemPlantsHtml() {
    var plants = CF.state.chemist.plants, keys = Object.keys(plants).filter(function (k) { return plants[k] > 0; });
    var head = '<table class="ctab"><tr><th colspan="2">Your plant resources</th></tr>';
    if (!keys.length) return head + '<tr><td colspan="2" class="c" style="color:var(--muted)">empty</td></tr></table>';
    return head + keys.map(function (k) { return "<tr><td>" + esc(k) + '</td><td class="c">' + fmt(plants[k]) + "</td></tr>"; }).join("") + "</table>";
  }
  function chemJuicesHtml(withRadio) {
    var juices = CF.state.chemist.juices, keys = Object.keys(juices).filter(function (k) { return juices[k] > 0; });
    var head = '<table class="ctab"><tr><th colspan="' + (withRadio ? 3 : 2) + '">Your juice reserves</th></tr>';
    if (!keys.length) return head + '<tr><td colspan="' + (withRadio ? 3 : 2) + '" class="c" style="color:var(--muted)">empty</td></tr></table>';
    return head + keys.map(function (k) {
      var on = ui.labJuiceSel === k;
      var radio = withRadio ? '<td class="c"><input type="radio" name="labjuice"' + (on ? " checked" : "") + "></td>" : "";
      var attr = withRadio ? ' class="pick' + (on ? " on" : "") + '" data-act="juice-row" data-juice="' + esc(k) + '"' : "";
      return "<tr" + attr + ">" + radio + "<td>" + esc(k) + ':</td><td class="c">' + fmt(juices[k]) + " ml</td></tr>";
    }).join("") + "</table>";
  }
  function drugNarcOpts() {
    var belt = CF.state.chemist.belt;
    return '<option value="">- Choose -</option>' + CF.narcoticOrder.map(function (n) {
      return '<option value="' + esc(n) + '"' + (ui.drugNarc === n ? " selected" : "") + ">" + esc(n) + " (" + fmt(belt[n] || 0) + "g)</option>";
    }).join("");
  }
  function drugJuiceOpts() {
    var juices = CF.state.chemist.juices, keys = Object.keys(juices).filter(function (k) { return juices[k] > 0; });
    return '<option value="">- Choose -</option>' + keys.map(function (k) {
      return '<option value="' + esc(k) + '"' + (ui.drugJuice === k ? " selected" : "") + ">" + esc(k) + " (" + fmt(juices[k]) + "ml)</option>";
    }).join("");
  }
  function chemProgressTable() {
    var p = CF.chemist.progress();
    return '<table class="ctbl" style="max-width:340px;margin:6px auto">' +
      '<tr><td class="k">Chemist level:</td><td class="v">' + fmt(p.level) + "</td></tr>" +
      '<tr><td class="k">Chemist points:</td><td class="v">' + fmt(p.lifetime) + "</td></tr>" +
      '<tr><td class="k">Points to level:</td><td class="v">' + fmt(p.pointsToLevel) + "</td></tr></table>";
  }

  function renderChemJuicer() {
    var plants = CF.state.chemist.plants, keys = Object.keys(plants).filter(function (k) { return plants[k] > 0; });
    var opts = '<option value="">- Choose -</option>' + keys.map(function (k) {
      return '<option value="' + esc(k) + '"' + (ui.juicerPlant === k ? " selected" : "") + ">" + esc(k) + " (Total: " + fmt(plants[k]) + ")</option>";
    }).join("");
    $("locationPanel").innerHTML = houseRoomHeaderN(2, "") +
      '<div id="chemNotice" class="notice-slot">' + chemNoticeHtml() + "</div>" +
      '<div class="station"><div class="st-left">' +
        '<table class="ctab"><tr><th>Several plants</th><th>Plant name</th></tr>' +
        '<tr><td><input type="number" id="juicerQty" data-role="juicerqty" min="1" value="' + esc(ui.juicerQty) + '"></td>' +
        '<td><select id="juicerPlant" data-role="juicerplant">' + opts + "</select></td></tr></table>" +
        '<div class="cbtn"><button class="btn" data-act="chem-press">Make juice from plants</button></div>' +
        '<p class="nb"><b>NOTE!</b> You can steal plants from the <a data-act="go-garden">garden greenhouse</a>.</p>' +
      "</div>" +
      '<div class="st-right">' + chemJuicesHtml(false) + "</div></div>" + craftFooter();
  }

  /* =========================== HARBOR ================================== */
  function hbNoticeHtml() {
    return noticeHtml({ err: ui.hbError, msg: ui.hbNotice, errLabel: "ERROR!", nums: true });
  }
  function hbHM(min) {
    var h = Math.floor(min / 60), m = Math.round(min % 60);
    return h + "h " + m + "min";
  }
  /* A slim progress bar: white when empty, green in proportion (like the dairy). */
  function hbBar(v, max) {
    var pct = Math.max(0, Math.min(100, (v / max) * 100));
    return '<span class="cbar"><i style="width:' + pct.toFixed(0) + '%"></i></span>';
  }
  function harborTabs() {
    function t(id, label) {
      return ui.hbTab === id || (id === "vessel" && ui.hbTab !== "yard")
        ? '<div class="hbt on"><a data-act="hb-tab" data-tab="' + id + '">' + label + "</a></div>"
        : '<div class="hbt"><a data-act="hb-tab" data-tab="' + id + '">' + label + "</a></div>";
    }
    return '<div class="hb-tabs">' + t("yard", "Shipyard") + t("vessel", "Fishing vessel") + "</div>";
  }
  function vesselNav() {
    function link(id, label) {
      return ui.hbView === id ? "<b>" + label + "</b>"
        : '<a data-act="hb-view" data-view="' + id + '">' + label + "</a>";
    }
    return '<div class="hb-nav">' + link("control", "Control Center") + " | " +
      link("data", "Ship Data") + " | " + link("crew", "Ship Crew") + "</div>";
  }

  function shipyardView() {
    if (!CF.harbor.owned()) return shipOfferView();
    var r = CF.harbor.refit();
    if (r) {
      var u = null; CF.shipUpgrades.forEach(function (x) { if (x.key === r.key) u = x; });
      var left = CF.harbor.refitLeft();
      return '<table class="medtbl hb-tbl"><tr class="sect"><th colspan="4" class="mid">On a fishing boat, improvements are being made&hellip;</th></tr>' +
        '<tr><td class="ico">' + shipIcon(r.key) + '</td><td class="nm"><b>' + esc(u.name) + "</b> " +
          '<span class="lvl">- ' + esc(u.desc) + "</span></td>" +
          '<td class="q">&#9201; <b id="hbRefit">' + hms(left) + "</b></td>" +
          '<td class="q">&#128176; <b>' + fmt(r.cost) + "</b> CC</td></tr>" +
        '<tr class="foot"><td colspan="3">&#9201; Time for improvement &nbsp; &#128176; Price of improvement</td>' +
          '<td class="q"><button class="btn" data-act="hb-cancel">Cancel</button></td></tr></table>';
    }
    var rows = CF.shipUpgrades.map(function (u) {
      var sel = ui.hbUpg === u.key;
      return '<tr class="hbrow' + (sel ? " on" : "") + '" data-act="hb-pick" data-key="' + u.key + '">' +
        '<td class="ico">' + shipIcon(u.key) + "</td>" +
        '<td class="nm"><b>' + esc(u.name) + '</b> <span class="lvl">- ' + esc(u.desc) + "</span><br>" +
          "Level <b>" + CF.harbor.lvl(u.key) + "</b></td>" +
        '<td class="q">&#9201; <b>' + CF.harbor.upgradeHours(u.key) + "</b> hours</td>" +
        '<td class="q">&#128176; <b>' + fmt(CF.harbor.upgradeCost(u.key)) + "</b> CC</td>" +
        '<td class="rad"><span class="radio' + (sel ? " on" : "") + '"></span></td></tr>';
    }).join("");
    return '<table class="medtbl hb-tbl"><tr class="sect"><th colspan="5" class="mid">Fishing vessel improvement</th></tr>' +
      rows +
      '<tr class="foot"><td colspan="4">&#9201; Time for improvement &nbsp; &#128176; Price of improvement</td>' +
        '<td class="rad"><button class="btn" data-act="hb-improve">Improve</button></td></tr></table>';
  }
  function shipIcon(key) {
    var ch = { equipment: "&#127907;", cargo: "&#128230;", engineR: "&#9881;", engineL: "&#9881;", armament: "&#128299;" };
    return '<span class="shipico">' + (ch[key] || "&#9875;") + "</span>";
  }

  /* Before you own a boat, the old fisherman's offer stands in for both tabs. */
  function shipOfferView() {
    var p = fmt(CF.ruleset.harbor.shipPriceCC);
    return '<div class="hb-offer"><p>The sea bank has an old and worn cargo ship.<br>' +
      "There is an old fisherman who offers to sell it for <b>" + p + "</b> CC.<br>" +
      'He says, &ldquo;If you put a little money down there, you&rsquo;ll get a decent fishing vessel from it.&rdquo;</p>' +
      "<p class=\"ask\">Do you want to buy this ship?</p>" +
      '<div class="cbtn"><button class="btn" data-act="hb-buy">YES, I&rsquo;ll buy the ship! (costs: ' + p + " CC)</button></div></div>";
  }
  function controlView() {
    if (!CF.harbor.owned()) return shipOfferView();
    var t = CF.harbor.trip();
    if (t) {
      // the reference gives no detail while the boat is out — just the clock
      var left = CF.harbor.tripLeft();
      return '<div class="hb-atsea">The fishing vessel is on a fishing trip for another ' +
        '<b class="r" id="hbTripH">' + Math.floor(left / 3600) + '</b> hours and <b class="r" id="hbTripM">' +
        Math.floor((left % 3600) / 60) + "</b> minutes.<br>" +
        "There is no communication with the vessel during the fishing trip.</div>";
    }
    var f = CF.harbor.crew("fishing"), d = CF.harbor.crew("defense");
    var hs = CF.harbor.holds();
    var opts = CF.harbor.catchableFish();
    var holdRows = hs.map(function (kg, i) {
      var o = '<option value="">- What are you filling it with? -</option>' + opts.map(function (fs) {
        return '<option value="' + esc(fs.name) + '"' + ((ui.hbHold[i] || "") === fs.name ? " selected" : "") +
          ">Level " + fs.lvl + " - " + esc(fs.name) + "</option>";
      }).join("");
      return '<tr><td class="nm">Cargo space ' + (i + 1) + " ( " + kg + "kg ):</td>" +
        '<td class="q"><select id="hbHold' + i + '" data-role="hbhold" data-i="' + i + '">' + o + "</select></td></tr>";
    }).join("");
    return '<table class="medtbl hb-tbl"><tr class="sect"><th colspan="2" class="mid">Send a ship on a fishing trip</th></tr>' +
      '<tr><td class="nm">Fishing team:</td><td class="q">' + (f ? f.men + " men" : "<b class=\"r\">none</b>") + "</td></tr>" +
      '<tr><td class="nm">Defense team:</td><td class="q">' + (d ? d.men + " men" : "<b class=\"r\">none</b>") + "</td></tr>" +
      '<tr><td class="nm">Driving time:</td><td class="q">' + hbHM(CF.harbor.drivingMinutes()) + "</td></tr>" +
      '<tr><td class="nm">Time spent fishing:</td><td class="q">' + hbHM(CF.harbor.fishingMinutes()) + "</td></tr>" +
      '<tr><td class="nm">Total fishing trip time:</td><td class="q">' + hbHM(CF.harbor.tripMinutes()) + "</td></tr>" +
      holdRows + "</table>" +
      '<div class="cbtn"><button class="btn" data-act="hb-send">Send the ship on its way</button></div>';
  }

  function shipDataView() {
    if (!CF.harbor.owned()) return shipOfferView();
    var max = CF.harbor.maxLevel();
    function row(label, val, v, m) {
      return '<tr><td class="nm">' + label + '</td><td class="q">' + val + "</td>" +
        '<td class="bar">' + hbBar(v, m) + "</td></tr>";
    }
    return '<table class="medtbl hb-tbl hb-data"><tr class="sect"><th colspan="2">Ship details</th><th class="bar">Progress</th></tr>' +
      row("What fish can be caught:", "Level <b>" + CF.harbor.catchLevel() + "</b>", CF.harbor.catchLevel(), max) +
      row("How many fish can it hold:", "<b>" + CF.harbor.cargoTotal() + "</b>kg", CF.harbor.lvl("cargo"), max) +
      row("Driving time:", hbHM(CF.harbor.drivingMinutes()),
          CF.harbor.lvl("engineR") + CF.harbor.lvl("engineL") - 2, max * 2) +
      row("Time spent fishing:", hbHM(CF.harbor.fishingMinutes()), CF.harbor.lvl("equipment"), max) +
      row("Ship's armament level:", "<b>" + CF.harbor.lvl("armament") + "</b>/" + max, CF.harbor.lvl("armament"), max) +
      row("Defense team capabilities:", "<b>" + CF.harbor.defenseCapability() + "</b>%", CF.harbor.defenseCapability(), 100) +
      row("Overall ship level:", "<b>" + CF.harbor.overallLevel() + "</b>/" + max, CF.harbor.overallLevel(), max) +
      "</table>";
  }

  function crewView() {
    if (!CF.harbor.owned()) return shipOfferView();
    function have(kind, title) {
      var c = CF.harbor.crew(kind);
      if (!c) return "";
      var t = null; CF.harbor.crewList(kind).forEach(function (x) { if (x.name === c.name) t = x; });
      return '<table class="medtbl hb-tbl"><tr class="sect"><th colspan="4" class="mid">' + title + "</th></tr>" +
        '<tr><td class="ico">' + crewIcon(c.tier) + '</td><td class="nm"><b>' + esc(c.name) + '</b> ' +
          '<span class="lvl">- ' + esc(t ? t.desc : "") + "</span><br>" +
          '&#128101; <b>' + c.men + "</b> men &nbsp; &#128176; <b>" + fmt(c.pay) + "</b> CC</td>" +
        '<td class="q"></td><td class="rad"><button class="btn" data-act="hb-fire" data-kind="' + kind + '">Fire</button></td></tr>' +
        '<tr class="foot"><td colspan="4">&#128101; Number of men in the team &nbsp; &#128176; Team salary</td></tr></table>';
    }
    function hireBlock(kind, title, legend) {
      if (CF.harbor.crew(kind)) return "";
      var need = CF.harbor.crewReqLevel(kind);
      var rows = CF.harbor.crewList(kind).map(function (x, i) {
        var sel = ui.hbHire[kind] === x.name, okp = need >= x.req;
        return '<tr class="hbrow' + (sel ? " on" : "") + (okp ? "" : " off") +
          '" data-act="hb-hpick" data-kind="' + kind + '" data-name="' + esc(x.name) + '">' +
          '<td class="ico">' + crewIcon(i + 1) + "</td>" +
          '<td class="nm"><b>' + esc(x.name) + '</b> <span class="lvl">- ' + esc(x.desc) + "</span><br>" +
            '&#11014; Level <b>' + x.req + "</b> &nbsp; &#128176; <b>" + fmt(x.pay) + "</b> CC</td>" +
          '<td class="rad"><span class="radio' + (sel ? " on" : "") + '"></span></td></tr>';
      }).join("");
      var men = "";
      for (var i = 1; i <= CF.ruleset.harbor.crewMax; i++) {
        men += '<option value="' + i + '"' + (String(ui.hbMen[kind]) === String(i) ? " selected" : "") + ">" + i + "</option>";
      }
      return '<table class="medtbl hb-tbl"><tr class="sect"><th colspan="3" class="mid">' + title + "</th></tr>" + rows +
        '<tr class="foot"><td colspan="2">&#11014; ' + legend + ' &nbsp; &#128176; One man\'s salary</td>' +
        '<td class="rad"><select id="hbMen-' + kind + '" data-role="hbmen" data-kind="' + kind + '">' +
          '<option value="">- How many? -</option>' + men + "</select> " +
          '<button class="btn" data-act="hb-hire" data-kind="' + kind + '">Hire</button></td></tr></table>';
    }
    return have("fishing", "Ship's crew") + have("defense", "Ship's crew") +
      hireBlock("fishing", "Hire a fishing crew", "Required general ship level") +
      hireBlock("defense", "Hire a defense team", "Required ship armament") +
      '<p class="hb-nb"><b>NOTE!</b> If the ship is not in port at the time of hiring/dismissing the crew, ' +
        "the changes will take effect after the ship arrives in port.</p>";
  }
  function crewIcon(tier) {
    return '<span class="shipico crew t' + tier + '">' + ["&#129333;", "&#129333;", "&#129333;", "&#129333;", "&#127880;"][tier - 1] + "</span>";
  }

  function renderHarbor() {
    // a finished refit or trip is banked the moment you walk in
    var done = CF.harbor.settleRefit();
    if (done) { ui.hbNotice = "The shipyard finished your " + done.name.toLowerCase() + " — it is now level " + done.level + "."; CF.autosave(); }
    var land = CF.harbor.settleTrip();
    if (land) {
      var bits = Object.keys(land.got).map(function (k) { return fmt(land.got[k]) + " kg of " + k; });
      ui.hbNotice = land.total
        ? "The fishing boat is back with " + bits.join(" and ") + "." + (land.raided ? " Pirates took half the catch!" : "")
        : "The fishing boat came back empty.";
      CF.autosave();
    }
    var body;
    if (ui.hbTab === "yard") body = shipyardView();
    else if (ui.hbView === "data") body = shipDataView();
    else if (ui.hbView === "crew") body = crewView();
    else body = controlView();
    CF._svg.port = "";
    $("locationPanel").innerHTML =
      '<div class="panel hb"><div class="bar">Seaport</div>' +
      '<div class="hb-art">' + locArt("port.png", "hb-img", "port", "Seaport") + "</div>" +
      harborTabs() +
      (ui.hbTab === "yard" ? "" : vesselNav()) +
      '<div id="hbNotice" class="notice-slot">' + hbNoticeHtml() + "</div>" +
      '<div class="hb-body">' + body + "</div></div>";
  }

  /* ========================= HOSPITAL ==================================
   * The treatment desk. Everything else the reference's hospital does — the
   * wards, the surgery, the cleanliness and nursing figures, the parking and
   * the daily books — is listed but inert, so the place reads right without
   * pretending to run a business it does not run yet. */
  function hospitalRoomsHtml() {
    var R = CF.hospital.rooms();
    function col(names) {
      return "<div>" + names.map(function (n) {
        return '<div class="hsp-room"><a data-act="hsp-room" data-room="' + esc(n) + '">' + esc(n) + "</a></div>";
      }).join("") + "</div>";
    }
    return '<div class="hsp-rooms">' + col(R.left) + col(R.right) + "</div>";
  }
  /* The reference's info block, word for word. Every figure is static — the
     hospital is not run as a business yet, and these are the spec for when it
     is, so they are quoted rather than invented. */
  function hospitalStatsHtml() {
    var s = CF.hospital.stats();
    return '<div class="hsp-stats">' +
      "<p>The hospital level is <b>" + fmt(s.level) + "</b> and the profit is <b>" + fmt(s.profitCC) + "</b> CC.<br>" +
      "The cleanliness of the hospital is <b>" + s.cleanlinessPct + "%</b> and the quality of nursing is <b>" +
      s.nursingPct + "%</b>.</p>" +
      "<p>The rest room is <b>" + s.restRoomM2 + "</b> m<sup>2</sup>, of which <b>" + s.restRoomUsedM2 +
      "</b> m<sup>2</sup> is in use.<br>" +
      "The hospital parking lot can accommodate <b>" + s.parkingSpaces + "</b> cars, you have <b>" +
      s.carsParked + "</b> cars.<br>" +
      "Daily profit <b>" + fmt(s.dailyProfit) + "</b> and debt <b>" + fmt(s.debt) + "</b></p>" +
      "</div>";
  }
  function hospitalDeskHtml() {
    var H = CF.hospital;
    if (!H.hurt()) return '<p class="hsp-well">You are healthy and do not need treatment...</p>';
    var kits = H.kits(), price = H.price();
    var canCash = CF.state.player.money >= price, canKit = kits >= H.kitsNeeded();
    return '<div class="hsp-desk">' +
      '<div class="hsp-bar barline">' + barLine("Endurance", H.endurance(), H.maxEndurance()) + "</div>" +
      '<div class="hsp-acts">' +
        '<button class="btn" data-act="hsp-cash"' + (canCash ? "" : " disabled") + ">" +
          "Get treated at the hospital (Cost: " + fmt(price) + " CC)</button>" +
        '<button class="btn" data-act="hsp-kit"' + (canKit ? "" : " disabled") + ">" +
          "Use one first aid kit for treatment (Total: " + fmt(kits) + ")</button>" +
      "</div>" +
      (!canCash && !canKit
        ? '<p class="nb">NOTE! You cannot afford the fee and you have no first aid kits. Kits are packed at the ' +
          "medicine laboratory from your own medicines.</p>" : "") +
      "</div>";
  }
  function hospitalLinksHtml() {
    return '<div class="hsp-links">' + CF.hospitalLinks.map(function (l) {
      return (l.before || "") + '<a data-act="' + l.act + '"' + (l.fac ? ' data-fac="' + l.fac + '"' : "") +
        ">" + esc(l.label) + "</a>" + (l.after || "");
    }).join(" | ") + "</div>";
  }
  function hspNoticeHtml() {
    return noticeHtml({ err: ui.hspError, msg: ui.hspNotice, label: "NOTICE", errLabel: "ERROR!", nums: true });
  }
  function renderHospital() {
    $("locationPanel").innerHTML =
      '<div class="panel hsp"><div class="bar">Hospital</div>' +
      '<div class="hsp-top">' +
        '<div class="hsp-art">' + locArt("hospital.gif", "hsp-img", "hospital", "Hospital") + "</div>" +
        '<div class="hsp-info">' + hospitalRoomsHtml() + hospitalStatsHtml() + "</div>" +
      "</div>" +
      '<div id="hspNotice" class="notice-slot">' + hspNoticeHtml() + "</div>" +
      hospitalDeskHtml() +
      hospitalLinksHtml() +
      "</div>";
  }

  /* ================= CANTEEN — the tavern's SECOND FLOOR ================ */
  function canHelpBody() {
    var c = CF.ruleset.canteen;
    return '<div class="chelp"><p>The canteen is the tavern\'s <b>second floor</b>. It feeds the customers your ' +
      "first floor is already serving drinks to, and it runs on <b>Cooking</b>.</p><ol>" +
      "<li><b>Fill the container</b> at the Dairy warehouse with <b>Raw milk</b> or <b>Water</b>. Each container holds <b>" +
        c.containerMax + "</b> liters.</li>" +
      "<li><b>Prepare a dairy product</b> from those raw liquids, up to <b>" + c.brewMax +
        "</b> liters at a time. One liter costs <b>" + c.rawMilkPerLiter + "</b> liter of raw milk and <b>" +
        c.waterPerLiter + "</b> of water.</li>" +
      "<li><b>Fruit</b> arrives on its own: every plant you harvest in the edible garden sends <b>20 fruit</b> " +
        "straight to the <b>Canteen granary</b>. <b>Fish</b> comes from the Seaport's fishing boat.</li>" +
      "<li><b>Cook</b> at the <b>Vegetarian corner</b> (two fruits + a dairy product) or the <b>Fish food table</b> " +
        "(fish + fruit + dairy). You choose how many hours the dish should last, up to <b>" + c.maxHours + "</b>.</li>" +
      "<li>A finished dish sits on the <b>Food menu</b> for those hours and your customers eat from it. " +
        "Each hour cooked pays <b>" + c.cookPointsPerHour + "</b> cooking points.</li>" +
      "<li>An hour of a vegetarian dish costs <b>" + c.vegFruitPerHour + "</b> of each fruit and <b>" +
        c.vegDairyPerHour + "</b> liters of dairy; a fish dish costs <b>" + c.fishPerHour + "</b> kg of fish, <b>" +
        c.fishFruitPerHour + "</b> fruit and <b>" + c.fishDairyPerHour + "</b> liters of dairy.</li>" +
      "</ol><p><b>NOTE!</b> Container sizes grow as your Cooking level does.</p></div>";
  }
  function canteenNoticeHtml() {
    return noticeHtml({ err: ui.canError, msg: ui.canNotice, errLabel: "ERROR!", nums: true,
                        levelUp: ui.canLevelUp, skill: "Cooking" });
  }
  function canteenNav() {
    function link(r) {
      return ui.canRoom === r.id ? "<b>" + esc(r.name) + "</b>"
        : '<a data-act="can-room" data-room="' + r.id + '">' + esc(r.name) + "</a>";
    }
    return '<div class="can-nav"><div>' + CF.canteenRooms.slice(0, 4).map(link).join("") + "</div>" +
      "<div>" + CF.canteenRooms.slice(4).map(link).join("") + "</div></div>";
  }
  function canteenRepHtml() {
    return '<div class="can-rep">Canteen reputation: <b>' + fmt(CF.canteen.reputation()) +
      '</b> <span class="repmax">( max: ' + fmt(CF.canteen.reputationMax()) + " )</span></div>";
  }
  function canteenLanding() {
    return '<div class="can-rooms">' + CF.canteenRooms.map(function (r, i) {
      return (i === 4 ? '<div class="gap"></div>' : "") +
        '<div class="cr"><a data-act="can-room" data-room="' + r.id + '">' + esc(r.name) + "</a> " +
        '<span class="desc">( ' + esc(r.desc) + " )</span></div>";
    }).join("") + "</div>";
  }
  /* Ingredient dropdowns — one builder for all five of them. */
  function canOpts(list, sel, placeholder, unit) {
    return '<option value="">' + esc(placeholder) + "</option>" + list.map(function (x) {
      return '<option value="' + esc(x.name) + '"' + (sel === x.name ? " selected" : "") + ">" +
        esc(x.name) + " (" + fmt(x.qty) + " " + unit + ")</option>";
    }).join("");
  }
  /* Fruit splits in two: what you GREW (field crops, from the edible garden)
   * and what you SWAPPED for at the Culinary exchange (greenhouse fruit). */
  function isGreenhouseFruit(name) {
    var hit = false; CF.gardenExchangeFruits.forEach(function (x) { if (x.name === name) hit = true; });
    return hit;
  }
  function fruitList(kind) {
    var f = CF.canteen.fruit();
    return Object.keys(f).filter(function (k) {
      if (!(f[k] > 0)) return false;
      if (kind === "green") return isGreenhouseFruit(k);
      if (kind === "field") return !isGreenhouseFruit(k);
      return true;
    }).sort().map(function (k) { return { name: k, qty: f[k] }; });
  }
  function dairyList() {
    return CF.dairyProducts.map(function (n) { return { name: n, qty: CF.canteen.dairyQty(n) }; });
  }
  function fishList() {
    var f = CF.canteen.fish();
    return Object.keys(f).filter(function (k) { return f[k] > 0; }).sort()
      .map(function (k) { return { name: k, qty: f[k] }; });
  }
  function hourOpts(sel) {
    var o = '<option value="">- Select quantity -</option>';
    for (var i = 1; i <= CF.ruleset.canteen.maxHours; i++) {
      o += '<option value="' + i + '"' + (String(sel) === String(i) ? " selected" : "") + ">" + i + " - for an hour</option>";
    }
    return o;
  }
  function cookProgTable() {
    var p = CF.canteen.progress();
    return '<table class="ctbl can-prog">' +
      "<tr><td>Cooking level:</td><td>" + fmt(p.level) + "</td></tr>" +
      "<tr><td>Cooking points:</td><td>" + fmt(p.into) + "</td></tr>" +
      "<tr><td>Points to level:</td><td>" + fmt(p.pointsToLevel) + "</td></tr></table>";
  }

  function dairyRoom() {
    var max = CF.canteen.containerMax();
    var rows = CF.dairyAll.map(function (n) {
      // an empty container reads as a plain WHITE bar (user); anything in it
      // fills green in proportion
      var q = CF.canteen.dairyQty(n), pct = Math.max(0, Math.min(100, q / max * 100));
      return '<tr><td class="nm">' + esc(n) + "</td>" +
        '<td class="q"><span class="cbar' + (q > 0 ? " on" : "") + '"><i style="width:' + pct.toFixed(0) + '%"></i></span> ' +
        fmt(q) + "/" + fmt(max) + "</td></tr>";
    }).join("");
    var liq = '<option value="">- Choose a liquid -</option>' + CF.dairyLiquids.map(function (n) {
      return '<option value="' + esc(n) + '"' + (ui.canLiquid === n ? " selected" : "") + ">" + esc(n) + "</option>";
    }).join("");
    var prod = '<option value="">- Choose a dairy product -</option>' + CF.dairyProducts.map(function (n) {
      return '<option value="' + esc(n) + '"' + (ui.canDairy === n ? " selected" : "") + ">" + esc(n) + "</option>";
    }).join("");
    var lit = '<option value="">- How many liters? -</option>';
    for (var i = 1; i <= CF.ruleset.canteen.brewMax; i++) {
      lit += '<option value="' + i + '"' + (String(ui.canLiters) === String(i) ? " selected" : "") +
        ">" + i + " liter" + (i === 1 ? "" : "s") + "</option>";
    }
    return '<div class="can-fill"><select id="canLiquid" data-role="canliquid">' + liq + "</select> " +
        '<button class="btn" data-act="can-fill">Fill the container</button></div>' +
      '<table class="medtbl can-dairy"><tr class="sect"><th>Product name</th><th>Quantity</th></tr>' + rows + "</table>" +
      '<div class="can-brew"><select id="canLiters" data-role="canliters">' + lit + "</select> " +
        '<select id="canDairy" data-role="candairy">' + prod + "</select>" +
        '<div class="cbtn"><button class="btn" data-act="can-brew">Prepare the selected product</button></div></div>' +
      '<div class="can-foot">Find out <a data-act="can-help">HERE</a> how to increase the size of your dairy product containers!</div>' +
      '<div class="can-foot"><b>NOTE!</b> You can brew up to <b>' + CF.ruleset.canteen.brewMax + "</b> liters at a time.</div>";
  }

  function granaryRoom() {
    function section(kind, empty) {
      var list = fruitList(kind);
      return list.length
        ? list.map(function (x) {
            return '<tr><td class="nm">' + esc(x.name) + ' <span class="lvl">( Level ' +
              fruitLevelOf(x.name) + ' )</span></td><td class="q">' + fmt(x.qty) + "</td></tr>";
          }).join("")
        : '<tr><td colspan="2" class="none">' + empty + "</td></tr>";
    }
    return '<table class="medtbl can-gran"><tr class="sect"><th>Fruit in the granary</th><th>Quantity</th></tr>' +
      '<tr class="sub"><td colspan="2">Greenhouse grown fruits</td></tr>' +
      section("green", "You don't have any fruit here — swap for it at the Culinary exchange.") +
      '<tr class="sub"><td colspan="2">Field-grown fruits</td></tr>' +
      section("field", "You don't have any fruit here.") + "</table>" +
      '<div class="can-links">&laquo; <a data-act="go-garden" data-tab="edible">Go to the edible garden</a>' +
        ' | <a data-act="market-culinary">Go to the Culinary exchange</a> &raquo;</div>';
  }
  /* A fruit's level, whichever of the two lists it comes from. */
  function fruitLevelOf(name) {
    var l = 1;
    CF.gardenEdibleSeeds.forEach(function (s) { if (s.name === name) l = s.lvl; });
    CF.gardenExchangeFruits.forEach(function (s) { if (s.name === name) l = s.lvl; });
    return l;
  }

  function fishRoom() {
    var list = fishList();
    var rows = list.length
      ? list.map(function (x) {
          var lv = 1; CF.fishSpecies.forEach(function (s) { if (s.name === x.name) lv = s.lvl; });
          return '<tr><td class="nm">' + esc(x.name) + ' <span class="lvl">( Level ' + lv + " )</span></td>" +
            '<td class="q">' + fmt(x.qty) + ' <span class="lvl">kg</span></td></tr>';
        }).join("")
      : '<tr><td colspan="2" class="none">You have no fish — the fishing boat at the Seaport isn\'t built yet.</td></tr>';
    return '<table class="medtbl can-fish"><tr class="sect"><th>Fish in the fish store</th><th>Quantity</th></tr>' +
      rows + "</table>";
  }

  function menuRoom() {
    function slot(title, key) {
      var d = CF.canteen.menuDish(key), left = CF.canteen.menuLeft(key);
      return '<tr class="sub2"><td>' + title + '</td><td class="q">Time remaining</td></tr>' +
        (d ? '<tr class="dish"><td class="nm"><span class="no">1.</span> ' + esc(d.name) +
               ' <span class="lvl">( Level ' + d.level + " )</span></td>" +
             '<td class="q"><b id="canLeft-' + key + '">' + hms(left) + "</b></td></tr>"
           : '<tr><td colspan="2" class="none">The canteen food menu is empty. Customers can\'t eat!</td></tr>');
    }
    return '<table class="medtbl can-menu"><tr class="sect"><th colspan="2" class="mid">Canteen food menu</th></tr>' +
      slot("Vegetarian dishes", "veg") + slot("Seafood", "fish") + "</table>" +
      '<p class="acc-note">Cook again and the hours are added to the dish already on the menu.</p>';
  }

  function cookRoom(isFish) {
    var heads = isFish ? ["Fish", "Fruit", "Dairy product"] : ["Greenhouse fruit", "Field crop", "Dairy product"];
    // the vegetarian corner wants a GREENHOUSE fruit and a FIELD crop; the fish
    // table takes any fruit
    var s1 = isFish
      ? canOpts(fishList(), ui.canFish, "- Choose a fish -", "kg")
      : canOpts(fruitList("green"), ui.canFruit1, "- Choose a fruit -", "fruit");
    var s2 = isFish ? canOpts(fruitList(), ui.canFruit1, "- Choose a fruit -", "fruit")
                    : canOpts(fruitList("field"), ui.canFruit2, "- Choose a fruit -", "fruit");
    var s3 = canOpts(dairyList(), ui.canCookDairy, "- Choose a dairy product -", "liters");
    var id1 = isFish ? "canFish" : "canFruit1", r1 = isFish ? "canfish" : "canfruit1";
    var id2 = isFish ? "canFruit1" : "canFruit2", r2 = isFish ? "canfruit1" : "canfruit2";
    return '<table class="mktab can-cook"><tr><th>' + heads[0] + '</th><th class="pl"></th><th>' + heads[1] +
        '</th><th class="pl"></th><th>' + heads[2] + "</th></tr>" +
      '<tr><td><select id="' + id1 + '" data-role="' + r1 + '">' + s1 + "</select></td>" +
        '<td class="pl">+</td><td><select id="' + id2 + '" data-role="' + r2 + '">' + s2 + "</select></td>" +
        '<td class="pl">+</td><td><select id="canCookDairy" data-role="cancookdairy">' + s3 + "</select></td></tr>" +
      '<tr class="hrs"><td colspan="5"><b>For how many hours?</b> ' +
        '<select id="canHours" data-role="canhours">' + hourOpts(ui.canHours) + "</select> " +
        '<button class="btn" data-act="' + (isFish ? "can-cook-fish" : "can-cook-veg") + '">Prepare food</button></td></tr></table>' +
      cookProgTable() +
      '<p class="nb c"><b class="r">NOTE!</b> <a data-act="' + (isFish ? "fish-book" : "veg-book") + '">' +
        (isFish ? "Read the fish food recipe book" : "Read the vegetarian recipe book") + "</a></p>";
  }

  /* The two recipe books — the same floating-popup pattern as the Chemist's
   * help page: what the table does, then the whole leveled recipe list. */
  function cookBookBody(isFish) {
    var c = CF.ruleset.canteen, lv = CF.canteen.progress().level;
    var list = isFish ? CF.fishDishes : CF.vegDishes;
    var rows = list.map(function (d) {
      var open = d.lvl <= lv;
      var made = isFish ? esc(d.fish) + " + " + esc(d.fruit) + " + " + esc(d.dairy)
                        : esc(d.green) + " + " + esc(d.field) + " + " + esc(d.dairy);
      return "<tr" + (open ? "" : ' class="locked"') + '><td class="q">' + d.lvl + "</td>" +
        '<td class="nm">' + esc(d.name) + (open ? "" : " &#128274;") + "</td>" +
        "<td>" + made + "</td></tr>";
    }).join("");
    return '<div class="chelp book"><p>' + (isFish
        ? "The <b>Fish food table</b> turns a fish into the Seafood half of your menu. Every recipe is fixed — one species, one fruit, one dairy product — and they sit on levels <b>2, 5, 8 …</b>"
        : "The <b>Vegetarian corner</b> fills the Vegetarian half of your menu. Every recipe is fixed: the <b>greenhouse fruit and field crop of the SAME level</b> plus one dairy product — swap for the greenhouse half at the Slum's <b>Culinary exchange</b>. Recipes sit on levels <b>1, 4, 7 …</b>") +
      "</p><p>An hour of cooking costs " + (isFish
        ? "<b>" + c.fishPerHour + "</b> kg of fish, <b>" + c.fishFruitPerHour + "</b> fruit and <b>" + c.fishDairyPerHour + "</b> liters of dairy"
        : "<b>" + c.vegFruitPerHour + "</b> of each fruit and <b>" + c.vegDairyPerHour + "</b> liters of dairy") +
      ", pays <b>" + c.cookPointsPerHour + "</b> cooking points, and you can cook up to <b>" + c.maxHours +
      "</b> hours at a time. Cooking the same dish again <b>adds</b> to the time already on the menu.</p>" +
      '<table class="paytbl bookt"><tr><th class="q">Lvl</th><th class="nm">Dish</th><th>Made from</th></tr>' +
      rows + "</table></div>";
  }

  function renderCanteen() {
    var body;
    if (!ui.canRoom) body = canteenLanding();
    else if (ui.canRoom === "dairy") body = dairyRoom();
    else if (ui.canRoom === "granary") body = granaryRoom();
    else if (ui.canRoom === "fish") body = fishRoom();
    else if (ui.canRoom === "menu") body = menuRoom();
    else if (ui.canRoom === "veg") body = cookRoom(false);
    else if (ui.canRoom === "fishtab") body = cookRoom(true);
    $("locationPanel").innerHTML =
      '<div class="panel tav"><div class="bar">Tavern and Canteen</div>' +
      '<div class="tabs"><a data-act="landing">First floor (tavern)</a>' +
        '<a class="on" data-act="go-canteen">Second floor (dining room)</a></div>' +
      (ui.canRoom ? canteenNav() : "") +
      canteenRepHtml() +
      '<div id="canNotice" class="notice-slot">' + canteenNoticeHtml() + "</div>" +
      '<div class="can-body">' + body + "</div></div>";
  }

  /* ==================== MEDICINE LABORATORY (room 5) =================== */
  /* Fallback only — the real art is img/drugmachine.gif (which is the MEDICINE
   * machine despite the file name: the blue press with a package on the belt). */
  var MED_MACHINE_ART =
    '<svg class="mach-img" viewBox="0 0 150 110" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M18 78 V44 A38 38 0 0 1 94 44 V78 Z" fill="#6f93c9"/>' +
    '<path d="M18 78 V44 A38 38 0 0 1 56 20 V78 Z" fill="#8fb0dd"/>' +
    '<rect x="26" y="78" width="112" height="8" fill="#b9c3cd"/>' +
    '<g fill="#8a97a4"><circle cx="36" cy="90" r="5"/><circle cx="60" cy="90" r="5"/>' +
      '<circle cx="84" cy="90" r="5"/><circle cx="108" cy="90" r="5"/><circle cx="130" cy="90" r="5"/></g>' +
    '<rect x="30" y="52" width="52" height="26" fill="#f2f4f7" stroke="#9aa7b4"/>' +
    '<path d="M96 58 h34 v20 h-34 z" fill="#d9c39a" stroke="#a8865a"/>' +
    '<path d="M96 58 l17 9 l17 -9" fill="none" stroke="#a8865a"/>' +
    "</svg>";
  function medNoticeHtml() {
    return noticeHtml({ errors: ui.medErrors, err: ui.medError, msg: ui.medNotice, errLabel: "ERROR!",
                        levelUp: ui.medLevelUp, skill: "Medical science" });
  }
  /* Every medicine-lab table shares one shape: a name cell + a figure cell. */
  function medSect(a, b) { return '<tr class="sect"><th>' + a + "</th><th>" + b + "</th></tr>"; }
  function medRow(name, qty) { return '<tr><td class="nm">' + name + '</td><td class="q">' + fmt(qty) + "</td></tr>"; }
  function medHerbRows() {
    var hb = CF.medicine.herbs(), keys = Object.keys(hb).filter(function (k) { return hb[k] > 0; });
    if (!keys.length) return '<tr><td colspan="2" class="none">No medicinal herbs.</td></tr>';
    return keys.map(function (k) {
      return medRow(esc(k) + ' plant <span class="lvl">( Level ' + CF.medicine.plantLevel(k) + " )</span>", hb[k]);
    }).join("");
  }
  function medStockRows(withPrice) {
    var st = CF.medicine.stock(), keys = CF.medicineRecipes.map(function (r) { return r.name; })
      .filter(function (n) { return (st[n] || 0) > 0; });
    if (!keys.length) return '<tr><td colspan="' + (withPrice ? 4 : 2) + '" class="none">No ready-made medicines.</td></tr>';
    return keys.map(function (n) {
      if (!withPrice) return medRow(esc(n), st[n]);
      var sel = ui.medSell === n;
      var row = '<tr class="medrow' + (sel ? " on" : "") + '" data-act="med-pick" data-what="' + esc(n) + '">' +
        '<td class="rad"><span class="radio' + (sel ? " on" : "") + '"></span></td>' +
        '<td class="nm">' + esc(n) + "</td>" +
        '<td class="pr">' + fmt(CF.medicine.price(n)) + ' <span class="cc">CC</span></td>' +
        '<td class="q">' + fmt(st[n]) + "</td></tr>";
      if (!sel) return row;
      var have = st[n], unit = CF.medicine.price(n);
      var qty = Math.min(have, Math.max(1, parseInt(ui.medSellQty, 10) || have));
      return row + '<tr class="medsell"><td colspan="4">' +
        "<h4>How many items do you want to sell?</h4>" +
        '<div class="ms-row"><b>Quantity:</b> <input type="number" id="medSellQty" data-role="medsellqty" min="1" max="' +
          have + '" value="' + qty + '"> &times; ' + fmt(unit) + " = <b>" + fmt(unit * qty) + "</b> CC " +
        '<button class="btn" data-act="med-sell" data-what="' + esc(n) + '">Sell</button></div>' +
        "</td></tr>";
    }).join("");
  }
  function medHeader(extra) { return houseRoomHeaderN(5, extra); }
  function medHelpLink() {
    return '<p class="nb c"><b class="r">NOTE!</b> <a data-act="med-help">Read the tutorial on developing medical science!</a></p>';
  }

  function renderMedWarehouse() {
    $("locationPanel").innerHTML = medHeader("") +
      '<div id="medNotice" class="notice-slot">' + medNoticeHtml() + "</div>" +
      '<table class="medtbl med-herbs">' + medSect("Your medicinal herbs", "Quantity") + medHerbRows() + "</table>" +
      '<table class="medtbl med-stock"><tr class="sect"><th class="rad"></th><th>Ready-made medicines</th>' +
        '<th class="pr">Price</th><th class="q">Quantity</th></tr>' + medStockRows(true) + "</table>" + craftFooter();
  }

  function renderMedMachine() {
    var upgrade = ui.medMachineTab === "upgrade";
    var nav = '<div class="med-nav2">' +
      (upgrade ? '<a data-act="med-machine-tab" data-tab="use">Use the medicine machine</a>' : "<b>Use the medicine machine</b>") +
      " | " +
      (upgrade ? "<b>Improve the medicine machine</b>" : '<a data-act="med-machine-tab" data-tab="upgrade">Improve the medicine machine</a>') +
      "</div>";
    var body;
    if (upgrade) {
      var nx = CF.medicine.nextMachine(), lvl = CF.medicine.machineLevel();
      body = '<div class="station"><div class="st-left">' +
        '<div class="upg-box"><div class="bar2">Improve the medicine machine</div>' +
        (nx
          ? '<table class="medtbl upgtbl">' +
              '<tr><td class="nm">To improve you need:</td><td class="v">Level <b>' + nx.reqMedical + "</b> Medical Science<br>" +
                "Level <b>" + nx.reqHouse + "</b> House</td></tr>" +
              '<tr><td class="nm">Upgrade price:</td><td class="v"><b>' + fmt(nx.priceCC) + "</b> CC</td></tr></table>" +
            '<div class="upg-cap">Prepares up to <b class="r">' + nx.batch + "</b> medications at once</div>" +
            '<div class="cbtn"><button class="btn" data-act="med-upgrade">Improve the medicine machine</button></div>'
          : '<div class="med-none">The medicine machine is at its highest level.</div>') +
        "</div></div>" +
        '<div class="st-right"><div class="mach-art">' + (CF._svg.medmachine = MED_MACHINE_ART,
          locArt("drugmachine.gif", "mach-img", "medmachine", "Medicine machine")) +
          '<div class="mach-cap">Level <b>' + lvl + "</b> medicine machine</div></div></div></div>";
    } else {
      var opts = '<option value="">- What medicine do you want to make? -</option>' +
        CF.medicineRecipes.map(function (r) {
          return '<option value="' + esc(r.name) + '"' + (ui.medMake === r.name ? " selected" : "") + ">" +
            esc(r.name) + " (" + r.qty + "x " + esc(r.plant) + " plant)</option>";
        }).join("");
      var nOpts = "";
      for (var i = 1; i <= CF.medicine.batchMax(); i++) {
        nOpts += '<option value="' + i + '"' + (String(ui.medMakeQty) === String(i) ? " selected" : "") + ">" + i + "</option>";
      }
      body = '<div class="station"><div class="st-left">' +
        '<div class="prep-box"><div class="bar2">Prepare medications</div><div class="pb-body">' +
        '<select id="medMake" data-role="medmake">' + opts + "</select>" +
        '<div class="pb-qty">How many medicines do you prepare? <select id="medMakeQty" data-role="medmakeqty">' + nOpts + "</select></div>" +
        '<div class="cbtn"><button class="btn" data-act="med-prepare">Prepare the medicine(s)</button></div>' +
        "</div></div></div>" +
        '<div class="st-right">' +
          '<table class="medtbl med-side">' + medSect("Your medicinal herbs", "Quantity") + medHerbRows() +
            medSect("Ready-made medicines", "Quantity") + medStockRows(false) + "</table>" +
        "</div></div>";
    }
    $("locationPanel").innerHTML = medHeader("") +
      '<div id="medNotice" class="notice-slot">' + medNoticeHtml() + "</div>" +
      nav + body + medHelpLink() + craftFooter();
  }

  function renderPackingTable() {
    var pr = CF.medicine.progress(), K = CF.firstAidKit;
    var medRows = K.medicines.map(function (m) { return medRow(esc(m), CF.medicine.count(m)); }).join("");
    var hcRows = K.handicrafts.map(function (h) { return medRow(esc(h), CF.medicine.craftCount(h)); }).join("");
    $("locationPanel").innerHTML = medHeader("") +
      '<div id="medNotice" class="notice-slot">' + medNoticeHtml() +
        (ui.medErrors && ui.medErrors.length
          ? '<div class="med-hint">Medicines can be made from the link " <a data-act="go-medmachine">Medicine Machine</a> "</div>' : "") +
      "</div>" +
      '<div class="station"><div class="st-left">' +
        '<div class="prep-box"><div class="bar2">Prepare first aid kits</div><div class="pb-body">' +
        '<div class="cbtn"><button class="btn" data-act="med-pack">Prepare a first aid kit</button></div>' +
        '<div class="pb-pts">You earn <b class="r">' + fmt(CF.medicine.kitPoints(pr.level)) + "</b> points with one pack</div>" +
        "</div></div>" +
        '<table class="ctbl med-prog">' +
          "<tr><td>Medical science level:</td><td>" + fmt(pr.level) + "</td></tr>" +
          "<tr><td>Medical science points:</td><td>" + fmt(pr.into) + "</td></tr>" +
          "<tr><td>Points to level:</td><td>" + fmt(pr.pointsToLevel) + "</td></tr></table>" +
      "</div>" +
      '<div class="st-right"><table class="medtbl med-side">' +
        medSect("Necessary medications", "Quantity") + medRows +
        medSect("Handicraft items", "Quantity") + hcRows +
      "</table></div></div>" +
      '<div class="kit-total">You have a total of <b>' + fmt(CF.medicine.kits()) + "</b> first aid kits&hellip;</div>" +
      medHelpLink() + craftFooter();
  }

  function renderDrugLab() {
    $("locationPanel").innerHTML = houseRoomHeaderN(2, "") +
      '<div id="chemNotice" class="notice-slot">' + chemNoticeHtml() + "</div>" +
      '<div class="druglab">' +
        '<table class="mixtbl"><tr><th>Quantity</th><th>Narcotics</th><th class="plus"></th><th>Juice</th></tr>' +
        '<tr><td><input type="number" id="drugQty" data-role="drugqty" min="1" value="' + esc(ui.drugQty) + '"></td>' +
        '<td><select id="drugNarc" data-role="drugnarc">' + drugNarcOpts() + "</select></td>" +
        '<td class="plus">+</td>' +
        '<td><select id="drugJuice" data-role="drugjuice">' + drugJuiceOpts() + "</select></td></tr></table>" +
        '<div class="cbtn"><button class="btn" data-act="drug-mix">Mix these ingredients together</button></div>' +
        '<p class="street-link"><a data-act="go-streets">Go straight to the street &raquo;</a></p>' +
        '<div id="chemProg">' + chemProgressTable() + "</div>" +
        '<p class="nb"><b>NOTE!</b> Be sure to also check out the <a data-act="chem-help">Chemist skill help page</a>!</p>' +
      "</div>" + craftFooter();
  }

  /* Autoclicker-safe in-place mix (button never rebuilt; notice reserved). */
  function fastDrugMix() {
    var narc = ($("drugNarc") && $("drugNarc").value) || ui.drugNarc || "";
    var juice = ($("drugJuice") && $("drugJuice").value) || ui.drugJuice || "";
    var qty = ($("drugQty") && parseInt($("drugQty").value, 10)) || parseInt(ui.drugQty, 10) || 0;
    ui.chemError = null; ui.drugNarc = narc; ui.drugJuice = juice; if (qty) ui.drugQty = String(qty);
    function paint() { if ($("chemNotice")) $("chemNotice").innerHTML = chemNoticeHtml(); }
    if (!narc || !juice) { ui.chemError = "Pick a narcotic and a juice."; ui.chemLevelUp = null; paint(); return; }
    var base = juice.replace(/ juice$/, ""), drug = null;
    for (var k in CF.chemRecipes) { if (CF.chemRecipes[k].narcotic === narc && CF.chemRecipes[k].juiceBase === base) { drug = k; break; } }
    if (!drug) { ui.chemError = narc + " and " + juice + " don't combine into a drug."; ui.chemLevelUp = null; paint(); return; }
    var beforeLvl = CF.chemist.progress().level;
    var res = CF.chemist.mixDrug(drug, qty);
    if (!res.ok) { ui.chemError = res.msg; ui.chemLevelUp = null; paint(); return; }
    ui.chemNotice = res.msg;
    ui.lastMixDrug = drug;   // so "Go straight to the street" pre-selects it to sell
    var afterLvl = CF.chemist.progress().level;
    CF.autosave();
    if (afterLvl !== beforeLvl) { ui.chemLevelUp = afterLvl; renderPlace(); return; }
    ui.chemLevelUp = null;
    paint();
    if ($("drugNarc")) $("drugNarc").innerHTML = drugNarcOpts();
    if ($("drugJuice")) $("drugJuice").innerHTML = drugJuiceOpts();
    if ($("chemProg")) $("chemProg").innerHTML = chemProgressTable();
  }

  function renderLabCabinet() {
    var bp = CF.state.chemist.backpackPlants;
    var bar = bp ? '<div class="ybar">You have <b>' + esc(bp.item) + "</b> x <b>" + fmt(bp.qty) + "</b> in your backpack.</div>" +
      '<div class="cbtn"><button class="btn" data-act="lab-unload">Put the plants from the backpack into the closet</button></div>' : "";
    var sellPanel = '<div class="lab-sell">How much juice do you want to sell? ' +
      '<input type="number" id="labSellQty" data-role="labsellqty" min="1" value="' + esc(ui.labSellQty || "") + '"> ' +
      '<button class="btn" data-act="lab-sell-juice">Put it on the market for sale</button></div>';
    $("locationPanel").innerHTML = houseRoomHeaderN(2, "") +
      '<div id="chemNotice" class="notice-slot">' + chemNoticeHtml() + "</div>" + bar +
      '<div class="craft-tables">' + chemPlantsHtml() + chemJuicesHtml(true) + "</div>" +
      sellPanel + craftFooter();
  }

  /* ============================== STREETS ============================== */
  function renderStreets() {
    var belt = CF.state.chemist.belt, used = CF.chemist.beltUsed(), cap = CF.chemist.beltCap(), room = CF.chemist.beltRoom();
    var P = CF.state.player, country = ui.streetCountry;
    // notify whenever your FAME already permits a bigger belt than you're wearing
    var maxBelt = CF.chemist.maxBeltForFame(totalFame());
    var fameNote = maxBelt > cap
      ? '<div class="fame-belt"><span class="i">&#8505;</span> Your fame allows you to wear an <b>' + maxBelt + ' g</b> drug belt. You are currently wearing an <b>' + cap + ' g</b> drug belt.' +
        '<div class="fb-go"><a data-act="market-drugbelt">Go to the MARKET and buy</a></div></div>'
      : "";
    var countryOpts = CF.countries.map(function (c) { return "<option" + (c === country ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("");
    // Buy list — radio per narcotic, then one "How many grams? [Buy]" bar (screenshot).
    var buyRows = CF.narcoticOrder.map(function (n) {
      var on = ui.buyNarcSel === n;
      return '<tr class="pick' + (on ? " on" : "") + '" data-act="buy-narc-row" data-narc="' + esc(n) + '">' +
        '<td class="c"><input type="radio" name="buynarc"' + (on ? " checked" : "") + "></td>" +
        "<td><b>" + esc(n) + ":</b></td>" +
        '<td class="r">' + fmt(CF.chemist.priceIn(country, n)) + ' <span class="cc">CC</span></td></tr>';
    }).join("");
    var grams = ui.streetGrams !== "" && ui.streetGrams != null ? ui.streetGrams : String(room || cap);
    var buyBar = room > 0
      ? '<div class="buy-bar">How many grams? <input type="number" id="streetGrams" data-role="streetgrams" min="1" value="' + esc(grams) + '"> <button class="btn" data-act="street-buy">Buy</button></div>'
      : '<div class="belt-full">The drug belt is full.</div>';
    // Your drug belt — radio-select + sell (prices vary by country too).
    var beltKeys = Object.keys(belt).filter(function (k) { return belt[k] > 0; });
    var beltBody;
    if (beltKeys.length) {
      var beltRows = beltKeys.map(function (k) {
        var on = ui.beltSel === k;
        return '<tr class="pick' + (on ? " on" : "") + '" data-act="belt-row" data-drug="' + esc(k) + '">' +
          '<td class="c"><input type="radio" name="beltsel"' + (on ? " checked" : "") + "></td>" +
          "<td><b>" + esc(k) + "</b></td>" +
          '<td class="r">' + fmt(CF.chemist.priceIn(country, k)) + ' <span class="cc">CC</span></td>' +
          '<td class="c"><b>' + fmt(belt[k]) + "g</b></td></tr>";
      }).join("");
      beltBody = '<table class="mktab"><tr><th></th><th>Narcotics</th><th class="r">Price per gram</th><th class="c">Quantity</th></tr>' + beltRows + "</table>" +
        '<div class="cbtn"><button class="btn" data-act="street-sell">Sell selected drugs</button> <span class="belt-total">Total ' + fmt(used) + "g</span></div>";
    } else {
      beltBody = '<div class="belt-empty">The drug belt is empty.</div>';
    }
    $("locationPanel").innerHTML =
      '<div class="panel"><div class="bar">Streets</div>' +
      '<div class="street-loc">Location &mdash; Country <select id="streetCountry" data-role="streetcountry">' + countryOpts + "</select></div>" +
      fameNote +
      '<div id="streetNotice" class="notice-slot">' + streetNoticeHtml() + "</div>" +
      '<div class="street-cols">' +
        '<div class="street-buy"><div class="bar2">Buy drugs: (price per gram)</div>' +
          '<table class="mktab">' + buyRows + "</table>" + buyBar + "</div>" +
        '<div class="street-belt"><div class="bar2">Your drug belt (holds ' + fmt(cap) + ' g)</div>' + beltBody +
          '<p class="street-back"><a data-act="go-druglab">Go to the Lab &raquo;</a></p></div>' +
      "</div></div>";
  }

  /* ========================= BOTANICAL GARDEN ========================== */
  var GREENHOUSE_ART =
    '<svg class="gh-art" viewBox="0 0 230 150" xmlns="http://www.w3.org/2000/svg">' +
    '<ellipse cx="115" cy="132" rx="112" ry="16" fill="#7f9a6a"/>' +
    '<path d="M20 118 L58 96 h130 l22 14 z" fill="#9aa88c"/>' +
    '<g><path d="M58 96 L86 60 h96 l-24 36 z" fill="#cfd3b0" stroke="#8f9678"/>' +
    '<path d="M86 60 h96 l16 26 h-88 z" fill="#dfe3c4" stroke="#8f9678"/>' +
    '<g stroke="#9fb6c9" fill="#bcd6e6"><rect x="96" y="64" width="30" height="18"/>' +
    '<rect x="132" y="64" width="30" height="18"/><rect x="70" y="76" width="26" height="16"/></g></g>' +
    '<g fill="#4f7f4a"><polygon points="26,116 38,80 50,116"/><polygon points="186,116 198,78 210,116"/></g>' +
    '<g fill="#6b4a2f"><rect x="35" y="114" width="5" height="8"/><rect x="195" y="114" width="5" height="8"/></g>' +
    '<g fill="#6f8f5f"><circle cx="118" cy="106" r="5"/><circle cx="134" cy="108" r="4"/><circle cx="102" cy="109" r="4"/></g>' +
    "</svg>";

  var GARDEN_TABS = [
    { id: "edible",    label: "Edible herb garden" },
    { id: "medicinal", label: "Medicinal herb beds" },
    { id: "greenhouse",label: "Greenhouse" },
    { id: "tickets",   label: "Ticket Office" },
  ];
  function gardenTabsHtml() {
    function link(t) {
      return '<div class="gt"><a class="' + (ui.gardenTab === t.id ? "cur" : "") + '" data-act="garden-tab" data-tab="' + t.id + '">' + esc(t.label) + "</a></div>";
    }
    // before you are a gardener there are no plots to visit — the reference
    // shows a single stacked column headed by the [Become a gardener] claim
    if (!CF.garden.isGardener()) {
      return '<div class="garden-tabs one">' +
        '<div class="gt claim"><a data-act="become-gardener">[Become a gardener]</a></div>' +
        GARDEN_TABS.slice(2).map(link).join("") + "</div>";
    }
    // two columns: the two garden plots on the left, greenhouse + office on the right
    return '<div class="garden-tabs"><div>' + GARDEN_TABS.slice(0, 2).map(link).join("") + "</div>" +
      "<div>" + GARDEN_TABS.slice(2).map(link).join("") + "</div></div>";
  }
  function hoursMinutes(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h + " hour" + (h === 1 ? "" : "s") + " and " + m + " minute" + (m === 1 ? "" : "s");
  }
  function gardenSkillLines(lower) {
    var s = CF.garden.stealProgress(), g = CF.garden.gardenProgress();
    return "<div>Your " + (lower ? "stealing" : "Stealing") + " is <b>" + fmt(s.level) + "</b> and you need <b>" + fmt(s.pointsToLevel) + "</b> points to level up.</div>" +
      "<div>Your " + (lower ? "gardening" : "Gardening") + " is <b>" + fmt(g.level) + "</b> and you need <b>" + fmt(g.pointsToLevel) + "</b> points to level up.</div>";
  }
  function ticketInfoHtml() {
    var G = CF.state.garden, left = CF.garden.ticketOfficeSecondsLeft(), can = CF.garden.buyableTickets();
    return '<div class="garden-info">' +
      "<div>You have <b>" + fmt(G.tickets) + "</b> greenhouse tickets left.</div>" +
      (left > 0
        ? "<div>The ticket office will reopen in <b>" + hoursMinutes(left) + "</b>.</div>"
        : "<div>The ticket office is <b>open</b> . You can buy <b>" + fmt(can) + "</b> greenhouse tickets.</div>") +
      gardenSkillLines(false) +
      "<div>You can put greenhouse tickets on the market <b>now</b> !</div></div>";
  }
  /* The land/pest info block shared by the Benefits and Edible-garden tabs. */
  function gardenLandInfoHtml() {
    var G = CF.state.garden, pe = G.pests || {}, cd = CF.garden.landCooldownLeft();
    return '<div class="garden-info">' +
      "<div>You have <b>" + fmt(CF.garden.landM2()) + "m&sup2;</b> of garden land and it can accommodate <b>" +
        fmt(CF.garden.plotCapacity()) + "</b> plants.</div>" +
      "<div>Your garden land type is <b>" + esc(G.landType) + "</b>, where <b>" + fmt(CF.garden.plots().length) + "</b> plants grow.</div>" +
      "<div>Pests in the garden land: <b>" + fmt(pe.caterpillars || 0) + "</b> caterpillars, <b>" +
        fmt(pe.birds || 0) + "</b> birds and <b>" + fmt(pe.moles || 0) + "</b> moles.</div>" +
      gardenSkillLines(true) +
      "<div>" + (cd > 0 ? "You can buy garden land again in <b>" + hoursMinutes(cd) + "</b>."
                        : "The office offers you garden land for sale!") + "</div></div>";
  }
  function gardenNoticeHtml() {
    return noticeHtml({
      err: ui.gardenError, msg: ui.gardenNotice,
      before: ui.gardenPtsMsg ? '<div class="levelup">' + esc(ui.gardenPtsMsg) + "</div>" : "",
      after: ui.gardenBackpackBar ? '<div class="ybar"><a data-act="go-labcabinet">Look at your backpack.</a></div>' : "",
      levelUp: ui.gardenLevelUp, skill: ui.gardenLevelUp && ui.gardenLevelUp.skill });
  }
  function stealBlock(title, selId, role, opts, act, btnLabel) {
    return '<div class="steal-block"><div class="bar2">' + esc(title) + "</div>" +
      '<div class="sb-body"><select id="' + selId + '" data-role="' + role + '">' + opts + "</select>" +
      '<div class="cbtn"><button class="btn" data-act="' + act + '">' + esc(btnLabel) + "</button></div></div></div>";
  }
  /* A locked steal block prints its requirement where the dropdown would be. */
  function lockedBlock(title, msg) {
    return '<div class="steal-block"><div class="bar2">' + esc(title) + "</div>" +
      '<div class="sb-body"><div class="sb-locked">' + msg + "</div></div></div>";
  }
  function renderGarden() {
    var tab = ui.gardenTab, body, info = "";
    // the plot tabs don't exist until you are a gardener
    if (!CF.garden.isGardener() && (tab === "edible" || tab === "medicinal")) tab = ui.gardenTab = "greenhouse";
    // beds whose timer ran out are harvested on arrival (like the endurance run)
    var reaped = CF.garden.settleMedBeds();
    if (reaped) {
      ui.gardenNotice = "Harvested " + fmt(reaped.beds) + " medicinal bed" + (reaped.beds === 1 ? "" : "s") +
        " — " + fmt(reaped.plants) + " plants and " + fmt(reaped.points) + " gardening points.";
      CF.autosave();
    }
    if (tab === "greenhouse") {
      // drug plants keep their position number in the full list, like the reference
      var plantOpts = '<option value="">- Choose plants -</option>' + CF.gardenDrugPlants.map(function (p, i) {
        var okp = CF.garden.availableDrugPlants().indexOf(p) >= 0;
        return '<option value="' + esc(p.name) + '"' + (okp ? "" : " disabled") + (ui.stealPlantSel === p.name ? " selected" : "") +
          ">" + (i + 1) + ". " + esc(p.name) + " plants (Level " + p.chem + ")" + (okp ? "" : " 🔒") + "</option>";
      }).join("");
      function seedOpts(kind, sel) {
        var list = kind === "medicinal" ? CF.gardenMedicinalSeeds : CF.gardenEdibleSeeds;
        var g = CF.garden.gardenProgress().level;
        return '<option value="">- Choose seeds -</option>' + list.map(function (s) {
          return '<option value="' + esc(s.name) + '"' + (s.lvl <= g ? "" : " disabled") + (sel === s.name ? " selected" : "") +
            ">" + esc(s.name) + " plant (Level " + s.lvl + ")" + (s.lvl <= g ? "" : " 🔒") + "</option>";
        }).join("");
      }
      info = ticketInfoHtml();
      var hl = CF.ruleset.garden.gardenerHouseLevel;
      body = '<div id="gardenNotice">' + gardenNoticeHtml() + "</div>" +
        stealBlock("Steal plants to make drugs", "stealPlant", "stealplant", plantOpts, "steal-plants", "Steal plants") +
        (CF.garden.canStealEdibleSeeds()
          ? stealBlock("Steal seeds to grow edible plants", "stealEdible", "stealedible", seedOpts("edible", ui.stealEdibleSel), "steal-edible", "Steal the seeds of an edible plant")
          : lockedBlock("Steal seeds to grow edible plants", "You have to buy a tavern to steal the seeds of a food plant!")) +
        (CF.garden.canStealMedSeeds()
          ? stealBlock("Steal seeds to grow medicinal plants", "stealMed", "stealmed", seedOpts("medicinal", ui.stealMedSel), "steal-medicinal", "Steal the seeds of a medicinal plant")
          : lockedBlock("Steal seeds to grow medicinal plants", "Your house must be at least <b>level " + hl + "</b> to steal herb seeds!")) +
        '<p class="garden-help"><a data-act="garden-help">Read the help page on stealing from the garden</a></p>';
    } else if (tab === "tickets") {
      var left = CF.garden.ticketOfficeSecondsLeft();
      info = ticketInfoHtml();
      body = '<div id="gardenNotice">' + gardenNoticeHtml() + "</div>" +
        (left > 0
          ? '<div class="office-closed">YOU CANNOT BUY TICKETS HERE AT THE MOMENT BECAUSE THE BOX OFFICE IS CLOSED!' +
            '<div class="oc-sub"><a data-act="market-tickets">If you still want to buy tickets, you can do so at the market&hellip;</a></div></div>'
          : (function () {
              var can = CF.garden.buyableTickets(), cost = can * CF.ruleset.garden.ticketPriceCC;
              return '<div class="ticket-buy">You can buy <b class="tq">' + fmt(can) + "</b> greenhouse tickets and they cost <b class=\"tq\">" + fmt(cost) + "</b> CC." +
                '<div class="cbtn"><button class="btn" data-act="buy-tickets">I BUY TICKETS</button></div></div>';
            })());
    } else if (tab === "gardener") {
      // the claim failed — one ERROR row per unmet requirement, as in the reference
      info = ticketInfoHtml();
      body = '<div class="gardener-errs">' + (ui.gardenErrors || []).map(function (m) {
        return '<div class="notice err"><b>ERROR!</b> ' + esc(m).replace(/level (\d+)/, "level <b>$1</b>") + "</div>";
      }).join("") + "</div>";
    } else if (tab === "medicinal") {
      info = ticketInfoHtml();
      body = medicinalPanel();
    } else if (tab === "edible") {
      info = gardenLandInfoHtml();
      body = ediblePanel();
    } else {
      body = "";
    }

    CF._svg.greenhouse = GREENHOUSE_ART;
    // two columns: tabs + centred info on the left, artwork on the right — so the
    // info text stays in a clean centred block instead of wrapping round the image.
    $("locationPanel").innerHTML =
      '<div class="panel"><div class="bar">Garden</div>' +
      '<div class="garden-head"><div class="gh-left">' + gardenTabsHtml() + info + "</div>" +
        '<div class="gh-right">' + locArt("botanical-garden.gif", "gh-art", "greenhouse", "Garden") + "</div></div>" +
      body + "</div>";
  }

  /* ---- Medicinal herb beds (sub-nav: beds | office | sow) -------------- */
  function medSubNav() {
    var v = ui.medView || "beds", inUse = CF.garden.medBedsInUse(), max = CF.garden.medBedsMax();
    function link(id, label) {
      return v === id ? "<b>" + esc(label) + "</b>"
                      : '<a data-act="med-view" data-view="' + id + '">' + esc(label) + "</a>";
    }
    return '<div class="med-nav">' + link("beds", "Medicinal plant beds") +
      " (in use: <b>" + inUse + "/" + max + "</b> ) | " + link("office", "Your office") +
      " | " + link("sow", "Sow seeds") + "</div>";
  }
  function medBedsTable() {
    var beds = CF.garden.medBeds();
    if (!beds.length) return '<div class="med-empty">No plants grow in the medicinal herb beds.</div>';
    var rows = beds.map(function (b, i) {
      var left = Math.max(0, b.endsAt - Date.now()), ready = left <= 0;
      var h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000);
      // a finished bed gets a "Cut this plant" link that banks the herbs + points
      return "<tr>" +
        '<td class="c cut">' + (ready ? '[ <a data-act="med-cut" data-bed="' + i + '">Cut this plant</a> ]' : "") + "</td>" +
        "<td><b>" + (i + 1) + ".</b> " + esc(b.plant) + ' plant <span class="lvl">( Level ' + b.level + " )</span></td>" +
        '<td class="c">' + (ready ? "<b>READY</b>" : h + "h " + m + "min") + "</td></tr>";
    }).join("");
    return '<table class="mktab med-tab"><tr><th></th><th>Medicinal plant beds</th><th class="c">Until completion</th></tr>' + rows + "</table>";
  }
  function medSowForm() {
    var seeds = CF.state.garden.medicinalSeeds || {};
    var keys = Object.keys(seeds).filter(function (k) { return seeds[k] > 0; });
    var free = CF.garden.medBedsMax() - CF.garden.medBedsInUse();
    var head = '<div class="bar2">What medicinal herbs do you want to grow?</div>';
    if (!keys.length) {
      return head + '<div class="med-box"><div class="med-none">You have no seeds to sow!</div>' +
        '<div class="nb"><b>NOTE!</b> Seeds can be <a data-act="garden-tab" data-tab="greenhouse">stolen from the greenhouse</a>.</div></div>';
    }
    if (free <= 0) {
      return head + '<div class="med-box"><div class="med-none">All your medicinal plant beds are in use!</div>' +
        '<div class="nb">Wait for a bed to finish, or buy another at <a data-act="med-view" data-view="office">your office</a>.</div></div>';
    }
    // keep the reference's numbering: position in the full medicinal seed list
    var plantOpts = '<option value="">- Choose a plant -</option>' + CF.gardenMedicinalSeeds.map(function (s, i) {
      if (!seeds[s.name]) return "";
      return '<option value="' + esc(s.name) + '"' + (ui.medSeedSel === s.name ? " selected" : "") + ">" +
        (i + 1) + ". " + esc(s.name) + " seeds (" + fmt(seeds[s.name]) + " seed packet" + (seeds[s.name] === 1 ? "" : "s") + ")</option>";
    }).join("");
    var durOpts = '<option value="">- Choose duration -</option>' + CF.medSowDurations.map(function (d) {
      return '<option value="' + d.hours + '"' + (String(ui.medDurSel) === String(d.hours) ? " selected" : "") + ">" +
        d.hours + " hours, " + d.plants + " plants - " + fmt(CF.garden.medPointsPerBed()) + " gardening point" +
        (CF.garden.medPointsPerBed() === 1 ? "" : "s") + "</option>";
    }).join("");
    return head + '<div class="med-box">' +
      '<div class="mf"><select id="medSeed" data-role="medseed">' + plantOpts + "</select></div>" +
      '<div class="mf"><b>How many packets of seeds are you sowing?</b> ' +
        '<input type="number" id="medPackets" data-role="medpackets" min="1" max="' + free + '" value="' + esc(ui.medPackets || "1") + '"></div>' +
      '<div class="mf"><b>How long to sow:</b><br><select id="medDur" data-role="meddur">' + durOpts + "</select></div>" +
      '<div class="cbtn"><button class="btn" data-act="med-sow">Sow the seeds</button></div></div>';
  }
  function medOfficePanel() {
    var r = CF.ruleset.garden;
    return '<div class="bar2">Buying medicinal plant beds</div>' +
      '<div class="med-box"><div class="med-office">The hospital must be at least <b>Level ' + r.medBedsHospitalLevel +
      "</b> to buy a bed here.</div>" +
      '<div class="nb">The Hospital isn\'t built yet, so you keep the <b>' + r.medBedsMax + "</b> starting beds.</div></div>";
  }
  /* ---- Edible herb garden (Edible Garden | Your Office | Sow Seeds | Pests) -- */
  function edibleSubNav() {
    var v = ui.edView || "garden";
    function link(id, label) {
      return v === id ? "<b>" + esc(label) + "</b>"
                      : '<a data-act="ed-view" data-view="' + id + '">' + esc(label) + "</a>";
    }
    return '<div class="med-nav">' + link("garden", "Edible Garden") + " | " + link("office", "Your Office") +
      " | " + link("sow", "Sow Seeds") + " | " + link("pests", "Control Pests") + "</div>";
  }
  function edibleGardenView() {
    CF.garden.settlePlots();
    var g = CF.ruleset.garden, ps = CF.garden.plots();
    if (!ps.length) return '<div class="med-empty">There are currently no plants growing in your garden.</div>';
    var rows = ps.map(function (p, i) {
      var left = Math.max(0, p.endsAt - Date.now()), ready = left <= 0;
      var pct = Math.max(0, Math.min(100, p.moisture / g.moistureMax * 100));
      var low = p.moisture <= g.moistureMin;
      // col 1 selects a plant for MANUAL watering — hidden once a waterer is on it
      return '<tr' + (p.dead ? ' class="gone"' : "") + ">" +
        '<td class="c">' + (p.autoWater || p.dead ? "" : '<input type="checkbox" class="plotck" data-i="' + i + '">') + "</td>" +
        '<td class="c"><span class="moist' + (low ? " low" : "") + '"><i style="width:' + pct.toFixed(0) + '%"></i></span> ' +
          fmt(p.moisture) + "/" + fmt(g.moistureMax) + "</td>" +
        "<td><b>" + esc(p.plant) + '</b> plant <span class="lvl">( Level ' + p.level + " )</span></td>" +
        '<td class="c">' + (p.autoWater ? "&#10003;" : p.dead ? "" : '<input type="checkbox" class="wck" data-i="' + i + '">') + "</td>" +
        '<td class="c">' + (p.dead ? "<b>eaten by pests</b>"
                            : ready ? '[ <a data-act="ed-harvest" data-i="' + i + '">Harvest</a> ]' : hms(left / 1000)) + "</td></tr>";
    }).join("");
    var wLeft = CF.garden.waterLeftThisHour();
    return '<div class="ed-top">' + (wLeft > 0
        ? "This hour you can water <b>" + fmt(wLeft) + "</b> more plants."
        : "You have watered every plant you can this hour — the allowance returns in <b>" +
          mmss(CF.garden.secondsToWaterReset()) + "</b>.") + "</div>" +
      '<div class="ed-actions"><b>What do you want to do?</b> ' +
        '<select id="edAction" data-role="edaction"><option value="water">Water the selected plants</option>' +
        '<option value="remove">Remove all damaged plants.</option></select> ' +
        '<button class="btn" data-act="ed-go">Go</button>' +
        '<button class="btn" data-act="ed-sprinklers">Install automatic sprinklers</button></div>' +
      '<table class="mktab ed-tab"><tr><th class="c"></th><th class="c">Plant moisture</th><th>Plant name</th>' +
        '<th class="c">Waterer</th><th class="c">Until completion</th></tr>' + rows + "</table>" +
      '<p class="garden-help"><a data-act="ed-help">Read the tutorial on gardening</a></p>';
  }
  function edibleOfficeView() {
    var g = CF.ruleset.garden, cd = CF.garden.landCooldownLeft();
    var land = '<div class="bar2">Buying garden land for edible plants</div><div class="med-box">' +
      (cd > 0
        ? "You can buy garden land here in <b>" + hoursMinutes(cd) + "</b>."
        : "You are offered <b>1 m&sup2;</b> of garden land for <b class=\"tq\">" + fmt(g.landPriceCC) + "</b> CC&hellip;" +
          '<div class="cbtn"><button class="btn go" data-act="ed-buy-land">BUY LAND</button></div>') + "</div>";
    var rows = CF.gardenTools.map(function (t) {
      var have = CF.garden.toolCount(t.name);
      return "<tr><td>" + esc(t.name) + "</td>" +
        '<td class="r"><b>' + fmt(t.price) + '</b> <span class="cc">CC</span></td>' +
        '<td class="c">' + t.allowed + '</td><td class="c"><b>' + have + "</b></td>" +
        '<td class="c"><input type="number" min="0" max="' + (t.allowed - have) + '" value="0" class="toolqty" data-tool="' + esc(t.name) + '"></td></tr>';
    }).join("");
    return land + '<div class="bar2">Your tools</div>' +
      '<table class="mktab"><tr><th>Device name</th><th class="r">Price for one</th><th class="c">Allowed</th>' +
        '<th class="c">Existing</th><th class="c">How many are you buying?</th></tr>' + rows + "</table>" +
      '<div class="cbtn"><button class="btn" data-act="ed-buy-tools">BUY equipment</button></div>';
  }
  function edibleSowView() {
    var seeds = CF.state.garden.edibleSeeds || {};
    var keys = Object.keys(seeds).filter(function (k) { return seeds[k] > 0; });
    var head = '<div class="bar2">Sow seeds</div>';
    if (!keys.length) {
      return head + '<div class="med-box"><div class="med-none">You have no seeds to sow!</div>' +
        '<div class="nb"><b>NOTE!</b> Seeds can be <a data-act="garden-tab" data-tab="greenhouse">stolen from the greenhouse</a>.</div></div>';
    }
    var free = CF.garden.plotCapacity() - CF.garden.plots().length;
    if (free <= 0) {
      return head + '<div class="med-box"><div class="med-none">Your garden is full!</div>' +
        '<div class="nb">Buy more land at <a data-act="ed-view" data-view="office">your office</a>.</div></div>';
    }
    var opts = '<option value="">- Choose a plant -</option>' + CF.gardenEdibleSeeds.map(function (s, i) {
      if (!seeds[s.name]) return "";
      return '<option value="' + esc(s.name) + '"' + (ui.edSeedSel === s.name ? " selected" : "") + ">" +
        (i + 1) + ". " + esc(s.name) + " plant (" + fmt(seeds[s.name]) + " seeds)</option>";
    }).join("");
    return head + '<div class="med-box">' +
      '<div class="mf"><select id="edSeed" data-role="edseed">' + opts + "</select></div>" +
      '<div class="mf"><b>How many seeds do you sow?</b> ' +
        '<input type="number" id="edCount" data-role="edcount" min="1" max="' + free + '" value="' + esc(ui.edCount || "1") + '"></div>' +
      '<div class="cbtn"><button class="btn" data-act="ed-sow">Sow the seeds</button></div></div>';
  }
  function ediblePestsView() {
    var rows = CF.gardenPests.map(function (pe) {
      return "<tr><td><b>" + esc(pe.label) + '</b></td><td class="c">' + fmt(CF.state.garden.pests[pe.key] || 0) + "</td>" +
        '<td class="c"><button class="btn" data-act="ed-pest" data-pest="' + pe.key + '">' + esc(pe.action) + "</button></td></tr>";
    }).join("");
    return '<table class="mktab ed-pest"><tr><th>Pests</th><th class="c">How many?</th><th class="c">Activity</th></tr>' + rows + "</table>";
  }
  function ediblePanel() {
    var v = ui.edView || "garden";
    return '<div id="gardenNotice">' + gardenNoticeHtml() + "</div>" + edibleSubNav() +
      (v === "office" ? edibleOfficeView() : v === "sow" ? edibleSowView()
       : v === "pests" ? ediblePestsView() : edibleGardenView());
  }

  function medicinalPanel() {
    var v = ui.medView || "beds";
    return '<div id="gardenNotice">' + gardenNoticeHtml() + "</div>" + medSubNav() +
      (v === "sow" ? medSowForm() : v === "office" ? medOfficePanel() : medBedsTable()) +
      '<p class="garden-help"><a data-act="med-help">Read the tutorial on developing medical science</a></p>';
  }

  /* Shared result handler for garden actions: shows the notice, catches a
   * Gardening level-up, saves and re-renders. */
  function gardenResult(res) {
    ui.gardenError = null; ui.gardenNotice = null; ui.gardenPtsMsg = null;
    ui.gardenBackpackBar = false; ui.gardenLevelUp = null;
    var before = CF.garden.gardenProgress().level;
    if (!res.ok) { ui.gardenError = res.msg; renderPlace(); return; }
    ui.gardenNotice = res.msg;
    var after = CF.garden.gardenProgress().level;
    if (after !== before) ui.gardenLevelUp = { skill: "Gardening", level: after };
    CF.autosave(); renderSidebar(); renderPlace();
  }
  /* Ticked plots — `.plotck` = selected for manual watering, `.wck` = selected
   * for a permanent waterer. */
  function checkedPlots(sel) {
    return Array.prototype.filter.call(document.querySelectorAll(sel || ".plotck"), function (c) { return c.checked; })
      .map(function (c) { return parseInt(c.getAttribute("data-i"), 10); });
  }

  /* One steal handler for all three greenhouse blocks. Each costs 1 ticket and
   * awards Stealing points; plants go to the backpack, seeds to the seed store. */
  function doSteal(kind) {
    ui.gardenError = null; ui.gardenNotice = null; ui.gardenPtsMsg = null;
    ui.gardenBackpackBar = false; ui.gardenLevelUp = null;
    var before = CF.garden.stealProgress().level, res;
    if (kind === "plants") {
      var pv = ($("stealPlant") && $("stealPlant").value) || ui.stealPlantSel || "";
      ui.stealPlantSel = pv;
      res = CF.garden.stealPlants(pv);
    } else {
      var id = kind === "medicinal" ? "stealMed" : "stealEdible";
      var sv = ($(id) && $(id).value) || (kind === "medicinal" ? ui.stealMedSel : ui.stealEdibleSel) || "";
      if (kind === "medicinal") ui.stealMedSel = sv; else ui.stealEdibleSel = sv;
      res = CF.garden.stealSeeds(kind, sv);
    }
    if (!res.ok) { ui.gardenError = res.msg; renderPlace(); return; }
    ui.gardenNotice = res.msg;
    ui.gardenPtsMsg = "You got " + fmt(res.pts) + " steal point" + (res.pts === 1 ? "" : "s") + ".";
    if (kind === "plants") ui.gardenBackpackBar = true;   // "Look at your backpack."
    var after = CF.garden.stealProgress().level;
    if (after !== before) ui.gardenLevelUp = { skill: "Stealing", level: after };
    CF.autosave(); renderPlace();
  }

  /* ========================= SPORTS COMPLEX ============================ */
  var SPORTS_ART =
    '<svg class="sportart" viewBox="0 0 700 150" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="700" height="150" fill="#cfd8e0"/><rect y="96" width="700" height="54" fill="#8fae7a"/>' +
    '<g fill="#a8794f"><rect x="30" y="52" width="90" height="52"/></g><rect x="26" y="46" width="98" height="10" fill="#7d5636"/>' +
    '<g fill="#9c3f3f"><polygon points="150,52 215,22 280,52"/></g><rect x="150" y="52" width="130" height="52" fill="#c3cbd2"/>' +
    '<g fill="#3f7d6b"><rect x="300" y="66" width="90" height="38"/></g><rect x="296" y="60" width="98" height="8" fill="#2f5f50"/>' +
    '<g fill="#8f8f96"><rect x="420" y="40" width="150" height="64" rx="10"/></g>' +
    '<g fill="#2f5f3f"><polygon points="600,104 618,58 636,104"/><polygon points="640,104 656,66 672,104"/>' +
    '<polygon points="130,104 146,64 162,104"/></g>' +
    '<g stroke="#b9c6cf" stroke-width="6" fill="none"><path d="M0 120 H700"/></g></svg>';

  /* Facility strip — same two-line "name / Access: X" look as the Slum areas. */
  function sportsFacNav() {
    return '<div class="slum-areas sport-areas">' + CF.sportsFacilities.map(function (f) {
      var acc = CF.sports.access(f.id), sel = ui.sportsFac === f.id ? " sel" : "";
      var cls = acc === "ON" ? "on" : "no";
      return '<div class="area' + sel + '" data-act="sports-fac" data-fac="' + f.id + '">' +
        '<div class="a-name"><a>' + esc(f.name) + "</a></div>" +
        '<div class="a-acc">Access: <b class="' + cls + '">' + acc + "</b></div></div>";
    }).join("") + "</div>";
  }
  function sportsEquipHtml() {
    return '<table class="ctab sport-eq"><tr><th>Equipment</th><th>Duration</th></tr>' +
      CF.sportsEquipment.map(function (e) {
        return "<tr><td>" + esc(e.name) + '</td><td class="c"><b>' + fmt(CF.sports.equip(e.name)) + "</b> " + esc(e.unit) + "</td></tr>";
      }).join("") + "</table>";
  }
  /* Steroid availability line. Buying starts a 24-hour cooldown; while it runs we
   * show the live countdown instead of the "NOW !" link. (The reference's
   * buy-with-credit line is omitted — Credits are premium and unused here.) */
  function steroidLinkHtml() {
    var left = Math.max(0, 86400000 - (Date.now() - (CF.state.sports.lastSteroidBuy || 0)));
    return '<div class="ster-links">' + (left > 0
      ? 'You can buy steroids in the store after <b id="sterCd">' + hms(left / 1000) + "</b>."
      : '<a data-act="sports-steroid-buy">You can buy steroids in the store NOW !</a>') + "</div>";
  }
  function sportsNoticeHtml() {
    return noticeHtml({ err: ui.sportError, msg: ui.sportNotice, reserve: true });
  }
  function trailPanel() {
    var d = CF.sports.endurance(), run = CF.sports.runState();
    if (run) {
      var left = CF.sports.runSecondsLeft(), h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60);
      return '<div class="sp-need">You need <b>' + fmt(d.pointsToLevel) + "</b> more stamina points to level up.</div>" +
        '<div class="run-live">The planned running time is <b>' + run.hours + "</b> hours.<br>" +
        "The running will last another <b>" + h + "</b> hours and <b>" + m + "</b> minutes.<br>" +
        "During this time you will gain <b>" + fmt(run.points) + "</b> stamina points.</div>" +
        '<div class="cbtn"><button class="btn" data-act="sports-pause">Pause workout</button></div>' +
        '<div class="sure"><label><input type="checkbox" id="sureBox"> I am sure.</label></div>' +
        '<p class="nb">NB: Steroids and equipment are not compensated.</p>';
    }
    var opts = CF.runningOptions.map(function (o) {
      var on = ui.runHours === o.hours;
      /* The hours are counted in updates, so the finish time is a clock time —
       * show it, or "1 hour" looks broken when it lands 20 minutes later. */
      return '<div class="run-opt" data-act="run-opt" data-hours="' + o.hours + '">' +
        '<input type="radio" name="runopt"' + (on ? " checked" : "") + "> " +
        "<b>" + o.hours + "</b> hour" + (o.hours === 1 ? "" : "s") + " - trains <b>" + o.points + "</b> points and spends <b>" + o.boots + "</b> boots" +
        ' <span class="run-ends">ends ' + hhmm(CF.clock.slotsAhead(o.hours)) + "</span></div>";
    }).join("");
    return '<div class="sp-need">You need <b>' + fmt(d.pointsToLevel) + "</b> more stamina points to level up.</div>" +
      '<div class="run-title">Choose running time:</div>' + opts +
      '<p class="nb">Running finishes on the update, so the first hour is short by however far into this one you set off.</p>' +
      '<div class="sure"><label>Are you using steroids? <input type="checkbox" id="runSteroids" data-role="runsteroids"' + (ui.runSteroids ? " checked" : "") + "></label></div>" +
      '<p class="nb"><b>NOTE!</b> Using steroids will give you 2x more points!</p>' +
      '<div class="cbtn"><button class="btn" data-act="sports-run">Go for a run.</button></div>';
  }
  function gymPanel() {
    CF.sports.regenEnergy();
    var p = CF.sports.power(), e = CF.state.sports.handEnergy || 0, max = CF.sports.maxHandEnergy();
    var pct = Math.max(0, Math.min(100, e / max * 100));
    return '<div class="sp-need" id="gymNeed">You still need <b>' + fmt(p.pointsToLevel) + "</b> strength points to level up.</div>" +
      '<div class="energy" id="gymEnergy">Hand energy: <span class="ebar"><i style="width:' + pct.toFixed(1) + '%"></i></span> ( <b>' + fmt(e) + "</b> / " + fmt(max) + " )</div>" +
      '<div class="lifts">' + CF.gymLifts.map(function (l) {
        return '<div class="lift"><a data-act="sports-lift" data-lift="' + esc(l.label) + '">' + esc(l.label) + ":</a> " +
          '<span class="lmeta">( -' + l.energy + " energy = " + fmt(l.points) + " points )</span></div>";
      }).join("") + "</div>" +
      '<div class="eat"><a data-act="sports-steroid">Eat 1 steroid and restore ' + CF.ruleset.sports.steroidEnergy + " arm energy!</a></div>" +
      '<p class="nb"><b>NOTE!</b> Hand energy recovers ' + CF.ruleset.perUpdate.handEnergy + " points at every update!</p>";
  }
  /* Lifting updates only the numbers that changed — rebuilding the whole panel
   * made the lift rows visibly flash on every click. */
  function fastLift(label) {
    ui.sportError = null; ui.sportNotice = null;
    var beforeP = CF.sports.power().level;
    var lr = CF.sports.doLift(label);
    if (lr.ok) {
      ui.sportNotice = lr.msg;
      if (CF.sports.power().level !== beforeP) ui.sportNotice += " Your power level is now " + CF.sports.power().level + ".";
      CF.autosave();
    } else ui.sportError = lr.msg;
    var p = CF.sports.power(), e = CF.state.sports.handEnergy || 0, max = CF.sports.maxHandEnergy();
    var pct = Math.max(0, Math.min(100, e / max * 100));
    if ($("gymNeed")) $("gymNeed").innerHTML = "You still need <b>" + fmt(p.pointsToLevel) + "</b> strength points to level up.";
    if ($("gymEnergy")) $("gymEnergy").innerHTML = 'Hand energy: <span class="ebar"><i style="width:' + pct.toFixed(1) + '%"></i></span> ( <b>' + fmt(e) + "</b> / " + fmt(max) + " )";
    if ($("sportNotice")) $("sportNotice").innerHTML = sportsNoticeHtml();
    if ($("sportEquip")) $("sportEquip").innerHTML = sportsEquipHtml();
    renderSidebar();
  }
  function shopPanel() {
    // NOTE: the reference's "buy 10 steroids for 2 credits" offer is deliberately
    // omitted — Credits are premium and nothing in this build spends them.
    var rows = CF.sportsShop.map(function (it) {
      var label = it.label + (it.note ? " (" + it.note + ")" : it.req ? " (requires " + it.req.level + "+ " + it.req.stat.toLowerCase() + ")" : it.adds ? " (adds " + it.adds + " points)" : "");
      // ENTER items are facility passes, not equipment — shaded darker to stand apart
      return '<tr class="shoprow' + (it.pass ? " passrow" : "") + '" data-act="sports-buy" data-item="' + esc(it.label) + '">' +
        "<td><a>" + esc(label) + "</a></td>" +
        '<td class="r">' + fmt(it.price) + ' <span class="cc">CC</span></td></tr>';
    }).join("");
    return '<table class="mktab"><tr><th>Sports equipment</th><th class="r">Price</th></tr>' + rows + "</table>";
  }
  function lockedPanel(id) {
    return '<div class="sport-err"><b>ERROR!</b><div>' +
      (id === "boxing" ? "You don't have a pass to the boxing gym!" : "You don't have a stadium ticket!") +
      "</div><div class=\"sub\">Buy it at the Sports shop.</div></div>";
  }

  function renderSports() {
    var done = CF.sports.settleRun();   // a finished run pays out on arrival
    if (done) { ui.sportNotice = "Your training finished — you gained " + fmt(done.points) + " stamina points."; CF.autosave(); }
    var fac = ui.sportsFac, panel;
    if (fac === "gym") panel = gymPanel();
    else if (fac === "shop") panel = shopPanel();
    else if (fac === "trail") panel = trailPanel();
    else panel = CF.sports.access(fac) === "ON" ? '<div class="garden-soon"><b>Not built yet</b></div>' : lockedPanel(fac);

    CF._svg.sport = SPORTS_ART;
    $("locationPanel").innerHTML =
      '<div class="panel"><div class="bar">Sports complex</div>' +
      locArt("sport.gif", "sportart", "sport", "Sports complex") +
      sportsFacNav() +
      '<div id="sportNotice" class="notice-slot">' + sportsNoticeHtml() + "</div>" +
      '<div class="sport-cols">' +
        '<div class="sport-left">' + steroidLinkHtml() + '<div id="sportEquip">' + sportsEquipHtml() + "</div></div>" +
        '<div class="sport-right">' + panel + "</div>" +
      "</div></div>";
  }

  /* ============================ BANK =================================== */
  /* The five room links, in the reference's own two columns. */
  function bankRoomsHtml() {
    function col(list) {
      return "<div>" + list.map(function (r) {
        return '<div class="bank-room"><a data-act="bank-room" data-room="' + r.id + '"' +
          (ui.bankRoom === r.id ? ' class="on"' : "") + ">" + esc(r.name) + "</a></div>";
      }).join("") + "</div>";
    }
    return '<div class="bank-rooms">' + col(CF.bankRooms.left) + col(CF.bankRooms.right) + "</div>";
  }
  /* The info block, line for line as the reference prints it. */
  function bankInfoHtml() {
    var B = CF.bank, p = CF.state.player;
    return '<div class="bank-info">' +
      "<p>You have <b>" + fmt(p.bank || 0) + "</b> CC in the bank<br>" +
      "Clients keep here <b>" + fmt(B.clientsHold()) + "</b> CC<br>" +
      "The bank's reputation is <b>" + fmt(B.reputation()) + "</b><br>" +
      "The value of the vaults is <b>" + fmt(CF.vaults.value()) + "</b> CC<br>" +
      "There are <b>" + fmt(CF.vaults.differentHeld()) + "</b> items in the vaults and <b>" +
      fmt(B.itemTotal()) + "</b> items in the bank</p>" +
      "</div>";
  }
  function bankUpgradeHtml() {
    var B = CF.bank, max = CF.ruleset.bank.maxLevel;
    var h = '<div class="bank-lvl"><em>Your bank level is ' + B.level() + "</em></div>";
    if (B.level() >= max) return h + '<div class="bank-upg">The bank cannot be improved any further.</div>';
    return h + '<div class="bank-upg"><b>[</b><a data-act="bank-upgrade">IMPROVE</a><b>]</b><br>' +
      "Improving costs <b>" + fmt(B.upgradeCost()) + "</b> CC<br>" +
      "and needs <b>" + fmt(B.upgradeItems()) + "</b> different bank items " +
      "(you have <b>" + fmt(B.itemsDifferent()) + "</b>)</div>";
  }
  /* "Settle with cash" — the page the reference source actually covers. */
  function bankCashHtml() {
    var p = CF.state.player;
    return '<table class="formtbl bank-tbl">' +
      "<tr><td>How much do you want to put in the bank?</td>" +
        '<td><input type="number" id="bankPut" min="0" value="' + fmt0(p.money) + '"> ' +
        '<button class="btn" data-act="bank-put">Put</button></td></tr>' +
      "<tr><td>How much do you want to take out of the bank?</td>" +
        '<td><input type="number" id="bankTake" min="0" value="' + fmt0(p.bank || 0) + '"> ' +
        '<button class="btn" data-act="bank-take">Take</button></td></tr></table>';
  }
  /* "Bank items" — the numbered catalogue, grouped by category, each with its
     condition out of 80 and a tick-box when it needs maintaining. */
  function bankItemsHtml() {
    var B = CF.bank, R = CF.ruleset.bank;
    B.settleCondition();
    var owned = B.ownedNumbers();
    if (!owned.length) {
      return '<p class="bank-empty">There is nothing here yet. Bank items come from the ' +
        '<a data-act="hsp-sewer">treasure chests in the sewer</a> — every chest is delivered straight in here.</p>';
    }
    var left = B.maintainLeft();
    var head = '<p class="bank-care">This hour you can maintain <b>' + left + '</b> more item' +
      (left === 1 ? "" : "s") + '.<br><span class="nb">NOTE! You can maintain ' + R.maintainPerHour +
      " items an hour.</span></p>" +
      '<div class="bank-careline"><button class="btn" data-act="bank-maintain">Maintain selected items</button>' +
      '<span class="bank-sort">' + bankSortHtml() + "</span></div>";

    var rows = "", cats = CF.bankItemCategories;
    if ((ui.bankSort || "no") === "no") {
      cats.forEach(function (g) {
        var mine = owned.filter(function (n) { return n >= g.from && n <= g.to; });
        if (!mine.length) return;
        rows += '<tr class="bank-cat"><td colspan="4">' + esc(g.name) + "</td></tr>";
        mine.forEach(function (n) { rows += bankItemRow(n); });
      });
    } else {
      var sorted = owned.slice().sort(function (a, b) { return B.condition(a) - B.condition(b); });
      sorted.forEach(function (n) { rows += bankItemRow(n); });
    }
    return head + '<table class="bank-list">' + rows + "</table>" +
      '<div class="bank-careline"><button class="btn" data-act="bank-maintain">Maintain selected items</button></div>' +
      '<p class="bank-empty">' + fmt(owned.length) + " of " + fmt(CF.bankItems.count) +
      " items. The improvement upstairs wants <b>" + fmt(B.upgradeItems()) + "</b> different.</p>";
  }
  function bankSortHtml() {
    // the reference offers exactly two: "Numbri järgi" and "Hoolduse järgi"
    var opts = [["no", "By number"], ["cond", "By maintenance"]];
    return '<select id="bankSort" data-role="banksort">' + opts.map(function (o) {
      return '<option value="' + o[0] + '"' + ((ui.bankSort || "no") === o[0] ? " selected" : "") +
        ">" + o[1] + "</option>";
    }).join("") + "</select>";
  }
  function bankItemRow(n) {
    var B = CF.bank, max = B.condMax(), c = B.condition(n);
    var pct = Math.max(0, Math.min(100, c / max * 100));
    var v = CF.bankItems.value(n);
    // the whole row toggles its tick-box, so you are not aiming at a 13px target
    var pick = c < max;
    return '<tr' + (pick ? ' class="bk-row" data-act="bank-pick" data-no="' + n + '"' : ' class="bk-done"') + ">" +
      '<td class="bk-ck">' + (pick ? '<input type="checkbox" class="bkck" data-no="' + n + '">' : "") + "</td>" +
      '<td class="bk-bar"><span class="ebar"><i style="width:' + pct.toFixed(1) + '%"></i></span></td>' +
      '<td class="bk-cond">' + c + "/" + max + "</td>" +
      "<td><b>" + n + ".</b> " + esc(CF.bankItems.name(n)) +
      " <b>(value: " + (v == null ? "priceless" : fmt(v) + " CC") + ")</b></td></tr>";
  }
  /* "Bank warehouse" — ONE panel. The reference has three (market for play
     money, market for credits, sell immediately) but there is nobody to sell to
     on a market here and the credit economy is skipped, so all that survives is
     the immediate sale, and everything pays CC. */
  function bankStoreHtml() {
    var B = CF.bank, R = CF.ruleset.bank;
    var nos = B.storeNumbers();
    if (!nos.length) {
      return '<p class="bank-empty">The warehouse is empty. Duplicates end up here: the first of any item ' +
        "goes into the collection, and every copy after that is stock you can sell.</p>";
    }
    var rows = nos.map(function (n) {
      var each = B.sellPrice(n), q = B.stored(n);
      return '<tr class="bk-row" data-act="bank-pick" data-no="' + n + '">' +
        '<td class="bk-ck"><input type="checkbox" class="bkck" data-no="' + n + '"></td>' +
        "<td><b>" + n + ".</b> " + esc(CF.bankItems.name(n)) + "</td>" +
        '<td class="bk-qty">x' + fmt(q) + "</td>" +
        '<td class="bk-price">' + (each ? fmt(each) + " CC" + (B.sellCapped(n) ? " *" : "") : "&mdash;") +
        "</td></tr>";
    }).join("");
    var capped = nos.some(function (n) { return B.sellCapped(n); });
    return "<p>Anything here sells <b>immediately</b> for cash — no waiting on a buyer.</p>" +
      '<table class="bank-list bank-store"><tr><th></th><th>Item</th><th>Held</th><th>Each</th></tr>' +
      rows + "</table>" +
      '<div class="bank-careline"><button class="btn" data-act="bank-sell">Sell selected items</button>' +
      '<span class="bank-sort">Sell everything numbered ' +
        '<input type="number" id="bankFrom" min="1" max="' + CF.bankItems.count + '" style="width:60px"> to ' +
        '<input type="number" id="bankTo" min="1" max="' + CF.bankItems.count + '" style="width:60px"> ' +
        '<button class="btn" data-act="bank-sell-range">Sell</button></span></div>' +
      (capped ? '<p class="nb">NOTE! Prices marked * are capped at ' + fmt(R.sellCapCC) +
        " CC so a single find cannot outpay everything else you do.</p>" : "") +
      '<p class="bank-empty">Items numbered above ' + R.sellableTo +
      " are collection pieces and cannot be sold.</p>";
  }
  /* "Vaults" — two tabs, exactly as the reference splits them: the treasure
     itself, and a chamber-by-chamber status board. */
  function vaultTabsHtml() {
    var t = ui.vaultTab || "items";
    return '<div class="vault-tabs">' +
      '<a data-act="vault-tab" data-tab="items"' + (t === "items" ? ' class="on"' : "") + ">Treasure Chest Items</a> | " +
      '<a data-act="vault-tab" data-tab="info"' + (t === "info" ? ' class="on"' : "") + ">Treasure Chest Information</a>" +
      "</div>";
  }
  function vaultItemsHtml() {
    var V = CF.vaults, open = V.openChambers();
    var out = "";
    open.forEach(function (ch) {
      var nos = V.chamberItems(ch);
      out += '<table class="bank-list vault-tbl">' +
        '<tr class="bank-cat"><td colspan="5">' + esc(ch.name) + " (items " + ch.from + "&ndash;" + ch.to + ")</td></tr>" +
        "<tr><th>" + esc(ch.kind) + "</th><th>Quantity</th><th>Value of one</th><th>Total value</th><th></th></tr>";
      if (!nos.length) {
        out += '<tr><td colspan="5" class="bank-empty">Nothing in this chamber yet.</td></tr>';
      } else {
        nos.forEach(function (n) {
          var each = CF.vaultItems.value(n), q = V.count(n);
          out += '<tr class="bk-row" data-act="vault-pick" data-no="' + n + '">' +
            "<td><b>" + n + ".</b> " + esc(CF.vaultItems.name(n)) + "</td>" +
            '<td class="bk-qty"><b>' + fmt(q) + "</b></td>" +
            '<td class="bk-price">' + fmt(each) + " CC</td>" +
            '<td class="bk-price">' + fmt(each * q) + " CC</td>" +
            '<td class="bk-ck"><input type="checkbox" class="vck" data-no="' + n + '"></td></tr>';
        });
      }
      out += "</table>";
    });
    if (!V.totalHeld()) {
      out += '<p class="bank-empty">The chambers are empty. Treasure comes out of the ' +
        '<a data-act="hsp-sewer">chests in the sewer</a>.</p>';
    } else {
      out += '<div class="bank-careline"><span>How many of each do you want to sell? ' +
        '<input type="number" id="vaultQty" min="1" value="1" style="width:70px"></span>' +
        '<button class="btn" data-act="vault-sell">Sell selected items</button></div>';
    }
    return out;
  }
  function vaultInfoHtml() {
    var V = CF.vaults;
    return CF.vaultChambers.map(function (ch) {
      var has = V.exists(ch);
      var rows = '<tr class="bank-cat"><td colspan="2"><b>No.' + ch.no + ":</b> " + esc(ch.name) +
        " (items " + ch.from + "&ndash;" + ch.to + ")</td></tr>" +
        "<tr><td>Does this treasure chamber exist:</td><td>" +
        (has ? '<b class="g-yes">EXISTING</b>' : '<b class="g-no">NO</b>') + "</td></tr>";
      if (has) {
        rows += "<tr><td>How many items this chamber holds:</td><td>" + fmt(CF.vaultCapacity) + " items</td></tr>" +
          "<tr><td>How many different items are here:</td><td>" + fmt(V.chamberDifferent(ch)) + " items</td></tr>" +
          "<tr><td>How many items in total:</td><td>" + fmt(V.chamberTotal(ch)) + " items</td></tr>" +
          "<tr><td>The value of this chamber:</td><td>" + fmt(V.chamberValue(ch)) + " CC</td></tr>";
      } else {
        rows += "<tr><td>Missing before you get this chamber:</td><td><b>" + fmt(V.missing(ch)) +
          "</b> different items</td></tr>";
      }
      return '<table class="bank-list vault-info">' + rows + "</table>";
    }).join("");
  }
  function bankVaultsHtml() {
    var V = CF.vaults, n = V.openChambers().length;
    return '<p class="bank-lvl">Your bank has ' + n + " vault" + (n === 1 ? "" : "s") + "</p>" +
      vaultTabsHtml() +
      ((ui.vaultTab || "items") === "info" ? vaultInfoHtml() : vaultItemsHtml());
  }
  function renderBank() {
    /* You do not own the bank on a fresh account. Until you buy it there is an
       account to settle with and nothing else — no items, no vaults, no
       upgrading — so the page is just the offer and the two cash forms. */
    if (!CF.bank.owned()) {
      $("locationPanel").innerHTML =
        '<div class="panel bank"><div class="bar">Bank</div>' +
        '<div class="bank-top">' +
          '<div class="bank-left">' +
            "<p>You have an account here, and nothing more. The bank itself is for sale.</p>" +
            '<div class="bank-buy"><b>[</b><a data-act="bank-buy">BUY THE BANK</a><b>]</b><br>' +
            "It costs <b>" + fmt(CF.bank.buyPrice()) + "</b> CC<br>" +
            "<span class=\"nb\">Owning it opens the items, the vaults and the improvements.</span></div>" +
          "</div>" +
          '<div class="bank-art">' + locArt("bank-1.gif", "bank-img", "bank", "Bank") + "</div>" +
        "</div>" +
        '<div id="bankNotice" class="notice-slot">' +
          noticeHtml({ err: ui.bankError, msg: ui.bankNotice, reserve: true }) + "</div>" +
        '<div class="bank-body">' + bankCashHtml() + "</div></div>";
      return;
    }
    var room = ui.bankRoom || "cash";
    var body = room === "cash" ? bankCashHtml()
             : room === "items" ? bankItemsHtml()
             : room === "store" ? bankStoreHtml()
             : room === "vaults" ? bankVaultsHtml()
             : '<p class="bank-empty">This part of the bank is not built yet.</p>';
    $("locationPanel").innerHTML =
      '<div class="panel bank"><div class="bar">Bank</div>' +
      '<div class="bank-top">' +
        '<div class="bank-left">' + bankRoomsHtml() +
          '<hr class="bank-rule">' + bankInfoHtml() +
          '<hr class="bank-rule">' + bankUpgradeHtml() + "</div>" +
        '<div class="bank-art">' + locArt("bank-" + CF.bank.level() + ".gif", "bank-img", "bank", "Bank") + "</div>" +
      "</div>" +
      '<div id="bankNotice" class="notice-slot">' +
        noticeHtml({ err: ui.bankError, msg: ui.bankNotice, reserve: true }) + "</div>" +
      '<div class="bank-body">' + body + "</div>" +
      "</div>";
  }

  function fmt0(n) { return Math.max(0, Math.floor(n || 0)); }

  /* ===================== CASINO / RACING / BARRACKS ==================== */
  function comingSoon(title, msg, art) {
    return '<div class="panel"><div class="bar">' + esc(title) + "</div>" +
      '<div class="loc-locked">' + (art || "") + '<div class="ll-box">' + msg + "</div></div></div>";
  }
  /* ---------------------------- CASINO ---------------------------------- */
  /* Chips are the sidebar's tokens. Every game opens on the same stake screen
   * ("Your contribution: [ ] token [New Game]"), so it lives in one helper. */
  function cardHTML(c) {
    if (!c) return '<span class="pcard back"></span>';
    var r = CF.cardRanks[c.r], s = CF.cardSuits[c.s];
    return '<span class="pcard' + (CF.cardRed[c.s] ? " red" : "") + '">' +
      '<b class="pc-tl">' + r + "<i>" + s + "</i></b>" +
      '<b class="pc-mid">' + s + "</b>" +
      '<b class="pc-br">' + r + "<i>" + s + "</i></b></span>";
  }
  function casinoMenu() {
    return '<div class="cas-menu">' + CF.casinoGames.map(function (g) {
      return '<div><a class="' + (CF.state.casino.game === g.id ? "cur" : "") +
        '" data-act="cas-game" data-game="' + g.id + '">' + esc(g.name) + "</a> " +
        '<span class="cas-desc">' + esc(g.desc) + "</span></div>";
    }).join("") + "</div>";
  }
  function chipLine(colon) {
    return '<div class="cas-chips">( you currently have <b>' + fmt(CF.casino.chips()) +
      "</b> chips )" + (colon === false ? "" : " :") + "</div>";
  }
  /* The stake screen shared by Blackjack and Video poker. The slot machine has
   * no stake box — its denomination buttons are the spin. */
  function betPanel(title) {
    var C = CF.state.casino;
    return (title ? '<div class="bar2">' + esc(title) + "</div>" : "") +
      '<div class="cas-bet">' + chipLine() +
      '<div class="cas-betrow"><b>Your contribution:</b> ' +
        '<input type="number" id="casBet" min="1" value="' + fmt0(C.bet || CF.ruleset.casino.defaultBet) + '"> token ' +
        '<button class="btn" data-act="cas-new">New Game</button></div></div>';
  }
  /* Result lines read better with the figures picked out, as in the reference. */
  function hiNums(s) { return esc(s).replace(/(\d[\d,]*)/g, "<b>$1</b>"); }
  function casNoticeHtml() {
    return noticeHtml({ err: ui.casError, msg: ui.casNotice });
  }
  function blackjackView() {
    var g = CF.state.casino.bj;
    if (!g) return betPanel("Blackjack");
    // the dealer's second card stays face down until the hand is over; the hands
    // are fanned so each card only shows its corner, as in the reference
    var dealer = g.over ? g.dealer.map(cardHTML).join("") : cardHTML(g.dealer[0]) + cardHTML(null);
    return '<div class="cas-table">' +
      '<div class="cas-cards fan">' + dealer + "</div>" +
      (g.over ? '<div class="cas-pts">The dealer has <b>' + CF.casino.handPoints(g.dealer) + "</b> points</div>" : "") +
      "<hr>" +
      (g.over ? '<div class="cas-res ' + g.outcome + '">' + hiNums(g.result) + "</div>" : "") +
      (g.over
        ? '<div class="cas-acts"><button class="btn" data-act="cas-again">New Game</button></div>'
        : '<div class="cas-acts"><button class="btn" data-act="bj-hit">Hit</button>' +
          '<button class="btn" data-act="bj-stand">Stand</button></div>') +
      "<hr>" +
      '<div class="cas-pts">You have <b>' + CF.casino.handPoints(g.player) + "</b> points</div>" +
      '<div class="cas-cards fan">' + g.player.map(cardHTML).join("") + "</div></div>";
  }

  function pokerPayTable() {
    return '<div class="paybox"><div class="bar">Winning combinations</div>' +
      '<table class="paytbl">' + CF.pokerPays.map(function (p) {
        return "<tr><th>" + esc(p.label) + "</th><td>Bet &times; <b>" + fmt(p.pay) +
          "</b> chip" + (p.pay === 1 ? "" : "s") + "</td></tr>";
      }).join("") + "</table></div>";
  }
  function pokerView() {
    var g = CF.state.casino.vp;
    if (!g) return betPanel("Video poker") + pokerPayTable();
    var cards = g.hand.map(cardHTML).join("");
    // a finished hand shows the banner, the cards and the stake screen again —
    // the keep row and Change button only exist while the hand is live
    if (g.drawn) {
      return '<div class="cas-banner">' + hiNums(g.result) + "</div>" +
        '<div class="cas-cards">' + cards + "</div>" +
        betPanel("Video poker") + pokerPayTable();
    }
    var keeps = g.hand.map(function (c, i) {
      return '<span class="kc"><input type="checkbox" class="vpk" data-i="' + i + '"></span>';
    }).join("");
    return '<div class="cas-table">' +
      '<div class="cas-cards">' + cards + "</div>" +
      '<div class="cas-keepwrap"><div class="cas-keep"><span class="kl">Keep it:</span>' + keeps + "</div></div>" +
      '<div class="cas-acts"><button class="btn" data-act="vp-draw">Change</button></div>' +
      "</div>" + pokerPayTable();
  }

  function slotPayTable() {
    function sym(k) {
      var s = null; CF.slotSymbols.forEach(function (x) { if (x.key === k) s = x; });
      return '<span class="slot-sym" title="' + esc(s.label) + '">' + s.ch + "</span>";
    }
    return '<div class="slot-pays">' + CF.slotPays.map(function (p) {
      var left = p.n === 3 ? sym(p.key) + sym(p.key) + sym(p.key)
                           : '<b class="sp-n">1</b><span class="sp-x">&times;</span>' + sym(p.key);
      return '<div class="sp-row"><span class="sp-l">' + left + '</span><span class="sp-eq">=</span>' +
        '<span class="sp-d">&#36;</span><span class="sp-x">&times;</span>' +
        '<span class="sp-m">' + String(p.mult).replace(".", ",") + "</span></div>";
    }).join("") + "</div>";
  }
  function slotView() {
    var C = CF.state.casino, g = C.slot;
    function sym(k) {
      var s = null; CF.slotSymbols.forEach(function (x) { if (x.key === k) s = x; });
      return s ? s.ch : "";
    }
    var reels = [0, 1, 2].map(function (i) {
      return '<div class="reel">' + (g ? sym(g.reels[i]) : "") + "</div>";
    }).join("");
    // no stake box here — the three denomination buttons ARE the spin: pressing
    // one takes that many tokens and pulls the lever
    return '<div class="cas-chips plain">You currently have <b>' + fmt(CF.casino.chips()) + "</b> chips.</div>" +
      '<div class="slotm">' +
        '<div class="slot-win">' + reels + (g && g.won > 0 ? '<div class="slot-won">You won ' + fmt(g.won) + "</div>" : "") + "</div>" +
        '<div class="slot-plate">' + CF.ruleset.casino.slotBets.map(function (b) {
          return '<a data-act="slot-spin" data-bet="' + b + '" title="Spin for ' + fmt(b) + ' tokens"' +
            (b > CF.casino.chips() ? ' class="off"' : "") + ">" +
            String(b).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "</a>";
        }).join("") + "</div>" +
        slotPayTable() +
      "</div>";
  }

  function cashierView() {
    var p = CF.state.player, chips = p.tokens || 0;
    /* Both directions are prefilled with the whole balance. The withdraw box
     * used to start empty, which made cashing out look like something the
     * cashier did not offer. */
    return '<div class="bar2">Casino Cashier</div>' + chipLine() +
      '<table class="formtbl cas-cash">' +
        "<tr><td>Exchange money for tokens:</td>" +
          '<td><input type="number" id="casBuy" min="0" value="' + fmt0(p.money) + '"> ' +
          '<button class="btn" data-act="cas-buy">Change</button></td></tr>' +
        "<tr><td>Exchange tokens for money:</td>" +
          '<td><input type="number" id="casSell" min="0" value="' + fmt0(chips) + '"> ' +
          '<button class="btn" data-act="cas-sell">Change</button></td></tr></table>' +
      '<p class="cas-note">Your money: <b>' + fmt(p.money) + "</b> CC &nbsp;&middot;&nbsp; your chips: <b>" +
        fmt(chips) + "</b> &nbsp;&middot;&nbsp; 1 CC = <b>" + CF.ruleset.casino.tokenRate + "</b> token.</p>" +
      '<p class="cas-note">Cash out whenever you like. Chips are only spendable inside the casino, so anything ' +
        "you want to keep has to come back through here.</p>";
  }

  function renderCasino() {
    var C = CF.state.casino, body;
    if (C.game === "blackjack") body = blackjackView();
    else if (C.game === "poker") body = pokerView();
    else if (C.game === "slots") body = slotView();
    else if (C.game === "cashier") body = cashierView();
    else body = '<div class="cas-idle">Pick a game above.</div>' + chipLine(false);
    $("locationPanel").innerHTML =
      '<div class="panel"><div class="bar">Casino</div>' +
      '<div class="cas-head"><div class="loc-art">' + locArt("casino.gif", "loc-img", "casino", "Casino") + "</div>" +
        casinoMenu() + "</div>" +
      '<div class="cas-body">' + casNoticeHtml() + body + "</div></div>";
  }
  function renderRacing() {
    // the reference also requires a garage and a car — neither system exists yet
    $("locationPanel").innerHTML = comingSoon("Racing complex",
      "You also need a <b>garage and a car</b> — the garage isn't built yet.",
      '<div class="loc-art">' + locArt("car.png", "loc-img", "racing", "Racing complex") + "</div>");
  }
  /* ------------------------------- SLUM -------------------------------- */
  var SLUM_ART =
    '<svg class="slumart" viewBox="0 0 700 150" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="700" height="150" fill="#b9c6cf"/><rect y="86" width="700" height="64" fill="#8e9ca8"/>' +
    '<rect y="104" width="700" height="26" fill="#6f7d89"/>' +
    '<g stroke="#e8eef2" stroke-width="4" stroke-dasharray="26 20"><path d="M0 117 H700"/></g>' +
    '<g fill="#d9d2c4"><rect x="60" y="34" width="130" height="56"/><rect x="196" y="52" width="64" height="38"/></g>' +
    '<g fill="#8a7f6d"><rect x="60" y="28" width="130" height="8"/><rect x="196" y="46" width="64" height="8"/></g>' +
    '<g fill="#5d6b77"><rect x="82" y="50" width="20" height="18"/><rect x="118" y="50" width="20" height="18"/>' +
    '<rect x="154" y="50" width="20" height="18"/><rect x="212" y="62" width="16" height="16"/></g>' +
    '<g fill="#3f6b4a"><polygon points="330,90 348,40 366,90"/><polygon points="368,90 384,52 400,90"/>' +
    '<polygon points="620,90 640,36 660,90"/><polygon points="660,90 676,54 692,90"/></g>' +
    '<g fill="#6b4a2f"><rect x="345" y="88" width="6" height="8"/><rect x="381" y="88" width="6" height="8"/>' +
    '<rect x="637" y="88" width="6" height="8"/><rect x="673" y="88" width="6" height="8"/></g>' +
    '<g><rect x="470" y="56" width="120" height="34" fill="#cfc7b6"/>' +
    '<rect x="464" y="46" width="132" height="12" fill="#b0446a"/>' +
    '<rect x="486" y="66" width="88" height="6" fill="#8a7f6d"/></g>' +
    "</svg>";

  /* Betting Bunker and Parking need a pass from the market's Ticket counter. */
  function slumPassFor(area) {
    var f = null; CF.ruleset.slumPasses.forEach(function (p) { if (p.area === area) f = p; });
    return f;
  }
  function slumStatGateFor(area) {
    var f = null; (CF.ruleset.slumStatGates || []).forEach(function (g) { if (g.area === area) f = g; });
    return f;
  }
  function slumAreaOpen(area) {
    var p = slumPassFor(area);
    if (p && CF.state.slumPasses[p.id]) return true;           // a bought ticket always opens it
    var g = slumStatGateFor(area);
    if (g) return (CF.sportsStatic[g.stat] || 0) >= g.level;   // Parking also opens at Speed 15
    return !p;                                                 // Highway/Market have neither gate
  }
  function renderSlum() {
    /* Two areas are places you can actually walk into now: the Market, and the
     * Betting Bunker. Picking one swaps what fills the rest of the page. */
    var AREA_VIEW = { "Market": "market", "Betting Bunker": "bunker" };
    var view = ui.slumArea || "market";
    var areas = SLUM_AREAS.map(function (a) {
      var open = slumAreaOpen(a[0]), v = AREA_VIEW[a[0]];
      var sel = v && v === view ? " sel" : "";
      var act = v && open ? ' data-act="slum-area" data-area="' + v + '"'
                          : ' data-act="todo" data-what="' + esc(a[0]) + '"';
      // two lines only: the name, then the access state
      return '<div class="area' + sel + '"><div class="a-name"><a' + act + ">" + esc(a[0]) + "</a></div>" +
        '<div class="a-acc">Access: <b class="' + (open ? "on" : "no") + '">' + (open ? "YES" : "NO") + "</b></div></div>";
    }).join("");
    // whole rows are clickable; counters we haven't built show the "not built" mark
    var BUILT_COUNTERS = {
      "Craft supplies counter": { act: "market-craft", key: "craft" },
      "Drug belt counter":      { act: "market-drugbelt", key: "drugbelt" },
      "Ticket counter":         { act: "market-slumtickets", key: "tickets" },
      "Culinary exchange":      { act: "market-culinary", key: "culinary" },
    };
    var rows = MARKET_COUNTERS.map(function (c) {
      var b = BUILT_COUNTERS[c[0]];
      if (b) {
        return '<tr class="mrow' + (ui.slumCounter === b.key ? " on" : "") + '" data-act="' + b.act + '">' +
          "<td>" + esc(c[0]) + '</td><td class="c">[ ' + c[1].map(esc).join(" | ") + " ]</td></tr>";
      }
      return '<tr class="mrow dead" data-act="todo" data-what="' + esc(c[0]) + '">' +
        "<td>" + esc(c[0]) + '</td><td class="c"><span class="notbuilt" title="Not built yet">&#128683;</span></td></tr>';
    }).join("");
    var body = view === "bunker"
      ? bunkerPanel()
      : '<table class="market">' + rows + "</table>" +
        (ui.slumCounter === "craft" ? craftCounterPanel()
          : ui.slumCounter === "drugbelt" ? drugBeltCounterPanel()
          : ui.slumCounter === "tickets" ? slumTicketCounterPanel()
          : ui.slumCounter === "culinary" ? culinaryCounterPanel()
          : '<p class="acc-note">Pick a counter — Craft supplies, the Culinary exchange, the Drug belt counter and the Ticket counter are built.</p>');
    $("locationPanel").innerHTML =
      '<div class="panel"><div class="bar">Slum</div>' +
      (CF._svg.slum = SLUM_ART, locArt("slumm.gif", "slumart", "slum", "Slum")) +
      '<div class="slum-areas">' + areas + "</div>" + body + "</div>";
  }

  /* ==================== HOUSE AND SEWAGE (the map) =====================
   * Walk the streets, rob the houses. Tiles are a plain CSS grid rather than
   * the reference's isometric art — same game, drawn in this game's own style.
   * Clicking a tile selects it and shows what you can do right there, which is
   * the reference's tooltip without the pixel-positioning maths. */
  /* Tiles are cut from the reference's own sprite sheet now, so a tile is just
   * a background-position — no hand-drawn shapes left. */
  function houseTile(x, y) {
    var s = CF.houses.spriteFor(x, y), p = CF.houses.pos(), Z = CF.houseMap.zoom;
    var inside = CF.houses.inBounds(x, y);
    var cls = "ht" + (inside ? "" : " ht-void");
    var sel = CF.state.houses.sel;
    if (sel && sel.x === x && sel.y === y) cls += " sel";
    if (inside) {
      var c = CF.houses.cellAt(x, y);
      if (c === "house" || c === "road") cls += " klik";      // a tile worth clicking
    }
    var me = (x === p.x && y === p.y)
      ? '<img class="ht-you" src="img/here.png" alt="You are here">' : "";
    /* An opponent wears its level, coloured by how the fight would actually go
       for you right now — you should be able to read a floor at a glance and
       walk away from the ones that would empty you. */
    if (inside && CF.houses.inSewer()) {
      var th = CF.houses.threat(x, y);
      if (th) me += '<span class="ht-lvl ' + th.band + '" title="' + esc(th.name) +
        " (level " + th.level + ") — " + th.band + '">' + th.level + "</span>";
    }
    // offsets scale with the sprite, so the sheet is read at 2x cleanly
    return '<div class="' + cls + '" style="background-position:' + (s.bx * Z) + "px " + (s.by * Z) + 'px"' +
      (inside ? ' data-act="hs-pick" data-x="' + x + '" data-y="' + y + '"' : "") + ">" + me + "</div>";
  }
  /* The action menu is the reference's radial dial: a 110x100 disc holding a
   * 3x3 grid of icons cut from villa_icons.png. Move sits in the middle, the
   * thing you came to do sits top-left, and climbing down sits bottom-middle —
   * the same slots the original uses, so the muscle memory carries over.
   *
   * It is a sibling of the sliding layer, not a child: the window clips its
   * overflow, and inside it the scroll animation would drag it along. Clamped
   * to the window so it is always fully visible. */
  var HT_ICON = { climb: 0, climb_down: -30, climb_up: -60, move: -90,
                  steal: -120, take: -150, fight: -180, treasure: -210 };
  function htIcon(o, x, y, icon, title) {
    if (!o) return '<span class="ht-cell"></span>';
    var afford = o.cost == null || o.cost <= CF.houses.moves();
    var cost = o.cost ? " (" + o.cost + " move" + (o.cost === 1 ? "" : "s") + ")" : "";
    return '<a class="ht-cell ht-ico' + (afford ? "" : " off") + '" data-act="hs-do" data-do="' + o.act +
      '" data-x="' + x + '" data-y="' + y + '" title="' + esc(title + cost) + '"' +
      ' style="background-position:0 ' + HT_ICON[icon] + 'px"></a>';
  }
  function houseActionChip(x, y) {
    var opts = CF.houses.optionsAt(x, y), cam = CF.houses.camera(), M = CF.houseMap;
    var by = {};
    opts.forEach(function (o) { if (o.act && !by[o.act]) by[o.act] = o; });
    var dead = opts.filter(function (o) { return o.dead; })[0];

    // centre the dial on the tile, then keep it inside the window
    var vx = x - cam.x, vy = y - cam.y;
    var W = M.viewW * M.tileW, H = M.viewH * M.tileH, dw = 110, dh = 110;
    var left = Math.max(0, Math.min(W - dw, vx * M.tileW + M.tileW / 2 - dw / 2));
    var top = Math.max(0, Math.min(H - dh, vy * M.tileH + M.tileH / 2 - dh / 2));

    var steal = by.walksteal || by.steal;
    var cells;
    if (CF.houses.inSewer()) {
      var mon = CF.houses.monsterAt(x, y);
      cells = [
        htIcon(by.attack, x, y, "fight", mon ? "Attack the " + mon.name.toLowerCase() + " (level " + mon.level + ")" : "Attack"),
        htIcon(by.up, x, y, "climb_up", CF.houses.level() > 1 ? "Climb up a level" : "Climb up to the street"), "",
        "", htIcon(by.walk, x, y, "move", "Walk here"), "",
        htIcon(by.treasure, x, y, "treasure", "Take the treasure"),
        htIcon(by.down, x, y, "climb_down", "Climb down a level"), "",
      ];
    } else {
      cells = [
        htIcon(steal, x, y, "steal", steal ? (by.steal ? "Steal from the house" : "Walk here and steal") : ""),
        "", "",
        "", htIcon(by.walk, x, y, "move", "Walk here"), "",
        "", htIcon(by.sewer || by.sewerwalk, x, y, "climb", "Climb to a new level"), "",
      ];
    }
    cells = cells.map(function (c) { return c || '<span class="ht-cell"></span>'; }).join("");

    return '<div class="ht-dial" style="left:' + left + "px;top:" + top + 'px">' + cells +
      (dead && !steal && !by.walk ? '<div class="ht-dial-note">' + esc(dead.label) + "</div>" : "") +
      "</div>";
  }
  /* The WHOLE district is built, and a fixed window looks at part of it. The
   * district is what moves — it is translated under the window — so walking
   * slides the streets past you instead of teleporting a dot between tiles.
   * That is also why the tile size is a fixed pixel count: the translate needs
   * real numbers to animate between. A margin of void tiles is drawn around the
   * district so the window is never short of something to show. */
  function houseMapGrid() {
    CF.houses.ensureMap();
    var S = CF.state.houses, M = CF.houseMap, sel = S.sel, cam = CF.houses.camera();
    var pad = Math.max(Math.ceil(M.viewW / 2), Math.ceil(M.viewH / 2)) + 1;
    var x0 = -pad, y0 = -pad, x1 = S.w + pad, y1 = S.h + pad, out = "";
    for (var y = y0; y < y1; y++) {
      for (var x = x0; x < x1; x++) out += houseTile(x, y);
    }
    var cols = x1 - x0;
    var chip = sel && CF.houses.inBounds(sel.x, sel.y) ? houseActionChip(sel.x, sel.y) : "";
    return '<div class="ht-view" style="width:' + (M.viewW * M.tileW) + "px;height:" + (M.viewH * M.tileH) + 'px">' +
      '<div class="ht-map" id="htMap" style="grid-template-columns:repeat(' + cols + "," + M.tileW + "px);" +
        "grid-auto-rows:" + M.tileH + "px;" +
        "transform:translate(" + ((x0 - cam.x) * M.tileW) + "px," + ((y0 - cam.y) * M.tileH) + 'px)">' +
      out + "</div>" + chip + "</div>";
  }
  /* Make the slide actually animate. renderPlace rebuilds the DOM, so a fresh
   * element would simply appear at its new offset; put it back where it was,
   * let the browser take that, then move it. */
  function houseMapSlide() {
    var el = $("htMap"); if (!el) return;
    var M = CF.houseMap, cam = CF.houses.camera(), prev = ui.hsCamPrev;
    var pad = Math.max(Math.ceil(M.viewW / 2), Math.ceil(M.viewH / 2)) + 1;
    function at(c) { return "translate(" + ((-pad - c.x) * M.tileW) + "px," + ((-pad - c.y) * M.tileH) + "px)"; }
    if (prev && (prev.x !== cam.x || prev.y !== cam.y)) {
      /* Duration grows with the distance but is capped, so a one-tile step is
       * instant-feeling and a twenty-tile walk still lands in half a second
       * instead of either crawling or teleporting. */
      var steps = Math.abs(cam.x - prev.x) + Math.abs(cam.y - prev.y);
      var secs = Math.min(0.75, 0.18 + steps * 0.05);
      el.style.transition = "none";
      el.style.transform = at(prev);
      void el.offsetWidth;                  // force the browser to accept the old spot
      el.style.transition = "transform " + secs.toFixed(2) + "s cubic-bezier(.25,.1,.25,1)";
      el.style.transform = at(cam);
    }
    ui.hsCamPrev = { x: cam.x, y: cam.y };
  }
  function renderHouses() {
    CF.houses.ensureMap();
    var mv = CF.houses.moves(), mx = CF.houses.movesMax();
    var pct = Math.max(0, Math.min(100, mv / mx * 100));
    var sp = CF.garden.stealProgress();
    var left = Math.max(0, CF.formulas.pointsToNextLevelFor("Stealing", sp.level) - sp.into);
    var pos = CF.houses.pos();

    $("locationPanel").innerHTML =
      '<div class="panel"><div class="bar">Villas and sewer</div>' +
      (CF.houses.inSewer() ? sewerHead() : '<div class="hs-head">' +
        '<div class="hs-blurb">When you steal from a villa you have a <b>1 in 10</b> chance of turning up a ' +
          '<b>stolen item</b>, which is what the bank\'s reputation is built from. Money is far more common, ' +
          "and a greenhouse ticket turns up now and then.</div>" +
        '<div class="hs-stats">' +
          '<div class="hs-mv barline">' + barLine("Villa moves", mv, mx) + "</div>" +
          '<div class="hs-sp"><b>' + fmt(left) + "</b> steal points to level up</div>" +
          (CF.houses.items() > 0
            ? '<div class="hs-sp">Stolen items in your backpack: <b>' + fmt(CF.houses.items()) + "</b></div>" : "") +
        "</div>" +
      "</div>") +
      '<div id="hsNotice" class="notice-slot">' + houseNoticeHtml() + "</div>" +
      houseMapGrid() +
      (CF.houses.inSewer()
        ? '<p class="hs-note"><b>NOTE!</b> If there is no one left to fight, wait for the update — it puts new ' +
          "company on the map and tops your moves back up.</p>"
        : '<p class="hs-note"><b>NOTE!</b> If there are no red villas left, wait for the update. ' +
          "Moves come back <b>+" + CF.ruleset.perUpdate.houseGear + "</b> an update, and when they do every villa " +
          "is worth robbing again.</p>") +
      '<p class="hs-note">You are at <b>' + pos.x + ", " + pos.y + "</b> of " +
        CF.state.houses.w + " &times; " + CF.state.houses.h +
        (CF.houses.inSewer() ? ", level <b>" + CF.houses.level() + "</b>" : "") + ".</p>" +
      "</div>";
    houseMapSlide();
  }
  function sewerHead() {
    var mv = CF.houses.moves(), mx = CF.houses.movesMax();
    var pct = Math.max(0, Math.min(100, mv / mx * 100));
    var wh = CF.houses.weaponHandling();
    return '<div class="hs-head">' +
      '<div class="hs-blurb">You are <b>' + CF.houses.level() + '</b> level' +
        (CF.houses.level() === 1 ? "" : "s") + " down. Fighting what lives here trains " +
        "<b>Weapon handling</b>, and what you kill sometimes drops a chest. " +
        "Lose a fight and your endurance is gone until a hospital puts you right, " +
        "so pick the ones you can win. You can climb from any tunnel tile.</div>" +
      '<div class="hs-stats">' +
        '<div class="hs-mv barline">' + barLine("Sewer moves", mv, mx) + "</div>" +
        '<div class="hs-sp"><b>' + fmt(wh.pointsToLevel) + "</b> weapon handling points to level up</div>" +
      "</div></div>";
  }
  function houseNoticeHtml() {
    return noticeHtml({ err: ui.hsError, msg: ui.hsNotice, label: "NOTICE", errLabel: "ERROR!", nums: true,
                        note: ui.hsSub, levelUp: ui.hsLevelUp,
                        skill: CF.houses.inSewer() ? "Weapon handling" : "Stealing" });
  }

  /* ---------------------- THE BETTING BUNKER ---------------------------
   * Three tabs, exactly the ones the reference room had: place a bet, watch it
   * run, look back at the last few. The events are the bunker's own — see
   * data/betting.js for why it is not wired to the Racing complex. */
  function bunkerTab() {
    // a finished slip pulls you to the result rather than leaving you on a form
    if (!ui.bunkerTab && CF.betting.active()) return "active";
    return ui.bunkerTab || "place";
  }
  function bunkerNav() {
    var cur = bunkerTab(), a = CF.betting.active();
    var badge = a ? (a.settled ? " (1)" : " (running)") : "";
    return '<div class="bunk-nav">' +
      [["place", "Place bets"], ["active", "Active bets" + badge], ["history", "Bet history"]]
        .map(function (t) {
          return t[0] === cur ? "<b>" + t[1] + "</b>"
            : '<a data-act="bunk-tab" data-tab="' + t[0] + '">' + t[1] + "</a>";
        }).join("") + "</div>";
  }
  function bunkerNoticeHtml() {
    /* No reserved row here: the bunker has no autoclicked button whose position
     * must not move, so an always-present empty notice would just be a gap. */
    return noticeHtml({ err: ui.bunkNotice ? null : ui.bunkError, msg: ui.bunkNotice,
                        label: "NOTICE", errLabel: "ERROR!", nums: true });
  }

  /* Tab 1 — the board. Venues down the side, the chosen one's field in a table. */
  function bunkerPlaceView() {
    var vs = CF.betting.venues(), cur = ui.bunkVenue;
    var sel = null; vs.forEach(function (v) { if (v.id === cur) sel = v; });
    if (!sel) { vs.forEach(function (v) { if (!sel && CF.betting.isOpen(v)) sel = v; }); }
    if (!sel) sel = vs[0];

    var list = vs.map(function (v) {
      var open = CF.betting.isOpen(v);
      return '<div class="bv' + (v.id === sel.id ? " on" : "") + (open ? "" : " off") + '"' +
        (open ? ' data-act="bunk-venue" data-venue="' + v.id + '"' : "") + ">" +
        '<div class="bv-name">' + esc(v.name) + "</div>" +
        '<div class="bv-sub">' + (open ? esc(v.blurb)
          : "Opens at Stealing <b>" + v.lvl + "</b> — you are <b>" + fmt(CF.betting.stealLevel()) + "</b>") + "</div></div>";
    }).join("");

    if (!CF.betting.isOpen(sel)) {
      return '<div class="bunk-grid"><div class="bunk-venues">' + list + "</div>" +
        '<div class="bunk-main"><div class="ll-box">The ' + esc(sel.name) +
        " only takes bets from Stealing level <b>" + sel.lvl + "</b> up!</div></div></div>";
    }

    var rows = sel.runners.map(function (r, i) {
      var on = String(ui.bunkPick) === String(i);
      return '<tr class="brow' + (on ? " on" : "") + '" data-act="bunk-pick" data-i="' + i + '">' +
        '<td class="rad"><span class="radio' + (on ? " on" : "") + '"></span></td>' +
        "<td>" + esc(r.name) + "</td>" +
        '<td class="c"><b>' + CF.betting.oddsFor(r).toFixed(2) + "</b> &times;</td>" +
        '<td class="c pays" id="bunkPay' + i + '">pays <b>' +
          fmt(Math.floor((parseInt(ui.bunkStake, 10) || sel.minBet) * CF.betting.oddsFor(r))) + "</b></td></tr>";
    }).join("");

    var stake = ui.bunkStake != null ? ui.bunkStake : String(sel.minBet);
    return '<div class="bunk-grid"><div class="bunk-venues">' + list + "</div>" +
      '<div class="bunk-main">' +
        '<div class="bar2">' + esc(sel.name) + "</div>" +
        '<p class="bunk-blurb">' + esc(sel.blurb) + "</p>" +
        '<table class="mktab bunk-field"><tr><th></th><th>Who you back</th><th class="c">Odds</th><th class="c">If it wins</th></tr>' +
        rows + "</table>" +
        '<div class="bunk-stakebar">Stake: <input type="number" id="bunkStake" data-role="bunkstake" min="' +
          sel.minBet + '" max="' + sel.maxBet + '" value="' + esc(stake) + '"> CC ' +
          '<span class="bunk-lim">(' + fmt(sel.minBet) + " &ndash; " + fmt(sel.maxBet) + ")</span></div>" +
        '<div class="cbtn"><button class="btn go" data-act="bunk-place">Place the bet</button></div>' +
        '<p class="acc-note">You have <b>' + fmt(CF.state.player.money) + "</b> CC.</p>" +
      "</div></div>";
  }

  /* Tab 2 — the race itself, one bar per runner, redrawn every second. */
  function bunkerActiveView() {
    var a = CF.betting.active();
    if (!a) return '<div class="bunk-empty">You do not have any active bets.</div>';
    var v = CF.betting.venue(a.venue), pos = CF.betting.positions();
    var rows = v.runners.map(function (r, i) {
      var mine = i === a.runner, won = a.settled && i === a.winner;
      return '<div class="brace' + (mine ? " mine" : "") + (won ? " won" : "") + '">' +
        '<div class="br-name">' + esc(r.name) + (mine ? ' <span class="br-tag">your pick</span>' : "") + "</div>" +
        '<div class="br-track"><i id="brBar' + i + '" style="width:' + pos[i] + '%"></i></div>' +
        '<div class="br-odds">' + CF.betting.oddsFor(r).toFixed(2) + "&times;</div></div>";
    }).join("");

    var head, foot;
    if (!a.settled) {
      head = '<div class="bunk-live" id="bunkLive">Leading: <b>' + esc(CF.betting.leader()) + "</b></div>";
      foot = '<div class="cbtn"><button class="btn" data-act="bunk-skip">Skip to the result</button></div>';
    } else if (a.won) {
      head = '<div class="bunk-res win"><b>' + esc(v.runners[a.winner].name) + "</b> came in. You won <b>" +
        fmt(a.payout) + "</b> CC.</div>";
      foot = '<div class="cbtn"><button class="btn go" data-act="bunk-collect">Bet again</button></div>';
    } else {
      head = '<div class="bunk-res lose"><b>' + esc(v.runners[a.winner].name) + "</b> came in. Your <b>" +
        fmt(a.stake) + "</b> CC is gone.</div>";
      foot = '<div class="cbtn"><button class="btn" data-act="bunk-collect">Bet again</button></div>';
    }
    return '<div class="bunk-main wide">' +
      '<div class="bar2">' + esc(v.name) + "</div>" + head +
      '<div class="bunk-slip">Backing <b>' + esc(v.runners[a.runner].name) + "</b> for <b>" +
        fmt(a.stake) + "</b> CC at <b>" + a.odds.toFixed(2) + "</b>&times;</div>" +
      '<div class="bunk-races">' + rows + "</div>" + foot + "</div>";
  }

  /* Tab 3 — the last ten slips, newest first. */
  function bunkerHistoryView() {
    var h = CF.betting.history();
    if (!h.length) return '<div class="bunk-empty">You have not settled any bets yet.</div>';
    var t = CF.betting.historyTotals();
    var rows = h.map(function (b) {
      return "<tr>" +
        "<td>" + esc(b.venue) + "</td>" +
        "<td>" + esc(b.runner) + "</td>" +
        "<td>" + esc(b.winner) + "</td>" +
        '<td class="c">' + fmt(b.stake) + "</td>" +
        '<td class="c">' + b.odds.toFixed(2) + "&times;</td>" +
        '<td class="c ' + (b.won ? "g-yes" : "g-no") + '">' + (b.won ? "WON" : "lost") + "</td>" +
        '<td class="c ' + (b.net >= 0 ? "g-yes" : "g-no") + '">' + (b.net >= 0 ? "+" : "&minus;") + fmt(Math.abs(b.net)) + "</td></tr>";
    }).join("");
    return '<div class="bunk-main wide">' +
      '<table class="mktab bunk-hist"><tr><th>Where</th><th>You backed</th><th>Came in</th>' +
      '<th class="c">Stake</th><th class="c">Odds</th><th class="c">Result</th><th class="c">Net</th></tr>' +
      rows + "</table>" +
      '<p class="acc-note">Last <b>' + h.length + "</b> bet" + (h.length === 1 ? "" : "s") +
        ": <b>" + t.won + "</b> of <b>" + t.bets +
        "</b> came in, <b>" + fmt(t.staked) + "</b> CC staked, <b>" + fmt(t.returned) + "</b> CC back " +
        '(<b class="' + (t.net >= 0 ? "g-yes" : "g-no") + '">' + (t.net >= 0 ? "+" : "&minus;") +
        fmt(Math.abs(t.net)) + "</b> CC).</p></div>";
  }

  function bunkerPanel() {
    var tab = bunkerTab();
    return '<div class="bunker">' +
      '<div class="bar2">Betting Bunker</div>' + bunkerNav() +
      '<div id="bunkNotice" class="notice-slot">' + bunkerNoticeHtml() + "</div>" +
      (tab === "active" ? bunkerActiveView() : tab === "history" ? bunkerHistoryView() : bunkerPlaceView()) +
      "</div>";
  }

  /* The Culinary exchange: swap the field crop you grow for the greenhouse
   * fruit of the SAME level, one for one, plus a brokerage fee. Only fruit you
   * CANNOT grow is listed — that is the whole point of the counter. */
  function culinaryCounterPanel() {
    var g = CF.ruleset.garden, sel = ui.culSel, harvest = CF.state.garden.harvest || {};
    var opts = '<option value="">- Choose a fruit -</option>' + CF.gardenExchangeFruits.map(function (f) {
      return '<option value="' + esc(f.name) + '"' + (sel === f.name ? " selected" : "") + ">Level " + f.lvl +
        " - " + esc(f.name) + " (You have: " + fmt(harvest[f.name] || 0) + ")</option>";
    }).join("");
    var body;
    if (!sel) {
      body = '<div class="cul-none">Pick the fruit you want and press Search.</div>';
    } else {
      var f = CF.garden.exchangeFruit(sel), give = CF.garden.exchangePartner(sel);
      var have = harvest[give.name] || 0;
      var rows = g.exchangeLots.map(function (q) {
        var fee = CF.garden.exchangeFee(q), can = have >= q && CF.state.player.money >= fee;
        return '<tr class="culrow' + (ui.culLot === q ? " on" : "") + (can ? "" : " off") +
          '" data-act="cul-pick" data-lot="' + q + '">' +
          '<td class="rad"><span class="radio' + (ui.culLot === q ? " on" : "") + '"></span></td>' +
          '<td class="nm"><b>' + esc(sel) + '</b> <span class="lvl">( Level ' + f.lvl + " )</span></td>" +
          '<td class="q">' + fmt(q) + ' <span class="lvl">fruit</span></td>' +
          '<td class="pr">' + fmt(fee) + ' <span class="cc">CC</span></td></tr>';
      }).join("");
      body = '<div class="cul-nb"><b>NOTE!</b> You exchange <b>' + esc(give.name) + "</b> for the same number of <b>" +
          esc(sel) + "</b> — both are level <b>" + f.lvl + "</b> — and pay a <b>brokerage fee</b> on top." +
          ' <span class="cul-have">You have <b>' + fmt(have) + "</b> " + esc(give.name) + ".</span></div>" +
        '<table class="medtbl cul-tbl"><tr class="sect"><th class="rad"></th><th>Product</th>' +
          '<th class="q">Quantity</th><th class="pr">Brokerage fee</th></tr>' + rows + "</table>" +
        '<div class="cbtn"><button class="btn" data-act="cul-swap">Change selected fruits</button></div>';
    }
    return '<div class="counter cul-counter"><div class="bar2">Culinary exchange</div>' +
      '<div id="culNotice" class="notice-slot">' +
        noticeHtml({ err: ui.culError, msg: ui.culNotice, errLabel: "ERROR!", nums: true }) + "</div>" +
      '<div class="cul-pick"><select id="culSel" data-role="culsel">' + opts + "</select> " +
        '<button class="btn" data-act="cul-search">Search</button></div>' + body + "</div>";
  }

  /* The Ticket counter: passes for the Slum's gated areas. */
  function slumTicketCounterPanel() {
    var rows = CF.ruleset.slumPasses.map(function (p) {
      var owned = !!CF.state.slumPasses[p.id];
      return '<tr class="shoprow' + (owned ? " owned" : "") + '"' + (owned ? "" : ' data-act="buy-slum-pass" data-pass="' + p.id + '"') + ">" +
        "<td><a>Access ticket &mdash; " + esc(p.area) + "</a></td>" +
        '<td class="r">' + fmt(p.price) + ' <span class="cc">CC</span></td>' +
        '<td class="c">' + (owned ? '<b class="on">OWNED</b>' : "&mdash;") + "</td></tr>";
    }).join("");
    return '<div class="belt-counter"><table class="mktab"><tr><th>Ticket</th><th class="r">Price</th><th class="c">Status</th></tr>' +
      rows + "</table>" +
      '<p class="acc-note">A ticket permanently opens that Slum area. <b>Prices are placeholders</b> — the counter\'s real numbers haven\'t been captured yet.</p></div>';
  }

  /* The Drug belt counter: buy a bigger belt (needs CC + Fame). */
  function drugBeltCounterPanel() {
    var cur = CF.chemist.beltCap(), fame = totalFame();
    // show 15: the belt your fame currently reaches, then the next 14 above it
    var startIdx = 0;
    for (var i = 0; i < CF.drugBelts.length; i++) if (fame >= CF.drugBelts[i].reqFame) startIdx = i;
    // never start below the belt you already own
    for (var j = 0; j < CF.drugBelts.length; j++) if (CF.drugBelts[j].cap <= cur) startIdx = Math.max(startIdx, j);
    var shown = CF.drugBelts.slice(startIdx, startIdx + 15);
    var rows = shown.map(function (b) {
      var on = ui.beltBuySel === b.cap, owned = b.cap <= cur, famed = fame >= b.reqFame;
      return '<tr class="pick' + (on ? " on" : "") + (owned ? " owned" : "") + '" data-act="belt-buy-row" data-cap="' + b.cap + '">' +
        '<td class="c"><input type="radio" name="beltbuy"' + (on ? " checked" : "") + (owned ? " disabled" : "") + "></td>" +
        "<td><b>" + b.cap + " g</b> capacity drug belt</td>" +
        '<td class="r">' + fmt(b.price) + ' <span class="cc">CC</span></td>' +
        '<td class="r"><span class="' + (famed ? "on" : "no") + '">' + fmt(b.reqFame) + "</span> fame</td></tr>";
    }).join("");
    return '<div class="belt-counter"><table class="mktab belt-tab"><tr><th></th><th>Product</th><th class="r">Price</th><th class="r">Demanding fame</th></tr>' +
      rows + "</table>" +
      '<div class="cbtn"><button class="btn" data-act="buy-belt">Buy the selected drug belt</button></div>' +
      '<p class="acc-note">You are wearing a <b>' + cur + " g</b> belt; your fame permits up to <b>" + CF.chemist.maxBeltForFame(fame) + " g</b>.</p></div>";
  }

  /* The Craft supplies counter: pick one material, buy a whole backpack. */
  function craftCounterPanel() {
    var capv = CF.craft.capacity();
    var notice = "";
    if (ui.craftNotice) {
      notice = noticeHtml({ msg: ui.craftNotice }) +
        '<div class="ybar"><a data-act="craft-cabinet">Now take them out of your backpack and into your closet &raquo;</a></div>';
    }
    var buyBtn = '<div class="cbtn"><button class="btn" data-act="craft-buy">Buy a backpack full of selected materials</button></div>';
    // the whole row is clickable, not just the radio
    var rows = CF.ruleset.craft.materials.map(function (m) {
      var on = ui.craftSel === m[0];
      return '<tr class="pick' + (on ? " on" : "") + '" data-act="craft-row" data-mat="' + esc(m[0]) + '">' +
        '<td class="c"><input type="radio" name="craftsel" data-role="craftsel" value="' + esc(m[0]) + '"' + (on ? " checked" : "") + "></td>" +
        "<td><b>" + esc(m[0]) + '</b></td>' +
        '<td class="c">' + fmt(CF.state.craft.supplies[m[0]] || 0) + "</td>" +
        '<td class="c">' + fmt(capv) + " x " + fmt(m[1]) + "</td>" +
        '<td class="r"><b>' + fmt(capv * m[1]) + "</b> CC</td></tr>";
    }).join("");
    // hand tools are one-off buys — once owned they drop off the counter entirely
    var unowned = CF.ruleset.craft.handTools.filter(function (t) { return !CF.state.craft.tools[t]; });
    var toolRows = unowned.map(function (t) {
      var price = CF.ruleset.craft.handToolPrices[t] || 0;
      return '<tr class="toolrow" data-act="buy-tool" data-tool="' + esc(t) + '">' +
        '<td class="c"></td><td><a>' + esc(t) + "</a></td>" +
        '<td class="c"><b class="no">No</b></td>' +
        '<td class="c"></td><td class="r"><b>' + fmt(price) + "</b> CC</td></tr>";
    }).join("");
    return notice + buyBtn +
      '<table class="mktab"><tr><th></th><th>Craft materials</th><th class="c">You</th><th class="c">Pieces</th><th class="r">Price</th></tr>' +
      rows +
      (unowned.length
        ? '<tr><th></th><th>Hand tools</th><th class="c">You</th><th class="c"></th><th class="r">Price</th></tr>' + toolRows
        : "") +
      "</table>" + buyBtn;
  }

  /* Live countdown text for the account overview's three timers. */
  function accCountdown(id) {
    if (id === "accRun") { var r = CF.sports.runState(); return r ? hms(CF.sports.runSecondsLeft()) : "—"; }
    if (id === "accSteroid") {
      var left = Math.max(0, 86400000 - (Date.now() - (CF.state.sports.lastSteroidBuy || 0)));
      return left > 0 ? hms(left / 1000) : "NOW";
    }
    if (id === "accBox") { var s = CF.garden.ticketOfficeSecondsLeft(); return s > 0 ? hms(s) : "NOW"; }
    if (id === "accEdible") { var e = CF.garden.nextEdibleSeconds(); return e === null ? "—" : hms(e); }
    if (id === "accLand") { var l = CF.garden.landCooldownLeft(); return l > 0 ? hms(l) : "NOW"; }
    if (id === "accMed") { var m = CF.garden.nextMedSeconds(); return m === null ? "—" : hms(m); }
    if (id === "accRefit") { var rf = CF.harbor.refitLeft(); return rf > 0 ? hms(rf) : "—"; }
    return "";
  }

  /* The two harbor lines on the account overview. */
  function harborRefitLine() {
    if (!CF.harbor.owned()) return "You don't have a fishing vessel yet";
    var l = CF.harbor.refitLeft();
    return l > 0 ? 'The fishing vessel is being upgraded: <b id="accRefit">' + hms(l) + "</b>"
                 : "Fishing vessel is <b>NOT</b> being upgraded";
  }
  function harborTripLine() {
    if (!CF.harbor.owned()) return "The old fisherman still has a ship for sale";
    var l = CF.harbor.tripLeft();
    if (!CF.harbor.trip()) return "The fishing boat is back from a fishing trip";
    return 'The ship is on a fishing trip for <b id="accTrip">' + Math.floor(l / 3600) + "h</b> and <b>" +
      Math.floor((l % 3600) / 60) + "min</b>";
  }

  /* The Garden panel on the account overview — one line per thing the
   * garden is waiting on, each jumping to the tab that handles it. */
  function gardenAccRows() {
    CF.garden.settlePlots();
    var G = CF.state.garden, rows = [];
    var dry = CF.garden.driestPlot(), nextEd = CF.garden.nextEdibleSeconds();
    var land = CF.garden.landCooldownLeft(), med = CF.garden.nextMedSeconds();
    var box = CF.garden.ticketOfficeSecondsLeft(), wLeft = CF.garden.waterLeftThisHour();

    rows.push({ act: "acc-garden", tab: "edible",
      html: dry === null ? "There are <b>no</b> plants growing in your garden."
                         : "The driest growing plant has a humidity of <b>" + fmt(dry) + "</b>" });
    rows.push({ act: "acc-garden", tab: "edible",
      html: "This hour you can water <b>" + fmt(wLeft) + "</b> more plants." });
    if (nextEd !== null) {
      rows.push({ act: "acc-garden", tab: "edible",
        html: 'The time until the edible plant is ready is <b id="accEdible">' + hms(nextEd) + "</b>" });
    }
    if (CF.garden.edibleReady()) {
      rows.push({ act: "acc-garden", tab: "edible",
        html: "<b>" + fmt(CF.garden.edibleReady()) + "</b> edible plant(s) ready to harvest" });
    }
    rows.push({ act: "acc-garden", tab: "edible",
      html: land > 0 ? 'You can buy garden land from the office: <b id="accLand">' + hms(land) + "</b>"
                     : "You can buy garden land from the office <b>NOW</b>" });
    if (med !== null) {
      rows.push({ act: "acc-garden", tab: "medicinal",
        html: 'The time until the medicinal plant is ready is <b id="accMed">' + hms(med) + "</b>" });
    }
    if (CF.garden.medReady()) {
      rows.push({ act: "acc-garden", tab: "medicinal",
        html: "<b>" + fmt(CF.garden.medReady()) + "</b> medicinal bed(s) ready to cut" });
    } else if (med === null) {
      rows.push({ act: "acc-garden", tab: "medicinal", html: "No medicinal plants are growing at the moment." });
    }
    rows.push({ act: "acc-garden", tab: "greenhouse",
      html: "You have <b>" + fmt(G.tickets) + "</b> greenhouse tickets left" });
    rows.push({ act: "acc-garden", tab: "tickets",
      html: box > 0 ? 'Until the box office opens: <b id="accBox">' + hms(box) + "</b>"
                    : "The box office is <b>OPEN</b>" });
    return rows;
  }

  /* A stealing-gear bar. Both fill by perUpdate.*Gear at every update, so these
   * read live rather than sitting at the reference's frozen numbers. */
  /* A label / bar / value row. Split into three cells so the bars line up down
     the column instead of each row placing its own bar wherever its label
     happens to end. Pair with the .barline class on the row. */
  function barLine(label, val, max) {
    var v = Math.max(0, Math.min(max, val || 0));
    return '<span class="bl-lbl">' + esc(label) + ":</span>" +
      '<span class="bl-bar"><span class="ebar"><i style="width:' + (v / max * 100) + '%"></i></span></span>' +
      '<span class="bl-val">' + fmt(v) + "/" + fmt(max) + "</span>";
  }
  function gearLine(label, val) {
    return barLine(label, val, CF.ruleset.perUpdate.gearMax);
  }

  function renderAccount() {
    // rows may carry an action -> the whole row is clickable and highlights
    function box(title, rows) {
      return '<div class="accbox"><div class="bar">' + title + "</div>" +
        rows.map(function (r) {
          if (typeof r === "string") return '<div class="accrow' + (/bl-lbl/.test(r) ? " barline" : "") + '">' + r + "</div>";
          if (!r) return "";                    // rows can opt out by returning null
          return '<div class="accrow go' + (/bl-lbl/.test(r.html) ? " barline" : "") + '" data-act="' + r.act + '"' +
            (r.fac ? ' data-fac="' + r.fac + '"' : "") + (r.tab ? ' data-tab="' + r.tab + '"' : "") + ">" + r.html + "</div>";
        }).join("") + "</div>";
    }
    var S = CF.state.sports;
    CF.sports.regenEnergy();
    var e = S.handEnergy || 0, emax = CF.sports.maxHandEnergy(), epct = Math.max(0, Math.min(100, e / emax * 100));
    var run = CF.sports.runState();
    var steroidLeft = Math.max(0, 86400000 - (Date.now() - (S.lastSteroidBuy || 0)));

    /* Two reasons a panel is missing, and they are different things:
     *   - NOT UNLOCKED YET — the system exists, you just haven't reached it
     *     (the garden needs house 2). Play on and it appears.
     *   - NOT BUILT — we haven't written it. `CF.ruleset.built` gates these, and
     *     the markup stays put so flipping the flag brings the panel straight
     *     back. Nothing below is deleted, only skipped. */
    var B = CF.ruleset.built;
    var showGarden = (CF.state.player.houseLevel || 0) >= CF.ruleset.locationHouseReq.garden;

    $("locationPanel").innerHTML =
      '<div class="panel"><div class="bar">Account overview</div>' +
      '<div class="acc-cols"><div>' +
        (B.mining ? box("Mining information", [
          "Battery charge: <b>100</b> %", "Battery charging: <b>00:00:00</b>", "Progress to map update: <b>72.1</b> %"]) : "") +
        box("Sports complex information", [
          { act: "acc-sports", fac: "gym",
            html: 'Hand energy: <span class="ebar"><i style="width:' + epct.toFixed(1) + '%"></i></span> <b>' + fmt(e) + "</b> / " + fmt(emax) },
          { act: "acc-sports", fac: "trail",
            html: run ? 'You are still training your endurance <b id="accRun">' + hms(CF.sports.runSecondsLeft()) + "</b>"
                      : "You are <b>not</b> training your endurance" },
          { act: "acc-sports", fac: "shop",
            html: steroidLeft > 0 ? 'You can buy steroids in the store: <b id="accSteroid">' + hms(steroidLeft / 1000) + "</b>"
                                  : "You can buy steroids in the store <b>NOW</b> !" },
          { act: "acc-sports", fac: "gym", html: "Your power is <b>" + fmt(CF.sports.power().level) + "</b>, endurance <b>" + fmt(CF.sports.endurance().level) + "</b>" }]) +
        (showGarden ? box("Garden information", gardenAccRows()) : "") +
      "</div><div>" +
        (B.houseSewer ? box("Villas and sewer information", [
          /* Both rows go to the map and leave you where you actually were —
             standing in a tunnel and clicking "Villa moves" should not haul you
             up to the street, and vice versa. */
          { act: "go-houses", html: gearLine("Villa moves", CF.state.houseGear) },
          { act: "go-houses", html: gearLine("Sewer moves", CF.state.sewerGear) }
        ].concat(
          // an empty backpack is not news — the row only earns its place with something in it
          CF.houses.items() > 0
            ? [{ act: "go-houses", html: "You have <b>" + fmt(CF.houses.items()) + "</b> stolen items in your backpack" }]
            : []
        )) : "") +
        /* No Hospital box here: endurance already has a row in the sidebar, and
           a panel that only repeats it is noise. It comes back when the
           hospital has a business to report on. */
        box("Other information", [
          { act: "acc-streets", html: "Your drug belt holds <b>" + fmt(CF.chemist.beltCap()) + "</b> g (<b>" + fmt(CF.chemist.beltUsed()) + "</b> g used)" },
          { act: "acc-house", html: "Your house is level <b>" + fmt(CF.state.player.houseLevel || 0) + "</b>" }
        ].concat(
          /* Without a vessel both harbour lines say the same thing twice ("you
             don't have one" / "the fisherman has one for sale"), so until you
             own a boat there is only the one line worth printing. */
          CF.harbor.owned()
            ? [{ act: "go-harbor", html: harborRefitLine() }, { act: "go-harbor", html: harborTripLine() }]
            : [{ act: "go-harbor", html: "The old fisherman still has a ship for sale" }]
        ).concat(
          B.bankItems         ? ["You can maintain <b>5</b> more bank items"] : [],
          B.casinoCoupons     ? ["You have <b>24</b> more casino coupons"] : [],
          B.marketHandicrafts ? ["You can still buy <b>100,000</b> handicrafts at the market"] : [],
          B.marketMedical     ? ["You can still buy <b>10,000</b> medical supplies from the market"] : []
        )) +
      "</div></div>" +
      '<p class="acc-note"><b>NOTE!</b> More panels appear here as you unlock new parts of the game.</p>' +
      '<p class="acc-note">Click any highlighted line to jump straight to that part of the game.</p></div>';
  }

  /* ======================= CALCULATOR POPUP ============================ */
  function renderModal() {
    /* The welcome screen holds a half-typed name, and a tavern wave firing
     * mid-render would wipe it — so once it is up it is refreshed in place
     * rather than rebuilt. It has no close button on purpose: picking a name is
     * the way out. */
    if (ui.welcomeOpen) {
      if (!$("welcomeName")) {
        $("modalHost").innerHTML = '<div class="modal-wrap"><div class="modal narrow welcome-modal">' +
          '<div class="bar">Welcome to Crime Factory</div>' +
          '<div class="modal-body">' + welcomeBody() + "</div></div></div>";
        var wi = $("welcomeName"); if (wi) wi.focus();
      } else {
        var we = $("welcomeErr");
        if (we) we.innerHTML = noticeHtml({ err: ui.welcomeError, errLabel: "ERROR!" });
      }
      return;
    }
    if (ui.calcOpen) {
      $("modalHost").innerHTML = '<div class="modal-wrap"><div class="modal">' +
        '<button class="modal-x" data-act="calc-close" title="Close">&#10005;</button>' +
        '<div class="bar">Calculator</div><div class="modal-body">' + calculatorBody() + "</div></div></div>";
    } else if (ui.debugOpen) {
      $("modalHost").innerHTML = '<div class="modal-wrap"><div class="modal">' +
        '<button class="modal-x" data-act="debug-close" title="Close">&#10005;</button>' +
        '<div class="bar">Debug</div><div class="modal-body">' + debugBody() + "</div></div></div>";
    } else if (ui.edHelpOpen) {
      $("modalHost").innerHTML = '<div class="modal-wrap"><div class="modal">' +
        '<button class="modal-x" data-act="ed-help-close" title="Close">&#10005;</button>' +
        '<div class="bar">Gardening</div><div class="modal-body">' + edHelpBody() + "</div></div></div>";
    } else if (ui.cookBook) {
      $("modalHost").innerHTML = '<div class="modal-wrap"><div class="modal wide">' +
        '<button class="modal-x" data-act="book-close" title="Close">&#10005;</button>' +
        '<div class="bar">' + (ui.cookBook === "fish" ? "Fish food recipes" : "Vegetarian recipes") +
        '</div><div class="modal-body">' + cookBookBody(ui.cookBook === "fish") + "</div></div></div>";
    } else if (ui.canHelpOpen) {
      $("modalHost").innerHTML = '<div class="modal-wrap"><div class="modal">' +
        '<button class="modal-x" data-act="can-help-close" title="Close">&#10005;</button>' +
        '<div class="bar">Cooking</div><div class="modal-body">' + canHelpBody() + "</div></div></div>";
    } else if (ui.medHelpOpen) {
      $("modalHost").innerHTML = '<div class="modal-wrap"><div class="modal">' +
        '<button class="modal-x" data-act="med-help-close" title="Close">&#10005;</button>' +
        '<div class="bar">Developing medical science</div><div class="modal-body">' + medHelpBody() + "</div></div></div>";
    } else if (ui.gardenHelpOpen) {
      $("modalHost").innerHTML = '<div class="modal-wrap"><div class="modal">' +
        '<button class="modal-x" data-act="garden-help-close" title="Close">&#10005;</button>' +
        '<div class="bar">Stealing from the garden</div><div class="modal-body">' + gardenHelpBody() + "</div></div></div>";
    } else if (ui.chemHelpOpen) {
      $("modalHost").innerHTML = '<div class="modal-wrap"><div class="modal">' +
        '<button class="modal-x" data-act="chem-help-close" title="Close">&#10005;</button>' +
        '<div class="bar">Chemist — how to craft</div><div class="modal-body">' + chemHelpBody() + "</div></div></div>";
    } else if (ui.guideOpen) {
      $("modalHost").innerHTML = '<div class="modal-wrap"><div class="modal guide-modal">' +
        '<button class="modal-x" data-act="guide-close" title="Close">&#10005;</button>' +
        '<div class="bar">Game guide</div><div class="modal-body">' + guideBody() + "</div></div></div>";
    } else if (ui.nameOpen) {
      // same in-place refresh as the welcome screen, for the same reason
      if (!$("nickInput")) {
        $("modalHost").innerHTML = '<div class="modal-wrap"><div class="modal narrow">' +
          '<button class="modal-x" data-act="name-close" title="Close">&#10005;</button>' +
          '<div class="bar">Change your nickname</div><div class="modal-body">' + nameBody() + "</div></div></div>";
        var ni = $("nickInput"); if (ni) { ni.focus(); ni.select(); }
      } else {
        var ne = $("nameErr");
        if (ne) ne.innerHTML = noticeHtml({ err: ui.nameError, errLabel: "ERROR!" });
      }
    } else { $("modalHost").innerHTML = ""; }
  }

  /* Nickname editor. The name is yours alone in a single-player build, so the
   * only rules are that it exists and stays a sane length. */
  function nameBody() {
    var p = CF.state.player;
    return '<div class="namebox">' +
      '<div id="nameErr">' + noticeHtml({ err: ui.nameError, errLabel: "ERROR!" }) + "</div>" +
      "<p>This is the name shown on your account and in the rankings. It is saved with your progress in this browser.</p>" +
      '<div class="nrow"><label for="nickInput">Nickname</label>' +
      '<input type="text" id="nickInput" maxlength="20" value="' + esc(p.name) + '" autocomplete="off"></div>' +
      '<div class="cbtn"><button class="btn go" data-act="name-save">Save</button></div>' +
      '<p class="nb">2&ndash;20 characters. Letters, numbers, spaces and <b>- _ . \'</b> are allowed.</p></div>';
  }
  /* ========================== THE GAME GUIDE ============================
   * One popup, skills down the left, the chosen article on the right. Every
   * figure is read from CF.ruleset / the live modules rather than typed in, so
   * the guide cannot drift away from the game the way a written page would.
   *
   * ADDING TO IT: drop an entry in GUIDE below. `body` is a function returning
   * HTML; leave it out and the article renders as "not built yet" with whatever
   * `soon` text you give it. The groups are deliberately open-ended — the
   * "Coming later" one exists so unbuilt systems have a home from day one. */
  function gTitle(t) { return "<h3>" + esc(t) + "</h3>"; }
  function gList(items) { return "<ul>" + items.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul>"; }
  function gSteps(items) { return "<ol>" + items.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ol>"; }
  var GUIDE = [
    { group: "Getting started", items: [
      { id: "basics", name: "How the game works", body: function () {
        var h = CF.ruleset.house, r = CF.ruleset.locationHouseReq;
        return gTitle("How the game works") +
          "<p>You start with nothing. No house, every skill at level <b>1</b>, and a tavern job you have not taken " +
          "yet. Everything else you build.</p>" +
          gSteps([
            "<b>Work the tavern.</b> It pays money and Barkeeping levels, and at the start it is the only income you have.",
            "<b>Build a house.</b> The first level needs <b>" + h.firstLevelSkill + " " + h.firstLevelReq +
            "</b>, and every level after that needs <b>Crafting of level &times; " + h.craftLevelsPerHouseLevel + "</b>.",
            "<b>Every house level opens a room</b>, and every room teaches a new trade. The house is the spine of the game.",
            "<b>Places around town open the same way.</b> Slum at house <b>" + r.slum + "</b>, Garden <b>" +
            r.garden + "</b>, Racing complex <b>" + r.racing + "</b>, Casino <b>" + r.casino + "</b>."]) +
          "<p>The trades feed each other rather than standing alone. The garden grows herbs the medicine laboratory " +
          "needs, the harbor lands fish the canteen cooks, and the crafts room makes the syringes that finish a first " +
          "aid kit. Very little stays a dead end for long.</p>" +
          '<p class="g-note">Your progress saves in this browser as you play. See ' +
          '<a data-act="guide-pick" data-id="saving">Saving your progress</a>.</p>';
      } },
      { id: "update", name: "The update", body: function () {
        var u = CF.ruleset.perUpdate, g = CF.ruleset.garden;
        var mins = Math.round(CF.ruleset.tavernIntervalSec / 60);
        return gTitle("The update") +
          "<p>Most of the game ticks together, once an hour, <b>on the clock</b>. If it is 16:30 then the next update " +
          "is <b>30 minutes</b> away rather than a full hour. The sidebar counts down to it and tells you which hour " +
          "it lands on.</p>" +
          "<p>Every update:</p>" +
          gList([
            "your hand energy goes up <b>+" + u.handEnergy + "</b>, to a maximum of " + fmt(CF.ruleset.sports.handEnergyMax),
            "villa gear and sewer gear each go up <b>+" + u.houseGear + "</b>, to a maximum of " + u.gearMax,
            "the garden's watering allowance comes back, <b>" + g.waterPerHour + "</b> plants an hour, and moisture drops a point"]) +
          "<p><b>The tavern runs on its own faster clock.</b> Customers arrive every <b>" + mins + " minutes</b>, so " +
          "you get " + Math.round(3600 / CF.ruleset.tavernIntervalSec) + " waves of trade between one update and the next.</p>" +
          "<p><b>Hours you pick are counted in updates rather than on a stopwatch.</b> A one hour run on the Forest " +
          "Trail started at 16:30 finishes at the 17:00 update, so that first hour is short by however far into the " +
          "current hour you set off. Two hours finishes at 18:00. Any screen that offers hours shows you the clock " +
          "time you would finish at.</p>";
      } },
      { id: "house", name: "Your house", body: function () {
        var h = CF.ruleset.house;
        return gTitle("Your house") +
          "<p>The house gates almost everything. Level <b>1</b> needs <b>" + h.firstLevelSkill + " " + h.firstLevelReq +
          "</b>, since you cannot craft before you own one, and every level after that needs <b>Crafting of level " +
          "&times; " + h.craftLevelsPerHouseLevel + "</b>. Each level costs <b>" + h.costRatio + " times</b> the one " +
          "before it, starting at <b>" + fmt(h.costBase) + "</b> CC, up to level <b>" + h.maxLevel + "</b>.</p>" +
          "<p>A room opens at the house level matching its number:</p>" +
          '<table class="g-tab"><tr><th>Level</th><th>Room</th><th>Trains</th><th>Yours</th></tr>' +
          [[1, "Crafts room", "Crafting"], [2, "Drug lab", "Chemist"], [3, "Garage", "not built yet"],
           [5, "Medicine laboratory", "Medical science"], [6, "Blacksmith", "Smithing"]].map(function (r) {
            var have = (CF.state.player.houseLevel || 0) >= r[0];
            return "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td><td>" + r[2] +
              '</td><td class="' + (have ? "g-yes" : "g-no") + '">' + (have ? "open" : "locked") + "</td></tr>";
          }).join("") + "</table>" +
          "<p>Walk into a room you have not built yet and the game tells you which level you are missing instead of " +
          "letting you in.</p>";
      } },
      { id: "fame", name: "Fame", body: function () {
        return gTitle("Fame") +
          "<p><b>Fame is never earned directly.</b> It is a summary of everything you have levelled, so the only way " +
          "to raise it is to get better at something.</p>" +
          "<p>Not every skill counts for the same amount, and the reward grows sharply as a level climbs. One skill " +
          "pushed high is worth far more fame than several kept middling, so if you are chasing fame, specialise " +
          "rather than spread yourself thin.</p>" +
          "<p>Hover any skill in the sidebar to see its level, how far through it you are, and what it is worth to you.</p>";
      } },
      { id: "money", name: "Money", body: function () {
        return gTitle("Money") +
          "<p>Everything is priced in <b>CC</b>. You earn it by selling: drinks at the tavern, medicines at the " +
          "laboratory warehouse, weapons at the armory, drugs on the streets. You spend it on materials, house levels, " +
          "land and equipment.</p>" +
          gList([
            "<b>Bank.</b> Deposit and withdraw. Buying the bank itself is not built.",
            "<b>Casino tokens.</b> Bought and cashed back out at the Cashier at " + CF.ruleset.casino.tokenRate +
            " CC per token. Chips are only spendable inside the casino.",
            "<b>Credits</b> are a premium currency and are <b>excluded</b> from this build, along with VIP " +
            "memberships and trading with other players."]);
      } },
      { id: "saving", name: "Saving your progress", body: function () {
        return gTitle("Saving your progress") +
          "<p>Your game saves <b>automatically, in this browser</b>, after anything that changes it. Close the tab, " +
          "come back later, and it picks up where you left off, including the updates that landed while you were away.</p>" +
          gList([
            "The save lives in this browser on this device. A different browser, or a private window, starts a new game.",
            "Clearing site data clears the save.",
            "<b>Debug &rarr; General</b> has <b>Save</b> and <b>Load</b> buttons that export and import the whole " +
            "game as a JSON file. That is how you move progress between machines, and it is the only copy that " +
            "survives a cleared browser."]) +
          "<p>Nothing is sent anywhere. There is no account and no server, so the game is entirely yours and entirely " +
          "local.</p>";
      } },
    ] },

    { group: "Trades", items: [
      { id: "Barkeeping", name: "Barkeeping", body: function () {
        var t = CF.ruleset.tavernPurchase, mins = Math.round(CF.ruleset.tavernIntervalSec / 60);
        return gTitle("Barkeeping") +
          "<p>Your first trade, and at the start your only income. Trained at the <b>Tavern</b>.</p>" +
          gSteps([
            "<b>Buy raw materials.</b> The price scales with your reputation.",
            "<b>Press them into raw juice</b>, then <b>mix</b> juice and materials into finished drinks.",
            "<b>Open the tavern.</b> Customers arrive every <b>" + mins + " minutes</b> and buy on their own, so you " +
            "earn money and Barkeeping points without clicking anything.",
            "<b>Keep it stocked.</b> Customers who find no drink leave unsatisfied, and your reputation <b>falls</b>."]) +
          "<p><b>Reputation</b> is the dial that matters. It alone decides how many customers turn up, and serving " +
          "them raises it further, so a well stocked tavern speeds up on its own. Your warehouses grow with your " +
          "level too, so the higher your Barkeeping the more materials and juice you can hold at once.</p>" +
          "<p>At <b>Barkeeping " + t.reqDrinkMaster + "</b> and <b>" + fmt(t.priceCC) + " CC</b> you can buy the " +
          "tavern outright. That opens the second floor, the <b>Canteen</b>, and with it the Cooking skill.</p>";
      } },
      { id: "Crafting", name: "Crafting", body: function () {
        var h = CF.ruleset.house;
        return gTitle("Crafting") +
          "<p>The <b>Crafts room</b>, at house level 1. Crafting is the skill the whole house rests on, since every " +
          "level after the first needs <b>Crafting of level &times; " + h.craftLevelsPerHouseLevel + "</b>, so it pays " +
          "to keep it ahead of everything else.</p>" +
          gList([
            "<b>Three stations.</b> The Armchair sews, the Woodworking corner cuts, and the Furnaces melt metal and fire clay.",
            "<b>Craft cabinet</b> holds your materials, and the <b>Finished Items Cabinet</b> holds what you have made.",
            "<b>Hand tools</b> such as the needle, scissors and hammer are bought once at the Slum market and never wear out."]) +
          "<p>Materials come from the <b>Craft supplies counter</b> a whole backpack at a time, and the backpack grows " +
          "by <b>" + CF.ruleset.craft.backpackPerLevel + "</b> items every level. Yours currently holds <b>" +
          fmt(CF.craft.capacity()) + "</b>.</p>" +
          "<p>Crafted goods are not only for selling. The syringes and needle packs that finish a first aid kit come " +
          "from here, not from the medicine laboratory.</p>";
      } },
      { id: "Smithing", name: "Smithing", body: function () {
        return gTitle("Smithing") +
          "<p>The <b>Blacksmith</b>, at house level 6.</p>" +
          gList([
            "<b>Anvil.</b> Forge weapons. Upgrading it unlocks better ones and lets you work more at once.",
            "<b>Armory.</b> Collect and sell what you have forged.",
            "<b>Blacksmith Warehouse.</b> The metal stock the anvil draws on."]) +
          "<p>Forging feeds the fighting side of the game, which is still mostly unbuilt, so for now selling through " +
          "the armory is the reliable return.</p>";
      } },
      { id: "Chemist", name: "Chemist", body: function () { return gTitle("Chemist") + chemHelpBody(); } },
      { id: "Cooking", name: "Cooking", body: function () { return gTitle("Cooking") + canHelpBody(); } },
      { id: "Medical science", name: "Medical science", body: function () { return gTitle("Medical science") + medHelpBody(); } },
      { id: "Gardening", name: "Gardening", body: function () { return gTitle("Gardening") + edHelpBody(); } },
      { id: "Stealing", name: "Stealing", body: function () { return gTitle("Stealing") + gardenHelpBody(); } },
      { id: "Weapon handling", name: "Weapon handling", body: function () {
        var wh = CF.houses.weaponHandling();
        return gTitle("Weapon handling") +
          "<p>What you learn by fighting, and the only skill the <a data-act=\"guide-pick\" data-id=\"sewer\">sewer</a> " +
          "trains. You are level <b>" + fmt(wh.level) + "</b>, <b>" + fmt(wh.pointsToLevel) + "</b> points off the next.</p>" +
          gSteps([
            "<b>Kill things in the tunnels.</b> Every win pays points, and a tougher opponent pays far more than " +
            "a weak one, so the way up is to fight the hardest thing you can reliably beat.",
            "<b>It gates how deep you can go.</b> Each level down the sewer asks for more of it.",
            "<b>It is most of your damage.</b> Endurance and the body stats help, but weapon handling is what " +
            "decides whether a fight is worth taking."]) +
          '<p class="g-note">Lose a fight and your endurance is emptied, which costs you a trip to the hospital. ' +
          "Read the opponent's level before you commit.</p>";
      } },
    ] },

    { group: "Body", items: [
      { id: "Endurance", name: "Endurance", body: function () {
        var rows = CF.runningOptions.map(function (o) {
          return "<tr><td>" + o.hours + " h</td><td>" + o.points + "</td><td>" + o.boots + "</td></tr>";
        }).join("");
        return gTitle("Endurance") +
          "<p>Trained at the <b>Forest Trail</b>, which is open to everyone from the start with no pass and no entry " +
          "fee. Pick how long to run and wait for it.</p>" +
          '<table class="g-tab"><tr><th>Run</th><th>Points</th><th>Boots</th></tr>' + rows + "</table>" +
          "<p>Running <b>spends running boots</b>, bought at the Sports shop, and they wear out. Longer runs pay more " +
          "in total but less per hour, so short repeated runs are the efficient choice if you are at the keyboard " +
          "anyway.</p>" +
          "<p><b>Steroids double the points</b> of a run. Stopping early forfeits the boots and the steroid, with no " +
          "refund.</p>" +
          "<p>The hours are counted in updates, so a one hour run started at 16:30 ends at 17:00.</p>" +
          "<p>Endurance is worth pushing early. The <b>Gym pass</b> asks for level <b>" +
          (function () { var n = 30; CF.sportsShop.forEach(function (x) { if (x.pass === "gym") n = x.req.level; }); return n; })() +
          "</b>, which makes it the gate on training Strength at all.</p>";
      } },
      { id: "Strength", name: "Strength", body: function () {
        var s = CF.ruleset.sports, u = CF.ruleset.perUpdate;
        var rows = CF.gymLifts.map(function (l) {
          return "<tr><td>" + esc(l.label) + "</td><td>" + l.energy + "</td><td>" + fmt(l.points) + "</td><td>" +
            (l.points / l.energy).toFixed(0) + "</td></tr>";
        }).join("");
        return gTitle("Strength") +
          "<p>Trained at the <b>Gym</b>, which needs a pass bought at the Sports shop at Endurance 30.</p>" +
          '<table class="g-tab"><tr><th>Lift</th><th>Energy</th><th>Points</th><th>Per energy</th></tr>' + rows + "</table>" +
          "<p>Look at the last column. <b>Heavier lifts pay more in total but less per unit of energy.</b> Energy is " +
          "your real bottleneck, so the lightest lift is the most efficient use of it.</p>" +
          "<p><b>Hand energy</b> is the limit. It goes up <b>" + u.handEnergy + "</b> at every update and caps at <b>" +
          fmt(s.handEnergyMax) + "</b>. A steroid restores <b>" + s.steroidEnergy + "</b> instantly. Each lift also " +
          "wears your <b>lifting belt</b> and <b>wristbands</b> by one.</p>";
      } },
      { id: "Fighting", name: "Fighting", body: function () {
        return gTitle("Fighting") +
          "<p><b>Fighting is never trained directly.</b> It is the average of your six body stats: Speed, Strength, " +
          "Endurance, Defence, Dexterity and Weapon handling. It moves only when one of those moves.</p>" +
          "<p>Yours is <b>" + fightingValue() + "</b>. Because it is an average, the cheapest way to raise it is " +
          "whichever body stat is currently lowest, not whichever is easiest to train.</p>";
      } },
      { id: "Speed", name: "Speed", soon: "Speed is trained at the <b>Stadium</b>. The entry ticket is already on sale at the Sports shop for anyone at Strength 20 or above, but the training itself is not built yet." },
      { id: "Dexterity", name: "Dexterity", soon: "Dexterity is trained at the <b>Boxing Hall</b>. The pass is already on sale at the Sports shop for anyone at Speed 15 or above, but the training itself is not built yet." },
      { id: "Defence", name: "Defence", soon: "Defence is trained at the <b>Sports complex</b> alongside Dexterity. Not built yet." },
    ] },

    { group: "Around town", items: [
      { id: "garden", name: "Garden", body: function () {
        var g = CF.ruleset.garden;
        return gTitle("Garden") +
          "<p>Needs house level <b>" + CF.ruleset.locationHouseReq.garden + "</b>, and you have to claim <b>[Become a " +
          "gardener]</b>, which additionally wants the tavern and house level <b>" + g.gardenerHouseLevel + "</b>.</p>" +
          gList([
            "<b>Greenhouse.</b> Steal seeds and drug plants. Every attempt costs <b>" + g.ticketPerSteal + "</b> ticket.",
            "<b>Ticket office.</b> Sells <b>Stealing level + " + g.ticketsBase + "</b> tickets at <b>" + fmt(g.ticketPriceCC) +
            "</b> CC each, and reopens every <b>" + Math.round(g.officeCooldownSec / 3600) + " hours</b>.",
            "<b>Edible herb garden.</b> Buy land, sow, water, harvest. Trains Gardening and feeds the canteen.",
            "<b>Medicinal herb beds.</b> <b>" + g.medBedsMax + "</b> beds, no watering needed. They feed the medicine laboratory."]) +
          "<p>The garden is the most connected place in the game, supplying the drug lab, the medicine laboratory and " +
          "the canteen all at once. See <a data-act=\"guide-pick\" data-id=\"Gardening\">Gardening</a> and " +
          "<a data-act=\"guide-pick\" data-id=\"Stealing\">Stealing</a> for the loops themselves.</p>";
      } },
      { id: "canteen", name: "Tavern &amp; Canteen", body: function () {
        var c = CF.ruleset.canteen;
        return gTitle("Tavern &amp; Canteen") +
          "<p>The tavern is where Barkeeping happens. Buying it (see <a data-act=\"guide-pick\" data-id=\"Barkeeping\">Barkeeping</a>) " +
          "opens the <b>Canteen</b> upstairs.</p>" +
          "<p>The canteen works backwards from most kitchens. <b>You choose a liquid first</b>, fill a <b>" +
          fmt(c.containerMax) + " L</b> container, and that is what gives you the raw materials. Only then do you " +
          "decide what to cook with them at the vegetarian corner or the fish food table.</p>" +
          gList([
            "Up to <b>" + c.brewMax + "</b> litres brewed at a time, and dishes up to <b>" + c.maxHours + "</b> hours long.",
            "A dish pays <b>" + c.cookPointsPerHour + "</b> Cooking points an hour, and dishes stack, so cooking the " +
            "same one again simply adds to its time.",
            "Both tables have a <b>recipe guide</b> button listing every dish and exactly what goes into it."]);
      } },
      { id: "harbor", name: "Seaport", body: function () {
        return gTitle("Seaport") +
          "<p>Where fish comes from. Buy a ship, hire a fishing crew and a defence crew, then send it out. It comes " +
          "back with the catch the canteen's fish dishes need.</p>" +
          gList([
            "Each <b>upgrade</b> costs a little more than the last and takes a few hours longer, and the screen tells " +
            "you both before you commit.",
            "You can <b>upgrade and sail at the same time</b>, since the refit clock and the trip clock run separately.",
            "Which fish you can land depends on your equipment level, so better equipment opens up better species."]);
      } },
      { id: "slum", name: "Slum", body: function () {
        return gTitle("Slum") +
          "<p>Needs house level <b>" + CF.ruleset.locationHouseReq.slum + "</b>. There are four areas, and the " +
          "<b>Market</b> is the one that matters most, since it is where materials are bought.</p>" +
          gList([
            "<b>Craft supplies counter.</b> Materials for the crafts room, a backpack at a time.",
            "<b>Culinary exchange.</b> Swap a field crop for the greenhouse fruit of the same level, one for one, " +
            "plus a small brokerage fee that scales with how much money you are carrying.",
            "<b>Drug belt counter.</b> A bigger belt, so you can carry more product to the streets.",
            "<b>Ticket counter.</b> Passes for the areas.",
            "The remaining counters are listed but not built yet."]) +
          "<p>Trading with other players is <b>excluded</b> from this build, so the market only ever trades with the " +
          "game itself.</p>";
      } },
      { id: "houses", name: "Villas and sewer", body: function () {
        var rs = CF.ruleset.houseSteal, u = CF.ruleset.perUpdate;
        var rows = CF.houseLoot.map(function (l) {
          return "<tr><td>" + esc(l.label.charAt(0).toUpperCase() + l.label.slice(1)) + "</td><td>" +
            Math.round(l.w * 100) + "%</td></tr>";
        }).join("");
        var M = CF.houseMap;
        return gTitle("Villas and sewer") +
          "<p>A district of <b>" + (M.blocksX * M.blocksY) + "</b> blocks you work on foot. Walk up to a house, rob " +
          "it, move on. It is the other half of <a data-act=\"guide-pick\" data-id=\"Stealing\">Stealing</a>, " +
          "alongside the garden.</p>" +
          gSteps([
            "<b>Click a house</b> and take <b>Walk here and steal</b> — it does both in one go. Plain <b>Walk here</b> " +
            "is underneath if you only want to move.",
            "<b>Walking spends moves</b>, one a tile. Houses next to each other are one move apart, so working " +
            "along a row is cheap. You hold <b>" + u.gearMax + "</b> moves at most.",
            "<b>Robbing itself is free</b>, but a house is only good once and turns grey when you have been through it.",
            "<b>Moves come back +" + u.houseGear + " an update</b>, and every house goes back to worth robbing at the " +
            "same moment. If the district looks grey, that is what you are waiting for."]) +
          "<p>The map is bigger than the window: you stay in the middle and the streets slide past as you walk. " +
          "Dark ground past the last street is simply the edge of the district.</p>" +
          "<p>What you come away with:</p>" +
          '<table class="g-tab"><tr><th>Find</th><th>Chance</th></tr>' + rows + "</table>" +
          "<p>Money is the common case, <b>" + fmt(rs.minCC) + "</b> to <b>" + fmt(rs.maxCC) + "</b> CC a house, " +
          "but it is not really the point. The <b>stolen items</b> are. A villa holds curtains, clocks, house " +
          "plants, aquarium fish, mirrors, sculptures, paintings and rarer things still, and every one of them is " +
          'a numbered <a data-act="guide-pick" data-id="bank">bank item</a>. Most houses give you something from ' +
          "the cheap end; now and then one gives up a masterpiece. A second copy of anything you already own goes " +
          "to the bank warehouse, which is where items turn back into cash. Every job pays <b>" +
          rs.stealPoints + "</b> steal points either way.</p>" +
          "<p>Click any road tile to <b>climb down into the sewer</b>, which has its own guide page.</p>" +
          '<p class="g-note">Stolen items and fighting equipment have nowhere to go until the bank and the ' +
          "fighting side exist, so for now they are counted and kept.</p>";
      } },
      { id: "sewer", name: "The sewer", body: function () {
        var u = CF.ruleset.perUpdate, sr = CF.ruleset.sewer, req = CF.sewer.reqWeapon || {};
        var rows = [];
        var S = CF.sewer, have = CF.houses.weaponHandling().level;
        for (var L = 1; L <= S.maxLevel; L++) {
          var need = req[L] || 0;
          var lo = S.levelBase + (L - 1) * S.levelsPerFloor;
          rows.push("<tr><td>Level " + L + "</td><td>" + lo + " &ndash; " + (lo + S.levelsPerFloor - 1) + "</td>" +
            "<td>" + (need ? "Weapon handling " + need : "&mdash;") + "</td>" +
            '<td class="' + (have >= need ? "g-yes" : "g-no") + '">' +
            (have >= need ? "open" : "you are " + have) + "</td></tr>");
        }
        return gTitle("The sewer") +
          "<p>Under the villas, reached by clicking <b>any road tile</b> on the street map. Six levels of brick " +
          "tunnel, laid out on the same grid as the streets above, so the way down is the way you already know. " +
          "This is where <a data-act=\"guide-pick\" data-id=\"Weapon handling\">Weapon handling</a> is trained.</p>" +
          gSteps([
            "<b>You can climb from any tunnel tile</b>, up or down. The ladders you see are only there to mark the " +
            "obvious spots, they are not doors you have to find.",
            "<b>You keep your position</b> going between levels. Stand still, climb down, and you are on the same " +
            "square one floor lower, so the levels stack and you can navigate by them.",
            "<b>Walking spends sewer moves</b>, one a tile, up to <b>" + u.gearMax + "</b>, topped up <b>+" +
            u.sewerGear + " an update</b>. The update also puts fresh company on the map.",
            "<b>Fighting is the point.</b> Kill something and you take weapon handling points, and about one in " +
            "five leaves a <b>chest</b> behind. Nothing is lying around to be picked up: a chest has to be dropped.",
            "<b>Chests hold treasure</b> — ancient coins, silver and gold bars, gemstones — and it goes straight " +
            'into your <a data-act="guide-pick" data-id="bank">bank vaults</a>. How deep you are decides how far ' +
            "up that catalogue you can reach, so the deeper chambers only fill from the deeper floors. Chests " +
            "also turn up cold weapons and plain cash."]) +
          '<p class="g-note">Endurance is all or nothing down here. <b>Winning a fight costs you nothing.</b> ' +
          "<b>Losing one empties it</b>, and only a hospital will put it back. So the skill is reading what you " +
          "are looking at and walking away from the ones you cannot take, not counting how many you can afford.</p>" +
          '<p class="g-note">Read the number on an opponent before you commit. Its colour is that fight as it ' +
          "would go for <b>you</b>, right now: green you take comfortably, red will finish you. Weapon handling " +
          "decides what you can kill; <b>endurance decides what you can survive</b>, and the deeper floors hit " +
          "hard enough that training it is what actually buys you depth.</p>" +
          "<p>The deeper you go the worse the company and the better the pay. Getting down is gated:</p>" +
          '<table class="g-tab"><tr><th>Depth</th><th>Opponents</th><th>Needs</th><th>Yours</th></tr>' +
          rows.join("") + "</table>" +
          "<p>Chests pay <b>" + fmt(sr.minCC) + "</b> CC and up, scaled by how deep you found them.</p>";
      } },
      { id: "bank", name: "Bank", body: function () {
        return gTitle("Bank") +
          "<p>Where cash sits when it is not in your pocket. Money on you is what every counter and shop spends; " +
          "money in the bank is simply out of the way.</p>" +
          gSteps([
            "<b>Deposit and withdraw</b> freely between the two. A new account starts with most of its money in " +
            "the bank, so the first thing you will ever need to do here is take some out.",
            "<b>You have to buy the bank</b> before any of the rest of it opens.",
            "<b>Bank items</b> are the collection: 200 numbered pieces, from curtains up to priceless " +
            'manuscripts. They come from robbing <a data-act="guide-pick" data-id="houses">villas</a>, and the ' +
            "bank cannot be improved without a growing number of different ones. They wear out and need " +
            "maintaining, a few an hour.",
            "<b>Vault treasure is a different catalogue</b>: 80 coins, bars and gemstones in five chambers, and " +
            'it comes out of the chests in the <a data-act="guide-pick" data-id="sewer">sewer</a>. A chamber only ' +
            "opens once you own every treasure numbered before it.",
            "<b>The warehouse</b> holds your duplicates, and is the only place items turn back into cash."]) +
          '<p class="g-note">Buying and trading items with other people is not here — that is going to the Slum ' +
          "with the rest of the market.</p>";
      } },
      { id: "hospital", name: "Hospital", body: function () {
        return gTitle("Hospital") +
          "<p>The place you go when the sewer has finished with you. Lose a fight down there and your endurance " +
          "is emptied; nothing else in the game puts it back.</p>" +
          gSteps([
            "<b>Get treated for cash.</b> The fee rises steeply with how much endurance you have to restore, so " +
            "the fitter you are the dearer it is to be put back together.",
            "<b>Or use a first aid kit</b>, packed at the medicine laboratory from your own medicines. It costs no " +
            "money at all, which makes the whole medicine chain worth running for its own sake."]) +
          '<p class="g-note">Only the treatment desk is open. Running the hospital as a business — its level, the ' +
          "wards, surgery, staff and books — is still to come, along with the extra medicinal beds it unlocks.</p>";
      } },
      { id: "bunker", name: "Betting Bunker", body: function () {
        var vs = CF.betting.venues();
        var rows = vs.map(function (v) {
          var open = CF.betting.isOpen(v);
          return "<tr><td>" + esc(v.name) + "</td><td>" + v.runners.length + "</td>" +
            "<td>" + fmt(v.minBet) + " &ndash; " + fmt(v.maxBet) + "</td>" +
            '<td class="' + (open ? "g-yes" : "g-no") + '">' + (open ? "open" : "Stealing " + v.lvl) + "</td></tr>";
        }).join("");
        return gTitle("Betting Bunker") +
          "<p>In the <b>Slum</b>, behind a ticket from the Market. The bunker runs its own events and pays out in " +
          "cash, so unlike the casino there is nothing to change into chips first.</p>" +
          '<table class="g-tab"><tr><th>Venue</th><th>Runners</th><th>Stakes (CC)</th><th>Yours</th></tr>' + rows + "</table>" +
          gSteps([
            "<b>Pick a venue and a runner.</b> Shorter odds win more often and pay less, which is the whole trade.",
            "<b>Set your stake</b> and place the bet. The table shows what each runner would pay you before you commit.",
            "<b>Watch it run</b> on the Active bets tab. You can skip to the result; the outcome was already decided when you placed the bet, so skipping costs you nothing.",
            "<b>Bet history</b> keeps your last <b>" + CF.ruleset.bettingBunker.historyMax + "</b> slips with what you staked and what came back."]) +
          "<p>New venues open as your <b>Stealing</b> level climbs, and the deeper ones take bigger stakes and pay " +
          "longer odds.</p>" +
          "<p>Be clear-eyed about it: the bunker keeps a cut of everything staked, the same at every venue and on " +
          "every runner. There is no soft spot to find. It is somewhere to spend money, not a way to earn it.</p>";
      } },
      { id: "casino", name: "Casino", body: function () {
        var c = CF.ruleset.casino;
        return gTitle("Casino") +
          "<p>Needs house level <b>" + CF.ruleset.locationHouseReq.casino + "</b>. The <b>Cashier</b> is the only way " +
          "in or out. Money becomes tokens at <b>" + c.tokenRate + " CC per token</b>, and you can cash tokens back " +
          "into money there whenever you like. Chips are no use anywhere else, so anything you want to keep has to " +
          "come back out through the Cashier.</p>" +
          gList([
            "<b>Blackjack.</b> You set the stake first, then play the hand out.",
            "<b>Video poker.</b> The paytable is on the screen.",
            "<b>Slot machine.</b> The spin buttons take straight from your tokens."]) +
          "<p>Every game keeps a slice of what passes through it, which is what a casino is for. Treat it as somewhere " +
          "to lose money entertainingly rather than a way to make it.</p>";
      } },
      { id: "sports", name: "Sports complex", body: function () {
        return gTitle("Sports complex") +
          "<p>Five facilities. The <b>Sports shop</b> and <b>Forest Trail</b> are always open. The Gym, Stadium and " +
          "Boxing Hall each need a pass bought at the shop, and each pass has a stat requirement of its own.</p>" +
          gList([
            "<b>Forest Trail</b> trains <a data-act=\"guide-pick\" data-id=\"Endurance\">Endurance</a>, and is open to everyone.",
            "<b>Gym</b> trains <a data-act=\"guide-pick\" data-id=\"Strength\">Strength</a>, with a pass at Endurance 30.",
            "<b>Stadium</b> trains Speed, with a ticket at Strength 20. The training is not built yet.",
            "<b>Boxing Hall</b> trains Dexterity, with a pass at Speed 15. The training is not built yet.",
            "<b>Sports shop</b> sells equipment, steroids and the passes themselves."]) +
          "<p>Equipment is <b>consumed by training</b>. Running spends boots, and lifting spends the belt and " +
          "wristbands, so budget for replacements and not just for the pass.</p>";
      } },
    ] },

    { group: "Coming later", items: [
      { id: "Mining", name: "Mining", soon: "Mining will supply <b>Uranium</b> for the crafts room's furnaces and <b>Charcoal</b>, neither of which has any source at the moment. That is why a few of the later recipes cannot be finished yet. The account overview already has a Mining panel sitting there waiting for it." },
      { id: "garage", name: "Garage", soon: "House room 3, for cars and spare parts. It is also what the Racing complex is waiting on, since racing needs both a garage and a car." },
      { id: "market", name: "Player market", soon: "<b>Deliberately excluded</b>, along with credits and VIP memberships. The market counters that remain all trade with the game rather than with other players." },
    ] },
  ];

  function guideFind(id) {
    var hit = null;
    GUIDE.forEach(function (g) { g.items.forEach(function (i) { if (i.id === id) hit = i; }); });
    return hit;
  }
  function guideBody() {
    var cur = ui.guideId || "basics", item = guideFind(cur) || guideFind("basics");
    var nav = GUIDE.map(function (g) {
      return '<div class="g-group">' + esc(g.group) + "</div>" +
        g.items.map(function (i) {
          return '<a class="g-item' + (i.id === item.id ? " cur" : "") + (i.body ? "" : " soon") +
            '" data-act="guide-pick" data-id="' + esc(i.id) + '">' + i.name + "</a>";
        }).join("");
    }).join("");
    var body = item.body ? item.body()
      : gTitle(item.name) + '<div class="notice"><b>NOT BUILT YET</b></div><p>' + item.soon + "</p>";
    /* During the first run the guide is the last thing standing between the
     * player and the game, so it gets an explicit way out rather than only a
     * close cross they might not think to press. */
    var footer = ui.onboarding
      ? '<div class="cbtn g-start"><button class="btn go" data-act="guide-close">Start playing &raquo;</button></div>'
      : "";
    return '<div class="guide"><div class="g-nav">' + nav + "</div>" +
           '<div class="g-body chelp">' + body + "</div></div>" + footer;
  }

  /* Our own summary of the medical-science chain (mechanics + formulas), written
   * from the official help page rather than copied from it. */
  /* Our own summary of the gardening loop (mechanics + numbers we've confirmed). */
  function edHelpBody() {
    var g = CF.ruleset.garden;
    return '<div class="chelp"><p>Growing food plants trains <b>Gardening</b>:</p><ol>' +
      "<li><b>Steal seeds</b> at the Greenhouse (1 ticket = 3 packets). Edible and medicinal seeds unlock by <b>Gardening</b> level; the drug plants unlock by <b>Chemist</b> level instead.</li>" +
      "<li><b>Buy land</b> at your office for <b>" + fmt(g.landPriceCC) + "</b> CC per m&sup2;, one purchase every " + Math.round(g.landCooldownSec / 3600) + " hours. Each m&sup2; holds <b>" + g.plantsPerM2 + "</b> plants.</li>" +
      "<li><b>Sow</b> the seeds. A plant takes about <b>" + g.edibleGrowHours + " hours</b> and starts at <b>" + g.moistureMax + "/" + g.moistureMax + "</b> moisture.</li>" +
      "<li><b>Water</b> it: moisture drops <b>1</b> point per update, and you may water <b>" + g.waterPerHour + "</b> plants per hour. Tick the plants and press Go. A plant that dries out dies and has to be cleared.</li>" +
      "<li>An <b>Automatic watering can</b> installs a permanent waterer on a plant, and that plant never needs watering by hand again.</li>" +
      "<li>Watering can turn up <b>pests</b> (caterpillars, birds, moles). Clear each with its matching tool on the Control Pests tab.</li>" +
      "<li><b>Harvest</b> when the timer ends: <b>plant level + " + g.ediblePointsBase + "</b> gardening points and <b>" + g.fruitPerPlant + "</b> fruit.</li>" +
      "</ol><p>Medicinal beds work the same way but need no watering at all. Sow, wait, then <b>cut the plant</b>. What a bed pays scales with your Gardening level.</p></div>";
  }
  function medHelpBody() {
    var r = CF.ruleset.garden;
    return '<div class="chelp"><p>Medicinal plants are the start of the <b>Medical science</b> chain:</p><ol>' +
      "<li><b>Steal seeds</b> at the Greenhouse (1 ticket = 3 packets).</li>" +
      "<li><b>Sow</b> them here. One packet fills one bed, and you have <b>" + r.medBedsMax + "</b> beds. More need a Hospital of at least level " + r.medBedsHospitalLevel + ".</li>" +
      "<li>Pick a sowing time. Longer sowing grows <b>more plants</b> (2h&rarr;40 up to 24h&rarr;150) but pays the same <b>Gardening</b> points per bed either way.</li>" +
      "<li>When the timer runs out the bed is harvested automatically: you gain the Gardening points and the plants go to your medicinal store.</li>" +
      "<li>The <a data-act=\"go-medmachine\">Medicine machine</a> turns plants into remedies (a rolled bandage or wound swab takes 1 plant; morphine takes 50 poppies), and the <a data-act=\"go-medpacking\">packing table</a> combines six components into a <b>First Aid Kit</b>.</li>" +
      "</ol><p>Worth knowing about that chain:</p><ul>" +
      "<li>Each bed pays gardening points based on your Gardening level, currently <b>" + fmt(CF.garden.medPointsPerBed()) + "</b> a bed.</li>" +
      "<li><b>Kits pay more as you improve.</b> The points a first aid kit is worth climb with your Medical science " +
        "level, from <b>22</b> at level 1 to <b>" + fmt(CF.medicine.kitPoints(14)) + "</b> at level 14. You currently " +
        "earn <b>" + fmt(CF.medicine.kitPoints()) + "</b> a kit, and the packing table always shows your rate.</li>" +
      "<li>A kit sells for more the tougher and more skilled you are, so the same kit is worth steadily more over time.</li>" +
      "<li>Every level adds <b>+1%</b> to your doctors' success rate.</li>" +
      "<li>Using a kit on yourself gives a temporary <b>+5% endurance</b>.</li>" +
      "</ul><p class=\"acc-note\">The Hospital isn't built yet, so extra medicinal beds and the doctors who use your kits are still out of reach.</p></div>";
  }
  function gardenHelpBody() {
    var r = CF.ruleset.garden;
    var rows = CF.gardenDrugPlants.map(function (p) {
      return "<tr><td>" + esc(p.name) + "</td><td>" + p.chem + "</td><td>" + p.steal + "</td></tr>";
    }).join("");
    return '<div class="chelp"><p>Every steal costs <b>1 greenhouse ticket</b> and earns <b>Stealing</b> points.</p><ol>' +
      "<li><b>Steal plants to make drugs.</b> Fills your backpack with <b>" + r.plantBackpackSize + "</b> plants and pays " + r.stealPointsPlants + " steal points. Carry them to the <b>Laboratory Cabinet</b>, put them in the closet, then press them in the <b>Juicer</b>.</li>" +
      "<li><b>Steal seeds</b>, edible or medicinal. Gives <b>" + r.seedsPerSteal + "</b> seeds and " + r.stealPointsSeeds + " steal point. Growing them happens in the Edible herb garden and the Medicinal herb beds.</li>" +
      "</ol><p>Drug plants need <b>both</b> a Chemist and a Stealing level:</p>" +
      '<table class="chelp-tab"><tr><th>Plant</th><th>Chemist</th><th>Stealing</th></tr>' + rows + "</table></div>";
  }
  function chemHelpBody() {
    var rows = CF.chemRecipeOrder.map(function (k) {
      var r = CF.chemRecipes[k];
      return "<tr><td>" + r.level + "</td><td>" + esc(r.narcotic) + " + " + esc(r.juiceBase) + ' juice</td><td><b>' + esc(k) + "</b></td></tr>";
    }).join("");
    return '<div class="chelp"><p>Turn cheap street narcotics into valuable processed drugs:</p>' +
      "<ol>" +
      '<li>Buy raw <b>narcotics</b> on the <b>Streets</b>. They land in your drug belt.</li>' +
      '<li>Get <b>plants</b> from the Garden, then press them in the <b>Juicer</b> for juice.</li>' +
      '<li>In the <b>Drug lab</b>, pick a narcotic + its matching plant-juice + a quantity, then <b>Mix</b>. Each gram uses 1&nbsp;g narcotic + 1&nbsp;ml juice → 1&nbsp;g of the drug, and earns Chemist points.</li>' +
      '<li>Sell the processed drug back on the <b>Streets</b>. That is where the profit is.</li>' +
      "</ol>" +
      "<p>A recipe unlocks once you reach its Chemist level:</p>" +
      '<table class="chelp-tab"><tr><th>Lvl</th><th>Narcotic + Juice</th><th>Drug</th></tr>' + rows + "</table></div>";
  }

  /* -------------------------- Debug popup ------------------------------ */
  /* Every skill that is REAL — one you can actually train somewhere. Keep this
   * in step with the game: a skill missing here cannot be levelled for testing,
   * which is how Cooking and Medical science went untestable for a while. */
  var DBG_SKILLS = ["Barkeeping", "Crafting", "Smithing", "Chemist", "Stealing",
                    "Gardening", "Cooking", "Medical science", "Endurance", "Strength",
                    "Weapon handling"];
  function dbgSkillLevel(sk) {
    return sk === "Barkeeping" ? CF.state.player.drinkMasterLevel
         : sk === "Crafting" ? CF.craft.progress().level
         : sk === "Smithing" ? CF.blacksmith.forgingProgress().level
         : sk === "Chemist" ? CF.chemist.progress().level
         : sk === "Stealing" ? CF.garden.stealProgress().level
         : sk === "Gardening" ? CF.garden.gardenProgress().level
         : sk === "Cooking" ? CF.canteen.progress().level
         : sk === "Medical science" ? CF.medicine.progress().level
         : sk === "Endurance" ? CF.sports.endurance().level
         : sk === "Strength" ? CF.sports.power().level : 1;
  }

  /* ---- Time travel ------------------------------------------------------
   * The game is full of multi-hour clocks: 75-hour plants, a 24-hour ticket
   * office, harbor refits, dish durations, the hourly update's payouts. Waiting
   * them out is not testing. Rather than fake a global clock (which would mean
   * threading a CF.now() through every file), this drags the stored timestamps
   * BACKWARDS by the requested hours, which has the same effect and touches
   * nothing outside this function.
   *
   * Every timestamp in the save is listed here on purpose. If you add a new
   * timer anywhere, add it here too or time travel will silently skip it. */
  function debugShiftTime(hours) {
    var ms = hours * 3600000, s = CF.state, moved = 0;
    function back(o, k) { if (o && typeof o[k] === "number" && o[k] > 0) { o[k] -= ms; moved++; } }

    if (typeof s.updateSlot === "number") { s.updateSlot -= hours; moved++; }

    var G = s.garden;
    if (G) {
      (G.plots || []).forEach(function (p) { back(p, "endsAt"); back(p, "wateredAt"); back(p, "pestAt"); });
      (G.medBeds || []).forEach(function (b) { back(b, "endsAt"); });
      back(G, "landBuyAt"); back(G, "ticketReopenAt");
      G.waterHourSlot = -1;                       // this hour's watering allowance comes back
    }
    var S = s.sports;
    if (S) { back(S.run, "endsAt"); back(S, "lastSteroidBuy"); back(S, "energyAt");
             if (typeof S.energySlot === "number") { S.energySlot -= hours; moved++; } }
    var H = s.harbor;
    if (H) { back(H.refit, "endsAt"); back(H.trip, "endsAt"); }
    var C = s.canteen;
    if (C && C.menu) { back(C.menu.veg, "endsAt"); back(C.menu.fish, "endsAt"); }
    if (s.betting && s.betting.active) back(s.betting.active, "at");

    CF.settleUpdates();                           // pay the updates that just "passed"
    if (CF.garden.settlePlots) CF.garden.settlePlots();
    if (CF.sports.settleRun) CF.sports.settleRun();
    return moved;
  }
  /* Three debug tabs. SKILLS levels a trade and stocks its inputs; PLAYER holds
   * the account-wide numbers and the unlock switches; WORLD drives the clocks
   * and the feature flags. Split three ways because the old two-tab sheet had
   * become a single long scroll with unrelated things next to each other. */
  function dbgNum(label, id, val, act, extra) {
    return '<div class="field"><label>' + label + "</label>" +
      '<div class="row"><input type="number" id="' + id + '" value="' + val + '"' + (extra || "") +
      '><button class="btn" data-act="' + act + '">Set</button></div></div>';
  }
  function dbgToggle(label, on, act, what) {
    return '<button class="btn dbg-tog' + (on ? " go" : "") + '" data-act="' + act + '"' +
      (what ? ' data-what="' + esc(what) + '"' : "") + ">" + (on ? "☑ " : "☐ ") + label + "</button>";
  }
  function debugBody() {
    var tab = ui.dbgTab || "skills";
    var p = CF.state.player;
    var html = '<div class="dbg">' +
      // save/load/reset sit at the very top, above the tab switcher
      '<div class="dbg-save"><button class="btn" data-act="save">💾 Save</button> ' +
        '<button class="btn" data-act="load">📂 Load</button> ' +
        '<button class="btn warn" data-act="reset">♻ New account</button></div>' +
      '<div class="dbg-tabs">' +
      ["skills", "player", "world"].map(function (t) {
        return '<button class="btn' + (tab === t ? " go" : "") + '" data-act="dbg-tab" data-tab="' + t + '">' +
          t.charAt(0).toUpperCase() + t.slice(1) + "</button>";
      }).join(" ") + "</div>";

    /* ---------------- PLAYER ---------------- */
    if (tab === "player" || tab === "general") {
      var G = CF.state.garden, S = CF.state.sports;
      html += dbgNum("Money (CC)", "dbgMoney", p.money, "dbg-set-money") +
        dbgNum("Bank balance", "dbgBank", p.bank || 0, "dbg-set-bank") +
        dbgNum("Casino tokens", "dbgTokens", p.tokens || 0, "dbg-set-tokens", ' min="0"') +
        dbgNum("Fame (gates drug belts)", "dbgFame", p.fame || 0, "dbg-set-fame") +
        dbgNum("House level (gates house rooms)", "dbgHouse", p.houseLevel || 0, "dbg-set-house", ' min="0" max="' + CF.ruleset.house.maxLevel + '"') +
        dbgNum("Tavern reputation", "dbgRep", p.reputation, "dbg-set-rep", ' min="0"') +
        dbgNum("Greenhouse tickets", "dbgTickets", G.tickets, "dbg-set-tickets", ' min="0"') +
        dbgNum("Drug belt capacity (g)", "dbgBelt", CF.chemist.beltCap(), "dbg-set-belt", ' min="1"') +
        dbgNum("Hand energy", "dbgEnergy", S.handEnergy || 0, "dbg-set-energy", ' min="0" max="' + CF.sports.maxHandEnergy() + '"') +
        dbgNum("House gear", "dbgHouseGear", CF.state.houseGear || 0, "dbg-set-housegear", ' min="0" max="' + CF.ruleset.perUpdate.gearMax + '"') +
        dbgNum("Sewer gear", "dbgSewerGear", CF.state.sewerGear || 0, "dbg-set-sewergear", ' min="0" max="' + CF.ruleset.perUpdate.gearMax + '"') +
        '<div class="field"><label>Unlocks</label><div class="dbg-togs">' +
          dbgToggle("Tavern job taken", !!p.tavernJobAccepted, "dbg-tog", "tavernJob") +
          dbgToggle("Tavern owned (opens the Canteen)", !!p.tavernOwned, "dbg-tog", "tavernOwned") +
          dbgToggle("Gardener claimed", !!G.isGardener, "dbg-tog", "gardener") +
          dbgToggle("Fishing vessel owned", !!CF.state.harbor.owned, "dbg-tog", "ship") +
        "</div></div>" +
        '<div class="field"><label>Slum passes (the Betting Bunker needs one)</label><div class="dbg-togs">' +
          CF.ruleset.slumPasses.map(function (sp) {
            return dbgToggle(sp.area, !!CF.state.slumPasses[sp.id], "dbg-tog-pass", sp.id);
          }).join("") + "</div></div>" +
        '<p class="acc-note dbg-note">These write straight into the save. Clocks and feature flags are under <b>World</b>.</p></div>';
      return html;
    }

    /* ---------------- WORLD ---------------- */
    if (tab === "world") {
      var B = CF.ruleset.built;
      html += '<div class="field"><label>Clocks</label><div class="dbg-togs">' +
          '<button class="btn go" data-act="dbg-run-update">Run tavern wave (' +
            Math.round(CF.ruleset.tavernIntervalSec / 60) + " min)</button>" +
          '<button class="btn go" data-act="dbg-world-update">Run world update (hourly)</button>' +
        "</div></div>" +
        '<div class="field"><label>Jump forward — ages every timer in the save at once</label><div class="dbg-togs">' +
          [1, 6, 24, 72].map(function (h) {
            return '<button class="btn" data-act="dbg-skip-time" data-h="' + h + '">+' + h + " h</button>";
          }).join("") + "</div></div>" +
        '<div class="field"><label>Shortcuts</label><div class="dbg-togs">' +
          '<button class="btn" data-act="dbg-open-office">Open the ticket office</button>' +
          '<button class="btn" data-act="dbg-clear-cooldowns">Clear steroid / run cooldowns</button>' +
          '<button class="btn" data-act="dbg-finish-harbor">Finish harbor refit + trip</button>' +
          '<button class="btn" data-act="dbg-clear-bets">Clear bet history</button>' +
        "</div></div>" +
        '<div class="field"><label>Villas and sewer</label><div class="dbg-togs">' +
          '<button class="btn go" data-act="dbg-fill-moves">Refill moves (' + CF.ruleset.perUpdate.gearMax + ")</button>" +
          '<button class="btn" data-act="dbg-unrob">Un-rob every house</button>' +
          '<button class="btn warn" data-act="dbg-newdistrict">Generate a new district</button>' +
          '<button class="btn" data-act="dbg-give-items">+10 stolen items</button>' +
        "</div></div>" +
        /* The sewer had nothing here at all, and a saved floor keeps whatever
           tiers it was carved with — so "recarve" is the way to pick up a
           changed monster spread without waiting for an update. */
        '<div class="field"><label>Sewer</label><div class="dbg-togs">' +
          '<button class="btn" data-act="dbg-sewer-up">Go up to the street</button>' +
          (function () {
            var out = "";
            for (var L = 1; L <= CF.sewer.maxLevel; L++)
              out += '<button class="btn' + (CF.houses.level() === L ? " go" : "") +
                '" data-act="dbg-sewer-level" data-lvl="' + L + '">Level ' + L + "</button>";
            return out;
          })() +
          '<button class="btn warn" data-act="dbg-recarve">Recarve this floor</button>' +
        "</div></div>" +
        '<div class="field"><label>Endurance and the hospital</label><div class="dbg-togs">' +
          '<button class="btn go" data-act="dbg-heal">Refill endurance (' + fmt(CF.sports.enduranceMax()) + ")</button>" +
          '<button class="btn warn" data-act="dbg-hurt">Empty endurance (to 0)</button>' +
          '<button class="btn" data-act="dbg-give-kits">+10 first aid kits</button>' +
        "</div></div>" +
        '<div class="field"><label>Cold weapons</label><div class="dbg-togs">' +
          '<button class="btn" data-act="dbg-give-weapon">+1 cold weapon</button>' +
          '<span class="dbg-note">' +
            fmt(Object.keys(CF.houses.arms()).reduce(function (t, k) { return t + CF.houses.arms()[k]; }, 0)) +
          " in the rack</span>" +
        "</div></div>" +
        '<div class="field"><label>Bank</label><div class="dbg-togs">' +
          '<button class="btn' + (CF.bank.owned() ? " go" : "") + '" data-act="dbg-own-bank">' +
            (CF.bank.owned() ? "Bank owned ✓" : "Buy the bank") + "</button>" +
          dbgNum("Bank level", "dbgBankLevel", CF.bank.level(), "dbg-set-banklevel",
                 ' min="1" max="' + CF.ruleset.bank.maxLevel + '"') +
        "</div></div>" +
        '<div class="field"><label>Bank items and vault treasure</label><div class="dbg-togs">' +
          '<button class="btn" data-act="dbg-give-vault">+5 bank items</button>' +
          '<button class="btn" data-act="dbg-give-treasure">+5 vault treasure</button>' +
          '<button class="btn warn" data-act="dbg-fill-collection">Give the whole collection</button>' +
          '<button class="btn warn" data-act="dbg-fill-chambers">Fill every chamber</button>' +
          '<span class="dbg-note">' + fmt(CF.bank.itemTotal()) + " items, " + fmt(CF.bank.storeTotal()) +
            " spare, " + fmt(CF.vaults.differentHeld()) + " treasures</span>" +
        "</div></div>" +
        '<div class="field"><label>Item upkeep</label><div class="dbg-togs">' +
          '<button class="btn" data-act="dbg-wear-items">Wear every item down 20</button>' +
          '<button class="btn go" data-act="dbg-reset-maint">Reset the hourly allowance</button>' +
          '<span class="dbg-note">' + CF.bank.maintainLeft() + " left this hour</span>" +
        "</div></div>" +
        '<div class="field"><label>Warehouse capacity enforcement</label><div class="dbg-togs">' +
          dbgToggle(CF.ruleset.enforceCapacity ? "ON — warehouses can fill up" : "OFF — no limits",
                    CF.ruleset.enforceCapacity, "dbg-toggle-cap") + "</div></div>" +
        '<div class="field"><label>Unbuilt systems — turn one on to preview its panels</label><div class="dbg-togs">' +
          Object.keys(B).map(function (k) { return dbgToggle(k, B[k], "dbg-tog-built", k); }).join("") +
        "</div></div>" +
        '<div class="field"><label>Profiles</label><div class="dbg-togs">' +
          '<button class="btn go" data-act="dbg-late-game">Load the late-game profile</button>' +
          '<button class="btn" data-act="dbg-replay-intro">Replay the intro</button>' +
        "</div></div>" +
        '<p class="acc-note dbg-note">"Jump forward" drags every stored timer back by that many hours, so plants ' +
          "grow, refits land, cooldowns lapse and the update pays out — without waiting.</p></div>";
      return html;
    }

    /* ---------------- SKILLS ---------------- */
    var sk = ui.dbgSkill || "Barkeeping";
    html += '<div class="field"><label>Which skill</label><select id="dbgSkill" data-role="dbgskill">' +
        DBG_SKILLS.map(function (s) { return "<option" + (s === sk ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>Level (sets the matching XP automatically)</label>' +
        '<div class="row"><input type="number" id="dbgLevel" min="1" value="' + dbgSkillLevel(sk) + '"><button class="btn" data-act="dbg-set-level">Set</button></div></div>' +
      '<div class="field"><label>Stock</label><div class="dbg-togs">' +
        '<button class="btn" data-act="dbg-unlimited">Unlimited materials for ' + esc(sk) + "</button>" +
        '<button class="btn" data-act="dbg-stock-all">Stock every skill</button>' +
      "</div></div>" +
      '<p class="acc-note">Setting a level rewrites the skill\'s lifetime XP to the exact amount that reaches it. ' +
        "Account-wide values are under <b>Player</b>, clocks under <b>World</b>.</p></div>";
    return html;
  }
  function dbgApplied(what) { CF.autosave(); renderSidebar(); renderPlace(); renderModal(); toast(what + " updated."); }
  function debugSetLevel(skill, level) {
    var p = CF.state.player;
    // skills on the universal curve
    if (skill === "Barkeeping") { var xp = CF.formulas.xpToReachLevel(level); p.drinkMasterLevel = level; p.drinkMasterPoints = 0; p.dmLifetime = xp; }
    else if (skill === "Crafting") { CF.state.craft.points = CF.formulas.xpToReachLevel(level); }
    else if (skill === "Smithing") { CF.state.blacksmith.forgingPoints = CF.formulas.xpToReachLevel(level); }
    else if (skill === "Chemist") { CF.state.chemist.points = CF.formulas.xpToReachLevel(level); }
    // skills with their own curves
    else if (skill === "Stealing") { CF.state.garden.stealPoints = CF.formulas.xpToReachLevelFor("Stealing", level); }
    else if (skill === "Gardening") { CF.state.garden.gardenPoints = CF.formulas.xpToReachLevelFor("Gardening", level); }
    // the bar's size follows the level on its own now; just refill it
    else if (skill === "Endurance") { CF.state.sports.durabilityPoints = CF.formulas.xpToReachLevelFor("Endurance", level); p.durabilityCur = CF.sports.enduranceMax(); }
    else if (skill === "Strength") { CF.state.sports.powerPoints = CF.formulas.xpToReachLevelFor("Strength", level); }
    // the two that were missing: both store LIFETIME points like the rest
    else if (skill === "Cooking") { CF.state.canteen.cookPoints = CF.formulas.xpToReachLevelFor("Cooking", level); }
    else if (skill === "Medical science") { CF.state.medicine.points = CF.formulas.xpToReachLevelFor("Medical science", level); }
    else if (skill === "Weapon handling") { CF.state.sports.weaponPoints = CF.formulas.xpToReachLevelFor("Weapon handling", level); }
  }
  function debugUnlimited(skill) {
    var BIG = 1e9;
    if (skill === "Barkeeping") {
      CF.materials.forEach(function (m) { CF.state.inv.materials[m] = BIG; });
      CF.rawJuices.forEach(function (j) { CF.state.inv.rawJuice[j] = BIG; });
    } else if (skill === "Crafting") {
      CF.craftMaterialOrder.forEach(function (k) { CF.state.craft.supplies[k] = BIG; });
    } else if (skill === "Smithing") {
      ["Steel Alloy", "Titanium Alloy (1)", "Titanium Alloy (2)", "Titanium Alloy (3)", "Titanium Alloy (4)", "Enriched uranium"]
        .forEach(function (k) { CF.state.craft.made[k] = BIG; });
      CF.state.blacksmith.materials["Charcoal"] = BIG; CF.state.blacksmith.materials["TNT"] = BIG;
      CF.state.player.money = Math.max(CF.state.player.money, 1e12);   // Nuclear needs money
    } else if (skill === "Chemist") {
      // a full belt of every narcotic + plenty of every juice
      CF.narcoticOrder.forEach(function (n) { CF.state.chemist.belt[n] = 0; });
      CF.state.chemist.belt[CF.narcoticOrder[1]] = CF.chemist.beltCap();
      CF.gardenDrugPlants.forEach(function (p) { CF.state.chemist.juices[p.name + " juice"] = BIG; });
      CF.state.player.money = Math.max(CF.state.player.money, 1e9);
    } else if (skill === "Stealing" || skill === "Gardening") {
      CF.state.garden.tickets = 999;
    } else if (skill === "Endurance" || skill === "Strength") {
      Object.keys(CF.state.sports.equipment).forEach(function (k) { CF.state.sports.equipment[k] = 99999; });
      CF.state.sports.handEnergy = CF.sports.maxHandEnergy();
    } else if (skill === "Cooking") {
      // the canteen needs liquids, dairy, fruit and fish before it can cook
      var C = CF.state.canteen;
      ["Raw milk", "Water", "Butter", "Milk", "Cream", "Sour cream", "Cheese", "Curd"]
        .forEach(function (k) { C.dairy[k] = BIG; });
      CF.fishDishes.forEach(function (d) { C.fish[d.fish] = BIG; });
      CF.gardenExchangeFruits.forEach(function (f) { CF.state.garden.harvest[f.name] = BIG; });
    } else if (skill === "Medical science") {
      // herbs for the machine, and the two handicrafts a kit needs from Crafts
      CF.gardenMedicinalSeeds.forEach(function (s) { CF.state.garden.medicinalHarvest[s.name] = BIG; });
      CF.firstAidKit.handicrafts.forEach(function (h) { CF.state.craft.made[h] = BIG; });
      CF.medicineRecipes.forEach(function (r) { CF.state.medicine.medicines[r.name] = BIG; });
    }
  }

  /* ============================= TAVERN ================================ */
  /* Before you take the job the tavern is just an offer; before you own it the
   * second floor stays shut and a "buy the tavern?" link sits at the top. */
  function tavernJobOffer() {
    return '<div class="panel tav"><div class="bar">Tavern and Canteen</div>' +
      '<div class="job-offer"><div class="jo-head">The landlord offers you a job!</div>' +
      "<div class=\"jo-sec\"><b>What you'd owe:</b><ol>" +
        "<li>Make drinks and keep them for sale.</li>" +
        "<li>Make sure there are always enough drinks for every customer.</li></ol></div>" +
      '<div class="jo-sec"><b>What you get:</b><ol>' +
        "<li>A good place to build up your <b>Barkeeping</b> skill.</li>" +
        "<li>Wages based on what you sell.</li></ol></div>" +
      '<div class="jo-ask">Do you want the job?</div>' +
      '<div class="cbtn"><button class="btn go" data-act="tavern-accept-job">I accept the offer!</button></div>' +
      "</div></div>";
  }
  function tavernBuyOffer() {
    var t = CF.ruleset.tavernPurchase, p = CF.state.player;
    return '<div class="panel tav"><div class="bar">Tavern and Canteen</div>' +
      '<div class="job-offer"><div class="jo-head">The owner offers to sell you the tavern</div>' +
      '<div class="jo-sec"><b>What it takes:</b><ol>' +
        "<li>Barkeeping level <b>" + t.reqDrinkMaster + "</b> (you are <b>" + fmt(p.drinkMasterLevel) + "</b>)</li>" +
        "<li><b>" + fmt(t.priceCC) + "</b> CC in cash (you have <b>" + fmt(p.money) + "</b>)</li></ol></div>" +
      '<div class="jo-sec"><b>What you gain:</b><ol>' +
        "<li>Access to the second floor, where the canteen is.</li>" +
        "<li>The <b>Cooking</b> skill, for making food in the canteen.</li></ol></div>" +
      '<div class="jo-ask">Do you want to buy the tavern?</div>' +
      '<div class="cbtn"><button class="btn go" data-act="tavern-buy">Yes, buy it</button> ' +
        '<button class="btn" data-act="go-tavern">Not yet</button></div>' +
      "</div></div>";
  }

  function renderTavern() {
    var p = CF.state.player, repMax = CF.formulas.repMax(p.drinkMasterLevel);
    if (!p.tavernJobAccepted) { $("locationPanel").innerHTML = tavernJobOffer(); return; }
    if (ui.tavernBuyView) { $("locationPanel").innerHTML = tavernBuyOffer(); return; }

    var html = '<div class="panel tav"><div class="bar">Tavern and Canteen</div>' +
      (p.tavernOwned ? "" : '<div class="buy-tav"><a data-act="tavern-buy-view">[ Do you want to buy the tavern? ]</a></div>') +
      '<div class="tabs"><a class="on" data-act="landing">First floor (tavern)</a>' +
      (p.tavernOwned
        ? '<a data-act="go-canteen">Second floor (dining room)</a>'
        : '<a class="dead" title="Buy the tavern to unlock the canteen">Second floor (dining room)</a>') + "</div>";

    if (ui.tool) {
      // row 1 = the raw/utility tools, row 2 = the six drink stations
      function navRow(list) {
        return "<div>" + list.map(function (t) {
          return '<a class="' + (ui.tool === t.id ? "cur" : "") + '" data-act="tool" data-tool="' + t.id + '">' + esc(t.label) + "</a>";
        }).join("") + "</div>";
      }
      html += '<div class="subnav">' + navRow(TOOLS.slice(0, 3)) + navRow(TOOLS.slice(3)) + "</div>";
    }

    var custLine = p.tavernOpen
      ? '<div class="cust">Until the next <b>' + fmt(Math.round(CF.formulas.clientsPer10Min(p.reputation))) +
        '</b> customers arrive: <span id="custCountdown">' + mmss(ui.tavernTimer) + "</span></div>"
      : "";
    html += '<div class="tav-status">' +
      (p.tavernOpen
        ? '<span class="open">The tavern is open</span> [ <span class="tlink" data-act="toggle">close tavern</span> ]'
        : '<span class="closed">The tavern is closed</span> [ <span class="tlink" data-act="toggle">open tavern</span> ]') +
      custLine +
      // label bold, value plain; the cap is no longer shown (reputation still
      // rises on sales and falls when customers go unserved)
      '<div class="rep"><b>Tavern reputation:</b> <span class="repval">' + fmt(p.reputation) + "</span></div></div>";

    html += ui.tool ? renderToolContent(ui.tool) : renderLanding();
    html += '<div class="calc-link"><a data-act="calc-open">🧮 Calculator</a></div></div>';
    $("locationPanel").innerHTML = html;
  }

  function renderLanding() {
    var out = '<div class="toollist">';
    TOOLS.forEach(function (t, i) {
      out += '<div class="t' + (i === 3 ? " grp" : "") + '"><a data-act="tool" data-tool="' + t.id + '">' + esc(t.label) +
        '</a> <span class="desc">( ' + esc(t.desc) + " )</span></div>";
    });
    return out + "</div>";
  }

  function capInfo(whKind, unitWord) {
    if (whKind === "finished") return "";   // ready-to-sell has no cap and no notice
    var capv = CF.tavern.cap(whKind), used = CF.tavern.usedIn(whKind);
    var per = whKind === "materials" ? CF.ruleset.warehouse.rawMaterialsPerLevel
            : whKind === "rawjuice"  ? CF.ruleset.warehouse.rawJuicePerLevel : CF.ruleset.warehouse.finishedPerLevel;
    if (!CF.ruleset.enforceCapacity) return '<div class="info"><span class="i">ℹ</span>Capacity enforcement is OFF (testing mode). You have <b>' + fmt(used) + "</b> " + unitWord + ".</div>";
    return '<div class="info"><span class="i">ℹ</span>This warehouse has a capacity of <b>' + fmt(capv) + "</b> " + unitWord +
      ", you have <b>" + fmt(used) + "</b> " + unitWord + ". The capacity increases by <b>" + per + "</b> " + unitWord + " with each Barkeeping level.</div>";
  }

  function renderToolContent(id) {
    if (id === "telephone")   return telephoneUI();
    if (id === "juicer1")     return juicer1UI();
    if (id === "readytosell") return readyToSellUI();
    var t = tool(id);
    return t && t.station ? stationUI(t) : "";
  }

  function telephoneUI() {
    var matOpts = CF.materials.slice().sort().map(function (m) {
      return '<option value="' + esc(m) + '"' + (ui.telMat === m ? " selected" : "") + ">" + esc(m) + "</option>"; }).join("");
    var price = ui.q.tel * CF.formulas.materialPrice(CF.state.player.reputation);
    return '<table class="formtbl"><tr><th>Quantity</th><th>Raw material</th></tr>' +
      '<tr><td><input type="number" min="1" id="telQty" data-role="telqty" value="' + ui.q.tel + '"></td>' +
      '<td><select id="telMat" data-role="telmat"><option value="">- Choose -</option>' + matOpts + "</select></td></tr>" +
      '<tr><td colspan="2" class="price">Price: <span id="telPrice">' + fmt(price) + "</span> CC</td></tr>" +
      '<tr><td colspan="2" class="full"><button class="btn go" data-act="buy">Order raw materials</button></td></tr></table>' +
      capInfo("materials", "items") + warehouseTable("materials", "Raw materials warehouse");
  }

  function juicer1UI() {
    var opts = Object.keys(CF.juiceMap).sort().map(function (m) {
      return '<option value="' + esc(m) + '"' + (ui.j1Mat === m ? " selected" : "") + ">" + esc(m) + " &rarr; " + esc(CF.juiceMap[m]) + "</option>"; }).join("");
    return '<table class="formtbl"><tr><th>Quantity</th><th>Fruit to press</th></tr>' +
      '<tr><td><input type="number" min="1" id="j1Qty" data-role="j1qty" value="' + ui.q.j1 + '"></td>' +
      '<td><select id="j1Mat" data-role="j1mat"><option value="">- Choose -</option>' + opts + "</select></td></tr>" +
      '<tr><td colspan="2" class="price" id="j1Preview">' + j1PreviewText() + "</td></tr>" +
      '<tr><td colspan="2" class="full"><button class="btn go" data-act="press">Make raw juice</button></td></tr></table>' +
      capInfo("rawjuice", "L") + warehouseTable("rawjuice", "Raw juice warehouse");
  }
  function j1PreviewText() {
    if (!ui.j1Mat) return "Pick a fruit to see the juice yield.";
    var have = CF.state.inv.materials[ui.j1Mat] || 0, q = ui.q.j1;
    return "Uses " + fmt(Math.min(q, have)) + " " + esc(ui.j1Mat) + " &rarr; <b>" + fmt(q * CF.ruleset.juiceLitersPerUnit) +
      " L " + esc(CF.juiceMap[ui.j1Mat]) + "</b> (have " + fmt(have) + ")";
  }

  function warehouseTable(whKind, title) {
    var store = whKind === "materials" ? CF.state.inv.materials : whKind === "rawjuice" ? CF.state.inv.rawJuice : CF.state.inv.finished;
    var keys = Object.keys(store).filter(function (k) { return store[k] > 0; }).sort();
    if (keys.length === 0) return '<table class="wh"><tr><th>' + title + '</th><th class="r">Quantity</th><th></th></tr>' +
      '<tr><td colspan="3" style="color:#93a2b0">empty</td></tr></table>';
    return '<table class="wh"><tr><th>' + title + '</th><th class="r">Quantity</th><th class="c">&nbsp;</th></tr>' +
      keys.map(function (k) {
        return "<tr><td>" + esc(k) + '</td><td class="r">' + fmt(store[k]) +
          '</td><td class="c">[ <span class="clear" data-act="clear" data-wh="' + whKind + '" data-key="' + esc(k) + '">Clear</span> ]</td></tr>';
      }).join("") + "</table>";
  }

  /* station: pick a drink, click "Mix the drink." (per-click, no quantity) */
  function stationUI(t) {
    var recs = CF.recipes.filter(function (r) { return r.station === t.station; })
      .sort(function (a, b) { return a.unlockLevel - b.unlockLevel; });
    var sel = ui.mix[t.id] || "";
    var opts = '<option value="">-- What drink would you like to make? --</option>' + recs.map(function (r) {
      var ing = r.ingredients.map(function (g) { return g.item; }).join(" + ");
      var lock = !CF.tavern.isUnlocked(r);
      return '<option value="' + esc(r.name) + '"' + (lock ? " disabled" : "") + (sel === r.name ? " selected" : "") + ">" +
        "Level " + r.unlockLevel + " - " + esc(r.name) + " (" + esc(ing) + ")" + (lock ? "  🔒" : "") + "</option>";
    }).join("");
    var dpc = CF.formulas.drinkPerClick(CF.state.player.reputation);
    // the station form sits in a boxed panel under its own title bar, like the reference
    return '<div class="tav-station"><div class="bar">' + esc(t.label) + " &ndash; " + esc(t.desc) + "</div>" +
      '<div class="ts-body">' +
        '<select id="mixSel" data-role="mixsel">' + opts + "</select><br><br>" +
        '<button class="btn go" data-act="mix">Mix the drink.</button></div></div>' +
      '<div id="mixNotice">' + mixNoticeHtml(t.id) + "</div>" +
      '<div id="mixStats">' + mixStatsHtml() + "</div>" +
      '<div style="text-align:center;color:var(--muted);padding:2px 16px 8px">Each click mixes <b>' + fmt(dpc) +
        "</b> drinks (your reputation's drink-per-click) from one of each ingredient, and adds experience.</div>" +
      '<div id="mixCap">' + capInfo("finished", "items") + "</div>";
  }
  // "Mix" fragments, reused by the fast in-place update (notice sits BELOW the
  // button, so filling it never shifts the button).
  function mixNoticeHtml(tid) {
    var h;
    if (ui.mixError) h = '<div class="notice err"><b>NOTICE</b> ' + esc(ui.mixError) + "</div>";
    else { var m = ui.lastMix[tid]; h = m ? '<div class="notice"><b>NOTICE</b> You made drinks and earned <b>' + fmt(m.xp) + "</b> points.</div>" : ""; }
    if (ui.mixLevelUp != null) h += '<div class="levelup">Your barkeeping level is now <b>' + fmt(ui.mixLevelUp) + "</b>.</div>";
    return h;
  }
  function mixStatsHtml() {
    var p = CF.state.player;
    var toLevel = Math.max(0, CF.formulas.pointsToNextLevel(p.drinkMasterLevel) - p.drinkMasterPoints);
    return '<table class="ctbl" style="max-width:360px;margin:4px auto">' +
      '<tr><td class="k">Barkeeping level</td><td class="v">' + fmt(p.drinkMasterLevel) + "</td></tr>" +
      '<tr><td class="k">Barkeeping Points</td><td class="v">' + fmt(p.dmLifetime || 0) + "</td></tr>" +
      '<tr><td class="k">Points to level</td><td class="v">' + fmt(toLevel) + "</td></tr></table>";
  }
  /* Fast in-place mix — leaves the "Mix the drink." button untouched. */
  function fastMix() {
    var t = ui.tool;
    var name = ($("mixSel") && $("mixSel").value) || ui.mix[t] || "";
    ui.mixError = null;
    if (!name) { ui.mixError = "Choose a drink to make."; ui.mixLevelUp = null; if ($("mixNotice")) $("mixNotice").innerHTML = mixNoticeHtml(t); return; }
    ui.mix[t] = name;
    var before = CF.state.player.drinkMasterLevel;
    var res = CF.tavern.mixDrink(CF.recipeByName[name]);
    if (!res.ok) { ui.mixError = res.msg; ui.mixLevelUp = null; if ($("mixNotice")) $("mixNotice").innerHTML = mixNoticeHtml(t); return; }
    ui.lastMix[t] = { made: res.made, xp: res.xp };
    var after = CF.state.player.drinkMasterLevel;
    CF.autosave();
    if (after !== before) { ui.mixLevelUp = after; renderPlace(); return; }
    ui.mixLevelUp = null;
    if ($("mixNotice")) $("mixNotice").innerHTML = mixNoticeHtml(t);
    if ($("mixStats")) $("mixStats").innerHTML = mixStatsHtml();
    if ($("mixCap")) $("mixCap").innerHTML = capInfo("finished", "items");
    renderSidebar();   // Drink total / "drink continues" change (doesn't touch the button)
  }

  function readyToSellUI() {
    var p = CF.state.player, inv = CF.state.inv.finished, rep = p.reputation;
    var customers = Math.round(CF.formulas.clientsPer10Min(rep));
    var total = 0; CF.finishedNames.forEach(function (n) { total += inv[n] || 0; });
    var willSell = Math.min(total, customers);
    var lu = ui.lastUpdate, luHtml = "";
    if (lu) {
      if (lu.closed) luHtml = '<div class="info">Last update: the tavern was closed — no customers served.</div>';
      else if (lu.sold > 0) luHtml = '<div class="info"><span class="i">ℹ</span>Last update: <b>' + fmt(lu.customers) + "</b> customers, sold <b>" +
        fmt(lu.sold) + "</b> drinks for <b>" + fmt(lu.earned) + "</b> money" + (lu.repGain ? " (" + (lu.repGain > 0 ? "+" : "−") + fmt(Math.abs(lu.repGain)) + " reputation)" : "") + "." +
        (lu.outOfDrinks ? ' <b style="color:var(--red)">Ran out of drinks!</b>' : "") + "</div>";
      else luHtml = '<div class="info" style="background:#fbeaea;border-color:#e0b4b4"><span class="i" style="color:#b03">!</span> Last update: <b>' +
        fmt(lu.customers) + "</b> customers arrived but you had <b>no drinks</b> to sell!" + (lu.repGain < 0 ? " Reputation <b>−" + fmt(Math.abs(lu.repGain)) + "</b>." : "") + "</div>";
    }
    var proj = '<div style="padding:10px 16px">The tavern sells automatically each update — no manual selling.<br>' +
      "Customers next update: <b>" + fmt(customers) + "</b> · Drinks in stock: <b>" + fmt(total) + "</b> · Will sell: <b>" + fmt(willSell) + "</b>" +
      (p.tavernOpen && total < customers ? ' <span style="color:var(--red)">(not enough — you\'ll sell out)</span>' : "") +
      ' &nbsp; [ <span class="tlink" data-act="update-now">run update now</span> ]</div>';
    var names = CF.finishedNames.filter(function (n) { return (inv[n] || 0) > 0; })
      .sort(function (a, b) { return CF.recipeByName[b].price_CC - CF.recipeByName[a].price_CC; });
    var table = names.length
      ? '<table class="wh"><tr><th>Drink ready for sale</th><th class="r">Quantity</th><th class="r">Sells for</th></tr>' +
        names.map(function (n) { return "<tr><td>" + esc(n) + '</td><td class="r">' + fmt(inv[n]) + '</td><td class="r">' + fmt(CF.recipeByName[n].price_CC) + " CC</td></tr>"; }).join("") + "</table>"
      : '<div style="padding:0 16px 12px;color:var(--muted)">No finished drinks yet — mix some at the stations.</div>';
    return luHtml + proj + table + capInfo("finished", "items");
  }

  function calculatorBody() {
    var p = CF.state.player;
    var totalDrinks = 0; CF.finishedNames.forEach(function (n) { totalDrinks += CF.state.inv.finished[n] || 0; });
    var rep = ui.calc.rep != null ? ui.calc.rep : p.reputation;
    var drinks = ui.calc.drinks != null ? ui.calc.drinks : Math.round(totalDrinks);
    var pts = ui.calc.pts != null ? ui.calc.pts : (p.dmLifetime || 0);
    return '<table class="calc2">' +
      '<tr><td class="k">Tavern reputation:</td><td><input type="number" id="calcRep" data-role="calc" value="' + rep + '"></td></tr>' +
      '<tr><td class="k">Drink:</td><td><input type="number" id="calcDrinks" data-role="calc" value="' + drinks + '"></td></tr>' +
      '<tr><td class="k">Barkeeping Points:</td><td><input type="number" id="calcPts" data-role="calc" value="' + pts + '"></td></tr></table>' +
      '<div id="calcBody">' + calcRows(rep, drinks, pts) + "</div>";
  }
  function calcRows(rep, drinks, pts) {
    var c = CF.tavern.calculate(rep, drinks, pts);
    function row(k, v) { return '<div class="crow"><span class="k">' + k + '</span><span class="v">' + v + "</span></div>"; }
    return '<div class="cgrp">' +
        row("Customers in 10 minutes:", fmt(c.clientsPer10Min)) +
        row("Drinks with one click:", (Math.round(c.drinkPerClick * 10) / 10).toFixed(1)) +
      "</div><div class='cgrp'>" +
        row("Reputation for these drinks:", fmt(c.repForDrinks)) +
        row("Drink continues:", hms(c.drinkContinuesSec)) +
        row("Clicks to make these drinks:", fmt(c.clicksToMake)) +
        row("Raw material price:", fmt(c.rawMaterialPrice) + " CC") +
      "</div><div class='cgrp'>" +
        row("Barkeeping level:", fmt(c.level)) +
        row("Points to level:", fmt(c.pointsToLevel)) +
        row("Clicks to level " + c.nextLevel + " :", fmt(c.clicksToNextLevel)) +
        row("Best drink to make:", '<span class="best">' + esc(c.bestDrink) + " (Level " + c.bestDrinkLevel + " )</span>") +
        row("Drink price:", fmt(c.bestDrinkPrice) + " CC") +
      "</div>";
  }


  /* ======================= the update cycle ============================ */
  function doUpdate(manual) {
    var res = CF.tavern.runUpdate(); ui.lastUpdate = res; CF.autosave();
    if (res.closed) { if (manual) toast("Tavern is closed — open it so customers buy.", "err"); }
    else if (res.sold > 0) toast("Update: sold " + fmt(res.sold) + " drinks to " + fmt(res.customers) + " customers for " + fmt(res.earned) +
      " money" + (res.repGain ? " (" + (res.repGain > 0 ? "+" : "−") + fmt(Math.abs(res.repGain)) + " rep)" : "") + "." + (res.outOfDrinks ? " Ran out!" : ""), res.outOfDrinks ? "err" : "");
    else if (res.customers > 0) toast("Update: " + fmt(res.customers) + " customers arrived but there were no drinks!" + (res.repGain < 0 ? " Reputation −" + fmt(Math.abs(res.repGain)) + "." : ""), "err");
    renderPlace(); renderModal();
  }

  /* ======================= delegated events ============================ */
  function onClick(e) {
    var el = e.target.closest("[data-act]"); if (!el) return;
    var a = el.getAttribute("data-act");
    switch (a) {
      case "save": CF.saveToFile(); toast("Saved crime-factory-save.json"); break;
      case "load": $("fileInput").click(); break;
      case "reset": CF.newAccount(); CF.autosave(); ui.tool = null; ui.lastUpdate = null;
        ui.debugOpen = false; startOnboarding();
        renderAll(); toast("Started a new account."); break;
      case "account": ui.place = "account"; renderPlace(); break;
      case "debug": ui.debugOpen = true; renderModal(); break;
      case "debug-close": ui.debugOpen = false; renderModal(); break;
      case "help": ui.guideOpen = true; renderModal(); break;
      case "guide-close":
        ui.guideOpen = false;
        // closing the guide is what hands the game over to a new player
        if (ui.onboarding) endOnboarding();
        renderModal(); break;
      case "welcome-go": {
        var wv = $("welcomeName") ? String($("welcomeName").value).trim() : "";
        if (wv.length < 2) ui.welcomeError = "Pick a name of at least 2 characters.";
        else if (wv.length > 20) ui.welcomeError = "A nickname can be at most 20 characters.";
        else if (!/^[A-Za-z0-9 ._'-]+$/.test(wv)) ui.welcomeError = "Use only letters, numbers, spaces and - _ . '";
        else {
          CF.state.player.name = wv;
          ui.welcomeError = null; ui.welcomeOpen = false;
          ui.guideOpen = true; ui.guideId = "basics";   // step two, still blurred
          CF.autosave(); renderSidebar();
        }
        renderModal(); break;
      }
      case "guide-pick": {
        // Keep your place in the index — renderModal rebuilds the popup, which
        // would otherwise fling the list back to the top every time you picked
        // something from the bottom of it.
        var navEl = document.querySelector(".g-nav");
        var navAt = navEl ? navEl.scrollTop : 0;
        ui.guideId = el.getAttribute("data-id");
        ui.guideOpen = true;          // in-article links work from anywhere
        renderModal();
        var nav2 = document.querySelector(".g-nav"); if (nav2) nav2.scrollTop = navAt;
        // ...but always start the new article at the top, however far down the
        // last one you had read. Whichever box is the one that scrolls.
        var gb = document.querySelector(".g-body"); if (gb) gb.scrollTop = 0;
        var mb = document.querySelector(".modal-body"); if (mb) mb.scrollTop = 0;
        window.scrollTo(0, 0);
        break;
      }
      case "name-edit": ui.nameOpen = true; ui.nameError = null; renderModal(); break;
      case "name-close": ui.nameOpen = false; ui.nameError = null; renderModal(); break;
      case "name-save": {
        var nv = $("nickInput") ? String($("nickInput").value).trim() : "";
        if (nv.length < 2) ui.nameError = "A nickname needs at least 2 characters.";
        else if (nv.length > 20) ui.nameError = "A nickname can be at most 20 characters.";
        else if (!/^[A-Za-z0-9 ._'-]+$/.test(nv)) ui.nameError = "Use only letters, numbers, spaces and - _ . '";
        else {
          CF.state.player.name = nv; ui.nameOpen = false; ui.nameError = null;
          CF.autosave(); renderSidebar(); toast("Nickname saved.");
        }
        renderModal(); break;
      }
      case "dbg-set-level": {
        var dsk = ui.dbgSkill || "Barkeeping", dlv = Math.max(1, num("dbgLevel", 1));
        debugSetLevel(dsk, dlv); CF.autosave(); renderSidebar(); renderPlace(); renderModal();
        toast(dsk + " set to level " + dlv + "."); break;
      }
      case "dbg-unlimited": debugUnlimited(ui.dbgSkill || "Barkeeping"); CF.autosave();
        renderSidebar(); renderPlace(); renderModal(); toast("Filled materials for " + (ui.dbgSkill || "Barkeeping") + "."); break;
      case "dbg-set-rep": CF.state.player.reputation = Math.max(0, num("dbgRep", 0)); CF.autosave();
        renderSidebar(); renderPlace(); renderModal(); toast("Reputation set."); break;
      case "dbg-run-update": doUpdate(true); renderModal(); break;
      case "dbg-tab": ui.dbgTab = el.getAttribute("data-tab"); renderModal(); break;
      case "dbg-set-house": CF.state.player.houseLevel = Math.max(0, Math.min(CF.ruleset.house.maxLevel, num("dbgHouse", 0))); dbgApplied("House level"); break;
      case "dbg-set-money": CF.state.player.money = Math.max(0, num("dbgMoney", 0)); dbgApplied("Money"); break;
      case "dbg-set-bank": CF.state.player.bank = Math.max(0, num("dbgBank", 0)); dbgApplied("Bank"); break;
      case "dbg-set-fame": CF.state.player.fame = Math.max(0, num("dbgFame", 0)); dbgApplied("Fame"); break;
      case "dbg-set-tickets": CF.state.garden.tickets = Math.max(0, num("dbgTickets", 0)); dbgApplied("Tickets"); break;
      case "dbg-set-belt": CF.state.chemist.beltCapacity = Math.max(1, num("dbgBelt", 1)); dbgApplied("Belt capacity"); break;
      case "dbg-set-energy": CF.state.sports.handEnergy = Math.max(0, Math.min(CF.sports.maxHandEnergy(), num("dbgEnergy", 0))); CF.state.sports.energyAt = Date.now(); dbgApplied("Hand energy"); break;
      case "dbg-set-tokens": CF.state.player.tokens = Math.max(0, num("dbgTokens", 0)); dbgApplied("Tokens"); break;
      case "dbg-set-housegear": CF.state.houseGear = Math.max(0, Math.min(CF.ruleset.perUpdate.gearMax, num("dbgHouseGear", 0))); dbgApplied("House gear"); break;
      case "dbg-set-sewergear": CF.state.sewerGear = Math.max(0, Math.min(CF.ruleset.perUpdate.gearMax, num("dbgSewerGear", 0))); dbgApplied("Sewer gear"); break;
      case "dbg-tog": {
        var w = el.getAttribute("data-what"), pl = CF.state.player;
        if (w === "tavernJob") pl.tavernJobAccepted = !pl.tavernJobAccepted;
        else if (w === "tavernOwned") pl.tavernOwned = !pl.tavernOwned;
        else if (w === "gardener") CF.state.garden.isGardener = !CF.state.garden.isGardener;
        else if (w === "ship") CF.state.harbor.owned = !CF.state.harbor.owned;
        dbgApplied(w); break;
      }
      case "dbg-tog-pass": {
        var pid = el.getAttribute("data-what");
        CF.state.slumPasses[pid] = !CF.state.slumPasses[pid];
        dbgApplied("Slum pass"); break;
      }
      case "dbg-tog-built": {
        var bk2 = el.getAttribute("data-what");
        CF.ruleset.built[bk2] = !CF.ruleset.built[bk2];
        dbgApplied(bk2 + " " + (CF.ruleset.built[bk2] ? "shown" : "hidden")); break;
      }
      case "dbg-world-update": CF.state.updateSlot = CF.clock.slot() - 1; CF.settleUpdates();
        dbgApplied("World update run"); break;
      case "dbg-skip-time": {
        var hrs = parseInt(el.getAttribute("data-h"), 10) || 1;
        var moved = debugShiftTime(hrs);
        dbgApplied("Jumped " + hrs + " h (" + moved + " timers moved)"); break;
      }
      case "dbg-finish-harbor": {
        var H2 = CF.state.harbor;
        if (H2.refit) H2.refit.endsAt = Date.now() - 1000;
        if (H2.trip) H2.trip.endsAt = Date.now() - 1000;
        dbgApplied("Seaport clocks finished"); break;
      }
      case "dbg-clear-bets": CF.state.betting = CF.newBettingState(); dbgApplied("Bet history cleared"); break;
      case "dbg-fill-moves":
        CF.state.houseGear = CF.ruleset.perUpdate.gearMax;
        CF.state.sewerGear = CF.ruleset.perUpdate.gearMax;
        dbgApplied("Moves refilled"); break;
      case "dbg-unrob": CF.houses.refreshOnUpdate(); dbgApplied("Every house is worth robbing again"); break;
      case "dbg-newdistrict": CF.houses.rebuild(); ui.hsCamPrev = null; dbgApplied("New district generated"); break;
      case "dbg-give-items": CF.state.houses.items = (CF.state.houses.items || 0) + 10;
        dbgApplied("Stolen items"); break;
      case "dbg-sewer-level": {
        var dl = +el.getAttribute("data-lvl");
        // debug ignores the weapon-handling gate on purpose — that is the point of it
        CF.state.houses.level = dl;
        CF.state.houses.maxLevel = Math.max(CF.state.houses.maxLevel || 1, dl);
        CF.houses.recarve(dl);
        ui.hsCamPrev = null; dbgApplied("Sewer level " + dl); break;
      }
      case "dbg-sewer-up": CF.houses.leaveSewer(); ui.hsCamPrev = null; dbgApplied("Back on the street"); break;
      case "dbg-recarve":
        if (!CF.houses.inSewer()) { toast("You are not in the sewer."); break; }
        CF.houses.recarve(CF.houses.level()); dbgApplied("Floor recarved"); break;
      case "dbg-heal": CF.state.player.durabilityCur = CF.sports.enduranceMax();
        dbgApplied("Endurance"); break;
      case "dbg-hurt": CF.state.player.durabilityCur = 0; dbgApplied("Endurance"); break;
      case "dbg-give-kits": CF.state.medicine.kits = (CF.state.medicine.kits || 0) + 10;
        dbgApplied("First aid kits"); break;
      case "dbg-give-vault": {
        /* five random BANK items (the 200 catalogue the villas feed); a repeat
           stacks in the warehouse, exactly as a real steal would */
        for (var gi = 0; gi < 5; gi++) {
          var bn = 1 + Math.floor(Math.random() * CF.bankItems.count);
          if (!CF.bank.addItem(bn)) CF.bank.addToStore(bn, 1);
        }
        dbgApplied("Bank items"); break;
      }
      case "dbg-give-treasure": {
        // five random VAULT treasures (the 80 catalogue the sewer feeds)
        for (var ti = 0; ti < 5; ti++) CF.vaults.add(1 + Math.floor(Math.random() * CF.vaultItems.count), 1);
        dbgApplied("Vault treasure"); break;
      }
      case "dbg-fill-collection": {
        // every bank item, so the upgrade requirement can actually be met
        for (var ci = 1; ci <= CF.bankItems.count; ci++) CF.bank.addItem(ci);
        dbgApplied("Whole collection"); break;
      }
      case "dbg-fill-chambers": {
        for (var vi = 1; vi <= CF.vaultItems.count; vi++) CF.vaults.add(vi, 1);
        dbgApplied("Every chamber"); break;
      }
      case "dbg-own-bank": {
        CF.state.player.bankOwned = !CF.state.player.bankOwned;
        if (CF.state.player.bankOwned) CF.state.player.bankLevel = CF.state.player.bankLevel || 1;
        dbgApplied(CF.state.player.bankOwned ? "Bank bought" : "Bank sold back"); break;
      }
      case "dbg-set-banklevel":
        CF.state.player.bankLevel = Math.max(1, Math.min(CF.ruleset.bank.maxLevel, num("dbgBankLevel", 1)));
        dbgApplied("Bank level"); break;
      case "dbg-wear-items": {
        // knock every piece down so the maintenance list has work in it
        var vv = CF.bank.items();
        for (var wk in vv) vv[wk] = Math.max(0, vv[wk] - 20);
        dbgApplied("Items worn"); break;
      }
      case "dbg-reset-maint":
        CF.state.bankMaintSlot = -1; CF.state.bankMaintCount = 0;
        dbgApplied("Maintenance allowance"); break;
      case "dbg-give-weapon": {
        var cw = CF.coldWeapons[Math.floor(Math.random() * CF.coldWeapons.length)];
        CF.houses.arms()[cw.name] = (CF.houses.arms()[cw.name] || 0) + 1;
        dbgApplied("Weapon rack (" + cw.name + ")"); break;
      }
      case "dbg-replay-intro": ui.debugOpen = false; startOnboarding(); renderAll(); break;
      case "dbg-stock-all": DBG_SKILLS.forEach(function (s) { debugUnlimited(s); }); dbgApplied("Every skill stocked"); break;
      case "dbg-open-office": CF.state.garden.ticketReopenAt = Date.now(); dbgApplied("Ticket office opened"); break;
      case "dbg-late-game": CF.loadLateGame(); ui.place = "account"; ui.debugOpen = false;
        renderAll(); toast("Late-game profile loaded."); break;
      case "dbg-toggle-cap": CF.ruleset.enforceCapacity = !CF.ruleset.enforceCapacity;
        dbgApplied("Capacity enforcement " + (CF.ruleset.enforceCapacity ? "ON" : "OFF")); break;
      case "dbg-clear-cooldowns": CF.state.sports.lastSteroidBuy = 0; CF.state.sports.run = null; dbgApplied("Cooldowns cleared"); break;
      case "go-tavern": case "landing": ui.place = "tavern"; ui.tool = null; ui.mixError = null; ui.mixLevelUp = null;
        ui.tavernBuyView = false; renderPlace(); break;
      case "tavern-accept-job": CF.state.player.tavernJobAccepted = true; CF.autosave();
        renderPlace(); toast("You took the job — the tavern is yours to run."); break;
      case "tavern-buy-view": ui.tavernBuyView = true; renderPlace(); break;
      case "tavern-buy": {
        var t = CF.ruleset.tavernPurchase, pl = CF.state.player;
        if (pl.drinkMasterLevel < t.reqDrinkMaster) { toast("Needs Barkeeping level " + t.reqDrinkMaster + " (you are " + pl.drinkMasterLevel + ").", "err"); break; }
        if (pl.money < t.priceCC) { toast("Needs " + fmt(t.priceCC) + " CC (you have " + fmt(pl.money) + ").", "err"); break; }
        pl.money -= t.priceCC; pl.tavernOwned = true; ui.tavernBuyView = false;
        CF.autosave(); renderSidebar(); renderPlace();
        toast("You bought the tavern! The canteen and Cooking are unlocked.");
        break;
      }
      case "go-house": ui.place = "house"; ui.houseView = null; renderPlace(); break;
      case "house-upgrade": { var hu = houseUpgrade(); toast(hu.msg, hu.ok ? "" : "err"); if (hu.ok) { CF.autosave(); renderSidebar(); renderPlace(); } break; }
      case "go-slum": ui.place = "slum"; renderPlace(); break;
      case "go-bank": ui.place = "bank"; ui.bankRoom = ui.bankRoom || "cash"; ui.bankNotice = null; ui.bankError = null; renderPlace(); break;
      case "go-casino": ui.place = "casino"; renderPlace(); break;
      case "go-racing": ui.place = "racing"; renderPlace(); break;
      case "bank-buy": {
        ui.bankNotice = null; ui.bankError = null;
        var bb = CF.bank.buy();
        if (bb.ok) { ui.bankNotice = bb.msg; CF.autosave(); } else ui.bankError = bb.msg;
        renderSidebar(); renderPlace(); break;
      }
      case "bank-room": {
        var br = el.getAttribute("data-room");
        var meta = CF.bankRooms.left.concat(CF.bankRooms.right).filter(function (r) { return r.id === br; })[0];
        if (meta && !meta.live) { toast(meta.name + " isn't built yet."); break; }
        ui.bankRoom = br; ui.bankNotice = null; ui.bankError = null; renderPlace(); break;
      }
      case "bank-put": case "bank-take": {
        ui.bankNotice = null; ui.bankError = null;
        var br2 = a === "bank-put" ? CF.bank.deposit(num("bankPut", 0)) : CF.bank.withdraw(num("bankTake", 0));
        if (br2.ok) { ui.bankNotice = br2.msg; CF.autosave(); } else ui.bankError = br2.msg;
        renderSidebar(); renderPlace(); break;
      }
      case "bank-pick": {
        // clicking anywhere on the row toggles it; clicking the box itself is
        // already handled by the browser, so don't undo it
        var pn = el.getAttribute("data-no");
        var box = el.querySelector(".bkck");
        if (box && e && e.target !== box) box.checked = !box.checked;
        if (box) el.classList.toggle("sel", box.checked);
        break;
      }
      case "bank-maintain": {
        ui.bankNotice = null; ui.bankError = null;
        var picked = Array.prototype.filter.call(document.querySelectorAll(".bkck"), function (c) { return c.checked; })
          .map(function (c) { return +c.getAttribute("data-no"); });
        var mr = CF.bank.maintain(picked);
        if (mr.ok) {
          ui.bankNotice = mr.msg + (mr.skipped ? " " + mr.skipped + " had to wait — the hour's allowance ran out." : "");
          CF.autosave();
        } else ui.bankError = mr.msg;
        renderPlace(); break;
      }
      case "vault-tab": ui.vaultTab = el.getAttribute("data-tab"); renderPlace(); break;
      case "vault-pick": {
        var vb = el.querySelector(".vck");
        if (vb && e && e.target !== vb) vb.checked = !vb.checked;
        if (vb) el.classList.toggle("sel", vb.checked);
        break;
      }
      case "vault-sell": {
        ui.bankNotice = null; ui.bankError = null;
        var q = Math.max(1, num("vaultQty", 1));
        var vp = Array.prototype.filter.call(document.querySelectorAll(".vck"), function (c) { return c.checked; })
          .map(function (c) { return +c.getAttribute("data-no"); });
        if (!vp.length) { ui.bankError = "Choose some treasure to sell."; renderPlace(); break; }
        var vt = 0, vn = 0, verr = null;
        vp.forEach(function (n) {
          var r = CF.vaults.sell(n, Math.min(q, CF.vaults.count(n)));
          if (r.ok) { vt += r.got; vn++; } else if (!verr) verr = r.msg;
        });
        if (vn) { ui.bankNotice = "You sold treasure for " + fmt(vt) + " CC."; CF.autosave(); }
        else ui.bankError = verr || "Nothing sold.";
        renderSidebar(); renderPlace(); break;
      }
      case "bank-sell": {
        ui.bankNotice = null; ui.bankError = null;
        var picks = Array.prototype.filter.call(document.querySelectorAll(".bkck"), function (c) { return c.checked; })
          .map(function (c) { return +c.getAttribute("data-no"); });
        if (!picks.length) { ui.bankError = "Choose something to sell."; renderPlace(); break; }
        var total = 0, sold = 0, err = null;
        picks.forEach(function (n) {
          var r = CF.bank.sell(n, CF.bank.stored(n));
          if (r.ok) { total += r.got; sold++; } else if (!err) err = r.msg;
        });
        if (sold) { ui.bankNotice = "You sold " + sold + " lot" + (sold === 1 ? "" : "s") +
          " for " + fmt(total) + " CC."; CF.autosave(); } else ui.bankError = err || "Nothing sold.";
        renderSidebar(); renderPlace(); break;
      }
      case "bank-sell-range": {
        ui.bankNotice = null; ui.bankError = null;
        var rr = CF.bank.sellRange(num("bankFrom", 0), num("bankTo", 0));
        if (rr.ok) { ui.bankNotice = rr.msg; CF.autosave(); } else ui.bankError = rr.msg;
        renderSidebar(); renderPlace(); break;
      }
      case "bank-upgrade": {
        ui.bankNotice = null; ui.bankError = null;
        var ur = CF.bank.upgrade();
        if (ur.ok) { ui.bankNotice = ur.msg; CF.autosave(); } else ui.bankError = ur.msg;
        renderSidebar(); renderPlace(); break;
      }
      /* ---- casino ---- */
      case "cas-game": {
        var cg = el.getAttribute("data-game");
        ui.casNotice = null; ui.casError = null;
        var CS = CF.state.casino;
        CS.game = cg;
        CS.bj = null; CS.vp = null; CS.slot = null;   // leaving a table folds the hand
        renderPlace(); break;
      }
      case "cas-new": {
        ui.casNotice = null; ui.casError = null;
        var cs = CF.state.casino, cbet = num("casBet", cs.bet || 0), cr;
        if (cs.game === "blackjack") cr = CF.casino.bjStart(cbet);
        else if (cs.game === "poker") cr = CF.casino.vpDeal(cbet);
        else break;
        if (!cr.ok) ui.casError = cr.msg;
        else if (cr.msg) ui.casNotice = cr.msg;
        CF.autosave(); renderSidebar(); renderPlace(); break;
      }
      case "cas-again": {
        ui.casNotice = null; ui.casError = null;
        var ca = CF.state.casino; ca.bj = null; ca.vp = null; ca.slot = null;
        renderPlace(); break;
      }
      case "bj-hit": case "bj-stand": {
        ui.casNotice = null; ui.casError = null;
        var br = a === "bj-hit" ? CF.casino.bjHit() : CF.casino.bjStand();
        if (!br.ok) ui.casError = br.msg;
        CF.autosave(); renderSidebar(); renderPlace(); break;
      }
      case "vp-draw": {
        ui.casNotice = null; ui.casError = null;
        var keep = Array.prototype.filter.call(document.querySelectorAll(".vpk"), function (c) { return c.checked; })
          .map(function (c) { return +c.getAttribute("data-i"); });
        var vr = CF.casino.vpDraw(keep);
        if (!vr.ok) ui.casError = vr.msg;
        CF.autosave(); renderSidebar(); renderPlace(); break;
      }
      case "slot-spin": {
        ui.casNotice = null; ui.casError = null;
        var sb = +el.getAttribute("data-bet"), sr = CF.casino.slotSpin(sb);
        if (!sr.ok) ui.casError = sr.msg;
        CF.autosave(); renderSidebar(); renderPlace(); break;
      }
      /* ---- Villas and sewer ---- */
      case "go-houses": ui.place = "houses"; CF.state.houses.sel = null; renderPlace(); break;
      case "hs-pick": {
        var hx = +el.getAttribute("data-x"), hy = +el.getAttribute("data-y");
        var cur = CF.state.houses.sel;
        // clicking the selected tile again closes the menu
        CF.state.houses.sel = (cur && cur.x === hx && cur.y === hy) ? null : { x: hx, y: hy };
        renderPlace(); break;
      }
      case "hs-do": {
        var dx = +el.getAttribute("data-x"), dy = +el.getAttribute("data-y"), what = el.getAttribute("data-do");
        ui.hsNotice = null; ui.hsError = null; ui.hsLevelUp = null; ui.hsSub = null;
        if (what === "sewer" || what === "sewerwalk") {
          if (what === "sewerwalk" && !CF.houses.standingOn(dx, dy)) {
            var swr = CF.houses.walkTo(dx, dy);
            if (!swr.ok) { ui.hsError = swr.msg; CF.state.houses.sel = null; renderSidebar(); renderPlace(); break; }
          }
          CF.houses.noteStreetSpot();
          var er = CF.houses.enterSewer(1);
          if (er.ok) { ui.hsNotice = er.msg; ui.hsCamPrev = null; CF.autosave(); } else ui.hsError = er.msg;
        } else if (what === "attack" || what === "treasure" || what === "up" || what === "down") {
          // all four need you standing on the tile, so walk first if need be
          if (!CF.houses.standingOn(dx, dy)) {
            var mr = CF.houses.walkTo(dx, dy);
            if (!mr.ok) { ui.hsError = mr.msg; CF.state.houses.sel = null; renderSidebar(); renderPlace(); break; }
          }
          var ar = what === "attack" ? CF.houses.attackMonster(dx, dy)
                 : what === "treasure" ? CF.houses.takeTreasure(dx, dy)
                 : CF.houses.climb(what, dx, dy);
          if (ar.ok) {
            ui.hsNotice = ar.msg;
            if (ar.sub) ui.hsSub = ar.sub;
            if (ar.levelUp) ui.hsLevelUp = ar.levelUp;
            if (what === "up" || what === "down") ui.hsCamPrev = null;
            CF.autosave();
          } else ui.hsError = ar.msg;
        } else if (what === "walk") {
          var wr = CF.houses.walkTo(dx, dy);
          if (wr.ok) { ui.hsNotice = wr.msg; CF.autosave(); } else ui.hsError = wr.msg;
        } else if (what === "steal" || what === "walksteal") {
          // walk-and-steal is one intent: get there, then rob it in the same click
          if (what === "walksteal" && !CF.houses.standingOn(dx, dy)) {
            var wr2 = CF.houses.walkTo(dx, dy);
            if (!wr2.ok) { ui.hsError = wr2.msg; CF.state.houses.sel = null; renderSidebar(); renderPlace(); break; }
          }
          var sr = CF.houses.stealFrom(dx, dy);
          if (sr.ok) {
            ui.hsNotice = sr.msg;
            if (sr.sub) ui.hsSub = sr.sub;
            if (sr.levelUp) ui.hsLevelUp = sr.levelUp;
            CF.autosave();
          } else ui.hsError = sr.msg;
        }
        CF.state.houses.sel = null;
        renderSidebar(); renderPlace(); break;
      }
      /* ---- Slum: the Betting Bunker ---- */
      case "slum-area": ui.slumArea = el.getAttribute("data-area"); renderPlace(); break;
      case "bunk-tab": ui.bunkerTab = el.getAttribute("data-tab"); renderPlace(); break;
      case "bunk-venue":
        ui.bunkVenue = el.getAttribute("data-venue");
        ui.bunkPick = null; ui.bunkStake = null;   // a new venue has its own limits
        renderPlace(); break;
      case "bunk-pick": ui.bunkPick = el.getAttribute("data-i"); renderPlace(); break;
      case "bunk-place": {
        var bs = $("bunkStake") ? parseInt($("bunkStake").value, 10) : 0;
        if (bs) ui.bunkStake = String(bs);
        var bv = ui.bunkVenue, bvs = CF.betting.venues();
        if (!bv) { bvs.forEach(function (v) { if (!bv && CF.betting.isOpen(v)) bv = v.id; }); }
        var br = CF.betting.placeBet(bv, ui.bunkPick, bs || 0);
        if (br.ok) {
          /* No notice on success on purpose: this jumps to the Active tab, and
           * the race with your slip on it says everything a banner would — one
           * that would be wiped by the tab change anyway. */
          ui.bunkError = null; ui.bunkNotice = null;
          ui.bunkerTab = "active";
          CF.autosave();
        } else { ui.bunkError = br.msg; ui.bunkNotice = null; }
        renderSidebar(); renderPlace(); break;
      }
      case "bunk-skip": CF.betting.skip(); CF.autosave(); renderSidebar(); renderPlace(); break;
      case "bunk-collect":
        CF.betting.collect();
        ui.bunkerTab = "place"; ui.bunkNotice = null; ui.bunkError = null;
        CF.autosave(); renderSidebar(); renderPlace(); break;
      case "cas-buy": case "cas-sell": {
        ui.casNotice = null; ui.casError = null;
        var xr = a === "cas-buy" ? CF.casino.buyTokens(num("casBuy", 0))
                                   : CF.casino.sellTokens(num("casSell", 0));
        if (xr.ok) ui.casNotice = xr.msg; else ui.casError = xr.msg;
        CF.autosave(); renderSidebar(); renderPlace(); break;
      }
      case "house-craft": ui.place = "house"; ui.houseView = "craftcabinet"; renderPlace(); break;
      case "market-craft": {
        // a supply/material number carries data-mat -> pre-select it at the counter
        var mat = el.getAttribute("data-mat");
        if (mat && CF.craft.unitPrice(mat) > 0) ui.craftSel = mat;
        ui.place = "slum"; ui.slumCounter = "craft"; ui.craftNotice = null; renderPlace(); break;
      }
      case "craft-cabinet":   // from the backpack panel / the yellow "into your closet" line
        ui.place = "house"; ui.houseView = "craftcabinet"; ui.craftNotice = null; renderPlace(); break;
      case "craft-buy": {
        var bres = CF.craft.buyBackpack(ui.craftSel);
        ui.craftNotice = bres.ok ? bres.msg : null;
        act(bres); break;
      }
      case "craft-empty": act(CF.craft.emptyBackpack()); break;
      case "craft-row": ui.craftSel = el.getAttribute("data-mat"); renderPlace(); break;
      case "house-station":
        ui.place = "house"; ui.houseView = "station";
        ui.houseStation = el.getAttribute("data-station");
        ui.craftMadeNotice = null; ui.craftError = null; ui.craftLevelUp = null; renderPlace(); break;
      case "house-finished":
        ui.place = "house"; ui.houseView = "finished"; renderPlace(); break;
      case "craft-make": fastCraft(); break;   // in-place update; button stays put
      case "finished-row": ui.finishedSel = el.getAttribute("data-item"); ui.finishedQty = "1"; renderPlace(); break;
      case "sell-finished": {
        var it = ui.finishedSel;
        var qEl = $("sellQty"); var q = qEl ? parseFloat(qEl.value) : 1;
        var sres = CF.craft.sellFinished(it, q);
        if (sres.ok && (CF.state.craft.made[it] || 0) <= 0) ui.finishedSel = null;  // sold out -> collapse
        act(sres); break;
      }
      /* ---- room 6: blacksmith ---- */
      case "go-anvil": ui.place = "house"; ui.houseView = "anvil"; ui.anvilNotice = null; ui.anvilError = null; ui.anvilLevelUp = null; renderPlace(); break;
      case "go-armory": ui.place = "house"; ui.houseView = "armory"; renderPlace(); break;
      case "go-blackwh": ui.place = "house"; ui.houseView = "blackwarehouse"; renderPlace(); break;
      case "anvil-upgrade": ui.place = "house"; ui.houseView = "anvilupgrade"; ui.anvilError = null; ui.anvilNotice = null; renderPlace(); break;
      case "anvil-forge": fastForge(); break;   // in-place; button stays put
      case "do-upgrade": ui.anvilNotice = null; ui.anvilError = null; {
        var ures = CF.blacksmith.upgradeAnvil();
        if (ures.ok) ui.anvilNotice = ures.msg; else ui.anvilError = ures.msg;
        act(ures); break;
      }
      case "weapon-row": ui.weaponSel = el.getAttribute("data-item"); ui.weaponQty = "1"; renderPlace(); break;
      case "sell-weapon": {
        var wn = ui.weaponSel, wq = $("weaponQty") ? parseInt($("weaponQty").value, 10) : 1;
        var wres = CF.blacksmith.sellWeapon(wn, wq);
        act(wres); break;
      }
      case "bw-row": ui.bwSel = el.getAttribute("data-item"); ui.bwQty = "1"; renderPlace(); break;
      case "sell-bw": {
        var bn = ui.bwSel, bq = $("bwQty") ? parseFloat($("bwQty").value) : 1;
        var bres = CF.blacksmith.sellWarehouse(bn, bq);
        act(bres); break;
      }
      /* ---- room 2: drug lab (Chemist) ---- */
      case "go-chemjuicer": ui.place = "house"; ui.houseView = "chemjuicer"; ui.chemNotice = null; ui.chemError = null; ui.chemLevelUp = null; ui.streetNotice = null; ui.streetError = null; renderPlace(); break;
      case "go-druglab": ui.place = "house"; ui.houseView = "druglab"; ui.chemNotice = null; ui.chemError = null; ui.chemLevelUp = null; ui.streetNotice = null; ui.streetError = null; renderPlace(); break;
      case "go-labcabinet": ui.place = "house"; ui.houseView = "labcabinet"; ui.chemNotice = null; ui.chemError = null; ui.chemLevelUp = null; ui.streetNotice = null; ui.streetError = null; renderPlace(); break;
      case "chem-press": {
        ui.chemError = null; ui.chemLevelUp = null;
        var jp = ($("juicerPlant") && $("juicerPlant").value) || ui.juicerPlant || "";
        var jq = $("juicerQty") ? parseInt($("juicerQty").value, 10) : parseInt(ui.juicerQty, 10);
        ui.juicerPlant = jp; if (jq) ui.juicerQty = String(jq);
        var pres = CF.chemist.pressPlants(jp, jq || 0);
        if (pres.ok) { ui.chemNotice = pres.msg; CF.autosave(); } else ui.chemError = pres.msg;
        renderPlace(); break;
      }
      case "drug-mix": fastDrugMix(); break;   // in-place; button stays put for autoclicking
      case "juice-row": ui.labJuiceSel = el.getAttribute("data-juice"); renderPlace(); break;
      case "lab-sell-juice": {
        ui.chemError = null;
        if (!ui.labJuiceSel) { ui.chemError = "Pick a juice to sell (click a row)."; renderPlace(); break; }
        var sq = $("labSellQty") ? parseInt($("labSellQty").value, 10) : 0;
        var jres = CF.chemist.sellJuice(ui.labJuiceSel, sq || 0);
        if (jres.ok) { ui.chemNotice = jres.msg; CF.autosave(); } else ui.chemError = jres.msg;
        renderPlace(); break;
      }
      case "lab-unload": {
        var ures2 = CF.chemist.unloadPlants();
        if (ures2.ok) { ui.chemNotice = ures2.msg; CF.autosave(); } else ui.chemError = ures2.msg;
        renderPlace(); break;
      }
      /* ---- Streets ---- */
      case "go-streets": {
        ui.place = "streets";
        ui.chemNotice = null; ui.chemError = null; ui.chemLevelUp = null;   // leaving the lab
        ui.streetNotice = null; ui.streetError = null;                      // fresh street
        var lm = ui.lastMixDrug;   // coming from the lab: pre-select the drug you just crafted, ready to sell
        ui.beltSel = (lm && (CF.state.chemist.belt[lm] || 0) > 0) ? lm : null;
        renderPlace(); break;
      }
      case "buy-narc-row": ui.buyNarcSel = el.getAttribute("data-narc"); renderPlace(); break;
      case "street-buy": {
        ui.streetError = null;
        if (!ui.buyNarcSel) { ui.streetError = "Pick a drug to buy (click a row)."; renderPlace(); break; }
        var g = $("streetGrams") ? parseInt($("streetGrams").value, 10) : parseInt(ui.streetGrams, 10);
        if (g) ui.streetGrams = String(g);
        var bres2 = CF.chemist.buyDrug(ui.buyNarcSel, g || 0, ui.streetCountry);
        if (bres2.ok) { ui.streetNotice = bres2.msg; CF.autosave(); } else ui.streetError = bres2.msg;
        renderPlace(); break;
      }
      case "belt-row": ui.beltSel = el.getAttribute("data-drug"); renderPlace(); break;
      case "street-sell": {
        ui.streetError = null;
        if (!ui.beltSel) { ui.streetError = "Select a drug to sell (click a row)."; renderPlace(); break; }
        var sres = CF.chemist.sellBeltDrug(ui.beltSel, ui.streetCountry);
        if (sres.ok) { ui.streetNotice = sres.msg; ui.beltSel = null; CF.autosave(); } else ui.streetError = sres.msg;
        renderPlace(); break;
      }
      case "buy-tool": {
        var tn = el.getAttribute("data-tool"), tp = CF.ruleset.craft.handToolPrices[tn] || 0;
        if (CF.state.craft.tools[tn]) { toast("You already own that tool.", "err"); break; }
        if (CF.state.player.money < tp) { toast("Needs " + fmt(tp) + " CC.", "err"); break; }
        CF.state.player.money -= tp; CF.state.craft.tools[tn] = true;
        CF.autosave(); renderSidebar(); renderPlace(); toast("Bought the " + tn + ".");
        break;
      }
      case "market-slumtickets": ui.place = "slum"; ui.slumCounter = "tickets"; renderPlace(); break;
      case "buy-slum-pass": {
        var pid = el.getAttribute("data-pass"), pass = null;
        CF.ruleset.slumPasses.forEach(function (x) { if (x.id === pid) pass = x; });
        if (!pass) break;
        if (CF.state.slumPasses[pid]) { toast("You already have that ticket.", "err"); break; }
        if (CF.state.player.money < pass.price) { toast("Needs " + fmt(pass.price) + " CC.", "err"); break; }
        CF.state.player.money -= pass.price; CF.state.slumPasses[pid] = true;
        CF.autosave(); renderSidebar(); renderPlace();
        toast("Bought the " + pass.area + " access ticket.");
        break;
      }
      case "market-drugbelt": {
        ui.place = "slum"; ui.slumCounter = "drugbelt";
        var bb = CF.chemist.bestBuyableBelt(CF.state.player.fame || 0, CF.state.player.money, CF.chemist.beltCap());
        if (bb) ui.beltBuySel = bb.cap;   // auto-select the best belt you can buy
        renderPlace(); break;
      }
      case "belt-buy-row": ui.beltBuySel = parseInt(el.getAttribute("data-cap"), 10); renderPlace(); break;
      case "buy-belt": {
        if (!ui.beltBuySel) { toast("Select a belt first.", "err"); break; }
        act(CF.chemist.buyBelt(ui.beltBuySel)); break;
      }
      case "chem-help": ui.chemHelpOpen = true; renderModal(); break;
      case "chem-help-close": ui.chemHelpOpen = false; renderModal(); break;
      /* ---- Account-overview shortcuts ---- */
      case "acc-sports": ui.place = "sports"; ui.sportsFac = el.getAttribute("data-fac") || "trail";
        ui.sportNotice = null; ui.sportError = null; renderPlace(); break;
      case "acc-garden": ui.place = "garden"; ui.gardenTab = el.getAttribute("data-tab") || "greenhouse";
        ui.gardenNotice = null; ui.gardenError = null; ui.gardenPtsMsg = null; ui.gardenBackpackBar = false; ui.gardenLevelUp = null;
        renderPlace(); break;
      case "acc-streets": ui.place = "streets"; ui.streetNotice = null; ui.streetError = null; renderPlace(); break;
      case "acc-house": ui.place = "house"; ui.houseView = null; renderPlace(); break;
      /* ---- Sports complex ---- */
      case "go-sports": ui.place = "sports"; ui.sportNotice = null; ui.sportError = null; renderPlace(); break;
      case "sports-fac": ui.sportsFac = el.getAttribute("data-fac"); ui.sportNotice = null; ui.sportError = null; renderPlace(); break;
      case "run-opt": ui.runHours = parseInt(el.getAttribute("data-hours"), 10); renderPlace(); break;
      case "sports-run": {
        ui.sportError = null; ui.sportNotice = null;
        var st = $("runSteroids") ? $("runSteroids").checked : ui.runSteroids;
        ui.runSteroids = st;
        var rr = CF.sports.startRun(ui.runHours, st);
        if (rr.ok) { ui.sportNotice = rr.msg; CF.autosave(); } else ui.sportError = rr.msg;
        renderPlace(); break;
      }
      case "sports-pause": {
        ui.sportError = null; ui.sportNotice = null;
        if (!$("sureBox") || !$("sureBox").checked) { ui.sportError = 'Tick "I am sure." to stop the workout.'; renderPlace(); break; }
        var pr = CF.sports.pauseRun();
        if (pr.ok) { ui.sportNotice = pr.msg; CF.autosave(); } else ui.sportError = pr.msg;
        renderPlace(); break;
      }
      case "sports-lift": fastLift(el.getAttribute("data-lift")); break;   // in-place; the row never rebuilds
      case "sports-steroid": {
        ui.sportError = null; ui.sportNotice = null;
        var er = CF.sports.eatSteroid();
        if (er.ok) { ui.sportNotice = er.msg; CF.autosave(); } else ui.sportError = er.msg;
        renderPlace(); break;
      }
      case "sports-steroid-buy": ui.sportsFac = "shop"; renderPlace(); break;
      case "sports-buy": {
        ui.sportError = null; ui.sportNotice = null;
        var br = CF.sports.buy(el.getAttribute("data-item"));
        if (br.ok) { ui.sportNotice = br.msg; CF.autosave(); renderSidebar(); } else ui.sportError = br.msg;
        renderPlace(); break;
      }
      /* ---- Garden ---- */
      case "go-garden": ui.place = "garden"; ui.gardenNotice = null; ui.gardenError = null;
        ui.gardenPtsMsg = null; ui.gardenBackpackBar = false; ui.gardenLevelUp = null; renderPlace(); break;
      case "garden-tab": ui.gardenTab = el.getAttribute("data-tab");
        ui.gardenNotice = null; ui.gardenError = null; ui.gardenPtsMsg = null; ui.gardenBackpackBar = false;
        ui.gardenLevelUp = null; ui.gardenErrors = null;
        renderPlace(); break;
      /* ---- harbor ---- */
      case "go-harbor": ui.place = "harbor"; ui.hbNotice = null; ui.hbError = null; renderPlace(); break;
      case "go-hospital": ui.place = "hospital"; ui.hspNotice = null; ui.hspError = null; renderPlace(); break;
      case "hsp-room": {
        var rm = el.getAttribute("data-room");
        if (CF.hospital.rooms().live[rm]) { ui.hspNotice = null; ui.hspError = null; renderPlace(); }
        else toast(rm + " isn't built yet.");
        break;
      }
      /* Straight back down where you got hurt. If you were already in the sewer
         when you came up here, this returns you to that floor rather than
         starting you over at level 1. */
      case "hsp-sewer": {
        ui.place = "houses"; CF.state.houses.sel = null;
        ui.hsNotice = null; ui.hsError = null; ui.hsSub = null; ui.hsLevelUp = null;
        if (!CF.houses.inSewer()) {
          CF.houses.noteStreetSpot();
          var hr = CF.houses.enterSewer(1);
          if (hr.ok) { ui.hsNotice = hr.msg; ui.hsCamPrev = null; } else ui.hsError = hr.msg;
        }
        CF.autosave(); renderSidebar(); renderPlace(); break;
      }
      case "hsp-cash": case "hsp-kit": {
        var tr = a === "hsp-cash" ? CF.hospital.treatForCash() : CF.hospital.treatWithKit();
        if (tr.ok) { ui.hspNotice = tr.msg; ui.hspError = null; CF.autosave(); }
        else { ui.hspError = tr.msg; ui.hspNotice = null; }
        renderSidebar(); renderPlace(); break;
      }
      case "hb-buy": {
        ui.hbNotice = null; ui.hbError = null;
        var br2 = CF.harbor.buyShip();
        if (br2.ok) { ui.hbNotice = br2.msg; CF.autosave(); } else ui.hbError = br2.msg;
        renderSidebar(); renderPlace(); break;
      }
      case "hb-tab": ui.hbTab = el.getAttribute("data-tab");
        ui.hbNotice = null; ui.hbError = null; renderPlace(); break;
      case "hb-view": ui.hbView = el.getAttribute("data-view");
        ui.hbNotice = null; ui.hbError = null; renderPlace(); break;
      case "hb-pick": ui.hbUpg = el.getAttribute("data-key");
        ui.hbNotice = null; ui.hbError = null; renderPlace(); break;
      case "hb-improve": {
        ui.hbNotice = null; ui.hbError = null;
        if (!ui.hbUpg) { ui.hbError = "Tick which improvement to make."; renderPlace(); break; }
        var ir = CF.harbor.startRefit(ui.hbUpg);
        if (ir.ok) { ui.hbNotice = ir.msg; ui.hbUpg = null; CF.autosave(); } else ui.hbError = ir.msg;
        renderSidebar(); renderPlace(); break;
      }
      case "hb-cancel": {
        ui.hbNotice = null; ui.hbError = null;
        var cr2 = CF.harbor.cancelRefit();
        if (cr2.ok) { ui.hbNotice = cr2.msg; CF.autosave(); } else ui.hbError = cr2.msg;
        renderSidebar(); renderPlace(); break;
      }
      case "hb-hpick": ui.hbHire[el.getAttribute("data-kind")] = el.getAttribute("data-name");
        ui.hbNotice = null; ui.hbError = null; renderPlace(); break;
      case "hb-hire": {
        ui.hbNotice = null; ui.hbError = null;
        var hk = el.getAttribute("data-kind");
        var hm = +(($("hbMen-" + hk) || {}).value || ui.hbMen[hk] || 0);
        ui.hbMen[hk] = hm;
        var hr = CF.harbor.hire(hk, ui.hbHire[hk], hm);
        if (hr.ok) { ui.hbNotice = hr.msg; ui.hbHire[hk] = null; CF.autosave(); } else ui.hbError = hr.msg;
        renderSidebar(); renderPlace(); break;
      }
      case "hb-fire": {
        ui.hbNotice = null; ui.hbError = null;
        var fr2 = CF.harbor.fire(el.getAttribute("data-kind"));
        if (fr2.ok) { ui.hbNotice = fr2.msg; CF.autosave(); } else ui.hbError = fr2.msg;
        renderPlace(); break;
      }
      case "hb-send": {
        ui.hbNotice = null; ui.hbError = null;
        var picks = CF.harbor.holds().map(function (kg, i) {
          var el2 = $("hbHold" + i); return (el2 && el2.value) || ui.hbHold[i] || "";
        });
        ui.hbHold = picks;
        var sr2 = CF.harbor.sendShip(picks);
        if (sr2.ok) { ui.hbNotice = sr2.msg; CF.autosave(); } else ui.hbError = sr2.msg;
        renderPlace(); break;
      }
      /* ---- Culinary exchange (Slum market) ---- */
      case "market-culinary": ui.place = "slum"; ui.slumCounter = "culinary";
        ui.culNotice = null; ui.culError = null; renderPlace(); break;
      case "cul-search": {
        ui.culSel = ($("culSel") && $("culSel").value) || ui.culSel || "";
        ui.culLot = null; ui.culNotice = null; ui.culError = null;
        if (!ui.culSel) ui.culError = "Choose which fruit you want.";
        renderPlace(); break;
      }
      case "cul-pick": ui.culLot = +el.getAttribute("data-lot");
        ui.culNotice = null; ui.culError = null; renderPlace(); break;
      case "cul-swap": {
        ui.culNotice = null; ui.culError = null;
        if (!ui.culLot) { ui.culError = "Tick which lot you want to exchange."; renderPlace(); break; }
        var sw = CF.garden.swapFruit(ui.culSel, ui.culLot);
        if (sw.ok) { ui.culNotice = sw.msg; ui.culLot = null; CF.autosave(); } else ui.culError = sw.msg;
        renderSidebar(); renderPlace(); break;
      }
      /* ---- canteen (tavern 2nd floor) ---- */
      case "go-canteen": {
        ui.place = "canteen"; ui.canRoom = null;
        ui.canNotice = null; ui.canError = null; ui.canLevelUp = null;
        renderPlace(); break;
      }
      case "can-room": ui.canRoom = el.getAttribute("data-room");
        ui.canNotice = null; ui.canError = null; ui.canLevelUp = null; renderPlace(); break;
      case "can-fill": {
        ui.canNotice = null; ui.canError = null;
        var fl = ($("canLiquid") && $("canLiquid").value) || ui.canLiquid || "";
        ui.canLiquid = fl;
        var fr = CF.canteen.fillContainer(fl);
        if (fr.ok) { ui.canNotice = fr.msg; CF.autosave(); } else ui.canError = fr.msg;
        renderPlace(); break;
      }
      case "can-brew": {
        ui.canNotice = null; ui.canError = null;
        var dp = ($("canDairy") && $("canDairy").value) || ui.canDairy || "";
        var lt = ($("canLiters") && +$("canLiters").value) || +ui.canLiters || 0;
        ui.canDairy = dp; ui.canLiters = lt;
        var br = CF.canteen.prepareDairy(dp, lt);
        if (br.ok) { ui.canNotice = br.msg; CF.autosave(); } else ui.canError = br.msg;
        renderPlace(); break;
      }
      case "can-cook-veg": case "can-cook-fish": {
        ui.canNotice = null; ui.canError = null; ui.canLevelUp = null;
        var isF = a === "can-cook-fish";
        var v1 = ($(isF ? "canFish" : "canFruit1") || {}).value || "";
        var v2 = ($(isF ? "canFruit1" : "canFruit2") || {}).value || "";
        var v3 = ($("canCookDairy") || {}).value || "";
        var vh = +(($("canHours") || {}).value || 0);
        if (isF) { ui.canFish = v1; ui.canFruit1 = v2; } else { ui.canFruit1 = v1; ui.canFruit2 = v2; }
        ui.canCookDairy = v3; ui.canHours = vh;
        var lvl0 = CF.canteen.progress().level;
        var ck = isF ? CF.canteen.cookFish(v1, v2, v3, vh) : CF.canteen.cookVeg(v1, v2, v3, vh);
        if (ck.ok) {
          ui.canNotice = ck.msg;
          if (CF.canteen.progress().level > lvl0) ui.canLevelUp = CF.canteen.progress().level;
          CF.autosave();
        } else ui.canError = ck.msg;
        renderSidebar(); renderPlace(); break;
      }
      case "veg-book": ui.cookBook = "veg"; renderModal(); break;
      case "fish-book": ui.cookBook = "fish"; renderModal(); break;
      case "book-close": ui.cookBook = null; renderModal(); break;
      case "can-help": ui.canHelpOpen = true; renderModal(); break;
      case "can-help-close": ui.canHelpOpen = false; renderModal(); break;
      /* ---- medicine laboratory (room 5) ---- */
      case "go-medmachine": case "go-medpacking": case "go-medwarehouse": {
        ui.place = "house";
        ui.houseView = a === "go-medmachine" ? "medmachine" : a === "go-medpacking" ? "medpacking" : "medwarehouse";
        ui.medNotice = null; ui.medError = null; ui.medErrors = null; ui.medLevelUp = null;
        renderPlace(); break;
      }
      case "med-machine-tab": ui.medMachineTab = el.getAttribute("data-tab");
        ui.medNotice = null; ui.medError = null; ui.medErrors = null; renderPlace(); break;
      case "med-prepare": {
        ui.medNotice = null; ui.medError = null; ui.medErrors = null; ui.medLevelUp = null;
        var mk = ($("medMake") && $("medMake").value) || ui.medMake || "";
        var mq = ($("medMakeQty") && +$("medMakeQty").value) || +ui.medMakeQty || 1;
        ui.medMake = mk; ui.medMakeQty = mq;
        var mr = CF.medicine.prepare(mk, mq);
        if (mr.ok) { ui.medNotice = mr.msg; CF.autosave(); } else ui.medError = mr.msg;
        renderPlace(); break;
      }
      case "med-upgrade": {
        ui.medNotice = null; ui.medError = null; ui.medErrors = null;
        var ur = CF.medicine.upgradeMachine();
        if (ur.ok) { ui.medNotice = ur.msg; CF.autosave(); } else ui.medError = ur.msg;
        renderSidebar(); renderPlace(); break;
      }
      case "med-pack": {
        ui.medNotice = null; ui.medError = null; ui.medErrors = null; ui.medLevelUp = null;
        var before = CF.medicine.progress().level, kr = CF.medicine.packKit();
        if (kr.ok) {
          ui.medNotice = kr.msg;
          if (CF.medicine.progress().level > before) ui.medLevelUp = CF.medicine.progress().level;
          CF.autosave();
        } else ui.medErrors = kr.errors || [kr.msg];
        renderSidebar(); renderPlace(); break;
      }
      case "med-pick": {
        var pick = el.getAttribute("data-what");
        ui.medSell = ui.medSell === pick ? null : pick; ui.medSellQty = null;
        ui.medNotice = null; ui.medError = null; renderPlace(); break;
      }
      case "med-sell": {
        ui.medNotice = null; ui.medError = null;
        var sn = el.getAttribute("data-what"), sq = num("medSellQty", 0);
        var srr = CF.medicine.sell(sn, sq);
        if (srr.ok) { ui.medNotice = srr.msg; ui.medSell = null; ui.medSellQty = null; CF.autosave(); }
        else ui.medError = srr.msg;
        renderSidebar(); renderPlace(); break;
      }
      case "become-gardener": {
        ui.gardenNotice = null; ui.gardenError = null; ui.gardenErrors = null;
        var gr = CF.garden.becomeGardener();
        if (gr.ok) { ui.gardenTab = "edible"; ui.gardenNotice = gr.msg; CF.autosave(); }
        else { ui.gardenErrors = gr.errors || [gr.msg]; ui.gardenTab = "gardener"; }
        renderPlace(); break;
      }
      case "steal-plants": doSteal("plants"); break;
      case "steal-edible": doSteal("edible"); break;
      case "steal-medicinal": doSteal("medicinal"); break;
      case "garden-help": ui.gardenHelpOpen = true; renderModal(); break;
      case "garden-help-close": ui.gardenHelpOpen = false; renderModal(); break;
      case "med-help": ui.medHelpOpen = true; renderModal(); break;
      case "med-help-close": ui.medHelpOpen = false; renderModal(); break;
      case "med-view": ui.medView = el.getAttribute("data-view");
        ui.gardenNotice = null; ui.gardenError = null; renderPlace(); break;
      case "med-cut": {
        var cres = CF.garden.cutMedBed(parseInt(el.getAttribute("data-bed"), 10));
        gardenResult(cres); break;
      }
      /* ---- edible herb garden ---- */
      case "ed-view": ui.edView = el.getAttribute("data-view");
        ui.gardenNotice = null; ui.gardenError = null; ui.gardenLevelUp = null; renderPlace(); break;
      case "ed-sow": {
        var esd = ($("edSeed") && $("edSeed").value) || ui.edSeedSel || "";
        var ecn = $("edCount") ? parseInt($("edCount").value, 10) : parseInt(ui.edCount, 10);
        ui.edSeedSel = esd; if (ecn) ui.edCount = String(ecn);
        gardenResult(CF.garden.sowEdible(esd, ecn || 0)); break;
      }
      case "ed-go": {
        var mode = ($("edAction") && $("edAction").value) || "water";
        if (mode === "remove") { gardenResult(CF.garden.removeDamaged()); break; }
        gardenResult(CF.garden.waterPlots(checkedPlots())); break;
      }
      case "ed-sprinklers": gardenResult(CF.garden.installSprinklers(checkedPlots(".wck"))); break;
      case "ed-help": ui.edHelpOpen = true; renderModal(); break;
      case "ed-help-close": ui.edHelpOpen = false; renderModal(); break;
      case "ed-harvest": gardenResult(CF.garden.harvestPlot(parseInt(el.getAttribute("data-i"), 10))); break;
      case "ed-buy-land": gardenResult(CF.garden.buyLand()); break;
      case "ed-buy-tools": {
        var bought = 0, err = null;
        Array.prototype.forEach.call(document.querySelectorAll(".toolqty"), function (inp) {
          var q = parseInt(inp.value, 10) || 0;
          if (q > 0 && !err) { var r = CF.garden.buyTool(inp.getAttribute("data-tool"), q); if (r.ok) bought += q; else err = r.msg; }
        });
        gardenResult(err ? { ok: false, msg: err } : bought ? { ok: true, msg: "Bought " + bought + " item(s)." }
          : { ok: false, msg: "Enter how many you want to buy." });
        break;
      }
      case "ed-pest": gardenResult(CF.garden.clearPest(el.getAttribute("data-pest"))); break;
      case "med-sow": {
        ui.gardenError = null; ui.gardenNotice = null; ui.gardenPtsMsg = null; ui.gardenBackpackBar = false; ui.gardenLevelUp = null;
        var msd = ($("medSeed") && $("medSeed").value) || ui.medSeedSel || "";
        var mpk = $("medPackets") ? parseInt($("medPackets").value, 10) : parseInt(ui.medPackets, 10);
        var mdu = ($("medDur") && parseInt($("medDur").value, 10)) || parseInt(ui.medDurSel, 10) || 0;
        ui.medSeedSel = msd; if (mpk) ui.medPackets = String(mpk); if (mdu) ui.medDurSel = String(mdu);
        var beforeG = CF.garden.gardenProgress().level;
        var sres2 = CF.garden.sowMedicinal(msd, mpk || 0, mdu);
        if (sres2.ok) {
          ui.gardenNotice = sres2.msg; ui.medView = "beds";
          if (CF.garden.gardenProgress().level !== beforeG) ui.gardenLevelUp = { skill: "Gardening", level: CF.garden.gardenProgress().level };
          CF.autosave();
        } else ui.gardenError = sres2.msg;
        renderPlace(); break;
      }
      case "market-tickets": ui.place = "slum"; ui.slumCounter = null; renderPlace();
        toast("The Greenhouse ticket counter isn't built yet.", "err"); break;
      case "buy-tickets": {
        var tr = CF.garden.buyTickets();
        if (tr.ok) { ui.gardenNotice = tr.msg; CF.autosave(); } else ui.gardenError = tr.msg;
        renderPlace(); break;
      }
      case "todo": toast("“" + el.getAttribute("data-what") + "” isn't built yet.", "err"); break;
      case "tool": ui.place = "tavern"; ui.tool = el.getAttribute("data-tool"); ui.mixError = null; ui.mixLevelUp = null; renderPlace(); break;
      case "calc-open": ui.calcOpen = true; renderModal(); break;
      case "calc-close": ui.calcOpen = false; renderModal(); break;
      case "loc-todo": toast(el.getAttribute("data-loc") + " isn't built yet — only the Tavern exists so far.", "err"); break;
      case "skill": {
        var sk = el.getAttribute("data-skill"), sp = SKILL_PLACE[sk] || {};
        if (sk === "Fame") break;   // hover-only, nowhere to go
        if (sp.act === "go-tavern") {
          ui.place = "tavern"; ui.tool = null; hideSkillPop(); renderPlace();
          toast(sk + " is trained at " + sp.where + ".");
        } else if (sp.act === "house-craft") {
          ui.place = "house"; ui.houseView = "craftcabinet"; hideSkillPop(); renderPlace();
          toast(sk + " is trained at " + sp.where + ".");
        } else if (sp.act === "go-anvil") {
          ui.place = "house"; ui.houseView = "anvil"; hideSkillPop(); renderPlace();
          toast(sk + " is trained at " + sp.where + ".");
        } else if (sp.act === "go-druglab") {
          ui.place = "house"; ui.houseView = "druglab"; hideSkillPop(); renderPlace();
          toast(sk + " is trained at " + sp.where + ".");
        } else if (sp.act === "go-canteen") {
          ui.place = "canteen"; ui.canRoom = null;
          ui.canNotice = null; ui.canError = null; hideSkillPop(); renderPlace();
          toast(sk + " is trained at " + sp.where + ".");
        } else if (sp.act === "go-medpacking") {
          ui.place = "house"; ui.houseView = "medpacking";
          ui.medNotice = null; ui.medError = null; ui.medErrors = null; hideSkillPop(); renderPlace();
          toast(sk + " is trained at " + sp.where + ".");
        } else if (sp.act === "go-garden") {
          ui.place = "garden"; hideSkillPop(); renderPlace();
          toast(sk + " is trained at " + sp.where + ".");
        } else if (sp.act === "go-sports") {
          ui.place = "sports"; if (sp.fac) ui.sportsFac = sp.fac;
          ui.sportNotice = null; ui.sportError = null; hideSkillPop(); renderPlace();
          toast(sk + " is trained at " + sp.where + ".");
        } else {
          toast(sk + " is trained at " + (sp.where || "—") + " — not built yet.", "err");
        }
        break;
      }
      case "toggle": act(CF.tavern.toggleTavern()); break;
      case "buy": act(CF.tavern.buyMaterial($("telMat").value, num("telQty", 0))); break;
      case "press": act(CF.tavern.pressJuice($("j1Mat").value, num("j1Qty", 0))); break;
      case "mix": fastMix(); break;   // in-place update; button stays put for rapid clicking
      case "clear": act(CF.tavern.clearItem(el.getAttribute("data-wh"), el.getAttribute("data-key"))); break;
      case "update-now": doUpdate(true); break;
    }
  }

  function onInput(e) {
    var el = e.target, role = el.getAttribute("data-role"); if (!role) return;
    var v = parseInt(el.value, 10); if (isNaN(v)) v = 0;
    if (role === "telqty") { ui.q.tel = v; var pr = $("telPrice"); if (pr) pr.innerHTML = fmt(v * CF.formulas.materialPrice(CF.state.player.reputation)); }
    else if (role === "bunkstake") {
      /* Update ONLY the "If it wins" cells. Re-rendering the panel would rebuild
       * this very input mid-keystroke, and an <input type="number"> cannot have
       * its caret put back afterwards — selectionStart throws on number inputs,
       * so the caret fell to 0 and "500" came out as "005". */
      ui.bunkStake = el.value;
      var bsel = null, bstk = parseInt(el.value, 10) || 0;
      CF.betting.venues().forEach(function (x) { if (x.id === ui.bunkVenue) bsel = x; });
      if (!bsel) CF.betting.venues().forEach(function (x) { if (!bsel && CF.betting.isOpen(x)) bsel = x; });
      if (bsel) bsel.runners.forEach(function (r, i) {
        var cell = $("bunkPay" + i);
        if (cell) cell.innerHTML = "pays <b>" + fmt(Math.floor(bstk * CF.betting.oddsFor(r))) + "</b>";
      });
    }
    else if (role === "telmat") { ui.telMat = el.value; }
    else if (role === "j1qty") { ui.q.j1 = v; var pv = $("j1Preview"); if (pv) pv.innerHTML = j1PreviewText(); }
    else if (role === "j1mat") { ui.j1Mat = el.value; var pv2 = $("j1Preview"); if (pv2) pv2.innerHTML = j1PreviewText(); }
    else if (role === "mixsel") { ui.mix[ui.tool] = el.value; }
    else if (role === "juicerqty") { ui.juicerQty = el.value; }
    else if (role === "juicerplant") { ui.juicerPlant = el.value; }
    else if (role === "drugqty") { ui.drugQty = el.value; }
    else if (role === "drugnarc") { ui.drugNarc = el.value; }
    else if (role === "drugjuice") { ui.drugJuice = el.value; }
    else if (role === "labsellqty") { ui.labSellQty = el.value; }
    else if (role === "stealplant") { ui.stealPlantSel = el.value; }
    else if (role === "stealedible") { ui.stealEdibleSel = el.value; }
    else if (role === "stealmed") { ui.stealMedSel = el.value; }
    else if (role === "hbhold") { ui.hbHold[+el.getAttribute("data-i")] = el.value; }
    else if (role === "hbmen") { ui.hbMen[el.getAttribute("data-kind")] = el.value; }
    else if (role === "culsel") { ui.culSel = el.value; }
    else if (role === "canliquid") { ui.canLiquid = el.value; }
    else if (role === "canliters") { ui.canLiters = el.value; }
    else if (role === "candairy") { ui.canDairy = el.value; }
    else if (role === "canfish") { ui.canFish = el.value; }
    else if (role === "canfruit1") { ui.canFruit1 = el.value; }
    else if (role === "canfruit2") { ui.canFruit2 = el.value; }
    else if (role === "cancookdairy") { ui.canCookDairy = el.value; }
    else if (role === "canhours") { ui.canHours = el.value; }
    else if (role === "medmake") { ui.medMake = el.value; }
    else if (role === "medmakeqty") { ui.medMakeQty = el.value; }
    else if (role === "medsellqty") { ui.medSellQty = el.value; renderPlace(); }
    else if (role === "medseed") { ui.medSeedSel = el.value; }
    else if (role === "medpackets") { ui.medPackets = el.value; }
    else if (role === "meddur") { ui.medDurSel = el.value; }
    else if (role === "edseed") { ui.edSeedSel = el.value; }
    else if (role === "edcount") { ui.edCount = el.value; }
    else if (role === "streetgrams") { ui.streetGrams = el.value; }
    else if (role === "banksort") { ui.bankSort = el.value; renderPlace(); }
    else if (role === "streetcountry") {
      var nc = el.value;
      if (nc !== ui.streetCountry) {
        var travel = 2500 + Math.floor(Math.random() * 2501);   // travelling costs 2,500–5,000 CC
        if (CF.state.player.money < travel) { ui.streetError = "Not enough money to travel (" + fmt(travel) + " CC)."; }
        else { CF.state.player.money -= travel; ui.streetCountry = nc; ui.streetNotice = "Travelled to " + nc + " for " + fmt(travel) + " CC."; CF.autosave(); }
      }
      renderPlace();
    }
    else if (role === "craftsel") { ui.craftSel = el.value; }
    else if (role === "craftitem") { ui.craftItemSel[ui.houseStation] = el.value; }
    else if (role === "sellqty") {
      ui.finishedQty = el.value;
      var price = CF.craftPrices[ui.finishedSel] || 0, qn = parseFloat(el.value) || 0;
      var t = $("sellTotal"); if (t) t.innerHTML = fmt(qn * price);
    }
    else if (role === "anvilsel") { ui.anvilSel = el.value; var an = $("anvilNeed"); if (an) an.innerHTML = anvilNeedHtml(); }
    else if (role === "anvilqty") { ui.anvilQty = parseInt(el.value, 10) || 1; var an2 = $("anvilNeed"); if (an2) an2.innerHTML = anvilNeedHtml(); }
    else if (role === "weaponqty") {
      ui.weaponQty = el.value;
      var w = CF.weaponByName[ui.weaponSel], wp = w ? CF.blacksmith.sellPrice(w) : 0, wn = parseFloat(el.value) || 0;
      var wt = $("weaponTotal"); if (wt) wt.innerHTML = fmt(wn * wp);
    }
    else if (role === "dbgskill") { ui.dbgSkill = el.value; renderModal(); }
    else if (role === "bwqty") {
      ui.bwQty = el.value;
      var bi = null; CF.blacksmithWarehouse.forEach(function (x) { if (x.name === ui.bwSel) bi = x; });
      var bn = parseFloat(el.value) || 0, bt = $("bwTotal"); if (bt && bi) bt.innerHTML = fmt(bn * (bi.price || 0));
    }
    else if (role === "calc") {
      ui.calc.rep = num("calcRep", 0); ui.calc.drinks = num("calcDrinks", 0); ui.calc.pts = num("calcPts", 0);
      var body = $("calcBody"); if (body) body.innerHTML = calcRows(ui.calc.rep, ui.calc.drinks, ui.calc.pts);
    }
  }

  /* ============================== INIT ================================= */
  function renderAll() { renderTop(); renderWhere(); renderPlace(); renderModal(); }   // renderPlace draws the sidebar

  /* ---- First run ---------------------------------------------------------
   * A brand-new player meets two screens before the game is theirs: a welcome
   * that asks for a name, then the guide on its first page. The game itself
   * sits behind both, blurred and out of reach, so the first thing they see is
   * the real thing rather than a blank page or a wall of menus.
   *
   * `ui.onboarding` spans BOTH steps and is what puts the blur up. Closing the
   * guide is what ends it — that is the moment the game becomes playable. */
  function startOnboarding() {
    ui.onboarding = true;
    ui.welcomeOpen = true; ui.welcomeError = null;
    ui.guideOpen = false; ui.guideId = "basics";
    applyOnboarding();
  }
  function endOnboarding() {
    ui.onboarding = false; applyOnboarding(); CF.autosave();
  }
  function applyOnboarding() {
    document.body.classList.toggle("onboarding", !!ui.onboarding);
    /* `inert` as well as the CSS: pointer-events blocks the mouse but leaves the
     * links behind the blur tabbable, so a new player could Tab into the game
     * and press Enter through it. inert takes the whole subtree out of reach. */
    var g = $("game");
    if (g) { if (ui.onboarding) g.setAttribute("inert", ""); else g.removeAttribute("inert"); }
  }

  function welcomeBody() {
    return '<div class="welcome">' +
      "<p class=\"w-lead\">You are starting with nothing. No house, no trade, and a tavern job you have not " +
      "taken yet. Everything from here you build yourself.</p>" +
      '<div id="welcomeErr">' + noticeHtml({ err: ui.welcomeError, errLabel: "ERROR!" }) + "</div>" +
      "<p class=\"w-ask\">First, what should people call you?</p>" +
      '<div class="nrow"><input type="text" id="welcomeName" maxlength="20" placeholder="Your nickname" autocomplete="off"></div>' +
      '<div class="cbtn"><button class="btn go" data-act="welcome-go">Start &raquo;</button></div>' +
      '<p class="nb">2&ndash;20 characters. You can change it later by clicking your name in the sidebar.</p></div>';
  }

  function init() {
    CF.normalizeRecipes();
    if (!CF.restore()) { CF.newAccount(); startOnboarding(); }

    skillPopEl = document.createElement("div");
    skillPopEl.className = "skillpop"; skillPopEl.style.display = "none";
    document.body.appendChild(skillPopEl);

    renderAll();

    document.addEventListener("click", onClick);
    document.addEventListener("input", onInput);
    document.addEventListener("change", onInput);
    document.addEventListener("mouseover", function (e) {
      var row = e.target.closest ? e.target.closest(".srow[data-skill]") : null;
      if (!row) return;
      var sk = row.getAttribute("data-skill");
      var popHtml = skillPopHTML(sk, row.querySelector(".v").textContent.trim());
      if (!popHtml) { hideSkillPop(); return; }   // derived stats (Fighting) have no panel
      skillPopEl.className = "skillpop" + (sk === "Fame" ? " wide" : "");
      skillPopEl.innerHTML = popHtml;
      skillPopEl.style.display = "block";
      /* rect is in zoomed (screen) coordinates but the popup is itself inside the
       * zoom, so every figure has to come back down by the zoom factor or the
       * panel drifts further off the row the bigger the interface gets. */
      var z = uiZoom(), rect = row.getBoundingClientRect(), h = skillPopEl.offsetHeight;
      var vh = window.innerHeight / z, top = rect.top / z;
      if (top + h > vh - 6) top = Math.max(6, vh - h - 6);
      skillPopEl.style.left = (rect.right / z + 8) + "px"; skillPopEl.style.top = top + "px";
    });
    document.addEventListener("mouseout", function (e) {
      var row = e.target.closest ? e.target.closest(".srow[data-skill]") : null;
      if (!row) return;
      var to = e.relatedTarget;
      if (!to || !(to.closest && to.closest(".srow[data-skill]"))) hideSkillPop();
    });
    // Enter saves the nickname, Escape closes whichever popup is open.
    document.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target && e.target.id === "nickInput") {
        e.preventDefault();
        var b = document.querySelector('[data-act="name-save"]'); if (b) b.click();
      } else if (e.key === "Enter" && e.target && e.target.id === "welcomeName") {
        e.preventDefault();
        var wb = document.querySelector('[data-act="welcome-go"]'); if (wb) wb.click();
      } else if (e.key === "Escape") {
        var x = document.querySelector(".modal-x"); if (x) x.click();
      }
    });
    $("fileInput").addEventListener("change", function (e) {
      var f = e.target.files[0]; if (!f) return;
      CF.loadFromFile(f, function (ok, msg) { toast(msg, ok ? "" : "err"); if (ok) { ui.tool = null; renderAll(); } });
      e.target.value = "";
    });

    setInterval(function () {
      /* Two clocks, both read off the wall clock rather than a counter we
       * started, so they land on :00 for everyone and survive a page reload.
       * The hour pays the update; the 10-minute wave serves the tavern. */
      var hourSlot = CF.clock.slot(), tavSlot = CF.clock.tavernSlot(), redraw = false;
      ui.timer = CF.clock.secondsToNext();
      ui.tavernTimer = CF.clock.tavernSecondsToNext();

      if (hourSlot !== ui.updateSlot) {
        var firstHour = ui.updateSlot == null;
        ui.updateSlot = hourSlot;
        if (!firstHour) { CF.settleUpdates(); redraw = true; }
      }
      if (tavSlot !== ui.tavernSlot) {
        var firstWave = ui.tavernSlot == null;
        ui.tavernSlot = tavSlot;
        // doUpdate redraws everything itself, so it supersedes the hour's redraw
        if (!firstWave) { doUpdate(false); redraw = false; }
      }
      if (redraw) renderPlace();

      var v = $("timerVal"); if (v) v.textContent = mmss(ui.timer);
      var ta = $("timerAt"); if (ta) ta.textContent = hhmm(CF.clock.nextAt());
      var cc = $("custCountdown"); if (cc) cc.textContent = mmss(ui.tavernTimer);
      var dc = $("drinkContinues"); if (dc) dc.textContent = hms(continuesSeconds());
      // live countdowns on the account overview (endurance run, steroid cooldown, box office)
      ["accRun", "accSteroid", "accBox", "accEdible", "accLand", "accMed", "accRefit"].forEach(function (id) {
        var el = $(id); if (el) el.textContent = accCountdown(id);
      });
      // the harbor's refit / trip clocks
      var hr2 = $("hbRefit"); if (hr2) hr2.textContent = hms(CF.harbor.refitLeft());
      var hth = $("hbTripH"), htm = $("hbTripM");
      if (hth) { var tl = CF.harbor.tripLeft();
        hth.textContent = Math.floor(tl / 3600); htm.textContent = Math.floor((tl % 3600) / 60); }
      /* The bunker's race advances a step a second. While it runs only the bars
       * move, so the panel is not rebuilt underneath the player; the finishing
       * step redraws properly to show the result. */
      if (CF.betting.running()) {
        var ended = CF.betting.step();
        if (ended) { CF.autosave(); renderSidebar(); renderPlace(); }
        else if ($("brBar0")) {
          var bpos = CF.betting.positions();
          bpos.forEach(function (p, i) { var b = $("brBar" + i); if (b) b.style.width = p + "%"; });
          var lead = $("bunkLive");
          if (lead) lead.innerHTML = "Leading: <b>" + esc(CF.betting.leader()) + "</b>";
        }
      }
      // the two canteen menu slots count down live
      ["veg", "fish"].forEach(function (k) {
        var m = $("canLeft-" + k);
        if (m) m.textContent = hms(CF.canteen.menuLeft(k));
      });
      var sc = $("sterCd");
      if (sc) { var sl = Math.max(0, 86400000 - (Date.now() - (CF.state.sports.lastSteroidBuy || 0))); sc.textContent = hms(sl / 1000); }
    }, 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
