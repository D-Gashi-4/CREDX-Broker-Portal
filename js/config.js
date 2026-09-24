// ===== CredX pricing and settings: edit here =====
(function (root) {
  var CONFIG = {
    ratePA: 0.15,              // simple interest per annum on gross, retained for full term
    arrangementPct: 0.02,      // of gross, deducted
    brokerPct: 0.01,           // of gross, deducted when broker fee is on
    setupFee: 1495,            // deducted
    applicationFee: 495,       // paid upfront by borrower, non-refundable, not deducted
    maxLTV: 0.70,              // standard max, on gross facility plus prior charges (Maximise loan uses this)
    hardLTV: 0.75,             // above maxLTV up to this shows orange; above this shows red and blocks submission
    amberColor: '#B45309',
    redColor: '#C62828',
    minGross: 30000,
    maxGross: 750000,
    terms: [{ months: 6, minInterest: 3 }, { months: 12, minInterest: 6 }],
    defaultTerm: 12,
    redemptionFee: 'Confirmed in DIP',
    valuationFee: 'TBC, paid by borrower',
    legalFees: 'TBC, paid by borrower',
    submitEmail: 'dg@credx.co.uk',
    forms: { application: 'assets/forms/CredX_Application_Form.pdf', sal: 'assets/forms/CredX_Statement_of_Assets_and_Liabilities.docx' },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
  else root.CREDX_CONFIG = CONFIG;
})(this);
