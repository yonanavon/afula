/**
 * עדכון אוטומטי של "תאריך עדכון" בלשונית ההגדרות.
 *
 * התקנה חד-פעמית:
 *   1. בגיליון: תוספים ← Apps Script  (Extensions → Apps Script)
 *   2. מחקו את מה שכתוב שם והדביקו את הקובץ הזה במלואו.
 *   3. שמרו (אייקון הדיסקט).
 *   4. בתפריט הימני: Triggers ← Add Trigger
 *      Choose function: onSheetEdit  |  Event source: From spreadsheet
 *      Event type: On edit  ←  שמרו ואשרו את ההרשאה.
 *
 * מרגע זה, כל עריכה בלשונית "עסקים" מעדכנת אוטומטית את התאריך,
 * והאתר מציג אותו בכותרת ובתחתית הדף.
 */

var SETTINGS_SHEET = 'הגדרות';
var BUSINESSES_SHEET = 'עסקים';
var DATE_LABEL = 'תאריך עדכון';

function onSheetEdit(e) {
  var spreadsheet = e ? e.source : SpreadsheetApp.getActive();
  var edited = e ? e.range.getSheet().getName() : BUSINESSES_SHEET;

  // עריכה בלשונית ההגדרות עצמה לא אמורה לאפס את התאריך.
  if (edited !== BUSINESSES_SHEET) return;

  stampUpdatedAt(spreadsheet);
}

function stampUpdatedAt(spreadsheet) {
  var settings = spreadsheet.getSheetByName(SETTINGS_SHEET);
  if (!settings) return;

  var labels = settings.getRange(1, 1, settings.getLastRow(), 1).getValues();
  for (var row = 0; row < labels.length; row++) {
    if (String(labels[row][0]).trim() === DATE_LABEL) {
      var today = Utilities.formatDate(new Date(), spreadsheet.getSpreadsheetTimeZone(), 'dd/MM/yyyy');
      settings.getRange(row + 1, 2).setValue(today);
      return;
    }
  }
}

/** הרצה ידנית מתוך העורך, לבדיקה שהכול מחובר כראוי. */
function testStamp() {
  stampUpdatedAt(SpreadsheetApp.getActive());
}
