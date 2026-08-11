/* RavenShop — page behaviour. Loaded with `defer` from <head>, so the DOM is
   ready by the time this runs and the parser is never blocked. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------
     UI sounds, synthesized with oscillators so they cost zero bytes to
     download. Off unless the visitor turns them on; choice is remembered.
     --------------------------------------------------------------------- */
  var Sound = (function () {
    var enabled = false;
    var ctx = null;
    var lastHoverAt = 0;

    try { enabled = localStorage.getItem('rs-sound') === '1'; } catch (e) {}

    var context = function () {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    };

    var blip = function (from, to, ms, gain, type) {
      if (!enabled) return;
      var c = context();
      if (!c) return;
      var t = c.currentTime;
      var osc = c.createOscillator();
      var amp = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, t);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t + ms / 1000);
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(gain, t + 0.006);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      osc.connect(amp).connect(c.destination);
      osc.start(t);
      osc.stop(t + ms / 1000 + 0.02);
    };

    return {
      isOn: function () { return enabled; },
      toggle: function () {
        enabled = !enabled;
        try { localStorage.setItem('rs-sound', enabled ? '1' : '0'); } catch (e) {}
        if (enabled) blip(760, 1300, 90, 0.05, 'triangle');
        return enabled;
      },
      hover: function () {
        var now = Date.now();
        if (now - lastHoverAt < 55) return;
        lastHoverAt = now;
        blip(1150, 0, 26, 0.02, 'sine');
      },
      click: function () { blip(520, 240, 70, 0.045, 'square'); },
      lock: function () { blip(1780, 0, 24, 0.032, 'square'); },
      granted: function () { blip(420, 1700, 280, 0.055, 'sawtooth'); },
    };
  })();

  /* ---------------------------------------------------------------------
     Custom gaming cursor + target lock-on (physical pointers only)

     Three things were making the crosshair feel like it trailed the pointer,
     all fixed here:
       1. the hover handler wrote inline styles on *every* mouseover event, so
          sweeping across a paragraph fired a style recalc per inline element,
          on a promoted layer. State is diffed now and only written on change.
       2. the position was written once per mousemove; a 500 Hz mouse fires
          several of those per frame. Writes are coalesced into one rAF tick.
       3. the particle canvas was doing full-resolution work every frame on the
          same thread that positions the cursor (see the canvas block below).
     --------------------------------------------------------------------- */
  var setMatrix = null; // wired up by the particle block

  if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
    var crosshair = document.getElementById('custom-cursor-crosshair');
    var inner = crosshair.querySelector('.crosshair-inner');
    var trail = document.getElementById('custom-cursor-trail');
    var lockOn = document.getElementById('lock-on');

    crosshair.classList.remove('hidden');
    trail.classList.remove('hidden');

    var mouseX = window.innerWidth / 2;
    var mouseY = window.innerHeight / 2;
    var trailX = mouseX;
    var trailY = mouseY;
    var cursorRaf = 0;
    var mode = '';
    var lastHit = null;
    var lockTarget = null;
    var lockScrollY = -1;

    var place = function (el, x, y) {
      el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    };
    place(crosshair, mouseX, mouseY);
    place(trail, trailX, trailY);

    var sizeLock = function () {
      var r = lockTarget.getBoundingClientRect();
      lockOn.style.width = r.width + 'px';
      lockOn.style.height = r.height + 'px';
      place(lockOn, r.left, r.top);
    };

    var tick = function () {
      place(crosshair, mouseX, mouseY);

      var dx = mouseX - trailX;
      var dy = mouseY - trailY;
      trailX += dx * 0.4;
      trailY += dy * 0.4;
      place(trail, trailX, trailY);

      // keep the brackets on the card when the page scrolls under them
      if (lockTarget && window.scrollY !== lockScrollY) {
        lockScrollY = window.scrollY;
        sizeLock();
      }

      cursorRaf = Math.abs(dx) + Math.abs(dy) > 0.4 ? requestAnimationFrame(tick) : 0;
    };

    var schedule = function () {
      if (!cursorRaf) cursorRaf = requestAnimationFrame(tick);
    };

    document.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      schedule();
    }, { passive: true });

    window.addEventListener('scroll', function () {
      if (lockTarget) schedule();
    }, { passive: true });

    var applyMode = function (next) {
      if (next === mode) return;
      mode = next;
      trail.classList.toggle('hovering', next === 'target');
      trail.classList.toggle('hovering-text', next === 'text');
      inner.style.opacity = next === 'text' ? '0' : '1';
      inner.style.transform = next === 'target'
        ? 'translate(-50%, -50%) scale(0.5) rotate(45deg)'
        : 'translate(-50%, -50%) scale(1) rotate(0deg)';
    };

    var applyLock = function (card) {
      if (card === lockTarget) return;
      var wasLocked = !!lockTarget;
      lockTarget = card;
      if (!card) {
        lockOn.classList.remove('locked');
        return;
      }
      lockScrollY = window.scrollY;
      // acquiring from nothing must not animate in from the last position
      if (!wasLocked) lockOn.style.transition = 'none';
      sizeLock();
      if (!wasLocked) {
        void lockOn.offsetWidth;
        lockOn.style.transition = '';
      }
      lockOn.classList.add('locked');
      Sound.lock();
    };

    /* One delegated listener replaces the ~100 mouseenter/mouseleave handlers
       that used to be bound to every link, button and card. */
    document.addEventListener('mouseover', function (e) {
      var el = e.target;
      if (!el.closest) return;
      var overText = el.closest('input, textarea');
      var hit = overText ? null : el.closest('a, button, .collision-card');
      applyMode(overText ? 'text' : hit ? 'target' : '');
      applyLock(overText ? null : el.closest('.collision-card'));
      if (hit !== lastHit) {
        lastHit = hit;
        if (hit) Sound.hover();
      }
    }, { passive: true });
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('a, button')) Sound.click();
  }, { passive: true });

  /* ---------------------------------------------------------------------
     Background particles (and, if you know the code, matrix rain)

     Starts only once the browser is idle so it never competes with the first
     paint. Dots of a similar alpha share one batched path instead of a fill()
     each. Half the count on phones, frozen while the tab is hidden, resize
     debounced (a collapsing mobile URL bar fires resize on every scroll).

     Two changes specifically to keep the main thread free for the cursor: the
     backing store renders at half resolution — these are sub-pixel blurs at
     60% opacity, so three quarters of the pixel work was invisible — and the
     loop is capped near 32fps, which drifting dots cannot be told apart from
     60. Matrix mode switches back to full resolution because it draws glyphs.
     --------------------------------------------------------------------- */
  var canvas = document.getElementById('particles-bg');

  if (canvas && !reduceMotion) {
    var ctx = canvas.getContext('2d', { alpha: true });
    var TAU = Math.PI * 2;
    var BUCKETS = 5;
    var FILLS = [];
    for (var b = 0; b < BUCKETS; b++) {
      FILLS.push('rgba(0, 255, 85, ' + (0.1 + (b + 0.5) * (0.4 / BUCKETS)).toFixed(3) + ')');
    }

    var width = 0;   // CSS pixels; the context is scaled to the backing store
    var height = 0;
    var buckets = [];
    var raf = 0;
    var lastAt = 0;
    var matrix = null;

    var sizeCanvas = function () {
      var scale = matrix ? 1 : 0.5;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };

    var seed = function () {
      var count = window.innerWidth < 768 ? 30 : 60;
      buckets = [];
      for (var i = 0; i < BUCKETS; i++) buckets.push([]);
      for (var j = 0; j < count; j++) {
        var opacity = Math.random() * 0.4 + 0.1;
        var bucket = Math.min(BUCKETS - 1, Math.floor(((opacity - 0.1) / 0.4) * BUCKETS));
        buckets[bucket].push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 1.5 + 0.5,
          // doubled so apparent speed survives the halved frame rate
          speedY: (Math.random() * -0.5 - 0.1) * 2,
          speedX: (Math.random() - 0.5) * 0.4 * 2,
        });
      }
    };

    var drawParticles = function () {
      ctx.clearRect(0, 0, width, height);
      for (var k = 0; k < BUCKETS; k++) {
        var list = buckets[k];
        if (!list.length) continue;
        ctx.fillStyle = FILLS[k];
        ctx.beginPath();
        for (var n = 0; n < list.length; n++) {
          var p = list[n];
          p.y += p.speedY;
          p.x += p.speedX;
          if (p.y < 0) {
            p.y = height;
            p.x = Math.random() * width;
          }
          ctx.moveTo(p.x + p.size, p.y);
          ctx.arc(p.x, p.y, p.size, 0, TAU);
        }
        ctx.fill();
      }
    };

    var drawMatrix = function () {
      ctx.fillStyle = 'rgba(3, 5, 4, 0.10)';
      ctx.fillRect(0, 0, width, height);
      ctx.font = '15px ui-monospace, monospace';
      ctx.fillStyle = '#00FF55';
      for (var i = 0; i < matrix.cols; i++) {
        ctx.fillText(matrix.chars[(Math.random() * matrix.chars.length) | 0], i * 16, matrix.y[i]);
        matrix.y[i] += 16;
        if (matrix.y[i] > height && Math.random() > 0.975) matrix.y[i] = 0;
      }
    };

    var frame = function (now) {
      raf = requestAnimationFrame(frame);
      if (now - lastAt < (matrix ? 45 : 30)) return;
      lastAt = now;
      if (matrix) drawMatrix();
      else drawParticles();
    };

    var start = function () {
      sizeCanvas();
      seed();
      if (!raf) raf = requestAnimationFrame(frame);
    };

    setMatrix = function (on) {
      matrix = on ? { cols: 0, y: [], chars: 'アカサタナハマヤラワ0123456789RAVENSHOP<>/*' } : null;
      sizeCanvas();
      if (matrix) {
        matrix.cols = Math.ceil(width / 16);
        for (var i = 0; i < matrix.cols; i++) matrix.y[i] = Math.random() * -height;
      }
      ctx.clearRect(0, 0, width, height);
    };

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (width) {
        raf = requestAnimationFrame(frame);
      }
    });

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        // Ignore the pure-height jitter a collapsing mobile toolbar produces.
        if (window.innerWidth === width && Math.abs(window.innerHeight - height) < 120) return;
        sizeCanvas();
        if (matrix) setMatrix(true);
      }, 200);
    }, { passive: true });

    if ('requestIdleCallback' in window) {
      requestIdleCallback(start, { timeout: 1500 });
    } else {
      setTimeout(start, 250);
    }
  }

  /* --- منوی موبایل --- */
  var mobileMenuBtn = document.getElementById('mobileMenuBtn');
  var mobileMenu = document.getElementById('mobileMenu');

  var setMenu = function (open) {
    mobileMenu.classList.toggle('hidden', !open);
    mobileMenuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    var use = mobileMenuBtn.querySelector('use');
    if (use) use.setAttribute('href', open ? '#i-times' : '#i-bars');
  };

  mobileMenuBtn.addEventListener('click', function () {
    setMenu(mobileMenu.classList.contains('hidden'));
  });

  /* --- شمارنده ها ---
     The old loop read counter.innerText every 20ms, and reading innerText
     forces a synchronous layout — 200 forced reflows per counter. This walks
     a timestamp instead and only ever writes. */
  var counters = document.querySelectorAll('.counter');
  var COUNT_MS = 1100;

  var runCounter = function (el) {
    var target = +el.getAttribute('data-target');
    var t0 = performance.now();
    var step = function (now) {
      var t = Math.min(1, (now - t0) / COUNT_MS);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased) + (t === 1 ? '+' : '');
      if (t < 1) requestAnimationFrame(step);
    };
    step(t0);
  };

  if (counters.length) {
    var counterObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        runCounter(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (c) { counterObserver.observe(c); });
  }

  /* --- اکاردئون سوالات متداول (delegated, no inline onclick) --- */
  document.addEventListener('click', function (e) {
    var button = e.target.closest ? e.target.closest('.faq-container > button') : null;
    if (!button) return;
    var item = button.parentElement;
    var opening = !item.classList.contains('active');
    document.querySelectorAll('.faq-container.active').forEach(function (other) {
      if (other !== item) other.classList.remove('active');
    });
    item.classList.toggle('active', opening);
    button.setAttribute('aria-expanded', opening ? 'true' : 'false');
  });

  /* --- اسکرول نرم برای لینک‌های داخلی --- */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var href = anchor.getAttribute('href');
      e.preventDefault();
      setMenu(false);
      // `href="#"` used to reach document.querySelector('#'), which throws.
      if (href === '#' || href === '#top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      var target = document.querySelector(href);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* --- سیستم جستجوی دقیق و لحظه‌ای --- */
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function clearHighlights() {
    document.querySelectorAll('.search-highlight').forEach(function (mark) {
      var parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
  }

  function highlightText(term) {
    clearHighlights();
    if (!term) return null;

    var regex = new RegExp('(' + escapeRegExp(term) + ')', 'gi');

    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parentTag = node.parentNode.tagName;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'CANVAS', 'svg'].indexOf(parentTag) !== -1 ||
            node.parentNode.classList.contains('search-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        return node.nodeValue.match(regex) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });

    var nodes = [];
    var node;
    while ((node = walker.nextNode())) nodes.push(node);

    var firstMatch = null;

    nodes.forEach(function (textNode) {
      var parts = textNode.nodeValue.split(regex);
      var fragment = document.createDocumentFragment();

      parts.forEach(function (part) {
        if (part.toLowerCase() === term.toLowerCase()) {
          var mark = document.createElement('mark');
          mark.className = 'search-highlight bg-gaming-neon/60 text-white rounded px-1 shadow-[0_0_8px_rgba(0,255,85,0.5)] transition-all';
          mark.textContent = part;
          fragment.appendChild(mark);
          if (!firstMatch) firstMatch = mark;
        } else if (part) {
          fragment.appendChild(document.createTextNode(part));
        }
      });
      textNode.parentNode.replaceChild(fragment, textNode);
    });

    return firstMatch;
  }

  var desktopInput = document.getElementById('desktopSearch');
  var mobileInput = document.getElementById('mobileSearch');
  var searchTimeout;

  function performSearch(e) {
    clearTimeout(searchTimeout);
    var input = e.target;
    var term = input.value.trim();

    if (input === desktopInput && mobileInput) mobileInput.value = input.value;
    if (input === mobileInput && desktopInput) desktopInput.value = input.value;

    searchTimeout = setTimeout(function () {
      var firstMatch = highlightText(term);
      if (term && firstMatch) {
        firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
  }

  if (desktopInput) desktopInput.addEventListener('input', performSearch);
  if (mobileInput) mobileInput.addEventListener('input', performSearch);

  /* --- sound toggle in the navbar --- */
  var soundBtn = document.getElementById('soundToggle');
  if (soundBtn) {
    var paintSound = function () {
      var on = Sound.isOn();
      soundBtn.querySelector('use').setAttribute('href', on ? '#i-volume-high' : '#i-volume-xmark');
      soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      soundBtn.setAttribute('aria-label', on ? 'خاموش کردن صدای رابط' : 'روشن کردن صدای رابط');
      soundBtn.classList.toggle('text-gaming-neon', on);
      soundBtn.classList.toggle('text-gray-500', !on);
    };
    paintSound();
    soundBtn.addEventListener('click', function () {
      Sound.toggle();
      paintSound();
    });
  }

  /* --- which section am I in: keep that nav underline lit --- */
  var desktopNav = document.getElementById('desktopNav');
  if (desktopNav && 'IntersectionObserver' in window) {
    var linkFor = {};
    [].forEach.call(desktopNav.querySelectorAll('a[href^="#"]'), function (a) {
      linkFor[a.getAttribute('href')] = a;
    });

    var activeHref = null;
    var setActive = function (href) {
      if (href === activeHref) return;
      activeHref = href;
      for (var key in linkFor) linkFor[key].classList.toggle('nav-active', key === href);
    };

    var watched = Object.keys(linkFor).filter(function (h) { return h !== '#'; });
    var onScreen = {};

    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { onScreen['#' + entry.target.id] = entry.isIntersecting; });
      var current = null;
      watched.forEach(function (h) { if (onScreen[h]) current = h; });
      setActive(current || (window.scrollY < 240 ? '#' : null));
    }, { rootMargin: '-45% 0px -45% 0px' });

    watched.forEach(function (h) {
      var el = document.querySelector(h);
      if (el) sectionObserver.observe(el);
    });

    window.addEventListener('scroll', function () {
      if (window.scrollY < 240) setActive('#');
    }, { passive: true });
  }

  /* ---------------------------------------------------------------------
     Hero line decrypt: scramble every letter, then resolve left to right.
     Spaces, ZWNJ and punctuation are never touched and the character count
     never changes, so word boundaries hold. The box is pinned to its measured
     height for the duration, because Persian glyph widths differ enough that a
     scrambled line could otherwise wrap and shift everything below it.
     --------------------------------------------------------------------- */
  var heroLine = document.getElementById('heroLine');
  if (heroLine && !reduceMotion) {
    var FA_POOL = 'ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی';
    var EN_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*/<>';

    var parts = [];
    var textWalker = document.createTreeWalker(heroLine, NodeFilter.SHOW_TEXT);
    var textNode;
    while ((textNode = textWalker.nextNode())) {
      if (textNode.nodeValue.trim()) parts.push({ node: textNode, text: textNode.nodeValue });
    }

    var scramble = function (ch) {
      if (ch >= '؀' && ch <= 'ۿ') return FA_POOL.charAt((Math.random() * FA_POOL.length) | 0);
      if (/[A-Za-z0-9]/.test(ch)) return EN_POOL.charAt((Math.random() * EN_POOL.length) | 0);
      return ch;
    };

    var totalChars = parts.reduce(function (sum, p) { return sum + p.text.length; }, 0);
    var DECRYPT_MS = 900;
    var startedAt = 0;

    var restore = function () {
      parts.forEach(function (p) { p.node.nodeValue = p.text; });
      heroLine.classList.remove('decrypting');
      heroLine.style.height = '';
      heroLine.style.overflow = '';
    };

    var decryptFrame = function (now) {
      if (!startedAt) startedAt = now;
      var progress = Math.min(1, (now - startedAt) / DECRYPT_MS);
      var settled = Math.floor(progress * totalChars);
      var seen = 0;
      for (var i = 0; i < parts.length; i++) {
        var src = parts[i].text;
        var out = '';
        for (var j = 0; j < src.length; j++, seen++) {
          out += seen < settled ? src.charAt(j) : scramble(src.charAt(j));
        }
        parts[i].node.nodeValue = out;
      }
      if (progress < 1) requestAnimationFrame(decryptFrame);
      else restore();
    };

    if (parts.length) {
      setTimeout(function () {
        heroLine.style.height = heroLine.offsetHeight + 'px';
        heroLine.style.overflow = 'hidden';
        heroLine.classList.add('decrypting');
        requestAnimationFrame(decryptFrame);
      }, 260);
    }
  }

  /* ---------------------------------------------------------------------
     ↑↑↓↓←→←→BA — turns the particle canvas into matrix rain. Esc or 25s ends
     it. Reuses the #toast element, which until now was markup nothing called.
     --------------------------------------------------------------------- */
  var toast = document.getElementById('toast');
  var toastMsg = document.getElementById('toast-msg');
  var toastTimer = 0;

  var showToast = function (message, good) {
    if (!toast) return;
    toastMsg.textContent = message;
    toast.classList.toggle('bg-red-500/90', !good);
    toast.classList.toggle('border-red-400', !good);
    toast.classList.toggle('bg-gaming-neon/20', !!good);
    toast.classList.toggle('border-gaming-neon', !!good);
    toast.classList.remove('opacity-0');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.add('opacity-0'); }, 2800);
  };

  var KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  var keyPos = 0;
  var matrixTimer = 0;

  var exitMatrix = function () {
    clearTimeout(matrixTimer);
    if (!document.body.classList.contains('matrix-mode')) return;
    document.body.classList.remove('matrix-mode');
    if (setMatrix) setMatrix(false);
  };

  document.addEventListener('keydown', function (e) {
    var key = (e.key || '').toLowerCase();

    if (key === 'escape') { exitMatrix(); return; }
    // don't hunt for the code while someone is typing in the search box
    if (e.target && /^(input|textarea)$/i.test(e.target.tagName)) return;

    keyPos = key === KONAMI[keyPos] ? keyPos + 1 : (key === KONAMI[0] ? 1 : 0);
    if (keyPos < KONAMI.length) return;
    keyPos = 0;

    if (!setMatrix) return; // reduced motion, or no canvas
    document.body.classList.add('matrix-mode');
    setMatrix(true);
    Sound.granted();
    showToast('ACCESS GRANTED // RAVEN MODE', true);
    matrixTimer = setTimeout(exitMatrix, 25000);
  });
})();
