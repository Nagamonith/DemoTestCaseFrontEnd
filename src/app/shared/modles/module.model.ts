// src/app/shared/modles/module.model.ts

import { ModuleAttribute } from "./module-attribute.model";


export interface ProductModule {
  id: string;
  productId: string;
  version: string;
  name: string;
  description?: string;
  createdAt?: Date;
  isActive: boolean;
  editing?: boolean;
  attributes?: ModuleAttribute[]; 
}


