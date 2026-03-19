const STORAGE_KEY = "personal_cards";

function getCards() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveCards(cards) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

function formatDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

function renderList() {
  const app = document.getElementById("app");
  const cards = getCards();

  if (cards.length === 0) {
    app.innerHTML = `
      <div class="empty">
        <p>등록된 사람이 없습니다.</p>
        <button onclick="addCard()">첫 사람 추가</button>
      </div>
    `;
    return;
  }

  app.innerHTML = `
    <div class="card-list">
      ${cards.map((card, index) => `
        <div class="person-card">
          <div class="person-main">
            <div class="person-name">${escapeHtml(card.name || "")}</div>
            <div class="person-phone">${escapeHtml(card.phone || "")}</div>
            <div class="person-memo">${escapeHtml(card.memo || "")}</div>
          </div>
          <div class="person-actions">
            <button onclick="viewCard(${index})">보기</button>
            <button onclick="editCard(${index})">수정</button>
            <button class="danger" onclick="deleteCard(${index})">삭제</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function viewCard(index) {
  const cards = getCards();
  const card = cards[index];
  if (!card) return;

  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="detail-card">
      <h2>${escapeHtml(card.name || "")}</h2>
      <div class="detail-row"><span>전화</span><strong>${escapeHtml(card.phone || "")}</strong></div>
      <div class="detail-row"><span>메모</span><strong>${escapeHtml(card.memo || "")}</strong></div>
      <div class="detail-row"><span>수정일</span><strong>${formatDate(card.updated_at)}</strong></div>

      <div class="detail-actions">
        <button onclick="renderList()">목록</button>
        <button onclick="editCard(${index})">수정</button>
      </div>
    </div>
  `;
}

function addCard() {
  const name = prompt("이름을 입력하세요");
  if (name === null || name.trim() === "") return;

  const phone = prompt("전화번호를 입력하세요", "") ?? "";
  const memo = prompt("메모를 입력하세요", "") ?? "";

  const cards = getCards();
  cards.push({
    id: Date.now(),
    name: name.trim(),
    phone: phone.trim(),
    memo: memo.trim(),
    updated_at: new Date().toISOString()
  });

  saveCards(cards);
  renderList();
}

function editCard(index) {
  const cards = getCards();
  const card = cards[index];
  if (!card) return;

  const name = prompt("이름", card.name);
  if (name === null || name.trim() === "") return;

  const phone = prompt("전화", card.phone ?? "");
  if (phone === null) return;

  const memo = prompt("메모", card.memo ?? "");
  if (memo === null) return;

  cards[index] = {
    ...card,
    name: name.trim(),
    phone: phone.trim(),
    memo: memo.trim(),
    updated_at: new Date().toISOString()
  };

  saveCards(cards);
  viewCard(index);
}

function deleteCard(index) {
  const cards = getCards();
  const card = cards[index];
  if (!card) return;

  const ok = confirm(`${card.name} 카드를 삭제하시겠습니까?`);
  if (!ok) return;

  cards.splice(index, 1);
  saveCards(cards);
  renderList();
}

function saveBackup() {
  const cards = getCards();
  const blob = new Blob([JSON.stringify(cards, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "personal_cards_backup.json";
  a.click();

  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

renderList();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./service-worker.js");
      console.log("Service Worker 등록 성공");
    } catch (err) {
      console.error("Service Worker 등록 실패:", err);
    }
  });
}