/**
 * tab-capture/script.js — Floating panel to screenshot or record the active tab.
 *
 * The panel only renders UI. Screen capture, recording and downloading happen in
 * the service worker and its offscreen document, so a recording keeps running
 * after the panel is closed or the page navigates.
 */
(() => {
  const PANEL_ID = '__tab-capture-panel';
  const DOCK_POSITION_KEY = '__tab-capture-dock-position';
  const existingPanel = document.getElementById(PANEL_ID);
  if (existingPanel) {
    existingPanel.__tabCaptureCleanup?.();
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

  const dragHandle = document.createElement('div');
  dragHandle.textContent = '⠿ Kéo để di chuyển';
  dragHandle.title = 'Kéo để di chuyển bảng điều khiển';
  dragHandle.setAttribute('aria-label', dragHandle.title);
  dragHandle.style.cssText = [
    'margin-bottom:8px',
    'color:#a6adc8',
    'font-size:11px',
    'line-height:14px',
    'cursor:move',
    'touch-action:none',
    'user-select:none',
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
  closeButton.addEventListener('click', () => disposePanel());

  header.append(title, closeButton);

  const settings = document.createElement('div');

  const audioOptions = document.createElement('fieldset');
  audioOptions.style.cssText = [
    'margin:12px 0 0',
    'padding:8px 10px',
    'border:1px solid #45475a',
    'border-radius:6px',
  ].join(';');

  const audioLegend = document.createElement('legend');
  audioLegend.textContent = 'Âm thanh ghi hình';
  audioLegend.style.cssText = 'padding:0 4px;color:#f5c2e7;font-size:12px;';

  function createAudioOption(label, checked) {
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;align-items:center;gap:7px;margin:4px 0;cursor:pointer;';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.setAttribute('aria-label', label);
    row.append(checkbox, document.createTextNode(label));
    audioOptions.append(row);
    return checkbox;
  }

  audioOptions.append(audioLegend);
  const tabAudioCheckbox = createAudioOption('Âm thanh tab', true);
  const microphoneCheckbox = createAudioOption('Microphone', false);
  const audioNote = document.createElement('div');
  audioNote.textContent = 'Bật microphone có thể yêu cầu cấp quyền cho tiện ích.';
  audioNote.style.cssText = 'margin-top:6px;color:#a6adc8;font-size:11px;';
  audioOptions.append(audioNote);

  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;';

  function createButton(label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = [
      'flex:1 1 120px',
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
  settings.append(audioOptions, buttonRow);

  const recorderControls = document.createElement('div');
  recorderControls.style.cssText = 'display:none;align-items:center;gap:8px;';

  const elapsed = document.createElement('strong');
  elapsed.style.cssText = 'min-width:42px;color:#f5c2e7;font-variant-numeric:tabular-nums;';

  function createIconButton(icon, label, background) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = icon;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.style.cssText = [
      'width:34px',
      'height:34px',
      'padding:0',
      'border:1px solid transparent',
      'border-radius:7px',
      `background:${background}`,
      'color:#fff',
      'font:18px/1 Arial,sans-serif',
      'cursor:pointer',
    ].join(';');
    return button;
  }

  const screenshotIconButton = createIconButton('📷', 'Chụp ảnh vùng đang xem', '#313244');
  const pauseButton = createIconButton('⏸', 'Tạm dừng ghi hình', '#45475a');
  const stopButton = createIconButton('⏹', 'Dừng ghi hình', '#b42318');
  recorderControls.append(elapsed, screenshotIconButton, pauseButton, stopButton);

  const status = document.createElement('p');
  status.style.cssText = 'margin:10px 0 0;color:#a6adc8;font-size:12px;min-height:16px;';

  panel.append(dragHandle, header, settings, recorderControls, status);
  document.body.appendChild(panel);

  let recording = false;
  let paused = false;
  let startedAt = null;
  let pausedAt = null;
  let pausedDurationMs = 0;
  let elapsedMs = 0;
  let busy = false;
  let statusIsError = false;
  let dragState = null;
  let positioned = false;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function applyPosition(left, top) {
    const rect = panel.getBoundingClientRect();
    const clampedLeft = clamp(left, 0, window.innerWidth - rect.width);
    const clampedTop = clamp(top, 0, window.innerHeight - rect.height);
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.left = `${clampedLeft}px`;
    panel.style.top = `${clampedTop}px`;
    positioned = true;
    return { left: clampedLeft, top: clampedTop };
  }

  function clampIntoViewport() {
    if (!positioned) {
      return;
    }
    const rect = panel.getBoundingClientRect();
    applyPosition(rect.left, rect.top);
  }

  function savePosition() {
    if (!positioned) {
      return;
    }
    try {
      const rect = panel.getBoundingClientRect();
      sessionStorage.setItem(DOCK_POSITION_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
    } catch (_) {
      // The dock remains usable when a page blocks session storage.
    }
  }

  function restorePosition() {
    try {
      const savedPosition = JSON.parse(sessionStorage.getItem(DOCK_POSITION_KEY) || 'null');
      if (Number.isFinite(savedPosition?.left) && Number.isFinite(savedPosition?.top)) {
        applyPosition(savedPosition.left, savedPosition.top);
      }
    } catch (_) {
      // Use the default corner when storage is unavailable or malformed.
    }
  }

  function finishDragging(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }
    const { pointerId } = dragState;
    dragState = null;
    if (dragHandle.hasPointerCapture(pointerId)) {
      dragHandle.releasePointerCapture(pointerId);
    }
    dragHandle.style.cursor = 'move';
    savePosition();
  }

  dragHandle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    const position = applyPosition(rect.left, rect.top);
    dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - position.left,
      offsetY: event.clientY - position.top,
    };
    dragHandle.setPointerCapture(event.pointerId);
    dragHandle.style.cursor = 'grabbing';
  });

  dragHandle.addEventListener('pointermove', (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }
    event.preventDefault();
    applyPosition(event.clientX - dragState.offsetX, event.clientY - dragState.offsetY);
  });

  dragHandle.addEventListener('pointerup', finishDragging);
  dragHandle.addEventListener('pointercancel', finishDragging);
  dragHandle.addEventListener('lostpointercapture', finishDragging);
  function handleResize() {
    const wasPositioned = positioned;
    clampIntoViewport();
    if (wasPositioned) {
      savePosition();
    }
  }

  window.addEventListener('resize', handleResize);

  function setStatus(message, isError = false) {
    status.textContent = message;
    statusIsError = isError;
    status.style.color = isError ? '#f38ba8' : '#a6adc8';
  }

  function formatElapsed(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function getCurrentElapsed() {
    if (!recording || !startedAt) {
      return 0;
    }
    if (paused) {
      return elapsedMs;
    }
    return Math.max(0, Date.now() - startedAt - pausedDurationMs);
  }

  function updateSession(state) {
    recording = Boolean(state.recording);
    paused = Boolean(state.paused);
    startedAt = state.startedAt ?? null;
    pausedAt = state.pausedAt ?? null;
    pausedDurationMs = state.pausedDurationMs ?? 0;
    elapsedMs = state.elapsedMs ?? 0;
    if (recording) {
      tabAudioCheckbox.checked = state.includeTabAudio !== false;
      microphoneCheckbox.checked = state.includeMicrophone === true;
    }
  }

  function resetSession() {
    recording = false;
    paused = false;
    startedAt = null;
    pausedAt = null;
    pausedDurationMs = 0;
    elapsedMs = 0;
  }

  function render() {
    const compact = recording;
    header.style.display = compact ? 'none' : 'flex';
    settings.style.display = compact ? 'none' : 'block';
    recorderControls.style.display = compact ? 'flex' : 'none';
    panel.style.width = compact ? 'min(158px,calc(100vw - 40px))' : 'min(300px,calc(100vw - 40px))';
    panel.style.padding = compact ? '10px 12px' : '14px 16px';

    screenshotButton.disabled = busy;
    recordButton.disabled = busy;
    tabAudioCheckbox.disabled = busy;
    microphoneCheckbox.disabled = busy;
    screenshotButton.style.opacity = busy ? '0.6' : '1';
    recordButton.style.opacity = busy ? '0.6' : '1';

    screenshotIconButton.disabled = busy;
    pauseButton.disabled = busy;
    stopButton.disabled = busy;
    screenshotIconButton.style.opacity = busy ? '0.6' : '1';
    pauseButton.style.opacity = busy ? '0.6' : '1';
    stopButton.style.opacity = busy ? '0.6' : '1';
    pauseButton.textContent = paused ? '▶' : '⏸';
    pauseButton.title = paused ? 'Tiếp tục ghi hình' : 'Tạm dừng ghi hình';
    pauseButton.setAttribute('aria-label', pauseButton.title);
    elapsed.textContent = formatElapsed(getCurrentElapsed());
    status.style.display = compact && !statusIsError ? 'none' : 'block';
    clampIntoViewport();
  }

  const elapsedTimer = setInterval(() => {
    if (!document.getElementById(PANEL_ID)) {
      clearInterval(elapsedTimer);
      return;
    }
    if (recording && !paused) {
      elapsedMs = getCurrentElapsed();
      render();
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

  async function captureImage(messageType, statusMessage) {
    setStatus(statusMessage);
    panel.style.visibility = 'hidden';
    try {
      await waitForRepaint();
      const { filename } = await send({ type: messageType });
      setStatus(`Đã lưu ${filename}`);
    } finally {
      panel.style.visibility = 'visible';
    }
  }

  screenshotButton.addEventListener('click', () => runTask(() => (
    captureImage('tabCapture:screenshot', 'Đang chụp ảnh…')
  )));

  screenshotIconButton.addEventListener('click', () => runTask(() => (
    captureImage('tabCapture:screenshot', 'Đang chụp ảnh…')
  )));

  recordButton.addEventListener('click', () => runTask(async () => {
    setStatus('Đang bắt đầu ghi…');
    const response = await send({
      type: 'tabCapture:startRecording',
      includeTabAudio: tabAudioCheckbox.checked,
      includeMicrophone: microphoneCheckbox.checked,
    });
    updateSession(response);
    setStatus(response.requiresMicrophonePermission
      ? 'Chrome chưa cấp quyền microphone. Hãy cấp quyền cho tiện ích rồi bấm Ghi hình lại.'
      : '');
  }));

  pauseButton.addEventListener('click', () => runTask(async () => {
    const response = await send({
      type: paused ? 'tabCapture:resumeRecording' : 'tabCapture:pauseRecording',
    });
    updateSession(response);
    setStatus('');
  }));

  stopButton.addEventListener('click', () => runTask(async () => {
    setStatus('Đang lưu video…');
    try {
      const { filename } = await send({ type: 'tabCapture:stopRecording' });
      setStatus(`Đã lưu ${filename}`);
    } finally {
      resetSession();
    }
  }));

  function disposePanel() {
    if (!document.getElementById(PANEL_ID)) {
      return;
    }
    clearInterval(elapsedTimer);
    window.removeEventListener('resize', handleResize);
    dragState = null;
    panel.remove();
  }

  panel.__tabCaptureCleanup = disposePanel;
  restorePosition();
  render();

  send({ type: 'tabCapture:getState' })
    .then((state) => {
      updateSession(state);
      if (recording) {
        setStatus('');
      } else {
        setStatus('Chụp ảnh vùng đang xem hoặc ghi hình với âm thanh tab/microphone.');
      }
      render();
    })
    .catch((error) => {
      // The buttons stay enabled: each one reports its own failure, so a failed
      // state probe must not lock the panel.
      console.error('[Tab capture]', error);
      setStatus(error.message, true);
      render();
    });
})();
