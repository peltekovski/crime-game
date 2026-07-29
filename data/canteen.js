/* ============================================================================
 * canteen.js — the Tavern's SECOND FLOOR (dining room).
 * ----------------------------------------------------------------------------
 * Six rooms: Dairy warehouse · Canteen granary · Canteen fish warehouse ·
 * Food menu · Vegetarian corner · Fish food table.
 *
 * The loop (user's own description):
 *   pick a liquid -> "Fill the container" -> raw materials
 *   -> pick what to make from them at the bottom -> dairy products
 *   dairy + fruit (+ fish) -> a dish that sits on the Food menu for N hours
 *
 * VIP is excluded from this build, so the brewing cap is the VIP one: 10 L.
 * The granary's "put it on the market" is left out with every other market
 * feature. NAMES: the reference's "Or" is Estonian "või" = BUTTER (its own
 * cooking dropdown says "Butter (90 liters)"), so Butter is used throughout.
 * ========================================================================== */
window.CF = window.CF || {};

/* The two fillable raw liquids, then the nine products brewed from them. */
CF.dairyLiquids = ["Raw milk", "Water"];
CF.dairyProducts = ["Milk", "Butter", "Sour cream", "Whipped cream", "Curd",
                    "Cheese", "Coffee cream", "Ice cream", "Cream cheese"];
/* Warehouse row order, exactly as the reference lists it. */
CF.dairyAll = CF.dairyLiquids.concat(CF.dairyProducts);

/* ---------------------------------------------------------------------------
 * THE RECIPE BOOKS — the game's own dish lists, off the official cooking page
 * (crime.ee/index.php?a=5&l=12), translated from the Estonian.
 *
 * Vegetarian dishes sit on levels 1, 4, 7 … (3N-2) and each one is made from
 * the greenhouse fruit AND field crop of pair N — the dish names say so
 * ("Cabbage and cucumber salad" = the level-3 pair). Fish dishes sit on
 * levels 2, 5, 8 … (3N-1), one species each.
 * ------------------------------------------------------------------------- */
CF.vegDishes = [
  ["Fried potatoes with dill", "Dill", "Potato", "Butter"],
  ["Hemp cake", "Cocoa", "Cannabis", "Butter"],
  ["Cabbage-cucumber salad", "Cucumber", "Cabbage", "Sour cream"],
  ["Olive bread", "Olive", "Wheat", "Butter"],
  ["Carrot-radish salad", "Radish", "Carrot", "Sour cream"],
  ["Banana bread", "Banana", "Rye", "Butter"],
  ["Rice porridge with cranberries", "Rice", "Cranberry", "Milk"],
  ["Watermelon-strawberry salad", "Watermelon", "Strawberry", "Whipped cream"],
  ["Cherry-peach jelly", "Peach", "Cherry tree", "Curd"],
  ["Apple-pumpkin cake", "Pumpkin", "Apple tree", "Ice cream"],
  ["Coconut-ice cabbage salad", "Coconut", "Ice cabbage", "Sour cream"],
  ["Raspberry-lime souffle", "Lime", "Raspberry", "Ice cream"],
  ["Green bean-orange salad", "Orange", "Garden Bean", "Cheese"],
  ["Plum-mango souffle", "Mango", "Plum", "Ice cream"],
  ["Pear-apricot compote", "Apricot", "Pear", "Whipped cream"],
  ["Cauliflower-spinach puree", "Spinach", "Cauliflower", "Coffee cream"],
  ["Boiled corn with parsley", "Corn", "Parsley", "Sour cream"],
  ["Pea-mint puree", "Mint", "Pea", "Coffee cream"],
  ["Broad beans with chilli", "Chilli", "Field bean", "Sour cream"],
  ["Hummus", "Lemon", "Chickpea", "Butter"],
  ["Beetroot-garlic puree soup", "Garlic", "Beetroot", "Coffee cream"],
  ["Broccoli-aubergine bake", "Aubergine", "Broccoli", "Coffee cream"],
  ["Fennel-pepper wok", "Pepper", "Fennel", "Coffee cream"],
  ["Parsnip-courgette terrine", "Courgette", "Parsnip", "Coffee cream"],
  ["Magic mushroom salad", "Magic mushroom", "Mushroom", "Sour cream"],
  ["Breaded onion rings", "Onion", "Oat", "Cheese"],
  ["Jerusalem artichoke-tomato soup", "Tomato", "Jerusalem artichoke", "Sour cream"],
  ["Sea kale-pineapple salad", "Pineapple", "Sea kale", "Sour cream"],
  ["Ginger-pak choi wok", "Bok choy", "Ginger", "Coffee cream"],
  ["Sweet potato-basil bake", "Basil", "Sweet Potato", "Coffee cream"],
  ["Blackberry-melissa sorbet", "Lemon balm", "Blackberry", "Milk"],
  ["Asparagus with sage butter", "Asparagus", "Sage", "Butter"],
  ["Cabbage-mushroom rolls", "Chinese cabbage", "Chanterelle", "Sour cream"],
  ["Breaded artichoke", "Artichoke", "Barley", "Butter"],
  ["Okra-chestnut stew", "Okra", "Chestnut", "Coffee cream"],
  ["Grape-blueberry jelly", "White grape", "Blueberry", "Ice cream"],
  ["Paradise compote", "Dark grape", "Paradise Apple", "Curd"],
  ["Winter radish salad with wasabi sauce", "Wasabi", "Winter radish", "Sour cream"],
  ["Two-currant cheesecake", "Redcurrant", "Blackcurrant", "Cream cheese"],
  ["Swede-turnip gratin", "Swede", "Turnip", "Whipped cream"],
  ["Avocado guacamole with jalapeno", "Avocado", "Jalapeno", "Butter"],
  ["Quince-gooseberry marmalade with curd foam", "Quince", "Gooseberry", "Curd"],
  ["Romanesco puree with horseradish", "Romanesco", "Horseradish", "Coffee cream"],
  ["Baked fig with pomegranate sauce", "Fig", "Pomegranate", "Whipped cream"],
  ["Grapefruit-pomelo salad with cream cheese", "Pomelo", "Grapefruit", "Cream cheese"],
  ["Persimmon-kiwi tartare with blue cheese", "Persimmon", "Kiwifruit", "Cheese"],
  ["Date-lingonberry chutney with blue cheese", "Date", "Lingonberry", "Cheese"],
  ["Lychee-carambola compote with ice cream", "Carambola", "Lychee", "Ice cream"],
  ["Wild strawberry-physalis curd cake", "Physalis", "Wild Strawberry", "Curd"],
].map(function (r, i) {
  return { pair: i + 1, lvl: 3 * (i + 1) - 2, name: r[0], green: r[1], field: r[2], dairy: r[3] };
});

/* Fish dishes: [name, species, fruit, dairy] on levels 2, 5, 8 … (3N-1). */
CF.fishDishes = [
  ["Fried herring with dill butter", "Baltic herring", "Dill", "Butter"],
  ["Herring with sour cream", "Herring", "Potato", "Sour cream"],
  ["Bream stuffed with hemp", "Bream", "Cannabis", "Butter"],
  ["Smoked perch with cucumber sauce", "Perch", "Cucumber", "Sour cream"],
  ["Cabbage roll with pike", "Pike", "Cabbage", "Coffee cream"],
  ["Turbot roll with olives", "Turbot", "Olive", "Cheese"],
  ["Carp pie", "Carp", "Wheat", "Milk"],
  ["Smoked flounder with radish salad", "Flounder", "Radish", "Sour cream"],
  ["Burbot liver pate with carrots", "Burbot", "Carrot", "Sour cream"],
  ["Breaded trout with cheese", "Rainbow trout", "Rye", "Cheese"],
  ["Pikeperch-rice roulade", "Pikeperch", "Rice", "Sour cream"],
  ["Sprats in jelly with cranberries", "Sprat", "Cranberry", "Butter"],
  ["Hake fillet in pumpkin sauce", "Hake", "Pumpkin", "Coffee cream"],
  ["Ide with coconut curd", "Ide", "Coconut", "Curd"],
  ["Smoked mackerel with salad", "Mackerel", "Cabbage", "Sour cream"],
  ["Shrimps in lime sauce", "Shrimp", "Lime", "Coffee cream"],
  ["Smelt soup with beans", "Smelt", "Garden Bean", "Sour cream"],
  ["Silver hake rolls with plum", "Silver hake", "Plum", "Cheese"],
  ["Boiled ruffe with spinach", "Ruffe", "Spinach", "Sour cream"],
  ["Haddock with cauliflower", "Haddock", "Cauliflower", "Coffee cream"],
  ["Grilled corn and garfish", "Garfish", "Corn", "Milk"],
  ["Ray slices with curd", "Ray", "Parsley", "Curd"],
  ["Pea-fish cutlets", "Salmon", "Pea", "Butter"],
  ["Spicy fried sterlet", "Sterlet", "Chilli", "Coffee cream"],
  ["Tuna-field bean salad", "Tuna", "Field bean", "Sour cream"],
  ["Smoked trout with lemon", "River trout", "Lemon", "Milk"],
  ["Fried lampreys with beetroot chips", "Lamprey", "Beetroot", "Butter"],
  ["Monkfish in cream with roasted aubergine", "Monkfish", "Aubergine", "Coffee cream"],
  ["Steamed grayling in fennel sauce", "Grayling", "Fennel", "Whipped cream"],
  ["Cod-courgette bake", "Cod", "Courgette", "Cheese"],
  ["Marinated wolffish with stuffed mushrooms", "Wolffish", "Mushroom", "Cream cheese"],
  ["Smoked sturgeon with onion jam", "Sturgeon", "Onion", "Butter"],
  ["Bullhead with Jerusalem artichoke puree", "Bullhead", "Jerusalem artichoke", "Milk"],
  ["Thornback ray rolls with pineapple salsa", "Thornback ray", "Pineapple", "Butter"],
  ["Fried catfish with ginger butter", "Catfish", "Ginger", "Butter"],
  ["Whitefish tartare with basil ice cream", "Whitefish", "Basil", "Ice cream"],
  ["Creamy asp soup with sweet potato", "Asp", "Sweet Potato", "Coffee cream"],
  ["Roasted asparagus rolled in anchovies", "Anchovy", "Asparagus", "Cream cheese"],
  ["Dried bleak with chanterelle dip", "Bleak", "Chanterelle", "Sour cream"],
  ["Smoked eel salad with Chinese cabbage", "Eel", "Chinese cabbage", "Sour cream"],
  ["Grilled swordfish with orzotto", "Swordfish", "Barley", "Cheese"],
  ["Pufferfish sashimi with wasabi cream", "Pufferfish", "Wasabi", "Cream cheese"],
].map(function (r, i) {
  return { n: i + 1, lvl: 3 * (i + 1) - 1, name: r[0], fish: r[1], fruit: r[2], dairy: r[3] };
});

CF.canteenRooms = [
  { id: "dairy",   name: "Dairy warehouse",        desc: "processing and storing dairy products" },
  { id: "granary", name: "Canteen granary",        desc: "fruits obtained from plants" },
  { id: "fish",    name: "Canteen fish warehouse", desc: "fish caught by fishing boat" },
  { id: "menu",    name: "Food menu",              desc: "meals that customers can buy" },
  { id: "veg",     name: "Vegetarian corner",      desc: "prepare food from plants" },
  { id: "fishtab", name: "Fish food table",        desc: "prepare food from fish" },
];

CF.canteen = (function () {
  function P() { return CF.state.player; }
  function C() { return CF.state.canteen; }
  var ok = function (m, x) { var r = { ok: true, msg: m }; if (x) for (var k in x) r[k] = x[k]; return r; };
  var fail = function (m) { return { ok: false, msg: m }; };

  /* ---- stores ---------------------------------------------------------- */
  function dairy() { return C().dairy || (C().dairy = {}); }
  function dairyQty(name) { return dairy()[name] || 0; }
  function fish() { return C().fish || (C().fish = {}); }
  function fishQty(name) { return fish()[name] || 0; }
  /* Fruit lives in the garden's harvest — a harvested plant is "auto-sent to
   * the canteen's fruit warehouse" (official docs), so there is one store. */
  function fruit() { return CF.state.garden.harvest || (CF.state.garden.harvest = {}); }
  function fruitQty(name) { return fruit()[name] || 0; }
  function containerMax() { return CF.ruleset.canteen.containerMax; }

  /* ---- Dairy warehouse -------------------------------------------------- */
  /* "Fill the container" tops the chosen raw liquid up to the container size. */
  function fillContainer(liquid) {
    if (CF.dairyLiquids.indexOf(liquid) < 0) return fail("Choose a liquid to fill the container with.");
    var have = dairyQty(liquid), max = containerMax();
    if (have >= max) return fail("Your " + liquid.toLowerCase() + " container is already full.");
    dairy()[liquid] = max;
    return ok("You filled the container with " + (max - have) + " liters of " + liquid.toLowerCase() + ".");
  }
  /* Brew N liters of a product. Each liter costs one raw milk + one water —
   * OUR tuning, but it fits the reference exactly: a full 100 L of raw milk
   * and 100 L of water became 100 L of the product, leaving both raws at 0. */
  function prepareDairy(product, liters) {
    var c = CF.ruleset.canteen;
    if (CF.dairyProducts.indexOf(product) < 0) return fail("Choose a dairy product.");
    liters = Math.floor(liters);
    if (!(liters > 0)) return fail("Choose how many liters to prepare.");
    if (liters > c.brewMax) return fail("You can brew up to " + c.brewMax + " liters at a time.");
    var needMilk = liters * c.rawMilkPerLiter, needWater = liters * c.waterPerLiter;
    if (dairyQty("Raw milk") < needMilk) return fail("You need " + needMilk + " liters of raw milk — fill the container first.");
    if (dairyQty("Water") < needWater) return fail("You need " + needWater + " liters of water — fill the container first.");
    if (dairyQty(product) + liters > containerMax())
      return fail("Your " + product.toLowerCase() + " container only holds " + containerMax() + " liters.");
    dairy()["Raw milk"] -= needMilk;
    dairy()["Water"] -= needWater;
    dairy()[product] = dairyQty(product) + liters;
    return ok("You made " + liters + " liters of the selected dairy product!");
  }

  /* ---- Cooking skill ---------------------------------------------------- */
  function progress() {
    var lifetime = C().cookPoints || 0, lv = CF.formulas.levelFromLifetimeXPFor("Cooking", lifetime);
    return { level: lv.level, lifetime: lifetime, into: lv.into,
             pointsToLevel: Math.max(0, CF.formulas.pointsToNextLevelFor("Cooking", lv.level) - lv.into) };
  }

  /* ---- The two cooking tables ------------------------------------------ */
  /* Recipe lookups. A vegetarian dish is decided by the FRUIT PAIR you cook;
   * a fish dish by the SPECIES. Both are gated on your Cooking level. */
  function vegDishFor(green, field) {
    var d = null;
    CF.vegDishes.forEach(function (x) { if (x.green === green && x.field === field) d = x; });
    return d;
  }
  function fishDishFor(fishName) {
    var d = null;
    CF.fishDishes.forEach(function (x) { if (x.fish === fishName) d = x; });
    return d;
  }
  /* Which recipes you can cook right now. */
  function knownVegDishes() {
    var lv = progress().level;
    return CF.vegDishes.filter(function (d) { return d.lvl <= lv; });
  }
  function knownFishDishes() {
    var lv = progress().level;
    return CF.fishDishes.filter(function (d) { return d.lvl <= lv; });
  }

  function menu() { return C().menu || (C().menu = { veg: null, fish: null }); }
  function menuLeft(slot) {
    var m = menu()[slot];
    return m ? Math.max(0, Math.round((m.endsAt - Date.now()) / 1000)) : 0;
  }
  function menuDish(slot) { return menuLeft(slot) > 0 ? menu()[slot] : null; }

  /* A dish's level is the highest level among its ingredients — a dairy
   * product's level is its place in the list (Milk 1 … Cream cheese 9).
   * Confirmed by the reference: potato + dill + a level-1 dairy = a Level 1
   * dish, while herring + dill + BUTTER (2nd in the list) = a Level 2 dish. */
  function dairyLevel(name) { return CF.dairyProducts.indexOf(name) + 1; }
  function fruitLevel(name) {
    var l = 0;
    CF.gardenEdibleSeeds.forEach(function (s) { if (s.name === name) l = s.lvl; });
    CF.gardenExchangeFruits.forEach(function (s) { if (s.name === name) l = s.lvl; });
    return l;
  }

  /* A dish occupies its menu slot for `hours` and pays cooking points. Cooking
   * the SAME dish again adds its hours to what is already there — that is how
   * the reference reaches a 49-hour dish off a 10-hour cap. */
  function cook(slot, parts, hours, dish) {
    var c = CF.ruleset.canteen;
    hours = Math.floor(hours);
    if (!(hours > 0)) return fail("Choose how many hours to cook for.");
    if (hours > c.maxHours) return fail("You can cook for up to " + c.maxHours + " hours at a time.");
    // check every ingredient before spending any of them
    var i, p, missing = null;
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      if (!p.name) { missing = p.what; break; }
      var need = p.per * hours;
      if (p.store() < need) { missing = p.name + " (need " + need + " " + p.unit + ")"; break; }
    }
    if (missing) return fail("You don't have enough " + missing + ".");
    for (i = 0; i < parts.length; i++) { p = parts[i]; p.take(p.per * hours); }
    var pts = c.cookPointsPerHour * hours;
    C().cookPoints = (C().cookPoints || 0) + pts;
    var name = dish.name, lvl = dish.lvl;
    // same dish still on the menu -> extend it; a different one replaces it
    var cur = menuDish(slot), extra = cur && cur.name === name ? menuLeft(slot) * 1000 : 0;
    menu()[slot] = { name: name, level: lvl, hours: hours, endsAt: Date.now() + hours * 3600000 + extra };
    var r = ok('You prepared the dish "' + name + '" which will last for ' + hours + " hours!");
    r.pts = pts; r.dish = name; return r;
  }
  /* Ingredient descriptors, so `cook` stays store-agnostic. */
  function fruitPart(name, per, what) {
    return { name: name, per: per, unit: "fruit", what: what,
             store: function () { return fruitQty(name); },
             take: function (n) { fruit()[name] -= n; if (fruit()[name] <= 0) delete fruit()[name]; } };
  }
  function dairyPart(name, per) {
    return { name: name, per: per, unit: "liters", what: "a dairy product",
             store: function () { return dairyQty(name); },
             take: function (n) { dairy()[name] -= n; if (dairy()[name] <= 0) delete dairy()[name]; } };
  }
  function fishPart(name, per) {
    return { name: name, per: per, unit: "kg", what: "a fish",
             store: function () { return fishQty(name); },
             take: function (n) { fish()[name] -= n; if (fish()[name] <= 0) delete fish()[name]; } };
  }
  function cookVeg(greenFruit, fieldCrop, dairyName, hours) {
    var c = CF.ruleset.canteen;
    if (!greenFruit) return fail("Choose a greenhouse fruit.");
    if (!fieldCrop) return fail("Choose a field crop.");
    var dish = vegDishFor(greenFruit, fieldCrop);
    if (!dish) return fail(greenFruit + " and " + fieldCrop +
      " aren't a recipe — a dish takes the greenhouse fruit and field crop of the SAME level.");
    if (dish.lvl > progress().level)
      return fail('"' + dish.name + '" needs Cooking level ' + dish.lvl + ".");
    if (dairyName !== dish.dairy)
      return fail('"' + dish.name + '" is made with ' + dish.dairy.toLowerCase() + ", not " +
        (dairyName ? dairyName.toLowerCase() : "nothing") + ".");
    return cook("veg", [fruitPart(greenFruit, c.vegFruitPerHour, "a greenhouse fruit"),
                        fruitPart(fieldCrop, c.vegCropPerHour, "a field crop"),
                        dairyPart(dairyName, c.vegDairyPerHour)], hours, dish);
  }
  function cookFish(fishName, fruitName, dairyName, hours) {
    var c = CF.ruleset.canteen;
    if (!fishName) return fail("Choose a fish.");
    if (!fruitName) return fail("Choose a fruit.");
    var dish = fishDishFor(fishName);
    if (!dish) return fail("There's no recipe for " + fishName + " yet.");
    if (dish.lvl > progress().level)
      return fail('"' + dish.name + '" needs Cooking level ' + dish.lvl + ".");
    if (fruitName !== dish.fruit)
      return fail('"' + dish.name + '" is made with ' + dish.fruit.toLowerCase() + ", not " + fruitName.toLowerCase() + ".");
    if (dairyName !== dish.dairy)
      return fail('"' + dish.name + '" is made with ' + dish.dairy.toLowerCase() + ", not " +
        (dairyName ? dairyName.toLowerCase() : "nothing") + ".");
    return cook("fish", [fishPart(fishName, c.fishPerHour),
                         fruitPart(fruitName, c.fishFruitPerHour, "a fruit"),
                         dairyPart(dairyName, c.fishDairyPerHour)], hours, dish);
  }

  return {
    dairy: dairy, dairyQty: dairyQty, fish: fish, fishQty: fishQty,
    fruit: fruit, fruitQty: fruitQty, containerMax: containerMax,
    fillContainer: fillContainer, prepareDairy: prepareDairy,
    progress: progress, menu: menu, menuLeft: menuLeft, menuDish: menuDish,
    cookVeg: cookVeg, cookFish: cookFish,
    vegDishFor: vegDishFor, fishDishFor: fishDishFor,
    knownVegDishes: knownVegDishes, knownFishDishes: knownFishDishes,
    /* Reputation: the canteen keeps its own meter, capped like the tavern's.
     * The reference showed it sitting exactly at its cap (10,400). */
    reputation: function () { return C().reputation || 0; },
    reputationMax: function () { return CF.ruleset.canteen.reputationMax; },
  };
})();
