// upload.model.ts
// src/app/shared/modles/upload.model.ts
export interface Upload {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
  uploadedBy: string;
  testCaseId?: string;
}

export interface TestCaseUpload {
  id?: string;
  testCaseId: string;
  uploadId: string;
  createdAt?: Date;
}
