let isGridVisible = false; // grid visibility
let startX, startY, startWidth, startHeight;
let activeElement = null;
let isDragging = false;
let isResizing = false;
let isDesignerDirty = false; // прапор незбережених змін у конструкторі
let resizeHandle = null;
let initialX, initialY;
let initialLeft, initialTop, initialWidth, initialHeight;
let currentEditElement = null;

// Конструктор звітів та форм
function createConstructor() {
    document.getElementById(constructorMode + "CreatorModal").style.display = "flex";
    let newMode = t("designerNewForm");
    if (constructorMode === "report") newMode = t("designerNewReport");
    document.getElementById(constructorMode + "NameInput").value = newMode;
    screenCanvas = document.getElementById(constructorMode + "Canvas");
    screenCanvas.innerHTML = "";
    document.getElementById("fieldSelectionModal").style.display = "none";
    document.getElementById(constructorMode + "Canvas").classList.remove('grid-visible');
    isGridVisible = false;
    isDesignerDirty = false;
}

// --- спільна функція наповнення select таблицями/запитами ---
function populateTableSelect(selectEl, placeholder, includeQueries) {
    selectEl.innerHTML = `<option value=''>${placeholder}</option>`;
    database.tables.forEach(table => {
        const option = document.createElement("option");
        option.value = table.name;
        option.textContent = table.name;
        selectEl.appendChild(option);
    });
    if (includeQueries) {
        queries.results.forEach(query => {
            const option = document.createElement("option");
            option.value = `*${query.name}`;
            option.textContent = `*${query.name}`;
            selectEl.appendChild(option);
        });
    }
}

// Застаріла обгортка — лишена для сумісності, якщо викликається ззовні
function populateFieldPanelTableSelect() {
    const el = document.getElementById("fieldPanelTableSelect") || fieldPanelTableSelect;
    populateTableSelect(el, t("designerSelectTableQuery"), true);
}

function cancelFieldSelection() {
    document.getElementById("fieldSelectionModal").style.display = "none";
}

// --- спільна функція для форм і звітів ---
function initFieldPanelListeners(tableSelect, fieldSelect, fieldClass) {
    tableSelect.addEventListener("change", () => {
        const selectedTableName = tableSelect.value;
        const selectedTable =
            database.tables.find(t => t.name === selectedTableName) ||
            queries.results.find(q => `*${q.name}` === selectedTableName);

        fieldSelect.innerHTML = "<option value=''>" + t("designerSelectField") + "</option>";
        if (selectedTable) {
            selectedTable.schema.forEach(field => {
                const option = document.createElement("option");
                option.value = field.title;
                option.textContent = field.title;
                fieldSelect.appendChild(option);
            });
        }
        if (activeElement && activeElement.classList.contains(fieldClass)) {
            const fieldTextDiv = activeElement.querySelector('.field-text');
            const currentField = activeElement.dataset.fieldName || "";
            if (fieldTextDiv) {
                fieldTextDiv.innerText = selectedTableName ? `${selectedTableName}.${currentField}` : t("designerFieldData");
            }
            activeElement.dataset.tableName = selectedTableName;
        }
    });

    fieldSelect.addEventListener("change", () => {
        const selectedTableName = tableSelect.value;
        const selectedFieldName = fieldSelect.value;
        if (activeElement && activeElement.classList.contains(fieldClass) && selectedTableName && selectedFieldName) {
            const fieldTextDiv = activeElement.querySelector('.field-text');
            if (fieldTextDiv) {
                fieldTextDiv.innerText = `${selectedTableName}.${selectedFieldName}`;
            }
            activeElement.dataset.tableName = selectedTableName;
            activeElement.dataset.fieldName = selectedFieldName;
        } else if (activeElement && activeElement.classList.contains(fieldClass)) {
            const fieldTextDiv = activeElement.querySelector('.field-text');
            if (fieldTextDiv) {
                fieldTextDiv.innerText = tableSelect.value ? `${tableSelect.value}.` : t("designerFieldData");
            }
            delete activeElement.dataset.fieldName;
        }
    });
}


// ЄДИНИЙ DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    const reportCanvas = document.getElementById("reportCanvas");
    const formCanvas   = document.getElementById("formCanvas");
    const fieldSelectionModal = document.getElementById("fieldSelectionModal");

    const fieldPanelTableSelect1 = document.getElementById("fieldPanelTableSelect");
    const fieldPanelFieldSelect1 = document.getElementById("fieldPanelFieldSelect");

    // Слухачі для форм і звітів
    initFieldPanelListeners(fieldPanelTableSelect1, fieldPanelFieldSelect1, "form-field");
    initFieldPanelListeners(fieldPanelTableSelect1, fieldPanelFieldSelect1, "report-field");

    // --- Налаштування тексту ---
    document.getElementById("fontFamilySelect").addEventListener("change", (e) => {
        if (activeElement && isTextElement(activeElement)) activeElement.style.fontFamily = e.target.value;
    });
    document.getElementById("fontSizeInput").addEventListener("input", (e) => {
        if (activeElement && isTextElement(activeElement)) activeElement.style.fontSize = `${e.target.value}px`;
    });
    document.getElementById("fontColorInput").addEventListener("input", (e) => {
        if (activeElement && isTextElement(activeElement)) activeElement.style.color = e.target.value;
    });
    document.getElementById("fontWeightToggle").addEventListener("change", (e) => {
        if (activeElement && isTextElement(activeElement)) activeElement.style.fontWeight = e.target.checked ? 'bold' : 'normal';
    });
    document.getElementById("fontStyleToggle").addEventListener("change", (e) => {
        if (activeElement && isTextElement(activeElement)) activeElement.style.fontStyle = e.target.checked ? 'italic' : 'normal';
    });
    document.getElementById("textDecorationUnderline").addEventListener("change", () => {
        if (activeElement && isTextElement(activeElement)) updateTextDecoration();
    });
    document.getElementById("textDecorationStrikethrough").addEventListener("change", () => {
        if (activeElement && isTextElement(activeElement)) updateTextDecoration();
    });
    document.querySelectorAll('input[name="textAlign"]').forEach(radio => {
        radio.addEventListener('change', updateTextAlign);
    });

    // --- Спільні обробники canvas (mousedown / mousemove / mouseup) ---
    function handleCanvasMouseDown(e, elementClass, labelClass, fieldClass) {
        const element = e.target.closest(`.${elementClass}`);
        const handle  = e.target.closest(".resize-handle");

        document.querySelectorAll(`.${elementClass}.selected`).forEach(el => el.classList.remove("selected"));
        fieldSelectionModal.style.display = "none";
        closeTextOptionsModal();

        if (element) {
            activeElement = element;
            activeElement.classList.add("selected");
            const rect = activeElement.getBoundingClientRect();

            initialLeft   = activeElement.offsetLeft;
            initialTop    = activeElement.offsetTop;
            initialWidth  = rect.width;
            initialHeight = rect.height;
            initialX      = e.clientX;
            initialY      = e.clientY;

            if (handle) {
                isResizing  = true;
                resizeHandle = handle;
                element.style.cursor = handle.style.cursor;
            } else {
                isDragging = true;
                element.style.cursor = "grabbing";

                const BORDER_TOLERANCE = 10;
                const elementRect    = activeElement.getBoundingClientRect();
                const relativeClickX = e.clientX - elementRect.left;
                const relativeClickY = e.clientY - elementRect.top;

                const nearLeft   = relativeClickX < BORDER_TOLERANCE;
                const nearRight  = elementRect.width  - relativeClickX < BORDER_TOLERANCE;
                const nearTop    = relativeClickY < BORDER_TOLERANCE;
                const nearBottom = elementRect.height - relativeClickY < BORDER_TOLERANCE;

                if (activeElement.classList.contains(labelClass)) {
                    if (!nearLeft && !nearRight && !nearTop && !nearBottom) {
                        isDragging = false;
                        element.focus();
                    }
                } else if (activeElement.classList.contains(fieldClass)) {
                    if (!nearLeft && !nearRight && !nearTop && !nearBottom) {
                        fieldSelectionModal.style.display = "flex";
                        populateFieldSelectionPanel();
                        isDragging = false;
                    } else {
                        fieldSelectionModal.style.display = "none";
                    }
                }
            }

            if (isDragging || isResizing || (activeElement.classList.contains(labelClass) && !isDragging)) {
                e.preventDefault();
            }
        } else {
            activeElement = null;
        }
    }

// спільна функція замість дублювання mousemove
function handleCanvasMouseMove(e) {
    if (!activeElement) return;
    const dx = e.clientX - initialX;
    const dy = e.clientY - initialY;

    if (isDragging) {
        activeElement.style.left = `${initialLeft + dx}px`;
        activeElement.style.top  = `${initialTop  + dy}px`;
        // 🆕 Оновлення направляючих при перетягуванні через canvas
        updateSnapGuides(activeElement.parentElement, activeElement);
    } else if (isResizing) {
        let newWidth  = initialWidth;
        let newHeight = initialHeight;
        let newLeft   = initialLeft;
        let newTop    = initialTop;

        if (resizeHandle.classList.contains("bottom-right")) {
            newWidth  = Math.max(50, initialWidth  + dx);
            newHeight = Math.max(30, initialHeight + dy);
        } else if (resizeHandle.classList.contains("bottom-left")) {
            newWidth  = Math.max(50, initialWidth  - dx);
            newHeight = Math.max(30, initialHeight + dy);
            newLeft   = initialLeft + dx;
        } else if (resizeHandle.classList.contains("top-right")) {
            newWidth  = Math.max(50, initialWidth  + dx);
            newHeight = Math.max(30, initialHeight - dy);
            newTop    = initialTop + dy;
        } else if  (resizeHandle.classList.contains("top-left")) {
            newWidth  = Math.max(50, initialWidth  - dx);
            newHeight = Math.max(30, initialHeight - dy);
            newLeft   = initialLeft + dx;
            newTop    = initialTop  + dy;
        }

        activeElement.style.width  = `${newWidth}px`;
        activeElement.style.height = `${newHeight}px`;
        activeElement.style.left   = `${newLeft}px`;
        activeElement.style.top    = `${newTop}px`;
    }
}

// спільна функція замість дублювання mouseup
function handleCanvasMouseUp() {
    if (activeElement) activeElement.style.cursor = "grab";
    // 🆕 Очищення направляючих при відпусканні мишки на canvas
    clearGuides(screenCanvas);
    isDragging   = false;
    isResizing   = false;
    resizeHandle = null;
}

    formCanvas.addEventListener("mousedown",  (e) => handleCanvasMouseDown(e, "form-element",   "form-label",   "form-field"));
    formCanvas.addEventListener("mousemove",  handleCanvasMouseMove);
    formCanvas.addEventListener("mouseup",    handleCanvasMouseUp);

    reportCanvas.addEventListener("mousedown", (e) => handleCanvasMouseDown(e, "report-element", "report-label", "report-field"));
    reportCanvas.addEventListener("mousemove", handleCanvasMouseMove);
    reportCanvas.addEventListener("mouseup",   handleCanvasMouseUp);
});

// =============================================

function updateTextAlign() {
    const selected = document.querySelector('input[name="textAlign"]:checked');
    if (activeElement && selected) {
        activeElement.style.textAlign = selected.value;
    }
}
/*
function populateFieldSelectionPanel() {
    const fieldPanelTableSelect = document.getElementById("fieldPanelTableSelect");
    //використовуємо спільну функцію, включаємо запити для report
    populateTableSelect(fieldPanelTableSelect, t("designerSelectTable"), constructorMode === "report");

    if (activeElement && activeElement.dataset.tableName) {
        fieldPanelTableSelect.value = activeElement.dataset.tableName;
        fieldPanelTableSelect.dispatchEvent(new Event('change'));
    } else {
        fieldPanelTableSelect.value = "";
    }
    if (activeElement && activeElement.dataset.fieldName) {
        document.getElementById("fieldPanelFieldSelect").value = activeElement.dataset.fieldName;
    } else {
        document.getElementById("fieldPanelFieldSelect").value = "";
    }
}
*/
function populateFieldSelectionPanel() {
    console.log("constructorMode=", constructorMode);
    const fieldPanelTableSelect = document.getElementById("fieldPanelTableSelect");

    // Очищення та наповнення через єдину функцію (таблиці + запити)
    populateTableSelect(fieldPanelTableSelect, t("designerSelectTable"), true);

    // Відновлення вибраного значення, якщо елемент активний
    if (activeElement && activeElement.dataset.tableName) {
        fieldPanelTableSelect.value = activeElement.dataset.tableName;
        fieldPanelTableSelect.dispatchEvent(new Event('change'));
    } else {
        fieldPanelTableSelect.value = "";
    }

    if (activeElement && activeElement.dataset.fieldName) {
        document.getElementById("fieldPanelFieldSelect").value = activeElement.dataset.fieldName;
    } else {
        document.getElementById("fieldPanelFieldSelect").value = "";
    }
}






function openTextOptions() {
    if (!activeElement || !isTextElement(activeElement)) {
        Message(t("designerSelectTextEl"));
        return;
    }

    const fontFamilySelect          = document.getElementById("fontFamilySelect");
    const fontSizeInput             = document.getElementById("fontSizeInput");
    const fontColorInput            = document.getElementById("fontColorInput");
    const fontWeightToggle          = document.getElementById("fontWeightToggle");
    const fontStyleToggle           = document.getElementById("fontStyleToggle");
    const textDecorationUnderline   = document.getElementById("textDecorationUnderline");
    const textDecorationStrikethrough = document.getElementById("textDecorationStrikethrough");
    const textAlignRadios           = document.querySelectorAll('input[name="textAlign"]');

    fontFamilySelect.value    = activeElement.style.fontFamily.replace(/['"]/g, '') || 'Arial';
    fontSizeInput.value       = parseInt(activeElement.style.fontSize) || 16;
    fontColorInput.value      = activeElement.style.color || '#000000';
    fontWeightToggle.checked  = activeElement.style.fontWeight === 'bold';
    fontStyleToggle.checked   = activeElement.style.fontStyle  === 'italic';

    const textDecoration = activeElement.style.textDecoration;
    textDecorationUnderline.checked      = textDecoration.includes('underline');
    textDecorationStrikethrough.checked  = textDecoration.includes('line-through');

    const currentAlign = activeElement.style.textAlign || 'left';
    textAlignRadios.forEach(radio => {
        radio.checked = radio.value === currentAlign;
    });

    document.getElementById("textOptionsModal").style.display = "flex";
}

function updateTextDecoration() {
    const textDecorationUnderline      = document.getElementById("textDecorationUnderline");
    const textDecorationStrikethrough  = document.getElementById("textDecorationStrikethrough");

    const decorations = [];
    if (textDecorationUnderline.checked)     decorations.push('underline');
    if (textDecorationStrikethrough.checked) decorations.push('line-through');

    if (activeElement) {
        activeElement.style.textDecoration = decorations.join(' ');
    }
}

function isTextElement(el) {
    return el.classList.contains("report-label") ||
           el.classList.contains("report-field") ||
           el.classList.contains("form-label")   ||
           el.classList.contains("form-field");
}

function addPx(value) {
    if (typeof value === "number") return value + "px";
    if (typeof value === "string" && !value.endsWith("px") && /^\d+$/.test(value)) {
        return value + "px";
    }
    return value;
}

function looksLikeImageUrl(url) {
    if (typeof url !== "string" || !url.trim()) return false;
    const trimmed = url.trim();
    const imgExts = /\.(jpeg|jpg|gif|png|webp|svg|bmp|ico|tiff?)$/i;
    const isUrl = trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:image/");
    return isUrl && imgExts.test(trimmed);
}

function findTableOrQuery(tableName) {
    return (
        database.tables.find(t => t.name === tableName) ||
        queries.results.find(q => `*${q.name}` === tableName)
    );
}

/**
 * Додає виділення при кліку і показує маркери
 **/
function initializeCanvasElement(element) {
    element.addEventListener("click", (e) => {
        e.stopPropagation();

        document.querySelectorAll("." + constructorMode + "-element.selected").forEach(el => {
            el.classList.remove("selected");
            el.querySelectorAll(".resize-handle").forEach(h => h.remove());
        });

        element.classList.add("selected");
        addResizeHandles(element);
    });
}

/**
 * Відтворення об'єктів збереженого звіту/форми
 **/
function renderCanvas(stored) {
    const cm       = constructorMode;
    const cNameInput = document.getElementById(cm + "NameInput");
    const cCanvas    = document.getElementById(cm + "Canvas");
    cNameInput.value = stored.name;
    cCanvas.innerHTML = "";
    isDesignerDirty = false;

    stored.elements.forEach(el => {
        // --- Графічні фігури ---
        if (el.type === "shape") {
            const div = document.createElement("div");
            div.classList.add(cm + "-element", cm + "-shape", "shape-" + el.shapeType);
            div.dataset.shapeType       = el.shapeType;
            div.dataset.strokeColor     = el.strokeColor     || "#333333";
            div.dataset.fillColor       = el.fillColor       || "#ffffff";
            div.dataset.fillTransparent = el.fillTransparent ? "1" : "0";
            div.style.position  = "absolute";
            div.style.cursor    = "grab";
            div.style.boxSizing = "border-box";
            _applyShapeStyles(div, el.shapeType, el.strokeColor || "#333333", el.fillColor || "#ffffff", el.fillTransparent);
            div.style.left   = el.left   + "px";
            div.style.top    = el.top    + "px";
            div.style.width  = el.width  + "px";
            div.style.height = el.height + "px";
            // Фігури вставляємо на початок canvas (під текст)
            const firstNonShape = [...cCanvas.children].find(
                c => !c.classList.contains(cm + "-shape") && !c.classList.contains("guide-container")
            );
            if (firstNonShape) cCanvas.insertBefore(div, firstNonShape);
            else cCanvas.appendChild(div);
            addResizeHandles(div);
            makeDraggableAndResizable(div);
            return;
        }

        // --- Текстові елементи ---
        const div = document.createElement("div");
        div.classList.add(cm + "-element");
        div.style.position      = "absolute";
        div.style.left          = el.left   + "px";
        div.style.top           = el.top    + "px";
        div.style.width         = el.width  + "px";
        div.style.height        = el.height + "px";
        div.style.cursor        = "grab";
        div.style.boxSizing     = "border-box";
        div.style.fontFamily    = el.fontFamily;
        div.style.fontSize      = el.fontSize;
        div.style.fontWeight    = el.fontWeight;
        div.style.fontStyle     = el.fontStyle;
        div.style.textDecoration = el.textDecoration;
        div.style.color         = el.color;

        if (el.type === "field") {
            div.classList.add(cm + "-field");
            div.dataset.fieldName = el.fieldName;
            div.dataset.tableName = el.tableName;
            div.style.border          = "1px dashed green";
            div.style.backgroundColor = "rgba(144, 238, 144, 0.3)";

            const fieldText = document.createElement("div");
            fieldText.classList.add("field-text");
            fieldText.innerText = `${el.tableName}.${el.fieldName}`;
            div.appendChild(fieldText);
        } else if (el.type === "label") {
            div.classList.add(cm + "-label");
            div.contentEditable   = "false";
            div.innerText         = el.text;
            div.style.border          = "1px dashed gray";
            div.style.backgroundColor = "rgba(240,240,240,0.8)";
        }

        cCanvas.appendChild(div);
        initializeCanvasElement(div);
        makeDraggableAndResizable(div);
    });
}

// Додаємо напис
function addScreenLabel() {
    const labelElement = document.createElement("div");
    labelElement.className = constructorMode + "-element " + constructorMode + "-label";
    Object.assign(labelElement.style, {
        position:        "absolute",
        right:           "10px",
        top:             "10px",
        width:           "150px",
        height:          "40px",
        border:          "1px solid blue",
        backgroundColor: "rgba(173, 216, 230, 0.3)",
        padding:         "5px",
        cursor:          "grab",
        boxSizing:       "border-box"
    });

    labelElement.contentEditable = "false";
    labelElement.innerText = t("designerNewLabel");
    screenCanvas.appendChild(labelElement);
    addResizeHandles(labelElement);
    makeDraggableAndResizable(labelElement);
    isDesignerDirty = true;
}

// Додаємо поле
function addScreenField() {
    const fieldElement = document.createElement("div");
    fieldElement.className = constructorMode + "-element " + constructorMode + "-field";
    Object.assign(fieldElement.style, {
        position:        "absolute",
        right:           "10px",
        top:             "60px",
        width:           "200px",
        height:          "40px",
        border:          "1px dashed green",
        backgroundColor: "rgba(144,238,144,0.3)",
        padding:         "5px",
        cursor:          "grab",
        boxSizing:       "border-box"
    });

    const fieldText = document.createElement("div");
    fieldText.className = "field-text";
    fieldText.innerText = t("designerFieldDefault");
    fieldElement.appendChild(fieldText);

    addResizeHandles(fieldElement);

    fieldElement.addEventListener("click", () => {
        selectedFormField = fieldElement;
    });
    screenCanvas.appendChild(fieldElement);
    makeDraggableAndResizable(fieldElement);
    isDesignerDirty = true;
}

function editLabel(el) {
    currentEditElement = el;
    const modal = document.getElementById("editLabelModal");
    const input = document.getElementById("editInput");

    input.value = el.innerText;
    modal.style.display = "flex";
    input.focus();
}

// Кнопка Ok
function textOk() {
    if (currentEditElement) {
        currentEditElement.innerText = document.getElementById("editInput").value;
        currentEditElement.querySelectorAll(".resize-handle").forEach(h => h.remove());
        addResizeHandles(currentEditElement);
        isDesignerDirty = true;
    }
    document.getElementById("editLabelModal").style.display = "none";
    currentEditElement = null;
}

// Кнопка Скасувати
function textCancel() {
    document.getElementById("editLabelModal").style.display = "none";
    currentEditElement = null;
}
//
// =============================================
//SNAP GUIDES (НАПРАВЛЯЮЧІ ЛІНІЇ) 
function getGuideContainer(canvas) {
    let container = canvas.querySelector('.guide-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'guide-container';
        Object.assign(container.style, {
            position: 'absolute', top: '0', left: '0',
            width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: '9999',
            boxSizing: 'border-box', overflow: 'hidden'
        });
        canvas.appendChild(container);
    }
    return container;
}

function clearGuides(canvas) {
    const container = canvas?.querySelector('.guide-container');
    if (container) container.innerHTML = '';
}

function drawGuide(canvas, x1, y1, x2, y2) {
    const container = getGuideContainer(canvas);
    const line = document.createElement('div');
    const isHorizontal = Math.abs(y1 - y2) < 1;
    Object.assign(line.style, {
        position: 'absolute',
        backgroundColor: '#e040fb',
        zIndex: '10000',
        pointerEvents: 'none'
    });
    if (isHorizontal) {
        line.style.left = Math.min(x1, x2) + 'px';
        line.style.top = Math.round(y1) + 'px';
        line.style.width = Math.abs(x2 - x1) + 'px';
        line.style.height = '1px';
    } else {
        line.style.left = Math.round(x1) + 'px';
        line.style.top = Math.min(y1, y2) + 'px';
        line.style.width = '1px';
        line.style.height = Math.abs(y2 - y1) + 'px';
    }
    container.appendChild(line);
}

function updateSnapGuides(canvas, movingEl) {
    clearGuides(canvas);
    const threshold = 10;
    const siblings = [...canvas.children].filter(el => 
        el !== movingEl && 
        (el.classList.contains('form-element') || el.classList.contains('report-element'))
    );

    const m = {
        l: movingEl.offsetLeft, t: movingEl.offsetTop,
        r: movingEl.offsetLeft + movingEl.offsetWidth,
        b: movingEl.offsetTop + movingEl.offsetHeight
    };

    siblings.forEach(sib => {
        const s = {
            l: sib.offsetLeft, t: sib.offsetTop,
            r: sib.offsetLeft + sib.offsetWidth,
            b: sib.offsetTop + sib.offsetHeight
        };

        const checkAndDraw = (v1, v2, isHoriz) => {
            if (Math.abs(v1 - v2) < threshold) {
                let x1, y1, x2, y2;
                if (isHoriz) {
                    y1 = y2 = v1;
                    x1 = Math.min(m.l, s.l);
                    x2 = Math.max(m.r, s.r);
                } else {
                    x1 = x2 = v1;
                    y1 = Math.min(m.t, s.t);
                    y2 = Math.max(m.b, s.b);
                }
                drawGuide(canvas, x1, y1, x2, y2);
            }
        };

        // 8 комбінацій вирівнювання
        checkAndDraw(m.t, s.t, true);
        checkAndDraw(m.b, s.b, true);
        checkAndDraw(m.t, s.b, true);
        checkAndDraw(m.b, s.t, true);
        checkAndDraw(m.l, s.l, false);
        checkAndDraw(m.r, s.r, false);
        checkAndDraw(m.l, s.r, false);
        checkAndDraw(m.r, s.l, false);
    });
}
/**
 * Зробити об'єкт перетягуваним, зі зміною розмірів та можливістю редагування вмісту
 **/
function makeDraggableAndResizable(el) {
    const parent = el.parentElement;
    // === DRAG ===
    let offsetX, offsetY, dragging = false;
    el.addEventListener("mousedown", startDrag);
    el.addEventListener("touchstart", startDrag);

    function startDrag(e) {
        if (e.target.classList.contains("resize-handle")) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = el.getBoundingClientRect();

        if (el.classList.contains("report-label") || el.classList.contains("form-label")) {
            const dXY = 10;
            const inRect = (clientX > rect.left + dXY && clientX < rect.right - dXY &&
                            clientY > rect.top + dXY && clientY < rect.bottom - dXY);
            if (inRect) {
                editLabel(el);
                stopDrag();
                dragging = false;
                return;
            }
        }

        dragging = true;
        offsetX = clientX - rect.left;
        offsetY = clientY - rect.top;

        document.addEventListener("mousemove", onDrag);
        document.addEventListener("mouseup", stopDrag);
        document.addEventListener("touchmove", onDrag, { passive: false });
        document.addEventListener("touchend", stopDrag);
    }

    function onDrag(e) {
        if (!dragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const parentRect = parent.getBoundingClientRect();
        const left = clientX - parentRect.left - offsetX;
        const top = clientY - parentRect.top - offsetY;
        el.style.left = Math.max(0, left) + "px";
        el.style.top = Math.max(0, top) + "px";
        isDesignerDirty = true;
        // 🆕 Оновлення направляючих під час переміщення
        updateSnapGuides(parent, el);
    }

    function stopDrag() {
        dragging = false;
        // 🆕 Миттєве прибирання направляючих після відпускання
        clearGuides(parent);
        document.removeEventListener("mousemove", onDrag);
        document.removeEventListener("mouseup", stopDrag);
        document.removeEventListener("touchmove", onDrag);
        document.removeEventListener("touchend", stopDrag);
    }

    // === RESIZE ===
    const handles = el.querySelectorAll(".resize-handle");
    handles.forEach(handle => {
        handle.addEventListener("mousedown", startResize);
        handle.addEventListener("touchstart", startResize);

        function startResize(e) {
            e.stopPropagation();
            const rect = el.getBoundingClientRect();
            const parentRect = parent.getBoundingClientRect();
            const startX = e.touches ? e.touches[0].clientX : e.clientX;
            const startY = e.touches ? e.touches[0].clientY : e.clientY;
            const startW = rect.width;
            const startH = rect.height;
            const startL = rect.left - parentRect.left;
            const startT = rect.top - parentRect.top;
            const pos = handle.classList[1];

            function onResize(ev) {
                const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
                const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
                const dx = clientX - startX;
                const dy = clientY - startY;

                if (pos.includes("right")) el.style.width = Math.max(40, startW + dx) + "px";
                if (pos.includes("bottom")) el.style.height = Math.max(20, startH + dy) + "px";
                if (pos.includes("left")) {
                    el.style.width = Math.max(40, startW - dx) + "px";
                    el.style.left = Math.max(0, startL + dx) + "px";
                }
                if (pos.includes("top")) {
                    el.style.height = Math.max(20, startH - dy) + "px";
                    el.style.top = Math.max(0, startT + dy) + "px";
                }
                isDesignerDirty = true;
            }

            function stopResize() {
                document.removeEventListener("mousemove", onResize);
                document.removeEventListener("mouseup", stopResize);
                document.removeEventListener("touchmove", onResize);
                document.removeEventListener("touchend", stopResize);
            }

            document.addEventListener("mousemove", onResize);
            document.addEventListener("mouseup", stopResize);
            document.addEventListener("touchmove", onResize);
            document.addEventListener("touchend", stopResize);
        }
    });
}

// =============================================
// === ГРАФІЧНІ ОБ'ЄКТИ (ФІГУРИ) ===
// =============================================

let _shapeStrokeColor = "#333333";
let _shapeFillColor   = "#ffffff";
let _shapeFillTransparent = false;

/**
 * Створює графічний об'єкт на canvas.
 * shapeType: "rect" | "round-rect" | "hline" | "vline"
 */
function _createShape(shapeType) {
    const canvas = screenCanvas;
    const cm = constructorMode;

    const el = document.createElement("div");
    el.classList.add(cm + "-element", cm + "-shape", "shape-" + shapeType);
    el.dataset.shapeType    = shapeType;
    el.dataset.strokeColor  = _shapeStrokeColor;
    el.dataset.fillColor    = _shapeFillColor;
    el.dataset.fillTransparent = _shapeFillTransparent ? "1" : "0";

    el.style.position  = "absolute";
    el.style.cursor    = "grab";
    el.style.boxSizing = "border-box";
    // Графічні об'єкти завжди під текстом — через порядок DOM:
    // вставляємо перед першим не-shape елементом
    const firstNonShape = [...canvas.children].find(
        c => !c.classList.contains(cm + "-shape") && !c.classList.contains("guide-container")
    );

    _applyShapeStyles(el, shapeType, _shapeStrokeColor, _shapeFillColor, _shapeFillTransparent);

    if (firstNonShape) {
        canvas.insertBefore(el, firstNonShape);
    } else {
        canvas.appendChild(el);
    }

    addResizeHandles(el);
    makeDraggableAndResizable(el);
    isDesignerDirty = true;
    return el;
}

function _applyShapeStyles(el, shapeType, strokeColor, fillColor, fillTransparent) {
    const fill = fillTransparent ? "transparent" : fillColor;

    if (shapeType === "hline") {
        el.style.width           = "200px";
        el.style.height          = "8px";
        el.style.borderTop       = `2px solid ${strokeColor}`;
        el.style.borderLeft      = "none";
        el.style.borderRight     = "none";
        el.style.borderBottom    = "none";
        el.style.backgroundColor = "transparent";
        el.style.borderRadius    = "0";
        el.style.left = "20px";
        el.style.top  = "20px";
    } else if (shapeType === "vline") {
        el.style.width           = "8px";
        el.style.height          = "150px";
        el.style.borderLeft      = `2px solid ${strokeColor}`;
        el.style.borderTop       = "none";
        el.style.borderRight     = "none";
        el.style.borderBottom    = "none";
        el.style.backgroundColor = "transparent";
        el.style.borderRadius    = "0";
        el.style.left = "20px";
        el.style.top  = "20px";
    } else if (shapeType === "rect") {
        el.style.width           = "160px";
        el.style.height          = "80px";
        el.style.border          = `2px solid ${strokeColor}`;
        el.style.backgroundColor = fill;
        el.style.borderRadius    = "0";
        el.style.left = "20px";
        el.style.top  = "20px";
    } else if (shapeType === "round-rect") {
        el.style.width           = "160px";
        el.style.height          = "80px";
        el.style.border          = `2px solid ${strokeColor}`;
        el.style.backgroundColor = fill;
        el.style.borderRadius    = "14px";
        el.style.left = "20px";
        el.style.top  = "20px";
    }
}

function addShapeRect()      { _createShape("rect"); }
function addShapeRoundRect() { _createShape("round-rect"); }
function addShapeHLine()     { _createShape("hline"); }
function addShapeVLine()     { _createShape("vline"); }

function openShapeColorPicker() {
    // Якщо активна фігура — показуємо її поточні кольори
    if (activeElement && activeElement.dataset.shapeType) {
        document.getElementById("shapeStrokeColorInput").value =
            activeElement.dataset.strokeColor || _shapeStrokeColor;
        document.getElementById("shapeFillColorInput").value =
            activeElement.dataset.fillColor || _shapeFillColor;
        document.getElementById("shapeFillTransparentChk").checked =
            activeElement.dataset.fillTransparent === "1";
    } else {
        document.getElementById("shapeStrokeColorInput").value  = _shapeStrokeColor;
        document.getElementById("shapeFillColorInput").value    = _shapeFillColor;
        document.getElementById("shapeFillTransparentChk").checked = _shapeFillTransparent;
    }
    document.getElementById("shapeColorModal").style.display = "flex";
}

function applyShapeColor() {
    const stroke      = document.getElementById("shapeStrokeColorInput").value;
    const fill        = document.getElementById("shapeFillColorInput").value;
    const transparent = document.getElementById("shapeFillTransparentChk").checked;

    // Зберігаємо як поточні дефолтні
    _shapeStrokeColor     = stroke;
    _shapeFillColor       = fill;
    _shapeFillTransparent = transparent;

    // Якщо виділена фігура — оновлюємо її одразу
    if (activeElement && activeElement.dataset.shapeType) {
        const st = activeElement.dataset.shapeType;
        activeElement.dataset.strokeColor      = stroke;
        activeElement.dataset.fillColor        = fill;
        activeElement.dataset.fillTransparent  = transparent ? "1" : "0";
        // Зберігаємо поточні розміри/позицію перед переприсвоєнням стилів
        const savedLeft   = activeElement.style.left;
        const savedTop    = activeElement.style.top;
        const savedWidth  = activeElement.style.width;
        const savedHeight = activeElement.style.height;
        _applyShapeStyles(activeElement, st, stroke, fill, transparent);
        activeElement.style.left   = savedLeft;
        activeElement.style.top    = savedTop;
        activeElement.style.width  = savedWidth;
        activeElement.style.height = savedHeight;
        isDesignerDirty = true;
    }
    document.getElementById("shapeColorModal").style.display = "none";
}

function addScreenGrid() {
    if (screenGridVisible) {
        screenCanvas.style.backgroundImage = "none";
    } else {
        screenCanvas.style.backgroundImage =
            "repeating-linear-gradient(0deg, #ccc 0, #ccc 1px, transparent 1px, transparent 19px), " +
            "repeating-linear-gradient(90deg, #ccc 0, #ccc 1px, transparent 1px, transparent 19px)";
        screenCanvas.style.backgroundSize = "20px 20px";
    }
    screenGridVisible = !screenGridVisible;
}

function addResizeHandles(element) {
    const cursors = {
        "top-left":     "nwse-resize",
        "top-right":    "nesw-resize",
        "bottom-left":  "nesw-resize",
        "bottom-right": "nwse-resize"
    };
    ["top-left", "top-right", "bottom-left", "bottom-right"].forEach(pos => {
        const handle = document.createElement("div");
        handle.classList.add("resize-handle", pos);
        handle.style.cursor = cursors[pos];
        element.appendChild(handle);
    });
}

document.addEventListener("click", (e) => {
    let el = e.target.closest(".report-element");
    if (el) { activeElement = el; return; }
    el = e.target.closest(".form-element");
    if (el) { activeElement = el; return; }
});
