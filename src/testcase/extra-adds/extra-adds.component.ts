import { Component, signal, OnInit, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, Product } from 'src/app/shared/services/product.service';
import { TestCaseService, ProductModule } from 'src/app/shared/services/test-case.service';
import { AutoSaveService } from 'src/app/shared/services/auto-save.service';
import {
  faPlus, faCube, faCodeBranch, faList, faCheck, faTimes,
  faSave, faEdit, faTrash, faBoxOpen
} from '@fortawesome/free-solid-svg-icons';
import { AlertComponent } from "src/app/shared/alert/alert.component";

interface Module extends ProductModule {
  editing?: boolean;
}

type PendingAction = 'addModule' | 'addVersion' | 'toggleModules' | null;

@Component({
  selector: 'app-extra-adds',
  standalone: true,
  imports: [CommonModule, FormsModule, AlertComponent],
  templateUrl: './extra-adds.component.html',
  styleUrls: ['./extra-adds.component.css']
})
export class ExtraAddsComponent implements OnInit {
  // Icons
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

  // State management
  products = signal<Product[]>([]);
  selectedProductId = signal<string>(''); 
  newProductName = '';
  
  // UI toggles
  showAddProductForm = false;
  showProductSelectorModal = false;
  showAddModuleForm = false;
  showAddVersionForm = false;
  showModuleList = false;
  pendingAction: PendingAction = null;
  showProducts = false;
  showAutoSavePopup = false;

  // Form fields
  newModuleName = '';
  newVersionName = '';
  newProductVersion = '';
  versionExists = false;

  // Alert system
  showAlert = false;
  alertMessage = '';
  alertType: 'success' | 'error' | 'warning' | 'info' = 'info';
  isConfirmAlert = false;
  pendingActionData: any = null;

  // Auto-save configuration
  autoSaveEnabled = true;
  selectedInterval = 3000;
  intervalOptions = [
    { label: '3 sec', value: 3000 },
    { label: '5 sec', value: 5000 },
    { label: '10 sec', value: 10000 },
    { label: '30 sec', value: 30000 },
    { label: '1 min', value: 60000 },
    { label: '3 min', value: 180000 }
  ];

  // Computed properties
  modules = computed(() => {
    if (!this.selectedProductId()) return [];
    return this.testCaseService.getModulesByProduct(this.selectedProductId());
  });

  versionsByModule = computed(() => {
    const result: Record<string, string[]> = {};
    this.modules().forEach(mod => {
      const versions = this.testCaseService.getVersionsByModule(mod.id);
      result[mod.id] = versions ? versions.map(v => v.version) : [];
    });
    return result;
  });

  productVersions = computed(() => {
    if (!this.selectedProductId()) return [];
    const versions = this.testCaseService.getVersionsByProduct(this.selectedProductId());
    return versions ? versions.map(v => v.version) : [];
  });

  constructor(
    private productService: ProductService,
    public testCaseService: TestCaseService,
    private autoSaveService: AutoSaveService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeAutoSave();
    this.loadProducts();
  }

  private initializeAutoSave(): void {
    this.autoSaveEnabled = this.autoSaveService.isEnabled();
    this.autoSaveService.setInterval(this.selectedInterval);
    if (this.autoSaveEnabled) {
      this.autoSaveService.start(() => {
        console.log('Auto-saving...');
      });
    }
  }

  // Product management
  loadProducts(): void {
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products.set(products);
        if (!this.selectedProductId() && products.length > 0) {
          this.selectedProductId.set(products[0].id);
        }
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.showAlertMessage('Failed to load products', 'error');
      }
    });
  }

  addProduct(): void {
    const name = this.newProductName.trim();
    if (!name) {
      this.showAlertMessage('Product name is required', 'warning');
      return;
    }

    this.productService.addProduct(name).subscribe({
      next: () => {
        this.newProductName = '';
        this.showAddProductForm = false;
        this.loadProducts();
        this.showAlertMessage('Product added successfully', 'success');
      },
      error: (error) => {
        console.error('Failed to add product:', error);
        this.showAlertMessage('Failed to add product. Please try again.', 'error');
      }
    });
  }

  saveProductEdit(product: Product): void {
    const trimmedName = product.name.trim();
    if (!trimmedName) {
      this.showAlertMessage('Product name cannot be empty', 'warning');
      return;
    }

    product.editing = false;
    this.productService.updateProduct(product).subscribe({
      next: () => {
        this.loadProducts();
        this.showAlertMessage('Product updated successfully', 'success');
      },
      error: (error) => {
        console.error('Failed to update product:', error);
        product.editing = true;
        this.showAlertMessage('Failed to update product. Please try again.', 'error');
      }
    });
  }

  deleteProduct(productId: string): void {
    this.pendingActionData = { type: 'product', id: productId };
    this.showConfirmAlert('Are you sure you want to delete this product?');
  }

  // Module management
  handleAddModule(): void {
    if (this.products().length === 0) {
      this.resetAllToggles();
      this.showAddProductForm = true;
      return;
    }
    this.resetAllToggles();
    this.pendingAction = 'addModule';
    this.showProductSelectorModal = true;
  }

  saveModule(): void {
    const name = this.newModuleName.trim();
    if (!name) {
      this.showAlertMessage('Module name is required', 'warning');
      return;
    }

    const productId = this.selectedProductId();
    if (!productId) {
      this.showAlertMessage('No product selected', 'warning');
      return;
    }

    this.testCaseService.addModule(name, productId);
    this.newModuleName = '';
    this.showAddModuleForm = false;
    this.showAlertMessage('Module added successfully', 'success');
  }

  startEditing(module: Module): void {
    this.testCaseService.updateModule(module.id, { editing: true });
  }

  saveEditing(module: Module): void {
    const name = module.name.trim();
    if (!name) {
      this.showAlertMessage('Module name cannot be empty', 'warning');
      return;
    }

    this.testCaseService.updateModule(module.id, { 
      name: name,
      editing: false 
    });
    this.showAlertMessage('Module updated successfully', 'success');
  }

  deleteModule(moduleId: string): void {
    this.pendingActionData = { type: 'module', id: moduleId };
    this.showConfirmAlert('Are you sure you want to delete this module and all its versions?');
  }

  // Version management
  handleAddVersion(): void {
    if (this.products().length === 0) {
      this.resetAllToggles();
      this.showAddProductForm = true;
      return;
    }
    this.resetAllToggles();
    this.pendingAction = 'addVersion';
    this.showProductSelectorModal = true;
  }

  saveVersion(): void {
    const version = this.newVersionName.trim();
    if (!version) {
      this.showAlertMessage('Version name is required', 'warning');
      return;
    }

    const productId = this.selectedProductId();
    if (!productId) {
      this.showAlertMessage('No product selected', 'warning');
      return;
    }

    const existingVersions = this.testCaseService.getVersionsByProduct(productId);
    if (existingVersions?.some(v => v.version === version)) {
      this.showAlertMessage('This version already exists for the selected product', 'warning');
      return;
    }

    this.testCaseService.addVersionToProduct(productId, version);
    this.newVersionName = '';
    this.showAddVersionForm = false;
    this.showAlertMessage('Version added successfully', 'success');
  }

  addProductVersion(): void {
    const version = this.newProductVersion.trim();
    if (!version) {
      this.showAlertMessage('Version name cannot be empty', 'warning');
      return;
    }

    if (!/^v\d+(\.\d+)*$/.test(version)) {
      this.showAlertMessage('Version must be in format vX.Y or vX.Y.Z', 'warning');
      return;
    }

    const productId = this.selectedProductId();
    if (!productId) {
      this.showAlertMessage('No product selected', 'error');
      return;
    }

    const existingVersions = this.testCaseService.getVersionsByProduct(productId);
    if (existingVersions?.some(v => v.version === version)) {
      this.versionExists = true;
      this.showAlertMessage(`Version ${version} already exists for this product`, 'warning');
      return;
    }

    try {
      this.testCaseService.addVersionToProduct(productId, version);
      this.newProductVersion = '';
      this.versionExists = false;
      this.cdr.detectChanges();
      this.showAlertMessage(`Version ${version} added successfully`, 'success');
    } catch (error) {
      console.error('Failed to add version:', error);
      this.showAlertMessage('Failed to add version. Please try again.', 'error');
    }
  }

  confirmRemoveProductVersion(version: string): void {
    this.pendingActionData = { type: 'version', id: version, productId: this.selectedProductId() };
    this.showConfirmAlert('Are you sure you want to remove this version?');
  }

  removeProductVersion(version: string): void {
    const productId = this.selectedProductId();
    if (!productId) return;
    this.testCaseService.removeVersionFromProduct(productId, version);
    this.showAlertMessage('Version removed successfully', 'success');
  }

  // UI helpers
  toggleProductSelection(productId: string): void {
    this.selectedProductId.set(
      this.selectedProductId() === productId ? '' : productId
    );
  }

  getProductName(productId: string): string {
    const product = this.products().find(p => p.id === productId);
    return product?.name || 'Unknown Product';
  }

  getProductVersions(productId: string): string[] {
    if (!productId) return [];
    const versions = this.testCaseService.getVersionsByProduct(productId);
    return versions ? versions.map(v => v.version) : [];
  }

  handleToggleModules(): void {
    if (this.products().length === 0) {
      this.resetAllToggles();
      this.showAddProductForm = true;
      return;
    }
    this.resetAllToggles();
    this.pendingAction = 'toggleModules';
    this.showProductSelectorModal = true;
  }

  confirmProductSelection(): void {
    if (!this.selectedProductId()) {
      this.showAlertMessage('Please select a product', 'warning');
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

  cancelProductSelection(): void {
    this.pendingAction = null;
    this.showProductSelectorModal = false;
  }

  resetAllToggles(): void {
    this.showAddProductForm = false;
    this.showProductSelectorModal = false;
    this.showAddModuleForm = false;
    this.showAddVersionForm = false;
    this.showModuleList = false;
    this.showProducts = false;
    this.pendingAction = null;
    this.showAutoSavePopup = false;
  }

  toggleAutoSavePopup(): void {
    const wasOpen = this.showAutoSavePopup;
    this.resetAllToggles();
    this.showAutoSavePopup = !wasOpen;
  }

  toggleAutoSave(): void {
    this.autoSaveEnabled = this.autoSaveService.toggle();
    if (this.autoSaveEnabled) {
      this.autoSaveService.start(() => {
        console.log('Auto-saving...');
      });
    } else {
      this.autoSaveService.stop();
    }
  }

  updateInterval(): void {
    this.autoSaveService.setInterval(this.selectedInterval);
  }

  // Alert system
  showConfirmAlert(message: string): void {
    this.alertMessage = message;
    this.alertType = 'warning';
    this.isConfirmAlert = true;
    this.showAlert = true;
    this.cdr.detectChanges();
  }

  showAlertMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    this.alertMessage = message;
    this.alertType = type;
    this.isConfirmAlert = false;
    this.showAlert = true;
    this.cdr.detectChanges();

    if (type !== 'warning') {
      setTimeout(() => {
        this.showAlert = false;
        this.cdr.detectChanges();
      }, 3000);
    }
  }

  handleConfirmDelete(): void {
    if (!this.pendingActionData) return;

    if (this.pendingActionData.type === 'product') {
      this.productService.deleteProduct(this.pendingActionData.id).subscribe({
        next: () => {
          this.loadProducts();
          if (this.selectedProductId() === this.pendingActionData.id) {
            this.selectedProductId.set('');
          }
          this.showAlertMessage('Product deleted successfully', 'success');
        },
        error: (error) => {
          console.error('Failed to delete product:', error);
          this.showAlertMessage('Failed to delete product. Please try again.', 'error');
        }
      });
    } else if (this.pendingActionData.type === 'module') {
      this.testCaseService.deleteModule(this.pendingActionData.id);
      this.showAlertMessage('Module deleted successfully', 'success');
    } else if (this.pendingActionData.type === 'version') {
      this.removeProductVersion(this.pendingActionData.id);
    }

    this.pendingActionData = null;
    this.showAlert = false;
  }

  handleCancelDelete(): void {
    this.showAlert = false;
    this.pendingActionData = null;
    this.cdr.detectChanges();
  }
}