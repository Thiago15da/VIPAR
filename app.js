'use strict';

const STAGES = ['Medición', 'Fabricación', 'Instalación'];
const STATUSES = ['Borrador', 'Enviado', 'Aprobado'];
const DEMO_DATE = '2026-11-12';
const KEY = 'novatec-vipar-demo-v1';
const names = ['Equipo comercial', 'Equipo de medición', 'Taller', 'Equipo de instalación'];
const exampleLines = [
  {description:'Mampara de cristal templado 10 mm', qty:3, price:1950000},
  {description:'Perfilería de aluminio y herrajes', qty:1, price:1450000},
  {description:'Montaje y ajuste en obra', qty:1, price:1100000}
];

function seedStages(dates, complete = 0, notes = []) {
  return STAGES.map((name, index) => ({
    name, date: dates[index] || '', owner: names[index + 1], done: index < complete,
    note: notes[index] || ''
  }));
}

const examples = [
  {id:'V-101',name:'Oficinas Río Verde',client:'Grupo Río Verde',city:'Asunción',type:'Mamparas',
    scope:'División de tres salas con cristal templado y perfilería de aluminio negro.',
    status:'Aprobado',lines:exampleLines,
    stages:seedStages(['2026-11-10','2026-11-13','2026-11-18'],1,['Tres paños de 2,40 × 2,60 m. Verificar plomo del vano antes del montaje.','Confirmar disponibilidad de perfilería negra.','Coordinar acceso con recepción.'])},
  {id:'V-102',name:'Local comercial Ceibo',client:'Comercial Ceibo',city:'San Lorenzo',type:'Fachadas',
    scope:'Frente vidriado y acceso principal para un local comercial.',
    status:'Enviado',lines:[{description:'Fachada vidriada y puerta de acceso',qty:1,price:12850000}],
    stages:seedStages(['2026-11-16','2026-11-20','2026-11-25'])},
  {id:'V-103',name:'Residencia Jacarandá',client:'Residencia Jacarandá',city:'Luque',type:'Box de baño',
    scope:'Dos boxes de baño con puertas batientes.',
    status:'Aprobado',lines:[{description:'Box de baño con puerta batiente',qty:2,price:2300000}],
    stages:seedStages(['2026-11-03','2026-11-08','2026-11-11'],2,['Medidas verificadas en obra.','Piezas preparadas.','Reprogramar la instalación con el cliente.'])},
  {id:'V-104',name:'Vivienda Lapacho',client:'Familia Lapacho',city:'Ñemby',type:'Carpintería de aluminio',
    scope:'Renovación de aberturas de aluminio del área social.',
    status:'Borrador',lines:[{description:'Ventana corrediza con marco de aluminio',qty:4,price:1800000}],
    stages:seedStages(['','',''])},
  {id:'V-105',name:'Consultorios Yvoty',client:'Centro Yvoty',city:'Fernando de la Mora',type:'Mamparas',
    scope:'Separación de áreas de atención con divisiones de vidrio.',
    status:'Aprobado',lines:[{description:'División de cristal con puerta',qty:2,price:3100000}],
    stages:seedStages(['2026-11-04','2026-11-06','2026-11-09'],3)}
];

const byId = id => document.getElementById(id);
const $project = byId('project');
const $create = byId('create');
const $detail = byId('detail');
const $filter = byId('filter');
const $search = byId('search');
const currency = new Intl.NumberFormat('es-PY');
const money = value => 'G. ' + currency.format(value);
const sum = lines => lines.reduce((total, item) => total + item.qty * item.price, 0);
const dateOf = value => new Date(value + 'T12:00:00');
const dateText = value => value ? dateOf(value).toLocaleDateString('es-PY',{day:'numeric',month:'short',year:'numeric'}) : 'Sin fecha';
const normalize = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {}
  return structuredClone(examples);
}

let projects = load();
let active;
let tab;
let budget;
let budgetStatus;
let toastTimer;

function persist() {
  try {
    localStorage.setItem(KEY,JSON.stringify(projects));
    return true;
  } catch {
    return false;
  }
}

function stageOf(project) {
  if (project.status !== 'Aprobado') return 'Presupuesto';
  return project.stages.find(stage => !stage.done)?.name || 'Entregada';
}

function nextTask(project) {
  if (project.status !== 'Aprobado') return null;
  const stage = project.stages.find(item => !item.done);
  return stage?.date ? stage : null;
}

function badge(label, style = '') {
  return `<span class="badge ${style}">${escape(label)}</span>`;
}

function statsItem(label, value, helper) {
  return `<div class="stat"><span>${label}</span><strong>${value}</strong><small>${helper}</small></div>`;
}

function renderOverview() {
  const tasks = projects.map(project => ({project, stage:nextTask(project)}))
    .filter(task => task.stage).sort((a,b) => a.stage.date.localeCompare(b.stage.date));
  byId('stats').innerHTML = [
    statsItem('Obras activas',projects.filter(p => stageOf(p) !== 'Entregada').length,'En cotización o ejecución'),
    statsItem('Por aprobar',projects.filter(p => p.status === 'Enviado').length,'Presupuestos enviados'),
    statsItem('Tareas vencidas',tasks.filter(t => t.stage.date < DEMO_DATE).length,'Al 12 nov. 2026')
  ].join('');
  byId('tasks').innerHTML = tasks.map(({project,stage}) => {
    const date = dateOf(stage.date);
    const month = date.toLocaleDateString('es-PY',{month:'short'}).replace('.','');
    return `<button class="task" data-open="${escape(project.id)}" data-section="seguimiento" type="button">
      <span class="date"><b>${date.getDate()}</b>${month}</span>
      <span><strong>${escape(stage.name)} · ${escape(project.name)}</strong><small>${escape(stage.owner || 'Sin responsable')}</small>
      ${stage.date < DEMO_DATE ? badge('Vencida','late') : ''}</span>
    </button>`;
  }).join('') || '<p class="empty">No hay tareas con fecha programada.</p>';
  renderWork();
}

function renderWork() {
  const query = normalize($search.value.trim());
  byId('work-list').innerHTML = projects.filter(project =>
    (!$filter.value || stageOf(project) === $filter.value) &&
    normalize([project.name,project.client,project.city,project.type,project.id].join(' ')).includes(query)
  ).map(project => {
    const stage = stageOf(project);
    const meta = [project.id,project.type,project.city].join(' · ');
    return `<button class="work-row" data-open="${escape(project.id)}" type="button">
      <span><strong>${escape(project.name)}</strong><small>${escape(meta)}</small></span>
      ${badge(stage,stage === 'Entregada' ? 'done' : stage === 'Presupuesto' ? 'wait' : '')}
      <span class="open-arrow" aria-hidden="true">↗</span>
    </button>`;
  }).join('') || '<p class="empty">No hay obras para esta búsqueda.</p>';
}

function notify(message, target) {
  if (target) {
    target.textContent = message;
    return;
  }
  const $toast = byId('toast');
  $toast.textContent = message;
  $toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $toast.hidden = true; },4200);
}

function openProject(id, section = 'resumen') {
  active = projects.find(project => project.id === id);
  if (!active) return;
  budget = structuredClone(active.lines);
  budgetStatus = active.status;
  byId('project-code').textContent = active.id + ' · ' + active.type;
  byId('project-title').textContent = active.name;
  byId('project-meta').textContent = active.client + ' · ' + active.city;
  showTab(section);
  if (!$project.open) $project.showModal();
}

function showTab(section) {
  tab = section;
  for (const control of byId('tabs').querySelectorAll('button')) {
    control.setAttribute('aria-pressed', String(control.dataset.tab === tab));
  }
  if (tab === 'presupuesto') renderBudget();
  else if (tab === 'seguimiento') renderStages();
  else renderSummary();
}

function renderSummary() {
  const stage = active.stages.find(item => !item.done);
  const approved = active.status === 'Aprobado';
  $detail.innerHTML = `<h3>Alcance de la obra</h3><p class="muted">${escape(active.scope || 'Alcance pendiente de definir.')}</p>
    <div class="summary-grid">
      <div class="detail-card">${badge(active.status, approved ? 'ready' : 'wait')}<strong>${money(sum(active.lines))}</strong><p class="muted">Presupuesto por obra</p></div>
      <div class="detail-card">${badge(stageOf(active), stage ? '' : 'done')}<strong>${approved ? escape(stage?.owner || 'Sin responsable') : 'Equipo comercial'}</strong>
      <p class="muted">${!stage ? 'Obra completada' : approved ? dateText(stage.date) : 'Preparar o confirmar presupuesto'}</p></div>
    </div>
    <div class="detail-actions"><button class="button" data-tab="presupuesto" type="button">Ver presupuesto</button><button class="secondary" data-tab="seguimiento" type="button">Ver seguimiento</button></div>`;
}

function renderBudget() {
  $detail.innerHTML = `<form id="budget-form">
    <h3>Presupuesto por obra</h3><p class="muted">Ajustá cantidades y precios. El total se calcula en guaraníes.</p>
    <div class="budget-table">${budget.map((item,i) => `<div class="budget-row" data-index="${i}">
      <label>Partida<input data-field="description" required maxlength="120" value="${escape(item.description)}" placeholder="Descripción"></label>
      <label>Cantidad<input data-field="qty" type="number" min="1" max="9999" step="1" required value="${item.qty}"></label>
      <label>Unitario (G.)<input data-field="price" type="number" min="0" max="999999999" step="1" required value="${item.price}"></label>
      <output>${money(item.qty * item.price)}</output>
      <button class="remove" data-remove="${i}" aria-label="Quitar partida ${i+1}" type="button">×</button>
    </div>`).join('')}</div>
    <button class="secondary" id="add-line" type="button">＋ Agregar partida</button>
    <div class="total"><span>Total</span><strong id="budget-total">${money(sum(budget))}</strong></div>
    <label class="budget-meta">Estado del presupuesto<select id="budget-status">${STATUSES.map(state => `<option${state===budgetStatus ? ' selected' : ''}>${state}</option>`).join('')}</select></label>
    <div class="detail-actions"><button class="button" type="submit">Guardar presupuesto</button></div>
    <p class="inline-status" role="status"></p>
  </form>`;
}

function stageStatus(stage, index) {
  if (stage.done) return badge('Completada','done');
  const ready = index === active.stages.findIndex(item => !item.done);
  if (!ready) return badge('Pendiente','neutral');
  return stage.date && stage.date < DEMO_DATE ? badge('Vencida','late') : badge('Siguiente');
}

function renderStages() {
  $detail.innerHTML = `<form id="stages-form">
    <h3>Seguimiento de la obra</h3><p class="muted">Asigná responsables, definí fechas y registrá medidas o indicaciones.</p>
    ${active.stages.map((stage,i) => `<section class="stage" aria-labelledby="stage-${i}">
      <header class="stage-head"><h3 id="stage-${i}">${stage.name}</h3>${stageStatus(stage,i)}</header>
      <div class="form-grid">
        <label>Responsable<input name="owner-${i}" maxlength="75" value="${escape(stage.owner)}" placeholder="Persona o equipo"></label>
        <label>Fecha prevista<input name="date-${i}" type="date" value="${escape(stage.date)}"></label>
      </div>
      <label>Indicaciones<textarea name="note-${i}" rows="2" maxlength="420">${escape(stage.note)}</textarea></label>
      <label class="check"><input name="done-${i}" type="checkbox"${stage.done ? ' checked' : ''}>Marcar ${stage.name.toLowerCase()} como completada</label>
    </section>`).join('')}
    <button class="button" type="submit">Guardar seguimiento</button><p class="inline-status" role="status"></p>
  </form>`;
}

$filter.innerHTML = '<option value="">Todas las etapas</option>' + ['Presupuesto', ...STAGES,'Entregada'].map(stage => `<option>${stage}</option>`).join('');
$search.addEventListener('input',renderWork);
$filter.addEventListener('change',renderWork);

document.addEventListener('click', event => {
  const control = event.target.closest('button[data-open],button[data-tab],button[data-remove],#add-line');
  if (!control) return;
  if (control.dataset.open) openProject(control.dataset.open,control.dataset.section);
  else if (control.dataset.tab) showTab(control.dataset.tab);
  else if (control.id === 'add-line') {
    budget.push({description:'',qty:1,price:0});
    renderBudget();
    $detail.querySelector('.budget-row:last-child input').focus();
  } else {
    budget.splice(Number(control.dataset.remove),1);
    renderBudget();
    byId('add-line').focus();
  }
});

$detail.addEventListener('input', event => {
  const input = event.target;
  if (input.id === 'budget-status') budgetStatus = input.value;
  if (!input.dataset.field) return;
  const row = input.closest('.budget-row');
  const item = budget[Number(row.dataset.index)];
  const field = input.dataset.field;
  item[field] = field === 'description' ? input.value : Number(input.value);
  row.querySelector('output').value = money(item.qty * item.price);
  byId('budget-total').textContent = money(sum(budget));
});

$detail.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  const status = form.querySelector('.inline-status');
  if (form.id === 'budget-form') {
    if (budget.some(item => !item.description.trim())) {
      notify('Completá la descripción de cada partida.',status);
      return;
    }
    if (budgetStatus !== 'Borrador' && (!budget.length || sum(budget) <= 0)) {
      notify('Agregá una partida con importe antes de marcarlo como enviado o aprobado.',status);
      return;
    }
    active.lines = structuredClone(budget);
    active.status = budgetStatus;
    notify(persist() ? 'Presupuesto guardado.' : 'Presupuesto actualizado durante esta sesión.',status);
  } else {
    const data = new FormData(form);
    const stages = active.stages.map((stage,i) => ({
      name:stage.name,owner:data.get('owner-'+i).trim(),date:data.get('date-'+i),
      note:data.get('note-'+i).trim(),done:data.has('done-'+i)
    }));
    if (stages.some((stage,i) => stage.done && stages.slice(0,i).some(previous => !previous.done))) {
      notify('Completá las etapas en orden: medición, fabricación e instalación.',status);
      return;
    }
    active.stages = stages;
    const saved = persist();
    renderStages();
    notify(saved ? 'Seguimiento guardado.' : 'Seguimiento actualizado durante esta sesión.',$detail.querySelector('.inline-status'));
  }
  renderOverview();
});

byId('try').addEventListener('click',() => openProject('V-101'));
byId('new').addEventListener('click',() => { byId('create-form').reset(); $create.showModal(); });
byId('close-create').addEventListener('click',() => $create.close());
byId('close-project').addEventListener('click',() => $project.close());
byId('create-form').addEventListener('submit',event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  for (const field of ['name','client','city']) {
    if (!data[field].trim()) {
      form.elements[field].setCustomValidity('Ingresá un valor.');
      form.elements[field].reportValidity();
      return;
    }
  }
  const id = 'V-' + (Math.max(100,...projects.map(item => Number(item.id.slice(2)))) + 1);
  const project = {id,name:data.name.trim(),client:data.client.trim(),city:data.city.trim(),type:data.type,
    scope:data.scope.trim(),status:'Borrador',lines:[],stages:seedStages([])};
  projects.unshift(project);
  const saved = persist();
  $filter.value = '';
  $search.value = '';
  renderOverview();
  $create.close();
  openProject(id);
  notify(saved ? 'Obra creada.' : 'Obra creada durante esta sesión.');
});
byId('create-form').addEventListener('input',event => event.target.setCustomValidity?.(''));

byId('reset').addEventListener('click',() => {
  if (!window.confirm('¿Restaurar los ejemplos y borrar los cambios de esta demo en este navegador?')) return;
  projects = structuredClone(examples);
  persist();
  $filter.value = '';
  $search.value = '';
  renderOverview();
  notify('La demo volvió a los datos de ejemplo.');
});

for (const link of document.querySelectorAll('.sidebar nav a')) {
  link.addEventListener('click',() => {
    document.querySelector('.sidebar nav a.active')?.classList.remove('active');
    link.classList.add('active');
  });
}
renderOverview();
