/* ============================================================================
 * crafting.js — Crafts room (room 1): the three work stations and their items.
 *
 * All THREE stations share ONE Craft level / points pool (confirmed: the item
 * levels interleave across stations with no overlap). The Craft level curve is
 * the SAME one the Barkeeping uses — pointsToNext(L) = 19,450,045 * 1.2^(L-64)
 * — verified: lifetime 2,280,509,091 derives level 81 with 308,615,062 to the
 * next level against an observed 308,615,083 (21 apart in 308 million).
 *
 * POINTS PER CRAFT are observed values, NOT a curve: they dip twice (40 -> 44
 * and 66 -> 69). Kept exactly as recorded; do not "smooth" them.
 * `points: null` means not yet observed — unknown, deliberately not guessed.
 * (Every null is above level 81, so nothing craftable is affected yet.)
 * ========================================================================== */
window.CF = window.CF || {};

/* Short recipe material names -> the canonical craft-supply keys. */
CF.craftMaterialKey = {
  "Leather": "Pieces of leather", "Thread": "Thread reels", "Wood": "Pieces of wood",
  "Tin": "Tin pieces", "Iron": "Pieces of iron", "Cloth": "Cloth rolls",
  "Copper": "Copper pieces", "Paint": "Paint cups", "Clay": "Clay pieces",
  "Plastic": "Plastic pieces", "Titanium": "Titanium pieces", "Uranium": "Uranium",
  "Pewter": "Tin pieces",   // CONFIRMED: "Pewter" (Candlestick) is Tin.
};

/* The order materials are listed in, matching the craft cabinet / station panels. */
CF.craftMaterialOrder = [
  "Pieces of leather", "Thread reels", "Pieces of wood", "Tin pieces", "Pieces of iron",
  "Cloth rolls", "Copper pieces", "Paint cups", "Clay pieces", "Plastic pieces",
  "Titanium pieces", "Uranium",
];

/* Station id -> heading shown above the work panel. The room link says
 * "Furnaces" but the panel itself is headed "Ovens" in the reference. */
/* Each bench needs its own HAND TOOLS before you can work at it. A fresh
 * account owns none of them — they are bought one-off at the market's Craft
 * supplies counter — so the first thing a new player has to do is kit out the
 * bench they want to use. */
CF.craftStations = [
  { id: "armchair",    link: "Armchair",           panel: "Armchair",
    tools: ["Needle", "Conversation knife", "Scissors"] },
  { id: "woodworking", link: "Woodworking corner",  panel: "Woodworking corner",
    tools: ["Hammer", "Bandsaw"] },
  { id: "furnaces",    link: "Furnaces",            panel: "Ovens",
    tools: ["Blacksmith pliers", "Brush"] },
];

/* { s:station id, name, lvl, pts, mats:[short names] } */
CF.craftItems = [
  { s: "armchair",    name: "Wallet",                    lvl: 0,   pts: 20,     mats: ["Leather", "Thread"] },
  { s: "woodworking", name: "Wooden Bowl",               lvl: 4,   pts: 31,     mats: ["Wood", "Paint"] },
  { s: "furnaces",    name: "Clay bowl",                 lvl: 8,   pts: 49,     mats: ["Paint", "Clay"] },
  { s: "furnaces",    name: "Copper Bowl",               lvl: 12,  pts: 77,     mats: ["Copper", "Paint"] },
  { s: "furnaces",    name: "Iron",                      lvl: 16,  pts: 121,    mats: ["Iron"] },
  { s: "armchair",    name: "Wristbands",                lvl: 20,  pts: 190,    mats: ["Thread", "Cloth"] },
  { s: "woodworking", name: "Wooden dice",               lvl: 24,  pts: 299,    mats: ["Wood", "Paint"] },
  /* "Pewter" was the material's own name here while every other recipe calls the
   * same supply "Tin" — one material under two names. It consumes Tin pieces,
   * so it says Tin. */
  { s: "furnaces",    name: "Candlestick",               lvl: 28,  pts: 469,    mats: ["Tin", "Iron"] },
  { s: "armchair",    name: "Builder's Gloves",          lvl: 32,  pts: 736,    mats: ["Thread", "Cloth"] },
  { s: "furnaces",    name: "Syringe",                   lvl: 36,  pts: 1155,   mats: ["Plastic"] },
  { s: "woodworking", name: "Plank",                     lvl: 40,  pts: 4812,   mats: ["Wood"] },
  { s: "furnaces",    name: "Pack of Syringe Needles",   lvl: 44,  pts: 2844,   mats: ["Iron"] },
  { s: "furnaces",    name: "Steel Alloy",               lvl: 48,  pts: 4463,   mats: ["Iron"], unit: "kg" },
  { s: "furnaces",    name: "Toy Car",                   lvl: 52,  pts: 7003,   mats: ["Copper", "Plastic"] },
  { s: "armchair",    name: "Leather Gloves",            lvl: 56,  pts: 10990,  mats: ["Leather", "Thread"] },
  { s: "furnaces",    name: "Titanium Alloy (1)",        lvl: 60,  pts: 17247,  mats: ["Titanium"], unit: "kg" },
  { s: "woodworking", name: "Wooden knobs",              lvl: 63,  pts: 24183,  mats: ["Wood"] },
  { s: "furnaces",    name: "Brick",                     lvl: 66,  pts: 63907,  mats: ["Clay"] },
  { s: "woodworking", name: "Wooden bat",                lvl: 69,  pts: 47451,  mats: ["Wood"] },
  { s: "furnaces",    name: "Iron axe",                  lvl: 72,  pts: 66659,  mats: ["Iron", "Plastic"] },
  { s: "armchair",    name: "Fake Gucci Handbag",        lvl: 75,  pts: 93463,  mats: ["Leather", "Thread", "Cloth"] },
  { s: "furnaces",    name: "Titanium Alloy (2)",        lvl: 78,  pts: 131046, mats: ["Copper", "Titanium"], unit: "kg" },
  { s: "woodworking", name: "Forged Italian Chair",      lvl: 81,  pts: 183742, mats: ["Leather", "Wood"] },
  /* ---- points not yet observed (all above the current craft level) ------- */
  { s: "armchair",    name: "Fake Versace Coat",         lvl: 84,  pts: null, mats: ["Leather", "Thread"] },
  { s: "furnaces",    name: "Titanium Alloy (3)",        lvl: 87,  pts: null, mats: ["Iron", "Titanium"], unit: "kg" },
  { s: "furnaces",    name: "Large Dagger",              lvl: 90,  pts: null, mats: ["Iron", "Copper"] },
  { s: "furnaces",    name: "Small weighted chain",      lvl: 93,  pts: null, mats: ["Iron", "Copper"] },
  { s: "furnaces",    name: "Titanium Alloy (4)",        lvl: 96,  pts: null, mats: ["Iron", "Copper", "Titanium"], unit: "kg" },
  { s: "furnaces",    name: "Electric Wand",             lvl: 99,  pts: null, mats: ["Iron", "Plastic"] },
  { s: "furnaces",    name: "Iron safe",                 lvl: 101, pts: null, mats: ["Iron", "Plastic"] },
  { s: "woodworking", name: "Woman Sculpture",           lvl: 104, pts: null, mats: ["Wood"] },
  { s: "woodworking", name: "Sculpture of a man",        lvl: 107, pts: null, mats: ["Wood"] },
  { s: "furnaces",    name: "Bulletproof Vest",          lvl: 110, pts: null, mats: ["Tin", "Iron", "Copper"] },
  { s: "armchair",    name: "Burglar Costume",           lvl: 112, pts: null, mats: ["Thread", "Cloth"] },
  { s: "furnaces",    name: "Fake Plutonium",            lvl: 115, pts: null, mats: ["Tin", "Iron", "Paint"] },
  { s: "woodworking", name: "Office Desk",               lvl: 118, pts: null, mats: ["Leather", "Wood", "Plastic"] },
  { s: "furnaces",    name: "Counterfeit iPod",          lvl: 120, pts: null, mats: ["Copper", "Plastic"] },
  { s: "armchair",    name: "Car seat",                  lvl: 123, pts: null, mats: ["Leather", "Thread", "Cloth"] },
  { s: "furnaces",    name: "Counterfeit Dell Computer", lvl: 125, pts: null, mats: ["Copper", "Clay", "Plastic"] },
  { s: "armchair",    name: "Super-villain Costume",     lvl: 130, pts: null, mats: ["Leather", "Thread", "Cloth"] },
  { s: "furnaces",    name: "Juxi Sculpture",            lvl: 140, pts: null, mats: ["Clay", "Titanium"] },
  { s: "furnaces",    name: "Enriched uranium",          lvl: 150, pts: null, mats: ["Uranium"] },
];

/* Sale prices (CC = Money) read off the Finished Items Cabinet, keyed by OUR
 * item names (the cabinet's translation differs for a few: "Other iron"=Iron,
 * "Construction gloves"=Builder's Gloves, "Wooden cams"=Wooden knobs). Prices
 * are a per-item table, NOT a curve — they jump around (L36 25,000, L40 100,000,
 * L44 35,600). Items above level 81 have no observed price yet. */
CF.craftPrices = {
  "Wallet": 500, "Wooden Bowl": 680, "Clay bowl": 960, "Copper Bowl": 1320,
  "Iron": 1800, "Wristbands": 2500, "Wooden dice": 2720, "Candlestick": 4370,
  "Builder's Gloves": 6270, "Syringe": 25000, "Plank": 100000,
  "Pack of Syringe Needles": 35600, "Steel Alloy": 41810, "Toy Car": 52800,
  "Leather Gloves": 22450, "Titanium Alloy (1)": 120950, "Wooden knobs": 49380,
  "Brick": 125000, "Wooden bat": 63760, "Iron axe": 81130,
  "Fake Gucci Handbag": 103240, "Titanium Alloy (2)": 231360,
  "Forged Italian Chair": 106715,
};

/* Finished stock seeded to match the reference cabinet (kg items are decimals). */
/* FRESH ACCOUNT: nothing has been crafted yet. */
CF.craftStartMade = {};
