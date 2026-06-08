import type {
  HandoverRecord,
  RestorationProject,
  RestorationStep,
  MaterialUsage,
} from '../types';
import { STAGE_LABELS } from '../types';
import STORAGE_KEYS from './storageKeys';
import { generateHandoverId } from './idGenerator';

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
