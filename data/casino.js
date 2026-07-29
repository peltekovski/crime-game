/* ============================================================================
 * casino.js — the Casino: Blackjack, Video Poker, Slot Machine + the Cashier.
 * ----------------------------------------------------------------------------
 * Chips ARE tokens: everything here spends and pays `player.tokens`, which is
 * the "Tokens" row in the sidebar. The Cashier is the only way in or out.
 *
 * The reference lists four more games (Word Game, Number Game, 15-questions,
 * Lottery). They are deliberately LEFT OUT for now, per the user.
 * ========================================================================== */
window.CF = window.CF || {};

/* Rank order is low → high; "A" is high everywhere except a 5-high straight. */
CF.cardRanks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
CF.cardSuits = ["♠", "♥", "♦", "♣"];   // spade heart diamond club
CF.cardRed = { 1: true, 2: true };                          // hearts + diamonds

CF.casinoGames = [
  { id: "blackjack", name: "Blackjack",      desc: "(beat the dealer by getting 21)" },
  { id: "poker",     name: "Video Poker",    desc: "(good old card game)" },
  { id: "slots",     name: "Slot Machine",   desc: "(pull the lever…maybe you'll get lucky)" },
  // the reference's "(exchange eTones…)" is a mistranslation of "tokens"
  { id: "cashier",   name: "Casino Cashier", desc: "(exchange money for tokens)" },
];

/* Video-poker paytable. The MULTIPLIERS are the reference's, but the hand names
 * are the real poker ones — the reference runs its Estonian through a machine
 * translator ("Royal Mast Row", "Foursome", "Boys' Pair or Better"), and its own
 * win message already says "Three of a Kind". Its Stake/Bet mix-up is likewise
 * normalised to "Bet".
 * `pay` is the GROSS return per chip staked — VERIFIED: bet 100, Three of a
 * Kind → "you won 400 chips". So a pair of jacks at 1 hands the stake back. */
CF.pokerPays = [
  { key: "royal",    label: "Royal Flush",     art: "a ", pay: 1000 },
  { key: "stflush",  label: "Straight Flush",  art: "a ", pay: 80 },
  { key: "four",     label: "Four of a Kind",  art: "",   pay: 40 },
  { key: "full",     label: "Full House",      art: "a ", pay: 12 },
  { key: "flush",    label: "Flush",           art: "a ", pay: 7 },
  { key: "straight", label: "Straight",        art: "a ", pay: 7 },
  { key: "three",    label: "Three of a Kind", art: "",   pay: 4 },
  { key: "twopair",  label: "Two Pair",        art: "",   pay: 3 },
  { key: "jacks",    label: "Jacks or Better", art: "",   pay: 1 },
];
CF.pokerPays.forEach(function (p) { p.txt = "Bet * " + p.pay + " chip" + (p.pay === 1 ? "" : "s"); });

/* Slot reels. The reference's paytable shows five symbols and nothing else, so
 * the reels are an even five-way draw — that puts the house edge at ~12 %
 * (see CF.casino.slotEdge, which recomputes it from these numbers). */
CF.slotSymbols = [
  { key: "gold",  ch: "🍁", label: "Golden leaf" },
  { key: "gun",   ch: "🔫", label: "Pistol" },
  { key: "hat",   ch: "🎩", label: "Hat" },
  { key: "cigar", ch: "🚬", label: "Cigar" },
  { key: "leaf",  ch: "🌿", label: "Leaf" },
];
/* Three of a kind pays `mult` × the stake; a single golden leaf refunds 0.2 ×.
 * VERIFIED against the reference: bet 100, reels hat/gun/golden leaf → "You
 * won 20". */
CF.slotPays = [
  { key: "gold",  n: 3, mult: 40 },
  { key: "gun",   n: 3, mult: 25 },
  { key: "hat",   n: 3, mult: 20 },
  { key: "cigar", n: 3, mult: 10 },
  { key: "leaf",  n: 3, mult: 5 },
  { key: "gold",  n: 1, mult: 0.2 },
];

CF.casino = (function () {
  function P() { return CF.state.player; }
  function C() { return CF.state.casino; }
  var ok = function (m, x) { var r = { ok: true, msg: m }; if (x) for (var k in x) r[k] = x[k]; return r; };
  var fail = function (m) { return { ok: false, msg: m }; };

  function chips() { return Math.floor(P().tokens || 0); }
  function addChips(n) { P().tokens = Math.max(0, Math.floor((P().tokens || 0) + n)); }

  /* ---- cards ----------------------------------------------------------- */
  function newDeck() {
    var d = [];
    for (var s = 0; s < 4; s++) for (var r = 0; r < 13; r++) d.push({ r: r, s: s });
    for (var i = d.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = d[i]; d[i] = d[j]; d[j] = t;
    }
    return d;
  }
  function draw(deck) { return deck.pop(); }

  /* ---- the shared stake check ------------------------------------------ */
  /* Every game opens on the same "Your contribution" screen, so they all come
   * through here: validate the stake, take it off the balance, remember it. */
  function stake(bet) {
    bet = Math.floor(bet);
    if (!(bet > 0)) return fail("Enter how many tokens you are playing for.");
    if (bet > chips()) return fail("You only have " + cc2(chips()) + " chips.");
    addChips(-bet);
    C().bet = bet;
    return ok("");
  }

  /* ---- Blackjack -------------------------------------------------------- */
  /* Aces count 11 until that would bust, then 1. */
  function handPoints(cards) {
    var total = 0, aces = 0;
    cards.forEach(function (c) {
      if (c.r === 12) { aces++; total += 11; }
      else total += Math.min(10, c.r + 2);
    });
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }
  function isBlackjack(cards) { return cards.length === 2 && handPoints(cards) === 21; }

  function bjStart(bet) {
    var s = stake(bet); if (!s.ok) return s;
    var deck = newDeck();
    var g = { deck: deck, player: [draw(deck), draw(deck)], dealer: [draw(deck), draw(deck)],
              bet: C().bet, over: false, result: "", won: 0 };
    C().bj = g;
    if (isBlackjack(g.player)) return bjSettle(g);      // natural — resolves at once
    return ok("");
  }
  function bjHit() {
    var g = C().bj;
    if (!g || g.over) return fail("Start a new game first.");
    g.player.push(draw(g.deck));
    if (handPoints(g.player) > 21) return bjSettle(g);
    return ok("");
  }
  function bjStand() {
    var g = C().bj;
    if (!g || g.over) return fail("Start a new game first.");
    while (handPoints(g.dealer) < 17) g.dealer.push(draw(g.deck));
    return bjSettle(g);
  }
  /* Blackjack pays 3:2, a plain win 1:1, a push hands the stake back.
   * `outcome` drives the colour of the banner: win / lose / push. */
  function bjSettle(g) {
    var pp = handPoints(g.player), dp = handPoints(g.dealer);
    var pbj = isBlackjack(g.player), dbj = isBlackjack(g.dealer);
    g.over = true;
    if (pp > 21) { g.won = 0; g.outcome = "lose"; g.result = "You went bust, you lost your chips!"; }
    else if (pbj && !dbj) { g.won = Math.floor(g.bet * 2.5); g.outcome = "win"; g.result = "Blackjack! You won " + (g.won - g.bet) + " chips!"; }
    else if (dbj && !pbj) { g.won = 0; g.outcome = "lose"; g.result = "The dealer has blackjack, you lost your chips!"; }
    else if (dp > 21) { g.won = g.bet * 2; g.outcome = "win"; g.result = "The dealer went bust, you won " + g.bet + " chips!"; }
    else if (pp > dp) { g.won = g.bet * 2; g.outcome = "win"; g.result = "You won " + g.bet + " chips!"; }
    else if (pp < dp) { g.won = 0; g.outcome = "lose"; g.result = "The dealer won, you lost your chips!"; }
    else { g.won = g.bet; g.outcome = "push"; g.result = "A push — you get your " + g.bet + " chips back."; }
    addChips(g.won);
    return ok(g.result, { won: g.won, net: g.won - g.bet });
  }

  /* ---- Video poker ------------------------------------------------------ */
  function vpDeal(bet) {
    var s = stake(bet); if (!s.ok) return s;
    var deck = newDeck(), hand = [];
    for (var i = 0; i < 5; i++) hand.push(draw(deck));
    C().vp = { deck: deck, hand: hand, bet: C().bet, drawn: false, result: "", won: 0, combo: null };
    return ok("");
  }
  /* Replace every card NOT ticked, then settle. */
  function vpDraw(keep) {
    var g = C().vp;
    if (!g || g.drawn) return fail("Start a new game first.");
    for (var i = 0; i < 5; i++) if (keep.indexOf(i) < 0) g.hand[i] = draw(g.deck);
    g.drawn = true;
    var c = vpEvaluate(g.hand);
    g.combo = c;
    g.won = c ? Math.floor(g.bet * c.pay) : 0;
    addChips(g.won);
    g.result = c ? "You have " + c.art + c.label + " and you won " + cc2(g.won) + " chips"
                 : "You got nothing and lost your bet.";
    return ok(g.result, { won: g.won, combo: c });
  }
  function payOf(key) {
    var p = null; CF.pokerPays.forEach(function (x) { if (x.key === key) p = x; });
    return p;
  }
  /* Returns the best paying combination, or null. */
  function vpEvaluate(hand) {
    var counts = {}, suits = {}, ranks = [];
    hand.forEach(function (c) {
      counts[c.r] = (counts[c.r] || 0) + 1;
      suits[c.s] = (suits[c.s] || 0) + 1;
      ranks.push(c.r);
    });
    ranks.sort(function (a, b) { return a - b; });
    var flush = false; for (var s in suits) if (suits[s] === 5) flush = true;
    // a straight needs 5 distinct consecutive ranks; A-2-3-4-5 counts too
    var uniq = ranks.filter(function (v, i, a) { return a.indexOf(v) === i; });
    var straight = uniq.length === 5 && (uniq[4] - uniq[0] === 4);
    var wheel = uniq.length === 5 && uniq.join(",") === "0,1,2,3,12";   // 2,3,4,5,A
    if (wheel) straight = true;
    var pairs = 0, three = false, four = false;
    for (var r in counts) {
      if (counts[r] === 2) pairs++;
      if (counts[r] === 3) three = true;
      if (counts[r] === 4) four = true;
    }
    if (flush && straight && !wheel && uniq[0] === 8) return payOf("royal");   // 10-J-Q-K-A
    if (flush && straight) return payOf("stflush");
    if (four) return payOf("four");
    if (three && pairs === 1) return payOf("full");
    if (flush) return payOf("flush");
    if (straight) return payOf("straight");
    if (three) return payOf("three");
    if (pairs === 2) return payOf("twopair");
    // "Boys' pair or better" — a pair of jacks, queens, kings or aces
    if (pairs === 1) { for (var r2 in counts) if (counts[r2] === 2 && +r2 >= 9) return payOf("jacks"); }
    return null;
  }

  /* ---- Slot machine ----------------------------------------------------- */
  function slotSpin(bet) {
    var s = stake(bet); if (!s.ok) return s;
    var reels = [];
    for (var i = 0; i < 3; i++) reels.push(CF.slotSymbols[Math.floor(Math.random() * CF.slotSymbols.length)].key);
    var mult = slotMult(reels);
    var won = Math.floor(C().bet * mult);
    addChips(won);
    C().slot = { reels: reels, bet: C().bet, won: won, mult: mult };
    return ok("", { won: won });      // the machine prints its own "You won N"
  }
  function slotMult(reels) {
    for (var i = 0; i < CF.slotPays.length; i++) {
      var p = CF.slotPays[i], n = 0;
      reels.forEach(function (k) { if (k === p.key) n++; });
      if (n === p.n) return p.mult;
    }
    return 0;
  }
  /* House edge, recomputed from the symbol list + paytable so it stays honest
   * if either is edited. Even reels give ~12 %. */
  function slotEdge() {
    var n = CF.slotSymbols.length, ret = 0;
    CF.slotPays.forEach(function (p) {
      var q = 1 / n;
      // exactly p.n of this symbol across 3 reels
      var ways = p.n === 3 ? 1 : 3, prob = Math.pow(q, p.n) * Math.pow(1 - q, 3 - p.n) * ways;
      ret += prob * p.mult;
    });
    return 1 - ret;
  }

  /* ---- Cashier ---------------------------------------------------------- */
  /* 1 CC = 1 token. Inferred from the reference: 800 chips in hand with 99,200
   * typed into "Exchange money for tokens" — a round 100,000 total. */
  function buyTokens(cc) {
    cc = Math.floor(cc);
    if (!(cc > 0)) return fail("Enter how much money you are exchanging.");
    if (cc > P().money) return fail("You only have " + cc2(P().money) + " CC on hand.");
    var got = Math.floor(cc * CF.ruleset.casino.tokenRate);
    P().money -= cc; addChips(got);
    return ok("You exchanged " + cc2(cc) + " CC for " + cc2(got) + " chips.");
  }
  function sellTokens(n) {
    n = Math.floor(n);
    if (!(n > 0)) return fail("Enter how many tokens you are exchanging.");
    if (n > chips()) return fail("You only have " + cc2(chips()) + " chips.");
    var got = Math.floor(n / CF.ruleset.casino.tokenRate);
    addChips(-n); P().money += got;
    return ok("You exchanged " + cc2(n) + " chips for " + cc2(got) + " CC.");
  }
  function cc2(n) { return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  return {
    chips: chips, newDeck: newDeck, handPoints: handPoints, isBlackjack: isBlackjack,
    bjStart: bjStart, bjHit: bjHit, bjStand: bjStand,
    vpDeal: vpDeal, vpDraw: vpDraw, vpEvaluate: vpEvaluate,
    slotSpin: slotSpin, slotMult: slotMult, slotEdge: slotEdge,
    buyTokens: buyTokens, sellTokens: sellTokens,
  };
})();
