// product.model.ts
export interface Product {
  id: string;
  name: string;
  description?: string;
  createdAt?: Date;
  editing?: boolean;
  // Add any other product properties you need
}