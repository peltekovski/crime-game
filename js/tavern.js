/* ============================================================================
 * tavern.js — the functional tavern system.
 *
 * THE LOOP (corrected to match the reference game):
 *  - Telephone: buy raw materials, paying CREDITS (CC), 1 CC/unit.
 *  - Juicer #1: press raw materials into raw juice.
 *  - Stations: MIX drinks one click at a time. Each click consumes 1 of each
 *    ingredient and produces `drinkPerClick(reputation)` finished drinks, plus
 *    Bartending experience. There is no batch quantity — you click.
 *  - Update (runUpdate, fired by the "time until update" timer): if the tavern
 *    is open, up to clientsPer10Min(reputation) customers arrive and buy drinks
 *    automatically. Stock drops, you earn MONEY, and reputation rises when you
 *    sold something. You're told if you ran out of drinks.
 *
 * No balance numbers live here — they come from CF.ruleset via CF.formulas.
 * Warehouse capacity is a SHARED TOTAL per warehouse (see ruleset.js).
 * ========================================================================== */
window.CF = window.CF || {};

CF.tavern = (function () {
  function P() { return CF.state.player; }
  function INV() { return CF.state.inv; }
  var ok = function (m) { return { ok: true, msg: m }; };
  var fail = function (m) { return { ok: false, msg: m }; };

  function cap(kind) { return CF.formulas.warehouseCap(kind, P().drinkMasterLevel); }
  function storeFor(kind) {
    return kind === "material" ? INV().materials
         : kind === "rawjuice" ? INV().rawJuice : INV().finished;
  }
  function whStore(whKind) {
    return whKind === "materials" ? INV().materials
         : whKind === "rawjuice"  ? INV().rawJuice : INV().finished;
  }
  function totalOf(store) { var t = 0; for (var k in store) if (store.hasOwnProperty(k)) t += store[k] || 0; return t; }
  // Ready-to-sell (finished) has NO storage limit — stockpile millions.
  // Materials & juice keep the shared-total cap unless enforcement is off.
  function roomIn(whKind) {
    if (whKind === "finished") return Infinity;
    return CF.ruleset.enforceCapacity ? cap(whKind) - totalOf(whStore(whKind)) : Infinity;
  }
  function usedIn(whKind) { return totalOf(whStore(whKind)); }
  function availableOf(resolved) { return resolved ? (storeFor(resolved.kind)[resolved.key] || 0) : 0; }

  /* -- Telephone: buy raw materials --------------------------------------
   * Costs MONEY: "CC" is the Money balance (confirmed at the market, where a
   * CC purchase debited Money exactly). Credits stay untouched — they're the
   * separate premium currency. */
  function buyMaterial(material, qty) {
    qty = Math.floor(qty);
    if (!(qty > 0)) return fail("Enter a quantity greater than zero.");
    if (INV().materials[material] == null) return fail("Choose a raw material.");
    var price = CF.formulas.materialPrice(P().reputation);   // scales with reputation (docs)
    var room = roomIn("materials");
    if (room <= 0) return fail("Raw materials warehouse is full (cap " + fmt(cap("materials")) + ").");
    var afford = price > 0 ? Math.floor(P().money / price) : Infinity;
    var q = Math.min(qty, room, afford);
    if (q <= 0) return fail("Not enough money (need " + fmt(qty * price) + " CC).");
    P().money -= q * price;
    INV().materials[material] += q;
    return ok("Ordered " + fmt(q) + " " + material + " for " + fmt(q * price) + " CC." +
      (q < qty ? " (capped to fit/afford)" : ""));
  }

  /* -- Juicer #1: press a raw material into raw juice --------------------- */
  function pressJuice(material, qty) {
    qty = Math.floor(qty);
    if (!(qty > 0)) return fail("Enter a quantity greater than zero.");
    var juice = CF.juiceMap[material];
    if (!juice) return fail("Choose a fruit that can be pressed.");
    var have = INV().materials[material] || 0;
    if (have <= 0) return fail("No " + material + " in the raw-materials warehouse.");
    var perUnit = CF.ruleset.juiceLitersPerUnit;
    var room = roomIn("rawjuice");
    if (room <= 0) return fail("Raw juice warehouse is full (cap " + fmt(cap("rawjuice")) + " L).");
    var q = Math.min(qty, have, Math.floor(room / perUnit));
    if (q <= 0) return fail("Not enough " + material + " or juice space.");
    INV().materials[material] -= q;
    INV().rawJuice[juice] += q * perUnit;
    return ok("Pressed " + fmt(q) + " " + material + " -> " + fmt(q * perUnit) + " L " + juice + "." + (q < qty ? " (capped)" : ""));
  }

  /* -- Mixing (one click) ------------------------------------------------- */
  function isUnlocked(recipe) { return recipe.unlockLevel <= P().drinkMasterLevel; }

  function mixDrink(recipe) {
    if (!recipe) return fail("Choose a drink to make.");
    if (!isUnlocked(recipe)) return fail(recipe.name + " needs Bartending level " + recipe.unlockLevel + ".");

    // need at least one of each ingredient
    var miss = null;
    recipe.ingredients.forEach(function (g) {
      var r = CF.graph.resolveItem(g.item);
      if (availableOf(r) < g.qty && !miss) miss = g.item;
    });
    if (miss) return fail("Out of " + miss + " — buy or press more first.");

    var room = roomIn("finished");
    if (room <= 0) return fail("Ready-to-sell warehouse is full — wait for the next update to sell.");

    var perClick = CF.formulas.drinkPerClick(P().reputation);
    var made = Math.min(perClick, room);
    if (made <= 0) return fail("No room for more drinks.");

    // one click consumes one unit of each ingredient
    recipe.ingredients.forEach(function (g) {
      var r = CF.graph.resolveItem(g.item);
      storeFor(r.kind)[r.key] -= g.qty;
    });
    INV().finished[recipe.name] += made;

    // experience -> Bartending level. CONFIRMED: a flat amount per click set
    // by the DRINK's level (reference table), independent of drinks-made/reputation.
    var xp = CF.formulas.xpForDrinkLevel(recipe.unlockLevel);
    P().drinkMasterPoints += xp;
    P().dmLifetime = (P().dmLifetime || 0) + xp;
    var leveled = 0;
    while (P().drinkMasterPoints >= CF.formulas.pointsToNextLevel(P().drinkMasterLevel)) {
      P().drinkMasterPoints -= CF.formulas.pointsToNextLevel(P().drinkMasterLevel);
      P().drinkMasterLevel += 1;
      leveled += 1;
    }
    var r = ok("Made drinks and earned " + fmt(xp) + " points.");
    r.made = made; r.xp = xp; r.name = recipe.name; r.leveled = leveled;
    return r;
  }

  /* -- Update: customers arrive and buy automatically --------------------- */
  function runUpdate() {
    var res = { customers: 0, sold: 0, earned: 0, repGain: 0, stock: 0, outOfDrinks: false, closed: false };
    var total = 0; CF.finishedNames.forEach(function (n) { total += INV().finished[n] || 0; });
    res.stock = total;

    if (!P().tavernOpen) { res.closed = true; return res; }

    var customers = Math.round(CF.formulas.clientsPer10Min(P().reputation));
    res.customers = customers;

    var sold = Math.min(total, customers);
    // sell priciest drinks first
    var names = CF.finishedNames.filter(function (n) { return (INV().finished[n] || 0) > 0; })
      .sort(function (a, b) { return CF.recipeByName[b].price_CC - CF.recipeByName[a].price_CC; });
    var remaining = sold, earned = 0;
    for (var i = 0; i < names.length && remaining > 1e-9; i++) {
      var n = names[i];
      var take = Math.min(INV().finished[n], remaining);
      INV().finished[n] -= take;
      earned += take * CF.recipeByName[n].price_CC;
      remaining -= take;
    }
    res.sold = sold; res.earned = Math.round(earned);
    P().money += res.earned;

    // Reputation: satisfied clients raise it, unsatisfied ones (open tavern,
    // not enough stock) LOWER it (official docs). Net can be negative.
    var unsatisfied = Math.max(0, customers - sold);
    res.unsatisfied = unsatisfied;
    if (customers > 0) {
      var lvl = P().drinkMasterLevel;
      var repMax = CF.formulas.repMax(lvl);
      var before = P().reputation;
      var gain = sold > 0 ? CF.formulas.repGainPerBatch(sold, before, lvl) : 0;
      var loss = unsatisfied > 0 ? CF.formulas.repLossPerBatch(unsatisfied, before, lvl) : 0;
      var net = Math.round(gain - loss);
      P().reputation = Math.max(0, Math.min(before + net, Math.max(before, repMax)));
      res.repGain = P().reputation - before;   // signed: negative when clients go unserved
    }
    res.outOfDrinks = total < customers;   // demand exceeded supply
    return res;
  }

  function toggleTavern() {
    P().tavernOpen = !P().tavernOpen;
    return ok("Tavern is now " + (P().tavernOpen ? "OPEN - customers will buy on each update." : "CLOSED - no customers."));
  }

  function clearItem(whKind, key) {
    var store = whStore(whKind);
    if (store[key] == null) return fail("Unknown item.");
    store[key] = 0;
    return ok("Cleared " + key + ".");
  }

  /* -- "Best drink to make" — CONFIRMED: the HIGHEST-level unlocked drink,
   * i.e. the most XP per click (reference showed Plum lemonade(Level67) at
   * player level 67, White tequila(Level66) at level 66). */
  function bestDrink(level) {
    level = level == null ? P().drinkMasterLevel : level;
    var best = null;
    CF.recipes.forEach(function (r) {
      if (r.unlockLevel > level) return;
      if (!best || r.unlockLevel > best.unlockLevel) best = r;
    });
    return best;
  }

  /* -- Calculator panel — mirrors the in-game calculator ------------------
   * Inputs: tavern reputation, current Drink stock, total Bartending Points.
   * The level is DERIVED from the lifetime points (as the real one does). */
  function calculate(rep, drinks, lifetimePoints) {
    var f = CF.formulas;
    var lv = f.levelFromLifetimeXP(lifetimePoints);
    var level = lv.level;
    var pointsToLevel = Math.max(0, f.pointsToNextLevel(level) - lv.into);
    var best = bestDrink(level);
    var xpPerClick = best ? f.xpForDrinkLevel(best.unlockLevel) : 0;
    return {
      clientsPer10Min: Math.round(f.clientsPer10Min(rep)),
      drinkPerClick: f.drinkPerClick(rep),
      repForDrinks: Math.round(f.repGainPerBatch(drinks, rep, level)),
      drinkContinuesSec: f.drinkContinuesSeconds(drinks, rep, level),
      clicksToMake: f.clicksToMakeBatch(drinks, rep),   // CONFIRMED formula
      rawMaterialPrice: f.materialPrice(rep),   // scales with reputation (docs)
      level: level,
      pointsToLevel: pointsToLevel,
      nextLevel: level + 1,
      clicksToNextLevel: xpPerClick > 0 ? Math.ceil(pointsToLevel / xpPerClick) : Infinity,
      bestDrink: best ? best.name : "-",
      bestDrinkLevel: best ? best.unlockLevel : 0,
      bestDrinkPrice: best ? best.price_CC : 0,
    };
  }

  return {
    cap: cap, roomIn: roomIn, usedIn: usedIn, availableOf: availableOf, isUnlocked: isUnlocked,
    buyMaterial: buyMaterial, pressJuice: pressJuice, mixDrink: mixDrink, runUpdate: runUpdate,
    toggleTavern: toggleTavern, clearItem: clearItem, bestDrink: bestDrink, calculate: calculate,
  };
})();

/* Number formatter shared across the UI (thousands separators). */
function fmt(n) {
  if (n === Infinity) return "∞";
  if (typeof n !== "number" || !isFinite(n)) return String(n);
  return Math.round(n * 100) / 100 === Math.round(n)
    ? Math.round(n).toLocaleString("en-US")
    : (Math.round(n * 10) / 10).toLocaleString("en-US");
}
