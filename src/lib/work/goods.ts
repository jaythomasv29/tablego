import type { WorkTemplate } from './model';
export interface WorkGood { id: string; name: string; category: string; detail?: string }
// Transcribed from the owner's four supplier-list screenshots. Pack quantities
// describe the supplied list, not required stock levels or reorder thresholds.
const groups: Record<string, [string, string, string?][]> = {
  Produce: [
    ['basil', 'Basil', '4 lbs'], ['bean-sprouts', 'Bean sprouts', '5 lb bag'], ['broccoli', 'Broccoli', 'Case'], ['carrots', 'Carrots', '25 lb bag'],
    ['celery', 'Celery', 'Bunch'], ['cherry-tomatoes', 'Cherry tomatoes', '3 small packs'], ['chinese-eggplant', 'Chinese eggplant', '½ case'], ['cilantro', 'Cilantro', 'Bunch'],
    ['green-beans', 'Green beans', '10 lbs'], ['green-bell-peppers', 'Green bell peppers', '5 lbs'], ['bok-choy', 'Shanghai bok choy', '5 lbs'], ['green-cabbage', 'Green cabbage', '4 pieces'],
    ['green-onions', 'Green onions', 'Case; iceless listed'], ['green-papaya', 'Green papaya', '4 pieces'], ['jalapenos', 'Jalapeños', '5 lbs'], ['lemongrass', 'Lemongrass', '5 lbs'],
    ['lettuce', 'Lettuce'], ['mint', 'Mint leaves', '5 bunches'], ['cucumbers', 'Cucumbers'], ['white-mushrooms', 'White mushrooms'], ['peeled-garlic', 'Peeled garlic'],
    ['red-bell-peppers', 'Red bell peppers'], ['red-onions', 'Red onions', '25 lbs'], ['yellow-onions', 'Yellow onions', '50 lbs'], ['spring-mix', 'Spring mix'], ['spinach', 'Cleaned spinach', '1 bag listed'],
  ],
  'Meat & seafood': [
    ['basa-fillets', 'Basa fish fillets'], ['beef-tritip', 'Beef tri-tip', 'Peeled / sliced'], ['calamari', 'Calamari / squid tubes', 'U5'],
    ['chicken-breast-fresh', 'Fresh chicken breast', 'Skinless breast also listed'], ['chicken-breast-frozen', 'Frozen chicken breast'], ['chicken-thighs', 'Chicken thighs', 'Boneless / skinless; BBQ'],
    ['crab-meat', 'Crab meat', '5 lbs; 2 boxes listed'], ['lamb', 'Boneless lamb leg'], ['mussels', 'Large mussels', 'Case'], ['pork-loin', 'Boneless pork loin'],
    ['roast-duck', 'Roast duck', '1 case'], ['salmon', 'Salmon fillets', 'No skin'], ['scallops', 'Frozen scallops', '40–60 IQF; 2 boxes listed'],
    ['shrimp', 'Raw shrimp', 'P&D 16/20; tail-on listed'], ['pork-ribs', 'Baby back pork ribs'], ['beef-eye-round', 'Beef eye round', 'Select / choice; case or loose, >56 lbs listed'],
    ['beef-knuckle', 'Beef knuckle', 'For massaman'], ['chicken-wings', 'Frozen spicy breaded chicken wings', 'Cooked; BIG C brand'], ['snow-crab', 'Snow crab meat', '5 lb box'],
    ['sole-mekong-basa', 'Sole / Mekong basa fillets', 'Size #8–10; verify supplier label'],
  ],
  'Rice, noodles & frozen': [
    ['chow-fun', 'Chow fun noodles', 'For pad see ew'], ['chow-mein', 'Yellow chow mein noodles', 'Box'], ['brown-rice', 'Brown rice'],
    ['bun-thap-chua', 'Bun Thap Chua dry noodles', 'For egg-roll filling'], ['rice-paper', 'Round rice paper'], ['roti', 'Frozen roti'], ['sticky-rice', 'Sweet sticky rice', '50 lbs'],
    ['white-rice', 'White rice', '50 lbs'], ['woonsen', 'Woonsen / glass noodles'], ['pho-noodles', 'Fresh pho / pad Thai noodles', '4 bags listed'],
    ['eggroll-wrappers', 'Egg-roll wrappers', 'Wei Chuen brand'], ['eggroll-veggie', 'Vegetable egg rolls'], ['eggroll-pork', 'Pork egg rolls'], ['potstickers', 'Pork pot stickers', 'Wei Chuen brand'],
  ],
  'Sauces & pantry': [
    ['bamboo', 'Bamboo strips'], ['black-soy', 'Black soy sauce', 'DSB brand'], ['cashews', 'Cashews', '5 lb bag'], ['coconut-milk', 'Coconut milk', 'Mae Ploy'],
    ['curry-powder', 'Curry powder', 'For satay'], ['fish-sauce', 'Fish sauce', 'Lucky brand'], ['galangal', 'Frozen galangal'], ['green-curry', 'Green curry paste', 'Mae Sri'],
    ['seasoning-sauce', 'Seasoning sauce', 'Maggie / GMT as listed'], ['panang-curry', 'Panang curry paste', 'Mae; full brand not shown'], ['peanuts', 'Peanuts'], ['paprika', 'Paprika powder'],
    ['pineapple', 'Pineapple chunks'], ['red-curry', 'Red curry paste', 'Mae Ploy'], ['sriracha', 'Sriracha', 'Shark brand'], ['palm-sugar', 'Palm sugar'], ['water-chestnuts', 'Water chestnuts'],
    ['tamarind', 'Wet tamarind'], ['white-vinegar', 'White vinegar'], ['yellow-curry', 'Yellow curry paste', 'Mae; full brand not shown'], ['black-pepper', 'Black pepper powder', '5 lb bag'],
    ['cooking-oil', 'Cooking oil'], ['hoisin', 'Hoisin sauce', 'Koon Chun brand'], ['oyster-panda', 'Oyster sauce — Panda'], ['oyster-kum-chun', 'Oyster sauce — Kum Chun'],
    ['soy-kikkoman', 'Soy sauce', 'Kikkoman; 5 gallons'], ['sugar', 'Sugar', '50 lbs'], ['lime-juice', 'Lime juice'], ['sambal', 'Red chili sambal oelek'], ['bread-crumbs', 'Bread crumbs', '20 lb bag'],
  ],
  'Drinks, eggs & dairy': [
    ['eggs-medium', 'Eggs — medium', 'Large if medium unavailable'], ['eggs-xl', 'Eggs — extra large', 'Loose'], ['young-coconut', 'Fresh young coconuts', '9 pieces / case'],
    ['singha-large', 'Singha — large bottles'], ['singha-small', 'Singha — small bottles'], ['half-and-half', 'Half & half'], ['heavy-cream', 'Heavy cream'],
  ],
  'Packaging & supplies': [
    ['plastic-6x6', 'One-compartment plastic containers', '6×6, small'], ['plastic-8x2', 'One-compartment plastic containers', '8×2, for satay'],
    ['togo-16', 'To-go boxes #16', 'Small rice box'], ['togo-32', 'To-go boxes #32', 'Large rice box'], ['black-7in', 'Black round containers', '7 inch'],
    ['soup-8oz', 'Plastic soup cups', '8 oz'], ['soup-16oz', 'Plastic soup cups', '16 oz'], ['soup-32oz', 'Plastic soup cups', '32 oz'],
    ['black-24oz', 'Black round containers', 'Size 24, for pad Thai; unit not shown'], ['black-16oz', 'Black round containers', '16 oz, for mango sticky rice'], ['chopsticks', 'Wooden chopsticks'],
    ['produce-bags', 'LDPE produce bags', 'Low density; 4 rolls / case'], ['foil-pad-thai', 'Round foil containers + plastic lids', 'For pad Thai'],
    ['paper-handled', 'Paper bags with handles'], ['paper-20', 'Paper bags #20'], ['paper-8', 'Paper bags #8'], ['reusable-bags', 'Reusable T-shirt bags'],
    ['drink-lids', 'To-go drink lids'], ['napkins', 'Dinner napkins', 'Tri-fold'], ['drink-cups', 'To-go drink cups', '16 oz'],
  ],
};
export const workGoods: WorkGood[] = Object.entries(groups).flatMap(([category, items]) => items.map(([id, name, detail]) => ({ id, name, category, ...(detail ? { detail } : {}) })));
export function goodsTemplates(): WorkTemplate[] {
  return workGoods.map(good => ({ id: `boh-goods-${good.id}`, title: `Check ${good.name}`, category: good.category, ...(good.detail ? { detail: good.detail } : {}), station: 'Back of house', shift: 'both', checkpoint: 'opening', offset: 0, assignee: '', enabled: true }));
}
