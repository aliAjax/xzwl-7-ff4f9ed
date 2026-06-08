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
} from '../types';
import { STAGE_LABELS, PAPER_CONDITION_LABELS, DAMAGE_SEVERITY_LABELS, POLLUTION_TYPE_LABELS, BINDING_CONDITION_LABELS } from '../types';

const STORAGE_KEYS = {
  PROJECTS: 'restoration_projects',
  MATERIAL_STOCKS: 'material_stocks',
  TEMPLATES: 'restoration_templates',
  SETTINGS: 'app_settings',
  SCHEDULE: 'restoration_schedule',
  HANDOVER_RECORDS: 'handover_records',
  REPAIR_REPORTS: 'repair_reports',
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
