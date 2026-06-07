import type { RestorationProject, ImageRecord } from '../types';
import { STATUS_LABELS, PAPER_CONDITION_LABELS, DAMAGE_SEVERITY_LABELS, POLLUTION_TYPE_LABELS, BINDING_CONDITION_LABELS } from '../types';
import ImageRecordsManager from './ImageRecordsManager';

interface ProjectDetailProps {
  project: RestorationProject;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStepToggle: (stepIndex: number) => void;
  onUpdateImageRecords: (records: ImageRecord[]) => { success: boolean; error?: string };
  onStartAssessment: () => void;
}

export default function ProjectDetail({ project, onClose, onEdit, onDelete, onStepToggle, onUpdateImageRecords, onStartAssessment }: ProjectDetailProps) {
  const getDaysUntilDelivery = (deliveryDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const delivery = new Date(deliveryDate);
    delivery.setHours(0, 0, 0, 0);
    const diffTime = delivery.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const completedSteps = project.restorationSteps.filter(s => s.completed).length;
  const totalSteps = project.restorationSteps.length;
  const daysLeft = getDaysUntilDelivery(project.deliveryDate);
  const isOverdue = project.status !== 'delivered' && daysLeft < 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-left">
            <h2>{project.bookTitle}</h2>
            <span className={`status-badge status-${project.status}`}>
              {STATUS_LABELS[project.status]}
            </span>
          </div>
          <div className="header-actions">
            {project.status === 'pending-evaluation' && (
              <button className="btn btn-primary" onClick={onStartAssessment}>
                📋 修复评估
              </button>
            )}
            <button className="btn btn-secondary" onClick={onEdit}>编辑</button>
            <button className="btn btn-danger" onClick={onDelete}>删除</button>
            <button className="btn btn-close" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="modal-body">
          <div className="detail-section">
            <h3>基本信息</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">册数</span>
                <span className="info-value">{project.volumeCount}册</span>
              </div>
              <div className="info-item">
                <span className="info-label">创建日期</span>
                <span className="info-value">{project.createdAt}</span>
              </div>
              <div className="info-item">
                <span className="info-label">更新日期</span>
                <span className="info-value">{project.updatedAt}</span>
              </div>
              <div className="info-item">
                <span className="info-label">交付日期</span>
                <span className={`info-value ${isOverdue ? 'overdue' : ''}`}>
                  {project.deliveryDate}
                  {project.status !== 'delivered' && (
                    <span className="days-badge">
                      {isOverdue ? `逾期${Math.abs(daysLeft)}天` : `剩余${daysLeft}天`}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h3>破损类型</h3>
            <div className="damage-tags large">
              {project.damageTypes.map(type => (
                <span key={type} className="damage-tag">{type}</span>
              ))}
            </div>
          </div>

          {project.assessment && (
            <div className="detail-section assessment-display">
              <h3>修复评估单</h3>
              <div className="assessment-completed-badge">✓ 评估已完成 · {project.assessment.completedAt}</div>

              <div className="assessment-grid">
                <div className="assessment-item">
                  <span className="assessment-label">纸张状态</span>
                  <span className="assessment-value">{PAPER_CONDITION_LABELS[project.assessment.paperCondition]}</span>
                </div>
                <div className="assessment-item">
                  <span className="assessment-label">破损严重度</span>
                  <span className="assessment-value">{DAMAGE_SEVERITY_LABELS[project.assessment.damageSeverity]}</span>
                </div>
                <div className="assessment-item">
                  <span className="assessment-label">装帧情况</span>
                  <span className="assessment-value">{BINDING_CONDITION_LABELS[project.assessment.bindingCondition]}</span>
                </div>
              </div>

              {project.assessment.pollutionTypes.length > 0 && (
                <div className="assessment-item full-width">
                  <span className="assessment-label">污染类型</span>
                  <div className="pollution-tags">
                    {project.assessment.pollutionTypes.map(type => (
                      <span key={type} className="pollution-tag">{POLLUTION_TYPE_LABELS[type]}</span>
                    ))}
                  </div>
                </div>
              )}

              {project.assessment.repairSuggestion && (
                <div className="assessment-item full-width">
                  <span className="assessment-label">修复建议</span>
                  <p className="assessment-text">{project.assessment.repairSuggestion}</p>
                </div>
              )}

              <div className="assessment-item full-width">
                <span className="assessment-label">预计工期</span>
                <span className="assessment-value highlight">{project.assessment.estimatedDuration}</span>
              </div>

              <div className="assessment-item full-width">
                <span className="assessment-label">材料预估</span>
                <table className="materials-table compact">
                  <thead>
                    <tr>
                      <th>材料名称</th>
                      <th>预估数量</th>
                      <th>单位</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.assessment.materialEstimates.map((material, index) => (
                      <tr key={index}>
                        <td>{material.name}</td>
                        <td>{material.quantity}</td>
                        <td>{material.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="detail-section">
            <h3>修复进度</h3>
            <div className="progress-overview">
              <div className="progress-bar large">
                <div
                  className="progress-fill"
                  style={{ width: `${project.currentProgress}%` }}
                />
              </div>
              <span className="progress-text-large">{project.currentProgress}%</span>
              <span className="steps-count">({completedSteps}/{totalSteps} 步骤)</span>
            </div>

            <div className="steps-list">
              {project.restorationSteps.map((step, index) => (
                <div
                  key={index}
                  className={`step-item ${step.completed ? 'completed' : ''}`}
                  onClick={() => onStepToggle(index)}
                >
                  <div className="step-checkbox">
                    <input
                      type="checkbox"
                      checked={step.completed}
                      onChange={() => {}}
                    />
                  </div>
                  <div className="step-info">
                    <span className="step-name">{step.name}</span>
                    {step.date && <span className="step-date">完成于 {step.date}</span>}
                  </div>
                  {step.note && <span className="step-note">{step.note}</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="detail-section">
            <h3>材料使用</h3>
            {project.materialsUsed.length > 0 ? (
              <table className="materials-table">
                <thead>
                  <tr>
                    <th>材料名称</th>
                    <th>数量</th>
                    <th>单位</th>
                  </tr>
                </thead>
                <tbody>
                  {project.materialsUsed.map((material, index) => (
                    <tr key={index}>
                      <td>{material.name}</td>
                      <td>{material.quantity}</td>
                      <td>{material.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty-text">暂无材料记录</p>
            )}
          </div>

          {project.notes && (
            <div className="detail-section">
              <h3>备注</h3>
              <p className="notes-text">{project.notes}</p>
            </div>
          )}

          <div className="detail-section">
            <ImageRecordsManager
              project={project}
              onUpdateRecords={onUpdateImageRecords}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
