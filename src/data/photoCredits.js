// Credits required for the four Wikimedia photos already in the catalog.
// TODO(owner): Replace retailer and competitor photos, and confirm these four
// Wikimedia images should stay with this attribution. (AW-033)

export const PHOTO_CREDITS = {
  149: 'Photo: Dietmar Rabich, CC BY-SA 4.0.',
  150: 'Photo: J.Dncsn, CC BY-SA 3.0.',
  151: 'Photo: Rafasshop, CC BY-SA 4.0.',
  334: 'Photo: Beendy234, CC BY 4.0.',
};

export function photoCredit(product) {
  if (!product) return '';
  return PHOTO_CREDITS[Number(product.id)] || '';
}
