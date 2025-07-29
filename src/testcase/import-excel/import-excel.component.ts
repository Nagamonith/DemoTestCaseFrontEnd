// src/app/tester/import-excel/import-excel.component.ts
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as XLSX from 'xlsx';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-import-excel',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './import-excel.component.html',
  styleUrls: ['./import-excel.component.css']
})
export class ImportExcelComponent {
  fileName = signal<string>('');
  sheetNames = signal<string[]>([]);
  sheetData = signal<Record<string, any[]> | null>(null);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string>('');

  constructor(private router: Router) {}

  handleFileInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.fileName.set(file.name);

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const binary = e.target.result;
        const workbook = XLSX.read(binary, { type: 'binary' });

        const allSheets: Record<string, any[]> = {};
        workbook.SheetNames.forEach((sheet) => {
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { defval: '' });
          allSheets[sheet] = rows;
        });

        this.sheetNames.set(workbook.SheetNames);
        this.sheetData.set(allSheets);
      } catch (error) {
        this.errorMessage.set('Error processing Excel file. Please try again.');
        console.error('Error processing Excel:', error);
      } finally {
        this.isLoading.set(false);
      }
    };

    reader.onerror = () => {
      this.errorMessage.set('Error reading file. Please try again.');
      this.isLoading.set(false);
    };

    reader.readAsBinaryString(file);
  }

  onCancelSheet(sheetName: string) {
    const updated = this.sheetNames().filter((name) => name !== sheetName);
    this.sheetNames.set(updated);

    const updatedData = { ...this.sheetData() };
    delete updatedData[sheetName];
    this.sheetData.set(Object.keys(updatedData).length ? updatedData : null);
  }

onSelectSheet(sheetName: string) {
  // 1. First validate we have data
  if (!this.sheetData() || !this.sheetData()![sheetName] || this.sheetData()![sheetName].length === 0) {
    this.errorMessage.set('Selected sheet has no data or sheet not found');
    return;
  }

  // 2. Get the first row to extract column headers
  const firstRow = this.sheetData()![sheetName][0];
  if (!firstRow || typeof firstRow !== 'object') {
    this.errorMessage.set('Sheet data format is invalid');
    return;
  }

  // 3. Prepare navigation data
  const navigationData = {
    sheetColumns: Object.keys(firstRow),
    sheetData: this.sheetData()![sheetName]
  };

  console.log('Navigating with:', { sheetName, navigationData }); // Debug log

  // 4. Navigate with error handling
  this.router.navigate(['/tester/mapping', sheetName], {
    state: navigationData
  }).then(navigationResult => {
    if (!navigationResult) {
      console.error('Navigation failed silently');
      this.errorMessage.set('Failed to open mapping page. Please try again.');
    }
  }).catch(error => {
    console.error('Navigation error:', error);
    this.errorMessage.set(`Navigation error: ${error.message}`);
  });
}

  saveData() {
    if (!this.sheetData()) {
      this.errorMessage.set('No data to save');
      return;
    }
    console.log('📦 Final sheet data:', this.sheetData());
    alert('Data saved successfully (check console)');
  }
}