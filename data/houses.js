/* ============================================================================
 * houses.js — HOUSE AND SEWAGE: the street-stealing map.
 * ----------------------------------------------------------------------------
 * A block of streets you walk around on foot, robbing houses. Walking costs
 * MOVES; the pool is CF.state.houseGear, refilled +5 an update to a cap of 100
 * (the same bar the account overview shows). When an update tops the pool up it
 * also un-robs every house — the reference says so in as many words: "if you
 * don't find any red cottages, wait until the moves are added."
 *
 * WHAT YOU GET. Confirmed from the room's own text, "you have a 1/10 chance of
 * getting a stolen item": bank items are exactly 10%. The rest is ordered as
 * the user described — money by far the most common, then a greenhouse ticket,
 * then the bank item, with fighting equipment rare.
 *
 * WHERE THE LOOT GOES. A stolen item is a numbered BANK item and goes straight
 * into the bank's collection (a duplicate stacks in its warehouse). Fighting
 * equipment is a COLD WEAPON and goes into the weapon rack, CF.state.arms.
 * Neither passes through a backpack.
 * ========================================================================== */
window.CF = window.CF || {};

/* The district. 40 city blocks, each block a 2-wide by 4-tall lot with roads
 * around it — the shape the reference uses. The whole thing does NOT fit on
 * screen: the map scrolls under a fixed window that keeps you in the middle,
 * so walking somewhere actually feels like going somewhere. */
/* Geometry lifted straight from the reference's own villas.css:
 *   div.vpic { width: 40px; height: 30px }   <- tiles are WIDER THAN TALL
 *   .suvw1_13 { width: 520px; height: 390px } <- a 13 x 13 window of them
 * The 4:3 tile is what gives that map its slightly flattened, almost-isometric
 * look; square tiles read as a chessboard however they are painted. */
CF.houseMap = {
  /* 7 x 4 = 28 blocks, down from 8 x 5 = 40. The district was dense enough that
   * a run never ran out of houses, which made the move budget the only limit
   * and the map itself scenery. About a third fewer, so a floor of the district
   * is something you can actually work through. */
  blocksX: 7, blocksY: 4,
  lotW: 2, lotH: 4,              // one block
  viewW: 15, viewH: 15,          // 600 x 450 — odd, so you sit exactly in the middle
  /* 15 is the largest odd view that fits the content column (676px) WITHOUT
     touching the page width. An earlier attempt widened the whole shell to fit
     17; that was measuring the narrow-viewport branch by mistake and the game
     did not need it. Only this screen changed. */
  /* Sprites are 40 x 30 and drawn at 1:1. The zoom is an INTEGER multiple on
   * purpose: at 1.3x every sprite edge lands between device pixels and goes
   * soft, which is what made the map look blurry. 1.5x was crisp but only fit
   * 11 tiles, about four blocks — the reference fits roughly sixteen tiles and
   * a dozen-plus blocks, which is what makes the lattice legible and lets you
   * see where the tunnels actually go. 1x is both crisp and wide. */
  zoom: 1,
  tileW: 40, tileH: 30,          // 40 x 30 sprite at 1x
  spriteW: 40, spriteH: 30,
};
CF.houseMap.w = CF.houseMap.blocksX * (CF.houseMap.lotW + 1) + 1;   // 25
CF.houseMap.h = CF.houseMap.blocksY * (CF.houseMap.lotH + 1) + 1;   // 26

/* What a steal can turn up. `w` are relative weights; bankItem is pinned to the
 * 1/10 the room advertises and the others are scaled around it. */
CF.houseLoot = [
  { key: "money",     w: 0.70, label: "money" },
  { key: "ticket",    w: 0.18, label: "a greenhouse ticket" },
  { key: "bankItem",  w: 0.10, label: "a stolen item" },
  { key: "equipment", w: 0.02, label: "fighting equipment" },
];

/* COLD WEAPONS, found on the tunnel floor. The reference hands them over as
 * "You got a cold weapon from the ground: Pocket Knife (Level 1)" and puts them
 * straight in your inventory. Only the Pocket Knife is observed; the rest of the
 * ladder is ours, ordered so the level roughly tracks how deep you are. */
CF.coldWeapons = [
  { name: "Pocket Knife",   lvl: 1 },  { name: "Switchblade",     lvl: 2 },
  { name: "Butterfly knife", lvl: 3 }, { name: "Brass knuckles",  lvl: 5 },
  { name: "Machete",        lvl: 8 },  { name: "Hatchet",         lvl: 12 },
  { name: "Crowbar",        lvl: 16 }, { name: "Baseball bat",    lvl: 21 },
  { name: "Katana",         lvl: 27 }, { name: "Battle axe",      lvl: 34 },
];


/* ============================================================================
 * THE SEWER — six levels under the villas, reached through a manhole.
 * ----------------------------------------------------------------------------
 * Structure taken from the reference's villas.js:
 *   - `level` 0 is the street; 1..6 are sewer floors.
 *   - Per level, `walkable` lists the tile types you may stand on; type 1 is
 *     wall and 0 is void. Level 2 has two extra floor types (6 and 7).
 *   - A tile's `tt` marks what is ON it: 1 = a monster, 2 = treasure.
 *   - Sprite row for level N is y = -30 * N in the same sheet.
 * It runs on its OWN move pool (sewerGear) and trains WEAPON HANDLING, not
 * Stealing — the reference's own XP line says so. Fighting costs Endurance, and
 * at zero you are sent to the hospital (which is not built yet, so you simply
 * wait for it to come back).
 * ========================================================================== */
CF.sewer = {
  /* Bump this whenever the way a floor is CARVED changes — tile types, monster
   * spread, ladder or treasure rules. A carved floor lives in the save, so
   * without a stamp a player already underground keeps the old floor forever
   * (which is exactly how a save ended up with none of the low tiers on level
   * 1 long after the spread was fixed). `ensureSewer` re-cuts on a mismatch. */
  buildVersion: 4,
  maxLevel: 6,
  /* MONSTER LEVELS ARE NOT LIST POSITIONS. The reference keeps a monster's name
   * and its level as separate things, and the first floor carries levels 10 to
   * 17 — there is no such thing as a level-1 monster. Eight levels a floor over
   * six floors gives 10..57, i.e. 48 levels, and the name list is 96 long:
   * exactly TWO creatures per level, which is what pins the arrangement.
   *   floor 1: 10-17   floor 2: 18-25   floor 3: 26-33
   *   floor 4: 34-41   floor 5: 42-49   floor 6: 50-57 */
  levelBase: 10, levelsPerFloor: 8, namesPerLevel: 2,
  /* Weapon handling needed to go DOWN to each level. Level 2 needing 15 is the
   * one figure we were given; the rest continue it in the same steps, sitting a
   * little above what the floor's monsters actually demand so the gate is the
   * thing that paces you rather than a wall of lost fights. */
  reqWeapon: { 2: 15, 3: 30, 4: 50, 5: 75, 6: 105 },
  walkable: { 1: [2, 3, 4, 5], 2: [2, 3, 4, 5, 6, 7], 3: [2, 3, 4, 5],
              4: [2, 3, 4, 5], 5: [2, 3, 4, 5], 6: [2, 3, 4, 5] },
  floorTypes: { 1: [2, 3, 4], 2: [2, 3, 4, 6, 7], 3: [2, 3, 4],
                4: [2, 3, 4], 5: [2, 3, 4], 6: [2, 3, 4] },
  LADDER: 5,                    // the tile you climb on
  /* Monster names in reference order — index IS the difficulty tier. */
  monsters: ["Tarantula", "Stray monkey", "Poisonous toad", "Hallucination", "Crested macaque",
    "Glowing rat", "Baby scorpion", "Electric eel", "Angry fly", "Old crone",
    "Mutant turtle", "Giant rat", "Flying piranha", "Rattlesnake", "Spiked python",
    "Stray dog", "Gorilla", "Swarm of wasps", "Giant spider", "Great scorpion",
    "Drunk road worker", "Crocodile", "Mummy", "Old man", "Werewolf",
    "Zombie", "Druid", "Limping knight", "Child's ghost", "Dog skeleton",
    "Mad woman", "Guard dog", "Miner's skeleton", "Junkie", "Reaper",
    "Grave robber", "Poisonous spider", "Pirate skeleton", "Rabid dog", "White wolf",
    "Prison escapee", "Catacomb guard", "Giant's skeleton", "Wolf spirit", "Bearded man with an axe",
    "Necromancer", "Psychopath", "Vampire", "Strong thug", "Caveman",
    "Raging miner", "Mine guard", "Cannibal", "Man-eating boar", "Spirit summoner",
    "Tortured soul", "Anaconda", "Jaguar", "King cobra", "Centaur",
    "Hyena", "Lion", "Grizzly", "Giant earthworm", "Cerberus",
    "Confused chemist", "Hook-handed man", "Golden-masked clown", "War hero", "Skinhead",
    "Shaman", "Homeless boxer", "Terrorist", "Serial killer", "Skilled hunter",
    "Giant", "Tiger", "Lost commando", "Bloody psychopath", "Rhinoceros",
    "Sabre-toothed tiger", "Polar bear", "Magma perch", "Phoenix", "Lava eel",
    "Lava snake", "Fire-spitting squirrel", "Fire zombie", "Demon skeleton", "Lava squid",
    "Magma knight", "Lava shark", "Magma sucker", "Fire-breathing fire sucker", "Firesaurus",
    "Fire demon"],
};

CF.houses = (function () {
  function P() { return CF.state.player; }
  function H() { return CF.state.houses; }
  var ok = function (m, x) { var r = { ok: true, msg: m }; if (x) for (var k in x) r[k] = x[k]; return r; };
  var fail = function (m) { return { ok: false, msg: m }; };

  function size() { return CF.houseMap; }
  /* Moves live in the shared pool the update tops up. */
  /* The bank vault (named items, waiting for the bank) and your weapon rack. */
  function vault() { return CF.state.vault || (CF.state.vault = {}); }
  function arms() { return CF.state.arms || (CF.state.arms = {}); }
  function moves() { return CF.state[inSewer() ? "sewerGear" : "houseGear"] || 0; }
  function movesMax() { return CF.ruleset.perUpdate.gearMax; }
  function spend(n) {
    var k = inSewer() ? "sewerGear" : "houseGear";
    CF.state[k] = Math.max(0, (CF.state[k] || 0) - n);
  }

  var M = CF.houseMap;
  function isRoad(x, y) { return x % (M.lotW + 1) === 0 || y % (M.lotH + 1) === 0; }
  function key(x, y) { return x + "," + y; }

  /* Build the district. Roads on the lattice, and inside every 2x4 lot a
   * scatter of houses and trees. EVERY lot cell touches a road at this shape,
   * so there is no such thing as an unreachable house. */
  function build() {
    var cells = {}, x, y;
    for (y = 0; y < M.h; y++) for (x = 0; x < M.w; x++) {
      cells[key(x, y)] = isRoad(x, y) ? "road" : "grass";
    }
    for (y = 0; y < M.h; y++) for (x = 0; x < M.w; x++) {
      if (isRoad(x, y)) continue;
      var roll = Math.random();
      if (roll < 0.46) cells[key(x, y)] = "house";
      else if (roll < 0.68) cells[key(x, y)] = "tree";
    }
    // manholes sit on road crossings — the way down into the sewer
    var holes = {};
    for (y = 0; y < M.h; y += (M.lotH + 1)) for (x = 0; x < M.w; x += (M.lotW + 1)) {
      if (Math.random() < 0.35) holes[key(x, y)] = true;
    }
    H().cells = cells; H().holes = holes; H().w = M.w; H().h = M.h;
    H().robbed = {};
    // start somewhere in the middle, on a road, so the district is all around you
    H().px = Math.floor(M.w / 2 / (M.lotW + 1)) * (M.lotW + 1);
    H().py = Math.floor(M.h / 2 / (M.lotH + 1)) * (M.lotH + 1);
    H().sel = null;
    return cells;
  }
  function ensureMap() {
    if (!H().cells || H().w !== M.w || H().h !== M.h) build();
    return H().cells;
  }
  /* The window into the district, and you are ALWAYS in the middle of it — the
   * streets slide past you rather than a dot crossing a fixed picture.
   *
   * Deliberately NOT clamped at the map edge. Clamping keeps the view full of
   * streets, but with a district only half again the size of the window it
   * clamps most of the time, and then the camera stops moving and you are back
   * to a dot on a static map. Walk to the outskirts and you see dark ground
   * past the last street, which reads as the edge of town and is the point. */
  function camera() {
    ensureMap();
    return {
      x: H().px - Math.floor(M.viewW / 2),
      y: H().py - Math.floor(M.viewH / 2),
      w: M.viewW, h: M.viewH,
    };
  }
  function cellAt(x, y) {
    if (inSewer()) {
      ensureSewer();
      var c = sewerCell(x, y);
      if (!c) return null;
      if (c.t === 1) return "wall";
      if (c.t === CF.sewer.LADDER) return "ladder";
      return "floor";
    }
    ensureMap(); return H().cells[key(x, y)] || null;
  }
  function inBounds(x, y) { return x >= 0 && y >= 0 && x < H().w && y < H().h; }
  function robbed(x, y) { return !!(H().robbed || {})[key(x, y)]; }
  function isManhole(x, y) { return !!(H().holes || {})[key(x, y)]; }

  /* Shortest walk from where you stand, over roads AND houses alike. Two houses
   * side by side are ONE move apart: you are already in the gardens, so making
   * a player walk back out to the street and in again was just a toll. */
  function walkable(c) {
    if (inSewer()) return c === "floor" || c === "ladder";
    return c === "road" || c === "house";
  }
  function distances() {
    ensureMap();
    var dist = {}, q = [[H().px, H().py]], i = 0;
    dist[key(H().px, H().py)] = 0;
    while (i < q.length) {
      var c = q[i++], x = c[0], y = c[1], d = dist[key(x, y)];
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
        var nx = x + o[0], ny = y + o[1];
        if (!inBounds(nx, ny) || !walkable(cellAt(nx, ny))) return;
        if (dist[key(nx, ny)] != null) return;
        dist[key(nx, ny)] = d + 1; q.push([nx, ny]);
      });
    }
    return dist;
  }
  function standingOn(x, y) { return H().px === x && H().py === y; }

  /* ======================= SEWER ======================================== */
  function level() { return H().level || 0; }
  function inSewer() { return level() > 0; }
  function moveKey() { return inSewer() ? "sewerGear" : "houseGear"; }
  /* Re-cut the floor you are standing on if it was carved by older rules. A
   * floor is saved, so without this a player who was underground when the rules
   * changed would keep the old one indefinitely — no amount of fixing the
   * spread would reach them until they happened to climb or wait for an update. */
  function ensureSewer() {
    if (!inSewer()) return;
    if (!H().sewerCells || H().sewerBuild !== CF.sewer.buildVersion) buildSewer(level());
  }
  function sewerCell(x, y) { return (H().sewerCells || {})[key(x, y)]; }

  /* The sewer is the SAME LATTICE as the street above it, re-skinned: brick
   * blocks where the villas were, tunnels where the roads were, ladders where
   * the manholes were. It is not a cave — the reference's floor is visibly the
   * same regular grid, which makes sense: these are the streets from below.
   *
   * Tile types come from villas.css: 1 = wall (the LIGHT brick, confirmed by
   * sampling the sheet), 2/3/4 = tunnel floor, 5 = ladder. Level 2 adds 6 and 7.
   * Wall variants exist only on levels 1 and 6, so texture is applied there. */
  function wallVariants(lvl) { return lvl === 1 ? 4 : lvl === 6 ? 2 : 0; }
  /* Tunnel type is the tunnel's DIRECTION, not decoration — 2 runs north-south,
   * 3 runs east-west, 4 is a crossing, exactly as the street's road sprites do
   * (they sit in the same three sheet columns). Picking it by hash drew vertical
   * corridors with horizontal pipe art and vice versa, which made the lattice
   * unreadable: brick and tunnel stopped lining up, so tiles that were open
   * looked walled and the map read as noise. */
  function tunnelType(x, y) {
    var vert = x % (M.lotW + 1) === 0, horiz = y % (M.lotH + 1) === 0;
    return vert && horiz ? 4 : vert ? 2 : 3;
  }
  function buildSewer(lvl) {
    var cells = {}, x, y;
    var wv = wallVariants(lvl), sr = CF.ruleset.sewer;
    for (y = 0; y < M.h; y++) for (x = 0; x < M.w; x++) {
      if (isRoad(x, y)) cells[key(x, y)] = { t: tunnelType(x, y) };
      else cells[key(x, y)] = { t: 1, v: wv ? (hash(x, y) % (wv + 1)) : 0 };
    }
    // ladders sit where the manholes are upstairs — the crossings
    var crossings = [];
    for (y = 0; y < M.h; y += (M.lotH + 1)) for (x = 0; x < M.w; x += (M.lotW + 1)) crossings.push([x, y]);
    crossings.forEach(function (c) {
      if (Math.random() < sr.ladderChance) cells[key(c[0], c[1])] = { t: CF.sewer.LADDER };
    });
    /* Company, thick along the tunnels — the reference's floor is crowded, and
     * that is the point: you cannot clear it, you pick your fights.
     * NO treasure is placed here: chests are DROPPED by what you kill, so the
     * only way to find one is to win a fight. */
    for (y = 0; y < M.h; y++) for (x = 0; x < M.w; x++) {
      var cell = cells[key(x, y)];
      if (cell.t === 1 || cell.t === CF.sewer.LADDER) continue;
      if (Math.random() < sr.monsterChance) {
        cell.tt = 1;
        /* Spread EVENLY across the floor's eight levels. An earlier exponent
         * bunched almost everything at the weak end, so you met nothing but the
         * easiest and could clear a floor without ever losing. Flat means the
         * top of the band turns up often enough that reading the badge before
         * you commit is the actual skill. */
        var band = CF.sewer.levelsPerFloor;
        cell.m = CF.sewer.levelBase + (lvl - 1) * band +
                 Math.floor(Math.pow(Math.random(), CF.ruleset.sewer.tierSkew) * band);
        cell.mn = Math.floor(Math.random() * CF.sewer.namesPerLevel);   // which of the two
      }
    }
    H().sewerCells = cells;
    H().sewerBuild = CF.sewer.buildVersion;    // stamped, so a stale floor is detectable
    // the renderer and every loop read w/h off the state, and only the street
    // builder used to set them — enter the sewer first and they stayed 0
    H().w = M.w; H().h = M.h;
    /* You keep your coordinates through the floor. Climbing is vertical: the
     * tile under you is the tile you land on, so the levels stack and you can
     * navigate between them. Dropping the player somewhere random made every
     * climb a fresh disorientation. Only a start with no position at all (or
     * one that landed inside brick) gets placed, on the nearest open tunnel. */
    if (!inBounds(H().px, H().py) || cells[key(H().px, H().py)].t === 1) {
      var best = null, bd = Infinity;
      for (y = 0; y < M.h; y++) for (x = 0; x < M.w; x++) {
        if (cells[key(x, y)].t === 1) continue;
        var d = Math.abs(x - (H().px || 0)) + Math.abs(y - (H().py || 0));
        if (d < bd) { bd = d; best = [x, y]; }
      }
      if (best) { H().px = best[0]; H().py = best[1]; }
    }
    H().sel = null;
    return cells;
  }

  /* Why you may not go down to `lvl` yet, or "" if you may. */
  function descendBlocker(lvl) {
    var need = (CF.sewer.reqWeapon || {})[lvl] || 0;
    if (!need) return "";
    var have = weaponHandling().level;
    return have >= need ? "" : "Level " + need + " weapon handling (you are " + have + ")";
  }
  function enterSewer(lvl) {
    /* No argument means "one level deeper", the way climbing down reads. Without
     * the default, Math.min(max, undefined) is NaN and the level silently
     * becomes NaN rather than failing loudly. */
    if (lvl == null) lvl = level() + 1;
    lvl = Math.max(1, Math.min(CF.sewer.maxLevel, lvl));
    // going DOWN is gated; coming back up to a level you already passed is not
    if (lvl > level()) {
      var blocked = descendBlocker(lvl);
      if (blocked) return fail("Sewer level " + lvl + " needs " + blocked + ".");
    }
    H().level = lvl;
    H().maxLevel = Math.max(H().maxLevel || 1, lvl);
    buildSewer(lvl);
    return ok("You climb down into sewer level " + lvl + ".");
  }
  function leaveSewer() {
    H().level = 0; H().sewerCells = null; H().sel = null;
    // back on the street where you went down
    H().px = H().streetX != null ? H().streetX : Math.floor(M.w / 2);
    H().py = H().streetY != null ? H().streetY : Math.floor(M.h / 2);
    return ok("You climb back up into the street.");
  }
  /* `m` stores the monster's LEVEL (10..57), not a list position — see the
     CF.sewer header. Two creatures share each level; `mn` says which. */
  function monsterLevel(c) { return c.m || CF.sewer.levelBase; }
  function monsterTier(lvl) { return Math.max(0, lvl - CF.sewer.levelBase); }
  function monsterAt(x, y) {
    var c = sewerCell(x, y);
    if (!c || c.tt !== 1) return null;
    var lvl = monsterLevel(c);
    var idx = Math.min(CF.sewer.monsters.length - 1,
                       monsterTier(lvl) * CF.sewer.namesPerLevel + (c.mn || 0));
    return { name: CF.sewer.monsters[idx], level: lvl, tier: monsterTier(lvl), idx: idx };
  }
  function treasureAt(x, y) { var c = sewerCell(x, y); return !!(c && c.tt === 2); }

  /* ---- Sprite lookup ----------------------------------------------------
   * img/map_sprite.png is the reference's own sheet: 680 x 210, seventeen
   * 40 x 30 tiles across, row 0 the street level and rows 1-6 the sewer.
   * Offsets are the ones villas.css uses, and the road orientations were read
   * off the sheet itself (a tall run of light pixels = a vertical centre line,
   * a wide run = a horizontal one):
   *    0 void   -40 road N-S   -80 road E-W   -120 crossroads   -160 manhole
   * -200 grass  -240/-280 house  -320/-360 robbed  -400/-440/-480 trees
   * Variants are picked by hashing the coordinates, so a house keeps its face
   * across re-renders and reloads without anything being stored. */
  function hash(x, y) { return Math.abs((x * 73856093) ^ (y * 19349663)); }
  function spriteFor(x, y) {
    if (!inBounds(x, y)) return { bx: 0, by: 0 };            // v6, black
    if (inSewer()) {
      var by = -30 * level(), sc = sewerCell(x, y);
      if (!sc) return { bx: 0, by: 0 };
      if (sc.t === 1) {
        // wall texture: base at 0, extra faces at -440, -480, -520, -560
        return { bx: sc.v ? -440 - 40 * (sc.v - 1) : 0, by: by };
      }
      if (sc.t === CF.sewer.LADDER) return { bx: -160, by: by };      // the way out
      // floors 2/3/4 sit at -40/-80/-120; level 2's extra 6/7 at -480/-440.
      // A monster or treasure on the tile swaps in that floor's variant.
      var base, mon, tre;
      if (sc.t === 6) { base = -480; mon = -560; tre = -640; }
      else if (sc.t === 7) { base = -440; mon = -520; tre = -600; }
      else { base = -40 * (sc.t - 1); mon = -200 - 40 * (sc.t - 2); tre = -320 - 40 * (sc.t - 2); }
      return { bx: sc.tt === 1 ? mon : sc.tt === 2 ? tre : base, by: by };
    }
    var c = cellAt(x, y);
    if (c === "house") {
      var alt = hash(x, y) % 2;                              // two faces per state
      return { bx: robbed(x, y) ? (alt ? -360 : -320) : (alt ? -280 : -240), by: 0 };
    }
    if (c === "tree") return { bx: [-400, -440, -480][hash(x, y) % 3], by: 0 };
    if (c === "grass") return { bx: -200, by: 0 };
    if (isManhole(x, y)) return { bx: -160, by: 0 };
    // road: which way the markings run depends on which way the street runs
    var vertical = x % (M.lotW + 1) === 0, horizontal = y % (M.lotH + 1) === 0;
    if (vertical && horizontal) return { bx: -120, by: 0 };  // crossroads
    return { bx: vertical ? -40 : -80, by: 0 };
  }

  /* Down here the choices are different: fight what is in the way, lift the
   * treasure, or take a ladder to another level. */
  function sewerOptions(x, y, d) {
    var out = [], c = cellAt(x, y), here = standingOn(x, y);
    if (c === "wall" || !c) return [{ act: null, label: "Solid wall", dead: true }];
    var mv = here ? 0 : d, txt = here ? "" : " (" + d + " move" + (d === 1 ? "" : "s") + ")";
    var mon = monsterAt(x, y);
    if (mon) {
      var th = threat(x, y);
      out.push({ act: "attack", cost: mv, band: th && th.band,
                 label: "Attack the " + mon.name.toLowerCase() + " — level " + mon.level +
                        (th ? ", " + th.band : "") + txt });
    }
    if (treasureAt(x, y)) out.push({ act: "treasure", label: "Take the treasure" + txt, cost: mv });
    /* You can climb from ANY tunnel tile, not only off a ladder. The ladder art
     * marks the obvious spots; it was never a requirement, and gating on it left
     * whole stretches of a floor with no way out. */
    if (level() < CF.sewer.maxLevel) {
      var nx = descendBlocker(level() + 1);
      out.push({ act: "down", label: "Climb down a level" + txt, cost: mv,
                 dead: !!nx, note: nx });
    }
    out.push({ act: "up", label: level() > 1 ? "Climb up a level" + txt
                                             : "Climb up to the street" + txt, cost: mv });
    if (!here && d != null) out.push({ act: "walk", label: "Walk here" + txt, cost: d,
                                       to: { x: x, y: y, d: d } });
    if (!out.length) out.push({ act: null, label: here ? "You are here" : "Nothing here", dead: true });
    return out;
  }

  /* One fight, resolved at once. Your reach comes from Weapon handling and the
   * Fighting average; what you take off it comes back as Endurance lost. A
   * monster you cannot beat will empty you, which is the warning to go shallower. */
  function fightPower() {
    var wh = weaponHandling().level, f = parseFloat(CF.formulas.fightingValue ? 0 : 0) || 0;
    var body = (CF.sportsStatic["Speed"] + CF.sports.power().level + CF.sports.endurance().level +
                CF.sportsStatic["Defence"] + CF.sportsStatic["Dexterity"] + wh) / 6;
    return { wh: wh, body: body, dmg: 5 + wh * 2.5 + body * 0.7 };
  }
  function attackMonster(x, y) {
    var mon = monsterAt(x, y);
    if (!mon) return fail("There is nothing to fight there.");
    if (!standingOn(x, y)) return fail("Get to it first.");
    if (CF.sports.enduranceCur() <= 0) return fail("Your endurance is 0 — you need a hospital.");
    var me = fightPower();
    /* GEOMETRIC, not linear. Skills run 1..1000, so a linear monster curve is
     * flat by comparison: the old one was cleared end to end by Weapon handling
     * 25 and cost nothing at all past 100. Both monster health and monster
     * damage grow by `tierRatio` per tier, which is the rate a character's own
     * damage grows along the intended route (floor 1 at Weapon handling 1,
     * floor 6 at about 600), so the ratio between them stays roughly constant
     * and every floor keeps costing a real slice of the endurance bar.
     * Measured, 1500 fights a cell: on your own floor 100% for a fifth to a
     * quarter of the bar, the floor below is a coin toss, two below is a wall. */
    var s = CF.ruleset.sewer;
    var mHp = s.hpBase * Math.pow(s.hpRatio, mon.tier);
    var mDmg = s.dmgBase * Math.pow(s.dmgRatio, mon.tier);
    var scale = Math.pow(s.hpRatio, mon.tier);        // the reward follows health
    var myHp = CF.sports.enduranceCur(), rounds = 0, taken = 0;
    /* The upset roll. Even a fight you should win can go wrong — see
       ruleset.sewer.upsetChance. Rolled up front so the outcome is decided
       honestly rather than by nudging the numbers mid-fight. */
    if (Math.random() < s.upsetChance) {
      P().durabilityCur = 0;
      return fail("The " + mon.name.toLowerCase() + " caught you badly. Your endurance is gone" +
                  " — you need a hospital before you fight again.");
    }
    while (mHp > 0 && myHp > 0 && rounds++ < 60) {
      mHp -= Math.max(1, Math.round(me.dmg * (0.75 + Math.random() * 0.5)));
      if (mHp <= 0) break;
      var hit = Math.max(1, Math.round(mDmg * (0.75 + Math.random() * 0.5)));
      myHp -= hit; taken += hit;
    }
    /* ENDURANCE IS ALL-OR-NOTHING. Winning costs you nothing at all; losing
     * empties the bar to 0 and the hospital is the only way back. So endurance
     * is not a budget you spend down fight by fight, it is the price of picking
     * a fight you could not win — which makes reading the monster's level the
     * real skill, rather than counting how many more you can afford. */
    if (mHp > 0) {
      P().durabilityCur = 0;
      return fail("The " + mon.name.toLowerCase() + " beat you. Your endurance is gone" +
                  " — you need a hospital before you fight again.");
    }
    var cell = sewerCell(x, y); delete cell.m;
    /* The reward tracks the same geometric ladder the monsters do, so a deep
     * kill is worth going deep for. A flat "3 + tier/2" capped out at about 51
     * points, which is a rounding error against the level curve down there. */
    var pts = Math.round(s.pointsPerKill * scale);
    var before = weaponHandling().level;
    CF.state.sports.weaponPoints = (CF.state.sports.weaponPoints || 0) + pts;
    /* Treasure is a DROP, not scenery: the corpse leaves a chest behind often
     * enough to be worth the fight, and there is no other way to find one. */
    var dropped = Math.random() < s.treasureChance;
    if (dropped) cell.tt = 2; else delete cell.tt;
    var r = ok("You killed the " + mon.name.toLowerCase() + ". +" + pts + " weapon handling." +
               (dropped ? " It dropped something." : ""),
               { pts: pts, taken: 0, dropped: dropped });
    if (weaponHandling().level > before) r.levelUp = weaponHandling().level;
    return r;
  }
  /* What a chest holds. The reference shows two kinds coming off the tunnel
   * floor: a numbered VAULT ITEM ("delivered to you in the bank vault", so it
   * never touches your backpack) and a COLD WEAPON that goes to your inventory.
   * Cash is the common filler between them. */
  /* How a fight would go, without rolling it. Rounds to kill it against rounds
   * it needs to empty you — the same two numbers the fight loop races, so the
   * badge on the map cannot disagree with what actually happens. */
  function threat(x, y) {
    var mon = monsterAt(x, y);
    if (!mon) return null;
    var s = CF.ruleset.sewer, me = fightPower();
    var mHp = s.hpBase * Math.pow(s.hpRatio, mon.tier);
    var mDmg = s.dmgBase * Math.pow(s.dmgRatio, mon.tier);
    var cur = CF.sports.enduranceCur();
    // flat on your back, everything is deadly — and the ratio would blow up
    if (cur <= 0) return { level: mon.level, name: mon.name, ratio: Infinity, band: "deadly" };
    var toKill = mHp / Math.max(1, me.dmg);
    var toDie = cur / Math.max(0.001, mDmg);
    var ratio = toKill / toDie;
    /* Thresholds calibrated against MEASURED win rates, not guessed: ratio 0.94
     * wins 99% of the time, 1.11 wins 87%, 1.31 wins 52%, 1.55 wins 18% and
     * 1.83 wins 1%. Re-measure these if the combat constants move. */
    return { level: mon.level, name: mon.name, ratio: ratio,
             band: ratio < 1.0 ? "easy" : ratio < 1.2 ? "fair" : ratio < 1.45 ? "risky" : "deadly" };
  }
  function takeTreasure(x, y) {
    if (!treasureAt(x, y)) return fail("There is no treasure there.");
    if (!standingOn(x, y)) return fail("Get to it first.");
    var sr = CF.ruleset.sewer, cell = sewerCell(x, y);
    delete cell.tt;
    var roll = Math.random(), r;
    if (roll < sr.chamberChance) {
      /* TREASURE: a coin, a bar or a gemstone for the bank's vaults. How deep
         you are sets how far up the 80-item chamber catalogue you can reach,
         which lines up with the chambers' own unlock rule almost exactly —
         chamber 2 wants all twenty silver coins and floor 2 is the first that
         reaches them. */
      var vspan = Math.max(1, Math.ceil(CF.vaultItems.count * level() / CF.sewer.maxLevel));
      var vno = 1 + Math.floor(Math.random() * vspan);
      CF.vaults.add(vno, 1);
      r = ok("You found treasure chest item No. " + vno + " on the ground!", { treasure: vno });
      r.sub = "This was delivered to you in the bank vault.";
      return r;
    }
    if (roll < sr.chamberChance + sr.weaponChance) {
      /* Which weapons turn up follows the floor: level 1 finds pocket knives,
       * the bottom finds the whole list. */
      var pool = CF.coldWeapons.filter(function (w) { return w.lvl <= level() * 7; });
      if (!pool.length) pool = [CF.coldWeapons[0]];
      var w = pool[Math.floor(Math.random() * pool.length)];
      arms()[w.name] = (arms()[w.name] || 0) + 1;
      r = ok("You got a cold weapon from the ground: " + w.name + " (Level " + w.lvl + ")", { weapon: w.name });
      r.sub = "A new weapon has been added to your inventory!";
      return r;
    }
    var amt = sr.minCC + Math.floor(Math.random() * (sr.maxCC - sr.minCC + 1));
    P().money += amt;
    return ok("You prised open the chest and took " + fmt(amt) + " CC.");
  }
  function climb(dir, x, y) {
    if (!standingOn(x, y)) return fail("Get there first.");
    // any tunnel tile will do — the ladder art only marks the obvious spots
    if (cellAt(x, y) === "wall") return fail("You cannot climb through a wall.");
    if (dir === "down") return enterSewer(level() + 1);
    if (level() <= 1) return leaveSewer();
    return enterSewer(level() - 1);
  }
  function weaponHandling() {
    var lt = (CF.state.sports && CF.state.sports.weaponPoints) || 0;
    var lv = CF.formulas.levelFromLifetimeXPFor("Weapon handling", lt);
    return { level: lv.level, into: lv.into, lifetime: lt,
             pointsToLevel: Math.max(0, CF.formulas.pointsToNextLevelFor("Weapon handling", lv.level) - lv.into) };
  }

  /* What clicking this tile would offer. One place decides it, so the menu and
   * the action can never disagree about what is possible. */
  function optionsAt(x, y) {
    ensureMap();
    if (!inBounds(x, y)) return [];
    var c = cellAt(x, y), out = [], dist = distances(), d = dist[key(x, y)];
    if (inSewer()) return sewerOptions(x, y, d);
    if (c === "house") {
      if (standingOn(x, y)) {
        if (robbed(x, y)) out.push({ act: null, label: "You have already been through here", dead: true });
        else out.push({ act: "steal", label: "Steal from the house", cost: 0 });
        return out;
      }
      if (d == null) { out.push({ act: null, label: "No way through", dead: true }); return out; }
      var moveTxt = "(" + d + " move" + (d === 1 ? "" : "s") + ")";
      /* Walk-and-steal first: robbing a house you can see is one intent, and
       * making it two clicks every time was pure friction. Plain walk stays
       * underneath for when you only want to reposition. */
      if (!robbed(x, y)) out.push({ act: "walksteal", label: "Walk here and steal " + moveTxt,
                                    cost: d, to: { x: x, y: y, d: d } });
      else out.push({ act: null, label: "Already robbed", dead: true });
      out.push({ act: "walk", label: "Walk here " + moveTxt, cost: d, to: { x: x, y: y, d: d } });
      return out;
    }
    if (c === "road") {
      if (d === 0) out.push({ act: null, label: "You are here", dead: true });
      else if (d != null) out.push({ act: "walk", label: "Walk here (" + d + " move" + (d === 1 ? "" : "s") + ")",
                                    cost: d, to: { x: x, y: y, d: d } });
      /* The way down is offered from ANY street tile, not only the drawn covers
       * — that is how the reference does it (level 0 offers climb_down on every
       * walkable tile). The manhole art just marks the obvious spots. */
      if (d === 0) out.push({ act: "sewer", label: "Climb to a new level", cost: 0 });
      else out.push({ act: "sewerwalk", label: "Walk here and climb down (" + d +
                                              " move" + (d === 1 ? "" : "s") + ")", cost: d });
      return out;
    }
    return [{ act: null, label: c === "tree" ? "A tree" : "Nothing here", dead: true }];
  }

  function walkTo(x, y) {
    /* Flat on your back, you do not get to keep exploring the tunnels. Losing a
     * fight ends the trip: the way out is the hospital, not another few steps. */
    if (inSewer() && CF.sports.enduranceCur() <= 0)
      return fail("Your endurance is gone — you cannot move down here until a hospital treats you.");
    var dist = distances(), d = dist[key(x, y)];
    if (d == null) return fail("You cannot get there from here.");
    if (d === 0) return fail("You are already there.");
    if (d > moves()) return fail("That is " + d + " moves and you have " + moves() + " left.");
    spend(d);
    H().px = x; H().py = y;
    return ok("You walked " + d + " move" + (d === 1 ? "" : "s") + ".");
  }

  function rollLoot() {
    var r = Math.random(), acc = 0, pick = CF.houseLoot[0];
    for (var i = 0; i < CF.houseLoot.length; i++) {
      acc += CF.houseLoot[i].w;
      if (r < acc) { pick = CF.houseLoot[i]; break; }
    }
    return pick;
  }

  function stealFrom(x, y) {
    ensureMap();
    if (cellAt(x, y) !== "house") return fail("There is no house there.");
    if (robbed(x, y)) return fail("You have already been through that one.");
    if (!standingOn(x, y)) return fail("Walk over to the house first.");

    var rs = CF.ruleset.houseSteal, loot = rollLoot(), msg, sub = null, got = { kind: loot.key };
    if (loot.key === "money") {
      var amt = rs.minCC + Math.floor(Math.random() * (rs.maxCC - rs.minCC + 1));
      P().money += amt; got.amount = amt;
      msg = "You stole " + amt + " CC from the house.";
    } else if (loot.key === "ticket") {
      CF.state.garden.tickets = (CF.state.garden.tickets || 0) + 1;
      msg = "You stole a greenhouse ticket from the house.";
    } else if (loot.key === "bankItem") {
      /* A stolen item is a BANK item — and look at what that catalogue is:
         curtains, clocks, house plants, aquarium fish, mirrors, sculptures,
         paintings, Fabergé eggs, manuscripts. That is the contents of a villa,
         which is exactly what you are robbing. (Coins and bullion are the
         VAULT catalogue, and those come out of the sewer's chests.)

         Villas reach the WHOLE catalogue, weighted hard towards the cheap end:
         most houses have curtains, a rare one has a Chagall. They have to reach
         all of it, because the bank's own upgrade wants 40 different items and
         a shallow slice could never supply that. */
      var pick = 1 + Math.floor(Math.pow(Math.random(), 3) * CF.bankItems.count);
      pick = Math.min(CF.bankItems.count, pick);
      var dupV = !CF.bank.addItem(pick);
      if (dupV) CF.bank.addToStore(pick, 1);
      msg = "You stole item No. " + pick + " from the house!";
      sub = dupV ? "You already have one — this copy went to the bank warehouse."
                 : "This was added to your bank items.";
    } else {
      /* Fighting equipment is a COLD WEAPON, the same rack the sewer's finds go
         into. It used to increment a counter nothing read, so roughly one steal
         in fifty produced loot that silently disappeared. A villa yields from
         the shallow end of the ladder. */
      var wpool = CF.coldWeapons.filter(function (w) { return w.lvl <= 8; });
      var wp = wpool[Math.floor(Math.random() * wpool.length)];
      arms()[wp.name] = (arms()[wp.name] || 0) + 1;
      H().equipment = (H().equipment || 0) + 1;   // lifetime tally, shown on the map header
      msg = "You stole a cold weapon from the house: " + wp.name + " (Level " + wp.lvl + ")";
      sub = "A new weapon has been added to your inventory!";
    }

    H().robbed[key(x, y)] = true;
    // Stealing points, same pool the garden fills
    var before = CF.garden.stealProgress().level;
    CF.state.garden.stealPoints = (CF.state.garden.stealPoints || 0) + rs.stealPoints;
    var after = CF.garden.stealProgress().level;

    var r = ok(msg, { loot: loot.key, pts: rs.stealPoints });
    if (sub) r.sub = sub;
    if (after > before) r.levelUp = after;
    if (got.amount) r.amount = got.amount;
    return r;
  }

  /* An update that adds moves also puts every house back — otherwise a player
   * who cleared the block would come back to a dead map. */
  function refreshOnUpdate() {
    H().robbed = {}; H().sel = null;
    // "adding moves will create new opponents on the map" — recarve the floor
    if (inSewer()) buildSewer(level());
  }

  return {
    size: size, camera: camera,
    ensureMap: ensureMap, cellAt: cellAt, inBounds: inBounds, robbed: robbed,
    isManhole: isManhole, isRoad: function (x, y) { return cellAt(x, y) === "road"; },
    distances: distances, optionsAt: optionsAt, standingOn: standingOn, spriteFor: spriteFor,
    walkTo: walkTo, stealFrom: stealFrom, refreshOnUpdate: refreshOnUpdate,
    level: level, inSewer: inSewer, enterSewer: enterSewer, leaveSewer: leaveSewer,
    monsterAt: monsterAt, treasureAt: treasureAt, attackMonster: attackMonster,
    takeTreasure: takeTreasure, climb: climb, weaponHandling: weaponHandling,
    noteStreetSpot: function () { H().streetX = H().px; H().streetY = H().py; },
    moves: moves, movesMax: movesMax, vault: vault, arms: arms, threat: threat,
    /* Re-cut the current floor in place. A saved floor keeps the tiers it was
       carved with, so this is how a changed monster spread reaches a save that
       is already underground. */
    recarve: function (lvl) { return buildSewer(lvl || level() || 1); },
    ensureSewer: ensureSewer,
    descendBlocker: descendBlocker,
    items: function () { return H().items || 0; },
    equipment: function () { return H().equipment || 0; },
    pos: function () { return { x: H().px, y: H().py }; },
    rebuild: build,
  };
})();
