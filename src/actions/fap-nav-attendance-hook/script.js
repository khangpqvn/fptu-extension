/**
 * Example auto-run script: compute and modify the current page DOM on load.
 *
 * Replace this template with your own logic. The script runs in the MAIN
 * world so it has full access to the page's DOM and JavaScript globals.
 */
(function autoDomModifier() {
  'use strict';
  // =========================
  // ADD LINK TO TAKE ATTENDANCE
  // =========================

  const navSpan = document.getElementById("ctl00_lblNavigation");
  if (navSpan) {
    const firstLink = navSpan.querySelector("a");
    if (firstLink) {
      const takeAttendanceLink = document.createElement("a");
      takeAttendanceLink.href = "https://fap.fpt.edu.vn/Attendance/TakeAttendance.aspx";
      takeAttendanceLink.textContent = "Take Attendance";

      const separator = document.createTextNode(" | ");
      firstLink.after(separator);
      separator.after(takeAttendanceLink);
    }
  }
})();
