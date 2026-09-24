// Pure deal maths, criteria checks, documents and quote text. No DOM.
(function (root) {
  function num(s) { var n = parseFloat(String(s == null ? '' : s).replace(/[^0-9.]/g, '')); return isFinite(n) ? n : 0; }
  function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function plain(n) { return (n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function gbp(n) { return '£' + plain(n); }
  function pct(n) { return (n * 100).toFixed(2) + '%'; }
  function whole(n) { return Math.round(n * 100) + '%'; }
  function longDate(d) { return (d || new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }

  function makeRef(d) {
    d = d || new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', x = '';
    for (var i = 0; i < 4; i++) x += abc[Math.floor(Math.random() * abc.length)];
    return 'CDX-IQ-' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + '-' + x;
  }

  function blankSec(id) { return { id: id, address: '', postcode: '', type: 'Residential', tenure: 'Freehold', mv: '', pp: '', charge: '1st', firstLender: '', firstBalance: '' }; }
  function blankDeal(C) {
    return {
      borrower: { name: '', type: '', purpose: '', exitType: '', exitDetail: '', occupancy: false, works: false },
      secs: [blankSec(1)], nextId: 2, net: '', term: C.defaultTerm, brokerOn: true,
      commentary: '', ref: makeRef(), submitted: false, isExample: false,
    };
  }
  function exampleDeal(C) {
    var d = blankDeal(C), s = blankSec(1);
    s.address = '1 Example Street, London'; s.postcode = 'SW1A 1AA'; s.mv = '400,000.00';
    d.borrower = { name: 'Example Holdings Ltd', type: 'UK Limited Company', purpose: 'Refinance', exitType: 'Refinance', exitDetail: 'Refinance onto a buy-to-let term loan within 12 months.', occupancy: true, works: false };
    d.secs = [s]; d.net = '200,000.00'; d.term = 12; d.brokerOn = true; d.isExample = true;
    return d;
  }

  function calc(s, C) {
    var termObj = C.terms.find(function (t) { return t.months === s.term; }) || C.terms[0];
    var bp = s.brokerOn ? C.brokerPct : 0;
    var df = 1 - C.arrangementPct - bp - C.ratePA * termObj.months / 12;
    var netIn = num(s.net), hasNet = netIn > 0;
    var gross = hasNet ? r2((netIn + C.setupFee) / df) : 0;
    var arr = r2(gross * C.arrangementPct), brk = r2(gross * bp);
    var int = r2(gross * C.ratePA * termObj.months / 12);
    var setup = hasNet ? C.setupFee : 0;
    var net = r2(gross - arr - brk - int - setup);
    var isPurchase = s.borrower.purpose === 'Purchase';
    var secs = s.secs.map(function (x) {
      var mv = num(x.mv), pp = isPurchase ? num(x.pp) : 0;
      var ltvValue = pp > 0 ? Math.min(pp, mv) : mv;
      var prior = x.charge === '2nd' ? num(x.firstBalance) : 0;
      return Object.assign({}, x, { mvN: mv, ppN: pp, ltvValue: ltvValue, prior: prior, basis: pp > 0 && pp <= mv ? 'purchase price' : 'market value' });
    });
    var totalValue = secs.reduce(function (a, x) { return a + x.ltvValue; }, 0);
    var prior = secs.reduce(function (a, x) { return a + x.prior; }, 0);
    var ltv = totalValue > 0 && hasNet ? (gross + prior) / totalValue : null;
    var maxGrossLTV = C.maxLTV * totalValue - prior;
    var maxGross = Math.min(maxGrossLTV, C.maxGross);
    var maxNet = totalValue > 0 ? Math.floor(maxGross * df - C.setupFee) : 0;
    return { C: C, termObj: termObj, bp: bp, df: df, hasNet: hasNet, gross: gross, arr: arr, brk: brk, int: int, setup: setup, net: net,
      secs: secs, totalValue: totalValue, prior: prior, ltv: ltv, maxNet: maxNet, isPurchase: isPurchase, maxGrossLTV: maxGrossLTV };
  }

  function ltvLevel(ltv, C) {
    if (ltv === null || ltv <= C.maxLTV + 1e-9) return 'pass';
    return ltv <= C.hardLTV + 1e-9 ? 'amber' : 'flag';
  }

  function criteria(k, s) {
    var C = k.C, b = s.borrower;
    var lvl = ltvLevel(k.ltv, C), ltvOk = k.ltv !== null && lvl === 'pass';
    var ltvDetail = k.ltv === null ? 'Not calculated' : ltvOk ? pct(k.ltv)
      : lvl === 'amber' ? pct(k.ltv) + '. Above ' + whole(C.maxLTV) + ' standard, within ' + whole(C.hardLTV) + ' limit'
      : pct(k.ltv) + '. Above ' + whole(C.hardLTV) + ' maximum';
    var grossOk = k.hasNet && k.gross >= C.minGross && k.gross <= C.maxGross;
    var exitOk = !!b.exitType && b.exitDetail.trim().length > 0;
    return [
      { label: 'LTV at or below ' + whole(C.maxLTV), detail: ltvDetail, ok: ltvOk, level: ltvOk ? 'pass' : lvl === 'amber' ? 'amber' : 'flag' },
      { label: 'Gross loan between ' + gbp(C.minGross) + ' and ' + gbp(C.maxGross), detail: k.hasNet ? gbp(k.gross) : 'Not calculated', ok: grossOk },
      { label: 'Occupancy declaration given', detail: b.occupancy ? 'Given' : 'Not given', ok: b.occupancy },
      { label: 'No works funding requested', detail: b.works ? 'Works requested. CredX does not fund works.' : 'Acquisition only', ok: !b.works },
      { label: 'Exit strategy provided', detail: exitOk ? b.exitType : 'Exit type and detail required', ok: exitOk },
    ].map(function (c) { if (!c.level) c.level = c.ok ? 'pass' : 'flag'; return c; });
  }

  function docs(k) {
    var types = new Set(k.secs.map(function (x) { return x.type; }));
    var res = types.has('Residential') || types.has('Mixed use');
    var com = types.has('Commercial') || types.has('Mixed use');
    var d = ['All borrowers: certified photo ID', 'All borrowers: two certified proofs of address dated within the last 3 months', 'All borrowers: Statement of Assets and Liabilities'];
    if (res) d.push('Residential security: EPC rated E or above', 'Residential security: gas safety certificate');
    if (com) d.push('Commercial security: fire risk assessment', 'Commercial security: asbestos report');
    d.push('Valuation: desktop valuation in the first instance, full RICS inspection at CredX discretion, surveyor fee paid by borrower');
    return d;
  }

  function blockers(k, s) {
    var C = k.C, r = s.broker, bw = s.borrower, out = [];
    var anyFlag = criteria(k, s).some(function (c) { return !c.ok; });
    if (!bw.occupancy) out.push('Tick the occupancy declaration. CredX only does unregulated lending.');
    if (!r.name.trim() || !r.firm.trim() || !r.email.trim() || !r.phone.trim()) out.push('Complete your broker details: name, firm, email and phone.');
    if (!bw.name.trim()) out.push('Enter the borrower name.');
    if (!bw.exitType || !bw.exitDetail.trim()) out.push('Select an exit strategy and give the exit detail.');
    if (!k.secs.some(function (x) { return x.address.trim() && x.ltvValue > 0; })) out.push('Enter at least one security with an address and value.');
    if (!k.hasNet) out.push('Enter the net advance required.');
    if (k.ltv !== null && k.ltv > C.hardLTV + 1e-9) out.push('Reduce the loan. LTV is above the ' + whole(C.hardLTV) + ' maximum.');
    if (anyFlag && !s.commentary.trim()) out.push('Add broker commentary. It is required when any criteria check shows Flag.');
    return out;
  }

  function firstAddress(k) { return (k.secs[0] && k.secs[0].address.trim()) || 'Address not entered'; }
  function subject(k) { return 'Broker submission | ' + firstAddress(k) + ' | Gross ' + gbp(k.gross); }

  function quoteText(k, s, full, date) {
    var b = s.borrower, C = k.C, L = [];
    L.push('CREDX INDICATIVE QUOTE', 'Reference: ' + s.ref, 'Date: ' + longDate(date), '');
    if (full) {
      var r = s.broker;
      L.push('BROKER', 'Name: ' + r.name, 'Firm: ' + r.firm, 'Email: ' + r.email, 'Phone: ' + r.phone, 'FCA number: ' + (r.fca || 'Not provided'), '');
    }
    L.push('BORROWER', 'Name: ' + (b.name || 'Not entered'), 'Type: ' + (b.type || 'Not selected'), 'Loan purpose: ' + (b.purpose || 'Not selected'),
      'Exit strategy: ' + (b.exitType || 'Not selected') + (b.exitDetail.trim() ? '. ' + b.exitDetail.trim() : ''),
      'Occupancy declaration: ' + (b.occupancy ? 'Given' : 'NOT GIVEN'), 'Refurbishment or build costs requested: ' + (b.works ? 'Yes' : 'No'), '');
    L.push('SECURITIES');
    k.secs.forEach(function (x, i) {
      L.push((i + 1) + '. ' + (x.address || 'Address not entered') + (x.postcode ? ', ' + x.postcode.toUpperCase() : ''));
      L.push('   ' + x.type + ', ' + x.tenure + ', ' + x.charge + ' charge');
      L.push('   Market value ' + gbp(x.mvN) + (k.isPurchase && x.ppN > 0 ? '; Purchase price ' + gbp(x.ppN) : '') + '; Value for LTV ' + gbp(x.ltvValue));
      if (x.charge === '2nd') L.push('   Existing first charge: ' + (x.firstLender || 'Lender not entered') + ', balance ' + gbp(x.prior));
    });
    L.push('Total security value: ' + gbp(k.totalValue));
    if (k.prior > 0) L.push('Total prior charges: ' + gbp(k.prior));
    L.push('', 'FIGURES', 'Gross loan: ' + gbp(k.gross), 'Arrangement fee (' + pct(C.arrangementPct) + '): ' + gbp(k.arr));
    if (s.brokerOn) L.push('Broker fee (' + pct(C.brokerPct) + '): ' + gbp(k.brk));
    L.push('Retained interest (' + pct(C.ratePA) + ' p.a., ' + k.termObj.months + ' months): ' + gbp(k.int), 'Loan setup fee: ' + gbp(k.setup),
      'Net advance: ' + gbp(k.net), 'Interest rate: ' + pct(C.ratePA) + ' per annum, simple, retained', 'Term: ' + k.termObj.months + ' months',
      'Minimum interest period: ' + k.termObj.minInterest + ' months', 'LTV: ' + (k.ltv === null ? 'Not calculated' : pct(k.ltv)),
      'Application fee: ' + gbp(C.applicationFee) + ' (paid upfront, non-refundable, not deducted)', 'Redemption fee: ' + C.redemptionFee,
      'Valuation fee: ' + C.valuationFee, 'Lender legal fees: ' + C.legalFees, '', 'CRITERIA CHECKS');
    criteria(k, s).forEach(function (c) {
      L.push('- ' + c.label + ': ' + (c.ok ? 'Pass' : c.level === 'amber' ? 'Refer, OUTSIDE STANDARD CRITERIA' : 'Flag, OUTSIDE STANDARD CRITERIA') + ' (' + c.detail + ')');
    });
    L.push('', 'DOCUMENTS REQUIRED'); docs(k).forEach(function (d) { L.push('- ' + d); });
    if (full) L.push('', 'BROKER COMMENTARY', s.commentary.trim() || 'None provided');
    L.push('', 'Indicative only. This is not an offer of finance or a Decision in Principle. All lending is subject to underwriting, valuation, legal due diligence and CredX credit approval. CredX provides unregulated bridging finance only. CredX Ltd, Company No. 16640225.');
    return L.join('\n');
  }

  var api = { num: num, r2: r2, plain: plain, gbp: gbp, pct: pct, whole: whole, longDate: longDate, makeRef: makeRef,
    blankSec: blankSec, blankDeal: blankDeal, exampleDeal: exampleDeal, calc: calc, ltvLevel: ltvLevel, criteria: criteria,
    docs: docs, blockers: blockers, subject: subject, quoteText: quoteText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CredXCalc = api;
})(this);
