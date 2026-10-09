// One empty state (AW-299) for the empty cart drawer, the empty checkout
// page, an empty order history and a department page with no matches: a
// heading, a line that says why, and what to do next, centred, with the same
// padding and spacing everywhere (.empty-state in index.css).
//
// level is the heading level, so the heading fits the page's outline: 1 as
// the checkout page's own heading, 2 for a page section, 3 inside a section
// or a dialog that has its own h2. children is the line of text. actions are
// the buttons and links (a list of links can go there too); they wrap and
// stay centred. className adds a modifier, such as 'is-boxed' for the framed
// box used where a list would be. notice goes right under the heading, the
// next thing after it in the tab order (the checkout page's Undo after
// "Clear all items", AW-082).

export function EmptyState({ title, level = 2, children, actions, className, notice = null }) {
  const Heading = `h${level}`;
  return (
    <div className={className ? `empty-state ${className}` : 'empty-state'}>
      <Heading className="empty-state-title">{title}</Heading>
      {notice && <div className="empty-state-notice">{notice}</div>}
      {children && <p className="empty-state-text">{children}</p>}
      {actions && <div className="empty-state-actions">{actions}</div>}
    </div>
  );
}
