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

  prepareOrderData(/** @type {any} */ cartData) {
    return {
      line_items: cartData.items.map((/** @type {any} */ item) => ({
        variant_id: item.variant_id,
        product_id: item.product_id,
        quantity: item.quantity,
        title: item.product_title,
        variant_title: item.variant_title || '',
        price: item.price,
        sku: item.sku || '',
        vendor: item.vendor || '',
        properties: item.properties || [],
        image: item.image || '',
        url: item.url || ''
      })),
      total_price: cartData.total_price,
      subtotal_price: cartData.original_total_price,
      total_discount: cartData.total_discount || 0,
      item_count: cartData.item_count,
      currency: cartData.currency,
      note: cartData.note || '',
      attributes: cartData.attributes || {}
    };
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

      const orderData = this.prepareOrderData(cartData);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      }).catch(fetchError => {
        console.error('Fetch error:', fetchError);
        if (fetchError.message.includes('NetworkError') || fetchError.message.includes('Failed to fetch')) {
          throw new Error('Не вдалося підключитися до сервера. Перевірте чи працює сервер та налаштування CORS.');
        }
        throw fetchError;
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Помилка сервера: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        throw new Error('Сервер не повернув URL для перенаправлення');
      }

    } catch (error) {
      console.error('Checkout error:', error);
      checkoutButton.disabled = false;
      checkoutButton.textContent = originalText;
      
      const errorMessage = error instanceof Error ? error.message : 'Сталася помилка. Спробуйте ще раз.';
      alert(errorMessage);
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
