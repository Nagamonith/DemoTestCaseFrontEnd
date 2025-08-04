// test-case.service.ts
import { Injectable, signal, effect, inject } from '@angular/core';
import { generateVersionId, getVersionStrings, ProductVersion, validateVersionFormat } from '../modles/version.model';
import { TestCase } from '../modles/testcase.model';
import { ProductModule } from '../modles/module.model';
import { DUMMY_TEST_CASES } from '../data/dummy-testcases';
import { DUMMY_MODULES } from '../data/dummy-model-data';
import { ProductService } from './product.service';
import { first, lastValueFrom, take } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TestCaseService {
  private testCases = signal<TestCase[]>([]);
  private productModules = signal<ProductModule[]>([]);
  private productVersions = signal<ProductVersion[]>([]);
  private productService = inject(ProductService);

  constructor() {
    this.initializeData();
    this.setupPersistence();
  }

  private setupPersistence(): void {
    effect(() => {
      try {
        localStorage.setItem('testCases', JSON.stringify(this.testCases()));
        localStorage.setItem('productModules', JSON.stringify(this.productModules()));
        localStorage.setItem('productVersions', JSON.stringify(this.productVersions()));
      } catch (e) {
        console.error('Failed to save data to localStorage', e);
      }
    });
  }

private initializeData(): void {
  try {
    const savedTestCases = localStorage.getItem('testCases');
    const savedModules = localStorage.getItem('productModules');
    const savedVersions = localStorage.getItem('productVersions');

    if (savedTestCases && savedModules && savedVersions) {
      this.testCases.set(JSON.parse(savedTestCases));
      this.productModules.set(JSON.parse(savedModules));
      this.productVersions.set(JSON.parse(savedVersions));
      console.log('Data loaded from localStorage');
      this.validateDataIntegrity();
      return;
    }
  } catch (e) {
    console.error('Failed to parse saved data', e);
    localStorage.clear();
  }

  console.log('Initializing with dummy data');
  this.resetToDummyData();
  this.initializeVersions(); // Add this line
}

private syncVersions(): void {
  this.initializeVersions();
  // Trigger change detection if needed
  this.productVersions.update(v => [...v]);
}

private initializeVersions(): void {
  const versionsMap = new Map<string, ProductVersion>();
  
  // 1. Get versions from test cases
  this.testCases().forEach(tc => {
    const module = this.productModules().find(m => m.id === tc.moduleId);
    if (module) {
      const versionKey = `${module.productId}-${tc.version}`;
      if (!versionsMap.has(versionKey)) {
        versionsMap.set(versionKey, {
          id: generateVersionId(module.productId, tc.version),
          productId: module.productId,
          version: tc.version,
          createdAt: new Date()
        });
      }
    }
  });

  // 2. Get versions from modules (in case modules have versions not in test cases)
  this.productModules().forEach(module => {
    if (module.version) {
      const versionKey = `${module.productId}-${module.version}`;
      if (!versionsMap.has(versionKey)) {
        versionsMap.set(versionKey, {
          id: generateVersionId(module.productId, module.version),
          productId: module.productId,
          version: module.version,
          createdAt: new Date()
        });
      }
    }
  });

  // 3. Ensure at least one version exists for each product
  const products = new Set(this.productModules().map(m => m.productId));
  products.forEach(productId => {
    const hasVersion = Array.from(versionsMap.values()).some(v => v.productId === productId);
    if (!hasVersion) {
      const defaultVersion = 'v1.0';
      versionsMap.set(`${productId}-${defaultVersion}`, {
        id: generateVersionId(productId, defaultVersion),
        productId: productId,
        version: defaultVersion,
        createdAt: new Date()
      });
    }
  });

  this.productVersions.set(Array.from(versionsMap.values()));
}

  private normalizeProductId(productId: string): string {
  return productId.startsWith('p') ? productId.slice(1) : productId;
}
private hasTestCasesForModuleVersion(moduleId: string, version: string): boolean {
  return this.testCases().some(tc => 
    tc.moduleId === moduleId && tc.version === version
  );
}


  // ========== Module Management ==========
  getModules(): ProductModule[] {
    return this.productModules();
  }

  getModulesByProduct(productId: string): ProductModule[] {
    const normalized = productId.startsWith('p') ? productId.slice(1) : productId;
    return this.productModules().filter(m =>
      m.productId === normalized || m.productId === `p${normalized}`
    );
  }

  getModulesByVersion(productId: string, version: string): ProductModule[] {
    const normalized = productId.startsWith('p') ? productId.slice(1) : productId;
    return this.productModules().filter(m =>
      (m.productId === normalized || m.productId === `p${normalized}`) &&
      m.version === version
    );
  }
async addModule(name: string, productId: string): Promise<string> {
  if (!name?.trim()) throw new Error('Module name is required');
  if (!productId) throw new Error('Product ID is required');

  try {
    // Verify product exists
    const products = await lastValueFrom(
      this.productService.getProducts().pipe(take(1), first())
    );
    if (!products?.some(p => p.id === productId)) {
      throw new Error(`Product with ID ${productId} not found`);
    }

    // Get version strings (not ProductVersion objects)
    const versionStrings = this.getVersionStringsByProduct(productId);
    const latestVersion = versionStrings[versionStrings.length - 1] || 'v1.0';

    // Create new module
    const newId = `mod${Date.now()}`;
    const newModule: ProductModule = {
      id: newId,
      productId,
      version: latestVersion,
      name: name.trim(),
    };

    // Update modules
    this.productModules.update(curr => [...curr, newModule]);

    // Add initial test case
    this.addTestCase({
      slNo: 1,
      moduleId: newId,
      version: latestVersion,  // Using the string version
      testCaseId: `TC${this.generateTestCaseId()}`,
      useCase: 'Initial test case for new module',
      scenario: 'Initial scenario',
      steps: 'Initial steps',
      expected: 'Initial expectation',
      result: 'Pending',
      actual: '',
      remarks: '',
      attributes: [],
      uploads: [],
    });

    return newId;
  } catch (error) {
    console.error('Error in addModule:', error);
    throw error;
  }
}
private ensureVersion(productId: string, version: string): string {
  const normalized = productId.startsWith('p') ? productId.slice(1) : productId;
  
  // Check if version exists
  const exists = this.productVersions().some(v => 
    v.productId === normalized && v.version === version
  );
  
  if (!exists) {
    // Add if doesn't exist
    this.addVersionToProduct(productId, version);
  }
  
  return version;
}

  deleteModule(moduleId: string): boolean {
    const exists = this.productModules().some(m => m.id === moduleId);
    if (exists) {
      this.productModules.update(curr => curr.filter(m => m.id !== moduleId));
      this.testCases.update(curr => curr.filter(tc => tc.moduleId !== moduleId));
      return true;
    }
    return false;
  }

  // ========== Version Management ==========
getVersionsByProduct(productId: string): ProductVersion[] {
  const normalized = productId.startsWith('p') ? productId.slice(1) : productId;
  return this.productVersions()
    .filter(v => v.productId === normalized)
    .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
}
getVersionStringsByProduct(productId: string): string[] {
  const normalized = productId.startsWith('p') ? productId.slice(1) : productId;
  return this.productVersions()
    .filter(v => v.productId === normalized)
    .map(v => v.version)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

  hasVersion(productId: string, version: string): boolean {
  const normalized = this.normalizeProductId(productId);
  return this.productVersions().some(v => 
    v.productId === normalized && v.version === version
  );
}

// Ensure consistent version handling
addVersionToProduct(productId: string, version: string): ProductVersion {
  if (!/^v\d+(\.\d+)*$/.test(version)) {
    throw new Error('Version must be in format vX.Y');
  }

  const normalized = productId.startsWith('p') ? productId.slice(1) : productId;
  const existing = this.productVersions().find(v => 
    v.productId === normalized && v.version === version
  );

  if (existing) return existing;

  const newVersion: ProductVersion = {
    id: `ver-${version}-${normalized}`,
    productId: normalized,
    version,
    createdAt: new Date()
  };

  this.productVersions.update(curr => [...curr, newVersion]);
  return newVersion;
}
  removeVersionFromProduct(productId: string, version: string): boolean {
  const normalized = this.normalizeProductId(productId);
  const updated = this.productVersions().filter(v =>
    !(v.productId === normalized && v.version === version)
  );

  if (updated.length !== this.productVersions().length) {
    this.productVersions.set(updated);
    return true;
  }
  return false;
}

getVersionsByModule(moduleId: string): ProductVersion[] {
  const module = this.productModules().find(m => m.id === moduleId);
  if (!module) return [];

  return this.getVersionsByProduct(module.productId)
    .filter(v => this.hasTestCasesForModuleVersion(moduleId, v.version));
}

  addVersion(moduleId: string, version: string): TestCase {
    const module = this.productModules().find(m => m.id === moduleId);
    if (!module) throw new Error(`Module ${moduleId} not found`);
    if (!/^v\d+(\.\d+)*$/.test(version)) throw new Error('Version must be in format vX.Y');

    this.addVersionToProduct(module.productId, version);

    return this.addTestCase({
      slNo: this.getNextSlNoForModule(moduleId),
      moduleId,
      version,
      testCaseId: `TC${this.generateTestCaseId()}`,
      useCase: 'Initial test case for new version',
      scenario: 'Initial scenario',
      steps: 'Initial steps',
      expected: 'Initial expectation',
      result: 'Pending',
      actual: '',
      remarks: '',
      attributes: [],
      uploads: [],
    });
  }

  // ========== Test Case Management ==========
  getTestCases(): TestCase[] {
    return this.testCases();
  }

  getTestCasesByModule(moduleId: string): TestCase[] {
    return this.testCases()
      .filter(tc => tc.moduleId === moduleId)
      .sort((a, b) => a.slNo - b.slNo);
  }

getTestCasesByModuleAndVersion(moduleId: string, version: string): TestCase[] {
  return this.testCases()
    .filter(tc => tc.moduleId === moduleId && tc.version === version)
    .sort((a, b) => a.slNo - b.slNo);
}

  addTestCase(testCase: Omit<TestCase, 'id'>): TestCase {
    if (!this.productModules().some(m => m.id === testCase.moduleId)) {
      throw new Error(`Invalid moduleId: ${testCase.moduleId}`);
    }

    const completeCase: TestCase = {
      ...testCase,
      id: Date.now().toString(),
      result: testCase.result || 'Pending',
      actual: testCase.actual || '',
      remarks: testCase.remarks || '',
      uploads: testCase.uploads || [],
      attributes: testCase.attributes || [],
    };

    this.testCases.update(curr => [...curr, completeCase]);
    this.ensureVersionExists(completeCase.moduleId, completeCase.version);
    return completeCase;
  }

  updateTestCase(updatedCase: TestCase): TestCase {
    const completeCase: TestCase = {
      ...updatedCase,
      result: updatedCase.result || 'Pending',
      actual: updatedCase.actual || '',
      remarks: updatedCase.remarks || '',
      uploads: updatedCase.uploads || [],
      attributes: updatedCase.attributes || [],
    };

    this.testCases.update(curr =>
      curr.map(tc => (tc.id === completeCase.id ? completeCase : tc))
    );

    return completeCase;
  }

  deleteTestCase(id: string): boolean {
    const exists = this.testCases().some(tc => tc.id === id);
    if (exists) {
      this.testCases.update(curr => curr.filter(tc => tc.id !== id));
      return true;
    }
    return false;
  }

  addTestCasesBulk(testCases: Omit<TestCase, 'id'>[]): { success: number; errors: number } {
    let successCount = 0;
    let errorCount = 0;

    this.testCases.update(curr => {
      const newCases = testCases.map(tc => {
        try {
          const completeCase: TestCase = {
            ...tc,
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            result: tc.result || 'Pending',
            actual: tc.actual || '',
            remarks: tc.remarks || '',
            uploads: tc.uploads || [],
            attributes: tc.attributes || [],
          };
          this.ensureVersionExists(completeCase.moduleId, completeCase.version);
          successCount++;
          return completeCase;
        } catch (e) {
          console.error(`Failed to add test case: ${e}`);
          errorCount++;
          return null;
        }
      }).filter(Boolean) as TestCase[];

      return [...curr, ...newCases];
    });

    return { success: successCount, errors: errorCount };
  }

  private ensureVersionExists(moduleId: string, version: string): void {
    const module = this.productModules().find(m => m.id === moduleId);
    if (!module) return;

    const exists = this.productVersions().some(v =>
      v.productId === module.productId && v.version === version
    );

    if (!exists) {
      this.productVersions.update(curr => [...curr, {
        id: `ver-${version}-${module.productId}`,
        productId: module.productId,
        version
      }]);
    }
  }

  // ========== Utilities ==========
  private getNextSlNoForModule(moduleId: string): number {
    const moduleCases = this.testCases().filter(tc => tc.moduleId === moduleId);
    return moduleCases.length > 0
      ? Math.max(...moduleCases.map(tc => tc.slNo)) + 1
      : 1;
  }

  private generateTestCaseId(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  resetToDummyData(): void {
    console.warn('Resetting to dummy data');
    localStorage.clear();

    const processedTestCases = DUMMY_TEST_CASES.map(tc => ({
      ...tc,
      result: tc.result || 'Pending',
      actual: tc.actual || '',
      remarks: tc.remarks || '',
      uploads: tc.uploads || [],
      attributes: tc.attributes || [],
    }));

    this.productModules.set(DUMMY_MODULES);
    this.testCases.set(processedTestCases);
    this.initializeVersions();
  }

  debugCheckData(): void {
    console.log('=== DATA INTEGRITY CHECK ===');
    console.log('Modules:', this.productModules().length);
    console.log('Test Cases:', this.testCases().length);
    console.log('Versions:', this.productVersions().length);

    const orphaned = this.testCases().filter(tc =>
      !this.productModules().some(m => m.id === tc.moduleId)
    );

    if (orphaned.length > 0) {
      console.error('Orphaned test cases:', orphaned);
    }

    this.productModules().forEach(module => {
      const count = this.testCases().filter(tc => tc.moduleId === module.id).length;
      console.log(`Module ${module.id} (${module.name}) has ${count} test cases`);
    });
  }

  validateDataIntegrity(): void {
    const modules = this.productModules();
    const testCases = this.testCases();

    const orphanedTestCases = testCases.filter(tc =>
      !modules.some(m => m.id === tc.moduleId)
    );

    if (orphanedTestCases.length > 0) {
      console.error('Orphaned test cases found:', orphanedTestCases);
    }

    const emptyModules = modules.filter(m =>
      !testCases.some(tc => tc.moduleId === m.id)
    );

    if (emptyModules.length > 0) {
      console.warn('Modules without test cases:', emptyModules);
    }
  }

}
