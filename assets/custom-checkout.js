/**
 * @typedef {Object} CustomCheckoutConfig
 * @property {string} [apiUrl] - URL API для обробки замовлення
 * @property {boolean} [enabled] - Чи увімкнено кастомний checkout
 */

class CustomCheckoutHandler {
  /**
   * @type {string}
   */
  apiUrl;
  
  /**
   * @type {boolean}
   */
  enabled;

  constructor() {
    const config = /** @type {CustomCheckoutConfig | undefined} */ (
      // @ts-ignore
      window.customCheckoutConfig
    );
    
    this.apiUrl = config?.apiUrl || 'https://abstainedly-presageful-julissa.ngrok-free.dev/api/checkout';
    this.enabled = config?.enabled !== false;
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupFormInterception());
    } else {
      this.setupFormInterception();
    }
  }

  setupFormInterception() {
    const cartForm = /** @type {HTMLFormElement | null} */ (document.getElementById('cart-form'));
    
    if (!cartForm) {
      this.waitForCartForm();
      return;
    }

    this.interceptFormSubmit(cartForm);
  }

  waitForCartForm() {
    const observer = new MutationObserver((mutations, obs) => {
      const cartForm = /** @type {HTMLFormElement | null} */ (document.getElementById('cart-form'));
      if (cartForm) {
        this.interceptFormSubmit(cartForm);
        obs.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    const checkoutButton = document.getElementById('checkout');
    if (checkoutButton) {
      checkoutButton.addEventListener('click', (e) => {
        const form = /** @type {HTMLFormElement | null} */ (document.getElementById('cart-form'));
        if (form) {
          e.preventDefault();
          e.stopPropagation();
          this.handleCheckout(form);
        }
      });
    }
  }

  /**
   * @param {HTMLFormElement} form - Форма корзини
   */
  interceptFormSubmit(form) {
    if (!this.enabled) {
      return;
    }

    form.addEventListener('submit', (e) => {
      const submitter = /** @type {HTMLButtonElement | HTMLInputElement | null} */ (e.submitter);
      const isCheckout = submitter?.name === 'checkout' || 
                        submitter?.id === 'checkout' ||
                        submitter?.form?.querySelector('[name="checkout"]');

      if (isCheckout) {
        e.preventDefault();
        e.stopPropagation();
        this.handleCheckout(form);
      }
    });
  }

  /**
   * @param {HTMLFormElement} form - Форма корзини
   */
  async handleCheckout(form) {
    const checkoutButton = /** @type {HTMLButtonElement | null} */ (
      form.querySelector('[name="checkout"], #checkout')
    );
    
    if (!checkoutButton) {
      console.error('Checkout button not found');
      return;
    }

    const originalDisabled = checkoutButton.disabled;
    checkoutButton.disabled = true;
    const originalText = checkoutButton.textContent || '';
    checkoutButton.textContent = 'Processing...';

    try {
      const cartData = await this.fetchCartData();
      
      if (!cartData || !cartData.items || cartData.items.length === 0) {
        throw new Error('Cart is empty');
      }

      const orderData = this.prepareOrderData(cartData);
      const response = await this.sendToAPI(orderData);

      if (response && response.redirectUrl) {
        window.location.href = response.redirectUrl;
      } else {
        throw new Error('No redirect URL received from API');
      }

    } catch (error) {
      console.error('Custom checkout error:', error);
      
      checkoutButton.disabled = originalDisabled;
      checkoutButton.textContent = originalText || 'Checkout';
      this.showError(error.message || 'An error occurred. Please try again.');
    }
  }

  async fetchCartData() {
    try {
      const response = await fetch('/cart.js');
      if (!response.ok) {
        throw new Error(`Failed to fetch cart: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching cart data:', error);
      throw error;
    }
  }

  /**
   * @param {any} cartData - Дані корзини з Shopify
   * @returns {Object} Підготовлені дані замовлення
   */
  prepareOrderData(cartData) {
    return {
      cart: {
        items: cartData.items.map((/** @type {any} */ item) => ({
          id: item.id,
          variant_id: item.variant_id,
          product_id: item.product_id,
          title: item.product_title,
          variant_title: item.variant_title,
          quantity: item.quantity,
          price: item.price,
          line_price: item.line_price,
          properties: item.properties,
          sku: item.sku,
          vendor: item.vendor,
          image: item.image,
          url: item.url
        })),
        total_price: cartData.total_price,
        total_discount: cartData.total_discount,
        original_total_price: cartData.original_total_price,
        item_count: cartData.item_count,
        note: cartData.note,
        currency: cartData.currency,
        attributes: cartData.attributes
      },
      customer: {
        // @ts-ignore
        email: window.Shopify?.customer?.email || null,
        // @ts-ignore
        id: window.Shopify?.customer?.id || null
      },
      shop: {
        domain: window.Shopify?.shop || window.location.hostname,
        currency: cartData.currency
      },
      metadata: {
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        referrer: document.referrer,
        return_url: window.location.href
      }
    };
  }

  /**
   * @param {any} orderData - Дані замовлення для відправки
   * @returns {Promise<any>} Відповідь від API з redirectUrl
   */
  async sendToAPI(orderData) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending data to API:', error);
      throw error;
    }
  }

  /**
   * @param {string} message - Повідомлення про помилку
   */
  showError(message) {
    let errorElement = /** @type {HTMLElement | null} */ (document.querySelector('.custom-checkout-error'));
    
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.className = 'custom-checkout-error';
      const htmlElement = /** @type {HTMLElement} */ (errorElement);
      htmlElement.style.cssText = `
        padding: 1rem;
        margin: 1rem 0;
        background-color: #fee;
        border: 1px solid #fcc;
        border-radius: 4px;
        color: #c33;
      `;
      
      const cartSummary = document.querySelector('.cart__summary-totals') || 
                         document.querySelector('.cart-page__summary') ||
                         document.querySelector('#cart-form');
      
      if (cartSummary) {
        cartSummary.insertBefore(errorElement, cartSummary.firstChild);
      } else {
        document.body.insertBefore(errorElement, document.body.firstChild);
      }
    }

    if (errorElement) {
      errorElement.textContent = message;
      const htmlElement = /** @type {HTMLElement} */ (errorElement);
      htmlElement.style.display = 'block';

      setTimeout(() => {
        htmlElement.style.display = 'none';
      }, 5000);
    }
  }

  /**
   * @param {HTMLFormElement} form - Форма корзини
   */
  fallbackToStandardCheckout(form) {
    const checkoutButton = /** @type {HTMLButtonElement | null} */ (
      form.querySelector('[name="checkout"], #checkout')
    );
    if (checkoutButton) {
      checkoutButton.click();
    } else {
      form.submit();
    }
  }
}

if (typeof window !== 'undefined') {
  // @ts-ignore
  if (!window.customCheckoutConfig) {
    // @ts-ignore
    window.customCheckoutConfig = {
      enabled: true,
      apiUrl: 'https://abstainedly-presageful-julissa.ngrok-free.dev/api/checkout'
    };
  }

  new CustomCheckoutHandler();
}
