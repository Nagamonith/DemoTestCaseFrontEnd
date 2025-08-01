import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormArray, Validators, ReactiveFormsModule, FormsModule, FormGroup, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TestCaseService } from 'src/app/shared/services/test-case.service';
import { TestCase } from 'src/app/shared/data/dummy-testcases';
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

    this.route.queryParamMap.subscribe(params => {
      const productId = params.get('productId');
      if (productId) {
        this.productId.set(productId);
        this.modules.set(this.testCaseService.getModulesByProduct(productId));
      } else {
        this.modules.set(this.testCaseService.getModules());
      }
    });
  }
ngOnInit() {
  console.log('All modules:', this.testCaseService.getModules());
  console.log('All test cases:', this.testCaseService.getTestCases());
  
  this.route.paramMap.subscribe(params => {
    const moduleId = params.get('moduleId');
    console.log('Received moduleId:', moduleId);
    if (moduleId) {
      this.loadTestCases(moduleId);
    }
  });
}
  get attributes(): FormArray {
    return this.form.get('attributes') as FormArray;
  }

public loadTestCases(moduleId: string): void {
  console.log('Loading test cases for module:', moduleId);
  
  // console.log('Found test cases:', allTestCases);
  // this.testCases.set(allTestCases);
  // // ... rest of the method
  
  // First verify the module exists
  const module = this.testCaseService.getModules().find(m => m.id === moduleId);
  if (!module) {
    console.error(`Module ${moduleId} not found`);
    this.testCases.set([]);
    return;
  }

  console.log('Module found:', module);

  // Get all test cases for this module (regardless of version)
  const allTestCases = this.testCaseService.getTestCasesByModule(moduleId);
  console.log('All test cases for module:', allTestCases);
   console.log('Found test cases:', allTestCases);
  this.testCases.set(allTestCases);

  if (allTestCases.length === 0) {
    console.warn(`No test cases found for module ${moduleId}. Check if:
    - Test cases exist for this module
    - Test cases have proper moduleId (currently '${moduleId}')
    - Test cases are properly loaded in the service`);
  }

  // Get unique versions from these test cases
  const versions = [...new Set(allTestCases.map(tc => tc.version))].sort();
  console.log('Versions found in test cases:', versions);

  this.versions.set(versions);
  this.testCases.set(allTestCases);
  this.applyFilters();

  console.log(`Successfully loaded ${allTestCases.length} test cases for module ${moduleId}`);
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
      (!slNo || tc.slNo.toString().includes(slNo)) &&
      (!testCaseId || tc.testCaseId.toLowerCase().includes(testCaseId.toLowerCase())) &&
      (!useCase || tc.useCase.toLowerCase().includes(useCase.toLowerCase())) &&
      (!version || tc.version === version)
    );
    
    console.log(`Filtered to ${filtered.length} test cases`);
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
        allAttributes.add(attr.key);
      });
    });
    return Array.from(allAttributes);
  }

  getAttributeValue(testCase: TestCase, key: string): string {
    const attr = testCase.attributes?.find(a => a.key === key);
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
    testCase.attributes?.forEach(attr => {
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
          this.markFormGroupTouched(arrayControl as FormGroup);
        });
      }
    });
  }
  printData() {
  console.log('All modules:', this.testCaseService.getModules());
  console.log('All test cases in service:', this.testCaseService.getTestCases());
  console.log('Test cases for mod1:', 
    this.testCaseService.getTestCases().filter(tc => tc.moduleId === 'mod1'));
}
}