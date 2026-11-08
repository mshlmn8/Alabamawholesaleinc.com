// Credits for the Wikimedia Commons photos whose licences ask for them
// (AW-033). The four merchandise photos were checked 2026-10-08 and are
// recorded in ../assets/products/sources/merchandise.md. The Coca-Cola can
// (#248) was added 2026-11-07 and is recorded in drinks-bags.md. Each
// licence asks for the author, the licence named with a link to it, and a
// note of any change. The build changes each photo
// (scripts/build-images.mjs: a white margin to the tile's shape, then
// smaller sizes, re-encoded), so every credit says "resized". The product
// page prints the credit under the photo and in the enlarged view, with
// links to the licence and to the file page.
// Public-domain and CC0 photos (#205 Pepsi, #270 Monster Energy) are
// recorded in drinks-bags.md and are not credited here: those dedications
// do not ask for attribution.

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
  248: Object.freeze({ author: 'M0tty', licence: 'CC BY-SA 3.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', source: 'https://commons.wikimedia.org/wiki/File:Coca-cola_50cl_can_-_Italia.jpg' }),
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
