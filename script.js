(function() {
    'use strict';
    
    let dados = [];
    let currentEditId = null;
    let itensArray = [];

    // ========== STORAGE ==========
    function salvarLocal() {
        try {
            localStorage.setItem("citybens_dados", JSON.stringify(dados));
        } catch (e) {
            console.error("Erro ao salvar no localStorage", e);
        }
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
        } catch (e) {
            console.error("Erro ao carregar dados", e);
            dados = [];
        }
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
        const emptyDiv = document.getElementById('emptyState');
        
        if (!tbody) return;

        if (!filtrados || filtrados.length === 0) {
            tbody.innerHTML = '';
            if (emptyDiv) emptyDiv.style.display = 'block';
            document.getElementById('totalRegistros').innerText = '0';
            document.getElementById('totalAlertas').innerText = '0';
            document.getElementById('valorTotal').innerHTML = 'R$ 0,00';
            return;
        }

        if (emptyDiv) emptyDiv.style.display = 'none';
        tbody.innerHTML = filtrados.map(item => {
            const statusLower = String(item.status || "").toLowerCase();
            const statusClass = `status-${statusLower}`;
            const retornoClass = getClasseRetorno(item.data_retorno);
            const retornoTexto = getTextoRetorno(item.data_retorno);
            
            return `<tr class="table-row-hover border-b border-gray-700">
                <td class="px-6 py-4 text-sm">${escapeHtml(item.responsavel)}</td>
                <td class="px-6 py-4 text-sm">${escapeHtml(item.empresa)}</td>
                <td class="px-6 py-4 text-sm text-gray-400">${escapeHtml(item.administradora)}</td>
                <td class="px-6 py-4 text-sm font-semibold">${escapeHtml(item.grupo)}</td>
                <td class="px-6 py-4 text-sm">${escapeHtml(item.cota)}</td>
                <td class="px-6 py-4 text-sm">${formatarData(item.data_venc)}</td>
                <td class="px-6 py-4 text-sm font-semibold text-green-400">R$ ${item.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td class="px-6 py-4 text-sm"><span class="status-badge ${statusClass}">${item.status}</span></td>
                <td class="px-6 py-4 text-sm"><span class="retorno-badge ${retornoClass}">${retornoTexto}</span></td>
                <td class="px-6 py-4 text-sm">
                    <div class="flex gap-2">
                        <button onclick="window.visualizarRegistro(${item.id})" class="action-icon" title="Visualizar"><i class="fas fa-eye"></i></button>
                        <button onclick="window.editarRegistro(${item.id})" class="action-icon" title="Editar"><i class="fas fa-edit"></i></button>
                        <button onclick="window.excluirRegistro(${item.id})" class="action-icon" title="Excluir"><i class="fas fa-trash-alt"></i></button>
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
            
            // Filtro de Status (Case Insensitive)
            if (status && String(item.status || "").toLowerCase() !== status.toLowerCase()) return false;
            
            if (filterSituacao) {
                const sit = getSituacaoRetorno(item.data_retorno);
                if (filterSituacao.includes("Atrasado") && sit !== "atrasado") return false;
                if (filterSituacao.includes("Hoje") && sit !== "hoje") return false;
                if (filterSituacao.includes("Futuro") && sit !== "futuro") return false;
            }
            
            if (busca) {
                const camposParaBusca = [
                    item.responsavel, item.empresa, item.grupo, 
                    item.cota, item.observacao, item.acontecimentos
                ].map(c => String(c || "").toLowerCase());
                if (!camposParaBusca.some(c => c.includes(busca))) return false;
            }
            return true;
        });

        // Ordenação por prioridade de retorno
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
        
        const selectResp = document.getElementById('filterResponsavel');
        const selectEmp = document.getElementById('filterEmpresa');
        
        if (selectResp) {
            const valAnterior = selectResp.value;
            selectResp.innerHTML = '<option value="">Todos</option>' + 
                responsaveis.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
            selectResp.value = responsaveis.includes(valAnterior) ? valAnterior : "";
        }
        
        if (selectEmp) {
            const valAnterior = selectEmp.value;
            selectEmp.innerHTML = '<option value="">Todos</option>' + 
                empresas.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join('');
            selectEmp.value = empresas.includes(valAnterior) ? valAnterior : "";
        }
    }

    function limparFiltros() {
        document.getElementById('filterResponsavel').value = '';
        document.getElementById('filterEmpresa').value = '';
        document.getElementById('filterStatus').value = '';
        document.getElementById('filterRetorno').value = '';
        document.getElementById('searchBox').value = '';
        aplicarFiltros();
    }

    // ========== MODAIS ==========
    function fecharModal() {
        const modal = document.getElementById('modalEditar');
        if (modal) modal.classList.remove('active');
        itensArray = [];
    }

    function fecharVisualizacao() {
        const modal = document.getElementById('modalVisualizar');
        if (modal) modal.classList.remove('active');
    }

    window.fecharModal = fecharModal;
    window.fecharVisualizacao = fecharVisualizacao;

    // ========== EXPOSIÇÃO GLOBAL PARA BOTÕES NA TABELA ==========
    window.visualizarRegistro = function(id) {
        const registro = dados.find(r => r.id === id);
        if (!registro) return;
        
        const container = document.getElementById('visualizarConteudo');
        if (!container) return;

        container.innerHTML = `
            <div class="space-y-1">
                <p class="text-xs text-gray-400 uppercase tracking-wider">Responsável</p>
                <p class="text-white font-semibold">${escapeHtml(registro.responsavel)}</p>
            </div>
            <div class="space-y-1">
                <p class="text-xs text-gray-400 uppercase tracking-wider">Empresa</p>
                <p class="text-white font-semibold">${escapeHtml(registro.empresa)}</p>
            </div>
            <div class="space-y-1">
                <p class="text-xs text-gray-400 uppercase tracking-wider">Administradora</p>
                <p class="text-white font-semibold">${escapeHtml(registro.administradora)}</p>
            </div>
            <div class="space-y-1">
                <p class="text-xs text-gray-400 uppercase tracking-wider">Grupo</p>
                <p class="text-white font-semibold">${escapeHtml(registro.grupo)}</p>
            </div>
            <div class="space-y-1">
                <p class="text-xs text-gray-400 uppercase tracking-wider">Cota</p>
                <p class="text-white font-semibold">${escapeHtml(registro.cota)}</p>
            </div>
            <div class="space-y-1">
                <p class="text-xs text-gray-400 uppercase tracking-wider">Data Vencimento</p>
                <p class="text-white font-semibold">${formatarData(registro.data_venc)}</p>
            </div>
            <div class="space-y-1">
                <p class="text-xs text-gray-400 uppercase tracking-wider">Valor</p>
                <p class="text-green-400 font-bold text-lg">R$ ${registro.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
            </div>
            <div class="space-y-1">
                <p class="text-xs text-gray-400 uppercase tracking-wider">Status</p>
                <span class="status-badge status-${String(registro.status).toLowerCase()}">${registro.status}</span>
            </div>
            <div class="space-y-1">
                <p class="text-xs text-gray-400 uppercase tracking-wider">Canal</p>
                <p class="text-white font-semibold">${escapeHtml(registro.canal)}</p>
            </div>
            <div class="space-y-1">
                <p class="text-xs text-gray-400 uppercase tracking-wider">Data Retorno</p>
                <p class="text-white font-semibold">${formatarData(registro.data_retorno)} <span class="retorno-badge ${getClasseRetorno(registro.data_retorno)}">${getTextoRetorno(registro.data_retorno)}</span></p>
            </div>
            <div class="col-span-2 space-y-1">
                <p class="text-xs text-gray-400 uppercase tracking-wider">Observação</p>
                <p class="text-white text-sm bg-gray-800/50 p-3 rounded-lg border border-gray-700">${escapeHtml(registro.observacao) || '<span class="text-gray-500 italic">Nenhuma observação</span>'}</p>
            </div>
            <div class="col-span-2 space-y-1">
                <p class="text-xs text-gray-400 uppercase tracking-wider">Acontecimentos</p>
                <p class="text-white text-sm bg-gray-800/50 p-3 rounded-lg border border-gray-700">${escapeHtml(registro.acontecimentos) || '<span class="text-gray-500 italic">Nenhum acontecimento registrado</span>'}</p>
            </div>
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
        itensArray = [{
            grupo: reg.grupo,
            cota: reg.cota,
            data_venc: reg.data_venc,
            valor: reg.valor,
            status: reg.status,
            canal: reg.canal,
            data_retorno: reg.data_retorno || '',
            observacao: reg.observacao || '',
            acontecimentos: reg.acontecimentos || ''
        }];
        renderizarItensTabelaModal();
        document.getElementById('modalEditar').classList.add('active');
    };

    window.excluirRegistro = function(id) {
        if (confirm('⚠️ Tem certeza que deseja excluir permanentemente este registro?')) {
            dados = dados.filter(r => r.id !== id);
            salvarLocal();
            atualizarFiltrosSelect();
            aplicarFiltros();
        }
    };

    // ========== FORMULÁRIO DE ITENS NO MODAL ==========
    function renderizarItensTabelaModal() {
        const tbody = document.getElementById('itensBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        itensArray.forEach((item, idx) => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td class="px-2 py-2"><input type="text" value="${escapeHtml(item.grupo)}" class="input-field text-xs" onchange="window.updateItemField(${idx}, 'grupo', this.value)"></td>
                <td class="px-2 py-2"><input type="text" value="${escapeHtml(item.cota)}" class="input-field text-xs" onchange="window.updateItemField(${idx}, 'cota', this.value)"></td>
                <td class="px-2 py-2"><input type="date" value="${item.data_venc}" class="input-field text-xs" onchange="window.updateItemField(${idx}, 'data_venc', this.value)"></td>
                <td class="px-2 py-2"><input type="number" value="${item.valor}" class="input-field text-xs" onchange="window.updateItemField(${idx}, 'valor', this.value)"></td>
                <td class="px-2 py-2">
                    <select class="input-field text-xs" onchange="window.updateItemField(${idx}, 'status', this.value)">
                        <option ${item.status === 'Ativo' ? 'selected' : ''}>Ativo</option>
                        <option ${item.status === 'Pago' ? 'selected' : ''}>Pago</option>
                        <option ${item.status === 'Contemplado' ? 'selected' : ''}>Contemplado</option>
                    </select>
                </td>
                <td class="px-2 py-2"><input type="text" value="${escapeHtml(item.canal)}" class="input-field text-xs" onchange="window.updateItemField(${idx}, 'canal', this.value)"></td>
                <td class="px-2 py-2"><input type="date" value="${item.data_retorno}" class="input-field text-xs" onchange="window.updateItemField(${idx}, 'data_retorno', this.value)"></td>
                <td class="px-2 py-2"><button type="button" class="action-icon text-red-500 hover:bg-red-500/20" onclick="window.removeItem(${idx})"><i class="fas fa-trash"></i></button></td>
            `;
        });
    }

    window.updateItemField = function(idx, field, value) {
        if (itensArray[idx]) {
            itensArray[idx][field] = field === 'valor' ? (parseFloat(value) || 0) : value;
        }
    };

    window.removeItem = function(idx) {
        itensArray.splice(idx, 1);
        if (itensArray.length === 0) adicionarItemVazio();
        renderizarItensTabelaModal();
    };

    function adicionarItemVazio() {
        itensArray.push({ grupo: '', cota: '', data_venc: '', valor: 0, status: 'Ativo', canal: '', data_retorno: '', observacao: '', acontecimentos: '' });
    }

    // ========== INICIALIZAÇÃO ==========
    function init() {
        carregarDados();
        atualizarFiltrosSelect();
        aplicarFiltros();

        // Botões principais
        document.getElementById('btnNovoRegistro')?.addEventListener('click', () => {
            currentEditId = null;
            document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus mr-3 text-green-400"></i>Novo Registro';
            document.getElementById('editResponsavel').value = '';
            document.getElementById('editEmpresa').value = '';
            document.getElementById('editAdministradora').value = '';
            itensArray = [];
            adicionarItemVazio();
            renderizarItensTabelaModal();
            document.getElementById('modalEditar').classList.add('active');
        });

        document.getElementById('btnAdicionarItem')?.addEventListener('click', () => {
            adicionarItemVazio();
            renderizarItensTabelaModal();
        });

        document.getElementById('btnSalvarModal')?.addEventListener('click', () => {
            const resp = document.getElementById('editResponsavel').value.trim();
            const emp = document.getElementById('editEmpresa').value.trim();
            const adm = document.getElementById('editAdministradora').value.trim();
            
            if (!resp || !emp) { alert("⚠️ Preencha Responsável e Empresa."); return; }
            
            const itensValidos = itensArray.filter(i => i.grupo && i.cota && i.data_venc && i.data_retorno);
            if (itensValidos.length === 0) { alert("⚠️ Preencha pelo menos um item com Grupo, Cota, Vencimento e Retorno."); return; }
            
            if (currentEditId) dados = dados.filter(r => r.id !== currentEditId);
            
            itensValidos.forEach(item => {
                dados.push({
                    id: Date.now() + Math.random(),
                    responsavel: resp, empresa: emp, administradora: adm,
                    grupo: item.grupo, cota: item.cota, data_venc: item.data_venc,
                    valor: item.valor, status: item.status, canal: item.canal,
                    data_retorno: item.data_retorno, observacao: item.observacao || '',
                    acontecimentos: item.acontecimentos || ''
                });
            });
            
            salvarLocal();
            atualizarFiltrosSelect();
            aplicarFiltros();
            fecharModal();
        });

        // Eventos de Filtro
        document.getElementById('btnFiltrar')?.addEventListener('click', aplicarFiltros);
        document.getElementById('btnLimpar')?.addEventListener('click', limparFiltros);
        document.getElementById('searchBox')?.addEventListener('input', aplicarFiltros);
        
        // Eventos de Backup
        document.getElementById('btnBackupManual')?.addEventListener('click', () => {
            const data = new Date();
            const backup = { data: data.toISOString(), registros: dados };
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `citybens_backup_${data.getTime()}.json`;
            a.click();
        });

        document.getElementById('btnRestoreBackup')?.addEventListener('click', () => document.getElementById('restoreFileInput').click());
        document.getElementById('restoreFileInput')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const content = JSON.parse(event.target.result);
                    const regs = content.registros || (Array.isArray(content) ? content : []);
                    if (confirm(`Restaurar ${regs.length} registros?`)) {
                        dados = regs;
                        salvarLocal();
                        location.reload();
                    }
                } catch (err) { alert("Arquivo inválido"); }
            };
            reader.readAsText(file);
        });
    }

    // Garantir que o DOM está carregado
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
