/* ============================================================================
 * bankitems.js — the bank's ITEM CATALOGUE and its condition system.
 * ----------------------------------------------------------------------------
 * From the reference's "Panga esemed" page. Items are GLOBALLY NUMBERED (the
 * sewer announces "treasure chest item No. 11"), grouped into categories, and
 * each carries a CONDITION out of 80 that you keep up by maintaining it.
 *
 * VALUES.
 *   Items 1-20 are exactly  5,000,000 x (N + 2)  — confirmed on every one of
 *   them now seen (No.1 = 15,000,000 ... No.20 = 110,000,000, including 12, 13
 *   and 19 which only turned up later).
 *   From 21 on that line stops and the values are hand-authored. Plants (21-32)
 *   and Fish (33-40) are now COMPLETE and exact. Their per-item growth falls
 *   steadily — 1.265 down to 1.196 across the plants, 1.180 down to 1.144
 *   across the fish — so it is a shaped table, not one curve. Anything between
 *   known numbers is interpolated geometrically.
 *   The top of the catalogue flattens: No.163 and No.164 are BOTH exactly
 *   200,000,000,000, and No.185 is priceless.
 *
 * NAMES. The game's own English is used wherever it has been seen. Fish 33-38
 * were only ever seen in Estonian (Mõõksabad, Kilpselgsägad, Kardinalid,
 * Skalaarid, Punasabahaid, Vikerkaarhaid) so those six are our translations.
 * Everything unseen is "Bank item No. N", which is how the game refers to items
 * anyway. Drop real names into KNOWN as they turn up; nothing else changes.
 *
 * CATEGORY BOUNDARIES ARE STILL PARTLY ASSUMED. Curtains 1-10, Clocks 11-20,
 * Plants 21-32 and Fish 33-40 are now PINNED — every number in those ranges has
 * been seen and they butt up against each other exactly. Past 40 only scattered
 * members are known (mirror 54/60/61, sculpture 84/88, painting 147, eggs
 * 163/164, manuscript 185), so those boundaries sit at the midpoints of the
 * gaps between the last known member of one category and the first of the next.
 * ========================================================================== */
window.CF = window.CF || {};

CF.bankItemCategories = [
  { name: "Curtains",             from: 1,   to: 10  },
  { name: "Clocks",               from: 11,  to: 20  },
  { name: "Plants",               from: 21,  to: 32  },
  { name: "Fish",                 from: 33,  to: 40  },
  { name: "Mirrors",              from: 41,  to: 61  },
  { name: "Sculptures",           from: 62,  to: 117 },
  { name: "Paintings",            from: 118, to: 155 },
  { name: "Fabergé golden eggs",  from: 156, to: 174 },
  { name: "Book manuscripts",     from: 175, to: 200 },
];
CF.bankItemCount = 200;      // user-confirmed total

/* Every item actually seen, at its own number. `v` omitted where the 1-20 rule
 * already gives it. `v: null` means the page said "hindamatu" — priceless. */
CF.bankItemsKnown = {
  /* -- Curtains (1-10). Values follow the 5,000,000 x (N+2) rule exactly. */
  1:  { name: "Polyester curtains" },
  2:  { name: "Cotton curtains" },
  3:  { name: "Art silk curtains" },
  4:  { name: "Velvet curtains" },
  5:  { name: "Ebony blinds" },
  6:  { name: "Roman blinds" },
  7:  { name: "Full silk curtains" },
  8:  { name: "Ancient Egyptian curtains" },
  9:  { name: "Gold-embroidered curtains" },
  10: { name: "Chinese silk-edged curtains" },
  /* -- Clocks (11-20), still on the linear rule. 14 is the only one unseen. */
  11: { name: "Congo wooden wall clock" },
  12: { name: "Hourglass with carvings" },
  13: { name: "Bronze sculpture clock" },
  15: { name: "Ancient Japanese antique clock" },
  16: { name: "Titanium atomic clock" },
  17: { name: "Swiss wall clock" },
  18: { name: "Cuckoo clock with a golden bird" },
  19: { name: "Tower Clock with Diamonds" },
  20: { name: "Gold dust hourglass" },
  /* -- Plants (21-32). COMPLETE, and the linear rule is long gone by here. */
  21: { name: "Grass lilies",                v: 137846000 },
  22: { name: "Namibian cacti",              v: 174416000 },
  23: { name: "Tall wicker palms",           v: 221366000 },
  24: { name: "Mountain palms",              v: 280496000 },
  25: { name: "Greek palms",                 v: 353750000 },
  26: { name: "Dieffenbachias",              v: 443216000 },
  27: { name: "Amazonian alocasias",         v: 551126000 },
  28: { name: "Yellowish golden fruit palms", v: 679856000 },
  29: { name: "Siberian ivies",              v: 831926000 },
  30: { name: "Dereema dragon trees",        v: 1010000000 },
  31: { name: "Red leaf cacti",              v: 1216886000 },
  32: { name: "Phoenix plants",              v: 1455536000 },
  /* -- Fish (33-40). COMPLETE. 33-38 were only seen in Estonian, so those six
   *    names are our translations; the rest are the game's own English. */
  33: { name: "Swordtails",                  v: 1729046000 },
  34: { name: "Armoured catfish",            v: 2040656000 },
  35: { name: "Cardinal tetras",             v: 2393750000 },
  36: { name: "Angelfish",                   v: 2791856000 },
  37: { name: "Redtail sharks",              v: 3238646000 },
  38: { name: "Rainbow sharks",              v: 3737936000 },
  39: { name: "Neon fish",                   v: 4293686000 },
  40: { name: "Golden gouramis",             v: 4910000000 },
  /* -- Mirrors, sculptures, paintings, eggs, manuscripts: scattered sightings. */
  54: { name: "Arabian silver mirror",       v: 19088702000 },
  60: { name: "A mirror from Atlantis",      v: 20194280000 },
  61: { name: "Mystical magic mirror",       v: 20378543000 },
  84: { name: "Bronze bear sculpture",       v: 95126450000 },
  88: { name: "Crystal Titan sculpture",     v: 97361186000 },
  147:{ name: "Marc Chagall: The Bride",     v: 195000000000 },
  163:{ name: "Lily of the valley egg",      v: 200000000000 },
  164:{ name: "Madonna lily egg",            v: 200000000000 },
  185:{ name: 'Ancient Chinese "Zhou Yi" manuscript', v: null },   // "hindamatu"
};

/* Five more real names came off an earlier screenshot without their numbers:
 * Carved ivory chess set, Silver samovar, Persian floor vase, Amber writing
 * set, Brass ship's clock. They are left out until their numbers are known
 * rather than guessed into slots. */

CF.bankItems = (function () {
  var LINEAR_TO = 20, STEP = 5000000;
  function linear(n) { return STEP * (n + 2); }

  /* Anchors for everything past the linear stretch, in order. */
  var anchors = [];
  Object.keys(CF.bankItemsKnown).forEach(function (k) {
    var n = +k, e = CF.bankItemsKnown[k];
    if (n > LINEAR_TO && e.v != null) anchors.push([n, e.v]);
  });
  anchors.push([LINEAR_TO, linear(LINEAR_TO)]);      // the join between the two
  anchors.sort(function (a, b) { return a[0] - b[0]; });

  function value(n) {
    var e = CF.bankItemsKnown[n];
    if (e && e.v === null) return null;              // priceless
    if (e && e.v != null) return e.v;
    if (n <= LINEAR_TO) return linear(n);
    // between two anchors: geometric interpolation, which is how the real
    // values move (a smooth multiplicative climb, just not a constant one)
    for (var i = 1; i < anchors.length; i++) {
      if (n <= anchors[i][0]) {
        var a = anchors[i - 1], b = anchors[i];
        var t = (n - a[0]) / (b[0] - a[0]);
        return Math.round(a[1] * Math.pow(b[1] / a[1], t));
      }
    }
    // past the last anchor, continue at the rate the last stretch was moving
    var p = anchors[anchors.length - 2], q = anchors[anchors.length - 1];
    var per = Math.pow(q[1] / p[1], 1 / (q[0] - p[0]));
    return Math.round(q[1] * Math.pow(per, n - q[0]));
  }
  function name(n) {
    var e = CF.bankItemsKnown[n];
    return e ? e.name : "Bank item No. " + n;
  }
  function category(n) {
    var c = null;
    CF.bankItemCategories.forEach(function (g) { if (n >= g.from && n <= g.to) c = g; });
    return c;
  }
  function all() {
    var out = [];
    for (var n = 1; n <= CF.bankItemCount; n++)
      out.push({ no: n, name: name(n), value: value(n), cat: category(n) });
    return out;
  }
  return { value: value, name: name, category: category, all: all, count: CF.bankItemCount };
})();
