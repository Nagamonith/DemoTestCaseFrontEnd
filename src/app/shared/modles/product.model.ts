// product.model.ts
// src/app/shared/modles/product.model.ts
export interface Product {
  id: string;
  name: string;
  description?: string;
  createdAt?: Date;
  isActive: boolean;
  editing?: boolean; // UI-only
}
