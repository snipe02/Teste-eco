import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, set, get, remove, update } from "firebase/database";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

// ========== CONFIGURAÇÃO DO FIREBASE ==========
const firebaseConfig = {
  apiKey: "AIzaSyBSufzO0XqpLJ042F0Uwx4XYOwQ42-YHAo",
  authDomain: "inscr-d8712.firebaseapp.com",
  databaseURL: "https://inscr-d8712-default-rtdb.firebaseio.com",
  projectId: "inscr-d8712",
  storageBucket: "inscr-d8712.firebasestorage.app",
  messagingSenderId: "776446988108",
  appId: "1:776446988108:web:ea8a03286d587abc8bc9e9"
};

// ========== CONSTANTES GLOBAIS ==========
const WHATS_ADMIN = "5586995300632";
const LIMITE_MEDALHA = 350;
let db, auth, adminLogado = false;

// ========== INICIALIZAÇÃO ==========
try {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  auth = getAuth(app);
} catch (e) {
  console.error(e);
  alert("Erro ao conectar ao banco.");
}

// ========== FUNÇÕES AUXILIARES ==========
function toast(msg, bg = "#1e4a2f") {
  const d = document.createElement("div");
  d.className = "toast-custom";
  d.style.backgroundColor = bg;
  d.innerHTML = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3500);
}

function esc(str) {
  if (str === undefined || str === null) return "";
  return String(str).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function whatsappValido(valor) {
  return (valor || "").replace(/\D/g, "").length >= 10;
}

function validarFormulario() {
  let valido = true;
  const campos = ["nome", "whatsapp", "cidade", "equipe", "idade", "genero"].map(id => document.getElementById(id));
  campos.forEach(c => c.classList.remove("erro"));

  const nome = document.getElementById("nome");
  const whatsapp = document.getElementById("whatsapp");
  const cidade = document.getElementById("cidade");
  const equipe = document.getElementById("equipe");
  const idade = document.getElementById("idade");
  const genero = document.getElementById("genero");

  if (!nome.value.trim()) { nome.classList.add("erro"); valido = false; }
  if (!whatsapp.value.trim() || !whatsappValido(whatsapp.value)) { whatsapp.classList.add("erro"); valido = false; }
  if (!cidade.value.trim()) { cidade.classList.add("erro"); valido = false; }
  if (!equipe.value.trim()) { equipe.classList.add("erro"); valido = false; }

  const idadeNum = parseInt(idade.value, 10);
  if (!idade.value.trim() || isNaN(idadeNum) || idadeNum < 1 || idadeNum > 120) {
    idade.classList.add("erro");
    valido = false;
  }

  if (!genero.value) { genero.classList.add("erro"); valido = false; }

  if (!valido) toast("❌ Preencha TODOS os campos obrigatórios!", "#c0392b");
  return valido;
}

function temMedalha(numeroInscricao) {
  return parseInt(numeroInscricao, 10) <= LIMITE_MEDALHA;
}

function irParaTab(tabId) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("ativo"));
  document.getElementById(`panel-${tabId}`)?.classList.add("ativo");

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.remove("active-inscricao", "active-confirmado", "active-admin");
  });
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`)?.classList.add(`active-${tabId}`);

  if (tabId === "admin" && adminLogado) carregarAdminUI();
}

async function obterTodasOrdenadas() {
  const snap = await get(ref(db, "inscricoes"));
  const todas = snap.val() || {};
  return Object.entries(todas)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => (a.dataCriacao || 0) - (b.dataCriacao || 0));
}

async function gerarNumeroInscricaoPorId(id, listaOrdenada = null) {
  const ordenadas = listaOrdenada || await obterTodasOrdenadas();
  const idx = ordenadas.findIndex(i => i.id === id);
  return idx !== -1 ? (idx + 1).toString().padStart(3, "0") : "000";
}

async function criarInscricaoGratuita(dados) {
  const newRef = push(ref(db, "inscricoes"));
  const now = Date.now();

  const registro = {
    nome: dados.nome.trim(),
    whatsapp: dados.whatsapp.trim(),
    cidade: dados.cidade.trim(),
    equipe: dados.equipe.trim(),
    idade: Number(dados.idade),
    genero: dados.genero,
    pago: true,
    pdfEnviado: false,
    dataCriacao: now,
    dataPagamento: now,
    codigoInterno: "ECO-" + newRef.key.slice(-6).toUpperCase()
  };

  await set(newRef, registro);
  return { id: newRef.key, ...registro };
}

async function togglePdfEnviado(id, estadoAtual) {
  const novoEstado = !estadoAtual;
  await update(ref(db, `inscricoes/${id}`), { pdfEnviado: novoEstado });
  return novoEstado;
}

async function marcarComoEnviado(id) {
  await update(ref(db, `inscricoes/${id}`), { pdfEnviado: true });
}

async function atualizarInscricao(id, nome, equipe, whatsapp) {
  await update(ref(db, `inscricoes/${id}`), {
    nome: nome.trim(),
    equipe: equipe.trim(),
    whatsapp: whatsapp.trim()
  });
}

function gerarLinkWhatsAppParticipante(reg, numero) {
  let fone = (reg.whatsapp || "").replace(/\D/g, "");
  if (fone.startsWith("0")) fone = fone.slice(1);
  if (!fone.startsWith("55") && fone.length <= 11) fone = "55" + fone;

  const equipeMsg = reg.equipe && reg.equipe.trim() !== "" ? reg.equipe : "Não informada";
  const medalhaMsg = temMedalha(numero) ? `\n🏅 *Parabéns! Você está entre os primeiros ${LIMITE_MEDALHA} inscritos e ganhará uma MEDALHA especial!*` : "";

  const msg = `✅ *ECOCICLISMO* — 14ª Edição\n\nOlá *${reg.nome}*!\n\nSua inscrição foi confirmada!${medalhaMsg}\n\n🎫 *Número:* #${numero}\n📍 *Cidade:* ${reg.cidade}\n🏷️ *Equipe:* ${equipeMsg}\n📅 *Data:* ${new Date(reg.dataCriacao).toLocaleDateString("pt-BR")}\n\n_Guarde esse número._`;

  return `https://wa.me/${fone}?text=${encodeURIComponent(msg)}`;
}

async function gerarPDFRapido(reg, numeroInscricao) {
  if (typeof window.jspdf === "undefined" || !window.jspdf.jsPDF) {
    toast("jsPDF não carregado.", "#c0392b");
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 15;
    const ganhaMedalha = temMedalha(numeroInscricao);

    // Cabeçalho verde
    doc.setFillColor(30, 74, 47);
    doc.rect(0, 0, pageWidth, 38, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("ECOCICLISMO", pageWidth / 2, 18, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Comprovante de Inscrição — 14ª Edição • Gratuito", pageWidth / 2, 30, { align: "center" });

    // Bloco número
    const boxY = 48;
    doc.setDrawColor(134, 239, 172);
    doc.setFillColor(240, 253, 244);
    doc.rect(marginX, boxY, pageWidth - marginX * 2, 32, "FD");
    doc.setFontSize(11);
    doc.setTextColor(21, 128, 61);
    doc.text("NÚMERO OFICIAL", pageWidth / 2, boxY + 8, { align: "center" });
    doc.setFontSize(36);
    doc.setFont("helvetica", "bold");
    doc.text(`#${numeroInscricao}`, pageWidth / 2, boxY + 27, { align: "center" });

    let afterMedalY = boxY + 42;
    if (ganhaMedalha) {
      const mY = boxY + 40;
      const mH = 52;
      const textX = marginX + 44;

      doc.setFillColor(255, 248, 195);
      doc.setDrawColor(212, 160, 23);
      doc.setLineWidth(1.5);
      doc.roundedRect(marginX, mY, pageWidth - marginX * 2, mH, 5, 5, "FD");
      doc.setLineWidth(0.5);

      const cx = marginX + 22;
      const medalTopY = mY + 8;

      doc.setFillColor(230, 57, 70);
      doc.triangle(cx - 7, medalTopY, cx, medalTopY + 10, cx - 7, medalTopY + 10, "F");
      doc.setFillColor(168, 0, 0);
      doc.triangle(cx + 7, medalTopY, cx, medalTopY + 10, cx + 7, medalTopY + 10, "F");
      doc.setFillColor(220, 50, 60);
      doc.rect(cx - 7, medalTopY, 14, 6, "F");
      doc.setFillColor(180, 130, 0);
      doc.circle(cx, medalTopY + 24, 11, "F");
      doc.setFillColor(212, 160, 23);
      doc.circle(cx, medalTopY + 24, 10, "F");
      doc.setFillColor(255, 220, 50);
      doc.circle(cx, medalTopY + 24, 8, "F");
      doc.setFillColor(255, 240, 100);
      doc.circle(cx, medalTopY + 24, 6.5, "F");

      const starX = cx, starY = medalTopY + 24;
      const outerR = 5, innerR = 2.2;
      const points = [];
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        points.push([starX + r * Math.cos(angle), starY + r * Math.sin(angle)]);
      }
      doc.setFillColor(180, 110, 0);
      doc.setDrawColor(180, 110, 0);
      doc.lines(
        points.slice(1).map((p, i) => [p[0] - points[i][0], p[1] - points[i][1]]),
        points[0][0], points[0][1],
        [1, 1], "F", true
      );

      doc.setFillColor(255, 255, 200);
      doc.setGState(doc.GState({ opacity: 0.5 }));
      doc.ellipse(cx - 2, medalTopY + 19, 3.5, 2, "F");
      doc.setGState(doc.GState({ opacity: 1 }));

      doc.setFillColor(212, 160, 23);
      doc.roundedRect(textX, mY + 5, pageWidth - marginX - textX - 4, 9, 2, 2, "F");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 30, 0);
      doc.text(`PRIMEIROS ${LIMITE_MEDALHA} INSCRITOS`, textX + (pageWidth - marginX - textX - 4) / 2, mY + 11.5, { align: "center" });

      doc.setFontSize(13.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 45, 0);
      doc.text("MEDALHA ESPECIAL", textX + 2, mY + 27);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(140, 70, 0);
      doc.text("GARANTIDA!", textX + 2, mY + 36);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 60, 0);
      doc.text("Retire no evento com este comprovante.", textX + 2, mY + 46);

      afterMedalY = mY + mH + 6;
    }

    const equipeExib = reg.equipe && reg.equipe.trim() !== "" ? reg.equipe : "Não informada";

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.setLineWidth(0.5);

    doc.autoTable({
      startY: afterMedalY,
      body: [
        ["Nome:", reg.nome],
        ["WhatsApp:", reg.whatsapp],
        ["Cidade:", reg.cidade],
        ["Equipe:", equipeExib],
        ["Idade:", reg.idade || "—"],
        ["Gênero:", reg.genero],
        ["Medalha:", ganhaMedalha ? `SIM — Primeiros ${LIMITE_MEDALHA} inscritos` : "Nao elegivel"],
        ["Status:", "CONFIRMADA"],
        ["Data:", new Date(reg.dataCriacao).toLocaleString("pt-BR")]
      ],
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: "bold", textColor: [30, 74, 47], cellWidth: 45 } },
      margin: { left: marginX, right: marginX }
    });

    const finalY = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Ecociclismo Oficial • Apresente este comprovante", pageWidth / 2, finalY, { align: "center" });

    doc.save(`ecociclismo_${reg.nome.replace(/\s/g, "_")}_${numeroInscricao}.pdf`);
    toast(`PDF gerado! Nº #${numeroInscricao}${ganhaMedalha ? " 🏅" : ""}`, "#2e7d32");
  } catch (e) {
    toast("Erro PDF: " + e.message, "#c0392b");
  }
}

async function enviarPdfEAbrirWhatsApp(reg, numero, btnEl) {
  try {
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    await gerarPDFRapido(reg, numero);
    window.open(gerarLinkWhatsAppParticipante(reg, numero), "_blank");
    await marcarComoEnviado(reg.id);
    if (btnEl) btnEl.disabled = false;
    carregarAdminUI();
    toast(`✅ Enviado para ${reg.nome}!`, "#15803d");
  } catch (err) {
    toast("Erro: " + err.message, "#c0392b");
    if (btnEl) btnEl.disabled = false;
  }
}

async function mostrarConfirmacao(registro) {
  const todasOrdenadas = await obterTodasOrdenadas();
  const numero = await gerarNumeroInscricaoPorId(registro.id, todasOrdenadas);
  const container = document.getElementById("confirmadoDinamico");
  const equipeExib = registro.equipe && registro.equipe.trim() !== "" ? registro.equipe : "Não informada";
  const ganhaMedalha = temMedalha(numero);

  const msgWhats = `✅ *ECOCICLISMO* - Inscrição confirmada!\n\nOlá ${registro.nome}, inscrição realizada.\n🎫 Número: #${numero}\n🏷️ Equipe: ${equipeExib}${ganhaMedalha ? `\n🏅 Parabéns! Você ganhará uma MEDALHA especial (primeiros ${LIMITE_MEDALHA} inscritos)!` : ""}`;
  const linkWhats = `https://wa.me/${WHATS_ADMIN}?text=${encodeURIComponent(msgWhats)}`;

  const medalhaHTML = ganhaMedalha ? `
    <div class="medalha-container">
      <span class="medalha-icone">🏅</span>
      <div class="medalha-titulo">Você ganhou uma medalha!</div>
      <div class="medalha-subtitulo">Está entre os primeiros ${LIMITE_MEDALHA} inscritos</div>
      <span class="medalha-faixa">Retire no evento • Apresente este comprovante</span>
    </div>
  ` : "";

  container.innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      <div class="confirmed-avatar"><i class="fas fa-check-double"></i></div>
      <h2 style="font-size:1.5rem;font-weight:700;margin-top:12px;color:#15803d">Inscrição Confirmada!</h2>
    </div>
    ${medalhaHTML}
    <div class="confirmed-numero-box">
      <div class="confirmed-num-label"><i class="fas fa-hashtag"></i> NÚMERO</div>
      <div class="confirmed-num">#${esc(numero)}</div>
      <button id="copiarNumero" class="btn btn-green btn-sm" style="margin-top:10px">Copiar número</button>
    </div>
    <div class="confirmed-grid">
      <div class="confirmed-item"><div class="confirmed-item-label">Nome</div><div class="confirmed-item-value">${esc(registro.nome)}</div></div>
      <div class="confirmed-item"><div class="confirmed-item-label">Cidade</div><div class="confirmed-item-value">${esc(registro.cidade)}</div></div>
      <div class="confirmed-item"><div class="confirmed-item-label">Equipe</div><div class="confirmed-item-value">${esc(equipeExib)}</div></div>
      <div class="confirmed-item"><div class="confirmed-item-label">WhatsApp</div><div class="confirmed-item-value">${esc(registro.whatsapp)}</div></div>
    </div>
    <a href="${linkWhats}" target="_blank" class="btn-whatsapp" style="margin-top:12px"><i class="fab fa-whatsapp"></i> Receber número no WhatsApp</a>
    <button id="baixarPdfConfirmadoBtn" class="btn btn-gray" style="margin-top:12px"><i class="fas fa-file-pdf"></i> Baixar comprovante PDF${ganhaMedalha ? " 🏅" : ""}</button>
  `;

  document.getElementById("tabConfirmadoBtn").classList.remove("tab-hidden");

  document.getElementById("copiarNumero")?.addEventListener("click", () => {
    navigator.clipboard.writeText(numero);
    toast(`Número #${numero} copiado!`, "#27ae60");
  });

  document.getElementById("baixarPdfConfirmadoBtn")?.addEventListener("click", () => gerarPDFRapido(registro, numero));

  irParaTab("confirmado");
}

async function carregarAdminUI() {
  if (!adminLogado) return;

  const todas = await obterTodasOrdenadas();
  const total = todas.length;
  const enviados = todas.filter(i => i.pdfEnviado).length;
  const comMedalha = Math.min(total, LIMITE_MEDALHA);

  document.getElementById("adminPanelRoot").innerHTML = `
    <div class="admin-stats">
      <div class="stat-card"><div class="stat-num">${total}</div><div>Total</div></div>
      <div class="stat-card"><div class="stat-num stat-enviados">${enviados}</div><div>PDF Enviados</div></div>
      <div class="stat-card"><div class="stat-num stat-pendentes">${total - enviados}</div><div>Pendentes</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#d4a017">${comMedalha}</div><div>🏅 Medalhas</div></div>
    </div>

    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">
      <button id="btnPdfCompletoAdmin" class="btn btn-green btn-sm"><i class="fas fa-file-pdf"></i> Relatório Completo</button>
      <input type="text" id="buscaAdmin" class="admin-search" placeholder="Buscar nome, cidade, equipe ou WhatsApp...">
    </div>

    <div class="admin-legenda">
      <span>Legenda:</span>
      <span class="legenda-item"><span class="legenda-dot verde"></span> Enviado</span>
      <span class="legenda-item"><span class="legenda-dot vermelho"></span> Não enviado</span>
      <span class="legenda-item"><span style="font-size:.75rem">🏅</span> Medalha (primeiros ${LIMITE_MEDALHA})</span>
      <span>• Botão WhatsApp # → PDF + WhatsApp + marcar</span>
    </div>

    <div class="admin-table-wrap">
      <table>
        <thead>
          <tr><th>#</th><th>Nome</th><th>Cidade</th><th>Equipe</th><th>WhatsApp</th><th>Nº Inscrição</th><th>PDF</th><th>Ações</th></tr>
        </thead>
        <tbody id="adminTableBody"></tbody>
      </table>
    </div>
  `;

  const numMap = new Map();
  todas.forEach((item, idx) => numMap.set(item.id, (idx + 1).toString().padStart(3, "0")));

  const render = base => {
    const busca = (document.getElementById("buscaAdmin")?.value || "").toLowerCase();
    const filtrados = base.filter(i =>
      (i.nome || "").toLowerCase().includes(busca) ||
      (i.cidade || "").toLowerCase().includes(busca) ||
      (i.equipe || "").toLowerCase().includes(busca) ||
      (i.whatsapp || "").toLowerCase().includes(busca)
    );

    const tbody = document.getElementById("adminTableBody");
    if (!tbody) return;

    tbody.innerHTML = filtrados.map((reg, idx) => {
      const equipeTabela = reg.equipe && reg.equipe.trim() !== "" ? reg.equipe : "—";
      const whatsappTabela = reg.whatsapp || "—";
      const numero = numMap.get(reg.id);
      const medal = temMedalha(numero);

      return `
        <tr class="${medal ? "row-medalha" : ""}">
          <td>${idx + 1}</td>
          <td><strong>${esc(reg.nome)}</strong>${medal ? ' <span class="badge-medal">🏅 Medalha</span>' : ""}</td>
          <td>${esc(reg.cidade)}</td>
          <td>${esc(equipeTabela)}</td>
          <td>${esc(whatsappTabela)}</td>
          <td>
            <button class="badge-numero-whats acao-whats-enviar" data-id="${reg.id}" title="Gerar PDF + WhatsApp + marcar enviado">
              <i class="fab fa-whatsapp"></i><span>#${numero}</span>
            </button>
            <span class="num-cell-hint">PDF + WhatsApp</span>
          </td>
          <td>
            <button class="btn-action ${reg.pdfEnviado ? "btn-pdf-enviado" : "btn-pdf-nao-enviado"} acao-toggle-pdf"
              data-id="${reg.id}" data-enviado="${reg.pdfEnviado}">
              <i class="fas ${reg.pdfEnviado ? "fa-check-circle" : "fa-times-circle"}"></i>
              ${reg.pdfEnviado ? "Enviado" : "Pendente"}
            </button>
          </td>
          <td>
            <button class="btn-action btn-pdf acao-pdf" data-id="${reg.id}"><i class="fas fa-file-pdf"></i> PDF</button>
            <button class="btn-action btn-edit acao-edit"
              data-id="${reg.id}"
              data-nome="${esc(reg.nome)}"
              data-equipe="${esc(equipeTabela)}"
              data-whatsapp="${esc(whatsappTabela)}">
              <i class="fas fa-pen"></i> Editar
            </button>
            <button class="btn-action btn-deletar acao-deletar" data-id="${reg.id}"><i class="fas fa-trash"></i> Excluir</button>
          </td>
        </tr>
      `;
    }).join("");

    document.querySelectorAll(".acao-whats-enviar").forEach(btn => {
      btn.addEventListener("click", async () => {
        const reg = filtrados.find(f => f.id === btn.dataset.id);
        if (reg) await enviarPdfEAbrirWhatsApp(reg, numMap.get(reg.id), btn);
      });
    });

    document.querySelectorAll(".acao-pdf").forEach(btn => {
      btn.addEventListener("click", async () => {
        const reg = filtrados.find(f => f.id === btn.dataset.id);
        if (reg) await gerarPDFRapido(reg, numMap.get(reg.id));
      });
    });

    document.querySelectorAll(".acao-deletar").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (confirm("Excluir permanentemente?")) {
          await remove(ref(db, `inscricoes/${btn.dataset.id}`));
          toast("Excluída", "#c0392b");
          carregarAdminUI();
        }
      });
    });

    document.querySelectorAll(".acao-toggle-pdf").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const estadoAtual = btn.dataset.enviado === "true";
        try {
          btn.disabled = true;
          const novo = await togglePdfEnviado(id, estadoAtual);
          toast(novo ? "✅ Marcado enviado!" : "Marcado pendente", novo ? "#15803d" : "#e67e22");
          carregarAdminUI();
        } catch {
          toast("Erro", "#c0392b");
          carregarAdminUI();
        }
      });
    });

    document.querySelectorAll(".acao-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        document.getElementById("editId").value = btn.dataset.id;
        document.getElementById("editNome").value = btn.dataset.nome;
        document.getElementById("editEquipe").value = btn.dataset.equipe === "—" ? "" : btn.dataset.equipe;
        document.getElementById("editWhatsapp").value = btn.dataset.whatsapp === "—" ? "" : btn.dataset.whatsapp;
        document.getElementById("modalEdit").classList.remove("hidden");
      });
    });
  };

  render(todas);

  document.getElementById("buscaAdmin")?.addEventListener("input", () => render(todas));

  // Relatório completo
  document.getElementById("btnPdfCompletoAdmin")?.addEventListener("click", async () => {
    const { jsPDF } = window.jspdf;
    const todasRel = await obterTodasOrdenadas();
    if (!todasRel.length) {
      toast("Nenhuma inscrição para gerar relatório.", "#c0392b");
      return;
    }

    const doc = new jsPDF("landscape");
    const pageWidth = doc.internal.pageSize.getWidth();
    const dataAtual = new Date().toLocaleString("pt-BR");

    doc.setFillColor(30, 74, 47);
    doc.rect(0, 0, pageWidth, 32, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("ECOCICLISMO - 14ª EDIÇÃO", pageWidth / 2, 14, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Relatório completo de inscrições • Evento gratuito", pageWidth / 2, 25, { align: "center" });

    const total = todasRel.length;
    const enviados = todasRel.filter(i => i.pdfEnviado).length;
    const medalhistas = todasRel.filter((_, idx) => (idx + 1) <= LIMITE_MEDALHA).length;
    const pendentes = total - enviados;

    const statsY = 38;
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(14, statsY, pageWidth - 28, 28, 4, 4, "F");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Total: ${total}`, 20, statsY + 8);
    doc.text(`PDF enviados: ${enviados}`, 20, statsY + 16);
    doc.text(`Pendentes: ${pendentes}`, 20, statsY + 24);
    doc.text(`🏅 Medalhistas (≤ ${LIMITE_MEDALHA}): ${medalhistas}`, pageWidth - 70, statsY + 8);
    doc.text(`📅 Gerado em: ${dataAtual}`, pageWidth - 70, statsY + 24);

    const rows = todasRel.map((r, i) => {
      const num = (i + 1).toString().padStart(3, "0");
      const isMedal = (i + 1) <= LIMITE_MEDALHA;
      const medalText = isMedal ? "🏅 Sim" : "—";
      return [
        num, r.nome, r.cidade, r.whatsapp, r.equipe || "—",
        r.idade || "—", r.genero || "—", medalText, r.pdfEnviado ? "Enviado" : "Pendente"
      ];
    });

    doc.autoTable({
      head: [["Nº", "Nome", "Cidade", "WhatsApp", "Equipe", "Idade", "Gênero", `Medalha (≤${LIMITE_MEDALHA})`, "PDF"]],
      body: rows,
      startY: statsY + 38,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 7, cellPadding: 2, textColor: [0, 0, 0], lineColor: [200, 200, 200], lineWidth: 0.1 },
      headStyles: { fillColor: [30, 74, 47], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 45 },
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
        4: { cellWidth: 40 },
        5: { cellWidth: 16, halign: "center" },
        6: { cellWidth: 25 },
        7: { cellWidth: 28, halign: "center" },
        8: { cellWidth: 22, halign: "center" }
      },
      didParseCell: function(data) {
        if (data.section === "body") {
          const num = parseInt(data.row.raw[0], 10);
          if (num <= LIMITE_MEDALHA) {
            data.cell.styles.fillColor = [255, 248, 195];
            data.cell.styles.textColor = [100, 45, 0];
          }
        }
      }
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${pageCount} • Ecociclismo Oficial`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
    }

    doc.save("relatorio_ecociclismo_completo.pdf");
    toast("Relatório completo gerado com sucesso! 🏅", "#2e7d32");
  });
}

// ========== EVENTOS E INICIALIZAÇÃO ==========
document.getElementById("btnGerarInscricao").addEventListener("click", async () => {
  if (!validarFormulario()) return;

  const dados = {
    nome: document.getElementById("nome").value.trim(),
    whatsapp: document.getElementById("whatsapp").value.trim(),
    cidade: document.getElementById("cidade").value.trim(),
    equipe: document.getElementById("equipe").value.trim(),
    idade: parseInt(document.getElementById("idade").value, 10),
    genero: document.getElementById("genero").value
  };

  const btn = document.getElementById("btnGerarInscricao");
  btn.innerHTML = '<span class="spinner"></span> Confirmando...';
  btn.disabled = true;

  try {
    const nova = await criarInscricaoGratuita(dados);
    await mostrarConfirmacao(nova);

    ["nome", "whatsapp", "cidade", "equipe", "idade", "genero"].forEach(id => {
      document.getElementById(id).value = "";
    });
    toast("Inscrição gratuita realizada!", "#2e7d32");
  } catch (err) {
    toast("Erro: " + err.message, "#c0392b");
  } finally {
    btn.innerHTML = '<i class="fas fa-ticket-alt"></i> Realizar inscrição gratuita';
    btn.disabled = false;
  }
});

document.getElementById("btnLoginAdmin").addEventListener("click", async () => {
  document.getElementById("loginErrorMsg").classList.add("hidden");
  try {
    await signInWithEmailAndPassword(
      auth,
      document.getElementById("adminEmail").value.trim(),
      document.getElementById("adminPassword").value
    );
    document.getElementById("modalLogin").classList.add("hidden");
  } catch {
    document.getElementById("loginErrorMsg").classList.remove("hidden");
  }
});

onAuthStateChanged(auth, user => {
  if (user) {
    adminLogado = true;
    document.getElementById("tabAdminBtn").classList.remove("tab-hidden");
    document.getElementById("adminLogoutContainer").style.display = "flex";
    if (document.getElementById("panel-admin").classList.contains("ativo")) carregarAdminUI();
  } else {
    adminLogado = false;
    document.getElementById("tabAdminBtn").classList.add("tab-hidden");
    document.getElementById("adminLogoutContainer").style.display = "none";
    irParaTab("inscricao");
  }
});

document.getElementById("btnSairAdmin")?.addEventListener("click", () => signOut(auth));
document.getElementById("btnCancelarLogin")?.addEventListener("click", () => {
  document.getElementById("modalLogin").classList.add("hidden");
  document.getElementById("loginErrorMsg").classList.add("hidden");
});

document.querySelectorAll(".tab-btn[data-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    if (tab === "admin" && !adminLogado) {
      document.getElementById("modalLogin").classList.remove("hidden");
      return;
    }
    irParaTab(tab);
  });
});

let clickCount = 0;
let timeoutAdmin;
document.getElementById("logoSecreto")?.addEventListener("click", () => {
  clickCount++;
  clearTimeout(timeoutAdmin);
  timeoutAdmin = setTimeout(() => clickCount = 0, 800);
  if (clickCount >= 5) {
    clickCount = 0;
    if (adminLogado) irParaTab("admin");
    else document.getElementById("modalLogin").classList.remove("hidden");
  }
});

document.getElementById("btnCancelEdit")?.addEventListener("click", () => {
  document.getElementById("modalEdit").classList.add("hidden");
});

document.getElementById("btnSaveEdit")?.addEventListener("click", async () => {
  const id = document.getElementById("editId").value;
  const novoNome = document.getElementById("editNome").value.trim();
  const novaEquipe = document.getElementById("editEquipe").value.trim();
  const novoWhatsapp = document.getElementById("editWhatsapp").value.trim();
  const campoWhatsapp = document.getElementById("editWhatsapp");

  campoWhatsapp.classList.remove("erro");
  if (!novoNome) {
    toast("Nome não pode ficar vazio", "#c0392b");
    return;
  }
  if (!whatsappValido(novoWhatsapp)) {
    campoWhatsapp.classList.add("erro");
    toast("Informe um WhatsApp válido", "#c0392b");
    return;
  }

  try {
    await atualizarInscricao(id, novoNome, novaEquipe, novoWhatsapp);
    toast("Dados atualizados!", "#15803d");
    document.getElementById("modalEdit").classList.add("hidden");
    carregarAdminUI();
  } catch {
    toast("Erro ao atualizar", "#c0392b");
  }
});

irParaTab("inscricao");
