import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormArray, Validators, ReactiveFormsModule, FormsModule, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TestCaseService } from 'src/app/shared/services/test-case.service';
import { TestCase } from 'src/app/shared/modles/testcase.model';
import { AlertComponent } from "src/app/shared/alert/alert.component";
import { ChangeDetectorRef } from '@angular/core';
import { ProductModule } from 'src/app/shared/modles/module.model';

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
  productId = signal<string>('');
  modules = signal<ProductModule[]>([]);
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
    result: ['Pending' as 'Pass' | 'Fail' | 'Pending' | 'Blocked'],
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
        const versions = this.testCaseService.getVersionsByModule(moduleId);
if (versions) {
  const versionStrings = versions.map(v => v.version);
  this.versions.set(versionStrings);
}

      }
    });

    this.route.queryParamMap.subscribe(params => {
      const productId = params.get('productId');
      if (productId) {
        this.productId.set(productId);
        const modules = this.testCaseService.getModulesByProduct(productId);
        if (modules) {
          this.modules.set(modules);
        }
      } else {
        const allModules = this.testCaseService.getModules();
        if (allModules) {
          this.modules.set(allModules);
        }
      }
    });
  }

  ngOnInit(): void {
    this.printData();
  }

  get attributes(): FormArray {
    return this.form.get('attributes') as FormArray;
  }

 // In edit-testcases.component.ts
loadTestCases(moduleId: string): void {
  const module = this.testCaseService.getModules().find(m => m.id === moduleId);
  if (!module) {
    console.error(`Module ${moduleId} not found`);
    this.testCases.set([]);
    return;
  }

  // Get versions for the product that this module belongs to
  const versions = this.testCaseService.getVersionStringsByProduct(module.productId);
  this.versions.set(versions);

  const allTestCases = this.testCaseService.getTestCasesByModule(moduleId);
  this.testCases.set(allTestCases || []);
  this.applyFilters();
}

  getUniqueAttributeNames(): string[] {
    const attributeNames = new Set<string>();
    this.testCases().forEach(testCase => {
      testCase.attributes?.forEach(attr => {
        if (attr.key) {
          attributeNames.add(attr.key);
        }
      });
    });
    return Array.from(attributeNames);
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
    const filtered = this.testCases().filter(tc => 
      (!slNo || (tc.slNo && tc.slNo.toString().includes(slNo))) &&
      (!testCaseId || (tc.testCaseId && tc.testCaseId.toLowerCase().includes(testCaseId.toLowerCase()))) &&
      (!useCase || (tc.useCase && tc.useCase.toLowerCase().includes(useCase.toLowerCase()))) &&
      (!version || tc.version === version)
    );
    this.filteredTestCases.set(filtered);
  }

  getModuleName(moduleId: string): string {
    const module = this.modules().find(m => m.id === moduleId);
    return module?.name || 'Unknown Module';
  }

  getUniqueAttributes(): string[] {
    const allAttributes = new Set<string>();
    this.testCases().forEach(tc => {
      tc.attributes?.forEach(attr => {
        if (attr.key) {
          allAttributes.add(attr.key);
        }
      });
    });
    return Array.from(allAttributes);
  }

  getAttributeValue(testCase: TestCase, key: string): string {
    const attr = testCase.attributes?.find(a => a.key === key);
    return attr ? attr.value || '' : '';
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
  const latestVersion = this.versions().length > 0 
    ? this.versions()[this.versions().length - 1] 
    : 'v1.0';

  this.form.reset({
    moduleId: this.selectedModule(),
    version: latestVersion,  // Set to latest version by default
    result: 'Pending'
  });
  
  this.attributes.clear();
  this.isEditing.set(true);
}
  startEditing(testCase: TestCase): void {
    this.form.patchValue({
      id: testCase.id || '',
      moduleId: testCase.moduleId || '',
      version: testCase.version || 'v1.0',
      testCaseId: testCase.testCaseId || '',
      useCase: testCase.useCase || '',
      scenario: testCase.scenario || '',
      steps: testCase.steps || '',
      expected: testCase.expected || '',
      result: testCase.result || 'Pending',
      actual: testCase.actual || '',
      remarks: testCase.remarks || ''
    });

    this.attributes.clear();
    testCase.attributes?.forEach(attr => {
      if (attr.key && attr.value) {
        this.addAttribute(attr.key, attr.value);
      }
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
        : Math.max(0, ...this.testCases().map(tc => tc.slNo || 0)) + 1,
      attributes: this.attributes.value || [],
      uploads: []
    };

    if (formValue.id) {
      this.testCaseService.updateTestCase(testCase);
      this.showAlertMessage('Test case updated successfully!', 'success');
    } else {
      this.testCaseService.addTestCase(testCase);
      this.showAlertMessage('Test case added successfully!', 'success');
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
      this.showAlertMessage('Test case deleted successfully!', 'success');
    }
  }

  handleCancelDelete(): void {
    this.showAlert = false;
    this.isConfirmAlert = false;
    this.pendingDeleteId = null;
    this.cdr.detectChanges(); 
  }

  goBack(): void {
    const queryParams = this.productId() ? { productId: this.productId() } : undefined;
    this.router.navigate(['/tester/add-testcases'], { queryParams });
  }

  private showAlertMessage(message: string, type: 'success' | 'error' | 'warning'): void {
    this.alertMessage = message;
    this.alertType = type;
    this.showAlert = true;
    this.isConfirmAlert = false;
    
    setTimeout(() => {
      this.showAlert = false;
      this.cdr.detectChanges();
    }, 3000);
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach(arrayControl => {
          if (arrayControl instanceof FormGroup) {
            this.markFormGroupTouched(arrayControl);
          }
        });
      }
    });
  }

  printData(): void {
    console.log('All modules:', this.testCaseService.getModules());
    console.log('All test cases in service:', this.testCaseService.getTestCases());
    const mod1TestCases = this.testCaseService.getTestCases()?.filter(tc => tc.moduleId === 'mod1');
    console.log('Test cases for mod1:', mod1TestCases);
  }
}