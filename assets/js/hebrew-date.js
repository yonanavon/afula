/**
 * גזירת התאריך העברי מתוך תאריך העדכון הלועזי.
 *
 * בעבר התאריך העברי היה תא נפרד בגיליון, בעוד התאריך הלועזי מתעדכן אוטומטית
 * בכל עריכה — ולכן השניים נפרדו זה מזה והוצג תאריך עברי שאינו תואם.
 * כאן הוא מחושב מהתאריך הלועזי, כך שלא ייתכן פער ביניהם.
 *
 * ההמרה נעשית לפי היום הלועזי (חצות עד חצות), כמקובל בציון תאריך עדכון,
 * ולא לפי צאת הכוכבים.
 */

const GERESH = '׳';
const GERSHAYIM = '״';

const UNITS = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת'];

/** אותיות הגימטריה של מספר, ללא סימני פיסוק. ט"ו וט"ז במקום יה ויו. */
function gematriaLetters(number) {
  let letters = '';
  let rest = number;

  while (rest >= 400) {
    letters += 'ת';
    rest -= 400;
  }
  letters += HUNDREDS[Math.floor(rest / 100)];
  rest %= 100;

  if (rest === 15 || rest === 16) return `${letters}ט${UNITS[rest - 9]}`;
  return letters + TENS[Math.floor(rest / 10)] + UNITS[rest % 10];
}

/** מספר בגימטריה עם הפיסוק המקובל: ה׳ באות אחת, כ״ב בשתיים ויותר. */
function gematria(number) {
  const letters = gematriaLetters(number);
  if (letters.length < 2) return letters + GERESH;
  return `${letters.slice(0, -1)}${GERSHAYIM}${letters.slice(-1)}`;
}

/** שנה עברית: אלפים, גרש, ושארית המספר בגימטריה — ה׳תשפ״ז. */
function hebrewYear(year) {
  const thousands = Math.floor(year / 1000);
  const rest = year % 1000;
  const prefix = thousands ? gematriaLetters(thousands) + GERESH : '';
  return rest ? prefix + gematria(rest) : prefix;
}

/** חלקי התאריך העברי מתוך לוח השנה של הדפדפן. */
function hebrewParts(date) {
  const parts = new Intl.DateTimeFormat('he-u-ca-hebrew', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(date);

  const value = (type) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    day: Number(value('day')),
    // שם החודש לבדו; תחילית ה-ב׳ מתווספת כאן, כדי לא להיות תלויים בניסוח של הדפדפן.
    month: value('month').replace(/^ב/, ''),
    year: Number(value('year')),
  };
}

/**
 * המרת תאריך העדכון כפי שהוא נכתב בגיליון (dd/MM/yyyy) לאובייקט Date.
 * נקבע בשעת צהריים ב-UTC, כדי שאזור הזמן של הגולש לא יזיז את היום.
 */
export function parseUpdatedAt(text) {
  const match = /^\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s*$/.exec(String(text ?? ''));
  if (!match) return null;

  const [, day, month, year] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const valid = date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
  return valid ? date : null;
}

/** התאריך העברי כטקסט: "ה׳ בתשרי ה׳תשפ״ז". מחרוזת ריקה אם אין תאריך תקין. */
export function hebrewDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';

  try {
    const { day, month, year } = hebrewParts(date);
    if (!day || !month || !year) return '';
    return `${gematria(day)} ב${month} ${hebrewYear(year)}`;
  } catch (error) {
    // דפדפן ללא לוח השנה העברי — עדיף להציג רק את התאריך הלועזי מאשר תאריך שגוי.
    console.warn('חישוב התאריך העברי נכשל:', error);
    return '';
  }
}

/** קיצור נוח: מהטקסט שבגיליון ישירות אל התאריך העברי. */
export const hebrewDateFor = (text) => hebrewDate(parseUpdatedAt(text));

/**
 * עונת הסוכה: משבוע לפני החג (ח׳ בתשרי) ועד הושענא רבה (כ״א בתשרי), כולל.
 * מחושב לפי התאריך המקומי של הגולש, ובלי תלות בשנה — כך שזה חוזר מאליו כל שנה.
 * לבדיקה מחוץ לעונה: הוסיפו ?sukkah=1 לכתובת האתר.
 */
export function isSukkahSeason(date = new Date()) {
  if (/[?&]sukkah=1\b/.test(globalThis.location?.search ?? '')) return true;

  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long' })
      .formatToParts(date);
    const value = (type) => parts.find((part) => part.type === type)?.value ?? '';
    const day = Number(value('day'));
    return /^tish/i.test(value('month')) && day >= 8 && day <= 21;
  } catch {
    // דפדפן ללא לוח השנה העברי — לא מציגים את הסוכה, כדי לא להציגה כל השנה.
    return false;
  }
}
