// Safety net for pages translated by Google Translate or changed by browser
// extensions (AW-039). They replace text nodes React owns, and React's next
// removeChild/insertBefore on such a node throws NotFoundError, which unmounts
// the whole app. The aw/translate-safe-text lint rule keeps our markup out of
// that pattern; these guards make any spot it misses degrade to slightly stale
// text instead of a white page. (The widely used guard from facebook/react#11538.)

let installed = false;

export function installDomGuards(NodeClass = typeof Node === 'function' ? Node : null) {
  if (installed || !NodeClass?.prototype) return;
  installed = true;
  const proto = NodeClass.prototype;
  const { removeChild, insertBefore } = proto;

  // Removing a node that something else already moved away: nothing to do.
  proto.removeChild = function guardedRemoveChild(child, ...rest) {
    if (child && child.parentNode !== this) return child;
    return removeChild.call(this, child, ...rest);
  };

  // The reference node was moved away: append instead, so the new content
  // still shows and later React updates can find it in this parent.
  proto.insertBefore = function guardedInsertBefore(node, ref, ...rest) {
    if (ref && ref.parentNode !== this) return insertBefore.call(this, node, null);
    return insertBefore.call(this, node, ref, ...rest);
  };
}
