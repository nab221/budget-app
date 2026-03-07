import { triggerHaptic } from './haptics.js';

/**
 * SwipeHandler manages touch-based swipe gestures on DOM elements.
 * It provides hooks for visual updates, threshold crossing (haptics), and final action.
 */
export class SwipeHandler {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      threshold: options.threshold || 60,
      deadZone: options.deadZone || 10,
      edgeThreshold: options.edgeThreshold || 20,
      onSwipe: options.onSwipe || (() => {}),
      onEnd: options.onEnd || (() => {}),
      onThresholdCross: options.onThresholdCross || (() => {}),
      ...options
    };

    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.isSwiping = false;
    this.isConfirmedSwipe = false;
    this.isThresholdMet = false;

    // Pre-bind event handlers for easier removal
    this.handleTouchStartBound = this.handleTouchStart.bind(this);
    this.handleTouchMoveBound = this.handleTouchMove.bind(this);
    this.handleTouchEndBound = this.handleTouchEnd.bind(this);

    this.init();
  }

  init() {
    this.element.addEventListener('touchstart', this.handleTouchStartBound, { passive: true });
    this.element.addEventListener('touchmove', this.handleTouchMoveBound, { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEndBound, { passive: true });
    this.element.addEventListener('touchcancel', this.handleTouchEndBound, { passive: true });
  }

  handleTouchStart(e) {
    const touch = e.touches[0];
    
    // Ignore swipes starting near screen edges to avoid conflict with browser gestures
    if (touch.clientX < this.options.edgeThreshold || touch.clientX > window.innerWidth - this.options.edgeThreshold) {
      this.isSwiping = false;
      return;
    }

    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.currentX = touch.clientX;
    this.currentY = touch.clientY;
    this.isSwiping = true;
    this.isConfirmedSwipe = false;
    this.isThresholdMet = false;
  }

  handleTouchMove(e) {
    if (!this.isSwiping) return;

    const touch = e.touches[0];
    this.currentX = touch.clientX;
    this.currentY = touch.clientY;

    const deltaX = this.currentX - this.startX;
    const deltaY = this.currentY - this.startY;

    // Determine if this is a horizontal swipe vs a vertical scroll
    if (!this.isConfirmedSwipe) {
      if (Math.abs(deltaX) > this.options.deadZone) {
        // Horizontal intent confirmed
        this.isConfirmedSwipe = true;
      } else if (Math.abs(deltaY) > this.options.deadZone) {
        // Vertical intent confirmed - cancel swipe logic
        this.isSwiping = false;
        return;
      }
    }

    if (this.isConfirmedSwipe) {
      // Prevent scrolling once horizontal swipe is confirmed
      if (e.cancelable) e.preventDefault();
      
      this.options.onSwipe(deltaX);

      const direction = deltaX > 0 ? 1 : -1;
      const isMet = Math.abs(deltaX) >= this.options.threshold;

      if (isMet && !this.isThresholdMet) {
        this.isThresholdMet = true;
        // Trigger haptic tick on crossing
        triggerHaptic('threshold');
        this.options.onThresholdCross(direction);
      } else if (!isMet && this.isThresholdMet) {
        this.isThresholdMet = false;
      }
    }
  }

  handleTouchEnd() {
    if (!this.isSwiping) return;

    const deltaX = this.currentX - this.startX;
    this.options.onEnd(deltaX, this.isThresholdMet);

    // Reset state
    this.isSwiping = false;
    this.isConfirmedSwipe = false;
    this.isThresholdMet = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
  }

  destroy() {
    this.element.removeEventListener('touchstart', this.handleTouchStartBound);
    this.element.removeEventListener('touchmove', this.handleTouchMoveBound);
    this.element.removeEventListener('touchend', this.handleTouchEndBound);
    this.element.removeEventListener('touchcancel', this.handleTouchEndBound);
  }
}
