// content/utils.js
(function () {
  window.RowFiller = window.RowFiller || {};

  // set value for React-controlled inputs
  window.RowFiller.setReactInputValue = function (el, value) {
    try {
      if (!el) return false;
      const last = el.value;
      el.focus && el.focus();
      el.value = value;
      // React value tracker hack
      try {
        if (el._valueTracker) el._valueTracker.setValue(last);
      } catch (e) {}
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    } catch (err) {
      console.warn("setReactInputValue error", err);
      return false;
    }
  };

  // set text into Draft.js-like contenteditable editors
  window.RowFiller.setDraftEditorText = function (text) {
    if (!text) return false;
    // Try common Draft.js content node
    const content = document.querySelector('.public-DraftEditor-content[contenteditable="true"], .public-DraftEditor-content');
    if (content) {
      content.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
      content.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    // fallback: any contenteditable
    const anyEditable = document.querySelector('[contenteditable="true"]');
    if (anyEditable) {
      anyEditable.focus();
      document.execCommand("insertText", false, text);
      anyEditable.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    return false;
  };

  // show a small toast on page
  window.RowFiller.showToast = function (msg, timeout = 3000) {
    try {
      const id = "rowfiller_toast";
      const prev = document.getElementById(id);
      if (prev) prev.remove();
      const d = document.createElement("div");
      d.id = id;
      d.textContent = msg;
      Object.assign(d.style, {
        position: "fixed",
        right: "12px",
        bottom: "12px",
        background: "#222",
        color: "#fff",
        padding: "8px 12px",
        borderRadius: "6px",
        zIndex: 2147483647,
        fontSize: "13px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
      });
      document.body.appendChild(d);
      setTimeout(() => d.remove(), timeout);
    } catch (e) {
      console.warn("showToast error:", e);
    }
  };

  // attempt to upload a base64 image into an <input type="file"> (best-effort)
  window.RowFiller.uploadBase64ToFileInput = function (base64Data, filename = "image.png") {
    if (!base64Data) return false;
    try {
      const arr = base64Data.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      const file = new File([u8arr], filename, { type: mime });

      // try to find file input on page
      const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
      if (!inputs.length) return false;

      const dt = new DataTransfer();
      dt.items.add(file);
      // pick the first file input that accepts images (heuristic)
      const candidate = inputs.find(i => (i.accept || "").includes("image")) || inputs[0];
      candidate.files = dt.files;

      // React _valueTracker fix
      try {
        if (candidate._valueTracker) candidate._valueTracker.setValue('');
      } catch (e) {}

      candidate.dispatchEvent(new Event("input", { bubbles: true }));
      candidate.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    } catch (e) {
      console.warn("uploadBase64ToFileInput error:", e);
      return false;
    }
  };

})();
