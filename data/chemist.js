/* ============================================================================
 * chemist.js — Room 2 (Drug Lab) + the Streets, and CF.chemist logic.
 * ----------------------------------------------------------------------------
 * The Chemist loop (from screenshots + the official help docs):
 *   Garden (not built) → steal PLANTS → carry in backpack → closet
 *   Juicer:   press N plants  → N × juicePerPlant ml of that plant's JUICE
 *   Streets:  buy raw NARCOTICS (per gram, in Money) into your drug BELT
 *   Drug lab: mix  1 g narcotic + 1 ml matching plant-juice → 1 g processed DRUG
 *             (drug replaces the narcotic in the belt; awards Chemist points)
 *   Streets:  sell the processed drug for a much higher price (the profit)
 * Chemist shares the universal level curve (Fame = level²×9, per the docs).
 * ========================================================================== */
window.CF = window.CF || {};

/* Raw narcotics bought on the Streets — price is CC (=Money) per gram, from the
 * Sadala street screenshot. (Cross-city arbitrage isn't modelled yet.) */
CF.narcotics = {
  "Hemp": 722, "GHB": 1119, "Ecstasy": 1406, "PCP": 1794, "LSD": 1757,
  "Amphetamine": 2576, "Speed": 3989, "Heroin": 6643, "Crack": 13770, "Cocaine": 18404,
};
CF.narcoticOrder = ["Hemp", "GHB", "Ecstasy", "PCP", "LSD", "Amphetamine", "Speed", "Heroin", "Crack", "Cocaine"];

/* Chemist recipes: narcotic + <juiceBase> juice → processed drug. Levels &
 * pairings are from the official Chemist help table. `price` (CC/g) is our pick
 * inside each drug's observed min–max range (Atarax 3,622 is the exact reading).
 * `ptsPerG` = Chemist points per gram; ONLY Atarax is observed (80/g → 84 g gave
 * 6,720). The rest are ESTIMATES on a curve anchored to it — refine when seen. */
CF.chemRecipes = {
  "Hemaiin":    { narcotic: "Hemp",        juiceBase: "Hevea",        level: 0,   price: 1600 },
  "Heaven":     { narcotic: "Hemp",        juiceBase: "Poppy",        level: 13,  price: 1800 },
  "Atarax":     { narcotic: "GHB",         juiceBase: "Yam",          level: 25,  price: 3622, ptsPerG: 80 },  // OBSERVED
  "Guatsiid":   { narcotic: "GHB",         juiceBase: "Guava",        level: 36,  price: 6400 },
  "Monsatoon":  { narcotic: "Ecstasy",     juiceBase: "Sweet Potato", level: 46,  price: 31500 },
  "Exceed":     { narcotic: "Ecstasy",     juiceBase: "Plants with a sting", level: 55, price: 61500 },
  "Maniogeen":  { narcotic: "PCP",         juiceBase: "Cassava",      level: 63,  price: 64500 },
  "Pantox":     { narcotic: "PCP",         juiceBase: "Palmyra",      level: 70,  price: 72000 },
  "Halluciin":  { narcotic: "LSD",         juiceBase: "Adzuki",       level: 76,  price: 85500 },
  "Halluciit":  { narcotic: "LSD",         juiceBase: "Castor",       level: 81,  price: 88500 },
  "Pantoxiid":  { narcotic: "Amphetamine", juiceBase: "Passion",      level: 85,  price: 114000 },
  "Dimension":  { narcotic: "Amphetamine", juiceBase: "Dzuut",        level: 89,  price: 117000 },
  "Ketaliin":   { narcotic: "Speed",       juiceBase: "Papaya",       level: 92,  price: 148500 },
  "Eentregan":  { narcotic: "Speed",       juiceBase: "Tarragon",     level: 95,  price: 151500 },
  "Datruxiid":  { narcotic: "Heroin",      juiceBase: "Mangosteen",   level: 97,  price: 243000 },
  "Celontiin":  { narcotic: "Heroin",      juiceBase: "Coriander",    level: 99,  price: 246000 },
  "Lazeriks":   { narcotic: "Cocaine",     juiceBase: "Lihdzchi",     level: 101, price: 486000 },
  "Metalitaan": { narcotic: "Cocaine",     juiceBase: "Tamarillo",    level: 103, price: 1002000 },
  "Sennaxiid":  { narcotic: "Crack",       juiceBase: "Senna",        level: 108, price: 1250000 },
  "Oomen":      { narcotic: "Crack",       juiceBase: "Annatto",      level: 115, price: 1800000 },
};
/* Fill in estimated points/gram (anchored so Atarax = 80/g at level 25). */
Object.keys(CF.chemRecipes).forEach(function (k) {
  var r = CF.chemRecipes[k];
  if (r.ptsPerG == null) r.ptsPerG = Math.max(1, Math.round(80 * Math.pow(1.09, r.level - 25)));
});
/* Recipe names by level — drives the Drug lab dropdown. */
CF.chemRecipeOrder = Object.keys(CF.chemRecipes).sort(function (a, b) { return CF.chemRecipes[a].level - CF.chemRecipes[b].level; });
/* Distinct plant bases (in recipe order). A plant item is "<base> plants", its
 * juice is "<base> juice". */
CF.chemPlants = (function () { var seen = {}, out = []; CF.chemRecipeOrder.forEach(function (k) { var b = CF.chemRecipes[k].juiceBase; if (!seen[b]) { seen[b] = 1; out.push(b); } }); return out; })();

/* Starting Drug-lab state (seeded to match the screenshots so the loop is
 * immediately playable even though the Garden isn't built yet). */
/* FRESH ACCOUNT: Chemist level 1, nothing in the closet, nothing in the belt. */
CF.chemistStart = {
  points: 0,
  plants: {},                     // plant closet ("Your plant resources")
  juices: {},                     // juice reserves (ml)
  belt:   {},                     // drug belt (grams)
  beltCapacity: 10,               // base belt (the counter's smallest upgrade is 12 g)
  backpackPlants: null,           // { item, qty } when carrying plants home from the garden
};

/* Upgradeable drug belts (Slum ▸ Market ▸ Drug belt counter). Bigger belt = more
 * grams carried; each needs both CC and enough Fame ("demanding fame"). Prices &
 * fame reqs from the counter screenshot. Base belt (84 g) needs no fame. */
/* DERIVED from the observed counter readings (12 g … 114 g):
 *   - the fame requirement's STEP grows geometrically at ~1.062 per 2 g, so
 *       reqFame(n) = 1525 + 1195 * (r^k - 1)/(r - 1),  k = (n - 12)/2, r = 1.062
 *     which reproduces the readings essentially exactly (14 g -> 2,720 exact,
 *     16 g -> 3,989 exact, 86 g -> 160,725 vs 160,728, 114 g -> 396,6xx).
 *   - price is simply reqFame x 300 (holds for 13 of the 15 small readings and
 *     both late-game ones; the two that didn't were my misreads).
 * Generated 12 g -> 120 g so the ladder keeps working as the player grows. */
CF.drugBeltCurve = { startCap: 12, maxCap: 120, step: 2, baseFame: 1525, firstStep: 1195, ratio: 1.062, pricePerFame: 300 };
CF.drugBelts = (function () {
  var c = CF.drugBeltCurve, out = [], acc = c.baseFame, stepv = c.firstStep;
  for (var cap = c.startCap; cap <= c.maxCap; cap += c.step) {
    var fame = Math.round(acc);
    out.push({ cap: cap, reqFame: fame, price: fame * c.pricePerFame });
    acc += stepv; stepv *= c.ratio;
  }
  return out;
})();

/* Per-gram price RANGES [min,max] (CC) from the official docs. The actual street
 * price for a drug is picked deterministically inside its range per COUNTRY, so
 * prices differ between countries (enabling buy-cheap-here / sell-dear-there). */
CF.drugRanges = {
  // raw narcotics
  "Hemp": [700, 800], "GHB": [1000, 1200], "Ecstasy": [1300, 1600], "PCP": [1400, 1800],
  "LSD": [1700, 2200], "Amphetamine": [2400, 3000], "Speed": [3300, 4000], "Heroin": [6200, 7000],
  "Crack": [13100, 15000], "Cocaine": [17000, 19000],
  // processed drugs
  "Hemaiin": [1400, 1800], "Heaven": [1600, 2000], "Atarax": [2600, 3800], "Guatsiid": [5800, 7000],
  "Monsatoon": [28000, 35000], "Exceed": [57000, 66000], "Maniogeen": [63000, 66000], "Pantox": [66000, 78000],
  "Halluciin": [78000, 93000], "Halluciit": [81000, 96000], "Pantoxiid": [105000, 123000], "Dimension": [108000, 126000],
  "Ketaliin": [138000, 159000], "Eentregan": [141000, 162000], "Datruxiid": [231000, 255000], "Celontiin": [234000, 258000],
  "Lazeriks": [471000, 501000], "Metalitaan": [932000, 1072000], "Sennaxiid": [1100000, 1400000], "Oomen": [1500000, 2100000],
};

/* Where you can deal — prices vary by country. */
CF.countries = [
  "Estonia", "Latvia", "Lithuania", "Finland", "Sweden", "Norway", "Denmark", "Germany", "Poland", "Russia",
  "Ukraine", "France", "Spain", "Italy", "Portugal", "Netherlands", "Belgium", "Austria", "Switzerland",
  "United Kingdom", "Ireland", "Greece", "Turkey", "Romania", "Bulgaria", "Hungary", "Czechia", "Croatia",
  "Serbia", "Albania", "Macedonia", "United States", "Canada", "Mexico", "Brazil", "Argentina", "Colombia",
  "Chile", "Peru", "China", "Japan", "South Korea", "India", "Thailand", "Vietnam", "Indonesia", "Philippines",
  "Australia", "New Zealand", "Egypt", "South Africa", "Nigeria", "Morocco", "Kenya", "Saudi Arabia",
  "United Arab Emirates", "Israel",
].sort();

CF.chemist = (function () {
  function P() { return CF.state.player; }
  function C() { return CF.state.chemist; }
  // deterministic per (country, drug) price inside the drug's range (FNV-1a hash)
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h >>> 0; }
  function priceIn(country, name) {
    var r = CF.drugRanges[name];
    if (!r) return CF.chemRecipes[name] ? CF.chemRecipes[name].price : (CF.narcotics[name] || 0);
    return r[0] + (hashStr((country || "") + "|" + name) % (r[1] - r[0] + 1));
  }
  var ok = function (m) { return { ok: true, msg: m }; };
  var fail = function (m) { return { ok: false, msg: m }; };

  function progress() {
    var lifetime = C().points || 0, lv = CF.formulas.levelFromLifetimeXP(lifetime);
    return { level: lv.level, lifetime: lifetime, pointsToLevel: Math.max(0, CF.formulas.pointsToNextLevel(lv.level) - lv.into) };
  }
  function recipe(name) { return CF.chemRecipes[name] || null; }
  function isDrug(name) { return !!CF.chemRecipes[name]; }
  function price(name) { return CF.chemRecipes[name] ? CF.chemRecipes[name].price : (CF.narcotics[name] || 0); }

  function beltUsed() { var t = 0, b = C().belt || {}; for (var k in b) t += b[k] || 0; return t; }
  function beltCap() { return C().beltCapacity || CF.ruleset.chemist.beltCapacity; }
  function beltRoom() { return Math.max(0, beltCap() - beltUsed()); }

  /* Largest belt the player's Fame permits (base 84 needs none). */
  function maxBeltForFame(fame) {
    var best = CF.ruleset.chemist.beltCapacity;
    CF.drugBelts.forEach(function (b) { if (fame >= b.reqFame && b.cap > best) best = b.cap; });
    return best;
  }
  /* Buy a bigger belt at the Drug belt counter (needs Fame + Money). */
  function buyBelt(cap) {
    var b = null; CF.drugBelts.forEach(function (x) { if (x.cap === cap) b = x; });
    if (!b) return fail("Choose a belt.");
    if (cap <= beltCap()) return fail("Your belt is already " + beltCap() + " g or larger.");
    if ((P().fame || 0) < b.reqFame) return fail("Needs " + fmt(b.reqFame) + " fame (you have " + fmt(P().fame || 0) + ").");
    if (P().money < b.price) return fail("Needs " + fmt(b.price) + " CC (you have " + fmt(P().money) + ").");
    P().money -= b.price; C().beltCapacity = cap;
    return ok("Bought the " + cap + " g drug belt for " + fmt(b.price) + " CC.");
  }

  /* Juicer: press plants from the closet into juice reserves. */
  function pressPlants(plantItem, qty) {
    qty = Math.floor(qty);
    if (!(qty > 0)) return fail("Enter how many plants to press.");
    var have = C().plants[plantItem] || 0;
    if (have <= 0) return fail("You have no " + plantItem + ".");
    var q = Math.min(qty, have), juice = plantItem.replace(/ plants$/, "") + " juice", ml = q * CF.ruleset.chemist.juicePerPlant;
    C().plants[plantItem] = have - q; if (C().plants[plantItem] <= 0) delete C().plants[plantItem];
    C().juices[juice] = (C().juices[juice] || 0) + ml;
    return ok("You pressed " + fmt(q) + " plants and got " + fmt(ml) + " ml of juice.");
  }

  /* Drug lab: mix qty g of narcotic + qty ml of the matching juice into qty g of
   * the drug (drug replaces the narcotic in the belt — net grams unchanged). */
  function mixDrug(drugName, qty) {
    var r = recipe(drugName); if (!r) return fail("Choose a drug to make.");
    if (r.level > progress().level) return fail(drugName + " needs Chemist level " + r.level + ".");
    qty = Math.floor(qty);
    if (!(qty > 0)) return fail("Enter a quantity.");
    var narc = r.narcotic, juice = r.juiceBase + " juice";
    if ((C().belt[narc] || 0) < qty) return fail("Not enough " + narc + " in the belt (need " + fmt(qty) + " g).");
    if ((C().juices[juice] || 0) < qty) return fail("Not enough " + juice + " (need " + fmt(qty) + " ml).");
    C().belt[narc] -= qty; if (C().belt[narc] <= 0) delete C().belt[narc];
    C().juices[juice] -= qty; if (C().juices[juice] <= 0) delete C().juices[juice];
    C().belt[drugName] = (C().belt[drugName] || 0) + qty;
    var pts = qty * (r.ptsPerG || 0);
    C().points = (C().points || 0) + pts;
    var res = ok("You made " + fmt(qty) + " g of the drug " + drugName + " and received " + fmt(pts) + " chemist points!");
    res.pts = pts; res.made = qty; res.drug = drugName;
    return res;
  }

  /* Laboratory Cabinet: sell juice on the market (nominal price — placeholder). */
  function sellJuice(juice, qty) {
    var have = C().juices[juice] || 0;
    if (have <= 0) return fail("You have no " + juice + ".");
    qty = Math.floor(qty); var q = Math.min(qty > 0 ? qty : have, have);
    var earned = q * CF.ruleset.chemist.juiceSellCC;
    C().juices[juice] -= q; if (C().juices[juice] <= 0) delete C().juices[juice];
    P().money += earned;
    return ok("Sold " + fmt(q) + " ml " + juice + " for " + fmt(earned) + " CC.");
  }

  /* Move plants from the backpack (from the garden) into the closet. */
  function unloadPlants() {
    var bp = C().backpackPlants;
    if (!bp || !bp.qty) return fail("Your backpack has no plants.");
    C().plants[bp.item] = (C().plants[bp.item] || 0) + bp.qty;
    C().backpackPlants = null;
    return ok("You put the plants from your backpack into the closet.");
  }

  /* Largest bigger belt the player can actually buy (fame + money), or null. */
  function bestBuyableBelt(fame, money, curCap) {
    var best = null;
    CF.drugBelts.forEach(function (b) { if (b.cap > curCap && fame >= b.reqFame && money >= b.price && (!best || b.cap > best.cap)) best = b; });
    return best;
  }

  /* Streets: buy raw narcotic at the CURRENT COUNTRY's price into the drug belt. */
  function buyDrug(narc, qty, country) {
    if (CF.narcotics[narc] == null) return fail("Unknown drug.");
    qty = Math.floor(qty);
    if (!(qty > 0)) return fail("Enter grams to buy.");
    var room = beltRoom(); if (room <= 0) return fail("The drug belt is full.");
    var pr = priceIn(country, narc), afford = Math.floor(P().money / pr), q = Math.min(qty, room, afford);
    if (q <= 0) return fail(afford <= 0 ? "Not enough money." : "The drug belt is full.");
    P().money -= q * pr; C().belt[narc] = (C().belt[narc] || 0) + q;
    return ok("Bought " + fmt(q) + " g " + narc + " for " + fmt(q * pr) + " CC." + (q < qty ? " (capped)" : ""));
  }

  /* Streets: sell all grams of a belt item at the CURRENT COUNTRY's price. */
  function sellBeltDrug(name, country) {
    var have = C().belt[name] || 0;
    if (have <= 0) return fail("No " + name + " to sell.");
    var earned = have * priceIn(country, name);
    delete C().belt[name]; P().money += earned;
    return ok("You earned " + fmt(earned) + " CC by selling drugs!");
  }

  return {
    progress: progress, recipe: recipe, isDrug: isDrug, price: price, priceIn: priceIn,
    beltUsed: beltUsed, beltCap: beltCap, beltRoom: beltRoom, maxBeltForFame: maxBeltForFame,
    buyBelt: buyBelt, bestBuyableBelt: bestBuyableBelt,
    pressPlants: pressPlants, mixDrug: mixDrug, sellJuice: sellJuice, unloadPlants: unloadPlants,
    buyDrug: buyDrug, sellBeltDrug: sellBeltDrug,
  };
})();
