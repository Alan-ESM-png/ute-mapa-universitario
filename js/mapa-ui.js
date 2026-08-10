/**
 * UTE Escobedo – Mapa UI Overlays v4.6
 * Funciones de UI superpuestas: login modal, búsqueda, user dropdown, share, onboarding.
 * Depende de: mapa-core.js (variables: edificios, map, activeId, etc.)
 *
 * 🛡️ Refactor v4.6:
 *   - var → const/let, searchFocusIdx como let del módulo
 *   - Debounce de 250ms en búsqueda (antes 200ms) para evitar parpadeo
 *   - try/catch en operaciones de clipboard y DOM
 *   - Comentarios JSDoc en funciones clave
 */
'use strict';

/* ════════════════════════════════════════════════════
   USER DROPDOWN — Menú desplegable del avatar
════════════════════════════════════════════════════ */

function toggleUDrop() {
  const d = $('uDrop'), a = $('uArr'); if (!d) return;
  const isOpen = d.classList.contains('open');
  if (!isOpen) { const r = $('uBadge').getBoundingClientRect(); d.style.top = (r.bottom + 8) + 'px'; d.style.left = Math.max(8, r.right - 218) + 'px'; d.style.right = 'auto'; }
  d.classList.toggle('open', !isOpen);
  if (a) a.style.transform = !isOpen ? 'rotate(180deg)' : '';
}

function doLogout() { Auth.logout(); }

/* ════════════════════════════════════════════════════
   LOGIN MODAL — Modal de inicio de sesión
════════════════════════════════════════════════════ */

function openLoginModal() {
  const lmo = $('loginModalOverlay'); if (!lmo) return;
  lmo.classList.add('open');
  const le = $('loginError'); if (le) le.classList.remove('show');
  ['loginEmail','loginPassword'].forEach(id => { const el = $(id); if (el) el.value = ''; });
  document.body.style.overflow = 'hidden';
  setTimeout(() => { const em = $('loginEmail'); if (em) em.focus(); }, 150);
}

function closeLoginModal(e) {
  if (e && e.target !== $('loginModalOverlay')) return;
  const lmo = $('loginModalOverlay'); if (lmo) lmo.classList.remove('open');
  document.body.style.overflow = '';
}

/** Procesa el login desde el modal: valida campos, autentica y redirige según rol. */
async function doLoginFromModal() {
  try {
    const emailEl = $('loginEmail'), passEl = $('loginPassword');
    const email = emailEl ? emailEl.value.trim() : '';
    const pass = passEl ? passEl.value : '';
    const le = $('loginError'), letxt = $('loginErrorTxt');
    if (le) le.classList.remove('show');

    if (!email || !pass) {
      if (letxt) letxt.textContent = 'Completa todos los campos.';
      if (le) le.classList.add('show');
      return;
    }

    const res = await Auth.login(email, pass);
    if (!res.ok) {
      if (letxt) letxt.textContent = res.msg;
      if (le) le.classList.add('show');
      return;
    }

    sess = res.user;
    if (sess.role === 'admin') { window.location.href = 'admin/index.html'; return; }
    closeLoginModal();
    updateNavUI();
    toast('¡Bienvenido, ' + sess.name + '!', 'success', 3000);
    if (Auth.can('edit_map')) {
      const ar = $('adminRow');
      if (ar) ar.style.display = 'flex';
    }
  } catch (err) {
    console.error('doLoginFromModal error:', err);
    toast('Error inesperado al iniciar sesión', 'error');
  }
}

// Enter en el campo de contraseña dispara el login
const lpEl = $('loginPassword');
if (lpEl) {
  lpEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doLoginFromModal();
  });
}

/* ════════════════════════════════════════════════════
   LIVE SEARCH OVERLAY — Búsqueda en tiempo real
   con debounce de 250ms y navegación por teclado
════════════════════════════════════════════════════ */
let searchFocusIdx = -1;

function openSearch() {
  const so = $('searchOverlay');
  if (!so) return;
  so.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(function() { const sbi = $('searchBigInput'); if (sbi) sbi.focus(); }, 60);
}

function closeSearch() {
  const so = $('searchOverlay'), sbi = $('searchBigInput');
  if (so) so.classList.remove('open');
  if (sbi) sbi.value = '';
  document.body.style.overflow = '';
  renderSearchResults(''); searchFocusIdx = -1;
}
function closeSearchOverlay(e) { if (e.target === $('searchOverlay')) closeSearch(); }

// Búsqueda con debounce de 250ms — evita saturar el DOM al escribir rápido
let searchTimer = null;
const searchBigInput = $('searchBigInput');
if (searchBigInput) {
  searchBigInput.addEventListener('input', function(e) {
    searchFocusIdx = -1;
    clearTimeout(searchTimer);
    const val = e.target.value.trim();
    searchTimer = setTimeout(function() { renderSearchResults(val); }, 250);
  });
}

/** Renderiza los resultados de búsqueda para edificios y rutas. */
function renderSearchResults(q) {
  const box = $('searchResults');
  if (!box) return;

  if (!q) {
    const recents = getRecents();
    let html = '<div class="search-hint"><div class="sh-ico"><i class="fa-solid fa-building-columns"></i></div><p>Escribe para buscar edificios, carreras,<br>maestros, trámites o rutas de transporte</p><div class="sh-shortcuts"><span><span class="kbd">↑↓</span> navegar</span><span><span class="kbd">Enter</span> seleccionar</span><span><span class="kbd">Esc</span> cerrar</span></div></div>';
    if (recents.length) {
      const rbs = recents.map(function(id) {
        return edificios.find(function(e) { return e.id === id; });
      }).filter(Boolean);
      html = '<div class="search-section-title"><i class="fa-solid fa-clock-rotate-left"></i> Visitados recientemente</div>' +
        rbs.map(function(e) { return buildSRItem(e, ''); }).join('') +
        html.replace('<div class="search-hint">', '<div class="search-hint" style="border-top:1px solid var(--gris-100)">');
    }
    box.innerHTML = html;
    return;
  }

  const ql = q.toLowerCase();
  const bldResults = edificios.filter(function(e) {
    return (e.nombre||"").toLowerCase().indexOf(ql) !== -1 ||
      e.id.toLowerCase().indexOf(ql) !== -1 ||
      e.carreras.some(function(c) { return c.toLowerCase().indexOf(ql) !== -1; }) ||
      (e.maestros||[]).some(function(m) { return m.nombre.toLowerCase().indexOf(ql) !== -1; }) ||
      (e.tramites||[]).some(function(t) { return t.toLowerCase().indexOf(ql) !== -1; });
  });
  const rutResults = rutas.filter(function(r) {
    return r.nombre.toLowerCase().indexOf(ql) !== -1 ||
      (r.operador||"").toLowerCase().indexOf(ql) !== -1 ||
      r.costo.toLowerCase().indexOf(ql) !== -1 ||
      r.id.toLowerCase().indexOf(ql) !== -1 ||
      r.paradas_ida.some(function(p) { return p.toLowerCase().indexOf(ql) !== -1; });
  });

  if (!bldResults.length && !rutResults.length) {
    box.innerHTML = '<div class="sr-empty"><i class="fa-solid fa-face-frown" style="font-size:1.5rem;margin-bottom:.4rem;display:block"></i> Sin resultados para "<strong>' + q.replace(/[<>&"]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]||c}) + '</strong>"<br><span style="font-size:.72rem;color:var(--gris-400)">Intenta con otro término</span></div>';
    return;
  }

  let html = '';
  if (bldResults.length) {
    html += '<div class="search-section-title"><i class="fa-solid fa-building-columns"></i> Edificios (' + bldResults.length + ')</div>' +
      bldResults.map(function(e) { return buildSRItem(e, ql); }).join('');
  }
  if (rutResults.length) {
    html += '<div class="search-section-title"><i class="fa-solid fa-bus"></i> Rutas (' + rutResults.length + ')</div>' +
      rutResults.map(function(r) { return buildSRRuta(r, ql); }).join('');
  }
  box.innerHTML = html;
}

/** Construye un item de resultado para una ruta. */
function buildSRRuta(r, q) {
  function hl(str) {
    if (!q) return str;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return str.replace(new RegExp('(' + escaped + ')', 'gi'), '<span class="sr-match">$1</span>');
  }
  return '<div class="sr-item" onclick="if(!rutasOn)toggleRutas();toggleRutaInd(\'' + r.id + '\');closeSearch();">' +
    '<div class="sr-badge" style="background:' + r.color + '"><i class="fa-solid fa-bus"></i></div>' +
    '<div class="sr-info"><div class="sr-name">' + hl(r.nombre) + '</div>' +
    '<div class="sr-meta"><span class="sr-type">' + (r.tipo === 'publica' ? '<i class="fa-solid fa-bus-simple"></i> Público' : '<i class="fa-solid fa-shield-halved"></i> Escolar') + '</span>' +
    '<span class="sr-status" style="background:var(--naranja-bg);color:var(--naranja-dark)">' + r.costo + '</span></div></div>' +
    '<span class="sr-arrow"><i class="fa-solid fa-chevron-right"></i></span></div>';
}

/** Construye un item de resultado para un edificio. */
function buildSRItem(e, q) {
  const st = getBuildingStatus(e.horario);
  const tipos = { docencia: 'Docencia', taller: 'Taller', servicio: 'Servicio' };
  function hl(str) {
    if (!q) return str;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return str.replace(new RegExp('(' + escaped + ')', 'gi'), '<span class="sr-match">$1</span>');
  }
  return '<div class="sr-item" onclick="quickSelect(\'' + e.id + '\')"><div class="sr-badge" style="background:' + e.color + '">' + e.id + '</div>' +
    '<div class="sr-info"><div class="sr-name">' + hl(e.nombre) + '</div>' +
    '<div class="sr-meta"><span class="sr-type">' + (tipos[e.tipo] || e.tipo) + '</span>' +
    '<span class="sr-status ' + (st.open ? 'open' : 'closed') + '">' + (st.open ? 'Abierto' : 'Cerrado') + '</span></div></div>' +
    '<span class="sr-arrow"><i class="fa-solid fa-chevron-right"></i></span></div>';
}

function quickSelect(id) { closeSearch(); selectEdificio(id); }

/* ════════════════════════════════════════════════════
   SHARE BUILDING — Copia la URL del edificio actual
   al portapapeles con fallback para navegadores viejos
════════════════════════════════════════════════════ */

function shareBuilding() {
  if (!activeId) return;
  const url = location.origin + location.pathname + '?edificio=' + activeId;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => toast('Enlace copiado', 'success'), () => fallbackCopy(url));
  } else { fallbackCopy(url); }
}
function fallbackCopy(url) {
  try {
    const ta = document.createElement('textarea');
    ta.value = url; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    toast('Enlace copiado', 'success');
  } catch (e) { toast('URL: ' + url, 'info', 6000); }
}

/* ════════════════════════════════════════════════════
   ONBOARDING — Guía interactiva para nuevos usuarios
   Se muestra solo la primera vez (localStorage)
════════════════════════════════════════════════════ */

const OB_STEPS = [
  { title: '¡Bienvenido al Mapa Interactivo de la UTE! 🎓', desc: 'Explora tu campus de forma visual. Haz clic en cualquier edificio del mapa o de la lista para ver: carreras, maestros, trámites, horarios y más.', target: null, arrow: null },
  { title: '🏛️ Lista de Edificios', desc: 'Cada edificio muestra si está abierto o cerrado ahora mismo. Los colores te ayudan a identificar: naranja = docencia, azul = taller, verde = servicio.', targetEl: function() { return document.querySelector('.e-item'); }, arrow: 'tip-arrow-left', offset: { top: 80, left: 10 } },
  { title: '🔍 Busca lo que necesitas', desc: 'Escribe una carrera (ej: "Mecatrónica"), un maestro ("Carlos Muñoz") o un trámite ("Kardex") para encontrar rápido el edificio. También puedes usar Ctrl+K.', targetEl: function() { return $('searchTrigger'); }, arrow: 'tip-arrow-left', offset: { top: -10, left: 10 } },
  { title: '🗺️ Elige tu vista del mapa', desc: 'Cambia entre mapa limpio, satélite de Google, híbrido (satélite + nombres) o modo oscuro. También puedes ver las rutas de camiones activando el toggle.', targetEl: function() { return $('btnLayers'); }, arrow: 'tip-arrow-top', offset: { top: 10, left: -80 } }
];

let obCurrent = 0;

function startOnboarding() {
  obCurrent = 0;
  const oo = $('onboardingOverlay');
  if (oo) oo.style.display = 'block';
  renderOBStep(0);
}

function renderOBStep(idx) {
  const step = OB_STEPS[idx];
  const obNum = $('obNum'), obTitle = $('obTitle'), obDesc = $('obDesc'), obDots = $('obDots');
  if (obNum) obNum.textContent = 'Paso ' + (idx + 1) + ' de ' + OB_STEPS.length;
  if (obTitle) obTitle.textContent = step.title;
  if (obDesc) obDesc.textContent = step.desc;
  if (obDots) obDots.innerHTML = OB_STEPS.map(function(_, i) { return '<div class="ob-dot' + (i === idx ? ' active' : '') + '"></div>'; }).join('');

  const nb = $('onboardingOverlay') ? $('onboardingOverlay').querySelector('.ob-btn.next') : null;
  if (nb) nb.innerHTML = idx === OB_STEPS.length - 1 ? '¡Listo! <i class="fa-solid fa-check"></i>' : 'Siguiente <i class="fa-solid fa-arrow-right"></i>';

  const tip = $('obStep'), spot = $('obSpot');
  if (tip) tip.className = 'onboarding-step';
  if (tip) tip.style.transform = '';

  if (step.targetEl) {
    const tgt = step.targetEl();
    if (tgt && tip && spot) {
      const rect = tgt.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      const TW = 268, TH = 190, G = 14, M = 12;

      spot.style.cssText = 'top:' + (rect.top - 6) + 'px;left:' + (rect.left - 6) + 'px;width:' + (rect.width + 12) + 'px;height:' + (rect.height + 12) + 'px;opacity:1';

      let top = rect.bottom + G + TH + M < vh ? rect.bottom + G : rect.top - G - TH;
      top = Math.max(M, Math.min(top, vh - TH - M));
      let left = Math.max(M, Math.min(rect.left, vw - TW - M));

      tip.style.top = top + 'px';
      tip.style.left = left + 'px';
      tip.style.width = TW + 'px';
      tip.style.boxSizing = 'border-box';
      if (step.arrow) tip.classList.add(step.arrow);
    }
  } else if (spot && tip) {
    spot.style.opacity = '0';
    tip.style.cssText = 'top:50%;left:50%;width:268px;transform:translate(-50%,-50%)';
  }
}

function nextOnboardingStep() {
  if (obCurrent >= OB_STEPS.length - 1) { endOnboarding(); return; }
  obCurrent++;
  renderOBStep(obCurrent);
}

function endOnboarding() {
  const oo = $('onboardingOverlay'); if (oo) oo.style.display = 'none';
  try { localStorage.setItem('ute_onboarded', 'true'); } catch {}
}

/* Helper: muestra ruta especifica desde busqueda (corrige logica invertida) */
function showRutaFromSearch(id) {
  try {
    if (!map) return;
    if (!rutasOn) { rutasOn = true; const rt = document.getElementById('rutasToggle'); if (rt) rt.classList.add('on'); }
    if (!rutaVis[id]) { rutaVis[id] = true; map.addLayer(rutaLayers[id]); }
    const el = document.getElementById('rb-' + id);
    if (el) { el.textContent = 'Visible'; el.classList.add('on'); }
    const rs = document.getElementById('rutasSub');
    if (rs) rs.classList.add('open');
    toast('Ruta activada en el mapa', 'success');
  } catch(_) {}
}
