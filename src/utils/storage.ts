import type { RestorationProject, RestorationTemplate } from '../types';
import { DEFAULT_TEMPLATES } from '../types';

const STORAGE_KEY = 'ancient-book-restoration-projects';
const TEMPLATE_STORAGE_KEY = 'ancient-book-restoration-templates';

export function getProjects(): RestorationProject[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(p => ({
          ...p,
          imageRecords: p.imageRecords || [],
        }));
      }
    }
  } catch (e) {
    console.error('Failed to load projects from storage:', e);
  }
  return getSampleProjects();
}

export function generateId(): string {
  return `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateImageRecordId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getStorageRemainingSpace(): number {
  try {
    const testKey = '__storage_test__';
    const testData = 'x'.repeat(1024);
    let remaining = 0;
    while (true) {
      try {
        localStorage.setItem(testKey + remaining, testData);
        remaining++;
      } catch (e) {
        for (let i = 0; i < remaining; i++) {
          localStorage.removeItem(testKey + i);
        }
        return remaining * 1024;
      }
    }
  } catch (e) {
    return -1;
  }
}

export function saveProjects(projects: RestorationProject[]): { success: boolean; error?: string } {
  try {
    const data = JSON.stringify(projects);
    localStorage.setItem(STORAGE_KEY, data);
    return { success: true };
  } catch (e) {
    const error = e as Error;
    let errorMessage = '保存失败，存储空间不足。';
    if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
      errorMessage = '存储空间不足！请删除一些旧的影像记录或压缩图片后重试。';
    } else {
      errorMessage = `保存失败：${error.message}`;
    }
    console.error('Failed to save projects to storage:', e);
    return { success: false, error: errorMessage };
  }
}

function getSampleProjects(): RestorationProject[] {
  const today = new Date();
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return formatDate(d);
  };

  return [
    {
      id: generateId(),
      bookTitle: '永乐大典',
      volumeCount: 5,
      damageTypes: ['虫蛀', '脱页', '酸化'],
      restorationSteps: [
        { name: '登记建档', completed: true, date: addDays(today, -20) },
        { name: '拍照记录', completed: true, date: addDays(today, -18) },
        { name: '除尘清洁', completed: true, date: addDays(today, -15) },
        { name: '脱酸处理', completed: true, date: addDays(today, -10) },
        { name: '修补破损', completed: true, date: addDays(today, -5) },
        { name: '托裱加固', completed: false },
        { name: '压平整理', completed: false },
        { name: '装订成册', completed: false },
        { name: '做函套', completed: false },
        { name: '拍照存档', completed: false },
      ],
      currentProgress: 50,
      materialsUsed: [
        { name: '皮纸', quantity: '50', unit: '张' },
        { name: '浆糊', quantity: '200', unit: '克' },
        { name: '脱酸液', quantity: '500', unit: '毫升' },
      ],
      imageRecords: [],
      deliveryDate: addDays(today, 30),
      status: 'in-restoration',
      createdAt: addDays(today, -20),
      updatedAt: addDays(today, -5),
      notes: '明代版本，虫蛀较严重，需要特别注意修补力度。',
    },
    {
      id: generateId(),
      bookTitle: '四库全书',
      volumeCount: 12,
      damageTypes: ['霉斑', '水渍', '粘连'],
      restorationSteps: [
        { name: '登记建档', completed: true, date: addDays(today, -30) },
        { name: '拍照记录', completed: true, date: addDays(today, -28) },
        { name: '除尘清洁', completed: true, date: addDays(today, -25) },
        { name: '脱酸处理', completed: true, date: addDays(today, -20) },
        { name: '修补破损', completed: true, date: addDays(today, -15) },
        { name: '托裱加固', completed: true, date: addDays(today, -10) },
        { name: '压平整理', completed: true, date: addDays(today, -5) },
        { name: '装订成册', completed: false },
        { name: '做函套', completed: false },
        { name: '拍照存档', completed: false },
      ],
      currentProgress: 70,
      materialsUsed: [
        { name: '皮纸', quantity: '200', unit: '张' },
        { name: '绫绢', quantity: '10', unit: '米' },
        { name: '浆糊', quantity: '800', unit: '克' },
      ],
      imageRecords: [],
      deliveryDate: addDays(today, 15),
      status: 'pending-binding',
      createdAt: addDays(today, -30),
      updatedAt: addDays(today, -5),
    },
    {
      id: generateId(),
      bookTitle: '史记',
      volumeCount: 3,
      damageTypes: ['脱线', '破损'],
      restorationSteps: [
        { name: '登记建档', completed: true, date: addDays(today, -10) },
        { name: '拍照记录', completed: true, date: addDays(today, -9) },
        { name: '除尘清洁', completed: true, date: addDays(today, -8) },
        { name: '脱酸处理', completed: false },
        { name: '修补破损', completed: false },
        { name: '托裱加固', completed: false },
        { name: '压平整理', completed: false },
        { name: '装订成册', completed: false },
        { name: '做函套', completed: false },
        { name: '拍照存档', completed: false },
      ],
      currentProgress: 30,
      materialsUsed: [
        { name: '棉线', quantity: '50', unit: '米' },
      ],
      imageRecords: [],
      deliveryDate: addDays(today, 45),
      status: 'pending-evaluation',
      createdAt: addDays(today, -10),
      updatedAt: addDays(today, -8),
    },
    {
      id: generateId(),
      bookTitle: '本草纲目',
      volumeCount: 8,
      damageTypes: ['虫蛀', '焦脆', '撕裂'],
      restorationSteps: [
        { name: '登记建档', completed: true, date: addDays(today, -40) },
        { name: '拍照记录', completed: true, date: addDays(today, -38) },
        { name: '除尘清洁', completed: true, date: addDays(today, -35) },
        { name: '脱酸处理', completed: true, date: addDays(today, -30) },
        { name: '修补破损', completed: true, date: addDays(today, -25) },
        { name: '托裱加固', completed: true, date: addDays(today, -20) },
        { name: '压平整理', completed: true, date: addDays(today, -15) },
        { name: '装订成册', completed: true, date: addDays(today, -10) },
        { name: '做函套', completed: true, date: addDays(today, -5) },
        { name: '拍照存档', completed: true, date: addDays(today, -1) },
      ],
      currentProgress: 100,
      materialsUsed: [
        { name: '皮纸', quantity: '150', unit: '张' },
        { name: '楠木夹板', quantity: '8', unit: '对' },
        { name: '绫绢', quantity: '15', unit: '米' },
      ],
      imageRecords: [],
      deliveryDate: addDays(today, -1),
      status: 'delivered',
      createdAt: addDays(today, -40),
      updatedAt: addDays(today, -1),
      notes: '已完成修复并交付，修复效果良好。',
    },
    {
      id: generateId(),
      bookTitle: '资治通鉴',
      volumeCount: 6,
      damageTypes: ['酸化', '霉斑', '污渍'],
      restorationSteps: [
        { name: '登记建档', completed: true, date: addDays(today, -15) },
        { name: '拍照记录', completed: true, date: addDays(today, -14) },
        { name: '除尘清洁', completed: true, date: addDays(today, -12) },
        { name: '脱酸处理', completed: true, date: addDays(today, -8) },
        { name: '修补破损', completed: true, date: addDays(today, -3) },
        { name: '托裱加固', completed: false },
        { name: '压平整理', completed: false },
        { name: '装订成册', completed: false },
        { name: '做函套', completed: false },
        { name: '拍照存档', completed: false },
      ],
      currentProgress: 50,
      materialsUsed: [
        { name: '脱酸液', quantity: '1000', unit: '毫升' },
        { name: '皮纸', quantity: '80', unit: '张' },
      ],
      imageRecords: [],
      deliveryDate: addDays(today, 25),
      status: 'pending-drying',
      createdAt: addDays(today, -15),
      updatedAt: addDays(today, -3),
      notes: '刚完成脱酸处理，需要充分晾干后再进行下一步。',
    },
  ];
}

export function generateTemplateId(): string {
  return `tpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getTemplates(): RestorationTemplate[] {
  try {
    const data = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load templates from storage:', e);
  }
  return getDefaultTemplates();
}

export function saveTemplates(templates: RestorationTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
  } catch (e) {
    console.error('Failed to save templates to storage:', e);
  }
}

function getDefaultTemplates(): RestorationTemplate[] {
  const now = new Date().toISOString().split('T')[0];
  return DEFAULT_TEMPLATES.map((tpl, index) => ({
    ...tpl,
    id: `tpl-default-${index + 1}`,
    createdAt: now,
    updatedAt: now,
  }));
}

export function getDefaultTemplate(): RestorationTemplate | undefined {
  const templates = getTemplates();
  return templates.find(t => t.isDefault);
}
