import { db } from './db.js';

const OFF_BASE = process.env.OPENFOODFACTS_BASE_URL || 'https://world.openfoodfacts.net';

export async function getProductByBarcode(barcode) {
  const local = db.prepare('SELECT * FROM products WHERE barcode = ? ORDER BY id DESC LIMIT 1').get(barcode);
  if (local) return local;

  const resp = await fetch(`${OFF_BASE}/api/v2/product/${encodeURIComponent(barcode)}`);
  if (!resp.ok) return null;
  const payload = await resp.json();
  const p = payload?.product;
  if (!p) return null;

  const product = {
    barcode,
    name: p.product_name || p.product_name_en || `Product ${barcode}`,
    brand: p.brands || '',
    source: 'openfoodfacts',
    source_ref: p._id || barcode,
    kcal_100g: Number(p.nutriments?.['energy-kcal_100g']) || 0,
    protein_100g: Number(p.nutriments?.proteins_100g) || 0,
    fat_100g: Number(p.nutriments?.fat_100g) || 0,
    carbs_100g: Number(p.nutriments?.carbohydrates_100g) || 0,
    raw_payload_json: JSON.stringify(payload),
  };

  const run = db.prepare(`INSERT INTO products
    (barcode,name,brand,source,source_ref,kcal_100g,protein_100g,fat_100g,carbs_100g,raw_payload_json,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`)
    .run(product.barcode, product.name, product.brand, product.source, product.source_ref, product.kcal_100g, product.protein_100g, product.fat_100g, product.carbs_100g, product.raw_payload_json);

  return db.prepare('SELECT * FROM products WHERE id = ?').get(run.lastInsertRowid);
}
