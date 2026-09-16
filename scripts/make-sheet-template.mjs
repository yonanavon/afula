/**
 * מייצר את קובצי ה-CSV שבתיקיית sheet-template/ מתוך הנתונים שב-data/.
 * מריצים פעם אחת בהקמה, כדי לייבא לגיליון חדש:  node scripts/make-sheet-template.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUSINESS_COLUMNS, SETTINGS_KEYS } from '../assets/js/schema.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (path) => JSON.parse(await readFile(join(root, path), 'utf8'));

/** ציטוט שדה לפי RFC 4180. */
const cell = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toCsv = (rows) => `﻿${rows.map((row) => row.map(cell).join(',')).join('\n')}\n`;

const businesses = await readJson('data/businesses.json');
const settings = await readJson('data/settings.json');

const headers = Object.keys(BUSINESS_COLUMNS);
const businessRows = [
  headers,
  ...businesses.map((business) => headers.map((header) => business[BUSINESS_COLUMNS[header]])),
];

const settingRows = Object.entries(SETTINGS_KEYS).map(([label, key]) => [label, settings[key]]);

await mkdir(join(root, 'sheet-template'), { recursive: true });
await writeFile(join(root, 'sheet-template/עסקים.csv'), toCsv(businessRows));
await writeFile(join(root, 'sheet-template/הגדרות.csv'), toCsv(settingRows));

console.log(`נוצרו קובצי CSV: ${businesses.length} עסקים, ${settingRows.length} הגדרות.`);
