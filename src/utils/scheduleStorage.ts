import type {
  ScheduleData,
  RestorationStaff,
  ScheduleItem,
  StaffWorkloadConflict,
  RestorationProject,
  AutoRescheduleResult,
  ScheduleChange,
  UnresolvedConflict,
  UnresolvedConflictReason,
  ChangeType,
} from '../types';
import STORAGE_KEYS from './storageKeys';

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

export const detectStaffWorkloadConflicts = (
  staff: RestorationStaff[],
  schedules: ScheduleItem[]
): StaffWorkloadConflict[] => {
  const conflicts: StaffWorkloadConflict[] = [];
  const activeSchedules = schedules.filter(s => !s.completed);

  const dateStaffMap = new Map<string, Map<string, ScheduleItem[]>>();

  activeSchedules.forEach(schedule => {
    if (!schedule.scheduledDate) return;
    const date = schedule.scheduledDate;
    if (!dateStaffMap.has(date)) {
      dateStaffMap.set(date, new Map());
    }
    const staffMap = dateStaffMap.get(date)!;
    if (!staffMap.has(schedule.staffId)) {
      staffMap.set(schedule.staffId, []);
    }
    staffMap.get(schedule.staffId)!.push(schedule);
  });

  dateStaffMap.forEach((staffMap, date) => {
    staffMap.forEach((daySchedules, staffId) => {
      const staffMember = staff.find(s => s.id === staffId);
      if (!staffMember) return;

      const maxHours = staffMember.dailyWorkHours || 8;
      const scheduledHours = daySchedules.reduce((sum, s) => sum + s.estimatedHours, 0);

      if (scheduledHours > maxHours) {
        conflicts.push({
          staffId,
          staffName: staffMember.name,
          date,
          scheduledHours,
          maxHours,
          overloadHours: Math.round((scheduledHours - maxHours) * 10) / 10,
          relatedProjects: daySchedules.map(s => ({
            projectId: s.projectId,
            projectTitle: s.projectTitle || '',
            stepName: s.stepName || '',
            estimatedHours: s.estimatedHours,
          })),
        });
      }
    });
  });

  return conflicts.sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
};

export const getStaffConflicts = (
  staffId: string,
  staff: RestorationStaff[],
  schedules: ScheduleItem[]
): StaffWorkloadConflict[] => {
  return detectStaffWorkloadConflicts(staff, schedules)
    .filter(c => c.staffId === staffId);
};

export const getProjectConflicts = (
  projectId: string,
  staff: RestorationStaff[],
  schedules: ScheduleItem[]
): StaffWorkloadConflict[] => {
  return detectStaffWorkloadConflicts(staff, schedules)
    .filter(c => c.relatedProjects.some(p => p.projectId === projectId));
};

export const getDateConflicts = (
  date: string,
  staff: RestorationStaff[],
  schedules: ScheduleItem[]
): StaffWorkloadConflict[] => {
  return detectStaffWorkloadConflicts(staff, schedules)
    .filter(c => c.date === date);
};

export const hasMatchingSkill = (staffMember: RestorationStaff, stepName: string): boolean => {
  const skills = staffMember.skills || [];
  if (skills.length === 0) return true;
  const stepSkillMap: Record<string, string[]> = {
    '检查评估': ['检查评估', '评估'],
    '清理除尘': ['清理除尘', '清洁'],
    '脱酸处理': ['脱酸处理', '化学处理'],
    '补洞修复': ['补洞修复', '修复'],
    '托裱加固': ['托裱加固', '托裱', '修复'],
    '晾干定型': ['晾干定型', '干燥'],
    '装订整理': ['装订整理', '装订'],
    '消毒灭菌': ['消毒灭菌', '消毒'],
    '去霉处理': ['去霉处理', '清洁'],
    '清洗脱酸': ['清洗脱酸', '化学处理'],
    '吸水处理': ['吸水处理', '干燥'],
    '压平整理': ['压平整理', '整理'],
    '清理灰烬': ['清理除尘', '清洁'],
    '脆弱页处理': ['补洞修复', '修复'],
    '衬纸补强': ['托裱加固', '托裱', '修复'],
    '拼接对齐': ['补缀修复', '修复'],
    '补缀修复': ['补缀修复', '修复'],
    '晾干压平': ['晾干定型', '干燥'],
    '书页整理': ['书页整理', '整理'],
    '装订定位': ['装订整理', '装订'],
    '重新装订': ['装订整理', '装订'],
    '拆解检查': ['拆解检查', '检查评估'],
    '封面修复': ['封面修复', '修复'],
    '软化处理': ['软化处理', '化学处理'],
    '配纸选料': ['配纸选料', '修复'],
    '描样补写': ['描样补写', '修复'],
    '做旧处理': ['做旧处理', '修复'],
  };
  const requiredSkills = stepSkillMap[stepName] || [stepName];
  return requiredSkills.some(rs => skills.some(s => s.includes(rs) || rs.includes(s)));
};

const getStepIndex = (project: RestorationProject, stepName: string): number => {
  return project.restorationSteps.findIndex(s => s.name === stepName);
};

const getEarliestPossibleDate = (
  project: RestorationProject,
  stepIndex: number,
  today: Date,
  completedSteps: Set<string>
): Date => {
  let earliestDate = new Date(today);
  for (let i = 0; i < stepIndex; i++) {
    const step = project.restorationSteps[i];
    if (step.completed) {
      if (step.date) {
        const stepDate = new Date(step.date);
        stepDate.setDate(stepDate.getDate() + 1);
        if (stepDate > earliestDate) {
          earliestDate = new Date(stepDate);
        }
      }
      completedSteps.add(step.name);
    }
  }
  return earliestDate;
};

const getLatestPossibleDate = (
  project: RestorationProject,
  stepIndex: number,
  totalSteps: number
): Date => {
  const deliveryDate = new Date(project.deliveryDate);
  const remainingSteps = totalSteps - stepIndex - 1;
  const latestDate = new Date(deliveryDate);
  latestDate.setDate(latestDate.getDate() - remainingSteps);
  return latestDate;
};

const buildDateStaffLoadMap = (schedules: ScheduleItem[]): Map<string, Map<string, number>> => {
  const loadMap = new Map<string, Map<string, number>>();
  schedules.forEach(item => {
    if (!item.completed && item.scheduledDate) {
      if (!loadMap.has(item.scheduledDate)) {
        loadMap.set(item.scheduledDate, new Map());
      }
      const staffMap = loadMap.get(item.scheduledDate)!;
      staffMap.set(item.staffId, (staffMap.get(item.staffId) || 0) + item.estimatedHours);
    }
  });
  return loadMap;
};

const getChangeType = (oldItem: ScheduleItem, newItem: ScheduleItem): ChangeType => {
  const dateChanged = oldItem.scheduledDate !== newItem.scheduledDate;
  const staffChanged = oldItem.staffId !== newItem.staffId;
  if (dateChanged && staffChanged) return 'both';
  if (dateChanged) return 'moved_date';
  if (staffChanged) return 'changed_staff';
  return 'unchanged';
};

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const performAutoReschedule = (
  projects: RestorationProject[],
  staff: RestorationStaff[],
  schedules: ScheduleItem[],
  today: Date = new Date()
): AutoRescheduleResult => {
  today.setHours(0, 0, 0, 0);
  const todayStr = formatDate(today);

  const originalSchedules = [...schedules];
  const completedSchedules = schedules.filter(s => s.completed);
  const incompleteSchedules = schedules.filter(s => !s.completed);

  const totalConflictCountBefore = detectStaffWorkloadConflicts(staff, schedules).length;

  const undeliveredProjects = projects.filter(p => p.status !== 'delivered');

  const projectStepInfo = new Map<string, { earliestDate: Date; latestDate: Date; stepIndex: number }[]>();
  const completedSteps = new Set<string>();

  undeliveredProjects.forEach(project => {
    const stepInfos: { earliestDate: Date; latestDate: Date; stepIndex: number }[] = [];
    project.restorationSteps.forEach((step, idx) => {
      if (!step.completed) {
        const earliestDate = getEarliestPossibleDate(project, idx, today, completedSteps);
        const latestDate = getLatestPossibleDate(project, idx, project.restorationSteps.length);
        stepInfos.push({ earliestDate, latestDate, stepIndex: idx });
      }
    });
    projectStepInfo.set(project.id, stepInfos);
  });

  const proposedSchedules = [...completedSchedules];
  const tasksToReschedule: Array<{
    original: ScheduleItem;
    project: RestorationProject;
    stepIndex: number;
    earliestDate: Date;
    latestDate: Date;
  }> = [];

  incompleteSchedules.forEach(item => {
    const project = undeliveredProjects.find(p => p.id === item.projectId);
    if (!project) {
      proposedSchedules.push(item);
      return;
    }
    const stepIndex = getStepIndex(project, item.stepName || '');
    if (stepIndex === -1) {
      proposedSchedules.push(item);
      return;
    }
    const stepInfos = projectStepInfo.get(project.id);
    const stepInfo = stepInfos?.find(s => s.stepIndex === stepIndex);
    if (!stepInfo) {
      proposedSchedules.push(item);
      return;
    }
    tasksToReschedule.push({
      original: item,
      project,
      stepIndex,
      earliestDate: stepInfo.earliestDate,
      latestDate: stepInfo.latestDate,
    });
  });

  tasksToReschedule.sort((a, b) => {
    const aPriority = a.project.priority === 'high' ? 0 : a.project.priority === 'medium' ? 1 : 2;
    const bPriority = b.project.priority === 'high' ? 0 : b.project.priority === 'medium' ? 1 : 2;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.stepIndex - b.stepIndex;
  });

  const dateStaffLoad = buildDateStaffLoadMap(completedSchedules);
  const unresolvedConflicts: UnresolvedConflict[] = [];
  const changes: ScheduleChange[] = [];
  const assignedStepDates = new Map<string, Map<number, string>>();

  for (let taskIndex = 0; taskIndex < tasksToReschedule.length; taskIndex++) {
    const task = tasksToReschedule[taskIndex];
    const { original, project, stepIndex, latestDate } = task;

    let earliestDate = new Date(task.earliestDate);
    const projectAssignedDates = assignedStepDates.get(project.id);
    if (projectAssignedDates) {
      for (const [prevStepIdx, assignedDateStr] of projectAssignedDates) {
        if (prevStepIdx < stepIndex) {
          const assignedDate = new Date(assignedDateStr);
          assignedDate.setDate(assignedDate.getDate() + 1);
          if (assignedDate > earliestDate) {
            earliestDate = new Date(assignedDate);
          }
        }
      }
    }
    const todayStr = formatDate(today);
    const stepName = original.stepName || '';
    const hours = original.estimatedHours;
    const projectTitle = project.bookTitle;

    let bestDate: string | null = null;
    let bestStaff: RestorationStaff | null = null;
    let minScore = Infinity;

    let currentDate = new Date(earliestDate);
    if (formatDate(currentDate) < todayStr) {
      currentDate = new Date(today);
    }
    const startDate = new Date(currentDate);
    const hardDeadline = new Date(Math.min(latestDate.getTime(), new Date(project.deliveryDate).getTime()));

    while (currentDate <= hardDeadline) {
      const dateStr = formatDate(currentDate);

      if (!dateStaffLoad.has(dateStr)) {
        dateStaffLoad.set(dateStr, new Map());
      }
      const staffLoad = dateStaffLoad.get(dateStr)!;

      for (const staffMember of staff) {
        if (!hasMatchingSkill(staffMember, stepName)) {
          continue;
        }

        const currentLoad = staffLoad.get(staffMember.id) || 0;
        const maxHours = staffMember.dailyWorkHours || 8;
        const newLoad = currentLoad + hours;

        if (newLoad > maxHours) {
          continue;
        }

        const daysFromStart = (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        const staffChangePenalty = staffMember.id === original.staffId ? 0 : 5;
        const datePenalty = daysFromStart * 1;

        const score = currentLoad + staffChangePenalty + datePenalty;
        if (score < minScore) {
          minScore = score;
          bestDate = dateStr;
          bestStaff = staffMember;
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (!bestStaff || !bestDate) {
      for (const staffMember of staff) {
        if (!hasMatchingSkill(staffMember, stepName)) continue;

        const currentDate2 = new Date(earliestDate);
        while (currentDate2 <= hardDeadline) {
          const dateStr = formatDate(currentDate2);
          if (!dateStaffLoad.has(dateStr)) {
            dateStaffLoad.set(dateStr, new Map());
          }
          const staffLoad = dateStaffLoad.get(dateStr)!;
          const currentLoad = staffLoad.get(staffMember.id) || 0;
          const newLoad = currentLoad + hours;
          const maxHours = staffMember.dailyWorkHours || 8;

          if (newLoad <= maxHours) {
            bestDate = dateStr;
            bestStaff = staffMember;
            break;
          }
          currentDate2.setDate(currentDate2.getDate() + 1);
        }
        if (bestStaff && bestDate) break;
      }
    }

    if (bestStaff && bestDate) {
      const newItem: ScheduleItem = {
        ...original,
        scheduledDate: bestDate,
        staffId: bestStaff.id,
        staffName: bestStaff.name,
      };

      const changeType = getChangeType(original, newItem);
      if (changeType !== 'unchanged') {
        changes.push({
          scheduleItemId: original.id,
          projectId: project.id,
          projectTitle,
          stepName,
          changeType,
          oldDate: original.scheduledDate || '',
          newDate: bestDate,
          oldStaffId: original.staffId,
          oldStaffName: original.staffName || '',
          newStaffId: bestStaff.id,
          newStaffName: bestStaff.name,
          estimatedHours: hours,
        });
      }

      proposedSchedules.push(newItem);

      if (!dateStaffLoad.has(bestDate)) {
        dateStaffLoad.set(bestDate, new Map());
      }
      const staffLoad = dateStaffLoad.get(bestDate)!;
      staffLoad.set(bestStaff.id, (staffLoad.get(bestStaff.id) || 0) + hours);

      if (!assignedStepDates.has(project.id)) {
        assignedStepDates.set(project.id, new Map());
      }
      assignedStepDates.get(project.id)!.set(stepIndex, bestDate);
    } else {
      proposedSchedules.push(original);

      if (original.scheduledDate) {
        if (!assignedStepDates.has(project.id)) {
          assignedStepDates.set(project.id, new Map());
        }
        assignedStepDates.get(project.id)!.set(stepIndex, original.scheduledDate);
      }

      const deliveryDate = new Date(project.deliveryDate);
      const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      let reason: UnresolvedConflictReason = 'insufficient_staff';
      let reasonDescription = '';
      let suggestedActions: string[] = [];

      if (daysUntilDelivery < 0) {
        reason = 'delivery_too_tight';
        reasonDescription = `项目《${projectTitle}》已逾期，无法在当前人员配置下安排「${stepName}」步骤`;
        suggestedActions = ['增加修复人员', '与客户沟通调整交付日期', '简化修复流程'];
      } else if (daysUntilDelivery <= 3 && project.restorationSteps.filter(s => !s.completed).length > daysUntilDelivery) {
        reason = 'delivery_too_tight';
        reasonDescription = `项目《${projectTitle}》交付时间过紧（${daysUntilDelivery}天），步骤过多，无法完全分配`;
        suggestedActions = ['增加修复人员', '并行处理多个步骤', '与客户沟通调整交付日期'];
      } else if (staff.filter(s => hasMatchingSkill(s, stepName)).length === 0) {
        reason = 'skill_mismatch';
        reasonDescription = `没有擅长「${stepName}」技能的修复人员，无法安排该步骤`;
        suggestedActions = ['培训现有员工掌握该技能', '招聘具备该技能的修复人员', '外包该步骤'];
      } else {
        reason = 'insufficient_staff';
        reasonDescription = `修复人员不足，「${stepName}」（${hours}小时）无法在交付日期前合理安排`;
        suggestedActions = ['增加修复人员', '调整其他项目优先级', '延长工作时间'];
      }

      unresolvedConflicts.push({
        type: 'overload',
        severity: 'high',
        reason,
        reasonDescription,
        projectId: project.id,
        projectTitle,
        stepName,
        scheduledHours: hours,
        suggestedActions,
      });
    }
  }

  const conflictsAfter = detectStaffWorkloadConflicts(staff, proposedSchedules);
  const totalConflictCountAfter = conflictsAfter.length;

  conflictsAfter.forEach(conflict => {
    const alreadyRecorded = unresolvedConflicts.some(
      c => c.staffId === conflict.staffId && c.date === conflict.date
    );
    if (!alreadyRecorded) {
      unresolvedConflicts.push({
        type: 'overload',
        severity: conflict.overloadHours > 4 ? 'high' : conflict.overloadHours > 2 ? 'medium' : 'low',
        reason: 'partial_resolution',
        reasonDescription: `${conflict.staffName} 在 ${conflict.date} 仍有 ${conflict.overloadHours} 小时负载超出上限，已尽量优化但仍无法完全解决`,
        staffId: conflict.staffId,
        staffName: conflict.staffName,
        date: conflict.date,
        scheduledHours: conflict.scheduledHours,
        maxHours: conflict.maxHours,
        overloadHours: conflict.overloadHours,
        suggestedActions: [
          '将该日部分工作移至其他日期',
          '分配给其他有空闲的修复人员',
          '考虑增加临时人员',
        ],
      });
    }
  });

  const allDates = proposedSchedules
    .filter(s => s.scheduledDate)
    .map(s => new Date(s.scheduledDate!).getTime());

  const modifiedCount = changes.length;
  const unchangedCount = incompleteSchedules.length - modifiedCount;

  return {
    success: true,
    originalSchedules,
    proposedSchedules,
    changes,
    unchangedCount,
    modifiedCount,
    totalConflictCountBefore,
    totalConflictCountAfter,
    unresolvedConflicts,
    canApply: true,
    generatedAt: new Date().toISOString(),
    summary: {
      totalTasks: schedules.length,
      completedTasks: completedSchedules.length,
      rescheduledTasks: modifiedCount,
      conflictsResolved: Math.max(0, totalConflictCountBefore - totalConflictCountAfter),
      conflictsRemaining: totalConflictCountAfter + unresolvedConflicts.filter(c => c.type === 'overdue').length,
      earliestDate: allDates.length > 0 ? formatDate(new Date(Math.min(...allDates))) : todayStr,
      latestDate: allDates.length > 0 ? formatDate(new Date(Math.max(...allDates))) : todayStr,
    },
  };
};
