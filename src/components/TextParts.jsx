// A short list of values on one line, such as a card's "brand · 8 flavors ·
// SKU", that wraps between its values instead of inside them (AW-304): a
// narrow card moves "AW-GEEKBAR-25K" to the next line whole, not
// "AW-" / "GEEKBAR-25K". Each part is its own span, with its ' · ' at its
// end; .text-parts in index.css wraps the spans, and a part breaks inside
// only when it alone is wider than the line. The text reads the same as the
// values joined with ' · ' (empty values are left out). The department tile
// counts on the home page follow the same idea (AW-060).

export function TextParts({ parts }) {
  const list = parts.filter(Boolean);
  return (
    <span className="text-parts">
      {list.map((part, i) => <span key={`${i}:${part}`}>{i < list.length - 1 ? `${part} · ` : part}</span>)}
    </span>
  );
}
