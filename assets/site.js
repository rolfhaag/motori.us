(function () {
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------- Smooth scroll for in-page subnav / CTA links ---------- */
  document.querySelectorAll('[data-scrollto]').forEach(function (el) {
    el.addEventListener('click', function () {
      var target = document.getElementById(el.getAttribute('data-scrollto'));
      if (target) target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });

  /* ---------- Share link (copy this page's canonical URL) ---------- */
  document.querySelectorAll('[data-share-url]').forEach(function (btn) {
    var labelEl = btn.querySelector('.share-link-label');
    var original = labelEl ? labelEl.textContent : btn.textContent;
    var resetTimer = null;

    function setLabel(text, copied) {
      if (labelEl) { labelEl.textContent = text; } else { btn.textContent = text; }
      btn.classList.toggle('copied', !!copied);
    }

    btn.addEventListener('click', function () {
      var url = btn.getAttribute('data-share-url');
      clearTimeout(resetTimer);

      function done(ok) {
        setLabel(ok ? 'Link copied!' : 'Copy failed', ok);
        resetTimer = setTimeout(function () { setLabel(original, false); }, 1800);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
      } else {
        try {
          var ta = document.createElement('textarea');
          ta.value = url;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          var ok = document.execCommand('copy');
          document.body.removeChild(ta);
          done(ok);
        } catch (e) { done(false); }
      }
    });
  });

  /* ---------- Gallery tabs + row limit (build pages only; no-ops elsewhere) ---------- */
  var gtabs = document.querySelectorAll('.gtab');
  var ggrid = document.getElementById('gallery-grid');
  if (gtabs.length && ggrid) {
    var gAllPhotos = Array.prototype.slice.call(ggrid.querySelectorAll('.photo'));
    var gCurrentCat = 'all';
    var gExpanded = false;
    var gMoreWrap = document.getElementById('gallery-more');
    var gMoreBtn = document.getElementById('gallery-more-btn');
    var ROWS_COLLAPSED = 3;

    function gColumnCount() {
      var cols = getComputedStyle(ggrid).gridTemplateColumns.split(' ').filter(Boolean);
      return cols.length || 1;
    }

    function gRender() {
      var matching = gAllPhotos.filter(function (p) {
        return gCurrentCat === 'all' || p.getAttribute('data-cat') === gCurrentCat;
      });
      gAllPhotos.forEach(function (p) { p.classList.add('gallery-hidden'); });

      var limit = gExpanded ? matching.length : gColumnCount() * ROWS_COLLAPSED;
      matching.forEach(function (p, i) {
        if (i < limit) p.classList.remove('gallery-hidden');
      });

      if (!gExpanded && matching.length > limit) {
        gMoreWrap.hidden = false;
      } else {
        gMoreWrap.hidden = true;
      }
    }

    gtabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        gtabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        gCurrentCat = tab.getAttribute('data-cat');
        gExpanded = false;
        gRender();
      });
    });

    if (gMoreBtn) {
      gMoreBtn.addEventListener('click', function () {
        gExpanded = true;
        gRender();
      });
    }

    var gResizeTimer = null;
    window.addEventListener('resize', function () {
      if (gExpanded) return;
      clearTimeout(gResizeTimer);
      gResizeTimer = setTimeout(gRender, 150);
    });

    gRender();
  }

  /* ---------- Lightbox (build pages only; no-ops elsewhere) ---------- */
  var photos = Array.prototype.slice.call(document.querySelectorAll('.photo'));
  if (photos.length) {
    var lb = document.getElementById('lightbox');
    var lbImg = document.getElementById('lightbox-img');
    var lbCap = document.getElementById('lightbox-cap');
    var lbCount = document.getElementById('lightbox-count');
    var current = 0;
    var touchStartX = null;

    function show(i) {
      current = (i + photos.length) % photos.length;
      var img = photos[current].querySelector('img');
      var cap = photos[current].querySelector('.cap');
      lbImg.src = img.src;
      lbImg.alt = img.alt || '';
      lbCap.textContent = cap ? cap.textContent : '';
      lbCount.textContent = (current + 1) + ' / ' + photos.length;
    }
    function open(i) {
      show(i);
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
    }
    function close() {
      lb.hidden = true;
      document.body.style.overflow = '';
    }

    photos.forEach(function (btn, i) {
      btn.addEventListener('click', function () { open(i); });
    });
    document.getElementById('lightbox-close').addEventListener('click', close);
    document.getElementById('lightbox-prev').addEventListener('click', function () { show(current - 1); });
    document.getElementById('lightbox-next').addEventListener('click', function () { show(current + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });

    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(current - 1);
      else if (e.key === 'ArrowRight') show(current + 1);
    });

    lb.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (touchStartX === null) return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) { dx < 0 ? show(current + 1) : show(current - 1); }
      touchStartX = null;
    }, { passive: true });
  }
})();
