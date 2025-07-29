import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import * as XLSX from 'xlsx';
import { TestCaseService } from 'src/app/shared/services/test-case.service';

@Component({
  selector: 'app-add-testcases',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './add-testcases.component.html',
  styleUrls: ['./add-testcases.component.css']
})
export class AddTestcasesComponent {
  private testCaseService = inject(TestCaseService);

  selectedModule = signal<string | null>(null);
  selectedVersion = signal<string | null>(null);
  showAddModuleForm = false;
  showAddVersionForm = false;
  newModuleName = '';
  newVersionName = 'v1.0';

  modules = this.testCaseService.getModules();
  versions = computed(() => 
    this.selectedModule() 
      ? this.testCaseService.getVersionsByModule(this.selectedModule()!) 
      : []
  );

  onModuleChange(moduleId: string): void {
    this.selectedModule.set(moduleId);
    this.selectedVersion.set(null);
    this.resetForms();
  }

  onVersionChange(version: string): void {
    this.selectedVersion.set(version);
    this.resetForms();
  }

  addNewModule(): void {
    if (!this.newModuleName.trim()) {
      alert('Module name is required');
      return;
    }

    const newId = this.testCaseService.addModule(this.newModuleName.trim());
    this.selectedModule.set(newId);
    this.resetForms();
  }

  addNewVersion(): void {
    if (!this.newVersionName.trim()) {
      alert('Version name is required');
      return;
    }

    if (!this.selectedModule()) {
      alert('Please select a module first');
      return;
    }

    if (this.versions().includes(this.newVersionName)) {
      alert('Version already exists');
      return;
    }

    this.testCaseService.addVersion(this.selectedModule()!, this.newVersionName);
    this.selectedVersion.set(this.newVersionName);
    this.resetForms();
  }

  exportToExcel(): void {
    if (!this.selectedModule()) {
      alert('Please select a module first');
      return;
    }

    const module = this.modules.find(m => m.id === this.selectedModule());
    if (!module) return;

    const wb = XLSX.utils.book_new();
    const versions = this.versions();

    versions.forEach(version => {
      const testCases = this.testCaseService
        .getTestCasesByModuleAndVersion(this.selectedModule()!, version)
        .map(tc => ({
          'Sl.No': tc.slNo,
          'Test Case ID': tc.testCaseId,
          'Use Case': tc.useCase,
          'Scenario': tc.scenario,
          'Steps': tc.steps,
          'Expected': tc.expected,
          ...tc.attributes.reduce((acc, attr) => {
            acc[attr.key] = attr.value;
            return acc;
          }, {} as Record<string, string>)
        }));

      if (testCases.length > 0) {
        const ws = XLSX.utils.json_to_sheet(testCases);
        XLSX.utils.book_append_sheet(wb, ws, version);
      }
    });

    XLSX.writeFile(wb, `${module.name.replace(/\s+/g, '_')}_Test_Cases.xlsx`);
  }

  private resetForms(): void {
    this.showAddModuleForm = false;
    this.showAddVersionForm = false;
    this.newModuleName = '';
    this.newVersionName = 'v1.0';
  }
}