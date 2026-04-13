// ========== I18N ==========

const DEFAULT_LANG = 'uk';
let currentLang = DEFAULT_LANG;
let translations = {};
const _placeholderCache = {};

// Поточний HTML-словник (зберігаємо для MutationObserver)
let _htmlDict = {};

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
        const key = el.getAttribute('lang-i18n-title');
        if (dict[key]) el.title = dict[key];
    });
}

// ★ Перекладає один елемент (і його нащадків) за поточним _htmlDict
function _translateElement(el) {
    if (el.nodeType !== Node.ELEMENT_NODE) return;

    const key = el.getAttribute('lang-i18n');
    if (key && _htmlDict[key]) {
        const nonText = [...el.childNodes].filter(n => n.nodeType !== Node.TEXT_NODE);
        if (nonText.length > 0) {
            [...el.childNodes].forEach(n => { if (n.nodeType === Node.TEXT_NODE) n.remove(); });
            const temp = document.createElement('template');
            temp.innerHTML = _htmlDict[key];
            el.insertBefore(temp.content, el.firstChild);
        } else {
            el.innerHTML = _htmlDict[key];
        }
    }

    const titleKey = el.getAttribute('lang-i18n-title');
    if (titleKey && _htmlDict[titleKey]) el.title = _htmlDict[titleKey];

    // Перекладаємо нащадків теж
    el.querySelectorAll('[lang-i18n]').forEach(child => {
        const k = child.getAttribute('lang-i18n');
        if (k && _htmlDict[k]) child.innerHTML = _htmlDict[k];
    });
    el.querySelectorAll('[lang-i18n-title]').forEach(child => {
        const k = child.getAttribute('lang-i18n-title');
        if (k && _htmlDict[k]) child.title = _htmlDict[k];
    });
}

// ★ Спостерігач: перекладає нові елементи щойно вони потрапляють у DOM
let _observer = null;

function _startObserver() {
    if (_observer) return; // вже запущений
    _observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                _translateElement(node);
            }
        }
    });
    _observer.observe(document.body, { childList: true, subtree: true });
}

async function loadLanguage(lang = DEFAULT_LANG) {
    try {
        const jsRes = await fetch(`locales/${lang}.json`);
        if (!jsRes.ok) throw new Error(`Cannot load locale: ${lang}.json`);
        translations = await jsRes.json();

        const htmlRes = await fetch(`locales/${lang}-html.json`);
        if (!htmlRes.ok) throw new Error(`Cannot load locale: ${lang}-html.json`);
        _htmlDict = await htmlRes.json();

        console.log(`applyTranslationsToDOM called for "${lang}", keys:`, Object.keys(_htmlDict).length);
        applyTranslationsToDOM(_htmlDict);

        document.documentElement.lang = lang;
        currentLang = lang;

        // Запускаємо спостерігач після першого завантаження мови
        _startObserver();

        console.log(`i18n: мову встановлено — "${lang}"`);
    } catch (err) {
        console.error('i18n load error:', err);
        translations = {};
    }
}

function _extractPlaceholders(str) {
    if (_placeholderCache[str]) return _placeholderCache[str];
    const matches = str.match(/\$\{(\w+)\}/g) || [];
    return (_placeholderCache[str] = matches.map(m => m.slice(2, -1)));
}

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

async function setLang(lang) {
    // Зупиняємо старий спостерігач при зміні мови
    if (_observer) {
        _observer.disconnect();
        _observer = null;
    }
    await loadLanguage(lang);
    const storageKey = (typeof SETTINGS_KEYS !== 'undefined')
        ? SETTINGS_KEYS.LANGUAGE
        : 'app_settings_language';
    localStorage.setItem(storageKey, lang);
    updateMainTitle();
}
