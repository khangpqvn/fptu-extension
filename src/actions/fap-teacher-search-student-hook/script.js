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
        icon: '🎓',
        label: 'Bảng điểm tốt nghiệp',
        url: `Grade/StudentTranscript.aspx?RollNumber=${encodeURIComponent(rollNumber)}`
      },
      {
        icon: '📊',
        label: 'Điểm chi tiết từng kỳ',
        url: `Grade/StudentGrade.aspx?rollNumber=${encodeURIComponent(rollNumber)}`
      },
      {
        icon: '📈',
        label: 'Lịch sử điểm tổng quát',
        url: `Grade/SearchStudentGrade.aspx?rollNumber=${encodeURIComponent(rollNumber)}`
      },
      {
        icon: '✓',
        label: 'Thông tin điểm danh',
        url: `Report/ViewAttendstudent.aspx?id=${encodeURIComponent(rollNumber)}`
      }
    ];

    links.forEach((item) => {
      const link = document.createElement('a');

      link.href = item.url;
      link.textContent = item.icon;
      link.title = item.label;
      link.setAttribute('aria-label', item.label);
      link.target = '_blank';

      link.style.cssText = `
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 36px;
                height: 36px;
                margin-right: 6px;
                border: 1px solid #ccc;
                border-radius: 4px;
                background: #f5f5f5;
                color: #333;
                text-decoration: none;
                font-size: 18px;
                white-space: nowrap;
                cursor: pointer;
                transition: all 0.2s ease;
            `;

      link.addEventListener('mouseenter', function () {
        this.style.background = '#e8e8e8';
        this.style.borderColor = '#999';
      });

      link.addEventListener('mouseleave', function () {
        this.style.background = '#f5f5f5';
        this.style.borderColor = '#ccc';
      });

      link.addEventListener('focus', function () {
        this.style.outline = '2px solid #0066cc';
        this.style.outlineOffset = '2px';
      });

      link.addEventListener('blur', function () {
        this.style.outline = 'none';
      });

      quickCell.appendChild(link);
    });

    row.appendChild(quickCell);
  });
})();
