/**
 * Airtable field type constants and enums
 * Reference: https://airtable.com/developers/web/api/field-model
 */

export const FIELD_TYPES = [
  "singleLineText",
  "multilineText",
  "email",
  "url",
  "phoneNumber",
  "number",
  "percent",
  "currency",
  "singleSelect",
  "multipleSelects",
  "checkbox",
  "date",
  "dateTime",
  "rating",
  "duration",
  "multipleRecordLinks",
  "multipleAttachments",
  "richText",
  "autoNumber",
  "barcode",
  "formula",
  "rollup",
  "lookup",
  "count",
  "createdTime",
  "lastModifiedTime",
  "createdBy",
  "lastModifiedBy",
  "externalSyncSource",
  "button",
  "aiText",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_COLORS = [
  "blueLight",
  "cyanLight",
  "tealLight",
  "greenLight",
  "yellowLight",
  "orangeLight",
  "redLight",
  "pinkLight",
  "purpleLight",
  "grayLight",
  "blueBright",
  "cyanBright",
  "tealBright",
  "greenBright",
  "yellowBright",
  "orangeBright",
  "redBright",
  "pinkBright",
  "purpleBright",
  "grayBright",
  "blueDark",
  "cyanDark",
  "tealDark",
  "greenDark",
  "yellowDark",
  "orangeDark",
  "redDark",
  "pinkDark",
  "purpleDark",
  "grayDark",
] as const;

export type FieldColor = (typeof FIELD_COLORS)[number];

export const CHECKBOX_ICONS = [
  "check",
  "xCheckbox",
  "star",
  "heart",
  "thumbsUp",
  "flag",
  "dot",
] as const;

export type CheckboxIcon = (typeof CHECKBOX_ICONS)[number];

export const RATING_ICONS = ["star", "heart", "thumbsUp", "flag", "dot"] as const;

export type RatingIcon = (typeof RATING_ICONS)[number];

// Field types that require options
export const FIELDS_REQUIRING_OPTIONS = [
  "singleSelect",
  "multipleSelects",
  "currency",
  "multipleRecordLinks",
  "formula",
  "rollup",
  "lookup",
  "count",
] as const;

// Field types that are read-only (cannot be created)
export const READ_ONLY_FIELD_TYPES = [
  "autoNumber",
  "createdTime",
  "lastModifiedTime",
  "createdBy",
  "lastModifiedBy",
  "externalSyncSource",
  "button",
] as const;
