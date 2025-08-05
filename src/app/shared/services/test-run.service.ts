import { Injectable, signal } from '@angular/core';
import { TestRun, TestSuiteRef, mapToTestCaseResult } from 'src/app/shared/modles/test-run.model';
import { TestSuite } from 'src/app/shared/modles/test-suite.model';
import { DUMMY_TEST_RUNS } from '../data/dummy-test-runs';
import { TestCaseService } from './test-case.service';
import { TestSuiteService } from './test-suite.service';

type TestResult = 'Pass' | 'Fail' | 'Pending' | 'Blocked';

@Injectable({
  providedIn: 'root'
})
export class TestRunService {
  private testRuns = signal<TestRun[]>(this.initializeTestRuns());

  constructor(
    private testCaseService: TestCaseService,
    private testSuiteService: TestSuiteService
  ) {}

  private normalizeResult(input: string | undefined): TestResult {
    switch ((input || '').toLowerCase()) {
      case 'passed': return 'Pass';
      case 'pass': return 'Pass';
      case 'failed': return 'Fail';
      case 'fail': return 'Fail';
      case 'skipped': return 'Blocked';
      case 'blocked': return 'Blocked';
      case 'pending': return 'Pending';
      default: return 'Pending';
    }
  }

  private initializeTestRuns(): TestRun[] {
    return DUMMY_TEST_RUNS.map(run => ({
      ...run,
      status: run.status ?? 'Not Started',
      createdAt: new Date(run.createdAt),
      updatedAt: new Date(run.updatedAt),
      testSuites: run.testSuites.map(suite => ({
        ...suite,
        testCases: suite.testCases || []
      }))
    }));
  }

  getTestRuns(productId?: string): TestRun[] {
    if (productId) {
      return this.testRuns().filter(run => run.productId === productId);
    }
    return this.testRuns();
  }

  getTestRunById(id: string): TestRun | undefined {
    return this.testRuns().find(run => run.id === id);
  }

  addTestRun(
    name: string,
    description: string = '',
    testSuites: TestSuite[],
    createdBy: string = 'currentUser'
  ): TestRun {
    if (testSuites.length === 0) {
      throw new Error('At least one test suite must be provided to create a test run.');
    }

    const productId = testSuites[0].productId;

    const newRun: TestRun = {
      id: `run${Date.now()}`,
      productId,
      name,
      description,
      testSuites: this.mapSuites(testSuites),
      status: 'Not Started',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy
    };

    this.testRuns.update(current => [...current, newRun]);
    return newRun;
  }

  updateTestRun(
    id: string,
    updates: {
      name?: string;
      description?: string;
      testSuites?: TestSuite[];
      status?: TestRun['status'];
    }
  ): TestRun | undefined {
    const existing = this.getTestRunById(id);
    if (!existing) return undefined;

    const updatedRun: TestRun = {
      ...existing,
      name: updates.name ?? existing.name,
      description: updates.description ?? existing.description,
      testSuites: updates.testSuites ? this.mapSuites(updates.testSuites) : existing.testSuites,
      status: updates.status ?? existing.status,
      updatedAt: new Date()
    };

    this.testRuns.update(current =>
      current.map(run => (run.id === id ? updatedRun : run))
    );

    return updatedRun;
  }

  deleteTestRun(id: string): boolean {
    const exists = this.testRuns().some(run => run.id === id);
    if (exists) {
      this.testRuns.update(current => current.filter(run => run.id !== id));
      return true;
    }
    return false;
  }

  addTestCaseToRun(
    runId: string,
    testCaseId: string,
    result: 'Passed' | 'Failed' | 'Skipped' | 'Pending'
  ): void {
    const testRun = this.getTestRunById(runId);
    if (!testRun) return;

    const normalizedResult = this.normalizeResult(result);
    const finalResult = mapToTestCaseResult(normalizedResult);

    let found = false;
    for (const suite of testRun.testSuites) {
      suite.testCases = suite.testCases || [];
      const testCase = suite.testCases.find(tc => tc.id === testCaseId);
      if (testCase) {
        testCase.result = finalResult;
        found = true;
        break;
      }
    }

    if (!found && testRun.testSuites.length > 0) {
      testRun.testSuites[0].testCases = testRun.testSuites[0].testCases || [];
      testRun.testSuites[0].testCases.push({
        id: testCaseId,
        result: finalResult
      });
    }

    testRun.updatedAt = new Date();

    this.testRuns.update(current =>
      current.map(run => (run.id === runId ? testRun : run))
    );
  }

  getTestCasesForSuite(suiteId: string): any[] {
    const suite = this.testSuiteService.getTestSuiteById(suiteId);
    if (!suite) return [];

    return suite.testCases.map(ref => {
      const testCase = this.testCaseService.getTestCases().find(
        tc => tc.testCaseId === ref.testCaseId && tc.moduleId === ref.moduleId
      );

      if (testCase) {
        let result: TestResult = this.normalizeResult(testCase.result);

        const testRun = this.testRuns().find(run =>
          run.testSuites.some(s => s.id === suiteId)
        );

        if (testRun) {
          const suiteInRun = testRun.testSuites.find(s => s.id === suiteId);
          const testCaseRef = suiteInRun?.testCases?.find(tc => tc.id === testCase.testCaseId);
          if (testCaseRef?.result) {
            result = this.normalizeResult(testCaseRef.result);
          }
        }

        return {
          ...testCase,
          result
        };
      }

      return null;
    }).filter(tc => tc !== null) as any[];
  }

  getSuiteName(suiteId: string): string {
    const testRun = this.testRuns().find(run =>
      run.testSuites.some(suite => suite.id === suiteId)
    );

    if (testRun) {
      const suite = testRun.testSuites.find(s => s.id === suiteId);
      if (suite) return suite.name;
    }

    const suite = this.testSuiteService.getTestSuiteById(suiteId);
    return suite?.name || 'Unknown Suite';
  }

  getRunStatistics(runId: string): {
    total: number;
    passed: number;
    failed: number;
    pending: number;
    completion: number;
    suiteStats: Array<{
      suiteId: string;
      suiteName: string;
      total: number;
      passed: number;
      failed: number;
      pending: number;
      completion: number;
    }>;
  } | null {
    const testRun = this.getTestRunById(runId);
    if (!testRun) return null;

    let total = 0;
    let passed = 0;
    let failed = 0;
    let pending = 0;

    const suiteStats = testRun.testSuites.map(suite => {
      const suiteCases = this.getTestCasesForSuite(suite.id);
      const suiteTotal = suiteCases.length;
      const suitePassed = suiteCases.filter(tc => tc.result === 'Pass').length;
      const suiteFailed = suiteCases.filter(tc => tc.result === 'Fail').length;
      const suitePending = suiteCases.filter(tc => tc.result === 'Pending').length;

      total += suiteTotal;
      passed += suitePassed;
      failed += suiteFailed;
      pending += suitePending;

      return {
        suiteId: suite.id,
        suiteName: suite.name,
        total: suiteTotal,
        passed: suitePassed,
        failed: suiteFailed,
        pending: suitePending,
        completion: suiteTotal > 0 ? Math.round((suitePassed / suiteTotal) * 100) : 0
      };
    });

    return {
      total,
      passed,
      failed,
      pending,
      completion: total > 0 ? Math.round((passed / total) * 100) : 0,
      suiteStats
    };
  }

  private mapSuites(suites: TestSuite[]): TestSuiteRef[] {
    return suites.map(suite => ({
      id: suite.id,
      name: suite.name,
      testCases: []
    }));
  }
}
