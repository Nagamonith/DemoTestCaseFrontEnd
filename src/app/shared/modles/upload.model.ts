export interface Upload {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
  uploadedBy: string;
}
