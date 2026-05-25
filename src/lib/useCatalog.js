// Loads live products from Supabase, falls back to static data when the
// backend isn't reachable or configured. Static data also serves as the
// initial render so first paint isn't blocked on the network.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { PRODUCTS as STATIC_PRODUCTS } from '../data/products.js';

// productImages is the same glob used by static products — reuse it so admin-
// uploaded images and seed images resolve identically.
const productImages = import.meta.glob(
  '../assets/products/*.{webp,jpg,jpeg,png,avif}',
  { eager: true, query: '?url', import: 'default' }
);
const resolveImg = (filename) => {
  if (!filename) return null;
  if (filename.startsWith('http')) return filename;  // remote URL (e.g. Supabase Storage)
  return productImages[`../assets/products/${filename}`] || null;
};

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
        const hydrated = data.map(p => ({
          ...p,
          variants: Array.isArray(p.variants) ? p.variants : [],
          img: resolveImg(p.img),
        }));
        setProducts(hydrated);
        setSource('live');
      });
    return () => { cancelled = true; };
  }, []);

  return { products, source };
}
