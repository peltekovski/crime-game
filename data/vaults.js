/* ============================================================================
 * vaults.js — THE VAULTS (Varakambrid), the bank's treasure chambers.
 * ----------------------------------------------------------------------------
 * A SECOND, SEPARATE catalogue from the 200 bank items: 80 numbered treasures
 * — ancient coins, bullion and gemstones — held in five chambers. This is what
 * the bank page means by "9 items in the vaults and 30 items in the bank".
 *
 * THE UNLOCK RULE IS EXACT. A chamber exists once you own EVERY item in the
 * chambers before it. The reference's information tab, on an account holding 9
 * different items, reports the shortfalls as 11 / 31 / 46 / 61 — which are
 * 20-9, 40-9, 55-9 and 70-9, i.e. the cumulative item count before each
 * chamber minus what you hold. All four land exactly.
 *
 * VALUE is simply the sum of every stack: the nine stacks on that page total
 * 337,310,000 CC, which is the figure the bank quotes, to the digit.
 *
 * VALUES PER ITEM are hand-authored like the bank's own catalogue (the observed
 * nine climb irregularly, x1.10 to x1.23 apart), so the seen ones are exact and
 * the rest are interpolated.
 *
 * NAMES: only chamber 1's nine have been seen. "68 years old. Servius Sulpicius
 * Galba" is the reference's machine translation mangling "68 a." (68 BC), so it
 * is written properly here, per the standing terminology rule.
 * ========================================================================== */
window.CF = window.CF || {};

CF.vaultChambers = [
  { no: 1, name: "Chamber of Ancient Silver Coins", kind: "Silver coins", from: 1,  to: 20 },
  { no: 2, name: "Chamber of Ancient Gold Coins",   kind: "Gold coins",   from: 21, to: 40 },
  { no: 3, name: "Silver Bar Chamber",              kind: "Silver bars",  from: 41, to: 55 },
  { no: 4, name: "Gold Bar Chamber",                kind: "Gold bars",    from: 56, to: 70 },
  { no: 5, name: "Gemstone Chamber",                kind: "Gemstones",    from: 71, to: 80 },
];
CF.vaultItemCount = 80;
CF.vaultCapacity = 2500;        // "Mitu eset see varakamber mahutab: 2500 eset"

CF.vaultItemsKnown = {
  3:  { name: "148 BC Young Dionysus",            v: 6550000 },
  4:  { name: "235 BC Seleucus II Callinicus",    v: 7570000 },
  5:  { name: "165 BC Amazon Cyme",               v: 9100000 },
  6:  { name: "80 BC Hercules fighting a lion",   v: 10640000 },
  8:  { name: "167 BC Artemis with the bow",      v: 15580000 },
  11: { name: "420 BC Nymph Terina",              v: 27860000 },
  12: { name: "68 BC Servius Sulpicius Galba",    v: 30790000 },
  14: { name: "480 BC Ram's head",                v: 46350000 },
  15: { name: "454 BC Goddess Athena",            v: 51670000 },
};

CF.vaultItems = (function () {
  var anchors = [];
  Object.keys(CF.vaultItemsKnown).forEach(function (k) {
    anchors.push([+k, CF.vaultItemsKnown[k].v]);
  });
  anchors.sort(function (a, b) { return a[0] - b[0]; });

  function value(n) {
    var e = CF.vaultItemsKnown[n];
    if (e) return e.v;
    if (n < anchors[0][0]) {
      // below the first known one, walk back at the rate the first stretch moves
      var per0 = Math.pow(anchors[1][1] / anchors[0][1], 1 / (anchors[1][0] - anchors[0][0]));
      return Math.round(anchors[0][1] / Math.pow(per0, anchors[0][0] - n));
    }
    for (var i = 1; i < anchors.length; i++) {
      if (n <= anchors[i][0]) {
        var a = anchors[i - 1], b = anchors[i];
        return Math.round(a[1] * Math.pow(b[1] / a[1], (n - a[0]) / (b[0] - a[0])));
      }
    }
    var p = anchors[anchors.length - 2], q = anchors[anchors.length - 1];
    var per = Math.pow(q[1] / p[1], 1 / (q[0] - p[0]));
    return Math.round(q[1] * Math.pow(per, n - q[0]));
  }
  function name(n) {
    var e = CF.vaultItemsKnown[n];
    return e ? e.name : "Treasure No. " + n;
  }
  function chamber(n) {
    var c = null;
    CF.vaultChambers.forEach(function (g) { if (n >= g.from && n <= g.to) c = g; });
    return c;
  }
  return { value: value, name: name, chamber: chamber, count: CF.vaultItemCount };
})();

CF.vaults = (function () {
  function P() { return CF.state.player; }
  var ok = function (m, x) { var r = { ok: true, msg: m }; if (x) for (var k in x) r[k] = x[k]; return r; };
  var fail = function (m) { return { ok: false, msg: m }; };
  function fmtN(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  /* itemNo -> count. Treasure stacks, unlike the bank's collection. */
  function held() { return CF.state.chambers || (CF.state.chambers = {}); }
  function count(no) { return held()[no] || 0; }
  function numbers() {
    var h = held(), out = [];
    for (var k in h) if (h[k] > 0) out.push(+k);
    return out.sort(function (a, b) { return a - b; });
  }
  function differentHeld() { return numbers().length; }
  function totalHeld() { return numbers().reduce(function (t, n) { return t + count(n); }, 0); }
  function add(no, n) { held()[no] = count(no) + (n || 1); }

  /* Everything numbered below a chamber's first item. */
  function itemsBefore(ch) { return ch.from - 1; }
  /* A chamber exists once you hold every item that comes before it. */
  function exists(ch) { return ch.no === 1 || differentHeld() >= itemsBefore(ch); }
  function missing(ch) { return Math.max(0, itemsBefore(ch) - differentHeld()); }
  function openChambers() { return CF.vaultChambers.filter(exists); }

  function chamberItems(ch) { return numbers().filter(function (n) { return n >= ch.from && n <= ch.to; }); }
  function chamberDifferent(ch) { return chamberItems(ch).length; }
  function chamberTotal(ch) { return chamberItems(ch).reduce(function (t, n) { return t + count(n); }, 0); }
  function chamberValue(ch) {
    return chamberItems(ch).reduce(function (t, n) { return t + CF.vaultItems.value(n) * count(n); }, 0);
  }
  /* What the bank quotes as "the value of the vaults" — every chamber summed. */
  function value() {
    return CF.vaultChambers.reduce(function (t, ch) { return t + chamberValue(ch); }, 0);
  }
  function roomLeft(ch) { return CF.vaultCapacity - chamberTotal(ch); }

  /* HOW FAR UP THE CATALOGUE YOU CAN FIND, from the official vault page:
   * "owning one vault yields items 1-20. Collecting all 20 unlocks a second
   * vault granting items 1-40. A third gives 1-55." So it is the number of
   * CHAMBERS you have opened that sets the reach — not how deep in the sewer
   * you are, which is what we assumed before. The ends line up with the
   * chambers' own ranges exactly: 20, 40, 55, 70, 80. */
  function findableTo() {
    var open = openChambers();
    return open.length ? open[open.length - 1].to : CF.vaultChambers[0].to;
  }
  /* The chambers fill up. When one is full you have to sell something cheap to
   * make room for something better, which the page recommends in as many
   * words. */
  function chamberFull(ch) { return chamberTotal(ch) >= CF.vaultCapacity; }

  /* Selling. Treasure goes for cash on the spot, at the same rate the bank's
   * warehouse pays for its own stock, and under the same cap — see
   * ruleset.bank.sellDivisor / sellCapCC for why the cap is there. */
  function sellPrice(no) {
    var r = CF.ruleset.bank;
    return Math.min(r.sellCapCC, Math.round(CF.vaultItems.value(no) / r.sellDivisor));
  }
  function sellCapped(no) {
    var r = CF.ruleset.bank;
    return Math.round(CF.vaultItems.value(no) / r.sellDivisor) > r.sellCapCC;
  }
  function sell(no, n) {
    n = Math.floor(n || 0);
    if (!(n > 0)) return fail("Enter how many to sell.");
    if (count(no) < n) return fail("You only have " + count(no) + " of " + CF.vaultItems.name(no) + ".");
    /* Keep one of everything: parting with your last copy would shut the
       chambers that depend on owning it. The page says to keep one of each. */
    if (count(no) - n < 1)
      return fail("Keep at least one " + CF.vaultItems.name(no) +
                  " — selling your last one would close the chambers above it.");
    var got = sellPrice(no) * n;
    held()[no] -= n;
    if (held()[no] <= 0) delete held()[no];
    P().money += got;
    return ok("You sold " + n + " x " + CF.vaultItems.name(no) + " for " + fmtN(got) + " CC.", { got: got });
  }

  return {
    held: held, count: count, numbers: numbers, add: add,
    differentHeld: differentHeld, totalHeld: totalHeld,
    exists: exists, missing: missing, openChambers: openChambers, itemsBefore: itemsBefore,
    chamberItems: chamberItems, chamberDifferent: chamberDifferent,
    chamberTotal: chamberTotal, chamberValue: chamberValue, roomLeft: roomLeft,
    value: value, sellPrice: sellPrice, sellCapped: sellCapped, sell: sell,
    findableTo: findableTo, chamberFull: chamberFull, capacity: CF.vaultCapacity,
  };
})();
