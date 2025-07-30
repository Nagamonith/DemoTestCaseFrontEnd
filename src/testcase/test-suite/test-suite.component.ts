import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TestSuiteService } from 'src/app/shared/services/test-suite.service';
import { TestCaseService } from 'src/app/shared/services/test-case.service';
import { TestSuite } from 'src/app/shared/data/test-suite.model';
import { TestCase } from 'src/app/shared/data/dummy-testcases';
import { AlertComponent } from 'src/app/shared/alert/alert.component';

@Component({
  selector: 'app-test-suite',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AlertComponent],
  templateUrl: './test-suite.component.html',
  styleUrls: ['./test-suite.component.css']
})
export class TestSuiteComponent {
  // Inject services
  private testSuiteService = inject(TestSuiteService);
  private testCaseService = inject(TestCaseService);

  // Form-bound fields
  suiteName: string = '';
  suiteDescription: string = '';
  selectedModuleId: string = '';

  // Signals for state
  mode = signal<'list' | 'add' | 'edit'>('list');
  selectedSuiteId = signal<string>('');
  selectedTestCases = signal<TestCase[]>([]);
  testSuites = signal<TestSuite[]>([]);
  modules = signal(this.testCaseService.getModules());
  availableTestCases = signal<TestCase[]>([]);

  // Alert system
  showAlert = signal(false);
  alertMessage = signal('');
  alertType = signal<'success' | 'error' | 'warning'>('success');
  isConfirmAlert = signal(false);
  pendingDeleteId = signal<string | null>(null);

  constructor() {
    this.loadTestSuites();
  }

  // Load all test suites
  private loadTestSuites(): void {
    this.testSuites.set(this.testSuiteService.getTestSuites());
  }

  // Start add
  startAddNewSuite(): void {
    this.mode.set('add');
    this.suiteName = '';
    this.suiteDescription = '';
    this.selectedModuleId = '';
    this.selectedTestCases.set([]);
    this.availableTestCases.set([]);
  }

  // Start edit
  startEditSuite(suiteId: string): void {
    const suite = this.testSuiteService.getTestSuiteById(suiteId);
    if (suite) {
      this.mode.set('edit');
      this.selectedSuiteId.set(suiteId);
      this.suiteName = suite.name;
      this.suiteDescription = suite.description || '';
      this.selectedModuleId = '';
      this.selectedTestCases.set(this.testSuiteService.getTestCasesForSuite(suiteId));
      this.availableTestCases.set([]);
    }
  }

  // Cancel
  cancelEdit(): void {
    this.mode.set('list');
    this.selectedSuiteId.set('');
    this.selectedModuleId = '';
    this.selectedTestCases.set([]);
    this.availableTestCases.set([]);
  }

  // Handle module selection
onModuleSelect(moduleId: string): void {
    this.selectedModuleId = moduleId;  // <-- Update the property directly
    this.availableTestCases.set(
      this.testCaseService.getTestCases().filter(tc => tc.moduleId === moduleId)
    );
  }


  // Toggle checkbox
  // In your TestSuiteComponent class
toggleTestCaseSelection(testCase: TestCase, isChecked: boolean): void {
  if (isChecked) {
    this.selectedTestCases.update(current => [...current, testCase]);
  } else {
    this.selectedTestCases.update(current => 
      current.filter(tc => tc.id !== testCase.id)
    );
  }
}
handleCheckboxChange(testCase: TestCase, event: Event): void {
  const isChecked = (event.target as HTMLInputElement).checked;
  this.toggleTestCaseSelection(testCase, isChecked);
}
  // For checkbox checked status
  isTestCaseSelected(testCase: TestCase): boolean {
    return this.selectedTestCases().some(tc => tc.id === testCase.id);
  }

  // Remove from selected manually
  removeSelectedTestCase(testCaseId: string): void {
    this.selectedTestCases.update(current =>
      current.filter(tc => tc.id !== testCaseId)
    );
  }

  // Save test suite (create or update)
  saveTestSuite(): void {
    if (!this.suiteName.trim()) {
      this.showAlertMessage('Test suite name is required', 'error');
      return;
    }

    if (this.mode() === 'add') {
      const newSuite = this.testSuiteService.addTestSuite(
        this.suiteName,
        this.suiteDescription
      );

      this.selectedTestCases().forEach(testCase => {
        this.testSuiteService.addTestCaseToSuite(newSuite.id, {
          testCaseId: testCase.testCaseId,
          moduleId: testCase.moduleId,
          version: testCase.version
        });
      });

      this.showAlertMessage('Test suite created successfully', 'success');
    } else if (this.mode() === 'edit') {
      const updated = this.testSuiteService.updateTestSuite(
        this.selectedSuiteId(),
        {
          name: this.suiteName,
          description: this.suiteDescription
        }
      );

      if (updated) {
        const existingSuite = this.testSuiteService.getTestSuiteById(this.selectedSuiteId());
        if (existingSuite) {
          existingSuite.testCases.forEach(tc => {
            this.testSuiteService.removeTestCaseFromSuite(this.selectedSuiteId(), tc.testCaseId);
          });
        }

        this.selectedTestCases().forEach(testCase => {
          this.testSuiteService.addTestCaseToSuite(this.selectedSuiteId(), {
            testCaseId: testCase.testCaseId,
            moduleId: testCase.moduleId,
            version: testCase.version
          });
        });

        this.showAlertMessage('Test suite updated successfully', 'success');
      }
    }

    this.loadTestSuites();
    setTimeout(() => this.cancelEdit(), 1000);
  }

  // Delete
  confirmDeleteSuite(suiteId: string): void {
    this.pendingDeleteId.set(suiteId);
    this.alertMessage.set('Are you sure you want to delete this test suite?');
    this.alertType.set('warning');
    this.isConfirmAlert.set(true);
    this.showAlert.set(true);
  }

  handleConfirmDelete(): void {
    const suiteId = this.pendingDeleteId();
    if (suiteId) {
      const success = this.testSuiteService.deleteTestSuite(suiteId);
      if (success) {
        this.showAlertMessage('Test suite deleted successfully', 'success');
        this.loadTestSuites();
      } else {
        this.showAlertMessage('Failed to delete test suite', 'error');
      }
    }
    this.pendingDeleteId.set(null);
    this.isConfirmAlert.set(false);
  }

  handleCancelDelete(): void {
    this.showAlert.set(false);
    this.isConfirmAlert.set(false);
    this.pendingDeleteId.set(null);
  }

  // Utility: show alert
  private showAlertMessage(message: string, type: 'success' | 'error' | 'warning'): void {
    this.alertMessage.set(message);
    this.alertType.set(type);
    this.showAlert.set(true);
    setTimeout(() => this.showAlert.set(false), 3000);
  }

  // Utility: get module name
  getModuleName(moduleId: string): string {
    const module = this.modules().find(m => m.id === moduleId);
    return module ? module.name : 'Unknown Module';
  }

}
