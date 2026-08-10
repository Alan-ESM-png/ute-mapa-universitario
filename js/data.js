/**
 * UTE Escobedo – Utilidades + Datos + Persistencia v4.6
 * Incluye: $(), toast(), CAMPUS_CENTER, RUTAS_DATA, DB
 * Depende de: edificios.js (EDIFICIOS_DATA)
 *
 * 🛡️ Refactor v4.6:
 *   - var → const (funciones globales)
 *   - DB: try/catch en todos los accesos a localStorage
 *   - toast(): fallback si el contenedor no existe
 *   - Comentarios JSDoc
 */
'use strict';

/**
 * Selector rápido por ID.
 * @param {string} id — ID del elemento
 * @returns {HTMLElement|null}
 */
const $ = function(id) { return document.getElementById(id); };

/**
 * Muestra una notificación toast temporal.
 * @param {string} msg — Mensaje a mostrar
 * @param {'success'|'error'|'info'|'warn'} [type='info'] — Tipo de toast
 * @param {number} [dur=3200] — Duración en ms
 */
function toast(msg, type, dur) {
  type = type || 'info';
  dur = dur || 3200;
  const c = $('toast-c');
  if (!c) return; // Sin contenedor de toasts, no hacer nada
  const t = document.createElement('div');
  const icons = {
    success: 'fa-circle-check', error: 'fa-circle-xmark',
    info: 'fa-circle-info', warn: 'fa-triangle-exclamation'
  };
  t.className = 'toast ' + type;
  t.innerHTML = '<i class="fa-solid ' + (icons[type] || icons.info) + '"></i> ' + msg;
  c.appendChild(t);
  setTimeout(function() { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, Math.max(0, dur - 400));
  setTimeout(function() { t.remove(); }, dur);
}

/** Centro geométrico del campus (calculado promediando los 11 edificios). */
const CAMPUS_CENTER = { lat: 25.83010, lng: -100.27663 };

/* ═══════════════════════════════════════════════════
   RUTAS DE TRANSPORTE
   Ruta C4: La Unidad – Laredo – UTE (datos reales)
═══════════════════════════════════════════════════ */
const RUTAS_DATA = [
  {
    id: 'ruta-c4', nombre: 'C4 – La Unidad / Laredo / UTE', tipo: 'publica',
    operador: 'Transporte Urbano Nuevo León', color: '#2E7D32', colorFondo: '#E8F5E9',
    horarios: { entrada: ['7:00', '18:00'], salida: ['14:20', '21:45'] },
    costo: 'Tarifa NL Camión / Mi Muevo',
    metodoPago: ['Efectivo (tarifa NL)', 'Tarjeta Mi Muevo'],
    nota: 'Es común que tome el puente de la Colombia-Monclova en el recorrido de vuelta. Pregunta al operador antes de abordar si planeas bajar en alguno de esos cruces.',
    paradas_ida: ['Av. La Unidad', 'Antiguo Camino San Agustín', 'Av. 4 de Octubre', 'Av. Agualeguas', 'Av. Las Torres', 'Av. Raúl Salinas', 'Libramiento Noreste', 'Carr. Monclova', 'Carr. Colombia', 'Antiguo Camino a San José de los Sauces', 'Carr. Monclova', 'Carr. Laredo', 'Libramiento Noreste Km 33.5', 'UTE – Entrada'],
    paradas_vuelta: ['UTE – Entrada', 'Libramiento Noreste', 'Av. Raúl Salinas', 'Av. Las Torres', 'Av. Agualeguas', 'Av. 4 de Octubre', 'Antiguo Camino San Agustín', 'Unidad Popular', 'Av. La Unidad'],
    coords_ida: [[25.7820, -100.3350], [25.7865, -100.3280], [25.7920, -100.3200], [25.7980, -100.3100], [25.8050, -100.3020], [25.8110, -100.2980], [25.8160, -100.2940], [25.8200, -100.2900], [25.8240, -100.2870], [25.8265, -100.2855], [25.8280, -100.2845], [25.8295, -100.2838], [25.8302, -100.2830], [25.83005, -100.28320]],
    coords_vuelta: [[25.83005, -100.28320], [25.8295, -100.2838], [25.8200, -100.2900], [25.8110, -100.2980], [25.8050, -100.3020], [25.7980, -100.3100], [25.7920, -100.3200], [25.7865, -100.3280], [25.7820, -100.3350]]
  }, {
    id: 'ruta-escolar-sur', nombre: 'Bus Escolar – Zona Sur / Monterrey', tipo: 'privada',
    operador: 'UTE Escobedo (Servicio Propio)', color: '#E65100', colorFondo: '#FBE9E7',
    horarios: { entrada: ['6:40'], salida: ['15:00', '21:00'] },
    costo: '$350.00 MXN / mes',
    metodoPago: ['Pago en Caja (Rectoría D1)', 'Transferencia bancaria'],
    nota: 'Servicio directo a cargo de la universidad. Requiere registro previo en Control Escolar.',
    paradas_ida: ['Fiesta San Agustín (punto de reunión)', 'Col. Contry / Valle', 'Av. Lázaro Cárdenas', 'Aeropuerto Internacional MTY (cruce)', 'Libramiento Noreste Km. 33.5', 'UTE – Casita Principal'],
    paradas_vuelta: ['UTE – Casita Principal', 'Libramiento Noreste Km. 33.5', 'Aeropuerto Internacional MTY (cruce)', 'Av. Lázaro Cárdenas', 'Col. Contry / Valle', 'Fiesta San Agustín'],
    coords_ida: [[25.7890, -100.3200], [25.7930, -100.3140], [25.7990, -100.3060], [25.8060, -100.2990], [25.8200, -100.2890], [25.83005, -100.28320]],
    coords_vuelta: [[25.83005, -100.28320], [25.8200, -100.2890], [25.8060, -100.2990], [25.7990, -100.3060], [25.7930, -100.3140], [25.7890, -100.3200]]
  }
];

/* ═══════════════════════════════════════════════════
   PERSISTENCIA — localStorage con try/catch
   + sincronización con backend MySQL via API
   en todas las operaciones para evitar errores
   silenciosos si el storage está lleno o ausente
═══════════════════════════════════════════════════ */

/**
 * Módulo de base de datos híbrida (localStorage + API REST).
 * - Lectura: localStorage (cache) → fallback a datos hardcodeados
 * - Escritura: localStorage + API (fire-and-forget, no bloquea UI)
 * - init(): carga datos frescos desde el backend al iniciar
 *
 * El backend se llama en segundo plano; si falla, la app
 * sigue funcionando 100% offline con datos locales.
 */
const DB = {
  /** Flag para saber si ya se inicializó desde el backend */
  _inicializado: false,

  /**
   * Lee una clave de localStorage con fallback.
   * @param {string} k — clave
   * @param {*} fallback — valor por defecto si no existe o hay error
   * @returns {*}
   */
  _get(k, fallback) {
    try {
      const s = localStorage.getItem(k);
      return s ? JSON.parse(s) : fallback;
    } catch (e) {
      console.warn('DB._get falló para ' + k + ':', e);
      return fallback;
    }
  },

  /**
   * Escribe una clave en localStorage.
   * @param {string} k — clave
   * @param {*} v — valor (se serializa a JSON)
   */
  _set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); }
    catch (e) { console.warn('DB._set falló para ' + k + ':', e); }
  },

  /**
   * Inicializa la caché local desde el backend MySQL.
   * Se llama UNA vez al cargar la página. Si el backend no responde,
   * se usan los datos locales existentes o los predeterminados.
   * @returns {Promise<void>}
   */
  async init() {
    if (this._inicializado) return;
    this._inicializado = true;

    // Cargar edificios desde backend
    try {
      const backendOk = await API.isBackendAvailable();
      if (backendOk) {
        const edificios = await API.getEdificios();
        if (edificios && edificios.length > 0) {
          // Enriquecer con datos locales (carreras, maestros, grupos, tramites, areas)
          const fallback = EDIFICIOS_DATA;
          const enriched = edificios.map(function(e) {
            const fb = fallback.find(function(f) { return f.id === e.id; });
            // Siempre asignar defaults para evitar crashes en cascada
            e.carreras = (fb && fb.carreras) || [];
            e.areas = (fb && fb.areas) || [];
            e.maestros = (fb && fb.maestros) || [];
            e.grupos = (fb && fb.grupos) || [];
            e.tramites = (fb && fb.tramites) || [];
            return e;
          });
          this._set('ute_edificios', enriched);
          console.log('✅ Edificios cargados desde MySQL (' + enriched.length + ')');
        }

        const rutas = await API.getRutas();
        if (rutas && rutas.length > 0) {
          this._set('ute_rutas', rutas);
          console.log('✅ Rutas cargadas desde MySQL (' + rutas.length + ')');
        }
      }
    } catch (e) {
      console.warn('⚠️ Backend no disponible, usando datos locales:', e.message);
    }
  },

  /** @returns {Array} Lista de edificios desde caché local o datos predeterminados */
  getEdificios() { return this._get('ute_edificios', EDIFICIOS_DATA); },

  /**
   * Guarda la lista de edificios en localStorage y envía al backend.
   * La llamada al backend es asíncrona (fire-and-forget) para no bloquear la UI.
   * @param {Array} d — Lista completa de edificios
   */
  saveEdificios(d) {
    this._set('ute_edificios', d);
    // Sincronizar con backend en segundo plano
    this._syncEdificios(d);
  },

  /**
   * Envía cambios de edificios al backend (uno por uno).
   * Solo envía los campos que el backend acepta.
   * @param {Array} d — Lista completa de edificios
   */
  async _syncEdificios(d) {
    try {
      const backendOk = await API.isBackendAvailable();
      if (!backendOk) return;
      for (let i = 0; i < d.length; i++) {
        const e = d[i];
        try {
          await API.updateEdificio(e.id, {
            nombre: e.nombre,
            horario: e.horario,
            salones: e.salones ? e.salones.total : undefined,
            lat: e.lat,
            lng: e.lng
          });
        } catch (err) {
          console.warn('DB._syncEdificios: error al guardar ' + e.id + ':', err.message);
        }
      }
    } catch (_) { /* backend no disponible, no pasa nada */ }
  },

  /** @returns {Array} Lista de rutas desde caché local o datos predeterminados */
  getRutas() { return this._get('ute_rutas', RUTAS_DATA); },

  /**
   * Guarda la lista de rutas en localStorage.
   * Las rutas no tienen endpoint de escritura en el backend actual,
   * pero se mantiene el localStorage como caché.
   * @param {Array} d — Lista completa de rutas
   */
  saveRutas(d) { this._set('ute_rutas', d); },

  /** Restaura todos los datos a sus valores predeterminados */
  resetAll() {
    try {
      localStorage.removeItem('ute_edificios');
      localStorage.removeItem('ute_rutas');
    } catch {}
  }
};
