import { useState, useMemo, useEffect } from 'react';
import type {
  RestorationProject,
  RestorationStaff,
  ScheduleItem,
  ProjectSchedule,
  StepWorkEstimate,
  AutoRescheduleResult,
} from '../types';
import {
  getScheduleData,
  saveScheduleData,
  generateStaffId,
  generateScheduleItemId,
  getDefaultStepHours,
  detectStaffWorkloadConflicts,
  getStaffConflicts,
  getProjectConflicts,
  getDateConflicts,
  performAutoReschedule,
} from '../utils/storage';
import { STATUS_LABELS } from '../types';
import type { StaffWorkloadConflict } from '../types';
import AutoRescheduleModal from './AutoRescheduleModal';

type ScheduleTab = 'staff' | 'projects' | 'calendar';

interface RestorationScheduleProps {
  projects: RestorationProject[];
  onSelectProject: (project: RestorationProject) => void;
}

export default function RestorationSchedule({ projects, onSelectProject }: RestorationScheduleProps) {
  const [activeTab, setActiveTab] = useState<ScheduleTab>('staff');
  const [staff, setStaff] = useState<RestorationStaff[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [projectSchedules, setProjectSchedules] = useState<ProjectSchedule[]>([]);
  const [editingStaff, setEditingStaff] = useState<RestorationStaff | null>(null);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState<RestorationProject | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [, setWorkloadConflicts] = useState<StaffWorkloadConflict[]>([]);
  const [showConflictDetail, setShowConflictDetail] = useState<StaffWorkloadConflict | null>(null);
  const [autoRescheduleResult, setAutoRescheduleResult] = useState<AutoRescheduleResult | null>(null);
  const [showAutoRescheduleModal, setShowAutoRescheduleModal] = useState(false);
  const [isAutoRescheduling, setIsAutoRescheduling] = useState(false);

  useEffect(() => {
    const data = getScheduleData();
    setStaff(data.staff);
    setSchedules(data.schedules);
    setProjectSchedules(data.projectSchedules);
  }, []);

  useEffect(() => {
    const conflicts = detectStaffWorkloadConflicts(staff, schedules);
    setWorkloadConflicts(conflicts);
  }, [staff, schedules]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const undeliveredProjects = useMemo(() => {
    return projects.filter(p => p.status !== 'delivered');
  }, [projects]);

  const getDaysUntilDelivery = (deliveryDate: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const delivery = new Date(deliveryDate);
    delivery.setHours(0, 0, 0, 0);
    const diffTime = delivery.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleSaveStaff = (staffData: Omit<RestorationStaff, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString().split('T')[0];
    let updatedStaff: RestorationStaff[];

    if (editingStaff) {
      updatedStaff = staff.map(s =>
        s.id === editingStaff.id
          ? { ...s, ...staffData, updatedAt: now }
          : s
      );
    } else {
      const newStaff: RestorationStaff = {
        ...staffData,
        id: generateStaffId(),
        createdAt: now,
        updatedAt: now,
      };
      updatedStaff = [...staff, newStaff];
    }

    setStaff(updatedStaff);
    setShowStaffForm(false);
    setEditingStaff(null);

    const result = saveScheduleData({ staff: updatedStaff, schedules, projectSchedules });
    if (result.success) {
      setMessage({ type: 'success', text: '人员信息保存成功' });
    } else {
      setMessage({ type: 'error', text: result.error || '保存失败' });
    }
  };

  const handleDeleteStaff = (staffId: string) => {
    const staffMember = staff.find(s => s.id === staffId);
    if (!staffMember) return;

    if (window.confirm(`确定要删除修复师「${staffMember.name}」吗？相关排班也会被删除。`)) {
      const updatedStaff = staff.filter(s => s.id !== staffId);
      const updatedSchedules = schedules.filter(s => s.staffId !== staffId);
      setStaff(updatedStaff);
      setSchedules(updatedSchedules);

      const result = saveScheduleData({ staff: updatedStaff, schedules: updatedSchedules, projectSchedules });
      if (result.success) {
        setMessage({ type: 'success', text: '删除成功' });
      } else {
        setMessage({ type: 'error', text: result.error || '删除失败' });
      }
    }
  };

  const handleEditStaff = (staffMember: RestorationStaff) => {
    setEditingStaff(staffMember);
    setShowStaffForm(true);
  };

  const getProjectSchedule = (projectId: string): ProjectSchedule | undefined => {
    return projectSchedules.find(ps => ps.projectId === projectId);
  };

  const getProjectScheduleItems = (projectId: string): ScheduleItem[] => {
    return schedules.filter(s => s.projectId === projectId);
  };

  const initializeProjectSchedule = (project: RestorationProject) => {
    const existing = getProjectSchedule(project.id);
    if (existing) return;

    const now = new Date().toISOString().split('T')[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentDate = new Date(today);
    const stepEstimates: StepWorkEstimate[] = project.restorationSteps.map(step => {
      let scheduledDate: string | null = null;
      if (!step.completed) {
        scheduledDate = currentDate.toISOString().split('T')[0];
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return {
        stepName: step.name,
        estimatedHours: getDefaultStepHours(step.name),
        assignedStaffId: undefined,
        scheduledDate,
      };
    });

    const newProjectSchedule: ProjectSchedule = {
      projectId: project.id,
      stepEstimates,
      createdAt: now,
      updatedAt: now,
    };

    const updatedProjectSchedules = [...projectSchedules, newProjectSchedule];
    setProjectSchedules(updatedProjectSchedules);

    const result = saveScheduleData({ staff, schedules, projectSchedules: updatedProjectSchedules });
    if (result.success) {
      setMessage({ type: 'success', text: '项目排班已初始化' });
    }
  };

  const calculateBackwardSchedule = (project: RestorationProject): StepWorkEstimate[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deliveryDate = new Date(project.deliveryDate);
    deliveryDate.setHours(0, 0, 0, 0);

    const incompleteSteps = project.restorationSteps
      .map((step, idx) => ({ ...step, idx }))
      .filter(s => !s.completed);

    if (incompleteSteps.length === 0) {
      return project.restorationSteps.map((step) => ({
        stepName: step.name,
        estimatedHours: getDefaultStepHours(step.name),
        assignedStaffId: undefined,
        scheduledDate: step.completed ? (step.date || null) : null,
      }));
    }

    const totalHours = incompleteSteps.reduce(
      (sum, s) => sum + getDefaultStepHours(s.name),
      0
    );
    const avgDailyHours = staff.length > 0
      ? staff.reduce((sum, s) => sum + (s.dailyWorkHours || 8), 0) / staff.length
      : 6;
    let estimatedDays = Math.ceil(totalHours / avgDailyHours);
    estimatedDays = Math.max(estimatedDays, incompleteSteps.length);

    let currentDate = new Date(deliveryDate);
    const stepEstimates: StepWorkEstimate[] = project.restorationSteps.map(step => ({
      stepName: step.name,
      estimatedHours: getDefaultStepHours(step.name),
      assignedStaffId: undefined,
      scheduledDate: step.completed ? (step.date || null) : null,
    }));

    for (let i = incompleteSteps.length - 1; i >= 0; i--) {
      const step = incompleteSteps[i];
      const stepHours = getDefaultStepHours(step.name);
      const daysNeeded = Math.max(1, Math.ceil(stepHours / avgDailyHours));

      for (let d = daysNeeded - 1; d >= 0; d--) {
        const scheduleDate = new Date(currentDate);
        scheduleDate.setDate(scheduleDate.getDate() - d);

        if (scheduleDate < today) {
          scheduleDate.setTime(today.getTime());
        }

        if (d === 0) {
          stepEstimates[step.idx].scheduledDate = scheduleDate.toISOString().split('T')[0];
        }
      }

      currentDate.setDate(currentDate.getDate() - daysNeeded);
    }

    const earliestDate = new Date(Math.min(
      ...incompleteSteps
        .map(s => stepEstimates[s.idx].scheduledDate)
        .filter(Boolean)
        .map(d => new Date(d!).getTime()),
      today.getTime()
    ));

    if (earliestDate < today) {
      const daysToShift = Math.ceil((today.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24));
      incompleteSteps.forEach(step => {
        if (stepEstimates[step.idx].scheduledDate) {
          const d = new Date(stepEstimates[step.idx].scheduledDate!);
          d.setDate(d.getDate() + daysToShift);
          stepEstimates[step.idx].scheduledDate = d.toISOString().split('T')[0];
        }
      });
    }

    return stepEstimates;
  };

  const autoAssignStaffToSteps = (
    project: RestorationProject,
    stepEstimates: StepWorkEstimate[]
  ): StepWorkEstimate[] => {
    if (staff.length === 0) return stepEstimates;

    const incompleteSteps = project.restorationSteps
      .map((step, idx) => ({ ...step, idx }))
      .filter(s => !s.completed);

    const dateStaffLoad = new Map<string, Map<string, number>>();
    schedules.forEach(item => {
      if (!item.completed) {
        if (!dateStaffLoad.has(item.scheduledDate!)) {
          dateStaffLoad.set(item.scheduledDate!, new Map());
        }
        const staffMap = dateStaffLoad.get(item.scheduledDate!)!;
        staffMap.set(item.staffId, (staffMap.get(item.staffId) || 0) + item.estimatedHours);
      }
    });

    const staffTotalLoad = new Map<string, number>();
    schedules.forEach(item => {
      if (!item.completed) {
        staffTotalLoad.set(item.staffId, (staffTotalLoad.get(item.staffId) || 0) + item.estimatedHours);
      }
    });

    const updatedEstimates = [...stepEstimates];

    incompleteSteps.forEach(step => {
      const estimate = updatedEstimates[step.idx];
      if (!estimate.scheduledDate || estimate.assignedStaffId) return;

      const stepHours = estimate.estimatedHours;
      const date = estimate.scheduledDate;

      if (!dateStaffLoad.has(date)) {
        dateStaffLoad.set(date, new Map());
      }
      const staffLoad = dateStaffLoad.get(date)!;

      let bestStaff: RestorationStaff | null = null;
      let minScore = Infinity;

      staff.forEach(s => {
        const currentLoad = staffLoad.get(s.id) || 0;
        const totalLoad = staffTotalLoad.get(s.id) || 0;
        const newLoad = currentLoad + stepHours;

        if (newLoad <= (s.dailyWorkHours || 8)) {
          const score = currentLoad * 2 + totalLoad * 0.5;
          if (score < minScore) {
            bestStaff = s;
            minScore = score;
          }
        }
      });

      if (!bestStaff) {
        let minOverloadScore = Infinity;
        staff.forEach(s => {
          const currentLoad = staffLoad.get(s.id) || 0;
          const totalLoad = staffTotalLoad.get(s.id) || 0;
          const newLoad = currentLoad + stepHours;
          const overload = Math.max(0, newLoad - (s.dailyWorkHours || 8));
          const score = overload * 10 + currentLoad + totalLoad * 0.5;

          if (score < minOverloadScore) {
            bestStaff = s;
            minOverloadScore = score;
          }
        });
      }

      if (bestStaff) {
        const selectedStaff = bestStaff as RestorationStaff;
        updatedEstimates[step.idx] = {
          ...estimate,
          assignedStaffId: selectedStaff.id,
        };
        const currentLoad = staffLoad.get(selectedStaff.id) || 0;
        staffLoad.set(selectedStaff.id, currentLoad + stepHours);
        staffTotalLoad.set(selectedStaff.id, (staffTotalLoad.get(selectedStaff.id) || 0) + stepHours);
      }
    });

    return updatedEstimates;
  };

  const buildSchedulesFromEstimates = (
    project: RestorationProject,
    stepEstimates: StepWorkEstimate[]
  ): ScheduleItem[] | null => {
    const incompleteEstimates = stepEstimates.filter(
      (_est, idx) => !project.restorationSteps[idx].completed
    );

    if (incompleteEstimates.some(e => !e.assignedStaffId || !e.scheduledDate || e.estimatedHours <= 0)) {
      return null;
    }

    const existingSchedules = schedules.filter(s => s.projectId === project.id && !s.completed);
    const newSchedules = [...schedules.filter(s => s.projectId !== project.id || s.completed)];

    incompleteEstimates.forEach((estimate) => {
      const staffMember = staff.find(s => s.id === estimate.assignedStaffId);
      if (!staffMember) return;

      const existing = existingSchedules.find(s => s.stepName === estimate.stepName);
      if (existing) {
        newSchedules.push({
          ...existing,
          estimatedHours: estimate.estimatedHours,
          staffId: estimate.assignedStaffId!,
          staffName: staffMember.name,
          scheduledDate: estimate.scheduledDate!,
        });
      } else {
        newSchedules.push({
          id: generateScheduleItemId(),
          projectId: project.id,
          projectTitle: project.bookTitle,
          stepName: estimate.stepName,
          staffId: estimate.assignedStaffId!,
          staffName: staffMember.name,
          scheduledDate: estimate.scheduledDate!,
          estimatedHours: estimate.estimatedHours,
          completed: false,
        });
      }
    });

    return newSchedules;
  };

  const autoScheduleProject = (project: RestorationProject, mode: 'forward' | 'backward' = 'backward') => {
    const existing = getProjectSchedule(project.id);

    let stepEstimates: StepWorkEstimate[];

    if (mode === 'backward') {
      stepEstimates = calculateBackwardSchedule(project);
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let currentDate = new Date(today);

      stepEstimates = project.restorationSteps.map(step => {
        let scheduledDate: string | null = null;
        if (!step.completed) {
          scheduledDate = currentDate.toISOString().split('T')[0];
          currentDate.setDate(currentDate.getDate() + 1);
        }
        return {
          stepName: step.name,
          estimatedHours: getDefaultStepHours(step.name),
          assignedStaffId: undefined,
          scheduledDate,
        };
      });
    }

    stepEstimates = autoAssignStaffToSteps(project, stepEstimates);

    const now = new Date().toISOString().split('T')[0];
    const newSchedules = buildSchedulesFromEstimates(project, stepEstimates);

    const modeText = mode === 'backward' ? '倒排模式' : '顺排模式';

    if (existing) {
      const updatedProjectSchedules = projectSchedules.map(ps => {
        if (ps.projectId !== project.id) return ps;
        return { ...ps, stepEstimates, updatedAt: now };
      });
      setProjectSchedules(updatedProjectSchedules);
      if (newSchedules) {
        setSchedules(newSchedules);
      }
      const result = saveScheduleData({
        staff,
        schedules: newSchedules || schedules,
        projectSchedules: updatedProjectSchedules,
      });
      if (result.success) {
        setMessage({
          type: newSchedules ? 'success' : 'error',
          text: newSchedules
            ? `自动排班完成（${modeText}），已同步到日历`
            : '自动排班已生成估算，但缺少负责人或日期，无法同步到日历',
        });
      }
    } else {
      const newProjectSchedule: ProjectSchedule = {
        projectId: project.id,
        stepEstimates,
        createdAt: now,
        updatedAt: now,
      };
      const updatedProjectSchedules = [...projectSchedules, newProjectSchedule];
      setProjectSchedules(updatedProjectSchedules);
      if (newSchedules) {
        setSchedules(newSchedules);
      }
      const result = saveScheduleData({
        staff,
        schedules: newSchedules || schedules,
        projectSchedules: updatedProjectSchedules,
      });
      if (result.success) {
        setMessage({
          type: newSchedules ? 'success' : 'error',
          text: newSchedules
            ? `自动排班完成（${modeText}），已同步到日历`
            : '自动排班已生成估算，但缺少负责人或日期，无法同步到日历',
        });
      }
    }
  };

  const handleStepEstimateChange = (
    projectId: string,
    stepIndex: number,
    field: keyof StepWorkEstimate,
    value: string | number | null
  ) => {
    const now = new Date().toISOString().split('T')[0];
    const updatedProjectSchedules = projectSchedules.map(ps => {
      if (ps.projectId !== projectId) return ps;
      const updatedEstimates = [...(ps.stepEstimates || [])];
      updatedEstimates[stepIndex] = {
        ...updatedEstimates[stepIndex],
        [field]: value,
      };
      return { ...ps, stepEstimates: updatedEstimates, updatedAt: now };
    });
    setProjectSchedules(updatedProjectSchedules);
  };

  const handleAutoReschedule = () => {
    if (schedules.filter(s => !s.completed).length === 0) {
      setMessage({ type: 'error', text: '没有待处理的排期项需要重排' });
      return;
    }
    if (staff.length === 0) {
      setMessage({ type: 'error', text: '请先添加修复人员后再进行自动重排' });
      return;
    }

    setIsAutoRescheduling(true);
    setTimeout(() => {
      try {
        const result = performAutoReschedule(projects, staff, schedules);
        setAutoRescheduleResult(result);
        setShowAutoRescheduleModal(true);
      } catch (error) {
        console.error('Auto reschedule error:', error);
        setMessage({ type: 'error', text: '自动重排失败，请稍后重试' });
      } finally {
        setIsAutoRescheduling(false);
      }
    }, 300);
  };

  const handleConfirmAutoReschedule = (result: AutoRescheduleResult) => {
    const now = new Date().toISOString().split('T')[0];

    const updatedProjectSchedules = projectSchedules.map(ps => {
      const project = projects.find(p => p.id === ps.projectId);
      if (!project) return ps;

      const updatedEstimates = [...(ps.stepEstimates || [])];
      project.restorationSteps.forEach((step, idx) => {
        if (step.completed) return;
        const newSchedule = result.proposedSchedules.find(
          s => s.projectId === project.id && s.stepName === step.name && !s.completed
        );
        if (newSchedule) {
          updatedEstimates[idx] = {
            ...updatedEstimates[idx],
            scheduledDate: newSchedule.scheduledDate || null,
            assignedStaffId: newSchedule.staffId || null,
          };
        }
      });

      return { ...ps, stepEstimates: updatedEstimates, updatedAt: now };
    });

    setSchedules(result.proposedSchedules);
    setProjectSchedules(updatedProjectSchedules);
    setShowAutoRescheduleModal(false);
    setAutoRescheduleResult(null);

    const saveResult = saveScheduleData({
      staff,
      schedules: result.proposedSchedules,
      projectSchedules: updatedProjectSchedules,
    });

    if (saveResult.success) {
      const resolved = result.summary.conflictsResolved;
      const remaining = result.summary.conflictsRemaining;
      setMessage({
        type: remaining > 0 ? 'success' : 'success',
        text: `重排成功！已解决 ${resolved} 个冲突${remaining > 0 ? `，仍有 ${remaining} 个问题需关注` : ''}`,
      });
    } else {
      setMessage({ type: 'error', text: saveResult.error || '保存失败' });
    }
  };

  const generateSchedules = (project: RestorationProject) => {
    const projectSchedule = getProjectSchedule(project.id);
    if (!projectSchedule) {
      setMessage({ type: 'error', text: '请先初始化项目排班' });
      return;
    }

    const newSchedules = buildSchedulesFromEstimates(project, projectSchedule.stepEstimates || []);

    if (!newSchedules) {
      setMessage({ type: 'error', text: '请填写所有未完成步骤的工时、负责人和日期' });
      return;
    }

    setSchedules(newSchedules);
    const result = saveScheduleData({ staff, schedules: newSchedules, projectSchedules });
    if (result.success) {
      setMessage({ type: 'success', text: '排班生成成功' });
    }
  };

  const getStaffDailyLoad = (staffId: string, date: string): number => {
    return schedules
      .filter(s => s.staffId === staffId && s.scheduledDate === date && !s.completed)
      .reduce((sum, s) => sum + s.estimatedHours, 0);
  };

  const getProjectRisks = (project: RestorationProject) => {
    const items = getProjectScheduleItems(project.id).filter(s => !s.completed);
    const projectSchedule = getProjectSchedule(project.id);

    const risks: { type: 'overdue' | 'overload'; message: string }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deliveryDate = new Date(project.deliveryDate);
    deliveryDate.setHours(0, 0, 0, 0);
    const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (projectSchedule) {
      const incompleteEstimates = (projectSchedule.stepEstimates || []).filter(
        (_est, idx) => !project.restorationSteps[idx].completed
      );

      const scheduledDates = incompleteEstimates.filter(e => e.scheduledDate);
      const unscheduledCount = incompleteEstimates.length - scheduledDates.length;

      if (unscheduledCount > 0 && daysUntilDelivery < 7 && daysUntilDelivery >= 0) {
        risks.push({
          type: 'overdue',
          message: `距离交付还有 ${daysUntilDelivery} 天，还有 ${unscheduledCount} 个步骤未安排`,
        });
      }

      const totalHours = incompleteEstimates.reduce((sum, e) => sum + e.estimatedHours, 0);
      const totalStaffHours = staff.reduce((sum, s) => sum + (s.dailyWorkHours || 8), 0);
      const minDaysNeeded = Math.ceil(totalHours / Math.max(totalStaffHours, 1));

      if (minDaysNeeded > daysUntilDelivery && daysUntilDelivery >= 0) {
        risks.push({
          type: 'overdue',
          message: `按当前人员配置，最少需要 ${minDaysNeeded} 天完成，但距交付仅 ${daysUntilDelivery} 天`,
        });
      }

      const estimatedDates = scheduledDates.map(e => new Date(e.scheduledDate!).getTime());
      if (estimatedDates.length > 0) {
        const lastEstimatedDate = new Date(Math.max(...estimatedDates));
        if (lastEstimatedDate > deliveryDate) {
          const overDays = Math.ceil((lastEstimatedDate.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
          risks.push({
            type: 'overdue',
            message: `预估完成日期 ${lastEstimatedDate.toISOString().split('T')[0]} 超出交付日期 ${overDays} 天`,
          });
        }
      }

      const estimateStaffDailyHours = new Map<string, Map<string, number>>();
      incompleteEstimates.forEach(est => {
        if (!est.assignedStaffId || !est.scheduledDate) return;
        if (!estimateStaffDailyHours.has(est.assignedStaffId)) {
          estimateStaffDailyHours.set(est.assignedStaffId, new Map());
        }
        const dateMap = estimateStaffDailyHours.get(est.assignedStaffId)!;
        dateMap.set(est.scheduledDate, (dateMap.get(est.scheduledDate) || 0) + est.estimatedHours);
      });

      estimateStaffDailyHours.forEach((dateMap, staffId) => {
        const staffMember = staff.find(s => s.id === staffId);
        if (!staffMember) return;
        dateMap.forEach((hours, date) => {
          if (hours > (staffMember.dailyWorkHours || 8)) {
            risks.push({
              type: 'overload',
              message: `${staffMember.name} 在 ${date} 预估负载 ${hours} 小时，超出日限 ${(staffMember.dailyWorkHours || 8)} 小时`,
            });
          }
        });
      });
    }

    if (items.length > 0) {
      const lastDate = new Date(Math.max(...items.map(i => new Date(i.scheduledDate!).getTime())));
      if (lastDate > deliveryDate) {
        const overDays = Math.ceil((lastDate.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
        risks.push({ type: 'overdue', message: `已排班预估完成日期超出交付日期 ${overDays} 天` });
      }
    }

    const staffDailyHours = new Map<string, Map<string, number>>();
    items.forEach(item => {
      if (!staffDailyHours.has(item.staffId)) {
        staffDailyHours.set(item.staffId, new Map());
      }
      const dateMap = staffDailyHours.get(item.staffId)!;
      dateMap.set(item.scheduledDate!, (dateMap.get(item.scheduledDate!) || 0) + item.estimatedHours);
    });

    staffDailyHours.forEach((dateMap, staffId) => {
      const staffMember = staff.find(s => s.id === staffId);
      if (!staffMember) return;
      dateMap.forEach((hours, date) => {
        if (hours > (staffMember.dailyWorkHours || 8)) {
          risks.push({
            type: 'overload',
            message: `${staffMember.name} 在 ${date} 负载 ${hours} 小时，超出日限 ${(staffMember.dailyWorkHours || 8)} 小时`,
          });
        }
      });
    });

    return risks;
  };

  const getStaffLoadsForDate = (dateStr: string) => {
    const loads: { staffId: string; name: string; hours: number; maxHours: number; overload: boolean }[] = [];
    staff.forEach(s => {
      const hours = getStaffDailyLoad(s.id, dateStr);
      if (hours > 0) {
        loads.push({
          staffId: s.id,
          name: s.name,
          hours,
          maxHours: (s.dailyWorkHours || 8),
          overload: hours > (s.dailyWorkHours || 8),
        });
      }
    });
    return loads.sort((a, b) => b.hours - a.hours);
  };

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: Array<{
      date: Date | null;
      dateStr: string | null;
      isCurrentMonth: boolean;
      isToday: boolean;
      schedules: ScheduleItem[];
      staffLoads: { staffId: string; name: string; hours: number; maxHours: number; overload: boolean }[];
    }> = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      d.setHours(0, 0, 0, 0);
      const dateStr = d.toISOString().split('T')[0];
      const daySchedules = schedules.filter(s => s.scheduledDate === dateStr && !s.completed);
      const loads = getStaffLoadsForDate(dateStr);
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: false,
        isToday: d.getTime() === today.getTime(),
        schedules: daySchedules,
        staffLoads: loads,
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      d.setHours(0, 0, 0, 0);
      const dateStr = d.toISOString().split('T')[0];
      const daySchedules = schedules.filter(s => s.scheduledDate === dateStr && !s.completed);
      const loads = getStaffLoadsForDate(dateStr);
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: true,
        isToday: d.getTime() === today.getTime(),
        schedules: daySchedules,
        staffLoads: loads,
      });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(year, month + 1, i);
      d.setHours(0, 0, 0, 0);
      const dateStr = d.toISOString().split('T')[0];
      const daySchedules = schedules.filter(s => s.scheduledDate === dateStr && !s.completed);
      const loads = getStaffLoadsForDate(dateStr);
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: false,
        isToday: d.getTime() === today.getTime(),
        schedules: daySchedules,
        staffLoads: loads,
      });
    }

    return days;
  }, [currentMonth, schedules, staff]);

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  const goToPrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const goToNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const risks = useMemo(() => {
    const allRisks: { projectId: string; projectTitle: string; type: 'overdue' | 'overload'; message: string }[] = [];
    undeliveredProjects.forEach(project => {
      const projectRisks = getProjectRisks(project);
      projectRisks.forEach(r => {
        allRisks.push({ projectId: project.id, projectTitle: project.bookTitle, ...r });
      });
    });
    return allRisks;
  }, [undeliveredProjects, schedules, staff, projectSchedules]);

  const scheduleStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const incomplete = schedules.filter(s => !s.completed);
    const todayItems = incomplete.filter(s => s.scheduledDate === today);
    const thisWeekItems = incomplete.filter(s => {
      const date = new Date(s.scheduledDate!);
      const now = new Date();
      const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return date >= now && date <= weekEnd;
    });
    return {
      totalStaff: staff.length,
      totalScheduled: incomplete.length,
      todayScheduled: todayItems.length,
      thisWeekScheduled: thisWeekItems.length,
      totalRisks: risks.length,
    };
  }, [schedules, staff, risks]);

  return (
    <div className="schedule-container">
      {message && (
        <div className={`message-banner ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="schedule-header">
        <div className="schedule-title-section">
          <h2 className="schedule-title">修复排班</h2>
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="stat-value">{scheduleStats.totalStaff}</span>
              <span className="stat-label">修复人员</span>
            </div>
            <div className="schedule-stat">
              <span className="stat-value">{scheduleStats.totalScheduled}</span>
              <span className="stat-label">待办排班</span>
            </div>
            <div className="schedule-stat">
              <span className="stat-value">{scheduleStats.todayScheduled}</span>
              <span className="stat-label">今日待办</span>
            </div>
            <div className="schedule-stat">
              <span className="stat-value">{scheduleStats.thisWeekScheduled}</span>
              <span className="stat-label">本周待办</span>
            </div>
            {scheduleStats.totalRisks > 0 && (
              <div className="schedule-stat warning">
                <span className="stat-value">{scheduleStats.totalRisks}</span>
                <span className="stat-label">风险提示</span>
              </div>
            )}
          </div>
        </div>

        <div className="schedule-header-actions">
          <button
            className="btn btn-primary auto-reschedule-btn"
            onClick={handleAutoReschedule}
            disabled={isAutoRescheduling || schedules.filter(s => !s.completed).length === 0}
          >
            {isAutoRescheduling ? (
              <span className="loading-spinner">计算中...</span>
            ) : (
              <>🔄 智能自动重排</>
            )}
          </button>
        </div>

        <div className="schedule-tabs">
          <button
            className={`tab-btn ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => setActiveTab('staff')}
          >
            👤 人员管理
          </button>
          <button
            className={`tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            📋 项目排班
          </button>
          <button
            className={`tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            📅 排班日历
          </button>
        </div>
      </div>

      {risks.length > 0 && (
        <div className="risk-alert-panel">
          <div className="risk-alert-title">⚠️ 风险提示</div>
          <div className="risk-alert-list">
            {risks.slice(0, 5).map((risk, idx) => (
              <div key={idx} className={`risk-item ${risk.type}`}>
                <span className="risk-project">《{risk.projectTitle}》</span>
                <span className="risk-message">{risk.message}</span>
              </div>
            ))}
            {risks.length > 5 && (
              <div className="risk-more">还有 {risks.length - 5} 条风险提示...</div>
            )}
          </div>
        </div>
      )}

      <div className="schedule-content">
        {activeTab === 'staff' && (
          <div className="staff-management">
            <div className="section-header">
              <h3>修复人员管理</h3>
              <button className="btn btn-primary" onClick={() => { setEditingStaff(null); setShowStaffForm(true); }}>
                + 添加修复人员
              </button>
            </div>

            {staff.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👤</div>
                <p>暂无修复人员</p>
                <p className="empty-subtitle">点击上方按钮添加修复人员</p>
              </div>
            ) : (
              <div className="staff-grid">
                {staff.map(s => {
                  const staffConflicts = getStaffConflicts(s.id, staff, schedules);
                  return (
                    <div key={s.id} className={`staff-card ${staffConflicts.length > 0 ? 'has-conflict' : ''}`}>
                      <div className="staff-card-header">
                        <div className="staff-avatar">{s.name.charAt(0)}</div>
                        <div className="staff-info">
                          <div className="staff-name">
                            {s.name}
                            {staffConflicts.length > 0 && (
                              <span
                                className="conflict-badge"
                                title={`${staffConflicts.length} 天负载冲突`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowConflictDetail(staffConflicts[0]);
                                }}
                              >
                                ⚠️ {staffConflicts.length}
                              </span>
                            )}
                          </div>
                          <div className="staff-hours">每日可用: {(s.dailyWorkHours || 8)}小时</div>
                        </div>
                      </div>
                      {(s.skills || []).length > 0 && (
                        <div className="staff-skills">
                          {(s.skills || []).map((skill, idx) => (
                            <span key={idx} className="skill-tag">{skill}</span>
                          ))}
                        </div>
                      )}
                      {s.phone && <div className="staff-phone">📞 {s.phone}</div>}
                      {s.note && <div className="staff-note">{s.note}</div>}
                      {staffConflicts.length > 0 && (
                        <div className="staff-conflicts">
                          <div className="conflicts-title">负载冲突：</div>
                          {staffConflicts.slice(0, 3).map((conflict, idx) => (
                            <div
                              key={idx}
                              className="conflict-item"
                              onClick={() => setShowConflictDetail(conflict)}
                            >
                              <span className="conflict-date">{conflict.date}</span>
                              <span className="conflict-hours">
                                {conflict.scheduledHours}h / {conflict.maxHours}h
                                <span className="overload-hours">(超{conflict.overloadHours}h)</span>
                              </span>
                            </div>
                          ))}
                          {staffConflicts.length > 3 && (
                            <div className="conflict-more">还有 {staffConflicts.length - 3} 天冲突...</div>
                          )}
                        </div>
                      )}
                      <div className="staff-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => handleEditStaff(s)}>编辑</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteStaff(s.id)}>删除</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="project-scheduling">
            <div className="section-header">
              <h3>项目排班</h3>
              <span className="text-muted">{undeliveredProjects.length} 个待交付项目</span>
            </div>

            {undeliveredProjects.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <p>暂无待交付项目</p>
                <p className="empty-subtitle">所有项目均已完成交付</p>
              </div>
            ) : (
              <div className="projects-schedule-list">
                {undeliveredProjects.map(project => {
                  const projectSchedule = getProjectSchedule(project.id);
                  const projectItems = getProjectScheduleItems(project.id);
                  const projectRisks = getProjectRisks(project);
                  const projectConflicts = getProjectConflicts(project.id, staff, schedules);
                  const daysLeft = getDaysUntilDelivery(project.deliveryDate);
                  const isOverdue = daysLeft < 0;
                  const isSelected = selectedProject?.id === project.id;

                  return (
                    <div key={project.id} className={`project-schedule-card ${isSelected ? 'expanded' : ''} ${projectConflicts.length > 0 ? 'has-conflict' : ''}`}>
                      <div
                        className="project-schedule-header"
                        onClick={() => setSelectedProject(isSelected ? null : project)}
                      >
                        <div className="project-title-section">
                          <h4>{project.bookTitle}</h4>
                          <span className={`status-badge status-${project.status}`}>
                            {STATUS_LABELS[project.status]}
                          </span>
                          {projectConflicts.length > 0 && (
                            <span
                              className="conflict-badge"
                              title={`导致 ${projectConflicts.length} 处人员负载冲突`}
                            >
                              ⚠️ 人员冲突
                            </span>
                          )}
                        </div>
                        <div className="project-meta">
                          <span className={`delivery-info ${isOverdue ? 'overdue' : ''}`}>
                            {isOverdue ? `逾期${Math.abs(daysLeft)}天` : `剩余${daysLeft}天`} · {project.deliveryDate}
                          </span>
                          <span className="progress-info">进度 {project.currentProgress}%</span>
                          {projectItems.length > 0 && (
                            <span className="schedule-count">已排 {projectItems.filter(i => !i.completed).length} 项</span>
                          )}
                          {projectRisks.length > 0 && (
                            <span className="risk-indicator" title={projectRisks.map(r => r.message).join('\n')}>
                              ⚠️ {projectRisks.length}
                            </span>
                          )}
                        </div>
                        <div className="expand-icon">{isSelected ? '▲' : '▼'}</div>
                      </div>

                      {isSelected && (
                        <div className="project-schedule-body">
                          {projectRisks.length > 0 && (
                            <div className="project-risks">
                              {projectRisks.map((risk, idx) => (
                                <div key={idx} className={`project-risk ${risk.type}`}>
                                  ⚠️ {risk.message}
                                </div>
                              ))}
                            </div>
                          )}

                          {projectConflicts.length > 0 && (
                            <div className="project-conflicts">
                              <div className="conflicts-section-title">🚨 人员负载冲突（{projectConflicts.length} 处）</div>
                              {projectConflicts.map((conflict, idx) => (
                                <div
                                  key={idx}
                                  className="project-conflict-item"
                                  onClick={() => setShowConflictDetail(conflict)}
                                >
                                  <div className="conflict-header">
                                    <span className="conflict-staff">👤 {conflict.staffName}</span>
                                    <span className="conflict-date">📅 {conflict.date}</span>
                                    <span className="conflict-hours">
                                      ⏱ {conflict.scheduledHours}h / {conflict.maxHours}h
                                      <span className="overload">(超{conflict.overloadHours}h)</span>
                                    </span>
                                  </div>
                                  <div className="conflict-related-steps">
                                    涉及步骤：{conflict.relatedProjects
                                      .filter(p => p.projectId === project.id)
                                      .map(p => `${p.stepName}(${p.estimatedHours}h)`)
                                      .join('、')}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {!projectSchedule ? (
                            <div className="schedule-actions">
                              <p className="text-muted">该项目尚未初始化排班</p>
                              <button
                                className="btn btn-secondary"
                                onClick={() => initializeProjectSchedule(project)}
                              >
                                手动初始化
                              </button>
                              <button
                                className="btn btn-primary"
                                onClick={() => autoScheduleProject(project, 'backward')}
                              >
                                🤖 自动排班（倒排）
                              </button>
                              <button
                                className="btn btn-outline"
                                onClick={() => autoScheduleProject(project, 'forward')}
                              >
                                🤖 自动排班（顺排）
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="steps-schedule-table">
                                <div className="table-header">
                                  <div className="col-step">修复步骤</div>
                                  <div className="col-status">状态</div>
                                  <div className="col-hours">预估工时</div>
                                  <div className="col-staff">负责人</div>
                                  <div className="col-date">排期</div>
                                </div>
                                {project.restorationSteps.map((step, idx) => {
                                  const estimate = (projectSchedule.stepEstimates || [])[idx];
                                  if (!estimate) return null;

                                  return (
                                    <div key={idx} className={`table-row ${step.completed ? 'completed' : ''}`}>
                                      <div className="col-step">
                                        <span className="step-checkbox-indicator">
                                          {step.completed ? '✓' : ''}
                                        </span>
                                        {step.name}
                                      </div>
                                      <div className="col-status">
                                        <span className={`step-status ${step.completed ? 'done' : 'pending'}`}>
                                          {step.completed ? '已完成' : '待处理'}
                                        </span>
                                      </div>
                                      <div className="col-hours">
                                        {step.completed ? (
                                          <span className="text-muted">{estimate.estimatedHours}h</span>
                                        ) : (
                                          <input
                                            type="number"
                                            min="0.5"
                                            max="24"
                                            step="0.5"
                                            value={estimate.estimatedHours}
                                            onChange={(e) => handleStepEstimateChange(
                                              project.id,
                                              idx,
                                              'estimatedHours',
                                              parseFloat(e.target.value) || 0
                                            )}
                                            className="hours-input"
                                          />
                                        )}
                                      </div>
                                      <div className="col-staff">
                                        {step.completed ? (
                                          <span className="text-muted">
                                            {staff.find(s => s.id === estimate.assignedStaffId)?.name || '-'}
                                          </span>
                                        ) : (
                                          <select
                                            value={estimate.assignedStaffId || ''}
                                            onChange={(e) => handleStepEstimateChange(
                                              project.id,
                                              idx,
                                              'assignedStaffId',
                                              e.target.value || null
                                            )}
                                            className="staff-select"
                                          >
                                            <option value="">请选择负责人</option>
                                            {staff.map(s => (
                                              <option key={s.id} value={s.id}>
                                                {s.name} ({(s.dailyWorkHours || 8)}h/天)
                                              </option>
                                            ))}
                                          </select>
                                        )}
                                      </div>
                                      <div className="col-date">
                                        {step.completed ? (
                                          <span className="text-muted">{step.date || '-'}</span>
                                        ) : (
                                          <input
                                            type="date"
                                            value={estimate.scheduledDate || ''}
                                            onChange={(e) => handleStepEstimateChange(
                                              project.id,
                                              idx,
                                              'scheduledDate',
                                              e.target.value || null
                                            )}
                                            className="date-input"
                                          />
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="schedule-actions">
                                <button
                                  className="btn btn-primary"
                                  onClick={() => generateSchedules(project)}
                                >
                                  ✓ 生成排班
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  onClick={() => autoScheduleProject(project, 'backward')}
                                >
                                  🔄 重新倒排
                                </button>
                                <button
                                  className="btn btn-outline"
                                  onClick={() => autoScheduleProject(project, 'forward')}
                                >
                                  🔄 重新顺排
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  onClick={() => onSelectProject(project)}
                                >
                                  查看详情
                                </button>
                              </div>

                              {projectItems.length > 0 && (
                                <div className="generated-schedules">
                                  <h5>已生成的排班</h5>
                                  <div className="schedule-items-list">
                                    {projectItems.filter(i => !i.completed).map(item => (
                                      <div key={item.id} className="schedule-item-card">
                                        <span className="item-step">{item.stepName}</span>
                                        <span className="item-staff">👤 {item.staffName}</span>
                                        <span className="item-date">📅 {item.scheduledDate}</span>
                                        <span className="item-hours">⏱ {item.estimatedHours}h</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="schedule-calendar">
            <div className="calendar-controls">
              <button className="btn btn-secondary btn-sm" onClick={goToToday}>今天</button>
              <button className="btn btn-icon" onClick={goToPrevMonth}>‹</button>
              <span className="current-month">
                {currentMonth.getFullYear()}年 {monthNames[currentMonth.getMonth()]}
              </span>
              <button className="btn btn-icon" onClick={goToNextMonth}>›</button>
            </div>

            <div className="calendar-legend">
              <span className="legend-item">
                <span className="legend-dot normal"></span>
                正常负载
              </span>
              <span className="legend-item">
                <span className="legend-dot overload"></span>
                负载过高
              </span>
              <span className="legend-item">
                <span className="legend-dot overdue"></span>
                逾期项目
              </span>
            </div>

            <div className="calendar-grid">
              {weekDays.map(day => (
                <div key={day} className="calendar-weekday">{day}</div>
              ))}

              {calendarDays.map((day, idx) => {
                const dayConflicts = day.dateStr ? getDateConflicts(day.dateStr, staff, schedules) : [];
                const hasOverload = day.staffLoads.some(l => l.overload);
                return (
                  <div
                    key={idx}
                    className={`calendar-day ${day.isCurrentMonth ? '' : 'other-month'} ${day.isToday ? 'today' : ''} ${day.schedules.length > 0 ? 'has-schedules' : ''} ${hasOverload ? 'has-conflict' : ''}`}
                  >
                    <div className="day-number">
                      {day.date?.getDate()}
                      {hasOverload && (
                        <span className="day-conflict-indicator" title="存在人员负载冲突">⚠️</span>
                      )}
                    </div>

                    {day.staffLoads.length > 0 && (
                      <div className="day-staff-loads">
                        {day.staffLoads.map((load, loadIdx) => {
                          const conflict = dayConflicts.find(c => c.staffId === load.staffId);
                          return (
                            <div
                              key={loadIdx}
                              className={`staff-load ${load.overload ? 'overload' : ''}`}
                              title={`${load.name}: ${load.hours}/${load.maxHours}小时${load.overload ? ' - 点击查看冲突详情' : ''}`}
                              onClick={(e) => {
                                if (load.overload && conflict) {
                                  e.stopPropagation();
                                  setShowConflictDetail(conflict);
                                }
                              }}
                              style={{ cursor: load.overload ? 'pointer' : 'default' }}
                            >
                              <span className="load-name">{load.name}</span>
                              <span className="load-hours">{load.hours}h</span>
                              {load.overload && <span className="load-overload-icon">⚠️</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="day-schedules">
                      {day.schedules.slice(0, 2).map(s => {
                        const project = projects.find(p => p.id === s.projectId);
                        const isOverdue = project && getDaysUntilDelivery(project.deliveryDate) < 0;
                        const hasConflict = dayConflicts.some(c =>
                          c.relatedProjects.some(p => p.projectId === s.projectId)
                        );
                        return (
                          <div
                            key={s.id}
                            className={`schedule-chip ${isOverdue ? 'overdue' : ''} ${hasConflict ? 'has-conflict' : ''}`}
                            onClick={() => {
                              if (project) onSelectProject(project);
                            }}
                            title={`${hasConflict ? '⚠️ ' : ''}《${s.projectTitle}》- ${s.stepName} - ${s.staffName} - ${s.estimatedHours}h${hasConflict ? ' - 该项目导致人员负载冲突' : ''}`}
                          >
                            <span className="chip-title">{s.projectTitle}</span>
                            <span className="chip-step">{s.stepName}</span>
                            {hasConflict && <span className="chip-conflict-icon">⚠️</span>}
                          </div>
                        );
                      })}
                      {day.schedules.length > 2 && (
                        <div className="more-schedules">+{day.schedules.length - 2} 更多</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showStaffForm && (
        <StaffForm
          staff={editingStaff}
          onClose={() => { setShowStaffForm(false); setEditingStaff(null); }}
          onSave={handleSaveStaff}
        />
      )}

      {showConflictDetail && (
        <ConflictDetailModal
          conflict={showConflictDetail}
          projects={projects}
          onClose={() => setShowConflictDetail(null)}
          onSelectProject={(project) => {
            setShowConflictDetail(null);
            onSelectProject(project);
          }}
        />
      )}

      {showAutoRescheduleModal && autoRescheduleResult && (
        <AutoRescheduleModal
          result={autoRescheduleResult}
          onClose={() => {
            setShowAutoRescheduleModal(false);
            setAutoRescheduleResult(null);
          }}
          onConfirm={handleConfirmAutoReschedule}
        />
      )}
    </div>
  );
}

interface StaffFormProps {
  staff: RestorationStaff | null;
  onClose: () => void;
  onSave: (data: Omit<RestorationStaff, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

function StaffForm({ staff, onClose, onSave }: StaffFormProps) {
  const [name, setName] = useState(staff?.name || '');
  const [dailyWorkHours, setDailyWorkHours] = useState(staff?.dailyWorkHours || 8);
  const [skills, setSkills] = useState<string[]>(staff?.skills || []);
  const [phone, setPhone] = useState(staff?.phone || '');
  const [note, setNote] = useState(staff?.note || '');
  const [skillInput, setSkillInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('请输入姓名');
      return;
    }
    if (dailyWorkHours <= 0 || dailyWorkHours > 24) {
      alert('每日可用工时应在1-24小时之间');
      return;
    }
    onSave({
      name: name.trim(),
      dailyWorkHours,
      skills,
      phone: phone.trim() || "",
      note: note.trim() || undefined,
    });
  };

  const handleAddSkill = () => {
    const skill = skillInput.trim();
    if (skill && !skills.includes(skill)) {
      setSkills([...skills, skill]);
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills(skills.filter(s => s !== skill));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{staff ? '编辑修复人员' : '添加修复人员'}</h2>
          <button className="btn btn-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>姓名 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入修复人员姓名"
              required
            />
          </div>

          <div className="form-group">
            <label>每日可用工时（小时）*</label>
            <input
              type="number"
              min="1"
              max="24"
              step="0.5"
              value={dailyWorkHours}
              onChange={(e) => setDailyWorkHours(parseFloat(e.target.value) || 8)}
              required
            />
          </div>

          <div className="form-group">
            <label>擅长技能</label>
            <div className="skill-input-group">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                placeholder="输入技能后点击添加"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
              />
              <button type="button" className="btn btn-secondary" onClick={handleAddSkill}>
                添加
              </button>
            </div>
            <div className="skills-list">
              {skills.map((skill, idx) => (
                <span key={idx} className="skill-tag">
                  {skill}
                  <button
                    type="button"
                    className="remove-skill"
                    onClick={() => handleRemoveSkill(skill)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>联系电话</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入联系电话（选填）"
            />
          </div>

          <div className="form-group">
            <label>备注</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="备注信息（选填）"
              rows={3}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary">
              {staff ? '保存修改' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ConflictDetailModalProps {
  conflict: StaffWorkloadConflict;
  projects: RestorationProject[];
  onClose: () => void;
  onSelectProject: (project: RestorationProject) => void;
}

function ConflictDetailModal({ conflict, projects, onClose, onSelectProject }: ConflictDetailModalProps) {
  const getProjectById = (projectId: string) => projects.find(p => p.id === projectId);

  const groupedByProject = conflict.relatedProjects.reduce((acc, item) => {
    if (!acc[item.projectId]) {
      acc[item.projectId] = [];
    }
    acc[item.projectId].push(item);
    return acc;
  }, {} as Record<string, typeof conflict.relatedProjects>);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-left">
            <h2>🚨 人员负载冲突详情</h2>
            <span className="conflict-summary-badge">
              {conflict.staffName} · {conflict.date}
            </span>
          </div>
          <button className="btn btn-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="conflict-overview">
            <div className="conflict-info-card">
              <div className="conflict-info-item">
                <span className="info-label">修复人员</span>
                <span className="info-value">👤 {conflict.staffName}</span>
              </div>
              <div className="conflict-info-item">
                <span className="info-label">日期</span>
                <span className="info-value">📅 {conflict.date}</span>
              </div>
              <div className="conflict-info-item">
                <span className="info-label">每日工时上限</span>
                <span className="info-value">⏱ {conflict.maxHours} 小时</span>
              </div>
              <div className="conflict-info-item">
                <span className="info-label">已安排工时</span>
                <span className="info-value overload">⏱ {conflict.scheduledHours} 小时</span>
              </div>
              <div className="conflict-info-item highlight">
                <span className="info-label">超出工时</span>
                <span className="info-value danger">⚠️ {conflict.overloadHours} 小时</span>
              </div>
            </div>
          </div>

          <div className="conflict-projects-section">
            <h3>涉及项目（{conflict.relatedProjects.length} 项工作）</h3>
            <p className="section-hint">点击项目卡片可跳转到项目详情页进行调整</p>

            <div className="conflict-projects-list">
              {Object.entries(groupedByProject).map(([projectId, items]) => {
                const project = getProjectById(projectId);
                const totalHours = items.reduce((sum, item) => sum + item.estimatedHours, 0);
                return (
                  <div
                    key={projectId}
                    className="conflict-project-card"
                    onClick={() => project && onSelectProject(project)}
                  >
                    <div className="project-card-header">
                      <span className="project-title">
                        {project?.bookTitle || items[0].projectTitle || '未知项目'}
                      </span>
                      {project && (
                        <span className={`status-badge status-${project.status}`}>
                          {STATUS_LABELS[project.status]}
                        </span>
                      )}
                    </div>
                    <div className="project-card-body">
                      <div className="project-hours-info">
                        <span className="label">该日占用：</span>
                        <span className="value">{totalHours} 小时</span>
                      </div>
                      <div className="project-steps">
                        <span className="label">涉及步骤：</span>
                        <div className="steps-list">
                          {items.map((item, idx) => (
                            <span key={idx} className="step-chip">
                              {item.stepName} ({item.estimatedHours}h)
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="project-card-footer">
                      <span className="go-to-project">点击跳转调整 →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="conflict-suggestions">
            <h4>💡 建议解决方案</h4>
            <ul className="suggestion-list">
              <li>调整部分步骤的排期到其他日期</li>
              <li>将部分工作分配给其他修复人员</li>
              <li>如果可能，拆分大的步骤为多个小步骤</li>
              <li>与客户沟通是否可以调整交付时间</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
