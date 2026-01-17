const form = document.getElementById("postForm");
const nameEl = document.getElementById("name");
const titleEl = document.getElementById("title");
const captionEl = document.getElementById("caption");
const hashtagsEl = document.getElementById("hashtags");
const imageEl = document.getElementById("image");
const preview = document.getElementById("preview");

const categoryEl = document.getElementById("category");
const moodEl = document.getElementById("mood");
const schoolEl = document.getElementById("school"); // NEW
const locationEl = document.getElementById("location");
const anonymousEl = document.getElementById("anonymous");

const postsEl = document.getElementById("posts");
const emptyState = document.getElementById("emptyState");
const searchEl = document.getElementById("search");

const clearBtn = document.getElementById("clearBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const clearSearchBtn = document.getElementById("clearSearchBtn");

const categoryFilters = document.getElementById("categoryFilters");
const schoolFilters = document.getElementById("schoolFilters"); // NEW
const locationFilters = document.getElementById("locationFilters");

const resetCategoryFiltersBtn = document.getElementById("resetCategoryFilters");
const resetSchoolFiltersBtn = document.getElementById("resetSchoolFilters"); // NEW
const resetLocationFiltersBtn = document.getElementById("resetLocationFilters");

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxClose = document.getElementById("lightboxClose");

const STORAGE_KEY_POSTS = "student_stories_posts_v5";
const STORAGE_KEY_FILTERS = "student_stories_filters_v2";

/* ---------------------------
   FILTER STATE (multi-select)
---------------------------- */
let activeCategories = new Set(); // empty => ALL
let activeLocations = new Set();  // empty => ALL
let activeSchools = new Set();    // empty => ALL

function normalizeLocation(loc) {
  const v = (loc || "").trim();
  return v ? v : "Not specified";
}

function normalizeSchool(s) {
  const v = (s || "").trim();
  return v ? v : "Not specified";
}

/* ---------------------------
   HELPERS
---------------------------- */
function parseHashtags(input) {
  const raw = (input || "").trim();
  if (!raw) return [];

  const tags = raw
    .split(/\s+/)
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => (t.startsWith("#") ? t : "#" + t))
    .map(t => t.replace(/[^#\w]/g, ""))
    .filter(t => t.length > 1);

  return Array.from(new Set(tags)).slice(0, 12);
}

function loadPosts() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY_POSTS) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function savePosts(posts) {
  localStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(posts));
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(str) {
  return (str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPostById(posts, id) {
  const idx = posts.findIndex(p => p.id === id);
  return { idx, post: idx >= 0 ? posts[idx] : null };
}

/* ---------------------------
   REMEMBER FILTERS (localStorage)
---------------------------- */
function saveFilters() {
  const payload = {
    categories: Array.from(activeCategories),
    locations: Array.from(activeLocations),
    schools: Array.from(activeSchools)
  };
  localStorage.setItem(STORAGE_KEY_FILTERS, JSON.stringify(payload));
}

function loadFilters() {
  try {
    const payload = JSON.parse(localStorage.getItem(STORAGE_KEY_FILTERS) || "{}");
    activeCategories = new Set(Array.isArray(payload.categories) ? payload.categories : []);
    activeLocations = new Set(Array.isArray(payload.locations) ? payload.locations : []);
    activeSchools = new Set(Array.isArray(payload.schools) ? payload.schools : []);
  } catch {
    activeCategories = new Set();
    activeLocations = new Set();
    activeSchools = new Set();
  }
}

/* ---------------------------
   FILTER UI SYNC
---------------------------- */
function setChipPressed(btn, pressed) {
  btn.setAttribute("aria-pressed", pressed ? "true" : "false");
}

function syncFilterUI() {
  // Category
  categoryFilters.querySelectorAll('.filter-chip[data-filter="category"]').forEach(btn => {
    const v = btn.dataset.value;
    setChipPressed(btn, v === "All" ? activeCategories.size === 0 : activeCategories.has(v));
  });

  // School
  schoolFilters.querySelectorAll('.filter-chip[data-filter="school"]').forEach(btn => {
    const v = btn.dataset.value;
    setChipPressed(btn, v === "All" ? activeSchools.size === 0 : activeSchools.has(v));
  });

  // Location
  locationFilters.querySelectorAll('.filter-chip[data-filter="location"]').forEach(btn => {
    const v = btn.dataset.value;
    setChipPressed(btn, v === "All" ? activeLocations.size === 0 : activeLocations.has(v));
  });
}

/* ---------------------------
   COUNTS (category + school + location)
---------------------------- */
function updateCounts(posts) {
  const total = posts.length;

  // Category counts
  const catCounts = new Map();
  for (const p of posts) {
    const c = (p.category || "General").trim() || "General";
    catCounts.set(c, (catCounts.get(c) || 0) + 1);
  }
  const allCat = categoryFilters.querySelector('[data-count="All"]');
  if (allCat) allCat.textContent = `(${total})`;
  categoryFilters.querySelectorAll("[data-count]").forEach(span => {
    const key = span.dataset.count;
    if (key === "All") return;
    span.textContent = `(${catCounts.get(key) || 0})`;
  });

  // School counts
  const schoolCounts = new Map();
  for (const p of posts) {
    const s = normalizeSchool(p.school);
    schoolCounts.set(s, (schoolCounts.get(s) || 0) + 1);
  }
  const allSchool = schoolFilters.querySelector('[data-scount="All"]');
  if (allSchool) allSchool.textContent = `(${total})`;
  schoolFilters.querySelectorAll("[data-scount]").forEach(span => {
    const key = span.dataset.scount;
    if (key === "All") return;
    span.textContent = `(${schoolCounts.get(key) || 0})`;
  });

  // Location counts
  const locCounts = new Map();
  for (const p of posts) {
    const l = normalizeLocation(p.location);
    locCounts.set(l, (locCounts.get(l) || 0) + 1);
  }
  const allLoc = locationFilters.querySelector('[data-lcount="All"]');
  if (allLoc) allLoc.textContent = `(${total})`;
  locationFilters.querySelectorAll("[data-lcount]").forEach(span => {
    const key = span.dataset.lcount;
    if (key === "All") return;
    span.textContent = `(${locCounts.get(key) || 0})`;
  });
}

/* ---------------------------
   RENDER
---------------------------- */
function render(posts, query = "") {
  const q = query.trim().toLowerCase();

  const filtered = posts.filter(p => {
    const category = (p.category || "General").trim() || "General";
    const location = normalizeLocation(p.location);
    const school = normalizeSchool(p.school);

    const matchesSearch =
      !q ||
      [
        p.title,
        p.caption,
        p.name,
        category,
        school,
        location,
        ...(p.hashtags || []),
        ...(p.comments || []).map(c => c.text)
      ].join(" ").toLowerCase().includes(q);

    const matchesCategory = activeCategories.size === 0 || activeCategories.has(category);
    const matchesLocation = activeLocations.size === 0 || activeLocations.has(location);
    const matchesSchool = activeSchools.size === 0 || activeSchools.has(school);

    return matchesSearch && matchesCategory && matchesLocation && matchesSchool;
  });

  postsEl.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  for (const p of filtered) {
    const postEl = document.createElement("article");
    postEl.className = "post";

    const category = (p.category || "General").trim() || "General";
    const location = normalizeLocation(p.location);
    const school = normalizeSchool(p.school);

    const tagsHtml = (p.hashtags || [])
      .map(t => `<span class="tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`)
      .join("");

    const imgHtml = p.imageDataUrl
      ? `<img src="${p.imageDataUrl}" alt="Post image" data-img="post" data-id="${p.id}" />`
      : `<div class="noimg">No image</div>`;

    const categoryBadge = `<span class="badge category">${escapeHtml(category)}</span>`;
    const schoolBadge = `<span class="badge school">🏫 ${escapeHtml(school)}</span>`;
    const locationBadge = `<span class="badge location">📍 ${escapeHtml(location)}</span>`;

    const authorText = p.anonymous
      ? `Posted anonymously`
      : (p.name ? `Posted by <b>${escapeHtml(p.name)}</b>` : `Posted`);

    const comments = p.comments || [];
    const commentsHtml = comments.length
      ? comments.map(c => `
          <div class="comment">
            ${escapeHtml(c.text)}
            <div class="comment-meta">Anonymous · ${escapeHtml(formatDate(c.time))}</div>
          </div>
        `).join("")
      : `<div class="hint">No comments yet.</div>`;

    postEl.innerHTML = `
      <div class="thumb">${imgHtml}</div>

      <div class="post-content">
        <h3>${escapeHtml(p.mood || "😐")} ${escapeHtml(p.title)}</h3>

        <div class="meta">
          ${authorText} · ${escapeHtml(formatDate(p.createdAt))}
        </div>

        <div class="badges">
          ${categoryBadge}
          ${schoolBadge}
          ${locationBadge}
        </div>

        <p class="caption">${escapeHtml(p.caption)}</p>

        <div class="tags">${tagsHtml}</div>

        <div class="post-actions">
          <button class="small-btn likes-btn" data-action="like" data-id="${p.id}">
            ❤️ <span>${p.likes || 0}</span>
          </button>
          <button class="small-btn" data-action="copy" data-id="${p.id}">Copy hashtags</button>
          <button class="small-btn" data-action="delete" data-id="${p.id}">Delete</button>
        </div>

        <div class="comments">
          <h4>Comments</h4>
          <div class="comment-list">${commentsHtml}</div>

          <div class="comment-form">
            <input class="comment-input" maxlength="120"
              placeholder="Write a comment (max 120 chars)..."
              data-id="${p.id}"
            />
            <button class="small-btn" data-action="submit-comment" data-id="${p.id}">Send</button>
          </div>

          <div class="hint">Comments are anonymous in this demo.</div>
        </div>
      </div>
    `;

    postsEl.appendChild(postEl);
  }
}

/* ---------------------------
   FORM RESET + PREVIEW
---------------------------- */
function resetForm() {
  form.reset();
  preview.innerHTML = `<span class="hint">Image preview will appear here</span>`;
  anonymousEl.checked = false;
  categoryEl.value = "General";
  schoolEl.value = "";
  locationEl.value = "";
}

imageEl.addEventListener("change", () => {
  const file = imageEl.files && imageEl.files[0];

  if (!file) {
    preview.innerHTML = `<span class="hint">Image preview will appear here</span>`;
    return;
  }

  if (!file.type.startsWith("image/")) {
    preview.innerHTML = `<span class="hint">Please select an image file</span>`;
    imageEl.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    preview.innerHTML = `<img src="${reader.result}" alt="Preview" />`;
  };
  reader.readAsDataURL(file);
});

/* ---------------------------
   CREATE POST
---------------------------- */
form.addEventListener("submit", async e => {
  e.preventDefault();

  const title = titleEl.value.trim();
  const caption = captionEl.value.trim();
  const name = nameEl.value.trim();
  const hashtags = parseHashtags(hashtagsEl.value);

  const category = (categoryEl.value || "General").trim() || "General";
  const mood = moodEl.value;
  const school = (schoolEl.value || "").trim(); // optional
  const location = (locationEl.value || "").trim(); // optional
  const anonymous = anonymousEl.checked;

  if (!title || !caption) return;

  const file = imageEl.files && imageEl.files[0];
  let imageDataUrl = "";

  if (file && file.type.startsWith("image/")) {
    imageDataUrl = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  const posts = loadPosts();

  posts.unshift({
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
    name: anonymous ? "" : name,
    anonymous,
    title,
    caption,
    hashtags,
    category,
    mood,
    school,
    location,
    imageDataUrl,
    likes: 0,
    comments: [],
    createdAt: Date.now()
  });

  savePosts(posts);
  updateCounts(posts);
  resetForm();
  render(posts, searchEl.value);
});

/* ---------------------------
   SEARCH + CLEAR SEARCH
---------------------------- */
searchEl.addEventListener("input", () => {
  render(loadPosts(), searchEl.value);
});

clearSearchBtn.addEventListener("click", () => {
  searchEl.value = "";
  render(loadPosts(), "");
});

/* ---------------------------
   MULTI-SELECT FILTER HANDLERS
---------------------------- */
function handleChipClick(setRef, value) {
  if (value === "All") setRef.clear();
  else setRef.has(value) ? setRef.delete(value) : setRef.add(value);

  syncFilterUI();
  saveFilters();
  render(loadPosts(), searchEl.value);
}

categoryFilters.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-chip");
  if (!btn || btn.dataset.filter !== "category") return;
  handleChipClick(activeCategories, btn.dataset.value);
});

schoolFilters.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-chip");
  if (!btn || btn.dataset.filter !== "school") return;
  handleChipClick(activeSchools, btn.dataset.value);
});

locationFilters.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-chip");
  if (!btn || btn.dataset.filter !== "location") return;
  handleChipClick(activeLocations, btn.dataset.value);
});

resetCategoryFiltersBtn.addEventListener("click", () => {
  activeCategories.clear();
  syncFilterUI();
  saveFilters();
  render(loadPosts(), searchEl.value);
});

resetSchoolFiltersBtn.addEventListener("click", () => {
  activeSchools.clear();
  syncFilterUI();
  saveFilters();
  render(loadPosts(), searchEl.value);
});

resetLocationFiltersBtn.addEventListener("click", () => {
  activeLocations.clear();
  syncFilterUI();
  saveFilters();
  render(loadPosts(), searchEl.value);
});

/* ---------------------------
   FEED INTERACTIONS
---------------------------- */
postsEl.addEventListener("click", async e => {
  // hashtag click
  const tagEl = e.target.closest(".tag");
  if (tagEl && tagEl.dataset.tag) {
    const tag = tagEl.dataset.tag;
    searchEl.value = tag;
    render(loadPosts(), tag);
    return;
  }

  // image lightbox
  const img = e.target.closest('img[data-img="post"]');
  if (img) {
    lightboxImg.src = img.src;
    lightbox.classList.remove("hidden");
    lightbox.setAttribute("aria-hidden", "false");
    return;
  }

  // buttons
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;

  const posts = loadPosts();
  const { idx, post } = getPostById(posts, id);
  if (!post) return;

  if (action === "delete") {
    posts.splice(idx, 1);
    savePosts(posts);
    updateCounts(posts);
    render(posts, searchEl.value);
    return;
  }

  if (action === "like") {
    post.likes = (post.likes || 0) + 1;
    savePosts(posts);
    updateCounts(posts);
    render(posts, searchEl.value);
    return;
  }

  if (action === "copy") {
    const tags = (post.hashtags || []).join(" ");
    try {
      await navigator.clipboard.writeText(tags);
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = "Copy hashtags"), 900);
    } catch {
      alert("Clipboard blocked. Copy manually:\n\n" + tags);
    }
    return;
  }

  if (action === "submit-comment") {
    const input = postsEl.querySelector(`input.comment-input[data-id="${id}"]`);
    if (!input) return;

    const text = (input.value || "").trim();
    if (!text) return;

    post.comments = post.comments || [];
    post.comments.push({ text, time: Date.now() });

    savePosts(posts);
    render(posts, searchEl.value);
    return;
  }
});

// enter to comment
postsEl.addEventListener("keydown", e => {
  const input = e.target.closest("input.comment-input");
  if (!input) return;
  if (e.key !== "Enter") return;

  e.preventDefault();
  const id = input.dataset.id;

  const posts = loadPosts();
  const { post } = getPostById(posts, id);
  if (!post) return;

  const text = (input.value || "").trim();
  if (!text) return;

  post.comments = post.comments || [];
  post.comments.push({ text, time: Date.now() });

  savePosts(posts);
  render(posts, searchEl.value);
});

/* ---------------------------
   LIGHTBOX CLOSE
---------------------------- */
function closeLightbox() {
  lightbox.classList.add("hidden");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxImg.src = "";
}

lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});
lightboxClose.addEventListener("click", closeLightbox);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !lightbox.classList.contains("hidden")) closeLightbox();
});

/* ---------------------------
   CLEAR BUTTONS
---------------------------- */
clearBtn.addEventListener("click", resetForm);

clearAllBtn.addEventListener("click", () => {
  if (!confirm("Delete all posts?")) return;
  localStorage.removeItem(STORAGE_KEY_POSTS);
  updateCounts([]);
  render([], searchEl.value);
});

/* ---------------------------
   INITIAL LOAD
---------------------------- */
(function init() {
  loadFilters();
  syncFilterUI();

  const posts = loadPosts();
  updateCounts(posts);
  render(posts, searchEl.value);
})();
