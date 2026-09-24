// Page state, binding and actions.
(function () {
  var C = window.CREDX_CONFIG, X = window.CredXCalc;
  var $ = function (id) { return document.getElementById(id); };
  var DASH = '-';
  var BROKER_KEY = 'credx.broker';

  var OPTIONS = {
    btype: ['Individual', 'UK Limited Company', 'SPV', 'Other'],
    purpose: ['Purchase', 'Refinance', 'Capital raise', 'Other'],
    exit: ['Sale', 'Refinance', 'Other'],
    term: C.terms.map(function (t) { return { value: t.months, label: t.months + ' months' }; }),
    type: ['Residential', 'Commercial', 'Mixed use', 'Land'],
    tenure: ['Freehold', 'Leasehold'],
    charge: [{ value: '1st', label: '1st charge' }, { value: '2nd', label: '2nd charge' }],
  };
  var SEG_PATH = { btype: 'borrower.type', purpose: 'borrower.purpose', exit: 'borrower.exitType', term: 'term' };

  function loadBroker() {
    var blank = { name: '', firm: '', email: '', phone: '', fca: '' };
    try { var b = JSON.parse(localStorage.getItem(BROKER_KEY) || 'null'); return b ? Object.assign(blank, b) : blank; } catch (e) { return blank; }
  }
  function saveBroker() { try { localStorage.setItem(BROKER_KEY, JSON.stringify(state.broker)); } catch (e) { /* storage unavailable */ } }

  var state = Object.assign({ broker: loadBroker(), copied: '' }, X.exampleDeal(C));
  var copyTimer = null;

  // ----- state helpers -----
  function get(path) { return path.split('.').reduce(function (o, k) { return o[k]; }, state); }
  function assignPath(path, v) {
    var keys = path.split('.'), last = keys.pop();
    var o = keys.reduce(function (o, k) { return o[k]; }, state);
    o[last] = v;
  }
  // Every deal edit clears the "example" and "submitted" markers.
  function upd(fn) { fn(); state.isExample = false; state.submitted = false; render(); }
  function secById(id) { return state.secs.find(function (x) { return x.id === id; }); }

  // ----- segmented buttons -----
  function renderSeg(el, options, current) {
    var opts = options.map(function (o) { return typeof o === 'object' ? o : { value: o, label: o }; });
    if (el.children.length !== opts.length) {
      el.innerHTML = '';
      opts.forEach(function (o) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = o.label; b.dataset.value = String(o.value);
        el.appendChild(b);
      });
    }
    Array.prototype.forEach.call(el.children, function (b, i) { b.setAttribute('aria-pressed', String(opts[i].value === current)); });
  }
  function segValue(key, raw) { return key === 'term' ? Number(raw) : raw; }

  // ----- securities -----
  var secSignature = '';
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function moneyField(label, key, value) {
    return '<label class="field"><span class="lbl">' + label + '</span><span class="money"><span>£</span>' +
      '<input inputmode="decimal" data-sec="' + key + '" data-money value="' + esc(value) + '" placeholder="0.00"></span></label>';
  }
  function textField(label, key, value, cls) {
    return '<label class="field' + (cls ? ' ' + cls : '') + '"><span class="lbl">' + label + '</span>' +
      '<input class="input' + (key === 'postcode' ? ' upper' : '') + '" data-sec="' + key + '" value="' + esc(value) + '"></label>';
  }
  function buildSecs(k) {
    var list = $('secList'), many = state.secs.length > 1;
    list.innerHTML = state.secs.map(function (x, i) {
      return '<div class="sec-card" data-id="' + x.id + '" role="group" aria-label="Security ' + (i + 1) + '">' +
        '<div class="top"><span>Security ' + (i + 1) + '</span>' +
          (many ? '<button type="button" class="btn btn-xs" data-remove>Remove</button>' : '') + '</div>' +
        '<div class="fields sm">' + textField('Address', 'address', x.address, 'full') + textField('Postcode', 'postcode', x.postcode) + '</div>' +
        '<div class="field"><span class="lbl">Property type</span><div class="seg" data-secseg="type"></div></div>' +
        '<div class="seg-row">' +
          '<div class="field"><span class="lbl">Tenure</span><div class="seg" data-secseg="tenure"></div></div>' +
          '<div class="field"><span class="lbl">Charge position</span><div class="seg" data-secseg="charge"></div></div>' +
        '</div>' +
        '<div class="fields sm">' + moneyField('Market value', 'mv', x.mv) + (k.isPurchase ? moneyField('Purchase price', 'pp', x.pp) : '') + '</div>' +
        (x.charge === '2nd' ? '<div class="fields sm">' + textField('Existing first charge lender', 'firstLender', x.firstLender) +
          moneyField('Outstanding balance', 'firstBalance', x.firstBalance) + '</div>' : '') +
        '<div class="ltv-line"><span data-ltvbasis></span><span data-ltvvalue></span></div>' +
      '</div>';
    }).join('');
  }
  function renderSecs(k) {
    var sig = JSON.stringify([k.isPurchase, state.secs.map(function (x) { return [x.id, x.charge]; })]);
    if (sig !== secSignature) { buildSecs(k); secSignature = sig; }
    var basis = 'Value used for LTV ' + (k.isPurchase ? '(lower of purchase price and market value)' : '(market value)');
    k.secs.forEach(function (x) {
      var card = $('secList').querySelector('[data-id="' + x.id + '"]');
      ['type', 'tenure', 'charge'].forEach(function (key) { renderSeg(card.querySelector('[data-secseg="' + key + '"]'), OPTIONS[key], x[key]); });
      card.querySelector('[data-ltvbasis]').textContent = basis;
      card.querySelector('[data-ltvvalue]').textContent = X.gbp(x.ltvValue);
    });
  }

  // ----- inputs -----
  function syncInputs() {
    document.querySelectorAll('[data-bind]').forEach(function (el) {
      var v = get(el.dataset.bind);
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    });
    secSignature = '';
  }

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.dataset.bind) {
      var path = el.dataset.bind, v = el.type === 'checkbox' ? el.checked : el.value;
      if (path === 'commentary') { state.commentary = v; state.submitted = false; render(); return; }
      upd(function () { assignPath(path, v); });
      if (path.indexOf('broker.') === 0) saveBroker();
    } else if (el.dataset.sec) {
      var id = Number(el.closest('[data-id]').dataset.id), key = el.dataset.sec, val = el.value;
      upd(function () { secById(id)[key] = val; });
    }
  });
  // Checkboxes fire "change" rather than "input" in some browsers.
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.type === 'checkbox' && el.dataset.bind) upd(function () { assignPath(el.dataset.bind, el.checked); });
  });

  // Format money fields to 2dp on blur.
  document.addEventListener('focusout', function (e) {
    var el = e.target;
    if (!el.hasAttribute || !el.hasAttribute('data-money') || String(el.value).trim() === '') return;
    var formatted = X.plain(X.num(el.value));
    el.value = formatted;
    if (el.dataset.bind) { state.net = formatted; render(); }
    else { secById(Number(el.closest('[data-id]').dataset.id))[el.dataset.sec] = formatted; render(); }
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    var seg = btn.parentElement;
    if (seg && seg.dataset.seg) {
      var key = seg.dataset.seg, v = segValue(key, btn.dataset.value);
      upd(function () { assignPath(SEG_PATH[key], v); });
    } else if (seg && seg.dataset.secseg) {
      var id = Number(btn.closest('[data-id]').dataset.id), skey = seg.dataset.secseg, sv = btn.dataset.value;
      upd(function () { secById(id)[skey] = sv; });
    } else if (btn.hasAttribute('data-remove')) {
      var rid = Number(btn.closest('[data-id]').dataset.id);
      upd(function () { state.secs = state.secs.filter(function (y) { return y.id !== rid; }); });
      $('addSec').focus();
    }
  });

  // ----- actions -----
  function resetTo(deal) {
    Object.assign(state, deal, { copied: '' });
    syncInputs(); render();
  }
  $('clearDeal').addEventListener('click', function () { resetTo(X.blankDeal(C)); });
  $('loadExample').addEventListener('click', function () { resetTo(X.exampleDeal(C)); });
  $('addSec').addEventListener('click', function () {
    upd(function () { state.secs.push(X.blankSec(state.nextId)); state.nextId += 1; });
    var cards = $('secList').querySelectorAll('[data-id]');
    cards[cards.length - 1].querySelector('input').focus();
  });
  $('maximise').addEventListener('click', function () {
    var k = X.calc(state, C);
    if (k.maxNet <= 0) return;
    upd(function () { state.net = X.plain(k.maxNet); });
    document.querySelector('[data-bind="net"]').value = state.net;
  });
  $('printQuote').addEventListener('click', function () {
    var t = document.title;
    document.title = 'CredX Indicative Quote ' + state.ref;
    window.print();
    setTimeout(function () { document.title = t; }, 500);
  });

  function copy(text, key) {
    var done = function () {
      state.copied = key; render();
      clearTimeout(copyTimer);
      copyTimer = setTimeout(function () { state.copied = ''; render(); }, 1800);
    };
    var fallback = function () {
      var t = document.createElement('textarea');
      t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      t.remove(); done();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  function submissionText(k) { return 'To: ' + C.submitEmail + '\nSubject: ' + X.subject(k) + '\n\n' + X.quoteText(k, state, true); }

  $('copySummary').addEventListener('click', function () { copy(X.quoteText(X.calc(state, C), state, false), 'summary'); });
  $('copySubmission').addEventListener('click', function () { copy(submissionText(X.calc(state, C)), 'submission'); });
  $('copyEmail').addEventListener('click', function () { copy(C.submitEmail, 'email'); });
  $('submitDeal').addEventListener('click', function () {
    var k = X.calc(state, C);
    if (X.blockers(k, state).length) return;
    var a = document.createElement('a');
    a.href = 'mailto:' + C.submitEmail + '?subject=' + encodeURIComponent(X.subject(k)) + '&body=' + encodeURIComponent(X.quoteText(k, state, true));
    document.body.appendChild(a); a.click(); a.remove();
    state.submitted = true; render();
  });

  // ----- render -----
  function text(id, v) { $(id).textContent = v; }
  function show(id, on) { $(id).hidden = !on; }
  function ltvClass(k) { var l = X.ltvLevel(k.ltv, C); return l === 'amber' ? 'amber-text' : l === 'flag' ? 'red-text' : ''; }
  function bullets(el, items) {
    el.innerHTML = items.map(function (t) { return '<div class="bullet"><span>' + esc(t) + '</span></div>'; }).join('');
  }

  function render() {
    var s = state, b = s.borrower, k = X.calc(s, C);
    var g = function (v) { return k.hasNet ? X.gbp(v) : DASH; };

    show('exampleTag', s.isExample); show('loadExample', !s.isExample);
    show('worksFlag', b.works);

    Object.keys(SEG_PATH).forEach(function (key) {
      renderSeg(document.querySelector('[data-seg="' + key + '"]'), OPTIONS[key], get(SEG_PATH[key]));
    });
    renderSecs(k);

    // Structure
    text('termNote', 'Minimum ' + k.termObj.minInterest + ' months interest. Interest retained for the full term.');
    text('brokerFeeLabel', 'Include broker fee (' + X.pct(C.brokerPct) + ' of gross, deducted)');
    text('rGross', g(k.gross)); text('rNet', g(k.net));
    text('rLtv', k.ltv === null ? DASH : X.pct(k.ltv)); $('rLtv').className = ltvClass(k);
    text('rMaxLabel', k.maxGrossLTV > C.maxGross ? 'Max net (gross cap)' : 'Max net at ' + X.whole(C.maxLTV) + ' LTV');
    text('rMax', k.maxNet > 0 ? X.gbp(k.maxNet) : DASH);
    show('rMsg', k.totalValue > 0 && k.maxNet <= 0);

    // Quote
    text('qRef', s.ref); text('qDate', X.longDate());
    text('qBorrower', b.name || 'Not entered'); text('qBorrowerType', b.type || 'Type not selected');
    text('qPurpose', b.purpose || 'Not selected'); text('qExit', b.exitType || 'Not selected');
    $('qSecs').innerHTML = k.secs.map(function (x) {
      var addr = (x.address || 'Address not entered') + (x.postcode ? ', ' + x.postcode.toUpperCase() : '');
      return '<div class="q-sec"><div><span class="addr">' + esc(addr) + '</span>' +
        '<span class="muted">' + esc(x.type + ', ' + x.tenure + ', ' + x.charge + ' charge. Valued on ' + x.basis + '.') + '</span>' +
        (x.charge === '2nd' ? '<span class="muted">' + esc('Prior charge: ' + (x.firstLender || 'lender not entered') + ', ' + X.gbp(x.prior)) + '</span>' : '') +
        '</div><span>' + X.gbp(x.ltvValue) + '</span></div>';
    }).join('');
    text('qTotal', X.gbp(k.totalValue));
    show('qPriorRow', k.prior > 0); text('qPrior', X.gbp(k.prior));
    text('qGross', g(k.gross));
    text('qArrLabel', 'Less arrangement fee (' + X.pct(C.arrangementPct) + ' of gross)'); text('qArr', g(k.arr));
    show('qBrkRow', s.brokerOn);
    text('qBrkLabel', 'Less broker fee (' + X.pct(C.brokerPct) + ' of gross)'); text('qBrk', g(k.brk));
    text('qIntLabel', 'Less retained interest (' + X.pct(C.ratePA) + ' p.a. x ' + k.termObj.months + ' months)'); text('qInt', g(k.int));
    text('qSetup', g(k.setup)); text('qNet', g(k.net));
    text('qRate', X.pct(C.ratePA) + ' p.a. simple, retained');
    text('qTerm', k.termObj.months + ' months'); text('qMinInt', k.termObj.minInterest + ' months');
    text('qLtv', k.ltv === null ? DASH : X.pct(k.ltv) + ' (standard max ' + X.whole(C.maxLTV) + ')');
    $('qLtv').className = 'strong ' + ltvClass(k);
    text('qAppFee', X.gbp(C.applicationFee)); text('qRedemption', C.redemptionFee);
    text('qValuation', C.valuationFee); text('qLegal', C.legalFees);

    var crit = X.criteria(k, s);
    $('qCriteria').innerHTML = crit.map(function (c) {
      var lvl = c.ok ? 'pass' : c.level;
      var badge = lvl === 'pass' ? '<span class="badge">Pass</span>' : lvl === 'amber' ? '<span class="badge amber">Refer</span>' : '<span class="badge flag">Flag</span>';
      return '<div class="crit"><span><span>' + esc(c.label) + '</span><small class="' + (lvl === 'pass' ? '' : lvl) + '">' + esc(c.detail) + '</small></span>' + badge + '</div>';
    }).join('');
    bullets($('qDocs'), X.docs(k));

    // Propose
    var anyFlag = crit.some(function (c) { return !c.ok; });
    text('commentaryLabel', anyFlag ? 'Broker commentary (required: criteria flagged)' : 'Broker commentary');
    var blk = X.blockers(k, s);
    show('blockers', blk.length > 0); bullets($('blockerList'), blk);
    $('submitDeal').disabled = blk.length > 0;
    show('submitted', s.submitted);

    ['copySummary', 'copySubmission', 'copyEmail'].forEach(function (id) {
      var key = id === 'copySummary' ? 'summary' : id === 'copySubmission' ? 'submission' : 'email';
      text(id, s.copied === key ? 'Copied' : $(id).dataset.label);
    });
  }

  // ----- static config into the page -----
  text('submitEmail', C.submitEmail);
  document.querySelectorAll('.submit-email-text').forEach(function (el) { el.textContent = C.submitEmail; });
  $('footerEmail').textContent = C.submitEmail; $('footerEmail').href = 'mailto:' + C.submitEmail;
  $('formApp').href = C.forms.application; $('formSal').href = C.forms.sal;

  syncInputs();
  render();
})();
