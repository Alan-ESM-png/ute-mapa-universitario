/**
 * UTE Escobedo – Sistema de Autenticación y Roles v4.7
 * Roles: visitor | student | employee | admin
 *
 * 🛡️ v4.7 – Migración a MySQL:
 *   - login() usa API REST contra backend Node.js/MySQL
 *   - logout() revoca sesión en backend + limpia local
 *   - Fallback a modo demo si el backend no responde
 *
 * 🛡️ Refactor v4.6:
 *   - var → const/let (módulo IIFE)
 *   - logout() usa basePath explícito en vez de depth frágil
 *   - try/catch en sessionStorage
 *   - Comentarios JSDoc
 */
'use strict';

const Auth = (() => {
  const STORAGE_KEY = 'ute_session';

  /** Usuarios de demostración (fallback offline). En producción se valida contra el backend. */
  const USERS_DB = [
    { id: 1, name: 'Admin Sistema',   email: 'admin@ute.edu.mx',  password: 'admin123',  role: 'admin',    avatar: 'AS' },
    { id: 2, name: 'María Rodríguez', email: 'maria@ute.edu.mx',  password: 'alumno123', role: 'student',  avatar: 'MR' },
    { id: 3, name: 'Carlos Empleado', email: 'carlos@ute.edu.mx', password: 'emp123',    role: 'employee', avatar: 'CE' },
  ];

  const ROLE_LABELS = {
    visitor: 'Visitante', student: 'Alumno', employee: 'Empleado', admin: 'Administrador'
  };

  /** Permisos por rol. Cada permiso habilita una funcionalidad específica. */
  const ROLE_PERMS = {
    visitor:  ['view_map', 'view_routes'],
    student:  ['view_map', 'view_routes', 'view_buildings'],
    employee: ['view_map', 'view_routes', 'view_buildings'],
    admin:    ['view_map', 'view_routes', 'view_buildings', 'edit_map', 'edit_routes', 'edit_buildings', 'manage_users']
  };

  /** @returns {Object|null} La sesión activa desde sessionStorage */
  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)); }
    catch { return null; }
  }

  function setSession(u) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(u)); }
    catch { /* sessionStorage no disponible */ }
  }

  function clearSession() {
    try { sessionStorage.removeItem(STORAGE_KEY); }
    catch {}
  }

  /**
   * Autentica con email y contraseña.
   * Primero intenta contra el backend MySQL; si no está disponible,
   * usa los usuarios de demostración locales como fallback.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ok:boolean, user?:Object, msg?:string}>}
   */
  async function login(email, password) {
    // 1) Intentar autenticación contra el backend MySQL
    try {
      const backendAvailable = await API.isBackendAvailable();
      if (backendAvailable) {
        const result = await API.login(email, password);
        if (result.ok) {
          setSession(result.user);
          return { ok: true, user: result.user };
        }
        // Si el backend rechazó las credenciales, no hacer fallback
        return result;
      }
    } catch (e) {
      console.warn('Backend no disponible, usando autenticación local:', e.message);
    }

    // 2) Fallback: autenticación local con usuarios demo
    const user = USERS_DB.find(u => u.email === email && u.password === password);
    if (!user) return { ok: false, msg: 'Credenciales incorrectas' };
    const session = {
      id: user.id, name: user.name, email: user.email,
      role: user.role, avatar: user.avatar
    };
    setSession(session);
    return { ok: true, user: session };
  }

  /** Inicia sesión como visitante (sin credenciales). */
  function loginAsVisitor() {
    const session = { id: 0, name: 'Visitante', email: '', role: 'visitor', avatar: 'V' };
    setSession(session);
    return session;
  }

  /**
   * Cierra sesión y redirige al inicio.
   * Usa rutas relativas calculadas desde la ubicación actual.
   */
  function logout() {
    // Intentar revocar sesión en el backend (no bloqueante)
    API.logout().catch(function() { /* ignorar errores de red */ });
    clearSession();
    // Determinar la ruta correcta al index.html raíz
    const path = window.location.pathname;
    const isInPages = path.includes('/pages/');
    const isInAdmin = path.includes('/admin/');
    let redirectUrl = 'index.html';
    if (isInPages || isInAdmin) redirectUrl = '../index.html';
    window.location.href = redirectUrl;
  }

  /**
   * Verifica si la sesión actual tiene un permiso específico.
   * @param {string} permission — ej: 'edit_map'
   * @returns {boolean}
   */
  function can(permission) {
    const s = getSession();
    return (ROLE_PERMS[s ? s.role : 'visitor'] || []).includes(permission);
  }

  /** @returns {string} Etiqueta legible del rol */
  function getRoleLabel(role) {
    return ROLE_LABELS[role] || role;
  }

  /**
   * Inyecta el badge de usuario con dropdown en un contenedor.
   * Usado por páginas secundarias (rutas.html, perfil.html, admin/index.html).
   * @param {string} containerId — ID del elemento contenedor
   * @param {{basePath?:string}} opts — basePath para rutas relativas (default: '../')
   */
  function injectUserBadge(containerId, { basePath = '../' } = {}) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const s = getSession() || { name: 'Visitante', role: 'visitor', avatar: 'V', email: '' };
    const isAdmin = s.role === 'admin';
    const notVisitor = s.role !== 'visitor';

    el.innerHTML = `
      <div class="u-dropdown-wrap" id="uDropWrap">
        <div class="user-badge clickable" id="uBadgeBtn" onclick="Auth._toggleDropdown()">
          <div class="user-avatar">${s.avatar}</div>
          <div class="user-info">
            <div class="user-name">${s.name}</div>
            <div class="user-role">${getRoleLabel(s.role)}</div>
          </div>
          <span class="u-arrow" id="uArrow">▾</span>
        </div>
        <div class="u-dropdown" id="uDropdown">
          <div class="u-drop-header">
            <div class="u-drop-av">${s.avatar}</div>
            <div>
              <div class="u-drop-name">${s.name}</div>
              <div class="u-drop-email">${s.email || 'Sin correo'}</div>
              <span class="badge badge-${isAdmin ? 'admin' : 'blue'}" style="margin-top:4px">${getRoleLabel(s.role)}</span>
            </div>
          </div>
          <div class="u-drop-divider"></div>
          ${notVisitor ? `<a class="u-drop-item" href="${basePath}pages/perfil.html"><i class="fa-solid fa-user"></i> Mi Perfil</a>` : ''}
          ${isAdmin    ? `<a class="u-drop-item" href="${basePath}admin/index.html"><i class="fa-solid fa-gear"></i> Panel de Admin</a>` : ''}
          <div class="u-drop-divider"></div>
          <div class="u-drop-item danger" onclick="Auth.logout()"><i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión</div>
        </div>
      </div>`;

    // Cerrar dropdown al clicar fuera
    document.addEventListener('click', function(e) {
      const wrap = document.getElementById('uDropWrap');
      if (wrap && !wrap.contains(e.target)) _closeDropdown();
    });
  }

  /** Toggle del dropdown inyectado en páginas secundarias. */
  function _toggleDropdown() {
    const d = document.getElementById('uDropdown');
    const a = document.getElementById('uArrow');
    if (!d) return;
    const open = d.classList.toggle('open');
    if (a) a.style.transform = open ? 'rotate(180deg)' : '';
  }

  function _closeDropdown() {
    const d = document.getElementById('uDropdown');
    const a = document.getElementById('uArrow');
    if (d) d.classList.remove('open');
    if (a) a.style.transform = '';
  }

  return {
    getSession, login, loginAsVisitor, logout, can, getRoleLabel,
    injectUserBadge, _toggleDropdown, _closeDropdown
  };
})();
