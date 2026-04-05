// Конструктор звітів
function createReport() {
	if(!isDBExist()) return    
        constructorMode = "report";
        createConstructor();
    }
    
// Редагування обраного звіту
function editSelectedReport() {
        if (!selectedReportName) {
            Message(t("reportSelectForEdit"));
            return;
        }
        document.getElementById("reportListModal").style.display = "none";
        const report = database.reports.find(r => r.name === selectedReportName);
        if (!report) {
            Message(t("reportNotFound"));
            return;
        }
        constructorMode = "report";
        screenCanvas = document.getElementById(constructorMode+"Canvas");
        renderCanvas(report);

        document.getElementById("reportCreatorModal").style.display = "flex";

        Message(t("reportLoadedForEdit", report.name));
}    

// Вікно перегляду створених звітів
function showReportsList() {
        const listEl = document.getElementById("reportList");
        listEl.innerHTML = "";
        selectedReportName = null;

        database.reports.forEach((report) => {
            console.log("report=", report)
            const li = document.createElement("li");
            li.textContent = report.name;
            li.style.padding = "8px";
            li.style.cursor = "pointer";
            li.dataset.reportName = report.name; // Store the report name in a data attribute

            li.addEventListener("click", () => {
                [...listEl.children].forEach(el => el.style.background = "");
                const isDark = document.body.classList.contains("dark-theme");
                li.style.background = isDark ? "#242d43" : "#d0e0ff";
                selectedReportName = li.dataset.reportName;
            });
            listEl.appendChild(li);
        });
        document.getElementById("reportListModal").style.display = "flex";
}

function closeReportList() {
        document.getElementById("reportListModal").style.display = "none";
}

function deleteSelectedReport() {
        if (!selectedReportName) {
            Message(t("reportSelectForDelete"));
            return;
        }

        const reportIndex = database.reports.findIndex(r => r.name === selectedReportName);
        if (reportIndex === -1) {
            Message(t("reportNotFoundForDelete"));
            return;
        }

        const deletedName = database.reports[reportIndex].name;
        database.reports.splice(reportIndex, 1); // видаляємо зі списку

        saveDatabase(); // зберігаємо зміни

        // Видаляємо зі списку "Дані", якщо він там був
        const dataMenu = document.getElementById("data-menu");
        const menuItem = Array.from(dataMenu.children).find(item => item.textContent === deletedName);
        if (menuItem) menuItem.remove();

        Message(t("reportDeleted", deletedName));
        showReportsList(); // оновлюємо список звітів
}

function previewSelectedReport() {
        if (!selectedReportName) {
            Message(t("reportSelectForPreview"));
            return;
        }

        const report = database.reports.find(r => r.name === selectedReportName);
        if (!report) {
            Message(t("reportNotFound"));
            return;
        }

        previewReport(report); // функція вже реалізована для перегляду
}

function previewReport(report = null) {
        const previewModal = document.getElementById("reportPreviewModal");
        const previewCanvas = document.getElementById("reportPreviewCanvas");
        const titleEl = document.getElementById("reportPreviewTitle");
    
        previewCanvas.innerHTML = "";
    
        let elements = [];
        let reportName = "";
    
        if (report) {
            reportName = report.name || t("reportNoName");
            elements = report.elements || [];
        } else {
            reportName = document.getElementById("reportNameInput").value.trim();
            const canvasElements = document.querySelectorAll("#reportCanvas .report-element");
            elements = Array.from(canvasElements).map(el => {
                const type = el.classList.contains("report-label") ? "label" : "field";
                return {
                    type: type,
                    text: el.innerText.trim(),
                    left: el.style.left,
                    top: el.style.top,
                    width: el.style.width,
                    height: el.style.height,
                    fontFamily: el.style.fontFamily || 'Arial',
                    fontSize: el.style.fontSize || '16px',
                    fontWeight: el.style.fontWeight || 'normal',
                    fontStyle: el.style.fontStyle || 'normal',
                    textDecoration: el.style.textDecoration || '',
                    color: el.style.color || '#000000',
                    textAlign: el.style.textAlign || 'left', 
                    tableName: el.dataset.tableName || '',
                    fieldName: el.dataset.fieldName || ''
                };
            });
        }
    
        titleEl.innerText = reportName;
    
        elements.forEach(el => {
            const clone = document.createElement("div");
    
            Object.assign(clone.style, {
                position: "absolute",
                left: addPx(el.left),
                top: addPx(el.top),
                width: addPx(el.width),
                height: addPx(el.height),
                fontFamily: el.fontFamily,
                fontSize: el.fontSize,
                fontWeight: el.fontWeight,
                fontStyle: el.fontStyle,
                textDecoration: el.textDecoration,
                color: el.color,
                textAlign: el.textAlign || 'left',
                padding: "5px",
                boxSizing: "border-box",
                overflow: "auto",
                whiteSpace: "pre-line",
                border: "none",
                backgroundColor: "transparent"
            });
    
            if (el.type === "label") {
                clone.innerText = el.text;
            } else if (el.type === "field") {
                const tableName = el.tableName;
                const fieldName = el.fieldName;
    
                const table = findTableOrQuery(tableName);
    
                if (!table || table.data.length === 0) {
                    clone.innerText = t("reportTableEmpty");
                } else {
                    const colIndex = table.schema.findIndex(col => col.title === fieldName);
                    if (colIndex === -1) {
                        clone.innerText = t("reportFieldNotFound");
                    } else {
                        const colSchema = table.schema[colIndex];
    
                        // Обробка зовнішнього ключа з subst
                        if (colSchema.foreignKey && colSchema.subst && colSchema.refTable && colSchema.refField) {
                            const refTable = findTableOrQuery(colSchema.refTable);
                            if (refTable && refTable.data.length > 0) {
                                const refColIndex = refTable.schema.findIndex(c => c.title === fieldName);
                                const refFieldIndex = refTable.schema.findIndex(c => c.title === colSchema.refField);
    
                                if (refColIndex !== -1 && refFieldIndex !== -1) {
                                    const lines = table.data.map(row => {
                                        const fkValue = row[colIndex];
                                        const refRow = refTable.data.find(r => String(r[refFieldIndex]) === String(fkValue));
                                        return refRow ? refRow[refColIndex] : "";
                                    });
                                    clone.innerText = lines.join("\n");
                                } else {
                                    clone.innerText = t("reportRefFieldNotFound");
                                }
                            } else {
                                clone.innerText = t("reportRefTableEmpty");
                            }
                        }
                        // Обробка зображення (з типом "Зображення")
                        else if (colSchema.type && String(colSchema.type).toLowerCase().includes("зображен")) {
                            if (table.data.length === 1) {
                                const url = table.data[0][colIndex];
                                clone.innerHTML = "";
                                if (url) {
                                    const img = document.createElement("img");
                                    img.src = url;
                                    Object.assign(img.style, {
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "contain",
                                        display: "block"
                                    });
                                    clone.appendChild(img);
                                }
                            } else {
                                const lines = table.data.map(row => row[colIndex] ?? "");
                                clone.innerText = lines.join("\n");
                            }
                        }
                        // Звичайні поля (включаючи результати запитів)
                        else {
                            const values = table.data.map(row => row[colIndex] ?? "");
                            const recordCount = table.data.length;
    
                            if (recordCount === 1 && looksLikeImageUrl(values[0])) {
                                const url = values[0];
                                clone.innerHTML = "";
                                const img = document.createElement("img");
                                img.src = url;
                                Object.assign(img.style, {
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain",
                                    display: "block"
                                });
                                clone.appendChild(img);
                            } else {
                                clone.innerText = values.join("\n");
                            }
                        }
                    }
                }
            }
    
            // ✅ Додаємо clone у будь-якому випадку — для label і field
            previewCanvas.appendChild(clone);
        });
    
        previewModal.style.display = "flex";
 }

function saveReport() {
        const reportName = document.getElementById("reportNameInput").value.trim();
        const reportCanvas = document.getElementById("reportCanvas");

        const elements = [...reportCanvas.querySelectorAll('.report-element')].map(el => {
            const type = el.classList.contains("report-label") ? "label" : "field";

            return {
                type,
                left: el.offsetLeft,
                top: el.offsetTop,
                width: el.offsetWidth,
                height: el.offsetHeight,
                fontFamily: el.style.fontFamily.replace(/['"]/g, '') || "Arial",
                fontSize: el.style.fontSize || "16px",
                fontWeight: el.style.fontWeight || "normal",
                fontStyle: el.style.fontStyle || "normal",
                textDecoration: el.style.textDecoration || "",
                color: el.style.color || "#000000",
                textAlign: el.style.textAlign || "left",
                text: el.innerText || "",
                tableName: el.dataset.tableName || null,
                fieldName: el.dataset.fieldName || null            
            };
        });

        const reportObject = {
            name: reportName,
            elements
        };

        // Зберігаємо у пам’яті
        const index = database.reports.findIndex(r => r.name === reportName);
        if (index !== -1) {
            database.reports[index] = reportObject;
        } else {
            database.reports.push(reportObject);
        }

        saveDatabase();
        Message(t("reportSaved", reportName));
}

function deleteActiveElement() {
        if (!activeElement) {
            Message(t("reportDeleteElement"));
            return;
        }

        const confirmed = confirm(t("reportDeleteConfirm"));
        if (!confirmed) return;

        activeElement.remove();
        activeElement = null;

        // Закрити додаткові панелі
        document.getElementById("fieldSelectionModal").style.display = "none";
        closeTextOptionsModal();
} 

// Перегляд створеного звіту
function printReportPreview() {
        const previewContent = document.getElementById("reportPreviewCanvas");
    
        if (!previewContent) {
            alert(t("reportNoPrint"));
            return;
        }
    
        // Створюємо нове вікно для друку
        const printWindow = window.open('', '_blank');
    
        // Формуємо вміст
        printWindow.document.write(`
            <html>
            <head>
                <title>${t("reportPrintTitle")}</title>
                <style>
                    body { margin: 0; font-family: Arial, sans-serif; }
                    #reportPreviewCanvas {
                        position: relative;
                        width: 100%;
                        height: auto;
                        border: none;
                    }
                    .report-label, .report-field {
                        position: absolute;
                        box-sizing: border-box;
                        border: 1px solid #ccc;
                        padding: 2px;
                    }
                    .field-text {
                        font-style: italic;
                    }
                </style>
            </head>
            <body>
                <div id="reportPreviewCanvas">
                    ${previewContent.innerHTML}
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        window.onafterprint = () => window.close();
                    };
                </script>
            </body>
            </html>
        `);
    
        printWindow.document.close();
    }
