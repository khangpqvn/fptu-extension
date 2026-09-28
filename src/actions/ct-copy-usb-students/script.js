(() => {
  const rows = [...document.querySelectorAll('.row-of-student-vdi')];

  const invalidValues = new Set();
  document.querySelectorAll('select[name="studentVDIIds"] option').forEach((opt) => {
    const text = opt.textContent.trim();
    if (text === 'LOCK' || text === 'ERROR') {
      invalidValues.add(opt.value);
    }
  });

  const studentNumbers = rows
    .filter((row) => {
      const option = row
        .querySelector('select[name="studentVDIIds"]')
        ?.selectedOptions[0];

      if (!option || !option.value) return false;
      return !invalidValues.has(option.value);
    })
    .map((row) => row.querySelector('.student-studentNumber-vdi')?.textContent.trim())
    .filter(Boolean);

  const text = studentNumbers.join(',');

  function showStatus(message, isError = false) {
    const existingStatus = document.getElementById('__ct-copy-usb-status');
    existingStatus?.remove();

    const status = document.createElement('div');
    status.id = '__ct-copy-usb-status';
    status.textContent = message;
    status.style.cssText = [
      'position:fixed',
      'right:20px',
      'bottom:20px',
      'z-index:2147483647',
      'max-width:calc(100vw - 40px)',
      'padding:12px 16px',
      'border-radius:8px',
      'background:' + (isError ? '#b42318' : '#027a48'),
      'color:#fff',
      'font:600 14px/1.4 Arial,sans-serif',
      'box-shadow:0 4px 12px rgba(0,0,0,.2)',
    ].join(';');
    document.body.appendChild(status);
    setTimeout(() => status.remove(), 4000);
  }

  function copyTextWithFallback(value) {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;';
    document.body.appendChild(textarea);

    let copied = false;
    try {
      textarea.focus({ preventScroll: true });
      textarea.select();
      textarea.setSelectionRange(0, value.length);
      copied = document.execCommand('copy');
    } catch (error) {
      console.warn('[ct-copy-usb-students] execCommand lỗi:', error);
    } finally {
      textarea.remove();
    }
    return copied;
  }

  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (error) {
        console.warn('[ct-copy-usb-students] clipboard API lỗi:', error.name, '-', error.message);
      }
    }

    return copyTextWithFallback(value);
  }

  if (studentNumbers.length === 0) {
    showStatus('Không tìm thấy sinh viên được gán USB.', true);
    return;
  }

  copyText(text)
    .then((copied) => {
      if (copied) {
        showStatus(`Đã copy ${studentNumbers.length} mã số sinh viên.`);
      } else {
        showStatus('Không thể copy danh sách mã số sinh viên.', true);
      }
    })
    .catch((error) => {
      console.error('[ct-copy-usb-students] thất bại:', error);
      showStatus('Không thể copy danh sách mã số sinh viên.', true);
    });
})();
