(function () {
    'use strict';

    // ============================================================
    //  ⚠️  PREENCHA AQUI COM AS SUAS CHAVES DO SUPABASE
    //  Veja o PASSO 1 das instruções para encontrar esses valores
    // ============================================================
    const SUPABASE_URL = 'https://sdsmcopshzazbptszuei.supabase.co';  // ✅ já preenchido!
    const SUPABASE_KEY = 'COLE_AQUI_A_CHAVE_PUBLICAVEL';             // ⚠️ copie a "Chave publicável" do Supabase
    // ============================================================

    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    document.addEventListener('DOMContentLoaded', function () {
        console.log("DOM carregado. Iniciando CityBens com Supabase...");

        let dados = [];
        let currentEditId = null;   // UUID do registro sendo editado (null = novo)
        let itensArray = [];
        let charts = {};
        let usuarioAtual = null;    // nome do usuário logado

        // ==================== HELPERS DE UI ====================

        function showLoading(msg) {
            const ov = document.getElementById('loadingOverlay');
            document.getElementById('loadingMsg').textContent = msg || 'Carregando...';
            if (ov) ov.classList.add('active');
        }

        function hideLoading() {
            const ov = document.getElementById('loadingOverlay');
            if (ov) ov.classList.remove('active');
        }

        function setBtnLoading(btnTxtId, spinnerId, loading) {
            const txt = document.getElementById(btnTxtId);
            const sp = document.getElementById(spinnerId);
            if (txt) txt.style.opacity = loading ? '0.5' : '1';
            if (sp) sp.style.display = loading ? 'inline-block' : 'none';
        }

        // ==================== AUTENTICAÇÃO ====================

        function isAuthenticated() {
            return sessionStorage.getItem('citybens_auth') === 'true';
        }

        function setAuthenticated(value, nomeUsuario) {
            if (value) {
                sessionStorage.setItem('citybens_auth', 'true');
                sessionStorage.setItem('citybens_usuario', nomeUsuario || '');
                usuarioAtual = nomeUsuario;
            } else {
                sessionStorage.removeItem('citybens_auth');
                sessionStorage.removeItem('citybens_usuario');
                usuarioAtual = null;
            }
        }

        function showLogin() {
            document.getElementById('loginContainer').style.display = 'flex';
            document.getElementById('mainContainer').style.display = 'none';
        }

        async function showApp() {
            usuarioAtual = sessionStorage.getItem('citybens_usuario') || '';
            const el = document.getElementById('usuarioLogado');
            if (el) el.textContent = `Olá, ${usuarioAtual}`;

            document.getElementById('loginContainer').style.display = 'none';
            document.getElementById('mainContainer').style.display = 'block';

            showLoading('Carregando registros...');
            await carregarDados();
            hideLoading();

            atualizarFiltrosSelect();
            aplicarFiltros();
            renderizarGraficos(dados);
        }

        function fazerLogout() {
            setAuthenticated(false);
            dados = [];
            showLogin();
            document.getElementById('loginUser').value = '';
            document.getElementById('loginPass').value = '';
        }

        async function autenticar() {
            const userInput = document.getElementById('loginUser');
            const passInput = document.getElementById('loginPass');
            const erroDiv = document.getElementById('loginErro');

            if (erroDiv) erroDiv.style.display = 'none';

            const user = userInput.value.trim();
            const pass = passInput.value.trim();

            if (!user || !pass) {
                if (erroDiv) { erroDiv.textContent = 'Preencha usuário e senha.'; erroDiv.style.display = 'block'; }
                return;
            }

            setBtnLoading('btnLoginTxt', 'btnLoginSpinner', true);

            try {
                // Consulta a tabela "usuarios" no Supabase
                const { data, error } = await sb
                    .from('usuarios')
                    .select('usuario, senha')
                    .eq('usuario', user)
                    .eq('senha', pass)
                    .maybeSingle();

                if (error) throw error;

                if (data) {
                    setAuthenticated(true, data.usuario);
                    await showApp();
                } else {
                    if (erroDiv) { erroDiv.textContent = 'Usuário ou senha incorretos!'; erroDiv.style.display = 'block'; }
                }
            } catch (err) {
                console.error('Erro no login:', err);
                if (erroDiv) { erroDiv.textContent = 'Erro de conexão. Verifique as chaves do Supabase.'; erroDiv.style.display = 'block'; }
            } finally {
                setBtnLoading('btnLoginTxt', 'btnLoginSpinner', false);
            }
        }

        // ==================== CRUD SUPABASE ====================

        async function carregarDados() {
            try {
                const { data, error } = await sb
                    .from('registros')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;

                dados = (data || []).map(normalizar);
                console.log(`${dados.length} registros carregados do Supabase.`);
            } catch (err) {
                console.error('Erro ao carregar dados:', err);
                alert('Erro ao carregar dados. Verifique as chaves do Supabase.');
                dados = [];
            }
        }

        function normalizar(reg) {
            return {
                id: reg.id,
                responsavel: String(reg.responsavel || '').trim(),
                empresa: String(reg.empresa || '').trim(),
                administradora: String(reg.administradora || '').trim(),
                grupo: String(reg.grupo || '').trim(),
                cota: String(reg.cota || '').trim(),
                data_venc: reg.data_venc || '',
                valor: parseFloat(reg.valor) || 0,
                status: String(reg.status || 'Ativo').trim(),
                canal: String(reg.canal || '').trim(),
                data_retorno: reg.data_retorno || '',
                observacao: String(reg.observacao || '').trim(),
                acontecimentos: String(reg.acontecimentos || '').trim(),
                created_at: reg.created_at || null
            };
        }

        async function inserirRegistros(itensValidos, resp, emp, adm) {
            const rows = itensValidos.map(item => ({
                responsavel: resp,
                empresa: emp,
                administradora: adm,
                grupo: item.grupo,
                cota: item.cota,
                data_venc: item.data_venc || null,
                valor: parseFloat(item.valor) || 0,
                status: item.status || 'Ativo',
                canal: item.canal || '',
                data_retorno: item.data_retorno || null,
                observacao: item.observacao || '',
                acontecimentos: item.acontecimentos || ''
            }));

            const { error } = await sb.from('registros').insert(rows);
            if (error) throw error;
        }

        async function atualizarRegistro(id, item, resp, emp, adm) {
            const { error } = await sb.from('registros').update({
                responsavel: resp,
                empresa: emp,
                administradora: adm,
                grupo: item.grupo,
                cota: item.cota,
                data_venc: item.data_venc || null,
                valor: parseFloat(item.valor) || 0,
                status: item.status || 'Ativo',
                canal: item.canal || '',
                data_retorno: item.data_retorno || null,
                observacao: item.observacao || '',
                acontecimentos: item.acontecimentos || ''
            }).eq('id', id);

            if (error) throw error;
        }

        async function deletarRegistro(id) {
            const { error } = await sb.from('registros').delete().eq('id', id);
            if (error) throw error;
        }

        // ==================== UTILITIES ====================

        function formatarData(dataStr) {
            if (!dataStr) return '-';
            const partes = dataStr.split('-');
            return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : dataStr;
        }

        function escapeHtml(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        function getSituacaoRetorno(data) {
            if (!data) return 'atrasado';
            const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
            const partes = data.split('-');
            const ret = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
            if (ret < hoje) return 'atrasado';
            if (ret.getTime() === hoje.getTime()) return 'hoje';
            return 'futuro';
        }

        function getClasseRetorno(data) {
            const s = getSituacaoRetorno(data);
            return s === 'atrasado' ? 'retorno-atrasado' : s === 'hoje' ? 'retorno-hoje' : 'retorno-futuro';
        }

        function getTextoRetorno(data) {
            const s = getSituacaoRetorno(data);
            return s === 'atrasado' ? '🔴 Atrasado' : s === 'hoje' ? '🟡 Hoje' : '🟢 Futuro';
        }

        function calcularTotalVencimentosSemana(dataList) {
            const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
            const fimSemana = new Date(hoje); fimSemana.setDate(hoje.getDate() + 7);
            let total = 0;
            for (const item of dataList) {
                if (item.data_venc && item.status !== 'Pago' && item.status !== 'Contemplado') {
                    const venc = new Date(item.data_venc);
                    if (venc >= hoje && venc <= fimSemana) total++;
                }
            }
            return total;
        }

        function calcularValorAtraso(dataList) {
            let totalAtraso = 0;
            for (const item of dataList) {
                if (getSituacaoRetorno(item.data_retorno) === 'atrasado' && item.status !== 'Pago' && item.status !== 'Contemplado') {
                    totalAtraso += item.valor;
                }
            }
            return totalAtraso;
        }

        // ==================== TABELA ====================

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
                    <td class="px-6 py-4 text-sm font-semibold text-green-400">R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td class="px-6 py-4 text-sm"><span class="status-badge ${statusClass}">${item.status}</span></td>
                    <td class="px-6 py-4 text-sm"><span class="retorno-badge ${getClasseRetorno(item.data_retorno)}">${getTextoRetorno(item.data_retorno)}</span></td>
                    <td class="px-6 py-4 text-sm">
                        <div class="flex gap-2">
                            <button onclick="window.visualizarRegistro('${item.id}')" class="action-icon"><i class="fas fa-eye"></i></button>
                            <button onclick="window.editarRegistro('${item.id}')" class="action-icon"><i class="fas fa-edit"></i></button>
                            <button onclick="window.excluirRegistro('${item.id}')" class="action-icon"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </td>
                </tr>`;
            }).join('');

            const criticos = filtrados.filter(f => getSituacaoRetorno(f.data_retorno) !== 'futuro').length;
            const soma = filtrados.reduce((acc, f) => acc + (f.valor || 0), 0);

            document.getElementById('totalRegistros').innerText = filtrados.length;
            document.getElementById('totalAlertas').innerText = criticos;
            document.getElementById('valorTotal').innerHTML = 'R$ ' + soma.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            document.getElementById('totalVencimentosSemana').innerText = calcularTotalVencimentosSemana(dados);
            document.getElementById('valorAtraso').innerHTML = 'R$ ' + calcularValorAtraso(dados).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
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
                if (status && String(item.status || '').toLowerCase() !== status.toLowerCase()) return false;
                if (filterSituacao) {
                    const sit = getSituacaoRetorno(item.data_retorno);
                    if (filterSituacao.includes('Atrasado') && sit !== 'atrasado') return false;
                    if (filterSituacao.includes('Hoje') && sit !== 'hoje') return false;
                    if (filterSituacao.includes('Futuro') && sit !== 'futuro') return false;
                }
                if (busca) {
                    const campos = [item.responsavel, item.empresa, item.grupo, item.cota, item.observacao, item.acontecimentos].map(c => String(c || '').toLowerCase());
                    if (!campos.some(c => c.includes(busca))) return false;
                }
                return true;
            });

            filtrados.sort((a, b) => {
                const prioA = getSituacaoRetorno(a.data_retorno) === 'atrasado' ? 0 : (getSituacaoRetorno(a.data_retorno) === 'hoje' ? 1 : 2);
                const prioB = getSituacaoRetorno(b.data_retorno) === 'atrasado' ? 0 : (getSituacaoRetorno(b.data_retorno) === 'hoje' ? 1 : 2);
                if (prioA !== prioB) return prioA - prioB;
                return (a.data_retorno || '').localeCompare(b.data_retorno || '');
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

        // ==================== GRÁFICOS ====================

        function renderizarGraficos(listaDados) {
            try {
                const statusCount = { 'Ativo': 0, 'Pago': 0, 'Contemplado': 0 };
                for (const item of listaDados) {
                    if (statusCount.hasOwnProperty(item.status)) statusCount[item.status]++;
                    else statusCount['Ativo']++;
                }
                updateChart('chartStatus', 'pie', Object.keys(statusCount), Object.values(statusCount), ['#10b981', '#22c55e', '#a855f7']);

                const retornoCount = { 'atrasado': 0, 'hoje': 0, 'futuro': 0 };
                for (const item of listaDados) retornoCount[getSituacaoRetorno(item.data_retorno)]++;
                updateChart('chartRetorno', 'pie', ['Atrasado', 'Hoje', 'Futuro'], [retornoCount.atrasado, retornoCount.hoje, retornoCount.futuro], ['#ef4444', '#facc15', '#22c55e']);

                const responsavelValor = new Map();
                for (const item of listaDados) {
                    if (item.responsavel) responsavelValor.set(item.responsavel, (responsavelValor.get(item.responsavel) || 0) + item.valor);
                }
                const sortedResp = [...responsavelValor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
                updateChart('chartResponsavel', 'bar', sortedResp.map(r => r[0]), sortedResp.map(r => r[1]), ['#667eea']);

                const empresaCount = new Map();
                for (const item of listaDados) {
                    if (item.empresa) empresaCount.set(item.empresa, (empresaCount.get(item.empresa) || 0) + 1);
                }
                const sortedEmp = [...empresaCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
                updateChart('chartEmpresa', 'bar', sortedEmp.map(e => e[0]), sortedEmp.map(e => e[1]), ['#a855f7']);
            } catch (error) {
                console.error('Erro ao renderizar gráficos:', error);
            }
        }

        function updateChart(chartId, type, labels, data, backgroundColor) {
            const canvas = document.getElementById(chartId);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (charts[chartId]) { charts[chartId].destroy(); delete charts[chartId]; }
            if (!labels.length || data.every(v => v === 0)) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#4b5563';
                ctx.font = '14px Inter';
                ctx.textAlign = 'center';
                ctx.fillText('Sem dados', canvas.width / 2, canvas.height / 2);
                return;
            }
            charts[chartId] = new Chart(ctx, {
                type,
                data: { labels, datasets: [{ data, backgroundColor, borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1', font: { size: 10 } } } } }
            });
        }

        // ==================== MODAIS ====================

        window.visualizarRegistro = function (id) {
            const r = dados.find(reg => String(reg.id) === String(id));
            if (!r) return;
            const container = document.getElementById('visualizarConteudo');
            if (!container) return;
            container.innerHTML = `
                <div class="space-y-1"><p class="text-xs text-gray-400 uppercase">Responsável</p><p class="text-white font-semibold">${escapeHtml(r.responsavel)}</p></div>
                <div class="space-y-1"><p class="text-xs text-gray-400 uppercase">Empresa</p><p class="text-white font-semibold">${escapeHtml(r.empresa)}</p></div>
                <div class="space-y-1"><p class="text-xs text-gray-400 uppercase">Administradora</p><p class="text-white font-semibold">${escapeHtml(r.administradora) || '-'}</p></div>
                <div class="space-y-1"><p class="text-xs text-gray-400 uppercase">Grupo / Cota</p><p class="text-white font-semibold">${escapeHtml(r.grupo)} / ${escapeHtml(r.cota)}</p></div>
                <div class="space-y-1"><p class="text-xs text-gray-400 uppercase">Vencimento</p><p class="text-white font-semibold">${formatarData(r.data_venc)}</p></div>
                <div class="space-y-1"><p class="text-xs text-gray-400 uppercase">Valor</p><p class="text-green-400 font-bold">R$ ${r.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                <div class="space-y-1"><p class="text-xs text-gray-400 uppercase">Status</p><span class="status-badge status-${String(r.status).toLowerCase()}">${r.status}</span></div>
                <div class="space-y-1"><p class="text-xs text-gray-400 uppercase">Data Retorno</p><p class="text-white font-semibold">${formatarData(r.data_retorno)} <span class="retorno-badge ${getClasseRetorno(r.data_retorno)}">${getTextoRetorno(r.data_retorno)}</span></p></div>
                <div class="col-span-2"><p class="text-xs text-gray-400 uppercase mb-1">Observação</p><div class="bg-gray-800/50 p-3 rounded-lg border border-gray-700 text-sm">${escapeHtml(r.observacao) || '---'}</div></div>
                <div class="col-span-2"><p class="text-xs text-gray-400 uppercase mb-1">Acontecimentos</p><div class="bg-gray-800/50 p-3 rounded-lg border border-gray-700 text-sm whitespace-pre-wrap">${escapeHtml(r.acontecimentos) || '---'}</div></div>
            `;
            document.getElementById('modalVisualizar').classList.add('active');
        };

        window.editarRegistro = function (id) {
            const reg = dados.find(r => String(r.id) === String(id));
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

        window.excluirRegistro = async function (id) {
            if (!confirm('⚠️ Excluir permanentemente este registro?')) return;
            showLoading('Excluindo...');
            try {
                await deletarRegistro(id);
                dados = dados.filter(r => String(r.id) !== String(id));
                atualizarFiltrosSelect();
                aplicarFiltros();
            } catch (err) {
                console.error('Erro ao excluir:', err);
                alert('Erro ao excluir registro.');
            } finally {
                hideLoading();
            }
        };

        // ==================== ITENS NO MODAL ====================

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

        window.updateItemField = (idx, field, val) => {
            if (itensArray[idx]) itensArray[idx][field] = field === 'valor' ? (parseFloat(val) || 0) : val;
        };

        window.removeItem = (idx) => {
            itensArray.splice(idx, 1);
            if (itensArray.length === 0) adicionarItemVazio();
            renderizarItensTabelaModal();
        };

        function adicionarItemVazio() {
            itensArray.push({ grupo: '', cota: '', data_venc: '', valor: 0, status: 'Ativo', canal: '', data_retorno: '', observacao: '', acontecimentos: '' });
        }

        window.fecharModalEditar = function () { document.getElementById('modalEditar').classList.remove('active'); };
        window.fecharVisualizacao = function () { document.getElementById('modalVisualizar').classList.remove('active'); };

        // ==================== SALVAR REGISTRO ====================

        async function salvarRegistro() {
            const resp = document.getElementById('editResponsavel').value.trim();
            const emp = document.getElementById('editEmpresa').value.trim();
            const adm = document.getElementById('editAdministradora').value.trim();

            if (!resp || !emp) { alert('Preencha Responsável e Empresa.'); return; }

            const itensValidos = itensArray.filter(i => i.grupo && i.cota && i.data_venc && i.data_retorno);
            if (itensValidos.length === 0) { alert('Preencha os campos obrigatórios dos itens (Grupo, Cota, Vencimento e Retorno).'); return; }

            setBtnLoading('btnSalvarTxt', 'btnSalvarSpinner', true);

            try {
                if (currentEditId) {
                    // Edição: atualiza só o primeiro item (registro único)
                    await atualizarRegistro(currentEditId, itensValidos[0], resp, emp, adm);
                } else {
                    // Novo: insere todos os itens como registros separados
                    await inserirRegistros(itensValidos, resp, emp, adm);
                }

                showLoading('Atualizando lista...');
                await carregarDados();
                hideLoading();
                atualizarFiltrosSelect();
                aplicarFiltros();
                window.fecharModalEditar();
            } catch (err) {
                console.error('Erro ao salvar:', err);
                alert('Erro ao salvar registro: ' + err.message);
            } finally {
                setBtnLoading('btnSalvarTxt', 'btnSalvarSpinner', false);
            }
        }

        // ==================== BACKUP & RESTORE ====================

        function fazerBackup() {
            const blob = new Blob([JSON.stringify({ registros: dados }, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `citybens_backup_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
        }

        function restaurarBackup(arquivo) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const content = JSON.parse(ev.target.result);
                    const regs = content.registros || (Array.isArray(content) ? content : []);
                    if (!confirm(`Importar ${regs.length} registros para o Supabase? Os registros existentes NÃO serão apagados.`)) return;

                    showLoading('Importando backup...');
                    const rows = regs.map(r => ({
                        responsavel: String(r.responsavel || '').trim(),
                        empresa: String(r.empresa || '').trim(),
                        administradora: String(r.administradora || '').trim(),
                        grupo: String(r.grupo || '').trim(),
                        cota: String(r.cota || '').trim(),
                        data_venc: r.data_venc || null,
                        valor: parseFloat(r.valor) || 0,
                        status: String(r.status || 'Ativo').trim(),
                        canal: String(r.canal || '').trim(),
                        data_retorno: r.data_retorno || null,
                        observacao: String(r.observacao || '').trim(),
                        acontecimentos: String(r.acontecimentos || '').trim()
                    }));
                    const { error } = await sb.from('registros').insert(rows);
                    if (error) throw error;
                    await carregarDados();
                    hideLoading();
                    atualizarFiltrosSelect();
                    aplicarFiltros();
                    alert(`✅ ${regs.length} registros importados com sucesso!`);
                } catch (err) {
                    hideLoading();
                    console.error('Erro ao restaurar:', err);
                    alert('Erro ao restaurar backup: ' + err.message);
                }
            };
            reader.readAsText(arquivo);
        }

        // ==================== EVENTOS ====================

        function inicializarEventos() {
            const btnLogin = document.getElementById('btnLogin');
            if (btnLogin) {
                btnLogin.addEventListener('click', autenticar);
                // Login com Enter
                ['loginUser', 'loginPass'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') autenticar(); });
                });
            }

            const btnLogout = document.getElementById('btnLogout');
            if (btnLogout) btnLogout.addEventListener('click', fazerLogout);

            const btnNovo = document.getElementById('btnNovoRegistro');
            if (btnNovo) btnNovo.addEventListener('click', () => {
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

            const btnAddItem = document.getElementById('btnAdicionarItem');
            if (btnAddItem) btnAddItem.addEventListener('click', () => { adicionarItemVazio(); renderizarItensTabelaModal(); });

            const btnSalvar = document.getElementById('btnSalvarModal');
            if (btnSalvar) btnSalvar.addEventListener('click', salvarRegistro);

            const btnFiltrar = document.getElementById('btnFiltrar');
            if (btnFiltrar) btnFiltrar.addEventListener('click', aplicarFiltros);

            const btnLimpar = document.getElementById('btnLimpar');
            if (btnLimpar) btnLimpar.addEventListener('click', () => {
                ['filterResponsavel', 'filterEmpresa', 'filterStatus', 'filterRetorno', 'searchBox'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
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

        // ==================== INÍCIO ====================
        inicializarEventos();

        if (isAuthenticated()) {
            showApp();
        } else {
            showLogin();
        }
    });
})();
