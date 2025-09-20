// =========================
// Optimized Auto-Fill for Pinterest
// =========================

console.log("🎯 Pinterest Auto-Fill Loaded!");

// =========================
// Config
// =========================
const CONFIG = {
  MAX_ATTEMPTS: 8,
  RETRY_DELAY: 200
};

// =========================
// Selectors (Pinterest)
// =========================
const SELECTORS = {
  title: [
    "#storyboard-selector-title",
    '[data-test-id="storyboard-title-field-container"] input',
    'input[placeholder*="Add a title"]'
  ],
  description: ".public-DraftEditor-content",
  link: [
    "#WebsiteField",
    'input[placeholder*="Add a destination link"]',
    'input[aria-label*="Destination"]'
  ],
  tags: [
    "#combobox-storyboard-interest-tags",
    '[id*="interest-tags"]'
  ],
  upload: [
    '#storyboard-upload-input',
    'input[type="file"][accept*="image"]',
    'input[type="file"]'
  ]
};

// =========================
// Utility Functions
// =========================
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const retryAsync = async (fn, attempts = CONFIG.MAX_ATTEMPTS, delay = CONFIG.RETRY_DELAY) => {
  for (let i = 0; i < attempts; i++) {
    const result = await fn();
    if (result) return true;
    await wait(delay);
  }
  return false;
};

const findElement = (selectors) => {
  const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
  for (const selector of selectorArray) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
};

const setReactValue = (el, val) => {
  if (!el) return false;
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  ).set;
  nativeInputValueSetter.call(el, val);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
};

const setDraftText = (text) => {
  const editor = document.querySelector(SELECTORS.description);
  if (!editor) return false;
  editor.focus();
  document.execCommand("selectAll");
  document.execCommand("delete");
  document.execCommand("insertText", false, text);
  editor.dispatchEvent(new Event("input", { bubbles: true }));
  editor.blur();
  return true;
};

const base64ToFile = (base64, name = "image.png") => {
  try {
    const [meta, data] = base64.split(",");
    const mime = meta.match(/:(.*?);/)[1];
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new File([bytes], name, { type: mime });
  } catch (e) {
    console.error("Base64 conversion failed:", e);
    return null;
  }
};

const uploadFile = (input, file) => {
  if (!input || !file) return false;
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
};

// =========================
// Main Pinterest Fill Function
// =========================
const fillPinterest = async (data) => {
  console.log("🚀 Filling Pinterest with data:", data);

  // Title
  if (data.title) {
    await retryAsync(() => {
      const el = findElement(SELECTORS.title);
      return el ? setReactValue(el, data.title) : false;
    });
  }

  // Description
  if (data.description) {
    await retryAsync(() => setDraftText(data.description));
  }

  // Link
  if (data.link) {
    await retryAsync(() => {
      const el = findElement(SELECTORS.link);
      return el ? setReactValue(el, data.link) : false;
    });
  }

  // Tags
  if (data.tags) {
    await retryAsync(() => {
      const el = findElement(SELECTORS.tags);
      if (el) {
        setReactValue(el, data.tags);
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        return true;
      }
      return false;
    });
  }

  // Image Upload
  if (data.imageData || data.image) {
    await retryAsync(() => {
      const input = findElement(SELECTORS.upload);
      if (input) {
        const file = base64ToFile(data.imageData || data.image, "pin.png");
        return uploadFile(input, file);
      }
      return false;
    }, 10, 400); // extra attempts for image
  }

  console.log("✅ Pinterest autofill completed!");
};

// =========================
// Message Listener
// =========================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "applyRow" && message.data) {
    fillPinterest(message.data).then(() => {
      sendResponse({ status: "success", message: "Pinterest autofill done ✅" });
    }).catch(err => {
      console.error("❌ Pinterest autofill error:", err);
      sendResponse({ status: "error", message: err.message });
    });
    return true; // async response
  }
});
