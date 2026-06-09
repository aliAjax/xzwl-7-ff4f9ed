import { describe, it, expect, beforeEach } from 'vitest';
import type {
  RestorationProject,
  RestorationStaff,
  ScheduleItem,
} from '../types';
import {
  detectStaffWorkloadConflicts,
  performAutoReschedule,
  getDefaultStepHours,
  hasMatchingSkill,
} from './scheduleStorage';

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const createStaff = (
  overrides: Partial<RestorationStaff> = {}
): RestorationStaff => ({
  id: `staff-${Math.random().toString(36).substr(2, 9)}`,
  name: '修复师',
  skills: ['检查评估', '清理除尘', '脱酸处理', '补洞修复', '托裱加固', '晾干定型', '装订整理'],
  dailyWorkHours: 8,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const createProject = (
  overrides: Partial<RestorationProject> = {}
): RestorationProject => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const defaultDelivery = formatDate(addDays(today, 30));

  return {
    id: `proj-${Math.random().toString(36).substr(2, 9)}`,
    bookTitle: '测试古籍',
    volumeCount: 1,
    damageTypes: ['虫蛀'],
    restorationSteps: [
      { id: 's1', name: '检查评估', description: '', completed: false, estimatedDuration: 2, notes: '' },
      { id: 's2', name: '清理除尘', description: '', completed: false, estimatedDuration: 1, notes: '' },
      { id: 's3', name: '脱酸处理', description: '', completed: false, estimatedDuration: 3, notes: '' },
      { id: 's4', name: '补洞修复', description: '', completed: false, estimatedDuration: 4, notes: '' },
    ],
    currentProgress: 0,
    status: 'restoring',
    materialsUsed: [],
    deliveryDate: defaultDelivery,
    priority: 'medium',
    description: '测试项目',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
};

const createScheduleItem = (
  overrides: Partial<ScheduleItem> = {}
): ScheduleItem => ({
  id: `sch-${Math.random().toString(36).substr(2, 9)}`,
  projectId: 'proj-1',
  projectTitle: '测试项目',
  stepName: '检查评估',
  staffId: 'staff-1',
  staffName: '修复师A',
  scheduledDate: formatDate(new Date()),
  estimatedHours: 2,
  status: 'scheduled',
  completed: false,
  ...overrides,
});

describe('scheduleStorage', () => {
  describe('getDefaultStepHours', () => {
    it('应返回已知步骤的默认工时', () => {
      expect(getDefaultStepHours('检查评估')).toBe(2);
      expect(getDefaultStepHours('清理除尘')).toBe(1);
      expect(getDefaultStepHours('脱酸处理')).toBe(3);
      expect(getDefaultStepHours('补洞修复')).toBe(4);
    });

    it('未知步骤应返回默认2小时', () => {
      expect(getDefaultStepHours('未知步骤')).toBe(2);
    });
  });

  describe('hasMatchingSkill', () => {
    it('无技能要求时应匹配任何人员', () => {
      const staff = createStaff({ skills: [] });
      expect(hasMatchingSkill(staff, '检查评估')).toBe(true);
    });

    it('有匹配技能时应返回true', () => {
      const staff = createStaff({ skills: ['检查评估', '修复'] });
      expect(hasMatchingSkill(staff, '检查评估')).toBe(true);
      expect(hasMatchingSkill(staff, '补洞修复')).toBe(true);
    });

    it('无匹配技能时应返回false', () => {
      const staff = createStaff({ skills: ['装订整理'] });
      expect(hasMatchingSkill(staff, '脱酸处理')).toBe(false);
    });

    it('部分匹配技能名称时应返回true', () => {
      const staff = createStaff({ skills: ['修复'] });
      expect(hasMatchingSkill(staff, '补洞修复')).toBe(true);
      expect(hasMatchingSkill(staff, '托裱加固')).toBe(true);
    });
  });

  describe('detectStaffWorkloadConflicts', () => {
    it('无冲突时应返回空数组', () => {
      const today = formatDate(new Date());
      const staff = [createStaff({ id: 'staff-1', name: '修复师A', dailyWorkHours: 8 })];
      const schedules = [
        createScheduleItem({ staffId: 'staff-1', staffName: '修复师A', scheduledDate: today, estimatedHours: 4 }),
        createScheduleItem({ staffId: 'staff-1', staffName: '修复师A', scheduledDate: today, estimatedHours: 3 }),
      ];

      const conflicts = detectStaffWorkloadConflicts(staff, schedules);
      expect(conflicts.length).toBe(0);
    });

    it('人员日工时超时时应检测到冲突', () => {
      const today = formatDate(new Date());
      const staff = [createStaff({ id: 'staff-1', name: '修复师A', dailyWorkHours: 8 })];
      const schedules = [
        createScheduleItem({ staffId: 'staff-1', staffName: '修复师A', scheduledDate: today, estimatedHours: 5 }),
        createScheduleItem({ staffId: 'staff-1', staffName: '修复师A', scheduledDate: today, estimatedHours: 5 }),
      ];

      const conflicts = detectStaffWorkloadConflicts(staff, schedules);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].staffId).toBe('staff-1');
      expect(conflicts[0].overloadHours).toBe(2);
      expect(conflicts[0].scheduledHours).toBe(10);
    });

    it('已完成的排期不应计入冲突检测', () => {
      const today = formatDate(new Date());
      const staff = [createStaff({ id: 'staff-1', name: '修复师A', dailyWorkHours: 8 })];
      const schedules = [
        createScheduleItem({ staffId: 'staff-1', staffName: '修复师A', scheduledDate: today, estimatedHours: 5, completed: true }),
        createScheduleItem({ staffId: 'staff-1', staffName: '修复师A', scheduledDate: today, estimatedHours: 5, completed: false }),
      ];

      const conflicts = detectStaffWorkloadConflicts(staff, schedules);
      expect(conflicts.length).toBe(0);
    });

    it('多个日期多个人员的冲突应分别检测', () => {
      const today = formatDate(new Date());
      const tomorrow = formatDate(addDays(new Date(), 1));
      const staff = [
        createStaff({ id: 'staff-1', name: '修复师A', dailyWorkHours: 8 }),
        createStaff({ id: 'staff-2', name: '修复师B', dailyWorkHours: 8 }),
      ];
      const schedules = [
        createScheduleItem({ staffId: 'staff-1', staffName: '修复师A', scheduledDate: today, estimatedHours: 10 }),
        createScheduleItem({ staffId: 'staff-2', staffName: '修复师B', scheduledDate: tomorrow, estimatedHours: 9 }),
      ];

      const conflicts = detectStaffWorkloadConflicts(staff, schedules);
      expect(conflicts.length).toBe(2);
      expect(conflicts[0].date).toBe(today);
      expect(conflicts[1].date).toBe(tomorrow);
    });

    it('冲突应按日期排序', () => {
      const today = formatDate(new Date());
      const tomorrow = formatDate(addDays(new Date(), 1));
      const staff = [createStaff({ id: 'staff-1', name: '修复师A', dailyWorkHours: 8 })];
      const schedules = [
        createScheduleItem({ staffId: 'staff-1', staffName: '修复师A', scheduledDate: tomorrow, estimatedHours: 10 }),
        createScheduleItem({ staffId: 'staff-1', staffName: '修复师A', scheduledDate: today, estimatedHours: 10 }),
      ];

      const conflicts = detectStaffWorkloadConflicts(staff, schedules);
      expect(conflicts[0].date).toBe(today);
      expect(conflicts[1].date).toBe(tomorrow);
    });
  });

  describe('performAutoReschedule', () => {
    let staff: RestorationStaff[];
    let projects: RestorationProject[];

    beforeEach(() => {
      staff = [
        createStaff({ id: 'staff-1', name: '修复师A' }),
        createStaff({ id: 'staff-2', name: '修复师B' }),
      ];
      projects = [];
    });

    it('无待排程任务时应返回无变化的结果', () => {
      const schedules: ScheduleItem[] = [];
      const result = performAutoReschedule(projects, staff, schedules);

      expect(result.success).toBe(true);
      expect(result.changes.length).toBe(0);
      expect(result.unchangedCount).toBe(0);
      expect(result.modifiedCount).toBe(0);
      expect(result.totalConflictCountBefore).toBe(0);
      expect(result.totalConflictCountAfter).toBe(0);
    });

    it('已有排期无冲突时应保持不变', () => {
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const today = formatDate(todayDate);
      const project = createProject({ id: 'proj-1', bookTitle: '古籍A' });
      projects = [project];

      const schedules = [
        createScheduleItem({
          id: 'sch-1',
          projectId: 'proj-1',
          projectTitle: '古籍A',
          stepName: '检查评估',
          staffId: 'staff-1',
          staffName: '修复师A',
          scheduledDate: today,
          estimatedHours: 2,
        }),
      ];

      const result = performAutoReschedule(projects, staff, schedules, todayDate);

      expect(result.changes.length).toBe(0);
      expect(result.unchangedCount).toBe(1);
      expect(result.proposedSchedules[0].staffId).toBe('staff-1');
      expect(result.proposedSchedules[0].scheduledDate).toBe(today);
    });

    it('应能解决人员过载冲突', () => {
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const today = formatDate(todayDate);
      const project = createProject({
        id: 'proj-1',
        bookTitle: '古籍A',
        restorationSteps: [
          { id: 's1', name: '检查评估', description: '', completed: false, estimatedDuration: 2, notes: '' },
          { id: 's2', name: '清理除尘', description: '', completed: false, estimatedDuration: 7, notes: '' },
          { id: 's3', name: '脱酸处理', description: '', completed: false, estimatedDuration: 2, notes: '' },
          { id: 's4', name: '补洞修复', description: '', completed: false, estimatedDuration: 6, notes: '' },
        ],
      });
      projects = [project];

      const schedules = [
        createScheduleItem({
          id: 'sch-1',
          projectId: 'proj-1',
          projectTitle: '古籍A',
          stepName: '检查评估',
          staffId: 'staff-1',
          staffName: '修复师A',
          scheduledDate: today,
          estimatedHours: 5,
        }),
        createScheduleItem({
          id: 'sch-2',
          projectId: 'proj-1',
          projectTitle: '古籍A',
          stepName: '清理除尘',
          staffId: 'staff-1',
          staffName: '修复师A',
          scheduledDate: today,
          estimatedHours: 5,
        }),
      ];

      const conflictsBefore = detectStaffWorkloadConflicts(staff, schedules);
      expect(conflictsBefore.length).toBeGreaterThan(0);

      const result = performAutoReschedule(projects, staff, schedules, todayDate);

      expect(result.totalConflictCountAfter).toBeLessThan(result.totalConflictCountBefore);
      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.summary.conflictsResolved).toBeGreaterThan(0);
    });

    it('应遵守步骤顺序约束', () => {
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const project = createProject({
        id: 'proj-1',
        bookTitle: '古籍A',
        restorationSteps: [
          { id: 's1', name: '检查评估', description: '', completed: false, estimatedDuration: 2, notes: '' },
          { id: 's2', name: '清理除尘', description: '', completed: false, estimatedDuration: 2, notes: '' },
          { id: 's3', name: '脱酸处理', description: '', completed: false, estimatedDuration: 2, notes: '' },
        ],
      });
      projects = [project];

      const schedules = [
        createScheduleItem({
          id: 'sch-3',
          projectId: 'proj-1',
          projectTitle: '古籍A',
          stepName: '脱酸处理',
          staffId: 'staff-1',
          staffName: '修复师A',
          scheduledDate: formatDate(addDays(todayDate, 1)),
          estimatedHours: 2,
        }),
        createScheduleItem({
          id: 'sch-1',
          projectId: 'proj-1',
          projectTitle: '古籍A',
          stepName: '检查评估',
          staffId: 'staff-1',
          staffName: '修复师A',
          scheduledDate: formatDate(addDays(todayDate, 5)),
          estimatedHours: 2,
        }),
        createScheduleItem({
          id: 'sch-2',
          projectId: 'proj-1',
          projectTitle: '古籍A',
          stepName: '清理除尘',
          staffId: 'staff-1',
          staffName: '修复师A',
          scheduledDate: formatDate(addDays(todayDate, 3)),
          estimatedHours: 2,
        }),
      ];

      const result = performAutoReschedule(projects, staff, schedules, todayDate);

      const stepDates = new Map<string, string>();
      result.proposedSchedules.forEach(s => {
        if (s.stepName && s.scheduledDate) {
          stepDates.set(s.stepName, s.scheduledDate);
        }
      });

      const date1 = stepDates.get('检查评估');
      const date2 = stepDates.get('清理除尘');
      const date3 = stepDates.get('脱酸处理');

      expect(date1 && date2 && date3).toBeTruthy();
      if (date1 && date2 && date3) {
        expect(new Date(date1).getTime()).toBeLessThanOrEqual(new Date(date2).getTime());
        expect(new Date(date2).getTime()).toBeLessThanOrEqual(new Date(date3).getTime());
      }
    });

    it('高优先级项目应优先排程', () => {
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const today = formatDate(todayDate);
      const projectHigh = createProject({
        id: 'proj-high',
        bookTitle: '紧急古籍',
        priority: 'high',
        restorationSteps: [
          { id: 's1', name: '检查评估', description: '', completed: false, estimatedDuration: 2, notes: '' },
        ],
      });
      const projectLow = createProject({
        id: 'proj-low',
        bookTitle: '普通古籍',
        priority: 'low',
        restorationSteps: [
          { id: 's1', name: '检查评估', description: '', completed: false, estimatedDuration: 2, notes: '' },
        ],
      });
      projects = [projectHigh, projectLow];

      const limitedStaff = [createStaff({ id: 'staff-1', name: '修复师A', dailyWorkHours: 2 })];

      const schedules = [
        createScheduleItem({
          id: 'sch-low',
          projectId: 'proj-low',
          projectTitle: '普通古籍',
          stepName: '检查评估',
          staffId: 'staff-1',
          staffName: '修复师A',
          scheduledDate: today,
          estimatedHours: 2,
        }),
        createScheduleItem({
          id: 'sch-high',
          projectId: 'proj-high',
          projectTitle: '紧急古籍',
          stepName: '检查评估',
          staffId: 'staff-1',
          staffName: '修复师A',
          scheduledDate: formatDate(addDays(todayDate, 5)),
          estimatedHours: 2,
        }),
      ];

      const result = performAutoReschedule(projects, limitedStaff, schedules, todayDate);

      const highSchedule = result.proposedSchedules.find(s => s.projectId === 'proj-high');
      const lowSchedule = result.proposedSchedules.find(s => s.projectId === 'proj-low');

      expect(highSchedule?.scheduledDate && lowSchedule?.scheduledDate).toBeTruthy();
      if (highSchedule?.scheduledDate && lowSchedule?.scheduledDate) {
        expect(new Date(highSchedule.scheduledDate).getTime()).toBeLessThanOrEqual(new Date(lowSchedule.scheduledDate).getTime());
      }
    });

    it('已完成的排期项不应被修改', () => {
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const today = formatDate(todayDate);
      const project = createProject({
        id: 'proj-1',
        bookTitle: '古籍A',
        restorationSteps: [
          { id: 's1', name: '检查评估', description: '', completed: true, estimatedDuration: 2, notes: '', completedAt: new Date().toISOString(), date: formatDate(addDays(todayDate, -5)) },
          { id: 's2', name: '清理除尘', description: '', completed: false, estimatedDuration: 2, notes: '' },
        ],
      });
      projects = [project];

      const originalDate = formatDate(addDays(todayDate, -5));
      const schedules = [
        createScheduleItem({
          id: 'sch-1',
          projectId: 'proj-1',
          projectTitle: '古籍A',
          stepName: '检查评估',
          staffId: 'staff-1',
          staffName: '修复师A',
          scheduledDate: originalDate,
          estimatedHours: 2,
          completed: true,
        }),
        createScheduleItem({
          id: 'sch-2',
          projectId: 'proj-1',
          projectTitle: '古籍A',
          stepName: '清理除尘',
          staffId: 'staff-1',
          staffName: '修复师A',
          scheduledDate: today,
          estimatedHours: 2,
          completed: false,
        }),
      ];

      const result = performAutoReschedule(projects, staff, schedules, todayDate);

      const completedSchedule = result.proposedSchedules.find(s => s.id === 'sch-1');
      expect(completedSchedule?.scheduledDate).toBe(originalDate);
      expect(completedSchedule?.staffId).toBe('staff-1');

      const changeForCompleted = result.changes.find(c => c.scheduleItemId === 'sch-1');
      expect(changeForCompleted).toBeUndefined();
    });

    it('应考虑人员技能匹配', () => {
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const today = formatDate(todayDate);
      const skilledStaff = createStaff({
        id: 'staff-skilled',
        name: '专业修复师',
        skills: ['脱酸处理'],
      });
      const unskilledStaff = createStaff({
        id: 'staff-unskilled',
        name: '新手修复师',
        skills: ['检查评估'],
      });
      staff = [skilledStaff, unskilledStaff];

      const project = createProject({
        id: 'proj-1',
        bookTitle: '古籍A',
        restorationSteps: [
          { id: 's1', name: '脱酸处理', description: '', completed: false, estimatedDuration: 4, notes: '' },
        ],
      });
      projects = [project];

      const schedules = [
        createScheduleItem({
          id: 'sch-1',
          projectId: 'proj-1',
          projectTitle: '古籍A',
          stepName: '脱酸处理',
          staffId: 'staff-unskilled',
          staffName: '新手修复师',
          scheduledDate: today,
          estimatedHours: 4,
        }),
      ];

      const result = performAutoReschedule(projects, staff, schedules, todayDate);

      const proposedSchedule = result.proposedSchedules.find(s => s.id === 'sch-1');
      expect(proposedSchedule?.staffId).toBe('staff-skilled');
    });

    it('交付日期过紧时应标记为未解决冲突', () => {
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const yesterday = formatDate(addDays(todayDate, -1));
      const project = createProject({
        id: 'proj-1',
        bookTitle: '逾期古籍',
        deliveryDate: yesterday,
        restorationSteps: [
          { id: 's1', name: '检查评估', description: '', completed: false, estimatedDuration: 2, notes: '' },
          { id: 's2', name: '清理除尘', description: '', completed: false, estimatedDuration: 2, notes: '' },
          { id: 's3', name: '脱酸处理', description: '', completed: false, estimatedDuration: 2, notes: '' },
        ],
      });
      projects = [project];

      const schedules = [
        createScheduleItem({
          id: 'sch-1',
          projectId: 'proj-1',
          projectTitle: '逾期古籍',
          stepName: '检查评估',
          staffId: 'staff-1',
          staffName: '修复师A',
          scheduledDate: yesterday,
          estimatedHours: 2,
        }),
        createScheduleItem({
          id: 'sch-2',
          projectId: 'proj-1',
          projectTitle: '逾期古籍',
          stepName: '清理除尘',
          staffId: 'staff-1',
          staffName: '修复师A',
          scheduledDate: yesterday,
          estimatedHours: 2,
        }),
        createScheduleItem({
          id: 'sch-3',
          projectId: 'proj-1',
          projectTitle: '逾期古籍',
          stepName: '脱酸处理',
          staffId: 'staff-1',
          staffName: '修复师A',
          scheduledDate: yesterday,
          estimatedHours: 2,
        }),
      ];

      const result = performAutoReschedule(projects, staff, schedules, todayDate);

      expect(result.unresolvedConflicts.length).toBeGreaterThan(0);
      const deliveryConflict = result.unresolvedConflicts.find(c => c.reason === 'delivery_too_tight');
      expect(deliveryConflict).toBeDefined();
    });

    it('综合场景：复杂排程优化', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const proj1 = createProject({
        id: 'proj-1',
        bookTitle: '古籍A',
        priority: 'high',
        deliveryDate: formatDate(addDays(today, 10)),
        restorationSteps: [
          { id: 's1', name: '检查评估', description: '', completed: false, estimatedDuration: 2, notes: '' },
          { id: 's2', name: '清理除尘', description: '', completed: false, estimatedDuration: 1, notes: '' },
          { id: 's3', name: '脱酸处理', description: '', completed: false, estimatedDuration: 3, notes: '' },
        ],
      });

      const proj2 = createProject({
        id: 'proj-2',
        bookTitle: '古籍B',
        priority: 'medium',
        deliveryDate: formatDate(addDays(today, 20)),
        restorationSteps: [
          { id: 's1', name: '检查评估', description: '', completed: false, estimatedDuration: 2, notes: '' },
          { id: 's2', name: '补洞修复', description: '', completed: false, estimatedDuration: 4, notes: '' },
        ],
      });

      projects = [proj1, proj2];

      const schedules: ScheduleItem[] = [
        { id: 'sch-1-1', projectId: 'proj-1', projectTitle: '古籍A', stepName: '检查评估', staffId: 'staff-1', staffName: '修复师A', scheduledDate: formatDate(today), estimatedHours: 2, completed: false },
        { id: 'sch-1-2', projectId: 'proj-1', projectTitle: '古籍A', stepName: '清理除尘', staffId: 'staff-1', staffName: '修复师A', scheduledDate: formatDate(today), estimatedHours: 7, completed: false },
        { id: 'sch-1-3', projectId: 'proj-1', projectTitle: '古籍A', stepName: '脱酸处理', staffId: 'staff-1', staffName: '修复师A', scheduledDate: formatDate(addDays(today, 1)), estimatedHours: 3, completed: false },
        { id: 'sch-2-1', projectId: 'proj-2', projectTitle: '古籍B', stepName: '检查评估', staffId: 'staff-2', staffName: '修复师B', scheduledDate: formatDate(today), estimatedHours: 3, completed: false },
        { id: 'sch-2-2', projectId: 'proj-2', projectTitle: '古籍B', stepName: '补洞修复', staffId: 'staff-2', staffName: '修复师B', scheduledDate: formatDate(today), estimatedHours: 6, completed: false },
      ];

      const conflictsBefore = detectStaffWorkloadConflicts(staff, schedules);
      expect(conflictsBefore.length).toBeGreaterThan(0);

      const result = performAutoReschedule(projects, staff, schedules, today);

      expect(result.success).toBe(true);
      expect(result.totalConflictCountAfter).toBeLessThanOrEqual(result.totalConflictCountBefore);
      expect(result.changes.length).toBeGreaterThan(0);

      const conflictsAfter = detectStaffWorkloadConflicts(staff, result.proposedSchedules);
      expect(conflictsAfter.length).toBeLessThan(conflictsBefore.length);
    });
  });
});
