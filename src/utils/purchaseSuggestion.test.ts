import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generatePurchaseSuggestions,
  filterAndSortSuggestions,
  getDaysSince,
  addDays,
  formatDate,
} from './purchaseSuggestion';
import type {
  RestorationProject,
  MaterialStock,
  ScheduleData,
  PurchaseStatus,
} from '../types';

vi.mock('./inventoryStorage', () => ({
  getMaterialStocks: vi.fn(),
}));

vi.mock('./scheduleStorage', () => ({
  getScheduleData: vi.fn(),
}));

import { getMaterialStocks } from './inventoryStorage';
import { getScheduleData } from './scheduleStorage';

const mockGetMaterialStocks = vi.mocked(getMaterialStocks);
const mockGetScheduleData = vi.mocked(getScheduleData);

const createDate = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

const createSteps = (names: string[], completedCount: number) =>
  names.map((name, i) => ({
    id: `step-${i}`,
    name,
    description: `执行${name}操作`,
    completed: i < completedCount,
    completedAt: i < completedCount ? createDate(10 - i) : undefined,
    estimatedDuration: 2,
    notes: '',
  }));

const baseProject: Omit<RestorationProject, 'id' | 'createdAt' | 'updatedAt'> = {
  bookTitle: '测试古籍',
  volumeCount: 1,
  damageTypes: ['虫蛀'],
  restorationSteps: createSteps(['检查评估', '清理除尘', '脱酸处理', '补洞修复'], 0),
  currentProgress: 0,
  status: 'restoring',
  materialsUsed: [],
  deliveryDate: addDays(new Date(), 30).toISOString().split('T')[0],
  priority: 'medium',
  description: '测试项目',
};

const createProject = (
  overrides: Partial<RestorationProject>
): RestorationProject => ({
  ...baseProject,
  id: `project-${Math.random().toString(36).substr(2, 9)}`,
  createdAt: createDate(30),
  updatedAt: createDate(5),
  ...overrides,
});

const createMaterialStock = (
  overrides: Partial<MaterialStock>
): MaterialStock => ({
  id: `stock-${Math.random().toString(36).substr(2, 9)}`,
  name: '修复纸',
  unit: '张',
  openingStock: 100,
  minimumStock: 20,
  stockInRecords: [],
  createdAt: createDate(60),
  updatedAt: createDate(10),
  ...overrides,
});

const createEmptyScheduleData = (): ScheduleData => ({
  staff: [],
  schedules: [],
  projectSchedules: [],
});

describe('purchaseSuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMaterialStocks.mockReturnValue([]);
    mockGetScheduleData.mockReturnValue(createEmptyScheduleData());
  });

  describe('工具函数', () => {
    it('getDaysSince 应正确计算天数差', () => {
      const now = new Date();
      const todayStr = formatDate(now);
      const daysSinceToday = getDaysSince(todayStr);
      expect(daysSinceToday).toBeGreaterThanOrEqual(0);
      expect(daysSinceToday).toBeLessThanOrEqual(1);

      const fiveDaysAgo = formatDate(addDays(now, -5));
      const daysSinceFive = getDaysSince(fiveDaysAgo);
      expect(daysSinceFive).toBeGreaterThanOrEqual(4);
      expect(daysSinceFive).toBeLessThanOrEqual(6);
    });

    it('addDays 应正确添加天数', () => {
      const base = new Date('2024-01-15');
      const result = addDays(base, 10);
      expect(result.getDate()).toBe(25);
      expect(result.getMonth()).toBe(0);
    });

    it('formatDate 应正确格式化日期', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      expect(formatDate(date)).toBe('2024-01-15');
    });
  });

  describe('场景1: 库存参数缺失', () => {
    it('当材料未设置库存参数时，应标记为no_data并添加警告', () => {
      const projects: RestorationProject[] = [
        createProject({
          id: 'proj-1',
          bookTitle: '古籍A',
          status: 'delivered',
          updatedAt: createDate(30),
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '50', unit: '张' },
          ],
          restorationSteps: createSteps(['检查评估', '修复'], 2),
        }),
      ];

      mockGetMaterialStocks.mockReturnValue([]);
      mockGetScheduleData.mockReturnValue(createEmptyScheduleData());

      const suggestions = generatePurchaseSuggestions(projects);

      expect(suggestions.length).toBe(1);
      const suggestion = suggestions[0];
      expect(suggestion.name).toBe('修复纸');
      expect(suggestion.status).toBe('no_data');
      expect(suggestion.warnings).toContain('未设置该材料的库存参数');
      expect(suggestion.warnings).toContain('未设置库存数据，无法准确计算');
    });

    it('当部分材料有库存参数，部分没有时，应分别处理', () => {
      const projects: RestorationProject[] = [
        createProject({
          id: 'proj-1',
          bookTitle: '古籍A',
          status: 'delivered',
          updatedAt: createDate(30),
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '50', unit: '张' },
            { id: 'm2', name: '浆糊', quantity: '100', unit: '克' },
          ],
          restorationSteps: createSteps(['检查评估', '修复'], 2),
        }),
      ];

      mockGetMaterialStocks.mockReturnValue([
        createMaterialStock({ name: '修复纸', unit: '张', openingStock: 200, minimumStock: 50 }),
      ]);

      const suggestions = generatePurchaseSuggestions(projects);

      expect(suggestions.length).toBe(2);
      const withStock = suggestions.find(s => s.name === '修复纸');
      const withoutStock = suggestions.find(s => s.name === '浆糊');

      expect(withStock?.status).not.toBe('no_data');
      expect(withoutStock?.status).toBe('no_data');
      expect(withoutStock?.warnings).toContain('未设置该材料的库存参数');
    });
  });

  describe('场景2: 历史消耗为空', () => {
    it('当无历史消耗且无排程需求时，应标记为no_data或excess', () => {
      const projects: RestorationProject[] = [
        createProject({
          id: 'proj-1',
          bookTitle: '古籍A',
          status: 'restoring',
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '50', unit: '张' },
          ],
          restorationSteps: createSteps(['检查评估', '修复'], 2),
        }),
      ];

      mockGetMaterialStocks.mockReturnValue([
        createMaterialStock({
          name: '修复纸',
          unit: '张',
          openingStock: 100,
          minimumStock: 20,
        }),
      ]);
      mockGetScheduleData.mockReturnValue(createEmptyScheduleData());

      const suggestions = generatePurchaseSuggestions(projects);

      expect(suggestions.length).toBe(1);
      const suggestion = suggestions[0];
      expect(suggestion.hasHistoryConsumption).toBe(false);
      expect(suggestion.recentConsumptionRate).toBe(0);
      expect(suggestion.currentStock).toBe(50);
      expect(['no_data', 'excess']).toContain(suggestion.status);
      expect(suggestion.warnings).toContain('无历史消耗记录，也无已排程项目需求');
    });

    it('当无历史消耗但有大量库存时，应标记为excess', () => {
      const projects: RestorationProject[] = [
        createProject({
          id: 'proj-1',
          bookTitle: '古籍A',
          status: 'restoring',
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '50', unit: '张' },
          ],
          restorationSteps: createSteps(['检查评估', '修复'], 2),
        }),
      ];

      mockGetMaterialStocks.mockReturnValue([
        createMaterialStock({
          name: '修复纸',
          unit: '张',
          openingStock: 1000,
          minimumStock: 20,
        }),
      ]);

      const suggestions = generatePurchaseSuggestions(projects);
      const suggestion = suggestions[0];

      expect(suggestion.currentStock).toBe(950);
      expect(suggestion.status).toBe('excess');
      expect(suggestion.warnings).toContain('无历史消耗记录，也无已排程项目需求');
    });
  });

  describe('场景3: 已排程项目有预计用量', () => {
    it('已排程项目应正确计算预计用量', () => {
      const projectId = 'proj-scheduled-1';
      const projects: RestorationProject[] = [
        createProject({
          id: projectId,
          bookTitle: '待修复古籍',
          status: 'restoring',
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '100', unit: '张' },
          ],
          restorationSteps: createSteps(['检查评估', '清理除尘', '脱酸处理', '补洞修复'], 1),
        }),
      ];

      mockGetMaterialStocks.mockReturnValue([
        createMaterialStock({
          name: '修复纸',
          unit: '张',
          openingStock: 50,
          minimumStock: 20,
        }),
      ]);

      const scheduledDate = formatDate(addDays(new Date(), 5));
      mockGetScheduleData.mockReturnValue({
        staff: [],
        schedules: [
          {
            id: 'sch-1',
            projectId,
            staffId: 'staff-1',
            staffName: '修复师A',
            stepName: '脱酸处理',
            scheduledDate,
            estimatedHours: 4,
            status: 'scheduled',
          },
        ],
        projectSchedules: [
          {
            projectId,
            startDate: scheduledDate,
          },
        ],
      });

      const suggestions = generatePurchaseSuggestions(projects);
      const suggestion = suggestions[0];

      expect(suggestion.scheduledProjectsUsage.length).toBeGreaterThan(0);
      const scheduledUsage = suggestion.scheduledProjectsUsage[0];
      expect(scheduledUsage.projectId).toBe(projectId);
      expect(scheduledUsage.estimatedQuantity).toBeGreaterThan(0);
      expect(scheduledUsage.scheduledDate).toBe(scheduledDate);
      expect(suggestion.totalScheduledUsage).toBeGreaterThan(0);
    });

    it('多个已排程项目的预计用量应累加', () => {
      const projects: RestorationProject[] = [
        createProject({
          id: 'proj-1',
          bookTitle: '古籍A',
          status: 'restoring',
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '100', unit: '张' },
          ],
          restorationSteps: createSteps(['检查评估', '修复'], 1),
        }),
        createProject({
          id: 'proj-2',
          bookTitle: '古籍B',
          status: 'restoring',
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '80', unit: '张' },
          ],
          restorationSteps: createSteps(['检查评估', '修复'], 0),
        }),
      ];

      mockGetMaterialStocks.mockReturnValue([
        createMaterialStock({
          name: '修复纸',
          unit: '张',
          openingStock: 30,
          minimumStock: 20,
        }),
      ]);

      const date1 = formatDate(addDays(new Date(), 3));
      const date2 = formatDate(addDays(new Date(), 7));
      mockGetScheduleData.mockReturnValue({
        staff: [],
        schedules: [],
        projectSchedules: [
          { projectId: 'proj-1', startDate: date1 },
          { projectId: 'proj-2', startDate: date2 },
        ],
      });

      const suggestions = generatePurchaseSuggestions(projects);
      const suggestion = suggestions[0];

      expect(suggestion.scheduledProjectsUsage.length).toBe(2);
      const totalFromScheduled = suggestion.scheduledProjectsUsage.reduce(
        (sum, s) => sum + s.estimatedQuantity,
        0
      );
      expect(totalFromScheduled).toBeCloseTo(suggestion.totalScheduledUsage, 5);
    });

    it('未排程项目应添加警告信息', () => {
      const projects: RestorationProject[] = [
        createProject({
          id: 'proj-1',
          bookTitle: '古籍A',
          status: 'restoring',
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '100', unit: '张' },
          ],
          restorationSteps: createSteps(['检查评估', '修复'], 0),
        }),
      ];

      mockGetMaterialStocks.mockReturnValue([
        createMaterialStock({
          name: '修复纸',
          unit: '张',
          openingStock: 50,
          minimumStock: 20,
        }),
      ]);
      mockGetScheduleData.mockReturnValue(createEmptyScheduleData());

      const suggestions = generatePurchaseSuggestions(projects);
      const suggestion = suggestions[0];

      expect(suggestion.warnings).toContain(
        '1 个项目尚未排程，预估用量可能不准确'
      );
    });
  });

  describe('场景4: 材料同名不同单位', () => {
    it('同名不同单位的材料应被视为不同条目', () => {
      const projects: RestorationProject[] = [
        createProject({
          id: 'proj-1',
          bookTitle: '古籍A',
          status: 'delivered',
          updatedAt: createDate(30),
          materialsUsed: [
            { id: 'm1', name: '浆糊', quantity: '500', unit: '克' },
            { id: 'm2', name: '浆糊', quantity: '2', unit: '瓶' },
          ],
          restorationSteps: createSteps(['检查评估', '修复'], 2),
        }),
      ];

      mockGetMaterialStocks.mockReturnValue([
        createMaterialStock({
          name: '浆糊',
          unit: '克',
          openingStock: 1500,
          minimumStock: 200,
        }),
        createMaterialStock({
          name: '浆糊',
          unit: '瓶',
          openingStock: 12,
          minimumStock: 3,
        }),
      ]);

      const suggestions = generatePurchaseSuggestions(projects);

      expect(suggestions.length).toBe(2);
      const byGrams = suggestions.find(s => s.unit === '克');
      const byBottles = suggestions.find(s => s.unit === '瓶');

      expect(byGrams).toBeDefined();
      expect(byBottles).toBeDefined();
      expect(byGrams?.name).toBe('浆糊');
      expect(byBottles?.name).toBe('浆糊');
      expect(byGrams?.currentStock).toBe(1000);
      expect(byBottles?.currentStock).toBe(10);
    });

    it('同名不同单位的材料应添加单位区分警告', () => {
      const projects: RestorationProject[] = [
        createProject({
          id: 'proj-1',
          bookTitle: '古籍A',
          status: 'delivered',
          updatedAt: createDate(30),
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '100', unit: '张' },
            { id: 'm2', name: '修复纸', quantity: '5', unit: '卷' },
          ],
          restorationSteps: createSteps(['检查评估', '修复'], 2),
        }),
      ];

      mockGetMaterialStocks.mockReturnValue([
        createMaterialStock({ name: '修复纸', unit: '张', openingStock: 500, minimumStock: 100 }),
        createMaterialStock({ name: '修复纸', unit: '卷', openingStock: 20, minimumStock: 5 }),
      ]);

      const suggestions = generatePurchaseSuggestions(projects);

      suggestions.forEach(s => {
        expect(s.warnings).toContain(
          '材料名"修复纸"存在不同单位(2种)，请注意区分'
        );
      });
    });

    it('同名同单位的材料应被正确合并', () => {
      const projects: RestorationProject[] = [
        createProject({
          id: 'proj-1',
          bookTitle: '古籍A',
          status: 'delivered',
          updatedAt: createDate(30),
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '50', unit: '张' },
          ],
          restorationSteps: createSteps(['检查评估', '修复'], 2),
        }),
        createProject({
          id: 'proj-2',
          bookTitle: '古籍B',
          status: 'delivered',
          updatedAt: createDate(20),
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '30', unit: '张' },
          ],
          restorationSteps: createSteps(['检查评估', '修复'], 2),
        }),
      ];

      mockGetMaterialStocks.mockReturnValue([
        createMaterialStock({
          name: '修复纸',
          unit: '张',
          openingStock: 200,
          minimumStock: 50,
        }),
      ]);

      const suggestions = generatePurchaseSuggestions(projects);

      expect(suggestions.length).toBe(1);
      expect(suggestions[0].name).toBe('修复纸');
      expect(suggestions[0].unit).toBe('张');
      expect(suggestions[0].warnings).not.toContain(
        expect.stringContaining('不同单位')
      );
    });
  });

  describe('场景5: 库存即将耗尽', () => {
    it('当前库存为0时应标记为urgent', () => {
      const projects: RestorationProject[] = [
        createProject({
          id: 'proj-1',
          bookTitle: '古籍A',
          status: 'delivered',
          updatedAt: createDate(10),
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '300', unit: '张' },
          ],
          restorationSteps: createSteps(['检查评估', '修复'], 2),
        }),
      ];

      mockGetMaterialStocks.mockReturnValue([
        createMaterialStock({
          name: '修复纸',
          unit: '张',
          openingStock: 200,
          minimumStock: 50,
          stockInRecords: [
            { id: 'sr1', date: createDate(40).split('T')[0], quantity: 100, unitPrice: 5 },
          ],
        }),
      ]);

      const suggestions = generatePurchaseSuggestions(projects);
      const suggestion = suggestions[0];

      expect(suggestion.currentStock).toBe(0);
      expect(suggestion.status).toBe('urgent');
      expect(suggestion.warnings).toContain('当前库存已耗尽');
    });

    it('库存低于最低库存线时应标记为urgent', () => {
      const projects: RestorationProject[] = [
        createProject({
          id: 'proj-1',
          bookTitle: '古籍A',
          status: 'delivered',
          updatedAt: createDate(10),
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '100', unit: '张' },
          ],
          restorationSteps: createSteps(['检查评估', '修复'], 2),
        }),
      ];

      mockGetMaterialStocks.mockReturnValue([
        createMaterialStock({
          name: '修复纸',
          unit: '张',
          openingStock: 120,
          minimumStock: 50,
          stockInRecords: [],
        }),
      ]);

      const suggestions = generatePurchaseSuggestions(projects);
      const suggestion = suggestions[0];

      expect(suggestion.currentStock).toBe(20);
      expect(suggestion.currentStock).toBeLessThan(suggestion.minimumStock);
      expect(suggestion.status).toBe('urgent');
      expect(suggestion.warnings).toContain('当前库存低于最低库存线');
    });

    it('预计7天内耗尽时应标记为urgent', () => {
      const projects: RestorationProject[] = [
        createProject({
          id: 'proj-1',
          bookTitle: '古籍A',
          status: 'delivered',
          updatedAt: createDate(5),
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '60', unit: '张' },
          ],
          restorationSteps: createSteps(['检查评估', '修复'], 2),
        }),
        createProject({
          id: 'proj-2',
          bookTitle: '古籍B',
          status: 'delivered',
          updatedAt: createDate(35),
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '60', unit: '张' },
          ],
          restorationSteps: createSteps(['检查评估', '修复'], 2),
        }),
      ];

      mockGetMaterialStocks.mockReturnValue([
        createMaterialStock({
          name: '修复纸',
          unit: '张',
          openingStock: 145,
          minimumStock: 10,
        }),
      ]);

      const suggestions = generatePurchaseSuggestions(projects, {
        recentDays: 60,
        safetyBuffer: 1.0,
      });
      const suggestion = suggestions[0];

      expect(suggestion.currentStock).toBe(25);
      expect(suggestion.recentConsumptionRate).toBeCloseTo(120 / 31, 3);
      expect(suggestion.estimatedDaysLeft).toBeLessThanOrEqual(7);
      expect(suggestion.status).toBe('urgent');
      expect(suggestion.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('预计'),
          expect.stringContaining('天内耗尽库存'),
        ])
      );
    });

    it('预计30天内需要补货时应标记为need_purchase', () => {
      const projects: RestorationProject[] = [
        createProject({
          id: 'proj-1',
          bookTitle: '古籍A',
          status: 'delivered',
          updatedAt: createDate(10),
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '30', unit: '张' },
          ],
          restorationSteps: createSteps(['检查评估', '修复'], 2),
        }),
      ];

      mockGetMaterialStocks.mockReturnValue([
        createMaterialStock({
          name: '修复纸',
          unit: '张',
          openingStock: 400,
          minimumStock: 20,
        }),
      ]);

      const suggestions = generatePurchaseSuggestions(projects, {
        recentDays: 60,
        safetyBuffer: 1.0,
      });
      const suggestion = suggestions[0];

      expect(suggestion.currentStock).toBe(370);
      expect(suggestion.recentConsumptionRate).toBe(30);
      expect(suggestion.estimatedDaysLeft).toBeGreaterThan(7);
      expect(suggestion.estimatedDaysLeft).toBeLessThanOrEqual(30);
      expect(suggestion.status).toBe('need_purchase');
    });
  });

  describe('场景6: 筛选排序', () => {
    const createTestSuggestions = () => [
      {
        name: '修复纸',
        unit: '张',
        currentStock: 10,
        minimumStock: 20,
        recentConsumptionRate: 2,
        recentDays: 30,
        hasHistoryConsumption: true,
        scheduledProjectsUsage: [],
        totalScheduledUsage: 0,
        estimatedDaysLeft: 5,
        shortageDate: formatDate(addDays(new Date(), 5)),
        suggestedPurchaseQuantity: 100,
        status: 'urgent' as PurchaseStatus,
        warnings: [],
        lastCalculatedAt: new Date().toISOString(),
        calculationPeriodDays: 30,
        stockSafetyBuffer: 1.2,
      },
      {
        name: '浆糊',
        unit: '克',
        currentStock: 500,
        minimumStock: 100,
        recentConsumptionRate: 5,
        recentDays: 30,
        hasHistoryConsumption: true,
        scheduledProjectsUsage: [],
        totalScheduledUsage: 0,
        estimatedDaysLeft: 100,
        suggestedPurchaseQuantity: 0,
        status: 'normal' as PurchaseStatus,
        warnings: [],
        lastCalculatedAt: new Date().toISOString(),
        calculationPeriodDays: 30,
        stockSafetyBuffer: 1.2,
      },
      {
        name: '清洁剂',
        unit: '毫升',
        currentStock: 50,
        minimumStock: 100,
        recentConsumptionRate: 3,
        recentDays: 30,
        hasHistoryConsumption: true,
        scheduledProjectsUsage: [],
        totalScheduledUsage: 0,
        estimatedDaysLeft: 17,
        shortageDate: formatDate(addDays(new Date(), 17)),
        suggestedPurchaseQuantity: 80,
        status: 'need_purchase' as PurchaseStatus,
        warnings: [],
        lastCalculatedAt: new Date().toISOString(),
        calculationPeriodDays: 30,
        stockSafetyBuffer: 1.2,
      },
      {
        name: '衬纸',
        unit: '张',
        currentStock: 0,
        minimumStock: 20,
        recentConsumptionRate: 0,
        recentDays: 0,
        hasHistoryConsumption: false,
        scheduledProjectsUsage: [],
        totalScheduledUsage: 0,
        estimatedDaysLeft: 0,
        suggestedPurchaseQuantity: 0,
        status: 'no_data' as PurchaseStatus,
        warnings: [],
        lastCalculatedAt: new Date().toISOString(),
        calculationPeriodDays: 30,
        stockSafetyBuffer: 1.2,
      },
    ];

    it('按状态筛选应正确过滤', () => {
      const suggestions = createTestSuggestions();

      const urgentOnly = filterAndSortSuggestions(
        suggestions,
        { status: 'urgent' },
        undefined
      );
      expect(urgentOnly.length).toBe(1);
      expect(urgentOnly[0].status).toBe('urgent');
      expect(urgentOnly[0].name).toBe('修复纸');

      const needPurchaseOnly = filterAndSortSuggestions(
        suggestions,
        { status: 'need_purchase' },
        undefined
      );
      expect(needPurchaseOnly.length).toBe(1);
      expect(needPurchaseOnly[0].status).toBe('need_purchase');
    });

    it('按搜索词筛选应正确过滤名称和单位', () => {
      const suggestions = createTestSuggestions();

      const byName = filterAndSortSuggestions(
        suggestions,
        { searchTerm: '修复' },
        undefined
      );
      expect(byName.length).toBe(1);
      expect(byName[0].name).toBe('修复纸');

      const byUnit = filterAndSortSuggestions(
        suggestions,
        { searchTerm: '克' },
        undefined
      );
      expect(byUnit.length).toBe(1);
      expect(byUnit[0].unit).toBe('克');
    });

    it('按状态排序应按紧急程度排列', () => {
      const suggestions = createTestSuggestions();

      const sorted = filterAndSortSuggestions(
        suggestions,
        undefined,
        { by: 'status', order: 'asc' }
      );

      expect(sorted[0].status).toBe('urgent');
      expect(sorted[1].status).toBe('need_purchase');
      expect(sorted[2].status).toBe('no_data');
      expect(sorted[3].status).toBe('normal');
    });

    it('按名称排序应正确排序', () => {
      const suggestions = createTestSuggestions();

      const sortedAsc = filterAndSortSuggestions(
        suggestions,
        undefined,
        { by: 'name', order: 'asc' }
      );
      const ascNames = sortedAsc.map(s => s.name);
      expect(ascNames).toEqual([...ascNames].sort((a, b) => a.localeCompare(b, 'zh-CN')));
      expect(ascNames[0]).toBe('衬纸');
      expect(ascNames[3]).toBe('修复纸');

      const sortedDesc = filterAndSortSuggestions(
        suggestions,
        undefined,
        { by: 'name', order: 'desc' }
      );
      const descNames = sortedDesc.map(s => s.name);
      expect(descNames).toEqual([...descNames].sort((a, b) => b.localeCompare(a, 'zh-CN')));
      expect(descNames[0]).toBe('修复纸');
      expect(descNames[3]).toBe('衬纸');
    });

    it('按短缺日期排序应正确排列', () => {
      const suggestions = createTestSuggestions();

      const sortedAsc = filterAndSortSuggestions(
        suggestions,
        undefined,
        { by: 'shortageDate', order: 'asc' }
      );

      expect(sortedAsc[0].shortageDate).toBe(formatDate(addDays(new Date(), 5)));
      expect(sortedAsc[1].shortageDate).toBe(formatDate(addDays(new Date(), 17)));
    });

    it('按建议采购量排序应正确排列', () => {
      const suggestions = createTestSuggestions();

      const sortedDesc = filterAndSortSuggestions(
        suggestions,
        undefined,
        { by: 'suggestedQuantity', order: 'desc' }
      );

      expect(sortedDesc[0].suggestedPurchaseQuantity).toBe(100);
      expect(sortedDesc[1].suggestedPurchaseQuantity).toBe(80);
      expect(sortedDesc[2].suggestedPurchaseQuantity).toBe(0);
    });

    it('组合筛选和排序应正确工作', () => {
      const suggestions = createTestSuggestions();

      const result = filterAndSortSuggestions(
        suggestions,
        { status: 'urgent', searchTerm: '修复' },
        { by: 'name', order: 'asc' }
      );

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('修复纸');
      expect(result[0].status).toBe('urgent');
    });
  });

  describe('综合场景', () => {
    it('复杂场景下应正确生成所有建议', () => {
      const today = new Date();
      const projects: RestorationProject[] = [
        createProject({
          id: 'proj-delivered-1',
          bookTitle: '已交付古籍1',
          status: 'delivered',
          updatedAt: formatDate(addDays(today, -15)),
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '100', unit: '张' },
            { id: 'm2', name: '浆糊', quantity: '200', unit: '克' },
          ],
          restorationSteps: createSteps(['检查评估', '修复'], 2),
        }),
        createProject({
          id: 'proj-delivered-2',
          bookTitle: '已交付古籍2',
          status: 'delivered',
          updatedAt: formatDate(addDays(today, -45)),
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '80', unit: '张' },
            { id: 'm2', name: '浆糊', quantity: '200', unit: '克' },
          ],
          restorationSteps: createSteps(['检查评估', '修复'], 2),
        }),
        createProject({
          id: 'proj-restoring-1',
          bookTitle: '修复中古籍',
          status: 'restoring',
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '100', unit: '张' },
            { id: 'm3', name: '修复纸', quantity: '5', unit: '卷' },
          ],
          restorationSteps: createSteps(['检查评估', '清理除尘', '修复'], 1),
        }),
        createProject({
          id: 'proj-pending-1',
          bookTitle: '待评估古籍',
          status: 'pending',
          materialsUsed: [
            { id: 'm1', name: '修复纸', quantity: '50', unit: '张' },
          ],
          restorationSteps: createSteps(['检查评估'], 0),
        }),
      ];

      mockGetMaterialStocks.mockReturnValue([
        createMaterialStock({
          name: '修复纸',
          unit: '张',
          openingStock: 20,
          minimumStock: 50,
          stockInRecords: [
            { id: 'sr1', date: formatDate(addDays(today, -60)), quantity: 480, unitPrice: 5 },
          ],
        }),
        createMaterialStock({
          name: '浆糊',
          unit: '克',
          openingStock: 900,
          minimumStock: 200,
        }),
        createMaterialStock({
          name: '修复纸',
          unit: '卷',
          openingStock: 7,
          minimumStock: 5,
        }),
      ]);

      mockGetScheduleData.mockReturnValue({
        staff: [],
        schedules: [],
        projectSchedules: [
          {
            projectId: 'proj-restoring-1',
            startDate: formatDate(addDays(today, 3)),
          },
        ],
      });

      const suggestions = generatePurchaseSuggestions(projects, {
        periodDays: 30,
        recentDays: 60,
        safetyBuffer: 1.2,
      });

      expect(suggestions.length).toBe(3);

      const paperBySheet = suggestions.find(s => s.name === '修复纸' && s.unit === '张');
      const paperByRoll = suggestions.find(s => s.name === '修复纸' && s.unit === '卷');
      const paste = suggestions.find(s => s.name === '浆糊');

      expect(paperBySheet).toBeDefined();
      expect(paperByRoll).toBeDefined();
      expect(paste).toBeDefined();

      expect(paperBySheet?.currentStock).toBe(170);
      expect(paperBySheet?.status).toBe('need_purchase');
      expect(paperBySheet?.suggestedPurchaseQuantity).toBeGreaterThan(0);
      expect(paperBySheet?.warnings).toContain(
        '材料名"修复纸"存在不同单位(2种)，请注意区分'
      );

      expect(paperByRoll?.currentStock).toBe(2);
      expect(paperByRoll?.status).toBe('urgent');

      expect(paste?.currentStock).toBe(500);
      expect(paste?.status).toBe('normal');
      expect(paste?.suggestedPurchaseQuantity).toBe(0);
    });
  });
});
