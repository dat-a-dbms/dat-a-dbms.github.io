// ========== НАЛАШТУВАННЯ ==========
// Ключі для зберігання в localStorage
const SETTINGS_KEYS = {
    AUTO_LOAD_LAST_DB: 'app_settings_autoLoadLastDb',
    SIMPLE_INTERFACE: 'app_settings_simpleInterface',
    DARK_THEME: 'app_settings_darkTheme',
    LANGUAGE: 'app_settings_language',
    STORE_FILES_IN_DB: 'app_settings_storeFilesInDb'
};

// Стилі темної теми винесені в styles.css.
// Зчитування налаштування з localStorage з дефолтом
function getSetting(key, defaultValue) {
    const raw = localStorage.getItem(key);
    if (raw === null) {
        localStorage.setItem(key, String(defaultValue));
        return defaultValue;
    }
    // Повертаємо boolean для булевих значень, рядок — для решти
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return raw;
}

// Визначення мови за налаштуваннями браузера
function detectBrowserLanguage() {
    const SUPPORTED_LANGS = ['en', 'uk', 'pl', 'de', 'fr', 'es', 'it'];
    const CIS_LANGS = ['uk', 'ru', 'be']; // українська, російська, білоруська → 'uk'

    const browserLang = (navigator.languages[0] || navigator.userLanguage || 'en')
        .toLowerCase()
        .split('-')[0];
	console.log("browserLang=",browserLang);
    if (CIS_LANGS.includes(browserLang)) return 'uk';
    if (SUPPORTED_LANGS.includes(browserLang)) return browserLang;
    return 'en';
}

// Визначення теми за налаштуваннями браузера
function detectBrowserTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Завантаження налаштувань при старті 
function loadSettings() {
    document.getElementById('autoLoadLastDbCheckbox').checked =
        getSetting(SETTINGS_KEYS.AUTO_LOAD_LAST_DB, true);

    const simpleInterface = getSetting(SETTINGS_KEYS.SIMPLE_INTERFACE, false);
    document.getElementById('simpleInterfaceCheckbox').checked = simpleInterface;
    applySimpleInterface(simpleInterface);

    // Тема: якщо раніше не збережено — визначаємо з браузера і зберігаємо
    let darkTheme;
    if (localStorage.getItem(SETTINGS_KEYS.DARK_THEME) === null) {
        darkTheme = detectBrowserTheme();
        localStorage.setItem(SETTINGS_KEYS.DARK_THEME, String(darkTheme));
    } else {
        darkTheme = getSetting(SETTINGS_KEYS.DARK_THEME, false);
    }
    document.getElementById('darkThemeCheckbox').checked = darkTheme;
    applyDarkTheme(darkTheme);

    // Мова: якщо раніше не збережено — визначаємо з браузера і зберігаємо
    let lang = localStorage.getItem(SETTINGS_KEYS.LANGUAGE);
    if (!lang) {
        lang = detectBrowserLanguage();
        localStorage.setItem(SETTINGS_KEYS.LANGUAGE, lang);
    }
    document.getElementById('languageSelect').value = lang;
}

// Застосування простого інтерфейсу 
function applySimpleInterface(enabled) {
    const simpleMenu = document.getElementById('quickAccessPanel').checked;
    console.log("simpleMenu=",simpleMenu)
    if (simpleMenu) {
		console.log("simpleMenu=",simpleMenu)        
        openMainMenu();
        console.log("openMainMenu0");
        closeSettingsModal();
    }
    localStorage.setItem(SETTINGS_KEYS.SIMPLE_INTERFACE, enabled);
}

//  Застосування темної теми 
// Перемикання теми зводиться лише до toggle класу на body.
function applyDarkTheme(enabled) {
    document.body.classList.toggle('dark-theme', enabled);
    localStorage.setItem(SETTINGS_KEYS.DARK_THEME, enabled);
}

/**
 * Отримує налаштування з прив'язаного ключа "dbName.app-settings" і застосовує до UI.
 * Викликається автоматично з io.js → syncAllAppSettings() після кожного
 * завантаження бази (з localStorage, IndexedDB або .DTA файлу).
 * @param {Object} s  { darkTheme, language, simpleInterface, storeFilesInDb, autoLoadLastDb }
 */
function applyAppSettingsToUI(s) {
    if (!s) return;

    if (s.darkTheme !== undefined) {
        const v = s.darkTheme === true || s.darkTheme === "true";
        const cb = document.getElementById('darkThemeCheckbox');
        if (cb) cb.checked = v;
        document.body.classList.toggle('dark-theme', v);
        localStorage.setItem(SETTINGS_KEYS.DARK_THEME, String(v));
    }

    if (s.language) {
        const prevLang = localStorage.getItem(SETTINGS_KEYS.LANGUAGE);
        const sel = document.getElementById('languageSelect');
        if (sel) sel.value = s.language;
        localStorage.setItem(SETTINGS_KEYS.LANGUAGE, s.language);
        if (s.language !== prevLang && typeof setLang === 'function') setLang(s.language);
    }

    if (s.simpleInterface !== undefined) {
        const v = s.simpleInterface === true || s.simpleInterface === "true";
        const cb = document.getElementById('simpleInterfaceCheckbox');
        if (cb) cb.checked = v;
        localStorage.setItem(SETTINGS_KEYS.SIMPLE_INTERFACE, String(v));
        // applySimpleInterface відкриває головне меню — викликаємо тільки якщо реально true
        if (v) applySimpleInterface(v);
    }

    if (s.storeFilesInDb !== undefined) {
        const cb = document.getElementById('storeFilesInDbCheckbox');
        if (cb) cb.checked = s.storeFilesInDb === true || s.storeFilesInDb === "true";
        localStorage.setItem(SETTINGS_KEYS.STORE_FILES_IN_DB, String(s.storeFilesInDb));
    }

    if (s.autoLoadLastDb !== undefined) {
        const cb = document.getElementById('autoLoadLastDbCheckbox');
        if (cb) cb.checked = s.autoLoadLastDb === true || s.autoLoadLastDb === "true";
        localStorage.setItem(SETTINGS_KEYS.AUTO_LOAD_LAST_DB, String(s.autoLoadLastDb));
    }
}

// Відкриття / закриття налаштувань 
function openSettingsModal() {
    // Якщо база відкрита — показуємо її власні налаштування; інакше — глобальні
    const hasDb = typeof database !== "undefined" && database.fileName;
    const dbS = (hasDb && typeof loadDbSettings === "function")
        ? loadDbSettings(database.fileName) : {};
    const bool = (k, lsKey) => k in dbS
        ? (dbS[k] === true || dbS[k] === "true")
        : localStorage.getItem(lsKey) === 'true';
    const str  = (k, lsKey, fb) => k in dbS
        ? (dbS[k] || fb) : (localStorage.getItem(lsKey) || fb);

    document.getElementById('autoLoadLastDbCheckbox').checked =
        bool('autoLoadLastDb', SETTINGS_KEYS.AUTO_LOAD_LAST_DB);
    document.getElementById('simpleInterfaceCheckbox').checked =
        bool('simpleInterface', SETTINGS_KEYS.SIMPLE_INTERFACE);
    document.getElementById('darkThemeCheckbox').checked =
        bool('darkTheme', SETTINGS_KEYS.DARK_THEME);
    document.getElementById('storeFilesInDbCheckbox').checked =
        bool('storeFilesInDb', SETTINGS_KEYS.STORE_FILES_IN_DB);
    document.getElementById('languageSelect').value =
        str('language', SETTINGS_KEYS.LANGUAGE, 'uk');
    document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
}

// Збереження налаштувань
async function saveSettings() {
    const autoLoad        = document.getElementById('autoLoadLastDbCheckbox').checked;
    const simpleInterface = document.getElementById('simpleInterfaceCheckbox').checked;
    const darkTheme       = document.getElementById('darkThemeCheckbox').checked;
    const storeFilesInDb  = document.getElementById('storeFilesInDbCheckbox').checked;
    const language        = document.getElementById('languageSelect').value;
    const prevLang        = localStorage.getItem(SETTINGS_KEYS.LANGUAGE);

    // Завжди зберігаємо глобально (для роботи до відкриття будь-якої бази)
    localStorage.setItem(SETTINGS_KEYS.AUTO_LOAD_LAST_DB,  String(autoLoad));
    localStorage.setItem(SETTINGS_KEYS.SIMPLE_INTERFACE,   String(simpleInterface));
    localStorage.setItem(SETTINGS_KEYS.DARK_THEME,         String(darkTheme));
    localStorage.setItem(SETTINGS_KEYS.STORE_FILES_IN_DB,  String(storeFilesInDb));
    localStorage.setItem(SETTINGS_KEYS.LANGUAGE,           language);

    // Якщо відкрита база — зберегти прив'язано до її файлу
    const hasDb = typeof database !== "undefined" && database.fileName;
    if (hasDb && typeof saveDbSettings === "function") {
        const dbS = {
            autoLoadLastDb:  String(autoLoad),
            simpleInterface: String(simpleInterface),
            darkTheme:       String(darkTheme),
            storeFilesInDb:  String(storeFilesInDb),
            language
        };
        saveDbSettings(database.fileName, dbS);
        // Оновити appSettings у пам'яті
        if (typeof appSettingSet === "function")
            Object.entries(dbS).forEach(([k,v]) => appSettingSet(k, v));
    }

    applySimpleInterface(simpleInterface);
    applyDarkTheme(darkTheme);

    if (language !== prevLang) {
        await setLang(language);
        const langText = document.getElementById('languageSelect')
            .options[document.getElementById('languageSelect').selectedIndex].text;
        Message(t("settingsLangChanged", langText));
    } else {
        Message(t("settingsSaved"));
    }
    closeSettingsModal();
}

// Очищення сховища 
function clearStorage() {
    if (!confirm(t("settingsClearConfirm"))) return;

    const suffixes = [
        '.db-data', '.tables-data', '.queries-data',
        '.query-results', '.reports-data', '.forms-data', '.relations-data', '.app-settings'
    ];
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && suffixes.some(s => key.endsWith(s))) keysToRemove.push(key);
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    openAppDB().then(idb => {
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.clear();
        tx.oncomplete = () => console.log(t("settingsIndexedDbCleared"));
        tx.onerror = e => console.error(t("settingsIndexedDbClearError"), e);
    }).catch(e => console.error(t("settingsIndexedDbOpenError"), e));

    if (db) {
        db = null;
        clearDB();
        updateMainTitle();
        document.getElementById("import-table-link").style.display = "none";
    }
    localStorage.removeItem('lastOpenedFile');
    Message(t("settingsStorageCleared"));
    closeSettingsModal();
    setTimeout(() => location.reload(), 1500);
}

// Налаштування застосовуються через applyAppSettingsToUI() що викликається
// з io.js → syncAllAppSettings() після кожного завантаження бази.

// Ініціалізація після завантаження DOM 
document.addEventListener('DOMContentLoaded', async () => {
    // Якщо мову ще не збережено — визначаємо з браузера і одразу зберігаємо,
    // щоб loadSettings() і loadLanguage() отримали однаковий результат.
    let initialLang = localStorage.getItem(SETTINGS_KEYS.LANGUAGE);
    if (!initialLang) {
        initialLang = detectBrowserLanguage();
        localStorage.setItem(SETTINGS_KEYS.LANGUAGE, initialLang);
    }
    await loadLanguage(initialLang);
    loadSettings();

    const clearBtn = document.getElementById('clearStorageBtn');
    if (clearBtn) clearBtn.onclick = clearStorage;

    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) saveBtn.onclick = saveSettings;
});
