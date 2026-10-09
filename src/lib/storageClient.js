// Supabase Storage for the few places that use it (AW-179): application
// documents (src/lib/documents.js) and Admin's photo uploads. The site's
// client (src/lib/supabase.js) downloads Storage's code the first time it
// is needed, so storefront visitors never do.
//
//   storageOf(client)       resolves to the client's Storage (supabase.storage
//                           once loaded); a client that has it already (a
//                           test's fake, or supabase-js) is used as it is
//   preloadStorage(client)  starts that download early, quietly: a page with
//                           an upload or a document link calls it when it
//                           opens, so the first click doesn't wait for it

export function storageOf(client) {
  if (client?.storage) return Promise.resolve(client.storage);
  if (typeof client?.loadStorage === 'function') return client.loadStorage();
  return Promise.reject(new Error('File storage isn’t available.'));
}

export function preloadStorage(client) {
  if (client?.storage || typeof client?.loadStorage !== 'function') return;
  client.loadStorage().catch(() => {
    // Tried again when the file is used.
  });
}
