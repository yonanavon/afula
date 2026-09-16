/**
 * מושך את הגיליון ושומר עותק מקומי ב-data/.
 * רץ אוטומטית ב-GitHub Actions, ואפשר גם להריץ ידנית:
 *
 *   SHEET_ID=<מזהה הגיליון> node scripts/sync.mjs
 *
 * העותק הזה משמש כגיבוי: אם הגיליון אינו זמין בזמן שגולש נכנס לאתר,
 * הדף מציג אותו במקום להישאר ריק.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIG } from '../assets/js/config.js';
import { fetchFromSheet } from '../assets/js/sheet.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// משתנה הסביבה גובר, כדי שה-workflow יוכל להזריק את המזהה כסוד.
const config = { ...CONFIG, sheetId: process.env.SHEET_ID || CONFIG.sheetId };

if (!config.sheetId) {
  console.error('חסר מזהה גיליון. הגדירו SHEET_ID או ערכו את assets/js/config.js');
  process.exit(1);
}

const { businesses, settings } = await fetchFromSheet(config);

await mkdir(join(root, 'data'), { recursive: true });
await writeFile(join(root, 'data/businesses.json'), `${JSON.stringify(businesses, null, 2)}\n`);
await writeFile(join(root, 'data/settings.json'), `${JSON.stringify(settings, null, 2)}\n`);

console.log(`סונכרנו ${businesses.length} עסקים ו-${Object.keys(settings).length} הגדרות.`);
