import { Component, signal, OnInit, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, Product } from 'src/app/shared/services/product.service';
import { TestCaseService } from 'src/app/shared/services/test-case.service';
import { AutoSaveService } from 'src/app/shared/services/auto-save.service';
import {
  faPlus, faCube, faCodeBranch, faList, faCheck, faTimes,
  faSave, faEdit, faTrash, faBoxOpen
} from '@fortawesome/free-solid-svg-icons';
import { AlertComponent } from "src/app/shared/alert/alert.component";

interface Module {
  id: string;
  name: string;
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
  showAutoSavePopup = false;

  newModuleName = '';
  newModuleVersion = 'v1.0';
  newVersionName = '';
  selectedModuleId = '';

  showAlert = false;
  alertMessage = '';
  alertType: 'success' | 'error' | 'warning' | 'info' = 'info';
  isConfirmAlert = false;
  pendingDeleteId: string | null = null;
  pendingActionData: any = null;

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

  modules = signal<Module[]>([]);
  versionsByModule = computed(() => {
    const result: Record<string, string[]> = {};
    this.modules().forEach(mod => {
      result[mod.id] = this.testCaseService.getVersionsByModule(mod.id);
    });
    return result;
  });

  newProductVersion = '';
  versionExists = false;

  constructor(
    private productService: ProductService,
    public testCaseService: TestCaseService,
    private autoSaveService: AutoSaveService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.autoSaveEnabled = this.autoSaveService.isEnabled();
    this.autoSaveService.setInterval(this.selectedInterval);
    if (this.autoSaveEnabled) {
      this.autoSaveService.start(() => {
        console.log('Auto-saving...');
      });
    }

    this.loadProducts();
    this.modules.set(this.testCaseService.getModules());
  }

  resetAllToggles(): void {
    this.showAddProductForm = false;
    this.showProductSelectorModal = false;
    this.showAddModuleForm = false;
    this.showAddVersionForm = false;
    this.showModuleList = false;
    this.showProductList = false;
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

  loadProducts(): void {
    this.productService.getProducts().subscribe((products) => {
      this.products.set(products);
      if (!this.selectedProductId() && products.length > 0) {
        this.selectedProductId.set(products[0].id);
      }
    });
  }

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
        this.loadProducts();
        this.showAlertMessage('Product added successfully', 'success');
      },
      error: (err) => {
        console.error('Failed to add product:', err);
        this.showAlertMessage('Failed to add product. Please try again.', 'error');
      }
    });
  }

  handleAddModule() {
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
    const newId = this.testCaseService.addModule(name, productId);
    this.modules.set(this.testCaseService.getModules());
    this.showAlertMessage('Module added successfully', 'success');
    this.resetModuleForm();
  }

  resetModuleForm(): void {
    this.newModuleName = '';
    this.showAddModuleForm = false;
  }

  startEditing(module: Module) {
    this.modules.update(mods => mods.map(m => m.id === module.id ? { ...m, editing: true } : m));
  }

  saveEditing(module: Module) {
    const name = module.name.trim();
    if (!name) {
      this.showAlertMessage('Module name cannot be empty', 'warning');
      return;
    }
    this.modules.update(mods => mods.map(m => m.id === module.id ? { ...m, name, editing: false } : m));
    this.showAlertMessage('Module updated successfully', 'success');
  }

  deleteModule(moduleId: string) {
    this.pendingActionData = { type: 'module', id: moduleId };
    this.showConfirmAlert('Are you sure you want to delete this module and all its versions?');
  }

  handleAddVersion() {
    if (this.modules().length === 0) {
      this.showAlertMessage('Please add a module first', 'warning');
      return;
    }
    this.resetAllToggles();
    this.pendingAction = 'addVersion';
    this.showProductSelectorModal = true;
  }

  saveVersion() {
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
    if (existingVersions.includes(version)) {
      this.showAlertMessage('This version already exists for the selected product', 'warning');
      return;
    }
    this.testCaseService.addVersionToProduct(productId, version);
    this.showAlertMessage('Version added successfully', 'success');
    this.resetVersionForm();
  }

  resetVersionForm() {
    this.newVersionName = '';
    this.showAddVersionForm = false;
  }

  getProductVersions(productId: string): string[] {
    return this.testCaseService.getVersionsByProduct(productId);
  }

  handleToggleModules() {
    if (this.products().length === 0) {
      this.resetAllToggles();
      this.showAddProductForm = true;
      return;
    }
    this.resetAllToggles();
    this.pendingAction = 'toggleModules';
    this.showProductSelectorModal = true;
  }

  confirmProductSelection() {
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

  cancelProductSelection() {
    this.pendingAction = null;
    this.showProductSelectorModal = false;
  }

  saveProductEdit(product: Product) {
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
      error: (err) => {
        console.error('Failed to update product:', err);
        product.editing = true;
        this.showAlertMessage('Failed to update product. Please try again.', 'error');
      }
    });
  }

  deleteProduct(productId: string) {
    this.pendingActionData = { type: 'product', id: productId };
    this.showConfirmAlert('Are you sure you want to delete this product?');
  }

  showConfirmAlert(message: string) {
    this.alertMessage = message;
    this.alertType = 'warning';
    this.isConfirmAlert = true;
    this.showAlert = true;
    this.cdr.detectChanges();
  }

  showAlertMessage(message: string, type: 'success' | 'error' | 'warning' | 'info') {
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

  addProductVersion(): void {
    const version = this.newProductVersion.trim();
    if (!version) return;

    const productId = this.selectedProductId();
    if (!productId) return;

    if (this.testCaseService.getVersionsByProduct(productId).includes(version)) {
      this.versionExists = true;
      return;
    }

    this.versionExists = false;
    this.testCaseService.addVersionToProduct(productId, version);
    this.newProductVersion = '';
    this.showAlertMessage('Version added successfully', 'success');
  }

  confirmRemoveProductVersion(version: string): void {
    this.pendingActionData = { type: 'version', id: version, productId: this.selectedProductId() };
    this.showConfirmAlert('Are you sure you want to remove this version?');
  }

  handleConfirmDelete(): void {
    if (this.pendingActionData) {
      if (this.pendingActionData.type === 'product') {
        this.productService.deleteProduct(this.pendingActionData.id).subscribe({
          next: () => {
            this.loadProducts();
            if (this.selectedProductId() === this.pendingActionData.id) {
              this.selectedProductId.set('');
            }
            this.showAlertMessage('Product deleted successfully', 'success');
          },
          error: (err) => {
            console.error('Failed to delete product:', err);
            this.showAlertMessage('Failed to delete product. Please try again.', 'error');
          }
        });
      } else if (this.pendingActionData.type === 'module') {
        this.modules.update(mods => mods.filter(m => m.id !== this.pendingActionData.id));
        this.showAlertMessage('Module deleted successfully', 'success');
      } else if (this.pendingActionData.type === 'version') {
        this.removeProductVersion(this.pendingActionData.id);
      }
    }
    this.pendingActionData = null;
    this.pendingDeleteId = null;
  }

  handleCancelDelete(): void {
    this.showAlert = false;
    this.pendingActionData = null;
    this.pendingDeleteId = null;
    this.cdr.detectChanges();
  }

  removeProductVersion(version: string): void {
    const productId = this.selectedProductId();
    if (!productId) return;
    this.testCaseService.removeVersionFromProduct(productId, version);
    this.showAlertMessage('Version removed successfully', 'success');
  }

  toggleProductSelection(productId: string): void {
    this.selectedProductId.set(
      this.selectedProductId() === productId ? '' : productId
    );
  }
}
