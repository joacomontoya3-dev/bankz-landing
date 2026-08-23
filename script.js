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

  /* ===================== VAULT DOOR SCROLL MECHANIC (video scrub) ===================== */
  const vaultWrapper = document.getElementById('vaultWrapper');
  const vaultVideo = document.getElementById('vaultVideo');
  const vaultLight = document.getElementById('vaultLight');
  const vaultContent = document.getElementById('vaultContent');
  const vaultHint = document.getElementById('vaultHint');

  const clamp01 = v => Math.min(1, Math.max(0, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  let videoDuration = 0;
  let videoReady = false;
  vaultVideo.addEventListener('loadedmetadata', () => {
    videoDuration = vaultVideo.duration || 0;
    videoReady = true;
    // prime playback so iOS Safari allows programmatic seeking afterwards
    const primePlay = vaultVideo.play();
    if (primePlay && primePlay.then) {
      primePlay.then(() => vaultVideo.pause()).catch(() => {});
    }
    updateVault();
  });

  let ticking = false;
  let lastVideoTime = -1;

  function updateVault() {
    ticking = false;
    const rect = vaultWrapper.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const progress = clamp01(-rect.top / total);

    // scrub the video frame-by-frame with scroll position
    if (videoReady && videoDuration > 0) {
      const t = progress * videoDuration;
      if (Math.abs(t - lastVideoTime) > 0.01) {
        vaultVideo.currentTime = t;
        lastVideoTime = t;
      }
    }

    if (reducedMotion) {
      vaultContent.style.opacity = String(progress > 0.3 ? 1 : progress / 0.3);
      vaultHint.style.opacity = progress > 0.02 ? '0' : '1';
      return;
    }

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

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateVault);
    }
  }, { passive: true });
  window.addEventListener('resize', updateVault);
  updateVault();

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
