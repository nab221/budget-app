/**
 * Global notification system for displaying user-facing messages.
 * Supports stacking, auto-dismiss, and action buttons.
 * Phase 25.3: Core notification infrastructure
 */

export const notificationUI = {
  _queue: [],
  _container: null,
  _animationDuration: 300, // milliseconds for slideIn/slideOut

  /**
   * Initialize notification container in DOM.
   * Call once on app startup via app.js init().
   */
  init() {
    if (this._container) return; // Already initialized

    // Create fixed notification container
    this._container = document.createElement('div');
    this._container.id = 'notificationContainer';
    this._container.setAttribute('role', 'region');
    this._container.setAttribute('aria-live', 'polite');
    this._container.setAttribute('aria-atomic', 'true');
    this._container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
      margin: 0;
      padding: 0;
    `;
    document.body.appendChild(this._container);
  },

  /**
   * Show a notification with optional actions.
   * @param {string} message - Main message text
   * @param {string} level - 'success' | 'warning' | 'error' | 'info'
   * @param {Array<{label, onClick}>} actions - Action buttons []
   * @param {number|null} duration - Auto-dismiss ms (null = manual only, 0 = no auto-dismiss)
   * @returns {HTMLElement} notification element (for testing)
   */
  show(message, level = 'info', actions = [], duration = null) {
    if (!this._container) this.init();

    // Create notification element
    const notif = document.createElement('div');
    notif.className = `notification notification-${level}`;
    notif.style.cssText = `
      pointer-events: auto;
      animation: slideIn 0.3s ease-out forwards;
    `;

    // Determine colors based on level
    const colors = {
      success: { bg: '#10b981', text: '#fff' },     // Green
      warning: { bg: '#f59e0b', text: '#fff' },     // Amber
      error: { bg: '#ef4444', text: '#fff' },       // Red
      info: { bg: '#3b82f6', text: '#fff' }         // Blue
    };
    const color = colors[level] || colors.info;

    // Build message section
    const messageEl = document.createElement('div');
    messageEl.className = 'notification-message';
    messageEl.style.cssText = `
      flex: 1;
    `;
    messageEl.textContent = message;

    const contentEl = document.createElement('div');
    contentEl.className = 'notification-content';

    // Build actions section
    const actionsEl = document.createElement('div');
    actionsEl.className = 'notification-actions';
    actionsEl.style.cssText = `
      margin-top: ${actions.length > 0 ? '8px' : '0'};
    `;

    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = 'notification-action';
      btn.textContent = action.label;
      btn.style.cssText = `
        border: 1px solid rgba(255, 255, 255, 0.3);
        background: rgba(255, 255, 255, 0.1);
        color: ${color.text};
      `;
      btn.onmouseover = () => {
        btn.style.background = 'rgba(255, 255, 255, 0.2)';
      };
      btn.onmouseout = () => {
        btn.style.background = 'rgba(255, 255, 255, 0.1)';
      };
      btn.onclick = (e) => {
        e.stopPropagation();
        if (action.onClick) {
          action.onClick();
        }
        this.dismiss(notif);
      };
      actionsEl.appendChild(btn);
    });

    // Build close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.style.cssText = `
      background: transparent;
      color: ${color.text};
    `;
    closeBtn.onmouseover = () => { closeBtn.style.opacity = '1'; };
    closeBtn.onmouseout = () => { closeBtn.style.opacity = '0.7'; };
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.dismiss(notif);
    };

    // Assemble notification
    const headerEl = document.createElement('div');
    headerEl.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: flex-start;
    `;
    contentEl.appendChild(messageEl);
    if (actions.length > 0) {
      contentEl.appendChild(actionsEl);
    }

    headerEl.appendChild(contentEl);
    headerEl.appendChild(closeBtn);

    notif.style.background = color.bg;
    notif.style.color = color.text;
    notif.style.padding = '12px 14px';
    notif.style.borderRadius = '6px';
    notif.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    notif.style.minWidth = '280px';
    notif.style.maxWidth = '400px';
    notif.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    notif.style.fontSize = '0.9rem';
    notif.style.lineHeight = '1.4';
    notif.style.margin = '0';

    notif.appendChild(headerEl);

    // Add to DOM
    this._container.appendChild(notif);
    this._queue.push(notif);

    // Auto-dismiss if duration specified
    if (duration && duration > 0) {
      setTimeout(() => {
        this.dismiss(notif);
      }, duration);
    }

    return notif;
  },

  /**
   * Dismiss a notification with slideOut animation.
   * @param {HTMLElement} notif - Notification element
   */
  dismiss(notif) {
    if (!notif || !this._container || notif.dataset.dismissing === 'true') return;

    notif.dataset.dismissing = 'true';

    notif.style.animation = 'slideOut 0.3s ease-in forwards';

    setTimeout(() => {
      if (notif.parentNode === this._container) {
        this._container.removeChild(notif);
      }
      const idx = this._queue.indexOf(notif);
      if (idx > -1) {
        this._queue.splice(idx, 1);
      }
    }, this._animationDuration);
  },

  // Convenience methods for common notification types
  success(message, actions = [], duration = 2000) {
    return this.show(message, 'success', actions, duration);
  },

  warning(message, actions = [], duration = null) {
    return this.show(message, 'warning', actions, duration);
  },

  error(message, actions = [], duration = null) {
    return this.show(message, 'error', actions, duration);
  },

  info(message, actions = [], duration = 3000) {
    return this.show(message, 'info', actions, duration);
  },

  /**
   * Dismiss all notifications.
   */
  dismissAll() {
    const notifs = [...this._queue];
    notifs.forEach(notif => this.dismiss(notif));
  }
};
