import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, updateDoc, collection, addDoc, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

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
const firestore = getFirestore(app);

// State Memory
let currentUser = null;
let allProjects = [];
let allNews = [];
let allUsers = [];
let allTracks = [];
let allTimeline = [];
let allPrizes = [];
let allLegal = [];
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
function openModal(title, contentHTML) {
  modalTitle.textContent = title;
  modalBody.innerHTML = contentHTML;
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

    try {
      showToast("Signing in...", "info");
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const uid = userCredential.user.uid;
      
      const userDocRef = doc(firestore, "users", uid);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.exists() ? userDocSnap.data() : null;
      
      if (!userData || !userData.isAdmin) {
        showToast("Access Denied. Only organizers/admins are allowed to log in.", "error");
        await signOut(auth);
        return;
      }

      showToast("Signed in successfully!", "success");
      loginForm.reset();
    } catch (err) {
      console.error(err);
      showToast(getCleanErrorMessage(err), "error");
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
      });
      showToast("Security settings updated!", "success");
    } catch (err) {
      showToast("Failed to update settings: " + getCleanErrorMessage(err), "error");
    }
  });
}

// Landing page stats form configuration
const adminLandingStatsForm = document.getElementById("admin-landing-stats-form");
const adminStatsPartMode = document.getElementById("admin-stats-participants-mode");
const adminStatsManualGroup = document.getElementById("admin-stats-manual-group");

if (adminStatsPartMode) {
  adminStatsPartMode.addEventListener("change", () => {
    if (adminStatsManualGroup) {
      adminStatsManualGroup.style.display = adminStatsPartMode.value === "manual" ? "block" : "none";
    }
  });
}

if (adminLandingStatsForm) {
  adminLandingStatsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const mode = document.getElementById("admin-stats-participants-mode").value;
    const overrideVal = document.getElementById("admin-stats-participants-override").value.trim();
    const countdownVal = document.getElementById("admin-stats-countdown-date").value;

    try {
      showToast("Saving header statistics configuration...", "info");
      await setDoc(doc(firestore, "config", "landing_stats"), {
        participantsMode: mode,
        participantsOverride: overrideVal,
        countdownDate: countdownVal,
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
  onSnapshot(collection(firestore, "projects"), (snapshot) => {
    allProjects = [];
    snapshot.forEach(d => {
      allProjects.push({ id: d.id, ...d.data() });
    });
    renderAdminDashboard();
  });

  onSnapshot(collection(firestore, "news"), (snapshot) => {
    allNews = [];
    snapshot.forEach(d => {
      allNews.push({ id: d.id, ...d.data() });
    });
  });

  onSnapshot(collection(firestore, "users"), (snapshot) => {
    allUsers = [];
    snapshot.forEach(d => {
      allUsers.push({ uid: d.id, ...d.data() });
    });
  });

  onSnapshot(collection(firestore, "tracks"), async (snapshot) => {
    allTracks = [];
    snapshot.forEach(d => {
      allTracks.push({ id: d.id, ...d.data() });
    });
    
    if (snapshot.empty && currentUser) {
      const defaultTracks = [
        { id: "clean-energy", name: "Clean Energy & Environment", icon: "fa-leaf", desc: "Build systems that reduce carbon footprint, manage resources sustainably, or transition to clean power.", visible: true },
        { id: "fintech", name: "Fintech & Financial Inclusion", icon: "fa-wallet", desc: "Create tools that democratize access to capital, optimize banking, or streamline micro-payments.", visible: true },
        { id: "healthtech", name: "Healthcare & MedTech", icon: "fa-heart-pulse", desc: "Develop software or devices that improve patient telemetry, diagnosis, or health administrative tasks.", visible: true }
      ];
      try {
        for (const tr of defaultTracks) {
          await setDoc(doc(firestore, "tracks", tr.id), {
            name: tr.name,
            icon: tr.icon,
            desc: tr.desc,
            visible: tr.visible,
            timestamp: Date.now()
          });
        }
      } catch (err) {
        console.error("Failed seeding tracks", err);
      }
    }
    
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
    if (snapshot.exists()) {
      activeCustomFields = snapshot.data().customFields || [];
    } else {
      activeCustomFields = [];
    }
    if (activeAdminTab === "form-config") {
      renderAdminCustomFieldsList();
    }
  });

  // Watch security configuration settings
  onSnapshot(doc(firestore, "config", "admin_settings"), (snapshot) => {
    if (snapshot.exists()) {
      signupEnabled = snapshot.data().signupEnabled !== false;
    } else {
      signupEnabled = true;
      if (currentUser) {
        setDoc(doc(firestore, "config", "admin_settings"), { signupEnabled: true }).catch(err => console.log("Seeding config deferred:", err.message));
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

      if (modeSelect) modeSelect.value = data.participantsMode || "dynamic";
      if (overrideInput) overrideInput.value = data.participantsOverride || "";
      if (dateInput) dateInput.value = data.countdownDate || "";
      if (manualGroup) {
        manualGroup.style.display = (data.participantsMode === "manual") ? "block" : "none";
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
          countdownDate: defaultDateStr,
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
        { id: "terms", title: "Terms & Rules", content: "1. All submitted prototypes must be original and built during the hackathon period.\n2. Teams must consist of 1 to 5 members enrolled at KNUST.\n3. The judges' decision is final and binding in all aspects of the challenge.", timestamp: Date.now() },
        { id: "privacy", title: "Privacy Policy", content: "1. We collect applicant email addresses, team names, and school information solely for organizing the TechX Challenge.\n2. Your data is stored securely using Firebase Firestore.\n3. We do not share your private contact information with third-party advertisers.", timestamp: Date.now() + 1 },
        { id: "support", title: "Contact Support", content: "For technical queries, platform assistance, or registration edits, please contact support at support@techxchallenge.knust.edu.gh or visit the KSB administration desk.", timestamp: Date.now() + 2 }
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
      const scoreText = p.averageScore ? `${p.averageScore}/10` : `<span style="color: var(--text-light); font-size: 11px;">Not Graded</span>`;
      
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

      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--text-main);">${p.teamName}</div>
            <div style="font-size: 12px; color: var(--text-light);">${p.title}</div>
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

  else if (activeAdminTab === "timeline-config") {
    renderAdminTimelineList();
  }

  else if (activeAdminTab === "rewards-config") {
    renderAdminRewardsList();
  }
  else if (activeAdminTab === "legal-config") {
    renderAdminLegalList();
  }
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
    });
    showToast("Custom field removed successfully!", "success");
  } catch (err) {
    showToast("Deletion failed: " + getCleanErrorMessage(err), "error");
  }
}

function adminViewProjectDetails(projId) {
  const proj = allProjects.find(p => p.id === projId);
  if (!proj) return;

  const trackObj = allTracks.find(t => t.id === proj.track);
  const trackName = trackObj ? trackObj.name : proj.track;

  let fileIcon = "fa-file-word";
  let fileColor = "#2b579a";
  const fileType = (proj.conceptNoteType || "").toUpperCase();
  if (fileType === "PDF") {
    fileIcon = "fa-file-pdf";
    fileColor = "#e0443e";
  } else if (fileType === "PPTX" || fileType === "PPT") {
    fileIcon = "fa-file-powerpoint";
    fileColor = "#d24726";
  } else if (fileType === "DOCX" || fileType === "DOC") {
    fileIcon = "fa-file-word";
    fileColor = "#2b579a";
  } else {
    fileIcon = "fa-file";
    fileColor = "var(--text-light)";
  }

  const downloadLink = proj.conceptNoteUrl 
    ? `<div style="margin-top: 6px;"><a href="${proj.conceptNoteUrl}" target="_blank" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; font-size: 11px;"><i class="fa-solid fa-file-arrow-down"></i> Read &amp; Download</a></div>`
    : `<div style="font-size: 11px; color: var(--text-light); margin-top: 4px;"><i class="fa-solid fa-triangle-exclamation"></i> Uploaded locally (no URL available)</div>`;

  const customFieldsHTML = Object.entries(proj.customFields || {}).map(([key, val]) => `
    <div style="margin-bottom: 8px; border-bottom: 1px solid var(--border); padding-bottom: 4px;">
      <div style="font-size: 12px; color: var(--text-light); text-transform: uppercase;">${key}</div>
      <div style="font-size: 14px; color: var(--text-main); font-weight: 500;">${val || 'N/A'}</div>
    </div>
  `).join("");

  const membersHTML = (proj.members || []).map((m, idx) => `
    <div style="border: 1px solid var(--border); padding: 10px; border-radius: var(--radius-sm); background: var(--bg-app);">
      <div style="font-weight: 600; font-size: 13px; color: var(--text-main);">Builder ${idx + 1}: ${m}</div>
      <div style="font-size: 12px; color: var(--text-muted);">Email: ${proj.emails ? proj.emails[idx] : ''}</div>
      <div style="font-size: 12px; color: var(--text-muted);">Phone: ${proj.contacts ? proj.contacts[idx] : ''}</div>
    </div>
  `).join("");

  openModal(`Team Details: ${proj.teamName}`, `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start;">
      <div>
        <h4 style="margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 4px; color: var(--primary);">Basic Submissions</h4>
        <div style="margin-bottom: 12px;">
          <label style="font-size: 11px; text-transform: uppercase; color: var(--text-light);">Focus Track</label>
          <div style="font-size: 14px; font-weight: 600; color: var(--text-main);">${trackName}</div>
        </div>
        <div style="margin-bottom: 12px;">
          <label style="font-size: 11px; text-transform: uppercase; color: var(--text-light);">Concept File</label>
          <div style="font-size: 14px; font-weight: 600; color: var(--text-main);"><i class="fa-solid ${fileIcon}" style="color: ${fileColor};"></i> ${proj.conceptNoteName || 'concept_note.docx'}</div>
          ${downloadLink}
        </div>
        <div style="margin-bottom: 12px;">
          <label style="font-size: 11px; text-transform: uppercase; color: var(--text-light);">Registration Status</label>
          <div><span class="badge badge-${proj.status === 'Approved' ? 'success' : 'warning'}">${proj.status}</span></div>
        </div>

        <h4 style="margin-top: 20px; margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 4px; color: var(--secondary);">Additional Details</h4>
        ${customFieldsHTML || '<p style="font-size: 13px; color: var(--text-light);">No custom fields provided.</p>'}
      </div>

      <div>
        <h4 style="margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 4px; color: var(--accent);">Team Members (3 slots)</h4>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${membersHTML}
        </div>
      </div>
    </div>
  `);
}

// News compose submission
const adminNewsForm = document.getElementById("admin-news-form");
if (adminNewsForm) {
  adminNewsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("news-title").value.trim();
    const category = document.getElementById("news-cat-select").value;
    const img = document.getElementById("news-img-select").value;
    const content = document.getElementById("news-body-content").value.trim();

    try {
      showToast("Publishing article...", "info");
      await addDoc(collection(firestore, "news"), {
        title,
        category,
        img,
        content,
        timestamp: Date.now()
      });
      showToast("Published article successfully!", "success");
      adminNewsForm.reset();
    } catch (err) {
      showToast("Failed to publish: " + getCleanErrorMessage(err), "error");
    }
  });
}

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
      });
      showToast("Custom field added successfully!", "success");
      addFieldForm.reset();
    } catch (err) {
      showToast("Failed to save field: " + getCleanErrorMessage(err), "error");
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
      const basic = [
        p.teamName, p.title, p.track, p.status, p.averageScore || 'N/A',
        p.members ? p.members[0] : '', p.emails ? p.emails[0] : '', p.contacts ? p.contacts[0] : '',
        p.members ? p.members[1] : '', p.emails ? p.emails[1] : '', p.contacts ? p.contacts[1] : '',
        p.members ? p.members[2] : '', p.emails ? p.emails[2] : '', p.contacts ? p.contacts[2] : '',
        p.conceptNoteName || '', p.conceptNoteUrl || '',
        p.timestamp ? new Date(p.timestamp).toLocaleString() : ''
      ];
      
      const customVals = customHeaders.map(h => (p.customFields || {})[h] || '');
      return [...basic, ...customVals].map(val => `"${String(val).replace(/"/g, '""')}"`).join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `techx_registrations_${Date.now()}.csv`);
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
        { id: "terms", title: "Terms & Rules", content: "1. All submitted prototypes must be original and built during the hackathon period.\n2. Teams must consist of 1 to 5 members enrolled at KNUST.\n3. The judges' decision is final and binding in all aspects of the challenge.", timestamp: Date.now() },
        { id: "privacy", title: "Privacy Policy", content: "1. We collect applicant email addresses, team names, and school information solely for organizing the TechX Challenge.\n2. Your data is stored securely using Firebase Firestore.\n3. We do not share your private contact information with third-party advertisers.", timestamp: Date.now() + 1 },
        { id: "support", title: "Contact Support", content: "For technical queries, platform assistance, or registration edits, please contact support at support@techxchallenge.knust.edu.gh or visit the KSB administration desk.", timestamp: Date.now() + 2 }
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
        timestamp: Date.now()
      });
      showToast("Track configurations saved successfully!", "success");
      adminTrackForm.reset();
      document.getElementById("admin-track-edit-id").value = "";
      document.getElementById("admin-track-id").disabled = false;
      document.getElementById("admin-track-form-title").textContent = "Add New Challenge Track";
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
    container.innerHTML = `<p style="text-align: center; color: var(--text-light); font-size: 13px; padding: 20px;">No legal documents configured. Add one on the left.</p>`;
    return;
  }

  container.innerHTML = allLegal.map(leg => `
    <div style="border: 1px solid var(--border); padding: 16px; border-radius: var(--radius-md); background: var(--bg-app); display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="font-weight: 700; color: var(--text-main); font-size: 14px;">
          <i class="fa-solid fa-gavel" style="color: var(--primary);"></i> ${leg.title}
        </div>
      </div>
      <p style="font-size: 12px; color: var(--text-muted); margin: 0; line-height: 1.5; white-space: pre-line;">${leg.content}</p>
      <div style="display: flex; gap: 8px; margin-top: 8px; border-top: 1px dashed var(--border); padding-top: 8px; justify-content: flex-end;">
        <button class="btn btn-secondary btn-sm" onclick="adminEditLegal('${leg.id}')" style="padding: 4px 8px; font-size: 11px;"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
        <button class="btn btn-outline btn-sm" onclick="adminDeleteLegal('${leg.id}')" style="color: var(--danger); border-color: var(--danger); padding: 4px 8px; font-size: 11px;"><i class="fa-solid fa-trash-can"></i> Delete</button>
      </div>
    </div>
  `).join("");
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

// Initialize realtime database connections
initRealtimeSync();
