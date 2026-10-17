const $ = (s) => document.querySelector(s);
const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const ET = ['Novo', 'Em contato', 'Proposta', 'Fechado'];
const DOCS = ['Vistoria cautelar', 'ATPV-e / CRV', 'Contrato de compra e venda', 'Comunicação de venda', 'Transferência concluída'];
const ORIGENS = ['Balcão', 'WhatsApp', 'Webmotors', 'OLX', 'iCarros', 'Instagram', 'Indicação'];
const sil = '<svg viewBox="0 0 200 100" aria-hidden="true"><path d="M18 72h164V58l-20-8-24-24H84L62 50l-34 8z" fill="currentColor" opacity=".3"/><circle cx="60" cy="74" r="13" fill="currentColor"/><circle cx="146" cy="74" r="13" fill="currentColor"/></svg>';
let T = localStorage.getItem('patio_t'), tab = 'painel', modo = 'entrar', q = '', st = 'todos';
let D = { cars: [], leads: [], sales: [], me: {} };

const margem = (c) => c.preco - c.compra - c.custos;
const car = (id) => D.cars.find((c) => c.id === id);
const dias = (c) => Math.floor((Date.now() - new Date(c.criado_em.replace(' ', 'T') + 'Z')) / 864e5);
const hoje = () => new Date().toISOString().slice(0, 10);
const addDias = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const lucroVenda = (s) => { const c = car(s.car_id); return s.valor - (c ? c.compra + c.custos : 0); };

async function api(p, o = {}) {
  const h = {}; if (T) h.Authorization = 'Bearer ' + T;
  let b = o.body;
  if (b && !(b instanceof FormData)) { h['Content-Type'] = 'application/json'; b = JSON.stringify(b); }
  const r = await fetch('/api' + p, { method: o.method || 'GET', headers: h, body: b });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && p !== '/login') { sair(); throw new Error(j.erro || 'Sessão expirada'); }
  if (!r.ok) throw new Error(j.erro || 'Erro inesperado');
  return j;
}
const run = async (fn) => { try { await fn(); } catch (e) { alert(e.message); } };
const reload = async () => { [D.cars, D.leads, D.sales, D.me] = await Promise.all([api('/cars'), api('/leads'), api('/sales'), api('/me')]); render(); };
function sair() { T = null; localStorage.removeItem('patio_t'); loginView(); }
const dlg = (h) => { $('#dlg').innerHTML = h; $('#dlg').showModal(); };
const f = (id, l, v = '', t = 'text', x = '') => `<label>${l}<input id="${id}" type="${t}" value="${esc(v)}" ${x}></label>`;
const val = (id) => $('#' + id).value.trim(), num = (id) => +$('#' + id).value || 0;

// ---------- login ----------
function loginView() {
  const c = modo === 'criar';
  $('#root').innerHTML = `<div class="login"><div class="brand">Pátio<i>.</i></div><h1>${c ? 'Criar conta da loja' : 'Entrar'}</h1>
  <form id="lf">${c ? '<label>Nome da loja<input name="loja" required></label><label>Seu nome<input name="nome" required></label>' : ''}
  <label>E-mail<input name="email" type="email" required autocomplete="username"></label>
  <label>Senha${c ? ' (8+ caracteres)' : ''}<input name="senha" type="password" required minlength="${c ? 8 : 1}" autocomplete="${c ? 'new-password' : 'current-password'}"></label>
  <button class="btn">${c ? 'Criar conta' : 'Entrar'}</button></form>
  <button class="btn g" data-a="modo">${c ? 'Já tenho conta' : 'Criar conta da loja'}</button></div>`;
  $('#lf').onsubmit = (e) => { e.preventDefault(); run(async () => {
    const r = await api(c ? '/register' : '/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
    T = r.token; localStorage.setItem('patio_t', T); await reload();
  }); };
}

// ---------- views ----------
const TITLES = { painel: 'Painel', estoque: 'Estoque', clientes: 'Clientes', vendas: 'Vendas', sim: 'Simulador', vitrine: 'Minha vitrine' };
function render() {
  $('#root').innerHTML = `<div class="shell"><aside><div class="brand">${esc(D.me.nome)}<i>.</i></div>${Object.entries(TITLES).map(([k, v]) => `<button class="nav ${k === tab ? 'on' : ''}" data-a="tab" data-v="${k}">${v}</button>`).join('')}<button class="nav out" data-a="sair">Sair</button></aside><main><div class="top"><h1>${TITLES[tab]}</h1></div>${V[tab]()}</main></div>`;
  HK[tab] && HK[tab]();
}
const V = {
  painel() {
    const at = D.cars.filter((c) => c.status !== 'vendido');
    const mx = Math.max(1, ...ET.map((_, i) => D.leads.filter((l) => l.etapa === i).length));
    const al = [];
    D.leads.filter((l) => l.etapa < 3 && l.retorno && l.retorno < hoje()).forEach((l) => al.push(`Retornar para ${esc(l.nome)} (${esc(l.interesse)}): atrasado`));
    at.filter((c) => c.fipe && c.preco > c.fipe * 1.03).forEach((c) => al.push(`${esc(c.modelo)} está ${Math.round((c.preco / c.fipe - 1) * 100)}% acima da FIPE`));
    D.sales.filter((s) => s.docs.some((d) => !d)).forEach((s) => al.push(`Documentação pendente: ${esc((car(s.car_id) || {}).modelo)}`));
    const par = at.filter((c) => dias(c) > 60);
    return `<div class="kpis"><div class="kpi"><span>Veículos no pátio</span><b class="big">${at.length}</b></div><div class="kpi"><span>Valor em estoque</span><b class="big">${brl(at.reduce((a, c) => a + c.preco, 0))}</b></div><div class="kpi"><span>Lucro das vendas</span><b class="big">${brl(D.sales.reduce((a, s) => a + lucroVenda(s), 0))}</b></div><div class="kpi"><span>Clientes em andamento</span><b class="big">${D.leads.filter((l) => l.etapa < 3).length}</b></div></div>
    <div class="box" style="margin-top:16px"><h3>Para resolver hoje</h3>${al.length ? al.map((t) => `<div class="item"><span>${t}</span></div>`).join('') : '<div class="empty">Tudo em dia.</div>'}</div>
    <div class="row"><div class="box"><h3>Funil de vendas</h3>${ET.map((e, i) => { const n = D.leads.filter((l) => l.etapa === i).length; return `<div class="bar"><b>${e}</b><div style="width:${n / mx * 60}%"></div><span>${n}</span></div>`; }).join('')}</div>
    <div class="box"><h3>Parados há mais de 60 dias</h3>${par.length ? par.map((c) => `<div class="item"><span>${esc(c.marca)} ${esc(c.modelo)}</span><span class="tag old">${dias(c)} dias</span></div>`).join('') : '<div class="empty">Nenhum veículo parado.</div>'}</div></div>`;
  },
  estoque() {
    return `<div class="tools"><input id="q" placeholder="Buscar por modelo ou placa" value="${esc(q)}"><select id="st"><option value="todos">Todos</option><option value="disponivel">Disponíveis</option><option value="reservado">Reservados</option><option value="vendido">Vendidos</option></select><button class="btn" data-a="newcar">Novo veículo</button></div><div id="list">${cards()}</div>`;
  },
  clientes() {
    return `<div class="tools"><button class="btn" data-a="newlead">Novo cliente</button></div><div class="kan">${ET.map((e, i) => `<div class="col"><h3>${e}</h3>${D.leads.filter((l) => l.etapa === i).map((l) => `<div class="lead"><b>${esc(l.nome)}</b><small>${esc(l.interesse)} · ${brl(l.valor)}</small><small style="${l.etapa < 3 && l.retorno && l.retorno < hoje() ? 'color:var(--red)' : ''}">${esc(l.origem)}${l.retorno ? ' · retorno ' + l.retorno.split('-').reverse().join('/') : ''}</small>
    <div class="acts"><button class="btn g s" data-a="lm" data-id="${l.id}" data-v="-1" ${i === 0 ? 'disabled' : ''} aria-label="Voltar etapa">‹</button><button class="btn g s" data-a="lm" data-id="${l.id}" data-v="1" ${i === 3 ? 'disabled' : ''} aria-label="Avançar etapa">›</button><a class="btn g s" target="_blank" rel="noopener" href="https://wa.me/55${String(l.tel).replace(/\D/g, '')}">WhatsApp</a><button class="btn g s" data-a="rt" data-id="${l.id}">Retornar em 2 dias</button><button class="btn g s r" data-a="ldel" data-id="${l.id}">Excluir</button></div></div>`).join('')}</div>`).join('')}</div>`;
  },
  vendas() {
    const com = (s) => Math.max(0, lucroVenda(s)) * D.me.comis / 100;
    return `<div class="kpis" style="grid-template-columns:repeat(3,1fr)"><div class="kpi"><span>Faturamento</span><b class="big">${brl(D.sales.reduce((a, s) => a + s.valor, 0))}</b></div><div class="kpi"><span>Lucro bruto</span><b class="big">${brl(D.sales.reduce((a, s) => a + lucroVenda(s), 0))}</b></div><div class="kpi"><span>Comissões a pagar</span><b class="big">${brl(D.sales.reduce((a, s) => a + com(s), 0))}</b></div></div>
    <div class="tools" style="margin:16px 0"><label>Comissão sobre o lucro (%)<input id="cm" type="number" value="${D.me.comis}" style="width:90px"></label></div>
    ${D.sales.length ? D.sales.map((s) => { const c = car(s.car_id) || {}; return `<div class="box"><div class="item" style="border:0"><h3>${esc(c.marca)} ${esc(c.modelo)}</h3><b>${brl(s.valor)}</b></div><div class="m">${esc(s.vendedor)} · ${esc(s.pgto)} · lucro ${brl(lucroVenda(s))} · comissão ${brl(com(s))}</div><div class="acts">${DOCS.map((d, i) => `<button class="btn s ${s.docs[i] ? '' : 'g'}" data-a="dk" data-id="${s.id}" data-v="${i}">${s.docs[i] ? '✓ ' : ''}${d}</button>`).join('')}</div></div>`; }).join('') : '<div class="empty">Nenhuma venda registrada. Marque um veículo como vendido no estoque.</div>'}`;
  },
  sim() {
    return `<div class="box"><label>Veículo<select id="sv"><option value="">Digitar valor manualmente</option>${D.cars.filter((c) => c.status !== 'vendido').map((c) => `<option value="${c.preco}">${esc(c.marca)} ${esc(c.modelo)} — ${brl(c.preco)}</option>`).join('')}</select></label>
    <div class="two">${f('s1', 'Valor do veículo (R$)', 100000, 'number')}${f('s2', 'Entrada (R$)', 30000, 'number')}<label>Parcelas<select id="s3">${[12, 24, 36, 48, 60].map((n) => `<option ${n === 48 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>${f('s4', 'Taxa ao mês (%)', 1.89, 'number', 'step="0.01"')}</div><div class="res" id="res"></div></div>`;
  },
  vitrine() {
    const url = location.origin + '/v/' + D.me.slug;
    return `<div class="box"><h3>Link público da sua loja</h3><div class="link"><code>${esc(url)}</code><a class="btn s" href="${esc(url)}" target="_blank" rel="noopener">Abrir</a><button class="btn g s" data-a="cpl" data-v="${esc(url)}">Copiar link</button></div><p class="m">Mostra só carros disponíveis e reservados, com fotos e preço. Custos e margens nunca saem do painel.</p></div>
    <div class="box"><h3>Dados da loja</h3><div class="two">${f('l_n', 'Nome', D.me.nome)}${f('l_t', 'WhatsApp com DDD', D.me.tel, 'tel')}</div>${f('l_s', 'Frase de apresentação', D.me.slogan)}<div class="acts" style="margin-top:14px"><button class="btn" data-a="saveloja">Salvar</button></div></div>`;
  },
};
function cards() {
  const l = D.cars.filter((c) => (st === 'todos' || c.status === st) && (c.marca + ' ' + c.modelo + ' ' + c.placa).toLowerCase().includes(q.toLowerCase()));
  if (!l.length) return '<div class="empty">Nenhum veículo encontrado. Cadastre o primeiro em Novo veículo.</div>';
  return `<div class="grid">${l.map((c) => `<div class="car"><div class="ph" data-a="edit" data-id="${c.id}">${c.fotos[0] ? `<img loading="lazy" src="${c.fotos[0].url}" alt="">` : sil}<span class="tag ${c.status}">${{ disponivel: 'Disponível', reservado: 'Reservado', vendido: 'Vendido' }[c.status]}</span></div>
  <div class="bd"><div class="plate"><i>BRASIL</i><b>${esc(c.placa)}</b></div><h3>${esc(c.marca)} ${esc(c.modelo)}</h3><div class="m">${c.ano} · ${Number(c.km).toLocaleString('pt-BR')} km</div><div class="price">${brl(c.preco)}</div>
  <div class="m">Margem ${brl(margem(c))} (${c.preco ? Math.round(margem(c) / c.preco * 100) : 0}%)${c.fipe ? ` · FIPE ${brl(c.fipe)}: ${c.preco > c.fipe ? '+' : ''}${((c.preco / c.fipe - 1) * 100).toFixed(1)}%` : ''}</div>${c.status !== 'vendido' && dias(c) > 60 ? `<div><span class="tag old">${dias(c)} dias parado</span></div>` : ''}
  <div class="acts"><button class="btn g s" data-a="ad" data-id="${c.id}">Copiar anúncio</button><button class="btn g s" data-a="edit" data-id="${c.id}">Editar</button>${c.status === 'disponivel' ? `<button class="btn g s" data-a="cs" data-id="${c.id}" data-v="reservado">Reservar</button>` : ''}${c.status === 'reservado' ? `<button class="btn g s" data-a="cs" data-id="${c.id}" data-v="disponivel">Liberar</button>` : ''}${c.status !== 'vendido' ? `<button class="btn s" data-a="sell" data-id="${c.id}">Marcar vendido</button>` : ''}</div></div></div>`).join('')}</div>`;
}
const HK = {
  estoque() { $('#st').value = st; $('#q').oninput = (e) => { q = e.target.value; $('#list').innerHTML = cards(); }; $('#st').onchange = (e) => { st = e.target.value; $('#list').innerHTML = cards(); }; },
  vendas() { $('#cm').onchange = (e) => run(async () => { await api('/loja', { method: 'PUT', body: { comis: +e.target.value || 0 } }); await reload(); }); },
  sim() {
    const calc = () => { const v = num('s1'), e = num('s2'), n = num('s3'), i = num('s4') / 100, pv = Math.max(0, v - e), p = i ? pv * i / (1 - Math.pow(1 + i, -n)) : pv / n; $('#res').innerHTML = `<span>Parcela estimada</span><b class="big">${brl(p)}</b><div>${n}x · financiado ${brl(pv)} · total pago ${brl(p * n + e)}</div>`; };
    ['s1', 's2', 's3', 's4'].forEach((id) => $('#' + id).oninput = calc);
    $('#sv').onchange = (e) => { if (e.target.value) { $('#s1').value = e.target.value; calc(); } }; calc();
  },
};

// ---------- diálogos ----------
function carDlg(id) {
  const c = car(id) || { marca: '', modelo: '', ano: new Date().getFullYear(), km: 0, placa: '', compra: 0, custos: 0, preco: 0, fipe: 0, fotos: [] };
  dlg(`<h2>${id ? 'Editar veículo' : 'Novo veículo'}</h2><div class="two">${f('c_marca', 'Marca', c.marca)}${f('c_modelo', 'Modelo', c.modelo)}${f('c_ano', 'Ano', c.ano, 'number')}${f('c_km', 'Quilometragem', c.km, 'number')}${f('c_placa', 'Placa', c.placa)}${f('c_fipe', 'Valor FIPE (R$)', c.fipe, 'number')}${f('c_compra', 'Valor de compra (R$)', c.compra, 'number')}${f('c_custos', 'Custos de preparação (R$)', c.custos, 'number')}</div>${f('c_preco', 'Preço de venda (R$)', c.preco, 'number')}
  <label>Fotos (até 10 por vez, 5 MB cada)<input id="c_fotos" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
  <div class="ths">${c.fotos.map((p) => `<div><img src="${p.url}" alt=""><button type="button" data-a="delfoto" data-id="${p.id}" data-v="${id}" aria-label="Remover foto">×</button></div>`).join('')}</div>
  <div class="acts" style="margin-top:16px"><button class="btn" data-a="savecar" data-id="${id || 0}">Salvar</button><button class="btn g" data-a="close">Cancelar</button>${id ? `<button class="btn g r" data-a="cdel" data-id="${id}">Excluir</button>` : ''}</div>`);
}
const leadDlg = () => dlg(`<h2>Novo cliente</h2>${f('d_nome', 'Nome')}${f('d_tel', 'WhatsApp com DDD', '', 'tel')}${f('d_int', 'Veículo de interesse')}<div class="two">${f('d_val', 'Valor da proposta (R$)', 0, 'number')}${f('d_ret', 'Retornar em', addDias(1), 'date')}</div><label>Origem<select id="d_org">${ORIGENS.map((o) => `<option>${o}</option>`).join('')}</select></label><div class="acts" style="margin-top:16px"><button class="btn" data-a="savelead">Salvar</button><button class="btn g" data-a="close">Cancelar</button></div>`);
const sellDlg = (id) => { const c = car(id); dlg(`<h2>Registrar venda</h2><p>${esc(c.marca)} ${esc(c.modelo)}</p>${f('v_vend', 'Vendedor')}<label>Forma de pagamento<select id="v_pg"><option>À vista</option><option>Financiado</option><option>Troca com volta</option><option>Consórcio</option></select></label>${f('v_val', 'Valor final (R$)', c.preco, 'number')}<div class="acts" style="margin-top:16px"><button class="btn" data-a="savesale" data-id="${id}">Confirmar venda</button><button class="btn g" data-a="close">Cancelar</button></div>`); };

async function uploadFotos(id) {
  const files = $('#c_fotos').files; if (!files.length) return;
  const fd = new FormData(); [...files].forEach((x) => fd.append('fotos', x));
  await api(`/cars/${id}/photos`, { method: 'POST', body: fd });
}
const carBody = () => ({ marca: val('c_marca'), modelo: val('c_modelo'), ano: num('c_ano'), km: num('c_km'), placa: val('c_placa'), fipe: num('c_fipe'), compra: num('c_compra'), custos: num('c_custos'), preco: num('c_preco') });

// ---------- ações ----------
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, id = +b.dataset.id, v = b.dataset.v;
  const L = D.leads.find((x) => x.id === id);
  const go = (fn) => run(async () => { await fn(); await reload(); });
  if (a === 'modo') { modo = modo === 'entrar' ? 'criar' : 'entrar'; loginView(); }
  else if (a === 'sair') sair();
  else if (a === 'tab') { tab = v; render(); }
  else if (a === 'newcar') carDlg(0);
  else if (a === 'edit') carDlg(id);
  else if (a === 'close') $('#dlg').close();
  else if (a === 'savecar') { const body = carBody(); if (!body.modelo || !body.preco) return alert('Informe o modelo e o preço de venda.');
    go(async () => { const nid = id ? (await api('/cars/' + id, { method: 'PUT', body }), id) : (await api('/cars', { method: 'POST', body })).id; await uploadFotos(nid); $('#dlg').close(); }); }
  else if (a === 'delfoto') go(async () => { await api('/photos/' + id, { method: 'DELETE' }); $('#dlg').close(); setTimeout(() => carDlg(+v), 0); });
  else if (a === 'cdel') { if (confirm('Excluir este veículo e as fotos dele?')) go(async () => { await api('/cars/' + id, { method: 'DELETE' }); $('#dlg').close(); }); }
  else if (a === 'cs') go(() => api('/cars/' + id, { method: 'PUT', body: { status: v } }));
  else if (a === 'sell') sellDlg(id);
  else if (a === 'savesale') go(async () => { await api('/sales', { method: 'POST', body: { car_id: id, vendedor: val('v_vend'), pgto: val('v_pg'), valor: num('v_val') } }); $('#dlg').close(); tab = 'vendas'; });
  else if (a === 'dk') go(() => { const s = D.sales.find((x) => x.id === id); s.docs[+v] = s.docs[+v] ? 0 : 1; return api(`/sales/${id}/docs`, { method: 'PUT', body: { docs: s.docs } }); });
  else if (a === 'newlead') leadDlg();
  else if (a === 'savelead') { if (!val('d_nome')) return alert('Informe o nome do cliente.');
    go(async () => { await api('/leads', { method: 'POST', body: { nome: val('d_nome'), tel: val('d_tel'), interesse: val('d_int'), valor: num('d_val'), retorno: val('d_ret'), origem: val('d_org'), etapa: 0 } }); $('#dlg').close(); }); }
  else if (a === 'lm') go(() => api('/leads/' + id, { method: 'PUT', body: { etapa: Math.min(3, Math.max(0, L.etapa + +v)) } }));
  else if (a === 'rt') go(() => api('/leads/' + id, { method: 'PUT', body: { retorno: addDias(2) } }));
  else if (a === 'ldel') { if (confirm('Excluir este cliente?')) go(() => api('/leads/' + id, { method: 'DELETE' })); }
  else if (a === 'saveloja') go(() => api('/loja', { method: 'PUT', body: { nome: val('l_n'), tel: val('l_t'), slogan: val('l_s') } }));
  else if (a === 'cpl') navigator.clipboard.writeText(v).then(() => { b.textContent = 'Copiado'; }).catch(() => { b.textContent = 'Copie manualmente'; });
  else if (a === 'ad') { const c = car(id), t = `${c.marca} ${c.modelo} ${c.ano}\n${c.km.toLocaleString('pt-BR')} km · ${brl(c.preco)}\nAceitamos troca. Financiamos em até 60x.\n${location.origin}/v/${D.me.slug}`; navigator.clipboard.writeText(t).then(() => { b.textContent = 'Copiado'; }).catch(() => prompt('Copie o anúncio:', t)); }
});
T ? reload().catch(loginView) : loginView();
