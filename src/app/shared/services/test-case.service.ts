import { Injectable, signal } from '@angular/core';
// import { TestCase } from 'src/app/shared/modles/testcase.model';
// import { ProductModule } from 'src/app/shared/modles/module.model';
import { ProductVersion } from 'src/app/shared/modles/version.model';
import { TestCase } from '../modles/testcase.model';
import { ProductModule } from '../modles/module.model';
import { DUMMY_TEST_CASES } from '../data/dummy-testcases';
import { DUMMY_MODULES } from '../data/dummy-model-data';
// import { DUMMY_MODULES, DUMMY_TEST_CASES } from 'src/app/shared/data/dummy-model-data';
// import { DUMMY_TEST_CASES, DUMMY_MODULES, TestCase, ProductModule } from '../data/test-data';

@Injectable({
  providedIn: 'root'
})
export class TestCaseService {
  private testCases = signal<TestCase[]>([]);
  private productModules = signal<ProductModule[]>([]);
  private productVersions = signal<ProductVersion[]>([]);

  constructor() {
    this.initializeData();
  }

  private initializeData(): void {
    // Process test cases to ensure all fields have values
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

    console.log('Data initialized:', {
      modules: this.productModules().length,
      testCases: this.testCases().length,
      mod1TestCases: this.testCases().filter(tc => tc.moduleId === 'mod1').length
    });
  }

  private initializeVersions(): void {
    const versionsMap = new Map<string, ProductVersion>();
    
    this.testCases().forEach(tc => {
      if (!versionsMap.has(tc.version)) {
        const module = this.productModules().find(m => m.id === tc.moduleId);
        versionsMap.set(tc.version, {
          id: `ver-${tc.version}`,
          productId: module?.productId || '1', // Changed from 'p1' to '1' for consistency
          version: tc.version
        });
      }
    });
    
    this.productVersions.set(Array.from(versionsMap.values()));
  }

  // ======== Module Management ========
  getModules(): ProductModule[] {
    return this.productModules();
  }

  getModulesByProduct(productId: string): ProductModule[] {
    // Handle both '1' and 'p1' formats for backward compatibility
    const normalizedProductId = productId.startsWith('p') ? productId.substring(1) : productId;
    return this.productModules().filter(m => 
      m.productId === normalizedProductId || 
      m.productId === `p${normalizedProductId}`
    );
  }

  getModulesByVersion(productId: string, version: string): ProductModule[] {
    const normalizedProductId = productId.startsWith('p') ? productId.substring(1) : productId;
    return this.productModules().filter(m => 
      (m.productId === normalizedProductId || m.productId === `p${normalizedProductId}`) && 
      m.version === version
    );
  }

  addModule(name: string, productId: string): string {
    if (!name?.trim()) {
      throw new Error('Module name is required');
    }

    const newId = `mod${Date.now()}`;
    const versions = this.getVersionsByProduct(productId);
    const latestVersion = versions[versions.length - 1] || 'v1.0';

    const newModule: ProductModule = {
      id: newId,
      productId: productId.startsWith('p') ? productId.substring(1) : productId,
      version: latestVersion,
      name: name.trim(),
    };

    this.productModules.update(curr => [...curr, newModule]);

    // Add initial test case
    this.addTestCase({
      slNo: 1,
      moduleId: newId,
      version: latestVersion,
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

  // ======== Version Management ========
  addVersionToProduct(productId: string, version: string): void {
    if (!/^v\d+(\.\d+)*$/.test(version)) {
      throw new Error('Version must be in format vX.Y');
    }

    const normalizedProductId = productId.startsWith('p') ? productId.substring(1) : productId;
    const exists = this.productVersions().some(v => 
      (v.productId === normalizedProductId || v.productId === `p${normalizedProductId}`) && 
      v.version === version
    );

    if (!exists) {
      this.productVersions.update(curr => [
        ...curr,
        { id: `ver${Date.now()}`, productId: normalizedProductId, version },
      ]);
    }
  }

  getVersionsByProduct(productId: string): string[] {
    const normalizedProductId = productId.startsWith('p') ? productId.substring(1) : productId;
    return this.productVersions()
      .filter(v => v.productId === normalizedProductId)
      .map(v => v.version)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  removeVersionFromProduct(productId: string, version: string): boolean {
    const normalizedProductId = productId.startsWith('p') ? productId.substring(1) : productId;
    const original = this.productVersions();
    const updated = original.filter(v => 
      !(v.productId === normalizedProductId && v.version === version)
    );
    
    if (updated.length !== original.length) {
      this.productVersions.set(updated);
      return true;
    }
    return false;
  }

  hasVersion(productId: string, version: string): boolean {
    return this.getVersionsByProduct(productId).includes(version);
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

  getVersionsByModule(moduleId: string): string[] {
    const versions = new Set<string>();
    this.testCases()
      .filter(tc => tc.moduleId === moduleId)
      .forEach(tc => versions.add(tc.version));
    return Array.from(versions).sort();
  }

  // ======== Test Case Management ========
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
    if (!testCase.moduleId || !this.productModules().some(m => m.id === testCase.moduleId)) {
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
    return completeCase;
  }

  updateTestCase(updatedCase: TestCase): TestCase {
    if (!this.productModules().some(m => m.id === updatedCase.moduleId)) {
      throw new Error(`Invalid moduleId: ${updatedCase.moduleId}`);
    }

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

  // ======= Utility Methods =======
  private getNextSlNoForModule(moduleId: string): number {
    const moduleCases = this.testCases().filter(tc => tc.moduleId === moduleId);
    return moduleCases.length > 0
      ? Math.max(...moduleCases.map(tc => tc.slNo)) + 1
      : 1;
  }

  private generateTestCaseId(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  // ======= Debug Methods =======
  debugCheckData(): void {
    console.log('=== DATA INTEGRITY CHECK ===');
    console.log('All Modules:', this.productModules());
    console.log('All Test Cases:', this.testCases());
    
    // Check for test cases with invalid module references
    const invalidTestCases = this.testCases().filter(tc => 
      !this.productModules().some(m => m.id === tc.moduleId)
    );
    
    if (invalidTestCases.length > 0) {
      console.error('Test cases with invalid module references:', invalidTestCases);
    } else {
      console.log('All test cases have valid module references');
    }

    // Check module coverage
    this.productModules().forEach(module => {
      const moduleTestCases = this.testCases().filter(tc => tc.moduleId === module.id);
      console.log(`Module ${module.id} (${module.name}) has ${moduleTestCases.length} test cases`);
    });
  }

  validateDataIntegrity(): void {
    const modules = this.productModules();
    const testCases = this.testCases();
    
    // Check for orphaned test cases
    const orphanedTestCases = testCases.filter(tc => 
      !modules.some(m => m.id === tc.moduleId)
    );
    
    if (orphanedTestCases.length > 0) {
      console.error('Orphaned test cases found:', orphanedTestCases);
    }
    
    // Check for modules without test cases
    const emptyModules = modules.filter(m => 
      !testCases.some(tc => tc.moduleId === m.id)
    );
    
    if (emptyModules.length > 0) {
      console.warn('Modules without test cases:', emptyModules);
    }
  }
}