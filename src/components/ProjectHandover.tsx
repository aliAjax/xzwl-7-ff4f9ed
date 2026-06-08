import { useState, useEffect, useMemo } from 'react';
import type { RestorationProject, HandoverRecord, ProjectStatus } from '../types';
import { STATUS_LABELS } from '../types';
import {
  getHandoverRecordsByProjectId,
  generateHandoverFromProject,
  createHandoverRecord,
  updateHandoverRecord,
  deleteHandoverRecord,
} from '../utils/storage';

interface ProjectHandoverProps {
  project: RestorationProject;
  onClose: () => void;
  getStatusBadgeClass: (status: ProjectStatus) => string;
}

type ViewMode = 'list' | 'create' | 'edit' | 'preview';

export default function ProjectHandover({ project, onClose, getStatusBadgeClass }: ProjectHandoverProps) {
  const [records, setRecords] = useState<HandoverRecord[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingRecord, setEditingRecord] = useState<HandoverRecord | null>(null);
  const [previewRecord, setPreviewRecord] = useState<HandoverRecord | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    handoverNotes: '',
    receiver: '',
    handoverDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    refreshRecords();
  }, [project.id]);

  useEffect(() => {
    if (viewMode === 'preview') {
      document.body.classList.add('printing-handover');
    } else {
      document.body.classList.remove('printing-handover');
    }
    return () => {
      document.body.classList.remove('printing-handover');
    };
  }, [viewMode]);

  const refreshRecords = () => {
    setRecords(getHandoverRecordsByProjectId(project.id));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const startCreate = () => {
    const autoData = generateHandoverFromProject(project);
    setFormData({
      handoverNotes: autoData.handoverNotes,
      receiver: autoData.receiver,
      handoverDate: autoData.handoverDate,
    });
    setEditingRecord(null);
    setViewMode('create');
  };

  const startEdit = (record: HandoverRecord) => {
    setFormData({
      handoverNotes: record.handoverNotes,
      receiver: record.receiver,
      handoverDate: record.handoverDate,
    });
    setEditingRecord(record);
    setViewMode('edit');
  };

  const showPreview = (record: HandoverRecord) => {
    setPreviewRecord(record);
    setViewMode('preview');
  };

  const handleSave = () => {
    if (!formData.receiver.trim()) {
      setMessage({ type: 'error', text: '请填写接收人' });
      return;
    }
    if (!formData.handoverDate) {
      setMessage({ type: 'error', text: '请选择交接日期' });
      return;
    }

    const autoData = generateHandoverFromProject(project);
    const recordData = {
      ...autoData,
      handoverNotes: formData.handoverNotes,
      receiver: formData.receiver.trim(),
      handoverDate: formData.handoverDate,
    };

    try {
      if (viewMode === 'create') {
        createHandoverRecord(recordData);
        setMessage({ type: 'success', text: '交接单创建成功' });
      } else if (viewMode === 'edit' && editingRecord) {
        updateHandoverRecord(editingRecord.id, recordData);
        setMessage({ type: 'success', text: '交接单更新成功' });
      }
      refreshRecords();
      setViewMode('list');
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: '保存失败' });
    }
  };

  const handleDelete = (recordId: string) => {
    if (!window.confirm('确定要删除这份交接单吗？')) return;
    const result = deleteHandoverRecord(recordId);
    if (result.success) {
      refreshRecords();
      setMessage({ type: 'success', text: '交接单已删除' });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: result.error || '删除失败' });
    }
  };

  const handlePrint = () => {
    if (viewMode !== 'preview') {
      return;
    }

    document.body.classList.add('printing-handover-active');

    setTimeout(() => {
      window.print();

      setTimeout(() => {
        document.body.classList.remove('printing-handover-active');
      }, 500);
    }, 250);
  };

  const previewData = useMemo(() => {
    if (viewMode === 'preview' && previewRecord) {
      return previewRecord;
    }
    if ((viewMode === 'create' || viewMode === 'edit') && editingRecord) {
      const autoData = generateHandoverFromProject(project);
      return {
        ...editingRecord,
        ...autoData,
        ...formData,
      };
    }
    if (viewMode === 'create') {
      const autoData = generateHandoverFromProject(project);
      return {
        ...autoData,
        ...formData,
        id: '临时',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return null;
  }, [viewMode, previewRecord, editingRecord, project, formData]);

  const renderList = () => (
    <div className="handover-list">
      <div className="handover-header">
        <h3>交接单列表</h3>
        <button className="btn btn-primary" onClick={startCreate}>
          + 新建交接单
        </button>
      </div>

      {records.length > 0 ? (
        <div className="handover-records-list">
          {records.map((record) => (
            <div key={record.id} className="handover-record-card">
              <div className="handover-record-header">
                <div className="handover-record-info">
                  <span className="handover-record-id">{record.id}</span>
                  <span className="handover-record-date">
                    交接日期：{formatDate(record.handoverDate)}
                  </span>
                </div>
                <div className="handover-record-actions">
                  <button className="btn btn-small btn-secondary" onClick={() => showPreview(record)}>
                    👁 查看
                  </button>
                  <button className="btn btn-small btn-secondary" onClick={() => startEdit(record)}>
                    ✏️ 编辑
                  </button>
                  <button className="btn btn-small btn-secondary" onClick={() => handleDelete(record.id)}>
                    🗑️ 删除
                  </button>
                </div>
              </div>
              <div className="handover-record-body">
                <div className="info-grid compact">
                  <div className="info-item">
                    <span className="info-label">接收人</span>
                    <span className="info-value">{record.receiver}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">完成步骤</span>
                    <span className="info-value">{record.completedSteps.length} 个</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">使用材料</span>
                    <span className="info-value">{record.materialsSummary.length} 种</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">影像记录</span>
                    <span className="info-value">{record.imagesSummary.reduce((sum, i) => sum + i.count, 0)} 张</span>
                  </div>
                </div>
                {record.handoverNotes && (
                  <div className="handover-notes-preview">
                    <span className="info-label">交接说明：</span>
                    <span>{record.handoverNotes}</span>
                  </div>
                )}
              </div>
              <div className="handover-record-footer">
                <span className="handover-created">创建于 {formatDateTime(record.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-list">
          <p>暂无交接单记录</p>
          <button className="btn btn-primary" onClick={startCreate}>
            创建第一份交接单
          </button>
        </div>
      )}
    </div>
  );

  const renderForm = () => (
    <div className="handover-form">
      <div className="form-header">
        <button className="btn btn-secondary" onClick={() => setViewMode('list')}>
          ← 返回列表
        </button>
        <h3>{viewMode === 'create' ? '新建交接单' : '编辑交接单'}</h3>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={() => setViewMode('list')}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            💾 保存
          </button>
        </div>
      </div>

      {message && (
        <div className={`message-banner ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="form-content">
        <div className="auto-filled-section">
          <h4>自动带出信息</h4>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">书名</span>
              <span className="info-value">《{project.bookTitle}》</span>
            </div>
            <div className="info-item">
              <span className="info-label">项目编号</span>
              <span className="info-value">{project.id}</span>
            </div>
            <div className="info-item">
              <span className="info-label">卷册数</span>
              <span className="info-value">{project.volumeCount} 册</span>
            </div>
            <div className="info-item">
              <span className="info-label">当前状态</span>
              <span className={getStatusBadgeClass(project.status)}>
                {STATUS_LABELS[project.status]}
              </span>
            </div>
          </div>
        </div>

        <div className="auto-filled-section">
          <h4>已完成修复步骤</h4>
          {project.restorationSteps.filter(s => s.completed).length > 0 ? (
            <table className="materials-table compact">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>步骤名称</th>
                  <th>完成日期</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {project.restorationSteps
                  .filter(s => s.completed)
                  .map((step, index) => (
                    <tr key={step.id}>
                      <td>{index + 1}</td>
                      <td>{step.name}</td>
                      <td>{formatDate(step.completedAt || step.date || '')}</td>
                      <td>{step.notes || '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-text">暂无已完成步骤</p>
          )}
        </div>

        <div className="auto-filled-section">
          <h4>材料使用记录</h4>
          {project.materialsUsed.length > 0 ? (
            <table className="materials-table compact">
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

        <div className="auto-filled-section">
          <h4>影像记录摘要</h4>
          {project.imageRecords && project.imageRecords.length > 0 ? (
            <div className="image-summary-grid">
              {(() => {
                const byStage = new Map<string, number>();
                project.imageRecords?.forEach(img => {
                  byStage.set(img.stage, (byStage.get(img.stage) || 0) + 1);
                });
                return Array.from(byStage.entries()).map(([stage, count]) => (
                  <div key={stage} className="image-summary-item">
                    <span className="image-stage">
                      {stage === 'before' ? '修复前' : stage === 'during' ? '修复中' : '修复后'}
                    </span>
                    <span className="image-count">{count} 张</span>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <p className="empty-text">暂无影像记录</p>
          )}
        </div>

        <div className="editable-section">
          <h4>交接信息（可编辑）</h4>
          <div className="form-row">
            <div className="form-group">
              <label>接收人 <span className="required">*</span></label>
              <input
                type="text"
                value={formData.receiver}
                onChange={(e) => setFormData({ ...formData, receiver: e.target.value })}
                placeholder="请输入接收人姓名"
              />
            </div>
            <div className="form-group">
              <label>交接日期 <span className="required">*</span></label>
              <input
                type="date"
                value={formData.handoverDate}
                onChange={(e) => setFormData({ ...formData, handoverDate: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group">
            <label>交接说明</label>
            <textarea
              value={formData.handoverNotes}
              onChange={(e) => setFormData({ ...formData, handoverNotes: e.target.value })}
              placeholder="请输入交接说明、注意事项等信息..."
              rows={4}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderPreview = () => {
    if (!previewData) return null;

    return (
      <div className="handover-preview">
        <div className="preview-header no-print">
          <button className="btn btn-secondary" onClick={() => setViewMode('list')}>
            ← 返回列表
          </button>
          <h3>交接单预览</h3>
          <div className="preview-actions">
            <button className="btn btn-primary" onClick={handlePrint}>
              🖨️ 打印
            </button>
          </div>
        </div>

        <div className="print-area" id="handover-print-area">
          <div className="print-header">
            <h2>古籍修复项目交接单</h2>
            <div className="print-header-info">
              <span>交接单编号：{previewData.id}</span>
              <span>打印日期：{formatDate(new Date().toISOString())}</span>
            </div>
          </div>

          <div className="print-section">
            <h4>一、项目基本信息</h4>
            <table className="print-table">
              <tbody>
                <tr>
                  <th>书名</th>
                  <td>《{previewData.bookTitle}》</td>
                  <th>项目编号</th>
                  <td>{previewData.projectNumber}</td>
                </tr>
                <tr>
                  <th>卷册数</th>
                  <td>{previewData.volumeCount} 册</td>
                  <th>当前状态</th>
                  <td>{STATUS_LABELS[previewData.currentStatus]}</td>
                </tr>
                <tr>
                  <th>交接日期</th>
                  <td>{formatDate(previewData.handoverDate)}</td>
                  <th>接收人</th>
                  <td>{previewData.receiver}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="print-section">
            <h4>二、已完成修复步骤</h4>
            {previewData.completedSteps.length > 0 ? (
              <table className="print-table full-width">
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>步骤名称</th>
                    <th>完成日期</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.completedSteps.map((step, index) => (
                    <tr key={step.stepId}>
                      <td>{index + 1}</td>
                      <td>{step.stepName}</td>
                      <td>{formatDate(step.completedAt)}</td>
                      <td>{step.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty-text print-empty">暂无已完成步骤</p>
            )}
          </div>

          <div className="print-section">
            <h4>三、材料使用记录</h4>
            {previewData.materialsSummary.length > 0 ? (
              <table className="print-table full-width">
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>材料名称</th>
                    <th>用量</th>
                    <th>单位</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.materialsSummary.map((material, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{material.name}</td>
                      <td>{material.quantity}</td>
                      <td>{material.unit}</td>
                      <td>{material.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty-text print-empty">暂无材料使用记录</p>
            )}
          </div>

          <div className="print-section">
            <h4>四、影像记录摘要</h4>
            {previewData.imagesSummary.length > 0 ? (
              <table className="print-table full-width">
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>阶段</th>
                    <th>照片数量</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.imagesSummary.map((item, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{item.stage === 'before' ? '修复前' : item.stage === 'during' ? '修复中' : '修复后'}</td>
                      <td>{item.count} 张</td>
                      <td>{item.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty-text print-empty">暂无影像记录</p>
            )}
          </div>

          {previewData.handoverNotes && (
            <div className="print-section">
              <h4>五、交接说明</h4>
              <div className="handover-notes-print">
                {previewData.handoverNotes}
              </div>
            </div>
          )}

          <div className="print-signatures">
            <div className="signature-block">
              <span>移交人签字：</span>
              <span className="signature-line"></span>
            </div>
            <div className="signature-block">
              <span>接收人签字：</span>
              <span className="signature-line"></span>
            </div>
            <div className="signature-block">
              <span>日期：</span>
              <span className="signature-line"></span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`modal-overlay handover-print-overlay ${viewMode === 'preview' ? 'handover-print-mode' : ''}`}
      onClick={onClose}
    >
      <div 
        className={`modal-content detail-modal large-modal handover-modal ${viewMode === 'preview' ? 'preview-modal' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header no-print">
          <div className="header-left">
            <h2>📋 《{project.bookTitle}》- 项目交接单</h2>
          </div>
          <div className="header-actions">
            <button className="btn btn-close" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="modal-body">
          {message && viewMode === 'list' && (
            <div className={`message-banner ${message.type}`}>
              {message.text}
            </div>
          )}

          {viewMode === 'list' && renderList()}
          {(viewMode === 'create' || viewMode === 'edit') && renderForm()}
          {viewMode === 'preview' && renderPreview()}
        </div>
      </div>
    </div>
  );
}
