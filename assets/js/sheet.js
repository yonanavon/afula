/**
 * שליפת נתונים מגיליון Google Sheets מפורסם, והמרתם למבנה שהאתר עובד איתו.
 * הקובץ נטען גם בדפדפן וגם ב-Node (סקריפט הסנכרון), ולכן הוא משתמש
 * ב-fetch הגלובלי בלבד וללא תלות ב-DOM.
 */
import { BUSINESS_COLUMNS, SETTINGS_KEYS } from './schema.js';

/** כתובת ה-CSV הציבורית של לשונית בגיליון. */
export function sheetCsvUrl(sheetId, sheetName) {
  return (
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}` +
    `/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
  );
}

/**
 * מפרק CSV לפי RFC 4180 — כולל שדות במרכאות שמכילים פסיקים ושורות חדשות,
 * ומרכאות כפולות ("") שמייצגות מרכאה בודדת. Google מחזיר בדיוק בפורמט הזה.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  // חיתוך BOM וניקוי שורות CRLF כדי שהמפריד היחיד שנותר יהיה "\n".
  const input = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char !== '"') {
        field += char;
      } else if (input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = false;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += char;
  }

  // השורה האחרונה, אם הקובץ לא מסתיים בשורה חדשה.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // שורות ריקות לגמרי (למשל תאים ריקים בתחתית הגיליון) אינן נתונים.
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

/** הסרת רווחים מיותרים ותווי רוחב-אפס שנוטים להידבק בהדבקה לגיליון. */
function clean(value) {
  return String(value ?? '').replace(/[​-‏‪-‮]/g, '').trim();
}

/** המרת לשונית "עסקים" לרשימת אובייקטים, לפי כותרות העמודות. */
export function rowsToBusinesses(rows) {
  if (rows.length < 2) return [];

  const headers = rows[0].map(clean);
  const blank = Object.fromEntries(Object.values(BUSINESS_COLUMNS).map((key) => [key, '']));

  return rows
    .slice(1)
    .map((cells) => {
      const business = { ...blank };
      headers.forEach((header, index) => {
        const key = BUSINESS_COLUMNS[header];
        if (key) business[key] = clean(cells[index]);
      });
      return business;
    })
    .filter((business) => business.name !== '');
}

/** המרת לשונית "הגדרות" (מפתח | ערך) לאובייקט הגדרות. */
export function rowsToSettings(rows) {
  const settings = {};
  rows.forEach((cells) => {
    const key = SETTINGS_KEYS[clean(cells[0])];
    if (key) settings[key] = clean(cells[1]);
  });
  return settings;
}

/**
 * שליפת הגיליון החי. מחזיר { businesses, settings } או זורק שגיאה —
 * המתקשר אחראי ליפול חזרה לגיבוי המקומי.
 */
export async function fetchFromSheet(config, { signal } = {}) {
  const load = async (sheetName) => {
    const response = await fetch(sheetCsvUrl(config.sheetId, sheetName), { signal });
    if (!response.ok) {
      throw new Error(`הלשונית "${sheetName}" החזירה ${response.status}`);
    }
    return parseCsv(await response.text());
  };

  const [businessRows, settingRows] = await Promise.all([
    load(config.businessesSheet),
    load(config.settingsSheet),
  ]);

  const businesses = rowsToBusinesses(businessRows);
  if (businesses.length === 0) {
    throw new Error('הגיליון לא החזיר אף עסק');
  }

  return { businesses, settings: rowsToSettings(settingRows) };
}
