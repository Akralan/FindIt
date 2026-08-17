(function () {
  'use strict';

  // Valeurs par défaut des props (pas d'éditeur derrière ce site final)
  var PRIMARY_CTA_PREFIX = 'Télécharger pour';
  var VERSION_LINE = 'version 1.4 · gratuit et open source';

  function detectOS() {
    var ua = navigator.userAgent || '';
    if (/Windows/i.test(ua)) return 'win';
    if (/Linux/i.test(ua) && !/Android/i.test(ua)) return 'linux';
    return 'mac';
  }

  function osLabel(os) {
    if (os === 'win') return 'Windows';
    if (os === 'linux') return 'Linux';
    return 'macOS';
  }

  function applyOS() {
    var os = detectOS();
    var label = osLabel(os);
    var ctaText = PRIMARY_CTA_PREFIX + ' ' + label;

    var ctaEls = document.querySelectorAll('.js-primary-cta');
    for (var i = 0; i < ctaEls.length; i++) {
      ctaEls[i].textContent = ctaText;
    }
  }

  function applyVersionLine() {
    var versionEl = document.querySelector('.js-version-line');
    if (versionEl) versionEl.textContent = VERSION_LINE;
  }

  function startTypingAnimation() {
    var target = document.querySelector('.js-typed-query');
    if (!target) return;
    var full = 'assurance voiture 2026';
    var i = 0;
    target.textContent = '';
    var timer = setInterval(function () {
      i += 1;
      target.textContent = full.slice(0, i);
      if (i >= full.length) {
        clearInterval(timer);
      }
    }, 70);
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyOS();
    applyVersionLine();
    startTypingAnimation();
  });
})();
