/**
Перетворюємо на 8-символьний шістнадцятковий рядок
**/
function toHex4Part(num) {
    // Перетворюємо на 8-символьний шістнадцятковий рядок (32 біти = 8 hex)
    const hex = num.toString(16).padStart(8, '0').toUpperCase();
    // Розбиваємо на 4 групи по 2 символи
    return `${hex.slice(0,2)}-${hex.slice(2,4)}-${hex.slice(4,6)}-${hex.slice(6,8)}`;
}
// Перегляд відомостей про базу даних
function showDatabaseInfo() {
    if (!db || !database.fileName) {
        Message(t("commonDbNotLoaded"));
        return;
    }
    let info = `${t("commonFileNameLabel")} ${database.fileName}.sqlite\n\n`;
    // Читаємо user_version
    let dbId = null;
    try {
        const res = db.exec("PRAGMA user_version;");
        console.log("PRAGMA user_version=", res)
        if (res.length && res[0].values.length) {
            dbId = res[0].values[0][0]; // це число
        }
    } catch (e) {
        console.error("Помилка читання user_version: ", e);
    }
    if (dbId !== null && dbId > 0) {
        const hexId = toHex4Part(dbId);
        info += `${t("commonDbIdLabel")} ${hexId}\n`;
    } else {
        info += `${t("commonDbIdLabel")} ${t("commonDbIdNotSet")}\n`;
    }
    info += "\n";
    if (!database.tables.length) {
        info += t("commonDbNoTables");
    } else {
        info += t("commonTablesLabel") + "\n";
        database.tables.forEach(table => {
            try {
                const res = db.exec(`SELECT COUNT(*) AS count FROM "${table.name}"`);
                const count = res.length ? res[0].values[0][0] : 0;
                info += `- ${table.name}: ${count} ${t("commonRecordsLabel")}\n`;
            } catch (e) {
                info += `- ${table.name}: ${t("commonCountError")}\n`;
            }
        });
    }
    // Об'єм бази
    try {
        const exportData = db.export();
        const sizeInBytes = exportData.length;
        const sizeInKB = (sizeInBytes / 1024).toFixed(2);
        const sizeInMB = (sizeInBytes / 1024 / 1024).toFixed(2);
        info += `\n${t("commonFileSizeLabel")} ${sizeInBytes} ${t("commonBytesLabel")} (${sizeInKB} KB, ${sizeInMB} MB)`;
    } catch (e) {
        info += `\n${t("commonSizeCalcError")}`;
    }
    document.getElementById("dbInfoContent").innerText = info;
    document.getElementById("dbInfoModal").style.display = "flex";
}
// Закрити базу даних
function closeDatabase() {
    if (!db) {
        Message(t("commonDbNotOpen"));
        return;
    }
    // Автоматично зберегти перед закриттям
    saveDatabase();
    // Очистити всі змінні
    db = null;
    localStorage.removeItem('lastOpenedFile');
    clearDB();
    updateMainTitle(); // Змінити заголовок на "Виберіть або створіть базу даних"
    document.getElementById("import-table-link").style.display = "none";
    Message(t("commonDbClosed"));
}
// Вихід з програми
function exitApplication() {
    document.getElementById("exitModal").style.display = "flex";
    setTimeout(() => {
        // Спроба закрити вкладку (не завжди працює, залежно від браузера)
        window.open('', '_self', '');
        window.close();
        // Якщо не вдалось — замість цього очистити інтерфейс
        document.body.innerHTML = `<div style='display:flex; align-items:center; justify-content:center; height:100vh; font-size:32px;'>${t("commonWorkCompleted")}</div>`;
    }, 3000);
}
// Глобальний стан панелі
let isStructurePanelOpen = false;
// Показати/приховати кнопку залежно від стану ownSqlModal
function toggleStructureButtonVisibility(show) {
    const toggleBtn = document.getElementById("toggleStructureBtn");
    if (!toggleBtn) return;
    // Встановлюємо видимість кнопки
    if (show === undefined) {
        toggleBtn.style.display = toggleBtn.style.display === "none" ? "inline-block" : "none";
    } else {
        toggleBtn.style.display = show ? "inline-block" : "none";
    }
    // Якщо кнопка ховається - обов'язково ховаємо панель
    if (toggleBtn.style.display === "none") {
        hideStructurePanel();
    }
}
// Відобразити структуру бази даних у панелі
function renderStructurePanel() {
    const content = document.getElementById("structureContent");
    if (!database.tables || database.tables.length === 0) {
        content.innerHTML = `<div style="text-align:center; padding:20px;">${t("commonNoTables")}</div>`;
        return;
    }
    let html = "";
    database.tables.forEach(table => {
        html += `<div style="margin-bottom: 12px;"><strong>${table.name}</strong><ul style="padding-left: 16px; margin: 4px 0;">`;
        table.schema.forEach(field => {
            const pkIcon = field.primaryKey ? " 🔑" : "";
            const fkIcon = field.foreignKey ? " 📌" : "";
            html += `<li>${field.title} (${field.type})${pkIcon}${fkIcon}</li>`;
        });
        html += `</ul></div>`;
    });
    content.innerHTML = html;
}
// Відкрити або закрити панель
function toggleStructurePanel() {
    const panel = document.getElementById("structurePanel");
    if (isStructurePanelOpen) {
        panel.style.right = "-300px";
        isStructurePanelOpen = false;
    } else {
        renderStructurePanel();
        panel.style.right = "0px";
        isStructurePanelOpen = true;
    }
}

function hideStructurePanel() {
    const panel = document.getElementById("structurePanel");
    panel.style.right = "-300px";
    isStructurePanelOpen = false;
}
// Вибір/редагування зображення
function openImageEditor(fieldName, currentValue, onChange) {
    imageEditContext = {
        onChange
    };
    const modal = document.getElementById("imageModal");
    const img = document.getElementById("imagePreview");
    const input = document.getElementById("imageUrlInput");
    img.src = ""; // ⚠️ важливо: скинути src
    img.style.display = "none";
    img.onerror = null; // очистити попередній обробник
    input.value = currentValue || "";
    // Якщо є URL — завантажити зображення з обробкою успіху/помилки
    if (currentValue) {
        // Тимчасово приховуємо — поки не завантажиться
        img.style.display = "none";
        // Створюємо новий образ для перевірки
        const testImg = new Image();
        testImg.onload = () => {
            img.src = currentValue;
            img.style.display = "block";
        };
        testImg.onerror = () => {
            img.style.display = "none";
            // Опціонально: показати повідомлення
        };
        testImg.src = currentValue;
    }
    modal.style.display = "flex";
}

function saveImageUrl() {
    const url = document.getElementById("imageUrlInput").value.trim();
    if (imageEditContext && typeof imageEditContext.onChange === "function") {
        imageEditContext.onChange(url || null);
    }
    closeImageModal();
}

function deleteImageUrl() {
    if (imageEditContext && typeof imageEditContext.onChange === "function") {
        imageEditContext.onChange(null);
    }
    closeImageModal();
}

function previewImageFromUrl() {
    const url = document.getElementById("imageUrlInput").value.trim();
    const img = document.getElementById("imagePreview");
    if (url) {
        img.src = url;
        img.style.display = "block";
        // Опціонально: можна додати обробку помилки завантаження
        img.onerror = () => {
            img.style.display = "none";
            alert(t("commonImageLoadError"));
        };
    } else {
        img.style.display = "none";
    }
}
// ===== URL editor (для типу "файл" у режимі STORE_FILES_IN_DB=false) =====
let urlEditContext = null;

function openUrlEditor(fieldName, currentValue, onChange) {
    urlEditContext = { onChange };

    const modal = document.getElementById("urlModal");
    const input = document.getElementById("urlInput");
    const label = document.getElementById("urlFieldName");

    if (label) label.textContent = fieldName || "";
    input.value = currentValue || "";

    modal.style.display = "flex";
}

function saveFileUrl() {
    const url = document.getElementById("urlInput").value.trim();
    if (urlEditContext && typeof urlEditContext.onChange === "function") {
        urlEditContext.onChange(url || null);
    }
    closeUrlModal();
}

function deleteFileUrl() {
    if (urlEditContext && typeof urlEditContext.onChange === "function") {
        urlEditContext.onChange(null);
    }
    closeUrlModal();
}

function closeUrlModal() {
    document.getElementById("urlInput").value = "";
    document.getElementById("urlModal").style.display = "none";
    urlEditContext = null;
}

// ===== File modal =====
let fileEditContext = null;

function openFileEditor(currentData, onChange) {
    fileEditContext = {
        onChange,
        currentData
    };
    const hasFile = currentData instanceof Uint8Array && currentData.length > 0;
    const imgPreview = document.getElementById("fileImagePreview");
    const docPreview = document.getElementById("fileDocPreview");
    const docName = document.getElementById("fileDocName");
    imgPreview.style.display = "none";
    docPreview.style.display = "none";
    document.getElementById("fileViewBtn").style.display = "none";
    document.getElementById("fileDownloadBtn").style.display = hasFile ? "flex" : "none";
    if (hasFile) {
        const {
            name,
            type,
            data
        } = decodeFileBlob(currentData);
        docName.textContent = name;
        if (type.startsWith("image/")) {
            const blob = new Blob([data], {
                type
            });
            imgPreview.src = URL.createObjectURL(blob);
            imgPreview.style.display = "block";
            document.getElementById("fileViewBtn").style.display = "flex";
        } else {
            docPreview.style.display = "flex";
            document.getElementById("fileViewBtn").style.display = "flex";
        }
    } else {
        docPreview.style.display = "flex";
        docName.textContent = t("commonFileNotSelected");
    }
    document.getElementById("fileModal").style.display = "flex";
}

function previewSelectedFile() {
    const input = document.getElementById("fileInput");
    const file = input.files[0];
    if (!file) return;
    const imgPreview = document.getElementById("fileImagePreview");
    const docPreview = document.getElementById("fileDocPreview");
    const docName = document.getElementById("fileDocName");
    const warning = document.getElementById("fileSizeWarning");
    warning.style.display = file.size > 5 * 1024 * 1024 ? "block" : "none";
    docName.textContent = file.name;
    if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        if (imgPreview.src.startsWith("blob:")) URL.revokeObjectURL(imgPreview.src);
        imgPreview.src = url;
        imgPreview.style.display = "block";
        docPreview.style.display = "none";
    } else {
        imgPreview.style.display = "none";
        docPreview.style.display = "flex";
    }
}
async function saveFileFromInput() {
    const input = document.getElementById("fileInput");
    if (!input.files[0]) {
        closeFileModal();
        return;
    }
    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
        document.getElementById("fileSizeWarning").style.display = "block";
        return;
    }
    const buffer = await file.arrayBuffer();
    const encoded = encodeFileBlob(file.name, file.type, buffer);
    fileEditContext.onChange(encoded);
    closeFileModal();
}

function viewCurrentFile() {
    const {
        name,
        type,
        data
    } = decodeFileBlob(fileEditContext.currentData);
    const blob = new Blob([data], {
        type
    });
    const url = URL.createObjectURL(blob);
    window.open(url);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function downloadCurrentFile() {
    const {
        name,
        type,
        data
    } = decodeFileBlob(fileEditContext.currentData);
    const blob = new Blob([data], {
        type
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}

function deleteCurrentFile() {
    fileEditContext.onChange(null);
    closeFileModal();
}

function closeFileModal() {
    const img = document.getElementById("fileImagePreview");
    if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
    img.src = "";
    document.getElementById("fileInput").value = "";
    document.getElementById("fileSizeWarning").style.display = "none";
    document.getElementById("fileModal").style.display = "none";
    fileEditContext = null;
}

function uint8ToBase64(uint8Array) {
    let binary = "";
    const len = uint8Array.length;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
}

/**
 * Повертає об’єкт { data: Uint8Array, type: MIME } або null
 */
function extractImage(uint8Array) {
    for (let i = 0; i < uint8Array.length - 3; i++) {
        // PNG: 89 50 4E 47
        if (
            uint8Array[i] === 0x89 &&
            uint8Array[i + 1] === 0x50 &&
            uint8Array[i + 2] === 0x4E &&
            uint8Array[i + 3] === 0x47
        ) {
            return { data: uint8Array.slice(i), type: "image/png" };
        }
        // JPG: FF D8 FF
        if (
            uint8Array[i] === 0xFF &&
            uint8Array[i + 1] === 0xD8 &&
            uint8Array[i + 2] === 0xFF
        ) {
            return { data: uint8Array.slice(i), type: "image/jpeg" };
        }
        // GIF: 47 49 46 38
        if (
            uint8Array[i] === 0x47 &&
            uint8Array[i + 1] === 0x49 &&
            uint8Array[i + 2] === 0x46 &&
            uint8Array[i + 3] === 0x38
        ) {
            return { data: uint8Array.slice(i), type: "image/gif" };
        }
    }
    return null;
}
