/**
 * UTEMAPP v1.0 – App simplificada para estudiantes UTE
 * Depende de: ../js/edificios.js, ../js/data.js, Leaflet
 */
'use strict';

/* ════════════════════════════════════════════════════
   INIT MAP
════════════════════════════════════════════════════ */
var $ = function(id) { return document.getElementById(id); };
var map = L.map('map', { center: [CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], zoom: 17, zoomControl: false });
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution:'&copy; OSM &copy; CARTO', maxZoom:20 }).addTo(map);

/* ════════════════════════════════════════════════════
   DATA & MARKERS
════════════════════════════════════════════════════ */
var edificios = DB.getEdificios(), rutas = DB.getRutas();
var rutaLayers = {}, rutaOn = false;

function getStatus(h) {
  var now = new Date(), dow = now.getDay(), hhmm = now.getHours()*60+now.getMinutes();
  var DAY = { Lun:1,Mar:2,'Mié':3,Jue:4,Vie:5,'Sáb':6,Dom:0,Mie:3 };
  var tm2m = function(t) { var p = t.split(':').map(Number); return p[0]*60+p[1]; };
  var segs = h.split('|').map(function(s){return s.trim();});
  for (var i=0;i<segs.length;i++) {
    var dm=segs[i].match(/([A-ZÁÉÍÓÚña-z]+)–([A-ZÁÉÍÓÚña-z]+)/u), tm=segs[i].match(/(\d{1,2}:\d{2})–(\d{1,2}:\d{2})/);
    if (!tm) continue;
    var ok=true; if (dm) { var d1=DAY[dm[1]],d2=DAY[dm[2]]; if (d1!==undefined&&d2!==undefined) ok=d1<=d2?(dow>=d1&&dow<=d2):(dow>=d1||dow<=d2); }
    if (ok&&hhmm>=tm2m(tm[1])&&hhmm<tm2m(tm[2])) return {open:true,closesAt:tm[2]};
  }
  return {open:false,closesAt:null};
}

// Markers
edificios.forEach(function(e) {
  var st = getStatus(e.horario);
  var icon = L.divIcon({ className:'', html:'<div class="ute-mk2" style="background:'+e.color+'">'+e.id+'</div>', iconSize:[32,32], iconAnchor:[16,16] });
  L.marker([e.lat,e.lng],{icon:icon}).addTo(map).on('click',function(){ openCard(e); });
});

// Routes
rutas.forEach(function(r) {
  var lg = L.layerGroup();
  L.polyline(r.coords_ida,{color:r.color,weight:4,dashArray:'10 6',opacity:.9}).addTo(lg);
  L.polyline(r.coords_vuelta,{color:r.color,weight:2.5,dashArray:'5 8',opacity:.5}).addTo(lg);
  rutaLayers[r.id] = lg;
});

/* ════════════════════════════════════════════════════
   MY LOCATION
════════════════════════════════════════════════════ */
var userMarker = null;
function goMyLocation() {
  if (!navigator.geolocation) { alert('Geolocalización no soportada en este dispositivo.'); return; }
  navigator.geolocation.getCurrentPosition(function(pos) {
    map.flyTo([pos.coords.latitude,pos.coords.longitude],17,{duration:1});
    if (userMarker) map.removeLayer(userMarker);
    var ic = L.divIcon({ className:'', html:'<div style="width:18px;height:18px;border-radius:50%;background:#1565C0;border:3px solid #fff;box-shadow:0 0 0 5px rgba(21,101,192,.3)"></div>', iconSize:[18,18], iconAnchor:[9,9] });
    userMarker = L.marker([pos.coords.latitude,pos.coords.longitude],{icon:ic}).addTo(map).bindPopup('📍 Estás aquí',{closeButton:false}).openPopup();
  }, function() { alert('No se pudo obtener tu ubicación. Verifica los permisos.'); }, { enableHighAccuracy:true, timeout:8000 });
}
function goCampus() { map.flyTo([CAMPUS_CENTER.lat,CAMPUS_CENTER.lng],17,{duration:1}); }

/* ════════════════════════════════════════════════════
   BUILDING CARD
════════════════════════════════════════════════════ */
function openCard(e) {
  var st = getStatus(e.horario);
  var carreras = e.carreras.map(function(c){return '<span class="cc-tag">'+c+'</span>';}).join(' ');
  var grupos = e.grupos.map(function(g){return '<span class="cc-tag">'+g+'</span>';}).join(' ');
  var maestros = e.maestros.map(function(m){return '<div style="font-size:.75rem;padding:4px 0">'+m.nombre+'</div>';}).join('');
  var tramites = e.tramites.map(function(t){return '<div style="font-size:.75rem;padding:2px 0">• '+t+'</div>';}).join('');
  $('cardContent').innerHTML = '<div class="cc-head"><div class="cc-mk" style="background:'+e.color+'">'+e.id+'</div><div><div class="cc-title">'+e.nombre+'</div><div class="cc-type">'+e.tipo+'</div><div class="cc-status '+(st.open?'open':'closed')+'">'+(st.open?'<i class="fa-solid fa-circle" style="font-size:.35rem"></i> Abierto ahora':'<i class="fa-solid fa-circle" style="font-size:.35rem"></i> Cerrado ahora')+'</div></div></div><div class="cc-section"><div class="cc-label">🎓 Carreras / Áreas</div><div>'+carreras+'</div></div><div class="cc-section"><div class="cc-label">👥 Grupos</div><div>'+grupos+'</div></div><div class="cc-section"><div class="cc-label">👩‍🏫 Maestros</div><div class="cc-list">'+maestros+'</div></div><div class="cc-section"><div class="cc-label">📋 Trámites</div><div class="cc-list">'+tramites+'</div></div>';
  $('buildingCard').classList.add('open');
}
function closeCard() { $('buildingCard').classList.remove('open'); }

/* ════════════════════════════════════════════════════
   SEARCH
════════════════════════════════════════════════════ */
var searchInput = $('topSearch');
searchInput.addEventListener('input', function() {
  var q = searchInput.value.trim().toLowerCase(), drop = $('searchDrop');
  if (!q) { drop.classList.remove('open'); drop.innerHTML = ''; return; }
  var res = edificios.filter(function(e) { return e.nombre.toLowerCase().indexOf(q)!==-1||e.id.toLowerCase().indexOf(q)!==-1||e.carreras.some(function(c){return c.toLowerCase().indexOf(q)!==-1;}); });
  drop.innerHTML = res.length ? res.map(function(e) { return '<div class="sr-item2" onclick="searchSelect(\''+e.id+'\')"><div class="sr-badge2" style="background:'+e.color+'">'+e.id+'</div><div><div class="sr-name2">'+e.nombre+'</div><div class="sr-sub2">'+e.carreras.slice(0,2).join(' · ')+'</div></div></div>'; }).join('') : '<div style="padding:1.5rem;text-align:center;color:var(--gris-400);font-size:.8rem">Sin resultados</div>';
  drop.classList.add('open');
});
function searchSelect(id) {
  $('searchDrop').classList.remove('open'); searchInput.value = '';
  var e = edificios.find(function(x){return x.id===id;}); if (e) { map.flyTo([e.lat,e.lng],18,{duration:.6}); openCard(e); }
}

/* ════════════════════════════════════════════════════
   BOTTOM NAV TABS
════════════════════════════════════════════════════ */
function switchTab(tab) {
  document.querySelectorAll('.botnav-item').forEach(function(b){b.classList.remove('active');});
  document.querySelector('.botnav-item[data-tab='+tab+']').classList.add('active');
  // Panels
  $('panelEdificios').classList.toggle('open', tab==='edificios');
  $('panelRutas').classList.toggle('open', tab==='rutas');
  $('panelInfo').classList.toggle('open', tab==='info');
  closeCard();
  if (tab==='edificios') renderEdificiosList();
  if (tab==='rutas') renderRutasList();
}

/* ════════════════════════════════════════════════════
   BUILDINGS LIST
════════════════════════════════════════════════════ */
function renderEdificiosList() {
  $('listEdificios').innerHTML = edificios.map(function(e) {
    var st = getStatus(e.horario);
    return '<div class="p-item" onclick="map.flyTo(['+e.lat+','+e.lng+'],18,{duration:.6});openCard(edificios.find(function(x){return x.id===\''+e.id+'\';}))"><div class="p-mk" style="background:'+e.color+'">'+e.id+'</div><div><div class="p-name">'+e.nombre+'</div><div class="p-sub">'+e.carreras.slice(0,2).join(' · ')+'</div><div class="p-status '+(st.open?'open':'closed')+'">'+(st.open?'Abierto':'Cerrado')+'</div></div></div>';
  }).join('');
}

/* ════════════════════════════════════════════════════
   ROUTES LIST
════════════════════════════════════════════════════ */
function renderRutasList() {
  $('listRutas').innerHTML = rutas.map(function(r) {
    return '<div class="p-ruta" onclick="toggleRuta(\''+r.id+'\')"><div class="p-ruta-dot" style="background:'+r.color+'"></div><div><div class="p-ruta-name">'+r.nombre+'</div><div style="font-size:.65rem;color:var(--gris-400)">'+r.horarios.entrada.join(' y ')+' → '+r.horarios.salida.join(' y ')+'</div></div><span class="p-ruta-badge '+(r.tipo==='publica'?'pub':'esc')+'">'+(r.tipo==='publica'?'Público':'Escolar')+'</span></div>';
  }).join('');
}
function toggleRuta(id) {
  var v = !rutaOn || map.hasLayer(rutaLayers[id]);
  if (v) map.removeLayer(rutaLayers[id]); else map.addLayer(rutaLayers[id]);
}

/* ════════════════════════════════════════════════════
   HIDE SEARCH ON OUTSIDE CLICK
════════════════════════════════════════════════════ */
document.addEventListener('click', function(e) {
  if (!$('topSearchWrap').contains(e.target)) { $('searchDrop').classList.remove('open'); }
});

/* ════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════ */
renderEdificiosList(); renderRutasList();
