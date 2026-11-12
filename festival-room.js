(() => {
  const room = document.querySelector('.film-festival');
  if (!room) return;
  const projects = JSON.parse(room.querySelector('#festival-data').textContent);
  const feature = room.querySelector('#festival-feature');
  const program = room.querySelector('#festival-program');
  const filters = room.querySelector('.festival-filters');
  const announcer = room.querySelector('.festival-announcer');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motion = {image:680, text:440, ease:'cubic-bezier(.16,1,.3,1)'};
  // Motion reference: Transitions.dev's Tabs sliding and Text states swap.
  // The moving indicators and content swap are implemented for this vanilla site.
  const themes = {
    'ter-traditum':  {paper:'#842b39', ink:'#fff2eb', muted:'#e6bfc0', accent:'#f2b9a6', tint:'#9b4050', line:'#b05d69'},
    'golden-wish':   {paper:'#e1d2f0', ink:'#412853', muted:'#755b8c', accent:'#80509e', tint:'#cdb4e3', line:'#b496ce'},
    'reverse-scent': {paper:'#dfe8e9', ink:'#2f4143', muted:'#70888b', accent:'#527b80', tint:'#c5d8da', line:'#a7bec0'},
    'dunhuang':      {paper:'#f4e9d6', ink:'#403323', muted:'#958064', accent:'#b27a3e', tint:'#e9d7b8', line:'#d5be9b'},
    'veo':           {paper:'#141619', ink:'#f2f1ed', muted:'#a9aeb3', accent:'#b9c4cb', tint:'#292d32', line:'#494e55'},
    'dragon-guardian':{paper:'#102f25', ink:'#f2f4de', muted:'#bdcfb5', accent:'#d6be84', tint:'#22493a', line:'#51745e'},
    'fluffy-knight': {paper:'#102e50', ink:'#edf6ff', muted:'#b4cce2', accent:'#7fd5f0', tint:'#20486b', line:'#4b7295'},
    'xiaocha':       {paper:'#850911', ink:'#fff1dc', muted:'#ecc2b0', accent:'#edbc78', tint:'#a00c13', line:'#c34736'},
    'sakura':        {paper:'#f6d3e2', ink:'#542d41', muted:'#8d526e', accent:'#ad477a', tint:'#edb7ce', line:'#d491b0'}
  };
  const defaultProject = projects.find(item => item.id === 'xiaocha') || projects[0];
  const selectionKey = 'festival-selected-project';
  let initialProject = defaultProject;
  // Restore a project-page return, while an explicit reload starts at the default.
  try {
    const navigation = performance.getEntriesByType('navigation')[0];
    const referrer = document.referrer ? new URL(document.referrer) : null;
    const returningFromProject = referrer?.origin === location.origin &&
      /\/projects\/[^/]+\.html$/.test(referrer.pathname);
    if (navigation?.type !== 'reload' && (returningFromProject || navigation?.type === 'back_forward')) {
      initialProject = projects.find(item => item.id === sessionStorage.getItem(selectionKey)) || defaultProject;
    }
  } catch {}
  let selected = initialProject.id;
  let filtered = projects;
  let requestId = 0;
  let running = [];
  const imageCache = new Map();
  const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function createMarker(className, parent) {
    const marker = document.createElement('span');
    marker.className = className;
    marker.setAttribute('aria-hidden', 'true');
    parent.prepend(marker);
    return marker;
  }
  const filterMarker = createMarker('festival-filter-marker', filters);
  const projectMarker = createMarker('festival-project-marker', program);
  function positionMarker(marker, button) {
    if (!button) return;
    marker.style.width = `${button.offsetWidth}px`;
    marker.style.height = `${button.offsetHeight}px`;
    marker.style.transform = `translate3d(${button.offsetLeft}px,${button.offsetTop}px,0)`;
  }
  function alignMarkers() {
    positionMarker(filterMarker, filters.querySelector('[aria-pressed="true"]'));
    positionMarker(projectMarker, program.querySelector('[data-festival-select][aria-pressed="true"]'));
  }
  function applyTheme(item) {
    Object.entries(themes[item.id]).forEach(([key,value]) => room.style.setProperty(`--festival-${key}`, value));
    const dark = ['ter-traditum','veo','xiaocha','dragon-guardian','fluffy-knight'].includes(item.id);
    room.dataset.colorScheme = dark ? 'dark' : 'light';
    room.style.setProperty('--festival-on-accent', dark ? themes[item.id].paper : '#fff');
    room.dataset.activeProject = item.id;
    window.dispatchEvent(new Event('festivalthemechange'));
  }
  function loadImage(item) {
    if (!imageCache.has(item.id)) {
      const image = new Image();
      image.src = item.image;
      const ready = image.decode().then(() => image);
      imageCache.set(item.id, ready);
      ready.catch(() => imageCache.delete(item.id));
    }
    return imageCache.get(item.id);
  }
  function stopMotion() {
    running.forEach(animation => animation.cancel());
    running = [];
    feature.querySelectorAll('.festival-cover-outgoing').forEach(image => image.remove());
  }
  function animate(element, frames, options) {
    const animation = element.animate(frames, options);
    running.push(animation);
    return animation;
  }
  function updateSelection(id) {
    program.querySelectorAll('[data-festival-select]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.festivalSelect === id));
    });
    alignMarkers();
  }
  function commit(item, withMotion) {
    stopMotion();
    const previousImage = feature.querySelector('.f-screen > img');
    const outgoing = withMotion && previousImage ? previousImage.cloneNode() : null;
    feature.innerHTML = `<a class="f-screen" href="${escape(item.href)}" aria-label="进入${escape(item.title)}项目"><span class="f-screen-label">FEATURED FILM / ${item.number}</span><img src="${escape(item.image)}" alt="${escape(item.title)}作品封面" width="1672" height="941"><div class="f-screen-bottom"><span>${escape(item.label)} · ${item.duration}</span><span class="festival-open" aria-hidden="true">↗</span></div></a><div class="f-caption"><div><span class="festival-eyebrow">YUMYULUCK ORIGINAL / ${item.number}</span><h3>${escape(item.title)}</h3><p>${escape(item.description)}</p></div><a class="f-enter" href="${escape(item.href)}">进入作品<b aria-hidden="true">↗</b></a></div>`;
    selected = item.id;
    try { sessionStorage.setItem(selectionKey, selected); } catch {}
    // Image, title and the section palette change together, in this same frame.
    applyTheme(item);
    updateSelection(item.id);
    feature.setAttribute('aria-busy', 'false');
    announcer.textContent = `当前作品：${item.title}，${item.label}，时长 ${item.duration}`;
    if (!withMotion) return;
    if (outgoing) {
      outgoing.className = 'festival-cover-outgoing';
      outgoing.alt = '';
      outgoing.setAttribute('aria-hidden', 'true');
      feature.querySelector('.f-screen').append(outgoing);
      const fade = animate(outgoing, [{opacity:1},{opacity:0}], {duration:480,easing:motion.ease,fill:'forwards'});
      fade.finished.then(() => outgoing.remove()).catch(() => outgoing.remove());
    }
    const image = feature.querySelector('.f-screen > img:not(.festival-cover-outgoing)');
    animate(image, [{transform:'scale(1.045)'},{transform:'scale(1)'}], {duration:motion.image,easing:motion.ease});
    feature.querySelectorAll('.f-caption .festival-eyebrow,.f-caption h3,.f-caption p,.f-enter').forEach((element,index) => {
      animate(element, [{opacity:0,transform:'translateY(10px)',filter:'blur(5px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0)'}], {duration:motion.text,delay:index*35,easing:motion.ease,fill:'backwards'});
    });
  }
  async function select(id) {
    const item = filtered.find(project => project.id === id);
    if (!item) return;
    const token = ++requestId;
    if (id === selected) {
      feature.setAttribute('aria-busy','false');
      return;
    }
    room.dataset.requestedProject = id;
    feature.setAttribute('aria-busy','true');
    try {
      await loadImage(item);
      // A slower image must never replace a more recent click or category choice.
      if (token !== requestId || !filtered.some(project => project.id === id)) return;
      commit(item, !reducedMotion.matches);
    } catch {
      if (token !== requestId) return;
      feature.setAttribute('aria-busy','false');
      announcer.textContent = '这张封面暂时无法加载，请重新选择。';
    }
  }
  function renderProgram() {
    program.replaceChildren(projectMarker);
    filtered.forEach(item => {
      const button = document.createElement('button');
      button.className = 'f-choice';
      button.type = 'button';
      button.dataset.festivalSelect = item.id;
      button.setAttribute('aria-pressed',String(item.id === selected));
      button.setAttribute('aria-controls','festival-feature');
      button.innerHTML = `<img src="${escape(item.image)}" alt="" width="1672" height="941" loading="lazy"><span class="f-choice-text"><small>${escape(item.label)} / ${item.duration}</small><b>${escape(item.title)}</b></span><span>${item.number}</span>`;
      program.append(button);
    });
    program.scrollTop = 0;
    program.scrollLeft = 0;
    room.querySelector('#festival-total').textContent = `${String(filtered.length).padStart(2,'0')} FILMS`;
    alignMarkers();
  }
  filters.querySelectorAll('[data-festival-filter]').forEach(button => {
    button.addEventListener('click', () => {
      const category = button.dataset.festivalFilter;
      requestId++;
      filtered = category === 'all' ? projects : projects.filter(item => item.category === category);
      if (category === 'real') {
        const order = ['golden-wish', 'reverse-scent', 'ter-traditum'];
        filtered.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      }
      filters.querySelectorAll('[data-festival-filter]').forEach(item => item.setAttribute('aria-pressed',String(item === button)));
      renderProgram();
      const next = filtered.some(item => item.id === selected) ? selected : filtered[0].id;
      void select(next);
      alignMarkers();
    });
  });
  program.addEventListener('click', event => {
    const button = event.target.closest('[data-festival-select]');
    if (button) void select(button.dataset.festivalSelect);
  });
  program.addEventListener('pointerover', event => {
    const button = event.target.closest('[data-festival-select]');
    const item = button && projects.find(project => project.id === button.dataset.festivalSelect);
    if (item) loadImage(item).catch(() => {});
  });
  program.addEventListener('keydown', event => {
    const button = event.target.closest('[data-festival-select]');
    if (!button) return;
    const buttons = [...program.querySelectorAll('[data-festival-select]')];
    let next = buttons.indexOf(button);
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (next+1)%buttons.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (next-1+buttons.length)%buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length-1;
    else return;
    event.preventDefault();
    void select(buttons[next].dataset.festivalSelect);
    buttons[next].focus({preventScroll:true});
    buttons[next].scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
  });
  reducedMotion.addEventListener('change', () => {if (reducedMotion.matches) stopMotion()});
  commit(initialProject, false);
  alignMarkers();
  room.classList.add('has-festival-motion');
  requestAnimationFrame(() => {room.dataset.motionReady='true'});
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(alignMarkers);
    observer.observe(program);
    observer.observe(filters);
  } else window.addEventListener('resize',alignMarkers);
  document.fonts.ready.then(alignMarkers);
})();
