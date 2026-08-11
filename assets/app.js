/* RavenShop — page behaviour. Loaded with `defer` from <head>, so the DOM is
   ready by the time this runs and the parser is never blocked. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------
     Custom gaming cursor (physical-pointer devices only)
     Positions are written to `transform` instead of left/top so each move is
     a compositor-only update, and the follower's rAF loop now stops as soon
     as it catches up instead of spinning forever.
     --------------------------------------------------------------------- */
  if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
    var crosshair = document.getElementById('custom-cursor-crosshair');
    var inner = crosshair.querySelector('.crosshair-inner');
    var trail = document.getElementById('custom-cursor-trail');

    crosshair.classList.remove('hidden');
    trail.classList.remove('hidden');

    var mouseX = window.innerWidth / 2;
    var mouseY = window.innerHeight / 2;
    var trailX = mouseX;
    var trailY = mouseY;
    var trailRaf = 0;

    var place = function (el, x, y) {
      el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    };
    place(crosshair, mouseX, mouseY);
    place(trail, trailX, trailY);

    var followTrail = function () {
      var dx = mouseX - trailX;
      var dy = mouseY - trailY;
      trailX += dx * 0.4;
      trailY += dy * 0.4;
      place(trail, trailX, trailY);
      trailRaf = Math.abs(dx) + Math.abs(dy) > 0.4 ? requestAnimationFrame(followTrail) : 0;
    };

    document.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      place(crosshair, mouseX, mouseY);
      if (!trailRaf) trailRaf = requestAnimationFrame(followTrail);
    }, { passive: true });

    /* One delegated listener replaces the ~100 mouseenter/mouseleave handlers
       that used to be bound to every link, button and card. */
    document.addEventListener('mouseover', function (e) {
      var el = e.target;
      var overText = el.closest && el.closest('input, textarea');
      var overTarget = !overText && el.closest && el.closest('a, button, .collision-card');
      trail.classList.toggle('hovering', !!overTarget);
      trail.classList.toggle('hovering-text', !!overText);
      inner.style.opacity = overText ? '0' : '1';
      inner.style.transform = overTarget
        ? 'translate(-50%, -50%) scale(0.5) rotate(45deg)'
        : 'translate(-50%, -50%) scale(1) rotate(0deg)';
    }, { passive: true });
  }

  /* ---------------------------------------------------------------------
     Background particles
     Changes vs. the old version: starts only once the browser is idle (so it
     never competes with the first paint), draws all dots of a similar alpha in
     a single batched path instead of one fill() per dot, halves the count on
     phones, freezes while the tab is hidden, and debounces resize — that last
     one matters because collapsing the mobile URL bar fires resize on every
     scroll, which used to reallocate the canvas mid-scroll.
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

    var width = 0;
    var height = 0;
    var buckets = [];
    var raf = 0;

    var sizeCanvas = function () {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
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
          speedY: Math.random() * -0.5 - 0.1,
          speedX: (Math.random() - 0.5) * 0.4,
        });
      }
    };

    var frame = function () {
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
      raf = requestAnimationFrame(frame);
    };

    var start = function () {
      sizeCanvas();
      seed();
      if (!raf) raf = requestAnimationFrame(frame);
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
})();
