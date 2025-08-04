import { TestRun } from 'src/app/shared/modles/test-run.model';

export const DUMMY_TEST_RUNS: TestRun[] = [
  {
    id: 'run1',
    name: 'Login Feature Test Run',
    description: 'Full regression test for login functionality',
    testSuites: [
      {
        id: 'suite1',
        name: 'Login Test Suite'
      }
    ],
    status: 'Completed',
    createdAt: new Date('2025-03-01'),
    updatedAt: new Date('2025-03-01'),
    createdBy: 'admin@test.com'
  },
  // Include other test runs...
];