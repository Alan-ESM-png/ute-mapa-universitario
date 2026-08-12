/**
 * UTE Escobedo – Servicio API REST v1.0
 * ══════════════════════════════════════════════════
 * Centraliza todas las llamadas al backend Node.js/MySQL.
 * Maneja tokens JWT automáticamente y provee fallback
 * a datos locales si el backend no está disponible.
 *
 * Requiere que api_backend.js esté corriendo en el puerto configurado.
 */
'use strict';

const API = (() => {
  /** URL base del backend. Configurable según entorno. */
  const BASE_URL = 'http://localhost:3000';

  /** Clave en sessionStorage para el token JWT */
  const TOKEN_KEY = 'ute_token';

  /* ──────────────────────────────────────────────
     Utilidades internas
  ────────────────────────────────────────────── */

  /**
   * Obtiene el token JWT almacenado.
   * @returns {string|null}
   */
  function getToken() {
    try { return sessionStorage.getItem(TOKEN_KEY); }
    catch { return null; }
  }

  /**
   * Guarda el token JWT.
   * @param {string} token
   */
  function setToken(token) {
    try { sessionStorage.setItem(TOKEN_KEY, token); }
    catch { /* sessionStorage no disponible */ }
  }

  /** Elimina el token JWT. */
  function clearToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); }
    catch {}
  }

  /**
   * Realiza una petición HTTP a la API.
   * @param {string} endpoint — ej: '/api/edificios'
   * @param {object} [opts] — opciones de fetch
   * @param {string} [opts.method] — GET, POST, PATCH, DELETE
   * @param {object} [opts.body] — cuerpo JSON (solo POST/PATCH)
   * @param {boolean} [opts.auth] — si requiere token JWT
   * @returns {Promise<object>} — respuesta parseada como JSON
   */
  async function request(endpoint, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };

    if (opts.auth) {
      const token = getToken();
      if (token) headers['Authorization'] = 'Bearer ' + token;
    }

    const fetchOpts = { method: opts.method || 'GET', headers };
    if (opts.body) fetchOpts.body = JSON.stringify(opts.body);
    // Timeout de 8s para no colgar la UI si el backend no responde
    if (!fetchOpts.signal) fetchOpts.signal = AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined;

    const res = await fetch(BASE_URL + endpoint, fetchOpts);

    // Si el token expiró, limpiarlo y redirigir
    if (res.status === 401) {
      clearToken();
      // Forzar logout para que el usuario sepa que su sesión expiró
      if (typeof Auth !== 'undefined' && Auth.logout) {
        setTimeout(function() { Auth.logout(); }, 1500);
      }
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error de API (' + res.status + ')');
    return data;
  }

  /** Indica si el backend está respondiendo (cache por 30s). */
  let _backendAvailable = true;
  let _lastCheck = 0;

  async function isBackendAvailable() {
    const now = Date.now();
    if (now - _lastCheck < 30000) return _backendAvailable;
    try {
      await fetch(BASE_URL + '/api/edificios', { method: 'HEAD', signal: AbortSignal.timeout(3000) });
      _backendAvailable = true;
    } catch {
      _backendAvailable = false;
    }
    _lastCheck = now;
    return _backendAvailable;
  }

  /* ──────────────────────────────────────────────
     Endpoints públicos — Edificios
  ────────────────────────────────────────────── */

  /**
   * Obtiene todos los edificios activos.
   * @returns {Promise<Array>}
   */
  async function getEdificios() {
    const data = await request('/api/edificios');
    // Mapear nombres de columnas SQL a los que espera el frontend
    return data.map(e => ({
      id: e.id,
      nombre: e.nombre,
      tipo: e.tipo,
      lat: parseFloat(e.latitud),
      lng: parseFloat(e.longitud),
      color: e.color_hex,
      horario: e.horario,
      salones: {
        total: e.salones_total || 0,
        labs: e.labs || 0,
        aulas: e.aulas || 0,
        salas: e.salas || 0
      }
      // Nota: carreras, maestros, grupos, tramites vienen de endpoints separados
      // o se pueden añadir como JOINs en el futuro
    }));
  }

  /**
   * Actualiza datos básicos de un edificio (solo admin).
   * @param {string} id — ID del edificio (ej: 'D4')
   * @param {object} data — {nombre, horario, salones, lat, lng}
   */
  async function updateEdificio(id, data) {
    return await request('/api/edificios/' + id, {
      method: 'PATCH',
      auth: true,
      body: data
    });
  }

  /**
   * Actualiza solo las coordenadas de un edificio (solo admin).
   * @param {string} id
   * @param {number} lat
   * @param {number} lng
   */
  /* ──────────────────────────────────────────────
     Endpoints públicos — Rutas
  ────────────────────────────────────────────── */

  /**
   * Obtiene todas las rutas activas con sus coordenadas, paradas y horarios.
   * @returns {Promise<Array>}
   */
  async function getRutas() {
    const data = await request('/api/rutas');
    // Mapear al formato que espera el frontend
    return data.map(r => ({
      id: 'ruta-' + r.id,
      nombre: r.nombre,
      tipo: r.tipo,
      operador: r.operador,
      color: r.color_hex,
      colorFondo: _lightenColor(r.color_hex),
      horarios: _agruparHorarios(r.horarios || []),
      costo: r.costo,
      metodoPago: (r.metodos_pago || []).map(m => m.descripcion || m),
      nota: r.nota || '',
      paradas_ida: (r.paradas || []).filter(p => p.sentido === 'ida').sort((a,b) => a.orden - b.orden).map(p => p.nombre),
      paradas_vuelta: (r.paradas || []).filter(p => p.sentido === 'vuelta').sort((a,b) => a.orden - b.orden).map(p => p.nombre),
      coords_ida: (r.coords || []).filter(c => c.sentido === 'ida').sort((a,b) => a.orden - b.orden).map(c => [parseFloat(c.latitud), parseFloat(c.longitud)]),
      coords_vuelta: (r.coords || []).filter(c => c.sentido === 'vuelta').sort((a,b) => a.orden - b.orden).map(c => [parseFloat(c.latitud), parseFloat(c.longitud)])
    }));
  }

  /**
   * Agrupa horarios por tipo (entrada/salida).
   * @param {Array} horarios — [{tipo, hora}, ...]
   * @returns {object} — {entrada: ['7:00', ...], salida: ['14:20', ...]}
   */
  function _agruparHorarios(horarios) {
    const grouped = { entrada: [], salida: [] };
    horarios.forEach(h => {
      const hora = h.hora ? h.hora.slice(0, 5) : ''; // HH:MM desde TIME
      if (h.tipo === 'entrada') grouped.entrada.push(hora);
      else grouped.salida.push(hora);
    });
    return grouped;
  }

  /**
   * Genera un color de fondo claro a partir de un hex.
   * @param {string} hex — color hexadecimal
   * @returns {string}
   */
  function _lightenColor(hex) {
    // Colores de fondo predefinidos según el color de la ruta
    const map = {
      '#2E7D32': '#E8F5E9',
      '#E65100': '#FBE9E7',
      '#1565C0': '#E3F2FD',
      '#6A1B9A': '#F3E5F5',
      '#00838F': '#E0F7FA',
      '#BF360C': '#FBE9E7',
      '#4527A0': '#EDE7F6',
      '#1A237E': '#E8EAF6',
      '#F4821F': '#FFF3E0',
      '#00897B': '#E0F2F1',
      '#AD1457': '#FCE4EC'
    };
    return map[hex] || '#F5F5F5';
  }

  /* ──────────────────────────────────────────────
     Endpoints — Autenticación
  ────────────────────────────────────────────── */

  /**
   * Inicia sesión contra el backend.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ok:boolean, user?:object, msg?:string}>}
   */
  async function login(email, password) {
    try {
      const data = await request('/api/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      setToken(data.token);
      return {
        ok: true,
        user: {
          id: data.id,
          name: data.nombre,
          email: email,
          role: data.rol,
          avatar: data.avatar
        }
      };
    } catch (err) {
      return { ok: false, msg: err.message };
    }
  }

  /**
   * Cierra sesión en el backend y limpia el token local.
   */
  async function logout() {
    try {
      await request('/api/auth/logout', { method: 'POST', auth: true });
    } catch {
      // Incluso si falla el backend, limpiamos localmente
    }
    clearToken();
  }

  /* ──────────────────────────────────────────────
     API pública
  ────────────────────────────────────────────── */
  return {
    getEdificios,
    updateEdificio,
    getRutas,
    login,
    logout,
    getToken,
    isBackendAvailable,
    BASE_URL
  };
})();
