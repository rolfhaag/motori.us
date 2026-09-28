/*
  qr.js — motori.us share-QR sticker-card generator.
  Builds a single self-contained SVG: a QR code (error-correction level H)
  encoding the page's canonical URL, with the motori.us "m" mark embedded
  in the center, the build/builder name below it, and a small wordmark
  caption — used both for the on-screen modal preview and the downloadable
  .svg file (same DOM node, so what you see is what you get).
*/
(function () {
  'use strict';

  var LOGO_DATA_URI = 'data:image/png;base64,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';

  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) {
      n.setAttribute(k, attrs[k]);
    }
    return n;
  }

  // Measures text width using an offscreen canvas so the name heading can
  // shrink to fit rather than overflow the card.
  var measureCtx = null;
  function textWidth(text, fontSize, fontWeight, fontFamily) {
    if (!measureCtx) {
      var c = document.createElement('canvas');
      measureCtx = c.getContext('2d');
    }
    measureCtx.font = fontWeight + ' ' + fontSize + 'px ' + fontFamily;
    return measureCtx.measureText(text).width;
  }

  function fitNameSize(name, maxWidth, maxSize, minSize, fontWeight, fontFamily) {
    var size = maxSize;
    while (size > minSize && textWidth(name, size, fontWeight, fontFamily) > maxWidth) {
      size -= 1;
    }
    return size;
  }

  /**
   * Builds the sticker-card SVG element.
   * opts: { url: string, name: string }
   * Returns the <svg> element (not yet attached to the document).
   */
  function buildShareSVG(opts) {
    var url = opts.url;
    var name = opts.name || '';

    var qr = window.qrcode(0, 'H'); // type 0 = auto version, H = 30% error correction
    qr.addData(url);
    qr.make();
    var moduleCount = qr.getModuleCount();

    var cellSize = 8;
    var margin = 4; // quiet zone, in modules
    var qrActive = moduleCount * cellSize;
    var qrPanel = qrActive + margin * 2 * cellSize;

    var padOuter = 36;
    var gapAfterQr = 26;
    var nameMaxSize = 32;
    var nameMinSize = 16;
    var brandSize = 15;
    var gapAfterName = 10;
    var bottomPad = 28;

    var fontFamily = '-apple-system, BlinkMacSystemFont, "Source Sans 3", Helvetica, Arial, sans-serif';
    var nameWeight = '700';
    var maxTextWidth = qrPanel; // name can use the same width as the QR panel

    var nameSize = name ? fitNameSize(name, maxTextWidth, nameMaxSize, nameMinSize, nameWeight, fontFamily) : 0;
    var nameBlockHeight = name ? (nameSize + gapAfterName) : 0;

    var cardWidth = qrPanel + padOuter * 2;
    var cardHeight = padOuter + qrPanel + gapAfterQr + nameBlockHeight + brandSize + bottomPad;

    var svg = el('svg', {
      xmlns: NS,
      viewBox: '0 0 ' + cardWidth + ' ' + cardHeight,
      width: cardWidth,
      height: cardHeight,
      role: 'img',
      'aria-label': 'QR code linking to ' + url + (name ? (' — ' + name) : '')
    });

    // Outer card background.
    svg.appendChild(el('rect', {
      x: 0, y: 0, width: cardWidth, height: cardHeight,
      rx: 24, ry: 24,
      fill: '#F3EEDF',
      stroke: '#A6822F',
      'stroke-width': 2
    }));

    // Quiet-zone panel behind the QR (plain corners — rounding could clip
    // modules right at the edge).
    var panelX = padOuter;
    var panelY = padOuter;
    svg.appendChild(el('rect', {
      x: panelX, y: panelY, width: qrPanel, height: qrPanel,
      fill: '#FFFFFF'
    }));

    // QR modules, pure black — never tinted, for maximum scan reliability.
    var qrX = panelX + margin * cellSize;
    var qrY = panelY + margin * cellSize;
    var modulesGroup = el('g', { fill: '#000000' });
    for (var row = 0; row < moduleCount; row++) {
      for (var col = 0; col < moduleCount; col++) {
        if (qr.isDark(row, col)) {
          modulesGroup.appendChild(el('rect', {
            x: qrX + col * cellSize,
            y: qrY + row * cellSize,
            width: cellSize,
            height: cellSize
          }));
        }
      }
    }
    svg.appendChild(modulesGroup);

    // Embedded logo with a white halo so it reads clearly against the
    // surrounding modules.
    var logoSize = Math.round(qrActive * 0.22);
    var haloSize = logoSize + 14;
    var cx = panelX + qrPanel / 2;
    var cy = panelY + qrPanel / 2;
    svg.appendChild(el('rect', {
      x: cx - haloSize / 2, y: cy - haloSize / 2,
      width: haloSize, height: haloSize,
      rx: 10, ry: 10,
      fill: '#FFFFFF'
    }));
    var logoImg = el('image', {
      x: cx - logoSize / 2, y: cy - logoSize / 2,
      width: logoSize, height: logoSize
    });
    logoImg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', LOGO_DATA_URI);
    logoImg.setAttribute('href', LOGO_DATA_URI);
    svg.appendChild(logoImg);

    // Build/builder name heading.
    var yCursor = panelY + qrPanel + gapAfterQr;
    if (name) {
      var nameText = el('text', {
        x: cardWidth / 2,
        y: yCursor + nameSize * 0.8,
        'text-anchor': 'middle',
        'font-family': fontFamily,
        'font-weight': nameWeight,
        'font-size': nameSize,
        fill: '#17140F'
      });
      nameText.textContent = name;
      svg.appendChild(nameText);
      yCursor += nameBlockHeight;
    }

    // "motori.us" wordmark caption, matching the live header treatment:
    // "motori" in ink, "." in gold, "us" in ink.
    var brandText = el('text', {
      x: cardWidth / 2,
      y: yCursor + brandSize * 0.8,
      'text-anchor': 'middle',
      'font-family': fontFamily,
      'font-weight': '700',
      'font-size': brandSize,
      'letter-spacing': '0.02em'
    });
    var tspan1 = el('tspan', { fill: '#17140F' });
    tspan1.textContent = 'motori';
    var tspan2 = el('tspan', { fill: '#A6822F' });
    tspan2.textContent = '.';
    var tspan3 = el('tspan', { fill: '#17140F' });
    tspan3.textContent = 'us';
    brandText.appendChild(tspan1);
    brandText.appendChild(tspan2);
    brandText.appendChild(tspan3);
    svg.appendChild(brandText);

    return svg;
  }

  window.motoriQR = { buildShareSVG: buildShareSVG };
})();
