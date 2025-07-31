import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { TestCaseService } from 'src/app/shared/services/test-case.service';
import { TestRunService } from 'src/app/shared/services/test-run.service';
import { TestSuiteService } from 'src/app/shared/services/test-suite.service';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './results.component.html',
  styleUrls: ['./results.component.css']
})
export class ResultsComponent {
  private testCaseService = inject(TestCaseService);
  public testRunService = inject(TestRunService);
  private testSuiteService = inject(TestSuiteService);

  selectedModule = signal<string>('');
  filterStatus = signal<'All' | 'Pass' | 'Fail' | 'Pending'>('All');
  modules = this.testCaseService.getModules();
  
  // Test Run Results related signals
  showTestRunResults = signal(false);
  selectedTestRunId = signal<string>('');
  testRuns = this.testRunService.getTestRuns();
  selectedSuiteId = signal<string>('');
  expandedSuites = signal<Set<string>>(new Set());

  testCases = computed(() => 
    this.selectedModule()
      ? this.testCaseService.getTestCases()
          .filter(tc => tc.moduleId === this.selectedModule())
      : []
  );

  filteredTestCases = computed(() => {
    const status = this.filterStatus();
    return this.testCases().filter(tc => 
      status === 'All' ? true : tc.result === status
    );
  });

  stats = computed(() => {
    const cases = this.testCases();
    return {
      total: cases.length,
      pass: cases.filter(tc => tc.result === 'Pass').length,
      fail: cases.filter(tc => tc.result === 'Fail').length,
      pending: cases.filter(tc => !tc.result || tc.result === 'Pending').length
    };
  });

  // Test Run statistics
  testRunStats = computed(() => {
    if (!this.selectedTestRunId()) return null;
    
    const testRun = this.testRunService.getTestRunById(this.selectedTestRunId());
    if (!testRun) return null;
    
    let totalCases = 0;
    let passedCases = 0;
    let failedCases = 0;
    let pendingCases = 0;
    
    const suiteStats = testRun.testSuites.map(suite => {
      const suiteCases = this.testRunService.getTestCasesForSuite(suite.id);
      const suiteTotal = suiteCases.length;
      const suitePassed = suiteCases.filter(tc => tc.result === 'Pass').length;
      const suiteFailed = suiteCases.filter(tc => tc.result === 'Fail').length;
      const suitePending = suiteTotal - suitePassed - suiteFailed;
      
      totalCases += suiteTotal;
      passedCases += suitePassed;
      failedCases += suiteFailed;
      pendingCases += suitePending;
      
      return {
        suiteId: suite.id,
        suiteName: suite.name,
        total: suiteTotal,
        passed: suitePassed,
        failed: suiteFailed,
        pending: suitePending,
        completion: suiteTotal > 0 ? Math.round((suitePassed / suiteTotal) * 100) : 0
      };
    });
    
    return {
      runName: testRun.name,
      total: totalCases,
      passed: passedCases,
      failed: failedCases,
      pending: pendingCases,
      completion: totalCases > 0 ? Math.round((passedCases / totalCases) * 100) : 0,
      suiteStats: suiteStats,
      metadata: {
        description: testRun.description,
        createdBy: testRun.createdBy,
        createdAt: testRun.createdAt.toLocaleDateString(),
        updatedAt: testRun.updatedAt.toLocaleDateString(),
        status: testRun.status
      }
    };
  });

  // Get test cases for selected suite in test run
  suiteTestCases = computed(() => {
    if (!this.selectedSuiteId()) return [];
    return this.testRunService.getTestCasesForSuite(this.selectedSuiteId());
  });

  exportResults(): void {
    const module = this.modules.find(m => m.id === this.selectedModule());
    if (!module) return;

    const data = this.filteredTestCases().map(tc => ({
      'Sl.No': tc.slNo,
      'Test Case ID': tc.testCaseId,
      'Use Case': tc.useCase,
      'Scenario': tc.scenario,
      'Steps': tc.steps,
      'Expected': tc.expected,
      'Result': tc.result,
      'Actual': tc.actual || '',
      'Remarks': tc.remarks || '',
      ...tc.attributes.reduce((acc, attr) => {
        acc[attr.key] = attr.value;
        return acc;
      }, {} as Record<string, string>)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Test Results');
    XLSX.writeFile(wb, `${module.name}_Test_Results.xlsx`);
  }

  getModuleName(moduleId: string): string {
    const module = this.modules.find(m => m.id === moduleId);
    return module ? module.name : 'Unknown Module';
  }

  copyTestCaseLink(testCaseId: string): void {
    const baseUrl = window.location.origin;
    const copyUrl = `${baseUrl}/tester/view-testcase/${testCaseId}`;
    
    navigator.clipboard.writeText(copyUrl).then(() => {
      alert('Test case link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }

  getSelectedSuiteName(): string {
    const stats = this.testRunStats();
    if (!stats) return '';
    const suite = stats.suiteStats.find(s => s.suiteId === this.selectedSuiteId());
    return suite ? suite.suiteName : '';
  }

  toggleSuiteExpansion(suiteId: string): void {
    const expanded = this.expandedSuites();
    if (expanded.has(suiteId)) {
      expanded.delete(suiteId);
    } else {
      expanded.add(suiteId);
    }
    this.expandedSuites.set(new Set(expanded));
  }

  isSuiteExpanded(suiteId: string): boolean {
    return this.expandedSuites().has(suiteId);
  }

 exportAllTestSuites(): void {
  const stats = this.testRunStats();
  if (!stats) return;
  
  const wb = XLSX.utils.book_new();
  
  // Summary sheet
  const summaryData = [
    ['Test Run Name', stats.runName],
    ['Description', stats.metadata.description],
    ['Created By', stats.metadata.createdBy],
    ['Created At', stats.metadata.createdAt],
    ['Updated At', stats.metadata.updatedAt],
    ['Status', stats.metadata.status],
    [],
    ['Total Test Cases', stats.total],
    ['Passed', stats.passed],
    ['Failed', stats.failed],
    ['Pending', stats.pending],
    ['Completion %', stats.completion]
  ];
  
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // Add sheets for each suite
  stats.suiteStats.forEach(suite => {
    const suiteCases = this.testRunService.getTestCasesForSuite(suite.suiteId);
    
    const suiteData = suiteCases.map(testCase => ({
      'Sl.No': testCase.slNo,
      'Test Case ID': testCase.testCaseId,
      'Use Case': testCase.useCase,
      'Scenario': testCase.scenario,
      'Steps': testCase.steps,
      'Expected': testCase.expected,
      'Result': testCase.result || 'Pending',
      'Actual': testCase.actual || '',
      'Remarks': testCase.remarks || ''
    }));

    const suiteWs = XLSX.utils.json_to_sheet(suiteData);
    XLSX.utils.book_append_sheet(wb, suiteWs, suite.suiteName.substring(0, 31));
  });

  XLSX.writeFile(wb, `${stats.runName}_All_Test_Suites.xlsx`);
}

exportSingleSuite(suiteId: string): void {
  const stats = this.testRunStats();
  if (!stats) return;
  
  const suite = stats.suiteStats.find(s => s.suiteId === suiteId);
  if (!suite) return;
  
  const suiteCases = this.testRunService.getTestCasesForSuite(suiteId);
  
  if (suiteCases.length === 0) {
    alert('No test cases found in this suite');
    return;
  }
  
  const data = suiteCases.map(testCase => ({
    'Sl.No': testCase.slNo,
    'Test Case ID': testCase.testCaseId,
    'Use Case': testCase.useCase,
    'Scenario': testCase.scenario,
    'Steps': testCase.steps,
    'Expected': testCase.expected,
    'Result': testCase.result || 'Pending',
    'Actual': testCase.actual || '',
    'Remarks': testCase.remarks || ''
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, suite.suiteName.substring(0, 31));
  XLSX.writeFile(wb, `${suite.suiteName}_Test_Cases.xlsx`);
}

}