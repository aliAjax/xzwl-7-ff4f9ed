import { useState, useRef, useMemo } from 'react';
import type { RestorationProject, MaterialUsage, RestorationStep, DamageType } from '../types';
import { DAMAGE_TYPES, DEFAULT_RESTORATION_STEPS, STATUS_LABELS, PRIORITY_LABELS } from '../types';
import { addProject, getProjects, generateId } from '../utils/storage';
import {
  type ParsedRow,
  type PreviewRow,
  type ImportResult,
  parseCSV,
  detectColumnOrder,
  parseDamageTypes,
  parseRestorationSteps,
  parseMaterialsUsed,
  parsePriority,
  parseStatus,
  validateDate,
  formatDateForImport,
  isDatePast,
  hasHeaderRow,
  getDefaultColumnOrder,
  validateAndParseRow,
  detectMaterialUnitConflicts,
  markDuplicateRows,
} from '../utils/batchImportUtils';

interface BatchImportProps {
  onImportComplete?: () => void;
}

type Step = 'input' | 'preview' | 'result';

export default function BatchImport({ onImportComplete }: BatchImportProps = {}) {
  const [step, setStep] = useState<Step>('input');
  const [inputText, setInputText] = useState('');
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputText(content);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const validateAndParse = () => {
    const rows = parseCSV(inputText);
    if (rows.length === 0) {
      alert('请输入数据或上传CSV文件');
      return;
    }

    let dataRows = rows;
    let order: Record<string, number> = {};
    const firstRow = rows[0].map(h => h.trim());

    const hasHeader = hasHeaderRow(rows);

    if (hasHeader) {
      order = detectColumnOrder(firstRow);
      dataRows = rows.slice(1);
    } else {
      order = getDefaultColumnOrder();
    }

    const existingProjects = getProjects();
    const existingKeys = new Set(existingProjects.map(p => `${p.bookTitle.trim()}-${p.volumeCount}`));
    const rowKeys = new Map<string, number[]>();

    let preview: PreviewRow[] = dataRows.map((row, rowIdx) =>
      validateAndParseRow(row, order, existingKeys, rowKeys, rowIdx, generateId)
    );

    preview = markDuplicateRows(preview, rowKeys);
    preview = detectMaterialUnitConflicts(preview);

    setPreviewData(preview);
    setStep('preview');
  };

  const updatePreviewRow = (index: number, field: keyof ParsedRow, value: string | number | string[]) => {
    setPreviewData(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };
      
      if (field === 'bookTitle') {
        row.bookTitle = value as string;
        row.errors = row.errors.filter(e => !e.includes('书名') && !e.includes('重复') && !e.includes('已存在'));
        row.warnings = row.warnings.filter(e => !e.includes('重复'));
        row.isDuplicate = false;
        row.duplicateWith = undefined;
        if (!row.bookTitle.trim()) {
          row.errors.push('书名为空');
        }
      } else if (field === 'volumeCount') {
        const num = parseInt(value as string);
        row.volumeCount = isNaN(num) ? 1 : num;
        row.errors = row.errors.filter(e => !e.includes('册数') && !e.includes('重复') && !e.includes('已存在'));
        row.warnings = row.warnings.filter(e => !e.includes('册数'));
        row.isDuplicate = false;
        row.duplicateWith = undefined;
        if (isNaN(num) || num < 1) {
          row.errors.push(`册数"${value}"无效，需为正整数`);
        }
      } else if (field === 'damageTypes') {
        const types = parseDamageTypes(value as string);
        row.damageTypes = types;
        row.errors = row.errors.filter(e => !e.includes('破损类型'));
        row.warnings = row.warnings.filter(e => !e.includes('破损类型'));
        if (types.length === 0) {
          row.warnings.push('破损类型为空');
        } else {
          const invalidTypes = types.filter(t => !DAMAGE_TYPES.includes(t as DamageType));
          if (invalidTypes.length > 0) {
            row.errors.push(`破损类型"${invalidTypes.join('、')}"不是合法的破损类型`);
          }
        }
      } else if (field === 'deliveryDate') {
        row.deliveryDate = formatDateForImport(value as string);
        row.errors = row.errors.filter(e => !e.includes('交付日期'));
        row.warnings = row.warnings.filter(e => !e.includes('交付日期'));
        if (!validateDate(row.deliveryDate)) {
          row.errors.push(`交付日期"${value}"格式无效，需为YYYY-MM-DD格式`);
        } else if (isDatePast(row.deliveryDate)) {
          row.warnings.push(`交付日期"${row.deliveryDate}"已过期`);
        }
      } else if (field === 'notes') {
        row.notes = value as string;
      } else if (field === 'description') {
        row.description = value as string;
      } else if (field === 'restorationSteps') {
        row.restorationSteps = parseRestorationSteps(value as string);
      } else if (field === 'materialsUsed') {
        const { materials, errors } = parseMaterialsUsed(value as string, generateId);
        row.materialsUsed = materials;
        row.errors = row.errors.filter(e => !e.includes('材料') && !e.includes('单位'));
        if (errors.length > 0) {
          row.errors.push(...errors);
        }
      } else if (field === 'priority') {
        row.priority = parsePriority(value as string);
      } else if (field === 'status') {
        row.status = parseStatus(value as string);
        row.warnings = row.warnings.filter(e => !e.includes('已交付'));
        if (row.status === 'delivered') {
          row.warnings.push('初始状态设为"已交付"，建议确认');
        }
      }
      
      updated[index] = row;
      return updated;
    });
  };

  const removeRow = (index: number) => {
    setPreviewData(prev => prev.filter((_, i) => i !== index));
  };

  const hasErrors = useMemo(() => {
    return previewData.some(row => row.errors.length > 0);
  }, [previewData]);

  const stats = useMemo(() => {
    const total = previewData.length;
    const withErrors = previewData.filter(r => r.errors.length > 0).length;
    const withWarnings = previewData.filter(r => r.warnings.length > 0 && r.errors.length === 0).length;
    const duplicates = previewData.filter(r => r.isDuplicate).length;
    const valid = total - withErrors;
    return { total, withErrors, withWarnings, valid, duplicates };
  }, [previewData]);

  const calculateProgress = (steps: RestorationStep[]): number => {
    if (steps.length === 0) return 0;
    const completed = steps.filter(s => s.completed).length;
    return Math.round((completed / steps.length) * 100);
  };

  const handleConfirm = () => {
    if (hasErrors) {
      alert('存在错误，请先修正红色标注的字段');
      return;
    }
    if (previewData.length === 0) {
      alert('没有可导入的数据');
      return;
    }

    if (!confirm(`确认导入 ${stats.valid} 个项目？`)) return;

    const result: ImportResult = {
      success: [],
      skipped: [],
      failed: [],
    };

    previewData.forEach((row, idx) => {
      try {
        if (row.isDuplicate) {
          result.skipped.push({
            row: idx + 1,
            bookTitle: row.bookTitle,
            reason: '项目已存在或重复',
          });
          return;
        }

        const steps = row.restorationSteps.length > 0
          ? row.restorationSteps.map((name, i) => ({
              id: `step-${idx}-${i}`,
              name,
              description: `执行${name}操作`,
              completed: false,
              estimatedDuration: 2,
              notes: '',
            }))
          : DEFAULT_RESTORATION_STEPS.map((name, i) => ({
              id: `step-${idx}-${i}`,
              name,
              description: `执行${name}操作`,
              completed: false,
              estimatedDuration: 2,
              notes: '',
            }));

        const progress = calculateProgress(steps);

        const project: Omit<RestorationProject, 'id' | 'createdAt' | 'updatedAt'> = {
          bookTitle: row.bookTitle.trim(),
          volumeCount: row.volumeCount,
          damageTypes: row.damageTypes as DamageType[],
          deliveryDate: row.deliveryDate,
          status: row.status,
          currentProgress: progress,
          priority: row.priority,
          description: row.description || '批量导入项目',
          restorationSteps: steps,
          materialsUsed: row.materialsUsed,
          imageRecords: [],
          notes: row.notes || undefined,
        };

        const newProject = addProject(project);
        result.success.push({
          row: idx + 1,
          bookTitle: row.bookTitle,
          projectId: newProject.id,
        });
      } catch (error) {
        result.failed.push({
          row: idx + 1,
          bookTitle: row.bookTitle,
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    });

    setImportResult(result);
    setStep('result');

    if (onImportComplete && result.success.length > 0) {
      onImportComplete();
    }
  };

  const formatMaterialsForDisplay = (materials: MaterialUsage[]): string => {
    return materials.map(m => `${m.name}:${m.quantity}${m.unit}`).join('; ');
  };

  const formatStepsForDisplay = (steps: string[]): string => {
    return steps.join('、');
  };

  const resetImport = () => {
    setStep('input');
    setPreviewData([]);
    setImportResult(null);
    setInputText('');
  };

  return (
    <div className="modal-overlay" onClick={(() => {})}>
      <div className="modal-content batch-import-modal large-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📥 导入向导</h2>
          <button className="btn btn-close" onClick={resetImport}>×</button>
        </div>

        <div className="batch-steps">
          <div className={`batch-step ${step === 'input' ? 'active' : ''} ${step !== 'input' ? 'done' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">输入数据</span>
          </div>
          <div className="step-divider" />
          <div className={`batch-step ${step === 'preview' ? 'active' : ''} ${step === 'result' ? 'done' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">预览校验</span>
          </div>
          <div className="step-divider" />
          <div className={`batch-step ${step === 'result' ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">导入结果</span>
          </div>
        </div>

        <div className="modal-body">
          {step === 'input' && (
            <div className="input-section">
              <div className="upload-section">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  📁 上传CSV文件
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden-file-input"
                />
                <span className="upload-hint">或直接粘贴表格数据到下方</span>
              </div>

              <div className="format-hint">
                <p><strong>支持的格式（列顺序可任意排列）：</strong></p>
                <p>📚 基础字段：书名*、册数、破损类型、交付日期、备注、描述</p>
                <p>🔧 扩展字段：修复步骤、材料用量、优先级、初始状态</p>
                <p>💡 破损类型/步骤：用逗号、顿号或空格分隔，如：虫蛀、水渍、脱页</p>
                <p>🎨 材料用量：格式「名称:数量单位」，多个用分号分隔，如：修复纸:50张; 浆糊:200克</p>
                <p>🚩 优先级：紧急/普通/低优 或 high/medium/low</p>
                <p>📊 状态：待评估/修复中/待晾干/待装订/已交付</p>
                <p>📅 日期格式：YYYY-MM-DD 或 2024/01/15 或 2024年1月15日</p>
              </div>

              <div className="form-group">
                <label>粘贴数据（Excel/CSV/制表符分隔）</label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`书名,册数,破损类型,交付日期,备注,描述,修复步骤,材料用量,优先级,状态
永乐大典,5,虫蛀、脱页、酸化,2024-08-15,明代版本,珍贵古籍,检查评估、清理除尘、脱酸处理,修复纸:50张;浆糊:200克;清洁剂:150毫升,紧急,待评估
四库全书,12,霉斑、水渍、粘连,2024-07-30,清代官修,大型丛书,检查评估、吸水处理、清洗脱酸,修复纸:100张;浆糊:500克,普通,待评估
史记,3,脱线、破损,2024-09-01,,,检查评估、装订整理,装订线:10米,低优,待评估`}
                  rows={12}
                  className="batch-textarea"
                />
              </div>

              <div className="sample-data">
                <button
                  type="button"
                  className="btn btn-text"
                  onClick={() => {
                    setInputText(`书名,册数,破损类型,交付日期,备注,描述,修复步骤,材料用量,优先级,状态
永乐大典,5,虫蛀、脱页、酸化,2024-08-15,明代版本，虫蛀较严重,珍贵古籍修复项目,检查评估、清理除尘、脱酸处理、补洞修复、托裱加固,修复纸:50张;浆糊:200克;清洁剂:150毫升,紧急,待评估
四库全书,12,霉斑、水渍、粘连,2024-07-30,清代官修大型丛书,国家一级文物,检查评估、吸水处理、清洗脱酸、补洞修复、托裱加固、晾干定型,修复纸:100张;浆糊:500克;清洁剂:300毫升,普通,待评估
史记,3,脱线、破损,2024-09-01,,常见破损修复,检查评估、装订整理,装订线:10米;胶水:50毫升,低优,待评估
资治通鉴,6,酸化、霉斑,2024-08-01,需要脱酸处理,批量脱酸项目,检查评估、脱酸处理、晾干定型,脱酸剂:500毫升;修复纸:30张,普通,修复中
本草纲目,8,虫蛀、焦脆、撕裂,2024-06-30,已完成大部分修复,严重破损修复,检查评估、清理除尘、补洞修复、托裱加固、装订整理,修复纸:80张;浆糊:300克,紧急,修复中`);
                  }}
                >
                  填入示例数据
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="preview-section">
              <div className="preview-stats">
                <div className="stat-chip total">共 {stats.total} 条</div>
                <div className="stat-chip valid">✓ 可导入 {stats.valid} 条</div>
                {stats.duplicates > 0 && (
                  <div className="stat-chip warning">⚠ 重复 {stats.duplicates} 条</div>
                )}
                {stats.withErrors > 0 && (
                  <div className="stat-chip error">✗ 错误 {stats.withErrors} 条</div>
                )}
                {stats.withWarnings > 0 && (
                  <div className="stat-chip warning">⚠ 警告 {stats.withWarnings} 条</div>
                )}
              </div>

              <div className="preview-table-container">
                <table className="preview-table wide-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th>书名 *</th>
                      <th style={{ width: '60px' }}>册数</th>
                      <th>破损类型</th>
                      <th style={{ width: '100px' }}>交付日期</th>
                      <th style={{ width: '80px' }}>优先级</th>
                      <th style={{ width: '80px' }}>状态</th>
                      <th>修复步骤</th>
                      <th>材料用量</th>
                      <th style={{ width: '50px' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, index) => (
                      <tr
                        key={index}
                        className={`preview-row ${row.errors.length > 0 ? 'row-error' : ''} ${row.isDuplicate ? 'row-duplicate' : ''}`}
                      >
                        <td className="row-index">{index + 1}</td>
                        <td>
                          <input
                            type="text"
                            value={row.bookTitle}
                            onChange={(e) => updatePreviewRow(index, 'bookTitle', e.target.value)}
                            className={row.errors.some(e => e.includes('书名') || e.includes('重复') || e.includes('已存在')) ? 'input-error' : ''}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={row.volumeCount}
                            onChange={(e) => updatePreviewRow(index, 'volumeCount', e.target.value)}
                            className={row.errors.some(e => e.includes('册数') || e.includes('重复') || e.includes('已存在')) ? 'input-error' : ''}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={row.damageTypes.join('、')}
                            onChange={(e) => updatePreviewRow(index, 'damageTypes', e.target.value)}
                            placeholder="用顿号分隔"
                            className={row.errors.some(e => e.includes('破损类型')) ? 'input-error' : ''}
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            value={row.deliveryDate}
                            onChange={(e) => updatePreviewRow(index, 'deliveryDate', e.target.value)}
                            className={row.errors.some(e => e.includes('交付日期')) ? 'input-error' : ''}
                          />
                        </td>
                        <td>
                          <select
                            value={row.priority}
                            onChange={(e) => updatePreviewRow(index, 'priority', e.target.value)}
                            className={`priority-select priority-${row.priority}`}
                          >
                            <option value="high">{PRIORITY_LABELS.high}</option>
                            <option value="medium">{PRIORITY_LABELS.medium}</option>
                            <option value="low">{PRIORITY_LABELS.low}</option>
                          </select>
                        </td>
                        <td>
                          <select
                            value={row.status}
                            onChange={(e) => updatePreviewRow(index, 'status', e.target.value)}
                            className={`status-select status-${row.status}`}
                          >
                            <option value="pending">{STATUS_LABELS.pending}</option>
                            <option value="restoring">{STATUS_LABELS.restoring}</option>
                            <option value="drying">{STATUS_LABELS.drying}</option>
                            <option value="binding">{STATUS_LABELS.binding}</option>
                            <option value="delivered">{STATUS_LABELS.delivered}</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={formatStepsForDisplay(row.restorationSteps)}
                            onChange={(e) => updatePreviewRow(index, 'restorationSteps', e.target.value)}
                            placeholder="顿号分隔，留空用默认"
                            className="wide-input"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={formatMaterialsForDisplay(row.materialsUsed)}
                            onChange={(e) => updatePreviewRow(index, 'materialsUsed', e.target.value)}
                            placeholder="名称:数量单位; 分号分隔"
                            className={`wide-input ${row.errors.some(e => e.includes('材料') || e.includes('单位')) ? 'input-error' : ''}`}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-remove-row"
                            onClick={() => removeRow(index)}
                            title="删除此行"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="row-messages">
                {previewData.map((row, index) => (
                  row.errors.length > 0 || row.warnings.length > 0 ? (
                    <div key={index} className="row-message">
                      <span className="row-num">第{index + 1}行「{row.bookTitle || '未命名'}」：</span>
                      {row.errors.map((err, i) => (
                        <span key={`err-${i}`} className="msg-error">✗ {err}</span>
                      ))}
                      {row.warnings.map((warn, i) => (
                        <span key={`warn-${i}`} className="msg-warning">⚠ {warn}</span>
                      ))}
                    </div>
                  ) : null
                ))}
              </div>

              {previewData.length === 0 && (
                <div className="empty-preview">
                  <p>没有可预览的数据</p>
                  <button type="button" className="btn btn-secondary" onClick={() => setStep('input')}>
                    返回输入
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'result' && importResult && (
            <div className="import-result-section">
              <div className="result-stats">
                <div className="result-stat success">
                  <span className="stat-icon">✓</span>
                  <span className="stat-label">成功导入</span>
                  <span className="stat-value">{importResult.success.length}</span>
                </div>
                <div className="result-stat skipped">
                  <span className="stat-icon">→</span>
                  <span className="stat-label">跳过</span>
                  <span className="stat-value">{importResult.skipped.length}</span>
                </div>
                <div className="result-stat failed">
                  <span className="stat-icon">✗</span>
                  <span className="stat-label">失败</span>
                  <span className="stat-value">{importResult.failed.length}</span>
                </div>
              </div>

              {importResult.success.length > 0 && (
                <div className="result-detail-section">
                  <h3 className="result-section-title success">✅ 导入成功 ({importResult.success.length})</h3>
                  <div className="result-list">
                    {importResult.success.map((item, idx) => (
                      <div key={idx} className="result-item success">
                        <span className="result-row">第{item.row}行</span>
                        <span className="result-title">{item.bookTitle}</span>
                        <span className="result-id">项目ID: {item.projectId}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResult.skipped.length > 0 && (
                <div className="result-detail-section">
                  <h3 className="result-section-title skipped">⏭ 已跳过 ({importResult.skipped.length})</h3>
                  <div className="result-list">
                    {importResult.skipped.map((item, idx) => (
                      <div key={idx} className="result-item skipped">
                        <span className="result-row">第{item.row}行</span>
                        <span className="result-title">{item.bookTitle}</span>
                        <span className="result-reason">原因: {item.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResult.failed.length > 0 && (
                <div className="result-detail-section">
                  <h3 className="result-section-title failed">❌ 导入失败 ({importResult.failed.length})</h3>
                  <div className="result-list">
                    {importResult.failed.map((item, idx) => (
                      <div key={idx} className="result-item failed">
                        <span className="result-row">第{item.row}行</span>
                        <span className="result-title">{item.bookTitle}</span>
                        <span className="result-error">错误: {item.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="form-actions">
          {step === 'input' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={resetImport}>
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={validateAndParse}
                disabled={!inputText.trim()}
              >
                下一步：预览校验 →
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('input')}>
                ← 返回修改
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={hasErrors || previewData.length === 0}
              >
                {hasErrors ? '请先修正错误' : `确认导入 ${stats.valid} 条 →`}
              </button>
            </>
          )}
          {step === 'result' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={resetImport}>
                继续导入
              </button>
              <button type="button" className="btn btn-primary" onClick={resetImport}>
                完成
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
