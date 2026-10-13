// The count beside the header's Admin link (AW-111): orders placed since
// this admin last opened Admin -> Orders. The number is for the eye; screen
// readers hear '(2 new orders)' after the link text. Nothing when 0.

export function AdminUnseenBadge({ count = 0 }) {
  if (!(count > 0)) return null;
  return (
    <>
      <span className="admin-unseen" aria-hidden="true">{count > 99 ? '99+' : String(count)}</span>
      <span className="sr-only">{` (${count} new ${count === 1 ? 'order' : 'orders'})`}</span>
    </>
  );
}
