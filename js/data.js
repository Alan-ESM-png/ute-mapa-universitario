/**
 * UTE Escobedo – Utilidades + Datos + Persistencia v4.4
 * Incluye: $(), toast(), CAMPUS_CENTER, RUTAS_DATA, DB
 * Depende de: edificios.js (EDIFICIOS_DATA)
 */
'use strict';

/* ── Selector rápido ── */
var $ = function(id) { return document.getElementById(id); };

/* ── Toast notifications ── */
function toast(msg, type, dur) {
  type = type || 'info'; dur = dur || 3200;
  var c = $('toast-c'); if (!c) return;
  var t = document.createElement('div');
  var icons = { success:'fa-circle-check', error:'fa-circle-xmark', info:'fa-circle-info', warn:'fa-triangle-exclamation' };
  t.className = 'toast ' + type;
  t.innerHTML = '<i class="fa-solid ' + (icons[type] || icons.info) + '"></i> ' + msg;
  c.appendChild(t);
  setTimeout(function() { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, dur - 400);
  setTimeout(function() { t.remove(); }, dur);
}

const CAMPUS_CENTER = { lat: 25.83010, lng: -100.27663 };

/* ═══════════════════════════════════════════════════
   RUTAS DE TRANSPORTE
   Ruta C4: La Unidad – Laredo – UTE (datos reales)
═══════════════════════════════════════════════════ */
const RUTAS_DATA = [
  {
    id:'ruta-c4', nombre:'C4 – La Unidad / Laredo / UTE', tipo:'publica',
    operador:'Transporte Urbano Nuevo León', color:'#2E7D32', colorFondo:'#E8F5E9',
    horarios:{entrada:['7:00','18:00'], salida:['14:20','21:45']},
    costo:'Tarifa NL Camión / Mi Muevo',
    metodoPago:['Efectivo (tarifa NL)','Tarjeta Mi Muevo'],
    nota:'Es común que tome el puente de la Colombia-Monclova en el recorrido de vuelta. Pregunta al operador antes de abordar si planeas bajar en alguno de esos cruces.',
    paradas_ida:['Av. La Unidad','Antiguo Camino San Agustín','Av. 4 de Octubre','Av. Agualeguas','Av. Las Torres','Av. Raúl Salinas','Libramiento Noreste','Carr. Monclova','Carr. Colombia','Antiguo Camino a San José de los Sauces','Carr. Monclova','Carr. Laredo','Libramiento Noreste Km 33.5','UTE – Entrada'],
    paradas_vuelta:['UTE – Entrada','Libramiento Noreste','Av. Raúl Salinas','Av. Las Torres','Av. Agualeguas','Av. 4 de Octubre','Antiguo Camino San Agustín','Unidad Popular','Av. La Unidad'],
    coords_ida:[[25.7820,-100.3350],[25.7865,-100.3280],[25.7920,-100.3200],[25.7980,-100.3100],[25.8050,-100.3020],[25.8110,-100.2980],[25.8160,-100.2940],[25.8200,-100.2900],[25.8240,-100.2870],[25.8265,-100.2855],[25.8280,-100.2845],[25.8295,-100.2838],[25.8302,-100.2830],[25.83005,-100.28320]],
    coords_vuelta:[[25.83005,-100.28320],[25.8295,-100.2838],[25.8200,-100.2900],[25.8110,-100.2980],[25.8050,-100.3020],[25.7980,-100.3100],[25.7920,-100.3200],[25.7865,-100.3280],[25.7820,-100.3350]]
  },{
    id:'ruta-escolar-sur', nombre:'Bus Escolar – Zona Sur / Monterrey', tipo:'privada',
    operador:'UTE Escobedo (Servicio Propio)', color:'#E65100', colorFondo:'#FBE9E7',
    horarios:{entrada:['6:40'], salida:['15:00','21:00']},
    costo:'$350.00 MXN / mes',
    metodoPago:['Pago en Caja (Rectoría D1)','Transferencia bancaria'],
    nota:'Servicio directo a cargo de la universidad. Requiere registro previo en Control Escolar.',
    paradas_ida:['Fiesta San Agustín (punto de reunión)','Col. Contry / Valle','Av. Lázaro Cárdenas','Aeropuerto Internacional MTY (cruce)','Libramiento Noreste Km. 33.5','UTE – Casita Principal'],
    paradas_vuelta:['UTE – Casita Principal','Libramiento Noreste Km. 33.5','Aeropuerto Internacional MTY (cruce)','Av. Lázaro Cárdenas','Col. Contry / Valle','Fiesta San Agustín'],
    coords_ida:[[25.7890,-100.3200],[25.7930,-100.3140],[25.7990,-100.3060],[25.8060,-100.2990],[25.8200,-100.2890],[25.83005,-100.28320]],
    coords_vuelta:[[25.83005,-100.28320],[25.8200,-100.2890],[25.8060,-100.2990],[25.7990,-100.3060],[25.7930,-100.3140],[25.7890,-100.3200]]
  }
];

/* ════════════════════════════════════════
   PERSISTENCIA localStorage
════════════════════════════════════════ */
const DB = {
  _get(k, fallback) {
    try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : fallback; }
    catch(e) { return fallback; }
  },
  _set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
  getEdificios() { return this._get('ute_edificios', EDIFICIOS_DATA); },
  saveEdificios(d) { this._set('ute_edificios', d); },
  getRutas() { return this._get('ute_rutas', RUTAS_DATA); },
  saveRutas(d) { this._set('ute_rutas', d); },
  resetAll() { localStorage.removeItem('ute_edificios'); localStorage.removeItem('ute_rutas'); }
};
