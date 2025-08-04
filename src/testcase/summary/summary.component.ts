import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { TestCaseService } from 'src/app/shared/services/test-case.service';
import { ProductService } from 'src/app/shared/services/product.service';

@Component({
  selector: 'app-summary',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.css'],
})
export class SummaryComponent {
  private testCaseService = inject(TestCaseService);
  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);

  // Get the selected product from route
  selectedProductId = signal<string>('');

  // Reactive data
  allTestCases = this.testCaseService.getTestCases();
  allModules = this.testCaseService.getModules();

  // Filtered data based on selected product
  modules = computed(() => {
    const productId = this.selectedProductId();
    return productId 
      ? this.allModules.filter(m => m.productId === productId)
      : [];
  });

  testCases = computed(() => {
    const productId = this.selectedProductId();
    if (!productId) return [];
    
    const moduleIds = this.modules().map(m => m.id);
    return this.allTestCases.filter(tc => moduleIds.includes(tc.moduleId));
  });

  versions = computed(() => {
    return Array.from(new Set(this.testCases().map(tc => tc.version)));
  });

  testMatrix = computed(() => {
    const map: Record<string, number> = {};
    for (const tc of this.testCases()) {
      const key = `${tc.moduleId}-${tc.version}`;
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  });

  constructor() {
    this.route.queryParams.subscribe(params => {
      if (params['productId']) {
        this.selectedProductId.set(params['productId']);
      }
    });
  }

  getCount(modId: string, ver: string): number {
    return this.testMatrix()[`${modId}-${ver}`] ?? 0;
  }

  getVersionTotal(ver: string): number {
    return this.modules().reduce((sum, mod) => sum + this.getCount(mod.id, ver), 0);
  }

  getProductName(): string {
    const productId = this.selectedProductId();
    if (!productId) return 'All Products';
    const product = this.productService.getProductById(productId);
    return product?.name || 'Selected Product';
  }
}