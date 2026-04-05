    // Functions for managing saved tables
    function showSavedTablesDialog() {
        const listEl = document.getElementById("savedTablesList");
        listEl.innerHTML = "";
        selectedTableNameForEdit = null; // Reset selection

        database.tables.forEach(table => {
            const li = document.createElement("li");
            li.textContent = table.name;
            li.style.padding = "8px";
            li.style.cursor = "pointer";
            li.dataset.tableName = table.name; // Store the table name in a data attribute

            li.addEventListener("click", () => {
                [...listEl.children].forEach(el => el.style.background = "");
                const isDark = document.body.classList.contains("dark-theme");
                li.style.background = isDark ? "#242d43" : "#d0e0ff";// Functions for managing saved tables
    function showSavedTablesDialog() {
        const listEl = document.getElementById("savedTablesList");
        listEl.innerHTML = "";
        selectedTableNameForEdit = null; // Reset selection

        database.tables.forEach(table => {
            const li = document.createElement("li");
            li.textContent = table.name;
            li.style.padding = "8px";
            li.style.cursor = "pointer";
            li.dataset.tableName = table.name; // Store the table name in a data attribute

            li.addEventListener("click", () => {
                [...listEl.children].forEach(el => el.style.background = "");
                const isDark = document.body.classList.contains("dark-theme");
                li.style.background = isDark ? "#242d43" : "#d0e0ff";
                selectedTableNameForEdit = li.dataset.tableName;
            });
            listEl.appendChild(li);
        });
        document.getElementById("savedTablesModal").style.display = "flex";
    }



    function openSelectedTable() {
        if (!selectedTableNameForEdit) {
            Message(t("tableSelectForOpen"));
            return;
        }
        editData(selectedTableNameForEdit); // Use existing editData function
        closeSavedTablesDialog();
    }

    function confirmDeleteTable() {
        if (!selectedTableNameForEdit) {
            Message(t("tableSelectForDelete"));
            return;
        }
        selectedTableNameForDelete = selectedTableNameForEdit; // Store for confirmation
        document.getElementById("deleteTableConfirmText").innerHTML =
            t("tableDeleteConfirm", selectedTableNameForDelete);
        document.getElementById("deleteTableConfirmModal").style.display = "flex";
    }

    function doDeleteTable() {
        if (selectedTableNameForDelete) {
            try {
                db.run(`DROP TABLE IF EXISTS "${selectedTableNameForDelete}"`);
                // Remove from in-memory database.tables array
                database.tables = database.tables.filter(t => t.name !== selectedTableNameForDelete);
                saveDatabase(); // Persist changes to localStorage

                // Remove from "Дані" menu
                const dataMenu = document.getElementById("data-menu");
                const menuItemToRemove = Array.from(dataMenu.children).find(item => item.textContent === selectedTableNameForDelete);
                if (menuItemToRemove) {
                    menuItemToRemove.remove();
                }

                Message(t("tableDeleted", selectedTableNameForDelete));
                closeDeleteTableConfirmModal();
                showSavedTablesDialog(); // Refresh the list in the dialog
            } catch (e) {
                Message(t("tableDeleteError", e.message));
            }
        }
    }

    function closeDeleteTableConfirmModal() {
        document.getElementById("deleteTableConfirmModal").style.display = "none";
        selectedTableNameForDelete = null;
    }
                selectedTableNameForEdit = li.dataset.tableName;
            });
            listEl.appendChild(li);
        });
        document.getElementById("savedTablesModal").style.display = "flex";
    }



    function openSelectedTable() {
        if (!selectedTableNameForEdit) {
            Message("Будь ласка, оберіть таблицю для відкриття.");
            return;
        }
        editData(selectedTableNameForEdit); // Use existing editData function
        closeSavedTablesDialog();
    }

    function confirmDeleteTable() {
        if (!selectedTableNameForEdit) {
            Message("Будь ласка, оберіть таблицю для видалення.");
            return;
        }
        selectedTableNameForDelete = selectedTableNameForEdit; // Store for confirmation
        document.getElementById("deleteTableConfirmText").innerHTML =
            `Ви дійсно хочете видалити таблицю <b>"${selectedTableNameForDelete}"</b>?`;
        document.getElementById("deleteTableConfirmModal").style.display = "flex";
    }

    function doDeleteTable() {
        if (selectedTableNameForDelete) {
            try {
                db.run(`DROP TABLE IF EXISTS "${selectedTableNameForDelete}"`);
                // Remove from in-memory database.tables array
                database.tables = database.tables.filter(t => t.name !== selectedTableNameForDelete);
                saveDatabase(); // Persist changes to localStorage

                // Remove from "Дані" menu
                const dataMenu = document.getElementById("data-menu");
                const menuItemToRemove = Array.from(dataMenu.children).find(item => item.textContent === selectedTableNameForDelete);
                if (menuItemToRemove) {
                    menuItemToRemove.remove();
                }

                Message(`Таблицю "${selectedTableNameForDelete}" видалено.`);
                closeDeleteTableConfirmModal();
                showSavedTablesDialog(); // Refresh the list in the dialog
            } catch (e) {
                Message(`Помилка видалення таблиці: ${e.message}`);
            }
        }
    }

    function closeDeleteTableConfirmModal() {
        document.getElementById("deleteTableConfirmModal").style.display = "none";
        selectedTableNameForDelete = null;
    }
