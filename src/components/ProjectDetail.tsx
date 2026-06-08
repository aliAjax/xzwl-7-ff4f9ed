import type { RestorationProject, ProjectStatus, Priority, RestorationStep } from '../types';
import { STATUS_LABELS, PRIORITY_LABELS } from '../types';

interface ProjectDetailProps {
  project: RestorationProject;
  onClose: () => void;
  onEdit: (project: RestorationProject) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: ProjectStatus) => void;
  onStepToggle: (projectId: string, stepId: string) => void;
  onPriorityChange: (id: string, priority: Priority) => void;
  onStartAssessment: () => void;
  getStatusBadgeClass: (status: ProjectStatus) => string;
}

export default function ProjectDetail({
  project,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  onStepToggle,
  onPriorityChange,
  onStartAssessment,
  getStatusBadgeClass,
}: ProjectDetailProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDaysUntilDelivery = (): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const delivery = new Date(project.deliveryDate);
    delivery.setHours(0, 0, 0, 0);
    return Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getDeliveryStatus = () => {
    const days = getDaysUntilDelivery();
    if (project.status === 'delivered') {
      return { text: '已交付', class: 'delivered' };
    }
    if (days < 0) {
      return { text: `已逾期 ${Math.abs(days)} 天`, class: 'overdue' };
    }
    if (days <= 3) {
      return { text: `${days} 天后交付（紧急）`, class: 'urgent' };
    }
    if (days <= 7) {
      return { text: `${days} 天后交付`, class: 'soon' };
    }
    return { text: `${days} 天后交付`, class: '' };
  };

  const getProgressColor = (): string => {
    if (project.status === 'delivered') return '#10b981';
    if (project.currentProgress >= 80) return '#10b981';
    if (project.currentProgress >= 50) return '#3b82f6';
    if (project.currentProgress >= 20) return '#f59e0b';
    return '#ef4444';
  };

  const deliveryStatus = getDeliveryStatus();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-left">
            <h2>《{project.bookTitle}》</h2>
            <div className="header-tags">
              <span className={getStatusBadgeClass(project.status)}>
                {STATUS_LABELS[project.status]}
              </span>
              <span className={`priority-badge priority-${project.priority}`}>
                {PRIORITY_LABELS[project.priority]}
              </span>
              <span className="project-id">{project.id}</span>
            </div>
          </div>
          <div className="header-actions">
            {project.status === 'pending' && !project.assessment && (
              <button className="btn btn-primary" onClick={onStartAssessment}>
                📋 开始评估
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => onEdit(project)}>
              ✏️ 编辑
            </button>
            <button
              className="btn btn-danger"
              onClick={() => onDelete(project.id)}
            >
              🗑️ 删除
            </button>
            <button className="btn btn-close" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="modal-body">
          <div className="detail-section">
            <h3>基本信息</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">书名</span>
                <span className="info-value">{project.bookTitle}</span>
              </div>
              <div className="info-item">
                <span className="info-label">册数</span>
                <span className="info-value">{project.volumeCount} 册</span>
              </div>
              <div className="info-item">
                <span className="info-label">破损类型</span>
                <div className="damage-tags">
                  {project.damageTypes.map((type) => (
                    <span key={type} className="damage-tag">{type}</span>
                  ))}
                </div>
              </div>
              <div className="info-item">
                <span className="info-label">优先级</span>
                <select
                  value={project.priority}
                  onChange={(e) => onPriorityChange(project.id, e.target.value as Priority)}
                  className="priority-select"
                >
                  <option value="high">紧急</option>
                  <option value="medium">普通</option>
                  <option value="low">低优</option>
                </select>
              </div>
              <div className="info-item">
                <span className="info-label">当前状态</span>
                <select
                  value={project.status}
                  onChange={(e) => onStatusChange(project.id, e.target.value as ProjectStatus)}
                  className="status-select"
                >
                  <option value="pending">待评估</option>
                  <option value="restoring">修复中</option>
                  <option value="drying">待晾干</option>
                  <option value="binding">待装订</option>
                  <option value="delivered">已交付</option>
                </select>
              </div>
              <div className="info-item">
                <span className="info-label">交付日期</span>
                <span className={`info-value delivery-${deliveryStatus.class}`}>
                  {formatDate(project.deliveryDate)}
                  <span className={`delivery-badge ${deliveryStatus.class}`}>
                    {deliveryStatus.text}
                  </span>
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">创建时间</span>
                <span className="info-value">{formatDate(project.createdAt)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">更新时间</span>
                <span className="info-value">{formatDate(project.updatedAt)}</span>
              </div>
            </div>
          </div>

          {project.description && (
            <div className="detail-section">
              <h3>项目描述</h3>
              <p className="description-text">{project.description}</p>
            </div>
          )}

          {project.notes && (
            <div className="detail-section">
              <h3>备注</h3>
              <p className="notes-text">{project.notes}</p>
            </div>
          )}

          {project.assessment && (
            <div className="detail-section">
              <h3>修复评估</h3>
              <div className="assessment-summary">
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">纸张状态</span>
                    <span className="info-value">{project.assessment.paperCondition}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">破损严重度</span>
                    <span className="info-value">{project.assessment.damageSeverity}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">预计工期</span>
                    <span className="info-value">{project.assessment.estimatedDuration}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">评估日期</span>
                    <span className="info-value">{formatDate(project.assessment.completedAt)}</span>
                  </div>
                </div>
                {project.assessment.repairSuggestion && (
                  <div className="suggestion-box">
                    <h4>修复建议</h4>
                    <p>{project.assessment.repairSuggestion}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="detail-section">
            <div className="section-header">
              <h3>修复进度</h3>
              <div className="progress-summary">
                <div className="progress-bar large">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${project.currentProgress}%`,
                      background: getProgressColor(),
                    }}
                  />
                </div>
                <span className="progress-text">{project.currentProgress}%</span>
              </div>
            </div>
            <div className="steps-list">
              {project.restorationSteps.map((step: RestorationStep, index: number) => (
                <div
                  key={step.id}
                  className={`step-item ${step.completed ? 'completed' : ''}`}
                >
                  <label className="step-checkbox">
                    <input
                      type="checkbox"
                      checked={step.completed}
                      onChange={() => onStepToggle(project.id, step.id)}
                    />
                    <span className="checkmark">✓</span>
                  </label>
                  <div className="step-content">
                    <div className="step-header">
                      <span className="step-number">{index + 1}</span>
                      <span className="step-name">{step.name}</span>
                    </div>
                    {step.description && (
                      <p className="step-description">{step.description}</p>
                    )}
                    <div className="step-meta">
                      <span className="step-duration">预计 {step.estimatedDuration} 天</span>
                      {step.completedAt && (
                        <span className="step-completed-at">
                          完成于 {formatDate(step.completedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="detail-section">
            <h3>材料使用记录</h3>
            {project.materialsUsed.length > 0 ? (
              <table className="materials-table">
                <thead>
                  <tr>
                    <th>材料名称</th>
                    <th>用量</th>
                    <th>单位</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {project.materialsUsed.map((material) => (
                    <tr key={material.id}>
                      <td>{material.name}</td>
                      <td>{material.quantity}</td>
                      <td>{material.unit}</td>
                      <td>{material.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty-text">暂无材料使用记录</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
