

export interface TestCaseAttribute {
  key: string;
  value: string;
}

export interface TestCase {
  id: string;
  moduleId: string;
  version: string;
  testCaseId: string;
  useCase: string;
  scenario: string;
  testType: 'Manual' | 'Automation' | 'WebAPI' | 'Database' | 'Performance';
  testTool?: string;
  result?: TestCaseResult;
  actual?: string;
  remarks?: string;
  createdAt?: Date;
  updatedAt?: Date;
  steps?: ManualTestCaseStep[]; 
  attributes?: TestCaseAttribute[]; // Optional additional attributes
  uploads?: string[]; // Optional file uploads
}

export interface ManualTestCaseStep {
  id?: number; // Optional as it's auto-incremented in DB
  testCaseId: string;
  steps: string;
  expectedResult: string;
}

// Update the TestCaseResult type to match the CHECK constraint
export type TestCaseResult = 'Passed' | 'Failed' | 'Skipped' | 'Pending' | 'Pass' | 'Fail' | 'Blocked';