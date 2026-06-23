import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// 1. Firebase Initialization & Config
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

// Static Data
const INITIAL_TRACKS = [
  { id: "clean-energy", name: "Clean Energy & Environment", icon: "fa-leaf", desc: "Build systems that reduce carbon footprint, manage resources sustainably, or transition to clean power." },
  { id: "fintech", name: "Fintech & Financial Inclusion", icon: "fa-wallet", desc: "Create tools that democratize access to capital, optimize banking, or streamline micro-payments." },
  { id: "healthtech", name: "Healthcare & MedTech", icon: "fa-heart-pulse", desc: "Develop software or devices that improve patient telemetry, diagnosis, or health administrative tasks." }
];

const INITIAL_RESOURCES = [
  { title: "TechX Official Rules & Guidelines", icon: "fa-file-pdf", type: "PDF Document", size: "1.2 MB", desc: "Download the complete terms, criteria weights, and technical guidelines.", link: "#" },
  { title: "Pitch Deck PowerPoint Template", icon: "fa-file-powerpoint", type: "PPTX Presentation", size: "4.8 MB", desc: "Use our approved slide outline for Demo Day to structure your problem, solution, and model.", link: "#" },
  { title: "Judging Scorecard Rubric Details", icon: "fa-clipboard-check", type: "PDF Document", size: "800 KB", desc: "A comprehensive breakdown of how judges rate Innovation, Execution, Impact, and UX.", link: "#" }
];

const INITIAL_TIMELINE = [
  { step: 1, title: "Registration Period", date: "June 1 - July 15", desc: "Register as an individual or create a team. Explore tracks and prepare project directions.", status: "completed" },
  { step: 2, title: "Application Deadline", date: "July 15 @ 23:59 EST", desc: "Submit initial proposals, team lists, and draft designs. Late entries are not accepted.", status: "active" },
  { step: 3, title: "Shortlisting & Selection", date: "July 20", desc: "Our expert panel vets all entries to select top 30 teams who will advance to the next phase.", status: "upcoming" },
  { step: 4, title: "Mentorship Phase", date: "July 22 - Aug 10", desc: "Selected teams are paired with top-tier coaches for architecture, UX, and business modeling.", status: "upcoming" },
  { step: 5, title: "Demo Day", date: "August 15", desc: "Teams present live prototype demonstrations and pitch pitches to a global panel of judges.", status: "upcoming" },
  { step: 6, title: "Awards Ceremony", date: "August 18", desc: "Winners are officially announced. Networking opportunities open for all finalists.", status: "upcoming" }
];

// State Cache
let allProjects = [];
let allNews = [];
let allTracks = [];
let allTimeline = [];
let landingStatsConfig = null;
let allPrizes = [];

// DOM Elements
const navLinks = document.querySelectorAll(".nav-link, .mobile-nav-link");
const viewSections = document.querySelectorAll(".view");
const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const mobileDrawer = document.getElementById("mobile-drawer");

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

// View Routing
function getActiveViewId() {
  const activeSection = document.querySelector(".view.active");
  return activeSection ? activeSection.id.replace("-view", "") : "home";
}

function showView(viewId) {
  viewSections.forEach(section => {
    if (section.id === `${viewId}-view`) {
      section.classList.add("active");
    } else {
      section.classList.remove("active");
    }
  });

  // Sync nav active states
  document.querySelectorAll(".nav-link, .mobile-nav-link").forEach(link => {
    if (link.getAttribute("data-view") === viewId) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  // Sync mobile bottom nav active states
  document.querySelectorAll(".mobile-bottom-nav-item").forEach(item => {
    if (item.getAttribute("data-view") === viewId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  window.scrollTo({ top: 0 });

  if (viewId === "home") {
    renderLandingTracks();
    renderLandingTimeline();
  }
  if (viewId === "news") renderNewsFeed();
  if (viewId === "resources") renderResources();
  if (viewId === "showcase") renderShowcase();
}

function handleNavigationClick(e) {
  e.preventDefault();
  const target = e.currentTarget;
  const view = target.getAttribute("data-view");
  const scrollTarget = target.getAttribute("data-scroll");

  // Close mobile drawer if open
  mobileDrawer.classList.remove("open");
  mobileMenuBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';

  if (view) {
    showView(view);
    
    if (scrollTarget) {
      setTimeout(() => {
        const element = document.getElementById(scrollTarget);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  }
}

// Attach Nav Listeners
navLinks.forEach(link => link.addEventListener("click", handleNavigationClick));

// Attach Footer Links Listeners
document.querySelectorAll(".footer-link").forEach(link => {
  if (link.getAttribute("data-view")) {
    link.addEventListener("click", handleNavigationClick);
  }
});

// Attach Mobile Bottom Nav Listeners
document.querySelectorAll(".mobile-bottom-nav-item").forEach(item => {
  item.addEventListener("click", (e) => {
    const view = item.getAttribute("data-view");
    if (view) {
      e.preventDefault();
      showView(view);
    }
  });
});

const navLogo = document.getElementById("nav-logo");
if (navLogo) {
  navLogo.addEventListener("click", (e) => {
    e.preventDefault();
    showView("home");
  });
}

const learnMoreBtn = document.getElementById("learn-more-btn");
if (learnMoreBtn) {
  learnMoreBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const aboutSec = document.getElementById("about");
    if (aboutSec) aboutSec.scrollIntoView({ behavior: "smooth" });
  });
}

// Mobile drawer toggle
mobileMenuBtn.addEventListener("click", () => {
  const isOpen = mobileDrawer.classList.toggle("open");
  mobileMenuBtn.innerHTML = isOpen ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
});

// Render landing page tracks
function renderLandingTracks() {
  const container = document.getElementById("landing-tracks-list");
  if (!container) return;

  const visibleTracks = allTracks.filter(t => t.visible !== false);

  if (visibleTracks.length === 0) {
    // Dynamic self-healing fallback to initial static tracks
    container.innerHTML = INITIAL_TRACKS.map(track => `
      <div class="card track-card">
        <div class="card-icon"><i class="fa-solid ${track.icon}"></i></div>
        <h3>${track.name}</h3>
        <p>${track.desc}</p>
      </div>
    `).join("");
    return;
  }

  container.innerHTML = visibleTracks.map(track => `
    <div class="card track-card">
      <div class="card-icon"><i class="fa-solid ${track.icon || 'fa-tag'}"></i></div>
      <h3>${track.name}</h3>
      <p>${track.desc}</p>
    </div>
  `).join("");
}

// Render landing page dynamic timeline milestones
function renderLandingTimeline() {
  const container = document.getElementById("landing-timeline-container");
  if (!container) return;

  const items = allTimeline.length > 0 ? allTimeline : INITIAL_TIMELINE;

  container.innerHTML = `
    <div class="timeline-line"></div>
    ${items.map(item => {
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

// Update dynamic participants stats value
function updateLandingHeaderStats() {
  const partsVal = document.getElementById("stat-participants");
  if (!partsVal) return;

  if (!landingStatsConfig) {
    partsVal.textContent = "1,240+";
    return;
  }

  if (landingStatsConfig.participantsMode === "manual") {
    partsVal.textContent = landingStatsConfig.participantsOverride || "0";
  } else {
    const sum = allProjects.reduce((acc, p) => acc + (p.members ? p.members.length : 0), 0);
    partsVal.textContent = sum > 0 ? `${sum}+` : "0";
  }
}

// Render Prizes list on landing page
function renderLandingPrizes() {
  const container = document.getElementById("landing-prizes-list");
  if (!container) return;

  if (allPrizes.length === 0) {
    container.innerHTML = `<p style="text-align: center; grid-column: 1 / -1; color: var(--text-light); font-size: 14px;">No rewards configured yet.</p>`;
    return;
  }

  container.innerHTML = allPrizes.map(p => {
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

// Render News Feed
function renderNewsFeed(filteredCategory = "all") {
  const container = document.getElementById("news-feed-container");
  if (!container) return;

  const filtered = filteredCategory === "all" 
    ? allNews 
    : allNews.filter(item => item.category === filteredCategory);

  const images = {
    code: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=400&q=80",
    meeting: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=400&q=80",
    presentation: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=400&q=80",
    launch: "https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&w=400&q=80"
  };

  if (filtered.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-light); padding: 40px;">No articles found in this category.</p>`;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <article class="news-card" data-id="${item.id}">
      <img src="${images[item.img] || images.code}" alt="${item.title}" class="news-img">
      <div class="news-body">
        <div class="news-meta">
          <span class="news-category">${item.category}</span>
          <span>${item.date || 'June 2026'}</span>
        </div>
        <h3>${item.title}</h3>
        <p>${item.content}</p>
        <button class="btn btn-outline btn-sm read-news-btn" style="margin-top: 12px;">Read Full Story</button>
      </div>
    </article>
  `).join("");

  container.querySelectorAll(".news-card, .read-news-btn").forEach(card => {
    card.addEventListener("click", (e) => {
      const articleId = e.currentTarget.closest("article").getAttribute("data-id");
      const article = allNews.find(n => n.id === articleId);
      if (article) {
        openModal(article.title, `
          <div style="font-size: 13px; color: var(--primary); font-weight: 700; margin-bottom: 8px; text-transform: uppercase;">${article.category} | ${article.date || ''}</div>
          <div style="font-size: 15px; line-height: 1.7; color: var(--text-muted); margin-top: 16px; white-space: pre-wrap;">${article.content}</div>
        `);
      }
    });
  });
}

// News Filters
const categoryFilterBtns = document.querySelectorAll("#news-categories-filter .filter-btn");
categoryFilterBtns.forEach(btn => {
  btn.addEventListener("click", (e) => {
    categoryFilterBtns.forEach(b => b.classList.remove("active"));
    e.currentTarget.classList.add("active");
    renderNewsFeed(e.currentTarget.getAttribute("data-category"));
  });
});

// Interactive Timeline
const timelineItems = document.querySelectorAll(".timeline-item");
timelineItems.forEach(item => {
  item.addEventListener("click", () => {
    const step = item.getAttribute("data-step");
    let title = "";
    let content = "";
    
    switch(step) {
      case "1":
        title = "Registration Period (June 1 - July 15)";
        content = "<p>Teams and individuals from across the globe submit applications defining their team composition, focus track choice, and profile competency descriptions. Individual builders match with teams here.</p><h4>Requirements:</h4><ul><li>Valid profiles for all builders</li><li>Track choice selected</li></ul>";
        break;
      case "2":
        title = "Application Deadline (July 15 @ 23:59 EST)";
        content = "<p>Final calls for submission drafts. Teams must lock and submit their projects with descriptive briefs, initial structural architecture plans, mockups, or wireframes. Automatic lockout follows after deadline.</p>";
        break;
      case "3":
        title = "Shortlisting Phase (July 20)";
        content = "<p>Our expert judge panel and committee coordinators vet all submitted concepts. The top 30 submissions demonstrating high innovation, social viability, and clean feasibility are selected to proceed to the Mentorship Cohort.</p>";
        break;
      case "4":
        title = "Mentorship Phase (July 22 - Aug 10)";
        content = "<p>Selected cohorts get assigned dedicated experts. Over 3 weeks, mentors support refining prototype structures, interface UX, cloud deployment, and business pitch structures in scheduled weekly meetings.</p>";
        break;
      case "5":
        title = "Demo Day (August 15)";
        content = "<p>The grand finale event. Finalists stream live presentations showcasing functional codebases and pitch structures to our panels of judges, seed VCs, and tech community leads.</p>";
        break;
      case "6":
        title = "Awards Ceremony (August 18)";
        content = "<p>Closing gala event announcing winners and distribution of the prize funding pools. Direct acceleration opportunities and credits are distributed to finalists.</p>";
        break;
    }

    openModal(title, `
      <div style="font-size: 15px; color: var(--text-muted); line-height: 1.6;">
        ${content}
      </div>
    `);
  });
});

// Render Resources
function renderResources() {
  const publicGrid = document.getElementById("public-resources-grid");
  if (!publicGrid) return;

  publicGrid.innerHTML = INITIAL_RESOURCES.map(res => `
    <div class="resource-card">
      <div class="resource-icon"><i class="fa-solid ${res.icon}"></i></div>
      <div class="resource-info">
        <h4>${res.title}</h4>
        <p>${res.desc}</p>
        <span style="font-size: 11px; color: var(--text-light); display: block; margin-bottom: 8px;">${res.type} &bull; ${res.size}</span>
        <a href="${res.link}" class="resource-link download-mock-btn" data-res="${res.title}"><i class="fa-solid fa-download"></i> Download Template</a>
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".download-mock-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const resTitle = e.currentTarget.getAttribute("data-res");
      showToast(`Started download for: ${resTitle}`, "info");
    });
  });
}

// Render Showcase
function renderShowcase() {
  const container = document.getElementById("showcase-feed-container");
  if (!container) return;

  const projects = allProjects.filter(p => p.status === "Approved");

  if (projects.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-light); padding: 40px;">No winner projects showcase published yet. Approved applicant projects will be dynamically posted here.</p>`;
    return;
  }

  const images = {
    "clean-energy": "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=400&q=80",
    "fintech": "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=400&q=80",
    "healthtech": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=400&q=80"
  };

  container.innerHTML = projects.map(proj => {
    const trackObj = INITIAL_TRACKS.find(t => t.id === proj.track);
    const scoreBadge = proj.averageScore ? `<div class="showcase-award-badge"><i class="fa-solid fa-star"></i> Score: ${proj.averageScore}/10</div>` : '';
    
    return `
      <div class="showcase-card">
        <div class="showcase-img-container">
          <img src="${images[proj.track] || images['clean-energy']}" alt="${proj.title}" class="showcase-img">
          <span class="badge showcase-badge"><i class="fa-solid fa-code-fork"></i> Showcase Entry</span>
          ${scoreBadge}
        </div>
        <div class="showcase-body">
          <div class="showcase-track">${trackObj ? trackObj.name : proj.track}</div>
          <h3>${proj.title || 'Untitled Project'}</h3>
          <p class="showcase-desc">${proj.description || 'No description provided.'}</p>
          
          <div class="showcase-team">
            <div>Built by: <span class="showcase-team-name">${proj.teamName}</span></div>
            <span class="showcase-members-count">${(proj.members || []).length} members</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// Database Listeners
function initRealtimeSync() {
  onSnapshot(collection(firestore, "news"), (snapshot) => {
    allNews = [];
    snapshot.forEach(d => {
      allNews.push({ id: d.id, ...d.data() });
    });
    allNews.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Update Layout badge
    const announcementsCount = allNews.filter(n => n.category === "Announcements" || n.category === "Deadlines").length;
    const badgeAnnouncements = document.getElementById("badge-announcements-count");
    if (badgeAnnouncements) {
      if (announcementsCount > 0) {
        badgeAnnouncements.textContent = announcementsCount;
        badgeAnnouncements.style.display = "inline-block";
      } else {
        badgeAnnouncements.style.display = "none";
      }
    }

    if (getActiveViewId() === "news") renderNewsFeed();
  });

  onSnapshot(collection(firestore, "projects"), (snapshot) => {
    allProjects = [];
    snapshot.forEach(d => {
      allProjects.push({ id: d.id, ...d.data() });
    });
    updateLandingHeaderStats();

    if (getActiveViewId() === "showcase") renderShowcase();
  });

  onSnapshot(collection(firestore, "tracks"), (snapshot) => {
    allTracks = [];
    snapshot.forEach(d => {
      allTracks.push({ id: d.id, ...d.data() });
    });
    allTracks.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    if (getActiveViewId() === "home") renderLandingTracks();
  });

  onSnapshot(collection(firestore, "timeline"), (snapshot) => {
    allTimeline = [];
    snapshot.forEach(d => {
      allTimeline.push({ id: d.id, ...d.data() });
    });
    allTimeline.sort((a, b) => (a.step || 0) - (b.step || 0));
    
    if (getActiveViewId() === "home") renderLandingTimeline();
  });

  onSnapshot(doc(firestore, "config", "landing_stats"), (snapshot) => {
    if (snapshot.exists()) {
      landingStatsConfig = snapshot.data();
    } else {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 18);
      landingStatsConfig = {
        participantsMode: "dynamic",
        countdownDate: defaultDate.toISOString()
      };
    }
    updateLandingHeaderStats();

    if (window.countdownIntervalId) clearInterval(window.countdownIntervalId);

    const targetTime = new Date(landingStatsConfig.countdownDate).getTime();
    const updateCountdown = () => {
      const now = Date.now();
      const diff = targetTime - now;
      const daysVal = document.getElementById("stat-days");
      const daysLabel = document.getElementById("stat-days-label");
      if (!daysVal) return;

      if (isNaN(targetTime) || diff <= 0) {
        daysVal.textContent = "0";
        if (daysLabel) daysLabel.textContent = "Time Elapsed";
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days > 0) {
        daysVal.textContent = days;
        if (daysLabel) daysLabel.textContent = days === 1 ? "Day Left" : "Days Left";
      } else {
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        daysVal.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        if (daysLabel) daysLabel.textContent = "Time Left";
      }
    };
    updateCountdown();
    window.countdownIntervalId = setInterval(updateCountdown, 1000);
  });

  onSnapshot(collection(firestore, "prizes"), async (snapshot) => {
    allPrizes = [];
    snapshot.forEach(d => {
      allPrizes.push({ id: d.id, ...d.data() });
    });

    if (snapshot.empty) {
      const defaultPrizes = [
        { rank: "1st Place Grand Winner", amount: "GH₵ 100,000", desc: "Equivalent value in full-stack engineering support, premium co-working space incubation, GH₵ 30,000 AWS credits, and global showcase publicity.", popular: true, timestamp: 1 },
        { rank: "Runner Up", amount: "GH₵ 50,000", desc: "Equivalent value in architecture reviews, code deployment assistance, GH₵ 15,000 AWS cloud credits, and 3 months mentorship.", popular: false, timestamp: 2 },
        { rank: "3rd Place", amount: "GH₵ 25,000", desc: "Equivalent value in technical deployment reviews, GH₵ 10,000 cloud infrastructure credits, and partner networking access.", popular: false, timestamp: 3 }
      ];
      try {
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
      } catch (err) {
        console.error("Failed seeding prizes:", err);
      }
    }

    allPrizes.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    if (getActiveViewId() === "home") renderLandingPrizes();
  });

  // Watch legal collection
  onSnapshot(collection(firestore, "legal"), async (snapshot) => {
    let allLegal = [];
    snapshot.forEach(d => {
      allLegal.push({ id: d.id, ...d.data() });
    });
    allLegal.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Render to public-legal-grid
    const legalGrid = document.getElementById("public-legal-grid");
    if (legalGrid) {
      if (allLegal.length === 0) {
        legalGrid.innerHTML = `<p style="text-align: center; color: var(--text-muted); grid-column: 1 / -1;">No terms or policies configured yet.</p>`;
      } else {
        legalGrid.innerHTML = allLegal.map(leg => `
          <div class="card" style="padding: 24px; display: flex; flex-direction: column; gap: 12px; background: var(--bg-card); box-shadow: var(--shadow-sm); border-radius: var(--radius-md);">
            <div style="display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 18px; color: var(--text-main); font-family: var(--font-heading);">
              <i class="fa-solid fa-gavel" style="color: var(--primary);"></i> ${leg.title}
            </div>
            <p style="font-size: 14px; color: var(--text-muted); line-height: 1.6; margin: 0; white-space: pre-line;">${leg.content}</p>
          </div>
        `).join("");
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

// FAQ Accordion Toggle Interaction
function initFaqAccordion() {
  const headers = document.querySelectorAll(".accordion-header");
  headers.forEach(header => {
    header.addEventListener("click", () => {
      const item = header.parentElement;
      const isActive = item.classList.contains("active");
      
      // Close all other accordion items
      document.querySelectorAll(".accordion-item").forEach(i => {
        i.classList.remove("active");
      });
      
      // Toggle active class on clicked item
      if (!isActive) {
        item.classList.add("active");
      }
    });
  });
}

// Window load init
window.addEventListener("DOMContentLoaded", () => {
  renderLandingTracks();
  renderLandingTimeline();
  renderLandingPrizes();
  initRealtimeSync();
  checkBrowserAndEnforceChrome();
  initFaqAccordion();

  const hash = window.location.hash.substring(1);
  if (["home", "resources", "news", "showcase", "legal"].includes(hash)) {
    showView(hash);
  } else {
    showView("home");
  }
});
