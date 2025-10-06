// // background.js
// console.log("🔧 RowFiller background.js starting");

// // On install
// chrome.runtime.onInstalled.addListener(() => {
//   console.log("✅ RowFiller service worker installed");
// });

// // Optional: Open SidePanel when extension icon clicked
// chrome.action.onClicked.addListener(async (tab) => {
//   try {
//     await chrome.sidePanel.open({ tabId: tab.id });
//     await chrome.sidePanel.setOptions({
//       tabId: tab.id,
//       path: "popup.html",
//       enabled: true,
//     });
//   } catch (err) {
//     console.warn("SidePanel open failed (maybe unsupported):", err);
//   }
// });

// // Listen for "triggerAuthFill" message from popup/UI
// chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//   if (msg && msg.action === "triggerAuthFill" && msg.tabId) {
//     const tabId = msg.tabId;
//     // Inject auth.js into the tab
//     chrome.scripting.executeScript(
//       { target: { tabId }, files: ["content/auth.js"] },
//       () => {
//         if (chrome.runtime.lastError) {
//           console.error("Injection failed:", chrome.runtime.lastError.message);
//           sendResponse({ ok: false, error: chrome.runtime.lastError.message });
//           return;
//         }
//         // Send autofillAuth message to content/auth.js
//         chrome.tabs.sendMessage(tabId, { action: "autofillAuth" }, (resp) => {
//           if (chrome.runtime.lastError) {
//             console.error("sendMessage failed:", chrome.runtime.lastError.message);
//             sendResponse({ ok: false, error: chrome.runtime.lastError.message });
//           } else {
//             sendResponse(resp || { ok: true });
//           }
//         });
//       }
//     );
//     return true; // keep channel open for async sendResponse
//   }
// });

// // Auto-inject autofill.js on every completed navigation
// chrome.webNavigation.onCompleted.addListener(
//   (details) => {
//     if (details.frameId === 0) {
//       chrome.scripting.executeScript({
//         target: { tabId: details.tabId },
//         files: ["content/autofill.js"], // keep autofill.js inside /content folder
//       }).catch((err) => {
//         console.warn("autofill.js inject failed:", err.message);
//       });
//     }
//   },
//   { url: [{ urlMatches: "^https?://.*" }] }
// );

// // background.js
// console.log("🛠 RowFiller background service worker started.");

// // Keep minimal logging on install
// chrome.runtime.onInstalled.addListener(() => {
//   console.log("✅ RowFiller installed.");
// });

// // When popup requests autofill: get profile and send to content script
// chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//   if (!msg) return;

//   if (msg.action === "triggerAuthFill" && msg.tabId) {
//     const tabId = msg.tabId;

//     // Fetch profile from storage
//     chrome.storage.local.get("profile", (res) => {
//       const profile = res && res.profile ? res.profile : null;
//       if (!profile) {
//         sendResponse({ ok: false, error: "no_profile" });
//         return;
//       }

//       // Don't autofill on accounts.google.com
//       chrome.tabs.get(tabId, (tab) => {
//         try {
//           const hostname = new URL(tab.url).hostname || "";
//           if (hostname.includes("accounts.google.com") || hostname.includes("google.com")) {
//             console.warn("Skipping autofill on Google domains for security.");
//             sendResponse({ ok: false, error: "google_skipped" });
//             return;
//           }
//         } catch (e) {
//           // ignore URL parse error
//         }

//         // Send a message to the content script in the tab with the profile
//         chrome.tabs.sendMessage(tabId, { action: "autofillAuth", profile }, (resp) => {
//           if (chrome.runtime.lastError) {
//             console.error("sendMessage error:", chrome.runtime.lastError.message);
//             sendResponse({ ok: false, error: chrome.runtime.lastError.message });
//           } else {
//             sendResponse(resp || { ok: true });
//           }
//         });
//       });
//     });

//     // indicate async
//     return true;
//   }
// });

// console.log("🛠 RowFiller background service worker started.");

// // On install event
// chrome.runtime.onInstalled.addListener(() => {
//   console.log("✅ RowFiller installed.");
//   // Enable side panel for all tabs by default
//   chrome.sidePanel.setOptions({ path: "popup.html", enabled: true });
// });

// // Handle extension icon click → open side panel
// chrome.action.onClicked.addListener(async (tab) => {
//   try {
//     await chrome.sidePanel.open({ windowId: tab.windowId });
//     console.log("📂 Side panel opened for window:", tab.windowId);
//   } catch (err) {
//     console.error("⚠️ Failed to open side panel:", err);
//   }
// });

// // Listen for messages (autofill trigger etc.)
// chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//   if (!msg) return;

//   if (msg.action === "triggerAuthFill" && msg.tabId) {
//     const tabId = msg.tabId;

//     // Fetch profile from storage
//     chrome.storage.local.get("profile", (res) => {
//       const profile = res && res.profile ? res.profile : null;
//       if (!profile) {
//         sendResponse({ ok: false, error: "no_profile" });
//         return;
//       }

//       // Skip autofill on Google domains
//       chrome.tabs.get(tabId, (tab) => {
//         try {
//           const hostname = new URL(tab.url).hostname || "";
//           if (hostname.includes("accounts.google.com") || hostname.includes("google.com")) {
//             console.warn("⛔ Skipping autofill on Google domains for security.");
//             sendResponse({ ok: false, error: "google_skipped" });
//             return;
//           }
//         } catch (e) {
//           console.warn("URL parse error", e);
//         }

//         // Send profile to content script
//         chrome.tabs.sendMessage(tabId, { action: "autofillAuth", profile }, (resp) => {
//           if (chrome.runtime.lastError) {
//             console.error("sendMessage error:", chrome.runtime.lastError.message);
//             sendResponse({ ok: false, error: chrome.runtime.lastError.message });
//           } else {
//             sendResponse(resp || { ok: true });
//           }
//         });
//       });
//     });

//     // keep message channel open for async sendResponse
//     return true;
//   }
// });

// // background.js (service worker)
// console.log("🛠 RowFiller background service worker started.");

// chrome.runtime.onInstalled.addListener(() => {
//   console.log("✅ RowFiller installed.");
//   // default: enable autofill
//   chrome.storage.local.get("autofillEnabled", (res) => {
//     if (res && res.autofillEnabled !== undefined) return;
//     chrome.storage.local.set({ autofillEnabled: true });
//   });
//   // side panel optional; keep if supported
//   try { chrome.sidePanel && chrome.sidePanel.setOptions && chrome.sidePanel.setOptions({ path: "popup.html", enabled: true }); } catch (e) {}
// });

// chrome.action.onClicked.addListener(async (tab) => {
//   try {
//     await chrome.sidePanel.open({ windowId: tab.windowId });
//     console.log("📂 Side panel opened for window:", tab.windowId);
//   } catch (err) {
//     console.error("⚠️ Failed to open side panel:", err);
//   }
// });

// chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//   if (!msg) return;
//   if (msg.action === "triggerAuthFill" && msg.tabId) {
//     const tabId = msg.tabId;
//     chrome.storage.local.get(["profile","autofillEnabled"], (res) => {
//       const enabled = (res && res.autofillEnabled !== undefined) ? res.autofillEnabled : true;
//       if (!enabled) { sendResponse({ ok: false, error: "disabled" }); return; }
//       const profile = res && res.profile ? res.profile : null;
//       if (!profile) { sendResponse({ ok: false, error: "no_profile" }); return; }

//       chrome.tabs.get(tabId, (tab) => {
//         try {
//           const hostname = new URL(tab.url).hostname || "";
//           if (hostname.includes("accounts.google.com") || hostname.includes("google.com")) {
//             sendResponse({ ok: false, error: "google_skipped" });
//             return;
//           }
//         } catch (e) {}
//         chrome.tabs.sendMessage(tabId, { action: "autofillAuth", profile }, (resp) => {
//           if (chrome.runtime.lastError) {
//             sendResponse({ ok: false, error: chrome.runtime.lastError.message });
//           } else {
//             sendResponse(resp || { ok: true });
//           }
//         });
//       });
//     });
//     return true; // async
//   }
// });
// HyperFill bg.js — stable open + messaging + fallback inject

// Default: Chrome khud icon click par panel khole
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.warn("Panel behavior setup failed:", err));

  chrome.contextMenus.create({
    id: "open_hyperfill_panel",
    title: "Open HyperFill Panel",
    contexts: ["all"],
  });
});

// Context menu → panel
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "open_hyperfill_panel" && tab?.id) {
    try {
      await chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: "panel.html",
        enabled: true,
      });
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (err) {
      console.warn("ContextMenu panel open failed:", err);
    }
  }
});

// Backup: icon click par manual open bhi try kar lo (restricted pages skip)
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab || !tab.id || /^chrome:\/\//i.test(tab.url || "")) {
      console.warn("Cannot open side panel on restricted page:", tab?.url);
      return;
    }
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: "panel.html",
      enabled: true,
    });
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (e) {
    console.warn("SidePanel manual open failed:", e);
  }
});

// Panel → Content: Hard Fill trigger
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action === "triggerFillOnActiveTab") {
    const { force, profile } = msg;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      if (!tab?.id || /^chrome:\/\//i.test(tab.url || "")) {
        sendResponse({ ok: false, error: "Blocked URL (cannot inject)" });
        return;
      }

      chrome.tabs.sendMessage(
        tab.id,
        { action: "autofill", profile, force },
        (resp) => {
          if (chrome.runtime.lastError || !resp) {
            chrome.scripting.executeScript(
              {
                target: { tabId: tab.id, allFrames: true },
                files: ["content/fill.js"],
              },
              () => {
                setTimeout(() => {
                  chrome.tabs.sendMessage(
                    tab.id,
                    { action: "autofill", profile, force },
                    sendResponse
                  );
                }, 300);
              }
            );
          } else {
            sendResponse(resp);
          }
        }
      );
    });

    return true; // async
  }
});
