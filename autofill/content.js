(function(){
  // Utilities: events, width conversions, formatting, and requirement inference
  function dispatchInput(el){
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setValue(el, value){
    if (el.tagName === 'SELECT') {
      el.value = value;
      dispatchInput(el);
    } else if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = Boolean(value);
      dispatchInput(el);
    } else {
      el.value = value;
      dispatchInput(el);
    }
  }

  // Convert full-width numerals/symbols to half-width ASCII
  function toHalfWidth(str){
    if (str == null) return str;
    return String(str).replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
                      .replace(/　/g, ' ');
  }

  // Convert half-width numerals/hyphen to full-width
  function toFullWidthDigits(str){
    if (str == null) return str;
    return String(str)
      .replace(/[0-9\-]/g, ch =>
        ({
          '0':'０','1':'１','2':'２','3':'３','4':'４','5':'５','6':'６','7':'７','8':'８','9':'９','-':'－'
        })[ch] || ch
      );
  }

  function digitsOnly(str){
    return String(str || '').replace(/\D/g, '');
  }

  // Kana conversions
  function toKatakana(str){
    if (!str) return str;
    return str.replace(/[ぁ-ゖ]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  }
  function toHiragana(str){
    if (!str) return str;
    return str.replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  }

  // Basic JP phone formatting (tries 3-4-4; falls back by length)
  function formatPhoneJP(raw, wantHyphen){
    const d = digitsOnly(toHalfWidth(raw));
    if (!wantHyphen) return d;
    if (d.length === 10) return d.replace(/(\d{2,3})(\d{3,4})(\d{4})/, '$1-$2-$3');
    if (d.length === 11) return d.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    if (d.length === 9) return d.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
    return d; // unknown; keep digits only
  }

  // JP postal formatting (7 digits -> 3-4 if hyphen requested)
  function formatPostalJP(raw, wantHyphen){
    const d = digitsOnly(toHalfWidth(raw));
    if (!wantHyphen) return d;
    if (d.length === 7) return d.replace(/(\d{3})(\d{4})/, '$1-$2');
    return d;
  }

  // Infer formatting requirements from element attributes
  function inferFormat(el, key){
    const pat = (el.getAttribute('pattern') || '').trim();
    const ph = (el.getAttribute('placeholder') || '').trim();
    const max = el.maxLength;
    const attrStr = [pat, ph].join(' ');

    const wantsFullWidth = /[０-９]/.test(attrStr);
    const wantsKatakana = /カナ|ｶﾅ|カタカナ/.test(attrStr);
    const wantsHiragana = /ひらがな/.test(attrStr);
    const hyphenHint = /[-－]/.test(attrStr) || /\d{3}-\d{4}/.test(attrStr) || /\d+[-－]\d+/.test(attrStr);
    let wantHyphen = hyphenHint;

    // Maxlength heuristics
    if (key === 'zipCode') {
      if (max === 7) wantHyphen = false;
      if (max === 8) wantHyphen = true; // 3-4
    }
    if (key === 'phone') {
      if (max === 10 || max === 11) wantHyphen = false;
      if (max === 12 || max === 13) wantHyphen = true; // with hyphens
    }

    return { wantsFullWidth, wantHyphen, wantsKatakana, wantsHiragana };
  }

  // Check whether a candidate value likely satisfies page constraints
  function matchesConstraint(el, s){
    const pat = (el.getAttribute('pattern') || '').trim();
    if (pat) {
      try {
        const re = new RegExp('^' + pat + '$');
        if (!re.test(s)) return false;
      } catch(_){}
    }
    const max = el.maxLength;
    if (typeof max === 'number' && max > 0 && s.length > max) return false;
    return true;
  }

  function chooseBest(el, key, base, req){
    const candidates = [base];
    // Add alternates: toggle hyphen and width
    if (key === 'phone') {
      const d = digitsOnly(base);
      candidates.push(formatPhoneJP(d, !req.wantHyphen));
    } else if (key === 'zipCode') {
      const d = digitsOnly(base);
      candidates.push(formatPostalJP(d, !req.wantHyphen));
    }
    // width alternates
    const withFW = toFullWidthDigits(base);
    const withHW = toHalfWidth(base);
    if (withFW !== base) candidates.push(withFW);
    if (withHW !== base) candidates.push(withHW);

    for (const c of candidates){
      if (matchesConstraint(el, c)) return c;
    }
    return base;
  }

  // Hard-coded fuzzy protocol
  function textFromLabel(el){
    try {
      const id = el.id && el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (id && id.textContent) return id.textContent;
      const closest = el.closest('label');
      if (closest && closest.textContent) return closest.textContent;
      const aria = el.getAttribute('aria-label') || '';
      return aria;
    } catch(_) { return ''; }
  }

  function normStr(s){ return (s||'').toLowerCase(); }

  function matchKey(el){
    // Strong rules via autocomplete
    const ac = normStr(el.getAttribute('autocomplete'));
    if (ac === 'name') return 'name_full';
    if (ac === 'family-name') return 'name_family';
    if (ac === 'given-name') return 'name_given';
    if (ac === 'tel' || ac === 'tel-national') return 'phone';
    if (ac === 'email') return 'email';
    if (ac === 'postal-code') return 'zipCode';
    if (ac === 'address-line1') return 'addressLine1';
    if (ac === 'address-line2') return 'addressLine2';
    if (ac === 'address-level2') return 'city';
    if (ac === 'address-level1') return 'state';
    if (ac === 'country' || ac === 'country-name') return 'country';

    // Aggregate candidate text
    const fields = [
      el.getAttribute('name'), el.id, el.getAttribute('placeholder'), textFromLabel(el)
    ].filter(Boolean).map(normStr).join(' ');

    // Scoring table: each key gets an array of regex with weights
    const R = (re,w) => ({re, w});
    const rules = {
      name_full: [R(/氏名|お?名前|name\b|full\s*name/,5)],
      name_family: [R(/姓|苗字|みょうじ|family|last\s*name|surname/,5)],
      name_given: [R(/名|下の名前|given|first\s*name/,5)],
      name_full_kana: [R(/フリガナ|ふりがな|カナ|kana/,6)],
      name_family_kana: [R(/姓.*(カナ|かな)|せい.*(カナ|かな)/,6), R(/sei.*kana/,5)],
      name_given_kana: [R(/名.*(カナ|かな)|めい.*(カナ|かな)/,6), R(/mei.*kana/,5)],
      name_full_romaji: [R(/romaji|alphabet|english\s*name|latin/,5)],
      name_family_romaji: [R(/family.*(romaji|alphabet)|last.*(romaji|alphabet)/,4)],
      name_given_romaji: [R(/given.*(romaji|alphabet)|first.*(romaji|alphabet)/,4)],
      email: [R(/mail|e-?mail|メール/,6)],
      phone: [R(/tel|phone|電話|携帯|スマホ/,6)],
      company: [R(/会社|勤務先|corporate|company|organization|所属/,4)],
      zipCode: [R(/郵便|post\s*code|postal|zip/,6)],
      addressLine1: [R(/住所|address(?!.*2)|street|番地|丁目/,5)],
      addressLine2: [R(/住所.*2|address\s*2|apt|suite|建物|号室/,5)],
      city: [R(/市|区|town|city|locality/,3)],
      state: [R(/都|道|府|県|prefecture|state|province/,3)],
      country: [R(/国|country/,3)]
    };

    let bestKey = null, bestScore = 0;
    for (const [key, arr] of Object.entries(rules)){
      let score = 0;
      for (const {re,w} of arr){ if (re.test(fields)) score += w; }
      // slight boosts by input type
      const type = normStr(el.type);
      if (key==='email' && type==='email') score += 3;
      if (key==='phone' && type==='tel') score += 3;
      if (score > bestScore){ bestScore = score; bestKey = key; }
    }
    return bestScore >= 3 ? bestKey : null;
  }

  function getNameFromProfile(profile, key, req){
    const p = profile && profile.data ? profile.data : {};
    const famK = p.familyNameKanji, givK = p.givenNameKanji, fullK = p.fullNameKanji || (famK && givK ? famK + givK : undefined);
    const famR = p.familyNameRomaji, givR = p.givenNameRomaji, fullR = p.fullNameRomaji || (famR && givR ? `${famR} ${givR}` : undefined);
    const famF = p.familyNameKana,   givF = p.givenNameKana,   fullF = p.fullNameKana   || (famF && givF ? famF + givF : undefined);

    let val;
    switch (key) {
      case 'name_full': val = fullK || p.fullName || p.fullname || (p.fullNameRomaji || fullR) || (p.fullNameKana || fullF); break;
      case 'name_family': val = famK || p.lastName || p.familyName; break;
      case 'name_given': val = givK || p.firstName || p.givenName; break;
      case 'name_full_kana': val = fullF; break;
      case 'name_family_kana': val = famF; break;
      case 'name_given_kana': val = givF; break;
      case 'name_full_romaji': val = fullR; break;
      case 'name_family_romaji': val = famR; break;
      case 'name_given_romaji': val = givR; break;
      default: val = p.fullName || p.fullname; break;
    }

    if ((/kana/.test(key)) && val) {
      if (req && req.wantsKatakana) val = toKatakana(val);
      if (req && req.wantsHiragana) val = toHiragana(val);
    }
    return val;
  }

  function fill(profile){
    if (!profile || !profile.data) return;
    const data = profile.data;
    const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
    for (const el of inputs){
      const key = matchKey(el);
      if (!key) continue;
      if (key.startsWith('name_')){
        const req = inferFormat(el, key);
        const val = getNameFromProfile(profile, key, req);
        if (val != null) {
          setValue(el, val);
        }
        continue;
      }
      if (key && data[key] != null){
        let val = data[key];
        // Normalize user data first (convert full-width to half-width for logic)
        const req = inferFormat(el, key);
        if (key === 'phone') {
          val = formatPhoneJP(val, req.wantHyphen);
          val = chooseBest(el, key, val, req);
        } else if (key === 'zipCode') {
          val = formatPostalJP(val, req.wantHyphen);
          val = chooseBest(el, key, val, req);
        } else {
          // For numeric-only fields, collapse to half-width
          val = toHalfWidth(val);
        }
        // If page hints full-width numerals, convert final string
        if (req.wantsFullWidth) {
          val = toFullWidthDigits(val);
        }
        // Debug trace (visible in DevTools console)
        try { console.debug('[AutoFill]', key, '=>', val); } catch(_){}
        setValue(el, val);
      }
    }
  }

  function requestProfile(){
    chrome.runtime.sendMessage({ type:'GET_PROFILE' }, (res) => {
      if (res && res.ok) fill(res.profile);
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    requestProfile();
  } else {
    window.addEventListener('DOMContentLoaded', requestProfile);
  }
})();
