/**
 * UTE Escobedo – Admin Route Editor v4.7
 * Editor de rutas sobre mapa Leaflet.
 * Dependencias: data.js, admin-core.js, Leaflet
 */
'use strict';

/* ══════════════════════════════════════════════════
   ROUTE EDITOR MAP
══════════════════════════════════════════════════ */
let editorMap = null, editorReady = false;
let drawMode = null;
let coordsIda = [], coordsVuelta = [];
let polyIda = null, polyVuelta = null;
let tmpMarkers = [];

const getVal = id => { const el = $(id); return el ? (el.value || '').trim() : ''; };

function initEditorMap() {
  if (editorReady) {
    // Si ya está inicializado, solo invalidateSize
    if (editorMap) setTimeout(function() { editorMap.invalidateSize(); }, 100);
    return;
  }
  editorReady = true;
  try {
    const center = (typeof CAMPUS_CENTER !== 'undefined')
      ? [CAMPUS_CENTER.lat, CAMPUS_CENTER.lng]
      : [25.83010, -100.27663];

    editorMap = L.map('editorMap', {
      center: center,
      zoom: 14,
      zoomControl: false
    });
    L.control.zoom({ position: 'bottomright' }).addTo(editorMap);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO', maxZoom: 20
    }).addTo(editorMap);

    // Marcador del campus
    const ic = L.divIcon({
      className: '',
      html: '<div style="background:#F4821F;color:#fff;font-size:.72rem;font-weight:800;padding:3px 8px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,.2)">UTE</div>',
      iconSize: [38, 22], iconAnchor: [19, 11]
    });
    L.marker(center, { icon: ic }).bindTooltip('Campus UTE Escobedo').addTo(editorMap);

    // Forzar tamaño correcto tras pintar
    setTimeout(function() { editorMap.invalidateSize(); }, 150);

    // Throttle: ignora clicks a < 150ms
    let lastClickTime = 0;
    editorMap.on('click', function(e) {
      const now = Date.now();
      if (now - lastClickTime < 150) return;
      lastClickTime = now;

      if (!drawMode) return;
      const pt = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (drawMode === 'ida') coordsIda.push(pt);
      else coordsVuelta.push(pt);

      const dotColor = drawMode === 'ida' ? (getVal('re-color') || '#2E7D32') : '#1565C0';
      const mIc = L.divIcon({
        className: '',
        html: '<div style="width:10px;height:10px;border-radius:50%;background:' + dotColor +
              ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>',
        iconSize: [10, 10], iconAnchor: [5, 5]
      });
      const marker = L.marker([pt.lat, pt.lng], { icon: mIc }).addTo(editorMap);
      // Guardar referencia con índice para poder eliminarlo después
      marker._coordIdx = drawMode === 'ida' ? coordsIda.length - 1 : coordsVuelta.length - 1;
      marker._coordSense = drawMode;
      tmpMarkers.push(marker);
      updateCoordsUI();
      redrawEditorLines();
    });
  } catch (err) {
    console.error('initEditorMap error:', err);
    toast('Error al inicializar el editor de mapa', 'error');
  }
}

function startDraw(mode) {
  drawMode = mode;
  if (editorMap) editorMap.getContainer().style.cursor = 'crosshair';
  const btnIda = document.getElementById('btnIda');
  const btnVuelta = document.getElementById('btnVuelta');
  if (btnIda) btnIda.classList.toggle('active', mode === 'ida');
  if (btnVuelta) btnVuelta.classList.toggle('active', mode === 'vuelta');
  const mi = document.getElementById('modeInd');
  if (mi) {
    mi.className = 'mode-ind drawing-' + mode;
    mi.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Dibujando ' +
      (mode === 'ida' ? 'IDA <i class="fa-solid fa-arrow-right"></i>' : 'VUELTA <i class="fa-solid fa-arrow-left"></i>') +
      ' — Haz clic en el mapa';
  }
  updateCoordsUI();
}

function stopDraw() {
  drawMode = null;
  if (editorMap) editorMap.getContainer().style.cursor = '';
  const btnIda = document.getElementById('btnIda');
  const btnVuelta = document.getElementById('btnVuelta');
  const mi = document.getElementById('modeInd');
  if (btnIda) btnIda.classList.remove('active');
  if (btnVuelta) btnVuelta.classList.remove('active');
  if (mi) {
    mi.className = 'mode-ind idle';
    mi.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Inactivo — Activa un modo para trazar';
  }
}

function clearCoords() {
  if (!drawMode) { toast('Activa un modo de dibujo primero', 'info'); return; }
  if (!confirm('Limpiar puntos de ' + drawMode.toUpperCase() + '?')) return;

  // Eliminar marcadores y polilíneas del mapa
  tmpMarkers.forEach(function(m) { if (editorMap) editorMap.removeLayer(m); });
  tmpMarkers = [];

  if (drawMode === 'ida') {
    coordsIda = [];
    if (polyIda && editorMap) { editorMap.removeLayer(polyIda); polyIda = null; }
  } else {
    coordsVuelta = [];
    if (polyVuelta && editorMap) { editorMap.removeLayer(polyVuelta); polyVuelta = null; }
  }
  updateCoordsUI();
}

/** Elimina una coordenada por índice y su marcador del mapa */
function deleteCoord(i) {
  // Eliminar el marcador correspondiente del mapa
  const sense = drawMode || 'ida';
  for (let j = tmpMarkers.length - 1; j >= 0; j--) {
    const m = tmpMarkers[j];
    if (m._coordIdx === i && m._coordSense === sense) {
      if (editorMap) editorMap.removeLayer(m);
      tmpMarkers.splice(j, 1);
    }
    // Actualizar índices de marcadores restantes
    if (m._coordSense === sense && m._coordIdx > i) {
      m._coordIdx--;
    }
  }

  if (drawMode === 'vuelta') coordsVuelta.splice(i, 1);
  else coordsIda.splice(i, 1);
  updateCoordsUI();
  redrawEditorLines();
}

function updateCoordsUI() {
  const lista = (drawMode === 'vuelta') ? coordsVuelta : coordsIda;
  const label = (drawMode === 'vuelta') ? 'VUELTA' : 'IDA';
  const cl = document.getElementById('coordsLbl');
  const cList = document.getElementById('coordsList');
  if (cl) cl.textContent = 'Puntos ' + label + ' (' + lista.length + ')';
  if (cList) {
    cList.innerHTML = lista.length
      ? lista.map(function(p, i) {
          return '<div class="coord-row"><span><span class="coord-num">' + (i + 1) + '</span>' +
            p.lat.toFixed(5) + ', ' + p.lng.toFixed(5) + '</span>' +
            '<button class="del-coord" onclick="deleteCoord(' + i + ')"><i class="fa-solid fa-xmark"></i></button></div>';
        }).join('')
      : '<div style="padding:.75rem;color:var(--gris-400);font-size:.75rem;text-align:center">Sin puntos. Haz clic en el mapa para agregar.</div>';
  }
}

function redrawEditorLines() {
  if (!editorMap) return;
  try {
    const color = getVal('re-color') || '#2E7D32';
    [polyIda, polyVuelta].forEach(p => { if (p && editorMap) { editorMap.removeLayer(p); } });
    polyIda = polyVuelta = null;
    if (coordsIda.length > 1) polyIda = L.polyline(coordsIda.map(p => [p.lat, p.lng]), { color, weight: 4.5, dashArray: '10 6', opacity: .9 }).addTo(editorMap);
    if (coordsVuelta.length > 1) polyVuelta = L.polyline(coordsVuelta.map(p => [p.lat, p.lng]), { color: '#1565C0', weight: 3, dashArray: '5 8', opacity: .65 }).addTo(editorMap);
  } catch (err) { console.warn('redrawEditorLines error:', err); }
}

// Color picker → redibujar en tiempo real
const reCEl = document.getElementById('re-color');
if (reCEl) reCEl.addEventListener('input', redrawEditorLines);

function loadRutaEditor(id) {
  showSec('editor', null);
  const r = DB.getRutas().find(function(x) { return x.id === id; });
  if (!r) return;
  setTimeout(function() {
    try {
      // Limpiar estado anterior
      tmpMarkers.forEach(function(m) { if (editorMap) editorMap.removeLayer(m); });
      tmpMarkers = [];
      if (polyIda && editorMap) { editorMap.removeLayer(polyIda); polyIda = null; }
      if (polyVuelta && editorMap) { editorMap.removeLayer(polyVuelta); polyVuelta = null; }
      stopDraw();

      const setVal = function(id, v) { const el = document.getElementById(id); if (el) el.value = v; };

      setVal('re-nom', r.nombre || '');
      setVal('re-tipo', r.tipo || 'publica');
      setVal('re-color', r.color || '#2E7D32');
      setVal('re-entrada', (r.horarios && r.horarios.entrada ? r.horarios.entrada.join(', ') : ''));
      setVal('re-salida', (r.horarios && r.horarios.salida ? r.horarios.salida.join(', ') : ''));
      setVal('re-costo', r.costo || '');
      setVal('re-nota', r.nota || '');
      setVal('re-paradas', (r.paradas_ida || []).join('\n'));

      coordsIda = (r.coords_ida || []).map(function(c) { return { lat: c[0], lng: c[1] }; });
      coordsVuelta = (r.coords_vuelta || []).map(function(c) { return { lat: c[0], lng: c[1] }; });
      updateCoordsUI();
      redrawEditorLines();
      // Ajustar mapa al cargar ruta
      if (editorMap) setTimeout(function() { editorMap.invalidateSize(); }, 100);
    } catch (err) { console.error('loadRutaEditor error:', err); }
  }, 300);
}

function saveNewRoute() {
  try {
    const nombre = getVal('re-nom');
    if (!nombre) { toast('Escribe el nombre de la ruta', 'error'); return; }
    if (coordsIda.length < 2) { toast('Necesitas al menos 2 puntos para IDA', 'error'); return; }

    const entrada = getVal('re-entrada').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    const salida = getVal('re-salida').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    const paradas = getVal('re-paradas').split('\n').map(function(s) { return s.trim(); }).filter(Boolean);

    const nueva = {
      id: 'ruta-' + Date.now(),
      nombre: nombre,
      tipo: getVal('re-tipo') || 'publica',
      operador: 'UTE Escobedo',
      color: getVal('re-color') || '#2E7D32',
      colorFondo: '#E8F5E9',
      horarios: { entrada: entrada, salida: salida },
      costo: getVal('re-costo') || 'Por definir',
      metodoPago: ['Efectivo'],
      nota: getVal('re-nota'),
      paradas_ida: paradas,
      paradas_vuelta: paradas.slice().reverse(),
      coords_ida: coordsIda.map(function(p) { return [p.lat, p.lng]; }),
      coords_vuelta: coordsVuelta.length > 1
        ? coordsVuelta.map(function(p) { return [p.lat, p.lng]; })
        : coordsIda.slice().reverse().map(function(p) { return [p.lat, p.lng]; })
    };

    const rs = DB.getRutas();
    rs.push(nueva);
    DB.saveRutas(rs);
    logAct('Ruta "' + nombre + '" creada con ' + coordsIda.length + ' puntos', '#2E7D32');
    toast('Ruta "' + nombre + '" guardada', 'success');

    // Limpiar estado
    coordsIda = []; coordsVuelta = [];
    tmpMarkers.forEach(function(m) { if (editorMap) editorMap.removeLayer(m); });
    tmpMarkers = [];
    if (polyIda && editorMap) { editorMap.removeLayer(polyIda); polyIda = null; }
    if (polyVuelta && editorMap) { editorMap.removeLayer(polyVuelta); polyVuelta = null; }
    stopDraw();
    updateCoordsUI();
    refreshAll();

    // Redirigir a la lista de rutas
    setTimeout(function() { showSec('rutas', document.querySelector('.a-lnk[onclick*="rutas"]')); }, 400);
  } catch (err) {
    console.error('saveNewRoute error:', err);
    toast('Error al guardar la ruta', 'error');
  }
}

/** Limpia el estado del editor sin guardar — usado al volver a la lista */
function clearEditorState() {
  try {
    coordsIda = []; coordsVuelta = [];
    tmpMarkers.forEach(function(m) { if (editorMap) editorMap.removeLayer(m); });
    tmpMarkers = [];
    if (polyIda && editorMap) { editorMap.removeLayer(polyIda); polyIda = null; }
    if (polyVuelta && editorMap) { editorMap.removeLayer(polyVuelta); polyVuelta = null; }
    stopDraw();
    updateCoordsUI();
    // Limpiar campos del formulario
    var fields = ['re-nom','re-entrada','re-salida','re-costo','re-nota','re-paradas'];
    fields.forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
  } catch (e) { /* ignore */ }
}
