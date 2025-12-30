(function() {
  'use strict';

  class ReturnPortal {
    constructor(container) {
      this.container = container;
      this.appUrl = container.dataset.appUrl;
      this.shop = container.dataset.shop;
      this.currentOrder = null;
      this.selectedItems = new Map();
      
      this.elements = {
        lookupStep: container.querySelector('[data-step="lookup"]'),
        itemsStep: container.querySelector('[data-step="items"]'),
        confirmationStep: container.querySelector('[data-step="confirmation"]'),
        lookupForm: container.querySelector('[data-lookup-form]'),
        lookupError: container.querySelector('[data-lookup-error]'),
        lookupButton: container.querySelector('[data-lookup-button]'),
        itemsContainer: container.querySelector('[data-items-container]'),
        itemTemplate: container.querySelector('[data-item-template]'),
        submitError: container.querySelector('[data-submit-error]'),
        submitButton: container.querySelector('[data-submit-button]'),
        summaryCount: container.querySelector('[data-summary-count]'),
        orderName: container.querySelector('[data-order-name]'),
        orderDate: container.querySelector('[data-order-date]'),
        returnId: container.querySelector('[data-return-id]'),
        backButton: container.querySelector('[data-back-button]'),
        restartButton: container.querySelector('[data-restart-button]')
      };

      this.bindEvents();
    }

    bindEvents() {
      this.elements.lookupForm?.addEventListener('submit', (e) => this.handleLookup(e));
      this.elements.submitButton?.addEventListener('click', () => this.handleSubmit());
      this.elements.backButton?.addEventListener('click', () => this.showStep('lookup'));
      this.elements.restartButton?.addEventListener('click', () => this.reset());
    }

    async handleLookup(event) {
      event.preventDefault();
      
      const form = event.target;
      const formData = new FormData(form);
      const orderNumber = formData.get('orderNumber')?.toString().replace('#', '').trim();
      const email = formData.get('email')?.toString().trim();

      if (!orderNumber || !email) return;

      this.setLoading(this.elements.lookupButton, true);
      this.hideError(this.elements.lookupError);

      try {
        const response = await fetch(`${this.appUrl}/api/customer/lookup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderNumber, email, shop: this.shop })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Order not found');
        }

        this.currentOrder = data.order;
        this.renderOrderItems(data.order);
        this.showStep('items');

      } catch (error) {
        this.showError(this.elements.lookupError, error.message);
      } finally {
        this.setLoading(this.elements.lookupButton, false);
      }
    }

    renderOrderItems(order) {
      this.elements.orderName.textContent = `Order ${order.name}`;
      this.elements.orderDate.textContent = `Placed on ${this.formatDate(order.createdAt)}`;
      this.elements.itemsContainer.innerHTML = '';
      this.selectedItems.clear();

      order.lineItems.forEach((item) => {
        const template = this.elements.itemTemplate.content.cloneNode(true);
        const itemEl = template.querySelector('[data-item]');
        
        itemEl.dataset.lineItemId = item.id;
        
        const checkbox = itemEl.querySelector('[data-item-checkbox]');
        const image = itemEl.querySelector('[data-item-image]');
        const title = itemEl.querySelector('[data-item-title]');
        const variant = itemEl.querySelector('[data-item-variant]');
        const quantity = itemEl.querySelector('[data-item-quantity]');
        const price = itemEl.querySelector('[data-item-price]');
        const fields = itemEl.querySelector('[data-item-fields]');
        const reason = itemEl.querySelector('[data-item-reason]');
        const notes = itemEl.querySelector('[data-item-notes]');

        if (item.image) {
          image.src = item.image;
          image.alt = item.title;
        } else {
          image.style.display = 'none';
        }

        title.textContent = item.title;
        variant.textContent = item.variantTitle || '';
        quantity.textContent = `Qty: ${item.quantity}`;
        price.textContent = this.formatMoney(item.price);

        if (item.alreadyReturned) {
          checkbox.disabled = true;
          itemEl.style.opacity = '0.5';
          variant.textContent += ' (Already returned)';
        }

        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            this.selectedItems.set(item.id, { item, reason: '', notes: '' });
            fields.classList.remove('return-portal__hidden');
          } else {
            this.selectedItems.delete(item.id);
            fields.classList.add('return-portal__hidden');
            reason.value = '';
            notes.value = '';
          }
          this.updateSummary();
        });

        reason.addEventListener('change', () => {
          const selected = this.selectedItems.get(item.id);
          if (selected) selected.reason = reason.value;
        });

        notes.addEventListener('input', () => {
          const selected = this.selectedItems.get(item.id);
          if (selected) selected.notes = notes.value;
        });

        this.elements.itemsContainer.appendChild(template);
      });
    }

    updateSummary() {
      const count = this.selectedItems.size;
      this.elements.summaryCount.textContent = `${count} item(s) selected`;
      this.elements.submitButton.disabled = count === 0;
    }

    async handleSubmit() {
      if (this.selectedItems.size === 0) {
        this.showError(this.elements.submitError, 'Please select at least one item to return.');
        return;
      }

      const items = Array.from(this.selectedItems.values());
      const missingReason = items.some(({ reason }) => !reason);
      
      if (missingReason) {
        this.showError(this.elements.submitError, 'Please select a reason for each item.');
        return;
      }

      this.setLoading(this.elements.submitButton, true);
      this.hideError(this.elements.submitError);

      try {
        const response = await fetch(`${this.appUrl}/api/customer/returns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shop: this.shop,
            orderId: this.currentOrder.id,
            orderName: this.currentOrder.name,
            customerEmail: this.currentOrder.email,
            customerName: this.currentOrder.customerName,
            items: items.map(({ item, reason, notes }) => ({
              lineItemId: item.id,
              variantId: item.variantId,
              productId: item.productId,
              title: item.title,
              variantTitle: item.variantTitle,
              sku: item.sku,
              quantity: item.quantity,
              price: item.price,
              reason,
              notes
            }))
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to submit return request');
        }

        this.elements.returnId.textContent = `Return ID: ${data.returnId}`;
        this.showStep('confirmation');

      } catch (error) {
        this.showError(this.elements.submitError, error.message);
      } finally {
        this.setLoading(this.elements.submitButton, false);
      }
    }

    showStep(step) {
      this.elements.lookupStep.classList.toggle('return-portal__hidden', step !== 'lookup');
      this.elements.itemsStep.classList.toggle('return-portal__hidden', step !== 'items');
      this.elements.confirmationStep.classList.toggle('return-portal__hidden', step !== 'confirmation');
    }

    reset() {
      this.currentOrder = null;
      this.selectedItems.clear();
      this.elements.lookupForm.reset();
      this.elements.itemsContainer.innerHTML = '';
      this.hideError(this.elements.lookupError);
      this.hideError(this.elements.submitError);
      this.showStep('lookup');
    }

    setLoading(button, loading) {
      if (!button) return;
      const text = button.querySelector('[data-button-text]');
      const spinner = button.querySelector('[data-button-spinner]');
      
      button.disabled = loading;
      text?.classList.toggle('return-portal__hidden', loading);
      spinner?.classList.toggle('return-portal__hidden', !loading);
    }

    showError(container, message) {
      if (!container) return;
      const messageEl = container.querySelector('[data-error-message]');
      if (messageEl) messageEl.textContent = message;
      container.classList.remove('return-portal__hidden');
    }

    hideError(container) {
      if (!container) return;
      container.classList.add('return-portal__hidden');
    }

    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    formatMoney(amount) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    }
  }

  function init() {
    document.querySelectorAll('[data-return-portal]').forEach((container) => {
      new ReturnPortal(container);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
