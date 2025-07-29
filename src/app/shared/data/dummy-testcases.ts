// dummy-testcases.ts

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

export interface TestCaseAttribute {
  key: string;
  value: string;
}

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
    attributes: [],
    uploads: []
  },
  {
    id: '2',
    slNo: 1,
    moduleId: 'mod2',
    version: 'v1.0',
    testCaseId: 'TC102',
    useCase: 'Report Generation',
    scenario: 'User generates monthly report',
    steps: '1. Navigate to Reports\n2. Select month\n3. Click Generate',
    expected: 'PDF report should download',
    result: 'Pass',
    attributes: [{ key: 'ReportType', value: 'Monthly' }],
    uploads: ['report-screenshot.png']
  },
  {
    id: '3',
    slNo: 2,
    moduleId: 'mod1',
    version: 'v1.1',
    testCaseId: 'TC103',
    useCase: 'Password Reset',
    scenario: 'User resets forgotten password',
    steps: '1. Click Forgot Password\n2. Enter email\n3. Submit',
    expected: 'Password reset email should be sent',
    result: 'Fail',
    actual: 'Email not sent due to SMTP error',
    remarks: 'Need to check email server configuration',
    attributes: [],
    uploads: []
  },
  {
    id: '4',
    slNo: 1,
    moduleId: 'mod3',
    version: 'v2.0',
    testCaseId: 'TC104',
    useCase: 'Profile Update',
    scenario: 'User updates profile information',
    steps: '1. Go to Profile\n2. Edit fields\n3. Save changes',
    expected: 'Profile should update with new information',
    result: 'Pending',
    attributes: [{ key: 'ProfileSection', value: 'PersonalInfo' }],
    uploads: []
  },
  {
    id: '5',
    slNo: 1,
    moduleId: 'mod4',
    version: 'v1.0',
    testCaseId: 'TC105',
    useCase: 'Add to Cart',
    scenario: 'User adds a product to cart',
    steps: '1. Search product\n2. Click Add to Cart',
    expected: 'Product appears in cart',
    result: 'Pass',
    attributes: [],
    uploads: []
  },
  {
    id: '6',
    slNo: 2,
    moduleId: 'mod4',
    version: 'v1.0',
    testCaseId: 'TC106',
    useCase: 'Remove from Cart',
    scenario: 'User removes a product from cart',
    steps: '1. Go to cart\n2. Click Remove',
    expected: 'Product is removed from cart',
    result: 'Fail',
    actual: 'Product still visible',
    remarks: 'DOM not updated properly',
    attributes: [],
    uploads: []
  },
  {
    id: '7',
    slNo: 1,
    moduleId: 'mod5',
    version: 'v1.0',
    testCaseId: 'TC107',
    useCase: 'Product Search',
    scenario: 'User searches for product by keyword',
    steps: '1. Enter keyword\n2. Click search',
    expected: 'Relevant products are listed',
    result: 'Pass',
    attributes: [{ key: 'SearchKeyword', value: 'Laptop' }],
    uploads: []
  },
  {
    id: '8',
    slNo: 1,
    moduleId: 'mod6',
    version: 'v1.0',
    testCaseId: 'TC108',
    useCase: 'Upload Document',
    scenario: 'User uploads profile document',
    steps: '1. Go to Uploads\n2. Click Choose File\n3. Submit',
    expected: 'File is uploaded and listed',
    result: 'Pending',
    attributes: [],
    uploads: ['resume.pdf']
  },
  {
    id: '9',
    slNo: 1,
    moduleId: 'mod7',
    version: 'v1.0',
    testCaseId: 'TC109',
    useCase: 'Change Theme',
    scenario: 'User changes application theme',
    steps: '1. Go to Settings\n2. Choose Dark Mode\n3. Save',
    expected: 'Theme switches to dark',
    result: 'Pass',
    attributes: [{ key: 'Theme', value: 'Dark' }],
    uploads: []
  },
  {
    id: '10',
    slNo: 2,
    moduleId: 'mod7',
    version: 'v1.0',
    testCaseId: 'TC110',
    useCase: 'Change Password',
    scenario: 'User changes account password',
    steps: '1. Go to Settings\n2. Enter old and new passwords\n3. Save',
    expected: 'Password is updated successfully',
    result: 'Fail',
    actual: 'Validation error on old password',
    remarks: 'Backend not accepting valid old password',
    attributes: [],
    uploads: []
  },
  {
    id: '11',
    slNo: 3,
    moduleId: 'mod1',
    version: 'v2.0',
    testCaseId: 'TC111',
    useCase: 'Session Timeout',
    scenario: 'User session expires after inactivity',
    steps: '1. Login\n2. Wait for 15 minutes without action',
    expected: 'User is logged out and redirected to login',
    result: 'Pass',
    attributes: [],
    uploads: []
  },
  {
    id: '12',
    slNo: 2,
    moduleId: 'mod3',
    version: 'v2.1',
    testCaseId: 'TC112',
    useCase: 'Update Email',
    scenario: 'User updates email address',
    steps: '1. Go to Profile\n2. Edit email\n3. Save',
    expected: 'Verification email is sent',
    result: 'Pending',
    attributes: [],
    uploads: []
  },
  {
    id: '13',
    slNo: 2,
    moduleId: 'mod2',
    version: 'v2.0',
    testCaseId: 'TC113',
    useCase: 'Download Report as Excel',
    scenario: 'User downloads report in Excel format',
    steps: '1. Go to Reports\n2. Click Export as Excel',
    expected: 'XLSX file is downloaded',
    result: 'Blocked',
    remarks: 'Export button disabled',
    attributes: [],
    uploads: []
  },
  {
    id: '14',
    slNo: 3,
    moduleId: 'mod2',
    version: 'v2.0',
    testCaseId: 'TC114',
    useCase: 'Filter Report by Date',
    scenario: 'User filters report between two dates',
    steps: '1. Select start and end date\n2. Click Filter',
    expected: 'Filtered data is shown',
    result: 'Pass',
    attributes: [{ key: 'StartDate', value: '2025-01-01' }, { key: 'EndDate', value: '2025-01-31' }],
    uploads: []
  },
  {
    id: '15',
    slNo: 2,
    moduleId: 'mod5',
    version: 'v1.1',
    testCaseId: 'TC115',
    useCase: 'Search with Suggestions',
    scenario: 'User sees suggestions while typing',
    steps: '1. Start typing in search bar',
    expected: 'Relevant suggestions are shown',
    result: 'Pass',
    attributes: [],
    uploads: []
  },
  {
    id: '16',
    slNo: 2,
    moduleId: 'mod6',
    version: 'v1.0',
    testCaseId: 'TC116',
    useCase: 'Upload File with Validation',
    scenario: 'User uploads large unsupported file',
    steps: '1. Select .exe file\n2. Click upload',
    expected: 'Validation error is shown',
    result: 'Fail',
    actual: 'File uploaded without validation',
    remarks: 'Missing file type check',
    attributes: [],
    uploads: ['malware.exe']
  }
];

export interface Module {
  id: string;
  name: string;
  description?: string;
}
