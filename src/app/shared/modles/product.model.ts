export interface Product {
  id: string;
  name: string;
  description?: string;
  createdAt?: Date;
  isActive: boolean;
  editing?: boolean; // UI-only
}
