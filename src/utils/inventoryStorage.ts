import type { MaterialStock, StockInRecord, StockInTemplate } from '../types';
import STORAGE_KEYS from './storageKeys';
import { generateId, generateStockInTemplateId } from './idGenerator';

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
): { success: boolean; error?: string; record?: StockInRecord } => {
  try {
    const stocks = getMaterialStocks();
    let stock = stocks.find(s => s.name === name && s.unit === unit);

    if (!stock) {
      const now = new Date().toISOString().split('T')[0];
      stock = {
        id: generateId(),
        name,
        unit,
        openingStock: 0,
        minimumStock: 0,
        stockInRecords: [],
        createdAt: now,
        updatedAt: now,
      };
      stocks.push(stock);
    }

    const newRecord: StockInRecord = {
      ...record,
      id: generateId(),
    };

    stock.stockInRecords.push(newRecord);
    stock.updatedAt = new Date().toISOString().split('T')[0];
    saveMaterialStocks(stocks);
    return { success: true, record: newRecord };
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
