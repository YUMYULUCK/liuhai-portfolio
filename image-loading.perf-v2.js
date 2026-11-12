(() => {
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      const image=entry.target;
      if (image.dataset.deferredSrc) { image.src=image.dataset.deferredSrc; delete image.dataset.deferredSrc; }
      observer.unobserve(image);
    }
  }, {rootMargin:'160px'}) : null;
  function register(root) {
    const images = root.matches?.('img[data-deferred-src]') ? [root] : [...root.querySelectorAll?.('img[data-deferred-src]') || []];
    for (const image of images) {
      image.decoding='async';
      if (observer) observer.observe(image);
      else { image.src=image.dataset.deferredSrc; delete image.dataset.deferredSrc; }
    }
  }
  register(document);
  if ('IntersectionObserver' in window) {
    const backgrounds = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.removeAttribute('data-lazy-backdrop'); backgrounds.unobserve(entry.target);
      }
    }, {rootMargin:'600px'});
    document.querySelectorAll('[data-lazy-backdrop]').forEach(section => backgrounds.observe(section));
  } else document.querySelectorAll('[data-lazy-backdrop]').forEach(section => section.removeAttribute('data-lazy-backdrop'));
  new MutationObserver(changes => { for (const change of changes) for (const node of change.addedNodes) if (node.nodeType===1) register(node); }).observe(document.documentElement,{childList:true,subtree:true});
})();
