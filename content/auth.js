// content/auth.js
(function () {
  console.log("🔑 content/auth.js loaded");

  function setNativeValue(element, value) {
    try {
      const prototype = Object.getPrototypeOf(element);
      const prototypeDescriptor = Object.getOwnPropertyDescriptor(
        prototype,
        "value"
      );
      const elementDescriptor = Object.getOwnPropertyDescriptor(
        element.__proto__,
        "value"
      );

      const setter =
        prototypeDescriptor && prototypeDescriptor.set
          ? prototypeDescriptor.set
          : elementDescriptor && elementDescriptor.set
          ? elementDescriptor.set
          : null;

      if (setter) {
        setter.call(element, value);
      } else {
        element.value = value;
      }
    } catch (e) {
      element.value = value;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }

  const patterns = {
    email: [/email/i, /e-mail/i, /user.?email/i, /\bmail\b/i],
    username: [/user(name)?/i, /login/i, /handle/i, /\buid\b/i],
    password: [/pass(word)?/i, /^pwd$/i, /passcode/i],
    fullname: [/full.?name/i, /first.?name/i, /last.?name/i, /\bname\b/i],
  };

  function matchField(el) {
    try {
      const text = [
        el.name,
        el.id,
        el.placeholder,
        el.getAttribute("aria-label"),
        el.getAttribute("aria-labelledby"),
      ]
        .filter(Boolean)
        .join(" ");
      for (const [key, regexes] of Object.entries(patterns)) {
        if (regexes.some((rx) => rx.test(text))) return key;
      }
      if (el.type === "email") return "email";
      if (el.type === "password") return "password";
    } catch (e) {}
    return null;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.action !== "autofillAuth") return;
    console.log("📩 content/auth.js received autofillAuth");

    chrome.storage.local.get("profile", (res) => {
      const profile = res && res.profile;
      if (!profile) {
        console.warn("No profile found in storage");
        sendResponse({ ok: false, reason: "no_profile" });
        return;
      }

      const activePass =
        profile.activePassword === "submissionPassword"
          ? profile.submissionPassword || ""
          : profile.emailPassword || "";

      const inputs = Array.from(document.querySelectorAll("input, textarea"));
      let filledCount = 0;

      inputs.forEach((el) => {
        try {
          const role = matchField(el);
          if (!role) return;
          let value = null;
          if (role === "password") value = activePass;
          else value = profile[role];

          if (value) {
            el.focus && el.focus();
            setNativeValue(el, value);
            el.dispatchEvent(new Event("change", { bubbles: true }));
            filledCount++;
          }
        } catch (err) {
          console.warn("Fill error for element", el, err);
        }
      });

      if (filledCount > 0) {
        console.log(`✅ Autofilled ${filledCount} fields`);
        sendResponse({ ok: true, filled: filledCount });
      } else {
        console.log("❌ No matching fields found");
        sendResponse({ ok: false, reason: "no_fields" });
      }
    });

    return true; // async response
  });
})();
