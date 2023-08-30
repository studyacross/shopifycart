import { InventoryError, VariantError } from "./lib/errors";
export class ShopifyCart {
    constructor(settings) {
        this._settings = {
            url: '',
            postConfig: {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/json;',
                },
            },
            updateState: true,
        };
        this._settings = { ...this._settings, ...settings };
        this.cartEvent('cart:ready');
    }
    get state() {
        return this._state;
    }
    get settings() {
        return this._settings;
    }
    /**
     * Use the GET /cart.js endpoint to get the cart as JSON.
     * @see {@link https://shopify.dev/docs/themes/ajax-api/reference/cart#get-cart-js | ShopifyAPI: GET /cart.js }
     */
    async getState() {
        this.cartEvent('cart:requestStarted', '/cart.js');
        const response = await fetch(`${this._settings.url}/cart.js`);
        this._state = await response.json();
        this.cartEvent('cart:requestComplete', '/cart.js');
        return this._state;
    }
    /**
     * Use the POST /cart/add.js endpoint to add product to cart.
     * @see {@link https://shopify.dev/docs/themes/ajax-api/reference/cart#post-cart-add-js | ShopifyAPI: POST /cart/add.js}
     */
    async addItem(items) {
        const data = Array.isArray(items) ? items : [items];
        const response = await this.post('/cart/add.js', JSON.stringify({ items: data }));
        if (this._settings.updateState) {
            await this.getState();
        }
        return response;
    }
    /**
     * Adds an item to your cart from a product form. The form must contain an input with name="id".
     * If the quantity specified is more than what is available, the promise will be rejected and the cart state will remain unchanged
     * @see {@link https://shopify.dev/docs/themes/ajax-api/reference/cart#post-cart-add-js | ShopifyAPI: POST /cart/add.js}
     */
    async addItemFromForm(productForm) {
        const formData = new FormData(productForm);
        if (!formData.get('id')) {
            throw 'Cart form missing required property ID';
        }
        const formJson = JSON.stringify(Object.fromEntries(formData.entries()));
        const response = await this.post('/cart/add.js', formJson);
        if (this._settings.updateState) {
            await this.getState();
        }
        return response;
    }
    /**
     * Clear all cart attributes from Shopify and return the state
     * @see {@link https://shopify.dev/api/ajax/reference/cart#post-cart-update-js | ShopifyAPI: POST /cart/update.js}
     * @see {@link https://shopify.dev/docs/themes/liquid/reference/objects/cart#cart-attributes | ShopifyAPI: cart-attributes }
     */
    async clearAttributes() {
        const state = await this.getState();
        const data = JSON.stringify({
            attributes: this.clearProps(state.attributes),
        });
        return await this.post('/cart/update.js', data);
    }
    /**
     * Use the POST /cart/clear.js endpoint to set all quantities of all line items in the cart to zero.
     * @see {@link https://shopify.dev/docs/themes/ajax-api/reference/cart#post-cart-clear-js | ShopifyAPI: POST /cart/clear.js}
     */
    async clearItems() {
        return await this.post('/cart/clear.js');
    }
    /**
     * Remove the cart note
     * @see {@link https://shopify.dev/docs/themes/liquid/reference/objects/cart#cart-note | ShopifyAPI: cart.note }
     */
    async clearNote() {
        return await this.post('/cart/update.js', JSON.stringify({ note: '' }));
    }
    /**
     * Removes an item from the cart using line item key or product id. Returns a promise which fulfills with the updated cart state.
     * @see {@link https://shopify.dev/docs/themes/ajax-api/reference/cart#post-cart-change-js | ShopifyAPI: POST /cart/change.js }
     */
    async removeItem(item) {
        return await this.post('/cart/change.js', JSON.stringify({ quantity: 0, ...item }));
    }
    /**
     * Update cart attributes from Shopify and return the state
     * @see {@link https://shopify.dev/docs/themes/liquid/reference/objects/cart#cart-attributes | ShopifyAPI: cart-attributes }
     */
    async updateAttributes(attributes) {
        return await this.post('/cart/update.js', JSON.stringify({ attributes: { ...attributes } }));
    }
    /**
     * The /cart/change.js endpoint changes the quantity and properties object of a cart line item.
     * Only items already in your cart can be changed, and only one line item at a time can be changed.
     * @see {@link https://shopify.dev/docs/themes/ajax-api/reference/cart#post-cart-change-js | ShopifyAPI: POST /cart/change.js }
     */
    async updateItem(item) {
        return await this.post('/cart/change.js', JSON.stringify(item));
    }
    /**
     * Update or create the cart note
     * @see {@link https://shopify.dev/docs/themes/liquid/reference/objects/cart#cart-note | ShopifyAPI: cart.note }
     */
    async updateNote(note) {
        return await this.post('/cart/update.js', JSON.stringify({ note: note }));
    }
    async post(route, data) {
        const url = this._settings.url + route;
        const postConfig = this._settings.postConfig;
        if (data) {
            postConfig.body = data;
        }
        this.cartEvent('cart:requestStarted', route);
        const request = await fetch(url, postConfig);
        const response = await request.json();
        this.checkResponse(response);
        this.cartEvent('cart:requestComplete', route);
        return response;
    }
    checkResponse(response) {
        if (response['status'] === 404) {
            throw new VariantError();
        }
        if (response['status'] === 422) {
            throw new InventoryError(response['description']);
        }
        if (response['token']) {
            this._state = response;
        }
    }
    clearProps(target) {
        const clearList = {};
        Object.getOwnPropertyNames(target).forEach((prop) => (clearList[prop] = ''));
        return clearList;
    }
    cartEvent(name, route) {
        document.dispatchEvent(new CustomEvent(name, {
            detail: {
                cart: this,
                route: route,
            },
            bubbles: true,
            cancelable: true,
            composed: false,
        }));
    }
}
