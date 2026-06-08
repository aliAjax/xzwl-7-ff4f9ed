import type {
  RestorationProject,
  ProjectStatus,
  ImageRecord,
  RestorationAssessment,
} from '../types';
import STORAGE_KEYS from './storageKeys';
import { generateProjectId } from './idGenerator';

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

export const updateProjectImageRecords = (
  projectId: string,
  records: ImageRecord[]
): { success: boolean; error?: string } => {
  return updateProject(projectId, { imageRecords: records });
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
