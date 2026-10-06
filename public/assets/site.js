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

  /* ---------- Share (opens a modal with QR + copy-link + download) ---------- */
  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
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
  }

  function openShareModal(url, name) {
    var overlay = document.createElement('div');
    overlay.className = 'share-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    var card = document.createElement('div');
    card.className = 'share-modal-card';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'share-modal-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';

    var title = document.createElement('p');
    title.className = 'share-modal-title';
    title.textContent = name ? ('Share ' + name) : 'Share this page';

    card.appendChild(closeBtn);
    card.appendChild(title);

    var svg = null;
    try {
      svg = window.motoriQR.buildShareSVG({ url: url, name: name });
      svg.classList.add('share-modal-qr');
      card.appendChild(svg);
    } catch (e) {
      var fallback = document.createElement('p');
      fallback.className = 'share-modal-hint';
      fallback.textContent = 'QR code unavailable — you can still copy the link below.';
      card.appendChild(fallback);
    }

    var actions = document.createElement('div');
    actions.className = 'share-modal-actions';

    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy link';

    var downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.textContent = 'Download SVG';
    if (!svg) downloadBtn.disabled = true;

    actions.appendChild(copyBtn);
    actions.appendChild(downloadBtn);
    card.appendChild(actions);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    // Lets logged-in owners' tooling (React, see OwnerShareKit) add to the card.
    try {
      document.dispatchEvent(new CustomEvent('motori:share-open', { detail: { url: url, name: name, card: card } }));
    } catch (e) {}

    var copyResetTimer = null;
    copyBtn.addEventListener('click', function () {
      clearTimeout(copyResetTimer);
      copyText(url, function (ok) {
        copyBtn.textContent = ok ? 'Link copied!' : 'Copy failed';
        copyBtn.classList.toggle('copied', ok);
        copyResetTimer = setTimeout(function () {
          copyBtn.textContent = 'Copy link';
          copyBtn.classList.remove('copied');
        }, 1800);
      });
    });

    downloadBtn.addEventListener('click', function () {
      if (!svg) return;
      var serializer = new XMLSerializer();
      var svgString = serializer.serializeToString(svg);
      if (svgString.indexOf('xmlns=') === -1) {
        svgString = svgString.replace('<svg', '<svg xmlns="' + NS_SVG + '"');
      }
      var blob = new Blob([svgString], { type: 'image/svg+xml' });
      var blobUrl = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var slug = (name || 'motori-us-share').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      a.href = blobUrl;
      a.download = (slug || 'motori-us-share') + '-qr.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 1000);
    });

    function close() {
      document.removeEventListener('keydown', onKeydown);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    function onKeydown(e) {
      if (e.key === 'Escape') close();
    }
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', onKeydown);
  }

  var NS_SVG = 'http://www.w3.org/2000/svg';
  window.motoriOpenShare = openShareModal; // used by the Builder dashboard's Share button

  document.querySelectorAll('[data-share-url]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openShareModal(btn.getAttribute('data-share-url'), btn.getAttribute('data-share-name') || '');
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
