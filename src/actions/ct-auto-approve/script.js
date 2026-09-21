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
      mode.innerHTML = '<option value="range">Bỏ qua theo range từ 1 đến n</option>'
        + '<option value="list">Nhập danh sách số</option>';

      const rangeInput = createInput('number', 'Ví dụ: 20');
      rangeInput.min = '1';
      rangeInput.step = '1';

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
      listInput.hidden = true;

      const error = document.createElement('div');
      error.style.cssText = 'min-height:20px;margin-top:8px;color:#b42318;font-size:13px;';

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
        createFieldLabel('Số n', rangeInput),
        createFieldLabel('Danh sách số', listInput),
        error,
        buttons,
      );
      buttons.append(cancelButton, submitButton);
      panel.appendChild(form);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      mode.addEventListener('change', () => {
        const isRange = mode.value === 'range';
        rangeInput.hidden = !isRange;
        listInput.hidden = isRange;
        error.textContent = '';
        (isRange ? rangeInput : listInput).focus();
      });

      const finish = (value) => {
        overlay.remove();
        resolve(value);
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
          const end = Number(rangeInput.value);
          if (!Number.isSafeInteger(end) || end < 1) {
            error.textContent = 'Số n phải là số nguyên lớn hơn hoặc bằng 1.';
            rangeInput.focus();
            return;
          }

          for (let number = 1; number <= end; number += 1) {
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

      rangeInput.focus();
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

  function waitForLoad(windowRef) {
    return new Promise((resolve) => {
      let finished = false;

      const done = () => {
        if (finished) {
          return;
        }
        finished = true;
        resolve();
      };

      try {
        if (windowRef.document.readyState === 'complete') {
          done();
          return;
        }
        windowRef.addEventListener('load', done, { once: true });
      } catch (error) {
        done();
      }

      setTimeout(done, WAIT_TIMEOUT);
    });
  }

  async function run(listNumberIgnore) {
    await navigateToAssignment();

    const links = [...document.querySelectorAll('a[title="Grading"]')]
      .map((anchor) => anchor.href || anchor.getAttribute('href'))
      .filter(Boolean);

    for (let index = 0; index < links.length; index += 1) {
      const stt = index + 1;
      const link = links[index];

      if (listNumberIgnore.has(stt)) {
        console.log('ignore:', stt);
        continue;
      }

      const windowRef = window.open(link, '_blank');
      if (!windowRef) {
        console.error('Không thể mở window:', stt, link);
        continue;
      }

      console.log('opening:', stt, link);

      try {
        await waitForLoad(windowRef);

        const statusSelect = windowRef.document.querySelector('#StatusId');
        if (!statusSelect) {
          console.warn('Không tìm thấy #StatusId:', stt, link);
          continue;
        }

        statusSelect.value = '9';
        statusSelect.dispatchEvent(new windowRef.Event('change', { bubbles: true }));
        await sleep(200);

        if (statusSelect.value !== '9') {
          console.error('Không thể chuyển sang Passed:', stt, link);
          continue;
        }

        console.log('Status changed to Passed:', stt, link);

        const submitButton = windowRef.document.querySelector('#btnSubmit');
        if (!submitButton) {
          console.warn('Không tìm thấy #btnSubmit:', stt, link);
          continue;
        }

        submitButton.click();
        console.log('clicked:', stt, link);
        await sleep(500);
        console.log('done:', stt, link);
      } catch (error) {
        console.error('Không thể truy cập document:', stt, error);
      } finally {
        try {
          windowRef.close();
        } catch (error) {
          console.warn('Không thể đóng window:', stt, error);
        }
      }
    }
  }

  showIgnoreForm()
    .then((listNumberIgnore) => {
      if (listNumberIgnore) {
        return run(listNumberIgnore);
      }
      return null;
    })
    .catch((error) => console.error('Auto approve failed:', error));
})();
