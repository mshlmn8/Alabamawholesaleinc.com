// Loads live products from Supabase, falls back to static data when the
// backend isn't reachable or configured. Static data also serves as the
// initial render so first paint isn't blocked on the network.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { productImage } from './images.js';
import { PRODUCTS as STATIC_PRODUCTS } from '../data/products.js';

const STATIC_BY_ID = new Map(STATIC_PRODUCTS.map((p) => [Number(p.id), p]));

export function useCatalog() {
  const [products, setProducts] = useState(STATIC_PRODUCTS);
  const [source, setSource] = useState('static');

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.from('products').select('*').eq('active', true)
      .order('id', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled || error || !data?.length) return;
        const hydrated = data.map(p => {
          // The products table has no description or sell-unit columns yet, so
          // the static catalog's copy fills them in for matching ids.
          const local = STATIC_BY_ID.get(Number(p.id));
          return {
            ...p,
            variants: Array.isArray(p.variants) ? p.variants : [],
            description: p.description || local?.description || '',
            sellUnit: p.sell_unit || p.sellUnit || local?.sellUnit || '',
            // img is a filename in src/assets/products, or a full URL (e.g. Supabase Storage)
            ...productImage(p.img),
          };
        });
        setProducts(hydrated);
        setSource('live');
      });
    return () => { cancelled = true; };
  }, []);

  return { products, source };
}
