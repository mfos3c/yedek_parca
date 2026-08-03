#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

const root = process.cwd();
const catalog = join(root, 'catalog');
const required = ['kayit_id', 'oem_no', 'gorseller', 'kategori', 'marka', 'model', 'kasa_sasi_ailesi', 'yil_araligi', 'taraf_konum', 'kondisyon', 'adet', 'notlar', 'kayit_tarihi', 'dogrulama_durumu'];
const statuses = new Set(['dogrulandi', 'bekliyor', 'inceleniyor']);
const cards = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (entry === 'parca.md') cards.push(path);
  }
}
function parseFrontmatter(source, file) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error(`${file}: YAML ön yüz bilgisi yok.`);
  const data = {};
  let listKey;
  for (const line of match[1].split(/\r?\n/)) {
    const scalar = line.match(/^([a-z_]+):\s*(.*)$/);
    const item = line.match(/^\s+-\s+"?(.*?)"?\s*$/);
    if (scalar) {
      listKey = undefined;
      const [, key, raw] = scalar;
      if (raw === '') { data[key] = []; listKey = key; }
      else data[key] = raw.replace(/^"|"$/g, '');
    } else if (item && listKey) data[listKey].push(item[1]);
  }
  return data;
}

if (!existsSync(catalog)) {
  console.error('HATA: catalog/ bulunamadı.'); process.exit(1);
}
walk(catalog);
const errors = [];
const ids = new Set();
const physicalIdsByOem = new Map();
for (const card of cards) {
  const rel = relative(root, card);
  const dir = dirname(card);
  const folder = basename(dir);
  const category = basename(dirname(dir));
  let data;
  try { data = parseFrontmatter(readFileSync(card, 'utf8'), rel); }
  catch (error) { errors.push(error.message); continue; }
  for (const key of required) if (!(key in data)) errors.push(`${rel}: zorunlu alan eksik: ${key}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category)) errors.push(`${rel}: kategori klasörü küçük harf, rakam ve tire kullanmalı.`);
  if (data.kategori !== category) errors.push(`${rel}: kategori YAML/klasör eşleşmiyor.`);
  if (data.kayit_id !== folder) errors.push(`${rel}: kayit_id klasör adıyla eşleşmiyor.`);
  if (!/^[A-Za-z0-9]+-\d{2,}$/.test(folder)) errors.push(`${rel}: klasör adı OEMNO-01 biçiminde değil.`);
  if (data.oem_no && !folder.startsWith(`${data.oem_no}-`)) errors.push(`${rel}: oem_no klasör adının ön ekiyle eşleşmiyor.`);
  if (ids.has(data.kayit_id)) errors.push(`${rel}: yinelenen kayit_id: ${data.kayit_id}`); else ids.add(data.kayit_id);
  if (!physicalIdsByOem.has(data.oem_no)) physicalIdsByOem.set(data.oem_no, new Set());
  physicalIdsByOem.get(data.oem_no).add(data.kayit_id);
  if (!statuses.has(data.dogrulama_durumu)) errors.push(`${rel}: geçersiz dogrulama_durumu.`);
  if (!Array.isArray(data.gorseller) || data.gorseller.length === 0) errors.push(`${rel}: en az bir görsel gerekli.`);
  else {
    if (!data.gorseller.some(image => /-etiket\.[a-z0-9]+$/i.test(image))) errors.push(`${rel}: etiket/OEM görseli zorunlu.`);
    for (const image of data.gorseller) {
      if (!image.startsWith(`${folder}-`)) errors.push(`${rel}: görsel adında kayıt kimliği olmalı: ${image}`);
      if (!existsSync(join(dir, image))) errors.push(`${rel}: görsel dosyası bulunamadı: ${image}`);
    }
  }
}
console.log(`${cards.length} parça kartı kontrol edildi.`);
for (const [oem, physicalIds] of physicalIdsByOem) {
  if (physicalIds.size > 1) console.log(`- ${oem}: ${[...physicalIds].join(', ')} ayrı fiziksel kayıt olarak saklanıyor.`);
}
if (errors.length) { console.error(`\n${errors.length} hata:`); errors.forEach(error => console.error(`- ${error}`)); process.exit(1); }
console.log('Doğrulama başarılı.');
