/**
 * UTE Escobedo – Mapa Core v4.3
 * Lógica central: mapa, marcadores, rutas, panel info, sidebar, dark mode
 * Dependencias: auth.js, data.js (incluye $ y toast), edificios.js, Leaflet
 */
'use strict';

/* ════════════════════════════════════════════════════
   DARK MODE
════════════════════════════════════════════════════ */
var storedDark = localStorage.getItem('ute_dark');
var isDark = storedDark === 'true' || (storedDark === null && window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches);
function applyDark(on) {
  isDark = on;
  document.documentElement.classList.toggle('dark', on);
  var b = $('btnDark'); if (b) b.innerHTML = on ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  localStorage.setItem('ute_dark', on);
}
applyDark(isDark);
function toggleDark() { applyDark(!isDark); if (currentLayerKey === 'carto' || currentLayerKey === 'dark') switchLayer(isDark ? 'dark' : 'carto'); }

/* ════════════════════════════════════════════════════
   AUTH SESSION
════════════════════════════════════════════════════ */
var sess = Auth.getSession();
if (!sess) sess = Auth.loginAsVisitor();
function updateNavUI() {
  var isVisitor = !sess || sess.role === 'visitor';
  var bl = $('btnLoginNav'), uw = $('uWrap');
  if (bl) bl.style.display = isVisitor ? 'flex' : 'none';
  if (uw) uw.style.display = isVisitor ? 'none' : 'block';
  if (!isVisitor) {
    $('uAv').textContent = sess.avatar; $('uNm').textContent = sess.name;
    $('uRl').textContent = Auth.getRoleLabel(sess.role);
    $('udAv').textContent = sess.avatar; $('udNm').textContent = sess.name;
    $('udEm').textContent = sess.email || 'Sin correo';
    $('udPerfil').style.display = sess.role === 'visitor' ? 'none' : 'flex';
    $('udAdmin').style.display = sess.role === 'admin' ? 'flex' : 'none';
  }
  if (Auth.can('edit_map') && $('adminRow')) $('adminRow').style.display = 'flex';
  else if ($('adminRow')) $('adminRow').style.display = 'none';
}
updateNavUI();
document.addEventListener('click', function(e) {
  var w = $('uWrap'); if (w && !w.contains(e.target)) { var d = $('uDrop'); if (d) d.classList.remove('open'); }
});

/* ════════════════════════════════════════════════════
   BUILDING STATUS
════════════════════════════════════════════════════ */
function getBuildingStatus(horario) {
  var now = new Date(), dow = now.getDay(), hhmm = now.getHours() * 60 + now.getMinutes();
  var DAY_MAP = { Lun:1,Mar:2,'Mié':3,Jue:4,Vie:5,'Sáb':6,Dom:0,Mie:3 };
  var tm2m = function(t) { var p = t.split(':').map(Number); return p[0]*60+p[1]; };
  var segs = horario.split('|').map(function(s) { return s.trim(); });
  for (var i = 0; i < segs.length; i++) {
    var dm = segs[i].match(/([A-ZÁÉÍÓÚña-z]+)–([A-ZÁÉÍÓÚña-z]+)/u);
    var tm = segs[i].match(/(\d{1,2}:\d{2})–(\d{1,2}:\d{2})/);
    if (!tm) continue;
    var sm = tm2m(tm[1]), em = tm2m(tm[2]);
    var dayOk = true;
    if (dm) { var d1 = DAY_MAP[dm[1]], d2 = DAY_MAP[dm[2]]; if (d1 !== undefined && d2 !== undefined) dayOk = d1 <= d2 ? (dow >= d1 && dow <= d2) : (dow >= d1 || dow <= d2); }
    if (dayOk && hhmm >= sm && hhmm < em) return { open: true, closesAt: tm[2], minsLeft: em - hhmm };
  }
  return { open: false, closesAt: null, minsLeft: 0 };
}

/* ════════════════════════════════════════════════════
   MAP INIT (con fallback si Leaflet no cargó)
════════════════════════════════════════════════════ */
var mapReady = false;
if (typeof L === 'undefined') {
  document.getElementById('map-skeleton').innerHTML = '<div style="text-align:center;padding:3rem"><i class="fa-solid fa-triangle-exclamation" style="font-size:3rem;color:var(--rojo)"></i><p style="margin-top:1rem;font-size:1rem;font-weight:600">Error al cargar el mapa</p><p style="font-size:.8rem;color:var(--gris-400)">Verifica tu conexión a internet y recarga la página.</p></div>';
  throw new Error('Leaflet no disponible');
}
var map = L.map('map', { center: [CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], zoom: 17, zoomControl: false, maxZoom: 21, tap: true, touchZoom: true, dragging: true });
L.control.zoom({ position: 'bottomleft' }).addTo(map);

var TILES = {
  carto:    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '&copy; <a href="https://osm.org">OSM</a> &copy; CARTO', maxZoom: 20 }),
  dark:     L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',          { attribution: '&copy; <a href="https://osm.org">OSM</a> &copy; CARTO', maxZoom: 20 }),
  gStreet:  L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { subdomains: '0123', attribution: '&copy; Google', maxZoom: 21 }),
  gSat:     L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { subdomains: '0123', attribution: '&copy; Google', maxZoom: 21 }),
  gHybrid:  L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { subdomains: '0123', attribution: '&copy; Google', maxZoom: 21 }),
  gTerrain: L.tileLayer('https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', { subdomains: '0123', attribution: '&copy; Google', maxZoom: 21 }),
  osm:      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',        { attribution: '&copy; <a href="https://osm.org">OSM</a> contributors', maxZoom: 19 })
};
L.control.layers({}, {}, { collapsed: true }).addTo(map);

var currentLayerKey = isDark ? 'dark' : 'carto';
TILES[currentLayerKey].addTo(map);

function updateLayerDropUI(key) { document.querySelectorAll('.layer-opt').forEach(function(el) { el.classList.toggle('active', el.dataset.l === key); }); }
updateLayerDropUI(currentLayerKey);

function switchLayer(key) {
  if (!TILES[key] || key === currentLayerKey) { $('layerDrop').classList.remove('open'); return; }
  map.removeLayer(TILES[currentLayerKey]); TILES[key].addTo(map); currentLayerKey = key;
  updateLayerDropUI(key); $('layerDrop').classList.remove('open'); $('btnLayers').classList.remove('active');
}

function toggleLayerDrop() {
  var d = $('layerDrop'), b = $('btnLayers'), isOpen = d.classList.contains('open');
  if (!isOpen) { var r = b.getBoundingClientRect(); d.style.top = (r.bottom + 8) + 'px'; var l = r.right - 228; d.style.left = (l < 8 ? 8 : l) + 'px'; d.style.right = 'auto'; }
  d.classList.toggle('open', !isOpen); b.classList.toggle('active', !isOpen);
}
document.addEventListener('click', function(e) { var lw = $('layerWrap'); if (lw && !lw.contains(e.target)) { $('layerDrop').classList.remove('open'); $('btnLayers').classList.remove('active'); } });

/* ════════════════════════════════════════════════════
   SKELETON → RENDER
════════════════════════════════════════════════════ */
map.whenReady(function() {
  setTimeout(function() {
    var sk = $('map-skeleton'); if (sk) { sk.style.transition = 'opacity .5s ease'; sk.style.opacity = '0'; setTimeout(function() { if (sk.parentNode) sk.parentNode.removeChild(sk); }, 500); }
    mapReady = true; renderList();
    if (!localStorage.getItem('ute_onboarded')) setTimeout(startOnboarding, 800);
  }, 1400);
});

/* ════════════════════════════════════════════════════
   DATA & STATE
════════════════════════════════════════════════════ */
var edificios = DB.getEdificios(), rutas = DB.getRutas(), mkMap = {};
var activeId = null, activeFilter = 'all', rutasOn = false, adminMode = false, sbOpen = true;

/* ════════════════════════════════════════════════════
   MARKERS
════════════════════════════════════════════════════ */
function makeDivIcon(e, drag) {
  var st = getBuildingStatus(e.horario);
  return L.divIcon({ className: '', html: '<div class="ute-mk' + (drag ? ' draggable' : '') + '" id="m-' + e.id + '" style="background:' + e.color + '">' + e.id + '<div class="ute-mk-dot ' + (st.open ? 'open' : 'closed') + '"></div></div>', iconSize: [36, 36], iconAnchor: [18, 18] });
}
edificios.forEach(function(e) {
  var m = L.marker([e.lat, e.lng], { icon: makeDivIcon(e), draggable: false, autoPan: true }).addTo(map)
    .bindTooltip('<strong>' + e.nombre + '</strong><br><small style="color:#888">' + e.tipo + '</small>', { sticky: true });
  m.on('click', function(ev) { L.DomEvent.stopPropagation(ev); selectEdificio(e.id); });
  m.on('dragend', function(ev) { var ll = ev.target.getLatLng(), all = DB.getEdificios(), idx = all.findIndex(function(x) { return x.id === e.id; }); if (idx !== -1) { all[idx].lat = +ll.lat.toFixed(6); all[idx].lng = +ll.lng.toFixed(6); DB.saveEdificios(all); edificios = all; } toast(e.id + ' reposicionado', 'success'); updateCoordDisplay(e.id, ll.lat, ll.lng); });
  mkMap[e.id] = m;
});

/* ════════════════════════════════════════════════════
   ROUTES
════════════════════════════════════════════════════ */
var rutaLayers = {}, rutaVis = {};
function buildRutaLayer(r) {
  var lg = L.layerGroup(), dash = r.tipo === 'publica' ? '12 6' : '5 6';
  L.polyline(r.coords_ida, { color: r.color, weight: 4.5, dashArray: dash, opacity: .9 }).on('click', function(ev) { L.DomEvent.stopPropagation(ev); showRutaPopup(r, ev.latlng, 'ida'); }).addTo(lg);
  L.polyline(r.coords_vuelta, { color: r.color, weight: 2.5, dashArray: '5 8', opacity: .55 }).on('click', function(ev) { L.DomEvent.stopPropagation(ev); showRutaPopup(r, ev.latlng, 'vuelta'); }).addTo(lg);
  r.coords_ida.slice(0,-1).forEach(function(c,i) { var ic = L.divIcon({ className:'', html:'<div style="width:9px;height:9px;border-radius:50%;background:'+r.color+';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25)"></div>', iconSize:[9,9], iconAnchor:[4.5,4.5] }); L.marker(c,{icon:ic}).bindTooltip(r.paradas_ida[i]||'',{sticky:true}).addTo(lg); });
  return lg;
}
rutas.forEach(function(r) { rutaLayers[r.id] = buildRutaLayer(r); rutaVis[r.id] = false; });

function buildRutasSub() { var el = $('rutasSub'); if (el) el.innerHTML = rutas.map(function(r) { return '<div class="ru-opt" onclick="toggleRutaInd(\''+r.id+'\')"><div class="ru-opt-l"><div class="ru-dot" style="background:'+r.color+'"></div>'+r.nombre+'</div><span class="ru-badge" id="rb-'+r.id+'">Oculta</span></div>'; }).join(''); }
buildRutasSub();

function toggleRutas() {
  rutasOn = !rutasOn; $('rutasToggle').classList.toggle('on', rutasOn); $('rutasSub').classList.toggle('open', rutasOn);
  rutas.forEach(function(r) { rutaVis[r.id] = rutasOn; if (rutasOn) map.addLayer(rutaLayers[r.id]); else map.removeLayer(rutaLayers[r.id]); var e = $('rb-'+r.id); if (e) { e.textContent = rutasOn ? 'Visible' : 'Oculta'; e.classList.toggle('on', rutasOn); } });
}
function toggleRutaInd(id) { var v = !rutaVis[id]; rutaVis[id] = v; if (v) map.addLayer(rutaLayers[id]); else map.removeLayer(rutaLayers[id]); var e = $('rb-'+id); if (e) { e.textContent = v ? 'Visible' : 'Oculta'; e.classList.toggle('on', v); } }

function showRutaPopup(r, latlng, sentido) {
  var lista = sentido === 'ida' ? r.paradas_ida : r.paradas_vuelta;
  var paradas = lista.map(function(p) { return '<li style="padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:.75rem">'+p+'</li>'; }).join('');
  var pagos = r.metodoPago.map(function(p) { return '<span style="display:inline-block;margin:2px;background:#f0f0f0;border-radius:12px;padding:2px 9px;font-size:.7rem">'+p+'</span>'; }).join('');
  L.popup({ maxWidth:288 }).setLatLng(latlng).setContent('<div style="font-family:Inter,sans-serif"><div style="font-size:.6rem;font-weight:700;text-transform:uppercase;color:'+r.color+';margin-bottom:4px">'+(r.tipo==='publica'?'🚌 Ruta Pública':'🎓 Transporte Escolar')+'</div><div style="font-size:.9rem;font-weight:700;color:#111;margin-bottom:5px">'+r.nombre+'</div><div style="font-size:.73rem;color:#555;margin-bottom:7px;line-height:1.6">🟢 Entrada: '+r.horarios.entrada.join(' y ')+'<br>🔵 Salida: '+r.horarios.salida.join(' y ')+'<br>💰 '+r.costo+'</div>'+(r.nota?'<div style="background:#fffde7;border-left:3px solid #f9a825;padding:5px 7px;font-size:.7rem;margin-bottom:7px;border-radius:4px;line-height:1.5">⚠️ '+r.nota+'</div>':'')+'<div style="font-size:.6rem;font-weight:700;text-transform:uppercase;color:#aaa;margin-bottom:3px">📍 '+(sentido==='ida'?'IDA ➡':'VUELTA ⬅')+'</div><ul style="list-style:none;padding:0;margin:0 0 7px">'+paradas+'</ul><div style="font-size:.6rem;font-weight:700;text-transform:uppercase;color:#aaa;margin-bottom:3px">💳 Pago</div><div>'+pagos+'</div></div>').openOn(map);
}

/* ════════════════════════════════════════════════════
   ADMIN MODE
════════════════════════════════════════════════════ */
if (Auth.can('edit_map') && $('adminRow')) $('adminRow').style.display = 'flex';
function toggleAdminMode() {
  if (!Auth.can('edit_map')) return; adminMode = !adminMode;
  $('adminRow').classList.toggle('on', adminMode);
  $('adminLbl').innerHTML = adminMode ? '<i class="fa-solid fa-pen-to-square"></i> Modo Editor: ON' : '<i class="fa-solid fa-pen-to-square"></i> Modo Editor: OFF';
  $('dragHint').classList.toggle('show', adminMode);
  edificios.forEach(function(e) { var m = mkMap[e.id]; if (!m) return; if (adminMode) { m.dragging.enable(); m.setIcon(makeDivIcon(e, true)); } else { m.dragging.disable(); m.setIcon(makeDivIcon(e, false)); } });
  toast(adminMode ? 'Modo editor ON' : 'Editor desactivado', adminMode ? 'warn' : 'success');
}
function updateCoordDisplay(id, lat, lng) { if (activeId !== id) return; var l = document.getElementById('coord-lat'), g = document.getElementById('coord-lng'); if (l) l.textContent = lat.toFixed(6); if (g) g.textContent = lng.toFixed(6); }

/* ════════════════════════════════════════════════════
   SIDEBAR TOGGLE
════════════════════════════════════════════════════ */
function toggleSidebar() { sbOpen = !sbOpen; $('sidebar').classList.toggle('collapsed', !sbOpen); $('sbToggle').classList.toggle('off', !sbOpen); setTimeout(function() { map.invalidateSize(); }, 340); }

/* ════════════════════════════════════════════════════
   RECENTS
════════════════════════════════════════════════════ */
function getRecents() { try { return JSON.parse(localStorage.getItem('ute_recents') || '[]'); } catch(e) { return []; } }
function addRecent(id) { var r = getRecents().filter(function(x) { return x !== id; }); r.unshift(id); r = r.slice(0, 4); localStorage.setItem('ute_recents', JSON.stringify(r)); renderRecents(); }
function renderRecents() { var rc = getRecents(), w = $('sbRecents'), c = $('recentChips'); if (!rc.length) { if (w) w.style.display = 'none'; return; } if (w) w.style.display = 'block'; c.innerHTML = rc.map(function(id) { var e = edificios.find(function(x) { return x.id === id; }); return e ? '<div class="recent-chip" onclick="selectEdificio(\''+id+'\')"><div class="rc-dot" style="background:'+e.color+'"></div>'+e.id+'</div>' : ''; }).join(''); }

/* ════════════════════════════════════════════════════
   BUILDING LIST
════════════════════════════════════════════════════ */
function renderList() {
  if (!mapReady) return; var ul = $('eList'); ul.innerHTML = '';
  var filtered = edificios.filter(function(e) { return activeFilter === 'all' || e.tipo === activeFilter; });
  if (!filtered.length) { ul.innerHTML = '<div class="sr-empty"><i class="fa-solid fa-face-frown" style="font-size:1.5rem;margin-bottom:.4rem;display:block"></i> No se encontraron resultados<br><span style="font-size:.72rem;color:var(--gris-400)">Intenta con otro término</span></div>'; return; }
  filtered.forEach(function(e) { var st = getBuildingStatus(e.horario), li = document.createElement('li'); li.className = 'e-item'+(activeId===e.id?' active':''); li.id = 'item-'+e.id; li.innerHTML = '<div class="e-mk" style="background:'+e.color+'">'+e.id+'</div><div><div class="e-name">'+e.nombre+'</div><div class="e-sub">'+e.carreras.slice(0,2).join(' · ')+'</div></div><div class="e-status '+(st.open?'open':'closed')+'">'+(st.open?'Abierto':'Cerrado')+'</div>'; li.addEventListener('click', function() { selectEdificio(e.id); }); ul.appendChild(li); });
}
document.querySelectorAll('.fchip').forEach(function(chip) { chip.addEventListener('click', function() { document.querySelectorAll('.fchip').forEach(function(c) { c.classList.remove('active'); }); chip.classList.add('active'); activeFilter = chip.dataset.f; renderList(); }); });

/* ════════════════════════════════════════════════════
   SELECT BUILDING
════════════════════════════════════════════════════ */
function selectEdificio(id) {
  var e = edificios.find(function(x) { return x.id === id; }); if (!e) return;
  activeId = id; addRecent(id); renderList(); renderRecents();
  document.querySelectorAll('.ute-mk').forEach(function(m) { m.classList.remove('sel'); });
  var mk = document.getElementById('m-'+id); if (mk) mk.classList.add('sel');
  map.flyTo([e.lat, e.lng], 18, { duration: .7, easeLinearity: .35 });
  if (window.innerWidth >= 769) openInfoPanel(e); else openBottomSheet(e);
}
function animateCounter(el, target) { var cur = 0, step = Math.ceil(target / 20); function tick() { cur = Math.min(cur + step, target); el.textContent = cur; if (cur < target) requestAnimationFrame(tick); } requestAnimationFrame(tick); }

/* ════════════════════════════════════════════════════
   INFO CONTENT BUILDER (shared by panel + sheet)
════════════════════════════════════════════════════ */
function buildInfoContent(e) {
  var st = getBuildingStatus(e.horario);
  var carreras = e.carreras.map(function(c) { return '<div class="i-carrera">'+c+'</div>'; }).join('');
  var grupos = e.grupos.map(function(g) { return '<span class="i-grupo">'+g+'</span>'; }).join('');
  var maestros = e.maestros.map(function(m) { return '<div class="i-maestro"><div class="i-av">'+m.ini+'</div><div class="i-mname">'+m.nombre+'</div></div>'; }).join('');
  var tramites = e.tramites.map(function(t) { return '<div class="i-tramite"><div class="i-tdot"></div>'+t+'</div>'; }).join('');
  var coordBlock = sess.role === 'admin' ? '<hr class="i-div"/><div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-location-dot"></i> Coordenadas GPS</div><div class="i-coord-row"><div class="i-coord"><span class="i-clbl">LAT</span><span id="coord-lat">'+e.lat.toFixed(6)+'</span></div><div class="i-coord"><span class="i-clbl">LNG</span><span id="coord-lng">'+e.lng.toFixed(6)+'</span></div></div>'+(adminMode?'<div style="font-size:.65rem;color:#E65100;margin-top:.38rem"><i class="fa-solid fa-arrows-up-down-left-right"></i> Arrastra el marcador para mover</div>':'')+'</div>' : '';
  var infr = e.salones;
  return { st:st, carreras:carreras, grupos:grupos, maestros:maestros, tramites:tramites, coordBlock:coordBlock, infr:infr };
}

function infoBodyHTML(c) { return '<div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-graduation-cap"></i> Carreras / Áreas</div>'+c.carreras+'</div><hr class="i-div"/><div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-users"></i> Grupos activos</div><div class="i-grupos">'+c.grupos+'</div></div><hr class="i-div"/><div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-chalkboard-user"></i> Maestros destacados</div>'+c.maestros+'</div><hr class="i-div"/><div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-file-lines"></i> Trámites disponibles</div>'+c.tramites+'</div><hr class="i-div"/><div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-building"></i> Infraestructura</div><div class="i-salones"><div class="i-salon"><div class="i-snum" data-target="'+c.infr.total+'">0</div><div class="i-slbl">Total</div></div><div class="i-salon"><div class="i-snum" data-target="'+c.infr.labs+'">0</div><div class="i-slbl">Labs</div></div><div class="i-salon"><div class="i-snum" data-target="'+c.infr.aulas+'">0</div><div class="i-slbl">Aulas</div></div><div class="i-salon"><div class="i-snum" data-target="'+c.infr.salas+'">0</div><div class="i-slbl">Salas</div></div></div></div>'+c.coordBlock; }

/* ════════════════════════════════════════════════════
   INFO PANEL (desktop)
════════════════════════════════════════════════════ */
function openInfoPanel(e) {
  var c = buildInfoContent(e), tipos = { docencia:'Docencia', taller:'Taller', servicio:'Servicio' };
  $('infoPH').style.display = 'none'; $('infoContent').style.display = 'flex'; $('infoPanel').classList.add('open');
  setTimeout(function() { map.invalidateSize(); }, 340);
  $('infoHead').style.background = e.color;
  $('infoHead').innerHTML = '<button class="info-close" onclick="closeInfoPanel()"><i class="fa-solid fa-xmark"></i></button><div class="info-head-row"><div class="info-id">'+e.id+'</div><div><div class="info-title">'+e.nombre+'</div><div class="info-sub">'+(e.tipo.charAt(0).toUpperCase()+e.tipo.slice(1))+' · '+e.horario.split('|')[0].trim()+'</div></div></div>';
  $('bcType').textContent = tipos[e.tipo] || e.tipo; $('bcName').textContent = e.id;
  var sb = $('infoStatusBadge'); sb.className = 'info-status-badge '+(c.st.open?'open':'closed');
  $('infoStatusText').textContent = c.st.open ? 'Abierto ahora' : 'Cerrado ahora';
  $('infoSchedule').textContent = c.st.open ? 'Cierra a las '+c.st.closesAt : e.horario.split('|')[0].trim();
  $('infoBody').innerHTML = infoBodyHTML(c);
  document.querySelectorAll('.i-snum[data-target]').forEach(function(el) { animateCounter(el, +el.dataset.target); });
}
function closeInfoPanel() { activeId = null; $('infoPanel').classList.remove('open'); $('infoPH').style.display = 'flex'; $('infoContent').style.display = 'none'; document.querySelectorAll('.ute-mk').forEach(function(m) { m.classList.remove('sel'); }); setTimeout(function() { map.invalidateSize(); }, 340); renderList(); }

/* ════════════════════════════════════════════════════
   MOBILE BOTTOM SHEET
════════════════════════════════════════════════════ */
function openBottomSheet(e) {
  var c = buildInfoContent(e);
  $('sheetHead').innerHTML = '<div class="info-head" style="background:'+e.color+';border-radius:var(--radius-xl) var(--radius-xl) 0 0;margin:-0.2rem -1.2rem 0;padding:.9rem 1.1rem"><button class="sheet-close" onclick="closeBS()"><i class="fa-solid fa-xmark"></i></button><div class="info-head-row"><div class="info-id">'+e.id+'</div><div><div class="info-title">'+e.nombre+'</div><div class="info-sub">'+e.tipo+'</div></div></div></div><div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0 .2rem"><div class="info-status-badge '+(c.st.open?'open':'closed')+'"><div class="info-status-dot"></div>'+(c.st.open?'Abierto ahora':'Cerrado ahora')+'</div><div class="info-schedule" style="font-size:.67rem;color:var(--gris-400)">'+(c.st.open?'Cierra '+c.st.closesAt:'')+'</div></div>';
  $('sheetBody').innerHTML = '<div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-graduation-cap"></i> Carreras / Áreas</div>'+c.carreras+'</div><hr class="i-div"/><div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-chalkboard-user"></i> Maestros</div>'+c.maestros+'</div><hr class="i-div"/><div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-file-lines"></i> Trámites</div>'+c.tramites+'</div><hr class="i-div"/><div class="i-sec"><div class="i-lbl"><i class="fa-solid fa-building"></i> Infraestructura</div><div class="i-salones"><div class="i-salon"><div class="i-snum" data-target="'+c.infr.total+'">0</div><div class="i-slbl">Total</div></div><div class="i-salon"><div class="i-snum" data-target="'+c.infr.labs+'">0</div><div class="i-slbl">Labs</div></div><div class="i-salon"><div class="i-snum" data-target="'+c.infr.aulas+'">0</div><div class="i-slbl">Aulas</div></div><div class="i-salon"><div class="i-snum" data-target="'+c.infr.salas+'">0</div><div class="i-slbl">Salas</div></div></div></div>';
  $('bsOverlay').classList.add('open');
  setTimeout(function() { document.querySelectorAll('#sheetBody .i-snum[data-target]').forEach(function(el) { animateCounter(el, +el.dataset.target); }); }, 100);
}
function closeBS() { $('bsOverlay').classList.remove('open'); activeId = null; document.querySelectorAll('.ute-mk').forEach(function(m) { m.classList.remove('sel'); }); }
function closeBSifOverlay(e) { if (e.target === $('bsOverlay')) closeBS(); }

/* ════════════════════════════════════════════════════
   KEYBOARD NAVIGATION
════════════════════════════════════════════════════ */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (typeof closeLoginModal === 'function' && $('loginModalOverlay').classList.contains('open')) { closeLoginModal(); return; }
    if (typeof closeSearch === 'function' && $('searchOverlay').classList.contains('open')) { closeSearch(); return; }
    if (typeof closeBS === 'function' && $('bsOverlay').classList.contains('open')) { closeBS(); return; }
    if ($('infoPanel').classList.contains('open')) { closeInfoPanel(); return; }
    if (typeof endOnboarding === 'function' && $('onboardingOverlay').style.display !== 'none') { endOnboarding(); return; }
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'k' && typeof openSearch === 'function') { e.preventDefault(); openSearch(); return; }
  if (typeof closeSearch === 'function' && $('searchOverlay').classList.contains('open')) {
    var items = $('searchResults').querySelectorAll('.sr-item'); if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (typeof searchFocusIdx !== 'undefined') searchFocusIdx = Math.min(searchFocusIdx + 1, items.length - 1); items.forEach(function(el, i) { el.classList.toggle('focused', i === searchFocusIdx); }); if (items[searchFocusIdx]) items[searchFocusIdx].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (typeof searchFocusIdx !== 'undefined') searchFocusIdx = Math.max(searchFocusIdx - 1, 0); items.forEach(function(el, i) { el.classList.toggle('focused', i === searchFocusIdx); }); if (items[searchFocusIdx]) items[searchFocusIdx].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); var f = $('searchResults').querySelector('.sr-item.focused'); if (f) f.click(); else if (items.length === 1) items[0].click(); }
    return;
  }
  var allIds = edificios.filter(function(eb) { return activeFilter === 'all' || eb.tipo === activeFilter; }).map(function(eb) { return eb.id; });
  var cur = allIds.indexOf(activeId);
  if (e.key === 'ArrowDown' && cur < allIds.length - 1) selectEdificio(allIds[cur + 1]);
  else if (e.key === 'ArrowUp' && cur > 0) selectEdificio(allIds[cur - 1]);
});

/* ════════════════════════════════════════════════════
   FAB & MAP CLICK
════════════════════════════════════════════════════ */
$('btnCenter').addEventListener('click', function() { map.flyTo([CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], 17, { duration: 1.1, easeLinearity: .35 }); });
$('btnMyLoc').addEventListener('click', function() {
  if (!navigator.geolocation) { toast('Geolocalización no soportada', 'error'); return; }
  toast('Obteniendo tu ubicación…', 'info', 2000);
  navigator.geolocation.getCurrentPosition(function(pos) {
    map.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { duration: 1.2 });
    var icon = L.divIcon({ className:'', html:'<div style="width:16px;height:16px;border-radius:50%;background:#1565C0;border:3px solid #fff;box-shadow:0 0 0 4px rgba(21,101,192,.3),0 3px 10px rgba(0,0,0,.3);animation:pulse 2s infinite"></div><style>@keyframes pulse{0%,100%{box-shadow:0 0 0 4px rgba(21,101,192,.3),0 3px 10px rgba(0,0,0,.3)}50%{box-shadow:0 0 0 12px rgba(21,101,192,0),0 3px 10px rgba(0,0,0,.3)}}</style>', iconSize:[16,16], iconAnchor:[8,8] });
    L.marker([pos.coords.latitude, pos.coords.longitude], { icon:icon }).addTo(map).bindPopup('<strong>📍 Estás aquí</strong>',{closeButton:false}).openPopup();
    toast('Ubicación encontrada', 'success');
  }, function() { toast('No se pudo obtener tu ubicación', 'error'); }, { enableHighAccuracy:true, timeout:8000 });
});
map.on('click', function() { if (window.innerWidth >= 769) closeInfoPanel(); else closeBS(); });

/* ════════════════════════════════════════════════════
   URL PARAM & INIT
════════════════════════════════════════════════════ */
(function() { var p = new URLSearchParams(location.search), id = p.get('edificio'); if (id) setTimeout(function() { selectEdificio(id); }, 1600); })();
renderRecents();
