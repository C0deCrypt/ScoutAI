/* ═══════════════════════════════════════════════════
   ResumeIQ — main.js
   Handles: file upload, drag-drop, async fetch,
            DOM updates, audio player, toast alerts
   ═══════════════════════════════════════════════════ */

/* ── DOM REFS ────────────────────────────────────── */
const dropzone       = document.getElementById('dropzone');
const fileInput      = document.getElementById('file-input');
const browseBtn      = document.getElementById('browse-btn');
const fileChosen     = document.getElementById('file-chosen');
const fileNameDisplay= document.getElementById('file-name-display');
const fileRemove     = document.getElementById('file-remove');
const jobDescription = document.getElementById('job-description');
const charCount      = document.getElementById('char-count');
const analyzeBtn     = document.getElementById('analyze-btn');
const btnText        = analyzeBtn.querySelector('.btn-text');
const btnLoader      = document.getElementById('btn-loader');
const scanOverlay    = document.getElementById('scan-overlay');
const scanStatus     = document.getElementById('scan-status');
const scanFill       = document.getElementById('scan-fill');
const toastContainer = document.getElementById('toast-container');
const resultsSection = document.getElementById('results-section');
const resetBtn       = document.getElementById('reset-btn');

/* ── STATE ───────────────────────────────────────── */
let selectedFile = null;

/* ── FILE HANDLING ───────────────────────────────── */
browseBtn.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('click', (e) => { if (e.target === dropzone) fileInput.click(); });

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});

function setFile(file) {
  const allowed = ['application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|docx)$/i)) {
    showToast('Only PDF or DOCX files are accepted.', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('File exceeds 10 MB limit.', 'error');
    return;
  }
  selectedFile = file;
  fileNameDisplay.textContent = file.name;
  fileChosen.classList.remove('hidden');
  checkReady();
}

fileRemove.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  fileChosen.classList.add('hidden');
  checkReady();
});

/* ── JD CHAR COUNT ───────────────────────────────── */
jobDescription.addEventListener('input', () => {
  const len = jobDescription.value.length;
  charCount.textContent = `${len.toLocaleString()} character${len !== 1 ? 's' : ''}`;
  checkReady();
});

/* ── ENABLE ANALYZE ──────────────────────────────── */
function checkReady() {
  const hasFile = !!selectedFile;
  const hasJD   = jobDescription.value.trim().length > 30;
  analyzeBtn.disabled = !(hasFile && hasJD);
}

/* ── ANALYZE FLOW ────────────────────────────────── */
analyzeBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  // Show loading state
  showLoading();

  const formData = new FormData();
  formData.append('resume', selectedFile);
  formData.append('job_description', jobDescription.value.trim());

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Analysis failed. Please try again.');
    }

    hideLoading();
    renderResults(data);

  } catch (err) {
    hideLoading();
    showToast(err.message || 'Something went wrong. Please try again.', 'error');
  }
});

/* ── LOADING ─────────────────────────────────────── */
const scanMessages = [
  'Parsing document…',
  'Reading your experience…',
  'Matching skills to job…',
  'Consulting Gemini AI…',
  'Building your report…'
];

let scanTimer = null;
let scanStep  = 0;

function showLoading() {
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');
  analyzeBtn.disabled = true;
  scanOverlay.classList.remove('hidden');
  scanStep = 0;
  scanFill.style.width = '0%';
  runScanProgress();
}

function runScanProgress() {
  const steps = scanMessages.length;
  scanTimer = setInterval(() => {
    if (scanStep >= steps) { clearInterval(scanTimer); return; }
    scanStatus.textContent = scanMessages[scanStep];
    scanFill.style.width = `${((scanStep + 1) / steps) * 90}%`;
    scanStep++;
  }, 900);
}

function hideLoading() {
  clearInterval(scanTimer);
  scanFill.style.width = '100%';
  setTimeout(() => {
    scanOverlay.classList.add('hidden');
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
    analyzeBtn.disabled = false;
  }, 400);
}

/* ── RENDER RESULTS ──────────────────────────────── */
function renderResults(data) {
  // Scroll to results
  resultsSection.classList.remove('hidden');
  setTimeout(() => resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  // ATS Score donut
  const ats = Math.min(100, Math.max(0, data.ats_score || 0));
  animateDonut(ats);
  document.getElementById('ats-score').textContent = ats;
  document.getElementById('ats-verdict').textContent = atsVerdict(ats);

  // Match %
  const match = data.match_percentage || 0;
  setTimeout(() => {
    document.getElementById('match-pct').textContent = `${match}%`;
    document.getElementById('match-bar-fill').style.width = `${match}%`;
  }, 300);

  // Skill counts
  const missing = data.missing_skills || [];
  const matched = data.matched_skills || [];
  document.getElementById('missing-count').textContent = missing.length;
  document.getElementById('question-count').textContent = (data.interview_questions || []).length;

  // Missing skills
  renderChips('skills-wrap', missing);

  // Matched skills
  renderChips('matched-wrap', matched);

  // Suggestions
  renderSuggestions(data.suggestions || []);

  // Interview questions
  renderQuestions(data.interview_questions || []);

  // Audio
  if (data.audio_base64) {
    setupAudio(data.audio_base64);
  }

  showToast('Analysis complete!', 'success');
}

function atsVerdict(score) {
  if (score >= 80) return 'Excellent — highly likely to pass ATS filters';
  if (score >= 60) return 'Good — some improvements recommended';
  if (score >= 40) return 'Fair — significant gaps detected';
  return 'Poor — major rework needed';
}

/* DONUT ANIMATION */
function animateDonut(score) {
  const circle = document.getElementById('ats-circle');
  const circumference = 314; // 2 * pi * 50
  const offset = circumference - (score / 100) * circumference;
  setTimeout(() => {
    circle.style.strokeDashoffset = offset;
    // Color by score
    if (score >= 80)      circle.style.stroke = '#3ecf8e';
    else if (score >= 60) circle.style.stroke = '#f5a623';
    else                  circle.style.stroke = '#f56565';
  }, 200);
}

/* SKILL CHIPS */
function renderChips(containerId, skills) {
  const wrap = document.getElementById(containerId);
  wrap.innerHTML = '';
  if (!skills.length) {
    wrap.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">None identified</p>';
    return;
  }
  skills.forEach((skill, i) => {
    const chip = document.createElement('span');
    chip.className = 'skill-chip';
    chip.style.animationDelay = `${i * 50}ms`;
    chip.textContent = skill;
    wrap.appendChild(chip);
  });
}

/* SUGGESTIONS */
function renderSuggestions(suggestions) {
  const list = document.getElementById('suggestions-list');
  list.innerHTML = '';
  if (!suggestions.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">No suggestions — great resume!</p>';
    return;
  }
  suggestions.forEach((text, i) => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.style.animationDelay = `${i * 80}ms`;
    item.innerHTML = `
      <span class="suggestion-num">${i + 1}</span>
      <span>${text}</span>
    `;
    list.appendChild(item);
  });
}

/* INTERVIEW QUESTIONS */
function renderQuestions(questions) {
  const list = document.getElementById('questions-list');
  list.innerHTML = '';
  if (!questions.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">No questions generated.</p>';
    return;
  }
  questions.forEach((q, i) => {
    const item = document.createElement('div');
    item.className = 'question-item';
    item.style.animationDelay = `${i * 60}ms`;
    item.innerHTML = `<span class="question-num">Question ${i + 1}</span><br/>${q}`;
    list.appendChild(item);
  });
}

/* ── AUDIO PLAYER ────────────────────────────────── */
function setupAudio(base64Audio) {
  const audioEl = document.getElementById('audio-element');
  audioEl.src = `data:audio/mp3;base64,${base64Audio}`;

  buildWaveform();

  const playBtn   = document.getElementById('audio-play-btn');
  const playIcon  = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');
  const fillEl    = document.getElementById('audio-progress-fill');
  const currentEl = document.getElementById('audio-current');
  const totalEl   = document.getElementById('audio-total');
  const progressBar = document.querySelector('.audio-progress-bar');

  audioEl.addEventListener('loadedmetadata', () => {
    totalEl.textContent = formatTime(audioEl.duration);
  });

  audioEl.addEventListener('timeupdate', () => {
    if (audioEl.duration) {
      const pct = (audioEl.currentTime / audioEl.duration) * 100;
      fillEl.style.width = `${pct}%`;
      currentEl.textContent = formatTime(audioEl.currentTime);
      animateWaveBars(pct > 0 && !audioEl.paused);
    }
  });

  audioEl.addEventListener('ended', () => {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    animateWaveBars(false);
  });

  playBtn.addEventListener('click', () => {
    if (audioEl.paused) {
      audioEl.play();
      playIcon.classList.add('hidden');
      pauseIcon.classList.remove('hidden');
      animateWaveBars(true);
    } else {
      audioEl.pause();
      playIcon.classList.remove('hidden');
      pauseIcon.classList.add('hidden');
      animateWaveBars(false);
    }
  });

  progressBar.addEventListener('click', (e) => {
    const rect = progressBar.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    audioEl.currentTime = pct * audioEl.duration;
  });
}

function buildWaveform() {
  const waveform = document.getElementById('audio-waveform');
  waveform.innerHTML = '';
  const heights = [6,10,14,20,26,30,28,22,16,10,14,20,26,22,16,12,18,24,20,14,10,16,22,18,12];
  heights.forEach((h, i) => {
    const bar = document.createElement('div');
    bar.className = 'wave-bar';
    bar.style.height = `${h}px`;
    bar.style.animationDelay = `${i * 60}ms`;
    bar.style.animationDuration = `${0.9 + Math.random() * 0.6}s`;
    waveform.appendChild(bar);
  });
}

function animateWaveBars(active) {
  document.querySelectorAll('.wave-bar').forEach(b => {
    b.classList.toggle('active', active);
  });
}

function formatTime(sec) {
  if (isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/* ── TOAST ───────────────────────────────────────── */
function showToast(message, type = 'info') {
  const icons = { error: '⚠', success: '✓', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ── RESET ───────────────────────────────────────── */
resetBtn.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  jobDescription.value = '';
  charCount.textContent = '0 characters';
  fileChosen.classList.add('hidden');
  resultsSection.classList.add('hidden');
  analyzeBtn.disabled = true;

  // Stop audio
  const audioEl = document.getElementById('audio-element');
  audioEl.pause();
  audioEl.src = '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
});