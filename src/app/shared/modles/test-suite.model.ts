  // test-suite.model.ts
  export interface TestCaseRef {
    id: string;           // References TestCase.id (primary key)
    testCaseId: string;   // Business ID (TC1001 format)
    moduleId: string;     // For filtering/grouping
    version: string;      // Version reference
  }

  export interface TestSuite {
    id: string;
    name: string;
    description?: string;
    testCases: TestCaseRef[];  // Uses TestCaseRef, not full TestCase
    createdAt: Date;
    updatedAt: Date;
  }