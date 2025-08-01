import { ProductModule } from 'src/app/shared/modles/module.model';

export const DUMMY_MODULES: ProductModule[] = [
  { id: 'mod1', productId: '1', version: 'v1.0', name: 'Login Module' },
  { id: 'mod2', productId: '1', version: 'v1.0', name: 'Reports Module' },
  { id: 'mod3', productId: '2', version: 'v1.0', name: 'Profile Module' },
  { id: 'mod4', productId: '2', version: 'v1.1', name: 'Cart Module' },
  { id: 'mod5', productId: '3', version: 'v2.0', name: 'Search Module' },
  { id: 'mod6', productId: '3', version: 'v2.0', name: 'Upload Module' },
  { id: 'mod7', productId: '3', version: 'v2.1', name: 'Settings Module' },
];