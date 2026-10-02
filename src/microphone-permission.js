const allowButton = document.getElementById('allow');
const status = document.getElementById('status');

allowButton.addEventListener('click', async () => {
  allowButton.disabled = true;
  status.textContent = 'Đang chờ cấp quyền microphone…';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    await chrome.runtime.sendMessage({ type: 'tabCapture:microphonePermissionGranted' });
    status.textContent = 'Đã cấp quyền. Bạn có thể đóng cửa sổ này và bấm Ghi hình lại.';
    setTimeout(() => window.close(), 700);
  } catch (error) {
    console.error('[Microphone permission]', error);
    status.textContent = 'Không thể cấp quyền. Hãy kiểm tra quyền microphone của Chrome và thử lại.';
    allowButton.disabled = false;
  }
});
