// content/auth.js
(function () {
  // debug log (should appear in page console when script injected)
  console.log("🔑 Auth autofill script loaded");

  // Helper: set value correctly so React/Angular/Vue detect
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
      // fallback
      element.value = value;
    }
    // Trigger input event so frameworks pick it up
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // patterns to detect login/signup fields
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
      ]
        .filter(Boolean)
        .join(" ");
      for (const [key, regexes] of Object.entries(patterns)) {
        if (regexes.some((rx) => rx.test(text))) return key;
      }
      if (el.type === "email") return "email";
      if (el.type === "password") return "password";
    } catch (e) {
      // ignore
    }
    return null;
  }

  // Listen for autofill command from extension
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.action === "autofillAuth") {
      chrome.storage.local.get("profile", (res) => {
        const profile = res && res.profile;
        if (!profile) {
          // nothing to fill
          window.RowFiller?.showToast?.("❌ No profile saved");
          return sendResponse({ ok: false, reason: "no_profile" });
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
            if (role === "password") {
              value = activePass;
            } else {
              value = profile[role];
            }

            if (value) {
              el.focus && el.focus();
              setNativeValue(el, value);
              el.dispatchEvent(new Event("change", { bubbles: true }));
              filledCount++;
            }
          } catch (err) {
            // keep going
            console.warn("RowFiller: fill field error", err);
          }
        });

        if (filledCount > 0) {
          window.RowFiller?.showToast?.(`✅ Autofilled ${filledCount} fields`);
          sendResponse({ ok: true, filled: filledCount });
        } else {
          window.RowFiller?.showToast?.("❌ No matching fields found");
          sendResponse({ ok: false, reason: "no_fields" });
        }
      });
      // indicate async response
      return true;
    }
  });
})();
