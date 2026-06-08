import { useState, useEffect, useMemo } from 'react';
import type { RestorationProject, RepairReport, ProjectStatus, ImageRecord, RestorationStage } from '../types';
import { STATUS_LABELS, STAGE_LABELS, STAGE_ORDER } from '../types';
import {
  getRepairReportsByProjectId,
  generateRepairReportFromProject,
  createRepairReport,
  updateRepairReport,
  deleteRepairReport,
} from '../utils/storage';

interface RepairReportProps {
  project: RestorationProject;
  onClose: () => void;
  getStatusBadgeClass: (status: ProjectStatus) => string;
}

type ViewMode = 'list' | 'create' | 'edit' | 'preview';

export default function RepairReport({ project, onClose, getStatusBadgeClass }: RepairReportProps) {
  const [reports, setReports] = useState<RepairReport[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingReport, setEditingReport] = useState<RepairReport | null>(null);
  const [previewReport, setPreviewReport] = useState<RepairReport | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    assessmentConclusion: '',
    reportNotes: '',
  });

  useEffect(() => {
    refreshReports();
  }, [project.id]);

  useEffect(() => {
    if (viewMode === 'preview') {
      document.body.classList.add('printing-report');
    } else {
      document.body.classList.remove('printing-report');
    }
    return () => {
      document.body.classList.remove('printing-report');
    };
  }, [viewMode]);

  const refreshReports = () => {
    setReports(getRepairReportsByProjectId(project.id));
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

  const getImageSrc = (image: ImageRecord): string => {
    return image.dataUrl || image.imageData || image.thumbnail || '';
  };

  const getImagesByStage = (images: ImageRecord[]): Map<RestorationStage, ImageRecord[]> => {
    const byStage = new Map<RestorationStage, ImageRecord[]>();
    STAGE_ORDER.forEach(stage => byStage.set(stage, []));
    images.forEach(img => {
      const stage = img.stage as RestorationStage;
      const existing = byStage.get(stage) || [];
      byStage.set(stage, [...existing, img]);
    });
    return byStage;
  };

  const startCreate = () => {
    const autoData = generateRepairReportFromProject(project);
    setFormData({
      assessmentConclusion: autoData.assessmentConclusion,
      reportNotes: '',
    });
    setEditingReport(null);
    setViewMode('create');
  };

  const startEdit = (report: RepairReport) => {
    setFormData({
      assessmentConclusion: report.assessmentConclusion,
      reportNotes: report.reportNotes,
    });
    setEditingReport(report);
    setViewMode('edit');
  };

  const showPreview = (report: RepairReport) => {
    setPreviewReport(report);
    setViewMode('preview');
  };

  const handleSave = () => {
    if (!formData.assessmentConclusion.trim()) {
      setMessage({ type: 'error', text: '请填写评估结论' });
      return;
    }

    const autoData = generateRepairReportFromProject(project);
    const reportData = {
      ...autoData,
      assessmentConclusion: formData.assessmentConclusion.trim(),
      reportNotes: formData.reportNotes.trim(),
    };

    try {
      if (viewMode === 'create') {
        createRepairReport(reportData);
        setMessage({ type: 'success', text: '修复报告创建成功' });
      } else if (viewMode === 'edit' && editingReport) {
        updateRepairReport(editingReport.id, reportData);
        setMessage({ type: 'success', text: '修复报告更新成功' });
      }
      refreshReports();
      setViewMode('list');
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: '保存失败' });
    }
  };

  const handleDelete = (reportId: string) => {
    if (!window.confirm('确定要删除这份修复报告吗？')) return;
    const result = deleteRepairReport(reportId);
    if (result.success) {
      refreshReports();
      setMessage({ type: 'success', text: '修复报告已删除' });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: result.error || '删除失败' });
    }
  };

  const handlePrint = () => {
    if (viewMode !== 'preview') {
      return;
    }

    document.body.classList.add('printing-report-active');

    setTimeout(() => {
      window.print();

      setTimeout(() => {
        document.body.classList.remove('printing-report-active');
      }, 500);
    }, 250);
  };

  const previewData = useMemo(() => {
    if (viewMode === 'preview' && previewReport) {
      return previewReport;
    }
    if ((viewMode === 'create' || viewMode === 'edit') && editingReport) {
      const autoData = generateRepairReportFromProject(project);
      return {
        ...editingReport,
        ...autoData,
        ...formData,
      };
    }
    if (viewMode === 'create') {
      const autoData = generateRepairReportFromProject(project);
      return {
        ...autoData,
        ...formData,
        id: '临时',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return null;
  }, [viewMode, previewReport, editingReport, project, formData]);

  const renderList = () => (
    <div className="report-list">
      <div className="report-header">
        <h3>修复报告列表</h3>
        <button className="btn btn-primary" onClick={startCreate}>
          + 新建修复报告
        </button>
      </div>

      {reports.length > 0 ? (
        <div className="report-records-list">
          {reports.map((report) => (
            <div key={report.id} className="report-record-card">
              <div className="report-record-header">
                <div className="report-record-info">
                  <span className="report-record-id">{report.id}</span>
                  <span className="report-record-date">
                    创建日期：{formatDate(report.createdAt)}
                  </span>
                </div>
                <div className="report-record-actions">
                  <button className="btn btn-small btn-secondary" onClick={() => showPreview(report)}>
                    👁 查看
                  </button>
                  <button className="btn btn-small btn-secondary" onClick={() => startEdit(report)}>
                    ✏️ 编辑
                  </button>
                  <button className="btn btn-small btn-secondary" onClick={() => handleDelete(report.id)}>
                    🗑️ 删除
                  </button>
                </div>
              </div>
              <div className="report-record-body">
                <div className="info-grid compact">
                  <div className="info-item">
                    <span className="info-label">完成步骤</span>
                    <span className="info-value">{report.completedSteps.length} 个</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">使用材料</span>
                    <span className="info-value">{report.materialsSummary.length} 种</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">影像记录</span>
                    <span className="info-value">{report.imagesSummary.reduce((sum, i) => sum + i.count, 0)} 张</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">交付日期</span>
                    <span className="info-value">{formatDate(report.deliveryDate)}</span>
                  </div>
                </div>
                {report.reportNotes && (
                  <div className="report-notes-preview">
                    <span className="info-label">备注：</span>
                    <span>{report.reportNotes}</span>
                  </div>
                )}
              </div>
              <div className="report-record-footer">
                <span className="report-created">创建于 {formatDateTime(report.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-list">
          <p>暂无修复报告记录</p>
          <button className="btn btn-primary" onClick={startCreate}>
            创建第一份修复报告
          </button>
        </div>
      )}
    </div>
  );

  const renderForm = () => (
    <div className="report-form">
      <div className="form-header">
        <button className="btn btn-secondary" onClick={() => setViewMode('list')}>
          ← 返回列表
        </button>
        <h3>{viewMode === 'create' ? '新建修复报告' : '编辑修复报告'}</h3>
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
          <h4>项目基本信息</h4>
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
          <h4>损伤类型</h4>
          <div className="damage-tags">
            {project.damageTypes.map((type) => (
              <span key={type} className="damage-tag">{type}</span>
            ))}
          </div>
        </div>

        <div className="editable-section">
          <h4>评估结论（可编辑）</h4>
          <div className="form-group">
            <label>评估结论 <span className="required">*</span></label>
            <textarea
              value={formData.assessmentConclusion}
              onChange={(e) => setFormData({ ...formData, assessmentConclusion: e.target.value })}
              placeholder="请输入或编辑评估结论..."
              rows={4}
            />
          </div>
        </div>

        <div className="auto-filled-section">
          <h4>修复步骤完成情况</h4>
          {project.restorationSteps.length > 0 ? (
            <table className="materials-table compact">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>步骤名称</th>
                  <th>状态</th>
                  <th>完成日期</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {project.restorationSteps.map((step, index) => (
                  <tr key={step.id} className={step.completed ? 'step-completed' : 'step-pending'}>
                    <td>{index + 1}</td>
                    <td>{step.name}</td>
                    <td>
                      <span className={`step-status ${step.completed ? 'completed' : 'pending'}`}>
                        {step.completed ? '已完成' : '未完成'}
                      </span>
                    </td>
                    <td>{step.completed ? formatDate(step.completedAt || step.date || '') : '-'}</td>
                    <td>{step.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-text">暂无修复步骤</p>
          )}
        </div>

        <div className="auto-filled-section">
          <h4>材料消耗记录</h4>
          {project.materialsUsed.length > 0 ? (
            <table className="materials-table compact">
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
                {project.materialsUsed.map((material, index) => (
                  <tr key={material.id}>
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
            <p className="empty-text">暂无材料使用记录</p>
          )}
        </div>

        <div className="auto-filled-section">
          <h4>修复前中后影像记录</h4>
          {project.imageRecords && project.imageRecords.length > 0 ? (
            <div className="images-by-stage">
              {Array.from(getImagesByStage(project.imageRecords).entries()).map(([stage, images]) => (
                images.length > 0 && (
                  <div key={stage} className="image-stage-section">
                    <h5 className="image-stage-title">
                      {STAGE_LABELS[stage]}（{images.length} 张）
                    </h5>
                    <div className="image-thumbnail-grid">
                      {images.map((image) => {
                        const src = getImageSrc(image);
                        return (
                          <div key={image.id} className="image-thumbnail-item">
                            {src ? (
                              <img
                                src={src}
                                alt={image.description || image.fileName}
                                className="image-thumbnail"
                                loading="lazy"
                              />
                            ) : (
                              <div className="image-placeholder">📷</div>
                            )}
                            {image.description && (
                              <div className="image-thumbnail-caption">{image.description}</div>
                            )}
                            <div className="image-thumbnail-date">{formatDate(image.photoDate)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              ))}
            </div>
          ) : (
            <p className="empty-text">暂无影像记录</p>
          )}
        </div>

        <div className="auto-filled-section">
          <h4>交付日期</h4>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">计划交付日期</span>
              <span className="info-value">{formatDate(project.deliveryDate)}</span>
            </div>
          </div>
        </div>

        <div className="editable-section">
          <h4>报告备注（可编辑）</h4>
          <div className="form-group">
            <label>备注</label>
            <textarea
              value={formData.reportNotes}
              onChange={(e) => setFormData({ ...formData, reportNotes: e.target.value })}
              placeholder="请输入报告备注、特殊说明等信息..."
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
      <div className="report-preview">
        <div className="preview-header no-print">
          <button className="btn btn-secondary" onClick={() => setViewMode('list')}>
            ← 返回列表
          </button>
          <h3>修复报告预览</h3>
          <div className="preview-actions">
            <button className="btn btn-primary" onClick={handlePrint}>
              🖨️ 打印
            </button>
          </div>
        </div>

        <div className="print-area" id="report-print-area">
          <div className="print-header">
            <h2>古籍修复项目报告</h2>
            <div className="print-header-info">
              <span>报告编号：{previewData.id}</span>
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
                  <th>交付日期</th>
                  <td>{formatDate(previewData.deliveryDate)}</td>
                  <th>报告生成日期</th>
                  <td>{formatDate(previewData.createdAt)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="print-section">
            <h4>二、损伤类型</h4>
            <div className="print-damage-tags">
              {previewData.damageTypes.map((type) => (
                <span key={type} className="print-damage-tag">{type}</span>
              ))}
            </div>
          </div>

          <div className="print-section">
            <h4>三、评估结论</h4>
            <div className="assessment-conclusion-print">
              {previewData.assessmentConclusion}
            </div>
          </div>

          <div className="print-section">
            <h4>四、修复步骤完成情况</h4>
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
            <h4>五、材料消耗记录</h4>
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
            <h4>六、修复前中后影像记录</h4>
            {previewData.imagesSummary.length > 0 ? (
              <>
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

                <div className="print-images-container">
                  {Array.from(getImagesByStage(previewData.imageRecords).entries()).map(([stage, images]) => (
                    images.length > 0 && (
                      <div key={stage} className="print-image-stage">
                        <h5 className="print-image-stage-title">
                          {STAGE_LABELS[stage]}
                        </h5>
                        <div className="print-image-grid">
                          {images.map((image, imgIndex) => {
                            const src = getImageSrc(image);
                            return (
                              <div key={image.id} className="print-image-item">
                                {src ? (
                                  <img
                                    src={src}
                                    alt={image.description || image.fileName}
                                    className="print-image"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="print-image-placeholder">
                                    <span className="print-image-placeholder-text">无图像数据</span>
                                    <span className="print-image-filename">{image.fileName}</span>
                                  </div>
                                )}
                                <div className="print-image-caption">
                                  {imgIndex + 1}. {image.description || image.fileName}
                                  <span className="print-image-date">（{formatDate(image.photoDate)}）</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </>
            ) : (
              <p className="empty-text print-empty">暂无影像记录</p>
            )}
          </div>

          {previewData.reportNotes && (
            <div className="print-section">
              <h4>七、备注说明</h4>
              <div className="report-notes-print">
                {previewData.reportNotes}
              </div>
            </div>
          )}

          <div className="print-signatures">
            <div className="signature-block">
              <span>修复师签字：</span>
              <span className="signature-line"></span>
            </div>
            <div className="signature-block">
              <span>审核人签字：</span>
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
      className={`modal-overlay report-print-overlay ${viewMode === 'preview' ? 'report-print-mode' : ''}`}
      onClick={onClose}
    >
      <div 
        className={`modal-content detail-modal large-modal report-modal ${viewMode === 'preview' ? 'preview-modal' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header no-print">
          <div className="header-left">
            <h2>📋 《{project.bookTitle}》- 修复报告</h2>
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
