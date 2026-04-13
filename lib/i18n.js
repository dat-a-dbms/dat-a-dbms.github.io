// ========== I18N ==========

// Поточна мова (за замовчуванням — українська)
const DEFAULT_LANG = 'uk';

let currentLang = DEFAULT_LANG;

// Поточний словник
let translations = {};

// Кеш плейсхолдерів
const _placeholderCache = {};

// Застосування перекладів до DOM 

function applyTranslationsToDOM(dict) {	
    document.querySelectorAll('[lang-i18n]').forEach(el => {
        const key = el.getAttribute('lang-i18n');
        if (!dict[key]) return;

        const nonTextChildren = [...el.childNodes].filter(
            node => node.nodeType !== Node.TEXT_NODE
        );

        if (nonTextChildren.length > 0) {
            [...el.childNodes].forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) node.remove();
            });
            const temp = document.createElement('template');
            temp.innerHTML = dict[key];
            el.insertBefore(temp.content, el.firstChild);
        } else {
            el.innerHTML = dict[key];
        }
    });

    document.querySelectorAll('[lang-i18n-title]').forEach(el => {
        const key = el.getAttribute('lang-i18n-title');        ;
        if (dict[key]) el.title = dict[key];
    });
}



// Завантаження мови 

/**
 * Завантажує JSON-словник для вказаної мови, оновлює DOM і глобальні змінні.
 * Один файл на мову: locales/<lang>.json — для JS-рядків.
 * Один файл на мову: locales/<lang>-html.json — для HTML-елементів.
 *
 * @param {string} lang - код мови ('uk', 'en', 'pl', …)
 */
async function loadLanguage(lang = DEFAULT_LANG) {
    try {
        // JS-словник (для функції t())
        const jsRes = await fetch(`locales/${lang}.json`);
        if (!jsRes.ok) throw new Error(`Cannot load locale: ${lang}.json`);
        translations = await jsRes.json();

        // HTML-словник (для DOM-елементів з lang-i18n)
        const htmlRes = await fetch(`locales/${lang}-html.json`);
        if (!htmlRes.ok) throw new Error(`Cannot load locale: ${lang}-html.json`);
        const htmlDict = await htmlRes.json();
console.log(`applyTranslationsToDOM called for "${lang}", keys:`, Object.keys(htmlDict).length);
applyTranslationsToDOM(htmlDict);
        document.documentElement.lang = lang;
        currentLang = lang;

        console.log(`i18n: мову встановлено — "${lang}"`);
    } catch (err) {
        console.error('i18n load error:', err);
        translations = {};
    }
}

// Переклад рядків (JS)

// Витяг плейсхолдерів ${...}
function _extractPlaceholders(str) {
    if (_placeholderCache[str]) return _placeholderCache[str];
    const matches = str.match(/\$\{(\w+)\}/g) || [];
    return (_placeholderCache[str] = matches.map(m => m.slice(2, -1)));
}

/**
 * Повертає перекладений рядок за ключем.
 * Підтримує позиційні та іменовані параметри.
 */
function t(key, ...args) {
    const str = translations[key];
    if (!str) return key;

    if (Array.isArray(str)) return str;

    if (args.length === 0) return str;

    let params = {};
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
        params = args[0];
    } else {
        const names = _extractPlaceholders(str);
        names.forEach((name, i) => { params[name] = args[i]; });
    }

    return str.replace(/\$\{(\w+)\}/g, (_, name) =>
        params[name] !== undefined ? params[name] : ''
    );
}

// Публічний API зміни мови 
/**
 * Змінює мову інтерфейсу "на льоту" та зберігає вибір у localStorage
 * під ключем SETTINGS_KEYS.LANGUAGE (визначений у settings.js).
 *
 * @param {string} lang - код мови
 */
async function setLang(lang) {
    await loadLanguage(lang);
    // SETTINGS_KEYS.LANGUAGE може бути ще не визначеним під час першого виклику,
    // тому використовуємо безпечне звернення
    const storageKey = (typeof SETTINGS_KEYS !== 'undefined')
        ? SETTINGS_KEYS.LANGUAGE
        : 'app_settings_language';
    localStorage.setItem(storageKey, lang);
    updateMainTitle();
}
