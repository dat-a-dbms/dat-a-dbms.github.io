// ===== _app_settings: службова таблиця налаштувань у SQLite =====
// Не відображається у списку таблиць користувача.

function ensureAppSettingsTable() {
    if (!db) return;
    db.run(`
        CREATE TABLE IF NOT EXISTS "_app_settings" (
            "key"   TEXT PRIMARY KEY,
            "value" TEXT
        );
    `);
}

function appSettingGet(key) {
    if (!db) return null;
    try {
        const res = db.exec(`SELECT "value" FROM "_app_settings" WHERE "key" = '${key.replace(/'/g, "''")}' LIMIT 1;`);
        if (res.length && res[0].values.length) return res[0].values[0][0];
    } catch (e) {
        console.warn("appSettingGet error:", e);
    }
    return null;
}

function appSettingSet(key, value) {
    if (!db) return;
    ensureAppSettingsTable();
    db.run(
        `INSERT INTO "_app_settings" ("key","value") VALUES (?,?) ON CONFLICT("key") DO UPDATE SET "value"=excluded."value";`,
        [key, String(value)]
    );
}

/**
 * Читає STORE_FILES_IN_DB з _app_settings і синхронізує в localStorage.
 * Якщо в БД значення немає — читає з localStorage і записує в БД.
 */
function syncStoreFilesInDbSetting() {
    ensureAppSettingsTable();
    const dbVal = appSettingGet("storeFilesInDb");
    if (dbVal !== null) {
        // БД — джерело правди при перенесенні на інший ПК
        localStorage.setItem("app_settings_storeFilesInDb", dbVal);
    } else {
        // Перший запуск: переносимо значення з localStorage до БД
        const lsVal = localStorage.getItem("app_settings_storeFilesInDb") ?? "false";
        appSettingSet("storeFilesInDb", lsVal);
    }
}

function openAppDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = e => reject(e.target.error);
    });
}

async function idbSave(key, value) {
    const idb = await openAppDB();
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = resolve;
        tx.onerror = e => reject(e.target.error);
    });
}

async function idbLoad(key) {
    const idb = await openAppDB();
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = e => resolve(e.target.result ?? null);
        req.onerror = e => reject(e.target.error);
    });
}

async function idbDelete(key) {
    const idb = await openAppDB();
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = resolve;
        tx.onerror = e => reject(e.target.error);
    });
}
//
/**
 * Автоматичне відкриття форми STARTUP після завантаження бази даних
 */
function autoOpenStartupForm() {
    // Перевіряємо наявність форми з назвою STARTUP
    if (!database.forms || database.forms.length === 0) {
        console.log("Немає форм для автоматичного відкриття");
        return;
    }
    const startupForm = database.forms.find(form => form.name.toUpperCase() === "STARTUP" || form.name.toUpperCase() === "STARTUP_FORM" || form.name === "Стартова");
    if (!startupForm) {
        console.log("Форму STARTUP не знайдено");
        return;
    }
    console.log("Знайдено стартову форму:", startupForm.name);
    // Невелика затримка, щоб DOM повністю завантажився
    setTimeout(() => {
        // Закриваємо всі можливі модальні вікна
        closeAllModals();
        // Відкриваємо форму в режимі перегляду
        previewForm(startupForm, true);
    }, 500);
}
// ===== File BLOB encode/decode =====
function encodeFileBlob(name, type, arrayBuffer) {
    const header = new TextEncoder().encode(JSON.stringify({ name, type }));
    const result = new Uint8Array(4 + header.length + arrayBuffer.byteLength);
    new DataView(result.buffer).setUint32(0, header.length);
    result.set(header, 4);
    result.set(new Uint8Array(arrayBuffer), 4 + header.length);
    return result;
}

function decodeFileBlob(uint8array) {
    const headerLen = new DataView(uint8array.buffer, uint8array.byteOffset).getUint32(0);
    const header = JSON.parse(new TextDecoder().decode(uint8array.slice(4, 4 + headerLen)));
    return { name: header.name, type: header.type, data: uint8array.slice(4 + headerLen) };
}

// Завантаження БД з IndexedDB або створення нової
async function loadDatabase() {
    console.log("loadDatabase")
    const name = database.fileName || "my_database";
    const data = await idbLoad(name + ".db-data");
    console.log("name =", name)

    if (data) {
        db = new SQL.Database(data);
        console.log("База даних завантажена: ", db);
        syncStoreFilesInDbSetting();            
        
        // Завантажити запити тільки якщо є база
        const savedQueries = localStorage.getItem(name + ".queries-data");
        if (savedQueries) {
            queries.definitions = JSON.parse(savedQueries);
            console.log("Визначення запитів завантажено: ", queries.definitions);
        } else {
            queries.definitions = [];
        }
        
        const savedQueryResults = localStorage.getItem(name + ".query-results");
        if (savedQueryResults) {
            queries.results = JSON.parse(savedQueryResults);
            console.log("Результати запитів завантажено:", queries.results);
        } else {
            queries.results = [];
        }

        const savedReports = localStorage.getItem(name + ".reports-data");
        if (savedReports) {
            database.reports = JSON.parse(savedReports);
            console.log("Звіти завантажено: ", database.reports);               
        } else {
            database.reports = [];
        }
        
        const savedForms = localStorage.getItem(name + ".forms-data");
        if (savedForms) {
            database.forms = JSON.parse(savedForms);
            console.log("Форми завантажено: ", database.forms);
        } else {
            database.forms = [];
        }
        
        const savedRelations = localStorage.getItem(name + ".relations-data");
        if (savedRelations) {
            database.relations = JSON.parse(savedRelations);
            console.log("Зв'язки завантажено: ", database.relations);
        } else {
            database.relations = [];
        }

        //АВТОМАТИЧНЕ ВІДКРИТТЯ СТАРТОВОЇ ФОРМИ
        autoOpenStartupForm();

    } else {
        db = new SQL.Database();
        syncStoreFilesInDbSetting();
        queries.definitions = [];
        database.reports = [];
        database.forms = [];
        console.log("Нова база даних створена");
    }
    newDbFile = false;
    queries.results = [];
    const itl = document.getElementById("import-table-link");
    if (itl) {
        itl.style.display = "block";
    }
    updateMainTitle();
    updateQuickAccessPanel(
        getCurrentTableNames(),
        getCurrentQueryNames(),
        getCurrentReportNames(),
        getCurrentFormNames()
    ); 
    localStorage.setItem('lastOpenedFile', name);
}

// Збереження БД у IndexedDB
async function saveDatabase() {
        console.log("Зберігаємо базу даних: ", database.fileName)
        if (!db) return;
        // Синхронізуємо налаштування з localStorage → _app_settings перед збереженням
        const storeFilesInDb = localStorage.getItem("app_settings_storeFilesInDb") ?? "false";
        appSettingSet("storeFilesInDb", storeFilesInDb);
        await idbSave(database.fileName + ".db-data", db.export());
        console.log("Зберігаємо таблиці: ",database.tables)
        localStorage.setItem(database.fileName + ".tables-data", JSON.stringify(
            database.tables.map(({ data, ...rest }) => rest)
        ));
        // Зберігаємо запити та їх результати
        console.log("Зберігаємо запити: ",queries.definitions)
        localStorage.setItem(database.fileName + ".queries-data", JSON.stringify(queries.definitions));
        console.log("Зберігаємо результати запитів: ",queries.results)
        localStorage.setItem(database.fileName + ".query-results", JSON.stringify(queries.results || []));


        // Зберігаємо звіти
        localStorage.setItem(database.fileName + ".reports-data", JSON.stringify(database.reports || []));
        console.log("Зберігаємо звіти: ",database.reports)
        // Зберігаємо форми
        localStorage.setItem(database.fileName + ".forms-data", JSON.stringify(database.forms || []));
        console.log("Зберігаємо форми: ",database.forms)
        // Зберігаємо зв'язки (тільки readonly — FK-зв'язки)
        const relationsToSave = (database.relations || []).filter(r => r.readonly === true);
        console.log("Зберігаємо зв'язки: ", relationsToSave)
        localStorage.setItem(database.fileName + ".relations-data", JSON.stringify(relationsToSave));
        
        console.log("База даних збережена у localStorage");
        document.getElementById("import-table-link").style.display = "block";
        updateQuickAccessPanel(
                  getCurrentTableNames(),
                  getCurrentQueryNames(),
                  getCurrentReportNames(),
                  getCurrentFormNames()
                );                
                    
}

async function showStorageDialog() {
    const listEl = document.getElementById("storageList");
    listEl.innerHTML = "";
    selectedDbFile = null;

    // Отримуємо всі ключі з IndexedDB
    const idb = await openAppDB();
    const keys = await new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).getAllKeys();
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = e => reject(e.target.error);
    });

    keys.forEach(key => {
        if (!key.endsWith(".db-data")) return;
        const fileName = key.replace(".db-data", "");
        const li = document.createElement("li");
        li.textContent = fileName;
        li.style.padding = "8px";
        li.style.cursor = "pointer";

        li.addEventListener("click", () => {
            [...listEl.children].forEach(el => el.style.background = "");
            const isDark = document.body.classList.contains("dark-theme");
            li.style.background = isDark ? "#242d43" : "#d0e0ff";
            selectedDbFile = fileName;
        });

        listEl.appendChild(li);
    });

    document.getElementById("storageModal").style.display = "flex";
}

async function loadSelectedDb() {
    if (!selectedDbFile) {
        Message(t("ioSelectDbFile"));
        return;
    }

    const data = await idbLoad(selectedDbFile + ".db-data");
    if (!data) {
        Message(t("ioFileNotFound"));
        return;
    }

    db = new SQL.Database(data);

    // Очистити database, queries та меню
    clearDB();
    syncStoreFilesInDbSetting();

    // Завантажити дані з локального сховища
    const fullDatabase = JSON.parse(localStorage.getItem(selectedDbFile + ".tables-data"));
    console.log("fullDatabase=", fullDatabase);

    queries.definitions = [];
    if (fullDatabase) {
        database.tables = fullDatabase;
    
        // Створити всі таблиці в SQLite, якщо вони відсутні
        database.tables.forEach(t => {
            try {
                db.exec(`SELECT * FROM "${t.name}" LIMIT 1`);
            } catch (e) {
                console.warn(`Таблиця "${t.name}" відсутня в SQLite, створюємо...`);
                
                // Створення таблиці вручну з її schema
                const fields = t.schema.map(field => {
                    let type = (field.type || "").toUpperCase();
                    if (type === "ЦІЛЕ ЧИСЛО") type = "INTEGER";
                    else if (type === "ДРОБОВЕ ЧИСЛО") type = "REAL";
                    else if (type === "ТЕКСТ") type = "TEXT";
                    else if (type === "ТАК/НІ" || type === "BOOLEAN") type = "INTEGER";
                    else if (type === "ДАТА") type = "TEXT";
                    else if (type === "ЗОБРАЖЕННЯ" || type === "IMAGE") type = "TEXT";
                    else if (type === "ФАЙЛ") type = "BLOB";

                    let def = `"${field.title}" ${type}`;

                    if (field.primaryKey) {
                        if (field.autoInc && type === "INTEGER") {
                            def += " PRIMARY KEY AUTOINCREMENT";
                        } else {
                            def += " PRIMARY KEY";
                        }
                    }

                    return def;
                });

                // Додати FOREIGN KEY (якщо є)
                const foreignKeys = t.schema
                    .filter(f => f.foreignKey && f.refTable && f.refField)
                    .map(f => `FOREIGN KEY ("${f.title}") REFERENCES "${f.refTable}"("${f.refField}")`);

                const fullFields = [...fields, ...foreignKeys].join(", ");
                db.run(`CREATE TABLE "${t.name}" (${fullFields});`);
            }

            // 🔧 відновлюємо subst у схемі (щоб не губився після відновлення)
            t.schema = t.schema.map(f => ({
                ...f,
                subst: f.subst || false,
                autoInc: f.autoInc ?? false
            }));

            // Завантажити дані
            const res = db.exec(`SELECT * FROM "${t.name}"`);
            t.data = res.length ? res[0].values : [];
        });
    } else {
        Message(t("ioFileCorrupted"));
        return;
    }
    console.log("t.data=",database.tables)

    // Load
    database.fileName = selectedDbFile;
    await loadDatabase();

    // 🔄 Автоматично додати зв’язки з foreign key
    database.relations = [];
    database.tables.forEach(table => {
        table.schema.forEach(field => {
            if (field.foreignKey && field.refTable && field.refField) {
                database.relations.push({
                    fromTable: table.name,
                    fromField: field.title,
                    toTable: field.refTable,
                    toField: field.refField,
                    readonly: true,
                });
            }
        });
    });

    database.tables.forEach(t => addTableToMenu(t.name)); // 🔧 Оновити меню "Дані"
    Message(t("ioDbLoaded", selectedDbFile));
    database.fileName = selectedDbFile;
    localStorage.setItem('lastOpenedFile', selectedDbFile);
    closeStorageDialog();
    updateMainTitle();
}

async function exportDTA() {
    const zip = new JSZip();

    // SQLite база
    const dbData = db.export();
    zip.file("database.sqlite", dbData);

    // Запити
    const queriesJson = JSON.stringify(queries.definitions, null, 2);
    zip.file("queries.json", queriesJson);

    // Звіти
    const reportsJson = JSON.stringify(database.reports, null, 2);
    zip.file("reports.json", reportsJson);

    // Результати запитів
    zip.file("query-results.json", JSON.stringify(queries.results || []));

    // Схеми (без data)
    const schemas = database.tables.map(t => ({
        name: t.name,
        schema: t.schema
    }));
    zip.file("schemas.json", JSON.stringify(schemas, null, 2));

    // 🆕 Форми
    const formsJson = JSON.stringify(database.forms || [], null, 2);
    zip.file("forms.json", formsJson);

    // Архів
    const content = await zip.generateAsync({ type: "blob" });
    const filename = (database.fileName || "my_database") + ".dta";

    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = filename;
    a.click();
}


async function importDTA(file) {
    const zip = await JSZip.loadAsync(file);
    const dbFile = await zip.file("database.sqlite").async("uint8array");
    db = new SQL.Database(dbFile);
    database.fileName = file.name.split('.')[0];

    // Запити
    const queriesText = await zip.file("queries.json").async("string");
    queries.definitions = JSON.parse(queriesText);

    // Звіти
    const reportsText = await zip.file("reports.json").async("string");
    database.reports = JSON.parse(reportsText);

    // Результати запитів
    if (zip.file("query-results.json")) {
        const resultsText = await zip.file("query-results.json").async("string");
        queries.results = JSON.parse(resultsText);
    } else {
        queries.results = [];
    }

    // Схеми
    let savedSchemas = [];
    if (zip.file("schemas.json")) {
        const schemasText = await zip.file("schemas.json").async("string");
        savedSchemas = JSON.parse(schemasText);
    }

    // 🆕 Форми
    if (zip.file("forms.json")) {
        console.log("Знайдено форми")
        const formsText = await zip.file("forms.json").async("string");
        database.forms = JSON.parse(formsText);
        // Валідація форм після імпорту
        database.forms = database.forms.map(form => ({
            ...form,
            elements: form.elements.map(el => {
                if (el.type === "field") {
                    return {
                        ...el,
                        tableName: el.tableName || "",
                        fieldName: el.fieldName || ""
                    };
                }
                return el;
            })
        }));
     console.log(database.forms)   
    } else {
        database.forms = [];
    }

    // Відновлення таблиць через sqlite_master + savedSchemas
    database.tables = [];
    syncStoreFilesInDbSetting();
    const res = db.exec("SELECT name, sql FROM sqlite_master WHERE type='table';");
    if (res.length > 0) {
        const tableRows = res[0].values;
        tableRows.forEach(([name, sql]) => {
            if (name.startsWith("sqlite_") || name === "_app_settings") return;

            const savedSchema = savedSchemas.find(s => s.name === name)?.schema;

            let schema = [];
            if (savedSchema) {
                schema = savedSchema;
            } else {
                const match = sql.match(/\((.+)\)/s);
                if (match) {
                    const schemaText = match[1];
                    const schemaParts = schemaText.split(",").map(s => s.trim());
                    schema = schemaParts.map(part => {
                        const [titleRaw, typeRaw, ...rest] = part.split(/\s+/);
                        return {
                            title: titleRaw.replace(/"/g, ''),
                            type: typeRaw === "INTEGER" ? "Ціле число" :
                                  typeRaw === "REAL"    ? "Дробове число" :
                                  typeRaw === "BOOLEAN" ? "Так/Ні" :
                                  typeRaw === "TEXT"    ? "Текст" :
                                  typeRaw === "BLOB"    ? "Файл" : typeRaw,
                            primaryKey: rest.includes("PRIMARY") || rest.includes("PRIMARY KEY"),
                            comment: rest.includes("PRIMARY") ? "Первинний ключ" : ""
                        };
                    });
                }
            }

            const selectRes = db.exec(`SELECT * FROM "${name}"`);
            const dataRows = selectRes.length ? selectRes[0].values : [];

            database.tables.push({
                name,
                schema,
                data: dataRows
            });
        });
    }

    // Оновлення меню
    document.getElementById("data-menu").innerHTML = "";
    database.tables.forEach(t => addTableToMenu(t.name));
    queries.results.forEach(q => addTableToMenu(`*${q.name}`));

    localStorage.setItem('lastOpenedFile', database.fileName);
    saveDatabase();
    Message(t("ioDtaImported"));
    updateMainTitle();
    updateQuickAccessPanel(
        getCurrentTableNames(),
        getCurrentQueryNames(),
        getCurrentReportNames(),
        getCurrentFormNames()
    );
}

// імпорт бази даних SQLite
function importSQLiteDb(file) {

        if (!file) {
            Message(t("ioFileNotSelected"));
            return;
        }

        const reader = new FileReader();
    
        reader.onload = async function(event) {
            const arrayBuffer = event.target.result;
            const uIntArray = new Uint8Array(arrayBuffer);

            try {
                clearDB();
                const importedDb = new SQL.Database(uIntArray);

                const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                const fileName = nameWithoutExt;

                // Зберігаємо файл в IndexedDB
                await idbSave(fileName + ".db-data", uIntArray);
               
                db = importedDb;
                syncStoreFilesInDbSetting();
    
                const res = db.exec("SELECT name, sql FROM sqlite_master WHERE type='table';");
                if (res.length > 0) {
                    const tableRows = res[0].values;
                    tableRows.forEach(([name]) => {
                        if (name.startsWith("sqlite_") || name === "_app_settings") return;
    
                        const pragmaRes = db.exec(`PRAGMA table_info("${name}")`);
                        if (!pragmaRes.length) return;
                        
                        const columns = pragmaRes[0].values;
                        
                        // Зчитуємо зовнішні ключі
                        const fkRes = db.exec(`PRAGMA foreign_key_list("${name}")`);
                        const foreignKeys = fkRes.length ? fkRes[0].values.map(([id, seq, refTable, fromCol, toCol]) => ({
                            fromCol, refTable, toCol
                        })) : [];
                        
                        // Формуємо схему
                        const schema = columns.map(([cid, title, type, notnull, dflt_value, pk]) => {
                            const fk = foreignKeys.find(f => f.fromCol === title);
                            return {
                                title,
                                type: type.toUpperCase() === "INTEGER" ? "Ціле число"
                                    : type.toUpperCase() === "REAL" ? "Дробове число"
                                    : type.toUpperCase().includes("TEXT") ? "Текст"
                                    : type.toUpperCase().includes("BOOL") ? "Так/Ні"
                                    : type.toUpperCase() === "BLOB" ? "Файл"
                                    : type,
                                primaryKey: pk > 0,
                                comment: pk > 0 ? "Первинний ключ" : "",
                                foreignKey: !!fk,
                                refTable: fk ? fk.refTable : null,
                                refField: fk ? fk.toCol : null,
                                subst: false // за замовчуванням
                            };
                        });
    
                        const selectRes = db.exec(`SELECT * FROM "${name}"`);
                        const dataRows = selectRes.length ? selectRes[0].values : [];
                        
                        database.tables.push({
                            name: name,
                            schema: schema,
                            data: dataRows
                        });
                    });
                }
    
                // 🆕 Додати зовнішні ключі до database.relations
                // Спочатку очистимо relations
                database.relations = [];
                
                // Пройдемо по всіх таблицях і зберемо foreign keys
                database.tables.forEach(table => {
                    table.schema.forEach(field => {
                        if (field.foreignKey && field.refTable && field.refField) {
                            // Перевіряємо чи такий зв'язок вже існує
                            const exists = database.relations.some(r =>
                                r.fromTable === table.name &&
                                r.fromField === field.title &&
                                r.toTable === field.refTable &&
                                r.toField === field.refField
                            );
    
                            if (!exists) {
                                database.relations.push({
                                    fromTable: table.name,
                                    fromField: field.title,
                                    toTable: field.refTable,
                                    toField: field.refField,
                                    color: "red",
                                    readonly: true
                                });
                            }
                        }
                    });
                });
    
                database.fileName = fileName;
                saveDatabase();
                
                database.tables.forEach(t => addTableToMenu(t.name));
                updateMainTitle();
                
                Message(t("ioSqliteImported", fileName));
                
                updateQuickAccessPanel(
                    getCurrentTableNames(),
                    getCurrentQueryNames(),
                    getCurrentReportNames(),
                    getCurrentFormNames()
                );
                
            } catch (e) {
                Message(t("ioImportError", e.message));
            }
        };
    
        reader.readAsArrayBuffer(file);
    }
    
// експорт в базу даних SQLite
function exportSQLiteDb() {
        if (!db) {
            Message(t("ioNoActiveDb"));
            return;
        }

        const data = db.export();
        const blob = new Blob([data], {
            type: "application/x-sqlite3"
        });

        // Використовуємо назву з database.fileName або "my_database"
        const fileName = (database.fileName || "my_database") + ".sqlite";

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(a.href);
        a.remove();
    }
/**
 * Імпорт з CVS файлу
 **/ 
// Показати діалог вибору таблиці для імпорту
function showCsvImportDialog() {
    const select = document.getElementById("csvTargetTable");
    select.innerHTML = "";
    database.tables.forEach(table => {
        const option = document.createElement("option");
        option.value = table.name;
        option.textContent = table.name;
        select.appendChild(option);
    });
    document.getElementById("csvImportModal").style.display = "flex";
}

// Відкрити вибір файлу
function proceedCsvImport() {
    closeCsvImportDialog();
    document.getElementById("csvFileInput").value = ""; // Скинути попередній файл
    document.getElementById("csvFileInput").click(); // Відкрити діалог вибору файлу
}

// Обробка вибраного CSV-файлу
function handleCsvFile(file) {
    if (!file) {
        Message(t("ioFileNotSelected"));
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const csvText = event.target.result;
        const lines = csvText.trim().split("\n");

        if (lines.length === 0) {
            Message(t("ioCsvEmpty"));
            return;
        }

        // Визначення роздільника: вибираємо той, що частіше зустрічається в першому рядку
        const firstLine = lines[0];
        const hasSemicolon = (firstLine.split(";").length - 1);
        const hasComma = (firstLine.split(",").length - 1);
        const delimiter = hasSemicolon > hasComma ? ";" : ",";

        // Розбиваємо всі рядки
        const rows = lines.map(line => {
            return line.split(delimiter).map(val => val.trim().replace(/^"(.*)"$/, '$1')); // видаляємо лапки, якщо є
        });

        // Перший рядок — заголовок
        const headerRow = rows[0];
        const dataRows = rows.slice(1); // решта — дані

        if (dataRows.length === 0) {
            Message(t("ioCsvNoData"));
            return;
        }

        // Отримуємо цільову таблицю
        const tableName = document.getElementById("csvTargetTable").value;
        const table = database.tables.find(t => t.name === tableName);
        if (!table) {
            Message(t("ioCsvTableNotFound"));
            return;
        }

        // Перевірка: чи збігаються назви стовпців
        const expectedHeaders = table.schema.map(col => col.title);
        if (headerRow.length !== expectedHeaders.length) {
            Message(t("ioCsvColCountMismatch", headerRow.length, expectedHeaders.length));
            return;
        }

        const mismatch = expectedHeaders.some((expected, i) => headerRow[i] !== expected);
        if (mismatch) {
            Message(t("ioCsvHeaderMismatch"));
            console.log("Очікувано:", expectedHeaders);
            console.log("Отримано:", headerRow);
            return;
        }

        // Перевірка кількості стовпців у даних
        console.log("expectedHeaders,dataRows=",expectedHeaders,dataRows)
        const invalidRow = dataRows.find(row => row.length !== expectedHeaders.length);
        if (invalidRow) {
            Message(t("ioCsvRowColCount", invalidRow.length, expectedHeaders.length));
            return;
        }

        // Перевірка типів даних
        // typeMap використовує внутрішні ключі SCHEMA_TYPE_KEYS
        const isInteger   = val => /^-?\d+$/.test(val);
        const isReal      = val => /^-?\d+(\.\d+)?$/.test(val);
        const isBool      = val => /^(true|false|1|0)$/i.test(val);
        const isAny       = val => true;
        const isDate      = val => !isNaN(Date.parse(val)) || /^\d{4}-\d{2}-\d{2}$/.test(val);
        const typeMap = {
            "integer": isInteger,
            "real": isReal,
            "boolean": isBool,
            "text": isAny,
            "date": isDate,
            "list": isAny,
            "image": isAny,
            "file": isAny,
        };

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            for (let j = 0; j < expectedHeaders.length; j++) {
                const val = row[j];
                const type = table.schema[j].type;
                if (!type in typeMap || !typeMap[type](val)) {
                    Message(t("ioCsvTypeError", i + 1, table.schema[j].title, type, val));
                    return;
                }
            }
        }

        // Усе гаразд — вставляємо дані
        const colNames = table.schema.map(col => `"${col.title}"`).join(", ");
        db.run("BEGIN TRANSACTION");
        try {
            dataRows.forEach(row => {
                const values = row.map(val => `'${val.replace(/'/g, "''")}'`).join(", ");
                const sql = `INSERT INTO "${table.name}" (${colNames}) VALUES (${values})`;
                db.run(sql);
            });
            db.run("COMMIT");
            
            // 🔄 ОНОВЛЕННЯ ДАНИХ У ПАМ'ЯТІ
            try {
                const res = db.exec(`SELECT * FROM "${tableName}"`);
                table.data = res.length ? res[0].values : [];
                console.log("Дані таблиці оновлено в пам'яті:", table.data.length, "записів");
            } catch (e) {
                console.warn("Не вдалося оновити дані в пам'яті:", e);
            }
            
            Message(t("ioCsvInserted", dataRows.length, table.name));
            saveDatabase();           
        } catch (e) {
            db.run("ROLLBACK");
            Message(t("ioCsvInsertError", e.message));
        }
    };

    reader.readAsText(file);
}

/**
 * Експортує вміст таблиці у CSV-файл із назвою "<назва таблиці>.csv".
 * 
 * Структура таблиці:
 * {
 *   name: "Teachers",            // Назва таблиці
 *   schema: [...],              // Масив полів (із назвою, типом, тощо)
 *   data: [[1, "Ім'я"], ...]    // Масив рядків даних
 * }
 *
 * CSV-файл матиме перший рядок — заголовки, далі — значення через роздільник ";"
 * Усі текстові значення будуть обгорнуті в лапки.
 */
function exportTableToCSV() {
    const tableName = selectedTableNameForEdit;
    console.log("CSV name=",tableName);   
    const table = database.tables.find(t => t.name === tableName);
    console.log("CSV table=",table)
    if (!table || !table.name || !table.schema || !table.data) {
        console.error("Неправильна структура таблиці для експорту.");
        return;
    }

    // Отримати назви полів зі схеми
    const headers = table.schema.map(field => field.title);

    // Створити масив рядків CSV, починаючи з заголовків
    const csvRows = [];
    csvRows.push(headers.join(";")); // перший рядок — заголовки

    // Додати дані
    for (const row of table.data) {
        const csvRow = row.map(value => {
            // Якщо значення містить роздільник або лапки — обгорнути в лапки і екранувати лапки
            if (typeof value === "string") {
                const escaped = value.replace(/"/g, '""');
                return `"${escaped}"`;
            }
            return value;
        });
        csvRows.push(csvRow.join(";"));
    }

    // Об’єднати рядки в текст
    const csvContent = csvRows.join("\n");

    // Створити blob і зберегти файл
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const fileName = `${table.name}.csv`;

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Імпорт таблиці з Excel/LO Calc/WPS Spreadsheet через Ctrl+C/Ctrl+V
 **/
function showImportTableDialog() {
  document.getElementById("importTableModal").style.display = "flex";
  document.getElementById("importMsg").style.display = "block";
  const input = document.getElementById("clipboardInput");
  input.value = "";
  input.focus();

  // повторно активуємо фокус при будь-якому кліку / натисканні клавіші
  document.getElementById("importTableModal").addEventListener("click", () => input.focus());
  document.getElementById("importTableModal").addEventListener("keydown", () => input.focus());

  input.onpaste = function(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text");
    renderPreviewTable(text);
  };
}

let importedData = null; // глобально збережені дані після вставки

function renderPreviewTable(text) {
  if (!text.trim()) return;
  const rows = text.trim().split("\n").map(r => r.split("\t"));
  importedData = rows;

  const table = document.createElement("table");
  table.style.fontSize = "10px";
  table.border = "1";
  rows.forEach((row, i) => {
    const tr = document.createElement("tr");
    row.forEach(cell => {
      const td = document.createElement(i === 0 ? "th" : "td");
      td.textContent = cell.trim();
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  const preview = document.getElementById("previewArea");
  preview.innerHTML = "";
  preview.appendChild(table);
  document.getElementById("importMsg").style.display = "none";
}

function confirmImportTable() {
  if (!importedData || importedData.length < 2) {
    Message(t("ioNoImportData"));
    return;
  }

  const headers = importedData[0];
  const sampleRow = importedData[1];

  // Локалізовані назви типів через SCHEMA_TYPES
  const ST = SCHEMA_TYPES;
  const typeText = ST[0];
  const typeInt  = ST[1];
  const typeReal = ST[2];
  const typeDate = ST[4];

  // Визначаємо тип кожного поля за першим рядком даних
  const schema = headers.map((h, i) => {
    const val = (sampleRow[i] || "").trim();
    let type = typeText;
    if (val !== "" && !isNaN(parseInt(val)) && Number.isInteger(Number(val))) type = typeInt;
    else if (val !== "" && !isNaN(parseFloat(val))) type = typeReal;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(val)) type = typeDate;
    return { title: h.trim(), type: type };
  });

  // Зберігаємо схему без PK — користувач обере далі
  window._importSchemaNoPK = schema;
  window._importTypeInt = typeInt; // зберігаємо для saveImportedTable

  // Показуємо вікно підтвердження
  document.getElementById("confirmImportModal").style.display = "flex";
  document.getElementById("importTableName").value = t("importTableName");
  const schemaDiv = document.getElementById("tableSchemaPreview");

  // Рядки попереднього перегляду схеми
  let html = `<table border="1" cellpadding="5" style="border-collapse:collapse;width:100%;">`;
  html += `<thead><tr><th>${t("ioSchemaFieldName")}</th><th>${t("ioSchemaDataType")}</th></tr></thead><tbody>`;
  schema.forEach(f => {
    html += `<tr><td>${f.title}</td><td>${f.type}</td></tr>`;
  });
  html += `</tbody></table>`;
  schemaDiv.innerHTML = html;

  // Будуємо блок вибору ключового поля
  const pkBlock = document.getElementById("importPkChoice");
  if (pkBlock) {
    // Варіанти: наявні поля (тільки integer або text) + опція "додати ID"
    let opts = `<option value="__add_id__">${t("ioAddAutoId")}</option>`;
    schema.forEach((f, i) => {
      const sqlT = typeToSQL(f.type);
      if (sqlT === "INTEGER" || sqlT === "TEXT") {
        opts += `<option value="${i}">${f.title} (${f.type})</option>`;
      }
    });
    pkBlock.innerHTML = `
      <label style="font-weight:bold;">${t("ioPkChoiceLabel")}</label><br>
      <select id="importPkSelect" style="margin-top:4px;width:100%;">${opts}</select>
    `;
  }
}


function closeConfirmImport() {
  document.getElementById("confirmImportModal").style.display = "none";
}

function saveImportedTable() {
  const name = document.getElementById("importTableName").value.trim();
  if (!checkName(name)) return;

  const exists = database.tables.some(t => t.name === name);
  if (exists) {
    Message(t("ioTableExists", name));
    return;
  }

  const typeInt = window._importTypeInt || SCHEMA_TYPES[1];
  const baseSchemaNoPK = window._importSchemaNoPK || [];
  const pkSelect = document.getElementById("importPkSelect");
  const pkChoice = pkSelect ? pkSelect.value : "__add_id__";

  let schema;
  let idWasAdded = false;

  if (pkChoice === "__add_id__") {
    schema = [{ title: "ID", type: typeInt, primaryKey: true, autoInc: true }]
      .concat(baseSchemaNoPK.map(f => ({ ...f })));
    idWasAdded = true;
  } else {
    const pkIdx = parseInt(pkChoice, 10);
    schema = baseSchemaNoPK.map((f, i) => {
      if (i === pkIdx) {
        const sqlT = typeToSQL(f.type);
        return { ...f, primaryKey: true, autoInc: sqlT === "INTEGER" };
      }
      return { ...f };
    });
  }

  // CREATE TABLE
  const fieldsDef = schema.map(f => {
    const sqlType = typeToSQL(f.type);
    let def = `"${f.title}" ${sqlType}`;
    if (f.primaryKey) def += " PRIMARY KEY";
    return def;
  }).join(", ");

  try {
    db.run(`CREATE TABLE "${name}" (${fieldsDef});`);
  } catch(e) {
    Message(t("ioTableCreateError", e.message));
    return;
  }

  // INSERT — завжди передаємо всі колонки явно, включно з ID
  const insertCols = schema.map(f => `"${f.title}"`).join(", ");
  const insertPlaceholders = schema.map(() => "?").join(", ");

  const dataRows = importedData.slice(1);
  dataRows.forEach((row, i) => {
    let insertValues;
    if (idWasAdded) {
      // Явно передаємо ID = i+1, решта — з вихідного рядка
      insertValues = [i + 1, ...baseSchemaNoPK.map((_, colIdx) => {
        const v = (row[colIdx] ?? "").trim();
        return v === "" ? null : v;
      })];
    } else {
      // PK береться з даних як є
      insertValues = schema.map((f, colIdx) => {
        const v = (row[colIdx] ?? "").trim();
        return v === "" ? null : v;
      });
    }
    try {
      db.run(
        `INSERT INTO "${name}" (${insertCols}) VALUES (${insertPlaceholders});`,
        insertValues
      );
    } catch(e) {
      console.warn("INSERT error:", e.message, row);
    }
  });

  // Перечитуємо реальні дані з SQLite
  const newTable = { name, schema, data: [] };
  try {
    const res = db.exec(`SELECT * FROM "${name}"`);
    newTable.data = res.length ? res[0].values : [];
  } catch(e) {
    console.warn("Не вдалося перечитати дані після імпорту:", e);
  }

  database.tables.push(newTable);
  saveDatabase();
  addTableToMenu(name);
  Message(t("ioTableImported"));
  closeImportTableDialog();
  closeConfirmImport();
}
