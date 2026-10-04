(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pressSelector = 'button, a.ghost, .choice, .mode, .tab, .ai-box__btn, .backlink--x';

  function mountAmbient() {
    if (document.querySelector('.ambient-field')) return;
    const field = document.createElement('div');
    field.className = 'ambient-field';
    field.setAttribute('aria-hidden', 'true');
    field.innerHTML = '<span></span><span></span><span></span>';
    document.body.prepend(field);
  }

  function onPointerDown(event) {
    if (reduceMotion || event.button !== 0) return;
    const el = event.target.closest(pressSelector);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    if (el.closest('[aria-disabled="true"]')) return;

    const pos = getComputedStyle(el).position;
    if (pos === 'static') el.dataset.pressPos = '1';
    el.classList.add('is-pressing');

    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.2;
    const ripple = document.createElement('span');
    ripple.className = 'press-ripple';
    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';
    ripple.style.left = (event.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (event.clientY - rect.top - size / 2) + 'px';
    el.appendChild(ripple);

    const clear = () => {
      ripple.remove();
      if (!el.querySelector('.press-ripple')) {
        el.classList.remove('is-pressing');
        if (el.dataset.pressPos === '1') delete el.dataset.pressPos;
      }
    };
    ripple.addEventListener('animationend', clear, { once: true });
    window.setTimeout(clear, 560);
  }

  function start() {
    mountAmbient();
    document.addEventListener('pointerdown', onPointerDown, true);
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
