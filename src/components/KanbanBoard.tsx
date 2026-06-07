import { useState, useRef } from 'react';
import type { RestorationProject, ProjectStatus } from '../types';
import { STATUS_LABELS, STATUS_ORDER } from '../types';

interface KanbanBoardProps {
  projects: RestorationProject[];
  onStatusChange: (projectId: string, newStatus: ProjectStatus) => void;
  onSelectProject: (project: RestorationProject) => void;
}

export default function KanbanBoard({ projects, onStatusChange, onSelectProject }: KanbanBoardProps) {
  const [draggedProject, setDraggedProject] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ProjectStatus | null>(null);
  const dragCounterRef = useRef<Record<string, number>>({});
  const isDraggingRef = useRef(false);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    isDraggingRef.current = true;
    setDraggedProject(projectId);
    e.dataTransfer.setData('text/plain', projectId);
    e.dataTransfer.effectAllowed = 'move';
    if (e.dataTransfer.setDragImage) {
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      e.dataTransfer.setDragImage(target, e.clientX - rect.left, e.clientY - rect.top);
    }
  };

  const handleCardClick = (project: RestorationProject) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = setTimeout(() => {
      if (!isDraggingRef.current) {
        onSelectProject(project);
      }
      isDraggingRef.current = false;
    }, 10);
  };

  const handleDragOver = (e: React.DragEvent, status: ProjectStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragEnter = (e: React.DragEvent, status: ProjectStatus) => {
    e.preventDefault();
    dragCounterRef.current[status] = (dragCounterRef.current[status] || 0) + 1;
    setDragOverColumn(status);
  };

  const handleDragLeave = (e: React.DragEvent, status: ProjectStatus) => {
    e.preventDefault();
    dragCounterRef.current[status] = (dragCounterRef.current[status] || 0) - 1;
    if (dragCounterRef.current[status] <= 0) {
      dragCounterRef.current[status] = 0;
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, status: ProjectStatus) => {
    e.preventDefault();
    e.stopPropagation();
    const projectId = e.dataTransfer.getData('text/plain') || draggedProject;
    if (projectId) {
      onStatusChange(projectId, status);
    }
    setDraggedProject(null);
    setDragOverColumn(null);
    dragCounterRef.current[status] = 0;
  };

  const handleDragEnd = () => {
    setDraggedProject(null);
    setDragOverColumn(null);
    dragCounterRef.current = {};
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  };

  const getProjectsByStatus = (status: ProjectStatus) => {
    return projects.filter(p => p.status === status);
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

  return (
    <div className="kanban-board">
      {STATUS_ORDER.map(status => {
        const columnProjects = getProjectsByStatus(status);
        const isOver = dragOverColumn === status;

        return (
          <div
            key={status}
            className={`kanban-column ${isOver ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragEnter={(e) => handleDragEnter(e, status)}
            onDragLeave={(e) => handleDragLeave(e, status)}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className="kanban-column-header">
              <h3 className="column-title">{STATUS_LABELS[status]}</h3>
              <span className="column-count">{columnProjects.length}</span>
            </div>

            <div className="kanban-cards">
              {columnProjects.map(project => (
                <div
                  key={project.id}
                  className={`kanban-card ${getUrgencyClass(project.deliveryDate, project.status)} ${draggedProject === project.id ? 'dragging' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, project.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleCardClick(project)}
                >
                  <div className="card-header">
                    <h4 className="card-title">{project.bookTitle}</h4>
                    <span className="card-volume">{project.volumeCount}册</span>
                  </div>

                  <div className="card-damages">
                    {project.damageTypes.slice(0, 3).map(type => (
                      <span key={type} className="damage-tag">{type}</span>
                    ))}
                    {project.damageTypes.length > 3 && (
                      <span className="damage-tag more">+{project.damageTypes.length - 3}</span>
                    )}
                  </div>

                  <div className="card-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${project.currentProgress}%` }}
                      />
                    </div>
                    <span className="progress-text">{project.currentProgress}%</span>
                  </div>

                  <div className="card-footer">
                    <span className="delivery-date">
                      交付: {project.deliveryDate}
                    </span>
                    {project.status !== 'delivered' && (
                      <span className={`days-left ${getDaysUntilDelivery(project.deliveryDate) < 0 ? 'overdue' : ''}`}>
                        {getDaysUntilDelivery(project.deliveryDate) < 0
                          ? `逾期${Math.abs(getDaysUntilDelivery(project.deliveryDate))}天`
                          : `${getDaysUntilDelivery(project.deliveryDate)}天`}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {columnProjects.length === 0 && (
                <div className="empty-column">
                  <p>暂无项目</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
