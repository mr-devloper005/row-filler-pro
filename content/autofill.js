// // content/autofill.js
// // Robust autofill that:
// // - reads profile from chrome.storage.local (profile or separate keys)
// // - uses native setter pattern for React/Angular compatibility
// // - MutationObserver + initial attempt + periodic retries
// // - marks filled elements to avoid re-filling repeatedly

// (function () {
//   if (window.__RowFiller_autofill_installed) return;
//   window.__RowFiller_autofill_installed = true;
//   console.log("🔑 content/autofill.js loaded");

//   function setNativeValue(element, value) {
//     try {
//       const prototype = Object.getPrototypeOf(element);
//       const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, "value");
//       const elementDescriptor = Object.getOwnPropertyDescriptor(element.__proto__, "value");
//       const setter = prototypeDescriptor && prototypeDescriptor.set
//         ? prototypeDescriptor.set
//         : elementDescriptor && elementDescriptor.set
//           ? elementDescriptor.set
//           : null;
//       if (setter) {
//         setter.call(element, value);
//       } else {
//         element.value = value;
//       }
//     } catch (e) {
//       try { element.value = value; } catch (e2) {}
//     }
//     element.dispatchEvent(new Event("input", { bubbles: true }));
//     element.dispatchEvent(new Event("change", { bubbles: true }));
//   }

//   const patterns = {
//     email: [/email/i, /\bmail\b/i, /e-mail/i, /user.?email/i],
//     username: [/user(name)?/i, /login/i, /handle/i, /\buid\b/i, /userid/i],
//     password: [/pass(word)?/i, /^pwd$/i, /passcode/i],
//     fullname: [/full.?name/i, /first.?name/i, /last.?name/i, /\bname\b/i]
//   };

//   function getLabelText(el) {
//     try {
//       if (!el) return "";
//       const id = el.id;
//       if (id) {
//         const lab = document.querySelector(`label[for="${id}"]`);
//         if (lab) return lab.innerText || lab.textContent || "";
//       }
//       // try parent label
//       let p = el.parentElement;
//       for (let i = 0; i < 3 && p; i++, p = p.parentElement) {
//         if (p.tagName && p.tagName.toLowerCase() === "label") {
//           return p.innerText || p.textContent || "";
//         }
//       }
//       return "";
//     } catch (e) { return ""; }
//   }

//   function matchField(el) {
//     try {
//       const attrs = [
//         el.name,
//         el.id,
//         el.placeholder,
//         el.getAttribute && el.getAttribute("aria-label"),
//         getLabelText(el)
//       ].filter(Boolean).join(" ").toLowerCase();

//       for (const [key, regexes] of Object.entries(patterns)) {
//         if (regexes.some(rx => rx.test(attrs))) return key;
//       }
//       if (el.type === "email") return "email";
//       if (el.type === "password") return "password";
//     } catch (e) {}
//     return null;
//   }

//   function alreadyFilled(el) {
//     try {
//       if (!el) return false;
//       if (el.dataset && el.dataset.hyperfill === "1") return true;
//       if (el.value && el.value.trim().length > 0) return true;
//       if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
//         return el.innerText && el.innerText.trim().length > 0;
//       }
//       return false;
//     } catch (e) { return false; }
//   }

//   function fillOnce(profile) {
//     if (!profile) return 0;
//     const inputs = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//     let filled = 0;
//     inputs.forEach(el => {
//       try {
//         if (alreadyFilled(el)) return;
//         const role = matchField(el);
//         if (!role) return;
//         let value = null;
//         // support both profile object and standalone keys fallback
//         if (profile.profile && typeof profile.profile === "object") {
//           const p = profile.profile;
//           if (role === "password") {
//             const activePass = (p.activePassword === "submissionPassword") ? (p.submissionPassword || "") : (p.emailPassword || "");
//             value = activePass;
//           } else {
//             value = p[role] || "";
//           }
//         } else {
//           // older shape or direct keys
//           if (role === "password") {
//             value = profile.password2 || profile.password1 || profile.emailPassword || profile.submissionPassword || "";
//           } else {
//             value = profile[role] || profile["emailId"] || profile["submissionEmail"] || "";
//           }
//         }
//         if (!value) return;
//         // set value
//         if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
//           el.focus && el.focus();
//           document.execCommand && document.execCommand('insertText', false, value);
//           el.dataset.hyperfill = "1";
//           filled++;
//         } else {
//           el.focus && el.focus();
//           setNativeValue(el, value);
//           el.dataset.hyperfill = "1";
//           filled++;
//         }
//       } catch (err) {
//         console.warn("Autofill element error", err, el);
//       }
//     });
//     if (filled > 0) console.log("✅ Autofilled", filled, "fields");
//     return filled;
//   }

//   // Debounce + rate limit
//   let lastRun = 0;
//   function tryFill(profile) {
//     const now = Date.now();
//     if (now - lastRun < 700) return;
//     lastRun = now;
//     try {
//       fillOnce(profile);
//     } catch (e) { console.warn("tryFill error", e); }
//   }

//   // load profile and attach observers
//   function startAutofillWith(profile) {
//     if (!profile) return;
//     // initial attempts
//     setTimeout(() => tryFill(profile), 700);
//     setTimeout(() => tryFill(profile), 1500);
//     // observe DOM mutations for dynamic forms
//     const obs = new MutationObserver(() => tryFill(profile));
//     try {
//       if (document.body) obs.observe(document.body, { childList: true, subtree: true, attributes: false });
//     } catch (e) { console.warn("Observer attach failed", e); }
//     // fallback periodic
//     let tries = 0;
//     const iv = setInterval(() => {
//       tryFill(profile);
//       tries++;
//       if (tries > 20) clearInterval(iv); // stop after ~20 tries (~40s)
//     }, 2000);
//   }

//   // read storage - support both profile object or individual keys
//   function loadProfileAndStart() {
//     try {
//       chrome.storage.local.get(null, (res) => {
//         if (!res) {
//           console.warn("No storage result");
//           return;
//         }
//         // prefer whole profile key if present
//         if (res.profile && typeof res.profile === "object") {
//           startAutofillWith({ profile: res.profile });
//           return;
//         }
//         // detect if any of the old keys exist
//         const anyKey = ["fullname","username","submissionEmail","emailId","password1","password2","emailPassword","submissionPassword"].some(k => res[k]);
//         if (anyKey) {
//           startAutofillWith(res);
//           return;
//         }
//         // nothing found
//         // console.log("RowFiller: no credentials stored yet");
//       });
//     } catch (e) {
//       console.warn("loadProfileAndStart error", e);
//     }
//   }

//   // try load now or on DOM ready
//   if (document.readyState === "complete" || document.readyState === "interactive") {
//     loadProfileAndStart();
//   } else {
//     window.addEventListener("DOMContentLoaded", loadProfileAndStart);
//   }

//   // also listen to storage changes (if popup updates profile)
//   chrome.storage.onChanged.addListener((changes) => {
//     // naive: reload whole profile object and re-run
//     loadProfileAndStart();
//   });

// })();

// // content/autofill.js
// // Updated to support firstname, lastname, fullname and businessEmail
// (function () {
//   if (window.__RowFiller_autofill_installed) return;
//   window.__RowFiller_autofill_installed = true;
//   console.log("🔑 content/autofill.js loaded (with firstname/lastname/businessEmail)");

//   // set value safely (works with React-like inputs)
//   function setNativeValue(element, value) {
//     try {
//       const prototype = Object.getPrototypeOf(element);
//       const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, "value");
//       const elementDescriptor = Object.getOwnPropertyDescriptor(element.__proto__, "value");
//       const setter = prototypeDescriptor && prototypeDescriptor.set
//         ? prototypeDescriptor.set
//         : elementDescriptor && elementDescriptor.set
//           ? elementDescriptor.set
//           : null;
//       if (setter) {
//         setter.call(element, value);
//       } else {
//         element.value = value;
//       }
//     } catch (e) {
//       try { element.value = value; } catch (e2) {}
//     }
//     element.dispatchEvent(new Event("input", { bubbles: true }));
//     element.dispatchEvent(new Event("change", { bubbles: true }));
//   }

//   // heuristics / regex patterns for matching fields
//   const patterns = {
//     email: [/email/i, /\bmail\b/i, /e-mail/i, /user.?email/i],
//     businessEmail: [/business/i, /work/i, /company/i, /office/i, /corp/i, /\bbiz\b/i, /corporate/i, /work.?email/i],
//     username: [/user(name)?/i, /login/i, /handle/i, /\buid\b/i, /userid/i],
//     password: [/pass(word)?/i, /^pwd$/i, /passcode/i],
//     fullname: [/full.?name/i, /\bfull\s*name\b/i],
//     firstname: [/first(?:\s|-)?name/i, /\bfname\b/i, /given.?name/i],
//     lastname: [/last(?:\s|-)?name/i, /\blname\b/i, /family.?name/i]
//   };

//   function getLabelText(el) {
//     try {
//       if (!el) return "";
//       const id = el.id;
//       if (id) {
//         const lab = document.querySelector(`label[for="${id}"]`);
//         if (lab) return lab.innerText || lab.textContent || "";
//       }
//       // try parent label
//       let p = el.parentElement;
//       for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
//         if (p.tagName && p.tagName.toLowerCase() === "label") {
//           return p.innerText || p.textContent || "";
//         }
//       }
//       // look for placeholder-esque siblings
//       return "";
//     } catch (e) {
//       return "";
//     }
//   }

//   // returns one of the role keys or null
//   function matchField(el) {
//     try {
//       if (!el) return null;
//       const attrs = [
//         el.name,
//         el.id,
//         el.placeholder,
//         el.getAttribute && el.getAttribute("aria-label"),
//         getLabelText(el)
//       ].filter(Boolean).join(" ").toLowerCase();

//       // check more specific patterns first (businessEmail, firstname, lastname)
//       if (patterns.businessEmail.some(rx => rx.test(attrs))) return "businessEmail";
//       if (patterns.firstname.some(rx => rx.test(attrs))) return "firstname";
//       if (patterns.lastname.some(rx => rx.test(attrs))) return "lastname";
//       if (patterns.fullname.some(rx => rx.test(attrs))) return "fullname";

//       // email / password / username etc.
//       if (patterns.email.some(rx => rx.test(attrs))) return "email";
//       if (patterns.username.some(rx => rx.test(attrs))) return "username";
//       if (patterns.password.some(rx => rx.test(attrs))) return "password";

//       // fallback by type
//       if (el.type === "email") return "email";
//       if (el.type === "password") return "password";

//     } catch (e) {
//       // ignore errors
//     }
//     return null;
//   }

//   function alreadyFilled(el) {
//     try {
//       if (!el) return false;
//       if (el.dataset && el.dataset.hyperfill === "1") return true;
//       if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
//         return !!(el.innerText && el.innerText.trim().length > 0);
//       }
//       return !!(el.value && el.value.trim().length > 0);
//     } catch (e) {
//       return false;
//     }
//   }

//   // Fill logic - return number of fields filled
//   function fillOnce(profile) {
//     if (!profile) return 0;

//     // prefer profile.profile object if stored that way
//     const p = profile.profile && typeof profile.profile === "object" ? profile.profile : profile;

//     // Compose a fallback fullname if firstname/lastname present
//     const first = p.firstname || p.firstName || p.givenName || "";
//     const last = p.lastname || p.lastName || p.familyName || "";
//     const fullnameFromParts = (first || last) ? `${(first||"").trim()} ${(last||"").trim()}`.trim() : "";
//     const fullnameValue = p.fullname || p.fullName || fullnameFromParts || "";

//     // prefer businessEmail when available, else fallback to submissionEmail/emailId
//     const bizEmail = p.businessEmail || p.workEmail || "";
//     const defaultEmail = p.submissionEmail || p.emailId || p.email || "";

//     const inputs = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//     let filled = 0;

//     // A two-phase approach:
//     // 1) First try to fill specific firstname/lastname/business fields
//     // 2) Then fill generic fullname/email/password/username
//     inputs.forEach(el => {
//       try {
//         if (alreadyFilled(el)) return;
//         const role = matchField(el);
//         if (!role) return;

//         let value = null;
//         if (role === "firstname") {
//           value = first || (fullnameValue ? fullnameValue.split(" ")[0] : "");
//         } else if (role === "lastname") {
//           value = last || (fullnameValue ? fullnameValue.split(" ").slice(1).join(" ") : "");
//         } else if (role === "businessEmail") {
//           value = bizEmail || defaultEmail;
//         } else if (role === "fullname") {
//           // prefer explicit fullname field: use full stored fullname (or compose)
//           value = fullnameValue;
//         } else if (role === "email") {
//           value = defaultEmail;
//         } else if (role === "username") {
//           value = p.username || p.user || "";
//         } else if (role === "password") {
//           // choose activePassword logic if profile object has activePassword flag
//           if (p.activePassword === "submissionPassword") value = p.submissionPassword || p.password2 || p.password || "";
//           else value = p.emailPassword || p.password1 || p.password || "";
//         }

//         if (!value) return;

//         // set value (contenteditable or input)
//         if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
//           el.focus && el.focus();
//           try { document.execCommand && document.execCommand('insertText', false, value); } catch(e){}
//           el.dataset.hyperfill = "1";
//           filled++;
//         } else {
//           el.focus && el.focus();
//           setNativeValue(el, value);
//           el.dataset.hyperfill = "1";
//           filled++;
//         }
//       } catch (err) {
//         console.warn("Autofill element error", err, el);
//       }
//     });

//     if (filled > 0) console.log("✅ Autofilled", filled, "fields (including name/email/businessEmail)");
//     return filled;
//   }

//   // rate limit/debounce
//   let lastRun = 0;
//   function tryFill(profile) {
//     const now = Date.now();
//     if (now - lastRun < 600) return;
//     lastRun = now;
//     try {
//       fillOnce(profile);
//     } catch (e) { console.warn("tryFill error", e); }
//   }

//   // start autofill by loading storage and attaching observers
//   function startAutofillWith(profile) {
//     if (!profile) return;
//     // initial attempts
//     setTimeout(() => tryFill(profile), 600);
//     setTimeout(() => tryFill(profile), 1400);

//     // MutationObserver to catch SPA/dynamic form loads
//     const observer = new MutationObserver(() => tryFill(profile));
//     try {
//       if (document.body) observer.observe(document.body, { childList: true, subtree: true });
//     } catch (e) { console.warn("Observer attach failed", e); }

//     // fallback repeated tries for a short period
//     let tries = 0;
//     const iv = setInterval(() => {
//       tryFill(profile);
//       tries++;
//       if (tries > 25) clearInterval(iv); // stop after ~50s
//     }, 2000);
//   }

//   // load profile from chrome.storage.local and start
//   function loadProfileAndStart() {
//     try {
//       chrome.storage.local.get(null, (res) => {
//         if (!res) {
//           console.warn("RowFiller: no storage result");
//           return;
//         }
//         if (res.profile && typeof res.profile === "object") {
//           startAutofillWith({ profile: res.profile });
//           return;
//         }
//         // if any of the keys exist, pass res
//         const anyKey = ["firstname","lastname","fullname","submissionEmail","emailId","businessEmail","password1","password2","emailPassword","submissionPassword","username"].some(k => res[k]);
//         if (anyKey) {
//           startAutofillWith(res);
//         } else {
//           // nothing to fill
//           // console.log("RowFiller: no credentials stored yet");
//         }
//       });
//     } catch (e) {
//       console.warn("loadProfileAndStart error", e);
//     }
//   }

//   // run on DOM ready
//   if (document.readyState === "complete" || document.readyState === "interactive") {
//     loadProfileAndStart();
//   } else {
//     window.addEventListener("DOMContentLoaded", loadProfileAndStart);
//   }

//   // watch for storage changes (popup edits profile while page open)
//   chrome.storage.onChanged.addListener((changes) => {
//     loadProfileAndStart();
//   });
// })();

// // content/autofill.js
// (function () {
//   if (window.__RowFiller_autofill_installed) return;
//   window.__RowFiller_autofill_installed = true;

//   if (location.hostname.includes("google.com")) {
//     console.warn("⛔ Skipping autofill on Google for security");
//     return;
//   }

//   function setNativeValue(el, value) {
//     const proto = Object.getPrototypeOf(el);
//     const desc = Object.getOwnPropertyDescriptor(proto, "value");
//     if (desc && desc.set) desc.set.call(el, value);
//     else el.value = value;
//     el.dispatchEvent(new Event("input", { bubbles: true }));
//     el.dispatchEvent(new Event("change", { bubbles: true }));
//   }

//   const patterns = {
//     email: [/email/i],
//     businessEmail: [/business/i, /work/i, /company/i],
//     username: [/user/i, /login/i],
//     password: [/pass/i, /pwd/i],
//     fullname: [/full.?name/i],
//     firstname: [/first.?name/i],
//     lastname: [/last.?name/i],
//     number: [/phone/i, /mobile/i, /contact/i, /\bnum/i],
//     address: [/address/i, /street/i],
//     city: [/city/i],
//     state: [/state/i, /province/i],
//     postcode: [/zip/i, /postal/i],
//     country: [/country/i],
//     location: [/location/i],
//   };

//   function matchField(el) {
//     const attrs = [el.name, el.id, el.placeholder, el.getAttribute("aria-label")]
//       .filter(Boolean).join(" ").toLowerCase();

//     for (const key in patterns) {
//       if (patterns[key].some(rx => rx.test(attrs))) return key;
//     }
//     if (el.type === "email") return "email";
//     if (el.type === "tel") return "number";
//     if (el.type === "password") return "password";
//     return null;
//   }

//   function fill(profile) {
//     if (!profile) return;
//     const p = profile.profile || profile;
//     const fullName = p.fullname || `${p.firstname || ""} ${p.lastname || ""}`.trim();

//     document.querySelectorAll("input, textarea,[contenteditable='true']").forEach(el => {
//       if (el.value) return;
//       const role = matchField(el);
//       if (!role) return;

//       let val = "";
//       switch (role) {
//         case "firstname": val = p.firstname; break;
//         case "lastname": val = p.lastname; break;
//         case "fullname": val = fullName; break;
//         case "email": val = p.email; break;
//         case "businessEmail": val = p.businessEmail || p.email; break;
//         case "username": val = p.username; break;
//         case "number": val = p.number; break;
//         case "password":
//           val = p.activePassword === "submissionPassword" ? p.submissionPassword : p.emailPassword;
//           break;
//         case "address": val = p.address; break;
//         case "city": val = p.city; break;
//         case "state": val = p.state; break;
//         case "postcode": val = p.postcode; break;
//         case "country": val = p.country; break;
//         case "location": val = p.location; break;
//       }

//       if (val) {
//         if (el.getAttribute("contenteditable") === "true") el.innerText = val;
//         else setNativeValue(el, val);
//       }
//     });
//   }

//   chrome.storage.local.get("profile", res => {
//     if (res.profile) fill({ profile: res.profile });
//   });
// })();

// // content/autofill.js
// (function () {
//   if (window.__RowFiller_autofill_installed) return;
//   window.__RowFiller_autofill_installed = true;
//   console.log("🔑 content/autofill.js loaded");

//   // If on google accounts page, do not auto-fill to avoid "not secure" notices
//   function isGoogleLogin() {
//     try {
//       const h = location.hostname || "";
//       return h.includes("accounts.google.com") || h.includes("google.com") && location.pathname.includes("/signin");
//     } catch (e) { return false; }
//   }
//   if (isGoogleLogin()) {
//     console.warn("Skipping autofill on Google auth pages.");
//     return;
//   }

//   function setNativeValue(el, value) {
//     try {
//       const proto = Object.getPrototypeOf(el);
//       const desc = Object.getOwnPropertyDescriptor(proto, "value");
//       if (desc && desc.set) desc.set.call(el, value);
//       else el.value = value;
//     } catch (e) {
//       try { el.value = value; } catch (e2) {}
//     }
//     el.dispatchEvent(new Event("input", { bubbles: true }));
//     el.dispatchEvent(new Event("change", { bubbles: true }));
//   }

//   const patterns = {
//     email: [/email/i, /\bmail\b/i, /e-?mail/i],
//     businessEmail: [/business/i, /work/i, /company/i, /office/i, /\bbiz\b/i],
//     username: [/(^|[^a-z])(user(name)?|login|handle|userid)([^a-z]|$)/i],
//     password: [/pass(word)?/i, /\bpwd\b/i],
//     fullname: [/full.?name/i],
//     firstname: [/first(?:\s|-)?name/i, /\bgiven.?name\b/i],
//     lastname: [/last(?:\s|-)?name/i, /\bfamily.?name\b/i],
//     number: [/phone/i, /mobile/i, /contact/i, /\btel\b/i],
//     address: [/address/i, /street/i, /\baddr\b/i],
//     city: [/city/i, /town/i],
//     state: [/state/i, /province/i, /region/i],
//     postcode: [/zip/i, /postal/i, /postcode/i, /pin/i],
//     country: [/country/i],
//     location: [/location/i, /place/i]
//   };

//   function getLabelText(el) {
//     try {
//       if (!el) return "";
//       const id = el.id;
//       if (id) {
//         const lab = document.querySelector(`label[for="${id}"]`);
//         if (lab) return lab.innerText || lab.textContent || "";
//       }
//       let p = el.parentElement;
//       for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
//         if (p.tagName && p.tagName.toLowerCase() === "label") return p.innerText || p.textContent || "";
//       }
//     } catch (e) {}
//     return "";
//   }

//   function matchField(el) {
//     try {
//       if (!el) return null;
//       const attrs = [
//         el.name,
//         el.id,
//         el.placeholder,
//         el.getAttribute && el.getAttribute("aria-label"),
//         getLabelText(el)
//       ].filter(Boolean).join(" ").toLowerCase();

//       // avoid url/profile link fields
//       if (/url|link|http|website|github|twitter/i.test(attrs)) return null;

//       for (const key of Object.keys(patterns)) {
//         const arr = patterns[key];
//         if (arr && arr.some(rx => rx.test(attrs))) return key;
//       }

//       // fallback by input type
//       if (el.type === "email") return "email";
//       if (el.type === "tel") return "number";
//       if (el.type === "password") return "password";
//     } catch (e) { /* ignore */ }
//     return null;
//   }

//   function alreadyFilled(el) {
//     try {
//       if (!el) return false;
//       if (el.dataset && el.dataset.hyperfill === "1") return true;
//       if (el.getAttribute && el.getAttribute("contenteditable") === "true") return !!(el.innerText && el.innerText.trim());
//       return !!(el.value && el.value.trim());
//     } catch (e) { return false; }
//   }

//   function fillWithProfile(p) {
//     if (!p) return 0;
//     const first = p.firstname || p.firstName || "";
//     const last = p.lastname || p.lastName || "";
//     const fullname = p.fullname || `${first} ${last}`.trim();
//     const bizEmail = p.businessEmail || "";
//     const defaultEmail = p.email || p.submissionEmail || p.emailId || "";
//     const phone = p.number || p.phone || "";

//     const nodes = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//     let count = 0;

//     // First pass: fill very specific fields (firstname, lastname, address parts)
//     nodes.forEach(el => {
//       try {
//         if (alreadyFilled(el)) return;
//         const role = matchField(el);
//         if (!role) return;

//         let val = "";
//         switch (role) {
//           case "firstname": val = first || (fullname ? fullname.split(" ")[0] : ""); break;
//           case "lastname": val = last || (fullname ? fullname.split(" ").slice(1).join(" ") : ""); break;
//           case "address": val = p.address || ""; break;
//           case "city": val = p.city || ""; break;
//           case "state": val = p.state || ""; break;
//           case "postcode": val = p.postcode || ""; break;
//           case "country": val = p.country || ""; break;
//           case "location": val = p.location || ""; break;
//         }
//         if (!val) return;
//         if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
//           el.focus && el.focus();
//           try { document.execCommand && document.execCommand('insertText', false, val); } catch(e){}
//         } else {
//           el.focus && el.focus();
//           setNativeValue(el, val);
//         }
//         el.dataset.hyperfill = "1";
//         count++;
//       } catch (e) { console.warn("fill error", e); }
//     });

//     // Second pass: fill generic fields (email, businessEmail, fullname, username, number, password)
//     nodes.forEach(el => {
//       try {
//         if (alreadyFilled(el)) return;
//         const role = matchField(el);
//         if (!role) return;

//         let val = "";
//         switch (role) {
//           case "fullname": val = fullname; break;
//           case "businessEmail": val = bizEmail || defaultEmail; break;
//           case "email": val = defaultEmail; break;
//           case "username": val = p.username || p.user || ""; break;
//           case "number": val = phone; break;
//           case "password":
//             val = p.activePassword === "submissionPassword" ? (p.submissionPassword || "") : (p.emailPassword || "");
//             break;
//         }
//         if (!val) return;
//         if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
//           el.focus && el.focus();
//           try { document.execCommand && document.execCommand('insertText', false, val); } catch(e){}
//         } else {
//           el.focus && el.focus();
//           setNativeValue(el, val);
//         }
//         el.dataset.hyperfill = "1";
//         count++;
//       } catch (e) { console.warn("fill error2", e); }
//     });

//     if (count > 0) console.log(`✅ RowFiller: autofilled ${count} fields`);
//     return count;
//   }

//   // Exposed fill entry points:
//   function tryFillProfile(profile) {
//     if (!profile) {
//       // read from storage
//       chrome.storage.local.get("profile", (res) => {
//         if (res && res.profile) fillWithProfile(res.profile);
//       });
//     } else {
//       fillWithProfile(profile);
//     }
//   }

//   // Listen to messages from background/popup (manual trigger)
//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (!msg) return;
//     if (msg.action === "autofillAuth") {
//       // If profile passed in message, use it; else auto-read
//       tryFillProfile(msg.profile || null);
//       sendResponse({ ok: true });
//     }
//   });

//   // Also listen to DOM event (if background injects via custom event)
//   document.addEventListener("RowFillerTrigger", (ev) => {
//     tryFillProfile(ev && ev.detail ? ev.detail : null);
//   });

//   // Run automatically at load if profile exists
//   chrome.storage.local.get("profile", (res) => {
//     if (res && res.profile) {
//       // Slight delay to let SPA forms render
//       setTimeout(() => fillWithProfile(res.profile), 700);
//       setTimeout(() => fillWithProfile(res.profile), 1600);
//     }
//   });

//   // Watch for storage changes (popup edited)
//   chrome.storage.onChanged.addListener((changes) => {
//     if (changes.profile && changes.profile.newValue) {
//       setTimeout(() => fillWithProfile(changes.profile.newValue), 300);
//     }
//   });

//   // Mutation observer for dynamic pages
//   try {
//     const observer = new MutationObserver(() => {
//       chrome.storage.local.get("profile", (res) => {
//         if (res && res.profile) fillWithProfile(res.profile);
//       });
//     });
//     if (document.body) observer.observe(document.body, { childList: true, subtree: true });
//   } catch (e) { /* ignore */ }
// })();

// // content/autofill.js (improved matching + autocomplete handling)
// (function () {
//   if (window.__RowFiller_autofill_installed) return;
//   window.__RowFiller_autofill_installed = true;
//   console.log("🔑 content/autofill.js loaded (improved)");

//   function isGoogleLogin() {
//     try {
//       const h = location.hostname || "";
//       return (h.includes("accounts.google.com") || (h.includes("google.com") && location.pathname.includes("/signin")));
//     } catch (e) { return false; }
//   }
//   if (isGoogleLogin()) {
//     console.warn("Skipping autofill on Google auth pages.");
//     return;
//   }

//   function setNativeValue(el, value) {
//     try {
//       const proto = Object.getPrototypeOf(el);
//       const desc = Object.getOwnPropertyDescriptor(proto, "value");
//       if (desc && desc.set) desc.set.call(el, value);
//       else el.value = value;
//     } catch (e) {
//       try { el.value = value; } catch (e2) {}
//     }
//     el.dispatchEvent(new Event("input", { bubbles: true }));
//     el.dispatchEvent(new Event("change", { bubbles: true }));
//   }

//   // Patterns & mapping
//   const patterns = {
//     email: [/email/i, /\bmail\b/i, /e-?mail/i],
//     businessEmail: [/business.*email/i, /work.*email/i, /\bcompany.*email\b/i],
//     username: [/(^|[^a-z0-9])(user(name)?|login|handle|userid)([^a-z0-9]|$)/i, /\buname\b/i],
//     password: [/pass(word)?/i, /\bpwd\b/i],
//     fullname: [/\bfull(?:\s|-)?name\b/i, /^\bname\b$/i, /\bdisplay name\b/i, /\borganisation name\b/i],
//     firstname: [/first(?:\s|-)?name/i, /\bgiven-name\b/i, /\bgiven\b/i, /\bfname\b/i, /given-name/i],
//     lastname: [/last(?:\s|-)?name/i, /\bfamily-name\b/i, /\blastname\b/i, /\blname\b/i, /family-name/i],
//     phone: [/\bphone\b/i, /\bmobile\b/i, /\bcontact\b/i, /\btel\b/i, /\bphone ?no\b/i, /\bph\b/],
//     address: [/address|street|street-?address|addr|streetaddress/i, /street-address/i],
//     city: [/\bcity\b/i, /\btown\b/i, /address-level2/i],
//     state: [/\bstate\b/i, /\bprovince\b/i, /\bregion\b/i, /address-level1/i],
//     postcode: [/zip|postal|postcode|pin|postal-code|postalcode|postalcode/i, /postal-code/i, /postalcode/i],
//     country: [/\bcountry\b/i],
//     location: [/\blocation\b/i, /\bplace\b/i, /\barea\b/i, /\bzone\b/i, /\blat\b|\blong\b|\bgeo\b/i],
//     facebook: [/facebook|fb\.com/i],
//     linkedin: [/linkedin|linkedin\.com/i],
//     instagram: [/instagram|insta/i],
//     twitter: [/twitter|tweet/i],
//     youtube: [/youtube|youtu\.be/i],
//     category: [/\bcategory\b|\bcat\b/i],
//     subcategory: [/sub[-\s]?category|subcat/i],
//     title: [/^title\b|headline|post title|listing title/i],
//     description: [/description|about\b|bio\b|summary|details|overview|about us|business description/i],
//   };

//   function getLabelText(el) {
//     try {
//       if (!el) return "";
//       const id = el.id;
//       if (id) {
//         const lab = document.querySelector(`label[for="${id}"]`);
//         if (lab) return lab.innerText || lab.textContent || "";
//       }
//       let p = el.parentElement;
//       for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
//         if (p.tagName && p.tagName.toLowerCase() === "label") return p.innerText || p.textContent || "";
//       }
//       // try aria-labelledby
//       const labId = el.getAttribute && el.getAttribute("aria-labelledby");
//       if (labId) {
//         const ref = document.getElementById(labId);
//         if (ref) return ref.innerText || ref.textContent || "";
//       }
//     } catch (e) {}
//     return "";
//   }

//   function isPotentialCompanyField(attrs) {
//     return /\b(company|organization|organisation|org|business|business ?name|company ?name)\b/i.test(attrs);
//   }

//   // Map autocomplete attribute values to roles (strong signal)
//   function mapAutocompleteToRole(ac) {
//     if (!ac) return null;
//     const a = ac.toLowerCase().trim();
//     if (a === "given-name" || a === "given_name" || a === "givenname") return "firstname";
//     if (a === "family-name" || a === "family_name" || a === "familyname") return "lastname";
//     if (a === "name" || a === "honorific-prefix" || a === "nickname") return "fullname";
//     if (a === "email") return "email";
//     if (a === "tel" || a === "telephone") return "phone";
//     if (a === "street-address" || a === "address-line1" || a === "address-line2" || a === "address") return "address";
//     if (a === "postal-code" || a === "zip") return "postcode";
//     if (a === "address-level1") return "state";
//     if (a === "address-level2") return "city";
//     if (a === "country") return "country";
//     if (a === "organization" || a === "organization-title") return null;
//     return null;
//   }

//   function matchField(el) {
//     try {
//       if (!el) return null;
//       // skip hidden/disabled inputs
//       if (el.disabled) return null;
//       if (el.type && (el.type.toLowerCase() === "hidden" || el.type.toLowerCase() === "submit" || el.type.toLowerCase() === "button" || el.type.toLowerCase() === "image")) return null;

//       const name = el.name || "";
//       const id = el.id || "";
//       const placeholder = el.placeholder || "";
//       const aria = (el.getAttribute && el.getAttribute("aria-label")) || "";
//       const label = getLabelText(el) || "";
//       const attrs = [name, id, placeholder, aria, label].filter(Boolean).join(" ").toLowerCase();

//       // 1) strong signal: autocomplete
//       try {
//         const ac = el.autocomplete;
//         const roleFromAuto = mapAutocompleteToRole(ac);
//         if (roleFromAuto) return roleFromAuto;
//       } catch (e) {}

//       // 2) if element has inputmode or type tel/email etc.
//       if (el.type === "email") return "email";
//       if (el.type === "tel") return "phone";
//       if (el.tagName && el.tagName.toLowerCase() === "textarea") {
//         // consider description or address
//         if (/\baddress|street|addr\b/.test(attrs)) return "address";
//         if (/\bdescription|about|bio|summary|details|overview\b/.test(attrs)) return "description";
//       }

//       // 3) avoid URL / profile fields unless specifically social
//       if (/url|link|http|website|github|portfolio/.test(attrs) && !(/facebook|instagram|linkedin|twitter|youtube/.test(attrs))) {
//         // keep going (some social inputs include "URL")
//       }

//       // scoring approach
//       const tokens = attrs.split(/[^a-z0-9]+/).filter(Boolean);
//       const scores = {};
//       for (const key of Object.keys(patterns)) {
//         scores[key] = 0;
//         const arr = patterns[key];
//         if (!arr) continue;
//         for (const rx of arr) {
//           if (rx.test(attrs)) scores[key] += 3;
//           for (const t of tokens) {
//             try { if (rx.test(t)) scores[key] += 1; } catch (e) {}
//           }
//         }
//         if (id && id.toLowerCase() === key.toLowerCase()) scores[key] += 4;
//         if (name && name.toLowerCase() === key.toLowerCase()) scores[key] += 4;
//       }

//       // If an exact token like 'given' or 'family' present
//       if (/\bgiven\b/.test(attrs) && scores.firstname <= 0) scores.firstname += 2;
//       if (/\bfamily\b/.test(attrs) && scores.lastname <= 0) scores.lastname += 2;

//       // pick best
//       let best = null, bestScore = 0;
//       for (const [k, v] of Object.entries(scores)) {
//         if (v > bestScore) { best = k; bestScore = v; }
//       }

//       if (!best || bestScore < 3) return null; // require minimum confidence

//       // Safety rules
//       if (isPotentialCompanyField(attrs) && ["businessEmail", "email", "username"].includes(best)) return null;
//       if (["facebook","linkedin","instagram","twitter","youtube"].includes(best) && el.type === "email") return null;
//       if (best === "username" && isPotentialCompanyField(attrs)) return null;

//       // If it's a generic "name" field without first/last tokens, treat as fullname
//       if (/\bname\b/.test(attrs) && !/\bfirst|\blast\b/.test(attrs)) {
//         if (best !== "firstname" && best !== "lastname") best = "fullname";
//       }

//       return best;
//     } catch (e) {
//       return null;
//     }
//   }

//   function alreadyFilled(el) {
//     try {
//       if (!el) return false;
//       if (el.dataset && el.dataset.hyperfill === "1") return true;
//       if (el.getAttribute && el.getAttribute("contenteditable") === "true") return !!(el.innerText && el.innerText.trim());
//       // some selects/checkboxes might have value = ''
//       return !!(el.value !== undefined && el.value !== null && el.value.toString().trim());
//     } catch (e) { return false; }
//   }

//   function fillWithProfile(p) {
//     if (!p) return 0;
//     const profile = p.profile || p;

//     const vals = {
//       firstname: profile.firstname || profile.firstName || "",
//       lastname: profile.lastname || profile.lastName || "",
//       fullname: profile.fullname || [profile.firstname || profile.firstName, profile.lastname || profile.lastName].filter(Boolean).join(" ").trim() || profile.name || "",
//       email: profile.email || profile.submissionEmail || profile.emailId || "",
//       businessEmail: profile.businessEmail || "",
//       username: profile.username || profile.user || "",
//       phone: profile.phone || profile.number || profile.mobile || "",
//       address: profile.address || "",
//       city: profile.city || "",
//       state: profile.state || "",
//       postcode: profile.postcode || profile.pin || "",
//       country: profile.country || "",
//       location: profile.location || "",
//       facebook: profile.facebook || profile.fb || "",
//       linkedin: profile.linkedin || "",
//       instagram: profile.instagram || profile.insta || "",
//       twitter: profile.twitter || profile.twitterHandle || "",
//       youtube: profile.youtube || "",
//       category: profile.category || "",
//       subcategory: profile.subcategory || profile.subCategory || "",
//       title: profile.title || "",
//       description: profile.description || profile.about || profile.bio || "",
//       password: (profile.activePassword === "submissionPassword" ? (profile.submissionPassword || "") : (profile.emailPassword || ""))
//     };

//     const nodes = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//     let count = 0;

//     // First pass: fill strongly matching/address/social fields
//     nodes.forEach(el => {
//       try {
//         if (alreadyFilled(el)) return;
//         const role = matchField(el);
//         if (!role) return;

//         const valCandidates = {
//           firstname: vals.firstname,
//           lastname: vals.lastname,
//           address: vals.address,
//           city: vals.city,
//           state: vals.state,
//           postcode: vals.postcode,
//           country: vals.country,
//           location: vals.location,
//           facebook: vals.facebook,
//           linkedin: vals.linkedin,
//           instagram: vals.instagram,
//           twitter: vals.twitter,
//           youtube: vals.youtube,
//           category: vals.category,
//           subcategory: vals.subcategory,
//           title: vals.title,
//           description: vals.description,
//         };

//         const val = valCandidates[role];
//         if (!val) return;

//         const isTextareaLike = (el.tagName && el.tagName.toLowerCase() === "textarea") ||
//                               (el.getAttribute && el.getAttribute("contenteditable") === "true") ||
//                               (el.rows && parseInt(el.rows, 10) > 1);

//         // description: prefer textarea-like input
//         if (role === "description" && !isTextareaLike) {
//           if (!/description|about|bio|summary|details|overview/i.test((el.placeholder || "") + " " + getLabelText(el))) return;
//         }

//         el.focus && el.focus();
//         if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
//           try { document.execCommand && document.execCommand('insertText', false, val); } catch (e) { el.innerText = val; }
//         } else {
//           setNativeValue(el, val);
//         }
//         if (el.dataset) el.dataset.hyperfill = "1";
//         count++;
//       } catch (e) {
//         console.warn("fill error (first pass)", e);
//       }
//     });

//     // Second pass: generic fields (fullname, email, businessEmail, username, phone, password)
//     nodes.forEach(el => {
//       try {
//         if (alreadyFilled(el)) return;
//         // Some pages use name/id like 'name' for a single field -> prefer fullname there
//         const role = matchField(el) || (/\bname\b/.test((el.name||"")+" "+(el.id||"")+" "+(el.placeholder||"")+" "+getLabelText(el)) ? "fullname" : null);
//         if (!role) return;

//         const valMap = {
//           fullname: vals.fullname,
//           businessEmail: vals.businessEmail || vals.email,
//           email: vals.email,
//           username: vals.username,
//           phone: vals.phone,
//           password: vals.password
//         };

//         const val = valMap[role];
//         if (!val) return;

//         const attrs = [el.name, el.id, el.placeholder, el.getAttribute && el.getAttribute("aria-label"), getLabelText(el)].filter(Boolean).join(" ").toLowerCase();
//         if (isPotentialCompanyField(attrs) && (role === "email" || role === "businessEmail" || role === "username")) return;

//         el.focus && el.focus();
//         if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
//           try { document.execCommand && document.execCommand('insertText', false, val); } catch(e){ el.innerText = val; }
//         } else {
//           setNativeValue(el, val);
//         }
//         if (el.dataset) el.dataset.hyperfill = "1";
//         count++;
//       } catch (e) { console.warn("fill error (second pass)", e); }
//     });

//     if (count > 0) console.log(`✅ RowFiller: autofilled ${count} fields`);
//     else console.log("RowFiller: nothing matched to fill");

//     return count;
//   }

//   // Message listener
//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (!msg) return;
//     if (msg.action === "autofillAuth" || msg.action === "autofillProfile") {
//       if (msg.profile) {
//         try {
//           const c = fillWithProfile(msg.profile);
//           sendResponse({ ok: c > 0, filled: c });
//         } catch (e) {
//           sendResponse({ ok: false, error: e && e.message });
//         }
//       } else {
//         chrome.storage.local.get("profile", (res) => {
//           const p = (res && res.profile) || null;
//           const c = p ? fillWithProfile(p) : 0;
//           sendResponse({ ok: c > 0, filled: c });
//         });
//         return true; // async
//       }
//     }
//   });

//   // Auto-run at load
//   chrome.storage.local.get("profile", (res) => {
//     if (res && res.profile) {
//       setTimeout(() => fillWithProfile(res.profile), 700);
//       setTimeout(() => fillWithProfile(res.profile), 1600);
//     }
//   });

//   // Watch storage changes
//   chrome.storage.onChanged.addListener((changes) => {
//     if (changes.profile && changes.profile.newValue) {
//       setTimeout(() => fillWithProfile(changes.profile.newValue), 300);
//     }
//   });

//   // gentle mutation observer for SPA pages
//   try {
//     const observer = new MutationObserver(() => {
//       chrome.storage.local.get("profile", (res) => {
//         if (res && res.profile) fillWithProfile(res.profile);
//       });
//     });
//     if (document.body) observer.observe(document.body, { childList: true, subtree: true });
//   } catch (e) { /* ignore */ }
// })();

// // content/autofill.js (strict matching, no empty-field username fallback)
// (function () {
//   if (window.__RowFiller_autofill_installed) return;
//   window.__RowFiller_autofill_installed = true;
//   console.log("🔑 content/autofill.js loaded (strict)");

//   // small debounce helper
//   function debounce(fn, wait) {
//     let t = null;
//     return function () { clearTimeout(t); t = setTimeout(() => fn.apply(this, arguments), wait); };
//   }

//   function isGoogleLogin() {
//     try {
//       const h = location.hostname || "";
//       return (h.includes("accounts.google.com") || (h.includes("google.com") && location.pathname.includes("/signin")));
//     } catch (e) { return false; }
//   }
//   if (isGoogleLogin()) {
//     console.warn("Skipping autofill on Google auth pages.");
//     return;
//   }

//   function setNativeValue(el, value) {
//     try {
//       const proto = Object.getPrototypeOf(el);
//       const desc = Object.getOwnPropertyDescriptor(proto, "value");
//       if (desc && desc.set) desc.set.call(el, value);
//       else el.value = value;
//     } catch (e) { try { el.value = value; } catch (e2) {} }
//     el.dispatchEvent(new Event("input", { bubbles: true }));
//     el.dispatchEvent(new Event("change", { bubbles: true }));
//   }

//   // Strong patterns (only match username when explicit)
//   const PATTERNS = {
//     email: [/^email$|email\b|e-?mail|\bmail\b/i],
//     businessEmail: [/\bbusiness\b.*email|work.*email|company.*email|office.*email/i],
//     username: [/\buser(name)?\b|\buname\b|\blogin\b|\bhandle\b|\bnick(name)?\b/i],
//     password: [/pass(word)?|pwd/i],
//     fullname: [/\bfull ?name\b|\bdisplay name\b/i],
//     firstname: [/^first ?name$|^given ?name$|given-name|\bgiven\b/i],
//     lastname: [/^last ?name$|^family ?name$|family-name|\blast\b|\bsurname\b/i],
//     phone: [/phone|mobile|contact|tel|^phone$/i],
//     address: [/address|street|street-?address|addr/i],
//     city: [/city|town|address-level2/i],
//     state: [/state|province|region|address-level1/i],
//     postcode: [/zip|postal|postcode|pin|postal-code/i],
//     country: [/country/i],
//     location: [/location|place|area|zone/i],
//     facebook: [/facebook|fb\.com/i],
//     linkedin: [/linkedin|linkedin\.com/i],
//     instagram: [/instagram|insta/i],
//     twitter: [/twitter|tweet/i],
//     youtube: [/youtube|youtu\.be/i],
//     description: [/description|about|bio|summary|details|overview|about us/i],
//     website: [/website|web|url|site|homepage|link/i],
//     category: [/\bcategory\b|\bcat\b/i],
//     subcategory: [/sub[-\s]?category|subcat/i],
//     title: [/^title\b|headline|post title|listing title/i]
//   };

//   function mapAutocomplete(ac) {
//     if (!ac) return null;
//     ac = ac.toLowerCase().trim();
//     if (ac.includes("given")) return "firstname";
//     if (ac.includes("family") || ac.includes("last")) return "lastname";
//     if (ac === "name" || ac.includes("honorific") || ac.includes("nickname")) return "fullname";
//     if (ac.includes("email")) return "email";
//     if (ac.includes("tel")) return "phone";
//     if (ac.includes("street") || ac.includes("address")) return "address";
//     if (ac.includes("postal") || ac.includes("zip")) return "postcode";
//     if (ac.includes("address-level1")) return "state";
//     if (ac.includes("address-level2")) return "city";
//     if (ac.includes("country")) return "country";
//     return null;
//   }

//   function getLabelText(el) {
//     try {
//       if (!el) return "";
//       const id = el.id;
//       if (id) {
//         const lab = document.querySelector(`label[for="${id}"]`);
//         if (lab) return lab.innerText || lab.textContent || "";
//       }
//       let p = el.parentElement;
//       for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
//         if (p.tagName && p.tagName.toLowerCase() === "label") return p.innerText || p.textContent || "";
//       }
//       const labId = el.getAttribute && el.getAttribute("aria-labelledby");
//       if (labId) {
//         const ref = document.getElementById(labId);
//         if (ref) return ref.innerText || ref.textContent || "";
//       }
//     } catch (e) {}
//     return "";
//   }

//   function isCompanyField(attrs) {
//     return /\b(company|organization|organisation|org|business|business ?name|company ?name)\b/i.test(attrs);
//   }

//   // Return role or null (strict)
//   function matchField(el) {
//     try {
//       if (!el) return null;
//       if (el.disabled) return null;
//       const tag = (el.tagName || "").toLowerCase();
//       const type = (el.type || "").toLowerCase();

//       // ignore irrelevant input types
//       if (["hidden","submit","button","image","reset"].includes(type)) return null;

//       const ac = (el.getAttribute && el.getAttribute("autocomplete")) || "";
//       const acRole = mapAutocomplete(ac);
//       if (acRole) return acRole;

//       const name = (el.name || "").toString();
//       const id = (el.id || "").toString();
//       const placeholder = (el.placeholder || "").toString();
//       const aria = (el.getAttribute && el.getAttribute("aria-label")) || "";
//       const label = getLabelText(el) || "";
//       const attrs = [name, id, placeholder, aria, label].filter(Boolean).join(" ").toLowerCase();

//       // If element type gives a strong signal:
//       if (type === "email" || attrs.includes("type=email")) return "email";
//       if (type === "tel") return "phone";
//       if (type === "password") return "password";
//       if (tag === "textarea") {
//         if (PATTERNS.description.some(rx => rx.test(attrs + " " + placeholder + " " + label))) return "description";
//         if (PATTERNS.address.some(rx => rx.test(attrs + " " + placeholder + " " + label))) return "address";
//       }

//       // Check patterns: require an explicit match for sensitive fields
//       // Evaluate each pattern; choose one only if it has explicit token matches
//       for (const [role, arr] of Object.entries(PATTERNS)) {
//         for (const rx of arr) {
//           if (rx.test(attrs)) {
//             // Extra guards:
//             if (role === "username") {
//               // username must not be generic - require explicit tokens (already ensured by pattern)
//               if (type === "email" || type === "tel") return null;
//               return "username";
//             }
//             if (role === "email") return "email";
//             if (role === "businessEmail") return "businessEmail";
//             if (role === "password") {
//               if (type === "password") return "password";
//               // if not password type but labeled 'password' - be cautious and skip
//               return null;
//             }
//             if (role === "description") return "description";
//             if (role === "website") return "website";
//             if (role === "fullname") return "fullname";
//             if (role === "firstname") return "firstname";
//             if (role === "lastname") return "lastname";
//             if (role === "address") return "address";
//             if (role === "city") return "city";
//             if (role === "state") return "state";
//             if (role === "postcode") return "postcode";
//             if (role === "country") return "country";
//             if (role === "location") return "location";
//             if (["facebook","linkedin","instagram","twitter","youtube"].includes(role)) return role;
//             if (role === "phone") return "phone";
//             if (role === "title") return "title";
//             if (role === "category") return "category";
//             if (role === "subcategory") return "subcategory";
//           }
//         }
//       }

//       // fallback: if attribute exactly equals known names (strict)
//       const exact = attrs.split(/\s+/);
//       if (exact.includes("name") && !/\bfirst\b|\blast\b|\bgiven\b|\bfamily\b/.test(attrs)) return "fullname";
//       if (exact.includes("firstname") || exact.includes("givenname") || exact.includes("given-name")) return "firstname";
//       if (exact.includes("lastname") || exact.includes("surname") || exact.includes("familyname")) return "lastname";
//       if (/\bemail\b/.test(attrs)) return "email";

//       return null;
//     } catch (e) {
//       return null;
//     }
//   }

//   function alreadyFilled(el) {
//     try {
//       if (!el) return false;
//       if (el.dataset && el.dataset.hyperfill === "1") return true;
//       if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
//         return !!(el.innerText && el.innerText.trim());
//       }
//       const v = el.value;
//       return (v !== undefined && v !== null && v.toString().trim() !== "");
//     } catch (e) { return false; }
//   }

//   function isAutofillEnabled(callback) {
//     try {
//       chrome.storage.local.get("autofillEnabled", (res) => {
//         const enabled = (res && res.autofillEnabled !== undefined) ? res.autofillEnabled : true;
//         callback(!!enabled);
//       });
//     } catch (e) { callback(true); }
//   }

//   // main fill function (strict)
//   function fillWithProfile(p) {
//     if (!p) return 0;
//     const profile = p.profile || p;
//     const activePassword = profile.activePassword || "emailPassword";

//     const vals = {
//       firstname: profile.firstname || profile.firstName || "",
//       lastname: profile.lastname || profile.lastName || "",
//       fullname: profile.fullname || [profile.firstname || "", profile.lastname || ""].filter(Boolean).join(" ").trim() || profile.name || "",
//       email: profile.email || profile.submissionEmail || "",
//       businessEmail: profile.businessEmail || "",
//       username: profile.username || profile.user || "",
//       phone: profile.phone || profile.number || "",
//       address: profile.address || "",
//       city: profile.city || "",
//       state: profile.state || "",
//       postcode: profile.postcode || profile.pin || "",
//       country: profile.country || "",
//       location: profile.location || "",
//       facebook: profile.facebook || "",
//       linkedin: profile.linkedin || "",
//       instagram: profile.instagram || profile.insta || "",
//       twitter: profile.twitter || profile.twitterHandle || "",
//       youtube: profile.youtube || "",
//       title: profile.title || "",
//       description: profile.description || profile.about || profile.bio || "",
//       website: profile.website || ""
//     };

//     // password selection
//     const passwordValue = (activePassword === "submissionPassword" ? (profile.submissionPassword || "") : (profile.emailPassword || ""));

//     const nodes = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//     let filled = 0;

//     // First pass: strict matches for address/social/description/phone/title/category etc.
//     nodes.forEach(el => {
//       try {
//         if (!el || alreadyFilled(el)) return;
//         const role = matchField(el);
//         if (!role) return;

//         // map role to candidate value
//         const candidate = {
//           firstname: vals.firstname,
//           lastname: vals.lastname,
//           fullname: vals.fullname,
//           address: vals.address,
//           city: vals.city,
//           state: vals.state,
//           postcode: vals.postcode,
//           country: vals.country,
//           location: vals.location,
//           facebook: vals.facebook,
//           linkedin: vals.linkedin,
//           instagram: vals.instagram,
//           twitter: vals.twitter,
//           youtube: vals.youtube,
//           phone: vals.phone,
//           title: vals.title,
//           description: vals.description,
//           category: vals.category,
//           subcategory: vals.subcategory,
//           website: vals.website
//         }[role];

//         if (!candidate) return;

//         // description -> prefer textarea-like
//         if (role === "description") {
//           const isTextArea = (el.tagName && el.tagName.toLowerCase() === "textarea") || ((el.rows && parseInt(el.rows,10)>1));
//           if (!isTextArea) return;
//         }

//         // website: do not fill if element type is email or tel
//         if (role === "website") {
//           if (el.type && el.type === "email") return;
//         }

//         el.focus && el.focus();
//         if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
//           try { document.execCommand && document.execCommand('insertText', false, candidate); } catch(e) { el.innerText = candidate; }
//         } else {
//           setNativeValue(el, candidate);
//         }
//         if (el.dataset) el.dataset.hyperfill = "1";
//         filled++;
//       } catch (e) {
//         console.warn("first-pass fill error", e);
//       }
//     });

//     // Second pass: protected generic fields (email/businessEmail/username/password/fullname)
//     nodes.forEach(el => {
//       try {
//         if (!el || alreadyFilled(el)) return;
//         const role = matchField(el);
//         if (!role) {
//           // also detect generic "name" fields (single field for full name)
//           const attrs = [el.name, el.id, el.placeholder, el.getAttribute && el.getAttribute("aria-label"), getLabelText(el)].filter(Boolean).join(" ").toLowerCase();
//           if (/\bname\b/.test(attrs) && !/\bfirst|\blast|given|family\b/.test(attrs)) {
//             // treat as fullname only if we have fullname
//             if (vals.fullname) {
//               if (el.tagName && el.tagName.toLowerCase() === "input" && el.type === "text") {
//                 setNativeValue(el, vals.fullname);
//                 if (el.dataset) el.dataset.hyperfill = "1";
//                 filled++;
//               }
//             }
//           }
//           return;
//         }

//         // handle password - only fill password fields
//         if (role === "password") {
//           if (!(el.type && el.type.toLowerCase() === "password")) return;
//           if (!passwordValue) return;
//           setNativeValue(el, passwordValue);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++;
//           return;
//         }

//         // email logic: prefer businessEmail for business-labeled fields
//         if (role === "businessEmail" || (role === "email")) {
//           const attrs = [el.name, el.id, el.placeholder, el.getAttribute && el.getAttribute("aria-label"), getLabelText(el)].filter(Boolean).join(" ").toLowerCase();
//           // do not fill email into URL fields or textareas
//           if ((el.tagName && el.tagName.toLowerCase() === "textarea") || el.type === "url") return;

//           // if this is clearly a company/business field, use businessEmail
//           if (isCompanyField(attrs) || role === "businessEmail") {
//             if (!vals.businessEmail) return;
//             setNativeValue(el, vals.businessEmail);
//             if (el.dataset) el.dataset.hyperfill = "1";
//             filled++;
//             return;
//           }

//           // otherwise fill normal email if available
//           if (vals.email) {
//             setNativeValue(el, vals.email);
//             if (el.dataset) el.dataset.hyperfill = "1";
//             filled++;
//           }
//           return;
//         }

//         // username: only fill if element explicitly indicates username/login/handle
//         if (role === "username") {
//           if (!vals.username) return;
//           // strict: avoid filling into email/tel/url fields
//           if (el.type && ["email","tel","url"].includes(el.type.toLowerCase())) return;
//           setNativeValue(el, vals.username);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++;
//           return;
//         }

//         // fullname / firstname / lastname (only when clearly matched)
//         if (role === "fullname") {
//           if (!vals.fullname) return;
//           if (el.tagName && el.tagName.toLowerCase() === "input") {
//             setNativeValue(el, vals.fullname);
//             if (el.dataset) el.dataset.hyperfill = "1";
//             filled++;
//           }
//           return;
//         }
//         if (role === "firstname") {
//           if (!vals.firstname) return;
//           setNativeValue(el, vals.firstname);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++;
//           return;
//         }
//         if (role === "lastname") {
//           if (!vals.lastname) return;
//           setNativeValue(el, vals.lastname);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++;
//           return;
//         }

//       } catch (e) {
//         console.warn("second-pass fill error", e);
//       }
//     });

//     if (filled > 0) console.log(`✅ RowFiller autofilled ${filled} fields (strict checks)`);
//     else console.log("RowFiller: nothing matched (strict mode)");

//     return filled;
//   }

//   // Public message listener
//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (!msg) return;
//     if (msg.action === "toggleAutofill") {
//       // noop here - content scripts rely on storage change; but update DEBUG
//       console.log("Autofill toggle message:", msg.enabled);
//       sendResponse({ ok: true });
//       return;
//     }

//     if (msg.action === "autofillAuth" || msg.action === "autofillProfile") {
//       // Check enabled
//       chrome.storage.local.get("autofillEnabled", (res) => {
//         const enabled = (res && res.autofillEnabled !== undefined) ? res.autofillEnabled : true;
//         if (!enabled) {
//           sendResponse({ ok: false, filled: 0, error: "disabled" });
//           return;
//         }
//         if (msg.profile) {
//           try {
//             const filled = fillWithProfile(msg.profile);
//             sendResponse({ ok: filled > 0, filled });
//           } catch (e) {
//             sendResponse({ ok: false, error: (e && e.message) || "error" });
//           }
//         } else {
//           chrome.storage.local.get("profile", (r) => {
//             const profile = (r && r.profile) || null;
//             if (!profile) {
//               sendResponse({ ok: false, filled: 0, error: "no_profile" });
//               return;
//             }
//             try {
//               const filled = fillWithProfile(profile);
//               sendResponse({ ok: filled > 0, filled });
//             } catch (e) {
//               sendResponse({ ok: false, error: (e && e.message) || "error" });
//             }
//           });
//           return true; // async
//         }
//       });
//       return true;
//     }
//   });

//   // Auto-run on load if enabled AND profile exists (debounced)
//   const debouncedAuto = debounce(() => {
//     chrome.storage.local.get(["autofillEnabled","profile"], (res) => {
//       const enabled = (res && res.autofillEnabled !== undefined) ? res.autofillEnabled : true;
//       const profile = (res && res.profile) || null;
//       if (!enabled) {
//         console.log("Autofill disabled (content script).");
//         return;
//       }
//       if (profile) {
//         try { fillWithProfile(profile); } catch (e) { console.warn("auto fill error", e); }
//       }
//     });
//   }, 800);

//   // initial attempt (small delays to allow SPA rendering)
//   setTimeout(debouncedAuto, 700);
//   setTimeout(debouncedAuto, 1600);

//   // watch storage changes
//   chrome.storage.onChanged.addListener((changes) => {
//     if (changes.autofillEnabled) {
//       console.log("autofillEnabled changed:", changes.autofillEnabled.newValue);
//       if (changes.autofillEnabled.newValue) debouncedAuto();
//     }
//     if (changes.profile && changes.profile.newValue) {
//       debouncedAuto();
//     }
//   });

//   // debounced mutation observer
//   try {
//     let obsTimer = null;
//     const observer = new MutationObserver(() => {
//       if (obsTimer) clearTimeout(obsTimer);
//       obsTimer = setTimeout(() => {
//         chrome.storage.local.get(["autofillEnabled","profile"], (res) => {
//           const enabled = (res && res.autofillEnabled !== undefined) ? res.autofillEnabled : true;
//           const profile = (res && res.profile) || null;
//           if (enabled && profile) {
//             try { fillWithProfile(profile); } catch (e) { console.warn("mutation fill error", e); }
//           }
//         });
//       }, 600);
//     });
//     if (document.body) observer.observe(document.body, { childList: true, subtree: true });
//   } catch (e) { /* ignore */ }
// })();

// // content/autofill.js (wide regex + strict rules)
// (function () {
//   if (window.__RowFiller_autofill_installed) return;
//   window.__RowFiller_autofill_installed = true;
//   console.log("🔑 content/autofill.js loaded (wide+strict)");

//   function debounce(fn, wait) {
//     let t = null;
//     return function () { clearTimeout(t); t = setTimeout(() => fn.apply(this, arguments), wait); };
//   }

//   function setNativeValue(el, value) {
//     try {
//       const proto = Object.getPrototypeOf(el);
//       const desc = Object.getOwnPropertyDescriptor(proto, "value");
//       if (desc && desc.set) desc.set.call(el, value);
//       else el.value = value;
//     } catch (e) { try { el.value = value; } catch (e2) {} }
//     el.dispatchEvent(new Event("input", { bubbles: true }));
//     el.dispatchEvent(new Event("change", { bubbles: true }));
//   }

//   // Regex patterns (expanded firstname/lastname, strict username/email)
//   const PATTERNS = {
//     firstname: [/\bfirst\s*name\b/i, /\bfname\b/i, /\bfirst_name\b/i, /\bgiven\s*name\b/i, /\bgiven\b/i, /\bgname\b/i],
//     lastname: [/\blast\s*name\b/i, /\blname\b/i, /\blast_name\b/i, /\bsurname\b/i, /\bfamily\s*name\b/i, /\bfamily\b/i],
//     fullname: [/\bfull\s*name\b/i, /\bdisplay\s*name\b/i, /\bname\b/i],
//     username: [/\buser(name)?\b/i, /\buser_id\b/i, /\bhandle\b/i],
//     email: [/\bemail\b/i, /\bmail\b/i, /\be-?mail\b/i],
//     businessEmail: [/\bbusiness.*email\b/i, /\bwork.*email\b/i, /\bcompany.*email\b/i, /\boffice.*email\b/i],
//     password: [/pass(word)?/i, /\bpwd\b/i],
//     phone: [/\bphone\b/i, /\bmobile\b/i, /\bcontact\b/i, /\btel\b/i],
//     address: [/address|street|addr/i],
//     city: [/\bcity\b/i, /\btown\b/i],
//     state: [/\bstate\b/i, /\bprovince\b/i, /\bregion\b/i],
//     postcode: [/zip|postal|postcode|pin/i],
//     country: [/\bcountry\b/i],
//     location: [/\blocation\b/i, /\bplace\b/i, /\barea\b/i],
//     facebook: [/facebook|fb\.com/i],
//     linkedin: [/linkedin/i],
//     instagram: [/instagram|insta/i],
//     twitter: [/twitter/i],
//     youtube: [/youtube|youtu\.be/i],
//     website: [/website|web\s?url|site|homepage|link/i],
//     description: [/description|about|bio|summary|details|overview/i],
//     title: [/^title\b/i, /headline/i, /listing title/i],
//     category: [/\bcategory\b/i],
//     subcategory: [/sub[-\s]?category/i]
//   };

//   function getLabelText(el) {
//     try {
//       if (!el) return "";
//       const id = el.id;
//       if (id) {
//         const lab = document.querySelector(`label[for="${id}"]`);
//         if (lab) return lab.innerText || lab.textContent || "";
//       }
//       let p = el.parentElement;
//       for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
//         if (p.tagName && p.tagName.toLowerCase() === "label") return p.innerText || p.textContent || "";
//       }
//       return "";
//     } catch (e) { return ""; }
//   }

//   function isCompanyField(attrs) {
//     return /\b(company|organization|organisation|org|business)\b/i.test(attrs);
//   }

//   function matchField(el) {
//     if (!el || el.disabled) return null;
//     const type = (el.type || "").toLowerCase();
//     const tag = (el.tagName || "").toLowerCase();
//     if (["hidden","submit","button","reset","image"].includes(type)) return null;

//     const attrs = [
//       el.name, el.id, el.placeholder, el.getAttribute("aria-label"), getLabelText(el)
//     ].filter(Boolean).join(" ").toLowerCase();

//     // type-based hints
//     if (type === "email") return "email";
//     if (type === "tel") return "phone";
//     if (type === "password") return "password";

//     if (tag === "textarea") {
//       if (PATTERNS.description.some(rx => rx.test(attrs))) return "description";
//       if (PATTERNS.address.some(rx => rx.test(attrs))) return "address";
//     }

//     for (const [role, arr] of Object.entries(PATTERNS)) {
//       for (const rx of arr) {
//         if (rx.test(attrs)) {
//           // Guards
//           if (role === "username" && ["email","tel","url"].includes(type)) return null;
//           if (role === "email" && isCompanyField(attrs)) return "businessEmail";
//           if (role === "businessEmail" && !/email/.test(attrs)) return null;
//           if (role === "website" && type === "email") return null;
//           if (role === "description" && tag !== "textarea") return null;
//           return role;
//         }
//       }
//     }

//     return null;
//   }

//   function alreadyFilled(el) {
//     if (!el) return false;
//     if (el.dataset && el.dataset.hyperfill === "1") return true;
//     if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
//       return !!(el.innerText && el.innerText.trim());
//     }
//     return !!(el.value && el.value.trim());
//   }

//   // inside content/autofill.js

// function fillWithProfileForce(profile) {
//   if (!profile) return 0;
//   const p = profile.profile || profile;
//   const vals = {
//     firstname: p.firstname || "",
//     lastname: p.lastname || "",
//     fullname: p.fullname || `${p.firstname||""} ${p.lastname||""}`.trim(),
//     email: p.email || "",
//     businessEmail: p.businessEmail || "",
//     username: p.username || "",
//     password: (p.activePassword === "submissionPassword" ? (p.submissionPassword||"") : (p.emailPassword||""))
//   };

//   let filled = 0;
//   const nodes = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//   nodes.forEach(el => {
//     if (!el) return;
//     const type = (el.type || "").toLowerCase();
//     const tag = (el.tagName || "").toLowerCase();
//     const attrs = [el.name, el.id, el.placeholder, getLabelText(el)].join(" ").toLowerCase();

//     let role = matchField(el);
//     // Force mode fallback rules
//     if (!role) {
//       if (/user/.test(attrs)) role = "username";
//       else if (/first/.test(attrs)) role = "firstname";
//       else if (/last|sur/.test(attrs)) role = "lastname";
//       else if (/mail/.test(attrs)) role = "email";
//       else if (/pass/.test(attrs)) role = "password";
//     }

//     if (!role) return;
//     let val = vals[role];
//     if (!val) return;

//     if (el.getAttribute("contenteditable") === "true") el.innerText = val;
//     else setNativeValue(el, val);
//     filled++;
//   });
//   console.log(`⚡ Hard filled ${filled} fields`);
//   return filled;
// }

// // modify message listener
// chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//   if (!msg) return;
//   if (msg.action === "autofillProfile") {
//     chrome.storage.local.get(["profile","autofillEnabled"], res => {
//       if (res.autofillEnabled === false) {
//         sendResponse({ ok:false, filled:0, error:"disabled" });
//         return;
//       }
//       const profile = msg.profile || res.profile;
//       if (!profile) {
//         sendResponse({ ok:false, filled:0, error:"no_profile" });
//         return;
//       }
//       const filled = msg.force ? fillWithProfileForce(profile) : fillWithProfile(profile);
//       sendResponse({ ok:filled>0, filled });
//     });
//     return true;
//   }
// });

//   function fillWithProfile(profile) {
//     if (!profile) return 0;
//     const p = profile.profile || profile;
//     const vals = {
//       firstname: p.firstname || "",
//       lastname: p.lastname || "",
//       fullname: p.fullname || `${p.firstname||""} ${p.lastname||""}`.trim(),
//       email: p.email || "",
//       businessEmail: p.businessEmail || "",
//       username: p.username || "",
//       phone: p.phone || "",
//       address: p.address || "",
//       city: p.city || "",
//       state: p.state || "",
//       postcode: p.postcode || "",
//       country: p.country || "",
//       location: p.location || "",
//       facebook: p.facebook || "",
//       linkedin: p.linkedin || "",
//       instagram: p.instagram || "",
//       twitter: p.twitter || "",
//       youtube: p.youtube || "",
//       website: p.website || "",
//       description: p.description || "",
//       title: p.title || "",
//       category: p.category || "",
//       subcategory: p.subcategory || "",
//       password: (p.activePassword === "submissionPassword" ? (p.submissionPassword||"") : (p.emailPassword||""))
//     };

//     let filled = 0;
//     const nodes = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//     nodes.forEach(el => {
//       try {
//         if (!el || alreadyFilled(el)) return;
//         const role = matchField(el);
//         if (!role) return;
//         const val = vals[role];
//         if (!val) return;

//         // Final safety: no email into company fields
//         const attrs = [el.name, el.id, el.placeholder, getLabelText(el)].join(" ").toLowerCase();
//         if (isCompanyField(attrs) && ["email","businessEmail","username"].includes(role)) return;

//         el.focus && el.focus();
//         if (el.getAttribute("contenteditable") === "true") {
//           el.innerText = val;
//         } else {
//           setNativeValue(el, val);
//         }
//         if (el.dataset) el.dataset.hyperfill = "1";
//         filled++;
//       } catch (e) { console.warn("fill error", e); }
//     });
//     console.log(`✅ Autofilled ${filled} fields`);
//     return filled;
//   }

//   // listen for messages
//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (!msg) return;
//     if (msg.action === "autofillAuth" || msg.action === "autofillProfile") {
//       chrome.storage.local.get("autofillEnabled", res => {
//         const enabled = res.autofillEnabled !== false;
//         if (!enabled) {
//           sendResponse({ ok:false, filled:0, error:"disabled" });
//           return;
//         }
//         if (msg.profile) {
//           const n = fillWithProfile(msg.profile);
//           sendResponse({ ok:n>0, filled:n });
//         } else {
//           chrome.storage.local.get("profile", r => {
//             const n = r.profile ? fillWithProfile(r.profile) : 0;
//             sendResponse({ ok:n>0, filled:n });
//           });
//         }
//       });
//       return true;
//     }
//   });

//   // auto run
//   const debounced = debounce(() => {
//     chrome.storage.local.get(["profile","autofillEnabled"], res => {
//       if (res.autofillEnabled === false) return;
//       if (res.profile) fillWithProfile(res.profile);
//     });
//   }, 700);

//   setTimeout(debounced, 700);
//   setTimeout(debounced, 1500);

//   try {
//     const obs = new MutationObserver(debounced);
//     if (document.body) obs.observe(document.body,{childList:true,subtree:true});
//   } catch(e){}
// })();

// // content/autofill.js
// // Wide regex + strict matching + force (hard-fill) mode
// (function () {
//   if (window.__RowFiller_autofill_installed) return;
//   window.__RowFiller_autofill_installed = true;
//   console.log("🔑 content/autofill.js loaded (wide+strict + force)");

//   function debounce(fn, wait) {
//     let t = null;
//     return function () { clearTimeout(t); t = setTimeout(() => fn.apply(this, arguments), wait); };
//   }

//   function setNativeValue(el, value) {
//     try {
//       const proto = Object.getPrototypeOf(el);
//       const desc = Object.getOwnPropertyDescriptor(proto, "value");
//       if (desc && desc.set) desc.set.call(el, value);
//       else el.value = value;
//     } catch (e) {
//       try { el.value = value; } catch (e2) {}
//     }
//     el.dispatchEvent(new Event("input", { bubbles: true }));
//     el.dispatchEvent(new Event("change", { bubbles: true }));
//   }

//   // patterns: intentionally conservative for sensitive fields
//   const PATTERNS = {
//     firstname: [/\bfirst(?:[_\s-]?name)?\b/i, /\bfname\b/i, /\bgiven(?:[_\s-]?name)?\b/i, /\bgiven\b/i],
//     lastname: [/\blast(?:[_\s-]?name)?\b/i, /\blname\b/i, /\bsurname\b/i, /\bfamily(?:[_\s-]?name)?\b/i],
//     fullname: [/\bfull(?:[_\s-]?name)?\b/i, /\bdisplay[_\s-]?name\b/i, /^\bname\b$/i],
//     username: [/\buser(?:[_\s-]?name)?\b/i, /\buser_id\b/i, /\buserid\b/i, /\blogin\b/i, /\bhandle\b/i],
//     email: [/\bemail\b/i, /\be-?mail\b/i, /\bemailaddress\b/i, /\bmail\b/i  ,/\bEmail Address	\b/i],
//     businessEmail: [/\b(business|work|company|office)[\s-_]*email\b/i],
//     password: [/pass(?:word)?\b/i, /\bpwd\b/i],
//     phone: [/\bphone\b/i, /\bmobile\b/i, /\btel\b/i, /\bcontact\b/i],
//     address: [/address\b|street\b|addr\b/i],
//     city: [/city\b|town\b/i],
//     state: [/state\b|province\b|region\b/i],
//     postcode: [/zip\b|postal\b|postcode\b|pin\b/i],
//     country: [/country\b/i],
//     location: [/location\b|place\b|area\b/i],
//     facebook: [/facebook|fb\.com/i],
//     linkedin: [/linkedin/i],
//     instagram: [/instagram|insta/i],
//     twitter: [/twitter|tweet/i],
//     youtube: [/youtube|youtu\.be/i],
//     website: [/website|web\s?url|site|homepage|link|url\b/i],
//     description: [/description|about\b|bio\b|summary|details|overview/i],
//     title: [/^title\b|headline|listing title/i],
//     category: [/\bcategory\b/i],
//     subcategory: [/sub[-\s]?category/i]
//   };

//   function getLabelText(el) {
//     try {
//       if (!el) return "";
//       const id = el.id;
//       if (id) {
//         const lab = document.querySelector(`label[for="${id}"]`);
//         if (lab) return (lab.innerText || lab.textContent || "").trim();
//       }
//       let p = el.parentElement;
//       for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
//         if (p && p.tagName && p.tagName.toLowerCase() === "label") return (p.innerText || p.textContent || "").trim();
//       }
//       const labId = el.getAttribute && el.getAttribute("aria-labelledby");
//       if (labId) {
//         const ref = document.getElementById(labId);
//         if (ref) return (ref.innerText || ref.textContent || "").trim();
//       }
//     } catch (e) {}
//     return "";
//   }

//   function isCompanyField(attrs) {
//     if (!attrs) return false;
//     return /\b(company|organisation|organization|org|business|business[_\s-]?name|company[_\s-]?name|work)\b/i.test(attrs);
//   }

//   // Strict match: only return a role when explicit signals present
//   function matchFieldStrict(el) {
//     if (!el || el.disabled) return null;
//     const type = (el.type || "").toLowerCase();
//     const tag = (el.tagName || "").toLowerCase();
//     if (["hidden","submit","button","reset","image"].includes(type)) return null;

//     const attrs = [el.name, el.id, el.placeholder, el.getAttribute && el.getAttribute("aria-label"), getLabelText(el)]
//       .filter(Boolean).join(" ").toLowerCase();

//     // type-based short-circuits
//     if (type === "email") return "email";
//     if (type === "tel") return "phone";
//     if (type === "password") {
//       // confirm/test: don't treat confirm/verify fields as password to fill automatically
//       if (/\bconfirm\b|\bverify\b|\bretype\b/i.test(attrs)) return null;
//       return "password";
//     }
//     if (tag === "textarea") {
//       if (PATTERNS.description.some(rx => rx.test(attrs))) return "description";
//       if (PATTERNS.address.some(rx => rx.test(attrs))) return "address";
//     }

//     // pattern matching - require explicit token
//     for (const [role, arr] of Object.entries(PATTERNS)) {
//       for (const rx of arr) {
//         if (rx.test(attrs)) {
//           // guards
//           if (role === "username" && ["email","tel","url"].includes(type)) return null;
//           if (role === "email" && isCompanyField(attrs)) return "businessEmail";
//           if (role === "businessEmail" && !/email/.test(attrs)) return null;
//           if (role === "website" && type === "email") return null;
//           if (role === "description" && tag !== "textarea") return null;
//           return role;
//         }
//       }
//     }

//     // fallback: if field is exactly "name" (and no first/last hints) -> fullname
//     if (/\bname\b/.test(attrs) && !(/\bfirst\b|\blast\b|\bgiven\b|\bfamily\b/.test(attrs))) {
//       return "fullname";
//     }

//     return null;
//   }

//   // Force match: looser heuristics to be used only when user clicks "Autofill on Tab"
//   function matchFieldForce(el) {
//     const strict = matchFieldStrict(el);
//     if (strict) return strict;

//     if (!el || el.disabled) return null;
//     const type = (el.type || "").toLowerCase();
//     const tag = (el.tagName || "").toLowerCase();
//     if (["hidden","submit","button","reset","image"].includes(type)) return null;

//     const attrs = [el.name, el.id, el.placeholder, el.getAttribute && el.getAttribute("aria-label"), getLabelText(el)]
//       .filter(Boolean).join(" ").toLowerCase();

//     if (type === "email") return "email";
//     if (type === "password") return "password";
//     if (type === "tel") return "phone";
//     if (tag === "textarea") {
//       if (PATTERNS.description.some(rx => rx.test(attrs))) return "description";
//       return "description";
//     }

//     // relaxed token checks
//     if (/\buser\b|\blogin\b|\bhandle\b|\buname\b/.test(attrs)) return "username";
//     if (/\bfirst\b|\bfname\b|\bgiven\b/.test(attrs)) return "firstname";
//     if (/\blast\b|\bsur\b|\blname\b|\bfamily\b/.test(attrs)) return "lastname";
//     if (/\bname\b/.test(attrs)) return "fullname";
//     if (/\bmail\b|\bemail\b/.test(attrs)) return "email";
//     if (/\bpass\b|\bpwd\b/.test(attrs)) return "password";
//     if (/\bcompany\b|\bbusiness\b|\bwork\b/.test(attrs)) return "businessEmail";
//     if (/\baddress\b|\bstreet\b|\baddr\b/.test(attrs)) return "address";
//     if (/\burl\b|website|link|homepage/.test(attrs)) return "website";

//     return null;
//   }

//   function alreadyFilled(el) {
//     try {
//       if (!el) return false;
//       if (el.dataset && el.dataset.hyperfill === "1") return true;
//       if (el.getAttribute && el.getAttribute("contenteditable") === "true") return !!(el.innerText && el.innerText.trim());
//       const v = el.value;
//       return (v !== undefined && v !== null && v.toString().trim() !== "");
//     } catch (e) { return false; }
//   }

//   // Strict fill: safe, used for auto-run / mutation observer
//   function fillStrict(profile) {
//     if (!profile) return 0;
//     const p = profile.profile || profile;
//     const vals = prepareValues(p);

//     const nodes = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//     let filled = 0;

//     nodes.forEach(el => {
//       try {
//         if (!el || alreadyFilled(el)) return;
//         const role = matchFieldStrict(el);
//         if (!role) return;

//         // don't fill confirm/verify password inputs
//         if (role === "password" && (!el.type || el.type.toLowerCase() !== "password")) return;

//         const value = vals[role];
//         if (!value) return;

//         // avoid email into url or textarea
//         if (role === "email") {
//           if ((el.tagName || "").toLowerCase() === "textarea") return;
//           if ((el.type || "").toLowerCase() === "url") return;
//         }
//         // avoid username into email/url/tel fields
//         if (role === "username" && ["email","tel","url"].includes((el.type || "").toLowerCase())) return;

//         // avoid placing email into company name fields
//         const attrs = [el.name, el.id, el.placeholder, getLabelText(el)].filter(Boolean).join(" ").toLowerCase();
//         if (isCompanyField(attrs) && ["email", "username"].includes(role)) return;

//         fillElement(el, value);
//         filled++;
//       } catch (e) { console.warn("fillStrict error", e); }
//     });

//     if (filled) console.log(`✅ autofill strict: filled ${filled}`);
//     return filled;
//   }

//   // Force fill: more aggressive, used only when user presses "Autofill on Tab"
//   function fillForce(profile) {
//     if (!profile) return 0;
//     const p = profile.profile || profile;
//     const vals = prepareValues(p);

//     const nodes = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//     let filled = 0;

//     nodes.forEach(el => {
//       try {
//         if (!el) return;
//         // do not overwrite already provided values by the site
//         // but in force mode we want to fill empty ones aggressively
//         if (alreadyFilled(el)) return;

//         let role = matchFieldStrict(el) || matchFieldForce(el);
//         if (!role) {
//           // aggressive fallback by attribute tokens
//           const attrs = [el.name, el.id, el.placeholder, getLabelText(el)].filter(Boolean).join(" ").toLowerCase();
//           if (/\buser\b|\blogin\b/.test(attrs)) role = "username";
//           else if (/\bfirst\b/.test(attrs)) role = "firstname";
//           else if (/\blast|surname\b/.test(attrs)) role = "lastname";
//           else if (/\bmail|email\b/.test(attrs)) role = "email";
//           else if (/\bpass\b/.test(attrs)) role = "password";
//           else if (/\bname\b/.test(attrs)) role = "fullname";
//         }
//         if (!role) return;
//         const value = vals[role];
//         if (!value) return;

//         // still protect url/email mismatch
//         if (role === "email" && (el.type || "").toLowerCase() === "url") return;

//         fillElement(el, value);
//         filled++;
//       } catch (e) { console.warn("fillForce error", e); }
//     });

//     if (filled) console.log(`⚡ autofill force: filled ${filled}`);
//     return filled;
//   }

//   function prepareValues(p) {
//     const first = p.firstname || p.firstName || "";
//     const last = p.lastname || p.lastName || "";
//     const fullname = p.fullname || [first, last].filter(Boolean).join(" ").trim() || p.name || "";
//     return {
//       firstname: first,
//       lastname: last,
//       fullname: fullname,
//       email: p.email || p.submissionEmail || "",
//       businessEmail: p.businessEmail || "",
//       username: p.username || p.user || "",
//       phone: p.phone || p.number || "",
//       address: p.address || "",
//       city: p.city || "",
//       state: p.state || "",
//       postcode: p.postcode || p.pin || "",
//       country: p.country || "",
//       location: p.location || "",
//       facebook: p.facebook || p.fb || "",
//       linkedin: p.linkedin || "",
//       instagram: p.instagram || p.insta || "",
//       twitter: p.twitter || p.twitterHandle || "",
//       youtube: p.youtube || "",
//       website: p.website || "",
//       description: p.description || p.about || p.bio || "",
//       title: p.title || "",
//       category: p.category || "",
//       subcategory: p.subcategory || ""
//     };
//   }

//   function fillElement(el, value) {
//     try {
//       el.focus && el.focus();
//       if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
//         try { document.execCommand && document.execCommand('insertText', false, value); } catch (e) { el.innerText = value; }
//       } else {
//         setNativeValue(el, value);
//       }
//       if (el.dataset) el.dataset.hyperfill = "1";
//     } catch (e) { console.warn("fillElement error", e); }
//   }

//   // // Message API: support strict autofill (default) and force (when msg.force === true)
//   // chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//   //   if (!msg) return;
//   //   if (msg.action === "autofillProfile" || msg.action === "autofillAuth" || msg.action === "autofill") {
//   //     // check enabled
//   //     chrome.storage.local.get("autofillEnabled", (r) => {
//   //       const enabled = (r && r.autofillEnabled !== undefined) ? r.autofillEnabled : true;
//   //       if (!enabled) {
//   //         sendResponse({ ok: false, filled: 0, error: "disabled" });
//   //         return;
//   //       }
//   //       // choose profile source
//   //       const profile = msg.profile || (r && r.profile) || null;
//   //       if (!profile) {
//   //         // try storage fallback
//   //         chrome.storage.local.get("profile", (res) => {
//   //           const p2 = (res && res.profile) || null;
//   //           if (!p2) {
//   //             sendResponse({ ok: false, filled: 0, error: "no_profile" });
//   //             return;
//   //           }
//   //           try {
//   //             const filled = msg.force ? fillForce(p2) : fillStrict(p2);
//   //             sendResponse({ ok: filled > 0, filled });
//   //           } catch (e) {
//   //             sendResponse({ ok: false, filled: 0, error: e && e.message });
//   //           }
//   //         });
//   //         return true; // async
//   //       } else {
//   //         try {
//   //           const filled = msg.force ? fillForce(profile) : fillStrict(profile);
//   //           sendResponse({ ok: filled > 0, filled });
//   //         } catch (e) {
//   //           sendResponse({ ok: false, filled: 0, error: e && e.message });
//   //         }
//   //       }
//   //     });
//   //     return true;
//   //   }

//   //   if (msg.action === "toggleAutofill") {
//   //     // content script can optionally react to toggle, but storage is the source of truth
//   //     console.log("autofill toggle message (content):", msg.enabled);
//   //     sendResponse({ ok: true });
//   //   }
//   // });

//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//   if (!msg) return;
//   if (msg.action === "autofillProfile") {
//     chrome.storage.local.get(["profile","autofillEnabled"], res => {
//       if (res.autofillEnabled === false) {
//         sendResponse({ ok:false, error:"disabled" });
//         return;
//       }
//       const profile = msg.profile || res.profile;
//       if (!profile) {
//         sendResponse({ ok:false, error:"no_profile" });
//         return;
//       }
//       // ✅ Always respond with success
//       const filled = msg.force ? fillWithProfileForce(profile) : fillWithProfile(profile);
//       sendResponse({ ok: true, filled });
//     });
//     return true; // keep async open
//   }
// });

//   // Auto-run (strict) after small delays to allow SPAs to render. Debounced on mutation.
//   const runStrictDebounced = debounce(() => {
//     chrome.storage.local.get(["autofillEnabled", "profile"], (res) => {
//       const enabled = (res && res.autofillEnabled !== undefined) ? res.autofillEnabled : true;
//       const profile = (res && res.profile) || null;
//       if (!enabled || !profile) return;
//       try { fillStrict(profile); } catch (e) { console.warn("autofill strict run err", e); }
//     });
//   }, 700);

//   setTimeout(runStrictDebounced, 700);
//   setTimeout(runStrictDebounced, 1600);

//   try {
//     const obs = new MutationObserver(runStrictDebounced);
//     if (document.body) obs.observe(document.body, { childList: true, subtree: true });
//   } catch (e) { /* ignore */ }
// })();

// // content/autofill.js
// (function () {
//   if (window.__RowFiller_autofill_installed) return;
//   window.__RowFiller_autofill_installed = true;
//   console.log("🔑 content/autofill.js loaded (strict username + fixed messaging)");

//   function debounce(fn, wait) {
//     let t = null;
//     return function () { clearTimeout(t); t = setTimeout(() => fn.apply(this, arguments), wait); };
//   }

//   function setNativeValue(el, value) {
//     try {
//       const proto = Object.getPrototypeOf(el);
//       const desc = Object.getOwnPropertyDescriptor(proto, "value");
//       if (desc && desc.set) desc.set.call(el, value);
//       else el.value = value;
//     } catch (e) {
//       try { el.value = value; } catch (e2) {}
//     }
//     el.dispatchEvent(new Event("input", { bubbles: true }));
//     el.dispatchEvent(new Event("change", { bubbles: true }));
//   }

//   // Regex patterns
//   const PATTERNS = {
//     firstname: [/\bfirst(?:[_\s-]?name)?\b/i, /\bfname\b/i, /\bgiven(?:[_\s-]?name)?\b/i],
//     lastname: [/\blast(?:[_\s-]?name)?\b/i, /\blname\b/i, /\bsurname\b/i, /\bfamily(?:[_\s-]?name)?\b/i],
//     fullname: [/\bfull(?:[_\s-]?name)?\b/i, /\bdisplay[_\s-]?name\b/i, /^\bname\b$/i],
//     username: [/^(username|user[_-]?name|user-id|userid|login)$/i], // strict exact
//     email: [/\bemail\b/i, /\be-?mail\b/i, /\bemailaddress\b/i],
//     businessEmail: [/\b(business|work|company|office)[\s-_]*email\b/i],
//     password: [/pass(?:word)?\b/i, /\bpwd\b/i],
//     phone: [/\bphone\b/i, /\bmobile\b/i, /\btel\b/i, /\bcontact\b/i],
//     address: [/address\b|street\b|addr\b/i],
//     city: [/city\b|town\b/i],
//     state: [/state\b|province\b|region\b/i],
//     postcode: [/zip\b|postal\b|postcode\b|pin\b/i],
//     country: [/country\b/i],
//     location: [/location\b|place\b|area\b/i],
//     facebook: [/facebook|fb\.com/i],
//     linkedin: [/linkedin/i],
//     instagram: [/instagram|insta/i],
//     twitter: [/twitter|tweet/i],
//     youtube: [/youtube|youtu\.be/i],
//     website: [/website|web\s?url|site|homepage|link|url\b/i],
//     description: [/description|about\b|bio\b|summary|details/i],
//     title: [/^title\b|headline|listing title/i],
//     category: [/\bcategory\b/i],
//     subcategory: [/sub[-\s]?category/i]
//   };

//   function getLabelText(el) {
//     try {
//       if (!el) return "";
//       const id = el.id;
//       if (id) {
//         const lab = document.querySelector(`label[for="${id}"]`);
//         if (lab) return (lab.innerText || lab.textContent || "").trim();
//       }
//       let p = el.parentElement;
//       for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
//         if (p.tagName && p.tagName.toLowerCase() === "label") {
//           return (p.innerText || p.textContent || "").trim();
//         }
//       }
//     } catch (e) {}
//     return "";
//   }

//   function isCompanyField(attrs) {
//     return /\b(company|organisation|organization|org|business[_\s-]?name)\b/i.test(attrs);
//   }

//   // ✅ Strict matching
//   function matchFieldStrict(el) {
//     if (!el || el.disabled) return null;
//     const type = (el.type || "").toLowerCase();
//     const tag = (el.tagName || "").toLowerCase();
//     if (["hidden","submit","button","reset","image"].includes(type)) return null;

//     const attrs = [el.name, el.id, el.placeholder, el.getAttribute?.("aria-label"), getLabelText(el)]
//       .filter(Boolean).join(" ").toLowerCase();

//     if (type === "email") return "email";
//     if (type === "tel") return "phone";
//     if (type === "password") {
//       if (/\bconfirm\b|\bverify\b|\bretype\b/i.test(attrs)) return null;
//       return "password";
//     }
//     if (tag === "textarea") {
//       if (PATTERNS.description.some(rx => rx.test(attrs))) return "description";
//       if (PATTERNS.address.some(rx => rx.test(attrs))) return "address";
//     }

//     for (const [role, arr] of Object.entries(PATTERNS)) {
//       for (const rx of arr) {
//         if (rx.test(attrs)) {
//           if (role === "username" && ["email","tel","url"].includes(type)) return null;
//           if (role === "username") {
//             // block socials/web
//             const blacklist = ["facebook","linkedin","instagram","twitter","youtube","skype","whatsapp","telegram","website","url","profile","link","channel","page"];
//             if (blacklist.some(w => attrs.includes(w))) return null;
//           }
//           if (role === "email" && isCompanyField(attrs)) return "businessEmail";
//           return role;
//         }
//       }
//     }

//     if (/\bname\b/.test(attrs) && !(/\bfirst\b|\blast\b/.test(attrs))) return "fullname";

//     return null;
//   }

//   // 🚀 Force matching (for Autofill on Tab button)
//   function matchFieldForce(el) {
//     return matchFieldStrict(el); // keep strict only (no wild username fallback anymore)
//   }

//   function alreadyFilled(el) {
//     if (!el) return false;
//     if (el.dataset?.hyperfill === "1") return true;
//     const v = el.value;
//     return (v !== undefined && v !== null && v.toString().trim() !== "");
//   }

//   function fillStrict(profile) {
//     return doFill(profile, matchFieldStrict);
//   }

//   function fillForce(profile) {
//     return doFill(profile, matchFieldForce, { force: true });
//   }

//   function doFill(profile, matcher, opts={}) {
//     if (!profile) return 0;
//     const p = profile.profile || profile;
//     const vals = prepareValues(p);

//     const nodes = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//     let filled = 0;

//     nodes.forEach(el => {
//       try {
//         if (!el || alreadyFilled(el)) return;
//         const role = matcher(el);
//         if (!role) return;

//         const value = vals[role];
//         if (!value) return;

//         fillElement(el, value);
//         filled++;
//       } catch (e) { console.warn("fill error", e); }
//     });

//     console.log(`✅ autofill ${opts.force ? "force" : "strict"}: filled ${filled}`);
//     return filled;
//   }

//   function prepareValues(p) {
//     const first = p.firstname || p.firstName || "";
//     const last = p.lastname || p.lastName || "";
//     const fullname = p.fullname || [first, last].filter(Boolean).join(" ").trim();
//     return {
//       firstname: first,
//       lastname: last,
//       fullname: fullname,
//       email: p.email || "",
//       businessEmail: p.businessEmail || "",
//       username: p.username || "",
//       phone: p.phone || "",
//       address: p.address || "",
//       city: p.city || "",
//       state: p.state || "",
//       postcode: p.postcode || "",
//       country: p.country || "",
//       location: p.location || "",
//       facebook: p.facebook || "",
//       linkedin: p.linkedin || "",
//       instagram: p.instagram || "",
//       twitter: p.twitter || "",
//       youtube: p.youtube || "",
//       website: p.website || "",
//       description: p.description || "",
//       title: p.title || "",
//       category: p.category || "",
//       subcategory: p.subcategory || ""
//     };
//   }

//   function fillElement(el, value) {
//     try {
//       el.focus && el.focus();
//       setNativeValue(el, value);
//       if (el.dataset) el.dataset.hyperfill = "1";
//     } catch (e) { console.warn("fillElement error", e); }
//   }

//   // 🔄 Messaging API
//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (!msg) return;
//     if (msg.action === "autofillProfile") {
//       chrome.storage.local.get(["profile","autofillEnabled"], res => {
//         if (res.autofillEnabled === false) {
//           sendResponse({ ok:false, error:"disabled" });
//           return;
//         }
//         const profile = msg.profile || res.profile;
//         if (!profile) {
//           sendResponse({ ok:false, error:"no_profile" });
//           return;
//         }
//         try {
//           const filled = msg.force ? fillForce(profile) : fillStrict(profile);
//           sendResponse({ ok:true, filled });
//         } catch (e) {
//           sendResponse({ ok:false, error:e.message });
//         }
//       });
//       return true;
//     }
//   });

//   // Auto-run strict
//   const runStrictDebounced = debounce(() => {
//     chrome.storage.local.get(["autofillEnabled", "profile"], (res) => {
//       if (res?.autofillEnabled === false) return;
//       const profile = res?.profile;
//       if (!profile) return;
//       fillStrict(profile);
//     });
//   }, 700);

//   setTimeout(runStrictDebounced, 700);
//   setTimeout(runStrictDebounced, 1600);
//   try {
//     const obs = new MutationObserver(runStrictDebounced);
//     if (document.body) obs.observe(document.body, { childList: true, subtree: true });
//   } catch (e) {}
// })();

// // content/autofill.js
// (function () {
//   if (window.__RowFiller_autofill_installed) return;
//   window.__RowFiller_autofill_installed = true;
//   console.log("🔑 content/autofill.js loaded (label-priority matching)");

//   function debounce(fn, wait) {
//     let t = null;
//     return function () { clearTimeout(t); t = setTimeout(() => fn.apply(this, arguments), wait); };
//   }

//   function setNativeValue(el, value) {
//     try {
//       const proto = Object.getPrototypeOf(el);
//       const desc = Object.getOwnPropertyDescriptor(proto, "value");
//       if (desc && desc.set) desc.set.call(el, value);
//       else el.value = value;
//     } catch (e) {
//       try { el.value = value; } catch (e2) {}
//     }
//     el.dispatchEvent(new Event("input", { bubbles: true }));
//     el.dispatchEvent(new Event("change", { bubbles: true }));
//   }

//   // Patterns for detection
//   const PATTERNS = {
//     firstname: [/first\s?name/i, /\bfname\b/i, /given\s?name/i],
//     lastname: [/last\s?name/i, /\blname\b/i, /surname/i, /family\s?name/i],
//     fullname: [/full\s?name/i, /display\s?name/i, /^name$/i],
//     username: [/^username$/i, /^user[_-]?name$/i, /^login$/i, /^user[-_]?id$/i],
//     email: [/\bemail\b/i, /e-?mail/i, /email\s?address/i],
//     businessEmail: [/(business|work|company|office)\s*email/i],
//     password: [/^password$/i, /\bpwd\b/i],
//     phone: [/phone/i, /mobile/i, /tel/i, /contact/i],
//     address: [/address/i, /street/i, /\baddr\b/i],
//     city: [/city/i, /town/i],
//     state: [/state/i, /province/i, /region/i],
//     postcode: [/zip/i, /postal/i, /postcode/i, /pin/i],
//     country: [/country/i],
//     location: [/location/i, /place/i, /area/i],
//     facebook: [/facebook/i, /\bfb\b/i],
//     linkedin: [/linkedin/i],
//     instagram: [/instagram/i, /\binsta\b/i],
//     twitter: [/twitter/i, /tweet/i, /x\.com/i],
//     youtube: [/youtube/i, /youtu\.be/i, /channel/i],
//     website: [/website/i, /homepage/i, /url/i, /site/i, /link/i],
//     description: [/description/i, /about/i, /\bbio\b/i, /summary/i],
//     title: [/title/i, /headline/i, /subject/i],
//     category: [/category/i],
//     subcategory: [/sub[\s_-]?category/i]
//   };

//   // Extract label text
//   function getLabel(el) {
//     try {
//       if (!el) return "";
//       if (el.id) {
//         const lab = document.querySelector(`label[for="${el.id}"]`);
//         if (lab) return lab.innerText.trim();
//       }
//       let p = el.parentElement;
//       for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
//         if (p.tagName && p.tagName.toLowerCase() === "label") {
//           return p.innerText.trim();
//         }
//       }
//     } catch {}
//     return "";
//   }

//   // Weighted attributes (label highest, placeholder lowest)
//   function getWeightedAttributes(el) {
//     return [
//       { text: getLabel(el), weight: 20 },
//       { text: el.name || "", weight: 15 },
//       { text: el.id || "", weight: 15 },
//       { text: el.getAttribute?.("aria-label") || "", weight: 10 },
//       { text: el.getAttribute?.("title") || "", weight: 8 },
//       { text: el.placeholder || "", weight: 3 }
//     ].filter(item => item.text);
//   }

//   // Match field based on weighted attributes
//   function matchField(el) {
//     if (!el || el.disabled) return null;
//     const type = (el.type || "").toLowerCase();
//     const tag = (el.tagName || "").toLowerCase();
//     if (["hidden", "submit", "button", "reset", "image"].includes(type)) return null;

//     if (type === "email") return "email";
//     if (type === "tel") return "phone";
//     if (type === "password") {
//       const ph = el.placeholder?.toLowerCase() || "";
//       if (/confirm|verify|retype|repeat|new/.test(ph)) return null;
//       return "password";
//     }

//     const attrs = getWeightedAttributes(el);
//     let best = null, bestScore = 0;

//     for (const [role, patterns] of Object.entries(PATTERNS)) {
//       for (const { text, weight } of attrs) {
//         for (const rx of patterns) {
//           if (rx.test(text)) {
//             // Special check: avoid filling socials with username
//             if (role === "username") {
//               const blacklist = ["facebook","instagram","twitter","linkedin","youtube","website","url","profile","link","page","channel"];
//               if (blacklist.some(w => text.toLowerCase().includes(w))) continue;
//             }
//             const score = weight;
//             if (score > bestScore) {
//               bestScore = score;
//               best = role;
//             }
//           }
//         }
//       }
//     }

//     // Default: detect fullname if only "name" present
//     if (!best && /\bname\b/i.test(attrs.map(a => a.text).join(" ")) &&
//         !/first|last/.test(attrs.map(a => a.text).join(" "))) {
//       best = "fullname";
//     }

//     return best;
//   }

//   function alreadyFilled(el) {
//     if (!el) return false;
//     if (el.dataset?.hyperfill === "1") return true;
//     const v = el.value;
//     return v && v.trim() !== "";
//   }

//   function prepareValues(p) {
//     const first = p.firstname || p.firstName || "";
//     const last = p.lastname || p.lastName || "";
//     const fullname = p.fullname || [first, last].filter(Boolean).join(" ").trim();
//     return {
//       firstname: first,
//       lastname: last,
//       fullname,
//       email: p.email || "",
//       businessEmail: p.businessEmail || "",
//       username: p.username || "",
//       phone: p.phone || "",
//       address: p.address || "",
//       city: p.city || "",
//       state: p.state || "",
//       postcode: p.postcode || "",
//       country: p.country || "",
//       location: p.location || "",
//       facebook: p.facebook || "",
//       linkedin: p.linkedin || "",
//       instagram: p.instagram || "",
//       twitter: p.twitter || "",
//       youtube: p.youtube || "",
//       website: p.website || "",
//       description: p.description || "",
//       title: p.title || "",
//       category: p.category || "",
//       subcategory: p.subcategory || ""
//     };
//   }

//   function fillElement(el, value) {
//     try {
//       el.focus && el.focus();
//       setNativeValue(el, value);
//       el.dataset.hyperfill = "1";
//     } catch (e) { console.warn("fillElement error", e); }
//   }

//   function doFill(profile) {
//     if (!profile) return 0;
//     const p = profile.profile || profile;
//     const vals = prepareValues(p);

//     const nodes = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//     let filled = 0;

//     nodes.forEach(el => {
//       const role = matchField(el);
//       if (!role) return;
//       if (alreadyFilled(el)) return;
//       const val = vals[role];
//       if (!val) return;
//       fillElement(el, val);
//       filled++;
//     });

//     console.log(`✅ Autofill done: ${filled} fields filled`);
//     return filled;
//   }

//   // Message API
//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (msg?.action === "autofillProfile") {
//       chrome.storage.local.get(["profile","autofillEnabled"], res => {
//         if (res.autofillEnabled === false) return sendResponse({ ok:false, error:"disabled" });
//         const profile = msg.profile || res.profile;
//         if (!profile) return sendResponse({ ok:false, error:"no_profile" });
//         try {
//           const filled = doFill(profile);
//           sendResponse({ ok:true, filled });
//         } catch (e) {
//           sendResponse({ ok:false, error:e.message });
//         }
//       });
//       return true;
//     }
//   });

//   // Auto-run
//   const run = debounce(() => {
//     chrome.storage.local.get(["autofillEnabled","profile"], res => {
//       if (res?.autofillEnabled === false) return;
//       if (!res?.profile) return;
//       doFill(res.profile);
//     });
//   }, 800);

//   setTimeout(run, 800);
//   setTimeout(run, 2000);

//   if (typeof MutationObserver !== "undefined") {
//     const obs = new MutationObserver(run);
//     if (document.body) obs.observe(document.body, { childList:true, subtree:true });
//   }
// })();

// // content/autofill.js (v4) - label-first strict matching, username guarded, placeholder-only ignored
// (function () {
//   if (window.__RowFiller_autofill_v4_installed) return;
//   window.__RowFiller_autofill_v4_installed = true;
//   console.log("🔑 content/autofill.js v4 loaded (label-first, strict username guards)");

//   // ---------- helpers ----------
//   function debounce(fn, wait) {
//     let t = null;
//     return function () { clearTimeout(t); t = setTimeout(() => fn.apply(this, arguments), wait); };
//   }
//   function setNativeValue(el, value) {
//     try {
//       const proto = Object.getPrototypeOf(el);
//       const desc = Object.getOwnPropertyDescriptor(proto, "value");
//       if (desc && desc.set) desc.set.call(el, value);
//       else el.value = value;
//     } catch (e) {
//       try { el.value = value; } catch (e2) {}
//     }
//     el.dispatchEvent(new Event("input", { bubbles: true }));
//     el.dispatchEvent(new Event("change", { bubbles: true }));
//   }
//   function isVisible(el) {
//     try {
//       if (!el) return false;
//       // some selects may have offsetParent null but still visible — keep simple check
//       return !(el.disabled || el.hidden || el.readOnly) && (el.offsetParent !== null || el.tagName.toLowerCase() === 'select');
//     } catch (e) { return false; }
//   }

//   // validation helpers
//   function looksLikeEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
//   function looksLikeUrl(v) { if (!v) return false; return /^(https?:\/\/)|\w+\.[a-z]{2,}/i.test(v); }
//   function looksLikePhone(v) { if (!v) return false; const d = (v.match(/\d/g)||[]).length; return d >= 7; }
//   function looksLikeUsername(v) { if (!v) return false; if (v.includes('@')) return false; if (/\s/.test(v)) return false; return /^[A-Za-z0-9._\-]{2,}$/.test(v); }

//   // ---------- context extraction ----------
//   function extractLabel(el) {
//     try {
//       if (!el) return "";
//       // label[for]
//       if (el.id) {
//         try {
//           const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
//           if (lab && lab.innerText) return lab.innerText.trim();
//         } catch (e) {}
//       }
//       // ancestor label
//       let p = el.parentElement;
//       for (let i = 0; p && i < 6; i++, p = p.parentElement) {
//         if (p.tagName && p.tagName.toLowerCase() === 'label') return (p.innerText || "").trim();
//       }
//       // previous sibling text (often the visible label)
//       const prev = el.previousElementSibling;
//       if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.tagName === 'DIV')) {
//         if (prev.innerText && prev.innerText.trim()) return prev.innerText.trim();
//       }
//       // aria-labelledby
//       const labId = el.getAttribute && el.getAttribute('aria-labelledby');
//       if (labId) {
//         const ref = document.getElementById(labId);
//         if (ref && ref.innerText) return ref.innerText.trim();
//       }
//       // title attribute
//       if (el.title && el.title.trim()) return el.title.trim();
//       return "";
//     } catch (e) { return ""; }
//   }

//   function getFieldContext(el) {
//     const label = (extractLabel(el) || "").trim();
//     const name = (el.name || "").toString().trim();
//     const id = (el.id || "").toString().trim();
//     const placeholder = (el.placeholder || "").toString().trim();
//     const aria = (el.getAttribute && el.getAttribute("aria-label")) || "";
//     const title = (el.getAttribute && el.getAttribute("title")) || "";
//     let nearby = "";
//     try {
//       const parent = el.parentElement;
//       if (parent) {
//         nearby = Array.from(parent.childNodes)
//           .filter(n => n.nodeType === Node.TEXT_NODE)
//           .map(n => n.textContent.trim()).join(" ");
//       }
//     } catch (e) {}
//     return {
//       combined: [label, name, id, placeholder, aria, title, nearby].filter(Boolean).join(" ").toLowerCase(),
//       parts: {
//         label: label.toLowerCase(),
//         name: name.toLowerCase(),
//         id: id.toLowerCase(),
//         placeholder: placeholder.toLowerCase(),
//         aria: (aria || "").toLowerCase(),
//         title: (title || "").toLowerCase(),
//         nearby: (nearby || "").toLowerCase()
//       }
//     };
//   }

//   // ---------- role config ----------
//   // positive patterns (checked on parts) and negative patterns (heavy penalty)
//   const ROLE_CFG = {
//     firstname:   { pos: [/\bfirst(?:[_\s-]?name)?\b/, /\bgiven(?:[_\s-]?name)?\b/], neg: [], minScore: 6 },
//     lastname:    { pos: [/\blast(?:[_\s-]?name)?\b/, /\bsurname\b/, /\bfamily(?:[_\s-]?name)?\b/], neg: [], minScore: 6 },
//     fullname:    { pos: [/\bfull(?:[_\s-]?name)?\b/, /\bdisplay[\s_-]?name\b/, /^\bname$/], neg: [], minScore: 6 },
//     username:    { pos: [/^username$|^user[_\s-]?name$|\buser_id\b|\buserid\b|\blogin\b/], neg: [/\bemail\b|\bmail\b|\bpassword\b|\bfacebook\b|\blinkedin\b|\binstagram\b|\btwitter\b|\byoutube\b|\bwebsite\b|\burl\b|\bpronoun\b|\bpronouns\b|\blocation\b|\bcompany\b|\borg\b|\borganization\b/], minScore: 12 },
//     email:       { pos: [/\bemail\b/, /\be-?mail\b/, /\bemail[_\s-]?address\b/], neg: [/business|work|company/], minScore: 6 },
//     businessEmail:{ pos: [/\b(business|work|company|office)[\s_-]*email\b/], neg: [], minScore: 8 },
//     password:    { pos: [/^password$|pass(?:word)?|pwd/], neg: [/confirm|verify|retype|repeat|new|old|current/], minScore: 6 },
//     phone:       { pos: [/\bphone\b/, /\bmobile\b/, /\btel\b/, /\bcontact\b/], neg: [/fax/], minScore: 5 },
//     website:     { pos: [/\bwebsite\b/, /\bhomepage\b/, /\bsite\b/, /\bweb[\s_-]?url\b/, /\burl\b/], neg: [/email/], minScore: 7 },
//     facebook:    { pos: [/facebook|fb\.com/], neg: [], minScore: 8, preferUrl: true },
//     linkedin:    { pos: [/linkedin/], neg: [], minScore: 8, preferUrl: true },
//     instagram:   { pos: [/instagram|insta/], neg: [], minScore: 7 },
//     twitter:     { pos: [/twitter|tweet|x \(formerly twitter\)|\bx\.com\b/], neg: [], minScore: 7 },
//     youtube:     { pos: [/youtube|youtu\.be/], neg: [], minScore: 8, preferUrl: true },
//     description: { pos: [/\bdescription\b/, /\babout\b/, /\bbio\b/, /\bsummary\b/, /\bdetails\b/], neg: [], minScore: 5, preferTextarea: true },
//     address:     { pos: [/\baddress\b/, /\bstreet\b/, /\baddr\b/], neg: [], minScore: 5 },
//     city:        { pos: [/\bcity\b/, /\btown\b/], neg: [], minScore: 5 },
//     state:       { pos: [/\bstate\b/, /\bprovince\b/, /\bregion\b/], neg: [], minScore: 5 },
//     postcode:    { pos: [/\bzip\b/, /\bpostal\b/, /\bpostcode\b/, /\bpin\b/], neg: [], minScore: 5 },
//     country:     { pos: [/\bcountry\b/], neg: [], minScore: 5 },
//     location:    { pos: [/\blocation\b/, /\bplace\b/], neg: [], minScore: 4 },
//     title:       { pos: [/^title$|headline|subject/], neg: [], minScore: 3 },
//     category:    { pos: [/\bcategory\b/], neg: [], minScore: 3 },
//     subcategory: { pos: [/\bsub[\s_-]?category\b/], neg: [], minScore: 3 }
//   };

//   // ---------- matching algorithm (label-first) ----------
//   function matchRoleForElement(el, isForce = false) {
//     if (!el) return null;
//     if (!isVisible(el)) return null;
//     // skip checkboxes/radios/files etc.
//     const type = (el.type || "").toLowerCase();
//     const tag = (el.tagName || "").toLowerCase();
//     if (["hidden","submit","button","reset","image","file","checkbox","radio"].includes(type)) return null;

//     const ctx = getFieldContext(el);
//     const p = ctx.parts;

//     // short-circuits for obvious types
//     if (type === "email") {
//       if (/\b(business|work|company|office)\b/.test(ctx.combined)) return "businessEmail";
//       return "email";
//     }
//     if (type === "tel") return "phone";
//     if (type === "password") {
//       if (/\bconfirm\b|\bverify\b|\bretype\b|\bnew\b|\bcurrent\b/.test(ctx.combined)) return null;
//       return "password";
//     }
//     if (tag === "textarea") {
//       if (ROLE_CFG.description && scoreForCfg(ctx, ROLE_CFG.description) >= ROLE_CFG.description.minScore) return "description";
//     }

//     // iterate roles and score
//     let best = null;
//     let bestScore = -9999;
//     for (const [role, cfg] of Object.entries(ROLE_CFG)) {
//       // prefer textarea for description if config asks and element is not textarea
//       if (cfg.preferTextarea && tag !== "textarea") {
//         if (document.querySelector && document.querySelector("textarea")) continue;
//       }

//       let score = 0;
//       for (const rx of cfg.pos) {
//         if (rx.test(p.label)) score += 10;
//         if (rx.test(p.name)) score += 6;
//         if (rx.test(p.id)) score += 6;
//         if (rx.test(p.aria)) score += 4;
//         if (rx.test(p.placeholder)) score += 2;
//         if (rx.test(p.title)) score += 2;
//         if (rx.test(p.nearby)) score += 1;
//       }
//       // negatives
//       if (cfg.neg && cfg.neg.length) {
//         for (const nrx of cfg.neg) {
//           if (nrx.test(ctx.combined)) score -= 18;
//         }
//       }
//       // social url heuristic reduce if no url-like mention and role asks for url
//       if ((role === "facebook" || role === "youtube" || role === "linkedin") && !(/url|http|facebook|linkedin|youtube|profile|https?:\/\//.test(ctx.combined))) {
//         score -= 6;
//       }

//       // special strictness for username: require explicit presence in label/name/id OR explicit autocomplete
//       if (role === "username") {
//         const explicit = (/^username$|^user[_\s-]?name$|\buser_id\b|\buserid\b|\blogin\b/.test(p.label) ||
//                           /^username$|^user[_\s-]?name$|\buser_id\b|\buserid\b|\blogin\b/.test(p.name) ||
//                           /^username$|^user[_\s-]?name$|\buser_id\b|\buserid\b|\blogin\b/.test(p.id));
//         const auto = (el.getAttribute && el.getAttribute("autocomplete") || "").toLowerCase().includes("username");
//         if (!explicit && !auto) {
//           // do not allow placeholder-only '@username' or similar — heavy penalty
//           score -= 999;
//         }
//         // guard: if label contains pronoun/location/org etc, block
//         if (/\bpronoun|pronouns|location|company|organisation|organization|org|job|title|role|website\b/.test(p.label + " " + p.name)) {
//           score -= 999;
//         }
//       }

//       if (score > bestScore) { bestScore = score; best = role; }
//     }

//     // threshold
//     const threshold = isForce ? 3 : 6;
//     if (bestScore >= threshold) return best;

//     // fallback: a plain "name" label (not first/last) -> fullname
//     if (/\bname\b/.test(p.label) && !(/\bfirst\b|\blast\b|\bgiven\b|\bfamily\b/.test(p.label))) return "fullname";

//     return null;
//   }

//   function scoreForCfg(ctx, cfg) {
//     let score = 0;
//     for (const rx of cfg.pos) {
//       if (rx.test(ctx.parts.label)) score += 10;
//       if (rx.test(ctx.parts.name)) score += 6;
//       if (rx.test(ctx.parts.placeholder)) score += 2;
//       if (rx.test(ctx.parts.nearby)) score += 1;
//     }
//     if (cfg.neg && cfg.neg.length) {
//       for (const nrx of cfg.neg) if (nrx.test(ctx.combined)) score -= 18;
//     }
//     return score;
//   }

//   // ---------- fill logic ----------
//   function alreadyFilled(el) {
//     if (!el) return false;
//     if (el.dataset?.rowfiller === "filled") return true;
//     if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
//       return !!(el.innerText && el.innerText.trim());
//     }
//     const v = el.value;
//     return (v !== undefined && v !== null && v.toString().trim() !== "");
//   }

//   function tryFillElement(el, role, values) {
//     try {
//       if (!el || !role) return false;
//       if (!isVisible(el)) return false;
//       if (alreadyFilled(el)) return false;

//       const v = values[role];
//       if (!v) return false;

//       // role-specific validations to avoid wrong-type fills
//       const tag = (el.tagName || "").toLowerCase();
//       const type = (el.type || "").toLowerCase();

//       if ((role === "email" || role === "businessEmail") && !looksLikeEmail(v)) return false;
//       if (role === "website" && !looksLikeUrl(v)) return false;
//       if (role === "phone" && !looksLikePhone(v)) return false;
//       if (role === "username" && !looksLikeUsername(v)) return false;

//       // avoid putting email into url/textarea fields
//       if ((role === "email") && (tag === "textarea" || type === "url")) return false;
//       // avoid putting username into email/tel/url
//       if (role === "username" && ["email","tel","url"].includes(type)) return false;

//       // do not overwrite select unless matching option exists
//       if (tag === "select") {
//         for (const opt of Array.from(el.options)) {
//           if ((opt.value && opt.value.toLowerCase() === v.toLowerCase()) || (opt.text && opt.text.toLowerCase() === v.toLowerCase())) {
//             el.value = opt.value;
//             el.dispatchEvent(new Event("change", { bubbles: true }));
//             el.dataset.rowfiller = "filled";
//             return true;
//           }
//         }
//         return false;
//       }

//       // contenteditable
//       if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
//         try { document.execCommand && document.execCommand('insertText', false, v); } catch (e) { el.innerText = v; }
//         el.dataset.rowfiller = "filled";
//         return true;
//       }

//       // finally fill input/textarea
//       setNativeValue(el, v);
//       if (el.dataset) el.dataset.rowfiller = "filled";
//       // blur/enter to trigger frameworks
//       el.dispatchEvent(new Event("blur", { bubbles: true }));
//       return true;
//     } catch (e) {
//       console.warn("tryFillElement error:", e);
//       return false;
//     }
//   }

//   function prepareValues(profile) {
//     const p = profile.profile || profile || {};
//     const first = p.firstname || p.firstName || "";
//     const last = p.lastname || p.lastName || "";
//     const fullname = p.fullname || [first, last].filter(Boolean).join(" ").trim() || "";
//     const password = (p.activePassword === "submissionPassword") ? (p.submissionPassword || "") : (p.emailPassword || "");
//     return {
//       firstname: first,
//       lastname: last,
//       fullname: fullname,
//       username: p.username || "",
//       email: p.email || p.submissionEmail || "",
//       businessEmail: p.businessEmail || "",
//       password,
//       phone: p.phone || "",
//       website: p.website || "",
//       facebook: p.facebook || "",
//       linkedin: p.linkedin || "",
//       instagram: p.instagram || "",
//       twitter: p.twitter || "",
//       youtube: p.youtube || "",
//       description: p.description || p.bio || "",
//       address: p.address || "",
//       city: p.city || "",
//       state: p.state || "",
//       postcode: p.postcode || "",
//       country: p.country || "",
//       location: p.location || "",
//       title: p.title || "",
//       category: p.category || "",
//       subcategory: p.subcategory || ""
//     };
//   }

//   function doFill(profile, isForce = false) {
//     if (!profile) return 0;
//     const vals = prepareValues(profile);
//     const nodes = Array.from(document.querySelectorAll("input, textarea, select, [contenteditable='true']"));

//     nodes.sort((a,b) => {
//       try { return (a.getBoundingClientRect().top || 0) - (b.getBoundingClientRect().top || 0); } catch(e) { return 0; }
//     });

//     let filled = 0;
//     const usedRoles = new Set();

//     for (const el of nodes) {
//       try {
//         if (!isVisible(el)) continue;
//         if (alreadyFilled(el)) continue;

//         const role = matchRoleForElement(el, isForce);
//         if (!role) continue;
//         if (usedRoles.has(role)) {
//           // allow some roles to repeat (social fields) -- but safe default: only one fill per role
//           continue;
//         }
//         const ok = tryFillElement(el, role, vals);
//         if (ok) { filled++; usedRoles.add(role); }
//       } catch (e) {
//         console.warn("doFill loop error", e);
//       }
//     }

//     console.log(`✅ RowFiller: doFill completed (force=${isForce}) -> filled ${filled}`);
//     return filled;
//   }

//   // ---------- messaging ----------
//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (!msg) { sendResponse({ ok:false, error:'no_message' }); return true; }
//     if (msg.action === "autofillProfile" || msg.action === "autofillAuth" || msg.action === "autofill") {
//       chrome.storage.local.get(["autofillEnabled","profile"], (res) => {
//         const enabled = (res && res.autofillEnabled !== undefined) ? res.autofillEnabled : true;
//         if (!enabled) { sendResponse({ ok:false, filled:0, error:'disabled' }); return; }
//         const profile = msg.profile || (res && res.profile) || null;
//         if (!profile) { sendResponse({ ok:false, filled:0, error:'no_profile' }); return; }
//         try {
//           const filled = doFill(profile, !!msg.force);
//           // always reply (so popup knows)
//           sendResponse({ ok: (filled>0), filled: filled, force: !!msg.force });
//         } catch (e) {
//           console.error("autofill error", e);
//           sendResponse({ ok:false, filled:0, error: e && e.message });
//         }
//       });
//       return true; // keep channel open
//     }
//     if (msg.action === "toggleAutofill") {
//       sendResponse({ ok:true, enabled: !!msg.enabled });
//       return;
//     }
//     sendResponse({ ok:false, error:'unknown_action' });
//     return;
//   });

//   // ---------- auto-run (strict mode) ----------
//   const runAuto = debounce(() => {
//     chrome.storage.local.get(["autofillEnabled","profile"], (res) => {
//       const enabled = (res && res.autofillEnabled !== undefined) ? res.autofillEnabled : true;
//       const profile = (res && res.profile) || null;
//       if (!enabled || !profile) return;
//       try { doFill(profile, false); } catch (e) { console.warn("auto fill error", e); }
//     });
//   }, 700);

//   setTimeout(runAuto, 700);
//   setTimeout(runAuto, 1600);

//   if (typeof MutationObserver !== "undefined") {
//     const obs = new MutationObserver(debounce(() => {
//       chrome.storage.local.get(["autofillEnabled","profile"], (res) => {
//         if (res && res.autofillEnabled !== false && res.profile) {
//           try { doFill(res.profile, false); } catch (e) {}
//         }
//       });
//     }, 900));
//     try { if (document.body) obs.observe(document.body, { childList:true, subtree:true }); } catch(e) {}
//   }

//   console.log("RowFiller v4 content script ready");
// })();

// // content/autofill.js (v4.1) - stricter username guarding & role-specific thresholds
// (function () {
//   if (window.__RowFiller_autofill_v4_installed) return;
//   window.__RowFiller_autofill_v4_installed = true;
//   console.log("🔑 content/autofill.js v4.1 loaded (strict username guards)");

//   // ---------- helpers ----------
//   function debounce(fn, wait) {
//     let t = null;
//     return function () { clearTimeout(t); t = setTimeout(() => fn.apply(this, arguments), wait); };
//   }
//   function setNativeValue(el, value) {
//     try {
//       const proto = Object.getPrototypeOf(el);
//       const desc = Object.getOwnPropertyDescriptor(proto, "value");
//       if (desc && desc.set) desc.set.call(el, value);
//       else el.value = value;
//     } catch (e) {
//       try { el.value = value; } catch (e2) {}
//     }
//     el.dispatchEvent(new Event("input", { bubbles: true }));
//     el.dispatchEvent(new Event("change", { bubbles: true }));
//   }
//   function isVisible(el) {
//     try {
//       if (!el) return false;
//       return !(el.disabled || el.hidden || el.readOnly) && (el.offsetParent !== null || el.tagName.toLowerCase() === 'select');
//     } catch (e) { return false; }
//   }

//   // validation helpers
//   function looksLikeEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
//   function looksLikeUrl(v) { if (!v) return false; return /^(https?:\/\/)|\w+\.[a-z]{2,}/i.test(v); }
//   function looksLikePhone(v) { if (!v) return false; const d = (v.match(/\d/g)||[]).length; return d >= 7; }
//   function looksLikeUsername(v) { if (!v) return false; if (v.includes('@')) return false; if (/\s/.test(v)) return false; return /^[A-Za-z0-9._\-]{2,}$/.test(v); }

//   // ---------- context extraction ----------
//   function extractLabel(el) {
//     try {
//       if (!el) return "";
//       if (el.id) {
//         try {
//           const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
//           if (lab && lab.innerText) return lab.innerText.trim();
//         } catch (e) {}
//       }
//       let p = el.parentElement;
//       for (let i = 0; p && i < 6; i++, p = p.parentElement) {
//         if (p.tagName && p.tagName.toLowerCase() === 'label') return (p.innerText || "").trim();
//       }
//       const prev = el.previousElementSibling;
//       if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.tagName === 'DIV')) {
//         if (prev.innerText && prev.innerText.trim()) return prev.innerText.trim();
//       }
//       const labId = el.getAttribute && el.getAttribute('aria-labelledby');
//       if (labId) {
//         const ref = document.getElementById(labId);
//         if (ref && ref.innerText) return ref.innerText.trim();
//       }
//       if (el.title && el.title.trim()) return el.title.trim();
//       return "";
//     } catch (e) { return ""; }
//   }

//   function getFieldContext(el) {
//     const label = (extractLabel(el) || "").trim();
//     const name = (el.name || "").toString().trim();
//     const id = (el.id || "").toString().trim();
//     const placeholder = (el.placeholder || "").toString().trim();
//     const aria = (el.getAttribute && el.getAttribute("aria-label")) || "";
//     const title = (el.getAttribute && el.getAttribute("title")) || "";
//     let nearby = "";
//     try {
//       const parent = el.parentElement;
//       if (parent) {
//         nearby = Array.from(parent.childNodes)
//           .filter(n => n.nodeType === Node.TEXT_NODE)
//           .map(n => n.textContent.trim()).join(" ");
//       }
//     } catch (e) {}
//     return {
//       combined: [label, name, id, placeholder, aria, title, nearby].filter(Boolean).join(" ").toLowerCase(),
//       parts: {
//         label: label.toLowerCase(),
//         name: name.toLowerCase(),
//         id: id.toLowerCase(),
//         placeholder: placeholder.toLowerCase(),
//         aria: (aria || "").toLowerCase(),
//         title: (title || "").toLowerCase(),
//         nearby: (nearby || "").toLowerCase()
//       }
//     };
//   }

//   // ---------- role config ----------
//   const ROLE_CFG = {
//     firstname:   { pos: [/\bfirst(?:[_\s-]?name)?\b/, /\bgiven(?:[_\s-]?name)?\b/], neg: [], minScore: 6 },
//     lastname:    { pos: [/\blast(?:[_\s-]?name)?\b/, /\bsurname\b/, /\bfamily(?:[_\s-]?name)?\b/], neg: [], minScore: 6 },
//     fullname:    { pos: [/\bfull(?:[_\s-]?name)?\b/, /\bdisplay[\s_-]?name\b/, /^\bname$/], neg: [], minScore: 6 },
//     username:    { pos: [/^username$|^user[_\s-]?name$|\buser_id\b|\buserid\b|\blogin\b|handle/], neg: [/\bemail\b|\bmail\b|\bpassword\b|\bfacebook\b|\blinkedin\b|\binstagram\b|\btwitter\b|\byoutube\b|\bwebsite\b|\burl\b|\bpronoun\b|\blocation\b|\bcompany\b|\borg\b/], minScore: 12 },
//     email:       { pos: [/\bemail\b/, /\be-?mail\b/, /\bemail[_\s-]?address\b/], neg: [/business|work|company/], minScore: 6 },
//     businessEmail:{ pos: [/\b(business|work|company|office)[\s_-]*email\b/], neg: [], minScore: 8 },
//     password:    { pos: [/^password$|pass(?:word)?|pwd/], neg: [/confirm|verify|retype|repeat|new|old|current/], minScore: 6 },
//     phone:       { pos: [/\bphone\b/, /\bmobile\b/, /\btel\b/, /\bcontact\b/], neg: [/fax/], minScore: 5 },
//     website:     { pos: [/\bwebsite\b/, /\bhomepage\b/, /\bsite\b/, /\bweb[\s_-]?url\b/, /\burl\b/], neg: [/email/], minScore: 7 },
//     facebook:    { pos: [/facebook|fb\.com/], neg: [], minScore: 8, preferUrl: true },
//     linkedin:    { pos: [/linkedin/], neg: [], minScore: 8, preferUrl: true },
//     instagram:   { pos: [/instagram|insta/], neg: [], minScore: 7 },
//     twitter:     { pos: [/twitter|tweet|x \(formerly twitter\)|\bx\.com\b/], neg: [], minScore: 7 },
//     youtube:     { pos: [/youtube|youtu\.be/], neg: [], minScore: 8, preferUrl: true },
//     description: { pos: [/\bdescription\b/, /\babout\b/, /\bbio\b/, /\bsummary\b/, /\bdetails\b/], neg: [], minScore: 5, preferTextarea: true },
//     address:     { pos: [/\baddress\b/, /\bstreet\b/, /\baddr\b/], neg: [], minScore: 5 },
//     city:        { pos: [/\bcity\b/, /\btown\b/], neg: [], minScore: 5 },
//     state:       { pos: [/\bstate\b/, /\bprovince\b/, /\bregion\b/], neg: [], minScore: 5 },
//     postcode:    { pos: [/\bzip\b/, /\bpostal\b/, /\bpostcode\b/, /\bpin\b/], neg: [], minScore: 5 },
//     country:     { pos: [/\bcountry\b/], neg: [], minScore: 5 },
//     location:    { pos: [/\blocation\b/, /\bplace\b/], neg: [], minScore: 4 },
//     title:       { pos: [/^title$|headline|subject/], neg: [], minScore: 3 },
//     category:    { pos: [/\bcategory\b/], neg: [], minScore: 3 },
//     subcategory: { pos: [/\bsub[\s_-]?category\b/], neg: [], minScore: 3 }
//   };

//   // ---------- username explicit check ----------
//   function isUsernameExplicit(ctx, el) {
//     // explicit when label/name/id contains username/login/handle or autocomplete contains username
//     const comb = (ctx.combined || "");
//     const parts = ctx.parts || {};
//     const explicitRegex = /^username$|user[_\s-]?name|login\b|handle\b|user_id\b|userid\b/;
//     if (explicitRegex.test(parts.label) || explicitRegex.test(parts.name) || explicitRegex.test(parts.id)) return true;
//     const ac = (el.getAttribute && (el.getAttribute('autocomplete') || "") || "").toLowerCase();
//     if (ac.includes('username')) return true;
//     // aria-label explicit
//     if ((parts.aria || "").includes('username') || (parts.placeholder || "").toLowerCase().includes('username')) return true;
//     return false;
//   }

//   // ---------- matching algorithm (label-first) ----------
//   function matchRoleForElement(el, isForce = false) {
//     if (!el) return null;
//     if (!isVisible(el)) return null;

//     const type = (el.type || "").toLowerCase();
//     const tag = (el.tagName || "").toLowerCase();
//     if (["hidden","submit","button","reset","image","file","checkbox","radio"].includes(type)) return null;

//     const ctx = getFieldContext(el);
//     const p = ctx.parts;

//     // short-circuits by HTML type
//     if (type === "email") {
//       if (/\b(business|work|company|office)\b/.test(ctx.combined)) return "businessEmail";
//       return "email";
//     }
//     if (type === "tel") return "phone";
//     if (type === "password") {
//       if (/\bconfirm\b|\bverify\b|\bretype\b|\bnew\b|\bcurrent\b/.test(ctx.combined)) return null;
//       return "password";
//     }
//     if (tag === "textarea") {
//       if (ROLE_CFG.description && scoreForCfg(ctx, ROLE_CFG.description) >= ROLE_CFG.description.minScore) return "description";
//     }

//     // compute scores per role
//     let best = null;
//     let bestScore = -Infinity;

//     const explicitUsernameFlag = isUsernameExplicit(ctx, el);

//     for (const [role, cfg] of Object.entries(ROLE_CFG)) {
//       // if role is username but not explicit, skip scoring entirely (strong guard)
//       if (role === "username" && !explicitUsernameFlag) continue;

//       // prefer textarea/optionality
//       if (cfg.preferTextarea && tag !== "textarea") {
//         // don't score this role if no textarea present nearby (avoid false positives)
//         if (!document.querySelector || !document.querySelector("textarea")) continue;
//       }

//       let score = 0;
//       for (const rx of cfg.pos) {
//         if (rx.test(p.label)) score += 10;
//         if (rx.test(p.name)) score += 6;
//         if (rx.test(p.id)) score += 6;
//         if (rx.test(p.aria)) score += 4;
//         if (rx.test(p.placeholder)) score += 2;
//         if (rx.test(p.title)) score += 2;
//         if (rx.test(p.nearby)) score += 1;
//       }

//       // negative penalties
//       if (cfg.neg && cfg.neg.length) {
//         for (const nrx of cfg.neg) {
//           if (nrx.test(ctx.combined)) score -= 18;
//         }
//       }

//       // social/url heuristic: require url-like context for preferUrl roles
//       if ((role === "facebook" || role === "youtube" || role === "linkedin") && !(/url|http|facebook|linkedin|youtube|profile|https?:\/\//.test(ctx.combined))) {
//         score -= 6;
//       }

//       if (score > bestScore) { bestScore = score; best = role; }
//     }

//     if (!best) {
//       // fallback: label "name" likely means fullname
//       if (/\bname\b/.test(p.label) && !(/\bfirst\b|\blast\b|\bgiven\b|\bfamily\b/.test(p.label))) return "fullname";
//       return null;
//     }

//     // compute required minimum: role-specific minScore; do NOT loosen sensitive roles on force
//     const sensitive = ["username","email","businessEmail","password","phone"];
//     const cfgBest = ROLE_CFG[best] || {};
//     let required = cfgBest.minScore || (isForce ? 3 : 6);

//     if (isForce && !sensitive.includes(best)) {
//       // allow a small relaxation for non-sensitive roles when forced, but not below 3
//       required = Math.max(3, (cfgBest.minScore || 6) - 2);
//     } else {
//       required = cfgBest.minScore || (isForce ? 3 : 6);
//     }

//     if (bestScore >= required) return best;

//     // fallback: single "name" label -> fullname
//     if (/\bname\b/.test(p.label) && !(/\bfirst\b|\blast\b|\bgiven\b|\bfamily\b/.test(p.label))) return "fullname";

//     return null;
//   }

//   function scoreForCfg(ctx, cfg) {
//     let score = 0;
//     for (const rx of cfg.pos) {
//       if (rx.test(ctx.parts.label)) score += 10;
//       if (rx.test(ctx.parts.name)) score += 6;
//       if (rx.test(ctx.parts.placeholder)) score += 2;
//       if (rx.test(ctx.parts.nearby)) score += 1;
//     }
//     if (cfg.neg && cfg.neg.length) {
//       for (const nrx of cfg.neg) if (nrx.test(ctx.combined)) score -= 18;
//     }
//     return score;
//   }

//   // ---------- fill logic ----------
//   function alreadyFilled(el) {
//     try {
//       if (!el) return false;
//       if (el.dataset?.rowfiller === "filled") return true;
//       if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
//         return !!(el.innerText && el.innerText.trim());
//       }
//       const v = el.value;
//       return (v !== undefined && v !== null && v.toString().trim() !== "");
//     } catch (e) {
//       return false;
//     }
//   }

//   function tryFillElement(el, role, values, isForce) {
//     try {
//       if (!el || !role) return false;
//       if (!isVisible(el)) return false;
//       if (alreadyFilled(el)) return false;

//       const v = values[role];
//       if (!v) return false;

//       const tag = (el.tagName || "").toLowerCase();
//       const type = (el.type || "").toLowerCase();

//       // role-specific validations
//       if ((role === "email" || role === "businessEmail") && !looksLikeEmail(v)) return false;
//       if (role === "website" && !looksLikeUrl(v)) return false;
//       if (role === "phone" && !looksLikePhone(v)) return false;
//       if (role === "username" && !looksLikeUsername(v)) return false;

//       // avoid wrong-type fields
//       if ((role === "email") && (tag === "textarea" || type === "url")) return false;
//       if (role === "username" && ["email","tel","url"].includes(type)) return false;

//       // select handling: only set if option matches
//       if (tag === "select") {
//         for (const opt of Array.from(el.options)) {
//           if ((opt.value && opt.value.toLowerCase() === v.toLowerCase()) || (opt.text && opt.text.toLowerCase() === v.toLowerCase())) {
//             el.value = opt.value;
//             el.dispatchEvent(new Event("change", { bubbles: true }));
//             el.dataset.rowfiller = "filled";
//             return true;
//           }
//         }
//         return false;
//       }

//       // contenteditable
//       if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
//         try { document.execCommand && document.execCommand('insertText', false, v); } catch (e) { el.innerText = v; }
//         el.dataset.rowfiller = "filled";
//         return true;
//       }

//       // finally set
//       setNativeValue(el, v);
//       if (el.dataset) el.dataset.rowfiller = "filled";
//       el.dispatchEvent(new Event("blur", { bubbles: true }));
//       return true;
//     } catch (e) {
//       console.warn("tryFillElement error:", e);
//       return false;
//     }
//   }

//   function prepareValues(profile) {
//     const p = profile.profile || profile || {};
//     const first = p.firstname || p.firstName || "";
//     const last = p.lastname || p.lastName || "";
//     const fullname = p.fullname || [first, last].filter(Boolean).join(" ").trim() || "";
//     const password = (p.activePassword === "submissionPassword") ? (p.submissionPassword || "") : (p.emailPassword || "");
//     return {
//       firstname: first,
//       lastname: last,
//       fullname: fullname,
//       username: p.username || "",
//       email: p.email || p.submissionEmail || "",
//       businessEmail: p.businessEmail || "",
//       password,
//       phone: p.phone || "",
//       website: p.website || "",
//       facebook: p.facebook || "",
//       linkedin: p.linkedin || "",
//       instagram: p.instagram || "",
//       twitter: p.twitter || "",
//       youtube: p.youtube || "",
//       description: p.description || p.bio || "",
//       address: p.address || "",
//       city: p.city || "",
//       state: p.state || "",
//       postcode: p.postcode || "",
//       country: p.country || "",
//       location: p.location || "",
//       title: p.title || "",
//       category: p.category || "",
//       subcategory: p.subcategory || ""
//     };
//   }

//   function doFill(profile, isForce = false) {
//     if (!profile) return 0;
//     const vals = prepareValues(profile);
//     const nodes = Array.from(document.querySelectorAll("input, textarea, select, [contenteditable='true']"));

//     nodes.sort((a,b) => {
//       try { return (a.getBoundingClientRect().top || 0) - (b.getBoundingClientRect().top || 0); } catch(e) { return 0; }
//     });

//     let filled = 0;
//     const usedRoles = new Set();

//     for (const el of nodes) {
//       try {
//         if (!isVisible(el)) continue;
//         if (alreadyFilled(el)) continue;

//         const role = matchRoleForElement(el, isForce);
//         if (!role) continue;

//         // extra guard: username must be explicit (redundant, but safe)
//         if (role === "username") {
//           const ctx = getFieldContext(el);
//           if (!isUsernameExplicit(ctx, el)) continue;
//         }

//         // prevent filling same role multiple times unless it's social links (allow some repeats)
//         if (usedRoles.has(role) && !["facebook","linkedin","instagram","twitter","youtube","description"].includes(role)) {
//           continue;
//         }

//         const ok = tryFillElement(el, role, vals, isForce);
//         if (ok) { filled++; usedRoles.add(role); }
//       } catch (e) {
//         console.warn("doFill loop error", e);
//       }
//     }

//     console.log(`✅ RowFiller: doFill completed (force=${isForce}) -> filled ${filled}`);
//     return filled;
//   }

//   // ---------- messaging ----------
//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (!msg) { sendResponse({ ok:false, error:'no_message' }); return true; }
//     if (msg.action === "autofillProfile" || msg.action === "autofillAuth" || msg.action === "autofill") {
//       chrome.storage.local.get(["autofillEnabled","profile"], (res) => {
//         const enabled = (res && res.autofillEnabled !== undefined) ? res.autofillEnabled : true;
//         if (!enabled) { sendResponse({ ok:false, filled:0, error:'disabled' }); return; }
//         const profile = msg.profile || (res && res.profile) || null;
//         if (!profile) { sendResponse({ ok:false, filled:0, error:'no_profile' }); return; }
//         try {
//           const filled = doFill(profile, !!msg.force);
//           sendResponse({ ok: (filled>0), filled: filled, force: !!msg.force });
//         } catch (e) {
//           console.error("autofill error", e);
//           sendResponse({ ok:false, filled:0, error: e && e.message });
//         }
//       });
//       return true;
//     }
//     if (msg.action === "toggleAutofill") {
//       sendResponse({ ok:true, enabled: !!msg.enabled });
//       return;
//     }
//     sendResponse({ ok:false, error:'unknown_action' });
//     return;
//   });

//   // ---------- auto-run ----------
//   const runAuto = debounce(() => {
//     chrome.storage.local.get(["autofillEnabled","profile"], (res) => {
//       const enabled = (res && res.autofillEnabled !== undefined) ? res.autofillEnabled : true;
//       const profile = (res && res.profile) || null;
//       if (!enabled || !profile) return;
//       try { doFill(profile, false); } catch (e) { console.warn("auto fill error", e); }
//     });
//   }, 700);

//   setTimeout(runAuto, 700);
//   setTimeout(runAuto, 1600);

//   if (typeof MutationObserver !== "undefined") {
//     const obs = new MutationObserver(debounce(() => {
//       chrome.storage.local.get(["autofillEnabled","profile"], (res) => {
//         if (res && res.autofillEnabled !== false && res.profile) {
//           try { doFill(res.profile, false); } catch (e) {}
//         }
//       });
//     }, 900));
//     try { if (document.body) obs.observe(document.body, { childList:true, subtree:true }); } catch(e) {}
//   }

//   console.log("RowFiller v4.1 content script ready (strict username rules)");
// })();

// // content/autofill.js (v5.0) - Multi-Strategy Robust Detection System
// (function () {
//   if (window.__RowFiller_autofill_v5_installed) return;
//   window.__RowFiller_autofill_v5_installed = true;
//   console.log("🔑 content/autofill.js v5.0 loaded (Multi-Strategy Detection)");

//   // ---------- Core Helpers ----------
//   function debounce(fn, wait) {
//     let t = null;
//     return function () {
//       clearTimeout(t);
//       t = setTimeout(() => fn.apply(this, arguments), wait);
//     };
//   }

//   function setNativeValue(el, value) {
//     try {
//       const proto = Object.getPrototypeOf(el);
//       const desc = Object.getOwnPropertyDescriptor(proto, "value");
//       if (desc && desc.set) desc.set.call(el, value);
//       else el.value = value;
//     } catch (e) {
//       try {
//         el.value = value;
//       } catch (e2) {}
//     }
//     el.dispatchEvent(new Event("input", { bubbles: true }));
//     el.dispatchEvent(new Event("change", { bubbles: true }));
//     el.dispatchEvent(new Event("blur", { bubbles: true }));
//   }

//   function isVisible(el) {
//     try {
//       if (!el || el.disabled || el.hidden || el.readOnly) return false;
//       const style = getComputedStyle(el);
//       return (
//         style.display !== "none" &&
//         style.visibility !== "hidden" &&
//         style.opacity !== "0"
//       );
//     } catch (e) {
//       return !!(el.offsetParent || el.tagName === "select");
//     }
//   }

//   // Enhanced validation helpers
//   function looksLikeEmail(v) {
//     return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
//   }
//   function looksLikeUrl(v) {
//     return v && (/^https?:\/\//.test(v) || /\w+\.[a-z]{2,}/i.test(v));
//   }
//   function looksLikePhone(v) {
//     return v && (v.match(/\d/g) || []).length >= 7;
//   }
//   function looksLikeUsername(v) {
//     return (
//       v && !v.includes("@") && !/\s/.test(v) && /^[A-Za-z0-9._\-]{2,}$/.test(v)
//     );
//   }

//   // ---------- Advanced Context Extraction ----------
//   function getAllContextData(el) {
//     const data = {
//       element: el,
//       tag: el.tagName?.toLowerCase() || "",
//       type: el.type?.toLowerCase() || "",
//       name: el.name || "",
//       id: el.id || "",
//       className: el.className || "",
//       placeholder: el.placeholder || "",
//       title: el.title || "",
//       ariaLabel: el.getAttribute?.("aria-label") || "",
//       ariaLabelledBy: el.getAttribute?.("aria-labelledby") || "",
//       autocomplete: el.getAttribute?.("autocomplete") || "",
//       dataTestId: el.getAttribute?.("data-testid") || "",
//       dataField: el.getAttribute?.("data-field") || "",
//       dataType: el.getAttribute?.("data-type") || "",
//       label: "",
//       siblingText: "",
//       parentText: "",
//       nearbyText: "",
//     };

//     // Extract label relationships
//     try {
//       if (data.id) {
//         const label = document.querySelector(
//           `label[for="${CSS.escape(data.id)}"]`
//         );
//         if (label) data.label = label.innerText?.trim() || "";
//       }

//       // Check parent labels
//       let parent = el.parentElement;
//       for (let i = 0; i < 5 && parent; i++, parent = parent.parentElement) {
//         if (parent.tagName === "LABEL") {
//           data.label = data.label || parent.innerText?.trim() || "";
//           break;
//         }
//       }

//       // Sibling text (previous/next elements)
//       const prevSibling = el.previousElementSibling;
//       if (
//         prevSibling &&
//         ["LABEL", "SPAN", "DIV", "P"].includes(prevSibling.tagName)
//       ) {
//         data.siblingText = prevSibling.innerText?.trim() || "";
//       }

//       // Parent container text
//       if (el.parentElement) {
//         const parentTextNodes = Array.from(el.parentElement.childNodes)
//           .filter((n) => n.nodeType === Node.TEXT_NODE)
//           .map((n) => n.textContent?.trim())
//           .filter(Boolean)
//           .join(" ");
//         data.parentText = parentTextNodes;
//       }

//       // Nearby text (within reasonable distance)
//       try {
//         const rect = el.getBoundingClientRect();
//         const nearby = Array.from(
//           document.querySelectorAll("label, span, div, p")
//         )
//           .filter((e) => {
//             const eRect = e.getBoundingClientRect();
//             return (
//               Math.abs(eRect.top - rect.top) < 50 &&
//               Math.abs(eRect.left - rect.left) < 200
//             );
//           })
//           .map((e) => e.innerText?.trim())
//           .filter(Boolean)
//           .join(" ");
//         data.nearbyText = nearby;
//       } catch (e) {}

//       // aria-labelledby reference
//       if (data.ariaLabelledBy) {
//         const ref = document.getElementById(data.ariaLabelledBy);
//         if (ref) data.label = data.label || ref.innerText?.trim() || "";
//       }
//     } catch (e) {
//       console.warn("Context extraction error:", e);
//     }

//     return data;
//   }

//   // ---------- Multi-Strategy Field Detection ----------
//   const FIELD_PATTERNS = {
//     email: {
//       html_type: ["email"],
//       positive_patterns: [
//         /\bemail\b/i,
//         /\be-?mail\b/i,
//         /\bmail\b/i,
//         /\bemail[_\s-]?address\b/i,
//         /\buser[_\s-]?email\b/i,
//         /\baccount[_\s-]?email\b/i,
//         /\bemail[_\s-]?field\b/i,
//       ],
//       negative_patterns: [
//         /\b(business|work|company|office)\b/i,
//         /confirm/i,
//         /verify/i,
//       ],
//       css_classes: [
//         "email",
//         "e-mail",
//         "user-email",
//         "account-email",
//         "login-email",
//         "input-email",
//         "field-email",
//         "form-email",
//       ],
//       data_attributes: ["email", "user-email", "account-email"],
//       autocomplete: ["email", "username"],
//       score_threshold: 5,
//     },

//     username: {
//       html_type: ["text"],
//       positive_patterns: [
//         /^username$/i,
//         /^user[_\s-]?name$/i,
//         /\buser[_\s-]?id\b/i,
//         /\buserid\b/i,
//         /\blogin\b/i,
//         /\bhandle\b/i,
//         /\baccount[_\s-]?name\b/i,
//         /\buser\b/i,
//       ],
//       negative_patterns: [
//         /email/i,
//         /password/i,
//         /facebook/i,
//         /twitter/i,
//         /linkedin/i,
//         /instagram/i,
//         /youtube/i,
//         /website/i,
//         /url/i,
//         /phone/i,
//         /first/i,
//         /last/i,
//         /full/i,
//         /business/i,
//         /company/i,
//         /organization/i,
//         /location/i,
//         /address/i,
//       ],
//       css_classes: [
//         "username",
//         "user-name",
//         "user_name",
//         "login",
//         "handle",
//         "account-name",
//         "user-id",
//         "userid",
//         "login-field",
//         "user-field",
//       ],
//       data_attributes: ["username", "user-name", "login", "handle"],
//       autocomplete: ["username"],
//       score_threshold: 8,
//     },

//     password: {
//       html_type: ["password"],
//       positive_patterns: [/\bpassword\b/i, /\bpass\b/i, /\bpwd\b/i],
//       negative_patterns: [
//         /confirm/i,
//         /verify/i,
//         /retype/i,
//         /repeat/i,
//         /new/i,
//         /current/i,
//         /old/i,
//       ],
//       css_classes: ["password", "pass", "pwd", "login-password"],
//       data_attributes: ["password", "pass"],
//       autocomplete: ["current-password", "new-password"],
//       score_threshold: 5,
//     },

//     firstname: {
//       html_type: ["text"],
//       positive_patterns: [
//         /\bfirst[_\s-]?name\b/i,
//         /\bgiven[_\s-]?name\b/i,
//         /\bfname\b/i,
//         /\bfirst\b/i,
//       ],
//       negative_patterns: [],
//       css_classes: ["firstname", "first-name", "fname", "given-name"],
//       data_attributes: ["firstname", "first-name"],
//       autocomplete: ["given-name"],
//       score_threshold: 5,
//     },

//     lastname: {
//       html_type: ["text"],
//       positive_patterns: [
//         /\blast[_\s-]?name\b/i,
//         /\bsurname\b/i,
//         /\bfamily[_\s-]?name\b/i,
//         /\blname\b/i,
//       ],
//       negative_patterns: [],
//       css_classes: ["lastname", "last-name", "lname", "surname", "family-name"],
//       data_attributes: ["lastname", "last-name"],
//       autocomplete: ["family-name"],
//       score_threshold: 5,
//     },

//     fullname: {
//       html_type: ["text"],
//       positive_patterns: [
//         /\bfull[_\s-]?name\b/i,
//         /\bdisplay[_\s-]?name\b/i,
//         /^name$/i,
//         /\breal[_\s-]?name\b/i,
//       ],
//       negative_patterns: [/first/i, /last/i, /user/i, /company/i],
//       css_classes: ["fullname", "full-name", "display-name", "real-name"],
//       data_attributes: ["fullname", "full-name"],
//       autocomplete: ["name"],
//       score_threshold: 5,
//     },

//     phone: {
//       html_type: ["tel", "text"],
//       positive_patterns: [
//         /\bphone\b/i,
//         /\bmobile\b/i,
//         /\btel\b/i,
//         /\bcontact\b/i,
//         /\bnumber\b/i,
//       ],
//       negative_patterns: [/fax/i, /office/i],
//       css_classes: ["phone", "mobile", "tel", "contact-number"],
//       data_attributes: ["phone", "mobile", "tel"],
//       autocomplete: ["tel"],
//       score_threshold: 4,
//     },

//     website: {
//       html_type: ["url", "text"],
//       positive_patterns: [
//         /\bwebsite\b/i,
//         /\bhomepage\b/i,
//         /\bsite\b/i,
//         /\bweb[_\s-]?url\b/i,
//         /\burl\b/i,
//       ],
//       negative_patterns: [/email/i, /social/i],
//       css_classes: ["website", "homepage", "url", "web-url"],
//       data_attributes: ["website", "url"],
//       autocomplete: ["url"],
//       score_threshold: 5,
//     },
//   };

//   // Calculate field detection score
//   function calculateFieldScore(context, fieldType) {
//     const config = FIELD_PATTERNS[fieldType];
//     if (!config) return 0;

//     let score = 0;
//     const searchText = [
//       context.label,
//       context.name,
//       context.id,
//       context.placeholder,
//       context.ariaLabel,
//       context.title,
//       context.siblingText,
//       context.parentText,
//       context.className,
//       context.dataTestId,
//       context.dataField,
//       context.dataType,
//     ]
//       .join(" ")
//       .toLowerCase();

//     // HTML type match (highest priority)
//     if (config.html_type && config.html_type.includes(context.type)) {
//       score += 15;
//     }

//     // Autocomplete attribute match
//     if (
//       config.autocomplete &&
//       config.autocomplete.some((ac) => context.autocomplete.includes(ac))
//     ) {
//       score += 12;
//     }

//     // Positive pattern matching
//     config.positive_patterns?.forEach((pattern) => {
//       if (pattern.test(context.label)) score += 10;
//       if (pattern.test(context.name)) score += 8;
//       if (pattern.test(context.id)) score += 8;
//       if (pattern.test(context.placeholder)) score += 6;
//       if (pattern.test(context.ariaLabel)) score += 6;
//       if (pattern.test(context.dataTestId)) score += 5;
//       if (pattern.test(context.className)) score += 4;
//       if (pattern.test(context.siblingText)) score += 3;
//       if (pattern.test(context.parentText)) score += 2;
//     });

//     // CSS class matching
//     config.css_classes?.forEach((cls) => {
//       if (context.className.toLowerCase().includes(cls)) score += 6;
//     });

//     // Data attribute matching
//     config.data_attributes?.forEach((attr) => {
//       if (
//         context.dataField.toLowerCase().includes(attr) ||
//         context.dataType.toLowerCase().includes(attr)
//       )
//         score += 7;
//     });

//     // Negative pattern penalties
//     config.negative_patterns?.forEach((pattern) => {
//       if (pattern.test(searchText)) score -= 10;
//     });

//     return score;
//   }

//   // Detect field type using multi-strategy approach
//   function detectFieldType(element, isForce = false) {
//     if (!isVisible(element)) return null;

//     const context = getAllContextData(element);

//     // Skip non-input elements
//     if (
//       [
//         "hidden",
//         "submit",
//         "button",
//         "reset",
//         "image",
//         "file",
//         "checkbox",
//         "radio",
//       ].includes(context.type)
//     ) {
//       return null;
//     }

//     let bestType = null;
//     let bestScore = -1;

//     // Test each field type
//     for (const [fieldType, config] of Object.entries(FIELD_PATTERNS)) {
//       const score = calculateFieldScore(context, fieldType);
//       const threshold = isForce
//         ? Math.max(3, config.score_threshold - 2)
//         : config.score_threshold;

//       if (score >= threshold && score > bestScore) {
//         bestScore = score;
//         bestType = fieldType;
//       }
//     }

//     // Special handling for textarea
//     if (context.tag === "textarea") {
//       const descScore = calculateFieldScore(context, "description");
//       if (descScore >= 3) return "description";
//     }

//     // Fallback logic
//     if (!bestType) {
//       const labelText = context.label.toLowerCase();
//       if (
//         labelText.includes("name") &&
//         !labelText.includes("user") &&
//         !labelText.includes("first") &&
//         !labelText.includes("last")
//       ) {
//         return "fullname";
//       }
//     }

//     console.log(
//       `Field detection: ${element.tagName}[${
//         element.name || element.id || "unnamed"
//       }] -> ${bestType} (score: ${bestScore})`
//     );
//     return bestType;
//   }

//   // ---------- Fill Logic ----------
//   function alreadyFilled(el) {
//     try {
//       if (el.dataset?.rowfiller === "filled") return true;
//       if (el.getAttribute?.("contenteditable") === "true") {
//         return !!el.innerText?.trim();
//       }
//       return !!el.value?.trim();
//     } catch (e) {
//       return false;
//     }
//   }

//   function shouldSkipFill(element, fieldType, value, isForce) {
//     // Skip if already filled and not in force mode
//     if (!isForce && alreadyFilled(element)) return true;

//     // In force mode, check if current value seems appropriate
//     if (isForce && alreadyFilled(element)) {
//       const currentValue = element.value?.trim() || "";

//       // Type-specific validation
//       switch (fieldType) {
//         case "email":
//           return looksLikeEmail(currentValue) && looksLikeEmail(value);
//         case "username":
//           return looksLikeUsername(currentValue) && looksLikeUsername(value);
//         case "website":
//           return looksLikeUrl(currentValue) && looksLikeUrl(value);
//         case "phone":
//           return looksLikePhone(currentValue) && looksLikePhone(value);
//         default:
//           return currentValue.length > 2; // Has substantial content
//       }
//     }

//     return false;
//   }

//   function fillElement(element, fieldType, value, isForce = false) {
//     try {
//       if (shouldSkipFill(element, fieldType, value, isForce)) return false;
//       if (!value) return false;

//       const context = getAllContextData(element);

//       // Type-specific validation
//       switch (fieldType) {
//         case "email":
//           if (!looksLikeEmail(value)) return false;
//           if (context.tag === "textarea" || context.type === "url")
//             return false;
//           break;
//         case "username":
//           if (!looksLikeUsername(value)) return false;
//           if (["email", "tel", "url"].includes(context.type)) return false;
//           break;
//         case "website":
//           if (!looksLikeUrl(value)) return false;
//           break;
//         case "phone":
//           if (!looksLikePhone(value)) return false;
//           break;
//       }

//       // Handle select elements
//       if (context.tag === "select") {
//         const option = Array.from(element.options).find(
//           (opt) =>
//             opt.value?.toLowerCase() === value.toLowerCase() ||
//             opt.text?.toLowerCase() === value.toLowerCase()
//         );
//         if (option) {
//           element.value = option.value;
//           element.dispatchEvent(new Event("change", { bubbles: true }));
//           element.dataset.rowfiller = "filled";
//           return true;
//         }
//         return false;
//       }

//       // Handle contenteditable
//       if (element.getAttribute?.("contenteditable") === "true") {
//         try {
//           if (document.execCommand) {
//             document.execCommand("insertText", false, value);
//           } else {
//             element.innerText = value;
//           }
//         } catch (e) {
//           element.innerText = value;
//         }
//         element.dataset.rowfiller = "filled";
//         return true;
//       }

//       // Fill regular input/textarea
//       setNativeValue(element, value);
//       element.dataset.rowfiller = "filled";

//       console.log(`✅ Filled ${fieldType}: ${value}`);
//       return true;
//     } catch (error) {
//       console.warn("Fill error:", error);
//       return false;
//     }
//   }

//   // ---------- Profile Data Processing ----------
//   function prepareProfileData(profile) {
//     const p = profile.profile || profile || {};
//     const first = p.firstname || p.firstName || "";
//     const last = p.lastname || p.lastName || "";
//     const fullname =
//       p.fullname || [first, last].filter(Boolean).join(" ").trim() || "";
//     const password =
//       p.activePassword === "submissionPassword"
//         ? p.submissionPassword || ""
//         : p.emailPassword || "";

//     return {
//       firstname: first,
//       lastname: last,
//       fullname: fullname,
//       username: p.username || "",
//       email: p.email || p.submissionEmail || "",
//       businessEmail: p.businessEmail || "",
//       password: password,
//       phone: p.phone || "",
//       website: p.website || "",
//       facebook: p.facebook || "",
//       linkedin: p.linkedin || "",
//       instagram: p.instagram || "",
//       twitter: p.twitter || "",
//       youtube: p.youtube || "",
//       description: p.description || p.bio || "",
//       address: p.address || "",
//       city: p.city || "",
//       state: p.state || "",
//       postcode: p.postcode || "",
//       country: p.country || "",
//       location: p.location || "",
//       title: p.title || "",
//       category: p.category || "",
//       subcategory: p.subcategory || "",
//     };
//   }

//   // ---------- Main Fill Function ----------
//   function performFill(profile, isForce = false) {
//     if (!profile) return 0;

//     const profileData = prepareProfileData(profile);
//     const elements = Array.from(
//       document.querySelectorAll(
//         'input, textarea, select, [contenteditable="true"]'
//       )
//     );

//     // Sort by position (top to bottom, left to right)
//     elements.sort((a, b) => {
//       try {
//         const rectA = a.getBoundingClientRect();
//         const rectB = b.getBoundingClientRect();
//         return rectA.top - rectB.top || rectA.left - rectB.left;
//       } catch (e) {
//         return 0;
//       }
//     });

//     let fillCount = 0;
//     const filledTypes = new Set();
//     const processedElements = new Set();

//     console.log(
//       `Starting fill process (force: ${isForce}) with ${elements.length} elements`
//     );

//     for (const element of elements) {
//       try {
//         if (processedElements.has(element)) continue;
//         if (!isVisible(element)) continue;

//         const fieldType = detectFieldType(element, isForce);
//         if (!fieldType) continue;

//         // In normal mode, avoid duplicate field types (except social media)
//         const allowDuplicates = [
//           "facebook",
//           "linkedin",
//           "instagram",
//           "twitter",
//           "youtube",
//           "description",
//         ];
//         if (
//           !isForce &&
//           filledTypes.has(fieldType) &&
//           !allowDuplicates.includes(fieldType)
//         ) {
//           continue;
//         }

//         const value = profileData[fieldType];
//         if (!value) continue;

//         const success = fillElement(element, fieldType, value, isForce);
//         if (success) {
//           fillCount++;
//           filledTypes.add(fieldType);
//           processedElements.add(element);
//         }
//       } catch (error) {
//         console.warn("Element processing error:", error);
//       }
//     }

//     console.log(
//       `✅ Fill completed: ${fillCount} fields filled (force: ${isForce})`
//     );
//     return fillCount;
//   }

//   // ---------- Message Handling ----------
//   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//     if (!message) {
//       sendResponse({ ok: false, error: "no_message" });
//       return true;
//     }

//     if (
//       ["autofillProfile", "autofillAuth", "autofill"].includes(message.action)
//     ) {
//       chrome.storage.local.get(["autofillEnabled", "profile"], (result) => {
//         const enabled = result?.autofillEnabled !== false;
//         if (!enabled) {
//           sendResponse({ ok: false, filled: 0, error: "disabled" });
//           return;
//         }

//         const profile = message.profile || result?.profile;
//         if (!profile) {
//           sendResponse({ ok: false, filled: 0, error: "no_profile" });
//           return;
//         }

//         try {
//           const filled = performFill(profile, !!message.force);
//           sendResponse({
//             ok: filled > 0,
//             filled: filled,
//             force: !!message.force,
//           });
//         } catch (error) {
//           console.error("Autofill error:", error);
//           sendResponse({ ok: false, filled: 0, error: error.message });
//         }
//       });
//       return true;
//     }

//     if (message.action === "toggleAutofill") {
//       sendResponse({ ok: true, enabled: !!message.enabled });
//       return;
//     }

//     sendResponse({ ok: false, error: "unknown_action" });
//     return;
//   });

//   // ---------- Auto-run Logic ----------
//   const autoFill = debounce(() => {
//     chrome.storage.local.get(["autofillEnabled", "profile"], (result) => {
//       const enabled = result?.autofillEnabled !== false;
//       const profile = result?.profile;
//       if (enabled && profile) {
//         try {
//           performFill(profile, false);
//         } catch (error) {
//           console.warn("Auto-fill error:", error);
//         }
//       }
//     });
//   }, 800);

//   // Initial runs
//   setTimeout(autoFill, 1000);
//   setTimeout(autoFill, 2500);

//   // Observe DOM changes
//   if (typeof MutationObserver !== "undefined") {
//     const observer = new MutationObserver(
//       debounce(() => {
//         chrome.storage.local.get(["autofillEnabled", "profile"], (result) => {
//           if (result?.autofillEnabled !== false && result?.profile) {
//             try {
//               performFill(result.profile, false);
//             } catch (error) {
//               console.warn("Observer fill error:", error);
//             }
//           }
//         });
//       }, 1000)
//     );

//     try {
//       if (document.body) {
//         observer.observe(document.body, { childList: true, subtree: true });
//       }
//     } catch (error) {
//       console.warn("Observer setup error:", error);
//     }
//   }

//   console.log("RowFiller v5.0 Multi-Strategy System Ready");
// })();

// // content/autofill.js (v6.4) - Enhanced Field Detection with Address Support and More Negatives for Names
// (function () {
//   if (window.__RowFiller_autofill_v6_installed) return;
//   window.__RowFiller_autofill_v6_installed = true;
//   console.log(
//     "🔑 content/autofill.js v6.4 loaded (Enhanced Detection with Address and Negatives)"
//   );

//   // ---------- Core Helpers ----------
//   function debounce(fn, wait) {
//     let t = null;
//     return function () {
//       clearTimeout(t);
//       t = setTimeout(() => fn.apply(this, arguments), wait);
//     };
//   }

//   function setNativeValue(el, value) {
//     try {
//       const proto = Object.getPrototypeOf(el);
//       const desc = Object.getOwnPropertyDescriptor(proto, "value");
//       if (desc && desc.set) desc.set.call(el, value);
//       else el.value = value;
//     } catch (e) {
//       try {
//         el.value = value;
//       } catch (e2) {}
//     }
//     el.dispatchEvent(new Event("input", { bubbles: true }));
//     el.dispatchEvent(new Event("change", { bubbles: true }));
//     el.dispatchEvent(new Event("blur", { bubbles: true }));
//   }

//   function isVisible(el) {
//     try {
//       if (!el || el.disabled || el.hidden || el.readOnly) return false;
//       const style = getComputedStyle(el);
//       return (
//         style.display !== "none" &&
//         style.visibility !== "hidden" &&
//         style.opacity !== "0"
//       );
//     } catch (e) {
//       return !!(el.offsetParent || el.tagName === "select");
//     }
//   }

//   // Enhanced validation helpers with relaxed email
//   function looksLikeEmail(v) {
//     return /^[^\s@]+@[^\s@]+$/.test(v);
//   } // Relaxed: no required dot after domain
//   function looksLikeUrl(v) {
//     return v && (/^https?:\/\//.test(v) || /\w+\.[a-z]{2,}/i.test(v));
//   }
//   function looksLikePhone(v) {
//     return v && (v.match(/\d/g) || []).length >= 7;
//   }
//   function looksLikeUsername(v) {
//     return (
//       v && !v.includes("@") && !/\s/.test(v) && /^[A-Za-z0-9._\-]{2,}$/.test(v)
//     );
//   }
//   function looksLikeSocialHandle(v) {
//     return v && (/^@/.test(v) || v.includes("/"));
//   } // Loose check for handles like @user or facebook.com/user

//   // ---------- Advanced Context Extraction ----------
//   function getAllContextData(el) {
//     const data = {
//       element: el,
//       tag: el.tagName?.toLowerCase() || "",
//       type: el.type?.toLowerCase() || "",
//       name: el.name || "",
//       id: el.id || "",
//       className: el.className || "",
//       placeholder: el.placeholder || "",
//       title: el.title || "",
//       ariaLabel: el.getAttribute?.("aria-label") || "",
//       ariaLabelledBy: el.getAttribute?.("aria-labelledby") || "",
//       autocomplete: el.getAttribute?.("autocomplete") || "",
//       dataTestId: el.getAttribute?.("data-testid") || "",
//       dataField: el.getAttribute?.("data-field") || "",
//       dataType: el.getAttribute?.("data-type") || "",
//       label: "",
//       siblingText: "",
//       parentText: "",
//       nearbyText: "",
//     };

//     // Extract label relationships
//     try {
//       if (data.id) {
//         const label = document.querySelector(
//           `label[for="${CSS.escape(data.id)}"]`
//         );
//         if (label) data.label = label.innerText?.trim() || "";
//       }

//       // Check parent labels
//       let parent = el.parentElement;
//       for (let i = 0; i < 5 && parent; i++, parent = parent.parentElement) {
//         if (parent.tagName === "LABEL") {
//           data.label = data.label || parent.innerText?.trim() || "";
//           break;
//         }
//       }

//       // Sibling text (previous/next elements)
//       const prevSibling = el.previousElementSibling;
//       if (
//         prevSibling &&
//         ["LABEL", "SPAN", "DIV", "P"].includes(prevSibling.tagName)
//       ) {
//         data.siblingText = prevSibling.innerText?.trim() || "";
//       }

//       // Parent container text
//       if (el.parentElement) {
//         const parentTextNodes = Array.from(el.parentElement.childNodes)
//           .filter((n) => n.nodeType === Node.TEXT_NODE)
//           .map((n) => n.textContent?.trim())
//           .filter(Boolean)
//           .join(" ");
//         data.parentText = parentTextNodes;
//       }

//       // Nearby text (within reasonable distance)
//       try {
//         const rect = el.getBoundingClientRect();
//         const nearby = Array.from(
//           document.querySelectorAll("label, span, div, p")
//         )
//           .filter((e) => {
//             const eRect = e.getBoundingClientRect();
//             return (
//               Math.abs(eRect.top - rect.top) < 50 &&
//               Math.abs(eRect.left - rect.left) < 200 &&
//               e !== el
//             );
//           })
//           .map((e) => e.innerText?.trim())
//           .filter(Boolean)
//           .join(" ");
//         data.nearbyText = nearby;
//       } catch (e) {}

//       // aria-labelledby reference
//       if (data.ariaLabelledBy) {
//         const ref = document.getElementById(data.ariaLabelledBy);
//         if (ref) data.label = data.label || ref.innerText?.trim() || "";
//       }
//     } catch (e) {
//       console.warn("Context extraction error:", e);
//     }

//     return data;
//   }

//   // ---------- Multi-Strategy Field Detection ----------
//   const FIELD_PATTERNS = {
//     email: {
//       html_type: ["email"],
//       positive_patterns: [
//         /\bemail\b/i,
//         /\be-?mail\b/i,
//         /\bmail\b/i,
//         /\bemail[_\s-]?address\b/i,
//         /\buser[_\s-]?email\b/i,
//         /\baccount[_\s-]?email\b/i,
//         /\bemail[_\s-]?field\b/i,
//       ],
//       negative_patterns: [
//         /\b(business|work|company|office)\b/i,
//         /confirm/i,
//         /verify/i,
//         /social/i,
//         /facebook/i,
//         /twitter/i,
//       ],
//       css_classes: [
//         "email",
//         "e-mail",
//         "user-email",
//         "account-email",
//         "login-email",
//         "input-email",
//         "field-email",
//         "form-email",
//       ],
//       data_attributes: ["email", "user-email", "account-email"],
//       autocomplete: ["email", "username"],
//       score_threshold: 6,
//       force_threshold: 10,
//     },

//     username: {
//       html_type: ["text"],
//       positive_patterns: [
//         /^username$/i,
//         /^user[_\s-]?name$/i,
//         /\buser[_\s-]?id\b/i,
//         /\buserid\b/i,
//         /\blogin\b/i,
//         /\bhandle\b/i,
//         /\baccount[_\s-]?name\b/i,
//         /\buser\b/i,
//       ],
//       negative_patterns: [
//         /email/i,
//         /password/i,
//         /facebook/i,
//         /twitter/i,
//         /linkedin/i,
//         /instagram/i,
//         /youtube/i,
//         /website/i,
//         /url/i,
//         /phone/i,
//         /first/i,
//         /last/i,
//         /full/i,
//         /business/i,
//         /company/i,
//         /organization/i,
//         /location/i,
//         /address/i,
//         /social/i,
//         /profile/i,
//         /link/i,
//         /discord/i,
//         /bluesky/i,
//         /mastodon/i,
//         /github/i,
//         /orcid/i,
//         /google/i,
//       ],
//       css_classes: [
//         "username",
//         "user-name",
//         "user_name",
//         "login",
//         "handle",
//         "account-name",
//         "user-id",
//         "userid",
//         "login-field",
//         "user-field",
//       ],
//       data_attributes: ["username", "user-name", "login", "handle"],
//       autocomplete: ["username"],
//       score_threshold: 10,
//       force_threshold: 15,
//       min_signals: 2,
//       force_min_signals: 3,
//     },

//     password: {
//       html_type: ["password"],
//       positive_patterns: [/\bpassword\b/i, /\bpass\b/i, /\bpwd\b/i],
//       negative_patterns: [
//         /confirm/i,
//         /verify/i,
//         /retype/i,
//         /repeat/i,
//         /new/i,
//         /current/i,
//         /old/i,
//       ],
//       css_classes: ["password", "pass", "pwd", "login-password"],
//       data_attributes: ["password", "pass"],
//       autocomplete: ["current-password", "new-password"],
//       score_threshold: 6,
//       force_threshold: 8,
//     },

//     firstname: {
//       html_type: ["text"],
//       positive_patterns: [
//         /\bfirst[_\s-]?name\b/i,
//         /\bgiven[_\s-]?name\b/i,
//         /\bfname\b/i,
//         /\bfirst\b/i,
//       ],
//       negative_patterns: [
//         /social/i,
//         /id/i,
//         /handle/i,
//         /profile/i,
//         /discord/i,
//         /bluesky/i,
//         /mastodon/i,
//         /github/i,
//         /orcid/i,
//         /google/i,
//         /x/i,
//         /twitter/i,
//         /linkedin/i,
//         /facebook/i,
//         /instagram/i,
//         /youtube/i,
//       ],
//       css_classes: ["firstname", "first-name", "fname", "given-name"],
//       data_attributes: ["firstname", "first-name"],
//       autocomplete: ["given-name"],
//       score_threshold: 6,
//       force_threshold: 8,
//     },

//     lastname: {
//       html_type: ["text"],
//       positive_patterns: [
//         /\blast[_\s-]?name\b/i,
//         /\bsurname\b/i,
//         /\bfamily[_\s-]?name\b/i,
//         /\blname\b/i,
//       ],
//       negative_patterns: [
//         /social/i,
//         /id/i,
//         /handle/i,
//         /profile/i,
//         /discord/i,
//         /bluesky/i,
//         /mastodon/i,
//         /github/i,
//         /orcid/i,
//         /google/i,
//         /x/i,
//         /twitter/i,
//         /linkedin/i,
//         /facebook/i,
//         /instagram/i,
//         /youtube/i,
//       ],
//       css_classes: ["lastname", "last-name", "lname", "surname", "family-name"],
//       data_attributes: ["lastname", "last-name"],
//       autocomplete: ["family-name"],
//       score_threshold: 6,
//       force_threshold: 8,
//     },

//     fullname: {
//       html_type: ["text"],
//       positive_patterns: [
//         /\bfull[_\s-]?name\b/i,
//         /\bdisplay[_\s-]?name\b/i,
//         /^name$/i,
//         /\breal[_\s-]?name\b/i,
//       ],
//       negative_patterns: [
//         /first/i,
//         /last/i,
//         /user/i,
//         /company/i,
//         /social/i,
//         /id/i,
//         /handle/i,
//         /profile/i,
//         /discord/i,
//         /bluesky/i,
//         /mastodon/i,
//         /github/i,
//         /orcid/i,
//         /google/i,
//         /x/i,
//         /twitter/i,
//         /linkedin/i,
//         /facebook/i,
//         /instagram/i,
//         /youtube/i,
//       ],
//       css_classes: ["fullname", "full-name", "display-name", "real-name"],
//       data_attributes: ["fullname", "full-name"],
//       autocomplete: ["name"],
//       score_threshold: 6,
//       force_threshold: 8,
//     },

//     phone: {
//       html_type: ["tel", "text"],
//       positive_patterns: [
//         /\bphone\b/i,
//         /\bmobile\b/i,
//         /\btel\b/i,
//         /\bcontact\b/i,
//         /\bnumber\b/i,
//       ],
//       negative_patterns: [/fax/i, /office/i, /social/i],
//       css_classes: ["phone", "mobile", "tel", "contact-number"],
//       data_attributes: ["phone", "mobile", "tel"],
//       autocomplete: ["tel"],
//       score_threshold: 5,
//       force_threshold: 7,
//     },

//     website: {
//       html_type: ["url", "text"],
//       positive_patterns: [
//         /\bwebsite\b/i,
//         /\bhomepage\b/i,
//         /\bsite\b/i,
//         /\bweb[_\s-]?url\b/i,
//         /\burl\b/i,
//       ],
//       negative_patterns: [/email/i, /social/i, /facebook/i, /twitter/i],
//       css_classes: ["website", "homepage", "url", "web-url"],
//       data_attributes: ["website", "url"],
//       autocomplete: ["url"],
//       score_threshold: 6,
//       force_threshold: 9,
//     },

//     address: {
//       html_type: ["text", "textarea"],
//       positive_patterns: [
//         /\baddress\b/i,
//         /\bstreet\b/i,
//         /\baddr\b/i,
//         /\blocation\b/i,
//       ],
//       negative_patterns: [/email/i, /url/i, /name/i, /social/i],
//       css_classes: ["address", "street-address", "location"],
//       data_attributes: ["address", "location"],
//       autocomplete: ["street-address", "postal-address"],
//       score_threshold: 5,
//       force_threshold: 7,
//     },

//     // Social media specific patterns
//     facebook: {
//       html_type: ["text", "url"],
//       positive_patterns: [
//         /\bfacebook\b/i,
//         /\bfb\b/i,
//         /\bfacebook[_\s-]?url\b/i,
//         /\bfacebook[_\s-]?profile\b/i,
//         /\bfacebook[_\s-]?handle\b/i,
//         /\bfacebook[_\s-]?link\b/i,
//         /@facebook/i,
//       ],
//       negative_patterns: [
//         /username/i,
//         /email/i,
//         /password/i,
//         /twitter/i,
//         /linkedin/i,
//       ],
//       css_classes: ["facebook", "fb", "social-facebook", "facebook-input"],
//       data_attributes: ["facebook", "fb"],
//       autocomplete: [],
//       score_threshold: 5,
//       force_threshold: 8,
//     },

//     twitter: {
//       html_type: ["text", "url"],
//       positive_patterns: [
//         /\btwitter\b/i,
//         /\bx\b/i,
//         /\bformerly twitter\b/i,
//         /\btwitter[_\s-]?url\b/i,
//         /\btwitter[_\s-]?profile\b/i,
//         /\btwitter[_\s-]?handle\b/i,
//         /\btwitter[_\s-]?link\b/i,
//         /@twitter/i,
//       ],
//       negative_patterns: [
//         /username/i,
//         /email/i,
//         /password/i,
//         /facebook/i,
//         /linkedin/i,
//       ],
//       css_classes: ["twitter", "x-twitter", "social-twitter"],
//       data_attributes: ["twitter", "x"],
//       autocomplete: [],
//       score_threshold: 5,
//       force_threshold: 8,
//     },

//     linkedin: {
//       html_type: ["text", "url"],
//       positive_patterns: [
//         /\blinkedin\b/i,
//         /\blinked[_\s-]?in\b/i,
//         /\blinkedin[_\s-]?url\b/i,
//         /\blinkedin[_\s-]?profile\b/i,
//         /\blinkedin[_\s-]?handle\b/i,
//         /\blinkedin[_\s-]?link\b/i,
//       ],
//       negative_patterns: [/username/i, /email/i, /password/i],
//       css_classes: ["linkedin", "social-linkedin"],
//       data_attributes: ["linkedin"],
//       autocomplete: [],
//       score_threshold: 5,
//       force_threshold: 8,
//     },

//     instagram: {
//       html_type: ["text", "url"],
//       positive_patterns: [
//         /\binstagram\b/i,
//         /\big\b/i,
//         /\binstagram[_\s-]?url\b/i,
//         /\binstagram[_\s-]?profile\b/i,
//         /\binstagram[_\s-]?handle\b/i,
//         /\binstagram[_\s-]?link\b/i,
//         /@instagram/i,
//       ],
//       negative_patterns: [/username/i, /email/i, /password/i],
//       css_classes: ["instagram", "ig", "social-instagram"],
//       data_attributes: ["instagram", "ig"],
//       autocomplete: [],
//       score_threshold: 5,
//       force_threshold: 8,
//     },

//     youtube: {
//       html_type: ["text", "url"],
//       positive_patterns: [
//         /\byoutube\b/i,
//         /\byt\b/i,
//         /\byoutube[_\s-]?url\b/i,
//         /\byoutube[_\s-]?profile\b/i,
//         /\byoutube[_\s-]?handle\b/i,
//         /\byoutube[_\s-]?link\b/i,
//         /\byoutube[_\s-]?channel\b/i,
//       ],
//       negative_patterns: [/username/i, /email/i, /password/i],
//       css_classes: ["youtube", "yt", "social-youtube"],
//       data_attributes: ["youtube", "yt"],
//       autocomplete: [],
//       score_threshold: 5,
//       force_threshold: 8,
//     },

//     discord: {
//       html_type: ["text"],
//       positive_patterns: [
//         /\bdiscord\b/i,
//         /\bdiscord[_\s-]?id\b/i,
//         /\bdiscord[_\s-]?user\b/i,
//       ],
//       negative_patterns: [/username/i, /email/i, /password/i],
//       css_classes: ["discord", "social-discord"],
//       data_attributes: ["discord"],
//       autocomplete: [],
//       score_threshold: 5,
//       force_threshold: 8,
//     },

//     bluesky: {
//       html_type: ["text", "url"],
//       positive_patterns: [
//         /\bbluesky\b/i,
//         /\bbluesky[_\s-]?handle\b/i,
//         /\bbluesky[_\s-]?profile\b/i,
//       ],
//       negative_patterns: [/username/i, /email/i, /password/i],
//       css_classes: ["bluesky", "social-bluesky"],
//       data_attributes: ["bluesky"],
//       autocomplete: [],
//       score_threshold: 5,
//       force_threshold: 8,
//     },

//     mastodon: {
//       html_type: ["text", "url"],
//       positive_patterns: [
//         /\bmastodon\b/i,
//         /\bmastodon[_\s-]?handle\b/i,
//         /\bmastodon[_\s-]?profile\b/i,
//       ],
//       negative_patterns: [/username/i, /email/i, /password/i],
//       css_classes: ["mastodon", "social-mastodon"],
//       data_attributes: ["mastodon"],
//       autocomplete: [],
//       score_threshold: 5,
//       force_threshold: 8,
//     },

//     github: {
//       html_type: ["text", "url"],
//       positive_patterns: [
//         /\bgithub\b/i,
//         /\bgithub[_\s-]?username\b/i,
//         /\bgithub[_\s-]?profile\b/i,
//       ],
//       negative_patterns: [/username/i, /email/i, /password/i],
//       css_classes: ["github", "social-github"],
//       data_attributes: ["github"],
//       autocomplete: [],
//       score_threshold: 5,
//       force_threshold: 8,
//     },

//     orcid: {
//       html_type: ["text"],
//       positive_patterns: [/\borcid\b/i, /\borcid[_\s-]?id\b/i],
//       negative_patterns: [/username/i, /email/i, /password/i, /name/i],
//       css_classes: ["orcid", "social-orcid"],
//       data_attributes: ["orcid"],
//       autocomplete: [],
//       score_threshold: 5,
//       force_threshold: 8,
//     },

//     google: {
//       html_type: ["text", "url"],
//       positive_patterns: [
//         /\bgoogle\b/i,
//         /\bgoogle\+\b/i,
//         /\bgoogle[_\s-]?plus\b/i,
//         /\bgoogle[_\s-]?profile\b/i,
//       ],
//       negative_patterns: [/username/i, /email/i, /password/i],
//       css_classes: ["google", "google-plus", "social-google"],
//       data_attributes: ["google", "google-plus"],
//       autocomplete: [],
//       score_threshold: 5,
//       force_threshold: 8,
//     },

//     description: {
//       html_type: ["text", "textarea"],
//       positive_patterns: [
//         /\bdescription\b/i,
//         /\bbio\b/i,
//         /\babout\b/i,
//         /\bsummary\b/i,
//         /\bprofile[_\s-]?text\b/i,
//       ],
//       negative_patterns: [/name/i, /email/i, /url/i],
//       css_classes: ["description", "bio", "about", "summary"],
//       data_attributes: ["description", "bio"],
//       autocomplete: [],
//       score_threshold: 5,
//       force_threshold: 7,
//     },
//   };

//   // Calculate field detection score
//   function calculateFieldScore(context, fieldType) {
//     const config = FIELD_PATTERNS[fieldType];
//     if (!config) return 0;

//     let score = 0;
//     const searchText = [
//       context.label,
//       context.name,
//       context.id,
//       context.placeholder,
//       context.ariaLabel,
//       context.title,
//       context.siblingText,
//       context.parentText,
//       context.className,
//       context.dataTestId,
//       context.dataField,
//       context.dataType,
//       context.nearbyText,
//     ]
//       .join(" ")
//       .toLowerCase();

//     // HTML type match (highest priority)
//     if (config.html_type && config.html_type.includes(context.type)) {
//       score += 20; // Increased weight for type match
//     }

//     // Autocomplete attribute match
//     if (
//       config.autocomplete &&
//       config.autocomplete.some((ac) => context.autocomplete.includes(ac))
//     ) {
//       score += 15; // Increased weight
//     }

//     // Positive pattern matching with weighted positions
//     config.positive_patterns?.forEach((pattern) => {
//       if (pattern.test(context.label)) score += 12;
//       if (pattern.test(context.name)) score += 10;
//       if (pattern.test(context.id)) score += 10;
//       if (pattern.test(context.placeholder)) score += 8;
//       if (pattern.test(context.ariaLabel)) score += 8;
//       if (pattern.test(context.dataTestId)) score += 6;
//       if (pattern.test(context.className)) score += 5;
//       if (pattern.test(context.siblingText)) score += 4;
//       if (pattern.test(context.parentText)) score += 3;
//       if (pattern.test(context.nearbyText)) score += 2;
//     });

//     // CSS class matching
//     config.css_classes?.forEach((cls) => {
//       if (context.className.toLowerCase().includes(cls.toLowerCase()))
//         score += 7;
//     });

//     // Data attribute matching
//     config.data_attributes?.forEach((attr) => {
//       if (
//         context.dataField.toLowerCase().includes(attr.toLowerCase()) ||
//         context.dataType.toLowerCase().includes(attr.toLowerCase())
//       )
//         score += 9;
//     });

//     // Negative pattern penalties (stronger penalties)
//     config.negative_patterns?.forEach((pattern) => {
//       if (pattern.test(searchText)) score -= 20; // Stronger penalty to avoid mismatches
//     });

//     return score;
//   }

//   // Multi-signal check for sensitive fields like username
//   function countSignals(context, fieldType) {
//     let signals = 0;
//     const config = FIELD_PATTERNS[fieldType];
//     if (!config) return 0;

//     // Count distinct matches
//     if (config.html_type?.includes(context.type)) signals++;
//     if (config.autocomplete?.some((ac) => context.autocomplete.includes(ac)))
//       signals++;
//     config.positive_patterns?.forEach((pattern) => {
//       if (
//         pattern.test(context.label) ||
//         pattern.test(context.name) ||
//         pattern.test(context.id) ||
//         pattern.test(context.placeholder) ||
//         pattern.test(context.ariaLabel)
//       )
//         signals++;
//     });
//     config.css_classes?.forEach((cls) => {
//       if (context.className.toLowerCase().includes(cls.toLowerCase()))
//         signals++;
//     });

//     return signals;
//   }

//   // Detect field type using multi-strategy approach
//   function detectFieldType(element, isForce = false) {
//     if (!isVisible(element)) return null;

//     const context = getAllContextData(element);

//     // Skip non-input elements
//     if (
//       [
//         "hidden",
//         "submit",
//         "button",
//         "reset",
//         "image",
//         "file",
//         "checkbox",
//         "radio",
//       ].includes(context.type)
//     ) {
//       return null;
//     }

//     let bestType = null;
//     let bestScore = -1;

//     // Test each field type
//     for (const [fieldType, config] of Object.entries(FIELD_PATTERNS)) {
//       const score = calculateFieldScore(context, fieldType);
//       const threshold = isForce
//         ? config.force_threshold || config.score_threshold + 2
//         : config.score_threshold;

//       // For sensitive fields, check min_signals
//       const signals = countSignals(context, fieldType);
//       const minSignals = isForce
//         ? config.force_min_signals || config.min_signals || 2
//         : config.min_signals || 1;
//       if (signals < minSignals) continue;

//       if (score >= threshold && score > bestScore) {
//         bestScore = score;
//         bestType = fieldType;
//       }
//     }

//     // Special handling for textarea as description
//     if (context.tag === "textarea" && !bestType) {
//       const descScore = calculateFieldScore(context, "description");
//       if (
//         descScore >=
//         (isForce
//           ? FIELD_PATTERNS.description.force_threshold
//           : FIELD_PATTERNS.description.score_threshold)
//       ) {
//         return "description";
//       }
//     }

//     // Fallback only if no good match and force mode
//     if (!bestType && isForce) {
//       const labelText = context.label.toLowerCase();
//       if (
//         labelText.includes("name") &&
//         !labelText.includes("user") &&
//         !labelText.includes("first") &&
//         !labelText.includes("last")
//       ) {
//         return "fullname";
//       }
//     }

//     if (bestType) {
//       console.log(
//         `Field detection: ${element.tagName}[${
//           element.name || element.id || "unnamed"
//         }] -> ${bestType} (score: ${bestScore}, signals: ${countSignals(
//           context,
//           bestType
//         )})`
//       );
//     }
//     return bestType;
//   }

//   // ---------- Fill Logic ----------
//   function alreadyFilled(el) {
//     try {
//       if (el.dataset?.rowfiller === "filled") return true;
//       if (el.getAttribute?.("contenteditable") === "true") {
//         return !!el.innerText?.trim();
//       }
//       return !!el.value?.trim();
//     } catch (e) {
//       return false;
//     }
//   }

//   function shouldSkipFill(element, fieldType, value, isForce) {
//     // Always skip if not visible
//     if (!isVisible(element)) return true;

//     // In normal mode, skip if already filled
//     if (!isForce && alreadyFilled(element)) return true;

//     // In force mode, validate if current value is plausible, but force overwrite if mismatch
//     if (isForce && alreadyFilled(element)) {
//       const currentValue = element.value?.trim() || "";
//       switch (fieldType) {
//         case "email":
//           return looksLikeEmail(currentValue); // Skip only if current is valid email
//         case "username":
//           return looksLikeUsername(currentValue);
//         case "website":
//           return looksLikeUrl(currentValue);
//         case "phone":
//           return looksLikePhone(currentValue);
//         case "facebook":
//         case "twitter":
//         case "linkedin":
//         case "instagram":
//         case "youtube":
//           return (
//             looksLikeUrl(currentValue) || looksLikeSocialHandle(currentValue)
//           );
//         default:
//           return currentValue.length > 5; // Skip if substantial content
//       }
//     }

//     return false;
//   }

//   function fillElement(element, fieldType, value, isForce = false) {
//     try {
//       if (shouldSkipFill(element, fieldType, value, isForce)) return false;
//       if (!value) return false;

//       const context = getAllContextData(element);

//       // Strict type-specific validation, relaxed in force mode for 100% fill guarantee
//       if (!isForce) {
//         switch (fieldType) {
//           case "email":
//             if (
//               !looksLikeEmail(value) ||
//               context.tag === "textarea" ||
//               context.type === "url"
//             )
//               return false;
//             break;
//           case "username":
//             if (
//               !looksLikeUsername(value) ||
//               ["email", "tel", "url"].includes(context.type)
//             )
//               return false;
//             break;
//           case "website":
//             if (!looksLikeUrl(value)) return false;
//             break;
//           case "phone":
//             if (!looksLikePhone(value)) return false;
//             break;
//           case "facebook":
//           case "twitter":
//           case "linkedin":
//           case "instagram":
//           case "youtube":
//             if (!looksLikeUrl(value) && !looksLikeSocialHandle(value))
//               return false;
//             break;
//         }
//       } else {
//         // In force mode, minimal checks to ensure compatibility
//         if (
//           fieldType === "email" &&
//           (context.tag === "textarea" || context.type === "url")
//         )
//           return false;
//         if (
//           fieldType === "username" &&
//           ["email", "tel", "url"].includes(context.type)
//         )
//           return false;
//       }

//       // Handle select elements
//       if (context.tag === "select") {
//         const option = Array.from(element.options).find(
//           (opt) =>
//             opt.value?.toLowerCase() === value.toLowerCase() ||
//             opt.text?.toLowerCase() === value.toLowerCase()
//         );
//         if (option) {
//           element.value = option.value;
//           element.dispatchEvent(new Event("change", { bubbles: true }));
//           element.dataset.rowfiller = "filled";
//           return true;
//         }
//         return false;
//       }

//       // Handle contenteditable
//       if (element.getAttribute?.("contenteditable") === "true") {
//         try {
//           if (document.execCommand) {
//             document.execCommand("insertText", false, value);
//           } else {
//             element.innerText = value;
//           }
//         } catch (e) {
//           element.innerText = value;
//         }
//         element.dataset.rowfiller = "filled";
//         return true;
//       }

//       // Fill regular input/textarea
//       setNativeValue(element, value);
//       element.dataset.rowfiller = "filled";

//       console.log(`✅ Filled ${fieldType}: ${value} (force: ${isForce})`);
//       return true;
//     } catch (error) {
//       console.warn("Fill error:", error);
//       return false;
//     }
//   }

//   // ---------- Profile Data Processing ----------
//   function prepareProfileData(profile) {
//     const p = profile.profile || profile || {};
//     const first = p.firstname || p.firstName || "";
//     const last = p.lastname || p.lastName || "";
//     const fullname =
//       p.fullname || [first, last].filter(Boolean).join(" ").trim() || "";
//     const password =
//       p.activePassword === "submissionPassword"
//         ? p.submissionPassword || ""
//         : p.emailPassword || "";

//     return {
//       firstname: first,
//       lastname: last,
//       fullname: fullname,
//       username: p.username || "",
//       email: p.email || p.submissionEmail || "",
//       businessEmail: p.businessEmail || "",
//       password: password,
//       phone: p.phone || "",
//       website: p.website || "",
//       facebook: p.facebook || "",
//       linkedin: p.linkedin || "",
//       instagram: p.instagram || "",
//       twitter: p.twitter || "",
//       youtube: p.youtube || "",
//       description: p.description || p.bio || "",
//       address: p.address || "",
//       city: p.city || "",
//       state: p.state || "",
//       postcode: p.postcode || "",
//       country: p.country || "",
//       location: p.location || "",
//       title: p.title || "",
//       category: p.category || "",
//       subcategory: p.subcategory || "",
//     };
//   }

//   // ---------- Main Fill Function ----------
//   function performFill(profile, isForce = false) {
//     if (!profile) return 0;

//     const profileData = prepareProfileData(profile);
//     const elements = Array.from(
//       document.querySelectorAll(
//         'input, textarea, select, [contenteditable="true"]'
//       )
//     );

//     // Sort by position (top to bottom, left to right) for natural filling order
//     elements.sort((a, b) => {
//       try {
//         const rectA = a.getBoundingClientRect();
//         const rectB = b.getBoundingClientRect();
//         return rectA.top - rectB.top || rectA.left - rectB.left;
//       } catch (e) {
//         return 0;
//       }
//     });

//     let fillCount = 0;
//     const filledTypes = new Set();
//     const processedElements = new Set();

//     console.log(
//       `Starting fill process (force: ${isForce}) with ${elements.length} elements`
//     );

//     for (const element of elements) {
//       try {
//         if (processedElements.has(element)) continue;
//         if (!isVisible(element)) continue;

//         const fieldType = detectFieldType(element, isForce);
//         if (!fieldType) continue;

//         // Prevent duplicate fills in non-force mode, except for allowDuplicates
//         const allowDuplicates = [
//           "facebook",
//           "linkedin",
//           "instagram",
//           "twitter",
//           "youtube",
//           "description",
//         ];
//         if (
//           !isForce &&
//           filledTypes.has(fieldType) &&
//           !allowDuplicates.includes(fieldType)
//         ) {
//           continue;
//         }

//         const value = profileData[fieldType];
//         if (!value) continue;

//         const success = fillElement(element, fieldType, value, isForce);
//         if (success) {
//           fillCount++;
//           filledTypes.add(fieldType);
//           processedElements.add(element);
//         }
//       } catch (error) {
//         console.warn("Element processing error:", error);
//       }
//     }

//     console.log(
//       `✅ Fill completed: ${fillCount} fields filled (force: ${isForce})`
//     );
//     return fillCount;
//   }

//   // ---------- Message Handling ----------
//   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//     if (!message) {
//       sendResponse({ ok: false, error: "no_message" });
//       return true;
//     }

//     if (
//       ["autofillProfile", "autofillAuth", "autofill"].includes(message.action)
//     ) {
//       chrome.storage.local.get(["autofillEnabled", "profile"], (result) => {
//         const enabled = result?.autofillEnabled !== false;
//         if (!enabled) {
//           sendResponse({ ok: false, filled: 0, error: "disabled" });
//           return;
//         }

//         const profile = message.profile || result?.profile;
//         if (!profile) {
//           sendResponse({ ok: false, filled: 0, error: "no_profile" });
//           return;
//         }

//         try {
//           const filled = performFill(profile, !!message.force);
//           sendResponse({
//             ok: filled > 0,
//             filled: filled,
//             force: !!message.force,
//           });
//         } catch (error) {
//           console.error("Autofill error:", error);
//           sendResponse({ ok: false, filled: 0, error: error.message });
//         }
//       });
//       return true;
//     }

//     if (message.action === "toggleAutofill") {
//       sendResponse({ ok: true, enabled: !!message.enabled });
//       return;
//     }

//     sendResponse({ ok: false, error: "unknown_action" });
//     return;
//   });

//   // ---------- Auto-run Logic ----------
//   const autoFill = debounce(() => {
//     chrome.storage.local.get(["autofillEnabled", "profile"], (result) => {
//       const enabled = result?.autofillEnabled !== false;
//       const profile = result?.profile;
//       if (enabled && profile) {
//         try {
//           performFill(profile, false);
//         } catch (error) {
//           console.warn("Auto-fill error:", error);
//         }
//       }
//     });
//   }, 800);

//   // Initial runs with delays for dynamic pages
//   setTimeout(autoFill, 1000);
//   setTimeout(autoFill, 2500);
//   setTimeout(autoFill, 5000); // Extra delay for slower loads

//   // Observe DOM changes for dynamic forms
//   if (typeof MutationObserver !== "undefined") {
//     const observer = new MutationObserver(
//       debounce(() => {
//         chrome.storage.local.get(["autofillEnabled", "profile"], (result) => {
//           if (result?.autofillEnabled !== false && result?.profile) {
//             try {
//               performFill(result.profile, false);
//             } catch (error) {
//               console.warn("Observer fill error:", error);
//             }
//           }
//         });
//       }, 1000)
//     );

//     try {
//       if (document.body) {
//         observer.observe(document.body, {
//           childList: true,
//           subtree: true,
//           attributes: true,
//         });
//       }
//     } catch (error) {
//       console.warn("Observer setup error:", error);
//     }
//   }

//   console.log("RowFiller v6.4 Enhanced System Ready");
// })();




// // content/autofill.js (v6.5) - Universal Strict Matching with Ambiguity Check and Higher Thresholds
// (function () {
//   if (window.__RowFiller_autofill_v6_installed) return;
//   window.__RowFiller_autofill_v6_installed = true;
//   console.log(
//     "🔑 content/autofill.js v6.5 loaded (Strict Matching with Ambiguity Resolution)"
//   );

//   // ---------- Core Helpers ----------
//   function debounce(fn, wait) {
//     let t = null;
//     return function () {
//       clearTimeout(t);
//       t = setTimeout(() => fn.apply(this, arguments), wait);
//     };
//   }

//   function setNativeValue(el, value) {
//     try {
//       const proto = Object.getPrototypeOf(el);
//       const desc = Object.getOwnPropertyDescriptor(proto, "value");
//       if (desc && desc.set) desc.set.call(el, value);
//       else el.value = value;
//     } catch (e) {
//       try {
//         el.value = value;
//       } catch (e2) {}
//     }
//     el.dispatchEvent(new Event("input", { bubbles: true }));
//     el.dispatchEvent(new Event("change", { bubbles: true }));
//     el.dispatchEvent(new Event("blur", { bubbles: true }));
//   }

//   function isVisible(el) {
//     try {
//       if (!el || el.disabled || el.hidden || el.readOnly) return false;
//       const style = getComputedStyle(el);
//       return (
//         style.display !== "none" &&
//         style.visibility !== "hidden" &&
//         style.opacity !== "0"
//       );
//     } catch (e) {
//       return !!(el.offsetParent || el.tagName === "select");
//     }
//   }

//   // Stricter validation helpers
//   function looksLikeEmail(v) {
//     return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); // Require dot in domain for stricter match
//   }
//   function looksLikeUrl(v) {
//     return v && (/^https?:\/\//.test(v) || /\w+\.[a-z]{2,}/i.test(v));
//   }
//   function looksLikePhone(v) {
//     return v && (v.match(/\d/g) || []).length >= 10; // Stricter: at least 10 digits
//   }
//   function looksLikeUsername(v) {
//     return (
//       v && !v.includes("@") && !/\s/.test(v) && /^[A-Za-z0-9._\-]{3,}$/.test(v) // Stricter: min 3 chars
//     );
//   }
//   function looksLikeSocialHandle(v) {
//     return v && (/^@/.test(v) || v.includes("/"));
//   }

//   // ---------- Advanced Context Extraction ----------
//   function getAllContextData(el) {
//     const data = {
//       element: el,
//       tag: el.tagName?.toLowerCase() || "",
//       type: el.type?.toLowerCase() || "",
//       name: el.name || "",
//       id: el.id || "",
//       className: el.className || "",
//       placeholder: el.placeholder || "",
//       title: el.title || "",
//       ariaLabel: el.getAttribute?.("aria-label") || "",
//       ariaLabelledBy: el.getAttribute?.("aria-labelledby") || "",
//       autocomplete: el.getAttribute?.("autocomplete") || "",
//       dataTestId: el.getAttribute?.("data-testid") || "",
//       dataField: el.getAttribute?.("data-field") || "",
//       dataType: el.getAttribute?.("data-type") || "",
//       label: "",
//       siblingText: "",
//       parentText: "",
//       nearbyText: "",
//     };

//     // Extract label relationships
//     try {
//       if (data.id) {
//         const label = document.querySelector(
//           `label[for="${CSS.escape(data.id)}"]`
//         );
//         if (label) data.label = label.innerText?.trim() || "";
//       }

//       // Check parent labels
//       let parent = el.parentElement;
//       for (let i = 0; i < 5 && parent; i++, parent = parent.parentElement) {
//         if (parent.tagName === "LABEL") {
//           data.label = data.label || parent.innerText?.trim() || "";
//           break;
//         }
//       }

//       // Sibling text (previous/next elements)
//       const prevSibling = el.previousElementSibling;
//       if (
//         prevSibling &&
//         ["LABEL", "SPAN", "DIV", "P"].includes(prevSibling.tagName)
//       ) {
//         data.siblingText = prevSibling.innerText?.trim() || "";
//       }

//       // Parent container text
//       if (el.parentElement) {
//         const parentTextNodes = Array.from(el.parentElement.childNodes)
//           .filter((n) => n.nodeType === Node.TEXT_NODE)
//           .map((n) => n.textContent?.trim())
//           .filter(Boolean)
//           .join(" ");
//         data.parentText = parentTextNodes;
//       }

//       // Nearby text (within reasonable distance)
//       try {
//         const rect = el.getBoundingClientRect();
//         const nearby = Array.from(
//           document.querySelectorAll("label, span, div, p")
//         )
//           .filter((e) => {
//             const eRect = e.getBoundingClientRect();
//             return (
//               Math.abs(eRect.top - rect.top) < 50 &&
//               Math.abs(eRect.left - rect.left) < 200 &&
//               e !== el
//             );
//           })
//           .map((e) => e.innerText?.trim())
//           .filter(Boolean)
//           .join(" ");
//         data.nearbyText = nearby;
//       } catch (e) {}

//       // aria-labelledby reference
//       if (data.ariaLabelledBy) {
//         const ref = document.getElementById(data.ariaLabelledBy);
//         if (ref) data.label = data.label || ref.innerText?.trim() || "";
//       }
//     } catch (e) {
//       console.warn("Context extraction error:", e);
//     }

//     return data;
//   }

//   // ---------- Multi-Strategy Field Detection with Higher Thresholds ----------
//   const FIELD_PATTERNS = {
//     email: {
//       html_type: ["email"],
//       positive_patterns: [
//         /\bemail\b/i,
//         /\be-?mail\b/i,
//         /\bmail\b/i,
//         /\bemail[_\s-]?address\b/i,
//         /\buser[_\s-]?email\b/i,
//         /\baccount[_\s-]?email\b/i,
//         /\bemail[_\s-]?field\b/i,
//       ],
//       negative_patterns: [
//         /\b(business|work|company|office)\b/i,
//         /confirm/i,
//         /verify/i,
//         /social/i,
//         /facebook/i,
//         /twitter/i,
//         /linkedin/i,
//         /instagram/i,
//         /youtube/i,
//         /discord/i,
//         /bluesky/i,
//         /mastodon/i,
//         /github/i,
//         /orcid/i,
//         /google/i,
//       ],
//       css_classes: [
//         "email",
//         "e-mail",
//         "user-email",
//         "account-email",
//         "login-email",
//         "input-email",
//         "field-email",
//         "form-email",
//       ],
//       data_attributes: ["email", "user-email", "account-email"],
//       autocomplete: ["email", "username"],
//       score_threshold: 8, // Increased
//       force_threshold: 12, // Increased
//     },

//     username: {
//       html_type: ["text"],
//       positive_patterns: [
//         /^username$/i,
//         /^user[_\s-]?name$/i,
//         /\buser[_\s-]?id\b/i,
//         /\buserid\b/i,
//         /\blogin\b/i,
//         /\bhandle\b/i,
//         /\baccount[_\s-]?name\b/i,
//         /\buser\b/i,
//       ],
//       negative_patterns: [
//         /email/i,
//         /password/i,
//         /facebook/i,
//         /twitter/i,
//         /linkedin/i,
//         /instagram/i,
//         /youtube/i,
//         /website/i,
//         /url/i,
//         /phone/i,
//         /first/i,
//         /last/i,
//         /full/i,
//         /business/i,
//         /company/i,
//         /organization/i,
//         /location/i,
//         /address/i,
//         /social/i,
//         /profile/i,
//         /link/i,
//         /discord/i,
//         /bluesky/i,
//         /mastodon/i,
//         /github/i,
//         /orcid/i,
//         /google/i,
//         /name/i, // Added
//       ],
//       css_classes: [
//         "username",
//         "user-name",
//         "user_name",
//         "login",
//         "handle",
//         "account-name",
//         "user-id",
//         "userid",
//         "login-field",
//         "user-field",
//       ],
//       data_attributes: ["username", "user-name", "login", "handle"],
//       autocomplete: ["username"],
//       score_threshold: 12, // Increased for stricter matching
//       force_threshold: 18, // Increased
//       min_signals: 3, // Increased
//       force_min_signals: 4, // Increased
//     },

//     password: {
//       html_type: ["password"],
//       positive_patterns: [/\bpassword\b/i, /\bpass\b/i, /\bpwd\b/i],
//       negative_patterns: [
//         /confirm/i,
//         /verify/i,
//         /retype/i,
//         /repeat/i,
//         /new/i,
//         /current/i,
//         /old/i,
//       ],
//       css_classes: ["password", "pass", "pwd", "login-password"],
//       data_attributes: ["password", "pass"],
//       autocomplete: ["current-password", "new-password"],
//       score_threshold: 8, // Increased
//       force_threshold: 10, // Increased
//     },

//     firstname: {
//       html_type: ["text"],
//       positive_patterns: [
//         /\bfirst[_\s-]?name\b/i,
//         /\bgiven[_\s-]?name\b/i,
//         /\bfname\b/i,
//         /\bfirst\b/i,
//       ],
//       negative_patterns: [
//         /social/i,
//         /id/i,
//         /handle/i,
//         /profile/i,
//         /discord/i,
//         /bluesky/i,
//         /mastodon/i,
//         /github/i,
//         /orcid/i,
//         /google/i,
//         /x/i,
//         /twitter/i,
//         /linkedin/i,
//         /facebook/i,
//         /instagram/i,
//         /youtube/i,
//         /username/i, // Added
//       ],
//       css_classes: ["firstname", "first-name", "fname", "given-name"],
//       data_attributes: ["firstname", "first-name"],
//       autocomplete: ["given-name"],
//       score_threshold: 8, // Increased
//       force_threshold: 10, // Increased
//     },

//     lastname: {
//       html_type: ["text"],
//       positive_patterns: [
//         /\blast[_\s-]?name\b/i,
//         /\bsurname\b/i,
//         /\bfamily[_\s-]?name\b/i,
//         /\blname\b/i,
//       ],
//       negative_patterns: [
//         /social/i,
//         /id/i,
//         /handle/i,
//         /profile/i,
//         /discord/i,
//         /bluesky/i,
//         /mastodon/i,
//         /github/i,
//         /orcid/i,
//         /google/i,
//         /x/i,
//         /twitter/i,
//         /linkedin/i,
//         /facebook/i,
//         /instagram/i,
//         /youtube/i,
//         /username/i, // Added
//       ],
//       css_classes: ["lastname", "last-name", "lname", "surname", "family-name"],
//       data_attributes: ["lastname", "last-name"],
//       autocomplete: ["family-name"],
//       score_threshold: 8, // Increased
//       force_threshold: 10, // Increased
//     },

//     fullname: {
//       html_type: ["text"],
//       positive_patterns: [
//         /\bfull[_\s-]?name\b/i,
//         /\bdisplay[_\s-]?name\b/i,
//         /^name$/i,
//         /\breal[_\s-]?name\b/i,
//       ],
//       negative_patterns: [
//         /first/i,
//         /last/i,
//         /user/i,
//         /company/i,
//         /social/i,
//         /id/i,
//         /handle/i,
//         /profile/i,
//         /discord/i,
//         /bluesky/i,
//         /mastodon/i,
//         /github/i,
//         /orcid/i,
//         /google/i,
//         /x/i,
//         /twitter/i,
//         /linkedin/i,
//         /facebook/i,
//         /instagram/i,
//         /youtube/i,
//         /username/i, // Added
//       ],
//       css_classes: ["fullname", "full-name", "display-name", "real-name"],
//       data_attributes: ["fullname", "full-name"],
//       autocomplete: ["name"],
//       score_threshold: 8, // Increased
//       force_threshold: 10, // Increased
//     },

//     phone: {
//       html_type: ["tel", "text"],
//       positive_patterns: [
//         /\bphone\b/i,
//         /\bmobile\b/i,
//         /\btel\b/i,
//         /\bcontact\b/i,
//         /\bnumber\b/i,
//       ],
//       negative_patterns: [/fax/i, /office/i, /social/i, /email/i, /username/i], // Added
//       css_classes: ["phone", "mobile", "tel", "contact-number"],
//       data_attributes: ["phone", "mobile", "tel"],
//       autocomplete: ["tel"],
//       score_threshold: 7, // Increased
//       force_threshold: 9, // Increased
//     },

//     website: {
//       html_type: ["url", "text"],
//       positive_patterns: [
//         /\bwebsite\b/i,
//         /\bhomepage\b/i,
//         /\bsite\b/i,
//         /\bweb[_\s-]?url\b/i,
//         /\burl\b/i,
//       ],
//       negative_patterns: [
//         /email/i,
//         /social/i,
//         /facebook/i,
//         /twitter/i,
//         /username/i,
//       ], // Added
//       css_classes: ["website", "homepage", "url", "web-url"],
//       data_attributes: ["website", "url"],
//       autocomplete: ["url"],
//       score_threshold: 8, // Increased
//       force_threshold: 11, // Increased
//     },

//     address: {
//       html_type: ["text", "textarea"],
//       positive_patterns: [
//         /\baddress\b/i,
//         /\bstreet\b/i,
//         /\baddr\b/i,
//         /\blocation\b/i,
//       ],
//       negative_patterns: [/email/i, /url/i, /name/i, /social/i, /username/i], // Added
//       css_classes: ["address", "street-address", "location"],
//       data_attributes: ["address", "location"],
//       autocomplete: ["street-address", "postal-address"],
//       score_threshold: 7, // Increased
//       force_threshold: 9, // Increased
//     },

//     // Social media specific patterns (unchanged but thresholds increased)
//     facebook: {
//       html_type: ["text", "url"],
//       positive_patterns: [
//         /\bfacebook\b/i,
//         /\bfb\b/i,
//         /\bfacebook[_\s-]?url\b/i,
//         /\bfacebook[_\s-]?profile\b/i,
//         /\bfacebook[_\s-]?handle\b/i,
//         /\bfacebook[_\s-]?link\b/i,
//         /@facebook/i,
//       ],
//       negative_patterns: [
//         /username/i,
//         /email/i,
//         /password/i,
//         /twitter/i,
//         /linkedin/i,
//       ],
//       css_classes: ["facebook", "fb", "social-facebook", "facebook-input"],
//       data_attributes: ["facebook", "fb"],
//       autocomplete: [],
//       score_threshold: 7,
//       force_threshold: 10,
//     },

//     twitter: {
//       html_type: ["text", "url"],
//       positive_patterns: [
//         /\btwitter\b/i,
//         /\bx\b/i,
//         /\bformerly twitter\b/i,
//         /\btwitter[_\s-]?url\b/i,
//         /\btwitter[_\s-]?profile\b/i,
//         /\btwitter[_\s-]?handle\b/i,
//         /\btwitter[_\s-]?link\b/i,
//         /@twitter/i,
//       ],
//       negative_patterns: [
//         /username/i,
//         /email/i,
//         /password/i,
//         /facebook/i,
//         /linkedin/i,
//       ],
//       css_classes: ["twitter", "x-twitter", "social-twitter"],
//       data_attributes: ["twitter", "x"],
//       autocomplete: [],
//       score_threshold: 7,
//       force_threshold: 10,
//     },

//     linkedin: {
//       html_type: ["text", "url"],
//       positive_patterns: [
//         /\blinkedin\b/i,
//         /\blinked[_\s-]?in\b/i,
//         /\blinkedin[_\s-]?url\b/i,
//         /\blinkedin[_\s-]?profile\b/i,
//         /\blinkedin[_\s-]?handle\b/i,
//         /\blinkedin[_\s-]?link\b/i,
//       ],
//       negative_patterns: [/username/i, /email/i, /password/i],
//       css_classes: ["linkedin", "social-linkedin"],
//       data_attributes: ["linkedin"],
//       autocomplete: [],
//       score_threshold: 7,
//       force_threshold: 10,
//     },

//     instagram: {
//       html_type: ["text", "url"],
//       positive_patterns: [
//         /\binstagram\b/i,
//         /\big\b/i,
//         /\binstagram[_\s-]?url\b/i,
//         /\binstagram[_\s-]?profile\b/i,
//         /\binstagram[_\s-]?handle\b/i,
//         /\binstagram[_\s-]?link\b/i,
//         /@instagram/i,
//       ],
//       negative_patterns: [/username/i, /email/i, /password/i],
//       css_classes: ["instagram", "ig", "social-instagram"],
//       data_attributes: ["instagram", "ig"],
//       autocomplete: [],
//       score_threshold: 7,
//       force_threshold: 10,
//     },

//     youtube: {
//       html_type: ["text", "url"],
//       positive_patterns: [
//         /\byoutube\b/i,
//         /\byt\b/i,
//         /\byoutube[_\s-]?url\b/i,
//         /\byoutube[_\s-]?profile\b/i,
//         /\byoutube[_\s-]?handle\b/i,
//         /\byoutube[_\s-]?link\b/i,
//         /\byoutube[_\s-]?channel\b/i,
//       ],
//       negative_patterns: [/username/i, /email/i, /password/i],
//       css_classes: ["youtube", "yt", "social-youtube"],
//       data_attributes: ["youtube", "yt"],
//       autocomplete: [],
//       score_threshold: 7,
//       force_threshold: 10,
//     },

//     discord: {
//       html_type: ["text"],
//       positive_patterns: [
//         /\bdiscord\b/i,
//         /\bdiscord[_\s-]?id\b/i,
//         /\bdiscord[_\s-]?user\b/i,
//       ],
//       negative_patterns: [/username/i, /email/i, /password/i],
//       css_classes: ["discord", "social-discord"],
//       data_attributes: ["discord"],
//       autocomplete: [],
//       score_threshold: 7,
//       force_threshold: 10,
//     },

//     bluesky: {
//       html_type: ["text", "url"],
//       positive_patterns: [
//         /\bbluesky\b/i,
//         /\bbluesky[_\s-]?handle\b/i,
//         /\bbluesky[_\s-]?profile\b/i,
//       ],
//       negative_patterns: [/username/i, /email/i, /password/i],
//       css_classes: ["bluesky", "social-bluesky"],
//       data_attributes: ["bluesky"],
//       autocomplete: [],
//       score_threshold: 7,
//       force_threshold: 10,
//     },

//     mastodon: {
//       html_type: ["text", "url"],
//       positive_patterns: [
//         /\bmastodon\b/i,
//         /\bmastodon[_\s-]?handle\b/i,
//         /\bmastodon[_\s-]?profile\b/i,
//       ],
//       negative_patterns: [/username/i, /email/i, /password/i],
//       css_classes: ["mastodon", "social-mastodon"],
//       data_attributes: ["mastodon"],
//       autocomplete: [],
//       score_threshold: 7,
//       force_threshold: 10,
//     },

//     github: {
//       html_type: ["text", "url"],
//       positive_patterns: [
//         /\bgithub\b/i,
//         /\bgithub[_\s-]?username\b/i,
//         /\bgithub[_\s-]?profile\b/i,
//       ],
//       negative_patterns: [/username/i, /email/i, /password/i],
//       css_classes: ["github", "social-github"],
//       data_attributes: ["github"],
//       autocomplete: [],
//       score_threshold: 7,
//       force_threshold: 10,
//     },

//     orcid: {
//       html_type: ["text"],
//       positive_patterns: [/\borcid\b/i, /\borcid[_\s-]?id\b/i],
//       negative_patterns: [/username/i, /email/i, /password/i, /name/i],
//       css_classes: ["orcid", "social-orcid"],
//       data_attributes: ["orcid"],
//       autocomplete: [],
//       score_threshold: 7,
//       force_threshold: 10,
//     },

//     google: {
//       html_type: ["text", "url"],
//       positive_patterns: [
//         /\bgoogle\b/i,
//         /\bgoogle\+\b/i,
//         /\bgoogle[_\s-]?plus\b/i,
//         /\bgoogle[_\s-]?profile\b/i,
//       ],
//       negative_patterns: [/username/i, /email/i, /password/i],
//       css_classes: ["google", "google-plus", "social-google"],
//       data_attributes: ["google", "google-plus"],
//       autocomplete: [],
//       score_threshold: 7,
//       force_threshold: 10,
//     },

//     description: {
//       html_type: ["text", "textarea"],
//       positive_patterns: [
//         /\bdescription\b/i,
//         /\bbio\b/i,
//         /\babout\b/i,
//         /\bsummary\b/i,
//         /\bprofile[_\s-]?text\b/i,
//       ],
//       negative_patterns: [/name/i, /email/i, /url/i, /username/i], // Added
//       css_classes: ["description", "bio", "about", "summary"],
//       data_attributes: ["description", "bio"],
//       autocomplete: [],
//       score_threshold: 7,
//       force_threshold: 9,
//     },
//   };

//   // Calculate field detection score (unchanged)
//   function calculateFieldScore(context, fieldType) {
//     const config = FIELD_PATTERNS[fieldType];
//     if (!config) return 0;

//     let score = 0;
//     const searchText = [
//       context.label,
//       context.name,
//       context.id,
//       context.placeholder,
//       context.ariaLabel,
//       context.title,
//       context.siblingText,
//       context.parentText,
//       context.className,
//       context.dataTestId,
//       context.dataField,
//       context.dataType,
//       context.nearbyText,
//     ]
//       .join(" ")
//       .toLowerCase();

//     // HTML type match (highest priority)
//     if (config.html_type && config.html_type.includes(context.type)) {
//       score += 20;
//     }

//     // Autocomplete attribute match
//     if (
//       config.autocomplete &&
//       config.autocomplete.some((ac) => context.autocomplete.includes(ac))
//     ) {
//       score += 15;
//     }

//     // Positive pattern matching with weighted positions
//     config.positive_patterns?.forEach((pattern) => {
//       if (pattern.test(context.label)) score += 12;
//       if (pattern.test(context.name)) score += 10;
//       if (pattern.test(context.id)) score += 10;
//       if (pattern.test(context.placeholder)) score += 8;
//       if (pattern.test(context.ariaLabel)) score += 8;
//       if (pattern.test(context.dataTestId)) score += 6;
//       if (pattern.test(context.className)) score += 5;
//       if (pattern.test(context.siblingText)) score += 4;
//       if (pattern.test(context.parentText)) score += 3;
//       if (pattern.test(context.nearbyText)) score += 2;
//     });

//     // CSS class matching
//     config.css_classes?.forEach((cls) => {
//       if (context.className.toLowerCase().includes(cls.toLowerCase()))
//         score += 7;
//     });

//     // Data attribute matching
//     config.data_attributes?.forEach((attr) => {
//       if (
//         context.dataField.toLowerCase().includes(attr.toLowerCase()) ||
//         context.dataType.toLowerCase().includes(attr.toLowerCase())
//       )
//         score += 9;
//     });

//     // Negative pattern penalties (stronger penalties)
//     config.negative_patterns?.forEach((pattern) => {
//       if (pattern.test(searchText)) score -= 25; // Even stronger penalty
//     });

//     return score;
//   }

//   // Multi-signal check for sensitive fields like username (unchanged but thresholds used elsewhere)
//   function countSignals(context, fieldType) {
//     let signals = 0;
//     const config = FIELD_PATTERNS[fieldType];
//     if (!config) return 0;

//     // Count distinct matches
//     if (config.html_type?.includes(context.type)) signals++;
//     if (config.autocomplete?.some((ac) => context.autocomplete.includes(ac)))
//       signals++;
//     config.positive_patterns?.forEach((pattern) => {
//       if (
//         pattern.test(context.label) ||
//         pattern.test(context.name) ||
//         pattern.test(context.id) ||
//         pattern.test(context.placeholder) ||
//         pattern.test(context.ariaLabel)
//       )
//         signals++;
//     });
//     config.css_classes?.forEach((cls) => {
//       if (context.className.toLowerCase().includes(cls.toLowerCase()))
//         signals++;
//     });

//     return signals;
//   }

//   // Detect field type with ambiguity resolution (new algo for best match only)
//   function detectFieldType(element, isForce = false) {
//     if (!isVisible(element)) return null;

//     const context = getAllContextData(element);

//     // Skip non-input elements
//     if (
//       [
//         "hidden",
//         "submit",
//         "button",
//         "reset",
//         "image",
//         "file",
//         "checkbox",
//         "radio",
//       ].includes(context.type)
//     ) {
//       return null;
//     }

//     const scores = [];

//     // Test each field type
//     for (const [fieldType, config] of Object.entries(FIELD_PATTERNS)) {
//       const score = calculateFieldScore(context, fieldType);
//       const threshold = isForce
//         ? config.force_threshold || config.score_threshold + 2
//         : config.score_threshold;

//       // For sensitive fields, check min_signals
//       const signals = countSignals(context, fieldType);
//       const minSignals = isForce
//         ? config.force_min_signals || config.min_signals || 2
//         : config.min_signals || 1;
//       if (signals < minSignals) continue;

//       if (score >= threshold) {
//         scores.push({ type: fieldType, score, signals });
//       }
//     }

//     if (scores.length === 0) return null;

//     // Sort by score descending
//     scores.sort((a, b) => b.score - a.score);

//     // Ambiguity check: best must be at least 5 points higher than second best (relaxed in force mode)
//     const minDiff = isForce ? 3 : 5;
//     if (scores.length > 1 && scores[0].score - scores[1].score < minDiff) {
//       console.log(
//         `Ambiguous field: ${scores[0].type} (${scores[0].score}) vs ${scores[1].type} (${scores[1].score}) - skipping`
//       );
//       return null; // Skip if not clear best match
//     }

//     const bestType = scores[0].type;
//     const bestScore = scores[0].score;

//     // Special handling for textarea as description
//     if (context.tag === "textarea" && bestType !== "description") {
//       const descScore = calculateFieldScore(context, "description");
//       if (descScore > bestScore) {
//         return "description";
//       }
//     }

//     // Fallback only if no good match and force mode
//     if (!bestType && isForce) {
//       const labelText = context.label.toLowerCase();
//       if (
//         labelText.includes("name") &&
//         !labelText.includes("user") &&
//         !labelText.includes("first") &&
//         !labelText.includes("last")
//       ) {
//         return "fullname";
//       }
//     }

//     if (bestType) {
//       console.log(
//         `Field detection: ${element.tagName}[${
//           element.name || element.id || "unnamed"
//         }] -> ${bestType} (score: ${bestScore}, signals: ${scores[0].signals})`
//       );
//     }
//     return bestType;
//   }

//   // ---------- Fill Logic ----------
//   function alreadyFilled(el) {
//     try {
//       if (el.dataset?.rowfiller === "filled") return true;
//       if (el.getAttribute?.("contenteditable") === "true") {
//         return !!el.innerText?.trim();
//       }
//       return !!el.value?.trim();
//     } catch (e) {
//       return false;
//     }
//   }

//   function shouldSkipFill(element, fieldType, value, isForce) {
//     // Always skip if not visible
//     if (!isVisible(element)) return true;

//     // In normal mode, skip if already filled
//     if (!isForce && alreadyFilled(element)) return true;

//     // In force mode, validate if current value is plausible, but force overwrite if mismatch
//     if (isForce && alreadyFilled(element)) {
//       const currentValue = element.value?.trim() || "";
//       switch (fieldType) {
//         case "email":
//           return looksLikeEmail(currentValue);
//         case "username":
//           return looksLikeUsername(currentValue);
//         case "website":
//           return looksLikeUrl(currentValue);
//         case "phone":
//           return looksLikePhone(currentValue);
//         case "facebook":
//         case "twitter":
//         case "linkedin":
//         case "instagram":
//         case "youtube":
//           return (
//             looksLikeUrl(currentValue) || looksLikeSocialHandle(currentValue)
//           );
//         default:
//           return currentValue.length > 5;
//       }
//     }

//     return false;
//   }

//   function fillElement(element, fieldType, value, isForce = false) {
//     try {
//       if (shouldSkipFill(element, fieldType, value, isForce)) return false;
//       if (!value) return false;

//       const context = getAllContextData(element);

//       // Strict type-specific validation, relaxed in force mode for 100% fill guarantee
//       if (!isForce) {
//         switch (fieldType) {
//           case "email":
//             if (
//               !looksLikeEmail(value) ||
//               context.tag === "textarea" ||
//               context.type === "url"
//             )
//               return false;
//             break;
//           case "username":
//             if (
//               !looksLikeUsername(value) ||
//               ["email", "tel", "url"].includes(context.type)
//             )
//               return false;
//             break;
//           case "website":
//             if (!looksLikeUrl(value)) return false;
//             break;
//           case "phone":
//             if (!looksLikePhone(value)) return false;
//             break;
//           case "facebook":
//           case "twitter":
//           case "linkedin":
//           case "instagram":
//           case "youtube":
//             if (!looksLikeUrl(value) && !looksLikeSocialHandle(value))
//               return false;
//             break;
//         }
//       } else {
//         // In force mode, minimal checks to ensure compatibility
//         if (
//           fieldType === "email" &&
//           (context.tag === "textarea" || context.type === "url")
//         )
//           return false;
//         if (
//           fieldType === "username" &&
//           ["email", "tel", "url"].includes(context.type)
//         )
//           return false;
//       }

//       // Handle select elements
//       if (context.tag === "select") {
//         const option = Array.from(element.options).find(
//           (opt) =>
//             opt.value?.toLowerCase() === value.toLowerCase() ||
//             opt.text?.toLowerCase() === value.toLowerCase()
//         );
//         if (option) {
//           element.value = option.value;
//           element.dispatchEvent(new Event("change", { bubbles: true }));
//           element.dataset.rowfiller = "filled";
//           return true;
//         }
//         return false;
//       }

//       // Handle contenteditable
//       if (element.getAttribute?.("contenteditable") === "true") {
//         try {
//           if (document.execCommand) {
//             document.execCommand("insertText", false, value);
//           } else {
//             element.innerText = value;
//           }
//         } catch (e) {
//           element.innerText = value;
//         }
//         element.dataset.rowfiller = "filled";
//         return true;
//       }

//       // Fill regular input/textarea
//       setNativeValue(element, value);
//       element.dataset.rowfiller = "filled";

//       console.log(`✅ Filled ${fieldType}: ${value} (force: ${isForce})`);
//       return true;
//     } catch (error) {
//       console.warn("Fill error:", error);
//       return false;
//     }
//   }

//   // ---------- Profile Data Processing ----------
//   function prepareProfileData(profile) {
//     const p = profile.profile || profile || {};
//     const first = p.firstname || p.firstName || "";
//     const last = p.lastname || p.lastName || "";
//     const fullname =
//       p.fullname || [first, last].filter(Boolean).join(" ").trim() || "";
//     const password =
//       p.activePassword === "submissionPassword"
//         ? p.submissionPassword || ""
//         : p.emailPassword || "";

//     return {
//       firstname: first,
//       lastname: last,
//       fullname: fullname,
//       username: p.username || "",
//       email: p.email || p.submissionEmail || "",
//       businessEmail: p.businessEmail || "",
//       password: password,
//       phone: p.phone || "",
//       website: p.website || "",
//       facebook: p.facebook || "",
//       linkedin: p.linkedin || "",
//       instagram: p.instagram || "",
//       twitter: p.twitter || "",
//       youtube: p.youtube || "",
//       description: p.description || p.bio || "",
//       address: p.address || "",
//       city: p.city || "",
//       state: p.state || "",
//       postcode: p.postcode || "",
//       country: p.country || "",
//       location: p.location || "",
//       title: p.title || "",
//       category: p.category || "",
//       subcategory: p.subcategory || "",
//     };
//   }

//   // ---------- Main Fill Function ----------
//   function performFill(profile, isForce = false) {
//     if (!profile) return 0;

//     const profileData = prepareProfileData(profile);
//     const elements = Array.from(
//       document.querySelectorAll(
//         'input, textarea, select, [contenteditable="true"]'
//       )
//     );

//     // Sort by position (top to bottom, left to right) for natural filling order
//     elements.sort((a, b) => {
//       try {
//         const rectA = a.getBoundingClientRect();
//         const rectB = b.getBoundingClientRect();
//         return rectA.top - rectB.top || rectA.left - rectB.left;
//       } catch (e) {
//         return 0;
//       }
//     });

//     let fillCount = 0;
//     const filledTypes = new Set();
//     const processedElements = new Set();

//     console.log(
//       `Starting fill process (force: ${isForce}) with ${elements.length} elements`
//     );

//     for (const element of elements) {
//       try {
//         if (processedElements.has(element)) continue;
//         if (!isVisible(element)) continue;

//         const fieldType = detectFieldType(element, isForce);
//         if (!fieldType) continue;

//         // Prevent duplicate fills in non-force mode, except for allowDuplicates
//         const allowDuplicates = [
//           "facebook",
//           "linkedin",
//           "instagram",
//           "twitter",
//           "youtube",
//           "description",
//         ];
//         if (
//           !isForce &&
//           filledTypes.has(fieldType) &&
//           !allowDuplicates.includes(fieldType)
//         ) {
//           continue;
//         }

//         const value = profileData[fieldType];
//         if (!value) continue;

//         const success = fillElement(element, fieldType, value, isForce);
//         if (success) {
//           fillCount++;
//           filledTypes.add(fieldType);
//           processedElements.add(element);
//         }
//       } catch (error) {
//         console.warn("Element processing error:", error);
//       }
//     }

//     console.log(
//       `✅ Fill completed: ${fillCount} fields filled (force: ${isForce})`
//     );
//     return fillCount;
//   }

//   // ---------- Message Handling ----------
//   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//     if (!message) {
//       sendResponse({ ok: false, error: "no_message" });
//       return true;
//     }

//     if (
//       ["autofillProfile", "autofillAuth", "autofill"].includes(message.action)
//     ) {
//       chrome.storage.local.get(["autofillEnabled", "profile"], (result) => {
//         const enabled = result?.autofillEnabled !== false;
//         if (!enabled) {
//           sendResponse({ ok: false, filled: 0, error: "disabled" });
//           return;
//         }

//         const profile = message.profile || result?.profile;
//         if (!profile) {
//           sendResponse({ ok: false, filled: 0, error: "no_profile" });
//           return;
//         }

//         try {
//           const filled = performFill(profile, !!message.force);
//           sendResponse({
//             ok: filled > 0,
//             filled: filled,
//             force: !!message.force,
//           });
//         } catch (error) {
//           console.error("Autofill error:", error);
//           sendResponse({ ok: false, filled: 0, error: error.message });
//         }
//       });
//       return true;
//     }

//     if (message.action === "toggleAutofill") {
//       sendResponse({ ok: true, enabled: !!message.enabled });
//       return;
//     }

//     sendResponse({ ok: false, error: "unknown_action" });
//     return;
//   });

//   // ---------- Auto-run Logic ----------
//   const autoFill = debounce(() => {
//     chrome.storage.local.get(["autofillEnabled", "profile"], (result) => {
//       const enabled = result?.autofillEnabled !== false;
//       const profile = result?.profile;
//       if (enabled && profile) {
//         try {
//           performFill(profile, false);
//         } catch (error) {
//           console.warn("Auto-fill error:", error);
//         }
//       }
//     });
//   }, 800);

//   // Initial runs with delays for dynamic pages
//   setTimeout(autoFill, 1000);
//   setTimeout(autoFill, 2500);
//   setTimeout(autoFill, 5000); // Extra delay for slower loads

//   // Observe DOM changes for dynamic forms
//   if (typeof MutationObserver !== "undefined") {
//     const observer = new MutationObserver(
//       debounce(() => {
//         chrome.storage.local.get(["autofillEnabled", "profile"], (result) => {
//           if (result?.autofillEnabled !== false && result?.profile) {
//             try {
//               performFill(result.profile, false);
//             } catch (error) {
//               console.warn("Observer fill error:", error);
//             }
//           }
//         });
//       }, 1000)
//     );

//     try {
//       if (document.body) {
//         observer.observe(document.body, {
//           childList: true,
//           subtree: true,
//           attributes: true,
//         });
//       }
//     } catch (error) {
//       console.warn("Observer setup error:", error);
//     }
//   }

//   console.log("RowFiller v6.5 Strict System Ready");
// })();






// good one

// content/autofill.js (updated) - strict label-first username logic + explicit placeholder rules
(function () {
  if (window.__RowFiller_autofill_v_updated) return;
  window.__RowFiller_autofill_v_updated = true;
  console.log("🔑 RowFiller content/autofill.js (label-priority username) loaded");

  // ---------- small helpers ----------
  function debounce(fn, wait = 300) {
    let t = null;
    return function () { clearTimeout(t); t = setTimeout(() => fn.apply(this, arguments), wait); };
  }
  function safeString(v) { try { return (v || "").toString().trim(); } catch (e) { return ""; } }
  function setNativeValue(el, value) {
    try {
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && desc.set) desc.set.call(el, value);
      else el.value = value;
    } catch (e) { try { el.value = value; } catch(e2){} }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }
  function isVisible(el) {
    try {
      if (!el) return false;
      if (el.disabled || el.hidden || el.readOnly) return false;
      const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
      if (style) {
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
      }
      // some selects or elements may have offsetParent null but still visible
      return true;
    } catch (e) { return false; }
  }

  // ---------- validators ----------
  function looksLikeEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim()); }
  function looksLikeUsername(v) { if (!v) return false; v = String(v).trim(); if (v.length < 2) return false; if (v.includes("@")) return false; if (/\s/.test(v)) return false; return /^[A-Za-z0-9._\-]{2,}$/.test(v); }
  function looksLikePhone(v) { if (!v) return false; const d = (String(v).match(/\d/g) || []).length; return d >= 7; }
  function looksLikeUrl(v) { if (!v) return false; return /^https?:\/\//i.test(v) || /\w+\.[a-z]{2,}/i.test(v); }

  // ---------- context extraction ----------
  function extractLabel(el) {
    try {
      if (!el) return "";
      // <label for="id">
      if (el.id) {
        try {
          const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          if (lab && lab.innerText) return lab.innerText.trim();
        } catch (e) {}
      }
      // ancestor label
      let p = el.parentElement;
      for (let i = 0; p && i < 6; i++, p = p.parentElement) {
        if (p.tagName && p.tagName.toLowerCase() === 'label') {
          const t = (p.innerText || "").trim();
          if (t) return t;
        }
      }
      // previous sibling text (common)
      const prev = el.previousElementSibling;
      if (prev && ["LABEL","SPAN","DIV","P"].includes(prev.tagName)) {
        const t = (prev.innerText || "").trim();
        if (t) return t;
      }
      // aria-labelledby
      const labId = el.getAttribute && el.getAttribute("aria-labelledby");
      if (labId) {
        const ref = document.getElementById(labId);
        if (ref && ref.innerText) return ref.innerText.trim();
      }
      // small parent text scan
      try {
        const parent = el.parentElement;
        if (parent) {
          const textNodes = Array.from(parent.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
          for (const n of textNodes) {
            const txt = (n.textContent || "").trim();
            if (txt.length > 1 && txt.length < 120) return txt;
          }
        }
      } catch(e){}
      if (el.title && el.title.trim()) return el.title.trim();
      return "";
    } catch(e){ return ""; }
  }

  function getFieldContext(el) {
    const label = safeString(extractLabel(el));
    const name = safeString(el.name);
    const id = safeString(el.id);
    const placeholder = safeString(el.placeholder);
    const aria = safeString(el.getAttribute && el.getAttribute("aria-label"));
    const title = safeString(el.getAttribute && el.getAttribute("title"));
    // nearby parent text
    let nearby = "";
    try {
      if (el.parentElement) {
        nearby = Array.from(el.parentElement.childNodes)
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => safeString(n.textContent))
          .filter(Boolean).join(" ");
      }
    } catch(e){}
    const combined = [label, name, id, placeholder, aria, title, nearby, safeString(el.className)].filter(Boolean).join(" ").toLowerCase();
    return {
      label: label.toLowerCase(),
      name: name.toLowerCase(),
      id: id.toLowerCase(),
      placeholder: placeholder.toLowerCase(),
      aria: aria.toLowerCase(),
      title: title.toLowerCase(),
      nearby: nearby.toLowerCase(),
      combined
    };
  }

  // ---------- helpers for username priority ----------
  const usernameRegex = /\b(username|user[_\s-]?name|user[_\s-]?id|userid|login|handle|screen[_\s-]?name|nick|nickname)\b/i;
  const emailRegex = /\b(email|e-?mail|mail)\b/i;
  const businessRegex = /\b(business|work|company|office)\b/i;
  const firstnameRegex = /\b(first|first[_\s-]?name|given[_\s-]?name|fname)\b/i;
  const lastnameRegex = /\b(last|last[_\s-]?name|surname|lname)\b/i;
  const fullnameRegex = /\b(full[_\s-]?name|display[_\s-]?name|real[_\s-]?name|^name$)\b/i;
  const addressRegex = /\b(address|street|addr|road|apt|suite|postal|zip|postcode|postalcode)\b/i;
  const confirmPasswordRegex = /\b(confirm|retype|repeat|verify|again)\b/i;

  // ---------- role detection (label priority) ----------
  function detectRole(el, isForce = false) {
    if (!el) return null;
    if (!isVisible(el)) return null;
    const type = (el.type || "").toLowerCase();
    const tag = (el.tagName || "").toLowerCase();
    if (["hidden","submit","button","reset","image","file","checkbox","radio"].includes(type)) return null;

    const ctx = getFieldContext(el);
    const combined = ctx.combined || "";

    // HTML-type shortcuts
    if (type === "email") {
      // business email vs normal
      if (businessRegex.test(combined)) return "businessEmail";
      return "email";
    }
    if (type === "password") {
      // treat confirm fields as password as well (we will fill same password)
      return "password";
    }
    if (type === "tel") return "phone";
    if (tag === "textarea") {
      if (addressRegex.test(combined) || /\bbio\b|\babout\b|\bdescription\b/.test(combined)) {
        // prefer description or address depending on token
        if (addressRegex.test(combined)) return "address";
        return "description";
      }
    }

    // Label priority for username
    const hasLabel = !!(ctx.label && ctx.label.trim().length > 0);
    const labelMatchesUsername = usernameRegex.test(ctx.label || "");
    const placeholderMatchesUsername = usernameRegex.test(ctx.placeholder || "");
    // Rule: Label wins. If label present and does NOT indicate username -> DO NOT fill username even if placeholder indicates it.
    if (labelMatchesUsername) {
      // ensure not obviously an email field (safety)
      if (emailRegex.test(ctx.combined) && !/username/i.test(ctx.label)) {
        // label mentions username? if combined contains email token but label explicitly username -> still username (rare)
      }
      return "username";
    } else if (!hasLabel && placeholderMatchesUsername) {
      // label absent & placeholder mentions username -> allow
      return "username";
    }

    // business email detection (label or placeholder)
    if (emailRegex.test(combined)) {
      if (businessRegex.test(combined)) return "businessEmail";
      return "email";
    }

    // firstname/lastname/fullname detection
    if (firstnameRegex.test(combined)) return "firstname";
    if (lastnameRegex.test(combined)) return "lastname";
    if (fullnameRegex.test(combined)) return "fullname";

    // address detection
    if (addressRegex.test(combined)) {
      // if the element type allows long text or textarea -> address; else still treat as address field
      return "address";
    }

    // social/website heuristics
    if (/\b(website|url|homepage)\b/i.test(combined)) return "website";
    if (/\bfacebook\b/i.test(combined)) return "facebook";
    if (/\blinkedin\b/i.test(combined)) return "linkedin";
    if (/\binstagram\b|\big\b/i.test(combined)) return "instagram";
    if (/\btwitter\b|\bx\b/i.test(combined)) return "twitter";
    if (/\byoutube\b/i.test(combined)) return "youtube";

    // phone detection with tokens
    if (/\b(phone|mobile|tel|contact|number)\b/i.test(combined)) return "phone";

    // fallback: if 'name' by itself and not first/last -> fullname
    if ((ctx.label || "").toLowerCase().trim() === "name" && !firstnameRegex.test(combined) && !lastnameRegex.test(combined)) return "fullname";

    return null;
  }

  // ---------- already filled ----------
  function alreadyFilled(el) {
    try {
      if (!el) return false;
      if (el.dataset && el.dataset.rowfiller === "filled") return true;
      if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
        return !!(el.innerText && el.innerText.trim());
      }
      const v = el.value;
      return (v !== undefined && v !== null && String(v).trim().length > 0);
    } catch (e) { return false; }
  }

  // ---------- try fill one element ----------
  function tryFillElement(el, role, values, overwrite = false, isForce = false) {
    try {
      if (!el || !role) return false;
      if (!isVisible(el)) return false;
      if (!overwrite && alreadyFilled(el)) return false;

      const v = values[role];
      if (!v) return false;

      const tag = (el.tagName || "").toLowerCase();
      const type = (el.type || "").toLowerCase();
      const ctx = getFieldContext(el);

      // Safety validators
      if ((role === "email" || role === "businessEmail") && !looksLikeEmail(v)) return false;
      if (role === "phone" && !looksLikePhone(v)) return false;
      if (role === "website" && !looksLikeUrl(v)) return false;
      if (role === "username" && !looksLikeUsername(v)) return false;

      // EXTRA username guards (per your requirement):
      // - never put username into input[type=email/password/tel/url/number]
      // - never fill username if combined context strongly mentions email, unless label explicitly said username.
      if (role === "username") {
        if (["email","password","tel","url","number"].includes(type)) return false;
        // if label exists and does NOT mention username, do not fill (label-priority). This detectRole already ensures label-priority,
        // but double-check combined context to avoid placeholder-only cases where label exists.
        if (ctx.label && ctx.label.trim().length > 0 && !usernameRegex.test(ctx.label)) return false;
        // also block if combined mentions email or mail
        if (/\b(email|mail)\b/i.test(ctx.combined) && !usernameRegex.test(ctx.label)) return false;
      }

      // Confirm password: we treat as password and fill same password value
      if (role === "password") {
        // If password confirm/verify: we still fill the same password
        // Avoid writing into password-like fields that are for "current password" when not intended? We'll allow general fill.
      }

      // SELECT handling
      if (tag === "select") {
        for (const opt of Array.from(el.options || [])) {
          try {
            if ((opt.value && String(opt.value).toLowerCase() === String(v).toLowerCase()) ||
                (opt.text && String(opt.text).toLowerCase() === String(v).toLowerCase())) {
              el.value = opt.value;
              el.dispatchEvent(new Event("change", { bubbles: true }));
              if (el.dataset) el.dataset.rowfiller = "filled";
              return true;
            }
          } catch(e){}
        }
        return false;
      }

      // contenteditable
      if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
        try { document.execCommand && document.execCommand('insertText', false, v); } catch (e) { el.innerText = v; }
        if (el.dataset) el.dataset.rowfiller = "filled";
        return true;
      }

      // finally set input/textarea
      setNativeValue(el, v);
      if (el.dataset) el.dataset.rowfiller = "filled";
      return true;
    } catch (e) {
      console.warn("tryFillElement error:", e);
      return false;
    }
  }

  // ---------- prepare profile values (NO username derivation) ----------
  function prepareValues(profile) {
    const p = profile && profile.profile ? profile.profile : profile || {};
    const first = p.firstname || p.firstName || "";
    const last = p.lastname || p.lastName || "";
    const fullname = p.fullname || [first, last].filter(Boolean).join(" ").trim() || "";
    const password = (p.activePassword === "submissionPassword") ? (p.submissionPassword || "") : (p.emailPassword || p.password || "");
    return {
      firstname: first,
      lastname: last,
      fullname,
      username: p.username || "", // IMPORTANT: do not infer from email
      email: p.email || p.submissionEmail || "",
      businessEmail: p.businessEmail || "",
      password: password,
      phone: p.phone || p.number || "",
      website: p.website || "",
      facebook: p.facebook || "",
      linkedin: p.linkedin || "",
      instagram: p.instagram || "",
      twitter: p.twitter || "",
      youtube: p.youtube || "",
      description: p.description || p.bio || "",
      address: p.address || "",
      city: p.city || "",
      state: p.state || "",
      postcode: p.postcode || p.zip || "",
      country: p.country || "",
      location: p.location || ""
    };
  }

  // ---------- main fill routine ----------
  function doFill(profile, isForce = false) {
    if (!profile) return 0;
    // safety: skip google accounts
    try {
      const hostname = location.hostname || "";
      if (hostname.includes("accounts.google.com") || hostname.endsWith("google.com")) {
        console.warn("Skipping autofill on Google domains for safety");
        return 0;
      }
    } catch(e){}

    const vals = prepareValues(profile);
    const all = Array.from(document.querySelectorAll("input, textarea, select, [contenteditable='true']"));
    // sort visually top-to-bottom
    all.sort((a,b) => {
      try { return (a.getBoundingClientRect().top || 0) - (b.getBoundingClientRect().top || 0); } catch(e) { return 0; }
    });

    let filled = 0;
    const filledRoles = new Set();

    for (const el of all) {
      try {
        if (!isVisible(el)) continue;
        if (!el.tagName) continue;

        // detect role
        const role = detectRole(el, !!isForce);
        if (!role) continue;

        // special-case mapping: businessEmail fallback to email if not present
        if (role === "businessEmail" && !vals.businessEmail) {
          // if businessEmail not provided fallback to email (user asked to treat business email specially,
          // but fallback is sensible)
          if (vals.email) {
            // we still mark role as businessEmail but value from email
            vals.businessEmail = vals.email;
          } else {
            // nothing to fill
            continue;
          }
        }

        // skip duplicates (except description/social)
        if (filledRoles.has(role) && !["description","facebook","linkedin","instagram","twitter","youtube"].includes(role)) {
          continue;
        }

        // decide whether to fill
        // - normal mode: only fill if element empty
        // - force mode: fill required elements OR if element plausibly matched role
        const isReq = !!(el.required || (el.getAttribute && el.getAttribute("aria-required") === "true"));
        if (!isForce && alreadyFilled(el)) continue;

        // username strictness: username only filled if role detection returned "username"
        if (role === "username") {
          // ensure value present and valid
          if (!vals.username || !looksLikeUsername(vals.username)) {
            // do not fill username if no explicit username in profile or invalid
            continue;
          }
        }

        // try fill
        const ok = tryFillElement(el, role, vals, isForce, isForce);
        if (ok) {
          filled++;
          filledRoles.add(role);
        } else {
          // If force mode and it's required and tryFill failed, attempt a second relaxed attempt for required fields (except username)
          if (isForce && isReq && role !== "username") {
            const ok2 = tryFillElement(el, role, vals, true, true);
            if (ok2) { filled++; filledRoles.add(role); }
          }
        }
      } catch (e) {
        console.warn("doFill loop error", e);
      }
    }

    console.log(`RowFiller: doFill (force=${!!isForce}) -> filled ${filled}`);
    return filled;
  }

  // ---------- message handling ----------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) { sendResponse({ ok:false, error:"no_message" }); return true; }
    if (["autofillProfile","autofillAuth","autofill"].includes(msg.action)) {
      chrome.storage.local.get(["autofillEnabled","profile"], (res) => {
        const enabled = (res && typeof res.autofillEnabled !== "undefined") ? res.autofillEnabled : true;
        if (!enabled) { sendResponse({ ok:false, filled:0, error:"disabled" }); return; }
        const profile = msg.profile || (res && res.profile) || null;
        if (!profile) { sendResponse({ ok:false, filled:0, error:"no_profile" }); return; }
        try {
          const filled = doFill(profile, !!msg.force);
          sendResponse({ ok: filled > 0, filled, force: !!msg.force });
        } catch (e) {
          console.error("autofill error", e);
          sendResponse({ ok:false, filled:0, error: e && e.message });
        }
      });
      return true;
    }
    if (msg.action === "toggleAutofill") { sendResponse({ ok:true }); return; }
    sendResponse({ ok:false, error:"unknown_action" });
    return;
  });

  // ---------- autorun + observer ----------
  function autoRun() {
    try {
      chrome.storage.local.get(["autofillEnabled","profile"], (res) => {
        const enabled = (res && typeof res.autofillEnabled !== "undefined") ? res.autofillEnabled : true;
        const profile = res && res.profile ? res.profile : null;
        if (!enabled || !profile) return;
        try { doFill(profile, false); } catch(e) { console.warn("autofill autorun error", e); }
      });
    } catch(e) {}
  }

  const debouncedAuto = debounce(autoRun, 700);
  setTimeout(debouncedAuto, 700);
  setTimeout(debouncedAuto, 1600);
  setTimeout(debouncedAuto, 3000);

  if (typeof MutationObserver !== "undefined") {
    try {
      const mo = new MutationObserver(debounce(() => {
        autoRun();
      }, 900));
      if (document.body) mo.observe(document.body, { childList:true, subtree:true, attributes:true });
    } catch(e) {}
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.autofillEnabled || changes.profile) autoRun();
  });

  console.log("RowFiller content/autofill updated (label-priority username) ready");
})();
