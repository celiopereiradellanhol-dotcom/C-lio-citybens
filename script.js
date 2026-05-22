// ========== CONFIGURAÇÃO DO SUPABASE ==========
// COLE AQUI SUA URL E SUA ANON KEY (do passo 1)
const SUPABASE_URL = "SUA_URL_DO_SUPABASE";    // exemplo: https://xyzabc.supabase.co
const SUPABASE_ANON_KEY = "SUA_ANON_KEY";      // chave pública longa

// Inicializa o cliente Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== SISTEMA PRINCIPAL ==========
(function() {
    'use strict';
    
    document.addEventListener('DOMContentLoaded', function() {
        console.log("DOM carregado. Conectando ao Supabase...");
        
        let dados = [];               // dados carregados do Supabase
        let currentEditId = null;
        let itensArray = [];
        let charts = {};

        // ========== GERENCIAMENTO DE LOGIN (com Supabase) ==========
        function isAuthenticated() {
            return localStorage.getItem("citybens_session") === "true";
        }

        function setAuthenticated(value) {
            if (value) localStorage.setItem("citybens_session", "true");
            else localStorage.removeItem("citybens_session");
        }

        function showLogin() {
            document.getElementById('loginContainer').style.display = 'flex';
            document.getElementById('mainContainer').style.display = 'none';
        }

        function showApp() {
            document.getElementById('loginContainer').style.display = 'none';
            document.getElementById('mainContainer').style.display = 'block';
            // carrega os registros do Supabase
            carregarRegistros();
        }

        async function autenticar() {
            const user = document.getElementById('loginUser').value.trim();
            const pass = document.getElementById('loginPass').value.trim();
            
            if (!user || !pass) {
                alert("Preencha usuário e senha.");
                return;
            }
            
            // Consulta a tabela 'usuarios' no Supabase
            const { data, error } = await supabase
                .from('usuarios')
                .select('*')
                .eq('usuario', user)
                .eq('senha', pass)
                .maybeSingle();
            
            if (error) {
                console.error("Erro na autenticação:", error);
                alert("Erro ao conectar com o servidor. Tente novamente.");
                return;
            }
            
            if (data) {
                console.log("Login bem-sucedido!");
                setAuthenticated(true);
                showApp();
            } else {
                alert("Usuário ou senha incorretos!");
            }
        }

        function fazerLogout() {
            setAuthenticated(false);
            showLogin();
            document.getElementById('loginUser').value = '';
            document.getElementById('loginPass').value = '';
            // limpa dados em memória
            dados = [];
            renderizarTabela([]);
        }

        // ========== CRUD com Supabase ==========
        async function carregarRegistros() {
            try {
                const { data, error } = await supabase
                    .from('registros')
                    .select('*')
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                
                dados = data.map(reg => ({
                    id: reg.id,
                    responsavel: reg.responsavel || "",
                    empresa: reg.empresa || "",
                    administradora: reg.administradora || "",
                    grupo: reg.grupo || "",
                    cota: reg.cota || "",
                    data_venc: reg.data_venc || "",
                    valor: reg.valor || 0,
                    status: reg.status || "Ativo",
                    canal: reg.canal || "",
                    data_retorno: reg.data_retorno || "",
                    observacao: reg.observacao || "",
                    acontecimentos: reg.acontecimentos || ""
                }));
                
                console.log(`${dados.length} registros carregados do Supabase.`);
                atualizarFiltrosSelect();
                aplicarFiltros();
                renderizarGraficos(dados);
            } catch (err) {
                console.error("Erro ao carregar registros:", err);
                alert("Não foi possível carregar os dados. Verifique sua conexão com o Supabase.");
                dados = [];
                renderizarTabela([]);
            }
        }

        async function salvarRegistro(registro) {
            try {
                const { error } = await supabase.from('registros').insert([registro]);
                if (error) throw error;
                await carregarRegistros(); // recarrega a lista
                return true;
            } catch (err) {
                console.error("Erro ao salvar:", err);
                alert("Erro ao salvar no Supabase. Tente novamente.");
                return false;
            }
        }

        async function atualizarRegistro(id, registro) {
            try {
                const { error } = await supabase
                    .from('registros')
                    .update(registro)
                    .eq('id', id);
                if (error) throw error;
                await carregarRegistros();
                return true;
            } catch (err) {
                console.error("Erro ao atualizar:", err);
                alert("Erro ao atualizar no Supabase.");
                return false;
            }
        }

        async function deletarRegistro(id) {
            try {
                const { error } = await supabase
                    .from('registros')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
                await carregarRegistros();
                return true;
            } catch (err) {
                console.error("Erro ao excluir:", err);
                alert("Erro ao excluir no Supabase.");
                return false;
            }
        }

        // ========== UTILITIES (mesmas funções do sistema original) ==========
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

        // ========== RENDER TABLE (adaptada para usar `dados` global) ==========
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
                const statusCount = { 'Ativo': 0, 'Pago': 0, 'Contemplado': 0 };
                for (const item of listaDados) {
                    if (statusCount.hasOwnProperty(item.status)) statusCount[item.status]++;
                    else statusCount['Ativo']++;
                }
                updateChart('chartStatus', 'pie', Object.keys(statusCount), Object.values(statusCount), ['#10b981', '#22c55e', '#a855f7']);

                const retornoCount = { 'atrasado': 0, 'hoje': 0, 'futuro': 0 };
                for (const item of listaDados) {
                    const sit = getSituacaoRetorno(item.data_retorno);
                    retornoCount[sit]++;
                }
                updateChart('chartRetorno', 'pie', ['Atrasado', 'Hoje', 'Futuro'], [retornoCount.atrasado, retornoCount.hoje, retornoCount.futuro], ['#ef4444', '#facc15', '#22c55e']);

                const responsavelValor = new Map();
                for (const item of listaDados) {
                    const nome = item.responsavel;
                    if (nome) responsavelValor.set(nome, (responsavelValor.get(nome) || 0) + item.valor);
                }
                const sortedResp = [...responsavelValor.entries()].sort((a,b) => b[1] - a[1]).slice(0, 6);
                updateChart('chartResponsavel', 'bar', sortedResp.map(r => r[0]), sortedResp.map(r => r[1]), ['#667eea']);

                const empresaCount = new Map();
                for (const item of listaDados) {
                    const nome = item.empresa;
                    if (nome) empresaCount.set(nome, (empresaCount.get(nome) || 0) + 1);
                }
                const sortedEmp = [...empresaCount.entries()].sort((a,b) => b[1] - a[1]).slice(0, 6);
                updateChart('chartEmpresa', 'bar', sortedEmp.map(e => e[0]), sortedEmp.map(e => e[1]), ['#a855f7']);
            } catch (error) {
                console.error("Erro nos gráficos:", error);
            }
        }

        function updateChart(chartId, type, labels, data, backgroundColor) {
            const canvas = document.getElementById(chartId);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (charts[chartId]) charts[chartId].destroy();
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

        window.editarRegistro = async function(id) {
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

        window.excluirRegistro = async function(id) {
            if (confirm('⚠️ Excluir permanentemente? Esta ação não pode ser desfeita.')) {
                await deletarRegistro(id);
            }
        };

        // ========== ITENS NO MODAL (manter igual) ==========
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

        // ========== BACKUP & RESTORE (local, apenas para exportar dados atuais) ==========
        function fazerBackup() {
            const backupData = { registros: dados };
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
            a.download = `citybens_backup_${Date.now()}.json`; a.click();
            URL.revokeObjectURL(a.href);
        }

        async function restaurarBackup(arquivo) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const content = JSON.parse(ev.target.result);
                    const regs = content.registros || (Array.isArray(content) ? content : []);
                    if (confirm(`Restaurar ${regs.length} registros? Os dados atuais serão substituídos.`)) {
                        // Remove todos os registros atuais do Supabase
                        for (const reg of dados) {
                            await supabase.from('registros').delete().eq('id', reg.id);
                        }
                        // Insere os registros do backup
                        for (const reg of regs) {
                            await supabase.from('registros').insert([reg]);
                        }
                        await carregarRegistros();
                        alert("Backup restaurado com sucesso!");
                    }
                } catch (err) { alert("Erro no arquivo"); }
            };
            reader.readAsText(arquivo);
        }

        // ========== EVENTOS E INICIALIZAÇÃO ==========
        function inicializarEventos() {
            const btnLogin = document.getElementById('btnLogin');
            if (btnLogin) btnLogin.addEventListener('click', autenticar);
            
            const btnLogout = document.getElementById('btnLogout');
            if (btnLogout) btnLogout.addEventListener('click', fazerLogout);
            
            const btnNovo = document.getElementById('btnNovoRegistro');
            if (btnNovo) btnNovo.addEventListener('click', () => {
                currentEditId = null;
                document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus mr-3 text-green-400"></i>Novo Registro';
                document.getElementById('editResponsavel').value = '';
                document.getElementById('editEmpresa').value = '';
                document.getElementById('editAdministradora').value = '';
                itensArray = []; adicionarItemVazio(); renderizarItensTabelaModal();
                document.getElementById('modalEditar').classList.add('active');
            });
            
            const btnAddItem = document.getElementById('btnAdicionarItem');
            if (btnAddItem) btnAddItem.addEventListener('click', () => { adicionarItemVazio(); renderizarItensTabelaModal(); });
            
            const btnSalvar = document.getElementById('btnSalvarModal');
            if (btnSalvar) btnSalvar.addEventListener('click', async () => {
                const resp = document.getElementById('editResponsavel').value.trim();
                const emp = document.getElementById('editEmpresa').value.trim();
                const adm = document.getElementById('editAdministradora').value.trim();
                if (!resp || !emp) { alert("Preencha Responsável e Empresa."); return; }
                const itensValidos = itensArray.filter(i => i.grupo && i.cota && i.data_venc && i.data_retorno);
                if (itensValidos.length === 0) { alert("Preencha os campos obrigatórios dos itens."); return; }
                
                if (currentEditId) {
                    // edição (apenas um item, pois edição é de registro único)
                    const item = itensValidos[0];
                    const registroAtualizado = {
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
                        observacao: item.observacao,
                        acontecimentos: item.acontecimentos
                    };
                    await atualizarRegistro(currentEditId, registroAtualizado);
                } else {
                    // novo registro (pode criar vários itens)
                    for (const item of itensValidos) {
                        const novoRegistro = {
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
                            observacao: item.observacao,
                            acontecimentos: item.acontecimentos,
                            created_at: new Date().toISOString()
                        };
                        await salvarRegistro(novoRegistro);
                    }
                }
                window.fecharModalEditar();
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
