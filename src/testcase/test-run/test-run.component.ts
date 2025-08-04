import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TestRunService } from 'src/app/shared/services/test-run.service';
import { TestSuiteService } from 'src/app/shared/services/test-suite.service';
import { TestRun } from 'src/app/shared/modles/test-run.model';
import { TestSuite } from 'src/app/shared/modles/test-suite.model';
import { AlertComponent } from 'src/app/shared/alert/alert.component';

@Component({
  selector: 'app-test-run',
  standalone: true,
  imports: [CommonModule, FormsModule, AlertComponent],
  templateUrl: './test-run.component.html',
  styleUrls: ['./test-run.component.css']
})
export class TestRunComponent {
  // Inject services
  private testRunService = inject(TestRunService);
  private testSuiteService = inject(TestSuiteService);

  // Form-bound fields
  runName: string = '';
  runDescription: string = '';

  // Signals for state
  mode = signal<'list' | 'add' | 'edit'>('list');
  selectedRunId = signal<string>('');
  selectedSuiteIds = signal<string[]>([]);
  testRuns = signal<TestRun[]>([]);
  testSuites = signal<TestSuite[]>([]);

  // Alert system
  showAlert = signal(false);
  alertMessage = signal('');
  alertType = signal<'success' | 'error' | 'warning'>('success');
  isConfirmAlert = signal(false);
  pendingDeleteId = signal<string | null>(null);
  filteredTestSuites = signal<TestSuite[]>([]);
suiteSearchTerm = signal<string>('');

  constructor() {
    this.loadTestRuns();
    this.loadTestSuites();
    this.filteredTestSuites.set(this.testSuites());
  }

  filterTestSuites(): void {
  const searchTerm = this.suiteSearchTerm().toLowerCase();
  if (!searchTerm) {
    this.filteredTestSuites.set(this.testSuites());
    return;
  }
  
  this.filteredTestSuites.set(
    this.testSuites().filter(suite => 
      suite.name.toLowerCase().includes(searchTerm) ||
      (suite.description && suite.description.toLowerCase().includes(searchTerm))
    )
  );
}

  // Load all test runs
  private loadTestRuns(): void {
    this.testRuns.set(this.testRunService.getTestRuns());
  }

  // Load all test suites
  private loadTestSuites(): void {
    this.testSuites.set(this.testSuiteService.getTestSuites());
  }

  // Start add
  startAddNewRun(): void {
    this.mode.set('add');
    this.runName = '';
    this.runDescription = '';
    this.selectedSuiteIds.set([]);
  }

  // Start edit
  startEditRun(runId: string): void {
    const run = this.testRunService.getTestRunById(runId);
    if (run) {
      this.mode.set('edit');
      this.selectedRunId.set(runId);
      this.runName = run.name;
      this.runDescription = run.description || '';
      this.selectedSuiteIds.set(run.testSuites.map(suite => suite.id));
    }
  }

  // Cancel
  cancelEdit(): void {
    this.mode.set('list');
    this.selectedRunId.set('');
    this.selectedSuiteIds.set([]);
  }

    handleCheckboxChange(suiteId: string, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.toggleSuiteSelection(suiteId, checkbox.checked);
  }

  // Toggle test suite selection
   toggleSuiteSelection(suiteId: string, isChecked: boolean | null): void {
    if (isChecked === null || isChecked === undefined) return;
    
    this.selectedSuiteIds.update(current => {
      if (isChecked) {
        // Add if not already present
        return current.includes(suiteId) ? current : [...current, suiteId];
      } else {
        // Remove if present
        return current.filter(id => id !== suiteId);
      }
    });
  }

  // For checkbox checked status
  isSuiteSelected(suiteId: string): boolean {
    return this.selectedSuiteIds().includes(suiteId);
  }

  // Save test run (create or update)
  saveTestRun(): void {
    if (!this.runName.trim()) {
      this.showAlertMessage('Test run name is required', 'error');
      return;
    }

    const selectedSuites = this.testSuites().filter(suite => 
      this.selectedSuiteIds().includes(suite.id)
    );

    if (this.mode() === 'add') {
      const newRun = this.testRunService.addTestRun(
        this.runName,
        this.runDescription,
        selectedSuites
      );
      this.showAlertMessage('Test run created successfully', 'success');
    } else if (this.mode() === 'edit') {
      const updated = this.testRunService.updateTestRun(
        this.selectedRunId(),
        {
          name: this.runName,
          description: this.runDescription,
          testSuites: selectedSuites
        }
      );

      if (updated) {
        this.showAlertMessage('Test run updated successfully', 'success');
      }
    }

    this.loadTestRuns();
    setTimeout(() => this.cancelEdit(), 1000);
  }

  // Delete
  confirmDeleteRun(runId: string): void {
    this.pendingDeleteId.set(runId);
    this.alertMessage.set('Are you sure you want to delete this test run?');
    this.alertType.set('warning');
    this.isConfirmAlert.set(true);
    this.showAlert.set(true);
  }

  handleConfirmDelete(): void {
    const runId = this.pendingDeleteId();
    if (runId) {
      const success = this.testRunService.deleteTestRun(runId);
      if (success) {
        this.showAlertMessage('Test run deleted successfully', 'success');
        this.loadTestRuns();
      } else {
        this.showAlertMessage('Failed to delete test run', 'error');
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

  // Format date for display
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}