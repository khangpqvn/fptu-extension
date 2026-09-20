(() => {
  'use strict';
  const table = document.getElementById(
    'ctl00_mainContent_searchBox_gvSearchResults'
  );

  if (!table) {
    console.error('Không tìm thấy bảng gvSearchResults');
    return;
  }

  // Duyệt các dòng dữ liệu, bỏ qua dòng header
  const rows = table.querySelectorAll('tbody tr');

  rows.forEach((row, index) => {
    if (index === 0) return;

    const cells = row.querySelectorAll('td');

    if (!cells.length) return;

    // Lấy Code từ cột đầu tiên
    const rollNumber = cells[0].textContent.trim();

    if (!rollNumber) return;

    // Không thêm lại nếu script được chạy nhiều lần
    if (row.querySelector('.quick-navigation')) return;

    const quickCell = document.createElement('td');
    quickCell.className = 'quick-navigation';

    const links = [
      {
        text: 'Bảng điểm tốt nghiệp',
        url: `Grade/StudentTranscript.aspx?RollNumber=${encodeURIComponent(rollNumber)}`
      },
      {
        text: 'Điểm chi tiết từng kỳ',
        url: `Grade/StudentGrade.aspx?rollNumber=${encodeURIComponent(rollNumber)}`
      },
      {
        text: 'Lịch sử điểm tổng quát',
        url: `Grade/SearchStudentGrade.aspx?rollNumber=${encodeURIComponent(rollNumber)}`
      },
      {
        text: 'Thông tin điểm danh',
        url: `Report/ViewAttendstudent.aspx?id=${encodeURIComponent(rollNumber)}`
      }
    ];

    links.forEach((item, linkIndex) => {
      const link = document.createElement('a');

      link.href = item.url;
      link.textContent = item.text;
      link.target = '_blank';

      link.style.cssText = `
                display: inline-block;
                margin-right: 6px;
                padding: 4px 8px;
                border: 1px solid #ccc;
                border-radius: 4px;
                background: #f5f5f5;
                color: #333;
                text-decoration: none;
                font-size: 12px;
                white-space: nowrap;
            `;

      quickCell.appendChild(link);
    });

    row.appendChild(quickCell);
  });
})();
