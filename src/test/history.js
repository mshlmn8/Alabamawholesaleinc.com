// Waiting for history traversals in jsdom, without a clock.
//
// jsdom runs history.back(), forward() and go() as queued tasks: two
// setImmediate hops, then the popstate. The router can answer a popstate with
// a traversal of its own (a closed dialog's entry is skipped, NEW-028), and a
// dialog that closes takes its entry back with history.back() (AW-065). A
// test that sleeps a fixed number of milliseconds for these races a busy
// machine: the sleep's timer can fire between the two hops, and the
// traversal then lands after the assertion, or in the next test.

// Resolves once `count` popstate events have fired on window. The router's
// listener was added first, so it has handled the last one by then. Rejects
// after `timeout` ms, so a popstate that never comes fails the test with a
// reason instead of hanging it. Call it before the traversal starts.
export function popstates(count = 1, { timeout = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    let seen = 0;
    const done = () => {
      window.removeEventListener('popstate', onPop);
      clearTimeout(timer);
    };
    const onPop = () => {
      seen += 1;
      if (seen < count) return;
      done();
      resolve();
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error(`Expected ${count} popstate event${count === 1 ? '' : 's'}, saw ${seen} in ${timeout}ms`));
    }, timeout);
    window.addEventListener('popstate', onPop);
  });
}

// Lets every traversal already queued land, and those they queue in turn (up
// to `rounds` hops, three chained traversals by default), whatever the clock
// says: each hop is a setImmediate queued behind jsdom's own. Promise
// callbacks run between hops too. Safe when nothing is queued.
export async function flushHistory(rounds = 6) {
  for (let i = 0; i < rounds; i += 1) {
    await new Promise((resolve) => { setImmediate(resolve); });
  }
}
