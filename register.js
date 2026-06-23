import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";

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
          <div class="form-group">
            <label for="custom-field-${field.key}">${field.label}</label>
            <input type="${field.type}" id="custom-field-${field.key}" class="form-control" required placeholder="Enter ${field.label.toLowerCase()}">
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
        <option value="" disabled selected>Select a track</option>
        <option value="clean-energy">Clean Energy & Environment</option>
        <option value="fintech">Fintech & Financial Inclusion</option>
        <option value="healthtech">Healthcare & MedTech</option>
      `;
    } else {
      selectEl.innerHTML = `
        <option value="" disabled selected>Select a track</option>
        ` + visibleTracks.map(t => `<option value="${t.id}">${t.name}</option>`).join("") + `
      `;
    }
  }
});

// Form submission handler
if (teamRegistrationForm) {
  teamRegistrationForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const teamName = document.getElementById("reg-team-name").value.trim();
    const track = document.getElementById("reg-project-track").value;
    const docxFileInput = document.getElementById("reg-concept-note");
    const docxFile = docxFileInput ? docxFileInput.files[0] : null;

    if (docxFile) {
      const allowedExtensions = [".docx", ".pptx", ".pdf"];
      const fileExt = docxFile.name.substring(docxFile.name.lastIndexOf(".")).toLowerCase();
      if (!allowedExtensions.includes(fileExt)) {
        showToast("Proposal document must be a .docx, .pptx, or .pdf file.", "error");
        return;
      }
    }

    if (allProjects.find(p => p.teamName.toLowerCase() === teamName.toLowerCase())) {
      showToast("Team name already exists.", "error");
      return;
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
    
    // File upload logic
    let conceptNoteUrl = "";
    if (docxFile) {
      try {
        showToast("Uploading proposal document...", "info");
        const fileRef = ref(storage, `proposals/${projId}/${docxFile.name}`);
        const uploadSnapshot = await uploadBytes(fileRef, docxFile);
        conceptNoteUrl = await getDownloadURL(uploadSnapshot.ref);
      } catch (uploadErr) {
        console.error("Storage upload failed:", uploadErr);
        showToast("Upload failed: " + getCleanErrorMessage(uploadErr), "error");
        return;
      }
    }

    const newProj = {
      teamName,
      title: `${teamName} Proposal`,
      track,
      leadEmail: emails[0],
      members,
      emails,
      contacts,
      conceptNoteName: docxFile ? docxFile.name : "concept_note.docx",
      conceptNoteUrl: conceptNoteUrl,
      conceptNoteType: docxFile ? docxFile.name.substring(docxFile.name.lastIndexOf(".") + 1).toUpperCase() : "DOCX",
      customFields,
      status: "Pending",
      scores: {},
      judgeComments: "",
      averageScore: null,
      timestamp: Date.now()
    };

    try {
      showToast("Submitting team registration...", "info");
      await setDoc(doc(firestore, "projects", projId), newProj);
      showToast("Team registration submitted successfully!", "success");
      teamRegistrationForm.reset();
      
      // Redirect back to home after successful registration
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1500);
    } catch (err) {
      showToast("Registration failed: " + getCleanErrorMessage(err), "error");
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
window.addEventListener("DOMContentLoaded", checkBrowserAndEnforceChrome);
