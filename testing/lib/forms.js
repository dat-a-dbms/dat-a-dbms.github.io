let currentFormRecordIndex = 0; // For form viewer navigation
let selectedFormName = null; // To keep track of the selected form in the saved forms dialog 
let selectedFormField = null;

function confirmDeleteFormRecord(callback) {
    document.getElementById("deleteMessage").innerText = t("formConfirmDeleteRecord");
    const modal = document.getElementById("deleteRowModal");
    const btnConfirm = document.getElementById("confirmDelete");
    const btnCancel = document.getElementById("cancelDelete");

    // Зберігаємо оригінальні обробники
    const origConfirm = btnConfirm.getAttribute("onclick");
    const origCancel = btnCancel.getAttribute("onclick");

    const cleanup = () => {
        btnConfirm.setAttribute("onclick", origConfirm);
        btnCancel.setAttribute("onclick", origCancel);
        modal.style.display = "none";
    };

    btnConfirm.setAttribute("onclick", "");
    btnConfirm.onclick = () => { cleanup(); callback(true); };

    btnCancel.setAttribute("onclick", "");
    btnCancel.onclick = () => { cleanup(); };

    modal.style.display = "block";
}
/**
 * Конструктор форм
 **/
function createForm() {
	if(!isDBExist()) return
        constructorMode = "form";
        createConstructor();
    }

function saveForm() {
        const formName = document.getElementById("formNameInput").value.trim();
        const formCanvas = document.getElementById("formCanvas");

        const elements = [...formCanvas.querySelectorAll('.form-element')].map(el => {
            // Графічні об'єкти
            if (el.classList.contains("form-shape")) {
                return {
                    type:            "shape",
                    shapeType:       el.dataset.shapeType,
                    strokeColor:     el.dataset.strokeColor  || "#333333",
                    fillColor:       el.dataset.fillColor    || "#ffffff",
                    fillTransparent: el.dataset.fillTransparent === "1",
                    left:   el.offsetLeft,
                    top:    el.offsetTop,
                    width:  el.offsetWidth,
                    height: el.offsetHeight,
                };
            }
            // Текстові поля та написи
            const type = el.classList.contains("form-label") ? "label" : "field";
            return {
                type,
                left: el.offsetLeft,
                top: el.offsetTop,
                width: el.offsetWidth,
                height: el.offsetHeight,
                fontFamily: el.style.fontFamily || "Arial",
                fontSize: el.style.fontSize || "16px",
                fontWeight: el.style.fontWeight || "normal",
                fontStyle: el.style.fontStyle || "normal",
                textDecoration: el.style.textDecoration || "",
                color: el.style.color || "#000000",
                text: el.innerText?.trim() || "",
                tableName: el.dataset.tableName || null,
                fieldName: el.dataset.fieldName || null
            };
        });

        const formObject = {
            name: formName,
            elements
        };

        const index = database.forms.findIndex(f => f.name === formName);
        if (index !== -1) database.forms[index] = formObject;
        else database.forms.push(formObject);

        saveDatabase();
        if (typeof isDesignerDirty !== "undefined") isDesignerDirty = false;
        Message(t("formSaved", formName));
}

/**
 * Редагування обраної форми
 **/
function editSelectedForm() {
        if (!selectedFormName) {
            Message(t("formSelectForEdit"));
            return;
        }

        const form = database.forms.find(f => f.name === selectedFormName);
        if (!form) {
            Message(t("formNotFound"));
            return;
        }

        document.getElementById("savedFormsModal").style.display = "none";
        constructorMode = "form";
        screenCanvas = document.getElementById(constructorMode+"Canvas");
        renderCanvas(form);

        document.getElementById("formCreatorModal").style.display = "flex";

        Message(t("formLoadedForEdit", form.name));
}


function showSavedFormsDialog() {
        const listEl = document.getElementById("savedFormsList");
        if (!listEl) {
            console.error("Елемент #savedFormsList не знайдено. Переконайтеся, що modal для збережених форм існує.");
            Message(t("formModalNotFound"));
            return;
        }
        listEl.innerHTML = "";
        selectedFormName = null;

        if (database && database.forms) {
            database.forms.forEach(form => {
                const li = document.createElement("li");
                li.textContent = form.name;
                li.style.padding = "8px";
                li.style.cursor = "pointer";
                li.dataset.formName = form.name;

                li.addEventListener("click", () => {
                    [...listEl.children].forEach(el => el.style.background = "");
                    const isDark = document.body.classList.contains("dark-theme");
                    li.style.background = isDark ? "#242d43" : "#d0e0ff";
                    selectedFormName = li.dataset.formName;
                });
                listEl.appendChild(li);
            });
        }
        document.getElementById("savedFormsModal").style.display = "flex";
    }

function deleteSelectedFormElement() {
      if (!activeElement || !activeElement.classList.contains("form-element")) {
        Message(t("formSelectElementDel"));
        return;
      }
    
      activeElement.remove();
      activeElement = null;
 }    

function closeSavedFormsDialog() {
        const savedFormsModal = document.getElementById("savedFormsModal");
        if (savedFormsModal) {
            savedFormsModal.style.display = "none";
        }
        selectedFormName = null;
}

function previewSelecteForm() {
        if (!selectedFormName) {
            Message(t("formSelectForPreview"));
            return;
        }

        const form = database.forms.find(f => f.name === selectedFormName);
        if (!form) {
            Message(t("formNotFound"));
            return;
        }

        document.getElementById("savedFormsModal").style.display = "none";
        previewForm(form, true);
}

function findTableOrQueryResult(tableName) {
    if (!tableName) return null;
    
    // 1. Шукаємо у звичайних таблицях
    let table = database.tables.find(t => t.name === tableName);
    if (table) return { table, isQuery: false, isDefinition: false };
    
    // 2. Шукаємо у результатах запитів
    const cleanName = tableName.startsWith('*') ? tableName.substring(1) : tableName;
    let queryResult = queries.results.find(q => q.name === cleanName || q.name === `запит "${cleanName.replace(/\*запит "|"/g, '')}"`);
    
    if (queryResult) return { table: queryResult, isQuery: true, isDefinition: false };
    
    // 3. Якщо результатів немає, шукаємо визначення запиту
    const queryDefName = cleanName.replace(/^запит "|"/g, '');
    const queryDef = queries.definitions.find(q => q.name === queryDefName);
    if (queryDef) return { table: queryDef, isQuery: true, isDefinition: true };
    
    return null;
}

function previewForm(form = null, resetIndex = false) {
    // Зберігаємо поточну форму для навігації
    if (form) {
        currentPreviewForm = form;
    }
    const previewModal = document.getElementById("formPreviewModal");
    const previewCanvas = document.getElementById("formPreviewCanvas");
    previewCanvas.innerHTML = "";

    let formName;
    let elements = [];

    // Формуємо elements
    if (form) {
        formName = form.name;
        elements = form.elements.map(el => {
            const base = {
                type: el.type,
                left: el.left + "px",
                top: el.top + "px", 
                width: el.width + "px",
                height: el.height + "px"
            };
            // 🆕 Зберігаємо властивості фігур
            if (el.type === "shape") {
                return {
                    ...base,
                    shapeType: el.shapeType,
                    strokeColor: el.strokeColor,
                    fillColor: el.fillColor,
                    fillTransparent: el.fillTransparent
                };
            }
            // Властивості текстових елементів та полів
            return {
                ...base,
                fontFamily: el.fontFamily || 'Arial',
                fontSize: el.fontSize || '16px',
                fontWeight: el.fontWeight || 'normal',
                fontStyle: el.fontStyle || 'normal',
                textDecoration: el.textDecoration || '',
                color: el.color || '#000',
                textAlign: el.textAlign || 'left',
                tableName: el.tableName,
                fieldName: el.fieldName,
                text: el.text || " "
            };
        });
    } else {
        formName = document.getElementById("formNameInput").value.trim();
        // 🆕 Вибираємо ВСІ елементи форми, включаючи фігури
        elements = [...document.querySelectorAll("#formCanvas .form-element")].map(el => {
            // 🆕 Обробка фігур
            if (el.classList.contains("form-shape")) {
                return {
                    type: "shape",
                    left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height,
                    shapeType: el.dataset.shapeType,
                    strokeColor: el.dataset.strokeColor || "#333333",
                    fillColor: el.dataset.fillColor || "#ffffff",
                    fillTransparent: el.dataset.fillTransparent === "1"
                };
            }
            // Поля та написи
            return {
                type: el.classList.contains("form-field") ? "field" : "label",
                left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height,
                fontFamily: el.style.fontFamily || 'Arial',
                fontSize: el.style.fontSize || '16px',
                fontWeight: el.style.fontWeight || 'normal',
                fontStyle: el.style.fontStyle || 'normal',
                textDecoration: el.style.textDecoration || '',
                color: el.style.color || '#000',
                textAlign: el.style.textAlign || 'left',
                tableName: el.dataset.tableName,
                fieldName: el.dataset.fieldName,
                text: el.innerText?.trim() || " "
            };
        });
    }

    // Перевіряємо на запити
    const usesQueries = elements.some(el => {
        if (!el.tableName) return false;
        const res = findTableOrQueryResult(el.tableName);
        return res?.isQuery === true;
    });

    // Приховуємо кнопки, якщо форма використовує результати запитів
    document.getElementById("frmNewRecord").style.display = usesQueries ? 'none' : 'flex';
    document.getElementById("frmSaveChanges").style.display = usesQueries ? 'none' : 'flex';
    document.getElementById("frmDeleteRecord").style.display = usesQueries ? 'none' : 'flex';

    // ----------------- Логіка з currentFormRecordIndex -----------------
    const formTables = elements.filter(el => el.type === 'field').map(el => el.tableName).filter(Boolean);
    const maxRecordIndex = formTables.length > 0
        ? Math.max(...formTables.map(name => {
            const res = findTableOrQueryResult(name);
            if (res?.isDefinition) return 0;  
            return res?.table?.data?.length || 0;
        })) - 1
        : 0;

    if (resetIndex) currentFormRecordIndex = 0;
    currentFormRecordIndex = Math.min(currentFormRecordIndex, maxRecordIndex < 0 ? 0 : maxRecordIndex);
    const isLastRecord = currentFormRecordIndex === maxRecordIndex;
    let last = "";
    if (isCreatingNewRecord) {
        last = ", new record";
    } else if (isLastRecord) {
        last = ", last record";
    }
    document.getElementById("formPreviewTitle").innerText =
        t("formPreviewTitle", formName, currentFormRecordIndex + 1) + t(last);

    // ----------------- Рендеринг елементів -----------------
    elements.forEach(el => {
        if (el.type === "field") {
            const result = findTableOrQueryResult(el.tableName);
            const fieldContainer = document.createElement("div");
            fieldContainer.className = "form-field";
            Object.assign(fieldContainer.style, {
                position: "absolute",
                left: el.left,
                top: el.top,
                width: el.width,
                height: el.height,
                fontFamily: el.fontFamily,
                fontSize: el.fontSize,
                fontWeight: el.fontWeight,
                fontStyle: el.fontStyle,
                textDecoration: el.textDecoration,
                color: el.color,
                textAlign: el.textAlign || 'left',
                borderStyle: "inset",
                borderWidth: "4px",
                borderColor: "#888",
                overflow: "hidden",
                whiteSpace: "nowrap",
                background: "#f0f0f0",
                display: "flex",
                alignItems: "center",
                justifyContent: el.textAlign === 'center' ? 'center' :
                              el.textAlign === 'right' ? 'flex-end' : 'flex-start',
                paddingLeft: "5px",
                boxSizing: "border-box"
            });
            fieldContainer.dataset.tableName = el.tableName || "";
            fieldContainer.dataset.fieldName = el.fieldName || "";
            
            let cellValue = " ";
            let colSchema = null;
            let colIndex = -1;
            let tableData = null;
            const isReadOnly = result?.isQuery === true; 

            if (!result) {
                cellValue = t("formSourceNotFound");
            } else if (result.isDefinition) {
                try {
                    const res = db.exec(result.table.sql);
                    if (res.length > 0) {
                        const columns = res[0].columns;
                        const dataRows = res[0].values;
                        const schema = columns.map(col => ({ title: col, type: "Текст", primaryKey: false }));
                        
                        const internalName = result.table.name.startsWith('запит "') ? result.table.name : `запит "${result.table.name}"`;
                        const queryResultTable = { name: internalName, schema, data: dataRows };
                        
                        const existingIndex = queries.results.findIndex(t => t.name === internalName);
                        if (existingIndex !== -1) queries.results[existingIndex] = queryResultTable;
                        else queries.results.push(queryResultTable);
                        
                        const newResult = findTableOrQueryResult(el.tableName);
                        if (newResult) {
                            tableData = newResult.table.data;
                            colIndex = newResult.table.schema.findIndex(c => c.title === el.fieldName);
                            colSchema = newResult.table.schema[colIndex];
                            if (colIndex !== -1 && tableData?.length > 0) {
                                const record = tableData[Math.min(currentFormRecordIndex, tableData.length - 1)];
                                cellValue = record?.[colIndex] ?? " ";
                            }
                        }
                    } else {
                        cellValue = t("formQueryNoResult");
                    }
                } catch (e) {
                    cellValue = t("formQueryError", e.message);
                }
            } else {
                const table = result.table;
                tableData = table.data;
                if (!tableData || tableData.length === 0) {
                    cellValue = isReadOnly ? t("formQueryEmpty") : t("formTableEmpty");
                } else {
                    colIndex = table.schema.findIndex(c => c.title === el.fieldName);
                    if (colIndex !== -1) {
                        colSchema = table.schema[colIndex];
                        const record = tableData[Math.min(currentFormRecordIndex, tableData.length - 1)];
                        cellValue = record?.[colIndex] ?? " ";
                        fieldContainer.dataset.colIndex = String(colIndex);
                    } else {
                        cellValue = t("formFieldNotFound");
                    }
                }
            }

            // Логіка рендерингу поля
            if (colSchema && colSchema.type && String(colSchema.type).toLowerCase().includes("image")) {
                if (cellValue instanceof Uint8Array) {
                    const imgData = extractImage(cellValue);
                    if (imgData) {
                        const blob = new Blob([imgData.data], { type: imgData.type });
                        cellValue = URL.createObjectURL(blob);
                    }
                }
                fieldContainer.innerHTML = "";
                const img = document.createElement("img");
                img.src = cellValue || "";
                img.alt = el.fieldName || "";
                Object.assign(img.style, {
                    width: "100%", height: "100%", objectFit: "contain", display: "block",
                    cursor: isReadOnly ? "default" : "pointer"
                });
                
                if (!isReadOnly) {
                    img.addEventListener("click", () => {
                        const storeInDb = localStorage.getItem("app_settings_storeFilesInDb") === "true";
                        if (storeInDb) {
                            const recordIndex = Math.min(currentFormRecordIndex, tableData.length - 1);
                            const currentData = (!result.isQuery && colIndex !== -1 && tableData)
                                ? tableData[recordIndex][colIndex] : null;

                            openFileEditor(currentData instanceof Uint8Array ? currentData : null, (newValue) => {
                                if (!result.isQuery && colIndex !== -1 && tableData) {
                                    tableData[recordIndex][colIndex] = newValue;
                                }
                                if (newValue instanceof Uint8Array && newValue.length > 0) {
                                    const imgData = extractImage(newValue);
                                    if (imgData) {
                                        const blob = new Blob([imgData.data], { type: imgData.type });
                                        if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
                                        img.src = URL.createObjectURL(blob);
                                    }
                                } else { img.src = ""; }
                            });
                        } else {
                            openImageEditor(el.fieldName, cellValue, (newValue) => {
                                img.src = newValue || "";
                                if (!result.isQuery && colIndex !== -1 && tableData) {
                                    const recordIndex = Math.min(currentFormRecordIndex, tableData.length - 1);
                                    tableData[recordIndex][colIndex] = newValue;
                                }
                            });
                        }
                    });
                }
                fieldContainer.appendChild(img);
            } else {
                const control = advDataInput(
                    fieldContainer, cellValue, colSchema,
                    tableData?.[Math.min(currentFormRecordIndex, tableData?.length - 1)],
                    colIndex, isReadOnly
                );
                if (!control) {
                    fieldContainer.textContent = cellValue;
                } else {
                    control.dataset.tableName = fieldContainer.dataset.tableName;
                    control.dataset.fieldName = fieldContainer.dataset.fieldName;
                    control.dataset.colIndex = fieldContainer.dataset.colIndex;
                    if (isReadOnly && control.tagName !== 'BUTTON') {
                        control.setAttribute("readonly", "true");
                        if (control.tagName === 'SELECT' || control.tagName === 'INPUT') control.disabled = true;
                    }
                }
            }
            previewCanvas.appendChild(fieldContainer);

        } else if (el.type === "label") {
            const label = document.createElement("div");
            Object.assign(label.style, {
                position: "absolute", left: el.left, top: el.top,
                width: el.width, height: el.height,
                fontFamily: el.fontFamily, fontSize: el.fontSize,
                fontWeight: el.fontWeight, fontStyle: el.fontStyle,
                textDecoration: el.textDecoration, color: el.color,
                textAlign: el.textAlign || 'left', padding: "5px",
                border: "none", background: "transparent",
                overflow: "hidden", whiteSpace: "nowrap"
            });
            label.innerText = el.text || " ";
            previewCanvas.appendChild(label);

        } else if (el.type === "shape") {
            // 🆕 Рендеринг графічних об'єктів
            const shapeDiv = document.createElement("div");
            shapeDiv.className = `form-shape shape-${el.shapeType}`;
            Object.assign(shapeDiv.style, {
                position: "absolute",
                left: el.left,
                top: el.top,
                width: el.width,
                height: el.height,
                boxSizing: "border-box",
                zIndex: 0,
                pointerEvents: "none"
            });

            const fill = el.fillTransparent ? "transparent" : (el.fillColor || "#ffffff");
            const stroke = el.strokeColor || "#333333";

            if (el.shapeType === "hline") {
                shapeDiv.style.borderTop = `2px solid ${stroke}`;
                shapeDiv.style.backgroundColor = "transparent";
            } else if (el.shapeType === "vline") {
                shapeDiv.style.borderLeft = `2px solid ${stroke}`;
                shapeDiv.style.backgroundColor = "transparent";
            } else if (el.shapeType === "rect" || el.shapeType === "round-rect") {
                shapeDiv.style.border = `2px solid ${stroke}`;
                shapeDiv.style.backgroundColor = fill;
                if (el.shapeType === "round-rect") {
                    shapeDiv.style.borderRadius = "14px";
                }
            }
            previewCanvas.appendChild(shapeDiv);
        }
    });

    previewModal.style.display = "flex";
}


function saveFormChanges() {
    const fields = [...document.querySelectorAll("#formPreviewCanvas .form-field")];

    if (fields.length === 0) {
        Message(t("formNoFields"));
        return;
    }

    // Має бути одна таблиця
    const tableNames = [...new Set(fields.map(f => f.dataset.tableName).filter(Boolean))];
    if (tableNames.length !== 1) {
        Message(t("formMultipleTables"));
        return;
    }

    const tableName = tableNames[0];
    const table = database.tables.find(t => t.name === tableName);
    if (!table) {
        Message(t("formTableNotFound"));
        return;
    }

    // Допоміжні
    const hasValue = v => !(v === undefined || v === null || (typeof v === "string" && v.trim() === ""));
    const toNullIfEmpty = v => (hasValue(v) ? v : null);
    const normType = t => String(t || "").trim().toLowerCase();

    // Збір і нормалізація значень з форми (тільки для полів, що на формі)
    const values = {};
    let allEmpty = true;

    fields.forEach(f => {
        const colIndex =
            Number(f.dataset.colIndex ??
                  (f.querySelector("[data-col-index]")?.dataset.colIndex));
        const colSchema = table.schema[colIndex];
        if (!colSchema) return;

        const control = f.querySelector("input, select, textarea, [contenteditable='true']");
        
        let value;
        
        // --- СПЕЦІАЛЬНА ОБРОБКА: ЗОБРАЖЕННЯ ---
        const fieldType = colSchema ? String(colSchema.type || "").trim().toLowerCase() : "";
        
        if (fieldType === "зображення" || fieldType === "image") {
            const storeInDb = localStorage.getItem("app_settings_storeFilesInDb") === "true";
            if (storeInDb) {
                // Значення вже оновлено напряму в tableData через openFileEditor — беремо звідти
                const recordIndex = Math.min(currentFormRecordIndex, (table.data?.length ?? 1) - 1);
                value = table.data?.[recordIndex]?.[colIndex] ?? null;
            } else {
                const img = f.querySelector("img");
                value = img ? img.src : "";
                // Якщо src — це "default" або порожній — зробити null
                if (!value || value === window.location.href || value === "about:blank" || value === window.location.origin + "/") {
                    value = null;
                }
            }
        }
        // --- ЗВИЧАЙНА ОБРОБКА для інших типів ---
        else if (!control) {
            value = f.textContent ?? "";
        } else if (control.tagName === "SELECT") {
            value = control.value === "empty" ? null : control.value;
        } else if (control.hasAttribute("contenteditable")) {
            value = control.innerText;
        } else {
            value = control.value;
        }        
        
        console.log("value 0=",value)
        const t = normType(colSchema.type);
        console.log("normType=",t)
        if (t === "ціле число" || t === "integer") {
            value = hasValue(value) ? parseInt(value, 10) : null;
            if (Number.isNaN(value)) value = null;
        } else if (t === "дробове число" || t === "real" || t === "float" || t === "numeric") {
            value = hasValue(value) ? Number(value) : null;
            if (Number.isNaN(value)) value = null;
        } else if (t === "так/ні" || t === "boolean") {
            const s = String(value).toLowerCase();
            value = (s === "1" || s === "true" || s === "yes" || s === "on") ? 1 : 0;
        } else if (t === "дата" || t === "date") {
            value = (hasValue(value) && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) ? String(value) : null;
        } else {
            // рядки не повинні перетворюватися на null, якщо це не порожні рядки
            if (typeof value === "string") value = value.trim();
            value = toNullIfEmpty(value);
        }
        
        console.log("value 1=",value)
        const fieldName = f.dataset.fieldName;
        console.log("fieldName =",fieldName )
        if (!fieldName) return;

        values[fieldName] = value;
        if (value !== null && value !== "") allEmpty = false;
    });
    console.log("values=",values)
    if (allEmpty) {
        Message(t("formEmptyRecord"));
        return;
    }

    // Первинний ключ (припускаємо один PK-стовпець)
    const pkIndex = table.schema.findIndex(col => col.primaryKey);
    if (pkIndex === -1) {
        Message(t("formNoPrimaryKey"));
        return;
    }
    const pkCol = table.schema[pkIndex];
    const pkField = pkCol.title;

    // Визначаємо чи PK авто-генерується:
    // 1) явний прапорець autoInc, або
    // 2) тип INTEGER/«ціле число» з PRIMARY KEY у SQLite (SQLite генерує rowid).
    const isIntegerPk = ["integer", "ціле число"].includes(normType(pkCol.type));
    const isAutoPk = !!pkCol.autoInc || isIntegerPk;

    const idx = currentFormRecordIndex ?? 0;
    const pkFromRow = (idx < (table.data?.length ?? 0)) ? table.data[idx]?.[pkIndex] : undefined;

    // Форсований режим: вважаємо новим записом, якщо індекс виходить за межі ТАБ0 є спеціальний прапорець
    const isNewRecordMode = !!isCreatingNewRecord || idx >= (table.data?.length ?? 0);
    
    console.log("isNewRecordMode=",isNewRecordMode,isCreatingNewRecord )
    // Рядок існує, якщо ми не у режимі нового запису і PK є
    const rowExists = !isNewRecordMode && hasValue(pkFromRow);
    let pkValueFromForm = values[pkField];
    
    
console.log("Debug info:", {
    isNewRecordMode,
    currentFormRecordIndex,
    tableDataLength: table.data?.length ?? 0,
    pkFromRow,
    rowExists
});
    // --- Гілка ДОДАВАННЯ ---
    if (!rowExists) {
        console.log("add row from Form")
        if (isAutoPk) {
            // Нехай SQLite згенерує PK — не передаємо його у INSERT
            delete values[pkField];
            pkValueFromForm = undefined;
        } else {
            // Не авто-PK: значення обов'язкове
            if (!hasValue(pkValueFromForm)) {
                Message(t("formPkRequired", pkField));
                return;
            }
            // Перевірка дублювання PK у пам'яті
            const dup = (table.data || []).some(r => String(r?.[pkIndex]) === String(pkValueFromForm));
            if (dup) {
                Message(t("formPkDuplicate", pkField, pkValueFromForm));
                return;
            }
        }
    
        // Формуємо INSERT
        const fieldKeys = Object.keys(values);
        if (fieldKeys.length === 0) {
            db.run(`INSERT INTO "${tableName}" DEFAULT VALUES;`);
        } else {
            const placeholders = fieldKeys.map(() => "?").join(", ");
            const sql = `INSERT INTO "${tableName}" (${fieldKeys.map(f => `"${f}"`).join(", ")}) VALUES (${placeholders});`;
            const params = fieldKeys.map(f => values[f]);
            db.run(sql, params);
        }
    
        // Підтягнути згенерований PK (для авто-PK)
        if (isAutoPk) {
            const r = db.exec(`SELECT last_insert_rowid() AS id;`);
            const newId = r?.[0]?.values?.[0]?.[0] ?? null;
            values[pkField] = newId;
        }
    
        // --- Виправлене формування нового рядка для in-memory ---
        // Перезавантажити таблицю з бази
const refreshResult = db.exec(`SELECT * FROM "${tableName}";`);
if (refreshResult.length > 0) {
    table.data = refreshResult[0].values;
    currentFormRecordIndex = table.data.length - 1;
    console.log("Table refreshed from database, new length:", table.data.length);
} else {
    // Якщо таблиця порожня
    table.data = [];
    currentFormRecordIndex = -1;
}
    
        isCreatingNewRecord = false;
        Message(t("formRecordAdded"));
        saveDatabase();
        return;
    }
    
    

    // --- Гілка РЕДАГУВАННЯ ---
    // Для авто-PK не дозволяємо змінювати PK вручну
    if (isAutoPk) {
        values[pkField] = pkFromRow;
    } else {
        // Якщо користувач змінив PK — перевірка дублювання
        if (hasValue(pkValueFromForm) && String(pkValueFromForm) !== String(pkFromRow)) {
            const dup = (table.data || []).some((r, i) =>
                i !== idx && String(r?.[pkIndex]) === String(pkValueFromForm)
            );
            if (dup) {
                Message(t("formPkDuplicate", pkField, pkValueFromForm));
                return;
            }
        } else {
            // Якщо у формі PK не заданий — лишаємо старий
            values[pkField] = pkFromRow;
        }
    }

    // Оновлюємо лише колонки, що прийшли з форми (без PK, якщо авто-PK)
    const updateKeys = Object.keys(values).filter(k => !(isAutoPk && k === pkField));
    console.log("updateKeys=",updateKeys,values)
    if (updateKeys.length > 0) {
        const setClause = updateKeys.map(k => `"${k}" = ?`).join(", ");
        const params = updateKeys.map(k => values[k]);
        const sql = `UPDATE "${tableName}" SET ${setClause} WHERE "${pkField}" = ?;`;
        db.run(sql, [...params, pkFromRow]);
    }

    // Оновити in-memory
    const row = table.data[idx];
    const colIndexByTitle = Object.fromEntries(table.schema.map((c, i) => [c.title, i]));
    updateKeys.forEach(k => {
        const ci = colIndexByTitle[k];
        if (ci !== undefined) row[ci] = values[k];
    });
    if (!isAutoPk && hasValue(values[pkField])) {
        row[pkIndex] = values[pkField];
    }

    isCreatingNewRecord = false;
    Message(t("formRecordUpdated"));
    saveDatabase();
}

    function goToFirstRecord() {
        isCreatingNewRecord = false;
        currentFormRecordIndex = 0;
        previewForm(currentPreviewForm, false);
    }

    function goToPreviousRecord() {
        isCreatingNewRecord = false;
        currentFormRecordIndex = Math.max(0, currentFormRecordIndex - 1);
        previewForm(currentPreviewForm, false);
    }

    function goToNextRecord() {
        isCreatingNewRecord = false;
        // визначити макс. довжину таблиць
        const tables = database.tables;
        const maxLength = Math.max(...tables.map(t => t.data.length));
        currentFormRecordIndex = Math.min(maxLength - 1, currentFormRecordIndex + 1);
        previewForm(currentPreviewForm, false);
    }

    function goToLastRecord(skipReset = false) {
        if (!skipReset) isCreatingNewRecord = false;
        const tables = database.tables;
        const maxLength = Math.max(...tables.map(t => t.data.length));
        currentFormRecordIndex = maxLength - 1;
        previewForm(currentPreviewForm, false);
    }

function createNewRecord() {
    // зібрати всі таблиці, що використовуються у формі
    const elements = [...document.querySelectorAll("#formCanvas .form-field")];
    const usedTables = [...new Set(elements.map(el => el.dataset.tableName).filter(Boolean))];
    // входимо у режим створення нового запису:
    isCreatingNewRecord = true;
   
    usedTables.forEach(tableName => {
        const table = database.tables.find(t => t.name === tableName);
        if (!table) return;

        // створюємо порожній рядок
        const newRow = table.schema.map(() => "");

        // автопідстановка для PK з autoInc
        table.schema.forEach((col, idx) => {
            if (col && col.primaryKey && col.autoInc) {
                // зібрати всі валідні числові значення по цій колонці
                const nums = (table.data || [])
                    .map(r => r?.[idx])
                    .filter(v => v !== "" && v !== null && v !== undefined)
                    .map(v => Number(v))
                    .filter(n => Number.isFinite(n));

                const maxVal = nums.length ? Math.max(...nums) : 0;
                newRow[idx] = maxVal + 1; // наступне значення
            }
        });

        // додати рядок у дані таблиці
        table.data = table.data || [];
        table.data.push(newRow);
    });

    saveDatabase();
    // перейти до останнього запису (щоб одразу побачити доданий)
    goToLastRecord(true);
}

function deleteFormRecord() {
    // Визначаємо таблицю з першого поля форми
    const fields = [...document.querySelectorAll("#formPreviewCanvas .form-field")];
    const tableNames = [...new Set(fields.map(f => f.dataset.tableName).filter(Boolean))];
    if (tableNames.length !== 1) {
        Message(t("formMultipleTables"));
        return;
    }

    const tableName = tableNames[0];
    const table = database.tables.find(tb => tb.name === tableName);
    if (!table) {
        Message(t("formTableNotFound"));
        return;
    }

    const pkIndex = table.schema.findIndex(col => col.primaryKey);
    if (pkIndex === -1) {
        Message(t("formNoPrimaryKey"));
        return;
    }

    const idx = currentFormRecordIndex ?? 0;
    if (!table.data || table.data.length === 0 || idx >= table.data.length) {
        Message(t("formNoRecordToDelete"));
        return;
    }

    const pkValue = table.data[idx]?.[pkIndex];
    const pkField = table.schema[pkIndex].title;

    confirmDeleteFormRecord((confirmed) => {
        if (!confirmed) return;
        try {
            db.run(`DELETE FROM "${tableName}" WHERE "${pkField}" = ?;`, [pkValue]);
            table.data.splice(idx, 1);
            // Коригуємо індекс, щоб не вийти за межі
            if (table.data.length === 0) {
                currentFormRecordIndex = 0;
            } else {
                currentFormRecordIndex = Math.min(idx, table.data.length - 1);
            }
            saveDatabase();
            Message(t("formRecordDeleted"));
            previewForm(currentPreviewForm, false);
        } catch (e) {
            Message(t("aeditDeleteError", e.message));
        }
    });
}

function deleteSelectedForm() {
        if (!selectedFormName) {
            Message(t("formSelectForDelete"));
            return;
        }
        const formIndex = database.forms.findIndex(q => q.name === selectedFormName);
        if (formIndex !== -1) {
            const deletedFormName = database.forms[formIndex].name;
            database.forms.splice(formIndex, 1); // Remove 
            saveDatabase(); // Save updated

            const dataMenu = document.getElementById("data-menu");

            Message(t("formDeleted", deletedFormName));
            showSavedFormsDialog(); // Refresh the list
        } else {
            Message(t("formNotFoundForDelete"));
        }
}

/**
 * Універсальне модальне вікно підтвердження збереження.
 * onSave   — викликається при натисканні "Зберегти"
 * onClose  — викликається при натисканні "Закрити" (без збереження)
 **/
function showConfirmSave(onSave, onClose) {
    const modal   = document.getElementById("confirmSaveModal");
    const saveBtn = document.getElementById("confirmSaveSaveBtn");
    const closeBtn = document.getElementById("confirmSaveCloseBtn");

    const cleanup = () => { modal.style.display = "none"; };

    saveBtn.onclick = () => { cleanup(); onSave(); };
    closeBtn.onclick = () => { cleanup(); if (onClose) onClose(); };

    modal.style.display = "flex";
}

/**
 * Закриття Конструктора форм.
 * Якщо є незбережені зміни (прапор isDesignerDirty) — питає про збереження.
 **/
function closeFormModal() {
    if (typeof isDesignerDirty !== "undefined" && isDesignerDirty) {
        showConfirmSave(
            () => { saveForm(); _doCloseFormModal(); },
            () => { _doCloseFormModal(); }
        );
    } else {
        _doCloseFormModal();
    }
}

function _doCloseFormModal() {
    document.getElementById("formCreatorModal").style.display = "none";
    if (typeof isDesignerDirty !== "undefined") isDesignerDirty = false;
}

/**
 * Закриття вікна перегляду форми.
 **/
function closeFormPreview() {
    document.getElementById("formPreviewModal").style.display = "none";
}
