/* =========================================================
   CONFIGURAÇÃO
   ========================================================= */
const API_URL = "/api/clima/atual"; // rota do Flask (mesma origem → sem problemas de CORS)
const REFRESH_MS = 3000;            // atualização automática a cada 3 segundos
const TIMEOUT_MS = 2500;            // se o servidor não responder a tempo, conta como erro

// Faixas consideradas "estáveis" no relatório (limites inclusivos)
// "tags" = texto do selo em cada cartão: abaixo da faixa / dentro / acima
const LIMITS = {
  temp: { min: 15, max: 30, unit: "°C", name: "Temperatura", tags: { low: "Frio", ok: "Confortável", high: "Quente" } },
  hum:  { min: 40, max: 70, unit: "%",  name: "Umidade",     tags: { low: "Seco", ok: "Confortável", high: "Úmido" } },
};

// Referências ao DOM
const $ = (id) => document.getElementById(id);
const el = {
  tempValue: $("tempValue"), humValue: $("humValue"),
  tempBar: $("tempBar"),     humBar: $("humBar"),
  tempCard: $("tempValue").closest(".card"), humCard: $("humValue").closest(".card"),
  tempBadge: $("tempBadge"), humBadge: $("humBadge"),
  tempHint: $("tempHint"),   humHint: $("humHint"),
  lastUpdate: $("lastUpdate"), lastDate: $("lastDate"),
  status: $("status"), statusText: $("statusText"),
  syncBtn: $("syncBtn"), syncLabel: $("syncLabel"),
  reportBtn: $("reportBtn"),
  errorBox: $("errorBox"),
  // Modal do relatório
  modalOverlay: $("reportModal"),
  modal: document.querySelector("#reportModal .modal"),
  reportIcon: $("reportIcon"), reportTitle: $("reportTitle"), reportSub: $("reportSub"),
  reportList: $("reportList"), reportTime: $("reportTime"), reportClose: $("reportClose"),
};

// Guarda o último valor mostrado, para animar de X para Y (em vez de saltar)
const shown = { temperatura: null, umidade: null };

/* =========================================================
   ANIMAÇÃO DOS NÚMEROS
   Em vez de trocar o texto de repente, interpola do valor
   antigo para o novo durante ~700ms (easing "ease-out cubic").
   ========================================================= */
function animateNumber(container, key, newValue) {
  const numEl = container.querySelector(".num");
  const from = shown[key] ?? newValue;   // 1ª vez: sem animação
  const start = performance.now();
  const duration = 700;

  // Dispara o "flash" só se o valor realmente mudou
  if (from !== newValue) {
    container.classList.remove("flash");
    void container.offsetWidth;          // força reflow para reiniciar a animação CSS
    container.classList.add("flash");
  }

  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);                 // ease-out cubic
    numEl.textContent = (from + (newValue - from) * eased).toFixed(1);
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  shown[key] = newValue;
}

// Converte um valor numa porcentagem (0–100) dentro de [min, max] para a barra
const toPercent = (v, min, max) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));

/* =========================================================
   ESTADO DE CADA CARTÃO (selo + borda de alerta)
   Compara o valor com a faixa em LIMITS (a mesma usada pelo
   relatório): atualiza o texto/cor do selo e liga a classe
   .out no cartão quando o valor está fora da faixa.
   ========================================================= */
function applyState(kind, card, badge, value) {
  const verdict = evaluate(value, LIMITS[kind]);          // "ok" | "low" | "high"
  badge.querySelector(".b-text").textContent = LIMITS[kind].tags[verdict];
  badge.classList.remove("idle", "good", "bad");
  badge.classList.add(verdict === "ok" ? "good" : "bad");
  card.classList.toggle("out", verdict !== "ok");
}

// Texto "ideal: 15–30°C" sob cada número, gerado a partir de LIMITS (uma única fonte de verdade)
for (const [kind, hint] of [["temp", el.tempHint], ["hum", el.humHint]]) {
  const { min, max, unit } = LIMITS[kind];
  hint.textContent = `ideal: ${min}–${max}${unit}`;
}

/* =========================================================
   ATUALIZAR A TELA COM OS DADOS RECEBIDOS
   ========================================================= */
function render({ temperatura, umidade }) {
  animateNumber(el.tempValue, "temperatura", Number(temperatura));
  animateNumber(el.humValue,  "umidade",     Number(umidade));

  applyState("temp", el.tempCard, el.tempBadge, Number(temperatura));
  applyState("hum",  el.humCard,  el.humBadge,  Number(umidade));

  el.tempBar.style.width = toPercent(temperatura, -10, 50) + "%"; // escala do DHT22: -40..80, aqui -10..50 (uso comum)
  el.humBar.style.width  = toPercent(umidade, 0, 100) + "%";

  // Hora exata da última atualização bem-sucedida (hora local do navegador)
  const now = new Date();
  el.lastUpdate.textContent = now.toLocaleTimeString("pt-BR", { hour12: false });
  el.lastDate.textContent   = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function setStatus(online, text) {
  el.status.classList.toggle("online", online);
  el.status.classList.toggle("offline", !online);
  el.statusText.textContent = text;
}

/* =========================================================
   BUSCAR DADOS AO SERVIDOR (fetch GET)
   - AbortController: cancela o pedido se demorar demais
   - cache: "no-store": garante dados frescos, nunca do cache
   - "inFlight": evita requisições sobrepostas (ex.: clicar no botão
     quando o temporizador automático acabou de disparar)
   ========================================================= */
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

    const data = await res.json();            // {"temperatura": 25.5, "umidade": 60.0}
    if (typeof data.temperatura !== "number" || typeof data.umidade !== "number") {
      throw new Error("JSON em formato inesperado");
    }

    render(data);
    setStatus(true, "Online");
    el.errorBox.classList.remove("show");
    return true;
  } catch (err) {
    const msg = err.name === "AbortError" ? "Tempo de resposta esgotado" : err.message;
    setStatus(false, "Sem conexão");
    el.errorBox.textContent = `Não foi possível obter dados (${msg}). Tentando novamente…`;
    el.errorBox.classList.add("show");
    return false;
  } finally {
    clearTimeout(timer);
    inFlight = false;
  }
}

/* =========================================================
   RIPPLE (efeito de clique) — reutilizado pelos dois botões
   Cria um círculo posicionado onde o usuário clicou.
   ========================================================= */
function addRipple(btn, e) {
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const r = document.createElement("span");
  r.className = "ripple";
  r.style.width = r.style.height = size + "px";
  r.style.left = e.clientX - rect.left - size / 2 + "px";
  r.style.top  = e.clientY - rect.top  - size / 2 + "px";
  btn.appendChild(r);
  r.addEventListener("animationend", () => r.remove());
}

/* =========================================================
   BOTÃO "SINCRONIZAR DADOS"
   Ripple no ponto do clique + ícone girando + texto de estado.
   ========================================================= */
el.syncBtn.addEventListener("click", async (e) => {
  addRipple(el.syncBtn, e);

  // Estado "carregando"
  el.syncBtn.disabled = true;
  el.syncBtn.classList.add("loading");
  el.syncLabel.textContent = "Sincronizando…";

  const started = Date.now();
  const ok = await fetchClima();

  // Garante pelo menos 600ms de animação, para o feedback ser visível mesmo com servidor rápido
  const wait = Math.max(0, 600 - (Date.now() - started));
  await new Promise((r) => setTimeout(r, wait));

  el.syncBtn.classList.remove("loading");
  el.syncLabel.textContent = ok ? "Sincronizado ✓" : "Falhou ✕";
  setTimeout(() => {
    el.syncLabel.textContent = "Sincronizar Dados";
    el.syncBtn.disabled = false;
  }, 1200);
});

/* =========================================================
   RELATÓRIO DE CLIMA
   1) Lê os números que estão NA TELA (texto dos cartões).
   2) Compara cada um com a sua faixa em LIMITS.
   3) Mostra o modal em verde (Estável) ou vermelho (Anomalia).
   ========================================================= */

// Ícones SVG do modal (check = ok, triângulo = alerta)
const ICON_OK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
const ICON_ALERT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;

// Lê o número exibido num cartão. Devolve NaN se ainda estiver em "--.-"
const readDisplayed = (container) => parseFloat(container.querySelector(".num").textContent);

// Avalia um valor contra a faixa: "ok", "low" (abaixo) ou "high" (acima)
function evaluate(value, { min, max }) {
  if (value < min) return "low";
  if (value > max) return "high";
  return "ok";
}

// Cria uma linha <li> do relatório para uma grandeza
function buildRow(kind, value, verdict) {
  const { min, max, unit, name } = LIMITS[kind];
  const labels = { ok: "Dentro da faixa", low: "Abaixo do limite", high: "Acima do limite" };

  const li = document.createElement("li");
  li.dataset.kind = kind;
  li.innerHTML = `
    <div>
      <div class="r-name"></div>
      <div class="r-value"></div>
      <div class="r-range"></div>
    </div>
    <span class="r-chip ${verdict === "ok" ? "good" : "bad"}"></span>`;
  // textContent (em vez de innerHTML) para os textos dinâmicos
  li.querySelector(".r-name").textContent  = name;
  li.querySelector(".r-value").textContent = value.toFixed(1) + unit;
  li.querySelector(".r-range").textContent = `ideal: ${min}${unit} – ${max}${unit}`;
  li.querySelector(".r-chip").textContent  = labels[verdict];
  return li;
}

function openReport() {
  const temp = readDisplayed(el.tempValue);
  const hum  = readDisplayed(el.humValue);

  el.reportList.innerHTML = "";

  // Sem dados ainda (servidor não respondeu desde que a página abriu)
  if (Number.isNaN(temp) || Number.isNaN(hum)) {
    el.modal.classList.add("alert");
    el.reportIcon.innerHTML = ICON_ALERT;
    el.reportTitle.textContent = "Sem dados";
    el.reportSub.textContent = "Ainda não há leituras na tela. Clique em “Sincronizar Dados” e tente novamente.";
    el.reportTime.textContent = "";
  } else {
    const tVerdict = evaluate(temp, LIMITS.temp);
    const hVerdict = evaluate(hum,  LIMITS.hum);
    const stable = tVerdict === "ok" && hVerdict === "ok";

    // Alterna o tema do modal: verde (estável) ou vermelho (anomalia)
    el.modal.classList.toggle("alert", !stable);
    el.reportIcon.innerHTML = stable ? ICON_OK : ICON_ALERT;
    el.reportTitle.textContent = stable ? "Clima Estável / Em Ordem" : "Alerta / Anomalia";
    el.reportSub.textContent = stable
      ? "Temperatura e umidade estão dentro dos padrões esperados."
      : "Uma ou mais leituras estão fora dos padrões esperados. Verifique o ambiente.";

    el.reportList.append(buildRow("temp", temp, tVerdict), buildRow("hum", hum, hVerdict));
    el.reportTime.textContent = "Gerado em " + new Date().toLocaleString("pt-BR", { hour12: false });
  }

  el.modalOverlay.classList.add("open");
  el.modalOverlay.setAttribute("aria-hidden", "false");
  el.reportClose.focus();
}

function closeReport() {
  el.modalOverlay.classList.remove("open");
  el.modalOverlay.setAttribute("aria-hidden", "true");
  el.reportBtn.focus();
}

el.reportBtn.addEventListener("click", (e) => {
  addRipple(el.reportBtn, e);
  openReport();
});
el.reportClose.addEventListener("click", closeReport);
// Fechar clicando no fundo escurecido (mas não dentro do modal)
el.modalOverlay.addEventListener("click", (e) => {
  if (e.target === el.modalOverlay) closeReport();
});
// Fechar com a tecla ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && el.modalOverlay.classList.contains("open")) closeReport();
});

/* =========================================================
   EFEITO "HOLOFOTE" NOS CARTÕES
   Atualiza --mx / --my (variáveis CSS) com a posição do mouse
   relativa ao cartão. O CSS usa-as no radial-gradient.
   ========================================================= */
document.querySelectorAll(".card").forEach((card) => {
  card.addEventListener("mousemove", (e) => {
    const b = card.getBoundingClientRect();
    card.style.setProperty("--mx", e.clientX - b.left + "px");
    card.style.setProperty("--my", e.clientY - b.top + "px");
  });
});

/* =========================================================
   INICIALIZAÇÃO + ATUALIZAÇÃO AUTOMÁTICA
   Primeira leitura imediata; depois, a cada 3 segundos.
   (Se a aba estiver oculta, poupamos requisições.)
   ========================================================= */
fetchClima();
setInterval(() => {
  if (!document.hidden) fetchClima();
}, REFRESH_MS);

// Ao voltar à aba, atualiza logo (sem esperar o próximo ciclo)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) fetchClima();
});