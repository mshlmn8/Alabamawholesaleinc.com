// A short list of values on one line, such as a card's "brand · 8 flavors ·
// SKU", that wraps between its values instead of inside them (AW-304): a
// narrow card moves "AW-GEEKBAR-25K" to the next line whole, not
// "AW-" / "GEEKBAR-25K". Each part is its own span, with its separator at its
// end; .text-parts in index.css wraps the spans, and a part breaks inside
// only when it alone is wider than the line. The text reads the same as the
// values joined with ' · ' (empty values are left out). The department tile
// counts on the home page follow the same idea (AW-060).
//
// The separator is a no-break space, the dot and a space (NEW-082): the dot
// stays with the last word of its part ("Cigars & Cigarillos ·"), and a line
// breaks after it, never leaving a dot alone at the start of a line.
//
// `code` names the part that is a product code (the SKU, AW-304): a code
// never breaks at its hyphens. One longer than the line, as some 22-29
// character SKUs are on a phone's card, ends in an ellipsis instead
// (.sku-part in index.css); the whole code stays in the text, so screen
// readers and copying get all of it, and in its title.

export const PART_SEPARATOR = '\u00a0· ';

// The values as one string, as TextParts reads.
export const joinParts = (parts) => parts.filter(Boolean).join(PART_SEPARATOR);

export function TextParts({ parts, code = null }) {
  const list = parts.filter(Boolean);
  return (
    <span className="text-parts">
      {list.map((part, i) => {
        const text = i < list.length - 1 ? `${part}${PART_SEPARATOR}` : part;
        const isCode = code != null && part === code;
        return <span key={`${i}:${part}`} className={isCode ? 'sku-part' : undefined} title={isCode ? part : undefined}>{text}</span>;
      })}
    </span>
  );
}
