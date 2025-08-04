export interface TestCaseAttribute {
  key: string;
  value: string;
}
import { TestCaseResult } from './result-types.model';
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
  result?: TestCaseResult;
  actual?: string;
  remarks?: string;
  attributes: TestCaseAttribute[];
  uploads?: string[];
}