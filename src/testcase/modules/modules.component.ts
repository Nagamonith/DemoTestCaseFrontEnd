import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ChangeDetectorRef,
  inject,
  signal,
  computed,
  WritableSignal,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  FormControl,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, ParamMap, RouterModule } from '@angular/router';
import { TestCaseService } from 'src/app/shared/services/test-case.service';
import { TestCase } from 'src/app/shared/data/dummy-testcases';
import { AutoSaveService } from 'src/app/shared/services/auto-save.service';
import { AlertComponent } from "src/app/shared/alert/alert.component";
import { TestSuiteService } from 'src/app/shared/services/test-suite.service';
import { TestSuite } from 'src/app/shared/data/test-suite.model';
import { TestRunService } from 'src/app/shared/services/test-run.service';
import { TestRun } from 'src/app/shared/data/test-run.model';
import { DomSanitizer } from '@angular/platform-browser';

interface Filter {
  slNo: string;
  testCaseId: string;
  useCase: string;
  result: string;
  attributeKey?: string;
  attributeValue?: string;
}

type TestCaseField = keyof Omit<TestCase, 'attributes'> | `attr_${string}`;

interface TableColumn {
  field: TestCaseField | 'attributes' | string;
  header: string;
  width: number;
  noResize?: boolean;
  isAttribute?: boolean;
}

interface UploadedFile {
  url: string;
  loaded: boolean;
}

interface TestRunProgress {
  total: number;
  completed: number;
}

@Component({
  selector: 'app-modules',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, AlertComponent],
  templateUrl: './modules.component.html',
  styleUrls: ['./modules.component.css']
})
export class ModulesComponent implements OnInit, OnDestroy, AfterViewInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private testCaseService = inject(TestCaseService);
  private testSuiteService = inject(TestSuiteService);
  private testRunService = inject(TestRunService);
  private cdRef = inject(ChangeDetectorRef);
  private autoSaveService = inject(AutoSaveService);
  private sanitizer = inject(DomSanitizer);

  // State signals
  selectedModule = signal<string | null>(null);
  selectedVersion = '';
  availableVersions: string[] = [];
  versionTestCases = signal<TestCase[]>([]);
  showViewTestCases = false;
  showStartTesting = false;
  showTestSuites = false;
  showTestRuns = false;
  availableAttributes: string[] = [];
  attributeColumns: TableColumn[] = [];
  testRunProgress: WritableSignal<TestRunProgress> = signal({ total: 0, completed: 0 });

  // Data signals
  modules = this.testCaseService.getModules();
  testSuites = this.testSuiteService.getTestSuites();
  testCasePool = this.testCaseService.getTestCases();
  testRuns = signal<TestRun[]>([]);
  formArray = new FormArray<FormGroup>([]);
  uploads: UploadedFile[][] = [];
  selectedTestRunId = signal<string | null>(null);
  viewingSuiteId = signal<string | null>(null);

  // Computed properties
  selectedTestSuite = computed(() => {
    if (!this.selectedModule() || !this.showTestSuites) return null;
    return this.testSuiteService.getTestSuiteById(this.selectedModule()!);
  });

  selectedTestRun = computed(() => {
    if (!this.selectedTestRunId()) return null;
    return this.testRunService.getTestRunById(this.selectedTestRunId()!);
  });

  filter: Filter = {
    slNo: '',
    testCaseId: '',
    useCase: '',
    result: '',
  };

  popupIndex: number | null = null;
  popupField: 'actual' | 'remarks' | null = null;
  isPopupOpen: boolean = false;

  isResizing = false;
  currentResizeColumn: TableColumn | null = null;
  startX = 0;
  startWidth = 0;

  scrollContainer: HTMLElement | null = null;
  canScrollLeft = false;
  canScrollRight = false;

  selectedSuiteIds: string[] = [];

  // Alert properties
  alertMessage = '';
  alertType: 'success' | 'error' | 'warning' | 'info' = 'success';
  showAlert = false;
  alertDuration = 3000;
  private alertTimeout: any;

  private boundHandleClick = this.handleDocumentClick.bind(this);
  private boundOnResize = this.onResize.bind(this);
  private boundStopResize = this.stopResize.bind(this);

  viewColumns: TableColumn[] = [
    { field: 'slNo', header: 'Sl No', width: 80 },
    { header: 'Version', field: 'version', width: 100 },
    { field: 'useCase', header: 'Use Case', width: 150 },
    { field: 'testCaseId', header: 'Test Case ID', width: 120 },
    { field: 'scenario', header: 'Scenario', width: 200 },
    { field: 'steps', header: 'Steps', width: 200 },
    { field: 'expected', header: 'Expected', width: 200 }
  ];

  testColumns: TableColumn[] = [
    { field: 'slNo', header: 'Sl No', width: 80 },
    { field: 'version', header: 'Version', width: 100 },
    { field: 'useCase', header: 'Use Case', width: 150 },
    { field: 'testCaseId', header: 'Test Case ID', width: 120 },
    { field: 'scenario', header: 'Scenario', width: 200 },
    { field: 'steps', header: 'Steps', width: 200 },
    { field: 'expected', header: 'Expected', width: 200 }
  ];

  ngOnInit(): void {
    this.autoSaveService.start(() => this.onSave());
    
    this.route.paramMap.subscribe((pm: ParamMap) => {
      const modId = pm.get('moduleId');
      const fallback = this.modules.length ? this.modules[0].id : null;
      this.onSelectionChange(modId ?? fallback ?? '');
    });

    this.route.queryParamMap.subscribe(queryParams => {
      const shouldLoadAll = queryParams.get('loadAllVersions') === 'true';
      if (shouldLoadAll && this.selectedModule() && !this.showTestSuites) {
        this.selectedVersion = 'all';
        this.onVersionChange();
      }
    });

    this.extractAvailableAttributes();
    window.addEventListener('resize', this.updateScrollButtons.bind(this));
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.scrollContainer = document.querySelector('.table-container');
      this.updateScrollButtons();
    }, 200);
  }

  ngOnDestroy(): void {
    this.autoSaveService.stop();
    document.removeEventListener('click', this.boundHandleClick);
    document.removeEventListener('mousemove', this.boundOnResize);
    document.removeEventListener('mouseup', this.boundStopResize);
    window.removeEventListener('resize', this.updateScrollButtons.bind(this));
    if (this.alertTimeout) {
      clearTimeout(this.alertTimeout);
    }
  }

  toggleSelectionMode(showSuites: boolean, showRuns: boolean): void {
    this.showTestSuites = showSuites;
    this.showTestRuns = showRuns;
    this.selectedModule.set(null);
    this.selectedTestRunId.set(null);
    this.viewingSuiteId.set(null);
    this.selectedVersion = '';
    this.versionTestCases.set([]);
    this.showViewTestCases = false;
    this.showStartTesting = false;
    this.formArray.clear();
    
    if (showRuns) {
      this.loadTestRuns();
    }
  }

  loadTestRuns(): void {
    this.testRuns.set(this.testRunService.getTestRuns());
  }

  onTestRunChange(runId: string): void {
    this.selectedTestRunId.set(runId);
    this.viewingSuiteId.set(null);
    if (runId) {
      this.initializeTestRunView();
    }
  }

  private initializeTestRunView(): void {
    if (this.selectedTestRun()?.testSuites?.length) {
      // Set the first suite as default view
      this.viewingSuiteId.set(this.selectedTestRun()!.testSuites[0].id);
      const cases = this.testSuiteService.getTestCasesForSuite(this.viewingSuiteId()!);
      this.versionTestCases.set(cases);
    }
  }

  getSuiteName(suiteId: string): string {
    const suite = this.testSuiteService.getTestSuiteById(suiteId);
    return suite?.name || 'Unknown Suite';
  }

  getSuiteDescription(suiteId: string): string {
    const suite = this.testSuiteService.getTestSuiteById(suiteId);
    return suite?.description || '';
  }

  getSuiteTestCaseCount(suiteId: string): number {
    const suite = this.testSuiteService.getTestSuiteById(suiteId);
    return suite?.testCases.length || 0;
  }

  getSuiteTestCases(suiteId: string): TestCase[] {
    return this.testSuiteService.getTestCasesForSuite(suiteId);
  }

  viewSuiteCases(suiteId: string): void {
    this.viewingSuiteId.set(suiteId);
    const cases = this.testSuiteService.getTestCasesForSuite(suiteId);
    this.versionTestCases.set(cases);
    this.showViewTestCases = true;
    this.showStartTesting = false;
  }

  isImage(url: string): boolean {
    if (!url) return false;
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  }

  getFileName(url: string): string {
    if (!url) return '';
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    const filenamePart = lastPart.split(';')[0];
    return filenamePart.length > 20 
      ? filenamePart.substring(0, 17) + '...' 
      : filenamePart;
  }
// test run 


  onSelectionChange(id: string): void {
    if (!id) return;

    if (this.showTestSuites) {
      this.handleTestSuiteSelection(id);
    } else if (this.showTestRuns) {
      this.onTestRunChange(id);
    } else {
      this.handleModuleSelection(id);
    }
  }

  private handleModuleSelection(id: string): void {
    if (!this.modules.some(m => m.id === id)) return;

    this.selectedModule.set(id);
    this.availableVersions = this.testCaseService.getVersionsByModule(id);
    
    if (this.availableVersions.length > 0) {
      this.selectedVersion = this.availableVersions[0];
      const cases = this.testCasePool.filter(
        tc => tc.moduleId === id && tc.version === this.selectedVersion
      );
      this.versionTestCases.set(cases);
    } else {
      this.selectedVersion = '';
      this.versionTestCases.set([]);
    }

    this.showViewTestCases = false;
    this.showStartTesting = false;
    this.initializeFormForTestCases();
  }

  private handleTestSuiteSelection(suiteId: string): void {
    const suite = this.testSuiteService.getTestSuiteById(suiteId);
    if (!suite) return;

    this.selectedModule.set(suiteId);
    this.selectedVersion = '';
    this.showViewTestCases = true;
    this.showStartTesting = false;

    const testCases = this.testSuiteService.getTestCasesForSuite(suiteId);
    this.versionTestCases.set(testCases);
    this.initializeFormForTestCases();
  }

  private initializeFormForTestCases(): void {
    let testCases: TestCase[] = [];
    
    if (this.showTestRuns && this.viewingSuiteId()) {
      testCases = this.testSuiteService.getTestCasesForSuite(this.viewingSuiteId()!);
    } else if (this.showTestSuites) {
      testCases = this.versionTestCases();
    } else {
      testCases = this.filteredTestCases();
    }

    this.formArray.clear();
    this.uploads = [];

    testCases.forEach(testCase => {
      this.formArray.push(
        this.fb.group({
          result: [testCase.result || 'Pending'],
          actual: [testCase.actual || ''],
          remarks: [testCase.remarks || '']
        })
      );
      
      this.uploads.push(
        testCase.uploads 
          ? testCase.uploads.map(url => ({ url, loaded: true })) 
          : []
      );
    });

    setTimeout(() => {
      this.updateScrollButtons();
      this.cdRef.detectChanges();
    }, 300);
  }

  onVersionChange(): void {
    const mod = this.selectedModule();
    let cases: TestCase[] = [];

    if (mod && !this.showTestSuites && !this.showTestRuns) {
      if (this.selectedVersion === 'all') {
        cases = this.testCasePool.filter(tc => tc.moduleId === mod);
      } else if (this.selectedVersion) {
        cases = this.testCasePool.filter(
          tc => tc.moduleId === mod && tc.version === this.selectedVersion
        );
      }
    }

    this.versionTestCases.set(cases);
    this.initializeFormForTestCases();
  }

  handleViewAction(): void {
    if (this.showTestRuns && this.selectedTestRun()?.testSuites?.length && !this.viewingSuiteId()) {
      this.viewingSuiteId.set(this.selectedTestRun()!.testSuites[0].id);
      const cases = this.testSuiteService.getTestCasesForSuite(this.viewingSuiteId()!);
      this.versionTestCases.set(cases);
    }
    this.showViewTestCases = true;
    this.showStartTesting = false;
  }

  handleStartTesting(): void {
    if (this.showTestRuns) {
      if (this.viewingSuiteId()) {
        const cases = this.testSuiteService.getTestCasesForSuite(this.viewingSuiteId()!);
        this.versionTestCases.set(cases);
      } else if (this.selectedTestRun()?.testSuites?.length) {
        const allCases: TestCase[] = [];
        this.selectedTestRun()!.testSuites.forEach(suite => {
          allCases.push(...this.testSuiteService.getTestCasesForSuite(suite.id));
        });
        this.versionTestCases.set(allCases);
      }
    }
    this.showStartTesting = true;
    this.showViewTestCases = false;
    this.initializeFormForTestCases();
  }

  hasTestCasesToView(): boolean {
    if (this.showTestRuns) {
      return !!this.selectedTestRun()?.testSuites?.length;
    }
    return this.versionTestCases().length > 0;
  }

  onSave(): void {
    const formValues = this.formArray.value;
    const testCases = this.versionTestCases();

    const updatedTestCases = testCases.map((tc, index) => ({
      ...tc,
      result: formValues[index]?.result || 'Pending',
      actual: formValues[index]?.actual || '',
      remarks: formValues[index]?.remarks || '',
      uploads: this.uploads[index]?.map(u => u.url) || [],
      testRunId: this.showTestRuns ? this.selectedTestRunId() : undefined
    }));

    updatedTestCases.forEach(tc => {
      this.testCaseService.updateTestCase(tc);
      
      if (this.showTestRuns && tc.testRunId) {
        this.testRunService.addTestCaseToRun(
          tc.testRunId, 
          tc.id,
          tc.result || 'Pending'
        );
      }
    });

    this.testCasePool = [...this.testCaseService.getTestCases()];
    
    if (this.showTestRuns && this.selectedTestRunId()) {
      this.updateTestRunProgress();
    }

    console.log('Test results saved successfully!', 'success');
    this.cdRef.detectChanges();
  }

private updateTestRunProgress(): void {
  const selectedRun = this.selectedTestRun();
  if (!selectedRun) return;

  // Step 1: Get all suite IDs in the selected run
  const suiteIds = selectedRun.testSuites.map(suite => suite.id);

  // Step 2: Get all test cases associated with those suites
  const runCases: TestCase[] = [];
  suiteIds.forEach(suiteId => {
    const cases = this.testSuiteService.getTestCasesForSuite(suiteId);
    runCases.push(...cases);
  });

  // Step 3: Count total and completed test cases
  const total = runCases.length;
  const completed = runCases.filter(tc =>
    tc.result === 'Pass' || tc.result === 'Fail'
  ).length;

  // Step 4: Update progress signal
  this.testRunProgress.set({ total, completed });

  // Step 5: Determine new status
  let status: TestRun['status'] = 'Not Started';
  if (total > 0 && completed === total) {
    status = 'Completed';
  } else if (completed > 0) {
    status = 'In Progress';
  }

  // Step 6: Update test run status (updatedAt is handled internally)
  this.testRunService.updateTestRun(this.selectedTestRunId()!, { status });
}



  extractAvailableAttributes(): void {
    const allAttributes = new Set<string>();
    this.testCasePool.forEach(tc => {
      tc.attributes?.forEach(attr => {
        allAttributes.add(attr.key);
      });
    });
    this.availableAttributes = Array.from(allAttributes);
  }

  addAttributeColumn(key: string): void {
    if (!this.attributeColumns.some(col => col.field === `attr_${key}`)) {
      this.attributeColumns.push({
        field: `attr_${key}`,
        header: key,
        width: 150,
        isAttribute: true
      });
    }
  }

  getAttributeValue(testCase: TestCase, key: string): string {
    const attr = testCase.attributes?.find(a => a.key === key);
    return attr ? attr.value : '';
  }

  getCellValue(testCase: TestCase, field: string): string {
    if (field.startsWith('attr_')) {
      const attrKey = field.substring(5);
      return this.getAttributeValue(testCase, attrKey);
    }
    const value = testCase[field as keyof TestCase];
    return value !== undefined && value !== null ? value.toString() : '';
  }

  onUpload(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      if (!this.uploads[index]) {
        this.uploads[index] = [];
      }

      Array.from(input.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const url = e.target?.result as string;
          this.uploads[index].push({ 
            url: this.sanitizer.bypassSecurityTrustUrl(url) as string,
            loaded: false 
          });
          this.cdRef.detectChanges();
        };
        reader.readAsDataURL(file);
      });

      input.value = '';
    }
  }

  filteredTestCases(): TestCase[] {
    const mod = this.selectedModule();
    return mod && !this.showTestSuites && !this.showTestRuns
      ? this.testCasePool.filter(tc => tc.moduleId === mod) 
      : [];
  }

  filteredAndSearchedTestCases(): TestCase[] {
    return (this.showTestSuites || this.showTestRuns ? this.versionTestCases() : this.filteredTestCases())
      .filter((tc, i) => {
        const form = this.formGroups()[i];
        const matchesAttribute =
          !this.filter.attributeKey ||
          (this.filter.attributeValue &&
            this.getAttributeValue(tc, this.filter.attributeKey)
              .toLowerCase()
              .includes(this.filter.attributeValue.toLowerCase()));

        return (
          (!this.filter.slNo || tc.slNo.toString().includes(this.filter.slNo)) &&
          (!this.filter.testCaseId || tc.testCaseId.toLowerCase().includes(this.filter.testCaseId.toLowerCase())) &&
          (!this.filter.useCase || tc.useCase.toLowerCase().includes(this.filter.useCase.toLowerCase())) &&
          (!this.filter.result || form.get('result')?.value === this.filter.result) &&
          matchesAttribute
        );
      });
  }

  formGroups(): FormGroup[] {
    return this.formArray.controls as FormGroup[];
  }

  openPopup(index: number, field: 'actual' | 'remarks', event: MouseEvent) {
    event.stopPropagation();

    if (!(this.isPopupOpen && this.popupIndex === index && this.popupField === field)) {
      this.closePopup(this.popupIndex!);
      
      this.popupIndex = index;
      this.popupField = field;
      this.isPopupOpen = true;

      setTimeout(() => {
        document.addEventListener('click', this.boundHandleClick);
      });
    }
  }

  saveAndClosePopup(index: number): void {
    if (this.popupIndex === index) {
      this.cdRef.detectChanges();
      this.closePopup(index);
    }
  }

  closePopup(index: number) {
    if (this.popupIndex === index) {
      this.isPopupOpen = false;
      this.popupIndex = null;
      this.popupField = null;
      document.removeEventListener('click', this.boundHandleClick);
      this.cdRef.detectChanges();
    }
  }

  getFormControl(index: number, controlName: string): FormControl {
    const control = this.formGroups()[index].get(controlName);
    if (!control) throw new Error(`Form control '${controlName}' not found`);
    return control as FormControl;
  }

  private handleDocumentClick(event: MouseEvent) {
    if (this.isPopupOpen && this.popupIndex !== null) {
      const target = event.target as HTMLElement;
      const isInsidePopup = target.closest('.popup-box');
      const isPopupTrigger = target.closest('.popup-cell');
      
      if (!isInsidePopup && !isPopupTrigger) {
        this.closePopup(this.popupIndex);
      }
    }
  }

  scrollTable(offset: number): void {
    if (!this.scrollContainer) return;
    this.scrollContainer.scrollLeft += offset;
    this.updateScrollButtons();
  }

  updateScrollButtons(): void {
    if (!this.scrollContainer) return;
    const { scrollLeft, scrollWidth, clientWidth } = this.scrollContainer;
    this.canScrollLeft = scrollLeft > 0;
    this.canScrollRight = scrollLeft + clientWidth < scrollWidth;
    this.cdRef.detectChanges();
  }

  startResize(event: MouseEvent, column: TableColumn): void {
    if (column.noResize) return;

    this.isResizing = true;
    this.currentResizeColumn = column;
    this.startX = event.pageX;
    this.startWidth = column.width;

    event.preventDefault();
    event.stopPropagation();

    document.addEventListener('mousemove', this.boundOnResize);
    document.addEventListener('mouseup', this.boundStopResize);
  }

  onResize(event: MouseEvent): void {
    if (this.isResizing && this.currentResizeColumn) {
      const dx = event.pageX - this.startX;
      this.currentResizeColumn.width = Math.max(50, this.startWidth + dx);
      this.cdRef.detectChanges();
    }
  }

  stopResize(): void {
    this.isResizing = false;
    document.removeEventListener('mousemove', this.boundOnResize);
    document.removeEventListener('mouseup', this.boundStopResize);
  }

  copyTestCaseLink(testCaseId: string): void {
    const copyUrl = `${window.location.origin}/tester/view-testcase/${testCaseId}`;
    navigator.clipboard.writeText(copyUrl)
      .then(() => {
        this.showAlertMessage('Link copied to clipboard!', 'success');
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        this.showAlertMessage('Failed to copy link', 'error');
      });
  }

  showAlertMessage(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success'): void {
    this.alertMessage = message;
    this.alertType = type;
    this.showAlert = true;
    
    if (this.alertTimeout) {
      clearTimeout(this.alertTimeout);
    }
    
    this.alertTimeout = setTimeout(() => {
      this.showAlert = false;
      this.cdRef.detectChanges();
    }, this.alertDuration);
  }

  onAlertClose(): void {
    this.showAlert = false;
    if (this.alertTimeout) {
      clearTimeout(this.alertTimeout);
    }
  }

  onImageLoad(event: Event, rowIndex: number, fileIndex: number) {
    this.uploads[rowIndex][fileIndex].loaded = true;
    this.cdRef.detectChanges();
  }

  removeUpload(rowIndex: number, fileIndex: number) {
    this.uploads[rowIndex].splice(fileIndex, 1);
    this.cdRef.detectChanges();
  }

  getRunCompletionPercentage(): number {
    if (!this.selectedTestRunId()) return 0;
    
    const total = this.testRunProgress().total;
    const completed = this.testRunProgress().completed;
    
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  getCompletedCaseCount(): number {
    return this.testRunProgress().completed;
  }

  getTotalCaseCount(): number {
    return this.testRunProgress().total;
  }
}