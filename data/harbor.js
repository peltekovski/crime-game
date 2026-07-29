/* ============================================================================
 * harbor.js — the HARBOR (the reference's "Port"). The only source of fish.
 * ----------------------------------------------------------------------------
 * Two tabs: Shipyard (upgrade the boat) and Fishing vessel (Control Center /
 * Ship Data / Ship Crew). Send the boat out with a fishing crew and a defense
 * team, wait out the round trip, and the catch lands in the canteen's fish
 * warehouse.
 *
 * VIP is excluded, and the user chose the VIP behaviour: the boat can be
 * REFITTED AND AT SEA AT THE SAME TIME. The reference's "VIP members can do
 * both at once" note is therefore left out — everyone can.
 * NAMES: the reference's "Better engine" is Estonian "parem mootor" — parem
 * means both BETTER and RIGHT, and it sits opposite a "Left engine", so it is
 * the RIGHT engine.
 * ========================================================================== */
window.CF = window.CF || {};

/* The five shipyard upgrades, in the reference's own order. */
CF.shipUpgrades = [
  { key: "equipment", name: "Fishing equipment", desc: "upgrade to catch better fish" },
  { key: "cargo",     name: "Cargo capacity",    desc: "upgrade to transport larger quantities" },
  { key: "engineR",   name: "Right engine",      desc: "upgrade to cover distance faster" },
  { key: "engineL",   name: "Left engine",       desc: "upgrade to cover distance faster" },
  { key: "armament",  name: "Ship armament",     desc: "upgrade to protect your catch" },
];

/* Crew tiers. `req` is the general ship level (fishing) or armament level
 * (defense); `pay` is ONE man's salary. Both ladders share the same numbers. */
CF.fishingCrews = [
  { name: "Fishing vagrants",       desc: "inexperienced fishermen",              req: 1,  pay: 5001 },
  { name: "Self-proclaimed fishermen", desc: "fishermen with little experience",  req: 15, pay: 55625 },
  { name: "Young fishermen",        desc: "stand out with their diligence",       req: 40, pay: 2565000 },
  { name: "Experienced fishermen",  desc: "there is no fish they can't catch",    req: 70, pay: 24015000 },
  { name: "Old sea bears",          desc: "the best fishermen you can find",      req: 90, pay: 65615000 },
];
CF.defenseCrews = [
  { name: "Russian war veterans",   desc: "only suitable in the absence of a better one", req: 1,  pay: 5001 },
  { name: "Iraqi freedom fighters", desc: "their accuracy leaves much to be desired",     req: 15, pay: 55625 },
  { name: "Korean mercenaries",     desc: "highly trained weapons handlers",              req: 40, pay: 2565000 },
  { name: "Colombian elite soldiers", desc: "soldiers with extensive experience",         req: 70, pay: 24015000 },
  { name: "Pirate Island Fighters", desc: "complete ship defense experts",                req: 90, pay: 65615000 },
];

/* Fish species, level-ordered — the same 42 the canteen cooks with, one per
 * fish recipe. Your FISHING EQUIPMENT level decides how deep the list you can
 * reach ("What fish can be caught: Level 5"). */
CF.fishSpecies = CF.fishDishes.map(function (d, i) { return { name: d.fish, lvl: 2 * i + 1 }; });

CF.harbor = (function () {
  function P() { return CF.state.player; }
  function H() { return CF.state.harbor; }
  var ok = function (m, x) { var r = { ok: true, msg: m }; if (x) for (var k in x) r[k] = x[k]; return r; };
  var fail = function (m) { return { ok: false, msg: m }; };
  function n2(n) { return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  function owned() { return !!H().owned; }
  function buyShip() {
    if (owned()) return fail("You already have a fishing vessel.");
    var price = CF.ruleset.harbor.shipPriceCC;
    if (P().money < price) return fail("You don't have enough cash (" + n2(price - P().money) + " CC missing)!");
    P().money -= price; H().owned = true;
    return ok("You bought the old cargo ship — it is yours to fix up!");
  }

  function lvl(key) { return H().ship[key] || 1; }
  /* Overall ship level = the mean of the five upgrades, floored (reference:
   * equipment 5 + four 1s -> "Overall ship level: 1/100"). */
  function overallLevel() {
    var t = 0; CF.shipUpgrades.forEach(function (u) { t += lvl(u.key); });
    return Math.floor(t / CF.shipUpgrades.length);
  }
  var MAXLVL = 100;

  /* ---- Shipyard --------------------------------------------------------- */
  /* Cost and time both scale with the CURRENT level of that upgrade. Fitted
   * from the reference's two readings: level 1 -> 10,001 CC / 12 h and
   * level 5 -> 13,125 CC / 16 h. */
  function upgradeCost(key) { return CF.ruleset.harbor.upgradeBase + CF.ruleset.harbor.upgradeStep * (lvl(key) - 1); }
  function upgradeHours(key) { return CF.ruleset.harbor.upgradeHoursBase + lvl(key); }
  function refit() { return H().refit; }          // { key, endsAt, hours, cost } or null
  function refitLeft() { var r = refit(); return r ? Math.max(0, Math.round((r.endsAt - Date.now()) / 1000)) : 0; }
  function refitDone() { var r = refit(); return r && Date.now() >= r.endsAt; }
  /* A finished refit is banked the moment you look at the harbor. */
  function settleRefit() {
    if (!refitDone()) return null;
    var r = H().refit; H().refit = null;
    H().ship[r.key] = (H().ship[r.key] || 1) + 1;
    var u = null; CF.shipUpgrades.forEach(function (x) { if (x.key === r.key) u = x; });
    return { key: r.key, name: u ? u.name : r.key, level: H().ship[r.key] };
  }
  function startRefit(key) {
    var u = null; CF.shipUpgrades.forEach(function (x) { if (x.key === key) u = x; });
    if (!u) return fail("Pick which improvement to make.");
    if (!owned()) return fail("You don't have a fishing vessel yet.");
    if (refit()) return fail("The shipyard is already working on your boat.");
    if (lvl(key) >= MAXLVL) return fail(u.name + " is already at level " + MAXLVL + ".");
    var cost = upgradeCost(key), hrs = upgradeHours(key);
    if (P().money < cost) return fail("You don't have enough cash (" + n2(cost - P().money) + " CC missing)!");
    P().money -= cost;
    H().refit = { key: key, hours: hrs, cost: cost, endsAt: Date.now() + hrs * 3600000 };
    return ok("Your fishing boat is now being upgraded.");
  }
  /* Cancelling refunds the money — the work simply stops. */
  function cancelRefit() {
    var r = refit();
    if (!r) return fail("Nothing is being built.");
    P().money += r.cost;
    H().refit = null;
    return ok("You cancelled the improvement and got " + n2(r.cost) + " CC back.");
  }

  /* ---- Crew ------------------------------------------------------------- */
  function crew(kind) { return H()[kind === "defense" ? "defense" : "fishing"]; }   // { name, men, pay } or null
  function crewList(kind) { return kind === "defense" ? CF.defenseCrews : CF.fishingCrews; }
  function crewReqLevel(kind) { return kind === "defense" ? lvl("armament") : overallLevel(); }
  function hire(kind, name, men) {
    if (crew(kind)) return fail("You already have a " + (kind === "defense" ? "defense team" : "fishing crew") + " — fire them first.");
    var t = null; crewList(kind).forEach(function (x) { if (x.name === name) t = x; });
    if (!t) return fail("Pick who you want to hire.");
    men = Math.floor(men);
    if (!(men > 0)) return fail("Choose how many men to hire.");
    if (men > CF.ruleset.harbor.crewMax) return fail("A team is at most " + CF.ruleset.harbor.crewMax + " men.");
    var need = crewReqLevel(kind);
    if (need < t.req) return fail(t.name + " need " +
      (kind === "defense" ? "ship armament level " : "general ship level ") + t.req + " (you have " + need + ").");
    var cost = t.pay * men;
    if (P().money < cost) return fail("You don't have enough cash (" + n2(cost - P().money) + " CC missing)!");
    P().money -= cost;
    H()[kind === "defense" ? "defense" : "fishing"] = { name: t.name, men: men, pay: cost, tier: crewList(kind).indexOf(t) + 1 };
    return ok(kind === "defense" ? "You hired a new defense team for the fishing boat!"
                                 : "You hired a new fishing crew for the fishing boat!");
  }
  function fire(kind) {
    if (!crew(kind)) return fail("There is nobody to fire.");
    H()[kind === "defense" ? "defense" : "fishing"] = null;
    return ok(kind === "defense" ? "You fired the defense team!" : "You fired the fishing crew!");
  }
  /* "Defense team capabilities" — the reference reads 20% for a full 5-man
   * tier-1 team, so each tier is worth 20 points, scaled by how many men. */
  function defenseCapability() {
    var d = crew("defense");
    if (!d) return 0;
    return Math.round(20 * d.tier * (d.men / CF.ruleset.harbor.crewMax));
  }

  /* ---- The boat's numbers ---------------------------------------------- */
  /* Fishing equipment sets both the deepest catchable fish AND how long the
   * boat fishes for: 24 min a level (reference: level 5 -> "2h 0min"). */
  function catchLevel() { return lvl("equipment"); }
  function fishingMinutes() { return CF.ruleset.harbor.fishMinutesPerLevel * lvl("equipment"); }
  /* The two engines shave the run down from the reference's 78h 20min. */
  function drivingMinutes() {
    var h = CF.ruleset.harbor, saved = (lvl("engineR") - 1 + lvl("engineL") - 1) * h.engineMinutesPerLevel;
    return Math.max(h.driveMinutesFloor, h.driveMinutesBase - saved);
  }
  function tripMinutes() { return drivingMinutes() + fishingMinutes(); }
  /* Three holds, each scaling with the cargo upgrade (25/20/15 kg at level 1). */
  function holds() {
    return CF.ruleset.harbor.holdsBase.map(function (kg) { return kg * lvl("cargo"); });
  }
  function cargoTotal() { var t = 0; holds().forEach(function (k) { t += k; }); return t; }
  function catchableFish() {
    var c = catchLevel();
    return CF.fishSpecies.filter(function (f) { return f.lvl <= c; });
  }

  /* ---- The fishing trip ------------------------------------------------- */
  function trip() { return H().trip; }            // { picks, endsAt, holds } or null
  function tripLeft() { var t = trip(); return t ? Math.max(0, Math.round((t.endsAt - Date.now()) / 1000)) : 0; }
  function tripDone() { var t = trip(); return t && Date.now() >= t.endsAt; }
  function sendShip(picks) {
    if (!owned()) return fail("You don't have a fishing vessel yet.");
    if (trip()) return fail("The boat is already at sea.");
    if (!crew("fishing")) return fail("You need a fishing crew — hire one at the Ship Crew.");
    var hs = holds(), any = false, i;
    for (i = 0; i < hs.length; i++) if (picks[i]) any = true;
    if (!any) return fail("Fill at least one cargo space.");
    var catchable = catchableFish().map(function (f) { return f.name; });
    for (i = 0; i < hs.length; i++) {
      if (picks[i] && catchable.indexOf(picks[i]) < 0)
        return fail("Your fishing equipment can't reach " + picks[i] + " yet.");
    }
    H().trip = { picks: picks.slice(0, hs.length), holds: hs, endsAt: Date.now() + tripMinutes() * 60000 };
    return ok("The ship has set off on a fishing trip!");
  }
  /* The boat lands its catch the moment you look at the harbor after it is due.
   * A full 5-man crew fills every hold; fewer men bring back proportionally
   * less. Pirates take a bite out of whatever the defense team can't cover. */
  function settleTrip() {
    if (!tripDone()) return null;
    var t = H().trip; H().trip = null;
    var h = CF.ruleset.harbor, f = crew("fishing");
    var rate = f ? f.men / h.crewMax : 0;
    var lost = Math.random() < h.pirateChance * (1 - defenseCapability() / 100);
    var store = CF.state.canteen.fish || (CF.state.canteen.fish = {});
    var got = {}, total = 0;
    t.picks.forEach(function (name, i) {
      if (!name) return;
      var kg = Math.floor(t.holds[i] * rate * (lost ? h.pirateKeep : 1));
      if (kg <= 0) return;
      store[name] = (store[name] || 0) + kg;
      got[name] = (got[name] || 0) + kg; total += kg;
    });
    return { got: got, total: total, raided: lost };
  }

  return {
    owned: owned, buyShip: buyShip,
    lvl: lvl, overallLevel: overallLevel, maxLevel: function () { return MAXLVL; },
    upgradeCost: upgradeCost, upgradeHours: upgradeHours,
    refit: refit, refitLeft: refitLeft, settleRefit: settleRefit,
    startRefit: startRefit, cancelRefit: cancelRefit,
    crew: crew, crewList: crewList, crewReqLevel: crewReqLevel,
    hire: hire, fire: fire, defenseCapability: defenseCapability,
    catchLevel: catchLevel, fishingMinutes: fishingMinutes, drivingMinutes: drivingMinutes,
    tripMinutes: tripMinutes, holds: holds, cargoTotal: cargoTotal, catchableFish: catchableFish,
    trip: trip, tripLeft: tripLeft, sendShip: sendShip, settleTrip: settleTrip,
  };
})();
