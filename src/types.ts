export type ProjectStatus = 
  | 'pending-evaluation'
  | 'in-restoration'
  | 'pending-drying'
  | 'pending-binding'
  | 'delivered';

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
  deliveryDate: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  notes?: string;
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
