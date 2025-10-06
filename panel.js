// panel.js — Fresh dark UI + Excel/CSV import integrated + storage + Hard Fill + toasts
(function () {
  const $ = (sel) => document.querySelector(sel);

  /* -------------------- TOAST -------------------- */
  let toastTimer = null;
  function toast(msg, type = "info") {
    const el = $("#toast"),
      txt = $("#toastMsg");
    if (!el || !txt) return;
    txt.textContent = msg;
    el.classList.remove("success", "warn", "info");
    el.classList.add(type);
    el.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
  }

  /* -------------------- PROMPT (copy) -------------------- */
  const PROMPT_TEXT = `
You are a data-extraction assistant. I will give you a screenshot of a RankFiller "Project Details" page.
Goal: return a single-row Excel with sheet name "Profile" using EXACT columns in this order:
Website URL,Company Name,First Name,Last Name,Full Name,Username,Email,Confirm Email,Password,Confirm Password,Phone,Address,City,State,Post Code,Country,Location,Facebook,Instagram,Twitter,LinkedIn,YouTube,Description
Rules: "Company Name" should be same as Full Name if the screenshot shows a company. Confirm Email == Email. Confirm Password == Password. Normalize phone with country code. Socials must be full URLs. No invented fields. Output a .xlsx named hyperfill_profile.xlsx, or CSV if file is not possible.
  `.trim();

  $("#copyPrompt")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(PROMPT_TEXT);
      toast("Prompt copied ✔", "success");
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = PROMPT_TEXT;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast("Prompt copied ✔", "success");
    }
  });

  /* -------------------- STORAGE HELPERS -------------------- */
  function saveProfile(profile) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ profile, autofillEnabled: true }, () =>
          resolve()
        );
      } catch {
        resolve();
      }
    });
  }
  function loadProfile() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(["profile"], (res) =>
          resolve(res?.profile || null)
        );
      } catch {
        resolve(null);
      }
    });
  }
  function clearStore() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.remove(["profile"], () => resolve());
      } catch {
        resolve();
      }
    });
  }

  /* -------------------- UI <-> PROFILE -------------------- */
  function setUI(p) {
    const x = (p && (p.profile || p)) || {};
    $("#website").value = x.website || "";
    $("#firstname").value = x.firstname || "";
    $("#lastname").value = x.lastname || "";
    $("#fullname").value = x.fullname || "";
    $("#username").value = x.username || "";
    $("#email").value = x.email || x.submissionEmail || "";
    $("#businessEmail").value = x.businessEmail || x.workEmail || "";
    $("#emailPassword").value = x.emailPassword || x.password || "";
    $("#submissionPassword").value = x.submissionPassword || "";
    const ap = x.activePassword || "emailPassword";
    const apInput = document.querySelector(
      `input[name="activePassword"][value="${ap}"]`
    );
    if (apInput) apInput.checked = true;

    // ✅ Phone wired
    $("#phone").value = x.phone || x.number || x.phoneNumber || "";

    $("#address").value = x.address || "";
    $("#city").value = x.city || "";
    $("#state").value = x.state || "";
    $("#postcode").value = x.postcode || x.zip || "";
    $("#country").value = x.country || "";
    $("#location").value = x.location || "";
    $("#facebook").value = x.facebook || "";
    $("#instagram").value = x.instagram || "";
    $("#twitter").value = x.twitter || x.x || "";
    $("#linkedin").value = x.linkedin || "";
    $("#youtube").value = x.youtube || "";
    $("#description").value = x.description || x.bio || "";
  }

  function getUI() {
    const activePassword =
      (document.querySelector('input[name="activePassword"]:checked') || {})
        .value || "emailPassword";
    return {
      profile: {
        website: $("#website").value.trim(),

        firstname: $("#firstname").value.trim(),
        lastname: $("#lastname").value.trim(),
        fullname: $("#fullname").value.trim(),
        username: $("#username").value.trim(),

        email: $("#email").value.trim(),
        submissionEmail: $("#email").value.trim(),
        businessEmail: $("#businessEmail").value.trim(),

        emailPassword: $("#emailPassword").value,
        submissionPassword: $("#submissionPassword").value,
        password: $("#emailPassword").value,
        activePassword,

        // ✅ Phone wired
        phone: $("#phone").value.trim(),

        address: $("#address").value.trim(),
        city: $("#city").value.trim(),
        state: $("#state").value.trim(),
        postcode: $("#postcode").value.trim(),
        country: $("#country").value.trim(),
        location: $("#location").value.trim(),

        facebook: $("#facebook").value.trim(),
        instagram: $("#instagram").value.trim(),
        twitter: $("#twitter").value.trim(),
        linkedin: $("#linkedin").value.trim(),
        youtube: $("#youtube").value.trim(),

        description: $("#description").value.trim(),
      },
    };
  }

  function clearUI() {
    document
      .querySelectorAll(".input, textarea")
      .forEach((el) => (el.value = ""));
    const defaultAP = document.querySelector(
      'input[name="activePassword"][value="emailPassword"]'
    );
    if (defaultAP) defaultAP.checked = true;
  }

  function hardFill(profile) {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        (tabs || []).forEach((t) => {
          try {
            chrome.tabs.sendMessage(
              t.id,
              { action: "runFill", profile, force: true },
              () => {}
            );
          } catch {}
        });
      });
    } catch {}
  }

  /* -------------------- EXCEL / CSV IMPORT (INTEGRATED) -------------------- */

  // 1) Header normalization + logical map
  const normalizeKey = (k) =>
    (k || "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[.\-_/]+/g, " ")
      .trim();

  const HEADMAP = {
    "website url": "website",
    website: "website",
    url: "website",

    "full name": "fullname",
    fullname: "fullname",
    name: "fullname",
    "first name": "firstname",
    firstname: "firstname",
    "given name": "firstname",
    fname: "firstname",
    "last name": "lastname",
    lastname: "lastname",
    surname: "lastname",
    lname: "lastname",
    username: "username",
    "user name": "username",
    login: "username",
    "user id": "username",
    userid: "username",

    email: "email",
    "e mail": "email",
    "primary email": "email",
    "confirm email": "email2",
    "email confirm": "email2",
    "email confirmation": "email2",

    password: "password",
    pass: "password",
    "confirm password": "password2",
    "password confirm": "password2",
    "retype password": "password2",

    phone: "phone",
    mobile: "phone",
    "mobile phone": "phone",
    whatsapp: "phone",
    tel: "phone",

    address: "address",
    "street address": "address",
    city: "city",
    town: "city",
    state: "state",
    province: "state",
    region: "state",
    postcode: "postcode",
    "postal code": "postcode",
    zip: "postcode",
    "zip code": "postcode",
    pin: "postcode",
    country: "country",
    location: "location",

    facebook: "facebook",
    "facebook url": "facebook",
    instagram: "instagram",
    "instagram url": "instagram",
    twitter: "twitter",
    x: "twitter",
    "twitter url": "twitter",
    linkedin: "linkedin",
    "linked in": "linkedin",
    youtube: "youtube",
    "youtube channel": "youtube",

    bio: "description",
    about: "description",
    description: "description",
    summary: "description",

    company: "company",
  };

  // 2) CSV fallback parser
  function parseCSV(text) {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    if (!lines.length) return [];
    const headers = splitCSVLine(lines[0]).map((h) => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const cols = splitCSVLine(line);
      const row = {};
      headers.forEach((h, idx) => (row[h] = (cols[idx] ?? "").trim()));
      rows.push(row);
    }
    return rows;
  }
  function splitCSVLine(line) {
    const out = [];
    let cur = "",
      inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  }

  // 3) Row -> Profile mapping (company->fullname rule applied)
  function rowToProfile(rawRow) {
    const nk = {};
    Object.keys(rawRow || {}).forEach((k) => (nk[normalizeKey(k)] = rawRow[k]));

    const tmp = {};
    Object.keys(nk).forEach((k) => {
      const logical = HEADMAP[k];
      if (!logical) return;
      tmp[logical] = nk[k];
    });

    // If fullname missing, use company
    if ((!tmp.fullname || !String(tmp.fullname).trim()) && tmp.company) {
      tmp.fullname = tmp.company;
    }

    // Confirm mirror
    if (!tmp.email2 && tmp.email) tmp.email2 = tmp.email;
    if (!tmp.password2 && tmp.password) tmp.password2 = tmp.password;

    // Build final profile for fill.js
    const password = tmp.password || "";
    const prof = {
      profile: {
        website: (tmp.website || "").trim(),

        firstname: tmp.firstname || "",
        lastname: tmp.lastname || "",
        fullname: (tmp.fullname || "").trim(),
        username: tmp.username || "",

        email: (tmp.email || "").trim(),
        submissionEmail: (tmp.email || "").trim(),
        businessEmail: (tmp.businessemail || tmp.workemail || "").trim(),

        password,
        emailPassword: password,
        submissionPassword: tmp.password || "",
        activePassword: "emailPassword",

        // ✅ Phone wired from excel
        phone: tmp.phone || "",

        address: tmp.address || "",
        city: tmp.city || "",
        state: tmp.state || "",
        postcode: tmp.postcode || "",
        country: tmp.country || "",
        location: tmp.location || "",
        description: tmp.description || "",

        facebook: tmp.facebook || "",
        instagram: tmp.instagram || "",
        twitter: tmp.twitter || "",
        linkedin: tmp.linkedin || "",
        youtube: tmp.youtube || "",
      },
    };

    // Derive full name if still empty
    if (!prof.profile.fullname) {
      const fl = [prof.profile.firstname, prof.profile.lastname]
        .filter(Boolean)
        .join(" ")
        .trim();
      prof.profile.fullname = fl || prof.profile.username || "";
    }
    return prof;
  }

  // 4) File input handler (XLSX/CSV)
  $("#hfExcelFile")?.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;

    toast(`Selected: ${f.name}`, "info");

    let rows = [];
    try {
      const buf = await f.arrayBuffer();

      if (typeof XLSX !== "undefined" && /\.xlsx?$/i.test(f.name)) {
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      } else if (/\.csv$/i.test(f.name)) {
        const text = new TextDecoder("utf-8").decode(new Uint8Array(buf));
        rows = parseCSV(text);
      } else {
        toast("Upload .xlsx or .csv", "warn");
        return;
      }
    } catch (err) {
      console.error("Excel parse error:", err);
      toast("Parse failed. Check file.", "warn");
      return;
    }

    if (!rows.length) {
      toast("No rows found.", "warn");
      return;
    }

    // first meaningful row
    const first = rows.find((r) =>
      Object.values(r).some((v) => String(v || "").trim().length)
    );
    if (!first) {
      toast("All rows empty.", "warn");
      return;
    }

    const profile = rowToProfile(first);
    setUI(profile);
    await saveProfile(profile);
    hardFill(profile);
    toast("Imported & Hard Fill triggered", "success");
  });

  /* -------------------- BUTTONS -------------------- */
  $("#saveProfile")?.addEventListener("click", async () => {
    const profile = getUI();
    await saveProfile(profile);
    toast("Profile saved", "success");
  });

  $("#applyProfileOnTab")?.addEventListener("click", async () => {
    let p = await loadProfile();
    if (!p) p = getUI();
    await saveProfile(p);
    hardFill(p);
    toast("Hard Fill triggered", "success");
  });

  $("#clearAllNav")?.addEventListener("click", async () => {
    clearUI();
    await clearStore();
    toast("Cleared", "info");
  });

  /* -------------------- INIT -------------------- */
  (async function init() {
    const saved = await loadProfile();
    if (saved) setUI(saved);
  })();
})();
