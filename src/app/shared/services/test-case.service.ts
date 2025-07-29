import { Injectable, signal } from '@angular/core';
import { TestCase, DUMMY_TEST_CASES } from '../data/dummy-testcases';

@Injectable({
  providedIn: 'root'
})
export class TestCaseService {
  private testCases = signal<TestCase[]>(this.initializeTestCases());
  private modules = signal(this.initializeModules());

  private initializeTestCases(): TestCase[] {
    return DUMMY_TEST_CASES.map(tc => ({
      ...tc,
      result: tc.result || 'Pending',
      actual: tc.actual || '',
      remarks: tc.remarks || '',
      uploads: tc.uploads || [],
      attributes: tc.attributes || []
    }));
  }

  private initializeModules() {
    return [
      { id: 'mod1', name: 'Login Module' },
      { id: 'mod2', name: 'Reports Module' },
      { id: 'mod3', name: 'Profile Module' },
      { id: 'mod4', name: 'Cart Module' },
      { id: 'mod5', name: 'Search Module' },
      { id: 'mod6', name: 'Upload Module' },
      { id: 'mod7', name: 'Settings Module' }
    ];
  }

  getTestCases() {
    return this.testCases();
  }

  getModules() {
    return this.modules();
  }

  getVersionsByModule(moduleId: string): string[] {
    const versions = new Set<string>();
    this.testCases()
      .filter(tc => tc.moduleId === moduleId)
      .forEach(tc => versions.add(tc.version));
    return Array.from(versions).sort((a, b) => a.localeCompare(b));
  }

  addTestCase(testCase: Omit<TestCase, 'id'>): TestCase {
    const completeCase: TestCase = {
      ...testCase,
      id: Date.now().toString(),
      result: testCase.result || 'Pending',
      actual: testCase.actual || '',
      remarks: testCase.remarks || '',
      uploads: testCase.uploads || [],
      attributes: testCase.attributes || []
    };
    
    this.testCases.update(current => [...current, completeCase]);
    return completeCase;
  }

  updateTestCase(updatedCase: TestCase): TestCase {
    const completeCase: TestCase = {
      ...updatedCase,
      result: updatedCase.result || 'Pending',
      actual: updatedCase.actual || '',
      remarks: updatedCase.remarks || '',
      uploads: updatedCase.uploads || [],
      attributes: updatedCase.attributes || []
    };

    this.testCases.update(current => 
      current.map(tc => tc.id === completeCase.id ? completeCase : tc)
    );
    return completeCase;
  }

  deleteTestCase(id: string): boolean {
    const exists = this.testCases().some(tc => tc.id === id);
    if (exists) {
      this.testCases.update(current => current.filter(tc => tc.id !== id));
      return true;
    }
    return false;
  }

  addModule(name: string, initialVersion = 'v1.0'): string {
    const newId = `mod${Date.now()}`;
    this.modules.update(current => [...current, { id: newId, name }]);
    if (initialVersion) {
      this.addVersion(newId, initialVersion);
    }
    return newId;
  }

  deleteModule(moduleId: string): boolean {
    const exists = this.modules().some(m => m.id === moduleId);
    if (exists) {
      this.modules.update(current => current.filter(m => m.id !== moduleId));
      this.testCases.update(current => current.filter(tc => tc.moduleId !== moduleId));
      return true;
    }
    return false;
  }

  addVersion(moduleId: string, version: string): TestCase {
    if (!this.modules().some(m => m.id === moduleId)) {
      throw new Error(`Module ${moduleId} not found`);
    }

    if (!version.match(/^v\d+(\.\d+)*$/)) {
      throw new Error('Version must be in format vX.Y');
    }

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
      uploads: []
    });
  }

  private generateTestCaseId(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  getTestCasesByModuleAndVersion(moduleId: string, version: string): TestCase[] {
    return this.testCases()
      .filter(tc => tc.moduleId === moduleId && tc.version === version)
      .sort((a, b) => a.slNo - b.slNo);
  }

  private getNextSlNoForModule(moduleId: string): number {
    const moduleCases = this.testCases().filter(tc => tc.moduleId === moduleId);
    return moduleCases.length > 0 
      ? Math.max(...moduleCases.map(tc => tc.slNo)) + 1
      : 1;
  }
}