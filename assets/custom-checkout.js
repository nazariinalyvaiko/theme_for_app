class CustomCheckoutHandler {
  apiUrl;
  enabled;
  interceptedForms = new Set();
  interceptedButtons = new Set();
  domObserver = null;

  constructor() {
    try {
      console.log('CustomCheckout: Initializing...');
      const config = /** @type {any} */ (window).customCheckoutConfig;
      this.apiUrl = config?.apiUrl || 'https://app-for-crm-test-i04ulu00y-nazariis-projects-476aa5de.vercel.app/';
      this.enabled = config?.enabled !== false;
      console.log('CustomCheckout: API URL:', this.apiUrl);
      console.log('CustomCheckout: Enabled:', this.enabled);
      this.init();
    } catch (error) {
      console.error('CustomCheckoutHandler initialization error:', error);
    }
  }

  init() {
    try {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setupFormInterception());
      } else {
        this.setupFormInterception();
      }
      
      if (document.querySelector('#cart-form') || window.location.pathname.includes('/cart')) {
        this.hideAcceleratedCheckoutButtons();
      }
    } catch (error) {
      console.error('CustomCheckoutHandler init error:', error);
    }
  }

  hideAcceleratedCheckoutButtons() {
    try {
      const acceleratedCheckoutCart = document.querySelector('shopify-accelerated-checkout-cart');
      if (acceleratedCheckoutCart && acceleratedCheckoutCart instanceof HTMLElement) {
        acceleratedCheckoutCart.style.display = 'none';
      }
      
      const additionalCheckoutButtons = document.querySelectorAll('.additional-checkout-buttons');
      additionalCheckoutButtons.forEach(buttons => {
        if (buttons instanceof HTMLElement) {
          buttons.style.display = 'none';
        }
      });
    } catch (error) {
      console.error('Error hiding accelerated checkout buttons:', error);
    }
  }

  setupFormInterception() {
    try {
      console.log('CustomCheckout: setupFormInterception called');
      const cartForm = document.getElementById('cart-form');
      console.log('CustomCheckout: cartForm found:', !!cartForm);
      
      if (cartForm && cartForm instanceof HTMLFormElement && !this.interceptedForms.has(cartForm)) {
        console.log('CustomCheckout: Intercepting form submit');
        this.interceptFormSubmit(cartForm);
        this.interceptedForms.add(cartForm);
      }
      
      const checkoutButton = document.getElementById('checkout');
      console.log('CustomCheckout: checkoutButton found:', !!checkoutButton);
      if (checkoutButton && checkoutButton instanceof HTMLButtonElement) {
        console.log('CustomCheckout: checkoutButton form id:', checkoutButton.form?.id);
        console.log('CustomCheckout: checkoutButton form attribute:', checkoutButton.getAttribute('form'));
      }
      
      if (checkoutButton && 
          !this.interceptedButtons.has(checkoutButton) &&
          checkoutButton instanceof HTMLButtonElement &&
          (checkoutButton.form?.id === 'cart-form' || checkoutButton.getAttribute('form') === 'cart-form')) {
        console.log('CustomCheckout: Intercepting checkout button click');
        this.interceptCheckoutButton(checkoutButton);
        this.interceptedButtons.add(checkoutButton);
      }
    } catch (error) {
      console.error('Error setting up form interception:', error);
    }
  }

  interceptCheckoutButton(/** @type {HTMLButtonElement} */ button) {
    try {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      
      const formId = button.form?.id || button.getAttribute('form');
      if (formId !== 'cart-form') {
        return;
      }
      
      button.addEventListener('click', (/** @type {MouseEvent} */ e) => {
        try {
          console.log('CustomCheckout: Checkout button clicked!');
          const form = button.form || document.getElementById('cart-form');
          if (form && form instanceof HTMLFormElement && form.id === 'cart-form') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('CustomCheckout: Calling handleCheckout');
            this.handleCheckout(form);
          } else {
            console.log('CustomCheckout: Form not found or wrong form id');
          }
        } catch (error) {
          console.error('Error in checkout button handler:', error);
        }
      }, { capture: true, once: false });
    } catch (error) {
      console.error('Error intercepting checkout button:', error);
    }
  }

  waitForCartForm() {
    try {
      const observer = new MutationObserver((mutations, obs) => {
        try {
          const cartForm = document.getElementById('cart-form');
          if (cartForm && cartForm instanceof HTMLFormElement && !this.interceptedForms.has(cartForm)) {
            this.interceptFormSubmit(cartForm);
            this.interceptedForms.add(cartForm);
            obs.disconnect();
          }
        } catch (error) {
          console.error('Error in waitForCartForm observer:', error);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => observer.disconnect(), 10000);
    } catch (error) {
      console.error('Error in waitForCartForm:', error);
    }
  }

  interceptFormSubmit(/** @type {HTMLFormElement} */ form) {
    if (!this.enabled || form.id !== 'cart-form') {
      return;
    }

    try {
      form.addEventListener('submit', (e) => {
        try {
          console.log('CustomCheckout: Form submit event');
          const submitter = e.submitter;
          const isCheckout = (submitter instanceof HTMLButtonElement && submitter.name === 'checkout') || 
                            (submitter instanceof HTMLInputElement && submitter.name === 'checkout') ||
                            submitter?.id === 'checkout';
          console.log('CustomCheckout: Is checkout submit:', isCheckout);

          if (isCheckout && form.id === 'cart-form') {
            console.log('CustomCheckout: Preventing default and calling handleCheckout');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.handleCheckout(form);
          }
        } catch (error) {
          console.error('Error in form submit handler:', error);
        }
      }, { capture: true });
    } catch (error) {
      console.error('Error intercepting form submit:', error);
    }
  }

  async handleCheckout(/** @type {HTMLFormElement} */ form) {
    console.log('CustomCheckout: handleCheckout called');
    let checkoutButton = form.querySelector('[name="checkout"], #checkout');
    
    if (!checkoutButton) {
      checkoutButton = document.getElementById('checkout') || document.querySelector('[name="checkout"]');
    }
    
    if (!checkoutButton || !(checkoutButton instanceof HTMLButtonElement)) {
      console.error('Checkout button not found');
      return;
    }

    const originalDisabled = checkoutButton.disabled;
    checkoutButton.disabled = true;
    const originalText = checkoutButton.textContent || '';
    checkoutButton.textContent = 'Processing...';

    try {
      console.log('CustomCheckout: Fetching cart data...');
      const cartData = await this.fetchCartData();
      console.log('CustomCheckout: Cart data:', cartData);
      
      if (!cartData || !cartData.items || cartData.items.length === 0) {
        throw new Error('Cart is empty');
      }

      const orderData = this.prepareOrderData(cartData);
      console.log('CustomCheckout: Sending order data to:', this.apiUrl);
      console.log('CustomCheckout: Order data:', orderData);
      
      const response = await this.sendToAPI(orderData);
      console.log('CustomCheckout: API response:', response);

      if (response && response.redirectUrl) {
        console.log('CustomCheckout: Redirecting to:', response.redirectUrl);
        window.location.href = response.redirectUrl;
      } else {
        console.log('CustomCheckout: No redirectUrl in response, response:', response);
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

  prepareOrderData(/** @type {any} */ cartData) {
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
        email: (/** @type {any} */ (window.Shopify))?.customer?.email || null,
        id: (/** @type {any} */ (window.Shopify))?.customer?.id || null
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

  async sendToAPI(/** @type {any} */ orderData) {
    try {
      console.log('CustomCheckout: sendToAPI - URL:', this.apiUrl);
      
      const headers = /** @type {Record<string, string>} */ ({
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      });
      
      if (this.apiUrl.includes('ngrok')) {
        headers['ngrok-skip-browser-warning'] = 'true';
      }
      
      console.log('CustomCheckout: Sending POST request with headers:', headers);
      console.log('CustomCheckout: Request body size:', JSON.stringify(orderData).length, 'bytes');
      
      const fetchOptions = {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(orderData)
      };
      
      console.log('CustomCheckout: Fetch options:', fetchOptions);
      console.log('CustomCheckout: About to call fetch...');
      
      const fetchPromise = fetch(this.apiUrl, fetchOptions);
      console.log('CustomCheckout: Fetch promise created, waiting for response...');
      
      const response = await fetchPromise;
      console.log('CustomCheckout: Got response!');

      console.log('CustomCheckout: Response status:', response.status, response.statusText);
      console.log('CustomCheckout: Response ok:', response.ok);
      console.log('CustomCheckout: Response headers:', [...response.headers.entries()]);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('CustomCheckout: Error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || response.statusText };
        }
        throw new Error(errorData.message || `API error: ${response.statusText}`);
      }

      const responseText = await response.text();
      console.log('CustomCheckout: Response text:', responseText);
      
      try {
        return JSON.parse(responseText);
      } catch {
        return { message: responseText };
      }
    } catch (error) {
      console.error('CustomCheckout: ========== ERROR DETAILS ==========');
      console.error('CustomCheckout: Full error object:', error);
      console.error('CustomCheckout: Error name:', error?.name);
      console.error('CustomCheckout: Error message:', error?.message);
      console.error('CustomCheckout: Error stack:', error?.stack);
      console.error('CustomCheckout: API URL was:', this.apiUrl);
      console.error('CustomCheckout: ===================================');
      
      if (error instanceof TypeError) {
        console.error('CustomCheckout: TypeError details:', {
          message: error.message,
          name: error.name
        });
        
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('fetch') || errorMsg.includes('failed to fetch') || errorMsg.includes('network') || errorMsg.includes('cors')) {
          const detailedMsg = errorMsg.includes('cors') 
            ? 'Помилка CORS. Перевірте налаштування CORS на сервері.'
            : 'Не вдалося підключитися до сервера оплати. Перевірте чи працює сервер та чи правильний URL.';
          throw new Error(detailedMsg);
        }
      }
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Невідома помилка при відправці запиту');
    }
  }

  showError(/** @type {string} */ message) {
    let errorElement = document.querySelector('.custom-checkout-error');
    
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

  fallbackToStandardCheckout(/** @type {HTMLFormElement} */ form) {
    const checkoutButton = form.querySelector('[name="checkout"], #checkout');
    if (checkoutButton && checkoutButton instanceof HTMLButtonElement) {
      checkoutButton.click();
    } else {
      form.submit();
    }
  }
}

if (typeof window !== 'undefined') {
  try {
    const win = /** @type {any} */ (window);
    if (!win.customCheckoutConfig) {
      win.customCheckoutConfig = {
        enabled: true,
        apiUrl: 'https://abstainedly-presageful-julissa.ngrok-free.dev/api/checkout'
      };
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          try {
            new CustomCheckoutHandler();
          } catch (error) {
            console.error('Failed to initialize CustomCheckoutHandler:', error);
          }
        }, 100);
      });
    } else {
      setTimeout(() => {
        try {
          new CustomCheckoutHandler();
        } catch (error) {
          console.error('Failed to initialize CustomCheckoutHandler:', error);
        }
      }, 100);
    }
  } catch (error) {
    console.error('Error initializing custom checkout:', error);
  }
}
