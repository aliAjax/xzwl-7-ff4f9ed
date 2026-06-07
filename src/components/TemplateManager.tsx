import { useState, useEffect } from 'react';
import type { RestorationTemplate } from '../types';
import { getTemplates, saveTemplates, generateTemplateId } from '../utils/storage';

interface TemplateManagerProps {
  onClose: () => void;
}

export default function TemplateManager({ onClose }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<RestorationTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<RestorationTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSteps, setFormSteps] = useState<string[]>([]);
  const [newStepName, setNewStepName] = useState('');

  useEffect(() => {
    setTemplates(getTemplates());
  }, []);

  useEffect(() => {
    if (templates.length > 0) {
      saveTemplates(templates);
    }
  }, [templates]);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormSteps([]);
    setNewStepName('');
    setEditingTemplate(null);
    setIsCreating(false);
  };

  const handleCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const handleEdit = (template: RestorationTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormDescription(template.description);
    setFormSteps([...template.steps]);
    setIsCreating(false);
  };

  const handleCancel = () => {
    resetForm();
  };

  const handleSave = () => {
    if (!formName.trim() || formSteps.length === 0) return;

    const now = new Date().toISOString().split('T')[0];

    if (isCreating) {
      const newTemplate: RestorationTemplate = {
        id: generateTemplateId(),
        name: formName.trim(),
        description: formDescription.trim(),
        steps: [...formSteps],
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      };
      setTemplates([...templates, newTemplate]);
    } else if (editingTemplate) {
      setTemplates(templates.map(t =>
        t.id === editingTemplate.id
          ? { ...t, name: formName.trim(), description: formDescription.trim(), steps: [...formSteps], updatedAt: now }
          : t
      ));
    }

    resetForm();
  };

  const handleDelete = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    if (template.isDefault) {
      alert('默认模板不能删除，请先设置其他模板为默认。');
      return;
    }

    if (window.confirm(`确定要删除模板"${template.name}"吗？`)) {
      setTemplates(templates.filter(t => t.id !== templateId));
    }
  };

  const handleSetDefault = (templateId: string) => {
    setTemplates(templates.map(t => ({
      ...t,
      isDefault: t.id === templateId,
    })));
  };

  const handleAddStep = () => {
    if (newStepName.trim()) {
      setFormSteps([...formSteps, newStepName.trim()]);
      setNewStepName('');
    }
  };

  const handleRemoveStep = (index: number) => {
    setFormSteps(formSteps.filter((_, i) => i !== index));
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...formSteps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;

    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setFormSteps(newSteps);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddStep();
    }
  };

  const showForm = isCreating || editingTemplate;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content template-manager-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>修复流程模板管理</h2>
          <button className="btn btn-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {!showForm && (
            <>
              <div className="template-actions-bar">
                <button className="btn btn-primary" onClick={handleCreate}>
                  + 新增模板
                </button>
              </div>

              <div className="template-list">
                {templates.map(template => (
                  <div key={template.id} className={`template-card ${template.isDefault ? 'is-default' : ''}`}>
                    <div className="template-card-header">
                      <div className="template-title-section">
                        <h3 className="template-name">
                          {template.name}
                          {template.isDefault && <span className="default-badge">默认</span>}
                        </h3>
                        <p className="template-description">{template.description}</p>
                      </div>
                      <div className="template-actions">
                        {!template.isDefault && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleSetDefault(template.id)}
                          >
                            设为默认
                          </button>
                        )}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleEdit(template)}
                        >
                          编辑
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(template.id)}
                          disabled={template.isDefault}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    <div className="template-steps-preview">
                      <span className="steps-count">共 {template.steps.length} 个步骤：</span>
                      <div className="steps-tags">
                        {template.steps.map((step, idx) => (
                          <span key={idx} className="step-tag">{idx + 1}. {step}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {showForm && (
            <div className="template-form">
              <h3>{isCreating ? '新增模板' : '编辑模板'}</h3>

              <div className="form-group">
                <label>模板名称 *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例如：普通线装书"
                />
              </div>

              <div className="form-group">
                <label>模板描述</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="描述该模板适用的古籍类型"
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label>修复步骤 *</label>
                <div className="steps-editor">
                  {formSteps.map((step, index) => (
                    <div key={index} className="step-editor-item">
                      <span className="step-order">{index + 1}.</span>
                      <span className="step-name">{step}</span>
                      <div className="step-edit-actions">
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => handleMoveStep(index, 'up')}
                          disabled={index === 0}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => handleMoveStep(index, 'down')}
                          disabled={index === formSteps.length - 1}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn-icon btn-danger"
                          onClick={() => handleRemoveStep(index)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="add-step-row">
                  <input
                    type="text"
                    value={newStepName}
                    onChange={(e) => setNewStepName(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="输入步骤名称，按回车添加"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleAddStep}
                    disabled={!newStepName.trim()}
                  >
                    添加步骤
                  </button>
                </div>
                <p className="form-hint">至少需要一个步骤</p>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  取消
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={!formName.trim() || formSteps.length === 0}
                >
                  保存
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
