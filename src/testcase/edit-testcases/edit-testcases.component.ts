import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormArray, Validators, ReactiveFormsModule, FormsModule, FormGroup, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TestCaseService } from 'src/app/shared/services/test-case.service';
import { TestCase } from 'src/app/shared/data/dummy-testcases';

interface TestCaseFilter {
  slNo: string;
  testCaseId: string;
  useCase: string;
}

@Component({
  selector: 'app-edit-testcases',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './edit-testcases.component.html',
  styleUrls: ['./edit-testcases.component.css']
})
export class EditTestcasesComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private testCaseService = inject(TestCaseService);

  selectedModule = signal<string>('');
  selectedVersion = signal<string>('');
  isEditing = signal(false);
  testCases = signal<TestCase[]>([]);
  filteredTestCases = signal<TestCase[]>([]);
  filter = signal<TestCaseFilter>({
    slNo: '',
    testCaseId: '',
    useCase: ''
  });

  form = this.fb.group({
    id: [''],
    moduleId: ['', Validators.required],
    version: ['', Validators.required],
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
      const version = params.get('version');

      if (moduleId && version) {
        this.selectedModule.set(moduleId);
        this.selectedVersion.set(version);
        this.form.patchValue({
          moduleId: moduleId,
          version: version
        });
        this.loadTestCases(moduleId, version);
      }
    });
  }

  get attributes(): FormArray {
    return this.form.get('attributes') as FormArray;
  }

  private loadTestCases(moduleId: string, version: string): void {
    const testCases = this.testCaseService.getTestCasesByModuleAndVersion(moduleId, version);
    this.testCases.set(testCases);
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
    const { slNo, testCaseId, useCase } = this.filter();
    this.filteredTestCases.set(
      this.testCases().filter(tc => 
        (!slNo || tc.slNo.toString().includes(slNo)) &&
        (!testCaseId || tc.testCaseId.toLowerCase().includes(testCaseId.toLowerCase())) &&
        (!useCase || tc.useCase.toLowerCase().includes(useCase.toLowerCase()))
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
      version: this.selectedVersion(),
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
      version: this.selectedVersion(),
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

    this.loadTestCases(this.selectedModule(), this.selectedVersion());
    this.cancelEditing();
  }

  deleteTestCase(id: string): void {
    if (confirm('Are you sure you want to delete this test case?')) {
      this.testCaseService.deleteTestCase(id);
      this.loadTestCases(this.selectedModule(), this.selectedVersion());
    }
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