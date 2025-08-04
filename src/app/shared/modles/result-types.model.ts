// shared/models/result-types.model.ts
export type TestCaseResult = 'Pass' | 'Fail' | 'Pending' | 'Blocked';
export type TestRunResult = 'Passed' | 'Failed' | 'Skipped' | 'Pending';

export function mapToTestCaseResult(runResult: TestRunResult): TestCaseResult {
  switch (runResult) {
    case 'Passed': return 'Pass';
    case 'Failed': return 'Fail';
    case 'Skipped': return 'Blocked';
    case 'Pending': return 'Pending';
    default: return 'Pending';
  }
}

export function mapToTestRunResult(caseResult: TestCaseResult): TestRunResult {
  switch (caseResult) {
    case 'Pass': return 'Passed';
    case 'Fail': return 'Failed';
    case 'Blocked': return 'Skipped';
    case 'Pending': return 'Pending';
    default: return 'Pending';
  }
}