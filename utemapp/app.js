/**
 * UTEMAPP v1.0 – App Android/iOS (PWA)
 * Campus UTE en tu bolsillo. Simple, rápido, funcional.
 */
'use strict';
var $=function(id){return document.getElementById(id);};

/* ════════════════════════════════════════════════════
   SPLASH SCREEN
════════════════════════════════════════════════════ */
setTimeout(function() { document.querySelector('.splash').classList.add('hide'); }, 1200);

/* ════════════════════════════════════════════════════
   OFFLINE DETECTION
════════════════════════════════════════════════════ */
window.addEventListener('online', function(){ $('offlineBar').classList.remove('show'); });
window.addEventListener('offline', function(){ $('offlineBar').classList.add('show'); });

/* ════════════════════════════════════════════════════
   MAP INIT
════════════════════════════════════════════════════ */
var map = L.map('map', { center:[CAMPUS_CENTER.lat,CAMPUS_CENTER.lng], zoom:17, zoomControl:false, attributionControl:false });
L.control.zoom({ position:'bottomright' }).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution:'&copy; OSM &copy; CARTO', maxZoom:20 }).addTo(map);

/* ════════════════════════════════════════════════════
   DATA
════════════════════════════════════════════════════ */
var edificios = DB.getEdificios(), rutas = DB.getRutas(), rutaLayers = {};

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

/* ════════════════════════════════════════════════════
   MARKERS
════════════════════════════════════════════════════ */
edificios.forEach(function(e) {
  var icon = L.divIcon({ className:'', html:'<div class="ute-mk2" style="background:'+e.color+'">'+e.id+'</div>', iconSize:[34,34], iconAnchor:[17,17] });
  L.marker([e.lat,e.lng],{icon:icon}).addTo(map).on('click',function(){ openCard(e); map.flyTo([e.lat,e.lng],18,{duration:.5}); });
});

/* ════════════════════════════════════════════════════
   ROUTES
════════════════════════════════════════════════════ */
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
  if (!navigator.geolocation) { alert('Geolocalización no disponible en este dispositivo.'); return; }
  var btn = $('btnLoc'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  navigator.geolocation.getCurrentPosition(function(pos) {
    btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
    map.flyTo([pos.coords.latitude,pos.coords.longitude],17,{duration:1});
    if (userMarker) map.removeLayer(userMarker);
    var ic = L.divIcon({ className:'', html:'<div style="width:20px;height:20px;border-radius:50%;background:#1565C0;border:3px solid #fff;box-shadow:0 0 0 6px rgba(21,101,192,.25)"></div>', iconSize:[20,20], iconAnchor:[10,10] });
    userMarker = L.marker([pos.coords.latitude,pos.coords.longitude],{icon:ic}).addTo(map).bindPopup('📍 Estás aquí',{closeButton:false}).openPopup();
  }, function() { btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>'; alert('No se pudo obtener tu ubicación. Activa el GPS y da permisos de ubicación.'); }, { enableHighAccuracy:true, timeout:10000 });
}
function goCampus() { map.flyTo([CAMPUS_CENTER.lat,CAMPUS_CENTER.lng],17,{duration:1}); closeCard(); }

/* ════════════════════════════════════════════════════
   BUILDING CARD
════════════════════════════════════════════════════ */
function openCard(e) {
  var st = getStatus(e.horario);
  var carreras = e.carreras.map(function(c){return '<span class="cc-tag">'+c+'</span>';}).join(' ');
  var grupos = e.grupos.map(function(g){return '<span class="cc-tag">'+g+'</span>';}).join(' ');
  var maestros = e.maestros.map(function(m){return '<div style="font-size:.74rem;padding:3px 0">👤 '+m.nombre+'</div>';}).join('');
  var tramites = e.tramites.map(function(t){return '<div style="font-size:.74rem;padding:2px 0">• '+t+'</div>';}).join('');
  var infr = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:.4rem;text-align:center">'+
    '<div style="background:var(--gris-50);border-radius:8px;padding:.5rem"><div style="font-size:1.1rem;font-weight:800;color:var(--naranja)">'+e.salones.total+'</div><div style="font-size:.55rem;color:var(--gris-400)">Total</div></div>'+
    '<div style="background:var(--gris-50);border-radius:8px;padding:.5rem"><div style="font-size:1.1rem;font-weight:800;color:var(--naranja)">'+e.salones.labs+'</div><div style="font-size:.55rem;color:var(--gris-400)">Labs</div></div>'+
    '<div style="background:var(--gris-50);border-radius:8px;padding:.5rem"><div style="font-size:1.1rem;font-weight:800;color:var(--naranja)">'+e.salones.aulas+'</div><div style="font-size:.55rem;color:var(--gris-400)">Aulas</div></div>'+
    '<div style="background:var(--gris-50);border-radius:8px;padding:.5rem"><div style="font-size:1.1rem;font-weight:800;color:var(--naranja)">'+e.salones.salas+'</div><div style="font-size:.55rem;color:var(--gris-400)">Salas</div></div></div>';
  $('cardContent').innerHTML = '<div class="cc-head"><div class="cc-mk" style="background:'+e.color+'">'+e.id+'</div><div><div class="cc-title">'+e.nombre+'</div><div class="cc-type">'+e.tipo+' · '+e.horario.split('|')[0].trim()+'</div><div class="cc-status '+(st.open?'open':'closed')+'">'+(st.open?'<i class="fa-solid fa-circle" style="font-size:.3rem"></i> Abierto ahora':'<i class="fa-solid fa-circle" style="font-size:.3rem"></i> Cerrado ahora')+'</div></div></div><div class="cc-section"><div class="cc-label">🎓 Carreras / Áreas</div><div>'+carreras+'</div></div><div class="cc-section"><div class="cc-label">👥 Grupos activos</div><div>'+grupos+'</div></div><div class="cc-section"><div class="cc-label">👩‍🏫 Maestros</div><div class="cc-list">'+maestros+'</div></div><div class="cc-section"><div class="cc-label">📋 Trámites</div><div class="cc-list">'+tramites+'</div></div><div class="cc-section"><div class="cc-label">🏫 Infraestructura</div>'+infr+'</div>';
  $('buildingCard').classList.add('open');
}
function closeCard() { $('buildingCard').classList.remove('open'); }

/* ════════════════════════════════════════════════════
   SEARCH
════════════════════════════════════════════════════ */
$('topSearch').addEventListener('input', function() {
  var q = this.value.trim().toLowerCase(), drop = $('searchDrop');
  if (!q) { drop.classList.remove('open'); drop.innerHTML = ''; return; }
  var res = edificios.filter(function(e) { return e.nombre.toLowerCase().indexOf(q)!==-1||e.id.toLowerCase().indexOf(q)!==-1||e.carreras.some(function(c){return c.toLowerCase().indexOf(q)!==-1;}); });
  drop.innerHTML = res.length ? res.map(function(e) { return '<div class="sr-item2" onclick="searchSelect(\''+e.id+'\')"><div class="sr-badge2" style="background:'+e.color+'">'+e.id+'</div><div><div class="sr-name2">'+e.nombre+'</div><div class="sr-sub2">'+e.carreras.slice(0,2).join(' · ')+'</div></div></div>'; }).join('') : '<div style="padding:1.5rem;text-align:center;color:var(--gris-400);font-size:.8rem"><i class="fa-solid fa-face-frown"></i> Sin resultados</div>';
  drop.classList.add('open');
});
function searchSelect(id) { $('searchDrop').classList.remove('open'); $('topSearch').value = ''; var e = edificios.find(function(x){return x.id===id;}); if (e) { map.flyTo([e.lat,e.lng],18,{duration:.5}); openCard(e); } }

/* ════════════════════════════════════════════════════
   BOTTOM NAV
════════════════════════════════════════════════════ */
function switchTab(tab) {
  document.querySelectorAll('.botnav-item').forEach(function(b){b.classList.remove('active');});
  var t = document.querySelector('.botnav-item[data-tab='+tab+']'); if (t) t.classList.add('active');
  $('panelEdificios').classList.toggle('open', tab==='edificios');
  $('panelRutas').classList.toggle('open', tab==='rutas');
  $('panelInfo').classList.toggle('open', tab==='info');
  closeCard();
  if (tab==='edificios') renderEdificiosList();
  if (tab==='rutas') renderRutasList();
  if (tab==='mapa') { $('btnLoc').style.display=''; $('btnCampus').style.display=''; }
  else { $('btnLoc').style.display='none'; $('btnCampus').style.display='none'; }
}

/* ════════════════════════════════════════════════════
   BUILDINGS LIST
════════════════════════════════════════════════════ */
function renderEdificiosList() {
  $('listEdificios').innerHTML = edificios.map(function(e) {
    var st = getStatus(e.horario);
    return '<div class="p-item" onclick="map.flyTo(['+e.lat+','+e.lng+'],18,{duration:.5});openCard(edificios.find(function(x){return x.id===\''+e.id+'\';}));switchTab(\'mapa\')"><div class="p-mk" style="background:'+e.color+'">'+e.id+'</div><div style="flex:1"><div class="p-name">'+e.nombre+'</div><div class="p-sub">'+e.carreras.slice(0,2).join(' · ')+'</div><div class="p-status '+(st.open?'open':'closed')+'">'+(st.open?'Abierto':'Cerrado')+'</div></div><i class="fa-solid fa-chevron-right" style="color:var(--gris-300);font-size:.7rem;align-self:center"></i></div>';
  }).join('');
}

/* ════════════════════════════════════════════════════
   ROUTES LIST
════════════════════════════════════════════════════ */
function renderRutasList() {
  $('listRutas').innerHTML = rutas.map(function(r) {
    return '<div class="p-ruta" onclick="toggleRuta(\''+r.id+'\')"><div class="p-ruta-dot" style="background:'+r.color+'"></div><div style="flex:1"><div class="p-ruta-name">'+r.nombre+'</div><div style="font-size:.64rem;color:var(--gris-400)">🟢 '+r.horarios.entrada.join(' y ')+' → 🔵 '+r.horarios.salida.join(' y ')+'</div><div style="font-size:.62rem;color:var(--gris-400)">💰 '+r.costo+'</div></div><span class="p-ruta-badge '+(r.tipo==='publica'?'pub':'esc')+'">'+(r.tipo==='publica'?'Público':'Escolar')+'</span></div>';
  }).join('');
}
function toggleRuta(id) { if (map.hasLayer(rutaLayers[id])) map.removeLayer(rutaLayers[id]); else map.addLayer(rutaLayers[id]); switchTab('mapa'); }

/* ════════════════════════════════════════════════════
   OUTSIDE CLICK → CLOSE SEARCH
════════════════════════════════════════════════════ */
document.addEventListener('click', function(e) { if (!$('topSearchWrap').contains(e.target)) $('searchDrop').classList.remove('open'); });

/* ════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════ */
renderEdificiosList(); renderRutasList();
