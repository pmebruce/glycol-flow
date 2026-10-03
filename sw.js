/* Reliable offline shell for GitHub Pages PWA. */
const BASE=new URL('./',self.location.href);
const PREFIX='glycol-flow-pages-'+encodeURIComponent(BASE.pathname)+'-';
const CACHE=PREFIX+'stable-start-20261003-v1';
const INDEX=new URL('index.html',BASE).href;
const FILES=["./","./index.html","./assets/index-CLiKq-oZ.js","./assets/index-DzCSPc_p.css","./favicon-v9.ico","./favicon.ico","./icons/apple-touch-icon-v9.png","./icons/apple-touch-icon.png","./icons/icon-192-v9.png","./icons/icon-192.png","./icons/icon-512-v9.png","./icons/icon-512.png","./manifest.webmanifest","./og.png"];
const URLS=FILES.map(path=>new URL(path,BASE).href);
const ASSETS=new Set(URLS.map(url=>{const parsed=new URL(url);return parsed.origin+parsed.pathname;}));

function safe(response,url){
  if(!response||!response.ok)return false;
  const type=response.headers.get('content-type')||'';
  const path=new URL(url).pathname;
  if(path===BASE.pathname||path===new URL('index.html',BASE).pathname)return type.includes('text/html');
  return !/\\.(js|css)$/.test(path)||!type.includes('text/html');
}
async function fetchAndStore(request,canonical){
  const response=await fetch(request);
  if(safe(response,canonical)){
    const cache=await caches.open(CACHE);
    await cache.put(canonical,response.clone());
    if(canonical===BASE.href)await cache.put(INDEX,response.clone());
  }
  return response;
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.allSettled(URLS.map(async url=>{
    const response=await fetch(new Request(url,{cache:'reload',credentials:'same-origin'}));
    if(safe(response,url))await cache.put(url,response);
  }));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await Promise.all((await caches.keys()).filter(name=>name.startsWith(PREFIX)&&name!==CACHE).map(name=>caches.delete(name)));
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='CACHE_STATUS')event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    const page=await cache.match(BASE.href)||await cache.match(INDEX);
    const core=await Promise.all(["./assets/index-CLiKq-oZ.js","./assets/index-DzCSPc_p.css"].map(path=>cache.match(new URL(path,BASE).href)));
    event.ports?.[0]?.postMessage({ready:Boolean(page)&&core.every(Boolean)});
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
  if(request.mode==='navigate'){
    const update=fetchAndStore(request,BASE.href);
    event.waitUntil(update.catch(()=>{}));
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const cached=await cache.match(BASE.href)||await cache.match(INDEX);
      if(cached)return cached;
      try{return await update;}catch{return new Response('目前無法開啟液冷壓降計算器，請連線後再試一次。',{status:503,headers:{'content-type':'text/plain;charset=utf-8'}});}
    })());
    return;
  }
  const key=url.origin+url.pathname;
  if(ASSETS.has(key)||url.pathname.startsWith(BASE.pathname+'assets/')){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const canonical=new URL(url.pathname,BASE.origin).href;
      const cached=await cache.match(canonical,{ignoreSearch:true});
      if(cached)return cached;
      try{return await fetchAndStore(request,canonical);}catch{return new Response('',{status:504});}
    })());
  }
});
