// "You might also like" in the cart: hard-coded suggestions per product type
// (Shopify product type of what's in the cart). Replace the handles with any
// product handles from the store; the cart shows image, name and price from
// Shopify and skips anything sold out or already in the cart.
//
// Plus one upsell, worked out from the cart itself: a larger or higher-priced
// version (another variant) of an item in the cart.

export const RECS_BY_TYPE: Record<string, string[]> = {
  Whisky: ["ice-bag-1kg-1", "g-ginger-ale", "vinotique-snifter-wine-spirits-glass"],
  Gin: ["g-tonic", "bach-gin-glass", "ice-bag-1kg-1"],
  Vodka: ["g-tonic", "bach-ritro-fizz-glass", "ice-bag-1kg-1"],
  Rum: ["g-ginger-ale", "ice-bag-1kg-1", "mixology-5pc-set"],
  Tequila: ["ice-bag-1kg-1", "barware-cocktail-kingdom-japanese-style-jigger"],
  Mezcal: ["ice-bag-1kg-1", "barware-cocktail-kingdom-japanese-style-jigger"],
  "Cognac/Brandy": ["vinotique-snifter-wine-spirits-glass"],
  Arak: ["ice-bag-1kg-1"],
  Liqueurs: ["mixology-5pc-set", "barware-cocktail-kingdom-japanese-style-jigger"],
  Wine: [
    "crystalex-sophia-white-wine-glass",
    "airvin-micro-aereator",
    "twist-stopper-black",
    "ice-bag-1-bottle-transparent",
  ],
  Cigars: [
    "boveda-2-way-humidity-control-bag",
    "siglo-bean-shape-lighter-polish-silver",
    "les-fines-lames-knife-leather-case",
  ],
};

/** When nothing in the cart has its own list. */
export const RECS_DEFAULT: string[] = ["ice-bag-1kg-1", "steel-straw-pack-of-24"];

/** How many suggestions to show (2 to 4). */
export const RECS_MAX = 4;

/**
 * Which list a cart item uses. Cart items carry either Shopify's product type
 * ("Cigars", "Wine") or the site's category ("Mini's & Cigarillos", "Red
 * Wine"), so both are matched here.
 */
export function recsFor(productType: string): string[] {
  const direct = RECS_BY_TYPE[productType];
  if (direct) return direct;
  const t = productType.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/cigar|cigarillo|robusto|nicaragua|dominican|honduras/, "Cigars"],
    [/wine|red|white|ros|orange|champagne|prosecco|bubbly|sparkling|port|sherry/, "Wine"],
    [/whisk|bourbon|scotch|malt/, "Whisky"],
    [/gin/, "Gin"],
    [/vodka/, "Vodka"],
    [/rum/, "Rum"],
    [/tequila|mezcal|blanco|reposado|añejo|anejo/, "Tequila"],
    [/cognac|brandy|armagnac|calvados/, "Cognac/Brandy"],
    [/arak|raki/, "Arak"],
    [/liqueur|bitter|vermouth|aperitif|apéritif|digestif/, "Liqueurs"],
  ];
  for (const [re, key] of rules) if (re.test(t)) return RECS_BY_TYPE[key] ?? [];
  return [];
}
