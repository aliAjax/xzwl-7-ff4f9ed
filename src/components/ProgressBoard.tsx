import { useState, useMemo } from 'react';
import type { RestorationProject, ProjectStatus } from '../types';
import { STATUS_LABELS, STATUS_COLORS } from '../types';

interface ProgressBoardProps {
  projects: RestorationProject[];
  onSelectProject: (project: RestorationProject) => void;
  onStatusChange: (id: string, status: ProjectStatus) => void;
  onEditProject: (project: RestorationProject) => void;
}

const STATUS_ORDER: ProjectStatus[] = ['pending', 'restoring', 'drying', 'binding', 'delivered'];

export default function ProgressBoard({
  projects,
  onSelectProject,
  onStatusChange,
  onEditProject,
}: ProgressBoardProps) {
  const [draggedProject, setDraggedProject] = useState<RestorationProject | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ProjectStatus | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProjects = useMemo(() => {
    if (!searchTerm) return projects;
    const term = searchTerm.toLowerCase();
    return projects.filter(p =>
      p.bookTitle.toLowerCase().includes(term) ||
      p.id.toLowerCase().includes(term) ||
      p.damageTypes.some(d => d.toLowerCase().includes(term))
    );
  }, [projects, searchTerm]);

  const projectsByStatus = useMemo(() => {
    const grouped: Record<ProjectStatus, RestorationProject[]> = {
      pending: [],
      restoring: [],
      drying: [],
      binding: [],
      delivered: [],
    };

    filteredProjects.forEach(project => {
      grouped[project.status].push(project);
    });

    Object.keys(grouped).forEach(status => {
      grouped[status as ProjectStatus].sort((a, b) => {
        if (a.priority !== b.priority) {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    });

    return grouped;
  }, [filteredProjects]);

  const handleDragStart = (e: React.DragEvent, project: RestorationProject) => {
    setDraggedProject(project);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', project.id);
  };

  const handleDragEnd = () => {
    setDraggedProject(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: ProjectStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, newStatus: ProjectStatus) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (draggedProject && draggedProject.status !== newStatus) {
      onStatusChange(draggedProject.id, newStatus);
    }

    setDraggedProject(null);
  };

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
    return days >= 0 && days <= 3;
  };

  const getProgressColor = (progress: number, status: ProjectStatus): string => {
    if (status === 'delivered') return '#10b981';
    if (progress >= 80) return '#10b981';
    if (progress >= 50) return '#3b82f6';
    if (progress >= 20) return '#f59e0b';
    return '#ef4444';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  return (
    <div className="kanban-board-container">
      <div className="board-toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="搜索书名、编号、破损类型..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="board-legend">
          <span className="legend-item">
            <span className="legend-dot urgent" /> 紧急
          </span>
          <span className="legend-item">
            <span className="legend-dot overdue" /> 逾期
          </span>
          <span className="legend-tip">💡 拖拽卡片到不同列可更改状态</span>
        </div>
      </div>

      <div className="kanban-board">
        {STATUS_ORDER.map((status) => {
          const colors = STATUS_COLORS[status];
          const columnProjects = projectsByStatus[status];
          const isDragOver = dragOverColumn === status && draggedProject?.status !== status;

          return (
            <div
              key={status}
              className={`kanban-column ${isDragOver ? 'drag-over' : ''} ${draggedProject?.status === status ? 'has-dragging' : ''}`}
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div
                className="column-header"
                style={{
                  background: colors.bg,
                  borderBottomColor: colors.border,
                }}
              >
                <div className="column-title" style={{ color: colors.text }}>
                  <span className="column-name">{STATUS_LABELS[status]}</span>
                  <span className="column-count">{columnProjects.length}</span>
                </div>
              </div>

              <div className="column-content">
                {columnProjects.length === 0 ? (
                  <div className="empty-column">
                    <p>暂无项目</p>
                    <p className="empty-hint">拖拽项目到此处</p>
                  </div>
                ) : (
                  columnProjects.map((project) => (
                    <div
                      key={project.id}
                      className={`kanban-card ${draggedProject?.id === project.id ? 'dragging' : ''} ${isOverdue(project) ? 'card-overdue' : ''} ${isUrgent(project) && !isOverdue(project) ? 'card-urgent' : ''} status-${project.status}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, project)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onSelectProject(project)}
                    >
                      <div className="card-header">
                        <h4 className="card-title">《{project.bookTitle}》</h4>
                        <button
                          className="btn-icon card-edit-btn"
                          title="编辑"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditProject(project);
                          }}
                        >
                          ✏️
                        </button>
                      </div>

                      <div className="card-meta">
                        <span className="card-id">{project.id}</span>
                        <span className={`priority-badge priority-${project.priority}`}>
                          {project.priority === 'high' ? '紧急' : project.priority === 'medium' ? '普通' : '低优'}
                        </span>
                      </div>

                      <div className="card-damage">
                        {project.damageTypes.slice(0, 3).map((type) => (
                          <span key={type} className="damage-tag">{type}</span>
                        ))}
                        {project.damageTypes.length > 3 && (
                          <span className="damage-tag more">+{project.damageTypes.length - 3}</span>
                        )}
                      </div>

                      <div className="card-info">
                        <div className="card-info-row">
                          <span className="card-info-label">册数</span>
                          <span className="card-info-value">{project.volumeCount} 册</span>
                        </div>
                        <div className="card-info-row">
                          <span className="card-info-label">交付</span>
                          <span className={`card-info-value ${isOverdue(project) ? 'text-danger' : isUrgent(project) ? 'text-warning' : ''}`}>
                            {formatDate(project.deliveryDate)}
                            {isOverdue(project) && <span className="card-badge danger">逾期</span>}
                            {isUrgent(project) && !isOverdue(project) && <span className="card-badge warning">紧急</span>}
                          </span>
                        </div>
                      </div>

                      <div className="card-progress">
                        <div className="progress-bar small">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${project.currentProgress}%`,
                              background: getProgressColor(project.currentProgress, project.status),
                            }}
                          />
                        </div>
                        <span className="progress-text small">{project.currentProgress}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
