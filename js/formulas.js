/* ============================================================================
 * formulas.js — OUR designed curves + the crafting dependency-graph economics.
 * ----------------------------------------------------------------------------
 * All constants come from CF.ruleset (never hardcoded here). Where the brief
 * did not confirm the original's exact curve, these match the same SHAPE and
 * are labelled "our own curve, not the original's".
 * ========================================================================== */
window.CF = window.CF || {};

/* ============================================================================
 * THE WORLD CLOCK
 * ----------------------------------------------------------------------------
 * Everything in the game ticks on the hour, TOGETHER — the reference calls that
 * tick "the update". It lands on :00, not an hour after whatever you last did,
 * so at 16:30 the next update is 30 minutes away rather than 60.
 *
 * That makes every duration the player picks a count of UPDATES, not a stopwatch:
 * a "1 hour" forest-trail run started at 16:30 finishes at the 17:00 update, and
 * a 2-hour one at 18:00. The garden's watering allowance already worked this way
 * (data/garden.js hourSlot); this is the same idea, shared, so the trail, the
 * timer box, hand energy and the cottage gear all move on the same beat.
 *
 * `slot` is that beat: whole hours since the epoch. Same slot = same update, and
 * slot(b) - slot(a) is exactly how many updates fired in between.
 *
 * THE TAVERN RUNS FASTER. Customers arrive every 10 minutes, not every hour, so
 * it has its own slot on the same wall clock (:00, :10, :20 …) — six waves per
 * update. The tavern* helpers below are that second beat; everything else in the
 * game is on the hourly one.
 * ========================================================================== */
CF.clock = {
  slot: function (t) { return Math.floor((t == null ? Date.now() : t) / 3600000); },
  /* When the next update lands (ms since epoch). */
  nextAt: function (t) { return (this.slot(t) + 1) * 3600000; },
  /* Seconds until it lands — what the "Time until the update" box counts down. */
  secondsToNext: function (t) {
    if (t == null) t = Date.now();
    return Math.max(0, Math.ceil((this.nextAt(t) - t) / 1000));
  },
  /* The moment `n` updates from now — how a duration in hours becomes a finish
   * time. n = 1 at 16:30 gives 17:00, n = 2 gives 18:00. */
  slotsAhead: function (n, t) { return (this.slot(t) + n) * 3600000; },
  /* How many updates fired between two moments. */
  between: function (from, to) { return Math.max(0, this.slot(to) - this.slot(from)); },

  /* ---- The tavern's 10-minute wave, on the same wall clock ---- */
  tavernMs: function () { return CF.ruleset.tavernIntervalSec * 1000; },
  tavernSlot: function (t) { return Math.floor((t == null ? Date.now() : t) / this.tavernMs()); },
  tavernNextAt: function (t) { return (this.tavernSlot(t) + 1) * this.tavernMs(); },
  tavernSecondsToNext: function (t) {
    if (t == null) t = Date.now();
    return Math.max(0, Math.ceil((this.tavernNextAt(t) - t) / 1000));
  },
};

/* ---- Name indexes over the recipe graph -------------------------------- */
CF.recipeByName = {};
CF.recipes.forEach(function (r) { CF.recipeByName[r.name] = r; });
CF.finishedNames = CF.recipes.map(function (r) { return r.name; });

CF.formulas = {
  /* == Reputation -> throughput (CONFIRMED to depend on reputation ONLY) ==
   * Exact curve NOT confirmed — these are our power curves fit to the brief's
   * reference table (good fit across ~10k..1.5M reputation). */
  /* Log-log linear interpolation across the observed anchors; below the first
   * anchor it scales linearly from 0, above the last it uses the power fit. */
  _fromAnchors: function (anchors, rep, powFn) {
    rep = Math.max(0, rep);
    if (rep <= 0) return 0;
    var first = anchors[0], last = anchors[anchors.length - 1];
    if (rep <= first[0]) return first[1] * (rep / first[0]);
    if (rep >= last[0]) return powFn(rep) * (last[1] / powFn(last[0]));   // scaled so it joins the last anchor
    for (var i = 1; i < anchors.length; i++) {
      var a = anchors[i - 1], b = anchors[i];
      if (rep <= b[0]) {
        var t = (Math.log(rep) - Math.log(a[0])) / (Math.log(b[0]) - Math.log(a[0]));
        return Math.exp(Math.log(a[1]) + t * (Math.log(b[1]) - Math.log(a[1])));
      }
    }
    return last[1];
  },
  drinkPerClick: function (rep) {
    var c = CF.ruleset.drinkPerClick;
    return this._fromAnchors(CF.ruleset.dpcAnchors, rep, function (r) { return c.A * Math.pow(r, c.p); });
  },
  clientsPer10Min: function (rep) {
    var c = CF.ruleset.clientsPer10Min;
    return this._fromAnchors(CF.ruleset.clientAnchors, rep, function (r) { return c.B * Math.pow(r, c.q); });
  },

  /* == Reputation gained from selling drinks (from the in-game calculator) ==
   * DIMINISHING RETURNS: per-drink gain is C/reputation. Integrated over the
   * sale: repGain = sqrt(rep^2 + 2*C*drinks) - rep, with C = coef * level^3.
   * Fits all three observed samples within 0.19%. */
  repGainPerBatch: function (drinks, rep, level) {
    var C = CF.ruleset.repGainLevelCoef * Math.pow(level, 3);
    return Math.sqrt(rep * rep + 2 * C * drinks) - rep;
  },

  /* Reputation LOST from `unsatisfied` clients an open tavern couldn't serve.
   * Mirror of the gain curve, downward, floored so reputation can't pass 0. */
  repLossPerBatch: function (unsatisfied, rep, level) {
    var C = CF.ruleset.repLossCoef * Math.pow(level, 3);
    var inside = rep * rep - 2 * C * unsatisfied;
    return inside <= 0 ? rep : rep - Math.sqrt(inside);
  },

  /* == How long the current drink stock lasts =============================
   * Counts COMPLETE waves only — a wave needs a full customer-load of drinks,
   * so stock below one wave gives 0 (the reference showed 00:00:00 with 32
   * drinks vs 1,167 customers).
   * Not linear: each wave sold RAISES reputation, which raises the customer
   * count, so stock drains faster and faster. Matching the reference, this
   * projection lets reputation climb PAST its cap — that is the only way the
   * long-stock sample lands on its observed 28 waves. */
  drinkContinuesWaves: function (drinks, rep, level) {
    var d = drinks, r = rep, waves = 0, guard = 0;
    while (guard++ < 100000) {
      var c = this.clientsPer10Min(r);
      if (c <= 0 || d < c) return waves;
      d -= c; waves++;
      r += this.repGainPerBatch(c, r, level);
    }
    return waves;
  },
  drinkContinuesSeconds: function (drinks, rep, level) {
    return this.drinkContinuesWaves(drinks, rep, level) * CF.ruleset.tavernIntervalSec;
  },

  /* == Lifetime XP needed to REACH a level (cumulative) — inverse of the
   * derive-below. Used by the debug panel to set a skill to an exact level. */
  xpToReachLevel: function (level) {
    var acc = 0; for (var l = 1; l < level; l++) acc += this.pointsToNextLevel(l); return acc;
  },

  /* == Per-skill curves ===================================================
   * Most skills share the universal curve; Gardening/Stealing have their own
   * (ruleset.skillCurves). These three are the skill-aware equivalents of
   * pointsToNextLevel / levelFromLifetimeXP / xpToReachLevel. */
  pointsToNextLevelFor: function (skill, level) {
    var c = (CF.ruleset.skillCurves || {})[skill];
    if (!c) return this.pointsToNextLevel(level);
    // floored at 1 — the steep low-level tail of these curves rounds below 1
    return Math.max(1, Math.round(c.anchorValue * Math.pow(c.ratio, level - c.anchorLevel)));
  },
  levelFromLifetimeXPFor: function (skill, lifetime) {
    var lvl = 1, acc = 0;
    while (lvl < 500) {
      var need = this.pointsToNextLevelFor(skill, lvl);
      if (acc + need > lifetime) break;
      acc += need; lvl++;
    }
    return { level: lvl, into: Math.max(0, lifetime - acc) };
  },
  xpToReachLevelFor: function (skill, level) {
    var acc = 0; for (var l = 1; l < level; l++) acc += this.pointsToNextLevelFor(skill, l); return acc;
  },

  /* == Fame for a skill level (CONFIRMED per group, official help) ========= */
  fameFor: function (skill, level) {
    var f = CF.ruleset.fameFormulas;
    if (f.sq3.indexOf(skill) >= 0) return level * level * 3;
    if (f.sq3m9.indexOf(skill) >= 0) return Math.max(0, level - 9) * Math.max(0, level - 9) * 3;
    if (f.sq3m5.indexOf(skill) >= 0) return Math.max(0, level - 5) * Math.max(0, level - 5) * 3;
    return level * level * 9;   // sq9 group + default
  },

  /* == Derive level + progress from TOTAL lifetime XP =====================
   * The game's level thresholds are cumulative: reaching level L costs the sum
   * of pointsToNextLevel(1..L-1). Verified against the reference (lifetime
   * 168,106,458 -> level 67 with 59,066 into it). */
  levelFromLifetimeXP: function (lifetime) {
    var lvl = 1, acc = 0;
    while (lvl < 500) {
      var need = this.pointsToNextLevel(lvl);
      if (acc + need > lifetime) break;
      acc += need; lvl++;
    }
    return { level: lvl, into: Math.max(0, lifetime - acc) };
  },

  /* == CONFIRMED EXACTLY (brief) — use as-is ============================== */
  clicksToMakeBatch: function (batchSize, rep) {
    var dpc = this.drinkPerClick(rep);
    return dpc > 0 ? Math.ceil(batchSize / dpc) : Infinity;
  },

  /* == Bartending XP curve (CONFIRMED geometric, ratio 1.2) ============= */
  pointsToNextLevel: function (level) {
    var c = CF.ruleset.levelCurve;
    return Math.round(c.anchorValue * Math.pow(c.ratio, level - c.anchorLevel));
  },

  /* == XP earned per Mix click for a drink of a given level (CONFIRMED table) */
  xpForDrinkLevel: function (level) {
    var t = CF.ruleset.xpPerClickByLevel;
    if (level < 1) return t[0];
    if (level <= t.length) return t[level - 1];
    return Math.round(t[t.length - 1] * Math.pow(CF.ruleset.xpExtrapolateRatio, level - t.length));
  },

  /* == Warehouse capacity (SHARED TOTAL per warehouse), scales with level == */
  warehouseCap: function (kind, level) {
    var w = CF.ruleset.warehouse;
    if (kind === "materials") return w.rawMaterialsBase + w.rawMaterialsPerLevel * level;
    if (kind === "rawjuice")  return w.rawJuiceBase     + w.rawJuicePerLevel     * level;
    if (kind === "finished")  return w.finishedBase     + w.finishedPerLevel     * level;
    return Infinity;
  },

  /* == Reputation cap — CONFIRMED constant (76,040 at levels 64..67) ====== */
  repMax: function (level) { return CF.ruleset.reputationMax; },

  /* == Telephone raw-material buy price — scales WITH tavern reputation
   * (official docs: cheap/free at rep 0, higher when famous). Linear model
   * anchored to the one known reading (rep 63,367 -> 1 CC). */
  materialPrice: function (rep) {
    var r = CF.ruleset;
    return Math.max(0, Math.round(Math.max(0, rep) * r.materialPriceCC / r.materialPriceAnchorRep));
  },
};

/* ============================================================================
 * Crafting dependency graph — resolve an ingredient name to a real item, and
 * compute make-cost (in CC) by walking the graph (raw juice -> 1 CC/L, a
 * finished intermediate like Spirit -> recursive cost of its own recipe).
 * ========================================================================== */
CF.graph = {
  /* Resolve any ingredient string to { kind:'material'|'rawjuice'|'finished', key }.
   * Order matters: raw juices win over same-named things, then finished goods,
   * then aliases, then a case-insensitive material match. */
  resolveItem: function (name) {
    var n = String(name).trim().toLowerCase();

    var rj = CF.rawJuices.find(function (j) { return j.toLowerCase() === n; });
    if (rj) return { kind: "rawjuice", key: rj };

    var fo = CF.finishedNames.find(function (f) { return f.toLowerCase() === n; });
    if (fo) return { kind: "finished", key: fo };

    var alias = CF.ingredientAliases[n];
    if (alias) {
      if (alias.toLowerCase() === "spirit") return { kind: "finished", key: "Spirit" };
      var am = CF.materials.find(function (m) { return m.toLowerCase() === alias.toLowerCase(); });
      if (am) return { kind: "material", key: am };
    }

    var mat = CF.materials.find(function (m) { return m.toLowerCase() === n; });
    if (mat) return { kind: "material", key: mat };

    console.warn("[crime-factory] Unresolved ingredient:", name);
    return null;
  },

  /* CC cost of one unit of a resolved item. */
  _costMemo: {},
  unitCostCC: function (kind, key) {
    if (kind === "material") return CF.ruleset.materialPriceCC;
    if (kind === "rawjuice") return CF.ruleset.materialPriceCC / CF.ruleset.juiceLitersPerUnit;
    if (kind === "finished") return this.inputCostCC(CF.recipeByName[key]);
    return 0;
  },

  /* CC cost to make one unit of a recipe (sum of resolved ingredient costs). */
  inputCostCC: function (recipe) {
    if (!recipe) return 0;
    if (this._costMemo[recipe.name] != null) return this._costMemo[recipe.name];
    this._costMemo[recipe.name] = 0; // cycle guard (there are no cycles today)
    var total = 0;
    var self = this;
    recipe.ing.forEach(function (raw) {
      var r = self.resolveItem(raw);
      if (r) total += CF.ruleset.ingredientQtyDefault * self.unitCostCC(r.kind, r.key);
    });
    this._costMemo[recipe.name] = total;
    return total;
  },

  /* Sell price (CC). Prefer the real per-level table; plateau/cap above it;
   * fall back to our formula only for any level missing from both. */
  priceCC: function (recipe) {
    if (recipe.price_CC != null) return recipe.price_CC;
    var byLvl = CF.ruleset.priceByLevel;
    if (byLvl && byLvl[recipe.lvl] != null) return byLvl[recipe.lvl];
    if (recipe.lvl > 66) return CF.ruleset.priceCapCC;
    var p = CF.ruleset.price;
    return Math.round(p.base + p.perLevel * recipe.lvl + p.markup * this.inputCostCC(recipe));
  },
};
