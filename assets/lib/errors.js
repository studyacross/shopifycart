export class InventoryError {
    constructor(description) {
        this.status = 422;
        this.message = "Cart Error";
        this.description = description;
    }
}
export class VariantError {
    constructor() {
        this.status = 404;
        this.message = "Cart Error";
        this.description = "Cannot find variant";
    }
}
