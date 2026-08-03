#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const catalog = join(root, 'catalog');
execFileSync(process.execPath, [join(root, 'scripts', 'validate-catalog.mjs')], { stdio: 'inherit' });
const cards = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (entry === 'parca.md') cards.push(path);
  }
}
function frontmatter(source) {
  const body = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const data = {};
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    if (match && match[2] !== '') data[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return data;
}
walk(catalog);
const rows = cards.map(path => ({ ...frontmatter(readFileSync(path, 'utf8')), kart: relative(root, path) }))
  .sort((a, b) => a.kayit_id.localeCompare(b.kayit_id));
writeFileSync(join(catalog, 'index.json'), `${JSON.stringify(rows, null, 2)}\n`);
const markdown = [
  '# Otomatik katalog indeksi',
  '',
  '> Bu dosya `node scripts/build-index.mjs` ile üretilir; elle düzenlemeyin.',
  '',
  '| Kayıt | OEM | Kategori | Kondisyon | Adet | Doğrulama | Kart |',
  '| --- | --- | --- | --- | ---: | --- | --- |',
  ...rows.map(row => `| ${row.kayit_id} | ${row.oem_no} | ${row.kategori} | ${row.kondisyon} | ${row.adet} | ${row.dogrulama_durumu} | [kart](../${row.kart}) |`),
  '',
].join('\n');
writeFileSync(join(catalog, 'index.md'), markdown);
console.log(`${rows.length} kayıt için catalog/index.json ve catalog/index.md üretildi.`);
