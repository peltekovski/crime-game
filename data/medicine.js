/* ============================================================================
 * medicine.js — room 5, the MEDICINE LABORATORY.
 * ----------------------------------------------------------------------------
 * The consumer end of the Botanical garden's medicinal beds:
 *   medicinal herbs -> Medicine Machine -> medicines -> Packing table -> kits
 * Medicines are sold for cash at the Laboratory warehouse. The reference also
 * offers "put it on the market" and a credits sale — both LEFT OUT per the user.
 *
 * NAMES: the reference's machine translation mangles three of these — "Roller
 * conveyor" is a Rolled bandage, "Emphasis"/"Pressure Links" is a Pressure
 * bandage, and "Split" is a Splint. Real names used throughout, per the
 * standing terminology rule.
 * ========================================================================== */
window.CF = window.CF || {};

/* Recipes in the reference's own dropdown order. `plant` names match
 * CF.gardenMedicinalSeeds exactly, so the beds feed straight in.
 * (The reference writes "Calendula plant" and "Willowherb" where our official
 * plant list says Marigold and Willow — same plants, list wins. The medicine
 * names stay Calendula ointment / Aspirin, which is what they are called.) */
CF.medicineRecipes = [
  { name: "Rolled bandage",     plant: "Flax",         qty: 1 },
  { name: "Patch",              plant: "Flax",         qty: 1 },
  { name: "Wound swab",         plant: "Cotton",       qty: 1 },
  { name: "Pressure bandage",   plant: "Cotton",       qty: 1 },
  { name: "Thread",             plant: "Flax",         qty: 5 },
  { name: "Calendula ointment", plant: "Marigold",     qty: 30 },
  { name: "Morphine",           plant: "Poppy",        qty: 50 },
  { name: "Rosehip tablet",     plant: "Rosehip",      qty: 10 },
  { name: "Chamomile ointment", plant: "Chamomile",    qty: 20 },
  { name: "Mouse Ear tablet",   plant: "Mouse Ear",    qty: 20 },
  { name: "Splint",             plant: "Bamboo",       qty: 10 },
  { name: "Aloe ointment",      plant: "Aloe",         qty: 10 },
  { name: "Tea tree oil",       plant: "Tea tree",     qty: 25 },
  { name: "Mouse Ear ointment", plant: "Mouse Ear",    qty: 20 },
  { name: "Aspirin",            plant: "Willow",       qty: 20 },
  { name: "Antivenom",          plant: "Milk Nettle",  qty: 10 },
  { name: "Neck splint",        plant: "Bamboo",       qty: 15 },
  { name: "Cancer medicine",    plant: "Blood Orange", qty: 5 },
];

/* A first aid kit takes ALL of these, one each (user: "packing table requires
 * all the resources listed on the side"). The last two are HANDICRAFT items and
 * come from the Crafts room, not from here. */
CF.firstAidKit = {
  medicines: ["Rolled bandage", "Patch", "Wound swab", "Pressure bandage"],
  handicrafts: ["Syringe", "Pack of Syringe Needles"],
  perKit: 1,
  // No `points` here on purpose — the reward is level-scaled, so it lives in
  // CF.medicine.kitPoints(). 22 is merely what level 1 happens to pay.
};

/* Medicine machine levels. Level 1 makes one at a time; each upgrade adds one.
 * ONLY the level-2 row is observed ("Level 20 Medical Science / Level 6 House /
 * 1,000,000 CC / Prepares up to 2 medications at once") — the rest extends that
 * anchor: Medical science 20 x (n-1), house 4 + n, price x3 a level (the same
 * ratio the house itself uses). Capped at 10 because house maxes at 14. */
CF.medicineMachines = (function () {
  var out = [{ level: 1, batch: 1 }];
  for (var n = 2; n <= 10; n++) {
    out.push({ level: n, batch: n, reqMedical: 20 * (n - 1), reqHouse: 4 + n,
               priceCC: Math.round(1000000 * Math.pow(3, n - 2)) });
  }
  return out;
})();

CF.medicine = (function () {
  function P() { return CF.state.player; }
  function M() { return CF.state.medicine; }
  var ok = function (m, x) { var r = { ok: true, msg: m }; if (x) for (var k in x) r[k] = x[k]; return r; };
  var fail = function (m) { return { ok: false, msg: m }; };
  function n2(n) { return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  function recipe(name) {
    var r = null; CF.medicineRecipes.forEach(function (x) { if (x.name === name) r = x; });
    return r;
  }
  /* Medicinal herbs live in the garden's harvest store — the beds fill it. */
  function herbs() { return CF.state.garden.medicinalHarvest || (CF.state.garden.medicinalHarvest = {}); }
  function herbCount(plant) { return herbs()[plant] || 0; }
  function plantLevel(plant) {
    var l = 1; CF.gardenMedicinalSeeds.forEach(function (s) { if (s.name === plant) l = s.lvl; });
    return l;
  }
  function stock() { return M().medicines || (M().medicines = {}); }
  function count(name) { return stock()[name] || 0; }
  /* Crafted goods (Syringe, needle packs) sit in the Crafts room's cabinet. */
  function craftCount(name) { return (CF.state.craft.made || {})[name] || 0; }

  /* Sale price. ONLY ONE reading exists — Rolled bandage and Patch, both 1 x a
   * level-1 plant, at 1,141 CC each — so this scales that anchor by the herbs a
   * medicine eats and how deep in the plant list they are. OUR tuning. */
  function price(name) {
    var r = recipe(name);
    if (!r) return 0;
    return CF.ruleset.medicine.priceUnit * r.qty * plantLevel(r.plant);
  }

  /* ---- Medical science skill ------------------------------------------- */
  function progress() {
    var lifetime = M().points || 0, lv = CF.formulas.levelFromLifetimeXPFor("Medical science", lifetime);
    return { level: lv.level, lifetime: lifetime, into: lv.into,
             pointsToLevel: Math.max(0, CF.formulas.pointsToNextLevelFor("Medical science", lv.level) - lv.into) };
  }

  /* ---- Medicine machine ------------------------------------------------- */
  function machineLevel() { return M().machineLevel || 1; }
  function machine(lvl) {
    var m = null; CF.medicineMachines.forEach(function (x) { if (x.level === (lvl || machineLevel())) m = x; });
    return m;
  }
  function batchMax() { var m = machine(); return m ? m.batch : 1; }
  function nextMachine() { return machine(machineLevel() + 1); }
  /* Every unmet upgrade requirement, so the panel can show them all. */
  function upgradeBlockers() {
    var nx = nextMachine(), out = [];
    if (!nx) return ["The medicine machine is already at its highest level."];
    if (progress().level < nx.reqMedical) out.push("Level " + nx.reqMedical + " Medical Science");
    if ((P().houseLevel || 0) < nx.reqHouse) out.push("Level " + nx.reqHouse + " House");
    if (P().money < nx.priceCC) out.push(nx.priceCC + " CC");
    return out;
  }
  function upgradeMachine() {
    var nx = nextMachine();
    if (!nx) return fail("The medicine machine is already at its highest level.");
    if (progress().level < nx.reqMedical) return fail("You need Medical Science level " + nx.reqMedical + ".");
    if ((P().houseLevel || 0) < nx.reqHouse) return fail("Your house must be at least level " + nx.reqHouse + ".");
    if (P().money < nx.priceCC) return fail("You don't have enough cash (" + n2(nx.priceCC - P().money) + " CC missing)!");
    P().money -= nx.priceCC;
    M().machineLevel = nx.level;
    return ok("You improved the medicine machine to level " + nx.level + " — it now prepares up to " + nx.batch + " medications at once.");
  }

  /* Make N of a medicine. Each one eats `qty` of its plant. */
  function prepare(name, n) {
    var r = recipe(name);
    if (!r) return fail("Choose which medicine to make.");
    n = Math.floor(n);
    if (!(n > 0)) return fail("Choose how many medicines to prepare.");
    if (n > batchMax()) return fail("Your medicine machine prepares up to " + batchMax() + " at once.");
    var need = r.qty * n;
    if (herbCount(r.plant) < need)
      return fail('You must have ' + n2(need) + '+ " ' + r.plant + ' Plant " plants to make the desired amount of medicine!');
    herbs()[r.plant] -= need;
    if (herbs()[r.plant] <= 0) delete herbs()[r.plant];
    stock()[name] = count(name) + n;
    return ok("You prepared " + n2(n) + " " + name + (n === 1 ? "" : "s") + ".");
  }

  /* ---- Packing table ---------------------------------------------------- */
  var K = CF.firstAidKit;
  /* One ERROR per missing ingredient, matching the reference's stacked rows. */
  function kitBlockers() {
    var out = [];
    K.medicines.forEach(function (m) { if (count(m) < K.perKit) out.push("You're out of " + m + " !"); });
    K.handicrafts.forEach(function (h) { if (craftCount(h) < K.perKit) out.push("You're out of " + h + " !"); });
    return out;
  }
  function kits() { return M().kits || 0; }
  /* Points one kit pays at a given level (default: the level you are on now).
   * The reward grows with the skill it feeds, so a late-game packer earns four
   * times what the level-1 table quotes. Derivation + the readings this
   * reproduces are in ruleset.medicine. */
  function kitPoints(level) {
    var m = CF.ruleset.medicine;
    if (level == null) level = progress().level;
    return Math.round(m.kitPointsBase * Math.pow(m.kitPointsRatio, level));
  }
  function packKit() {
    var bad = kitBlockers();
    if (bad.length) { var f = fail(bad[0]); f.errors = bad; return f; }
    K.medicines.forEach(function (m) {
      stock()[m] -= K.perKit;
      if (stock()[m] <= 0) delete stock()[m];
    });
    K.handicrafts.forEach(function (h) { CF.state.craft.made[h] -= K.perKit; });
    M().kits = kits() + 1;
    // Rate is read BEFORE the award, so a kit that levels you up still pays the
    // level it was packed at — the next one gets the new rate.
    var pts = kitPoints();
    M().points = (M().points || 0) + pts;
    var r = ok("You packed a first aid kit and earned " + pts + " medical science points!");
    r.pts = pts; return r;
  }

  /* ---- Laboratory warehouse -------------------------------------------- */
  function sell(name, n) {
    n = Math.floor(n);
    if (!(n > 0)) return fail("Enter how many to sell.");
    if (count(name) < n) return fail("You only have " + n2(count(name)) + " " + name + ".");
    var got = price(name) * n;
    stock()[name] -= n;
    if (stock()[name] <= 0) delete stock()[name];
    P().money += got;
    return ok("You sold " + n2(n) + " " + name + (n === 1 ? "" : "s") + " for " + n2(got) + " CC.");
  }

  return {
    recipe: recipe, recipes: function () { return CF.medicineRecipes; },
    herbs: herbs, herbCount: herbCount, plantLevel: plantLevel,
    stock: stock, count: count, craftCount: craftCount, price: price,
    progress: progress, machineLevel: machineLevel, machine: machine, batchMax: batchMax,
    nextMachine: nextMachine, upgradeBlockers: upgradeBlockers, upgradeMachine: upgradeMachine,
    prepare: prepare, kitBlockers: kitBlockers, kits: kits, kitPoints: kitPoints,
    packKit: packKit, sell: sell,
  };
})();
