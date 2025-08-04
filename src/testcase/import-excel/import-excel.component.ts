// import-excel.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as XLSX from 'xlsx';
import { Router } from '@angular/router';

@Component({
  selector: 'app-import-excel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './import-excel.component.html',
  styleUrls: ['./import-excel.component.css']
})
export class ImportExcelComponent {
  fileName = signal<string>('');
  sheetNames = signal<string[]>([]);
  sheetData = signal<Record<string, any[]> | null>(null);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string>('');
  currentProduct = signal<{ id: string, name: string } | null>(null);

  private router = inject(Router);

  constructor() {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state as { productId: string, productName: string };

    if (state) {
      this.currentProduct.set({
        id: state.productId,
        name: state.productName
      });
    }
  }

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

  onSelectSheet(sheetName: string) {
    const product = this.currentProduct();
    const data = this.sheetData();

    if (!product) {
      this.errorMessage.set('No product selected. Please select a product first.');
      return;
    }

    if (!data || !data[sheetName]) {
      this.errorMessage.set('Selected sheet has no data or sheet not found');
      return;
    }

    const firstRow = data[sheetName][0];
    const navigationData = {
      sheetColumns: Object.keys(firstRow),
      sheetData: data[sheetName],
      productId: product.id,
      productName: product.name
    };

    this.router.navigate(['/tester/mapping', encodeURIComponent(sheetName)], {
      state: navigationData
    }).catch(error => {
      console.error('Navigation error:', error);
      this.errorMessage.set('Failed to navigate. Please try again.');
    });
  }
   saveData() {
    if (!this.sheetData()) {
      this.errorMessage.set('No data to save');
      return;
    }
    console.log('Final sheet data:', this.sheetData());
    alert('Data saved successfully (check console)');
  }  onCancelSheet(sheetName: string) {
    const updated = this.sheetNames().filter((name) => name !== sheetName);
    this.sheetNames.set(updated);

    const updatedData = { ...this.sheetData() };
    delete updatedData[sheetName];
    this.sheetData.set(Object.keys(updatedData).length ? updatedData : null);
  }
}
