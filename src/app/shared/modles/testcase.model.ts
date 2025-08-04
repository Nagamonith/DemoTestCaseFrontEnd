export interface TestCaseAttribute {
  key: string;
  value: string;
}

export interface TestCase {
  id: string;
  slNo: number;
  moduleId: string;
  version: string;
  testCaseId: string;
  useCase: string;
  scenario: string;
  steps: string;
  expected: string;
  result?: 'Pass' | 'Fail' | 'Pending' | 'Blocked';
  actual?: string;
  remarks?: string;
  attributes: TestCaseAttribute[];
  uploads?: string[];
}