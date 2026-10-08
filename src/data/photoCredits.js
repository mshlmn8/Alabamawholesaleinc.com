// Credits for the four Wikimedia Commons photos in the catalog (AW-033,
// Cursor PR #13), as their file pages give the author and licence (checked
// 2026-10-08). The product page prints the credit under the photo, with a
// link to the file page.
// TODO(owner): Replace retailer and competitor photos, and confirm these four
// Wikimedia images should stay with this attribution. (AW-033)

export const PHOTO_CREDITS = {
  149: { text: 'Photo: Dietmar Rabich, CC BY-SA 4.0.', source: 'https://commons.wikimedia.org/wiki/File:W%C3%BCrfel_--_2021_--_4266.jpg' },
  150: { text: 'Photo: J.Dncsn, CC BY-SA 3.0.', source: 'https://commons.wikimedia.org/wiki/File:USB_cable.jpg' },
  151: { text: 'Photo: Rafasshop, CC BY-SA 4.0.', source: 'https://commons.wikimedia.org/wiki/File:Camiseta_Blanca_con_cuello_en_V.jpg' },
  334: { text: 'Photo: Beendy234, CC BY 4.0.', source: 'https://commons.wikimedia.org/wiki/File:Adhesive_bandage.jpg' },
};

// The credit line for a product's photo, or ''.
export function photoCredit(product) {
  if (!product) return '';
  return PHOTO_CREDITS[Number(product.id)]?.text || '';
}

// The photo's file page, or ''.
export function photoCreditSource(product) {
  if (!product) return '';
  return PHOTO_CREDITS[Number(product.id)]?.source || '';
}
