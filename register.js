import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";

// 1. Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyA91WlL0vnYEYZcQo51KTDMWPPSw1eZayM",
  authDomain: "the-tech-x.firebaseapp.com",
  projectId: "the-tech-x",
  storageBucket: "the-tech-x.firebasestorage.app",
  messagingSenderId: "997772121695",
  appId: "1:997772121695:web:0fb74ffa3bc64240a66dea",
  measurementId: "G-VQ00H9FPKF"
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);
const storage = getStorage(app);




// State cache
let activeCustomFields = [];
let allProjects = [];
let allTracks = [];

// Error Message Cleaner
function getCleanErrorMessage(err) {
  if (!err) return "An unknown error occurred.";
  if (err.code === "permission-denied" || (err.message && err.message.includes("permission-denied"))) {
    return "Permission denied. Please verify input parameters or contact organizers.";
  }
  if (err.code === "storage/unauthorized" || (err.message && err.message.includes("unauthorized"))) {
    return "File upload rejected. Please verify the file is under 10MB and is a valid document (.pdf, .docx, .pptx).";
  }
  let msg = err.message || String(err);
  if (msg.startsWith("Firebase: ")) {
    msg = msg.replace(/^Firebase:\s*(Error\s*)?(\([^)]+\))?:?\s*/, "");
  }
  return msg;
}

// DOM elements
const teamRegistrationForm = document.getElementById("team-registration-form");
const dynamicFieldsContainer = document.getElementById("dynamic-custom-fields-container");
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toast-message");
const toastIcon = document.getElementById("toast-icon");

// Toast management
function showToast(message, type = "success") {
  toastMessage.textContent = message;
  if (type === "success") {
    toastIcon.className = "fa-solid fa-circle-check";
    toastIcon.style.color = "var(--success)";
  } else if (type === "error") {
    toastIcon.className = "fa-solid fa-circle-xmark";
    toastIcon.style.color = "var(--danger)";
  } else {
    toastIcon.className = "fa-solid fa-circle-info";
    toastIcon.style.color = "var(--primary)";
  }
  
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// Render dynamic custom coordinator fields
function renderPublicCustomFields() {
  if (!dynamicFieldsContainer) return;
  if (activeCustomFields.length === 0) {
    dynamicFieldsContainer.innerHTML = "";
    return;
  }

  dynamicFieldsContainer.innerHTML = `
    <div style="margin-top: 24px; padding-top: 16px;">
      <h4 style="margin-bottom: 12px; font-size: 14px; color: var(--text-main);"><i class="fa-solid fa-square-plus"></i> Additional Organizer Requirements</h4>
      <div class="grid-2" style="gap: 16px;">
        ${activeCustomFields.map(field => `
          <div class="form-group ${field.type === 'text' ? 'custom-field-textarea-group' : ''}">
            <label for="custom-field-${field.key}">${field.label}</label>
            ${field.type === 'text'
              ? `<textarea id="custom-field-${field.key}" class="form-control" required placeholder="Enter ${field.label.toLowerCase()}" rows="3" style="resize: vertical; min-height: 80px;"></textarea>`
              : `<input type="${field.type}" id="custom-field-${field.key}" class="form-control" required placeholder="Enter ${field.label.toLowerCase()}">`
            }
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

// Real-Time Listeners
onSnapshot(doc(firestore, "config", "registration_form"), (snapshot) => {
  if (snapshot.exists()) {
    activeCustomFields = snapshot.data().customFields || [];
  } else {
    activeCustomFields = [];
  }
  renderPublicCustomFields();
});

onSnapshot(collection(firestore, "projects"), (snapshot) => {
  allProjects = [];
  snapshot.forEach(d => {
    allProjects.push({ id: d.id, ...d.data() });
  });
});

// Watch challenge tracks dynamically
onSnapshot(collection(firestore, "tracks"), (snapshot) => {
  allTracks = [];
  snapshot.forEach(d => {
    allTracks.push({ id: d.id, ...d.data() });
  });
  
  const selectEl = document.getElementById("reg-project-track");
  if (selectEl) {
    const visibleTracks = allTracks.filter(t => t.visible !== false);
    if (visibleTracks.length === 0) {
      // Self-healing default fallback options
      selectEl.innerHTML = `
        <option value="" selected>Not Specified Yet (Open Track)</option>
        <option value="clean-energy">Clean Energy & Environment</option>
        <option value="fintech">Fintech & Financial Inclusion</option>
        <option value="healthtech">Healthcare & MedTech</option>
      `;
    } else {
      selectEl.innerHTML = `
        <option value="" selected>Not Specified Yet (Open Track)</option>
        ` + visibleTracks.map(t => `<option value="${t.id}">${t.name}</option>`).join("") + `
      `;
    }
  }
});

// Form submission handler
if (teamRegistrationForm) {
  teamRegistrationForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Lock submit button during processing
    const submitBtn = teamRegistrationForm.querySelector("button[type='submit']");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
    }

    try {
      const teamName = document.getElementById("reg-team-name").value.trim();
      const track = document.getElementById("reg-project-track").value;
      const docxFileInput = document.getElementById("reg-concept-note");
      const docxFile = docxFileInput ? docxFileInput.files[0] : null;

      if (docxFile) {
        const allowedExtensions = [".docx", ".pptx", ".pdf"];
        const fileExt = docxFile.name.substring(docxFile.name.lastIndexOf(".")).toLowerCase();
        if (!allowedExtensions.includes(fileExt)) {
          throw new Error("Proposal document must be a .docx, .pptx, or .pdf file.");
        }
        
        // Enforce max upload size limit of 4MB (will compress to <1MB)
        const maxFileSize = 4 * 1024 * 1024;
        if (docxFile.size > maxFileSize) {
          throw new Error("File is too large. Maximum allowed size is 4MB.");
        }
      } else {
        throw new Error("Please select a concept file to upload.");
      }

      // Safe checks to avoid TypeError if any database entry lacks teamName
      const nameExists = allProjects.some(p => p.teamName && p.teamName.toLowerCase() === teamName.toLowerCase());
      if (nameExists) {
        throw new Error("Team name already exists.");
      }

      const members = [
        document.getElementById("reg-m1-name").value.trim(),
        document.getElementById("reg-m2-name").value.trim(),
        document.getElementById("reg-m3-name").value.trim()
      ];
      const emails = [
        document.getElementById("reg-m1-email").value.trim().toLowerCase(),
        document.getElementById("reg-m2-email").value.trim().toLowerCase(),
        document.getElementById("reg-m3-email").value.trim().toLowerCase()
      ];
      const contacts = [
        document.getElementById("reg-m1-contact").value.trim(),
        document.getElementById("reg-m2-contact").value.trim(),
        document.getElementById("reg-m3-contact").value.trim()
      ];

      const customFields = {};
      activeCustomFields.forEach(field => {
        const inputEl = document.getElementById(`custom-field-${field.key}`);
        if (inputEl) {
          customFields[field.label] = inputEl.value.trim();
        }
      });

      const projId = `p-${teamName.toLowerCase().replace(/\s+/g, '-')}`;
      
      // File encoding logic
      showToast("Compressing and encoding proposal file...", "info");
      if (window.__updateUploadProgress) window.__updateUploadProgress(30);

      let conceptNoteUrl;
      const compressedBuffer = await compressFileGzip(docxFile);
      if (compressedBuffer) {
        conceptNoteUrl = await bufferToBase64Gzip(compressedBuffer);
      } else {
        // Fallback to uncompressed base64 if CompressionStream is unsupported
        conceptNoteUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = (err) => reject(new Error("File reading failed."));
          reader.readAsDataURL(docxFile);
        });
      }

      if (window.__updateUploadProgress) window.__updateUploadProgress(70);

      const newProj = {
        teamName,
        title: `${teamName} Registration`,
        track,
        leadEmail: emails[0],
        members,
        emails,
        contacts,
        conceptNoteName: docxFile.name,
        conceptNoteUrl: conceptNoteUrl,
        conceptNoteType: docxFile.name.substring(docxFile.name.lastIndexOf(".") + 1).toUpperCase(),
        customFields,
        status: "Pending",
        scores: {},
        judgeComments: "",
        averageScore: null,
        timestamp: Date.now()
      };

      showToast("Submitting team registration...", "info");
      await setDoc(doc(firestore, "projects", projId), newProj);

      if (window.__updateUploadProgress) window.__updateUploadProgress(100);
      showToast("Team registration submitted successfully!", "success");
      
      // Reset form and redirect
      setTimeout(() => {
        if (window.__hideUploadProgress) window.__hideUploadProgress();
        teamRegistrationForm.reset();
        window.location.href = "success.html";
      }, 1500);

    } catch (err) {
      console.error("Registration failed:", err);
      showToast(getCleanErrorMessage(err), "error");
      if (window.__hideUploadProgress) window.__hideUploadProgress();
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Team Registration';
      }
    }
  });
}

// Samsung Internet browser enforcement to Google Chrome
function checkBrowserAndEnforceChrome() {
  const ua = navigator.userAgent;
  const isSamsungBrowser = ua.indexOf("SamsungBrowser") > -1;
  
  if (isSamsungBrowser) {
    if (sessionStorage.getItem("chrome_enforcement_dismissed") === "true") {
      return;
    }
    
    const banner = document.createElement("div");
    banner.id = "browser-enforcement-banner";
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      color: white;
      padding: 14px 20px;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      border-bottom: 2px solid #2563eb;
    `;
    
    banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b; font-size: 16px;"></i>
        <span>Using Samsung Internet? Open in <strong>Google Chrome</strong> for maximum compatibility.</span>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <a href="intent://${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}#Intent;scheme=https;package=com.android.chrome;end" 
           style="background: #2563eb; color: white; padding: 6px 12px; border-radius: 6px; font-weight: 600; text-decoration: none; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-brands fa-chrome"></i> Open in Chrome
        </a>
        <button id="close-browser-banner" style="background: none; border: none; color: #94a3b8; font-size: 18px; cursor: pointer; padding: 0 4px;">&times;</button>
      </div>
    `;
    
    document.body.appendChild(banner);
    document.body.style.paddingTop = "50px";
    
    document.getElementById("close-browser-banner").addEventListener("click", () => {
      banner.remove();
      document.body.style.paddingTop = "0px";
      sessionStorage.setItem("chrome_enforcement_dismissed", "true");
    });
  }
}

// Run detection
window.addEventListener("DOMContentLoaded", () => {
  checkBrowserAndEnforceChrome();

  // === File Upload – premium drop-zone with info chip + progress bar ===
  const fileInput   = document.getElementById("reg-concept-note");
  const uploadZone  = document.getElementById("file-upload-zone");
  const idleEl      = document.getElementById("file-upload-idle");
  const infoEl      = document.getElementById("file-upload-info");
  const typeIconEl  = document.getElementById("file-upload-type-icon");
  const nameEl      = document.getElementById("file-upload-name");
  const sizeEl      = document.getElementById("file-upload-size");
  const removeBtn   = document.getElementById("file-upload-remove");
  const progressWrap = document.getElementById("upload-progress-wrap");
  const progressBar  = document.getElementById("upload-progress-bar");
  const progressLbl  = document.getElementById("upload-progress-label");

  // File type icon class + FA icon mapping
  const typeMap = {
    pdf:  { cls: "pdf",  icon: "fa-file-pdf" },
    docx: { cls: "docx", icon: "fa-file-word" },
    doc:  { cls: "docx", icon: "fa-file-word" },
    pptx: { cls: "pptx", icon: "fa-file-powerpoint" },
    ppt:  { cls: "pptx", icon: "fa-file-powerpoint" }
  };

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(2) + " MB";
  }

  function showFileInfo(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    const map = typeMap[ext] || { cls: "", icon: "fa-file" };

    // Set type-icon style
    typeIconEl.className = `file-upload-type-icon ${map.cls}`;
    typeIconEl.innerHTML = `<i class="fa-solid ${map.icon}"></i>`;

    nameEl.textContent = file.name;
    sizeEl.textContent = formatBytes(file.size);

    // Switch display
    if (idleEl) idleEl.style.display = "none";
    if (infoEl) infoEl.style.display = "flex";
    uploadZone.classList.add("file-selected");

    showToast(`✅ File ready: ${file.name}`, "success");
  }

  function clearFileSelection() {
    if (fileInput) fileInput.value = "";
    if (idleEl) idleEl.style.display = "flex";
    if (infoEl) infoEl.style.display = "none";
    uploadZone.classList.remove("file-selected");
    if (progressWrap) progressWrap.style.display = "none";
    if (progressBar) progressBar.style.width = "0%";
    if (progressLbl) progressLbl.textContent = "0%";
  }

  if (fileInput && uploadZone) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (file) {
        showFileInfo(file);
      } else {
        clearFileSelection();
      }
    });

    // Drag-over / drag-leave / drop visual feedback
    uploadZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadZone.classList.add("drag-over");
    });
    uploadZone.addEventListener("dragleave", () => {
      uploadZone.classList.remove("drag-over");
    });
    uploadZone.addEventListener("drop", (e) => {
      uploadZone.classList.remove("drag-over");
      // Let the browser assign the dropped file to the input naturally
      setTimeout(() => {
        if (fileInput.files[0]) showFileInfo(fileInput.files[0]);
      }, 50);
    });
  }

  // Remove × button
  if (removeBtn) {
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      clearFileSelection();
    });
  }

  // Expose progress bar updater for use in submit handler
  window.__updateUploadProgress = (pct) => {
    if (progressWrap) progressWrap.style.display = "flex";
    if (progressBar) progressBar.style.width = pct + "%";
    if (progressLbl) progressLbl.textContent = pct + "%";
  };
  window.__hideUploadProgress = () => {
    if (progressWrap) progressWrap.style.display = "none";
    if (progressBar) progressBar.style.width = "0%";
    if (progressLbl) progressLbl.textContent = "0%";
  };
  
  // Auto-fill removed.
});

// Helper: Compress file to gzip buffer
async function compressFileGzip(file) {
  if (typeof CompressionStream === "undefined") {
    console.warn("CompressionStream not supported. Uploading raw file.");
    return null;
  }
  try {
    const stream = file.stream();
    const compressionStream = new CompressionStream("gzip");
    const compressedStream = stream.pipeThrough(compressionStream);
    const response = new Response(compressedStream);
    return await response.arrayBuffer();
  } catch (err) {
    console.error("Compression failed:", err);
    return null;
  }
}

// Helper: Convert ArrayBuffer to gzip Data URL
async function bufferToBase64Gzip(buffer) {
  const blob = new Blob([buffer], { type: "application/gzip" });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
