import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormArray, Validators, ReactiveFormsModule, FormsModule, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TestCaseService } from 'src/app/shared/services/test-case.service';
import { ManualTestCaseStep, TestCase, TestCaseResult } from 'src/app/shared/modles/testcase.model';
import { ModuleAttribute } from 'src/app/shared/modles/module-attribute.model';
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

  // Module attributes management
  moduleAttributes = signal<ModuleAttribute[]>([]);
  showModuleAttributesForm = signal(false);
  currentModuleAttribute = signal<ModuleAttribute | null>(null);

  form = this.fb.group({
    id: [''],
    moduleId: ['', Validators.required],
    version: ['v1.0', Validators.required],
    testCaseId: ['', [Validators.required, Validators.pattern(/^TC\d+/)]],
    useCase: ['', Validators.required],
    scenario: ['', Validators.required],
    steps: ['', Validators.required], // Changed from FormArray to simple FormControl
    expectedResult: ['', Validators.required], // Changed from 'expected' to match model
    result: ['Pending' as TestCaseResult],
    actual: [''],
    remarks: [''],
    testType: ['Manual'],
    testTool: [''],
    attributes: this.fb.array([])
  });

  constructor() {
    this.route.paramMap.subscribe(params => {
      const moduleId = params.get('moduleId');
      if (moduleId) {
        this.selectedModule.set(moduleId);
        this.form.patchValue({ moduleId: moduleId });
        this.loadTestCases(moduleId);
        const versions = this.testCaseService.getVersionsByProduct(moduleId);
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

  loadTestCases(moduleId: string): void {
    const module = this.testCaseService.getModuleById(moduleId);
    if (!module) {
      console.error(`Module ${moduleId} not found`);
      this.testCases.set([]);
      return;
    }

    const productVersions = this.testCaseService.getVersionStringsByProduct(module.productId);
    this.versions.set(productVersions);

    const allTestCases = this.testCaseService.getTestCasesByModule(moduleId);
    this.testCases.set(allTestCases || []);
    this.applyFilters();

    // Load module attributes
    this.moduleAttributes.set(this.testCaseService.getModuleAttributes(moduleId) || []);
  }

  getUniqueAttributeNames(): string[] {
    const attributeNames = new Set<string>();
    this.moduleAttributes().forEach(attr => {
      if (attr.key) {
        attributeNames.add(attr.key);
      }
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

  openForm(): void {
    this.form.reset();
    this.attributes.clear();
    
    this.form.patchValue({
      moduleId: this.selectedModule(),
      version: this.versions()[0] || 'v1.0',
      result: 'Pending',
      testType: 'Manual'
    });
    
    this.moduleAttributes().forEach(attr => {
      this.addAttribute(attr.key, '');
    });
    
    this.isEditing.set(true);
  }

  startEditing(testCase: TestCase): void {
    this.form.reset();
    this.attributes.clear();

    // Convert steps array to single text
    const stepsText = testCase.steps?.map(step => step.steps).join('\n\n') || '';
    
    this.form.patchValue({
      id: testCase.id,
      moduleId: testCase.moduleId,
      version: testCase.version,
      testCaseId: testCase.testCaseId,
      useCase: testCase.useCase,
      scenario: testCase.scenario,
      steps: stepsText,
      expectedResult: testCase.steps?.[0]?.expectedResult || '',
      result: testCase.result || 'Pending',
      actual: testCase.actual || '',
      remarks: testCase.remarks || '',
      testType: testCase.testType || 'Manual'
    });

    // Add attributes
    this.moduleAttributes().forEach(attr => {
      const existingValue = testCase.attributes?.find(a => a.key === attr.key)?.value || '';
      this.addAttribute(attr.key, existingValue);
    });

    this.isEditing.set(true);
  }

  cancelEditing(): void {
    this.form.reset();
    this.attributes.clear();
    this.isEditing.set(false);
  }

 saveTestCase(): void {
  this.markFormGroupTouched(this.form);

  if (this.form.invalid) {
    console.log('Form errors:', this.form.errors);
    this.showAlertMessage('Please fill all required fields correctly', 'error');
    return;
  }

  const formValue = this.form.value;

  // Generate testCaseId (used in both testCase and steps)
  const testCaseId = formValue.testCaseId || Date.now().toString();

  // Convert steps text back to steps array with testCaseId
  const stepsArray = formValue.steps?.split('\n\n')
    .filter((s: string) => s.trim() !== '')
    .map((stepText: string) => ({
      testCaseId: testCaseId,  // ✅ required field
      steps: stepText,
      expectedResult: formValue.expectedResult || ''
    })) || [];

  const testCase: TestCase = {
    id: formValue.id || Date.now().toString(),
    moduleId: this.selectedModule(),
    version: formValue.version || 'v1.0',
    testCaseId: testCaseId,
    useCase: formValue.useCase || '',
    scenario: formValue.scenario || '',
    testType: formValue.testType as 'Manual' | 'Automation' || 'Manual',
    steps: stepsArray,
    result: formValue.result as TestCaseResult || 'Pending',
    actual: formValue.actual || '',
    remarks: formValue.remarks || '',
    attributes: this.attributes.value || [],
    uploads: []
  };

  try {
    if (formValue.id) {
      this.testCaseService.updateTestCase(testCase);
      this.showAlertMessage('Test case updated successfully!', 'success');
    } else {
      this.testCaseService.addTestCase(testCase);
      this.showAlertMessage('Test case added successfully!', 'success');
    }
    this.loadTestCases(this.selectedModule());
    this.cancelEditing();
  } catch (error) {
    console.error('Error saving test case:', error);
    this.showAlertMessage('Error saving test case', 'error');
  }
}


  // Module attributes management (keep existing methods)
  openModuleAttributes(): void {
    const moduleId = this.selectedModule();
    if (!moduleId) return;
    this.moduleAttributes.set(this.testCaseService.getModuleAttributes(moduleId) || []);
    this.showModuleAttributesForm.set(true);
  }

  addModuleAttribute(): void {
    this.currentModuleAttribute.set({
      id: '',
      moduleId: this.selectedModule(),
      name: '',
      key: '',
      type: 'text',
      isRequired: false
    });
  }

  editModuleAttribute(attribute: ModuleAttribute): void {
    this.currentModuleAttribute.set({...attribute});
  }

  saveModuleAttribute(): void {
    const attribute = this.currentModuleAttribute();
    if (!attribute) return;
    
    if (!attribute.name || !attribute.key) {
      this.showAlertMessage('Name and Key are required', 'error');
      return;
    }
    
    if (!attribute.id) {
      attribute.id = `attr_${Date.now()}`;
    }
    
    this.testCaseService.saveModuleAttribute(attribute);
    this.moduleAttributes.set(this.testCaseService.getModuleAttributes(this.selectedModule()) || []);
    this.currentModuleAttribute.set(null);
  }

  deleteModuleAttribute(attributeId: string): void {
    this.testCaseService.deleteModuleAttribute(attributeId);
    this.moduleAttributes.set(this.testCaseService.getModuleAttributes(this.selectedModule()) || []);
  }

  closeModuleAttributeForm(): void {
    this.currentModuleAttribute.set(null);
    this.showModuleAttributesForm.set(false);
  }

  // Other methods (keep existing)
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
  }
}