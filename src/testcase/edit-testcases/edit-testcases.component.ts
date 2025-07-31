import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormArray, Validators, ReactiveFormsModule, FormsModule, FormGroup, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TestCaseService } from 'src/app/shared/services/test-case.service';
import { TestCase } from 'src/app/shared/data/dummy-testcases';
import { AlertComponent } from "src/app/shared/alert/alert.component";
import { ChangeDetectorRef } from '@angular/core';

interface TestCaseFilter {
  slNo: string;
  testCaseId: string;
  useCase: string;
  version: string;
}

@Component({
  selector: 'app-edit-testcases',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, AlertComponent],
  templateUrl: './edit-testcases.component.html',
  styleUrls: ['./edit-testcases.component.css']
})
export class EditTestcasesComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private testCaseService = inject(TestCaseService);
  private cdr = inject(ChangeDetectorRef);

  selectedModule = signal<string>('');
  isEditing = signal(false);
  testCases = signal<TestCase[]>([]);
  filteredTestCases = signal<TestCase[]>([]);
  versions = signal<string[]>([]);
  filter = signal<TestCaseFilter>({
    slNo: '',
    testCaseId: '',
    useCase: '',
    version: ''
  });
  showAlert = false;
  alertMessage = '';
  alertType: 'success' | 'error' | 'warning' = 'warning';
  isConfirmAlert = false;
  pendingDeleteId: string | null = null;

  form = this.fb.group({
    id: [''],
    moduleId: ['', Validators.required],
    version: ['v1.0', Validators.required],
    testCaseId: ['', [Validators.required, Validators.pattern(/^TC\d+/)]],
    useCase: ['', Validators.required],
    scenario: ['', Validators.required],
    steps: ['', Validators.required],
    expected: ['', Validators.required],
    result: ['Pending'],
    actual: [''],
    remarks: [''],
    attributes: this.fb.array([])
  });

  constructor() {
    this.route.paramMap.subscribe(params => {
      const moduleId = params.get('moduleId');
      if (moduleId) {
        this.selectedModule.set(moduleId);
        this.form.patchValue({
          moduleId: moduleId
        });
        this.loadTestCases(moduleId);
        this.versions.set(this.testCaseService.getVersionsByModule(moduleId));
      }
    });
  }

  get attributes(): FormArray {
    return this.form.get('attributes') as FormArray;
  }

  private loadTestCases(moduleId: string): void {
    const allVersions = this.testCaseService.getVersionsByModule(moduleId);
    let allTestCases: TestCase[] = [];
    
    allVersions.forEach(version => {
      const versionTestCases = this.testCaseService.getTestCasesByModuleAndVersion(moduleId, version);
      allTestCases = [...allTestCases, ...versionTestCases];
    });

    this.testCases.set(allTestCases);
    this.applyFilters();
  }

  updateFilter<K extends keyof TestCaseFilter>(key: K, value: string): void {
    this.filter.update(current => ({
      ...current,
      [key]: value
    }));
    this.applyFilters();
  }

  private applyFilters(): void {
    const { slNo, testCaseId, useCase, version } = this.filter();
    this.filteredTestCases.set(
      this.testCases().filter(tc => 
        (!slNo || tc.slNo.toString().includes(slNo)) &&
        (!testCaseId || tc.testCaseId.toLowerCase().includes(testCaseId.toLowerCase())) &&
        (!useCase || tc.useCase.toLowerCase().includes(useCase.toLowerCase())) &&
        (!version || tc.version === version)
      )
    );
  }

  getModuleName(moduleId: string): string {
    return this.testCaseService.getModules().find(m => m.id === moduleId)?.name || '';
  }

  getUniqueAttributes(): string[] {
    const allAttributes = new Set<string>();
    this.testCases().forEach(tc => {
      tc.attributes.forEach(attr => {
        allAttributes.add(attr.key);
      });
    });
    return Array.from(allAttributes);
  }

  getAttributeValue(testCase: TestCase, key: string): string {
    const attr = testCase.attributes.find(a => a.key === key);
    return attr ? attr.value : '';
  }

  addAttribute(key = '', value = ''): void {
    this.attributes.push(
      this.fb.group({
        key: [key, Validators.required],
        value: [value, Validators.required]
      })
    );
  }

  removeAttribute(index: number): void {
    this.attributes.removeAt(index);
  }

  openForm(): void {
    this.form.reset({
      moduleId: this.selectedModule(),
      version: 'v1.0',
      result: 'Pending'
    });
    this.attributes.clear();
    this.isEditing.set(true);
  }

  startEditing(testCase: TestCase): void {
    this.form.patchValue({
      id: testCase.id,
      moduleId: testCase.moduleId,
      version: testCase.version,
      testCaseId: testCase.testCaseId,
      useCase: testCase.useCase,
      scenario: testCase.scenario,
      steps: testCase.steps,
      expected: testCase.expected,
      result: testCase.result || 'Pending',
      actual: testCase.actual || '',
      remarks: testCase.remarks || ''
    });

    this.attributes.clear();
    testCase.attributes.forEach(attr => {
      this.addAttribute(attr.key, attr.value);
    });

    this.isEditing.set(true);
  }

  cancelEditing(): void {
    this.form.reset();
    this.attributes.clear();
    this.isEditing.set(false);
  }

  saveTestCase(): void {
    if (this.form.invalid) {
      this.markFormGroupTouched(this.form);
      return;
    }

    const formValue = this.form.value;
    const testCase: TestCase = {
      id: formValue.id || Date.now().toString(),
      moduleId: this.selectedModule(),
      version: formValue.version || 'v1.0',
      testCaseId: formValue.testCaseId || '',
      useCase: formValue.useCase || '',
      scenario: formValue.scenario || '',
      steps: formValue.steps || '',
      expected: formValue.expected || '',
      result: formValue.result as 'Pass' | 'Fail' | 'Pending' | 'Blocked' || 'Pending',
      actual: formValue.actual || '',
      remarks: formValue.remarks || '',
      slNo: formValue.id 
        ? this.testCases().find(tc => tc.id === formValue.id)?.slNo || 0
        : Math.max(0, ...this.testCases().map(tc => tc.slNo)) + 1,
      attributes: this.attributes.value || [],
      uploads: []
    };

    if (formValue.id) {
      this.testCaseService.updateTestCase(testCase);
    } else {
      this.testCaseService.addTestCase(testCase);
    }

    this.loadTestCases(this.selectedModule());
    this.cancelEditing();
  }

  deleteTestCase(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.alertMessage = 'Are you sure you want to delete this test case?';
    this.alertType = 'warning';
    this.isConfirmAlert = true;
    this.showAlert = true;
    this.pendingDeleteId = id;
    this.cdr.detectChanges();
  }

  handleConfirmDelete(): void {
    if (this.pendingDeleteId) {
      this.testCaseService.deleteTestCase(this.pendingDeleteId);
      this.loadTestCases(this.selectedModule());
      this.pendingDeleteId = null;

      this.alertMessage = 'Test case deleted successfully.';
      this.alertType = 'success';
      this.isConfirmAlert = false;
      this.showAlert = true;

      this.cdr.detectChanges(); 
      setTimeout(() => {
        this.showAlert = false;
        this.cdr.detectChanges();
      }, 2500);
    }
  }

  handleCancelDelete(): void {
    this.showAlert = false;
    this.isConfirmAlert = false;
    this.pendingDeleteId = null;
    this.cdr.detectChanges(); 
  }

  goBack(): void {
    this.router.navigate(['/tester/add-testcases']);
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach(arrayControl => {
          this.markFormGroupTouched(arrayControl as FormGroup);
        });
      }
    });
  }
}