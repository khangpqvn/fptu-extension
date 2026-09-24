/**
 * tab-capture/script.js — Floating panel to screenshot or record the active tab.
 *
 * The panel only renders UI. Screen capture, recording and downloading happen in
 * the service worker and its offscreen document, so a recording keeps running
 * after the panel is closed or the page navigates.
 */
(() => {
  const PANEL_ID = '__tab-capture-panel';
  const existingPanel = document.getElementById(PANEL_ID);
  if (existingPanel) {
    existingPanel.remove();
    return;
  }

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.style.cssText = [
    'position:fixed',
    'right:20px',
    'bottom:20px',
    'z-index:2147483647',
    'box-sizing:border-box',
    'width:min(300px,calc(100vw - 40px))',
    'padding:14px 16px',
    'border-radius:10px',
    'background:#1e1e2e',
    'color:#cdd6f4',
    'font:14px/1.45 Arial,sans-serif',
    'box-shadow:0 10px 30px rgba(0,0,0,.35)',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:8px;';

  const title = document.createElement('strong');
  title.textContent = 'Ghi hình & Chụp ảnh tab';
  title.style.cssText = 'flex:1;font-size:14px;color:#f5c2e7;';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = '✕';
  closeButton.title = 'Đóng bảng điều khiển';
  closeButton.style.cssText = [
    'flex:0 0 auto',
    'padding:2px 6px',
    'border:none',
    'border-radius:5px',
    'background:transparent',
    'color:#a6adc8',
    'font:16px/1 Arial,sans-serif',
    'cursor:pointer',
  ].join(';');
  closeButton.addEventListener('click', () => panel.remove());

  header.append(title, closeButton);

  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = 'display:flex;gap:8px;margin-top:12px;';

  function createButton(label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = [
      'flex:1',
      'box-sizing:border-box',
      'padding:9px 10px',
      'border:1px solid #45475a',
      'border-radius:6px',
      'background:#313244',
      'color:#cdd6f4',
      'font:600 13px/1.2 Arial,sans-serif',
      'cursor:pointer',
    ].join(';');
    return button;
  }

  const screenshotButton = createButton('📷 Chụp ảnh');
  const recordButton = createButton('⏺ Ghi hình');
  buttonRow.append(screenshotButton, recordButton);

  const status = document.createElement('p');
  status.style.cssText = 'margin:10px 0 0;color:#a6adc8;font-size:12px;min-height:16px;';

  panel.append(header, buttonRow, status);
  document.body.appendChild(panel);

  let recording = false;
  let startedAt = null;
  let busy = false;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.style.color = isError ? '#f38ba8' : '#a6adc8';
  }

  function formatElapsed(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function render() {
    screenshotButton.disabled = busy;
    recordButton.disabled = busy;
    screenshotButton.style.opacity = busy ? '0.6' : '1';
    recordButton.style.opacity = busy ? '0.6' : '1';
    recordButton.textContent = recording ? '⏹ Dừng ghi' : '⏺ Ghi hình';
    recordButton.style.background = recording ? '#b42318' : '#313244';
    recordButton.style.borderColor = recording ? '#b42318' : '#45475a';
    recordButton.style.color = recording ? '#fff' : '#cdd6f4';
  }

  const elapsedTimer = setInterval(() => {
    if (!document.getElementById(PANEL_ID)) {
      clearInterval(elapsedTimer);
      return;
    }
    if (recording && startedAt) {
      setStatus(`Đang ghi ${formatElapsed(Date.now() - startedAt)}…`);
    }
  }, 1000);

  async function send(message) {
    const response = await chrome.runtime.sendMessage(message);
    if (response === undefined) {
      throw new Error('Service worker chưa nhận lệnh. Hãy vào chrome://extensions và bấm Reload.');
    }
    if (!response.success) {
      throw new Error(response.error || `Lệnh ${message.type} thất bại.`);
    }
    return response;
  }

  function waitForRepaint() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 60)));
    });
  }

  async function runTask(task) {
    if (busy) {
      return;
    }
    busy = true;
    render();
    try {
      await task();
    } catch (error) {
      console.error('[Tab capture]', error);
      setStatus(error.message, true);
    } finally {
      busy = false;
      render();
    }
  }

  screenshotButton.addEventListener('click', () => runTask(async () => {
    setStatus('Đang chụp ảnh…');
    panel.style.visibility = 'hidden';
    try {
      await waitForRepaint();
      const { filename } = await send({ type: 'tabCapture:screenshot' });
      setStatus(`Đã lưu ${filename}`);
    } finally {
      panel.style.visibility = 'visible';
    }
  }));

  recordButton.addEventListener('click', () => runTask(async () => {
    if (recording) {
      setStatus('Đang lưu video…');
      const { filename } = await send({ type: 'tabCapture:stopRecording' });
      recording = false;
      startedAt = null;
      setStatus(`Đã lưu ${filename}`);
      return;
    }

    setStatus('Đang bắt đầu ghi…');
    const response = await send({ type: 'tabCapture:startRecording' });
    recording = true;
    startedAt = response.startedAt;
    setStatus('Đang ghi 00:00…');
  }));

  render();

  send({ type: 'tabCapture:getState' })
    .then((state) => {
      recording = Boolean(state.recording);
      startedAt = state.startedAt ?? null;
      render();
      if (recording) {
        setStatus(`Đang ghi ${formatElapsed(Date.now() - (startedAt ?? Date.now()))}…`);
      } else {
        setStatus('Chụp ảnh vùng đang xem hoặc ghi hình kèm âm thanh của tab.');
      }
    })
    .catch((error) => {
      // The buttons stay enabled: each one reports its own failure, so a failed
      // state probe must not lock the panel.
      console.error('[Tab capture]', error);
      setStatus(error.message, true);
    });
})();
