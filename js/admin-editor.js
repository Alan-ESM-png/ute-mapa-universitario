/**
 * UTE Escobedo – Admin Route Editor v4.4
 * Editor de rutas sobre mapa Leaflet
 * Dependencias: data.js (incluye $ y toast), admin-core.js, Leaflet
 */
'use strict';

/* ══════════════════════════════════════════════════
   ROUTE EDITOR MAP
══════════════════════════════════════════════════ */
var editorMap = null, editorReady = false;
var drawMode = null;
var coordsIda = [], coordsVuelta = [];
var polyIda = null, polyVuelta = null;
var tmpMarkers = [];

function initEditorMap() {
  if (editorReady) return; editorReady = true;
  editorMap = L.map('editorMap', { center: [CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], zoom: 14, zoomControl: false });
  L.control.zoom({ position: 'bottomright' }).addTo(editorMap);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution:'© OSM © CARTO', maxZoom:20 }).addTo(editorMap);
  var ic = L.divIcon({ className:'', html:'<div style="background:var(--naranja);color:#fff;font-size:.72rem;font-weight:800;padding:3px 8px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,.2)">UTE</div>', iconSize:[38,22], iconAnchor:[19,11] });
  L.marker([CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], { icon:ic }).bindTooltip('Campus UTE Escobedo').addTo(editorMap);
  editorMap.on('click', function(e) {
    if (!drawMode) return; var pt = { lat:e.latlng.lat, lng:e.latlng.lng };
    if (drawMode === 'ida') coordsIda.push(pt); else coordsVuelta.push(pt);
    var dotColor = drawMode === 'ida' ? (val('re-color') || '#2E7D32') : '#1565C0';
    var mIc = L.divIcon({ className:'', html:'<div style="width:10px;height:10px;border-radius:50%;background:'+dotColor+';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>', iconSize:[10,10], iconAnchor:[5,5] });
    tmpMarkers.push(L.marker([pt.lat, pt.lng], { icon:mIc }).addTo(editorMap)); updateCoordsUI(); redrawEditorLines();
  });
}

function startDraw(mode) {
  drawMode = mode; editorMap.getContainer().style.cursor = 'crosshair';
  $('btnIda').classList.toggle('active', mode==='ida'); $('btnVuelta').classList.toggle('active', mode==='vuelta');
  $('modeInd').className = 'mode-ind drawing-'+mode;
  $('modeInd').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Dibujando '+(mode==='ida'?'IDA <i class="fa-solid fa-arrow-right"></i>':'VUELTA <i class="fa-solid fa-arrow-left"></i>')+' — Haz clic en el mapa';
  updateCoordsUI();
}

function stopDraw() {
  drawMode = null; if (editorMap) editorMap.getContainer().style.cursor = '';
  $('btnIda').classList.remove('active'); $('btnVuelta').classList.remove('active');
  $('modeInd').className = 'mode-ind idle';
  $('modeInd').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Inactivo — Activa un modo para trazar';
}

function clearCoords() {
  if (!drawMode) { toast('Activa un modo de dibujo primero', 'info'); return; }
  if (!confirm('¿Limpiar puntos de '+drawMode.toUpperCase()+'?')) return;
  if (drawMode === 'ida') { coordsIda = []; if (polyIda) { editorMap.removeLayer(polyIda); polyIda = null; } }
  else { coordsVuelta = []; if (polyVuelta) { editorMap.removeLayer(polyVuelta); polyVuelta = null; } }
  tmpMarkers.forEach(function(m) { editorMap.removeLayer(m); }); tmpMarkers = []; updateCoordsUI();
}

function deleteCoord(i) { if (drawMode==='ida') coordsIda.splice(i,1); else coordsVuelta.splice(i,1); updateCoordsUI(); redrawEditorLines(); }

function updateCoordsUI() {
  var lista = (drawMode==='vuelta')?coordsVuelta:coordsIda, label = (drawMode==='vuelta')?'VUELTA':'IDA';
  $('coordsLbl').textContent = 'Puntos '+label+' ('+lista.length+')';
  $('coordsList').innerHTML = lista.length ? lista.map(function(p,i) { return '<div class="coord-row"><span><span class="coord-num">'+(i+1)+'</span>'+p.lat.toFixed(5)+', '+p.lng.toFixed(5)+'</span><button class="del-coord" onclick="deleteCoord('+i+')"><i class="fa-solid fa-xmark"></i></button></div>'; }).join('') : '<div style="padding:.75rem;color:var(--gris-400);font-size:.75rem;text-align:center">Sin puntos.</div>';
}

function redrawEditorLines() {
  if (!editorMap) return; var color = val('re-color') || '#2E7D32';
  if (polyIda) { editorMap.removeLayer(polyIda); polyIda = null; }
  if (polyVuelta) { editorMap.removeLayer(polyVuelta); polyVuelta = null; }
  if (coordsIda.length > 1) polyIda = L.polyline(coordsIda.map(function(p) { return [p.lat,p.lng]; }), { color:color, weight:4.5, dashArray:'10 6', opacity:.9 }).addTo(editorMap);
  if (coordsVuelta.length > 1) polyVuelta = L.polyline(coordsVuelta.map(function(p) { return [p.lat,p.lng]; }), { color:'#1565C0', weight:3, dashArray:'5 8', opacity:.65 }).addTo(editorMap);
}
var reCEl = $('re-color'); if (reCEl) reCEl.addEventListener('input', redrawEditorLines);

function loadRutaEditor(id) {
  showSec('editor', null); var r = DB.getRutas().find(function(x) { return x.id === id; }); if (!r) return;
  setTimeout(function() {
    $('re-nom').value=r.nombre; $('re-tipo').value=r.tipo; $('re-color').value=r.color;
    $('re-entrada').value=r.horarios.entrada.join(', '); $('re-salida').value=r.horarios.salida.join(', ');
    $('re-costo').value=r.costo; $('re-nota').value=r.nota||''; $('re-paradas').value=r.paradas_ida.join('\n');
    coordsIda=r.coords_ida.map(function(c){return {lat:c[0],lng:c[1]};});
    coordsVuelta=r.coords_vuelta.map(function(c){return {lat:c[0],lng:c[1]};});
    updateCoordsUI(); redrawEditorLines();
  }, 200);
}

function saveNewRoute() {
  var nombre = val('re-nom'); if (!nombre) { toast('Escribe el nombre de la ruta', 'error'); return; }
  if (coordsIda.length < 2) { toast('Necesitas al menos 2 puntos para IDA', 'error'); return; }
  var entrada = val('re-entrada').split(',').map(function(s){return s.trim();}).filter(Boolean);
  var salida = val('re-salida').split(',').map(function(s){return s.trim();}).filter(Boolean);
  var paradas = val('re-paradas').split('\n').map(function(s){return s.trim();}).filter(Boolean);
  var nueva = { id:'ruta-'+Date.now(), nombre:nombre, tipo:val('re-tipo'), operador:'UTE Escobedo', color:val('re-color'), horarios:{entrada:entrada, salida:salida}, costo:val('re-costo')||'Por definir', metodoPago:['Efectivo'], nota:val('re-nota'), paradas_ida:paradas, paradas_vuelta:paradas.slice().reverse(), coords_ida:coordsIda.map(function(p){return [p.lat,p.lng];}), coords_vuelta:coordsVuelta.length>1?coordsVuelta.map(function(p){return [p.lat,p.lng];}):coordsIda.slice().reverse().map(function(p){return [p.lat,p.lng];}) };
  var rs = DB.getRutas(); rs.push(nueva); DB.saveRutas(rs);
  logAct('Ruta "'+nombre+'" creada con '+coordsIda.length+' puntos', '#2E7D32');
  toast('Ruta "'+nombre+'" guardada', 'success');
  coordsIda=[]; coordsVuelta=[]; tmpMarkers.forEach(function(m){editorMap.removeLayer(m);}); tmpMarkers=[];
  if (polyIda){editorMap.removeLayer(polyIda);polyIda=null;} if (polyVuelta){editorMap.removeLayer(polyVuelta);polyVuelta=null;}
  stopDraw(); updateCoordsUI(); refreshAll();
}
