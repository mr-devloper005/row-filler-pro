// // content/auth.js
// (function () {
//   console.log("🔑 content/auth.js loaded");

//   function setNativeValue(element, value) {
//     try {
//       const prototype = Object.getPrototypeOf(element);
//       const prototypeDescriptor = Object.getOwnPropertyDescriptor(
//         prototype,
//         "value"
//       );
//       const elementDescriptor = Object.getOwnPropertyDescriptor(
//         element.__proto__,
//         "value"
//       );

//       const setter =
//         prototypeDescriptor && prototypeDescriptor.set
//           ? prototypeDescriptor.set
//           : elementDescriptor && elementDescriptor.set
//           ? elementDescriptor.set
//           : null;

//       if (setter) {
//         setter.call(element, value);
//       } else {
//         element.value = value;
//       }
//     } catch (e) {
//       element.value = value;
//     }
//     element.dispatchEvent(new Event("input", { bubbles: true }));
//   }

//   const patterns = {
//     email: [/email/i, /e-mail/i, /user.?email/i, /\bmail\b/i],
//     username: [/user(name)?/i, /login/i, /handle/i, /\buid\b/i],
//     password: [/pass(word)?/i, /^pwd$/i, /passcode/i],
//     fullname: [/full.?name/i, /first.?name/i, /last.?name/i, /\bname\b/i],
//   };

//   function matchField(el) {
//     try {
//       const text = [
//         el.name,
//         el.id,
//         el.placeholder,
//         el.getAttribute("aria-label"),
//         el.getAttribute("aria-labelledby"),
//       ]
//         .filter(Boolean)
//         .join(" ");
//       for (const [key, regexes] of Object.entries(patterns)) {
//         if (regexes.some((rx) => rx.test(text))) return key;
//       }
//       if (el.type === "email") return "email";
//       if (el.type === "password") return "password";
//     } catch (e) {}
//     return null;
//   }

//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (!msg || msg.action !== "autofillAuth") return;
//     console.log("📩 content/auth.js received autofillAuth");

//     chrome.storage.local.get("profile", (res) => {
//       const profile = res && res.profile;
//       if (!profile) {
//         console.warn("No profile found in storage");
//         sendResponse({ ok: false, reason: "no_profile" });
//         return;
//       }

//       const activePass =
//         profile.activePassword === "submissionPassword"
//           ? profile.submissionPassword || ""
//           : profile.emailPassword || "";

//       const inputs = Array.from(document.querySelectorAll("input, textarea"));
//       let filledCount = 0;

//       inputs.forEach((el) => {
//         try {
//           const role = matchField(el);
//           if (!role) return;
//           let value = null;
//           if (role === "password") value = activePass;
//           else value = profile[role];

//           if (value) {
//             el.focus && el.focus();
//             setNativeValue(el, value);
//             el.dispatchEvent(new Event("change", { bubbles: true }));
//             filledCount++;
//           }
//         } catch (err) {
//           console.warn("Fill error for element", el, err);
//         }
//       });

//       if (filledCount > 0) {
//         console.log(`✅ Autofilled ${filledCount} fields`);
//         sendResponse({ ok: true, filled: filledCount });
//       } else {
//         console.log("❌ No matching fields found");
//         sendResponse({ ok: false, reason: "no_fields" });
//       }
//     });

//     return true; // async response
//   });
// })();

// // best working version

// // content/auth.js
// (function () {
//   console.log("🔑 content/auth.js loaded (auth autofill handler)");

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
//       element.value = value;
//     }
//     element.dispatchEvent(new Event("input", { bubbles: true }));
//     element.dispatchEvent(new Event("change", { bubbles: true }));
//   }

//   const patterns = {
//     email: [/email/i, /e-mail/i, /\bmail\b/i],
//     businessEmail: [/business/i, /work/i, /company/i, /office/i, /corp/i, /corporate/i],
//     firstname: [/first(?:\s|-)?name/i, /\bfname\b/i],
//     lastname: [/last(?:\s|-)?name/i, /\blname\b/i],
//     fullname: [/full.?name/i, /\bfull\s*name\b/i],
//     password: [/pass(word)?/i, /^pwd$/i],
//     username: [/user(name)?/i, /login/i, /handle/i]
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
//       const text = [
//         el.name,
//         el.id,
//         el.placeholder,
//         el.getAttribute && el.getAttribute("aria-label"),
//         getLabelText(el)
//       ].filter(Boolean).join(" ").toLowerCase();

//       if (patterns.businessEmail.some(rx => rx.test(text))) return "businessEmail";
//       if (patterns.firstname.some(rx => rx.test(text))) return "firstname";
//       if (patterns.lastname.some(rx => rx.test(text))) return "lastname";
//       if (patterns.fullname.some(rx => rx.test(text))) return "fullname";
//       if (patterns.email.some(rx => rx.test(text))) return "email";
//       if (patterns.password.some(rx => rx.test(text))) return "password";
//       if (patterns.username.some(rx => rx.test(text))) return "username";

//       if (el.type === "email") return "email";
//       if (el.type === "password") return "password";
//     } catch (e) {}
//     return null;
//   }

//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (!msg || msg.action !== "autofillAuth") return;
//     console.log("📩 content/auth.js received autofillAuth");

//     chrome.storage.local.get(null, (res) => {
//       const profile = res && res.profile ? res.profile : res || {};
//       if (!profile) {
//         sendResponse({ ok: false, reason: "no_profile" });
//         return;
//       }

//       // Compose names and emails similar to autofill.js
//       const first = profile.firstname || profile.firstName || "";
//       const last = profile.lastname || profile.lastName || "";
//       const fullname = profile.fullname || `${(first||"").trim()} ${(last||"").trim()}`.trim();
//       const bizEmail = profile.businessEmail || profile.workEmail || "";
//       const defaultEmail = profile.submissionEmail || profile.emailId || profile.email || "";
//       const activePass = (profile.activePassword === "submissionPassword") ? (profile.submissionPassword || "") : (profile.emailPassword || "") || profile.password || "";

//       const inputs = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//       let filledCount = 0;

//       inputs.forEach((el) => {
//         try {
//           const role = matchField(el);
//           if (!role) return;
//           let value = null;
//           if (role === "firstname") value = first;
//           else if (role === "lastname") value = last;
//           else if (role === "fullname") value = fullname;
//           else if (role === "businessEmail") value = bizEmail || defaultEmail;
//           else if (role === "email") value = defaultEmail;
//           else if (role === "password") value = activePass;
//           else if (role === "username") value = profile.username || "";

//           if (!value) return;

//           el.focus && el.focus();
//           setNativeValue(el, value);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filledCount++;
//         } catch (err) {
//           console.warn("Fill error for element", el, err);
//         }
//       });

//       if (filledCount > 0) {
//         console.log(`✅ Autofilled ${filledCount} fields`);
//         sendResponse({ ok: true, filled: filledCount });
//       } else {
//         console.log("❌ No matching fields found");
//         sendResponse({ ok: false, reason: "no_fields" });
//       }
//     });

//     return true; // async response
//   });

// })();

// //  best working version

// (function () {
//   console.log("🔑 content/auth.js loaded (auth autofill handler)");

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
//       element.value = value;
//     }
//     element.dispatchEvent(new Event("input", { bubbles: true }));
//     element.dispatchEvent(new Event("change", { bubbles: true }));
//   }

//   // ---------- Patterns ----------
//   const patterns = {
//     email: [/email/i, /e-mail/i, /\bmail\b/i],
//     businessEmail: [/business/i, /work/i, /company/i, /office/i, /corp/i, /corporate/i],
//     firstname: [/first(?:\s|-)?name/i, /\bfname\b/i, /given.?name/i],
//     lastname: [/last(?:\s|-)?name/i, /\blname\b/i, /family.?name/i],
//     fullname: [/full.?name/i, /\bname\b/i], // generic "name"
//     password: [/pass(word)?/i, /^pwd$/i, /passcode/i],
//     username: [/\buser(name)?\b/i, /\blogin\b/i, /\bhandle\b/i, /\buserid\b/i],

//     // Address Fields
//     address: [/address/i, /street/i, /addr/i],
//     city: [/city/i, /town/i],
//     state: [/state/i, /province/i, /region/i],
//     postcode: [/postcode/i, /\bzip\b/i, /\bpin.?code\b/i],
//     country: [/country/i, /nation/i],
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
//       const text = [
//         el.name,
//         el.id,
//         el.placeholder,
//         el.getAttribute && el.getAttribute("aria-label"),
//         getLabelText(el)
//       ].filter(Boolean).join(" ").toLowerCase();

//       // Ignore traps (like "profile link" / "site url")
//       if (/url|link|http|profile\s*link|website/.test(text)) return null;

//       if (patterns.businessEmail.some(rx => rx.test(text))) return "businessEmail";
//       if (patterns.firstname.some(rx => rx.test(text))) return "firstname";
//       if (patterns.lastname.some(rx => rx.test(text))) return "lastname";
//       if (patterns.fullname.some(rx => rx.test(text))) return "fullname";
//       if (patterns.email.some(rx => rx.test(text))) return "email";
//       if (patterns.password.some(rx => rx.test(text))) return "password";
//       if (patterns.username.some(rx => rx.test(text))) return "username";

//       // Address group
//       if (patterns.address.some(rx => rx.test(text))) return "address";
//       if (patterns.city.some(rx => rx.test(text))) return "city";
//       if (patterns.state.some(rx => rx.test(text))) return "state";
//       if (patterns.postcode.some(rx => rx.test(text))) return "postcode";
//       if (patterns.country.some(rx => rx.test(text))) return "country";
//       if (patterns.location.some(rx => rx.test(text))) return "location";

//       if (el.type === "email") return "email";
//       if (el.type === "password") return "password";
//     } catch (e) {}
//     return null;
//   }

//   // ---------- Listener ----------
//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (!msg || msg.action !== "autofillAuth") return;
//     console.log("📩 content/auth.js received autofillAuth");

//     chrome.storage.local.get("profile", (res) => {
//       const profile = res && res.profile ? res.profile : {};
//       if (!profile) {
//         sendResponse({ ok: false, reason: "no_profile" });
//         return;
//       }

//       const first = profile.firstname || "";
//       const last = profile.lastname || "";
//       const fullname = profile.fullname || `${first} ${last}`.trim();
//       const bizEmail = profile.businessEmail || "";
//       const defaultEmail = profile.email || "";
//       const activePass = (profile.activePassword === "submissionPassword")
//         ? (profile.submissionPassword || "")
//         : (profile.emailPassword || "") || "";

//       // New fields
//       const address = profile.address || "";
//       const city = profile.city || "";
//       const state = profile.state || "";
//       const postcode = profile.postcode || "";
//       const country = profile.country || "";
//       const location = profile.location || "";

//       const inputs = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//       let filledCount = 0;

//       inputs.forEach((el) => {
//         try {
//           const role = matchField(el);
//           if (!role) return;
//           let value = null;

//           switch (role) {
//             case "firstname": value = first; break;
//             case "lastname": value = last; break;
//             case "fullname": value = fullname; break;
//             case "businessEmail": value = bizEmail || defaultEmail; break;
//             case "email": value = defaultEmail; break;
//             case "password": value = activePass; break;
//             case "username": value = profile.username || ""; break;
//             case "address": value = address; break;
//             case "city": value = city; break;
//             case "state": value = state; break;
//             case "postcode": value = postcode; break;
//             case "country": value = country; break;
//             case "location": value = location; break;
//           }

//           if (!value) return;
//           el.focus && el.focus();
//           setNativeValue(el, value);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filledCount++;
//         } catch (err) {
//           console.warn("Fill error for element", el, err);
//         }
//       });

//       if (filledCount > 0) {
//         console.log(`✅ Autofilled ${filledCount} fields`);
//         sendResponse({ ok: true, filled: filledCount });
//       } else {
//         console.log("❌ No matching fields found");
//         sendResponse({ ok: false, reason: "no_fields" });
//       }
//     });

//     return true; // async response
//   });
// })();

// // content/auth.js
// (function () {
//   console.log("🔑 content/auth.js loaded (auth autofill listener)");

//   function setNativeValue(element, value) {
//     try {
//       const proto = Object.getPrototypeOf(element);
//       const desc = Object.getOwnPropertyDescriptor(proto, "value");
//       if (desc && desc.set) desc.set.call(element, value);
//       else element.value = value;
//     } catch (e) {
//       element.value = value;
//     }
//     element.dispatchEvent(new Event("input", { bubbles: true }));
//     element.dispatchEvent(new Event("change", { bubbles: true }));
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
//       for (let i = 0; i < 3 && p; i++, p = p.parentElement) {
//         if (p.tagName && p.tagName.toLowerCase() === "label") {
//           return p.innerText || p.textContent || "";
//         }
//       }
//     } catch (e) {}
//     return "";
//   }

//   const patterns = {
//     email: [/email/i, /\bmail\b/i],
//     businessEmail: [/business/i, /work/i, /company/i, /office/i],
//     firstname: [/first(?:\s|-)?name/i, /\bfname\b/i],
//     lastname: [/last(?:\s|-)?name/i, /\blname\b/i],
//     fullname: [/full.?name/i, /\bname\b/i],
//     username: [/user(name)?/i, /login/i, /handle/i],
//     password: [/pass(word)?/i, /^pwd$/i],
//     number: [/phone/i, /mobile/i, /contact/i, /\btel\b/i]
//   };

//   function matchField(el) {
//     try {
//       const text = [
//         el.name,
//         el.id,
//         el.placeholder,
//         el.getAttribute && el.getAttribute("aria-label"),
//         getLabelText(el)
//       ].filter(Boolean).join(" ").toLowerCase();

//       // avoid url/link fields
//       if (/url|link|http|website/.test(text)) return null;

//       for (const [key, arr] of Object.entries(patterns)) {
//         if (arr.some(rx => rx.test(text))) return key;
//       }

//       if (el.type === "email") return "email";
//       if (el.type === "password") return "password";
//       if (el.type === "tel") return "number";
//     } catch (e) {}
//     return null;
//   }

//   function fillFromProfile(profile) {
//     if (!profile) return 0;
//     const p = profile.profile || profile;
//     const first = p.firstname || "";
//     const last = p.lastname || "";
//     const fullname = p.fullname || `${first} ${last}`.trim();
//     const defaultEmail = p.email || p.submissionEmail || "";
//     const biz = p.businessEmail || "";

//     const inputs = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//     let filled = 0;

//     inputs.forEach(el => {
//       try {
//         if (!el || (el.value && el.value.trim())) return;
//         const role = matchField(el);
//         if (!role) return;

//         let value = "";
//         switch (role) {
//           case "firstname": value = first; break;
//           case "lastname": value = last; break;
//           case "fullname": value = fullname; break;
//           case "businessEmail": value = biz || defaultEmail; break;
//           case "email": value = defaultEmail; break;
//           case "username": value = p.username || ""; break;
//           case "password":
//             value = p.activePassword === "submissionPassword" ? (p.submissionPassword || "") : (p.emailPassword || "");
//             break;
//           case "number": value = p.number || "";
//         }

//         if (!value) return;
//         el.focus && el.focus();
//         setNativeValue(el, value);
//         if (el.dataset) el.dataset.hyperfill = "1";
//         filled++;
//       } catch (e) { console.warn("auth fill err", e); }
//     });

//     if (filled > 0) console.log("✅ auth.js filled", filled);
//     return filled;
//   }

//   // Respond to messages from background (triggerAuthFill)
//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (!msg) return;
//     if (msg.action === "autofillAuth") {
//       // msg.profile may contain the profile sent from background
//       const prof = msg.profile || null;
//       if (prof) {
//         const n = fillFromProfile(prof);
//         sendResponse({ ok: n > 0, filled: n });
//       } else {
//         // fallback: read storage
//         chrome.storage.local.get("profile", (res) => {
//           const p = (res && res.profile) || null;
//           const n = fillFromProfile(p);
//           sendResponse({ ok: n > 0, filled: n });
//         });
//         return true; // async
//       }
//     }
//   });
// })();

// // content/auth.js (improved)
// (function () {
//   if (window.__RowFiller_auth_installed) { console.log("auth script already installed"); return; }
//   window.__RowFiller_auth_installed = true;
//   console.log("🔑 content/auth.js loaded (improved)");

//   function setNativeValue(element, value) {
//     try {
//       const proto = Object.getPrototypeOf(element);
//       const desc = Object.getOwnPropertyDescriptor(proto, "value");
//       if (desc && desc.set) desc.set.call(element, value);
//       else element.value = value;
//     } catch (e) {
//       try { element.value = value; } catch (e2) {}
//     }
//     element.dispatchEvent(new Event("input", { bubbles: true }));
//     element.dispatchEvent(new Event("change", { bubbles: true }));
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
//       for (let i = 0; i < 3 && p; i++, p = p.parentElement) {
//         if (p.tagName && p.tagName.toLowerCase() === "label") {
//           return p.innerText || p.textContent || "";
//         }
//       }
//       const labId = el.getAttribute && el.getAttribute("aria-labelledby");
//       if (labId) {
//         const ref = document.getElementById(labId);
//         if (ref) return ref.innerText || ref.textContent || "";
//       }
//     } catch (e) {}
//     return "";
//   }

//   // small patterns
//   const patterns = {
//     email: [/email/i, /\bmail\b/i, /e-?mail/i],
//     businessEmail: [/business.*email/i, /work.*email/i, /\bcompany.*email\b/i],
//     firstname: [/first(?:\s|-)?name/i, /\bgiven-name\b/i, /\bfname\b/i],
//     lastname: [/last(?:\s|-)?name/i, /\bfamily-name\b/i, /\blname\b/i],
//     fullname: [/\bfull(?:\s|-)?name\b/i, /^\bname\b$/i],
//     username: [/user(name)?/i, /login/i, /handle/i, /userid/i],
//     password: [/pass(word)?/i, /^pwd$/i],
//     phone: [/phone/i, /mobile/i, /contact/i, /\btel\b/i],
//     address: [/address|street|addr/i],
//     city: [/city|town/i],
//     state: [/state|province|region/i],
//     postcode: [/zip|postal|postcode|pin/i],
//     country: [/country/i],
//     location: [/location|place|area/i]
//   };

//   function mapAutocompleteToRole(ac) {
//     if (!ac) return null;
//     const a = ac.toLowerCase().trim();
//     if (a === "given-name") return "firstname";
//     if (a === "family-name") return "lastname";
//     if (a === "name") return "fullname";
//     if (a === "email") return "email";
//     if (a === "tel") return "phone";
//     if (a === "street-address" || a === "address-line1") return "address";
//     if (a === "postal-code") return "postcode";
//     if (a === "address-level1") return "state";
//     if (a === "address-level2") return "city";
//     if (a === "country") return "country";
//     return null;
//   }

//   function isPotentialCompanyField(attrs) {
//     return /\b(company|organization|organisation|org|business|business ?name|company ?name)\b/i.test(attrs);
//   }

//   function matchField(el) {
//     try {
//       if (!el) return null;
//       if (el.disabled) return null;
//       if (el.type && (el.type.toLowerCase() === "hidden" || el.type.toLowerCase() === "submit")) return null;

//       const text = [
//         el.name,
//         el.id,
//         el.placeholder,
//         el.getAttribute && el.getAttribute("aria-label"),
//         getLabelText(el)
//       ].filter(Boolean).join(" ").toLowerCase();

//       // check autocomplete first
//       try {
//         const ac = el.autocomplete;
//         const roleFromAuto = mapAutocompleteToRole(ac);
//         if (roleFromAuto) return roleFromAuto;
//       } catch (e) {}

//       for (const [key, arr] of Object.entries(patterns)) {
//         for (const rx of arr) {
//           if (rx.test(text)) {
//             if (isPotentialCompanyField(text) && (key === "email" || key === "username")) return null;
//             return key;
//           }
//         }
//       }

//       if (el.type === "email") return "email";
//       if (el.type === "password") return "password";
//       if (el.type === "tel") return "phone";
//     } catch (e) {}
//     return null;
//   }

//   function fillFromProfile(profile) {
//     if (!profile) return 0;
//     const p = profile.profile || profile;
//     const first = p.firstname || p.firstName || "";
//     const last = p.lastname || p.lastName || "";
//     const fullname = p.fullname || `${first} ${last}`.trim() || p.name || "";
//     const defaultEmail = p.email || p.submissionEmail || "";
//     const biz = p.businessEmail || "";
//     const phone = p.phone || p.number || "";

//     const inputs = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//     let filled = 0;

//     inputs.forEach(el => {
//       try {
//         if (!el) return;
//         // skip if already has meaningful value
//         if (el.value && el.value.toString().trim()) return;
//         const role = matchField(el);
//         if (!role) return;

//         let value = "";
//         switch (role) {
//           case "firstname": value = first; break;
//           case "lastname": value = last; break;
//           case "fullname": value = fullname; break;
//           case "businessEmail": value = biz || defaultEmail; break;
//           case "email": value = defaultEmail; break;
//           case "username": value = p.username || ""; break;
//           case "password":
//             value = p.activePassword === "submissionPassword" ? (p.submissionPassword || "") : (p.emailPassword || "");
//             break;
//           case "phone": value = phone; break;
//           case "address": value = p.address || ""; break;
//           case "city": value = p.city || ""; break;
//           case "state": value = p.state || ""; break;
//           case "postcode": value = p.postcode || ""; break;
//           case "country": value = p.country || ""; break;
//           case "location": value = p.location || ""; break;
//         }

//         if (!value) return;

//         // safety: don't fill email into company fields
//         const attrs = [el.name, el.id, el.placeholder, el.getAttribute && el.getAttribute("aria-label"), getLabelText(el)]
//                       .filter(Boolean).join(" ").toLowerCase();
//         if (isPotentialCompanyField(attrs) && (role === "email" || role === "username")) return;

//         el.focus && el.focus();
//         setNativeValue(el, value);
//         if (el.dataset) el.dataset.hyperfill = "1";
//         filled++;
//       } catch (e) {
//         console.warn("auth fill err", e);
//       }
//     });

//     if (filled > 0) console.log("✅ auth.js filled", filled);
//     else console.log("auth.js: nothing filled");

//     return filled;
//   }

//   // message listener
//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (!msg) return;
//     if (msg.action === "autofillAuth") {
//       const prof = msg.profile || null;
//       if (prof) {
//         const n = fillFromProfile(prof);
//         sendResponse({ ok: n > 0, filled: n });
//       } else {
//         chrome.storage.local.get("profile", (res) => {
//           const p = (res && res.profile) || null;
//           const n = fillFromProfile(p);
//           sendResponse({ ok: n > 0, filled: n });
//         });
//         return true; // async
//       }
//     }
//   });

//   // autop-run if profile present
//   chrome.storage.local.get("profile", (res) => {
//     if (res && res.profile) {
//       setTimeout(() => fillFromProfile(res.profile), 900);
//       setTimeout(() => fillFromProfile(res.profile), 1800);
//     }
//   });
// })();

// // content/auth.js (strict auth filler)
// (function () {
//   if (window.__RowFiller_auth_installed) { console.log("auth script already installed"); return; }
//   window.__RowFiller_auth_installed = true;
//   console.log("🔑 content/auth.js loaded (strict)");

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

//   function getLabelText(el) {
//     try {
//       if (!el) return "";
//       const id = el.id;
//       if (id) {
//         const lab = document.querySelector(`label[for="${id}"]`);
//         if (lab) return lab.innerText || lab.textContent || "";
//       }
//       let p = el.parentElement;
//       for (let i = 0; i < 3 && p; i++, p = p.parentElement) {
//         if (p.tagName && p.tagName.toLowerCase() === "label") {
//           return p.innerText || p.textContent || "";
//         }
//       }
//       const labId = el.getAttribute && el.getAttribute("aria-labelledby");
//       if (labId) {
//         const ref = document.getElementById(labId);
//         if (ref) return ref.innerText || ref.textContent || "";
//       }
//     } catch (e) {}
//     return "";
//   }

//   const PAT = {
//     email: [/email/i, /\bmail\b/i],
//     businessEmail: [/\bbusiness\b.*email|work.*email|company.*email/i],
//     username: [/\buser(name)?\b|\blogin\b|\bhandle\b/i],
//     password: [/pass(word)?|pwd/i]
//   };

//   function mapAutocomplete(ac) {
//     if (!ac) return null;
//     ac = ac.toLowerCase().trim();
//     if (ac.includes("email")) return "email";
//     if (ac.includes("given")) return "firstname";
//     if (ac.includes("family") || ac.includes("last")) return "lastname";
//     if (ac.includes("name")) return "fullname";
//     if (ac.includes("tel")) return "phone";
//     return null;
//   }

//   function isCompanyField(attrs) {
//     return /\b(company|organization|organisation|org|business|business ?name|company ?name)\b/i.test(attrs);
//   }

//   function matchField(el) {
//     try {
//       if (!el) return null;
//       if (el.disabled) return null;
//       const type = (el.type || "").toLowerCase();
//       if (["hidden","submit","button"].includes(type)) return null;
//       const ac = (el.getAttribute && el.getAttribute("autocomplete")) || "";
//       const aRole = mapAutocomplete(ac);
//       if (aRole) return aRole;

//       const text = [el.name, el.id, el.placeholder, el.getAttribute && el.getAttribute("aria-label"), getLabelText(el)].filter(Boolean).join(" ").toLowerCase();

//       // password must be type=password
//       if (type === "password") return "password";
//       if (type === "email") return "email";
//       // strict regex checks:
//       for (const [k, arr] of Object.entries(PAT)) {
//         for (const rx of arr) {
//           if (rx.test(text)) {
//             if (k === "username") {
//               if (type === "email" || type === "tel") return null;
//               return "username";
//             }
//             if (k === "businessEmail") return "businessEmail";
//             if (k === "email") return "email";
//             if (k === "password" && type === "password") return "password";
//           }
//         }
//       }
//       return null;
//     } catch (e) { return null; }
//   }

//   function alreadyFilled(el) {
//     try {
//       if (!el) return false;
//       if (el.dataset && el.dataset.hyperfill === "1") return true;
//       if (el.getAttribute && el.getAttribute("contenteditable") === "true") return !!(el.innerText && el.innerText.trim());
//       return !!(el.value !== undefined && el.value !== null && el.value.toString().trim() !== "");
//     } catch (e) { return false; }
//   }

//   function fillFromProfile(profile) {
//     if (!profile) return 0;
//     const p = profile.profile || profile;
//     const first = p.firstname || "";
//     const last = p.lastname || "";
//     const fullname = p.fullname || `${first} ${last}`.trim() || "";
//     const defaultEmail = p.email || p.submissionEmail || "";
//     const biz = p.businessEmail || "";
//     const phone = p.phone || "";
//     const password = (p.activePassword === "submissionPassword" ? (p.submissionPassword || "") : (p.emailPassword || ""));

//     const inputs = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//     let filled = 0;

//     inputs.forEach(el => {
//       try {
//         if (!el) return;
//         if (alreadyFilled(el)) return;
//         const role = matchField(el);
//         if (!role) return;

//         // Only allow password -> type=password
//         if (role === "password") {
//           if (el.type !== "password") return;
//           if (!password) return;
//           setNativeValue(el, password);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++;
//           return;
//         }

//         // Email logic
//         if (role === "businessEmail" || role === "email") {
//           const attrs = [el.name, el.id, el.placeholder, el.getAttribute && el.getAttribute("aria-label"), getLabelText(el)].filter(Boolean).join(" ").toLowerCase();
//           if (isCompanyField(attrs) || role === "businessEmail") {
//             if (!biz) return;
//             setNativeValue(el, biz);
//             if (el.dataset) el.dataset.hyperfill = "1";
//             filled++;
//             return;
//           }
//           if (!defaultEmail) return;
//           if (el.type && el.type.toLowerCase() !== "email" && el.tagName && el.tagName.toLowerCase() === "input") {
//             // be cautious - only fill text input if label explicitly says email
//             if (!/email/.test(attrs)) return;
//           }
//           setNativeValue(el, defaultEmail);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++;
//           return;
//         }

//         // Username - strict
//         if (role === "username") {
//           if (!p.username) return;
//           if (el.type && ["email","tel","url"].includes(el.type.toLowerCase())) return;
//           setNativeValue(el, p.username);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++;
//           return;
//         }

//         // Name fields
//         if (role === "firstname") {
//           if (!first) return;
//           setNativeValue(el, first);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++;
//           return;
//         }
//         if (role === "lastname") {
//           if (!last) return;
//           setNativeValue(el, last);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++;
//           return;
//         }
//         if (role === "fullname") {
//           if (!fullname) return;
//           setNativeValue(el, fullname);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++;
//           return;
//         }

//       } catch (e) {
//         console.warn("auth fill error", e);
//       }
//     });

//     if (filled > 0) console.log("✅ auth.js filled", filled);
//     else console.log("auth.js: nothing filled (strict)");

//     return filled;
//   }

//   // message listener
//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (!msg) return;
//     if (msg.action === "autofillAuth") {
//       chrome.storage.local.get("autofillEnabled", (r) => {
//         const enabled = (r && r.autofillEnabled !== undefined) ? r.autofillEnabled : true;
//         if (!enabled) { sendResponse({ ok: false, filled: 0, error: "disabled" }); return; }
//         const prof = msg.profile || null;
//         if (prof) {
//           const n = fillFromProfile(prof);
//           sendResponse({ ok: n > 0, filled: n });
//         } else {
//           chrome.storage.local.get("profile", (res) => {
//             const p = res && res.profile ? res.profile : null;
//             const n = p ? fillFromProfile(p) : 0;
//             sendResponse({ ok: n > 0, filled: n });
//           });
//           return true;
//         }
//       });
//       return true;
//     }
//     if (msg.action === "toggleAutofill") {
//       console.log("Received toggleAutofill:", msg.enabled);
//       sendResponse({ ok: true });
//       return;
//     }
//   });

//   // auto-run if enabled + profile present
//   setTimeout(() => {
//     chrome.storage.local.get(["autofillEnabled","profile"], (r) => {
//       const enabled = (r && r.autofillEnabled !== undefined) ? r.autofillEnabled : true;
//       const profile = (r && r.profile) || null;
//       if (enabled && profile) fillFromProfile(profile);
//     });
//   }, 800);

//   chrome.storage.onChanged.addListener((changes) => {
//     if (changes.autofillEnabled && !changes.autofillEnabled.newValue) {
//       console.log("Autofill disabled by user.");
//     }
//     if ((changes.autofillEnabled && changes.autofillEnabled.newValue) || changes.profile) {
//       setTimeout(() => {
//         chrome.storage.local.get(["autofillEnabled","profile"], (r) => {
//           const enabled = (r && r.autofillEnabled !== undefined) ? r.autofillEnabled : true;
//           const profile = (r && r.profile) || null;
//           if (enabled && profile) fillFromProfile(profile);
//         });
//       }, 400);
//     }
//   });

// })();

// // content/auth.js
// // Focused strict auth autofill + force support
// (function () {
//   if (window.__RowFiller_auth_installed) { console.log("auth script already installed"); return; }
//   window.__RowFiller_auth_installed = true;
//   console.log("🔑 content/auth.js loaded (strict)");

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

//   function getLabelText(el) {
//     try {
//       if (!el) return "";
//       const id = el.id;
//       if (id) {
//         const lab = document.querySelector(`label[for="${id}"]`);
//         if (lab) return lab.innerText || lab.textContent || "";
//       }
//       let p = el.parentElement;
//       for (let i = 0; i < 3 && p; i++, p = p.parentElement) {
//         if (p.tagName && p.tagName.toLowerCase() === "label") {
//           return p.innerText || p.textContent || "";
//         }
//       }
//       const labId = el.getAttribute && el.getAttribute("aria-labelledby");
//       if (labId) {
//         const ref = document.getElementById(labId);
//         if (ref) return ref.innerText || ref.textContent || "";
//       }
//     } catch (e) {}
//     return "";
//   }

//   const PAT = {
//     email: [/\bemail\b/i, /\bmail\b/i, /\be-?mail\b/i],
//     businessEmail: [/\bbusiness\b.*email\b/i, /\bwork\b.*email\b/i, /\bcompany\b.*email\b/i],
//     username: [/\buser(?:[_\s-]?name)?\b/i, /\buserid\b/i, /\blogin\b/i, /\bhandle\b/i],
//     password: [/pass(?:word)?\b/i, /\bpwd\b/i]
//   };

//   function isCompanyField(attrs) {
//     return /\b(company|organization|organisation|org|business|work)\b/i.test(attrs);
//   }

//   function matchFieldStrict(el) {
//     try {
//       if (!el) return null;
//       if (el.disabled) return null;
//       const type = (el.type || "").toLowerCase();
//       if (["hidden","submit","button","reset","image"].includes(type)) return null;

//       // autocomplete hints
//       try {
//         const ac = (el.getAttribute && el.getAttribute("autocomplete")) || "";
//         if (ac) {
//           const acL = ac.toLowerCase();
//           if (acL.includes("email")) return "email";
//           if (acL.includes("given") || acL.includes("given-name")) return "firstname";
//           if (acL.includes("family") || acL.includes("family-name")) return "lastname";
//           if (acL === "name") return "fullname";
//           if (acL.includes("tel")) return "phone";
//           if (acL.includes("current-password") || acL.includes("new-password")) return "password";
//         }
//       } catch (e) {}

//       const text = [el.name, el.id, el.placeholder, el.getAttribute && el.getAttribute("aria-label"), getLabelText(el)]
//         .filter(Boolean).join(" ").toLowerCase();

//       if (type === "email") return "email";
//       if (type === "password") {
//         if (/\bconfirm\b|\bverify\b|\bretype\b/i.test(text)) return null;
//         return "password";
//       }

//       for (const [k, arr] of Object.entries(PAT)) {
//         for (const rx of arr) {
//           if (rx.test(text)) {
//             if (k === "username") {
//               if (type === "email" || type === "tel") return null;
//               return "username";
//             }
//             if (k === "businessEmail") return "businessEmail";
//             if (k === "email") return "email";
//             if (k === "password") {
//               if (type === "password") return "password";
//               return null;
//             }
//           }
//         }
//       }

//       return null;
//     } catch (e) { return null; }
//   }

//   function matchFieldForce(el) {
//     const s = matchFieldStrict(el);
//     if (s) return s;
//     try {
//       if (!el || el.disabled) return null;
//       const type = (el.type || "").toLowerCase();
//       const text = [el.name, el.id, el.placeholder, getLabelText(el)].filter(Boolean).join(" ").toLowerCase();
//       if (type === "email") return "email";
//       if (type === "password") return "password";
//       if (/\buser\b|\blogin\b|\bhandle\b/.test(text)) return "username";
//       if (/\bfirst\b|\bfname\b|\bgiven\b/.test(text)) return "firstname";
//       if (/\blast\b|\bsurname\b|\bfamily\b/.test(text)) return "lastname";
//       if (/\bmail\b|\bemail\b/.test(text)) return "email";
//     } catch (e) {}
//     return null;
//   }

//   function alreadyFilled(el) {
//     try {
//       if (!el) return false;
//       if (el.dataset && el.dataset.hyperfill === "1") return true;
//       if (el.getAttribute && el.getAttribute("contenteditable") === "true") return !!(el.innerText && el.innerText.trim());
//       return !!(el.value !== undefined && el.value !== null && el.value.toString().trim() !== "");
//     } catch (e) { return false; }
//   }

//   function fillAuthStrict(profile) {
//     if (!profile) return 0;
//     const p = profile.profile || profile;
//     const first = p.firstname || "";
//     const last = p.lastname || "";
//     const fullname = p.fullname || `${first} ${last}`.trim();
//     const defaultEmail = p.email || p.submissionEmail || "";
//     const biz = p.businessEmail || "";
//     const password = (p.activePassword === "submissionPassword" ? (p.submissionPassword || "") : (p.emailPassword || ""));

//     const inputs = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//     let filled = 0;

//     inputs.forEach(el => {
//       try {
//         if (!el || alreadyFilled(el)) return;
//         const role = matchFieldStrict(el);
//         if (!role) return;

//         // Password: only into real password fields (guard confirm)
//         if (role === "password") {
//           if ((el.type || "").toLowerCase() !== "password") return;
//           if (!password) return;
//           setNativeValue(el, password);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++;
//           return;
//         }

//         // Email logic
//         if (role === "businessEmail" || role === "email") {
//           const attrs = [el.name, el.id, el.placeholder, el.getAttribute && el.getAttribute("aria-label"), getLabelText(el)].filter(Boolean).join(" ").toLowerCase();
//           if (isCompanyField(attrs) || role === "businessEmail") {
//             if (!biz) return;
//             if ((el.tagName || "").toLowerCase() === "textarea") return;
//             setNativeValue(el, biz);
//             if (el.dataset) el.dataset.hyperfill = "1";
//             filled++;
//             return;
//           }
//           if (!defaultEmail) return;
//           if ((el.tagName || "").toLowerCase() === "input" && (el.type || "").toLowerCase() !== "email" && !/email/.test(attrs)) {
//             // don't fill into non-email input unless explicit email token present
//             return;
//           }
//           setNativeValue(el, defaultEmail);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++;
//           return;
//         }

//         // Username strict
//         if (role === "username") {
//           if (!p.username) return;
//           if ((el.type || "").toLowerCase() === "email") return;
//           setNativeValue(el, p.username);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++;
//           return;
//         }

//         // Name fields
//         if (role === "firstname") {
//           if (!first) return;
//           setNativeValue(el, first);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++;
//           return;
//         }
//         if (role === "lastname") {
//           if (!last) return;
//           setNativeValue(el, last);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++;
//           return;
//         }
//         if (role === "fullname") {
//           if (!fullname) return;
//           setNativeValue(el, fullname);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++;
//           return;
//         }
//       } catch (e) { console.warn("fillAuthStrict error", e); }
//     });

//     if (filled > 0) console.log("✅ auth.strict filled", filled);
//     else console.log("auth.strict: nothing filled");
//     return filled;
//   }

//   function fillAuthForce(profile) {
//     if (!profile) return 0;
//     const p = profile.profile || profile;
//     const vals = {
//       firstname: p.firstname || "",
//       lastname: p.lastname || "",
//       fullname: p.fullname || `${p.firstname||""} ${p.lastname||""}`.trim(),
//       email: p.email || "",
//       businessEmail: p.businessEmail || "",
//       username: p.username || "",
//       password: (p.activePassword === "submissionPassword" ? (p.submissionPassword||"") : (p.emailPassword||""))
//     };

//     const inputs = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//     let filled = 0;

//     inputs.forEach(el => {
//       try {
//         if (!el) return;
//         if (alreadyFilled(el)) ;
//         let role = matchFieldStrict(el) || matchFieldForce(el);
//         if (!role) {
//           const attrs = [el.name, el.id, el.placeholder, getLabelText(el)].filter(Boolean).join(" ").toLowerCase();
//           if (/\buser\b|\blogin\b/.test(attrs)) role = "username";
//           else if (/\bfirst\b/.test(attrs)) role = "firstname";
//           else if (/\blast\b|surname\b/.test(attrs)) role = "lastname";
//           else if (/\bmail\b/.test(attrs)) role = "email";
//           else if (/\bpass\b/.test(attrs)) role = "password";
//           else if (/\bname\b/.test(attrs)) role = "fullname";
//         }
//         if (!role) return;
//         const value = vals[role];
//         if (!value) return;
//         if (role === "password" && (el.type || "").toLowerCase() !== "password") return;
//         if (role === "email" && (el.tagName || "").toLowerCase() === "textarea") return;
//         setNativeValue(el, value);
//         if (el.dataset) el.dataset.hyperfill = "1";
//         filled++;
//       } catch (e) { console.warn("fillAuthForce error", e); }
//     });

//     if (filled > 0) console.log("⚡ auth.force filled", filled);
//     return filled;
//   }

//   // Listener
//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (!msg) return;
//     if (msg.action === "autofillAuth" || msg.action === "autofillProfile") {
//       chrome.storage.local.get("autofillEnabled", (r) => {
//         const enabled = (r && r.autofillEnabled !== undefined) ? r.autofillEnabled : true;
//         if (!enabled) {
//           sendResponse({ ok: false, filled: 0, error: "disabled" });
//           return;
//         }
//         const profile = msg.profile || null;
//         if (profile) {
//           try {
//             const count = msg.force ? fillAuthForce(profile) : fillAuthStrict(profile);
//             sendResponse({ ok: count > 0, filled: count });
//           } catch (e) {
//             sendResponse({ ok: false, filled: 0, error: e && e.message });
//           }
//         } else {
//           chrome.storage.local.get("profile", (res) => {
//             const p = (res && res.profile) || null;
//             if (!p) {
//               sendResponse({ ok: false, filled: 0, error: "no_profile" });
//               return;
//             }
//             try {
//               const count = msg.force ? fillAuthForce(p) : fillAuthStrict(p);
//               sendResponse({ ok: count > 0, filled: count });
//             } catch (e) {
//               sendResponse({ ok: false, filled: 0, error: e && e.message });
//             }
//           });
//           return true;
//         }
//       });
//       return true;
//     }

//     if (msg.action === "toggleAutofill") {
//       console.log("auth content script received toggle:", msg.enabled);
//       sendResponse({ ok: true });
//     }
//   });

//   // Auto-run strict if profile exists and enabled
//   setTimeout(() => {
//     chrome.storage.local.get(["autofillEnabled", "profile"], (r) => {
//       const enabled = (r && r.autofillEnabled !== undefined) ? r.autofillEnabled : true;
//       const profile = (r && r.profile) || null;
//       if (enabled && profile) fillAuthStrict(profile);
//     });
//   }, 800);

//   chrome.storage.onChanged.addListener((changes) => {
//     if ((changes.autofillEnabled && changes.autofillEnabled.newValue) || changes.profile) {
//       setTimeout(() => {
//         chrome.storage.local.get(["autofillEnabled","profile"], (r) => {
//           const enabled = (r && r.autofillEnabled !== undefined) ? r.autofillEnabled : true;
//           const profile = (r && r.profile) || null;
//           if (enabled && profile) fillAuthStrict(profile);
//         });
//       }, 300);
//     }
//   });

// })();

// // content/auth.js (updated) - strict auth autofill with guarded username
// (function () {
//   if (window.__RowFiller_auth_v2_installed) { console.log("auth script already installed"); return; }
//   window.__RowFiller_auth_v2_installed = true;
//   console.log("🔑 content/auth.js v2 loaded (strict)");

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

//   function getLabelText(el) {
//     try {
//       if (!el) return "";
//       if (el.id) {
//         const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
//         if (lab) return lab.innerText || lab.textContent || "";
//       }
//       let p = el.parentElement;
//       for (let i=0; p && i<4; i++, p = p.parentElement) {
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

//   // lightweight patterns
//   const PAT = {
//     email: [/\bemail\b/i, /\be-?mail\b/i, /\bmail\b/i],
//     businessEmail: [/\b(business|work|company|office)[\s_-]*email\b/i],
//     username: [/^username$|^user[_\s-]?name$|\buserid\b|\blogin\b/i],
//     password: [/pass(?:word)?\b|^pwd\b/i]
//   };

//   function textFor(el) {
//     return [el.name, el.id, el.placeholder, el.getAttribute && el.getAttribute("aria-label"), getLabelText(el)].filter(Boolean).join(" ").toLowerCase();
//   }

//   function isCompanyField(attrs) {
//     return /\b(company|organization|organisation|org|business|work)\b/i.test(attrs);
//   }

//   function explicitUsernameInLabelOrName(el) {
//     const label = getLabelText(el).toLowerCase();
//     const name = (el.name || "").toLowerCase();
//     const id = (el.id || "").toLowerCase();
//     const tokens = [label, name, id].join(" ");
//     return /\busername\b|\buser[_\s-]?name\b|\blogin\b|\buser_id\b|\buserid\b/.test(tokens);
//   }

//   function matchFieldStrict(el) {
//     try {
//       if (!el || el.disabled) return null;
//       const type = (el.type || "").toLowerCase();
//       if (["hidden","submit","button","reset","image","file","checkbox","radio"].includes(type)) return null;

//       // autocomplete hints (high signal)
//       try {
//         const ac = (el.getAttribute && el.getAttribute("autocomplete")) || "";
//         if (ac) {
//           const a = ac.toLowerCase();
//           if (a.includes("email")) return "email";
//           if (a.includes("username")) return "username";
//           if (a.includes("password")) return "password";
//           if (a.includes("given") || a.includes("given-name")) return "firstname";
//           if (a.includes("family") || a.includes("family-name")) return "lastname";
//         }
//       } catch (e) {}

//       const t = textFor(el);

//       if (type === "email") return isCompanyField(t) ? "businessEmail" : "email";
//       if (type === "password") {
//         if (/\bconfirm\b|\bretype\b|\bverify\b/.test(t)) return null;
//         return "password";
//       }

//       // pattern checks
//       for (const [k, arr] of Object.entries(PAT)) {
//         for (const rx of arr) {
//           if (rx.test(t)) {
//             if (k === "username") {
//               // require explicit token in label/name/id (not placeholder-only)
//               if (!explicitUsernameInLabelOrName(el)) return null;
//               // block email-type inputs
//               if (type === "email" || type === "tel") return null;
//               // block fields that explicitly look like pronouns/org/etc
//               if (/\bpronoun|pronouns|location|company|organisation|organization|job|title|website\b/.test(t)) return null;
//               return "username";
//             }
//             if (k === "businessEmail") return "businessEmail";
//             if (k === "email") return "email";
//             if (k === "password") return type === "password" ? "password" : null;
//           }
//         }
//       }

//       return null;
//     } catch (e) { return null; }
//   }

//   function matchFieldForce(el) {
//     // keep same as strict for username — do not allow placeholder-only fill for username
//     return matchFieldStrict(el);
//   }

//   function alreadyFilled(el) {
//     try {
//       if (!el) return false;
//       if (el.dataset && el.dataset.hyperfill === "1") return true;
//       if (el.getAttribute && el.getAttribute("contenteditable") === "true") return !!(el.innerText && el.innerText.trim());
//       return !!(el.value !== undefined && el.value !== null && el.value.toString().trim() !== "");
//     } catch (e) { return false; }
//   }

//   function fillAuthStrict(profile) {
//     if (!profile) return 0;
//     const p = profile.profile || profile;
//     const first = p.firstname || "";
//     const last = p.lastname || "";
//     const fullname = p.fullname || `${first} ${last}`.trim();
//     const defaultEmail = p.email || p.submissionEmail || "";
//     const biz = p.businessEmail || "";
//     const password = (p.activePassword === "submissionPassword" ? (p.submissionPassword || "") : (p.emailPassword || ""));

//     const nodes = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//     let filled = 0;

//     nodes.forEach(el => {
//       try {
//         if (!el || alreadyFilled(el)) return;
//         const role = matchFieldStrict(el);
//         if (!role) return;

//         if (role === "password") {
//           if ((el.type || "").toLowerCase() !== "password") return;
//           if (!password) return;
//           setNativeValue(el, password);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++;
//           return;
//         }

//         if (role === "businessEmail" || role === "email") {
//           const attrs = textFor(el);
//           if (role === "businessEmail" || isCompanyField(attrs)) {
//             if (!biz) return;
//             if ((el.tagName || "").toLowerCase() === "textarea") return;
//             setNativeValue(el, biz);
//             if (el.dataset) el.dataset.hyperfill = "1";
//             filled++; return;
//           }
//           if (!defaultEmail) return;
//           if ((el.tagName || "").toLowerCase() === "input" && (el.type || "").toLowerCase() !== "email" && !/email/.test(attrs)) return;
//           setNativeValue(el, defaultEmail);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++; return;
//         }

//         if (role === "username") {
//           if (!p.username) return;
//           if ((el.type || "").toLowerCase() === "email") return;
//           setNativeValue(el, p.username);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++; return;
//         }

//         if (role === "firstname") {
//           if (!first) return;
//           setNativeValue(el, first);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++; return;
//         }
//         if (role === "lastname") {
//           if (!last) return;
//           setNativeValue(el, last);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++; return;
//         }
//         if (role === "fullname") {
//           if (!fullname) return;
//           setNativeValue(el, fullname);
//           if (el.dataset) el.dataset.hyperfill = "1";
//           filled++; return;
//         }
//       } catch (e) {
//         console.warn("fillAuthStrict error", e);
//       }
//     });

//     if (filled) console.log("✅ auth.strict filled", filled);
//     return filled;
//   }

//   function fillAuthForce(profile) {
//     // Force behaves same as strict for username rules — avoid wildcard username
//     if (!profile) return 0;
//     const p = profile.profile || profile;
//     const vals = {
//       firstname: p.firstname || "",
//       lastname: p.lastname || "",
//       fullname: p.fullname || `${p.firstname||""} ${p.lastname||""}`.trim(),
//       email: p.email || "",
//       businessEmail: p.businessEmail || "",
//       username: p.username || "",
//       password: (p.activePassword === "submissionPassword" ? (p.submissionPassword||"") : (p.emailPassword||""))
//     };

//     const nodes = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']"));
//     let filled = 0;

//     nodes.forEach(el => {
//       try {
//         if (!el) return;
//         if (alreadyFilled(el)) continue;
//         let role = matchFieldStrict(el) || matchFieldForce(el);
//         if (!role) {
//           // conservative fallback heuristics
//           const attrs = textFor(el);
//           if (/\buser\b|\blogin\b/.test(attrs)) role = "username";
//           else if (/\bfirst\b|\bfname\b|\bgiven\b/.test(attrs)) role = "firstname";
//           else if (/\blast\b|surname\b/.test(attrs)) role = "lastname";
//           else if (/\bmail\b|email\b/.test(attrs)) role = "email";
//           else if (/\bpass\b|pwd\b/.test(attrs)) role = "password";
//           else if (/\bname\b/.test(attrs)) role = "fullname";
//         }
//         if (!role) return;
//         const value = vals[role];
//         if (!value) return;
//         if (role === "password" && (el.type || "").toLowerCase() !== "password") return;
//         if (role === "email" && (el.tagName || "").toLowerCase() === "textarea") return;
//         // still validate username format before filling
//         if (role === "username" && !/^[A-Za-z0-9._\-]{2,}$/.test(value)) return;

//         setNativeValue(el, value);
//         if (el.dataset) el.dataset.hyperfill = "1";
//         filled++;
//       } catch (e) { console.warn("fillAuthForce error", e); }
//     });

//     if (filled) console.log("⚡ auth.force filled", filled);
//     return filled;
//   }

//   // message listener
//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (!msg) { sendResponse({ ok:false, error:'no_msg' }); return true; }
//     if (msg.action === "autofillAuth" || msg.action === "autofillProfile") {
//       chrome.storage.local.get("autofillEnabled", (r) => {
//         const enabled = (r && r.autofillEnabled !== undefined) ? r.autofillEnabled : true;
//         if (!enabled) { sendResponse({ ok:false, filled:0, error:'disabled' }); return; }
//         const profile = msg.profile || null;
//         if (profile) {
//           try {
//             const count = msg.force ? fillAuthForce(profile) : fillAuthStrict(profile);
//             sendResponse({ ok: count>0, filled: count });
//           } catch (e) { sendResponse({ ok:false, filled:0, error: e && e.message }); }
//         } else {
//           chrome.storage.local.get("profile", (res) => {
//             const p = (res && res.profile) || null;
//             if (!p) { sendResponse({ ok:false, filled:0, error:'no_profile' }); return; }
//             try {
//               const count = msg.force ? fillAuthForce(p) : fillAuthStrict(p);
//               sendResponse({ ok: count>0, filled: count });
//             } catch (e) { sendResponse({ ok:false, filled:0, error: e && e.message }); }
//           });
//           return true;
//         }
//       });
//       return true;
//     }

//     if (msg.action === "toggleAutofill") {
//       sendResponse({ ok:true });
//       return;
//     }

//     sendResponse({ ok:false, error: 'unknown_action' });
//     return;
//   });

//   // auto-run strict once
//   setTimeout(() => {
//     chrome.storage.local.get(["autofillEnabled","profile"], (r) => {
//       const enabled = (r && r.autofillEnabled !== undefined) ? r.autofillEnabled : true;
//       const profile = (r && r.profile) || null;
//       if (enabled && profile) fillAuthStrict(profile);
//     });
//   }, 800);

//   chrome.storage.onChanged.addListener((changes) => {
//     if ((changes.autofillEnabled && changes.autofillEnabled.newValue) || changes.profile) {
//       setTimeout(() => {
//         chrome.storage.local.get(["autofillEnabled","profile"], (r) => {
//           const enabled = (r && r.autofillEnabled !== undefined) ? r.autofillEnabled : true;
//           const profile = (r && r.profile) || null;
//           if (enabled && profile) fillAuthStrict(profile);
//         });
//       }, 300);
//     }
//   });
// })();

// // Strict hard-fill + username multi-signal guard + required-only rule for force
// (function () {
//   if (window.__RowFiller_autofill_v5_1_installed) return;
//   window.__RowFiller_autofill_v5_1_installed = true;
//   console.log("🔑 RowFiller content/autofill.js v5.1 loaded");

//   // ---------- Utilities ----------
//   const safeLog = (...args) => { try { console.debug("RowFiller:", ...args); } catch(e){} };

//   function debounce(fn, ms = 300) {
//     let t = null;
//     return function () { clearTimeout(t); t = setTimeout(() => fn.apply(this, arguments), ms); };
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
//     try { el.dispatchEvent(new Event("blur", { bubbles: true })); } catch(e){}
//   }

//   function isVisible(el) {
//     try {
//       if (!el) return false;
//       if (el.disabled || el.hidden || el.readOnly) return false;
//       // some inputs inside template display may have offsetParent null
//       const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
//       if (style && style.display === "none") return false;
//       return (el.offsetParent !== null) || el.tagName.toLowerCase() === "select" || el.getAttribute("contenteditable") === "true";
//     } catch (e) { return false; }
//   }

//   function alreadyFilled(el) {
//     try {
//       if (!el) return false;
//       if (el.dataset && el.dataset.rowfiller === "filled") return true;
//       if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
//         return !!(el.innerText && el.innerText.trim().length > 0);
//       }
//       const v = el.value;
//       return (v !== undefined && v !== null && String(v).trim().length > 0);
//     } catch (e) { return false; }
//   }

//   // ---------- Simple validators ----------
//   const looksLikeEmail = (v) => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
//   const looksLikePhone = (v) => {
//     if (!v) return false;
//     const digits = (String(v).match(/\d/g) || []).length;
//     return digits >= 7; // loose phone check
//   };
//   const looksLikeUrl = (v) => {
//     if (!v) return false;
//     return /^(https?:\/\/)/i.test(v) || /\.[a-z]{2,}$/i.test(v);
//   };
//   const looksLikeUsername = (v) => {
//     if (!v || typeof v !== "string") return false;
//     if (v.includes("@") || /\s/.test(v)) return false;
//     return /^[A-Za-z0-9._\-]{2,}$/.test(v);
//   };

//   // ---------- Field context extraction ----------
//   function extractLabelText(el) {
//     try {
//       if (!el) return "";
//       if (el.id) {
//         try {
//           const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
//           if (lab && lab.innerText) return lab.innerText.trim();
//         } catch (e) {}
//       }
//       // ancestor label
//       let p = el.parentElement;
//       for (let i = 0; i < 6 && p; i++, p = p.parentElement) {
//         if (p.tagName && p.tagName.toLowerCase() === "label") return (p.innerText || "").trim();
//       }
//       // previous sibling textual label
//       const prev = el.previousElementSibling;
//       if (prev && (prev.tagName === "LABEL" || prev.tagName === "SPAN" || prev.tagName === "DIV")) {
//         if (prev.innerText && prev.innerText.trim()) return prev.innerText.trim();
//       }
//       // aria-labelledby
//       const labId = el.getAttribute && el.getAttribute("aria-labelledby");
//       if (labId) {
//         const ref = document.getElementById(labId);
//         if (ref && ref.innerText) return ref.innerText.trim();
//       }
//       if (el.title && el.title.trim()) return el.title.trim();
//       return "";
//     } catch (e) { return ""; }
//   }

//   function getFieldParts(el) {
//     try {
//       const label = extractLabelText(el) || "";
//       const name = (el.name || "") + "";
//       const id = (el.id || "") + "";
//       const placeholder = (el.placeholder || "") + "";
//       const aria = (el.getAttribute && el.getAttribute("aria-label")) || "";
//       const title = (el.getAttribute && el.getAttribute("title")) || "";
//       // nearby textual hints
//       let nearby = "";
//       try {
//         const parent = el.parentElement;
//         if (parent) {
//           nearby = Array.from(parent.childNodes)
//             .filter(n => n.nodeType === Node.TEXT_NODE)
//             .map(n => (n.textContent || "").trim()).join(" ");
//         }
//       } catch (e) {}
//       const combined = [label, name, id, placeholder, aria, title, nearby].filter(Boolean).join(" ").toLowerCase();
//       return {
//         label: label.toLowerCase(),
//         name: name.toLowerCase(),
//         id: id.toLowerCase(),
//         placeholder: placeholder.toLowerCase(),
//         aria: (aria || "").toLowerCase(),
//         title: (title || "").toLowerCase(),
//         nearby: (nearby || "").toLowerCase(),
//         combined
//       };
//     } catch (e) {
//       return { label: "", name: "", id: "", placeholder: "", aria: "", title: "", nearby: "", combined: "" };
//     }
//   }

//   // ---------- Role configuration ----------
//   // pos regexes checked on parts with weights; neg penalizes strongly
//   const ROLE_CFG = {
//     firstname:   { pos: [/\bfirst(?:[_\s-]?name)?\b/, /\bgiven\b/], neg: [], minAuto: 6, minForce: 10 },
//     lastname:    { pos: [/\blast(?:[_\s-]?name)?\b/, /\bsurname\b/], neg: [], minAuto: 6, minForce: 10 },
//     fullname:    { pos: [/\bfull(?:[_\s-]?name)?\b/, /^\bname$/], neg: [], minAuto: 6, minForce: 10 },
//     username:    { pos: [/^username$|user[_\s-]?name|\buser_id\b|\buserid\b|\blogin\b|handle/], neg: [/\bemail\b|\bmail\b|\bpassword\b|\bphone\b|\baddress\b/], minAuto: 12, minForce: 18 },
//     email:       { pos: [/\bemail\b/, /\be-?mail\b/], neg: [/business|work|company/], minAuto: 6, minForce: 12 },
//     businessEmail:{ pos: [/\b(business|work|company|office)[\s_-]*email\b/], neg: [], minAuto: 8, minForce: 14 },
//     password:    { pos: [/^password$|pass(?:word)?|pwd/], neg: [/confirm|verify|retype|repeat|new|current/], minAuto: 6, minForce: 10 },
//     phone:       { pos: [/\bphone\b/, /\bmobile\b/, /\btel\b/, /\bcontact\b/], neg: [/fax/], minAuto: 5, minForce: 9 },
//     address:     { pos: [/\baddress\b/, /\bstreet\b/, /\baddr\b/], neg: [], minAuto: 5, minForce: 9 },
//     city:        { pos: [/\bcity\b/], neg: [], minAuto: 5, minForce: 9 },
//     state:       { pos: [/\bstate\b|\bprovince\b|\bregion\b/], neg: [], minAuto: 5, minForce: 9 },
//     postcode:    { pos: [/\bzip\b|\bpostal\b|\bpostcode\b|\bpin\b/], neg: [], minAuto: 5, minForce: 9 },
//     country:     { pos: [/\bcountry\b/], neg: [], minAuto: 5, minForce: 9 },
//     location:    { pos: [/\blocation\b/, /\bplace\b/], neg: [], minAuto: 4, minForce: 8 },
//     website:     { pos: [/\bwebsite\b|\bhomepage\b|\bsite\b|\bweb[_\s-]?url\b|\burl\b/], neg: [/email/], minAuto: 7, minForce: 12 },
//     description: { pos: [/\bdescription\b|\babout\b|\bbio\b|\bsummary\b/], neg: [], minAuto: 5, minForce: 9 }
//   };

//   // ---------- scoring ----------
//   function scoreForCfg(ctxParts, cfg) {
//     let score = 0;
//     for (const rx of cfg.pos) {
//       if (rx.test(ctxParts.label)) score += 10;
//       if (rx.test(ctxParts.name)) score += 6;
//       if (rx.test(ctxParts.id)) score += 6;
//       if (rx.test(ctxParts.aria)) score += 4;
//       if (rx.test(ctxParts.placeholder)) score += 2;
//       if (rx.test(ctxParts.title)) score += 2;
//       if (rx.test(ctxParts.nearby)) score += 1;
//     }
//     if (cfg.neg && cfg.neg.length) {
//       for (const nrx of cfg.neg) if (nrx.test(ctxParts.combined)) score -= 18;
//     }
//     return score;
//   }

//   // ---------- username multi-signal guard ----------
//   function usernameSignals(ctxParts, el) {
//     let signals = 0;
//     const rx = /username|user[_\s-]?name|login|handle|userid|user id/;
//     if (rx.test(ctxParts.label)) signals++;
//     if (rx.test(ctxParts.name)) signals++;
//     if (rx.test(ctxParts.id)) signals++;
//     if (rx.test(ctxParts.placeholder)) signals++;
//     const ac = (el.getAttribute && (el.getAttribute("autocomplete") || "") || "").toLowerCase();
//     if (ac.includes("username")) signals++;
//     return signals; // integer number of signals (0..5)
//   }

//   // ---------- match role function (returns role & score) ----------
//   function matchRoleAndScore(el) {
//     if (!el) return null;
//     if (!isVisible(el)) return null;

//     const type = (el.type || "").toLowerCase();
//     const tag = (el.tagName || "").toLowerCase();
//     const ctx = getFieldParts(el);

//     // direct HTML-type shortcuts
//     if (type === "password") return { role: "password", score: 100 };
//     if (type === "email") {
//       const cfg = ROLE_CFG.email;
//       const sc = scoreForCfg(ctx, cfg);
//       // business detection if label suggests business
//       if (/\bbusiness\b|\bwork\b|\bcompany\b/.test(ctx.combined)) return { role: "businessEmail", score: sc + 6 };
//       return { role: "email", score: sc + 8 };
//     }
//     if (type === "tel") {
//       const cfg = ROLE_CFG.phone;
//       return { role: "phone", score: scoreForCfg(ctx, cfg) + 8 };
//     }

//     // if textarea, prefer description role
//     if (tag === "textarea") {
//       const cfg = ROLE_CFG.description;
//       const sc = scoreForCfg(ctx, cfg);
//       if (sc >= (cfg.minAuto || 5)) return { role: "description", score: sc + 2 };
//     }

//     // iterate roles and compute best score
//     let best = null, bestScore = -Infinity;
//     for (const [role, cfg] of Object.entries(ROLE_CFG)) {
//       // prefer textarea rule handled above
//       let sc = scoreForCfg(ctx, cfg);
//       // small boost when placeholder explicitly matches
//       if (/(?:^|\s)\w+$/.test(ctx.placeholder)) sc += 0;
//       if (sc > bestScore) { bestScore = sc; best = role; }
//     }

//     if (!best) return null;
//     return { role: best, score: bestScore };
//   }

//   // ---------- fallback infer role for required fields ----------
//   function inferRoleFallbackForRequired(el) {
//     try {
//       const ctx = getFieldParts(el);
//       // quick heuristics
//       if ((el.type || "").toLowerCase() === "email") return "email";
//       if ((el.type || "").toLowerCase() === "password") return "password";
//       if ((el.type || "").toLowerCase() === "tel") return "phone";
//       if (/\bfirst(?:[_\s-]?name)?\b/.test(ctx.combined)) return "firstname";
//       if (/\blast(?:[_\s-]?name)?\b/.test(ctx.combined)) return "lastname";
//       if (/\bname\b/.test(ctx.label) && !/\bfirst\b|\blast\b/.test(ctx.label)) return "fullname";
//       if (/\bemail\b/.test(ctx.combined)) return "email";
//       return null;
//     } catch (e) { return null; }
//   }

//   // ---------- prepare values ----------
//   function prepareValues(profile) {
//     const p = (profile && profile.profile) ? profile.profile : (profile || {});
//     const first = p.firstname || p.firstName || "";
//     const last = p.lastname || p.lastName || "";
//     const fullnameFromParts = (first || last) ? `${(first || "").trim()} ${(last || "").trim()}`.trim() : "";
//     const fullname = (p.fullname || p.fullName || fullnameFromParts || "").trim();
//     const password = (p.activePassword === "submissionPassword") ? (p.submissionPassword || "") : (p.emailPassword || p.password || "");
//     return {
//       firstname: first,
//       lastname: last,
//       fullname,
//       username: p.username || "",
//       email: p.email || p.submissionEmail || p.emailId || "",
//       businessEmail: p.businessEmail || p.workEmail || "",
//       password,
//       phone: p.phone || p.number || "",
//       address: p.address || "",
//       city: p.city || "",
//       state: p.state || "",
//       postcode: p.postcode || p.zip || "",
//       country: p.country || "",
//       location: p.location || "",
//       website: p.website || "",
//       description: p.description || p.bio || ""
//     };
//   }

//   // ---------- actual fill attempt for one element ----------
//   function tryFillElement(el, role, values, overwrite = false, isForce = false) {
//     try {
//       if (!el || !role) return false;
//       if (!isVisible(el)) return false;
//       if (!overwrite && alreadyFilled(el)) return false;

//       const v = values[role];
//       if (!v) return false;

//       // validations to prevent wrong placements
//       const tag = (el.tagName || "").toLowerCase();
//       const type = (el.type || "").toLowerCase();

//       if ((role === "email" || role === "businessEmail") && !looksLikeEmail(v)) return false;
//       if (role === "phone" && !looksLikePhone(v)) return false;
//       if (role === "website" && !looksLikeUrl(v)) return false;
//       if (role === "username" && !looksLikeUsername(v)) return false;

//       // avoid putting email into textarea or url inputs
//       if ((role === "email") && (tag === "textarea" || type === "url")) return false;
//       if ((role === "username") && ["email","tel","url"].includes(type)) return false;

//       // select option handling
//       if (tag === "select") {
//         for (const opt of Array.from(el.options)) {
//           if (!opt) continue;
//           try {
//             if ((opt.value && opt.value.toLowerCase() === String(v).toLowerCase()) || (opt.text && opt.text.toLowerCase() === String(v).toLowerCase())) {
//               el.value = opt.value;
//               el.dispatchEvent(new Event("change", { bubbles: true }));
//               if (el.dataset) el.dataset.rowfiller = "filled";
//               return true;
//             }
//           } catch(e){}
//         }
//         return false;
//       }

//       // contenteditable
//       if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
//         try { document.execCommand && document.execCommand('insertText', false, v); } catch(e){ el.innerText = v; }
//         if (el.dataset) el.dataset.rowfiller = "filled";
//         return true;
//       }

//       setNativeValue(el, v);
//       if (el.dataset) el.dataset.rowfiller = "filled";
//       return true;
//     } catch (e) {
//       safeLog("tryFillElement error:", e);
//       return false;
//     }
//   }

//   // ---------- core fill loop ----------
//   function doFill(profile, options = { force: false }) {
//     try {
//       // skip google account pages for security
//       if (location.hostname.includes("accounts.google.com") || location.hostname.endsWith("google.com")) {
//         safeLog("Skipping autofill on Google domains for safety");
//         return 0;
//       }

//       const values = prepareValues(profile);
//       const nodes = Array.from(document.querySelectorAll("input, textarea, select, [contenteditable='true']"));

//       // sort top-to-bottom so natural order is preferred
//       nodes.sort((a, b) => {
//         try { return (a.getBoundingClientRect().top || 0) - (b.getBoundingClientRect().top || 0); } catch (e) { return 0; }
//       });

//       const usedRoles = new Set();
//       let filled = 0;

//       for (const el of nodes) {
//         try {
//           if (!isVisible(el)) continue;

//           // compute match and score
//           const ms = matchRoleAndScore(el);
//           let role = ms && ms.role ? ms.role : null;
//           const score = ms && (typeof ms.score === "number") ? ms.score : 0;

//           // if force & element required but no role computed, try fallback heuristics
//           const isRequired = !!(el.required || (el.getAttribute && el.getAttribute("aria-required") === "true"));
//           if (!role && options.force && isRequired) {
//             role = inferRoleFallbackForRequired(el);
//             safeLog("Fallback required role inferred:", role, el);
//           }

//           if (!role) continue;

//           // if role is username: require strong multi-signal, else skip (even in force)
//           if (role === "username") {
//             const ctx = getFieldParts(el);
//             const signals = usernameSignals(ctx, el);
//             // require at least 3 signals in force mode; at least 2 in auto mode (but only if element empty)
//             if (options.force) {
//               if (signals < 3) { safeLog("Username skipped (not enough signals)", signals, ctx); continue; }
//             } else {
//               if (signals < 2) { safeLog("Username skipped (auto: not enough signals)", signals, ctx); continue; }
//             }
//           }

//           // threshold decision:
//           const cfg = ROLE_CFG[role] || {};
//           const minAuto = cfg.minAuto || 6;
//           const minForce = cfg.minForce || (minAuto + 4);

//           // Decide whether to attempt to fill:
//           // - Auto mode (not force): only fill if field is empty and score >= minAuto
//           // - Force mode: overwrite allowed but only if (field is required) OR (score >= minForce)
//           let willFill = false;
//           if (options.force) {
//             if (isRequired) willFill = true;
//             else if (score >= minForce) willFill = true;
//             else willFill = false;
//           } else {
//             if (!alreadyFilled(el) && score >= minAuto) willFill = true;
//           }

//           if (!willFill) continue;

//           // Avoid filling same role multiple times except for social/description fields.
//           if (usedRoles.has(role) && !["description"].includes(role)) {
//             continue;
//           }

//           const ok = tryFillElement(el, role, values, options.force, options.force);
//           if (ok) {
//             filled++;
//             usedRoles.add(role);
//           }
//         } catch (e) {
//           safeLog("doFill element loop error:", e);
//         }
//       }

//       safeLog(`doFill completed (force=${!!options.force}) -> filled ${filled}`);
//       return filled;
//     } catch (e) {
//       safeLog("doFill top-level error:", e);
//       return 0;
//     }
//   }

//   // ---------- matchRoleAndScore helper uses config & scoring ----------
//   function matchRoleAndScore(el) {
//     try {
//       if (!isVisible(el)) return null;
//       const type = (el.type || "").toLowerCase();
//       const tag = (el.tagName || "").toLowerCase();
//       const parts = getFieldParts(el);

//       // HTML-level shortcuts
//       if (type === "password") return { role: "password", score: 200 };
//       if (type === "email") {
//         let score = 0;
//         if (ROLE_CFG.email) score = scoreForCfg(parts, ROLE_CFG.email) + 8;
//         // promote business email when label suggests company/work
//         if (/\bbusiness\b|\bwork\b|\bcompany\b/.test(parts.combined)) return { role: "businessEmail", score: score + 6 };
//         return { role: "email", score };
//       }
//       if (type === "tel") return { role: "phone", score: (ROLE_CFG.phone ? scoreForCfg(parts, ROLE_CFG.phone) + 8 : 10) };

//       // textarea case
//       if (tag === "textarea") {
//         const cfg = ROLE_CFG.description;
//         const sc = cfg ? scoreForCfg(parts, cfg) : 0;
//         if (sc >= (cfg ? cfg.minAuto : 5)) return { role: "description", score: sc + 4 };
//       }

//       // compute best scoring role
//       let best = null, bestScore = -Infinity;
//       for (const [role, cfg] of Object.entries(ROLE_CFG)) {
//         const sc = scoreForCfg(parts, cfg);
//         if (sc > bestScore) { bestScore = sc; best = role; }
//       }
//       if (!best) return null;
//       return { role: best, score: bestScore };
//     } catch (e) {
//       safeLog("matchRoleAndScore error:", e);
//       return null;
//     }
//   }

//   // ---------- messaging (popup <-> content) ----------
//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     try {
//       if (!msg || !msg.action) {
//         sendResponse({ ok: false, error: "no_action" });
//         return true;
//       }

//       if (msg.action === "autofill" || msg.action === "autofillProfile" || msg.action === "autofillAuth") {
//         // allow profile to be passed in message; else read from storage
//         const doIt = (profile) => {
//           try {
//             // check enabled flag
//             chrome.storage.local.get(["autofillEnabled"], (res) => {
//               const enabled = (res && res.autofillEnabled !== undefined) ? res.autofillEnabled : true;
//               if (!enabled) { sendResponse({ ok: false, filled: 0, reason: "disabled" }); return; }
//               const filled = doFill(profile, { force: !!msg.force });
//               sendResponse({ ok: filled > 0, filled });
//             });
//           } catch (e) {
//             sendResponse({ ok: false, error: e && e.message });
//           }
//         };

//         if (msg.profile) {
//           doIt(msg.profile);
//         } else {
//           chrome.storage.local.get(["profile"], (res) => {
//             const profile = res && res.profile ? res.profile : null;
//             doIt(profile);
//           });
//         }
//         return true; // async
//       }

//       // toggleAutofill check
//       if (msg.action === "toggleAutofill") {
//         sendResponse({ ok: true });
//         return;
//       }

//       sendResponse({ ok: false, error: "unknown_action" });
//       return;
//     } catch (e) {
//       safeLog("message handler error", e);
//       try { sendResponse({ ok: false, error: e && e.message }); } catch (e2) {}
//       return true;
//     }
//   });

//   // ---------- autorun: read profile & run small tries + mutation observer ----------
//   function autoRunIfEnabled() {
//     try {
//       chrome.storage.local.get(["autofillEnabled","profile"], (res) => {
//         const enabled = (res && res.autofillEnabled !== undefined) ? res.autofillEnabled : true;
//         const profile = (res && res.profile) ? res.profile : null;
//         if (!enabled || !profile) return;
//         // run a couple of attempts
//         setTimeout(() => { try { doFill(profile, { force: false }); } catch (e) {} }, 600);
//         setTimeout(() => { try { doFill(profile, { force: false }); } catch (e) {} }, 1400);
//       });
//     } catch (e) { safeLog("autoRunIfEnabled error", e); }
//   }

//   const obsCallback = debounce(() => {
//     try {
//       chrome.storage.local.get(["autofillEnabled","profile"], (res) => {
//         const enabled = (res && res.autofillEnabled !== undefined) ? res.autofillEnabled : true;
//         const profile = (res && res.profile) ? res.profile : null;
//         if (!enabled || !profile) return;
//         try { doFill(profile, { force: false }); } catch (e) {}
//       });
//     } catch (e) { safeLog("observer callback error", e); }
//   }, 700);

//   if (typeof MutationObserver !== "undefined") {
//     try {
//       const mo = new MutationObserver(obsCallback);
//       if (document.body) mo.observe(document.body, { childList: true, subtree: true, attributes: true });
//     } catch (e) { safeLog("MutationObserver attach failed", e); }
//   }

//   // run on ready
//   if (document.readyState === "complete" || document.readyState === "interactive") autoRunIfEnabled();
//   else window.addEventListener("DOMContentLoaded", autoRunIfEnabled);

//   // storage change: re-run
//   chrome.storage.onChanged.addListener((changes) => {
//     if (changes.autofillEnabled || changes.profile) {
//       autoRunIfEnabled();
//     }
//   });

//   safeLog("RowFiller content script v5.1 ready");
// })();

// content/auth.js (v5.2) - Updated with Strict Matching, Ambiguity Check, and Higher Thresholds
(function () {
  if (window.__RowFiller_autofill_v5_1_installed) return;
  window.__RowFiller_autofill_v5_1_installed = true;
  console.log(
    "🔑 RowFiller content/auth.js v5.2 loaded (Strict Auth Matching)"
  );

  // ---------- Utilities ----------
  const safeLog = (...args) => {
    try {
      console.debug("RowFiller:", ...args);
    } catch (e) {}
  };

  function debounce(fn, ms = 300) {
    let t = null;
    return function () {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, arguments), ms);
    };
  }

  function setNativeValue(el, value) {
    try {
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && desc.set) desc.set.call(el, value);
      else el.value = value;
    } catch (e) {
      try {
        el.value = value;
      } catch (e2) {}
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    try {
      el.dispatchEvent(new Event("blur", { bubbles: true }));
    } catch (e) {}
  }

  function isVisible(el) {
    try {
      if (!el) return false;
      if (el.disabled || el.hidden || el.readOnly) return false;
      const style = window.getComputedStyle
        ? window.getComputedStyle(el)
        : null;
      if (style && style.display === "none") return false;
      return (
        el.offsetParent !== null ||
        el.tagName.toLowerCase() === "select" ||
        el.getAttribute("contenteditable") === "true"
      );
    } catch (e) {
      return false;
    }
  }

  function alreadyFilled(el) {
    try {
      if (!el) return false;
      if (el.dataset && el.dataset.rowfiller === "filled") return true;
      if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
        return !!(el.innerText && el.innerText.trim().length > 0);
      }
      const v = el.value;
      return v !== undefined && v !== null && String(v).trim().length > 0;
    } catch (e) {
      return false;
    }
  }

  // ---------- Stricter validators ----------
  const looksLikeEmail = (v) =>
    typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); // Require dot
  const looksLikePhone = (v) => {
    if (!v) return false;
    const digits = (String(v).match(/\d/g) || []).length;
    return digits >= 10; // Stricter
  };
  const looksLikeUrl = (v) => {
    if (!v) return false;
    return /^(https?:\/\/)/i.test(v) || /\.[a-z]{2,}$/i.test(v);
  };
  const looksLikeUsername = (v) => {
    if (!v || typeof v !== "string") return false;
    if (v.includes("@") || /\s/.test(v)) return false;
    return /^[A-Za-z0-9._\-]{3,}$/.test(v); // Stricter min length
  };

  // ---------- Field context extraction ----------
  function extractLabelText(el) {
    try {
      if (!el) return "";
      if (el.id) {
        try {
          const lab = document.querySelector(
            `label[for="${CSS.escape(el.id)}"]`
          );
          if (lab && lab.innerText) return lab.innerText.trim();
        } catch (e) {}
      }
      // ancestor label
      let p = el.parentElement;
      for (let i = 0; i < 6 && p; i++, p = p.parentElement) {
        if (p.tagName && p.tagName.toLowerCase() === "label")
          return (p.innerText || "").trim();
      }
      // previous sibling textual label
      const prev = el.previousElementSibling;
      if (
        prev &&
        (prev.tagName === "LABEL" ||
          prev.tagName === "SPAN" ||
          prev.tagName === "DIV")
      ) {
        if (prev.innerText && prev.innerText.trim())
          return prev.innerText.trim();
      }
      // aria-labelledby
      const labId = el.getAttribute && el.getAttribute("aria-labelledby");
      if (labId) {
        const ref = document.getElementById(labId);
        if (ref && ref.innerText) return ref.innerText.trim();
      }
      if (el.title && el.title.trim()) return el.title.trim();
      return "";
    } catch (e) {
      return "";
    }
  }

  function getFieldParts(el) {
    try {
      const label = extractLabelText(el) || "";
      const name = (el.name || "") + "";
      const id = (el.id || "") + "";
      const placeholder = (el.placeholder || "") + "";
      const aria = (el.getAttribute && el.getAttribute("aria-label")) || "";
      const title = (el.getAttribute && el.getAttribute("title")) || "";
      // nearby textual hints
      let nearby = "";
      try {
        const parent = el.parentElement;
        if (parent) {
          nearby = Array.from(parent.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => (n.textContent || "").trim())
            .join(" ");
        }
      } catch (e) {}
      const combined = [label, name, id, placeholder, aria, title, nearby]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return {
        label: label.toLowerCase(),
        name: name.toLowerCase(),
        id: id.toLowerCase(),
        placeholder: placeholder.toLowerCase(),
        aria: (aria || "").toLowerCase(),
        title: (title || "").toLowerCase(),
        nearby: (nearby || "").toLowerCase(),
        combined,
      };
    } catch (e) {
      return {
        label: "",
        name: "",
        id: "",
        placeholder: "",
        aria: "",
        title: "",
        nearby: "",
        combined: "",
      };
    }
  }

  // ---------- Role configuration with higher thresholds ----------
  const ROLE_CFG = {
    firstname: {
      pos: [/\bfirst(?:[_\s-]?name)?\b/, /\bgiven\b/],
      neg: [/username/i, /social/i],
      minAuto: 8,
      minForce: 12,
    }, // Increased
    lastname: {
      pos: [/\blast(?:[_\s-]?name)?\b/, /\bsurname\b/],
      neg: [/username/i, /social/i],
      minAuto: 8,
      minForce: 12,
    },
    fullname: {
      pos: [/\bfull(?:[_\s-]?name)?\b/, /^\bname$/],
      neg: [/username/i, /social/i],
      minAuto: 8,
      minForce: 12,
    },
    username: {
      pos: [
        /^username$|user[_\s-]?name|\buser_id\b|\buserid\b|\blogin\b|handle/,
      ],
      neg: [/\bemail\b|\bmail\b|\bpassword\b|\bphone\b|\baddress\b/, /name/i],
      minAuto: 15,
      minForce: 22,
    }, // Stricter
    email: {
      pos: [/\bemail\b/, /\be-?mail\b/],
      neg: [/business|work|company/, /social/i],
      minAuto: 8,
      minForce: 14,
    },
    businessEmail: {
      pos: [/\b(business|work|company|office)[\s_-]*email\b/],
      neg: [/social/i],
      minAuto: 10,
      minForce: 16,
    },
    password: {
      pos: [/^password$|pass(?:word)?|pwd/],
      neg: [/confirm|verify|retype|repeat|new|current/],
      minAuto: 8,
      minForce: 12,
    },
    phone: {
      pos: [/\bphone\b/, /\bmobile\b/, /\btel\b/, /\bcontact\b/],
      neg: [/fax/, /email/i, /username/i],
      minAuto: 7,
      minForce: 11,
    },
    address: {
      pos: [/\baddress\b/, /\bstreet\b/, /\baddr\b/],
      neg: [/email/i, /username/i],
      minAuto: 7,
      minForce: 11,
    },
    city: { pos: [/\bcity\b/], neg: [], minAuto: 7, minForce: 11 },
    state: {
      pos: [/\bstate\b|\bprovince\b|\bregion\b/],
      neg: [],
      minAuto: 7,
      minForce: 11,
    },
    postcode: {
      pos: [/\bzip\b|\bpostal\b|\bpostcode\b|\bpin\b/],
      neg: [],
      minAuto: 7,
      minForce: 11,
    },
    country: { pos: [/\bcountry\b/], neg: [], minAuto: 7, minForce: 11 },
    location: {
      pos: [/\blocation\b/, /\bplace\b/],
      neg: [/username/i],
      minAuto: 6,
      minForce: 10,
    },
    website: {
      pos: [/\bwebsite\b|\bhomepage\b|\bsite\b|\bweb[_\s-]?url\b|\burl\b/],
      neg: [/email/, /social/i, /username/i],
      minAuto: 9,
      minForce: 14,
    },
    description: {
      pos: [/\bdescription\b|\babout\b|\bbio\b|\bsummary\b/],
      neg: [/username/i, /email/i],
      minAuto: 7,
      minForce: 11,
    },
  };

  // ---------- scoring ----------
  function scoreForCfg(ctxParts, cfg) {
    let score = 0;
    for (const rx of cfg.pos) {
      if (rx.test(ctxParts.label)) score += 10;
      if (rx.test(ctxParts.name)) score += 6;
      if (rx.test(ctxParts.id)) score += 6;
      if (rx.test(ctxParts.aria)) score += 4;
      if (rx.test(ctxParts.placeholder)) score += 2;
      if (rx.test(ctxParts.title)) score += 2;
      if (rx.test(ctxParts.nearby)) score += 1;
    }
    if (cfg.neg && cfg.neg.length) {
      for (const nrx of cfg.neg) if (nrx.test(ctxParts.combined)) score -= 25; // Stronger penalty
    }
    return score;
  }

  // ---------- username multi-signal guard (stricter) ----------
  function usernameSignals(ctxParts, el) {
    let signals = 0;
    const rx = /username|user[_\s-]?name|login|handle|userid|user id/;
    if (rx.test(ctxParts.label)) signals++;
    if (rx.test(ctxParts.name)) signals++;
    if (rx.test(ctxParts.id)) signals++;
    if (rx.test(ctxParts.placeholder)) signals++;
    const ac = (
      (el.getAttribute && (el.getAttribute("autocomplete") || "")) ||
      ""
    ).toLowerCase();
    if (ac.includes("username")) signals++;
    return signals;
  }

  // ---------- match role function with ambiguity check ----------
  function matchRoleAndScore(el) {
    if (!el) return null;
    if (!isVisible(el)) return null;

    const type = (el.type || "").toLowerCase();
    const tag = (el.tagName || "").toLowerCase();
    const ctx = getFieldParts(el);

    // direct HTML-type shortcuts
    if (type === "password") return { role: "password", score: 100 };
    if (type === "email") {
      const cfg = ROLE_CFG.email;
      const sc = scoreForCfg(ctx, cfg);
      // business detection if label suggests business
      if (/\bbusiness\b|\bwork\b|\bcompany\b/.test(ctx.combined))
        return { role: "businessEmail", score: sc + 6 };
      return { role: "email", score: sc + 8 };
    }
    if (type === "tel") {
      const cfg = ROLE_CFG.phone;
      return { role: "phone", score: scoreForCfg(ctx, cfg) + 8 };
    }

    // if textarea, prefer description role
    if (tag === "textarea") {
      const cfg = ROLE_CFG.description;
      const sc = scoreForCfg(ctx, cfg);
      if (sc >= (cfg.minAuto || 5))
        return { role: "description", score: sc + 2 };
    }

    // iterate roles and compute scores
    const scores = [];
    for (const [role, cfg] of Object.entries(ROLE_CFG)) {
      const sc = scoreForCfg(ctx, cfg);
      if (sc > 0) scores.push({ role, score: sc });
    }

    if (scores.length === 0) return null;

    // Sort descending
    scores.sort((a, b) => b.score - a.score);

    // Ambiguity check: best must be at least 5 points higher than second (stricter)
    if (scores.length > 1 && scores[0].score - scores[1].score < 5) {
      safeLog(
        `Ambiguous field: ${scores[0].role} (${scores[0].score}) vs ${scores[1].role} (${scores[1].score}) - skipping`
      );
      return null;
    }

    return { role: scores[0].role, score: scores[0].score };
  }

  // ---------- fallback infer role for required fields (stricter) ----------
  function inferRoleFallbackForRequired(el) {
    try {
      const ctx = getFieldParts(el);
      if ((el.type || "").toLowerCase() === "email") return "email";
      if ((el.type || "").toLowerCase() === "password") return "password";
      if ((el.type || "").toLowerCase() === "tel") return "phone";
      if (
        /\bfirst(?:[_\s-]?name)?\b/.test(ctx.combined) &&
        !/username/i.test(ctx.combined)
      )
        return "firstname";
      if (
        /\blast(?:[_\s-]?name)?\b/.test(ctx.combined) &&
        !/username/i.test(ctx.combined)
      )
        return "lastname";
      if (
        /\bname\b/.test(ctx.label) &&
        !/\bfirst\b|\blast\b|username/i.test(ctx.label)
      )
        return "fullname";
      if (/\bemail\b/.test(ctx.combined) && !/business/i.test(ctx.combined))
        return "email";
      return null;
    } catch (e) {
      return null;
    }
  }

  // ---------- prepare values ----------
  function prepareValues(profile) {
    const p = profile && profile.profile ? profile.profile : profile || {};
    const first = p.firstname || p.firstName || "";
    const last = p.lastname || p.lastName || "";
    const fullnameFromParts =
      first || last
        ? `${(first || "").trim()} ${(last || "").trim()}`.trim()
        : "";
    const fullname = (
      p.fullname ||
      p.fullName ||
      fullnameFromParts ||
      ""
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
      email: p.email || p.submissionEmail || p.emailId || "",
      businessEmail: p.businessEmail || p.workEmail || "",
      password,
      phone: p.phone || p.number || "",
      address: p.address || "",
      city: p.city || "",
      state: p.state || "",
      postcode: p.postcode || p.zip || "",
      country: p.country || "",
      location: p.location || "",
      website: p.website || "",
      description: p.description || p.bio || "",
    };
  }

  // ---------- actual fill attempt for one element ----------
  function tryFillElement(
    el,
    role,
    values,
    overwrite = false,
    isForce = false
  ) {
    try {
      if (!el || !role) return false;
      if (!isVisible(el)) return false;
      if (!overwrite && alreadyFilled(el)) return false;

      const v = values[role];
      if (!v) return false;

      // validations to prevent wrong placements (stricter)
      const tag = (el.tagName || "").toLowerCase();
      const type = (el.type || "").toLowerCase();

      if ((role === "email" || role === "businessEmail") && !looksLikeEmail(v))
        return false;
      if (role === "phone" && !looksLikePhone(v)) return false;
      if (role === "website" && !looksLikeUrl(v)) return false;
      if (role === "username" && !looksLikeUsername(v)) return false;

      // avoid putting email into textarea or url inputs
      if (role === "email" && (tag === "textarea" || type === "url"))
        return false;
      if (role === "username" && ["email", "tel", "url"].includes(type))
        return false;

      // select option handling
      if (tag === "select") {
        for (const opt of Array.from(el.options)) {
          if (!opt) continue;
          try {
            if (
              (opt.value &&
                opt.value.toLowerCase() === String(v).toLowerCase()) ||
              (opt.text && opt.text.toLowerCase() === String(v).toLowerCase())
            ) {
              el.value = opt.value;
              el.dispatchEvent(new Event("change", { bubbles: true }));
              if (el.dataset) el.dataset.rowfiller = "filled";
              return true;
            }
          } catch (e) {}
        }
        return false;
      }

      // contenteditable
      if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
        try {
          document.execCommand && document.execCommand("insertText", false, v);
        } catch (e) {
          el.innerText = v;
        }
        if (el.dataset) el.dataset.rowfiller = "filled";
        return true;
      }

      setNativeValue(el, v);
      if (el.dataset) el.dataset.rowfiller = "filled";
      return true;
    } catch (e) {
      safeLog("tryFillElement error:", e);
      return false;
    }
  }

  // ---------- core fill loop ----------
  function doFill(profile, options = { force: false }) {
    try {
      // skip google account pages for security
      if (
        location.hostname.includes("accounts.google.com") ||
        location.hostname.endsWith("google.com")
      ) {
        safeLog("Skipping autofill on Google domains for safety");
        return 0;
      }

      const values = prepareValues(profile);
      const nodes = Array.from(
        document.querySelectorAll(
          "input, textarea, select, [contenteditable='true']"
        )
      );

      // sort top-to-bottom so natural order is preferred
      nodes.sort((a, b) => {
        try {
          return (
            (a.getBoundingClientRect().top || 0) -
            (b.getBoundingClientRect().top || 0)
          );
        } catch (e) {
          return 0;
        }
      });

      const usedRoles = new Set();
      let filled = 0;

      for (const el of nodes) {
        try {
          if (!isVisible(el)) continue;

          // compute match and score
          const ms = matchRoleAndScore(el);
          let role = ms && ms.role ? ms.role : null;
          const score = ms && typeof ms.score === "number" ? ms.score : 0;

          // if force & element required but no role computed, try fallback heuristics
          const isRequired = !!(
            el.required ||
            (el.getAttribute && el.getAttribute("aria-required") === "true")
          );
          if (!role && options.force && isRequired) {
            role = inferRoleFallbackForRequired(el);
            safeLog("Fallback required role inferred:", role, el);
          }

          if (!role) continue;

          // if role is username: require strong multi-signal, else skip (even in force)
          if (role === "username") {
            const ctx = getFieldParts(el);
            const signals = usernameSignals(ctx, el);
            // require at least 4 signals in force mode; at least 3 in auto mode
            if (options.force) {
              if (signals < 4) {
                safeLog("Username skipped (not enough signals)", signals, ctx);
                continue;
              }
            } else {
              if (signals < 3) {
                safeLog(
                  "Username skipped (auto: not enough signals)",
                  signals,
                  ctx
                );
                continue;
              }
            }
          }

          // threshold decision:
          const cfg = ROLE_CFG[role] || {};
          const minAuto = cfg.minAuto || 8;
          const minForce = cfg.minForce || minAuto + 4;

          // Decide whether to attempt to fill:
          // - Auto mode (not force): only fill if field is empty and score >= minAuto
          // - Force mode: overwrite allowed but only if (field is required) OR (score >= minForce)
          let willFill = false;
          if (options.force) {
            if (isRequired) willFill = true;
            else if (score >= minForce) willFill = true;
            else willFill = false;
          } else {
            if (!alreadyFilled(el) && score >= minAuto) willFill = true;
          }

          if (!willFill) continue;

          // Avoid filling same role multiple times except for social/description fields.
          if (usedRoles.has(role) && !["description"].includes(role)) {
            continue;
          }

          const ok = tryFillElement(
            el,
            role,
            values,
            options.force,
            options.force
          );
          if (ok) {
            filled++;
            usedRoles.add(role);
          }
        } catch (e) {
          safeLog("doFill element loop error:", e);
        }
      }

      safeLog(
        `doFill completed (force=${!!options.force}) -> filled ${filled}`
      );
      return filled;
    } catch (e) {
      safeLog("doFill top-level error:", e);
      return 0;
    }
  }

  // ---------- messaging (popup <-> content) ----------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      if (!msg || !msg.action) {
        sendResponse({ ok: false, error: "no_action" });
        return true;
      }

      if (
        msg.action === "autofill" ||
        msg.action === "autofillProfile" ||
        msg.action === "autofillAuth"
      ) {
        // allow profile to be passed in message; else read from storage
        const doIt = (profile) => {
          try {
            // check enabled flag
            chrome.storage.local.get(["autofillEnabled"], (res) => {
              const enabled =
                res && res.autofillEnabled !== undefined
                  ? res.autofillEnabled
                  : true;
              if (!enabled) {
                sendResponse({ ok: false, filled: 0, reason: "disabled" });
                return;
              }
              const filled = doFill(profile, { force: !!msg.force });
              sendResponse({ ok: filled > 0, filled });
            });
          } catch (e) {
            sendResponse({ ok: false, error: e && e.message });
          }
        };

        if (msg.profile) {
          doIt(msg.profile);
        } else {
          chrome.storage.local.get(["profile"], (res) => {
            const profile = res && res.profile ? res.profile : null;
            doIt(profile);
          });
        }
        return true; // async
      }

      // toggleAutofill check
      if (msg.action === "toggleAutofill") {
        sendResponse({ ok: true });
        return;
      }

      sendResponse({ ok: false, error: "unknown_action" });
      return;
    } catch (e) {
      safeLog("message handler error", e);
      try {
        sendResponse({ ok: false, error: e && e.message });
      } catch (e2) {}
      return true;
    }
  });

  // ---------- autorun: read profile & run small tries + mutation observer ----------
  function autoRunIfEnabled() {
    try {
      chrome.storage.local.get(["autofillEnabled", "profile"], (res) => {
        const enabled =
          res && res.autofillEnabled !== undefined ? res.autofillEnabled : true;
        const profile = res && res.profile ? res.profile : null;
        if (!enabled || !profile) return;
        // run a couple of attempts
        setTimeout(() => {
          try {
            doFill(profile, { force: false });
          } catch (e) {}
        }, 600);
        setTimeout(() => {
          try {
            doFill(profile, { force: false });
          } catch (e) {}
        }, 1400);
      });
    } catch (e) {
      safeLog("autoRunIfEnabled error", e);
    }
  }

  const obsCallback = debounce(() => {
    try {
      chrome.storage.local.get(["autofillEnabled", "profile"], (res) => {
        const enabled =
          res && res.autofillEnabled !== undefined ? res.autofillEnabled : true;
        const profile = res && res.profile ? res.profile : null;
        if (!enabled || !profile) return;
        try {
          doFill(profile, { force: false });
        } catch (e) {}
      });
    } catch (e) {
      safeLog("observer callback error", e);
    }
  }, 700);

  if (typeof MutationObserver !== "undefined") {
    try {
      const mo = new MutationObserver(obsCallback);
      if (document.body)
        mo.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });
    } catch (e) {
      safeLog("MutationObserver attach failed", e);
    }
  }

  // run on ready
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  )
    autoRunIfEnabled();
  else window.addEventListener("DOMContentLoaded", autoRunIfEnabled);

  // storage change: re-run
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.autofillEnabled || changes.profile) {
      autoRunIfEnabled();
    }
  });

  safeLog("RowFiller auth script v5.2 ready");
})();
