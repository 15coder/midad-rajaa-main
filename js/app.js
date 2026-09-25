// ═══════════════════════════════════════════════════════════
//  مداد للمعرفة والتعلم — App Logic (iOS 27 PWA)
// ═══════════════════════════════════════════════════════════

'use strict';

/* ── Telegram Config ─────────────────────────────────────── */
const TG_USERNAME = 'Rv9_h';
const TG_CHAT_LINK = `https://t.me/${TG_USERNAME}`;
const THEME_PREFERENCE_KEY = 'mdad-theme';
const TG_BOT_API = 'https://api.telegram.org/bot';
// سيتم استخدام environment variables من Netlify:
// TG_BOT_TOKEN و TG_CHAT_ID

/* ── Service Worker Registration ─────────────────────────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('✅ SW registered:', reg.scope))
      .catch(err => console.warn('SW registration failed:', err));
  });
}

/* ── DOM Ready ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();
  initDeadlineField();
  initTypeChips();
  initOrderForm();
  initServiceSearch();
  initExpandableCards();
  initServiceFilters();
  initInstallPage();
  initHaptics();
  initAnimations();
});

/* ── Appearance ──────────────────────────────────────────── */
function initTheme() {
  const root = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  const label = document.getElementById('themeToggleLabel');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const statusBarMetas = document.querySelectorAll('meta[name="apple-mobile-web-app-status-bar-style"]');
  const systemPreference = window.matchMedia('(prefers-color-scheme: light)');

  const getSavedTheme = () => {
    try {
      return localStorage.getItem(THEME_PREFERENCE_KEY);
    } catch {
      return null;
    }
  };
  let hasManualChoice = Boolean(getSavedTheme());

  const applyTheme = (theme, persist = false) => {
    const isLight = theme === 'light';
    root.dataset.theme = isLight ? 'light' : 'dark';
    root.style.colorScheme = isLight ? 'light' : 'dark';

    if (toggle) {
      const nextModeLabel = isLight ? 'الوضع الداكن' : 'الوضع الفاتح';
      toggle.setAttribute('aria-label', `التبديل إلى ${nextModeLabel}`);
      toggle.title = `التبديل إلى ${nextModeLabel}`;
      if (label) label.textContent = nextModeLabel;
    }

    if (themeColor) themeColor.content = isLight ? '#f4f7fc' : '#0a0a0f';
    statusBarMetas.forEach(meta => {
      meta.content = isLight ? 'default' : 'black-translucent';
    });

    if (persist) {
      try {
        localStorage.setItem(THEME_PREFERENCE_KEY, isLight ? 'light' : 'dark');
      } catch (error) {
        console.warn('Theme preference could not be saved.', error);
      }
    }
  };

  applyTheme(root.dataset.theme === 'light' ? 'light' : 'dark');

  toggle?.addEventListener('click', () => {
    hasManualChoice = true;
    applyTheme(root.dataset.theme === 'light' ? 'dark' : 'light', true);
  });

  const syncWithSystem = () => {
    if (!hasManualChoice) applyTheme(systemPreference.matches ? 'light' : 'dark');
  };

  if (systemPreference.addEventListener) {
    systemPreference.addEventListener('change', syncWithSystem);
  } else {
    systemPreference.addListener(syncWithSystem);
  }

  window.addEventListener('storage', event => {
    if (event.key !== THEME_PREFERENCE_KEY) return;
    hasManualChoice = event.newValue === 'light' || event.newValue === 'dark';
    const nextTheme = event.newValue === 'light' || event.newValue === 'dark'
      ? event.newValue
      : systemPreference.matches ? 'light' : 'dark';
    applyTheme(nextTheme);
  });
}

/* ── Navigation ──────────────────────────────────────────── */
let aboutWelcomePlayed = false;

function playAboutWelcome() {
  if (aboutWelcomePlayed) return;

  const welcomeAudio = document.getElementById('welcomeAudio');
  if (!welcomeAudio) return;

  welcomeAudio.currentTime = 0;
  welcomeAudio.play()
    .then(() => {
      aboutWelcomePlayed = true;
    })
    .catch(() => {});
}

function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.page;

      if (target === 'about') playAboutWelcome();
      
      // Haptic feedback simulation
      vibrate(10);

      // Update nav
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      // Switch page
      pages.forEach(p => p.classList.remove('active'));
      const targetPage = document.getElementById(`page-${target}`);
      if (targetPage) {
        targetPage.classList.add('active');
        targetPage.scrollTop = 0;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

    });
  });
}

function navigateTo(pageId) {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');
  
  navItems.forEach(n => {
    n.classList.toggle('active', n.dataset.page === pageId);
  });
  
  pages.forEach(p => p.classList.remove('active'));
  if (pageId === 'about') playAboutWelcome();
  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) {
    targetPage.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/* ── Delivery Date ──────────────────────────────────────── */
function getLocalDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initDeadlineField() {
  const deadlineField = document.getElementById('fdeadline');
  if (!deadlineField) return;

  const today = getLocalDateString();
  deadlineField.min = today;
  deadlineField.addEventListener('input', () => {
    deadlineField.setCustomValidity(
      deadlineField.value && deadlineField.value < today
        ? 'يرجى اختيار تاريخ اليوم أو تاريخًا لاحقًا.'
        : ''
    );
  });
}

/* ── Order Form ──────────────────────────────────────────── */
const ORDER_DRAFT_KEY = 'mdad-order-draft';
const ORDER_PRICES = {
  'ملخص': 'يبدأ من 5 ريال',
  'عرض بوربوينت': 'يبدأ من 5 ريال',
  'واجب': 'يحدد بعد مراجعة التفاصيل',
  'بحث': 'يبدأ من 8 ريال',
  'ملف إنجاز': 'يبدأ من 15 ريال',
  'تصميم': 'يبدأ من 5 ريال',
  'ترجمة': 'يبدأ من 10 ريال',
  'سيرة ذاتية': 'يبدأ من 15 ريال',
  'خدمة حاسب': 'يبدأ من 3 ريال',
  'غير ذلك': 'يحدد بعد مراجعة التفاصيل'
};

function initOrderForm() {
  const form = document.getElementById('orderForm');
  if (!form) return;

  const submitButton = document.getElementById('submitBtn');
  const clearButton = document.getElementById('clearOrderForm');

  restoreOrderDraft(form);
  updateOrderEstimate();

  form.querySelectorAll('input:not([type="file"]), select, textarea').forEach(field => {
    field.addEventListener('input', () => {
      saveOrderDraft(form);
      clearFieldError(field);
    });
    field.addEventListener('change', () => saveOrderDraft(form));
  });

  document.querySelectorAll('.type-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      updateOrderEstimate(chip.dataset.type);
      saveOrderDraft(form);
    });
  });

  if (clearButton) {
    clearButton.addEventListener('click', () => {
      form.reset();
      clearOrderTypes();
      clearFormErrors(form);
      updateOrderEstimate();
      localStorage.removeItem(ORDER_DRAFT_KEY);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitButton?.classList.contains('loading')) return;

    const btn = submitButton;
    const values = getOrderValues();
    clearFormErrors(form);
    const errors = validateOrderValues(values);

    if (Object.keys(errors).length) {
      showFormErrors(errors);
      focusFirstInvalidField(errors);
      return;
    }

    if (!window.confirm('تم التحقق من بيانات الطلب. هل تريد فتح تيليجرام لإكمال الإرسال؟')) {
      return;
    }

    btn?.classList.add('loading');
    btn?.setAttribute('aria-busy', 'true');
    vibrate([10, 50, 10]);

    // توليد كود التحقق الفريد
    const verificationCode = generateVerificationCode();

    // إرسال مخفي إلى البوت (للتحقق والأرشفة)
    try {
      const botSent = await sendToTelegramBot(values, verificationCode);
      if (botSent) {
        console.log('✅ تم الإرسال إلى النظام بنجاح - كود التحقق:', verificationCode);
      }
    } catch (error) {
      console.warn('⚠️ خطأ في الإرسال إلى النظام:', error);
    }

    // Build Telegram message للمستخدم (مع كود المطابقة)
    const msg = buildTelegramMessage(values, verificationCode);

    // Open Telegram with pre-filled message
    const encodedMsg = encodeURIComponent(msg);
    const tgUrl = `https://t.me/${TG_USERNAME}?text=${encodedMsg}`;
    window.open(tgUrl, '_blank', 'noopener');

    await delay(250);
    btn?.classList.remove('loading');
    btn?.setAttribute('aria-busy', 'false');

    vibrate([10, 30, 10, 30, 80]);

    // Reset form after short delay
    setTimeout(() => {
      form.reset();
      clearOrderTypes();
      updateOrderEstimate();
      localStorage.removeItem(ORDER_DRAFT_KEY);
    }, 1500);
  });
}

function getOrderValues() {
  return {
    name: document.getElementById('fname')?.value.trim() || '',
    phone: document.getElementById('fphone')?.value.trim() || '',
    level: document.getElementById('flevel')?.value || '',
    subject: document.getElementById('fsubject')?.value.trim() || '',
    orderType: getSelectedOrderType(),
    deadline: document.getElementById('fdeadline')?.value || '',
    notes: document.getElementById('fnotes')?.value.trim() || '',
  };
}

function validateOrderValues(values) {
  const errors = {};
  if (!values.name) errors.fname = 'اكتب الاسم الكامل.';
  if (!/^05\d{8}$/.test(values.phone.replace(/\s/g, ''))) errors.fphone = 'أدخل رقم جوال صحيحًا من 10 أرقام يبدأ بـ 05.';
  if (!values.level) errors.flevel = 'اختر المرحلة الدراسية.';
  if (!values.subject) errors.fsubject = 'اكتب المادة أو التخصص.';
  if (!values.orderType) errors.orderType = 'اختر نوع طلب واحد.';
  if (!values.deadline) errors.fdeadline = 'اختر موعد التسليم.';
  if (values.deadline && values.deadline < getLocalDateString()) errors.fdeadline = 'لا يمكن اختيار موعد قبل اليوم.';
  return errors;
}

function showFormErrors(errors) {
  Object.entries(errors).forEach(([fieldId, message]) => {
    if (fieldId === 'orderType') {
      const chips = document.querySelector('.type-chips');
      if (!chips) return;
      let error = document.getElementById('orderTypeError');
      if (!error) {
        error = document.createElement('small');
        error.id = 'orderTypeError';
        error.className = 'field-error-message';
        chips.closest('.form-group')?.appendChild(error);
      }
      error.textContent = message;
      return;
    }

    const field = document.getElementById(fieldId);
    if (!field) return;
    field.classList.add('field-error');
    let error = document.getElementById(`${fieldId}Error`);
    if (!error) {
      error = document.createElement('small');
      error.id = `${fieldId}Error`;
      error.className = 'field-error-message';
      field.closest('.form-group')?.appendChild(error);
    }
    error.textContent = message;
  });
}

function clearFieldError(field) {
  field.classList.remove('field-error');
  document.getElementById(`${field.id}Error`)?.remove();
}

function clearFormErrors(form) {
  form.querySelectorAll('.field-error').forEach(field => field.classList.remove('field-error'));
  form.querySelectorAll('.field-error-message').forEach(error => error.remove());
}

function focusFirstInvalidField(errors) {
  const firstField = document.getElementById(Object.keys(errors)[0]);
  firstField?.focus();
}

function saveOrderDraft(form) {
  try {
    const values = Object.fromEntries(new FormData(form).entries());
    values.orderType = getSelectedOrderType();
    localStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify(values));
  } catch (error) {
    console.warn('Order draft could not be saved:', error);
  }
}

function restoreOrderDraft(form) {
  try {
    const draft = JSON.parse(localStorage.getItem(ORDER_DRAFT_KEY) || '{}');
    Object.entries(draft).forEach(([id, value]) => {
      const field = form.elements.namedItem(id) || document.getElementById(id);
      if (field && id !== 'orderType') field.value = value;
    });
    if (draft.orderType) {
      [...document.querySelectorAll('.type-chip')]
        .find(chip => chip.dataset.type === draft.orderType)
        ?.click();
    }
  } catch (error) {
    localStorage.removeItem(ORDER_DRAFT_KEY);
  }
}

function updateOrderEstimate(type = getSelectedOrderType()) {
  const value = document.getElementById('estimateValue');
  if (value) value.textContent = ORDER_PRICES[type] || 'اختر نوع الطلب لمعرفة السعر المبدئي';
}

function buildTelegramMessage({ name, phone, level, subject, orderType, deadline, notes }, verificationCode) {
  const lines = [
    '📚 *طلب جديد من متجر مداد*',
    '━━━━━━━━━━━━━━━━━━',
    `🔐 *كود المطابقة:* \`${verificationCode}\``,
    '━━━━━━━━━━━━━━━━━━',
    `👤 *الاسم:* ${name}`,
    `📱 *الجوال:* ${phone}`,
    `🎓 *المرحلة الدراسية:* ${level}`,
    `📖 *المادة:* ${subject}`,
    `📋 *نوع الطلب:* ${orderType}`,
    `📅 *موعد التسليم:* ${deadline}`,
  ];

  if (notes) {
    lines.push(`📝 *ملاحظات:* ${notes}`);
  }

  lines.push('━━━━━━━━━━━━━━━━━━');
  lines.push('_تم الإرسال من تطبيق مداد للمعرفة والتعلم_ 🌟');
  lines.push('');
  lines.push('⚠️ *مهم:* احتفظ بكود المطابقة للتأكد من صحة الطلب');

  return lines.join('\n');
}

/* ── Order Type Selection ────────────────────────────────── */
let selectedType = '';

function generateVerificationCode() {
  // توليد كود تحقق فريد (8 أحرف وأرقام عشوائية)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function sendToTelegramBot(orderData, verificationCode) {
  try {
    // إرسال البيانات إلى Netlify Function
    const response = await fetch('/.netlify/functions/send-to-bot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...orderData,
        verificationCode: verificationCode
      })
    });

    if (!response.ok) {
      throw new Error('Failed to send to bot');
    }

    const result = await response.json();
    return result.success;

  } catch (error) {
    console.error('Telegram send error:', error);
    return false;
  }
}

function initTypeChips() {
  const chips = document.querySelectorAll('.type-chip');
  chips.forEach(chip => {
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('click', () => {
      selectedType = chip.dataset.type;
      chips.forEach(option => {
        const isSelected = option === chip;
        option.classList.toggle('selected', isSelected);
        option.setAttribute('aria-pressed', String(isSelected));
      });
      
      vibrate(5);
    });
  });
}

function getSelectedOrderType() {
  return selectedType;
}

function clearOrderTypes() {
  selectedType = '';
  document.querySelectorAll('.type-chip').forEach(chip => {
    chip.classList.remove('selected');
    chip.setAttribute('aria-pressed', 'false');
  });
}

/* ── Expandable Service Cards ────────────────────────────── */
function initExpandableCards() {
  const modal = document.getElementById('serviceDetailsModal');
  const modalTitle = document.getElementById('serviceDetailsTitle');
  const modalContent = document.getElementById('serviceDetailsContent');
  const closeButton = document.getElementById('closeServiceDetails');
  let activeButton = null;

  if (!modal || !modalTitle || !modalContent || !closeButton) return;

  const closeDetails = () => {
    modal.classList.remove('is-open');
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    activeButton?.setAttribute('aria-expanded', 'false');
    activeButton?.focus();
    activeButton = null;
  };

  document.querySelectorAll('.expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.service-card');
      const details = btn.previousElementSibling;
      const title = card?.querySelector('.service-card-title')?.textContent.trim();
      if (!card || !details || !title) return;

      modalTitle.textContent = title;
      modalContent.innerHTML = details.innerHTML;
      modal.hidden = false;
      modal.classList.add('is-open');
      document.body.classList.add('modal-open');
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-controls', 'serviceDetailsModal');
      activeButton = btn;
      closeButton.focus();
      
      vibrate(8);
    });
  });

  closeButton.addEventListener('click', closeDetails);
  modal.addEventListener('click', event => {
    if (event.target === modal) closeDetails();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.hidden) closeDetails();
  });
}

/* ── Service Category Filter ─────────────────────────────── */
let currentServiceCategory = 'all';

function initServiceFilters() {
  const pills = document.querySelectorAll('.cat-pill');

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      setServiceCategory(pill.dataset.cat);
    });
  });
}

function setServiceCategory(category) {
  currentServiceCategory = category;
  document.querySelectorAll('.cat-pill').forEach(pill => {
    const active = pill.dataset.cat === category;
    pill.classList.toggle('active', active);
    pill.setAttribute('aria-selected', String(active));
  });
  applyServiceFilters();
  vibrate(5);
}

function initServiceSearch() {
  const search = document.getElementById('serviceSearch');
  const clearButton = document.getElementById('clearServiceSearch');
  if (!search) return;

  document.querySelectorAll('.service-card[data-category]').forEach(card => {
    const price = card.querySelector('.price-row-value')?.textContent.trim();
    const header = card.querySelector('.service-card-header');
    if (price && header && !header.querySelector('.service-starting-price')) {
      const badge = document.createElement('span');
      badge.className = 'service-starting-price';
      badge.textContent = `من ${price}`;
      header.querySelector('div:last-child')?.appendChild(badge);
    }
  });

  search.addEventListener('input', applyServiceFilters);
  clearButton?.addEventListener('click', () => {
    search.value = '';
    setServiceCategory('all');
    search.focus();
  });
  applyServiceFilters();
}

function applyServiceFilters() {
  const search = document.getElementById('serviceSearch');
  const query = search?.value.trim().toLocaleLowerCase('ar') || '';
  const cards = document.querySelectorAll('.service-card[data-category]');
  let visibleCount = 0;

  cards.forEach(card => {
    const matchesCategory = currentServiceCategory === 'all' || card.dataset.category === currentServiceCategory;
    const matchesSearch = !query || card.textContent.toLocaleLowerCase('ar').includes(query);
    const visible = matchesCategory && matchesSearch;
    card.hidden = !visible;
    if (visible) {
      visibleCount += 1;
      card.style.animation = 'pageIn 0.3s ease forwards';
    }
  });

  const count = document.getElementById('servicesCount');
  if (count) count.textContent = `${visibleCount} خدمة`;
  const empty = document.getElementById('servicesEmpty');
  if (empty) empty.hidden = visibleCount !== 0;
}

/* ── PWA Install ─────────────────────────────────────── */
let deferredPrompt = null;

function initInstallPage() {
  const installButton = document.getElementById('installPwaBtn');
  const directPanel = document.getElementById('installDirect');
  const iosPanel = document.getElementById('installIos');
  const installedStatus = document.getElementById('installStatus');
  const fallback = document.getElementById('installFallback');
  const deviceNote = document.getElementById('installDeviceNote');
  if (!installButton || !directPanel || !iosPanel || !installedStatus) return;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  if (isStandalone) {
    showInstalledState({ directPanel, iosPanel, installedStatus, installButton, deviceNote });
  } else if (isIOS) {
    directPanel.hidden = true;
    iosPanel.hidden = false;
    installButton.hidden = true;
    if (deviceNote) deviceNote.textContent = 'اتبع الخطوات الظاهرة لإضافة مداد من Safari إلى الشاشة الرئيسية.';
  } else {
    directPanel.hidden = false;
    iosPanel.hidden = true;
    installButton.hidden = false;
    if (deviceNote) deviceNote.textContent = 'اضغط الزر لإظهار نافذة التثبيت الرسمية من المتصفح.';
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installButton.disabled = false;
    if (fallback) fallback.hidden = true;
  });

  installButton.addEventListener('click', async () => {
    vibrate([10, 20]);
    if (deferredPrompt) {
      await triggerInstallPrompt(installButton);
    } else if (fallback) {
      fallback.hidden = false;
    }
  });

  window.addEventListener('appinstalled', () => {
    showInstalledState({ directPanel, iosPanel, installedStatus, installButton, deviceNote });
  });
}

function showInstalledState({ directPanel, iosPanel, installedStatus, installButton, deviceNote }) {
  directPanel.hidden = true;
  iosPanel.hidden = true;
  installedStatus.hidden = false;
  installButton.hidden = true;
  if (deviceNote) deviceNote.textContent = '';
}

async function triggerInstallPrompt(installButton) {
  if (!deferredPrompt) return;
  try {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      vibrate([30, 50, 80]);
      installButton.disabled = true;
    }
    deferredPrompt = null;
  } catch (err) {
    console.warn('Install prompt error:', err);
  }
}

/* ── Haptic Feedback ─────────────────────────────────────── */
function initHaptics() {
  // Add haptics to all buttons
  document.querySelectorAll('.btn-primary, .btn-secondary, .btn-submit').forEach(btn => {
    btn.addEventListener('touchstart', () => vibrate(8), { passive: true });
  });
}

function vibrate(pattern) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

/* ── Intersection Observer Animations ────────────────────── */
function initAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'pageIn 0.5s ease forwards';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.glass-card, .install-step, .stat-card').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });
}

/* ── Utilities ───────────────────────────────────────────── */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ── Quick Order (from service card) ────────────────────── */
function quickOrder(serviceName) {
  navigateTo('order');
  
  setTimeout(() => {
    const notesField = document.getElementById('fnotes');
    if (notesField) {
      notesField.value = `الخدمة المطلوبة: ${serviceName}`;
    }
    
    // Auto-select matching type chip
    document.querySelectorAll('.type-chip').forEach(chip => {
      if (chip.dataset.type === serviceName || chip.textContent.includes(serviceName.split(' ')[0])) {
        chip.click();
      }
    });
  }, 300);

  vibrate([10, 20]);
}

/* ── Counter Animation ───────────────────────────────────── */
function animateCounter(el, target, duration = 1500) {
  let start = 0;
  const step = target / (duration / 16);
  
  const timer = setInterval(() => {
    start += step;
    if (start >= target) {
      el.textContent = target + (el.dataset.suffix || '');
      clearInterval(timer);
    } else {
      el.textContent = Math.floor(start) + (el.dataset.suffix || '');
    }
  }, 16);
}

// Init counters when visible
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const target = parseInt(el.dataset.count);
      animateCounter(el, target);
      counterObserver.unobserve(el);
    }
  });
});

document.querySelectorAll('.stat-number[data-count]').forEach(el => {
  counterObserver.observe(el);
});
