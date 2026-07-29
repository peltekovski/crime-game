/* ============================================================================
 * ruleset.js — THE SINGLE SOURCE OF TRUTH FOR ALL BALANCE NUMBERS
 * ----------------------------------------------------------------------------
 * Architecture rule #3 from the build brief: never hardcode balance numbers
 * inside game logic. Every tunable constant lives HERE so the economy can be
 * retuned without touching code.
 *
 * NOTE ON FORMAT: delivered as a JS object (not a .json fetched at runtime)
 * because the app must run from file:// where fetch() is blocked. Still pure
 * data — edit freely.
 * ========================================================================== */
window.CF = window.CF || {};

CF.ruleset = {
  /* -- Starting test defaults (values chosen to mirror the reference UI) ---- */
  /* ==========================================================================
   * FRESH ACCOUNT — every value below is taken from a brand-new in-game account
   * (reference screenshots, 2026-07-25). This is what a new player really has;
   * use the debug popup to jump to a later state for testing.
   * ======================================================================== */
  start: {
    name:             "Borche",
    money:            500,        // on-hand CC
    credits:          0,          // premium currency (no UI — nothing spends it)
    tokens:           0,
    bank:             6000,       // starting bank balance
    drinkMasterLevel: 1,
    drinkMasterLifetime: 0,
    drinkMasterInto:  0,
    reputation:       5000,       // a fresh tavern starts at 5,000 reputation
    houseLevel:       0,          // no house yet — every room is locked
    tavernJobAccepted: false,     // the tavern shows a job offer until you accept
    tavernOwned:      false,      // buying it unlocks the 2nd floor + Cooking
    // Body stats a new character starts with (sidebar "Your data")
    durability:       27,
    fighting:         0,          // shown as 0.00 on a fresh account
    weaponHandling:   1, protection: 10, power: 10, speed: 10, skill: 10,
    cooking:          1, medicalScience: 1, mining: 1, warfare: 10,
    // Warehouses start EMPTY on a fresh account.
    fillFraction:     0,
    startFinished:    {},
  },

  /* Buying the tavern (from the in-game offer): needs Drink Master 30 and
   * 1,000,000 CC, and unlocks the second floor (canteen) + the Cooking skill. */
  tavernPurchase: { reqDrinkMaster: 30, priceCC: 1000000 },

  /* -- House levels (official docs) — built with Crafting, gate the house rooms.
   * Each room requires house level = its room number (Crafts=1 … Blacksmith=6).
   * Cost to reach level N = costBase × costRatio^(N-1): 5,000 / 15,000 / 45,000 …
   * Buildable only when Crafting >= N × craftLevelsPerHouseLevel. Max 14. */
  /* firstLevelSkill: you can't craft before you own a house, so the FIRST level
   * is gated on Bartending 10 instead (matches the docs' "buy a house at Drink
   * Master 10"); every level after that needs Crafting = currentLevel x 10. */
  house: { costBase: 5000, costRatio: 3, maxLevel: 14, craftLevelsPerHouseLevel: 10,
           firstLevelSkill: "Bartending", firstLevelReq: 10 },

  /* Bank: deposit/withdraw works; buying the bank itself isn't built. */
  bank: { buyPriceCC: 50000000 },

  /* -- Locations gated behind a HOUSE level (observed on a fresh account):
   *   "To get to the slum, your house must be at least level 1!"
   *   "To access the botanical garden, your house must be at least level 2!" */
  locationHouseReq: { slum: 1, garden: 2, racing: 3, casino: 4 },

  /* -- Casino. Chips ARE the sidebar's tokens; the Cashier is the only door
   * in or out. tokenRate 1 CC = 1 token is inferred from the reference (800
   * chips in hand, 99,200 typed into the exchange box = a round 100,000).
   * defaultBet 100 is the value the reference pre-fills. */
  casino: { tokenRate: 1, defaultBet: 100, slotBets: [100, 1000, 10000] },
  /* Barracks is gated on Durability, not house level, and then costs money. */
  barracks: { reqDurability: 30, priceCC: 50000 },

  /* -- Slum area passes, sold at the market's Ticket counter. The counter's own
   * prices weren't captured, so these are PLACEHOLDERS — swap them for the real
   * numbers when the counter is screenshotted. */
  /* Betting Bunker is VIP-only in the reference; since we don't model VIP it is
   * simply purchasable here. Parking isn't a ticket at all — it needs Speed 15. */
  slumPasses: [
    { id: "bunker",  area: "Betting Bunker", price: 444000 },
    { id: "parking", area: "Parking",        price: 16000 },
  ],
  /* Parking's real gate is Speed 15, but Speed can't be trained yet (the Stadium
   * training isn't built), so a ticket ALSO opens it — either one works. */
  slumStatGates: [
    { area: "Parking", stat: "Speed", level: 15 },
  ],

  /* Rankings are meaningless single-player; the code stays, gated on this flag,
   * ready for when accounts exist. */
  showLeaderboards: false,

  /* -- Chemist / Drug lab (room 2). juicePerPlant: 50 Yam plants → 200 ml (screenshot).
   * beltCapacity: the drug belt held 84 g in the screenshot ("fame allows 86 g" — the
   * docs' "9 + Stealing level" didn't fit this account, so kept as a plain number).
   * juiceSellCC: nominal placeholder price for selling juice on the player market. */
  chemist: { juicePerPlant: 4, beltCapacity: 10, juiceSellCC: 1 },

  /* -- Botanical garden. Stealing costs 1 ticket per attempt (user-confirmed).
   * plantBackpackSize 50 = the backpack's "Plants: (holds 50)"; a plant steal
   * gave 3 steal points and a seed steal 1 (both observed). */
  // ticketsBase 9: the office sells "Stealing level + 9" tickets (official rule);
  // ticketPriceCC 1,950,000 from the reference (14 tickets = 27,300,000 CC).
  garden: { ticketPerSteal: 1, plantBackpackSize: 50, seedsPerSteal: 3,
            stealPointsPlants: 3, stealPointsSeeds: 1,
            // the box office reopens every 24 hours (user-confirmed)
            ticketPriceCC: 1950000, ticketsBase: 9, officeCooldownSec: 24 * 3600,
            /* You are not a gardener until you claim it at "[Become a gardener]",
             * and that needs BOTH the tavern and house level 5 (observed on a
             * fresh account: two ERROR rows, one per unmet requirement).
             * The same two gates apply separately to the greenhouse seed blocks —
             * food seeds want the tavern, herb seeds want house 5. */
            gardenerNeedsTavern: true, gardenerHouseLevel: 5,
            // medicinal beds: 3 to start; buying more needs a Hospital (not built)
            medBedsMax: 3, medBedsHospitalLevel: 3,
            /* -- Edible garden (observed) --
             * land: 3 m² to start, 2 plants per m², 1 m² costs 630,000 CC with a
             * 30-hour cooldown between purchases. A sown plant takes ~75 h and
             * starts at 69/69 moisture; you may water 5 plants per hour.
             * Points per harvested food plant = plant level + 11 (official docs).
             * moistureDecayPerHour and pestChance are OUR tuning, not observed. */
            landStartM2: 3, plantsPerM2: 2, landPriceCC: 630000, landCooldownSec: 30 * 3600,
            edibleGrowHours: 75, moistureMax: 69, moistureMin: 33,
            moistureDecayPerHour: 1, waterPerHour: 5, pestChance: 0.15,   // 1 point per update (confirmed)
            /* Untreated pests eat plants: per plant, per hour, per pest kind
             * present in the garden. OUR tuning — one pest left alone for a
             * full day costs about a tenth of the garden, so clearing it the
             * moment watering turns it up keeps losses near zero. */
            pestKillChancePerHour: 0.004,
            ediblePointsBase: 11, fruitPerPlant: 20,
            /* Culinary exchange (Slum market): swap a field crop for the
             * greenhouse fruit of the same level, 1:1, plus a brokerage fee of
             * 0.01% of your money PER FRUIT. VERIFIED — on 1,040,000 CC the
             * reference charged 1,040 / 2,080 / 5,200 / 10,400 / 104,000 CC for
             * 10 / 20 / 50 / 100 / 1,000 fruit. */
            brokerageRate: 0.0001, exchangeLots: [10, 20, 50, 100, 1000] },

  /* -- Per-skill level curves. Bartending/Crafting/Blacksmithing/Chemist all use
   * the UNIVERSAL curve (levelCurve above). Gardening and Stealing are far
   * flatter and have their own — each anchored to its ONE observed reading:
   *   Gardening L1 -> 161 to next (screenshot XP 75/161)
   *   Stealing  L5 ->  58 to next (screenshot XP 38/58)
   * The 1.2 ratio is ASSUMED (copied from the universal curve) — only the anchor
   * is real, so re-fit once a second level is observed for either skill. */
  skillCurves: {
    // Gardening/Power: ONE observed point each, so the 1.2 ratio is assumed.
    "Gardening":  { ratio: 1.2,   anchorLevel: 1,  anchorValue: 161 },
    "Power":      { ratio: 1.2,   anchorLevel: 13, anchorValue: 11216 },  // "still need 11,216 power points" at L13
    // Stealing/Durability: TWO points each (panel "XP into/need" + the ranking's
    // LIFETIME xp), so these ratios are FITTED, not guessed:
    //   Stealing  L5 needs 58, lifetime 130 -> ratio 1.507 reproduces 130 exactly
    //   Durability L38 needs 77, lifetime 512 -> ratio 1.169 gives 513 (within 1)
    "Stealing":   { ratio: 1.507, anchorLevel: 5,  anchorValue: 58 },
    "Durability": { ratio: 1.169, anchorLevel: 38, anchorValue: 77 },
    /* Medical science has NO entry ON PURPOSE — it rides the UNIVERSAL curve,
     * and only the universal curve fits both observed readings:
     *   L1  "Points to level: 200"  -> universal 199.76 -> 200   (both fit)
     *   L14 "XP to level: 2,137"    -> universal 2136.7 -> 2137
     * The 200-anchored curve this used to carry gives 2,140 at L14, so it was
     * fitting the first reading and drifting off the second. Deleting the entry
     * IS the fix: pointsToNextLevelFor() falls through to pointsToNextLevel(). */
    // Cooking: the canteen's cooking tables read 1,000 into level 2 with 980
    // still to go, so level 2 costs 1,980. Ratio assumed.
    "Cooking": { ratio: 1.2, anchorLevel: 2, anchorValue: 1980 },
  },

  /* -- Medicine laboratory (house room 5). priceUnit is the ONE observed sale
   * price: Rolled bandage and Patch, each 1 x a level-1 plant, at 1,141 CC.
   * CF.medicine.price() scales it by herbs used x plant level — OUR tuning.
   *
   * Points per first aid kit SCALE WITH LEVEL. The "22 points" the packing table
   * quotes is only the level-1 rate, not a flat reward. CONFIRMED:
   *   points(L) = round(kitPointsBase * kitPointsRatio^L)
   * reproduces all fourteen observed rates exactly — 22 25 27 30 34 37 42 46
   * 51 57 63 70 78 86 for L1..L14 — and packing kits one at a time against the
   * universal level curve lands on BOTH real-account checkpoints to the XP:
   *   100 kits -> level 9,  3,464 lifetime XP
   *   200 kits -> level 14, 10,072 lifetime XP, sitting 384 into a 2,137 level
   * That last line is the whole skill panel (XP bar, XP-to-level 1,753, 17.97%)
   * falling out of the two curves with nothing left to tune. */
  medicine: { priceUnit: 1141, kitPointsBase: 20, kitPointsRatio: 1.11 },

  /* -- Harbor (the reference's "Port"). Observed: a level-1 upgrade costs
   * 10,001 CC / 12 h and a level-5 one 13,125 CC / 16 h, which fits
   * cost = 10,001 + 781 x (level-1) and hours = 11 + level exactly.
   * Holds 25/20/15 kg at cargo level 1 (= the "60kg" the ship data reports);
   * 78h 20min driving and "2h 0min" fishing at equipment level 5 give
   * 24 minutes of fishing a level. Engine savings and the pirate raid are
   * OUR tuning. crewMax 5 = the reference's "How many?" dropdown. */
  // shipPriceCC 2,500,000 = the old fisherman's offer before you own a boat.
  harbor: { shipPriceCC: 2500000, upgradeBase: 10001, upgradeStep: 781, upgradeHoursBase: 11,
            holdsBase: [25, 20, 15], crewMax: 5,
            driveMinutesBase: 78 * 60 + 20, driveMinutesFloor: 60, engineMinutesPerLevel: 100,
            fishMinutesPerLevel: 24, pirateChance: 0.35, pirateKeep: 0.5 },

  /* -- Canteen (the tavern's second floor).
   * containerMax 100 and maxHours 10 are read straight off the reference.
   * brewMax is 10 because VIP is excluded from this build — the reference caps
   * a free player at 5 and a VIP at 10, and the user chose the VIP cap.
   * cookPointsPerHour 9: a 10-hour dish took Cooking 1,000 -> 1,090.
   * The per-hour ingredient costs come from the fish dish's deltas (60 -> 50 kg
   * herring, 90 -> 70 fruit, 90 -> 70 liters over 10 hours); the vegetarian
   * costs mirror them. rawMilk/water per liter is OUR tuning, but it matches
   * the reference exactly: two full 100 L containers made 100 L of product. */
  // reputationMax 10,400 is the one observed reading (the reference's canteen
  // sat exactly at its cap), same flat treatment as the tavern's 76,040.
  canteen: { containerMax: 100, brewMax: 10, maxHours: 10, reputationMax: 10400,
             rawMilkPerLiter: 1, waterPerLiter: 1, cookPointsPerHour: 9,
             vegFruitPerHour: 2, vegCropPerHour: 2, vegDairyPerHour: 2,
             fishPerHour: 1, fishFruitPerHour: 2, fishDairyPerHour: 2 },

  /* -- Sports complex. Hand energy +5/h to 120 and steroids = 2x points are
   * CONFIRMED by the official help; steroidEnergy 20 is from the gym screen. */
  sports: { handEnergyMax: 120, handEnergyPerHour: 5, steroidMultiplier: 2, steroidEnergy: 20 },

  /* -- Fame per skill — CONFIRMED by the official help + both skill panels
   * (Gardening L1 -> 9 = 1²·9; Stealing L5 -> 75 = 5²·3). */
  fameFormulas: {
    sq9:  ["Crafting", "Bartending", "Chemist", "Medical science", "Blacksmithing", "Weapon handling", "Gardening"],
    sq3:  ["Stealing", "Cooking"],
    // Warfare isn't in the official list; the reference breakdown shows it
    // contributing a tiny amount at level 10, so it uses the (level-9)² shape
    // rather than the level²·9 default (which would wrongly give it 900).
    sq3m9: ["Speed", "Power", "Skill", "Protection", "Warfare"],   // (level-9)²·3
    sq3m5: ["Durability"],                              // (level-5)²·3
  },

  /* -- CURRENCY (resolved from the reference screenshot: Money 1.15B / CC 0) -
   * Buying raw materials costs CREDITS (CC). Selling drinks (auto, on each
   * update) earns MONEY. Credits deplete as you buy; Money grows from sales. */

  /* -- The tavern "update" cycle -------------------------------------------
   * Every updateIntervalSec, clients arrive and buy drinks automatically (see
   * tavern.runUpdate). The real game uses ~10 min; shortened here so the loop
   * is observable while testing. Each fire = one "per 10 min" business cycle.
   * Back to the real 10 minutes — the "run update now" debug button covers testing. */
  updateIntervalSec: 600,

  /* -- Capacity enforcement ------------------------------------------------
   * Raw materials and raw juice share a per-warehouse TOTAL cap that grows with
   * Bartending level (verified at level 83: materials 2000+120*83 = 11,960 and
   * juice 1000+60*83 = 5,980, matching the reference exactly). Ready-to-sell
   * drinks are uncapped. ON by default; the debug popup can switch it off. */
  enforceCapacity: true,

  /* -- CURRENCY ------------------------------------------------------------
   * CONFIRMED: "CC" is the MONEY balance. Buying 212 leather at 150 CC took
   * exactly 31,800 off Money (1,120,337,710 -> 1,120,305,910). So tavern raw
   * materials (1 CC) and drink sales (up to 80 CC) are Money too.
   * "Credits" is a SEPARATE premium currency (the market's "for credit"
   * counters spend it) and nothing we've built touches it yet. */

  /* -- Prices --------------------------------------------------------------- */
  materialPriceCC: 1,             // nominal 1 CC / unit — the graph's internal drink-cost basis
  // Official docs: the Telephone raw-material BUY price scales WITH tavern reputation
  // (free/cheap at rep 0, higher when famous), NOT flat. Only one reading exists so far
  // (the calculator showed 1 CC at rep 63,367), so this is a LINEAR model anchored to it:
  //   buyPrice(rep) = round(rep * materialPriceCC / materialPriceAnchorRep).
  // Passes through 63,367 -> 1 CC; ~0 (free) at very low reputation. Needs more readings
  // at other reputations to confirm the shape (could be a curve). Tune the anchor to rescale.
  materialPriceAnchorRep: 63367,

  /* -- Crafts room / market craft supplies --------------------------------
   * Unit prices in CC (= Money) read off the Craft supplies counter. You buy a
   * whole backpack at a time: cost = backpackCapacity * unit price. */
  craft: {
    /* SOLVED (2026-07-26): capacity is LINEAR — 130 at Crafting 1, +5 a level.
     * Three consecutive readings off a new account (23 -> 240, 24 -> 245,
     * 25 -> 250) plus the fresh-account 130 pin it exactly.
     * This REPLACES an earlier quadratic fit taken from a single late-game
     * reading (82 -> 214); that reading has to have been a misread, since it
     * is smaller than the level-23 capacity the user has now measured. */
    backpackBase: 130, backpackPerLevel: 5,
    backpackSkill: "Crafting",
    materials: [
      ["Pieces of leather", 150], ["Thread reels", 50], ["Pieces of wood", 1000],
      ["Tin pieces", 550], ["Pieces of iron", 1600], ["Cloth rolls", 500],
      ["Copper pieces", 200], ["Paint cups", 150], ["Clay pieces", 1000],
      ["Plastic pieces", 250], ["Titanium pieces", 3500],
    ],
    /* Hand tools are BOUGHT one-off at the craft supplies counter (prices from
     * the counter screenshot); a fresh account owns none. */
    handToolPrices: { "Needle": 50, "Scissors": 300, "Hammer": 550, "Conversation knife": 750,
                      "Blacksmith pliers": 1200, "Brush": 600, "Bandsaw": 20000 },
    handTools: ["Needle", "Scissors", "Hammer", "Conversation knife",
                "Blacksmith pliers", "Brush", "Bandsaw"],
    // A fresh account owns no craft supplies at all.
    startSupplies: {
      "Pieces of leather": 0, "Thread reels": 0, "Pieces of wood": 0,
      "Tin pieces": 0, "Pieces of iron": 0, "Cloth rolls": 0, "Copper pieces": 0,
      "Paint cups": 0, "Clay pieces": 0, "Plastic pieces": 0, "Titanium pieces": 0,
      // Uranium is used by the Furnaces but is NOT sold at the craft counter —
      // it comes from MINING (not built yet).
      "Uranium": 0,
    },
    startPoints: 0,               // shared Craft points pool — fresh = Crafting 1
  },

  /* Real drink SALE prices (CC) by drink level, from the in-game ready-to-sell
   * list. Not a formula — hand-set per level; prices plateau at 80 CC. Levels
   * 46 & 52 interpolated (cut off in the screenshots); level 6 (Spirit /
   * "Alcohol") is an intermediate shown as "-", priced nominally. The table
   * CONTINUES past 66: L67-71 = 80, then breaks to 90 at L72-74 (observed in the
   * ready-to-sell screen). Prices are NOT capped at 80; levels >74 use priceCapCC. */
  priceByLevel: {
    1: 8,  2: 14, 3: 10, 4: 16, 5: 14, 6: 14, 7: 16, 8: 20, 9: 18, 10: 24,
    11: 16, 12: 28, 13: 18, 14: 26, 15: 20, 16: 22, 17: 18, 18: 30, 19: 28, 20: 30,
    21: 28, 22: 30, 23: 28, 24: 30, 25: 28, 26: 34, 27: 30, 28: 36, 29: 32, 30: 36,
    31: 28, 32: 46, 33: 30, 34: 40, 35: 34, 36: 40, 37: 40, 38: 44, 39: 38, 40: 46,
    41: 40, 42: 48, 43: 40, 44: 50, 45: 48, 46: 48, 47: 54, 48: 60, 49: 50, 50: 64,
    51: 52, 52: 54, 53: 56, 54: 74, 55: 62, 56: 68, 57: 66, 58: 74, 59: 70, 60: 76,
    61: 72, 62: 80, 63: 80, 64: 80, 65: 80, 66: 80,
    67: 80, 68: 80, 69: 80, 70: 80,          // 67-70 interpolated (unobserved), bracketed by observed 66 & 71 = 80
    71: 80, 72: 90, 73: 90, 74: 90,          // OBSERVED (ready-to-sell screen): price breaks 80 -> 90 at L72
  },
  priceCapCC: 90,                 // highest OBSERVED (L72-74=90); prices are NOT capped at 80 — likely keep climbing above 74

  /* -- Warehouse capacities (SHARED TOTAL per warehouse) -------------------
   * cap = base + perLevel * DrinkMasterLevel. Derived from the screenshot:
   * materials at level 64 = 9,680  ->  2000 + 120*64 = 9,680  (exact match).
   * juice mirrors it at half (1000 + 60*level -> 4,840 at level 64).
   * finished-goods cap is our own design choice (mirrors materials). */
  warehouse: {
    rawMaterialsBase: 2000, rawMaterialsPerLevel: 120,
    rawJuiceBase:     1000, rawJuicePerLevel:     60,
    finishedBase:     2000, finishedPerLevel:     120,   // OUR design choice
  },

  /* -- Reputation cap — an UPGRADE value, not a level formula --------------
   * Observed tiers: 76,040 (Bartending L64-67), 95,908 (L68), 143,792 (a higher-
   * level account, drinks unlocked to L74). Not per-level; it looks like a
   * tavern upgrade we haven't modelled yet. Kept as a plain editable number
   * (also settable in the debug panel). */
  reputationMax: 76040,

  /* -- Juicing (Juicer #1) -------------------------------------------------- */
  juiceLitersPerUnit: 1,          // 1 raw material -> 1 L raw juice (our choice)

  /* -- Crafting ------------------------------------------------------------- */
  ingredientQtyDefault: 1,        // each recipe ingredient consumes 1 per output (OUR choice; none observed)
  // XP per Mix click = xpPerClickByLevel[drink.unlockLevel] — CONFIRMED from the
  // in-game reference table (indexed level 1..66). Matches the NOTICEs exactly
  // (L65=22,608, L66=25,885). It is a FLAT amount per click, independent of
  // drinks-made and reputation. Above level 66 we extrapolate geometrically.
  xpPerClickByLevel: [
    4, 4, 5, 6, 7, 8, 9, 10, 12, 13,            // 1-10
    15, 17, 20, 23, 26, 30, 34, 39, 45, 51,      // 11-20
    59, 67, 77, 88, 101, 115, 132, 151, 173, 198, // 21-30
    227, 260, 297, 341, 390, 446, 511, 585, 670, 767, // 31-40
    878, 1005, 1151, 1318, 1509, 1728, 1978, 2265, 2593, 2969, // 41-50
    3399, 3892, 4456, 5102, 5841, 6687, 7657, 8766, 10037, 11491, // 51-60
    13157, 15064, 17247, 19764, 22608, 25885,    // 61-66
    29636, 33931,                                // 67-68 (read off in-game NOTICEs)
  ],
  xpExtrapolateRatio: 1.14493,    // for drink levels above the table (69+)

  /* -- Finished-good sell price (OUR formula; none observed) ---------------
   * price_CC = base + perLevel*unlockLevel + markup*inputCostCC */
  price: { base: 5, perLevel: 2, markup: 3 },

  /* -- Reputation -> throughput curves (CONFIRMED to depend on reputation
   * ONLY; exact curve NOT confirmed — OUR power fits to the brief's table) - */
  // Power-law fits — now used only to EXTRAPOLATE above the last anchor below.
  drinkPerClick:   { A: 0.006296, p: 0.6785 },  // dpc = A * rep^p
  clientsPer10Min: { B: 0.04343,  q: 0.89173 }, // clients = B * rep^q

  /* -- OBSERVED reputation -> throughput anchors ---------------------------
   * No single power law fits the whole range: one fitted to the mid range
   * overshoots badly at low reputation (at rep 5,000 it predicts ~86 customers
   * and ~2.0 drinks/click where a fresh account really shows 71 and 1.0), and
   * one fitted to the low end overshoots at the top. So we INTERPOLATE between
   * the readings we actually have (log-log linear) and only fall back to the
   * power law above the last anchor. Every observed point is reproduced exactly.
   * Add new [reputation, value] pairs here as they're read off in-game. */
  clientAnchors: [
    [5000, 71], [63367, 832], [92678, 1167], [143792, 1433],
    [150000, 1459], [500000, 2917], [1000000, 5000], [1500000, 6310],
  ],
  dpcAnchors: [
    [5000, 1.0], [10000, 3.0], [20000, 4.6], [63367, 11.3],
    [150000, 20.1], [500000, 41.9], [1000000, 73.0], [1500000, 91.5],
  ],

  /* -- Reputation gained from selling drinks — from 3 in-game calculator reads
   * DIMINISHING RETURNS: the gain PER DRINK is C/reputation, so selling more (or
   * having higher reputation) yields less each. Integrating gives
   *     repGain = sqrt(rep^2 + 2*C*drinks) - rep,   C = repGainLevelCoef * level^3
   * Fits all three samples within 0.19%:
   *   23,610 drinks @ lvl67/rep 67,397 -> 18,003
   *   19,583 drinks @ lvl66/rep 66,713 -> 14,678
   *   29,057 drinks @ lvl67/rep 68,086 -> 21,468
   * (level^3 is inferred from just two levels — worth re-checking later.) */
  repGainLevelCoef: 0.19346,

  /* -- Reputation LOST when clients go unsatisfied (official docs: an open tavern
   * with too little stock DROPS reputation). The docs confirm the direction but
   * not the magnitude, so this is OUR model: symmetric to the gain (same C),
   * mirrored downward — repLoss = rep - sqrt(rep^2 - 2*C*unsatisfied), floored so
   * reputation can't go below 0. Net per update = gain(satisfied) - loss(missed),
   * i.e. you climb if you serve over half the arrivals and slide if you serve less.
   * Tune repLossCoef down to soften the penalty. */
  repLossCoef: 0.19346,

  /* -- Bartending leveling XP curve — CONFIRMED geometric, ratio 1.2 -----
   * pointsToNext(65)/pointsToNext(64) = 23,340,054 / 19,450,045 = 1.2 exactly.
   * pointsToNext(L) = anchorValue * ratio^(L - anchorLevel). */
  levelCurve: { ratio: 1.2, anchorLevel: 64, anchorValue: 19450045 },

  /* -- Calculator default --------------------------------------------------- */
  calcDefaultBatch: 1000,

  /* -- Cosmetic character-sheet stats (non-functional placeholders, set to
   * the reference screenshot so the "Your data" panel looks right) --------- */
  cosmeticStats: {
    // A FRESH account: no fame, durability 27/27, Fighting shown as 0.00.
    fame: 0, activityPct: 50, durabilityCur: 27, durabilityMax: 27,
    // Only the stats we don't simulate live are listed here; the real skills
    // (Crafting, Blacksmithing, Chemist, Stealing, Gardening, Power, Durability)
    // read their level from state, so their numbers here are just placeholders.
    rows: [
      ["Fighting", "0.00"], ["Weapon handling", "1"], ["Protection", "10"],
      ["Power", "10"], ["Speed", "10"], ["Skill", "10"], ["Cooking", "1"],
      ["Gardening", "1"], ["Stealing", "1"], ["Chemist", "1"], ["Crafting", "1"],
      ["Blacksmithing", "1"], ["Medical science", "1"], ["Mining", "1"], ["Warfare", "10"],
    ],
  },
};
