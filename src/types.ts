export type ProjectStatus = 
  | 'pending-evaluation'
  | 'in-restoration'
  | 'pending-drying'
  | 'pending-binding'
  | 'delivered';

export type RestorationStage = 'before-restoration' | 'during-restoration' | 'after-restoration';

export type PaperCondition =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor'
  | 'very-poor';

export type DamageSeverity =
  | 'mild'
  | 'moderate'
  | 'severe'
  | 'critical';

export type PollutionType =
  | 'mold'
  | 'water-stain'
  | 'dirt'
  | 'dust'
  | 'smoke'
  | 'ink-stain'
  | 'other';

export type BindingCondition =
  | 'intact'
  | 'loose'
  | 'detached'
  | 'pages-missing'
  | 'needs-rebinding';

export const PAPER_CONDITION_LABELS: Record<PaperCondition, string> = {
  'excellent': '完好',
  'good': '轻微老化',
  'fair': '中度老化',
  'poor': '严重老化',
  'very-poor': '脆化严重',
};

export const DAMAGE_SEVERITY_LABELS: Record<DamageSeverity, string> = {
  'mild': '轻度',
  'moderate': '中度',
  'severe': '重度',
  'critical': '极重',
};

export const POLLUTION_TYPE_LABELS: Record<PollutionType, string> = {
  'mold': '霉斑',
  'water-stain': '水渍',
  'dirt': '污渍',
  'dust': '灰尘',
  'smoke': '烟熏',
  'ink-stain': '墨迹',
  'other': '其他',
};

export const BINDING_CONDITION_LABELS: Record<BindingCondition, string> = {
  'intact': '完好',
  'loose': '松动',
  'detached': '脱线',
  'pages-missing': '散页',
  'needs-rebinding': '需重装',
};

export interface MaterialEstimate {
  name: string;
  quantity: string;
  unit: string;
}

export interface RestorationAssessment {
  id: string;
  paperCondition: PaperCondition;
  damageSeverity: DamageSeverity;
  pollutionTypes: PollutionType[];
  bindingCondition: BindingCondition;
  repairSuggestion: string;
  recommendedTemplateId: string;
  estimatedDuration: string;
  materialEstimates: MaterialEstimate[];
  createdAt: string;
  completedAt: string;
}

export const DAMAGE_TYPE_TO_TEMPLATE: Record<string, string> = {
  '虫蛀': 'tpl-default-3',
  '鼠啮': 'tpl-default-3',
  '水渍': 'tpl-default-2',
  '霉斑': 'tpl-default-2',
  '酸化': 'tpl-default-1',
  '脱线': 'tpl-default-1',
  '脱页': 'tpl-default-1',
  '破损': 'tpl-default-1',
  '撕裂': 'tpl-default-3',
  '污渍': 'tpl-default-2',
  '焦脆': 'tpl-default-3',
  '粘连': 'tpl-default-2',
};

export const SEVERITY_DURATION_ESTIMATE: Record<DamageSeverity, string> = {
  'mild': '7-10天',
  'moderate': '15-20天',
  'severe': '25-35天',
  'critical': '40-60天',
};

export const MATERIAL_ESTIMATES: Record<string, MaterialEstimate[]> = {
  'tpl-default-1': [
    { name: '皮纸', quantity: '50', unit: '张' },
    { name: '浆糊', quantity: '200', unit: '克' },
    { name: '脱酸液', quantity: '500', unit: '毫升' },
    { name: '棉线', quantity: '30', unit: '米' },
  ],
  'tpl-default-2': [
    { name: '皮纸', quantity: '100', unit: '张' },
    { name: '浆糊', quantity: '400', unit: '克' },
    { name: '脱酸液', quantity: '1000', unit: '毫升' },
    { name: '清洗剂', quantity: '300', unit: '毫升' },
    { name: '杀菌剂', quantity: '200', unit: '毫升' },
    { name: '棉线', quantity: '50', unit: '米' },
  ],
  'tpl-default-3': [
    { name: '皮纸', quantity: '150', unit: '张' },
    { name: '绫绢', quantity: '10', unit: '米' },
    { name: '浆糊', quantity: '600', unit: '克' },
    { name: '脱酸液', quantity: '1000', unit: '毫升' },
    { name: '丝网', quantity: '20', unit: '米' },
    { name: '杀虫剂', quantity: '200', unit: '毫升' },
    { name: '棉线', quantity: '80', unit: '米' },
  ],
};

export interface ImageRecord {
  id: string;
  stage: RestorationStage;
  photoDate: string;
  description: string;
  imageData: string;
  fileSize: number;
  createdAt: string;
}

export const STAGE_LABELS: Record<RestorationStage, string> = {
  'before-restoration': '修复前',
  'during-restoration': '修复中',
  'after-restoration': '修复后',
};

export const STAGE_ORDER: RestorationStage[] = [
  'before-restoration',
  'during-restoration',
  'after-restoration',
];

export interface RestorationStep {
  name: string;
  completed: boolean;
  date?: string;
  note?: string;
}

export interface MaterialUsage {
  name: string;
  quantity: string;
  unit: string;
}

export interface RestorationProject {
  id: string;
  bookTitle: string;
  volumeCount: number;
  damageTypes: string[];
  restorationSteps: RestorationStep[];
  currentProgress: number;
  materialsUsed: MaterialUsage[];
  imageRecords: ImageRecord[];
  deliveryDate: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  assessment?: RestorationAssessment;
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  'pending-evaluation': '待评估',
  'in-restoration': '修复中',
  'pending-drying': '待晾干',
  'pending-binding': '待装订',
  'delivered': '已交付',
};

export const STATUS_ORDER: ProjectStatus[] = [
  'pending-evaluation',
  'in-restoration',
  'pending-drying',
  'pending-binding',
  'delivered',
];

export const DAMAGE_TYPES = [
  '虫蛀',
  '鼠啮',
  '水渍',
  '霉斑',
  '酸化',
  '脱线',
  '脱页',
  '破损',
  '撕裂',
  '污渍',
  '焦脆',
  '粘连',
];

export const DEFAULT_RESTORATION_STEPS: string[] = [
  '登记建档',
  '拍照记录',
  '除尘清洁',
  '脱酸处理',
  '修补破损',
  '托裱加固',
  '压平整理',
  '装订成册',
  '做函套',
  '拍照存档',
];

export interface RestorationTemplate {
  id: string;
  name: string;
  description: string;
  steps: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_TEMPLATES: Omit<RestorationTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: '普通线装书',
    description: '适用于一般破损的线装古籍修复',
    isDefault: true,
    steps: [
      '登记建档',
      '拍照记录',
      '除尘清洁',
      '脱酸处理',
      '修补破损',
      '托裱加固',
      '压平整理',
      '装订成册',
      '做函套',
      '拍照存档',
    ],
  },
  {
    name: '霉斑水渍本',
    description: '针对有霉斑、水渍污染的古籍修复流程',
    isDefault: false,
    steps: [
      '登记建档',
      '拍照记录',
      '除尘清洁',
      '消毒杀菌',
      '水渍清洗',
      '霉斑清除',
      '脱酸处理',
      '修补破损',
      '托裱加固',
      '压平整理',
      '装订成册',
      '做函套',
      '拍照存档',
    ],
  },
  {
    name: '虫蛀严重本',
    description: '针对虫蛀严重、纸张脆弱的古籍修复流程',
    isDefault: false,
    steps: [
      '登记建档',
      '拍照记录',
      '除尘清洁',
      '消毒杀虫',
      '脱酸处理',
      '丝网加固',
      '逐页修补',
      '托裱加固',
      '压平整理',
      '装订成册',
      '做函套',
      '拍照存档',
    ],
  },
];

export interface RestorationStaff {
  id: string;
  name: string;
  dailyWorkHours: number;
  skills: string[];
  phone?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StepWorkEstimate {
  stepName: string;
  estimatedHours: number;
  assignedStaffId: string | null;
  scheduledDate: string | null;
}

export interface ScheduleItem {
  id: string;
  projectId: string;
  projectTitle: string;
  stepName: string;
  staffId: string;
  staffName: string;
  scheduledDate: string;
  estimatedHours: number;
  completed: boolean;
  completedDate?: string;
  note?: string;
}

export interface ProjectSchedule {
  projectId: string;
  stepEstimates: StepWorkEstimate[];
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleData {
  staff: RestorationStaff[];
  schedules: ScheduleItem[];
  projectSchedules: ProjectSchedule[];
}

export const DEFAULT_STEP_HOURS: Record<string, number> = {
  '登记建档': 1,
  '拍照记录': 2,
  '除尘清洁': 2,
  '消毒杀菌': 3,
  '水渍清洗': 4,
  '霉斑清除': 4,
  '脱酸处理': 3,
  '丝网加固': 5,
  '逐页修补': 6,
  '修补破损': 5,
  '托裱加固': 4,
  '压平整理': 2,
  '装订成册': 3,
  '做函套': 4,
  '拍照存档': 2,
  '消毒杀虫': 3,
};
