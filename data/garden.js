/* ============================================================================
 * garden.js — The Botanical Garden (Stealing + Gardening skills).
 * ----------------------------------------------------------------------------
 * The greenhouse is where the Chemist chain STARTS: spend a greenhouse ticket to
 * steal a backpack of drug plants, carry them home, and press them in the Juicer.
 * Seeds (edible / medicinal) are also stolen here; growing them is the Edible
 * herb garden / Medicinal herb beds — not built yet.
 *
 * Plant names are the official in-game English ones (botanical-garden-plants.md,
 * which supersedes the earlier hand-translated Estonian names). The drug plants'
 * `name` MUST match CF.chemRecipes[*].juiceBase exactly — that's what links a
 * stolen plant to the juice that makes its drug.
 * ========================================================================== */
window.CF = window.CF || {};

/* Drug plants — each needs BOTH a Chemist and a Stealing level (official help). */
CF.gardenDrugPlants = [
  { name: "Hevea",               chem: 0,   steal: 0 },
  { name: "Poppy",               chem: 13,  steal: 0 },
  { name: "Yam",                 chem: 25,  steal: 4 },
  { name: "Guava",               chem: 36,  steal: 7 },
  { name: "Sweet Potato",        chem: 46,  steal: 10 },
  { name: "Plants with a sting", chem: 55,  steal: 13 },
  { name: "Cassava",             chem: 63,  steal: 16 },
  { name: "Palmyra",             chem: 70,  steal: 19 },
  { name: "Adzuki",              chem: 76,  steal: 22 },
  { name: "Castor",              chem: 81,  steal: 25 },
  { name: "Passion",             chem: 85,  steal: 28 },
  { name: "Dzuut",               chem: 89,  steal: 31 },
  { name: "Papaya",              chem: 92,  steal: 34 },
  { name: "Tarragon",            chem: 95,  steal: 37 },
  { name: "Mangosteen",          chem: 97,  steal: 40 },
  { name: "Coriander",           chem: 99,  steal: 43 },
  { name: "Lihdzchi",            chem: 101, steal: 46 },
  { name: "Tamarillo",           chem: 103, steal: 49 },
  { name: "Senna",               chem: 108, steal: 52 },
  { name: "Annatto",             chem: 115, steal: 55 },
];

/* Edible plant seeds (Cooking chain) — gated by Gardening level. */
CF.gardenEdibleSeeds = [
  "Potato", "Cannabis", "Cabbage", "Wheat", "Carrot", "Rye", "Cranberry", "Strawberry", "Cherry tree",
  "Apple tree", "Ice cabbage", "Raspberry", "Garden Bean", "Plum", "Pear", "Cauliflower", "Parsley",
  "Pea", "Field bean", "Chickpea", "Beetroot", "Broccoli", "Fennel", "Parsnip", "Mushroom", "Oat",
  "Jerusalem artichoke", "Sea kale", "Ginger", "Sweet Potato", "Blackberry", "Sage", "Chanterelle",
  "Barley", "Chestnut", "Blueberry", "Paradise Apple", "Winter radish", "Blackcurrant", "Turnip",
  // level 41 was "Footprint" in the plant-list file — plainly a bad translation.
  // The cooking page's level-121 dish is "Avocado guacamole with jalapeno" and
  // its field half sits in exactly this slot, so it is Jalapeno.
  "Jalapeno", "Gooseberry", "Horseradish", "Pomegranate", "Grapefruit", "Kiwifruit", "Lingonberry",
  "Lychee", "Wild Strawberry",
].map(function (n, i) { return { name: n, lvl: i + 1 }; });   // list is level-ordered from 1

/* The GREENHOUSE fruits — the other half of every level. You cannot grow these
 * (no greenhouse growing plots in this build); you get them by swapping the
 * field crop of the SAME level at the Slum's Culinary exchange.
 *
 * ALL 49 NAMES ARE THE GAME'S OWN, read off the official cooking page
 * (crime.ee/index.php?a=5&l=12) — every vegetarian dish is named after its
 * pair, so "Cabbage and cucumber salad" pins Cucumber to level 3 alongside
 * Cabbage, and so on for all 49. (An earlier version of this list was invented;
 * it has been replaced.) */
CF.gardenExchangeFruits = [
  "Dill", "Cocoa", "Cucumber", "Olive", "Radish", "Banana", "Rice", "Watermelon", "Peach", "Pumpkin",
  "Coconut", "Lime", "Orange", "Mango", "Apricot", "Spinach", "Corn", "Mint", "Chilli", "Lemon",
  "Garlic", "Aubergine", "Pepper", "Courgette", "Magic mushroom", "Onion", "Tomato", "Pineapple", "Bok choy", "Basil",
  "Lemon balm", "Asparagus", "Chinese cabbage", "Artichoke", "Okra", "White grape", "Dark grape", "Wasabi", "Redcurrant", "Swede",
  "Avocado", "Quince", "Romanesco", "Fig", "Pomelo", "Persimmon", "Date", "Carambola", "Physalis",
].map(function (n, i) { return { name: n, lvl: i + 1 }; });   // level-ordered, pairs with the edible list

/* Medicinal plant seeds (Medical science chain) — gated by Gardening level.
 * NOTE: "Poppy" here is the MEDICINAL poppy — a different plant from the drug
 * "Poppy" above; they live in separate lists so the names never collide. */
CF.gardenMedicinalSeeds = [
  "Flax", "Cotton", "Marigold", "Poppy", "Rosehip", "Chamomile", "Mouse Ear", "Bamboo", "Aloe",
  "Milk Nettle", "Blood Orange", "Tea tree", "Willow",
].map(function (n, i) { return { name: n, lvl: i + 1 }; });

/* Sowing options for a medicinal bed: longer sow = more plants harvested, but
 * the gardening reward is the same either way (observed: all say "1 gardening
 * point" at Gardening 1). */
CF.medSowDurations = [
  { hours: 2,  plants: 40 },
  { hours: 4,  plants: 60 },
  { hours: 8,  plants: 80 },
  { hours: 12, plants: 100 },
  { hours: 24, plants: 150 },
];

/* Garden equipment sold at "Your office" (prices + per-player caps observed).
 * The watering can enables automatic watering; the other three clear a pest. */
CF.gardenTools = [
  { name: "Automatic watering can", price: 65000000, allowed: 5, role: "water" },
  { name: "Poison spray",           price: 10000000, allowed: 2, role: "caterpillars" },
  { name: "Scarecrow",              price: 12000000, allowed: 2, role: "birds" },
  { name: "Mole scarecrow",         price: 11000000, allowed: 2, role: "moles" },
];
CF.gardenPests = [
  { key: "caterpillars", label: "Caterpillars", action: "Launch the poison spray", tool: "Poison spray" },
  { key: "birds",        label: "Birds",        action: "Run the scarecrow",       tool: "Scarecrow" },
  { key: "moles",        label: "Moles",        action: "Run the mole repellent",  tool: "Mole scarecrow" },
];

/* Starting garden state — seeded to the reference screenshots. */
/* FRESH ACCOUNT: no tickets, both skills at level 1, ticket office already open. */
CF.gardenStart = {
  tickets: 0,
  stealLevel: 1, stealInto: 0,
  gardenLevel: 1, gardenInto: 0,
  ticketOfficeClosedForSec: 0,       // open from the start
  landM2: 3, landType: "farmland",
};

CF.garden = (function () {
  function P() { return CF.state.player; }
  function G() { return CF.state.garden; }
  var ok = function (m) { return { ok: true, msg: m }; };
  var fail = function (m) { return { ok: false, msg: m }; };

  function stealProgress() {
    var lifetime = G().stealPoints || 0, lv = CF.formulas.levelFromLifetimeXPFor("Stealing", lifetime);
    return { level: lv.level, lifetime: lifetime, into: lv.into,
             pointsToLevel: Math.max(0, CF.formulas.pointsToNextLevelFor("Stealing", lv.level) - lv.into) };
  }
  function gardenProgress() {
    var lifetime = G().gardenPoints || 0, lv = CF.formulas.levelFromLifetimeXPFor("Gardening", lifetime);
    return { level: lv.level, lifetime: lifetime, into: lv.into,
             pointsToLevel: Math.max(0, CF.formulas.pointsToNextLevelFor("Gardening", lv.level) - lv.into) };
  }

  /* Which plants/seeds you can currently steal. */
  function availableDrugPlants() {
    var chem = CF.chemist.progress().level, steal = stealProgress().level;
    return CF.gardenDrugPlants.filter(function (p) { return p.chem <= chem && p.steal <= steal; });
  }
  function availableSeeds(kind) {
    var g = gardenProgress().level;
    return (kind === "medicinal" ? CF.gardenMedicinalSeeds : CF.gardenEdibleSeeds)
      .filter(function (s) { return s.lvl <= g; });
  }
  function ticketOfficeSecondsLeft() {
    var left = Math.round(((G().ticketReopenAt || 0) - Date.now()) / 1000);
    return left > 0 ? left : 0;
  }
  /* ---- Medicinal plant beds ------------------------------------------- */
  function medBeds() { return G().medBeds || (G().medBeds = []); }
  CF._medBedReady = function (b) { return Date.now() >= b.endsAt; };
  function medBedsMax() { return CF.ruleset.garden.medBedsMax; }
  function medBedsInUse() { return medBeds().length; }
  /* Gardening points per harvested bed. Docs say "gardening level / 8"; the
   * reference shows "1 gardening point" at Gardening 1 — floor with a floor of 1
   * satisfies both. */
  function medPointsPerBed() { return Math.max(1, Math.floor(gardenProgress().level / 8)); }
  function medSeedTotal() { var t = 0, s = G().medicinalSeeds || {}; for (var k in s) t += s[k] || 0; return t; }

  /* Beds are harvested MANUALLY: a finished bed shows READY with a "Cut this
   * plant" link, and cutting it banks the herbs + the gardening points. */
  function medBedReady(b) { return Date.now() >= b.endsAt; }
  function cutMedBed(i) {
    var b = medBeds()[i];
    if (!b) return fail("No such bed.");
    if (!medBedReady(b)) return fail("That bed isn't ready yet.");
    G().medicinalHarvest[b.plant] = (G().medicinalHarvest[b.plant] || 0) + b.plants;
    G().gardenPoints = (G().gardenPoints || 0) + b.points;
    medBeds().splice(i, 1);
    var r = ok("You transported medicinal herbs to the warehouse and earned " + fmt(b.points) +
      " gardening point" + (b.points === 1 ? "" : "s") + "!");
    r.pts = b.points; return r;
  }
  function settleMedBeds() { return null; }   // nothing auto-harvests any more

  /* Sow N packets into N beds (1 packet = 1 bedful). */
  function sowMedicinal(seedName, packets, hours) {
    if (!seedName) return fail("Choose a plant.");
    var d = null; CF.medSowDurations.forEach(function (x) { if (x.hours === hours) d = x; });
    if (!d) return fail("Choose how long to sow.");
    packets = Math.floor(packets);
    if (!(packets > 0)) return fail("Enter how many packets to sow.");
    var have = (G().medicinalSeeds || {})[seedName] || 0;
    if (have < packets) return fail("You only have " + fmt(have) + " packet(s) of those seeds.");
    var free = medBedsMax() - medBedsInUse();
    if (free <= 0) return fail("All your medicinal plant beds are in use.");
    if (packets > free) return fail("You only have " + fmt(free) + " free bed(s).");
    var s = null; CF.gardenMedicinalSeeds.forEach(function (x) { if (x.name === seedName) s = x; });
    var lvl = s ? s.lvl : 1, pts = medPointsPerBed();
    G().medicinalSeeds[seedName] -= packets;
    if (G().medicinalSeeds[seedName] <= 0) delete G().medicinalSeeds[seedName];
    for (var i = 0; i < packets; i++) {
      medBeds().push({ plant: seedName, level: lvl, hours: hours, plants: d.plants,
                       points: pts, endsAt: Date.now() + hours * 3600000 });
    }
    return ok("You have sown " + fmt(packets) + " bedful" + (packets === 1 ? "" : "s") + " of Level " + lvl + " medicinal plant seeds!");
  }

  /* ---- Edible garden -------------------------------------------------- */
  function plots() { return G().plots || (G().plots = []); }
  function landM2() { return G().landM2 || 0; }
  function plotCapacity() { return landM2() * CF.ruleset.garden.plantsPerM2; }
  function landCooldownLeft() { return Math.max(0, Math.round(((G().landBuyAt || 0) - Date.now()) / 1000)); }
  function toolCount(name) { return (G().tools || {})[name] || 0; }

  /* The game ticks on the hour ("time until the update"): moisture drops one
   * whole point per elapsed hour and the watering allowance resets. A plant
   * whose moisture hits zero is "damaged" and can be cleared from the garden;
   * so is one the pests get to. */
  function hourSlot(t) { return Math.floor((t || Date.now()) / 3600000); }
  function settlePlots() {
    var g = CF.ruleset.garden, now = Date.now(), pe = G().pests || {};
    // how many pest kinds are loose in the garden right now
    var kinds = 0;
    CF.gardenPests.forEach(function (x) { if ((pe[x.key] || 0) > 0) kinds++; });
    plots().forEach(function (p) {
      var hrs = Math.max(0, hourSlot(now) - hourSlot(p.wateredAt || now));
      if (p.autoWater) { p.moisture = g.moistureMax; p.wateredAt = now; }
      else p.moisture = Math.max(0, g.moistureMax - hrs * g.moistureDecayPerHour);
      if (p.dead) { p.moisture = 0; return; }
      // pests nibble away at whatever is still growing, hour by hour
      var ticks = Math.max(0, hourSlot(now) - hourSlot(p.pestAt || (p.pestAt = now)));
      if (kinds && ticks) {
        var survive = Math.pow(1 - g.pestKillChancePerHour * kinds, ticks);
        if (Math.random() > survive) { p.dead = true; p.moisture = 0; }
      }
      p.pestAt = now;
    });
  }
  function plotReady(p) { return Date.now() >= p.endsAt; }

  /* Sow N seeds of a plant into N free plots. */
  function sowEdible(seedName, count) {
    if (!seedName) return fail("Choose a plant.");
    count = Math.floor(count);
    if (!(count > 0)) return fail("Enter how many seeds to sow.");
    var have = (G().edibleSeeds || {})[seedName] || 0;
    if (have < count) return fail("You only have " + fmt(have) + " seed(s).");
    var free = plotCapacity() - plots().length;
    if (free <= 0) return fail("Your garden is full — buy more land at your office.");
    if (count > free) return fail("You only have room for " + fmt(free) + " more plant(s).");
    var s = null; CF.gardenEdibleSeeds.forEach(function (x) { if (x.name === seedName) s = x; });
    var lvl = s ? s.lvl : 1, g = CF.ruleset.garden;
    G().edibleSeeds[seedName] -= count;
    if (G().edibleSeeds[seedName] <= 0) delete G().edibleSeeds[seedName];
    for (var i = 0; i < count; i++) {
      plots().push({ plant: seedName, level: lvl, endsAt: Date.now() + g.edibleGrowHours * 3600000,
                     moisture: g.moistureMax, wateredAt: Date.now(), autoWater: false });
    }
    return ok("You planted " + fmt(count) + " Level " + lvl + " edible plant seeds!");
  }

  /* Water chosen plots (index list). Costs from this hour's allowance and can
   * turn up pests. */
  function waterPlots(idx) {
    var g = CF.ruleset.garden, now = Date.now();
    if (!idx || !idx.length) return fail("Tick the plants you want to water.");
    // the allowance resets on the hour, with the rest of the game's update
    if (G().waterHourSlot !== hourSlot(now)) { G().waterHourSlot = hourSlot(now); G().wateredThisHour = 0; }
    var left = g.waterPerHour - (G().wateredThisHour || 0);
    if (left <= 0) return fail("You have watered all " + g.waterPerHour + " plants you can this hour — wait for the update.");
    var n = Math.min(idx.length, left), found = null;
    for (var i = 0; i < n; i++) {
      var p = plots()[idx[i]];
      if (!p || p.dead) continue;
      p.moisture = g.moistureMax; p.wateredAt = now;
      if (!found && Math.random() < g.pestChance) {
        var pest = CF.gardenPests[Math.floor(Math.random() * CF.gardenPests.length)];
        G().pests[pest.key] = (G().pests[pest.key] || 0) + 1;
        found = pest.label;
      }
    }
    G().wateredThisHour = (G().wateredThisHour || 0) + n;
    var r = ok("Watered " + fmt(n) + " plant" + (n === 1 ? "" : "s") + "." + (found ? " You found " + found + " in the garden!" : ""));
    r.watered = n; return r;
  }

  /* Harvest a finished plot: Gardening points = plant level + 11 (docs). */
  function harvestPlot(i) {
    var p = plots()[i];
    if (!p) return fail("No such plant.");
    if (p.dead) return fail("That plant is dead — remove the damaged plants.");
    if (!plotReady(p)) return fail("That plant isn't ready yet.");
    var pts = p.level + CF.ruleset.garden.ediblePointsBase;
    G().gardenPoints = (G().gardenPoints || 0) + pts;
    G().harvest[p.plant] = (G().harvest[p.plant] || 0) + CF.ruleset.garden.fruitPerPlant;
    plots().splice(i, 1);
    var r = ok("You harvested the " + p.plant + " and earned " + fmt(pts) + " gardening points!");
    r.pts = pts; return r;
  }
  function removeDamaged() {
    settlePlots();
    var before = plots().length;
    G().plots = plots().filter(function (p) { return p.moisture > 0; });
    var n = before - G().plots.length;
    return n ? ok("Removed " + fmt(n) + " dead plant" + (n === 1 ? "" : "s") + ".") : fail("No damaged plants to remove.");
  }
  function installSprinklers(idx) {
    var cans = toolCount("Automatic watering can");
    if (cans <= 0) return fail("You need an automatic watering can — buy one at your office.");
    if (!idx || !idx.length) return fail("Tick the plants to put a waterer on.");
    var used = plots().filter(function (p) { return p.autoWater; }).length;
    var free = cans - used;
    if (free <= 0) return fail("All your watering cans are already installed.");
    var n = 0;
    idx.forEach(function (i) { var p = plots()[i]; if (p && !p.dead && !p.autoWater && n < free) { p.autoWater = true; n++; } });
    return n ? ok("Installed " + n + " automatic waterer" + (n === 1 ? "" : "s") + ".") : fail("Nothing to install.");
  }

  function buyLand() {
    var g = CF.ruleset.garden;
    if (landCooldownLeft() > 0) return fail("You can buy garden land again later.");
    if (P().money < g.landPriceCC) return fail("You don't have enough cash (" + fmt(g.landPriceCC - P().money) + " CC missing)!");
    P().money -= g.landPriceCC; G().landM2 = landM2() + 1;
    G().landBuyAt = Date.now() + g.landCooldownSec * 1000;
    return ok("You bought 1 m² of garden land.");
  }
  function buyTool(name, qty) {
    var t = null; CF.gardenTools.forEach(function (x) { if (x.name === name) t = x; });
    if (!t) return fail("Unknown item.");
    qty = Math.floor(qty);
    if (!(qty > 0)) return fail("Enter how many to buy.");
    var have = toolCount(name);
    if (have + qty > t.allowed) return fail("You may only own " + t.allowed + " " + name + ".");
    var cost = t.price * qty;
    if (P().money < cost) return fail("You don't have enough cash (" + fmt(cost - P().money) + " CC missing)!");
    P().money -= cost; G().tools[name] = have + qty;
    return ok("Bought " + qty + " " + name + ".");
  }
  /* Pest control: one use of the matching tool clears that pest. */
  function clearPest(key) {
    var pe = null; CF.gardenPests.forEach(function (x) { if (x.key === key) pe = x; });
    if (!pe) return fail("Unknown pest.");
    if ((G().pests[key] || 0) <= 0) return fail("There are no " + pe.label.toLowerCase() + " in your garden.");
    if (toolCount(pe.tool) <= 0) return fail("You need a " + pe.tool + " — buy one at your office.");
    G().pests[key] = 0;
    return ok("Cleared the " + pe.label.toLowerCase() + " from your garden.");
  }

  /* ---- Culinary exchange (Slum market) --------------------------------- */
  /* Swap the field crop you CAN grow for the greenhouse fruit of the SAME
   * level, one for one, plus a brokerage fee. VERIFIED: the reference charges
   * 0.01% of your money per fruit (10 fruit cost 1,040 CC on 1,040,000 CC). */
  function exchangeFruit(name) {
    var f = null; CF.gardenExchangeFruits.forEach(function (x) { if (x.name === name) f = x; });
    return f;
  }
  function exchangePartner(name) {
    var f = exchangeFruit(name), out = null;
    if (!f) return null;
    CF.gardenEdibleSeeds.forEach(function (s) { if (s.lvl === f.lvl) out = s; });
    return out;
  }
  function exchangeFee(qty) {
    return Math.round(P().money * CF.ruleset.garden.brokerageRate * qty);
  }
  function swapFruit(name, qty) {
    var f = exchangeFruit(name);
    if (!f) return fail("Choose which fruit you want.");
    qty = Math.floor(qty);
    if (!(qty > 0)) return fail("Choose how many fruit to exchange.");
    var give = exchangePartner(name);
    if (!give) return fail("Nothing of that level can be grown yet.");
    var have = (G().harvest || {})[give.name] || 0;
    if (have < qty) return fail("You need " + fmt(qty) + " " + give.name + " to trade — you have " + fmt(have) + ".");
    var fee = exchangeFee(qty);
    if (P().money < fee) return fail("You can't cover the " + fmt(fee) + " CC brokerage fee.");
    G().harvest[give.name] -= qty;
    if (G().harvest[give.name] <= 0) delete G().harvest[give.name];
    G().harvest[name] = ((G().harvest || {})[name] || 0) + qty;
    P().money -= fee;
    return ok("You exchanged " + fmt(qty) + " " + give.name + " for " + fmt(qty) + " " + name +
      " and paid " + fmt(fee) + " CC in brokerage.");
  }

  /* How many tickets the office will sell you — official rule: Stealing + 9. */
  function buyableTickets() { return stealProgress().level + CF.ruleset.garden.ticketsBase; }
  /* Buy the whole allotment (the reference offers it as one "I BUY TICKETS" action),
   * then the office closes again for its cooldown. */
  function buyTickets() {
    if (ticketOfficeSecondsLeft() > 0) return fail("The box office is closed.");
    var n = buyableTickets(), cost = n * CF.ruleset.garden.ticketPriceCC;
    if (P().money < cost) return fail("Not enough money (need " + fmt(cost) + " CC).");
    P().money -= cost;
    G().tickets += n;
    G().ticketReopenAt = Date.now() + CF.ruleset.garden.officeCooldownSec * 1000;
    return ok("You bought " + fmt(n) + " greenhouse tickets for " + fmt(cost) + " CC.");
  }

  function spendTicket() {
    if ((G().tickets || 0) <= 0) return false;
    G().tickets -= 1; return true;
  }
  function awardSteal(pts) { G().stealPoints = (G().stealPoints || 0) + pts; }

  /* Steal a backpack full of drug plants (1 ticket). Plants land in the BACKPACK
   * (chemist.backpackPlants) and must be carried to the Laboratory Cabinet. */
  function stealPlants(plantName) {
    var p = null; CF.gardenDrugPlants.forEach(function (x) { if (x.name === plantName) p = x; });
    if (!p) return fail("Choose which plants to steal.");
    if (p.chem > CF.chemist.progress().level) return fail(plantName + " needs Chemist level " + p.chem + ".");
    if (p.steal > stealProgress().level) return fail(plantName + " needs Stealing level " + p.steal + ".");
    if (CF.state.chemist.backpackPlants) return fail("Your backpack already holds plants — empty it into the closet first.");
    if (!spendTicket()) return fail("You have no greenhouse tickets left.");
    var qty = CF.ruleset.garden.plantBackpackSize, pts = CF.ruleset.garden.stealPointsPlants;
    CF.state.chemist.backpackPlants = { item: plantName + " plants", qty: qty };
    awardSteal(pts);
    var r = ok("You stole a backpack full of plants!");
    r.pts = pts; return r;
  }

  /* ---- Becoming a gardener --------------------------------------------- */
  /* The two garden plots (edible + medicinal) stay locked until you claim
   * "[Become a gardener]", which needs the tavern AND house level 5. The same
   * gates guard the matching seed blocks in the greenhouse. */
  function canStealEdibleSeeds() { return !CF.ruleset.garden.gardenerNeedsTavern || !!P().tavernOwned; }
  function canStealMedSeeds() { return (P().houseLevel || 0) >= CF.ruleset.garden.gardenerHouseLevel; }
  function isGardener() { return !!G().isGardener; }
  /* Every unmet requirement at once — the reference lists one ERROR per gate. */
  function gardenerBlockers(verb) {
    var out = [];
    if (!canStealEdibleSeeds()) out.push("You have to buy a tavern to " + verb + ".");
    if (!canStealMedSeeds()) out.push("Your house must be at least level " +
      CF.ruleset.garden.gardenerHouseLevel + " to " + verb + ".");
    return out;
  }
  function becomeGardener() {
    if (isGardener()) return fail("You are already a gardener.");
    var bad = gardenerBlockers("become a gardener");
    if (bad.length) { var f = fail(bad[0]); f.errors = bad; return f; }
    G().isGardener = true;
    return ok("You are now a gardener — your herb garden and plant beds are open!");
  }

  /* Steal seeds (1 ticket) — three seeds of the chosen plant. */
  function stealSeeds(kind, seedName) {
    var list = kind === "medicinal" ? CF.gardenMedicinalSeeds : CF.gardenEdibleSeeds, s = null;
    if (kind === "medicinal" && !canStealMedSeeds())
      return fail("Your house must be at least level " + CF.ruleset.garden.gardenerHouseLevel + " to steal herb seeds!");
    if (kind !== "medicinal" && !canStealEdibleSeeds())
      return fail("You have to buy a tavern to steal the seeds of a food plant!");
    list.forEach(function (x) { if (x.name === seedName) s = x; });
    if (!s) return fail("Choose which seeds to steal.");
    if (s.lvl > gardenProgress().level) return fail(seedName + " needs Gardening level " + s.lvl + ".");
    if (!spendTicket()) return fail("You have no greenhouse tickets left.");
    var n = CF.ruleset.garden.seedsPerSteal, pts = CF.ruleset.garden.stealPointsSeeds;
    var store = kind === "medicinal" ? G().medicinalSeeds : G().edibleSeeds;
    store[seedName] = (store[seedName] || 0) + n;
    awardSteal(pts);
    var r = ok("You stole three Level " + s.lvl + " " + (kind === "medicinal" ? "medicinal" : "edible") + " plant seeds!");
    r.pts = pts; return r;
  }

  return {
    stealProgress: stealProgress, gardenProgress: gardenProgress,
    availableDrugPlants: availableDrugPlants, availableSeeds: availableSeeds,
    ticketOfficeSecondsLeft: ticketOfficeSecondsLeft, buyableTickets: buyableTickets, buyTickets: buyTickets,
    medBeds: medBeds, medBedsMax: medBedsMax, medBedsInUse: medBedsInUse, medPointsPerBed: medPointsPerBed,
    medSeedTotal: medSeedTotal, settleMedBeds: settleMedBeds, sowMedicinal: sowMedicinal, cutMedBed: cutMedBed,
    plots: plots, landM2: landM2, plotCapacity: plotCapacity, landCooldownLeft: landCooldownLeft,
    toolCount: toolCount, settlePlots: settlePlots, plotReady: plotReady,
    sowEdible: sowEdible, waterPlots: waterPlots, harvestPlot: harvestPlot, removeDamaged: removeDamaged,
    installSprinklers: installSprinklers, buyLand: buyLand, buyTool: buyTool, clearPest: clearPest,
    waterLeftThisHour: function () {
      if (G().waterHourSlot !== hourSlot()) return CF.ruleset.garden.waterPerHour;
      return Math.max(0, CF.ruleset.garden.waterPerHour - (G().wateredThisHour || 0));
    },
    /* Seconds to the next hourly update — when the allowance comes back. */
    secondsToWaterReset: function () { return Math.ceil(((hourSlot() + 1) * 3600000 - Date.now()) / 1000); },
    /* Soonest STILL-GROWING plant (null if none) + how many are ready to take.
     * Split apart so the account overview can show a live countdown even while
     * a finished plant is waiting to be harvested. */
    nextEdibleSeconds: function () {
      var best = null, now = Date.now();
      plots().forEach(function (p) {
        if (p.dead || p.endsAt <= now) return;
        var s = Math.round((p.endsAt - now) / 1000);
        if (best === null || s < best) best = s;
      });
      return best;
    },
    edibleReady: function () {
      var n = 0, now = Date.now();
      plots().forEach(function (p) { if (!p.dead && p.endsAt <= now) n++; });
      return n;
    },
    driestPlot: function () {
      var best = null;
      plots().forEach(function (p) { if (!p.dead && (best === null || p.moisture < best)) best = p.moisture; });
      return best;
    },
    nextMedSeconds: function () {
      var best = null, now = Date.now();
      medBeds().forEach(function (b) {
        if (b.endsAt <= now) return;
        var s = Math.round((b.endsAt - now) / 1000);
        if (best === null || s < best) best = s;
      });
      return best;
    },
    medReady: function () {
      var n = 0, now = Date.now();
      medBeds().forEach(function (b) { if (b.endsAt <= now) n++; });
      return n;
    },
    stealPlants: stealPlants, stealSeeds: stealSeeds,
    isGardener: isGardener, becomeGardener: becomeGardener, gardenerBlockers: gardenerBlockers,
    canStealEdibleSeeds: canStealEdibleSeeds, canStealMedSeeds: canStealMedSeeds,
    exchangeFruit: exchangeFruit, exchangePartner: exchangePartner,
    exchangeFee: exchangeFee, swapFruit: swapFruit,
  };
})();
