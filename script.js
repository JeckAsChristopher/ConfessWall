'use strict';

if (sessionStorage.getItem("captchaPassed") !== "true") {
  alert("Unauthorized access. Please complete CAPTCHA first.");
  window.location.href = "index.html"; // Change this to your CAPTCHA page
}

const servers = [
  'https://confessserver.onrender.com',
  'https://confessserver-production.up.railway.app'
];

const memoryStorage = {
  likeCooldowns: {}
};

let sessionSafeMode = false;

// 🚀 Smart fetch with fallback
async function smartFetch(endpoint, options = {}) {
  for (let base of servers) {
    try {
      const res = await fetch(`${base}${endpoint}`, options);
      if (!res.ok) throw new Error('Bad response');
      return await res.json();
    } catch (err) {
      console.warn(`Failed to fetch from ${base}${endpoint}:`, err.message);
    }
  }
  throw new Error("All servers are unreachable.");
}

// ✅ Cooldown Helpers
function getCooldowns() {
  return sessionSafeMode
    ? memoryStorage.likeCooldowns
    : JSON.parse(localStorage.getItem('likeCooldowns') || '{}');
}

function setCooldowns(data) {
  if (sessionSafeMode) {
    memoryStorage.likeCooldowns = data;
  } else {
    localStorage.setItem('likeCooldowns', JSON.stringify(data));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('confessForm');
  const text = document.getElementById('confessText');
  const list = document.getElementById('confessionList');
  const fileInput = document.getElementById('photoUpload');
  const charCount = document.getElementById('charCount');
  const previewContainer = document.getElementById('previewContainer');
  const previewImage = document.getElementById('previewImage');
  const removePhotoBtn = document.getElementById('removePhoto');
  const submitBtn = document.getElementById('submitBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const darkToggleBtn = document.getElementById('darkModeToggle');
  const safeToggleBtn = document.getElementById('safeModeToggle');

  function escapeHTML(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const content = text.value.trim();
    const photo = fileInput.files[0];

    if (!content || content.length > 500) {
      alert("Confession must be between 1 and 500 characters.");
      return;
    }

    const formData = new FormData();
    formData.append('message', content);
    if (photo) formData.append('photo', photo);

    try {
      const data = await smartFetch('/confess', {
        method: 'POST',
        body: formData
      });

      if (data.success) {
        text.value = '';
        fileInput.value = '';
        previewImage.src = '';
        previewContainer.style.display = 'none';
        charCount.textContent = `0/500`;
        checkInput();
        await loadConfessions();
      } else {
        alert(data.error || 'Failed to post confession.');
      }
    } catch (err) {
      console.error('Error posting confession:', err);
      alert('Network error. Please try again later.');
    }
  });

  async function loadConfessions() {
    try {
      const confessions = await smartFetch('/confessions');
      list.innerHTML = confessions.map(c => `
        <div class="confession" data-id="${c.id}">
          <p>${escapeHTML(c.message)}</p>
          ${c.photo ? `<img src="${escapeHTML(c.photo)}" alt="Confession Photo" class="confess-img protect-img2" oncontextmenu="return false" ondragstart="return false">` : ''}
          <div class="confession-footer">
            <button class="heart-btn ${isLiked(c.id) ? 'liked' : ''}" title="React ❤️">
              <svg viewBox="0 0 24 24" class="heart-icon" xmlns="http://www.w3.org/2000/svg">
                <path class="heart-path" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 
                2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 
                4.5 2.09C13.09 3.81 14.76 3 16.5 3
                19.58 3 22 5.42 22 8.5
                c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor"/>
              </svg>
              <span class="like-count">${c.likes || 0}</span>
            </button>
            <div class="time">${escapeHTML(c.time)}</div>
          </div>
        </div>
      `).join('');
      setupHeartButtons();
    } catch (err) {
      console.error('❌ All servers failed. Reloading in 5 seconds...');
      list.innerHTML = `<p style="color:red;">Servers unreachable. Reloading...</p>`;
      setTimeout(() => location.reload(), 5000);
    }
  }

  async function likeConfession(id, btn, countSpan) {
    try {
      const data = await smartFetch(`/confess/${id}/like`, {
        method: 'POST'
      });
      if (data.success) {
        countSpan.textContent = data.likes;
        const cooldowns = getCooldowns();
        cooldowns[id] = new Date().toISOString();
        setCooldowns(cooldowns);
        btn.classList.add('liked');
        btn.disabled = true;
      }
    } catch (err) {
      console.error('Like failed:', err);
    }
  }

  function setupHeartButtons() {
    const heartButtons = document.querySelectorAll('.heart-btn');
    const cooldowns = getCooldowns();

    heartButtons.forEach(btn => {
      const confession = btn.closest('.confession');
      const id = confession.getAttribute('data-id');
      const countSpan = btn.querySelector('.like-count');

      const updateCooldown = () => {
        const now = Date.now();
        const last = new Date(cooldowns[id] || 0).getTime();
        const diff = 24 * 60 * 60 * 1000 - (now - last);

        if (diff > 0) {
          const hrs = Math.floor(diff / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const secs = Math.floor((diff % (1000 * 60)) / 1000);
          btn.title = `You can like again in ${hrs}h ${mins}m ${secs}s`;
          btn.classList.add('cooldown');
          btn.disabled = true;
          btn.classList.add('liked');
        } else {
          btn.title = 'React ❤️';
          btn.classList.remove('cooldown');
          btn.disabled = false;
          btn.classList.remove('liked');
          delete cooldowns[id];
          setCooldowns(cooldowns);
        }
      };

      if (cooldowns[id]) {
        updateCooldown();
        const interval = setInterval(() => {
          if (!cooldowns[id]) return clearInterval(interval);
          updateCooldown();
        }, 1000);
      }

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const now = Date.now();
        const last = cooldowns[id] ? new Date(cooldowns[id]) : null;
        if (last && (now - last) < 24 * 60 * 60 * 1000) {
          alert("You've already liked this. Try again in 24 hours.");
          return;
        }
        likeConfession(id, btn, countSpan);
      });
    });
  }

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        previewImage.src = reader.result;
        previewContainer.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
    checkInput();
  });

  removePhotoBtn?.addEventListener('click', () => {
    fileInput.value = '';
    previewImage.src = '';
    previewContainer.style.display = 'none';
    checkInput();
  });

  text?.addEventListener('input', () => {
    charCount.textContent = `${text.value.length}/500`;
    checkInput();
  });

  function isLiked(id) {
    const cooldowns = getCooldowns();
    if (!cooldowns[id]) return false;
    const last = new Date(cooldowns[id]);
    return (Date.now() - last.getTime()) < 24 * 60 * 60 * 1000;
  }

  settingsBtn?.addEventListener('click', () => {
    settingsPanel?.classList.toggle('active');
  });

  darkToggleBtn?.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    darkToggleBtn.textContent = `Dark Mode: ${isDark ? 'ON' : 'OFF'}`;
    if (!sessionSafeMode) {
      localStorage.setItem('darkMode', isDark ? 'on' : 'off');
    }
  });

  safeToggleBtn?.addEventListener('click', () => {
  if (!sessionSafeMode) {
    // Switching ON: move cooldowns from localStorage to memory
    const stored = localStorage.getItem('likeCooldowns');
    if (stored) memoryStorage.likeCooldowns = JSON.parse(stored);
  } else {
    // Switching OFF: move cooldowns from memory back to localStorage
    localStorage.setItem('likeCooldowns', JSON.stringify(memoryStorage.likeCooldowns));
  }

  sessionSafeMode = !sessionSafeMode;
  safeToggleBtn.textContent = `Safe Mode: ${sessionSafeMode ? 'ON' : 'OFF'}`;
});

  (function loadDarkPreference() {
    if (!sessionSafeMode) {
      const darkPref = localStorage.getItem('darkMode');
      if (darkPref === 'on') {
        document.body.classList.add('dark');
        darkToggleBtn.textContent = `Dark Mode: ON`;
      }
    }
  })();

  function checkInput() {
    const hasText = text.value.trim().length > 0;
    const hasPhoto = fileInput.files.length > 0;
    submitBtn.disabled = !(hasText || hasPhoto);
  }
  
(() => {
  // Preserve native functions
  const nativeAlert = window.alert.bind(window);
  const nativeConsole = { ...console };
  const nativeEval = window.eval;
  const nativeFunction = window.Function;

  // Block console access visually and silently
  const msg = "🚫 Console is disabled.";
  ['log', 'warn', 'error', 'info', 'debug', 'trace'].forEach(method => {
    console[method] = function () {
      const div = document.createElement('div');
      div.textContent = msg;
      div.style = "color: red; background: black; padding: 8px; font-weight: bold;";
      document.body.appendChild(div);
    };
  });

  // Hard block eval and Function constructor
  window.eval = function () {
    nativeAlert("🚨 eval is blocked.");
    throw new Error("eval is disabled.");
  };

  window.Function = function () {
    nativeAlert("🚨 Function constructor is blocked.");
    throw new Error("Function is disabled.");
  };

  // Optional: alert on prompt/confirm
  window.prompt = () => {
    nativeAlert("🚨 prompt is blocked.");
    return null;
  };
  window.confirm = () => {
    nativeAlert("🚨 confirm is blocked.");
    return false;
  };

  // Prevent script injections
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.tagName === 'SCRIPT') {
          nativeAlert("🚨 External script blocked.");
          node.remove();
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Detect console tampering
  setInterval(() => {
    if (console.log.toString().includes('[native code]')) {
      nativeAlert("🚨 Console tampering detected. Reloading...");
      location.reload();
    }
  }, 5000);
})();

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('confessForm');
  const submitBtn = document.getElementById('submitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent form from submitting by default

    const turnstileToken = document.querySelector('input[name="cf-turnstile-response"]')?.value;

    if (!turnstileToken) {
      alert("⚠️ Please complete the CAPTCHA before submitting.");
      return;
    }

    // If token exists, you can continue submitting or show success
    // Since you're on GitHub Pages (no server), we just show a success message
    alert("✅ Confession submitted successfully!\n(CAPTCHA token: " + turnstileToken + ")");

    // Clear form or reset logic
    form.reset();
    document.getElementById('charCount').textContent = "0/500";
    document.getElementById('previewContainer').style.display = 'none';
  });

  // Character counter logic
  const textArea = document.getElementById('confessText');
  const charCount = document.getElementById('charCount');
  textArea.addEventListener('input', () => {
    charCount.textContent = `${textArea.value.length}/500`;
  });
});

  checkInput();
  loadConfessions();
});