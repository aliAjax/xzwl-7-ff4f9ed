import { useState, useRef, useMemo } from 'react';
import type { ImageRecord, RestorationStage, RestorationProject } from '../types';
import { STAGE_LABELS, STAGE_ORDER } from '../types';
import { compressImage, formatFileSize } from '../utils/imageCompressor';
import { generateImageRecordId } from '../utils/storage';

interface ImageRecordsManagerProps {
  project: RestorationProject;
  onUpdateRecords: (records: ImageRecord[]) => { success: boolean; error?: string };
}

interface ImageListRow {
  projectNumber: string;
  bookTitle: string;
  stage: string;
  photoDate: string;
  fileName: string;
  description: string;
  fileSize: string;
  fileSizeBytes: number;
}

export default function ImageRecordsManager({ project, onUpdateRecords }: ImageRecordsManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedStage, setSelectedStage] = useState<RestorationStage>('before');
  const [photoDate, setPhotoDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<ImageRecord | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const records = project.imageRecords || [];
  const groupedRecords = STAGE_ORDER.reduce((acc, stage) => {
    acc[stage] = records.filter(r => r.stage === stage);
    return acc;
  }, {} as Record<RestorationStage, ImageRecord[]>);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreviewImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddRecord = async () => {
    if (!selectedFile) {
      setErrorMessage('请选择一张图片');
      return;
    }
    if (!photoDate) {
      setErrorMessage('请选择拍摄日期');
      return;
    }

    setIsCompressing(true);
    setCompressProgress('正在压缩图片...');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await compressImage(selectedFile, {
        maxWidth: 800,
        maxHeight: 600,
        quality: 0.7,
        maxSizeKB: 100,
      });

      if (!result.success || !result.imageData) {
        setErrorMessage(result.error || '图片压缩失败');
        setIsCompressing(false);
        return;
      }

      setCompressProgress(`压缩完成，大小：${formatFileSize(result.fileSize)}`);

      const newRecord: ImageRecord = {
        id: generateImageRecordId(),
        stage: selectedStage,
        photoDate,
        description: description.trim(),
        imageData: result.imageData,
        projectId: project.id,
        fileName: selectedFile.name,
        fileType: selectedFile.type,        fileSize: result.fileSize,
        createdAt: new Date().toISOString().split('T')[0],
      };

      const newRecords = [...records, newRecord];
      const saveResult = onUpdateRecords(newRecords);

      if (!saveResult.success) {
        setErrorMessage(saveResult.error || '保存失败');
        setIsCompressing(false);
        return;
      }

      setSuccessMessage('影像记录添加成功！');
      setShowAddForm(false);
      setSelectedFile(null);
      setPreviewImage(null);
      setDescription('');
      setPhotoDate(new Date().toISOString().split('T')[0]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      setErrorMessage('添加记录时发生错误');
      console.error(e);
    } finally {
      setIsCompressing(false);
      setCompressProgress('');
    }
  };

  const handleDeleteRecord = (recordId: string) => {
    const record = records.find(r => r.id === recordId);
    if (!record) return;

    if (!window.confirm(`确定要删除这条${STAGE_LABELS[record.stage]}的影像记录吗？`)) {
      return;
    }

    const newRecords = records.filter(r => r.id !== recordId);
    const result = onUpdateRecords(newRecords);

    if (!result.success) {
      setErrorMessage(result.error || '删除失败');
    } else {
      setSuccessMessage('记录已删除');
      setTimeout(() => setSuccessMessage(null), 2000);
    }
  };

  const cancelAdd = () => {
    setShowAddForm(false);
    setSelectedFile(null);
    setPreviewImage(null);
    setDescription('');
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const totalSize = records.reduce((sum, r) => sum + r.fileSize, 0);

  const imageListData = useMemo((): ImageListRow[] => {
    return records.map(record => ({
      projectNumber: project.id,
      bookTitle: project.bookTitle,
      stage: STAGE_LABELS[record.stage],
      photoDate: record.photoDate,
      fileName: record.fileName,
      description: record.description || '-',
      fileSize: formatFileSize(record.fileSize),
      fileSizeBytes: record.fileSize,
    }));
  }, [records, project.id, project.bookTitle]);

  const generateCSV = (data: ImageListRow[]): string => {
    const headers = ['项目编号', '书名', '阶段', '拍摄日期', '文件名', '描述', '文件大小'];
    const escapeCSV = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };
    const rows = data.map(row => [
      escapeCSV(row.projectNumber),
      escapeCSV(row.bookTitle),
      escapeCSV(row.stage),
      escapeCSV(row.photoDate),
      escapeCSV(row.fileName),
      escapeCSV(row.description),
      escapeCSV(row.fileSize),
    ]);
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const generateText = (data: ImageListRow[]): string => {
    const headers = ['项目编号', '书名', '阶段', '拍摄日期', '文件名', '描述', '文件大小'];
    const colWidths = headers.map((h, i) => 
      Math.max(h.length, ...data.map(row => row[Object.keys(row)[i] as keyof ImageListRow].toString().length))
    );
    const pad = (text: string, width: number) => text.padEnd(width, ' ');
    const separator = colWidths.map(w => '-'.repeat(w)).join(' | ');
    
    const lines: string[] = [];
    lines.push(`影像清单 - ${project.bookTitle} (${project.id})`);
    lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push(`共 ${data.length} 张图片，总大小: ${formatFileSize(totalSize)}`);
    lines.push('');
    lines.push(headers.map((h, i) => pad(h, colWidths[i])).join(' | '));
    lines.push(separator);
    data.forEach(row => {
      lines.push([
        pad(row.projectNumber, colWidths[0]),
        pad(row.bookTitle, colWidths[1]),
        pad(row.stage, colWidths[2]),
        pad(row.photoDate, colWidths[3]),
        pad(row.fileName, colWidths[4]),
        pad(row.description, colWidths[5]),
        pad(row.fileSize, colWidths[6]),
      ].join(' | '));
    });
    return lines.join('\n');
  };

  const handleCopyToClipboard = async () => {
    if (imageListData.length === 0) {
      setErrorMessage('暂无影像记录，无法复制');
      return;
    }
    try {
      const text = generateText(imageListData);
      await navigator.clipboard.writeText(text);
      setSuccessMessage('影像清单已复制到剪贴板');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setErrorMessage('复制失败，请手动复制');
    }
  };

  const handleDownloadCSV = () => {
    if (imageListData.length === 0) {
      setErrorMessage('暂无影像记录，无法下载');
      return;
    }
    const csv = generateCSV(imageListData);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `影像清单_${project.bookTitle}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSuccessMessage('CSV 下载已开始');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <div className="image-records-section">
      <div className="section-header">
        <h3>修复影像档案</h3>
        <div className="section-stats">
          <span className="records-count">共 {records.length} 张</span>
          <span className="total-size">占用 {formatFileSize(totalSize)}</span>
        </div>
        <div className="section-actions">
          <button
            className="btn btn-secondary btn-small"
            onClick={() => setShowExportDialog(true)}
          >
            📋 导出影像清单
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="alert alert-error">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          {successMessage}
        </div>
      )}

      {!showAddForm ? (
        <button className="btn btn-primary btn-add-image" onClick={() => setShowAddForm(true)}>
          + 添加影像记录
        </button>
      ) : (
        <div className="add-image-form">
          <div className="form-row">
            <div className="form-group">
              <label>修复阶段</label>
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value as RestorationStage)}
                disabled={isCompressing}
              >
                {STAGE_ORDER.map(stage => (
                  <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>拍摄日期</label>
              <input
                type="date"
                value={photoDate}
                onChange={(e) => setPhotoDate(e.target.value)}
                disabled={isCompressing}
              />
            </div>
          </div>

          <div className="form-group">
            <label>说明</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="记录拍摄内容、修复部位等信息..."
              rows={2}
              disabled={isCompressing}
            />
          </div>

          <div className="form-group">
            <label>选择图片</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isCompressing}
              className="file-input"
            />
            <p className="form-hint">
              图片将自动压缩至最大 100KB，建议上传清晰的修复部位照片
            </p>
          </div>

          {previewImage && (
            <div className="image-preview">
              <img src={previewImage} alt="预览" />
            </div>
          )}

          {compressProgress && (
            <div className="compress-progress">
              <span className="loading-spinner"></span>
              {compressProgress}
            </div>
          )}

          <div className="form-actions-inline">
            <button
              className="btn btn-primary"
              onClick={handleAddRecord}
              disabled={isCompressing || !selectedFile}
            >
              {isCompressing ? '处理中...' : '保存记录'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={cancelAdd}
              disabled={isCompressing}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {STAGE_ORDER.map(stage => (
        groupedRecords[stage].length > 0 && (
          <div key={stage} className="stage-group">
            <h4 className="stage-title">
              {STAGE_LABELS[stage]}
              <span className="stage-count">({groupedRecords[stage].length}张)</span>
            </h4>
            <div className="image-grid">
              {groupedRecords[stage].map(record => (
                <div key={record.id} className="image-card">
                  <div
                    className="image-thumbnail"
                    onClick={() => setViewingImage(record)}
                  >
                    <img src={record.imageData} alt={record.description || STAGE_LABELS[stage]} />
                  </div>
                  <div className="image-info">
                    <div className="image-date">{record.photoDate}</div>
                    {record.description && (
                      <div className="image-desc">{record.description}</div>
                    )}
                    <div className="image-meta">
                      <span className="image-size">{formatFileSize(record.fileSize)}</span>
                      <button
                        className="btn-icon btn-danger btn-delete-image"
                        onClick={() => handleDeleteRecord(record.id)}
                        title="删除"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ))}

      {records.length === 0 && !showAddForm && (
        <div className="empty-records">
          <p>暂无影像记录</p>
          <p className="empty-subtitle">点击上方按钮添加修复前、修复中、修复后的照片</p>
        </div>
      )}

      {viewingImage && (
        <div className="image-viewer-overlay" onClick={() => setViewingImage(null)}>
          <div className="image-viewer-content" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close viewer-close" onClick={() => setViewingImage(null)}>
              ×
            </button>
            <div className="viewer-image">
              <img src={viewingImage.imageData} alt={viewingImage.description || STAGE_LABELS[viewingImage.stage]} />
            </div>
            <div className="viewer-info">
              <div className="viewer-header">
                <span className={`status-badge stage-${viewingImage.stage}`}>
                  {STAGE_LABELS[viewingImage.stage]}
                </span>
                <span className="viewer-date">拍摄于 {viewingImage.photoDate}</span>
              </div>
              {viewingImage.description && (
                <p className="viewer-desc">{viewingImage.description}</p>
              )}
              <div className="viewer-meta">
                <span>大小：{formatFileSize(viewingImage.fileSize)}</span>
                <span>上传于 {viewingImage.createdAt}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExportDialog && (
        <div className="modal-overlay" onClick={() => setShowExportDialog(false)}>
          <div className="modal-content detail-modal large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-left">
                <h2>影像清单导出</h2>
                <span className="project-info-badge">
                  {project.bookTitle} ({project.id})
                </span>
              </div>
              <div className="header-actions">
                <button className="btn btn-close" onClick={() => setShowExportDialog(false)}>×</button>
              </div>
            </div>

            <div className="modal-body">
              {errorMessage && (
                <div className={`message-banner ${errorMessage}`}>
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className={`message-banner ${successMessage}`}>
                  {successMessage}
                </div>
              )}

              {imageListData.length > 0 ? (
                <>
                  <div className="export-summary">
                    <div className="summary-item">
                      <span className="summary-label">影像总数：</span>
                      <span className="summary-value">{imageListData.length} 张</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">总大小：</span>
                      <span className="summary-value">{formatFileSize(totalSize)}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">修复前：</span>
                      <span className="summary-value">{groupedRecords.before.length} 张</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">修复中：</span>
                      <span className="summary-value">{groupedRecords.during.length} 张</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">修复后：</span>
                      <span className="summary-value">{groupedRecords.after.length} 张</span>
                    </div>
                  </div>

                  <div className="export-actions">
                    <button className="btn btn-primary" onClick={handleCopyToClipboard}>
                      📋 复制为文本
                    </button>
                    <button className="btn btn-secondary" onClick={handleDownloadCSV}>
                      ⬇️ 下载 CSV
                    </button>
                  </div>

                  <div className="export-preview-section">
                    <h4>清单预览</h4>
                    <div className="table-container">
                      <table className="materials-table compact">
                        <thead>
                          <tr>
                            <th>项目编号</th>
                            <th>书名</th>
                            <th>阶段</th>
                            <th>拍摄日期</th>
                            <th>文件名</th>
                            <th>描述</th>
                            <th>文件大小</th>
                          </tr>
                        </thead>
                        <tbody>
                          {imageListData.map((row, index) => (
                            <tr key={index}>
                              <td>{row.projectNumber}</td>
                              <td>{row.bookTitle}</td>
                              <td>
                                <span className={`status-badge stage-${records[index]?.stage}`}>
                                  {row.stage}
                                </span>
                              </td>
                              <td>{row.photoDate}</td>
                              <td className="filename-cell">{row.fileName}</td>
                              <td className="description-cell">{row.description}</td>
                              <td>{row.fileSize}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-export-state">
                  <div className="empty-icon">📷</div>
                  <h3>暂无影像记录</h3>
                  <p>该项目还没有上传任何修复前、修复中或修复后的影像记录。</p>
                  <p className="empty-hint">请先添加影像记录后再导出清单。</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setShowExportDialog(false);
                      setShowAddForm(true);
                    }}
                  >
                    + 添加影像记录
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
