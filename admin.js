import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc, getDoc, getDocs, updateDoc, collection, addDoc, onSnapshot, deleteDoc, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

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
const auth = getAuth(app);
const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});
const storage = getStorage(app);

// Prevent pinch-to-zoom using standard gesture events
document.addEventListener("gesturestart", (e) => {
  e.preventDefault();
});

// State Memory
let currentUser = null;
let allProjects = [];
let allNews = [];
let allUsers = [];
let allTracks = [];
let allFeatures = [];
let allTimeline = [];
let allPrizes = [];
let allLegal = [];
let allResources = [];
let allTickets = [];
let ticketingConfig = null;
let activeCustomFields = [];
let activeAdminTab = "overview";
let signupEnabled = true;

// DOM Elements
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const loginCard = document.getElementById("login-card");
const signupCard = document.getElementById("signup-card");
const toSignupBtn = document.getElementById("to-signup-btn");
const toLoginBtn = document.getElementById("to-login-btn");
const adminLoginView = document.getElementById("admin-login-view");
const adminDashboardView = document.getElementById("admin-dashboard-view");
const adminLogoutBtn = document.getElementById("admin-logout-btn");
const toggleSignupBtn = document.getElementById("toggle-signup-btn");
const adminTabItems = document.querySelectorAll("[data-admin-tab]");
const adminTabContents = document.querySelectorAll(".admin-tab-content");

// Modals & Toasts
const infoModal = document.getElementById("info-modal");
const modalTitle = document.getElementById("modal-title");
const modalBody = document.getElementById("modal-body");
const modalCloseBtn = document.getElementById("modal-close-btn");
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

// Error Message Cleaner
function getCleanErrorMessage(err) {
  if (!err) return "An unknown error occurred.";
  if (err.code === "permission-denied" || (err.message && err.message.includes("permission-denied"))) {
    return "Permission denied. You do not have sufficient rights, or this option is locked.";
  }
  const code = err.code || "";
  switch (code) {
    case "auth/email-already-in-use":
      return "This email address is already registered.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password must be at least 6 characters long.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email address or password.";
    case "auth/operation-not-allowed":
      return "Email/password authentication is disabled.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later.";
    default:
      let msg = err.message || String(err);
      if (msg.startsWith("Firebase: ")) {
        msg = msg.replace(/^Firebase:\s*(Error\s*)?(\([^)]+\))?:?\s*/, "");
      }
      return msg;
  }
}

// Modal open/close
function openModal(title, contentHTML, isWide = false) {
  modalTitle.textContent = title;
  modalBody.innerHTML = contentHTML;
  const contentEl = infoModal.querySelector(".modal-content");
  if (contentEl) {
    contentEl.style.maxWidth = isWide ? "950px" : "600px";
  }
  infoModal.classList.add("open");
}

if (modalCloseBtn) {
  modalCloseBtn.addEventListener("click", () => {
    infoModal.classList.remove("open");
  });
}

window.addEventListener("click", (e) => {
  if (e.target === infoModal) {
    infoModal.classList.remove("open");
  }
});

// Switch to Sign Up Card
if (toSignupBtn) {
  toSignupBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!signupEnabled) {
      showToast("Admin registration is currently disabled.", "error");
      return;
    }
    loginCard.style.display = "none";
    signupCard.style.display = "block";
  });
}

// Switch to Login Card
if (toLoginBtn) {
  toLoginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    signupCard.style.display = "none";
    loginCard.style.display = "block";
  });
}

// Admin Authentication Form (Login)
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const pass = document.getElementById("login-password").value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalBtnHTML = submitBtn.innerHTML;

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Signing In...';
      showToast("Signing in...", "info");
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const uid = userCredential.user.uid;
      
      const userDocRef = doc(firestore, "users", uid);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.exists() ? userDocSnap.data() : null;
      
      if (!userData || !userData.isAdmin) {
        showToast("Access Denied. Only organizers/admins are allowed to log in.", "error");
        await signOut(auth);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
        return;
      }

      showToast("Signed in successfully!", "success");
      loginForm.reset();
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;
    } catch (err) {
      console.error(err);
      showToast(getCleanErrorMessage(err), "error");
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;
    }
  });
}

// Admin Sign Up Form
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!signupEnabled) {
      showToast("Registration is currently disabled by system security settings.", "error");
      return;
    }

    const email = document.getElementById("signup-email").value.trim().toLowerCase();
    const pass = document.getElementById("signup-password").value;
    const confirmPass = document.getElementById("signup-confirm-password").value;

    if (pass !== confirmPass) {
      showToast("Passwords do not match.", "error");
      return;
    }

    if (pass.length < 6) {
      showToast("Password must be at least 6 characters.", "error");
      return;
    }

    try {
      showToast("Creating administrator account...", "info");
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const uid = userCredential.user.uid;
      
      try {
        // Save administrator profile document
        await setDoc(doc(firestore, "users", uid), {
          email,
          isAdmin: true,
          firstName: email.split("@")[0],
          lastName: "Coordinator",
          role: "Lead Organizer"
        });
        
        showToast("Admin account created successfully!", "success");
        signupForm.reset();
      } catch (firestoreErr) {
        console.error("Firestore write failed. Rolling back auth account.", firestoreErr);
        // Delete the newly registered authentication credentials to allow retrying
        await userCredential.user.delete();
        throw firestoreErr;
      }
    } catch (err) {
      console.error(err);
      showToast("Registration failed: " + getCleanErrorMessage(err), "error");
    }
  });
}

if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      showToast("Logged out successfully.", "success");
    } catch (err) {
      showToast("Logout failed: " + getCleanErrorMessage(err), "error");
    }
  });
}

// Toggle self-registration option button inside dashboard
if (toggleSignupBtn) {
  toggleSignupBtn.addEventListener("click", async () => {
    try {
      showToast("Updating security settings...", "info");
      await setDoc(doc(firestore, "config", "admin_settings"), {
        signupEnabled: !signupEnabled
      }, { merge: true });
      showToast("Security settings updated!", "success");
    } catch (err) {
      showToast("Failed to update settings: " + getCleanErrorMessage(err), "error");
    }
  });
}

// Keyboard Combo Recorder
const btnRecordCombo = document.getElementById("btn-record-combo");
const comboRecordArea = document.getElementById("admin-combo-record-area");
const comboDisplayArea = document.getElementById("admin-combo-display-area");
const comboRecordingDisplay = document.getElementById("combo-recording-display");
const btnSetCombo = document.getElementById("btn-set-combo");
const btnCancelCombo = document.getElementById("btn-cancel-combo");

if (btnRecordCombo) {
  let isRecording = false;
  let pressedKeys = new Set();
  
  const keydownHandler = (e) => {
    e.preventDefault(); 
    if (pressedKeys.size < 4) {
      pressedKeys.add(e.key.toLowerCase());
      updateRecordingDisplay();
    }
  };
  
  const keyupHandler = (e) => {
    e.preventDefault();
  };

  const updateRecordingDisplay = () => {
    if (pressedKeys.size === 0) {
      comboRecordingDisplay.textContent = "Press Keys...";
    } else {
      comboRecordingDisplay.innerHTML = Array.from(pressedKeys).map(k => `<kbd style="background: transparent; border: none; color: inherit; padding: 0;">${k}</kbd>`).join(" + ");
    }
  };

  const stopRecording = () => {
    window.removeEventListener("keydown", keydownHandler);
    window.removeEventListener("keyup", keyupHandler);
    isRecording = false;
    if (comboRecordArea) comboRecordArea.style.display = "none";
    if (comboDisplayArea) comboDisplayArea.style.display = "flex";
    if (btnRecordCombo) btnRecordCombo.style.display = "inline-flex";
  };
  
  btnRecordCombo.addEventListener("click", () => {
    if (isRecording) return;
    isRecording = true;
    pressedKeys.clear();
    updateRecordingDisplay();
    
    if (comboDisplayArea) comboDisplayArea.style.display = "none";
    if (btnRecordCombo) btnRecordCombo.style.display = "none";
    if (comboRecordArea) comboRecordArea.style.display = "flex";
    
    showToast("Press up to 4 keys to form your combo.", "info");
    window.addEventListener("keydown", keydownHandler);
    window.addEventListener("keyup", keyupHandler);
  });

  if (btnCancelCombo) {
    btnCancelCombo.addEventListener("click", () => {
      stopRecording();
      showToast("Recording cancelled.", "info");
    });
  }

  if (btnSetCombo) {
    btnSetCombo.addEventListener("click", async () => {
      const comboArray = Array.from(pressedKeys);
      
      if (comboArray.length > 0 && (comboArray.length < 3 || comboArray.length > 4)) {
        showToast("Combination must be exactly 3 or 4 keys.", "error");
        return;
      }

      stopRecording();
      
      if (comboArray.length === 0) {
        try {
          showToast("Clearing shortcut combo...", "info");
          await setDoc(doc(firestore, "config", "admin_settings"), {
            shortcutCombo: []
          }, { merge: true });
          showToast("Shortcut combo cleared successfully!", "success");
        } catch (err) {
          showToast("Failed to clear combo: " + getCleanErrorMessage(err), "error");
        }
      } else {
        try {
          showToast("Saving shortcut combo...", "info");
          await setDoc(doc(firestore, "config", "admin_settings"), {
            shortcutCombo: comboArray
          }, { merge: true });
          showToast("Shortcut combo saved successfully!", "success");
        } catch (err) {
          showToast("Failed to save combo: " + getCleanErrorMessage(err), "error");
        }
      }
    });
  }
}

// Landing page stats form configuration
const adminLandingStatsForm = document.getElementById("admin-landing-stats-form");
const adminStatsPartMode = document.getElementById("admin-stats-participants-mode");
const adminStatsManualGroup = document.getElementById("admin-stats-manual-group");

const adminStatsSubsMode = document.getElementById("admin-stats-submissions-mode");
const adminStatsSubsManualGroup = document.getElementById("admin-stats-submissions-manual-group");

if (adminStatsPartMode) {
  adminStatsPartMode.addEventListener("change", () => {
    if (adminStatsManualGroup) {
      adminStatsManualGroup.style.display = adminStatsPartMode.value === "manual" ? "block" : "none";
    }
  });
}

if (adminStatsSubsMode) {
  adminStatsSubsMode.addEventListener("change", () => {
    if (adminStatsSubsManualGroup) {
      adminStatsSubsManualGroup.style.display = adminStatsSubsMode.value === "manual" ? "block" : "none";
    }
  });
}

if (adminLandingStatsForm) {
  adminLandingStatsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const mode = document.getElementById("admin-stats-participants-mode").value;
    const overrideVal = document.getElementById("admin-stats-participants-override").value.trim();
    
    const subsMode = document.getElementById("admin-stats-submissions-mode").value;
    const subsOverrideVal = document.getElementById("admin-stats-submissions-override").value.trim();
    
    const countdownVal = document.getElementById("admin-stats-countdown-date").value;
    const showCountdown = document.getElementById("admin-stats-show-countdown").checked;
    const showLeaderboard = document.getElementById("admin-stats-show-leaderboard").checked;

    try {
      showToast("Saving header statistics configuration...", "info");
      await setDoc(doc(firestore, "config", "landing_stats"), {
        participantsMode: mode,
        participantsOverride: overrideVal,
        submissionsMode: subsMode,
        submissionsOverride: subsOverrideVal,
        countdownDate: countdownVal,
        showCountdown: showCountdown,
        showLeaderboardWidget: showLeaderboard,
        timestamp: Date.now()
      });
      showToast("Header statistics saved successfully!", "success");
    } catch (err) {
      showToast("Failed to save header configuration: " + getCleanErrorMessage(err), "error");
    }
  });
}

// Tab Switching
adminTabItems.forEach(item => {
  item.addEventListener("click", () => {
    adminTabItems.forEach(i => i.classList.remove("active"));
    item.classList.add("active");
    
    const tabName = item.getAttribute("data-admin-tab");
    activeAdminTab = tabName;
    
    adminTabContents.forEach(content => {
      content.classList.remove("active");
      content.style.display = "none";
    });
    
    const targetContent = document.getElementById(`admin-tab-${tabName}`);
    if (targetContent) {
      targetContent.classList.add("active");
      targetContent.style.display = "block";
    }
    
    renderAdminDashboard();
  });
});

// Realtime Observers
function initRealtimeSync() {
let isInitialProjectsLoad = true;
  onSnapshot(collection(firestore, "projects"), (snapshot) => {
    if (!isInitialProjectsLoad) {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          showToast(`New Application: ${data.project_name || "A new team"} just registered!`, "success");
        }
      });
    }

    allProjects = [];
    snapshot.forEach(d => {
      allProjects.push({ id: d.id, ...d.data() });
    });
    renderAdminDashboard();
    isInitialProjectsLoad = false;
  });

  onSnapshot(collection(firestore, "news"), (snapshot) => {
    allNews = [];
    snapshot.forEach(d => {
      allNews.push({ id: d.id, ...d.data() });
    });
    allNews.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    if (activeAdminTab === "news-compose") {
      renderAdminNewsList();
    }
  });

  onSnapshot(collection(firestore, "users"), (snapshot) => {
    allUsers = [];
    snapshot.forEach(d => {
      allUsers.push({ uid: d.id, ...d.data() });
    });
  });

  onSnapshot(collection(firestore, "tracks"), (snapshot) => {
    allTracks = [];
    snapshot.forEach(d => {
      allTracks.push({ id: d.id, ...d.data() });
    });
    
    allTracks.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    renderAdminDashboard();
  });

  onSnapshot(collection(firestore, "timeline"), async (snapshot) => {
    allTimeline = [];
    snapshot.forEach(d => {
      allTimeline.push({ id: d.id, ...d.data() });
    });
    
    if (snapshot.empty && currentUser) {
      const defaultTimeline = [
        { step: 1, title: "Registration Period", date: "June 1 - July 15", desc: "Register as an individual or create a team. Explore tracks and prepare project directions.", status: "completed" },
        { step: 2, title: "Application Deadline", date: "July 15 @ 23:59 EST", desc: "Submit initial proposals, team lists, and draft designs. Late entries are not accepted.", status: "active" },
        { step: 3, title: "Shortlisting & Selection", date: "July 20", desc: "Our expert panel vets all entries to select top 30 teams who will advance to the next phase.", status: "upcoming" },
        { step: 4, title: "Mentorship Phase", date: "July 22 - Aug 10", desc: "Selected teams are paired with top-tier coaches for architecture, UX, and business modeling.", status: "upcoming" },
        { step: 5, title: "Demo Day", date: "August 15", desc: "Teams present live prototype demonstrations and pitch pitches to a global panel of judges.", status: "upcoming" },
        { step: 6, title: "Awards Ceremony", date: "August 18", desc: "Winners are officially announced. Networking opportunities open for all finalists.", status: "upcoming" }
      ];
      try {
        for (const item of defaultTimeline) {
          await setDoc(doc(firestore, "timeline", `step-${item.step}`), {
            step: item.step,
            title: item.title,
            date: item.date,
            desc: item.desc,
            status: item.status,
            timestamp: Date.now()
          });
        }
      } catch (err) {
        console.error("Failed seeding timeline:", err);
      }
    }
    
    allTimeline.sort((a, b) => (a.step || 0) - (b.step || 0));
    renderAdminDashboard();
  });

  onSnapshot(doc(firestore, "config", "registration_form"), (snapshot) => {
    let registrationClosed = false;
    let hideRegistrationTag = false;
    let swapNavToLeaderboard = false;
    if (snapshot.exists()) {
      const data = snapshot.data();
      activeCustomFields = data.customFields || [];
      registrationClosed = data.registrationClosed || false;
      hideRegistrationTag = data.hideRegistrationTag || false;
      swapNavToLeaderboard = data.swapNavToLeaderboard || false;
    } else {
      activeCustomFields = [];
    }
    const closedCheckbox = document.getElementById("admin-registration-closed");
    if (closedCheckbox) {
      closedCheckbox.checked = registrationClosed;
    }
    const hideCheckbox = document.getElementById("admin-registration-hide-tag");
    if (hideCheckbox) {
      hideCheckbox.checked = hideRegistrationTag;
    }
    const swapNavCheckbox = document.getElementById("admin-registration-swap-nav");
    if (swapNavCheckbox) {
      swapNavCheckbox.checked = swapNavToLeaderboard;
    }
    if (activeAdminTab === "form-config") {
      renderAdminCustomFieldsList();
    }
  });

  // Watch Traffic Analytics
  onSnapshot(doc(firestore, "analytics", "traffic"), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const pageViewsEl = document.getElementById("admin-stat-page-views");
      const sharedClicksEl = document.getElementById("admin-stat-shared-clicks");
      if (pageViewsEl) pageViewsEl.textContent = data.total_page_views || 0;
      if (sharedClicksEl) sharedClicksEl.textContent = data.shared_link_clicks || 0;
    }
  });

    // Watch security configuration settings
  onSnapshot(doc(firestore, "config", "admin_settings"), (snapshot) => {
    let currentCombo = [];
    let isSponsorsHidden = false;
    if (snapshot.exists()) {
      const data = snapshot.data();
      signupEnabled = data.signupEnabled !== false;
      currentCombo = data.shortcutCombo || [];
      isSponsorsHidden = data.hideSponsors === true;
    } else {
      signupEnabled = true;
      if (currentUser) {
        setDoc(doc(firestore, "config", "admin_settings"), { signupEnabled: true, hideSponsors: false }, { merge: true }).catch(err => console.log("Seeding config deferred:", err.message));
      }
    }

    const toggleSponsorsBtn = document.getElementById("toggle-sponsors-section-btn");
    if (toggleSponsorsBtn) {
      if (isSponsorsHidden) {
        toggleSponsorsBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Show Sponsors Section';
        toggleSponsorsBtn.classList.replace("btn-outline", "btn-primary");
      } else {
        toggleSponsorsBtn.innerHTML = '<i class="fa-solid fa-eye"></i> Hide Sponsors Section';
        toggleSponsorsBtn.classList.replace("btn-primary", "btn-outline");
      }
    }

    // Update combo display
    const comboDisplay = document.getElementById("admin-combo-display");
    if (comboDisplay) {
      if (currentCombo.length === 0) {
        comboDisplay.innerHTML = `<span class="badge badge-info">None Set</span>`;
      } else {
        comboDisplay.innerHTML = currentCombo.map(k => `<kbd style="background: var(--bg-card); border: 1px solid var(--border); padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; color: var(--text-main); font-family: monospace; text-transform: uppercase;">${k}</kbd>`).join(" + ");
      }
    }

    // Update login panel toggles
    const toggleContainer = document.getElementById("signup-toggle-container");
    if (toggleContainer) {
      toggleContainer.style.display = signupEnabled ? "block" : "none";
    }

    // Update dashboard toggle views
    const dashboardToggleBtn = document.getElementById("toggle-signup-btn");
    const statusBadge = document.getElementById("signup-status-badge");
    if (statusBadge) {
      statusBadge.textContent = signupEnabled ? "Enabled" : "Disabled";
      statusBadge.className = `badge badge-${signupEnabled ? 'success' : 'danger'}`;
    }
    if (dashboardToggleBtn) {
      dashboardToggleBtn.innerHTML = signupEnabled 
        ? `<i class="fa-solid fa-toggle-on"></i> Disable Sign Up`
        : `<i class="fa-solid fa-toggle-off"></i> Enable Sign Up`;
    }

    // Redirect to login if user is currently looking at disabled signup card
    if (!signupEnabled && signupCard && signupCard.style.display === "block") {
      signupCard.style.display = "none";
      if (loginCard) loginCard.style.display = "block";
    }
  });

  // Watch landing page stats configuration
  onSnapshot(doc(firestore, "config", "landing_stats"), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const modeSelect = document.getElementById("admin-stats-participants-mode");
      const overrideInput = document.getElementById("admin-stats-participants-override");
      const dateInput = document.getElementById("admin-stats-countdown-date");
      const manualGroup = document.getElementById("admin-stats-manual-group");
      
      const subsModeSelect = document.getElementById("admin-stats-submissions-mode");
      const subsOverrideInput = document.getElementById("admin-stats-submissions-override");
      const subsManualGroup = document.getElementById("admin-stats-submissions-manual-group");

      const showCountdownCheck = document.getElementById("admin-stats-show-countdown");
      const showLeaderboardCheck = document.getElementById("admin-stats-show-leaderboard");

      if (modeSelect) modeSelect.value = data.participantsMode || "dynamic";
      if (overrideInput) overrideInput.value = data.participantsOverride || "";
      
      if (subsModeSelect) subsModeSelect.value = data.submissionsMode || "dynamic";
      if (subsOverrideInput) subsOverrideInput.value = data.submissionsOverride || "";

      if (dateInput) dateInput.value = data.countdownDate || "";
      if (showCountdownCheck) showCountdownCheck.checked = data.showCountdown !== false;
      if (showLeaderboardCheck) showLeaderboardCheck.checked = data.showLeaderboardWidget !== false;
      if (manualGroup) {
        manualGroup.style.display = (data.participantsMode === "manual") ? "block" : "none";
      }
      if (subsManualGroup) {
        subsManualGroup.style.display = (data.submissionsMode === "manual") ? "block" : "none";
      }
    } else {
      // Default initialization
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 18); // Default 18 days from now
      const defaultDateStr = defaultDate.toISOString().slice(0, 16); // format to datetime-local
      if (currentUser) {
        setDoc(doc(firestore, "config", "landing_stats"), {
          participantsMode: "dynamic",
          participantsOverride: "1,240+",
          submissionsMode: "dynamic",
          submissionsOverride: "150+",
          countdownDate: defaultDateStr,
          showCountdown: true,
          showLeaderboardWidget: true,
          timestamp: Date.now()
        }).catch(() => {});
      }
    }
  });

  // Watch rewards collection
  onSnapshot(collection(firestore, "prizes"), (snapshot) => {
    allPrizes = [];
    snapshot.forEach(d => {
      allPrizes.push({ id: d.id, ...d.data() });
    });
    allPrizes.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    if (activeAdminTab === "rewards-config") {
      renderAdminRewardsList();
    }
  });

  // Watch legal collection
  onSnapshot(collection(firestore, "legal"), (snapshot) => {
    allLegal = [];
    snapshot.forEach(d => {
      allLegal.push({ id: d.id, ...d.data() });
    });
    allLegal.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Seed default legal documents if empty
    if (snapshot.empty && currentUser) {
      const defaultLegal = [
        { id: "terms", title: "Terms & Rules", content: "1. All submitted prototypes must be original and built during the hackathon period.\n2. Teams must consist strictly of 3 members enrolled at KNUST.\n3. The judges' decision is final and binding in all aspects of the challenge.", timestamp: Date.now() },
        { id: "privacy", title: "Privacy Policy", content: "1. We collect applicant email addresses, team names, and school information solely for organizing The HatchPoint Innovations Challenge: Nyansapo Edition.\n2. Your data is stored securely using Firebase Firestore.\n3. We do not share your private contact information with third-party advertisers.", timestamp: Date.now() + 1 },
        { id: "support", title: "Contact Support", content: "For technical queries, platform assistance, or registration edits, please contact support at support@hatchpoint.knust.edu.gh or visit the KSB administration desk.", timestamp: Date.now() + 2 }
      ];
      for (const docObj of defaultLegal) {
        setDoc(doc(firestore, "legal", docObj.id), {
          title: docObj.title,
          content: docObj.content,
          timestamp: docObj.timestamp
        }).catch(err => console.error("Failed seeding legal:", err));
      }
    }
    
    renderAdminDashboard();
  });

  onSnapshot(collection(firestore, "resources"), (snapshot) => {
    allResources = [];
    snapshot.forEach(d => {
      allResources.push({ id: d.id, ...d.data() });
    });
    allResources.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    if (activeAdminTab === "resources-config") {
      renderAdminResourcesList();
    }
  });

  onSnapshot(doc(firestore, "config", "ticketing_settings"), (snapshot) => {
    if (snapshot.exists()) {
      ticketingConfig = snapshot.data();
      const toggle = document.getElementById("admin-tickets-toggle");
      const title = document.getElementById("admin-tickets-event-title");
      const date = document.getElementById("admin-tickets-event-date");
      const venue = document.getElementById("admin-tickets-event-venue");
      const limit = document.getElementById("admin-tickets-limit");
      const showSeats = document.getElementById("admin-tickets-show-seats");
      const seatPrefix = document.getElementById("admin-tickets-seat-prefix");
      const seatStart = document.getElementById("admin-tickets-seat-start");

      if (toggle) toggle.checked = ticketingConfig.ticketingEnabled === true;
      if (title) title.value = ticketingConfig.eventTitle || "";
      if (date) date.value = ticketingConfig.eventDate || "";
      if (venue) venue.value = ticketingConfig.eventVenue || "";
      if (limit) limit.value = ticketingConfig.ticketLimit || "";
      if (showSeats) showSeats.checked = ticketingConfig.showSeats !== false;
      if (seatPrefix) seatPrefix.value = ticketingConfig.seatPrefix || "GA-";
      if (seatStart) seatStart.value = ticketingConfig.seatStartNumber || 100;
    } else {
      if (currentUser) {
        setDoc(doc(firestore, "config", "ticketing_settings"), {
          ticketingEnabled: false,
          eventTitle: "HatchPoint Grand Finale Pitch Day",
          eventDate: "August 15, 2026 @ 09:00 AM",
          eventVenue: "KNUST Great Hall",
          ticketLimit: 500,
          showSeats: true,
          seatPrefix: "GA-",
          seatStartNumber: 100,
          timestamp: Date.now()
        }).catch(err => console.log("Seeding ticketing config deferred:", err.message));
      }
    }
  });

  onSnapshot(collection(firestore, "tickets"), (snapshot) => {
    allTickets = [];
    snapshot.forEach(d => {
      allTickets.push({ id: d.id, ...d.data() });
    });
    allTickets.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    const badge = document.getElementById("admin-tickets-count-badge");
    if (badge) {
      const maxLimit = ticketingConfig ? (ticketingConfig.ticketLimit || 500) : 500;
      badge.textContent = `${allTickets.length} / ${maxLimit} Booked`;
    }

    if (activeAdminTab === "tickets-config") {
      renderAdminTicketsList();
    }
  });
}

// Render Dashboard
function renderAdminDashboard() {
  if (activeAdminTab === "overview") {
    // 1. Compute Stats
    document.getElementById("admin-stat-registrations").textContent = allProjects.reduce((acc, p) => acc + (p.members ? p.members.length : 0), 0);
    document.getElementById("admin-stat-teams").textContent = allProjects.length;
    document.getElementById("admin-stat-submissions").textContent = allProjects.filter(p => p.status === "Approved" || p.status === "Under Review" || p.status === "Pending").length;
    document.getElementById("admin-stat-tracks").textContent = allTracks.filter(t => t.visible !== false).length;

    // 2. Compute Track distribution chart
    const totalDist = Math.max(1, allProjects.length);
    const distContainer = document.getElementById("admin-chart-distribution");
    if (distContainer) {
      if (allTracks.length === 0) {
        distContainer.innerHTML = `<p style="text-align: center; color: var(--text-light); font-size: 13px;">No tracks configured.</p>`;
      } else {
        const colors = ["var(--primary)", "var(--secondary)", "var(--accent)", "var(--success)", "var(--warning)", "var(--danger)"];
        distContainer.innerHTML = allTracks.map((track, idx) => {
          const count = allProjects.filter(p => p.track === track.id).length;
          const color = colors[idx % colors.length];
          return `
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                <span><i class="fa-solid ${track.icon || 'fa-tag'}"></i> ${track.name}</span>
                <strong>${count} teams</strong>
              </div>
              <div class="progress-bar"><div class="progress-bar-fill" style="width: ${(count / totalDist) * 100}%; background-color: ${color};"></div></div>
            </div>
          `;
        }).join("");
      }
    }

    // 3. Compute ratios
    const approvedCount = allProjects.filter(p => p.status === "Approved").length;
    const pendingCount = allProjects.filter(p => p.status === "Pending").length;
    const totalProj = Math.max(1, allProjects.length);

    const ratioContainer = document.getElementById("admin-submission-ratios");
    if (ratioContainer) {
      ratioContainer.innerHTML = `
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
            <span>Approved Submissions</span>
            <strong>${((approvedCount / totalProj) * 100).toFixed(0)}% (${approvedCount})</strong>
          </div>
          <div class="progress-bar"><div class="progress-bar-fill" style="width: ${(approvedCount / totalProj) * 100}%; background-color: var(--success);"></div></div>
        </div>
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
            <span>Pending Review</span>
            <strong>${((pendingCount / totalProj) * 100).toFixed(0)}% (${pendingCount})</strong>
          </div>
          <div class="progress-bar"><div class="progress-bar-fill" style="width: ${(pendingCount / totalProj) * 100}%; background-color: var(--warning);"></div></div>
        </div>
      `;
    }
  }

  else if (activeAdminTab === "applicants") {
    const tableBody = document.getElementById("admin-applicants-table-body");
    if (!tableBody) return;

    if (allProjects.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-light); padding: 40px;">No applicants registered yet.</td></tr>`;
      return;
    }

    tableBody.innerHTML = allProjects.map(p => {
      const statusClass = `badge badge-${p.status === 'Approved' ? 'success' : p.status === 'Pending' ? 'warning' : 'info'}`;
      const scoreText = p.averageScore ? `${p.averageScore}/100` : `<span style="color: var(--text-light); font-size: 11px;">Not Graded</span>`;
      
      const trackObj = allTracks.find(t => t.id === p.track);
      const trackName = trackObj ? trackObj.name : p.track;

      let actionButtons = "";
      if (p.status === "Pending") {
        actionButtons = `
          <button class="btn btn-outline btn-sm" onclick="adminApproveProject('${p.id}', true)" style="color: var(--success); border-color: var(--success);"><i class="fa-solid fa-circle-check"></i> Approve</button>
          <button class="btn btn-outline btn-sm" onclick="adminApproveProject('${p.id}', false)" style="color: var(--danger); border-color: var(--danger);"><i class="fa-solid fa-circle-xmark"></i> Reject</button>
        `;
      } else {
        actionButtons = `
          <div style="display: inline-flex; align-items: center; gap: 8px;">
            <span style="font-size: 12px; color: var(--text-light);"><i class="fa-solid fa-square-poll-vertical"></i> Logged</span>
            <button class="btn btn-outline btn-sm" onclick="adminDeleteProject('${p.id}')" style="color: var(--danger); border-color: var(--danger); padding: 2px 6px; font-size: 10px; display: inline-flex; align-items: center; gap: 4px; background: transparent; cursor: pointer; border-radius: 4px; border: 1px solid var(--danger);">
              <i class="fa-solid fa-trash-can"></i> Delete
            </button>
          </div>
        `;
      }

      const regDate = p.timestamp ? new Date(p.timestamp).toLocaleString() : 'Date Unknown';
      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--text-main);">${p.teamName}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;"><i class="fa-regular fa-clock"></i> ${regDate}</div>
          </td>
          <td>
            <div style="font-size: 13px; color: var(--text-muted);">${(p.members || []).join(", ")}</div>
            <div style="font-size: 11px; color: var(--text-light);">${p.leadEmail}</div>
          </td>
          <td><span style="font-size: 13px;">${trackName}</span></td>
          <td><span class="${statusClass}">${p.status}</span></td>
          <td><strong>${scoreText}</strong></td>
          <td style="display: flex; gap: 8px; align-items: center;">
            <button class="btn btn-secondary btn-sm" onclick="adminViewProjectDetails('${p.id}')"><i class="fa-solid fa-circle-info"></i> Details</button>
            ${actionButtons}
          </td>
        </tr>
      `;
    }).join("");
  }

  else if (activeAdminTab === "form-config") {
    renderAdminCustomFieldsList();
  }

  else if (activeAdminTab === "tracks-config") {
    renderAdminTracksList();
  }
  else if (activeAdminTab === "features-config") {
    renderAdminFeaturesList();
  }

  else if (activeAdminTab === "timeline-config") {
    renderAdminTimelineList();
  }

  else if (activeAdminTab === "news-compose") {
    renderAdminNewsList();
  }
  else if (activeAdminTab === "rewards-config") {
    renderAdminRewardsList();
  }
  else if (activeAdminTab === "legal-config") {
    renderAdminLegalList();
  }
  else if (activeAdminTab === "resources-config") {
    renderAdminResourcesList();
  }
  else if (activeAdminTab === "tickets-config") {
    renderAdminTicketsList();
  }
}

// Render the published news articles list in the admin news-compose tab
function renderAdminNewsList() {
  const container = document.getElementById("admin-news-list");
  if (!container) return;

  if (allNews.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-light); font-size: 13px; padding: 24px 0;"><i class="fa-solid fa-inbox"></i> No articles published yet.</p>`;
    return;
  }

  // Fallback stock images keyed by the img field
  const stockImages = {
    code: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=400&q=80",
    meeting: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=400&q=80",
    presentation: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=400&q=80",
    launch: "https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&w=400&q=80"
  };

  const categoryColors = {
    "Announcements": "var(--primary)",
    "Workshops": "var(--secondary)",
    "Deadlines": "var(--danger)",
    "Success Stories": "var(--success)",
    "Partner News": "var(--accent)"
  };

  container.innerHTML = allNews.map(article => {
    const catColor = categoryColors[article.category] || "var(--text-light)";
    const preview = (article.content || "").substring(0, 70) + ((article.content || "").length > 70 ? "..." : "");
    const dateStr = article.timestamp ? new Date(article.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
    const imgSrc = article.coverImage || stockImages[article.img] || stockImages.code;

    return `
      <div style="border: 1px solid var(--border); border-radius: var(--radius-md); padding: 10px 12px; background: var(--bg-app); display: flex; align-items: center; gap: 12px;">
        <img src="${imgSrc}" alt="${article.title}" style="width: 72px; height: 72px; object-fit: cover; border-radius: var(--radius-sm); flex-shrink: 0;" onerror="this.src='${stockImages.code}'">
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;">
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: ${catColor}; letter-spacing: 0.05em;">${article.category} &bull; ${dateStr}</div>
          <div style="font-size: 13px; font-weight: 700; color: var(--text-main); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${article.title}</div>
          <p style="font-size: 11px; color: var(--text-muted); line-height: 1.4; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${preview}</p>
          <div style="display: flex; gap: 6px; margin-top: 4px;">
            <button class="btn btn-secondary btn-sm" onclick="adminEditNews('${article.id}')" style="font-size: 11px; padding: 3px 10px;">
              <i class="fa-solid fa-pen-to-square"></i> Edit
            </button>
            <button class="btn btn-outline btn-sm" onclick="adminDeleteNews('${article.id}')" style="color: var(--danger); border-color: var(--danger); font-size: 11px; padding: 3px 10px;">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// Render Custom Fields List
function renderAdminCustomFieldsList() {
  const container = document.getElementById("admin-active-fields-list");
  if (!container) return;

  if (activeCustomFields.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-light); font-size: 13px; padding: 20px;">No custom parameters added yet.</p>`;
    return;
  }

  container.innerHTML = activeCustomFields.map(field => `
    <div style="display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--border); padding: 12px; border-radius: var(--radius-sm); background: var(--bg-app);">
      <div>
        <div style="font-weight: 600; font-size: 13px; color: var(--text-main);">${field.label}</div>
        <div style="font-size: 11px; color: var(--text-light);">Key: ${field.key} | Type: ${field.type}</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="adminDeleteCustomField('${field.key}')" style="color: var(--danger); border-color: var(--danger); padding: 4px 8px;"><i class="fa-solid fa-trash-can"></i> Delete</button>
    </div>
  `).join("");
}

// Action Handlers
async function adminApproveProject(projId, isApprove) {
  try {
    const status = isApprove ? "Approved" : "Rejected";
    showToast(`Marking team as ${status}...`, "info");
    await updateDoc(doc(firestore, "projects", projId), { status });
    showToast(`Team updated successfully to ${status}!`, "success");
  } catch (err) {
    showToast("Update failed: " + getCleanErrorMessage(err), "error");
  }
}

async function adminDeleteCustomField(fieldKey) {
  const updatedFields = activeCustomFields.filter(f => f.key !== fieldKey);
  try {
    showToast("Deleting field configuration...", "info");
    await setDoc(doc(firestore, "config", "registration_form"), {
      customFields: updatedFields
    }, { merge: true });
    showToast("Custom field removed successfully!", "success");
  } catch (err) {
    showToast("Deletion failed: " + getCleanErrorMessage(err), "error");
  }
}

function adminViewProjectDetails(projId) {
  const proj = allProjects.find(p => p.id === projId);
  if (!proj) return;

  // Resolve track name — fall back to title-casing the ID if not found
  const trackObj = allTracks.find(t => t.id === proj.track);
  const trackName = trackObj
    ? trackObj.name
    : (proj.track || "Unknown").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  // Derive file type from BOTH stored conceptNoteType AND the filename extension (filename wins if they disagree)
  const fileNameExt = (proj.conceptNoteName || "").split(".").pop().toLowerCase();
  const storedType  = (proj.conceptNoteType || "").toLowerCase();
  const resolvedExt = fileNameExt || storedType;

  let fileIcon  = "fa-file";
  let fileColor = "var(--text-light)";
  if (["pdf"].includes(resolvedExt)) {
    fileIcon  = "fa-file-pdf";
    fileColor = "#e0443e";
  } else if (["pptx", "ppt"].includes(resolvedExt)) {
    fileIcon  = "fa-file-powerpoint";
    fileColor = "#d24726";
  } else if (["docx", "doc"].includes(resolvedExt)) {
    fileIcon  = "fa-file-word";
    fileColor = "#2b579a";
  }

  const downloadLink = proj.conceptNoteUrl
    ? `<div style="margin-top: 6px;"><button type="button" onclick="downloadConceptNote('${proj.id}')" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; font-size: 11px; cursor: pointer; border: 1px solid var(--border);"><i class="fa-solid fa-file-arrow-down"></i> Read &amp; Download</button></div>`
    : `<div style="font-size: 11px; color: var(--text-light); margin-top: 4px;"><i class="fa-solid fa-triangle-exclamation"></i> No download URL available</div>`;

  const customFieldsHTML = Object.entries(proj.customFields || {}).map(([key, val]) => `
    <div style="margin-bottom: 8px; border-bottom: 1px solid var(--border); padding-bottom: 4px;">
      <div style="font-size: 12px; color: var(--text-light); text-transform: uppercase;">${key}</div>
      <div style="font-size: 14px; color: var(--text-main); font-weight: 500; white-space: pre-wrap; word-break: break-word;">${val || 'N/A'}</div>
    </div>
  `).join("");

  const membersHTML = (proj.members || []).map((m, idx) => `
    <div style="border: 1px solid var(--border); padding: 10px; border-radius: var(--radius-sm); background: var(--bg-app);">
      <div style="font-weight: 600; font-size: 13px; color: var(--text-main);">Builder ${idx + 1}: ${m}</div>
      <div style="font-size: 12px; color: var(--text-muted);">Email: ${proj.emails ? proj.emails[idx] : ''}</div>
      <div style="font-size: 12px; color: var(--text-muted);">Phone: ${proj.contacts ? proj.contacts[idx] : ''}</div>
    </div>
  `).join("");

  // Status badge colour — cover all known states
  const statusBadge = proj.status === "Approved"
    ? `<span class="badge badge-success">${proj.status}</span>`
    : proj.status === "Rejected"
      ? `<span class="badge badge-danger">${proj.status}</span>`
      : `<span class="badge badge-warning">${proj.status || 'Pending'}</span>`;

  openModal(`Team Details: ${proj.teamName}`, `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      
      <!-- Row 1: Basic Submissions (Horizontal grid) -->
      <div>
        <h4 style="margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 4px; color: var(--primary);"><i class="fa-solid fa-circle-info"></i> Basic Submissions</h4>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
          <div>
            <label style="font-size: 11px; text-transform: uppercase; color: var(--text-light); display: block; margin-bottom: 2px;">Focus Track</label>
            <div style="font-size: 13px; font-weight: 600; color: var(--text-main);">${trackName}</div>
          </div>
          <div>
            <label style="font-size: 11px; text-transform: uppercase; color: var(--text-light); display: block; margin-bottom: 2px;">Concept File</label>
            <div style="font-size: 12px; font-weight: 600; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid ${fileIcon}" style="color: ${fileColor}; flex-shrink: 0;"></i>
              <span style="word-break: break-all; line-height: 1.2;">${proj.conceptNoteName || 'concept_note.pdf'}</span>
            </div>
            ${downloadLink}
          </div>
          <div>
            <label style="font-size: 11px; text-transform: uppercase; color: var(--text-light); display: block; margin-bottom: 2px;">Registration Status</label>
            <div>${statusBadge}</div>
          </div>
          <div>
            <label style="font-size: 11px; text-transform: uppercase; color: var(--text-light); display: block; margin-bottom: 2px;">Registration Date</label>
            <div style="font-size: 12px; font-weight: 600; color: var(--text-main);"><i class="fa-regular fa-clock"></i> ${proj.timestamp ? new Date(proj.timestamp).toLocaleString() : 'Date Unknown'}</div>
          </div>
        </div>
      </div>

      <!-- Row 2: Team Members (Horizontal grid) -->
      <div>
        <h4 style="margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 4px; color: var(--accent);"><i class="fa-solid fa-users"></i> Team Members (3 slots)</h4>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
          ${membersHTML}
        </div>
      </div>

      <!-- Row 3: Custom Fields / Additional Details (Horizontal grid) -->
      ${proj.customFields && Object.keys(proj.customFields).length > 0 ? `
      <div>
        <h4 style="margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 4px; color: var(--secondary);"><i class="fa-solid fa-list-check"></i> Additional Details</h4>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
          ${customFieldsHTML}
        </div>
      </div>
      ` : ''}

      <!-- Row 4: Evaluation & Grading (Horizontal layout) -->
      <div>
        <h4 style="margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 4px; color: var(--warning);"><i class="fa-solid fa-graduation-cap"></i> Evaluation &amp; Grading</h4>
        <form id="admin-grade-form" onsubmit="adminSaveGrades(event, '${proj.id}')" style="background: var(--bg-app); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 16px;">
          
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 12px; color: var(--text-muted); font-weight: 500;">Innovation (25%)</label>
              <input type="number" id="grade-innovation" min="0" max="25" step="0.5" class="form-control" style="font-size: 13px; padding: 6px 10px;" value="${proj.scores?.innovation || ''}" oninput="if(parseFloat(this.value) > 25) this.value = 25; if(parseFloat(this.value) < 0) this.value = 0;" required>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 12px; color: var(--text-muted); font-weight: 500;">Technical Execution (25%)</label>
              <input type="number" id="grade-technical" min="0" max="25" step="0.5" class="form-control" style="font-size: 13px; padding: 6px 10px;" value="${proj.scores?.technical || ''}" oninput="if(parseFloat(this.value) > 25) this.value = 25; if(parseFloat(this.value) < 0) this.value = 0;" required>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 12px; color: var(--text-muted); font-weight: 500;">Impact &amp; Viability (25%)</label>
              <input type="number" id="grade-impact" min="0" max="25" step="0.5" class="form-control" style="font-size: 13px; padding: 6px 10px;" value="${proj.scores?.impact || ''}" oninput="if(parseFloat(this.value) > 25) this.value = 25; if(parseFloat(this.value) < 0) this.value = 0;" required>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 12px; color: var(--text-muted); font-weight: 500;">Design &amp; UX (25%)</label>
              <input type="number" id="grade-design" min="0" max="25" step="0.5" class="form-control" style="font-size: 13px; padding: 6px 10px;" value="${proj.scores?.design || ''}" oninput="if(parseFloat(this.value) > 25) this.value = 25; if(parseFloat(this.value) < 0) this.value = 0;" required>
            </div>
          </div>
          
          <div style="border-top: 1px dashed var(--border); padding-top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 13px; font-weight: 600; color: var(--text-main);">Current Score:</span>
              <strong id="grade-average-display" style="font-size: 16px; color: var(--primary);">${proj.averageScore ? proj.averageScore + '/100' : 'Not Graded'}</strong>
            </div>
            <button type="submit" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; font-size: 12px; cursor: pointer;"><i class="fa-solid fa-floppy-disk"></i> Save Scores</button>
          </div>
          
        </form>
      </div>

    </div>
  `, true);
}

// News compose / edit submission
const adminNewsForm = document.getElementById("admin-news-form");
if (adminNewsForm) {
  adminNewsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const editId = document.getElementById("news-edit-id").value.trim();
    const title = document.getElementById("news-title").value.trim();
    const category = document.getElementById("news-cat-select").value;
    const img = document.getElementById("news-img-select").value;
    const content = document.getElementById("news-body-content").value.trim();
    const imgFileInput = document.getElementById("news-img-file");
    const imgFile = imgFileInput ? imgFileInput.files[0] : null;

    const submitBtn = document.getElementById("btn-news-submit");
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; }

    try {
      // Encode cover image as base64 if one was selected
      let coverImage = "";
      if (imgFile) {
        showToast("Processing cover image...", "info");
        coverImage = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = (e) => reject(new Error("File reading failed."));
          reader.readAsDataURL(imgFile);
        });
        
        // Update the hint span so admin can see the status
        const hintEl = document.getElementById("news-current-img-url");
        if (hintEl) { hintEl.textContent = `✅ Image attached`; hintEl.style.display = "block"; }
      }

      if (editId) {
        // Build update payload - only include coverImage if a new one was uploaded
        const updatePayload = { title, category, img, content };
        if (coverImage) updatePayload.coverImage = coverImage;
        showToast("Saving article changes...", "info");
        await updateDoc(doc(firestore, "news", editId), updatePayload);
        showToast("Article updated successfully!", "success");
        adminCancelNewsEdit();
      } else {
        showToast("Publishing article...", "info");
        await addDoc(collection(firestore, "news"), {
          title,
          category,
          img,
          content,
          coverImage,
          timestamp: Date.now()
        });
        showToast("Published article successfully!", "success");
        adminNewsForm.reset();
        const hintEl = document.getElementById("news-current-img-url");
        if (hintEl) hintEl.style.display = "none";
      }
    } catch (err) {
      showToast("Failed to save: " + getCleanErrorMessage(err), "error");
    } finally {
      if (submitBtn) {
        const editIdNow = document.getElementById("news-edit-id")?.value;
        submitBtn.disabled = false;
        submitBtn.innerHTML = editIdNow
          ? '<i class="fa-solid fa-floppy-disk"></i> Save Changes'
          : '<i class="fa-solid fa-paper-plane"></i> Publish Article';
      }
    }
  });

  // Cancel button resets to Compose mode
  const cancelNewsBtn = document.getElementById("btn-news-cancel");
  if (cancelNewsBtn) {
    cancelNewsBtn.addEventListener("click", adminCancelNewsEdit);
  }
}

// Pre-fill the news form for editing an existing article
function adminEditNews(articleId) {
  const article = allNews.find(n => n.id === articleId);
  if (!article) return;

  document.getElementById("news-edit-id").value = article.id;
  document.getElementById("news-title").value = article.title || "";
  document.getElementById("news-cat-select").value = article.category || "Announcements";
  document.getElementById("news-img-select").value = article.img || "code";
  document.getElementById("news-body-content").value = article.content || "";

  // Show existing cover image hint
  const hintEl = document.getElementById("news-current-img-url");
  if (hintEl) {
    if (article.coverImage) {
      hintEl.innerHTML = `<i class="fa-solid fa-image"></i> Current cover: <a href="${article.coverImage}" target="_blank" style="color: var(--success);">View image</a> (upload new to replace)`;
      hintEl.style.display = "block";
    } else {
      hintEl.style.display = "none";
    }
  }

  // Switch form to Edit mode
  const formTitle = document.getElementById("news-form-title");
  const submitBtn = document.getElementById("btn-news-submit");
  const cancelBtn = document.getElementById("btn-news-cancel");

  if (formTitle) formTitle.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editing Article';
  if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
  if (cancelBtn) cancelBtn.style.display = "inline-flex";

  // Scroll to top of the form
  const formCard = adminNewsForm ? adminNewsForm.closest(".card") : null;
  if (formCard) formCard.scrollIntoView({ behavior: "smooth" });
}

// Reset news form back to Compose New mode
function adminCancelNewsEdit() {
  const editIdInput = document.getElementById("news-edit-id");
  if (editIdInput) editIdInput.value = "";

  if (adminNewsForm) adminNewsForm.reset();

  const formTitle = document.getElementById("news-form-title");
  const submitBtn = document.getElementById("btn-news-submit");
  const cancelBtn = document.getElementById("btn-news-cancel");

  if (formTitle) formTitle.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Compose News Article';
  if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publish Article';
  if (cancelBtn) cancelBtn.style.display = "none";
}

// Delete a news article by ID
async function adminDeleteNews(articleId) {
  if (!confirm("Delete this article? This cannot be undone.")) return;
  try {
    showToast("Deleting article...", "info");
    await deleteDoc(doc(firestore, "news", articleId));
    showToast("Article deleted successfully!", "success");
    // If we were editing this article, reset the form
    const editId = document.getElementById("news-edit-id");
    if (editId && editId.value === articleId) adminCancelNewsEdit();
  } catch (err) {
    showToast("Deletion failed: " + getCleanErrorMessage(err), "error");
  }
}

// Expose on window for inline onclick handlers
window.adminEditNews = adminEditNews;
window.adminDeleteNews = adminDeleteNews;

// Form configurator submission
const addFieldForm = document.getElementById("admin-add-field-form");
if (addFieldForm) {
  addFieldForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const label = document.getElementById("admin-field-label").value.trim();
    const type = document.getElementById("admin-field-type").value;
    const key = label.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (!key) {
      showToast("Invalid field label.", "error");
      return;
    }

    if (activeCustomFields.find(f => f.key === key)) {
      showToast("Custom field key already exists.", "error");
      return;
    }

    const updatedFields = [...activeCustomFields, { key, label, type }];
    try {
      showToast("Saving custom field...", "info");
      await setDoc(doc(firestore, "config", "registration_form"), {
        customFields: updatedFields
      }, { merge: true });
      showToast("Custom field added successfully!", "success");
      addFieldForm.reset();
    } catch (err) {
      showToast("Failed to save field: " + getCleanErrorMessage(err), "error");
    }
  });
}

// Admin Deadline Status Submission
const deadlineForm = document.getElementById("admin-deadline-form");
if (deadlineForm) {
  deadlineForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const closed = document.getElementById("admin-registration-closed").checked;
    const hideTag = document.getElementById("admin-registration-hide-tag") ? document.getElementById("admin-registration-hide-tag").checked : false;
    const swapNav = document.getElementById("admin-registration-swap-nav") ? document.getElementById("admin-registration-swap-nav").checked : false;
    const saveBtn = document.getElementById("admin-save-deadline-btn");
    const originalBtnHTML = saveBtn.innerHTML;

    try {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';
      showToast("Updating registration deadline status...", "info");
      await setDoc(doc(firestore, "config", "registration_form"), {
        registrationClosed: closed,
        hideRegistrationTag: hideTag,
        swapNavToLeaderboard: swapNav
      }, { merge: true });
      showToast("Registration status updated successfully!", "success");
    } catch (err) {
      showToast("Failed to save status: " + getCleanErrorMessage(err), "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalBtnHTML;
    }
  });
}

// Copy Share Link
const copyShareBtn = document.getElementById("admin-copy-share-btn");
if (copyShareBtn) {
  copyShareBtn.addEventListener("click", () => {
    const url = window.location.origin + window.location.pathname.replace("admin.html", "index.html") + "?ref=share";
    navigator.clipboard.writeText(url).then(() => {
      showToast("Share link copied to clipboard!", "success");
    }).catch(err => {
      showToast("Failed to copy link.", "error");
    });
  });
}

// Drawer Toggle Logic
const drawerToggle = document.getElementById("admin-drawer-toggle");
const portalSidebar = document.querySelector(".portal-sidebar");
const portalLayout = document.querySelector(".portal-layout");

if (drawerToggle && portalSidebar && portalLayout) {
  drawerToggle.addEventListener("click", () => {
    portalSidebar.classList.toggle("hidden");
    portalLayout.classList.toggle("drawer-hidden");
  });
}

// Reset Traffic Data
const resetTrafficBtn = document.getElementById("admin-reset-traffic-btn");
if (resetTrafficBtn) {
  resetTrafficBtn.addEventListener("click", async () => {
    if (confirm("Are you sure you want to reset all traffic stats to zero? This action cannot be undone.")) {
      try {
        await setDoc(doc(firestore, "analytics", "traffic"), {
          total_page_views: 0,
          shared_link_clicks: 0
        }, { merge: true });
        showToast("Traffic stats reset successfully.", "success");
      } catch (err) {
        showToast("Failed to reset traffic: " + getCleanErrorMessage(err), "error");
      }
    }
  });
}

// View Traffic Details
const viewTrafficBtn = document.getElementById("admin-view-traffic-btn");
if (viewTrafficBtn) {
  viewTrafficBtn.addEventListener("click", async () => {
    try {
      showToast("Fetching traffic logs...", "info");
      const q = query(collection(firestore, "analytics", "traffic", "visits"), orderBy("timestamp", "desc"), limit(50));
      const snap = await getDocs(q);
      
      let html = `<div style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 8px;">`;
      if (snap.empty) {
        html += `<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px;">No recent traffic logs found.</div>`;
      } else {
        snap.forEach(docSnap => {
          const data = docSnap.data();
          const time = data.timestamp ? data.timestamp.toDate().toLocaleString() : "Just now";
          const isShare = data.isShareClick ? `<span class="badge badge-success" style="font-size: 10px; padding: 2px 4px; margin-left: 6px;">Share Link</span>` : '';
          
          html += `
            <div style="background: var(--bg-app); border: 1px solid var(--border); padding: 10px; border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 4px;">
              <div style="font-size: 13px; font-weight: 600; color: var(--text-main); word-break: break-all;">${data.path || '/'} ${isShare}</div>
              <div style="font-size: 11px; color: var(--text-muted);"><i class="fa-solid fa-clock"></i> ${time}</div>
            </div>
          `;
        });
      }
      html += `</div>`;
      
      modalTitle.textContent = "Recent Page Views (Last 50)";
      modalBody.innerHTML = html;
      infoModal.classList.add("open");
      // Add small delay then hide toast
      setTimeout(() => {
        const toast = document.getElementById("toast");
        if(toast) toast.classList.remove("show");
      }, 500);
    } catch (err) {
      showToast("Failed to fetch traffic logs: " + getCleanErrorMessage(err), "error");
    }
  });
}

// Export CSV Data
const exportCSVBtn = document.getElementById("admin-export-btn");
if (exportCSVBtn) {
  exportCSVBtn.addEventListener("click", () => {
    if (allProjects.length === 0) {
      showToast("No registrants to export.", "error");
      return;
    }

    showToast("Compiling registry CSV...", "info");
    
    // Compile custom keys headers
    const customHeadersSet = new Set();
    allProjects.forEach(p => {
      Object.keys(p.customFields || {}).forEach(k => customHeadersSet.add(k));
    });
    const customHeaders = Array.from(customHeadersSet);

     // Build header row
    const headers = [
      "Team Name", "Project Title", "Track", "Status", "Grade",
      "Member 1 Name", "Member 1 Email", "Member 1 Contact",
      "Member 2 Name", "Member 2 Email", "Member 2 Contact",
      "Member 3 Name", "Member 3 Email", "Member 3 Contact",
      "Concept Note Name", "Concept Note URL", "Submission Date",
      ...customHeaders
    ];

    const rows = allProjects.map(p => {
      // Prevent massive base64 strings from crashing the CSV
      const safeUrl = p.conceptNoteUrl ? (p.conceptNoteUrl.startsWith('data:') ? 'Base64 Encoded (View in App)' : p.conceptNoteUrl) : '';

      const basic = [
        p.teamName, p.title, p.track, p.status, p.averageScore || 'N/A',
        p.members ? p.members[0] : '', p.emails ? p.emails[0] : '', p.contacts ? p.contacts[0] : '',
        p.members ? p.members[1] : '', p.emails ? p.emails[1] : '', p.contacts ? p.contacts[1] : '',
        p.members ? p.members[2] : '', p.emails ? p.emails[2] : '', p.contacts ? p.contacts[2] : '',
        p.conceptNoteName || '', safeUrl,
        p.timestamp ? new Date(p.timestamp).toLocaleString() : ''
      ];
      
      const customVals = customHeaders.map(h => (p.customFields || {})[h] || '');
      return [...basic, ...customVals].map(val => `"${String(val).replace(/"/g, '""')}"`).join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `hatchpoint_registrations_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV registry downloaded!", "success");
  });
}

async function seedDefaultsIfEmpty() {
  if (!currentUser) return;
  try {
    // 1. Seed legal documents if empty
    const legalSnap = await getDocs(collection(firestore, "legal"));
    if (legalSnap.empty) {
      const defaultLegal = [
        { id: "terms", title: "Terms & Rules", content: "1. All submitted prototypes must be original and built during the hackathon period.\n2. Teams must consist strictly of 3 members enrolled at KNUST.\n3. The judges' decision is final and binding in all aspects of the challenge.", timestamp: Date.now() },
        { id: "privacy", title: "Privacy Policy", content: "1. We collect applicant email addresses, team names, and school information solely for organizing The HatchPoint Innovations Challenge: Nyansapo Edition.\n2. Your data is stored securely using Firebase Firestore.\n3. We do not share your private contact information with third-party advertisers.", timestamp: Date.now() + 1 },
        { id: "support", title: "Contact Support", content: "For technical queries, platform assistance, or registration edits, please contact support at support@hatchpoint.knust.edu.gh or visit the KSB administration desk.", timestamp: Date.now() + 2 }
      ];
      for (const docObj of defaultLegal) {
        await setDoc(doc(firestore, "legal", docObj.id), {
          title: docObj.title,
          content: docObj.content,
          timestamp: docObj.timestamp
        });
      }
    }

    // 2. Seed landing page stats countdown config if empty
    const statsSnap = await getDoc(doc(firestore, "config", "landing_stats"));
    if (!statsSnap.exists()) {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 18);
      const defaultDateStr = defaultDate.toISOString().slice(0, 16);
      await setDoc(doc(firestore, "config", "landing_stats"), {
        participantsMode: "dynamic",
        participantsOverride: "1,240+",
        countdownDate: defaultDateStr,
        timestamp: Date.now()
      });
    }

    // 3. Seed prizes (rewards) if empty
    const prizesSnap = await getDocs(collection(firestore, "prizes"));
    if (prizesSnap.empty) {
      const defaultPrizes = [
        { id: "p1", title: "First Prize / Gold", description: "GH₵ 20,000 cash prize, 6 months incubation workspace, direct investor pitching slot.", timestamp: Date.now() },
        { id: "p2", title: "Second Prize / Silver", description: "GH₵ 10,000 cash prize, 3 months workspace access, prototype refinement mentorship.", timestamp: Date.now() + 1 },
        { id: "p3", title: "Third Prize / Bronze", description: "GH₵ 5,000 cash prize, expert business design review sessions.", timestamp: Date.now() + 2 }
      ];
      for (const docObj of defaultPrizes) {
        await setDoc(doc(firestore, "prizes", docObj.id), {
          title: docObj.title,
          description: docObj.description,
          timestamp: docObj.timestamp
        });
      }
    }
    // 4. Seed tracks if empty
    const tracksSnap = await getDocs(collection(firestore, "tracks"));
    if (tracksSnap.empty) {
      const defaultTracks = [
        { id: "clean-energy", name: "Clean Energy & Environment", icon: "fa-leaf", desc: "Build systems that reduce carbon footprint, manage resources sustainably, or transition to clean power.", visible: true },
        { id: "fintech", name: "Fintech & Financial Inclusion", icon: "fa-wallet", desc: "Create tools that democratize access to capital, optimize banking, or streamline micro-payments.", visible: true },
        { id: "healthtech", name: "Healthcare & MedTech", icon: "fa-heart-pulse", desc: "Develop software or devices that improve patient telemetry, diagnosis, or health administrative tasks.", visible: true }
      ];
      for (const tr of defaultTracks) {
        await setDoc(doc(firestore, "tracks", tr.id), {
          name: tr.name,
          icon: tr.icon,
          desc: tr.desc,
          visible: tr.visible,
          timestamp: Date.now()
        });
      }
    }
  } catch (err) {
    console.error("Error checking or seeding defaults:", err);
  }
}

// Authentication Lifecycle
onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser) {
    let userDocSnap = await getDoc(doc(firestore, "users", firebaseUser.uid));
    if (!userDocSnap.exists()) {
      // Add slight delay retry to prevent race conditions during admin signup
      await new Promise(resolve => setTimeout(resolve, 800));
      userDocSnap = await getDoc(doc(firestore, "users", firebaseUser.uid));
    }

    if (userDocSnap.exists()) {
      currentUser = { uid: firebaseUser.uid, ...userDocSnap.data() };
    } else {
      currentUser = null;
    }

    if (currentUser && currentUser.isAdmin) {
      adminLoginView.style.display = "none";
      adminDashboardView.style.display = "flex";
      seedDefaultsIfEmpty();
      renderAdminDashboard();
    } else {
      // Reject non-admins
      showToast("Access Denied. Only organizers/admins are allowed to log in.", "error");
      await signOut(auth);
    }
  } else {
    currentUser = null;
    adminDashboardView.style.display = "none";
    adminLoginView.style.display = "flex";
  }
});

// Render Challenge Tracks config panel list
function renderAdminTracksList() {
  const container = document.getElementById("admin-tracks-list");
  if (!container) return;

  if (allTracks.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-light); font-size: 13px; padding: 20px;">No tracks configured. Add one on the left.</p>`;
    return;
  }

  container.innerHTML = allTracks.map(track => {
    const visibilityBadge = track.visible !== false 
      ? `<span class="badge badge-success" style="font-size: 10px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-eye"></i> Visible</span>`
      : `<span class="badge badge-danger" style="font-size: 10px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-eye-slash"></i> Hidden</span>`;
      
    return `
      <div style="border: 1px solid var(--border); padding: 16px; border-radius: var(--radius-md); background: var(--bg-app); display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--text-main); font-size: 14px;">
            <i class="fa-solid ${track.icon || 'fa-tag'}" style="color: var(--primary);"></i> ${track.name}
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${visibilityBadge}
            <span style="font-size: 11px; color: var(--text-light); background: var(--border); padding: 2px 6px; border-radius: var(--radius-sm);">ID: ${track.id}</span>
          </div>
        </div>
        <p style="font-size: 12px; color: var(--text-muted); margin: 0; line-height: 1.5;">${track.desc}</p>
        <div style="display: flex; gap: 8px; margin-top: 8px; border-top: 1px dashed var(--border); padding-top: 8px; justify-content: flex-end;">
          <button class="btn btn-secondary btn-sm" onclick="adminEditTrack('${track.id}')" style="padding: 4px 8px; font-size: 11px;"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
          <button class="btn btn-outline btn-sm" onclick="adminToggleTrackVisibility('${track.id}', ${track.visible !== false})" style="padding: 4px 8px; font-size: 11px;"><i class="fa-solid fa-eye-slash"></i> Toggle Visibility</button>
          <button class="btn btn-outline btn-sm" onclick="adminDeleteTrack('${track.id}')" style="color: var(--danger); border-color: var(--danger); padding: 4px 8px; font-size: 11px;"><i class="fa-solid fa-trash-can"></i> Delete</button>
        </div>
      </div>
    `;
  }).join("");
}

// Track Image Handlers
let currentTrackImageBase64 = null;
const adminTrackImageInput = document.getElementById("admin-track-image");
const adminTrackImagePreview = document.getElementById("admin-track-image-preview");
const adminTrackImageRemove = document.getElementById("admin-track-image-remove");
const adminTrackImageHide = document.getElementById("admin-track-image-hide");
const adminTrackImageHideLabel = document.getElementById("admin-track-image-hide-label");

if (adminTrackImageInput) {
  adminTrackImageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast("Image must be smaller than 2MB", "error");
        adminTrackImageInput.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        currentTrackImageBase64 = event.target.result;
        adminTrackImagePreview.src = currentTrackImageBase64;
        adminTrackImagePreview.style.display = "block";
        adminTrackImageRemove.style.display = "inline-block";
        adminTrackImageHide.style.display = "inline-block";
        adminTrackImageHideLabel.style.display = "inline-block";
      };
      reader.readAsDataURL(file);
    }
  });
}

if (adminTrackImageRemove) {
  adminTrackImageRemove.addEventListener("click", () => {
    currentTrackImageBase64 = null;
    adminTrackImagePreview.src = "";
    adminTrackImagePreview.style.display = "none";
    adminTrackImageInput.value = "";
    adminTrackImageRemove.style.display = "none";
    adminTrackImageHide.style.display = "none";
    adminTrackImageHideLabel.style.display = "none";
    if (adminTrackImageHide) adminTrackImageHide.checked = false;
  });
}

// Track CRUD Actions
const adminTrackForm = document.getElementById("admin-track-form");
if (adminTrackForm) {
  adminTrackForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("admin-track-name").value.trim();
    const rawId = document.getElementById("admin-track-id").value.trim();
    const icon = document.getElementById("admin-track-icon").value.trim();
    const desc = document.getElementById("admin-track-desc").value.trim();
    const visible = document.getElementById("admin-track-visible").checked;
    const editId = document.getElementById("admin-track-edit-id").value;

    const id = editId || rawId || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    if (!id) {
      showToast("Invalid Track Key/ID.", "error");
      return;
    }

    try {
      showToast("Saving track configurations...", "info");
      await setDoc(doc(firestore, "tracks", id), {
        name,
        icon,
        desc,
        visible,
        image: currentTrackImageBase64,
        hideImage: adminTrackImageHide ? adminTrackImageHide.checked : false,
        timestamp: Date.now()
      });
      showToast("Track configurations saved successfully!", "success");
      adminTrackForm.reset();
      document.getElementById("admin-track-edit-id").value = "";
      document.getElementById("admin-track-id").disabled = false;
      document.getElementById("admin-track-form-title").textContent = "Add New Challenge Track";
      if (adminTrackImageRemove) adminTrackImageRemove.click();
      const cancelBtn = document.getElementById("admin-track-cancel-btn");
      if (cancelBtn) cancelBtn.style.display = "none";
    } catch (err) {
      showToast("Failed to save track: " + getCleanErrorMessage(err), "error");
    }
  });
}

const adminTrackCancelBtn = document.getElementById("admin-track-cancel-btn");
if (adminTrackCancelBtn) {
  adminTrackCancelBtn.addEventListener("click", () => {
    if (adminTrackForm) adminTrackForm.reset();
    document.getElementById("admin-track-edit-id").value = "";
    document.getElementById("admin-track-id").disabled = false;
    document.getElementById("admin-track-form-title").textContent = "Add New Challenge Track";
    if (adminTrackImageRemove) adminTrackImageRemove.click();
    adminTrackCancelBtn.style.display = "none";
  });
}

function adminEditTrack(trackId) {
  const track = allTracks.find(t => t.id === trackId);
  if (!track) return;
  
  document.getElementById("admin-track-edit-id").value = track.id;
  document.getElementById("admin-track-name").value = track.name;
  document.getElementById("admin-track-id").value = track.id;
  document.getElementById("admin-track-id").disabled = true;
  document.getElementById("admin-track-icon").value = track.icon;
  document.getElementById("admin-track-desc").value = track.desc;
  document.getElementById("admin-track-visible").checked = track.visible !== false;
  
  currentTrackImageBase64 = track.image || null;
  if (currentTrackImageBase64) {
    adminTrackImagePreview.src = currentTrackImageBase64;
    adminTrackImagePreview.style.display = "block";
    adminTrackImageRemove.style.display = "inline-block";
    adminTrackImageHide.style.display = "inline-block";
    adminTrackImageHideLabel.style.display = "inline-block";
    if (adminTrackImageHide) adminTrackImageHide.checked = !!track.hideImage;
  } else {
    adminTrackImagePreview.src = "";
    adminTrackImagePreview.style.display = "none";
    adminTrackImageRemove.style.display = "none";
    adminTrackImageHide.style.display = "none";
    adminTrackImageHideLabel.style.display = "none";
    if (adminTrackImageHide) adminTrackImageHide.checked = false;
  }
  if (adminTrackImageInput) adminTrackImageInput.value = "";
  
  document.getElementById("admin-track-form-title").textContent = "Edit Challenge Track";
  if (adminTrackCancelBtn) adminTrackCancelBtn.style.display = "inline-block";
}

async function adminToggleTrackVisibility(trackId, currentVisible) {
  try {
    showToast("Updating visibility...", "info");
    await updateDoc(doc(firestore, "tracks", trackId), {
      visible: !currentVisible
    });
    showToast("Visibility updated successfully!", "success");
  } catch (err) {
    showToast("Failed to update visibility: " + getCleanErrorMessage(err), "error");
  }
}

async function adminDeleteTrack(trackId) {
  if (!confirm("Are you sure you want to delete this challenge track? Applicants will no longer be able to select it.")) {
    return;
  }
  try {
    showToast("Deleting challenge track...", "info");
    await deleteDoc(doc(firestore, "tracks", trackId));
    showToast("Challenge track deleted successfully!", "success");
  } catch (err) {
    showToast("Deletion failed: " + getCleanErrorMessage(err), "error");
  }
}

// ================= FEATURES CRUD ACTIONS ================= //

let currentFeatureImageBase64 = null;
const adminFeatureImageInput = document.getElementById("admin-feature-image");
const adminFeatureImagePreview = document.getElementById("admin-feature-image-preview");
const adminFeatureImageRemove = document.getElementById("admin-feature-image-remove");
const adminFeatureImageHide = document.getElementById("admin-feature-image-hide");
const adminFeatureImageHideLabel = document.getElementById("admin-feature-image-hide-label");

if (adminFeatureImageInput) {
  adminFeatureImageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast("Image must be smaller than 2MB", "error");
        adminFeatureImageInput.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        currentFeatureImageBase64 = event.target.result;
        adminFeatureImagePreview.src = currentFeatureImageBase64;
        adminFeatureImagePreview.style.display = "block";
        adminFeatureImageRemove.style.display = "inline-block";
        adminFeatureImageHide.style.display = "inline-block";
        adminFeatureImageHideLabel.style.display = "inline-block";
      };
      reader.readAsDataURL(file);
    }
  });
}

if (adminFeatureImageRemove) {
  adminFeatureImageRemove.addEventListener("click", () => {
    currentFeatureImageBase64 = null;
    adminFeatureImagePreview.src = "";
    adminFeatureImagePreview.style.display = "none";
    adminFeatureImageInput.value = "";
    adminFeatureImageRemove.style.display = "none";
    adminFeatureImageHide.style.display = "none";
    adminFeatureImageHideLabel.style.display = "none";
    if (adminFeatureImageHide) adminFeatureImageHide.checked = false;
  });
}

const adminFeatureForm = document.getElementById("admin-feature-form");
if (adminFeatureForm) {
  adminFeatureForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("admin-feature-name").value.trim();
    const icon = document.getElementById("admin-feature-icon").value.trim();
    const desc = document.getElementById("admin-feature-desc").value.trim();
    const visible = document.getElementById("admin-feature-visible").checked;
    const editId = document.getElementById("admin-feature-edit-id").value;
    const id = editId || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    try {
      showToast("Saving feature...", "info");
      await setDoc(doc(firestore, "features", id), {
        name, icon, desc, visible,
        image: currentFeatureImageBase64,
        hideImage: adminFeatureImageHide ? adminFeatureImageHide.checked : false,
        timestamp: Date.now()
      });
      showToast("Feature saved successfully!", "success");
      adminFeatureForm.reset();
      document.getElementById("admin-feature-edit-id").value = "";
      document.getElementById("admin-feature-form-title").textContent = "Add New Feature Card";
      if (adminFeatureImageRemove) adminFeatureImageRemove.click();
      const cancelBtn = document.getElementById("admin-feature-cancel-btn");
      if (cancelBtn) cancelBtn.style.display = "none";
    } catch (err) {
      showToast("Failed to save feature: " + getCleanErrorMessage(err), "error");
    }
  });
}

const adminFeatureCancelBtn = document.getElementById("admin-feature-cancel-btn");
if (adminFeatureCancelBtn) {
  adminFeatureCancelBtn.addEventListener("click", () => {
    if (adminFeatureForm) adminFeatureForm.reset();
    document.getElementById("admin-feature-edit-id").value = "";
    document.getElementById("admin-feature-form-title").textContent = "Add New Feature Card";
    if (adminFeatureImageRemove) adminFeatureImageRemove.click();
    adminFeatureCancelBtn.style.display = "none";
  });
}

function adminEditFeature(featureId) {
  const feat = allFeatures.find(f => f.id === featureId);
  if (!feat) return;
  document.getElementById("admin-feature-edit-id").value = feat.id;
  document.getElementById("admin-feature-name").value = feat.name;
  document.getElementById("admin-feature-icon").value = feat.icon;
  document.getElementById("admin-feature-desc").value = feat.desc;
  document.getElementById("admin-feature-visible").checked = feat.visible !== false;
  
  currentFeatureImageBase64 = feat.image || null;
  if (currentFeatureImageBase64) {
    adminFeatureImagePreview.src = currentFeatureImageBase64;
    adminFeatureImagePreview.style.display = "block";
    adminFeatureImageRemove.style.display = "inline-block";
    adminFeatureImageHide.style.display = "inline-block";
    adminFeatureImageHideLabel.style.display = "inline-block";
    if (adminFeatureImageHide) adminFeatureImageHide.checked = !!feat.hideImage;
  } else {
    if (adminFeatureImageRemove) adminFeatureImageRemove.click();
  }
  if (adminFeatureImageInput) adminFeatureImageInput.value = "";
  document.getElementById("admin-feature-form-title").textContent = "Edit Feature Card";
  if (adminFeatureCancelBtn) adminFeatureCancelBtn.style.display = "inline-block";
}

async function adminDeleteFeature(featureId) {
  if (!confirm("Are you sure you want to delete this feature?")) return;
  try {
    showToast("Deleting feature...", "info");
    await deleteDoc(doc(firestore, "features", featureId));
    showToast("Feature deleted successfully!", "success");
  } catch (err) {
    showToast("Deletion failed: " + getCleanErrorMessage(err), "error");
  }
}

async function adminToggleFeatureVisibility(featureId, currentVisible) {
  try {
    showToast("Updating visibility...", "info");
    await updateDoc(doc(firestore, "features", featureId), { visible: !currentVisible });
    showToast("Visibility updated successfully!", "success");
  } catch (err) {
    showToast("Failed to update visibility.", "error");
  }
}

function renderAdminFeaturesList() {
  const container = document.getElementById("admin-features-list");
  if (!container) return;
  if (allFeatures.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-light); font-size: 13px; padding: 20px;">No features configured.</p>`;
    return;
  }
  container.innerHTML = allFeatures.map(feat => {
    return `
      <div style="border: 1px solid var(--border); padding: 16px; border-radius: var(--radius-md); background: var(--bg-app); display: flex; flex-direction: column; gap: 8px; position: relative; overflow: hidden;">
        ${feat.image && !feat.hideImage ? `<div style="position: absolute; top:0; left:0; width: 100%; height: 100%; opacity: 0.1; background-image: url('${feat.image}'); background-size: cover; background-position: center; z-index: 0; pointer-events: none;"></div>` : ''}
        <div style="display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 1;">
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--text-main); font-size: 14px;">
            <i class="fa-solid ${feat.icon} text-primary"></i> ${feat.name}
          </div>
        </div>
        <p style="font-size: 12px; color: var(--text-muted); margin: 0; position: relative; z-index: 1;">${feat.desc}</p>
        <div style="display: flex; gap: 8px; margin-top: 8px; border-top: 1px dashed var(--border); padding-top: 8px; justify-content: flex-end; position: relative; z-index: 1;">
          <button class="btn btn-secondary btn-sm" onclick="adminToggleFeatureVisibility('${feat.id}', ${feat.visible !== false})" style="padding: 4px 8px; font-size: 11px;">
            <i class="fa-solid ${feat.visible !== false ? 'fa-eye-slash' : 'fa-eye'}"></i> ${feat.visible !== false ? 'Hide' : 'Show'}
          </button>
          <button class="btn btn-secondary btn-sm" onclick="adminEditFeature('${feat.id}')" style="padding: 4px 8px; font-size: 11px;"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
          <button class="btn btn-outline btn-sm" onclick="adminDeleteFeature('${feat.id}')" style="color: var(--danger); border-color: var(--danger); padding: 4px 8px; font-size: 11px;"><i class="fa-solid fa-trash-can"></i> Delete</button>
        </div>
      </div>
    `;
  }).join("");
}

// Render Challenge Timeline config panel list
function renderAdminTimelineList() {
  const container = document.getElementById("admin-timeline-list");
  if (!container) return;

  if (allTimeline.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-light); font-size: 13px; padding: 20px;">No timeline milestones configured. Add one on the left.</p>`;
    // Empty preview too
    const previewContainer = document.getElementById("admin-timeline-preview-container");
    if (previewContainer) {
      previewContainer.innerHTML = `<div class="timeline-line"></div><p style="text-align: center; color: var(--text-light); font-size: 13px; padding: 20px;">No milestone events to preview.</p>`;
    }
    return;
  }

  container.innerHTML = allTimeline.map(item => {
    let statusBadge = "";
    if (item.status === "completed") {
      statusBadge = `<span class="badge badge-success" style="font-size: 10px;"><i class="fa-solid fa-circle-check"></i> Completed</span>`;
    } else if (item.status === "active") {
      statusBadge = `<span class="badge badge-warning" style="font-size: 10px;"><i class="fa-solid fa-spinner fa-spin"></i> In Progress</span>`;
    } else {
      statusBadge = `<span class="badge badge-info" style="font-size: 10px; background-color: var(--text-light);"><i class="fa-solid fa-hourglass-start"></i> Upcoming</span>`;
    }
      
    return `
      <div style="border: 1px solid var(--border); padding: 16px; border-radius: var(--radius-md); background: var(--bg-app); display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--text-main); font-size: 14px;">
            <span style="background: var(--primary-light); color: var(--primary); width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px;">${item.step}</span>
            ${item.title}
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${statusBadge}
            <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">${item.date}</span>
          </div>
        </div>
        <p style="font-size: 12px; color: var(--text-muted); margin: 0; line-height: 1.5;">${item.desc}</p>
        <div style="display: flex; gap: 8px; margin-top: 8px; border-top: 1px dashed var(--border); padding-top: 8px; justify-content: flex-end;">
          <button class="btn btn-secondary btn-sm" onclick="adminEditTimelineEvent('${item.id}')" style="padding: 4px 8px; font-size: 11px;"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
          <button class="btn btn-outline btn-sm" onclick="adminDeleteTimelineEvent('${item.id}')" style="color: var(--danger); border-color: var(--danger); padding: 4px 8px; font-size: 11px;"><i class="fa-solid fa-trash-can"></i> Delete</button>
        </div>
      </div>
    `;
  }).join("");

  // Populate preview roadmap
  const previewContainer = document.getElementById("admin-timeline-preview-container");
  if (previewContainer) {
    previewContainer.innerHTML = `
      <div class="timeline-line"></div>
      ${allTimeline.map(item => {
        let activeClass = "";
        if (item.status === "completed") {
          activeClass = "active completed";
        } else if (item.status === "active") {
          activeClass = "active";
        }
        return `
          <div class="timeline-item ${activeClass}" data-step="${item.step}">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-date">${item.date}</div>
              <h3>${item.title}</h3>
              <p>${item.desc}</p>
            </div>
          </div>
        `;
      }).join("")}
    `;
  }
}

// Timeline Form Submission
const adminTimelineForm = document.getElementById("admin-timeline-form");
if (adminTimelineForm) {
  adminTimelineForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("admin-timeline-title").value.trim();
    const step = parseInt(document.getElementById("admin-timeline-step").value);
    const date = document.getElementById("admin-timeline-date").value.trim();
    const desc = document.getElementById("admin-timeline-desc").value.trim();
    const status = document.getElementById("admin-timeline-status").value;
    const editId = document.getElementById("admin-timeline-edit-id").value;

    const id = editId || `step-${step}`;

    try {
      showToast("Saving milestone configuration...", "info");
      await setDoc(doc(firestore, "timeline", id), {
        title,
        step,
        date,
        desc,
        status,
        timestamp: Date.now()
      });
      showToast("Timeline milestone saved successfully!", "success");
      adminTimelineForm.reset();
      document.getElementById("admin-timeline-edit-id").value = "";
      document.getElementById("admin-timeline-form-title").textContent = "Add Timeline Milestone";
      const cancelBtn = document.getElementById("admin-timeline-cancel-btn");
      if (cancelBtn) cancelBtn.style.display = "none";
    } catch (err) {
      showToast("Failed to save milestone: " + getCleanErrorMessage(err), "error");
    }
  });
}

const adminTimelineCancelBtn = document.getElementById("admin-timeline-cancel-btn");
if (adminTimelineCancelBtn) {
  adminTimelineCancelBtn.addEventListener("click", () => {
    if (adminTimelineForm) adminTimelineForm.reset();
    document.getElementById("admin-timeline-edit-id").value = "";
    document.getElementById("admin-timeline-form-title").textContent = "Add Timeline Milestone";
    adminTimelineCancelBtn.style.display = "none";
  });
}

function adminEditTimelineEvent(eventId) {
  const item = allTimeline.find(t => t.id === eventId);
  if (!item) return;

  document.getElementById("admin-timeline-edit-id").value = item.id;
  document.getElementById("admin-timeline-title").value = item.title;
  document.getElementById("admin-timeline-step").value = item.step;
  document.getElementById("admin-timeline-date").value = item.date;
  document.getElementById("admin-timeline-desc").value = item.desc;
  document.getElementById("admin-timeline-status").value = item.status || "upcoming";

  document.getElementById("admin-timeline-form-title").textContent = "Edit Timeline Milestone";
  if (adminTimelineCancelBtn) adminTimelineCancelBtn.style.display = "inline-block";
}

async function adminDeleteTimelineEvent(eventId) {
  if (!confirm("Are you sure you want to delete this timeline milestone event? It will disappear from the public roadmap.")) {
    return;
  }
  try {
    showToast("Deleting timeline milestone...", "info");
    await deleteDoc(doc(firestore, "timeline", eventId));
    showToast("Timeline milestone deleted successfully!", "success");
  } catch (err) {
    showToast("Deletion failed: " + getCleanErrorMessage(err), "error");
  }
}

async function adminResetTimelineToDefault() {
  if (!confirm("Are you sure you want to reset the roadmap to the default 6 steps? This will overwrite existing steps.")) {
    return;
  }
  try {
    showToast("Resetting timeline milestones...", "info");
    const defaultTimeline = [
      { step: 1, title: "Registration Period", date: "June 1 - July 15", desc: "Register as an individual or create a team. Explore tracks and prepare project directions.", status: "completed" },
      { step: 2, title: "Application Deadline", date: "July 15 @ 23:59 EST", desc: "Submit initial proposals, team lists, and draft designs. Late entries are not accepted.", status: "active" },
      { step: 3, title: "Shortlisting & Selection", date: "July 20", desc: "Our expert panel vets all entries to select top 30 teams who will advance to the next phase.", status: "upcoming" },
      { step: 4, title: "Mentorship Phase", date: "July 22 - Aug 10", desc: "Selected teams are paired with top-tier coaches for architecture, UX, and business modeling.", status: "upcoming" },
      { step: 5, title: "Demo Day", date: "August 15", desc: "Teams present live prototype demonstrations and pitch pitches to a global panel of judges.", status: "upcoming" },
      { step: 6, title: "Awards Ceremony", date: "August 18", desc: "Winners are officially announced. Networking opportunities open for all finalists.", status: "upcoming" }
    ];
    
    // Clear current timeline events first
    for (const item of allTimeline) {
      await deleteDoc(doc(firestore, "timeline", item.id));
    }
    
    // Re-seed default milestones
    for (const item of defaultTimeline) {
      await setDoc(doc(firestore, "timeline", `step-${item.step}`), {
        step: item.step,
        title: item.title,
        date: item.date,
        desc: item.desc,
        status: item.status,
        timestamp: Date.now()
      });
    }
    showToast("Timeline reset successfully!", "success");
  } catch (err) {
    showToast("Reset failed: " + getCleanErrorMessage(err), "error");
  }
}

// Render Configured Rewards in Admin Panel
function renderAdminRewardsList() {
  const container = document.getElementById("admin-rewards-list");
  if (!container) return;

  if (allPrizes.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-light); font-size: 13px; padding: 20px;">No reward cards configured. Add one on the left.</p>`;
    const previewContainer = document.getElementById("admin-rewards-preview-container");
    if (previewContainer) {
      previewContainer.innerHTML = `<p style="text-align: center; color: var(--text-light); font-size: 13px; grid-column: 1 / -1;">No rewards configured to preview.</p>`;
    }
    return;
  }

  container.innerHTML = allPrizes.map(p => {
    const featureBadge = p.popular === true 
      ? `<span class="badge badge-success" style="font-size: 10px;"><i class="fa-solid fa-star"></i> Featured</span>`
      : `<span class="badge badge-info" style="font-size: 10px; background-color: var(--text-light);"><i class="fa-solid fa-circle"></i> Standard</span>`;

    return `
      <div style="border: 1px solid var(--border); padding: 16px; border-radius: var(--radius-md); background: var(--bg-app); display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--text-main); font-size: 14px;">
            <i class="fa-solid fa-gift" style="color: var(--primary);"></i> ${p.rank}
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${featureBadge}
            <span style="font-size: 11px; color: var(--primary); font-weight: 700;">${p.amount}</span>
          </div>
        </div>
        <p style="font-size: 12px; color: var(--text-muted); margin: 0; line-height: 1.5;">${p.desc}</p>
        <div style="display: flex; gap: 8px; margin-top: 8px; border-top: 1px dashed var(--border); padding-top: 8px; justify-content: flex-end;">
          <button class="btn btn-secondary btn-sm" onclick="adminEditPrize('${p.id}')" style="padding: 4px 8px; font-size: 11px;"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
          <button class="btn btn-outline btn-sm" onclick="adminDeletePrize('${p.id}')" style="color: var(--danger); border-color: var(--danger); padding: 4px 8px; font-size: 11px;"><i class="fa-solid fa-trash-can"></i> Delete</button>
        </div>
      </div>
    `;
  }).join("");

  // Live preview cards mapping
  const previewContainer = document.getElementById("admin-rewards-preview-container");
  if (previewContainer) {
    previewContainer.innerHTML = allPrizes.map(p => {
      const isGrand = p.popular === true;
      return `
        <div class="card prize-card ${isGrand ? 'grand' : ''}">
          <div class="prize-rank">${p.rank || ''}</div>
          <div class="prize-amount">${p.amount || ''}</div>
          <p>${p.desc || ''}</p>
        </div>
      `;
    }).join("");
  }
}

// Rewards CRUD Actions Form Submission
const adminRewardsForm = document.getElementById("admin-rewards-form");
if (adminRewardsForm) {
  adminRewardsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const rank = document.getElementById("admin-rewards-rank").value.trim();
    const amount = document.getElementById("admin-rewards-amount").value.trim();
    const desc = document.getElementById("admin-rewards-desc").value.trim();
    const popular = document.getElementById("admin-rewards-popular").checked;
    const editId = document.getElementById("admin-rewards-edit-id").value;

    const id = editId || rank.toLowerCase().replace(/[^a-z0-9]/g, "-");

    try {
      showToast("Saving reward package...", "info");
      await setDoc(doc(firestore, "prizes", id), {
        rank,
        amount,
        desc,
        popular,
        timestamp: Date.now()
      });
      showToast("Reward package saved successfully!", "success");
      adminRewardsForm.reset();
      document.getElementById("admin-rewards-edit-id").value = "";
      document.getElementById("admin-rewards-form-title").textContent = "Add Reward Package";
      const cancelBtn = document.getElementById("admin-rewards-cancel-btn");
      if (cancelBtn) cancelBtn.style.display = "none";
    } catch (err) {
      showToast("Failed to save reward package: " + getCleanErrorMessage(err), "error");
    }
  });
}

const adminRewardsCancelBtn = document.getElementById("admin-rewards-cancel-btn");
if (adminRewardsCancelBtn) {
  adminRewardsCancelBtn.addEventListener("click", () => {
    if (adminRewardsForm) adminRewardsForm.reset();
    document.getElementById("admin-rewards-edit-id").value = "";
    document.getElementById("admin-rewards-form-title").textContent = "Add Reward Package";
    adminRewardsCancelBtn.style.display = "none";
  });
}

function adminEditPrize(prizeId) {
  const prize = allPrizes.find(p => p.id === prizeId);
  if (!prize) return;

  document.getElementById("admin-rewards-edit-id").value = prize.id;
  document.getElementById("admin-rewards-rank").value = prize.rank;
  document.getElementById("admin-rewards-amount").value = prize.amount;
  document.getElementById("admin-rewards-desc").value = prize.desc;
  document.getElementById("admin-rewards-popular").checked = prize.popular === true;

  document.getElementById("admin-rewards-form-title").textContent = "Edit Reward Package";
  if (adminRewardsCancelBtn) adminRewardsCancelBtn.style.display = "inline-block";
}

async function adminDeletePrize(prizeId) {
  if (!confirm("Are you sure you want to delete this reward package? It will disappear from the landing page.")) {
    return;
  }
  try {
    showToast("Deleting reward package...", "info");
    await deleteDoc(doc(firestore, "prizes", prizeId));
    showToast("Reward package deleted successfully!", "success");
  } catch (err) {
    showToast("Deletion failed: " + getCleanErrorMessage(err), "error");
  }
}

async function adminResetRewardsToDefault() {
  if (!confirm("Are you sure you want to reset rewards to default KNUST settings? This will overwrite current entries.")) {
    return;
  }
  try {
    showToast("Resetting reward packages...", "info");
    const defaultPrizes = [
      { rank: "1st Place Grand Winner", amount: "GH₵ 100,000", desc: "Equivalent value in full-stack engineering support, premium co-working space incubation, GH₵ 30,000 AWS credits, and global showcase publicity.", popular: true, timestamp: 1 },
      { rank: "Runner Up", amount: "GH₵ 50,000", desc: "Equivalent value in architecture reviews, code deployment assistance, GH₵ 15,000 AWS cloud credits, and 3 months mentorship.", popular: false, timestamp: 2 },
      { rank: "3rd Place", amount: "GH₵ 25,000", desc: "Equivalent value in technical deployment reviews, GH₵ 10,000 cloud infrastructure credits, and partner networking access.", popular: false, timestamp: 3 }
    ];

    for (const prize of allPrizes) {
      await deleteDoc(doc(firestore, "prizes", prize.id));
    }

    for (const prize of defaultPrizes) {
      const id = prize.rank.toLowerCase().replace(/[^a-z0-9]/g, "-");
      await setDoc(doc(firestore, "prizes", id), {
        rank: prize.rank,
        amount: prize.amount,
        desc: prize.desc,
        popular: prize.popular,
        timestamp: Date.now() + prize.timestamp
      });
    }
    showToast("Rewards reset successfully!", "success");
  } catch (err) {
    showToast("Reset failed: " + getCleanErrorMessage(err), "error");
  }
}

const adminRewardsResetBtn = document.getElementById("admin-rewards-reset-btn");
if (adminRewardsResetBtn) {
  adminRewardsResetBtn.addEventListener("click", adminResetRewardsToDefault);
}

// Render Configured Legal Documents in Admin Panel
function renderAdminLegalList() {
  const container = document.getElementById("admin-legal-list");
  if (!container) return;

  if (allLegal.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-light); font-size: 13px; padding: 20px;"><i class="fa-solid fa-inbox"></i> No legal documents configured. Add one on the left.</p>`;
  } else {
    container.innerHTML = allLegal.map(leg => {
      const preview = (leg.content || "").substring(0, 120) + ((leg.content || "").length > 120 ? "..." : "");
      return `
        <div style="border: 1px solid var(--border); padding: 16px; border-radius: var(--radius-md); background: var(--bg-app); display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="font-weight: 700; color: var(--text-main); font-size: 14px; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-gavel" style="color: var(--primary);"></i> ${leg.title}
            </div>
            <span style="font-size: 10px; color: var(--text-light); white-space: nowrap;">${leg.timestamp ? new Date(leg.timestamp).toLocaleDateString("en-GB", {day:"numeric",month:"short",year:"numeric"}) : ""}</span>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin: 0; line-height: 1.5;">${preview}</p>
          <div style="display: flex; gap: 8px; margin-top: 4px; border-top: 1px dashed var(--border); padding-top: 8px; justify-content: flex-end;">
            <button class="btn btn-secondary btn-sm" onclick="adminEditLegal('${leg.id}')" style="padding: 4px 10px; font-size: 11px;"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
            <button class="btn btn-outline btn-sm" onclick="adminDeleteLegal('${leg.id}')" style="color: var(--danger); border-color: var(--danger); padding: 4px 10px; font-size: 11px;"><i class="fa-solid fa-trash-can"></i> Delete</button>
          </div>
        </div>
      `;
    }).join("");
  }

  // Live public preview — mirrors the landing page legal card style
  const previewContainer = document.getElementById("admin-legal-preview-container");
  if (previewContainer) {
    if (allLegal.length === 0) {
      previewContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 13px;">No documents to preview.</p>`;
    } else {
      previewContainer.innerHTML = allLegal.map(leg => `
        <div class="card" style="padding: 24px; display: flex; flex-direction: column; gap: 12px; background: var(--bg-card); box-shadow: var(--shadow-sm); border-radius: var(--radius-md);">
          <div style="display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 18px; color: var(--text-main); font-family: var(--font-heading);">
            <i class="fa-solid fa-gavel" style="color: var(--primary);"></i> ${leg.title}
          </div>
          <p style="font-size: 14px; color: var(--text-muted); line-height: 1.6; margin: 0; white-space: pre-line;">${leg.content}</p>
        </div>
      `).join("");
    }
  }
}

// Legal CRUD Form Submit
const adminLegalForm = document.getElementById("admin-legal-form");
if (adminLegalForm) {
  adminLegalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("admin-legal-title").value.trim();
    const content = document.getElementById("admin-legal-content").value.trim();
    const editId = document.getElementById("admin-legal-edit-id").value;

    const id = editId || title.toLowerCase().replace(/[^a-z0-9]/g, "-");

    try {
      showToast("Saving legal document...", "info");
      await setDoc(doc(firestore, "legal", id), {
        title,
        content,
        timestamp: Date.now()
      });
      showToast("Legal document saved successfully!", "success");
      adminLegalForm.reset();
      document.getElementById("admin-legal-edit-id").value = "";
      document.getElementById("admin-legal-form-title").textContent = "Add Legal Document";
      const cancelBtn = document.getElementById("admin-legal-cancel-btn");
      if (cancelBtn) cancelBtn.style.display = "none";
    } catch (err) {
      showToast("Failed to save: " + getCleanErrorMessage(err), "error");
    }
  });
}

const adminLegalCancelBtn = document.getElementById("admin-legal-cancel-btn");
if (adminLegalCancelBtn) {
  adminLegalCancelBtn.addEventListener("click", () => {
    if (adminLegalForm) adminLegalForm.reset();
    document.getElementById("admin-legal-edit-id").value = "";
    document.getElementById("admin-legal-form-title").textContent = "Add Legal Document";
    adminLegalCancelBtn.style.display = "none";
  });
}

function adminEditLegal(legalId) {
  const legal = allLegal.find(l => l.id === legalId);
  if (!legal) return;

  document.getElementById("admin-legal-edit-id").value = legal.id;
  document.getElementById("admin-legal-title").value = legal.title;
  document.getElementById("admin-legal-content").value = legal.content;

  document.getElementById("admin-legal-form-title").textContent = "Edit Legal Document";
  if (adminLegalCancelBtn) adminLegalCancelBtn.style.display = "inline-block";
}

async function adminDeleteLegal(legalId) {
  if (!confirm("Are you sure you want to delete this legal document? It will disappear from the portal.")) {
    return;
  }
  try {
    showToast("Deleting legal document...", "info");
    await deleteDoc(doc(firestore, "legal", legalId));
    showToast("Legal document deleted successfully!", "success");
  } catch (err) {
    showToast("Deletion failed: " + getCleanErrorMessage(err), "error");
  }
}

async function adminDeleteProject(projectId) {
  if (!confirm("Are you sure you want to delete this applicant registration? This action is permanent and cannot be undone.")) {
    return;
  }
  try {
    showToast("Deleting applicant registration...", "info");
    await deleteDoc(doc(firestore, "projects", projectId));
    showToast("Applicant registration deleted successfully!", "success");
  } catch (err) {
    showToast("Deletion failed: " + getCleanErrorMessage(err), "error");
  }
}

window.adminEditLegal = adminEditLegal;
window.adminDeleteLegal = adminDeleteLegal;
window.adminDeleteProject = adminDeleteProject;

// Exports for global table actions
window.adminApproveProject = adminApproveProject;
window.adminDeleteCustomField = adminDeleteCustomField;
window.adminViewProjectDetails = adminViewProjectDetails;
window.adminEditTrack = adminEditTrack;
window.adminToggleTrackVisibility = adminToggleTrackVisibility;
window.adminDeleteTrack = adminDeleteTrack;
window.adminEditTimelineEvent = adminEditTimelineEvent;
window.adminDeleteTimelineEvent = adminDeleteTimelineEvent;
window.adminResetTimelineToDefault = adminResetTimelineToDefault;
window.adminEditPrize = adminEditPrize;
window.adminDeletePrize = adminDeletePrize;
window.adminResetRewardsToDefault = adminResetRewardsToDefault;

// Helper: Decompress Base64 gzip Data URL using DecompressionStream API
async function decompressFileGzip(base64GzipUrl) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream is not supported in this browser. Please use a modern browser.");
  }
  
  const base64Data = base64GzipUrl.split(",")[1];
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
  
  const decompressionStream = new DecompressionStream("gzip");
  const decompressedStream = stream.pipeThrough(decompressionStream);
  const response = new Response(decompressedStream);
  return await response.arrayBuffer();
}

// Download and decompress project proposal document
async function downloadConceptNote(projId) {
  const proj = allProjects.find(p => p.id === projId);
  if (!proj || !proj.conceptNoteUrl) {
    showToast("No concept note found.", "error");
    return;
  }
  
  const url = proj.conceptNoteUrl;
  const fileName = proj.conceptNoteName || "concept_note.docx";
  const ext = fileName.split(".").pop().toLowerCase();
  
  let mimeType = "application/octet-stream";
  if (ext === "pdf") mimeType = "application/pdf";
  else if (ext === "docx") mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  else if (ext === "pptx") mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  
  try {
    showToast("Decompressing document...", "info");
    
    let downloadUrl;
    let blob;
    if (url.startsWith("data:application/gzip;base64,")) {
      const buffer = await decompressFileGzip(url);
      blob = new Blob([buffer], { type: mimeType });
      downloadUrl = URL.createObjectURL(blob);
    } else {
      downloadUrl = url;
    }
    
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    if (blob) {
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
    }
    showToast("Download started successfully!", "success");
  } catch (err) {
    console.error("Decompression failed:", err);
    showToast("Failed to prepare file: " + err.message, "error");
  }
}

window.downloadConceptNote = downloadConceptNote;

// Helper: Compress file to gzip buffer (reusable helper)
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

// Render Configured Resources in Admin Panel
function renderAdminResourcesList() {
  const container = document.getElementById("admin-resources-list");
  if (!container) return;

  if (allResources.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-light); font-size: 13px; padding: 20px;"><i class="fa-solid fa-inbox"></i> No resources uploaded yet. Add one on the left.</p>`;
  } else {
    container.innerHTML = allResources.map(res => {
      const icon = res.icon || "fa-file";
      return `
        <div style="border: 1px solid var(--border); padding: 16px; border-radius: var(--radius-md); background: var(--bg-app); display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="font-weight: 700; color: var(--text-main); font-size: 14px; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid ${icon}" style="color: var(--primary);"></i> ${res.title}
            </div>
            <span style="font-size: 10px; color: var(--text-light); white-space: nowrap;">${res.size || 'N/A'} &bull; ${res.type || 'File'}</span>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin: 0; line-height: 1.5;">${res.desc || ''}</p>
          <div style="display: flex; gap: 8px; margin-top: 4px; border-top: 1px dashed var(--border); padding-top: 8px; justify-content: flex-end; align-items: center;">
            ${res.link ? `<span style="font-size: 11px; color: var(--success); margin-right: auto;"><i class="fa-solid fa-cloud-arrow-up"></i> File Uploaded</span>` : `<span style="font-size: 11px; color: var(--text-light); margin-right: auto;">No file linked</span>`}
            <button class="btn btn-outline btn-sm" onclick="adminDeleteResource('${res.id}')" style="color: var(--danger); border-color: var(--danger); padding: 4px 10px; font-size: 11px; cursor: pointer;"><i class="fa-solid fa-trash-can"></i> Delete</button>
          </div>
        </div>
      `;
    }).join("");
  }

  // Live public preview — mirrors the Resource Center card style
  const previewContainer = document.getElementById("admin-resources-preview-container");
  if (previewContainer) {
    if (allResources.length === 0) {
      previewContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 13px; grid-column: 1/-1;">No resources to preview.</p>`;
    } else {
      previewContainer.innerHTML = allResources.map(res => {
        const icon = res.icon || "fa-file";
        return `
          <div class="resource-card" style="width: 100%; border: 1px solid var(--border); padding: 16px; border-radius: var(--radius-md); background: var(--bg-card); display: flex; gap: 16px; align-items: flex-start; text-align: left;">
            <div class="resource-icon" style="font-size: 24px; color: var(--primary);"><i class="fa-solid ${icon}"></i></div>
            <div class="resource-info" style="flex: 1;">
              <h4 style="margin: 0 0 6px 0; font-size: 14px; color: var(--text-main); font-weight: 600;">${res.title}</h4>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: var(--text-muted); line-height: 1.4;">${res.desc || ''}</p>
              <span style="font-size: 11px; color: var(--text-light); display: block; margin-bottom: 8px;">${res.type || 'Document'} &bull; ${res.size || 'N/A'}</span>
              <a href="#" class="resource-link" style="font-size: 12px; color: var(--primary); text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;"><i class="fa-solid fa-download"></i> Download Template</a>
            </div>
          </div>
        `;
      }).join("");
    }
  }
}

// Resource Form Submission (Gzip Upload)
const adminResourceForm = document.getElementById("admin-resource-form");
if (adminResourceForm) {
  adminResourceForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("admin-resource-title").value.trim();
    const desc = document.getElementById("admin-resource-desc").value.trim();
    const fileInput = document.getElementById("admin-resource-file");
    const file = fileInput ? fileInput.files[0] : null;

    if (!file) {
      showToast("Please select a file to upload.", "error");
      return;
    }

    const saveBtn = document.getElementById("admin-resource-save-btn");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
    }

    try {
      showToast("Compressing and uploading resource...", "info");
      
      const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      let icon = "fa-file";
      let type = "Document";
      
      if (fileExt === ".pdf") {
        icon = "fa-file-pdf";
        type = "PDF Document";
      } else if (fileExt === ".pptx") {
        icon = "fa-file-powerpoint";
        type = "PPTX Presentation";
      } else if (fileExt === ".docx") {
        icon = "fa-file-word";
        type = "Word Document";
      } else if (fileExt === ".zip") {
        icon = "fa-file-zipper";
        type = "ZIP Archive";
      } else if (fileExt === ".xlsx" || fileExt === ".xls") {
        icon = "fa-file-excel";
        type = "Excel Spreadsheet";
      } else if ([".png", ".jpg", ".jpeg"].includes(fileExt)) {
        icon = "fa-image";
        type = "Image Asset";
      }

      let sizeStr = "";
      if (file.size >= 1024 * 1024) {
        sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      } else {
        sizeStr = `${(file.size / 1024).toFixed(0)} KB`;
      }

      let fileDataUrl = "";
      const compressedBuffer = await compressFileGzip(file);
      if (compressedBuffer) {
        fileDataUrl = await bufferToBase64Gzip(compressedBuffer);
      } else {
        fileDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const id = title.toLowerCase().replace(/[^a-z0-9]/g, "-");
      await setDoc(doc(firestore, "resources", id), {
        title,
        desc,
        icon,
        type,
        size: sizeStr,
        link: fileDataUrl,
        timestamp: Date.now()
      });

      showToast("Resource uploaded and published!", "success");
      adminResourceForm.reset();
    } catch (err) {
      console.error(err);
      showToast("Failed to upload: " + err.message, "error");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Upload & Publish';
      }
    }
  });
}

// Delete Resource
async function adminDeleteResource(resId) {
  if (!confirm("Are you sure you want to delete this resource? Competitors will no longer be able to download it.")) {
    return;
  }
  try {
    showToast("Deleting resource...", "info");
    await deleteDoc(doc(firestore, "resources", resId));
    showToast("Resource deleted successfully!", "success");
  } catch (err) {
    showToast("Deletion failed: " + err.message, "error");
  }
}

window.adminDeleteResource = adminDeleteResource;

// Save evaluation scores & grades
async function adminSaveGrades(event, projId) {
  event.preventDefault();
  const innovation = parseFloat(document.getElementById("grade-innovation").value);
  const technical = parseFloat(document.getElementById("grade-technical").value);
  const impact = parseFloat(document.getElementById("grade-impact").value);
  const design = parseFloat(document.getElementById("grade-design").value);
  
  if (isNaN(innovation) || isNaN(technical) || isNaN(impact) || isNaN(design)) {
    showToast("Please fill in all score fields with valid numbers.", "error");
    return;
  }
  
  if (innovation > 25 || technical > 25 || impact > 25 || design > 25) {
    showToast("Scores cannot exceed 25 for any category.", "error");
    return;
  }

  if (innovation < 0 || technical < 0 || impact < 0 || design < 0) {
    showToast("Scores cannot be negative.", "error");
    return;
  }
  
  const average = parseFloat((innovation + technical + impact + design).toFixed(1));
  
  try {
    showToast("Saving project grades...", "info");
    await updateDoc(doc(firestore, "projects", projId), {
      scores: {
        innovation,
        technical,
        impact,
        design
      },
      averageScore: average
    });
    
    const avgDisplay = document.getElementById("grade-average-display");
    if (avgDisplay) avgDisplay.textContent = `${average}/100`;
    
    showToast("Grades saved successfully!", "success");
  } catch (err) {
    console.error("Failed saving grades:", err);
    showToast("Failed to save grades: " + err.message, "error");
  }
}

window.adminSaveGrades = adminSaveGrades;

// Helper: Escape HTML strings for attributes
function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Setup auditorium seat hover and click listeners
function setupSeatTooltipListeners() {
  let tooltip = document.getElementById("auditorium-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "auditorium-tooltip";
    tooltip.className = "seating-tooltip";
    document.body.appendChild(tooltip);
  }

  const seats = document.querySelectorAll(".seat-node");
  seats.forEach(seat => {
    seat.addEventListener("mouseenter", (e) => {
      const isBooked = seat.getAttribute("data-booked") === "true";
      const seatCode = seat.getAttribute("data-seat");
      
      let tooltipHTML = "";
      if (isBooked) {
        const name = seat.getAttribute("data-name");
        const email = seat.getAttribute("data-email");
        const ticketId = seat.getAttribute("data-id");
        const date = seat.getAttribute("data-date");
        
        tooltipHTML = `
          <div class="tooltip-header">
            <span>Seat ${seatCode}</span>
            <span class="badge badge-danger" style="font-size: 9px; padding: 2px 4px;">Booked</span>
          </div>
          <div class="tooltip-row"><span class="tooltip-label">Guest:</span><span class="tooltip-val">${name}</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Email:</span><span class="tooltip-val">${email}</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Ticket ID:</span><span class="tooltip-val">${ticketId}</span></div>
          <div class="tooltip-row"><span class="tooltip-label">Booked On:</span><span class="tooltip-val" style="font-size: 10px;">${date}</span></div>
        `;
      } else {
        tooltipHTML = `
          <div class="tooltip-header" style="color: var(--success);">
            <span>Seat ${seatCode}</span>
            <span class="badge badge-success" style="font-size: 9px; padding: 2px 4px;">Available</span>
          </div>
          <div style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 4px;">Ready for assignment</div>
        `;
      }
      
      tooltip.innerHTML = tooltipHTML;
      tooltip.style.opacity = "1";
    });

    seat.addEventListener("mousemove", (e) => {
      tooltip.style.left = `${e.pageX + 15}px`;
      tooltip.style.top = `${e.pageY + 15}px`;
    });

    seat.addEventListener("mouseleave", () => {
      tooltip.style.opacity = "0";
    });

    seat.addEventListener("click", () => {
      const isBooked = seat.getAttribute("data-booked") === "true";
      const seatCode = seat.getAttribute("data-seat");
      
      if (!isBooked) {
        const seatInput = document.getElementById("admin-ticket-add-seat");
        const nameInput = document.getElementById("admin-ticket-add-name");
        if (seatInput && nameInput) {
          seatInput.value = seatCode;
          nameInput.focus();
          showToast(`Seat ${seatCode} selected for assignment!`, "success");
        }
      }
    });
  });
}

// Render interactive auditorium map
function renderAuditoriumVisualizer() {
  const mapContainer = document.getElementById("admin-auditorium-map");
  if (!mapContainer) return;

  const config = ticketingConfig || {
    ticketLimit: 120,
    seatPrefix: "GA-",
    seatStartNumber: 100
  };

  const limit = Math.min(240, config.ticketLimit || 120);
  const prefix = config.seatPrefix || "GA-";
  const startNum = parseInt(config.seatStartNumber || 100);

  const cols = 12;
  const rowsCount = Math.ceil(limit / cols);

  let html = `<div class="seating-chart-container">`;
  
  for (let r = 0; r < rowsCount; r++) {
    html += `<div class="seating-row">`;
    for (let c = 0; c < cols; c++) {
      const seatIndex = r * cols + c;
      if (seatIndex >= limit) {
        break;
      }
      
      const currentSeatNumber = startNum + seatIndex;
      const seatCode = `${prefix}${currentSeatNumber}`;
      const ticket = allTickets.find(t => t.seatCode === seatCode);
      const isBooked = !!ticket;
      const isVIP = r < 2;
      const vipClass = isVIP ? "vip" : "";
      const statusClass = isBooked ? "booked" : "available";
      
      html += `
        <div class="seat-node ${statusClass} ${vipClass}" 
             data-seat="${seatCode}" 
             data-booked="${isBooked}"
             data-name="${isBooked ? escapeHTML(ticket.name) : ''}"
             data-email="${isBooked ? escapeHTML(ticket.email) : ''}"
             data-id="${isBooked ? escapeHTML(ticket.id) : ''}"
             data-date="${isBooked && ticket.timestamp ? escapeHTML(new Date(ticket.timestamp).toLocaleString()) : ''}"
        >
          ${currentSeatNumber}
        </div>
      `;
    }
    html += `</div>`;
  }
  
  html += `</div>`;
  mapContainer.innerHTML = html;

  setupSeatTooltipListeners();
}

// Render tickets list
function renderAdminTicketsList() {
  const container = document.getElementById("admin-tickets-table-body");
  if (!container) return;

  if (allTickets.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-light); padding: 32px;"><i class="fa-solid fa-ticket" style="font-size: 24px; margin-bottom: 8px; display: block; opacity: 0.5;"></i> No event tickets booked yet.</td></tr>`;
  } else {
    container.innerHTML = allTickets.map(t => {
      let regDate = "N/A";
      if (t.timestamp) {
        const d = new Date(t.timestamp);
        regDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' + 
                  d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      }
      const seatDisplay = t.seatCode 
        ? `<span class="seat-code-badge">${t.seatCode}</span>` 
        : `<span class="seat-hidden-badge">Hidden</span>`;
      return `
        <tr>
          <td><span class="ticket-id-badge">${t.id}</span></td>
          <td style="font-weight: 600; color: var(--text-main); font-size: 13.5px;">${t.name}</td>
          <td style="color: var(--text-muted); font-size: 13px;">${t.email}</td>
          <td>${seatDisplay}</td>
          <td style="font-size: 12px; color: var(--text-light);">${regDate}</td>
          <td style="text-align: center;">
            <button class="btn-delete-ticket" onclick="adminDeleteTicket('${t.id}')">
              <i class="fa-solid fa-trash-can"></i> Delete
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }
  
  // Render auditorium seating visualizer
  renderAuditoriumVisualizer();
}

// Ticketing settings form submission
const ticketingSettingsForm = document.getElementById("admin-ticketing-settings-form");
if (ticketingSettingsForm) {
  ticketingSettingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const toggle = document.getElementById("admin-tickets-toggle").checked;
    const title = document.getElementById("admin-tickets-event-title").value.trim();
    const date = document.getElementById("admin-tickets-event-date").value.trim();
    const venue = document.getElementById("admin-tickets-event-venue").value.trim();
    const limit = parseInt(document.getElementById("admin-tickets-limit").value);
    const showSeats = document.getElementById("admin-tickets-show-seats").checked;
    const seatPrefix = document.getElementById("admin-tickets-seat-prefix").value.trim();
    const seatStart = parseInt(document.getElementById("admin-tickets-seat-start").value);

    try {
      showToast("Saving ticketing settings...", "info");
      await setDoc(doc(firestore, "config", "ticketing_settings"), {
        ticketingEnabled: toggle,
        eventTitle: title,
        eventDate: date,
        eventVenue: venue,
        ticketLimit: limit,
        showSeats: showSeats,
        seatPrefix: seatPrefix,
        seatStartNumber: seatStart,
        timestamp: Date.now()
      });
      showToast("Ticketing settings saved successfully!", "success");
    } catch (err) {
      showToast("Failed to save settings: " + err.message, "error");
    }
  });
}

// Manual ticket registration
const ticketAddForm = document.getElementById("admin-ticket-add-form");
if (ticketAddForm) {
  ticketAddForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("admin-ticket-add-name").value.trim();
    const email = document.getElementById("admin-ticket-add-email").value.trim();
    const customSeat = document.getElementById("admin-ticket-add-seat").value.trim();

    if (ticketingConfig && allTickets.length >= ticketingConfig.ticketLimit) {
      showToast("Ticketing limit reached! Cannot issue more tickets.", "error");
      return;
    }

    // Determine seat code
    let finalSeat = "";
    if (customSeat) {
      finalSeat = customSeat;
    } else {
      const prefix = ticketingConfig ? (ticketingConfig.seatPrefix || "GA-") : "GA-";
      const startNum = ticketingConfig ? (ticketingConfig.seatStartNumber || 100) : 100;
      finalSeat = `${prefix}${startNum + allTickets.length}`;
    }

    try {
      showToast("Generating ticket...", "info");
      const ticketId = `TX-${Math.floor(1000 + Math.random() * 9000)}`;
      await setDoc(doc(firestore, "tickets", ticketId), {
        name,
        email,
        seatCode: finalSeat,
        timestamp: Date.now()
      });
      showToast(`Ticket ${ticketId} issued successfully!`, "success");
      ticketAddForm.reset();
    } catch (err) {
      showToast("Failed to issue ticket: " + err.message, "error");
    }
  });
}

// Delete ticket
async function adminDeleteTicket(ticketId) {
  if (!confirm(`Are you sure you want to cancel and delete ticket ${ticketId}?`)) {
    return;
  }
  try {
    showToast("Canceling ticket...", "info");
    await deleteDoc(doc(firestore, "tickets", ticketId));
    showToast("Ticket deleted successfully!", "success");
  } catch (err) {
    showToast("Failed to delete ticket: " + err.message, "error");
  }
}

window.adminDeleteTicket = adminDeleteTicket;

// Delete all applicants
const deleteAllApplicantsBtn = document.getElementById("admin-delete-all-applicants-btn");
if (deleteAllApplicantsBtn) {
  deleteAllApplicantsBtn.addEventListener("click", async () => {
    if (allProjects.length === 0) {
      showToast("No applicants to delete.", "error");
      return;
    }
    if (!confirm("CRITICAL WARNING: Are you sure you want to delete ALL applicant registrations? This action is permanent, will delete all teams, and cannot be undone.")) {
      return;
    }
    if (!confirm("Are you ABSOLUTELY sure? This will delete every team and applicant registered in the system.")) {
      return;
    }
    try {
      showToast("Deleting all applicant registrations...", "info");
      for (const proj of allProjects) {
        await deleteDoc(doc(firestore, "projects", proj.id));
      }
      showToast("All applicant registrations deleted successfully!", "success");
    } catch (err) {
      showToast("Failed to delete all applicants: " + err.message, "error");
    }
  });
}

// Share Leaderboard
const shareLeaderboardBtn = document.getElementById("admin-share-leaderboard-btn");
if (shareLeaderboardBtn) {
  shareLeaderboardBtn.addEventListener("click", () => {
    const url = window.location.origin + '/leaderboard.html';
    navigator.clipboard.writeText(url).then(() => {
      showToast('Leaderboard link copied to clipboard!', 'success');
    }).catch(err => {
      showToast('Failed to copy link. Check console.', 'error');
      console.error(err);
    });
  });
}

// Initialize realtime database connections
initRealtimeSync();

// Support Chat Realtime Sync
let supportMessages = [];
let isInitialMessagesLoad = true;
function initSupportSync() {
  const q = query(collection(firestore, "support_messages"), orderBy("timestamp", "desc"));
  onSnapshot(q, (snapshot) => {
    if (!isInitialMessagesLoad) {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          // Toasts for incoming messages
          showToast(`New Message: ${data.name} says "${data.message.substring(0, 30)}..."`, "info");
        }
      });
    }

    supportMessages = [];
    snapshot.forEach(docSnap => {
      supportMessages.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderSupportMessages();
    isInitialMessagesLoad = false;
  });
}
initSupportSync();

function renderSupportMessages() {
  const container = document.getElementById("support-messages-container");
  if (!container) return;

  if (supportMessages.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-check-circle" style="font-size: 24px; color: var(--success);"></i><p>Inbox zero! No pending messages.</p></div>`;
    return;
  }

  container.innerHTML = supportMessages.map(msg => {
    const isUnread = msg.status !== "replied";
    const date = msg.timestamp ? msg.timestamp.toDate().toLocaleString() : "Just now";
    let rawNum = msg.whatsapp.replace(/[^0-9]/g, '');
    if (rawNum.startsWith('0') && rawNum.length === 10) {
      rawNum = '233' + rawNum.substring(1);
    }
    const waLink = `https://wa.me/${rawNum}?text=${encodeURIComponent("Hello " + msg.name + ", this is HatchPoint Support. Regarding your message: '" + msg.message + "' - ")}`;
    
    return `
      <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; box-shadow: var(--shadow-sm); ${isUnread ? 'border-left: 4px solid var(--primary);' : ''}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <h4 style="margin: 0; font-size: 15px; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
              ${msg.name} ${isUnread ? '<span style="background: var(--primary); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">NEW</span>' : ''}
            </h4>
            <div style="color: var(--text-light); font-size: 12px; margin-top: 4px;">
              <i class="fa-brands fa-whatsapp" style="color: #25D366;"></i> ${msg.whatsapp} &bull; ${date}
            </div>
          </div>
          ${isUnread ? `
            <button class="btn btn-primary btn-sm mark-replied-btn" data-id="${msg.id}" style="padding: 4px 10px; font-size: 11px;">
              <i class="fa-solid fa-check"></i> Mark Replied
            </button>
          ` : `
            <span style="font-size: 12px; color: var(--success); font-weight: 600;"><i class="fa-solid fa-check-double"></i> Replied</span>
          `}
        </div>
        <div style="background: var(--bg-body); padding: 12px; border-radius: var(--radius-sm); font-size: 13px; color: var(--text-main); line-height: 1.5; white-space: pre-wrap;">${msg.message}</div>
        <div style="margin-top: 12px; display: flex; gap: 8px;">
          <a href="${waLink}" target="_blank" class="btn btn-outline btn-sm" style="font-size: 12px; border-color: #25D366; color: #25D366;">
            <i class="fa-brands fa-whatsapp"></i> Reply on WhatsApp
          </a>
          <button class="btn btn-outline btn-sm delete-chat-btn" data-id="${msg.id}" style="font-size: 12px; border-color: var(--danger); color: var(--danger);">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Attach event listeners for marking as replied
  container.querySelectorAll('.mark-replied-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      try {
        await setDoc(doc(firestore, "support_messages", id), { status: "replied" }, { merge: true });
        showToast("Marked as replied!", "success");
      } catch (err) {
        showToast("Error updating status.", "error");
      }
    });
  });

  // Attach event listeners for individual deletion
  container.querySelectorAll('.delete-chat-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (!confirm("Delete this message?")) return;
      const id = e.currentTarget.getAttribute('data-id');
      try {
        await deleteDoc(doc(firestore, "support_messages", id));
        showToast("Message deleted.", "success");
      } catch (err) {
        showToast("Error deleting message.", "error");
      }
    });
  });
}

// Bulk delete all support chats
document.addEventListener("DOMContentLoaded", () => {
  const deleteAllBtn = document.getElementById("admin-delete-all-chats-btn");
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener("click", async () => {
      if (supportMessages.length === 0) {
        showToast("No messages to delete.", "info");
        return;
      }
      if (!confirm("Are you sure you want to delete ALL support messages? This cannot be undone.")) return;
      
      try {
        showToast("Deleting messages...", "info");
        for (const msg of supportMessages) {
          await deleteDoc(doc(firestore, "support_messages", msg.id));
        }
        showToast("All messages deleted successfully!", "success");
      } catch (err) {
        console.error("Bulk delete error:", err);
        showToast("Failed to delete some messages.", "error");
      }
    });
  }
});

// SPONSORS LOGIC
const sponsorForm = document.getElementById("admin-sponsor-form");
if (sponsorForm) {
  sponsorForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("admin-sponsor-name").value.trim();
    const url = document.getElementById("admin-sponsor-url").value.trim();
    const logoFile = document.getElementById("admin-sponsor-logo").files[0];
    const btn = document.getElementById("admin-sponsor-submit-btn");

    if (!name || !logoFile) return;

    try {
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
      btn.disabled = true;

      // Compress and Read image as base64
      const logoUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 400;
            const scale = Math.min(MAX_WIDTH / img.width, 1);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png', 0.8));
          };
          img.onerror = reject;
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(logoFile);
      });

      // Save to Firestore
      await addDoc(collection(firestore, "sponsors"), {
        name,
        url,
        logoUrl,
        timestamp: serverTimestamp()
      });

      showToast("Sponsor added successfully!", "success");
      sponsorForm.reset();
      btn.innerHTML = originalText;
      btn.disabled = false;
    } catch (err) {
      console.error(err);
      showToast("Error adding sponsor.", "error");
      btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Upload Sponsor';
      btn.disabled = false;
    }
  });
}

// SPONSORS TOGGLE LOGIC
const toggleSponsorsBtn = document.getElementById("toggle-sponsors-section-btn");
if (toggleSponsorsBtn) {
  toggleSponsorsBtn.addEventListener("click", async () => {
    const isCurrentlyHidden = toggleSponsorsBtn.innerHTML.includes("Show");
    try {
      toggleSponsorsBtn.disabled = true;
      await setDoc(doc(firestore, "config", "admin_settings"), {
        hideSponsors: !isCurrentlyHidden
      }, { merge: true });
      showToast(isCurrentlyHidden ? "Sponsors section is now visible." : "Sponsors section is now hidden.", "success");
    } catch (err) {
      showToast("Failed to toggle sponsors section.", "error");
    } finally {
      toggleSponsorsBtn.disabled = false;
    }
  });
}

function initSponsorsSync() {
  const q = query(collection(firestore, "sponsors"), orderBy("timestamp", "desc"));
  onSnapshot(q, (snapshot) => {
    const list = document.getElementById("admin-sponsors-list");
    if (!list) return;

    if (snapshot.empty) {
      list.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><p>No sponsors found.</p></div>`;
      return;
    }

    let html = '';
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      html += `
        <div style="border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; text-align: center; position: relative;">
          <img src="${data.logoUrl}" alt="${data.name}" style="width: 100%; height: 80px; object-fit: contain; margin-bottom: 8px;">
          <h4 style="font-size: 13px; margin: 0 0 8px 0; color: var(--text-main);">${data.name}</h4>
          <button class="btn btn-outline btn-sm delete-sponsor-btn" data-id="${docSnap.id}" style="width: 100%; font-size: 11px; color: var(--danger); border-color: var(--danger);">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      `;
    });
    list.innerHTML = html;

    list.querySelectorAll('.delete-sponsor-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (!confirm("Delete this sponsor?")) return;
        const id = e.currentTarget.getAttribute('data-id');
        try {
          await deleteDoc(doc(firestore, "sponsors", id));
          showToast("Sponsor deleted.", "success");
        } catch (err) {
          showToast("Error deleting sponsor.", "error");
        }
      });
    });
  });
}
initSponsorsSync();
