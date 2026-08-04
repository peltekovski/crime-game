/* ============================================================================
 * sports.js — The Sports complex: five facilities that train the body stats.
 * ----------------------------------------------------------------------------
 *   Forest Trail  -> Endurance, by REAL-TIME running (pick a duration, wait)
 *   Gym           -> Strength, by lifting (spends Hand energy, +5/hour)
 *   Sports shop   -> equipment (wears out, adds "duration" points), steroids, passes
 *   Boxing Hall   -> Dexterity/Defence — needs a purchased pass (Speed 15+)
 *   Stadium       -> Speed — needs a purchased ticket (Strength 20+)
 * Equipment is CONSUMED by training: running spends boots, lifting spends lifts.
 * ========================================================================== */
window.CF = window.CF || {};

/* The five facilities, in reference order. `access` is computed at render time. */
CF.sportsFacilities = [
  { id: "gym",     name: "Gym",                 trains: "Strength" },
  { id: "shop",    name: "Sports shop",         trains: null },
  { id: "boxing",  name: "Boxing Hall",         trains: "Dexterity" },
  { id: "stadium", name: "Stadium",             trains: "Speed" },
  { id: "trail",   name: "Forest Trail",        trains: "Endurance" },
];

/* Equipment shelf (the "Equipment / Duration" panel). unit = what it's counted in. */
CF.sportsEquipment = [
  { name: "Running boots",    unit: "points" },
  { name: "Racing boots",     unit: "points" },
  { name: "Tracksuits",       unit: "points" },
  { name: "Competition suits",unit: "points" },
  { name: "Lifting belt",     unit: "lifts" },
  { name: "Wristbands",       unit: "lifts" },
  { name: "Handcuffs",        unit: "points" },
  { name: "Boxing gloves",    unit: "points" },
  { name: "Steroids",         unit: "tablets" },
];

/* Sports shop stock (prices in CC = Money). `adds` tops up that item's duration. */
CF.sportsShop = [
  { label: "Running Boots",     item: "Running boots",     adds: 200, price: 55000 },
  { label: "Racing boots",      item: "Racing boots",      adds: 20,  price: 600000 },
  { label: "Tracksuits",        item: "Tracksuits",        adds: 200, price: 70000 },
  { label: "Competition suits", item: "Competition suits", adds: 20,  price: 800000 },
  { label: "Lifting belt",      item: "Lifting belt",      adds: 20,  price: 350000 },
  { label: "Wristbands",        item: "Wristbands",        adds: 20,  price: 300000 },
  { label: "Handcuffs",         item: "Handcuffs",         adds: 20,  price: 750000 },
  { label: "Boxing gloves",     item: "Boxing gloves",     adds: 20,  price: 850000 },
  { label: "5 steroids",        item: "Steroids",          adds: 5,   price: 30000000, note: "1 per day", oncePerDay: true },
  { label: "ENTER Gym",         pass: "gym",     price: 250000,  req: { stat: "Endurance", level: 30 } },
  { label: "ENTER Stadium",     pass: "stadium", price: 650000,  req: { stat: "Strength", level: 20 } },
  { label: "ENTER Boxing Hall", pass: "boxing",  price: 2500000, req: { stat: "Speed", level: 15 } },
];

/* Forest Trail running options — hours, stamina points, boots spent (observed). */
CF.runningOptions = [
  { hours: 1,  points: 6,  boots: 10 },
  { hours: 2,  points: 10, boots: 20 },
  { hours: 4,  points: 18, boots: 40 },
  { hours: 6,  points: 24, boots: 60 },
  { hours: 8,  points: 30, boots: 80 },
  { hours: 10, points: 33, boots: 100 },
  { hours: 12, points: 37, boots: 120 },
  { hours: 24, points: 50, boots: 240 },
];

/* Gym lifts — heavier = more points but worse points-per-energy (observed). */
CF.gymLifts = [
  { label: "Lift an 8kg barbell",  energy: 1,  points: 104 },
  { label: "Lift a 12kg barbell",  energy: 3,  points: 260 },
  { label: "Lift a 14kg barbell",  energy: 6,  points: 468 },
  { label: "Lift an 18kg barbell", energy: 9,  points: 676 },
  { label: "Lift a 25kg barbell",  energy: 12, points: 832 },
];

/* Seeded to the reference screenshots. */
/* FRESH ACCOUNT values (reference screenshots): every piece of equipment starts
 * at 200 points/lifts, you own 1 steroid, and NO facility pass — even the Gym
 * has to be bought. Endurance starts at 27 with 16 points to the next level. */
CF.sportsStart = {
  durabilityLevel: 27, durabilityInto: 0,    // "you still need 16 points to level"
  powerLevel: 10, powerInto: 0,
  handEnergy: 120,                           // a new character starts rested
  equipment: { "Running boots": 200, "Racing boots": 200, "Tracksuits": 200, "Competition suits": 200,
               "Lifting belt": 200, "Wristbands": 200, "Handcuffs": 200, "Boxing gloves": 200, "Steroids": 1 },
  passes: { gym: false, stadium: false, boxing: false },
};

CF.sports = (function () {
  function P() { return CF.state.player; }
  function S() { return CF.state.sports; }
  var ok = function (m) { return { ok: true, msg: m }; };
  var fail = function (m) { return { ok: false, msg: m }; };

  function endurance() {
    var lt = S().durabilityPoints || 0, lv = CF.formulas.levelFromLifetimeXPFor("Endurance", lt);
    return { level: lv.level, into: lv.into, lifetime: lt,
             pointsToLevel: Math.max(0, CF.formulas.pointsToNextLevelFor("Endurance", lv.level) - lv.into) };
  }
  function power() {
    var lt = S().powerPoints || 0, lv = CF.formulas.levelFromLifetimeXPFor("Strength", lt);
    return { level: lv.level, into: lv.into, lifetime: lt,
             pointsToLevel: Math.max(0, CF.formulas.pointsToNextLevelFor("Strength", lv.level) - lv.into) };
  }
  /* THE ENDURANCE POOL. One source of truth: the bar's size IS the Endurance
   * skill level (the reference shows "Durability : 0 / 45" for a level-45
   * character), and what is left in it is player.durabilityCur.
   *
   * These used to drift apart. `durabilityMax` was a number stored once at
   * account creation and never touched again, so training Endurance raised the
   * level without growing the bar, and anything that wrote durabilityCur
   * directly could leave it ABOVE the max — which made sewer fights unloseable
   * while the sidebar (which showed the level twice) looked perfectly normal.
   * Deriving the max removes that whole class of drift. */
  function enduranceMax() { return Math.max(1, endurance().level); }
  function enduranceCur() {
    var p = P(), max = enduranceMax();
    if (p.durabilityCur == null) p.durabilityCur = max;
    /* LEVELLING UP GROWS THE BAR AND FILLS THE NEW ROOM. Training endurance
     * from 27 to 31 used to leave you at 27/31 — the bar got bigger but what
     * was in it did not, so a character who had done nothing but train came out
     * of it "injured" and was sent to the hospital. Whatever the bar gains,
     * you gain: 27/27 becomes 31/31, and a genuine injury (say 12/27) still
     * reads as an injury afterwards (16/31). */
    var known = p.durabilityMaxSeen == null ? max : p.durabilityMaxSeen;
    if (max > known) p.durabilityCur = (p.durabilityCur || 0) + (max - known);
    p.durabilityMaxSeen = max;
    if (p.durabilityCur > max) p.durabilityCur = max;    // never above the bar
    p.durabilityMax = max;                               // kept as a mirror for saves
    return Math.max(0, p.durabilityCur);
  }
  function equip(name) { return S().equipment[name] || 0; }
  function maxHandEnergy() { return CF.ruleset.sports.handEnergyMax; }

  /* Hand energy arrives WITH THE UPDATE, not as a trickle: +5 lands on the hour
   * along with everything else the update pays. CF.settleUpdates owns that (it
   * pays the gear bars in the same pass); this stays as the name the sports
   * screens already call. */
  function regenEnergy() { CF.settleUpdates(); }

  /* Access per facility: shop/gym/trail are always open; the other two need a pass. */
  function access(id) {
    if (id === "gym") return S().passes.gym ? "ON" : "NO";
    if (id === "boxing") return S().passes.boxing ? "ON" : "NO";
    if (id === "stadium") return S().passes.stadium ? "ON" : "NO";
    return "ON";   // Sports shop + Forest Trail are always open
  }

  /* ---- Forest Trail: real-time endurance running ---------------------- */
  function runState() { return S().run || null; }
  function runSecondsLeft() { var r = runState(); return r ? Math.max(0, Math.round((r.endsAt - Date.now()) / 1000)) : 0; }
  /* Finish a run whose timer has elapsed (called on every render). */
  function settleRun() {
    var r = runState();
    if (!r || Date.now() < r.endsAt) return null;
    S().durabilityPoints = (S().durabilityPoints || 0) + r.points;
    S().run = null;
    return r;
  }
  function startRun(hours, useSteroids) {
    if (runState()) return fail("You are already training.");
    var opt = null; CF.runningOptions.forEach(function (o) { if (o.hours === hours) opt = o; });
    if (!opt) return fail("Choose a running time.");
    if (equip("Running boots") < opt.boots) return fail("Not enough running boots (need " + fmt(opt.boots) + " points).");
    if (useSteroids && equip("Steroids") < 1) return fail("You have no steroids.");
    S().equipment["Running boots"] -= opt.boots;
    var pts = opt.points;
    if (useSteroids) { S().equipment["Steroids"] -= 1; pts *= CF.ruleset.sports.steroidMultiplier; }
    /* The hours are UPDATES, not a stopwatch: a 1-hour run started at 16:30
     * finishes at the 17:00 update, a 2-hour one at 18:00. So the first hour is
     * short by however far into the current hour you set off. */
    S().run = { endsAt: CF.clock.slotsAhead(hours), hours: hours, points: pts, steroids: !!useSteroids };
    return ok("You started endurance training.");
  }
  /* Pause = abandon. Equipment and steroids are NOT refunded (per the reference). */
  function pauseRun() {
    if (!runState()) return fail("You are not training.");
    S().run = null;
    return ok("Workout stopped. Steroids and equipment are not compensated.");
  }

  /* ---- Gym: spend hand energy on a lift ------------------------------- */
  function doLift(label) {
    regenEnergy();
    var l = null; CF.gymLifts.forEach(function (x) { if (x.label === label) l = x; });
    if (!l) return fail("Choose a lift.");
    if ((S().handEnergy || 0) < l.energy) return fail("Not enough hand energy (need " + l.energy + ").");
    // a lift wears BOTH the lifting belt and the wristbands by one lift each
    if (equip("Lifting belt") < 1) return fail("Your lifting belt is worn out — buy a new one.");
    if (equip("Wristbands") < 1) return fail("Your wristbands are worn out — buy new ones.");
    S().handEnergy -= l.energy;
    S().equipment["Lifting belt"] -= 1;
    S().equipment["Wristbands"] -= 1;
    S().powerPoints = (S().powerPoints || 0) + l.points;
    var r = ok("You lifted and earned " + fmt(l.points) + " strength points.");
    r.pts = l.points; return r;
  }
  function eatSteroid() {
    if (equip("Steroids") < 1) return fail("You have no steroids.");
    regenEnergy();
    if ((S().handEnergy || 0) >= maxHandEnergy()) return fail("Your hand energy is already full.");
    S().equipment["Steroids"] -= 1;
    S().handEnergy = Math.min(maxHandEnergy(), S().handEnergy + CF.ruleset.sports.steroidEnergy);
    return ok("You ate a steroid and restored " + CF.ruleset.sports.steroidEnergy + " arm energy.");
  }

  /* ---- Sports shop ---------------------------------------------------- */
  function buy(label) {
    var it = null; CF.sportsShop.forEach(function (x) { if (x.label === label) it = x; });
    if (!it) return fail("Unknown item.");
    if (P().money < it.price) return fail("Not enough money (need " + fmt(it.price) + " CC).");
    if (it.pass) {
      if (S().passes[it.pass]) return fail("You already have that pass.");
      var lvl = it.req.stat === "Strength" ? power().level
              : it.req.stat === "Endurance" ? endurance().level
              : (CF.sportsStatic[it.req.stat] || 0);
      if (lvl < it.req.level) return fail("Requires " + it.req.stat + " " + it.req.level + "+ (you are " + lvl + ").");
      P().money -= it.price; S().passes[it.pass] = true;
      return ok("You bought the " + (it.pass === "boxing" ? "Boxing Hall pass" : "Stadium ticket") + ".");
    }
    if (it.oncePerDay) {
      var last = S().lastSteroidBuy || 0;
      if (Date.now() - last < 86400000) return fail("Steroids can only be bought once per day.");
      S().lastSteroidBuy = Date.now();
    }
    P().money -= it.price;
    S().equipment[it.item] = (S().equipment[it.item] || 0) + it.adds;
    return ok(it.oncePerDay ? "You bought 5 steroids." : "You bought " + it.label + ".");
  }

  return {
    endurance: endurance, power: power, equip: equip, access: access,
    enduranceMax: enduranceMax, enduranceCur: enduranceCur,
    regenEnergy: regenEnergy, maxHandEnergy: maxHandEnergy,
    runState: runState, runSecondsLeft: runSecondsLeft, settleRun: settleRun,
    startRun: startRun, pauseRun: pauseRun,
    doLift: doLift, eatSteroid: eatSteroid, buy: buy,
  };
})();

/* Static body stats we don't train yet (their facilities are locked). */
CF.sportsStatic = { "Speed": 10, "Dexterity": 10, "Defence": 10 };
