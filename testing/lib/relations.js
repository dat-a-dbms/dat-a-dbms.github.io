let relationLines = [];
    let selectedFieldEl = null;
    let onRelationModalClose = null;

    function openRelationDesigner(callback) {
        const modal = document.getElementById("relationModal");
        const canvas = document.getElementById("relationCanvas");
        canvas.innerHTML = ""; // очистити
        console.log(">database.relations=",database.relations)
        relationLines = [];
        selectedFieldEl = null;
        onRelationModalClose = callback;
        // Видалити попередні системні зв’язки перед оновленням
        database.relations = database.relations.filter(rel => !rel.readonly);
        database.tables.forEach(table => {
            table.schema.forEach(field => {
                if (field.foreignKey && field.refTable && field.refField) {
                    database.relations.push({
                        fromTable: table.name,
                        fromField: field.title,
                        toTable: field.refTable,
                        toField: field.refField,
                        readonly: true, // 👈 Це можна використовувати для стилізації як "червоний і незмінний"
                    });
                }
            });
        });
        console.log(">>database.relations=",database.relations)
    
        const offsetX = 50, offsetY = 50;
    
        // Створити блоки таблиць
        database.tables.forEach((table, i) => {
            const block = document.createElement("div");
            block.className = "relation-table";
            block.style.position = "absolute";
            block.style.left = `${offsetX + (i % 3) * 300}px`;
            block.style.top = `${offsetY + Math.floor(i / 3) * 250}px`;
            block.style.width = "180px";
            block.style.opacity = "0.65";
            block.style.background = "#fff";
            block.style.border = "1px solid #aaa";
            block.style.boxShadow = "2px 2px 4px rgba(0,0,0,0.1)";
            block.style.cursor = "move";
            block.style.padding = "0px";
            block.dataset.tableName = table.name;
    
            const pkField = table.schema.find(col => col.primaryKey)?.title;
    
            const title = document.createElement("div");
            title.innerText = table.name;
            title.style.fontWeight = "bold";
            title.style.padding = "4px 8px";
            title.style.borderBottom = "1px solid #ccc";
            title.style.borderTopLeftRadius = "4px";
            title.style.borderTopRightRadius = "4px";
            // Кольори заголовку залежно від теми
            const isDark = document.body.classList.contains("dark-theme");            
            title.style.backgroundColor =  "#1f3480";
            
            title.style.color = "#ffffff";
            block.appendChild(title);
    
            const tableList = document.createElement("table");
            table.schema.forEach(field => {
                const row = document.createElement("tr");
                const cell = document.createElement("td");
                cell.innerText = field.title + (field.title === pkField ? " 🔑 " : "");
    
                cell.style.padding = "0px";
                cell.style.border = "1px solid #ddd";
                cell.style.cursor = "pointer";
                cell.style.width = "178px";
                cell.dataset.table = table.name;
                cell.dataset.field = field.title;
    
                cell.addEventListener("click", () => handleFieldClick(cell));
                cell.addEventListener("dblclick", () => {
                    const index = relationLines.findIndex(rel =>
                        (rel.from === cell || rel.to === cell)
                    );
                    if (index !== -1) {
                        const rel = relationLines[index];
                        if (rel.readonly) {
                            Message("Цей зв’язок є системним і не може бути видалений.");
                            return;
                        }
                        relationLines.splice(index, 1);
    
                        // 💾 Оновити database.relations лише для ручних зв’язків
                        const userRelations = relationLines
                            .filter(line => !line.readonly)
                            .map(line => ({
                                fromTable: line.from.dataset.table,
                                fromField: line.from.dataset.field,
                                toTable: line.to.dataset.table,
                                toField: line.to.dataset.field,
                                color: line.color,
                                readonly: false
                            }));
                        
                        const readonlyRelations = database.relations.filter(rel => rel.readonly);
                        database.relations = [...readonlyRelations, ...userRelations];
    
                        saveDatabase();
                        redrawLines();
                    }
                });
    
                row.appendChild(cell);
                tableList.appendChild(row);
            });
    
            block.appendChild(tableList);
            makeDraggable(block);
            canvas.appendChild(block);
        });
    
        // 🔁 Відтворити збережені зв’язки
        relationLines = [];
        console.log(">>>database.relations=",database.relations)
        if (Array.isArray(database.relations)) {
            database.relations.forEach(rel => {
                const fromCell = [...canvas.querySelectorAll("td")]
                    .find(td => td.dataset.table === rel.fromTable && td.dataset.field === rel.fromField);
                const toCell = [...canvas.querySelectorAll("td")]
                    .find(td => td.dataset.table === rel.toTable && td.dataset.field === rel.toField);
    
                if (fromCell && toCell) {
                    relationLines.push({
                        from: fromCell,
                        to: toCell,
                        readonly: rel.readonly || false,
                        color: rel.color || "red"
                    });
                }
            });
        }
    
        requestAnimationFrame(redrawLines); // 🖍 малюємо лінії після DOM
    
        modal.style.display = "flex";
    
        modal.querySelector(".close-btn").onclick = () => {
            modal.style.display = "none";
            if (typeof callback === "function") callback();
        };
    }
    

    function handleFieldClick(cell) {
        if (cell.classList.contains("selected")) {
            cell.classList.remove("selected");
            selectedFieldEl = null;
            redrawLines();
            return;
        }

        if (!selectedFieldEl) {
            cell.classList.add("selected");
            selectedFieldEl = cell;
        } else {
            if (selectedFieldEl === cell) return;

            // Додати зв'язок
            relationLines.push({
                from: selectedFieldEl,
                to: cell
            });

            // 🔄 Зберігаємо у database.relations
            database.relations = relationLines.map(line => ({
                fromTable: line.from.dataset.table,
                fromField: line.from.dataset.field,
                toTable: line.to.dataset.table,
                toField: line.to.dataset.field
            }));
            saveDatabase();


            selectedFieldEl.classList.remove("selected");
            cell.classList.remove("selected");
            selectedFieldEl = null;

            redrawLines();
        }
    }


    function makeDraggable(el) {
        const canvas = document.getElementById("relationCanvas");
        let isDragging = false;
        let offsetX = 0,
            offsetY = 0;

        el.addEventListener("mousedown", e => {
            if (e.target.tagName === "TD") return; // не чіпаємо кліки по полях
            isDragging = true;

            const rect = el.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();

            // Зсув між курсором і верхнім лівим кутом прямокутника
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;

            // Додаємо глобальні обробники
            const onMouseMove = (e) => {
                if (!isDragging) return;

                const x = e.clientX - canvasRect.left - offsetX;
                const y = e.clientY - canvasRect.top - offsetY;

                el.style.left = `${x}px`;
                el.style.top = `${y}px`;

                redrawLines();
            };

            const onMouseUp = () => {
                isDragging = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });
    }



function redrawLines() {
    const canvas = document.getElementById("relationCanvas");

    const existingSvg = document.getElementById("relation-svg");
    if (existingSvg) existingSvg.remove();

    const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgEl.setAttribute("id", "relation-svg");
    svgEl.style.position = "absolute";
    svgEl.style.top = 0;
    svgEl.style.left = 0;
    svgEl.style.width = "100%";
    svgEl.style.height = "100%";
    svgEl.style.zIndex = "0";
    svgEl.style.pointerEvents = "none";

    // <defs> для стрілок
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

    // Червона стрілка (FOREIGN KEY)
    const markerRed = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    markerRed.setAttribute("id", "arrowRed");
    markerRed.setAttribute("markerWidth", "6");
    markerRed.setAttribute("markerHeight", "6");
    markerRed.setAttribute("refX", "6");
    markerRed.setAttribute("refY", "3");
    markerRed.setAttribute("orient", "auto");
    markerRed.setAttribute("markerUnits", "strokeWidth");

    const pathRed = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathRed.setAttribute("d", "M 0 0 L 6 3 L 0 6 z");
    pathRed.setAttribute("fill", "red");
    markerRed.appendChild(pathRed);
    defs.appendChild(markerRed);

    // Блакитна стрілка (користувацькі)
    const markerBlue = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    markerBlue.setAttribute("id", "arrowBlue");
    markerBlue.setAttribute("markerWidth", "6");
    markerBlue.setAttribute("markerHeight", "6");
    markerBlue.setAttribute("refX", "6");
    markerBlue.setAttribute("refY", "3");
    markerBlue.setAttribute("orient", "auto");
    markerBlue.setAttribute("markerUnits", "strokeWidth");

    const pathBlue = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathBlue.setAttribute("d", "M 0 0 L 6 3 L 0 6 z");
    pathBlue.setAttribute("fill", "deepskyblue");
    markerBlue.appendChild(pathBlue);
    defs.appendChild(markerBlue);

    svgEl.appendChild(defs);

    const canvasRect = canvas.getBoundingClientRect();

    relationLines.forEach(line => {
        const fromRect = line.from.getBoundingClientRect();
        const toRect = line.to.getBoundingClientRect();

        const fromCenterX = fromRect.left + fromRect.width / 2 - canvasRect.left;
        const toCenterX = toRect.left + toRect.width / 2 - canvasRect.left;

        // базові координати
        let fromY = fromRect.top + fromRect.height / 2 - canvasRect.top;
        let toY = toRect.top + toRect.height / 2 - canvasRect.top;

        // якщо користувацький зв'язок → зміщуємо вниз
        if (!line.readonly) {
            fromY += 3;
            toY += 3;
        }

        const H_OFFSET = 12;
        let fromX, toX, fromDir, toDir;

        if (fromCenterX < toCenterX) {
            fromX = fromRect.left + fromRect.width - canvasRect.left;
            toX = toRect.left - canvasRect.left;
            fromDir = +1;
            toDir = -1;
        } else {
            fromX = fromRect.left - canvasRect.left;
            toX = toRect.left + toRect.width - canvasRect.left;
            fromDir = -1;
            toDir = +1;
        }

        const p1 = { x: fromX, y: fromY };
        const p2 = { x: fromX + fromDir * H_OFFSET, y: fromY };
        const p4 = { x: toX + toDir * H_OFFSET, y: toY };
        const p5 = { x: toX, y: toY };

        const points = [p1, p2, p4, p5].map(p => `${p.x},${p.y}`).join(" ");

        const path = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        path.setAttribute("points", points);
        path.setAttribute("fill", "none");

        if (line.readonly) {
            path.setAttribute("stroke", "red");
            path.setAttribute("marker-end", "url(#arrowRed)");
        } else {
            path.setAttribute("stroke", "deepskyblue");
            path.setAttribute("marker-end", "url(#arrowBlue)");
        }

        path.setAttribute("stroke-width", "2");
        svgEl.appendChild(path);
    });

    canvas.insertBefore(svgEl, canvas.firstChild);
}









    function saveRelations() {
        // Зберігаємо лише користувацькі зв’язки (не readonly)
        const userRelations = relationLines
            .filter(line => !line.readonly)
            .map(line => ({
                fromTable: line.from.dataset.table,
                fromField: line.from.dataset.field,
                toTable: line.to.dataset.table,
                toField: line.to.dataset.field,
                color: line.color || "black",
                readonly: false
            }));
    
        // Залишаємо системні зв’язки (readonly) без змін
        const systemRelations = database.relations.filter(rel => rel.readonly);
    
        // Оновлюємо всі зв’язки
        database.relations = [...systemRelations, ...userRelations];
    
        saveDatabase();
        Message("Зв’язки збережено.");
        closeRelationModal();
    }
    

    function loadRelationsToJoinTable() {
        const joinTable = document.getElementById("joinBody");
        const tbody = joinTable.querySelector("tbody");
        tbody.innerHTML = "";
        joinTable.style.display = "table";
    
        // Беремо лише не-readonly зв’язки
        database.relations
            .filter(rel => !rel.readonly)
            .forEach(rel => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td><select class="join-table-a" onchange="populateJoinFields(this, true)"></select></td>
                    <td><select class="join-field-a"></select></td>
                    <td><select class="join-table-b" onchange="populateJoinFields(this, false)"></select></td>
                    <td><select class="join-field-b"></select></td>
                    <td><button onclick="this.closest('tr').remove()">✕</button></td>
                `;
                tbody.appendChild(row);
    
                const tableSelectA = row.querySelector(".join-table-a");
                const tableSelectB = row.querySelector(".join-table-b");
                const fieldSelectA = row.querySelector(".join-field-a");
                const fieldSelectB = row.querySelector(".join-field-b");
    
                [tableSelectA, tableSelectB].forEach(select => {
                    select.innerHTML = "<option value=''>Виберіть таблицю</option>";
                    database.tables.forEach(t => {
                        const opt = document.createElement("option");
                        opt.value = t.name;
                        opt.textContent = t.name;
                        select.appendChild(opt);
                    });
                });
    
                tableSelectA.value = rel.fromTable;
                tableSelectB.value = rel.toTable;
    
                populateJoinFields(tableSelectA, true);
                populateJoinFields(tableSelectB, false);
    
                fieldSelectA.value = rel.fromField;
                fieldSelectB.value = rel.toField;
            });
    }
