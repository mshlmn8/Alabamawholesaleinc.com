// Display formatting shared by the storefront, account, admin and support
// pages, so every page shows money and labels the same way (AW-184, AW-330).

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
// Both digit limits are set: older Safari throws when only the maximum is
// lower than the currency's default minimum.
const USD_WHOLE = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Prices, line totals and order totals: $1,807.66.
export const formatMoney = (n) => USD.format(Number(n));

// Round amounts in marketing and policy copy: $1,500.
export const formatMoneyShort = (n) => USD_WHOLE.format(Number(n));

// Department keys are the catalog's upper-case `cat` values.
// TODO(owner): One name for the Novelties department (Exotics, Novelties & Vapes, or Novelties), and approval of any department renames; names are unchanged until then. (AW-217, AW-134)
const CAT_LABEL = {
  'TOBACCO': 'Tobacco', 'NOVELTIES': 'Novelties & Vapes', 'MERCHANDISE': 'Merchandise',
  'CANDIES': 'Candies', 'DRINKS & BAGS': 'Drinks & Bags', 'FOOD STUFF': 'Food Stuff',
  'GROCERY': 'Grocery', 'MOTOR OIL': 'Motor Oil'
};
export const catLabel = (c) => CAT_LABEL[c] || c;

// A catalog count, in the site's one word for it (AW-217, NEW-056):
// '68 products', '1 product', on the department and line pages, /catalog,
// the menus and the home tiles. `shown` prints the number another way, such
// as a department page's zero-padded '02'. 'SKU' is kept for lists of codes.
export const productCount = (n, shown = String(n)) => `${shown} ${Number(n) === 1 ? 'product' : 'products'}`;

// A product line named like its department (Motor Oil's 'Motor Oil' line,
// NEW-029), ignoring case: its title, trail and eyebrow name the department
// once. Renaming the line is the owner's call (AW-134).
export const sharesDepartmentName = (category, sub) => !!sub && String(sub).trim().toLowerCase() === catLabel(category).trim().toLowerCase();

// The brand as printed on cards and product pages: '' for the catalog's
// placeholder brand "Assorted", which names no brand (AW-286). Search still
// matches the stored brand.
export const PLACEHOLDER_BRANDS = ['Assorted'];
export const brandLabel = (brand) => {
  const text = String(brand ?? '').trim();
  return PLACEHOLDER_BRANDS.includes(text) ? '' : text;
};

// A photo file more than one row uses (sharedPhoto, AW-136) shows a sibling of
// another size, pack or format, so it is labelled from the row's own data:
// the badge on the photo says the row's sell unit, or else the size or format
// word its name already has; a product page with neither says the photo shows
// a related pack or size; and the alt text calls the photo representative.
// Nothing is claimed that the row doesn't say (TODO(owner) AW-136: a photo of
// each row).
export const SHARED_PHOTO_NOTE = 'Photo shows a related pack or size.';

// The size or format word in a product name, as the name writes it, or '':
// small, big, large, king size, cups, packs or singles, a strength in mg
// ("6mg"), a count in thousands ("65K", never the brand "4K's"), or a puff
// count of three to five digits at the end of the name ("Kangvape 8000",
// never "250 g"). The first one in the name wins.
const SIZE_WORD = /(^|[\s(,])(king size|small|big|large|cups|packs|singles|\d+(?:\.\d+)?\s?mg|\d+(?:\.\d+)?k|\d{3,5}(?=\s*(?:$|[),])))(?=$|[\s),.])/i;
export function photoSizeWord(name) {
  const match = SIZE_WORD.exec(String(name ?? ''));
  return match ? match[2] : '';
}

// What a shared photo's badge says: the sell unit, else the name's size word.
export const sharedPhotoBadge = (product) => String(product?.sellUnit ?? '').trim() || photoSizeWord(product?.name);

// The photo's alt text: the product's name, marked representative when the
// photo is shared with a sibling (AW-136).
export const photoAlt = (product) => (product?.sharedPhoto ? `${product.name} (representative photo)` : String(product?.name ?? ''));
