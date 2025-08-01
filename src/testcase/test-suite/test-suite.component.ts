import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TestSuiteService } from 'src/app/shared/services/test-suite.service';
import { TestCaseService } from 'src/app/shared/services/test-case.service';
import { TestSuite } from 'src/app/shared/modles/test-suite.model';
import { TestCase } from 'src/app/shared/data/dummy-testcases';
import { AlertComponent } from 'src/app/shared/alert/alert.component';
import { ActivatedRoute } from '@angular/router';
import { ProductModule } from 'src/app/shared/modles/module.model';

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
  private route = inject(ActivatedRoute);

  // Form-bound fields
  suiteName: string = '';
  suiteDescription: string = '';
  selectedModuleId: string = '';

  // Signals for state
  mode = signal<'list' | 'add' | 'edit'>('list');
  selectedSuiteId = signal<string>('');
  selectedTestCases = signal<TestCase[]>([]);
  testSuites = signal<TestSuite[]>([]);
  currentProductId = signal<string>('1'); // Default to product '1'
  modules = signal<ProductModule[]>([]);
  availableTestCases = signal<TestCase[]>([]);

  // Alert system
  showAlert = signal(false);
  alertMessage = signal('');
  alertType = signal<'success' | 'error' | 'warning'>('success');
  isConfirmAlert = signal(false);
  pendingDeleteId = signal<string | null>(null);

  constructor() {
    this.route.queryParamMap.subscribe(params => {
      const productId = params.get('productId');
      if (productId) {
        this.currentProductId.set(productId);
        this.loadModulesForCurrentProduct();
      }
    });

    this.loadTestSuites();
    this.loadModulesForCurrentProduct();
  }

  // Load all test suites
  private loadTestSuites(): void {
    this.testSuites.set(this.testSuiteService.getTestSuites());
  }

  // Load modules for current product
  private loadModulesForCurrentProduct(): void {
    this.modules.set(this.testCaseService.getModulesByProduct(this.currentProductId()));
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
      
      // Load test cases for the suite
      const suiteTestCases = this.testSuiteService.getTestCasesForSuite(suiteId);
      this.selectedTestCases.set(suiteTestCases);
      
      // If there are test cases, set the product context based on the first test case's module
      if (suiteTestCases.length > 0) {
        const firstTestCase = suiteTestCases[0];
        const module = this.testCaseService.getModules().find(m => m.id === firstTestCase.moduleId);
        if (module) {
          this.currentProductId.set(module.productId);
          this.loadModulesForCurrentProduct();
        }
      }
      
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
    this.selectedModuleId = moduleId;
    this.availableTestCases.set(
      this.testCaseService.getTestCases().filter(tc => tc.moduleId === moduleId)
    );
  }

  // Toggle checkbox
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
        const suiteId = this.selectedSuiteId();
        
        if (suiteId !== undefined) {
          const existingSuite = this.testSuiteService.getTestSuiteById(suiteId);
          
          if (existingSuite) {
            existingSuite.testCases.forEach(tc => {
              if (tc.testCaseId) {
                this.testSuiteService.removeTestCaseFromSuite(suiteId, tc.testCaseId);
              }
            });
          }
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