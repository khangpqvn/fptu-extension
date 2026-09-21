(() => {
  const POPUP_ID = '__ct-auto-approve-popup';
  const ASSIGNMENT_HASH = '#assignment';
  const WAIT_TIMEOUT = 10000;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function createFieldLabel(text, input) {
    const label = document.createElement('label');
    label.style.cssText = 'display:block;margin-top:12px;font-weight:600;';
    label.textContent = text;
    label.appendChild(input);
    return label;
  }

  function createInput(type, placeholder = '') {
    const input = document.createElement('input');
    input.type = type;
    input.placeholder = placeholder;
    input.style.cssText = [
      'display:block',
      'box-sizing:border-box',
      'width:100%',
      'margin-top:6px',
      'padding:9px 10px',
      'border:1px solid #d0d5dd',
      'border-radius:6px',
      'font:14px Arial,sans-serif',
    ].join(';');
    return input;
  }

  function showIgnoreForm() {
    const existingPopup = document.getElementById(POPUP_ID);
    if (existingPopup) {
      existingPopup.remove();
    }

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.id = POPUP_ID;
      overlay.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:2147483647',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'padding:16px',
        'box-sizing:border-box',
        'background:rgba(0,0,0,.45)',
        'font-family:Arial,sans-serif',
      ].join(';');

      const panel = document.createElement('div');
      panel.style.cssText = [
        'box-sizing:border-box',
        'width:min(440px,100%)',
        'padding:20px',
        'border-radius:10px',
        'background:#fff',
        'color:#222',
        'box-shadow:0 10px 40px rgba(0,0,0,.3)',
      ].join(';');

      const title = document.createElement('h2');
      title.textContent = 'Tự động duyệt bài';
      title.style.cssText = 'margin:0;font-size:20px;';

      const description = document.createElement('p');
      description.textContent = 'Chọn các số thứ tự cần bỏ qua, sau đó chuyển đến Assignment để chạy.';
      description.style.cssText = 'margin:8px 0 16px;color:#667085;font-size:13px;line-height:1.4;';

      const mode = document.createElement('select');
      mode.style.cssText = [
        'box-sizing:border-box',
        'width:100%',
        'margin-top:6px',
        'padding:9px 10px',
        'border:1px solid #d0d5dd',
        'border-radius:6px',
        'background:#fff',
        'font:14px Arial,sans-serif',
      ].join(';');
      mode.innerHTML = '<option value="range">Bỏ qua theo range từ a đến b</option>'
        + '<option value="list">Nhập danh sách số</option>';

      const rangeStartInput = createInput('number', 'Ví dụ: 1');
      rangeStartInput.min = '1';
      rangeStartInput.step = '1';

      const rangeEndInput = createInput('number', 'Ví dụ: 20');
      rangeEndInput.min = '1';
      rangeEndInput.step = '1';

      const listInput = document.createElement('textarea');
      listInput.placeholder = 'Ví dụ: 1, 3, 5\n7, 9';
      listInput.rows = 4;
      listInput.style.cssText = [
        'display:block',
        'box-sizing:border-box',
        'width:100%',
        'margin-top:6px',
        'padding:9px 10px',
        'resize:vertical',
        'border:1px solid #d0d5dd',
        'border-radius:6px',
        'font:14px Arial,sans-serif',
      ].join(';');
      const rangeStartField = createFieldLabel('Số bắt đầu (a)', rangeStartInput);
      const rangeEndField = createFieldLabel('Số kết thúc (b)', rangeEndInput);
      const listField = createFieldLabel('Danh sách số', listInput);
      listField.hidden = true;

      const error = document.createElement('div');
      error.style.cssText = 'min-height:20px;margin-top:8px;color:#b42318;font-size:13px;';

      const log = document.createElement('pre');
      log.style.cssText = [
        'box-sizing:border-box',
        'width:100%',
        'max-height:280px',
        'margin:0',
        'padding:12px',
        'overflow:auto',
        'border-radius:6px',
        'background:#101828',
        'color:#f2f4f7',
        'font:13px/1.5 Menlo,Consolas,monospace',
        'white-space:pre-wrap',
      ].join(';');
      log.hidden = true;

      const writeLog = (message) => {
        const time = new Date().toLocaleTimeString('vi-VN');
        log.textContent += `[${time}] ${message}\n`;
        log.scrollTop = log.scrollHeight;
      };

      const buttons = document.createElement('div');
      buttons.style.cssText = 'display:flex;gap:8px;margin-top:8px;';

      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.textContent = 'Hủy';
      cancelButton.style.cssText = [
        'flex:1',
        'padding:10px',
        'border:1px solid #d0d5dd',
        'border-radius:6px',
        'background:#fff',
        'cursor:pointer',
      ].join(';');

      const submitButton = document.createElement('button');
      submitButton.type = 'submit';
      submitButton.textContent = 'Tiếp tục';
      submitButton.style.cssText = [
        'flex:1',
        'padding:10px',
        'border:0',
        'border-radius:6px',
        'background:#0d6efd',
        'color:#fff',
        'cursor:pointer',
        'font-weight:600',
      ].join(';');

      const form = document.createElement('form');
      form.append(
        title,
        description,
        createFieldLabel('Cách chọn số cần bỏ qua', mode),
        rangeStartField,
        rangeEndField,
        listField,
        error,
        log,
        buttons,
      );
      buttons.append(cancelButton, submitButton);
      panel.appendChild(form);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      mode.addEventListener('change', () => {
        const isRange = mode.value === 'range';
        rangeStartField.hidden = !isRange;
        rangeEndField.hidden = !isRange;
        listField.hidden = isRange;
        error.textContent = '';
        (isRange ? rangeStartInput : listInput).focus();
      });

      const finish = (value) => {
        if (!value) {
          overlay.remove();
          resolve(null);
          return;
        }

        log.hidden = false;
        submitButton.disabled = true;
        mode.disabled = true;
        rangeStartInput.disabled = true;
        rangeEndInput.disabled = true;
        listInput.disabled = true;
        cancelButton.disabled = true;
        writeLog('Đã nhận cấu hình. Bắt đầu xử lý...');
        resolve({ ignoredNumbers: value, writeLog });
      };

      cancelButton.addEventListener('click', () => finish(null));
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          finish(null);
        }
      });

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const ignoredNumbers = new Set();

        if (mode.value === 'range') {
          const start = Number(rangeStartInput.value);
          const end = Number(rangeEndInput.value);
          if (!Number.isSafeInteger(start) || start < 1
            || !Number.isSafeInteger(end) || end < 1
            || start > end) {
            error.textContent = 'Khoảng phải gồm hai số nguyên dương và a không được lớn hơn b.';
            rangeStartInput.focus();
            return;
          }

          for (let number = start; number <= end; number += 1) {
            ignoredNumbers.add(number);
          }
        } else {
          const values = listInput.value
            .split(/[\s,]+/)
            .map((value) => value.trim())
            .filter(Boolean);

          if (!values.length || values.some((value) => !/^\d+$/.test(value))) {
            error.textContent = 'Danh sách chỉ được chứa các số, cách nhau bằng dấu phẩy hoặc xuống dòng.';
            listInput.focus();
            return;
          }

          values.forEach((value) => {
            const number = Number(value);
            if (Number.isSafeInteger(number) && number > 0) {
              ignoredNumbers.add(number);
            }
          });
        }

        finish(ignoredNumbers);
      });

      rangeStartInput.focus();
    });
  }

  function waitForHashChange() {
    if (window.location.hash.toLowerCase() === ASSIGNMENT_HASH) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      function done() {
        window.removeEventListener('hashchange', done);
        resolve();
      }

      window.addEventListener('hashchange', done, { once: true });
      window.location.hash = ASSIGNMENT_HASH;
    });
  }

  function waitForAssignmentLinks() {
    const hasLinks = () => document.querySelector('a[title="Grading"]');
    if (hasLinks()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let finished = false;
      const observer = new MutationObserver(() => {
        if (hasLinks()) {
          done();
        }
      });
      const timeout = setTimeout(done, WAIT_TIMEOUT);

      function done() {
        if (finished) {
          return;
        }
        finished = true;
        clearTimeout(timeout);
        observer.disconnect();
        resolve();
      }

      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  async function navigateToAssignment() {
    await waitForHashChange();
    await waitForAssignmentLinks();
  }

  async function waitForWindowReady(windowRef) {
    const deadline = Date.now() + WAIT_TIMEOUT;

    while (Date.now() < deadline) {
      try {
        const currentUrl = windowRef.location.href;
        const isNavigated = currentUrl && currentUrl !== 'about:blank';
        if (isNavigated && windowRef.document.readyState === 'complete') {
          return true;
        }
      } catch (error) {
        // The new window may be cross-origin while it is navigating.
      }

      await sleep(100);
    }

    return false;
  }

  async function waitForElement(windowRef, selector) {
    const deadline = Date.now() + WAIT_TIMEOUT;

    while (Date.now() < deadline) {
      try {
        const element = windowRef.document.querySelector(selector);
        if (element) {
          return element;
        }
      } catch (error) {
        // The target document may still be navigating or rendering.
      }

      await sleep(100);
    }

    return null;
  }

  async function run(listNumberIgnore, writeLog) {
    writeLog('Đang chuyển đến route #assignment...');
    await navigateToAssignment();
    writeLog('Đã tải xong route #assignment.');

    const links = [...document.querySelectorAll('a[title="Grading"]')]
      .map((anchor) => anchor.href || anchor.getAttribute('href'))
      .filter(Boolean);
    writeLog(`Tìm thấy ${links.length} bài cần xử lý.`);

    for (let index = 0; index < links.length; index += 1) {
      const stt = index + 1;
      const link = links[index];

      if (listNumberIgnore.has(stt)) {
        writeLog(`Bỏ qua bài ${stt}.`);
        continue;
      }

      writeLog(`Đang mở bài ${stt}: ${link}`);
      const windowRef = window.open(link, '_blank');
      if (!windowRef) {
        writeLog(`Không thể mở cửa sổ bài ${stt}.`);
        continue;
      }

      try {
        const isReady = await waitForWindowReady(windowRef);
        if (!isReady) {
          writeLog(`Bài ${stt} không hoàn tất tải trong ${WAIT_TIMEOUT / 1000} giây.`);
          continue;
        }

        const statusSelect = await waitForElement(windowRef, '#StatusId');
        if (!statusSelect) {
          writeLog(`Không tìm thấy #StatusId ở bài ${stt} sau khi trang tải xong.`);
          continue;
        }

        statusSelect.value = '9';
        statusSelect.dispatchEvent(new windowRef.Event('change', { bubbles: true }));
        await sleep(200);

        if (statusSelect.value !== '9') {
          writeLog(`Không thể chuyển bài ${stt} sang Passed.`);
          continue;
        }

        writeLog(`Đã chuyển bài ${stt} sang Passed.`);

        const submitButton = windowRef.document.querySelector('#btnSubmit');
        if (!submitButton) {
          writeLog(`Không tìm thấy #btnSubmit ở bài ${stt}.`);
          continue;
        }

        submitButton.click();
        writeLog(`Đã submit bài ${stt}.`);
        await sleep(500);
        writeLog(`Hoàn tất bài ${stt}.`);
      } catch (error) {
        writeLog(`Không thể truy cập document bài ${stt}: ${error.message}`);
      } finally {
        try {
          windowRef.close();
        } catch (error) {
          writeLog(`Không thể đóng cửa sổ bài ${stt}: ${error.message}`);
        }
      }
    }

    writeLog('Đã hoàn tất toàn bộ danh sách.');
  }

  showIgnoreForm()
    .then((result) => {
      if (result) {
        return run(result.ignoredNumbers, result.writeLog);
      }
      return null;
    })
    .catch((error) => console.error('Auto approve failed:', error));
})();
