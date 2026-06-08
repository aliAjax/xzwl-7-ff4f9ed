export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const generateProjectId = (): string => {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `GX-${year}-${random}`;
};

export const generateAssessmentId = (): string => {
  return `AS-${Date.now().toString(36)}`;
};

export const generateTemplateId = (): string => {
  return `TMPL-${Date.now().toString(36)}`;
};

export const generateImageRecordId = (): string => {
  return `IMG-${Date.now().toString(36)}`;
};

export const generateStaffId = (): string => {
  return `STF-${Date.now().toString(36)}`;
};

export const generateScheduleItemId = (): string => {
  return `SCH-${Date.now().toString(36)}`;
};

export const generateStockInId = (): string => {
  return `STK-IN-${Date.now().toString(36)}`;
};

export const generateHandoverId = (): string => {
  return `HJ-${Date.now().toString(36).toUpperCase()}`;
};

export const generateRepairReportId = (): string => {
  return `BG-${Date.now().toString(36).toUpperCase()}`;
};

export const generatePurchaseSuggestionId = (): string => {
  return `PS-${Date.now().toString(36).toUpperCase()}`;
};

export const generateSavedViewId = (): string => {
  return `VIEW-${Date.now().toString(36)}`;
};

export const generateStockInTemplateId = (): string => {
  return `STK-TMPL-${Date.now().toString(36)}`;
};
