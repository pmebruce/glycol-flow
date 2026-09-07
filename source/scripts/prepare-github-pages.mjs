import {readFile,writeFile,mkdir,cp,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';

const out=resolve('dist-pages');
await mkdir(join(out,'icons'),{recursive:true});
for(const [from,to] of [
  ['favicon-dpcalc-v8.ico','favicon-v8.ico'],
  ['favicon-dpcalc-v8.ico','favicon.ico'],
  ['apple-touch-icon-dpcalc-v8.png','icons/apple-touch-icon-v8.png'],
  ['apple-touch-icon-dpcalc-v8.png','icons/apple-touch-icon.png'],
  ['icons/dpcalc-192-v8.png','icons/icon-192-v8.png'],
  ['icons/dpcalc-192-v8.png','icons/icon-192.png'],
  ['icons/dpcalc-512-v8.png','icons/icon-512-v8.png'],
  ['icons/dpcalc-512-v8.png','icons/icon-512.png'],
  ['og.png','og.png'],
])await cp(join('public',from),join(out,to));
const manifest={id:'./',name:'壓降計算器',short_name:'壓降計算器',description:'EG 50%／PG 25% 管路壓降、泵浦工作點與並聯流量分析',lang:'zh-Hant',start_url:'./',scope:'./',display:'standalone',background_color:'#071d52',theme_color:'#071d52',icons:[{src:'./icons/icon-192-v8.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'./icons/icon-512-v8.png',sizes:'512x512',type:'image/png',purpose:'any'}]};
await writeFile(join(out,'manifest.webmanifest'),JSON.stringify(manifest,null,2));
await writeFile(join(out,'.nojekyll'),'');
async function walk(dir,prefix=''){
  const files=[];
  for(const item of await readdir(dir,{withFileTypes:true})){
    const relative=prefix+item.name;
    if(item.isDirectory())files.push(...await walk(join(dir,item.name),relative+'/'));else files.push(relative);
  }
  return files;
}
const files=(await walk(out)).filter(name=>!['sw.js','pwa-assets.json','.nojekyll'].includes(name)).sort();
const hash=createHash('sha256');
const source=await readFile('github-pages/sw.js','utf8');hash.update(source);
for(const file of files)hash.update(file).update(await readFile(join(out,file)));
const urls=['./',...files.filter(name=>name!=='index.html').map(name=>'./'+name)];
await writeFile(join(out,'sw.js'),source.replace('__BUILD_ID__',hash.digest('hex').slice(0,16)).replace('self.__PRECACHE_URLS__',JSON.stringify(urls)));
await writeFile(join(out,'pwa-assets.json'),JSON.stringify({urls},null,2));
console.log(`GitHub Pages ready: ${urls.length} offline assets; relative URLs support any repository name.`);
