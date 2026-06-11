/**
 * UTE Escobedo – Admin Core v4.4
 * Dashboard, CRUD edificios/rutas, reset
 * Dependencias: auth.js, data.js (incluye $ y toast), edificios.js
 */
'use strict';

/* ── AUTH CHECK ── */
Auth.injectUserBadge('userBadge', { basePath: '../' });
var session = Auth.getSession();
if (!session || session.role !== 'admin') window.location.href = '../index.html';

/* ── HELPERS ── */
var val = function(id) { var el = $(id); return el ? (el.value || '').trim() : ''; };
function openModal(id)  { var m = $(id); if (m) m.classList.add('open'); }
function closeModal(id) { var m = $(id); if (m) m.classList.remove('open'); }

/* ══════════════════════════════════════════════════
   SECTION SWITCHING
══════════════════════════════════════════════════ */
var SEC_TITLES = {
  dashboard: '<i class="fa-solid fa-chart-pie"></i> Dashboard',
  edificios: '<i class="fa-solid fa-building-columns"></i> Edificios',
  editor: '<i class="fa-solid fa-map"></i> Editor de Rutas',
  rutas: '<i class="fa-solid fa-bus"></i> Lista de Rutas',
  usuarios: '<i class="fa-solid fa-users"></i> Usuarios',
  log: '<i class="fa-solid fa-clipboard-list"></i> Actividad'
};
function showSec(name, el) {
  document.querySelectorAll('.a-sec').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.a-lnk').forEach(function(l) { l.classList.remove('active'); });
  var sec = $('sec-'+name); if (sec) sec.classList.add('active');
  if (el) el.classList.add('active');
  var t = $('aTitle'); if (t) t.innerHTML = SEC_TITLES[name] || name;
  if (name === 'editor') setTimeout(initEditorMap, 80);
  refreshAll();
}

/* ══════════════════════════════════════════════════
   ACTIVITY LOG
══════════════════════════════════════════════════ */
var actLog = [
  { msg:'Panel de administración iniciado', color:'#2E7D32', time:new Date().toLocaleTimeString('es-MX') },
  { msg:'Datos del campus cargados correctamente', color:'#1565C0', time:new Date().toLocaleTimeString('es-MX') }
];
function logAct(msg, color) { actLog.push({ msg:msg, color:color||'#F4821F', time:new Date().toLocaleString('es-MX') }); }
function renderLog() { $('actLog').innerHTML = actLog.slice().reverse().slice(0, 15).map(function(l) { return '<div class="log-item"><div class="log-dot" style="background:'+l.color+'"></div><div class="log-text">'+l.msg+'</div><div class="log-time">'+l.time+'</div></div>'; }).join(''); }

/* ══════════════════════════════════════════════════
   REFRESH ALL
══════════════════════════════════════════════════ */
function tipoBadge(t) { return { docencia:'orange', taller:'blue', servicio:'green' }[t] || 'gray'; }
function refreshAll() {
  var es = DB.getEdificios(), rs = DB.getRutas();
  $('st-ed').textContent = es.length; $('st-ru').textContent = rs.length;
  $('st-sa').textContent = es.reduce(function(a,e) { return a+e.salones.total; }, 0);
  $('tag-ed').textContent = es.length+' registros'; $('tag-ru').textContent = rs.length;

  $('tb-dash').innerHTML = es.map(function(e) { return '<tr><td><strong>'+e.id+'</strong></td><td>'+e.nombre+'</td><td><span class="badge badge-'+tipoBadge(e.tipo)+'">'+e.tipo+'</span></td><td>'+e.salones.total+'</td><td><span class="badge badge-green">Activo</span></td></tr>'; }).join('');

  $('tb-ed').innerHTML = es.map(function(e) { return '<tr><td><strong>'+e.id+'</strong></td><td>'+e.nombre+'</td><td><span class="badge badge-'+tipoBadge(e.tipo)+'">'+e.tipo+'</span></td><td style="font-size:.73rem">'+e.carreras.slice(0,2).join(', ')+(e.carreras.length>2?'…':'')+'</td><td>'+e.salones.total+'</td><td style="font-size:.72rem;color:var(--gris-400)">'+e.horario+'</td><td><div style="display:flex;gap:.3rem"><button class="btn btn-ghost btn-xs" onclick="openEditModal(\''+e.id+'\')"><i class="fa-solid fa-pen-to-square"></i> Editar</button><button class="btn btn-danger btn-xs" onclick="deleteEdificio(\''+e.id+'\')"><i class="fa-solid fa-trash-can"></i></button></div></td></tr>'; }).join('');

  $('tb-ru').innerHTML = rs.map(function(r) { return '<tr><td><strong>'+r.nombre+'</strong></td><td><span class="badge badge-'+(r.tipo==='publica'?'blue':'admin')+'">'+(r.tipo==='publica'?'Pública':'Escolar')+'</span></td><td style="font-size:.73rem">'+r.horarios.entrada.join(', ')+'</td><td style="font-size:.73rem">'+r.horarios.salida.join(', ')+'</td><td style="font-size:.73rem">'+r.costo+'</td><td>'+r.coords_ida.length+' pts</td><td><div style="display:flex;gap:.3rem"><button class="btn btn-ghost btn-xs" onclick="loadRutaEditor(\''+r.id+'\')"><i class="fa-solid fa-pen-to-square"></i></button><button class="btn btn-danger btn-xs" onclick="deleteRuta(\''+r.id+'\')"><i class="fa-solid fa-trash-can"></i></button></div></td></tr>'; }).join('');
  renderLog();
}

/* ══════════════════════════════════════════════════
   CRUD EDIFICIOS
══════════════════════════════════════════════════ */
function openEditModal(id) {
  var e = DB.getEdificios().find(function(x) { return x.id === id; }); if (!e) return;
  var fields = { 'me-id-orig':e.id, 'me-id':e.id, 'me-tipo':e.tipo, 'me-nombre':e.nombre, 'me-color':e.color, 'me-salones':e.salones.total, 'me-carreras':e.carreras.join(', '), 'me-grupos':e.grupos.join(', '), 'me-tramites':e.tramites.join(', '), 'me-horario':e.horario, 'me-lat':e.lat, 'me-lng':e.lng };
  Object.keys(fields).forEach(function(k) { var el = $(k); if (el) el.value = fields[k]; });
  $('modalEditarTitle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar: '+e.nombre;
  openModal('modalEditar');
}

function saveEdificio() {
  var origId = val('me-id-orig'); if (!origId) { toast('Error: no hay edificio seleccionado', 'error'); return; }
  var es = DB.getEdificios(), idx = es.findIndex(function(x) { return x.id === origId; });
  if (idx === -1) { toast('Edificio no encontrado', 'error'); return; }
  var total = parseInt(val('me-salones')) || 0, e = es[idx];
  es[idx] = { id:e.id, nombre:val('me-nombre'), tipo:val('me-tipo'), color:val('me-color'), horario:val('me-horario'), lat:parseFloat(val('me-lat'))||e.lat, lng:parseFloat(val('me-lng'))||e.lng, carreras:val('me-carreras').split(',').map(function(s){return s.trim();}).filter(Boolean), grupos:val('me-grupos').split(',').map(function(s){return s.trim();}).filter(Boolean), tramites:val('me-tramites').split(',').map(function(s){return s.trim();}).filter(Boolean), areas:e.areas, maestros:e.maestros, salones:{total:total, labs:e.salones.labs, aulas:e.salones.aulas, salas:e.salones.salas} };
  DB.saveEdificios(es); logAct('Edificio '+origId+' actualizado'); toast('Edificio '+origId+' guardado', 'success'); closeModal('modalEditar'); refreshAll();
}

function deleteFromModal() { var id = val('me-id-orig'); if (!id) return; if (!confirm('¿Eliminar edificio '+id+'?')) return; deleteEdificio(id); closeModal('modalEditar'); }
function openModalAdd() { openModal('modalAdd'); }

function addEdificio() {
  var id = val('ma-id').toUpperCase(), nombre = val('ma-nombre');
  if (!id || !nombre) { toast('ID y Nombre son obligatorios', 'error'); return; }
  var es = DB.getEdificios();
  if (es.find(function(e) { return e.id === id; })) { toast('El ID "'+id+'" ya existe', 'error'); return; }
  var total = parseInt(val('ma-sal')) || 0;
  es.push({ id:id, nombre:nombre, tipo:val('ma-tipo'), lat:parseFloat(val('ma-lat'))||CAMPUS_CENTER.lat, lng:parseFloat(val('ma-lng'))||CAMPUS_CENTER.lng, color:val('ma-color'), horario:val('ma-horario')||'Por definir', carreras:val('ma-carreras').split(',').map(function(s){return s.trim();}).filter(Boolean), areas:[], maestros:[], grupos:['Por definir'], tramites:['Por definir'], salones:{total:total, labs:0, aulas:total, salas:0} });
  DB.saveEdificios(es); logAct('Edificio '+id+' – '+nombre+' creado', '#2E7D32'); toast('Edificio '+id+' creado', 'success'); closeModal('modalAdd'); refreshAll();
}

function deleteEdificio(id) { if (!confirm('¿Eliminar edificio '+id+'?')) return; DB.saveEdificios(DB.getEdificios().filter(function(e) { return e.id !== id; })); logAct('Edificio '+id+' eliminado', '#C62828'); toast('Edificio '+id+' eliminado'); refreshAll(); }

/* ══════════════════════════════════════════════════
   CRUD RUTAS
══════════════════════════════════════════════════ */
function deleteRuta(id) { if (!confirm('¿Eliminar esta ruta?')) return; DB.saveRutas(DB.getRutas().filter(function(r) { return r.id !== id; })); logAct('Ruta '+id+' eliminada', '#C62828'); toast('Ruta eliminada'); refreshAll(); }

/* ══════════════════════════════════════════════════
   RESET
══════════════════════════════════════════════════ */
function confirmReset() { if (!confirm('⚠️ ¿Resetear TODOS los datos del campus?\n\nEsto eliminará todos los cambios hechos en edificios y rutas, restaurando los valores predeterminados. Esta acción NO se puede deshacer.\n\nEscribe "RESET" para confirmar:')) return; var check = prompt('Escribe RESET para confirmar:'); if (check !== 'RESET') { toast('Reseteo cancelado', 'info'); return; } DB.resetAll(); logAct('Datos reseteados al estado inicial', '#C62828'); toast('Datos reseteados a valores predeterminados', 'success'); refreshAll(); }

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
document.querySelectorAll('.modal-overlay').forEach(function(o) { o.addEventListener('click', function(e) { if (e.target === o) o.classList.remove('open'); }); });
document.addEventListener('DOMContentLoaded', refreshAll);
