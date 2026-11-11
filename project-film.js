(() => {
  const video=document.querySelector('.project-screen video[data-stream]');
  const button=document.querySelector('.dunhuang-play');
  const error=document.querySelector('.film-error');
  if(!video || !button)return;
  const stream=video.dataset.stream;
  let hls=null,starting=false,prepared=false,requested=false,recoveries=0;
  const label=button.querySelector('.dunhuang-play-text');
  const failed=()=>{
    if(error)error.hidden=false;
    button.hidden=false;
    label.textContent='重新播放';
  };
  function prepare(){
    if(prepared)return;
    prepared=true;
    // Read manifests near the player, but leave video segments until playback.
    if(video.canPlayType('application/vnd.apple.mpegurl')){
      video.src=stream;
    }else if(window.Hls && Hls.isSupported()){
      hls=new Hls({autoStartLoad:false,startLevel:0,capLevelToPlayerSize:true,
        maxBufferLength:12,maxMaxBufferLength:24,backBufferLength:12,enableWorker:true});
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
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){prepare();observer.disconnect();}
    },{rootMargin:'300px'});
    observer.observe(video);
  }
  button.hidden=false;
  button.addEventListener('click',async()=>{
    if(starting)return;
    starting=true;
    recoveries=0;
    if(error)error.hidden=true;
    startLoading(true);
    label.textContent='正在缓冲…';
    try{await video.play();button.hidden=true;video.focus({preventScroll:true});}
    catch{button.hidden=false;button.querySelector('.dunhuang-play-text').textContent='重新播放';}
    finally{starting=false;}
  });
  video.addEventListener('play',()=>{startLoading();button.hidden=true;if(error)error.hidden=true;});
  video.addEventListener('ended',()=>{button.querySelector('.dunhuang-play-text').textContent='再看一遍';button.hidden=false;});
  video.addEventListener('error',failed);
  window.addEventListener('pagehide',()=>{video.pause();if(hls)hls.stopLoad();});
  window.addEventListener('pageshow',event=>{if(event.persisted && requested && hls)hls.startLoad();});
})();
