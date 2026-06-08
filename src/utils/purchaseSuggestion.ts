import type {
  RestorationProject,
  MaterialStock,
  PurchaseSuggestion,
  ScheduledProjectUsage,
  PurchaseStatus,
  ScheduleData,
} from '../types';
import { getScheduleData, getMaterialStocks, generateId } from './storage';

const DEFAULT_CALCULATION_PERIOD_DAYS = 30;
const DEFAULT_RECENT_CONSUMPTION_DAYS = 60;
const DEFAULT_SAFETY_BUFFER = 1.2;
const URGENT_THRESHOLD_DAYS = 7;
const NO_DATA_THRESHOLD_STOCK = 0;

export const getDaysSince = (dateStr: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - date.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

interface CalculateRecentConsumptionResult {
  rate: number;
  days: number;
  hasHistory: boolean;
}

const calculateRecentConsumptionRate = (
  materialName: string,
  unit: string,
  projects: RestorationProject[],
  recentDays: number = DEFAULT_RECENT_CONSUMPTION_DAYS
): CalculateRecentConsumptionResult => {
  let totalUsed = 0;
  let earliestDate: Date | null = null;
  let latestDate: Date | null = null;
  let usedCount = 0;

  projects.forEach(project => {
    if (project.status === 'delivered') {
      const useDate = new Date(project.updatedAt || project.createdAt);
      const daysSince = getDaysSince(useDate.toISOString());
      
      if (daysSince <= recentDays) {
        const materialsInProject = project.materialsUsed.filter(
          m => m.name === materialName && m.unit === unit
        );
        if (materialsInProject.length > 0) {
          const projectTotal = materialsInProject.reduce(
            (sum, m) => sum + (parseFloat(m.quantity) || 0),
            0
          );
          if (projectTotal > 0) {
            totalUsed += projectTotal;
            usedCount++;
            
            if (!earliestDate || useDate < earliestDate) {
              earliestDate = useDate;
            }
            if (!latestDate || useDate > latestDate) {
              latestDate = useDate;
            }
          }
        }
      }
    }
  });

  if (usedCount === 0 || totalUsed <= 0) {
    return {
      rate: 0,
      days: 0,
      hasHistory: false,
    };
  }

  let actualDays = 1;
  if (earliestDate !== null && latestDate !== null) {
    actualDays = Math.max(
      1,
      Math.ceil(
        ((latestDate as Date).getTime() - (earliestDate as Date).getTime()) / 
          (1000 * 60 * 60 * 24)
      ) + 1
    );
  }

  return {
    rate: totalUsed / actualDays,
    days: actualDays,
    hasHistory: true,
  };
};

const getScheduledProjectsUsage = (
  materialName: string,
  unit: string,
  projects: RestorationProject[],
  scheduleData: ScheduleData
): ScheduledProjectUsage[] => {
  const usageList: ScheduledProjectUsage[] = [];

  projects.forEach(project => {
    if (project.status === 'delivered') return;

    const materialsInProject = project.materialsUsed.filter(
      m => m.name === materialName && m.unit === unit
    );
    if (materialsInProject.length === 0) return;

    const totalSteps = project.restorationSteps.length;
    const completedSteps = project.restorationSteps.filter(s => s.completed).length;
    const remainingSteps = totalSteps - completedSteps;
    
    if (remainingSteps <= 0) return;

    const totalQuantity = materialsInProject.reduce(
      (sum, m) => sum + (parseFloat(m.quantity) || 0),
      0
    );
    if (totalQuantity <= 0) return;

    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
    const estimatedRemaining = totalQuantity * (remainingSteps / totalSteps);

    const projectSchedule = scheduleData.projectSchedules.find(
      s => s.projectId === project.id
    );

    let scheduledDate: string | undefined;
    if (projectSchedule?.startDate) {
      scheduledDate = projectSchedule.startDate;
    } else {
      const scheduledItems = scheduleData.schedules.filter(
        s => s.projectId === project.id && s.status !== 'completed'
      );
      if (scheduledItems.length > 0) {
        const earliestScheduled = scheduledItems
          .filter(s => s.scheduledDate)
          .sort((a, b) => new Date(a.scheduledDate!).getTime() - new Date(b.scheduledDate!).getTime())[0];
        if (earliestScheduled?.scheduledDate) {
          scheduledDate = earliestScheduled.scheduledDate;
        }
      }
    }

    usageList.push({
      projectId: project.id,
      projectTitle: project.bookTitle,
      scheduledDate,
      estimatedQuantity: Math.round(estimatedRemaining * 100) / 100,
      progress: Math.round(progress * 10) / 10,
    });
  });

  return usageList;
};

const getCurrentStock = (
  materialName: string,
  unit: string,
  materialStocks: MaterialStock[],
  projects: RestorationProject[]
): { currentStock: number; minimumStock: number; hasStockData: boolean } => {
  const stock = materialStocks.find(s => s.name === materialName && s.unit === unit);
  
  let totalUsed = 0;
  projects.forEach(project => {
    const materialsInProject = project.materialsUsed.filter(
      m => m.name === materialName && m.unit === unit
    );
    if (materialsInProject.length > 0) {
      totalUsed += materialsInProject.reduce(
        (sum, m) => sum + (parseFloat(m.quantity) || 0),
        0
      );
    }
  });

  if (stock) {
    const totalStockIn = stock.stockInRecords.reduce((sum, r) => sum + r.quantity, 0);
    return {
      currentStock: Math.max(0, stock.openingStock + totalStockIn - totalUsed),
      minimumStock: stock.minimumStock,
      hasStockData: true,
    };
  }

  return {
    currentStock: 0,
    minimumStock: 0,
    hasStockData: false,
  };
};

const determinePurchaseStatus = (
  currentStock: number,
  minimumStock: number,
  estimatedDaysLeft: number,
  hasStockData: boolean,
  hasHistoryConsumption: boolean,
  totalScheduledUsage: number,
  safetyBuffer: number
): { status: PurchaseStatus; warnings: string[] } => {
  const warnings: string[] = [];

  if (!hasStockData && currentStock <= NO_DATA_THRESHOLD_STOCK) {
    warnings.push('未设置库存数据，无法准确计算');
    return { status: 'no_data', warnings };
  }

  if (!hasHistoryConsumption && totalScheduledUsage <= 0) {
    warnings.push('无历史消耗记录，也无已排程项目需求');
    if (currentStock > minimumStock * safetyBuffer * 2) {
      return { status: 'excess', warnings };
    }
    return { status: 'no_data', warnings };
  }

  if (currentStock <= 0) {
    warnings.push('当前库存已耗尽');
    return { status: 'urgent', warnings };
  }

  if (currentStock <= minimumStock) {
    warnings.push('当前库存低于最低库存线');
    return { status: 'urgent', warnings };
  }

  if (estimatedDaysLeft <= URGENT_THRESHOLD_DAYS && estimatedDaysLeft > 0) {
    warnings.push(`预计 ${estimatedDaysLeft} 天内耗尽库存`);
    return { status: 'urgent', warnings };
  }

  if (estimatedDaysLeft <= DEFAULT_CALCULATION_PERIOD_DAYS && estimatedDaysLeft > 0) {
    warnings.push(`预计 ${estimatedDaysLeft} 天内需要补货`);
    return { status: 'need_purchase', warnings };
  }

  if (currentStock > minimumStock * safetyBuffer * 3 && totalScheduledUsage === 0) {
    warnings.push('库存可能过剩，建议核查');
    return { status: 'excess', warnings };
  }

  return { status: 'normal', warnings };
};

const calculateSuggestedPurchaseQuantity = (
  currentStock: number,
  minimumStock: number,
  consumptionRate: number,
  totalScheduledUsage: number,
  calculationPeriodDays: number,
  safetyBuffer: number
): number => {
  const projectedConsumption = consumptionRate * calculationPeriodDays;
  const totalDemand = projectedConsumption + totalScheduledUsage;
  const desiredStock = Math.max(minimumStock * safetyBuffer, totalDemand * safetyBuffer);
  const needed = desiredStock - currentStock;
  
  return Math.max(0, Math.ceil(needed * 100) / 100);
};

const getEstimatedDaysLeft = (
  currentStock: number,
  consumptionRate: number,
  totalScheduledUsage: number,
  scheduledProjects: ScheduledProjectUsage[]
): { daysLeft: number; shortageDate?: string } => {
  if (currentStock <= 0) {
    return { daysLeft: 0, shortageDate: formatDate(new Date()) };
  }

  const dailyRate = consumptionRate > 0 ? consumptionRate : 0;
  
  if (dailyRate <= 0 && totalScheduledUsage <= 0) {
    return { daysLeft: 999 };
  }

  let remainingStock = currentStock;
  let daysLeft = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const scheduledByDate = new Map<string, number>();
  scheduledProjects.forEach(sp => {
    if (sp.scheduledDate) {
      const current = scheduledByDate.get(sp.scheduledDate) || 0;
      scheduledByDate.set(sp.scheduledDate, current + sp.estimatedQuantity);
    }
  });

  const unscheduledUsage = scheduledProjects.filter(sp => !sp.scheduledDate)
    .reduce((sum, sp) => sum + sp.estimatedQuantity, 0);

  const avgDailyUnscheduled = unscheduledUsage > 0 
    ? unscheduledUsage / DEFAULT_CALCULATION_PERIOD_DAYS 
    : 0;

  const maxDaysToCheck = 365;
  for (let i = 0; i < maxDaysToCheck; i++) {
    const checkDate = addDays(today, i);
    const dateStr = formatDate(checkDate);
    
    const scheduledUsage = scheduledByDate.get(dateStr) || 0;
    const totalDailyUsage = dailyRate + avgDailyUnscheduled + scheduledUsage;
    
    if (totalDailyUsage > 0) {
      remainingStock -= totalDailyUsage;
      if (remainingStock <= 0) {
        daysLeft = i + 1;
        return { daysLeft, shortageDate: dateStr };
      }
    }
  }

  if (dailyRate > 0) {
    daysLeft = Math.floor(remainingStock / dailyRate);
    return {
      daysLeft,
      shortageDate: formatDate(addDays(today, daysLeft)),
    };
  }

  return { daysLeft: 999 };
};

interface GeneratePurchaseSuggestionsOptions {
  periodDays?: number;
  recentDays?: number;
  safetyBuffer?: number;
}

export const generatePurchaseSuggestions = (
  projects: RestorationProject[],
  options: GeneratePurchaseSuggestionsOptions = {}
): PurchaseSuggestion[] => {
  const {
    periodDays = DEFAULT_CALCULATION_PERIOD_DAYS,
    recentDays = DEFAULT_RECENT_CONSUMPTION_DAYS,
    safetyBuffer = DEFAULT_SAFETY_BUFFER,
  } = options;

  const materialStocks = getMaterialStocks();
  const scheduleData = getScheduleData();

  const materialMap = new Map<string, { name: string; unit: string }>();

  projects.forEach(project => {
    project.materialsUsed.forEach(material => {
      const key = `${material.name}-${material.unit}`;
      if (!materialMap.has(key)) {
        materialMap.set(key, { name: material.name, unit: material.unit });
      }
    });
  });

  materialStocks.forEach(stock => {
    const key = `${stock.name}-${stock.unit}`;
    if (!materialMap.has(key)) {
      materialMap.set(key, { name: stock.name, unit: stock.unit });
    }
  });

  const nameUnitMap = new Map<string, { unit: string; count: number }>();
  materialMap.forEach((value) => {
    const existing = nameUnitMap.get(value.name);
    if (existing) {
      existing.count++;
    } else {
      nameUnitMap.set(value.name, { unit: value.unit, count: 1 });
    }
  });

  const suggestions: PurchaseSuggestion[] = [];
  const now = new Date().toISOString();

  materialMap.forEach(({ name, unit }) => {
    const warnings: string[] = [];

    const duplicateCheck = nameUnitMap.get(name);
    if (duplicateCheck && duplicateCheck.count > 1) {
      warnings.push(`材料名"${name}"存在不同单位(${duplicateCheck.count}种)，请注意区分`);
    }

    const consumptionResult = calculateRecentConsumptionRate(name, unit, projects, recentDays);
    const scheduledUsage = getScheduledProjectsUsage(name, unit, projects, scheduleData);
    const stockInfo = getCurrentStock(name, unit, materialStocks, projects);

    if (!stockInfo.hasStockData) {
      warnings.push('未设置该材料的库存参数');
    }

    const unscheduledCount = scheduledUsage.filter(s => !s.scheduledDate).length;
    if (unscheduledCount > 0) {
      warnings.push(`${unscheduledCount} 个项目尚未排程，预估用量可能不准确`);
    }

    const totalScheduledUsage = scheduledUsage.reduce((sum, s) => sum + s.estimatedQuantity, 0);

    const { daysLeft, shortageDate } = getEstimatedDaysLeft(
      stockInfo.currentStock,
      consumptionResult.rate,
      totalScheduledUsage,
      scheduledUsage
    );

    const { status, warnings: statusWarnings } = determinePurchaseStatus(
      stockInfo.currentStock,
      stockInfo.minimumStock,
      daysLeft,
      stockInfo.hasStockData,
      consumptionResult.hasHistory,
      totalScheduledUsage,
      safetyBuffer
    );

    warnings.push(...statusWarnings);

    const suggestedQuantity = calculateSuggestedPurchaseQuantity(
      stockInfo.currentStock,
      stockInfo.minimumStock,
      consumptionResult.rate,
      totalScheduledUsage,
      periodDays,
      safetyBuffer
    );

    let suggestedPurchaseDate: string | undefined;
    if (shortageDate && suggestedQuantity > 0) {
      const leadTimeDays = 3;
      const purchaseDate = addDays(new Date(shortageDate), -leadTimeDays);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      suggestedPurchaseDate = formatDate(purchaseDate < today ? today : purchaseDate);
    }

    suggestions.push({
      name,
      unit,
      currentStock: Math.round(stockInfo.currentStock * 100) / 100,
      minimumStock: stockInfo.minimumStock,
      recentConsumptionRate: Math.round(consumptionResult.rate * 1000) / 1000,
      recentDays: consumptionResult.days,
      hasHistoryConsumption: consumptionResult.hasHistory,
      scheduledProjectsUsage: scheduledUsage,
      totalScheduledUsage: Math.round(totalScheduledUsage * 100) / 100,
      estimatedDaysLeft: daysLeft,
      shortageDate,
      suggestedPurchaseQuantity: suggestedQuantity,
      suggestedPurchaseDate,
      status,
      warnings,
      lastCalculatedAt: now,
      calculationPeriodDays: periodDays,
      stockSafetyBuffer: safetyBuffer,
    });
  });

  return suggestions;
};

export const filterAndSortSuggestions = (
  suggestions: PurchaseSuggestion[],
  filter?: { status?: string; searchTerm?: string },
  sort?: { by: string; order: 'asc' | 'desc' }
): PurchaseSuggestion[] => {
  let result = [...suggestions];

  if (filter?.status && filter.status !== 'all') {
    result = result.filter(s => s.status === filter.status);
  }

  if (filter?.searchTerm) {
    const term = filter.searchTerm.toLowerCase();
    result = result.filter(s =>
      s.name.toLowerCase().includes(term) ||
      s.unit.toLowerCase().includes(term)
    );
  }

  if (sort) {
    result.sort((a, b) => {
      let comparison = 0;
      switch (sort.by) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'zh-CN');
          break;
        case 'currentStock':
          comparison = a.currentStock - b.currentStock;
          break;
        case 'shortageDate':
          if (!a.shortageDate && !b.shortageDate) comparison = 0;
          else if (!a.shortageDate) comparison = 1;
          else if (!b.shortageDate) comparison = -1;
          else comparison = new Date(a.shortageDate).getTime() - new Date(b.shortageDate).getTime();
          break;
        case 'suggestedQuantity':
          comparison = a.suggestedPurchaseQuantity - b.suggestedPurchaseQuantity;
          break;
        case 'status':
          const statusOrder: Record<string, number> = {
            'urgent': 0,
            'need_purchase': 1,
            'no_data': 2,
            'normal': 3,
            'excess': 4,
          };
          comparison = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
          break;
      }
      return sort.order === 'asc' ? comparison : -comparison;
    });
  }

  return result;
};

export const generateSavedSuggestion = (
  suggestions: PurchaseSuggestion[],
  periodDays: number,
  note?: string
) => {
  return {
    id: generateId(),
    generatedAt: new Date().toISOString(),
    periodDays,
    suggestions,
    note,
  };
};
