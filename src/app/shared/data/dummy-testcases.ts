import { TestCase, TestCaseAttribute } from 'src/app/shared/modles/testcase.model';

export const DUMMY_TEST_CASES: TestCase[] = [
  {
    id: '1',
    slNo: 1,
    moduleId: 'mod1',
    version: 'v1.0',
    testCaseId: 'TC101',
    useCase: 'Login Functionality',
    scenario: 'User logs in with valid credentials',
    steps: '1. Enter username\n2. Enter password\n3. Click login',
    expected: 'Dashboard should be displayed',
    result: 'Pending',
    actual: '',
    remarks: '',
    attributes: [],
    uploads: []
  },
  // Include all other test cases here...
  // (Copy all the test cases from your original file)
];

export type { TestCase };
