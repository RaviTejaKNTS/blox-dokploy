You are building a "The Forge Crafting Calculator" tool page for a Roblox game.

The page lives under a "Tools".
Ignore tech stack details.  
Focus on correct game logic and clean UI that fits into an existing modern tools layout.

Your job:
1. Use the full game data I give below.
2. Implement internal data structures for ores, traits, weapons, and armors.
3. Implement forging logic that approximates how The Forge works.
4. Expose a clean UI so users can:
   - Pick Weapon mode or Armor mode.
   - Choose ores and how many of each they are using.
   - See predicted result probabilities:
     - Weapon class chances and specific weapon chances.
     - Armor weight class and specific armor piece chances.
   - See final total multiplier and active traits.
   - Optionally switch between "Weapon" and "Armor" tabs.

Do not leave any field ambiguous. Fill all data exactly as specified.

==================================================
1. CORE FORGING RULES
==================================================

Use these rules to drive the calculator logic.

1.1 Weapon forging overview

- Players choose 3 or more ores.
- The game rolls what weapon class they get based on how many ores they put in.
- Once the class is chosen (Dagger, Straight Sword, Katana, etc) the game rolls again to decide which specific weapon in that class they get.
- In the real game it is RNG.  
  In this calculator you must show probabilities, not guaranteed results.

1.2 Armor forging overview

- Players choose 3 or more ores in Armor mode.
- Armor has:
  - Slot: Helmet, Chestplate, Leggings.
  - Weight: Light, Medium, Heavy.
  - Special variants: Samurai (Medium), Knight and Dark Knight (Heavy).
- More and better ores increase the chance to get heavier armor (Medium, Heavy) and special variants (Samurai, Dark Knight).
- Again, show probabilities, not guarantees.

1.3 Ore multipliers

- Every ore has a multiplier.
- The final stat multiplier for the crafted item is the weighted average of ore multipliers:

  total_multiplier = (sum over ores: ore_count * ore_multiplier) / total_ore_count

- This multiplier applies to base weapon or armor stats.

1.4 Ore traits

- Some ores have traits that give extra effects to weapons or armor.
- You must handle traits like this:
  - For each trait ore, compute share = ore_count / total_ore_count.
  - If share >= 0.10, the trait is activated on the crafted item.
  - If share >= 0.30, treat the trait as "optimal" and apply full effect.
  - If share is between 0.10 and 0.30, treat it as partial strength if you want to scale it, or just display that it is "active (non optimal)".

- Multiple traits can be active at the same time if multiple trait ores reach at least 10 percent.

1.5 Weapon class thresholds by ore count

Use this table from The Forge crafting guide and turn it into an approximate probability model.  
These are per weapon class:

- Dagger:        min_ore = 3,  optimal_ore = 3
- Straight Sword: min_ore = 4,  optimal_ore = 8
- Gauntlet:      min_ore = 7,  optimal_ore = 11
- Katana:        min_ore = 9,  optimal_ore = 15
- Great Sword:   min_ore = 12, optimal_ore = 20
- Great Axe:     min_ore = 16, optimal_ore = 37
- Colossal Sword: min_ore = 21, optimal_ore = 46

Turn these into class probabilities as follows:

- Let n = total ore count.
- For each class:
  - If n < min_ore: score = 0.
  - If n >= optimal_ore: score = 1.
  - If min_ore <= n < optimal_ore:
    score = (n - min_ore) / (optimal_ore - min_ore)
- After computing scores for all classes, normalise:

  class_probability = score_class / sum_of_all_scores

- If only one class has a positive score, it gets 100 percent chance.

This gives a smooth progression:
- At low ore counts you are stuck with Daggers.
- As you add more ores, Straight Swords, Gauntlets, Katanas, etc start to appear.
- At very high ore counts Colossal Swords dominate.

1.6 Armor thresholds by ore count

Use the armor thresholds like this:

- Light Armor:
  - Helmet min_ore = 3, optimal_ore = 3
  - For calculator simplicity, treat Light weight as "unlocked" once n >= 3.

- Medium Armor:
  - Helmet min_ore = 10, optimal_ore = 17

- Heavy Armor:
  - Helmet min_ore = 20, optimal_ore = 46

You must build a similar scoring system for armor weight classes:

For each armor weight (Light, Medium, Heavy):
- If n < min_ore: score = 0.
- If n >= optimal_ore: score = 1.
- Else score = (n - min_ore) / (optimal_ore - min_ore).

Normalise scores over Light, Medium, Heavy to get probabilities.

You should still show exact armor pieces (Light Helmet, Samurai Chestplate, Dark Knight Leggings etc) inside each weight based on their relative chances (see armor list below).

1.7 Variations inside each class

For both weapons and armors:

- The game shows "Chance to craft" values like 1/1, 1/2, 1/4, 1/16 for each item inside a class.
- Use these as relative weights inside that class.

Implementation:

- For each item with chance 1/x, set weight = 1 / x.
- For that class, sum all weights.
- Item_probability_inside_class = weight_item / weight_sum_for_class.
- Final absolute probability for an item:
  item_probability = class_probability * item_probability_inside_class.

==================================================
2. ORE DATA
==================================================

Define an Ore data structure with fields:

- id (slug friendly name)
- name
- rarity
- area_group (Stonewake, Forgotten Kingdom, Goblin Cave, Enemy Drop)
- drop_chance_ratio (as 1/x)
- multiplier
- sell_price
- has_trait (boolean)
- trait_name (null if none)
- trait_effect_short (string)
- trait_type ("weapon", "armor", "both", "aoe", "movement", etc)

Use this complete table. Values here come from up to date ore guides.

Stonewake’s Cross ores:
- Stone:         Common,    area_group: "Stonewake", drop 1/1,   multiplier 0.20, sell 3,      no trait.
- Sand Stone:    Common,    Stonewake,  drop 1/2,   multiplier 0.25, sell 3.75,   no trait.
- Copper:        Common,    Stonewake,  drop 1/3,   multiplier 0.30, sell 4.5,    no trait.
- Iron:          Common,    Stonewake,  drop 1/5,   multiplier 0.35, sell 5.25,   no trait.
- Cardboardite:  Common,    Stonewake,  drop 1/31,  multiplier 0.70, sell 10.5,   no trait.
- Tin:           Uncommon,  Stonewake,  drop 1/7,   multiplier 0.425, sell 6.38,  no trait.
- Silver:        Uncommon,  Stonewake,  drop 1/12,  multiplier 0.60, sell 7.5,    no trait.
- Gold:          Uncommon,  Stonewake,  drop 1/16,  multiplier 0.65, sell 19.5,   no trait.
- Bananite:      Uncommon,  Stonewake,  drop 1/30,  multiplier 0.65, sell 12.75,  no trait.
- Mushroomite:   Rare,      Stonewake,  drop 1/22,  multiplier 0.80, sell 12,     no trait.
- Platinum:      Rare,      Stonewake,  drop 1/28,  multiplier 0.80, sell 12,     no trait.
- Aite:          Epic,      Stonewake,  drop 1/44,  multiplier 1.00, sell 16.5,   no trait.
- Poopite:       Epic,      Stonewake,  drop 1/131, multiplier 1.20, sell 18,     has_trait.

Forgotten Kingdom ores:
- Cobalt:        Uncommon,  Forgotten,  drop 1/37,  multiplier 1.00, sell 15,     no trait.
- Titanium:      Uncommon,  Forgotten,  drop 1/50,  multiplier 1.15, sell 17.25,  no trait.
- Lapis Lazuli:  Uncommon,  Forgotten,  drop 1/73,  multiplier 1.30, sell 22.5,   no trait.
- Volcanic Rock: Rare,      Forgotten,  drop 1/55,  multiplier 1.55, sell 23.25,  no trait.
- Quartz:        Rare,      Forgotten,  drop 1/90,  multiplier 1.50, sell 22.5,   no trait.
- Amethyst:      Rare,      Forgotten,  drop 1/115, multiplier 1.65, sell 24.75,  no trait.
- Topaz:         Rare,      Forgotten,  drop 1/143, multiplier 1.75, sell 26.25,  no trait.
- Diamond:       Rare,      Forgotten,  drop 1/192, multiplier 2.00, sell 30,     no trait.
- Sapphire:      Rare,      Forgotten,  drop 1/247, multiplier 2.25, sell 33.75,  no trait.
- Cuprite:       Epic,      Forgotten,  drop 1/303, multiplier 2.43, sell 36.45,  no trait.
- Obsidian:      Epic,      Forgotten,  drop 1/333, multiplier 2.35, sell 35.25,  has_trait.
- Emerald:       Epic,      Forgotten,  drop 1/363, multiplier 2.55, sell 38.25,  no trait.
- Ruby:          Epic,      Forgotten,  drop 1/487, multiplier 2.95, sell 44.25,  no trait.
- Rivalite:      Epic,      Forgotten,  drop 1/569, multiplier 3.33, sell 49.95,  has_trait.
- Uranium:       Legendary, Forgotten,  drop 1/777, multiplier 3.00, sell 66,     has_trait.
- Mythril:       Legendary, Forgotten,  drop 1/813, multiplier 3.50, sell 52.5,   has_trait.
- Eye Ore:       Legendary, Forgotten,  drop 1/1333, multiplier 4.00, sell 37.5,  has_trait.
- Fireite:       Legendary, Forgotten,  drop 1/2187, multiplier 4.50, sell 67.5,  has_trait.
- Magmaite:      Legendary, Forgotten,  drop 1/3003, multiplier 5.00, sell 75,    has_trait.
- Lightite:      Legendary, Forgotten,  drop 1/3333, multiplier 4.60, sell 69,    has_trait.
- Demonite:      Mythical,  Forgotten,  drop 1/3666, multiplier 5.50, sell 82.5,  has_trait.
- Darkryte:      Mythical,  Forgotten,  drop 1/5555, multiplier 6.30, sell 94.5,  has_trait.

Goblin Cave ores:
- Magenta Crystal: Epic, Goblin, drop 1/255, multiplier 3.10, sell 46.5, no trait.
- Crimson Crystal: Epic, Goblin, drop 1/255, multiplier 3.30, sell 49.5, no trait.
- Green Crystal:   Epic, Goblin, drop 1/255, multiplier 3.20, sell 48,   no trait.
- Orange Crystal:  Epic, Goblin, drop 1/255, multiplier 3.00, sell 45,   no trait.
- Blue Crystal:    Epic, Goblin, drop 1/255, multiplier 3.40, sell 51,   no trait.
- Arcane Crystal:  Epic, Goblin, drop 1/255, multiplier 7.50, sell 112.5, no trait.
- Rainbow Crystal: Legendary, Goblin, drop 1/5000, multiplier 5.25, sell 78.75, no trait.
- Galaxite:       Divine, Goblin, drop 1/1_000_000, multiplier 11.5, sell unknown, no trait.

Enemy drop ores:
- Slimite:        Epic, Enemy, drop 1/247, multiplier 2.25, sell 37.5, no trait.
- Dark Boneite:   Rare, Enemy, drop 1/555, multiplier 2.25, sell 33.75, no trait.
- Boneite:        Rare, Enemy, drop 1/222, multiplier 1.20, sell 18,    no trait.

2.1 Trait definitions

Populate trait fields like this:

- Poopite:
  - trait_name: "Poison Panic"
  - trait_effect_short: "When HP is below 35 percent, deals 15 percent poison damage around you for a few seconds, with a cooldown."
  - trait_type: "aoe"

- Obsidian:
  - trait_name: "Obsidian Guard"
  - trait_effect_short: "Armor only. Increases armor defense by about 30 percent."
  - trait_type: "armor"

- Rivalite:
  - trait_name: "Critical Edge"
  - trait_effect_short: "Weapons only. Raises critical hit chance by about 20 percent."
  - trait_type: "weapon"

- Uranium:
  - trait_name: "Radioactive Pulse"
  - trait_effect_short: "Armor only. Deals periodic area damage equal to around 5 percent of max HP."
  - trait_type: "armor_aoe"

- Mythril:
  - trait_name: "Mythril Guard"
  - trait_effect_short: "Armor only. Adds around 15 percent extra defense."
  - trait_type: "armor"

- Eye Ore:
  - trait_name: "Blood Price"
  - trait_effect_short: "On weapons or armor, lowers max HP by about 10 percent but increases damage by about 15 percent."
  - trait_type: "both"

- Fireite:
  - trait_name: "Flame Brand"
  - trait_effect_short: "Weapons only. Adds about 20 percent burn damage for a short time with moderate chance on hit."
  - trait_type: "weapon"

- Magmaite:
  - trait_name: "Volcanic Burst"
  - trait_effect_short: "Weapons only. Gives a chance to trigger a strong area explosion on hit."
  - trait_type: "weapon_aoe"

- Lightite:
  - trait_name: "Lightfoot"
  - trait_effect_short: "Armor only. Increases movement speed by about 15 percent."
  - trait_type: "movement"

- Demonite:
  - trait_name: "Hellfire"
  - trait_effect_short: "Weapons: lower burn chance but higher damage. Armor: Demon style passive that burns attackers."
  - trait_type: "both"

- Darkryte:
  - trait_name: "Shadowstep"
  - trait_effect_short: "Armor only. On taking damage, roughly 15 percent chance to dodge the attack as a shadow."
  - trait_type: "armor_defense"

==================================================
3. WEAPON DATA
==================================================

Define a Weapon data structure with fields:

- id
- name
- class ("Dagger", "Straight Sword", "Katana", "Great Sword", "Great Axe", "Gauntlet", "Colossal Sword")
- base_damage
- base_speed_seconds
- base_range
- sell_price
- internal_weight_ratio (based on 1/x chance)
- class_min_ore
- class_optimal_ore

Use this list.

3.1 Daggers (class_min_ore 3, class_optimal_ore 3)

- Dagger:
  - chance 1/1
  - damage 4.3
  - speed 0.35
  - range 6
  - sell 68

- Falchion Knife:
  - chance 1/2
  - damage 4.3
  - speed 0.35
  - range 6
  - sell 68

- Gladius Dagger:
  - chance 1/4
  - damage 4.3
  - speed 0.32
  - range 6
  - sell 68

- Hook:
  - chance 1/16
  - damage 4.3
  - speed 0.35
  - range 6
  - sell 68

3.2 Great Swords (class_min_ore 12, class_optimal_ore 20)

- Crusaders Sword:
  - chance 1/1
  - damage 12
  - speed 1.00
  - range 9
  - sell 485

- Long Sword:
  - chance 1/2
  - damage 12
  - speed 1.10
  - range 9
  - sell 485

3.3 Great Axes (class_min_ore 16, class_optimal_ore 37)

- Double Battle Axe:
  - chance 1/1
  - damage 15.75
  - speed 1.05
  - range 9
  - sell 850

- Scythe:
  - chance 1/2
  - damage 14.25
  - speed 0.95
  - range 9
  - sell 850

3.4 Katanas (class_min_ore 9, class_optimal_ore 15)

- Tachi:
  - chance 1/2
  - damage 8.925
  - speed 0.63
  - range 9
  - sell 324

- Uchigatana:
  - chance 1/11
  - damage 8.5
  - speed 0.60
  - range 9
  - sell 324

3.5 Straight Swords (class_min_ore 4, class_optimal_ore 8)

- Chaos:
  - chance 1/64
  - damage 9.375
  - speed 0.59
  - range 8
  - sell 120

- Cutlass:
  - chance 1/4
  - damage 9.375
  - speed 0.66
  - range 8
  - sell 120

- Falchion Sword:
  - chance 1/1
  - damage 7.5
  - speed 0.59
  - range 8
  - sell 120

- Gladius Sword:
  - chance 1/2
  - damage 7.875
  - speed 0.62
  - range 8
  - sell 120

- Rapier:
  - chance 1/8
  - damage 7.5
  - speed 0.49
  - range 8
  - sell 120

3.6 Gauntlets (class_min_ore 7, class_optimal_ore 11)

- Boxing Gloves:
  - chance 1/4
  - damage 8
  - speed 0.59
  - range 6
  - sell 205

- Ironhand:
  - chance 1/1
  - damage 7.6
  - speed 0.51
  - range 6
  - sell 205

- Relevator:
  - chance 1/16
  - damage 9.6
  - speed 0.69
  - range 6
  - sell 205

3.7 Colossal Swords (class_min_ore 21, class_optimal_ore 46)

- Comically Large Spoon:
  - chance 1/16
  - damage 18
  - speed 1.20
  - range 10
  - sell 1355

- Dragon Slayer:
  - chance 1/3
  - damage 22
  - speed 1.12
  - range 10
  - sell 1355

- Great Sword:
  - chance 1/1
  - damage 20
  - speed 1.12
  - range 10
  - sell 1355

- Hammer:
  - chance 1/2
  - damage 22
  - speed 1.24
  - range 10
  - sell 1355

- Skull Crusher:
  - chance 1/2
  - damage 24
  - speed 1.40
  - range 10
  - sell 1355

==================================================
4. ARMOR DATA
==================================================

Define an ArmorPiece data structure with fields:

- id
- name
- weight_class ("Light", "Medium", "Samurai", "Knight", "Dark Knight")
- slot ("Helmet", "Chestplate", "Leggings")
- base_health_percent (as percent of HP)
- chance_ratio (1/x)
- sell_price
- base_weight_group_for_probabilities ("Light", "Medium", "Heavy")

Map Samurai to Medium weight.  
Map Knight and Dark Knight to Heavy weight, but keep their names.

Use this list.

Light armor:
- Light Helmet:
  - weight_class "Light"
  - slot "Helmet"
  - base_health_percent 3.75
  - chance_ratio 1/1
  - sell 65
  - base_weight_group "Light"

- Light Chestplate:
  - weight_class "Light"
  - slot "Chestplate"
  - base_health_percent 5.00
  - chance_ratio 1/1
  - sell 225
  - base_weight_group "Light"

- Light Leggings:
  - weight_class "Light"
  - slot "Leggings"
  - base_health_percent 4.375
  - chance_ratio 1/1
  - sell 112.5
  - base_weight_group "Light"

Medium armor:
- Medium Helmet:
  - weight_class "Medium"
  - slot "Helmet"
  - base_health_percent 6.25
  - chance_ratio 1/1
  - sell 335
  - base_weight_group "Medium"

- Medium Chestplate:
  - weight_class "Medium"
  - slot "Chestplate"
  - base_health_percent 8.75
  - chance_ratio 1/1
  - sell 850
  - base_weight_group "Medium"

- Medium Leggings:
  - weight_class "Medium"
  - slot "Leggings"
  - base_health_percent 7.5
  - chance_ratio 1/1
  - sell 485
  - base_weight_group "Medium"

Samurai armor (Medium variant):
- Samurai Helmet:
  - weight_class "Samurai"
  - slot "Helmet"
  - base_health_percent 8.0
  - chance_ratio 1/2
  - sell 335
  - base_weight_group "Medium"

- Samurai Chestplate:
  - weight_class "Samurai"
  - slot "Chestplate"
  - base_health_percent 12.75
  - chance_ratio 1/2
  - sell 850
  - base_weight_group "Medium"

- Samurai Leggings:
  - weight_class "Samurai"
  - slot "Leggings"
  - base_health_percent 9.0
  - chance_ratio 1/2
  - sell 485
  - base_weight_group "Medium"

Knight armor (Heavy variant):
- Knight Helmet:
  - weight_class "Knight"
  - slot "Helmet"
  - base_health_percent 12.5
  - chance_ratio 1/1
  - sell 1020
  - base_weight_group "Heavy"

- Knight Chestplate:
  - weight_class "Knight"
  - slot "Chestplate"
  - base_health_percent 16.25
  - chance_ratio 1/1
  - sell 1355
  - base_weight_group "Heavy"

- Knight Leggings:
  - weight_class "Knight"
  - slot "Leggings"
  - base_health_percent 13.75
  - chance_ratio 1/1
  - sell 1200
  - base_weight_group "Heavy"

Dark Knight armor (Heavy variant):
- Dark Knight Helmet:
  - weight_class "Dark Knight"
  - slot "Helmet"
  - base_health_percent 18.75
  - chance_ratio 1/2
  - sell 1020
  - base_weight_group "Heavy"

- Dark Knight Chestplate:
  - weight_class "Dark Knight"
  - slot "Chestplate"
  - base_health_percent 25.0
  - chance_ratio 1/2
  - sell 1355
  - base_weight_group "Heavy"

- Dark Knight Leggings:
  - weight_class "Dark Knight"
  - slot "Leggings"
  - base_health_percent 21.875
  - chance_ratio 1/2
  - sell 1200
  - base_weight_group "Heavy"

Armor probabilities inside each weight group work like weapons inside a class:

- Example for Heavy Helmet:
  - Knight Helmet has chance 1/1.
  - Dark Knight Helmet has chance 1/2.
  - So Heavy Helmet weights:
    - Knight weight = 1.0
    - Dark Knight weight = 0.5
    - Total = 1.5
    - Knight probability inside Heavy Helmets = 1.0 / 1.5
    - Dark Knight probability inside Heavy Helmets = 0.5 / 1.5

==================================================
5. CALCULATOR BEHAVIOR
==================================================

5.1 Inputs

On the UI, provide:

- Mode switch: Weapon or Armor.
- An ore selector:
  - User can pick up to 4 different ore types.
  - User sets count for each ore type (for example via small numeric inputs).
  - Total ore count should be sum of all counts, between 3 and maybe 46.

- Optional:
  - Toggle to show details per trait.
  - Toggle to switch between Helmet, Chestplate, Leggings focus in Armor mode.

5.2 Outputs in Weapon mode

After each change:

- Show:
  - total_ore_count
  - list of selected ores, counts, share in percent.
  - total_multiplier value.
  - active traits list, with each trait name and short effect description.
- Show weapon class probabilities in a small table:
  - Class name
  - Chance percent
  - Recommended ore count range for that class.
- Show detailed weapon results:
  - For each weapon:
    - Name
    - Class
    - Base stats
    - Final stats with multiplier (damage and maybe health/applicable values).
    - Probability percent for this craft with current ore mix.

5.3 Outputs in Armor mode

- Compute total_ore_count.
- Compute weight class scores and probabilities (Light, Medium, Heavy).
- Compute final traits and multiplier like for weapons.
- For a selected slot (Helmet, Chestplate, Leggings) show for each armor piece:
  - Name
  - Weight_class
  - Base health percent
  - Final health percent with multiplier.
  - Probability percent for this craft.

5.4 Approximations

- You do not know the exact internal RNG formula from the game.
- You must:
  - Use the min_ore and optimal_ore thresholds and the scoring system defined above.
  - Use the 1/x "chance" values as relative weights inside each class.
- Document in code comments that this is an approximation based on public guides, not official dev code.

==================================================
6. UI REQUIREMENTS
==================================================

Keep the UI aligned with a modern Roblox tools website:

- Simple layout:
  - Title and short description at top.
  - Mode toggle (Weapon / Armor).
  - Ore selection panel on the left or top.
  - Results panel on the right or below.

- Make it easy to:
  - Add or remove ore types.
  - Adjust ore counts quickly.
  - Immediately see how probabilities and multipliers change.

- Use readable labels:
  - "Total Multiplier"
  - "Active Traits"
  - "Weapon Class Chances"
  - "Detailed Weapon Chances"
  - "Armor Weight Chances"
  - "Armor Pieces"

End result:

Return a complete implementation of this calculator with:
- All ore, weapon, and armor data embedded.
- The forging logic described here.
- A working interactive UI for users to plan their crafts.
