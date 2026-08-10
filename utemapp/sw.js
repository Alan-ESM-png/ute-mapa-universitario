/**
 * UTEMAPP SW v1.2 – Cache First · Stale-while-revalidate · Offline
 */
'use strict';
const C='utemapp-v1.3';
const A=['./','./index.html','./style.css','./app.js','./manifest.json','./icon-192.png','./icon-512.png','../js/edificios.js','../js/data.js','../js/api.js','../js/auth.js','../css/shared.css','https://unpkg.com/leaflet@1.9.4/dist/leaflet.css','https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(C).then(cache=>{
    // Cachear uno por uno — si un CDN falla, los demás sobreviven
    return Promise.allSettled(A.map(url=>cache.add(url).catch(()=>{})));
  }).then(()=>self.skipWaiting()))
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))
});

self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET')return;
  if(u.pathname.includes('/api/')){e.respondWith(fetch(r).catch(()=>new Response('{"error":"Sin conexión"}',{status:503,headers:{'Content-Type':'application/json'}})));return}
  if(u.protocol!=='http:'&&u.protocol!=='https:')return;

  e.respondWith(caches.match(r).then(cached=>{
    if(cached){fetch(r).then(res=>{if(res&&res.status===200)caches.open(C).then(c=>c.put(r,res.clone()))}).catch(()=>{});return cached}
    return fetch(r).then(res=>{if(res&&res.status===200){const cl=res.clone();caches.open(C).then(c=>c.put(r,cl))}return res}).catch(()=>{
      if(/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(u.pathname))return new Response('',{status:200,headers:{'Content-Type':'image/png'}});
      if((r.headers.get('Accept')||'').includes('text/html'))return caches.match('./index.html');
      return new Response('',{status:408})
    })
  }))
});
