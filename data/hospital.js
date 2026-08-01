/* ============================================================================
 * hospital.js — the HOSPITAL, currently the treatment desk only.
 * ----------------------------------------------------------------------------
 * Losing a fight in the sewer empties your endurance to 0 and nothing else puts
 * it back, so this is the other end of that rule: the place you come to when
 * the tunnels have finished with you.
 *
 * Two ways to be treated, exactly as the reference offers them:
 *   - Pay cash. Price = endurance max ^ 3 (see ruleset.hospital for why).
 *   - Spend one FIRST AID KIT, packed at the medicine laboratory. Free, and the
 *     first thing in the build that actually consumes a kit.
 *
 * NOT MODELLED: the hospital as a business — its level, cleanliness, quality of
 * nursing, rest room, wards, surgery, plastic surgery, trauma centre, parking,
 * daily profit and debt. Those rooms are listed so the shape is visible, but
 * they do not do anything yet.
 * ========================================================================== */
window.CF = window.CF || {};

/* The rooms the reference lists, in its own two-column order. `live` marks the
 * ones that do something; the rest are here so the place looks like itself. */
CF.hospitalRooms = [
  { name: "Manager's room",          live: false },
  { name: "Rehabilitation wards",    live: false },
  { name: "Reception area",          live: true  },   // treatment desk
  { name: "Surgery department",      live: false },
  { name: "Cleaners' room",          live: false },
  { name: "Plastic surgeon's office", live: false },
  { name: "Parking spaces",          live: false },
  { name: "Trauma center",           live: false },
  { name: "Infirmary",               live: false },
];

CF.hospital = (function () {
  function P() { return CF.state.player; }
  var ok = function (m, x) { var r = { ok: true, msg: m }; if (x) for (var k in x) r[k] = x[k]; return r; };
  var fail = function (m) { return { ok: false, msg: m }; };

  function maxEndurance() { return P().durabilityMax || 1; }
  function endurance() { return P().durabilityCur || 0; }
  function hurt() { return endurance() < maxEndurance(); }

  /* Cash price. Cubed, per the one exact reading (45 -> 91,125). */
  function price() {
    return Math.round(Math.pow(maxEndurance(), CF.ruleset.hospital.costPower));
  }
  function kits() { return CF.medicine.kits(); }
  function kitsNeeded() { return CF.ruleset.hospital.kitsPerTreatment; }

  function heal() {
    P().durabilityCur = maxEndurance();
  }

  function treatForCash() {
    if (!hurt()) return fail("There is nothing wrong with you.");
    var c = price();
    if (P().money < c) return fail("Treatment costs " + fmt(c) + " CC and you have " + fmt(P().money) + ".");
    P().money -= c;
    heal();
    return ok("The doctors patched you up for " + fmt(c) + " CC. Your endurance is full again.");
  }

  function treatWithKit() {
    if (!hurt()) return fail("There is nothing wrong with you.");
    var n = kitsNeeded();
    if (kits() < n) return fail("You need " + n + " first aid kit" + (n === 1 ? "" : "s") +
                                " and you have " + fmt(kits()) + ". They are packed at the medicine laboratory.");
    CF.state.medicine.kits -= n;
    heal();
    return ok("A nurse used one of your own first aid kits. Your endurance is full again.");
  }

  return {
    rooms: function () { return CF.hospitalRooms; },
    maxEndurance: maxEndurance, endurance: endurance, hurt: hurt,
    price: price, kits: kits, kitsNeeded: kitsNeeded,
    treatForCash: treatForCash, treatWithKit: treatWithKit,
  };
})();
