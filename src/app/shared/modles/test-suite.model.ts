  // test-suite.model.ts
  // src/app/shared/modles/test-suite.model.ts
  export interface TestCaseRef {
    id: string;           // References TestCase.id (primary key)
    testCaseId: string;   // Business ID (TC1001 format)
    moduleId: string;     // For filtering/grouping
    version: string;      // Version reference
  }

export interface TestSuite {
  id: string;
  productId: string;
  name: string;
  description?: string;
  testCases: TestCaseRef[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface TestSuiteTestCase {
  id?: number;
  testSuiteId: string;
  testCaseId: string;
  moduleId: string;
  version: string;
  addedAt?: Date;
}