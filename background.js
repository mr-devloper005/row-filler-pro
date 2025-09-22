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
// background.js - replace the triggerAuthFill handler with this
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === "triggerAuthFill" && msg.tabId) {
    const tabId = msg.tabId;
    // inject auth.js into the tab first (if not already)
    chrome.scripting.executeScript(
      { target: { tabId }, files: ["content/auth.js"] },
      (injectionResults) => {
        // Always attempt to send message after injection (or if injection fails, still try)
        chrome.tabs.sendMessage(tabId, { action: "autofillAuth" }, (resp) => {
          if (chrome.runtime.lastError) {
            console.error(
              "sendMessage failed:",
              chrome.runtime.lastError.message
            );
            sendResponse({
              ok: false,
              error: chrome.runtime.lastError.message,
            });
          } else {
            sendResponse(resp || { ok: true });
          }
        });
      }
    );
    return true; // keep channel open for async sendResponse
  }
});
