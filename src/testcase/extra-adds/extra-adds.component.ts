import { Component, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, Product } from 'src/app/shared/services/product.service';
import { TestCaseService } from 'src/app/shared/services/test-case.service';
import { AutoSaveService } from 'src/app/shared/services/auto-save.service';

import {
  faPlus, faCube, faCodeBranch, faList, faCheck, faTimes,
  faSave, faEdit, faTrash, faBoxOpen
} from '@fortawesome/free-solid-svg-icons';

interface Module {
  id: string;
  name: string;
  editing?: boolean;
}

type PendingAction = 'addModule' | 'addVersion' | 'toggleModules' | null;

@Component({
  selector: 'app-extra-adds',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './extra-adds.component.html',
  styleUrls: ['./extra-adds.component.css']
})
export class ExtraAddsComponent implements OnInit {
  icons = {
    plus: faPlus,
    cube: faCube,
    codeBranch: faCodeBranch,
    list: faList,
    check: faCheck,
    times: faTimes,
    save: faSave,
    edit: faEdit,
    trash: faTrash,
    boxOpen: faBoxOpen
  };

  // Local state
  products = signal<Product[]>([]);
  selectedProductId = signal<string>('');
  newProductName = '';

  showAddProductForm = false;
  showProductSelectorModal = false;
  showAddModuleForm = false;
  showAddVersionForm = false;
  showModuleList = false;
  pendingAction: PendingAction = null;
  showProductList = false;
  showProducts = false;

  newModuleName = '';
  newModuleVersion = 'v1.0';
  newVersionName = '';
  selectedModuleId = '';

  showAutoSavePopup = false;

  autoSaveEnabled = true;
  selectedInterval = 3000; // default to 3 seconds
intervalOptions = [
  { label: '3 sec', value: 3000 },
  { label: '5 sec', value: 5000 },
  { label: '10 sec', value: 10000 },
  { label: '30 sec', value: 30000 },
  { label: '1 min', value: 60000 },
  { label: '3 min', value: 180000 }
];
  

  modules = signal<Module[]>([]);
  versionsByModule = computed(() => {
    const result: Record<string, string[]> = {};
    this.modules().forEach(mod => {
      result[mod.id] = this.testCaseService.getVersionsByModule(mod.id);
    });
    return result;
  });

  constructor(
    private productService: ProductService,
    private testCaseService: TestCaseService,
    private autoSaveService: AutoSaveService
  ) {}

ngOnInit(): void {
  this.autoSaveEnabled = this.autoSaveService.isEnabled();
  this.autoSaveService.setInterval(this.selectedInterval);
  if (this.autoSaveEnabled) {
    this.autoSaveService.start(() => {
      console.log('Auto-saving...'); // 🔁 Replace with actual save logic
    });
  }

  this.loadProducts();
  this.modules.set(this.testCaseService.getModules());
}
toggleAutoSavePopup(): void {
  this.showAutoSavePopup = !this.showAutoSavePopup;
}
toggleAutoSave(): void {
  this.autoSaveEnabled = this.autoSaveService.toggle();
  if (this.autoSaveEnabled) {
    this.autoSaveService.start(() => {
      console.log('Auto-saving...'); // 🔁 Replace with actual save logic
    });
  } else {
    this.autoSaveService.stop();
  }
}
updateInterval(): void {
  this.autoSaveService.setInterval(this.selectedInterval);
}


  loadProducts(): void {
    this.productService.getProducts().subscribe((products) => {
      this.products.set(products);
      if (!this.selectedProductId() && products.length > 0) {
        this.selectedProductId.set(products[0].id);
      }
    });
  }

  // Product methods
  getProductName(productId: string): string {
    return this.products().find(p => p.id === productId)?.name || 'Unknown Product';
  }
addProduct(): void {
  const name = this.newProductName.trim();
  if (!name) return;

  this.productService.addProduct(name).subscribe({
    next: () => {
      this.newProductName = '';
      this.showAddProductForm = false;
      this.loadProducts(); // Refresh the product list
    },
    error: (err) => {
      console.error('Failed to add product:', err);
      alert('Failed to add product. Please try again.');
    }
  });
}

  // Module methods
  handleAddModule() {
    if (this.products().length === 0) {
      this.showAddProductForm = true;
      return;
    }
    this.pendingAction = 'addModule';
    this.showProductSelectorModal = true;
  }

  saveModule() {
    const name = this.newModuleName.trim();
    const version = this.newModuleVersion.trim() || 'v1.0';
    if (!name) {
      alert('Module name is required');
      return;
    }

    const newId = this.testCaseService.addModule(name, version);
    this.modules.set(this.testCaseService.getModules());

    this.resetModuleForm();
  }

  private resetModuleForm() {
    this.newModuleName = '';
    this.newModuleVersion = 'v1.0';
    this.showAddModuleForm = false;
  }

  startEditing(module: Module) {
    this.modules.update(mods =>
      mods.map(m => m.id === module.id ? { ...m, editing: true } : m)
    );
  }

  saveEditing(module: Module) {
    const name = module.name.trim();
    if (!name) {
      alert('Module name cannot be empty');
      return;
    }

    this.modules.update(mods =>
      mods.map(m => m.id === module.id ? { ...m, name, editing: false } : m)
    );
  }

  deleteModule(moduleId: string) {
    if (confirm('Are you sure you want to delete this module and all its versions?')) {
      this.modules.update(mods => mods.filter(m => m.id !== moduleId));
      // Note: TestCaseService doesn't support module deletion
    }
  }

  // Version methods
  handleAddVersion() {
    if (this.modules().length === 0) {
      alert('Please add a module first');
      return;
    }
    this.pendingAction = 'addVersion';
    this.showProductSelectorModal = true;
  }

  saveVersion() {
    const version = this.newVersionName.trim();
    if (!this.selectedModuleId) {
      alert('Please select a module');
      return;
    }

    if (!version) {
      alert('Version name is required');
      return;
    }

    const existingVersions = this.versionsByModule()[this.selectedModuleId] || [];
    if (existingVersions.includes(version)) {
      alert('This version already exists for the selected module');
      return;
    }

    this.testCaseService.addVersion(this.selectedModuleId, version);
    this.resetVersionForm();
  }

  private resetVersionForm() {
    this.selectedModuleId = '';
    this.newVersionName = '';
    this.showAddVersionForm = false;
  }

  // Toggle modules
  handleToggleModules() {
    if (this.products().length === 0) {
      this.showAddProductForm = true;
      return;
    }
    this.pendingAction = 'toggleModules';
    this.showProductSelectorModal = true;
  }

  // Product selection
  confirmProductSelection() {
    if (!this.selectedProductId()) {
      alert('Please select a product');
      return;
    }

    this.showProductSelectorModal = false;

    switch (this.pendingAction) {
      case 'addModule':
        this.showAddModuleForm = true;
        break;
      case 'addVersion':
        this.showAddVersionForm = true;
        break;
      case 'toggleModules':
        this.showModuleList = !this.showModuleList;
        break;
    }

    this.pendingAction = null;
  }

  cancelProductSelection() {
    this.pendingAction = null;
    this.showProductSelectorModal = false;
  }

  saveProductEdit(product: Product) {
    const trimmedName = product.name.trim();
    if (!trimmedName) {
      alert('Product name cannot be empty');
      return;
    }

    product.editing = false;
    
    this.productService.updateProduct(product).subscribe({
      next: () => {
        this.loadProducts(); // Refresh the list
      },
      error: (err) => {
        console.error('Failed to update product:', err);
        product.editing = true; // Revert to edit mode if error occurs
      }
    });
  }

  deleteProduct(productId: string) {
    if (confirm('Are you sure you want to delete this product?')) {
      this.productService.deleteProduct(productId).subscribe({
        next: () => {
          this.loadProducts(); // Refresh the list
          
          // Reset selected product if it was deleted
          if (this.selectedProductId() === productId) {
            this.selectedProductId.set('');
          }
        },
        error: (err) => {
          console.error('Failed to delete product:', err);
          alert('Failed to delete product. Please try again.');
        }
      });
    }
  }
}