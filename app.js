const STORAGE_KEY = "personal_cards_v6";

let people = loadPeople();
let selectedPersonId = null;
let deleteSelectionMode = false;
let selectedDeleteIds = new Set();

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
  selectedPersonId = selectedPersonId === personId ? null : personId;
  renderList();
  renderDetailPanel();

  if (selectedPersonId) {
    document.getElementById("detailPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
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

function renderList() {
  const listEl = document.getElementById("personList");
  const countEl = document.getElementById("personCount");
  if (!listEl) return;

  listEl.innerHTML = "";
  if (countEl) {
    countEl.textContent = `총 ${people.length}명`;
  }

  if (people.length === 0) {
    listEl.innerHTML = `<p class="empty">등록된 사람이 없습니다. 고객추가 버튼으로 첫 카드를 만들어보세요.</p>`;
    return;
  }

  people
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .forEach((person) => {
      const card = document.createElement("div");
      const isChecked = selectedDeleteIds.has(person.id);
      const isActive = selectedPersonId === person.id;
      const koreanAge = calculateKoreanAge(person.birthDate);

      card.className = `person-card${isActive ? " active" : ""}`;
      card.innerHTML = `
        <div class="person-card-top">
          <div class="person-title-wrap">
            ${
              deleteSelectionMode
                ? `<label class="select-box"><input type="checkbox" data-action="select"${isChecked ? " checked" : ""} /><span>선택</span></label>`
                : ""
            }
            <button type="button" class="person-name-button" data-action="toggle">${escapeHtml(person.name)}</button>
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

      listEl.appendChild(card);
    });
}

function renderDetailPanel() {
  const panel = document.getElementById("detailPanel");
  const content = document.getElementById("detailContent");
  if (!panel || !content) return;

  const person = people.find((item) => item.id === selectedPersonId);
  if (!person) {
    panel.hidden = true;
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
    .reverse()
    .map(createNoteItem)
    .join("");

  content.innerHTML = `
    <div class="detail-hero">
      <div>
        <h3>${escapeHtml(person.name)}</h3>
        <p class="sub">${escapeHtml(person.gender || "-")} · ${escapeHtml(koreanAge ? `${koreanAge}세` : "-")}</p>
      </div>
      <button type="button" id="closeDetailButton" class="secondary-button detail-close">닫기</button>
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
      ${notesHtml || "<p class='empty'>상담내역이 없습니다.</p>"}
    </div>
  `;

  content.querySelector("#closeDetailButton")?.addEventListener("click", () => {
    selectedPersonId = null;
    renderList();
    renderDetailPanel();
  });

  content.querySelectorAll('[data-action="edit-note"]').forEach((button) => {
    button.addEventListener("click", () => {
      editNote(person.id, Number(button.dataset.noteIndex));
    });
  });

  panel.hidden = false;
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

function init() {
  bindDataControls();
  bindImportFile();
  bindBirthDatePreview();
  bindConsultDatePreview();
  bindPhoneFormatter();
  bindFormKeyboard();
  bindForm();
  updateDeleteToolbar();
  renderList();
  renderDetailPanel();
  closeForm();
  registerServiceWorker();
}

init();
