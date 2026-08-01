/* ============================================================================
 * bank.js — THE BANK.
 * ----------------------------------------------------------------------------
 * Built from the reference's own page. Five rooms hang off it:
 *
 *   Settle with cash   (Arvelda rahaga)  — deposit and withdraw. BUILT.
 *   Bank items         (Panga esemed)    — the items you hold. BUILT.
 *   Bank warehouse     (Panga ladu)      — not built, no source for it.
 *   Vaults             (Varakambrid)     — not built, no source for it.
 *   Bank business room (Panga äriruum)   — not built, no source for it.
 *
 * Only the "settle with cash" page was captured, so the other three say so
 * rather than being invented. What IS faithful: the info block's five figures,
 * the level line, and the upgrade with its cost and its "N different bank
 * items" requirement.
 *
 * WHERE ITEMS COME FROM: treasure chests in the sewer, which the reference
 * delivers straight into the vault ("This was delivered to you in the bank
 * vault"). That feed is already built — see CF.state.vault in houses.js.
 * ========================================================================== */
window.CF = window.CF || {};

/* The room links, in the reference's own two-column arrangement. */
CF.bankRooms = {
  left:  [{ id: "cash",  name: "Settle with cash", live: true },
          { id: "items", name: "Bank items",       live: true },
          { id: "store", name: "Bank warehouse",   live: false }],
  right: [{ id: "vaults", name: "Vaults",            live: false },
          { id: "trade",  name: "Bank business room", live: false }],
};

CF.bank = (function () {
  function P() { return CF.state.player; }
  function R() { return CF.ruleset.bank; }
  var ok = function (m, x) { var r = { ok: true, msg: m }; if (x) for (var k in x) r[k] = x[k]; return r; };
  var fail = function (m) { return { ok: false, msg: m }; };

  function level() { return Math.max(1, Math.min(R().maxLevel, P().bankLevel || 1)); }

  /* ---- The items you hold ------------------------------------------------
   * `state.vault` is name -> count, filled by sewer chests. "Different items"
   * means distinct NAMES, which is what the upgrade asks for. */
  function items() { return CF.state.vault || (CF.state.vault = {}); }
  function itemTotal() {
    var v = items(), n = 0;
    for (var k in v) n += v[k] || 0;
    return n;
  }
  function itemsDifferent() {
    var v = items(), n = 0;
    for (var k in v) if (v[k] > 0) n++;
    return n;
  }
  /* What the collection is worth. No reading exists for a single item, so this
   * is OURS: a flat value a piece, scaled by how far down the list it sits
   * (the list is ordered by worth). */
  function itemValue(name) {
    var i = CF.bankItemNames.indexOf(name);
    return i < 0 ? 0 : Math.round(1000000 * Math.pow(1.35, i));
  }
  function vaultValue() {
    var v = items(), t = 0;
    for (var k in v) t += itemValue(k) * (v[k] || 0);
    return t;
  }

  /* ---- Reputation --------------------------------------------------------
   * The reference shows 27,420,000 at level 2 and never says what it does or
   * how it is made. OURS: what the bank holds plus what its collection is
   * worth, which at least moves for the reasons you would expect. Replace it
   * the moment a second reading turns up. */
  function reputation() {
    return Math.round((P().bank || 0) / 100 + vaultValue() / 10 + clientsHold() / 10);
  }
  /* Other players' deposits. There are no other players here, so this stands
   * in for them: it grows with the bank's level. OURS. */
  function clientsHold() {
    return Math.round(12000000 * Math.pow(1.6, level() - 1));
  }

  /* ---- Upgrading ---------------------------------------------------------
   * One reading: at level 2 it costs 1,350,000,000 CC and 40 different items. */
  function upgradeCost(lvl) {
    var r = R(); lvl = lvl || level();
    return Math.round(r.upgradeAnchorCC * Math.pow(r.upgradeRatio, lvl - r.upgradeAnchorLevel));
  }
  function upgradeItems(lvl) {
    var r = R(); lvl = lvl || level();
    return Math.max(1, r.upgradeAnchorItems + (lvl - r.upgradeAnchorLevel) * r.upgradeItemsPerLevel);
  }
  function upgradeBlockers() {
    var out = [];
    if (level() >= R().maxLevel) return ["The bank is already at its highest level."];
    if (P().money < upgradeCost()) out.push(fmtN(upgradeCost() - P().money) + " CC more");
    var need = upgradeItems(), have = itemsDifferent();
    if (have < need) out.push((need - have) + " more different bank items");
    return out;
  }
  function upgrade() {
    if (level() >= R().maxLevel) return fail("The bank is already at its highest level.");
    var bad = upgradeBlockers();
    if (bad.length) return fail("You still need " + bad.join(" and ") + ".");
    P().money -= upgradeCost();
    P().bankLevel = level() + 1;
    return ok("You improved the bank to level " + P().bankLevel + ".");
  }

  /* ---- Settle with cash --------------------------------------------------- */
  function deposit(n) {
    n = Math.floor(n);
    if (!(n > 0)) return fail("Enter how much to put in.");
    if (P().money < n) return fail("You only have " + fmtN(P().money) + " CC on you.");
    P().money -= n; P().bank = (P().bank || 0) + n;
    return ok("You put " + fmtN(n) + " CC in the bank.");
  }
  function withdraw(n) {
    n = Math.floor(n);
    if (!(n > 0)) return fail("Enter how much to take out.");
    if ((P().bank || 0) < n) return fail("You only have " + fmtN(P().bank || 0) + " CC in the bank.");
    P().bank -= n; P().money += n;
    return ok("You took " + fmtN(n) + " CC out of the bank.");
  }

  function fmtN(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  return {
    level: level, items: items, itemTotal: itemTotal, itemsDifferent: itemsDifferent,
    itemValue: itemValue, vaultValue: vaultValue, reputation: reputation, clientsHold: clientsHold,
    upgradeCost: upgradeCost, upgradeItems: upgradeItems, upgradeBlockers: upgradeBlockers,
    upgrade: upgrade, deposit: deposit, withdraw: withdraw,
  };
})();
