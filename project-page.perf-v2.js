(() => {
  const links = [...document.querySelectorAll('.project-sections a')];
  const targets = links.map(link => document.querySelector(link.hash));
  let frame = 0;
  const updateNavigation = () => {
    frame = 0;
    let active = 0;
    targets.forEach((target, index) => {
      if (target && target.getBoundingClientRect().top <= 160) active = index;
    });
    if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 3) active = links.length - 1;
    links.forEach((link, index) => {
      link.classList.toggle('is-active', index === active);
      if (index === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };
  window.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(updateNavigation);
  }, {passive:true});
  window.addEventListener('resize', updateNavigation);
  updateNavigation();
  // Keep the same gallery DOM and dimensions; load large media only near view.
  const pendingImages = new WeakMap();
  const imageObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const image = entry.target;
      image.src = pendingImages.get(image);
      pendingImages.delete(image);
      imageObserver.unobserve(image);
    });
  }, {rootMargin:'160px'}) : null;
  function imageWhenNear(image, src) {
    image.decoding = 'async';
    if (!imageObserver) { image.src = src; return; }
    pendingImages.set(image, src);
    imageObserver.observe(image);
  }
  function createAssetMedia(item) {
    const isVideo = item.type === 'video';
    const media = document.createElement(isVideo ? 'video' : 'img');
    if (isVideo) media.src = item.src;
    else imageWhenNear(media, item.src);
    if (isVideo) {
      media.controls = true;
      media.playsInline = true;
      media.preload = 'metadata';
      media.setAttribute('aria-label', item.alt || item.title);
      if (item.poster) media.poster = item.poster;
    } else {
      media.alt = item.alt || item.title;
      media.width = 1672;
      media.height = 941;
    }
    return media;
  }
  function measureAssetWorkspace(library) {
    const navigation = document.querySelector('.project-sections');
    const tabs = library.querySelector('.asset-category-tabs');
    const top = Math.ceil((navigation ? navigation.getBoundingClientRect().bottom : 0) + 12);
    const tabHeight = tabs.offsetHeight + parseFloat(getComputedStyle(tabs).marginBottom);
    library.style.setProperty('--asset-toolbar-offset', `${top}px`);
    library.style.setProperty('--asset-tabs-height', `${tabHeight}px`);
    return top;
  }
  function revealAssetWorkspace(library) {
    const top = measureAssetWorkspace(library);
    const bounds = library.getBoundingClientRect();
    if (bounds.top < top - 1 || bounds.bottom > window.innerHeight - 12) {
      window.scrollTo({top:window.scrollY + bounds.top - top, behavior:'instant'});
    }
  }
  function bindGallery(gallery, items) {
    const stage = gallery.querySelector('.asset-stage');
    const caption = gallery.querySelector('[data-asset-caption]');
    const count = gallery.querySelector('[data-asset-count]');
    const thumbnails = [...gallery.querySelectorAll('.asset-thumb')];
    const strip = gallery.querySelector('.asset-thumbnails');
    let pointer = null;
    let suppressClick = false;
    strip.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      suppressClick = false;
      pointer = {id:event.pointerId, x:event.clientX, scroll:strip.scrollLeft, dragging:false};
    });
    strip.addEventListener('pointermove', event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      if (event.buttons !== 1) {
        strip.classList.remove('is-dragging');
        pointer = null;
        return;
      }
      const distance = event.clientX - pointer.x;
      if (!pointer.dragging && Math.abs(distance) > 5) {
        pointer.dragging = true;
        strip.setPointerCapture(event.pointerId);
        strip.classList.add('is-dragging');
      }
      if (pointer.dragging) {
        event.preventDefault();
        strip.scrollLeft = pointer.scroll - distance;
      }
    });
    const finishDrag = event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      suppressClick = pointer.dragging;
      if (strip.hasPointerCapture(event.pointerId)) strip.releasePointerCapture(event.pointerId);
      strip.classList.remove('is-dragging');
      pointer = null;
    };
    strip.addEventListener('pointerup', finishDrag);
    strip.addEventListener('pointercancel', finishDrag);
    strip.addEventListener('pointerleave', () => { if (pointer && !pointer.dragging) pointer = null; });
    strip.addEventListener('lostpointercapture', () => {
      strip.classList.remove('is-dragging');
      pointer = null;
    });
    strip.addEventListener('click', event => {
      if (event.detail === 0) { suppressClick = false; return; }
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    }, true);
    strip.addEventListener('dragstart', event => event.preventDefault());
    const select = index => {
      const button = thumbnails[index];
      const previous = stage.querySelector(':scope > img, :scope > video');
      if (previous.tagName === 'VIDEO') previous.pause();
      previous.replaceWith(createAssetMedia(items[index]));
      caption.textContent = button.dataset.assetTitle;
      count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(thumbnails.length).padStart(2, '0')}`;
      revealAssetWorkspace(gallery.closest('[data-asset-library]'));
      thumbnails.forEach(item => {
        const selected = item === button;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
    };
    thumbnails.forEach((button, index) => {
      button.addEventListener('click', () => select(index));
      button.addEventListener('keydown', event => {
        let next = index;
        if (event.key === 'ArrowRight') next = (index + 1) % thumbnails.length;
        else if (event.key === 'ArrowLeft') next = (index - 1 + thumbnails.length) % thumbnails.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = thumbnails.length - 1;
        else return;
        event.preventDefault();
        select(next);
        thumbnails[next].focus();
      });
    });
  }
  document.querySelectorAll('[data-asset-library]').forEach(library => {
    const data = JSON.parse(library.querySelector('[data-project-assets]').textContent);
    const tabs = [...library.querySelectorAll('[data-asset-category]')];
    const panel = library.querySelector('[role="tabpanel"]');
    const render = tab => {
      const category = tab.dataset.assetCategory;
      const items = data[category] || [];
      tabs.forEach(button => {
        const selected = button === tab;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
      });
      panel.setAttribute('aria-labelledby', tab.id);
      panel.querySelectorAll('video').forEach(video => video.pause());
      panel.replaceChildren();
      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'asset-empty';
        const title = document.createElement('p');
        title.textContent = `${tab.childNodes[0].textContent}待添加`;
        const note = document.createElement('span');
        note.textContent = '本分类图片将在这里展示';
        empty.append(title, note);
        panel.append(empty);
        return;
      }
      const gallery = document.createElement('div');
      gallery.className = 'asset-gallery';
      gallery.innerHTML = '<figure class="asset-stage"><figcaption aria-live="polite"><span data-asset-caption></span><span data-asset-count></span></figcaption></figure><div class="asset-thumbnails" aria-label="选择分类素材"></div>';
      gallery.querySelector('.asset-stage').prepend(createAssetMedia(items[0]));
      gallery.querySelector('[data-asset-caption]').textContent = items[0].title;
      gallery.querySelector('[data-asset-count]').textContent = `01 / ${String(items.length).padStart(2, '0')}`;
      items.forEach((item, index) => {
        const button = document.createElement('button');
        button.className = `asset-thumb${index === 0 ? ' is-selected' : ''}`;
        button.type = 'button';
        button.setAttribute('aria-pressed', String(index === 0));
        button.dataset.assetSrc = item.src;
        button.dataset.assetTitle = item.title;
        button.dataset.assetAlt = item.alt;
        const thumbnail = document.createElement(item.type === 'video' && !item.poster ? 'span' : 'img');
        if (thumbnail.tagName === 'IMG') {
          imageWhenNear(thumbnail, item.thumbnail || item.poster || item.src);
          thumbnail.alt = '';
          thumbnail.width = 160;
          thumbnail.height = 90;
          thumbnail.loading = 'lazy';
        } else {
          thumbnail.className = 'asset-video-thumbnail';
          thumbnail.textContent = '▶ 视频';
          thumbnail.setAttribute('aria-hidden', 'true');
        }
        const label = document.createElement('span');
        label.append(`${String(index + 1).padStart(2, '0')} `);
        const name = document.createElement('b');
        name.textContent = item.title;
        label.append(name);
        button.append(thumbnail, label);
        gallery.querySelector('.asset-thumbnails').append(button);
      });
      panel.append(gallery);
      bindGallery(gallery, items);
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => { render(tab); revealAssetWorkspace(library); });
      tab.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault();
        render(tabs[next]);
        tabs[next].focus({preventScroll:true});
      });
    });
    measureAssetWorkspace(library);
    window.addEventListener('resize', () => measureAssetWorkspace(library));
    document.fonts.ready.then(() => measureAssetWorkspace(library));
    render(tabs.find(tab => tab.dataset.assetCategory === 'characters') || tabs[0]);
  });
  // Stop all project media when leaving, including browser back navigation.
  window.addEventListener('pagehide', () => {
    document.querySelectorAll('video').forEach(video => video.pause());
  });
})();
