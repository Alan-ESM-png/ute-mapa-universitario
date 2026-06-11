/**
 * UTE Escobedo – Mapa UI Overlays v4.3
 * Funciones de UI superpuestas: login modal, búsqueda, user dropdown, share, onboarding
 * Depende de: mapa-core.js (variables: edificios, map, activeId, getBuildingStatus, addRecent, selectEdificio, etc.)
 */
'use strict';

/* ════════════════════════════════════════════════════
   USER DROPDOWN (para usuarios logueados)
════════════════════════════════════════════════════ */
function toggleUDrop() {
  var d = $('uDrop'), a = $('uArr'), isOpen = d.classList.contains('open');
  if (!isOpen) { var r = $('uBadge').getBoundingClientRect(); d.style.top = (r.bottom + 8) + 'px'; var l = r.right - 218; d.style.left = (l < 8 ? 8 : l) + 'px'; d.style.right = 'auto'; }
  d.classList.toggle('open', !isOpen); a.style.transform = !isOpen ? 'rotate(180deg)' : '';
}

function doLogout() {
  Auth.logout(); // clears session + redirects to index.html → page reloads as visitor
}

/* ════════════════════════════════════════════════════
   LOGIN MODAL
════════════════════════════════════════════════════ */
function openLoginModal() {
  $('loginModalOverlay').classList.add('open'); $('loginError').classList.remove('show');
  $('loginEmail').value = ''; $('loginPassword').value = '';
  document.body.style.overflow = 'hidden'; setTimeout(function() { $('loginEmail').focus(); }, 150);
}
function closeLoginModal(e) { if (e && e.target !== $('loginModalOverlay')) return; $('loginModalOverlay').classList.remove('open'); document.body.style.overflow = ''; }
function doLoginFromModal() {
  var email = $('loginEmail').value.trim(), pass = $('loginPassword').value;
  $('loginError').classList.remove('show');
  if (!email || !pass) { $('loginErrorTxt').textContent = 'Completa todos los campos.'; $('loginError').classList.add('show'); return; }
  var res = Auth.login(email, pass);
  if (!res.ok) { $('loginErrorTxt').textContent = res.msg; $('loginError').classList.add('show'); return; }
  sess = res.user;
  if (sess.role === 'admin') { window.location.href = 'admin/index.html'; return; }
  closeLoginModal(); updateNavUI(); toast('¡Bienvenido, ' + sess.name + '!', 'success', 3000);
  if (Auth.can('edit_map') && $('adminRow')) $('adminRow').style.display = 'flex';
}
var lpEl = $('loginPassword'); if (lpEl) lpEl.addEventListener('keydown', function(e) { if (e.key === 'Enter') doLoginFromModal(); });

/* ════════════════════════════════════════════════════
   LIVE SEARCH OVERLAY
════════════════════════════════════════════════════ */
var searchFocusIdx = -1;
function openSearch() { $('searchOverlay').classList.add('open'); document.body.style.overflow = 'hidden'; setTimeout(function() { $('searchBigInput').focus(); }, 60); }
function closeSearch() { $('searchOverlay').classList.remove('open'); $('searchBigInput').value = ''; document.body.style.overflow = ''; renderSearchResults(''); searchFocusIdx = -1; }
function closeSearchOverlay(e) { if (e.target === $('searchOverlay')) closeSearch(); }
$('searchBigInput').addEventListener('input', function(e) { searchFocusIdx = -1; renderSearchResults(e.target.value.trim()); });

function renderSearchResults(q) {
  var box = $('searchResults');
  if (!q) {
    var recents = getRecents(), html = '<div class="search-hint"><div class="sh-ico"><i class="fa-solid fa-building-columns"></i></div><p>Escribe para buscar edificios, carreras,<br>maestros, trámites o rutas de transporte</p><div class="sh-shortcuts"><span><span class="kbd">↑↓</span> navegar</span><span><span class="kbd">Enter</span> seleccionar</span><span><span class="kbd">Esc</span> cerrar</span></div></div>';
    if (recents.length) { var rbs = recents.map(function(id) { return edificios.find(function(e) { return e.id === id; }); }).filter(Boolean); html = '<div class="search-section-title"><i class="fa-solid fa-clock-rotate-left"></i> Visitados recientemente</div>'+rbs.map(function(e) { return buildSRItem(e, ''); }).join('')+html.replace('<div class="search-hint">', '<div class="search-hint" style="border-top:1px solid var(--gris-100)">'); }
    box.innerHTML = html; return;
  }
  var ql = q.toLowerCase();
  var bldResults = edificios.filter(function(e) { return e.nombre.toLowerCase().indexOf(ql)!==-1||e.id.toLowerCase().indexOf(ql)!==-1||e.carreras.some(function(c){return c.toLowerCase().indexOf(ql)!==-1;})||e.maestros.some(function(m){return m.nombre.toLowerCase().indexOf(ql)!==-1;})||e.tramites.some(function(t){return t.toLowerCase().indexOf(ql)!==-1;}); });
  var rutResults = rutas.filter(function(r) { return r.nombre.toLowerCase().indexOf(ql)!==-1||r.operador.toLowerCase().indexOf(ql)!==-1||r.costo.toLowerCase().indexOf(ql)!==-1||r.id.toLowerCase().indexOf(ql)!==-1||r.paradas_ida.some(function(p){return p.toLowerCase().indexOf(ql)!==-1;}); });
  if (!bldResults.length && !rutResults.length) { box.innerHTML = '<div class="sr-empty"><i class="fa-solid fa-face-frown" style="font-size:1.5rem;margin-bottom:.4rem;display:block"></i> Sin resultados para "<strong>'+q+'</strong>"<br><span style="font-size:.72rem;color:var(--gris-400)">Intenta con otro término</span></div>'; return; }
  var html = '';
  if (bldResults.length) { html += '<div class="search-section-title"><i class="fa-solid fa-building-columns"></i> Edificios ('+bldResults.length+')</div>'+bldResults.map(function(e) { return buildSRItem(e, ql); }).join(''); }
  if (rutResults.length) { html += '<div class="search-section-title"><i class="fa-solid fa-bus"></i> Rutas ('+rutResults.length+')</div>'+rutResults.map(function(r) { return buildSRRuta(r, ql); }).join(''); }
  box.innerHTML = html;
}

function buildSRRuta(r, q) {
  function hl(str) { return q ? str.replace(new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'), '<span class="sr-match">$1</span>') : str; }
  return '<div class="sr-item" onclick="if(!rutasOn)toggleRutas();toggleRutaInd(\''+r.id+'\');closeSearch();"><div class="sr-badge" style="background:'+r.color+'"><i class="fa-solid fa-bus"></i></div><div class="sr-info"><div class="sr-name">'+hl(r.nombre)+'</div><div class="sr-meta"><span class="sr-type">'+(r.tipo==='publica'?'<i class="fa-solid fa-bus-simple"></i> Público':'<i class="fa-solid fa-shield-halved"></i> Escolar')+'</span><span class="sr-status" style="background:var(--naranja-bg);color:var(--naranja-dark)">'+r.costo+'</span></div></div><span class="sr-arrow"><i class="fa-solid fa-chevron-right"></i></span></div>';
}

function buildSRItem(e, q) {
  var st = getBuildingStatus(e.horario), tipos = { docencia:'Docencia', taller:'Taller', servicio:'Servicio' };
  function hl(str) { return q ? str.replace(new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'), '<span class="sr-match">$1</span>') : str; }
  return '<div class="sr-item" onclick="quickSelect(\''+e.id+'\')"><div class="sr-badge" style="background:'+e.color+'">'+e.id+'</div><div class="sr-info"><div class="sr-name">'+hl(e.nombre)+'</div><div class="sr-meta"><span class="sr-type">'+(tipos[e.tipo]||e.tipo)+'</span><span class="sr-status '+(st.open?'open':'closed')+'">'+(st.open?'Abierto':'Cerrado')+'</span></div></div><span class="sr-arrow"><i class="fa-solid fa-chevron-right"></i></span></div>';
}
function quickSelect(id) { closeSearch(); selectEdificio(id); }

/* ════════════════════════════════════════════════════
   SHARE BUILDING
════════════════════════════════════════════════════ */
function shareBuilding() {
  if (!activeId) return; var url = location.origin + location.pathname + '?edificio=' + activeId;
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(url).then(function() { toast('Enlace copiado', 'success'); }); }
  else { var ta = document.createElement('textarea'); ta.value = url; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Enlace copiado', 'success'); } catch(e) { toast('URL: ' + url, 'info', 6000); } document.body.removeChild(ta); }
}

/* ════════════════════════════════════════════════════
   ONBOARDING – Guía para estudiantes
════════════════════════════════════════════════════ */
var OB_STEPS = [
  { title:'¡Bienvenido al Mapa Interactivo de la UTE! 🎓', desc:'Explora tu campus de forma visual. Haz clic en cualquier edificio del mapa o de la lista para ver: carreras, maestros, trámites, horarios y más.', target:null, arrow:null },
  { title:'🏛️ Lista de Edificios', desc:'Cada edificio muestra si está abierto o cerrado ahora mismo. Los colores te ayudan a identificar: naranja = docencia, azul = taller, verde = servicio.', targetEl:function(){ return document.querySelector('.e-item'); }, arrow:'tip-arrow-left', offset:{top:80,left:10} },
  { title:'🔍 Busca lo que necesitas', desc:'Escribe una carrera (ej: "Mecatrónica"), un maestro ("Carlos Muñoz") o un trámite ("Kardex") para encontrar rápido el edificio. También puedes usar Ctrl+K.', targetEl:function(){ return $('searchTrigger'); }, arrow:'tip-arrow-left', offset:{top:-10,left:10} },
  { title:'🗺️ Elige tu vista del mapa', desc:'Cambia entre mapa limpio, satélite de Google, híbrido (satélite + nombres) o modo oscuro. También puedes ver las rutas de camiones activando el toggle.', targetEl:function(){ return $('btnLayers'); }, arrow:'tip-arrow-top', offset:{top:10,left:-80} }
];
var obCurrent = 0;

function startOnboarding() { obCurrent = 0; $('onboardingOverlay').style.display = 'block'; renderOBStep(0); }
function renderOBStep(idx) {
  var step = OB_STEPS[idx]; $('obNum').textContent = 'Paso '+(idx+1)+' de '+OB_STEPS.length; $('obTitle').textContent = step.title; $('obDesc').textContent = step.desc;
  $('obDots').innerHTML = OB_STEPS.map(function(_,i) { return '<div class="ob-dot'+(i===idx?' active':'')+'"></div>'; }).join('');
  var nb = $('onboardingOverlay').querySelector('.ob-btn.next'); if (nb) nb.innerHTML = idx===OB_STEPS.length-1 ? '¡Listo! <i class="fa-solid fa-check"></i>' : 'Siguiente <i class="fa-solid fa-arrow-right"></i>';
  var tip = $('obStep'), spot = $('obSpot'); tip.className = 'onboarding-step'; tip.style.transform = '';
  if (step.targetEl) { var tgt = step.targetEl(); if (tgt) { var rect = tgt.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, TW = 268, TH = 190, G = 14, M = 12; spot.style.cssText = 'top:'+(rect.top-6)+'px;left:'+(rect.left-6)+'px;width:'+(rect.width+12)+'px;height:'+(rect.height+12)+'px;opacity:1'; var top = rect.bottom+G+TH+M<vh?rect.bottom+G:rect.top-G-TH; top = Math.max(M, Math.min(top, vh-TH-M)); var left = Math.max(M, Math.min(rect.left, vw-TW-M)); tip.style.top = top+'px'; tip.style.left = left+'px'; tip.style.width = TW+'px'; if (step.arrow) tip.classList.add(step.arrow); } }
  else { spot.style.opacity = '0'; tip.style.cssText = 'top:50%;left:50%;width:268px;transform:translate(-50%,-50%)'; }
}
function nextOnboardingStep() { if (obCurrent >= OB_STEPS.length-1) { endOnboarding(); return; } obCurrent++; renderOBStep(obCurrent); }
function endOnboarding() { $('onboardingOverlay').style.display = 'none'; localStorage.setItem('ute_onboarded', 'true'); }
