const STORAGE_KEY = "personal_cards_v6";

let people = loadPeople();
let selectedPersonId = null;
let deleteSelectionMode = false;
let selectedDeleteIds = new Set();
let showHidden = false;

function loadPeople() {
  const raw =
    localStorage.getItem(STORAGE_KEY) ||
    localStorage.getItem("personal_cards_v5") ||
    localStorage.getItem("personal_cards_v4") ||
    localStorage.getItem("personal_cards_v3") ||
    localStorage.getItem("personal_cards_v2");

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeImportedPeople(parsed);
  } catch (error) {
    console.error("데이터 로드 실패:", error);
    return [];
  }
}

function savePeople() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
}

function formatNow() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function resolveFourDigitYear(twoDigitYear) {
  const currentTwoDigitYear = new Date().getFullYear() % 100;
  return Number(twoDigitYear) <= currentTwoDigitYear
    ? 2000 + Number(twoDigitYear)
    : 1900 + Number(twoDigitYear);
}

function parseBirthDate(value) {
  const digits = digitsOnly(value).slice(0, 6);
  if (digits.length !== 6) return null;

  const year = resolveFourDigitYear(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return {
    raw: digits,
    year,
    month,
    day,
    display: `${year}년 ${String(month).padStart(2, "0")}월 ${String(day).padStart(2, "0")}일`
  };
}

function calculateKoreanAge(value) {
  const parsed = parseBirthDate(value);
  if (!parsed) return "";
  return String(new Date().getFullYear() - parsed.year + 1);
}

function formatBirthPreview(value) {
  const parsed = parseBirthDate(value);
  return parsed ? parsed.display : "";
}

function formatConsultDate(value) {
  const digits = digitsOnly(value).slice(0, 6);
  if (digits.length !== 6) return "";

  const year = Number(`20${digits.slice(0, 2)}`);
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "";
  }

  return `${digits.slice(0, 2)}년 ${digits.slice(2, 4)}월 ${digits.slice(4, 6)}일`;
}

function formatPhoneNumber(value) {
  const digits = digitsOnly(value).slice(0, 11);

  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function normalizeNote(note, fallbackDate) {
  if (!note || typeof note !== "object") return null;

  const content = String(note.content || "").trim();
  if (!content) return null;

  const rawDate = digitsOnly(note.rawDate || "");
  const displayDate = String(note.date || "").trim() || formatConsultDate(rawDate) || fallbackDate;

  return {
    rawDate,
    date: displayDate,
    content
  };
}

function normalizeImportedPeople(imported) {
  return imported
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const now = formatNow();
      const fallbackNotes = Array.isArray(item.notes)
        ? item.notes
        : item.memo
          ? [{ date: item.updatedAt || item.createdAt || now, content: String(item.memo).trim() }]
          : [];

      return {
        id: String(item.id || `${Date.now()}_${index}`),
        name: String(item.name || "").trim(),
        gender: String(item.gender || "").trim(),
        phone: formatPhoneNumber(item.phone || ""),
        email: String(item.email || "").trim(),
        address: String(item.address || "").trim(),
        birthDate: digitsOnly(item.birthDate || item.birthRaw || "").slice(0, 6),
        job: String(item.job || "").trim(),
        tags: Array.isArray(item.tags)
          ? item.tags.map((tag) => String(tag).trim()).filter(Boolean)
          : String(item.tags || "")
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
        notes: fallbackNotes.map((note) => normalizeNote(note, now)).filter(Boolean),
        hidden: !!item.hidden,
        createdAt: String(item.createdAt || now),
        updatedAt: String(item.updatedAt || item.createdAt || now)
      };
    })
    .filter((person) => person.name);
}

function exportData() {
  try {
    const dataStr = JSON.stringify(people, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const now = new Date();
    const filename = `personal_cards_backup_${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.json`;

    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    alert("백업 파일을 다운로드했습니다.");
  } catch (error) {
    console.error("백업 실패:", error);
    alert("백업 중 오류가 발생했습니다.");
  }
}

function mergePeople(existingPeople, importedPeople) {
  const merged = existingPeople.map((person) => ({ ...person }));
  const existingIds = new Set(merged.map((person) => person.id));

  importedPeople.forEach((person) => {
    let nextId = String(person.id);
    if (existingIds.has(nextId)) {
      nextId = `${nextId}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    }

    merged.push({ ...person, id: nextId });
    existingIds.add(nextId);
  });

  return merged;
}

function openForm() {
  const formPanel = document.getElementById("formPanel");
  const addButton = document.getElementById("toggleFormButton");
  if (formPanel) formPanel.hidden = false;
  if (addButton) addButton.textContent = "입력창 닫기";
  document.getElementById("name")?.focus();
}

function closeForm() {
  const formPanel = document.getElementById("formPanel");
  const addButton = document.getElementById("toggleFormButton");
  if (formPanel) formPanel.hidden = true;
  if (addButton) addButton.textContent = "고객추가";
}

function toggleForm() {
  const formPanel = document.getElementById("formPanel");
  if (!formPanel) return;
  formPanel.hidden ? openForm() : closeForm();
}

function toggleDeleteMode() {
  deleteSelectionMode = !deleteSelectionMode;
  if (!deleteSelectionMode) {
    selectedDeleteIds.clear();
  }
  updateDeleteToolbar();
  renderList();
}

function updateDeleteToolbar() {
  const toggleButton = document.getElementById("toggleDeleteModeButton");
  const deleteButton = document.getElementById("deleteSelectedButton");

  if (toggleButton) {
    toggleButton.textContent = deleteSelectionMode ? "선택취소" : "선택삭제";
  }

  if (deleteButton) {
    deleteButton.hidden = !deleteSelectionMode;
    deleteButton.textContent = `삭제 실행 (${selectedDeleteIds.size})`;
  }
}

function deleteSelectedPeople() {
  if (selectedDeleteIds.size === 0) {
    alert("삭제할 고객을 먼저 선택하세요.");
    return;
  }

  if (!confirm(`선택한 ${selectedDeleteIds.size}명을 삭제할까요?`)) {
    return;
  }

  people = people.filter((person) => !selectedDeleteIds.has(person.id));
  selectedDeleteIds.clear();
  deleteSelectionMode = false;

  if (selectedPersonId && !people.some((person) => person.id === selectedPersonId)) {
    selectedPersonId = null;
  }

  savePeople();
  updateDeleteToolbar();
  renderList();
  renderDetailPanel();
}

function bindDataControls() {
  const exportButton = document.getElementById("exportButton");
  const importButton = document.getElementById("importButton");
  const importFile = document.getElementById("importFile");
  const toggleFormButton = document.getElementById("toggleFormButton");
  const cancelFormButton = document.getElementById("cancelFormButton");
  const toggleDeleteModeButton = document.getElementById("toggleDeleteModeButton");
  const deleteSelectedButton = document.getElementById("deleteSelectedButton");

  exportButton?.addEventListener("click", exportData);
  importButton?.addEventListener("click", () => importFile?.click());
  toggleFormButton?.addEventListener("click", toggleForm);
  cancelFormButton?.addEventListener("click", closeForm);
  toggleDeleteModeButton?.addEventListener("click", toggleDeleteMode);
  deleteSelectedButton?.addEventListener("click", deleteSelectedPeople);
}

function bindImportFile() {
  const input = document.getElementById("importFile");
  const importMode = document.getElementById("importMode");
  if (!input || !importMode) return;

  input.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      try {
        const text = String(loadEvent.target?.result || "");
        const parsed = JSON.parse(text);

        if (!Array.isArray(parsed)) {
          alert("올바른 JSON 배열 백업 파일만 불러올 수 있습니다.");
          return;
        }

        const importedPeople = normalizeImportedPeople(parsed);
        if (importedPeople.length === 0) {
          alert("불러올 데이터가 없습니다.");
          return;
        }

        people =
          importMode.value === "replace"
            ? importedPeople
            : mergePeople(people, importedPeople);

        savePeople();
        renderList();
        renderDetailPanel();
        alert(`${importedPeople.length}개의 카드 데이터를 불러왔습니다.`);
      } catch (error) {
        console.error("가져오기 실패:", error);
        alert("JSON 파일을 읽는 중 오류가 발생했습니다.");
      } finally {
        input.value = "";
      }
    };

    reader.onerror = () => {
      alert("파일을 읽지 못했습니다.");
      input.value = "";
    };

    reader.readAsText(file, "utf-8");
  });
}

function bindBirthDatePreview() {
  const birthInput = document.getElementById("birthDate");
  const ageInput = document.getElementById("age");
  const birthPreview = document.getElementById("birthPreview");
  if (!birthInput || !ageInput || !birthPreview) return;

  const updatePreview = () => {
    const raw = digitsOnly(birthInput.value).slice(0, 6);
    birthInput.value = raw;
    ageInput.value = calculateKoreanAge(raw);
    birthPreview.textContent =
      raw.length === 6 ? formatBirthPreview(raw) || "유효한 생년월일이 아닙니다." : "";
  };

  birthInput.addEventListener("input", updatePreview);
  updatePreview();
}

function bindConsultDatePreview() {
  const consultInput = document.getElementById("firstConsultDate");
  const consultPreview = document.getElementById("consultDatePreview");
  if (!consultInput || !consultPreview) return;

  const updatePreview = () => {
    const raw = digitsOnly(consultInput.value).slice(0, 6);
    consultInput.value = raw;
    consultPreview.textContent =
      raw.length === 6 ? formatConsultDate(raw) || "유효한 상담일자가 아닙니다." : "";
  };

  consultInput.addEventListener("input", updatePreview);
  updatePreview();
}

function bindPhoneFormatter() {
  const phoneInput = document.getElementById("phone");
  if (!phoneInput) return;

  phoneInput.addEventListener("input", () => {
    phoneInput.value = formatPhoneNumber(phoneInput.value);
  });
}

function bindFormKeyboard() {
  const form = document.getElementById("personForm");
  if (!form) return;

  form.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.tagName !== "TEXTAREA") {
      event.preventDefault();
    }
  });
}

function showDetail(personId) {
  selectedPersonId = personId;
  renderList();
  renderDetailPanel();
}

function closeDetailSheet() {
  selectedPersonId = null;
  const sheetRoot = document.getElementById("detailSheetRoot");
  if (sheetRoot) sheetRoot.hidden = true;
  document.body.classList.remove("sheet-open");
  renderList();
}

function createNoteItem(note) {
  return `
    <div class="note-item">
      <div class="note-head">
        <div class="note-date">${escapeHtml(note.date || "-")}</div>
        <button type="button" class="mini-button" data-action="edit-note" data-note-index="${note.index}">수정</button>
      </div>
      <div class="note-text">${escapeHtml(note.content).replace(/\n/g, "<br>")}</div>
    </div>
  `;
}

function bindDetailBirthPreview(person) {
  const birthInput = document.getElementById("detailBirthDate");
  const ageInput = document.getElementById("detailAge");
  const preview = document.getElementById("detailBirthPreview");
  if (!birthInput || !ageInput || !preview) return;

  const updatePreview = () => {
    const raw = digitsOnly(birthInput.value).slice(0, 6);
    birthInput.value = raw;
    ageInput.value = calculateKoreanAge(raw);
    preview.textContent =
      raw.length === 6 ? formatBirthPreview(raw) || "유효한 생년월일이 아닙니다." : "";
  };

  birthInput.addEventListener("input", updatePreview);
  updatePreview();
}

function bindDetailConsultPreview() {
  const consultInput = document.getElementById("detailConsultDate");
  const preview = document.getElementById("detailConsultPreview");
  if (!consultInput || !preview) return;

  const updatePreview = () => {
    const raw = digitsOnly(consultInput.value).slice(0, 6);
    consultInput.value = raw;
    preview.textContent =
      raw.length === 6 ? formatConsultDate(raw) || "유효한 상담일자가 아닙니다." : "";
  };

  consultInput.addEventListener("input", updatePreview);
  updatePreview();
}

function bindDetailPhoneFormatter() {
  const phoneInput = document.getElementById("detailPhone");
  if (!phoneInput) return;

  phoneInput.addEventListener("input", () => {
    phoneInput.value = formatPhoneNumber(phoneInput.value);
  });
}

function toggleShowHidden() {
  showHidden = !showHidden;
  renderList();
}

function toggleHidePerson(personId) {
  const person = people.find((p) => p.id === personId);
  if (!person) return;
  person.hidden = !person.hidden;
  person.updatedAt = formatNow();
  savePeople();
  if (person.hidden) {
    closeDetailSheet();
  } else {
    renderList();
    renderDetailPanel();
  }
}

// ── 초성 추출 ──
function getChosung(name) {
  const CHOSUNG = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
  const ch = (name || "").trim().charCodeAt(0);
  if (ch >= 0xAC00 && ch <= 0xD7A3) {
    return CHOSUNG[Math.floor((ch - 0xAC00) / 588)];
  }
  if (ch >= 65 && ch <= 90)  return "A-Z";
  if (ch >= 97 && ch <= 122) return "A-Z";
  return "#";
}

// 초성 그룹 열림 상태 저장 (localStorage)
const GROUP_STATE_KEY = "customer_group_state_v1";
function loadGroupState() {
  try { return JSON.parse(localStorage.getItem(GROUP_STATE_KEY) || "{}"); } catch { return {}; }
}
function saveGroupState(state) {
  localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(state));
}

function renderList() {
  const listEl = document.getElementById("personList");
  const countEl = document.getElementById("personCount");
  if (!listEl) return;

  listEl.innerHTML = "";

  const visiblePeople = people.filter((p) => !p.hidden);
  const displayList = showHidden ? people : visiblePeople;

  if (countEl) {
    countEl.textContent = `전체 ${visiblePeople.length}명`;
  }

  if (displayList.length === 0) {
    listEl.innerHTML = people.length === 0
      ? `<p class="empty">등록된 사람이 없습니다. 고객추가 버튼으로 첫 카드를 만들어보세요.</p>`
      : `<p class="empty">표시할 고객이 없습니다.</p>`;
    return;
  }

  // 초성 기준 정렬 (같은 초성 내에서는 이름 가나다순)
  const CHOSUNG_ORDER = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ","A-Z","#"];
  const sorted = displayList.slice().sort((a, b) => {
    const ca = getChosung(a.name), cb = getChosung(b.name);
    const ia = CHOSUNG_ORDER.indexOf(ca), ib = CHOSUNG_ORDER.indexOf(cb);
    if (ia !== ib) return ia - ib;
    return (a.name || "").localeCompare(b.name || "", "ko");
  });

  // 그룹화
  const groups = [];
  const groupMap = {};
  sorted.forEach(person => {
    const ch = getChosung(person.name);
    if (!groupMap[ch]) {
      groupMap[ch] = { chosung: ch, people: [] };
      groups.push(groupMap[ch]);
    }
    groupMap[ch].people.push(person);
  });

  const groupState = loadGroupState();

  groups.forEach(group => {
    const { chosung, people: gPeople } = group;
    // 기본: 처음엔 모두 펼침. 저장된 상태가 있으면 따름
    const isOpen = groupState[chosung] !== false;

    // 그룹 헤더
    const header = document.createElement("button");
    header.type = "button";
    header.className = "chosung-group-header";
    header.dataset.chosung = chosung;
    header.innerHTML = `
      <span class="chosung-label">${chosung}</span>
      <span class="chosung-count">${gPeople.length}명</span>
      <span class="chosung-arrow">${isOpen ? "▲" : "▼"}</span>
    `;

    // 그룹 카드 컨테이너
    const grid = document.createElement("div");
    grid.className = "person-list-group-grid";
    if (!isOpen) grid.style.display = "none";

    header.addEventListener("click", () => {
      const opened = grid.style.display !== "none";
      grid.style.display = opened ? "none" : "";
      header.querySelector(".chosung-arrow").textContent = opened ? "▼" : "▲";
      const state = loadGroupState();
      state[chosung] = !opened;
      saveGroupState(state);
    });

    // 카드 렌더
    gPeople.forEach(person => {
      const card = document.createElement("div");
      const isChecked = selectedDeleteIds.has(person.id);
      const isActive = selectedPersonId === person.id;
      const koreanAge = calculateKoreanAge(person.birthDate);
      const isHidden = !!person.hidden;

      card.className = `person-card${isActive ? " active" : ""}${isHidden ? " hidden-person" : ""}`;
      card.innerHTML = `
        <div class="person-card-top">
          <div class="person-title-wrap">
            ${
              deleteSelectionMode
                ? `<label class="select-box"><input type="checkbox" data-action="select"${isChecked ? " checked" : ""} /><span>선택</span></label>`
                : ""
            }
            <button type="button" class="person-name-button" data-action="toggle">${escapeHtml(person.name)}${isHidden ? ' <span class="hidden-badge">숨김</span>' : ""}</button>
          </div>
          <div class="sub">${escapeHtml(person.gender || "-")} · ${escapeHtml(koreanAge ? `${koreanAge}세` : "-")}</div>
          <div class="sub">${escapeHtml(person.phone || "전화번호 없음")}</div>
          <div class="sub">${escapeHtml(person.job || "직업 미입력")}</div>
          <div class="sub">상담내역 ${(person.notes || []).length}건</div>
        </div>
      `;

      card.querySelector('[data-action="toggle"]')?.addEventListener("click", () => {
        showDetail(person.id);
      });

      card.querySelector('[data-action="select"]')?.addEventListener("change", (event) => {
        if (event.target.checked) {
          selectedDeleteIds.add(person.id);
        } else {
          selectedDeleteIds.delete(person.id);
        }
        updateDeleteToolbar();
      });

      grid.appendChild(card);
    });

    listEl.appendChild(header);
    listEl.appendChild(grid);
  });
}

function renderDetailPanel() {
  const sheetRoot = document.getElementById("detailSheetRoot");
  const content = document.getElementById("detailContent");
  if (!sheetRoot || !content) return;

  const person = people.find((item) => item.id === selectedPersonId);
  if (!person) {
    sheetRoot.hidden = true;
    document.body.classList.remove("sheet-open");
    content.innerHTML = "";
    return;
  }

  const koreanAge = calculateKoreanAge(person.birthDate);
  const tagsHtml = (person.tags || [])
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("");
  const notesHtml = (person.notes || [])
    .map((note, index) => ({ ...note, index }))
    .slice()
    .sort((a, b) => (b.rawDate || "").localeCompare(a.rawDate || ""))
    .map(createNoteItem)
    .join("");

  content.innerHTML = `
    <div class="detail-hero">
      <div>
        <h3>${escapeHtml(person.name)}</h3>
        <p class="sub">${escapeHtml(person.gender || "-")} · ${escapeHtml(koreanAge ? `${koreanAge}세` : "-")}</p>
      </div>
      <div class="detail-hero-actions">
        <button type="button" id="toggleHidePersonButton" class="secondary-button detail-close">${person.hidden ? "숨김 해제" : "숨기기"}</button>
        <button type="button" id="closeDetailButton" class="secondary-button detail-close">닫기</button>
      </div>
    </div>

    <div class="detail-grid large">
      <div><span class="detail-label">전화번호</span><strong>${escapeHtml(person.phone || "-")}</strong></div>
      <div><span class="detail-label">메일주소</span><strong>${escapeHtml(person.email || "-")}</strong></div>
      <div><span class="detail-label">생년월일</span><strong>${escapeHtml(formatBirthPreview(person.birthDate) || "-")}</strong></div>
      <div><span class="detail-label">직업</span><strong>${escapeHtml(person.job || "-")}</strong></div>
      <div><span class="detail-label">주소</span><strong>${escapeHtml(person.address || "-")}</strong></div>
      <div><span class="detail-label">태그</span><strong>${tagsHtml || "-"}</strong></div>
    </div>

    <div class="detail-meta">
      <span>생성일 ${escapeHtml(person.createdAt)}</span>
      <span>수정일 ${escapeHtml(person.updatedAt)}</span>
    </div>

    <hr />

    <div class="notes-section">
      <h4>상담내역</h4>
      ${notesHtml
        ? `<div class="notes-card">${notesHtml}</div>`
        : "<p class='empty'>상담내역이 없습니다.</p>"}
    </div>

    <hr />

    <div class="detail-edit-section">
      <h4>상담내역 추가</h4>
      <div class="detail-note-editor">
        <input type="text" id="detailConsultDate" maxlength="6" inputmode="numeric" placeholder="상담일자 6자리 예: 260320" />
        <div class="preview-text" id="detailConsultPreview"></div>
        <textarea id="detailConsultContent" placeholder="상담내용을 입력하세요" lang="ko" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea>
        <div class="detail-action-row">
          <button type="button" id="addDetailNoteButton">상담내역 추가</button>
        </div>
      </div>
    </div>

    <hr />

    <div class="accordion-section">
      <button type="button" class="accordion-toggle" id="toggleProfileEdit">
        <span>인적사항 수정</span>
        <span class="accordion-icon">›</span>
      </button>
      <div class="accordion-body" id="profileEditBody" hidden>
        <div class="detail-grid large">
          <div>
            <span class="detail-label">이름</span>
            <input type="text" id="detailName" value="${escapeHtml(person.name)}" lang="ko" autocapitalize="off" autocorrect="off" spellcheck="false" />
          </div>
          <div>
            <span class="detail-label">성별</span>
            <select id="detailGender" lang="ko">
              <option value="" ${person.gender ? "" : "selected"}>성별 선택</option>
              <option value="남" ${person.gender === "남" ? "selected" : ""}>남</option>
              <option value="여" ${person.gender === "여" ? "selected" : ""}>여</option>
            </select>
          </div>
          <div>
            <span class="detail-label">전화번호</span>
            <input type="text" id="detailPhone" inputmode="numeric" value="${escapeHtml(person.phone || "")}" />
          </div>
          <div>
            <span class="detail-label">메일주소</span>
            <input type="email" id="detailEmail" value="${escapeHtml(person.email || "")}" autocapitalize="off" autocorrect="off" spellcheck="false" />
          </div>
          <div>
            <span class="detail-label">생년월일 6자리</span>
            <input type="text" id="detailBirthDate" maxlength="6" inputmode="numeric" value="${escapeHtml(person.birthDate || "")}" />
            <div class="preview-text" id="detailBirthPreview"></div>
          </div>
          <div>
            <span class="detail-label">한국식 나이</span>
            <input type="text" id="detailAge" readonly />
          </div>
          <div>
            <span class="detail-label">직업</span>
            <input type="text" id="detailJob" value="${escapeHtml(person.job || "")}" lang="ko" autocapitalize="off" autocorrect="off" spellcheck="false" />
          </div>
          <div>
            <span class="detail-label">주소</span>
            <input type="text" id="detailAddress" value="${escapeHtml(person.address || "")}" lang="ko" autocapitalize="off" autocorrect="off" spellcheck="false" />
          </div>
          <div class="detail-span-all">
            <span class="detail-label">태그</span>
            <input type="text" id="detailTags" value="${escapeHtml((person.tags || []).join(", "))}" lang="ko" autocapitalize="off" autocorrect="off" spellcheck="false" />
          </div>
        </div>
        <div class="detail-action-row" style="margin-top:12px">
          <button type="button" id="saveDetailProfileButton">인적사항 저장</button>
        </div>
      </div>
    </div>
  `;

  content.querySelector("#toggleHidePersonButton")?.addEventListener("click", () => {
    toggleHidePerson(person.id);
  });

  content.querySelector("#closeDetailButton")?.addEventListener("click", () => {
    closeDetailSheet();
  });

  content.querySelectorAll('[data-action="edit-note"]').forEach((button) => {
    button.addEventListener("click", () => {
      editNote(person.id, Number(button.dataset.noteIndex));
    });
  });

  content.querySelector("#saveDetailProfileButton")?.addEventListener("click", () => {
    saveDetailProfile(person.id);
  });

  content.querySelector("#addDetailNoteButton")?.addEventListener("click", () => {
    addDetailNote(person.id);
  });

  content.querySelector("#toggleProfileEdit")?.addEventListener("click", () => {
    const body = document.getElementById("profileEditBody");
    const icon = content.querySelector(".accordion-icon");
    if (body) {
      body.hidden = !body.hidden;
      icon.textContent = body.hidden ? "›" : "▾";
    }
  });

  bindDetailBirthPreview(person);
  bindDetailConsultPreview();
  bindDetailPhoneFormatter();

  sheetRoot.hidden = false;
  document.body.classList.add("sheet-open");
  sheetRoot.querySelector(".bottom-sheet")?.scrollTo(0, 0);
}

function saveDetailProfile(personId) {
  const person = people.find((item) => item.id === personId);
  if (!person) return;

  const name = document.getElementById("detailName")?.value.trim() || "";
  const gender = document.getElementById("detailGender")?.value.trim() || "";
  const phone = formatPhoneNumber(document.getElementById("detailPhone")?.value || "");
  const email = document.getElementById("detailEmail")?.value.trim() || "";
  const birthDate = digitsOnly(document.getElementById("detailBirthDate")?.value || "").slice(0, 6);
  const job = document.getElementById("detailJob")?.value.trim() || "";
  const address = document.getElementById("detailAddress")?.value.trim() || "";
  const tagsRaw = document.getElementById("detailTags")?.value.trim() || "";

  if (!name) {
    alert("이름은 필수입니다.");
    return;
  }

  if (birthDate && !parseBirthDate(birthDate)) {
    alert("생년월일 6자리를 올바르게 입력하세요.");
    return;
  }

  person.name = name;
  person.gender = gender;
  person.phone = phone;
  person.email = email;
  person.birthDate = birthDate;
  person.job = job;
  person.address = address;
  person.tags = tagsRaw
    ? tagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean)
    : [];
  person.updatedAt = formatNow();

  savePeople();
  renderList();
  renderDetailPanel();
  alert("인적사항을 저장했습니다.");
}

function addDetailNote(personId) {
  const person = people.find((item) => item.id === personId);
  if (!person) return;

  const rawDate = digitsOnly(document.getElementById("detailConsultDate")?.value || "").slice(0, 6);
  const content = document.getElementById("detailConsultContent")?.value.trim() || "";
  const formattedDate = formatConsultDate(rawDate);

  if (!formattedDate) {
    alert("상담일자 6자리를 올바르게 입력하세요.");
    return;
  }

  if (!content) {
    alert("상담내용을 입력하세요.");
    return;
  }

  person.notes = Array.isArray(person.notes) ? person.notes : [];
  person.notes.push({
    rawDate,
    date: formattedDate,
    content
  });
  person.updatedAt = formatNow();

  savePeople();
  renderList();
  renderDetailPanel();
}

function editNote(personId, noteIndex) {
  const person = people.find((item) => item.id === personId);
  const note = person?.notes?.[noteIndex];
  if (!person || !note) return;

  const nextDate = prompt("상담일자 6자리를 입력하세요.", note.rawDate || "");
  if (nextDate === null) return;

  const formattedDate = formatConsultDate(nextDate);
  if (!formattedDate) {
    alert("상담일자 6자리를 올바르게 입력하세요.");
    return;
  }

  const nextContent = prompt("상담내용을 수정하세요.", note.content || "");
  if (nextContent === null) return;

  const trimmedContent = nextContent.trim();
  if (!trimmedContent) {
    alert("상담내용을 입력하세요.");
    return;
  }

  person.notes[noteIndex] = {
    rawDate: digitsOnly(nextDate).slice(0, 6),
    date: formattedDate,
    content: trimmedContent
  };
  person.updatedAt = formatNow();

  savePeople();
  renderList();
  renderDetailPanel();
}

function bindForm() {
  const form = document.getElementById("personForm");
  if (!form) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = document.getElementById("name")?.value.trim() || "";
    const gender = document.getElementById("gender")?.value.trim() || "";
    const phone = formatPhoneNumber(document.getElementById("phone")?.value || "");
    const email = document.getElementById("email")?.value.trim() || "";
    const address = document.getElementById("address")?.value.trim() || "";
    const birthDate = digitsOnly(document.getElementById("birthDate")?.value || "").slice(0, 6);
    const job = document.getElementById("job")?.value.trim() || "";
    const tagsRaw = document.getElementById("tags")?.value.trim() || "";
    const firstConsultDate = digitsOnly(document.getElementById("firstConsultDate")?.value || "").slice(0, 6);
    const firstNote = document.getElementById("firstNote")?.value.trim() || "";

    if (!name) {
      alert("이름은 필수입니다.");
      return;
    }

    if (birthDate && !parseBirthDate(birthDate)) {
      alert("생년월일 6자리를 올바르게 입력하세요.");
      return;
    }

    if (firstConsultDate && !formatConsultDate(firstConsultDate)) {
      alert("상담일자 6자리를 올바르게 입력하세요.");
      return;
    }

    const now = formatNow();
    const person = {
      id: String(Date.now()),
      name,
      gender,
      phone,
      email,
      address,
      birthDate,
      job,
      tags: tagsRaw
        ? tagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean)
        : [],
      notes: [],
      createdAt: now,
      updatedAt: now
    };

    if (firstNote) {
      person.notes.push({
        rawDate: firstConsultDate,
        date: formatConsultDate(firstConsultDate) || now,
        content: firstNote
      });
    }

    people.push(person);
    savePeople();
    selectedPersonId = person.id;
    renderList();
    renderDetailPanel();
    this.reset();

    const ageInput = document.getElementById("age");
    const birthPreview = document.getElementById("birthPreview");
    const consultDatePreview = document.getElementById("consultDatePreview");
    if (ageInput) ageInput.value = "";
    if (birthPreview) birthPreview.textContent = "";
    if (consultDatePreview) consultDatePreview.textContent = "";

    closeForm();
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js");
      await registration.update();

      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      registration.addEventListener("updatefound", () => {
        const nextWorker = registration.installing;
        if (!nextWorker) return;

        nextWorker.addEventListener("statechange", () => {
          if (nextWorker.state === "installed" && navigator.serviceWorker.controller) {
            nextWorker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    } catch (error) {
      console.error("Service Worker 등록 실패:", error);
    }
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

function bindSheetBackdrop() {
  document.getElementById("sheetBackdrop")?.addEventListener("click", () => {
    closeDetailSheet();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDetailSheet();
  });
}

function bindSecretHiddenToggle() {
  const btn = document.getElementById("secretHiddenToggle");
  if (!btn) return;

  let clickCount = 0;
  let timer = null;

  btn.addEventListener("click", () => {
    clickCount++;
    clearTimeout(timer);
    timer = setTimeout(() => { clickCount = 0; }, 800);

    if (clickCount >= 3) {
      clickCount = 0;
      clearTimeout(timer);
      toggleShowHidden();
    }
  });
}

function init() {
  bindDataControls();
  bindImportFile();
  bindBirthDatePreview();
  bindConsultDatePreview();
  bindPhoneFormatter();
  bindFormKeyboard();
  bindForm();
  bindSheetBackdrop();
  bindSecretHiddenToggle();
  updateDeleteToolbar();
  renderList();
  closeForm();
  bindSubTabs();
}

init();

// ── 하위 탭 ───────────────────────────────────────────────────

function bindSubTabs() {
  const tabs = document.querySelectorAll(".sub-tab");
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.dataset.tab;
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.hidden = panel.id !== `tab-${targetId}`;
      });

      if (targetId === "search") initSearch();
      if (targetId === "journal") initJournal();
    });
  });
}

// ── 검색 ───────────────────────────────────────────────────────

function initSearch() {
  const input = document.getElementById("searchInput");
  const resultsEl = document.getElementById("searchResults");
  if (!input || !resultsEl) return;

  // 이미 이벤트 바인딩된 경우 중복 방지
  if (input.dataset.bound) {
    renderSearchResults(input.value.trim());
    return;
  }
  input.dataset.bound = "1";

  input.addEventListener("input", () => {
    renderSearchResults(input.value.trim());
  });

  input.focus();
  renderSearchResults("");
}

function renderSearchResults(query) {
  const resultsEl = document.getElementById("searchResults");
  if (!resultsEl) return;

  const lowerQuery = query.toLowerCase();
  const matched = people
    .filter((p) => !p.hidden)
    .filter((p) => !query || p.name.toLowerCase().includes(lowerQuery))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  if (matched.length === 0) {
    resultsEl.innerHTML = `<p class="empty">${query ? "검색 결과가 없습니다." : "등록된 고객이 없습니다."}</p>`;
    return;
  }

  resultsEl.innerHTML = "";
  matched.forEach((person) => {
    const koreanAge = calculateKoreanAge(person.birthDate);
    const card = document.createElement("div");
    card.className = "person-card";
    card.innerHTML = `
      <div class="person-card-top">
        <div class="person-title-wrap">
          <button type="button" class="person-name-button">${escapeHtml(person.name)}</button>
        </div>
        <div class="sub">${escapeHtml(person.gender || "-")} · ${escapeHtml(koreanAge ? `${koreanAge}세` : "-")}</div>
        <div class="sub">${escapeHtml(person.phone || "전화번호 없음")}</div>
        <div class="sub">${escapeHtml(person.job || "직업 미입력")}</div>
      </div>
    `;
    card.querySelector(".person-name-button").addEventListener("click", () => {
      // 고객 목록 탭으로 이동 후 상세 열기
      const listTab = document.querySelector('.sub-tab[data-tab="list"]');
      listTab?.click();
      setTimeout(() => showDetail(person.id), 50);
    });
    resultsEl.appendChild(card);
  });
}

// ── 상담일지 캘린더 ────────────────────────────────────────────

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-indexed

function initJournal() {
  const prevBtn = document.getElementById("calPrev");
  const nextBtn = document.getElementById("calNext");
  if (!prevBtn || prevBtn.dataset.bound) {
    renderCalendar();
    return;
  }
  prevBtn.dataset.bound = "1";

  prevBtn.addEventListener("click", () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });
  nextBtn.addEventListener("click", () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });
  document.getElementById("journalDayClose")?.addEventListener("click", closeJournalDay);

  renderCalendar();
}

function getNotesForDate(rawDate) {
  // rawDate: "YYMMDD" — 캘린더는 YYYYMMDD로 비교
  const results = [];
  people.forEach((person) => {
    if (person.hidden) return;
    (person.notes || []).forEach((note, idx) => {
      if (!note.rawDate) return;
      // rawDate는 6자리 YYMMDD → 풀 날짜로 변환해 비교
      const d = parseRawDateToYYYYMMDD(note.rawDate);
      if (d === rawDate) {
        results.push({ person, note, noteIndex: idx });
      }
    });
  });
  return results;
}

function parseRawDateToYYYYMMDD(raw6) {
  // raw6: "YYMMDD" → "YYYYMMDD"
  if (!raw6 || raw6.length !== 6) return "";
  const yy = Number(raw6.slice(0, 2));
  const currentYY = new Date().getFullYear() % 100;
  const yyyy = yy <= currentYY ? 2000 + yy : 1900 + yy;
  return `${yyyy}${raw6.slice(2)}`;
}

function calDateKey(year, month1, day) {
  // month1: 1-indexed
  return `${year}${String(month1).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

function renderCalendar() {
  const titleEl = document.getElementById("calTitle");
  const gridEl = document.getElementById("calGrid");
  if (!titleEl || !gridEl) return;

  const month1 = calMonth + 1;
  titleEl.textContent = `${calYear}년 ${month1}월`;

  // 이 달에 상담내역이 있는 날짜 집합
  const datesWithNotes = new Set();
  people.forEach((person) => {
    if (person.hidden) return;
    (person.notes || []).forEach((note) => {
      const full = parseRawDateToYYYYMMDD(note.rawDate);
      if (full.startsWith(`${calYear}${String(month1).padStart(2, "0")}`)) {
        datesWithNotes.add(Number(full.slice(6)));
      }
    });
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=일
  const lastDate = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date();

  let html = `<div class="cal-weekdays"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div><div class="cal-days">`;

  for (let i = 0; i < firstDay; i++) html += `<span class="cal-day empty"></span>`;

  for (let d = 1; d <= lastDate; d++) {
    const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d;
    const hasDot = datesWithNotes.has(d);
    const key = calDateKey(calYear, month1, d);
    html += `<button type="button" class="cal-day${isToday ? " cal-today" : ""}${hasDot ? " cal-has-note" : ""}" data-key="${key}" data-day="${d}">${d}${hasDot ? '<span class="cal-dot"></span>' : ""}</button>`;
  }

  html += `</div>`;
  gridEl.innerHTML = html;

  gridEl.querySelectorAll(".cal-day[data-key]").forEach((btn) => {
    btn.addEventListener("click", () => openJournalDay(btn.dataset.key, Number(btn.dataset.day)));
  });
}

function openJournalDay(dateKey, day) {
  const panel = document.getElementById("journalDayPanel");
  const titleEl = document.getElementById("journalDayTitle");
  const notesEl = document.getElementById("journalDayNotes");
  const select = document.getElementById("journalPersonSelect");
  if (!panel || !titleEl || !notesEl || !select) return;

  const month1 = calMonth + 1;
  titleEl.textContent = `${calYear}년 ${month1}월 ${day}일`;

  const entries = getNotesForDate(dateKey);
  if (entries.length === 0) {
    notesEl.innerHTML = `<p class="empty">이 날의 상담내역이 없습니다.</p>`;
  } else {
    const grouped = {};
    entries.forEach(({ person, note }) => {
      if (!grouped[person.id]) grouped[person.id] = { name: person.name, notes: [] };
      grouped[person.id].notes.push(note);
    });
    notesEl.innerHTML = Object.values(grouped).map((g) => `
      <div class="journal-entry">
        <div class="journal-entry-name">${escapeHtml(g.name)}</div>
        <div class="notes-card">
          ${g.notes.map((n) => `
            <div class="note-item">
              <div class="note-text">${escapeHtml(n.content).replace(/\n/g, "<br>")}</div>
            </div>`).join("")}
        </div>
      </div>`).join("");
  }

  // 고객 선택 셀렉트 업데이트
  const visiblePeople = people.filter((p) => !p.hidden).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  select.innerHTML = `<option value="">고객 선택</option>` +
    visiblePeople.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("");

  // 추가 버튼 (중복 바인딩 방지)
  const addBtn = document.getElementById("journalAddNote");
  const newBtn = addBtn.cloneNode(true);
  addBtn.parentNode.replaceChild(newBtn, addBtn);
  newBtn.addEventListener("click", () => addJournalNote(dateKey));

  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function addJournalNote(dateKey) {
  const personId = document.getElementById("journalPersonSelect")?.value;
  const content = document.getElementById("journalContent")?.value.trim();

  if (!personId) { alert("고객을 선택하세요."); return; }
  if (!content) { alert("상담내용을 입력하세요."); return; }

  const person = people.find((p) => p.id === personId);
  if (!person) return;

  // dateKey: "YYYYMMDD" → rawDate 6자리 YY+MMDD
  const raw6 = dateKey.slice(2); // 8자리→6자리
  const formattedDate = formatConsultDate(raw6) || dateKey;

  person.notes = Array.isArray(person.notes) ? person.notes : [];
  person.notes.push({ rawDate: raw6, date: formattedDate, content });
  person.updatedAt = formatNow();
  savePeople();

  document.getElementById("journalContent").value = "";
  openJournalDay(dateKey, Number(dateKey.slice(6)));
  renderCalendar();
}

function closeJournalDay() {
  const panel = document.getElementById("journalDayPanel");
  if (panel) panel.hidden = true;
}
