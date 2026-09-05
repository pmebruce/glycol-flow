'use client';
import { useEffect,useState } from 'react';
type InstallEvent = Event & { prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}> };
export function usePwa() {
  const [offline,setOffline]=useState(false),[ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  const [installed,setInstalled]=useState(false),[prompt,setPrompt]=useState<InstallEvent|null>(null);
  useEffect(()=>{
    let alive=true;
    const network=()=>setOffline(!navigator.onLine);
    const onInstall=(event:Event)=>{event.preventDefault();setPrompt(event as InstallEvent);};
    const installedEvent=()=>{setInstalled(true);setPrompt(null);};
    network();
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || !!(navigator as Navigator & {standalone?:boolean}).standalone);
    window.addEventListener('online',network);window.addEventListener('offline',network);
    window.addEventListener('beforeinstallprompt',onInstall);window.addEventListener('appinstalled',installedEvent);
    let timer:ReturnType<typeof setTimeout>|undefined;
    if('serviceWorker' in navigator&&window.isSecureContext) {
      timer=setTimeout(()=>{if(alive)setFailed(true);},25000);
      const manifest=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      const base=new URL('.',manifest?.href||window.location.href);
      navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.pathname,updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready).then(reg=>{
        if(!alive)return;
        const channel=new MessageChannel();
        channel.port1.onmessage=(event)=>{
          if(alive){setReady(!!event.data?.ready);setFailed(!event.data?.ready);}
          clearTimeout(timer);channel.port1.close();
        };
        reg.active?.postMessage({type:'CACHE_STATUS'},[channel.port2]);
      }).catch(()=>{if(alive)setFailed(true);clearTimeout(timer);});
    }else setFailed(true);
    return ()=>{alive=false;clearTimeout(timer);window.removeEventListener('online',network);window.removeEventListener('offline',network);window.removeEventListener('beforeinstallprompt',onInstall);window.removeEventListener('appinstalled',installedEvent);};
  },[]);
  async function install() {
    if(!prompt)return false;
    await prompt.prompt();const choice=await prompt.userChoice;
    if(choice.outcome==='accepted')setPrompt(null);
    return true;
  }
  return {offline,ready,failed,installed,canPrompt:!!prompt,install};
}
