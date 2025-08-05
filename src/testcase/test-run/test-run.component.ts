import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TestRunService } from 'src/app/shared/services/test-run.service';
import { TestSuiteService } from 'src/app/shared/services/test-suite.service';
import { TestRun } from 'src/app/shared/modles/test-run.model';
import { TestSuite } from 'src/app/shared/modles/test-suite.model';
import { AlertComponent } from 'src/app/shared/alert/alert.component';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-test-run',
  standalone: true,
  imports: [CommonModule, FormsModule, AlertComponent],
  templateUrl: './test-run.component.html',
  styleUrls: ['./test-run.component.css']
})
export class TestRunComponent {
  private testRunService = inject(TestRunService);
  private testSuiteService = inject(TestSuiteService);
  private route = inject(ActivatedRoute);

  runName: string = '';
  runDescription: string = '';

  mode = signal<'list' | 'add' | 'edit'>('list');
  selectedRunId = signal<string>('');
  selectedSuiteIds = signal<string[]>([]);
  testRuns = signal<TestRun[]>([]);
  testSuites = signal<TestSuite[]>([]);
  currentProductId = signal<string>('');

  showAlert = signal(false);
  alertMessage = signal('');
  alertType = signal<'success' | 'error' | 'warning'>('success');
  isConfirmAlert = signal(false);
  pendingDeleteId = signal<string | null>(null);
  filteredTestSuites = signal<TestSuite[]>([]);
  suiteSearchTerm = signal<string>('');

  constructor() {
    this.route.queryParamMap.subscribe(params => {
      const productId = params.get('productId');
      if (productId) {
        this.currentProductId.set(productId);
        this.loadTestRuns();
        this.loadTestSuites();
      }
    });
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

  private loadTestRuns(): void {
    if (this.currentProductId()) {
      this.testRuns.set(this.testRunService.getTestRuns(this.currentProductId()));
    }
  }

  private loadTestSuites(): void {
    if (this.currentProductId()) {
      this.testSuites.set(this.testSuiteService.getTestSuites(this.currentProductId()));
      this.filteredTestSuites.set(this.testSuites());
    }
  }

  startAddNewRun(): void {
    this.mode.set('add');
    this.runName = '';
    this.runDescription = '';
    this.selectedSuiteIds.set([]);
  }

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

  cancelEdit(): void {
    this.mode.set('list');
    this.selectedRunId.set('');
    this.selectedSuiteIds.set([]);
  }

  handleCheckboxChange(suiteId: string, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.toggleSuiteSelection(suiteId, checkbox.checked);
  }

  toggleSuiteSelection(suiteId: string, isChecked: boolean | null): void {
    if (isChecked === null || isChecked === undefined) return;
    
    this.selectedSuiteIds.update(current => {
      if (isChecked) {
        return current.includes(suiteId) ? current : [...current, suiteId];
      } else {
        return current.filter(id => id !== suiteId);
      }
    });
  }

  isSuiteSelected(suiteId: string): boolean {
    return this.selectedSuiteIds().includes(suiteId);
  }

  saveTestRun(): void {
    if (!this.runName.trim()) {
      this.showAlertMessage('Test run name is required', 'error');
      return;
    }

    if (!this.currentProductId()) {
      this.showAlertMessage('Product ID is required', 'error');
      return;
    }

    const selectedSuites = this.testSuites().filter(suite => 
      this.selectedSuiteIds().includes(suite.id)
    );

    if (selectedSuites.length === 0) {
      this.showAlertMessage('At least one test suite must be selected', 'error');
      return;
    }

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

  private showAlertMessage(message: string, type: 'success' | 'error' | 'warning'): void {
    this.alertMessage.set(message);
    this.alertType.set(type);
    this.showAlert.set(true);
    setTimeout(() => this.showAlert.set(false), 3000);
  }

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