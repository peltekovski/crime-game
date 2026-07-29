/* ============================================================================
 * state.js — the game-state object + recipe normalization + save/load.
 * ----------------------------------------------------------------------------
 * Save/load matches the family-tree project: a manual Save button exports a
 * JSON file, Load imports one. No server, portable by copying the folder.
 * A best-effort localStorage autosave keeps a page refresh from losing state
 * (file:// localStorage can be flaky, so it is a convenience, not the source
 * of truth — the JSON file is).
 * ========================================================================== */
window.CF = window.CF || {};

CF.SAVE_VERSION = 9;
CF.LS_KEY = "crimeFactorySave.v9";

/* Normalize the compact recipe rows into the brief's full schema, in place:
 *   r.station, r.unlockLevel, r.price_CC, r.ingredients:[{item, qty}]        */
CF.normalizeRecipes = function () {
  CF.recipes.forEach(function (r) {
    r.station = r.s;
    r.unlockLevel = r.lvl;
    r.ingredients = r.ing.map(function (item) {
      return { item: item, qty: CF.ruleset.ingredientQtyDefault };
    });
    r.price_CC = CF.graph.priceCC(r);
    r.inputCost_CC = CF.graph.inputCostCC(r);
  });
};

/* Spread a total quantity across a list of keys (Water gets a heavier share
 * for materials). Used to fill a shared-capacity warehouse to ~fillFraction. */
function spreadFill(keys, total, heavyKey) {
  var out = {};
  keys.forEach(function (k) { out[k] = 0; });
  if (total <= 0 || keys.length === 0) return out;
  var per = Math.floor(total / keys.length);
  keys.forEach(function (k) { out[k] = per; });
  var used = per * keys.length;
  if (heavyKey && out[heavyKey] != null) out[heavyKey] += (total - used);
  else out[keys[0]] += (total - used);
  return out;
}

/* Plants the late-game garden so the edible/medicinal loops have something to
 * look at the moment you load the profile: a mix of freshly-sown, half-grown,
 * thirsty and ready plants, plus beds at three different stages. */
CF.seedLateGarden = function (s) {
  var g = CF.ruleset.garden, G = s.garden, now = Date.now(), H = 3600000;
  ["Potato", "Cabbage", "Carrot", "Strawberry", "Cherry tree", "Ice cabbage"].forEach(function (n) {
    G.edibleSeeds[n] = 12;
  });
  ["Flax", "Marigold", "Rosehip", "Chamomile", "Mouse Ear"].forEach(function (n) {
    G.medicinalSeeds[n] = 8;
  });
  G.isGardener = true;                           // house 9 + tavern owned
  G.landM2 = 6;                                  // 12 plant slots
  G.landBuyAt = now + 29 * H;                    // mid-cooldown, like the reference
  G.tools["Automatic watering can"] = 2;
  G.pests.caterpillars = 1;

  // [seed name, level, hours already grown, hours since last watered, waterer?]
  [["Potato", 1, 0.5, 0, false], ["Cabbage", 3, 12, 8, false], ["Carrot", 5, 31, 26, false],
   ["Strawberry", 8, 58, 3, true], ["Cherry tree", 9, 74, 40, false], ["Potato", 1, 75.5, 1, false],
   ["Ice cabbage", 11, 20, 55, false]].forEach(function (r) {
    G.plots.push({ plant: r[0], level: r[1],
      endsAt: now + (g.edibleGrowHours - r[2]) * H,
      moisture: Math.max(0, g.moistureMax - Math.floor(r[3]) * g.moistureDecayPerHour),
      wateredAt: now - r[3] * H, pestAt: now, autoWater: r[4] });
  });
  // beds: one nearly done, one mid-run, one just cut short — 3 is the maximum
  [["Marigold", 3, 24, 150, 3.1], ["Chamomile", 6, 8, 80, 7.2], ["Flax", 1, 2, 40, 2]].forEach(function (r) {
    G.medBeds.push({ plant: r[0], level: r[1], hours: r[2], plants: r[3], points: 1,
                     endsAt: now + (r[2] - r[4]) * H });
  });
  return G;
};

/* The user's LATE-GAME profile, kept for testing the systems that need high
 * levels/fame (drug belts, anvil upgrade, high-level recipes). Built on top of
 * a fresh state so nothing has to be duplicated. */
CF.loadLateGame = function () {
  CF.resetToTestDefaults();
  var s = CF.state, p = s.player, f = CF.formulas;
  p.money = 50000000; p.bank = 750000000; p.tokens = 1000; p.fame = 167599;
  p.houseLevel = 9; p.tavernJobAccepted = true; p.tavernOwned = true;
  p.reputation = 143792; p.cooking = 2; p.fighting = 13.83;
  p.drinkMasterLevel = 84; p.dmLifetime = f.xpToReachLevel(84); p.drinkMasterPoints = 0;
  p.durabilityCur = 38; p.durabilityMax = 38;
  s.craft.points = f.xpToReachLevel(82);
  s.blacksmith.forgingPoints = f.xpToReachLevel(60);
  s.blacksmith.anvilLevel = 4;
  s.chemist.points = f.xpToReachLevel(29);
  s.chemist.beltCapacity = 84;
  s.garden.stealPoints = f.xpToReachLevelFor("Stealing", 5);
  // the real account is Gardening 1; raised here so the seed range is testable
  s.garden.gardenPoints = f.xpToReachLevelFor("Gardening", 12);
  s.garden.tickets = 27;
  CF.seedLateGarden(s);
  s.sports.durabilityPoints = f.xpToReachLevelFor("Durability", 38);
  s.sports.powerPoints = f.xpToReachLevelFor("Power", 13);
  s.sports.passes = { gym: true, stadium: false, boxing: false };
  // canteen: Cooking 2 with the reference's 1,000 points into it, plus enough
  // dairy and fish to work both cooking tables (the Harbor isn't built yet)
  s.canteen.cookPoints = f.xpToReachLevelFor("Cooking", 2) + 1000;
  s.canteen.dairy = { "Raw milk": 100, "Water": 100, "Butter": 100, "Milk": 40 };
  s.canteen.fish = { "Baltic herring": 60 };   // its dish is level 2, like Cooking
  s.harbor.owned = true;                       // the boat is already bought
  // stock the warehouses so the tavern loop is immediately usable
  CF.materials.forEach(function (m) { s.inv.materials[m] = 5000; });
  CF.rawJuices.forEach(function (j) { s.inv.rawJuice[j] = 2000; });
  CF.craftMaterialOrder.forEach(function (k) { s.craft.supplies[k] = 5000; });
  CF.autosave();
  return s;
};

/* Botanical-garden slice. Stealing/Gardening are stored as LIFETIME points, so
 * the observed "level + XP into it" seeds are converted through their curves. */
CF.newGardenState = function () {
  var g = CF.gardenStart, f = CF.formulas;
  return {
    tickets: g.tickets,
    stealPoints: f.xpToReachLevelFor("Stealing", g.stealLevel) + g.stealInto,
    gardenPoints: f.xpToReachLevelFor("Gardening", g.gardenLevel) + g.gardenInto,
    isGardener: false,                        // claimed at "[Become a gardener]"
    edibleSeeds: {}, medicinalSeeds: {},
    medBeds: [], medicinalHarvest: {},        // sown beds + what's been harvested
    plots: [], harvest: {},                   // edible garden plots + harvested fruit
    tools: {}, pests: { caterpillars: 0, birds: 0, moles: 0 },
    landBuyAt: 0, wateredThisHour: 0, waterHourSlot: -1,
    ticketReopenAt: Date.now() + g.ticketOfficeClosedForSec * 1000,
    landM2: g.landM2, landType: g.landType,
  };
};

/* Medicine-lab slice. The HERBS are not here — they stay in the garden's
 * medicinalHarvest, which the beds fill; this holds what the lab makes. */
CF.newMedicineState = function () {
  return { points: 0, machineLevel: 1, medicines: {}, kits: 0 };
};

/* Canteen slice (tavern 2nd floor). FRUIT is not here — a harvested plant goes
 * straight to the canteen's fruit warehouse, which is `garden.harvest`. */
CF.newCanteenState = function () {
  return { reputation: 0, dairy: {}, fish: {}, cookPoints: 0, menu: { veg: null, fish: null } };
};

/* Harbor slice — the boat, its two crews, and whatever it's currently doing.
 * The CATCH is not here: it lands in the canteen's fish warehouse. */
CF.newHarborState = function () {
  return { owned: false,                       // bought from the old fisherman
           ship: { equipment: 1, cargo: 1, engineR: 1, engineL: 1, armament: 1 },
           fishing: null, defense: null, refit: null, trip: null };
};

/* Casino slice. The chip balance is NOT here — chips are `player.tokens`, so
 * this only holds the current stake and whatever hand/spin is on the table. */
CF.newCasinoState = function () {
  return { bet: CF.ruleset.casino.defaultBet, game: null, bj: null, vp: null, slot: null };
};

/* Sports-complex slice (Durability/Power are stored as LIFETIME points). */
CF.newSportsState = function () {
  var s = CF.sportsStart, f = CF.formulas;
  return {
    durabilityPoints: f.xpToReachLevelFor("Durability", s.durabilityLevel) + s.durabilityInto,
    powerPoints: f.xpToReachLevelFor("Power", s.powerLevel) + s.powerInto,
    handEnergy: s.handEnergy, energyAt: Date.now(),
    equipment: JSON.parse(JSON.stringify(s.equipment)),
    passes: JSON.parse(JSON.stringify(s.passes)),
    run: null, lastSteroidBuy: 0,
  };
};

/* Fresh state populated with the test-build starting stockpile. */
CF.resetToTestDefaults = function () {
  var s = CF.ruleset.start;
  var lvl = s.drinkMasterLevel;
  var enforce = CF.ruleset.enforceCapacity;

  var matTotal = enforce ? Math.floor(CF.formulas.warehouseCap("materials", lvl) * s.fillFraction) : 5000 * CF.materials.length;
  var juiceTotal = enforce ? Math.floor(CF.formulas.warehouseCap("rawjuice", lvl) * s.fillFraction) : 2000 * CF.rawJuices.length;
  var materials = enforce ? spreadFill(CF.materials, matTotal, "Water")
                          : (function () { var o = {}; CF.materials.forEach(function (m) { o[m] = 5000; }); return o; })();
  var rawJuice = enforce ? spreadFill(CF.rawJuices, juiceTotal)
                         : (function () { var o = {}; CF.rawJuices.forEach(function (j) { o[j] = 2000; }); return o; })();

  var finished = {};
  CF.finishedNames.forEach(function (n) { finished[n] = 0; });
  Object.keys(s.startFinished || {}).forEach(function (n) {
    if (finished[n] != null) finished[n] = s.startFinished[n];
  });

  var cos = CF.ruleset.cosmeticStats;
  CF.state = {
    version: CF.SAVE_VERSION,
    player: {
      name: s.name,
      drinkMasterLevel: lvl,
      drinkMasterPoints: s.drinkMasterInto, // XP into the current level (drives level-ups + panel %)
      dmLifetime: s.drinkMasterLifetime,    // total lifetime XP (display only)
      reputation: s.reputation,
      houseLevel: s.houseLevel,
      tavernOpen: false,
      tavernJobAccepted: s.tavernJobAccepted,   // the tavern is a job offer until accepted
      tavernOwned: s.tavernOwned,               // buying it unlocks floor 2 + Cooking
      money: s.money,
      credits: s.credits,
      tokens: s.tokens,
      bank: s.bank,
      drinkStatus: 0,
      fame: cos.fame,
      activityPct: cos.activityPct,
      durabilityCur: cos.durabilityCur,
      durabilityMax: cos.durabilityMax,
      fighting: s.fighting,                     // shown as-is (formula unresolved)
      cooking: s.cooking,
    },
    inv: { materials: materials, rawJuice: rawJuice, finished: finished },
    // Crafts room: the closet ("craft cabinet") and the backpack you carry
    // materials home from the market in.
    craft: {
      supplies: JSON.parse(JSON.stringify(CF.ruleset.craft.startSupplies)),
      tools: {},                                             // hand tools you've bought
      backpack: null,
      made: JSON.parse(JSON.stringify(CF.craftStartMade)),   // finished products
      points: CF.ruleset.craft.startPoints,                  // shared Craft points pool
    },
    blacksmith: {                                            // room 6
      anvilLevel: CF.blacksmithStart.anvilLevel,
      forgingPoints: CF.blacksmithStart.forgingPoints,
      made: JSON.parse(JSON.stringify(CF.blacksmithStart.made)),
      materials: JSON.parse(JSON.stringify(CF.blacksmithStart.materials)),
      houseLevel: CF.blacksmithStart.houseLevel,
    },
    chemist: {                                               // room 2 (Drug lab)
      points: CF.chemistStart.points,
      plants: JSON.parse(JSON.stringify(CF.chemistStart.plants)),
      juices: JSON.parse(JSON.stringify(CF.chemistStart.juices)),
      belt: JSON.parse(JSON.stringify(CF.chemistStart.belt)),
      beltCapacity: CF.chemistStart.beltCapacity,
      backpackPlants: null,
    },
    garden: CF.newGardenState(),                             // Botanical garden
    slumPasses: {},                                          // bought at the Ticket counter
    sports: CF.newSportsState(),                             // Sports complex
    casino: CF.newCasinoState(),                             // Casino tables
    medicine: CF.newMedicineState(),                         // room 5 (Medicine lab)
    canteen: CF.newCanteenState(),                           // tavern 2nd floor
    harbor: CF.newHarborState(),                             // the fishing boat
  };
  return CF.state;
};

/* ---- Persistence -------------------------------------------------------- */
CF.autosave = function () {
  try { localStorage.setItem(CF.LS_KEY, JSON.stringify(CF.state)); }
  catch (e) { /* file:// localStorage may be unavailable — ignore */ }
};

CF.restore = function () {
  try {
    var raw = localStorage.getItem(CF.LS_KEY);
    if (!raw) return false;
    var data = JSON.parse(raw);
    if (!data || data.version !== CF.SAVE_VERSION || !data.inv) return false;
    CF.state = data;
    CF.reconcileState();
    return true;
  } catch (e) { return false; }
};

/* Make sure every known item exists as a key (so a save from an older data set
 * still renders and new drinks appear with a 0 count). */
CF.reconcileState = function () {
  // backfill any player fields a slightly older save might lack
  var p = CF.state.player || (CF.state.player = {});
  var cos = CF.ruleset.cosmeticStats;
  var defs = { name: CF.ruleset.start.name, fame: cos.fame, activityPct: cos.activityPct,
    durabilityCur: cos.durabilityCur, durabilityMax: cos.durabilityMax, drinkStatus: 0,
    tokens: CF.ruleset.start.tokens, bank: CF.ruleset.start.bank, drinkMasterPoints: 0,
    dmLifetime: CF.ruleset.start.drinkMasterLifetime, houseLevel: CF.ruleset.start.houseLevel,
    tavernJobAccepted: CF.ruleset.start.tavernJobAccepted, tavernOwned: CF.ruleset.start.tavernOwned,
    fighting: CF.ruleset.start.fighting, cooking: CF.ruleset.start.cooking };
  for (var k in defs) if (defs.hasOwnProperty(k) && p[k] == null) p[k] = defs[k];

  // crafts room (added later than v1 saves)
  var cr = CF.state.craft || (CF.state.craft = { supplies: {}, backpack: null });
  cr.supplies = cr.supplies || {};
  cr.tools = cr.tools || {};
  cr.made = cr.made || {};
  if (cr.points == null) cr.points = CF.ruleset.craft.startPoints;
  CF.craftMaterialOrder.forEach(function (k) {
    if (cr.supplies[k] == null) cr.supplies[k] = CF.ruleset.craft.startSupplies[k] || 0;
  });

  // blacksmith (room 6) — added later than early saves
  if (!CF.state.blacksmith) {
    CF.state.blacksmith = {
      anvilLevel: CF.blacksmithStart.anvilLevel, forgingPoints: CF.blacksmithStart.forgingPoints,
      made: JSON.parse(JSON.stringify(CF.blacksmithStart.made)),
      materials: JSON.parse(JSON.stringify(CF.blacksmithStart.materials)),
      houseLevel: CF.blacksmithStart.houseLevel,
    };
  }
  // chemist (room 2) — added later
  if (!CF.state.chemist) {
    CF.state.chemist = {
      points: CF.chemistStart.points,
      plants: JSON.parse(JSON.stringify(CF.chemistStart.plants)),
      juices: JSON.parse(JSON.stringify(CF.chemistStart.juices)),
      belt: JSON.parse(JSON.stringify(CF.chemistStart.belt)),
      beltCapacity: CF.chemistStart.beltCapacity,
      backpackPlants: null,
    };
  }
  if (CF.state.chemist.beltCapacity == null) CF.state.chemist.beltCapacity = CF.chemistStart.beltCapacity;

  // sports complex — added later
  if (!CF.state.sports) CF.state.sports = CF.newSportsState();
  CF.state.sports.equipment = CF.state.sports.equipment || {};
  CF.state.sports.passes = CF.state.sports.passes || { stadium: false, boxing: false };

  // botanical garden — added later
  if (!CF.state.garden) CF.state.garden = CF.newGardenState();
  CF.state.garden.edibleSeeds = CF.state.garden.edibleSeeds || {};
  CF.state.garden.medicinalSeeds = CF.state.garden.medicinalSeeds || {};
  CF.state.slumPasses = CF.state.slumPasses || {};
  CF.state.garden.medBeds = CF.state.garden.medBeds || [];
  CF.state.garden.medicinalHarvest = CF.state.garden.medicinalHarvest || {};
  CF.state.garden.plots = CF.state.garden.plots || [];
  CF.state.garden.harvest = CF.state.garden.harvest || {};
  CF.state.garden.tools = CF.state.garden.tools || {};
  CF.state.garden.pests = CF.state.garden.pests || { caterpillars: 0, birds: 0, moles: 0 };
  // "become a gardener" came later — a save with plots/beds/seeds already had it
  if (CF.state.garden.isGardener == null) {
    var g0 = CF.state.garden;
    CF.state.garden.isGardener = !!(g0.plots.length || g0.medBeds.length ||
      Object.keys(g0.edibleSeeds).length || Object.keys(g0.medicinalSeeds).length);
  }

  // casino + medicine lab — added later
  if (!CF.state.casino) CF.state.casino = CF.newCasinoState();
  if (!CF.state.medicine) CF.state.medicine = CF.newMedicineState();
  CF.state.medicine.medicines = CF.state.medicine.medicines || {};
  if (!CF.state.harbor) CF.state.harbor = CF.newHarborState();
  if (!CF.state.canteen) CF.state.canteen = CF.newCanteenState();
  CF.state.canteen.dairy = CF.state.canteen.dairy || {};
  CF.state.canteen.fish = CF.state.canteen.fish || {};
  CF.state.canteen.menu = CF.state.canteen.menu || { veg: null, fish: null };

  var inv = CF.state.inv;
  inv.materials = inv.materials || {};
  inv.rawJuice = inv.rawJuice || {};
  inv.finished = inv.finished || {};
  CF.materials.forEach(function (m) { if (inv.materials[m] == null) inv.materials[m] = 0; });
  CF.rawJuices.forEach(function (j) { if (inv.rawJuice[j] == null) inv.rawJuice[j] = 0; });
  CF.finishedNames.forEach(function (n) { if (inv.finished[n] == null) inv.finished[n] = 0; });
};

/* Export current state to a downloaded JSON file (the portable save). */
CF.saveToFile = function () {
  var blob = new Blob([JSON.stringify(CF.state, null, 2)], { type: "application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "crime-factory-save.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
};

/* Import state from a chosen JSON file. */
CF.loadFromFile = function (file, onDone) {
  var fr = new FileReader();
  fr.onload = function () {
    try {
      var data = JSON.parse(fr.result);
      if (!data || !data.inv || !data.player) throw new Error("Not a Crime Factory save file.");
      CF.state = data;
      CF.state.version = CF.SAVE_VERSION;
      CF.reconcileState();
      CF.autosave();
      onDone && onDone(true, "Loaded save file.");
    } catch (e) {
      onDone && onDone(false, "Load failed: " + e.message);
    }
  };
  fr.onerror = function () { onDone && onDone(false, "Could not read the file."); };
  fr.readAsText(file);
};
