(() => {
  const video=document.querySelector('.project-screen video[data-stream]');
  const button=document.querySelector('.dunhuang-play');
  const error=document.querySelector('.film-error');
  if(!video || !button)return;
  const label=button.querySelector('.dunhuang-play-text');
  const quality=document.createElement('label');
  quality.className='film-quality';
  quality.innerHTML='<span>清晰度</span><select aria-label="视频清晰度"><option value="hd">高清</option><option value="smooth">流畅</option></select>';
  document.querySelector('.project-screen-caption').append(quality);
  const picker=quality.querySelector('select');
  const applePlayer=/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1) ||
    (/Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Android/.test(navigator.userAgent));
  const nativeHls=Boolean(video.canPlayType('application/vnd.apple.mpegurl')) &&
    (applePlayer || !window.Hls || !Hls.isSupported());
  let hls=null,prepared=false,requested=false,starting=false,recoveries=0,revision=0;
  let pendingRestore=null;
  function failed(){
    if(error)error.hidden=false;
    button.hidden=false;
    label.textContent='重新播放';
  }
  function prepare(){
    if(prepared)return;
    prepared=true;
    // Each option points to one rendition; bandwidth never silently lowers quality.
    const stream=picker.value==='smooth' ? video.dataset.smoothStream : video.dataset.stream;
    video.dataset.quality=picker.value;
    video.dataset.player=nativeHls ? 'native' : 'hlsjs';
    if(nativeHls){
      video.preload='metadata';
      video.src=stream;
    }else if(window.Hls && Hls.isSupported()){
      hls=new Hls({autoStartLoad:false,capLevelToPlayerSize:false,
        maxBufferLength:30,maxMaxBufferLength:60,maxBufferSize:32000000,
        backBufferLength:8,enableWorker:true,progressive:true});
      hls.on(Hls.Events.ERROR,(_event,data)=>{
        if(!data.fatal)return;
        if(requested && recoveries++<2){
          if(data.type===Hls.ErrorTypes.MEDIA_ERROR){hls.recoverMediaError();return;}
          if(data.type===Hls.ErrorTypes.NETWORK_ERROR){hls.startLoad();return;}
        }
        failed();
      });
      hls.loadSource(stream);
      hls.attachMedia(video);
    }else{failed();}
  }
  function startLoading(force=false){
    prepare();
    if(requested && !force)return;
    requested=true;
    if(hls)hls.startLoad();
  }
  function waitForStartBuffer(token) {
    // Allow the fixed HD rendition to get ahead of mobile network jitter.
    // Native Apple playback remains inside its user gesture for sound permission.
    if (!hls || video.currentTime > .1) return Promise.resolve();
    const target = matchMedia('(max-width:700px)').matches ? 4 : 2;
    const deadline = performance.now() + 12000;
    return new Promise(resolve => {
      const check = () => {
        const ahead = video.buffered.length ? video.buffered.end(0)-video.currentTime : 0;
        if (revision !== token || video.error || ahead >= target || performance.now() >= deadline) {
          resolve(); return;
        }
        setTimeout(check, 100);
      };
      check();
    });
  }
  async function play(){
    if(starting)return;
    const token=revision;
    starting=true;
    recoveries=0;
    if(error)error.hidden=true;
    startLoading(true);
    label.textContent='正在缓冲…';
    try{
      await waitForStartBuffer(token);
      if(token!==revision)return;
      await video.play();
      if(token===revision){button.hidden=true;video.focus({preventScroll:true});}
    }catch{
      if(token===revision){button.hidden=false;label.textContent='重新播放';}
    }finally{if(token===revision)starting=false;}
  }
  picker.addEventListener('change',()=>{
    const position=pendingRestore?.position ?? video.currentTime;
    const resume=pendingRestore?.resume ?? (!video.paused || starting);
    const hadRequested=requested;
    revision++;
    starting=false;
    pendingRestore={position,resume};
    video.pause();
    if(hls){hls.destroy();hls=null;}
    video.removeAttribute('src');
    video.load();
    prepared=false;
    requested=false;
    recoveries=0;
    if(error)error.hidden=true;
    prepare();
    button.hidden=false;
    label.textContent=resume ? '正在切换…' : '播放正片';
    if(hadRequested || resume || position>0){
      startLoading();
      if(nativeHls)video.load();
    }
  });
  video.addEventListener('loadedmetadata',()=>{
    if(!pendingRestore)return;
    const state=pendingRestore;
    pendingRestore=null;
    if(state.position>0)video.currentTime=Math.min(state.position,Math.max(0,video.duration-.1));
    if(state.resume)void play();
  });
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){prepare();observer.disconnect();}
    },{rootMargin:'300px'});
    observer.observe(video);
  }
  button.hidden=false;
  button.addEventListener('click',()=>void play());
  video.addEventListener('play',()=>{startLoading();button.hidden=true;if(error)error.hidden=true;});
  video.addEventListener('ended',()=>{label.textContent='再看一遍';button.hidden=false;});
  video.addEventListener('error',failed);
  window.addEventListener('pagehide',()=>{video.pause();if(hls)hls.stopLoad();});
  window.addEventListener('pageshow',event=>{if(event.persisted && requested && hls)hls.startLoad();});
})();
