// // popup.js

// let parsedRows = [];

// // Excel/CSV Upload
// document.getElementById("fileInput").addEventListener("change", handleFile, false);

// function handleFile(e) {
//   const file = e.target.files[0];
//   if (!file) return;

//   const reader = new FileReader();
//   reader.onload = function (evt) {
//     const data = new Uint8Array(evt.target.result);
//     const workbook = XLSX.read(data, { type: "array" });

//     const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
//     const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

//     parsedRows = rows.filter(r => r.length > 0);
//     renderRows();
//   };
//   reader.readAsArrayBuffer(file);
// }

// // Paste data parse
// document.getElementById("parsePaste").addEventListener("click", () => {
//   const text = document.getElementById("pasteArea").value;
//   parsedRows = parseTextData(text);
//   renderRows();
// });

// function parseTextData(text) {
//   if (!text) return [];

//   const lines = text.trim().split(/\r?\n/);

//   return lines.map(line => {
//     let cols;
//     if (line.includes("|||")) {
//       cols = line.split("|||");
//     } else if (line.includes("\t")) {
//       cols = line.split("\t");
//     } else {
//       cols = line.split(",");
//     }
//     return cols.map(c => c.trim());
//   });
// }

// function renderRows() {
//   const container = document.getElementById("rowsContainer");
//   container.innerHTML = "";

//   if (!parsedRows.length) {
//     container.textContent = "No rows parsed yet.";
//     return;
//   }

//   parsedRows.forEach((row, i) => {
//      console.log("Parsed row:", row);
//     const div = document.createElement("div");
//     div.className = "rowItem";
//     div.textContent = row.join(" | "); // display nicely instead of |||
//     div.dataset.index = i;
//     div.addEventListener("click", () => applyRow(i));
//     container.appendChild(div);
//   });
// }

// function applyRow(index) {
//   const row = parsedRows[index];
//   if (!row) return;

//   // Map columns: title, description, link, tags
//   const data = {
//     title: row[0] || "",
//     description: row[1] || "",
//     link: row[2] || "",
//     tags: row[3] || ""
//   };

//   chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//     chrome.tabs.sendMessage(tabs[0].id, { action: "applyRow", data }, (resp) => {
//       document.getElementById("status").textContent =
//         resp?.status || "Row applied.";
//     });
//   });
// }

// // Clear
// document.getElementById("clearAll").addEventListener("click", () => {
//   parsedRows = [];
//   document.getElementById("rowsContainer").innerHTML = "No rows parsed yet.";
//   document.getElementById("status").textContent = "";
// });

// popup.js (updated)
// Requires xlsx.full.min.js in extension folder for .xlsx support.

//

// window.__ROW_FILLER_ROWS = []; // expose for debugging

// // Debug function to test from console
// window.debugRowFiller = async function () {
//   console.log("RowFiller Debug Info:");
//   console.log("- DOM Elements:", {
//     fileInput: !!fileInput,
//     rowsContainer: !!rowsContainer,
//     statusDiv: !!statusDiv,
//     clearBtn: !!clearBtn,
//     refreshDataBtn: !!refreshDataBtn,
//     websiteStatusDiv: !!websiteStatusDiv,
//   });
//   console.log("- Current Data:", window.__ROW_FILLER_ROWS);
//   console.log("- Storage Data:", await loadFromStorage());
//   return {
//     domElements: {
//       fileInput: !!fileInput,
//       rowsContainer: !!rowsContainer,
//       statusDiv: !!statusDiv,
//       clearBtn: !!clearBtn,
//       refreshDataBtn: !!refreshDataBtn,
//       websiteStatusDiv: !!websiteStatusDiv,
//     },
//     currentData: window.__ROW_FILLER_ROWS,
//     storageData: await loadFromStorage(),
//   };
// };

// // DOM elements will be initialized after DOM is ready
// let fileInput,
//   pasteArea,
//   parsePasteBtn,
//   rowsContainer,
//   statusDiv,
//   clearBtn,
//   refreshDataBtn,
//   websiteStatusDiv;

// // Local storage key for persisting data
// const STORAGE_KEY = "rowfiller_parsed_data";

// function setStatus(msg, short = false) {
//   if (statusDiv) {
//     statusDiv.textContent = msg || "";
//     if (!short) setTimeout(() => (statusDiv.textContent = ""), 4000);
//   } else {
//     console.log("RowFiller: Status (statusDiv not ready):", msg);
//   }
// }

// // Function to check website support
// function checkWebsiteSupport() {
//   chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//     if (!tabs || !tabs[0]) {
//       updateWebsiteStatus("error", "❌", "No active tab found");
//       return;
//     }

//     const hostname = new URL(tabs[0].url).hostname;
//     const supportedSites = [
//       "pinterest.com",
//       "pixabay.com",
//       "canva.com",
//       "imgbb.com",
//       "imgur.com",
//       "diigo.com",
//       "500px.com",
//       "tumblr.com",
//       "gifyu.com",
//     ];

//     const isSupported = supportedSites.some((site) => hostname.includes(site));

//     if (isSupported) {
//       updateWebsiteStatus("supported", "✅", `Website supported: ${hostname}`);
//     } else {
//       updateWebsiteStatus(
//         "unsupported",
//         "❌",
//         `Website not supported: ${hostname}`
//       );
//     }
//   });
// }

// // Function to update website status display
// function updateWebsiteStatus(type, icon, text) {
//   if (!websiteStatusDiv) return;

//   const statusIndicator = websiteStatusDiv.querySelector(".status-indicator");
//   if (statusIndicator) {
//     const statusIcon = statusIndicator.querySelector(".status-icon");
//     const statusText = statusIndicator.querySelector(".status-text");

//     if (statusIcon) statusIcon.textContent = icon;
//     if (statusText) statusText.textContent = text;

//     // Update CSS classes
//     websiteStatusDiv.className = `website-status ${type}`;
//   }
// }

// // ---------- Local Storage Functions ----------
// function saveToStorage(data) {
//   return new Promise((resolve, reject) => {
//     try {
//       console.log(
//         "RowFiller: Attempting to save",
//         data.length,
//         "rows to storage"
//       );

//       // Try chrome.storage.local first
//       chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
//         if (chrome.runtime.lastError) {
//           console.error(
//             "RowFiller: Chrome storage save error:",
//             chrome.runtime.lastError
//           );
//           // Fallback to localStorage
//           try {
//             localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
//             console.log(
//               "RowFiller: ✅ Data saved to localStorage fallback",
//               data.length,
//               "rows"
//             );
//             setStatus(`Data saved to localStorage (${data.length} rows)`, true);
//             resolve(true);
//           } catch (localError) {
//             console.error(
//               "RowFiller: localStorage fallback also failed:",
//               localError
//             );
//             reject(localError);
//           }
//         } else {
//           console.log(
//             "RowFiller: ✅ Data saved to chrome.storage.local successfully",
//             data.length,
//             "rows"
//           );
//           setStatus(`Data saved to storage (${data.length} rows)`, true);
//           resolve(true);
//         }
//       });
//     } catch (error) {
//       console.error("RowFiller: Error saving to storage:", error);
//       reject(error);
//     }
//   });
// }

// function loadFromStorage() {
//   return new Promise((resolve) => {
//     try {
//       console.log("RowFiller: Attempting to load data from storage");
//       chrome.storage.local.get([STORAGE_KEY], (result) => {
//         if (chrome.runtime.lastError) {
//           console.error(
//             "RowFiller: Chrome storage load error:",
//             chrome.runtime.lastError
//           );
//           // Fallback to localStorage
//           try {
//             const localData = localStorage.getItem(STORAGE_KEY);
//             if (localData) {
//               const data = JSON.parse(localData);
//               console.log(
//                 "RowFiller: ✅ Data loaded from localStorage fallback",
//                 data.length,
//                 "rows"
//               );
//               resolve(data);
//             } else {
//               console.log("RowFiller: No data found in localStorage fallback");
//               resolve([]);
//             }
//           } catch (localError) {
//             console.error(
//               "RowFiller: localStorage fallback also failed:",
//               localError
//             );
//             resolve([]);
//           }
//         } else {
//           const data = result[STORAGE_KEY] || [];
//           console.log(
//             "RowFiller: ✅ Data loaded from chrome.storage.local",
//             data.length,
//             "rows"
//           );
//           resolve(data);
//         }
//       });
//     } catch (error) {
//       console.error("RowFiller: Error loading from storage:", error);
//       resolve([]);
//     }
//   });
// }

// function clearStorage() {
//   return new Promise((resolve) => {
//     try {
//       chrome.storage.local.remove([STORAGE_KEY], () => {
//         if (chrome.runtime.lastError) {
//           console.error(
//             "RowFiller: Chrome storage clear error:",
//             chrome.runtime.lastError
//           );
//           // Fallback to localStorage
//           try {
//             localStorage.removeItem(STORAGE_KEY);
//             console.log(
//               "RowFiller: ✅ localStorage fallback cleared successfully"
//             );
//             resolve(true);
//           } catch (localError) {
//             console.error(
//               "RowFiller: localStorage fallback clear also failed:",
//               localError
//             );
//             resolve(false);
//           }
//         } else {
//           console.log("RowFiller: ✅ Chrome storage cleared successfully");
//           // Also clear localStorage fallback
//           try {
//             localStorage.removeItem(STORAGE_KEY);
//           } catch (e) {}
//           resolve(true);
//         }
//       });
//     } catch (error) {
//       console.error("RowFiller: Error clearing storage:", error);
//       resolve(false);
//     }
//   });
// }

// function addDragDropToRow(div, rowIndex) {
//   div.addEventListener("dragover", (e) => {
//     e.preventDefault();
//     div.style.borderColor = "#e879f9"; // highlight on dragover
//   });

//   div.addEventListener("dragleave", (e) => {
//     e.preventDefault();
//     div.style.borderColor = ""; // remove highlight
//   });

//   div.addEventListener("drop", (e) => {
//     e.preventDefault();
//     div.style.borderColor = "";

//     const files = e.dataTransfer.files;
//     if (!files || files.length === 0) {
//       setStatus("❌ No files dropped");
//       return;
//     }

//     const file = files[0];
//     if (!file.type.startsWith("image/")) {
//       setStatus("❌ Please drop an image file");
//       return;
//     }

//     const reader = new FileReader();
//     reader.onload = function (event) {
//       const base64Image = event.target.result; // base64 string

//       // Save image data to the row
//       window.__ROW_FILLER_ROWS[rowIndex].imageData = base64Image;

//       // Update storage
//       saveToStorage(window.__ROW_FILLER_ROWS)
//         .then(() => {
//           setStatus(`✅ Image saved to row ${rowIndex + 1}`);
//           renderRows(window.__ROW_FILLER_ROWS); // re-render to show image preview
//         })
//         .catch((err) => {
//           console.error("Error saving image data:", err);
//           setStatus("❌ Error saving image data");
//         });
//     };
//     reader.readAsDataURL(file);
//   });
// }

// // ---------- File handling ----------
// // Event listener will be added in DOMContentLoaded
// async function handleFile(e) {
//   const f = e.target.files && e.target.files[0];
//   if (!f) {
//     setStatus("No file selected");
//     return;
//   }
//   try {
//     const ab = await f.arrayBuffer();
//     const workbook = XLSX.read(new Uint8Array(ab), { type: "array" });
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }); // array of arrays
//     processTableRows(rows);
//   } catch (err) {
//     console.error("Error reading file:", err);
//     setStatus("Error reading file (check console).");
//   }
// }

// // ---------- Paste handling ----------
// // Event listener will be added in DOMContentLoaded if pasteArea exists

// function parseTextData(text) {
//   const lines = text
//     .split(/\r?\n/)
//     .map((l) => l.trim())
//     .filter((l) => l !== "");
//   const rows = lines.map((line) => {
//     // priority: ||| then tab then comma
//     let cols;
//     if (line.includes("|||")) cols = line.split("|||");
//     else if (line.includes("\t")) cols = line.split("\t");
//     else cols = line.split(",");
//     return cols.map((c) => c.trim());
//   });
//   return rows;
// }

// // ---------- Core: detect header, build objects ----------
// function processTableRows(rows) {
//   if (!rows || !rows.length) {
//     setStatus("No rows found");
//     return;
//   }

//   // find header row index (first row containing one of known header keywords)
//   let headerIdx = -1;
//   const headerCandidates = [
//     "title",
//     "description",
//     "desc",
//     "keyword",
//     "target page",
//     "target",
//     "link",
//     "url",
//     "id",
//   ];
//   for (let i = 0; i < Math.min(rows.length, 7); i++) {
//     const rowLower = rows[i].map((c) => ("" + c).toLowerCase()).join("|");
//     if (headerCandidates.some((h) => rowLower.includes(h))) {
//       headerIdx = i;
//       break;
//     }
//   }

//   let dataRows = rows;
//   let header = null;
//   if (headerIdx >= 0) {
//     header = rows[headerIdx].map((h) =>
//       ("" + h).toString().trim().toLowerCase()
//     );
//     dataRows = rows.slice(headerIdx + 1);
//     console.log("RowFiller: detected header at row", headerIdx, header);
//     setStatus("Header detected. Mapping columns...", true);
//   } else {
//     // no header: try first row as sample? we'll treat all rows as data and fallback mapping later
//     console.log("RowFiller: no header row detected. Using default ordering.");
//     setStatus("No header detected. Using default column order.", true);
//   }

//   // build parsedRows as objects {title, description, link, tags}
//   const parsed = dataRows
//     .filter((r) => r && r.some((cell) => ("" + cell).trim() !== "")) // skip empty lines
//     .map((r) => {
//       // ensure r is array
//       const row = r;
//       // find indices if header exists
//       let idxTitle = -1,
//         idxDesc = -1,
//         idxLink = -1,
//         idxTags = -1;
//       if (header) {
//         header.forEach((h, i) => {
//           if (/^id$|(^| )id($| )/.test(h)) {
//             /*ignore*/
//           }
//           if (h.includes("title")) idxTitle = idxTitle >= 0 ? idxTitle : i;
//           else if (h.includes("desc")) idxDesc = idxDesc >= 0 ? idxDesc : i;
//           else if (h.includes("description"))
//             idxDesc = idxDesc >= 0 ? idxDesc : i;
//           else if (
//             h.includes("target") ||
//             h.includes("link") ||
//             h.includes("url") ||
//             h.includes("target page")
//           )
//             idxLink = idxLink >= 0 ? idxLink : i;
//           else if (
//             h.includes("keyword") ||
//             h.includes("tag") ||
//             h.includes("keywords")
//           )
//             idxTags = idxTags >= 0 ? idxTags : i;
//         });
//       }

//       // fallback rules if index not found:
//       const title =
//         (idxTitle >= 0 ? row[idxTitle] : row[3] || row[1] || row[0] || "") ||
//         "";
//       const description =
//         (idxDesc >= 0 ? row[idxDesc] : row[4] || row[2] || "") || "";
//       const link = (idxLink >= 0 ? row[idxLink] : row[2] || "") || "";
//       const tags = (idxTags >= 0 ? row[idxTags] : row[1] || "") || "";

//       return {
//         title: ("" + title).trim(),
//         description: ("" + description).trim(),
//         link: ("" + link).trim(),
//         tags: ("" + tags).trim(),
//       };
//     });

//   window.__ROW_FILLER_ROWS = parsed;

//   // Save to local storage and handle result
//   saveToStorage(parsed)
//     .then(() => {
//       console.log("RowFiller: Storage save completed successfully");
//     })
//     .catch((error) => {
//       console.error("RowFiller: Storage save failed:", error);
//       setStatus("Error saving to storage - data may not persist", true);
//     });

//   renderRows(parsed);
//   setStatus(`Parsed ${parsed.length} rows`, true);
//   console.log("RowFiller parsed rows:", parsed);
// }

// // ---------- render ----------
// function renderRows(rows) {
//   console.log("RowFiller: renderRows called with:", rows);
//   console.log("RowFiller: rowsContainer element:", rowsContainer);

//   if (!rowsContainer) {
//     console.error("RowFiller: rowsContainer not ready!");
//     return;
//   }

//   rowsContainer.innerHTML = "";
//   if (!rows || !rows.length) {
//     console.log("RowFiller: No rows to render, showing empty message");
//     rowsContainer.innerHTML = `
//       <div style="text-align: center; padding: 40px 20px; color: #cbd5e0;">
//         <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
//         <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px; color: #e2e8f0;">No data loaded</div>
//         <div style="font-size: 13px; color: #a0aec0;">Upload a file to get started</div>
//       </div>
//     `;
//     return;
//   }

//     rows.forEach((r, i) => {
//     const div = document.createElement("div");
//     div.className = "row-item";
//     div.dataset.i = i;
//     // Image preview HTML
//     const imgHtml = r.imageData
//       ? `<img src="${r.imageData}" alt="Image" style="max-width: 100px; max-height: 60px; border-radius: 8px; margin-bottom: 8px; display: block;">`
//       : "";
//     div.innerHTML = `
//       ${imgHtml}
//       <div class="row-title">${i + 1}. ${escapeHtml(r.title || "Untitled")}</div>
//       ${r.description ? `<div class="row-description">${escapeHtml(r.description)}</div>` : ""}
//       ${r.link ? `<div class="row-link">🔗 ${escapeHtml(r.link)}</div>` : ""}
//       ${r.tags ? `<div class="row-tags">🏷️ ${escapeHtml(r.tags)}</div>` : ""}
//     `;
//     // Add drag & drop listeners for image
//     addDragDropToRow(div, i);
//     // ... existing click listener for autofill ...
//   });

//   console.log("RowFiller: Rendering", rows.length, "rows");
//   rows.forEach((r, i) => {
//     console.log("RowFiller: Rendering row", i, ":", r);
//     const div = document.createElement("div");
//     div.className = "row-item";
//     div.dataset.i = i;

//     // Create highlighted content with proper styling
//     const title = escapeHtml(r.title || "Untitled");
//     const description = escapeHtml(r.description || "");
//     const link = escapeHtml(r.link || "");
//     const tags = escapeHtml(r.tags || "");

//     div.innerHTML = `
//       <div class="row-title">${i + 1}. ${title}</div>
//       ${description ? `<div class="row-description">${description}</div>` : ""}
//       ${link ? `<div class="row-link">🔗 ${link}</div>` : ""}
//       ${tags ? `<div class="row-tags">🏷️ ${tags}</div>` : ""}
//     `;

//     div.addEventListener("click", () => {
//       // Remove previous selection
//       document.querySelectorAll(".row-item").forEach((item) => {
//         item.classList.remove("selected");
//       });

//       // Add selection to clicked item
//       div.classList.add("selected");

//       // Apply the row
//       applyRow(i);
//     });

//     rowsContainer.appendChild(div);
//   });
//   console.log("RowFiller: Finished rendering rows");
// }

// function escapeHtml(s) {
//   return ("" + s).replace(
//     /[&<>"]/g,
//     (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
//   );
// }

// // ---------- apply row (send object to current tab) ----------
// function applyRow(idx) {
//   const rows = window.__ROW_FILLER_ROWS || [];
//   const r = rows[idx];
//   if (!r) {
//     setStatus("❌ Invalid row selected");
//     return;
//   }
//   console.log("RowFiller applying row:", idx + 1, r);

//   // Show loading status
//   setStatus("🚀 Applying data to page...", true);

//   chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//     if (!tabs || !tabs[0]) {
//       setStatus("❌ No active tab found");
//       return;
//     }
//     chrome.tabs.sendMessage(
//       tabs[0].id,
//       { action: "applyRow", data: r },
//       (resp) => {
//         console.log("RowFiller: content script response:", resp);
//         if (resp && resp.status) {
//           if (resp.status.includes("not supported")) {
//             setStatus(
//               "❌ Website not supported - Please use a supported website",
//               true
//             );
//             // Update website status to show unsupported
//             updateWebsiteStatus("unsupported", "❌", "Website not supported");
//           } else {
//             setStatus(`✅ ${resp.status}`, true);
//             // Show success animation
//             setTimeout(() => {
//               setStatus(
//                 `🎉 Row ${idx + 1} applied: "${r.title || "Untitled"}"`,
//                 true
//               );
//             }, 500);
//           }
//         } else {
//           setStatus("✅ Data applied successfully!", true);
//           // Show success animation
//           setTimeout(() => {
//             setStatus(
//               `🎉 Row ${idx + 1} applied: "${r.title || "Untitled"}"`,
//               true
//             );
//           }, 500);
//         }
//       }
//     );
//   });
// }

// // ---------- Event listeners will be added in DOMContentLoaded ----------

// // ---------- Initialize: Load data from storage on popup open ----------
// document.addEventListener("DOMContentLoaded", async () => {
//   try {
//     console.log("RowFiller: DOM Content Loaded - Initializing...");

//     // Initialize DOM elements
//     fileInput = document.getElementById("fileInput");
//     pasteArea = document.getElementById("pasteArea");
//     parsePasteBtn = document.getElementById("parsePaste");
//     rowsContainer = document.getElementById("rowsContainer");
//     statusDiv = document.getElementById("status");
//     clearBtn = document.getElementById("clearAll");
//     refreshDataBtn = document.getElementById("refreshData");
//     websiteStatusDiv = document.getElementById("websiteStatus");

//     console.log("RowFiller: DOM elements initialized:");
//     console.log("- fileInput:", fileInput);
//     console.log("- rowsContainer:", rowsContainer);
//     console.log("- statusDiv:", statusDiv);
//     console.log("- clearBtn:", clearBtn);
//     console.log("- refreshDataBtn:", refreshDataBtn);
//     console.log("- websiteStatusDiv:", websiteStatusDiv);

//     // Set up event listeners
//     if (fileInput) {
//       fileInput.addEventListener("change", handleFile, false);
//       console.log("RowFiller: File input event listener added");
//     }

//     if (clearBtn) {
//       clearBtn.addEventListener("click", async () => {
//         console.log("RowFiller: Clear button clicked");
//         window.__ROW_FILLER_ROWS = [];
//         const cleared = await clearStorage();
//         if (cleared) {
//           setStatus("✅ All data cleared from memory and storage");
//           console.log("RowFiller: Data cleared successfully");
//         } else {
//           setStatus("⚠️ Data cleared from memory, but storage clear failed");
//           console.log("RowFiller: Storage clear failed");
//         }
//         if (rowsContainer) {
//           rowsContainer.innerHTML = "No rows parsed yet.";
//         }
//         console.log("RowFiller: UI cleared");
//       });
//       console.log("RowFiller: Clear button event listener added");
//     }

//     if (refreshDataBtn) {
//       refreshDataBtn.addEventListener("click", async () => {
//         setStatus("Refreshing data from storage...", true);
//         try {
//           const savedData = await loadFromStorage();
//           console.log(
//             "RowFiller: Refresh - Raw saved data from storage:",
//             savedData
//           );
//           if (savedData && savedData.length > 0) {
//             window.__ROW_FILLER_ROWS = savedData;
//             renderRows(savedData);
//             setStatus(
//               `✅ Refreshed ${savedData.length} rows from storage`,
//               true
//             );
//           } else {
//             setStatus("No data found in storage", true);
//             if (rowsContainer) {
//               rowsContainer.innerHTML = "No rows parsed yet.";
//             }
//           }
//         } catch (error) {
//           console.error("RowFiller: Error refreshing data:", error);
//           setStatus("Error refreshing data from storage", true);
//         }
//       });
//       console.log("RowFiller: Refresh data button event listener added");
//     }

//     // Wait a bit to ensure DOM is fully ready
//     await new Promise((resolve) => setTimeout(resolve, 100));

//     // Check website support
//     console.log("RowFiller: Checking website support...");
//     checkWebsiteSupport();

//     // Load saved data
//     console.log("RowFiller: Loading saved data from storage...");
//     const savedData = await loadFromStorage();
//     console.log("RowFiller: Raw saved data from storage:", savedData);

//     if (savedData && savedData.length > 0) {
//       window.__ROW_FILLER_ROWS = savedData;
//       console.log("RowFiller: Setting window.__ROW_FILLER_ROWS to:", savedData);
//       renderRows(savedData);
//       setStatus(`✅ Loaded ${savedData.length} rows from storage`, true);
//       console.log(
//         "RowFiller: Successfully loaded and displayed",
//         savedData.length,
//         "rows"
//       );
//     } else {
//       setStatus("No saved data found. Upload a file to get started.", true);
//       console.log("RowFiller: No saved data found");
//     }
//   } catch (error) {
//     console.error("RowFiller: Error initializing:", error);
//     setStatus("Error loading saved data", true);
//   }
// });
// // ---------- End of popup.js ----------

// window.__ROW_FILLER_ROWS = []; // expose for debugging

// // DOM elements
// let fileInput,
//   rowsContainer,
//   statusDiv,
//   clearBtn,
//   refreshDataBtn,
//   websiteStatusDiv;

// // Local storage key
// const STORAGE_KEY = "rowfiller_parsed_data";

// // ---------- Status ----------
// function setStatus(msg, short = false) {
//   if (statusDiv) {
//     statusDiv.textContent = msg || "";
//     if (!short) setTimeout(() => (statusDiv.textContent = ""), 4000);
//   } else {
//     console.log("RowFiller: Status:", msg);
//   }
// }

// function checkWebsiteSupport() {
//   chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//     if (!tabs || !tabs[0]) {
//       updateWebsiteStatus("error", "❌", "No active tab found");
//       return;
//     }

//     const tabUrl = tabs[0].url || "";
//     let hostname = "unknown";
//     try {
//       hostname = new URL(tabUrl).hostname;
//     } catch (e) {}

//     const supportedSites = [
//       "pinterest.com",
//       "pixabay.com",
//       "canva.com",
//       "imgbb.com",
//       "imgur.com",
//       "diigo.com",
//       "500px.com",
//       "tumblr.com",
//       "gifyu.com",
//       "medium.com",
//       "penzu.com",
//     ];

//     const matched = supportedSites.find((site) => hostname.includes(site));
//     if (matched) {
//       updateWebsiteStatus("supported", "✅", `Website supported: ${hostname}`);
//     } else {
//       updateWebsiteStatus(
//         "unsupported",
//         "❌",
//         `Website not supported: ${hostname}`
//       );
//     }
//   });
// }

// function updateWebsiteStatus(type, icon, text) {
//   if (!websiteStatusDiv) return;
//   const statusIcon = websiteStatusDiv.querySelector(".status-icon");
//   const statusText = websiteStatusDiv.querySelector(".status-text");
//   if (statusIcon) statusIcon.textContent = icon;
//   if (statusText) statusText.textContent = text;
//   websiteStatusDiv.className = `website-status ${type}`;
// }

// // ---------- Storage ----------
// function saveToStorage(data) {
//   return new Promise((resolve) => {
//     chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
//       if (chrome.runtime.lastError) {
//         // fallback
//         localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
//         setStatus(`Saved to localStorage (${data.length} rows)`, true);
//       } else {
//         setStatus(`Saved to storage (${data.length} rows)`, true);
//       }
//       resolve(true);
//     });
//   });
// }

// function loadFromStorage() {
//   return new Promise((resolve) => {
//     chrome.storage.local.get([STORAGE_KEY], (result) => {
//       if (chrome.runtime.lastError) {
//         const localData = localStorage.getItem(STORAGE_KEY);
//         resolve(localData ? JSON.parse(localData) : []);
//       } else {
//         resolve(result[STORAGE_KEY] || []);
//       }
//     });
//   });
// }

// function clearStorage() {
//   return new Promise((resolve) => {
//     chrome.storage.local.remove([STORAGE_KEY], () => {
//       localStorage.removeItem(STORAGE_KEY);
//       resolve(true);
//     });
//   });
// }

// // ---------- File handling ----------
// async function handleFile(e) {
//   const f = e.target.files && e.target.files[0];
//   if (!f) return setStatus("No file selected");
//   try {
//     const ab = await f.arrayBuffer();
//     const workbook = XLSX.read(new Uint8Array(ab), { type: "array" });
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
//     processTableRows(rows);
//   } catch (err) {
//     console.error("Error reading file:", err);
//     setStatus("Error reading file (check console)");
//   }
// }

// // ---------- Parse table ----------
// function processTableRows(rows) {
//   if (!rows || !rows.length) return setStatus("No rows found");

//   let headerIdx = -1;
//   const headerCandidates = [
//     "title",
//     "description",
//     "desc",
//     "keyword",
//     "target",
//     "link",
//     "url",
//   ];
//   for (let i = 0; i < Math.min(rows.length, 7); i++) {
//     const rowLower = rows[i].map((c) => ("" + c).toLowerCase()).join("|");
//     if (headerCandidates.some((h) => rowLower.includes(h))) {
//       headerIdx = i;
//       break;
//     }
//   }

//   let header = null,
//     dataRows = rows;
//   if (headerIdx >= 0) {
//     header = rows[headerIdx].map((h) => ("" + h).trim().toLowerCase());
//     dataRows = rows.slice(headerIdx + 1);
//     setStatus("Header detected", true);
//   }

//   const parsed = dataRows
//     .filter((r) => r.some((c) => ("" + c).trim() !== ""))
//     .map((r) => {
//       let title = r[0] || "",
//         description = r[1] || "",
//         link = r[2] || "",
//         tags = r[3] || "";
//       if (header) {
//         header.forEach((h, i) => {
//           if (h.includes("title")) title = r[i];
//           if (h.includes("desc")) description = r[i];
//           if (h.includes("link") || h.includes("url") || h.includes("target"))
//             link = r[i];
//           if (h.includes("tag") || h.includes("keyword")) tags = r[i];
//         });
//       }
//       return {
//         title: (title || "").toString().trim(),
//         description: (description || "").toString().trim(),
//         link: (link || "").toString().trim(),
//         tags: (tags || "").toString().trim(),
//         imageData: null, // ✅ placeholder for dropped image
//       };
//     });

//   window.__ROW_FILLER_ROWS = parsed;
//   saveToStorage(parsed);
//   renderRows(parsed);
//   setStatus(`Parsed ${parsed.length} rows`, true);
// }

// // ---------- Drag & Drop Image ----------
// function addDragDropToRow(div, rowIndex) {
//   div.addEventListener("dragover", (e) => {
//     e.preventDefault();
//     div.style.borderColor = "#e879f9";
//   });
//   div.addEventListener("dragleave", (e) => {
//     e.preventDefault();
//     div.style.borderColor = "";
//   });
//   div.addEventListener("drop", async (e) => {
//     e.preventDefault();
//     div.style.borderColor = "";
//     const files = e.dataTransfer.files;
//     if (files && files.length > 0) {
//       const file = files[0];
//       if (!file.type.startsWith("image/"))
//         return setStatus("❌ Please drop an image");
//       const reader = new FileReader();
//       reader.onload = (ev) => {
//         window.__ROW_FILLER_ROWS[rowIndex].imageData = ev.target.result;
//         saveToStorage(window.__ROW_FILLER_ROWS);
//         renderRows(window.__ROW_FILLER_ROWS);
//         setStatus(`✅ Image saved to row ${rowIndex + 1}`);
//       };
//       reader.readAsDataURL(file);
//       return;
//     }
//     // If dropped from another page
//     const url = e.dataTransfer.getData("text/uri-list") || "";
//     if (!url) return setStatus("❌ Could not get image URL");
//     try {
//       const res = await fetch(url);
//       const blob = await res.blob();
//       const reader = new FileReader();
//       reader.onloadend = () => {
//         window.__ROW_FILLER_ROWS[rowIndex].imageData = reader.result;
//         saveToStorage(window.__ROW_FILLER_ROWS);
//         renderRows(window.__ROW_FILLER_ROWS);
//         setStatus(`✅ Image saved to row ${rowIndex + 1}`);
//       };
//       reader.readAsDataURL(blob);
//     } catch (err) {
//       console.error("Image fetch failed", err);
//       setStatus("❌ Failed to fetch dropped image");
//     }
//   });
// }

// // ---------- Render Rows ----------
// function renderRows(rows) {
//   rowsContainer.innerHTML = "";
//   if (!rows || !rows.length) {
//     rowsContainer.innerHTML = `<div style="text-align:center;color:#888;padding:20px;">No rows parsed yet</div>`;
//     return;
//   }
//   rows.forEach((r, i) => {
//     const div = document.createElement("div");
//     div.className = "row-item";
//     div.dataset.i = i;
//     div.innerHTML = `
//       ${
//         r.imageData
//           ? `<img src="${r.imageData}" style="max-height:60px;max-width:100px;margin-bottom:5px;border-radius:6px;display:block;">`
//           : ""
//       }
//       <div class="row-title">${i + 1}. ${escapeHtml(
//       r.title || "Untitled"
//     )}</div>
//       ${
//         r.description
//           ? `<div class="row-description">${escapeHtml(r.description)}</div>`
//           : ""
//       }
//       ${r.link ? `<div class="row-link">🔗 ${escapeHtml(r.link)}</div>` : ""}
//       ${r.tags ? `<div class="row-tags">🏷️ ${escapeHtml(r.tags)}</div>` : ""}
//     `;
//     addDragDropToRow(div, i);
//     div.addEventListener("click", () => {
//       document
//         .querySelectorAll(".row-item")
//         .forEach((el) => el.classList.remove("selected"));
//       div.classList.add("selected");
//       applyRow(i);
//     });
//     rowsContainer.appendChild(div);
//   });
// }
// function escapeHtml(s) {
//   return ("" + s).replace(
//     /[&<>"]/g,
//     (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
//   );
// }

// // ---------- Apply ----------
// function applyRow(i) {
//   const r = window.__ROW_FILLER_ROWS[i];
//   if (!r) return setStatus("❌ Invalid row");
//   setStatus("🚀 Applying...");
//   chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//     if (!tabs[0]) return setStatus("❌ No active tab");
//     chrome.tabs.sendMessage(
//       tabs[0].id,
//       { action: "applyRow", data: r },
//       (resp) => {
//         if (resp && resp.status) setStatus(`✅ ${resp.status}`, true);
//         else setStatus("✅ Applied!", true);
//       }
//     );
//   });
// }

// // ---------- Auto Load & Sync ----------
// async function loadAndRender() {
//   const saved = await loadFromStorage();
//   window.__ROW_FILLER_ROWS = saved;
//   renderRows(saved);
//   if (saved.length)
//     setStatus(`✅ Loaded ${saved.length} rows from storage`, true);
//   else setStatus("No saved data found. Upload a file to get started.", true);
// }

// document.getElementById("saveProfile").addEventListener("click", () => {
//   const profile = {
//     fullname: document.getElementById("fullname").value,
//     username: document.getElementById("username").value,
//     email: document.getElementById("email").value,
//     emailPassword: document.getElementById("emailPassword").value,
//     submissionPassword: document.getElementById("submissionPassword").value,
//     activePassword: document.querySelector(
//       'input[name="activePassword"]:checked'
//     ).value,
//   };
//   chrome.storage.local.set({ profile }, () => {
//     document.getElementById("status").innerText = "✅ Profile saved!";
//   });
// });

// // load profile on popup open
// chrome.storage.local.get("profile", (res) => {
//   if (res.profile) {
//     const profile = res.profile;
//     document.getElementById("fullname").value = profile.fullname || "";
//     document.getElementById("username").value = profile.username || "";
//     document.getElementById("email").value = profile.email || "";
//     document.getElementById("emailPassword").value =
//       profile.emailPassword || "";
//     document.getElementById("submissionPassword").value =
//       profile.submissionPassword || "";
//     if (profile.activePassword) {
//       document.querySelector(
//         `input[name="activePassword"][value="${profile.activePassword}"]`
//       ).checked = true;
//     }
//   }
// });

// // Save profile with two passwords and the chosen radio
// document.getElementById("saveProfile").addEventListener("click", () => {
//   const profile = {
//     fullname: document.getElementById("fullname").value || "",
//     username: document.getElementById("username").value || "",
//     email: document.getElementById("email").value || "",
//     emailPassword: document.getElementById("emailPassword").value || "",
//     submissionPassword:
//       document.getElementById("submissionPassword").value || "",
//     activePassword:
//       (document.querySelector('input[name="activePassword"]:checked') || {})
//         .value || "emailPassword",
//   };
//   chrome.storage.local.set({ profile }, () => {
//     const st = document.getElementById("status");
//     if (st) {
//       st.innerText = "✅ Profile saved!";
//       setTimeout(() => (st.innerText = ""), 2000);
//     }
//   });
// });

// // Load profile when popup opens
// chrome.storage.local.get("profile", (res) => {
//   if (res.profile) {
//     const p = res.profile;
//     document.getElementById("fullname").value = p.fullname || "";
//     document.getElementById("username").value = p.username || "";
//     document.getElementById("email").value = p.email || "";
//     document.getElementById("emailPassword").value = p.emailPassword || "";
//     document.getElementById("submissionPassword").value =
//       p.submissionPassword || "";

//     const active =
//       p.activePassword ||
//       (p.emailPassword
//         ? "emailPassword"
//         : p.submissionPassword
//         ? "submissionPassword"
//         : "emailPassword");
//     const radio = document.querySelector(
//       `input[name="activePassword"][value="${active}"]`
//     );
//     if (radio) radio.checked = true;
//   }
// });

// // UX nicety: focusing a password input auto-selects its radio
// ["emailPassword", "submissionPassword"].forEach((id) => {
//   const el = document.getElementById(id);
//   if (el) {
//     el.addEventListener("focus", () => {
//       const r = document.querySelector(
//         `input[name="activePassword"][value="${id}"]`
//       );
//       if (r) r.checked = true;
//     });
//   }
// });

// // Listen for tab changes
// chrome.tabs.onActivated.addListener(() => {
//   checkWebsiteSupport();
// });

// // Listen for tab updates (when URL changes)
// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//   if (tab.active && changeInfo.status === "complete") {
//     checkWebsiteSupport();
//   }
// });

// // Listen for storage changes (sync across tabs/panels)
// chrome.storage.onChanged.addListener((changes, area) => {
//   if (area === "local" && changes[STORAGE_KEY]) {
//     const newData = changes[STORAGE_KEY].newValue || [];
//     window.__ROW_FILLER_ROWS = newData;
//     renderRows(newData);
//     setStatus(`🔄 Synced ${newData.length} rows from storage`, true);
//   }
// });

// // ---------- Init ----------
// document.addEventListener("DOMContentLoaded", async () => {
//   fileInput = document.getElementById("fileInput");
//   rowsContainer = document.getElementById("rowsContainer");
//   statusDiv = document.getElementById("status");
//   clearBtn = document.getElementById("clearAll");
//   refreshDataBtn = document.getElementById("refreshData");
//   websiteStatusDiv = document.getElementById("websiteStatus");

//   if (fileInput) fileInput.addEventListener("change", handleFile);
//   if (clearBtn)
//     clearBtn.addEventListener("click", async () => {
//       window.__ROW_FILLER_ROWS = [];
//       await clearStorage();
//       renderRows([]);
//       setStatus("✅ All data cleared");
//     });
//   if (refreshDataBtn) refreshDataBtn.addEventListener("click", loadAndRender);

//   await new Promise((r) => setTimeout(r, 100));
//   checkWebsiteSupport();
//   await loadAndRender();
// });

// popup.js
window.__ROW_FILLER_ROWS = []; // expose for debugging

// DOM elements
let fileInput,
  rowsContainer,
  statusDiv,
  clearBtn,
  refreshDataBtn,
  websiteStatusDiv;

// Local storage key
const STORAGE_KEY = "rowfiller_parsed_data";

// ---------- Status ----------
function setStatus(msg, short = false) {
  if (statusDiv) {
    statusDiv.textContent = msg || "";
    if (!short) setTimeout(() => (statusDiv.textContent = ""), 4000);
  } else {
    console.log("RowFiller: Status:", msg);
  }
}

function checkWebsiteSupport() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) {
      updateWebsiteStatus("error", "❌", "No active tab found");
      return;
    }

    const tabUrl = tabs[0].url || "";
    let hostname = "unknown";
    try {
      hostname = new URL(tabUrl).hostname;
    } catch (e) {}

    const supportedSites = [
      "pinterest.com",
      "pixabay.com",
      "canva.com",
      "imgbb.com",
      "imgur.com",
      "diigo.com",
      "500px.com",
      "tumblr.com",
      "gifyu.com",
      "medium.com",
      "penzu.com",
    ];

    const matched = supportedSites.find((site) => hostname.includes(site));
    if (matched) {
      updateWebsiteStatus("supported", "✅", `Website supported: ${hostname}`);
    } else {
      updateWebsiteStatus(
        "unsupported",
        "❌",
        `Website not supported: ${hostname}`
      );
    }
  });
}

function updateWebsiteStatus(type, icon, text) {
  if (!websiteStatusDiv) return;
  const statusIcon = websiteStatusDiv.querySelector(".status-icon");
  const statusText = websiteStatusDiv.querySelector(".status-text");
  if (statusIcon) statusIcon.textContent = icon;
  if (statusText) statusText.textContent = text;
  websiteStatusDiv.className = `website-status ${type}`;
}

// ---------- Storage ----------
function saveToStorage(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
      if (chrome.runtime.lastError) {
        // fallback
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setStatus(`Saved to localStorage (${data.length} rows)`, true);
      } else {
        setStatus(`Saved to storage (${data.length} rows)`, true);
      }
      resolve(true);
    });
  });
}

function loadFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        const localData = localStorage.getItem(STORAGE_KEY);
        resolve(localData ? JSON.parse(localData) : []);
      } else {
        resolve(result[STORAGE_KEY] || []);
      }
    });
  });
}

function clearStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.remove([STORAGE_KEY], () => {
      localStorage.removeItem(STORAGE_KEY);
      resolve(true);
    });
  });
}

// ---------- File handling ----------
async function handleFile(e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return setStatus("No file selected");
  try {
    const ab = await f.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(ab), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    processTableRows(rows);
  } catch (err) {
    console.error("Error reading file:", err);
    setStatus("Error reading file (check console)");
  }
}

// ---------- Parse table ----------
function processTableRows(rows) {
  if (!rows || !rows.length) return setStatus("No rows found");

  let headerIdx = -1;
  const headerCandidates = [
    "title",
    "description",
    "desc",
    "keyword",
    "target",
    "link",
    "url",
  ];
  for (let i = 0; i < Math.min(rows.length, 7); i++) {
    const rowLower = rows[i].map((c) => ("" + c).toLowerCase()).join("|");
    if (headerCandidates.some((h) => rowLower.includes(h))) {
      headerIdx = i;
      break;
    }
  }

  let header = null,
    dataRows = rows;
  if (headerIdx >= 0) {
    header = rows[headerIdx].map((h) => ("" + h).trim().toLowerCase());
    dataRows = rows.slice(headerIdx + 1);
    setStatus("Header detected", true);
  }

  const parsed = dataRows
    .filter((r) => r.some((c) => ("" + c).trim() !== ""))
    .map((r) => {
      let title = r[0] || "",
        description = r[1] || "",
        link = r[2] || "",
        tags = r[3] || "";
      if (header) {
        header.forEach((h, i) => {
          if (h.includes("title")) title = r[i];
          if (h.includes("desc")) description = r[i];
          if (h.includes("link") || h.includes("url") || h.includes("target"))
            link = r[i];
          if (h.includes("tag") || h.includes("keyword")) tags = r[i];
        });
      }
      return {
        title: (title || "").toString().trim(),
        description: (description || "").toString().trim(),
        link: (link || "").toString().trim(),
        tags: (tags || "").toString().trim(),
        imageData: null,
      };
    });

  window.__ROW_FILLER_ROWS = parsed;
  saveToStorage(parsed);
  renderRows(parsed);
  setStatus(`Parsed ${parsed.length} rows`, true);
}

// ---------- Drag & Drop Image ----------
function addDragDropToRow(div, rowIndex) {
  div.addEventListener("dragover", (e) => {
    e.preventDefault();
    div.style.borderColor = "#e879f9";
  });
  div.addEventListener("dragleave", (e) => {
    e.preventDefault();
    div.style.borderColor = "";
  });
  div.addEventListener("drop", async (e) => {
    e.preventDefault();
    div.style.borderColor = "";
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.type.startsWith("image/"))
        return setStatus("❌ Please drop an image");
      const reader = new FileReader();
      reader.onload = (ev) => {
        window.__ROW_FILLER_ROWS[rowIndex].imageData = ev.target.result;
        saveToStorage(window.__ROW_FILLER_ROWS);
        renderRows(window.__ROW_FILLER_ROWS);
        setStatus(`✅ Image saved to row ${rowIndex + 1}`);
      };
      reader.readAsDataURL(file);
      return;
    }
    // If dropped from another page
    const url = e.dataTransfer.getData("text/uri-list") || "";
    if (!url) return setStatus("❌ Could not get image URL");
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        window.__ROW_FILLER_ROWS[rowIndex].imageData = reader.result;
        saveToStorage(window.__ROW_FILLER_ROWS);
        renderRows(window.__ROW_FILLER_ROWS);
        setStatus(`✅ Image saved to row ${rowIndex + 1}`);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Image fetch failed", err);
      setStatus("❌ Failed to fetch dropped image");
    }
  });
}

// ---------- Render Rows ----------
function renderRows(rows) {
  rowsContainer.innerHTML = "";
  if (!rows || !rows.length) {
    rowsContainer.innerHTML = `<div style="text-align:center;color:#888;padding:20px;">No rows parsed yet</div>`;
    return;
  }
  rows.forEach((r, i) => {
    const div = document.createElement("div");
    div.className = "row-item";
    div.dataset.i = i;
    div.innerHTML = `
      ${r.imageData ? `<img class="row-thumb" src="${r.imageData}">` : ""}
      <div style="font-weight:700;">${i + 1}. ${escapeHtml(
      r.title || "Untitled"
    )}</div>
      ${
        r.description
          ? `<div class="small">${escapeHtml(r.description)}</div>`
          : ""
      }
      ${r.link ? `<div class="small">🔗 ${escapeHtml(r.link)}</div>` : ""}
      ${r.tags ? `<div class="small">🏷️ ${escapeHtml(r.tags)}</div>` : ""}
    `;
    addDragDropToRow(div, i);
    div.addEventListener("click", () => {
      document
        .querySelectorAll(".row-item")
        .forEach((el) => el.classList.remove("selected"));
      div.classList.add("selected");
      applyRow(i);
    });
    rowsContainer.appendChild(div);
  });
}
function escapeHtml(s) {
  return ("" + s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

// ---------- Apply ----------
function applyRow(i) {
  const r = window.__ROW_FILLER_ROWS[i];
  if (!r) return setStatus("❌ Invalid row");
  setStatus("🚀 Applying...");
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return setStatus("❌ No active tab");
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "applyRow", data: r },
      (resp) => {
        if (resp && resp.status) setStatus(`✅ ${resp.status}`, true);
        else setStatus("✅ Applied!", true);
      }
    );
  });
}

// ---------- Profile Save / Load ----------
document.addEventListener("click", (e) => {
  // guard if DOM not ready yet
});

document.getElementById &&
  (function attachProfileHandlers() {
    // Save profile with two passwords and the chosen radio
    const saveBtn = document.getElementById("saveProfile");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const profile = {
          fullname: document.getElementById("fullname").value || "",
          username: document.getElementById("username").value || "",
          email: document.getElementById("email").value || "",
          emailPassword: document.getElementById("emailPassword").value || "",
          submissionPassword:
            document.getElementById("submissionPassword").value || "",
          activePassword:
            (
              document.querySelector('input[name="activePassword"]:checked') ||
              {}
            ).value || "emailPassword",
        };
        chrome.storage.local.set({ profile }, () => {
          const st = document.getElementById("status");
          if (st) {
            st.innerText = "✅ Profile saved!";
            setTimeout(() => (st.innerText = ""), 2000);
          }
        });
      });
    }

    // Autofill auth button
    const af = document.getElementById("autofillAuth");
    if (af) {
      af.addEventListener("click", async () => {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab) {
          setStatus("❌ No active tab");
          return;
        }
        chrome.runtime.sendMessage(
          { action: "triggerAuthFill", tabId: tab.id },
          (res) => {
            if (res && res.ok) setStatus("✅ Autofill triggered");
            else setStatus("❌ Autofill failed (no profile or fields)");
          }
        );
      });
    }

    // Load profile when popup opens
    chrome.storage.local.get("profile", (res) => {
      if (res.profile) {
        const p = res.profile;
        document.getElementById("fullname").value = p.fullname || "";
        document.getElementById("username").value = p.username || "";
        document.getElementById("email").value = p.email || "";
        document.getElementById("emailPassword").value = p.emailPassword || "";
        document.getElementById("submissionPassword").value =
          p.submissionPassword || "";

        const active =
          p.activePassword ||
          (p.emailPassword
            ? "emailPassword"
            : p.submissionPassword
            ? "submissionPassword"
            : "emailPassword");
        const radio = document.querySelector(
          `input[name="activePassword"][value="${active}"]`
        );
        if (radio) radio.checked = true;
      }
    });

    // UX nicety: focusing a password input auto-selects its radio
    ["emailPassword", "submissionPassword"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("focus", () => {
          const r = document.querySelector(
            `input[name="activePassword"][value="${id}"]`
          );
          if (r) r.checked = true;
        });
      }
    });
  })();

// ---------- Auto Load & Sync ----------
async function loadAndRender() {
  const saved = await loadFromStorage();
  window.__ROW_FILLER_ROWS = saved || [];
  renderRows(saved || []);
  if (saved && saved.length)
    setStatus(`✅ Loaded ${saved.length} rows from storage`, true);
  else setStatus("No saved data found. Upload a file to get started.", true);
}

// Listen for tab changes
chrome.tabs.onActivated.addListener(() => {
  checkWebsiteSupport();
});

// Listen for tab updates (when URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.status === "complete") checkWebsiteSupport();
});

// Listen for storage changes (sync across tabs/panels)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) {
    const newData = changes[STORAGE_KEY].newValue || [];
    window.__ROW_FILLER_ROWS = newData;
    renderRows(newData);
    setStatus(`🔄 Synced ${newData.length} rows from storage`, true);
  }
});

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", async () => {
  fileInput = document.getElementById("fileInput");
  rowsContainer = document.getElementById("rowsContainer");
  statusDiv = document.getElementById("status");
  clearBtn = document.getElementById("clearAll");
  refreshDataBtn = document.getElementById("refreshData");
  websiteStatusDiv = document.getElementById("websiteStatus");

  if (fileInput) fileInput.addEventListener("change", handleFile);
  if (clearBtn)
    clearBtn.addEventListener("click", async () => {
      window.__ROW_FILLER_ROWS = [];
      await clearStorage();
      renderRows([]);
      setStatus("✅ All data cleared");
    });
  if (refreshDataBtn) refreshDataBtn.addEventListener("click", loadAndRender);

  await new Promise((r) => setTimeout(r, 100));
  checkWebsiteSupport();
  await loadAndRender();
});
