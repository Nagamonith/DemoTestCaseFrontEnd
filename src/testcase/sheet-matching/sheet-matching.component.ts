// sheet-matching.component.ts
import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TestCaseService } from 'src/app/shared/services/test-case.service';
import { AddAttributeDialogComponent } from './add-attribute-dialog.component';
import { TestCase } from 'src/app/shared/modles/testcase.model';

interface FieldMapping {
  field: string;
  label: string;
  mappedTo: string;
  required: boolean;
}

@Component({
  selector: 'app-sheet-matching',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatDialogModule,
    MatInputModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule
  ],
  templateUrl: './sheet-matching.component.html',
  styleUrls: ['./sheet-matching.component.css']
})
export class SheetMatchingComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private testCaseService = inject(TestCaseService);

  sheetName = signal<string>('Untitled');
  sheetColumns = signal<string[]>([]);
  sheetData = signal<any[]>([]);
  customAttributes = signal<string[]>([]);
  attributeMappings = signal<Record<string, string>>({});
  isProcessing = signal(false);
  errorMessage = signal<string | null>(null);
  currentProduct = signal<{ id: string, name: string } | null>(null);

  coreMappings = signal<FieldMapping[]>([
    { field: 'slNo', label: 'Sl.No', mappedTo: '', required: true },
    { field: 'testCaseId', label: 'Test Case ID', mappedTo: '', required: true },
    { field: 'useCase', label: 'Use Case', mappedTo: '', required: true },
    { field: 'scenario', label: 'Scenario', mappedTo: '', required: true },
    { field: 'steps', label: 'Steps', mappedTo: '', required: true },
    { field: 'expected', label: 'Expected', mappedTo: '', required: true },
    { field: 'version', label: 'Version', mappedTo: 'v1.0', required: false }
  ]);

  constructor() {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state;

    if (state) {
      const sheetNameParam = this.route.snapshot.paramMap.get('sheetName');
      this.sheetName.set(sheetNameParam ? decodeURIComponent(sheetNameParam) : 'Untitled');
      this.sheetColumns.set(state['sheetColumns'] || []);
      this.sheetData.set(state['sheetData'] || []);

      if (state['productId']) {
        this.currentProduct.set({
          id: state['productId'],
          name: state['productName'] || 'Unnamed Product'
        });
      }

      setTimeout(() => this.autoMapColumns(), 0);
    } else {
      this.router.navigate(['/tester/import-excel']);
    }

    effect(() => {
      console.log('Core mappings:', this.coreMappings());
      console.log('Attribute mappings:', this.attributeMappings());
    });
  }

  updateMapping(field: string, column: string): void {
    this.coreMappings.update(mappings =>
      mappings.map(m => m.field === field ? { ...m, mappedTo: column } : m)
    );
  }

  getAttributeMapping(attr: string): string {
    return this.attributeMappings()[attr] || '';
  }

  updateAttributeMapping(attr: string, column: string): void {
    this.attributeMappings.update(mappings => ({
      ...mappings,
      [attr]: column
    }));
  }

  openAddAttributeDialog(): void {
    const dialogRef = this.dialog.open(AddAttributeDialogComponent, {
      width: '400px',
      disableClose: true,
      data: { existing: this.customAttributes() }
    });

    dialogRef.afterClosed().subscribe(attribute => {
      if (attribute) {
        this.customAttributes.update(attrs => [...attrs, attribute]);
        this.attributeMappings.update(mappings => ({
          ...mappings,
          [attribute]: ''
        }));
      }
    });
  }

  removeCustomAttribute(attr: string): void {
    this.customAttributes.update(attrs => attrs.filter(a => a !== attr));
    this.attributeMappings.update(mappings => {
      const newMappings = { ...mappings };
      delete newMappings[attr];
      return newMappings;
    });
  }

  goBack(): void {
    this.router.navigate(['/tester/import-excel']);
  }

  async importTestCases(): Promise<void> {
    this.isProcessing.set(true);
    this.errorMessage.set(null);

    try {
      const product = this.currentProduct();
      if (!product) {
        throw new Error('No product selected. Please select a product before importing.');
      }

      const missingRequired = this.coreMappings()
        .filter(m => m.required && !m.mappedTo);

      if (missingRequired.length > 0) {
        throw new Error(`Please map all required fields: ${missingRequired.map(m => m.label).join(', ')}`);
      }

      const moduleName = this.generateModuleName();
      const moduleId = this.testCaseService.addModule(moduleName, product.id);

      const testCasesToAdd = this.sheetData().map((row, index) => {
        const attributes = this.customAttributes()
          .filter(attr => this.attributeMappings()[attr] && row[this.attributeMappings()[attr]])
          .map(attr => ({
            key: attr,
            value: row[this.attributeMappings()[attr]]
          }));

        return {
          moduleId,
          version: row[this.getMappedValue('version')] || 'v1.0',
          testCaseId: row[this.getMappedValue('testCaseId')] || `TC${index + 1}`,
          useCase: row[this.getMappedValue('useCase')] || '',
          scenario: row[this.getMappedValue('scenario')] || '',
          steps: row[this.getMappedValue('steps')] || '',
          expected: row[this.getMappedValue('expected')] || '',
          slNo: parseInt(row[this.getMappedValue('slNo')]) || index + 1,
          attributes,
          result: 'Pending',
          actual: '',
          remarks: '',
          uploads: []
        } as unknown as Omit<TestCase, 'id'>;
      });

    const addedCases = await this.testCaseService.addTestCasesBulk(testCasesToAdd);

this.snackBar.open(
  `Imported ${addedCases.success} test cases to ${moduleName}. ${addedCases.errors} failed.`,
  'Close',
  { duration: 5000 }
);

      this.router.navigate(['/tester/modules', moduleId], {
        state: { refresh: true }
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to import test cases';
      this.errorMessage.set(errorMsg);
      console.error('Import error:', error);
      this.snackBar.open(errorMsg, 'Close', { duration: 5000 });
    } finally {
      this.isProcessing.set(false);
    }
  }

  private getMappedValue(field: string): string {
    const mapping = this.coreMappings().find(m => m.field === field);
    return mapping?.mappedTo || '';
  }

  private generateModuleName(): string {
    return this.sheetName()
      .replace(/[_-]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private autoMapColumns(): void {
    const availableColumns = this.sheetColumns().map(col => col.toLowerCase().trim());

    this.coreMappings.update(mappings =>
      mappings.map(mapping => {
        const match = availableColumns.find(col =>
          col === mapping.label.toLowerCase().trim() ||
          col === mapping.field.toLowerCase().trim()
        );
        return match
          ? { ...mapping, mappedTo: this.sheetColumns().find(col => col.toLowerCase().trim() === match)! }
          : mapping;
      })
    );
  }
}
