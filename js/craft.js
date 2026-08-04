/* ============================================================================
 * craft.js — Crafts room (Your house) + the market's Craft supplies counter.
 *
 * THE LOOP (as observed):
 *   Craft cabinet  --"Go to the market" / click a supply number-->
 *   Slum > Market > Craft supplies counter
 *     pick ONE material, "Buy a backpack full of selected materials"
 *     -> costs backpackCapacity * unitPrice in CC (= MONEY)
 *     -> the goods land in your BACKPACK, not the closet
 *   --"Now take them out of your backpack and into your closet"-->
 *   Craft cabinet, "Put craft supplies from your backpack into your closet"
 *     -> backpack empties into the craft supplies (closet)
 *
 * The backpack carries ONE material at a time and holds backpackCapacity units.
 * ========================================================================== */
window.CF = window.CF || {};

CF.craft = (function () {
  function P() { return CF.state.player; }
  function C() { return CF.state.craft; }
  var ok = function (m) { return { ok: true, msg: m }; };
  var fail = function (m) { return { ok: false, msg: m }; };

  // backpack grows 5 a level off a base of 130 at Crafting 1 (observed)
  function capacity() {
    var c = CF.ruleset.craft;
    return c.backpackBase + (progress().level - 1) * c.backpackPerLevel;
  }

  function unitPrice(name) {
    var found = 0;
    CF.ruleset.craft.materials.forEach(function (m) { if (m[0] === name) found = m[1]; });
    return found;
  }
  /* A full backpack of this material costs capacity * unit price. */
  function backpackCost(name) { return capacity() * unitPrice(name); }

  /* Buy a whole backpack of one material, paying MONEY. */
  function buyBackpack(name) {
    if (!name) return fail("Select a material first.");
    if (!unitPrice(name)) return fail("Unknown material.");
    if (C().backpack) return fail("Your backpack is full — empty it into your closet first.");
    var cost = backpackCost(name);
    if (P().money < cost) return fail("Not enough money (need " + fmt(cost) + " CC).");
    P().money -= cost;
    C().backpack = { item: name, qty: capacity() };
    return ok("Purchase of craft materials was successful!");
  }

  /* Move everything from the backpack into the craft cabinet (closet). */
  function emptyBackpack() {
    var b = C().backpack;
    if (!b) return fail("Your backpack is empty.");
    C().supplies[b.item] = (C().supplies[b.item] || 0) + b.qty;
    C().backpack = null;
    return ok("Put " + fmt(b.qty) + " " + b.item + " into your closet.");
  }

  /* ---------------- the three work stations (room 1) -------------------- */

  /* All stations share ONE Craft level/points pool, on the same curve the
   * Barkeeping uses. Level is derived from the lifetime points. */
  function progress() {
    var lifetime = C().points || 0;
    var lv = CF.formulas.levelFromLifetimeXP(lifetime);
    return {
      level: lv.level, lifetime: lifetime,
      pointsToLevel: Math.max(0, CF.formulas.pointsToNextLevel(lv.level) - lv.into),
    };
  }

  function itemsFor(stationId) {
    return CF.craftItems.filter(function (i) { return i.s === stationId; })
      .sort(function (a, b) { return a.lvl - b.lvl; });
  }
  function itemByName(name) {
    var f = null;
    CF.craftItems.forEach(function (i) { if (i.name === name) f = i; });
    return f;
  }
  /* Which supplies a station uses, in the canonical display order. */
  function materialsFor(stationId) {
    var used = {};
    itemsFor(stationId).forEach(function (i) {
      i.mats.forEach(function (m) { used[CF.craftMaterialKey[m]] = true; });
    });
    return CF.craftMaterialOrder.filter(function (k) { return used[k]; });
  }
  function isUnlocked(item) { return item.lvl <= progress().level; }

  /* Craft one item: consumes 1 of each material (OUR choice — quantities were
   * never shown), yields 1 unit, and awards the item's observed points. */
  /* The bench an item is made at, and the tools that bench needs. */
  function stationOf(id) {
    var s = null;
    CF.craftStations.forEach(function (x) { if (x.id === id) s = x; });
    return s;
  }
  function toolsOwned() { return C().tools || (C().tools = {}); }
  function hasTool(name) { return !!toolsOwned()[name]; }
  /* Which of a bench's tools you are still missing. */
  function missingTools(stationId) {
    var s = stationOf(stationId);
    if (!s || !s.tools) return [];
    return s.tools.filter(function (t) { return !hasTool(t); });
  }
  function stationReady(stationId) { return missingTools(stationId).length === 0; }

  function craftItem(item) {
    if (!item) return fail("Choose an item to make.");
    if (!isUnlocked(item)) return fail(item.name + " needs Craft level " + item.lvl + ".");
    /* You cannot work a bench without its tools. A fresh account owns none, so
       this is the first wall a new player meets in the crafts room. */
    var need = missingTools(item.s);
    if (need.length) {
      var f = fail("You need " + need.join(" and ") + " to work here — buy them at the market.");
      f.missingTools = need;
      return f;
    }
    var miss = null;
    item.mats.forEach(function (m) {
      var key = CF.craftMaterialKey[m];
      if (!miss && (C().supplies[key] || 0) < 1) miss = key;
    });
    if (miss) return fail("Out of " + miss + " — buy more at the market.");

    item.mats.forEach(function (m) {
      var key = CF.craftMaterialKey[m];
      C().supplies[key] -= 1;
    });
    C().made[item.name] = (C().made[item.name] || 0) + 1;

    var pts = item.pts || 0;           // null = never observed; award nothing
    C().points = (C().points || 0) + pts;
    var r = ok("You crafted an item and earned " + fmt(pts) + " points.");
    r.pts = pts; r.unknownPoints = item.pts == null;
    return r;
  }

  /* Sell finished items from the cabinet, earning MONEY (CC). qty may be
   * fractional for kg-measured alloys; it is capped at what you have. */
  function sellFinished(name, qty) {
    var have = C().made[name] || 0;
    var price = CF.craftPrices[name];
    if (price == null) return fail("This item can't be sold yet.");
    qty = parseFloat(qty);
    if (!(qty > 0)) return fail("Enter a quantity to sell.");
    var q = Math.min(qty, have);
    if (q <= 0) return fail("You have no " + name + " to sell.");
    C().made[name] = have - q;
    if (C().made[name] < 1e-6) C().made[name] = 0;   // avoid kg rounding dust
    var earned = Math.round(q * price);
    P().money += earned;
    var it = itemByName(name), unit = it && it.unit ? " " + it.unit : "";
    return ok("Sold " + fmt(q) + unit + " " + name + " for " + fmt(earned) + " CC.");
  }

  return {
    capacity: capacity, unitPrice: unitPrice, backpackCost: backpackCost,
    buyBackpack: buyBackpack, emptyBackpack: emptyBackpack,
    progress: progress, itemsFor: itemsFor, itemByName: itemByName,
    materialsFor: materialsFor, isUnlocked: isUnlocked, craftItem: craftItem,
    stationOf: stationOf, hasTool: hasTool, missingTools: missingTools, stationReady: stationReady,
    sellFinished: sellFinished,
  };
})();
