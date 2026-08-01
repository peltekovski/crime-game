/* ============================================================================
 * blacksmith.js — Room 6 (Blacksmith): Anvil / Armory / Blacksmith Warehouse.
 *
 * Anvil forges WEAPONS from ALLOYS (the Furnaces' output) + a few blacksmith-
 * only materials. Uses the FORGING skill, which shares the universal level
 * curve (confirmed: 13,090,222 pts -> level 53). The "anvil level" caps how
 * many you can forge per click (prototype starts at 4).
 *
 * PROTOTYPE NOTE: only AK-47's recipe (0.2 kg Steel alloy/unit) and no XP are
 * known yet — the rest of the weapon recipes + forging XP are pending from the
 * user. The structure consumes that data when it arrives; `recipe = null` items
 * simply report "recipe not set yet".
 * ========================================================================== */
window.CF = window.CF || {};

/* Weapons — the Anvil's dropdown AND the Armory's sell list.
 * [name, type, level, buyer, price(CC)] straight off the Armory screen. */
CF.weapons = [
  ["AK-47", "Automatic weapon", 0, "Street children", 5400],
  ["MG4", "Machine gun", 10, "Street children", 14100],
  ["RPG-7", "Grenade launcher", 18, "Street children", 22500],
  ["Infrared binoculars", "Intelligence tool", 24, "Street children", 36000],
  ["M1A1", "Flamethrower", 30, "Ordinary citizens", 57900],
  ["M16", "Automatic weapon", 38, "Ordinary citizens", 114900],
  ["M24 SWS", "Sniper rifle", 46, "Ordinary citizens", 157800],
  ["M240B", "Machine gun", 53, "Reservists", 240000],
  ["LightSpeed binoculars", "Intelligence tool", 60, "Reservists", 339000],
  ["SPG-9", "Grenade launcher", 67, "Reservists", 426000],
  ["Bomb belt", "Sabotage tool", 73, "Military personnel", 570000],
  ["FMW 35", "Flamethrower", 78, "Military personnel", 654000],
  ["P90", "Automatic weapon", 83, "Military personnel", 798000],
  ["M110 SASS", "Sniper rifle", 87, "Mercenaries", 1020000],
  ["M2HB", "Machine gun", 91, "Mercenaries", 1200000],
  ["M32 MGL", "Grenade launcher", 95, "Mercenaries", 1500000],
  ["M82A1 SASR", "Sniper rifle", 98, "Special forces", 1830000],
  ["M9A1-7", "Flamethrower", 101, "Special forces", 2700000],
  ["Nuclear", "Automatic weapon", 120, "Special forces", 3000000000000],
];
CF.weaponByName = {};
CF.weapons.forEach(function (w) { CF.weaponByName[w[0]] = { name: w[0], type: w[1], level: w[2], buyer: w[3], price: w[4] }; });

CF.weaponSellDivisor = 4;   // direct-sell price = price/4 (AK-47 5,400 -> 1,350). OUR derivation (1 data point).

/* The anvil's material shelf. Alloys + uranium are Furnaces output (read from
 * CF.state.craft.made); Charcoal & TNT come from a small blacksmith pool
 * (source unknown — pending). All measured in kg. */
CF.anvilMaterials = [
  { disp: "Steel alloy",        src: "craft", key: "Steel Alloy" },
  { disp: "Titanium alloy (1)", src: "craft", key: "Titanium Alloy (1)" },
  { disp: "Titanium alloy (2)", src: "craft", key: "Titanium Alloy (2)" },
  { disp: "Titanium alloy (3)", src: "craft", key: "Titanium Alloy (3)" },
  { disp: "Titanium alloy (4)", src: "craft", key: "Titanium Alloy (4)" },
  { disp: "Enriched uranium",   src: "craft", key: "Enriched uranium" },
  { disp: "Charcoal",           src: "black", key: "Charcoal" },
  { disp: "TNT",                src: "black", key: "TNT" },
];

/* Forge recipes — keyed by item name. `mats` per-unit kg; `xp` per craft (exact
 * observed table, NOT a formula; null = not observed, all above level 53).
 * `output`: 'material' (TNT -> blacksmith material pool) else finished (made
 * pool: weapons -> Armory, Steel plate -> Warehouse). `money` = extra CC cost. */
CF.weaponRecipes = {
  "AK-47":                { level: 0,   mats: [{ disp: "Steel alloy", perUnit: 0.2 }],        xp: 5 },
  "MG4":                  { level: 10,  mats: [{ disp: "Titanium alloy (1)", perUnit: 0.2 }], xp: 15 },
  "RPG-7":                { level: 18,  mats: [{ disp: "Steel alloy", perUnit: 0.4 }],        xp: 38 },
  "Infrared binoculars":  { level: 24,  mats: [{ disp: "Steel alloy", perUnit: 0.1 }],        xp: 75 },
  "M1A1":                 { level: 30,  mats: [{ disp: "Titanium alloy (1)", perUnit: 0.5 }], xp: 147 },
  "M16":                  { level: 38,  mats: [{ disp: "Titanium alloy (1)", perUnit: 0.2 }], xp: 362 },
  "M24 SWS":              { level: 46,  mats: [{ disp: "Titanium alloy (2)", perUnit: 0.3 }], xp: 891 },
  "Steel plate":          { level: 50,  mats: [{ disp: "Steel alloy", perUnit: 1 }],          xp: 1398, output: "warehouse" },
  "M240B":                { level: 53,  mats: [{ disp: "Titanium alloy (2)", perUnit: 0.2 }], xp: 1960 },
  "LightSpeed binoculars":{ level: 60,  mats: [{ disp: "Titanium alloy (1)", perUnit: 0.1 }], xp: null },
  "SPG-9":                { level: 67,  mats: [{ disp: "Titanium alloy (1)", perUnit: 0.4 }], xp: null },
  "Bomb belt":            { level: 73,  mats: [{ disp: "Titanium alloy (3)", perUnit: 0.3 }], xp: null },
  "FMW 35":               { level: 78,  mats: [{ disp: "Titanium alloy (2)", perUnit: 0.5 }], xp: null },
  "P90":                  { level: 83,  mats: [{ disp: "Titanium alloy (2)", perUnit: 0.2 }], xp: null },
  "M110 SASS":            { level: 87,  mats: [{ disp: "Titanium alloy (3)", perUnit: 0.3 }], xp: null },
  "M2HB":                 { level: 91,  mats: [{ disp: "Titanium alloy (3)", perUnit: 0.2 }], xp: null },
  "M32 MGL":              { level: 95,  mats: [{ disp: "Titanium alloy (3)", perUnit: 0.4 }], xp: null },
  "M82A1 SASR":           { level: 98,  mats: [{ disp: "Titanium alloy (4)", perUnit: 0.3 }], xp: null },
  "M9A1-7":               { level: 101, mats: [{ disp: "Titanium alloy (4)", perUnit: 0.5 }], xp: null },
  "TNT":                  { level: 110, mats: [{ disp: "Charcoal", perUnit: 1 }, { disp: "Titanium alloy (4)", perUnit: 50 }], xp: null, output: "material" },
  "Nuclear":              { level: 120, moneyPct: 0.001, moneyMin: 1000000000,   // official docs: 0.1% of (bank+cash), min 1,000,000,000 CC
    mats: [{ disp: "TNT", perUnit: 1200 }, { disp: "Titanium alloy (4)", perUnit: 1740 }, { disp: "Enriched uranium", perUnit: 440 }], xp: null },
};
/* Forgeable item names ordered by level — drives the Anvil dropdown. */
CF.forgeOrder = Object.keys(CF.weaponRecipes).sort(function (a, b) { return CF.weaponRecipes[a].level - CF.weaponRecipes[b].level; });

/* To upgrade the anvil (level N -> N+1). From the "Improve the anvil" screen. */
CF.anvilUpgrade = { reqForging: 60, reqHouseLevel: 9, priceQty: 5000, priceMat: "Titanium alloy (2)" };

/* Blacksmith Warehouse "Remaining forged items". USP45 is the ∞ base pistol.
 * Steel plate lives in the made pool, TNT in the material pool. */
CF.blacksmithWarehouse = [
  { name: "USP45", level: null, price: null, src: null },
  { name: "Steel plate", level: 50, price: 337500, src: "made" },
  { name: "TNT", level: 110, price: 1200000, src: "material" },
];

/* FRESH ACCOUNT: anvil level 1 (the real game's starting value), Forging 1,
 * nothing forged. */
CF.blacksmithStart = {
  anvilLevel: 1,
  forgingPoints: 0,
  made: {},
  materials: { "Charcoal": 0, "TNT": 0 },   // Charcoal comes from MINING (not built); TNT is forged here
  houseLevel: 0,               // superseded by player.houseLevel; kept for old saves
};

CF.blacksmith = (function () {
  function P() { return CF.state.player; }
  function B() { return CF.state.blacksmith; }
  var ok = function (m) { return { ok: true, msg: m }; };
  var fail = function (m) { return { ok: false, msg: m }; };

  function forgingProgress() {
    var lifetime = B().forgingPoints || 0;
    var lv = CF.formulas.levelFromLifetimeXP(lifetime);
    return { level: lv.level, lifetime: lifetime, pointsToLevel: Math.max(0, CF.formulas.pointsToNextLevel(lv.level) - lv.into) };
  }
  function anvilLevel() { return B().anvilLevel; }
  function recipe(name) { return CF.weaponRecipes[name] || null; }
  function sellPrice(w) { return Math.floor(w.price / CF.weaponSellDivisor); }

  function matQty(disp) {
    var m = null; CF.anvilMaterials.forEach(function (x) { if (x.disp === disp) m = x; });
    if (!m) return 0;
    return m.src === "craft" ? (CF.state.craft.made[m.key] || 0) : (B().materials[m.key] || 0);
  }
  function consumeMat(disp, amt) {
    var m = null; CF.anvilMaterials.forEach(function (x) { if (x.disp === disp) m = x; });
    if (!m) return;
    if (m.src === "craft") CF.state.craft.made[m.key] = (CF.state.craft.made[m.key] || 0) - amt;
    else B().materials[m.key] = (B().materials[m.key] || 0) - amt;
  }

  /* Money cost of forging `qty` of a recipe. Flat (`money`) or, for Nuclear,
   * a wealth percentage with a floor (`moneyPct`/`moneyMin`, official docs:
   * 0.1% of bank+cash, min 1B). Wealth is read once (not recomputed per unit). */
  function moneyCost(r, qty) {
    if (!r) return 0;
    if (r.money) return r.money * qty;
    if (r.moneyPct) {
      var wealth = (P().money || 0) + (P().bank || 0);
      return Math.max(r.moneyMin || 0, Math.round(r.moneyPct * wealth)) * qty;
    }
    return 0;
  }

  /* Forge up to anvilLevel items per click. Handles material recipes (TNT),
   * warehouse output (Steel plate), and Nuclear's extra money cost. */
  function forge(name, qty) {
    var r = recipe(name); if (!r) return fail("Choose an item to forge.");
    if (r.level > forgingProgress().level) return fail(name + " needs Smithing level " + r.level + ".");
    qty = Math.floor(qty);
    if (!(qty > 0)) return fail("Pick a quantity.");
    if (qty > anvilLevel()) return fail("Your anvil forges at most " + anvilLevel() + " at once.");
    var mcost = moneyCost(r, qty);
    if (mcost && P().money < mcost) return fail("Not enough money (need " + fmt(mcost) + " CC).");
    var miss = null;
    r.mats.forEach(function (m) { if (!miss && matQty(m.disp) < m.perUnit * qty) miss = m.disp; });
    if (miss) return fail("Not enough " + miss + ".");

    if (mcost) P().money -= mcost;
    r.mats.forEach(function (m) { consumeMat(m.disp, m.perUnit * qty); });
    if (r.output === "material") B().materials[name] = (B().materials[name] || 0) + qty;
    else B().made[name] = (B().made[name] || 0) + qty;

    var xp = (r.xp || 0) * qty;   // per-unit XP null for level 60+ -> 0 until observed
    B().forgingPoints += xp;
    var res = ok(xp ? "The forging was successful and you earned " + fmt(xp) + " points." : "The forging was successful.");
    res.xp = xp;
    return res;
  }

  function sellWeapon(name, qty) {
    var have = B().made[name] || 0, w = CF.weaponByName[name];
    if (!w) return fail("Unknown weapon.");
    var price = sellPrice(w);
    qty = Math.floor(qty);
    var q = Math.min(qty > 0 ? qty : have, have);
    if (q <= 0) return fail("No " + name + " to sell.");
    B().made[name] = have - q;
    if (B().made[name] < 1e-9) B().made[name] = 0;
    P().money += q * price;
    return ok("Sold " + fmt(q) + " " + name + " for " + fmt(q * price) + " CC.");
  }

  /* Blacksmith Warehouse quantities + selling (Steel plate from made, TNT from
   * materials). USP45 is the ∞ base pistol and isn't sellable. */
  function warehouseQty(item) {
    if (!item.src) return Infinity;
    return item.src === "made" ? (B().made[item.name] || 0) : (B().materials[item.name] || 0);
  }
  function sellWarehouse(name, qty) {
    var item = null; CF.blacksmithWarehouse.forEach(function (x) { if (x.name === name) item = x; });
    if (!item || item.price == null) return fail("This item can't be sold.");
    var have = warehouseQty(item);
    qty = parseFloat(qty);
    var q = Math.min(qty > 0 ? qty : have, have);
    if (q <= 0) return fail("No " + name + " to sell.");
    if (item.src === "made") B().made[name] -= q; else B().materials[name] -= q;
    P().money += Math.round(q * item.price);
    return ok("Sold " + fmt(q) + " " + name + " for " + fmt(Math.round(q * item.price)) + " CC.");
  }

  /* Anvil upgrade: needs Smithing level, House level and the material price. */
  function upgradeStatus() {
    var u = CF.anvilUpgrade, prog = forgingProgress();
    return {
      forgingOk: prog.level >= u.reqForging,
      houseOk: (P().houseLevel || 0) >= u.reqHouseLevel,   // house level is a player-global gate now
      matOk: matQty(u.priceMat) >= u.priceQty,
      reqForging: u.reqForging, reqHouse: u.reqHouseLevel, priceQty: u.priceQty, priceMat: u.priceMat,
    };
  }
  function upgradeAnvil() {
    var s = upgradeStatus(), u = CF.anvilUpgrade;
    if (!s.forgingOk) return fail("Needs Smithing level " + u.reqForging + " (you are " + forgingProgress().level + ").");
    if (!s.houseOk) return fail("Needs House level " + u.reqHouseLevel + ".");
    if (!s.matOk) return fail("Needs " + fmt(u.priceQty) + " kg " + u.priceMat + ".");
    consumeMat(u.priceMat, u.priceQty);
    B().anvilLevel += 1;
    return ok("Anvil improved to level " + B().anvilLevel + "!");
  }

  return {
    forgingProgress: forgingProgress, anvilLevel: anvilLevel, recipe: recipe,
    sellPrice: sellPrice, matQty: matQty, moneyCost: moneyCost, forge: forge, sellWeapon: sellWeapon,
    upgradeStatus: upgradeStatus, upgradeAnvil: upgradeAnvil,
    warehouseQty: warehouseQty, sellWarehouse: sellWarehouse,
  };
})();
