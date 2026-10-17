/**
 * FAP Grade Average Calculator
 *
 * Calculates and displays cumulative GPA on FAP transcript pages.
 * Only includes passed subjects with credit > 0, excluding:
 * - Graduation-condition subjects (marked with *) on the legacy transcript
 * - OJT subjects (Subject Code contains OJT, e.g., OJT202)
 *
 * Formula: GPA = Σ(grade × credit) / Σ(credit)
 */
(function fapGradeAverage() {
  'use strict';

  // Wait for DOM to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', calculateAndDisplayAverage);
  } else {
    calculateAndDisplayAverage();
  }

  function calculateAndDisplayAverage() {
    const legacyGradeTable = document.querySelector(
      '#ctl00_mainContent_divGrade table.table.table-hover'
    );
    const gradeTable = legacyGradeTable || document.querySelector('table.fap-sheet');

    if (!gradeTable) {
      console.log('[fap-grade-average] Grade table not found');
      return;
    }

    const rows = gradeTable.querySelectorAll('tbody tr');
    let totalGradePoints = 0;
    let totalCredits = 0;

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 10) return;

      const statusText = cells[9].textContent?.trim().toLocaleLowerCase() || '';
      const isPassedSubject = statusText === 'passed' || statusText === 'đạt';
      if (!isPassedSubject) return;

      const subjectCode = cells[3].textContent?.trim().toLocaleUpperCase() || '';
      const subjectName = cells[6].textContent?.trim().toLocaleLowerCase() || '';
      if (
        subjectCode.includes('OJT') ||
        subjectName.includes('vovinam') ||
        subjectName.includes('on-the-job training')
      ) return;

      // The legacy transcript has a separate graduation-condition mark column.
      if (gradeTable === legacyGradeTable && cells.length > 10) {
        const markText = cells[10].textContent || '';
        if (markText.includes('*')) return;
      }

      const credit = parseNumber(cells[7].textContent);
      const gradeText = cells[8].querySelector('span')?.textContent || cells[8].textContent;
      const grade = parseNumber(gradeText);

      if (!Number.isFinite(credit) || credit <= 0) return;
      if (!Number.isFinite(grade)) return;

      totalGradePoints += grade * credit;
      totalCredits += credit;
    });

    if (totalCredits === 0) {
      console.log('[fap-grade-average] No valid subjects found to calculate average');
      return;
    }

    const gpa = totalGradePoints / totalCredits;
    displayGpaResult(gradeTable, gpa);
  }

  function parseNumber(value) {
    const normalizedValue = (value || '').trim().replace(',', '.');
    if (!normalizedValue || normalizedValue === '-') return Number.NaN;
    return Number(normalizedValue);
  }

  function displayGpaResult(gradeTable, gpa) {
    const legacyAnchor = document.querySelector('#ctl00_mainContent_lblRollNumber');
    const studentAnchor = Array.from(document.querySelectorAll('.text-muted')).find(element =>
      /\b[A-Z]{2}\d{6}\s*-/.test(element.textContent || '')
    );
    const resultAnchor = legacyAnchor || studentAnchor;

    if (!resultAnchor) {
      console.log('[fap-grade-average] Student identity container not found');
      return;
    }

    document.querySelector('#fap-gpa-result')?.remove();

    const result = document.createElement('span');
    result.id = 'fap-gpa-result';
    result.className = gradeTable.matches('table.fap-sheet')
      ? 'badge bg-success'
      : 'label label-success';
    result.textContent = `GPA: ${gpa.toFixed(2)}`;
    result.style.marginLeft = '4px';

    resultAnchor.appendChild(result);
    console.log(`[fap-grade-average] GPA calculated: ${gpa.toFixed(2)}`);
  }
})();
