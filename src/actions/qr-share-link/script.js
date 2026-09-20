function toggleQRModal() {
  const existingModal = document.getElementById('qr-share-modal');
  if (existingModal) {
    existingModal.remove();
    return;
  }

  const currentUrl = location.href;

  const modalContainer = document.createElement('div');
  modalContainer.id = 'qr-share-modal';
  modalContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: 400px;
    font-size: 14px;
  `;

  const title = document.createElement('h2');
  title.textContent = 'Share Link via QR Code';
  title.style.cssText = `
    margin: 0 0 16px 0;
    color: #222;
    font-size: 18px;
    font-weight: 600;
  `;
  modalContent.appendChild(title);

  const qrContainer = document.createElement('div');
  qrContainer.id = 'qr-code-container';
  qrContainer.style.cssText = `
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 16px 0;
    min-height: 200px;
  `;
  modalContent.appendChild(qrContainer);

  const urlDisplay = document.createElement('div');
  urlDisplay.style.cssText = `
    background: #f5f5f5;
    padding: 8px 12px;
    border-radius: 6px;
    margin: 16px 0;
    word-break: break-all;
    font-size: 12px;
    color: #666;
    max-height: 60px;
    overflow-y: auto;
  `;
  urlDisplay.textContent = currentUrl;
  modalContent.appendChild(urlDisplay);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = `
    background: #007bff;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    margin-top: 12px;
    transition: background 0.2s;
  `;
  closeBtn.onmouseover = () => closeBtn.style.background = '#0056b3';
  closeBtn.onmouseout = () => closeBtn.style.background = '#007bff';
  closeBtn.onclick = () => modalContainer.remove();
  modalContent.appendChild(closeBtn);

  modalContainer.onclick = (e) => {
    if (e.target === modalContainer) {
      modalContainer.remove();
    }
  };

  modalContainer.appendChild(modalContent);
  document.body.appendChild(modalContainer);

  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  script.onload = () => {
    const container = document.getElementById('qr-code-container');
    if (container && container.children.length === 0) {
      new QRCode(container, {
        text: currentUrl,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    }
  };
  document.head.appendChild(script);
}

toggleQRModal();
