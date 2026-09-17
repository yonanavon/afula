/**
 * עסקים מומלצים לאנ"ש בכשרות מהודרת בעפולה — לוגיקת הצד הלקוח.
 * טוען את הנתונים מהגיליון החי, ואם הוא אינו זמין נופל לגיבוי המקומי.
 */
import { CONFIG } from './config.js';
import { hebrewDateFor } from './hebrew-date.js';
import { CATEGORIES, INACTIVE_STATUS, iconForType, splitList } from './schema.js';
import { fetchFromSheet } from './sheet.js';

const ALL = '__all__';

/** שם מחלקה באנגלית לכל קטגוריה, כדי לשמור על סלקטורים ב-ASCII. */
const CATEGORY_CLASS = { 'חלבי': 'milk', 'בשרי': 'meat', 'פרווה': 'pareve' };

/** גוון הכרטיס לפי הקטגוריה הראשונה — נותן לרשת גיוון ורמז ויזואלי מהיר. */
const CATEGORY_ACCENT = {
  'חלבי': 'var(--cat-milk)',
  'בשרי': 'var(--cat-meat)',
  'פרווה': 'var(--cat-pareve)',
};

const state = {
  businesses: [],
  settings: {},
  query: '',
  category: ALL,
  area: ALL,
  showInactive: false,
};

const el = {
  grid: document.querySelector('[data-grid]'),
  count: document.querySelector('[data-count]'),
  search: document.querySelector('#search'),
  clearSearch: document.querySelector('[data-clear-search]'),
  categoryChips: document.querySelector('[data-filter="category"]'),
  areaChips: document.querySelector('[data-filter="area"]'),
  showInactive: document.querySelector('[data-show-inactive]'),
  reset: document.querySelector('[data-reset]'),
  resetEmpty: document.querySelector('[data-reset-empty]'),
  loading: document.querySelector('[data-state-loading]'),
  empty: document.querySelector('[data-state-empty]'),
  error: document.querySelector('[data-state-error]'),
};

/* -------------------------------------------------------------- טעינה --- */

/** טעינת הגיבוי המקומי שמסונכרן מהגיליון על ידי GitHub Actions. */
async function loadFallback() {
  const [businesses, settings] = await Promise.all([
    fetch(CONFIG.fallback.businesses).then((r) => r.json()),
    fetch(CONFIG.fallback.settings).then((r) => r.json()),
  ]);
  return { businesses, settings };
}

/**
 * מנסה קודם את הגיליון החי כדי שעריכה של המשגיח תופיע מיד,
 * ונופל לגיבוי אם הגיליון איטי, חסום או לא מוגדר.
 */
async function loadData() {
  if (CONFIG.sheetId) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), CONFIG.liveTimeoutMs);
    try {
      const data = await fetchFromSheet(CONFIG, { signal: abort.signal });
      return { ...data, source: 'live' };
    } catch (error) {
      console.warn('טעינה מהגיליון נכשלה, עוברים לגיבוי המקומי:', error);
    } finally {
      clearTimeout(timer);
    }
  }
  return { ...(await loadFallback()), source: 'cache' };
}

/* ------------------------------------------------------------- עזרים --- */

const isActive = (business) => business.status !== INACTIVE_STATUS;

const categoriesOf = (business) => splitList(business.category);

/** מספר לחיוג: ספרות בלבד, כדי ש-tel: יעבוד בכל מכשיר. */
const telHref = (phone) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/** קישור ניווט. אם אין קישור מפורש בגיליון — בונים חיפוש לפי שם וכתובת. */
function mapsHref(business) {
  if (business.mapsUrl) return business.mapsUrl;
  const query = [business.name, business.address, business.area].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** הוספת //https כשהמשגיח הדביק כתובת ללא סכימה. */
function externalHref(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/**
 * טקסט שהמשגיח עוטף בכוכביות בגיליון — *כמו כאן* — מוצג מודגש ובאדום,
 * כמו הקטעים האדומים בקובץ המקורי. כוכבית בודדת מוצגת כפי שהיא.
 */
const EMPHASIS = /\*([^*\n]+)\*/g;

/** בונה צמתי DOM ולא HTML, כך שטקסט מהגיליון לעולם אינו מפורש כתגיות. */
function richText(text) {
  const source = String(text ?? '');
  const nodes = [];
  let last = 0;

  for (const match of source.matchAll(EMPHASIS)) {
    if (match.index > last) nodes.push(document.createTextNode(source.slice(last, match.index)));
    nodes.push(element('strong', 'mark', match[1]));
    last = match.index + match[0].length;
  }
  if (last < source.length) nodes.push(document.createTextNode(source.slice(last)));

  return nodes;
}

/** הסרת סימני ההדגשה, למקומות שבהם אפשר רק טקסט נקי (כותרת הדפדפן). */
const stripEmphasis = (text) => String(text ?? '').replace(EMPHASIS, '$1');

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/* ------------------------------------------------------------- סינון --- */

function matches(business) {
  if (!state.showInactive && !isActive(business)) return false;
  if (state.category !== ALL && !categoriesOf(business).includes(state.category)) return false;
  if (state.area !== ALL && business.area !== state.area) return false;

  if (state.query) {
    const haystack = [
      business.name, business.type, business.category, business.address,
      business.area, business.notes, business.extraSupervision, business.productsKashrut,
    ].join(' ');
    const haystackText = stripEmphasis(haystack).toLowerCase();
    if (!state.query.split(/\s+/).every((word) => haystackText.includes(word))) return false;
  }

  return true;
}

const hasFilters = () =>
  state.query !== '' || state.category !== ALL || state.area !== ALL || state.showInactive;

/* -------------------------------------------------------------- תצוגה --- */

function buildCard(business) {
  const card = element('article', 'card');
  if (!isActive(business)) card.classList.add('card--inactive');

  const thumb = element('div', 'card__thumb');
  const accent = CATEGORY_ACCENT[categoriesOf(business)[0]];
  if (accent) thumb.style.setProperty('--card-accent', accent);
  if (business.image) {
    const img = element('img');
    img.src = business.image;
    img.alt = '';
    img.loading = 'lazy';
    thumb.append(img);
  } else {
    thumb.append(element('span', null, iconForType(business.type)));
    thumb.setAttribute('aria-hidden', 'true');
  }
  if (!isActive(business)) thumb.append(element('span', 'card__ribbon', INACTIVE_STATUS));
  card.append(thumb);

  const body = element('div', 'card__body');
  body.append(element('h2', 'card__name', business.name));

  const tags = element('div', 'card__tags');
  categoriesOf(business).forEach((category) => {
    const suffix = CATEGORY_CLASS[category];
    tags.append(element('span', suffix ? `tag tag--${suffix}` : 'tag', category));
  });
  if (business.type) tags.append(element('span', 'tag', business.type));
  if (tags.childElementCount) body.append(tags);

  const line = (icon, prefix, value) => {
    const row = element('div', 'card__line');
    const iconNode = element('span', null, icon);
    iconNode.setAttribute('aria-hidden', 'true');
    const textNode = element('span');
    if (prefix) textNode.append(prefix);
    textNode.append(...richText(value));
    row.append(iconNode, textNode);
    return row;
  };

  const place = [business.address, business.area].filter(Boolean).join(', ');
  if (place) body.append(line('📍', '', place));
  if (business.extraSupervision) body.append(line('🛡️', 'בהשגחה נוספת: ', business.extraSupervision));
  if (business.productsKashrut) body.append(line('📦', 'המוצרים בכשרות: ', business.productsKashrut));
  if (business.notes) {
    const note = element('p', 'card__note');
    note.append(...richText(business.notes));
    body.append(note);
  }

  const actions = element('div', 'card__actions');
  const action = (href, className, label) => {
    const link = element('a', className, label);
    link.href = href;
    if (/^https?:/.test(href)) { link.target = '_blank'; link.rel = 'noopener'; }
    actions.append(link);
  };

  if (business.phone) action(telHref(business.phone), 'btn btn--primary', `📞 ${business.phone}`);
  if (business.phone2) action(telHref(business.phone2), 'btn', `📞 ${business.phone2}`);
  if (business.address || business.mapsUrl) action(mapsHref(business), 'btn', '🧭 ניווט');
  if (business.kashrutUrl) action(externalHref(business.kashrutUrl), 'btn', '📄 פרטי הכשרות');
  if (business.menuUrl) action(externalHref(business.menuUrl), 'btn', '📖 תפריט');
  if (actions.childElementCount) body.append(actions);

  card.append(body);
  return card;
}

function render() {
  const visible = state.businesses.filter(matches);

  el.grid.replaceChildren(...visible.map(buildCard));
  el.empty.hidden = visible.length > 0;
  el.reset.hidden = !hasFilters();
  el.clearSearch.hidden = state.query === '';

  const hiddenInactive = state.showInactive
    ? 0
    : state.businesses.filter((business) => !isActive(business)).length;

  el.count.textContent = visible.length === 0
    ? ''
    : `${visible.length} עסקים${hiddenInactive ? ` · ${hiddenInactive} אינם פעילים ומוסתרים` : ''}`;
}

/* ------------------------------------------------------- בניית הסינון --- */

function buildChips(container, values, key) {
  const options = [{ value: ALL, label: 'הכל' }, ...values.map((value) => ({ value, label: value }))];
  const chips = options.map(({ value, label }) => {
    const chip = element('button', 'chip', label);
    chip.type = 'button';
    chip.dataset.value = value;
    chip.setAttribute('aria-pressed', String(state[key] === value));
    return chip;
  });

  const sync = () => chips.forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.value === state[key]));
  });

  chips.forEach((chip) => chip.addEventListener('click', () => {
    // לחיצה חוזרת על צ'יפ פעיל מבטלת את הסינון.
    state[key] = state[key] === chip.dataset.value ? ALL : chip.dataset.value;
    sync();
    render();
  }));

  container.replaceChildren(...chips);
}

function buildFilters() {
  // מציגים רק ערכים שקיימים בפועל בנתונים, לפי סדר הקטגוריות הקבוע.
  const present = new Set(state.businesses.flatMap(categoriesOf));
  buildChips(el.categoryChips, CATEGORIES.filter((c) => present.has(c)), 'category');

  const areas = [...new Set(state.businesses.map((b) => b.area).filter(Boolean))];
  buildChips(el.areaChips, areas, 'area');
}

function applySettings(settings) {
  Object.entries(settings).forEach(([key, value]) => {
    if (!value) return;
    document.querySelectorAll(`[data-bind="${key}"]`).forEach((node) => {
      node.replaceChildren(...richText(value));
    });
  });

  if (settings.title) document.title = stripEmphasis(settings.title);

  // התאריך העברי נגזר מתאריך העדכון ואינו נלקח מהגיליון, כדי ששני התאריכים
  // שבסרגל "עודכן" יתארו תמיד את אותו יום.
  const hebrew = hebrewDateFor(settings.updatedAt);
  document.querySelectorAll('[data-bind="updatedAtHebrew"]').forEach((node) => {
    node.textContent = hebrew;
  });

  if (settings.updatedAt) {
    document.querySelector('[data-updated]').hidden = false;
  }
}

function resetFilters() {
  state.query = '';
  state.category = ALL;
  state.area = ALL;
  state.showInactive = false;
  el.search.value = '';
  el.showInactive.checked = false;
  buildFilters();
  render();
}

/* ---------------------------------------------------------- אתחול --- */

function bindEvents() {
  el.search.addEventListener('input', () => {
    state.query = el.search.value.trim().toLowerCase();
    render();
  });

  el.clearSearch.addEventListener('click', () => {
    state.query = '';
    el.search.value = '';
    el.search.focus();
    render();
  });

  el.showInactive.addEventListener('change', () => {
    state.showInactive = el.showInactive.checked;
    render();
  });

  el.reset.addEventListener('click', resetFilters);
  el.resetEmpty.addEventListener('click', resetFilters);
}

async function init() {
  try {
    const { businesses, settings, source } = await loadData();
    console.info(source === 'live' ? 'נתונים מהגיליון החי' : 'נתונים מהגיבוי המקומי');
    state.businesses = businesses;
    state.settings = settings;

    applySettings(settings);
    buildFilters();
    bindEvents();
    render();
  } catch (error) {
    console.error(error);
    el.error.hidden = false;
  } finally {
    el.loading.hidden = true;
  }
}

init();
