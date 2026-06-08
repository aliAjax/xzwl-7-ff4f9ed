import type { RestorationTemplate } from '../types';
import STORAGE_KEYS from './storageKeys';
import { generateTemplateId } from './idGenerator';

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
