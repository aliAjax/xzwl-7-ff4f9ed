import { useState, useMemo } from 'react';
import type { RestorationProject, ProjectStatus } from '../types';
import { STATUS_LABELS } from '../types';

interface ProjectListProps {
  projects: RestorationProject[];
  onSelectProject: (project: RestorationProject) => void;
  onStatusChange: (projectId: string, newStatus: ProjectStatus) => void;
}

type SortField = 'bookTitle' | 'deliveryDate' | 'currentProgress' | 'createdAt' | 'volumeCount';
type SortOrder = 'asc' | 'desc';

export default function ProjectList({ projects, onSelectProject, onStatusChange }: ProjectListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('deliveryDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const filteredAndSortedProjects = useMemo(() => {
    let result = [...projects];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.bookTitle.toLowerCase().includes(term) ||
        p.damageTypes.some(t => t.toLowerCase().includes(term)) ||
        (p.notes && p.notes.toLowerCase().includes(term))
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'bookTitle':
          comparison = a.bookTitle.localeCompare(b.bookTitle, 'zh-CN');
          break;
        case 'deliveryDate':
          comparison = new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime();
          break;
        case 'currentProgress':
          comparison = a.currentProgress - b.currentProgress;
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'volumeCount':
          comparison = a.volumeCount - b.volumeCount;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [projects, searchTerm, statusFilter, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getDaysUntilDelivery = (deliveryDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const delivery = new Date(deliveryDate);
    delivery.setHours(0, 0, 0, 0);
    const diffTime = delivery.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getUrgencyClass = (deliveryDate: string, status: ProjectStatus) => {
    if (status === 'delivered') return '';
    const days = getDaysUntilDelivery(deliveryDate);
    if (days < 0) return 'urgency-overdue';
    if (days <= 7) return 'urgency-high';
    if (days <= 14) return 'urgency-medium';
    return '';
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="sort-icon">↕</span>;
    return <span className="sort-icon active">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="project-list-container">
      <div className="list-toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="搜索书名、破损类型、备注..."
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
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="result-count">
          共 {filteredAndSortedProjects.length} 个项目
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
              <th>当前进度</th>
              <th>状态</th>
              <th onClick={() => handleSort('deliveryDate')} className="sortable">
                交付日期 <SortIcon field="deliveryDate" />
              </th>
              <th>剩余天数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedProjects.map(project => {
              const daysLeft = getDaysUntilDelivery(project.deliveryDate);
              const isOverdue = project.status !== 'delivered' && daysLeft < 0;

              return (
                <tr
                  key={project.id}
                  className={`project-row ${getUrgencyClass(project.deliveryDate, project.status)}`}
                  onClick={() => onSelectProject(project)}
                >
                  <td className="title-cell">
                    <span className="book-title">{project.bookTitle}</span>
                    {project.notes && <span className="has-notes">●</span>}
                  </td>
                  <td>{project.volumeCount}册</td>
                  <td>
                    <div className="damage-tags">
                      {project.damageTypes.slice(0, 2).map(type => (
                        <span key={type} className="damage-tag">{type}</span>
                      ))}
                      {project.damageTypes.length > 2 && (
                        <span className="damage-tag more">+{project.damageTypes.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="progress-cell">
                      <div className="progress-bar small">
                        <div
                          className="progress-fill"
                          style={{ width: `${project.currentProgress}%` }}
                        />
                      </div>
                      <span className="progress-text">{project.currentProgress}%</span>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge status-${project.status}`}>
                      {STATUS_LABELS[project.status]}
                    </span>
                  </td>
                  <td>{project.deliveryDate}</td>
                  <td>
                    {project.status === 'delivered' ? (
                      <span className="delivered">已交付</span>
                    ) : (
                      <span className={`days-left ${isOverdue ? 'overdue' : ''}`}>
                        {isOverdue ? `逾期${Math.abs(daysLeft)}天` : `${daysLeft}天`}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
                      <select
                        className="status-select"
                        value={project.status}
                        onChange={(e) => onStatusChange(project.id, e.target.value as ProjectStatus)}
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredAndSortedProjects.length === 0 && (
          <div className="empty-list">
            <p>没有找到匹配的项目</p>
          </div>
        )}
      </div>
    </div>
  );
}
