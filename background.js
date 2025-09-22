// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log("✅ RowFiller service worker installed");
});

// Open sidePanel when action clicked (optional)
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: "popup.html",
      enabled: true,
    });
  } catch (err) {
    console.warn("SidePanel open failed (maybe unsupported):", err);
  }
});

// Forward triggerAuthFill to content script (auth.js already injected on pages)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === "triggerAuthFill") {
    // Send message to the tab's content script that will handle autofill.
    chrome.tabs.sendMessage(msg.tabId, { action: "autofillAuth" }, (resp) => {
      if (chrome.runtime.lastError) {
        console.error(
          "sendMessage to tab failed:",
          chrome.runtime.lastError.message
        );
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse(resp);
      }
    });
    // Keep channel open for async response
    return true;
  }
});
