// Mock Airtable responses and utilities

export const mockRecord = (overrides: any = {}) => ({
  id: 'recXXXXXXXXXXXXXX',
  fields: {
    Name: 'Test Record',
    Status: 'Active',
    ...overrides.fields,
  },
  createdTime: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

export const mockBase = {
  id: 'appXXXXXXXXXXXXXX',
  name: 'Test Base',
  permissionLevel: 'create',
  color: 'blue',
};

export const mockTable = {
  id: 'tblXXXXXXXXXXXXXX',
  name: 'Test Table',
  primaryFieldId: 'fldXXXXXXXXXXXXXX',
  fields: [
    {
      id: 'fldXXXXXXXXXXXXXX',
      name: 'Name',
      type: 'singleLineText',
    },
    {
      id: 'fldYYYYYYYYYYYYYY',
      name: 'Status',
      type: 'singleSelect',
      options: {
        choices: [
          { id: 'selActive', name: 'Active', color: 'green' },
          { id: 'selInactive', name: 'Inactive', color: 'red' },
        ],
      },
    },
  ],
  views: [
    {
      id: 'viwXXXXXXXXXXXXXX',
      name: 'Grid view',
      type: 'grid',
    },
  ],
};

export const mockError = (status: number = 404, message: string = 'Not found') => ({
  error: {
    type: 'INVALID_REQUEST_UNKNOWN',
    message,
  },
  status,
});

// Mock Airtable SDK
export const createMockAirtableBase = () => {
  const mockDestroy = jest.fn().mockResolvedValue({ id: 'recXXXXXXXXXXXXXX', deleted: true });
  const mockUpdate = jest.fn().mockResolvedValue(mockRecord());
  const mockCreate = jest.fn().mockImplementation((fields: any) => {
    if (Array.isArray(fields)) {
      return Promise.resolve(fields.map((f: any) => mockRecord({ fields: f })));
    }
    return Promise.resolve(mockRecord({ fields }));
  });
  const mockSelect = jest.fn().mockReturnValue({
    all: jest.fn().mockResolvedValue([mockRecord()]),
    firstPage: jest.fn().mockResolvedValue([mockRecord()]),
    eachPage: jest.fn().mockImplementation((callback: any) => {
      callback([mockRecord()], () => {});
      return Promise.resolve();
    }),
  });

  const mockTable = jest.fn().mockReturnValue({
    create: mockCreate,
    update: mockUpdate,
    destroy: mockDestroy,
    select: mockSelect,
    find: jest.fn().mockResolvedValue(mockRecord()),
  });

  return jest.fn().mockReturnValue(mockTable);
};

export const createMockAirtable = () => ({
  base: createMockAirtableBase(),
  configure: jest.fn(),
});

// Mock fetch responses for metadata API
export const mockFetchResponses = {
  listBases: {
    ok: true,
    json: async () => ({ bases: [mockBase] }),
  },
  listTables: {
    ok: true,
    json: async () => ({ tables: [mockTable] }),
  },
  getSchema: {
    ok: true,
    json: async () => ({ tables: [mockTable] }),
  },
  error: {
    ok: false,
    statusText: 'Not Found',
    json: async () => mockError(),
  },
};