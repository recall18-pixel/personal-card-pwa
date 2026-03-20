const STORAGE_KEY = "personal_cards_v2";

let people = loadPeople();
let selectedPersonId = null;

function loadPeople() {
  const raw = localStorage.getItem(STORAGE_KEY);
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
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeImportedPeople(imported) {
  return imported
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const now = formatNow();
      const notes = Array.isArray(item.notes)
        ? item.notes
        : item.memo
          ? [{ date: item.updatedAt || item.createdAt || now, content: String(item.memo).trim() }]
          : [];

      return {
        id: String(item.id || `${Date.now()}_${index}`),
        name: String(item.name || "").trim(),
        phone: String(item.phone || "").trim(),
        tags: Array.isArray(item.tags)
          ? item.tags.map((tag) => String(tag).trim()).filter(Boolean)
          : String(item.tags || "")
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
        notes: notes
          .filter((note) => note && typeof note === "object")
          .map((note) => ({
            date: String(note.date || now),
            content: String(note.content || "").trim()
          }))
          .filter((note) => note.content),
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

    merged.push({
      ...person,
      id: nextId
    });
    existingIds.add(nextId);
  });

  return merged;
}

function bindDataControls() {
  const exportButton = document.getElementById("exportButton");
  const importButton = document.getElementById("importButton");
  const importFile = document.getElementById("importFile");

  if (exportButton) {
    exportButton.addEventListener("click", exportData);
  }

  if (importButton && importFile) {
    importButton.addEventListener("click", () => importFile.click());
  }
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

        const shouldReplace = importMode.value === "replace";
        people = shouldReplace ? importedPeople : mergePeople(people, importedPeople);

        savePeople();
        renderList();
        hideDetail();

        alert(
          shouldReplace
            ? `${importedPeople.length}개의 카드를 덮어쓰기 방식으로 복원했습니다.`
            : `${importedPeople.length}개의 카드를 기존 데이터와 병합했습니다.`
        );
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

      const tagsHtml = (person.tags || [])
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join("");

      card.innerHTML = `
        <div class="person-card-main">
          <strong>${escapeHtml(person.name)}</strong>
          <div class="sub">${escapeHtml(person.phone || "전화번호 없음")}</div>
          <div class="tags">${tagsHtml}</div>
          <div class="sub">기록 ${(person.notes || []).length}개</div>
          <div class="sub">수정일 ${escapeHtml(person.updatedAt)}</div>
        </div>
        <div class="person-card-actions">
          <button type="button" data-action="detail">보기</button>
          <button type="button" data-action="delete">삭제</button>
        </div>
      `;

      card.querySelector('[data-action="detail"]')?.addEventListener("click", () => {
        showDetail(person.id);
      });

      card.querySelector('[data-action="delete"]')?.addEventListener("click", () => {
        deletePerson(person.id);
      });

      listEl.appendChild(card);
    });
}

function showDetail(personId) {
  selectedPersonId = personId;
  const person = people.find((item) => item.id === personId);
  if (!person) return;

  const panel = document.getElementById("detailPanel");
  const content = document.getElementById("detailContent");
  if (!panel || !content) return;

  const notesHtml = (person.notes || [])
    .slice()
    .reverse()
    .map(
      (note) => `
        <div class="note-item">
          <div class="note-date">${escapeHtml(note.date)}</div>
          <div class="note-text">${escapeHtml(note.content).replace(/\n/g, "<br>")}</div>
        </div>
      `
    )
    .join("");

  content.innerHTML = `
    <div class="detail-header">
      <h3>${escapeHtml(person.name)}</h3>
      <p>전화번호: ${escapeHtml(person.phone || "-")}</p>
      <p>태그: ${(person.tags || []).map((tag) => `#${escapeHtml(tag)}`).join(" ") || "-"}</p>
      <p>생성일 ${escapeHtml(person.createdAt)}</p>
      <p>수정일 ${escapeHtml(person.updatedAt)}</p>
    </div>

    <hr>

    <div class="add-note-box">
      <h4>기록 추가</h4>
      <textarea id="newNoteText" placeholder="새로운 기록을 입력하세요"></textarea>
      <button type="button" id="addNoteButton">추가</button>
    </div>

    <hr>

    <div class="notes-section">
      <h4>기록 내역</h4>
      ${notesHtml || "<p class='empty'>기록이 없습니다.</p>"}
    </div>
  `;

  content.querySelector("#addNoteButton")?.addEventListener("click", addNote);
  panel.hidden = false;
}

function addNote() {
  if (!selectedPersonId) return;

  const textarea = document.getElementById("newNoteText");
  if (!textarea) return;

  const text = textarea.value.trim();
  if (!text) {
    alert("추가할 내용을 입력하세요.");
    return;
  }

  const person = people.find((item) => item.id === selectedPersonId);
  if (!person) return;

  if (!Array.isArray(person.notes)) {
    person.notes = [];
  }

  const now = formatNow();
  person.notes.push({ date: now, content: text });
  person.updatedAt = now;

  savePeople();
  renderList();
  showDetail(selectedPersonId);
}

function deletePerson(personId) {
  const person = people.find((item) => item.id === personId);
  if (!person) return;

  const ok = confirm(`${person.name} 카드를 삭제할까요?`);
  if (!ok) return;

  people = people.filter((item) => item.id !== personId);
  savePeople();
  renderList();

  if (selectedPersonId === personId) {
    hideDetail();
  }
}

function bindForm() {
  const form = document.getElementById("personForm");
  if (!form) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = document.getElementById("name")?.value.trim() || "";
    const phone = document.getElementById("phone")?.value.trim() || "";
    const tagsRaw = document.getElementById("tags")?.value.trim() || "";
    const firstNote = document.getElementById("firstNote")?.value.trim() || "";

    if (!name) {
      alert("이름은 필수입니다.");
      return;
    }

    const now = formatNow();
    const person = {
      id: String(Date.now()),
      name,
      phone,
      tags: tagsRaw
        ? tagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean)
        : [],
      notes: firstNote ? [{ date: now, content: firstNote }] : [],
      createdAt: now,
      updatedAt: now
    };

    people.push(person);
    savePeople();
    renderList();
    this.reset();
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
  bindForm();
  renderList();
  registerServiceWorker();
}

init();
