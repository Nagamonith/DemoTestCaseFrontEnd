import { Injectable, signal } from '@angular/core';
import { TestCaseRef, TestSuite } from 'src/app/shared/modles/test-suite.model';
import { DUMMY_TEST_SUITES } from 'src/app/shared/data/ummy-test-suites';
import { TestCase } from 'src/app/shared/data/dummy-testcases';
import { TestCaseService } from './test-case.service';

@Injectable({
  providedIn: 'root'
})
export class TestSuiteService {
  private testSuites = signal<TestSuite[]>(this.initializeTestSuites());

  constructor(private testCaseService: TestCaseService) {}

  private initializeTestSuites(): TestSuite[] {
    return DUMMY_TEST_SUITES.map(suite => ({
      ...suite,
      createdAt: new Date(suite.createdAt),
      updatedAt: new Date(suite.updatedAt)
    }));
  }

  getTestSuites(productId?: string): TestSuite[] {
    if (productId) {
      return this.testSuites().filter(suite => suite.productId === productId);
    }
    return this.testSuites();
  }

  getTestSuiteById(id: string): TestSuite | undefined {
    return this.testSuites().find(suite => suite.id === id);
  }

  addTestSuite(name: string, productId: string, description: string = ''): TestSuite {
    if (!name?.trim()) throw new Error('Test suite name is required');
    if (!productId) throw new Error('Product ID is required');

    const newSuite: TestSuite = {
      id: `suite${Date.now()}`,
      name: name.trim(),
      productId,
      description,
      testCases: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };

    this.testSuites.update(current => [...current, newSuite]);
    return newSuite;
  }

  updateTestSuite(id: string, updates: Partial<TestSuite>): TestSuite | undefined {
    const existing = this.getTestSuiteById(id);
    if (!existing) return undefined;

    const updatedSuite = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    this.testSuites.update(current => 
      current.map(suite => suite.id === id ? updatedSuite : suite)
    );
    return updatedSuite;
  }

  deleteTestSuite(id: string): boolean {
    const exists = this.testSuites().some(suite => suite.id === id);
    if (exists) {
      this.testSuites.update(current => current.filter(suite => suite.id !== id));
      return true;
    }
    return false;
  }

  addTestCaseToSuite(suiteId: string, testCaseRef: TestCaseRef): boolean {
    const suite = this.getTestSuiteById(suiteId);
    if (!suite) return false;

    if (suite.testCases.some(tc => tc.id === testCaseRef.id)) {
      return false;
    }

    this.testSuites.update(current => 
      current.map(s => s.id === suiteId ? {
        ...s,
        testCases: [...s.testCases, testCaseRef],
        updatedAt: new Date()
      } : s)
    );
    return true;
  }

  removeTestCaseFromSuite(suiteId: string, testCaseId: string): boolean {
    const suite = this.getTestSuiteById(suiteId);
    if (!suite) return false;

    this.testSuites.update(current => 
      current.map(s => s.id === suiteId ? {
        ...s,
        testCases: s.testCases.filter(tc => tc.testCaseId !== testCaseId),
        updatedAt: new Date()
      } : s)
    );
    return true;
  }

  getTestCasesForSuite(suiteId: string): TestCase[] {
    const suite = this.getTestSuiteById(suiteId);
    if (!suite) return [];

    return suite.testCases.map(ref => {
      const testCase = this.testCaseService.getTestCases().find(
        tc => tc.testCaseId === ref.testCaseId && tc.moduleId === ref.moduleId
      );
      return testCase ? { ...testCase } : null;
    }).filter(tc => tc !== null) as TestCase[];
  }
}