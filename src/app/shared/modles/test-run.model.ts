// Custom broader result type, used elsewhere in UI
export type TestResult = 'Pass' | 'Fail' | 'Pending' | 'Blocked';

// Actual stored result type in test case
export type TestCaseResultType = 'Passed' | 'Failed' | 'Skipped' | 'Pending';

export interface TestCaseResult {
  id: string;
  result: TestCaseResultType;
}

export interface TestSuiteRef {
  id: string;
  name: string;
  testCases?: TestCaseResult[];
}

export interface TestRun {
  id: string;
  name: string;
  description: string;
  testSuites: TestSuiteRef[];
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Blocked';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export function mapToTestCaseResult(result: TestResult): TestCaseResultType {
  switch (result) {
    case 'Pass': return 'Passed';
    case 'Fail': return 'Failed';
    case 'Blocked': return 'Skipped';
    case 'Pending': return 'Pending';
  }
}