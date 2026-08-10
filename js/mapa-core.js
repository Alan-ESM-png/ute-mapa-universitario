/**
 * UTE Escobedo – Mapa Core v4.6
 * Lógica central: mapa, marcadores, rutas, panel info, sidebar, dark mode.
 * Dependencias: auth.js, data.js (incluye $ y toast), edificios.js, Leaflet
 *
 * 🛡️ Refactor v4.6:
 *   - var → const/let en todo el módulo
 *   - Debounce (200ms) en clics de edificios para evitar saturación
 *   - try/catch en toda manipulación de DOM y localStorage
 *   - Degradación grácil si Leaflet no carga (sin throw)
 *   - Comentarios JSDoc en funciones críticas
 */
'use strict';

/* ════════════════════════════════════════════════════
   DARK MODE — Persistencia + prefers-color-scheme
════════════════════════════════════════════════════ */
const storedDark = (() => { try { return localStorage.getItem('ute_dark'); } catch { return null; } })();
let isDark = storedDark === 'true' || (storedDark === null && window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches);

function applyDark(on) {
  isDark = on;
  document.documentElement.classList.toggle('dark', on);
  const b = $('btnDark');
  if (b) b.innerHTML = on ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  try { localStorage.setItem('ute_dark', on); } catch { /* storage quota exceeded */ }
}
applyDark(isDark);

function toggleDark() {
  applyDark(!isDark);
  if (currentLayerKey === 'carto' || currentLayerKey === 'dark') {
    switchLayer(isDark ? 'dark' : 'carto');
  }
}

/* ════════════════════════════════════════════════════
   AUTH SESSION — Actualiza la UI según el rol
════════════════════════════════════════════════════ */
let sess = Auth.getSession();
if (!sess) sess = Auth.loginAsVisitor();

function updateNavUI() {
  try {
    const isVisitor = !sess || sess.role === 'visitor';
    const bl = $('btnLoginNav'), uw = $('uWrap');
    if (bl) bl.style.display = isVisitor ? 'flex' : 'none';
    if (uw) uw.style.display = isVisitor ? 'none' : 'block';
    if (!isVisitor) {
      const uAv = $('uAv'), uNm = $('uNm'), uRl = $('uRl');
      const udAv = $('udAv'), udNm = $('udNm'), udEm = $('udEm');
      if (uAv) uAv.textContent = sess.avatar;
      if (uNm) uNm.textContent = sess.name;
      if (uRl) uRl.textContent = Auth.getRoleLabel(sess.role);
      if (udAv) udAv.textContent = sess.avatar;
      if (udNm) udNm.textContent = sess.name;
      if (udEm) udEm.textContent = sess.email || 'Sin correo';
      const udPerfil = $('udPerfil'), udAdmin = $('udAdmin');
      if (udPerfil) udPerfil.style.display = sess.role === 'visitor' ? 'none' : 'flex';
      if (udAdmin) udAdmin.style.display = sess.role === 'admin' ? 'flex' : 'none';
    }
    if (Auth.can('edit_map')) {
      const ar = $('adminRow');
      if (ar) ar.style.display = 'flex';
    } else {
      const ar = $('adminRow');
      if (ar) ar.style.display = 'none';
    }
  } catch (err) {
    console.warn('updateNavUI falló:', err);
  }
}
updateNavUI();

// Cerrar dropdown de usuario al clicar fuera
document.addEventListener('click', function(e) {
  const w = $('uWrap');
  if (w && !w.contains(e.target)) {
    const d = $('uDrop');
    if (d) d.classList.remove('open');
  }
});

/* ════════════════════════════════════════════════════
   BUILDING STATUS — Determina si un edificio está
   abierto ahora mismo según su horario
════════════════════════════════════════════════════ */
const DAY_MAP = { Lun:1, Mar:2, "Mié":3, Mie:3, Jue:4, Vie:5, "Sáb":6, Sab:6, Dom:0 };

/**
 * Parsea un string de horario y devuelve {open, closesAt, minsLeft}.
 * Soporta múltiples segmentos separados por "|".
 * @param {string} horario — ej: "Lun–Vie 7:00–21:00 h | Sáb 8:00–14:00 h"
 * @returns {{open:boolean, closesAt:string|null, minsLeft:number}}
 */
function getBuildingStatus(horario) {
  try {
    const now = new Date(), dow = now.getDay(), hhmm = now.getHours() * 60 + now.getMinutes();
    const tm2m = function(t) { const p = t.split(':').map(Number); return p[0] * 60 + p[1]; };
    const segs = horario.split('|').map(function(s) { return s.trim(); });
    for (let i = 0; i < segs.length; i++) {
      const dm = segs[i].match(/([A-Za-zÁÉÍÓÚáéíóúÑñ]+)[–-]([A-Za-zÁÉÍÓÚáéíóúÑñ]+)/u);
      const tm = segs[i].match(/(\d{1,2}:\d{2})[–-](\d{1,2}:\d{2})/);
      if (!tm) continue;
      const sm = tm2m(tm[1]), em = tm2m(tm[2]);
      let dayOk = true;
      if (dm) {
        const d1 = DAY_MAP[dm[1]], d2 = DAY_MAP[dm[2]];
        if (d1 !== undefined && d2 !== undefined) {
          dayOk = d1 <= d2 ? (dow >= d1 && dow <= d2) : (dow >= d1 || dow <= d2);
        }
      }
      if (dayOk && hhmm >= sm && hhmm < em) {
        return { open: true, closesAt: tm[2], minsLeft: em - hhmm };
      }
    }
  } catch (e) {
    console.warn('getBuildingStatus error:', e);
  }
  return { open: false, closesAt: null, minsLeft: 0 };
}

/* ════════════════════════════════════════════════════
   MAP INIT — Inicialización de Leaflet con fallback
   grácil si el CDN no cargó
════════════════════════════════════════════════════ */
let mapReady = false;

if (typeof L === 'undefined') {
  // Degradación grácil: mostrar error en el skeleton sin detener el resto del JS
  const sk = document.getElementById('map-skeleton');
  if (sk) {
    sk.innerHTML = '<div style="text-align:center;padding:3rem"><i class="fa-solid fa-triangle-exclamation" style="font-size:3rem;color:var(--rojo)"></i><p style="margin-top:1rem;font-size:1rem;font-weight:600">Error al cargar el mapa</p><p style="font-size:.8rem;color:var(--gris-400)">Verifica tu conexión a internet y recarga la página.</p></div>';
  }
  console.error('Leaflet no disponible — verifica la conexión a internet.');
  // No lanzamos throw para que el resto de la UI (búsqueda, sidebar, etc.) siga funcionando
}

/** @type {import('leaflet').Map} */
let map = null;
if (typeof L !== 'undefined') {
  map = L.map('map', {
    center: [CAMPUS_CENTER.lat, CAMPUS_CENTER.lng],
    zoom: 17,
    zoomControl: false,
    maxZoom: 21,
    tap: true,
    touchZoom: true,
    dragging: true
  });
  L.control.zoom({ position: 'bottomleft' }).addTo(map);
}

const TILES = typeof L !== 'undefined' ? {
  carto:    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '&copy; <a href="https://osm.org">OSM</a> &copy; CARTO', maxZoom: 20 }),
  dark:     L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',          { attribution: '&copy; <a href="https://osm.org">OSM</a> &copy; CARTO', maxZoom: 20 }),
  gStreet:  L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { subdomains: '0123', attribution: '&copy; Google', maxZoom: 21 }),
  gSat:     L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { subdomains: '0123', attribution: '&copy; Google', maxZoom: 21 }),
  gHybrid:  L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { subdomains: '0123', attribution: '&copy; Google', maxZoom: 21 }),
  gTerrain: L.tileLayer('https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', { subdomains: '0123', attribution: '&copy; Google', maxZoom: 21 }),
  osm:      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',        { attribution: '&copy; <a href="https://osm.org">OSM</a> contributors', maxZoom: 19 })
} : {};

if (map) {
  L.control.layers({}, {}, { collapsed: true }).addTo(map);
}

let currentLayerKey = isDark ? 'dark' : 'carto';
if (map && TILES[currentLayerKey]) TILES[currentLayerKey].addTo(map);

function updateLayerDropUI(key) { document.querySelectorAll('.layer-opt').forEach(el => el.classList.toggle('active', el.dataset.l === key)); }
if (map) updateLayerDropUI(currentLayerKey);

function switchLayer(key) {
  if (!map || !TILES[key] || key === currentLayerKey) { const ld = $('layerDrop'); if (ld) ld.classList.remove('open'); return; }
  map.removeLayer(TILES[currentLayerKey]);
  TILES[key].addTo(map);
  currentLayerKey = key;
  updateLayerDropUI(key);
  const ld = $('layerDrop'), bl = $('btnLayers');
  if (ld) ld.classList.remove('open');
  if (bl) bl.classList.remove('active');
}

/** Toggle del dropdown de capas con posicionamiento dinámico. */
function toggleLayerDrop() {
  const d = $('layerDrop'), b = $('btnLayers');
  if (!d || !b) return;
  const isOpen = d.classList.contains('open');
  if (!isOpen) {
    const r = b.getBoundingClientRect();
    d.style.top = (r.bottom + 8) + 'px';
    const l = r.right - 228;
    d.style.left = (l < 8 ? 8 : l) + 'px';
    d.style.right = 'auto';
  }
  d.classList.toggle('open', !isOpen);
  b.classList.toggle('active', !isOpen);
}

// Cerrar dropdown de capas al clicar fuera
document.addEventListener('click', function(e) {
  const lw = $('layerWrap');
  if (lw && !lw.contains(e.target)) {
    const ld = $('layerDrop'), bl = $('btnLayers');
    if (ld) ld.classList.remove('open');
    if (bl) bl.classList.remove('active');
  }
});

/* ════════════════════════════════════════════════════
   SKELETON → RENDER — Oculta el skeleton loader
   cuando el mapa está listo
════════════════════════════════════════════════════ */
if (map) {
  map.whenReady(function() {
    setTimeout(function() {
      const sk = $('map-skeleton');
      if (sk) {
        sk.style.transition = 'opacity .5s ease';
        sk.style.opacity = '0';
        setTimeout(function() { if (sk.parentNode) sk.parentNode.removeChild(sk); }, 500);
      }
      mapReady = true;
      renderList();
      if (!localStorage.getItem('ute_onboarded')) setTimeout(startOnboarding, 800);
    }, 1400);
  });
}

/* ════════════════════════════════════════════════════
   DATA & STATE — Estado global del módulo
════════════════════════════════════════════════════ */

// Inicializar datos desde MySQL (async, actualiza localStorage al completar)
DB.init().then(function() {
  // Refrescar datos en memoria después de cargar del backend
  edificios = DB.getEdificios();
  rutas = DB.getRutas();
  // Re-renderizar si el mapa ya está listo
  if (mapReady) {
    renderList(); // renderMarkers no existe - usamos renderList
  }
}).catch(function() { /* backend no disponible, usar datos locales */ });

let edificios = DB.getEdificios();
let rutas = DB.getRutas();
let mkMap = {};
let activeId = null;
let activeFilter = 'all';
let rutasOn = false;
let adminMode = false;
let sbOpen = true;

/* Debounce timer para clics en edificios (evita saturación) */
let selectDebounceTimer = null;

/* ════════════════════════════════════════════════════
   MARKERS — Crea y gestiona los íconos en el mapa
════════════════════════════════════════════════════ */

function makeDivIcon(e, drag) {
  const st = getBuildingStatus(e.horario), d = drag ? ' draggable' : '';
  return L.divIcon({className: '', iconSize: [36, 36], iconAnchor: [18, 18],
    html: '<div class="ute-mk' + d + '" id="m-' + e.id + '" style="background:' + e.color + '">' + e.id + '<div class="ute-mk-dot ' + (st.open ? 'open' : 'closed') + '"></div></div>'
  });
}

if (map) {
  edificios.forEach(function(e) {
    const m = L.marker([e.lat, e.lng], { icon: makeDivIcon(e), draggable: false, autoPan: true }).addTo(map)
      .bindTooltip('<strong>' + e.nombre + '</strong><br><small style="color:#888">' + e.tipo + '</small>', { sticky: true });
    m.on('click', function(ev) { L.DomEvent.stopPropagation(ev); selectEdificio(e.id); });
    m.on('dragend', function(ev) {
      try {
        const ll = ev.target.getLatLng();
        const all = DB.getEdificios();
        const idx = all.findIndex(function(x) { return x.id === e.id; });
        if (idx !== -1) {
          all[idx].lat = +ll.lat.toFixed(6);
          all[idx].lng = +ll.lng.toFixed(6);
          DB.saveEdificios(all);
          edificios = all;
        }
        toast(e.id + ' reposicionado', 'success');
        updateCoordDisplay(e.id, ll.lat, ll.lng);
      } catch (err) { toast('Error al guardar posición', 'error'); }
    });
    mkMap[e.id] = m;
  });
}

/* ════════════════════════════════════════════════════
   ROUTES — Construcción de polilíneas y paradas
════════════════════════════════════════════════════ */
let rutaLayers = {}, rutaVis = {};

/** Construye un LayerGroup para una ruta (ida + vuelta con paradas). */
function buildRutaLayer(r) {
  const lg = L.layerGroup();
  const dash = r.tipo === 'publica' ? '12 6' : '5 6';
  L.polyline(r.coords_ida, {
    color: r.color, weight: 4.5, dashArray: dash, opacity: .9
  }).on('click', function(ev) { L.DomEvent.stopPropagation(ev); showRutaPopup(r, ev.latlng, 'ida'); }).addTo(lg);
  L.polyline(r.coords_vuelta, {
    color: r.color, weight: 2.5, dashArray: '5 8', opacity: .55
  }).on('click', function(ev) { L.DomEvent.stopPropagation(ev); showRutaPopup(r, ev.latlng, 'vuelta'); }).addTo(lg);
  r.coords_ida.slice(0, -1).forEach(function(c, i) {
    const ic = L.divIcon({
      className: '',
      html: '<div style="width:9px;height:9px;border-radius:50%;background:' + r.color +
            ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25)"></div>',
      iconSize: [9, 9], iconAnchor: [4.5, 4.5]
    });
    L.marker(c, { icon: ic }).bindTooltip(r.paradas_ida[i] || '', { sticky: true }).addTo(lg);
  });
  return lg;
}

if (typeof L !== 'undefined') { rutas.forEach(function(r) { rutaLayers[r.id] = buildRutaLayer(r); rutaVis[r.id] = false; }); }

/** Construye el panel colapsable de sub-rutas individuales en el sidebar. */
function buildRutasSub() {
  const el = $('rutasSub');
  if (el) el.innerHTML = rutas.map(function(r) {
    return '<div class="ru-opt" onclick="toggleRutaInd(\'' + r.id + '\')"><div class="ru-opt-l"><div class="ru-dot" style="background:' + r.color + '"></div>' + r.nombre + '</div><span class="ru-badge" id="rb-' + r.id + '">Oculta</span></div>';
  }).join('');
}
buildRutasSub();

function toggleRutas() {
  if (!map) return;
  rutasOn = !rutasOn;
  const rt = $('rutasToggle'), rs = $('rutasSub');
  if (rt) rt.classList.toggle('on', rutasOn);
  if (rs) rs.classList.toggle('open', rutasOn);
  rutas.forEach(function(r) {
    rutaVis[r.id] = rutasOn;
    if (rutasOn) map.addLayer(rutaLayers[r.id]);
    else map.removeLayer(rutaLayers[r.id]);
    const e = $('rb-' + r.id);
    if (e) { e.textContent = rutasOn ? 'Visible' : 'Oculta'; e.classList.toggle('on', rutasOn); }
  });
}

function toggleRutaInd(id) {
  if (!map) return;
  const v = !rutaVis[id];
  rutaVis[id] = v;
  if (v) map.addLayer(rutaLayers[id]);
  else map.removeLayer(rutaLayers[id]);
  const e = $('rb-' + id);
  if (e) { e.textContent = v ? 'Visible' : 'Oculta'; e.classList.toggle('on', v); }
}

function showRutaPopup(r, latlng, sentido) {
  const lis = (sentido === 'ida' ? r.paradas_ida : r.paradas_vuelta).map(p => '<li style="padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:.75rem">' + p + '</li>').join('');
  const pagos = r.metodoPago.map(p => '<span style="display:inline-block;margin:2px;background:#f0f0f0;border-radius:12px;padding:2px 9px;font-size:.7rem">' + p + '</span>').join('');
  const h = r.horarios;
  L.popup({ maxWidth: 288 }).setLatLng(latlng).setContent(
    '<div style="font-family:Inter,sans-serif">' +
    '<div style="font-size:.6rem;font-weight:700;text-transform:uppercase;color:' + r.color + ';margin-bottom:4px">' + (r.tipo === 'publica' ? '🚌 Ruta Pública' : '🎓 Transporte Escolar') + '</div>' +
    '<div style="font-size:.9rem;font-weight:700;color:#111;margin-bottom:5px">' + r.nombre + '</div>' +
    '<div style="font-size:.73rem;color:#555;margin-bottom:7px;line-height:1.6">🟢 Entrada: ' + h.entrada.join(' y ') + '<br>🔵 Salida: ' + h.salida.join(' y ') + '<br>💰 ' + r.costo + '</div>' +
    (r.nota ? '<div style="background:#fffde7;border-left:3px solid #f9a825;padding:5px 7px;font-size:.7rem;margin-bottom:7px;border-radius:4px;line-height:1.5">⚠️ ' + r.nota + '</div>' : '') +
    '<div style="font-size:.6rem;font-weight:700;text-transform:uppercase;color:#aaa;margin-bottom:3px">📍 ' + (sentido === 'ida' ? 'IDA ➡' : 'VUELTA ⬅') + '</div>' +
    '<ul style="list-style:none;padding:0;margin:0 0 7px">' + lis + '</ul>' +
    '<div style="font-size:.6rem;font-weight:700;text-transform:uppercase;color:#aaa;margin-bottom:3px">💳 Pago</div><div>' + pagos + '</div></div>'
  ).openOn(map);
}

/* ════════════════════════════════════════════════════
   ADMIN MODE — Activa el modo editor para arrastrar
   marcadores en el mapa (solo admin)
════════════════════════════════════════════════════ */
if (Auth.can('edit_map')) {
  const ar = $('adminRow');
  if (ar) ar.style.display = 'flex';
}

function toggleAdminMode() {
  if (!Auth.can('edit_map') || !map) return;
  adminMode = !adminMode;
  const ar = $('adminRow'), al = $('adminLbl'), dh = $('dragHint');
  if (ar) ar.classList.toggle('on', adminMode);
  if (al) al.innerHTML = adminMode
    ? '<i class="fa-solid fa-pen-to-square"></i> Modo Editor: ON'
    : '<i class="fa-solid fa-pen-to-square"></i> Modo Editor: OFF';
  if (dh) dh.classList.toggle('show', adminMode);
  edificios.forEach(function(e) {
    const m = mkMap[e.id];
    if (!m) return;
    if (adminMode) {
      m.dragging.enable();
      m.setIcon(makeDivIcon(e, true));
    } else {
      m.dragging.disable();
      m.setIcon(makeDivIcon(e, false));
    }
  });
  toast(adminMode ? 'Modo editor ON' : 'Editor desactivado', adminMode ? 'warn' : 'success');
}

function updateCoordDisplay(id, lat, lng) {
  if (activeId !== id) return;
  const l = document.getElementById('coord-lat'), g = document.getElementById('coord-lng');
  if (l) l.textContent = lat.toFixed(6);
  if (g) g.textContent = lng.toFixed(6);
}

/* ════════════════════════════════════════════════════
   SIDEBAR TOGGLE — Colapsa/expande el panel lateral
════════════════════════════════════════════════════ */
function toggleSidebar() {
  sbOpen = !sbOpen;
  const sb = $('sidebar'), st = $('sbToggle');
  if (sb) sb.classList.toggle('collapsed', !sbOpen);
  if (st) st.classList.toggle('off', !sbOpen);
  setTimeout(() => { if (map) map.invalidateSize(); }, 340);
}

/* ════════════════════════════════════════════════════
   RECENTS — Edificios visitados recientemente (top 4)
════════════════════════════════════════════════════ */
function getRecents() {
  try { return JSON.parse(localStorage.getItem('ute_recents') || '[]'); }
  catch (e) { return []; }
}

function addRecent(id) {
  let r = getRecents().filter(function(x) { return x !== id; });
  r.unshift(id);
  r = r.slice(0, 4);
  try { localStorage.setItem('ute_recents', JSON.stringify(r)); } catch {}
  renderRecents();
}

function renderRecents() {
  const rc = getRecents(), w = $('sbRecents'), c = $('recentChips');
  if (!rc.length) { if (w) w.style.display = 'none'; return; }
  if (w) w.style.display = 'block';
  if (c) c.innerHTML = rc.map(function(id) {
    const e = edificios.find(function(x) { return x.id === id; });
    return e ? '<div class="recent-chip" onclick="selectEdificio(\'' + id + '\')"><div class="rc-dot" style="background:' + e.color + '"></div>' + e.id + '</div>' : '';
  }).join('');
}

/* ════════════════════════════════════════════════════
   BUILDING LIST — Render de la lista lateral
════════════════════════════════════════════════════ */
function renderList() {
  if (!mapReady) return;
  const ul = $('eList'); if (!ul) return;
  const filtered = edificios.filter(e => activeFilter === 'all' || e.tipo === activeFilter);
  if (!filtered.length) { ul.innerHTML = '<div class="sr-empty"><i class="fa-solid fa-face-frown" style="font-size:1.5rem;margin-bottom:.4rem;display:block"></i> No se encontraron resultados<br><span style="font-size:.72rem;color:var(--gris-400)">Intenta con otro término</span></div>'; return; }
  ul.innerHTML = filtered.map(e => {
    const st = getBuildingStatus(e.horario);
    return '<li class="e-item' + (activeId === e.id ? ' active' : '') + '" id="item-' + e.id + '" onclick="selectEdificio(\'' + e.id + '\')"><div class="e-mk" style="background:' + e.color + '">' + e.id + '</div><div><div class="e-name">' + e.nombre + '</div><div class="e-sub">' + (e.carreras || []).slice(0, 2).join(' · ') + '</div></div><div class="e-status ' + (st.open ? 'open' : 'closed') + '">' + (st.open ? 'Abierto' : 'Cerrado') + '</div></li>';
  }).join('');
}

// Filtros del sidebar (Todos / Docencias / Talleres / Servicios)
document.querySelectorAll('.fchip').forEach(function(chip) {
  chip.addEventListener('click', function() {
    document.querySelectorAll('.fchip').forEach(function(c) { c.classList.remove('active'); });
    chip.classList.add('active');
    activeFilter = chip.dataset.f;
    renderList();
  });
});

/* ════════════════════════════════════════════════════
   SELECT BUILDING — Con debounce para evitar
   saturación por clics rápidos repetidos
════════════════════════════════════════════════════ */

/**
 * Selecciona un edificio por ID: centra el mapa, abre el panel de info
 * y resalta el marcador. Incluye debounce de 200ms para prevenir
 * múltiples invocaciones por clics rápidos o erráticos.
 * @param {string} id — ID del edificio (D1–D8, T1–T3)
 */
function selectEdificio(id) {
  // Debounce: ignora llamadas repetidas en < 200ms
  if (selectDebounceTimer) clearTimeout(selectDebounceTimer);
  selectDebounceTimer = setTimeout(function() {
    try {
      const e = edificios.find(function(x) { return x.id === id; });
      if (!e) return;
      activeId = id;
      addRecent(id);
      renderList();
      renderRecents();

      // Resaltar marcador visualmente
      document.querySelectorAll('.ute-mk').forEach(function(m) { m.classList.remove('sel'); });
      const mk = document.getElementById('m-' + id);
      if (mk) mk.classList.add('sel');

      if (map) map.flyTo([e.lat, e.lng], 18, { duration: .7, easeLinearity: .35 });

      if (window.innerWidth >= 769) openInfoPanel(e);
      else openBottomSheet(e);
    } catch (err) {
      console.warn('selectEdificio falló para ' + id + ':', err);
      toast('Error al seleccionar edificio', 'error');
    }
  }, 200);
}

function animateCounter(el, target) {
  let cur = 0; const step = Math.ceil(target / 20);
  (function tick() { cur = Math.min(cur + step, target); el.textContent = cur; if (cur < target) requestAnimationFrame(tick); })();
}

/* ════════════════════════════════════════════════════
   INFO CONTENT BUILDER — Construye el HTML del panel
   de información (compartido por desktop y mobile)
════════════════════════════════════════════════════ */

/**
 * Construye el objeto de contenido para el panel de info de un edificio.
 * @param {Object} e — Objeto edificio de EDIFICIOS_DATA
 * @returns {{st, carreras, grupos, maestros, tramites, coordBlock, infr}}
 */
function buildInfoContent(e) {
  const st = getBuildingStatus(e.horario);
  const carreras = e.carreras.map(function(c) { return '<div class="i-carrera">' + c + '</div>'; }).join('');
  const grupos = e.grupos.map(function(g) { return '<span class="i-grupo">' + g + '</span>'; }).join('');
  const maestros = e.maestros.map(function(m) {
    return '<div class="i-maestro"><div class="i-av">' + m.ini + '</div><div class="i-mname">' + m.nombre + '</div></div>';
  }).join('');
  const tramites = e.tramites.map(function(t) {
    return '<div class="i-tramite"><div class="i-tdot"></div>' + t + '</div>';
  }).join('');
  const coordBlock = sess.role === 'admin'
    ? '<hr class="i-div"/><div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-location-dot"></i> Coordenadas GPS</div>' +
      '<div class="i-coord-row"><div class="i-coord"><span class="i-clbl">LAT</span><span id="coord-lat">' + e.lat.toFixed(6) + '</span></div>' +
      '<div class="i-coord"><span class="i-clbl">LNG</span><span id="coord-lng">' + e.lng.toFixed(6) + '</span></div></div>' +
      (adminMode ? '<div style="font-size:.65rem;color:#E65100;margin-top:.38rem"><i class="fa-solid fa-arrows-up-down-left-right"></i> Arrastra el marcador para mover</div>' : '') + '</div>'
    : '';
  return { st: st, carreras: carreras, grupos: grupos, maestros: maestros, tramites: tramites, coordBlock: coordBlock, infr: e.salones };
}

/** Genera el HTML del cuerpo del panel de info. */
function infoBodyHTML(c) {
  return '<div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-graduation-cap"></i> Carreras / Áreas</div>' + c.carreras + '</div>' +
    '<hr class="i-div"/>' +
    '<div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-users"></i> Grupos activos</div><div class="i-grupos">' + c.grupos + '</div></div>' +
    '<hr class="i-div"/>' +
    '<div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-chalkboard-user"></i> Maestros destacados</div>' + c.maestros + '</div>' +
    '<hr class="i-div"/>' +
    '<div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-file-lines"></i> Trámites disponibles</div>' + c.tramites + '</div>' +
    '<hr class="i-div"/>' +
    '<div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-building"></i> Infraestructura</div>' +
    '<div class="i-salones">' +
    '<div class="i-salon"><div class="i-snum" data-target="' + c.infr.total + '">0</div><div class="i-slbl">Total</div></div>' +
    '<div class="i-salon"><div class="i-snum" data-target="' + c.infr.labs + '">0</div><div class="i-slbl">Labs</div></div>' +
    '<div class="i-salon"><div class="i-snum" data-target="' + c.infr.aulas + '">0</div><div class="i-slbl">Aulas</div></div>' +
    '<div class="i-salon"><div class="i-snum" data-target="' + c.infr.salas + '">0</div><div class="i-slbl">Salas</div></div>' +
    '</div></div>' + c.coordBlock;
}

/* ════════════════════════════════════════════════════
   INFO PANEL (desktop ≥ 769px)
════════════════════════════════════════════════════ */
function openInfoPanel(e) {
  const c = buildInfoContent(e);
  const tipos = { docencia: 'Docencia', taller: 'Taller', servicio: 'Servicio' };

  const iph = $('infoPH'), ic = $('infoContent'), ip = $('infoPanel');
  if (iph) iph.style.display = 'none';
  if (ic) ic.style.display = 'flex';
  if (ip) ip.classList.add('open');
  setTimeout(function() { if (map) map.invalidateSize(); }, 340);

  const ih = $('infoHead');
  if (ih) {
    ih.style.background = e.color;
    ih.innerHTML = '<button class="info-close" onclick="closeInfoPanel()"><i class="fa-solid fa-xmark"></i></button>' +
      '<div class="info-head-row"><div class="info-id">' + e.id + '</div>' +
      '<div><div class="info-title">' + e.nombre + '</div>' +
      '<div class="info-sub">' + (e.tipo.charAt(0).toUpperCase() + e.tipo.slice(1)) + ' · ' + (e.horario || "").split("|")[0].trim() + '</div></div></div>';
  }

  const bct = $('bcType'), bcn = $('bcName');
  if (bct) bct.textContent = tipos[e.tipo] || e.tipo;
  if (bcn) bcn.textContent = e.id;

  const sb = $('infoStatusBadge');
  if (sb) sb.className = 'info-status-badge ' + (c.st.open ? 'open' : 'closed');
  const ist = $('infoStatusText');
  if (ist) ist.textContent = c.st.open ? 'Abierto ahora' : 'Cerrado ahora';
  const isc = $('infoSchedule');
  if (isc) isc.textContent = c.st.open ? 'Cierra a las ' + c.st.closesAt : (e.horario || "").split("|")[0].trim();

  const ib = $('infoBody');
  if (ib) ib.innerHTML = infoBodyHTML(c);
  document.querySelectorAll('.i-snum[data-target]').forEach(function(el) { animateCounter(el, +el.dataset.target); });
}

/** Cierra el panel de info y deselecciona todo. */
function closeInfoPanel() {
  activeId = null;
  const ip = $('infoPanel'), iph = $('infoPH'), ic = $('infoContent');
  if (ip) ip.classList.remove('open');
  if (iph) iph.style.display = 'flex';
  if (ic) ic.style.display = 'none';
  document.querySelectorAll('.ute-mk').forEach(m => m.classList.remove('sel'));
  setTimeout(() => { if (map) map.invalidateSize(); }, 340);
  renderList();
}

/* ════════════════════════════════════════════════════
   MOBILE BOTTOM SHEET (< 769px)
════════════════════════════════════════════════════ */
function openBottomSheet(e) {
  const c = buildInfoContent(e);
  const sh = $('sheetHead');
  if (sh) sh.innerHTML = '<div class="info-head" style="background:' + e.color +
    ';border-radius:var(--radius-xl) var(--radius-xl) 0 0;margin:-0.2rem -1.2rem 0;padding:.9rem 1.1rem">' +
    '<button class="sheet-close" onclick="closeBS()"><i class="fa-solid fa-xmark"></i></button>' +
    '<div class="info-head-row"><div class="info-id">' + e.id + '</div>' +
    '<div><div class="info-title">' + e.nombre + '</div><div class="info-sub">' + e.tipo + '</div></div></div></div>' +
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0 .2rem">' +
    '<div class="info-status-badge ' + (c.st.open ? 'open' : 'closed') + '"><div class="info-status-dot"></div>' +
    (c.st.open ? 'Abierto ahora' : 'Cerrado ahora') + '</div>' +
    '<div class="info-schedule" style="font-size:.67rem;color:var(--gris-400)">' +
    (c.st.open ? 'Cierra ' + c.st.closesAt : '') + '</div></div>';

  const sb = $('sheetBody');
  if (sb) sb.innerHTML = '<div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-graduation-cap"></i> Carreras / Áreas</div>' + c.carreras + '</div>' +
    '<hr class="i-div"/>' +
    '<div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-chalkboard-user"></i> Maestros</div>' + c.maestros + '</div>' +
    '<hr class="i-div"/>' +
    '<div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-file-lines"></i> Trámites</div>' + c.tramites + '</div>' +
    '<hr class="i-div"/>' +
    '<div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-building"></i> Infraestructura</div>' +
    '<div class="i-salones">' +
    '<div class="i-salon"><div class="i-snum" data-target="' + c.infr.total + '">0</div><div class="i-slbl">Total</div></div>' +
    '<div class="i-salon"><div class="i-snum" data-target="' + c.infr.labs + '">0</div><div class="i-slbl">Labs</div></div>' +
    '<div class="i-salon"><div class="i-snum" data-target="' + c.infr.aulas + '">0</div><div class="i-slbl">Aulas</div></div>' +
    '<div class="i-salon"><div class="i-snum" data-target="' + c.infr.salas + '">0</div><div class="i-slbl">Salas</div></div>' +
    '</div></div>';

  const bo = $('bsOverlay');
  if (bo) bo.classList.add('open');
  setTimeout(function() {
    document.querySelectorAll('#sheetBody .i-snum[data-target]').forEach(function(el) { animateCounter(el, +el.dataset.target); });
  }, 100);
}

function closeBS() {
  const bo = $('bsOverlay');
  if (bo) bo.classList.remove('open');
  activeId = null;
  document.querySelectorAll('.ute-mk').forEach(function(m) { m.classList.remove('sel'); });
}

function closeBSifOverlay(e) {
  if (e.target === $('bsOverlay')) closeBS();
}

/* ════════════════════════════════════════════════════
   KEYBOARD NAVIGATION — Escape, Ctrl+K, flechas
════════════════════════════════════════════════════ */
document.addEventListener('keydown', function(e) {
  // Ignorar navegación con flechas cuando el foco está en un input/textarea/select
  const tag = (e.target.tagName || '').toLowerCase();
  if (e.key !== 'Escape' && (tag === 'input' || tag === 'textarea' || tag === 'select')) return;
  if (e.key === 'Escape') {
    // Cerrar overlays en orden de prioridad
    const lmo = $('loginModalOverlay'), so = $('searchOverlay'), bo = $('bsOverlay');
    if (lmo && lmo.classList.contains('open')) { closeLoginModal(); return; }
    if (so && so.classList.contains('open')) { closeSearch(); return; }
    if (bo && bo.classList.contains('open')) { closeBS(); return; }
    const ip = $('infoPanel');
    if (ip && ip.classList.contains('open')) { closeInfoPanel(); return; }
    const oo = $('onboardingOverlay');
    if (oo && oo.style.display !== 'none') { endOnboarding(); return; }
  }
  // Ctrl+K / Cmd+K → búsqueda
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    if (typeof openSearch === 'function') openSearch();
    return;
  }
  // Navegación con flechas en el overlay de búsqueda
  const so2 = $('searchOverlay');
  if (so2 && so2.classList.contains('open') && typeof closeSearch === 'function') {
    const items = $('searchResults').querySelectorAll('.sr-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      searchFocusIdx = Math.min(searchFocusIdx + 1, items.length - 1);
      items.forEach(function(el, i) { el.classList.toggle('focused', i === searchFocusIdx); });
      if (items[searchFocusIdx]) items[searchFocusIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      searchFocusIdx = Math.max(searchFocusIdx - 1, 0);
      items.forEach(function(el, i) { el.classList.toggle('focused', i === searchFocusIdx); });
      if (items[searchFocusIdx]) items[searchFocusIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const f = $('searchResults').querySelector('.sr-item.focused');
      if (f) f.click();
      else if (items.length === 1) items[0].click();
    }
    return;
  }
  // Navegación con flechas en la lista de edificios
  const allIds = edificios.filter(function(eb) { return activeFilter === 'all' || eb.tipo === activeFilter; }).map(function(eb) { return eb.id; });
  const cur = allIds.indexOf(activeId);
  if (e.key === 'ArrowDown' && cur < allIds.length - 1) selectEdificio(allIds[cur + 1]);
  else if (e.key === 'ArrowUp' && cur > 0) selectEdificio(allIds[cur - 1]);
});

/* ════════════════════════════════════════════════════
   FAB BUTTONS & MAP CLICK
════════════════════════════════════════════════════ */
const btnCenter = $('btnCenter');
if (btnCenter) {
  btnCenter.addEventListener('click', function() {
    if (map) map.flyTo([CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], 17, { duration: 1.1, easeLinearity: .35 });
  });
}

const btnMyLoc = $('btnMyLoc');
if (btnMyLoc) {
  btnMyLoc.addEventListener('click', function() {
    if (!navigator.geolocation) { toast('Geolocalización no soportada', 'error'); return; }
    toast('Obteniendo tu ubicación…', 'info', 2000);
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        if (!map) return;
        map.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { duration: 1.2 });
        const icon = L.divIcon({
          className: '',
          html: '<div style="width:16px;height:16px;border-radius:50%;background:#1565C0;border:3px solid #fff;box-shadow:0 0 0 4px rgba(21,101,192,.3),0 3px 10px rgba(0,0,0,.3);animation:pulse 2s infinite"></div><style>@keyframes pulse{0%,100%{box-shadow:0 0 0 4px rgba(21,101,192,.3),0 3px 10px rgba(0,0,0,.3)}50%{box-shadow:0 0 0 12px rgba(21,101,192,0),0 3px 10px rgba(0,0,0,.3)}}</style>',
          iconSize: [16, 16], iconAnchor: [8, 8]
        });
        L.marker([pos.coords.latitude, pos.coords.longitude], { icon: icon }).addTo(map)
          .bindPopup('<strong>📍 Estás aquí</strong>', { closeButton: false }).openPopup();
        toast('Ubicación encontrada', 'success');
      },
      function(err) {
        let msg = 'No se pudo obtener tu ubicación';
        if (err.code === 1) msg = 'Permiso de ubicación denegado';
        else if (err.code === 2) msg = 'Ubicación no disponible';
        else if (err.code === 3) msg = 'Tiempo de espera agotado';
        toast(msg, 'error');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

// Clic en el mapa (fuera de marcadores) → cerrar panel
if (map) {
  map.on('click', function() {
    if (window.innerWidth >= 769) closeInfoPanel();
    else closeBS();
  });
}

/* ════════════════════════════════════════════════════
   FOOTER STATS & ACERCA DE
════════════════════════════════════════════════════ */
function updateFooterStats() {
  try {
    let totalCarreras = 0, totalMaestros = 0;
    edificios.forEach(function(e) { totalCarreras += e.carreras.length; totalMaestros += e.maestros.length; });
    const el = document.getElementById('footer-stats');
    if (el) el.innerHTML = '<i class="fa-solid fa-building-columns"></i> ' + edificios.length + ' edificios · <i class="fa-solid fa-graduation-cap"></i> ' + totalCarreras + ' carreras · <i class="fa-solid fa-chalkboard-user"></i> ' + totalMaestros + ' maestros · <i class="fa-solid fa-bus"></i> ' + rutas.length + ' rutas';
  } catch (e) { /* no crítico */ }
}
updateFooterStats();

function openAcercaDe() {
  const ao = document.getElementById('acercaOverlay');
  if (ao) ao.classList.add('open');
}

/* ════════════════════════════════════════════════════
   SINCRONIZACIÓN ENTRE PESTAÑAS — Detecta cambios
   en localStorage desde otras pestañas (admin panel)
   y reconstruye el mapa sin recargar la página.
════════════════════════════════════════════════════ */
window.addEventListener('storage', function(ev) {
  try {
    if (ev.key === 'ute_edificios') {
      edificios = DB.getEdificios();
      Object.keys(mkMap).forEach(function(id) { if (mkMap[id] && map) map.removeLayer(mkMap[id]); });
      mkMap = {};
      edificios.forEach(function(e) {
        const m = L.marker([e.lat, e.lng], { icon: makeDivIcon(e), draggable: adminMode, autoPan: true }).addTo(map)
          .bindTooltip('<strong>' + e.nombre + '</strong><br><small style="color:#888">' + e.tipo + '</small>', { sticky: true });
        m.on('click', function(ev) { L.DomEvent.stopPropagation(ev); selectEdificio(e.id); });
        m.on('dragend', function(ev) {
          const ll = ev.target.getLatLng(), all = DB.getEdificios();
          const idx = all.findIndex(function(x) { return x.id === e.id; });
          if (idx !== -1) { all[idx].lat = +ll.lat.toFixed(6); all[idx].lng = +ll.lng.toFixed(6); DB.saveEdificios(all); edificios = all; }
          toast(e.id + ' reposicionado', 'success');
          updateCoordDisplay(e.id, ll.lat, ll.lng);
        });
        mkMap[e.id] = m;
        if (adminMode) { m.dragging.enable(); m.setIcon(makeDivIcon(e, true)); }
      });
      renderList(); renderRecents(); updateFooterStats();
      if (activeId) {
        const activeE = edificios.find(function(x) { return x.id === activeId; });
        if (activeE) {
          if (window.innerWidth >= 769) openInfoPanel(activeE); else openBottomSheet(activeE);
        }
      }
      toast('🔄 Datos actualizados desde otra pestaña', 'info', 2500);
    }
    if (ev.key === 'ute_rutas') {
      rutas = DB.getRutas();
      Object.keys(rutaLayers).forEach(function(id) { if (rutaLayers[id] && rutaVis[id] && map) map.removeLayer(rutaLayers[id]); });
      rutaLayers = {}; rutaVis = {};
      rutas.forEach(function(r) { rutaLayers[r.id] = buildRutaLayer(r); rutaVis[r.id] = false; });
      buildRutasSub();
      if (rutasOn) {
        rutas.forEach(function(r) { rutaVis[r.id] = true; if (map) map.addLayer(rutaLayers[r.id]); });
        document.querySelectorAll('[id^="rb-"]').forEach(function(el) { el.textContent = 'Visible'; el.classList.add('on'); });
      }
      updateFooterStats();
      toast('🔄 Rutas actualizadas desde otra pestaña', 'info', 2500);
    }
  } catch (e) { console.warn('Error en sync entre pestañas:', e); }
});

/* ════════════════════════════════════════════════════
   URL PARAM & INIT — Carga el edificio indicado en
   la URL (?edificio=D4) tras un breve delay para que
   el mapa y los datos estén listos
════════════════════════════════════════════════════ */
(function() {
  try {
    const p = new URLSearchParams(location.search);
    const id = p.get('edificio');
    if (id) setTimeout(function() { selectEdificio(id); }, 1600);
  } catch (e) { /* query string mal formada */ }
})();
renderRecents();
