import { useState, useRef, useMemo } from 'react';
import type { RestorationProject } from '../types';
import { DAMAGE_TYPES, DEFAULT_RESTORATION_STEPS } from '../types';

interface ParsedRow {
  bookTitle: string;
  volumeCount: number;
  damageTypes: string[];
  deliveryDate: string;
  notes: string;
}

interface PreviewRow extends ParsedRow {
  errors: string[];
  warnings: string[];
}

interface BatchImportProps {
  onClose: () => void;
  onSave: (projects: Omit<RestorationProject, 'id' | 'createdAt' | 'updatedAt'>[]) => void;
}

type Step = 'input' | 'preview';

const CSV_COLUMNS = ['书名', '册数', '破损类型', '交付日期', '备注'];

export default function BatchImport({ onClose, onSave }: BatchImportProps) {
  const [step, setStep] = useState<Step>('input');
  const [inputText, setInputText] = useState('');
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
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

  const parseCSV = (text: string): string[][] => {
    const lines = text.trim().split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return [];

    const result: string[][] = [];
    
    for (const line of lines) {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (inQuotes) {
          if (char === '"' && nextChar === '"') {
            current += '"';
            i++;
          } else if (char === '"') {
            inQuotes = false;
          } else {
            current += char;
          }
        } else {
          if (char === '"') {
            inQuotes = true;
          } else if (char === ',' || char === '\t') {
            cells.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
      }
      cells.push(current.trim());
      result.push(cells);
    }

    return result;
  };

  const parseDamageTypes = (str: string): string[] => {
    if (!str.trim()) return [];
    const separators = [/[,，、;；\s]+/, /\s+/];
    let types: string[] = [];
    for (const sep of separators) {
      types = str.split(sep).map(s => s.trim()).filter(s => s);
      if (types.length > 1) break;
    }
    return types;
  };

  const validateDate = (dateStr: string): boolean => {
    if (!dateStr.trim()) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) && dateStr.match(/^\d{4}-\d{2}-\d{2}$/) !== null;
  };

  const formatDate = (dateStr: string): string => {
    if (validateDate(dateStr)) return dateStr;
    const formats = [
      /^(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})[日号]?$/,
      /^(\d{4})(\d{2})(\d{2})$/,
    ];
    for (const regex of formats) {
      const match = dateStr.match(regex);
      if (match) {
        const [, y, m, d] = match;
        const year = parseInt(y);
        const month = parseInt(m).toString().padStart(2, '0');
        const day = parseInt(d).toString().padStart(2, '0');
        const formatted = `${year}-${month}-${day}`;
        if (validateDate(formatted)) return formatted;
      }
    }
    return dateStr;
  };

  const validateAndParse = () => {
    const rows = parseCSV(inputText);
    if (rows.length === 0) {
      alert('请输入数据或上传CSV文件');
      return;
    }

    let dataRows = rows;
    const firstRow = rows[0].map(h => h.trim());
    const isHeader = CSV_COLUMNS.some(col => 
      firstRow.some(cell => cell.includes(col) || col.includes(cell))
    );
    if (isHeader) {
      dataRows = rows.slice(1);
    }

    const defaultDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().split('T')[0];
    })();

    const preview: PreviewRow[] = dataRows.map((row) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      
      const bookTitle = (row[0] || '').trim();
      const volumeCountStr = (row[1] || '').trim();
      const damageTypesStr = (row[2] || '').trim();
      const deliveryDateStr = (row[3] || '').trim();
      const notes = (row[4] || '').trim();

      if (!bookTitle) {
        errors.push('书名为空');
      }

      let volumeCount = parseInt(volumeCountStr);
      if (!volumeCountStr) {
        warnings.push('册数为空，默认设为1');
        volumeCount = 1;
      } else if (isNaN(volumeCount) || volumeCount < 1) {
        errors.push(`册数"${volumeCountStr}"无效，需为正整数`);
        volumeCount = 1;
      }

      let damageTypes = parseDamageTypes(damageTypesStr);
      if (damageTypes.length === 0) {
        warnings.push('破损类型为空');
      } else {
        const invalidTypes = damageTypes.filter(t => !DAMAGE_TYPES.includes(t));
        if (invalidTypes.length > 0) {
          warnings.push(`破损类型"${invalidTypes.join('、')}"不在标准列表中，可手动修正`);
        }
      }

      let deliveryDate = formatDate(deliveryDateStr);
      if (!deliveryDateStr) {
        warnings.push(`交付日期为空，默认设为${defaultDate}`);
        deliveryDate = defaultDate;
      } else if (!validateDate(deliveryDate)) {
        errors.push(`交付日期"${deliveryDateStr}"格式无效，需为YYYY-MM-DD格式`);
      }

      return {
        bookTitle,
        volumeCount,
        damageTypes,
        deliveryDate,
        notes,
        errors,
        warnings,
      };
    });

    setPreviewData(preview);
    setStep('preview');
  };

  const updatePreviewRow = (index: number, field: keyof ParsedRow, value: string | number | string[]) => {
    setPreviewData(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };
      
      if (field === 'bookTitle') {
        row.bookTitle = value as string;
        row.errors = row.errors.filter(e => e !== '书名为空');
        if (!row.bookTitle.trim()) {
          row.errors.push('书名为空');
        }
      } else if (field === 'volumeCount') {
        const num = parseInt(value as string);
        row.volumeCount = isNaN(num) ? 1 : num;
        row.errors = row.errors.filter(e => !e.includes('册数'));
        row.warnings = row.warnings.filter(e => !e.includes('册数'));
        if (isNaN(num) || num < 1) {
          row.errors.push(`册数"${value}"无效，需为正整数`);
        }
      } else if (field === 'damageTypes') {
        const types = parseDamageTypes(value as string);
        row.damageTypes = types;
        row.warnings = row.warnings.filter(e => !e.includes('破损类型'));
        if (types.length === 0) {
          row.warnings.push('破损类型为空');
        } else {
          const invalidTypes = types.filter(t => !DAMAGE_TYPES.includes(t));
          if (invalidTypes.length > 0) {
            row.warnings.push(`破损类型"${invalidTypes.join('、')}"不在标准列表中，可手动修正`);
          }
        }
      } else if (field === 'deliveryDate') {
        row.deliveryDate = formatDate(value as string);
        row.errors = row.errors.filter(e => !e.includes('交付日期'));
        row.warnings = row.warnings.filter(e => !e.includes('交付日期'));
        if (!validateDate(row.deliveryDate)) {
          row.errors.push(`交付日期"${value}"格式无效，需为YYYY-MM-DD格式`);
        }
      } else if (field === 'notes') {
        row.notes = value as string;
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
    const valid = total - withErrors;
    return { total, withErrors, withWarnings, valid };
  }, [previewData]);

  const handleConfirm = () => {
    if (hasErrors) {
      alert('存在错误，请先修正红色标注的字段');
      return;
    }
    if (previewData.length === 0) {
      alert('没有可导入的数据');
      return;
    }

    const projects: Omit<RestorationProject, 'id' | 'createdAt' | 'updatedAt'>[] = previewData.map(row => ({
      bookTitle: row.bookTitle.trim(),
      volumeCount: row.volumeCount,
      damageTypes: row.damageTypes,
      deliveryDate: row.deliveryDate,
      notes: row.notes.trim() || undefined,
      status: 'pending-evaluation',
      currentProgress: 0,
      restorationSteps: DEFAULT_RESTORATION_STEPS.map(name => ({
        name,
        completed: false,
      })),
      materialsUsed: [],
      imageRecords: [],
    }));

    if (confirm(`确认导入 ${projects.length} 个项目？`)) {
      onSave(projects);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content batch-import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>批量导入项目</h2>
          <button className="btn btn-close" onClick={onClose}>×</button>
        </div>

        <div className="batch-steps">
          <div className={`batch-step ${step === 'input' ? 'active' : ''} ${step === 'preview' ? 'done' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">输入数据</span>
          </div>
          <div className="step-divider" />
          <div className={`batch-step ${step === 'preview' ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">预览确认</span>
          </div>
        </div>

        <div className="modal-body">
          {step === 'input' ? (
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
                <p><strong>支持的格式：</strong></p>
                <p>列顺序：书名、册数、破损类型、交付日期、备注</p>
                <p>破损类型多个可用逗号、顿号或空格分隔，如：虫蛀,水渍,脱页</p>
                <p>日期格式：YYYY-MM-DD 或 2024/01/15 或 2024年1月15日</p>
              </div>

              <div className="form-group">
                <label>粘贴数据（Excel/CSV/制表符分隔）</label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`书名,册数,破损类型,交付日期,备注
永乐大典,5,虫蛀、脱页、酸化,2024-08-15,明代版本
四库全书,12,霉斑、水渍、粘连,2024-07-30,清代官修
史记,3,脱线、破损,2024-09-01,`}
                  rows={12}
                  className="batch-textarea"
                />
              </div>

              <div className="sample-data">
                <button
                  type="button"
                  className="btn btn-text"
                  onClick={() => {
                    setInputText(`书名,册数,破损类型,交付日期,备注
永乐大典,5,虫蛀、脱页、酸化,2024-08-15,明代版本，虫蛀较严重
四库全书,12,霉斑、水渍、粘连,2024-07-30,清代官修大型丛书
史记,3,脱线、破损,2024-09-01,
资治通鉴,6,酸化、霉斑,2024-08-01,需要脱酸处理
本草纲目,8,虫蛀、焦脆、撕裂,2024-06-30,已完成大部分修复`);
                  }}
                >
                  填入示例数据
                </button>
              </div>
            </div>
          ) : (
            <div className="preview-section">
              <div className="preview-stats">
                <div className="stat-chip total">共 {stats.total} 条</div>
                <div className="stat-chip valid">✓ 可导入 {stats.valid} 条</div>
                {stats.withErrors > 0 && (
                  <div className="stat-chip error">✗ 错误 {stats.withErrors} 条</div>
                )}
                {stats.withWarnings > 0 && (
                  <div className="stat-chip warning">⚠ 警告 {stats.withWarnings} 条</div>
                )}
              </div>

              <div className="preview-table-container">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th>书名 *</th>
                      <th style={{ width: '80px' }}>册数</th>
                      <th>破损类型</th>
                      <th style={{ width: '120px' }}>交付日期</th>
                      <th>备注</th>
                      <th style={{ width: '60px' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, index) => (
                      <tr
                        key={index}
                        className={`preview-row ${row.errors.length > 0 ? 'row-error' : ''}`}
                      >
                        <td className="row-index">{index + 1}</td>
                        <td>
                          <input
                            type="text"
                            value={row.bookTitle}
                            onChange={(e) => updatePreviewRow(index, 'bookTitle', e.target.value)}
                            className={row.errors.some(e => e.includes('书名')) ? 'input-error' : ''}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={row.volumeCount}
                            onChange={(e) => updatePreviewRow(index, 'volumeCount', e.target.value)}
                            className={row.errors.some(e => e.includes('册数')) ? 'input-error' : ''}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={row.damageTypes.join('、')}
                            onChange={(e) => updatePreviewRow(index, 'damageTypes', e.target.value)}
                            placeholder="用顿号分隔"
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
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(e) => updatePreviewRow(index, 'notes', e.target.value)}
                            placeholder="可选"
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
                      <span className="row-num">第{index + 1}行：</span>
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
        </div>

        <div className="form-actions">
          {step === 'input' ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={validateAndParse}
                disabled={!inputText.trim()}
              >
                下一步：预览
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('input')}>
                返回修改
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={hasErrors || previewData.length === 0}
              >
                {hasErrors ? '请先修正错误' : `确认导入 ${stats.valid} 条`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
