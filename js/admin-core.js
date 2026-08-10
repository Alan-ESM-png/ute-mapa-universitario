/**
 * UTE Escobedo – Admin Core v4.7
 * Dashboard, CRUD edificios/rutas, reset, actividad
 * Dependencias: auth.js, data.js, edificios.js
 */
'use strict';

/* ── AUTH CHECK ── */
const session = Auth.getSession();
if (!session || session.role !== 'admin') {
  window.location.href = '../index.html';
}

/* ── HELPERS ── */
const val = id => { const el = $(id); return el ? (el.value || '').trim() : ''; };
function openModal(id)  { const m = $(id); if (m) m.classList.add('open'); }
function closeModal(id) { const m = $(id); if (m) m.classList.remove('open'); }

function btnLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (loading) {
    btn.classList.add('loading');
    btn.disabled = true;
    btn.setAttribute('data-original-text', btn.innerHTML);
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
    const orig = btn.getAttribute('data-original-text');
    if (orig) btn.innerHTML = orig;
  }
}

/* ── TOAST WITH UNDO ── */
let _lastDelete = null;

function toastWithUndo(msg, deleteInfo) {
  _lastDelete = deleteInfo;
  const c = document.getElementById('toast-c');
  if (!c) return;
  const t = document.createElement('div');
  t.className = 'toast warn';
  t.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap';
  t.innerHTML = '<i class="fa-solid fa-trash-can"></i> ' + msg +
    ' <button onclick="undoDelete()" style="background:#fff;color:var(--naranja);border:1.5px solid var(--naranja);padding:4px 12px;border-radius:14px;cursor:pointer;font-weight:700;font-size:.7rem;font-family:inherit;white-space:nowrap"><i class="fa-solid fa-rotate-left"></i> Deshacer</button>';
  c.appendChild(t);
  setTimeout(function() {
    t.style.transition = 'opacity .4s'; t.style.opacity = '0';
    setTimeout(function() { t.remove(); _lastDelete = null; }, 400);
  }, 7000);
}

function undoDelete() {
  if (!_lastDelete) { toast('Ya no se puede deshacer', 'info'); return; }
  try {
    if (_lastDelete.type === 'edificio') {
      const es = DB.getEdificios();
      es.push(_lastDelete.data);
      DB.saveEdificios(es);
      logAct('Edificio ' + _lastDelete.id + ' restaurado (deshacer)', '#2E7D32');
      toast('Edificio ' + _lastDelete.id + ' restaurado', 'success');
    } else if (_lastDelete.type === 'ruta') {
      const rs = DB.getRutas();
      rs.push(_lastDelete.data);
      DB.saveRutas(rs);
      logAct('Ruta restaurada (deshacer)', '#2E7D32');
      toast('Ruta restaurada', 'success');
    }
    _lastDelete = null;
    refreshAll();
  } catch (err) {
    console.error('undoDelete error:', err);
    toast('Error al deshacer', 'error');
  }
}

/* ══════════════════════════════════════════════════
   SECTION SWITCHING
══════════════════════════════════════════════════ */
const SEC_TITLES = {
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
  const sec = document.getElementById('sec-' + name);
  if (sec) sec.classList.add('active');
  if (el) el.classList.add('active');
  const t = document.getElementById('aTitle');
  if (t) t.innerHTML = SEC_TITLES[name] || name;
  if (name === 'editor') setTimeout(initEditorMap, 80);
  refreshAll();
}

/* ══════════════════════════════════════════════════
   ACTIVITY LOG
══════════════════════════════════════════════════ */
const actLog = [
  { msg: 'Panel de administracion iniciado', color: '#2E7D32', time: new Date().toLocaleTimeString('es-MX') },
  { msg: 'Datos del campus cargados correctamente', color: '#1565C0', time: new Date().toLocaleTimeString('es-MX') }
];

function logAct(msg, color) {
  actLog.push({ msg: msg, color: color || '#F4821F', time: new Date().toLocaleString('es-MX') });
}

function renderLog() {
  const al = document.getElementById('actLog');
  if (!al) return;
  al.innerHTML = actLog.slice().reverse().slice(0, 15).map(function(l) {
    return '<div class="log-item"><div class="log-dot" style="background:' + l.color + '"></div><div class="log-text">' + l.msg + '</div><div class="log-time">' + l.time + '</div></div>';
  }).join('');
}

/* ══════════════════════════════════════════════════
   REFRESH ALL
══════════════════════════════════════════════════ */
const tipoBadge = t => ({ docencia: 'orange', taller: 'blue', servicio: 'green' }[t] || 'gray');

const safeArr = v => Array.isArray(v) ? v : [];
const safeSalones = e => (e && e.salones) ? { total: e.salones.total || 0, labs: e.salones.labs || 0, aulas: e.salones.aulas || 0, salas: e.salones.salas || 0 } : { total: 0, labs: 0, aulas: 0, salas: 0 };

function refreshAll() {
  try {
    const es = DB.getEdificios(), rs = DB.getRutas();

    // Stats
    const stEd = document.getElementById('st-ed');
    const stRu = document.getElementById('st-ru');
    const stSa = document.getElementById('st-sa');
    if (stEd) stEd.textContent = es.length;
    if (stRu) stRu.textContent = rs.length;
    if (stSa) stSa.textContent = es.reduce(function(a, e) { return a + safeSalones(e).total; }, 0);

    // Tags
    const tagEd = document.getElementById('tag-ed');
    const tagRu = document.getElementById('tag-ru');
    if (tagEd) tagEd.textContent = es.length + ' registros';
    if (tagRu) tagRu.textContent = rs.length;

    // Dashboard table
    const tbDash = document.getElementById('tb-dash');
    if (tbDash) {
      tbDash.innerHTML = es.map(function(e) {
        const s = safeSalones(e);
        return '<tr><td><strong>' + e.id + '</strong></td><td>' + (e.nombre || '') + '</td><td><span class="badge badge-' + tipoBadge(e.tipo) + '">' + (e.tipo || '') + '</span></td><td>' + s.total + '</td><td><span class="badge badge-green">Activo</span></td></tr>';
      }).join('');
    }

    // Edificios table
    const tbEd = document.getElementById('tb-ed');
    if (tbEd) {
      tbEd.innerHTML = es.map(function(e) {
        const carreras = safeArr(e.carreras);
        const s = safeSalones(e);
        return '<tr><td><strong>' + e.id + '</strong></td><td>' + (e.nombre || '') + '</td><td><span class="badge badge-' + tipoBadge(e.tipo) + '">' + (e.tipo || '') + '</span></td><td style="font-size:.73rem">' + carreras.slice(0, 2).join(', ') + (carreras.length > 2 ? '...' : '') + '</td><td>' + s.total + '</td><td style="font-size:.72rem;color:var(--gris-400)">' + (e.horario || '') + '</td><td><div style="display:flex;gap:.3rem"><button class="btn btn-ghost btn-xs" onclick="openEditModal(\'' + e.id + '\')"><i class="fa-solid fa-pen-to-square"></i> Editar</button><button class="btn btn-danger btn-xs" onclick="deleteEdificio(\'' + e.id + '\')"><i class="fa-solid fa-trash-can"></i></button></div></td></tr>';
      }).join('');
    }

    // Rutas table
    const tbRu = document.getElementById('tb-ru');
    if (tbRu) {
      tbRu.innerHTML = rs.map(function(r) {
        const h = r.horarios || {};
        const entrada = safeArr(h.entrada);
        const salida = safeArr(h.salida);
        const coords = safeArr(r.coords_ida);
        return '<tr><td><strong>' + (r.nombre || '') + '</strong></td><td><span class="badge badge-' + (r.tipo === 'publica' ? 'blue' : 'admin') + '">' + (r.tipo === 'publica' ? 'Publica' : 'Escolar') + '</span></td><td style="font-size:.73rem">' + entrada.join(', ') + '</td><td style="font-size:.73rem">' + salida.join(', ') + '</td><td style="font-size:.73rem">' + (r.costo || '') + '</td><td>' + coords.length + ' pts</td><td><div style="display:flex;gap:.3rem"><button class="btn btn-ghost btn-xs" onclick="loadRutaEditor(\'' + r.id + '\')"><i class="fa-solid fa-pen-to-square"></i></button><button class="btn btn-danger btn-xs" onclick="deleteRuta(\'' + r.id + '\')"><i class="fa-solid fa-trash-can"></i></button></div></td></tr>';
      }).join('');
    }

    renderLog();
  } catch (err) {
    console.error('refreshAll error:', err);
  }
}

/* ══════════════════════════════════════════════════
   CRUD EDIFICIOS
══════════════════════════════════════════════════ */
function openEditModal(id) {
  const e = DB.getEdificios().find(function(x) { return x.id === id; });
  if (!e) return;
  const s = safeSalones(e);
  const fields = {
    'me-id-orig': e.id, 'me-id': e.id, 'me-tipo': e.tipo || 'docencia', 'me-nombre': e.nombre || '',
    'me-color': e.color || '#F4821F', 'me-salones': s.total,
    'me-carreras': safeArr(e.carreras).join(', '), 'me-grupos': safeArr(e.grupos).join(', '),
    'me-tramites': safeArr(e.tramites).join(', '), 'me-horario': e.horario || '',
    'me-lat': e.lat, 'me-lng': e.lng
  };
  Object.keys(fields).forEach(function(k) { const el = document.getElementById(k); if (el) el.value = fields[k]; });
  const mt = document.getElementById('modalEditarTitle');
  if (mt) mt.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar: ' + (e.nombre || '');
  openModal('modalEditar');
}

function saveEdificio() {
  try {
    const origId = val('me-id-orig');
    if (!origId) { toast('No hay edificio seleccionado', 'error'); return; }
    const es = DB.getEdificios();
    const idx = es.findIndex(function(x) { return x.id === origId; });
    if (idx === -1) { toast('Edificio no encontrado', 'error'); return; }

    btnLoading('btnSaveEdificio', true);

    const total = parseInt(val('me-salones')) || 0;
    const e = es[idx];
    const sOld = safeSalones(e);
    es[idx] = {
      id: e.id, nombre: val('me-nombre'), tipo: val('me-tipo'),
      color: val('me-color'), horario: val('me-horario'),
      lat: parseFloat(val('me-lat')) || e.lat, lng: parseFloat(val('me-lng')) || e.lng,
      carreras: val('me-carreras').split(',').map(function(s) { return s.trim(); }).filter(Boolean),
      grupos: val('me-grupos').split(',').map(function(s) { return s.trim(); }).filter(Boolean),
      tramites: val('me-tramites').split(',').map(function(s) { return s.trim(); }).filter(Boolean),
      areas: safeArr(e.areas), maestros: safeArr(e.maestros),
      salones: { total: total, labs: sOld.labs, aulas: sOld.aulas, salas: sOld.salas }
    };

    setTimeout(function() {
      DB.saveEdificios(es);
      logAct('Edificio ' + origId + ' actualizado');
      toast('Edificio ' + origId + ' guardado', 'success');
      btnLoading('btnSaveEdificio', false);
      closeModal('modalEditar');
      refreshAll();
    }, 350);
  } catch (err) {
    console.error('saveEdificio error:', err);
    toast('Error al guardar edificio', 'error');
    btnLoading('btnSaveEdificio', false);
  }
}

function deleteFromModal() {
  const id = val('me-id-orig');
  if (!id) return;
  if (!confirm('Eliminar edificio ' + id + '?')) return;
  deleteEdificio(id);
  closeModal('modalEditar');
}

function openModalAdd() { openModal('modalAdd'); }

function addEdificio() {
  try {
    const id = val('ma-id').toUpperCase(), nombre = val('ma-nombre');
    if (!id || !nombre) { toast('Completa al menos ID y Nombre del edificio', 'error'); return; }
    const es = DB.getEdificios();
    if (es.find(function(e) { return e.id === id; })) {
      toast('El ID "' + id + '" ya existe. Usa otro codigo.', 'error');
      return;
    }

    btnLoading('btnAddEdificio', true);

    const total = parseInt(val('ma-sal')) || 0;
    es.push({
      id: id, nombre: nombre, tipo: val('ma-tipo'),
      lat: parseFloat(val('ma-lat')) || CAMPUS_CENTER.lat,
      lng: parseFloat(val('ma-lng')) || CAMPUS_CENTER.lng,
      color: val('ma-color') || '#F4821F', horario: val('ma-horario') || 'Por definir',
      carreras: val('ma-carreras').split(',').map(function(s) { return s.trim(); }).filter(Boolean),
      areas: [], maestros: [],
      grupos: ['Por definir'], tramites: ['Por definir'],
      salones: { total: total, labs: 0, aulas: total, salas: 0 }
    });

    setTimeout(function() {
      DB.saveEdificios(es);
      logAct('Edificio ' + id + ' - ' + nombre + ' creado', '#2E7D32');
      toast('Edificio ' + id + ' creado correctamente', 'success');
      btnLoading('btnAddEdificio', false);
      closeModal('modalAdd');
      refreshAll();
    }, 350);
  } catch (err) {
    console.error('addEdificio error:', err);
    toast('Error al crear edificio', 'error');
    btnLoading('btnAddEdificio', false);
  }
}

function deleteEdificio(id) {
  if (!confirm('Eliminar el edificio ' + id + '?\n\nEsta accion se puede deshacer durante unos segundos.')) return;
  try {
    const es = DB.getEdificios();
    const building = es.find(function(e) { return e.id === id; });
    if (!building) return;
    DB.saveEdificios(es.filter(function(e) { return e.id !== id; }));
    logAct('Edificio ' + id + ' eliminado', '#C62828');
    toastWithUndo('Edificio ' + id + ' eliminado', { type: 'edificio', id: id, data: building });
    refreshAll();
  } catch (err) {
    console.error('deleteEdificio error:', err);
    toast('Error al eliminar edificio', 'error');
  }
}

/* ══════════════════════════════════════════════════
   CRUD RUTAS
══════════════════════════════════════════════════ */
function deleteRuta(id) {
  if (!confirm('Eliminar esta ruta de transporte?\n\nSe puede deshacer durante unos segundos.')) return;
  try {
    const rs = DB.getRutas();
    const route = rs.find(function(r) { return r.id === id; });
    if (!route) return;
    DB.saveRutas(rs.filter(function(r) { return r.id !== id; }));
    logAct('Ruta eliminada', '#C62828');
    toastWithUndo('Ruta eliminada', { type: 'ruta', id: id, data: route });
    refreshAll();
  } catch (err) {
    console.error('deleteRuta error:', err);
    toast('Error al eliminar ruta', 'error');
  }
}

/* ══════════════════════════════════════════════════
   RESET
══════════════════════════════════════════════════ */
function confirmReset() {
  if (!confirm('Resetear TODOS los datos del campus?\n\nEsto eliminara todos los cambios hechos en edificios y rutas, restaurando los valores predeterminados. Esta accion NO se puede deshacer.')) return;
  const check = prompt('Escribe RESET para confirmar:');
  if (check !== 'RESET') { toast('Reseteo cancelado', 'info'); return; }
  DB.resetAll();
  logAct('Datos reseteados al estado inicial', '#C62828');
  toast('Datos reseteados a valores predeterminados', 'success');
  refreshAll();
}

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
// Cerrar modales al clicar fuera
document.querySelectorAll('.modal-overlay').forEach(function(o) {
  o.addEventListener('click', function(e) { if (e.target === o) o.classList.remove('open'); });
});

// Inyectar badge de usuario
document.addEventListener('DOMContentLoaded', function() {
  Auth.injectUserBadge('userBadge', { basePath: '../' });
});

// Llamada inicial — puebla el dashboard al cargar
refreshAll();
