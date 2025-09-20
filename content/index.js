// content/index.js
(function () {
  // Wait until RowFiller namespace exists (utils loaded)
  function safeCall(handlerName, data) {
    try {
      if (window.RowFiller && typeof window.RowFiller[handlerName] === 'function') {
        return window.RowFiller[handlerName](data);
      } else {
        console.warn("Handler not found:", handlerName);
        return false;
      }
    } catch (e) {
      console.error("safeCall error:", e);
      return false;
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.action === "applyRow" && msg.data) {
      const host = window.location.hostname || "";
      console.log("RowFiller content router received data for host:", host);

      let applied = false;
      if (host.includes("pinterest.com")) {
        applied = safeCall('fillPinterest', msg.data);
        sendResponse({ status: applied ? "✅ Pinterest autofill attempted" : "❌ Pinterest handler failed" });
      } else if (host.includes("medium.com")) {
        applied = safeCall('fillMedium', msg.data);
        sendResponse({ status: applied ? "✅ Medium autofill attempted" : "❌ Medium handler failed" });
      } else {
        // Generic attempt: try common fields
        // Title
        try {
          const titleInput = document.querySelector('input[placeholder*="title"], h1[contenteditable="true"], input[name="title"]');
          if (titleInput && msg.data.title) {
            if (titleInput.getAttribute && titleInput.getAttribute('contenteditable') === 'true') {
              titleInput.focus();
              document.execCommand('insertText', false, msg.data.title);
            } else if ('value' in titleInput) {
              titleInput.focus();
              titleInput.value = msg.data.title;
              titleInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
          const descSet = window.RowFiller && window.RowFiller.setDraftEditorText && window.RowFiller.setDraftEditorText(msg.data.description || "");
          applied = true;
          sendResponse({ status: "✅ Generic autofill attempted" });
        } catch (e) {
          console.warn("Generic autofill failed", e);
          sendResponse({ status: "❌ No handler for this site" });
        }
      }
      // keep message channel open if asynchronous (not needed here)
      return true;
    }
  });
})();
