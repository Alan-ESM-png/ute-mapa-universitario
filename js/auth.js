/**
 * UTE Escobedo – Sistema de Autenticación y Roles v4.1
 * Roles: visitor | student | employee | admin
 */
'use strict';

const Auth = (() => {
  const STORAGE_KEY = 'ute_session';

  const USERS_DB = [
    { id:1, name:'Admin Sistema',   email:'admin@ute.edu.mx',  password:'admin123',  role:'admin',    avatar:'AS' },
    { id:2, name:'María Rodríguez', email:'maria@ute.edu.mx',  password:'alumno123', role:'student',  avatar:'MR' },
    { id:3, name:'Carlos Empleado', email:'carlos@ute.edu.mx', password:'emp123',    role:'employee', avatar:'CE' },
  ];

  const ROLE_LABELS = {
    visitor:'Visitante', student:'Alumno', employee:'Empleado', admin:'Administrador'
  };

  const ROLE_PERMS = {
    visitor:  ['view_map','view_routes'],
    student:  ['view_map','view_routes','view_buildings'],
    employee: ['view_map','view_routes','view_buildings'],
    admin:    ['view_map','view_routes','view_buildings','edit_map','edit_routes','edit_buildings','manage_users']
  };

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)); }
    catch { return null; }
  }
  function setSession(u) { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(u)); }
  function clearSession() { sessionStorage.removeItem(STORAGE_KEY); }

  function login(email, password) {
    const user = USERS_DB.find(u => u.email === email && u.password === password);
    if (!user) return { ok:false, msg:'Credenciales incorrectas' };
    const session = { id:user.id, name:user.name, email:user.email, role:user.role, avatar:user.avatar };
    setSession(session);
    return { ok:true, user:session };
  }

  function loginAsVisitor() {
    const session = { id:0, name:'Visitante', email:'', role:'visitor', avatar:'V' };
    setSession(session);
    return session;
  }

  function logout() {
    clearSession();
    // Detectar si estamos en /pages/ o /admin/
    const depth = window.location.pathname.split('/').filter(Boolean).length;
    window.location.href = depth >= 2 ? '../index.html' : 'index.html';
  }

  function can(permission) {
    const s = getSession();
    return (ROLE_PERMS[s ? s.role : 'visitor'] || []).includes(permission);
  }

  function getRoleLabel(role) { return ROLE_LABELS[role] || role; }

  /**
   * Inyecta el badge de usuario con DROPDOWN (Mi Perfil / Admin / Cerrar sesión).
   * El dropdown se posiciona bajo el avatar en la esquina derecha.
   */
  function injectUserBadge(containerId, { basePath = '../' } = {}) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const s = getSession() || { name:'Visitante', role:'visitor', avatar:'V', email:'' };
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

    // Cerrar al clicar fuera
    document.addEventListener('click', e => {
      const wrap = document.getElementById('uDropWrap');
      if (wrap && !wrap.contains(e.target)) _closeDropdown();
    });
  }

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

  return { getSession, login, loginAsVisitor, logout, can, getRoleLabel, injectUserBadge, _toggleDropdown, _closeDropdown };
})();
