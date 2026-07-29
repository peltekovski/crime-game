/* ============================================================================
 * materials.js — raw materials list + the raw-juice mapping (Juicer #1)
 * ----------------------------------------------------------------------------
 * Two juice systems exist in this game and it is important not to confuse them:
 *
 *   1. RAW JUICE (Juicer #1): pressed directly from a raw fruit, tracked in
 *      liters in the raw-juice warehouse. These "<Fruit> Juice" items are the
 *      INGREDIENTS that wines, liqueurs, lemonades, ciders and tonics consume.
 *      (This is why e.g. "Apple Cider" at level 8 can need "Apple Juice" even
 *      though Juicer #2's bottled Apple Juice unlocks at level 15 — the cider
 *      uses the cheap raw juice, not the premium bottled product.)
 *
 *   2. BOTTLED JUICES / NECTARS (Juicer #2, see recipes.js): premium SELLABLE
 *      finished drinks. To avoid a name collision with the raw juices, Juicer
 *      #2's plain juices are named "Bottled <Fruit> Juice" in recipes.js.
 * ========================================================================== */
window.CF = window.CF || {};

/* All raw materials sold on the Telephone (flat 1 CC/unit — see ruleset.js). */
CF.materials = [
  "Oranges", "Grapefruits", "Light grapes", "Cranberries", "Juniper berries",
  "Caramel", "Cherries", "Coffee beans", "Chamomile", "Strawberries", "Corn",
  "Honey", "Blackcurrants", "Wheat", "Nettle", "Barley", "Pepper", "Pears",
  "Plums", "Lingonberries", "Redcurrants", "Yeast", "Rye", "Lemons",
  "Blue agave", "Sugar", "Tea tree leaves", "Tea tree flowers", "Raw milk",
  "Dark grapes", "Raspberries", "Vanilla", "Water", "Apples", "Pumpkin",
  "Jackfruit", "Tikri", "Coca leaves",
];

/* Raw material -> the raw juice it presses into (Juicer #1). Only fruits whose
 * juice is actually consumed by a recipe are listed. */
CF.juiceMap = {
  "Light grapes":  "Light Grape Juice",
  "Dark grapes":   "Dark Grape Juice",
  "Blackcurrants": "Blackcurrant Juice",
  "Redcurrants":   "Redcurrant Juice",
  "Cherries":      "Cherry Juice",
  "Cranberries":   "Cranberry Juice",
  "Raspberries":   "Raspberry Juice",
  "Lemons":        "Lemon Juice",
  "Apples":        "Apple Juice",
  "Pears":         "Pear Juice",
  "Plums":         "Plum Juice",
  "Strawberries":  "Strawberry Juice",
  "Oranges":       "Orange Juice",
  "Pumpkin":       "Pumpkin Juice",
  "Lingonberries": "Lingonberry Juice",
  "Grapefruits":   "Grapefruit Juice",
};

/* The canonical set of raw-juice names (used by the ingredient resolver). */
CF.rawJuices = Object.values(CF.juiceMap);

/* Ingredient-name aliases -> canonical material or finished-good name.
 * The observed recipe tables name ingredients slightly differently from the
 * materials list (singular fruit vs. plural material, "Tea Leaves" vs.
 * "Tea tree leaves", "Spirits" vs. "Spirit"). Case differences are handled by
 * the resolver directly; only genuine name differences need an alias here. */
CF.ingredientAliases = {
  // singular fruit -> plural raw material
  "apple": "Apples", "pear": "Pears", "plum": "Plums", "cherry": "Cherries",
  "raspberry": "Raspberries", "strawberry": "Strawberries",
  "cranberry": "Cranberries", "orange": "Oranges", "lemon": "Lemons",
  "redcurrant": "Redcurrants", "blackcurrant": "Blackcurrants",
  "grapefruit": "Grapefruits", "lingonberry": "Lingonberries",
  // word differences
  "tea leaves": "Tea tree leaves",
  "tea flowers": "Tea tree flowers",
  "spirits": "Spirit",   // -> the finished intermediate
};
