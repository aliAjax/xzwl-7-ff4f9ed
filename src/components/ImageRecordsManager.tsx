import { useState, useRef } from 'react';
import type { ImageRecord, RestorationStage, RestorationProject } from '../types';
import { STAGE_LABELS, STAGE_ORDER } from '../types';
import { compressImage, formatFileSize } from '../utils/imageCompressor';
import { generateImageRecordId } from '../utils/storage';

interface ImageRecordsManagerProps {
  project: RestorationProject;
  onUpdateRecords: (records: ImageRecord[]) => { success: boolean; error?: string };
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

  return (
    <div className="image-records-section">
      <div className="section-header">
        <h3>修复影像档案</h3>
        <div className="section-stats">
          <span className="records-count">共 {records.length} 张</span>
          <span className="total-size">占用 {formatFileSize(totalSize)}</span>
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
    </div>
  );
}
