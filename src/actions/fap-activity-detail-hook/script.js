(function fapActivityDetailHook() {
  'use strict';

  function addAttendanceGroupLink() {
    const contentDiv = document.getElementById('ctl00_mainContent_divContent');
    if (!contentDiv) return;

    const table = contentDiv.querySelector('table');
    if (!table) return;

    const rows = table.querySelectorAll('tr');
    let groupId = null;

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        const label = cells[0].textContent.trim();
        if (label === 'Student group') {
          const link = cells[1].querySelector('a');
          if (link) {
            const href = link.getAttribute('href');
            const match = href.match(/group=(\d+)/);
            if (match) {
              groupId = match[1];
            }
          }
        }
      }
    });

    if (!groupId) return;

    const lastRow = rows[rows.length - 1];
    if (!lastRow) return;

    const newRow = document.createElement('tr');
    newRow.setAttribute('align', 'left');

    const labelCell = document.createElement('td');
    labelCell.textContent = 'Attendance:';
    newRow.appendChild(labelCell);

    const linkCell = document.createElement('td');
    const attendanceLink = document.createElement('a');
    attendanceLink.href = `https://fap.fpt.edu.vn/Report/AttendanceGroup.aspx?group=${groupId}`;
    attendanceLink.textContent = 'View Group Attendance';
    attendanceLink.className = 'btn btn-info';
    attendanceLink.style.cssText = 'display: inline-block; padding: 6px 12px; background-color: #5bc0de; color: white; text-decoration: none; border-radius: 4px; margin-right: 5px;';
    linkCell.appendChild(attendanceLink);
    newRow.appendChild(linkCell);

    lastRow.parentNode.insertBefore(newRow, lastRow.nextSibling);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addAttendanceGroupLink);
  } else {
    addAttendanceGroupLink();
  }
})();
