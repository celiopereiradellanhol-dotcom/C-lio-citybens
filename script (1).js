(function() {
    'use strict';
    
    let dados = [];
    let currentEditId = null;
    let itensArray = [];

    // ========== STORAGE ==========
    function salvarLocal() {
        localStorage.setItem("citybens_dados", JSON.stringify(dados));
    }

    function carregarDados() {
        const saved = localStorage.getItem("citybens_dados");
        dados = saved ? JSON.parse(saved) : [];
        dados = dados.map(reg => ({
            id: reg.id || Date.now() + Math.random(),
            responsavel: reg.responsavel || "",
            empresa: reg.empresa || "",
            administradora: reg.administradora || "",
            grupo: reg.grupo || "",
            cota: reg.cota || "",
            data_venc: reg.data_venc || "",
            valor: parseFloat(reg.valor) || 0,
            status: reg.status || "Ativo",
            canal: reg.canal || "",
            data_retorno: reg.data_retorno || "",
            observacao: reg.observacao || "",
            acontecimentos: reg.acontecimentos || ""
        }));
    }

    // ========== BACKUP & RESTORE ==========
    function fazerBackup() {
        const data = new Date();
        const nome = `citybens_backup_${data.getFullYear()}-${String(data.getMonth()+1).padStart(2,'0')}-${String(data.getDate()).padStart(2,'0')}.json`;
        const backup = { data_exportacao: data.toISOString(), versao: "2.0", registros: dados };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nome;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        const btn = document.getElementById("btnBackupManual");
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check mr-2"></i>Backup salvo!';
        setTimeout(() => { btn.innerHTML = original; }, 2000);
    }

    function restaurarBackup(arquivo) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const conteudo = JSON.parse(e.target.result);
                let registros = conteudo.registros || (Array.isArray(conteudo) ? conteudo : []);
                
                registros = registros.map(reg => ({
                    id: reg.id || Date.now() + Math.random(),
                    responsavel: reg.responsavel || "",
                    empresa: reg.empresa || "",
                    administradora: reg.administradora || "",
                    grupo: reg.grupo || "",
                    cota: reg.cota || "",
                    data_venc: reg.data_venc || "",
                    valor: parseFloat(reg.valor) || 0,
                    status: reg.status || "Ativo",
                    canal: reg.canal || "",
                    data_retorno: reg.data_retorno || "",
                    observacao: reg.observacao || "",
                    acontecimentos: reg.acontecimentos || ""
                }));

                if (confirm(`Restaurar ${registros.length} registros? Os dados atuais serão substituídos.`)) {
                    dados = registros;
                    salvarLocal();
                    atualizarFiltrosSelect();
                    aplicarFiltros();
                    alert("✅ Backup restaurado com sucesso!");
                }
            } catch(err) {
                alert("❌ Erro: arquivo inválido ou corrompido.");
            }
        };
        reader.onerror = () => alert("❌ Erro ao ler arquivo.");
        reader.readAsText(arquivo);
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
        
        if (!filtrados.length) {
            tbody.innerHTML = '';
            emptyDiv.style.display = 'block';
            document.getElementById('totalRegistros').innerText = '0';
            document.getElementById('totalAlertas').innerText = '0';
            document.getElementById('valorTotal').innerHTML = 'R$ 0';
            return;
        }

        emptyDiv.style.display = 'none';
        tbody.innerHTML = filtrados.map(item => {
            const statusClass = `status-${item.status.toLowerCase()}`;
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
                <td class="px-6 py-4 text-sm flex gap-2">
                    <button onclick="window.visualizarRegistro(${item.id})" class="action-icon" title="Visualizar"><i class="fas fa-eye"></i></button>
                    <button onclick="window.editarRegistro(${item.id})" class="action-icon" title="Editar"><i class="fas fa-edit"></i></button>
                    <button onclick="window.excluirRegistro(${item.id})" class="action-icon" title="Excluir"><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>`;
        }).join('');

        const total = filtrados.length;
        const criticos = filtrados.filter(f => getSituacaoRetorno(f.data_retorno) !== "futuro").length;
        const soma = filtrados.reduce((acc, f) => acc + f.valor, 0);
        
        document.getElementById('totalRegistros').innerText = total;
        document.getElementById('totalAlertas').innerText = criticos;
        document.getElementById('valorTotal').innerHTML = 'R$ ' + soma.toLocaleString('pt-BR', {maximumFractionDigits:2});
    }

    function aplicarFiltros() {
        const resp = document.getElementById('filterResponsavel').value;
        const empresa = document.getElementById('filterEmpresa').value;
        const status = document.getElementById('filterStatus').value;
        const filterSituacao = document.getElementById('filterRetorno').value;
        const busca = document.getElementById('searchBox').value.toLowerCase();

        let filtrados = dados.filter(item => {
            if (resp && item.responsavel !== resp) return false;
            if (empresa && item.empresa !== empresa) return false;
            if (status && item.status !== status) return false;
            if (filterSituacao) {
                const sit = getSituacaoRetorno(item.data_retorno);
                if (filterSituacao === "🔴 Atrasado" && sit !== "atrasado") return false;
                if (filterSituacao === "🟡 Hoje" && sit !== "hoje") return false;
                if (filterSituacao === "🟢 Futuro" && sit !== "futuro") return false;
            }
            if (busca) {
                const campos = [item.grupo, item.cota, item.observacao, item.acontecimentos].map(c => (c || "").toLowerCase());
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
        const responsaveis = [...new Set(dados.map(d => d.responsavel).filter(Boolean))];
        const empresas = [...new Set(dados.map(d => d.empresa).filter(Boolean))];
        
        document.getElementById('filterResponsavel').innerHTML = '<option value="">Todos</option>' + 
            responsaveis.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
        document.getElementById('filterEmpresa').innerHTML = '<option value="">Todos</option>' + 
            empresas.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join('');
    }

    function limparFiltros() {
        document.getElementById('filterResponsavel').value = '';
        document.getElementById('filterEmpresa').value = '';
        document.getElementById('filterStatus').value = '';
        document.getElementById('filterRetorno').value = '';
        document.getElementById('searchBox').value = '';
        aplicarFiltros();
    }

    // ========== VIEW DETAILS ==========
    function abrirVisualizacao(registro) {
        const container = document.getElementById('visualizarConteudo');
        container.innerHTML = `
            <div>
                <p class="text-xs text-gray-400 uppercase tracking-wider mb-1">Responsável</p>
                <p class="text-white font-semibold">${escapeHtml(registro.responsavel)}</p>
            </div>
            <div>
                <p class="text-xs text-gray-400 uppercase tracking-wider mb-1">Empresa</p>
                <p class="text-white font-semibold">${escapeHtml(registro.empresa)}</p>
            </div>
            <div>
                <p class="text-xs text-gray-400 uppercase tracking-wider mb-1">Administradora</p>
                <p class="text-white font-semibold">${escapeHtml(registro.administradora)}</p>
            </div>
            <div>
                <p class="text-xs text-gray-400 uppercase tracking-wider mb-1">Grupo</p>
                <p class="text-white font-semibold">${escapeHtml(registro.grupo)}</p>
            </div>
            <div>
                <p class="text-xs text-gray-400 uppercase tracking-wider mb-1">Cota</p>
                <p class="text-white font-semibold">${escapeHtml(registro.cota)}</p>
            </div>
            <div>
                <p class="text-xs text-gray-400 uppercase tracking-wider mb-1">Data Vencimento</p>
                <p class="text-white font-semibold">${formatarData(registro.data_venc)}</p>
            </div>
            <div>
                <p class="text-xs text-gray-400 uppercase tracking-wider mb-1">Valor (R$)</p>
                <p class="text-green-400 font-bold text-lg">R$ ${registro.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
            </div>
            <div>
                <p class="text-xs text-gray-400 uppercase tracking-wider mb-1">Status</p>
                <span class="status-badge status-${registro.status.toLowerCase()}">${registro.status}</span>
            </div>
            <div>
                <p class="text-xs text-gray-400 uppercase tracking-wider mb-1">Canal</p>
                <p class="text-white font-semibold">${escapeHtml(registro.canal)}</p>
            </div>
            <div>
                <p class="text-xs text-gray-400 uppercase tracking-wider mb-1">Data Retorno</p>
                <p class="text-white font-semibold">${formatarData(registro.data_retorno)} <span class="retorno-badge ${getClasseRetorno(registro.data_retorno)}">${getTextoRetorno(registro.data_retorno)}</span></p>
            </div>
            <div class="col-span-2">
                <p class="text-xs text-gray-400 uppercase tracking-wider mb-1">Observação</p>
                <p class="text-white">${escapeHtml(registro.observacao)}</p>
            </div>
            <div class="col-span-2">
                <p class="text-xs text-gray-400 uppercase tracking-wider mb-1">Acontecimentos</p>
                <p class="text-white">${escapeHtml(registro.acontecimentos)}</p>
            </div>
        `;
        document.getElementById('modalVisualizar').classList.add('active');
    }

    window.visualizarRegistro = function(id) {
        const registro = dados.find(r => r.id === id);
        if (registro) abrirVisualizacao(registro);
    };

    // ========== EDIT MODAL ==========
    function renderizarItensTabelaModal() {
        const tbody = document.getElementById('itensBody');
        tbody.innerHTML = '';
        
        itensArray.forEach((item, idx) => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td class="px-3 py-2"><input type="text" value="${escapeHtml(item.grupo)}" class="input-field text-xs" onchange="itensArray[${idx}].grupo = this.value"></td>
                <td class="px-3 py-2"><input type="text" value="${escapeHtml(item.cota)}" class="input-field text-xs" onchange="itensArray[${idx}].cota = this.value"></td>
                <td class="px-3 py-2"><input type="date" value="${item.data_venc}" class="input-field text-xs" onchange="itensArray[${idx}].data_venc = this.value"></td>
                <td class="px-3 py-2"><input type="number" value="${item.valor}" class="input-field text-xs" onchange="itensArray[${idx}].valor = parseFloat(this.value) || 0"></td>
                <td class="px-3 py-2">
                    <select class="input-field text-xs" onchange="itensArray[${idx}].status = this.value">
                        <option ${item.status === 'Ativo' ? 'selected' : ''}>Ativo</option>
                        <option ${item.status === 'Pago' ? 'selected' : ''}>Pago</option>
                        <option ${item.status === 'Contemplado' ? 'selected' : ''}>Contemplado</option>
                    </select>
                </td>
                <td class="px-3 py-2"><input type="text" value="${escapeHtml(item.canal)}" class="input-field text-xs" onchange="itensArray[${idx}].canal = this.value"></td>
                <td class="px-3 py-2"><input type="date" value="${item.data_retorno}" class="input-field text-xs" onchange="itensArray[${idx}].data_retorno = this.value"></td>
                <td class="px-3 py-2"><button type="button" class="btn-base btn-danger text-xs" onclick="itensArray.splice(${idx}, 1); renderizarItensTabelaModal();"><i class="fas fa-trash"></i></button></td>
            `;
        });

        if (itensArray.length === 0) adicionarItemVazioModal();
    }

    function adicionarItemVazioModal() {
        itensArray.push({ grupo: '', cota: '', data_venc: '', valor: 0, status: 'Ativo', canal: '', data_retorno: '', observacao: '', acontecimentos: '' });
        renderizarItensTabelaModal();
    }

    function novoRegistro() {
        currentEditId = null;
        document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus mr-3 text-green-400"></i>Novo Registro';
        document.getElementById('editResponsavel').value = '';
        document.getElementById('editEmpresa').value = '';
        document.getElementById('editAdministradora').value = '';
        itensArray = [];
        adicionarItemVazioModal();
        document.getElementById('modalEditar').classList.add('active');
    }

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

    function salvarEdicao() {
        const resp = document.getElementById('editResponsavel').value.trim();
        const emp = document.getElementById('editEmpresa').value.trim();
        const adm = document.getElementById('editAdministradora').value.trim();
        
        if (!resp || !emp) { alert("⚠️ Preencha Responsável e Empresa."); return; }
        const itensValidos = itensArray.filter(i => i.grupo && i.cota && i.data_venc && i.data_retorno);
        if (itensValidos.length === 0) { alert("⚠️ Adicione pelo menos um item completo."); return; }
        
        if (currentEditId) dados = dados.filter(r => r.id !== currentEditId);
        
        for (let item of itensValidos) {
            dados.push({
                id: Date.now() + Math.random(),
                responsavel: resp,
                empresa: emp,
                administradora: adm,
                grupo: item.grupo,
                cota: item.cota,
                data_venc: item.data_venc,
                valor: item.valor,
                status: item.status,
                canal: item.canal,
                data_retorno: item.data_retorno,
                observacao: item.observacao || '',
                acontecimentos: item.acontecimentos || ''
            });
        }
        
        salvarLocal();
        atualizarFiltrosSelect();
        aplicarFiltros();
        fecharModal();
        alert("✅ Registro salvo com sucesso!");
    }

    window.excluirRegistro = function(id) {
        if (confirm('⚠️ Excluir permanentemente este registro?')) {
            dados = dados.filter(r => r.id !== id);
            salvarLocal();
            atualizarFiltrosSelect();
            aplicarFiltros();
            alert("✅ Registro excluído!");
        }
    };

    function fecharModal() {
        document.getElementById('modalEditar').classList.remove('active');
        itensArray = [];
    }

    function fecharVisualizacao() {
        document.getElementById('modalVisualizar').classList.remove('active');
    }

    window.fecharModal = fecharModal;
    window.fecharVisualizacao = fecharVisualizacao;
    window.renderizarItensTabelaModal = renderizarItensTabelaModal;

    // ========== INIT ==========
    function init() {
        carregarDados();
        atualizarFiltrosSelect();
        aplicarFiltros();

        document.getElementById('btnNovoRegistro').addEventListener('click', novoRegistro);
        document.getElementById('btnCancelarModal').addEventListener('click', fecharModal);
        document.getElementById('btnSalvarModal').addEventListener('click', salvarEdicao);
        document.getElementById('btnAdicionarItem').addEventListener('click', adicionarItemVazioModal);
        document.getElementById('btnFiltrar').addEventListener('click', aplicarFiltros);
        document.getElementById('btnLimpar').addEventListener('click', limparFiltros);
        document.getElementById('btnBackupManual').addEventListener('click', fazerBackup);
        document.getElementById('btnRestoreBackup').addEventListener('click', () => document.getElementById('restoreFileInput').click());
        document.getElementById('restoreFileInput').addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) restaurarBackup(e.target.files[0]);
            e.target.value = '';
        });
        document.getElementById('searchBox').addEventListener('keypress', (e) => { if (e.key === 'Enter') aplicarFiltros(); });

        // Close modals on overlay click
        document.getElementById('modalEditar').addEventListener('click', (e) => {
            if (e.target.id === 'modalEditar') fecharModal();
        });
        document.getElementById('modalVisualizar').addEventListener('click', (e) => {
            if (e.target.id === 'modalVisualizar') fecharVisualizacao();
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
