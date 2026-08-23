import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);

function parseQuantity(source = '') {
  const direct = String(source).match(/adet\s*:?\s*(\d+)/i);
  const reverse = String(source).match(/(\d+)\s*adet/i);
  return direct ? Number(direct[1]) : reverse ? Number(reverse[1]) : null;
}

function isDamaged(source = '') {
  return /(kırık|kirik|çatlak|catlak|arızalı|arizali|sorunlu|hasar|kaynak|tamirli|eksik|\byok\b|işaret|isaret|revize)/i.test(source);
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function scanCatalog(catalogRoot) {
  const parts = [];

  async function visit(dir, segments) {
    const entries = (await readdir(dir, { withFileTypes: true })).filter((entry) => !entry.name.startsWith('.'));
    const directories = entries.filter((entry) => entry.isDirectory() && entry.name !== '_events');
    const files = entries.filter((entry) => entry.isFile());
    const countFile = files.find((entry) => entry.name.toLowerCase() === 'sayim.md');
    const photoFiles = files.filter((entry) => imageExtensions.has(extname(entry.name).toLowerCase()));
    const manifestFile = files.find((entry) => entry.name === 'item.json');
    const isPart = segments.length >= 2 && Boolean(countFile || manifestFile || photoFiles.length);

    if (isPart) {
      const countText = countFile ? await readFile(join(dir, countFile.name), 'utf8') : '';
      const manifest = manifestFile ? await readJson(join(dir, manifestFile.name)) : null;
      if (manifest?.archived) return;
      const manifestByName = new Map((manifest?.photos ?? []).map((photo) => [photo.originalName, photo]));
      const photos = photoFiles.map((entry) => manifestByName.get(entry.name) ?? {
        originalName: entry.name,
        mime: null,
      }).sort((a, b) => a.originalName.localeCompare(b.originalName, 'tr'));
      const directoryInfo = await stat(dir);
      parts.push({
        path: segments.join('/'),
        category: segments.slice(0, -1).join('/'),
        code: segments.at(-1),
        quantity: parseQuantity(countText),
        damaged: isDamaged(countText),
        photos,
        createdAt: manifest?.createdAt ?? directoryInfo.birthtime.toISOString(),
        updatedAt: manifest?.updatedAt ?? directoryInfo.mtime.toISOString(),
      });
      return;
    }

    for (const entry of directories) await visit(join(dir, entry.name), [...segments, entry.name]);
  }

  const categories = (await readdir(catalogRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== '_events')
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  for (const entry of categories) await visit(join(catalogRoot, entry.name), [entry.name]);
  parts.sort((a, b) => a.category.localeCompare(b.category, 'tr') || a.code.localeCompare(b.code, 'tr'));
  return { parts };
}
