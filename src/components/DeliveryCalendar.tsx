import { useState, useMemo } from 'react';
import type { RestorationProject } from '../types';
import { STATUS_LABELS } from '../types';

interface DeliveryCalendarProps {
  projects: RestorationProject[];
  onSelectProject: (project: RestorationProject) => void;
}

type UrgencyLevel = 'overdue' | 'within7' | 'within14' | 'normal';

interface CalendarProject {
  project: RestorationProject;
  urgency: UrgencyLevel;
  daysLeft: number;
}

export default function DeliveryCalendar({ projects, onSelectProject }: DeliveryCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysUntilDelivery = (deliveryDate: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const delivery = new Date(deliveryDate);
    delivery.setHours(0, 0, 0, 0);
    const diffTime = delivery.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getUrgency = (daysLeft: number): UrgencyLevel => {
    if (daysLeft < 0) return 'overdue';
    if (daysLeft <= 7) return 'within7';
    if (daysLeft <= 14) return 'within14';
    return 'normal';
  };

  const getUrgencyLabel = (urgency: UrgencyLevel): string => {
    switch (urgency) {
      case 'overdue': return '已逾期';
      case 'within7': return '7天内到期';
      case 'within14': return '14天内到期';
      default: return '正常';
    }
  };

  const undeliveredProjects = useMemo(() => {
    return projects
      .filter(p => p.status !== 'delivered')
      .map(p => ({
        project: p,
        daysLeft: getDaysUntilDelivery(p.deliveryDate),
        urgency: getUrgency(getDaysUntilDelivery(p.deliveryDate)),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [projects]);

  const projectsByDate = useMemo(() => {
    const map = new Map<string, CalendarProject[]>();
    undeliveredProjects.forEach(cp => {
      const dateKey = cp.project.deliveryDate;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(cp);
    });
    return map;
  }, [undeliveredProjects]);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: Array<{
      date: Date | null;
      dateStr: string | null;
      isCurrentMonth: boolean;
      isToday: boolean;
      projects: CalendarProject[];
    }> = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      d.setHours(0, 0, 0, 0);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: false,
        isToday: d.getTime() === today.getTime(),
        projects: projectsByDate.get(dateStr) || [],
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      d.setHours(0, 0, 0, 0);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: true,
        isToday: d.getTime() === today.getTime(),
        projects: projectsByDate.get(dateStr) || [],
      });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(year, month + 1, i);
      d.setHours(0, 0, 0, 0);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: false,
        isToday: d.getTime() === today.getTime(),
        projects: projectsByDate.get(dateStr) || [],
      });
    }

    return days;
  }, [currentDate, projectsByDate]);

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  const urgencyCounts = useMemo(() => ({
    overdue: undeliveredProjects.filter(p => p.urgency === 'overdue').length,
    within7: undeliveredProjects.filter(p => p.urgency === 'within7').length,
    within14: undeliveredProjects.filter(p => p.urgency === 'within14').length,
    normal: undeliveredProjects.filter(p => p.urgency === 'normal').length,
  }), [undeliveredProjects]);

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="calendar-title-section">
          <h2 className="calendar-title">交付日历</h2>
          <div className="calendar-stats">
            {urgencyCounts.overdue > 0 && (
              <span className="calendar-stat overdue">
                <span className="stat-dot"></span>
                已逾期 {urgencyCounts.overdue}
              </span>
            )}
            {urgencyCounts.within7 > 0 && (
              <span className="calendar-stat within7">
                <span className="stat-dot"></span>
                7天内 {urgencyCounts.within7}
              </span>
            )}
            {urgencyCounts.within14 > 0 && (
              <span className="calendar-stat within14">
                <span className="stat-dot"></span>
                14天内 {urgencyCounts.within14}
              </span>
            )}
            <span className="calendar-stat normal">
              <span className="stat-dot"></span>
              待交付 {undeliveredProjects.length}
            </span>
          </div>
        </div>

        <div className="calendar-controls">
          <button className="btn btn-secondary btn-sm" onClick={goToToday}>今天</button>
          <button className="btn btn-icon" onClick={goToPrevMonth} aria-label="上个月">‹</button>
          <span className="current-month">
            {currentDate.getFullYear()}年 {monthNames[currentDate.getMonth()]}
          </span>
          <button className="btn btn-icon" onClick={goToNextMonth} aria-label="下个月">›</button>
        </div>
      </div>

      <div className="calendar-legend">
        <span className="legend-item">
          <span className="legend-dot overdue"></span>
          已逾期
        </span>
        <span className="legend-item">
          <span className="legend-dot within7"></span>
          7天内到期
        </span>
        <span className="legend-item">
          <span className="legend-dot within14"></span>
          14天内到期
        </span>
        <span className="legend-item">
          <span className="legend-dot normal"></span>
          正常
        </span>
      </div>

      <div className="calendar-grid">
        {weekDays.map(day => (
          <div key={day} className="calendar-weekday">
            {day}
          </div>
        ))}

        {calendarDays.map((day, index) => (
          <div
            key={index}
            className={`calendar-day ${day.isCurrentMonth ? '' : 'other-month'} ${day.isToday ? 'today' : ''} ${day.projects.length > 0 ? 'has-projects' : ''}`}
          >
            <div className="day-number">{day.date?.getDate()}</div>
            <div className="day-projects">
              {day.projects.slice(0, 3).map((cp) => (
                <div
                  key={cp.project.id}
                  className={`project-chip urgency-${cp.urgency}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectProject(cp.project);
                  }}
                  title={`《${cp.project.bookTitle}》 - ${STATUS_LABELS[cp.project.status]} - ${getUrgencyLabel(cp.urgency)}${cp.daysLeft < 0 ? ` (逾期${Math.abs(cp.daysLeft)}天)` : ` (剩余${cp.daysLeft}天)`}`}
                >
                  <span className="chip-title">{cp.project.bookTitle}</span>
                  {cp.daysLeft < 0 ? (
                    <span className="chip-days">逾期{Math.abs(cp.daysLeft)}天</span>
                  ) : (
                    <span className="chip-days">{cp.daysLeft}天</span>
                  )}
                </div>
              ))}
              {day.projects.length > 3 && (
                <div className="more-projects">
                  +{day.projects.length - 3} 更多
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {undeliveredProjects.length === 0 && (
        <div className="calendar-empty">
          <div className="empty-icon">📅</div>
          <p>暂无待交付项目</p>
          <p className="empty-subtitle">所有项目均已完成交付</p>
        </div>
      )}
    </div>
  );
}
