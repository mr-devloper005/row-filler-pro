// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log("✅ RowFiller installed");
});

// Jab icon par click ho, side panel open karo
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
  await chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: "popup.html",
    enabled: true
  });
});
