// Mock storage clients (S3 and GCS)

export const mockS3UploadResult = {
  url: 'https://bucket.s3.amazonaws.com/attachments/12345-test.pdf',
  key: 'attachments/12345-test.pdf',
  bucket: 'test-bucket',
  size: 1024,
  contentType: 'application/pdf',
};

export const mockGCSUploadResult = {
  url: 'https://storage.googleapis.com/bucket/attachments/12345-test.pdf',
  key: 'attachments/12345-test.pdf',
  bucket: 'test-bucket',
  size: 1024,
  contentType: 'application/pdf',
};

export const createMockS3Client = () => ({
  uploadFile: jest.fn().mockResolvedValue(mockS3UploadResult),
  uploadBuffer: jest.fn().mockResolvedValue(mockS3UploadResult),
  getPublicUrl: jest.fn((key: string) => `https://bucket.s3.amazonaws.com/${key}`),
});

export const createMockGCSClient = () => ({
  uploadFile: jest.fn().mockResolvedValue(mockGCSUploadResult),
  uploadBuffer: jest.fn().mockResolvedValue(mockGCSUploadResult),
  getPublicUrl: jest.fn((key: string) => `https://storage.googleapis.com/bucket/${key}`),
});

export const createMockStorageClient = (type: 's3' | 'gcs' = 's3') => {
  return type === 's3' ? createMockS3Client() : createMockGCSClient();
};