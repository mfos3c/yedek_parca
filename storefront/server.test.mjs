import assert from 'node:assert/strict';
import test from 'node:test';

import { catalog, contacts, render, selectedCategories } from './server.mjs';

test('satış vitrini yalnız seçili altı kategoriyi yayınlar', async () => {
  const data = await catalog();
  assert.equal(selectedCategories.size, 6);
  assert.ok(data.parts.length > 0);
  assert.ok(data.parts.every((item) => selectedCategories.has(item.category.split('/').at(-1))));
});

test('ana sayfa kişi bazlı WhatsApp iletişimi ve SEO verilerini içerir', async () => {
  const result = await render('/');
  assert.equal(result.type, 'text/html');
  for (const contact of contacts) {
    assert.match(result.body, new RegExp(contact.name));
    assert.match(result.body, new RegExp(`wa.me/${contact.number}`));
  }
  assert.match(result.body, /Fiyat yayınlamıyoruz/);
  assert.match(result.body, /AutoPartsStore/);
  assert.match(result.body, /rel="canonical"/);
  assert.match(result.body, /og:locale/);
});

test('ürün sayfası OEM kodunu WhatsApp mesajına ve Product verisine ekler', async () => {
  const data = await catalog();
  const item = data.parts[0];
  const result = await render(`/urun/${encodeURIComponent(item.category)}/${encodeURIComponent(item.code)}`);
  assert.match(result.body, /OEM%20kodlu/);
  assert.match(result.body, /"@type":"Product"/);
  assert.match(result.body, /property="og:type" content="product"/);
});
