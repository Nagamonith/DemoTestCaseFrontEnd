// test-run.model.ts
// src/app/shared/modles/test-run.model.ts

// Used throughout UI for simplicity
export type TestResult = 'Pass' | 'Fail' | 'Pending' | 'Blocked';

// Stored in DB - matches CHECK constraint in TestCases.Result and TestRunResults.ResultStatus
export type TestCaseResultType =
  | 'Passed'
  | 'Failed'
  | 'Skipped'
  | 'Pending'
  | 'Pass'
  | 'Fail'
  | 'Blocked';

export interface TestCaseResult {
  id: string;                     // Usually testCaseId
  result: TestCaseResultType;    // Value stored in DB
}

// Reference to TestSuites inside TestRuns
export interface TestSuiteRef {
  id: string;
  name: string;
  testCases?: TestCaseResult[];
}

// Master Test Run structure (aligned with DB table: TestRuns)
export interface TestRun {
  id: string;
  productId: string;  // ✅ Missing - now added
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
    case 'Pass':
      return 'Passed';
    case 'Fail':
      return 'Failed';
    case 'Blocked':
      return 'Skipped'; // UI 'Blocked' maps to stored 'Skipped'
    case 'Pending':
    default:
      return 'Pending';
  }
}
