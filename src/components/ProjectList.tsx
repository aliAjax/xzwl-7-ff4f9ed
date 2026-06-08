import { useState, useMemo } from 'react';
import type { RestorationProject, ProjectStatus, Priority } from '../types';
import { STATUS_LABELS, PRIORITY_LABELS } from '../types';

interface ProjectListProps {
  projects: RestorationProject[];
  onSelectProject: (project: RestorationProject) => void;
  onEditProject: (project: RestorationProject) => void;
  onDeleteProject: (id: string) => void;
  onStatusChange: (id: string, status: ProjectStatus) => void;
  onNewProject: () => void;
}

type SortField = 'createdAt' | 'updatedAt' | 'deliveryDate' | 'currentProgress' | 'bookTitle' | 'volumeCount';
type SortOrder = 'asc' | 'desc';

export default function ProjectList({
  projects,
  onSelectProject,
  onEditProject,
  onDeleteProject,
  onStatusChange,
  onNewProject,
}: ProjectListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const getDaysUntilDelivery = (deliveryDate: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const delivery = new Date(deliveryDate);
    delivery.setHours(0, 0, 0, 0);
    return Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const isOverdue = (project: RestorationProject): boolean => {
    if (project.status === 'delivered') return false;
    return getDaysUntilDelivery(project.deliveryDate) < 0;
  };

  const isUrgent = (project: RestorationProject): boolean => {
    if (project.status === 'delivered') return false;
    const days = getDaysUntilDelivery(project.deliveryDate);
    return days >= 0 && days <= 7;
  };

  const getDeliveryBadge = (project: RestorationProject) => {
    const days = getDaysUntilDelivery(project.deliveryDate);
    if (project.status === 'delivered') {
      return <span className="delivery-badge delivered">已交付</span>;
    }
    if (days < 0) {
      return <span className="delivery-badge overdue">逾期 {Math.abs(days)} 天</span>;
    }
    if (days <= 3) {
      return <span className="delivery-badge urgent">{days} 天后交付</span>;
    }
    if (days <= 7) {
      return <span className="delivery-badge soon">{days} 天后交付</span>;
    }
    return <span className="delivery-badge">{days} 天后交付</span>;
  };

  const getProgressColor = (progress: number, status: ProjectStatus): { background: string } => {
    if (status === 'delivered') return { background: '#10b981' };
    if (progress >= 80) return { background: '#10b981' };
    if (progress >= 50) return { background: '#3b82f6' };
    if (progress >= 20) return { background: '#f59e0b' };
    return { background: '#ef4444' };
  };

  const filteredAndSortedProjects = useMemo(() => {
    let result = [...projects];

    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      result = result.filter(p => p.priority === priorityFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.bookTitle.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term) ||
        p.damageTypes.some(d => d.toLowerCase().includes(term)) ||
        p.description.toLowerCase().includes(term)
      );
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'bookTitle':
          comparison = a.bookTitle.localeCompare(b.bookTitle, 'zh-CN');
          break;
        case 'volumeCount':
          comparison = a.volumeCount - b.volumeCount;
          break;
        case 'currentProgress':
          comparison = a.currentProgress - b.currentProgress;
          break;
        case 'deliveryDate':
          comparison = new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime();
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
        default:
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [projects, searchTerm, statusFilter, priorityFilter, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="sort-icon">↕</span>;
    return <span className="sort-icon active">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  return (
    <div className="project-list-container">
      <div className="list-toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="搜索书名、编号、破损类型..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-box">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
          >
            <option value="all">全部状态</option>
            <option value="pending">待评估</option>
            <option value="restoring">修复中</option>
            <option value="drying">待晾干</option>
            <option value="binding">待装订</option>
            <option value="delivered">已交付</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as Priority | 'all')}
          >
            <option value="all">全部优先级</option>
            <option value="high">紧急</option>
            <option value="medium">普通</option>
            <option value="low">低优</option>
          </select>
        </div>

        <div className="result-count">
          共 <strong>{filteredAndSortedProjects.length}</strong> 个项目
        </div>
      </div>

      <div className="table-container">
        <table className="project-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('bookTitle')} className="sortable">
                书名 <SortIcon field="bookTitle" />
              </th>
              <th onClick={() => handleSort('volumeCount')} className="sortable">
                册数 <SortIcon field="volumeCount" />
              </th>
              <th>破损类型</th>
              <th>状态</th>
              <th onClick={() => handleSort('currentProgress')} className="sortable">
                进度 <SortIcon field="currentProgress" />
              </th>
              <th onClick={() => handleSort('deliveryDate')} className="sortable">
                交付日期 <SortIcon field="deliveryDate" />
              </th>
              <th onClick={() => handleSort('updatedAt')} className="sortable">
                更新时间 <SortIcon field="updatedAt" />
              </th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedProjects.map((project) => (
              <tr
                key={project.id}
                className={`project-row status-${project.status} ${isOverdue(project) ? 'overdue' : ''} ${isUrgent(project) && !isOverdue(project) ? 'urgent' : ''}`}
                onClick={() => onSelectProject(project)}
              >
                <td className="title-cell">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="book-title">{project.bookTitle}</span>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{project.id}</span>
                  </div>
                </td>
                <td>{project.volumeCount} 册</td>
                <td>
                  <div className="damage-tags">
                    {project.damageTypes.slice(0, 3).map((type) => (
                      <span key={type} className="damage-tag">{type}</span>
                    ))}
                    {project.damageTypes.length > 3 && (
                      <span className="damage-tag more">+{project.damageTypes.length - 3}</span>
                    )}
                  </div>
                </td>
                <td>
                  <span className={`status-badge status-${project.status}`}>
                    {STATUS_LABELS[project.status]}
                  </span>
                  {project.priority === 'high' && project.status !== 'delivered' && (
                    <span className="priority-indicator high" style={{ marginLeft: '4px' }}>急</span>
                  )}
                </td>
                <td>
                  <div className="progress-cell">
                    <div className="progress-bar small">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${project.currentProgress}%`,
                          ...getProgressColor(project.currentProgress, project.status)
                        }}
                      />
                    </div>
                    <span className="progress-text small">{project.currentProgress}%</span>
                  </div>
                </td>
                <td className="delivery-cell">
                  <span className="delivery-date">{formatDate(project.deliveryDate)}</span>
                  {getDeliveryBadge(project)}
                </td>
                <td className="date-cell">
                  <span className="date-text">{formatDate(project.updatedAt)}</span>
                </td>
                <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn-icon"
                    title="编辑"
                    onClick={() => onEditProject(project)}
                  >
                    ✏️
                  </button>
                  <select
                    className="status-select"
                    value={project.status}
                    onChange={(e) => onStatusChange(project.id, e.target.value as ProjectStatus)}
                    title="更改状态"
                  >
                    <option value="pending">待评估</option>
                    <option value="restoring">修复中</option>
                    <option value="drying">待晾干</option>
                    <option value="binding">待装订</option>
                    <option value="delivered">已交付</option>
                  </select>
                  <button
                    className="btn-icon btn-danger"
                    title="删除"
                    onClick={() => onDeleteProject(project.id)}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredAndSortedProjects.length === 0 && (
          <div className="empty-list">
            <p>没有找到匹配的项目</p>
            <p className="empty-hint">尝试调整筛选条件或</p>
            <button className="btn btn-primary btn-small" onClick={onNewProject}>
              + 新建项目
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
