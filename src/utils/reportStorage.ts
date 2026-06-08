import type {
  RepairReport,
  RestorationProject,
  RestorationStep,
  MaterialUsage,
} from '../types';
import {
  STAGE_LABELS,
  PAPER_CONDITION_LABELS,
  DAMAGE_SEVERITY_LABELS,
  POLLUTION_TYPE_LABELS,
  BINDING_CONDITION_LABELS,
} from '../types';
import STORAGE_KEYS from './storageKeys';
import { generateRepairReportId } from './idGenerator';

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
