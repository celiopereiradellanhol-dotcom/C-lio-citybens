(function() {
    'use strict';
    
    let dados = [];
    let currentEditId = null;
    let itensArray = [];
    let charts = {};

    const LOGIN_USER = "celio";
    const LOGIN_PASS = "102030";

    function isAuthenticated() {
        return localStorage.getItem("citybens_auth") === "true";
    }

    function setAuthenticated(value) {
        if (value) {
            localStorage.setItem("citybens_auth", "true");
        } else {
            localStorage.removeItem("citybens_auth");
        }
    }

    function showLogin() {
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('mainContainer').style.display = 'none';
    }

    function showApp() {
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'block';
        carregarDados();
        atualizarFiltrosSelect();
        aplicarFiltros();
        renderizarGraficos(dados);
    }

    function fazerLogout() {
        setAuthenticated(false);
        showLogin();
        document.getElementById('loginUser').value = '';
        document.getElementById('loginPass').value = '';
    }

    function autenticar() {
        const user = document.getElementById('loginUser').value.trim();
        const pass = document.getElementById('loginPass').value.trim();
        if (user === LOGIN_USER && pass === LOGIN_PASS) {
            setAuthenticated(true);
            showApp();
        } else {
            alert("Usuário ou senha incorretos!");
        }
    }

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
        if (!data) return "atrasado";
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        const partes = data.split('-');
        const ret = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
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

    function calcularTotalVencimentosSemana(dataList) {
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        const fimSemana = new Date(hoje); fimSemana.setDate(hoje.getDate() + 7);
        let total = 0;
        for (const item of dataList) {
            if (item.data_venc && item.status !== "Pago" && item.status !== "Contemplado") {
                const venc = new Date(item.data_venc);
                if (venc >= hoje && venc <= fimSemana) total++;
            }
        }
        return total;
    }

    function calcularValorAtraso(dataList) {
        let totalAtraso = 0;
        for (const item of dataList) {
            if (getSituacaoRetorno(item.data_retorno) === "atrasado" && item.status !== "Pago" && item.status !== "Contemplado") {
                totalAtraso += item.valor;
            }
        }
        return totalAtraso;
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
            document.getElementById('totalVencimentosSemana').innerText = '0';
            document.getElementById('valorAtraso').innerHTML = 'R$ 0,00';
            return;
        }

        document.getElementById('emptyState').style.display = 'none';
        tbody.innerHTML = filtrados.map(item => {
            const statusClass = `status-${String(item.status).toLowerCase()}`;
            return `<tr class="table-row-hover border-b border-gray-700">
                <td class="px-6 py-4 text-sm">${escapeHtml(item.responsavel)}</td>
                <td class="px-6 py-4 text-sm">${escapeHtml(item.empresa)}</td>
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
        const vencimentosSemana = calcularTotalVencimentosSemana(dados);
        const valorAtraso = calcularValorAtraso(dados);
        
        document.getElementById('totalRegistros').innerText = total;
        document.getElementById('totalAlertas').innerText = criticos;
        document.getElementById('valorTotal').innerHTML = 'R$ ' + soma.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('totalVencimentosSemana').innerText = vencimentosSemana;
        document.getElementById('valorAtraso').innerHTML = 'R$ ' + valorAtraso.toLocaleString('pt-BR', {minimumFractionDigits:2});
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
        renderizarGraficos(dados);
    }

    function atualizarFiltrosSelect() {
        const responsaveis = [...new Set(dados.map(d => d.responsavel).filter(Boolean))].sort();
        const empresas = [...new Set(dados.map(d => d.empresa).filter(Boolean))].sort();
        
        document.getElementById('filterResponsavel').innerHTML = '<option value="">Todos</option>' + responsaveis.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
        document.getElementById('filterEmpresa').innerHTML = '<option value="">Todos</option>' + empresas.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join('');
    }

    // ========== GRÁFICOS ==========
    function renderizarGraficos(listaDados) {
        try {
            // 1. Status
            const statusCount = { 'Ativo': 0, 'Pago': 0, 'Contemplado': 0 };
            for (const item of listaDados) {
                if (statusCount.hasOwnProperty(item.status)) statusCount[item.status]++;
                else statusCount['Ativo']++;
            }
            updateChart('chartStatus', 'pie', 
                Object.keys(statusCount), 
                Object.values(statusCount),
                ['#10b981', '#22c55e', '#a855f7']
            );

            // 2. Retorno
            const retornoCount = { 'atrasado': 0, 'hoje': 0, 'futuro': 0 };
            for (const item of listaDados) {
                const sit = getSituacaoRetorno(item.data_retorno);
                retornoCount[sit]++;
            }
            updateChart('chartRetorno', 'pie', 
                ['Atrasado', 'Hoje', 'Futuro'], 
                [retornoCount.atrasado, retornoCount.hoje, retornoCount.futuro],
                ['#ef4444', '#facc15', '#22c55e']
            );

            // 3. Valor por Responsável
            const responsavelValor = new Map();
            for (const item of listaDados) {
                const nome = item.responsavel;
                if (nome) responsavelValor.set(nome, (responsavelValor.get(nome) || 0) + item.valor);
            }
            const sortedResp = [...responsavelValor.entries()].sort((a,b) => b[1] - a[1]).slice(0, 6);
            updateChart('chartResponsavel', 'bar', 
                sortedResp.map(r => r[0]), 
                sortedResp.map(r => r[1]),
                ['#667eea']
            );

            // 4. Registros por Empresa
            const empresaCount = new Map();
            for (const item of listaDados) {
                const nome = item.empresa;
                if (nome) empresaCount.set(nome, (empresaCount.get(nome) || 0) + 1);
            }
            const sortedEmp = [...empresaCount.entries()].sort((a,b) => b[1] - a[1]).slice(0, 6);
            updateChart('chartEmpresa', 'bar', 
                sortedEmp.map(e => e[0]), 
                sortedEmp.map(e => e[1]),
                ['#a855f7']
            );
        } catch (error) {
            console.error("Erro ao renderizar gráficos:", error);
        }
    }

    function updateChart(chartId, type, labels, data, backgroundColor) {
        const canvas = document.getElementById(chartId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (charts[chartId]) {
            charts[chartId].destroy();
            delete charts[chartId];
        }
        if (!labels.length || data.every(v => v === 0)) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#4b5563';
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('Sem dados', canvas.width / 2, canvas.height / 2);
            return;
        }
        charts[chartId] = new Chart(ctx, {
            type: type,
            data: { labels: labels, datasets: [{ data: data, backgroundColor: backgroundColor, borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1', font: { size: 10 } } } } }
        });
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
                <td><input type="number" step="0.01" value="${item.valor}" class="input-field text-xs" onchange="window.updateItemField(${idx}, 'valor', this.value)"></td>
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
    window.fecharModalEditar = function() { document.getElementById('modalEditar').classList.remove('active'); };
    window.fecharVisualizacao = function() { document.getElementById('modalVisualizar').classList.remove('active'); };

    // ========== BACKUP & RESTORE ==========
    function fazerBackup() {
        const backupData = { registros: dados };
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = `citybens_backup_${Date.now()}.json`; a.click();
        URL.revokeObjectURL(a.href);
    }

    function restaurarBackup(arquivo) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const content = JSON.parse(ev.target.result);
                const regs = content.registros || (Array.isArray(content) ? content : []);
                if (confirm(`Restaurar ${regs.length} registros?`)) { dados = regs; salvarLocal(); location.reload(); }
            } catch (err) { alert("Erro no arquivo"); }
        };
        reader.readAsText(arquivo);
    }

    // ========== INIT ==========
    function init() {
        if (isAuthenticated()) {
            showApp();
        } else {
            showLogin();
        }

        document.getElementById('btnLogin')?.addEventListener('click', autenticar);
        document.getElementById('btnLogout')?.addEventListener('click', fazerLogout);

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
            salvarLocal(); atualizarFiltrosSelect(); aplicarFiltros(); window.fecharModalEditar();
        });
        document.getElementById('btnFiltrar')?.addEventListener('click', aplicarFiltros);
        document.getElementById('btnLimpar')?.addEventListener('click', () => {
            document.getElementById('filterResponsavel').value = ''; document.getElementById('filterEmpresa').value = '';
            document.getElementById('filterStatus').value = ''; document.getElementById('filterRetorno').value = '';
            document.getElementById('searchBox').value = ''; aplicarFiltros();
        });
        document.getElementById('searchBox')?.addEventListener('input', aplicarFiltros);
        document.getElementById('btnBackupManual')?.addEventListener('click', fazerBackup);
        document.getElementById('btnRestoreBackup')?.addEventListener('click', () => document.getElementById('restoreFileInput').click());
        document.getElementById('restoreFileInput')?.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) restaurarBackup(e.target.files[0]);
            e.target.value = '';
        });
    }
    init();
})();
