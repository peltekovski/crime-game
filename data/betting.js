/* ============================================================================
 * betting.js — the Betting Bunker (Slum), a SELF-CONTAINED betting shop.
 * ----------------------------------------------------------------------------
 * In the reference this room was the third link in a chain: you built a car at
 * the Racing complex, entered it on the Highway, and OTHER PLAYERS bet on the
 * result here. With one player there is nothing to bet on, so the bunker is cut
 * loose and runs its own events instead. The Racing complex and Highway will be
 * built later on their own terms and do NOT feed this room.
 *
 * The shape of a bet:
 *   pick a VENUE -> pick a RUNNER -> stake money -> the event runs, live ->
 *   you are paid or you are not -> it drops into your last-10 history.
 *
 * ODDS ARE DERIVED, NEVER TYPED. Each runner has a `chance` (they sum to 1 per
 * venue) and the payout is (1 / chance) x (1 - edge). That means the house edge
 * is exactly `edge` on every runner at every venue — no accidental soft spot a
 * player could farm, and no accidental trap either. Change the edge in one
 * place and the whole room re-prices itself.
 *
 * Money, not tokens: chips belong to the Casino and cannot leave it. The bunker
 * is a street operation and deals in cash.
 * ========================================================================== */
window.CF = window.CF || {};

/* The venues, in unlock order. `lvl` is the Stealing level that opens the door
 * — the bunker is a slum operation, so getting deeper into it tracks the skill
 * this district actually trains. Chances per venue MUST sum to 1. */
CF.betVenues = [
  {
    id: "dogs", name: "Dog Track", lvl: 1,
    blurb: "Six greyhounds and a mechanical hare, behind the tannery.",
    unit: "dog", verb: "runs", minBet: 100, maxBet: 50000,
    runners: [
      { name: "Ash Widow",    chance: 0.32 },
      { name: "Copper Kettle", chance: 0.24 },
      { name: "Nine Lives",   chance: 0.18 },
      { name: "Bad Tooth",    chance: 0.12 },
      { name: "Slow Sunday",  chance: 0.09 },
      { name: "Last Tram",    chance: 0.05 },
    ],
  },
  {
    id: "sprint", name: "Highway Sprint", lvl: 3,
    blurb: "Five cars, a shut stretch of ring road and no officials.",
    unit: "car", verb: "drives", minBet: 500, maxBet: 250000,
    runners: [
      { name: "Grey Estate",   chance: 0.34 },
      { name: "The Dentist",   chance: 0.26 },
      { name: "Rust Bucket",   chance: 0.19 },
      { name: "Half a Muffler", chance: 0.13 },
      { name: "Borrowed Van",  chance: 0.08 },
    ],
  },
  {
    id: "brawl", name: "Back-alley Brawl", lvl: 5,
    blurb: "Two fighters, no rounds, and a crowd that settles it.",
    unit: "fighter", verb: "fights", minBet: 1000, maxBet: 500000,
    runners: [
      { name: "Ivo the Anvil", chance: 0.55 },
      { name: "Quiet Marek",   chance: 0.45 },
    ],
  },
  {
    id: "harbour", name: "Harbour Run", lvl: 8,
    blurb: "Eight boats out past the breakwater and back. Long money.",
    unit: "boat", verb: "sails", minBet: 5000, maxBet: 2000000,
    runners: [
      { name: "Salt Mary",     chance: 0.22 },
      { name: "Two Anchors",   chance: 0.18 },
      { name: "Northern Girl", chance: 0.15 },
      { name: "Cold Catch",    chance: 0.12 },
      { name: "Old Diesel",    chance: 0.11 },
      { name: "Gull's Luck",   chance: 0.09 },
      { name: "Broken Compass", chance: 0.08 },
      { name: "Last Light",    chance: 0.05 },
    ],
  },
];

CF.betting = (function () {
  function P() { return CF.state.player; }
  function B() { return CF.state.betting; }
  var ok = function (m, x) { var r = { ok: true, msg: m }; if (x) for (var k in x) r[k] = x[k]; return r; };
  var fail = function (m) { return { ok: false, msg: m }; };
  function n2(n) { return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  function venue(id) {
    var v = null; CF.betVenues.forEach(function (x) { if (x.id === id) v = x; });
    return v;
  }
  function stealLevel() { return CF.garden.stealProgress().level; }
  function isOpen(v) { return stealLevel() >= v.lvl; }

  /* Payout multiplier for a runner. Derived from its chance and the house edge,
   * so it can never drift out of step with how often the runner actually wins. */
  function oddsFor(runner) {
    var e = CF.ruleset.bettingBunker.edge;
    return Math.round((1 / runner.chance) * (1 - e) * 100) / 100;
  }
  /* The edge, recomputed from the numbers rather than asserted. A single bet on
   * runner i returns chance_i x odds_i per 1 staked, and because the odds are
   * derived that is the SAME for every runner — so the edge is that figure, not
   * a sum across the field. (Summing would answer a different question: what
   * you get back for covering every runner at once, which nobody does.)
   * Averaged only to absorb the 2-decimal rounding on the odds. */
  function houseEdge(v) {
    var ret = 0;
    v.runners.forEach(function (r) { ret += r.chance * oddsFor(r); });
    return 1 - ret / v.runners.length;
  }

  function pickWinner(v) {
    var roll = Math.random(), acc = 0, idx = v.runners.length - 1;
    for (var i = 0; i < v.runners.length; i++) {
      acc += v.runners[i].chance;
      if (roll < acc) { idx = i; break; }
    }
    return idx;
  }

  /* The whole race is generated UP FRONT, one row of positions per runner, and
   * the screen just plays it back. Deciding it live would risk the animation
   * and the result disagreeing — the one bug a betting screen cannot have.
   * The lead still changes hands mid-race, which is the entertaining part. */
  function buildTrack(n, winnerIdx, steps) {
    var finals = [], i, t;
    for (i = 0; i < n; i++) finals.push(i === winnerIdx ? 100 : 62 + Math.floor(Math.random() * 34));
    var track = [];
    for (i = 0; i < n; i++) {
      var row = [0], cur = 0, pace = finals[i] / steps;
      for (t = 1; t <= steps; t++) {
        var wobble = (Math.random() - 0.45) * pace * 0.9;
        cur = Math.max(cur, Math.min(finals[i], Math.round(pace * t + wobble)));
        row.push(cur);
      }
      row[steps] = finals[i];          // everyone lands exactly where they finished
      track.push(row);
    }
    return track;
  }

  function active() { return B().active || null; }
  function running() { var a = active(); return !!a && !a.settled; }
  function raceTicks() { return CF.ruleset.bettingBunker.raceTicks; }

  function placeBet(venueId, runnerIdx, stake) {
    var v = venue(venueId);
    if (!v) return fail("Choose somewhere to bet.");
    if (!isOpen(v)) return fail("The " + v.name + " only takes bets from Stealing level " + v.lvl + " up.");
    if (running()) return fail("Your last bet is still running — see Active bets.");
    runnerIdx = parseInt(runnerIdx, 10);
    if (!(runnerIdx >= 0 && runnerIdx < v.runners.length)) return fail("Pick who you are backing.");
    stake = Math.floor(stake);
    if (!(stake > 0)) return fail("Enter how much you are staking.");
    if (stake < v.minBet) return fail("The " + v.name + " takes nothing under " + n2(v.minBet) + " CC.");
    if (stake > v.maxBet) return fail("The " + v.name + " takes nothing over " + n2(v.maxBet) + " CC.");
    if (stake > P().money) return fail("You only have " + n2(P().money) + " CC on hand.");

    var winnerIdx = pickWinner(v), steps = raceTicks();
    P().money -= stake;
    B().active = {
      venue: v.id, runner: runnerIdx, stake: stake,
      odds: oddsFor(v.runners[runnerIdx]),
      winner: winnerIdx,
      track: buildTrack(v.runners.length, winnerIdx, steps),
      tick: 0, steps: steps, settled: false, won: false, payout: 0,
      at: Date.now(),
    };
    return ok("Your bet is on. " + v.name + " " + v.verb + " now.");
  }

  /* One step of the race. Returns true when this step ENDED it, so the caller
   * knows to redraw the whole panel rather than just the bars. */
  function step() {
    var a = active();
    if (!a || a.settled) return false;
    a.tick++;
    if (a.tick < a.steps) return false;
    settle();
    return true;
  }
  /* Jump straight to the result. Same settlement either way — skipping cannot
   * change the outcome, which was decided the moment the bet was placed. */
  function skip() {
    var a = active();
    if (!a || a.settled) return false;
    a.tick = a.steps;
    settle();
    return true;
  }
  function settle() {
    var a = active(); if (!a || a.settled) return;
    var v = venue(a.venue);
    a.settled = true;
    a.won = a.runner === a.winner;
    a.payout = a.won ? Math.floor(a.stake * a.odds) : 0;
    if (a.payout > 0) P().money += a.payout;
    var h = B().history || (B().history = []);
    h.unshift({
      venue: v.name, runner: v.runners[a.runner].name, winner: v.runners[a.winner].name,
      stake: a.stake, odds: a.odds, won: a.won, payout: a.payout,
      net: a.payout - a.stake, at: Date.now(),
    });
    B().history = h.slice(0, CF.ruleset.bettingBunker.historyMax);
  }
  /* Clear a finished slip so the Place bets tab is free again. */
  function collect() { if (active() && active().settled) B().active = null; }

  /* Positions to draw this tick, as percentages. */
  function positions() {
    var a = active(); if (!a) return [];
    return a.track.map(function (row) { return row[Math.min(a.tick, a.steps)]; });
  }
  /* Who is in front right now — the caption above the bars while it runs. */
  function leader() {
    var pos = positions(), v = venue(active().venue), best = 0;
    pos.forEach(function (p, i) { if (p > pos[best]) best = i; });
    return v.runners[best].name;
  }

  function history() { return B().history || []; }
  function historyTotals() {
    var t = { bets: 0, staked: 0, returned: 0, won: 0 };
    history().forEach(function (h) {
      t.bets++; t.staked += h.stake; t.returned += h.payout; if (h.won) t.won++;
    });
    t.net = t.returned - t.staked;
    return t;
  }

  return {
    venues: function () { return CF.betVenues; },
    venue: venue, isOpen: isOpen, stealLevel: stealLevel,
    oddsFor: oddsFor, houseEdge: houseEdge,
    placeBet: placeBet, step: step, skip: skip, collect: collect,
    active: active, running: running, positions: positions, leader: leader,
    history: history, historyTotals: historyTotals,
  };
})();
