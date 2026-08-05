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
  CF.newAccount();
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
  s.sports.durabilityPoints = f.xpToReachLevelFor("Endurance", 38);
  s.sports.powerPoints = f.xpToReachLevelFor("Strength", 13);
  s.sports.passes = { gym: true, stadium: false, boxing: false };
  // canteen: Cooking 2 with the reference's 1,000 points into it, plus enough
  // dairy and fish to work both cooking tables (the Seaport isn't built yet)
  s.canteen.cookPoints = f.xpToReachLevelFor("Cooking", 2) + 1000;
  s.canteen.dairy = { "Raw milk": 100, "Water": 100, "Butter": 100, "Milk": 40 };
  s.canteen.fish = { "Baltic herring": 60 };   // its dish is level 2, like Cooking
  s.harbor.owned = true;                       // the boat is already bought
  /* THE BANK, so its four rooms are all testable at once. Modelled on the
   * reference's own level-2 account: the bank bought, a partial collection with
   * some pieces worn down to be maintained, duplicates sitting in the warehouse
   * to sell, and the vault holding exactly the nine treasures that page showed
   * (which is what makes its 337,310,000 CC figure appear). Weapon handling is
   * raised too, or none of the sewer that feeds this is reachable. */
  p.bankOwned = true; p.bankLevel = 2;
  s.vault = {}; s.bankStore = {}; s.chambers = {};
  // 34 different bank items — six short of the 40 the level-2 upgrade wants, so
  // the requirement is visible and testable rather than already satisfied
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20,
   21, 22, 23, 26, 28, 30, 32, 39, 40, 54, 60, 61, 84, 147, 163].forEach(function (n) {
    s.vault[n] = CF.ruleset.bank.conditionMax;
  });
  // a few left worn, so the maintenance list has something in it on arrival
  [3, 5, 16, 17, 22, 61].forEach(function (n) { s.vault[n] = 62 + (n % 5) * 3; });
  // duplicates to sell in the warehouse
  [[1, 4], [3, 2], [5, 3], [12, 1], [22, 2], [39, 1], [61, 1]].forEach(function (d) {
    s.bankStore[d[0]] = d[1];
  });
  // the reference's own vault: 9 different, 12 items, 337,310,000 CC
  [[3, 1], [4, 1], [5, 1], [6, 1], [8, 1], [11, 2], [12, 1], [14, 1], [15, 3]].forEach(function (c) {
    s.chambers[c[0]] = c[1];
  });
  s.sports.weaponPoints = f.xpToReachLevelFor("Weapon handling", 22);
  s.sewerGear = CF.ruleset.perUpdate.gearMax;
  s.houseGear = CF.ruleset.perUpdate.gearMax;
  s.medicine.kits = 12;                        // enough to test hospital healing
  /* Stock the warehouses so the tavern loop is immediately usable — but RESPECT
   * THE SHARED CAP. A flat 5,000 a line put 190,000 units against a 12,080 cap,
   * which is not "well stocked", it is a profile that cannot buy or press
   * anything until you sell most of it back. Fill to ~90% and spread it evenly. */
  var matCap = CF.formulas.warehouseCap("materials", p.drinkMasterLevel);
  var juiceCap = CF.formulas.warehouseCap("rawjuice", p.drinkMasterLevel);
  var perMat = Math.floor(matCap * 0.9 / CF.materials.length);
  var perJuice = Math.floor(juiceCap * 0.9 / CF.rawJuices.length);
  CF.materials.forEach(function (m) { s.inv.materials[m] = perMat; });
  CF.rawJuices.forEach(function (j) { s.inv.rawJuice[j] = perJuice; });
  CF.craftMaterialOrder.forEach(function (k) { s.craft.supplies[k] = 5000; });
  // and some finished drinks, or the first update sells nothing and the tavern
  // looks broken on arrival
  CF.finishedNames.slice(0, 12).forEach(function (n) { s.inv.finished[n] = 400; });
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
    pestClearedAt: {},                        // pest key -> when it was last treated
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

/* Seaport slice — the boat, its two crews, and whatever it's currently doing.
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

/* Betting Bunker slice. `active` is the slip currently running (or the finished
 * one you have not cleared yet); `history` is the last N settled bets. */
CF.newBettingState = function () {
  return { active: null, history: [] };
};

/* Villas and sewer slice. The map is generated on first visit and kept, so the
 * block you know stays the block you know. `items` counts stolen bank items,
 * which have nowhere to go until the bank side is built. */
CF.newHousesState = function () {
  return { size: "medium", cells: null, holes: {}, w: 0, h: 0,
           px: 0, py: 0, robbed: {}, sel: null, items: 0, equipment: 0,
           // 0 = the street; 1..6 are sewer floors, carved on the way down
           level: 0, maxLevel: 1, sewerCells: null, streetX: null, streetY: null };
};

/* Sports-complex slice (Endurance/Strength are stored as LIFETIME points). */
CF.newSportsState = function () {
  var s = CF.sportsStart, f = CF.formulas;
  return {
    durabilityPoints: f.xpToReachLevelFor("Endurance", s.durabilityLevel) + s.durabilityInto,
    powerPoints: f.xpToReachLevelFor("Strength", s.powerLevel) + s.powerInto,
    speedPoints: f.xpToReachLevelFor("Speed", CF.speedStartLevel),
    handEnergy: s.handEnergy, legEnergy: s.legEnergy, energyAt: Date.now(),
    equipment: JSON.parse(JSON.stringify(s.equipment)),
    passes: JSON.parse(JSON.stringify(s.passes)),
    run: null, lastSteroidBuy: 0,
  };
};

/* A brand-new account: no house, every skill at 1, empty warehouses. This is
 * what a first-time visitor gets, and what the debug "New account" button
 * restores to. (CF.loadLateGame builds its test profile on top of this.) */
CF.newAccount = function () {
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
      bankLevel: 1,                             // img/bank-1..12.gif
      drinkStatus: 0,
      fame: cos.fame,
      activityPct: cos.activityPct,
      durabilityCur: cos.durabilityCur,
      durabilityMax: cos.durabilityMax,
      fighting: s.fighting,                     // shown as-is (formula unresolved)
      cooking: s.cooking,
    },
    inv: { materials: materials, rawJuice: rawJuice, finished: finished },
    // Stealing gear for Villas and sewer. Both refill by perUpdate.*Gear.
    houseGear: 25,
    sewerGear: 10,
    /* The bank vault (named items the sewer's chests deliver straight into it,
       never through your backpack) and the weapon rack (cold weapons picked up
       off the tunnel floor). Both are keyed by name -> count. */
    vault: {},
    arms: {},
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
    garden: CF.newGardenState(),                             // Garden
    slumPasses: {},                                          // bought at the Ticket counter
    sports: CF.newSportsState(),                             // Sports complex
    casino: CF.newCasinoState(),                             // Casino tables
    betting: CF.newBettingState(),                           // Slum betting bunker
    houses: CF.newHousesState(),                             // Villas and sewer map
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

/* ---- What the hourly update hands you -------------------------------------
 * Hand energy and the two stealing-gear bars top up by a fixed amount at every
 * update (CF.ruleset.perUpdate), whether or not the page was open — so this
 * catches up on ALL the updates that were missed rather than paying one and
 * forgetting the rest. Idempotent: `updateSlot` only ever moves forward, so
 * calling it twice in the same hour is free. renderSidebar calls it, which
 * means every screen reads fresh numbers. Returns how many updates it paid. */
CF.settleUpdates = function () {
  var s = CF.state, u = CF.ruleset.perUpdate, now = CF.clock.slot();
  if (!s) return 0;
  // First call on a fresh load: adopt the current hour without back-paying the
  // whole epoch. A save's own updateSlot survives, so time away still counts.
  if (s.updateSlot == null) { s.updateSlot = now; return 0; }
  var n = now - s.updateSlot;
  if (n <= 0) return 0;
  s.updateSlot = now;
  if (s.sports) {
    s.sports.handEnergy = Math.min(CF.ruleset.sports.handEnergyMax,
                                   (s.sports.handEnergy || 0) + n * u.handEnergy);
    /* Legs refill on the same beat as arms, from their own pool — the stadium
       and the gym never share energy. */
    s.sports.legEnergy = Math.min(CF.ruleset.speedRun.legEnergyMax,
                                  (s.sports.legEnergy || 0) + n * CF.ruleset.speedRun.legEnergyPerHour);
    s.sports.energySlot = now;
  }
  s.houseGear  = Math.min(u.gearMax, (s.houseGear  || 0) + n * u.houseGear);
  s.sewerGear = Math.min(u.gearMax, (s.sewerGear || 0) + n * u.sewerGear);
  /* EVERY update puts the whole district back, not only one that happened to
   * add moves. Tying it to the moves going up meant a player sitting at a full
   * 100/100 never saw the houses refresh at all — the one case where you are
   * most able to go robbing. */
  if (CF.houses) CF.houses.refreshOnUpdate();
  return n;
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

  /* Stealing gear for Villas and sewer; both fill by perUpdate.*Gear an hour.
   * Carries a save made before the location was renamed, so nobody loses the
   * gear they had accrued under the old key. */
  if (CF.state.houseGear == null)
    CF.state.houseGear = CF.state.cottageGear != null ? CF.state.cottageGear : 25;
  // this one has been renamed twice: rentselGear -> sewageGear -> sewerGear
  if (CF.state.sewerGear == null)
    CF.state.sewerGear = CF.state.sewageGear != null ? CF.state.sewageGear
                       : CF.state.rentselGear != null ? CF.state.rentselGear : 10;
  delete CF.state.cottageGear; delete CF.state.rentselGear; delete CF.state.sewageGear;
  // vault + weapon rack arrived with the sewer's chests; older saves lack them
  if (!CF.state.vault) CF.state.vault = {};
  if (!CF.state.arms) CF.state.arms = {};
  if (!CF.state.player.bankLevel) CF.state.player.bankLevel = 1;
  /* The vault used to be name -> count; it is now item NUMBER -> condition.
     Convert what can be matched by name and drop the rest — the old names were
     a 12-entry guess, the numbered catalogue replaces them. */
  (function () {
    var v = CF.state.vault || {}, out = {}, changed = false;
    for (var k in v) {
      if (/^\d+$/.test(k)) { out[k] = v[k]; continue; }
      changed = true;
      for (var n = 1; n <= CF.bankItems.count; n++) {
        if (CF.bankItems.name(n) === k) { out[n] = CF.ruleset.bank.conditionMax; break; }
      }
    }
    if (changed) CF.state.vault = out;
  })();
  /* The endurance bar's size is the Endurance level now. Older saves carry a
     durabilityMax frozen at account creation and a durabilityCur that may sit
     ABOVE it — which made sewer fights unloseable. Re-clamp on load. */
  CF.sports.enduranceCur();

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
  /* The stadium arrived after these two: a save made before it has no Speed
     progress and no leg energy. Seed both rather than starting anyone at
     Speed 1 — Speed was a flat 10 for everybody until it became trainable. */
  if (CF.state.sports.speedPoints == null)
    CF.state.sports.speedPoints = CF.formulas.xpToReachLevelFor("Speed", CF.speedStartLevel);
  if (CF.state.sports.legEnergy == null)
    CF.state.sports.legEnergy = CF.ruleset.speedRun.legEnergyMax;

  // garden — added later
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
  if (!CF.state.betting) CF.state.betting = CF.newBettingState();
  CF.state.betting.history = CF.state.betting.history || [];
  if (!CF.state.houses) CF.state.houses = CF.newHousesState();
  CF.state.houses.robbed = CF.state.houses.robbed || {};
  if (CF.state.houses.level == null) CF.state.houses.level = 0;
  if (CF.state.sports && CF.state.sports.weaponPoints == null) CF.state.sports.weaponPoints = 0;
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

  /* -- Name corrections -----------------------------------------------------
   * Materials and drinks were first read off machine-translated screenshots, so
   * a few kept their Estonian ("Tikri" for gooseberries, "Dzinn" for gin) or an
   * odd capitalisation. The stock is stored UNDER THE NAME, so a rename would
   * otherwise silently orphan whatever a player had made. Move the balance over
   * and drop the old key. Old names left here permanently — this costs nothing
   * and a save may be years old. */
  var RENAMED = {
    materials: { "Tikri": "Gooseberries" },
    finished: {
      "Kali": "Kvass", "Puskar": "Moonshine", "Dzinn": "Gin",
      "Tikri Nectar": "Gooseberry Nectar", "Light rum": "Light Rum",
      "Filtered water": "Filtered Water", "Light home beer": "Light Homemade Beer",
      "Blackcurrant wine": "Blackcurrant Wine", "White wine": "White Wine",
      "Red wine": "Red Wine", "Pink wine": "Rose Wine",
      "Cranberry Liqueur (variant)": "Aged Cranberry Liqueur",
      "Bottled Cranberry Juice (Reserve)": "Cranberry Nectar",
    },
  };
  Object.keys(RENAMED).forEach(function (store) {
    var bag = inv[store], map = RENAMED[store];
    for (var old in map) {
      if (bag[old] == null) continue;
      bag[map[old]] = (bag[map[old]] || 0) + bag[old];
      delete bag[old];
    }
  });

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
