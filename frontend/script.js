const API_URL = "/api/clima/atual"; 
const REFRESH_MS = 3000;            
const TIMEOUT_MS = 2500;            

const $ = (id) => document.getElementById(id);
const el = {
  tempValue: $("tempValue"), humValue: $("humValue"),
  tempBar: $("tempBar"),     humBar: $("humBar"),
  lastUpdate: $("lastUpdate"), lastDate: $("lastDate"),
  status: $("status"), statusText: $("statusText"),
  syncBtn: $("syncBtn"), syncLabel: $("syncLabel"),
  errorBox: $("errorBox"),
};

const shown = { temperatura: null, umidade: null };

function animateNumber(container, key, newValue) {
  const numEl = container.querySelector(".num");
  const from = shown[key] ?? newValue;   
  const start = performance.now();
  const duration = 700;

  if (from !== newValue) {
    container.classList.remove("flash");
    void container.offsetWidth;          
    container.classList.add("flash");
  }

  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);                 
    numEl.textContent = (from + (newValue - from) * eased).toFixed(1);
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  shown[key] = newValue;
}

const toPercent = (v, min, max) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));

function render({ temperatura, umidade }) {
  animateNumber(el.tempValue, "temperatura", Number(temperatura));
  animateNumber(el.humValue,  "umidade",     Number(umidade));

  el.tempBar.style.width = toPercent(temperatura, -10, 50) + "%"; 
  el.humBar.style.width  = toPercent(umidade, 0, 100) + "%";

  const now = new Date();
  el.lastUpdate.textContent = now.toLocaleTimeString("pt-PT", { hour12: false });
  el.lastDate.textContent   = now.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

function setStatus(online, text) {
  el.status.classList.toggle("online", online);
  el.status.classList.toggle("offline", !online);
  el.statusText.textContent = text;
}

let inFlight = false;

async function fetchClima() {
  if (inFlight) return false;
  inFlight = true;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(API_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Servidor respondeu ${res.status}`);

    const data = await res.json();             
    if (typeof data.temperatura !== "number" || typeof data.umidade !== "number") {
      throw new Error("JSON em formato inesperado");
    }

    render(data);
    setStatus(true, "Online");
    el.errorBox.classList.remove("show");
    return true;
  } catch (err) {
    const msg = err.name === "AbortError" ? "Tempo de resposta esgotado" : err.message;
    setStatus(false, "Sem ligação");
    el.errorBox.textContent = `Não foi possível obter dados (${msg}). A tentar novamente…`;
    el.errorBox.classList.add("show");
    return false;
  } finally {
    clearTimeout(timer);
    inFlight = false;
  }
}

el.syncBtn.addEventListener("click", async (e) => {
  const rect = el.syncBtn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const r = document.createElement("span");
  r.className = "ripple";
  r.style.width = r.style.height = size + "px";
  r.style.left = e.clientX - rect.left - size / 2 + "px";
  r.style.top  = e.clientY - rect.top  - size / 2 + "px";
  el.syncBtn.appendChild(r);
  r.addEventListener("animationend", () => r.remove());

  el.syncBtn.disabled = true;
  el.syncBtn.classList.add("loading");
  el.syncLabel.textContent = "A sincronizar…";

  const started = Date.now();
  const ok = await fetchClima();

  const wait = Math.max(0, 600 - (Date.now() - started));
  await new Promise((r) => setTimeout(r, wait));

  el.syncBtn.classList.remove("loading");
  el.syncLabel.textContent = ok ? "Sincronizado ✓" : "Falhou ✕";
  setTimeout(() => {
    el.syncLabel.textContent = "Sincronizar Dados";
    el.syncBtn.disabled = false;
  }, 1200);
});

document.querySelectorAll(".card").forEach((card) => {
  card.addEventListener("mousemove", (e) => {
    const b = card.getBoundingClientRect();
    card.style.setProperty("--mx", e.clientX - b.left + "px");
    card.style.setProperty("--my", e.clientY - b.top + "px");
  });
});

fetchClima();
setInterval(() => {
  if (!document.hidden) fetchClima();
}, REFRESH_MS);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) fetchClima();
});