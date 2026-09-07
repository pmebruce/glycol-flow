/* Replaced by prepare-github-pages.mjs after the static build. */
const BASE=new URL('./',self.location.href);
const PREFIX='glycol-flow-pages-'+encodeURIComponent(BASE.pathname)+'-';
const CACHE=PREFIX+'d71ed1768a926e8f';
const FILES=["./","./assets/index-CLiKq-oZ.js","./assets/index-DzCSPc_p.css","./favicon-v8.ico","./favicon.ico","./icons/apple-touch-icon-v8.png","./icons/apple-touch-icon.png","./icons/icon-192-v8.png","./icons/icon-192.png","./icons/icon-512-v8.png","./icons/icon-512.png","./manifest.webmanifest","./og.png"];
const URLS=FILES.map(path=>new URL(path,BASE).href);
const ASSETS=new Set(URLS);

function safe(response,url){
  if(!response.ok||response.redirected)return false;
  const type=response.headers.get('content-type')||'';
  if(url===BASE.href||url===new URL('index.html',BASE).href)return type.includes('text/html');
  return !/\.(js|css)$/.test(new URL(url).pathname)||!type.includes('text/html');
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try{
    await Promise.all(URLS.map(async url=>{
      const response=await fetch(new Request(url,{cache:'reload',credentials:'same-origin'}));
      if(!safe(response,url))throw new Error('Incomplete offline installation');
      await cache.put(url,response);
    }));
  }catch(error){await caches.delete(CACHE);throw error;}
  if(!self.registration.active)await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await Promise.all((await caches.keys()).filter(name=>name.startsWith(PREFIX)&&name!==CACHE).map(name=>caches.delete(name)));
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='CACHE_STATUS')event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    const found=await Promise.all(URLS.map(url=>cache.match(url)));
    event.ports?.[0]?.postMessage({ready:found.every(Boolean)});
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
  if(url.pathname===BASE.pathname||url.pathname===BASE.pathname+'index.html'){
    if(request.mode!=='navigate')return;
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE),controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),4500);
      try{
        const response=await fetch(request,{signal:controller.signal});
        if(safe(response,BASE.href))await cache.put(BASE.href,response.clone());
        return response;
      }catch{
        return await cache.match(BASE.href)||new Response('請先連線開啟一次壓降計算器。',{status:503,headers:{'content-type':'text/plain;charset=utf-8'}});
      }finally{clearTimeout(timer);}
    })());
  }else if(ASSETS.has(url.origin+url.pathname)||url.pathname.startsWith(BASE.pathname+'assets/')){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE),key=url.origin+url.pathname,cached=await cache.match(key);
      if(cached)return cached;
      const response=await fetch(request);
      if(safe(response,key))await cache.put(key,response.clone());
      return response;
    })());
  }
});
