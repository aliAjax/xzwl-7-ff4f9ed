export type ProjectStatus = 'pending' | 'restoring' | 'drying' | 'binding' | 'delivered';

export type SortField = 'createdAt' | 'updatedAt' | 'deliveryDate' | 'currentProgress' | 'bookTitle' | 'volumeCount';
export type SortOrder = 'asc' | 'desc';

export interface SavedView {
  id: string;
  name: string;
  searchTerm: string;
  statusFilter: ProjectStatus | 'all';
  priorityFilter: Priority | 'all';
  sortField: SortField;
  sortOrder: SortOrder;
  createdAt: string;
  updatedAt: string;
}

export type DamageType =
  | '虫蛀'
  | '霉斑'
  | '水渍'
  | '火烧'
  | '撕裂'
  | '脱页'
  | '散线'
  | '脆化'
  | '褶皱'
  | '缺损'
  | '污染'
  | '其他';

export type Priority = 'high' | 'medium' | 'low';

export type PaperCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'very_poor';
export type DamageSeverity = 'mild' | 'moderate' | 'severe' | 'critical';
export type PollutionType = 'dust' | 'mold' | 'water_stain' | 'oil' | 'ink' | 'smoke' | 'other';
export type BindingCondition = 'intact' | 'loose' | 'partial_damage' | 'needs_rebinding';

export type StockStatus = 'normal' | 'low' | 'critical' | 'stale';

export type PurchaseStatus = 'urgent' | 'need_purchase' | 'normal' | 'excess' | 'no_data';

export interface ScheduledProjectUsage {
  projectId: string;
  projectTitle: string;
  scheduledDate?: string;
  estimatedQuantity: number;
  progress: number;
}

export interface PurchaseSuggestion {
  name: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  recentConsumptionRate: number;
  recentDays: number;
  hasHistoryConsumption: boolean;
  scheduledProjectsUsage: ScheduledProjectUsage[];
  totalScheduledUsage: number;
  estimatedDaysLeft: number;
  shortageDate?: string;
  suggestedPurchaseQuantity: number;
  suggestedPurchaseDate?: string;
  status: PurchaseStatus;
  warnings: string[];
  lastCalculatedAt: string;
  calculationPeriodDays: number;
  stockSafetyBuffer: number;
  convertedToStockIn?: boolean;
  convertedAt?: string;
  stockInRecordId?: string;
}

export interface StockInDraft {
  name: string;
  unit: string;
  suggestedQuantity: number;
  quantity: number;
  unitPrice?: number;
  supplier?: string;
  note?: string;
  templateId?: string;
  date: string;
  suggestionReference?: {
    status: PurchaseStatus;
    suggestedPurchaseDate?: string;
    shortageDate?: string;
  };
}

export interface PurchaseSuggestionFilter {
  status?: PurchaseStatus;
  searchTerm?: string;
  sortBy?: 'name' | 'currentStock' | 'shortageDate' | 'suggestedQuantity' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface SavedPurchaseSuggestion {
  id: string;
  generatedAt: string;
  periodDays: number;
  suggestions: PurchaseSuggestion[];
  note?: string;
}

export interface RestorationStep {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  completedAt?: string;
  date?: string;
  estimatedDuration: number;
  notes?: string;
}

export interface MaterialUsage {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  notes?: string;
}

export interface MaterialStock {
  id: string;
  name: string;
  unit: string;
  openingStock: number;
  minimumStock: number;
  stockInRecords: StockInRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface StockInRecord {
  id: string;
  date: string;
  quantity: number;
  unitPrice?: number;
  supplier?: string;
  note?: string;
}

export type RestorationStage = 'before' | 'during' | 'after';

export const STAGE_ORDER: RestorationStage[] = ['before', 'during', 'after'];

export const STAGE_LABELS: Record<RestorationStage, string> = {
  before: '修复前',
  during: '修复中',
  after: '修复后',
};

export interface ImageRecord {
  id: string;
  projectId: string;
  stage: RestorationStage;
  fileName: string;
  fileSize: number;
  dataUrl?: string;
  imageData?: string;
  thumbnail?: string;
  photoDate: string;
  description: string;
  uploadedAt?: string;
  createdAt?: string;
  fileType?: string;
}

export interface RestorationStaff {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  skills?: string[];
  hourlyRate?: number;
  dailyWorkHours?: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleItem {
  id: string;
  projectId: string;
  projectTitle?: string;
  stepId?: string;
  stepName?: string;
  staffId: string;
  staffName?: string;
  startDate?: string;
  endDate?: string;
  scheduledDate?: string;
  estimatedHours: number;
  actualHours?: number;
  status?: 'scheduled' | 'in_progress' | 'completed';
  completed?: boolean;
  notes?: string;
}

export interface ProjectSchedule {
  projectId: string;
  totalEstimatedHours?: number;
  totalActualHours?: number;
  startDate?: string;
  endDate?: string;
  stepEstimates?: StepWorkEstimate[];
  createdAt?: string;
  updatedAt?: string;
}

export interface StepWorkEstimate {
  stepId?: string;
  stepName: string;
  estimatedHours: number;
  requiredSkills?: string[];
  priority?: number;
  assignedStaffId?: string | null;
  scheduledDate?: string | null;
}

export interface StaffWorkloadConflict {
  staffId: string;
  staffName: string;
  date: string;
  scheduledHours: number;
  maxHours: number;
  overloadHours: number;
  relatedProjects: {
    projectId: string;
    projectTitle: string;
    stepName: string;
    estimatedHours: number;
  }[];
}

export type ChangeType = 'moved_date' | 'changed_staff' | 'both' | 'unchanged';

export interface ScheduleChange {
  scheduleItemId: string;
  projectId: string;
  projectTitle: string;
  stepName: string;
  changeType: ChangeType;
  oldDate: string;
  newDate: string;
  oldStaffId: string;
  oldStaffName: string;
  newStaffId: string;
  newStaffName: string;
  estimatedHours: number;
}

export type UnresolvedConflictReason =
  | 'insufficient_staff'
  | 'delivery_too_tight'
  | 'skill_mismatch'
  | 'step_order_violation'
  | 'partial_resolution';

export interface UnresolvedConflict {
  type: 'overload' | 'overdue';
  severity: 'high' | 'medium' | 'low';
  reason: UnresolvedConflictReason;
  reasonDescription: string;
  staffId?: string;
  staffName?: string;
  date?: string;
  projectId?: string;
  projectTitle?: string;
  stepName?: string;
  scheduledHours?: number;
  maxHours?: number;
  overloadHours?: number;
  suggestedActions?: string[];
}

export interface AutoRescheduleResult {
  success: boolean;
  originalSchedules: ScheduleItem[];
  proposedSchedules: ScheduleItem[];
  changes: ScheduleChange[];
  unchangedCount: number;
  modifiedCount: number;
  totalConflictCountBefore: number;
  totalConflictCountAfter: number;
  unresolvedConflicts: UnresolvedConflict[];
  canApply: boolean;
  generatedAt: string;
  summary: {
    totalTasks: number;
    completedTasks: number;
    rescheduledTasks: number;
    conflictsResolved: number;
    conflictsRemaining: number;
    earliestDate: string;
    latestDate: string;
  };
}

export interface ScheduleData {
  staff: RestorationStaff[];
  schedules: ScheduleItem[];
  projectSchedules: ProjectSchedule[];
}

export const DAMAGE_TYPES = [
  '虫蛀', '霉斑', '水渍', '火烧', '撕裂',
  '脱页', '散线', '脆化', '褶皱', '缺损', '污染', '其他'
];

export const DEFAULT_RESTORATION_STEPS = [
  '检查评估',
  '清理除尘',
  '脱酸处理',
  '补洞修复',
  '托裱加固',
  '晾干定型',
  '装订整理',
];

declare module './types' {
  interface RestorationProject {
    imageRecords?: ImageRecord[];
  }
}

export interface InventorySummary {
  name: string;
  unit: string;
  openingStock: number;
  totalStockIn: number;
  totalUsed: number;
  currentStock: number;
  minimumStock: number;
  estimatedConsumption: number;
  estimatedDaysLeft: number;
  status: StockStatus;
  lastUsedDate: string;
  daysSinceLastUse: number;
  projectCount: number;
  relatedProjects: RestorationProject[];
  stockInRecords: StockInRecord[];
}

export interface RestorationAssessment {
  id: string;
  projectId: string;
  paperCondition: PaperCondition;
  damageSeverity: DamageSeverity;
  pollutionTypes: PollutionType[];
  bindingCondition: BindingCondition;
  repairSuggestion: string;
  recommendedTemplateId: string;
  estimatedDuration: string;
  estimatedMaterials: MaterialUsage[];
  createdAt: string;
  completedAt: string;
}

export interface RestorationTemplate {
  id: string;
  name: string;
  description: string;
  steps: string[];
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RestorationProject {
  id: string;
  bookTitle: string;
  volumeCount: number;
  damageTypes: DamageType[];
  restorationSteps: RestorationStep[];
  currentProgress: number;
  status: ProjectStatus;
  materialsUsed: MaterialUsage[];
  deliveryDate: string;
  priority: Priority;
  description: string;
  assessment?: RestorationAssessment;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  pending: '待评估',
  restoring: '修复中',
  drying: '待晾干',
  binding: '待装订',
  delivered: '已交付',
};

export const STATUS_COLORS: Record<ProjectStatus, { bg: string; text: string; border: string }> = {
  pending: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  restoring: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  drying: { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' },
  binding: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  delivered: { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' },
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: '紧急',
  medium: '普通',
  low: '低优',
};

export const DAMAGE_TYPE_OPTIONS: DamageType[] = [
  '虫蛀', '霉斑', '水渍', '火烧', '撕裂',
  '脱页', '散线', '脆化', '褶皱', '缺损', '污染', '其他'
];

export const PAPER_CONDITION_LABELS: Record<PaperCondition, string> = {
  excellent: '极佳',
  good: '良好',
  fair: '一般',
  poor: '较差',
  very_poor: '严重',
};

export const DAMAGE_SEVERITY_LABELS: Record<DamageSeverity, string> = {
  mild: '轻微',
  moderate: '中度',
  severe: '严重',
  critical: '极重',
};

export const POLLUTION_TYPE_LABELS: Record<PollutionType, string> = {
  dust: '灰尘',
  mold: '霉变',
  water_stain: '水渍',
  oil: '油污',
  ink: '墨迹',
  smoke: '烟熏',
  other: '其他',
};

export const BINDING_CONDITION_LABELS: Record<BindingCondition, string> = {
  intact: '完好',
  loose: '松动',
  partial_damage: '部分损坏',
  needs_rebinding: '需重装',
};

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  normal: '库存正常',
  low: '即将不足',
  critical: '库存不足',
  stale: '长期未用',
};

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  urgent: '紧急采购',
  need_purchase: '需要采购',
  normal: '库存充足',
  excess: '库存过剩',
  no_data: '数据不足',
};

export const DAMAGE_TYPE_TO_TEMPLATE: Record<string, string> = {
  '虫蛀': 'tmpl_insect',
  '霉斑': 'tmpl_mold',
  '水渍': 'tmpl_water',
  '火烧': 'tmpl_fire',
  '撕裂': 'tmpl_tear',
  '脱页': 'tmpl_page',
  '散线': 'tmpl_binding',
  '脆化': 'tmpl_brittle',
  '缺损': 'tmpl_missing',
};

export const SEVERITY_DURATION_ESTIMATE: Record<DamageSeverity, string> = {
  mild: '3-5 工作日',
  moderate: '7-14 工作日',
  severe: '15-30 工作日',
  critical: '30-60 工作日',
};

export interface StockInTemplate {
  id: string;
  name: string;
  supplier: string;
  unit: string;
  defaultUnitPrice?: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export const BACKUP_SCHEMA_VERSION = '1.0.0';

export interface BackupMetadata {
  schemaVersion: string;
  backupVersion: string;
  createdAt: string;
  createdAtFormatted: string;
  projectCount: number;
  totalImageRecords: number;
  totalImageSizeBytes: number;
  note?: string;
  appVersion?: string;
  statistics?: Record<string, unknown>;
}

export interface BackupData {
  metadata: BackupMetadata;
  projects: RestorationProject[];
  templates: RestorationTemplate[];
  scheduleData: ScheduleData;
  inventory: MaterialStock[];
  appSettings?: Record<string, unknown>;
  extensionFields?: Record<string, unknown>;
}

export interface DiffItem<T> {
  type?: 'added' | 'modified' | 'deleted' | 'unchanged';
  incoming?: T | null;
  existing?: T | null;
  id: string;
  entity?: T;
  existingEntity?: T;
  changeType?: 'added' | 'modified' | 'deleted' | 'unchanged';
  resolution?: ConflictResolution;
  newId?: string;
}

export interface BackupDiffResult {
  projects: DiffItem<RestorationProject>[];
  templates: DiffItem<RestorationTemplate>[];
  staff: DiffItem<RestorationStaff>[];
  schedules: DiffItem<ScheduleItem>[];
  inventory: DiffItem<MaterialStock>[];
  warnings?: string[];
  errors?: string[];
  estimatedSpaceNeeded?: number;
}

export type ConflictResolution = 'keep_existing' | 'overwrite' | 'merge';

export interface RestorePreview {
  diff: BackupDiffResult;
  conflicts: number;
  toAdd: number;
  toUpdate: number;
  toDelete: number;
  resolution: Record<string, ConflictResolution>;
  summary?: {
    totalChanges: number;
    canRestore: boolean;
    spaceCheckPassed: boolean;
  };
}

export interface HandoverCompletedStep {
  stepId: string;
  stepName: string;
  completedAt: string;
  notes?: string;
}

export interface HandoverMaterialSummary {
  name: string;
  quantity: string;
  unit: string;
  notes?: string;
}

export interface HandoverImageSummary {
  stage: string;
  count: number;
  description: string;
}

export interface HandoverRecord {
  id: string;
  projectId: string;
  bookTitle: string;
  projectNumber: string;
  volumeCount: number;
  currentStatus: ProjectStatus;
  completedSteps: HandoverCompletedStep[];
  materialsSummary: HandoverMaterialSummary[];
  imagesSummary: HandoverImageSummary[];
  handoverNotes: string;
  receiver: string;
  handoverDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportCompletedStep {
  stepId: string;
  stepName: string;
  completedAt: string;
  notes?: string;
}

export interface ReportMaterialSummary {
  name: string;
  quantity: string;
  unit: string;
  notes?: string;
}

export interface ReportImageSummary {
  stage: string;
  count: number;
  description: string;
}

export interface RepairReport {
  id: string;
  projectId: string;
  bookTitle: string;
  projectNumber: string;
  volumeCount: number;
  currentStatus: ProjectStatus;
  assessmentConclusion: string;
  damageTypes: DamageType[];
  completedSteps: ReportCompletedStep[];
  materialsSummary: ReportMaterialSummary[];
  imagesSummary: ReportImageSummary[];
  imageRecords?: ImageRecord[];
  deliveryDate: string;
  reportNotes: string;
  createdAt: string;
  updatedAt: string;
}

export const MATERIAL_ESTIMATES: Record<string, MaterialUsage[]> = {
  'tmpl_insect': [
    { id: '1', name: '修复纸', quantity: '20', unit: '张' },
    { id: '2', name: '浆糊', quantity: '100', unit: '克' },
    { id: '3', name: '毛刷', quantity: '2', unit: '个' },
  ],
  'tmpl_mold': [
    { id: '1', name: '修复纸', quantity: '30', unit: '张' },
    { id: '2', name: '清洁剂', quantity: '200', unit: '毫升' },
    { id: '3', name: '浆糊', quantity: '150', unit: '克' },
  ],
  'tmpl_water': [
    { id: '1', name: '吸水纸', quantity: '50', unit: '张' },
    { id: '2', name: '修复纸', quantity: '25', unit: '张' },
    { id: '3', name: '浆糊', quantity: '100', unit: '克' },
  ],
  'tmpl_fire': [
    { id: '1', name: '修复纸', quantity: '40', unit: '张' },
    { id: '2', name: '浆糊', quantity: '200', unit: '克' },
    { id: '3', name: '衬纸', quantity: '30', unit: '张' },
  ],
  'tmpl_tear': [
    { id: '1', name: '修复纸', quantity: '15', unit: '张' },
    { id: '2', name: '浆糊', quantity: '80', unit: '克' },
    { id: '3', name: '镊子', quantity: '1', unit: '个' },
  ],
  'tmpl_page': [
    { id: '1', name: '修复纸', quantity: '20', unit: '张' },
    { id: '2', name: '浆糊', quantity: '100', unit: '克' },
    { id: '3', name: '装订线', quantity: '5', unit: '米' },
  ],
  'tmpl_binding': [
    { id: '1', name: '装订线', quantity: '10', unit: '米' },
    { id: '2', name: '封面纸', quantity: '5', unit: '张' },
    { id: '3', name: '浆糊', quantity: '150', unit: '克' },
  ],
  'tmpl_brittle': [
    { id: '1', name: '衬纸', quantity: '50', unit: '张' },
    { id: '2', name: '修复纸', quantity: '40', unit: '张' },
    { id: '3', name: '浆糊', quantity: '200', unit: '克' },
    { id: '4', name: '柔软剂', quantity: '100', unit: '毫升' },
  ],
  'tmpl_missing': [
    { id: '1', name: '修复纸', quantity: '50', unit: '张' },
    { id: '2', name: '浆糊', quantity: '250', unit: '克' },
    { id: '3', name: '衬纸', quantity: '40', unit: '张' },
  ],
  'tmpl_default': [
    { id: '1', name: '修复纸', quantity: '20', unit: '张' },
    { id: '2', name: '浆糊', quantity: '100', unit: '克' },
    { id: '3', name: '毛刷', quantity: '1', unit: '个' },
  ],
};
