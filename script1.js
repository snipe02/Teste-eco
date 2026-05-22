import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, set, get, remove } from "firebase/database";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

// ===================== CONFIGURAÇÃO DO FIREBASE =====================
const firebaseConfig = {
    apiKey: "AIzaSyBSufzO0XqpLJ042F0Uwx4XYOwQ42-YHAo",
    authDomain: "inscr-d8712.firebaseapp.com",
    databaseURL: "https://inscr-d8712-default-rtdb.firebaseio.com",
    projectId: "inscr-d8712",
    storageBucket: "inscr-d8712.firebasestorage.app",
    messagingSenderId: "776446988108",
    appId: "1:776446988108:web:ea8a03286d587abc8bc9e9",
};

let db, auth;
try {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
    console.log("Firebase conectado!");
} catch (e) {
    console.error("Firebase init error", e);
    alert("Erro ao conectar ao banco de dados. Recarregue a página.");
}

let adminLogado = false;

function toast(msg, bg = '#1e4a2f') {
    const d = document.createElement('div');
    d.className = 'toast-custom';
    d.style.backgroundColor = bg;
    d.innerHTML = msg;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 3500);
}

function esc(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (m) => {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        return '&#039;';
    });
}

function irParaTab(tabId) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('ativo'));
    const panel = document.getElementById(`panel-${tabId}`);
    if (panel) panel.classList.add('ativo');
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active-inscricao', 'active-confirmado', 'active-admin');
    });
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (tabBtn) tabBtn.classList.add(`active-${tabId}`);
    if (tabId === 'admin' && adminLogado) carregarAdminUI();
}

async function obterTodasOrdenadas() {
    const snap = await get(ref(db, 'inscricoes'));
    const todas = snap.val() || {};
    return Object.entries(todas)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (a.dataCriacao || 0) - (b.dataCriacao || 0));
}

async function gerarNumeroInscricaoPorId(id, listaOrdenada = null) {
    const ordenadas = listaOrdenada || await obterTodasOrdenadas();
    const idx = ordenadas.findIndex(i => i.id === id);
    return idx !== -1 ? (idx + 1).toString().padStart(3, '0') : '---';
}

async function criarInscricaoGratuita(dados) {
    const newRef = push(ref(db, 'inscricoes'));
    const now = Date.now();
    const registro = {
        nome: dados.nome,
        whatsapp: dados.whatsapp,
        cidade: dados.cidade,
        equipe: dados.equipe || '',
        idade: Number(dados.idade),
        genero: dados.genero,
        pago: true,
        dataCriacao: now,
        dataPagamento: now,
        codigoInterno: 'ECO-' + newRef.key.slice(-6).toUpperCase()
    };
    await set(newRef, registro);
    return { id: newRef.key, ...registro };
}

// ===================== PDF Individual =====================
async function gerarPDFComTemplate(part, numero) {
    if (typeof html2canvas === 'undefined') {
        toast("Biblioteca html2canvas não carregada. Recarregue a página.", "#c0392b");
        return;
    }
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        toast("Biblioteca jsPDF não carregada. Recarregue a página.", "#c0392b");
        return;
    }
    try {
        const html = `<div style="font-family:'DM Sans',Arial,sans-serif;max-width:800px;margin:0 auto;background:#fff;padding:24px;border-radius:24px">
            <div style="text-align:center;border-bottom:3px solid #e67e22;padding-bottom:16px">
                <div style="font-size:48px;color:#e67e22">🚴‍♂️</div>
                <h1 style="font-family:'Bebas Neue',sans-serif;font-size:38px;margin:8px 0 0;color:#1e4a2f">ECOCICLISMO</h1>
                <p>Comprovante de Inscrição - Gratuito</p>
            </div>
            <div style="margin:24px 0;background:#f0fdf4;padding:16px;border-radius:20px;text-align:center">
                <span style="font-size:14px;font-weight:700;color:#15803d">NÚMERO OFICIAL</span>
                <div style="font-family:'Bebas Neue';font-size:52px;color:#14532d">#${numero}</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
                <div><strong>Nome:</strong> ${esc(part.nome)}</div>
                <div><strong>WhatsApp:</strong> ${esc(part.whatsapp)}</div>
                <div><strong>Cidade:</strong> ${esc(part.cidade)}</div>
                <div><strong>Equipe:</strong> ${esc(part.equipe || '-')}</div>
                <div><strong>Idade:</strong> ${part.idade}</div>
                <div><strong>Gênero:</strong> ${esc(part.genero)}</div>
            </div>
            <div style="background:#f8fafc;padding:16px;border-radius:16px">
                <p><strong>Status:</strong> <span style="color:#15803d">✓ CONFIRMADO</span></p>
                <p><strong>Data:</strong> ${new Date(part.dataCriacao).toLocaleString('pt-BR')}</p>
            </div>
            <div style="text-align:center;font-size:11px;color:#9ca3af;margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb">Ecociclismo • Inscrição gratuita</div>
        </div>`;
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:fixed;top:-9999px;left:0;width:800px;background:#fff;';
        wrapper.innerHTML = html;
        document.body.appendChild(wrapper);
        const canvas = await html2canvas(wrapper, { scale: 2.5, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
        const imgWidth = 190;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
        pdf.save(`ecociclismo_${part.nome.replace(/\s/g, '_')}_${numero}.pdf`);
        document.body.removeChild(wrapper);
        toast("PDF salvo com sucesso!", "#2e7d32");
    } catch (e) {
        console.error(e);
        toast("Erro ao gerar PDF: " + e.message, "#c0392b");
    }
}

// ===================== PDF Completo =====================
async function gerarPDFCompleto() {
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        toast("Biblioteca jsPDF não carregada. Recarregue a página.", "#c0392b");
        return;
    }
    try {
        toast("Gerando PDF completo, aguarde...", "#1e4a2f");
        const todas = await obterTodasOrdenadas();
        if (!todas.length) {
            toast("Nenhuma inscrição encontrada.", "#c0392b");
            return;
        }
        const mapNumero = new Map();
        todas.forEach((item, idx) => mapNumero.set(item.id, (idx + 1).toString().padStart(3, '0')));
        const rows = todas.map(reg => [
            mapNumero.get(reg.id) || '---',
            reg.nome || '',
            reg.cidade || '',
            reg.whatsapp || '',
            reg.equipe || '-',
            reg.idade || '',
            reg.genero || '',
            new Date(reg.dataCriacao).toLocaleDateString('pt-BR')
        ]);
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("ECOCICLISMO - RELATÓRIO COMPLETO DE INSCRIÇÕES", pageWidth / 2, 15, { align: "center" });
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(`Total de inscrições: ${todas.length}`, 14, 25);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 32);
        if (typeof doc.autoTable !== 'function') {
            throw new Error("Plugin autoTable do jsPDF não carregado.");
        }
        doc.autoTable({
            startY: 38,
            head: [["Nº", "Nome completo", "Cidade", "WhatsApp", "Equipe", "Idade", "Gênero", "Data inscrição"]],
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: [30, 74, 47], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
            columnStyles: {
                0: { cellWidth: 12 },
                1: { cellWidth: 38 },
                2: { cellWidth: 30 },
                3: { cellWidth: 30 },
                4: { cellWidth: 25 },
                5: { cellWidth: 12 },
                6: { cellWidth: 25 },
                7: { cellWidth: 28 }
            },
            margin: { left: 10, right: 10 }
        });
        doc.save(`ecociclismo_total_${todas.length}_inscricoes.pdf`);
        toast(`PDF gerado com ${todas.length} inscrições!`, "#2e7d32");
    } catch (err) {
        console.error(err);
        toast("Erro ao gerar PDF completo: " + err.message, "#c0392b");
    }
}

// ===================== Tela de Confirmação =====================
async function mostrarConfirmacao(registro) {
    const todasOrdenadas = await obterTodasOrdenadas();
    const numero = await gerarNumeroInscricaoPorId(registro.id, todasOrdenadas);
    const container = document.getElementById('confirmadoDinamico');
    const numeroDestino = '5586995300632';
    const msgWhats = `✅ *ECOCICLISMO* - Inscrição confirmada!\n\nOlá ${registro.nome}, sua inscrição foi realizada com sucesso.\n🎫 *Número de inscrição:* #${numero}\n📅 Data: ${new Date(registro.dataCriacao).toLocaleString('pt-BR')}\n\nGuarde esse número para o dia do evento.`;
    const linkWhats = `https://wa.me/${numeroDestino}?text=${encodeURIComponent(msgWhats)}`;
    container.innerHTML = `
        <div style="text-align:center;margin-bottom:16px"><div class="confirmed-avatar"><i class="fas fa-check-double"></i></div>
        <h2 style="font-size:1.5rem;font-weight:700;margin-top:12px;color:#15803d">Inscrição Confirmada!</h2>
        <p style="color:#6b7280">Sua participação está garantida gratuitamente.</p></div>
        <div class="confirmed-numero-box"><div class="confirmed-num-label"><i class="fas fa-hashtag"></i> NÚMERO DE INSCRIÇÃO</div>
        <div class="confirmed-num">#${esc(numero)}</div>
        <button id="copiarNumero" class="btn btn-green btn-sm" style="margin-top:10px">Copiar número</button></div>
        <div class="confirmed-grid"><div class="confirmed-item"><div class="confirmed-item-label">Nome</div><div class="confirmed-item-value">${esc(registro.nome)}</div></div>
        <div class="confirmed-item"><div class="confirmed-item-label">Cidade</div><div class="confirmed-item-value">${esc(registro.cidade)}</div></div></div>
        <a href="${linkWhats}" target="_blank" class="btn-whatsapp" style="margin-top:12px"><i class="fab fa-whatsapp"></i> Receber número no WhatsApp</a>
        <button id="baixarPdfConfirmadoBtn" class="btn btn-gray" style="margin-top:12px"><i class="fas fa-file-pdf"></i> Baixar comprovante PDF</button>
        <button id="novaInscricaoBtn" class="btn btn-orange" style="margin-top:12px"><i class="fas fa-plus-circle"></i> Nova inscrição</button>`;
    document.getElementById('tabConfirmadoBtn').classList.remove('tab-hidden');
    setTimeout(() => {
        document.getElementById('copiarNumero')?.addEventListener('click', () => {
            navigator.clipboard.writeText(numero);
            toast(`Número #${numero} copiado!`, '#27ae60');
        });
        document.getElementById('baixarPdfConfirmadoBtn')?.addEventListener('click', () => gerarPDFComTemplate(registro, numero));
        document.getElementById('novaInscricaoBtn')?.addEventListener('click', () => irParaTab('inscricao'));
    }, 50);
    irParaTab('confirmado');
}

// ===================== Admin UI =====================
async function carregarAdminUI() {
    if (!adminLogado) return;
    const todas = await obterTodasOrdenadas();
    const total = todas.length;
    document.getElementById('adminPanelRoot').innerHTML = `
        <div class="admin-stats"><div class="stat-card"><div class="stat-num" style="color:#1e4a2f">${total}</div><div>Inscrições</div></div></div>
        <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <button id="btnPdfCompletoAdmin" class="btn btn-green btn-sm" style="background: #1e4a2f; width: auto;"><i class="fas fa-file-pdf"></i> 📄 Gerar PDF Completo (Todas)</button>
            <div class="admin-filters" style="margin-bottom: 0;"><input type="text" id="buscaAdmin" class="admin-search" placeholder="Buscar por nome ou cidade..."></div>
        </div>
        <div class="admin-table-wrap"><table><thead><tr><th>#</th><th>Nome</th><th>Cidade</th><th>WhatsApp</th><th>Nº Inscrição</th><th>Ações</th></tr></thead><tbody id="adminTableBody"></tbody></table></div>`;
    const numMap = new Map();
    todas.forEach((item, idx) => numMap.set(item.id, (idx + 1).toString().padStart(3, '0')));
    function render(base) {
        const busca = (document.getElementById('buscaAdmin')?.value || '').toLowerCase();
        const filtrados = base.filter(i => (i.nome || '').toLowerCase().includes(busca) || (i.cidade || '').toLowerCase().includes(busca));
        const tbody = document.getElementById('adminTableBody');
        if (!tbody) return;
        tbody.innerHTML = filtrados.map((reg, idx) => `
            <tr>
                <td style="color:#9ca3af;font-size:.75rem">${idx + 1}</td>
                <td><strong>${esc(reg.nome)}</strong></td>
                <td>${esc(reg.cidade)}</td>
                <td>${esc(reg.whatsapp)}</td>
                <td><span class="badge-pago">#${numMap.get(reg.id)}</span></td>
                <td style="white-space:nowrap">
                    <button class="btn-action btn-pdf acao-pdf" data-id="${reg.id}"><i class="fas fa-file-pdf"></i> PDF</button>
                    <button class="btn-action btn-deletar acao-deletar" data-id="${reg.id}" style="margin-left:4px"><i class="fas fa-trash"></i> Excluir</button>
                </td>
            </tr>
        `).join('');
        document.querySelectorAll('.acao-pdf').forEach(btn => {
            btn.addEventListener('click', async () => {
                const reg = filtrados.find(f => f.id === btn.dataset.id);
                if (reg) await gerarPDFComTemplate(reg, numMap.get(reg.id));
            });
        });
        document.querySelectorAll('.acao-deletar').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Deseja excluir esta inscrição?')) {
                    await remove(ref(db, `inscricoes/${btn.dataset.id}`));
                    toast('Inscrição excluída', '#c0392b');
                    carregarAdminUI();
                }
            });
        });
    }
    render(todas);
    document.getElementById('buscaAdmin')?.addEventListener('input', () => render(todas));
    document.getElementById('btnPdfCompletoAdmin')?.addEventListener('click', () => gerarPDFCompleto());
}

// ===================== Eventos e inicialização =====================
document.getElementById('btnGerarInscricao').addEventListener('click', async () => {
    const nome = document.getElementById('nome').value.trim();
    const whatsapp = document.getElementById('whatsapp').value.trim();
    const cidade = document.getElementById('cidade').value.trim();
    const idadeVal = document.getElementById('idade').value;
    const idade = parseInt(idadeVal, 10);
    const genero = document.getElementById('genero').value;
    const equipe = document.getElementById('equipe').value.trim();
    if (!nome || !whatsapp || !cidade || !idadeVal || isNaN(idade) || idade < 1) {
        toast('Preencha todos os campos obrigatórios', '#c0392b');
        return;
    }
    const btn = document.getElementById('btnGerarInscricao');
    btn.innerHTML = '<span class="spinner"></span> Confirmando...';
    btn.disabled = true;
    try {
        const nova = await criarInscricaoGratuita({ nome, whatsapp, cidade, equipe, idade, genero });
        await mostrarConfirmacao(nova);
        document.getElementById('nome').value = '';
        document.getElementById('whatsapp').value = '';
        document.getElementById('cidade').value = '';
        document.getElementById('equipe').value = '';
        document.getElementById('idade').value = '';
        toast('Inscrição gratuita realizada com sucesso!', '#2e7d32');
    } catch (err) {
        console.error(err);
        toast('Erro ao salvar: ' + err.message, '#c0392b');
    } finally {
        btn.innerHTML = '<i class="fas fa-ticket-alt"></i> Realizar inscrição gratuita';
        btn.disabled = false;
    }
});

// Admin Auth
document.getElementById('btnLoginAdmin').addEventListener('click', async () => {
    document.getElementById('loginErrorMsg').classList.add('hidden');
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('adminEmail').value.trim(), document.getElementById('adminPassword').value);
        document.getElementById('modalLogin').classList.add('hidden');
    } catch {
        document.getElementById('loginErrorMsg').classList.remove('hidden');
    }
});
document.getElementById('adminPassword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnLoginAdmin').click();
});
onAuthStateChanged(auth, (user) => {
    if (user) {
        adminLogado = true;
        document.getElementById('tabAdminBtn').classList.remove('tab-hidden');
        document.getElementById('adminLogoutContainer').style.display = 'flex';
        if (document.getElementById('panel-admin').classList.contains('ativo')) carregarAdminUI();
    } else {
        adminLogado = false;
        document.getElementById('tabAdminBtn').classList.add('tab-hidden');
        document.getElementById('adminLogoutContainer').style.display = 'none';
        irParaTab('inscricao');
    }
});
document.getElementById('btnSairAdmin')?.addEventListener('click', () => signOut(auth));
document.getElementById('btnCancelarLogin').addEventListener('click', () => {
    document.getElementById('modalLogin').classList.add('hidden');
    document.getElementById('loginErrorMsg').classList.add('hidden');
});
document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === 'admin' && !adminLogado) {
            document.getElementById('modalLogin').classList.remove('hidden');
            return;
        }
        irParaTab(tab);
    });
});
let clickCount = 0, timeoutAdmin;
document.getElementById('logoSecreto')?.addEventListener('click', () => {
    clickCount++;
    clearTimeout(timeoutAdmin);
    timeoutAdmin = setTimeout(() => clickCount = 0, 800);
    if (clickCount >= 5) {
        clickCount = 0;
        if (adminLogado) irParaTab('admin');
        else document.getElementById('modalLogin').classList.remove('hidden');
    }
});
irParaTab('inscricao');