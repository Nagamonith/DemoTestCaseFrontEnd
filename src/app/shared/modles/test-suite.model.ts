export interface TestSuite {
  id: string;
  name: string;
  description?: string;
  testCases: TestCaseRef[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCaseRef {
  testCaseId?: string;
  moduleId: string;
  version: string;
}