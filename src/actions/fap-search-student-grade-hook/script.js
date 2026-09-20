(function fapSearchStudentGradeHook() {
  'use strict';

  function initGradeTableModifier() {
    const table = document.querySelector('#ctl00_mainContent_gvGrades');
    if (!table) return;

    const headerRow = table.querySelector('tr');
    if (!headerRow) return;

    // Add new header for "Times Learned"
    const timesLearnedHeader = document.createElement('th');
    timesLearnedHeader.scope = 'col';
    timesLearnedHeader.textContent = 'Times Learned';
    headerRow.appendChild(timesLearnedHeader);

    // Get all data rows
    const dataRows = Array.from(table.querySelectorAll('tbody tr'));
    if (dataRows.length === 0) {
      const allRows = Array.from(table.querySelectorAll('tr')).slice(1);
      dataRows.push(...allRows);
    }

    // Count subject code occurrences
    const subjectCounts = {};
    dataRows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length > 1) {
        const subjectCode = cells[1].textContent.trim();
        subjectCounts[subjectCode] = (subjectCounts[subjectCode] || 0) + 1;
      }
    });

    // Add count column to each row
    dataRows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length > 1) {
        const subjectCode = cells[1].textContent.trim();
        const countCell = document.createElement('td');
        countCell.textContent = subjectCounts[subjectCode];
        countCell.style.textAlign = 'center';
        countCell.setAttribute('data-subject-code', subjectCode);
        row.appendChild(countCell);
      }
    });

    // Add per-column filter UI
    addPerColumnFilterUI(table, dataRows, headerRow);
  }

  function addPerColumnFilterUI(table, dataRows, headerRow) {
    const headers = Array.from(headerRow.querySelectorAll('th'));
    const columnCount = headers.length;

    // Create filter row with inputs for each column
    const filterRow = document.createElement('tr');
    filterRow.id = 'fap-filter-row';
    filterRow.style.cssText = 'background-color: #f0f0f0; border-top: 2px solid #ddd;';

    const filterInputs = [];

    headers.forEach((header, colIndex) => {
      const filterCell = document.createElement('td');
      filterCell.style.cssText = 'padding: 8px; border-bottom: 1px solid #ddd;';

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = `Filter ${header.textContent}...`;
      input.className = 'fap-column-filter';
      input.setAttribute('data-column-index', colIndex);
      input.style.cssText = 'width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; box-sizing: border-box; font-size: 12px;';

      filterCell.appendChild(input);
      filterRow.appendChild(filterCell);
      filterInputs.push(input);
    });

    // Insert filter row after header
    headerRow.parentNode.insertBefore(filterRow, headerRow.nextSibling);

    // Apply filters on input change
    function applyFilters() {
      dataRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        let isVisible = true;

        filterInputs.forEach((input, colIndex) => {
          const filterText = input.value.toLowerCase();
          if (filterText === '') return;

          if (colIndex < cells.length) {
            const cellText = cells[colIndex].textContent.trim().toLowerCase();
            if (!cellText.includes(filterText)) {
              isVisible = false;
            }
          }
        });

        row.style.display = isVisible ? '' : 'none';
      });
    }

    filterInputs.forEach(input => {
      input.addEventListener('input', applyFilters);
    });
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGradeTableModifier);
  } else {
    initGradeTableModifier();
  }
})();
