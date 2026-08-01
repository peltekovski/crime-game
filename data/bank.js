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

/* The room links. Grouped by what they are for: what you can do NOW on the
 * left, the two storage rooms on the right.
 *
 * The reference's fifth room, "Panga äriruum" (bank business room), was for
 * trading items with other players. It is LEFT OUT — item trading and buying is
 * going to the Slum instead, with the rest of the market. */
CF.bankRooms = {
  left:  [{ id: "cash",  name: "Settle with cash", live: true },
          { id: "items", name: "Bank items",       live: true }],
  right: [{ id: "vaults", name: "Vaults",          live: true },
          { id: "store",  name: "Bank warehouse",  live: true }],
};

CF.bank = (function () {
  function P() { return CF.state.player; }
  function R() { return CF.ruleset.bank; }
  var ok = function (m, x) { var r = { ok: true, msg: m }; if (x) for (var k in x) r[k] = x[k]; return r; };
  var fail = function (m) { return { ok: false, msg: m }; };

  function level() { return Math.max(1, Math.min(R().maxLevel, P().bankLevel || 1)); }
  /* You do not own the bank to begin with. Until you buy it there is an account
   * to settle with and nothing else — no items, no vaults, no upgrading. */
  function owned() { return !!P().bankOwned; }
  function buyPrice() { return R().buyPriceCC; }
  function buy() {
    if (owned()) return fail("You already own the bank.");
    if (P().money < buyPrice())
      return fail("Buying the bank costs " + fmtN(buyPrice()) + " CC and you have " + fmtN(P().money) + ".");
    P().money -= buyPrice();
    P().bankOwned = true;
    P().bankLevel = P().bankLevel || 1;
    return ok("You bought the bank.");
  }

  /* ---- The items you hold ------------------------------------------------
   * Items are UNIQUE and globally numbered, so ownership is
   *   state.vault = { "<item number>": <condition out of 80> }
   * Condition decays and is restored by maintaining, a few an hour. */
  function items() { return CF.state.vault || (CF.state.vault = {}); }
  function owns(no) { return items()[no] != null; }
  function ownedNumbers() {
    var v = items(), out = [];
    for (var k in v) out.push(+k);
    return out.sort(function (a, b) { return a - b; });
  }
  function itemTotal() { return ownedNumbers().length; }
  /* Every item is its own kind, so "different items" is simply how many you
   * hold — which is what the upgrade counts. */
  function itemsDifferent() { return itemTotal(); }
  function itemValue(no) { var v = CF.bankItems.value(no); return v == null ? 0 : v; }
  function priceless(no) { return CF.bankItems.value(no) == null; }
  function vaultValue() {
    return ownedNumbers().reduce(function (t, n) { return t + itemValue(n); }, 0);
  }

  /* ---- The warehouse ------------------------------------------------------
   * Duplicates live here as stacks (itemNo -> count). The collection upstairs
   * holds one of each; anything you already own arrives here instead, and this
   * is the only place items turn back into money. */
  function store() { return CF.state.bankStore || (CF.state.bankStore = {}); }
  function stored(no) { return store()[no] || 0; }
  function storeNumbers() {
    var st = store(), out = [];
    for (var k in st) if (st[k] > 0) out.push(+k);
    return out.sort(function (a, b) { return a - b; });
  }
  function storeTotal() { return storeNumbers().reduce(function (t, n) { return t + stored(n); }, 0); }
  function addToStore(no, n) { store()[no] = stored(no) + (n || 1); }
  function sellable(no) { return no <= R().sellableTo; }
  /* What one of them pays. The reference's own immediate rate is value/6; the
   * cap is ours, and is what stops one late item from funding the whole game. */
  function sellPrice(no) {
    var v = CF.bankItems.value(no);
    if (v == null || !sellable(no)) return 0;
    // ROUNDED, not floored: 25,000,000/6 lists as 4,166,667 in the reference
    return Math.min(R().sellCapCC, Math.round(v / R().sellDivisor));
  }
  function sellCapped(no) {
    var v = CF.bankItems.value(no);
    return v != null && sellable(no) && Math.round(v / R().sellDivisor) > R().sellCapCC;
  }
  function sell(no, n) {
    n = Math.floor(n || 0);
    if (!(n > 0)) return fail("Enter how many to sell.");
    if (stored(no) < n) return fail("You only have " + stored(no) + " of item No. " + no + ".");
    if (!sellable(no)) return fail("Item No. " + no + " cannot be sold — it is a collection piece.");
    var each = sellPrice(no), got = each * n;
    store()[no] -= n;
    if (store()[no] <= 0) delete store()[no];
    P().money += got;
    return ok("You sold " + n + " x " + CF.bankItems.name(no) + " for " + fmtN(got) + " CC.", { got: got });
  }
  function sellRange(from, to) {
    from = Math.max(1, Math.floor(from || 0)); to = Math.min(CF.bankItems.count, Math.floor(to || 0));
    if (!(to >= from)) return fail("Enter a range, lowest number first.");
    var nos = storeNumbers().filter(function (n) { return n >= from && n <= to && sellable(n); });
    if (!nos.length) return fail("You have nothing in that range to sell.");
    var got = 0, count = 0;
    nos.forEach(function (n) { var q = stored(n); got += sellPrice(n) * q; count += q; store()[n] = 0; delete store()[n]; });
    P().money += got;
    return ok("You sold " + count + " item" + (count === 1 ? "" : "s") + " for " + fmtN(got) + " CC.", { got: got });
  }

  /* ---- Condition and maintenance ---------------------------------------- */
  function condMax() { return R().conditionMax; }
  function condition(no) {
    var c = items()[no];
    return c == null ? 0 : Math.max(0, Math.min(condMax(), c));
  }
  function addItem(no) {
    if (owns(no)) return false;
    items()[no] = condMax();          // arrives in perfect condition
    return true;
  }
  /* Wear, settled on arrival rather than ticked — the garden's pattern exactly.
   * Whole CLOCK HOURS only, so a partial hour never rounds away. */
  function settleCondition() {
    var st = CF.state, now = Date.now();
    if (!st.bankCondSlot) { st.bankCondSlot = hourSlot(); return 0; }
    var hours = hourSlot() - st.bankCondSlot;
    if (hours <= 0) return 0;
    st.bankCondSlot = hourSlot();
    var loss = hours * R().conditionDecayPerHour, v = items(), n = 0;
    for (var k in v) {
      var before = v[k];
      v[k] = Math.max(0, before - loss);
      if (v[k] !== before) n++;
    }
    return n;
  }
  /* The allowance is per CLOCK HOUR, the same slot the garden's watering uses,
   * so it resets on the update rather than on a rolling timer. */
  function hourSlot() { return Math.floor(Date.now() / 3600000); }
  function maintainedThisHour() {
    var st = CF.state;
    if (st.bankMaintSlot !== hourSlot()) { st.bankMaintSlot = hourSlot(); st.bankMaintCount = 0; }
    return st.bankMaintCount || 0;
  }
  function maintainLeft() { return Math.max(0, R().maintainPerHour - maintainedThisHour()); }
  function needsCare(no) { return owns(no) && condition(no) < condMax(); }
  function maintain(nos) {
    settleCondition();
    nos = (nos || []).filter(needsCare);
    if (!nos.length) return fail("Choose something that needs maintaining.");
    var left = maintainLeft();
    if (!left) return fail("You have already maintained " + R().maintainPerHour +
                           " items this hour. Wait for the update.");
    var done = nos.slice(0, left);
    done.forEach(function (n) { items()[n] = condMax(); });
    CF.state.bankMaintCount = maintainedThisHour() + done.length;
    return ok("You maintained " + done.length + " item" + (done.length === 1 ? "" : "s") + ".",
              { done: done.length, skipped: nos.length - done.length });
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
    owns: owns, ownedNumbers: ownedNumbers, priceless: priceless,
    owned: owned, buyPrice: buyPrice, buy: buy,
    store: store, stored: stored, storeNumbers: storeNumbers, storeTotal: storeTotal,
    addToStore: addToStore, sellPrice: sellPrice, sellCapped: sellCapped, sellable: sellable,
    sell: sell, sellRange: sellRange,
    condition: condition, condMax: condMax, addItem: addItem, needsCare: needsCare,
    settleCondition: settleCondition, maintainLeft: maintainLeft, maintain: maintain,
    upgradeCost: upgradeCost, upgradeItems: upgradeItems, upgradeBlockers: upgradeBlockers,
    upgrade: upgrade, deposit: deposit, withdraw: withdraw,
  };
})();
