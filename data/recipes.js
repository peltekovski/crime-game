/* ============================================================================
 * recipes.js — every finished-good recipe, one entry per drink.
 * ----------------------------------------------------------------------------
 * Compact authoring form: { s:station, lvl:unlockLevel, name, ing:[items] }.
 * state.js normalizes each into the brief's schema:
 *   { name, station, unlockLevel, price_CC, ingredients:[{item, qty}] }
 * where qty defaults to ruleset.ingredientQtyDefault (=1; no quantities were
 * observed) and price_CC is derived from ruleset.price unless set explicitly.
 *
 * INGREDIENT REFERENCES form a real dependency graph, not flat strings:
 *   - a raw material          (e.g. "Water", "Wheat")           -> materials.js
 *   - a raw juice             (e.g. "Apple Juice")              -> juiceMap (Juicer #1)
 *   - another recipe's output (e.g. "Spirit")                  -> must be crafted first
 * "Spirit" (Distiller lvl 6) is both a product AND an ingredient in later
 * Distiller recipes — so making, say, Raspberry Rum requires Spirit in stock.
 *
 * Juicer #2's plain juices are renamed "Bottled <Fruit> Juice" to avoid
 * colliding with the raw juices of the same fruit (see materials.js).
 * ========================================================================== */
window.CF = window.CF || {};

CF.recipes = [
  /* ---- Kitchen (tea / coffee / milk) ------------------------------------ */
  { s: "Kitchen", lvl: 1,  name: "Filtered Water",   ing: ["Water"] },
  { s: "Kitchen", lvl: 7,  name: "Milk",             ing: ["Water", "Raw Milk"] },
  { s: "Kitchen", lvl: 9,  name: "Black Tea",        ing: ["Tea Leaves", "Water"] },
  { s: "Kitchen", lvl: 11, name: "Coffee",           ing: ["Water", "Coffee Beans"] },
  { s: "Kitchen", lvl: 13, name: "Green Tea",        ing: ["Tea Leaves", "Water"] },
  { s: "Kitchen", lvl: 17, name: "Red Tea",          ing: ["Tea Flowers", "Water"] },
  { s: "Kitchen", lvl: 23, name: "Chamomile Tea",    ing: ["Chamomile", "Water"] },
  { s: "Kitchen", lvl: 27, name: "Nettle Tea",       ing: ["Nettle", "Water"] },
  { s: "Kitchen", lvl: 33, name: "Lemon Tea",        ing: ["Lemons", "Water"] },
  { s: "Kitchen", lvl: 41, name: "Strawberry Tea",   ing: ["Strawberries", "Water"] },
  { s: "Kitchen", lvl: 49, name: "Orange Tea",       ing: ["Oranges", "Water"] },
  { s: "Kitchen", lvl: 53, name: "Blackcurrant Tea", ing: ["Blackcurrants", "Water"] },

  /* ---- Wine cellar (beers, wines) --------------------------------------- */
  { s: "Cellar", lvl: 2,  name: "Light Homemade Beer",     ing: ["Barley", "Water", "Yeast", "Sugar"] },
  { s: "Cellar", lvl: 5,  name: "Kvass",                   ing: ["Barley", "Water", "Yeast", "Sugar"] },
  { s: "Cellar", lvl: 10, name: "Blackcurrant Wine",       ing: ["Blackcurrant Juice"] },
  { s: "Cellar", lvl: 14, name: "Mead",                    ing: ["Water", "Honey"] },
  { s: "Cellar", lvl: 20, name: "Pepper and Honey Wine",   ing: ["Pepper", "Honey"] },
  { s: "Cellar", lvl: 24, name: "Dark Homemade Beer",      ing: ["Barley", "Water", "Yeast", "Sugar"] },
  { s: "Cellar", lvl: 28, name: "White Wine",              ing: ["Light Grape Juice"] },
  { s: "Cellar", lvl: 30, name: "Red Wine",                ing: ["Dark Grape Juice"] },
  { s: "Cellar", lvl: 32, name: "Redcurrant Wine",         ing: ["Redcurrant Juice"] },
  { s: "Cellar", lvl: 34, name: "Rose Wine",               ing: ["Dark Grape Juice"] },   // "Pink wine" was roosa vein, i.e. rose
  { s: "Cellar", lvl: 40, name: "Cheap Sparkling Wine",    ing: ["Light Grape Juice"] },
  { s: "Cellar", lvl: 54, name: "Expensive Sparkling Wine",ing: ["Light Grape Juice"] },
  { s: "Cellar", lvl: 63, name: "Kids' Champagne",         ing: ["Light Grape Juice", "Water"] },   // official docs: "Lastešampus" (was mistranslated "Children's Shampoo"); station inferred

  /* ---- Distiller (spirits; "Spirit" is the base intermediate) ----------- */
  { s: "Distiller", lvl: 4,   name: "Moonshine",                 ing: ["Wheat", "Water", "Sugar"] },
  { s: "Distiller", lvl: 6,   name: "Spirit",                    ing: ["Wheat", "Water", "Sugar"] },
  { s: "Distiller", lvl: 12,  name: "Blackcurrant Liqueur",      ing: ["Blackcurrant Juice", "Spirit"] },
  { s: "Distiller", lvl: 18,  name: "Cherry Liqueur",            ing: ["Cherry Juice", "Spirit"] },
  { s: "Distiller", lvl: 26,  name: "Cranberry Liqueur",         ing: ["Cranberry Juice", "Spirits"] },
  /* Two cranberry liqueurs appeared at L26 and L36 with the same translated
     name. The higher one is almost certainly the aged/strong version, so it is
     named that way rather than left as "(variant)", which was our own bookkeeping
     leaking into the shop window. */
  { s: "Distiller", lvl: 36,  name: "Aged Cranberry Liqueur",   ing: ["Cranberry Juice", "Spirits"] },
  { s: "Distiller", lvl: 42,  name: "Raspberry Liqueur",         ing: ["Raspberry Juice", "Spirit"] },
  { s: "Distiller", lvl: 44,  name: "Vodka",                     ing: ["Water", "Spirit"] },
  { s: "Distiller", lvl: 48,  name: "Lemon Liqueur",             ing: ["Lemon Juice", "Spirit"] },
  { s: "Distiller", lvl: 50,  name: "Vanilla Wine",              ing: ["Water", "Vanilla", "Spirit"] },
  { s: "Distiller", lvl: 56,  name: "Strawberry Liqueur",        ing: ["Strawberry Juice", "Spirit"] },
  { s: "Distiller", lvl: 58,  name: "Blackcurrant Ravine",       ing: ["Water", "Blackcurrant Juice", "Spirits"] },
  { s: "Distiller", lvl: 60,  name: "Cream Liqueur",             ing: ["Raw Milk", "Spirits"] },
  { s: "Distiller", lvl: 62,  name: "Coffee Liqueur",            ing: ["Coffee Beans", "Spirits"] },
  { s: "Distiller", lvl: 64,  name: "Lemon Vodka",               ing: ["Water", "Lemon Juice", "Spirits"] },
  { s: "Distiller", lvl: 66,  name: "White Tequila",             ing: ["Blue Agave", "Water", "Sugar"] },
  { s: "Distiller", lvl: 68,  name: "Apple Vodka",               ing: ["Water", "Apple Juice", "Spirits"] },
  { s: "Distiller", lvl: 72,  name: "Light Rum",                 ing: ["Caramel", "Water", "Spirit"] },   // L72 + price 90 OBSERVED; ingredients GUESSED
  { s: "Distiller", lvl: 74,  name: "Plum Vodka",                ing: ["Water", "Plum Juice", "Spirits"] },
  { s: "Distiller", lvl: 80,  name: "Silver Tequila",            ing: ["Blue Agave", "Water", "Sugar"] },
  { s: "Distiller", lvl: 86,  name: "Gin",                       ing: ["Juniper Berries", "Water"] },
  /* L88-L98 come from a high-level ready-to-sell screen: the levels, the names
   * and the prices are OBSERVED, the ingredients are GUESSED from how the other
   * spirits at each family are built. "Brand" on that screen is the machine
   * translation of Brandi, so it is written Brandy here. */
  { s: "Distiller", lvl: 88,  name: "Golden Rum",                ing: ["Caramel", "Water", "Spirit"] },
  { s: "Distiller", lvl: 90,  name: "Golden Tequila",            ing: ["Blue Agave", "Water", "Sugar"] },
  { s: "Distiller", lvl: 92,  name: "Corn Whiskey",              ing: ["Corn", "Water", "Spirit"] },
  { s: "Distiller", lvl: 94,  name: "Brandy",                    ing: ["Light Grape Juice", "Spirit"] },
  { s: "Distiller", lvl: 96,  name: "Dark Rum",                  ing: ["Caramel", "Spirit"] },
  { s: "Distiller", lvl: 98,  name: "Cognac",                    ing: ["Light Grape Juice", "Water", "Spirit"] },
  { s: "Distiller", lvl: 105, name: "Raspberry Rum",             ing: ["Caramel", "Raspberry Juice", "Spirit"] },
  { s: "Distiller", lvl: 110, name: "Apple Rum",                 ing: ["Caramel", "Apple Juice", "Spirit"] },
  { s: "Distiller", lvl: 120, name: "Sierra Tequila",            ing: ["Blue Agave", "Spirit"] },

  /* ---- Carbonation machine (sodas, lemonades, tonics) ------------------- */
  { s: "Aerator", lvl: 3,   name: "Carbonated Water",     ing: ["Water"] },
  { s: "Aerator", lvl: 25,  name: "Apple Lemonade",       ing: ["Water", "Apple Juice"] },
  { s: "Aerator", lvl: 39,  name: "Pear Lemonade",        ing: ["Water", "Pear Juice"] },
  { s: "Aerator", lvl: 45,  name: "Redcurrant Lemonade",  ing: ["Water", "Redcurrant Juice"] },
  { s: "Aerator", lvl: 59,  name: "Blackcurrant Lemonade",ing: ["Water", "Blackcurrant Juice"] },
  { s: "Aerator", lvl: 67,  name: "Plum Lemonade",        ing: ["Water", "Plum Juice"] },
  { s: "Aerator", lvl: 69,  name: "Lemon Tonic",          ing: ["Water", "Lemon Juice"] },
  { s: "Aerator", lvl: 71,  name: "Cherry Lemonade",      ing: ["Water", "Cherry Juice"] },
  { s: "Aerator", lvl: 77,  name: "Raspberry Lemonade",   ing: ["Water", "Raspberry Juice"] },
  { s: "Aerator", lvl: 83,  name: "Strawberry Lemonade",  ing: ["Water", "Strawberry Juice"] },
  { s: "Aerator", lvl: 85,  name: "Pumpkin Lemonade",     ing: ["Water", "Pumpkin Juice"] },
  { s: "Aerator", lvl: 89,  name: "Lingonberry Lemonade", ing: ["Water", "Lingonberry Juice"] },
  { s: "Aerator", lvl: 93,  name: "Orange Lemonade",      ing: ["Water", "Orange Juice"] },
  { s: "Aerator", lvl: 97,  name: "Lemonade",             ing: ["Water", "Lemon Juice"] },
  { s: "Aerator", lvl: 100, name: "Cola",                 ing: ["Coca Leaves", "Water"] },
  { s: "Aerator", lvl: 101, name: "Grapefruit Tonic",     ing: ["Water", "Grapefruit Juice"] },
  { s: "Aerator", lvl: 102, name: "Strawberry Tonic",     ing: ["Water", "Strawberry Juice"] },

  /* ---- Cider room ------------------------------------------------------- */
  { s: "Cider", lvl: 8,  name: "Apple Cider",      ing: ["Water", "Apple Juice"] },
  { s: "Cider", lvl: 16, name: "Pear Cider",       ing: ["Water", "Pear Juice"] },
  { s: "Cider", lvl: 22, name: "Strawberry Cider", ing: ["Water", "Strawberry Juice"] },
  { s: "Cider", lvl: 38, name: "Cherry Cider",     ing: ["Water", "Cherry Juice"] },
  { s: "Cider", lvl: 46, name: "Raspberry Cider",  ing: ["Water", "Raspberry Juice"] },
  { s: "Cider", lvl: 52, name: "Plum Cider",       ing: ["Water", "Plum Juice"] },

  /* ---- Juicer #2 (bottled juices + nectars, sellable finished goods) ----
   * Nectars consume the matching RAW juice (Juicer #1). Bottled juices are
   * pressed fresh from Water + the raw fruit and renamed to avoid collisions. */
  { s: "Blender", lvl: 15, name: "Bottled Apple Juice",           ing: ["Water", "Apple"] },
  { s: "Blender", lvl: 19, name: "Apple Nectar",                  ing: ["Apple Juice"] },
  { s: "Blender", lvl: 21, name: "Bottled Pear Juice",            ing: ["Water", "Pear"] },
  { s: "Blender", lvl: 29, name: "Pear Nectar",                   ing: ["Pear Juice"] },
  { s: "Blender", lvl: 31, name: "Bottled Plum Juice",            ing: ["Water", "Plum"] },
  { s: "Blender", lvl: 35, name: "Bottled Cherry Juice",          ing: ["Water", "Cherry"] },
  { s: "Blender", lvl: 37, name: "Plum Nectar",                   ing: ["Plum Juice"] },
  { s: "Blender", lvl: 43, name: "Bottled Raspberry Juice",       ing: ["Water", "Raspberry"] },
  { s: "Blender", lvl: 47, name: "Cherry Nectar",                 ing: ["Cherry Juice"] },
  { s: "Blender", lvl: 51, name: "Bottled Strawberry Juice",      ing: ["Water", "Strawberry"] },
  { s: "Blender", lvl: 55, name: "Bottled Jackfruit Juice",       ing: ["Water", "Jackfruit"] },
  { s: "Blender", lvl: 57, name: "Raspberry Nectar",              ing: ["Raspberry Juice"] },
  { s: "Blender", lvl: 61, name: "Bottled Cranberry Juice",       ing: ["Water", "Cranberry"] },
  { s: "Blender", lvl: 65, name: "Bottled Orange Juice",          ing: ["Water", "Orange"] },
  { s: "Blender", lvl: 73, name: "Bottled Lemon Juice",           ing: ["Water", "Lemon"] },
  { s: "Blender", lvl: 75, name: "Strawberry Nectar",             ing: ["Strawberry Juice"] },
  { s: "Blender", lvl: 79, name: "Cranberry Nectar",              ing: ["Cranberry Juice"] },   // was a second "Bottled Cranberry Juice"; the Blender's high tier is nectars
  { s: "Blender", lvl: 81, name: "Gooseberry Nectar",             ing: ["Gooseberries"] },
  { s: "Blender", lvl: 87, name: "Bottled Redcurrant Juice",      ing: ["Water", "Redcurrant"] },
  { s: "Blender", lvl: 91, name: "Bottled Blackcurrant Juice",    ing: ["Water", "Blackcurrant"] },
  { s: "Blender", lvl: 95, name: "Orange Nectar",                 ing: ["Orange Juice"] },
  { s: "Blender", lvl: 99, name: "Vitamin Drink",                 ing: ["Orange Juice", "Lemon Juice"] },
];

/* Station display order + the "raw" pseudo-stations (Telephone / Juicer #1). */
CF.stations = [
  "Kitchen", "Cellar", "Distiller",
  "Aerator", "Cider", "Blender",
];
