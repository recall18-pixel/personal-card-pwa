const STORAGE_KEY = "personal_cards_v3";

let people = loadPeople();
let selectedPersonId = null;

function loadPeople() {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("personal_cards_v2");
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
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
}

function escapeHtml(str) {
  return String(str)
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
  const digits = digitsOnly(value);
  if (digits.length !== 6) return null;

  const yy = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const dd = digits.slice(4, 6);
  const fullYear = resolveFourDigitYear(yy);
  const month = Number(mm);
  const day = Number(dd);
  const date = new Date(fullYear, month - 1, day);

  if (
    date.getFullYear() !== fullYear ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return {
    raw: digits,
    year: fullYear,
    month,
    day,
    display: `${fullYear}년 ${String(month).padStart(2, "0")}월 ${String(day).padStart(2, "0")}일`
  };
}

function calculateAgeFromBirth(value) {
  const parsed = parseBirthDate(value);
  if (!parsed) return "";

  const today = new Date();
  let age = today.getFullYear() - parsed.year;
  const birthdayPassed =
    today.getMonth() + 1 > parsed.month ||
    (today.getMonth() + 1 === parsed.month && today.getDate() >= parsed.day);

  if (!birthdayPassed) {
    age -= 1;
  }

  return age >= 0 ? String(age) : "";
}

function formatBirthPreview(value) {
  const parsed = parseBirthDate(value);
  return parsed ? parsed.display : "";
}

function formatConsultDate(value) {
  const digits = digitsOnly(value);
  if (digits.length !== 6) return "";

  const yy = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const dd = digits.slice(4, 6);
  const month = Number(mm);
  const day = Number(dd);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return "";
  }

  return `${yy}년 ${mm}월 ${dd}일`;
}

function normalizeNote(note, fallbackDate) {
  if (!note || typeof note !== "object") return null;

  const content = String(note.content || "").trim();
  if (!content) return null;

  const rawDate = String(note.rawDate || "").trim();
  const formattedDate =
    String(note.date || "").trim() || formatConsultDate(rawDate) || fallbackDate || formatNow();

  return {
    rawDate,
    date: formattedDate,
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

      const birthRaw = digitsOnly(item.birthDate || item.birthRaw || "");
      const normalizedNotes = fallbackNotes
        .map((note) => normalizeNote(note, now))
        .filter(Boolean);

      return {
        id: String(item.id || `${Date.now()}_${index}`),
        name: String(item.name || "").trim(),
        gender: String(item.gender || "").trim(),
        phone: String(item.phone || "").trim(),
        address: String(item.address || "").trim(),
        birthDate: birthRaw,
        job: String(item.job || "").trim(),
        tags: Array.isArray(item.tags)
          ? item.tags.map((tag) => String(tag).trim()).filter(Boolean)
          : String(item.tags || "")
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
        notes: normalizedNotes,
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

function hideDetail() {
  selectedPersonId = null;
  const panel = document.getElementById("detailPanel");
  const content = document.getElementById("detailContent");
  if (panel) panel.hidden = true;
  if (content) content.innerHTML = "";
}

function mergePeople(existingPeople, importedPeople) {
  const merged = existingPeople.map((person) => ({ ...person }));
  const existingIds = new Set(merged.map((person) => String(person.id)));

  importedPeople.forEach((person) => {
    let nextId = String(person.id);
    if (existingIds.has(nextId)) {
      nextId = `${person.id}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    }

    merged.push({ ...person, id: nextId });
    existingIds.add(nextId);
  });

  return merged;
}

function bindDataControls() {
  const exportButton = document.getElementById("exportButton");
  const importButton = document.getElementById("importButton");
  const importFile = document.getElementById("importFile");

  exportButton?.addEventListener("click", exportData);
  importButton?.addEventListener("click", () => importFile?.click());
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
        hideDetail();
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
    ageInput.value = calculateAgeFromBirth(raw);
    birthPreview.textContent = raw.length === 6 ? formatBirthPreview(raw) || "유효한 생년월일이 아닙니다." : "";
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

function renderList() {
  const listEl = document.getElementById("personList");
  if (!listEl) return;

  listEl.innerHTML = "";

  if (people.length === 0) {
    listEl.innerHTML = `<p class="empty">등록된 사람이 없습니다.</p>`;
    return;
  }

  people
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .forEach((person) => {
      const card = document.createElement("div");
      card.className = "person-card";

      const age = calculateAgeFromBirth(person.birthDate);
      const birth = formatBirthPreview(person.birthDate);
      const tagsHtml = (person.tags || [])
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join("");

      card.innerHTML = `
        <div class="person-card-main">
          <strong>${escapeHtml(person.name)}</strong>
          <div class="sub">${escapeHtml(person.gender || "-")} · ${escapeHtml(age ? `${age}세` : "-")}</div>
          <div class="sub">${escapeHtml(person.phone || "전화번호 없음")}</div>
          <div class="sub">${escapeHtml(person.job || "직업 미입력")}</div>
          <div class="sub">${escapeHtml(birth || "생년월일 미입력")}</div>
          <div class="tags">${tagsHtml}</div>
          <div class="sub">상담내역 ${(person.notes || []).length}건</div>
        </div>
        <div class="person-card-actions">
          <button type="button" data-action="detail">${selectedPersonId === person.id ? "닫기" : "보기"}</button>
          <button type="button" data-action="delete">삭제</button>
        </div>
      `;

      card.querySelector('[data-action="detail"]')?.addEventListener("click", () => {
        if (selectedPersonId === person.id) {
          hideDetail();
          renderList();
          return;
        }

        showDetail(person.id);
        renderList();
      });

      card.querySelector('[data-action="delete"]')?.addEventListener("click", () => {
        deletePerson(person.id);
      });

      listEl.appendChild(card);
    });
}

function showDetail(personId) {
  const person = people.find((item) => item.id === personId);
  if (!person) return;

  if (selectedPersonId === personId) {
    hideDetail();
    renderList();
    return;
  }

  selectedPersonId = personId;

  const panel = document.getElementById("detailPanel");
  const content = document.getElementById("detailContent");
  if (!panel || !content) return;

  const age = calculateAgeFromBirth(person.birthDate);
  const notesHtml = (person.notes || [])
    .slice()
    .reverse()
    .map(
      (note) => `
        <div class="note-item">
          <div class="note-date">${escapeHtml(note.date || "-")}</div>
          <div class="note-text">${escapeHtml(note.content).replace(/\n/g, "<br>")}</div>
        </div>
      `
    )
    .join("");

  content.innerHTML = `
    <div class="detail-header">
      <h3>${escapeHtml(person.name)}</h3>
      <div class="detail-grid">
        <div><span class="detail-label">성별</span><strong>${escapeHtml(person.gender || "-")}</strong></div>
        <div><span class="detail-label">전화번호</span><strong>${escapeHtml(person.phone || "-")}</strong></div>
        <div><span class="detail-label">생년월일</span><strong>${escapeHtml(formatBirthPreview(person.birthDate) || "-")}</strong></div>
        <div><span class="detail-label">나이</span><strong>${escapeHtml(age ? `${age}세` : "-")}</strong></div>
        <div><span class="detail-label">직업</span><strong>${escapeHtml(person.job || "-")}</strong></div>
        <div><span class="detail-label">주소</span><strong>${escapeHtml(person.address || "-")}</strong></div>
      </div>
      <p>태그: ${(person.tags || []).map((tag) => `#${escapeHtml(tag)}`).join(" ") || "-"}</p>
      <p>생성일 ${escapeHtml(person.createdAt)}</p>
      <p>수정일 ${escapeHtml(person.updatedAt)}</p>
    </div>

    <hr>

    <div class="add-note-box">
      <h4>상담내역 추가</h4>
      <input type="text" id="newConsultDate" maxlength="6" placeholder="상담일자 6자리 예: 260320" />
      <div class="help-text" id="newConsultDatePreview"></div>
      <textarea id="newNoteText" placeholder="상담내용을 입력하세요"></textarea>
      <button type="button" id="addNoteButton">상담내역 저장</button>
    </div>

    <hr>

    <div class="notes-section">
      <h4>상담내역</h4>
      ${notesHtml || "<p class='empty'>상담내역이 없습니다.</p>"}
    </div>
  `;

  const consultInput = content.querySelector("#newConsultDate");
  const consultPreview = content.querySelector("#newConsultDatePreview");
  consultInput?.addEventListener("input", () => {
    const raw = digitsOnly(consultInput.value).slice(0, 6);
    consultInput.value = raw;
    consultPreview.textContent =
      raw.length === 6 ? formatConsultDate(raw) || "유효한 상담일자가 아닙니다." : "";
  });

  content.querySelector("#addNoteButton")?.addEventListener("click", addNote);
  panel.hidden = false;
}

function addNote() {
  if (!selectedPersonId) return;

  const noteInput = document.getElementById("newNoteText");
  const consultDateInput = document.getElementById("newConsultDate");
  if (!noteInput || !consultDateInput) return;

  const content = noteInput.value.trim();
  const rawDate = digitsOnly(consultDateInput.value).slice(0, 6);
  const formattedDate = formatConsultDate(rawDate);

  if (!rawDate || !formattedDate) {
    alert("상담일자 6자리를 올바르게 입력하세요.");
    return;
  }

  if (!content) {
    alert("상담내용을 입력하세요.");
    return;
  }

  const person = people.find((item) => item.id === selectedPersonId);
  if (!person) return;

  if (!Array.isArray(person.notes)) {
    person.notes = [];
  }

  person.notes.push({
    rawDate,
    date: formattedDate,
    content
  });
  person.updatedAt = formatNow();

  savePeople();
  renderList();
  showDetail(selectedPersonId);
}

function deletePerson(personId) {
  const person = people.find((item) => item.id === personId);
  if (!person) return;

  if (!confirm(`${person.name} 카드를 삭제할까요?`)) {
    return;
  }

  people = people.filter((item) => item.id !== personId);
  savePeople();

  if (selectedPersonId === personId) {
    hideDetail();
  }

  renderList();
}

function bindForm() {
  const form = document.getElementById("personForm");
  if (!form) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = document.getElementById("name")?.value.trim() || "";
    const gender = document.getElementById("gender")?.value.trim() || "";
    const phone = document.getElementById("phone")?.value.trim() || "";
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
    renderList();
    this.reset();

    const ageInput = document.getElementById("age");
    const birthPreview = document.getElementById("birthPreview");
    const consultPreview = document.getElementById("consultDatePreview");
    if (ageInput) ageInput.value = "";
    if (birthPreview) birthPreview.textContent = "";
    if (consultPreview) consultPreview.textContent = "";

    showDetail(person.id);
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
  bindForm();
  renderList();
  registerServiceWorker();
}

init();
