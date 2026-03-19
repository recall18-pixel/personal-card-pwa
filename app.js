const STORAGE_KEY = "personal_cards_v2";

let people = loadPeople();
let selectedPersonId = null;

// =========================
// 데이터 로드 / 저장
// =========================
function loadPeople() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);

    // 구버전 memo -> notes 변환
    return parsed.map((person) => {
      if (!Array.isArray(person.notes)) {
        person.notes = [];
      }

      if (person.memo && String(person.memo).trim()) {
        person.notes.push({
          date: formatNow(),
          content: person.memo
        });
        delete person.memo;
      }

      if (!person.createdAt) person.createdAt = formatNow();
      if (!person.updatedAt) person.updatedAt = formatNow();

      return person;
    });
  } catch (e) {
    console.error("저장 데이터 로드 실패:", e);
    return [];
  }
}
function exportData() {
  try {
    const dataStr = JSON.stringify(people, null, 2);

    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const now = new Date();

    const filename = `personal_cards_backup_${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.json`;

    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);

    alert("백업 파일이 다운로드되었습니다.");
  } catch (e) {
    console.error(e);
    alert("백업 실패");
  }
}
function normalizeImportedPeople(imported) {
  return imported
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const now = formatNow();

      return {
        id: String(item.id || Date.now() + Math.random()),
        name: String(item.name || "").trim(),
        phone: String(item.phone || "").trim(),
        tags: Array.isArray(item.tags)
          ? item.tags.map((t) => String(t).trim()).filter(Boolean)
          : [],
        notes: Array.isArray(item.notes)
          ? item.notes
              .filter((n) => n && typeof n === "object")
              .map((n) => ({
                date: String(n.date || now),
                content: String(n.content || "").trim()
              }))
              .filter((n) => n.content)
          : [],
        createdAt: String(item.createdAt || now),
        updatedAt: String(item.updatedAt || now)
      };
    })
    .filter((item) => item.name);
}

function bindImportFile() {
  const input = document.getElementById("importFile");
  if (!input) return;

  input.addEventListener("change", function (e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (event) {
      try {
        const text = event.target?.result;
        const parsed = JSON.parse(text);

        if (!Array.isArray(parsed)) {
          alert("잘못된 JSON 형식입니다. 배열 형태의 백업 파일이어야 합니다.");
          return;
        }

        const importedPeople = normalizeImportedPeople(parsed);

        if (importedPeople.length === 0) {
          alert("불러올 데이터가 없습니다.");
          return;
        }

        const merge = confirm(
          `가져온 데이터 ${importedPeople.length}건을 불러옵니다.\n\n확인 = 기존 데이터와 병합\n취소 = 기존 데이터를 지우고 새 데이터로 덮어쓰기`
        );

        if (merge) {
          const existingIds = new Set(people.map((p) => String(p.id)));

          importedPeople.forEach((item) => {
            let newItem = { ...item };

            if (existingIds.has(String(newItem.id))) {
              newItem.id = String(Date.now() + Math.random());
            }

            people.push(newItem);
            existingIds.add(String(newItem.id));
          });
        } else {
          people = importedPeople;
        }

        savePeople();
        renderList();

        const panel = document.getElementById("detailPanel");
        const content = document.getElementById("detailContent");
        if (panel) panel.style.display = "none";
        if (content) content.innerHTML = "";
        selectedPersonId = null;

        alert("데이터 불러오기가 완료되었습니다.");
      } catch (err) {
        console.error("import 오류:", err);
        alert("JSON 파일을 읽는 중 오류가 발생했습니다.");
      } finally {
        input.value = "";
      }
    };

    reader.onerror = function () {
      alert("파일을 읽지 못했습니다.");
      input.value = "";
    };

    reader.readAsText(file, "utf-8");
  });
}
function savePeople() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
}

// =========================
// 공통 유틸
// =========================
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

// =========================
// 목록 렌더링
// =========================
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
      card.innerHTML = `
        <div class="person-card-main">
          <strong>${escapeHtml(person.name)}</strong>
          <div class="sub">${escapeHtml(person.phone || "")}</div>
          <div class="tags">
            ${(person.tags || [])
              .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
              .join("")}
          </div>
          <div class="sub">기록 ${person.notes?.length || 0}개</div>
          <div class="sub">수정일: ${escapeHtml(person.updatedAt)}</div>
        </div>
        <div class="person-card-actions">
          <button type="button" onclick="showDetail('${person.id}')">보기</button>
          <button type="button" onclick="deletePerson('${person.id}')">삭제</button>
        </div>
      `;
      listEl.appendChild(card);
    });
}

// =========================
// 상세 보기
// =========================
function showDetail(personId) {
  selectedPersonId = personId;
  const person = people.find((p) => p.id === personId);
  if (!person) return;

  const panel = document.getElementById("detailPanel");
  const content = document.getElementById("detailContent");
  if (!panel || !content) return;

  const notesHtml = (person.notes || [])
    .slice()
    .reverse()
    .map((note) => {
      return `
        <div class="note-item">
          <div class="note-date">${escapeHtml(note.date)}</div>
          <div class="note-text">${escapeHtml(note.content).replace(/\n/g, "<br>")}</div>
        </div>
      `;
    })
    .join("");

  content.innerHTML = `
    <div class="detail-header">
      <h3>${escapeHtml(person.name)}</h3>
      <p>전화번호: ${escapeHtml(person.phone || "-")}</p>
      <p>태그: ${(person.tags || []).map((t) => `#${escapeHtml(t)}`).join(" ") || "-"}</p>
      <p>생성일: ${escapeHtml(person.createdAt)}</p>
      <p>수정일: ${escapeHtml(person.updatedAt)}</p>
    </div>

    <hr>

    <div class="add-note-box">
      <h4>내용 추가</h4>
      <textarea id="newNoteText" placeholder="새로운 기록을 입력하세요"></textarea>
      <button type="button" onclick="addNote()">추가</button>
    </div>

    <hr>

    <div class="notes-section">
      <h4>기록 내역</h4>
      ${notesHtml || "<p class='empty'>기록이 없습니다.</p>"}
    </div>
  `;

  panel.style.display = "block";
}

// =========================
// 기록 추가
// =========================
function addNote() {
  if (!selectedPersonId) return;

  const textarea = document.getElementById("newNoteText");
  if (!textarea) return;

  const text = textarea.value.trim();
  if (!text) {
    alert("추가할 내용을 입력하세요.");
    return;
  }

  const person = people.find((p) => p.id === selectedPersonId);
  if (!person) return;

  if (!Array.isArray(person.notes)) {
    person.notes = [];
  }

  person.notes.push({
    date: formatNow(),
    content: text
  });

  person.updatedAt = formatNow();

  savePeople();
  renderList();
  showDetail(selectedPersonId);
}

// =========================
// 사람 삭제
// =========================
function deletePerson(personId) {
  const person = people.find((p) => p.id === personId);
  if (!person) return;

  const ok = confirm(`${person.name} 카드를 삭제할까요?`);
  if (!ok) return;

  people = people.filter((p) => p.id !== personId);
  savePeople();
  renderList();

  if (selectedPersonId === personId) {
    selectedPersonId = null;

    const panel = document.getElementById("detailPanel");
    const content = document.getElementById("detailContent");

    if (panel) panel.style.display = "none";
    if (content) content.innerHTML = "";
  }
}

// =========================
// 사람 등록
// =========================
function bindForm() {
  const form = document.getElementById("personForm");
  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const name = document.getElementById("name")?.value.trim() || "";
    const phone = document.getElementById("phone")?.value.trim() || "";
    const tagsRaw = document.getElementById("tags")?.value.trim() || "";
    const firstNote = document.getElementById("firstNote")?.value.trim() || "";

    if (!name) {
      alert("이름은 필수입니다.");
      return;
    }

    const tags = tagsRaw
      ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    const now = formatNow();

    const person = {
      id: String(Date.now()),
      name,
      phone,
      tags,
      notes: [],
      createdAt: now,
      updatedAt: now
    };

    if (firstNote) {
      person.notes.push({
        date: now,
        content: firstNote
      });
    }

    people.push(person);
    savePeople();
    renderList();

    this.reset();
    showDetail(person.id);
  });
}

// =========================
// 서비스워커 등록
// =========================
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js");
      console.log("Service Worker 등록 성공:", registration.scope);

      // 페이지 로드 시 새 버전 체크
      registration.update();

      // 새 서비스워커 감지
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            console.log("새 버전 서비스워커가 설치되었습니다.");
          }
        });
      });
    } catch (error) {
      console.error("Service Worker 등록 실패:", error);
    }
  });

  // 새 서비스워커가 현재 페이지를 제어하면 자동 새로고침
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

// =========================
// 초기 실행
// =========================
function init() {
  bindForm();
  bindImportFile();
  renderList();
  registerServiceWorker();
}

init();