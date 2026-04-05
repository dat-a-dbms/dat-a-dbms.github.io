// оновлення інформації
function updateMainTitle() {
        const titleBar = document.getElementById("mainTitle");
        if (database.fileName) {
            titleBar.textContent = t("uiDataBase") + database.fileName;
        } else {
            titleBar.textContent = t("uiSelectOrCreate");
        }
}
/**
* Функція closeEditModal()
* Призначення: Закриває вікно редагування таблиці, скидаючи вибрані значення.
**/
function closeEditModal() {
    document.getElementById("editModal").style.display = "none"; // Ховаємо вікно
    currentEditTable = null; // Скидаємо редаговану таблицю
    selectedCell = null; // Скидаємо вибрану клітинку
}

/** 
* Функція closeDbModal()
* Призначення: Закриває модальне вікно створення бази даних.
**/
function closeDbModal() {
    document.getElementById("dbModal").style.display = "none";
}
/** 
* Функція closeModal()
* Призначення: Закриває модальне вікно створення таблиці.
**/
function closeModal() {
    document.getElementById("modal").style.display = "none";
}
/** 
 * Відображає модальне вікно з повідомленням
 * Параметри:
 *   msg — текст повідомлення, яке потрібно показати
 **/
function Message(msg) {
    const modal = document.getElementById("messageModal"); // Отримати елемент модального вікна
    const content = document.getElementById("messageContent"); // Отримати блок для тексту

    content.innerText = msg; // Встановити текст повідомлення
    modal.style.display = "flex"; // Показати вікно
}

/** 
 * Приховує модальне вікно повідомлення 
 **/
function closeMessage() {
    document.getElementById("messageModal").style.display = "none"; // Сховати вікно
}

/** 
 * Приховує модальне вікно підтвердження видалення 
 **/
function closeDeleteModal() {
    document.getElementById("deleteModal").style.display = "none"; // Сховати
    dbToDelete = null; // Очистити значення
}
/** 
 * Приховує модальне вікно конструктора запиту
 **/
function closeQueryModal() {
    document.getElementById("queryModal").style.display = "none";
    toggleStructureButtonVisibility(false);
}

function closeSavedTablesDialog() {
        document.getElementById("savedTablesModal").style.display = "none";
        selectedTableNameForEdit = null;
}

function closeReportPreview() {
        document.getElementById("reportPreviewModal").style.display = "none";
}

function closeRelationModal() {
        document.getElementById("relationModal").style.display = "none";
        if (typeof onRelationModalClose === "function") {
            onRelationModalClose();
            onRelationModalClose = null; // очистити
        }
}

function closeFormModal() {
        document.getElementById("formCreatorModal").style.display = "none";
        // Ensure the field selection panel is hidden when closing the modal
        document.getElementById("fieldSelectionModal").style.display = "none";        
        // Ensure grid is off when closing report creator
        document.getElementById("formCanvas").classList.remove('grid-visible');
        isGridVisible = false;

}

// Закрити модальне вікно
function closeCsvImportDialog() {
    document.getElementById("csvImportModal").style.display = "none";
}

function closeDbInfoModal() {
        document.getElementById("dbInfoModal").style.display = "none";
}

function closeTextOptionsModal() {
        document.getElementById("textOptionsModal").style.display = "none";
}

function closeReportCreatorModal() {
    document.getElementById("reportCreatorModal").style.display = "none";
    document.getElementById("reportCanvas").classList.remove('grid-visible');
    isGridVisible = false;
}

function showAboutModal() {
        const modal = document.getElementById("aboutModal");
        modal.style.display = "flex";
}

function closeAboutModal() {
        const modal = document.getElementById("aboutModal");
        modal.style.display = "none";
}

function closeStorageDialog() {
        document.getElementById("storageModal").style.display = "none";
}

function closeFormPreview() {
    document.getElementById("formPreviewModal").style.display = "none";
    currentPreviewForm = null; 
}

// Закриває модальне вікно ручного введення SQL-запитів.
function closeOwnSqlModal() {
        document.getElementById("ownSqlModal").style.display = "none";
        toggleStructureButtonVisibility(false);
}

function openTableByName(name) {
     console.log("edit=",database.tables[name])
     selectedTableNameForEdit = name
     openSelectedTable()
     }
 //
 function editQueryByName(name) { 
    console.log("edit=",name);
    selectedQueryName = name;
    editSelectedQuery()
 }
 function editReportByName(name) { 
    console.log("edit=",name);
    selectedReportName = name;
    editSelectedReport()
 }
 function editFormByName(name) { 
    console.log("edit=",name);
    selectedFormName = name;
    editSelectedForm()
 }

// Панель швидкого доступу
function getCurrentTableNames() {
    return (database.tables || []).map(t => t.name);
}

function getCurrentQueryNames() {
    return (queries.definitions || []).map(q => q.name);
}

function getCurrentReportNames() {
    return (database.reports || []).map(r => r.name);
}

function getCurrentFormNames() {
    return (database.forms || []).map(f => f.name);
}

function updateQuickAccessPanel(tables, qqueries, reports, forms) {
    const panel = document.getElementById("quickAccessPanel");
    const sections = [
        {
            id: "quickTables",
            iconsId: "quickTablesIcons",
            items: tables,
            icon: "📄",
            image: "img/table-icon.png",
            openFunc: openTableByName
        },
        {
            id: "quickQueries",
            iconsId: "quickQueriesIcons",
            items: qqueries,
            icon: "🔍",
            image: "img/query-icon.png",
            openFunc: editQueryByName
        },
        {
            id: "quickReports",
            iconsId: "quickReportsIcons",
            items: reports,
            icon: "📝",
            image: "img/report-icon.png",
            openFunc: editReportByName
        },
        {
            id: "quickForms",
            iconsId: "quickFormsIcons",
            items: forms,
            icon: "📑",
            image: "img/form-icon.png",
            openFunc: editFormByName
        }
    ];

    let hasAny = false;

    sections.forEach(section => {
        const container = document.getElementById(section.id);
        const iconsContainer = document.getElementById(section.iconsId);
        iconsContainer.innerHTML = "";

        if (section.items && section.items.length) {
            container.style.display = "block";
            hasAny = true;
            section.items.forEach(name => {
                const el = document.createElement("div");
                el.className = "quick-icon";
                el.innerHTML = `
                    <div class='icon'>
                        <img src="${section.image}" alt="icon" />
                    </div>
                    <div>${name}</div>`;
                el.onclick = () => section.openFunc(name);
                iconsContainer.appendChild(el);
            });
        } else {
            container.style.display = "none";
        }
    });

    panel.style.display = hasAny ? "flex" : "none";
    document.getElementById("startPrompt").style.display = "none";
    document.getElementById("logo-image").style.display = "none";
    document.getElementById("title-image").style.display = "block";
}
    

function openMainMenu() {
      document.getElementById("mainMenuModal").style.display = "flex";
}

function closeMainMenu() {
      document.getElementById("mainMenuModal").style.display = "none";
}
    
function closeAllModals() {
      document.querySelectorAll(".modal").forEach(modal => {
        modal.style.display = "none";
      });
}
    
function filesMenu() {
      closeAllModals();
      document.getElementById("files_Modal").style.display = "flex";
}
    
function createMenu() {
      closeAllModals();
      document.getElementById("create_Modal").style.display = "flex";
}
    
 function dataMenu() {
      closeAllModals();
      document.getElementById("data_Modal").style.display = "flex";
      document.getElementById("data_Modal").style.display = "flex";
}
    
function tablesMenu() {
      closeAllModals();
      document.getElementById("tables_Modal").style.display = "flex";
}
    
function queriesMenu() {
      closeAllModals();
      document.getElementById("queries_Modal").style.display = "flex";
}
    
function reportsMenu() {
      closeAllModals();
      document.getElementById("reports_Modal").style.display = "flex";
 }
    
 function formsMenu() {
      closeAllModals();
      document.getElementById("forms_Modal").style.display = "flex";
}
    
function helpMenu() {
      closeAllModals();
      document.getElementById("help_Modal").style.display = "flex";
}
    
window.addEventListener("click", function(event) {
  // Перевіряємо, чи елемент має клас "modal"
  if (event.target.classList.contains("modal")) {

    // Якщо це ownSqlModal — не закриваємо
    if (event.target.id === "ownSqlModal") return; ""
    // Для всіх інших модалей — закриваємо
    event.target.style.display = "none";
  }
});

function closeImportTableDialog() {
  document.getElementById("importTableModal").style.display = "none";
  document.getElementById("previewArea").innerHTML = "";
}

function closeImageModal() {
  document.getElementById("imageModal").style.display = "none";
  imageEditContext = null;
}

