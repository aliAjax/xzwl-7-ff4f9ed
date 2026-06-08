import { useState, useEffect, useMemo } from 'react';
import type { RestorationProject, RestorationAssessment, PaperCondition, DamageSeverity, PollutionType, BindingCondition, RestorationTemplate } from '../types';
import {
  PAPER_CONDITION_LABELS,
  DAMAGE_SEVERITY_LABELS,
  POLLUTION_TYPE_LABELS,
  BINDING_CONDITION_LABELS,
  DAMAGE_TYPE_TO_TEMPLATE,
  SEVERITY_DURATION_ESTIMATE,
  MATERIAL_ESTIMATES,
} from '../types';
import { getTemplates, generateAssessmentId } from '../utils/storage';

interface RestorationAssessmentProps {
  project: RestorationProject;
  onClose: () => void;
  onSaveAssessment: (assessment: RestorationAssessment, advanceStatus: boolean) => { success: boolean; error?: string };
}

export default function RestorationAssessment({ project, onClose, onSaveAssessment }: RestorationAssessmentProps) {
  const [templates, setTemplates] = useState<RestorationTemplate[]>([]);
  const [paperCondition, setPaperCondition] = useState<PaperCondition>('good');
  const [damageSeverity, setDamageSeverity] = useState<DamageSeverity>('moderate');
  const [pollutionTypes, setPollutionTypes] = useState<PollutionType[]>([]);
  const [bindingCondition, setBindingCondition] = useState<BindingCondition>('intact');
  const [repairSuggestion, setRepairSuggestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setTemplates(getTemplates());
  }, []);

  const recommendedTemplateId = useMemo(() => {
    if (project.damageTypes.length === 0) {
      const defaultTemplate = templates.find(t => t.isDefault);
      return defaultTemplate?.id || templates[0]?.id || '';
    }

    const templateCount: Record<string, number> = {};
    project.damageTypes.forEach(damageType => {
      const templateId = DAMAGE_TYPE_TO_TEMPLATE[damageType];
      if (templateId) {
        templateCount[templateId] = (templateCount[templateId] || 0) + 1;
      }
    });

    let maxCount = 0;
    let recommendedId = '';
    Object.entries(templateCount).forEach(([id, count]) => {
      if (count > maxCount) {
        maxCount = count;
        recommendedId = id;
      }
    });

    if (!recommendedId) {
      const defaultTemplate = templates.find(t => t.isDefault);
      return defaultTemplate?.id || templates[0]?.id || '';
    }

    return recommendedId;
  }, [project.damageTypes, templates]);

  const estimatedDuration = useMemo(() => {
    return SEVERITY_DURATION_ESTIMATE[damageSeverity];
  }, [damageSeverity]);

  const materialEstimates = useMemo(() => {
    const baseMaterials = MATERIAL_ESTIMATES[recommendedTemplateId] || [];
    const volumeMultiplier = Math.max(1, Math.ceil(project.volumeCount / 3));

    return baseMaterials.map(m => ({
      ...m,
      quantity: String(parseInt(m.quantity) * volumeMultiplier),
    }));
  }, [recommendedTemplateId, project.volumeCount]);

  const recommendedTemplate = useMemo(() => {
    return templates.find(t => t.id === recommendedTemplateId);
  }, [templates, recommendedTemplateId]);

  const handlePollutionToggle = (type: PollutionType) => {
    setPollutionTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const isFormValid = paperCondition && damageSeverity && bindingCondition;

  const handleSave = (advanceStatus: boolean) => {
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setSaveError(null);

    const now = new Date().toISOString().split('T')[0];
    const assessment: RestorationAssessment = {
      id: generateAssessmentId(),
      projectId: project.id,      paperCondition,
      damageSeverity,
      pollutionTypes,
      bindingCondition,
      repairSuggestion: repairSuggestion.trim(),
      recommendedTemplateId,
      estimatedDuration,
      estimatedMaterials: materialEstimates,
      createdAt: now,
      completedAt: now,
    };

    const result = onSaveAssessment(assessment, advanceStatus);
    if (!result.success) {
      setSaveError(result.error || '保存失败');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content assessment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-left">
            <h2>修复评估单</h2>
            <span className="assessment-book-title">《{project.bookTitle}》</span>
          </div>
          <button className="btn btn-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="assessment-info-bar">
            <div className="info-item">
              <span className="info-label">破损类型</span>
              <div className="damage-tags">
                {project.damageTypes.map(type => (
                  <span key={type} className="damage-tag">{type}</span>
                ))}
              </div>
            </div>
            <div className="info-item">
              <span className="info-label">册数</span>
              <span className="info-value">{project.volumeCount}册</span>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">纸张状态</h3>
            <div className="radio-group horizontal">
              {(Object.keys(PAPER_CONDITION_LABELS) as PaperCondition[]).map(condition => (
                <label key={condition} className={`radio-item ${paperCondition === condition ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="paperCondition"
                    value={condition}
                    checked={paperCondition === condition}
                    onChange={() => setPaperCondition(condition)}
                  />
                  <span className="radio-label">{PAPER_CONDITION_LABELS[condition]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">破损严重度</h3>
            <div className="radio-group horizontal">
              {(Object.keys(DAMAGE_SEVERITY_LABELS) as DamageSeverity[]).map(severity => (
                <label key={severity} className={`radio-item ${damageSeverity === severity ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="damageSeverity"
                    value={severity}
                    checked={damageSeverity === severity}
                    onChange={() => setDamageSeverity(severity)}
                  />
                  <span className="radio-label">{DAMAGE_SEVERITY_LABELS[severity]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">污染类型（可多选）</h3>
            <div className="checkbox-group">
              {(Object.keys(POLLUTION_TYPE_LABELS) as PollutionType[]).map(type => (
                <label key={type} className={`checkbox-item ${pollutionTypes.includes(type) ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    value={type}
                    checked={pollutionTypes.includes(type)}
                    onChange={() => handlePollutionToggle(type)}
                  />
                  <span className="checkbox-label">{POLLUTION_TYPE_LABELS[type]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">装帧情况</h3>
            <div className="radio-group horizontal">
              {(Object.keys(BINDING_CONDITION_LABELS) as BindingCondition[]).map(condition => (
                <label key={condition} className={`radio-item ${bindingCondition === condition ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="bindingCondition"
                    value={condition}
                    checked={bindingCondition === condition}
                    onChange={() => setBindingCondition(condition)}
                  />
                  <span className="radio-label">{BINDING_CONDITION_LABELS[condition]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">修复建议</h3>
            <textarea
              className="suggestion-textarea"
              value={repairSuggestion}
              onChange={(e) => setRepairSuggestion(e.target.value)}
              placeholder="请输入具体的修复建议，如需要特别注意的问题、特殊处理要求等..."
              rows={4}
            />
          </div>

          <div className="recommendation-section">
            <h3 className="form-section-title">智能推荐</h3>

            {recommendedTemplate && (
              <div className="recommendation-card">
                <div className="recommendation-header">
                  <span className="recommendation-icon">📋</span>
                  <div>
                    <h4>推荐流程模板</h4>
                    <p className="recommendation-name">{recommendedTemplate.name}</p>
                    <p className="recommendation-desc">{recommendedTemplate.description}</p>
                  </div>
                </div>
                <div className="recommendation-steps">
                  <span className="steps-label">包含步骤：</span>
                  <div className="steps-tags">
                    {recommendedTemplate.steps.map((step, idx) => (
                      <span key={idx} className="step-tag">{idx + 1}. {step}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="recommendation-card">
              <div className="recommendation-header">
                <span className="recommendation-icon">⏱️</span>
                <div>
                  <h4>预计工期</h4>
                  <p className="recommendation-highlight">{estimatedDuration}</p>
                  <p className="recommendation-desc">根据破损严重度估算，{project.volumeCount}册</p>
                </div>
              </div>
            </div>

            <div className="recommendation-card">
              <div className="recommendation-header">
                <span className="recommendation-icon">📦</span>
                <div>
                  <h4>材料预估</h4>
                  <p className="recommendation-desc">按{project.volumeCount}册计算</p>
                </div>
              </div>
              <table className="materials-table compact">
                <thead>
                  <tr>
                    <th>材料名称</th>
                    <th>预估数量</th>
                    <th>单位</th>
                  </tr>
                </thead>
                <tbody>
                  {materialEstimates.map((material, index) => (
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

          {saveError && (
            <div className="error-message">{saveError}</div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
            取消
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => handleSave(false)}
            disabled={!isFormValid || isSubmitting}
          >
            仅保存评估
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleSave(true)}
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? '保存中...' : '保存并开始修复'}
          </button>
        </div>
      </div>
    </div>
  );
}
