/**
 * UTEMAPP v1.2 – PWA Campus UTE  |  Robusto · Compacto · Rápido
 */
'use strict';
// $() ya viene de data.js — no redeclarar
const esc=s=>s?String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]):'';
const DAY_MAP={Lun:1,Mar:2,'Mié':3,Mie:3,Jue:4,Vie:5,'Sáb':6,Sab:6,Dom:0};

// bar helper: muestra/oculta offline-bar o error-bar
function showBar(id,html,bg,duration){
  try{const b=$(id);if(!b)return;if(html)b.innerHTML=html;if(bg)b.style.background=bg;
  b.classList.add('show');clearTimeout(b._t);if(duration)b._t=setTimeout(()=>b.classList.remove('show'),duration)}
  catch(_){}
}
function hideBar(id){try{const b=$(id);if(b)b.classList.remove('show')}catch(_){}}

/* ── SPLASH ── */
setTimeout(()=>{try{document.querySelector('.splash').classList.add('hide')}catch(_){}},1200);

/* ── OFFLINE ── */
window.addEventListener('online',()=>hideBar('offlineBar'));
window.addEventListener('offline',()=>showBar('offlineBar','<i class="fa-solid fa-wifi-slash"></i> Sin conexión — datos locales','',''));
if(!navigator.onLine)showBar('offlineBar','<i class="fa-solid fa-wifi-slash"></i> Sin conexión — datos locales','','');

/* ── DATA ── */
let edificios=[],rutas=[];
function loadData(){
  try{
    if(typeof DB!=='undefined'&&DB.getEdificios){edificios=DB.getEdificios();rutas=DB.getRutas()}
    else if(typeof EDIFICIOS_DATA!=='undefined'){edificios=EDIFICIOS_DATA;if(typeof RUTAS_DATA!=='undefined')rutas=RUTAS_DATA}
  }catch(e){console.error(e);
    if(typeof EDIFICIOS_DATA!=='undefined')edificios=EDIFICIOS_DATA;
    if(typeof RUTAS_DATA!=='undefined')rutas=RUTAS_DATA}
  if(!Array.isArray(edificios)||!edificios.length){showBar('errorBar','<i class="fa-solid fa-triangle-exclamation"></i> Error al cargar datos. Recarga.','#C62828',4000);edificios=[]}
  if(!Array.isArray(rutas))rutas=[]
}
loadData();
// Procesar shortcut ?tab=edificios|rutas|info desde manifest
(function(){try{const t=new URLSearchParams(location.search).get("tab");if(t&&/^(edificios|rutas|info)$/.test(t))setTimeout(function(){switchTab(t)},1200)}catch(_){}})();

/* ── MAP ── */
let map=null,mapReady=false;
function initMap(){
  if(typeof L==='undefined'){const me=$('mapError');if(me)me.style.display='flex';return}
  try{
    const c=(typeof CAMPUS_CENTER!=='undefined')?[CAMPUS_CENTER.lat,CAMPUS_CENTER.lng]:[25.83010,-100.27663];
    map=L.map('map',{center:c,zoom:17,zoomControl:false,attributionControl:false,maxZoom:21,minZoom:14,tap:true,touchZoom:true,dragging:true,scrollWheelZoom:true});
    L.control.zoom({position:'bottomright'}).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{attribution:'&copy; OSM &copy; CARTO',maxZoom:20,errorTileUrl:''}).addTo(map);
    map.whenReady(()=>{mapReady=true;setTimeout(()=>map.invalidateSize(),200)})
  }catch(e){console.error(e);const me=$('mapError');if(me)me.style.display='flex'}
}
initMap();

/* ── STATUS ── */
function getStatus(h){
  if(!h)return{open:false,closesAt:null};
  try{
    const n=new Date(),dow=n.getDay(),hh=n.getHours()*60+n.getMinutes();
    const t2m=t=>{const p=t.split(':').map(Number);return p.length>1?p[0]*60+p[1]:0};
    const segs=h.split('|').map(s=>s.trim());
    for(let i=0;i<segs.length;i++){
      const dm=segs[i].match(/([A-Za-zÁÉÍÓÚáéíóúÑñ]+)[–-]([A-Za-zÁÉÍÓÚáéíóúÑñ]+)/u);
      const tm=segs[i].match(/(\d{1,2}:\d{2})[–-](\d{1,2}:\d{2})/);
      if(!tm)continue;
      const sm=t2m(tm[1]),em=t2m(tm[2]);let dayOk=true;
      if(dm){const d1=DAY_MAP[dm[1]],d2=DAY_MAP[dm[2]];if(d1!==undefined&&d2!==undefined)dayOk=d1<=d2?(dow>=d1&&dow<=d2):(dow>=d1||dow<=d2)}
      if(dayOk&&hh>=sm&&hh<em)return{open:true,closesAt:tm[2]}
    }
  }catch(e){}
  return{open:false,closesAt:null}
}

/* ── MARKERS ── */
const mkMap={};
function renderMarkers(){
  if(!map||!edificios.length)return;
  try{
    Object.keys(mkMap).forEach(id=>{if(map.hasLayer(mkMap[id]))map.removeLayer(mkMap[id])});
    edificios.forEach(e=>{
      if(!e||!e.id)return;
      // Saltar edificios con coordenadas inválidas (previene crash NaN)
      if(!isFinite(e.lat)||!isFinite(e.lng))return;
      const ic=L.divIcon({className:'',html:'<div class="ute-mk2" style="background:'+(e.color||'#F4821F')+'">'+e.id+'</div>',iconSize:[34,34],iconAnchor:[17,17]});
      const m=L.marker([e.lat,e.lng],{icon:ic,autoPan:true}).addTo(map)
        .on('click',(ev)=>{try{L.DomEvent.stopPropagation(ev);openCard(e);map.flyTo([e.lat,e.lng],18,{duration:.5})}catch(ex){console.warn(ex)}});
      mkMap[e.id]=m
    })
  }catch(e){console.error(e);showBar('errorBar','Error al mostrar edificios.','#C62828',3000)}
}
setTimeout(()=>{if(map)map.whenReady(()=>renderMarkers())},800);

/* ── ROUTES ── */
const rutaLayers={};
function buildRutaLayers(){
  if(!map)return;
  try{
    // Limpiar capas viejas para evitar ghost lines en sync cross-tab
    Object.keys(rutaLayers).forEach(function(k){if(rutaLayers[k]&&map.hasLayer(rutaLayers[k]))map.removeLayer(rutaLayers[k])});
    rutas.forEach(r=>{
      if(!r||!r.id)return;const lg=L.layerGroup();
      if(r.coords_ida&&r.coords_ida.length)L.polyline(r.coords_ida,{color:r.color||'#2E7D32',weight:4,dashArray:'10 6',opacity:.9}).addTo(lg);
      if(r.coords_vuelta&&r.coords_vuelta.length)L.polyline(r.coords_vuelta,{color:r.color||'#2E7D32',weight:2.5,dashArray:'5 8',opacity:.5}).addTo(lg);
      rutaLayers[r.id]=lg
    })
  }catch(e){console.error(e)}
}
if(map)map.whenReady(()=>buildRutaLayers());else setTimeout(()=>{if(map)buildRutaLayers()},2000);

/* ── LOCATION ── */
let userMarker=null;
function goMyLocation(){
  if(!navigator.geolocation){alert('Geolocalización no disponible.');return}
  const btn=$('btnLoc');if(btn)btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>';
  navigator.geolocation.getCurrentPosition(pos=>{
    try{
      if(btn)btn.innerHTML='<i class="fa-solid fa-location-crosshairs"></i>';if(!map)return;
      map.flyTo([pos.coords.latitude,pos.coords.longitude],17,{duration:1});
      if(userMarker)map.removeLayer(userMarker);
      const ic=L.divIcon({className:'',html:'<div style="width:20px;height:20px;border-radius:50%;background:#1565C0;border:3px solid #fff;box-shadow:0 0 0 6px rgba(21,101,192,.25)"></div>',iconSize:[20,20],iconAnchor:[10,10]});
      userMarker=L.marker([pos.coords.latitude,pos.coords.longitude],{icon:ic}).addTo(map).bindPopup('<strong>📍 Estás aquí</strong>',{closeButton:false}).openPopup()
    }catch(e){showBar('errorBar','Error al mostrar ubicación.','#C62828',3000)}
  },err=>{
    if(btn)btn.innerHTML='<i class="fa-solid fa-location-crosshairs"></i>';
    const msgs={1:'Permiso denegado. Actívalo en Ajustes.',2:'Ubicación no disponible. Verifica GPS.',3:'Timeout. Intenta de nuevo.'};
    alert(msgs[err.code]||'No se pudo obtener tu ubicación.')
  },{enableHighAccuracy:true,timeout:10000,maximumAge:60000})
}
function goCampus(){
  try{closeCard();if(!map)return;const c=(typeof CAMPUS_CENTER!=='undefined')?[CAMPUS_CENTER.lat,CAMPUS_CENTER.lng]:[25.83010,-100.27663];map.flyTo(c,17,{duration:1})}catch(_){}
}

/* ── CARD ── */
function infrHTML(s){s=s||{};const n=['total','labs','aulas','salas'];return'<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:.4rem;text-align:center">'+n.map(k=>'<div style="background:var(--gris-50);border-radius:8px;padding:.5rem"><div style="font-size:1.1rem;font-weight:800;color:var(--naranja)">'+(s[k]||0)+'</div><div style="font-size:.55rem;color:var(--gris-400)">'+k.charAt(0).toUpperCase()+k.slice(1)+'</div></div>').join('')+'</div>'}

function tagList(items,empty){return(items||[]).length?items.map(x=>'<span class="cc-tag">'+esc(x)+'</span>').join(' '):'<span style="color:var(--gris-400);font-size:.7rem">'+empty+'</span>'}

function openCard(e){
  if(!e)return;
  try{
    const st=getStatus(e.horario),sal=e.salones||{total:0,labs:0,aulas:0,salas:0};
    const color=e.color||'#F4821F',tipo=e.tipo||'docencia';
    const ht=e.horario?e.horario.split('|')[0].trim():'Sin horario';
    const card=$('cardContent');if(!card)return;
    card.innerHTML=
      '<div class="cc-head"><div class="cc-mk" style="background:'+color+'">'+esc(e.id)+'</div><div><div class="cc-title">'+esc(e.nombre)+'</div><div class="cc-type">'+esc(tipo)+' · '+esc(ht)+'</div><div class="cc-status status-badge '+(st.open?'open':'closed')+'"><i class="fa-solid fa-circle" style="font-size:.3rem"></i> '+(st.open?'Abierto ahora':'Cerrado ahora')+'</div></div></div>'+
      '<div class="cc-section"><div class="cc-label"><i class="fa-solid fa-graduation-cap"></i> Carreras / Áreas</div><div>'+tagList(e.carreras,'Sin carreras registradas')+'</div></div>'+
      '<div class="cc-section"><div class="cc-label"><i class="fa-solid fa-users"></i> Grupos activos</div><div>'+tagList(e.grupos,'Sin grupos')+'</div></div>'+
      '<div class="cc-section"><div class="cc-label"><i class="fa-solid fa-chalkboard-user"></i> Maestros</div><div class="cc-list">'+((e.maestros||[]).length?e.maestros.map(m=>'<div style="font-size:.74rem;padding:3px 0"><i class="fa-solid fa-user" style="color:var(--gris-400);margin-right:4px;font-size:.6rem"></i> '+esc(m.nombre)+'</div>').join(''):'<div style="color:var(--gris-400);font-size:.7rem">Sin maestros registrados</div>')+'</div></div>'+
      '<div class="cc-section"><div class="cc-label"><i class="fa-solid fa-file-lines"></i> Trámites</div><div class="cc-list">'+((e.tramites||[]).length?e.tramites.map(t=>'<div style="font-size:.74rem;padding:2px 0">• '+esc(t)+'</div>').join(''):'<div style="color:var(--gris-400);font-size:.7rem">Sin trámites</div>')+'</div></div>'+
      '<div class="cc-section"><div class="cc-label"><i class="fa-solid fa-building"></i> Infraestructura</div>'+infrHTML(sal)+'</div>';
    const bc=$('buildingCard');if(bc)bc.classList.add('open')
  }catch(ex){console.error(ex);showBar('errorBar','Error al mostrar edificio.','#C62828',3000)}
}
function closeCard(){try{const c=$('buildingCard');if(c)c.classList.remove('open')}catch(_){}}

/* ── SEARCH ── */
let searchTimer=null;
const si=$('topSearch');
if(si)si.addEventListener('input',function(){
  const inp=this;clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>{
    try{
      const q=inp.value.trim().toLowerCase(),drop=$('searchDrop');if(!drop)return;
      if(!q){drop.classList.remove('open');drop.innerHTML='';return}
      const res=edificios.filter(e=>e&&((e.nombre||'').toLowerCase().includes(q)||(e.id||'').toLowerCase().includes(q)||(e.carreras||[]).some(c=>(c||'').toLowerCase().includes(q))));
      drop.innerHTML=res.length?res.map(e=>'<div class="sr-item2" role="option" onclick="searchSelect(\''+e.id+'\')"><div class="sr-badge2" style="background:'+(e.color||'#F4821F')+'">'+e.id+'</div><div><div class="sr-name2">'+(e.nombre||'')+'</div><div class="sr-sub2">'+(e.carreras||[]).slice(0,2).join(' · ')+'</div></div></div>').join(''):'<div style="padding:1.5rem;text-align:center;color:var(--gris-400);font-size:.8rem">Sin resultados</div>';
      drop.classList.add('open')
    }catch(ex){}
  },250)
});
function searchSelect(id){
  try{
    const drop=$('searchDrop');if(drop){drop.classList.remove('open');drop.innerHTML=''}
    const inp=$('topSearch');if(inp)inp.value='';
    const f=edificios.find(x=>x&&x.id===id);if(f&&map){map.flyTo([f.lat,f.lng],18,{duration:.5});openCard(f)}
  }catch(_){}
}

/* ── TABS ── */
const PANELS={edificios:'panelEdificios',rutas:'panelRutas',info:'panelInfo'};
function switchTab(tab){
  try{
    document.querySelectorAll('.botnav-item').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    Object.keys(PANELS).forEach(k=>{const p=$(PANELS[k]);if(p)p.classList.toggle('open',tab===k)});
    closeCard();
    const vf=tab==='mapa';const bl=$('btnLoc'),bc=$('btnCampus');
    if(bl)bl.style.display=vf?'':'none';if(bc)bc.style.display=vf?'':'none';
    if(tab==='edificios')renderEdificiosList();
    if(tab==='rutas')renderRutasList();
    if(tab==='mapa'&&map)setTimeout(()=>map.invalidateSize(),350)
  }catch(e){console.warn(e)}
}

/* ── LISTS ── */
function renderEdificiosList(){
  try{
    const l=$('listEdificios');if(!l)return;
    if(!edificios.length){l.innerHTML='<div style="padding:2rem;text-align:center;color:var(--gris-400)">No se pudieron cargar los edificios.</div>';return}
    l.innerHTML=edificios.map(e=>{
      if(!e)return'';const st=getStatus(e.horario),c=e.color||'#F4821F';
      return'<div class="p-item" onclick="selectBuilding(\''+e.id+'\')"><div class="p-mk" style="background:'+c+'">'+e.id+'</div><div style="flex:1"><div class="p-name">'+(e.nombre||'')+'</div><div class="p-sub">'+(e.carreras||[]).slice(0,2).join(' · ')+'</div><div class="p-status '+(st.open?'sts-open':'sts-closed')+'">'+(st.open?'Abierto':'Cerrado')+'</div></div><i class="fa-solid fa-chevron-right" style="color:var(--gris-300);font-size:.7rem;align-self:center"></i></div>'
    }).join('')
  }catch(e){console.error(e)}
}
function selectBuilding(id){
  try{const f=edificios.find(x=>x&&x.id===id);if(f&&map){map.flyTo([f.lat,f.lng],18,{duration:.5});openCard(f)}switchTab('mapa')}catch(_){}
}
function renderRutasList(){
  try{
    const l=$('listRutas');if(!l)return;
    if(!rutas.length){l.innerHTML='<div style="padding:2rem;text-align:center;color:var(--gris-400)">No se pudieron cargar las rutas.</div>';return}
    l.innerHTML=rutas.map(r=>{
      if(!r)return'';const h=r.horarios||{},en=(h.entrada||[]).join(' y ')||'—',sa=(h.salida||[]).join(' y ')||'—';
      const pub=r.tipo==='publica';
      return'<div class="p-ruta" onclick="toggleRuta(\''+r.id+'\')"><div class="p-ruta-dot" style="background:'+(r.color||'#2E7D32')+'"></div><div style="flex:1"><div class="p-ruta-name">'+(r.nombre||'')+'</div><div style="font-size:.64rem;color:var(--gris-400)">🟢 '+en+' → 🔵 '+sa+'</div><div style="font-size:.62rem;color:var(--gris-400)">💰 '+(r.costo||'—')+'</div></div><span class="p-ruta-badge '+(pub?'pub':'esc')+'">'+(pub?'Público':'Escolar')+'</span></div>'
    }).join('')
  }catch(e){console.error(e)}
}
function toggleRuta(id){
  try{if(!map||!rutaLayers[id]){switchTab('mapa');return}map.hasLayer(rutaLayers[id])?map.removeLayer(rutaLayers[id]):map.addLayer(rutaLayers[id]);switchTab('mapa')}catch(_){}
}

/* ── EVENTS ── */
document.addEventListener('click',e=>{
  try{const w=$('topSearchWrap'),d=$('searchDrop');if(w&&d&&!w.contains(e.target))d.classList.remove('open')}catch(_){}
});
if(map)map.on('click',()=>closeCard());

// Sync entre pestañas
window.addEventListener('storage',ev=>{
  try{
    if(ev.key==='ute_edificios'||ev.key==='ute_rutas'){
      if(typeof DB!=='undefined'&&DB.getEdificios){edificios=DB.getEdificios();rutas=DB.getRutas()}
      renderMarkers();buildRutaLayers();renderEdificiosList();renderRutasList();
      showBar('offlineBar','<i class="fa-solid fa-check-circle"></i> Datos actualizados','#2E7D32',2500)
    }
  }catch(e){console.warn(e)}
});

// Resize
let rd=null;
['orientationchange','resize'].forEach(ev=>window.addEventListener(ev,()=>{
  clearTimeout(rd);rd=setTimeout(()=>{if(map)try{map.invalidateSize()}catch(_){}},250)
}));

// Keyboard
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeCard();const d=$('searchDrop');if(d)d.classList.remove('open')}
});

/* ── INIT ── */
renderEdificiosList();renderRutasList();
