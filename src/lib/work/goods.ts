import type { WorkTemplate } from './model';
export interface WorkGood { id: string; name: string; category: string; detail?: string; aliases?: string[] }
// Transcribed from the owner's four supplier-list screenshots. Pack quantities
// describe the supplied list, not required stock levels or reorder thresholds.
const groups: Record<string, [string, string, string?][]> = {
  Produce: [
    // Additional products from the owner’s historical buy lists.
    ["limes", "Limes"],
    ["potatoes", "Potatoes"],
    ["round-tomatoes", "Round tomatoes"],
    ["mango", "Mango"],
    ["watercress", "Watercress"],
    ["napa-cabbage", "Napa cabbage"],
    ["shiitake-mushrooms", "Shiitake mushrooms"],

    ['basil', 'Basil', '4 lbs'], ['bean-sprouts', 'Bean sprouts', '5 lb bag'], ['broccoli', 'Broccoli', 'Case'], ['carrots', 'Carrots', '25 lb bag'],
    ['celery', 'Celery', 'Bunch'], ['cherry-tomatoes', 'Cherry tomatoes', '3 small packs'], ['chinese-eggplant', 'Chinese eggplant', '½ case'], ['cilantro', 'Cilantro', 'Bunch'],
    ['green-beans', 'Green beans', '10 lbs'], ['green-bell-peppers', 'Green bell peppers', '5 lbs'], ['bok-choy', 'Shanghai bok choy', '5 lbs'], ['green-cabbage', 'Green cabbage', '4 pieces'],
    ['green-onions', 'Green onions', 'Case; iceless listed'], ['green-papaya', 'Green papaya', '4 pieces'], ['jalapenos', 'Jalapeños', '5 lbs'], ['lemongrass', 'Lemongrass', '5 lbs'],
    ['lettuce', 'Lettuce'], ['mint', 'Mint leaves', '5 bunches'], ['cucumbers', 'Cucumbers'], ['white-mushrooms', 'White mushrooms'], ['peeled-garlic', 'Peeled garlic'],
    ['red-bell-peppers', 'Red bell peppers'], ['red-onions', 'Red onions', '25 lbs'], ['yellow-onions', 'Yellow onions', '50 lbs'], ['spring-mix', 'Spring mix'], ['spinach', 'Cleaned spinach', '1 bag listed'],
  ],
  'Meat & seafood': [
    // Additional products from the owner’s historical buy lists.
    ["ribeye", "Ribeye"],
    ["trout", "Trout"],
    ["frozen-chicken-wing-mid-joints-size-10-11", "Frozen chicken wing mid-joints, size 10–11"],
    ["calamari-tentacles-size-5-8", "Calamari tentacles, size 5–8"],
    ["cuttlefish", "Cuttlefish", "Sizes 13–20 / 21–30 listed; confirm size when ordering"],

    ['basa-fillets', 'Basa fish fillets'], ['beef-tritip', 'Beef tri-tip', 'Peeled / sliced'], ['calamari', 'Calamari / squid tubes', 'U5'],
    ['chicken-breast-fresh', 'Fresh chicken breast', 'Skinless breast also listed'], ['chicken-breast-frozen', 'Frozen chicken breast'], ['chicken-thighs', 'Chicken thighs', 'Boneless / skinless; BBQ'],
    ['crab-meat', 'Crab meat', '5 lbs; 2 boxes listed'], ['lamb', 'Boneless lamb leg'], ['mussels', 'Large mussels', 'Case'], ['pork-loin', 'Boneless pork loin'],
    ['roast-duck', 'Roast duck', '1 case'], ['salmon', 'Salmon fillets', 'No skin'], ['scallops', 'Frozen scallops', '40–60 IQF; 2 boxes listed'],
    ['shrimp', 'Raw shrimp', 'P&D 16/20; tail-on listed'], ['pork-ribs', 'Baby back pork ribs'], ['beef-eye-round', 'Beef eye round', 'Select / choice; case or loose, >56 lbs listed'],
    ['beef-knuckle', 'Beef knuckle', 'For massaman'], ['chicken-wings', 'Frozen spicy breaded chicken wings', 'Cooked; BIG C brand'], ['snow-crab', 'Snow crab meat', '5 lb box'],
    ['sole-mekong-basa', 'Sole / Mekong basa fillets', 'Size #8–10; verify supplier label'],
  ],
  'Rice, noodles & frozen': [
    // Additional products from the owner’s historical buy lists.
    ["fish-cake", "Fish cake"],
    ["frozen-spinach", "Frozen spinach"],
    ["frozen-peas-and-carrots", "Frozen peas and carrots"],

    ['chow-fun', 'Rice Noodle (Chow Fun)', '5 lbs/PC; for pad see ew'], ['chow-mein', 'Chow Mein Noodle (Yellow)', 'Box'], ['brown-rice', 'Brown rice'],
    ['bun-thap-chua', 'Bun Thap Chua dry noodles', 'For egg-roll filling'], ['rice-paper', 'Round rice paper'], ['roti', 'Frozen roti'], ['sticky-rice', 'Sweet sticky rice', '50 lbs'],
    ['white-rice', 'Long Grain Rice (White)', '50 lbs'], ['woonsen', 'Bean Thread (Woonsen / Glass Noodles)'], ['pho-noodles', 'Pho (Fresh Pho / Pad Thai Noodles)', '10 lbs/PC'],
    ['eggroll-wrappers', 'Spring Roll Wrappers (Egg-Roll Wrappers)', 'Wei Chuen brand'], ['eggroll-veggie', 'Vegetable Egg Rolls'], ['eggroll-pork', 'Pork egg rolls'], ['potstickers', 'Pork Potsticker', 'Wei Chuen brand'],
    ['crab-rangoon', 'Crab Rangoon (Frozen)'],
  ],
  'Sauces & pantry': [
    // Additional products from the owner’s historical buy lists.
    ["lemon-juice", "Lemon juice"],
    ["tom-yum-paste-thai-boy", "Tom yum paste — Thai Boy"],

    ['bamboo', 'Canned Bamboo Shoot Strips'], ['black-soy', 'Black soy sauce', 'DSB brand'], ['cashews', 'Cashew Nut', '5 lbs/pc'], ['coconut-milk', 'Coconut milk', 'Mae Ploy'],
    ['curry-powder', 'Curry powder', 'For satay'], ['fish-sauce', 'Fish sauce', 'Lucky brand'], ['galangal', 'Frozen galangal'], ['green-curry', 'Green curry paste', 'Mae Sri'],
    ['seasoning-sauce', 'Seasoning sauce', 'Maggie / GMT as listed'], ['panang-curry', 'Panang curry paste', 'Mae; full brand not shown'], ['peanuts', 'Peanut', '5 lbs/pc; 30 lbs/case'], ['paprika', 'Paprika Powder'],
    ['pineapple', 'Canned Pineapple Chunks'], ['red-curry', 'Red curry paste', 'Mae Ploy'], ['sriracha', 'Sriracha', 'Shark brand'], ['palm-sugar', 'Palm sugar'], ['water-chestnuts', 'Canned Water Chestnuts Slices'],
    ['tamarind', 'Wet tamarind'], ['white-vinegar', 'White Vinegar'], ['yellow-curry', 'Yellow curry paste', 'Mae; full brand not shown'], ['black-pepper', 'Black Pepper Powder', '5 lb bag'],
    ['cooking-oil', 'Vegetable Oil (Cooking Oil)'], ['hoisin', 'Hoisin Sauce', 'Koon Chun brand'], ['oyster-panda', 'Oyster Sauce — Panda'], ['oyster-kum-chun', 'Oyster Sauce — Kum Chun'],
    ['soy-kikkoman', 'Soy Sauce', 'Kikkoman; 5 gallons'], ['sugar', 'White Granulated Sugar', '50 lbs'], ['lime-juice', 'Lime juice'], ['sambal', 'Red chili sambal oelek'], ['bread-crumbs', 'Japanese Style Panko Bread Crumbs', '20 lb bag'],
    ['tempura-batter', 'Tempura Batter Mix'], ['corn-starch', 'Corn Starch'], ['baking-soda', 'Baking Soda', '13.5 lbs/pc; 4 pc/case'],
    ['salt', 'Salt (Table Salt)'], ['turmeric', 'Dried Turmeric Powder'], ['potassium-solution', 'Potassium Solution (Lye Water / Kansui)'],
    ['clear-fry-oil', 'Clear Fry Oil (Frying Oil)'], ['creamy-shortening', 'Creamy Shortening (Frying Shortening)'],
  ],
  'Drinks, eggs & dairy': [
    // Additional products from the owner’s historical buy lists.
    ['extra-firm-tofu', 'Firm Tofu'],
    ['soft-tofu', 'Soft Tofu (Silken)'],
    ["condensed-milk", "Condensed milk"],
    ["sake", "Sake"],
    ["kj-sauvignon", "KJ Sauvignon", "KJ as listed; confirm exact label when ordering"],

    ['eggs-medium', 'Egg — Medium', 'Large if medium unavailable'], ['eggs-xl', 'Egg — Extra Large', 'Loose'], ['young-coconut', 'Fresh young coconuts', '9 pieces / case'],
    ['singha-large', 'Singha — large bottles'], ['singha-small', 'Singha — small bottles'], ['half-and-half', 'Half & half'], ['heavy-cream', 'Heavy cream'],
  ],
  'Packaging & supplies': [
    // Additional products from the owner’s historical buy lists.
    ["portion-cups-0-75-oz", "Portion cups, 0.75 oz"],
    ['black-round-containers-32-oz', 'Black Round Container', '32 oz'],
    ['black-round-containers-48-oz', 'Black Round Container', '48 oz'],
    ["straws", "Straws"],
    ["three-compartment-containers-9-2", "Three-compartment containers, 9×2"],
    ["gloves-large", "Gloves — Large"],
    ["gloves-small", "Gloves — Small"],
    ["plastic-spoons", "Plastic spoons"],
    ["paper-plates", "Paper plates"],
    ["fork-and-spoon-sets", "Fork-and-spoon sets"],
    ['disposable-plastic-t-shirt-bags', 'Disposable Plastic T-Shirt Bag'],
    ["paper-bags-25", "Paper bags #25"],
    ['thermal-receipt-paper', 'Thermal Receipt Paper'],

    ['plastic-6x6', 'Plastic Clear Container — One Compartment', '6×6, small'], ['plastic-8x2', 'Plastic Clear Container — One Compartment', '8×2, for satay'],
    ['togo-16', 'Microveable Food Pail — Small Rice Box (#16)', '16 oz'], ['togo-32', 'Microveable Food Pail — Large Rice Box (#32)', '32 oz'], ['black-7in', 'Black Round Container', '7 inch'],
    ['soup-8oz', 'Plastic Soup Cup + Lid', '8 oz'], ['soup-16oz', 'Plastic Soup Cup + Lid', '16 oz'], ['soup-32oz', 'Plastic Soup Cup + Lid', '32 oz'], ['soup-24oz', 'Plastic Soup Cup + Lid', '24 oz'],
    ['black-24oz', 'Black Round Container', 'Size 24, for pad Thai; unit not shown'], ['black-16oz', 'Black Round Container', '16 oz, for mango sticky rice'], ['chopsticks', 'Wooden Chopsticks'],
    ['produce-bags', 'LDPE Produce Bag', '11×19; 4 rolls / case'], ['foil-pad-thai', 'Round foil containers + plastic lids', 'For pad Thai'],
    ['paper-handled', 'Handle Paper Bag', '#1/8'], ['paper-20', 'Paper Bag', '#20'], ['paper-8', 'Paper Bag', '#735 (#1/#8)'], ['paper-12', 'Paper Bag', '#12'], ['reusable-bags', 'Reusable T-shirt bags'],
    ['drink-lids', 'Lids for To-Go Drinking Cups', '16 oz'], ['napkins', 'Dine-In Napkin', 'Tri-fold'], ['drink-cups', 'To-Go Drinking Cups', '16 oz / 18 oz'],
    ['eco-container-1', 'Eco-Friendly Container — One Compartment', 'Corn-based'], ['bamboo-skewers', 'Bamboo Skewer', '1000 pieces/pc'],
    ['paper-towels', 'Hand Paper Towel'], ['sterno', 'Sterno (Chafing Fuel)'],
  ],
};
// Kitchen nicknames heard during voice stock checks. Staff can add more per item in Edit item.
const spokenAliases: Record<string, string[]> = {
  'green-onions': ['scallions', 'scallion'], cilantro: ['coriander'], 'chow-fun': ['ho fun', 'wide noodle', 'wide noodles'],
  'pho-noodles': ['pad thai noodle', 'pad thai noodles', 'small rice noodle'], woonsen: ['glass noodle', 'silver noodle'],
  'bean-sprouts': ['sprouts'], 'eggroll-veggie': ['veggie egg rolls', 'veggie egg roll'], 'cooking-oil': ['vegetable oil', 'oil'], 'clear-fry-oil': ['clear fry oil', 'clear fry', 'fry oil', 'fryer oil'], 'paper-towels': ['towel', 'towels', 'paper towel'], 'soft-tofu': ['silken tofu'],
  'togo-16': ['small pail', 'small rice box'], 'togo-32': ['large pail', 'large rice box', 'big pail'],
};
export const workGoods: WorkGood[] = Object.entries(groups).flatMap(([category, items]) => items.map(([id, name, detail]) => ({ id, name, category, ...(detail ? { detail } : {}), ...(spokenAliases[id] ? { aliases: spokenAliases[id] } : {}) })));
export function goodsTemplates(): WorkTemplate[] {
  return workGoods.map(good => ({ id: `boh-goods-${good.id}`, title: `Check ${good.name}`, category: good.category, ...(good.detail ? { detail: good.detail } : {}), station: 'Back of house', shift: 'both', checkpoint: 'opening', offset: 0, assignee: '', enabled: true }));
}
