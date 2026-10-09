// Credits for the four Wikimedia Commons photos in the catalog (AW-033,
// Cursor PR #13), as their file pages give the author and licence (checked
// 2026-10-08; also recorded in ../assets/products/sources/merchandise.md).
// Their licences ask for the author, the licence named with a link to it,
// and a note of any change. The build changes each photo
// (scripts/build-images.mjs: a white margin to the tile's shape, then
// smaller sizes, re-encoded), so every credit says "resized". The product
// page prints the credit under the photo and in the enlarged view, with
// links to the licence and to the file page.
// TODO(owner): Replace retailer and competitor photos, and confirm these four
// Wikimedia images should stay with this attribution. (AW-033)

// The licence deed each credit links to.
export const LICENCE_URLS = Object.freeze({
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
});

// By product id: { author, licence, licenceUrl, source (the file page) }.
export const PHOTO_CREDITS = Object.freeze({
  149: Object.freeze({ author: 'Dietmar Rabich', licence: 'CC BY-SA 4.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', source: 'https://commons.wikimedia.org/wiki/File:W%C3%BCrfel_--_2021_--_4266.jpg' }),
  150: Object.freeze({ author: 'J.Dncsn', licence: 'CC BY-SA 3.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', source: 'https://commons.wikimedia.org/wiki/File:USB_cable.jpg' }),
  151: Object.freeze({ author: 'Rafasshop', licence: 'CC BY-SA 4.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', source: 'https://commons.wikimedia.org/wiki/File:Camiseta_Blanca_con_cuello_en_V.jpg' }),
  334: Object.freeze({ author: 'Beendy234', licence: 'CC BY 4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/', source: 'https://commons.wikimedia.org/wiki/File:Adhesive_bandage.jpg' }),
});

// The credit of a product's photo, or null.
export function photoCredit(product) {
  if (!product) return null;
  return PHOTO_CREDITS[Number(product.id)] || null;
}

// The credit as one line of text: 'Photo: Dietmar Rabich, CC BY-SA 4.0,
// resized.', or '' without one.
export function photoCreditText(credit) {
  if (!credit) return '';
  return `Photo: ${credit.author}, ${credit.licence}, resized.`;
}
