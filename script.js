(function() {
    'use strict';
    
    // Aguarda o DOM estar completamente carregado antes de executar qualquer coisa
    document.addEventListener('DOMContentLoaded', function() {
        console.log("DOM carregado. Iniciando sistema...");
        
        let dados = [];
        let currentEditId = null;
        let itensArray = [];
        let charts = {};

        const LOGIN_USER = "celio";
        const LOGIN_PASS = "102030";

        // ========== GERENCIAMENTO DE LOGIN ==========
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
            const loginDiv = document.getElementById('loginContainer');
            const mainDiv = document.getElementById('mainContainer');
            if (loginDiv) loginDiv.style.display = 'flex';
            if (mainDiv) mainDiv.style.display = 'none';
            console.log("Tela de login exibida");
        }

        function showApp() {
            const loginDiv = document.getElementById('loginContainer');
            const mainDiv = document.getElementById('mainContainer');
            if (loginDiv) loginDiv.style.display = 'none';
            if (mainDiv) mainDiv.style.display = 'block';
            console.log("Aplicação principal exibida");
            carregarDados();
            atualizarFiltrosSelect();
            aplicarFiltros();
            renderizarGraficos(dados);
        }

        function fazerLogout() {
            setAuthenticated(false);
            showLogin();
            const userInput = document.getElementById('loginUser');
            const passInput = document.getElementById('loginPass');
            if (userInput) userInput.value = '';
            if (passInput) passInput.value = '';
        }

        function autenticar() {
            console.log("Tentativa de login...");
            const userInput = document.getElementById('loginUser');
            const passInput = document.getElementById('loginPass');
            if (!userInput || !passInput) {
                console.error("Campos de login não encontrados!");
                alert("Erro interno: campos de login não encontrados.");
                return;
            }
            const user = userInput.value.trim();
            const pass = passInput.value.trim();
            console.log(`Usuário: ${user}, Senha: ${pass.length > 0 ? '****' : 'vazia'}`);
            
            if (user === LOGIN_USER && pass === LOGIN_PASS) {
                console.log("Login bem-sucedido!");
                setAuthenticated(true);
                showApp();
            } else {
                console.log("Login falhou: credenciais inválidas");
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
                console.log(`${dados.length} registros carregados.`);
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
                const emptyDiv = document.getElementById('emptyState');
                if (emptyDiv) emptyDiv.style.display = 'block';
                document.getElementById('totalRegistros').innerText = '0';
                document.getElementById('totalAlertas').innerText = '0';
                document.getElementById('valorTotal').innerHTML = 'R$ 0,00';
                document.getElementById('totalVencimentosSemana').innerText = '0';
                document.getElementById('valorAtraso').innerHTML = 'R$ 0,00';
                return;
            }

            const emptyDiv = document.getElementById('emptyState');
            if (emptyDiv) emptyDiv.style.display = 'none';
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
            
            const selectResp = document.getElementById('filterResponsavel');
            const selectEmp = document.getElementById('filterEmpresa');
            if (selectResp) selectResp.innerHTML = '<option value="">Todos</option>' + responsaveis.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
            if (selectEmp) selectEmp.innerHTML = '<option value="">Todos</option>' + empresas.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join('');
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
            const container = document.getElementById('visualizarConteudo');
            if (!container) return;
            container.innerHTML = `
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
            const modal = document.getElementById('modalVisualizar');
            if (modal) modal.classList.add('active');
        };

        window.editarRegistro = function(id) {
            const reg = dados.find(r => r.id === id);
            if (!reg) return;
            currentEditId = id;
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-edit mr-3 text-blue-400"></i>Editar Registro';
            document.getElementById('editResponsavel').value = reg.responsavel;
            document.getElementById('editEmpresa').value = reg.empresa;
            document.getElementById('editAdministradora').value = reg.administradora || '';
            itensArray = [{ ...reg }];
            renderizarItensTabelaModal();
            const modal = document.getElementById('modalEditar');
            if (modal) modal.classList.add('active');
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
        window.fecharModalEditar = function() { 
            const modal = document.getElementById('modalEditar');
            if (modal) modal.classList.remove('active');
        };
        window.fecharVisualizacao = function() { 
            const modal = document.getElementById('modalVisualizar');
            if (modal) modal.classList.remove('active');
        };

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

        // ========== EVENTOS E INICIALIZAÇÃO ==========
        function inicializarEventos() {
            console.log("Inicializando eventos...");
            const btnLogin = document.getElementById('btnLogin');
            if (btnLogin) {
                btnLogin.addEventListener('click', autenticar);
                console.log("Evento de login adicionado");
            } else {
                console.error("Botão btnLogin não encontrado!");
            }
            
            const btnLogout = document.getElementById('btnLogout');
            if (btnLogout) btnLogout.addEventListener('click', fazerLogout);
            
            const btnNovo = document.getElementById('btnNovoRegistro');
            if (btnNovo) btnNovo.addEventListener('click', () => {
                currentEditId = null;
                const modalTitle = document.getElementById('modalTitle');
                if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-plus mr-3 text-green-400"></i>Novo Registro';
                document.getElementById('editResponsavel').value = '';
                document.getElementById('editEmpresa').value = '';
                document.getElementById('editAdministradora').value = '';
                itensArray = []; adicionarItemVazio(); renderizarItensTabelaModal();
                const modal = document.getElementById('modalEditar');
                if (modal) modal.classList.add('active');
            });
            
            const btnAddItem = document.getElementById('btnAdicionarItem');
            if (btnAddItem) btnAddItem.addEventListener('click', () => { adicionarItemVazio(); renderizarItensTabelaModal(); });
            
            const btnSalvar = document.getElementById('btnSalvarModal');
            if (btnSalvar) btnSalvar.addEventListener('click', () => {
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
            
            const btnFiltrar = document.getElementById('btnFiltrar');
            if (btnFiltrar) btnFiltrar.addEventListener('click', aplicarFiltros);
            
            const btnLimpar = document.getElementById('btnLimpar');
            if (btnLimpar) btnLimpar.addEventListener('click', () => {
                document.getElementById('filterResponsavel').value = ''; 
                document.getElementById('filterEmpresa').value = '';
                document.getElementById('filterStatus').value = ''; 
                document.getElementById('filterRetorno').value = '';
                document.getElementById('searchBox').value = ''; 
                aplicarFiltros();
            });
            
            const searchBox = document.getElementById('searchBox');
            if (searchBox) searchBox.addEventListener('input', aplicarFiltros);
            
            const btnBackup = document.getElementById('btnBackupManual');
            if (btnBackup) btnBackup.addEventListener('click', fazerBackup);
            
            const btnRestore = document.getElementById('btnRestoreBackup');
            const fileInput = document.getElementById('restoreFileInput');
            if (btnRestore && fileInput) {
                btnRestore.addEventListener('click', () => fileInput.click());
                fileInput.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files[0]) restaurarBackup(e.target.files[0]);
                    e.target.value = '';
                });
            }
        }

        // Ponto de partida
        if (isAuthenticated()) {
            showApp();
        } else {
            showLogin();
        }
        inicializarEventos();
    });
})();
