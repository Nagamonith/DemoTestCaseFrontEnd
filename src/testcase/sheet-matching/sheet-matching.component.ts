import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router, ActivatedRoute } from '@angular/router';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TestCaseService } from 'src/app/shared/services/test-case.service';
import { AddAttributeDialogComponent } from './add-attribute-dialog.component';

import { MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

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
  private testCaseService = inject(TestCaseService);

  sheetName = signal<string>('');
  sheetColumns = signal<string[]>([]);
  sheetData = signal<any[]>([]);
  customAttributes = signal<string[]>([]);
  attributeMappings = signal<Record<string, string>>({});
  isProcessing = signal(false);
  errorMessage = signal<string | null>(null);

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
      this.sheetName.set(this.route.snapshot.paramMap.get('sheetName') || '');
      this.sheetColumns.set(state['sheetColumns'] || []);
      this.sheetData.set(state['sheetData'] || []);
      setTimeout(() => this.autoMapColumns(), 0);
    } else {
      this.router.navigate(['/tester/import-excel']);
    }
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

  importTestCases(): void {
    this.isProcessing.set(true);
    this.errorMessage.set(null);

    try {
      const missingRequired = this.coreMappings()
        .filter(m => m.required && !m.mappedTo);

      if (missingRequired.length > 0) {
        throw new Error(`Please map all required fields: ${missingRequired.map(m => m.label).join(', ')}`);
      }

      const moduleName = this.generateModuleName();
      const moduleId = this.testCaseService.addModule(moduleName);

      this.sheetData().forEach((row, index) => {
        const attributes = this.customAttributes()
          .filter(attr => this.attributeMappings()[attr] && row[this.attributeMappings()[attr]])
          .map(attr => ({
            key: attr,
            value: row[this.attributeMappings()[attr]]
          }));

        const testCase: any = {
          moduleId,
          version: this.getMappedValue('version') || 'v1.0',
          testCaseId: row[this.getMappedValue('testCaseId')] || `TC${index + 1}`,
          useCase: row[this.getMappedValue('useCase')] || '',
          scenario: row[this.getMappedValue('scenario')] || '',
          steps: row[this.getMappedValue('steps')] || '',
          expected: row[this.getMappedValue('expected')] || '',
          slNo: parseInt(row[this.getMappedValue('slNo')]) || index + 1,
          attributes,
          result: 'Pending'
        };

        this.testCaseService.addTestCase(testCase);
      });

      this.router.navigate(['/tester/modules', moduleId]);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Failed to import test cases');
      console.error('Import error:', error);
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