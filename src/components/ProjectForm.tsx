import { useState, useEffect } from 'react';
import type { RestorationProject, DamageType, Priority, ProjectStatus, MaterialUsage, RestorationStep } from '../types';
import { DAMAGE_TYPE_OPTIONS, PRIORITY_LABELS, STATUS_LABELS } from '../types';
import { getTemplates } from '../utils/storage';
import { generateId } from '../utils/storage';

interface ProjectFormProps {
  project: RestorationProject | null;
  onSave: (project: Omit<RestorationProject, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
}

export default function ProjectForm({ project, onSave, onClose }: ProjectFormProps) {
  const isEditing = !!project;

  const defaultDeliveryDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    bookTitle: '',
    volumeCount: 1,
    damageTypes: [] as DamageType[],
    status: 'pending' as ProjectStatus,
    priority: 'medium' as Priority,
    deliveryDate: defaultDeliveryDate(),
    description: '',
    notes: '',
    restorationSteps: [] as RestorationStep[],
    materialsUsed: [] as MaterialUsage[],
    currentProgress: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (project) {
      setFormData({
        bookTitle: project.bookTitle,
        volumeCount: project.volumeCount,
        damageTypes: [...project.damageTypes],
        status: project.status,
        priority: project.priority,
        deliveryDate: project.deliveryDate,
        description: project.description,
        notes: project.notes || '',
        restorationSteps: [...project.restorationSteps],
        materialsUsed: [...project.materialsUsed],
        currentProgress: project.currentProgress,
      });
    }
  }, [project]);

  const handleDamageTypeToggle = (type: DamageType) => {
    setFormData(prev => ({
      ...prev,
      damageTypes: prev.damageTypes.includes(type)
        ? prev.damageTypes.filter(t => t !== type)
        : [...prev.damageTypes, type]
    }));
  };

  const handleAddStep = () => {
    const newStep: RestorationStep = {
      id: generateId(),
      name: '',
      description: '',
      completed: false,
      estimatedDuration: 2,
    };
    setFormData(prev => ({
      ...prev,
      restorationSteps: [...prev.restorationSteps, newStep]
    }));
  };

  const handleRemoveStep = (stepId: string) => {
    setFormData(prev => ({
      ...prev,
      restorationSteps: prev.restorationSteps.filter(s => s.id !== stepId)
    }));
  };

  const handleUpdateStep = (stepId: string, field: keyof RestorationStep, value: any) => {
    setFormData(prev => ({
      ...prev,
      restorationSteps: prev.restorationSteps.map(s =>
        s.id === stepId ? { ...s, [field]: value } : s
      )
    }));
  };

  const handleAddMaterial = () => {
    const newMaterial: MaterialUsage = {
      id: generateId(),
      name: '',
      quantity: '',
      unit: '张',
      notes: '',
    };
    setFormData(prev => ({
      ...prev,
      materialsUsed: [...prev.materialsUsed, newMaterial]
    }));
  };

  const handleRemoveMaterial = (materialId: string) => {
    setFormData(prev => ({
      ...prev,
      materialsUsed: prev.materialsUsed.filter(m => m.id !== materialId)
    }));
  };

  const handleUpdateMaterial = (materialId: string, field: keyof MaterialUsage, value: any) => {
    setFormData(prev => ({
      ...prev,
      materialsUsed: prev.materialsUsed.map(m =>
        m.id === materialId ? { ...m, [field]: value } : m
      )
    }));
  };

  const applyTemplate = (templateId: string) => {
    const templates = getTemplates();
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const newSteps: RestorationStep[] = template.steps.map((stepName) => ({
      id: generateId(),
      name: stepName,
      description: '',
      completed: false,
      estimatedDuration: 2,
    }));

    setFormData(prev => ({
      ...prev,
      restorationSteps: newSteps
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.bookTitle.trim()) {
      newErrors.bookTitle = '请输入书名';
    }
    if (formData.volumeCount < 1) {
      newErrors.volumeCount = '册数必须大于0';
    }
    if (formData.damageTypes.length === 0) {
      newErrors.damageTypes = '请至少选择一种破损类型';
    }
    if (!formData.deliveryDate) {
      newErrors.deliveryDate = '请选择交付日期';
    }

    formData.restorationSteps.forEach((step, index) => {
      if (!step.name.trim()) {
        newErrors[`step-${index}`] = `第 ${index + 1} 步请输入步骤名称`;
      }
    });

    formData.materialsUsed.forEach((material, index) => {
      if (!material.name.trim()) {
        newErrors[`material-${index}`] = `第 ${index + 1} 项请输入材料名称`;
      }
      if (!material.quantity || parseFloat(material.quantity) <= 0) {
        newErrors[`material-qty-${index}`] = `第 ${index + 1} 项请输入有效数量`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const completedSteps = formData.restorationSteps.filter(s => s.completed).length;
    const totalSteps = formData.restorationSteps.length;
    const currentProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    onSave({
      ...formData,
      currentProgress,
    });
  };

  const templates = getTemplates();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-left">
            <h2>{isEditing ? '编辑项目' : '新建修复项目'}</h2>
          </div>
          <button className="btn btn-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body form-body">
            <div className="form-section">
              <h3 className="form-section-title">基本信息</h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="bookTitle">书名 <span className="required">*</span></label>
                  <input
                    type="text"
                    id="bookTitle"
                    value={formData.bookTitle}
                    onChange={(e) => setFormData(prev => ({ ...prev, bookTitle: e.target.value }))}
                    placeholder="例如：《永乐大典》"
                    className={errors.bookTitle ? 'error' : ''}
                  />
                  {errors.bookTitle && <span className="error-text">{errors.bookTitle}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="volumeCount">册数 <span className="required">*</span></label>
                  <input
                    type="number"
                    id="volumeCount"
                    min="1"
                    value={formData.volumeCount}
                    onChange={(e) => setFormData(prev => ({ ...prev, volumeCount: parseInt(e.target.value) || 1 }))}
                    className={errors.volumeCount ? 'error' : ''}
                  />
                  {errors.volumeCount && <span className="error-text">{errors.volumeCount}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="status">状态</label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as ProjectStatus }))}
                  >
                    <option value="pending">{STATUS_LABELS.pending}</option>
                    <option value="restoring">{STATUS_LABELS.restoring}</option>
                    <option value="drying">{STATUS_LABELS.drying}</option>
                    <option value="binding">{STATUS_LABELS.binding}</option>
                    <option value="delivered">{STATUS_LABELS.delivered}</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="priority">优先级</label>
                  <select
                    id="priority"
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as Priority }))}
                  >
                    <option value="high">{PRIORITY_LABELS.high}</option>
                    <option value="medium">{PRIORITY_LABELS.medium}</option>
                    <option value="low">{PRIORITY_LABELS.low}</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="deliveryDate">交付日期 <span className="required">*</span></label>
                  <input
                    type="date"
                    id="deliveryDate"
                    value={formData.deliveryDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, deliveryDate: e.target.value }))}
                    className={errors.deliveryDate ? 'error' : ''}
                  />
                  {errors.deliveryDate && <span className="error-text">{errors.deliveryDate}</span>}
                </div>
              </div>

              <div className="form-group">
                <label>破损类型 <span className="required">*</span></label>
                <div className="damage-types-grid">
                  {DAMAGE_TYPE_OPTIONS.map(type => (
                    <button
                      key={type}
                      type="button"
                      className={`damage-type-tag ${formData.damageTypes.includes(type) ? 'active' : ''}`}
                      onClick={() => handleDamageTypeToggle(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {errors.damageTypes && <span className="error-text">{errors.damageTypes}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="description">项目描述</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="描述古籍的情况、修复要求等..."
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label htmlFor="notes">备注</label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="其他需要记录的信息..."
                  rows={2}
                />
              </div>
            </div>

            <div className="form-section">
              <div className="section-header-with-action">
                <h3 className="form-section-title">修复步骤</h3>
                <div className="section-actions">
                  <select
                    className="template-select"
                    onChange={(e) => {
                      if (e.target.value) {
                        applyTemplate(e.target.value);
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="">应用模板...</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-secondary btn-small" onClick={handleAddStep}>
                    + 添加步骤
                  </button>
                </div>
              </div>

              <div className="steps-editor">
                {formData.restorationSteps.map((step, index) => (
                  <div key={step.id} className="step-editor-item">
                    <div className="step-editor-header">
                      <span className="step-editor-number">{index + 1}</span>
                      <input
                        type="text"
                        value={step.name}
                        onChange={(e) => handleUpdateStep(step.id, 'name', e.target.value)}
                        placeholder="步骤名称"
                        className={errors[`step-${index}`] ? 'error' : ''}
                      />
                      <input
                        type="number"
                        value={step.estimatedDuration}
                        onChange={(e) => handleUpdateStep(step.id, 'estimatedDuration', parseInt(e.target.value) || 0)}
                        min="0"
                        className="step-duration-input"
                        placeholder="预计天数"
                      />
                      <button
                        type="button"
                        className="btn-icon btn-danger"
                        onClick={() => handleRemoveStep(step.id)}
                      >
                        ×
                      </button>
                    </div>
                    <input
                      type="text"
                      value={step.description}
                      onChange={(e) => handleUpdateStep(step.id, 'description', e.target.value)}
                      placeholder="步骤描述（可选）"
                      className="step-description-input"
                    />
                    {errors[`step-${index}`] && <span className="error-text">{errors[`step-${index}`]}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="form-section">
              <div className="section-header-with-action">
                <h3 className="form-section-title">材料使用</h3>
                <button type="button" className="btn btn-secondary btn-small" onClick={handleAddMaterial}>
                  + 添加材料
                </button>
              </div>

              <div className="materials-editor">
                {formData.materialsUsed.map((material, index) => (
                  <div key={material.id} className="material-editor-row">
                    <input
                      type="text"
                      value={material.name}
                      onChange={(e) => handleUpdateMaterial(material.id, 'name', e.target.value)}
                      placeholder="材料名称"
                      className={errors[`material-${index}`] ? 'error' : ''}
                    />
                    <input
                      type="number"
                      value={material.quantity}
                      onChange={(e) => handleUpdateMaterial(material.id, 'quantity', e.target.value)}
                      placeholder="数量"
                      min="0"
                      step="0.01"
                      className={errors[`material-qty-${index}`] ? 'error' : ''}
                    />
                    <input
                      type="text"
                      value={material.unit}
                      onChange={(e) => handleUpdateMaterial(material.id, 'unit', e.target.value)}
                      placeholder="单位"
                      className="unit-input"
                    />
                    <input
                      type="text"
                      value={material.notes || ''}
                      onChange={(e) => handleUpdateMaterial(material.id, 'notes', e.target.value)}
                      placeholder="备注（可选）"
                      className="notes-input"
                    />
                    <button
                      type="button"
                      className="btn-icon btn-danger"
                      onClick={() => handleRemoveMaterial(material.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {formData.materialsUsed.length === 0 && (
                <p className="empty-text">暂无材料记录，点击上方按钮添加</p>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary">
              {isEditing ? '保存修改' : '创建项目'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
