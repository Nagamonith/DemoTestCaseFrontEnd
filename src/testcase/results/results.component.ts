import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { TestCaseService } from 'src/app/shared/services/test-case.service';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './results.component.html',
  styleUrls: ['./results.component.css']
})
export class ResultsComponent {
  private testCaseService = inject(TestCaseService);

  selectedModule = signal<string>('');
  filterStatus = signal<'All' | 'Pass' | 'Fail' | 'Pending'>('All');
  modules = this.testCaseService.getModules();

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
}