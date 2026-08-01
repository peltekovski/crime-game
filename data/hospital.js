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

/* The rooms, in the reference's own TWO COLUMNS — four on the left, five on the
 * right. Only Reception does anything (it is the treatment desk); the rest are
 * listed so the place reads like itself and say so when clicked. */
CF.hospitalRooms = {
  left:  ["Manager's room", "Reception area", "Cleaners' room", "Parking spaces"],
  right: ["Rehabilitation wards", "Surgery department", "Plastic surgeon's office",
          "Trauma center", "Infirmary"],
  live:  { "Reception area": true },
};

/* The two links the reference puts under the hospital — the places that put you
 * in here in the first place. The boxing ring is the Sports complex's Boxing
 * Hall; the second is the SEWER.
 *
 * ("Rental shop" was the machine translation reading "Rentsel" as a rental
 * business. Rentsel is the sewer, which is why the link belongs there and why
 * the label says so.) */
CF.hospitalLinks = [
  { label: "Go to the boxing ring", act: "acc-sports", fac: "boxing", before: "« " },
  { label: "Go to the sewer", act: "hsp-sewer", after: " »" },
];

CF.hospital = (function () {
  function P() { return CF.state.player; }
  var ok = function (m, x) { var r = { ok: true, msg: m }; if (x) for (var k in x) r[k] = x[k]; return r; };
  var fail = function (m) { return { ok: false, msg: m }; };

  function maxEndurance() { return CF.sports.enduranceMax(); }
  function endurance() { return CF.sports.enduranceCur(); }
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
    return ok("You were cured!");
  }

  function treatWithKit() {
    if (!hurt()) return fail("There is nothing wrong with you.");
    var n = kitsNeeded();
    if (kits() < n) return fail("You need " + n + " first aid kit" + (n === 1 ? "" : "s") +
                                " and you have " + fmt(kits()) + ". They are packed at the medicine laboratory.");
    CF.state.medicine.kits -= n;
    heal();
    return ok("You were cured!");
  }

  /* The info block's numbers. All static — see ruleset.hospital. */
  function stats() { return CF.ruleset.hospital; }

  return {
    rooms: function () { return CF.hospitalRooms; }, stats: stats,
    maxEndurance: maxEndurance, endurance: endurance, hurt: hurt,
    price: price, kits: kits, kitsNeeded: kitsNeeded,
    treatForCash: treatForCash, treatWithKit: treatWithKit,
  };
})();
