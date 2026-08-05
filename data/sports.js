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

/* Gym lifts — heavier = more points but worse points-per-energy.
 * ----------------------------------------------------------------------------
 * BOTH THE WEIGHT AND THE PAYOUT SCALE WITH YOUR STRENGTH LEVEL. Two readings
 * of the same five rows, six levels apart, settle it:
 *
 *            Strength 13                 Strength 19
 *   1 energy   8kg = 104 pts             10kg = 152 pts
 *   3 energy  12kg = 260 pts             15kg = 380 pts
 *   6 energy  14kg = 468 pts             18kg = 684 pts
 *   9 energy  18kg = 676 pts             24kg = 988 pts
 *  12 energy  25kg = 832 pts             34kg = 1216 pts
 *
 * POINTS ARE EXACT: every figure is the Strength level times a fixed number per
 * row — 8, 20, 36, 52, 64. All ten values land on it to the digit (13x8=104,
 * 19x8=152, 13x64=832, 19x64=1216), so pointsPerLevel is CONFIRMED.
 *
 * WEIGHT is kg = floor((kgPerLevel*L + kgBase)/6), a line through the readings
 * kept over a common denominator of 6 so it stays in whole numbers.
 *
 * A THIRD READING AT STRENGTH 20 CONFIRMED IT — and corrected the rounding:
 *   observed  10 / 15 / 18 / 25 / 35 kg,  points 160 / 400 / 720 / 1040 / 1280
 * The points were already exact (20 x 8,20,36,52,64). The weights come out as
 * 10.33 / 15.5 / 18.67 / 25 / 35.5, which only match if the fraction is thrown
 * away rather than rounded — rounding gives 16 / 19 / 36 and misses three rows.
 * All fifteen observed weights across levels 13, 19 and 20 now land exactly. */
CF.gymLiftTiers = [
  { id: "l1", energy: 1,  pointsPerLevel: 8,  kgPerLevel: 2, kgBase: 22 },
  { id: "l2", energy: 3,  pointsPerLevel: 20, kgPerLevel: 3, kgBase: 33 },
  { id: "l3", energy: 6,  pointsPerLevel: 36, kgPerLevel: 4, kgBase: 32 },
  { id: "l4", energy: 9,  pointsPerLevel: 52, kgPerLevel: 6, kgBase: 30 },
  { id: "l5", energy: 12, pointsPerLevel: 64, kgPerLevel: 9, kgBase: 33 },
];

/* "a 10kg" but "an 8kg" / "an 18kg" — the article follows how the number is
 * said aloud, which is why the reference reads "Lift an 18kg barbell". */
CF.articleFor = function (n) {
  if (n === 11 || n === 18) return "an";
  if (n === 8 || n === 80 || (n > 80 && n < 90)) return "an";
  return "a";
};

/* Seeded to the reference screenshots. */
/* FRESH ACCOUNT values (reference screenshots): every piece of equipment starts
 * at 200 points/lifts, you own 1 steroid, and NO facility pass — even the Gym
 * has to be bought. Endurance starts at 27 with 16 points to the next level. */
CF.sportsStart = {
  durabilityLevel: 27, durabilityInto: 0,    // "you still need 16 points to level"
  powerLevel: 10, powerInto: 0,
  handEnergy: 120,                           // a new character starts rested
  legEnergy: 120,                            // the stadium keeps its own pool
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
    /* Fall back to the stored durabilityMax, not to the CURRENT max: if the
       level rose before this was ever read (a save loaded straight into a
       higher level, or points awarded before any render), defaulting to the new
       max would silently swallow the gain and leave you looking injured. */
    var known = p.durabilityMaxSeen != null ? p.durabilityMaxSeen
              : (p.durabilityMax || max);
    if (max > known) p.durabilityCur = (p.durabilityCur || 0) + (max - known);
    p.durabilityMaxSeen = max;
    if (p.durabilityCur > max) p.durabilityCur = max;    // never above the bar
    p.durabilityMax = max;                               // kept as a mirror for saves
    return Math.max(0, p.durabilityCur);
  }
  function speed() {
    var lt = S().speedPoints || 0, lv = CF.formulas.levelFromLifetimeXPFor("Speed", lt);
    return { level: lv.level, into: lv.into, lifetime: lt,
             pointsToLevel: Math.max(0, CF.formulas.pointsToNextLevelFor("Speed", lv.level) - lv.into) };
  }
  /* One place to ask "what level is this body stat", live where we train it and
   * static where we do not. The shop's pass requirements and the Slum's gates
   * both look stats up by name, and both used to read the static table only —
   * which quietly froze Speed at 10 however much you ran. */
  function statLevel(name) {
    if (name === "Strength") return power().level;
    if (name === "Endurance") return endurance().level;
    if (name === "Speed") return speed().level;
    return CF.sportsStatic[name] || 0;
  }
  function equip(name) { return S().equipment[name] || 0; }
  function maxHandEnergy() { return CF.ruleset.sports.handEnergyMax; }
  function maxLegEnergy() { return CF.ruleset.speedRun.legEnergyMax; }

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
  /* The five rows as they stand for your CURRENT Strength level. Identified by
   * id, never by label: the label carries the weight, and the weight moves the
   * moment you level up — matching on it would break a lift mid-session. */
  function lifts() {
    var L = power().level;
    return CF.gymLiftTiers.map(function (t) {
      var kg = Math.floor((t.kgPerLevel * L + t.kgBase) / 6);
      return {
        id: t.id, energy: t.energy, kg: kg,
        points: t.pointsPerLevel * L,
        label: "Lift " + CF.articleFor(kg) + " " + kg + "kg barbell",
      };
    });
  }
  function doLift(id) {
    regenEnergy();
    var l = null; lifts().forEach(function (x) { if (x.id === id) l = x; });
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

  /* ---- Stadium: run the 100m for Speed -------------------------------- */
  function kitById(id) {
    var k = null; CF.ruleset.speedRun.kits.forEach(function (x) { if (x.id === id) k = x; });
    return k;
  }
  function runRecord() {
    var r = S().record100m;
    return r != null ? r : CF.ruleset.speedRun.startRecordSec;
  }
  /* A standard normal, Box-Muller. Math.random() can return 0, which would put
   * a zero through the log, so the draw is nudged off the boundary. */
  function gauss() {
    var u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  /* What a kit pays, as a range, for the screen to show before you commit. */
  function kitPayout(kit) {
    var L = speed().level;
    return { mean: Math.round(kit.meanPerLevel * L),
             min: Math.round(kit.minPerLevel * L),
             max: Math.round(kit.maxPerLevel * L) };
  }
  function rollPoints(kit) {
    var L = speed().level, p = kitPayout(kit);
    var pts = Math.round(kit.meanPerLevel * L + gauss() * kit.sdPerLevel * L);
    return Math.max(p.min, Math.min(p.max, pts));
  }
  function run100m(kitId) {
    var r = CF.ruleset.speedRun, kit = kitById(kitId);
    if (!kit) return fail("Choose your equipment.");
    regenEnergy();
    if ((S().legEnergy || 0) < r.energyPerRun)
      return fail("Not enough leg energy (need " + r.energyPerRun + ").");
    if (equip(kit.boots) < kit.wearBoots)
      return fail("Your " + kit.boots.toLowerCase() + " are worn out — buy a new pair.");
    if (equip(kit.suit) < kit.wearSuit)
      return fail("Your " + kit.suit.toLowerCase() + " are worn out — buy a new set.");

    /* Two INDEPENDENT rolls. The time is shown and remembered but never feeds
       the points — see the note in ruleset.speedRun for why. */
    var seconds = r.timeFromSec + Math.random() * (r.timeToSec - r.timeFromSec);
    var pts = rollPoints(kit);

    S().legEnergy -= r.energyPerRun;
    S().equipment[kit.boots] -= kit.wearBoots;
    S().equipment[kit.suit] -= kit.wearSuit;
    S().speedPoints = (S().speedPoints || 0) + pts;

    // your record is your best time, and a run that beats it updates it there and then
    var best = runRecord(), beat = seconds < best;
    if (beat) S().record100m = seconds;

    var res = ok("You ran the 100m in " + seconds.toFixed(5) + " and earned " + fmt(pts) + " speed points.");
    res.seconds = seconds; res.points = pts; res.record = beat;
    return res;
  }
  function eatSteroidLegs() {
    var r = CF.ruleset.speedRun;
    if (equip("Steroids") < 1) return fail("You have no steroids.");
    regenEnergy();
    if ((S().legEnergy || 0) >= maxLegEnergy()) return fail("Your leg energy is already full.");
    S().equipment["Steroids"] -= 1;
    S().legEnergy = Math.min(maxLegEnergy(), (S().legEnergy || 0) + r.steroidEnergy);
    return ok("You ate a steroid and restored " + r.steroidEnergy + " legs of energy.");
  }

  /* ---- Sports shop ---------------------------------------------------- */
  function buy(label) {
    var it = null; CF.sportsShop.forEach(function (x) { if (x.label === label) it = x; });
    if (!it) return fail("Unknown item.");
    if (P().money < it.price) return fail("Not enough money (need " + fmt(it.price) + " CC).");
    if (it.pass) {
      if (S().passes[it.pass]) return fail("You already have that pass.");
      var lvl = statLevel(it.req.stat);
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
    endurance: endurance, power: power, speed: speed, statLevel: statLevel,
    equip: equip, access: access,
    enduranceMax: enduranceMax, enduranceCur: enduranceCur,
    regenEnergy: regenEnergy, maxHandEnergy: maxHandEnergy, maxLegEnergy: maxLegEnergy,
    run100m: run100m, eatSteroidLegs: eatSteroidLegs, runRecord: runRecord,
    kitPayout: kitPayout, kitById: kitById,
    runState: runState, runSecondsLeft: runSecondsLeft, settleRun: settleRun,
    startRun: startRun, pauseRun: pauseRun,
    lifts: lifts, doLift: doLift, eatSteroid: eatSteroid, buy: buy,
  };
})();

/* Static body stats we don't train yet. Speed has LEFT this table — it is
 * trained at the Stadium now; ask CF.sports.speed() or CF.sports.statLevel(). */
CF.sportsStatic = { "Dexterity": 10, "Defence": 10 };
/* Speed's starting level, seeded into speedPoints for a new account. */
CF.speedStartLevel = 10;
