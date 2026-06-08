import type {
  RestorationProject,
  MaterialStock,
  StockInRecord,
  RestorationTemplate,
  RestorationAssessment,
  ProjectStatus,
  ImageRecord,
  ScheduleData,
  HandoverRecord,
  RestorationStep,
  MaterialUsage,
  RepairReport,
  SavedPurchaseSuggestion,
  SavedView,
  StockInTemplate,
  StaffWorkloadConflict,
  ScheduleItem,
  RestorationStaff,
  AutoRescheduleResult,
  ScheduleChange,
  UnresolvedConflict,
  UnresolvedConflictReason,
  ChangeType,
} from '../types';
import { STAGE_LABELS, PAPER_CONDITION_LABELS, DAMAGE_SEVERITY_LABELS, POLLUTION_TYPE_LABELS, BINDING_CONDITION_LABELS } from '../types';

const STORAGE_KEYS = {
  PROJECTS: 'restoration_projects',
  MATERIAL_STOCKS: 'material_stocks',
  TEMPLATES: 'restoration_templates',
  STOCK_IN_TEMPLATES: 'stock_in_templates',
  SETTINGS: 'app_settings',
  SCHEDULE: 'restoration_schedule',
  HANDOVER_RECORDS: 'handover_records',
  REPAIR_REPORTS: 'repair_reports',
  PURCHASE_SUGGESTIONS: 'purchase_suggestions',
  SAVED_VIEWS: 'project_saved_views',
};

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

export const getProjects = (): RestorationProject[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    if (!data) {
      const sampleData = generateSampleProjects();
      saveProjects(sampleData);
      return sampleData;
    }
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveProjects = (projects: RestorationProject[]): void => {
  localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
};

export const getProjectById = (id: string): RestorationProject | undefined => {
  const projects = getProjects();
  return projects.find(p => p.id === id);
};

export const addProject = (project: Omit<RestorationProject, 'id' | 'createdAt' | 'updatedAt'>): RestorationProject => {
  const projects = getProjects();
  const now = new Date().toISOString();
  const newProject: RestorationProject = {
    ...project,
    id: generateProjectId(),
    createdAt: now,
    updatedAt: now,
  };
  projects.push(newProject);
  saveProjects(projects);
  return newProject;
};

export const updateProject = (id: string, updates: Partial<RestorationProject>): { success: boolean; error?: string } => {
  try {
    const projects = getProjects();
    const index = projects.findIndex(p => p.id === id);
    if (index === -1) {
      return { success: false, error: '项目不存在' };
    }
    projects[index] = {
      ...projects[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveProjects(projects);
    return { success: true };
  } catch (error) {
    return { success: false, error: '更新失败' };
  }
};

export const updateProjectStatus = (id: string, status: ProjectStatus): { success: boolean; error?: string } => {
  return updateProject(id, { status });
};

export const updateProjectProgress = (id: string): { success: boolean; error?: string } => {
  const project = getProjectById(id);
  if (!project) {
    return { success: false, error: '项目不存在' };
  }
  const totalSteps = project.restorationSteps.length;
  const completedSteps = project.restorationSteps.filter(s => s.completed).length;
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  return updateProject(id, { currentProgress: progress });
};

export const deleteProject = (id: string): { success: boolean; error?: string } => {
  try {
    const projects = getProjects();
    const filtered = projects.filter(p => p.id !== id);
    if (filtered.length === projects.length) {
      return { success: false, error: '项目不存在' };
    }
    saveProjects(filtered);
    return { success: true };
  } catch (error) {
    return { success: false, error: '删除失败' };
  }
};

export const saveAssessmentAndAdvance = (
  projectId: string,
  assessment: RestorationAssessment,
  advanceStatus: boolean
): { success: boolean; error?: string } => {
  const project = getProjectById(projectId);
  if (!project) {
    return { success: false, error: '项目不存在' };
  }

  const updates: Partial<RestorationProject> = {
    assessment,
  };

  if (advanceStatus && project.status === 'pending') {
    updates.status = 'restoring';
  }

  return updateProject(projectId, updates);
};

export const getMaterialStocks = (): MaterialStock[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MATERIAL_STOCKS);
    if (!data) {
      const sampleData = generateSampleStock();
      saveMaterialStocks(sampleData);
      return sampleData;
    }
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveMaterialStocks = (stocks: MaterialStock[]): { success: boolean; error?: string } => {
  try {
    localStorage.setItem(STORAGE_KEYS.MATERIAL_STOCKS, JSON.stringify(stocks));
    return { success: true };
  } catch (error) {
    return { success: false, error: '保存库存数据失败' };
  }
};

export const updateStockSettings = (
  name: string,
  unit: string,
  settings: { openingStock?: number; minimumStock?: number }
): { success: boolean; error?: string } => {
  try {
    const stocks = getMaterialStocks();
    const stock = stocks.find(s => s.name === name && s.unit === unit);

    if (stock) {
      if (settings.openingStock !== undefined) stock.openingStock = settings.openingStock;
      if (settings.minimumStock !== undefined) stock.minimumStock = settings.minimumStock;
      stock.updatedAt = new Date().toISOString().split('T')[0];
    } else {
      const now = new Date().toISOString().split('T')[0];
      stocks.push({
        id: generateId(),
        name,
        unit,
        openingStock: settings.openingStock || 0,
        minimumStock: settings.minimumStock || 0,
        stockInRecords: [],
        createdAt: now,
        updatedAt: now,
      });
    }

    saveMaterialStocks(stocks);
    return { success: true };
  } catch (error) {
    return { success: false, error: '保存失败' };
  }
};

export const addStockInRecord = (
  name: string,
  unit: string,
  record: Omit<StockInRecord, 'id'>
): { success: boolean; error?: string } => {
  try {
    const stocks = getMaterialStocks();
    const stock = stocks.find(s => s.name === name && s.unit === unit);

    if (!stock) {
      return { success: false, error: '材料不存在' };
    }

    const newRecord: StockInRecord = {
      ...record,
      id: generateId(),
    };

    stock.stockInRecords.push(newRecord);
    stock.updatedAt = new Date().toISOString().split('T')[0];
    saveMaterialStocks(stocks);
    return { success: true };
  } catch (error) {
    return { success: false, error: '添加入库记录失败' };
  }
};

export const deleteStockInRecord = (
  name: string,
  unit: string,
  recordId: string
): { success: boolean; error?: string } => {
  try {
    const stocks = getMaterialStocks();
    const stock = stocks.find(s => s.name === name && s.unit === unit);

    if (!stock) {
      return { success: false, error: '材料不存在' };
    }

    stock.stockInRecords = stock.stockInRecords.filter(r => r.id !== recordId);
    stock.updatedAt = new Date().toISOString().split('T')[0];
    saveMaterialStocks(stocks);
    return { success: true };
  } catch (error) {
    return { success: false, error: '删除失败' };
  }
};

export const getTemplates = (): RestorationTemplate[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
    if (!data) {
      const defaultTemplates = generateDefaultTemplates();
      saveTemplates(defaultTemplates);
      return defaultTemplates;
    }
    return JSON.parse(data);
  } catch {
    return generateDefaultTemplates();
  }
};

export const saveTemplates = (templates: RestorationTemplate[]): void => {
  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
};

export const addTemplate = (template: Omit<RestorationTemplate, 'id' | 'createdAt' | 'updatedAt'>): RestorationTemplate => {
  const templates = getTemplates();
  const now = new Date().toISOString();
  const newTemplate: RestorationTemplate = {
    ...template,
    id: generateTemplateId(),
    createdAt: now,
    updatedAt: now,
  };
  templates.push(newTemplate);
  saveTemplates(templates);
  return newTemplate;
};

export const updateTemplate = (id: string, updates: Partial<RestorationTemplate>): { success: boolean; error?: string } => {
  try {
    const templates = getTemplates();
    const index = templates.findIndex(t => t.id === id);
    if (index === -1) {
      return { success: false, error: '模板不存在' };
    }
    templates[index] = {
      ...templates[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveTemplates(templates);
    return { success: true };
  } catch (error) {
    return { success: false, error: '更新失败' };
  }
};

export const deleteTemplate = (id: string): { success: boolean; error?: string } => {
  try {
    const templates = getTemplates();
    const filtered = templates.filter(t => t.id !== id);
    if (filtered.length === templates.length) {
      return { success: false, error: '模板不存在' };
    }
    saveTemplates(filtered);
    return { success: true };
  } catch (error) {
    return { success: false, error: '删除失败' };
  }
};

const generateDefaultTemplates = (): RestorationTemplate[] => {
  const now = new Date().toISOString();
  return [
    {
      id: 'tmpl_insect',
      name: '虫蛀修复模板',
      description: '适用于虫蛀破损的古籍修复流程',
      steps: ['除尘清理', '消毒灭菌', '补洞修复', '托裱加固', '晾干定型', '装订整理'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tmpl_mold',
      name: '霉斑修复模板',
      description: '适用于发霉古籍的修复流程',
      steps: ['除尘清理', '去霉处理', '清洗脱酸', '补洞修复', '托裱加固', '晾干定型', '装订整理'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tmpl_water',
      name: '水渍修复模板',
      description: '适用于水湿古籍的修复流程',
      steps: ['吸水处理', '清洗脱酸', '补洞修复', '托裱加固', '晾干定型', '压平整理', '装订'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tmpl_fire',
      name: '火烧修复模板',
      description: '适用于火烧破损的古籍修复流程',
      steps: ['清理灰烬', '脆弱页处理', '补洞修复', '托裱加固', '衬纸补强', '晾干定型', '装订整理'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tmpl_tear',
      name: '撕裂修复模板',
      description: '适用于撕裂破损的古籍修复流程',
      steps: ['清理除尘', '拼接对齐', '补缀修复', '托裱加固', '晾干压平', '装订整理'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tmpl_page',
      name: '脱页修复模板',
      description: '适用于书页脱落的修复流程',
      steps: ['书页整理', '补洞修复', '托裱加固', '装订定位', '重新装订'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tmpl_binding',
      name: '装订修复模板',
      description: '适用于线装松脱的修复流程',
      steps: ['拆解检查', '书页整理', '补洞修复', '重新装订', '封面修复'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tmpl_brittle',
      name: '脆化修复模板',
      description: '适用于纸张脆化的古籍修复流程',
      steps: ['软化处理', '脱酸处理', '衬纸加固', '托裱修复', '晾干定型', '装订整理'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tmpl_missing',
      name: '缺损修复模板',
      description: '适用于页面缺损的古籍修复流程',
      steps: ['配纸选料', '描样补写', '托裱修复', '做旧处理', '装订整理'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tmpl_default',
      name: '标准修复模板',
      description: '通用的古籍修复流程',
      steps: ['检查评估', '清理除尘', '脱酸处理', '补洞修复', '托裱加固', '晾干定型', '装订整理'],
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
};

const generateSampleProjects = (): RestorationProject[] => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const createSteps = (names: string[], completedCount: number) =>
    names.map((name, i) => ({
      id: `step-${i}`,
      name,
      description: `执行${name}操作`,
      completed: i < completedCount,
      completedAt: i < completedCount ? addDays(now, -10 + i) : undefined,
      estimatedDuration: 2,
      notes: '',
    }));

  return [
    {
      id: 'GX-2024-ABC123',
      bookTitle: '永乐大典',
      volumeCount: 3,
      damageTypes: ['虫蛀', '霉斑'],
      restorationSteps: createSteps(['检查评估', '清理除尘', '脱酸处理', '补洞修复', '托裱加固', '晾干定型'], 3),
      currentProgress: 50,
      status: 'restoring',
      materialsUsed: [
        { id: 'm1', name: '修复纸', quantity: '60', unit: '张' },
        { id: 'm2', name: '浆糊', quantity: '200', unit: '克' },
        { id: 'm3', name: '清洁剂', quantity: '150', unit: '毫升' },
      ],
      deliveryDate: addDays(now, 30),
      priority: 'high',
      description: '明代皇家大典，虫蛀严重，需紧急修复',
      createdAt: addDays(now, -15),
      updatedAt: addDays(now, -2),
      notes: '珍贵古籍，需特别注意',
    },
    {
      id: 'GX-2024-DEF456',
      bookTitle: '本草纲目',
      volumeCount: 8,
      damageTypes: ['水渍', '脱页'],
      restorationSteps: createSteps(['检查评估', '吸水处理', '清洗脱酸', '补洞修复', '托裱加固'], 1),
      currentProgress: 20,
      status: 'pending',
      materialsUsed: [
        { id: 'm1', name: '吸水纸', quantity: '100', unit: '张' },
        { id: 'm2', name: '修复纸', quantity: '50', unit: '张' },
      ],
      deliveryDate: addDays(now, 45),
      priority: 'medium',
      description: '清代刻本，水湿后脱页严重',
      createdAt: addDays(now, -10),
      updatedAt: addDays(now, -5),
    },
    {
      id: 'GX-2024-GHI789',
      bookTitle: '论语集注',
      volumeCount: 2,
      damageTypes: ['散线', '撕裂'],
      restorationSteps: createSteps(['检查评估', '拆解检查', '书页整理', '补缀修复', '重新装订'], 4),
      currentProgress: 80,
      status: 'binding',
      materialsUsed: [
        { id: 'm1', name: '装订线', quantity: '15', unit: '米' },
        { id: 'm2', name: '修复纸', quantity: '20', unit: '张' },
        { id: 'm3', name: '浆糊', quantity: '100', unit: '克' },
      ],
      deliveryDate: addDays(now, 3),
      priority: 'high',
      description: '宋版论语，线装松脱，书页撕裂',
      createdAt: addDays(now, -20),
      updatedAt: addDays(now, -1),
    },
    {
      id: 'GX-2024-JKL012',
      bookTitle: '史记',
      volumeCount: 5,
      damageTypes: ['脆化', '缺损'],
      restorationSteps: createSteps(['检查评估', '软化处理', '脱酸处理', '衬纸加固', '托裱修复'], 2),
      currentProgress: 40,
      status: 'restoring',
      materialsUsed: [
        { id: 'm1', name: '衬纸', quantity: '100', unit: '张' },
        { id: 'm2', name: '修复纸', quantity: '80', unit: '张' },
        { id: 'm3', name: '柔软剂', quantity: '200', unit: '毫升' },
      ],
      deliveryDate: addDays(now, 60),
      priority: 'medium',
      description: '纸张严重脆化，多页缺损',
      createdAt: addDays(now, -25),
      updatedAt: addDays(now, -3),
    },
    {
      id: 'GX-2024-MNO345',
      bookTitle: '唐诗三百首',
      volumeCount: 1,
      damageTypes: ['霉斑', '污染'],
      restorationSteps: createSteps(['检查评估', '清理除尘', '去霉处理', '清洗脱酸', '托裱加固', '晾干定型'], 6),
      currentProgress: 100,
      status: 'delivered',
      materialsUsed: [
        { id: 'm1', name: '修复纸', quantity: '30', unit: '张' },
        { id: 'm2', name: '清洁剂', quantity: '100', unit: '毫升' },
      ],
      deliveryDate: addDays(now, -5),
      priority: 'low',
      description: '民国版本，霉斑污染',
      createdAt: addDays(now, -40),
      updatedAt: addDays(now, -6),
    },
    {
      id: 'GX-2024-PQR678',
      bookTitle: '资治通鉴',
      volumeCount: 12,
      damageTypes: ['火烧', '脆化'],
      restorationSteps: createSteps(['检查评估', '清理灰烬', '脆弱页处理', '补洞修复'], 1),
      currentProgress: 25,
      status: 'restoring',
      materialsUsed: [
        { id: 'm1', name: '修复纸', quantity: '200', unit: '张' },
        { id: 'm2', name: '衬纸', quantity: '150', unit: '张' },
        { id: 'm3', name: '浆糊', quantity: '500', unit: '克' },
      ],
      deliveryDate: addDays(now, 90),
      priority: 'high',
      description: '明版通鉴，火灾后边缘焦化，急需抢救',
      createdAt: addDays(now, -5),
      updatedAt: today,
    },
    {
      id: 'GX-2024-STU901',
      bookTitle: '红楼梦',
      volumeCount: 4,
      damageTypes: ['虫蛀', '褶皱'],
      restorationSteps: createSteps(['检查评估', '除尘清理', '消毒灭菌', '补洞修复', '托裱加固'], 3),
      currentProgress: 60,
      status: 'drying',
      materialsUsed: [
        { id: 'm1', name: '修复纸', quantity: '80', unit: '张' },
        { id: 'm2', name: '浆糊', quantity: '250', unit: '克' },
      ],
      deliveryDate: addDays(now, 15),
      priority: 'medium',
      description: '清代抄本，虫蛀严重，褶皱较多',
      createdAt: addDays(now, -30),
      updatedAt: addDays(now, -4),
    },
    {
      id: 'GX-2024-VWX234',
      bookTitle: '山海经',
      volumeCount: 3,
      damageTypes: ['脱页', '缺损'],
      restorationSteps: createSteps(['检查评估', '配纸选料', '描样补写', '托裱修复'], 0),
      currentProgress: 0,
      status: 'pending',
      materialsUsed: [],
      deliveryDate: addDays(now, 50),
      priority: 'low',
      description: '明刻本，多页缺损脱页',
      createdAt: addDays(now, -3),
      updatedAt: addDays(now, -3),
    },
  ];
};

const generateSampleStock = (): MaterialStock[] => {
  const now = new Date().toISOString().split('T')[0];
  return [
    {
      id: 'stk-1',
      name: '修复纸',
      unit: '张',
      openingStock: 500,
      minimumStock: 100,
      stockInRecords: [
        { id: 'sr1', date: '2024-01-15', quantity: 200, unitPrice: 5, supplier: '宣纸厂' },
        { id: 'sr2', date: '2024-03-20', quantity: 300, unitPrice: 5.5, supplier: '宣纸厂' },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'stk-2',
      name: '浆糊',
      unit: '克',
      openingStock: 1000,
      minimumStock: 300,
      stockInRecords: [
        { id: 'sr3', date: '2024-02-10', quantity: 1000, unitPrice: 0.5, supplier: '自制' },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'stk-3',
      name: '清洁剂',
      unit: '毫升',
      openingStock: 500,
      minimumStock: 200,
      stockInRecords: [
        { id: 'sr4', date: '2024-01-25', quantity: 500, unitPrice: 2, supplier: '化工商店' },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'stk-4',
      name: '衬纸',
      unit: '张',
      openingStock: 300,
      minimumStock: 80,
      stockInRecords: [
        { id: 'sr5', date: '2024-02-28', quantity: 300, unitPrice: 3, supplier: '宣纸厂' },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'stk-5',
      name: '装订线',
      unit: '米',
      openingStock: 200,
      minimumStock: 50,
      stockInRecords: [
        { id: 'sr6', date: '2024-03-05', quantity: 200, unitPrice: 1, supplier: '文具店' },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'stk-6',
      name: '吸水纸',
      unit: '张',
      openingStock: 400,
      minimumStock: 100,
      stockInRecords: [
        { id: 'sr7', date: '2024-03-15', quantity: 400, unitPrice: 2, supplier: '纸业公司' },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
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

export const getDefaultStepHours = (stepName: string): number => {
  const defaultHours: Record<string, number> = {
    '检查评估': 2,
    '清理除尘': 1,
    '脱酸处理': 3,
    '补洞修复': 4,
    '托裱加固': 3,
    '晾干定型': 2,
    '装订整理': 2,
    '消毒灭菌': 1,
    '去霉处理': 2,
    '清洗脱酸': 2,
    '吸水处理': 1,
    '压平整理': 1,
    '清理灰烬': 1,
    '脆弱页处理': 3,
    '衬纸补强': 2,
    '拼接对齐': 2,
    '补缀修复': 2,
    '晾干压平': 1,
    '书页整理': 1,
    '装订定位': 1,
    '重新装订': 2,
    '拆解检查': 1,
    '封面修复': 2,
    '软化处理': 2,
    '配纸选料': 2,
    '描样补写': 4,
    '做旧处理': 2,
  };
  return defaultHours[stepName] || 2;
};

export const getScheduleData = (): ScheduleData => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SCHEDULE);
    if (!data) {
      return {
        staff: [],
        schedules: [],
        projectSchedules: [],
      };
    }
    return JSON.parse(data);
  } catch {
    return {
      staff: [],
      schedules: [],
      projectSchedules: [],
    };
  }
};

export const saveScheduleData = (data: ScheduleData): { success: boolean; error?: string } => {
  try {
    localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(data));
    return { success: true };
  } catch (error) {
    return { success: false, error: '保存排班数据失败' };
  }
};

export const updateProjectImageRecords = (
  projectId: string,
  records: ImageRecord[]
): { success: boolean; error?: string } => {
  return updateProject(projectId, { imageRecords: records });
};

export const generateStockInId = (): string => {
  return `STK-IN-${Date.now().toString(36)}`;
};

export const generateHandoverId = (): string => {
  return `HJ-${Date.now().toString(36).toUpperCase()}`;
};

export const getHandoverRecords = (): HandoverRecord[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HANDOVER_RECORDS);
    if (!data) {
      return [];
    }
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveHandoverRecords = (records: HandoverRecord[]): { success: boolean; error?: string } => {
  try {
    localStorage.setItem(STORAGE_KEYS.HANDOVER_RECORDS, JSON.stringify(records));
    return { success: true };
  } catch (error) {
    return { success: false, error: '保存交接单数据失败' };
  }
};

export const getHandoverRecordsByProjectId = (projectId: string): HandoverRecord[] => {
  const records = getHandoverRecords();
  return records.filter(r => r.projectId === projectId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const getHandoverRecordById = (id: string): HandoverRecord | undefined => {
  const records = getHandoverRecords();
  return records.find(r => r.id === id);
};

export const generateHandoverFromProject = (project: RestorationProject): Omit<HandoverRecord, 'id' | 'createdAt' | 'updatedAt'> => {
  const completedSteps = project.restorationSteps
    .filter((step: RestorationStep) => step.completed)
    .map((step: RestorationStep) => ({
      stepId: step.id,
      stepName: step.name,
      completedAt: step.completedAt || step.date || new Date().toISOString().split('T')[0],
      notes: step.notes,
    }));

  const materialsSummary = project.materialsUsed.map((m: MaterialUsage) => ({
    name: m.name,
    quantity: m.quantity,
    unit: m.unit,
    notes: m.notes,
  }));

  const imageRecords = project.imageRecords || [];
  const imagesByStage = new Map<string, number>();
  imageRecords.forEach(img => {
    const count = imagesByStage.get(img.stage) || 0;
    imagesByStage.set(img.stage, count + 1);
  });

  const imagesSummary = Array.from(imagesByStage.entries()).map(([stage, count]) => ({
    stage,
    count,
    description: `${STAGE_LABELS[stage as keyof typeof STAGE_LABELS] || stage}影像记录共 ${count} 张`,
  }));

  return {
    projectId: project.id,
    bookTitle: project.bookTitle,
    projectNumber: project.id,
    volumeCount: project.volumeCount,
    currentStatus: project.status,
    completedSteps,
    materialsSummary,
    imagesSummary,
    handoverNotes: '',
    receiver: '',
    handoverDate: new Date().toISOString().split('T')[0],
  };
};

export const createHandoverRecord = (
  data: Omit<HandoverRecord, 'id' | 'createdAt' | 'updatedAt'>
): HandoverRecord => {
  const records = getHandoverRecords();
  const now = new Date().toISOString();
  const newRecord: HandoverRecord = {
    ...data,
    id: generateHandoverId(),
    createdAt: now,
    updatedAt: now,
  };
  records.push(newRecord);
  saveHandoverRecords(records);
  return newRecord;
};

export const updateHandoverRecord = (
  id: string,
  updates: Partial<HandoverRecord>
): { success: boolean; error?: string; record?: HandoverRecord } => {
  try {
    const records = getHandoverRecords();
    const index = records.findIndex(r => r.id === id);
    if (index === -1) {
      return { success: false, error: '交接单不存在' };
    }
    records[index] = {
      ...records[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveHandoverRecords(records);
    return { success: true, record: records[index] };
  } catch (error) {
    return { success: false, error: '更新失败' };
  }
};

export const deleteHandoverRecord = (id: string): { success: boolean; error?: string } => {
  try {
    const records = getHandoverRecords();
    const filtered = records.filter(r => r.id !== id);
    if (filtered.length === records.length) {
      return { success: false, error: '交接单不存在' };
    }
    saveHandoverRecords(filtered);
    return { success: true };
  } catch (error) {
    return { success: false, error: '删除失败' };
  }
};

export const generateRepairReportId = (): string => {
  return `BG-${Date.now().toString(36).toUpperCase()}`;
};

export const getRepairReports = (): RepairReport[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.REPAIR_REPORTS);
    if (!data) {
      return [];
    }
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveRepairReports = (reports: RepairReport[]): { success: boolean; error?: string } => {
  try {
    localStorage.setItem(STORAGE_KEYS.REPAIR_REPORTS, JSON.stringify(reports));
    return { success: true };
  } catch (error) {
    return { success: false, error: '保存修复报告数据失败' };
  }
};

export const getRepairReportsByProjectId = (projectId: string): RepairReport[] => {
  const reports = getRepairReports();
  return reports.filter(r => r.projectId === projectId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const getRepairReportById = (id: string): RepairReport | undefined => {
  const reports = getRepairReports();
  return reports.find(r => r.id === id);
};

export const generateAssessmentConclusion = (project: RestorationProject): string => {
  if (!project.assessment) {
    return '项目尚未进行修复评估。';
  }

  const { assessment } = project;
  const parts: string[] = [];

  parts.push(`纸张状态：${PAPER_CONDITION_LABELS[assessment.paperCondition] || assessment.paperCondition}`);
  parts.push(`破损严重度：${DAMAGE_SEVERITY_LABELS[assessment.damageSeverity] || assessment.damageSeverity}`);

  if (assessment.pollutionTypes && assessment.pollutionTypes.length > 0) {
    const pollutionLabels = assessment.pollutionTypes.map(
      p => POLLUTION_TYPE_LABELS[p] || p
    ).join('、');
    parts.push(`污染类型：${pollutionLabels}`);
  }

  parts.push(`装订状况：${BINDING_CONDITION_LABELS[assessment.bindingCondition] || assessment.bindingCondition}`);
  parts.push(`预计工期：${assessment.estimatedDuration}`);

  if (assessment.repairSuggestion) {
    parts.push(`修复建议：${assessment.repairSuggestion}`);
  }

  return parts.join('；');
};

export const generateRepairReportFromProject = (project: RestorationProject): Omit<RepairReport, 'id' | 'createdAt' | 'updatedAt'> => {
  const completedSteps = project.restorationSteps
    .filter((step: RestorationStep) => step.completed)
    .map((step: RestorationStep) => ({
      stepId: step.id,
      stepName: step.name,
      completedAt: step.completedAt || step.date || new Date().toISOString().split('T')[0],
      notes: step.notes,
    }));

  const materialsSummary = project.materialsUsed.map((m: MaterialUsage) => ({
    name: m.name,
    quantity: m.quantity,
    unit: m.unit,
    notes: m.notes,
  }));

  const imageRecords = project.imageRecords || [];
  const imagesByStage = new Map<string, number>();
  imageRecords.forEach(img => {
    const count = imagesByStage.get(img.stage) || 0;
    imagesByStage.set(img.stage, count + 1);
  });

  const imagesSummary = Array.from(imagesByStage.entries()).map(([stage, count]) => ({
    stage,
    count,
    description: `${STAGE_LABELS[stage as keyof typeof STAGE_LABELS] || stage}影像记录共 ${count} 张`,
  }));

  return {
    projectId: project.id,
    bookTitle: project.bookTitle,
    projectNumber: project.id,
    volumeCount: project.volumeCount,
    currentStatus: project.status,
    assessmentConclusion: generateAssessmentConclusion(project),
    damageTypes: project.damageTypes,
    completedSteps,
    materialsSummary,
    imagesSummary,
    imageRecords: project.imageRecords || [],
    deliveryDate: project.deliveryDate,
    reportNotes: '',
  };
};

export const createRepairReport = (
  data: Omit<RepairReport, 'id' | 'createdAt' | 'updatedAt'>
): RepairReport => {
  const reports = getRepairReports();
  const now = new Date().toISOString();
  const newReport: RepairReport = {
    ...data,
    id: generateRepairReportId(),
    createdAt: now,
    updatedAt: now,
  };
  reports.push(newReport);
  saveRepairReports(reports);
  return newReport;
};

export const updateRepairReport = (
  id: string,
  updates: Partial<RepairReport>
): { success: boolean; error?: string; report?: RepairReport } => {
  try {
    const reports = getRepairReports();
    const index = reports.findIndex(r => r.id === id);
    if (index === -1) {
      return { success: false, error: '修复报告不存在' };
    }
    reports[index] = {
      ...reports[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveRepairReports(reports);
    return { success: true, report: reports[index] };
  } catch (error) {
    return { success: false, error: '更新失败' };
  }
};

export const deleteRepairReport = (id: string): { success: boolean; error?: string } => {
  try {
    const reports = getRepairReports();
    const filtered = reports.filter(r => r.id !== id);
    if (filtered.length === reports.length) {
      return { success: false, error: '修复报告不存在' };
    }
    saveRepairReports(filtered);
    return { success: true };
  } catch (error) {
    return { success: false, error: '删除失败' };
  }
};

export const getStorageRemainingSpace = (): { usedBytes: number; remainingBytes: number; percentageUsed: number } => {
  let usedBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value) {
        usedBytes += new Blob([key + value]).size;
      }
    }
  }
  const estimatedQuota = 5 * 1024 * 1024;
  const remainingBytes = Math.max(0, estimatedQuota - usedBytes);
  const percentageUsed = (usedBytes / estimatedQuota) * 100;
  return { usedBytes, remainingBytes, percentageUsed };
};

export const generatePurchaseSuggestionId = (): string => {
  return `PS-${Date.now().toString(36).toUpperCase()}`;
};

export const getPurchaseSuggestions = (): SavedPurchaseSuggestion[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PURCHASE_SUGGESTIONS);
    if (!data) {
      return [];
    }
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const savePurchaseSuggestions = (
  suggestions: SavedPurchaseSuggestion[]
): { success: boolean; error?: string } => {
  try {
    localStorage.setItem(STORAGE_KEYS.PURCHASE_SUGGESTIONS, JSON.stringify(suggestions));
    return { success: true };
  } catch (error) {
    return { success: false, error: '保存采购建议失败' };
  }
};

export const addPurchaseSuggestion = (
  suggestion: Omit<SavedPurchaseSuggestion, 'id' | 'generatedAt'>
): SavedPurchaseSuggestion => {
  const suggestions = getPurchaseSuggestions();
  const now = new Date().toISOString();
  const newSuggestion: SavedPurchaseSuggestion = {
    ...suggestion,
    id: generatePurchaseSuggestionId(),
    generatedAt: now,
  };
  suggestions.unshift(newSuggestion);
  savePurchaseSuggestions(suggestions);
  return newSuggestion;
};

export const deletePurchaseSuggestion = (
  id: string
): { success: boolean; error?: string } => {
  try {
    const suggestions = getPurchaseSuggestions();
    const filtered = suggestions.filter(s => s.id !== id);
    if (filtered.length === suggestions.length) {
      return { success: false, error: '采购建议不存在' };
    }
    savePurchaseSuggestions(filtered);
    return { success: true };
  } catch (error) {
    return { success: false, error: '删除失败' };
  }
};

export const getPurchaseSuggestionById = (
  id: string
): SavedPurchaseSuggestion | undefined => {
  const suggestions = getPurchaseSuggestions();
  return suggestions.find(s => s.id === id);
};

export const updatePurchaseSuggestionNote = (
  id: string,
  note: string
): { success: boolean; error?: string; suggestion?: SavedPurchaseSuggestion } => {
  try {
    const suggestions = getPurchaseSuggestions();
    const index = suggestions.findIndex(s => s.id === id);
    if (index === -1) {
      return { success: false, error: '采购建议不存在' };
    }
    suggestions[index] = {
      ...suggestions[index],
      note,
    };
    savePurchaseSuggestions(suggestions);
    return { success: true, suggestion: suggestions[index] };
  } catch (error) {
    return { success: false, error: '更新失败' };
  }
};

export const generateSavedViewId = (): string => {
  return `VIEW-${Date.now().toString(36)}`;
};

export const getSavedViews = (): SavedView[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SAVED_VIEWS);
    if (!data) {
      return [];
    }
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveSavedViews = (views: SavedView[]): { success: boolean; error?: string } => {
  try {
    localStorage.setItem(STORAGE_KEYS.SAVED_VIEWS, JSON.stringify(views));
    return { success: true };
  } catch (error) {
    return { success: false, error: '保存视图失败' };
  }
};

export const addSavedView = (
  data: Omit<SavedView, 'id' | 'createdAt' | 'updatedAt'>
): { success: boolean; error?: string; view?: SavedView } => {
  try {
    const views = getSavedViews();
    const now = new Date().toISOString();
    const newView: SavedView = {
      ...data,
      id: generateSavedViewId(),
      createdAt: now,
      updatedAt: now,
    };
    views.push(newView);
    saveSavedViews(views);
    return { success: true, view: newView };
  } catch (error) {
    return { success: false, error: '添加视图失败' };
  }
};

export const updateSavedView = (
  id: string,
  updates: Partial<Omit<SavedView, 'id' | 'createdAt'>>
): { success: boolean; error?: string; view?: SavedView } => {
  try {
    const views = getSavedViews();
    const index = views.findIndex(v => v.id === id);
    if (index === -1) {
      return { success: false, error: '视图不存在' };
    }
    views[index] = {
      ...views[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveSavedViews(views);
    return { success: true, view: views[index] };
  } catch (error) {
    return { success: false, error: '更新视图失败' };
  }
};

export const deleteSavedView = (id: string): { success: boolean; error?: string } => {
  try {
    const views = getSavedViews();
    const filtered = views.filter(v => v.id !== id);
    if (filtered.length === views.length) {
      return { success: false, error: '视图不存在' };
    }
    saveSavedViews(filtered);
    return { success: true };
  } catch (error) {
    return { success: false, error: '删除视图失败' };
  }
};

export const getSavedViewById = (id: string): SavedView | undefined => {
  const views = getSavedViews();
  return views.find(v => v.id === id);
};

export const generateStockInTemplateId = (): string => {
  return `STK-TMPL-${Date.now().toString(36)}`;
};

export const getStockInTemplates = (): StockInTemplate[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.STOCK_IN_TEMPLATES);
    if (!data) {
      const sampleData = generateSampleStockInTemplates();
      saveStockInTemplates(sampleData);
      return sampleData;
    }
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveStockInTemplates = (templates: StockInTemplate[]): { success: boolean; error?: string } => {
  try {
    localStorage.setItem(STORAGE_KEYS.STOCK_IN_TEMPLATES, JSON.stringify(templates));
    return { success: true };
  } catch (error) {
    return { success: false, error: '保存入库模板失败' };
  }
};

export const addStockInTemplate = (
  template: Omit<StockInTemplate, 'id' | 'createdAt' | 'updatedAt'>
): { success: boolean; error?: string; template?: StockInTemplate } => {
  try {
    const templates = getStockInTemplates();
    const now = new Date().toISOString();
    const newTemplate: StockInTemplate = {
      ...template,
      id: generateStockInTemplateId(),
      createdAt: now,
      updatedAt: now,
    };
    templates.push(newTemplate);
    saveStockInTemplates(templates);
    return { success: true, template: newTemplate };
  } catch (error) {
    return { success: false, error: '添加入库模板失败' };
  }
};

export const updateStockInTemplate = (
  id: string,
  updates: Partial<Omit<StockInTemplate, 'id' | 'createdAt'>>
): { success: boolean; error?: string; template?: StockInTemplate } => {
  try {
    const templates = getStockInTemplates();
    const index = templates.findIndex(t => t.id === id);
    if (index === -1) {
      return { success: false, error: '入库模板不存在' };
    }
    templates[index] = {
      ...templates[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveStockInTemplates(templates);
    return { success: true, template: templates[index] };
  } catch (error) {
    return { success: false, error: '更新入库模板失败' };
  }
};

export const deleteStockInTemplate = (id: string): { success: boolean; error?: string } => {
  try {
    const templates = getStockInTemplates();
    const filtered = templates.filter(t => t.id !== id);
    if (filtered.length === templates.length) {
      return { success: false, error: '入库模板不存在' };
    }
    saveStockInTemplates(filtered);
    return { success: true };
  } catch (error) {
    return { success: false, error: '删除入库模板失败' };
  }
};

export const getStockInTemplateById = (id: string): StockInTemplate | undefined => {
  const templates = getStockInTemplates();
  return templates.find(t => t.id === id);
};

const generateSampleStockInTemplates = (): StockInTemplate[] => {
  const now = new Date().toISOString();
  return [
    {
      id: 'stk-tmpl-1',
      name: '修复纸',
      supplier: '安徽宣纸厂',
      unit: '张',
      defaultUnitPrice: 5.5,
      note: '常用修复用纸，规格30×40cm',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'stk-tmpl-2',
      name: '浆糊',
      supplier: '自制',
      unit: '克',
      defaultUnitPrice: 0.5,
      note: '小麦淀粉自制浆糊',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'stk-tmpl-3',
      name: '清洁剂',
      supplier: '化工商店',
      unit: '毫升',
      defaultUnitPrice: 2,
      note: '专业纸张清洁剂',
      createdAt: now,
      updatedAt: now,
    },
  ];
};

export const detectStaffWorkloadConflicts = (
  staff: RestorationStaff[],
  schedules: ScheduleItem[]
): StaffWorkloadConflict[] => {
  const conflicts: StaffWorkloadConflict[] = [];
  const activeSchedules = schedules.filter(s => !s.completed);

  const dateStaffMap = new Map<string, Map<string, ScheduleItem[]>>();

  activeSchedules.forEach(schedule => {
    if (!schedule.scheduledDate) return;
    const date = schedule.scheduledDate;
    if (!dateStaffMap.has(date)) {
      dateStaffMap.set(date, new Map());
    }
    const staffMap = dateStaffMap.get(date)!;
    if (!staffMap.has(schedule.staffId)) {
      staffMap.set(schedule.staffId, []);
    }
    staffMap.get(schedule.staffId)!.push(schedule);
  });

  dateStaffMap.forEach((staffMap, date) => {
    staffMap.forEach((daySchedules, staffId) => {
      const staffMember = staff.find(s => s.id === staffId);
      if (!staffMember) return;

      const maxHours = staffMember.dailyWorkHours || 8;
      const scheduledHours = daySchedules.reduce((sum, s) => sum + s.estimatedHours, 0);

      if (scheduledHours > maxHours) {
        conflicts.push({
          staffId,
          staffName: staffMember.name,
          date,
          scheduledHours,
          maxHours,
          overloadHours: Math.round((scheduledHours - maxHours) * 10) / 10,
          relatedProjects: daySchedules.map(s => ({
            projectId: s.projectId,
            projectTitle: s.projectTitle || '',
            stepName: s.stepName || '',
            estimatedHours: s.estimatedHours,
          })),
        });
      }
    });
  });

  return conflicts.sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
};

export const getStaffConflicts = (
  staffId: string,
  staff: RestorationStaff[],
  schedules: ScheduleItem[]
): StaffWorkloadConflict[] => {
  return detectStaffWorkloadConflicts(staff, schedules)
    .filter(c => c.staffId === staffId);
};

export const getProjectConflicts = (
  projectId: string,
  staff: RestorationStaff[],
  schedules: ScheduleItem[]
): StaffWorkloadConflict[] => {
  return detectStaffWorkloadConflicts(staff, schedules)
    .filter(c => c.relatedProjects.some(p => p.projectId === projectId));
};

export const getDateConflicts = (
  date: string,
  staff: RestorationStaff[],
  schedules: ScheduleItem[]
): StaffWorkloadConflict[] => {
  return detectStaffWorkloadConflicts(staff, schedules)
    .filter(c => c.date === date);
};

const hasMatchingSkill = (staffMember: RestorationStaff, stepName: string): boolean => {
  const skills = staffMember.skills || [];
  if (skills.length === 0) return true;
  const stepSkillMap: Record<string, string[]> = {
    '检查评估': ['检查评估', '评估'],
    '清理除尘': ['清理除尘', '清洁'],
    '脱酸处理': ['脱酸处理', '化学处理'],
    '补洞修复': ['补洞修复', '修复'],
    '托裱加固': ['托裱加固', '托裱'],
    '晾干定型': ['晾干定型', '干燥'],
    '装订整理': ['装订整理', '装订'],
    '消毒灭菌': ['消毒灭菌', '消毒'],
    '去霉处理': ['去霉处理', '清洁'],
    '清洗脱酸': ['清洗脱酸', '化学处理'],
    '吸水处理': ['吸水处理', '干燥'],
    '压平整理': ['压平整理', '整理'],
    '清理灰烬': ['清理除尘', '清洁'],
    '脆弱页处理': ['补洞修复', '修复'],
    '衬纸补强': ['托裱加固', '托裱'],
    '拼接对齐': ['补缀修复', '修复'],
    '补缀修复': ['补缀修复', '修复'],
    '晾干压平': ['晾干定型', '干燥'],
    '书页整理': ['书页整理', '整理'],
    '装订定位': ['装订整理', '装订'],
    '重新装订': ['装订整理', '装订'],
    '拆解检查': ['拆解检查', '检查评估'],
    '封面修复': ['封面修复', '修复'],
    '软化处理': ['软化处理', '化学处理'],
    '配纸选料': ['配纸选料', '修复'],
    '描样补写': ['描样补写', '修复'],
    '做旧处理': ['做旧处理', '修复'],
  };
  const requiredSkills = stepSkillMap[stepName] || [stepName];
  return requiredSkills.some(rs => skills.some(s => s.includes(rs) || rs.includes(s)));
};

const getStepIndex = (project: RestorationProject, stepName: string): number => {
  return project.restorationSteps.findIndex(s => s.name === stepName);
};

const getEarliestPossibleDate = (
  project: RestorationProject,
  stepIndex: number,
  today: Date,
  completedSteps: Set<string>
): Date => {
  let earliestDate = new Date(today);
  for (let i = 0; i < stepIndex; i++) {
    const step = project.restorationSteps[i];
    if (step.completed) {
      if (step.date) {
        const stepDate = new Date(step.date);
        stepDate.setDate(stepDate.getDate() + 1);
        if (stepDate > earliestDate) {
          earliestDate = new Date(stepDate);
        }
      }
      completedSteps.add(step.name);
    }
  }
  return earliestDate;
};

const getLatestPossibleDate = (
  project: RestorationProject,
  stepIndex: number,
  totalSteps: number
): Date => {
  const deliveryDate = new Date(project.deliveryDate);
  const remainingSteps = totalSteps - stepIndex - 1;
  const latestDate = new Date(deliveryDate);
  latestDate.setDate(latestDate.getDate() - remainingSteps);
  return latestDate;
};

const buildDateStaffLoadMap = (schedules: ScheduleItem[]): Map<string, Map<string, number>> => {
  const loadMap = new Map<string, Map<string, number>>();
  schedules.forEach(item => {
    if (!item.completed && item.scheduledDate) {
      if (!loadMap.has(item.scheduledDate)) {
        loadMap.set(item.scheduledDate, new Map());
      }
      const staffMap = loadMap.get(item.scheduledDate)!;
      staffMap.set(item.staffId, (staffMap.get(item.staffId) || 0) + item.estimatedHours);
    }
  });
  return loadMap;
};

const getChangeType = (oldItem: ScheduleItem, newItem: ScheduleItem): ChangeType => {
  const dateChanged = oldItem.scheduledDate !== newItem.scheduledDate;
  const staffChanged = oldItem.staffId !== newItem.staffId;
  if (dateChanged && staffChanged) return 'both';
  if (dateChanged) return 'moved_date';
  if (staffChanged) return 'changed_staff';
  return 'unchanged';
};

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const performAutoReschedule = (
  projects: RestorationProject[],
  staff: RestorationStaff[],
  schedules: ScheduleItem[]
): AutoRescheduleResult => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatDate(today);

  const originalSchedules = [...schedules];
  const completedSchedules = schedules.filter(s => s.completed);
  const incompleteSchedules = schedules.filter(s => !s.completed);

  const totalConflictCountBefore = detectStaffWorkloadConflicts(staff, schedules).length;

  const undeliveredProjects = projects.filter(p => p.status !== 'delivered');

  const projectStepInfo = new Map<string, { earliestDate: Date; latestDate: Date; stepIndex: number }[]>();
  const completedSteps = new Set<string>();

  undeliveredProjects.forEach(project => {
    const stepInfos: { earliestDate: Date; latestDate: Date; stepIndex: number }[] = [];
    project.restorationSteps.forEach((step, idx) => {
      if (!step.completed) {
        const earliestDate = getEarliestPossibleDate(project, idx, today, completedSteps);
        const latestDate = getLatestPossibleDate(project, idx, project.restorationSteps.length);
        stepInfos.push({ earliestDate, latestDate, stepIndex: idx });
      }
    });
    projectStepInfo.set(project.id, stepInfos);
  });

  const proposedSchedules = [...completedSchedules];
  const tasksToReschedule: Array<{
    original: ScheduleItem;
    project: RestorationProject;
    stepIndex: number;
    earliestDate: Date;
    latestDate: Date;
  }> = [];

  incompleteSchedules.forEach(item => {
    const project = undeliveredProjects.find(p => p.id === item.projectId);
    if (!project) {
      proposedSchedules.push(item);
      return;
    }
    const stepIndex = getStepIndex(project, item.stepName || '');
    if (stepIndex === -1) {
      proposedSchedules.push(item);
      return;
    }
    const stepInfos = projectStepInfo.get(project.id);
    const stepInfo = stepInfos?.find(s => s.stepIndex === stepIndex);
    if (!stepInfo) {
      proposedSchedules.push(item);
      return;
    }
    tasksToReschedule.push({
      original: item,
      project,
      stepIndex,
      earliestDate: stepInfo.earliestDate,
      latestDate: stepInfo.latestDate,
    });
  });

  tasksToReschedule.sort((a, b) => {
    const aPriority = a.project.priority === 'high' ? 0 : a.project.priority === 'medium' ? 1 : 2;
    const bPriority = b.project.priority === 'high' ? 0 : b.project.priority === 'medium' ? 1 : 2;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.stepIndex - b.stepIndex;
  });

  const dateStaffLoad = buildDateStaffLoadMap(completedSchedules);
  const unresolvedConflicts: UnresolvedConflict[] = [];
  const changes: ScheduleChange[] = [];

  for (const task of tasksToReschedule) {
    const { original, project, earliestDate, latestDate } = task;
    const stepName = original.stepName || '';
    const hours = original.estimatedHours;
    const projectTitle = project.bookTitle;

    let bestDate: string | null = null;
    let bestStaff: RestorationStaff | null = null;
    let minScore = Infinity;

    const currentDate = new Date(earliestDate);
    const hardDeadline = new Date(Math.min(latestDate.getTime(), new Date(project.deliveryDate).getTime()));

    while (currentDate <= hardDeadline) {
      const dateStr = formatDate(currentDate);

      if (!dateStaffLoad.has(dateStr)) {
        dateStaffLoad.set(dateStr, new Map());
      }
      const staffLoad = dateStaffLoad.get(dateStr)!;

      for (const staffMember of staff) {
        if (!hasMatchingSkill(staffMember, stepName)) {
          continue;
        }

        const currentLoad = staffLoad.get(staffMember.id) || 0;
        const maxHours = staffMember.dailyWorkHours || 8;
        const newLoad = currentLoad + hours;

        const daysDiff = Math.abs(new Date(original.scheduledDate!).getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24);
        const staffChangePenalty = staffMember.id === original.staffId ? 0 : 5;
        const dateChangePenalty = daysDiff * 2;

        if (newLoad <= maxHours) {
          const score = currentLoad + staffChangePenalty + dateChangePenalty;
          if (score < minScore) {
            minScore = score;
            bestDate = dateStr;
            bestStaff = staffMember;
          }
        } else {
          const overload = newLoad - maxHours;
          const overloadPenalty = overload * 20;
          const score = currentLoad + overloadPenalty + staffChangePenalty + dateChangePenalty;
          if (score < minScore && overload <= maxHours * 0.3) {
            minScore = score;
            bestDate = dateStr;
            bestStaff = staffMember;
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (!bestStaff || !bestDate) {
      for (const staffMember of staff) {
        if (!hasMatchingSkill(staffMember, stepName)) continue;

        const currentDate2 = new Date(earliestDate);
        while (currentDate2 <= hardDeadline) {
          const dateStr = formatDate(currentDate2);
          if (!dateStaffLoad.has(dateStr)) {
            dateStaffLoad.set(dateStr, new Map());
          }
          const staffLoad = dateStaffLoad.get(dateStr)!;
          const currentLoad = staffLoad.get(staffMember.id) || 0;
          const newLoad = currentLoad + hours;
          const maxHours = staffMember.dailyWorkHours || 8;

          if (newLoad <= maxHours * 1.5) {
            bestDate = dateStr;
            bestStaff = staffMember;
            break;
          }
          currentDate2.setDate(currentDate2.getDate() + 1);
        }
        if (bestStaff && bestDate) break;
      }
    }

    if (bestStaff && bestDate) {
      const newItem: ScheduleItem = {
        ...original,
        scheduledDate: bestDate,
        staffId: bestStaff.id,
        staffName: bestStaff.name,
      };

      const changeType = getChangeType(original, newItem);
      if (changeType !== 'unchanged') {
        changes.push({
          scheduleItemId: original.id,
          projectId: project.id,
          projectTitle,
          stepName,
          changeType,
          oldDate: original.scheduledDate || '',
          newDate: bestDate,
          oldStaffId: original.staffId,
          oldStaffName: original.staffName || '',
          newStaffId: bestStaff.id,
          newStaffName: bestStaff.name,
          estimatedHours: hours,
        });
      }

      proposedSchedules.push(newItem);

      if (!dateStaffLoad.has(bestDate)) {
        dateStaffLoad.set(bestDate, new Map());
      }
      const staffLoad = dateStaffLoad.get(bestDate)!;
      staffLoad.set(bestStaff.id, (staffLoad.get(bestStaff.id) || 0) + hours);
    } else {
      proposedSchedules.push(original);

      const deliveryDate = new Date(project.deliveryDate);
      const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      let reason: UnresolvedConflictReason = 'insufficient_staff';
      let reasonDescription = '';
      let suggestedActions: string[] = [];

      if (daysUntilDelivery < 0) {
        reason = 'delivery_too_tight';
        reasonDescription = `项目《${projectTitle}》已逾期，无法在当前人员配置下安排「${stepName}」步骤`;
        suggestedActions = ['增加修复人员', '与客户沟通调整交付日期', '简化修复流程'];
      } else if (daysUntilDelivery <= 3 && project.restorationSteps.filter(s => !s.completed).length > daysUntilDelivery) {
        reason = 'delivery_too_tight';
        reasonDescription = `项目《${projectTitle}》交付时间过紧（${daysUntilDelivery}天），步骤过多，无法完全分配`;
        suggestedActions = ['增加修复人员', '并行处理多个步骤', '与客户沟通调整交付日期'];
      } else if (staff.filter(s => hasMatchingSkill(s, stepName)).length === 0) {
        reason = 'skill_mismatch';
        reasonDescription = `没有擅长「${stepName}」技能的修复人员，无法安排该步骤`;
        suggestedActions = ['培训现有员工掌握该技能', '招聘具备该技能的修复人员', '外包该步骤'];
      } else {
        reason = 'insufficient_staff';
        reasonDescription = `修复人员不足，「${stepName}」（${hours}小时）无法在交付日期前合理安排`;
        suggestedActions = ['增加修复人员', '调整其他项目优先级', '延长工作时间'];
      }

      unresolvedConflicts.push({
        type: 'overload',
        severity: 'high',
        reason,
        reasonDescription,
        projectId: project.id,
        projectTitle,
        stepName,
        scheduledHours: hours,
        suggestedActions,
      });
    }
  }

  const conflictsAfter = detectStaffWorkloadConflicts(staff, proposedSchedules);
  const totalConflictCountAfter = conflictsAfter.length;

  conflictsAfter.forEach(conflict => {
    const alreadyRecorded = unresolvedConflicts.some(
      c => c.staffId === conflict.staffId && c.date === conflict.date
    );
    if (!alreadyRecorded) {
      unresolvedConflicts.push({
        type: 'overload',
        severity: conflict.overloadHours > 4 ? 'high' : conflict.overloadHours > 2 ? 'medium' : 'low',
        reason: 'partial_resolution',
        reasonDescription: `${conflict.staffName} 在 ${conflict.date} 仍有 ${conflict.overloadHours} 小时负载超出上限，已尽量优化但仍无法完全解决`,
        staffId: conflict.staffId,
        staffName: conflict.staffName,
        date: conflict.date,
        scheduledHours: conflict.scheduledHours,
        maxHours: conflict.maxHours,
        overloadHours: conflict.overloadHours,
        suggestedActions: [
          '将该日部分工作移至其他日期',
          '分配给其他有空闲的修复人员',
          '考虑增加临时人员',
        ],
      });
    }
  });

  const allDates = proposedSchedules
    .filter(s => s.scheduledDate)
    .map(s => new Date(s.scheduledDate!).getTime());

  const modifiedCount = changes.length;
  const unchangedCount = incompleteSchedules.length - modifiedCount;

  return {
    success: true,
    originalSchedules,
    proposedSchedules,
    changes,
    unchangedCount,
    modifiedCount,
    totalConflictCountBefore,
    totalConflictCountAfter,
    unresolvedConflicts,
    canApply: true,
    generatedAt: new Date().toISOString(),
    summary: {
      totalTasks: schedules.length,
      completedTasks: completedSchedules.length,
      rescheduledTasks: modifiedCount,
      conflictsResolved: Math.max(0, totalConflictCountBefore - totalConflictCountAfter),
      conflictsRemaining: totalConflictCountAfter + unresolvedConflicts.filter(c => c.type === 'overdue').length,
      earliestDate: allDates.length > 0 ? formatDate(new Date(Math.min(...allDates))) : todayStr,
      latestDate: allDates.length > 0 ? formatDate(new Date(Math.max(...allDates))) : todayStr,
    },
  };
};
