import { Injectable, signal, effect, inject } from '@angular/core';
import { generateVersionId, getVersionStrings, ProductVersion, validateVersionFormat } from '../modles/version.model';
import { TestCase, ManualTestCaseStep, TestCaseResult } from '../modles/testcase.model';
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
    this.initializeVersions();
  }

  private syncVersions(): void {
    this.initializeVersions();
    this.productVersions.update(v => [...v]);
  }

  private initializeVersions(): void {
    const versionsMap = new Map<string, ProductVersion>();
    
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

  // ========== Module Management ==========
  getModules(): ProductModule[] {
    return this.productModules();
  }

  getModuleById(moduleId: string): ProductModule | undefined {
    return this.productModules().find(m => m.id === moduleId);
  }

  getModulesByProduct(productId: string): ProductModule[] {
    const normalized = this.normalizeProductId(productId);
    return this.productModules().filter(m => this.normalizeProductId(m.productId) === normalized);
  }

  getActiveModulesByProduct(productId: string): ProductModule[] {
    return this.getModulesByProduct(productId).filter(m => m.isActive !== false);
  }

  getModulesByVersion(productId: string, version: string): ProductModule[] {
    const normalized = this.normalizeProductId(productId);
    return this.productModules().filter(m =>
      this.normalizeProductId(m.productId) === normalized && m.version === version
    );
  }

  async addModule(name: string, productId: string, version?: string): Promise<string> {
    if (!name?.trim()) throw new Error('Module name is required');
    if (!productId) throw new Error('Product ID is required');

    try {
      const products = await lastValueFrom(
        this.productService.getProducts().pipe(take(1), first())
      );
      if (!products?.some(p => p.id === productId)) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      const versionStrings = this.getVersionStringsByProduct(productId);
      const targetVersion = version || versionStrings[versionStrings.length - 1] || 'v1.0';

      const newId = `mod${Date.now()}`;
      const newModule: ProductModule = {
        id: newId,
        productId,
        version: targetVersion,
        name: name.trim(),
        isActive: true
      };

      this.productModules.update(curr => [...curr, newModule]);
      this.ensureVersion(productId, targetVersion);

      // Create initial test case
      this.addTestCase({
        moduleId: newId,
        version: targetVersion,
        testCaseId: `TC${this.generateTestCaseId()}`,
       
        useCase: 'Initial test case for new module',
        scenario: 'Initial scenario',
        testType: 'Manual',
        steps: [{
          testCaseId: newId,
          steps: 'Initial steps',
          expectedResult: 'Initial expectation'
        }],
        result: 'Pending',
        attributes: [],
        uploads: [],
      });

      return newId;
    } catch (error) {
      console.error('Error in addModule:', error);
      throw error;
    }
  }

  updateModule(moduleId: string, updates: Partial<ProductModule>): boolean {
    const index = this.productModules().findIndex(m => m.id === moduleId);
    if (index === -1) return false;

    this.productModules.update(curr => {
      const updated = [...curr];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });

    return true;
}

  toggleModuleActiveStatus(moduleId: string): boolean {
    const module = this.productModules().find(m => m.id === moduleId);
    if (!module) return false;

    return this.updateModule(moduleId, { isActive: !module.isActive });
  }

  deleteModule(moduleId: string): boolean {
    const exists = this.productModules().some(m => m.id === moduleId);
    if (exists) {
      this.productModules.update(curr => curr.filter(m => m.id !== moduleId));
      this.testCases.update(curr => curr.filter(tc => tc.moduleId !== moduleId));
      this.syncVersions();
      return true;
    }
    return false;
  }

  // ========== Version Management ==========
  getVersions(): ProductVersion[] {
    return this.productVersions();
  }

  getVersionsByProduct(productId: string): ProductVersion[] {
    const normalized = this.normalizeProductId(productId);
    return this.productVersions()
      .filter(v => this.normalizeProductId(v.productId) === normalized)
      .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
  }

  getVersionStringsByProduct(productId: string): string[] {
    const normalized = this.normalizeProductId(productId);
    return this.productVersions()
      .filter(v => this.normalizeProductId(v.productId) === normalized)
      .map(v => v.version)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  getLatestVersionForProduct(productId: string): string | undefined {
    const versions = this.getVersionStringsByProduct(productId);
    return versions.length > 0 ? versions[versions.length - 1] : undefined;
  }

  hasVersion(productId: string, version: string): boolean {
    const normalized = this.normalizeProductId(productId);
    return this.productVersions().some(v => 
      this.normalizeProductId(v.productId) === normalized && v.version === version
    );
  }

  addVersionToProduct(productId: string, version: string): ProductVersion {
    if (!validateVersionFormat(version)) {
      throw new Error('Version must be in format vX.Y or vX.Y.Z');
    }

    const normalized = this.normalizeProductId(productId);
    const existing = this.productVersions().find(v => 
      this.normalizeProductId(v.productId) === normalized && v.version === version
    );

    if (existing) return existing;

    const newVersion: ProductVersion = {
      id: generateVersionId(normalized, version),
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
      !(this.normalizeProductId(v.productId) === normalized && v.version === version)
    );

    if (updated.length !== this.productVersions().length) {
      this.productVersions.set(updated);
      
      // Clean up modules and test cases using this version
      const affectedModules = this.productModules().filter(m => 
        this.normalizeProductId(m.productId) === normalized && m.version === version
      );
      
      // Define targetVersion here so it's available in the entire scope
      const targetVersion = this.getLatestVersionForProduct(productId) || 'v1.0';
      
      if (affectedModules.length > 0) {
        // Move modules to latest version or default
        this.productModules.update(curr => 
          curr.map(m => 
            this.normalizeProductId(m.productId) === normalized && m.version === version
              ? { ...m, version: targetVersion }
              : m
          )
        );
      }

      // Update test cases to use the new version
      this.testCases.update(curr => 
        curr.map(tc => {
          const module = this.getModuleById(tc.moduleId);
          if (module && this.normalizeProductId(module.productId) === normalized && tc.version === version) {
            return { ...tc, version: targetVersion };
          }
          return tc;
        })
      );

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
    if (!validateVersionFormat(version)) throw new Error('Version must be in format vX.Y or vX.Y.Z');

    this.addVersionToProduct(module.productId, version);

    return this.addTestCase({
      moduleId,
      version,
      testCaseId: `TC${this.generateTestCaseId()}`,
      
      useCase: 'Initial test case for new version',
      scenario: 'Initial scenario',
      testType: 'Manual',
      steps: [{
        testCaseId: moduleId,
        steps: 'Initial steps',
        expectedResult: 'Initial expectation'
      }],
      result: 'Pending',
      attributes: [],
      uploads: [],
    });
  }

  // ========== Test Case Management ==========
  getTestCases(): TestCase[] {
    return this.testCases();
  }

  getTestCaseById(id: string): TestCase | undefined {
    return this.testCases().find(tc => tc.id === id);
  }

  getTestCasesByModule(moduleId: string): TestCase[] {
    return this.testCases()
      .filter(tc => tc.moduleId === moduleId)
      .sort((a, b) => (a.testCaseId.localeCompare(b.testCaseId)));
  }

  getTestCasesByModuleAndVersion(moduleId: string, version: string): TestCase[] {
    return this.testCases()
      .filter(tc => tc.moduleId === moduleId && tc.version === version)
      .sort((a, b) => (a.testCaseId.localeCompare(b.testCaseId)));
  }

  getTestCasesByProduct(productId: string): TestCase[] {
    const normalized = this.normalizeProductId(productId);
    const moduleIds = this.productModules()
      .filter(m => this.normalizeProductId(m.productId) === normalized)
      .map(m => m.id);
    
    return this.testCases()
      .filter(tc => moduleIds.includes(tc.moduleId))
      .sort((a, b) => (a.testCaseId.localeCompare(b.testCaseId)));
  }

  getTestCasesByProductAndVersion(productId: string, version: string): TestCase[] {
    const normalized = this.normalizeProductId(productId);
    const moduleIds = this.productModules()
      .filter(m => this.normalizeProductId(m.productId) === normalized && m.version === version)
      .map(m => m.id);
    
    return this.testCases()
      .filter(tc => moduleIds.includes(tc.moduleId) && tc.version === version)
      .sort((a, b) => (a.testCaseId.localeCompare(b.testCaseId)));
  }

countTestCasesByStatus(moduleId?: string, version?: string): Record<TestCaseResult, number> {
    const cases = moduleId 
      ? version 
        ? this.getTestCasesByModuleAndVersion(moduleId, version) 
        : this.getTestCasesByModule(moduleId)
      : this.getTestCases();

    // Initialize with all possible result types from TestCaseResult
    const counts: Record<TestCaseResult, number> = {
      'Pending': 0,
      'Passed': 0,
      'Failed': 0,
      'Blocked': 0,
      'Skipped': 0,
      'Pass': 0,
      'Fail': 0
    };

    cases.forEach(tc => {
      // Use 'Pending' as default if result is undefined
      const result = tc.result || 'Pending';
      counts[result] = (counts[result] || 0) + 1;
    });

    return counts;
}

  addTestCase(testCase: Omit<TestCase, 'id'>): TestCase {
    if (!this.productModules().some(m => m.id === testCase.moduleId)) {
      throw new Error(`Invalid moduleId: ${testCase.moduleId}`);
    }

    const completeCase: TestCase = {
      ...testCase,
      id: `tc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      testType: testCase.testType || 'Manual',
      testTool: testCase.testTool || undefined,
      result: testCase.result || 'Pending',
      actual: testCase.actual || '',
      remarks: testCase.remarks || '',
      uploads: testCase.uploads || [],
      attributes: testCase.attributes || [],
      steps: testCase.steps || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.testCases.update(curr => [...curr, completeCase]);
    this.ensureVersionExists(completeCase.moduleId, completeCase.version);
    return completeCase;
  }

  updateTestCase(updatedCase: TestCase): TestCase {
    const completeCase: TestCase = {
      ...updatedCase,
      testType: updatedCase.testType || 'Manual',
      testTool: updatedCase.testTool || undefined,
      result: updatedCase.result || 'Pending',
      actual: updatedCase.actual || '',
      remarks: updatedCase.remarks || '',
      uploads: updatedCase.uploads || [],
      attributes: updatedCase.attributes || [],
      steps: updatedCase.steps || [],
      updatedAt: new Date()
    };

    this.testCases.update(curr =>
      curr.map(tc => (tc.id === completeCase.id ? completeCase : tc))
    );

    return completeCase;
  }

  updateTestCaseResult(id: string, result: TestCaseResult, actual?: string): boolean {
    const index = this.testCases().findIndex(tc => tc.id === id);
    if (index === -1) return false;

    this.testCases.update(curr => {
      const updated = [...curr];
      updated[index] = { 
        ...updated[index], 
        result,
        actual: actual || updated[index].actual,
        updatedAt: new Date()
      };
      return updated;
    });

    return true;
  }

  deleteTestCase(id: string): boolean {
    const exists = this.testCases().some(tc => tc.id === id);
    if (exists) {
      this.testCases.update(curr => curr.filter(tc => tc.id !== id));
      this.syncVersions();
      return true;
    }
    return false;
  }

  deleteTestCasesByModule(moduleId: string): number {
    const count = this.testCases().filter(tc => tc.moduleId === moduleId).length;
    this.testCases.update(curr => curr.filter(tc => tc.moduleId !== moduleId));
    this.syncVersions();
    return count;
  }

  addTestCasesBulk(testCases: Omit<TestCase, 'id'>[]): { success: number; errors: number } {
    let successCount = 0;
    let errorCount = 0;

    this.testCases.update(curr => {
      const newCases = testCases.map(tc => {
        try {
          if (!this.productModules().some(m => m.id === tc.moduleId)) {
            throw new Error(`Invalid moduleId: ${tc.moduleId}`);
          }

          const completeCase: TestCase = {
            ...tc,
            id: `tc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            testType: tc.testType || 'Manual',
            testTool: tc.testTool || undefined,
            result: tc.result || 'Pending',
            actual: tc.actual || '',
            remarks: tc.remarks || '',
            uploads: tc.uploads || [],
            attributes: tc.attributes || [],
            steps: tc.steps || [],
            createdAt: new Date(),
            updatedAt: new Date()
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

  // ========== Step Management ==========
  addStepToTestCase(testCaseId: string, step: Omit<ManualTestCaseStep, 'id'>): boolean {
    const testCase = this.testCases().find(tc => tc.id === testCaseId);
    if (!testCase) return false;

    const newStep: ManualTestCaseStep = {
      ...step,
      id: Date.now() // Generate a unique ID for the step
    };

    this.testCases.update(curr =>
      curr.map(tc =>
        tc.id === testCaseId
          ? {
              ...tc,
              steps: [...(tc.steps || []), newStep],
              updatedAt: new Date()
            }
          : tc
      )
    );

    return true;
  }

  updateStepInTestCase(testCaseId: string, stepId: number, updates: Partial<ManualTestCaseStep>): boolean {
    const testCase = this.testCases().find(tc => tc.id === testCaseId);
    if (!testCase || !testCase.steps) return false;

    const stepIndex = testCase.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return false;

    this.testCases.update(curr =>
      curr.map(tc =>
        tc.id === testCaseId
          ? {
              ...tc,
              steps: (tc.steps || []).map(s =>
                s.id === stepId ? { ...s, ...updates } : s
              ),
              updatedAt: new Date()
            }
          : tc
      )
    );

    return true;
  }

  deleteStepFromTestCase(testCaseId: string, stepId: number): boolean {
    const testCase = this.testCases().find(tc => tc.id === testCaseId);
    if (!testCase || !testCase.steps) return false;

    const stepExists = testCase.steps.some(s => s.id === stepId);
    if (!stepExists) return false;

    this.testCases.update(curr =>
      curr.map(tc =>
        tc.id === testCaseId
          ? {
              ...tc,
              steps: (tc.steps || []).filter(s => s.id !== stepId),
              updatedAt: new Date()
            }
          : tc
      )
    );

    return true;
  }

  // ========== Utilities ==========
  private normalizeProductId(productId: string): string {
    return productId.startsWith('p') ? productId.slice(1) : productId;
  }

  private hasTestCasesForModuleVersion(moduleId: string, version: string): boolean {
    return this.testCases().some(tc => 
      tc.moduleId === moduleId && tc.version === version
    );
  }

  private ensureVersion(productId: string, version: string): string {
    const normalized = this.normalizeProductId(productId);
    
    const exists = this.productVersions().some(v => 
      this.normalizeProductId(v.productId) === normalized && v.version === version
    );
    
    if (!exists) {
      this.addVersionToProduct(productId, version);
    }
    
    return version;
  }

  private ensureVersionExists(moduleId: string, version: string): void {
    const module = this.productModules().find(m => m.id === moduleId);
    if (!module) return;

    const exists = this.productVersions().some(v =>
      this.normalizeProductId(v.productId) === this.normalizeProductId(module.productId) && v.version === version
    );

    if (!exists) {
      this.productVersions.update(curr => [...curr, {
        id: generateVersionId(module.productId, version),
        productId: module.productId,
        version,
        createdAt: new Date()
      }]);
    }
  }

  private generateTestCaseId(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  resetToDummyData(): void {
    console.warn('Resetting to dummy data');
    localStorage.clear();

    const processedTestCases = DUMMY_TEST_CASES.map(tc => ({
      ...tc,
      id: `tc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      testType: tc.testType || 'Manual',
      testTool: tc.testTool || undefined,
      result: tc.result || 'Pending',
      actual: tc.actual || '',
      remarks: tc.remarks || '',
      uploads: tc.uploads || [],
      attributes: tc.attributes || [],
      steps: tc.steps || [],
      createdAt: new Date(),
      updatedAt: new Date()
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
      console.error('Orphaned test cases:', orphaned.length);
    }

    const emptyModules = this.productModules().filter(m =>
      !this.testCases().some(tc => tc.moduleId === m.id)
    );

    if (emptyModules.length > 0) {
      console.warn('Modules without test cases:', emptyModules.length);
    }
  }

  validateDataIntegrity(): void {
    const modules = this.productModules();
    const testCases = this.testCases();

    // Check for orphaned test cases
    const orphanedTestCases = testCases.filter(tc =>
      !modules.some(m => m.id === tc.moduleId)
    );

    if (orphanedTestCases.length > 0) {
      console.error('Orphaned test cases found:', orphanedTestCases.length);
    }

    // Check for modules without test cases
    const emptyModules = modules.filter(m =>
      !testCases.some(tc => tc.moduleId === m.id)
    );

    if (emptyModules.length > 0) {
      console.warn('Modules without test cases:', emptyModules.length);
    }

    // Check for invalid version references
    const invalidVersions = testCases.filter(tc => {
      const module = modules.find(m => m.id === tc.moduleId);
      if (!module) return false;
      return !this.hasVersion(module.productId, tc.version);
    });

    if (invalidVersions.length > 0) {
      console.error('Test cases with invalid version references:', invalidVersions.length);
    }
  }
}

export type { ProductModule };
