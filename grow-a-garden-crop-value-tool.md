Here’s an upgraded prompt you can paste to your AI builder. It includes the full variants + mutation dataset (with multipliers, conflicts, and fusion rules). Crops data is intentionally left out, like you asked.

---

## Prompt to AI Model

You are creating a new Bloxodes tool page: **“Grow a Garden Crop Value Calculator”** (under **/tools/**).

### Goal

Help Roblox **Grow a Garden** players calculate how many **Sheckles** they get when selling a crop, based on:

* Crop base stats (BaseValue, BaseWeight)
* Fruit weight (kg)
* Quantity
* Variant selection
* Multiple mutations
  Show the final number plus a clear breakdown so users trust the result.

---

## What the calculator must do

### Inputs

1. Pick a Crop
2. Enter:

* Fruit weight (kg)
* Quantity

3. Choose Variant(s)
4. Choose Mutations (multiple)

### Output

* Total Price (Sheckles) for the entered quantity
* Price per fruit
* Breakdown:

  * Base Value used
  * Base Weight used
  * Weight factor: (Weight/BaseWeight)^2
  * Variant multiplier
  * Mutation multiplier calculation
  * Final formula applied

---

## Core formulas (must match the wiki math)

A) **Crop Value**
CropValue = BaseValue × (Weight / BaseWeight)^2

B) **Mutation Multiplier**
MutationMultiplier = VariantMultiplier × (1 + (Sum of selected mutation multipliers) − (Number of selected mutations))

C) **Total Price**
TotalPrice = CropValue × MutationMultiplier
FinalTotal = TotalPrice × Quantity

Note: “Sum of selected mutation multipliers” means summing the numeric multipliers (like Wet = 2, Frozen = 10, Shocked = 100, etc).

---

## Variants (and rules)

* None: ×1
* Ripe: ×1 (allowed to stack with Silver/Gold/Rainbow)
* Silver: ×5
* Gold: ×20
* Rainbow: ×50

Rules:

* Only one of Silver/Gold/Rainbow can be applied at a time
* Ripe can be applied together with Silver or Gold or Rainbow

Include these in the dataset as “variants”.

---

## Important mutation conflict rules (must be enforced)

When user selects a mutation, auto-remove conflicts:

* Paradisal removes Verdant and Sundried
* Cooked removes Burnt
* Ceramic removes Clay
* Frozen removes Wet or Drenched and Chilled
* Clay replaces Sandy and Wet
* Tempestuous removes Windstruck and Twisted (and Sandy if your dataset treats it as part of the combo)
* HarmonisedChakra removes Chakra and CorruptChakra
* HarmonisedFoxfireChakra removes FoxfireChakra and CorruptFoxfireChakra
* AscendedChakra removes HarmonisedChakra and HarmonisedFoxfireChakra

Also enforce “exclusive groups” if present in the dataset (example: only one growth-tier variant like Gold vs Rainbow).

---

## Fusion mutations rules

Some mutations are created by combining others. Treat the fusion as its own selectable mutation with its own multiplier.
If user selects the fusion, do NOT also count its components.
If user selects all components, auto-upgrade into the fusion and remove components.

Fusion rules to enforce:

* Clay = Wet + Sandy
* Frozen = (Wet or Drenched) + Chilled
* Gloom = Bloom + Rot
* OilBoil = Oil + Boil
* Blazing = Molten + Flaming
* Infernal = Meteoric + Blazing
* Maelstrom = Tempestuous + Cyclonic
* Stormcharged = Static + Shocked + Tempestuous
* HarmonisedChakra = Chakra + CorruptChakra
* HarmonisedFoxfireChakra = FoxfireChakra + CorruptFoxfireChakra
* AscendedChakra = HarmonisedChakra + HarmonisedFoxfireChakra
* Cosmic = Celestial + Aurora
* Abyssal = Eclipsed + Voidtouched
* Astral = Cosmic + Galactic
* Corrosive = Acidic + Toxic
* Biohazard = Radioactive + Plagued
* Contagion = Corrosive + Biohazard
* Plagued = Infected + Zombified
* Umbral = Bright + Pestilent
* Slashbound = Sliced + Severed
* Paradisal = Verdant + Sundried
* Ceramic = Sundried + Clay

If any component mutation is missing in dataset, show “missing data” instead of guessing.

---

## UX requirements (match our tools)

* Step flow:
  Step 1 Select crop
  Step 2 Enter weight and quantity
  Step 3 Select variant
  Step 4 Select mutations (search + filters)
  Step 5 Show result + breakdown
* Selected mutations show as removable chips
* Live-updating totals
* Add a “Related guides” block linking to our Grow a Garden guides

---

## Trust and clarity

* Add a “How this calculator works” section explaining the formulas in plain English
* Add a “Data last updated on” line from the dataset
* If a mutation is missing or has TBA multiplier, clearly say it is missing and do not calculate it

---

## DATA TO PROVIDE (paste as datasets)

{
  "meta": {
    "game": "Grow a Garden",
    "dataset": "mutations_cleaned",
    "dataLastUpdatedOn": "2025-12-06",
    "notes": [
      "This is a cleaned version of the mutation list you provided.",
      "All mutations with unknown multipliers are kept but marked isVerified=false and multiplier=null.",
      "Fusion rules are centralized in fusions[] to avoid double counting.",
      "Conflicts are enforced both directly (conflicts[]) and via fusion upgrades (madeFrom)."
    ]
  },
  "variants": [
    { "name": "None", "multiplier": 1, "exclusiveGroup": "metal", "stackableWith": ["Ripe"] },
    { "name": "Ripe", "multiplier": 1, "exclusiveGroup": "ripe", "stackableWith": ["None", "Silver", "Gold", "Rainbow"] },
    { "name": "Silver", "multiplier": 5, "exclusiveGroup": "metal", "stackableWith": ["Ripe"] },
    { "name": "Gold", "multiplier": 20, "exclusiveGroup": "metal", "stackableWith": ["Ripe"] },
    { "name": "Rainbow", "multiplier": 50, "exclusiveGroup": "metal", "stackableWith": ["Ripe"] }
  ],
  "mutations": [
    { "name": "Wet", "multiplier": 2, "type": "standard", "isVerified": true, "conflicts": ["Drenched", "Clay", "Frozen"], "tags": ["environment"] },
    { "name": "Windstruck", "multiplier": 2, "type": "standard", "isVerified": true, "conflicts": ["Tempestuous"], "tags": ["environment"] },
    { "name": "Moonlit", "multiplier": 2, "type": "standard", "isVerified": true, "conflicts": [], "tags": ["environment"] },
    { "name": "Chilled", "multiplier": 2, "type": "standard", "isVerified": true, "conflicts": ["Frozen"], "tags": ["environment"] },
    { "name": "Choc", "multiplier": 2, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "Glimmering", "multiplier": 2, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "Arid", "multiplier": 2, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "Nocturnal", "multiplier": 2, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "Glossy", "multiplier": 2, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },

    { "name": "Pollinated", "multiplier": 3, "type": "standard", "isVerified": true, "conflicts": [], "tags": ["environment"] },
    { "name": "Sandy", "multiplier": 3, "type": "standard", "isVerified": true, "conflicts": ["Clay"], "tags": ["environment"] },
    { "name": "Sauce", "multiplier": 3, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "Meatball", "multiplier": 3, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "Pasta", "multiplier": 3, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "Aromatic", "multiplier": 3, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "Moist", "multiplier": 3, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "Vamp", "multiplier": 3, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },

    { "name": "Cracked", "multiplier": 4, "type": "standard", "isVerified": true, "conflicts": [], "tags": ["environment"] },
    { "name": "Verdant", "multiplier": 4, "type": "standard", "isVerified": true, "conflicts": ["Paradisal"], "tags": ["environment"] },
    { "name": "Burnt", "multiplier": 4, "type": "standard", "isVerified": true, "conflicts": ["Cooked"], "tags": ["environment"] },
    { "name": "Fall", "multiplier": 4, "type": "standard", "isVerified": true, "conflicts": [], "tags": ["seasonal"] },
    { "name": "Wiltproof", "multiplier": 4, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },

    { "name": "Cloudtouched", "multiplier": 5, "type": "standard", "isVerified": true, "conflicts": [], "tags": ["environment"] },
    { "name": "Plasma", "multiplier": 5, "type": "standard", "isVerified": true, "conflicts": [], "tags": ["environment"] },
    { "name": "HoneyGlazed", "multiplier": 5, "type": "standard", "isVerified": true, "conflicts": [], "tags": ["environment"] },
    { "name": "Drenched", "multiplier": 5, "type": "standard", "isVerified": true, "conflicts": ["Wet", "Frozen"], "tags": ["environment"] },
    { "name": "Twisted", "multiplier": 5, "type": "standard", "isVerified": true, "conflicts": ["Tempestuous"], "tags": ["environment"] },
    { "name": "Clay", "multiplier": 5, "type": "fusion", "isVerified": true, "conflicts": ["Sandy", "Wet", "Ceramic"], "tags": ["fusion"] },

    { "name": "Chakra", "multiplier": 5, "type": "limited", "isVerified": true, "conflicts": ["HarmonisedChakra"], "tags": ["chakra"] },
    { "name": "Heavenly", "multiplier": 5, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },

    { "name": "Lush", "multiplier": 6, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "Wildfast", "multiplier": 6, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },

    { "name": "Brewed", "multiplier": 7, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },

    { "name": "Static", "multiplier": 8, "type": "limited", "isVerified": true, "conflicts": ["Stormcharged"], "tags": ["electric"] },
    { "name": "Fried", "multiplier": 8, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "Bloom", "multiplier": 8, "type": "limited", "isVerified": true, "conflicts": ["Gloom"], "tags": ["event"] },
    { "name": "Rot", "multiplier": 8, "type": "limited", "isVerified": true, "conflicts": ["Gloom"], "tags": ["event"] },
    { "name": "Wilt", "multiplier": 8, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },
    { "name": "Spooky", "multiplier": 8, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },

    { "name": "Frozen", "multiplier": 10, "type": "fusion", "isVerified": true, "conflicts": ["Wet", "Drenched", "Chilled"], "tags": ["fusion"] },
    { "name": "Amber", "multiplier": 10, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "Cooked", "multiplier": 10, "type": "limited", "isVerified": true, "conflicts": ["Burnt"], "tags": ["event"] },

    { "name": "Acidic", "multiplier": 12, "type": "standard", "isVerified": true, "conflicts": ["Corrosive"], "tags": ["chemical"] },
    { "name": "Tempestuous", "multiplier": 12, "type": "fusion", "isVerified": true, "conflicts": ["Windstruck", "Twisted"], "tags": ["fusion", "storm"] },

    { "name": "Mirage", "multiplier": 13, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },

    { "name": "Oil", "multiplier": 15, "type": "standard", "isVerified": true, "conflicts": ["OilBoil"], "tags": ["environment"] },
    { "name": "Toxic", "multiplier": 15, "type": "limited", "isVerified": true, "conflicts": ["Corrosive"], "tags": ["chemical"] },
    { "name": "Boil", "multiplier": 15, "type": "admin", "isVerified": true, "conflicts": ["OilBoil"], "tags": ["admin"] },
    { "name": "Gilded", "multiplier": 15, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },
    { "name": "Gourmet", "multiplier": 15, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },
    { "name": "Jackpot", "multiplier": 15, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },

    { "name": "Gnomed", "multiplier": 18, "type": "standard", "isVerified": true, "conflicts": [], "tags": ["environment"] },

    { "name": "Corrupt", "multiplier": 20, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "Tranquil", "multiplier": 20, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "OldAmber", "multiplier": 20, "type": "limited", "isVerified": true, "conflicts": ["AncientAmber"], "tags": ["event"] },
    { "name": "Eclipsed", "multiplier": 20, "type": "standard", "isVerified": true, "conflicts": ["Abyssal"], "tags": ["cosmic"] },

    { "name": "Monsoon", "multiplier": 23, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },

    { "name": "Zombified", "multiplier": 25, "type": "limited", "isVerified": true, "conflicts": ["Plagued"], "tags": ["infection"] },
    { "name": "Molten", "multiplier": 25, "type": "limited", "isVerified": true, "conflicts": ["Blazing"], "tags": ["fire"] },
    { "name": "Flaming", "multiplier": 25, "type": "limited", "isVerified": true, "conflicts": ["Blazing"], "tags": ["fire"] },
    { "name": "Ghostly", "multiplier": 25, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },
    { "name": "Moonbled", "multiplier": 25, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },
    { "name": "Crystalized", "multiplier": 25, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },

    { "name": "OilBoil", "multiplier": 30, "type": "fusion", "isVerified": true, "conflicts": ["Oil", "Boil"], "tags": ["fusion"] },
    { "name": "Gloom", "multiplier": 30, "type": "fusion", "isVerified": true, "conflicts": ["Bloom", "Rot"], "tags": ["fusion"] },

    { "name": "HarmonisedChakra", "multiplier": 35, "type": "fusion", "isVerified": true, "conflicts": ["Chakra", "CorruptChakra", "AscendedChakra"], "tags": ["fusion", "chakra"] },
    { "name": "Enlightened", "multiplier": 35, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },

    { "name": "Corrosive", "multiplier": 40, "type": "fusion", "isVerified": true, "conflicts": ["Acidic", "Toxic", "Contagion"], "tags": ["fusion", "chemical"] },
    { "name": "Subzero", "multiplier": 40, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },

    { "name": "Junkshock", "multiplier": 45, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },

    { "name": "AncientAmber", "multiplier": 50, "type": "limited", "isVerified": true, "conflicts": ["OldAmber"], "tags": ["event"] },
    { "name": "Fortune", "multiplier": 50, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "Cyclonic", "multiplier": 50, "type": "limited", "isVerified": true, "conflicts": ["Maelstrom"], "tags": ["storm"] },
    { "name": "Luminous", "multiplier": 50, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "Ceramic", "multiplier": 50, "type": "fusion", "isVerified": true, "conflicts": ["Clay"], "tags": ["fusion"] },
    { "name": "Blitzshock", "multiplier": 50, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },
    { "name": "Lightcycle", "multiplier": 50, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },
    { "name": "Sliced", "multiplier": 50, "type": "admin", "isVerified": true, "conflicts": ["Slashbound"], "tags": ["admin"] },
    { "name": "Stampede", "multiplier": 50, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },

    { "name": "Blazing", "multiplier": 52, "type": "fusion", "isVerified": true, "conflicts": ["Molten", "Flaming", "Infernal"], "tags": ["fusion", "fire"] },

    { "name": "Radioactive", "multiplier": 55, "type": "admin", "isVerified": true, "conflicts": ["Biohazard"], "tags": ["admin", "infection"] },

    { "name": "Friendbound", "multiplier": 70, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },

    { "name": "Warped", "multiplier": 75, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "Infected", "multiplier": 75, "type": "admin", "isVerified": true, "conflicts": ["Plagued"], "tags": ["admin", "infection"] },

    { "name": "Graceful", "multiplier": 77, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },

    { "name": "Sundried", "multiplier": 85, "type": "limited", "isVerified": true, "conflicts": ["Paradisal"], "tags": ["environment"] },
    { "name": "Glitched", "multiplier": 85, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },

    { "name": "FoxfireChakra", "multiplier": 90, "type": "limited", "isVerified": true, "conflicts": ["HarmonisedFoxfireChakra"], "tags": ["chakra"] },
    { "name": "CorruptFoxfireChakra", "multiplier": 90, "type": "limited", "isVerified": true, "conflicts": ["HarmonisedFoxfireChakra"], "tags": ["chakra"] },
    { "name": "Aurora", "multiplier": 90, "type": "standard", "isVerified": true, "conflicts": ["Cosmic"], "tags": ["cosmic"] },

    { "name": "Leeched", "multiplier": 92, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },

    { "name": "Blackout", "multiplier": 95, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },
    { "name": "Slashbound", "multiplier": 95, "type": "fusion", "isVerified": true, "conflicts": ["Sliced", "Severed"], "tags": ["fusion"] },

    { "name": "Shocked", "multiplier": 100, "type": "standard", "isVerified": true, "conflicts": ["Stormcharged"], "tags": ["electric"] },
    { "name": "Alienlike", "multiplier": 100, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },
    { "name": "Beanbound", "multiplier": 100, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },
    { "name": "Brainrot", "multiplier": 100, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "Paradisal", "multiplier": 100, "type": "fusion", "isVerified": true, "conflicts": ["Verdant", "Sundried"], "tags": ["fusion"] },
    { "name": "Maelstrom", "multiplier": 100, "type": "fusion", "isVerified": true, "conflicts": ["Tempestuous", "Cyclonic"], "tags": ["fusion", "storm"] },

    { "name": "Plagued", "multiplier": 102, "type": "fusion", "isVerified": true, "conflicts": ["Infected", "Zombified", "Biohazard"], "tags": ["fusion", "infection"] },

    { "name": "Touchdown", "multiplier": 105, "type": "admin", "isVerified": true, "conflicts": [], "tags": ["admin"] },

    { "name": "Celestial", "multiplier": 120, "type": "standard", "isVerified": true, "conflicts": ["Cosmic"], "tags": ["cosmic"] },
    { "name": "Galactic", "multiplier": 120, "type": "admin", "isVerified": true, "conflicts": ["Astral"], "tags": ["admin", "cosmic"] },

    { "name": "Disco", "multiplier": 125, "type": "limited", "isVerified": true, "conflicts": [], "tags": ["event"] },
    { "name": "Meteoric", "multiplier": 125, "type": "limited", "isVerified": true, "conflicts": ["Infernal"], "tags": ["cosmic"] },

    { "name": "Voidtouched", "multiplier": 135, "type": "standard", "isVerified": true, "conflicts": ["Abyssal"], "tags": ["cosmic"] },

    { "name": "Dawnbound", "multiplier": 150, "type": "standard", "isVerified": true, "conflicts": [], "tags": ["cosmic"] },

    { "name": "Biohazard", "multiplier": 157, "type": "fusion", "isVerified": true, "conflicts": ["Radioactive", "Plagued", "Contagion"], "tags": ["fusion", "infection"] },

    { "name": "Infernal", "multiplier": 180, "type": "fusion", "isVerified": true, "conflicts": ["Meteoric", "Blazing"], "tags": ["fusion", "fire"] },
    { "name": "Stormcharged", "multiplier": 180, "type": "fusion", "isVerified": true, "conflicts": ["Static", "Shocked", "Tempestuous"], "tags": ["fusion", "electric", "storm"] },

    { "name": "HarmonisedFoxfireChakra", "multiplier": 190, "type": "fusion", "isVerified": true, "conflicts": ["FoxfireChakra", "CorruptFoxfireChakra", "AscendedChakra"], "tags": ["fusion", "chakra"] },

    { "name": "AscendedChakra", "multiplier": 230, "type": "fusion", "isVerified": true, "conflicts": ["HarmonisedChakra", "HarmonisedFoxfireChakra"], "tags": ["fusion", "chakra"] },

    { "name": "Cosmic", "multiplier": 240, "type": "fusion", "isVerified": true, "conflicts": ["Celestial", "Aurora", "Astral"], "tags": ["fusion", "cosmic"] },
    { "name": "Abyssal", "multiplier": 240, "type": "fusion", "isVerified": true, "conflicts": ["Eclipsed", "Voidtouched"], "tags": ["fusion", "cosmic"] },

    { "name": "Contagion", "multiplier": 205, "type": "fusion", "isVerified": true, "conflicts": ["Corrosive", "Biohazard"], "tags": ["fusion", "infection"] },

    { "name": "Astral", "multiplier": 365, "type": "fusion", "isVerified": true, "conflicts": ["Cosmic", "Galactic"], "tags": ["fusion", "cosmic"] },

    { "name": "Severed", "multiplier": null, "type": "admin", "isVerified": false, "conflicts": ["Slashbound"], "tags": ["admin", "unverified"] },
    { "name": "Necrotic", "multiplier": null, "type": "admin", "isVerified": false, "conflicts": [], "tags": ["admin", "unverified"] },
    { "name": "Glacial", "multiplier": null, "type": "admin", "isVerified": false, "conflicts": [], "tags": ["admin", "unverified"] },
    { "name": "Bright", "multiplier": null, "type": "admin", "isVerified": false, "conflicts": ["Umbral"], "tags": ["admin", "unverified"] },
    { "name": "Pestilent", "multiplier": null, "type": "admin", "isVerified": false, "conflicts": ["Umbral"], "tags": ["admin", "unverified"] },
    { "name": "CorruptChakra", "multiplier": null, "type": "limited", "isVerified": false, "conflicts": ["HarmonisedChakra"], "tags": ["chakra", "unverified"] }
  ],
  "fusions": [
    { "name": "Clay", "multiplier": 5, "madeFrom": ["Wet", "Sandy"] },
    { "name": "Frozen", "multiplier": 10, "madeFrom": ["Chilled", "Wet"], "madeFromAlt": ["Chilled", "Drenched"] },
    { "name": "OilBoil", "multiplier": 30, "madeFrom": ["Oil", "Boil"] },
    { "name": "Gloom", "multiplier": 30, "madeFrom": ["Bloom", "Rot"] },
    { "name": "Blazing", "multiplier": 52, "madeFrom": ["Molten", "Flaming"] },
    { "name": "Infernal", "multiplier": 180, "madeFrom": ["Meteoric", "Blazing"] },
    { "name": "Maelstrom", "multiplier": 100, "madeFrom": ["Tempestuous", "Cyclonic"] },
    { "name": "Stormcharged", "multiplier": 180, "madeFrom": ["Static", "Shocked", "Tempestuous"] },
    { "name": "HarmonisedChakra", "multiplier": 35, "madeFrom": ["Chakra", "CorruptChakra"] },
    { "name": "HarmonisedFoxfireChakra", "multiplier": 190, "madeFrom": ["FoxfireChakra", "CorruptFoxfireChakra"] },
    { "name": "AscendedChakra", "multiplier": 230, "madeFrom": ["HarmonisedChakra", "HarmonisedFoxfireChakra"] },
    { "name": "Cosmic", "multiplier": 240, "madeFrom": ["Celestial", "Aurora"] },
    { "name": "Abyssal", "multiplier": 240, "madeFrom": ["Eclipsed", "Voidtouched"] },
    { "name": "Astral", "multiplier": 365, "madeFrom": ["Cosmic", "Galactic"] },
    { "name": "Corrosive", "multiplier": 40, "madeFrom": ["Acidic", "Toxic"] },
    { "name": "Plagued", "multiplier": 102, "madeFrom": ["Infected", "Zombified"] },
    { "name": "Biohazard", "multiplier": 157, "madeFrom": ["Radioactive", "Plagued"] },
    { "name": "Contagion", "multiplier": 205, "madeFrom": ["Corrosive", "Biohazard"] },
    { "name": "Paradisal", "multiplier": 100, "madeFrom": ["Verdant", "Sundried"] },
    { "name": "Ceramic", "multiplier": 50, "madeFrom": ["Sundried", "Clay"] },
    { "name": "Slashbound", "multiplier": 95, "madeFrom": ["Sliced", "Severed"], "requiresVerifiedComponents": false }
  ],
  "uiRules": {
    "hideUnverifiedByDefault": true,
    "preventDuplicates": true,
    "autoUpgradeToFusion": true,
    "whenFusionSelectedRemoveComponents": true
  }
}


## Deliverable

Build the complete “Grow a Garden Crop Value Calculator” tool page using the formulas and these datasets.
No technical writeup.
Just implement the calculator behavior, breakdown, rule enforcement, and internal links.