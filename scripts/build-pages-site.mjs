import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { catalog, render, selectedCategories } from '../storefront/server.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = join(root, 'pages-site');
const mediaFallbackUrl = String(process.env.STOREFRONT_MEDIA_FALLBACK_URL || 'https://uzmanlar-yedek-parca-satis.pages.dev').replace(/\/+$/, '');
const encode = (value) => encodeURIComponent(String(value));
const write = async (relative, content) => { const target = join(out, relative); await mkdir(resolve(target, '..'), { recursive: true }); await writeFile(target, content); };
let recoveredMedia = 0;

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(join(root, 'storefront', 'public'), join(out, 'assets'), { recursive: true });
const data = await catalog();

async function writePage(pathname, relative) {
  const result = await render(pathname);
  if (!result?.body) throw new Error(`Statik sayfa üretilemedi: ${pathname}`);
  await write(relative, result.body);
}

await writePage('/', 'index.html');
await writePage('/robots.txt', 'robots.txt');
await writePage('/sitemap.xml', 'sitemap.xml');
for (const category of selectedCategories) {
  await writePage(`/kategori/${encode(category)}`, join('kategori', category, 'index.html'));
}
for (const item of data.parts) {
  const categoryUrl = encode(item.category);
  const codeUrl = encode(item.code);
  await writePage(`/urun/${categoryUrl}/${codeUrl}`, join('urun', item.category, item.code, 'index.html'));
  for (const photo of item.photos) {
    const source = join(root, 'catalog', item.path, photo.originalName);
    const target = join(out, 'media', item.category, item.code, photo.originalName);
    await mkdir(resolve(target, '..'), { recursive: true });
    try {
      await cp(source, target);
    } catch (error) {
      if (!['EACCES', 'EPERM'].includes(error?.code)) throw error;
      const candidates = [
        `${mediaFallbackUrl}/media/${categoryUrl}/${codeUrl}/${encode(photo.originalName)}`,
        `${mediaFallbackUrl}/media/${encode(categoryUrl)}/${encode(codeUrl)}/${encode(encode(photo.originalName))}`,
      ];
      let recovered = null;
      for (const fallback of candidates) {
        const response = await fetch(fallback);
        if (response.ok && response.headers.get('content-type')?.startsWith('image/')) {
          recovered = Buffer.from(await response.arrayBuffer());
          break;
        }
      }
      if (!recovered) throw new Error(`Fotoğraf okunamadı ve doğrulanmış canlı kopyası alınamadı: ${item.path}/${photo.originalName}`, { cause: error });
      await writeFile(target, recovered);
      recoveredMedia += 1;
    }
  }
}
console.log(`Cloudflare Pages statik sitesi hazır: ${data.parts.length} ürün, ${[...selectedCategories].length} kategori, ${recoveredMedia} korumalı fotoğraf canlı kopyadan alındı`);
