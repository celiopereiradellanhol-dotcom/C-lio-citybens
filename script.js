(function() {
    'use strict';
    
    let dados = [];
    let currentEditId = null;
    let itensArray = [];

    // ========== STORAGE ==========
    function salvarLocal() {
        try {
            localStorage.setItem("citybens_dados", JSON.stringify(dados));
        } catch (e) { console.error(e); }
    }

    function carregarDados() {
        try {
            const saved = localStorage.getItem("citybens_dados");
            dados = saved ? JSON.parse(saved) : [];
            dados = dados.map(reg => ({
                id: reg.id || Date.now() + Math.random(),
                responsavel: String(reg.responsavel || "").trim(),
                empresa: String(reg.empresa || "").trim(),
                administradora: String(reg.administradora || "").trim(),
                grupo: String(reg.grupo || "").trim(),
                cota: String(reg.cota || "").trim(),
                data_venc: reg.data_venc || "",
                valor: parseFloat(reg.valor) || 0,
                status: String(reg.status || "Ativo").trim(),
                canal: String(reg.canal || "").trim(),
                data_retorno: reg.data_retorno || "",
                observacao: String(reg.observacao || "").trim(),
                acontecimentos: String(reg.acontecimentos || "").trim()
            }));
        } catch (e) { dados = []; }
    }

    // ========== UTILITIES ==========
    function formatarData(dataStr) {
        if (!dataStr) return "-";
        const partes = dataStr.split("-");
        return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : dataStr;
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function getSituacaoRetorno(data) {
        if (!data) return "futuro";
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        const ret = new Date(data); ret.setHours(0,0,0,0);
        if (ret < hoje) return "atrasado";
        if (ret.getTime() === hoje.getTime()) return "hoje";
        return "futuro";
    }

    function getClasseRetorno(data) {
        const s = getSituacaoRetorno(data);
        if (s === "atrasado") return "retorno-atrasado";
        if (s === "hoje") return "retorno-hoje";
        return "retorno-futuro";
    }

    function getTextoRetorno(data) {
        const s = getSituacaoRetorno(data);
        if (s === "atrasado") return "🔴 Atrasado";
        if (s === "hoje") return "🟡 Hoje";
        return "🟢 Futuro";
    }

    // ========== RENDER TABLE ==========
    function renderizarTabela(filtrados) {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;

        if (!filtrados || filtrados.length === 0) {
            tbody.innerHTML = '';
            document.getElementById('emptyState').style.display = 'block';
            document.getElementById('totalRegistros').innerText = '0';
            document.getElementById('totalAlertas').innerText = '0';
            document.getElementById('valorTotal').innerHTML = 'R$ 0,00';
            return;
        }

        document.getElementById('emptyState').style.display = 'none';
        tbody.innerHTML = filtrados.map(item => {
            const statusClass = `status-${String(item.status).toLowerCase()}`;
            return `<tr class="table-row-hover border-b border-gray-700">
                <td class="px-6 py-4 text-sm">${escapeHtml(item.responsavel)}</td>
                <td class="px-6 py-4 text-sm">${escapeHtml(item.empresa)}</td>
                <td class="px-6 py-4 text-sm text-gray-400">${escapeHtml(item.administradora)}</td>
                <td class="px-6 py-4 text-sm font-semibold">${escapeHtml(item.grupo)}</td>
                <td class="px-6 py-4 text-sm">${escapeHtml(item.cota)}</td>
                <td class="px-6 py-4 text-sm">${formatarData(item.data_venc)}</td>
                <td class="px-6 py-4 text-sm font-semibold text-green-400">R$ ${item.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td class="px-6 py-4 text-sm"><span class="status-badge ${statusClass}">${item.status}</span></td>
                <td class="px-6 py-4 text-sm"><span class="retorno-badge ${getClasseRetorno(item.data_retorno)}">${getTextoRetorno(item.data_retorno)}</span></td>
                <td class="px-6 py-4 text-sm">
                    <div class="flex gap-2">
                        <button onclick="window.visualizarRegistro(${item.id})" class="action-icon"><i class="fas fa-eye"></i></button>
                        <button onclick="window.editarRegistro(${item.id})" class="action-icon"><i class="fas fa-edit"></i></button>
                        <button onclick="window.excluirRegistro(${item.id})" class="action-icon"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        const total = filtrados.length;
        const criticos = filtrados.filter(f => getSituacaoRetorno(f.data_retorno) !== "futuro").length;
        const soma = filtrados.reduce((acc, f) => acc + (f.valor || 0), 0);
        
        document.getElementById('totalRegistros').innerText = total;
        document.getElementById('totalAlertas').innerText = criticos;
        document.getElementById('valorTotal').innerHTML = 'R$ ' + soma.toLocaleString('pt-BR', {minimumFractionDigits:2});
    }

    function aplicarFiltros() {
        const resp = document.getElementById('filterResponsavel').value;
        const empresa = document.getElementById('filterEmpresa').value;
        const status = document.getElementById('filterStatus').value;
        const filterSituacao = document.getElementById('filterRetorno').value;
        const busca = document.getElementById('searchBox').value.toLowerCase().trim();

        let filtrados = dados.filter(item => {
            if (resp && item.responsavel !== resp) return false;
            if (empresa && item.empresa !== empresa) return false;
            if (status && String(item.status || "").toLowerCase() !== status.toLowerCase()) return false;
            if (filterSituacao) {
                const sit = getSituacaoRetorno(item.data_retorno);
                if (filterSituacao.includes("Atrasado") && sit !== "atrasado") return false;
                if (filterSituacao.includes("Hoje") && sit !== "hoje") return false;
                if (filterSituacao.includes("Futuro") && sit !== "futuro") return false;
            }
            if (busca) {
                const campos = [item.responsavel, item.empresa, item.grupo, item.cota, item.observacao, item.acontecimentos].map(c => String(c || "").toLowerCase());
                if (!campos.some(c => c.includes(busca))) return false;
            }
            return true;
        });

        filtrados.sort((a, b) => {
            const prioA = getSituacaoRetorno(a.data_retorno) === "atrasado" ? 0 : (getSituacaoRetorno(a.data_retorno) === "hoje" ? 1 : 2);
            const prioB = getSituacaoRetorno(b.data_retorno) === "atrasado" ? 0 : (getSituacaoRetorno(b.data_retorno) === "hoje" ? 1 : 2);
            if (prioA !== prioB) return prioA - prioB;
            return (a.data_retorno || "").localeCompare(b.data_retorno || "");
        });

        renderizarTabela(filtrados);
    }

    function atualizarFiltrosSelect() {
        const responsaveis = [...new Set(dados.map(d => d.responsavel).filter(Boolean))].sort();
        const empresas = [...new Set(dados.map(d => d.empresa).filter(Boolean))].sort();
        
        document.getElementById('filterResponsavel').innerHTML = '<option value="">Todos</option>' + responsaveis.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
        document.getElementById('filterEmpresa').innerHTML = '<option value="">Todos</option>' + empresas.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join('');
    }

    // ========== MODAIS ==========
    window.visualizarRegistro = function(id) {
        const r = dados.find(reg => reg.id === id);
        if (!r) return;
        document.getElementById('visualizarConteudo').innerHTML = `
            <div class="space-y-1"><p class="text-xs text-gray-400 uppercase">Responsável</p><p class="text-white font-semibold">${escapeHtml(r.responsavel)}</p></div>
            <div class="space-y-1"><p class="text-xs text-gray-400 uppercase">Empresa</p><p class="text-white font-semibold">${escapeHtml(r.empresa)}</p></div>
            <div class="space-y-1"><p class="text-xs text-gray-400 uppercase">Administradora</p><p class="text-white font-semibold">${escapeHtml(r.administradora)}</p></div>
            <div class="space-y-1"><p class="text-xs text-gray-400 uppercase">Grupo / Cota</p><p class="text-white font-semibold">${escapeHtml(r.grupo)} / ${escapeHtml(r.cota)}</p></div>
            <div class="space-y-1"><p class="text-xs text-gray-400 uppercase">Vencimento</p><p class="text-white font-semibold">${formatarData(r.data_venc)}</p></div>
            <div class="space-y-1"><p class="text-xs text-gray-400 uppercase">Valor</p><p class="text-green-400 font-bold">R$ ${r.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}</p></div>
            <div class="space-y-1"><p class="text-xs text-gray-400 uppercase">Status</p><span class="status-badge status-${String(r.status).toLowerCase()}">${r.status}</span></div>
            <div class="space-y-1"><p class="text-xs text-gray-400 uppercase">Data Retorno</p><p class="text-white font-semibold">${formatarData(r.data_retorno)} <span class="retorno-badge ${getClasseRetorno(r.data_retorno)}">${getTextoRetorno(r.data_retorno)}</span></p></div>
            <div class="col-span-2"><p class="text-xs text-gray-400 uppercase mb-1">Observação</p><div class="bg-gray-800/50 p-3 rounded-lg border border-gray-700 text-sm">${escapeHtml(r.observacao) || '---'}</div></div>
            <div class="col-span-2"><p class="text-xs text-gray-400 uppercase mb-1">Acontecimentos</p><div class="bg-gray-800/50 p-3 rounded-lg border border-gray-700 text-sm whitespace-pre-wrap">${escapeHtml(r.acontecimentos) || '---'}</div></div>
        `;
        document.getElementById('modalVisualizar').classList.add('active');
    };

    window.editarRegistro = function(id) {
        const reg = dados.find(r => r.id === id);
        if (!reg) return;
        currentEditId = id;
        document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit mr-3 text-blue-400"></i>Editar Registro';
        document.getElementById('editResponsavel').value = reg.responsavel;
        document.getElementById('editEmpresa').value = reg.empresa;
        document.getElementById('editAdministradora').value = reg.administradora || '';
        itensArray = [{ ...reg }];
        renderizarItensTabelaModal();
        document.getElementById('modalEditar').classList.add('active');
    };

    window.excluirRegistro = function(id) {
        if (confirm('⚠️ Excluir permanentemente?')) {
            dados = dados.filter(r => r.id !== id);
            salvarLocal(); atualizarFiltrosSelect(); aplicarFiltros();
        }
    };

    // ========== ITENS NO MODAL ==========
    function renderizarItensTabelaModal() {
        const tbody = document.getElementById('itensBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        itensArray.forEach((item, idx) => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td><input type="text" value="${escapeHtml(item.grupo)}" class="input-field text-xs" onchange="window.updateItemField(${idx}, 'grupo', this.value)"></td>
                <td><input type="text" value="${escapeHtml(item.cota)}" class="input-field text-xs" onchange="window.updateItemField(${idx}, 'cota', this.value)"></td>
                <td><input type="date" value="${item.data_venc}" class="input-field text-xs" onchange="window.updateItemField(${idx}, 'data_venc', this.value)"></td>
                <td><input type="number" value="${item.valor}" class="input-field text-xs" onchange="window.updateItemField(${idx}, 'valor', this.value)"></td>
                <td>
                    <select class="input-field text-xs" onchange="window.updateItemField(${idx}, 'status', this.value)">
                        <option ${item.status === 'Ativo' ? 'selected' : ''}>Ativo</option>
                        <option ${item.status === 'Pago' ? 'selected' : ''}>Pago</option>
                        <option ${item.status === 'Contemplado' ? 'selected' : ''}>Contemplado</option>
                    </select>
                </td>
                <td><input type="text" value="${escapeHtml(item.canal)}" class="input-field text-xs" onchange="window.updateItemField(${idx}, 'canal', this.value)"></td>
                <td><input type="date" value="${item.data_retorno}" class="input-field text-xs" onchange="window.updateItemField(${idx}, 'data_retorno', this.value)"></td>
                <td>
                    <div class="flex flex-col gap-1">
                        <input type="text" placeholder="Obs..." value="${escapeHtml(item.observacao)}" class="textarea-field" onchange="window.updateItemField(${idx}, 'observacao', this.value)">
                        <textarea placeholder="Acontecimentos..." class="textarea-field" onchange="window.updateItemField(${idx}, 'acontecimentos', this.value)">${escapeHtml(item.acontecimentos)}</textarea>
                    </div>
                </td>
                <td><button type="button" class="action-icon text-red-500" onclick="window.removeItem(${idx})"><i class="fas fa-trash"></i></button></td>
            `;
        });
    }

    window.updateItemField = (idx, field, val) => { if (itensArray[idx]) itensArray[idx][field] = field === 'valor' ? (parseFloat(val) || 0) : val; };
    window.removeItem = (idx) => { itensArray.splice(idx, 1); if (itensArray.length === 0) adicionarItemVazio(); renderizarItensTabelaModal(); };
    function adicionarItemVazio() { itensArray.push({ grupo: '', cota: '', data_venc: '', valor: 0, status: 'Ativo', canal: '', data_retorno: '', observacao: '', acontecimentos: '' }); }
    function fecharModal() { document.getElementById('modalEditar').classList.remove('active'); }
    function fecharVisualizacao() { document.getElementById('modalVisualizar').classList.remove('active'); }
    window.fecharModal = fecharModal; window.fecharVisualizacao = fecharVisualizacao;

    // ========== INIT ==========
    function init() {
        carregarDados(); atualizarFiltrosSelect(); aplicarFiltros();
        document.getElementById('btnNovoRegistro')?.addEventListener('click', () => {
            currentEditId = null;
            document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus mr-3 text-green-400"></i>Novo Registro';
            document.getElementById('editResponsavel').value = '';
            document.getElementById('editEmpresa').value = '';
            document.getElementById('editAdministradora').value = '';
            itensArray = []; adicionarItemVazio(); renderizarItensTabelaModal();
            document.getElementById('modalEditar').classList.add('active');
        });
        document.getElementById('btnAdicionarItem')?.addEventListener('click', () => { adicionarItemVazio(); renderizarItensTabelaModal(); });
        document.getElementById('btnSalvarModal')?.addEventListener('click', () => {
            const resp = document.getElementById('editResponsavel').value.trim();
            const emp = document.getElementById('editEmpresa').value.trim();
            const adm = document.getElementById('editAdministradora').value.trim();
            if (!resp || !emp) { alert("Preencha Responsável e Empresa."); return; }
            const itensValidos = itensArray.filter(i => i.grupo && i.cota && i.data_venc && i.data_retorno);
            if (itensValidos.length === 0) { alert("Preencha os campos obrigatórios dos itens."); return; }
            if (currentEditId) dados = dados.filter(r => r.id !== currentEditId);
            itensValidos.forEach(item => {
                dados.push({ id: Date.now() + Math.random(), responsavel: resp, empresa: emp, administradora: adm, ...item });
            });
            salvarLocal(); atualizarFiltrosSelect(); aplicarFiltros(); fecharModal();
        });
        document.getElementById('btnFiltrar')?.addEventListener('click', aplicarFiltros);
        document.getElementById('btnLimpar')?.addEventListener('click', () => {
            document.getElementById('filterResponsavel').value = ''; document.getElementById('filterEmpresa').value = '';
            document.getElementById('filterStatus').value = ''; document.getElementById('filterRetorno').value = '';
            document.getElementById('searchBox').value = ''; aplicarFiltros();
        });
        document.getElementById('searchBox')?.addEventListener('input', aplicarFiltros);
        document.getElementById('btnBackupManual')?.addEventListener('click', () => {
            const blob = new Blob([JSON.stringify({ registros: dados }, null, 2)], { type: "application/json" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
            a.download = `citybens_backup_${Date.now()}.json`; a.click();
        });
        document.getElementById('btnRestoreBackup')?.addEventListener('click', () => document.getElementById('restoreFileInput').click());
        document.getElementById('restoreFileInput')?.addEventListener('change', (e) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const content = JSON.parse(ev.target.result);
                    const regs = content.registros || (Array.isArray(content) ? content : []);
                    if (confirm(`Restaurar ${regs.length} registros?`)) { dados = regs; salvarLocal(); location.reload(); }
                } catch (err) { alert("Erro no arquivo"); }
            };
            reader.readAsText(e.target.files[0]);
        });
    }
    init();
})();
