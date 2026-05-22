import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, set, get, remove, update } from "firebase/database";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBSufzO0XqpLJ042F0Uwx4XYOwQ42-YHAo",
    authDomain: "inscr-d8712.firebaseapp.com",
    databaseURL: "https://inscr-d8712-default-rtdb.firebaseio.com",
    projectId: "inscr-d8712",
    storageBucket: "inscr-d8712.firebasestorage.app",
    messagingSenderId: "776446988108",
    appId: "1:776446988108:web:ea8a03286d587abc8bc9e9",
};

const WHATS_ADMIN = '5586995300632';
let db, auth, adminLogado = false;

try {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
    console.log("Firebase conectado!");
} catch (e) { console.error(e); alert("Erro ao conectar ao banco de dados."); }

// Utilitários globais
function toast(msg, bg = '#1e4a2f') {
    const d = document.createElement('div');
    d.className = 'toast-custom';
    d.style.backgroundColor = bg;
    d.innerHTML = msg;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 3500);
}

function esc(str) {
    if (str === undefined || str === null) return '';
    const s = String(str);
    return s.replace(/[&<>"']/g, (m) => {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        return '&#039;';
    });
}

function safeValue(value, fallback = '—') {
    if (value === undefined || value === null || value === '') return fallback;
    return value;
}

function validarFormulario() {
    let valido = true;
    const nome = document.getElementById('nome');
    const whatsapp = document.getElementById('whatsapp');
    const cidade = document.getElementById('cidade');
    const equipe = document.getElementById('equipe');
    const idade = document.getElementById('idade');
    const genero = document.getElementById('genero');
    
    [nome, whatsapp, cidade, equipe, idade, genero].forEach(campo => { if(campo) campo.classList.remove('erro'); });
    
    if (!nome.value.trim()) { nome.classList.add('erro'); valido = false; }
    const whatsLimpo = whatsapp.value.replace(/\D/g, '');
    if (!whatsapp.value.trim() || whatsLimpo.length < 10) { whatsapp.classList.add('erro'); valido = false; }
    if (!cidade.value.trim()) { cidade.classList.add('erro'); valido = false; }
    if (!equipe.value.trim()) { equipe.classList.add('erro'); valido = false; }
    const idadeNum = parseInt(idade.value, 10);
    if (!idade.value.trim() || isNaN(idadeNum) || idadeNum < 1 || idadeNum > 120) { idade.classList.add('erro'); valido = false; }
    if (!genero.value) { genero.classList.add('erro'); valido = false; }
    
    if (!valido) toast('❌ Preencha TODOS os campos obrigatórios: Nome, WhatsApp, Cidade, Equipe, Idade e Gênero!', '#c0392b');
    return valido;
}

function irParaTab(tabId) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('ativo'));
    const panel = document.getElementById(`panel-${tabId}`);
    if (panel) panel.classList.add('ativo');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active-inscricao', 'active-confirmado', 'active-admin'));
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (tabBtn) tabBtn.classList.add(`active-${tabId}`);
    if (tabId === 'admin' && adminLogado) carregarAdminUI();
}

async function obterTodasOrdenadas() {
    const snap = await get(ref(db, 'inscricoes'));
    const todas = snap.val() || {};
    return Object.entries(todas).map(([id, v]) => ({ id, ...v })).sort((a, b) => (a.dataCriacao || 0) - (b.dataCriacao || 0));
}

async function gerarNumeroInscricaoPorId(id, listaOrdenada = null) {
    const ordenadas = listaOrdenada || await obterTodasOrdenadas();
    const idx = ordenadas.findIndex(i => i.id === id);
    return idx !== -1 ? (idx + 1).toString().padStart(3, '0') : '000';
}

async function criarInscricaoGratuita(dados) {
    const newRef = push(ref(db, 'inscricoes'));
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
        codigoInterno: 'ECO-' + newRef.key.slice(-6).toUpperCase()
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

function gerarLinkWhatsAppParticipante(reg, numero) {
    const rawFone = (reg.whatsapp || '').replace(/\D/g, '');
    let fone = rawFone;
    if (fone.startsWith('0')) fone = fone.slice(1);
    if (!fone.startsWith('55') && fone.length <= 11) fone = '55' + fone;
    const equipeMsg = reg.equipe && reg.equipe.trim() !== '' ? reg.equipe : 'Não informada';
    const msg = `✅ *ECOCICLISMO* — 14ª Edição\n\nOlá *${reg.nome}*! 🚴‍♂️\n\nSua inscrição foi confirmada com sucesso!\n\n🎫 *Número de inscrição:* #${numero}\n📍 *Cidade:* ${reg.cidade}\n🏷️ *Equipe:* ${equipeMsg}\n📅 *Data:* ${new Date(reg.dataCriacao).toLocaleDateString('pt-BR')}\n\n_Guarde esse número para o dia do evento. Boa sorte!_ 🌿`;
    return `https://wa.me/${fone}?text=${encodeURIComponent(msg)}`;
}

// PDF rápido usando jsPDF (sem canvas)
async function gerarPDFRapido(reg, numeroInscricao) {
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
        toast("Biblioteca jsPDF não carregada.", "#c0392b");
        return;
    }
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const marginX = 15;
        const contentWidth = pageWidth - marginX * 2;
        
        doc.setFillColor(30, 74, 47);
        doc.rect(0, 0, pageWidth, 38, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("ECOCICLISMO", pageWidth / 2, 18, { align: "center" });
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Comprovante de Inscrição — 14ª Edição • Gratuito", pageWidth / 2, 30, { align: "center" });
        doc.setTextColor(0, 0, 0);
        
        const boxY = 48;
        doc.setDrawColor(134, 239, 172);
        doc.setFillColor(240, 253, 244);
        doc.rect(marginX, boxY, contentWidth, 32, 'FD');
        doc.setFontSize(11);
        doc.setTextColor(21, 128, 61);
        doc.text("NÚMERO OFICIAL DO PARTICIPANTE", pageWidth / 2, boxY + 8, { align: "center" });
        doc.setFontSize(36);
        doc.setFont("helvetica", "bold");
        doc.text(`#${numeroInscricao}`, pageWidth / 2, boxY + 27, { align: "center" });
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        const equipeExib = (reg.equipe && reg.equipe.trim() !== '') ? reg.equipe : 'Não informada';
        const dataInscricao = new Date(reg.dataCriacao).toLocaleString('pt-BR');
        doc.autoTable({
            startY: boxY + 42,
            body: [
                ["Nome completo:", reg.nome],
                ["WhatsApp:", reg.whatsapp],
                ["Cidade:", reg.cidade],
                ["Equipe:", equipeExib],
                ["Idade:", reg.idade || '—'],
                ["Gênero:", reg.genero],
                ["Status:", "✓ CONFIRMADA (Gratuita)"],
                ["Data do registro:", dataInscricao]
            ],
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 3, lineColor: [220, 220, 220], lineWidth: 0.1 },
            columnStyles: { 0: { fontStyle: 'bold', textColor: [30, 74, 47], cellWidth: 45 }, 1: { textColor: [0, 0, 0] } },
            margin: { left: marginX, right: marginX },
            alternateRowStyles: { fillColor: [245, 245, 245] }
        });
        const finalY = doc.lastAutoTable.finalY + 8;
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text("Ecociclismo Oficial • Inscrição gratuita • Apresente este comprovante no dia do evento", pageWidth / 2, finalY, { align: "center" });
        
        const nomeArquivo = `ecociclismo_${reg.nome.replace(/\s/g, '_')}_${numeroInscricao}.pdf`;
        doc.save(nomeArquivo);
        toast(`PDF gerado rapidamente! Nº #${numeroInscricao}`, "#2e7d32");
    } catch (e) {
        console.error(e);
        toast("Erro ao gerar PDF: " + e.message, "#c0392b");
    }
}

async function enviarPdfEAbrirWhatsApp(reg, numero, btnEl) {
    try {
        if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...'; }
        await gerarPDFRapido(reg, numero);
        const link = gerarLinkWhatsAppParticipante(reg, numero);
        window.open(link, '_blank');
        await marcarComoEnviado(reg.id);
        const btnToggle = document.querySelector(`.acao-toggle-pdf[data-id="${reg.id}"]`);
        if (btnToggle) {
            btnToggle.dataset.enviado = 'true';
            btnToggle.className = 'btn-action btn-pdf-enviado acao-toggle-pdf';
            btnToggle.innerHTML = '<i class="fas fa-check-circle"></i> Enviado';
            btnToggle.classList.add('pulse');
            setTimeout(() => btnToggle.classList.remove('pulse'), 1000);
        }
        if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = `<i class="fab fa-whatsapp whats-icon"></i> #${numero}`; }
        setTimeout(() => atualizarStats(), 400);
        toast(`✅ PDF + WhatsApp enviado para ${reg.nome}!`, '#15803d');
    } catch (err) {
        console.error(err);
        toast('Erro no processo: ' + err.message, '#c0392b');
        if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = `<i class="fab fa-whatsapp whats-icon"></i> #${numero}`; }
    }
}

async function gerarPDFCompleto() {
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) { toast("Biblioteca jsPDF não carregada.", "#c0392b"); return; }
    try {
        toast("Gerando relatório completo...", "#1e4a2f");
        const snap = await get(ref(db, 'inscricoes'));
        const todasRaw = snap.val() || {};
        const todas = Object.entries(todasRaw).map(([id, v]) => ({ id, ...v })).sort((a, b) => (a.dataCriacao || 0) - (b.dataCriacao || 0));
        if (!todas.length) { toast("Nenhuma inscrição encontrada.", "#c0392b"); return; }

        const mapNumero = new Map();
        todas.forEach((item, idx) => { mapNumero.set(item.id, (idx + 1).toString().padStart(3, '0')); });

        const rows = todas.map((reg) => {
            const numero = mapNumero.get(reg.id) || '---';
            const equipeExib = (reg.equipe && reg.equipe.trim() !== '') ? reg.equipe : '-';
            return [numero, safeValue(reg.nome, '—'), safeValue(reg.cidade, '—'), safeValue(reg.whatsapp, '—'), equipeExib, (reg.idade && !isNaN(reg.idade)) ? reg.idade : '—', safeValue(reg.genero, '—'), reg.pdfEnviado ? '✓ Enviado' : '✗ Pendente', new Date(reg.dataCriacao).toLocaleDateString('pt-BR')];
        });

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("ECOCICLISMO — RELATÓRIO COMPLETO DE INSCRIÇÕES", pageWidth / 2, 15, { align: "center" });
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(`Total de inscrições: ${todas.length}`, 14, 25);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 32);
        doc.autoTable({
            startY: 38,
            head: [["Nº", "Nome", "Cidade", "WhatsApp", "Equipe", "Idade", "Gênero", "PDF", "Data"]],
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: [30, 74, 47], textColor: 255, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
            columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 1: { cellWidth: 38 }, 2: { cellWidth: 32 }, 3: { cellWidth: 28 }, 4: { cellWidth: 24 }, 5: { cellWidth: 10, halign: 'center' }, 6: { cellWidth: 20 }, 7: { cellWidth: 16, halign: 'center' }, 8: { cellWidth: 24, halign: 'center' } },
            didParseCell: (data) => { if (data.column.index === 7 && data.section === 'body') data.cell.styles.textColor = data.cell.text[0] === '✓ Enviado' ? [21, 128, 61] : [220, 38, 38]; },
            margin: { left: 10, right: 10, top: 35 }
        });
        doc.save(`ecociclismo_total_${todas.length}_inscricoes.pdf`);
        toast(`Relatório com ${todas.length} inscrições gerado!`, "#2e7d32");
    } catch (err) { console.error(err); toast("Erro: " + err.message, "#c0392b"); }
}

async function mostrarConfirmacao(registro) {
    const todasOrdenadas = await obterTodasOrdenadas();
    const numero = await gerarNumeroInscricaoPorId(registro.id, todasOrdenadas);
    const container = document.getElementById('confirmadoDinamico');
    const equipeExib = (registro.equipe && registro.equipe.trim() !== '') ? registro.equipe : 'Não informada';
    const msgWhats = `✅ *ECOCICLISMO* - Inscrição confirmada!\n\nOlá ${registro.nome}, sua inscrição foi realizada com sucesso.\n🎫 *Número de inscrição:* #${numero}\n🏷️ *Equipe:* ${equipeExib}\n📅 Data: ${new Date(registro.dataCriacao).toLocaleString('pt-BR')}\n\nGuarde esse número para o dia do evento.`;
    const linkWhats = `https://wa.me/${WHATS_ADMIN}?text=${encodeURIComponent(msgWhats)}`;
    container.innerHTML = `
        <div style="text-align:center;margin-bottom:16px"><div class="confirmed-avatar"><i class="fas fa-check-double"></i></div><h2 style="font-size:1.5rem;font-weight:700;margin-top:12px;color:#15803d">Inscrição Confirmada!</h2><p style="color:#6b7280">Sua participação está garantida gratuitamente.</p></div>
        <div class="confirmed-numero-box"><div class="confirmed-num-label"><i class="fas fa-hashtag"></i> NÚMERO DE INSCRIÇÃO</div><div class="confirmed-num">#${esc(numero)}</div><button id="copiarNumero" class="btn btn-green btn-sm" style="margin-top:10px">Copiar número</button></div>
        <div class="confirmed-grid"><div class="confirmed-item"><div class="confirmed-item-label">Nome</div><div class="confirmed-item-value">${esc(registro.nome)}</div></div><div class="confirmed-item"><div class="confirmed-item-label">Cidade</div><div class="confirmed-item-value">${esc(registro.cidade)}</div></div><div class="confirmed-item"><div class="confirmed-item-label">Equipe</div><div class="confirmed-item-value">${esc(equipeExib)}</div></div><div class="confirmed-item"><div class="confirmed-item-label">WhatsApp</div><div class="confirmed-item-value">${esc(registro.whatsapp)}</div></div></div>
        <a href="${linkWhats}" target="_blank" class="btn-whatsapp" style="margin-top:12px"><i class="fab fa-whatsapp"></i> Receber número no WhatsApp</a>
        <button id="baixarPdfConfirmadoBtn" class="btn btn-gray" style="margin-top:12px"><i class="fas fa-file-pdf"></i> Baixar comprovante PDF (rápido)</button>`;
    document.getElementById('tabConfirmadoBtn').classList.remove('tab-hidden');
    setTimeout(() => {
        document.getElementById('copiarNumero')?.addEventListener('click', () => { navigator.clipboard.writeText(numero); toast(`Número #${numero} copiado!`, '#27ae60'); });
        document.getElementById('baixarPdfConfirmadoBtn')?.addEventListener('click', () => gerarPDFRapido(registro, numero));
    }, 50);
    irParaTab('confirmado');
}

async function carregarAdminUI() {
    if (!adminLogado) return;
    const todas = await obterTodasOrdenadas();
    const total = todas.length, enviados = todas.filter(i => i.pdfEnviado).length;
    document.getElementById('adminPanelRoot').innerHTML = `<div class="admin-stats"><div class="stat-card"><div class="stat-num">${total}</div><div>Total</div></div><div class="stat-card"><div class="stat-num stat-enviados">${enviados}</div><div>PDF Enviados</div></div><div class="stat-card"><div class="stat-num stat-pendentes">${total - enviados}</div><div>Pendentes</div></div><div class="stat-card"><div class="stat-num">${total > 0 ? Math.round((enviados/total)*100) : 0}%</div><div>Enviados</div></div></div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px;"><button id="btnPdfCompletoAdmin" class="btn btn-green btn-sm"><i class="fas fa-file-pdf"></i> Gerar PDF Completo</button><div class="admin-filters"><input type="text" id="buscaAdmin" class="admin-search" placeholder="Buscar nome, cidade ou equipe..."></div></div>
    <div class="admin-legenda"><span>Legenda PDF:</span><span class="legenda-item"><span class="legenda-dot verde"></span> Enviado</span><span class="legenda-item"><span class="legenda-dot vermelho"></span> Não enviado</span><span>• Clique no <i class="fab fa-whatsapp" style="color:#25d366"></i> número → baixar PDF + WhatsApp + marcar enviado</span></div>
    <div class="admin-table-wrap"><table><thead><tr><th>#</th><th>Nome</th><th>Cidade</th><th>Equipe</th><th>WhatsApp</th><th>Nº Inscrição</th><th>PDF</th><th>Ações</th></tr></thead><tbody id="adminTableBody"></tbody></table></div>`;
    const numMap = new Map(); todas.forEach((item, idx) => numMap.set(item.id, (idx + 1).toString().padStart(3, '0')));
    const render = (base) => {
        const busca = (document.getElementById('buscaAdmin')?.value || '').toLowerCase();
        const filtrados = base.filter(i => (i.nome || '').toLowerCase().includes(busca) || (i.cidade || '').toLowerCase().includes(busca) || (i.equipe || '').toLowerCase().includes(busca));
        const tbody = document.getElementById('adminTableBody');
        if (tbody) tbody.innerHTML = filtrados.map((reg, idx) => {
            const equipeTabela = (reg.equipe && reg.equipe.trim() !== '') ? reg.equipe : '—';
            return `<tr>
                <td>${idx+1}</td>
                <td><strong>${esc(reg.nome)}</strong></td>
                <td>${esc(reg.cidade)}</td>
                <td>${esc(equipeTabela)}</td>
                <td>${esc(reg.whatsapp)}</td>
                <td><button class="badge-numero-whats acao-whats-enviar" data-id="${reg.id}" title="PDF + WhatsApp + enviar"><i class="fab fa-whatsapp whats-icon"></i> #${numMap.get(reg.id)}</button><span class="num-cell-hint">PDF + WhatsApp</span></td>
                <td><button class="btn-action ${reg.pdfEnviado ? 'btn-pdf-enviado' : 'btn-pdf-nao-enviado'} acao-toggle-pdf" data-id="${reg.id}" data-enviado="${reg.pdfEnviado}"><i class="fas ${reg.pdfEnviado ? 'fa-check-circle' : 'fa-times-circle'}"></i> ${reg.pdfEnviado ? 'Enviado' : 'Não enviado'}</button></td>
                <td><button class="btn-action btn-pdf acao-pdf" data-id="${reg.id}"><i class="fas fa-file-pdf"></i> PDF</button> <button class="btn-action btn-deletar acao-deletar" data-id="${reg.id}"><i class="fas fa-trash"></i> Excluir</button></td>
            </tr>`;
        }).join('');
        document.querySelectorAll('.acao-whats-enviar').forEach(btn => btn.addEventListener('click', async () => { const reg = filtrados.find(f => f.id === btn.dataset.id); if (reg) await enviarPdfEAbrirWhatsApp(reg, numMap.get(reg.id), btn); }));
        document.querySelectorAll('.acao-pdf').forEach(btn => btn.addEventListener('click', async () => { const reg = filtrados.find(f => f.id === btn.dataset.id); if (reg) await gerarPDFRapido(reg, numMap.get(reg.id)); }));
        document.querySelectorAll('.acao-deletar').forEach(btn => btn.addEventListener('click', async () => { if (confirm('Excluir permanentemente?')) { await remove(ref(db, `inscricoes/${btn.dataset.id}`)); toast('Excluída', '#c0392b'); carregarAdminUI(); } }));
        document.querySelectorAll('.acao-toggle-pdf').forEach(btn => btn.addEventListener('click', async () => { const id = btn.dataset.id, estadoAtual = btn.dataset.enviado === 'true'; try { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>'; const novo = await togglePdfEnviado(id, estadoAtual); btn.dataset.enviado=novo; btn.className=`btn-action ${novo?'btn-pdf-enviado':'btn-pdf-nao-enviado'} acao-toggle-pdf`; btn.innerHTML=novo?'<i class="fas fa-check-circle"></i> Enviado':'<i class="fas fa-times-circle"></i> Não enviado'; toast(novo?'✅ Marcado enviado!':'Marcado pendente',novo?'#15803d':'#e67e22'); btn.disabled=false; atualizarStats(); } catch(e){toast('Erro','#c0392b'); carregarAdminUI();} }));
    };
    render(todas);
    document.getElementById('buscaAdmin')?.addEventListener('input', () => render(todas));
    document.getElementById('btnPdfCompletoAdmin')?.addEventListener('click', () => gerarPDFCompleto());
}
async function atualizarStats() { 
    const todas = await obterTodasOrdenadas(); 
    const total = todas.length, enviados = todas.filter(i=>i.pdfEnviado).length; 
    const stats = document.querySelectorAll('.stat-num'); 
    if(stats[0]) stats[0].textContent=total; 
    if(stats[1]) stats[1].textContent=enviados; 
    if(stats[2]) stats[2].textContent=total-enviados; 
    if(stats[3]) stats[3].textContent=total>0?Math.round((enviados/total)*100):0; 
}

// Eventos e inicialização
document.getElementById('btnGerarInscricao').addEventListener('click', async () => {
    if (!validarFormulario()) return;
    const nome = document.getElementById('nome').value.trim();
    const whatsapp = document.getElementById('whatsapp').value.trim();
    const cidade = document.getElementById('cidade').value.trim();
    const idade = parseInt(document.getElementById('idade').value,10);
    const genero = document.getElementById('genero').value;
    const equipe = document.getElementById('equipe').value.trim();
    const btn = document.getElementById('btnGerarInscricao');
    btn.innerHTML = '<span class="spinner"></span> Confirmando...'; btn.disabled = true;
    try {
        const nova = await criarInscricaoGratuita({ nome, whatsapp, cidade, equipe, idade, genero });
        await mostrarConfirmacao(nova);
        document.getElementById('nome').value = ''; document.getElementById('whatsapp').value = ''; document.getElementById('cidade').value = ''; document.getElementById('equipe').value = ''; document.getElementById('idade').value = ''; document.getElementById('genero').value = '';
        toast('Inscrição gratuita realizada com sucesso!', '#2e7d32');
    } catch (err) { toast('Erro ao salvar: ' + err.message, '#c0392b'); } 
    finally { btn.innerHTML = '<i class="fas fa-ticket-alt"></i> Realizar inscrição gratuita'; btn.disabled = false; }
});

document.getElementById('btnLoginAdmin').addEventListener('click', async () => { document.getElementById('loginErrorMsg').classList.add('hidden'); try { await signInWithEmailAndPassword(auth, document.getElementById('adminEmail').value.trim(), document.getElementById('adminPassword').value); document.getElementById('modalLogin').classList.add('hidden'); } catch { document.getElementById('loginErrorMsg').classList.remove('hidden'); } });
onAuthStateChanged(auth, (user) => { if (user) { adminLogado = true; document.getElementById('tabAdminBtn').classList.remove('tab-hidden'); document.getElementById('adminLogoutContainer').style.display = 'flex'; if (document.getElementById('panel-admin').classList.contains('ativo')) carregarAdminUI(); } else { adminLogado = false; document.getElementById('tabAdminBtn').classList.add('tab-hidden'); document.getElementById('adminLogoutContainer').style.display = 'none'; irParaTab('inscricao'); } });
document.getElementById('btnSairAdmin')?.addEventListener('click', () => signOut(auth));
document.getElementById('btnCancelarLogin').addEventListener('click', () => { document.getElementById('modalLogin').classList.add('hidden'); document.getElementById('loginErrorMsg').classList.add('hidden'); });
document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => btn.addEventListener('click', () => { const tab = btn.dataset.tab; if (tab === 'admin' && !adminLogado) { document.getElementById('modalLogin').classList.remove('hidden'); return; } irParaTab(tab); }));
let clickCount = 0, timeoutAdmin;
document.getElementById('logoSecreto')?.addEventListener('click', () => { clickCount++; clearTimeout(timeoutAdmin); timeoutAdmin = setTimeout(() => clickCount = 0, 800); if (clickCount >= 5) { clickCount = 0; if (adminLogado) irParaTab('admin'); else document.getElementById('modalLogin').classList.remove('hidden'); } });
irParaTab('inscricao');
