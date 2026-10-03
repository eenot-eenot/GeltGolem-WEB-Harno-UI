// ─── STATE ────────────────────────────────────────────────────────────────────
let xp = 0;
let hearts = 3;
let currentModuleIdx = 0;
let currentLessonIdx = 0;
let currentQIdx = 0;
let selectedOption = null;
let shuffledQuestions = [];
// lessonCompleted[moduleIdx][lessonIdx]
let lessonCompleted = [
    [false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false]
];
// trophyTestDone[moduleIdx]
let trophyTestDone = [false, false, false, false, false];
let lessonErrors = 0;
let answered = false;
let errorQuestions = []; // questions answered wrongly, shown at end
let isReviewMode = false; // true when replaying error questions
let reviewRound = 0; // how many review rounds have happened

// perfectLessons[moduleIdx][lessonIdx] = true if completed with 0 errors ever
let perfectLessons = [
    [false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false]
];
// perfectTests[moduleIdx] = true if trophy test done with 0 errors
let perfectTests = [false, false, false, false, false];

// ─── TROPHY TEST STATE ────────────────────────────────────────────────────────
let trophyQuestions = [];
let trophyQIdx = 0;
let trophyHearts = 3;
let trophyErrors = 0;
let trophyCorrect = 0;
let trophyAnswered = false;
let trophyTypedAnswer = '';

// ─── CHARACTER STATE ──────────────────────────────────────────────────────────
let charState = {
    body: 0, outfit: 0, mask: 0, bg: 0,
    tempBody: 0, tempOutfit: 0, tempMask: 0, tempBg: 0,
};

// ─── SAVE / LOAD ──────────────────────────────────────────────────────────────
const SAVE_KEY = 'geltcode_save_v1';

function saveState() {
    try {
        const data = {
            xp, hearts,
            lessonCompleted,
            trophyTestDone, trophyErrors,
            perfectLessons, perfectTests,
            charState: { body: charState.body, outfit: charState.outfit, mask: charState.mask, bg: charState.bg },
            unlockedSecrets: [...unlockedSecrets],
            profileData,
            emperorMode: _emperorMode,
            avatarPhoto: _avaImg ? (() => { try { const c = document.getElementById('ava-upload-canvas'); return c ? c.toDataURL('image/jpeg', 0.85) : null; } catch (e) { return null; } })() : null,
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        // Cloud save if user has a username
        if (profileData.username && window._fb) {
            window._fb.saveCloud(profileData.username, data);
        }
    } catch (e) { }
}

function loadState() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return;
        const d = JSON.parse(raw);
        if (d.xp !== undefined) xp = d.xp;
        if (d.hearts !== undefined) hearts = Math.min(d.hearts, 3);
        if (d.lessonCompleted) {
            // migrate old flat array to new nested
            if (Array.isArray(d.lessonCompleted) && !Array.isArray(d.lessonCompleted[0])) {
                lessonCompleted[0] = d.lessonCompleted;
            } else {
                lessonCompleted = d.lessonCompleted;
                // Migrate old 5-lesson arrays to 10 by padding with false
                for (let mi = 0; mi < lessonCompleted.length; mi++) {
                    while (lessonCompleted[mi].length < 10) lessonCompleted[mi].push(false);
                }
            }
        }
        if (d.trophyTestDone !== undefined) {
            if (typeof d.trophyTestDone === 'boolean') {
                trophyTestDone[0] = d.trophyTestDone;
            } else {
                trophyTestDone = d.trophyTestDone;
            }
        }
        if (d.trophyErrors !== undefined) trophyErrors = d.trophyErrors;
        if (d.perfectLessons) {
            perfectLessons = d.perfectLessons;
            for (let mi = 0; mi < perfectLessons.length; mi++) {
                while (perfectLessons[mi].length < 10) perfectLessons[mi].push(false);
            }
        }
        if (d.perfectTests) perfectTests = d.perfectTests;
        if (d.charState) {
            charState.body = d.charState.body || 0;
            charState.outfit = d.charState.outfit || 0;
            charState.mask = d.charState.mask || 0;
            charState.bg = d.charState.bg || 0;
        }
        if (d.unlockedSecrets) unlockedSecrets = new Set(d.unlockedSecrets);
        if (d.profileData) profileData = Object.assign(profileData, d.profileData);
        if (d.emperorMode) {
            _emperorMode = true;
            setTimeout(() => initAvaUpload(), 200);
        }
        // Re-register username in registry (in case of first load on new device)
        if (profileData.username) {
            try {
                const reg = JSON.parse(localStorage.getItem(USERNAME_REGISTRY_KEY) || '{}');
                const norm = profileData.username.toLowerCase().replace(/[^a-z0-9_.]/g, '');
                if (!reg[norm]) { reg[norm] = { saveId: SAVE_KEY, registeredAt: new Date().toISOString() }; localStorage.setItem(USERNAME_REGISTRY_KEY, JSON.stringify(reg)); }
            } catch (e) { }
        }
        // Restore saved photo if any (works for all users now)
        const photoData = d.avatarPhoto || d.emperorPhoto;
        if (photoData) {
            setTimeout(() => {
                const img = new Image();
                img.onload = function () {
                    _avaImg = img;
                    const canvas = document.getElementById('ava-upload-canvas');
                    if (canvas) { canvas.style.display = 'block'; drawAvaUpload(); }
                };
                img.src = photoData;
            }, 400);
        }
    } catch (e) { }
}


const CHAR_BODIES = [
    // idx 0 – Dragon Anonymous (default)
    { label: '🐲', colors: ['#1e6b10', '#0f3a06'], name: 'Дракон', special: 'dragon_anon' },
    // idx 1-5 – standard humans
    { label: '🧑', colors: ['#FDBCB4', '#c97b5a'], name: 'Светлый' },
    { label: '🧑🏻', colors: ['#F0C896', '#b07a3a'], name: 'Загорелый' },
    { label: '🧑🏿', colors: ['#8D5524', '#5c3010'], name: 'Тёмный' },
    { label: '🤖', colors: ['#4A41C0', '#2C2763'], name: 'Робот' },
    { label: '👽', colors: ['#1a6b2a', '#0a3015'], name: 'Инопланетянин' },
    { label: '💀', colors: ['#333', '#111'], name: 'Скелет' },
    // idx 7 – SECRET: Raccoon Dev (code: RACCOONDEV)
    { label: '🦝', colors: ['#555566', '#333344'], name: '???', special: 'raccoon_dev', secret: true },
    // idx 8 – SECRET: Emperor (code: EMPEROR77)
    { label: '⚔️', colors: ['#f2e4da', '#d4b8a8'], name: '???', special: 'emperor', secret: true },
];

// Secret character unlock codes
const SECRET_CODES = {
    'RACCOONDEV': 7,
    'EMPEROR77': 8,
};
let unlockedSecrets = new Set();

// ─── DEVELOPER ACCOUNTS (reserved usernames, cannot be claimed by others) ────
const DEV_ACCOUNTS = {
    'imperor': { displayName: 'Imperor', role: 'Основатель & Frontend', icon: '👑', color: '#ffc800', titleId: 'dev_blood', pwdHash: 'f7a3c2e1b4d6a8f0' /* EMPEROR77 secret */ },
    'eenot': { displayName: 'EEnot', role: 'Backend & Sandbox', icon: '⚙️', color: '#1CB0F6', titleId: 'dev_tech', pwdHash: 'a9c3d5e7b1f2a4c6' /* RACCOONDEV secret */ },
};
const USERNAME_REGISTRY_KEY = 'geltcode_usernames_v1';

// ─── PASSWORD SYSTEM ──────────────────────────────────────────────────────────
// Simple non-cryptographic hash (djb2 variant) — good enough for local storage
function hashPassword(pwd) {
    let h = 5381;
    for (let i = 0; i < pwd.length; i++) h = ((h << 5) + h) ^ pwd.charCodeAt(i);
    return (h >>> 0).toString(16).padStart(8, '0');
}

// Dev accounts have fixed passwords derived from their secret codes
const DEV_PASSWORD_HASHES = {
    'imperor': hashPassword('EMPEROR77'),
    'eenot': hashPassword('RACCOONDEV'),
};

let _pendingSetupUsername = '';
let _pendingSetupName = '';
let _pendingSetupBio = '';

function showPasswordLoginModal(username) {
    document.getElementById('pwd-modal-username').textContent = '@' + username;
    document.getElementById('pwd-modal-input').value = '';
    document.getElementById('pwd-modal-error').textContent = '';
    document.getElementById('password-login-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('pwd-modal-input').focus(), 150);
}

function closePasswordLoginModal() {
    document.getElementById('password-login-modal').style.display = 'none';
    _pendingSetupUsername = '';
}

function confirmPasswordLogin() {
    const pwd = document.getElementById('pwd-modal-input').value;
    const errEl = document.getElementById('pwd-modal-error');
    const username = _pendingSetupUsername;
    if (!pwd) { errEl.textContent = '❗ Введи пароль'; return; }

    const normalized = username.toLowerCase().replace(/[^a-z0-9_.]/g, '');
    const enteredHash = hashPassword(pwd);

    // Dev password check (local, no cloud needed)
    if (DEV_PASSWORD_HASHES[normalized] !== undefined) {
        if (enteredHash !== DEV_PASSWORD_HASHES[normalized]) {
            errEl.textContent = '❌ Неверный пароль';
            vibrateWrong();
            return;
        }
        closePasswordLoginModal();
        applyUsername(username, _pendingSetupName, _pendingSetupBio);
        if (isDevUsername(username)) applyDevAccount(username);
        return;
    }

    errEl.textContent = '⏳ Проверяем...';
    document.getElementById('pwd-modal-input').disabled = true;

    const checkAndLoad = async () => {
        // Check password via Firebase if available
        let pwdResult = 'error';
        if (window._fb) {
            pwdResult = await window._fb.checkPwd(username, enteredHash);
        } else {
            // Fallback: local registry
            try {
                const reg = JSON.parse(localStorage.getItem(USERNAME_REGISTRY_KEY) || '{}');
                const entry = reg[normalized];
                if (!entry) pwdResult = 'not_found';
                else if (!entry.pwdHash) pwdResult = 'ok'; // old account, no password
                else pwdResult = entry.pwdHash === enteredHash ? 'ok' : 'wrong';
            } catch (e) { pwdResult = 'error'; }
        }

        if (pwdResult === 'wrong') {
            errEl.textContent = '❌ Неверный пароль';
            document.getElementById('pwd-modal-input').disabled = false;
            vibrateWrong();
            return;
        }
        if (pwdResult === 'not_found') {
            errEl.textContent = '❌ Аккаунт не найден';
            document.getElementById('pwd-modal-input').disabled = false;
            return;
        }

        // Password OK — load cloud save
        errEl.textContent = '⏳ Загружаем прогресс...';
        let cloudData = null;
        if (window._fb) cloudData = await window._fb.loadCloud(username);

        closePasswordLoginModal();
        document.getElementById('pwd-modal-input').disabled = false;

        if (cloudData) {
            // Apply cloud save to local storage and reload
            localStorage.setItem(SAVE_KEY, JSON.stringify(cloudData));
            showToast('☁️ Прогресс загружен!', 2000);
            setTimeout(() => location.reload(), 1500);
        } else {
            // No cloud save — just apply username
            applyUsername(username, _pendingSetupName, _pendingSetupBio);
            showToast('✅ Вход выполнен!', 1800);
        }
    };

    checkAndLoad().catch(() => {
        errEl.textContent = '❌ Ошибка соединения';
        document.getElementById('pwd-modal-input').disabled = false;
    });
}

function applyUsername(username, name, bio) {
    profileData.name = name || profileData.name;
    profileData.username = username;
    profileData.bio = bio !== undefined ? bio : profileData.bio;
    // Update UI
    const editName = document.getElementById('edit-name');
    const editUser = document.getElementById('edit-username');
    const editBio = document.getElementById('edit-bio');
    if (editName) editName.value = profileData.name;
    if (editUser) editUser.value = username;
    if (editBio) editBio.value = profileData.bio;
    const dispName = document.getElementById('prof-disp-name');
    const dispUser = document.getElementById('prof-disp-user');
    if (dispName) dispName.textContent = profileData.name;
    if (dispUser) dispUser.textContent = '@' + username;
    renderDevBadgeIfNeeded();
    saveState();
    // Close setup screen if open
    const setupScreen = document.getElementById('profile-setup-screen');
    if (setupScreen && !setupScreen.classList.contains('hidden')) {
        setupScreen.classList.add('hidden');
        vibrateSuccess();
        setTimeout(() => checkAndShowStreak(), 400);
    } else {
        showToast('✅ Вход выполнен!', 1800);
    }
}

// Returns { taken: bool, isOwn: bool, isDev: bool }
function checkUsernameAvailability(username, currentSaveId) {
    const normalized = username.toLowerCase().replace(/[^a-z0-9_.]/g, '');
    if (DEV_ACCOUNTS.hasOwnProperty(normalized)) {
        // Dev username — only allow if current save has dev secret (secret codes still required to *register*)
        const isImperor = normalized === 'imperor' && unlockedSecrets.has(8);
        const isEEnot = normalized === 'eenot' && unlockedSecrets.has(7);
        if (isImperor || isEEnot) return { taken: false, isOwn: true, isDev: true };
        // Not owning secret — show password modal (can login via dev password)
        return { taken: true, isOwn: false, isDev: true };
    }
    try {
        const reg = JSON.parse(localStorage.getItem(USERNAME_REGISTRY_KEY) || '{}');
        const entry = reg[normalized];
        if (!entry) return { taken: false, isOwn: false, isDev: false };
        if (entry.saveId === currentSaveId) return { taken: false, isOwn: true, isDev: false };
        return { taken: true, isOwn: false, isDev: false, registeredAt: entry.registeredAt };
    } catch (e) {
        return { taken: false, isOwn: false, isDev: false };
    }
}

function registerUsername(username, saveId, pwdHash) {
    try {
        const normalized = username.toLowerCase().replace(/[^a-z0-9_.]/g, '');
        const reg = JSON.parse(localStorage.getItem(USERNAME_REGISTRY_KEY) || '{}');
        // Free previous username if changed
        Object.keys(reg).forEach(k => { if (reg[k].saveId === saveId && k !== normalized) delete reg[k]; });
        // Preserve existing password if not provided
        const existing = reg[normalized] || {};
        reg[normalized] = { saveId, registeredAt: existing.registeredAt || new Date().toISOString(), pwdHash: pwdHash || existing.pwdHash };
        localStorage.setItem(USERNAME_REGISTRY_KEY, JSON.stringify(reg));
    } catch (e) { }
}

function applyDevAccount(username) {
    const normalized = username.toLowerCase().replace(/[^a-z0-9_.]/g, '');
    const dev = DEV_ACCOUNTS[normalized];
    if (!dev) return;
    // Auto-equip dev title
    profileData.equippedTitleId = dev.titleId;
    updateEquippedTitle();
}

function isDevUsername(username) {
    return DEV_ACCOUNTS.hasOwnProperty(username.toLowerCase().replace(/[^a-z0-9_.]/g, ''));
}

// Outfits: full SVG torso drawn in buildCharSVG based on id
const CHAR_OUTFITS = [
    { id: 'tshirt_blue', name: 'Синяя футболка', c1: '#3a7bd5', c2: '#2a5ba5', c3: '#1e4a8a' },
    { id: 'tshirt_green', name: 'Зелёная футболка', c1: '#27ae60', c2: '#1e8a48', c3: '#145e30' },
    { id: 'hoodie', name: 'Худи', c1: '#555e6b', c2: '#3a434f', c3: '#252d38' },
    { id: 'robe', name: 'Мантия', c1: '#1a1a5a', c2: '#10103a', c3: '#0a0a28' },
    { id: 'armor', name: 'Броня', c1: '#8a9aaa', c2: '#6a7a8a', c3: '#4a5a6a' },
    { id: 'ninja', name: 'Костюм ниндзя', c1: '#1a1a1a', c2: '#111', c3: '#000' },
    { id: 'wizard', name: 'Мантия мага', c1: '#6b2fa0', c2: '#4a1a70', c3: '#2a0a40' },
    { id: 'king', name: 'Королевский наряд', c1: '#c0880a', c2: '#906000', c3: '#603e00' },
    // SECRET: Raccoon Dev hoodie (only for raccoon_dev body)
    { id: 'dev_hoodie', name: 'Худи разраба', c1: '#1a1a2a', c2: '#0d0d1a', c3: '#050510', secret: 'raccoon_dev' },
    // SECRET: Emperor cloak (only for emperor body)
    { id: 'emperor_cloak', name: 'Форма Ракузана', c1: '#8b0000', c2: '#6a0000', c3: '#440000', secret: 'emperor' },
];

// Masks: each has an svg() function that draws it directly on face coords
const CHAR_MASKS = [
    {
        id: 'none', name: 'Нет маски', noMask: true,
        svg: () => ''
    },
    {
        id: 'glasses', name: 'Очки',
        preview: '😎',
        svg: () => `
      <!-- Glasses sitting right on eyes (eyes at y~31) -->
      <rect x="27" y="26" width="18" height="12" rx="6" fill="none" stroke="#111" stroke-width="2.5"/>
      <rect x="55" y="26" width="18" height="12" rx="6" fill="none" stroke="#111" stroke-width="2.5"/>
      <rect x="27" y="26" width="18" height="12" rx="6" fill="#111" opacity="0.25"/>
      <rect x="55" y="26" width="18" height="12" rx="6" fill="#111" opacity="0.25"/>
      <line x1="45" y1="32" x2="55" y2="32" stroke="#333" stroke-width="2"/>
      <line x1="27" y1="32" x2="21" y2="30" stroke="#333" stroke-width="2"/>
      <line x1="73" y1="32" x2="79" y2="30" stroke="#333" stroke-width="2"/>
    `
    },
    {
        id: 'fox', name: 'Маска лисы',
        preview: '🦊',
        svg: () => `
      <!-- Fox ear horns -->
      <path d="M23 22 L31 12 L39 22 Z" fill="#e0681a" stroke="#c04a00" stroke-width="0.8"/>
      <path d="M77 22 L69 12 L61 22 Z" fill="#e0681a" stroke="#c04a00" stroke-width="0.8"/>
      <path d="M26 22 L31 16 L36 22 Z" fill="#f5a87a"/>
      <path d="M74 22 L69 16 L64 22 Z" fill="#f5a87a"/>
      <!-- Fox face mask covering eyes+nose -->
      <path d="M24 18 Q50 10 76 18 Q78 28 76 40 Q50 48 24 40 Q22 28 24 18Z" fill="#e0681a" opacity="0.9"/>
      <!-- Eye holes -->
      <ellipse cx="37" cy="30" rx="9" ry="9" fill="#1a0800" opacity="0.85"/>
      <ellipse cx="63" cy="30" rx="9" ry="9" fill="#1a0800" opacity="0.85"/>
      <ellipse cx="37" cy="30" rx="6.5" ry="6.5" fill="#ffc060" opacity="0.95"/>
      <ellipse cx="63" cy="30" rx="6.5" ry="6.5" fill="#ffc060" opacity="0.95"/>
      <circle cx="37" cy="30" r="4" fill="#1a0800"/>
      <circle cx="63" cy="30" r="4" fill="#1a0800"/>
      <circle cx="38.5" cy="28.5" r="1.5" fill="white" opacity="0.85"/>
      <circle cx="64.5" cy="28.5" r="1.5" fill="white" opacity="0.85"/>
      <!-- White muzzle area -->
      <ellipse cx="50" cy="42" rx="12" ry="7" fill="#fff5ee" opacity="0.9"/>
      <!-- Nose -->
      <ellipse cx="50" cy="40" rx="4" ry="3" fill="#c04a00"/>
      <circle cx="50" cy="39" r="2" fill="#8a2800"/>
      <!-- Smile -->
      <path d="M43 44 Q50 50 57 44" stroke="#8a2800" stroke-width="1.5" fill="none"/>
      <!-- Whiskers -->
      <line x1="30" y1="42" x2="43" y2="43" stroke="#8a2800" stroke-width="0.8" opacity="0.7"/>
      <line x1="57" y1="43" x2="70" y2="42" stroke="#8a2800" stroke-width="0.8" opacity="0.7"/>
      <line x1="30" y1="44" x2="43" y2="44" stroke="#8a2800" stroke-width="0.8" opacity="0.5"/>
      <line x1="57" y1="44" x2="70" y2="44" stroke="#8a2800" stroke-width="0.8" opacity="0.5"/>
    `
    },
    {
        id: 'skull', name: 'Маска черепа',
        preview: '💀',
        svg: () => `
      <!-- Full skull mask -->
      <ellipse cx="50" cy="32" rx="26" ry="28" fill="#eeeee0" opacity="0.97"/>
      <ellipse cx="50" cy="44" rx="15" ry="13" fill="#eeeee0" opacity="0.97"/>
      <!-- Cracks -->
      <path d="M50 8 L48 14 L52 20 L49 26" stroke="#ccc" stroke-width="1.2" fill="none"/>
      <path d="M36 12 Q30 16 32 24" stroke="#ccc" stroke-width="1" fill="none"/>
      <!-- Eye sockets -->
      <ellipse cx="36" cy="30" rx="10" ry="11" fill="#1a1a1a" opacity="0.95"/>
      <ellipse cx="64" cy="30" rx="10" ry="11" fill="#1a1a1a" opacity="0.95"/>
      <circle cx="36" cy="30" r="4" fill="#2a2aff" opacity="0.35"/>
      <circle cx="64" cy="30" r="4" fill="#2a2aff" opacity="0.35"/>
      <!-- Nose hole -->
      <path d="M46 40 L50 46 L54 40 Q50 36 46 40Z" fill="#222" opacity="0.7"/>
      <!-- Teeth grin -->
      <rect x="33" y="50" width="34" height="13" rx="5" fill="#ddd"/>
      <rect x="37" y="50" width="5" height="13" fill="#1a1a1a" opacity="0.8"/>
      <rect x="46" y="50" width="5" height="13" fill="#1a1a1a" opacity="0.8"/>
      <rect x="55" y="50" width="5" height="13" fill="#1a1a1a" opacity="0.8"/>
      <!-- Jaw detail -->
      <path d="M33 50 Q50 47 67 50" stroke="#bbb" stroke-width="1.5" fill="none"/>
    `
    },
    {
        id: 'lightning', name: 'Маска молнии',
        preview: '⚡',
        svg: () => `
      <!-- Full lightning mask -->
      <path d="M24 16 Q50 8 76 16 Q80 32 76 52 Q50 58 24 52 Q20 32 24 16Z" fill="rgba(15,15,55,0.92)"/>
      <!-- Eye lenses glowing -->
      <ellipse cx="37" cy="31" rx="10" ry="9" fill="rgba(0,0,0,0.4)"/>
      <ellipse cx="63" cy="31" rx="10" ry="9" fill="rgba(0,0,0,0.4)"/>
      <ellipse cx="37" cy="31" rx="8" ry="7" fill="#ffd700" opacity="0.92"/>
      <ellipse cx="63" cy="31" rx="8" ry="7" fill="#ffd700" opacity="0.92"/>
      <ellipse cx="37" cy="31" rx="5" ry="4" fill="#ff8c00"/>
      <ellipse cx="63" cy="31" rx="5" ry="4" fill="#ff8c00"/>
      <circle cx="37" cy="31" r="2.5" fill="#1a0500"/>
      <circle cx="63" cy="31" r="2.5" fill="#1a0500"/>
      <circle cx="38.5" cy="29.5" r="1.2" fill="white" opacity="0.7"/>
      <circle cx="64.5" cy="29.5" r="1.2" fill="white" opacity="0.7"/>
      <!-- Lightning bolt center -->
      <polygon points="53,16 48,28 53,27 47,44 56,28 51,29" fill="#ffd700" opacity="0.98"/>
      <!-- Glowing mouth slit -->
      <path d="M36 48 Q50 54 64 48" stroke="#ffd700" stroke-width="2.5" fill="none" opacity="0.8"/>
      <!-- Side accents -->
      <circle cx="23" cy="32" r="3" fill="#ffd700" opacity="0.6"/>
      <circle cx="77" cy="32" r="3" fill="#ffd700" opacity="0.6"/>
    `
    },
    {
        id: 'dragon', name: 'Маска дракона',
        preview: '🐲',
        svg: () => `
      <!-- Dragon horns -->
      <path d="M28 16 Q24 4 32 8 Q36 16 38 20 Z" fill="#2d7a1a" stroke="#1a5010" stroke-width="0.8"/>
      <path d="M72 16 Q76 4 68 8 Q64 16 62 20 Z" fill="#2d7a1a" stroke="#1a5010" stroke-width="0.8"/>
      <!-- Scales top -->
      <ellipse cx="40" cy="14" rx="6" ry="4" fill="#3a8a20" opacity="0.7"/>
      <ellipse cx="50" cy="11" rx="7" ry="4" fill="#3a8a20" opacity="0.7"/>
      <ellipse cx="60" cy="14" rx="6" ry="4" fill="#3a8a20" opacity="0.7"/>
      <!-- Main mask face -->
      <path d="M22 18 Q50 10 78 18 Q82 34 78 52 Q50 60 22 52 Q18 34 22 18Z" fill="#2d7a1a" opacity="0.95"/>
      <!-- Eye sockets -->
      <ellipse cx="37" cy="31" rx="11" ry="10" fill="#1a3a0a" opacity="0.95"/>
      <ellipse cx="63" cy="31" rx="11" ry="10" fill="#1a3a0a" opacity="0.95"/>
      <ellipse cx="37" cy="31" rx="8" ry="7" fill="#ff4400" opacity="0.97"/>
      <ellipse cx="63" cy="31" rx="8" ry="7" fill="#ff4400" opacity="0.97"/>
      <ellipse cx="37" cy="32" rx="5" ry="7" fill="#1a0000"/>
      <ellipse cx="63" cy="32" rx="5" ry="7" fill="#1a0000"/>
      <circle cx="38.5" cy="29.5" r="2" fill="#ff8800" opacity="0.8"/>
      <circle cx="64.5" cy="29.5" r="2" fill="#ff8800" opacity="0.8"/>
      <!-- Snout -->
      <path d="M36 46 Q50 54 64 46 Q64 56 50 60 Q36 56 36 46Z" fill="#1f6012"/>
      <!-- Nostrils -->
      <ellipse cx="46" cy="49" rx="3" ry="2" fill="#0f3a08"/>
      <ellipse cx="54" cy="49" rx="3" ry="2" fill="#0f3a08"/>
      <!-- Teeth -->
      <path d="M38 48 L41 55 M50 50 L50 57 M62 48 L59 55" stroke="#ddd" stroke-width="2" stroke-linecap="round"/>
      <!-- Scale texture lines -->
      <path d="M28 28 Q32 24 36 28" stroke="#1a5010" stroke-width="0.8" fill="none" opacity="0.5"/>
      <path d="M64 28 Q68 24 72 28" stroke="#1a5010" stroke-width="0.8" fill="none" opacity="0.5"/>
    `
    },
    {
        id: 'robot', name: 'Робо-маска',
        preview: '🤖',
        svg: () => `
      <!-- Robot mask full face plate -->
      <rect x="22" y="14" width="56" height="46" rx="10" fill="#1e2d3d" opacity="0.97" stroke="#4a5a6a" stroke-width="1.5"/>
      <rect x="22" y="14" width="56" height="12" rx="10" fill="#2a3d52" opacity="0.8"/>
      <!-- Side ear nodes -->
      <rect x="18" y="26" width="6" height="12" rx="3" fill="#1e2d3d" stroke="#4a5a6a" stroke-width="1"/>
      <rect x="76" y="26" width="6" height="12" rx="3" fill="#1e2d3d" stroke="#4a5a6a" stroke-width="1"/>
      <circle cx="21" cy="32" r="2" fill="#00e5ff" opacity="0.7"/>
      <circle cx="79" cy="32" r="2" fill="#00e5ff" opacity="0.7"/>
      <!-- Visor bar across eyes -->
      <rect x="26" y="22" width="48" height="20" rx="5" fill="#001a2a" opacity="0.9"/>
      <!-- Eye screens -->
      <rect x="28" y="24" width="19" height="16" rx="3" fill="#00e5ff" opacity="0.85"/>
      <rect x="53" y="24" width="19" height="16" rx="3" fill="#00e5ff" opacity="0.85"/>
      <circle cx="37" cy="32" r="5" fill="#003a4a"/>
      <circle cx="63" cy="32" r="5" fill="#003a4a"/>
      <circle cx="37" cy="32" r="3" fill="#00e5ff" opacity="0.7"/>
      <circle cx="63" cy="32" r="3" fill="#00e5ff" opacity="0.7"/>
      <circle cx="38" cy="31" r="1.5" fill="white" opacity="0.85"/>
      <circle cx="64" cy="31" r="1.5" fill="white" opacity="0.85"/>
      <!-- Scanning line animation hint -->
      <rect x="28" y="31" width="19" height="2" rx="1" fill="white" opacity="0.3"/>
      <rect x="53" y="31" width="19" height="2" rx="1" fill="white" opacity="0.3"/>
      <!-- Grill mouth -->
      <rect x="30" y="47" width="40" height="10" rx="5" fill="#001a2a" opacity="0.9"/>
      <rect x="34" y="49" width="5" height="6" rx="1" fill="#00e5ff" opacity="0.55"/>
      <rect x="42" y="49" width="5" height="6" rx="1" fill="#00e5ff" opacity="0.55"/>
      <rect x="50" y="49" width="5" height="6" rx="1" fill="#00e5ff" opacity="0.55"/>
      <rect x="58" y="49" width="5" height="6" rx="1" fill="#00e5ff" opacity="0.55"/>
      <!-- Top vents -->
      <rect x="36" y="16" width="6" height="2" rx="1" fill="#4a5a6a" opacity="0.7"/>
      <rect x="45" y="16" width="6" height="2" rx="1" fill="#4a5a6a" opacity="0.7"/>
      <rect x="54" y="16" width="6" height="2" rx="1" fill="#4a5a6a" opacity="0.7"/>
    `
    },
    {
        id: 'moon', name: 'Лунная маска',
        preview: '🌙',
        svg: () => `
      <!-- Moon mask – dark with star eyes -->
      <path d="M23 16 Q50 8 77 16 Q81 32 77 52 Q50 60 23 52 Q19 32 23 16Z" fill="#050520" opacity="0.94"/>
      <!-- Crescent detail on side -->
      <path d="M23 24 Q16 32 23 44 Q19 32 23 24Z" fill="#ffc800" opacity="0.5"/>
      <!-- Star/moon eyes -->
      <ellipse cx="37" cy="31" rx="10" ry="9" fill="#0a0a20"/>
      <ellipse cx="63" cy="31" rx="10" ry="9" fill="#0a0a20"/>
      <ellipse cx="37" cy="31" rx="8" ry="7" fill="#c8d8ff" opacity="0.9"/>
      <ellipse cx="63" cy="31" rx="8" ry="7" fill="#c8d8ff" opacity="0.9"/>
      <ellipse cx="35" cy="30" rx="5" ry="4" fill="#8898ff" opacity="0.55"/>
      <ellipse cx="61" cy="30" rx="5" ry="4" fill="#8898ff" opacity="0.55"/>
      <circle cx="37" cy="31" r="3" fill="#1a1a3a"/>
      <circle cx="63" cy="31" r="3" fill="#1a1a3a"/>
      <circle cx="38.5" cy="29.5" r="1.2" fill="#c8d8ff" opacity="0.7"/>
      <circle cx="64.5" cy="29.5" r="1.2" fill="#c8d8ff" opacity="0.7"/>
      <!-- Moon smile -->
      <path d="M38 48 Q50 56 62 48" stroke="#8898ff" stroke-width="2.5" fill="none" opacity="0.9"/>
      <!-- Stars scattered on mask -->
      <circle cx="30" cy="22" r="1.5" fill="#ffc800" opacity="0.9"/>
      <circle cx="70" cy="22" r="1.5" fill="#ffc800" opacity="0.9"/>
      <polygon points="50,14 51.5,18 56,18 52.5,20.5 54,25 50,22.5 46,25 47.5,20.5 44,18 48.5,18" fill="#ffc800" opacity="0.7" transform="scale(0.55) translate(41,6)"/>
      <circle cx="74" cy="36" r="1" fill="#c8d8ff" opacity="0.5"/>
      <circle cx="26" cy="44" r="1" fill="#c8d8ff" opacity="0.4"/>
    `
    },
];

const CHAR_BGS = [
    { id: 'dark', name: 'Тёмный', fill: '#1A222C' },
    { id: 'blue', name: 'Синий', fill: '#1e2d6b' },
    { id: 'purple', name: 'Фиолетовый', fill: '#3b1f6b' },
    { id: 'green', name: 'Зелёный', fill: '#0e3d1e' },
    { id: 'red', name: 'Красный', fill: '#5a1a1a' },
    { id: 'gold', name: 'Золотой', fill: '#4a3800' },
    { id: 'space', name: 'Космос', fill: '#0d0d1a', dots: true, reqXP: 200 },
    { id: 'forest', name: 'Лес', fill: '#0a2010', lines: '#1a4a20', reqXP: 200 },
    { id: 'volcano', name: 'Вулкан', fill: '#1a0808', lines: '#4a1a00', reqXP: 400 },
    { id: 'ocean', name: 'Океан', fill: '#001a3a', lines: '#003060', reqXP: 400 },
    { id: 'galaxy', name: 'Галактика', fill: '#0d0020', lines: '#3a1a60', reqXP: 800 },
    { id: 'golden', name: 'Золото', fill: '#1a1000', lines: '#5a3a00', reqXP: 1500 },
];

const BANNER_COLORS = [
    { id: 'blue', g: 'linear-gradient(160deg,#1e2d6b,#0d1b3e,var(--bg))', color: '#3a5fbf' },
    { id: 'purple', g: 'linear-gradient(160deg,#3b1f6b,#1a0d3e,var(--bg))', color: '#6b3fbf' },
    { id: 'green', g: 'linear-gradient(160deg,#0e3d1e,#071a0d,var(--bg))', color: '#1a6b30' },
    { id: 'red', g: 'linear-gradient(160deg,#5a1a1a,#280d0d,var(--bg))', color: '#8b2020' },
    { id: 'teal', g: 'linear-gradient(160deg,#0d3a3a,#051f1f,var(--bg))', color: '#1a6b6b' },
    { id: 'gold', g: 'linear-gradient(160deg,#4a3800,#221900,var(--bg))', color: '#8b6a00' },
];

const BANNER_PATTERNS = [
    { id: 'none', label: 'Нет', class: '' },
    { id: 'dots', label: 'Точки', class: 'pattern-dots' },
    { id: 'grid', label: 'Сетка', class: 'pattern-grid' },
    { id: 'diag', label: 'Диаг', class: 'pattern-diag' },
    { id: 'waves', label: 'Волны', class: 'pattern-waves' },
];

let profileData = {
    name: '', username: '', bio: '',
    bannerId: 'blue', patternId: 'none',
    equippedTitleId: null,
};

// ─── CHARACTER SVG BUILDER (Duolingo-style) ────────────────────────────────────
function buildCharSVG(bodyIdx, outfitIdx, maskIdx, bgIdx) {
    const body = CHAR_BODIES[bodyIdx] || CHAR_BODIES[0];
    const outfit = CHAR_OUTFITS[outfitIdx] || CHAR_OUTFITS[0];
    const maskDef = CHAR_MASKS[maskIdx] || CHAR_MASKS[0];
    const bgDef = CHAR_BGS[bgIdx] || CHAR_BGS[0];

    const sk = body.special === 'dragon_anon' ? '#1e6b10' : (body.special === 'emperor' ? '#f5e8e0' : (body.special === 'raccoon_dev' ? '#7a8090' : body.colors[0]));
    const skd = body.special === 'dragon_anon' ? '#0f3a06' : (body.special === 'emperor' ? '#e0c8b8' : (body.special === 'raccoon_dev' ? '#555566' : body.colors[1]));
    const c1 = outfit.c1 || '#3a7bd5';
    const c2 = outfit.c2 || '#2a5ba5';
    const c3 = outfit.c3 || '#1e4a8a';

    const isDragonAnon = body.special === 'dragon_anon';
    const isRaccoonDev = body.special === 'raccoon_dev';
    const isEmperor = body.special === 'emperor';
    const isRobot = bodyIdx === 4;
    const isAlien = bodyIdx === 5;
    const isSkeleton = bodyIdx === 6;

    // Background
    const bgFill = bgDef.fill || '#1A222C';
    const bgLines = bgDef.lines || null;
    const bgDots = bgDef.dots || false;
    let bgSVG = `<rect width="100" height="100" fill="${bgFill}"/>`;
    if (bgDots) {
        bgSVG += `<circle cx="15" cy="15" r="1" fill="white" opacity="0.5"/>
    <circle cx="35" cy="8" r="0.8" fill="white" opacity="0.4"/>
    <circle cx="60" cy="20" r="1.2" fill="white" opacity="0.6"/>
    <circle cx="80" cy="10" r="0.7" fill="white" opacity="0.3"/>
    <circle cx="90" cy="40" r="1" fill="white" opacity="0.5"/>
    <circle cx="10" cy="70" r="0.8" fill="white" opacity="0.4"/>
    <circle cx="75" cy="85" r="1" fill="white" opacity="0.3"/>
    <circle cx="25" cy="90" r="0.6" fill="white" opacity="0.4"/>`;
    } else if (bgLines) {
        bgSVG += `<path d="M0 70 Q25 60 50 72 Q75 84 100 70" stroke="${bgLines}" stroke-width="1.5" fill="none" opacity="0.6"/>
    <path d="M0 80 Q30 70 55 82 Q80 92 100 80" stroke="${bgLines}" stroke-width="1" fill="none" opacity="0.4"/>`;
    }

    // Arms (behind body) — use special dark tones for secret chars
    const armSk = (isDragonAnon || isEmperor) ? '#0d0d1a' : (isRaccoonDev ? '#6a7080' : sk);
    const leftArm = `
    <rect x="10" y="66" width="20" height="22" rx="9" fill="${c1}"/>
    <rect x="10" y="66" width="20" height="10" rx="9" fill="${c2}" opacity="0.5"/>
    <ellipse cx="19" cy="89" rx="9" ry="6" fill="${armSk}"/>`;
    const rightArm = `
    <rect x="70" y="66" width="20" height="22" rx="9" fill="${c1}"/>
    <rect x="70" y="66" width="20" height="10" rx="9" fill="${c2}" opacity="0.5"/>
    <ellipse cx="81" cy="89" rx="9" ry="6" fill="${armSk}"/>`;

    // Torso / Outfit
    let torsoExtra = '';
    let collarSVG = '';
    if (outfit.id === 'armor') {
        torsoExtra = `
      <rect x="27" y="66" width="46" height="6" rx="3" fill="${c3}" opacity="0.8"/>
      <rect x="30" y="72" width="17" height="12" rx="3" fill="${c2}"/>
      <rect x="53" y="72" width="17" height="12" rx="3" fill="${c2}"/>
      <rect x="27" y="84" width="46" height="5" rx="2" fill="${c3}" opacity="0.7"/>
      <ellipse cx="25" cy="67" rx="10" ry="5" fill="${c1}"/>
      <ellipse cx="75" cy="67" rx="10" ry="5" fill="${c1}"/>
      <ellipse cx="25" cy="66" rx="8" ry="3.5" fill="${c2}"/>
      <ellipse cx="75" cy="66" rx="8" ry="3.5" fill="${c2}"/>`;
        collarSVG = `<rect x="43" y="62" width="14" height="2" rx="1" fill="${c3}"/>`;
    } else if (outfit.id === 'hoodie') {
        torsoExtra = `
      <rect x="37" y="80" width="26" height="8" rx="4" fill="${c2}" opacity="0.7"/>
      <line x1="46" y1="65" x2="44" y2="80" stroke="${c3}" stroke-width="1.5"/>
      <line x1="54" y1="65" x2="56" y2="80" stroke="${c3}" stroke-width="1.5"/>`;
        collarSVG = `<path d="M40 63 Q50 69 60 63" stroke="${c3}" stroke-width="2" fill="none"/>`;
    } else if (outfit.id === 'robe') {
        torsoExtra = `
      <rect x="27" y="79" width="46" height="5" rx="2" fill="${c3}" opacity="0.9"/>
      <rect x="47" y="64" width="6" height="25" fill="${c3}" opacity="0.5"/>`;
        collarSVG = `<path d="M37 64 Q50 72 63 64" stroke="${c3}" stroke-width="2.5" fill="${c2}" opacity="0.8"/>`;
    } else if (outfit.id === 'ninja') {
        torsoExtra = `
      <rect x="27" y="75" width="46" height="7" rx="3" fill="#ff3030" opacity="0.85"/>
      <rect x="27" y="74" width="46" height="3" rx="1" fill="#cc0000"/>
      <line x1="50" y1="63" x2="50" y2="89" stroke="#333" stroke-width="1.5" opacity="0.7"/>`;
        collarSVG = `<rect x="43" y="62" width="14" height="6" rx="3" fill="#111"/>`;
    } else if (outfit.id === 'wizard') {
        torsoExtra = `
      <circle cx="38" cy="74" r="3" fill="#ffc800" opacity="0.85"/>
      <circle cx="62" cy="74" r="3" fill="#ffc800" opacity="0.85"/>
      <rect x="27" y="80" width="46" height="4" rx="2" fill="${c3}"/>`;
        collarSVG = `<path d="M36 64 Q50 73 64 64" fill="${c3}" stroke="${c3}" stroke-width="1"/>`;
    } else if (outfit.id === 'king') {
        torsoExtra = `
      <rect x="27" y="63" width="46" height="6" rx="3" fill="#f5f0e8"/>
      <circle cx="36" cy="66" r="2" fill="#111" opacity="0.7"/>
      <circle cx="46" cy="66" r="2" fill="#111" opacity="0.7"/>
      <circle cx="56" cy="66" r="2" fill="#111" opacity="0.7"/>
      <circle cx="66" cy="66" r="2" fill="#111" opacity="0.7"/>
      <rect x="27" y="80" width="46" height="6" rx="3" fill="#ffc800"/>
      <rect x="46" y="80" width="8" height="6" rx="2" fill="#ff9900"/>
      <ellipse cx="26" cy="67" rx="9" ry="4" fill="#ffc800"/>
      <ellipse cx="74" cy="67" rx="9" ry="4" fill="#ffc800"/>`;
    } else if (outfit.id === 'dev_hoodie') {
        torsoExtra = `
      <rect x="27" y="75" width="46" height="8" rx="4" fill="#0d0d1a" opacity="0.9"/>
      <rect x="37" y="76" width="26" height="8" rx="4" fill="#050510" opacity="0.8"/>
      <line x1="50" y1="63" x2="50" y2="89" stroke="#00ff88" stroke-width="1" opacity="0.6"/>
      <rect x="30" y="68" width="16" height="9" rx="2" fill="#001a0d" stroke="#00ff88" stroke-width="0.8" opacity="0.9"/>
      <text x="31.5" y="74" font-size="3.5" fill="#00ff88" font-family="monospace">&lt;/&gt;</text>
      <rect x="27" y="63" width="3" height="37" rx="1" fill="#00ff88" opacity="0.15"/>
      <rect x="70" y="63" width="3" height="37" rx="1" fill="#00ff88" opacity="0.15"/>`;
        collarSVG = `<path d="M40 63 Q50 69 60 63" stroke="#00ff88" stroke-width="1.5" fill="none" opacity="0.7"/>`;
    } else if (outfit.id === 'emperor_cloak') {
        // ── RAKUZAN HIGH BASKETBALL JERSEY – Akashi #4, peak form ──
        torsoExtra = `
      <!-- Jersey base top layer: slightly darker upper chest panel -->
      <rect x="27" y="63" width="46" height="16" rx="8" fill="#990000" opacity="0.5"/>
      <!-- Sides gold pinstripes -->
      <rect x="27" y="63" width="2.5" height="37" fill="#cc8800" opacity="0.9"/>
      <rect x="70.5" y="63" width="2.5" height="37" fill="#cc8800" opacity="0.9"/>
      <!-- Secondary inner pinstripe -->
      <rect x="30.5" y="63" width="1" height="37" fill="#ffcc44" opacity="0.4"/>
      <rect x="68.5" y="63" width="1" height="37" fill="#ffcc44" opacity="0.4"/>
      <!-- Rakuzan "R" crest on left chest -->
      <circle cx="37" cy="72" r="5.5" fill="#7a0000" stroke="#cc8800" stroke-width="1.2"/>
      <circle cx="37" cy="72" r="4" fill="#8b0000"/>
      <text x="37" y="74.5" text-anchor="middle" font-size="5.5" font-weight="900" fill="#cc8800" font-family="Georgia, serif">R</text>
      <!-- Jersey number 4 – bold center -->
      <text x="50" y="86" text-anchor="middle" font-size="20" font-weight="900" fill="white" font-family="Arial Black, Impact, sans-serif" opacity="0.95">4</text>
      <!-- Number outline for depth -->
      <text x="50.5" y="86.5" text-anchor="middle" font-size="20" font-weight="900" fill="#cc8800" font-family="Arial Black, Impact, sans-serif" opacity="0.25">4</text>
      <!-- Shoulder panels – sporty raglan style -->
      <path d="M27 63 Q35 59 42 63 L42 74 Q35 70 27 74Z" fill="#7a0000" opacity="0.85"/>
      <path d="M73 63 Q65 59 58 63 L58 74 Q65 70 73 74Z" fill="#7a0000" opacity="0.85"/>
      <!-- Shoulder gold edge -->
      <path d="M27 63 Q35 59 42 63" stroke="#cc8800" stroke-width="1.2" fill="none"/>
      <path d="M73 63 Q65 59 58 63" stroke="#cc8800" stroke-width="1.2" fill="none"/>
      <!-- Captain armband on left arm -->
      <rect x="10" y="70" width="18" height="7" rx="3" fill="#cc8800"/>
      <rect x="11" y="71" width="16" height="5" rx="2" fill="#e8aa00"/>
      <text x="19" y="76" text-anchor="middle" font-size="5" font-weight="900" fill="#660000" font-family="Arial Black, sans-serif">C</text>
      <!-- Emperor Eye glow mark on right chest (subtle power aura) -->
      <circle cx="63" cy="72" r="4" fill="#cc0000" opacity="0.18"/>
      <circle cx="63" cy="72" r="2.5" fill="#ff2222" opacity="0.22"/>
      <circle cx="63" cy="72" r="1.2" fill="#ff6666" opacity="0.3"/>
      <!-- Bottom hem gold stripe -->
      <rect x="27" y="96" width="46" height="4" rx="2" fill="#cc8800" opacity="0.7"/>`;
        collarSVG = `
      <!-- Deep V-neck collar – dark red with gold trim -->
      <path d="M35 63 L50 75 L65 63" fill="#8b0000" stroke="none"/>
      <path d="M35 63 L50 75 L65 63" fill="none" stroke="#cc8800" stroke-width="1.5"/>
      <!-- Inner collar shadow -->
      <path d="M38 63 L50 72 L62 63" fill="#660000" opacity="0.4"/>`;
    } else {
        collarSVG = `<path d="M44 63 L50 67 L56 63" stroke="${c2}" stroke-width="1.5" fill="none" opacity="0.8"/>`;
    }

    const torsoSVG = `
    <rect x="27" y="63" width="46" height="37" rx="10" fill="${c1}"/>
    <rect x="27" y="63" width="46" height="14" rx="10" fill="${c2}" opacity="0.4"/>
    ${torsoExtra}
    ${collarSVG}`;

    // Neck
    const neckSVG = `
    <rect x="44" y="58" width="12" height="10" rx="5" fill="${sk}"/>
    <rect x="44" y="62" width="12" height="5" fill="${skd}" opacity="0.25"/>`;

    // Head – big & round Duolingo style
    let headSVG = '';
    if (isRobot) {
        headSVG = `
      <rect x="22" y="12" width="56" height="48" rx="14" fill="${sk}"/>
      <rect x="22" y="12" width="56" height="16" rx="14" fill="${skd}" opacity="0.35"/>
      <rect x="48" y="4" width="4" height="10" rx="2" fill="${skd}"/>
      <circle cx="50" cy="3" r="5" fill="#FFC800"/>
      <circle cx="22" cy="36" r="5" fill="${skd}"/>
      <circle cx="78" cy="36" r="5" fill="${skd}"/>
      <rect x="28" y="22" width="18" height="14" rx="4" fill="#001a2a"/>
      <rect x="54" y="22" width="18" height="14" rx="4" fill="#001a2a"/>
      <rect x="29" y="23" width="16" height="12" rx="3" fill="#00E5FF" opacity="0.9"/>
      <rect x="55" y="23" width="16" height="12" rx="3" fill="#00E5FF" opacity="0.9"/>
      <circle cx="37" cy="29" r="4.5" fill="#001a2a"/>
      <circle cx="63" cy="29" r="4.5" fill="#001a2a"/>
      <circle cx="38.5" cy="27.5" r="1.8" fill="white" opacity="0.8"/>
      <circle cx="64.5" cy="27.5" r="1.8" fill="white" opacity="0.8"/>
      <rect x="30" y="43" width="40" height="10" rx="5" fill="#00E5FF" opacity="0.15" stroke="#00E5FF" stroke-width="0.8"/>
      <rect x="33" y="45" width="6" height="6" rx="1" fill="#001a2a"/>
      <rect x="42" y="45" width="6" height="6" rx="1" fill="#001a2a"/>
      <rect x="52" y="45" width="6" height="6" rx="1" fill="#001a2a"/>
      <rect x="61" y="45" width="6" height="6" rx="1" fill="#001a2a"/>`;
    } else if (isAlien) {
        headSVG = `
      <ellipse cx="50" cy="30" rx="28" ry="32" fill="${sk}"/>
      <ellipse cx="50" cy="24" rx="24" ry="20" fill="${sk}"/>
      <ellipse cx="50" cy="28" rx="26" ry="28" fill="${skd}" opacity="0.2"/>
      <ellipse cx="36" cy="32" rx="10" ry="12" fill="#40e080"/>
      <ellipse cx="64" cy="32" rx="10" ry="12" fill="#40e080"/>
      <ellipse cx="36" cy="32" rx="6" ry="8" fill="#003318"/>
      <ellipse cx="64" cy="32" rx="6" ry="8" fill="#003318"/>
      <ellipse cx="34" cy="29" rx="2.5" ry="3" fill="#60ff90" opacity="0.5"/>
      <ellipse cx="62" cy="29" rx="2.5" ry="3" fill="#60ff90" opacity="0.5"/>
      <path d="M40 48 Q50 43 60 48" stroke="#40e080" stroke-width="2" fill="none" stroke-linecap="round"/>
      <ellipse cx="47" cy="44" rx="2" ry="1.5" fill="${skd}" opacity="0.5"/>
      <ellipse cx="53" cy="44" rx="2" ry="1.5" fill="${skd}" opacity="0.5"/>`;
    } else if (isSkeleton) {
        headSVG = `
      <ellipse cx="50" cy="32" rx="26" ry="28" fill="${sk}"/>
      <ellipse cx="50" cy="24" rx="24" ry="16" fill="${sk}"/>
      <ellipse cx="34" cy="42" rx="8" ry="5" fill="${skd}" opacity="0.3"/>
      <ellipse cx="66" cy="42" rx="8" ry="5" fill="${skd}" opacity="0.3"/>
      <ellipse cx="36" cy="30" rx="10" ry="11" fill="#111"/>
      <ellipse cx="64" cy="30" rx="10" ry="11" fill="#111"/>
      <ellipse cx="36" cy="30" rx="5" ry="5" fill="white" opacity="0.08"/>
      <ellipse cx="64" cy="30" rx="5" ry="5" fill="white" opacity="0.08"/>
      <path d="M45 40 L50 46 L55 40 Q50 37 45 40Z" fill="#111" opacity="0.6"/>
      <rect x="33" y="49" width="34" height="11" rx="4" fill="#111"/>
      <rect x="36" y="49" width="6" height="11" fill="${sk}"/>
      <rect x="46" y="49" width="6" height="11" fill="${sk}"/>
      <rect x="56" y="49" width="6" height="11" fill="${sk}"/>
      <path d="M50 10 L48 17 L52 23 L49 29" stroke="#aaa" stroke-width="1.2" fill="none" opacity="0.6"/>`;
    } else if (isDragonAnon) {
        // ─── FULL DRAGON HEAD – green scaled dragon with horns, snout, fangs ───
        headSVG = `
      <!-- Back horns -->
      <path d="M30 18 Q24 2 34 8 Q37 2 38 16 Z" fill="#1a5a0a" stroke="#0f3a06" stroke-width="0.8"/>
      <path d="M70 18 Q76 2 66 8 Q63 2 62 16 Z" fill="#1a5a0a" stroke="#0f3a06" stroke-width="0.8"/>
      <!-- Inner horn highlight -->
      <path d="M31 18 Q27 6 33 10 Q35 6 36 16 Z" fill="#2a7a18" opacity="0.7"/>
      <path d="M69 18 Q73 6 67 10 Q65 6 64 16 Z" fill="#2a7a18" opacity="0.7"/>
      <!-- Main dragon skull – wide and reptilian -->
      <ellipse cx="50" cy="28" rx="28" ry="22" fill="#1e6b10"/>
      <!-- Snout extends forward/down -->
      <path d="M30 36 Q50 52 70 36 Q72 48 68 56 Q50 66 32 56 Q28 48 30 36Z" fill="#1a6010"/>
      <!-- Scale texture rows on forehead -->
      <path d="M30 20 Q40 16 50 18 Q60 16 70 20" stroke="#0f3a06" stroke-width="1.2" fill="none" opacity="0.6"/>
      <path d="M28 26 Q38 21 50 23 Q62 21 72 26" stroke="#0f3a06" stroke-width="1" fill="none" opacity="0.5"/>
      <!-- Scale bumps top -->
      <circle cx="38" cy="19" r="2.5" fill="#2a8020" opacity="0.6"/>
      <circle cx="50" cy="16" r="3" fill="#2a8020" opacity="0.7"/>
      <circle cx="62" cy="19" r="2.5" fill="#2a8020" opacity="0.6"/>
      <!-- Brow ridges -->
      <path d="M26 28 Q35 22 44 26" stroke="#0f3a06" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M56 26 Q65 22 74 28" stroke="#0f3a06" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <!-- Eyes – vertical slit pupils, glowing amber -->
      <ellipse cx="36" cy="30" rx="10" ry="9" fill="#0a2a05"/>
      <ellipse cx="64" cy="30" rx="10" ry="9" fill="#0a2a05"/>
      <ellipse cx="36" cy="30" rx="7.5" ry="7" fill="#ff8c00" opacity="0.95"/>
      <ellipse cx="64" cy="30" rx="7.5" ry="7" fill="#ff8c00" opacity="0.95"/>
      <!-- Slit pupils -->
      <ellipse cx="36" cy="30" rx="2.5" ry="7" fill="#050a00"/>
      <ellipse cx="64" cy="30" rx="2.5" ry="7" fill="#050a00"/>
      <!-- Eye glow rim -->
      <ellipse cx="36" cy="30" rx="7.5" ry="7" fill="none" stroke="#ffcc00" stroke-width="0.7" opacity="0.7"/>
      <ellipse cx="64" cy="30" rx="7.5" ry="7" fill="none" stroke="#ffcc00" stroke-width="0.7" opacity="0.7"/>
      <circle cx="37.5" cy="27" r="2" fill="#ffe070" opacity="0.6"/>
      <circle cx="65.5" cy="27" r="2" fill="#ffe070" opacity="0.6"/>
      <!-- Nostrils -->
      <ellipse cx="44" cy="48" rx="3.5" ry="2.5" fill="#0a2a05"/>
      <ellipse cx="56" cy="48" rx="3.5" ry="2.5" fill="#0a2a05"/>
      <!-- Jaw / mouth line -->
      <path d="M30 50 Q50 58 70 50" stroke="#0a2a05" stroke-width="2" fill="none"/>
      <!-- Fangs -->
      <path d="M36 52 L33 62 L39 58 Z" fill="#e8e8d0"/>
      <path d="M44 55 L42 64 L48 60 Z" fill="#e8e8d0"/>
      <path d="M64 52 L67 62 L61 58 Z" fill="#e8e8d0"/>
      <path d="M56 55 L58 64 L52 60 Z" fill="#e8e8d0"/>
      <!-- Chin scales -->
      <ellipse cx="50" cy="60" rx="12" ry="6" fill="#2a8020" opacity="0.5"/>
      <!-- Side ear/jaw fins -->
      <path d="M22 28 Q16 24 18 36 Q22 32 26 34 Z" fill="#1a6010" stroke="#0f3a06" stroke-width="0.7"/>
      <path d="M78 28 Q84 24 82 36 Q78 32 74 34 Z" fill="#1a6010" stroke="#0f3a06" stroke-width="0.7"/>`;
    } else if (isRaccoonDev) {
        // ─── RACCOON DEVELOPER – masked hacker coder raccoon ───
        headSVG = `
      <!-- Fluffy raccoon head -->
      <ellipse cx="50" cy="32" rx="27" ry="29" fill="#7a8090"/>
      <!-- Ear tufts -->
      <path d="M27 14 Q23 3 31 8 Q33 3 35 12 Z" fill="#6a7080" stroke="#555" stroke-width="0.5"/>
      <path d="M73 14 Q77 3 69 8 Q67 3 65 12 Z" fill="#6a7080" stroke="#555" stroke-width="0.5"/>
      <path d="M28 14 Q25 7 30 10 Q32 7 33 13 Z" fill="#3a3040" opacity="0.6"/>
      <path d="M72 14 Q75 7 70 10 Q68 7 67 13 Z" fill="#3a3040" opacity="0.6"/>
      <!-- Classic raccoon bandit mask -->
      <path d="M22 23 Q37 17 50 22 Q63 17 78 23 Q80 36 76 42 Q63 48 50 44 Q37 48 24 42 Q20 36 22 23Z" fill="#2a2a35" opacity="0.95"/>
      <!-- White cheek patches -->
      <ellipse cx="35" cy="40" rx="8" ry="6" fill="#d0d0c0" opacity="0.9"/>
      <ellipse cx="65" cy="40" rx="8" ry="6" fill="#d0d0c0" opacity="0.9"/>
      <!-- Terminal/monitor eyes (dev theme) -->
      <rect x="27" y="24" width="18" height="14" rx="4" fill="#001a0d" stroke="#00ff88" stroke-width="1.2"/>
      <rect x="55" y="24" width="18" height="14" rx="4" fill="#001a0d" stroke="#00ff88" stroke-width="1.2"/>
      <!-- Screen glare -->
      <rect x="28" y="25" width="16" height="12" rx="3" fill="#001a0d" opacity="0.95"/>
      <rect x="56" y="25" width="16" height="12" rx="3" fill="#001a0d" opacity="0.95"/>
      <!-- Code text on eye-screens -->
      <text x="29" y="32" font-size="4" fill="#00ff88" font-family="monospace" opacity="0.9">&gt;_</text>
      <text x="57" y="32" font-size="4" fill="#00ff88" font-family="monospace" opacity="0.9">{ }</text>
      <rect x="29" y="33" width="10" height="1.5" rx="0.5" fill="#00ff88" opacity="0.5"/>
      <rect x="57" y="33" width="10" height="1.5" rx="0.5" fill="#00ff88" opacity="0.5"/>
      <!-- Snout -->
      <ellipse cx="50" cy="46" rx="10" ry="7" fill="#c0c0b0"/>
      <ellipse cx="50" cy="42" rx="4.5" ry="3" fill="#444455"/>
      <circle cx="50" cy="41" r="2" fill="#2a2a35"/>
      <!-- Dev logo badge on forehead -->
      <circle cx="50" cy="16" r="5" fill="#1a1a2a" stroke="#00ff88" stroke-width="1"/>
      <text x="47.5" y="19" font-size="5" fill="#00ff88" font-family="monospace" font-weight="bold">&lt;/&gt;</text>`;
    } else if (isEmperor) {
        // ─── AKASHI SEIJURO – Emperor Eye activated, peak form ───
        headSVG = `
      <!-- ── EMPEROR EYE AURA – outer crimson field ── -->
      <circle cx="64" cy="31" r="18" fill="#cc0000" opacity="0.07"/>
      <circle cx="64" cy="31" r="22" fill="#cc0000" opacity="0.04"/>
      <!-- ── HAIR – sharp crimson, swept right, anime style ── -->
      <!-- Back hair mass (deep burgundy) -->
      <path d="M23 30 Q21 12 27 7 Q31 2 35 9 Q38 3 42 10 Q46 3 50 9 Q55 3 60 9 Q64 4 68 11 Q73 6 77 16 Q79 24 78 31" fill="#6b0000"/>
      <!-- Mid hair layer -->
      <path d="M23 30 Q22 15 29 10 Q33 5 38 12 Q42 6 48 11 Q53 5 59 11 Q65 7 70 14 Q75 10 78 20 Q79 26 78 31" fill="#8b0000"/>
      <!-- Front hair sweep – Akashi's signature right-side part with bang -->
      <path d="M25 26 Q26 14 33 11 Q37 8 41 15 Q38 11 35 16 Q30 20 26 26Z" fill="#aa1111"/>
      <!-- Right side – hair falls over right shoulder -->
      <path d="M76 28 Q80 35 78 46 Q75 40 72 36 Q74 32 76 28Z" fill="#8b0000"/>
      <!-- Left side hair -->
      <path d="M23 30 Q19 36 21 44 Q23 38 27 35 Q24 33 23 30Z" fill="#8b0000"/>
      <!-- Hair highlight shine -->
      <path d="M34 10 Q42 6 50 10 Q43 8 35 13Z" fill="#cc2222" opacity="0.5"/>
      <path d="M55 8 Q63 5 70 11 Q63 8 56 13Z" fill="#cc2222" opacity="0.4"/>
      <!-- ── FACE – pale, sharp aristocratic ── -->
      <ellipse cx="50" cy="35" rx="25" ry="25" fill="#f2e4da"/>
      <!-- Jaw sharper/narrower (anime style) -->
      <path d="M29 44 Q33 58 50 63 Q67 58 71 44" fill="#f2e4da"/>
      <!-- Cheek shadows -->
      <ellipse cx="32" cy="43" rx="6" ry="4" fill="#ddb8a0" opacity="0.35"/>
      <ellipse cx="68" cy="43" rx="6" ry="4" fill="#ddb8a0" opacity="0.35"/>
      <!-- ── LEFT EYE – gold/amber (heterochromia) ── -->
      <!-- Eyelid shape (upper lid sharp for anime) -->
      <path d="M27 29 Q36 23 45 29 Q43 32 36 33 Q29 32 27 29Z" fill="white"/>
      <path d="M27 29 Q36 25 45 29" stroke="#8b4513" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <!-- Iris – warm amber gold -->
      <ellipse cx="36" cy="30" rx="6.5" ry="6.5" fill="#c8780a"/>
      <ellipse cx="36" cy="30" rx="5" ry="5" fill="#da8e14"/>
      <circle cx="36" cy="30" r="3.5" fill="#9b5800"/>
      <circle cx="36" cy="30" r="2.2" fill="#3a1a00"/>
      <!-- Gold shimmer -->
      <circle cx="37.5" cy="28" r="1.8" fill="white" opacity="0.9"/>
      <circle cx="35" cy="32" r="0.7" fill="white" opacity="0.4"/>
      <!-- Lower lid -->
      <path d="M27 29 Q36 35 45 29" stroke="#c09070" stroke-width="0.7" fill="none" opacity="0.6"/>
      <!-- ── RIGHT EYE – EMPEROR EYE activated (blazing crimson) ── -->
      <!-- Outer glow halos -->
      <circle cx="64" cy="30" r="14" fill="#cc0000" opacity="0.13"/>
      <circle cx="64" cy="30" r="12" fill="#ee0000" opacity="0.10"/>
      <!-- Eyelid white -->
      <path d="M55 28 Q64 22 73 28 Q71 32 64 33 Q57 32 55 28Z" fill="white"/>
      <!-- Red iris – Emperor Eye -->
      <ellipse cx="64" cy="30" rx="7" ry="7" fill="#dd0000"/>
      <ellipse cx="64" cy="30" rx="5.5" ry="5.5" fill="#ff1a1a"/>
      <!-- Pupil with depth -->
      <circle cx="64" cy="30" r="3.5" fill="#880000"/>
      <circle cx="64" cy="30" r="2" fill="#440000"/>
      <!-- Bright highlight -->
      <circle cx="66" cy="27.5" r="2.5" fill="white" opacity="0.92"/>
      <circle cx="62.5" cy="32" r="0.9" fill="white" opacity="0.5"/>
      <!-- Iris ring glow -->
      <ellipse cx="64" cy="30" rx="7" ry="7" fill="none" stroke="#ff5555" stroke-width="1.2" opacity="0.9"/>
      <ellipse cx="64" cy="30" rx="9" ry="9" fill="none" stroke="#cc0000" stroke-width="0.7" opacity="0.5"/>
      <!-- Emperor Eye light rays -->
      <line x1="64" y1="18" x2="64" y2="21" stroke="#ff4444" stroke-width="1.3" opacity="0.8"/>
      <line x1="73" y1="21" x2="71" y2="23" stroke="#ff4444" stroke-width="1.2" opacity="0.7"/>
      <line x1="76" y1="30" x2="73" y2="30" stroke="#ff4444" stroke-width="1.3" opacity="0.8"/>
      <line x1="73" y1="39" x2="71" y2="37" stroke="#ff3333" stroke-width="1" opacity="0.6"/>
      <!-- Upper eyelid line -->
      <path d="M55 28 Q64 22 73 28" stroke="#7a0000" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- Lower lid -->
      <path d="M55 28 Q64 34 73 28" stroke="#c07070" stroke-width="0.8" fill="none" opacity="0.5"/>
      <!-- ── EYEBROWS – sharp, thin, aristocratic ── -->
      <path d="M26 22 Q36 17 44 21" stroke="#5a0000" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M56 21 Q64 16 74 22" stroke="#5a0000" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <!-- ── NOSE ── -->
      <path d="M48 43 Q50 47 52 43" stroke="#c09070" stroke-width="1" fill="none"/>
      <circle cx="48" cy="45" r="1.2" fill="#c09070" opacity="0.5"/>
      <circle cx="52" cy="45" r="1.2" fill="#c09070" opacity="0.5"/>
      <!-- ── LIPS – confident closed smirk ── -->
      <path d="M39 53 Q50 60 61 53" stroke="#bf7060" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M44 53 Q50 57 56 53" fill="#c07060" opacity="0.35"/>
      <!-- slight smirk right corner -->
      <path d="M58 53 Q62 51 63 53" stroke="#bf7060" stroke-width="1" fill="none" opacity="0.7"/>
      <!-- ── EARS ── -->
      <ellipse cx="24" cy="37" rx="4.5" ry="6.5" fill="#f0e0d0"/>
      <ellipse cx="24" cy="37" rx="2.5" ry="4" fill="#ddb8a0" opacity="0.5"/>
      <ellipse cx="76" cy="37" rx="4.5" ry="6.5" fill="#f0e0d0"/>
      <ellipse cx="76" cy="37" rx="2.5" ry="4" fill="#ddb8a0" opacity="0.5"/>`;
    } else {
        // Normal Duolingo-style head
        headSVG = `
      <ellipse cx="50" cy="63" rx="20" ry="5" fill="#000" opacity="0.12"/>
      <ellipse cx="50" cy="32" rx="27" ry="29" fill="${sk}"/>
      <ellipse cx="33" cy="42" rx="7" ry="4" fill="#ffaaaa" opacity="0.22"/>
      <ellipse cx="67" cy="42" rx="7" ry="4" fill="#ffaaaa" opacity="0.22"/>
      <ellipse cx="50" cy="55" rx="17" ry="5" fill="${skd}" opacity="0.28"/>
      <ellipse cx="37" cy="31" rx="8.5" ry="9.5" fill="white"/>
      <ellipse cx="63" cy="31" rx="8.5" ry="9.5" fill="white"/>
      <circle cx="37" cy="32" r="6" fill="#1a3a60"/>
      <circle cx="63" cy="32" r="6" fill="#1a3a60"/>
      <circle cx="37" cy="32" r="3.8" fill="#080e18"/>
      <circle cx="63" cy="32" r="3.8" fill="#080e18"/>
      <circle cx="39" cy="30" r="2" fill="white" opacity="0.95"/>
      <circle cx="65" cy="30" r="2" fill="white" opacity="0.95"/>
      <circle cx="36" cy="33" r="0.9" fill="white" opacity="0.5"/>
      <circle cx="62" cy="33" r="0.9" fill="white" opacity="0.5"/>
      <path d="M28 21 Q37 17 46 20" stroke="${skd}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M54 20 Q63 17 72 21" stroke="${skd}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="50" cy="42" rx="3.5" ry="2.5" fill="${skd}" opacity="0.38"/>
      <path d="M38 49 Q50 59 62 49" stroke="${skd}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M40 49 Q50 57 60 49" stroke="white" stroke-width="1.5" fill="white" opacity="0.3"/>
      <ellipse cx="23" cy="34" rx="5" ry="8" fill="${sk}"/>
      <ellipse cx="23" cy="34" rx="3" ry="5" fill="${skd}" opacity="0.25"/>
      <ellipse cx="77" cy="34" rx="5" ry="8" fill="${sk}"/>
      <ellipse cx="77" cy="34" rx="3" ry="5" fill="${skd}" opacity="0.25"/>`;
    }

    // Hair (top of head, below mask)
    let hairSVG = '';
    if (!isRobot && !isSkeleton && !isDragonAnon && !isRaccoonDev && !isEmperor) {
        hairSVG = `
      <ellipse cx="50" cy="10" rx="27" ry="14" fill="${skd}"/>
      <ellipse cx="50" cy="12" rx="25" ry="12" fill="${skd}"/>
      <ellipse cx="32" cy="18" rx="10" ry="8" fill="${skd}"/>
      <ellipse cx="68" cy="18" rx="10" ry="8" fill="${skd}"/>`;
    }

    // Mask – sits ON TOP of everything (face layer)
    let maskSVG = '';
    if (!maskDef.noMask && maskDef.svg) {
        maskSVG = maskDef.svg();
    }

    return `
    <defs>
      <clipPath id="cclip"><rect x="0" y="0" width="100" height="115"/></clipPath>
    </defs>
    <g clip-path="url(#cclip)">
      ${bgSVG}
      ${leftArm}
      ${rightArm}
      ${torsoSVG}
      ${neckSVG}
      ${headSVG}
      ${hairSVG}
      ${maskSVG}
    </g>`;
}

function buildEmperorSVG() {
    return `
    <defs>
      <radialGradient id="emBg" cx="50%" cy="30%" r="75%">
        <stop offset="0%" stop-color="#1a0a1a"/>
        <stop offset="100%" stop-color="#08050a"/>
      </radialGradient>
      <radialGradient id="eyeR" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ff2222" stop-opacity="0.7"/>
        <stop offset="100%" stop-color="#cc0000" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="eyeL" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ff2222" stop-opacity="0.7"/>
        <stop offset="100%" stop-color="#cc0000" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <!-- BG subtle dark -->
    <rect x="0" y="0" width="100" height="115" fill="url(#emBg)"/>

    <!-- ── BODY (small chibi) ── -->
    <!-- Legs / shorts – white with blue trim -->
    <rect x="37" y="97" width="10" height="14" rx="3" fill="#e8eef5"/>
    <rect x="53" y="97" width="10" height="14" rx="3" fill="#e8eef5"/>
    <rect x="36" y="105" width="12" height="3" rx="1" fill="#aac8e0"/>
    <rect x="52" y="105" width="12" height="3" rx="1" fill="#aac8e0"/>
    <!-- Shoes -->
    <ellipse cx="42" cy="112" rx="7" ry="3.5" fill="#f0f0f0"/>
    <ellipse cx="58" cy="112" rx="7" ry="3.5" fill="#f0f0f0"/>
    <rect x="36" y="109" width="12" height="4" rx="2" fill="#f0f0f0"/>
    <rect x="52" y="109" width="12" height="4" rx="2" fill="#f0f0f0"/>

    <!-- Arms -->
    <!-- Left arm -->
    <rect x="22" y="68" width="11" height="20" rx="5" fill="#f5e8e0"/>
    <ellipse cx="27" cy="88" rx="5.5" ry="4" fill="#f0e0d0"/>
    <!-- Right arm -->
    <rect x="67" y="68" width="11" height="20" rx="5" fill="#f5e8e0"/>
    <ellipse cx="73" cy="88" rx="5.5" ry="4" fill="#f0e0d0"/>

    <!-- Jersey body – white with blue accents -->
    <rect x="30" y="65" width="40" height="35" rx="7" fill="#f0f4f8"/>
    <!-- Jersey top shoulder panel dark -->
    <path d="M30 65 Q35 60 44 63 L44 70 Q35 68 30 72Z" fill="#1a1a2a"/>
    <path d="M70 65 Q65 60 56 63 L56 70 Q65 68 70 72Z" fill="#1a1a2a"/>
    <!-- Blue side stripes -->
    <rect x="30" y="65" width="3" height="35" rx="1" fill="#6ab0d8"/>
    <rect x="67" y="65" width="3" height="35" rx="1" fill="#6ab0d8"/>
    <!-- RAKUZAN text -->
    <text x="50" y="77" text-anchor="middle" font-size="5.5" font-weight="900" fill="#4a90c0" font-family="Arial Black, sans-serif" letter-spacing="0.5">RAKUZAN</text>
    <!-- Number 4 -->
    <text x="50" y="95" text-anchor="middle" font-size="19" font-weight="900" fill="#222" font-family="Arial Black, Impact, sans-serif">4</text>
    <!-- V-neck collar dark -->
    <path d="M40 65 L50 74 L60 65" fill="#1a1a2a"/>
    <path d="M40 65 L50 74 L60 65" fill="none" stroke="#1a1a2a" stroke-width="1"/>
    <!-- Captain armband -->
    <rect x="19" y="73" width="13" height="6" rx="2" fill="#cc8800"/>
    <text x="25.5" y="78" text-anchor="middle" font-size="5" font-weight="900" fill="#4a1a00" font-family="Arial Black">C</text>

    <!-- Neck -->
    <rect x="44" y="56" width="12" height="12" rx="5" fill="#f5e8e0"/>

    <!-- ── HEAD – big chibi, round ── -->
    <!-- Head base pale skin -->
    <ellipse cx="50" cy="36" rx="29" ry="28" fill="#f5e8e0"/>
    <!-- Cheek blush -->
    <ellipse cx="30" cy="44" rx="7" ry="4" fill="#f0a0a0" opacity="0.45"/>
    <ellipse cx="70" cy="44" rx="7" ry="4" fill="#f0a0a0" opacity="0.45"/>
    <!-- Ears -->
    <ellipse cx="21" cy="38" rx="4.5" ry="6" fill="#f5e0d0"/>
    <ellipse cx="21" cy="38" rx="2.5" ry="3.5" fill="#e8c8b8" opacity="0.5"/>
    <ellipse cx="79" cy="38" rx="4.5" ry="6" fill="#f5e0d0"/>
    <ellipse cx="79" cy="38" rx="2.5" ry="3.5" fill="#e8c8b8" opacity="0.5"/>

    <!-- ── HAIR – spiky red chibi style ── -->
    <!-- Back hair layer -->
    <ellipse cx="50" cy="18" rx="29" ry="22" fill="#7a1010"/>
    <!-- Spiky hair top – many sharp points -->
    <polygon points="50,2 53,10 58,1 60,11 65,3 66,12 71,6 70,14 74,10 72,18 50,16" fill="#8b1515"/>
    <polygon points="50,2 47,10 42,1 40,11 35,3 34,12 29,6 30,14 26,10 28,18 50,16" fill="#8b1515"/>
    <!-- Mid hair layer over forehead -->
    <ellipse cx="50" cy="22" rx="28" ry="18" fill="#8b1515"/>
    <!-- Front spikes over forehead -->
    <path d="M22 22 Q26 10 32 16 Q34 8 38 15 Q40 7 44 14 Q46 6 50 12 Q54 6 56 14 Q60 7 62 15 Q66 8 68 16 Q74 10 78 22" fill="#9b1818"/>
    <!-- Hair highlight -->
    <path d="M36 10 Q44 6 52 9 Q45 7 37 13Z" fill="#bb3333" opacity="0.6"/>
    <path d="M55 8 Q63 5 70 11 Q63 8 56 13Z" fill="#bb3333" opacity="0.4"/>

    <!-- ── EYEBROWS – sharp dark red, stern look ── -->
    <path d="M24 28 Q34 22 42 26" stroke="#5a0000" stroke-width="2.8" fill="none" stroke-linecap="round"/>
    <path d="M58 26 Q66 22 76 28" stroke="#5a0000" stroke-width="2.8" fill="none" stroke-linecap="round"/>
    <!-- Frown inner corners -->
    <path d="M38 27 Q40 25 42 26" stroke="#5a0000" stroke-width="1.5" fill="none"/>
    <path d="M58 26 Q60 25 62 27" stroke="#5a0000" stroke-width="1.5" fill="none"/>

    <!-- ── LEFT EYE – Emperor Eye red ── -->
    <ellipse cx="34" cy="35" rx="10" ry="9" fill="white"/>
    <!-- Aura glow -->
    <ellipse cx="34" cy="35" rx="13" ry="11" fill="url(#eyeL)"/>
    <ellipse cx="34" cy="35" rx="10" ry="9" fill="white"/>
    <!-- Red iris -->
    <ellipse cx="34" cy="35" rx="8" ry="7.5" fill="#cc0000"/>
    <ellipse cx="34" cy="35" rx="6.5" ry="6" fill="#ee1a1a"/>
    <ellipse cx="34" cy="35" rx="4.5" ry="4.5" fill="#aa0000"/>
    <circle cx="34" cy="35" r="2.8" fill="#660000"/>
    <!-- Iris rings -->
    <ellipse cx="34" cy="35" rx="8" ry="7.5" fill="none" stroke="#ff5555" stroke-width="1.2" opacity="0.9"/>
    <ellipse cx="34" cy="35" rx="10" ry="9" fill="none" stroke="#cc0000" stroke-width="0.7" opacity="0.5"/>
    <!-- Highlight -->
    <circle cx="37" cy="31.5" r="2.5" fill="white" opacity="0.95"/>
    <circle cx="32" cy="38.5" r="1" fill="white" opacity="0.4"/>
    <!-- Eyelid -->
    <path d="M24 33 Q34 26 44 33" stroke="#5a0000" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M24 35 Q34 43 44 35" stroke="#c09090" stroke-width="0.8" fill="none" opacity="0.5"/>

    <!-- ── RIGHT EYE – Emperor Eye red ── -->
    <ellipse cx="66" cy="35" rx="10" ry="9" fill="white"/>
    <!-- Aura glow -->
    <ellipse cx="66" cy="35" rx="13" ry="11" fill="url(#eyeR)"/>
    <ellipse cx="66" cy="35" rx="10" ry="9" fill="white"/>
    <!-- Red iris -->
    <ellipse cx="66" cy="35" rx="8" ry="7.5" fill="#cc0000"/>
    <ellipse cx="66" cy="35" rx="6.5" ry="6" fill="#ee1a1a"/>
    <ellipse cx="66" cy="35" rx="4.5" ry="4.5" fill="#aa0000"/>
    <circle cx="66" cy="35" r="2.8" fill="#660000"/>
    <!-- Iris rings -->
    <ellipse cx="66" cy="35" rx="8" ry="7.5" fill="none" stroke="#ff5555" stroke-width="1.2" opacity="0.9"/>
    <ellipse cx="66" cy="35" rx="10" ry="9" fill="none" stroke="#cc0000" stroke-width="0.7" opacity="0.5"/>
    <!-- Highlight -->
    <circle cx="69" cy="31.5" r="2.5" fill="white" opacity="0.95"/>
    <circle cx="64" cy="38.5" r="1" fill="white" opacity="0.4"/>
    <!-- Eyelid -->
    <path d="M56 33 Q66 26 76 33" stroke="#5a0000" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M56 35 Q66 43 76 35" stroke="#c09090" stroke-width="0.8" fill="none" opacity="0.5"/>

    <!-- Nose – tiny chibi dot -->
    <circle cx="50" cy="46" r="1.4" fill="#d0a898" opacity="0.7"/>

    <!-- Mouth – thin stern line -->
    <path d="M43 51 Q50 54 57 51" stroke="#c09080" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  `;
}

function renderCharSVG(svgEl, bodyIdx, outfitIdx, maskIdx, bgIdx) {
    if (!svgEl) return;
    const body = CHAR_BODIES[bodyIdx];
    if (body && body.special === 'emperor') {
        svgEl.innerHTML = buildEmperorSVG();
    } else {
        svgEl.innerHTML = buildCharSVG(bodyIdx, outfitIdx, maskIdx, bgIdx);
    }
}

// ─── MODULES & LESSONS DATA ──────────────────────────────────────────────────
const MODULES = [
    {
        id: 0, title: 'Основы Pascal', icon: '📘', color: '#58CC02', colorDark: '#46A302',
        desc: 'Вывод, переменные, ввод и операторы',
        xpReward: 50, rewardOutfitIdx: -1,
        lessons: [
            {
                title: 'Вывод данных',
                questions: [
                    { q: 'Какая команда выводит текст в Pascal?', opts: ['writeln(\'Hi\')', 'print(\'Hi\')', 'echo \'Hi\''], correct: 0, exp: 'writeln — стандартный вывод с переходом на новую строку.' },
                    { q: 'Как вывести текст БЕЗ перевода строки?', opts: ['write(\'A\')', 'writeln(\'A\')', 'print(\'A\')'], correct: 0, exp: 'write не добавляет перенос строки в конце.' },
                    { q: 'Что выведет writeln(2+3)?', opts: ['2+3', '5', 'Ошибка'], correct: 1, exp: 'Выражение вычисляется, потом выводится результат.' },
                    { q: 'Как вывести переменную x?', code: 'var x: integer;', opts: ['writeln(x)', 'writeln(\'x\')', 'write x'], correct: 0, exp: 'Без кавычек выводится значение переменной.' },
                    { q: 'Какой символ используется для строк в Pascal?', opts: ["Одинарная кавычка '", 'Двойная кавычка "', 'Обратный слеш \\'], correct: 0, exp: "В Pascal строки в одинарных кавычках: 'Hello'." },
                    { q: 'Что делает readln?', opts: ['Читает ввод с клавиатуры', 'Выводит текст', 'Очищает экран'], correct: 0, exp: 'readln ждёт ввода от пользователя и нажатия Enter.' },
                ]
            },
            {
                title: 'Переменные и типы',
                questions: [
                    { q: 'Как объявить целую переменную x?', opts: ['var x: integer;', 'int x;', 'x := 0;'], correct: 0, exp: 'В Pascal: var имя: тип;' },
                    { q: 'Какой тип для дробных чисел?', opts: ['real', 'float', 'decimal'], correct: 0, exp: 'real хранит числа с плавающей точкой.' },
                    { q: 'Что хранит тип boolean?', opts: ['true/false', 'Текст', 'Число'], correct: 0, exp: 'boolean принимает только true или false.' },
                    { q: 'Где в программе объявляются переменные?', code: 'program Test;\n[ТУТ]\nbegin\n  ...\nend.', opts: ['До begin', 'После begin', 'После end.'], correct: 0, exp: 'Раздел var всегда идёт до begin.' },
                    { q: 'Что такое char?', opts: ['Один символ', 'Строка', 'Целое число'], correct: 0, exp: 'char хранит ровно один символ, например \'A\'.' },
                ]
            },
            {
                title: 'Присваивание',
                questions: [
                    { q: 'Какой оператор присваивания в Pascal?', code: 'x ___ 10;', opts: ['=', ':=', '=='], correct: 1, exp: ':= — оператор присваивания в Pascal.' },
                    { q: 'Что произойдёт после x := 5 + 3?', opts: ['x = 8', 'x = \'5+3\'', 'Ошибка'], correct: 0, exp: 'Выражение вычисляется, результат присваивается x.' },
                    { q: 'Можно ли писать x := x + 1?', opts: ['Да, это счётчик', 'Нет, ошибка', 'Только в цикле'], correct: 0, exp: 'Да, это стандартный способ увеличения переменной.' },
                    { q: 'Как прочитать число с клавиатуры в x?', opts: ['readln(x)', 'input(x)', 'scan(x)'], correct: 0, exp: 'readln(x) читает значение и сохраняет в x.' },
                    { q: 'Чему равен результат?', code: 'x := 10;\nx := x * 2;\nwriteln(x);', opts: ['20', '10', '2'], correct: 0, exp: 'x сначала 10, потом умножается на 2 → 20.' },
                ]
            },
            {
                title: 'Арифметика',
                questions: [
                    { q: 'Как записать остаток от деления в Pascal?', opts: ['mod', '%', 'rem'], correct: 0, exp: '17 mod 5 = 2 — остаток от деления.' },
                    { q: 'Что делает div?', opts: ['Целочисленное деление', 'Дробное деление', 'Умножение'], correct: 0, exp: '7 div 2 = 3, дробная часть отбрасывается.' },
                    { q: 'Чему равно 2 + 3 * 4?', opts: ['14', '20', '11'], correct: 0, exp: 'Умножение выполняется первым: 3*4=12, потом 2+12=14.' },
                    { q: 'Как возвести в квадрат число x?', opts: ['x * x', 'x ^ 2', 'sqr x'], correct: 0, exp: 'В Pascal нет оператора ^, используй x * x или sqr(x).' },
                    { q: 'Что вернёт abs(-5)?', opts: ['5', '-5', 'Ошибка'], correct: 0, exp: 'abs возвращает абсолютное значение числа.' },
                ]
            },
            {
                title: 'Структура программы',
                questions: [
                    { q: 'Чем заканчивается программа на Pascal?', opts: ['end.', 'end;', 'END'], correct: 0, exp: 'Последний end завершается точкой, а не ;' },
                    { q: 'Какое ключевое слово начинает основной блок?', opts: ['begin', 'start', 'run'], correct: 0, exp: 'begin...end — основной блок программы.' },
                    { q: 'Где объявляются константы?', opts: ['const', 'var', 'define'], correct: 0, exp: 'const объявляет именованные константы: const Pi = 3.14;' },
                    { q: 'Что делает program MyApp;?', opts: ['Даёт имя программе', 'Запускает программу', 'Импортирует модуль'], correct: 0, exp: 'Строка program задаёт имя программы — просто метка.' },
                    { q: 'Чем отделяются операторы в Pascal?', opts: ['Точкой с запятой ;', 'Запятой ,', 'Новой строкой'], correct: 0, exp: '; разделяет операторы. Последний перед end можно не ставить.' },
                ]
            },
            {
                title: 'Комментарии',
                questions: [
                    { q: 'Как написать однострочный комментарий в Pascal?', opts: ['// Комментарий', '# Комментарий', '-- Комментарий'], correct: 0, exp: '// — однострочный комментарий в современном Pascal (FPC).' },
                    { q: 'Как написать многострочный комментарий?', opts: ['{ текст }', '/* текст */', '(* текст *)'], correct: 2, exp: '(* ... *) — многострочный комментарий. { } тоже работает.' },
                    { q: 'Влияют ли комментарии на выполнение программы?', opts: ['Нет, игнорируются', 'Да, замедляют', 'Только в begin'], correct: 0, exp: 'Комментарии полностью игнорируются компилятором.' },
                    { q: 'Зачем нужны комментарии?', opts: ['Объяснять код другим и себе', 'Ускорять программу', 'Объявлять переменные'], correct: 0, exp: 'Комментарии — документация кода для читаемости.' },
                    { q: 'Что из этого НЕ является комментарием?', opts: ["writeln('// Hello');", '// Привет!', '{ это комментарий }'], correct: 0, exp: "Текст внутри строки ('...') — это строка, не комментарий." },
                ]
            },
            {
                title: 'Типы данных: детали',
                questions: [
                    { q: 'Какой диапазон у integer?', opts: ['-32768 до 32767 (16-бит) или ±2 млрд (32-бит)', '0 до 255', 'Неограничен'], correct: 0, exp: 'Классический integer: -32768..32767, в FPC обычно 32-бит.' },
                    { q: 'Что такое longint?', opts: ['32-битное целое (-2млрд..2млрд)', 'Длинная строка', 'Массив integer'], correct: 0, exp: 'longint — 32-битный целый тип: -2 147 483 648 до 2 147 483 647.' },
                    { q: 'Что хранит тип string?', opts: ['Строку символов', 'Один символ', 'Число с точкой'], correct: 0, exp: "string — тип строки: var s: string; s := 'Hello';" },
                    { q: 'Как объявить несколько переменных одного типа?', code: 'var a, b, c: ___;', opts: ['integer', 'int a, b, c', 'a b c: int'], correct: 0, exp: 'Перечисли имена через запятую: var a, b, c: integer;' },
                    { q: 'Чему равно boolean-выражение (5 = 5)?', opts: ['true', 'false', '1'], correct: 0, exp: '5 = 5 — истина, тип boolean принимает значение true.' },
                ]
            },
            {
                title: 'Ввод и вывод',
                questions: [
                    { q: 'Как вывести несколько значений в одну строку?', code: 'writeln(a, \' \', b);', opts: ['Так и вывести: a пробел b', 'Ошибка', 'Только через +'], correct: 0, exp: 'writeln принимает несколько аргументов через запятую.' },
                    { q: 'Как ввести два числа с одного Enter?', opts: ['readln(a, b)', 'read(a); read(b)', 'input(a, b)'], correct: 0, exp: 'readln(a, b) читает два значения до нажатия Enter.' },
                    { q: 'Как вывести дробное с 2 знаками после точки?', opts: ['writeln(x:0:2)', 'writeln(round(x,2))', "writeln(format('%.2f',x))"], correct: 0, exp: 'Форматированный вывод: writeln(x:0:2) — 0 мест, 2 знака.' },
                    { q: 'Что означает writeln(x:6)?', opts: ['Вывести x в поле шириной 6 символов', 'Вывести 6 раз', 'Ошибка'], correct: 0, exp: 'x:6 — поле вывода шириной 6: выравнивание по правому краю.' },
                    { q: 'Как вывести символ с кодом 65?', opts: ['write(chr(65))', 'write(char 65)', 'writeln(65)'], correct: 0, exp: "chr(65) = 'A'. ord('A') = 65 — обратная функция." },
                ]
            },
            {
                title: 'Практика: основы',
                questions: [
                    { q: 'Что выведет программа?', code: "writeln('2 + 2 = ', 2+2);", opts: ["2 + 2 = 4", "2 + 2 = 2+2", "4"], correct: 0, exp: "Строка выводится как есть, выражение 2+2 вычисляется → 4." },
                    { q: 'Найди ошибку:', code: 'var x = 10;', opts: ['Нужно := вместо =', 'Нужен ; после var', 'Нет begin'], correct: 0, exp: 'Объявление без значения: var x: integer; Значение — в begin.' },
                    { q: 'Что произойдёт?', code: "var s: string;\nbegin\n  s := 'Hi';\n  writeln(s + '!');\nend.", opts: ["Выведет Hi!", "Ошибка", "Выведет s+!"], correct: 0, exp: "Конкатенация строк: 'Hi' + '!' = 'Hi!'." },
                    { q: 'Каков результат 17 div 5?', opts: ['3', '2', '3.4'], correct: 0, exp: '17 div 5 = 3 (целочисленное деление, остаток отбрасывается).' },
                    { q: 'Каков результат 17 mod 5?', opts: ['2', '3', '0'], correct: 0, exp: '17 = 5 * 3 + 2, остаток = 2.' },
                ]
            },
            {
                title: 'Отладка и ошибки',
                questions: [
                    { q: 'Что такое синтаксическая ошибка?', opts: ['Нарушение правил записи кода', 'Ошибка в логике', 'Ошибка при работе программы'], correct: 0, exp: 'Синтаксическая ошибка: компилятор не понимает код (например, пропущен ;).' },
                    { q: 'Что такое логическая ошибка?', opts: ['Программа работает, но даёт неверный результат', 'Программа не компилируется', 'Программа зависает'], correct: 0, exp: 'Логическая ошибка: код синтаксически верен, но алгоритм неправильный.' },
                    { q: 'Как обнаружить логическую ошибку?', opts: ['Тестировать с примерами и проверять вывод', 'Скомпилировать', 'Удалить комментарии'], correct: 0, exp: 'Тестируй программу с разными входными данными, включая граничные случаи.' },
                    { q: 'Что означает ошибка «Division by zero»?', opts: ['Деление на ноль — недопустимая операция', 'Переменная равна нулю', 'Массив пустой'], correct: 0, exp: 'Деление на ноль вызывает ошибку времени выполнения.' },
                    { q: 'Как защититься от деления на ноль?', opts: ['if b <> 0 then writeln(a div b)', 'try/except', 'Нельзя защититься'], correct: 0, exp: 'Проверяй делитель перед операцией: if b <> 0 then ...' },
                ]
            },
        ],
        trophyQuestions: [
            { type: 'type', q: 'Напиши оператор присваивания:', code: 'x ___ 5;', answer: ':=', chips: [':=', '==', '=', ':'], exp: ':= — присваивание в Pascal.' },
            { type: 'type', q: 'Напиши тип для целых чисел:', code: 'var n: ___;', answer: 'integer', chips: ['integer', 'int', 'number', 'real'], exp: 'integer — тип целых чисел.' },
            { type: 'type', q: 'Напиши ключевое слово раздела переменных:', code: '___ x: integer;', answer: 'var', chips: ['var', 'int', 'let', 'dim'], exp: 'var начинает раздел объявлений.' },
            { type: 'fix', q: 'Исправь ошибку в выводе строки:', code: "print('Hello');", answer: "writeln('Hello');", chips: ['writeln', 'write', 'println', "'Hello'", 'Hello', ';'], exp: "В Pascal writeln, строки в одинарных кавычках." },
            { type: 'type', q: 'Напиши остаток от деления:', code: 'r := 10 ___ 3;', answer: 'mod', chips: ['mod', '%', 'div', 'rem'], exp: 'mod даёт остаток: 10 mod 3 = 1.' },
        ]
    },
    {
        id: 1, title: 'Условия и ветвления', icon: '🔀', color: '#1CB0F6', colorDark: '#1899D6',
        desc: 'if/else, case, логические операторы',
        xpReward: 75, rewardOutfitIdx: 2,
        lessons: [
            {
                title: 'if / then',
                questions: [
                    { q: 'Как начинается условие в Pascal?', opts: ['if ... then', 'when ... do', 'check ... :'], correct: 0, exp: 'Синтаксис: if условие then действие;' },
                    { q: 'Как проверить равенство x и 5?', opts: ['if x = 5 then', 'if x == 5 then', 'if x := 5 then'], correct: 0, exp: 'Сравнение в Pascal — один знак =.' },
                    { q: 'Что нужно для нескольких команд в then?', code: 'if x > 0 then\n  writeln(\'A\');\n  writeln(\'B\');', opts: ['begin ... end', '{ ... }', '( ... )'], correct: 0, exp: 'begin и end группируют несколько операторов.' },
                    { q: 'Как проверить НЕРАВЕНСТВО?', opts: ['<>', '!=', '=/='], correct: 0, exp: '<> означает «не равно» в Pascal.' },
                    { q: 'Что выведет код?', code: 'x := 10;\nif x > 5 then writeln(\'Да\');', opts: ['Да', 'Ничего', 'Ошибка'], correct: 0, exp: '10 > 5 — true, поэтому выполняется writeln.' },
                    { q: 'Когда выполняется else?', opts: ['Когда условие false', 'Всегда', 'Никогда'], correct: 0, exp: 'else — альтернативная ветка при ложном условии.' },
                ]
            },
            {
                title: 'Логика и else',
                questions: [
                    { q: 'Что делает оператор not?', opts: ['Инвертирует boolean', 'Отрицает число', 'Завершает if'], correct: 0, exp: 'not true = false, not false = true.' },
                    { q: 'Как объединить два условия «И»?', opts: ['and', '&&', '&'], correct: 0, exp: 'В Pascal логическое И пишется словом and.' },
                    { q: 'Как объединить два условия «ИЛИ»?', opts: ['or', '||', '|'], correct: 0, exp: 'В Pascal логическое ИЛИ пишется словом or.' },
                    { q: 'Нужна ли ; перед else?', code: 'if x > 0 then\n  writeln(\'+\')\n[?]\nelse\n  writeln(\'-\');', opts: ['Нет', 'Да', 'Зависит от ситуации'], correct: 0, exp: 'Перед else точку с запятой НЕ ставят!' },
                    { q: 'Что вернёт not (3 > 5)?', opts: ['true', 'false', '0'], correct: 0, exp: '3 > 5 = false, not false = true.' },
                ]
            },
            {
                title: 'Вложенные условия',
                questions: [
                    { q: 'Как написать: если x > 0 и x < 10?', opts: ['if (x > 0) and (x < 10) then', 'if x > 0 && x < 10 then', 'if 0 < x < 10 then'], correct: 0, exp: 'В Pascal условия и/или скобках с and/or.' },
                    { q: 'Что такое «вложенное if»?', opts: ['if внутри другого if', 'if без else', 'if с несколькими then'], correct: 0, exp: 'Вложенное if — условие внутри тела другого условия.' },
                    { q: 'Как проверить x в диапазоне [1, 100]?', opts: ['(x >= 1) and (x <= 100)', 'x in [1..100]', '1 <= x <= 100'], correct: 0, exp: 'Используй and для проверки двух границ диапазона.' },
                    { q: 'Что выведет код?', code: 'x := 0;\nif x > 0 then writeln(\'+\')\nelse if x < 0 then writeln(\'-\')\nelse writeln(\'0\');', opts: ['0', '+', '-'], correct: 0, exp: 'x = 0, поэтому сработает последний else.' },
                    { q: 'Как проверить x на чётность?', opts: ['if x mod 2 = 0 then', 'if x % 2 = 0 then', 'if even(x) then'], correct: 0, exp: 'mod 2 = 0 означает, что число делится на 2 нацело.' },
                ]
            },
            {
                title: 'case / of',
                questions: [
                    { q: 'Когда удобно использовать case?', opts: ['Много вариантов одной переменной', 'Один if/else', 'Цикл'], correct: 0, exp: 'case удобен когда нужно много вариантов одного значения.' },
                    { q: 'Как записать case?', code: '', opts: ['case x of\n  1: ...\n  2: ...\nend;', 'switch(x) {\n  case 1: ...}', 'select x when 1...'], correct: 0, exp: 'Синтаксис Pascal: case переменная of значение: действие; end;' },
                    { q: 'Что делает else в case?', opts: ['Ветка по умолчанию', 'Завершает программу', 'Не используется'], correct: 0, exp: 'else в case — выполняется если ни один вариант не совпал.' },
                    { q: 'Какой тип может использоваться в case?', opts: ['Порядковые (integer, char, boolean)', 'Только integer', 'Любой тип'], correct: 0, exp: 'case работает только с порядковыми типами: integer, char, boolean.' },
                    { q: 'Как написать диапазон в case?', opts: ['1..5: writeln(\'мало\');', '1-5: writeln(\'мало\');', '[1,5]: writeln(\'мало\');'], correct: 0, exp: 'Диапазон в case: значение1..значение2: действие;' },
                ]
            },
            {
                title: 'Практика условий',
                questions: [
                    { q: 'Что выведет код?', code: 'a := 5; b := 3;\nif a > b then writeln(a)\nelse writeln(b);', opts: ['5', '3', 'Ошибка'], correct: 0, exp: '5 > 3 — истина, выводится a = 5.' },
                    { q: 'Найди ошибку:', code: 'if x > 0 then;\n  writeln(\'Положительное\');', opts: ['; после then лишняя', 'Нет else', 'writeln неверный'], correct: 0, exp: 'Точка с запятой после then создаёт пустой оператор.' },
                    { q: 'Как проверить на нечётность?', opts: ['x mod 2 <> 0', 'x mod 2 = 1 or x mod 2 = -1', 'odd(x)'], correct: 2, exp: 'odd(x) возвращает true если x нечётное — стандартная функция.' },
                    { q: 'Что вернёт (5 > 3) and (2 < 1)?', opts: ['false', 'true', 'Ошибка типов'], correct: 0, exp: '5 > 3 = true, 2 < 1 = false. true and false = false.' },
                    { q: 'Как корректно написать abs(-7) > 5?', code: '', opts: ['if abs(-7) > 5 then', 'if -7 > 5 then', 'if |−7| > 5 then'], correct: 0, exp: 'abs(-7) = 7, 7 > 5 = true. Всё верно.' },
                ]
            },
            {
                title: 'Логические выражения',
                questions: [
                    { q: 'Что такое «короткое вычисление» (short-circuit)?', opts: ['Если первый операнд and=false — второй не проверяется', 'Оптимизация цикла', 'Ускорение сравнения'], correct: 0, exp: 'В FPC Pascal: в and — если первый false, второй не проверяется.' },
                    { q: 'Что вернёт not false?', opts: ['true', 'false', '0'], correct: 0, exp: 'not инвертирует: not false = true.' },
                    { q: 'Как выразить «x от 1 до 5 включительно»?', opts: ['(x >= 1) and (x <= 5)', 'x in 1..5', '1 <= x <= 5'], correct: 0, exp: 'Pascal требует два условия с and.' },
                    { q: 'Что вернёт true or false?', opts: ['true', 'false', 'Ошибка'], correct: 0, exp: 'В or достаточно одного true.' },
                    { q: 'Верно ли написано условие?', code: 'if x > 0 and x < 10 then', opts: ['Нет, нужны скобки: (x > 0) and (x < 10)', 'Да, верно', 'Только с begin'], correct: 0, exp: 'Приоритет and выше > — нужны скобки вокруг каждого сравнения.' },
                ]
            },
            {
                title: 'Ветвления: сложные случаи',
                questions: [
                    { q: 'Что выведет вложенный if?', code: 'x := 5;\nif x > 0 then\n  if x > 10 then writeln(\'большой\')\n  else writeln(\'малый\')\nelse writeln(\'отриц\');', opts: ['малый', 'большой', 'отриц'], correct: 0, exp: '5 > 0 — true, 5 > 10 — false, выводится «малый».' },
                    { q: 'К какому if относится else?', opts: ['К ближайшему if (dangling else)', 'К первому if', 'Нельзя определить'], correct: 0, exp: 'Правило: else относится к ближайшему незакрытому if.' },
                    { q: 'Как сделать «иначе если»?', opts: ['else if условие then', 'elif', 'elseif'], correct: 0, exp: 'В Pascal: else if — два ключевых слова.' },
                    { q: 'Что выведет?', code: 'x := 7;\ncase x of\n  1..5: writeln(\'мало\');\n  6..10: writeln(\'средне\');\nelse writeln(\'много\');\nend;', opts: ['средне', 'мало', 'много'], correct: 0, exp: '7 попадает в диапазон 6..10.' },
                    { q: 'Можно ли вставить begin...end в ветку case?', opts: ['Да', 'Нет', 'Только в else'], correct: 0, exp: 'Да: 1: begin writeln(a); writeln(b); end;' },
                ]
            },
            {
                title: 'Сравнение строк и символов',
                questions: [
                    { q: 'Можно ли сравнивать char в if?', opts: ["Да: if c = 'A' then", 'Нет, только числа', 'Только с ord()'], correct: 0, exp: "Символы сравниваются как и числа: if c = 'A' then." },
                    { q: 'Что вернёт ord(«A»)?', opts: ['65', '1', '41'], correct: 0, exp: "ASCII-код 'A' = 65." },
                    { q: 'Как сравнить строки на равенство?', opts: ["if s = 'hello' then", "if s == 'hello' then", "if s.equals('hello') then"], correct: 0, exp: 'Строки сравниваются оператором = в Pascal.' },
                    { q: 'Что означает s > t для строк?', opts: ['s лексикографически больше t', 's длиннее t', 'Нельзя сравнивать'], correct: 0, exp: 'Строки сравниваются посимвольно по кодам ASCII.' },
                    { q: 'Как проверить, что строка пустая?', opts: ["if s = '' then", 'if length(s) = 0 then', 'Оба варианта верны'], correct: 2, exp: "Оба способа работают: s = '' или length(s) = 0." },
                ]
            },
            {
                title: 'case: расширенная практика',
                questions: [
                    { q: 'Что выведет case с char?', code: "c := 'B';\ncase c of\n  'A': writeln('Alpha');\n  'B': writeln('Bravo');\nend;", opts: ['Bravo', 'Alpha', 'Ничего'], correct: 0, exp: "c = 'B', срабатывает ветка 'B': → Bravo." },
                    { q: 'Что будет, если значение не попало ни в одну ветку и нет else?', opts: ['Ничего не произойдёт', 'Ошибка', 'Выполнится последняя ветка'], correct: 0, exp: 'Без else case просто ничего не делает — никакой ошибки.' },
                    { q: 'Можно ли использовать boolean в case?', opts: ['Да', 'Нет', 'Только в FPC'], correct: 0, exp: 'boolean — порядковый тип, допустим в case: case b of true:... false:... end;' },
                    { q: 'Какой вывод?', code: 'x := 3;\ncase x of\n  1,2: writeln(\'мало\');\n  3,4: writeln(\'норма\');\nend;', opts: ['норма', 'мало', 'Ошибка'], correct: 0, exp: 'x = 3, ветка 3,4: — выводит «норма».' },
                    { q: 'Когда лучше case, а когда if?', opts: ['case — для дискретных значений, if — для диапазонов и сложных условий', 'case всегда лучше', 'if всегда лучше'], correct: 0, exp: 'case удобен при множестве конкретных значений одной переменной.' },
                ]
            },
            {
                title: 'Практика: условия и выбор',
                questions: [
                    { q: 'Напишите условие: x чётное И больше 10', opts: ['(x mod 2 = 0) and (x > 10)', 'x mod 2 = 0 and x > 10', '(x % 2 = 0) and (x > 10)'], correct: 0, exp: 'Нужны скобки вокруг каждого условия из-за приоритета and.' },
                    { q: 'Что выведет?', code: 'n := 0;\nif n = 0 then writeln(\'ноль\')\nelse if n > 0 then writeln(\'плюс\')\nelse writeln(\'минус\');', opts: ['ноль', 'плюс', 'минус'], correct: 0, exp: 'n = 0, первое условие истинно → «ноль».' },
                    { q: 'Как проверить: символ c — цифра?', opts: ["(c >= '0') and (c <= '9')", "c in ['0'..'9']", 'isDigit(c)'], correct: 0, exp: "Цифры в ASCII идут подряд: '0'=48...'9'=57." },
                    { q: 'Найди ошибку в case:', code: "case x of\n  'a': writeln('A');\n  1: writeln('один');\nend;", opts: ['Нельзя смешивать типы в одном case', 'Нет else', 'Нет begin'], correct: 0, exp: 'Все ветки case должны иметь один тип: или char, или integer.' },
                    { q: 'Что означает «треугольник неравенства»?', code: 'a:=3; b:=4; c:=6;', opts: ['(a+b>c) and (a+c>b) and (b+c>a)', 'a*a + b*b = c*c', 'a<b and b<c'], correct: 0, exp: 'Три стороны образуют треугольник если сумма любых двух > третьей.' },
                ]
            },
        ],
        trophyQuestions: [
            { type: 'type', q: 'Напиши оператор сравнения «не равно»:', code: 'if x ___ 0 then ...', answer: '<>', chips: ['<>', '!=', '=/=', '<'], exp: '<> — не равно в Pascal.' },
            { type: 'type', q: 'Как пишется логическое И в Pascal?', code: 'if (x>0) ___ (x<10) then ...', answer: 'and', chips: ['and', '&&', '&', 'AND'], exp: 'and — логическое И.' },
            { type: 'fix', q: 'Найди ошибку перед else:', code: "if x > 0 then writeln('+');\nelse writeln('-');", answer: "if x > 0 then writeln('+')\nelse writeln('-');", chips: ['if', 'x', '>', '0', 'then', "writeln('+')", ';', 'else'], exp: 'Перед else ; не ставится.' },
            { type: 'type', q: 'Напиши ключевое слово для множественного выбора:', code: '___ x of\n  1: writeln(\'один\');\nend;', answer: 'case', chips: ['case', 'switch', 'select', 'if'], exp: 'case of — множественный выбор в Pascal.' },
            { type: 'type', q: 'Напиши логическое ИЛИ:', code: 'if (x < 0) ___ (x > 100) then ...', answer: 'or', chips: ['or', '||', '|', 'OR'], exp: 'or — логическое ИЛИ в Pascal.' },
        ]
    },
    {
        id: 2, title: 'Циклы', icon: '🔁', color: '#9B59B6', colorDark: '#7D3C98',
        desc: 'for, while, repeat и управление циклами',
        xpReward: 100, rewardOutfitIdx: 4,
        lessons: [
            {
                title: 'Цикл for',
                questions: [
                    { q: 'Как записать цикл от 1 до 10?', opts: ['for i:=1 to 10 do', 'for i=1; i<=10; i++', 'loop i from 1 to 10'], correct: 0, exp: 'for переменная:=начало to конец do' },
                    { q: 'Как сделать цикл в ОБРАТНОМ порядке?', opts: ['for i:=10 downto 1 do', 'for i:=10 to 1 do', 'for i:=10 reverse 1 do'], correct: 0, exp: 'downto заменяет to для убывания.' },
                    { q: 'Что выведет код?', code: 'for i:=1 to 3 do\n  writeln(i);', opts: ['1 2 3', '0 1 2', '1 2 3 4'], correct: 0, exp: 'Цикл выполняется для i = 1, 2, 3.' },
                    { q: 'Можно ли менять счётчик i внутри for?', opts: ['Нет, это запрещено', 'Да, всегда', 'Только увеличивать'], correct: 0, exp: 'Счётчик for нельзя менять внутри тела цикла.' },
                    { q: 'Что произойдёт при for i:=5 to 3 do?', opts: ['Тело не выполнится', 'Зацикливание', 'Ошибка'], correct: 0, exp: 'Если начало > конца, тело цикла не выполняется ни разу.' },
                    { q: 'Как сгруппировать несколько команд в for?', opts: ['begin ... end', '{ ... }', '( ... )'], correct: 0, exp: 'Для нескольких команд в теле цикла нужен begin...end.' },
                ]
            },
            {
                title: 'Цикл while',
                questions: [
                    { q: 'Когда выполняется тело while?', opts: ['Пока условие true', 'Пока условие false', 'Всегда один раз'], correct: 0, exp: 'while проверяет условие ПЕРЕД каждой итерацией.' },
                    { q: 'Что случится, если условие while всегда true?', opts: ['Бесконечный цикл', 'Выполнится 1 раз', 'Ошибка компиляции'], correct: 0, exp: 'Бесконечный цикл — программа зависнет. Всегда обновляй переменную!' },
                    { q: 'Что выведет код?', code: 'x := 1;\nwhile x <= 3 do begin\n  writeln(x);\n  x := x + 1;\nend;', opts: ['1 2 3', '1 2 3 4', '0 1 2 3'], correct: 0, exp: 'Цикл идёт пока x <= 3, то есть 1, 2, 3.' },
                    { q: 'Чем while отличается от for?', opts: ['Число итераций заранее неизвестно', 'while быстрее', 'while нельзя вложить'], correct: 0, exp: 'while используют когда не знаем заранее сколько раз повторять.' },
                    { q: 'Как остановить while досрочно?', opts: ['break', 'stop', 'exit loop'], correct: 0, exp: 'break немедленно выходит из текущего цикла.' },
                ]
            },
            {
                title: 'Цикл repeat',
                questions: [
                    { q: 'Чем repeat...until отличается от while?', opts: ['Выполняется минимум 1 раз', 'Быстрее работает', 'Нет разницы'], correct: 0, exp: 'repeat проверяет условие ПОСЛЕ тела — минимум 1 итерация.' },
                    { q: 'Синтаксис repeat:', opts: ['repeat\n  ...\nuntil условие;', 'do {\n  ...\n} while(условие)', 'loop\n  ...\nend когда условие'], correct: 0, exp: 'repeat...until — тело, потом проверка.' },
                    { q: 'Что выведет код?', code: 'x := 10;\nrepeat\n  writeln(x);\n  x := x - 3;\nuntil x <= 0;', opts: ['10 7 4 1', '10 7 4', '10 7'], correct: 0, exp: 'Выводит 10, 7, 4, 1 — каждый раз -3 пока x > 0.' },
                    { q: 'Когда удобен repeat вместо while?', opts: ['Нужно выполнить тело хотя бы раз', 'Цикл с известным числом итераций', 'Для перебора массивов'], correct: 0, exp: 'repeat удобен для диалогов, меню, проверки ввода.' },
                    { q: 'Условие в until означает:', opts: ['Когда ОСТАНОВИТЬСЯ', 'Когда ПРОДОЛЖАТЬ', 'Начальное значение'], correct: 0, exp: 'until x <= 0 = остановись когда x стал <= 0.' },
                ]
            },
            {
                title: 'Управление циклами',
                questions: [
                    { q: 'Что делает break?', opts: ['Выходит из цикла', 'Пропускает итерацию', 'Завершает программу'], correct: 0, exp: 'break немедленно прерывает текущий цикл.' },
                    { q: 'Что делает continue?', opts: ['Переходит к следующей итерации', 'Выходит из цикла', 'Перезапускает цикл'], correct: 0, exp: 'continue пропускает остаток тела и идёт к следующей итерации.' },
                    { q: 'Что выведет код?', code: 'for i:=1 to 5 do begin\n  if i = 3 then continue;\n  writeln(i);\nend;', opts: ['1 2 4 5', '1 2 3 4 5', '1 2'], correct: 0, exp: 'i=3 пропускается через continue, остальные выводятся.' },
                    { q: 'Как найти первое кратное 7 в диапазоне 1..100?', opts: ['for + if + break', 'Только while', 'Вычислить заранее'], correct: 0, exp: 'Перебираем for, при нахождении — break.' },
                    { q: 'Что делает halt в Pascal?', opts: ['Завершает программу', 'Останавливает цикл', 'Паузирует выполнение'], correct: 0, exp: 'halt() полностью завершает выполнение программы.' },
                ]
            },
            {
                title: 'Вложенные циклы',
                questions: [
                    { q: 'Что такое вложенный цикл?', opts: ['Цикл внутри другого цикла', 'Цикл с условием', 'Цикл с паузой'], correct: 0, exp: 'Вложенный цикл — это цикл, тело которого содержит другой цикл.' },
                    { q: 'Сколько раз выполнится writeln?', code: 'for i:=1 to 3 do\n  for j:=1 to 3 do\n    writeln(i,j);', opts: ['9', '6', '3'], correct: 0, exp: '3 × 3 = 9 итераций.' },
                    { q: 'Как вывести таблицу умножения 3×3?', opts: ['Два вложенных for', 'Один for с тремя writeln', 'while + for'], correct: 0, exp: 'Внешний for — строки, внутренний for — столбцы.' },
                    { q: 'break во вложенном цикле выходит из:', opts: ['Только внутреннего цикла', 'Обоих циклов', 'Всей программы'], correct: 0, exp: 'break выходит только из ближайшего цикла.' },
                    { q: 'Что выведет код?', code: 'for i:=1 to 3 do begin\n  if i = 2 then break;\n  writeln(i);\nend;', opts: ['1', '1 2', '1 2 3'], correct: 0, exp: 'При i=2 break — выводится только 1.' },
                ]
            },
            {
                title: 'Сумма и счёт в циклах',
                questions: [
                    { q: 'Как подсчитать сумму чисел от 1 до N?', code: 'sum := 0;\nfor i:=1 to N do\n  sum := sum + ___;', opts: ['i', '1', 'N'], correct: 0, exp: 'Накапливаем сумму: sum := sum + i на каждой итерации.' },
                    { q: 'Как подсчитать количество чётных чисел от 1 до 10?', opts: ['Цикл + if x mod 2 = 0 then cnt := cnt + 1', 'Делить 10 на 2', 'writeln(5)'], correct: 0, exp: 'Счётчик + проверка на чётность через mod 2 = 0.' },
                    { q: 'Что выведет?', code: 's := 0;\nfor i:=1 to 4 do s := s + i;\nwriteln(s);', opts: ['10', '4', '6'], correct: 0, exp: '1+2+3+4 = 10.' },
                    { q: 'Как найти максимум среди N чисел с вводом?', opts: ['Цикл + if x > max then max := x', 'Отсортировать', 'Использовать функцию max'], correct: 0, exp: 'Классика: читаем каждое число и сравниваем с текущим максимумом.' },
                    { q: 'Как считать произведение N чисел?', code: 'prod := ___;\nfor i:=1 to N do prod := prod * i;', opts: ['1', '0', 'N'], correct: 0, exp: 'Начальное значение произведения = 1 (нейтральный элемент умножения).' },
                ]
            },
            {
                title: 'Цикл и строки',
                questions: [
                    { q: 'Как перебрать все символы строки s?', opts: ['for i:=1 to length(s) do', 'for c in s do', 'while s <> \'\' do'], correct: 0, exp: 'Индексы строки в Pascal начинаются с 1.' },
                    { q: 'Как подсчитать количество пробелов в строке?', opts: ["Цикл + if s[i] = ' ' then cnt++", 'length(s) - length(trim(s))', 'Оба варианта'], correct: 2, exp: 'Оба подхода рабочие.' },
                    { q: 'Что выведет?', code: "s := 'abc';\nfor i:=1 to length(s) do\n  write(s[i], '-');", opts: ['a-b-c-', 'abc-', 'a b c'], correct: 0, exp: 'Каждый символ + дефис: a-b-c-' },
                    { q: 'Как построить строку из N символов «*»?', opts: ['Цикл + s := s + \'*\'', 'writeln(\'*\':N)', 'stringOfChar(\'*\', N)'], correct: 0, exp: 'Конкатенация в цикле: s := s + \'*\'; N раз.' },
                    { q: 'Как развернуть строку задом наперёд?', opts: ['Цикл от length(s) downto 1 + s2 := s2 + s[i]', 'Reverse(s)', 's[length(s)..1]'], correct: 0, exp: 'Перебираем символы с конца и добавляем к новой строке.' },
                ]
            },
            {
                title: 'Вложенные циклы: практика',
                questions: [
                    { q: 'Как вывести прямоугольник из «*» размером N×M?', opts: ['Два вложенных for', 'Один for с N*M итераций', 'repeat + while'], correct: 0, exp: 'Внешний for — строки (N), внутренний — символы в строке (M).' },
                    { q: 'Что выведет?', code: 'for i:=1 to 2 do\n  for j:=1 to 3 do\n    write(i*j, \' \');\n  writeln;', opts: ['1 2 3 2 4 6', '1 2 3 4 5 6', '2 4 6'], correct: 0, exp: 'i=1: 1 2 3; i=2: 2 4 6 с переносом строки.' },
                    { q: 'Как вывести треугольник из «*»?', opts: ['Внешний for i, внутренний for j:=1 to i', 'Один цикл с if', 'Только рекурсия'], correct: 0, exp: 'Внутренний цикл идёт до i — на i-й строке i звёздочек.' },
                    { q: 'Как найти простые числа от 2 до N?', opts: ['Два вложенных цикла (решето)', 'Один цикл', 'Рекурсия'], correct: 0, exp: 'Классика: внешний for проходит по числам, внутренний проверяет делители.' },
                    { q: 'Как подсчитать количество пар (i,j) где i+j = 10, 1<=i,j<=10?', opts: ['Два вложенных for + if i+j=10 then cnt++', 'Математически: 9', 'Один цикл'], correct: 0, exp: 'Вложенный перебор: for i:=1 to 10 do for j:=1 to 10 do if i+j=10 then...' },
                ]
            },
            {
                title: 'while и repeat: практика',
                questions: [
                    { q: 'Как читать числа пока не введут 0?', code: 'readln(x);\nwhile x ___ 0 do begin\n  {обработать x}\n  readln(x);\nend;', opts: ['<>', '=', '>'], correct: 0, exp: 'Условие продолжения: x <> 0 (пока не ноль).' },
                    { q: 'Что выведет?', code: 'x := 1;\nrepeat\n  x := x * 2;\nuntil x > 10;\nwriteln(x);', opts: ['16', '8', '12'], correct: 0, exp: '1→2→4→8→16, первое >10 это 16.' },
                    { q: 'Как реализовать «меню до выхода»?', opts: ['repeat ... until выбор = 0', 'while true do + break', 'Оба варианта'], correct: 2, exp: 'Оба подхода правильны для цикла меню.' },
                    { q: 'Что выведет?', code: 'x := 100;\nwhile x > 1 do x := x div 2;\nwriteln(x);', opts: ['1', '0', '2'], correct: 0, exp: '100→50→25→12→6→3→1, последнее деление 3 div 2 = 1.' },
                    { q: 'Когда repeat безопаснее while?', opts: ['Когда тело нужно выполнить хотя бы раз (проверка ввода)', 'Когда нужна скорость', 'Никогда'], correct: 0, exp: 'repeat гарантирует выполнение тела — идеален для валидации ввода.' },
                ]
            },
            {
                title: 'Практика: разные циклы',
                questions: [
                    { q: 'Что выведет?', code: 'for i:=1 to 5 do\n  if i mod 2 = 0 then write(i, \' \');', opts: ['2 4', '1 3 5', '1 2 3 4 5'], correct: 0, exp: 'Выводятся чётные: 2 и 4.' },
                    { q: 'Как посчитать сумму цифр числа 123?', opts: ['Цикл: брать mod 10, делить на 10', 'Сложить символы', 'Использовать sum()'], correct: 0, exp: 'Алгоритм: n mod 10 — последняя цифра, n div 10 — отбросить её.' },
                    { q: 'Какой цикл лучше для: «повторять пока пользователь не введёт правильный пароль»?', opts: ['repeat...until', 'for', 'while c заранее известным числом'], correct: 0, exp: 'repeat: спрашиваем минимум 1 раз, продолжаем пока пароль неверный.' },
                    { q: 'Что выведет?', code: 'i := 1;\nwhile i <= 10 do begin\n  if i = 5 then break;\n  i := i + 1;\nend;\nwriteln(i);', opts: ['5', '10', '6'], correct: 0, exp: 'Цикл прерывается при i=5, writeln выведет 5.' },
                    { q: 'Как вывести числа Фибоначчи до 100?', opts: ['a:=1; b:=1; while a<=100 do begin write(a); c:=a+b; a:=b; b:=c; end', 'for i:=1 to 100', 'Только рекурсией'], correct: 0, exp: 'Итеративно: держим два последних числа и суммируем их.' },
                ]
            },
        ],
        trophyQuestions: [
            { type: 'type', q: 'Напиши ключевое слово цикла со счётчиком:', code: '___ i:=1 to 10 do ...', answer: 'for', chips: ['for', 'while', 'repeat', 'loop'], exp: 'for — цикл с известным числом итераций.' },
            { type: 'type', q: 'Напиши ключевое слово для обратного цикла:', code: 'for i:=10 ___ 1 do ...', answer: 'downto', chips: ['downto', 'to', 'reverse', 'down'], exp: 'downto для убывающего счётчика.' },
            { type: 'type', q: 'Чем заканчивается цикл repeat?', code: 'repeat\n  ...\n___ x > 0;', answer: 'until', chips: ['until', 'while', 'end', 'done'], exp: 'repeat...until — цикл с постусловием.' },
            { type: 'fix', q: 'Исправь бесконечный цикл:', code: 'x := 1;\nwhile x <= 5 do\n  writeln(x);', answer: 'x := 1;\nwhile x <= 5 do begin\n  writeln(x);\n  x := x + 1;\nend;', chips: ['x', 'x := x + 1', 'begin', 'end', 'while', 'writeln(x)'], exp: 'Нужно увеличивать x, иначе цикл бесконечный.' },
            { type: 'type', q: 'Как прервать цикл досрочно?', code: 'while true do\n  if найдено then ___', answer: 'break', chips: ['break', 'stop', 'exit', 'halt'], exp: 'break выходит из текущего цикла.' },
        ]
    },
    {
        id: 3, title: 'Массивы', icon: '📦', color: '#FFC800', colorDark: '#E6A800',
        desc: 'Одномерные и двумерные массивы, сортировка',
        xpReward: 125, rewardOutfitIdx: 7,
        lessons: [
            {
                title: 'Объявление массивов',
                questions: [
                    { q: 'Как объявить массив из 10 целых чисел?', opts: ['var a: array[1..10] of integer;', 'var a[10]: integer;', 'array a(10) integer;'], correct: 0, exp: 'Синтаксис: array[начало..конец] of тип;' },
                    { q: 'Как обратиться к 3-му элементу массива a?', opts: ['a[3]', 'a(3)', 'a.3'], correct: 0, exp: 'Элементы массива доступны через квадратные скобки.' },
                    { q: 'Что такое индекс массива?', opts: ['Номер позиции элемента', 'Длина массива', 'Тип элемента'], correct: 0, exp: 'Индекс — номер элемента, через который к нему обращаются.' },
                    { q: 'Каков стандартный индекс первого элемента в Pascal?', opts: ['1 (по умолчанию)', '0', 'Зависит от объявления'], correct: 2, exp: 'В Pascal можно задать любой диапазон, например [0..9] или [1..10].' },
                    { q: 'Как заполнить массив из 5 нулей?', opts: ['for i:=1 to 5 do a[i]:=0;', 'a := [0,0,0,0,0];', 'fill(a, 0);'], correct: 0, exp: 'Цикл for — стандартный способ инициализации массива.' },
                ]
            },
            {
                title: 'Работа с элементами',
                questions: [
                    { q: 'Как вывести все элементы массива a[1..5]?', opts: ['for i:=1 to 5 do writeln(a[i]);', 'writeln(a);', 'print array a;'], correct: 0, exp: 'Перебираем индексы циклом и выводим каждый элемент.' },
                    { q: 'Как найти сумму всех элементов массива?', opts: ['sum:=0; for i:=1 to n do sum:=sum+a[i];', 'sum(a)', 'total := a[1]+a[2]+...'], correct: 0, exp: 'Накапливаем сумму в переменной через цикл.' },
                    { q: 'Что произойдёт при обращении к a[0] в массиве a[1..5]?', opts: ['Ошибка выполнения', '0', 'Последний элемент'], correct: 0, exp: 'Выход за границы массива — это ошибка!' },
                    { q: 'Как найти максимальный элемент массива?', opts: ['Перебрать все, запоминая наибольший', 'max(a)', 'a[last]'], correct: 0, exp: 'Инициализируй max:=a[1], затем сравнивай с каждым элементом.' },
                    { q: 'Как посчитать количество чётных чисел в массиве?', opts: ['Цикл + if a[i] mod 2 = 0 then inc(cnt)', 'count_even(a)', 'a mod 2'], correct: 0, exp: 'inc(cnt) увеличивает счётчик на 1 при выполнении условия.' },
                ]
            },
            {
                title: 'Ввод и обработка',
                questions: [
                    { q: 'Как ввести 5 чисел в массив с клавиатуры?', opts: ['for i:=1 to 5 do readln(a[i]);', 'readln(a);', 'input a[1..5];'], correct: 0, exp: 'Читаем каждый элемент по очереди циклом.' },
                    { q: 'Как поменять местами a[2] и a[5]?', opts: ['tmp:=a[2]; a[2]:=a[5]; a[5]:=tmp;', 'swap(a[2],a[5]);', 'a[2] <-> a[5];'], correct: 0, exp: 'Обмен через временную переменную tmp — классический приём.' },
                    { q: 'Как найти индекс минимального элемента?', opts: ['Цикл: если a[i] < a[minIdx] то minIdx:=i', 'indexOf(min(a))', 'low(a)'], correct: 0, exp: 'Запоминаем индекс, а не только значение минимума.' },
                    { q: 'Как скопировать массив a в массив b?', opts: ['for i:=1 to n do b[i]:=a[i];', 'b := a;', 'copy(a, b);'], correct: 0, exp: 'Массивы копируются поэлементно через цикл (или оператором := для статических).' },
                    { q: 'Как развернуть массив задом наперёд?', opts: ['Обменять a[1]↔a[n], a[2]↔a[n-1]...', 'reverse(a)', 'for i:=n downto 1'], correct: 0, exp: 'Обмениваем симметричные элементы от краёв к центру.' },
                ]
            },
            {
                title: 'Сортировка',
                questions: [
                    { q: 'Что такое сортировка пузырьком?', opts: ['Соседние элементы сравниваются и меняются', 'Делим массив пополам', 'Ищем минимум и ставим вперёд'], correct: 0, exp: 'Пузырёк: проходим n-1 раз, каждый раз «всплывает» максимум.' },
                    { q: 'Сколько проходов нужно пузырьку для массива из n элементов?', opts: ['n-1', 'n', 'n²'], correct: 0, exp: 'После n-1 прохода массив гарантированно отсортирован.' },
                    { q: 'Что такое сортировка выбором?', opts: ['Находим минимум, ставим в начало, повторяем', 'Сравниваем соседей', 'Делим пополам рекурсивно'], correct: 0, exp: 'Selection sort: находим минимум из оставшихся и ставим на место.' },
                    { q: 'Как определить, что массив уже отсортирован?', opts: ['Все a[i] <= a[i+1]', 'a[1] = минимум', 'Длина не изменилась'], correct: 0, exp: 'Если каждый следующий элемент >= предыдущего — массив отсортирован.' },
                    { q: 'Что делает inc(x) в Pascal?', opts: ['Увеличивает x на 1', 'Включает переменную', 'Инициализирует x'], correct: 0, exp: 'inc(x) — быстрый способ написать x := x + 1.' },
                ]
            },
            {
                title: 'Двумерные массивы',
                questions: [
                    { q: 'Как объявить матрицу 3×3?', opts: ['var m: array[1..3,1..3] of integer;', 'var m: matrix[3][3];', 'var m[3,3]: integer;'], correct: 0, exp: 'Двумерный массив: array[строки, столбцы] of тип.' },
                    { q: 'Как обратиться к элементу 2-й строки, 3-го столбца?', opts: ['m[2,3] или m[2][3]', 'm(2,3)', 'm.2.3'], correct: 0, exp: 'В Pascal используются m[2,3] или m[2][3].' },
                    { q: 'Как перебрать все элементы матрицы n×n?', opts: ['Два вложенных for (i и j)', 'Один for с парами', 'while i*j <= n*n'], correct: 0, exp: 'Внешний цикл по строкам, внутренний по столбцам.' },
                    { q: 'Как найти сумму главной диагонали матрицы n×n?', opts: ['for i:=1 to n do sum:=sum+m[i,i];', 'diag(m)', 'sum row = col'], correct: 0, exp: 'Элементы главной диагонали: m[1,1], m[2,2], m[3,3]...' },
                    { q: 'Что такое транспонирование матрицы?', opts: ['Строки и столбцы меняются местами', 'Переворот массива', 'Умножение на -1'], correct: 0, exp: 'Транспонирование: b[i,j] := a[j,i].' },
                ]
            },
            {
                title: 'Поиск в массиве',
                questions: [
                    { q: 'Как найти минимальный элемент массива?', opts: ['min:=a[1]; for i:=2 to n do if a[i]<min then min:=a[i]', 'min(a)', 'a[0]'], correct: 0, exp: 'Инициализируем min первым элементом, затем сравниваем с остальными.' },
                    { q: 'Как найти индекс максимального элемента?', opts: ['maxIdx:=1; for i:=2 to n do if a[i]>a[maxIdx] then maxIdx:=i', 'indexOf(max(a))', 'argmax(a)'], correct: 0, exp: 'Запоминаем индекс, а не само значение.' },
                    { q: 'Как проверить, есть ли число x в массиве?', opts: ['Цикл + if a[i]=x then found:=true', 'a.contains(x)', 'x in a'], correct: 0, exp: 'Линейный поиск: перебор всех элементов с флагом found.' },
                    { q: 'Что такое линейный поиск?', opts: ['Перебор с начала до нахождения', 'Поиск в середине', 'Бинарный поиск'], correct: 0, exp: 'Линейный поиск: O(n) — проверяем каждый элемент по порядку.' },
                    { q: 'Сколько элементов просматривает линейный поиск в худшем случае?', opts: ['Все N элементов', 'N/2', 'log₂(N)'], correct: 0, exp: 'Если элемент в конце или отсутствует — просматриваем все N.' },
                ]
            },
            {
                title: 'Сортировка',
                questions: [
                    { q: 'Что делает сортировка пузырьком?', opts: ['Переставляет соседние элементы пока массив не отсортирован', 'Выбирает минимум и ставит в начало', 'Разделяет массив пополам'], correct: 0, exp: 'Bubble sort: проходим N-1 раз, меняем соседей если нарушен порядок.' },
                    { q: 'Сколько проходов нужно bubble sort для N элементов?', opts: ['N-1 проходов', 'N проходов', 'log N проходов'], correct: 0, exp: 'N-1 внешних итераций гарантируют полную сортировку.' },
                    { q: 'Как поменять местами a[i] и a[i+1]?', opts: ['tmp:=a[i]; a[i]:=a[i+1]; a[i+1]:=tmp', 'swap(a[i],a[i+1])', 'a[i] := a[i+1]'], correct: 0, exp: 'Обмен через временную переменную tmp — классика.' },
                    { q: 'Что такое сортировка выбором?', opts: ['Находим минимум и ставим на позицию i, повторяем', 'Сравниваем соседей', 'Делим массив'], correct: 0, exp: 'Selection sort: на каждом шаге находим минимум и меняем с текущей позицией.' },
                    { q: 'Как проверить что массив отсортирован по возрастанию?', opts: ['Цикл: if a[i] > a[i+1] then — не отсортирован', 'sorted(a)', 'Попробовать вывести'], correct: 0, exp: 'Проходим массив и проверяем: каждый элемент ≤ следующего.' },
                ]
            },
            {
                title: 'Массив строк',
                questions: [
                    { q: 'Как объявить массив из 5 строк?', opts: ['var a: array[1..5] of string', 'var a: string[5]', 'var a[5]: string'], correct: 0, exp: 'Массив строк: array[1..5] of string;' },
                    { q: 'Как вывести все строки массива?', opts: ['for i:=1 to 5 do writeln(a[i])', 'writeln(a)', 'print(a)'], correct: 0, exp: 'Цикл по индексам и writeln для каждого элемента.' },
                    { q: 'Как найти самую длинную строку в массиве?', opts: ['Цикл + if length(a[i]) > length(max) then max:=a[i]', 'maxlength(a)', 'a.longest'], correct: 0, exp: 'Сравниваем length каждой строки с текущим максимумом.' },
                    { q: 'Можно ли сортировать массив строк?', opts: ['Да, сравнение строк работает как и чисел', 'Нет', 'Только по длине'], correct: 0, exp: 'Строки сравниваются лексикографически: \'abc\' < \'abd\'.' },
                    { q: 'Как подсчитать строки длиной > 3?', opts: ['Цикл + if length(a[i]) > 3 then cnt:=cnt+1', 'count(a, len>3)', 'filter(a, len>3)'], correct: 0, exp: 'Перебор + проверка length каждой строки.' },
                ]
            },
            {
                title: 'Практика: массивы',
                questions: [
                    { q: 'Как заполнить массив случайными числами 1..100?', opts: ['for i:=1 to n do a[i]:=random(100)+1', 'a := rand(n, 100)', 'randomize(a, n)'], correct: 0, exp: 'random(100) даёт 0..99, +1 → 1..100. Не забудь randomize.' },
                    { q: 'Как скопировать массив a в b?', opts: ['for i:=1 to n do b[i]:=a[i]', 'b := a', 'copy(a, b)'], correct: 0, exp: 'В Pascal массивы копируются поэлементно через цикл (или b:=a для одинаковых типов).' },
                    { q: 'Что выведет?', code: 'a[1]:=3; a[2]:=1; a[3]:=2;\nwriteln(a[2]);', opts: ['1', '3', '2'], correct: 0, exp: 'a[2] = 1.' },
                    { q: 'Как посчитать сумму элементов массива?', opts: ['sum:=0; for i:=1 to n do sum:=sum+a[i]', 'sum(a)', 'add_all(a)'], correct: 0, exp: 'Классика: инициализация нулём + накопление в цикле.' },
                    { q: 'Как найти количество отрицательных элементов?', opts: ['cnt:=0; for i:=1 to n do if a[i]<0 then cnt:=cnt+1', 'negCount(a)', 'Отсортировать и посчитать'], correct: 0, exp: 'Счётчик + условие a[i] < 0.' },
                ]
            },
            {
                title: 'Алгоритмы с массивами',
                questions: [
                    { q: 'Как удалить элемент с индексом k из массива (сдвигом)?', opts: ['for i:=k to n-1 do a[i]:=a[i+1]; n:=n-1', 'delete(a, k)', 'a[k]:=0'], correct: 0, exp: 'Сдвигаем все элементы после k влево, уменьшаем счётчик.' },
                    { q: 'Как вставить элемент x на позицию k?', opts: ['for i:=n downto k do a[i+1]:=a[i]; a[k]:=x; n:=n+1', 'insert(a, k, x)', 'a[k]:=x'], correct: 0, exp: 'Сначала сдвигаем элементы вправо от конца до k, потом вставляем.' },
                    { q: 'Что такое бинарный поиск?', opts: ['Ищет в отсортированном массиве, делит пополам', 'Перебирает все элементы', 'Ищет два одинаковых'], correct: 0, exp: 'Бинарный поиск: O(log n), только для отсортированных массивов.' },
                    { q: 'Как перевернуть массив из n элементов?', opts: ['for i:=1 to n div 2 do swap(a[i], a[n+1-i])', 'reverse(a)', 'for i:=n downto 1 do'], correct: 0, exp: 'Меняем симметричные пары: первый↔последний, второй↔предпоследний...' },
                    { q: 'Сколько шагов нужно бинарному поиску для 1024 элементов?', opts: ['10 шагов (log₂1024=10)', '512 шагов', '1024 шага'], correct: 0, exp: '2¹⁰ = 1024, поэтому log₂(1024) = 10 — максимум 10 шагов.' },
                ]
            },
        ],
        trophyQuestions: [
            { type: 'type', q: 'Как объявить массив из 10 целых?', code: 'var a: array[1..__] of integer;', answer: '10', chips: ['10', '9', '11', 'n'], exp: 'array[1..10] — 10 элементов.' },
            { type: 'type', q: 'Как обратиться к элементу i массива a?', code: 'writeln(a[___]);', answer: 'i', chips: ['i', 'i+1', '0', '1'], exp: 'a[i] — обращение к i-му элементу.' },
            { type: 'type', q: 'Чем обмениваются элементы при swap?', code: 'tmp:=a[i]; a[i]:=a[j]; a[j]:=___;', answer: 'tmp', chips: ['tmp', 'a[i]', 'a[j]', '0'], exp: 'Обмен через временную переменную tmp.' },
            { type: 'fix', q: 'Исправь поиск суммы:', code: 'for i:=1 to 5 do sum:=a[i];', answer: 'sum:=0;\nfor i:=1 to 5 do sum:=sum+a[i];', chips: ['sum:=0', 'sum:=sum+a[i]', 'sum:=a[i]', 'for', 'i:=1'], exp: 'Нужна инициализация sum:=0 и накопление +a[i].' },
            { type: 'type', q: 'Напиши функцию увеличения на 1:', code: '___(x);  // вместо x := x + 1', answer: 'inc', chips: ['inc', 'add', 'inc(x)', 'plus'], exp: 'inc(x) увеличивает x на 1.' },
        ]
    },
    {
        id: 4, title: 'Процедуры и функции', icon: '⚙️', color: '#FF4B4B', colorDark: '#CC0000',
        desc: 'Подпрограммы, параметры, рекурсия',
        xpReward: 150, rewardOutfitIdx: 5,
        lessons: [
            {
                title: 'Процедуры',
                questions: [
                    { q: 'Что такое процедура в Pascal?', opts: ['Именованный блок команд без возврата значения', 'Функция с возвратом', 'Тип данных'], correct: 0, exp: 'Процедура — подпрограмма, которая выполняет действия, но не возвращает значение.' },
                    { q: 'Как объявить процедуру?', opts: ['procedure Greet; begin ... end;', 'def Greet(): ...', 'function Greet() {}'], correct: 0, exp: 'Ключевое слово procedure, потом имя, потом begin...end.' },
                    { q: 'Как вызвать процедуру Greet?', opts: ['Greet;', 'call Greet;', 'run Greet();'], correct: 0, exp: 'Процедура вызывается просто по имени с ;' },
                    { q: 'Где объявляется процедура?', opts: ['До основного begin', 'После end.', 'Внутри begin'], correct: 0, exp: 'Процедуры и функции объявляются до основного блока программы.' },
                    { q: 'Какое преимущество процедур?', opts: ['Повторное использование кода', 'Быстрее работает', 'Занимает меньше памяти'], correct: 0, exp: 'Процедуры позволяют писать код один раз и вызывать много раз.' },
                ]
            },
            {
                title: 'Параметры',
                questions: [
                    { q: 'Как передать параметр в процедуру?', opts: ['procedure Add(x: integer); begin ... end;', 'procedure Add[x]; begin ... end;', 'procedure Add with x: integer;'], correct: 0, exp: 'Параметры перечисляются в скобках через запятую.' },
                    { q: 'В чём разница параметра-значения и параметра-переменной (var)?', opts: ['var позволяет изменять оригинал', 'Нет разницы', 'var быстрее'], correct: 0, exp: 'Параметр-значение — копия. Параметр-переменная (var) — оригинал.' },
                    { q: 'Что изменится в основной программе?', code: 'procedure Double(var x: integer);\nbegin x := x * 2; end;\n\nn := 5; Double(n);', opts: ['n = 10', 'n = 5', 'Ошибка'], correct: 0, exp: 'var-параметр изменяет оригинальную переменную: 5 * 2 = 10.' },
                    { q: 'Как передать несколько параметров?', opts: ['procedure P(a, b: integer; c: real);', 'procedure P(a; b; c);', 'procedure P[a, b, c];'], correct: 0, exp: 'Параметры одного типа можно объединять: a, b: integer.' },
                    { q: 'Что такое локальная переменная?', opts: ['Переменная, живущая только внутри подпрограммы', 'Глобальная переменная', 'Параметр по умолчанию'], correct: 0, exp: 'Локальные переменные объявляются в var внутри процедуры/функции.' },
                ]
            },
            {
                title: 'Функции',
                questions: [
                    { q: 'Чем функция отличается от процедуры?', opts: ['Возвращает значение', 'Быстрее работает', 'Принимает больше параметров'], correct: 0, exp: 'Функция возвращает значение через своё имя.' },
                    { q: 'Как объявить функцию, возвращающую integer?', opts: ['function Sum(a,b: integer): integer;', 'integer function Sum(a,b);', 'func Sum(a,b) -> integer;'], correct: 0, exp: 'После параметров ставим : тип_возврата.' },
                    { q: 'Как вернуть значение из функции?', opts: ['имяФункции := результат;', 'return результат;', 'exit(результат);'], correct: 0, exp: 'В Pascal результат присваивается имени функции: Sum := a + b;' },
                    { q: 'Что выведет код?', code: 'function Sqr2(x: integer): integer;\nbegin Sqr2 := x * x; end;\n\nwriteln(Sqr2(4));', opts: ['16', '8', '4'], correct: 0, exp: 'Sqr2(4) = 4 * 4 = 16.' },
                    { q: 'Можно ли вызвать функцию внутри выражения?', opts: ['Да', 'Нет', 'Только в if'], correct: 0, exp: 'writeln(Sqr2(3) + 1) = 10 — функции можно встраивать.' },
                ]
            },
            {
                title: 'Рекурсия',
                questions: [
                    { q: 'Что такое рекурсия?', opts: ['Функция, вызывающая саму себя', 'Цикл внутри функции', 'Несколько функций вместе'], correct: 0, exp: 'Рекурсия — когда функция вызывает себя с другим аргументом.' },
                    { q: 'Что обязательно нужно в рекурсивной функции?', opts: ['Базовый случай (условие остановки)', 'Глобальная переменная', 'Параметр var'], correct: 0, exp: 'Без базового случая рекурсия бесконечна и вызовет ошибку стека.' },
                    { q: 'Что вернёт Fact(4), если Fact(n) = n * Fact(n-1), Fact(0)=1?', opts: ['24', '12', '16'], correct: 0, exp: '4! = 4 * 3 * 2 * 1 = 24.' },
                    { q: 'Что такое переполнение стека?', opts: ['Рекурсия зашла слишком глубоко', 'Массив вышел за границы', 'Деление на 0'], correct: 0, exp: 'Stack overflow — рекурсия без базового случая или очень глубокая.' },
                    { q: 'Fibonacci(5) = Fibonacci(4) + Fibonacci(3). Чему равно Fibonacci(5)?', code: 'Fib(1)=1, Fib(2)=1', opts: ['5', '8', '3'], correct: 0, exp: 'Fib: 1,1,2,3,5 — F(5)=5.' },
                ]
            },
            {
                title: 'Строки и стандартные функции',
                questions: [
                    { q: 'Как получить длину строки s?', opts: ['length(s)', 'len(s)', 'size(s)'], correct: 0, exp: 'length(s) возвращает количество символов в строке.' },
                    { q: 'Как получить i-й символ строки s?', opts: ['s[i]', 'charAt(s,i)', 's.char(i)'], correct: 0, exp: 'Строки в Pascal — массивы символов: s[1] — первый символ.' },
                    { q: 'Как соединить две строки?', opts: ["s1 + s2 или concat(s1, s2)", "s1 & s2", "append(s1, s2)"], correct: 0, exp: "Конкатенация строк: s := s1 + s2 или concat(s1, s2)." },
                    { q: 'Что делает copy(s, 3, 4)?', opts: ['Вырезает 4 символа с позиции 3', 'Копирует строку', 'Первые 3 символа'], correct: 0, exp: 'copy(строка, начало, длина) — вырезает подстроку.' },
                    { q: 'Как перевести строку в верхний регистр?', opts: ['UpCase(символ) для каждого', 'toUpper(s)', 'upper(s)'], correct: 0, exp: 'UpCase работает с char. Для строки — цикл по символам.' },
                ]
            },
            {
                title: 'Параметры процедур',
                questions: [
                    { q: 'Чем отличается передача по значению от передачи по ссылке?', opts: ['По значению — копия, по ссылке — оригинал', 'По ссылке быстрее', 'Нет разницы'], correct: 0, exp: 'var-параметр даёт доступ к оригиналу, без var — работаем с копией.' },
                    { q: 'Что выведет?', code: 'procedure Add(var x: integer);\nbegin x := x + 10; end;\na := 5;\nAdd(a);\nwriteln(a);', opts: ['15', '5', '10'], correct: 0, exp: 'var-параметр изменяет оригинал: 5 + 10 = 15.' },
                    { q: 'Зачем нужен const-параметр?', opts: ['Запрещает изменение внутри процедуры', 'Ускоряет программу', 'Объявляет константу'], correct: 0, exp: 'const-параметр: передаётся по ссылке, но изменить нельзя.' },
                    { q: 'Как передать массив в процедуру?', opts: ['procedure P(var a: array[1..n] of integer)', 'procedure P(a: array)', 'procedure P(a)'], correct: 0, exp: 'Массив передают с var или через тип-псевдоним (type MyArr = array[1..10] of integer).' },
                    { q: 'Сколько значений может вернуть функция?', opts: ['Одно (через имя)', 'Несколько', 'Любое количество через var-параметры'], correct: 2, exp: 'Функция возвращает одно значение через имя. Но можно использовать var-параметры для дополнительных выходных значений.' },
                ]
            },
            {
                title: 'Рекурсия: практика',
                questions: [
                    { q: 'Напиши рекурсивный факториал: Fact(0) = ?', opts: ['1', '0', '-1'], correct: 0, exp: 'Базовый случай: Fact(0) = 1. Рекурсия: Fact(n) = n * Fact(n-1).' },
                    { q: 'Что такое «стек вызовов»?', opts: ['Память для хранения вложенных вызовов функций', 'Массив', 'Тип данных'], correct: 0, exp: 'Каждый вызов функции добавляет фрейм в стек. Переполнение — stack overflow.' },
                    { q: 'Fibonacci(6) = ?', code: 'Fib(1)=1, Fib(2)=1', opts: ['8', '13', '5'], correct: 0, exp: 'Fib: 1,1,2,3,5,8 — F(6)=8.' },
                    { q: 'Какова глубина рекурсии при Fact(5)?', opts: ['5 вызовов', '6 вызовов', '4 вызова'], correct: 0, exp: 'Fact(5)→Fact(4)→Fact(3)→Fact(2)→Fact(1)→Fact(0): 6 вызовов.' },
                    { q: 'Что лучше: рекурсия или цикл для факториала?', opts: ['Цикл: эффективнее по памяти', 'Рекурсия: короче', 'Оба одинаковы'], correct: 0, exp: 'Рекурсия расходует стек, итеративный подход эффективнее для факториала.' },
                ]
            },
            {
                title: 'Вложенные функции и области видимости',
                questions: [
                    { q: 'Что такое «область видимости» переменной?', opts: ['Где в коде переменная доступна', 'Размер переменной', 'Тип данных'], correct: 0, exp: 'Локальные переменные видны только внутри своей функции/процедуры.' },
                    { q: 'Может ли функция вызвать другую функцию?', opts: ['Да', 'Нет', 'Только из main'], correct: 0, exp: 'Функции могут вызывать другие функции — это основа структурного программирования.' },
                    { q: 'Где объявить вспомогательную процедуру чтобы её мог вызвать main?', opts: ['До begin главной программы', 'После begin', 'После end.'], correct: 0, exp: 'Подпрограммы объявляются до begin главного блока программы.' },
                    { q: 'Что произойдёт если использовать переменную процедуры вне её?', opts: ['Ошибка компиляции: переменная не видна', 'Вернёт 0', 'Вернёт мусор'], correct: 0, exp: 'Локальная переменная недоступна за пределами своей процедуры.' },
                    { q: 'Можно ли объявить переменную с тем же именем в процедуре и в main?', opts: ['Да, это разные переменные', 'Нет, конфликт', 'Только если разные типы'], correct: 0, exp: 'Локальная переменная «затеняет» глобальную внутри процедуры.' },
                ]
            },
            {
                title: 'Практика: подпрограммы',
                questions: [
                    { q: 'Что выведет программа?', code: 'function Max(a,b: integer): integer;\nbegin\n  if a > b then Max := a else Max := b;\nend;\nwriteln(Max(3, 7));', opts: ['7', '3', '10'], correct: 0, exp: '3 > 7 — false, возвращается b = 7.' },
                    { q: 'Как правильно объявить процедуру Swap?', opts: ['procedure Swap(var a, b: integer)', 'procedure Swap(a, b: integer)', 'function Swap(a,b: integer): integer'], correct: 0, exp: 'Swap должна менять оригиналы — нужен var для обоих параметров.' },
                    { q: 'Что выведет?', code: 'procedure Hello(n: integer);\nbegin\n  for i:=1 to n do writeln(\'Hi\');\nend;\nHello(3);', opts: ['Hi Hi Hi', 'Hi', 'Ошибка'], correct: 0, exp: 'Процедура вызывается с n=3, выводит Hi три раза.' },
                    { q: 'Зачем разбивать программу на процедуры?', opts: ['Читаемость, повторное использование, легче отлаживать', 'Только для ускорения', 'Обязательно по правилам Pascal'], correct: 0, exp: 'Структурное программирование: каждая процедура — одна задача.' },
                    { q: 'Можно ли из функции вызвать procedure?', opts: ['Да', 'Нет', 'Только если void'], correct: 0, exp: 'Функции и процедуры могут вызывать любые другие подпрограммы.' },
                ]
            },
            {
                title: 'Итоговая практика: функции',
                questions: [
                    { q: 'Напиши заголовок функции, возвращающей boolean:', opts: ['function IsEven(n: integer): boolean;', 'boolean function IsEven(n);', 'function IsEven(n): bool;'], correct: 0, exp: 'Тип возврата указывается после параметров через двоеточие.' },
                    { q: 'Что выведет?', code: 'function Cube(x: integer): integer;\nbegin Cube := x * x * x; end;\nwriteln(Cube(3));', opts: ['27', '9', '6'], correct: 0, exp: '3³ = 3 × 3 × 3 = 27.' },
                    { q: 'Как использовать функцию в выражении?', opts: ['writeln(Max(a,b) + Min(a,b))', 'result = Max(a,b); writeln(result + Min(a,b))', 'Оба варианта верны'], correct: 2, exp: 'Функцию можно встраивать в выражение или сначала сохранить результат.' },
                    { q: 'Что такое «побочный эффект» функции?', opts: ['Изменение внешних данных (не через возврат)', 'Возвращаемое значение', 'Ошибка компиляции'], correct: 0, exp: 'Побочный эффект: функция меняет глобальные переменные или выводит данные помимо возврата.' },
                    { q: 'Как рекурсивно посчитать сумму 1+2+...+n?', opts: ['if n=0 then Sum:=0 else Sum:=n+Sum(n-1)', 'for i:=1 to n', 'Sum := n*(n+1) div 2'], correct: 0, exp: 'Рекурсия: Sum(n) = n + Sum(n-1), базовый случай Sum(0) = 0.' },
                ]
            },
        ],
        trophyQuestions: [
            { type: 'type', q: 'Ключевое слово для подпрограммы без возврата:', code: '___ Greet; begin writeln(\'Hi\'); end;', answer: 'procedure', chips: ['procedure', 'function', 'sub', 'def'], exp: 'procedure — подпрограмма без возврата значения.' },
            { type: 'type', q: 'Как вернуть значение из функции Sum?', code: 'function Sum(a,b:integer):integer;\nbegin\n  ___ := a + b;\nend;', answer: 'Sum', chips: ['Sum', 'result', 'return', 'exit'], exp: 'Результат присваивается имени функции.' },
            { type: 'type', q: 'Параметр с передачей по ссылке:', code: 'procedure Double(___ x: integer);', answer: 'var', chips: ['var', 'ref', 'out', 'const'], exp: 'var-параметр изменяет оригинальную переменную.' },
            { type: 'type', q: 'Получить длину строки:', code: 'n := ___(s);', answer: 'length', chips: ['length', 'len', 'size', 'count'], exp: 'length(s) — длина строки.' },
            { type: 'fix', q: 'Исправь функцию возведения в квадрат:', code: 'function Square(x:integer):integer;\nbegin\n  result := x * x;\nend;', answer: 'function Square(x:integer):integer;\nbegin\n  Square := x * x;\nend;', chips: ['Square', 'result', 'x * x', 'function', 'integer'], exp: 'Результат присваивается имени функции, не result.' },
        ]
    },
];

// Build flat lessonsData for current module
function getLessonsForModule(mIdx) {
    return MODULES[mIdx].lessons;
}

// ─── TROPHY QUESTIONS now embedded in MODULES[i].trophyQuestions ────────────

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────
const ACHIEVEMENTS = {
    modules: [
        { id: 'mod0_done', icon: '📘', name: 'Новичок-паскальщик', desc: 'Пройди модуль 1', check: () => MODULES[0].lessons.every((_, i) => lessonCompleted[0][i]) && trophyTestDone[0] },
        { id: 'mod1_done', icon: '🔀', name: 'Логик', desc: 'Пройди модуль 2', check: () => MODULES[1].lessons.every((_, i) => lessonCompleted[1][i]) && trophyTestDone[1] },
        { id: 'mod2_done', icon: '🔁', name: 'Циклопед', desc: 'Пройди модуль 3', check: () => MODULES[2].lessons.every((_, i) => lessonCompleted[2][i]) && trophyTestDone[2] },
        { id: 'mod3_done', icon: '📦', name: 'Архивариус', desc: 'Пройди модуль 4', check: () => MODULES[3].lessons.every((_, i) => lessonCompleted[3][i]) && trophyTestDone[3] },
        { id: 'mod4_done', icon: '⚙️', name: 'Программист', desc: 'Пройди модуль 5', check: () => MODULES[4].lessons.every((_, i) => lessonCompleted[4][i]) && trophyTestDone[4] },
        { id: 'all_modules', icon: '🌟', name: 'Мастер Pascal', desc: 'Пройди все 5 модулей', check: () => MODULES.every((m, mi) => m.lessons.every((_, i) => lessonCompleted[mi][i]) && trophyTestDone[mi]) },
    ],
    xp: [
        { id: 'xp50', icon: '⚡', name: 'Первый разряд', desc: '50 XP', check: () => xp >= 50 },
        { id: 'xp200', icon: '💡', name: 'Заряженный', desc: '200 XP', check: () => xp >= 200 },
        { id: 'xp500', icon: '💥', name: 'Взрывной', desc: '500 XP', check: () => xp >= 500 },
        { id: 'xp1000', icon: '🌠', name: 'Звёздный', desc: '1000 XP', check: () => xp >= 1000 },
        { id: 'xp2000', icon: '🚀', name: 'Космонавт', desc: '2000 XP', check: () => xp >= 2000 },
    ],
    streak: [
        { id: 'streak3', icon: '🔥', name: 'Горячо!', desc: '3 дня подряд', check: () => true },
        { id: 'no_errors', icon: '💎', name: 'Без ошибок', desc: 'Пройди урок идеально', check: () => MODULES.some((m, mi) => m.lessons.some((_, i) => lessonCompleted[mi][i])) },
        { id: 'speed_run', icon: '⚡', name: 'Спринтер', desc: 'Пройди урок быстро', check: () => MODULES.some((m, mi) => m.lessons.some((_, i) => lessonCompleted[mi][i])) },
        { id: 'hard_test', icon: '🏅', name: 'Испытание', desc: 'Пройди любой финальный тест', check: () => trophyTestDone.some(Boolean) },
        { id: 'all_tests', icon: '👑', name: 'Экзаменатор', desc: 'Пройди все 5 тестов', check: () => trophyTestDone.every(Boolean) },
    ],
    mastery: [
        { id: 'first_lesson', icon: '📖', name: 'Первый шаг', desc: 'Пройди первый урок', check: () => lessonCompleted[0][0] },
        { id: 'typed_right', icon: '⌨️', name: 'Клавишник', desc: 'Правильно введи ответ в тесте', check: () => trophyTestDone.some(Boolean) },
        { id: 'trophy_perfect', icon: '🌠', name: 'Перфекционист', desc: 'Пройди финальный тест без ошибок', check: () => perfectTests.some(Boolean) },
        { id: 'all_lessons', icon: '🎓', name: 'Выпускник', desc: 'Пройди все уроки всех модулей', check: () => MODULES.every((m, mi) => m.lessons.every((_, i) => lessonCompleted[mi][i])) },
        { id: 'completionist', icon: '🏆', name: 'Абсолютный', desc: 'Пройди всё на 100%', check: () => MODULES.every((m, mi) => m.lessons.every((_, i) => lessonCompleted[mi][i])) && trophyTestDone.every(Boolean) },
        { id: 'perfect_all', icon: '💯', name: 'Мастер без ошибок', desc: 'Пройди ВСЕ уроки без единой ошибки', check: () => MODULES.every((m, mi) => m.lessons.every((_, i) => perfectLessons[mi][i])) },
        { id: 'perfect_test', icon: '🌠', name: 'Перфекционист теста', desc: 'Пройди финальный тест без ошибок', check: () => perfectTests.some(Boolean) },
        { id: 'perfect_all_tests', icon: '🌌', name: 'Абсолютный перфекционист', desc: 'Все тесты без единой ошибки', check: () => perfectTests.every(Boolean) },
    ]
};

const TITLES = [
    { id: 'newbie', icon: '🌱', name: 'Новичок', req: 'Начни учиться', reqXP: 0, check: () => true },
    { id: 'coder', icon: '💻', name: 'Кодер', req: 'Пройди первый урок', reqXP: 0, check: () => lessonCompleted[0][0] },
    { id: 'logician', icon: '🔀', name: 'Логик', req: 'Пройди модуль «Условия»', reqXP: 0, check: () => trophyTestDone[1] },
    { id: 'looper', icon: '🔁', name: 'Циклопед', req: 'Пройди модуль «Циклы»', reqXP: 0, check: () => trophyTestDone[2] },
    { id: 'archivist', icon: '📦', name: 'Архивариус', req: 'Пройди модуль «Массивы»', reqXP: 0, check: () => trophyTestDone[3] },
    { id: 'champion', icon: '🏆', name: 'Чемпион', req: 'Пройди первый финальный тест', reqXP: 0, check: () => trophyTestDone[0] },
    { id: 'engineer', icon: '⚙️', name: 'Инженер', req: 'Пройди модуль «Функции»', reqXP: 0, check: () => trophyTestDone[4] },
    { id: 'master', icon: '🎓', name: 'Мастер Pascal', req: 'Пройди все 5 модулей', reqXP: 0, check: () => trophyTestDone.every(Boolean) },
    { id: 'perfectionist', icon: '💯', name: 'Перфекционист', req: 'Пройди все уроки без ошибок', reqXP: 0, check: () => MODULES.every((m, mi) => m.lessons.every((_, i) => perfectLessons[mi][i])) },
    { id: 'legend', icon: '⚡', name: 'Легенда', req: '500 XP', reqXP: 500, check: () => xp >= 500 },
    { id: 'star', icon: '🌟', name: 'Звезда', req: '1000 XP', reqXP: 1000, check: () => xp >= 1000 },
    { id: 'dev_blood', icon: '👑', name: 'Основатель', req: '🔒 Только для разрабов', reqXP: 0, check: () => unlockedSecrets.has(8), neon: 'blood', secret: true },
    { id: 'dev_tech', icon: '⚙️', name: 'Разработчик', req: '🔒 Только для разрабов', reqXP: 0, check: () => unlockedSecrets.has(7), neon: 'tech', secret: true },
];

// Rewards unlocked for completing modules
const MODULE_REWARDS = [
    { id: 'rew_m1', icon: '🎨', name: 'Набор «Основы»', desc: 'Разблокирован наряд Синяя футболка', check: () => trophyTestDone[0] },
    { id: 'rew_m2', icon: '🎽', name: 'Набор «Условия»', desc: 'Разблокирован наряд Худи', check: () => trophyTestDone[1] },
    { id: 'rew_m3', icon: '🛡️', name: 'Набор «Циклы»', desc: 'Разблокирована броня', check: () => trophyTestDone[2] },
    { id: 'rew_m4', icon: '👑', name: 'Набор «Массивы»', desc: 'Разблокирована корона Короля', check: () => trophyTestDone[3] },
    { id: 'rew_m5', icon: '🥷', name: 'Набор «Функции»', desc: 'Разблокирован наряд Ниндзя', check: () => trophyTestDone[4] },
    { id: 'rew_all', icon: '🌟', name: 'Мастер-комплект', desc: 'Разблокирована Галактика + Лунная маска', check: () => trophyTestDone.every(Boolean) },
];

// Outfit indices unlocked per module completion
const MODULE_OUTFIT_UNLOCKS = {
    0: 1,  // blue tshirt
    1: 2,  // hoodie
    2: 4,  // armor
    3: 7,  // king
    4: 5,  // ninja
};

// Bg/mask unlocks
const MODULE_EXTRA_UNLOCKS = {
    4: { bg: 6, mask: 2 }, // module 5 unlocks galaxy + moon mask
};



// ─── UTILS ────────────────────────────────────────────────────────────────────
function shuffle(arr) {
    let a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function actClick() { if (!answered) checkAnswer(); }
window.actClick = actClick

function showToast(msg, duration = 1500) {
    window.notification.success(msg)
    return

    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration);
}

function updateStats() {
    /*document.getElementById('h-count').textContent = hearts;
    document.getElementById('h-lesson').textContent = hearts;
    document.getElementById('g-count').textContent = xp;
    document.getElementById('p-xp').textContent = xp;*/
    const totalLessons = MODULES.reduce((s, m) => s + m.lessons.length, 0);
    const doneLessons = MODULES.reduce((s, m, mi) => s + m.lessons.filter((_, i) => lessonCompleted[mi][i]).length, 0);
    //document.getElementById('p-lessons').textContent = `${doneLessons}/${totalLessons}`;
    const curL = getCurrentLeague ? getCurrentLeague() : null;
    const lEl = document.getElementById('p-league-val');
    if (lEl && curL) { lEl.textContent = curL.name.slice(0, 6); lEl.style.color = curL.color; }
    updateOverallStats();
}

function updateOverallStats() {
    const totalLessons = MODULES.reduce((s, m) => s + m.lessons.length, 0);
    const doneLessons = MODULES.reduce((s, m, mi) => s + m.lessons.filter((_, i) => lessonCompleted[mi][i]).length, 0);
    const totalTests = MODULES.length;
    const doneTests = trophyTestDone.filter(Boolean).length;
    const perfectL = MODULES.reduce((s, m, mi) => s + m.lessons.filter((_, i) => perfectLessons[mi][i]).length, 0);

    const lessonsPct = totalLessons ? Math.round(doneLessons / totalLessons * 100) : 0;
    const testsPct = totalTests ? Math.round(doneTests / totalTests * 100) : 0;
    const perfectPct = totalLessons ? Math.round(perfectL / totalLessons * 100) : 0;
    const totalPct = Math.round((lessonsPct * 0.5 + testsPct * 0.3 + perfectPct * 0.2));

    const el = id => document.getElementById(id);
    if (el('stat-lessons-pct')) el('stat-lessons-pct').textContent = lessonsPct + '%';
    if (el('stat-tests-pct')) el('stat-tests-pct').textContent = testsPct + '%';
    if (el('stat-perfect-pct')) el('stat-perfect-pct').textContent = perfectPct + '%';
    if (el('stat-total-bar')) el('stat-total-bar').style.width = totalPct + '%';
    if (el('stat-total-label')) el('stat-total-label').textContent = 'Общий прогресс: ' + totalPct + '%';
}

// ─── HOME / MODULES ───────────────────────────────────────────────────────────
function renderModulesList() {
    const el = document.getElementById('pascalModules');
    const totalDone = MODULES.reduce((s, m, mi) => s + (trophyTestDone[mi] ? 1 : 0), 0);
    let html = `<div class="modules-header">
    <p>${totalDone} из ${MODULES.length} модулей пройдено</p>
  </div>`;
    MODULES.forEach((m, mi) => {
        const lessons = m.lessons;
        const doneLessons = lessons.filter((_, li) => lessonCompleted[mi][li]).length;
        const perfectDoneLessons = lessons.filter((_, li) => perfectLessons[mi][li]).length;
        const pct = Math.round(doneLessons / lessons.length * 100);
        const modDone = trophyTestDone[mi];
        const unlocked = mi === 0 || trophyTestDone[mi - 1];
        const isActive = !modDone && unlocked;
        const cls = modDone ? 'completed' : (unlocked ? 'unlocked' : 'locked-mod');
        const badge = modDone
            ? `<div class="mod-badge" style="background:var(--gold);color:#000;">✓ ПРОЙДЕН</div>`
            : (!unlocked
                ? `<div class="mod-badge" style="background:var(--surface-light);color:var(--text-muted);">🔒</div>`
                : `<div class="mod-badge" style="background:rgba(88,204,2,0.15);color:var(--primary);">АКТИВЕН</div>`);
        html += `<div class="module-card ${cls}" onclick="${unlocked ? `window.changePage('langmodule', 'pascal-${mi}'); openModule(${mi})` : ''}">
      <div class="mod-accent" style="background:${m.color};"></div>
      <div class="mod-row">
        <div class="mod-icon">${m.icon}</div>
        <div class="mod-info">
          <div class="mod-num">МОДУЛЬ ${mi + 1}</div>
          <div class="mod-title">${m.title}</div>
          <div class="mod-desc">${m.desc}</div>
          <div class="mod-xp-reward">⚡ +${m.xpReward} XP</div>
        </div>
      </div>
      ${badge}
      <div class="mod-prog">
        <div class="mod-prog-bar" style="position:relative;height:10px;">
          <div class="mod-prog-fill" style="width:${pct}%;background:${m.color};height:100%;border-radius:8px;position:absolute;"></div>
        </div>
        <div class="mod-prog-label" style="display:flex;justify-content:space-between;align-items:center;">
          <span>${doneLessons}/${lessons.length} уроков ${modDone ? '• ✓ Тест' : ''}</span>
          ${perfectDoneLessons > 0 ? `<span style="color:#9B59B6;font-size:11px;font-weight:800;">⭐ ${perfectDoneLessons} идеально</span>` : ''}
        </div>
      </div>
    </div>`;
    });
    el.innerHTML = html;
}

function openModule(mi) {
    currentModuleIdx = mi;
    //document.getElementById('module-path-view').style.display = 'block';
    const m = MODULES[mi];
    document.querySelector('#langmodule .page-header h1').textContent = `${m.icon} ${m.title}`;
    const _mpDone = m.lessons.filter((_, li) => lessonCompleted[mi][li]).length;
    const _mpPct = Math.round(_mpDone / m.lessons.length * 100);
    const _mpPerfect = m.lessons.filter((_, li) => perfectLessons[mi][li]).length;
    document.querySelector('#langmodule .page-header h3').textContent = `Модуль ${mi + 1} • ${_mpPct}% пройдено${_mpPerfect > 0 ? ' • ⭐ ' + _mpPerfect + ' идеально' : ''}`;
    renderPath();
}
window.openModule = openModule

function backToModules() {
    document.getElementById('module-path-view').style.display = 'none';
    document.getElementById('modules-list-view').style.display = 'block';
    renderModulesList();
}

function renderPath() {
    const container = document.getElementById('path-container');
    const m = MODULES[currentModuleIdx];
    let html = '';
    m.lessons.forEach((lesson, i) => {
        const done = lessonCompleted[currentModuleIdx][i];
        const perfect = perfectLessons[currentModuleIdx][i];
        const unlocked = i === 0 || lessonCompleted[currentModuleIdx][i - 1];
        const status = done ? 'done' : unlocked ? 'active' : 'locked';
        const icon = perfect ? '💎' : done ? '⭐' : status === 'active' ? '▶' : '🔒';
        const clickHandler = status !== 'locked' ? `startLesson(${i})` : '';
        html += `<div class="node-wrap">
      <div class="node ${status}" onclick="${clickHandler}">${icon}</div>
      <div class="lesson-label">${lesson.title}</div>
    </div>`;
    });
    const allDone = m.lessons.every((_, i) => lessonCompleted[currentModuleIdx][i]);
    html += `<div class="node-wrap">
    <div class="node trophy-node ${allDone ? '' : 'locked'}" onclick="${allDone ? 'startTrophyTest()' : ''}">🏆</div>
    <div class="lesson-label">Финальный тест</div>
  </div>`;
    container.innerHTML = html;
}

function showScreen(id) {
    window.changePage(id)
    return
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'scr-home') { renderModulesList(); updateStats(); }
}

function goHome(el) {
    playClick();
    showScreenAnimated('scr-home');
    const lv = document.getElementById('modules-list-view');
    const pv = document.getElementById('module-path-view');
    if (lv) lv.style.display = 'block';
    if (pv) pv.style.display = 'none';
    renderModulesList(); updateStats();
    navActive(el);
}
function goProfile(el) {
    playClick();
    showScreenAnimated('scr-profile');
    updateStats(); renderProfileScreen();
    navActive(el);
}
function goLeague(el) {
    playClick();
    navActive(el);
    showScreenAnimated('scr-league');
    try { renderLeagueScreen(); } catch (e) { console.error('league error', e); }
}
function goAchievements(el) {
    playClick();
    navActive(el);
    showScreenAnimated('scr-ach');
    try { renderAchievements(); } catch (e) { console.error('ach error', e); }
}

function navActive(el) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');
}

// ─── LESSON LOGIC ─────────────────────────────────────────────────────────────
function startLesson(idx) {
    currentLessonIdx = idx;
    currentQIdx = 0;
    hearts = 3;
    lessonErrors = 0;
    errorQuestions = [];
    isReviewMode = false;
    reviewRound = 0;
    answered = false;
    updateStats();
    shuffledQuestions = shuffle(MODULES[currentModuleIdx].lessons[idx].questions);
    if (!document.querySelector('#lesson .page-header-btns .lefthead .progress-track')) {
        document.querySelector('#lesson .page-header-btns .lefthead').innerHTML = `
            <div class="progress-track">
                <div class="progress-fill" id="prog" style="width: 0%;"></div>
            </div>
            <div class="hearts-lesson">❤️ <span id="h-lesson">3</span></div>
        `
    }
    window.changePage('lesson', idx)
    //document.querySelector('.nav').style.display = 'none';
    renderQuestion();
}
window.startLesson = startLesson

function closeLesson() {
    document.querySelector('.nav').style.display = 'flex';
    showScreen('scr-home');
    openModule(currentModuleIdx);
    navActive(document.getElementById('nav-home'));
}

function resetUI() {
    selectedOption = null;
    answered = false;
    const act = document.getElementById('act-area');
    act.innerHTML = `<button class="btn go" id="act-btn" onclick="actClick()" disabled>ПРОВЕРИТЬ</button>`;
    act.classList.add('show');
}

let currentShuffledCorrect = 0;

function renderQuestion() {
    const q = isReviewMode ? errorQuestions[currentQIdx] : shuffledQuestions[currentQIdx];
    const total = isReviewMode ? errorQuestions.length : shuffledQuestions.length;
    const area = document.getElementById('q-area');
    document.getElementById('prog').style.width = `${(currentQIdx / total) * 100}%`;
    const safeCode = q.code ? q.code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    const m = MODULES[currentModuleIdx];

    // Shuffle the answer options and track new correct index
    const indices = q.opts.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const shuffledOpts = indices.map(i => q.opts[i]);
    currentShuffledCorrect = indices.indexOf(q.correct);

    const reviewBanner = isReviewMode
        ? `<div style="background:rgba(255,75,75,0.12);border:1.5px solid var(--danger);border-radius:12px;padding:8px 14px;margin-bottom:14px;font-size:13px;font-weight:800;color:var(--danger);">🔁 Исправь ошибку! ${currentQIdx + 1} из ${total}</div>`
        : '';

    area.innerHTML = `
    ${reviewBanner}
    <div class="mascot-row">
      <svg class="golem-svg" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="12" width="48" height="40" rx="12" fill="#4A41C0"/>
        <rect x="18" y="22" width="10" height="10" rx="4" fill="#00E5FF"/>
        <rect x="36" y="22" width="10" height="10" rx="4" fill="#00E5FF"/>
        <path d="M28 38 Q32 42 36 38" stroke="#00E5FF" stroke-width="3" fill="none"/>
        <circle cx="52" cy="18" r="4" fill="#FFC800" opacity="0.8"/>
      </svg>
      <div class="bubble">${isReviewMode ? '🔁 Исправь ошибки!' : `Вопрос ${currentQIdx + 1} из ${total}`}</div>
    </div>
    <div class="q-title">${q.q}</div>
    ${safeCode ? `<div class="code-box">${safeCode}</div>` : ''}
    <div class="opts" id="opts-container">
      ${shuffledOpts.map((o, i) => `<button class="opt" onclick="selectOption(${i})">${o}</button>`).join('')}
    </div>
  `;
    resetUI();
}
window.renderQuestion = renderQuestion

function selectOption(idx) {
    if (answered) return;
    selectedOption = idx;
    document.querySelectorAll('.opt').forEach((b, i) => b.classList.toggle('sel', i === idx));
    document.getElementById('act-btn').disabled = false;
}
window.selectOption = selectOption

function checkAnswer() {
    if (answered || selectedOption === null) return;
    answered = true;
    const q = isReviewMode ? errorQuestions[currentQIdx] : shuffledQuestions[currentQIdx];
    const btns = document.querySelectorAll('.opt');
    const act = document.getElementById('act-area');
    document.getElementById('opts-container').classList.add('answered');
    if (selectedOption === currentShuffledCorrect) {
        btns[selectedOption].classList.add('ok');
        xp += 10;
        updateStats();
        flashCorrect(btns[selectedOption]);
        showXPPopup(10);
        act.innerHTML = `
      <div style="color:var(--primary);font-weight:800;font-size:18px;margin-bottom:10px;">✅ Верно!</div>
      <button class="btn go" onclick="nextQuestion()">ДАЛЕЕ</button>`;
    } else {
        btns[selectedOption].classList.add('err');
        btns[currentShuffledCorrect].classList.add('ok');
        hearts = Math.max(0, hearts - 1);
        lessonErrors++;
        updateStats();
        flashWrong(btns[selectedOption]);
        // Track error question for review
        if (!isReviewMode) {
            errorQuestions.push(q);
        } else {
            q._hadErrorThisRound = true; // mark for next loop iteration
        }
        if (hearts === 0) {
            // In review mode — finish lesson anyway (no hearts but tried)
            if (isReviewMode) {
                act.innerHTML = `
          <div style="color:var(--danger);font-weight:800;font-size:18px;margin-bottom:4px;">💔 Нет сердец!</div>
          <div style="color:var(--text-muted);font-size:14px;margin-bottom:14px;">Закончились сердца. Урок завершён.</div>
          <button class="btn bad" onclick="nextQuestion()">ЗАВЕРШИТЬ УРОК</button>`;
                act.classList.add('show');
                return;
            }
            act.innerHTML = `
        <div style="color:var(--danger);font-weight:800;font-size:18px;margin-bottom:4px;">💔 Нет сердец!</div>
        <div style="color:var(--text-muted);font-size:14px;margin-bottom:14px;">Урок начнётся заново.</div>
        <button class="btn bad" onclick="startLesson(${currentLessonIdx})">НАЧАТЬ ЗАНОВО</button>`;
            act.classList.add('show');
            return;
        }
        act.innerHTML = `
      <div style="color:var(--danger);font-weight:800;font-size:18px;margin-bottom:4px;">❌ Ошибка</div>
      <div style="color:var(--text-muted);font-size:14px;margin-bottom:14px;line-height:1.4;">💡 ${q.exp}</div>
      <button class="btn bad" onclick="nextQuestion()">ПРОДОЛЖИТЬ</button>`;
    }
    act.classList.add('show');
}

function _showReviewTransition(count, round) {
    const area = document.getElementById('q-area');
    const msg = round === 1
        ? `Ты допустил ${count} ошибок(-ку). Исправляй — пока не ответишь правильно!`
        : `Ещё ${count} вопрос(-ов) неверно. Продолжай!`;
    area.innerHTML = `
    <div style="text-align:center;padding:30px 10px;">
      <div style="font-size:64px;margin-bottom:16px;">🔁</div>
      <div style="font-size:22px;font-weight:900;margin-bottom:10px;color:var(--danger);">Исправим ошибки!</div>
      <div style="font-size:15px;color:var(--text-muted);line-height:1.6;">${msg}</div>
      <div style="margin-top:14px;font-size:13px;color:var(--text-muted);">Осталось сердец: ${hearts}</div>
    </div>`;
    const act = document.getElementById('act-area');
    act.innerHTML = '<button class="btn go" onclick="renderQuestion()">НАЧАТЬ ИСПРАВЛЕНИЕ</button>';
    act.classList.add('show');
    document.getElementById('prog').style.width = '0%';
}

function _finishLesson() {
    const isPerfect = lessonErrors === 0;
    if (isPerfect) perfectLessons[currentModuleIdx][currentLessonIdx] = true;
    lessonCompleted[currentModuleIdx][currentLessonIdx] = true;
    saveState();
    xp += 20;
    updateStats();
    vibrateSuccess(); playLevelUp();
    showXPPopup(20);
    showScreenAnimated('scr-home');
    openModule(currentModuleIdx);
    const mTitle = MODULES[currentModuleIdx].lessons[currentLessonIdx].title;
    const perfMsg = isPerfect ? ' ⭐ Идеально!' : '';
    showToast('🏅 Урок «' + mTitle + '» пройден! +20 XP' + perfMsg, 2200);
    window.changePage('langmodule')
    checkNewAchievements();
}

function nextQuestion() {
    currentQIdx++;
    const total = isReviewMode ? errorQuestions.length : shuffledQuestions.length;
    if (currentQIdx < total) {
        renderQuestion();
    } else if (!isReviewMode && errorQuestions.length > 0) {
        isReviewMode = true;
        reviewRound = 1;
        currentQIdx = 0;
        hearts = Math.min(hearts + 1, 3);
        updateStats();
        _showReviewTransition(errorQuestions.length, 1);
    } else if (isReviewMode) {
        const newErrors = errorQuestions.filter(q => q._hadErrorThisRound);
        errorQuestions.forEach(q => delete q._hadErrorThisRound);
        if (newErrors.length > 0 && hearts > 0) {
            errorQuestions = newErrors;
            reviewRound++;
            currentQIdx = 0;
            updateStats();
            _showReviewTransition(newErrors.length, reviewRound);
        } else {
            _finishLesson();
        }
    } else {
        _finishLesson();
    }
}
window.nextQuestion = nextQuestion


function finishModule() {
    showScreen('scr-home');
    navActive(document.getElementById('nav-home'));
}

// ─── TROPHY TEST ──────────────────────────────────────────────────────────────
function startTrophyTest() {
    trophyQuestions = shuffle(MODULES[currentModuleIdx].trophyQuestions);
    trophyQIdx = 0;
    trophyHearts = 3;
    trophyErrors = 0;
    trophyCorrect = 0;
    trophyAnswered = false;
    trophyTypedAnswer = '';
    showScreen('scr-trophy');
    document.querySelector('.nav').style.display = 'none';
    renderTrophyQuestion();
}

function closeTrophy() {
    document.querySelector('.nav').style.display = 'flex';
    showScreen('scr-home');
    openModule(currentModuleIdx);
    navActive(document.getElementById('nav-home'));
}

function trophyActClick() {
    if (!trophyAnswered) checkTrophyAnswer();
}

function updateTrophyHead() {
    document.getElementById('trophy-prog').style.width = `${(trophyQIdx / trophyQuestions.length) * 100}%`;
    document.getElementById('trophy-hearts-disp').textContent = `❤️${trophyHearts}`;
}

function renderTrophyQuestion() {
    const q = trophyQuestions[trophyQIdx];
    trophyAnswered = false;
    trophyTypedAnswer = '';
    updateTrophyHead();
    const area = document.getElementById('trophy-area');
    const safeCode = q.code ? q.code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    area.innerHTML = `
    <div class="trophy-q-label">Вопрос ${trophyQIdx + 1} / ${trophyQuestions.length}</div>
    <div class="trophy-q-title">${q.q}</div>
    ${safeCode ? `<div class="code-box">${safeCode}</div>` : ''}
    <div style="margin-bottom:12px;">
      <div style="font-size:11px;font-weight:800;color:var(--text-muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Твой ответ:</div>
      <div class="type-input-wrap">
        <input type="text" class="type-input" id="trophy-type-input"
          placeholder="Введи ответ..."
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          oninput="onTrophyType(this)"
          onkeydown="if(event.key==='Enter' && !trophyAnswered) checkTrophyAnswer()"/>
      </div>
    </div>
    <div style="font-size:11px;font-weight:800;color:var(--text-muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Подсказки:</div>
    <div class="hint-chips" id="hint-chips-row">
      ${q.chips.map((c, i) => `<div class="hint-chip" onclick="insertChip('${c.replace(/'/g, "\\'")}', ${i})" id="chip-${i}">${c}</div>`).join('')}
    </div>`;
    resetTrophyAct();
    setTimeout(() => { const inp = document.getElementById('trophy-type-input'); if (inp) inp.focus(); }, 200);
}

function resetTrophyAct() {
    const act = document.getElementById('trophy-act-area');
    act.innerHTML = `<button class="btn trophy-btn" id="trophy-act-btn" onclick="trophyActClick()" disabled>ПРОВЕРИТЬ</button>`;
    act.classList.add('show');
}

function onTrophyType(inp) {
    trophyTypedAnswer = inp.value;
    document.getElementById('trophy-act-btn').disabled = inp.value.trim().length === 0;
}

function insertChip(text, idx) {
    const inp = document.getElementById('trophy-type-input');
    if (!inp || trophyAnswered) return;
    inp.value = (inp.value + ' ' + text).trim();
    trophyTypedAnswer = inp.value;
    document.getElementById(`chip-${idx}`).classList.add('used');
    document.getElementById('trophy-act-btn').disabled = false;
    inp.focus();
}

function normalizeAnswer(s) {
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function checkTrophyAnswer() {
    if (trophyAnswered) return;
    const inp = document.getElementById('trophy-type-input');
    const userAns = normalizeAnswer(inp ? inp.value : trophyTypedAnswer);
    const q = trophyQuestions[trophyQIdx];
    const correct = normalizeAnswer(q.answer);
    trophyAnswered = true;
    const act = document.getElementById('trophy-act-area');
    if (inp) inp.disabled = true;
    if (userAns === correct) {
        trophyCorrect++;
        xp += 15;
        updateStats();
        if (inp) inp.classList.add('ok');
        flashCorrect(inp || document.getElementById('trophy-area'));
        showXPPopup(15);
        act.innerHTML = `
      <div style="color:var(--primary);font-weight:800;font-size:17px;margin-bottom:4px;">✅ Верно!</div>
      <div style="color:var(--text-muted);font-size:13px;margin-bottom:12px;line-height:1.4;">💡 ${q.exp}</div>
      <button class="btn trophy-btn" onclick="nextTrophyQuestion()">ДАЛЕЕ</button>`;
    } else {
        trophyErrors++;
        trophyHearts = Math.max(0, trophyHearts - 1);
        updateTrophyHead();
        if (inp) inp.classList.add('err');
        flashWrong(inp || document.getElementById('trophy-area'));
        act.innerHTML = `
      <div style="color:var(--danger);font-weight:800;font-size:17px;margin-bottom:4px;">❌ Ошибка</div>
      <div style="color:var(--text-muted);font-size:13px;margin-bottom:4px;">Правильный ответ: <span style="color:var(--primary);font-family:monospace;">${q.answer}</span></div>
      <div style="color:var(--text-muted);font-size:13px;margin-bottom:12px;line-height:1.4;">💡 ${q.exp}</div>
      <button class="btn bad" onclick="nextTrophyQuestion()">ПРОДОЛЖИТЬ</button>`;
    }
    act.classList.add('show');
}

function nextTrophyQuestion() {
    trophyQIdx++;
    if (trophyQIdx < trophyQuestions.length) {
        renderTrophyQuestion();
    } else {
        showTrophyResult();
    }
}

function showTrophyResult() {
    const m = MODULES[currentModuleIdx];
    const passed = trophyErrors <= 3;
    const stars = trophyErrors === 0 ? 3 : trophyErrors <= 2 ? 2 : 1;
    const starStr = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    const bonusXP = m.xpReward;
    const totalQ = trophyQuestions.length;
    const pct = Math.round((trophyCorrect / totalQ) * 100);
    const pctColor = pct === 100 ? 'var(--primary)' : pct >= 80 ? 'var(--gold)' : pct >= 60 ? 'var(--secondary)' : 'var(--danger)';
    const area = document.getElementById('trophy-area');
    trophyTestDone[currentModuleIdx] = true;
    if (trophyErrors === 0) perfectTests[currentModuleIdx] = true;
    xp += bonusXP;
    updateStats();
    saveState();
    checkNewAchievements();
    vibrateSuccess(); playLevelUp();
    showXPPopup(bonusXP);
    unlockModuleRewards(currentModuleIdx);
    area.innerHTML = `
    <div class="trophy-result-box">
      <span class="big-icon">${passed ? '🏆' : '💪'}</span>
      <h2 style="color:${passed ? 'var(--gold)' : 'var(--text)'};">${passed ? 'Модуль пройден!' : 'Неплохо!'}</h2>
      <div class="score-stars">${starStr}</div>
      <div style="margin:12px 0 6px;font-size:42px;font-weight:900;color:${pctColor};">${pct}%</div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">правильных ответов</div>
      <div class="trophy-score-detail">
        <div class="trophy-score-item"><div class="ts-val" style="color:var(--primary);">${trophyCorrect}</div><div class="ts-lbl">ВЕРНО</div></div>
        <div class="trophy-score-item"><div class="ts-val" style="color:var(--danger);">${trophyErrors}</div><div class="ts-lbl">ОШИБОК</div></div>
        <div class="trophy-score-item"><div class="ts-val" style="color:var(--gold);">+${bonusXP}</div><div class="ts-lbl">БОНУС XP</div></div>
      </div>
      <p style="color:var(--text-muted);margin:10px 0 4px;">Завершён: <strong style="color:${m.color};">${m.icon} ${m.title}</strong></p>
      <p style="color:var(--text-muted);font-size:13px;">Наряд разблокирован в редакторе персонажа!</p>
      <button class="btn trophy-btn" style="margin-top:20px;" onclick="closeTrophyFinish()">НА КАРТУ КУРСА</button>
    </div>`;
    const act = document.getElementById('trophy-act-area');
    act.innerHTML = '';
    act.classList.remove('show');
}

function unlockModuleRewards(mi) {
    // unlock outfit
    // Outfit reqXP is bypassed if module completed
    // We just track via lessonCompleted/trophyTestDone, the outfit grid already checks xp
    // For extra unlocks (galaxy bg, moon mask)
    if (MODULE_EXTRA_UNLOCKS[mi]) {
        // These are available in char customizer by req logic
    }
}

function closeTrophyFinish() {
    document.querySelector('.nav').style.display = 'flex';
    showScreen('scr-home');
    backToModules();
    navActive(document.getElementById('nav-home'));
}

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────
function checkNewAchievements() {
    if (!profileData.equippedTitleId) {
        let bestTitle = null;
        TITLES.forEach(t => { if (!t.secret && t.check()) bestTitle = t; });
        if (bestTitle) profileData.equippedTitleId = bestTitle.id;
    }
    updateEquippedTitle();
}

function countUnlocked() {
    return [...ACHIEVEMENTS.modules, ...ACHIEVEMENTS.xp, ...ACHIEVEMENTS.streak, ...ACHIEVEMENTS.mastery]
        .filter(a => a.check()).length;
}

function renderAchievements() {
    const total = Object.values(ACHIEVEMENTS).reduce((s, arr) => s + arr.length, 0);
    document.getElementById('ach-count-label').textContent = `${countUnlocked()} из ${total} разблокировано`;

    function renderGroup(arr, elId) {
        const el = document.getElementById(elId);
        el.innerHTML = arr.map(a => {
            const ok = a.check();
            return `<div class="ach-card ${ok ? 'unlocked' : 'locked-ach'}">
        ${!ok ? '<div class="ach-locked-icon">🔒</div>' : ''}
        <span class="ach-icon">${a.icon}</span>
        <div class="ach-name">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
      </div>`;
        }).join('');
    }
    renderGroup(ACHIEVEMENTS.modules, 'ach-grid-modules');
    renderGroup(ACHIEVEMENTS.xp, 'ach-grid-xp');
    renderGroup(ACHIEVEMENTS.streak, 'ach-grid-streak');
    renderGroup(ACHIEVEMENTS.mastery, 'ach-grid-mastery');

    // Titles
    const tList = document.getElementById('titles-list');
    tList.innerHTML = TITLES.map(t => {
        const ok = t.check();
        const equipped = profileData.equippedTitleId === t.id;
        const neonClass = t.neon === 'blood' ? 'title-neon-blood' : t.neon === 'tech' ? 'title-neon-tech' : '';
        const nameStyle = neonClass ? `class="t-name ${neonClass}"` : `class="t-name"`;
        if (t.secret && !ok) return '';
        const reqText = t.secret ? '🔒 Секретный код' : t.req;
        return `<div class="title-card ${ok ? 'unlocked' : 'locked-title'} ${equipped ? 'equipped' : ''}" onclick="${ok ? `equipTitle('${t.id}')` : ''}">
      <div class="t-icon">${t.icon}</div>
      <div class="t-info"><div ${nameStyle}>${t.name}</div><div class="t-req">${reqText}</div></div>
      ${equipped ? '<div class="t-equipped">АКТИВЕН</div>' : (ok ? '<div style="font-size:11px;color:var(--text-muted);font-weight:700;">Нажми чтобы надеть</div>' : '<div style="font-size:11px;color:var(--text-muted);">🔒</div>')}
    </div>`;
    }).join('');

    // Rewards
    const rList = document.getElementById('rewards-list');
    rList.innerHTML = MODULE_REWARDS.map(r => {
        const earned = r.check();
        return `<div class="reward-card ${earned ? 'earned' : ''}">
      <div class="r-icon">${r.icon}</div>
      <div class="r-info"><div class="r-name">${r.name}</div><div class="r-desc">${r.desc}</div></div>
      <div class="r-status ${earned ? 'earned-badge' : 'locked-badge'}">${earned ? '✓ Получено' : '🔒'}</div>
    </div>`;
    }).join('');
}

function equipTitle(id) {
    profileData.equippedTitleId = profileData.equippedTitleId === id ? null : id;
    updateEquippedTitle();
    renderAchievements();
    saveState();
    showToast('✨ Титул изменён!');
}

function updateEquippedTitle() {
    const badge = document.getElementById('equipped-title-badge');
    const iconEl = document.getElementById('equipped-title-icon');
    const textEl = document.getElementById('equipped-title-text');
    if (!badge) return;
    const t = TITLES.find(t => t.id === profileData.equippedTitleId);
    badge.classList.remove('title-badge-blood', 'title-badge-tech');
    if (t) {
        badge.classList.remove('none-title');
        iconEl.textContent = t.icon;
        textEl.textContent = t.name;
        if (t.neon === 'blood') badge.classList.add('title-badge-blood');
        else if (t.neon === 'tech') badge.classList.add('title-badge-tech');
    } else {
        badge.classList.add('none-title');
        iconEl.textContent = '🎖️';
        textEl.textContent = 'Нет титула';
    }
}


function isOutfitUnlockedByModule(outfitIdx) {
    for (const [mi, oIdx] of Object.entries(MODULE_OUTFIT_UNLOCKS)) {
        if (parseInt(oIdx) === outfitIdx && trophyTestDone[parseInt(mi)]) return true;
    }
    return false;
}
function isBgUnlockedByModule(bgIdx) {
    for (const [mi, extras] of Object.entries(MODULE_EXTRA_UNLOCKS)) {
        if (extras.bg === bgIdx && trophyTestDone[parseInt(mi)]) return true;
    }
    return false;
}
function isMaskUnlockedByModule(maskIdx) {
    for (const [mi, extras] of Object.entries(MODULE_EXTRA_UNLOCKS)) {
        if (extras.mask === maskIdx && trophyTestDone[parseInt(mi)]) return true;
    }
    return false;
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function switchProfTab(tab) {
    ['edit', 'look', 'devs'].forEach(t => {
        document.getElementById(`ptab-${t}`).classList.toggle('active', t === tab);
        document.getElementById(`ptab-content-${t}`).style.display = t === tab ? 'block' : 'none';
    });
    if (tab === 'devs') renderDevsTab();
}

function renderProfileScreen() {
    document.getElementById('edit-name').value = profileData.name;
    document.getElementById('edit-username').value = profileData.username;
    document.getElementById('edit-bio').value = profileData.bio;
    document.getElementById('prof-disp-name').textContent = profileData.name || '—';
    document.getElementById('prof-disp-user').textContent = '@' + (profileData.username || 'username');
    renderDevBadgeIfNeeded();

    // Main avatar is now photo-only (canvas), no SVG render here
    // Restore photo if no image loaded yet (placeholder shown by initAvaUpload)
    if (!_avaImg) {
        const canvas = document.getElementById('ava-upload-canvas');
        drawAvaPlaceholder(canvas);
    }

    // Banner
    const banner = document.getElementById('prof-banner');
    const bc = BANNER_COLORS.find(c => c.id === profileData.bannerId) || BANNER_COLORS[0];
    banner.style.background = bc.g;
    const pat = BANNER_PATTERNS.find(p => p.id === profileData.patternId) || BANNER_PATTERNS[0];
    const patEl = document.getElementById('prof-banner-pattern');
    patEl.className = pat.class;
    patEl.style.cssText = 'position:absolute;inset:0;pointer-events:none;';

    // Banner color row
    const bgRow = document.getElementById('banner-bg-row');
    bgRow.innerHTML = BANNER_COLORS.map(c => `
    <div style="width:36px;height:36px;border-radius:50%;background:${c.color};cursor:pointer;
      border:3px solid ${c.id === profileData.bannerId ? 'white' : 'transparent'};
      transform:${c.id === profileData.bannerId ? 'scale(1.15)' : 'scale(1)'};transition:all 0.15s;
      display:flex;align-items:center;justify-content:center;font-size:12px;"
      onclick="pickBannerColor('${c.id}')">
      ${c.id === profileData.bannerId ? '✓' : ''}
    </div>`).join('');

    // Pattern row
    const patRow = document.getElementById('banner-pattern-row');
    patRow.innerHTML = BANNER_PATTERNS.map(p => `
    <div style="padding:8px 14px;border-radius:10px;background:var(--surface);border:2px solid ${p.id === profileData.patternId ? 'var(--secondary)' : 'var(--surface-light)'};
      font-size:12px;font-weight:800;cursor:pointer;color:${p.id === profileData.patternId ? 'var(--secondary)' : 'var(--text-muted)'};"
      onclick="pickBannerPattern('${p.id}')">${p.label}</div>`).join('');

    updateEquippedTitle();
}

function trySecretCode() {
    const input = document.getElementById('secret-code-input');
    const result = document.getElementById('secret-result');
    const code = input.value.trim().toUpperCase();
    if (SECRET_CODES.hasOwnProperty(code)) {
        const idx = SECRET_CODES[code];
        if (unlockedSecrets.has(idx)) {
            result.style.color = 'var(--gold)';
            result.textContent = '✨ Этот персонаж уже разблокирован!';
        } else {
            unlockedSecrets.add(idx);
            if (idx === 8) {
                // EMPEROR77: skip SVG character entirely, go straight to photo upload
                result.style.color = 'var(--primary)';
                result.textContent = '🔓 👑 Режим Императора активирован!';
                showToast('📷 Загрузи своё фото!', 2500);
                saveState();
                initAvaUpload();
            } else {
                charState.tempBody = idx;
                charState.body = idx;
                // auto-equip matching secret outfit
                const specialId = CHAR_BODIES[idx].special;
                const secretOutfitIdx = CHAR_OUTFITS.findIndex(o => o.secret === specialId);
                if (secretOutfitIdx !== -1) {
                    charState.outfit = secretOutfitIdx;
                    charState.tempOutfit = secretOutfitIdx;
                }
                renderCharSVG(document.getElementById('char-display-svg'), charState.body, charState.outfit, charState.mask, charState.bg);
                result.style.color = 'var(--primary)';
                const charName = '🦝 Разраб Енот разблокирован!';
                result.textContent = '🔓 ' + charName;
                showToast('✨ Секретный персонаж открыт!');
                switchCharTab('body');
                saveState();
            }
        }
    } else {
        result.style.color = 'var(--danger)';
        result.textContent = '❌ Неверный код';
        setTimeout(() => { result.textContent = ''; }, 2000);
    }
    input.value = '';
}

// ─── EMPEROR AVATAR UPLOAD ────────────────────────────────────────────────────
let _avaImg = null;
let _emperorMode = false;

function onAvaTap() {
    document.getElementById('ava-file-input').click();
}

function initAvaUpload() {
    _emperorMode = true;
    // Hide SVG if present
    const svg = document.getElementById('char-display-svg');
    if (svg) svg.style.display = 'none';
    const badge = document.getElementById('ava-edit-badge');
    if (badge) { badge.textContent = '📷'; badge.style.display = 'flex'; }
    const canvas = document.getElementById('ava-upload-canvas');
    // Draw placeholder
    drawAvaPlaceholder(canvas);

    const fileInput = document.getElementById('ava-file-input');
    try {
    if (fileInput._bound) return;
    fileInput._bound = true;
    fileInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (ev) {
            _avaImg = new Image();
            _avaImg.onload = function () {
                const canvas = document.getElementById('ava-upload-canvas');
                canvas.style.display = 'block';
                document.getElementById('ava-crop-controls').style.display = 'block';
                document.getElementById('ava-zoom').value = 100;
                document.getElementById('ava-ox').value = 0;
                document.getElementById('ava-oy').value = 0;
                drawAvaUpload();
            };
            _avaImg.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });
    } catch(e) {}
}

function drawAvaPlaceholder(canvas) {
    if (!canvas) return;
    const S = 200;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#252F3B';
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.fill();
    ctx.font = '56px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📷', S / 2, S / 2 - 10);
    ctx.font = '800 15px Arial';
    ctx.fillStyle = '#8B95A1';
    ctx.fillText('Загрузить фото', S / 2, S / 2 + 42);
}

function drawAvaUpload() {
    if (!_avaImg) return;
    const canvas = document.getElementById('ava-upload-canvas');
    const ctx = canvas.getContext('2d');
    const S = 200;
    const zoom = parseInt(document.getElementById('ava-zoom').value);
    const ox = parseInt(document.getElementById('ava-ox').value);
    const oy = parseInt(document.getElementById('ava-oy').value);
    document.getElementById('ava-zoom-val').textContent = zoom + '%';
    ctx.clearRect(0, 0, S, S);
    const scale = zoom / 100;
    const short = Math.min(_avaImg.naturalWidth, _avaImg.naturalHeight);
    const drawW = (_avaImg.naturalWidth / short) * S * scale;
    const drawH = (_avaImg.naturalHeight / short) * S * scale;
    const dx = (S - drawW) / 2 + ox * 2;
    const dy = (S - drawH) / 2 + oy * 2;
    ctx.drawImage(_avaImg, dx, dy, drawW, drawH);
}

function applyAvaUpload() {
    document.getElementById('ava-crop-controls').style.display = 'none';
    showToast('✨ Аватар обновлён!');
}

function pickBannerColor(id) {
    profileData.bannerId = id;
    const bc = BANNER_COLORS.find(c => c.id === id);
    document.getElementById('prof-banner').style.background = bc.g;
    renderProfileScreen();
}

function pickBannerPattern(id) {
    profileData.patternId = id;
    const pat = BANNER_PATTERNS.find(p => p.id === id);
    const patEl = document.getElementById('prof-banner-pattern');
    patEl.className = pat.class;
    renderProfileScreen();
}

function confirmReset() {
    document.getElementById('reset-modal-step1').style.display = 'block';
    document.getElementById('reset-modal-step2').style.display = 'none';
    document.getElementById('reset-confirm-input').value = '';
    document.getElementById('reset-final-btn').disabled = true;
    document.getElementById('reset-final-btn').style.opacity = '0.4';
    document.getElementById('reset-modal-bg').classList.add('open');
}

function closeResetModal() {
    document.getElementById('reset-modal-bg').classList.remove('open');
}

function resetStep2() {
    document.getElementById('reset-modal-step1').style.display = 'none';
    document.getElementById('reset-modal-step2').style.display = 'block';
    setTimeout(() => document.getElementById('reset-confirm-input').focus(), 100);
}

function checkResetWord() {
    const val = document.getElementById('reset-confirm-input').value.trim().toUpperCase();
    const ok = (val === 'СБРОС');
    const btn = document.getElementById('reset-final-btn');
    btn.disabled = !ok;
    btn.style.opacity = ok ? '1' : '0.4';
}

function doReset() {
    closeResetModal();
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
    showToast('🗑️ Прогресс сброшен! Перезагружаю...', 2000);
    setTimeout(() => location.reload(), 1500);
}

function saveProfile() {
    const name = document.getElementById('edit-name').value.trim();
    const user = document.getElementById('edit-username').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    if (!name) { showToast('❗ Введи имя'); return; }
    if (!user) { showToast('❗ Введи юзернейм'); return; }
    if (user === profileData.username) {
        // Username unchanged — just save name/bio
        profileData.name = name; profileData.bio = bio;
        document.getElementById('prof-disp-name').textContent = name;
        saveState();
        showToast('✅ Профиль сохранён!', 1800);
        return;
    }
    const avail = checkUsernameAvailability(user, SAVE_KEY);
    if (avail.isDev && !avail.isOwn) {
        _pendingSetupUsername = user;
        _pendingSetupName = name;
        _pendingSetupBio = bio;
        showPasswordLoginModal(user);
        return;
    }
    if (avail.taken) {
        _pendingSetupUsername = user;
        _pendingSetupName = name;
        _pendingSetupBio = bio;
        showPasswordLoginModal(user);
        return;
    }
    profileData.name = name; profileData.username = user; profileData.bio = bio;
    registerUsername(user, SAVE_KEY, null /* preserve existing hash */);
    document.getElementById('prof-disp-name').textContent = name;
    document.getElementById('prof-disp-user').textContent = '@' + user;
    if (isDevUsername(user)) applyDevAccount(user);
    renderDevBadgeIfNeeded();
    saveState();
    showToast('✅ Профиль сохранён!', 1800);
}

// ─── CHARACTER CUSTOMIZER ─────────────────────────────────────────────────────
function openAvaModal() {
    charState.tempBody = charState.body;
    charState.tempOutfit = charState.outfit;
    charState.tempMask = charState.mask;
    charState.tempBg = charState.bg;
    switchCharTab('body');
    document.getElementById('ava-modal').classList.add('open');
    updateModalPreview();
}

function closeAvaModal(e) {
    if (e.target === document.getElementById('ava-modal'))
        document.getElementById('ava-modal').classList.remove('open');
}

function confirmAvatar() {
    charState.body = charState.tempBody;
    charState.outfit = charState.tempOutfit;
    charState.mask = charState.tempMask;
    charState.bg = charState.tempBg;
    // Update main avatar
    renderCharSVG(document.getElementById('char-display-svg'), charState.body, charState.outfit, charState.mask, charState.bg);
    document.getElementById('ava-modal').classList.remove('open');
    saveState();
    showToast('✨ Персонаж обновлён!');
}

function updateModalPreview() {
    renderCharSVG(document.getElementById('modal-char-svg'), charState.tempBody, charState.tempOutfit, charState.tempMask, charState.tempBg);
}

function switchCharTab(tab) {
    ['body', 'outfit', 'mask', 'bg'].forEach(t => {
        const el = document.getElementById(`char-tab-${t}`);
        if (el) el.style.display = t === tab ? 'block' : 'none';
    });
    document.querySelectorAll('.char-tab').forEach((btn, i) => {
        const tabs = ['body', 'outfit', 'mask', 'bg'];
        btn.classList.toggle('active', tabs[i] === tab);
    });
    if (tab === 'body') renderBodyGrid();
    else if (tab === 'outfit') renderOutfitGrid();
    else if (tab === 'mask') renderMaskGrid();
    else if (tab === 'bg') renderBgGrid();
}

function renderBodyGrid() {
    const grid = document.getElementById('body-grid');
    grid.innerHTML = CHAR_BODIES.map((b, i) => {
        if (b.secret && !unlockedSecrets.has(i)) return ''; // hide secret chars
        const locked = b.reqXP && xp < b.reqXP && !isBgUnlockedByModule(i);
        const isSecret = b.secret && unlockedSecrets.has(i);
        const borderStyle = isSecret ? 'border-color:#ffc800;background:rgba(255,200,0,0.08);' : '';
        return `
      <div class="custom-item ${charState.tempBody === i ? 'picked' : ''}" 
           style="${borderStyle}" 
           onclick="${!locked ? `pickBody(${i})` : ''}">
        <span style="font-size:28px;">${b.label}</span>
        ${isSecret ? '<div style="position:absolute;top:3px;right:3px;font-size:8px;color:#ffc800;font-weight:900;">★</div>' : ''}
        ${locked ? `<div class="locked-over">🔒</div>` : ''}
      </div>
    `;
    }).join('');
}

function renderOutfitGrid() {
    const OUTFIT_ICONS = { 'tshirt_blue': '👕', 'tshirt_green': '💚', 'hoodie': '🧥', 'robe': '🎓', 'armor': '🛡️', 'ninja': '🥷', 'wizard': '🧙', 'king': '👑', 'dev_hoodie': '💻', 'emperor_cloak': '🔮' };
    const currentBody = CHAR_BODIES[charState.tempBody];
    const grid = document.getElementById('outfit-grid');
    grid.innerHTML = CHAR_OUTFITS.map((o, i) => {
        // hide secret outfits unless current body matches
        if (o.secret && o.secret !== currentBody.special) return '';
        const locked = o.reqXP && xp < o.reqXP && !isOutfitUnlockedByModule(i);
        const icon = OUTFIT_ICONS[o.id] || '👕';
        const isSecret = !!o.secret;
        const borderStyle = isSecret ? 'border:2px solid #ffc800;' : '';
        return `
      <div class="custom-item ${charState.tempOutfit === i ? 'picked' : ''}" onclick="${!locked ? `pickOutfit(${i})` : ''}" style="position:relative;${borderStyle}">
        <div style="width:100%;height:100%;border-radius:10px;background:linear-gradient(135deg,${o.c1},${o.c3});display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
          <span style="font-size:22px;">${icon}</span>
          <span style="font-size:7px;font-weight:900;color:rgba(255,255,255,0.85);text-align:center;line-height:1.1;padding:0 2px;">${o.name}</span>
        </div>
        ${isSecret ? '<div style="position:absolute;top:3px;right:3px;font-size:8px;color:#ffc800;font-weight:900;">★</div>' : ''}
        ${locked ? `<div class="locked-over">🔒</div>` : ''}
      </div>
    `;
    }).join('');
}

function renderMaskGrid() {
    const grid = document.getElementById('mask-grid');
    grid.innerHTML = CHAR_MASKS.map((m, i) => {
        const locked = m.reqXP && xp < m.reqXP && !isMaskUnlockedByModule(i);
        const icon = m.noMask ? '🚫' : (m.preview || '🎭');
        return `
      <div class="custom-item ${charState.tempMask === i ? 'picked' : ''}" onclick="${!locked ? `pickMask(${i})` : ''}">
        <span style="font-size:24px;">${icon}</span>
        <div style="font-size:8px;font-weight:800;color:var(--text-muted);position:absolute;bottom:4px;left:0;right:0;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px;">${m.name}</div>
        ${locked ? `<div class="locked-over">🔒</div>` : ''}
      </div>
    `;
    }).join('');
}

function renderBgGrid() {
    const grid = document.getElementById('bg-grid');
    grid.innerHTML = CHAR_BGS.map((b, i) => {
        const locked = b.reqXP && xp < b.reqXP;
        return `
      <div class="custom-item bg-item ${charState.tempBg === i ? 'picked' : ''}" 
           style="background:${b.fill};"
           onclick="${!locked ? `pickBg(${i})` : ''}">
        ${charState.tempBg === i ? '<span style="font-size:18px;">✓</span>' : ''}
        ${locked ? `<div class="locked-over">🔒</div>` : ''}
      </div>
    `;
    }).join('');
}

function pickBody(i) { charState.tempBody = i; renderBodyGrid(); updateModalPreview(); }
function pickOutfit(i) { charState.tempOutfit = i; renderOutfitGrid(); updateModalPreview(); }
function pickMask(i) { charState.tempMask = i; renderMaskGrid(); updateModalPreview(); }
function pickBg(i) { charState.tempBg = i; renderBgGrid(); updateModalPreview(); }

// ─── LEAGUE SYSTEM ────────────────────────────────────────────────────────────
const LEAGUES = [
    {
        id: 'stone', name: 'Каменная', minXP: 0, color: '#7a8a9a',
        barColor: 'linear-gradient(90deg,#7a8a9a,#aab8c2)',
        bannerBg: 'linear-gradient(160deg,#2a3a4a,#0f1419)',
        trophy: `<svg viewBox="0 0 80 90" xmlns="http://www.w3.org/2000/svg"><ellipse cx="40" cy="82" rx="22" ry="6" fill="#3a4a5a" opacity="0.5"/><rect x="30" y="68" width="20" height="10" rx="4" fill="#5a6a7a"/><rect x="22" y="62" width="36" height="8" rx="4" fill="#6a7a8a"/><path d="M18 20 Q18 60 40 60 Q62 60 62 20 Z" fill="#8a9aaa"/><path d="M18 20 Q18 48 40 52 Q62 48 62 20 Z" fill="#aab8c2"/><rect x="14" y="16" width="52" height="8" rx="4" fill="#6a7a8a"/><rect x="10" y="20" width="12" height="18" rx="6" fill="#7a8a9a"/><rect x="58" y="20" width="12" height="18" rx="6" fill="#7a8a9a"/><circle cx="40" cy="36" r="8" fill="#c8d8e8" opacity="0.6"/><text x="40" y="42" text-anchor="middle" font-size="10" font-weight="900" fill="#3a4a5a">I</text></svg>`,
    },
    {
        id: 'bronze', name: 'Бронзовая', minXP: 100, color: '#cd7f32',
        barColor: 'linear-gradient(90deg,#cd7f32,#e8a96a)',
        bannerBg: 'linear-gradient(160deg,#3a2010,#0f1419)',
        trophy: `<svg viewBox="0 0 80 90" xmlns="http://www.w3.org/2000/svg"><ellipse cx="40" cy="82" rx="22" ry="6" fill="#3a2010" opacity="0.5"/><rect x="30" y="68" width="20" height="10" rx="4" fill="#8b5520"/><rect x="22" y="62" width="36" height="8" rx="4" fill="#a06030"/><path d="M18 20 Q18 60 40 60 Q62 60 62 20 Z" fill="#cd7f32"/><path d="M18 20 Q18 48 40 52 Q62 48 62 20 Z" fill="#e8a96a"/><rect x="14" y="16" width="52" height="8" rx="4" fill="#a06030"/><rect x="10" y="20" width="12" height="18" rx="6" fill="#cd7f32"/><rect x="58" y="20" width="12" height="18" rx="6" fill="#cd7f32"/><circle cx="40" cy="36" r="8" fill="#ffd080" opacity="0.7"/><text x="40" y="42" text-anchor="middle" font-size="9" font-weight="900" fill="#6a3800">II</text></svg>`,
    },
    {
        id: 'silver', name: 'Серебряная', minXP: 300, color: '#a8b8c8',
        barColor: 'linear-gradient(90deg,#8898a8,#d0e0f0)',
        bannerBg: 'linear-gradient(160deg,#1e2e3e,#0f1419)',
        trophy: `<svg viewBox="0 0 80 90" xmlns="http://www.w3.org/2000/svg"><ellipse cx="40" cy="82" rx="22" ry="6" fill="#1a2a3a" opacity="0.5"/><rect x="30" y="68" width="20" height="10" rx="4" fill="#607080"/><rect x="22" y="62" width="36" height="8" rx="4" fill="#8898a8"/><path d="M18 20 Q18 60 40 60 Q62 60 62 20 Z" fill="#a8b8c8"/><path d="M18 20 Q18 48 40 52 Q62 48 62 20 Z" fill="#d0e0f0"/><rect x="14" y="16" width="52" height="8" rx="4" fill="#8898a8"/><rect x="10" y="20" width="12" height="18" rx="6" fill="#a8b8c8"/><rect x="58" y="20" width="12" height="18" rx="6" fill="#a8b8c8"/><circle cx="40" cy="36" r="9" fill="white" opacity="0.5"/><polygon points="40,28 42.5,35 50,35 44,39.5 46,47 40,43 34,47 36,39.5 30,35 37.5,35" fill="white" opacity="0.9"/></svg>`,
    },
    {
        id: 'gold', name: 'Золотая', minXP: 600, color: '#ffc800',
        barColor: 'linear-gradient(90deg,#e0a800,#ffe066)',
        bannerBg: 'linear-gradient(160deg,#3a2e00,#0f1419)',
        trophy: `<svg viewBox="0 0 80 90" xmlns="http://www.w3.org/2000/svg"><ellipse cx="40" cy="82" rx="22" ry="6" fill="#3a2a00" opacity="0.6"/><rect x="30" y="68" width="20" height="10" rx="4" fill="#a07800"/><rect x="22" y="62" width="36" height="8" rx="4" fill="#c89800"/><path d="M18 20 Q18 60 40 60 Q62 60 62 20 Z" fill="#e0a800"/><path d="M18 20 Q18 48 40 52 Q62 48 62 20 Z" fill="#ffe066"/><rect x="14" y="16" width="52" height="8" rx="4" fill="#c89800"/><rect x="10" y="20" width="12" height="20" rx="6" fill="#e0a800"/><rect x="58" y="20" width="12" height="20" rx="6" fill="#e0a800"/><circle cx="40" cy="36" r="10" fill="#fff8d0" opacity="0.6"/><polygon points="40,26 43,33 51,33 45,38 47,46 40,41 33,46 35,38 29,33 37,33" fill="#fff8d0"/></svg>`,
    },
    {
        id: 'sapphire', name: 'Сапфировая', minXP: 1000, color: '#1cb0f6',
        barColor: 'linear-gradient(90deg,#0d80c0,#60d0ff)',
        bannerBg: 'linear-gradient(160deg,#002a4a,#0f1419)',
        trophy: `<svg viewBox="0 0 80 90" xmlns="http://www.w3.org/2000/svg"><ellipse cx="40" cy="82" rx="22" ry="6" fill="#001a3a" opacity="0.6"/><rect x="30" y="68" width="20" height="10" rx="4" fill="#0050a0"/><rect x="22" y="62" width="36" height="8" rx="4" fill="#0080c8"/><path d="M18 20 Q18 60 40 60 Q62 60 62 20 Z" fill="#0d80c0"/><path d="M18 20 Q18 48 40 52 Q62 48 62 20 Z" fill="#60d0ff"/><rect x="14" y="16" width="52" height="8" rx="4" fill="#0070b0"/><rect x="10" y="20" width="12" height="20" rx="6" fill="#0d80c0"/><rect x="58" y="20" width="12" height="20" rx="6" fill="#0d80c0"/><polygon points="40,24 46,32 54,32 48,38 50,46 40,42 30,46 32,38 26,32 34,32" fill="#a0e8ff" opacity="0.9"/><circle cx="40" cy="14" r="6" fill="#60d0ff"/></svg>`,
    },
    {
        id: 'obsidian', name: 'Обсидиановая', minXP: 3000, color: '#ff4b4b',
        barColor: 'linear-gradient(90deg,#c00,#ff8060)',
        bannerBg: 'linear-gradient(160deg,#2a0000,#0f1419)',
        trophy: `<svg viewBox="0 0 80 90" xmlns="http://www.w3.org/2000/svg"><ellipse cx="40" cy="82" rx="22" ry="6" fill="#1a0000" opacity="0.7"/><rect x="30" y="68" width="20" height="10" rx="4" fill="#3a0000"/><rect x="22" y="62" width="36" height="8" rx="4" fill="#5a0808"/><path d="M18 20 Q18 60 40 60 Q62 60 62 20 Z" fill="#1a0808"/><path d="M18 20 Q18 48 40 52 Q62 48 62 20 Z" fill="#3a1010"/><rect x="14" y="16" width="52" height="8" rx="4" fill="#4a0808"/><path d="M30 30 L38 38 L32 46" stroke="#ff4b4b" stroke-width="1.5" fill="none" opacity="0.8"/><path d="M50 28 L44 36 L48 44" stroke="#ff8060" stroke-width="1.5" fill="none" opacity="0.8"/><circle cx="40" cy="38" r="5" fill="#ff4b4b" opacity="0.25"/><circle cx="40" cy="10" r="9" fill="#1a0808" stroke="#ff4b4b" stroke-width="1.5"/><polygon points="40,1 43.5,7 51,5 47,12 52,17 40,14 28,17 33,12 29,5 36.5,7" fill="#ff4b4b" opacity="0.9"/></svg>`,
    },
];

function getCurrentLeague() {
    let league = LEAGUES[0];
    for (let i = LEAGUES.length - 1; i >= 0; i--) {
        if (xp >= LEAGUES[i].minXP) { league = LEAGUES[i]; break; }
    }
    return league;
}

function getLeagueIndex(id) { return LEAGUES.findIndex(l => l.id === id); }

function renderLeagueScreen() {
    const cur = getCurrentLeague();
    const curIdx = getLeagueIndex(cur.id);
    const next = LEAGUES[curIdx + 1] || null;
    document.getElementById('league-banner').style.background = cur.bannerBg;
    document.getElementById('league-trophy').innerHTML = cur.trophy;
    document.getElementById('league-trophy').style.cssText = 'width:90px;height:90px;margin:0 auto 10px;filter:drop-shadow(0 4px 16px ' + cur.color + '88);';
    document.getElementById('league-name-big').textContent = cur.name + ' лига';
    document.getElementById('league-name-big').style.color = cur.color;
    document.getElementById('league-xp-range').textContent = next
        ? cur.minXP + ' – ' + (next.minXP - 1) + ' XP'
        : cur.minXP + '+ XP (максимальная!)';
    if (next) {
        const range = next.minXP - cur.minXP;
        const earned = xp - cur.minXP;
        const pct = Math.min(100, Math.round((earned / range) * 100));
        document.getElementById('league-bar').style.width = pct + '%';
        document.getElementById('league-bar').style.background = cur.barColor;
        document.getElementById('league-pct').textContent = pct + '%';
        document.getElementById('league-next-label').textContent = 'До ' + next.name.toLowerCase() + ' лиги: ' + Math.max(0, next.minXP - xp) + ' XP';
    } else {
        document.getElementById('league-bar').style.width = '100%';
        document.getElementById('league-bar').style.background = cur.barColor;
        document.getElementById('league-pct').textContent = '100%';
        document.getElementById('league-next-label').textContent = '🏅 Высшая лига достигнута!';
    }
    const list = document.getElementById('all-leagues');
    list.innerHTML = LEAGUES.map((l, i) => {
        const isCur = l.id === cur.id;
        const isDone = i < curIdx;
        const isLocked = i > curIdx;
        const badge = isCur
            ? '<span class="league-badge badge-current">ТЕКУЩАЯ</span>'
            : isDone ? '<span class="league-badge badge-done">✓ ПРОЙДЕНА</span>'
                : '<span class="league-badge badge-locked">🔒 ' + l.minXP + ' XP</span>';
        return `
      <div class="league-row ${isCur ? 'current' : ''} ${isLocked ? 'locked-league' : ''}">
        <div class="league-trophy-sm" style="filter:drop-shadow(0 2px 8px ${l.color}66)">${l.trophy}</div>
        <div class="league-info">
          <div class="league-row-name" style="color:${isCur ? l.color : isLocked ? 'var(--text-muted)' : 'var(--text)'}">${l.name}</div>
          <div class="league-row-req">${l.minXP === 0 ? 'Начальная лига' : 'от ' + l.minXP + ' XP'}</div>
        </div>
        ${badge}
      </div>`;
    }).join('');
}


// ─── SOUND ENGINE ─────────────────────────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let _actx = null;
function getACtx() {
    if (!_actx) { try { _actx = new AudioCtx(); } catch (e) { } }
    return _actx;
}
function playTone(freq, dur, type = 'sine', vol = 0.18, decay = 0.9) {
    try {
        const ctx = getACtx(); if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = type; osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur * decay);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
    } catch (e) { }
}
function playCorrect() {
    playTone(523, 0.12, 'sine', 0.15);
    setTimeout(() => playTone(659, 0.12, 'sine', 0.15), 80);
    setTimeout(() => playTone(784, 0.18, 'sine', 0.15), 160);
}
function playWrong() {
    playTone(220, 0.15, 'sawtooth', 0.12);
    setTimeout(() => playTone(180, 0.2, 'sawtooth', 0.1), 100);
}
function playLevelUp() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.18, 'sine', 0.18), i * 80));
}
function playClick() { playTone(880, 0.06, 'sine', 0.07); }
function playXP() { playTone(1047, 0.1, 'sine', 0.12); setTimeout(() => playTone(1319, 0.15, 'sine', 0.12), 60); }

// ─── VIBRATION ────────────────────────────────────────────────────────────────
function vibrate(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { }
}
function vibrateOk() { vibrate([30]); }
function vibrateWrong() { vibrate([40, 20, 40]); }
function vibrateSuccess() { vibrate([20, 10, 20, 10, 80]); }

// ─── XP POPUP ─────────────────────────────────────────────────────────────────
function showXPPopup(amount) {
    try {
    const el = document.getElementById('xp-popup');
    el.textContent = '+' + amount + ' XP';
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1500);
    playXP();
    } catch(e) {}
}

// ─── STREAK MODAL ─────────────────────────────────────────────────────────────
function checkAndShowStreak() {
    const today = new Date().toDateString();
    const lastSeen = localStorage.getItem('geltcode_last_seen');
    const streak = parseInt(localStorage.getItem('geltcode_streak') || '1');
    if (lastSeen !== today) {
        localStorage.setItem('geltcode_last_seen', today);
        if (streak > 1) {
            document.getElementById('streak-modal-days').textContent = streak;
            document.getElementById('streak-modal-title').textContent = streak >= 7 ? '🔥 Огненная серия!' : 'Серия продолжается!';
            document.getElementById('streak-modal-bg').classList.add('open');
        }
    }
}
function closeStreakModal() {
    document.getElementById('streak-modal-bg').classList.remove('open');
}

// ─── SPLASH SCREEN ────────────────────────────────────────────────────────────
function runSplash(cb) {
    try {
    const bar = document.getElementById('splash-bar');
    let p = 0;
    const iv = setInterval(() => {
        p += Math.random() * 15 + 5;
        if (p >= 100) { p = 100; clearInterval(iv); }
        bar.style.width = p + '%';
        if (p >= 100) setTimeout(() => {
            document.getElementById('splash').classList.add('hiding');
            setTimeout(() => {
                document.getElementById('splash').style.display = 'none';
                cb();
            }, 500);
        }, 200);
    }, 80);
    } catch(e) {}
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
const ONBOARD_STEPS = [
    { graphic: '🐲', title: 'Добро пожаловать!', sub: 'Изучай Pascal через короткие уроки — как игру. Прокачивай персонажа и собирай достижения.' },
    { graphic: '⚡', title: 'Зарабатывай XP', sub: 'За каждый правильный ответ ты получаешь опыт. Поднимайся по лигам — от Каменной до Обсидиановой.' },
    { graphic: '🔥', title: 'Поддерживай серию', sub: 'Занимайся каждый день — не теряй огонь! Серия даёт бонусы и открывает секретный контент.' },
    { graphic: '🎮', title: 'Готов начать?', sub: 'Выбери имя и создай своего персонажа. Первый урок займёт всего 2 минуты!' },
];
let onboardStep = 0;

function onboardNext() {
    playClick();
    onboardStep++;
    if (onboardStep >= ONBOARD_STEPS.length) { finishOnboard(); return; }
    const s = ONBOARD_STEPS[onboardStep];
    document.getElementById('ob-graphic').textContent = s.graphic;
    document.getElementById('ob-graphic').style.animation = 'none';
    setTimeout(() => document.getElementById('ob-graphic').style.animation = 'bounceIn 0.5s', 10);
    document.getElementById('ob-title').textContent = s.title;
    document.getElementById('ob-sub').textContent = s.sub;
    ONBOARD_STEPS.forEach((_, i) => {
        const d = document.getElementById('od' + i);
        if (d) d.classList.toggle('active', i === onboardStep);
    });
    if (onboardStep === ONBOARD_STEPS.length - 1) {
        document.querySelector('#welcome .btn.go').textContent = 'НАЧАТЬ! 🚀';
    }
}
window.onboardNext = onboardNext

function skipOnboard() {
    finishOnboard();
}

function finishOnboard() {
    localStorage.setItem('geltcode_onboarded', '1');
    window.changePage('registration')
    vibrateSuccess(); playLevelUp();
    // Show profile setup if user has no name yet
    if (!profileData.name) {
        setTimeout(() => {
            window.changePage('registration')
        }, 300);
    } else {
        setTimeout(() => checkAndShowStreak(), 400);
    }
}

function finishProfileSetup() {
    const name = document.getElementById('setup-name').value.trim();
    const user = document.getElementById('setup-username').value.trim();
    const bio = document.getElementById('setup-bio').value.trim();
    const pwd = document.getElementById('setup-password').value;
    const errEl = document.getElementById('setup-error');
    if (!name) { errEl.textContent = '❗ Введи своё имя'; return; }
    if (!user) { errEl.textContent = '❗ Введи имя пользователя'; return; }
    if (!pwd || pwd.length < 4) { errEl.textContent = '❗ Пароль должен быть не менее 4 символов'; return; }

    const pwdHash = hashPassword(pwd);
    const normalized = user.toLowerCase().replace(/[^a-z0-9_.]/g, '');

    // Check dev accounts first
    const avail = checkUsernameAvailability(user, SAVE_KEY);
    if (avail.isDev && !avail.isOwn) {
        _pendingSetupUsername = user;
        _pendingSetupName = name;
        _pendingSetupBio = bio;
        showPasswordLoginModal(user);
        return;
    }

    errEl.textContent = '⏳ Проверяем ник...';
    document.querySelector('#registration .btn.go').disabled = true;

    // Check Firebase if available, else fall back to localStorage
    const doCheck = window._fb
        ? window._fb.usernameExists(user)
        : Promise.resolve(false);

    doCheck.then(existsInCloud => {
        const localAvail = checkUsernameAvailability(user, SAVE_KEY);
        const taken = existsInCloud || localAvail.taken;

        if (taken) {
            _pendingSetupUsername = user;
            _pendingSetupName = name;
            _pendingSetupBio = bio;
            errEl.textContent = '';
            document.querySelector('#profile-setup-screen .btn.go').disabled = false;
            showPasswordLoginModal(user);
            return;
        }

        // Free — register
        errEl.textContent = '';
        document.querySelector('#profile-setup-screen .btn.go').disabled = false;
        profileData.name = name;
        profileData.username = user;
        profileData.bio = bio;
        registerUsername(user, SAVE_KEY, pwdHash);
        // Save password to cloud
        if (window._fb) window._fb.savePwd(user, pwdHash);
        document.getElementById('edit-name').value = name;
        document.getElementById('edit-username').value = user;
        document.getElementById('edit-bio').value = bio;
        document.getElementById('prof-disp-name').textContent = name;
        document.getElementById('prof-disp-user').textContent = '@' + user;
        if (isDevUsername(user)) applyDevAccount(user);
        renderDevBadgeIfNeeded();
        saveState();
        window.changePage('home')
        vibrateSuccess();
        setTimeout(() => checkAndShowStreak(), 400);
    }).catch(() => {
        errEl.textContent = '';
        document.querySelector('#registration .btn.go').disabled = false;
        // Fallback: just use local check
        const localAvail = checkUsernameAvailability(user, SAVE_KEY);
        if (localAvail.taken) {
            _pendingSetupUsername = user; _pendingSetupName = name; _pendingSetupBio = bio;
            showPasswordLoginModal(user); return;
        }
        profileData.name = name; profileData.username = user; profileData.bio = bio;
        registerUsername(user, SAVE_KEY, pwdHash);
        try {
            document.getElementById('edit-name').value = name;
            document.getElementById('edit-username').value = user;
            document.getElementById('edit-bio').value = bio;
            document.getElementById('prof-disp-name').textContent = name;
            document.getElementById('prof-disp-user').textContent = '@' + user;
        } catch(e) {}
        if (isDevUsername(user)) applyDevAccount(user);
        renderDevBadgeIfNeeded();
        saveState();
        window.changePage('home')
        vibrateSuccess();
        setTimeout(() => checkAndShowStreak(), 400);
    });
}
window.finishProfileSetup = finishProfileSetup

function showOnboardingIfNeeded() {
    if (!localStorage.getItem('geltcode_onboarded')) {
        window.changePage('welcome')
    } else if (!profileData.name) {
        // Already onboarded but no profile name (legacy save or reset)
        window.changePage('registration')
    } else {
        setTimeout(() => checkAndShowStreak(), 600);
        window.changePage('home')
    }
}

// ─── USERNAME CONFLICT MODAL ─────────────────────────────────────────────────
function showUsernameConflictModal(username) {
    document.getElementById('conflict-username').textContent = '@' + username;
    document.getElementById('username-conflict-modal').style.display = 'flex';
}
function closeUsernameConflictModal() {
    document.getElementById('username-conflict-modal').style.display = 'none';
}

// ─── DEVS TAB RENDERER ───────────────────────────────────────────────────────
function renderDevsTab() {
    const container = document.getElementById('devs-cards-list');
    if (!container) return;

    const devList = [
        {
            key: 'imperor',
            displayName: 'Imperor',
            role: 'Основатель & Frontend / UI',
            desc: 'Автор концепции, методология, дизайн интерфейса, мобильная адаптация и анимации.',
            icon: '👑',
            color: '#ffc800',
            bg: 'linear-gradient(135deg,rgba(255,200,0,0.12),rgba(255,140,0,0.05))',
            border: 'rgba(255,200,0,0.35)',
            iconBg: 'linear-gradient(135deg,#ffc800,#ff8c00)',
            titleLabel: 'Основатель',
        },
        {
            key: 'eenot',
            displayName: 'EEnot',
            role: 'Backend & Sandbox',
            desc: 'Серверная логика, безопасный sandbox для выполнения задач.',
            icon: '⚙️',
            color: '#1CB0F6',
            bg: 'var(--surface)',
            border: 'var(--surface-light)',
            iconBg: 'linear-gradient(135deg,#3a7bd5,#1CB0F6)',
            titleLabel: 'Разработчик',
        },
    ];

    container.innerHTML = devList.map(dev => {
        const isMe = (profileData.username || '').toLowerCase().replace(/[^a-z0-9_.]/g, '') === dev.key;
        const meBadge = isMe
            ? `<span style="background:rgba(88,204,2,0.15);color:var(--primary);border:1px solid var(--primary);border-radius:10px;padding:2px 8px;font-size:10px;font-weight:800;margin-left:6px;">ЭТО ТЫ</span>`
            : '';
        const titleBadge = `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(0,0,0,0.3);border:1px solid ${dev.color};border-radius:10px;padding:2px 8px;font-size:10px;font-weight:800;color:${dev.color};">${dev.icon} ${dev.titleLabel}</span>`;
        return `
    <div style="background:${dev.bg};border:1.5px solid ${dev.border};border-radius:18px;padding:18px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px;">
        <div style="width:48px;height:48px;border-radius:50%;background:${dev.iconBg};display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">${dev.icon}</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">
            <span style="font-size:15px;font-weight:900;color:${dev.color};">${dev.displayName}</span>
            ${meBadge}
          </div>
          <div style="font-size:11px;color:var(--text-muted);font-weight:700;margin-top:2px;">@${dev.key}</div>
          <div style="margin-top:5px;">${titleBadge}</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${dev.role}</div>
      <div style="font-size:12px;color:var(--text-muted);line-height:1.5;">${dev.desc}</div>
    </div>`;
    }).join('');
}

// ─── DEV BADGE in profile display ─────────────────────────────────────────────
function renderDevBadgeIfNeeded() {
    const normalized = (profileData.username || '').toLowerCase().replace(/[^a-z0-9_.]/g, '');
    const dev = DEV_ACCOUNTS[normalized];
    const badge = document.getElementById('dev-role-badge');
    if (!badge) return;
    if (dev) {
        badge.style.display = 'flex';
        badge.innerHTML = `<span style="font-size:14px;">${dev.icon}</span><span>${dev.role}</span>`;
        badge.style.borderColor = dev.color;
        badge.style.color = dev.color;
    } else {
        badge.style.display = 'none';
    }
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────
const LB_BOTS = [
    { name: 'PascalMaster', username: 'pascal_pro', xp: 2840, ava: '🤖' },
    { name: 'CodeDragon', username: 'c0d3dragon', xp: 2310, ava: '🐲' },
    { name: 'AlgoKing', username: 'algoking99', xp: 1980, ava: '👑' },
    { name: 'ByteNinja', username: 'byte_ninja', xp: 1650, ava: '🥷' },
    { name: 'StackFox', username: 'stack_fox', xp: 1320, ava: '🦊' },
    { name: 'VarGhost', username: 'var_ghost', xp: 980, ava: '👻' },
    { name: 'LoopWizard', username: 'loopwiz', xp: 740, ava: '🧙' },
    { name: 'DebugRaccoon', username: 'debug_rac', xp: 510, ava: '🦝' },
    { name: 'NullPointer', username: 'null_ptr', xp: 280, ava: '💀' },
];

function renderLeaderboard() {
    const myName = profileData.name || 'Ты';
    const myEntry = { name: myName, username: profileData.username || 'me', xp, ava: null, isMe: true };
    const all = [...LB_BOTS, myEntry].sort((a, b) => b.xp - a.xp);
    const myRank = all.findIndex(e => e.isMe) + 1;
    document.getElementById('lb-sub-label').textContent = `Твоё место: #${myRank} из ${all.length}`;

    const medals = ['🥇', '🥈', '🥉'];
    document.getElementById('lb-list').innerHTML = all.map((e, i) => {
        const rank = i + 1;
        const cls = e.isMe ? 'me' : rank === 1 ? 'top1' : rank === 2 ? 'top2' : rank === 3 ? 'top3' : '';
        const medal = medals[i] || rank;
        return `<div class="lb-row ${cls}">
      <div class="lb-rank">${medal}</div>
      <div class="lb-ava">${e.isMe && _avaImg ? `<canvas id="lb-me-canvas" width="42" height="42" style="width:42px;height:42px;border-radius:50%;"></canvas>` : `<span style="font-size:20px;">${e.ava || '👤'}</span>`}</div>
      <div class="lb-info">
        <div class="lb-name">${e.name}${e.isMe ? ' <span style="color:var(--secondary);font-size:10px;">ВЫ</span>' : ''}</div>
        <div class="lb-sub">@${e.username}</div>
      </div>
      <div class="lb-xp">⚡${e.xp}</div>
    </div>`;
    }).join('');
    // Draw user photo on lb canvas
    if (_avaImg) {
        requestAnimationFrame(() => {
            const lbC = document.getElementById('lb-me-canvas');
            if (lbC) {
                const ctx = lbC.getContext('2d');
                const S = 42;
                ctx.clearRect(0, 0, S, S);
                ctx.save();
                ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.clip();
                const short = Math.min(_avaImg.naturalWidth, _avaImg.naturalHeight);
                const drawW = (_avaImg.naturalWidth / short) * S;
                const drawH = (_avaImg.naturalHeight / short) * S;
                ctx.drawImage(_avaImg, (S - drawW) / 2, (S - drawH) / 2, drawW, drawH);
                ctx.restore();
            }
        });
    }
}

function goLeaderboard(el) {
    playClick();
    navActive(el);
    showScreenAnimated('scr-lb');
    try { renderLeaderboard(); } catch (e) { console.error('lb error', e); }
}

// ─── ANIMATED SCREEN TRANSITIONS ─────────────────────────────────────────────
function showScreenAnimated(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const next = document.getElementById(id);
    if (next) next.classList.add('active');
}

// ─── ENHANCED ANSWER FEEDBACK ────────────────────────────────────────────────
function flashCorrect(el) {
    el.classList.add('pop');
    setTimeout(() => el.classList.remove('pop'), 350);
    vibrateOk(); playCorrect();
}
function flashWrong(el) {
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 450);
    vibrateWrong(); playWrong();
}



// Init on load
loadState();

renderModulesList();
updateStats();
charState.bg = 0;

// Always init photo upload (for all users)
setTimeout(() => initAvaUpload(), 200);

// Splash → onboarding → app
runSplash(() => {
    showOnboardingIfNeeded();
});