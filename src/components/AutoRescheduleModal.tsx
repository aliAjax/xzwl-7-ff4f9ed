import { useState } from 'react';
import type {
  AutoRescheduleResult,
  ScheduleChange,
  UnresolvedConflict,
} from '../types';

interface AutoRescheduleModalProps {
  result: AutoRescheduleResult;
  onClose: () => void;
  onConfirm: (result: AutoRescheduleResult) => void;
}

const CHANGE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  moved_date: { label: '调整日期', color: '#f59e0b' },
  changed_staff: { label: '更换人员', color: '#3b82f6' },
  both: { label: '日期+人员', color: '#8b5cf6' },
  unchanged: { label: '未变动', color: '#6b7280' },
};

const REASON_LABELS: Record<string, string> = {
  insufficient_staff: '人员不足',
  delivery_too_tight: '交付过紧',
  skill_mismatch: '技能不匹配',
  step_order_violation: '步骤顺序冲突',
  partial_resolution: '部分解决',
};

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: '#fee2e2', text: '#991b1b' },
  medium: { bg: '#fef3c7', text: '#92400e' },
  low: { bg: '#dbeafe', text: '#1e40af' },
};

export default function AutoRescheduleModal({
  result,
  onClose,
  onConfirm,
}: AutoRescheduleModalProps) {
  const [activeTab, setActiveTab] = useState<'changes' | 'unresolved' | 'summary'>('changes');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = () => {
    setIsProcessing(true);
    setTimeout(() => {
      onConfirm(result);
      setIsProcessing(false);
    }, 500);
  };

  const formatTime = (isoString: string): string => {
    const d = new Date(isoString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const getChangeTypeBadge = (changeType: string) => {
    const info = CHANGE_TYPE_LABELS[changeType] || CHANGE_TYPE_LABELS.unchanged;
    return (
      <span
        className="change-type-badge"
        style={{ backgroundColor: info.color + '20', color: info.color, borderColor: info.color }}
      >
        {info.label}
      </span>
    );
  };

  const groupChangesByProject = (changes: ScheduleChange[]) => {
    const groups = new Map<string, ScheduleChange[]>();
    changes.forEach(change => {
      const key = change.projectId;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(change);
    });
    return Array.from(groups.entries());
  };

  const groupedChanges = groupChangesByProject(result.changes);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content extra-large-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-left">
            <h2>🔄 自动重排结果预览</h2>
            <span className="result-summary-badge">
              生成于 {formatTime(result.generatedAt)}
            </span>
          </div>
          <button className="btn btn-close" onClick={onClose} disabled={isProcessing}>×</button>
        </div>

        <div className="modal-body">
          <div className="result-overview-cards">
            <div className="overview-card">
              <div className="overview-value">{result.summary.rescheduledTasks}</div>
              <div className="overview-label">调整任务</div>
            </div>
            <div className="overview-card success">
              <div className="overview-value">{result.summary.conflictsResolved}</div>
              <div className="overview-label">冲突解决</div>
            </div>
            <div className={`overview-card ${result.summary.conflictsRemaining > 0 ? 'warning' : 'success'}`}>
              <div className="overview-value">{result.summary.conflictsRemaining}</div>
              <div className="overview-label">剩余冲突</div>
            </div>
            <div className="overview-card">
              <div className="overview-value">{result.unchangedCount}</div>
              <div className="overview-label">未变动</div>
            </div>
          </div>

          <div className="comparison-section">
            <div className="comparison-item">
              <div className="comparison-label">重排前冲突数</div>
              <div className={`comparison-value ${result.totalConflictCountBefore > 0 ? 'danger' : 'success'}`}>
                {result.totalConflictCountBefore}
              </div>
            </div>
            <div className="comparison-arrow">→</div>
            <div className="comparison-item">
              <div className="comparison-label">重排后冲突数</div>
              <div className={`comparison-value ${result.totalConflictCountAfter > 0 ? 'warning' : 'success'}`}>
                {result.totalConflictCountAfter}
              </div>
            </div>
          </div>

          <div className="date-range-info">
            <span className="date-label">排期范围：</span>
            <span className="date-value">{result.summary.earliestDate} ~ {result.summary.latestDate}</span>
          </div>

          <div className="modal-tabs">
            <button
              className={`tab-btn ${activeTab === 'changes' ? 'active' : ''}`}
              onClick={() => setActiveTab('changes')}
            >
              📋 调整详情 ({result.changes.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'unresolved' ? 'active' : ''}`}
              onClick={() => setActiveTab('unresolved')}
            >
              ⚠️ 未解决问题 ({result.unresolvedConflicts.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              📊 总体情况
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'changes' && (
              <div className="changes-list-container">
                {result.changes.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">✅</div>
                    <p>无需调整，当前排期已最优</p>
                  </div>
                ) : (
                  <div className="changes-groups">
                    {groupedChanges.map(([projectId, changes]) => (
                      <div key={projectId} className="change-group">
                        <div className="change-group-header">
                          <span className="group-project-title">
                            《{changes[0].projectTitle}》
                          </span>
                          <span className="group-change-count">
                            {changes.length} 项调整
                          </span>
                        </div>
                        <div className="change-items">
                          {changes.map((change) => (
                            <div key={change.scheduleItemId} className="change-item">
                              <div className="change-item-header">
                                <span className="change-step-name">{change.stepName}</span>
                                {getChangeTypeBadge(change.changeType)}
                                <span className="change-hours">⏱ {change.estimatedHours}h</span>
                              </div>
                              <div className="change-item-body">
                                {(change.changeType === 'moved_date' || change.changeType === 'both') && (
                                  <div className="change-row">
                                    <span className="change-label">日期：</span>
                                    <span className="old-value">{change.oldDate}</span>
                                    <span className="change-arrow">→</span>
                                    <span className="new-value">{change.newDate}</span>
                                  </div>
                                )}
                                {(change.changeType === 'changed_staff' || change.changeType === 'both') && (
                                  <div className="change-row">
                                    <span className="change-label">人员：</span>
                                    <span className="old-value">👤 {change.oldStaffName}</span>
                                    <span className="change-arrow">→</span>
                                    <span className="new-value">👤 {change.newStaffName}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'unresolved' && (
              <div className="unresolved-container">
                {result.unresolvedConflicts.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🎉</div>
                    <p>所有冲突均已解决！</p>
                  </div>
                ) : (
                  <div className="unresolved-list">
                    {result.unresolvedConflicts.map((conflict, idx) => (
                      <UnresolvedConflictItem key={idx} conflict={conflict} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'summary' && (
              <div className="summary-container">
                <div className="summary-section">
                  <h4>📊 任务统计</h4>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <span className="summary-label">总任务数</span>
                      <span className="summary-value">{result.summary.totalTasks}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">已完成任务</span>
                      <span className="summary-value success">{result.summary.completedTasks}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">待处理任务</span>
                      <span className="summary-value">
                        {result.summary.totalTasks - result.summary.completedTasks}
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">已调整任务</span>
                      <span className="summary-value warning">{result.modifiedCount}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">未变动任务</span>
                      <span className="summary-value">{result.unchangedCount}</span>
                    </div>
                  </div>
                </div>

                <div className="summary-section">
                  <h4>⚖️ 冲突变化</h4>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <span className="summary-label">重排前冲突</span>
                      <span className={`summary-value ${result.totalConflictCountBefore > 0 ? 'danger' : 'success'}`}>
                        {result.totalConflictCountBefore}
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">重排后冲突</span>
                      <span className={`summary-value ${result.totalConflictCountAfter > 0 ? 'warning' : 'success'}`}>
                        {result.totalConflictCountAfter}
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">已解决</span>
                      <span className="summary-value success">{result.summary.conflictsResolved}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">未解决</span>
                      <span className={`summary-value ${result.summary.conflictsRemaining > 0 ? 'warning' : 'success'}`}>
                        {result.summary.conflictsRemaining}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="summary-section">
                  <h4>🔒 保护说明</h4>
                  <ul className="protection-list">
                    <li>✓ 所有已完成的排期项未被改动</li>
                    <li>✓ 修复步骤顺序严格遵守项目流程</li>
                    <li>✓ 人员技能匹配度已考虑</li>
                    <li>✓ 每人每日工时上限已遵守</li>
                    <li>✓ 项目交付日期已作为硬约束</li>
                  </ul>
                </div>

                {result.unresolvedConflicts.length > 0 && (
                  <div className="summary-section">
                    <h4>💡 后续建议</h4>
                    <div className="suggestions-box">
                      <p>以下是解决剩余问题的建议：</p>
                      <ul className="suggestion-list">
                        <li>考虑增加临时修复人员缓解高峰期负载</li>
                        <li>与客户沟通，评估是否可以调整部分项目的交付日期</li>
                        <li>培训现有人员掌握更多技能，提高调度灵活性</li>
                        <li>对高优先级项目，可以考虑简化部分非关键步骤</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <div className="footer-info">
            {result.unresolvedConflicts.length > 0 && (
              <span className="footer-warning">
                ⚠️ 仍有 {result.unresolvedConflicts.length} 个问题未完全解决
              </span>
            )}
          </div>
          <div className="footer-actions">
            <button
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isProcessing}
            >
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <span className="loading-spinner">应用中...</span>
              ) : (
                <>✓ 确认应用重排结果</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UnresolvedConflictItem({ conflict }: { conflict: UnresolvedConflict }) {
  const severityStyle = SEVERITY_COLORS[conflict.severity] || SEVERITY_COLORS.medium;
  const reasonLabel = REASON_LABELS[conflict.reason] || conflict.reason;

  return (
    <div className="unresolved-item">
      <div className="unresolved-header">
        <span
          className="severity-badge"
          style={{ backgroundColor: severityStyle.bg, color: severityStyle.text }}
        >
          {conflict.severity === 'high' ? '🔴 严重' : conflict.severity === 'medium' ? '🟡 中等' : '🔵 轻微'}
        </span>
        <span className="reason-badge">{reasonLabel}</span>
        {conflict.type === 'overload' && <span className="type-badge">人员过载</span>}
        {conflict.type === 'overdue' && <span className="type-badge">项目逾期</span>}
      </div>
      <div className="unresolved-body">
        <p className="conflict-description">{conflict.reasonDescription}</p>
        {conflict.staffName && conflict.date && (
          <div className="conflict-meta">
            <span>👤 {conflict.staffName}</span>
            <span>📅 {conflict.date}</span>
            {conflict.overloadHours !== undefined && (
              <span>⚠️ 超出 {conflict.overloadHours} 小时</span>
            )}
          </div>
        )}
        {conflict.projectTitle && conflict.stepName && (
          <div className="conflict-affected">
            <span>影响：《{conflict.projectTitle}》- {conflict.stepName}</span>
          </div>
        )}
        {conflict.suggestedActions && conflict.suggestedActions.length > 0 && (
          <div className="conflict-suggestions">
            <div className="suggestions-title">💡 建议措施：</div>
            <ul>
              {conflict.suggestedActions.map((action, idx) => (
                <li key={idx}>{action}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
