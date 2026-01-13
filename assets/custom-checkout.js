const DEFAULT_API_URL = 'https://abstainedly-presageful-julissa.ngrok-free.dev/api/checkout';

class CustomCheckoutHandler {
  apiUrl;
  interceptedForms = new Set();
  interceptedButtons = new Set();

  constructor() {
    const config = /** @type {any} */ (window).customCheckoutConfig;
    this.apiUrl = config?.apiUrl || DEFAULT_API_URL;
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupFormInterception());
    } else {
      this.setupFormInterception();
    }
    
    if (window.location.pathname.includes('/cart')) {
      this.hideAcceleratedCheckoutButtons();
    }
  }

  hideAcceleratedCheckoutButtons() {
    document.querySelector('shopify-accelerated-checkout-cart')?.setAttribute('style', 'display: none');
    document.querySelectorAll('.additional-checkout-buttons').forEach(el => {
      if (el instanceof HTMLElement) el.style.display = 'none';
    });
  }

  setupFormInterception() {
    const cartForm = document.getElementById('cart-form');
    if (cartForm instanceof HTMLFormElement && !this.interceptedForms.has(cartForm)) {
      this.interceptFormSubmit(cartForm);
      this.interceptedForms.add(cartForm);
    }
    
    const checkoutButton = document.getElementById('checkout');
    if (checkoutButton instanceof HTMLButtonElement && 
        !this.interceptedButtons.has(checkoutButton) &&
        (checkoutButton.form?.id === 'cart-form' || checkoutButton.getAttribute('form') === 'cart-form')) {
      this.interceptCheckoutButton(checkoutButton);
      this.interceptedButtons.add(checkoutButton);
    }
  }

  interceptCheckoutButton(/** @type {HTMLButtonElement} */ button) {
    button.addEventListener('click', (e) => {
      const form = button.form || document.getElementById('cart-form');
      if (form instanceof HTMLFormElement && form.id === 'cart-form') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handleCheckout();
      }
    }, { capture: true });
  }

  interceptFormSubmit(/** @type {HTMLFormElement} */ form) {
    form.addEventListener('submit', (e) => {
      const submitter = e.submitter;
      const isCheckout = (submitter instanceof HTMLButtonElement && submitter.name === 'checkout') || 
                        (submitter instanceof HTMLInputElement && submitter.name === 'checkout') ||
                        submitter?.id === 'checkout';

      if (isCheckout && form.id === 'cart-form') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handleCheckout();
      }
    }, { capture: true });
  }

  async handleCheckout() {
    const checkoutButton = document.getElementById('checkout');
    if (!(checkoutButton instanceof HTMLButtonElement)) return;

    const originalText = checkoutButton.textContent || '';
    checkoutButton.disabled = true;
    checkoutButton.textContent = 'Processing...';

    try {
      const cartData = await fetch('/cart.js').then(r => r.json());
      
      if (!cartData?.items?.length) {
        throw new Error('Cart is empty');
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cartData)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        throw new Error('No redirect URL received');
      }

    } catch (error) {
      console.error('Checkout error:', error);
      checkoutButton.disabled = false;
      checkoutButton.textContent = originalText;
      alert(error instanceof Error ? error.message : 'An error occurred');
    }
  }
}

if (typeof window !== 'undefined') {
  const win = /** @type {any} */ (window);
  if (!win.customCheckoutConfig) {
    win.customCheckoutConfig = { apiUrl: DEFAULT_API_URL };
  }

  const init = () => new CustomCheckoutHandler();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
  } else {
    setTimeout(init, 100);
  }
}
