import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TestCaseService } from 'src/app/shared/services/test-case.service';
import { TestCase } from 'src/app/shared/data/dummy-testcases';

@Component({
  selector: 'app-test-case-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './test-case-viewer.component.html',
  styleUrls: ['./test-case-viewer.component.css']
})
export class TestCaseViewerComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private testCaseService = inject(TestCaseService);

  testCase: TestCase | undefined;

ngOnInit(): void {
  const testCaseId = this.route.snapshot.paramMap.get('testCaseId');
  if (testCaseId) {
    this.testCase = this.testCaseService.getTestCases().find(
      tc => tc.testCaseId === testCaseId
    );
  }
}
}


