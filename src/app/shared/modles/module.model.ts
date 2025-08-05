// src/app/shared/modles/module.model.ts
import { Product } from './product.model';

export interface ProductModule {
  id: string;
  productId: string;
  version: string;
  name: string;
  description?: string;
  createdAt?: Date;
  isActive: boolean;
   editing?: boolean; 
}


