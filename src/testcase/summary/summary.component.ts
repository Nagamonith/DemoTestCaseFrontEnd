// src/app/tester/summary/summary.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TestCaseService } from 'src/app/shared/services/test-case.service';

@Component({
  selector: 'app-summary',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.css'],
})
export class SummaryComponent {
  private testCaseService = inject(TestCaseService);

  testCases = this.testCaseService.getTestCases();
  modules = this.testCaseService.getModules();

  get versions(): string[] {
    return Array.from(new Set(this.testCases.map(tc => tc.version)));
  }

  get testMatrix(): Record<string, number> {
    const map: Record<string, number> = {};
    for (const tc of this.testCases) {
      const key = `${tc.moduleId}-${tc.version}`;
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }

  getCount(modId: string, ver: string): number {
    return this.testMatrix[`${modId}-${ver}`] ?? 0;
  }

  getVersionTotal(ver: string): number {
    return this.modules.reduce((sum, mod) => sum + this.getCount(mod.id, ver), 0);
  }

  getModuleName(id: string): string {
    const mod = this.modules.find(m => m.id === id);
    return mod ? mod.name : `Module ${id}`;
  }
}