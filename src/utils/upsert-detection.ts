import { logger } from './logger.js';

/**
 * Analyzes records to detect potential upsert fields (stitching keys)
 * Uses heuristics to identify unique identifiers
 */
export function detectUpsertFields(
  records: Array<{ fields: Record<string, any> }>,
  tableSchema?: any
): string[] {
  if (records.length === 0) {
    return [];
  }

  // Get all field names from the first record
  const fieldNames = Object.keys(records[0].fields);
  const fieldAnalysis: Record<string, {
    uniqueValues: Set<any>;
    isUnique: boolean;
    hasNulls: boolean;
    fieldType?: string;
    score: number;
  }> = {};

  // Initialize analysis for each field
  fieldNames.forEach(fieldName => {
    fieldAnalysis[fieldName] = {
      uniqueValues: new Set(),
      isUnique: true,
      hasNulls: false,
      fieldType: tableSchema?.fields?.find((f: any) => f.name === fieldName)?.type,
      score: 0,
    };
  });

  // Analyze each record
  records.forEach(record => {
    fieldNames.forEach(fieldName => {
      const value = record.fields[fieldName];
      const analysis = fieldAnalysis[fieldName];

      if (value === null || value === undefined || value === '') {
        analysis.hasNulls = true;
        analysis.score -= 10; // Penalize fields with nulls
      } else {
        // Check if value already exists (not unique)
        if (analysis.uniqueValues.has(value)) {
          analysis.isUnique = false;
        }
        analysis.uniqueValues.add(value);
      }
    });
  });

  // Score each field based on characteristics
  Object.entries(fieldAnalysis).forEach(([fieldName, analysis]) => {
    // High score for unique values
    if (analysis.isUnique && analysis.uniqueValues.size === records.length) {
      analysis.score += 50;
    }

    // Bonus for fields that look like IDs
    const lowerFieldName = fieldName.toLowerCase();
    if (lowerFieldName.includes('id') || 
        lowerFieldName.includes('key') || 
        lowerFieldName.includes('code') ||
        lowerFieldName.includes('sku') ||
        lowerFieldName.includes('isbn') ||
        lowerFieldName.includes('email') ||
        lowerFieldName.includes('username')) {
      analysis.score += 30;
    }

    // Bonus for certain field types
    if (analysis.fieldType === 'autoNumber' || 
        analysis.fieldType === 'barcode') {
      analysis.score += 40;
    }

    // Penalty for certain field types that shouldn't be keys
    if (analysis.fieldType === 'multipleAttachments' ||
        analysis.fieldType === 'multipleLookupValues' ||
        analysis.fieldType === 'multipleSelects' ||
        analysis.fieldType === 'checkbox' ||
        analysis.fieldType === 'rating') {
      analysis.score -= 50;
    }

    // Check if values look like IDs (alphanumeric patterns)
    const sampleValues = Array.from(analysis.uniqueValues).slice(0, 5);
    const looksLikeId = sampleValues.every(val => {
      if (typeof val !== 'string') return false;
      // Check for common ID patterns
      return /^[A-Z0-9-_]+$/i.test(val) || // Alphanumeric with dashes/underscores
             /^\d+$/.test(val) ||           // Numeric IDs
             /^[a-f0-9]{8,}$/i.test(val) || // Hex IDs (like UUIDs)
             /\S+@\S+\.\S+/.test(val);      // Email pattern
    });
    
    if (looksLikeId) {
      analysis.score += 20;
    }

    // Penalty for long text fields
    const avgLength = sampleValues
      .filter(v => typeof v === 'string')
      .reduce((sum, v) => sum + v.length, 0) / sampleValues.length;
    
    if (avgLength > 100) {
      analysis.score -= 30;
    }
  });

  // Sort fields by score and select the best candidates
  const scoredFields = Object.entries(fieldAnalysis)
    .filter(([_, analysis]) => !analysis.hasNulls && analysis.score > 0)
    .sort((a, b) => b[1].score - a[1].score)
    .map(([fieldName, analysis]) => ({
      fieldName,
      score: analysis.score,
      uniqueRatio: analysis.uniqueValues.size / records.length,
    }));

  logger.debug('Upsert field detection analysis', { scoredFields });

  // Return fields with score > 30 and high uniqueness
  const upsertFields = scoredFields
    .filter(f => f.score > 30 && f.uniqueRatio > 0.9)
    .map(f => f.fieldName);

  // If no good candidates found, try combinations
  if (upsertFields.length === 0 && scoredFields.length >= 2) {
    // Check if combination of top 2 fields creates uniqueness
    const [field1, field2] = scoredFields.slice(0, 2).map(f => f.fieldName);
    const combinedValues = new Set(
      records.map(r => `${r.fields[field1]}-${r.fields[field2]}`)
    );
    
    if (combinedValues.size === records.length) {
      logger.info('Using field combination for upsert', { fields: [field1, field2] });
      return [field1, field2];
    }
  }

  logger.info('Detected upsert fields', { upsertFields });
  return upsertFields;
}

/**
 * Validates that the specified fields can be used for upsert
 */
export function validateUpsertFields(
  records: Array<{ fields: Record<string, any> }>,
  upsertFields: string[]
): boolean {
  if (upsertFields.length === 0) {
    return false;
  }

  // Check that all records have the upsert fields
  const missingFields = records.some(record => 
    upsertFields.some(field => 
      record.fields[field] === null || 
      record.fields[field] === undefined ||
      record.fields[field] === ''
    )
  );

  if (missingFields) {
    logger.warn('Some records have null/empty upsert field values');
    return false;
  }

  // Check uniqueness
  const valueMap = new Map<string, number>();
  records.forEach(record => {
    const key = upsertFields
      .map(field => record.fields[field])
      .join('-');
    
    valueMap.set(key, (valueMap.get(key) || 0) + 1);
  });

  const duplicates = Array.from(valueMap.entries())
    .filter(([_, count]) => count > 1);

  if (duplicates.length > 0) {
    logger.warn('Duplicate values found for upsert fields', { 
      duplicates: duplicates.slice(0, 5) 
    });
    return false;
  }

  return true;
}