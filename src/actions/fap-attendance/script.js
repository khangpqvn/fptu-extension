(async () => {
  const TABLE_ID = "ctl00_mainContent_gvAttendance";
  const SAVE_ID = "ctl00_mainContent_btnSave";

  // =========================
  // TẠO POPUP
  // =========================

  const oldPopup = document.getElementById(
    "__attendance_roll_popup"
  );

  if (oldPopup) {
    oldPopup.remove();
  }

  const overlay = document.createElement("div");

  overlay.id = "__attendance_roll_popup";

  overlay.innerHTML = `
        <div style="
            position:fixed;
            inset:0;
            background:rgba(0,0,0,.45);
            z-index:2147483647;
            display:flex;
            align-items:center;
            justify-content:center;
        ">
            <div style="
                width:430px;
                background:white;
                border-radius:10px;
                padding:20px;
                box-shadow:0 10px 40px rgba(0,0,0,.3);
                font-family:Arial,sans-serif;
                color:#222;
            ">

                <div style="
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:12px;
                    margin-bottom:16px;
                ">
                    <span style="
                        font-size:18px;
                        font-weight:bold;
                        color:#101828;
                    ">
                        Điểm danh
                    </span>

                    <button
                        id="__attendance_copy"
                        type="button"
                        aria-label="Sao chép Roll Number đang Present"
                        style="
                            display:inline-flex;
                            align-items:center;
                            justify-content:center;
                            min-height:44px;
                            padding:0 14px;
                            border:1px solid #d0d5dd;
                            border-radius:8px;
                            background:#ffffff;
                            color:#344054;
                            box-shadow:0 1px 2px rgba(16,24,40,.06);
                            cursor:pointer;
                            font-size:13px;
                            font-weight:600;
                            line-height:1.2;
                            white-space:nowrap;
                            touch-action:manipulation;
                            transition:background-color .15s ease,border-color .15s ease,box-shadow .15s ease,transform .15s ease;
                        "
                    >
                        Copy Present
                    </button>
                </div>

                <div style="
                    font-size:13px;
                    color:#666;
                    margin-bottom:8px;
                ">
                    <b>Điểm danh theo Roll Number:</b><br>
                    Có trong danh sách = Present<br>
                    Không có trong danh sách = Absent
                </div>

                <textarea
                    id="__attendance_roll_input"
                    placeholder="Nhập Roll Number:

SE20xxxx
SE21xxxx
SE22xxxx"
                    style="
                        width:100%;
                        height:160px;
                        box-sizing:border-box;
                        resize:vertical;
                        padding:10px;
                        border:1px solid #ccc;
                        border-radius:6px;
                        font-size:14px;
                        outline:none;
                    "
                ></textarea>

                <div style="
                    display:flex;
                    gap:8px;
                    margin-top:12px;
                ">

                   

                    <button
                        id="__attendance_cancel"
                        style="
                            flex:1;
                            padding:10px;
                            border:1px solid #ccc;
                            background:#f5f5f5;
                            border-radius:6px;
                            cursor:pointer;
                        "
                    >
                        Hủy
                    </button>

                    <button
                        id="__attendance_execute"
                        style="
                            flex:1;
                            padding:10px;
                            border:0;
                            background:#0d6efd;
                            color:white;
                            border-radius:6px;
                            cursor:pointer;
                            font-weight:bold;
                        "
                    >
                        Điểm danh
                    </button>

                </div>

                <button
                    id="__attendance_all"
                    style="
                        width:100%;
                        margin-top:8px;
                        padding:10px;
                        border:0;
                        background:#198754;
                        color:white;
                        border-radius:6px;
                        cursor:pointer;
                        font-weight:bold;
                    "
                >
                    ✓ Điểm danh toàn bộ
                </button>

                <div
                    id="__attendance_status"
                    style="
                        margin-top:10px;
                        font-size:13px;
                        white-space:pre-wrap;
                        color:#555;
                    "
                ></div>

            </div>
        </div>
    `;

  document.body.appendChild(overlay);


  // =========================
  // ELEMENTS
  // =========================

  const input = document.getElementById(
    "__attendance_roll_input"
  );

  const executeBtn = document.getElementById(
    "__attendance_execute"
  );

  const copyBtn = document.getElementById(
    "__attendance_copy"
  );

  const allBtn = document.getElementById(
    "__attendance_all"
  );

  const cancelBtn = document.getElementById(
    "__attendance_cancel"
  );

  const status = document.getElementById(
    "__attendance_status"
  );

  input.focus();


  // =========================
  // CANCEL
  // =========================

  cancelBtn.onclick = () => {
    overlay.remove();

    document.removeEventListener(
      "keydown",
      escHandler
    );
  };


  // =========================
  // ESC
  // =========================

  const escHandler = (e) => {

    if (e.key === "Escape") {

      overlay.remove();

      document.removeEventListener(
        "keydown",
        escHandler
      );
    }
  };

  document.addEventListener(
    "keydown",
    escHandler
  );


  // =========================
  // LẤY TABLE
  // =========================

  function getAttendanceRows() {

    const table =
      document.getElementById(TABLE_ID);

    if (!table) {
      return null;
    }

    return [
      ...table.querySelectorAll("tr")
    ].filter(row => {

      const present =
        row.querySelector(
          'input[type="radio"][id$="_rdPresent"]'
        );

      const absent =
        row.querySelector(
          'input[type="radio"][id$="_rdAbsent"]'
        );

      return present && absent;
    });
  }


  // =========================
  // LẤY ROLL NUMBER
  // =========================

  function extractRollNumber(row) {
    const cells = Array.from(row.querySelectorAll("td, th"));
    const exactMatch = cells
      .map(cell => cell.textContent.trim())
      .find(value => /^(?:SE|HE|SD|PE|CE|TE)\d{4,}$/i.test(value));

    if (exactMatch) {
      return exactMatch.toUpperCase();
    }

    const tokenMatch = row.textContent
      .trim()
      .split(/\s+/)
      .find(token => /^(?:SE|HE|SD|PE|CE|TE)\d{4,}$/i.test(token));

    return tokenMatch ? tokenMatch.toUpperCase() : null;
  }

  function copyText(value) {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(value)
        .then(() => true)
        .catch(() => copyTextWithFallback(value));
    }

    return Promise.resolve(copyTextWithFallback(value));
  }

  function copyTextWithFallback(value) {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      textarea.remove();
    }
    return copied;
  }


  // =========================
  // COPY PRESENT
  // =========================

  copyBtn.onclick = async () => {
    const rows = getAttendanceRows();

    if (!rows) {
      status.textContent =
        "❌ Không tìm thấy bảng điểm danh.";
      return;
    }

    const rollNumbers = [];

    for (const row of rows) {
      const present =
        row.querySelector(
          'input[type="radio"][id$="_rdPresent"]'
        );

      if (!present?.checked) {
        continue;
      }

      const rollNumber = extractRollNumber(row);
      if (rollNumber && !rollNumbers.includes(rollNumber)) {
        rollNumbers.push(rollNumber);
      }
    }

    if (rollNumbers.length === 0) {
      status.textContent =
        "⚠️ Không tìm thấy Roll Number nào đang được tích Present.";
      return;
    }

    const copied = await copyText(rollNumbers.join("\n"));
    status.textContent = copied
      ? `✓ Đã copy ${rollNumbers.length} Roll Number:\n${rollNumbers.join("\n")}`
      : "❌ Không thể copy Roll Number.";
  };


  // =========================
  // SAVE
  // =========================

  async function saveAttendance() {

    await new Promise(resolve =>
      setTimeout(resolve, 500)
    );

    const saveBtn =
      document.getElementById(SAVE_ID);

    if (saveBtn) {

      saveBtn.click();

      status.textContent +=
        "\n\n✓ Đã click Save.";

    } else {

      status.textContent +=
        "\n\n⚠️ Không tìm thấy nút Save.";
    }
  }


  // =========================
  // ĐIỂM DANH THEO ROLL NUMBER
  // =========================

  executeBtn.onclick = async () => {

    const rollNumbers = input.value
      .split(/[\n,;]+/)
      .map(x => x.trim())
      .filter(Boolean);

    if (rollNumbers.length === 0) {

      status.textContent =
        "⚠️ Chưa nhập Roll Number.";

      return;
    }


    const rollSet = new Set(
      rollNumbers.map(x =>
        x.toLowerCase()
      )
    );


    const rows = getAttendanceRows();

    if (!rows) {

      status.textContent =
        "❌ Không tìm thấy bảng điểm danh.";

      return;
    }


    executeBtn.disabled = true;
    allBtn.disabled = true;
    executeBtn.textContent = "Đang xử lý...";


    let presentCount = 0;
    let absentCount = 0;

    const notFound = [];


    // =========================
    // XỬ LÝ ROW
    // =========================

    for (const row of rows) {

      const present =
        row.querySelector(
          'input[type="radio"][id$="_rdPresent"]'
        );

      const absent =
        row.querySelector(
          'input[type="radio"][id$="_rdAbsent"]'
        );


      const rowText =
        row.textContent
          .trim()
          .toLowerCase();


      let isPresent = false;


      for (const roll of rollSet) {

        if (rowText.includes(roll)) {

          isPresent = true;
          break;
        }
      }


      if (isPresent) {

        if (!present.checked) {
          present.click();
        }

        presentCount++;

      } else {

        if (!absent.checked) {
          absent.click();
        }

        absentCount++;
      }
    }


    // =========================
    // KIỂM TRA ROLL KHÔNG TÌM THẤY
    // =========================

    for (const roll of rollNumbers) {

      const found = rows.some(row => {

        return row.textContent
          .trim()
          .toLowerCase()
          .includes(
            roll.toLowerCase()
          );
      });

      if (!found) {
        notFound.push(roll);
      }
    }


    // =========================
    // KẾT QUẢ
    // =========================

    let result =
      `✓ Present: ${presentCount}` +
      `\n✓ Absent: ${absentCount}`;


    if (notFound.length) {

      result +=
        `\n\n⚠️ Roll Number không tìm thấy:` +
        `\n${notFound.join("\n")}`;
    }


    status.textContent = result;


    // =========================
    // SAVE
    // =========================

    await saveAttendance();


    executeBtn.disabled = false;
    allBtn.disabled = false;
    executeBtn.textContent = "Điểm danh";
  };


  // =========================
  // ĐIỂM DANH TOÀN BỘ
  // =========================

  allBtn.onclick = async () => {

    const confirmed = confirm(
      "Bạn có chắc muốn điểm danh PRESENT cho TOÀN BỘ sinh viên không?"
    );

    if (!confirmed) {
      return;
    }


    const rows = getAttendanceRows();

    if (!rows) {

      status.textContent =
        "❌ Không tìm thấy bảng điểm danh.";

      return;
    }


    executeBtn.disabled = true;
    allBtn.disabled = true;
    allBtn.textContent = "Đang điểm danh...";


    let presentCount = 0;


    // =========================
    // CHUYỂN TẤT CẢ → PRESENT
    // =========================

    for (const row of rows) {

      const present =
        row.querySelector(
          'input[type="radio"][id$="_rdPresent"]'
        );

      if (!present) {
        continue;
      }


      if (!present.checked) {
        present.click();
      }

      presentCount++;
    }


    status.textContent =
      `✓ Đã điểm danh toàn bộ.` +
      `\n✓ Present: ${presentCount}` +
      `\n✓ Absent: 0`;


    // =========================
    // SAVE
    // =========================

    await saveAttendance();


    executeBtn.disabled = false;
    allBtn.disabled = false;
    allBtn.textContent = "✓ Điểm danh toàn bộ";
  };

})();