// A product count in an upper-case eyebrow: 'DEPARTMENT · 68 SKUs' (AW-284).
// The eyebrow's text-transform would print 'SKUS', so the word keeps its own
// case (.keep-case); the changing text sits in a span of its own, so Google
// Translate can't break it (aw/translate-safe-text).

export function SkuCount({ lead = '', count }) {
  return <><span>{`${lead}${count} `}</span><span className="keep-case">SKUs</span></>;
}
