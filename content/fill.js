//   log("HyperFill v6.9-pac+richdesc (alioup-hotfix + socials) ready on", HOST);
// })();

/* content/fill.js — HyperFill v6.9-pac+richdesc (alioup-hotfix + socials + confirm-email)
 * Adds: Confirm Email support (email2), holder scan for .form_row/.form-fieldset
 */

(() => {
  if (window.__HF_v69_installed) return;
  window.__HF_v69_installed = true;

  const DEBUG = true;
  const log = (...a) => {
    try {
      console.debug("[HF]", ...a);
    } catch {}
  };
  const warn = (...a) => {
    try {
      console.warn("[HF]", ...a);
    } catch {}
  };

  const T_AUTO = 10,
    T_FORCE = 8,
    GAP_MIN = 2;
  const PENALTY_SOCIAL = 18,
    PENALTY_EMAIL_NEAR = 18,
    PENALTY_PRICE = 10,
    PENALTY_ADDR2ZIP = 12,
    PENALTY_TITLENAME = 10;
  const BLOCK_HOSTS = [/(^|\.)google\.com$/i, /(^|\.)accounts\.google\.com$/i];

  const isVisible = (el) => {
    try {
      if (!el || el.disabled || el.hidden || el.readOnly) return false;
      const s = window.getComputedStyle ? getComputedStyle(el) : null;
      if (
        s &&
        (s.display === "none" || s.visibility === "hidden" || s.opacity === "0")
      )
        return false;
      const r = el.getBoundingClientRect?.();
      if (r && (r.width <= 1 || r.height <= 1)) return false;
      const st = (el.getAttribute("style") || "").toLowerCase();
      if (st.includes("left:-5000px") || st.includes("max-width:1px"))
        return false;
      return true;
    } catch {
      return false;
    }
  };

  const alreadyFilled = (el) => {
    try {
      if (el.dataset?.rowfiller === "filled") return true;
      if (el.isContentEditable) return !!el.innerText?.trim();
      const v = el.value;
      return v !== undefined && v !== null && String(v).trim().length > 0;
    } catch {
      return false;
    }
  };

  function setNativeValue(el, value) {
    try {
      const p = Object.getPrototypeOf(el);
      const d = Object.getOwnPropertyDescriptor(p, "value");
      if (d && d.set) d.set.call(el, value);
      else el.value = value;
    } catch {
      try {
        el.value = value;
      } catch {}
    }
    try {
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } catch {}
    try {
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } catch {}
  }

  const HOST = location.hostname || "";
  const isBlockedHost = () => BLOCK_HOSTS.some((rx) => rx.test(HOST));
  if (isBlockedHost()) {
    DEBUG && log("blocked host → skip HyperFill on", HOST);
    return;
  }

  const isExtAlive = () =>
    typeof chrome !== "undefined" &&
    !!chrome.runtime &&
    !!chrome.runtime.id &&
    !!chrome.storage?.local;
  const safeGet = (keys) =>
    new Promise((resolve) => {
      if (!isExtAlive()) {
        resolve({});
        return;
      }
      try {
        chrome.storage.local.get(keys, (res) => {
          if (!isExtAlive() || chrome.runtime.lastError) {
            if (chrome.runtime?.lastError)
              warn("storage.get lastError:", chrome.runtime.lastError.message);
            resolve({});
            return;
          }
          resolve(res || {});
        });
      } catch (e) {
        warn("safeGet caught:", e?.message || e);
        resolve({});
      }
    });

  const rxEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const looksLikeEmail = (v) => !!v && rxEmail.test(String(v).trim());
  const looksLikePhone = (v) =>
    !!v && (String(v).match(/\d/g) || []).length >= 10;
  const looksLikeURL = (v) =>
    !!v && (/^https?:\/\//i.test(v) || /\.[a-z]{2,}$/i.test(v));
  const looksLikeUser = (v) =>
    !!v && !v.includes("@") && !/\s/.test(v) && /^[A-Za-z0-9._-]{3,}$/.test(v);
  const looksLikeZip = (v) =>
    !!v && String(v).trim().length <= 12 && /^[A-Za-z0-9-\s]+$/.test(v);

  const getText = (n) => (n?.textContent || "").trim();

  function extractLabelText(el) {
    try {
      if (el.id) {
        const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (l && l.innerText) return l.innerText.trim();
      }
      for (
        let p = el.parentElement, i = 0;
        p && i < 6;
        p = p.parentElement, i++
      ) {
        if (p.tagName === "LABEL") return p.innerText.trim();
      }
      const prev = el.previousElementSibling;
      if (prev && /^(LABEL|DIV|SPAN|P|H[1-6])$/.test(prev.tagName)) {
        const t = getText(prev);
        if (t) return t;
      }
      const next = el.nextElementSibling;
      if (
        next &&
        /label|field_label/i.test(next.className || "") &&
        next.innerText
      )
        return next.innerText.trim();
      const refId = el.getAttribute("aria-labelledby");
      if (refId) {
        const ref = document.getElementById(refId);
        if (ref && ref.innerText) return ref.innerText.trim();
      }
      if (el.title) return el.title.trim();
      return "";
    } catch {
      return "";
    }
  }

  function ctx(el) {
    const label = (extractLabelText(el) || "").toLowerCase();
    const name = (el.name || "").toLowerCase();
    const id = (el.id || "").toLowerCase();
    const ph = (el.placeholder || "").toLowerCase();
    const aria = (el.getAttribute?.("aria-label") || "").toLowerCase();
    const title = (el.getAttribute?.("title") || "").toLowerCase();

    const dvvas = (el.getAttribute?.("data-vv-as") || "").toLowerCase();
    const datalabel = (el.getAttribute?.("data-label") || "").toLowerCase();
    const fcn = (el.getAttribute?.("formcontrolname") || "").toLowerCase();
    const rfcn = (
      el.getAttribute?.("ng-reflect-form-control-name") || ""
    ).toLowerCase();

    let around = "";
    let wrapperName = "";
    try {
      const holder =
        el.closest(
          ".mat-mdc-form-field, .form_row, .form-fieldset, .field, .form-group, .input-box, .controls, .input-wrapper, .field_wrap__Gv92k, [name]"
        ) || el.parentElement;
      if (holder) {
        const blocks = holder.querySelectorAll(
          ":scope > label, :scope > div, :scope > p, :scope > span, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6"
        );
        for (const b of blocks) {
          const txt = (b.innerText || "").trim();
          if (txt && txt.length < 140) around += " " + txt.toLowerCase();
        }
        wrapperName = (holder.getAttribute?.("name") || "").toLowerCase();
      }
    } catch {}

    const cls = (el.className || "").toLowerCase();
    const combinedArr = [
      label,
      name,
      id,
      ph,
      aria,
      title,
      dvvas,
      datalabel,
      fcn,
      rfcn,
      around,
      cls,
      wrapperName,
    ].filter(Boolean);
    return {
      label,
      name,
      id,
      ph,
      aria,
      title,
      dvvas,
      datalabel,
      fcn,
      rfcn,
      around,
      cls,
      wrapperName,
      combined: combinedArr.join(" "),
    };
  }

  const POS = {
    firstname: [/\bfirst(?:[_\s-]?name)?\b/, /\bgiven\b/, /\bfname\b/],
    lastname: [/\blast(?:[_\s-]?name)?\b/, /\bsurname\b/, /\blname\b/],
    fullname: [
      /^name$|\bfull[_\s-]?name\b|\bdisplay[_\s-]?name\b|\breal[_\s-]?name\b|\bcompany[_\s-]?name\b/,
    ],
    username: [/\busername\b|\buser[_\s-]?name\b|\blogin\b|\buserid\b/],
    email: [/\bemail\b|\be-?mail\b|\bmail\b/],
    // NEW: Confirm Email
    email2: [
      /\bconfirm(?:\s*e-?mail|\s*email)?\b|\bre-?type\s*email\b|\bre-?enter\s*email\b|\brepeat\s*email\b/i,
    ],
    busEmail: [/\b(business|work|company|office)[\s_-]*email\b/],
    password: [/^password$|pass(?:word)?|pwd/],
    password2: [
      /\bconfirm(?:\s*password)?\b|\bre-?type\b|\bre-?enter\b|\brepeat\b|\bpassword\s*again\b/i,
    ],
    phone: [/\bphone\b|\bmobile\b|\btel\b|\bcontact\b|\bwhatsapp\b/],
    address: [/\baddress\b|\bstreet\b|\baddr\b|\broad\b|\bhouse\b|\barea\b/],
    city: [/\bcity\b|\btown\b/],
    state: [/\bstate\b|\bprovince\b|\bregion\b/],
    postcode: [/\bzip\b|\bpostal\b|\bpostcode\b|\bpin\b|\bzipcode\b/],
    country: [/\bcountry\b/],
    location: [/\blocation\b|\bplace\b|\barea\b/],
    website: [
      /\bwebsite\b|\bweb[_\s-]?url\b|\bhomepage\b|\bsite\b|\burl\b|\bportfolio\b/,
    ],
    title: [/\btitle\b|\blisting\b|\bheadline\b/],
    company: [/\bcompany\b|\borganization\b|\borg\b|\bbusiness\b|\bfirma\b/],
    description: [
      /\bdescription\b|\babout\b|\bbio\b|\bsummary\b|\bdescriptions\b|\bprofile\b|\bintro\b|\bstory\b|\bbackground\b|\binterests\b/,
    ],
    facebook: [/\bfacebook\b|\bfb\.com\b|\bfacebook\.com\b/],
    instagram: [/\binstagram\b|\binsta\b|\binstagram\.com\b/],
    twitter: [/\btwitter\b|\bx\.com\b|\btwitter\.com\b/],
    linkedin: [/\blinked ?in\b|\blinkedin\.com\b/],
    youtube: [/\byoutube\b|\byoutu\.be\b|\byoutube\.com\b/],
  };

  const NEG = {
    social: [
      /\bfacebook\b|\binstagram\b|\btwitter\b|\bx\.com\b|\byoutube\b|\btiktok\b|\blinkedin\b/,
    ],
    price: [/\bprice\b|\bamount\b|\brate\b|\bfee\b|\bcost\b|\bbudget\b/],
    post: [/\bpost\s?code\b|\bpostal\b|\bzip\b/],
    addressLine2: [
      /\baddress\s*line\s*2\b/i,
      /\baddress\s*line\s*3\b/i,
      /\baddress\s*2\b/i,
      /\baddr2\b/i,
      /\baddress2\b/i,
      /\bapt\b/i,
      /\bsuite\b/i,
      /\bunit\b/i,
    ],
  };

  const ROLE_LIST = [
    "email",
    "email2",
    "busEmail",
    "password",
    "password2",
    "fullname",
    "firstname",
    "lastname",
    "username",
    "phone",
    "address",
    "city",
    "state",
    "postcode",
    "country",
    "location",
    "website",
    "facebook",
    "instagram",
    "twitter",
    "linkedin",
    "youtube",
    "title",
    "company",
    "description",
  ];

  const EXACT_HINTS = {
    email: "email",
    mail: "email",
    "e-mail": "email",
    user_email: "email",
    username: "username",
    user: "username",
    login: "username",
    userid: "username",
    name: "fullname",
    full_name: "fullname",
    fullname: "fullname",
    bio: "description",
    about: "description",
    url: "website",
    website: "website",
    portfolio: "website",

    s_email: "email",
    s_name: "fullname",
    s_password: "password",
    s_password2: "password",
    usernamer: "username",
    namer: "fullname",
    emailr: "email",

    user_login: "username",
    user_email: "email",
    user_password: "password",

    "pac-input": "address",

    contactcompany: "company",
    contact_company: "company",
    companyname: "company",

    // Angular
    firstname: "firstname",
    lastname: "lastname",
    username_fcn: "username",
    phonenumber: "phone",
    emailaddress: "email",
    password: "password",
    confirmpassword: "password2",

    // Confirm Email aliases
    email_confirm: "email2",
    confirmemail: "email2",
    emailconfirm: "email2",
    regdataemailconfirm: "email2", // id="regDataEmailConfirm"
    emailconfirmation: "email2",

    // Socials
    facebook: "facebook",
    instagram: "instagram",
    twitter: "twitter",
    x: "twitter",
    linkedin: "linkedin",
    youtube: "youtube",
  };

  function isPacField(el, parts) {
    const id = (el.id || "").toLowerCase();
    const cls = (el.className || "").toLowerCase();
    const ph = (el.placeholder || "").toLowerCase();
    return (
      id === "pac-input" ||
      cls.includes("pac-target-input") ||
      cls.includes("google-writen-location") ||
      /enter a location|search location|start typing address/i.test(ph)
    );
  }

  function exactHintBoost(parts, role) {
    let bonus = 0;
    const reasons = [];
    const { name: n, id: i, wrapperName: w, fcn: f, rfcn: rf } = parts;
    const add = (cond, amt, why) => {
      if (cond) {
        bonus += amt;
        reasons.push(`+${amt} ${why}`);
      }
    };

    if (EXACT_HINTS[n] === role) add(true, 26, `exact-hint name="${n}"`);
    if (EXACT_HINTS[i] === role) add(true, 26, `exact-hint id="${i}"`);
    if (EXACT_HINTS[w] === role) add(true, 26, `exact-hint wrapper="${w}"`);
    if (EXACT_HINTS[f] === role) add(true, 26, `exact-hint fcn="${f}"`);
    if (EXACT_HINTS[rf] === role) add(true, 18, `exact-hint rfcn="${rf}"`);

    if (role === "email")
      add(parts.ph.includes("email") || f === "emailaddress", 10, "email-ish");
    if (role === "email2")
      add(
        /confirm|re[-\s]?type|re[-\s]?enter|repeat/.test(parts.label) ||
          /email_confirm|confirmemail|emailconfirm/.test(n + i + f + rf),
        20,
        "confirm-email"
      );
    if (role === "username")
      add(
        parts.ph.includes("username") || f === "username" || rf === "username",
        10,
        "username-ish"
      );
    if (role === "phone") add(f === "phonenumber", 14, "fcn=phoneNumber");
    if (role === "password2")
      add(
        /confirm|re[-\s]?type|re[-\s]?enter/.test(parts.label) ||
          f === "confirmpassword",
        18,
        "confirm-ish"
      );
    if (role === "company")
      add(/company/.test(parts.label), 16, "label company");
    return { bonus, reasons };
  }

  function scoreRole(parts, role, posList) {
    let s = 0;
    const reasons = [];
    const add = (hit, w, where, rx) => {
      if (hit) {
        s += w;
        reasons.push(`+${w} ${where} ~ ${rx}`);
      }
    };
    for (const rx of posList) {
      add(rx.test(parts.label), 10, "label", rx);
      add(rx.test(parts.name), 7, "name", rx);
      add(rx.test(parts.id), 7, "id", rx);
      add(rx.test(parts.aria), 5, "aria", rx);
      add(rx.test(parts.dvvas), 5, "data-vv-as", rx);
      add(rx.test(parts.ph), 4, "ph", rx);
      add(rx.test(parts.title), 2, "title", rx);
      add(rx.test(parts.around), 2, "around", rx);
      add(rx.test(parts.cls), 1, "class", rx);
      add(rx.test(parts.wrapperName), 6, "wrapperName", rx);
      add(rx.test(parts.fcn) || rx.test(parts.rfcn), 10, "fcn", rx);
    }
    const ex = exactHintBoost(parts, role);
    s += ex.bonus;
    reasons.push(...ex.reasons);

    if (parts.label === "name") {
      if (role === "fullname") {
        s += 4;
        reasons.push("+4 fullname (label=name)");
      } else if (role === "firstname" || role === "lastname") {
        s -= 4;
        reasons.push("-4 split-name discouraged");
      }
    }
    const penalize = (hit, amt, why) => {
      if (hit) {
        s -= amt;
        reasons.push(`-${amt} ${why}`);
      }
    };
    if (role === "username") {
      penalize(
        NEG.social.some((rx) => rx.test(parts.combined)),
        PENALTY_SOCIAL,
        "social context"
      );
      penalize(
        /\bemail\b|\bmail\b/.test(parts.combined),
        PENALTY_EMAIL_NEAR,
        "email tokens present"
      );
    }
    if (role === "phone")
      penalize(
        NEG.price.some((rx) => rx.test(parts.combined)),
        PENALTY_PRICE,
        "price context"
      );
    if (role === "address")
      penalize(
        NEG.post.concat(NEG.addressLine2).some((rx) => rx.test(parts.combined)),
        PENALTY_ADDR2ZIP,
        "postcode/addr2 context"
      );
    if (role === "website") {
      penalize(
        NEG.social.some((rx) => rx.test(parts.combined)),
        PENALTY_SOCIAL,
        "social context"
      );
      penalize(/username|handle/.test(parts.combined), 8, "username-ish");
    }
    if (role === "title" && /^name$/.test(parts.label))
      penalize(true, PENALTY_TITLENAME, "avoid title when label=name");
    return { role, score: s, reasons };
  }

  const usernameSignalRx = /\b(username|user[_\s-]?name|login|handle|userid)\b/;
  function usernameSignals(parts, el) {
    let n = 0;
    if (usernameSignalRx.test(parts.label)) n++;
    if (usernameSignalRx.test(parts.name)) n++;
    if (usernameSignalRx.test(parts.id)) n++;
    if (usernameSignalRx.test(parts.ph)) n++;
    if (usernameSignalRx.test(parts.wrapperName)) n++;
    if (usernameSignalRx.test(parts.fcn) || usernameSignalRx.test(parts.rfcn))
      n++;
    const ac = (el.getAttribute?.("autocomplete") || "").toLowerCase();
    if (ac.includes("username")) n++;
    return n;
  }

  function detectRoleAndScore(el) {
    const parts = ctx(el);
    if (isPacField(el, parts))
      return {
        role: "address",
        score: 99,
        all: [{ role: "address", score: 99, reasons: ["PAC/Places field"] }],
        parts,
      };
    if (!isVisible(el)) return { role: null, score: 0, all: [], parts };

    const tag = (el.tagName || "").toLowerCase();
    const type = (el.type || "").toLowerCase();

    const own = [parts.name, parts.id, parts.fcn, parts.rfcn, parts.label].join(
      " "
    );
    const isPassish = /(pass(?:word)?|pwd)/i.test(own);
    const isConfirmish = /(confirm|re[-\s]?type|re[-\s]?enter|password2)/i.test(
      own
    );

    if (type === "password" || isPassish) {
      const role = isConfirmish ? "password2" : "password";
      return {
        role,
        score: 100,
        all: [{ role, score: 100, reasons: ["password-type/own-passish"] }],
        parts,
      };
    }
    if (type === "email")
      return {
        role: "email",
        score: 50,
        all: [{ role: "email", score: 50, reasons: ["type=email"] }],
        parts,
      };
    if (type === "tel")
      return {
        role: "phone",
        score: 38,
        all: [{ role: "phone", score: 38, reasons: ["type=tel"] }],
        parts,
      };

    if (tag === "textarea") {
      const bioish =
        /about|bio|background|interests|summary|profile|intro|story/.test(
          parts.ph
        );
      const sDesc = scoreRole(parts, "description", POS.description);
      const sAddr = scoreRole(parts, "address", POS.address);
      const best =
        bioish && sDesc.score >= 6
          ? { ...sDesc, score: sDesc.score + 6 }
          : sAddr.score >= sDesc.score
          ? sAddr
          : sDesc;
      return { role: best.role, score: best.score, all: [sDesc, sAddr], parts };
    }

    const candidates = [];
    const push = (role, list) => candidates.push(scoreRole(parts, role, list));

    push("firstname", POS.firstname);
    push("lastname", POS.lastname);
    push("fullname", POS.fullname);
    push("username", POS.username);
    push("busEmail", POS.busEmail);
    push("email", POS.email);
    push("email2", POS.email2); // NEW: confirm email
    push("password", POS.password);
    push("password2", POS.password2);
    push("phone", POS.phone);
    push("address", POS.address);
    push("city", POS.city);
    push("state", POS.state);
    push("postcode", POS.postcode);
    push("country", POS.country);
    push("location", POS.location);
    push("website", POS.website);
    push("facebook", POS.facebook);
    push("instagram", POS.instagram);
    push("twitter", POS.twitter);
    push("linkedin", POS.linkedin);
    push("youtube", POS.youtube);
    push("title", POS.title);
    push("company", POS.company);
    push("description", POS.description);

    candidates.sort(
      (a, b) =>
        b.score - a.score ||
        ROLE_LIST.indexOf(a.role) - ROLE_LIST.indexOf(b.role)
    );
    let best = candidates[0],
      second = candidates[1];

    // email vs username tie-break (own attributes only)
    const ownStr = [
      parts.label,
      parts.name,
      parts.id,
      parts.ph,
      parts.aria,
      parts.title,
      parts.dvvas,
      parts.datalabel,
      parts.fcn,
      parts.rfcn,
    ]
      .filter(Boolean)
      .join(" ");
    const hasEmailTokOwn = /\bemail\b|\bmail\b|\be-?mail\b/.test(ownStr);
    const hasUserTokOwn =
      /\b(user\s*name|username|login|userid)\b/.test(ownStr) ||
      EXACT_HINTS[parts.name] === "username" ||
      EXACT_HINTS[parts.id] === "username" ||
      EXACT_HINTS[parts.fcn] === "username" ||
      EXACT_HINTS[parts.rfcn] === "username";
    if (hasEmailTokOwn && hasUserTokOwn) {
      const emailItem = candidates.find((c) => c.role === "email");
      if (emailItem)
        return {
          role: "email",
          score: Math.max(emailItem.score, T_AUTO),
          all: candidates,
          parts,
        };
    }

    if (second && best.score - second.score < GAP_MIN)
      return { role: null, score: 0, all: candidates, parts };

    if (best.role === "username") {
      const sig = usernameSignals(parts, el);
      const explicit =
        EXACT_HINTS[parts.name] === "username" ||
        EXACT_HINTS[parts.id] === "username" ||
        EXACT_HINTS[parts.wrapperName] === "username" ||
        parts.dvvas === "username" ||
        EXACT_HINTS[parts.fcn] === "username" ||
        EXACT_HINTS[parts.rfcn] === "username";
      if (!(sig >= 2 || explicit))
        return { role: null, score: 0, all: candidates, parts };
    }

    return { role: best.role, score: best.score, all: candidates, parts };
  }

  function prepareProfileValues(profile) {
    const p = profile?.profile || profile || {};
    const first = p.firstname || p.firstName || "";
    const last = p.lastname || p.lastName || "";
    const fullname = (
      p.fullname ||
      p.fullName ||
      `${first} ${last}`.trim()
    ).trim();
    const password =
      p.activePassword === "submissionPassword"
        ? p.submissionPassword || ""
        : p.emailPassword || p.password || "";
    return {
      firstname: first,
      lastname: last,
      fullname,
      username: p.username || "",
      email: p.email || p.submissionEmail || "",
      busEmail: p.businessEmail || p.workEmail || "",
      password,
      phone: p.phone || p.number || p.phoneNumber || "",
      website: p.website || "",
      title: p.title || "",
      company: p.company || fullname || "",
      description: p.description || p.bio || "",
      address: p.address || "",
      city: p.city || "",
      state: p.state || "",
      postcode: p.postcode || p.zip || "",
      country: p.country || "",
      location: p.location || "",
      facebook: p.facebook || "",
      instagram: p.instagram || "",
      twitter: p.twitter || p.x || "",
      linkedin: p.linkedin || "",
      youtube: p.youtube || "",
    };
  }

  function fillTinyMCEFromTextarea(textareaEl, v) {
    try {
      const id = textareaEl.id || textareaEl.name;
      if (!id) return false;
      const tm = window.tinymce || window.tinyMCE;
      if (tm?.get) {
        const ed = tm.get(id);
        if (ed) {
          ed.setContent(v);
          try {
            ed.fire("change");
          } catch {}
          textareaEl.value = v;
          textareaEl.dataset.rowfiller = "filled";
          DEBUG && log(`[rich] TinyMCE setContent id=${id}`);
          return true;
        }
      }
      const ifr =
        document.getElementById(`${id}_ifr`) ||
        textareaEl
          .closest(".wp-editor-wrap")
          ?.querySelector('iframe[id$="_ifr"]');
      if (ifr?.contentWindow?.document?.body) {
        const body = ifr.contentDocument.body;
        body.innerHTML = v;
        try {
          body.dispatchEvent(new Event("input", { bubbles: true }));
        } catch {}
        textareaEl.value = v;
        textareaEl.dataset.rowfiller = "filled";
        DEBUG && log(`[rich] Iframe body filled id=${id}_ifr`);
        return true;
      }
    } catch (e) {
      warn("fillTinyMCE error", e?.message || e);
    }
    return false;
  }

  function fillNearestContentEditable(container, v) {
    try {
      const ce = container.querySelector(
        '[contenteditable="true"], .mce-content-body, div[role="textbox"]'
      );
      if (ce) {
        if (ce.innerHTML !== undefined) ce.innerHTML = v;
        else ce.innerText = v;
        try {
          ce.dispatchEvent(new Event("input", { bubbles: true }));
        } catch {}
        ce.dataset && (ce.dataset.rowfiller = "filled");
        DEBUG && log(`[rich] contenteditable filled`);
        return true;
      }
    } catch {}
    return false;
  }

  function firePacEvents(el) {
    try {
      el.focus();
    } catch {}
    try {
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } catch {}
    try {
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } catch {}
    try {
      el.blur();
    } catch {}
  }

  function toSocialURL(role, v) {
    if (!v) return v;
    let handle = String(v).trim();
    if (looksLikeURL(handle)) return handle;
    handle = handle
      .replace(/^@/, "")
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "");
    if (!handle) return v;
    switch (role) {
      case "facebook":
        return `https://facebook.com/${handle}`;
      case "instagram":
        return `https://instagram.com/${handle}`;
      case "twitter":
        return `https://x.com/${handle}`;
      case "linkedin":
        return /company|in\//.test(handle)
          ? `https://linkedin.com/${handle}`
          : `https://linkedin.com/in/${handle}`;
      case "youtube":
        return /^@/.test(v)
          ? `https://youtube.com/${handle}`
          : `https://youtube.com/@${handle}`;
      default:
        return v;
    }
  }

  function tryFill(el, role, vals, force, parts, idx) {
    if (!el) return { ok: false, why: "no-el" };

    if (role === "description") {
      if (el.isContentEditable && isVisible(el)) {
        const v = vals.description;
        if (!v) return { ok: false, why: "no-value-for-description" };
        try {
          document.execCommand?.("insertText", false, v);
        } catch {
          el.innerText = v;
        }
        el.dataset.rowfiller = "filled";
        DEBUG && log(`[fill] #${idx} description → contenteditable`);
        return { ok: true };
      }
      const tag = (el.tagName || "").toLowerCase();
      if (tag === "textarea") {
        const style = (el.getAttribute("style") || "").toLowerCase();
        const hiddenish =
          style.includes("display: none") ||
          el.getAttribute("aria-hidden") === "true" ||
          !isVisible(el);
        if (hiddenish) {
          const v = vals.description;
          if (!v) return { ok: false, why: "no-value-for-description" };
          const ok =
            fillTinyMCEFromTextarea(el, v) ||
            fillNearestContentEditable(
              el.closest(".wp-editor-wrap") || document,
              v
            );
          return { ok, why: ok ? "" : "rich-editor-not-found" };
        }
      }
    }

    if (!isVisible(el)) return { ok: false, why: "not-visible" };
    if (!force && alreadyFilled(el))
      return { ok: false, why: "already-filled" };

    let v = vals[role];
    if ((role === "firstname" || role === "lastname") && !v && vals.fullname) {
      const t = vals.fullname.trim().split(/\s+/).filter(Boolean);
      if (t.length) {
        if (role === "firstname") v = t[0];
        if (role === "lastname") v = t.length > 1 ? t[t.length - 1] : "";
      }
    }
    if (role === "fullname" && !v)
      v = [vals.firstname, vals.lastname].filter(Boolean).join(" ").trim();
    if (!v && role === "busEmail" && vals.email) v = vals.email;

    // confirm roles mirror primary values
    if (role === "password2") v = vals.password;
    if (role === "email2") v = vals.email || vals.busEmail;

    if (!v) return { ok: false, why: `no-value-for-${role}` };

    const tag = (el.tagName || "").toLowerCase();
    const type = (el.type || "").toLowerCase();

    if (
      (role === "email" || role === "busEmail" || role === "email2") &&
      !looksLikeEmail(v)
    )
      return { ok: false, why: "value-not-email" };
    if (role === "phone") {
      if (!looksLikePhone(v)) return { ok: false, why: "value-not-phone" };
      if (NEG.price.some((rx) => rx.test(parts.combined)))
        return { ok: false, why: "price-context" };
    }
    if (role === "website" && !looksLikeURL(v))
      return { ok: false, why: "value-not-url" };
    if (role === "username") {
      const sig = usernameSignals(parts, el);
      const explicit =
        /\b(user\s*name|username|login)\b/.test(parts.combined) ||
        EXACT_HINTS[parts.name] === "username" ||
        EXACT_HINTS[parts.id] === "username" ||
        EXACT_HINTS[parts.wrapperName] === "username" ||
        EXACT_HINTS[parts.fcn] === "username" ||
        EXACT_HINTS[parts.rfcn] === "username";
      if (!looksLikeUser(v)) return { ok: false, why: "value-not-username" };
      if (["email", "password", "tel", "url", "number"].includes(type))
        return { ok: false, why: "bad-input-type" };
      if (!(sig >= 2 || explicit))
        return { ok: false, why: "weak-username-signals" };
      if (NEG.social.some((rx) => rx.test(parts.combined)))
        return { ok: false, why: "social-context" };
      if (/\bemail\b|\bmail\b/.test(parts.combined))
        return { ok: false, why: "email-preferred-here" };
    }
    if (role === "postcode") {
      if (!looksLikeZip(v)) return { ok: false, why: "value-not-zip" };
      if (/\d/.test(v) === false && v.length > 4)
        return { ok: false, why: "zip-no-digits" };
    }
    if (role === "address") {
      const isAddr2 =
        NEG.addressLine2.some((rx) => rx.test(parts.combined)) ||
        /(^|[^a-z])address2([^a-z]|$)/i.test(parts.name) ||
        /(^|[^a-z])address2([^a-z]|$)/i.test(parts.id);
      if (isAddr2) return { ok: false, why: "addr2-context" };
    }
    if (role === "title" && /^name$/.test(parts.label))
      return { ok: false, why: "label-name-title-guard" };
    if (role === "fullname" && looksLikeEmail(v))
      return { ok: false, why: "fullname-looks-like-email" };

    if (
      ["facebook", "instagram", "twitter", "linkedin", "youtube"].includes(role)
    ) {
      v = toSocialURL(role, v);
      if (!looksLikeURL(v)) return { ok: false, why: "social-url-invalid" };
    }

    if (tag === "select") {
      for (const opt of Array.from(el.options || [])) {
        if (!opt) continue;
        if (
          (opt.value &&
            String(opt.value).toLowerCase() === String(v).toLowerCase()) ||
          (opt.text &&
            String(opt.text).toLowerCase() === String(v).toLowerCase())
        ) {
          el.value = opt.value;
          try {
            el.dispatchEvent(new Event("change", { bubbles: true }));
          } catch {}
          el.dataset.rowfiller = "filled";
          DEBUG && log(`[fill] #${idx} select role=${role}`);
          return { ok: true };
        }
      }
      return { ok: false, why: "select-no-match" };
    }

    const isPac = isPacField(el, parts);
    if (el.isContentEditable) {
      try {
        document.execCommand("insertText", false, v);
      } catch {
        el.innerText = v;
      }
      el.dataset.rowfiller = "filled";
      DEBUG && log(`[fill] #${idx} contenteditable role=${role}`);
      return { ok: true };
    }
    setNativeValue(el, v);
    if (isPac) firePacEvents(el);
    el.dataset.rowfiller = "filled";
    DEBUG && log(`[fill] #${idx} input role=${role}${isPac ? " (PAC)" : ""}`);
    return { ok: true };
  }

  function doFill(profile, force = false) {
    try {
      const vals = prepareProfileValues(profile);
      const nodes = Array.from(
        document.querySelectorAll(
          "input, textarea, select, [contenteditable='true']"
        )
      );
      nodes.sort(
        (a, b) =>
          (a.getBoundingClientRect().top || 0) -
          (b.getBoundingClientRect().top || 0)
      );

      let filled = 0;
      const used = new Set();
      let idx = 0;

      DEBUG &&
        log(
          `--- scan start (${
            nodes.length
          } fields) @ ${new Date().toISOString()} ---`
        );

      for (const el of nodes) {
        idx++;
        const type = (el.type || "").toLowerCase();
        if (
          [
            "hidden",
            "submit",
            "button",
            "reset",
            "image",
            "file",
            "checkbox",
            "radio",
          ].includes(type) &&
          el.tagName !== "TEXTAREA"
        )
          continue;

        let det = detectRoleAndScore(el);
        const parts = det?.parts || ctx(el);

        if (DEBUG) {
          const baseRow = {
            "#": idx,
            tag: el.tagName?.toLowerCase(),
            type,
            name: el.name || "",
            id: el.id || "",
            ph: el.placeholder || "",
            label: parts.label,
            wrapper: parts.wrapperName,
            fcn: parts.fcn,
            chosen: det?.role || null,
            score: det?.score || 0,
            min: force ? T_FORCE : T_AUTO,
          };
          log("[cand]", baseRow);
          if (det?.all?.length) {
            const map = {};
            det.all.forEach((x) => (map[x.role] = x.score));
            log("[scores]", map);
            det.all.forEach(
              (x) => x.reasons?.length && log(`[reasons] ${x.role}`, x.reasons)
            );
          }
        }

        if (!det || !det.role) {
          DEBUG && log(`[skip] #${idx} undecided/ambiguous`);
          continue;
        }
        const min = force ? T_FORCE : T_AUTO;
        if (det.score < min) {
          DEBUG &&
            log(`[skip] #${idx} below-threshold score=${det.score} < ${min}`);
          continue;
        }

        // single-fill roles (email2/password2 deliberately NOT here)
        const singleRoles = new Set([
          "email",
          "busEmail",
          "password",
          "firstname",
          "lastname",
          "fullname",
          "phone",
          "city",
          "state",
          "postcode",
          "country",
          "website",
          "facebook",
          "instagram",
          "twitter",
          "linkedin",
          "youtube",
          "title",
          "company",
        ]);
        if (singleRoles.has(det.role) && used.has(det.role)) {
          DEBUG && log(`[skip] #${idx} duplicate-role ${det.role}`);
          continue;
        }

        const res = tryFill(el, det.role, vals, force, parts, idx);
        if (res.ok) {
          filled++;
          used.add(det.role);
          DEBUG &&
            log(
              `[match] #${idx} role=${det.role} score=${
                det.score
              } thr=${min} name=${el.name || ""} id=${el.id || ""} label="${
                parts.label
              }" wrap="${parts.wrapperName}" fcn="${parts.fcn}"`
            );
        } else {
          DEBUG && log(`[skip] #${idx} role=${det.role} reason=${res.why}`);
        }
      }

      // extra pass for description editors if missed
      if (!used.has("description") && (vals.description || "").trim()) {
        const tAreas = Array.from(
          document.querySelectorAll("textarea[id], textarea[name]")
        );
        for (const ta of tAreas) {
          const idn = (ta.id || ta.name || "").toLowerCase();
          const lab = extractLabelText(ta).toLowerCase();
          const looksDesc =
            idn === "description" ||
            /\bdescription\b/.test(lab) ||
            ta
              .closest(".wp-editor-wrap")
              ?.id?.toLowerCase()
              ?.includes("description");
          if (!looksDesc) continue;
          if (
            fillTinyMCEFromTextarea(ta, vals.description) ||
            fillNearestContentEditable(
              ta.closest(".wp-editor-wrap") || document,
              vals.description
            )
          ) {
            used.add("description");
            filled++;
            DEBUG && log(`[rich-pass] description filled via editor`);
            break;
          }
        }
      }

      DEBUG && log(`--- scan done: filled=${filled} ---`);
      return filled;
    } catch (e) {
      warn("doFill error", e?.message || e);
      return 0;
    }
  }

  try {
    chrome?.runtime?.onMessage?.addListener((msg, sender, sendResponse) => {
      if (!msg?.action) return;
      if (
        ["autofill", "autofillProfile", "autofillAuth", "runFill"].includes(
          msg.action
        )
      ) {
        const go = async (profile) => {
          const res = await safeGet(["autofillEnabled"]);
          const enabled =
            res?.autofillEnabled !== undefined ? res.autofillEnabled : true;
          if (!enabled && !msg.force) {
            sendResponse({ ok: false, filled: 0, error: "disabled" });
            return;
          }
          const filled = doFill(profile, !!msg.force);
          sendResponse({ ok: filled > 0, filled });
        };
        if (msg.profile) go(msg.profile);
        else safeGet(["profile"]).then((r) => go(r?.profile || null));
        return true;
      }
      if (msg.action === "toggleAutofill") {
        sendResponse({ ok: true });
        return true;
      }
    });
  } catch {}

  let autorunTimer = null;
  const scheduleAutorun = (delay = 200) => {
    if (autorunTimer) clearTimeout(autorunTimer);
    autorunTimer = setTimeout(async () => {
      const res = await safeGet(["autofillEnabled", "profile"]);
      const enabled =
        res?.autofillEnabled !== undefined ? res.autofillEnabled : true;
      const profile = res?.profile;
      if (!enabled || !profile) return;
      try {
        doFill(profile, false);
      } catch (e) {
        warn("autorun error", e?.message || e);
      }
    }, delay);
  };

  function autorun() {
    scheduleAutorun(60);
    scheduleAutorun(500);
  }
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  )
    autorun();
  else window.addEventListener("DOMContentLoaded", autorun, { once: true });

  if (window.MutationObserver) {
    const mo = new MutationObserver(() => scheduleAutorun(160));
    try {
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch {}
  }

  (function hookHistory() {
    try {
      const push = history.pushState;
      const rep = history.replaceState;
      history.pushState = function () {
        try {
          push.apply(this, arguments);
        } finally {
          scheduleAutorun(160);
        }
      };
      history.replaceState = function () {
        try {
          rep.apply(this, arguments);
        } finally {
          scheduleAutorun(160);
        }
      };
      window.addEventListener("popstate", () => scheduleAutorun(160));
    } catch {}
  })();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleAutorun(120);
  });

  log(
    "HyperFill v6.9-pac+richdesc (alioup-hotfix + socials + confirm-email) ready on",
    HOST
  );
})();
