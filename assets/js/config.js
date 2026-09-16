/**
 * הגדרות האתר.
 *
 * כדי לחבר את האתר לגיליון Google Sheets:
 *  1. פתחו את הגיליון והעתיקו את המזהה מתוך הכתובת:
 *     https://docs.google.com/spreadsheets/d/<<< המזהה נמצא כאן >>>/edit
 *  2. הדביקו אותו ב-sheetId למטה ושמרו.
 *  3. ודאו שהגיליון משותף להצגה: שיתוף ← "כל מי שיש לו הקישור" ← מציג.
 *
 * כל עוד sheetId ריק, האתר יציג את הנתונים השמורים בתיקיית data/.
 */
export const CONFIG = {
  sheetId: '',

  /** שמות הלשוניות בגיליון. יש לשמור על התאמה מדויקת. */
  businessesSheet: 'עסקים',
  settingsSheet: 'הגדרות',

  /** גיבוי מקומי, מסונכרן אוטומטית מהגיליון פעם בשעה. */
  fallback: {
    businesses: 'data/businesses.json',
    settings: 'data/settings.json',
  },

  /** אחרי כמה זמן לוותר על הגיליון החי ולעבור לגיבוי (מילישניות). */
  liveTimeoutMs: 6000,
};
