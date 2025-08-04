import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import * as XLSX from 'xlsx';
import { TestCaseService } from 'src/app/shared/services/test-case.service';
import { ProductModule } from 'src/app/shared/modles/module.model';

@Component({
  selector: 'app-add-testcases',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './add-testcases.component.html',
  styleUrls: ['./add-testcases.component.css']
})
export class AddTestcasesComponent implements OnInit {
  private testCaseService = inject(TestCaseService);
  private route = inject(ActivatedRoute);

  selectedModule = signal<string | null>(null);
  selectedVersion = signal<string | null>(null);
  showAddModuleForm = false;
  showAddVersionForm = false;
  newModuleName = '';
  newVersionName = 'v1.0';
  productId = signal<string | null>(null);

  modules = signal<ProductModule[]>([]);
  versions = computed(() =>
    this.selectedModule()
      ? this.testCaseService.getVersionsByModule(this.selectedModule()!)
      : []
  );

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      this.productId.set(params.get('productId'));
      this.loadModules();
    });
  }

  loadModules() {
    const productId = this.productId();
    if (productId) {
      this.modules.set(this.testCaseService.getModulesByProduct(productId));
    } else {
      this.modules.set(this.testCaseService.getModules());
    }
    console.log('Loaded modules:', this.modules()); // Debug log
  }

  

  onModuleChange(moduleId: string): void {
    this.selectedModule.set(moduleId);
    this.selectedVersion.set(null);
    this.resetForms();
  }

  onVersionChange(version: string): void {
    this.selectedVersion.set(version);
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

  // Check if version exists by string comparison
  const versionStrings = this.testCaseService.getVersionStringsByProduct(
    this.modules().find(m => m.id === this.selectedModule())?.productId || ''
  );

  if (versionStrings.includes(this.newVersionName)) {
    alert('Version already exists');
    return;
  }

  // Add the version and get the created ProductVersion
  const productVersion = this.testCaseService.addVersionToProduct(
    this.modules().find(m => m.id === this.selectedModule())?.productId || '',
    this.newVersionName
  );

  // Add initial test case for the new version
  this.testCaseService.addVersion(this.selectedModule()!, productVersion.version);
  
  this.selectedVersion.set(productVersion.version);
  this.resetForms();
}
 exportToExcel(): void {
  if (!this.selectedModule()) {
    alert('Please select a module first');
    return;
  }

  const module = this.modules().find(m => m.id === this.selectedModule());
  if (!module) return;

  const wb = XLSX.utils.book_new();
  
  // Get version strings, not ProductVersion objects
  const versionStrings = this.testCaseService.getVersionStringsByProduct(module.productId);

  versionStrings.forEach(version => {
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