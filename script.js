'use strict';

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

  let sessionSafeMode = false;

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
      const res = await fetch('https://resource-davidson-occasion-pcs.trycloudflare.com/confess', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (res.ok && data.success) {
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
      const res = await fetch('https://resource-davidson-occasion-pcs.trycloudflare.com/confessions');
      const confessions = await res.json();

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
      console.error('Error loading confessions:', err);
      list.innerHTML = `<p style="color:red;">Failed to load confessions. Please refresh.</p>`;
    }
  }

  function setupHeartButtons() {
    const heartButtons = document.querySelectorAll('.heart-btn');
    const likeCooldowns = JSON.parse(localStorage.getItem('likeCooldowns') || '{}');

    heartButtons.forEach(btn => {
      const confession = btn.closest('.confession');
      const id = confession.getAttribute('data-id');
      const countSpan = btn.querySelector('.like-count');

      const updateCooldown = () => {
        const now = Date.now();
        const last = new Date(likeCooldowns[id] || 0).getTime();
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
          delete likeCooldowns[id];
          localStorage.setItem('likeCooldowns', JSON.stringify(likeCooldowns));
        }
      };

      if (likeCooldowns[id]) {
        updateCooldown();
        const interval = setInterval(() => {
          if (!likeCooldowns[id]) return clearInterval(interval);
          updateCooldown();
        }, 1000);
      }

      btn.addEventListener('click', async () => {
        const now = Date.now();
        const last = likeCooldowns[id] ? new Date(likeCooldowns[id]) : null;

        if (last && (now - last) < 24 * 60 * 60 * 1000) {
          alert("You've already liked this. Try again in 24 hours.");
          return;
        }

        try {
          const res = await fetch(`https://resource-davidson-occasion-pcs.trycloudflare.com/confess/${id}/like`, {
            method: 'POST'
          });
          const data = await res.json();

          if (data.success) {
            countSpan.textContent = data.likes;
            likeCooldowns[id] = new Date().toISOString();
            localStorage.setItem('likeCooldowns', JSON.stringify(likeCooldowns));
            btn.classList.add('liked');
            btn.disabled = true;
            updateCooldown();
          }
        } catch (err) {
          console.error('Like failed:', err);
        }
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
    const cooldowns = JSON.parse(localStorage.getItem('likeCooldowns') || '{}');
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
    sessionSafeMode = !sessionSafeMode;
    safeToggleBtn.textContent = `Safe Mode: ${sessionSafeMode ? 'ON' : 'OFF'}`;
    if (sessionSafeMode) localStorage.clear();
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

  checkInput();
  loadConfessions();
});