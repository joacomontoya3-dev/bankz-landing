(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===================== NAV ===================== */
  const nav = document.getElementById('nav');
  const navBurger = document.getElementById('navBurger');
  const mobileMenu = document.getElementById('mobileMenu');

  const onScrollNav = () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  };
  onScrollNav();
  window.addEventListener('scroll', onScrollNav, { passive: true });

  navBurger.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    navBurger.setAttribute('aria-expanded', String(open));
  });
  mobileMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      navBurger.setAttribute('aria-expanded', 'false');
    });
  });

  /* ===================== VAULT DOOR SCROLL MECHANIC (frame-sequence scrub) ===================== */
  const vaultWrapper = document.getElementById('vaultWrapper');
  const vaultCanvas = document.getElementById('vaultCanvas');
  const vaultCtx = vaultCanvas.getContext('2d');
  const vaultLight = document.getElementById('vaultLight');
  const vaultContent = document.getElementById('vaultContent');
  const vaultHint = document.getElementById('vaultHint');

  const clamp01 = v => Math.min(1, Math.max(0, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  const FRAME_COUNT = 240;
  const FRAME_BASE = 'public/frames/frame_';
  const frames = new Array(FRAME_COUNT);
  const loaded = new Array(FRAME_COUNT).fill(false);
  let loadedCount = 0;
  let currentFrameIndex = 0;

  function nearestLoadedIndex(target) {
    if (loaded[target]) return target;
    for (let d = 1; d < FRAME_COUNT; d++) {
      if (target - d >= 0 && loaded[target - d]) return target - d;
      if (target + d < FRAME_COUNT && loaded[target + d]) return target + d;
    }
    return -1;
  }

  function drawFrame(img) {
    const cw = vaultCanvas.width, ch = vaultCanvas.height;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!cw || !ch || !iw || !ih) return;
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale, dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = 0.55 * (ch - dh); // mirrors object-position: center 55%
    vaultCtx.clearRect(0, 0, cw, ch);
    vaultCtx.drawImage(img, dx, dy, dw, dh);
  }

  function drawCurrentFrame(idx) {
    if (idx == null) idx = currentFrameIndex;
    currentFrameIndex = idx;
    const useIdx = loaded[idx] ? idx : nearestLoadedIndex(idx);
    if (useIdx === -1) return;
    drawFrame(frames[useIdx]);
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = vaultCanvas.getBoundingClientRect();
    vaultCanvas.width = Math.round(rect.width * dpr);
    vaultCanvas.height = Math.round(rect.height * dpr);
    drawCurrentFrame(currentFrameIndex);
  }

  function updateLoadingHint() {
    if (loadedCount < FRAME_COUNT) {
      vaultHint.textContent = `Cargando bóveda... ${Math.round((loadedCount / FRAME_COUNT) * 100)}%`;
    } else {
      vaultHint.textContent = 'Scrolleá para abrir la bóveda';
    }
  }

  function preloadFrames() {
    let nextIndex = 0;
    const concurrency = 8;
    function loadNext() {
      if (nextIndex >= FRAME_COUNT) return;
      const i = nextIndex++;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        frames[i] = img;
        loaded[i] = true;
        loadedCount++;
        if (i === 0 || reducedMotion) drawCurrentFrame(reducedMotion ? FRAME_COUNT - 1 : currentFrameIndex);
        updateLoadingHint();
        loadNext();
      };
      img.onerror = () => { loadedCount++; updateLoadingHint(); loadNext(); };
      img.src = `${FRAME_BASE}${String(i + 1).padStart(4, '0')}.jpg`;
    }
    for (let c = 0; c < concurrency; c++) loadNext();
  }

  updateLoadingHint();
  resizeCanvas();
  preloadFrames();

  // smooth the raw scroll position toward a lagging "display" value each
  // frame, instead of snapping straight to it — this is what keeps the
  // door/light/text feeling like they're gliding rather than jumping
  // whenever the mouse wheel or trackpad fires a chunky scroll delta.
  const SMOOTHING = 0.11;
  const SNAP_EPSILON = 0.0004;
  let targetProgress = 0;
  let displayProgress = 0;
  let rafId = null;

  function computeTargetProgress() {
    const rect = vaultWrapper.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    targetProgress = clamp01(-rect.top / total);
  }

  function renderVault(progress) {
    if (reducedMotion) {
      vaultContent.style.opacity = String(progress > 0.3 ? 1 : progress / 0.3);
      vaultHint.style.opacity = progress > 0.02 ? '0' : '1';
      return;
    }

    // scrub the frame sequence with (smoothed) scroll position
    drawCurrentFrame(Math.round(progress * (FRAME_COUNT - 1)));

    // light burst as the door swings open (matches the clip's opening beat)
    const lightP = Math.sin(clamp01((progress - 0.55) / 0.4) * Math.PI);
    vaultLight.style.opacity = String(lightP * 0.7);

    // content reveal once the door has visibly started opening
    const contentP = easeOut(clamp01((progress - 0.6) / 0.35));
    vaultContent.style.opacity = String(contentP);
    vaultContent.style.transform = `translateY(${(1 - contentP) * 26}px) scale(${0.97 + contentP * 0.03})`;

    // hint fades immediately on first scroll
    vaultHint.style.opacity = progress > 0.02 ? '0' : '1';

    // reveal-in children inside hero once content is mostly visible
    if (contentP > 0.5) {
      vaultContent.querySelectorAll('.reveal-in').forEach(el => el.classList.add('in-view'));
    }
  }

  function loop() {
    computeTargetProgress();
    const diff = targetProgress - displayProgress;

    if (Math.abs(diff) < SNAP_EPSILON) {
      displayProgress = targetProgress;
      renderVault(displayProgress);
      rafId = null; // settled — stop looping until the next scroll
      return;
    }

    displayProgress += diff * SMOOTHING;
    renderVault(displayProgress);
    rafId = requestAnimationFrame(loop);
  }

  function requestRender() {
    if (rafId == null) rafId = requestAnimationFrame(loop);
  }

  window.addEventListener('scroll', requestRender, { passive: true });
  window.addEventListener('resize', () => { resizeCanvas(); requestRender(); });
  requestRender();

  /* ===================== COUNTDOWN ===================== */
  const target = new Date('2026-09-01T00:00:00-03:00').getTime();
  const cdDays = document.getElementById('cdDays');
  const cdHours = document.getElementById('cdHours');
  const cdMins = document.getElementById('cdMins');
  const cdSecs = document.getElementById('cdSecs');
  const pad = n => String(Math.max(0, n)).padStart(2, '0');

  function tickCountdown() {
    const diff = target - Date.now();
    if (diff <= 0) {
      cdDays.textContent = cdHours.textContent = cdMins.textContent = cdSecs.textContent = '00';
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    cdDays.textContent = pad(d);
    cdHours.textContent = pad(h);
    cdMins.textContent = pad(m);
    cdSecs.textContent = pad(s);
  }
  tickCountdown();
  setInterval(tickCountdown, 1000);

  /* ===================== SCROLL REVEALS (rest of page) ===================== */
  const revealEls = document.querySelectorAll('.section .reveal-up, .section .reveal-in');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(el => io.observe(el));

  /* ===================== SERVICE TABS ===================== */
  const tabs = document.querySelectorAll('.service-tab');
  const panels = document.querySelectorAll('.service-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      document.querySelector(`.service-panel[data-panel="${tab.dataset.tab}"]`).classList.add('active');
    });
  });

  /* ===================== FAQ ACCORDION ===================== */
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(other => {
        if (other !== item) {
          other.classList.remove('open');
          other.querySelector('.faq-a').style.maxHeight = null;
        }
      });
      item.classList.toggle('open', !isOpen);
      a.style.maxHeight = !isOpen ? a.scrollHeight + 'px' : null;
    });
  });

  /* ===================== CONTACT FORM (front-end only) ===================== */
  const contactForm = document.getElementById('contactForm');
  const formNote = document.getElementById('formNote');
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    formNote.textContent = 'Gracias, recibimos tu consulta. Te contactamos a la brevedad.';
    formNote.classList.add('success');
    contactForm.reset();
  });

})();
