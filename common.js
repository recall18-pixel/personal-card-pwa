const SW_VERSION = "2026-04-08-v2";

function registerSharedServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(`./service-worker.js?v=${SW_VERSION}`);
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

registerSharedServiceWorker();


// ── PIN 잠금 ──────────────────────────────────────────────────
const PIN_STORAGE_KEY = "app_pin_v1";

async function _hashPin(pin) {
  const data = new TextEncoder().encode("personal-cards-salt:" + pin);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function _getStoredPinHash() {
  return localStorage.getItem(PIN_STORAGE_KEY);
}

async function _verifyPin(pin) {
  const stored = _getStoredPinHash();
  if (!stored) return true;
  return (await _hashPin(pin)) === stored;
}

async function _setPin(pin) {
  localStorage.setItem(PIN_STORAGE_KEY, await _hashPin(pin));
}

function _removePin() {
  localStorage.removeItem(PIN_STORAGE_KEY);
}

function _createPinOverlay(title, onSubmit, onCancel) {
  const overlay = document.createElement("div");
  overlay.className = "pin-overlay";
  overlay.innerHTML = `
    <div class="pin-card">
      <p class="pin-title">${title}</p>
      <div class="pin-dots">
        <span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span>
      </div>
      <p class="pin-error" id="_pinError"></p>
      <div class="pin-grid">
        <button type="button" class="pin-key" data-key="1">1</button>
        <button type="button" class="pin-key" data-key="2">2</button>
        <button type="button" class="pin-key" data-key="3">3</button>
        <button type="button" class="pin-key" data-key="4">4</button>
        <button type="button" class="pin-key" data-key="5">5</button>
        <button type="button" class="pin-key" data-key="6">6</button>
        <button type="button" class="pin-key" data-key="7">7</button>
        <button type="button" class="pin-key" data-key="8">8</button>
        <button type="button" class="pin-key" data-key="9">9</button>
        <span></span>
        <button type="button" class="pin-key" data-key="0">0</button>
        <button type="button" class="pin-key pin-key-del" data-key="del">⌫</button>
      </div>
      ${onCancel ? '<button type="button" class="pin-cancel" id="_pinCancel">취소</button>' : ""}
    </div>
  `;

  let entered = "";
  const dots = overlay.querySelectorAll(".pin-dot");
  const errorEl = overlay.querySelector("#_pinError");

  function updateDots() {
    dots.forEach((dot, i) => dot.classList.toggle("filled", i < entered.length));
  }

  function shake() {
    const dotsEl = overlay.querySelector(".pin-dots");
    dotsEl.classList.add("pin-shake");
    setTimeout(() => dotsEl.classList.remove("pin-shake"), 480);
  }

  overlay.querySelectorAll(".pin-key").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.key;
      if (key === "del") {
        entered = entered.slice(0, -1);
        errorEl.textContent = "";
      } else if (entered.length < 4) {
        entered += key;
      }
      updateDots();

      if (entered.length === 4) {
        overlay.querySelectorAll(".pin-key").forEach((b) => (b.disabled = true));
        const result = await onSubmit(entered);
        overlay.querySelectorAll(".pin-key").forEach((b) => (b.disabled = false));

        if (result === true) {
          overlay.classList.add("pin-unlocked");
          setTimeout(() => overlay.remove(), 280);
        } else {
          errorEl.textContent =
            typeof result === "string" ? result : "PIN이 올바르지 않습니다.";
          entered = "";
          updateDots();
          shake();
        }
      }
    });
  });

  overlay.querySelector("#_pinCancel")?.addEventListener("click", () => {
    overlay.remove();
    if (onCancel) onCancel();
  });

  return overlay;
}

window.pinLock = {
  setPin: _setPin,
  removePin: _removePin,
  getStoredPinHash: _getStoredPinHash,
  verifyPin: _verifyPin,
  createPinOverlay: _createPinOverlay,
};

function _initPinLock() {
  if (!_getStoredPinHash()) return;
  const overlay = _createPinOverlay(
    "잠금 해제",
    async (pin) => {
      if (await _verifyPin(pin)) return true;
      return false;
    },
    null
  );
  document.body.appendChild(overlay);
}

document.addEventListener("DOMContentLoaded", _initPinLock);
