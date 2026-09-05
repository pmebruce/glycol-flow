import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import vm from 'node:vm';

const worker=await readFile(new URL('../dist-pages/sw.js',import.meta.url),'utf8');
function harness(path){
  const base=new URL(path,'https://example.test'),events={},stores=new Map();
  let online=true,failAssets=false;
  const key=input=>new URL(typeof input==='string'?input:input.url,base).href;
  const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const cache=stores.get(name);return {async put(input,response){cache.set(key(input),response.clone());},async match(input){return cache.get(key(input))?.clone();}};},async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);}};
  const fetch=async(input)=>{
    if(!online)throw Error('offline');
    const url=new URL(key(input));
    assert.ok(url.pathname.startsWith(base.pathname),'request escaped repository path');
    if(failAssets&&url.pathname.includes('/assets/'))return new Response('Missing asset',{status:404});
    return new Response(url.href===base.href?'calculator app':'asset content',{headers:{'content-type':url.href===base.href?'text/html':url.pathname.endsWith('.js')?'text/javascript':'application/octet-stream'}});
  };
  const self={location:new URL('sw.js',base),registration:{active:null},skipWaiting:async()=>{},clients:{claim:async()=>{}},addEventListener:(name,callback)=>{events[name]=callback;}};
  vm.runInNewContext(worker,{self,caches,fetch,Request,Response,URL,Headers,AbortController,setTimeout,clearTimeout,Set,Promise,encodeURIComponent});
  return {stores,offline(){online=false;},breakAssets(){failAssets=true;},
    async event(name,extra={}){let pending=Promise.resolve();events[name]({...extra,waitUntil:promise=>{pending=promise;}});await pending;},
    async request(relative='',mode='navigate'){let response;events.fetch({request:{url:new URL(relative,base).href,method:'GET',mode},respondWith:promise=>{response=promise;}});return response?await response:undefined;},
    async status(){let answer;await this.event('message',{data:{type:'CACHE_STATUS'},ports:[{postMessage:data=>{answer=data;}}]});return answer;}
  };
}
for(const path of ['/','/glycol-flow/','/another-project/']){
  test('offline installation works at '+path,async()=>{
    const h=harness(path);await h.event('install');await h.event('activate');assert.equal((await h.status()).ready,true);
    h.offline();assert.match(await (await h.request()).text(),/calculator app/);
    assert.match(await (await h.request('index.html')).text(),/calculator app/);
    assert.equal((await h.request('icons/apple-touch-icon.png','cors')).status,200);
    assert.equal(await h.request('unrelated-api','cors'),undefined);
    if(path!=='/')assert.equal(await h.request('/different-project/'),undefined);
  });
}
test('failed offline asset download is not reported as ready',async()=>{
  const h=harness('/glycol-flow/');h.breakAssets();await assert.rejects(h.event('install'));assert.equal((await h.status()).ready,false);
});
test('activation preserves caches belonging to other apps',async()=>{
  const h=harness('/glycol-flow/');h.stores.set('glycol-flow-pages-%2Fother%2F-old',new Map());h.stores.set('another-calculator-v1',new Map());
  await h.event('install');await h.event('activate');assert.ok(h.stores.has('glycol-flow-pages-%2Fother%2F-old'));assert.ok(h.stores.has('another-calculator-v1'));
});
test('static entry point and manifest reference existing relative assets',async()=>{
  const root=new URL('../dist-pages/',import.meta.url),html=await readFile(new URL('index.html',root),'utf8');
  for(const match of html.matchAll(/(?:src|href)="(\.\/[^\"]+)"/g))assert.ok((await stat(new URL(match[1],root))).size>0);
  const manifest=JSON.parse(await readFile(new URL('manifest.webmanifest',root),'utf8'));
  assert.equal(manifest.id,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');assert.equal(manifest.short_name,'壓降計算器');
  for(const icon of manifest.icons)assert.ok((await stat(new URL(icon.src,root))).size>0);
  assert.doesNotMatch(html,/chatgpt\.site|wikimedia|next\/headers/);assert.doesNotMatch(worker,/__BUILD_ID__|__PRECACHE_URLS__/);
});
