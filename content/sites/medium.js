//  Best working medium code 



// content/sites/medium.js
// Robust Medium autofill handler with safe title/desc text insertion,
// image upload fallback, tags hyperlink support, and save-error handling.

(function () {
  window.RowFiller = window.RowFiller || {};
  const log = (...a) => console.log("RowFiller:Medium:", ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function waitForAny(selectors, timeout = 2500) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      (function poll() {
        for (const s of selectors) {
          const el = document.querySelector(s);
          if (el) return resolve({ selector: s, el });
        }
        if (Date.now() - t0 > timeout) return resolve(null);
        setTimeout(poll, 120);
      })();
    });
  }

  function dispatchInput(el) {
    try {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
    } catch (e) {}
  }

  function dataURLtoFile(dataurl, filename = "image.png") {
    try {
      const arr = dataurl.split(",");
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : "image/png";
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8 = new Uint8Array(n);
      while (n--) u8[n] = bstr.charCodeAt(n);
      return new File([u8], filename, { type: mime });
    } catch (e) {
      log("dataURLtoFile failed", e);
      return null;
    }
  }

  async function uploadFileToInput(inputEl, file) {
    try {
      if (!inputEl || !file) return false;
      const dt = new DataTransfer();
      dt.items.add(file);
      inputEl.files = dt.files;
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      inputEl.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(600);
      return true;
    } catch (e) {
      log("uploadFileToInput failed", e);
      return false;
    }
  }

  function detectMediumSaveError() {
    const bodyText = document.body.innerText || "";
    return /cannot save your story/i.test(bodyText);
  }

  function hyperlinkTitle(el, url) {
    if (!el || !url) return false;
    const txt = el.textContent || "";
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = txt;
    el.innerHTML = "";
    el.appendChild(a);
    dispatchInput(el);
    return true;
  }

  window.RowFiller.fillMedium = async function (data) {
    try {
      log("start", data);

      // 1) Title (safe textContent)
      const titleHit = await waitForAny(
        [
          '[data-testid="editorTitleParagraph"]',
          'h1[contenteditable="true"]',
          'h3.graf--title',
          'h1',
          'h3',
        ],
        2000
      );
      if (titleHit && titleHit.el && data.title) {
        const titleEl = titleHit.el;
        titleEl.focus();
        titleEl.textContent = data.title;
        dispatchInput(titleEl);
        log("✅ title set");
      }

      // 2) Description (safe textContent in first paragraph)
      if (data.description) {
        const descEl =
          document.querySelector('p[data-testid="editorParagraphText"]') ||
          document.querySelector(".graf--p");
        if (descEl) {
          descEl.focus();
          descEl.textContent = data.description;
          dispatchInput(descEl);
          log("✅ description set");
        }
      }

      // 3) Image upload
      if (data.imageData) {
        const file = dataURLtoFile(data.imageData, "medium-image.png");
        let uploaded = false;
        const fileInput = document.querySelector(
          'input[type="file"][accept*="image"], input[type="file"]'
        );
        if (fileInput && file) {
          uploaded = await uploadFileToInput(fileInput, file);
        }
        if (!uploaded) {
          const editor =
            document.querySelector(".section-inner") ||
            document.querySelector('[contenteditable="true"]');
          if (editor) {
            const fig = document.createElement("figure");
            const img = document.createElement("img");
            img.src = data.imageData;
            img.style.maxWidth = "100%";
            fig.appendChild(img);
            editor.appendChild(fig);
            dispatchInput(editor);
            log("✅ fallback image inserted");
          }
        }
      }

      // 4) Tags hyperlink (append paragraph with <a>)
      if (data.tags && data.link) {
        const section = document.querySelector(".section-inner");
        if (section) {
          const p = document.createElement("p");
          p.className = "graf graf--p graf-after--p graf--trailing";
          const a = document.createElement("a");
          a.href = data.link;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = data.tags;
          p.appendChild(a);
          section.appendChild(p);
          dispatchInput(section);
          log("✅ tags hyperlink inserted");
        }
      }

      // 5) Hyperlink title with link
      if (data.link) {
        const titleEl =
          document.querySelector('[data-testid="editorTitleParagraph"]') ||
          document.querySelector("h1[contenteditable='true']");
        if (titleEl) {
          hyperlinkTitle(titleEl, data.link);
          log("✅ title hyperlinked");
        }
      }

      // 6) Check save error
      await sleep(1000);
      if (detectMediumSaveError()) {
        log("⚠️ Medium save error detected");
        window.RowFiller.showToast &&
          window.RowFiller.showToast("Medium save error — try manual edit");
      }

      window.RowFiller.showToast &&
        window.RowFiller.showToast("Row applied to Medium ✅");
      return true;
    } catch (err) {
      console.error("Medium handler error:", err);
      window.RowFiller.showToast &&
        window.RowFiller.showToast("❌ Error applying row to Medium");
      return false;
    }
  };
})();




//  End of best working medium code








