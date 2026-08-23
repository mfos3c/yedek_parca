#!/usr/bin/env node

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scanCatalog } from './catalog.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const catalogRoot = join(root, 'catalog');
const publicRoot = join(root, 'storefront', 'public');
const host = process.env.STOREFRONT_HOST || '127.0.0.1';
const port = Number(process.env.STOREFRONT_PORT || 4180);
const siteUrl = String(process.env.STOREFRONT_URL || 'https://satis.uzmanlarmotorluaraclar.com').replace(/\/+$/, '');
const contacts = [
  { name: 'Fatih Öztekin', number: '905529439586', display: '0552 943 95 86' },
  { name: 'Mert Helvacı', number: '905415910103', display: '0541 591 01 03' },
];
const selectedCategories = new Set(['TORK KONVERTOR', 'gaz_kelebegi', 'ABS_SBC_BEYNI', 'TURBO', 'yag_pompasi', 'DIREKSIYON_SISTEMLERI']);
let cached = null;
let cachedAt = 0;

const categoryCopy = {
  'TORK KONVERTOR': 'İkinci el tork konvertörü seçeneklerini OEM ve parça koduyla inceleyin. Otomatik şanzıman uyumluluğu, stok ve ürün fotoğrafları için WhatsApp üzerinden bilgi alın.',
  gaz_kelebegi: 'Mercedes, BMW, Volkswagen ve farklı araç grupları için ikinci el gaz kelebeği parçalarını OEM koduyla inceleyin. Uyumluluk ve stok bilgisi WhatsApp üzerinden paylaşılır.',
  ABS_SBC_BEYNI: 'İkinci el ABS beyni ve Mercedes SBC beyni parçalarını OEM numarasıyla inceleyin. Parça fotoğrafları, stok ve araç uyumluluğu için ekibimize WhatsApp’tan yazın.',
  TURBO: 'İkinci el turbo ve turbo ekipmanlarını OEM kodu ve gerçek ürün fotoğraflarıyla inceleyin. Stok, uyumluluk ve fiyat bilgisi için WhatsApp’tan iletişime geçin.',
  yag_pompasi: 'Motor yağ pompası yedek parçalarını OEM kodu ve ürün görselleriyle inceleyin. Güncel stok, uyumluluk ve fiyat bilgisi için WhatsApp hattımızı kullanın.',
  DIREKSIYON_SISTEMLERI: 'İkinci el direksiyon sistemi, direksiyon kutusu ve ilgili yedek parçaları ürün koduyla inceleyin. Fotoğraf, stok ve uyumluluk bilgisi için WhatsApp’tan yazın.',
};

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
function isInside(parent, target) {
  const relative = target.slice(parent.length);
  return target === parent || (target.startsWith(parent) && (relative.startsWith('/') || relative.startsWith('\\')));
}
async function pathExists(path) {
  try { await stat(path); return true; } catch { return false; }
}
function slug(value) { return encodeURIComponent(String(value)); }
function categoryName(path) { return path.split('/').at(-1); }
const categoryLabels = { 'TORK KONVERTOR': 'Tork Konvertörü', gaz_kelebegi: 'Gaz Kelebeği', ABS_SBC_BEYNI: 'ABS / SBC Beyni', TURBO: 'Turbo', yag_pompasi: 'Yağ Pompası', DIREKSIYON_SISTEMLERI: 'Direksiyon Sistemleri' };
function categoryLabel(path) { return categoryLabels[categoryName(path)] || categoryName(path).replaceAll('_', ' '); }
function productUrl(item) { return `/urun/${slug(item.category)}/${slug(item.code)}`; }
function mediaUrl(item, photo) { return `/media/${slug(item.category)}/${slug(item.code)}/${slug(photo.originalName)}`; }
function whatsappLink(number, item) {
  const text = `Merhaba, ${item ? `${item.code} OEM kodlu ${categoryName(item.category)} ürünü` : 'yedek parça kataloğu'} hakkında bilgi almak istiyorum.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function contactLinks(item) {
  return contacts.map((contact, index) => `<a class="whatsapp${index ? ' secondary' : ''}" href="${whatsappLink(contact.number, item)}" target="_blank" rel="noopener" aria-label="${escapeHtml(contact.name)} WhatsApp hattından bilgi al"><strong>${escapeHtml(contact.name)}</strong><span>${escapeHtml(contact.display)} · WhatsApp</span></a>`).join('');
}

async function catalog() {
  if (cached && Date.now() - cachedAt < 10_000) return cached;
  const snapshot = await scanCatalog(catalogRoot);
  cached = { ...snapshot, parts: snapshot.parts.filter((item) => selectedCategories.has(categoryName(item.category))) };
  cachedAt = Date.now();
  return cached;
}

function layout({ title, description, canonical, body, image = `${siteUrl}/assets/logo.svg`, ogType = 'website' }) {
  const businessJson = JSON.stringify({ '@context': 'https://schema.org', '@type': 'AutoPartsStore', name: 'Uzmanlar Motorlu Araçlar', url: siteUrl, telephone: contacts.map((contact) => `+${contact.number}`), image: `${siteUrl}/assets/logo.svg` });
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:type" content="${ogType}"><meta property="og:locale" content="tr_TR"><meta property="og:site_name" content="Uzmanlar Motorlu Araçlar"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}"><link rel="icon" href="/assets/logo.svg"><link rel="stylesheet" href="/assets/site.css"><script type="application/ld+json">${businessJson}</script></head><body><header class="site-header"><a class="brand" href="/"><span>U</span><strong>Uzmanlar Motorlu Araçlar</strong><small>Yedek Parça Kataloğu</small></a><a class="header-whatsapp" href="${whatsappLink(contacts[0].number)}" target="_blank" rel="noopener">WhatsApp’tan sor</a></header><main>${body}</main><footer><strong>Uzmanlar Motorlu Araçlar</strong><span>Fiyat, stok ve uyumluluk bilgisi için WhatsApp</span><div class="footer-contacts">${contacts.map((contact) => `<a href="${whatsappLink(contact.number)}" target="_blank" rel="noopener"><strong>${escapeHtml(contact.name)}</strong><span>${escapeHtml(contact.display)}</span></a>`).join('')}</div></footer></body></html>`;
}

function productCard(item) {
  const photo = item.photos?.[0];
  return `<article class="product-card"><a href="${productUrl(item)}">${photo ? `<img loading="lazy" src="${mediaUrl(item, photo)}" alt="${escapeHtml(item.code)} ${escapeHtml(categoryLabel(item.category))} yedek parça">` : '<div class="no-photo">Fotoğraf için WhatsApp</div>'}<div class="product-copy"><span class="eyebrow">${escapeHtml(categoryLabel(item.category))}</span><h3>${escapeHtml(item.code)}</h3><p>OEM kodu ve ürün bilgisi için detay sayfasını açın.</p><span class="link-text">WhatsApp’tan bilgi al →</span></div></a></article>`;
}

async function render(pathname) {
  const data = await catalog();
  if (pathname === '/robots.txt') return { type: 'text/plain', body: `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n` };
  if (pathname === '/sitemap.xml') {
    const urls = [`${siteUrl}/`, ...[...selectedCategories].map((category) => `${siteUrl}/kategori/${slug(category)}`), ...data.parts.map((item) => `${siteUrl}${productUrl(item)}`)];
    return { type: 'application/xml', body: `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${escapeHtml(url)}</loc></url>`).join('')}</urlset>` };
  }
  if (pathname.startsWith('/media/')) {
    const segments = pathname.slice('/media/'.length).split('/').map(decodeURIComponent);
    if (segments.length !== 3) return null;
    const item = data.parts.find((entry) => entry.category === segments[0] && entry.code === segments[1]);
    const photo = item?.photos.find((entry) => entry.originalName === segments[2]);
    if (!item || !photo) return null;
    const file = resolve(catalogRoot, item.path, photo.originalName);
    if (!isInside(catalogRoot, file) || !(await pathExists(file))) return null;
    return { file, type: { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif' }[extname(file).toLowerCase()] || 'application/octet-stream' };
  }
  const productMatch = pathname.match(/^\/urun\/([^/]+)\/([^/]+)$/);
  if (productMatch) {
    const item = data.parts.find((entry) => entry.category === decodeURIComponent(productMatch[1]) && entry.code === decodeURIComponent(productMatch[2]));
    if (!item) return null;
    const copy = categoryCopy[categoryName(item.category)] || 'Yedek parça bilgisi ve fotoğraflar için WhatsApp üzerinden iletişime geçin.';
    const image = item.photos?.[0] ? `${siteUrl}${mediaUrl(item, item.photos[0])}` : `${siteUrl}/assets/logo.svg`;
    const body = `<section class="product-hero"><a class="back" href="/kategori/${slug(item.category)}">← ${escapeHtml(categoryLabel(item.category))}</a><div class="product-layout"><div class="gallery">${item.photos?.length ? item.photos.map((photo) => `<img src="${mediaUrl(item, photo)}" alt="${escapeHtml(item.code)} ${escapeHtml(categoryLabel(item.category))} gerçek ürün fotoğrafı" loading="lazy">`).join('') : '<div class="no-photo large">Fotoğraf bilgisi için WhatsApp</div>'}</div><div class="product-info"><span class="eyebrow">İKİNCİ EL YEDEK PARÇA</span><h1>${escapeHtml(categoryLabel(item.category))} — ${escapeHtml(item.code)}</h1><p>${escapeHtml(copy)}</p><div class="info-box"><strong>Fiyat bilgisi yayınlanmamaktadır.</strong><span>Stok, uyumluluk ve güncel ürün durumu için WhatsApp’tan yazın.</span></div><div class="contact-actions contact-people">${contactLinks(item)}</div><dl><dt>OEM / parça kodu</dt><dd>${escapeHtml(item.code)}</dd><dt>Kategori</dt><dd>${escapeHtml(categoryLabel(item.category))}</dd></dl></div></div></section><script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: `${categoryLabel(item.category)} ${item.code}`, sku: item.code, category: categoryLabel(item.category), url: `${siteUrl}${productUrl(item)}`, description: copy, image: item.photos.map((photo) => `${siteUrl}${mediaUrl(item, photo)}`), brand: { '@type': 'Brand', name: 'Uzmanlar Motorlu Araçlar' } })}</script>`;
    return { type: 'text/html', body: layout({ title: `${categoryLabel(item.category)} ${item.code} | Uzmanlar Motorlu Araçlar`, description: copy, canonical: `${siteUrl}${productUrl(item)}`, body, image, ogType: 'product' }) };
  }
  const categoryMatch = pathname.match(/^\/kategori\/([^/]+)$/);
  if (categoryMatch) {
    const name = decodeURIComponent(categoryMatch[1]);
    if (!selectedCategories.has(name)) return null;
    const items = data.parts.filter((item) => categoryName(item.category) === name);
    const description = categoryCopy[name] || 'Uzmanlar Motorlu Araçlar yedek parça kataloğu.';
    const body = `<section class="listing"><span class="eyebrow">UZMANLAR MOTORLU ARAÇLAR</span><h1>${escapeHtml(categoryLabel(name))} yedek parçaları</h1><p class="lead">${escapeHtml(description)}</p><div class="product-grid">${items.map(productCard).join('')}</div></section>`;
    return { type: 'text/html', body: layout({ title: `${categoryLabel(name)} Yedek Parça Kataloğu | Uzmanlar`, description, canonical: `${siteUrl}/kategori/${slug(name)}`, body }) };
  }
  if (pathname === '/') {
    const body = `<section class="hero"><div><span class="eyebrow">İKİNCİ EL YEDEK PARÇA</span><h1>Aradığınız parçayı fotoğraf ve OEM koduyla bulun.</h1><p>Uzmanlar Motorlu Araçlar kataloğunda seçili yedek parçaları inceleyin. Fiyat yayınlamıyoruz; uyumluluk, stok ve ürün detayları için WhatsApp’tan bize ulaşın.</p><div class="contact-actions contact-people">${contactLinks()}</div></div></section><section class="listing"><h2>Yedek parça kategorileri</h2><div class="category-grid">${[...selectedCategories].map((name) => `<a class="category-card" href="/kategori/${slug(name)}"><span>${escapeHtml(categoryLabel(name))}</span><strong>${data.parts.filter((item) => categoryName(item.category) === name).length} ürün</strong><small>${escapeHtml(categoryCopy[name])}</small></a>`).join('')}</div></section>`;
    return { type: 'text/html', body: layout({ title: 'İkinci El Yedek Parça Kataloğu | Uzmanlar Motorlu Araçlar', description: 'Tork konvertörü, gaz kelebeği, ABS ve SBC beyni, turbo, yağ pompası ve direksiyon sistemi yedek parçalarını OEM kodu ve gerçek ürün fotoğraflarıyla inceleyin. Fiyat ve stok bilgisi için WhatsApp.', canonical: `${siteUrl}/`, body }) };
  }
  return null;
}

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, `http://${host}:${port}`).pathname;
    if (pathname.startsWith('/assets/')) {
      const file = resolve(publicRoot, pathname.slice('/assets/'.length));
      if (!isInside(publicRoot, file) || !(await pathExists(file))) throw new Error('not found');
      const info = await stat(file); response.writeHead(200, { 'Content-Type': extname(file) === '.css' ? 'text/css; charset=utf-8' : 'image/svg+xml', 'Content-Length': info.size, 'Cache-Control': 'public,max-age=3600' }); createReadStream(file).pipe(response); return;
    }
    const result = await render(pathname);
    if (!result) { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Sayfa bulunamadı'); return; }
    if (result.file) { const info = await stat(result.file); response.writeHead(200, { 'Content-Type': result.type, 'Content-Length': info.size, 'Cache-Control': 'public,max-age=3600' }); createReadStream(result.file).pipe(response); return; }
    response.writeHead(200, { 'Content-Type': `${result.type}; charset=utf-8`, 'Cache-Control': 'public,max-age=60' }); response.end(result.body);
  } catch { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Sayfa bulunamadı'); }
});

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) server.listen(port, host, () => console.log(`Yedek parça vitrini: http://${host}:${port}`));

export { catalog, contacts, render, selectedCategories };
