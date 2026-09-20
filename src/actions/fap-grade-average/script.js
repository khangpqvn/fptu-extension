/**
 * FAP Grade Average Calculator
 *
 * Calculates and displays cumulative GPA on the FAP Student Transcript page.
 * Only includes passed subjects with credit > 0, excluding:
 * - Graduation-condition subjects (marked with *)
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
    // Find the main grade table
    const gradeTable = document.querySelector('#ctl00_mainContent_divGrade table.table.table-hover');
    if (!gradeTable) {
      console.log('[fap-grade-average] Grade table not found');
      return;
    }

    const rows = gradeTable.querySelectorAll('tbody tr');
    let totalGradePoints = 0;
    let totalCredits = 0;
    let courseCount = 0;

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 9) return; // Ensure row has enough columns

      const statusCell = cells[9]; // Status column (index 9)
      const creditCell = cells[7];  // Credit column (index 7)
      const gradeCell = cells[8];   // Grade column (index 8)
      const subjectCodeCell = cells[3]; // Subject Code column (index 1)

      // Check if this row is a passed subject (not "Not started", etc.)
      const statusText = statusCell?.textContent?.trim() || '';
      const isPassedSubject = statusText.includes('Passed');

      if (!isPassedSubject) return;

      // Exclude OJT subjects (Subject Code contains OJT, e.g., OJT202)
      const subjectCode = subjectCodeCell?.textContent?.trim() || '';
      if (subjectCode.includes('OJT')) return;

      // Check if this subject is marked as graduation-condition (*)
      const markCell = cells[10]; // Mark column (index 10)
      const hasGraduationMark = markCell && markCell.textContent?.includes('*');

      if (hasGraduationMark) return; // Exclude graduation-condition subjects

      // Parse credit and grade
      const creditText = creditCell?.textContent?.trim() || '';
      const credit = parseFloat(creditText);

      if (!credit || credit <= 0) return; // Exclude zero-credit subjects

      const gradeText = gradeCell?.textContent?.trim() || '';
      // Extract numeric grade from the span element
      const gradeSpan = gradeCell?.querySelector('span.label-primary');
      const grade = gradeSpan ? parseFloat(gradeSpan.textContent.trim()) : parseFloat(gradeText);

      if (!grade || isNaN(grade)) return;

      totalGradePoints += grade * credit;
      totalCredits += credit;
      courseCount++;
    });

    if (totalCredits === 0) {
      console.log('[fap-grade-average] No valid subjects found to calculate average');
      return;
    }

    const gpa = totalGradePoints / totalCredits;

    displayGpaResult(gradeTable, gpa);
  }

  function displayGpaResult(gradeTable, gpa) {
    const rollNumber = document.querySelector('#ctl00_mainContent_lblRollNumber');
    if (!rollNumber) {
      console.log('[fap-grade-average] Roll number container not found');
      return;
    }

    const existingResult = document.querySelector('#fap-gpa-result');
    if (existingResult) {
      existingResult.remove();
    }

    const result = document.createElement('span');
    result.id = 'fap-gpa-result';
    result.className = 'label label-success';
    result.textContent = `GPA: ${gpa.toFixed(2)}`;
    result.style.marginLeft = '4px';

    rollNumber.appendChild(result);
    console.log(`[fap-grade-average] GPA calculated: ${gpa.toFixed(2)}`);
  }
})();
