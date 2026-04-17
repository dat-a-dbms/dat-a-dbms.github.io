/**
 * Залишаємо тільки зв'язки через FOREIGN KEY
 **/ 
function resetNonReadonlyRelations() {
    if (!Array.isArray(database.relations)) return;
    database.relations = database.relations.filter(r => r.readonly === true);
   
}
 
/** 
 * Ініціалізує створення нового SQL-запиту 
 * Показує модальне вікно конструктора запиту
 **/
function createQuery() {
	if(!isDBExist()) return
    resetNonReadonlyRelations();
    document.getElementById("queryName").value = t("queryDefaultName"); // Назва за замовчуванням
    document.getElementById("queryBody").innerHTML = ""; // Очистити старі рядки
    // Очистити таблицю JOIN-зв'язків
    const joinTable = document.getElementById("joinBody");
    if (joinTable) {
        const tbody = joinTable.querySelector("tbody");
        if (tbody) {
            tbody.innerHTML = ""; // Очистити всі рядки JOIN
        }
        joinTable.style.display = "none"; // Приховати таблицю JOIN
    }
    
    // Очистити базову таблицю (FROM)
    const fromTableSelect = document.getElementById("fromTable");
    if (fromTableSelect) {
        fromTableSelect.value = ""; // Скинути вибір
    }
    addQueryRow(); // Додати перший рядок
    document.getElementById("queryModal").style.display = "flex"; // Показати вікно
    populateTableDropdowns(); // Заповнити випадаючі списки таблиць
    toggleStructureButtonVisibility(true);
}
/** 
 * Додає новий рядок до конструктора запиту
 * Рядок містить вибір таблиці, поля, видимість, сортування, фільтр
 **/
function fillSortSelect(select) {
    [
        { value: "",     key: "sortNone" },
        { value: "ASC",  key: "sortAsc"  },
        { value: "DESC", key: "sortDesc" },
    ].forEach(({ value, key }) => {
        const opt = document.createElement("option");
        opt.value = value;        
        opt.textContent = t(key);
        select.appendChild(opt);
    });
}

function fillOperatorSelect(select) {
    [
        { value: "==",          key: "opEqual"      },
        { value: "<",           key: "opLess"        },
        { value: "<=",          key: "opLessEq"      },
        { value: ">",           key: "opGreater"     },
        { value: ">=",          key: "opGreaterEq"   },
        { value: "!=",          key: "opNotEq"       },
        { value: "LIKE",        key: "opLike"        },
        { value: "IN",          key: "opIn"          },
        { value: "NOT IN",      key: "opNotIn"       },
        { value: "BETWEEN",     key: "opBetween"     },
        { value: "NOT BETWEEN", key: "opNotBetween"  },
    ].forEach(({ value, key }) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = value;
        opt.title = t(key);
        select.appendChild(opt);
    });
}

function fillRoleSelect(select) {
    select.title = t("roleParticipation");
    [
        { value: "select", label: "----",  key: null          },
        { value: "count",  label: "COUNT", key: "roleCount"   },
        { value: "sum",    label: "SUM",   key: "roleSum"     },
        { value: "avg",    label: "AVG",   key: "roleAvg"     },
        { value: "min",    label: "MIN",   key: "roleMin"     },
        { value: "max",    label: "MAX",   key: "roleMax"     },
    ].forEach(({ value, label, key }) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        if (key) opt.title = t(key);
        select.appendChild(opt);
    });
}

function addQueryRow() {
    const tbody = document.getElementById("queryBody");
    const row = document.createElement("tr");
    
    row.innerHTML = `
        <td><select class="query-table-select" onchange="populateFieldDropdown(this)"></select></td>
        <td><select class="query-field-select" onchange="onFieldSelectChange(this)"></select><div class="computed-expr-display" style="display:none; margin-top:4px; font-size:12px; color:#555; cursor:pointer;" onclick="editComputedField(this)"></div></td>
        <td><input type="checkbox" checked class="query-visible-checkbox"></td>
        <td><select class="query-sort-select"></select></td>
        <td>
            <div style="display: flex; gap: 4px; align-items: center;">
                <select class="query-operator-select" style="width: 60px;"></select>
                <input type="text" class="query-criteria-input" style="flex: 1;">
            </div>
        </td>
        <td>
            <select class="query-field-role" onchange="toggleAliasInput(this)"></select>
            <input type="text" class="query-alias-input" style="margin-top:4px; display:none; width:100%;height:1.5em;">
        </td>
        <td><select class="group-field-select"></select></td>
        <td><button onclick="deleteQueryRow(this)">❌</button></td>
    `;

    tbody.appendChild(row);

    fillSortSelect(row.querySelector(".query-sort-select"));
    fillOperatorSelect(row.querySelector(".query-operator-select"));
    fillRoleSelect(row.querySelector(".query-field-role"));

    row.querySelector(".query-alias-input").placeholder = t("queryAlias");

    populateTableDropdownsForRow(row);
}

/**
 * функція для показу/приховування input псевдоніма
 **/
function toggleAliasInput(selectEl) {
    const row = selectEl.closest("tr");
    const aliasInput = row.querySelector(".query-alias-input");
    console.log("toggleAliasInput=",selectEl.value)
    if (selectEl.value !== "select") {
        aliasInput.style.display = "block";
    } else {
        aliasInput.style.display = "none";
        aliasInput.value = "";
    }
}


// ===================== Computed Fields =====================

let computedFieldTargetRow = null; // row that triggered the modal

/**
 * Called when field select changes — opens computed modal if __expr__ selected
 */
function onFieldSelectChange(selectEl) {
    if (selectEl.value === "__expr__") {
        computedFieldTargetRow = selectEl.closest("tr");
        openComputedFieldModal();
    } else {
        // Hide expression display if switching back to normal field
        const row = selectEl.closest("tr");
        const display = row.querySelector(".computed-expr-display");
        if (display) {
            display.style.display = "none";
            display.innerHTML = "";
        }
        // Clear stored computed data
        delete row.dataset.computed;
    }
}

/**
 * Collects tables available in query context (FROM + JOINs)
 */
function getQueryTables() {
    const tables = [];
    const fromTable = document.getElementById("fromTable")?.value;
    if (fromTable) tables.push(fromTable);

    // All tables selected in query rows
    document.querySelectorAll("#queryBody .query-table-select").forEach(sel => {
        if (sel.value && !tables.includes(sel.value)) tables.push(sel.value);
    });

    // JOIN tables
    document.querySelectorAll("#joinBody .join-table-a, #joinBody .join-table-b").forEach(sel => {
        if (sel.value && !tables.includes(sel.value)) tables.push(sel.value);
    });

    // Fallback: all database tables
    if (tables.length === 0) {
        database.tables.forEach(t => tables.push(t.name));
    }

    return tables;
}

// ===================== Expression Builder (computed fields) =====================

/**
 * Builds and injects the Expression Builder modal into the DOM (once).
 */
function ensureExprBuilderModal() {
    console.log("t test:", t("exprSelectTable"));
    if (document.getElementById("exprBuilderModal")) return;

    const modal = document.createElement("div");
    modal.id = "exprBuilderModal";
    modal.style.cssText = `
        display:none; position:fixed; inset:0; z-index:9999;
        align-items:center; justify-content:center;
        background:rgba(0,0,0,0.45);
    `;
    modal.innerHTML = `
        <div class="eb-card">
            <!-- Header: label + alias input + close -->
            <div class="eb-header">
                <span class="eb-header-label">${t("exprBuilderTitle")}</span> 
                <input id="exprBuilderAlias" type="text" class="eb-alias-input"
                    placeholder="${t("queryAlias")}">
                <button class="eb-close-btn" onclick="cancelComputedField()"
                    title="${t("cancel")}">✕</button>
            </div>

            <!-- Expression display -->
            <div id="exprBuilderDisplay" class="eb-display">
                <span class="eb-empty">—</span>
            </div>

            <!-- Toolbar: Add Field | Functions | , | DEL -->
            <div class="eb-toolbar">
                <div class="eb-field-wrap" id="exprFieldDropdownWrap">
                    <button id="exprFieldBtn" class="eb-btn eb-btn-field" onclick="exprShowFieldSelects()">
                        ${t("exprAddFieldBtn")}
                    </button>
                    <div class="eb-field-dropdowns">
                        <select id="exprTableSelect" class="eb-table-select" onchange="exprOnTableChange()"
                            style="display:none;">
                            <option value="">${t("exprSelectTable")}</option>
                        </select>
                        <select id="exprFieldSelect" class="eb-field-select" onchange="exprOnFieldChange()"
                            style="display:none;" disabled>
                            <option value="">${t("exprSelectField")}</option>
                        </select>
                    </div>
                </div>
                <div class="eb-func-wrap" id="exprFuncDropdownWrap">
                    <button class="eb-btn eb-btn-field" onclick="exprToggleFuncMenu()">${t("exprFuncBtn")}</button>
                    <div id="exprFuncMenu" class="eb-func-menu">
                        ${["ABS(","INSTR(","CONCAT(","LENGTH(","SIGN(","SUBSTR(","ROUND(","TRIM(","REPLACE("].map(f=>
                            `<button class="eb-func-item" onclick="exprAddFunc('${f}')">${f}</button>`
                        ).join("")}
                    </div>
                </div>
                <button class="eb-btn eb-btn-op eb-btn-comma" onclick="exprAdd(',')">,</button>
                <button class="eb-btn eb-btn-del" onclick="exprDel()">⌫</button>
            </div>

            <!-- 🔹 Цифрова сітка -->
            <div class="eb-grid">
                ${["7","8","9"].map(v=>`<button class="eb-btn eb-btn-digit" onclick="exprAdd('${v}')">${v}</button>`).join("")}
                <button class="eb-btn eb-btn-op" onclick="exprAdd('*')">*</button>
                <button class="eb-btn eb-btn-op" onclick="exprAdd('%')">%</button>

                ${["4","5","6"].map(v=>`<button class="eb-btn eb-btn-digit" onclick="exprAdd('${v}')">${v}</button>`).join("")}
                <button class="eb-btn eb-btn-op" onclick="exprAdd('/')">/</button>
                <button class="eb-btn eb-btn-op" onclick="exprAdd('(')">(</button>

                ${["1","2","3"].map(v=>`<button class="eb-btn eb-btn-digit" onclick="exprAdd('${v}')">${v}</button>`).join("")}
                <button class="eb-btn eb-btn-op" onclick="exprAdd('+')">+</button>
                <button class="eb-btn eb-btn-op" onclick="exprAdd(')')">)</button>

                <button class="eb-btn eb-btn-digit" onclick="exprAdd('0')">0</button>
                <button class="eb-btn eb-btn-digit" onclick="exprAdd('.')">.</button>
                <button class="eb-btn eb-btn-op"    onclick="exprToggleSign()">+/-</button>
                <button class="eb-btn eb-btn-op"    onclick="exprAdd('-')">-</button>
                <button class="eb-btn eb-btn-ok"    onclick="confirmComputedField()">${t("exprOK")}</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Close FUNC dropdown on outside click
    document.addEventListener("click", function(ev) {
        if (!ev.target.closest("#exprFuncDropdownWrap")) {
            document.getElementById("exprFuncMenu")?.classList.remove("show");
        }
    });
}
// ---- Expression Builder state ----
let _exprValue = "";

function exprToggleFuncMenu() {
    document.getElementById("exprFuncMenu").classList.toggle("show");
}

function _exprTokenize(s) {
    const t = []; let i = 0;
    while (i < s.length) {
        if (/\s/.test(s[i])) { i++; continue; }
        const fieldMatch = s.slice(i).match(/^\[([^\]]+)\]/);
        if (fieldMatch) {
            t.push({ v: fieldMatch[0], t: "field" }); i += fieldMatch[0].length; continue;
        }
        if (/[A-Z_]/i.test(s[i])) {
            const m = s.slice(i).match(/^[A-Z_]+/i);
            if (m && s[i + m[0].length] === "(") { t.push({ v: m[0], t: "func" }); i += m[0].length; }
            else { t.push({ v: s[i], t: "text" }); i++; }
            continue;
        }
        if (/[0-9.]/.test(s[i])) {
            let n = ""; while (i < s.length && /[0-9.]/.test(s[i])) { n += s[i]; i++; }
            t.push({ v: n, t: "num" }); continue;
        }
        if ("()+-*/%".includes(s[i])) { t.push({ v: s[i], t: s[i] === "(" || s[i] === ")" ? "paren" : "op" }); i++; continue; }
        if (s.slice(i, i+2) === "&&") { t.push({ v: "&&", t: "op" }); i += 2; continue; }
        t.push({ v: s[i], t: "text" }); i++;
    }
    return t;
}

function _exprHighlight(s) {
    if (!s) return `<span class="eb-empty">—</span>`;
    return _exprTokenize(s).map(tk => {
        const sp = document.createElement("span");
        sp.textContent = tk.v;
        sp.className = "hl-" + tk.t;
        return sp.outerHTML;
    }).join("");
}

function _exprValidate(s) {
    const errs = []; let bal = 0; const ops = "+-*/%";
    const fns = ["SUM","AVG","COUNT","MIN","MAX","IF","ROUND","LEN","CONCAT"];
    let prev = null;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === "(") bal++;
        else if (c === ")") { bal--; if (bal < 0) errs.push(t("exprErrExtraParen")); }
        if (ops.includes(c) && ops.includes(prev)) errs.push(t("exprErrDoubleOperator"));
        prev = c;
    }
    if (bal > 0) errs.push(t("exprErrUnclosedParen"));
    if (s && ops.includes(s.slice(-1))) errs.push(t("exprErrEndsWithOperator"));
    return errs;
}

function _exprUpdate() {
    const disp = document.getElementById("exprBuilderDisplay");
    if (!disp) return;
    disp.innerHTML = _exprValue
        ? _exprHighlight(_exprValue)
        : `<span class="eb-empty">—</span>`;
    const errs = _exprValidate(_exprValue);
    disp.classList.toggle("eb-err", errs.length > 0);
    disp.classList.toggle("eb-ok",  !errs.length && !!_exprValue);
}

function exprAdd(s) {
    _exprValue += s;
    _exprUpdate();
    //document.getElementById("exprFieldMenu").style.display = "none";
    //document.getElementById("exprFuncMenu").style.display = "none";
}

function exprAddField(tableField) {
    _exprValue += `[${tableField}]`;
    _exprUpdate();
}

function exprAddFunc(f) {
    _exprValue += f;
    _exprUpdate();
    document.getElementById("exprFuncMenu")?.classList.remove("show");
}

function exprDel() {
	console.log("DEL-",document.getElementById("exprFieldBtn").style.display)
	if (document.getElementById("exprFieldBtn").style.display == "none") {
		_exprHideFieldSelects()
	}
    if (!_exprValue) return;
    // Delete bracketed field token as unit
    const fieldMatch = _exprValue.match(/\[[^\]]+\]$/);
    if (fieldMatch) { _exprValue = _exprValue.slice(0, -fieldMatch[0].length); _exprUpdate(); return; }
    // Delete function name before (
    if (/[A-Z_]+\($/i.test(_exprValue)) { _exprValue = _exprValue.replace(/[A-Z_]+\($/i, ""); _exprUpdate(); return; }
    // Delete operator / paren
    if ("()+-*/%".includes(_exprValue.slice(-1))) { _exprValue = _exprValue.slice(0,-1); _exprUpdate(); return; }
    // Delete number digit by digit
    _exprValue = _exprValue.slice(0, -1);
    _exprUpdate();
}

function exprToggleSign() {
    const m = [..._exprValue.matchAll(/(?:^|(?<=[+\-*\/%(]))(-?)(\d+(?:\.\d+)?)/g)];
    if (!m.length) return;
    const last = m[m.length - 1];
    const st = last.index;
    const neg = _exprValue[st] === "-";
    _exprValue = neg ? _exprValue.slice(0, st) + _exprValue.slice(st + 1) : _exprValue.slice(0, st) + "-" + _exprValue.slice(st);
    _exprUpdate();
}

/**
 * Show table+field selects in place of the "Додати поле" button
 */
function exprShowFieldSelects() {
    document.getElementById("exprFieldBtn").style.display = "none";
    const tableSelect = document.getElementById("exprTableSelect");
    tableSelect.style.display = "";
    tableSelect.value = "";
    const fieldSelect = document.getElementById("exprFieldSelect");
    fieldSelect.style.display = "";
    fieldSelect.innerHTML = `<option value="">${t("exprSelectField")}</option>`;
    fieldSelect.disabled = true;
    //fieldSelect.style.opacity = "0.5";
}

/**
 * Restore "Додати поле" button, hide selects
 */
function _exprHideFieldSelects() {
    document.getElementById("exprFieldBtn").style.display = "";
    document.getElementById("exprTableSelect").style.display = "none";
    document.getElementById("exprFieldSelect").style.display = "none";
}

/**
 * Populate the table <select> with all query tables
 */
function _exprPopulateFieldMenu() {
    const tableSelect = document.getElementById("exprTableSelect");
    const fieldSelect = document.getElementById("exprFieldSelect");
    if (!tableSelect || !fieldSelect) return;

    // Reset table select options (keep hidden)
    tableSelect.innerHTML = `<option value="">${t("exprSelectTable")}</option>`;
    getQueryTables().forEach(name => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        tableSelect.appendChild(opt);
    });

    // Reset field select
    fieldSelect.innerHTML = `<option value="">${t("exprSelectField")}</option>`;
    fieldSelect.disabled = true;
    // /fieldSelect.style.opacity = "0.5";

    // Ensure button is visible, selects hidden
    _exprHideFieldSelects();
}

/**
 * Called when table select changes — populate field select
 */
function exprOnTableChange() {
    const tableSelect = document.getElementById("exprTableSelect");
    const fieldSelect = document.getElementById("exprFieldSelect");
    const tableName = tableSelect.value;

    fieldSelect.innerHTML = `<option value="">${t("exprSelectField")}</option>`;

    if (!tableName) {
        fieldSelect.disabled = true;
        //fieldSelect.style.opacity = "0.5";
        return;
    }

    const table = database.tables.find(tb => tb.name === tableName);
    if (!table) return;

    table.schema.forEach(field => {
        const opt = document.createElement("option");
        opt.value = field.title;
        opt.textContent = field.title;
        fieldSelect.appendChild(opt);
    });

    fieldSelect.disabled = false;
    //fieldSelect.style.opacity = "1";
}

/**
 * Called when field select changes — insert [TABLE.FIELD] token, restore button
 */
function exprOnFieldChange() {
    const tableSelect = document.getElementById("exprTableSelect");
    const fieldSelect = document.getElementById("exprFieldSelect");
    const tableName = tableSelect.value;
    const fieldName = fieldSelect.value;
    if (!tableName || !fieldName) return;

    exprAddField(`${tableName}.${fieldName}`);
    _exprHideFieldSelects();
}

/**
 * Opens the Expression Builder modal
 */
function openComputedFieldModal() {
    ensureExprBuilderModal();
    _exprPopulateFieldMenu();

    // Restore from existing computed data or reset
    if (computedFieldTargetRow && computedFieldTargetRow.dataset.computed) {
        const c = JSON.parse(computedFieldTargetRow.dataset.computed);
        _exprValue = c.expr || "";
        document.getElementById("exprBuilderAlias").value = c.alias || "";
    } else {
        _exprValue = "";
        document.getElementById("exprBuilderAlias").value = "";
    }
    _exprUpdate();

    document.getElementById("exprBuilderModal").style.display = "flex";
}

/**
 * Confirms the expression, stores on row as { expr, alias }
 */
function confirmComputedField() {
    const alias = document.getElementById("exprBuilderAlias").value.trim();
    if (!alias) {
        Message(t("computedAliasRequired"));
        return;
    }
    if (!_exprValue) {
        Message(t("exprErrEmpty"));
        return;
    }
    const errs = _exprValidate(_exprValue);
    if (errs.length) {
        Message(t("exprErrPrefix") + errs[0]);
        return;
    }
    if (!computedFieldTargetRow) return;

    const computed = { expr: _exprValue, alias };
    computedFieldTargetRow.dataset.computed = JSON.stringify(computed);

    // Show alias as label, full expression as tooltip
    const display = computedFieldTargetRow.querySelector(".computed-expr-display");
    display.innerHTML = `<span title="${_exprValue}" style="cursor:pointer;">⚡ ${alias}</span>`;
    display.style.display = "flex";

    document.getElementById("exprBuilderModal").style.display = "none";
    computedFieldTargetRow = null;
}

/**
 * Cancels the Expression Builder — revert select if no prior data
 */
function cancelComputedField() {
    if (computedFieldTargetRow && !computedFieldTargetRow.dataset.computed) {
        const fieldSelect = computedFieldTargetRow.querySelector(".query-field-select");
        fieldSelect.value = fieldSelect.options[0]?.value || "";
    }
    document.getElementById("exprBuilderModal").style.display = "none";
    computedFieldTargetRow = null;
}

/**
 * Edit an existing computed field (click on the display label)
 */
function editComputedField(displayEl) {
    computedFieldTargetRow = displayEl.closest("tr");
    openComputedFieldModal();
}
// ===================== End Expression Builder =====================

/**
 * Видаляє рядок з конструктора запиту
 * Параметр:
 *   button — кнопка ❌, яка викликала подію
 **/
function deleteQueryRow(button) {
    const row = button.closest("tr"); // Знайти відповідний рядок
    row.remove(); // Видалити рядок
}

/** 
 * Заповнює всі випадаючі списки таблиць у конструкторі запиту
 **/
function populateTableDropdowns() {
    const tableSelects = document.querySelectorAll(".query-table-select"); // Всі селекти таблиць
    
    tableSelects.forEach(select => {
        console.log("Заповнюється:", select.id);
        select.innerHTML = "<option value=''>" + t("querySelectTable") + "</option>"; // Початковий варіант
        database.tables.forEach(table => {
            const option = document.createElement("option");
            option.value = table.name;
            option.textContent = table.name;
            select.appendChild(option); // Додати назву таблиці
        });
    });
}

/**
 * Заповнює список таблиць у конкретному рядку конструктора запиту
 * Параметр:
 *   row — рядок, у якому потрібно заповнити список
 **/
function populateTableDropdownsForRow(row) {
    const select = row.querySelector(".query-table-select");
    select.innerHTML = "<option value=''>" + t("querySelectTable") + "</option>";
    database.tables.forEach(table => {
        const option = document.createElement("option");
        option.value = table.name;
        option.textContent = table.name;
        select.appendChild(option);
    });
}


/** 
 * Заповнює список полів таблиці на основі вибраної таблиці
 * Параметр:
 *   tableSelect — select-елемент з вибраною таблицею
 **/
function populateFieldDropdown(tableSelect) {
    const row = tableSelect.closest("tr");
    if (!row) {
        console.error("populateFieldDropdown: викликано з елемента поза <tr>", tableSelect);
        return;
    }

    const fieldSelect = row.querySelector(".query-field-select");
    const groupSelect = row.querySelector(".group-field-select");

    if (!fieldSelect || !groupSelect) {
        console.error("populateFieldDropdown: не знайдено fieldSelect або groupSelect у рядку", row);
        return;
    }

    // Далі код без змін...
    fieldSelect.innerHTML = "";
    groupSelect.innerHTML = "";
    const selectedTableName = tableSelect.value;
    if (!selectedTableName) {
        fieldSelect.disabled = true;
        return;
    }

    const selectedTable = database.tables.find(t => t.name === selectedTableName);
    if (!selectedTable) return;

    fieldSelect.disabled = false;
    groupSelect.disabled = false;

    // Додати опцію "* (всі поля)" на початок
    const starOption = document.createElement("option");
    starOption.value = "*";
    starOption.textContent = t("queryAllField");
    fieldSelect.appendChild(starOption);

    // Додати реальні поля таблиці
    selectedTable.schema.forEach(field => {
        const option = document.createElement("option");
        option.value = field.title;
        option.textContent = field.title;
        fieldSelect.appendChild(option);
    });

    // Додати опцію "Обчислення"
    const exprSep = document.createElement("option");
    exprSep.disabled = true;
    exprSep.textContent = "──────────";
    fieldSelect.appendChild(exprSep);
    const exprOption = document.createElement("option");
    exprOption.value = "__expr__";
    exprOption.textContent = "⚡ " + t("computedFieldOption");
    fieldSelect.appendChild(exprOption);

    const startOption = document.createElement("option");
    startOption.value = "";
    startOption.textContent = "----";
    groupSelect.appendChild(startOption);

    selectedTable.schema.forEach(field => {
        const option = document.createElement("option");
        option.value = field.title;
        option.textContent = field.title;        
        groupSelect.appendChild(option);
    });
}



/** 
 * Повертає тип поля у вказаній таблиці
 * Параметри:
 *   tableName — назва таблиці
 *   fieldName — назва поля
 * Повертає: тип поля або порожній рядок
 */
function getFieldType(tableName, fieldName) {
    console.log("getFieldType=", database); // Діагностика
    const table = database.tables.find(t => t.name === tableName); // Знайти таблицю
    if (!table) return ""; // Якщо не знайдено — повернути ""
    const field = table.schema.find(f => f.title === fieldName); // Знайти поле
    console.log("getFieldType Field=", field); // Діагностика
    return field?.type || ""; // Повернути тип або "" якщо нема
}

//**************************************************************************
function isParameterPlaceholder(v) {
    return /^\[.*\]$/.test(v.trim());
}
    
function generateSqlQuery() {
    const queryName = document.getElementById("queryName").value.trim();
    if (queryName==="") {
		Message(t("queryNoName"));
		return
	}
    const rows = document.querySelectorAll("#queryBody tr");

    let selectFields = [];
    let groupByFields = [];
    let baseTable = null;
    const fromTableEl = document.getElementById("fromTable");
    
    if (fromTableEl && fromTableEl.value.trim() !== "") {
        baseTable = fromTableEl.value.trim();
    } else {
        baseTable = null;
    }
    let joins = [];
    let whereClauses = [];
    let orderByClauses = [];
    const queryConfig = [];

    let hasSelect = false;
    let hasAggregate = false;
    let aggregateAliasCounter = 0;

    // --- helpers ---
    const sqlQuote = (s) => `'${String(s).replace(/'/g, "''")}'`;
    const parseList = (raw) => {
        if (!raw) return [];
        let s = raw.trim();
        if (s.startsWith("(") && s.endsWith(")")) s = s.slice(1, -1);
        return s.split(",").map(v => v.trim()).filter(v => v.length);
    };
    const isNumericLiteral = (v) => /^-?\d+(?:\.\d+)?$/.test(String(v).trim());
    const toIsoDate = (v) => {
        const s = String(v).trim();
        let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        m = s.match(/^(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})$/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`;
        return s;
    };
    const formatLiteral = (v, fieldType) => {
        const raw = String(v).trim().replace(/^'(.*)'$/, "$1");
        if (fieldType === "Дата") return sqlQuote(toIsoDate(raw));
        if (fieldType === "Так/Ні") {
            const L = raw.toLowerCase();
            if (["так","true","1"].includes(L)) return "1";
            if (["ні","false","0"].includes(L)) return "0";
            return isNumericLiteral(raw) ? raw : sqlQuote(raw);
        }
        return isNumericLiteral(raw) ? raw : sqlQuote(raw);
    };

    rows.forEach(row => {
        const tableName = row.querySelector(".query-table-select").value;
        const fieldName = row.querySelector(".query-field-select")?.value || "";
        const groupName = row.querySelector(".group-field-select")?.value || "";
        const isVisible = row.querySelector(".query-visible-checkbox").checked;
        const sortBy = row.querySelector(".query-sort-select").value;
        const operator = row.querySelector(".query-operator-select").value.trim();
        const criteria = row.querySelector(".query-criteria-input").value.trim();
        const fieldRole = row.querySelector(".query-field-role").value;
        let alias = row.querySelector(".query-alias-input").value.trim();

        if (!tableName || (!fieldName && fieldName !== "*")) return;
        if (!baseTable && tableName !== "*") baseTable = tableName;

        // --- Computed expression ---
        let computedData = null;
        if (fieldName === "__expr__" && row.dataset.computed) {
            computedData = JSON.parse(row.dataset.computed);
        }

        let fieldExpr = fieldName === "*"
            ? `"${tableName}".*`
            : fieldName === "__expr__" ? null
            : `"${tableName}"."${fieldName}"`;

        // --- SELECT ---
        let selectExpr = "";
        if (fieldName === "__expr__" && computedData) {
            // New Expression Builder format: { expr, alias }
            // Replace [TABLE.FIELD] tokens with "TABLE"."FIELD"
            let sqlExpr = computedData.expr.replace(/\[([^\]]+)\]/g, (_, tf) => {
                const dot = tf.indexOf(".");
                if (dot === -1) return `"${tf}"`;
                const tbl = tf.slice(0, dot);
                const fld = tf.slice(dot + 1);
                return `"${tbl}"."${fld}"`;
            });
            selectExpr = `(${sqlExpr}) AS "${computedData.alias}"`;
            alias = computedData.alias;
            hasSelect = true;
        } else if (fieldName === "*") {
            selectExpr = fieldExpr;
            hasSelect = true;
        } else {
            switch (fieldRole) {
                case "count":
                case "sum":
                case "avg":
                case "min":
                case "max":
                    if (!alias) alias = `${fieldRole}_${aggregateAliasCounter++}`;
                    selectExpr = `${fieldRole.toUpperCase()}(${fieldExpr}) AS ${alias}`;
                    hasAggregate = true;
                    break;
                case "select":
                default:
                    selectExpr = alias ? `${fieldExpr} AS ${alias}` : fieldExpr;
                    hasSelect = true;
                    break;
            }
        }
        if (isVisible && selectExpr) selectFields.push(selectExpr);

        // --- GROUP BY ---
        if (groupName) {
            const expr = `"${tableName}"."${groupName}"`;
            if (!groupByFields.includes(expr)) {
                groupByFields.push(expr);
            }
        }

        // --- WHERE ---
        if (fieldName !== "*" && fieldName !== "__expr__" && operator) {
            const fieldType = getFieldType(tableName, fieldName);
            const op = operator.toUpperCase();
            if (op === "IS NULL" || op === "IS NOT NULL") {
                whereClauses.push(`${fieldExpr} ${op}`);
            } else if (op === "IN" || op === "NOT IN") {
                const items = parseList(criteria);
                const values = items.map(v => formatLiteral(v, fieldType));
                if (values.length) whereClauses.push(`${fieldExpr} ${op} (${values.join(", ")})`);
            } else if (op.includes("BETWEEN")) {
                const parts = criteria.split(/\s+AND\s+/i);
                if (parts.length === 2) {
                    const left = formatLiteral(parts[0], fieldType);
                    const right = formatLiteral(parts[1], fieldType);
                    whereClauses.push(`${fieldExpr} ${op} ${left} AND ${right}`);
                }
            } else if (criteria) {
                let right = isParameterPlaceholder(criteria)
                    ? criteria
                    : formatLiteral(criteria, fieldType);
                whereClauses.push(`${fieldExpr} ${op} ${right}`);
            }
        }

        // --- ORDER BY ---
        if (sortBy) {
            if (alias) orderByClauses.push(`${alias} ${sortBy}`);
            else if (fieldName !== "*") orderByClauses.push(`${fieldExpr} ${sortBy}`);
        }

        // --- save config row ---
        const configRow = {
            tableName, fieldName, isVisible,
            sortBy, operator, criteria,
            fieldRole, alias, groupName
        };
        if (computedData) configRow.computed = computedData;
        queryConfig.push(configRow);
    });

    // --- JOIN ---
    const joinRows = document.querySelectorAll("#joinBody tbody tr");
    joinRows.forEach(row => {
        const tableA = row.querySelector(".join-table-a").value;
        const fieldA = row.querySelector(".join-field-a").value;
        const tableB = row.querySelector(".join-table-b").value;
        const fieldB = row.querySelector(".join-field-b").value;
        if (tableA && fieldA && tableB && fieldB) {
            joins.push({
                table: tableA,
                condition: `"${tableA}"."${fieldA}" = "${tableB}"."${fieldB}"`
            });
            if (!baseTable) baseTable = tableA;
        }
    });

    if (selectFields.length === 0) {
        Message(t("queryNoVisibleFields"));
        return;
    }
    if (!baseTable) {
        if (joins.length > 0) baseTable = joins[0].table;
        else {
            Message(t("queryNoBaseTable"));
            return;
        }
    }

    // --- SQL ---
    let sql = `SELECT ${selectFields.join(", ")}\nFROM "${baseTable}"`;
    joins.forEach(join => sql += `\nJOIN "${join.table}" ON ${join.condition}`);
    if (whereClauses.length) sql += `\nWHERE ${whereClauses.join(" AND ")}`;
    if (groupByFields.length) sql += `\nGROUP BY ${groupByFields.join(", ")}`;
    if (orderByClauses.length) sql += `\nORDER BY ${orderByClauses.join(", ")}`;

    // --- save query ---
    const queryDefinition = { name: queryName, baseTable: baseTable, config: queryConfig, joins, sql };
    const existingQueryIndex = queries.definitions.findIndex(q => q.name === queryName);
    if (existingQueryIndex !== -1) queries.definitions[existingQueryIndex] = queryDefinition;
    else queries.definitions.push(queryDefinition);
    saveDatabase();
    console.log("queryConfig=",queryDefinition)
    return { sql, queryName };
}

/**
 * Зберігає сконструйований запит БЕЗ виконання
 */
function saveQueryOnly() {
    const result = generateSqlQuery();
    if (result) {
        Message(t("querySaved"));
    }
}
function viewSQL() {
    const result = generateSqlQuery();
    if (result) {
        Message(result.sql, true);
    }
}
/**
 * Зберігає сконструйований запит і одразу виконує його
 */
function saveAndRunQuery() {
    const result = generateSqlQuery();
    if (result) {
        runSqlQuery(result.sql, result.queryName);
    }
}

    let pendingQueryText = "";
    let pendingPlaceholders = [];
    let pendingQueryName = "";
    let currentPlaceholderIndex = 0;
    
    function showNextParameterPrompt() {
        if (currentPlaceholderIndex >= pendingPlaceholders.length) {
            runFinalSqlQuery();
            return;
        }
    
        const placeholder = pendingPlaceholders[currentPlaceholderIndex];
        document.getElementById("parameterPrompt").innerText = placeholder;
        document.getElementById("parameterInput").value = "";
        document.getElementById("parameterModal").style.display = "flex";
    }
    
    function confirmParameter() {
        const value = document.getElementById("parameterInput").value;
        const placeholder = pendingPlaceholders[currentPlaceholderIndex];
        const safeValue = `'${value.replace(/'/g, "''")}'`;
    
        pendingQueryText = pendingQueryText.replace(`[${placeholder}]`, safeValue);
        currentPlaceholderIndex++;
        document.getElementById("parameterModal").style.display = "none";
        showNextParameterPrompt();
    }
    
    function cancelParameter() {
        document.getElementById("parameterModal").style.display = "none";
        Message(t("queryCancelled"));
    }
    


/**
 * Виконати користувацький SQL-запит
 **/
function executeOwnSQL() {
    sqlQuery = document.getElementById("ownSqlInput").value.trim();
    queryName = document.getElementById("ownSQLName").value.trim();
    if (!saveOwnSQLquery()) {
        Message(t("queryNotSaved"))
        }
    isOwnSQL = true;
    runSqlQuery(sqlQuery, queryName);
    
}    

function runSqlQuery(sqlQuery, queryName) {
    pendingQueryName = queryName;
    console.log("runSqlQuery")
    const matches = [...sqlQuery.matchAll(/\[([^\]]+)\]/g)];
    const uniquePlaceholders = [...new Set(matches.map(m => m[1]))];
    
    if (uniquePlaceholders.length > 0) {
            pendingQueryText = sqlQuery;
            pendingPlaceholders = uniquePlaceholders;
            currentPlaceholderIndex = 0;
            showNextParameterPrompt();
        } else {
            pendingQueryText = sqlQuery;
            runFinalSqlQuery();
        }
    }

function updateDatabaseTables() {
    // Очистимо список, щоб не дублювати
    database.tables = [];

    const res = db.exec("SELECT name, sql FROM sqlite_master WHERE type='table';");
    if (res.length > 0) {
        const tableRows = res[0].values;
        tableRows.forEach(([name]) => {
            if (name.startsWith("sqlite_")) return;

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
                        : type,
                    primaryKey: pk > 0,
                    comment: pk > 0 ? "Первинний ключ" : "",
                    foreignKey: !!fk,
                    refTable: fk ? fk.refTable : null,
                    refField: fk ? fk.toCol : null
                };
            });

            // Зчитуємо дані
            const selectRes = db.exec(`SELECT * FROM "${name}"`);
            const dataRows = selectRes.length ? selectRes[0].values : [];

            database.tables.push({
                name: name,
                schema: schema,
                data: dataRows
            });
        });
    }
}

function runFinalSqlQuery() {
    const internalQueryName = `запит "${pendingQueryName}"`;
    const menuDisplayName = `*${internalQueryName}`;

    try {
        const isAggregateQuery = /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(pendingQueryText);
        const res = db.exec(pendingQueryText); 
        
        if (isOwnSQL) { // оновимо про всяк випадок таблиці та їх структури якщо запит "вручну"
                    updateDatabaseTables();
                    isOwnSQL = false;
        }
        
        if (res.length > 0) {
            const columns = res[0].columns;
            const dataRows = res[0].values;

            const schema = columns.map(col => ({
                title: col,
                type: "Текст",
                primaryKey: false,
                comment: ""
            }));

            const queryResultTable = {
                name: internalQueryName,
                schema: schema,
                data: dataRows
            };

            const existingIndex = queries.results.findIndex(t => t.name === internalQueryName);
            if (existingIndex !== -1) {
                queries.results[existingIndex] = queryResultTable;
                const dataMenu = document.getElementById("data-menu");
                const existingItem = Array.from(dataMenu.children).find(item => item.textContent === menuDisplayName);
                if (existingItem) existingItem.remove();
            } else {
                queries.results.push(queryResultTable);
            }
            
            addTableToMenu(menuDisplayName);

            closeOwnSqlModal();
            editData(menuDisplayName);
        } else {
            Message(t("queryEmptyResult"));
        }
        updateQuickAccessPanel(
                  getCurrentTableNames(),
                  getCurrentQueryNames(),
                  getCurrentReportNames(),
                  getCurrentFormNames()
                );  
    } catch (e) {
        Message(t("queryRunError", e.message));
    }
    

}

/**
 * Перевиконує всі запити, результати яких використовуються в переданих елементах
 * форми або звіту (поля типу "field" та "table" з посиланням на результат запиту).
 * Викликається перед рендерингом форм/звітів, щоб дані були актуальними.
 *
 * @param {Array} elements — масив елементів форми/звіту (як у previewForm / previewReport)
 */
function refreshQueriesUsedInElements(elements) {
    if (!Array.isArray(elements)) return;

    // Збираємо унікальні внутрішні імена запитів вигляду `запит "queryName"`
    const querySourceNames = new Set();

    elements.forEach(el => {
        if (!el) return;
        if (el.type !== "field" && el.type !== "table") return;
        const sourceName = el.tableName || null;
        if (!sourceName) return;

        // Варіант 1: ім'я вже у форматі `запит "..."` (збережене в елементі)
        if (/^запит ".+"$/.test(sourceName)) {
            querySourceNames.add(sourceName);
            return;
        }

        // Варіант 2: ім'я з префіксом `*запит "..."` (з меню даних)
        if (/^\*запит ".+"$/.test(sourceName)) {
            querySourceNames.add(sourceName.substring(1));
            return;
        }

        // Варіант 3: перевіряємо через findTableOrQueryResult (результат вже є)
        if (typeof findTableOrQueryResult === "function") {
            const res = findTableOrQueryResult(sourceName);
            if (res && res.isQuery === true && res.table?.name) {
                querySourceNames.add(res.table.name);
                return;
            }
        }

        // Варіант 4: ім'я збігається з назвою визначення запиту напряму
        const directDef = (queries.definitions || []).find(q => q.name === sourceName);
        if (directDef) {
            querySourceNames.add(`запит "${sourceName}"`);
        }
    });

    if (querySourceNames.size === 0) return;

    querySourceNames.forEach(internalName => {
        // internalName має вигляд: `запит "queryName"`
        const match = internalName.match(/^запит "(.+)"$/);
        if (!match) return;
        const queryName = match[1];

        const queryDef = (queries.definitions || []).find(q => q.name === queryName);
        if (!queryDef || !queryDef.sql) return;

        // Пропускаємо запити з незаповненими параметрами
        const hasPlaceholders = /\[[^\]]+\]/.test(queryDef.sql);
        if (hasPlaceholders) return;

        // Виконуємо запит і зберігаємо/оновлюємо результат
        try {
            const res = db.exec(queryDef.sql);
            if (res.length > 0) {
                const schema = res[0].columns.map(col => ({
                    title: col,
                    type: "Текст",
                    primaryKey: false,
                    comment: ""
                }));
                const queryResultTable = {
                    name: internalName,
                    schema: schema,
                    data: res[0].values
                };
                const existingIndex = queries.results.findIndex(r => r.name === internalName);
                if (existingIndex !== -1) {
                    queries.results[existingIndex] = queryResultTable;
                } else {
                    queries.results.push(queryResultTable);
                }
            }
        } catch (e) {
            console.warn(`[refreshQueriesUsedInElements] Помилка виконання запиту "${queryName}":`, e.message);
        }
    });
}

// Functions for managing saved queries
function showSavedQueriesDialog() {
        const listEl = document.getElementById("savedQueriesList");
        listEl.innerHTML = "";
        selectedQueryName = null;

        queries.definitions.forEach(query => {
            const li = document.createElement("li");
            li.textContent = query.name;
            li.style.padding = "8px";
            li.style.cursor = "pointer";
            li.dataset.queryName = query.name; // Store the query name in a data attribute

            li.addEventListener("click", () => {
                [...listEl.children].forEach(el => el.style.background = "");
                const isDark = document.body.classList.contains("dark-theme");
                li.style.background = isDark ? "#242d43" : "#d0e0ff";
                selectedQueryName = li.dataset.queryName;
            });
            listEl.appendChild(li);
        });
        document.getElementById("savedQueriesModal").style.display = "flex";
}

function closeSavedQueriesDialog() {
        document.getElementById("savedQueriesModal").style.display = "none";
        selectedQueryName = null;
}
    
function editSelectedQuery() {
        if (!selectedQueryName) {
            Message(t("querySelectForEdit"));
            return;
        }
    
        const queryToEdit = queries.definitions.find(q => q.name === selectedQueryName);
        console.log("Edit query=",selectedQueryName, queryToEdit )
        if (queryToEdit) {
            if (queryToEdit.config === null && queryToEdit.joins === null) {
                // Власний SQL-запит
                editOwnQuery(queryToEdit);
            } else {
                populateQueryModal(queryToEdit);
                // Згенерований конструктором запит
            }
            closeSavedQueriesDialog();
        } else {
            Message(t("queryNotFound"));
        }
}
    
function executeSelectedQuery() {
        if (!selectedQueryName) {
            Message(t("querySelectForRun"));
            return;
        }
    
        const queryDef = queries.definitions.find(q => q.name === selectedQueryName);
        if (!queryDef) {
            Message(t("queryNotFound"));
            return;
        }
    
        closeSavedQueriesDialog();
        runSqlQuery(queryDef.sql, queryDef.name);
}
function onFromTableChange() {
    const tableName = document.getElementById("fromTable").value;
    if (tableName) {
        // Очистити поточні рядки
        document.getElementById("queryBody").innerHTML = "";
        // Додати новий рядок
        addQueryRow();
        // Встановити таблицю в цьому рядку
        const newRow = document.querySelector("#queryBody tr");
        if (newRow) {
            const tableSelect = newRow.querySelector(".query-table-select");
            tableSelect.value = tableName;
            populateFieldDropdown(tableSelect); // тепер це безпечно!
        }
    }
}
function populateQueryModal(queryDefinition) {
    document.getElementById("queryName").value = queryDefinition.name;
    const queryBody = document.getElementById("queryBody");
    queryBody.innerHTML = ""; // Очистити рядки полів
    document.getElementById("joinBody").querySelector("tbody").innerHTML = ""; // Очистити зв’язки
    toggleStructureButtonVisibility(true);
    resetNonReadonlyRelations(); 
    // Відновлення рядків полів
    queryDefinition.config.forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><select class="query-table-select" onchange="onFromTableChange()"></select></td>
            <td><select class="query-field-select" onchange="onFieldSelectChange(this)"></select><div class="computed-expr-display" style="display:none; margin-top:4px; font-size:12px; color:#555; cursor:pointer;" onclick="editComputedField(this)"></div></td>
            <td><input type="checkbox" checked class="query-visible-checkbox"></td>
            <td>
                <select class="query-sort-select">
                    <option value="">${t("sortNone")}</option>
                    <option value="ASC">${t("sortAsc")}</option>
                    <option value="DESC">${t("sortDesc")}</option>
                </select>
            </td>
            <td>
                <div style="display: flex; gap: 4px; align-items: center;">
                <select class="query-operator-select" style="width: 60px;">
                    <option ${t("opEqual") ? `title="${t("opEqual")}"` : ""} value="==">==</option>
                    <option ${t("opLess") ? `title="${t("opLess")}"` : ""} value="<">&lt;</option>
                    <option ${t("opLessEq") ? `title="${t("opLessEq")}"` : ""} value="<=">&lt;=</option>
                    <option ${t("opGreater") ? `title="${t("opGreater")}"` : ""} value=">">&gt;</option>
                    <option ${t("opGreaterEq") ? `title="${t("opGreaterEq")}"` : ""} value=">=">&gt;=</option>
                    <option ${t("opNotEq") ? `title="${t("opNotEq")}"` : ""} value="!=">!=</option>
                    <option ${t("opLike") ? `title="${t("opLike")}"` : ""} value="LIKE">LIKE</option>
                    <option ${t("opIn") ? `title="${t("opIn")}"` : ""} value="IN">IN</option>
                    <option ${t("opNotIn") ? `title="${t("opNotIn")}"` : ""} value="NOT IN">NOT IN</option>
                    <option ${t("opBetween") ? `title="${t("opBetween")}"` : ""} value="BETWEEN">BETWEEN</option>
                    <option ${t("opNotBetween") ? `title="${t("opNotBetween")}"` : ""} value="NOT BETWEEN">NOT BETWEEN</option>
                </select>
                    <input type="text" class="query-criteria-input" style="flex: 1;">
                </div>
            </td>
            <td>
                <select class="query-field-role" ${`title="${t("roleParticipation")}"`} onchange="toggleAliasInput(this)">
                    <option value="select">----</option>                    
                    <option ${`title="${t("roleCount")}"`} value="count">COUNT</option>
                    <option ${`title="${t("roleSum")}"`} value="sum">SUM</option>
                    <option ${`title="${t("roleAvg")}"`} value="avg">AVG</option>
                    <option ${`title="${t("roleMin")}"`} value="min">MIN</option>
                    <option ${`title="${t("roleMax")}"`} value="max">MAX</option>
                </select>
                <input type="text" class="query-alias-input" ${`placeholder="${t("queryAliasFull")}"`} style="margin-top:4px; display:none; width:100%;">
            </td>
            <td><select class="group-field-select"></select></td>
            <td><button onclick="deleteQueryRow(this)">❌</button></td>
        `;
        queryBody.appendChild(row);

        // Заповнити випадаючі списки
        populateTableDropdownsForRow(row);
        row.querySelector(".query-table-select").value = item.tableName;
        populateFieldDropdown(row.querySelector(".query-table-select"));
        row.querySelector(".query-field-select").value = item.fieldName;
        row.querySelector(".group-field-select").value = item.groupName;
        row.querySelector(".query-visible-checkbox").checked = item.isVisible;
        row.querySelector(".query-sort-select").value = item.sortBy;

        // Restore computed field if present
        if (item.fieldName === "__expr__" && item.computed) {
            const c = item.computed;
            let exprStr, aliasStr;
            if (c.expr !== undefined) {
                // New format
                exprStr = c.expr;
                aliasStr = c.alias;
            } else {
                // Legacy format — migrate to new
                const leftLabel = `${c.leftTable}.${c.leftField}`;
                const rightLabel = c.rightType === "field" ? `${c.rightTable}.${c.rightField}` : c.rightField;
                exprStr = `[${leftLabel}]${c.operator}${c.rightType === "field" ? `[${rightLabel}]` : c.rightField}`;
                aliasStr = c.alias;
            }
            row.dataset.computed = JSON.stringify({ expr: exprStr, alias: aliasStr });
            const display = row.querySelector(".computed-expr-display");
            display.innerHTML = `<span title="${exprStr}" style="text-decoration:underline dotted;cursor:pointer;">⚡ ${aliasStr}</span>`;
            display.style.display = "block";
        }

        const operatorSelect = row.querySelector(".query-operator-select");
        const criteriaInput = row.querySelector(".query-criteria-input");

        // Встановлюємо оператор і критерій

        operatorSelect.value = item.operator;
        criteriaInput.value = item.criteria;

        // Встановлюємо роль поля (важливо!)
        const roleSelect = row.querySelector(".query-field-role");
        roleSelect.value = item.fieldRole || "select";

        // Встановлюємо псевдонім, якщо він був
        const aliasInput = row.querySelector(".query-alias-input");
        if (item.alias) {
            aliasInput.value = item.alias;
        }

        // Оновлюємо видимість інпуту псевдоніма
        toggleAliasInput(roleSelect);
        
        
    });

    // Відновлення JOIN-зв’язків
    if (queryDefinition.joins && queryDefinition.joins.length > 0) {
        const joinTable = document.getElementById("joinBody");
        const tbody = joinTable.querySelector("tbody");
        joinTable.style.display = "table";

        queryDefinition.joins.forEach(join => {
            const match = join.condition.match(/"([^"]+)"\."([^"]+)" = "([^"]+)"\."([^"]+)"/);
            if (!match) return;

            const [, tableA, fieldA, tableB, fieldB] = match;

            const row = document.createElement("tr");
            row.innerHTML = `
                <td><select class="join-table-a" onchange="populateJoinFields(this, true)"></select></td>
                <td><select class="join-field-a"></select></td>
                <td><select class="join-table-b" onchange="populateJoinFields(this, false)"></select></td>
                <td><select class="join-field-b"></select></td>
                <td><button onclick="this.closest('tr').remove()">❌</button></td>
            `;
            tbody.appendChild(row);

            const tableSelectA = row.querySelector(".join-table-a");
            const tableSelectB = row.querySelector(".join-table-b");
            const fieldSelectA = row.querySelector(".join-field-a");
            const fieldSelectB = row.querySelector(".join-field-b");

            [tableSelectA, tableSelectB].forEach(select => {
                select.innerHTML = "<option value=''>" + t("querySelectTable") + "</option>";
                database.tables.forEach(t => {
                    const opt = document.createElement("option");
                    opt.value = t.name;
                    opt.textContent = t.name;
                    select.appendChild(opt);
                });
            });

            tableSelectA.value = tableA;
            tableSelectB.value = tableB;

            populateJoinFields(tableSelectA, true);
            populateJoinFields(tableSelectB, false);

            fieldSelectA.value = fieldA;
            fieldSelectB.value = fieldB;
        });
    }

    // Відновлення базової таблиці (FROM)
    const fromTableSelect = document.getElementById("fromTable");
    if (fromTableSelect) {
        // Спочатку очистити і заповнити варіанти
        fromTableSelect.innerHTML = "<option value=''>" + t("querySelectTable") + "</option>";
        database.tables.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.name;
            opt.textContent = t.name;
            fromTableSelect.appendChild(opt);
        });
    
        // Встановити значення, якщо воно є
        fromTableSelect.value = queryDefinition.baseTable || "";
    }
    document.getElementById("queryModal").style.display = "flex";
}

function deleteSelectedQuery() {
        if (!selectedQueryName) {
            Message(t("querySelectForDelete"));
            return;
        }
        const queryIndex = queries.definitions.findIndex(q => q.name === selectedQueryName);
        if (queryIndex !== -1) {
            const deletedQueryName = queries.definitions[queryIndex].name;
            queries.definitions.splice(queryIndex, 1); // Remove from definitions
            saveDatabase(); // Save updated definitions

            // Also remove any corresponding query results from `queries.results` and from the `data-menu`
            const menuDisplayName = `*запит "${deletedQueryName}"`; // Construct the display name for the result
            const resultIndex = queries.results.findIndex(r => r.name === `запит "${deletedQueryName}"`); // Find the result by its internal name
            if (resultIndex !== -1) {
                queries.results.splice(resultIndex, 1); // Remove from results
            }

            const dataMenu = document.getElementById("data-menu");
            const existingMenuItem = Array.from(dataMenu.children).find(item => item.textContent === menuDisplayName);
            if (existingMenuItem) {
                existingMenuItem.remove(); // Remove from menu
            }

            Message(t("queryDeleted", deletedQueryName));
            showSavedQueriesDialog(); // Refresh the list
        } else {
            Message(t("queryNotFound"));
        }
    }

function addJoinRow() {
        const joinTable = document.getElementById("joinBody");
        const tbody = joinTable.querySelector("tbody");

        joinTable.style.display = "table"; // Показує таблицю, якщо прихована

        const row = document.createElement("tr");
        row.innerHTML = `
            <td><select class="join-table-a" onchange="populateJoinFields(this, true)"></select></td>
            <td><select class="join-field-a"></select></td>
            <td><select class="join-table-b" onchange="populateJoinFields(this, false)"></select></td>
            <td><select class="join-field-b"></select></td>
            <td><button onclick="this.closest('tr').remove()">❌</button></td>
        `;
        tbody.appendChild(row);

        const selects = row.querySelectorAll("select");
        selects.forEach(select => {
            if (select.classList.contains("join-table-a") || select.classList.contains("join-table-b")) {
                select.innerHTML = "<option value=''>" + t("querySelectTable") + "</option>";
                database.tables.forEach(t => {
                    const opt = document.createElement("option");
                    opt.value = t.name;
                    opt.textContent = t.name;
                    select.appendChild(opt);
                });
            }
        });
    }

function populateJoinFields(tableSelect, isLeft) {
        const row = tableSelect.closest("tr");
        const fieldSelect = isLeft ? row.querySelector(".join-field-a") : row.querySelector(".join-field-b");
        fieldSelect.innerHTML = "";

        const table = database.tables.find(t => t.name === tableSelect.value);
        if (table) {
            table.schema.forEach(field => {
                const opt = document.createElement("option");
                opt.value = field.title;
                opt.textContent = field.title;
                fieldSelect.appendChild(opt);
            });
        }
    }

function openRelationFromQuery() {
        const joinRows = document.querySelectorAll("#joinBody tbody tr");
        database.relations = [];

        joinRows.forEach(row => {
            const tableA = row.querySelector(".join-table-a")?.value;
            const fieldA = row.querySelector(".join-field-a")?.value;
            const tableB = row.querySelector(".join-table-b")?.value;
            const fieldB = row.querySelector(".join-field-b")?.value;

            if (tableA && fieldA && tableB && fieldB) {
                database.relations.push({
                    fromTable: tableA,
                    fromField: fieldA,
                    toTable: tableB,
                    toField: fieldB
                });
            }
        });

        //saveDatabase();
        openRelationDesigner(() => {
            // callback після закриття конструктора — синхронізуємо з JOIN
            loadRelationsToJoinTable();
        });
}

// Ручне створення SQL-запиту
// Відкриває модальне вікно для ручного введення та виконання SQL-запитів.
function createOwnSQL() {
		if(!isDBExist()) return
        document.getElementById("ownSqlInput").value = ""; // Очистити поле вводу
        document.getElementById("ownSqlResults").innerHTML = ""; // Очистити результати попередніх запитів
        document.getElementById("ownSqlModal").style.display = "flex";
        document.getElementById('ownSQLName').value = t("queryNewQuery");
        toggleStructureButtonVisibility(true);
    }
    
function editOwnQuery(query) {
        // Відкриваємо модальне вікно власного SQL
        const modal = document.getElementById("ownSqlModal");
        if (modal) modal.style.display = "flex";
        toggleStructureButtonVisibility(true)
        
    
        // Вставляємо назву запиту
        const nameInput = document.getElementById("ownSQLName");
        if (nameInput) nameInput.value = query.name || "";
    
        // Вставляємо текст SQL-запиту
        const sqlTextarea = document.getElementById("ownSqlInput");
        if (sqlTextarea) sqlTextarea.value = query.sql || "";
        
        document.getElementById("ownSqlResults").innerHTML = ""; // Очистити результати попередніх запитів
}
       
    
function saveOwnSQLquery() {
        const sql = document.getElementById("ownSqlInput").value.trim();
        const name = document.getElementById("ownSQLName")?.value.trim();
    
        if (!sql) {
            Message(t("queryEmptySQL"));
            return false;
        }
    
        if (!name) {
            Message(t("queryNoName2"));
            return false;
        }
    
        // Формуємо об'єкт запиту
        const query = {
            name: name,
            sql: sql,
            config: null,
            joins: null
        };
    
        // Шукаємо, чи існує вже такий запит
        const existingIndex = queries.definitions.findIndex(q => q.name === name);
    
        if (existingIndex !== -1) {
            if (!confirm(t("queryOverwriteConfirm"))) return false;
            queries.definitions[existingIndex] = query;
        } else {
            queries.definitions.push(query);
        }
    
        saveDatabase();
        return true
}

function saveOwnSQL() {
        if (saveOwnSQLquery()) {
            Message(t("querySaved"));
        }    
}
