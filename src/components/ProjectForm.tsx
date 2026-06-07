import { useState, useEffect } from 'react';
import type { RestorationProject, ProjectStatus, RestorationStep, MaterialUsage, RestorationTemplate, ImageRecord } from '../types';
import { DAMAGE_TYPES, DEFAULT_RESTORATION_STEPS, STATUS_LABELS } from '../types';
import { getTemplates, getDefaultTemplate } from '../utils/storage';

interface ProjectFormProps {
  project?: RestorationProject;
  onClose: () => void;
  onSave: (project: Omit<RestorationProject, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export default function ProjectForm({ project, onClose, onSave }: ProjectFormProps) {
  const isEditing = !!project;

  const [bookTitle, setBookTitle] = useState('');
  const [volumeCount, setVolumeCount] = useState(1);
  const [damageTypes, setDamageTypes] = useState<string[]>([]);
  const [status, setStatus] = useState<ProjectStatus>('pending-evaluation');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [restorationSteps, setRestorationSteps] = useState<RestorationStep[]>([]);
  const [materialsUsed, setMaterialsUsed] = useState<MaterialUsage[]>([]);
  const [imageRecords, setImageRecords] = useState<ImageRecord[]>([]);
  const [newMaterial, setNewMaterial] = useState({ name: '', quantity: '', unit: '' });
  const [templates, setTemplates] = useState<RestorationTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  useEffect(() => {
    setTemplates(getTemplates());
  }, []);

  useEffect(() => {
    if (project) {
      setBookTitle(project.bookTitle);
      setVolumeCount(project.volumeCount);
      setDamageTypes(project.damageTypes);
      setStatus(project.status);
      setDeliveryDate(project.deliveryDate);
      setNotes(project.notes || '');
      setRestorationSteps(project.restorationSteps);
      setMaterialsUsed(project.materialsUsed);
      setImageRecords(project.imageRecords || []);
    } else {
      const today = new Date();
      const defaultDate = new Date(today.setDate(today.getDate() + 30));
      setDeliveryDate(defaultDate.toISOString().split('T')[0]);

      const defaultTemplate = getDefaultTemplate();
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
        setRestorationSteps(
          defaultTemplate.steps.map(name => ({
            name,
            completed: false,
          }))
        );
      } else {
        setRestorationSteps(
          DEFAULT_RESTORATION_STEPS.map(name => ({
            name,
            completed: false,
          }))
        );
      }
    }
  }, [project]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setRestorationSteps(
          template.steps.map(name => ({
            name,
            completed: false,
          }))
        );
      }
    } else {
      setRestorationSteps(
        DEFAULT_RESTORATION_STEPS.map(name => ({
          name,
          completed: false,
        }))
      );
    }
  };

  const handleDamageTypeToggle = (type: string) => {
    if (damageTypes.includes(type)) {
      setDamageTypes(damageTypes.filter(t => t !== type));
    } else {
      setDamageTypes([...damageTypes, type]);
    }
  };

  const handleStepToggle = (index: number) => {
    const newSteps = [...restorationSteps];
    newSteps[index] = {
      ...newSteps[index],
      completed: !newSteps[index].completed,
      date: !newSteps[index].completed ? new Date().toISOString().split('T')[0] : undefined,
    };
    setRestorationSteps(newSteps);
  };

  const handleAddMaterial = () => {
    if (newMaterial.name && newMaterial.quantity) {
      setMaterialsUsed([...materialsUsed, { ...newMaterial }]);
      setNewMaterial({ name: '', quantity: '', unit: '' });
    }
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterialsUsed(materialsUsed.filter((_, i) => i !== index));
  };

  const calculateProgress = () => {
    if (restorationSteps.length === 0) return 0;
    const completed = restorationSteps.filter(s => s.completed).length;
    return Math.round((completed / restorationSteps.length) * 100);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookTitle.trim()) return;

    onSave({
      bookTitle: bookTitle.trim(),
      volumeCount,
      damageTypes,
      status,
      deliveryDate,
      notes: notes.trim() || undefined,
      restorationSteps,
      materialsUsed,
      imageRecords,
      currentProgress: calculateProgress(),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? '编辑修复项目' : '新建修复项目'}</h2>
          <button className="btn btn-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body form-body">
          <div className="form-row">
            <div className="form-group">
              <label>书名 *</label>
              <input
                type="text"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                placeholder="请输入书名"
                required
              />
            </div>
            <div className="form-group">
              <label>册数</label>
              <input
                type="number"
                min="1"
                value={volumeCount}
                onChange={(e) => setVolumeCount(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>当前状态</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>预计交付日期</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
          </div>

          {!isEditing && (
            <div className="form-group">
              <label>修复流程模板</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
              >
                <option value="">-- 不使用模板（默认步骤）--</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.isDefault ? '（默认）' : ''}
                  </option>
                ))}
              </select>
              <p className="form-hint">
                选择模板后将自动填充对应的修复步骤，您仍可手动调整
              </p>
            </div>
          )}

          <div className="form-group">
            <label>破损类型</label>
            <div className="damage-type-options">
              {DAMAGE_TYPES.map(type => (
                <label
                  key={type}
                  className={`damage-option ${damageTypes.includes(type) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={damageTypes.includes(type)}
                    onChange={() => handleDamageTypeToggle(type)}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>修复步骤</label>
            <div className="steps-editor">
              {restorationSteps.map((step, index) => (
                <div
                  key={index}
                  className={`step-item ${step.completed ? 'completed' : ''}`}
                  onClick={() => handleStepToggle(index)}
                >
                  <div className="step-checkbox">
                    <input
                      type="checkbox"
                      checked={step.completed}
                      onChange={() => {}}
                    />
                  </div>
                  <span className="step-name">{step.name}</span>
                  {step.date && <span className="step-date">完成于 {step.date}</span>}
                </div>
              ))}
            </div>
            <p className="form-hint">点击步骤可标记完成/未完成</p>
          </div>

          <div className="form-group">
            <label>材料使用</label>
            <div className="materials-editor">
              {materialsUsed.map((material, index) => (
                <div key={index} className="material-item">
                  <span>{material.name}</span>
                  <span>{material.quantity} {material.unit}</span>
                  <button
                    type="button"
                    className="btn-remove-material"
                    onClick={() => handleRemoveMaterial(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="add-material-row">
                <input
                  type="text"
                  placeholder="材料名称"
                  value={newMaterial.name}
                  onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="数量"
                  className="quantity-input"
                  value={newMaterial.quantity}
                  onChange={(e) => setNewMaterial({ ...newMaterial, quantity: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="单位"
                  className="unit-input"
                  value={newMaterial.unit}
                  onChange={(e) => setNewMaterial({ ...newMaterial, unit: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleAddMaterial}
                >
                  添加
                </button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>备注</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="记录修复注意事项、版本信息等..."
              rows={3}
            />
          </div>

          <div className="form-actions">
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
