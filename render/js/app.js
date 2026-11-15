// SMART BIRTHDAY CELEBRATION SYSTEM - CORE APPLICATION LOGIC
import { DateEngine, MONTH_NAMES, MONTH_SHORT_NAMES, WEEKDAYS } from './dateEngine.js';
import { generatePersonalizedMessage } from './messageGenerator.js';
import { launchConfetti } from './confetti.js';
import { sound } from './soundEffects.js';
import { initParticleCanvas } from './particles.js';
import { EMBEDDED_PEOPLE } from './dataFallback.js';

class BirthdayApp {
  constructor() {
    this.rawPeople = EMBEDDED_PEOPLE || [];
    this.evaluatedPeople = [];
    this.currentView = 'home';
    this.dateEngine = new DateEngine();
    this.simulatedTime = { active: false, hours: 16, minutes: 0, seconds: 0 }; // 4:00 PM preview
    
    // States
    this.selectedPersonId = null;
    this.upcomingFilter = 'all'; // '7days', '30days', 'thisMonth', 'nextMonth', 'all'
    this.directorySearch = '';
    this.directoryMonth = 'all';
    this.directorySort = 'nearest'; // 'nearest', 'az', 'za', 'youngest', 'oldest'
    this.directoryGroup = false;

    // Calendar state
    const today = this.dateEngine.getTodayComponents();
    this.calYear = today.year;
    this.calMonth = today.month; // 1 - 12
    this.selectedCalDate = null;

    // Global Search State
    this.globalSearchOpen = false;

    // Live clock timer
    this.clockInterval = null;
  }

  async init() {
    initParticleCanvas();
    this.bindEvents();
    await this.loadData();
    this.startDigitalClock();
    
    // Default selected person for Individual Lookup (choose one celebrating today or first person)
    const todayBday = this.evaluatedPeople.find(p => p.isToday);
    this.selectedPersonId = todayBday ? todayBday.id : (this.evaluatedPeople[0]?.id || null);

    this.render();

    // Check if birthdays today and launch confetti on first load
    const todayBirthdays = this.evaluatedPeople.filter(p => p.isToday);
    if (todayBirthdays.length > 0) {
      setTimeout(() => {
        launchConfetti(0.5, 0.4);
        sound.playCelebration();
      }, 600);
    }
  }

  async loadData() {
    try {
      const response = await fetch('./birthdays.json');
      if (response.ok) {
        const fetched = await response.json();
        if (Array.isArray(fetched) && fetched.length > 0) {
          this.rawPeople = fetched;
        }
      }
    } catch (err) {
      console.log('Using pre-bundled birthday dataset');
    }

    this.evaluateDataset();
  }

  evaluateDataset() {
    this.evaluatedPeople = this.dateEngine.evaluateAll(this.rawPeople);
  }

  startDigitalClock() {
    const update = () => {
      const now = new Date();

      // Check if calendar date rolled over while the page was kept open (e.g. at midnight)
      const currentToday = this.dateEngine.getTodayComponents();
      if (now.getDate() !== currentToday.day || (now.getMonth() + 1) !== currentToday.month || now.getFullYear() !== currentToday.year) {
        this.dateEngine.setReferenceDate(now);
        this.evaluateDataset();
        if (this.currentView === 'home' || this.currentView === 'today' || this.currentView === 'upcoming' || this.currentView === 'calendar') {
          this.render();
          return;
        }
      }

      let hours = this.simulatedTime.active ? this.simulatedTime.hours : now.getHours();
      let minutes = this.simulatedTime.active ? this.simulatedTime.minutes : now.getMinutes();
      let seconds = this.simulatedTime.active ? this.simulatedTime.seconds : now.getSeconds();

      if (this.simulatedTime.active) {
        this.simulatedTime.seconds = (this.simulatedTime.seconds + 1) % 60;
        if (this.simulatedTime.seconds === 0) {
          this.simulatedTime.minutes = (this.simulatedTime.minutes + 1) % 60;
        }
      }

      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const hoursStr = String(displayHours).padStart(2, '0');
      const minutesStr = String(minutes).padStart(2, '0');
      const secondsStr = String(seconds).padStart(2, '0');

      const timeEl = document.getElementById('live-clock-time');
      if (timeEl) {
        timeEl.innerHTML = `${hoursStr}<span class="clock-colon">:</span>${minutesStr}<span class="clock-colon">:</span>${secondsStr} <span class="clock-ampm">${ampm}</span>`;
      }

      const dateEl = document.getElementById('live-clock-date');
      if (dateEl) {
        dateEl.textContent = `${now.getDate()} ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
      }

      const dayEl = document.getElementById('live-clock-day');
      if (dayEl) {
        dayEl.textContent = WEEKDAYS[now.getDay()].toUpperCase();
      }
    };

    update();
    this.clockInterval = setInterval(update, 1000);
  }

  toggleTimeSimulation() {
    this.simulatedTime.active = !this.simulatedTime.active;
    if (this.simulatedTime.active) {
      this.simulatedTime.hours = 16; // 4:00 PM
      this.simulatedTime.minutes = 0;
      this.simulatedTime.seconds = 0;
    }
    const btn = document.getElementById('toggle-4pm-preview');
    if (btn) {
      btn.textContent = this.simulatedTime.active ? '🕒 Mode: 4:00 PM Today' : '🕒 Mode: Live Clock';
      btn.classList.toggle('border-cyan-400', this.simulatedTime.active);
      btn.classList.toggle('text-cyan-300', this.simulatedTime.active);
    }
  }

  bindEvents() {
    // Navigation items
    document.querySelectorAll('[data-view-target]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.getAttribute('data-view-target');
        sound.playClick();
        this.navigateTo(view);
      });
    });

    // Sound toggle button
    const soundBtn = document.getElementById('sound-toggle-btn');
    if (soundBtn) {
      this.updateSoundBtnUI(soundBtn);
      soundBtn.addEventListener('click', () => {
        const enabled = sound.toggle();
        this.updateSoundBtnUI(soundBtn);
      });
    }

    // Global Search trigger
    const searchTrigger = document.getElementById('global-search-trigger');
    if (searchTrigger) {
      searchTrigger.addEventListener('click', () => {
        this.openGlobalSearch();
      });
    }

    // Keyboard shortcuts (Ctrl+K or '/' for search, Esc to close modals)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.openGlobalSearch();
      } else if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
        e.preventDefault();
        this.openGlobalSearch();
      } else if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });

    // Mobile menu toggle
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mobileNav = document.getElementById('mobile-nav-drawer');
    if (mobileBtn && mobileNav) {
      mobileBtn.addEventListener('click', () => {
        mobileNav.classList.toggle('hidden');
      });
    }
  }

  updateSoundBtnUI(btn) {
    if (sound.enabled) {
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
      btn.title = "Audio Feedback: ON";
      btn.classList.add('text-cyan-400');
    } else {
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;
      btn.title = "Audio Feedback: OFF";
      btn.classList.remove('text-cyan-400');
    }
  }

  navigateTo(view, personId = null) {
    this.currentView = view;
    if (personId) {
      this.selectedPersonId = personId;
    }

    // Update active nav button (desktop and mobile bottom bar)
    document.querySelectorAll('[data-view-target]').forEach(btn => {
      const v = btn.getAttribute('data-view-target');
      if (v === view) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Close mobile menu if open
    const mobileNav = document.getElementById('mobile-nav-drawer');
    if (mobileNav) mobileNav.classList.add('hidden');

    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (view === 'today') {
      const todayCount = this.evaluatedPeople.filter(p => p.isToday).length;
      if (todayCount > 0) {
        launchConfetti(0.5, 0.5);
        sound.playCelebration();
      }
    }
  }

  openGlobalSearch() {
    this.globalSearchOpen = true;
    const modal = document.getElementById('global-search-modal');
    if (modal) {
      modal.classList.remove('hidden');
      const input = document.getElementById('global-search-input');
      if (input) {
        input.value = '';
        input.focus();
        this.renderGlobalSearchResults('');
      }
    }
  }

  closeAllModals() {
    this.globalSearchOpen = false;
    const searchModal = document.getElementById('global-search-modal');
    if (searchModal) searchModal.classList.add('hidden');

    const calModal = document.getElementById('calendar-date-modal');
    if (calModal) calModal.classList.add('hidden');
  }

  render() {
    const mainContainer = document.getElementById('view-content-root');
    if (!mainContainer) return;

    // Update badge in navigation for Today's birthdays
    const todayCount = this.evaluatedPeople.filter(p => p.isToday).length;
    const todayBadge = document.getElementById('today-nav-badge');
    if (todayBadge) {
      todayBadge.textContent = todayCount;
      if (todayCount > 0) {
        todayBadge.classList.add('pulse');
      } else {
        todayBadge.classList.remove('pulse');
      }
    }

    const mobileTodayDot = document.getElementById('mobile-today-dot');
    if (mobileTodayDot) {
      if (todayCount > 0) {
        mobileTodayDot.style.display = 'block';
      } else {
        mobileTodayDot.style.display = 'none';
      }
    }

    switch (this.currentView) {
      case 'home':
        mainContainer.innerHTML = this.renderHomeDashboard();
        this.attachHomeEvents();
        break;
      case 'today':
        mainContainer.innerHTML = this.renderTodaySection();
        this.attachTodayEvents();
        break;
      case 'upcoming':
        mainContainer.innerHTML = this.renderUpcomingSection();
        this.attachUpcomingEvents();
        break;
      case 'lookup':
        mainContainer.innerHTML = this.renderLookupSection();
        this.attachLookupEvents();
        break;
      case 'directory':
        mainContainer.innerHTML = this.renderDirectorySection();
        this.attachDirectoryEvents();
        break;
      case 'calendar':
        mainContainer.innerHTML = this.renderCalendarSection();
        this.attachCalendarEvents();
        break;
      case 'statistics':
        mainContainer.innerHTML = this.renderStatisticsSection();
        this.attachStatisticsEvents();
        break;
      default:
        mainContainer.innerHTML = this.renderHomeDashboard();
        this.attachHomeEvents();
    }
  }

  // ==========================================
  // SECTION 1: HOME DASHBOARD
  // ==========================================
  renderHomeDashboard() {
    const today = this.dateEngine.getTodayComponents();
    const formattedDate = `${today.day} ${MONTH_NAMES[today.month - 1]} ${today.year}`;
    const formattedDay = (today.weekday || '').toUpperCase();
    const totalPeople = this.evaluatedPeople.length;
    const todayPeople = this.evaluatedPeople.filter(p => p.isToday);
    const thisWeekPeople = this.evaluatedPeople.filter(p => !p.isToday && p.daysRemaining <= 7);
    const thisMonthPeople = this.evaluatedPeople.filter(p => p.birthMonth === today.month);

    // Next 5 upcoming
    const nextFive = this.evaluatedPeople
      .filter(p => !p.isToday && p.daysRemaining < 9999)
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 5);

    return `
      <!-- Hero Banner -->
      <section class="dashboard-hero">
        <div>
          <div class="hero-tag">
            <span class="hero-tag-pulse"></span>
            NTTF M3B Batch Celebration Matrix
          </div>
          <h1 class="hero-heading">NTTF M3B <span>STUDENTS BIRTHDAY</span></h1>
          <p class="hero-subtext">
            Smart celebration system and birthday directory for NTTF M3B students. Real-time birthday tracking, precision age calculations, and personalized milestone greetings.
          </p>
        </div>
        
        <!-- Live Clock -->
        <div class="digital-clock-card">
          <div class="clock-time" id="live-clock-time">--<span class="clock-colon">:</span>--<span class="clock-colon">:</span>-- <span class="clock-ampm">--</span></div>
          <div class="clock-date" id="live-clock-date">${formattedDate}</div>
          <div class="clock-day" id="live-clock-day">${formattedDay}</div>
          <button id="toggle-4pm-preview" class="text-[10px] font-mono px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 mt-2 cursor-pointer transition-all">
            🕒 Preview: 4:00 PM Today
          </button>
        </div>
      </section>

      <!-- KPI Metrics -->
      <div class="metrics-grid">
        <div class="metric-card glass-panel" style="--card-accent: #00F0FF;">
          <div class="metric-info">
            <h4>Total Records</h4>
            <div class="metric-value">${totalPeople}</div>
            <div class="metric-sub">Verified dataset profiles</div>
          </div>
          <div class="metric-icon-box text-cyan-400">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
        </div>

        <div class="metric-card glass-panel" style="--card-accent: #F43F5E;">
          <div class="metric-info">
            <h4>Birthdays Today</h4>
            <div class="metric-value text-rose-400">${todayPeople.length}</div>
            <div class="metric-sub">${todayPeople.length > 0 ? 'Active celebrations now!' : 'No birthdays today'}</div>
          </div>
          <div class="metric-icon-box text-rose-400">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="4" rx="1"></rect><path d="M12 8v13"></path><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"></path><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.9 4.9 0 0 1 12 8a4.9 4.9 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"></path></svg>
          </div>
        </div>

        <div class="metric-card glass-panel" style="--card-accent: #A855F7;">
          <div class="metric-info">
            <h4>This Week</h4>
            <div class="metric-value text-purple-400">${thisWeekPeople.length}</div>
            <div class="metric-sub">Upcoming in next 7 days</div>
          </div>
          <div class="metric-icon-box text-purple-400">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          </div>
        </div>

        <div class="metric-card glass-panel" style="--card-accent: #38BDF8;">
          <div class="metric-info">
            <h4>This Month</h4>
            <div class="metric-value text-sky-400">${thisMonthPeople.length}</div>
            <div class="metric-sub">Born in ${MONTH_NAMES[today.month - 1]}</div>
          </div>
          <div class="metric-icon-box text-sky-400">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
        </div>
      </div>

      <!-- Today's Birthday Preview -->
      <div class="mb-10">
        <div class="section-header">
          <div class="section-title-wrap">
            <div class="section-icon-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </div>
            <div>
              <h2 class="section-heading">TODAY'S CELEBRATIONS</h2>
              <p class="section-subtext">Honoring those born on ${today.day} ${MONTH_NAMES[today.month - 1]}</p>
            </div>
          </div>
          ${todayPeople.length > 0 ? `
            <button class="cal-nav-btn text-rose-300 border-rose-500/40" id="trigger-home-confetti">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              Burst Celebration Confetti
            </button>
          ` : ''}
        </div>

        ${todayPeople.length > 0 ? `
          <div class="cards-grid">
            ${todayPeople.map(p => this.renderTodayCardHtml(p)).join('')}
          </div>
        ` : `
          <div class="glass-panel empty-state-box">
            <div class="empty-icon-circle">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            </div>
            <h3 class="empty-title">No Birthdays Today</h3>
            <p class="empty-subtext">No registered birthdays match today's date (${today.day} ${MONTH_NAMES[today.month - 1]}). Check upcoming birthdays below!</p>
          </div>
        `}
      </div>

      <!-- Next Five Upcoming Birthdays -->
      <div class="mb-10">
        <div class="section-header">
          <div class="section-title-wrap">
            <div class="section-icon-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 10"></polyline></svg>
            </div>
            <div>
              <h2 class="section-heading">NEXT UPCOMING BIRTHDAYS</h2>
              <p class="section-subtext">Nearest milestone dates approaching in the calendar</p>
            </div>
          </div>
          <button class="cal-nav-btn" data-view-target="upcoming">
            View All Upcoming &rarr;
          </button>
        </div>

        <div class="cards-grid">
          ${nextFive.map(p => this.renderUpcomingCardHtml(p)).join('')}
        </div>
      </div>

      <!-- Quick Navigation Grid -->
      <div class="mt-12">
        <div class="section-header">
          <div class="section-title-wrap">
            <div class="section-icon-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            </div>
            <div>
              <h2 class="section-heading">SYSTEM NAVIGATION</h2>
              <p class="section-subtext">Direct portals to system features</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div class="glass-panel p-6 cursor-pointer hover:border-cyan-400" data-view-target="lookup">
            <div class="w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
            <h3 class="font-display font-bold text-lg text-white mb-1">Individual Lookup</h3>
            <p class="text-sm text-slate-400">Search and display dedicated personal birthday cards and countdown profiles.</p>
          </div>

          <div class="glass-panel p-6 cursor-pointer hover:border-purple-400" data-view-target="directory">
            <div class="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </div>
            <h3 class="font-display font-bold text-lg text-white mb-1">All People Directory</h3>
            <p class="text-sm text-slate-400">Browse the complete dataset with month filters, search, and sorting options.</p>
          </div>

          <div class="glass-panel p-6 cursor-pointer hover:border-sky-400" data-view-target="calendar">
            <div class="w-12 h-12 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <h3 class="font-display font-bold text-lg text-white mb-1">Birthday Calendar</h3>
            <p class="text-sm text-slate-400">Interactive 12-month calendar grid with date highlights and popup profiles.</p>
          </div>
        </div>
      </div>
    `;
  }

  attachHomeEvents() {
    const previewBtn = document.getElementById('toggle-4pm-preview');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        sound.playClick();
        this.toggleTimeSimulation();
      });
    }

    const confettiBtn = document.getElementById('trigger-home-confetti');
    if (confettiBtn) {
      confettiBtn.addEventListener('click', () => {
        launchConfetti(0.5, 0.4);
        sound.playCelebration();
      });
    }

    document.querySelectorAll('[data-person-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-person-id');
        this.navigateTo('lookup', id);
      });
    });
  }

  // ==========================================
  // SECTION 2: TODAY'S BIRTHDAYS
  // ==========================================
  renderTodaySection() {
    const today = this.dateEngine.getTodayComponents();
    const todayPeople = this.evaluatedPeople.filter(p => p.isToday);

    return `
      <div class="section-header">
        <div class="section-title-wrap">
          <div class="section-icon-badge text-rose-400 bg-rose-500/10 border-rose-500/30">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </div>
          <div>
            <h2 class="section-heading">TODAY'S BIRTHDAYS</h2>
            <p class="section-subtext">Celebrating milestones today (${today.day} ${MONTH_NAMES[today.month - 1]} ${today.year})</p>
          </div>
        </div>
        ${todayPeople.length > 0 ? `
          <button class="cal-nav-btn text-rose-300 border-rose-500/40" id="today-confetti-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"></path></svg>
            Trigger Celebration Effects
          </button>
        ` : ''}
      </div>

      ${todayPeople.length > 0 ? `
        <div class="cards-grid">
          ${todayPeople.map(p => this.renderTodayCardHtml(p)).join('')}
        </div>
      ` : `
        <div class="glass-panel empty-state-box">
          <div class="empty-icon-circle">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><path d="M8 12h8"></path></svg>
          </div>
          <h3 class="empty-title">No Birthdays Today</h3>
          <p class="empty-subtext">There are no birthdays registered for today (${today.day} ${MONTH_NAMES[today.month - 1]}). Browse upcoming birthdays or check the calendar!</p>
          <button class="cal-nav-btn mt-6" data-view-target="upcoming">Browse Upcoming Birthdays</button>
        </div>
      `}
    `;
  }

  attachTodayEvents() {
    const btn = document.getElementById('today-confetti-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        launchConfetti(0.5, 0.4);
        sound.playCelebration();
      });
    }

    document.querySelectorAll('[data-person-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-person-id');
        this.navigateTo('lookup', id);
      });
    });
  }

  renderTodayCardHtml(person) {
    const greeting = generatePersonalizedMessage(person);
    return `
      <div class="birthday-card-today">
        <div class="today-banner">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          CELEBRATING TODAY!
        </div>

        <div class="cake-avatar-box">
          <span style="font-size: 2rem;">🎂</span>
        </div>

        <h3 class="person-card-name">${person.name}</h3>

        <div class="person-details-grid">
          <div class="detail-item">
            <span class="detail-label">Date of Birth</span>
            <span class="detail-value highlight-cyan">${person.formattedDob}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Current Age</span>
            <span class="detail-value highlight-purple">${person.currentAge !== null ? `${person.currentAge} Years` : 'N/A'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Birthday Status</span>
            <span class="detail-value text-rose-400 font-bold">Today! 🎉</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Milestone</span>
            <span class="detail-value">${person.currentAge ? `Turning ${person.currentAge}` : 'Celebration'}</span>
          </div>
        </div>

        <div class="wish-quote-box">
          "${greeting}"
        </div>

        <button class="card-action-btn" data-person-id="${person.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          Open Individual Profile
        </button>
      </div>
    `;
  }

  // ==========================================
  // SECTION 3: UPCOMING BIRTHDAYS
  // ==========================================
  renderUpcomingSection() {
    const today = this.dateEngine.getTodayComponents();

    // Filters: '7days', '30days', 'thisMonth', 'nextMonth', 'all'
    const upcomingList = this.evaluatedPeople
      .filter(p => !p.isToday && p.daysRemaining < 9999)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    let filtered = upcomingList;
    if (this.upcomingFilter === '7days') {
      filtered = upcomingList.filter(p => p.daysRemaining <= 7);
    } else if (this.upcomingFilter === '30days') {
      filtered = upcomingList.filter(p => p.daysRemaining <= 30);
    } else if (this.upcomingFilter === 'thisMonth') {
      filtered = upcomingList.filter(p => p.birthMonth === today.month);
    } else if (this.upcomingFilter === 'nextMonth') {
      const nextMonthNum = today.month === 12 ? 1 : today.month + 1;
      filtered = upcomingList.filter(p => p.birthMonth === nextMonthNum);
    }

    return `
      <div class="section-header">
        <div class="section-title-wrap">
          <div class="section-icon-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div>
            <h2 class="section-heading">UPCOMING BIRTHDAYS</h2>
            <p class="section-subtext">Chronologically ordered milestones (December-to-January transitions included)</p>
          </div>
        </div>

        <!-- Filter tabs -->
        <div class="filter-tabs">
          <button class="filter-tab-btn ${this.upcomingFilter === '7days' ? 'active' : ''}" data-up-filter="7days">Next 7 Days</button>
          <button class="filter-tab-btn ${this.upcomingFilter === '30days' ? 'active' : ''}" data-up-filter="30days">Next 30 Days</button>
          <button class="filter-tab-btn ${this.upcomingFilter === 'thisMonth' ? 'active' : ''}" data-up-filter="thisMonth">This Month</button>
          <button class="filter-tab-btn ${this.upcomingFilter === 'nextMonth' ? 'active' : ''}" data-up-filter="nextMonth">Next Month</button>
          <button class="filter-tab-btn ${this.upcomingFilter === 'all' ? 'active' : ''}" data-up-filter="all">All Upcoming (${upcomingList.length})</button>
        </div>
      </div>

      ${filtered.length > 0 ? `
        <div class="cards-grid">
          ${filtered.map(p => this.renderUpcomingCardHtml(p)).join('')}
        </div>
      ` : `
        <div class="glass-panel empty-state-box">
          <div class="empty-icon-circle">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <h3 class="empty-title">No Matching Birthdays</h3>
          <p class="empty-subtext">No upcoming birthdays match this filter criteria. Try selecting "All Upcoming".</p>
        </div>
      `}
    `;
  }

  attachUpcomingEvents() {
    document.querySelectorAll('[data-up-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.upcomingFilter = e.currentTarget.getAttribute('data-up-filter');
        sound.playClick();
        this.render();
      });
    });

    document.querySelectorAll('[data-person-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-person-id');
        this.navigateTo('lookup', id);
      });
    });
  }

  renderUpcomingCardHtml(person) {
    let badgeClass = 'badge-standard';
    let badgeLabel = `In ${person.daysRemaining} days`;

    if (person.daysRemaining === 1) {
      badgeClass = 'badge-near';
      badgeLabel = 'Tomorrow!';
    } else if (person.daysRemaining <= 7) {
      badgeClass = 'badge-near';
      badgeLabel = `In ${person.daysRemaining} days`;
    } else if (person.daysRemaining <= 30) {
      badgeClass = 'badge-month';
      badgeLabel = `In ${person.daysRemaining} days`;
    }

    return `
      <div class="upcoming-card">
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="upcoming-badge ${badgeClass}">${badgeLabel}</span>
            <span class="text-xs font-mono text-cyan-400">${person.nextBirthdayWeekday}</span>
          </div>

          <h3 class="person-card-name text-lg mb-2">${person.name}</h3>

          <div class="person-details-grid">
            <div class="detail-item">
              <span class="detail-label">Date of Birth</span>
              <span class="detail-value">${person.formattedDob}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Next Birthday</span>
              <span class="detail-value highlight-cyan">${person.nextBirthdayDate}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Current Age</span>
              <span class="detail-value">${person.currentAge !== null ? `${person.currentAge} yrs` : 'N/A'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Turning Age</span>
              <span class="detail-value highlight-purple">${person.turningAge !== null ? `${person.turningAge} yrs` : 'N/A'}</span>
            </div>
          </div>
        </div>

        <button class="card-action-btn" data-person-id="${person.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="12 8 8 12 12 16 12 8"></polygon></svg>
          View Profile & Message
        </button>
      </div>
    `;
  }

  // ==========================================
  // SECTION 4: INDIVIDUAL BIRTHDAY LOOKUP (NEW FEATURE)
  // ==========================================
  renderLookupSection() {
    const selected = this.evaluatedPeople.find(p => p.id === this.selectedPersonId) || this.evaluatedPeople[0];
    const greeting = selected ? generatePersonalizedMessage(selected) : '';

    return `
      <div class="lookup-container">
        <!-- Section Header -->
        <div class="section-header">
          <div class="section-title-wrap">
            <div class="section-icon-badge text-cyan-400">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
            <div>
              <h2 class="section-heading">INDIVIDUAL BIRTHDAY LOOKUP</h2>
              <p class="section-subtext">Select any person to view their dedicated birthday profile, live countdown, and personal message</p>
            </div>
          </div>
        </div>

        <!-- Searchable Person Selector -->
        <div class="glass-panel lookup-picker-card">
          <label class="text-xs font-mono uppercase tracking-wider text-slate-400">Search & Select Person</label>
          <div class="custom-select-wrapper">
            <div class="relative">
              <span class="search-icon-left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </span>
              <input 
                type="text" 
                id="lookup-name-input" 
                class="search-input-box" 
                placeholder="Type full or partial name to filter list..."
                value=""
                autocomplete="off"
              />
            </div>

            <!-- Dropdown of names -->
            <div class="names-dropdown-list" id="lookup-names-list">
              ${this.evaluatedPeople.map(p => `
                <div class="dropdown-item ${p.id === selected?.id ? 'selected' : ''}" data-select-id="${p.id}">
                  <span class="font-medium">${p.name}</span>
                  <span class="text-xs font-mono text-slate-400">${p.isToday ? '🎂 TODAY!' : p.formattedDob}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Selected Person Profile Showcase -->
        ${selected ? `
          <div class="glass-panel profile-showcase-card ${selected.isToday ? 'border-rose-500/50 shadow-rose-500/20' : ''}">
            <!-- Profile Top Header -->
            <div class="profile-header-grid">
              <div class="profile-avatar-large ${selected.isToday ? 'border-rose-500 shadow-rose-500/40' : ''}">
                <span style="font-size: 2.8rem;">${selected.isToday ? '🎂' : '👤'}</span>
              </div>
              <div>
                <div class="flex items-center gap-3 mb-1">
                  <h1 class="profile-name-lg">${selected.name}</h1>
                </div>
                <p class="text-sm text-cyan-400 font-mono tracking-wide">ID: ${selected.id} &bull; ${selected.rawDob}</p>
              </div>
              <div>
                <span class="profile-status-badge ${selected.isToday ? 'status-today' : 'status-upcoming'}">
                  ${selected.isToday ? '🎉 TODAY IS YOUR BIRTHDAY!' : '⏳ UPCOMING BIRTHDAY'}
                </span>
              </div>
            </div>

            <!-- 8-Metric Information Specs Grid -->
            <div class="profile-specs-grid">
              <div class="spec-tile">
                <span class="spec-label">Date of Birth</span>
                <span class="spec-val text-cyan-300">${selected.formattedDob}</span>
              </div>
              <div class="spec-tile">
                <span class="spec-label">Current Age</span>
                <span class="spec-val text-purple-300">${selected.currentAge !== null ? `${selected.currentAge} Years` : 'Unavailable'}</span>
              </div>
              <div class="spec-tile">
                <span class="spec-label">Birthday Month</span>
                <span class="spec-val">${selected.birthMonthName || 'N/A'}</span>
              </div>
              <div class="spec-tile">
                <span class="spec-label">Birthday Day</span>
                <span class="spec-val">${selected.birthDay ? `Day ${selected.birthDay}` : 'N/A'}</span>
              </div>
              <div class="spec-tile">
                <span class="spec-label">Next Birthday</span>
                <span class="spec-val text-cyan-400">${selected.nextBirthdayDate || 'N/A'}</span>
              </div>
              <div class="spec-tile">
                <span class="spec-label">Birthday Weekday</span>
                <span class="spec-val text-sky-300">${selected.nextBirthdayWeekday || 'N/A'}</span>
              </div>
              <div class="spec-tile">
                <span class="spec-label">Turning Age</span>
                <span class="spec-val text-pink-300">${selected.turningAge !== null ? `${selected.turningAge} Years` : 'Unavailable'}</span>
              </div>
              <div class="spec-tile">
                <span class="spec-label">Countdown</span>
                <span class="spec-val ${selected.isToday ? 'text-rose-400 font-bold' : 'text-cyan-400'}">
                  ${selected.isToday ? 'TODAY!' : `${selected.daysRemaining} Days`}
                </span>
              </div>
            </div>

            ${selected.dateNote ? `
              <div class="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                <strong>Data Notice:</strong> ${selected.dateNote}
              </div>
            ` : ''}

            <!-- Dedicated Individual Birthday Message -->
            <div class="profile-greeting-box">
              <div class="greeting-quote-icon">“</div>
              <div class="text-xs font-mono uppercase tracking-widest text-purple-400 mb-2">
                ${selected.isToday ? 'Special Birthday Greeting' : 'Personal Milestone Message'}
              </div>
              <p class="greeting-text">"${greeting}"</p>
            </div>

            <!-- Live Countdown Strip (if not today) or Celebration Trigger (if today) -->
            ${selected.isToday ? `
              <div class="mt-6 flex justify-center">
                <button class="cal-nav-btn text-rose-300 border-rose-500/50 px-6 py-3 text-base" id="profile-confetti-btn">
                  🎉 Celebrate With ${selected.name} (Confetti & Fanfare)
                </button>
              </div>
            ` : `
              <div class="countdown-strip">
                <div class="countdown-unit">
                  <span class="countdown-num">${selected.daysRemaining}</span>
                  <span class="countdown-lbl">Days Left</span>
                </div>
                <div class="text-slate-600 font-bold text-2xl">:</div>
                <div class="countdown-unit">
                  <span class="countdown-num">${selected.daysRemaining * 24}</span>
                  <span class="countdown-lbl">Approx Hours</span>
                </div>
                <div class="text-slate-600 font-bold text-2xl">:</div>
                <div class="countdown-unit">
                  <span class="countdown-num">${selected.daysRemaining * 24 * 60}</span>
                  <span class="countdown-lbl">Minutes</span>
                </div>
              </div>
            `}
          </div>
        ` : ''}
      </div>
    `;
  }

  attachLookupEvents() {
    const input = document.getElementById('lookup-name-input');
    const list = document.getElementById('lookup-names-list');

    if (input && list) {
      input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const items = list.querySelectorAll('.dropdown-item');
        items.forEach(item => {
          const text = item.textContent.toLowerCase();
          if (text.includes(query)) {
            item.style.display = 'flex';
          } else {
            item.style.display = 'none';
          }
        });
      });
    }

    if (list) {
      list.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-select-id');
          sound.playClick();
          this.selectedPersonId = id;
          this.render();
          const target = this.evaluatedPeople.find(p => p.id === id);
          if (target && target.isToday) {
            launchConfetti(0.5, 0.4);
            sound.playCelebration();
          }
        });
      });
    }

    const confettiBtn = document.getElementById('profile-confetti-btn');
    if (confettiBtn) {
      confettiBtn.addEventListener('click', () => {
        launchConfetti(0.5, 0.4);
        sound.playCelebration();
      });
    }
  }

  // ==========================================
  // SECTION 5: ALL PEOPLE DIRECTORY
  // ==========================================
  renderDirectorySection() {
    let list = [...this.evaluatedPeople];

    // Filter by name or DOB
    if (this.directorySearch) {
      const q = this.directorySearch.toLowerCase();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.rawDob.toLowerCase().includes(q) ||
        (p.formattedDob && p.formattedDob.toLowerCase().includes(q))
      );
    }

    // Filter by Month
    if (this.directoryMonth !== 'all') {
      const m = parseInt(this.directoryMonth, 10);
      list = list.filter(p => p.birthMonth === m);
    }

    // Sorting
    if (this.directorySort === 'az') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (this.directorySort === 'za') {
      list.sort((a, b) => b.name.localeCompare(a.name));
    } else if (this.directorySort === 'youngest') {
      list.sort((a, b) => (a.currentAge || 999) - (b.currentAge || 999));
    } else if (this.directorySort === 'oldest') {
      list.sort((a, b) => (b.currentAge || 0) - (a.currentAge || 0));
    } else {
      // Nearest upcoming
      list.sort((a, b) => a.daysRemaining - b.daysRemaining);
    }

    return `
      <div>
        <div class="section-header">
          <div class="section-title-wrap">
            <div class="section-icon-badge">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </div>
            <div>
              <h2 class="section-heading">ALL PEOPLE DIRECTORY</h2>
              <p class="section-subtext">Complete display-only registry (${list.length} records matching)</p>
            </div>
          </div>
        </div>

        <!-- Directory Controls Bar -->
        <div class="directory-controls">
          <div class="directory-inputs">
            <input 
              type="text" 
              id="dir-search-input" 
              class="dir-search-input" 
              placeholder="Search by name or date of birth..." 
              value="${this.directorySearch}"
            />

            <select id="dir-month-select" class="dir-select">
              <option value="all" ${this.directoryMonth === 'all' ? 'selected' : ''}>All Months (12)</option>
              ${MONTH_NAMES.map((m, idx) => `
                <option value="${idx + 1}" ${this.directoryMonth === String(idx + 1) ? 'selected' : ''}>${m}</option>
              `).join('')}
            </select>

            <select id="dir-sort-select" class="dir-select">
              <option value="nearest" ${this.directorySort === 'nearest' ? 'selected' : ''}>Sort: Nearest Upcoming</option>
              <option value="az" ${this.directorySort === 'az' ? 'selected' : ''}>Sort: Name (A &rarr; Z)</option>
              <option value="za" ${this.directorySort === 'za' ? 'selected' : ''}>Sort: Name (Z &rarr; A)</option>
              <option value="youngest" ${this.directorySort === 'youngest' ? 'selected' : ''}>Sort: Age (Youngest)</option>
              <option value="oldest" ${this.directorySort === 'oldest' ? 'selected' : ''}>Sort: Age (Oldest)</option>
            </select>
          </div>

          <label class="flex items-center gap-2 text-xs font-mono text-cyan-400 cursor-pointer">
            <input type="checkbox" id="dir-group-toggle" ${this.directoryGroup ? 'checked' : ''} class="rounded border-slate-700 text-cyan-500 focus:ring-0">
            Group by Month
          </label>
        </div>

        <!-- Directory Table or Grouped View -->
        ${list.length > 0 ? (
          this.directoryGroup ? this.renderGroupedDirectory(list) : this.renderFlatDirectory(list)
        ) : `
          <div class="glass-panel empty-state-box">
            <div class="empty-icon-circle">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <h3 class="empty-title">No Profiles Found</h3>
            <p class="empty-subtext">No records matched your search query. Try clearing the filter.</p>
          </div>
        `}
      </div>
    `;
  }

  renderFlatDirectory(list) {
    return `
      <div class="cards-grid">
        ${list.map(p => `
          <div class="glass-panel p-5 flex flex-col justify-between cursor-pointer hover:border-cyan-400 transition-all" data-person-id="${p.id}">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-mono text-cyan-400">${p.birthMonthName || 'Month N/A'}</span>
                ${p.isToday ? '<span class="nav-badge-pill pulse">TODAY!</span>' : `<span class="text-xs font-mono text-slate-400">In ${p.daysRemaining}d</span>`}
              </div>
              <h3 class="font-display font-bold text-base text-white mb-2">${p.name}</h3>
              <div class="text-xs text-slate-300 space-y-1">
                <div><span class="text-slate-500">DOB:</span> ${p.formattedDob}</div>
                <div><span class="text-slate-500">Age:</span> ${p.currentAge !== null ? `${p.currentAge} yrs` : 'N/A'}</div>
                <div><span class="text-slate-500">Next:</span> ${p.nextBirthdayDate}</div>
              </div>
            </div>
            <button class="card-action-btn mt-4 text-xs py-1.5" data-person-id="${p.id}">
              Open Profile &rarr;
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderGroupedDirectory(list) {
    const monthsGrouped = {};
    for (let m = 1; m <= 12; m++) {
      monthsGrouped[m] = list.filter(p => p.birthMonth === m);
    }

    return `
      <div class="space-y-8">
        ${Object.keys(monthsGrouped).map(m => {
          const monthNum = parseInt(m, 10);
          const peopleInMonth = monthsGrouped[monthNum];
          if (peopleInMonth.length === 0) return '';
          return `
            <div class="glass-panel p-6">
              <div class="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
                <h3 class="font-display font-bold text-lg text-cyan-300">${MONTH_NAMES[monthNum - 1]} (${peopleInMonth.length})</h3>
                <span class="text-xs font-mono text-slate-400">Month #${monthNum}</span>
              </div>
              <div class="cards-grid">
                ${peopleInMonth.map(p => `
                  <div class="bg-slate-900/60 p-4 rounded-xl border border-white/5 cursor-pointer hover:border-cyan-400" data-person-id="${p.id}">
                    <div class="flex justify-between items-start mb-1">
                      <h4 class="font-bold text-white text-sm">${p.name}</h4>
                      ${p.isToday ? '<span class="text-xs text-rose-400 font-bold">🎂 TODAY!</span>' : ''}
                    </div>
                    <div class="text-xs text-slate-400">Day ${p.birthDay} &bull; ${p.currentAge ? `${p.currentAge} yrs` : 'N/A'}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  attachDirectoryEvents() {
    const searchInput = document.getElementById('dir-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.directorySearch = e.target.value;
        this.render();
      });
    }

    const monthSelect = document.getElementById('dir-month-select');
    if (monthSelect) {
      monthSelect.addEventListener('change', (e) => {
        this.directoryMonth = e.target.value;
        this.render();
      });
    }

    const sortSelect = document.getElementById('dir-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.directorySort = e.target.value;
        this.render();
      });
    }

    const groupToggle = document.getElementById('dir-group-toggle');
    if (groupToggle) {
      groupToggle.addEventListener('change', (e) => {
        this.directoryGroup = e.target.checked;
        this.render();
      });
    }

    document.querySelectorAll('[data-person-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-person-id');
        this.navigateTo('lookup', id);
      });
    });
  }

  // ==========================================
  // SECTION 6: BIRTHDAY CALENDAR
  // ==========================================
  renderCalendarSection() {
    const today = this.dateEngine.getTodayComponents();
    const daysInMonth = new Date(this.calYear, this.calMonth, 0).getDate();
    const firstDayIndex = new Date(this.calYear, this.calMonth - 1, 1).getDay();

    // Map birthdays in this displayed month
    const birthdaysByDay = {};
    this.evaluatedPeople.forEach(p => {
      if (p.birthMonth === this.calMonth && p.birthDay) {
        if (!birthdaysByDay[p.birthDay]) birthdaysByDay[p.birthDay] = [];
        birthdaysByDay[p.birthDay].push(p);
      }
    });

    const totalDaysCells = [];
    // Blank padding before 1st of month
    for (let i = 0; i < firstDayIndex; i++) {
      totalDaysCells.push({ day: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      totalDaysCells.push({
        day: d,
        people: birthdaysByDay[d] || [],
        isToday: (this.calYear === today.year && this.calMonth === today.month && d === today.day)
      });
    }

    return `
      <div>
        <div class="section-header">
          <div class="section-title-wrap">
            <div class="section-icon-badge">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <div>
              <h2 class="section-heading">INTERACTIVE BIRTHDAY CALENDAR</h2>
              <p class="section-subtext">Click any highlighted date to inspect individuals born on that day</p>
            </div>
          </div>
        </div>

        <div class="calendar-wrapper">
          <!-- Calendar Nav Bar -->
          <div class="calendar-top-bar">
            <h3 class="calendar-month-title">
              <span>${MONTH_NAMES[this.calMonth - 1]} ${this.calYear}</span>
            </h3>

            <div class="flex items-center gap-2">
              <button class="cal-nav-btn" id="cal-prev-btn">&larr; Prev Month</button>
              <button class="cal-nav-btn" id="cal-today-btn">Jump to Today</button>
              <button class="cal-nav-btn" id="cal-next-btn">Next Month &rarr;</button>
            </div>
          </div>

          <!-- Weekdays Header -->
          <div class="calendar-grid-header">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <!-- Days Grid -->
          <div class="calendar-days-grid">
            ${totalDaysCells.map(c => {
              if (c.day === null) {
                return `<div class="calendar-day-cell other-month"></div>`;
              }
              const hasBdays = c.people && c.people.length > 0;
              return `
                <div 
                  class="calendar-day-cell ${c.isToday ? 'is-today' : ''} ${hasBdays ? 'has-birthdays' : ''}"
                  data-cal-day="${c.day}"
                >
                  <div class="flex items-center justify-between">
                    <span class="day-number">${c.day}</span>
                    ${c.isToday ? '<span class="text-[9px] font-mono text-cyan-400 font-bold">TODAY</span>' : ''}
                  </div>

                  <div class="mt-1 space-y-1">
                    ${hasBdays ? `
                      <div class="cal-bday-tag">
                        🎂 <strong>${c.people.length}</strong> ${c.people.length === 1 ? 'Birthday' : 'Birthdays'}
                      </div>
                      ${c.people.slice(0, 2).map(p => `
                        <div class="text-[10px] text-slate-300 truncate" title="${p.name}">
                          &bull; ${p.name.split(' ')[0]}
                        </div>
                      `).join('')}
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Date Click Modal Container -->
        <div id="calendar-date-modal" class="modal-backdrop hidden">
          <div class="modal-card">
            <div class="modal-header">
              <h3 class="font-display font-bold text-lg text-white" id="cal-modal-title">Birthdays</h3>
              <button class="icon-btn" id="cal-modal-close-btn">&times;</button>
            </div>
            <div class="modal-body" id="cal-modal-body">
              <!-- Dynamically populated -->
            </div>
          </div>
        </div>
      </div>
    `;
  }

  attachCalendarEvents() {
    const prevBtn = document.getElementById('cal-prev-btn');
    const nextBtn = document.getElementById('cal-next-btn');
    const todayBtn = document.getElementById('cal-today-btn');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        sound.playClick();
        if (this.calMonth === 1) {
          this.calMonth = 12;
          this.calYear -= 1;
        } else {
          this.calMonth -= 1;
        }
        this.render();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        sound.playClick();
        if (this.calMonth === 12) {
          this.calMonth = 1;
          this.calYear += 1;
        } else {
          this.calMonth += 1;
        }
        this.render();
      });
    }

    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        sound.playClick();
        const t = this.dateEngine.getTodayComponents();
        this.calMonth = t.month;
        this.calYear = t.year;
        this.render();
      });
    }

    // Clicking day cell
    document.querySelectorAll('[data-cal-day]').forEach(cell => {
      cell.addEventListener('click', (e) => {
        const day = parseInt(e.currentTarget.getAttribute('data-cal-day'), 10);
        const peopleOnDay = this.evaluatedPeople.filter(p => p.birthMonth === this.calMonth && p.birthDay === day);
        if (peopleOnDay.length > 0) {
          sound.playClick();
          this.showCalendarDayModal(day, peopleOnDay);
        }
      });
    });

    const modalClose = document.getElementById('cal-modal-close-btn');
    if (modalClose) {
      modalClose.addEventListener('click', () => {
        document.getElementById('calendar-date-modal')?.classList.add('hidden');
      });
    }
  }

  showCalendarDayModal(day, people) {
    const modal = document.getElementById('calendar-date-modal');
    const title = document.getElementById('cal-modal-title');
    const body = document.getElementById('cal-modal-body');
    if (!modal || !title || !body) return;

    title.textContent = `${day} ${MONTH_NAMES[this.calMonth - 1]} (${people.length} Birthdays)`;
    body.innerHTML = `
      <div class="space-y-4">
        ${people.map(p => `
          <div class="bg-slate-900/80 p-4 rounded-xl border border-cyan-500/30 flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-bold text-white text-base">${p.name}</h4>
                ${p.isToday ? '<span class="text-xs text-rose-400 font-bold">🎂 TODAY!</span>' : ''}
              </div>
              <div class="text-xs text-slate-400 mt-1">
                DOB: <span class="text-cyan-300">${p.formattedDob}</span> &bull; 
                Current Age: <span class="text-purple-300">${p.currentAge !== null ? `${p.currentAge} yrs` : 'N/A'}</span> &bull;
                Turning: <span class="text-pink-300">${p.turningAge !== null ? `${p.turningAge} yrs` : 'N/A'}</span>
              </div>
            </div>
            <button class="cal-nav-btn text-xs py-1.5" data-modal-person-id="${p.id}">
              View Profile &rarr;
            </button>
          </div>
        `).join('')}
      </div>
    `;

    body.querySelectorAll('[data-modal-person-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-modal-person-id');
        modal.classList.add('hidden');
        this.navigateTo('lookup', id);
      });
    });

    modal.classList.remove('hidden');
  }

  // ==========================================
  // SECTION 7: STATISTICS DASHBOARD
  // ==========================================
  renderStatisticsSection() {
    const today = this.dateEngine.getTodayComponents();
    const total = this.evaluatedPeople.length;
    const todayCount = this.evaluatedPeople.filter(p => p.isToday).length;
    const weekCount = this.evaluatedPeople.filter(p => !p.isToday && p.daysRemaining <= 7).length;
    const monthCount = this.evaluatedPeople.filter(p => p.birthMonth === today.month).length;
    const missingDobCount = this.evaluatedPeople.filter(p => !p.dateValid || !p.birthMonth).length;

    // Monthly Distribution
    const monthCounts = Array(12).fill(0);
    this.evaluatedPeople.forEach(p => {
      if (p.birthMonth && p.birthMonth >= 1 && p.birthMonth <= 12) {
        monthCounts[p.birthMonth - 1]++;
      }
    });

    const maxMonthCount = Math.max(...monthCounts, 1);
    const mostCommonMonthIdx = monthCounts.indexOf(Math.max(...monthCounts));
    const mostCommonMonthName = MONTH_NAMES[mostCommonMonthIdx];
    const mostCommonMonthVal = monthCounts[mostCommonMonthIdx];

    // Age distribution
    let ageUnder18 = 0;
    let age18to20 = 0;
    let age21to25 = 0;
    let ageAbove25 = 0;
    let validAges = [];

    this.evaluatedPeople.forEach(p => {
      if (p.currentAge !== null) {
        validAges.push(p.currentAge);
        if (p.currentAge < 18) ageUnder18++;
        else if (p.currentAge <= 20) age18to20++;
        else if (p.currentAge <= 25) age21to25++;
        else ageAbove25++;
      }
    });

    const avgAge = validAges.length > 0 ? (validAges.reduce((a, b) => a + b, 0) / validAges.length).toFixed(1) : 'N/A';
    const minAge = validAges.length > 0 ? Math.min(...validAges) : 'N/A';
    const maxAge = validAges.length > 0 ? Math.max(...validAges) : 'N/A';

    return `
      <div>
        <div class="section-header">
          <div class="section-title-wrap">
            <div class="section-icon-badge">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            </div>
            <div>
              <h2 class="section-heading">DATASET STATISTICS & ANALYTICS</h2>
              <p class="section-subtext">Direct real-time metrics computed from ${total} original Excel records</p>
            </div>
          </div>
        </div>

        <!-- Metric highlights -->
        <div class="metrics-grid">
          <div class="glass-panel metric-card" style="--card-accent: #00F0FF;">
            <div class="metric-info">
              <h4>Average Age</h4>
              <div class="metric-value text-cyan-400">${avgAge}</div>
              <div class="metric-sub">Min: ${minAge} yrs &bull; Max: ${maxAge} yrs</div>
            </div>
            <div class="metric-icon-box text-cyan-400">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 10"></polyline></svg>
            </div>
          </div>

          <div class="glass-panel metric-card" style="--card-accent: #A855F7;">
            <div class="metric-info">
              <h4>Top Month</h4>
              <div class="metric-value text-purple-400">${mostCommonMonthVal}</div>
              <div class="metric-sub">${mostCommonMonthName} (${mostCommonMonthVal} birthdays)</div>
            </div>
            <div class="metric-icon-box text-purple-400">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
            </div>
          </div>

          <div class="glass-panel metric-card" style="--card-accent: #F43F5E;">
            <div class="metric-info">
              <h4>Active Today</h4>
              <div class="metric-value text-rose-400">${todayCount}</div>
              <div class="metric-sub">${todayCount > 0 ? 'Milestones celebrated today' : 'No birthdays today'}</div>
            </div>
            <div class="metric-icon-box text-rose-400">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </div>
          </div>

          <div class="glass-panel metric-card" style="--card-accent: #10B981;">
            <div class="metric-info">
              <h4>Data Integrity</h4>
              <div class="metric-value text-emerald-400">${(((total - missingDobCount) / total) * 100).toFixed(0)}%</div>
              <div class="metric-sub">${missingDobCount === 0 ? '100% valid date records' : `${missingDobCount} missing dates`}</div>
            </div>
            <div class="metric-icon-box text-emerald-400">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
          </div>
        </div>

        <!-- Charts Layout -->
        <div class="stats-charts-grid">
          <!-- Monthly Distribution Bar Chart -->
          <div class="glass-panel chart-card">
            <h3 class="font-display font-bold text-base text-white mb-2">Birthday Frequency By Month</h3>
            <p class="text-xs text-slate-400 mb-4">Distribution of birthdays across the 12 calendar months</p>

            <div class="bar-chart-container">
              ${monthCounts.map((count, idx) => {
                const heightPct = (count / maxMonthCount) * 100;
                return `
                  <div class="bar-col" title="${MONTH_NAMES[idx]}: ${count} birthdays">
                    <span class="bar-val-tooltip">${count}</span>
                    <div class="bar-pill" style="height: ${Math.max(6, heightPct)}%;"></div>
                    <span class="bar-month-lbl">${MONTH_SHORT_NAMES[idx]}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Age Brackets Breakdown -->
          <div class="glass-panel chart-card flex flex-col justify-between">
            <div>
              <h3 class="font-display font-bold text-base text-white mb-2">Age Demographics</h3>
              <p class="text-xs text-slate-400 mb-6">Distribution across age generations</p>

              <div class="space-y-4">
                <div>
                  <div class="flex justify-between text-xs font-mono mb-1">
                    <span class="text-slate-300">&lt; 18 Years</span>
                    <span class="text-cyan-400 font-bold">${ageUnder18} (${((ageUnder18 / validAges.length) * 100 || 0).toFixed(0)}%)</span>
                  </div>
                  <div class="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div class="bg-cyan-400 h-full rounded-full" style="width: ${(ageUnder18 / validAges.length) * 100 || 0}%;"></div>
                  </div>
                </div>

                <div>
                  <div class="flex justify-between text-xs font-mono mb-1">
                    <span class="text-slate-300">18 &ndash; 20 Years</span>
                    <span class="text-purple-400 font-bold">${age18to20} (${((age18to20 / validAges.length) * 100 || 0).toFixed(0)}%)</span>
                  </div>
                  <div class="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div class="bg-purple-500 h-full rounded-full" style="width: ${(age18to20 / validAges.length) * 100 || 0}%;"></div>
                  </div>
                </div>

                <div>
                  <div class="flex justify-between text-xs font-mono mb-1">
                    <span class="text-slate-300">21 &ndash; 25 Years</span>
                    <span class="text-sky-400 font-bold">${age21to25} (${((age21to25 / validAges.length) * 100 || 0).toFixed(0)}%)</span>
                  </div>
                  <div class="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div class="bg-sky-400 h-full rounded-full" style="width: ${(age21to25 / validAges.length) * 100 || 0}%;"></div>
                  </div>
                </div>

                <div>
                  <div class="flex justify-between text-xs font-mono mb-1">
                    <span class="text-slate-300">26+ Years</span>
                    <span class="text-pink-400 font-bold">${ageAbove25} (${((ageAbove25 / validAges.length) * 100 || 0).toFixed(0)}%)</span>
                  </div>
                  <div class="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div class="bg-pink-500 h-full rounded-full" style="width: ${(ageAbove25 / validAges.length) * 100 || 0}%;"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-6 pt-4 border-t border-white/10 text-xs text-slate-400 flex items-center justify-between">
              <span>Total calculated: <strong>${validAges.length}</strong></span>
              <button class="cal-nav-btn text-xs py-1" data-view-target="directory">Browse Directory &rarr;</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  attachStatisticsEvents() {
    //
  }

  // ==========================================
  // GLOBAL SEARCH MODAL
  // ==========================================
  renderGlobalSearchResults(query) {
    const container = document.getElementById('global-search-results');
    if (!container) return;

    if (!query || query.trim() === '') {
      container.innerHTML = `
        <div class="py-8 text-center text-slate-400 text-sm">
          Type to search by name (e.g. "Muhammed"), month ("November"), day ("13 November"), or DOB ("2006-11-13").
        </div>
      `;
      return;
    }

    const q = query.toLowerCase().trim();
    const results = this.evaluatedPeople.filter(p => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.rawDob.toLowerCase().includes(q) ||
        (p.formattedDob && p.formattedDob.toLowerCase().includes(q)) ||
        (p.birthMonthName && p.birthMonthName.toLowerCase().includes(q)) ||
        (p.nextBirthdayDate && p.nextBirthdayDate.toLowerCase().includes(q)) ||
        (p.birthDay && String(p.birthDay) === q)
      );
    });

    if (results.length === 0) {
      container.innerHTML = `
        <div class="py-8 text-center text-slate-400 text-sm">
          No matches found for "${query}".
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="space-y-2">
        ${results.map(p => `
          <div 
            class="p-3 rounded-xl bg-slate-900/60 border border-slate-700/50 hover:border-cyan-400 cursor-pointer flex items-center justify-between transition-all"
            data-search-result-id="${p.id}"
          >
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-white text-sm">${p.name}</span>
                ${p.isToday ? '<span class="nav-badge-pill pulse">🎂 TODAY!</span>' : ''}
              </div>
              <div class="text-xs text-slate-400 mt-0.5">
                DOB: <span class="text-cyan-300">${p.formattedDob}</span> &bull; 
                Age: <span class="text-purple-300">${p.currentAge !== null ? `${p.currentAge} yrs` : 'N/A'}</span> &bull;
                Next: <span class="text-slate-300">${p.nextBirthdayDate}</span>
              </div>
            </div>
            <div class="text-right">
              <span class="text-xs font-mono ${p.isToday ? 'text-rose-400 font-bold' : 'text-cyan-400'}">
                ${p.isToday ? 'TODAY!' : `In ${p.daysRemaining}d`}
              </span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    container.querySelectorAll('[data-search-result-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-search-result-id');
        this.closeAllModals();
        this.navigateTo('lookup', id);
      });
    });
  }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  const app = new BirthdayApp();
  app.init();
  window.birthdayApp = app;

  // Search modal event bindings
  const searchInput = document.getElementById('global-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      app.renderGlobalSearchResults(e.target.value);
    });
  }

  const searchClose = document.getElementById('global-search-close-btn');
  if (searchClose) {
    searchClose.addEventListener('click', () => {
      app.closeAllModals();
    });
  }

  const searchBackdrop = document.getElementById('global-search-modal');
  if (searchBackdrop) {
    searchBackdrop.addEventListener('click', (e) => {
      if (e.target === searchBackdrop) {
        app.closeAllModals();
      }
    });
  }
});
