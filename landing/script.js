(function () {
  'use strict';

  // Valeurs par défaut des props (pas d'éditeur derrière ce site final)
  var PRIMARY_CTA_PREFIX = 'Télécharger pour';
  var VERSION_LINE = 'version 1.4 · gratuit et open source';

  // Seuls Windows (desktop) et Android (mobile) sont disponibles pour
  // l'instant — macOS, Linux et iOS affichent un bouton désactivé
  // "<plateforme> arrive bientôt" plutôt qu'un faux lien de téléchargement.
  var AVAILABLE_OS = { win: true, android: true, mac: false, linux: false, ios: false };

  function detectOS() {
    var ua = navigator.userAgent || '';
    var platform = navigator.platform || '';
    if (/Windows/i.test(ua)) return 'win';
    if (/Android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    // iPad récent : Safari annonce un UA "Macintosh" classique, seul le
    // support tactile trahit qu'il s'agit d'iPadOS et non de macOS.
    if (/Mac/i.test(platform) && navigator.maxTouchPoints > 1) return 'ios';
    if (/Linux/i.test(ua)) return 'linux';
    if (/Mac/i.test(ua)) return 'mac';
    return 'win';
  }

  function osLabel(os) {
    if (os === 'win') return 'Windows';
    if (os === 'linux') return 'Linux';
    if (os === 'android') return 'Android';
    if (os === 'ios') return 'iOS';
    return 'macOS';
  }

  function applyOS() {
    var os = detectOS();
    var label = osLabel(os);
    var available = !!AVAILABLE_OS[os];

    var ctaEls = document.querySelectorAll('.js-primary-cta');
    for (var i = 0; i < ctaEls.length; i++) {
      var el = ctaEls[i];
      if (available) {
        el.textContent = PRIMARY_CTA_PREFIX + ' ' + label;
      } else {
        el.textContent = label + ' arrive bientôt';
        el.classList.add('btn-disabled');
        el.removeAttribute('href');
        el.setAttribute('aria-disabled', 'true');
        el.setAttribute('tabindex', '-1');
      }
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
