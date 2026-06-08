import { useState, useRef, useMemo } from 'react';
import type { RestorationProject, MaterialUsage, RestorationStep, Priority, ProjectStatus, DamageType } from '../types';
import { DAMAGE_TYPES, DEFAULT_RESTORATION_STEPS, STATUS_LABELS, PRIORITY_LABELS } from '../types';
import { addProject, getProjects, generateId } from '../utils/storage';

interface ParsedRow {
  bookTitle: string;
  volumeCount: number;
  damageTypes: string[];
  deliveryDate: string;
  notes: string;
  description: string;
  restorationSteps: string[];
  materialsUsed: MaterialUsage[];
  priority: Priority;
  status: ProjectStatus;
}

interface PreviewRow extends ParsedRow {
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
  duplicateWith?: number[];
}

interface ImportResult {
  success: { row: number; bookTitle: string; projectId: string }[];
  skipped: { row: number; bookTitle: string; reason: string }[];
  failed: { row: number; bookTitle: string; error: string }[];
}

interface BatchImportProps {
  onImportComplete?: () => void;
}

type Step = 'input' | 'preview' | 'result';

const COLUMN_MAPPINGS: Record<string, string[]> = {
  bookTitle: ['书名', '图书名称', '标题', '书籍名称', 'book', 'title', 'name'],
  volumeCount: ['册数', '数量', '卷数', '册', 'volume', 'count', 'qty'],
  damageTypes: ['破损类型', '损坏类型', '破损情况', '病害类型', 'damage', '破损'],
  deliveryDate: ['交付日期', '交稿日期', '截止日期', '完成日期', 'delivery', 'deadline', 'date'],
  notes: ['备注', '说明', 'note', 'remark', 'comment'],
  description: ['描述', '项目描述', '详情', 'description', 'detail'],
  restorationSteps: ['修复步骤', '步骤', '工序', '流程', 'steps', 'process'],
  materialsUsed: ['材料用量', '材料', '用料', '耗材', 'material', 'materials'],
  priority: ['优先级', '优先等级', '紧急程度', 'priority', 'level'],
  status: ['状态', '初始状态', '当前状态', 'status', 'state'],
};

const PRIORITY_MAP: Record<string, Priority> = {
  '紧急': 'high',
  '高': 'high',
  '高优': 'high',
  'high': 'high',
  '普通': 'medium',
  '中': 'medium',
  '一般': 'medium',
  'medium': 'medium',
  '低优': 'low',
  '低': 'low',
  'low': 'low',
};

const STATUS_MAP: Record<string, ProjectStatus> = {
  '待评估': 'pending',
  '未开始': 'pending',
  'pending': 'pending',
  '修复中': 'restoring',
  '进行中': 'restoring',
  'restoring': 'restoring',
  '待晾干': 'drying',
  '晾干中': 'drying',
  'drying': 'drying',
  '待装订': 'binding',
  '装订中': 'binding',
  'binding': 'binding',
  '已交付': 'delivered',
  '已完成': 'delivered',
  'delivered': 'delivered',
};

const CSV_COLUMNS = ['书名', '册数', '破损类型', '交付日期', '备注', '描述', '修复步骤', '材料用量', '优先级', '状态'];

export default function BatchImport({ onImportComplete }: BatchImportProps = {}) {
  const [step, setStep] = useState<Step>('input');
  const [inputText, setInputText] = useState('');
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [columnOrder, setColumnOrder] = useState<Record<string, number>>({});
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

  const matchColumn = (header: string): string | null => {
    const lowerHeader = header.toLowerCase().trim();
    for (const [field, aliases] of Object.entries(COLUMN_MAPPINGS)) {
      for (const alias of aliases) {
        if (lowerHeader.includes(alias.toLowerCase()) || alias.toLowerCase().includes(lowerHeader)) {
          return field;
        }
      }
    }
    return null;
  };

  const detectColumnOrder = (headers: string[]): Record<string, number> => {
    const order: Record<string, number> = {};
    headers.forEach((header, index) => {
      const field = matchColumn(header);
      if (field) {
        order[field] = index;
      }
    });
    return order;
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

  const parseRestorationSteps = (str: string): string[] => {
    if (!str.trim()) return [];
    const separators = [/[,，、;；\s]+/, /\s+/];
    let steps: string[] = [];
    for (const sep of separators) {
      steps = str.split(sep).map(s => s.trim()).filter(s => s);
      if (steps.length > 1) break;
    }
    return steps;
  };

  const parseMaterialsUsed = (str: string): { materials: MaterialUsage[]; errors: string[] } => {
    const materials: MaterialUsage[] = [];
    const errors: string[] = [];
    if (!str.trim()) return { materials, errors };

    const materialStrs = str.split(/[;；\n]+/).map(s => s.trim()).filter(s => s);
    
    for (const matStr of materialStrs) {
      const match = matStr.match(/^(.+?)\s*[:：\s]\s*([\d.]+)\s*(\S+)?\s*(.*)$/);
      if (match) {
        const [, name, quantity, unit, notes] = match;
        if (name.trim() && quantity && unit) {
          materials.push({
            id: generateId(),
            name: name.trim(),
            quantity: quantity,
            unit: unit.trim(),
            notes: notes.trim() || undefined,
          });
        } else if (name.trim() && quantity) {
          errors.push(`材料"${name.trim()}"缺少单位`);
        }
      } else {
        const simpleMatch = matStr.match(/^(.+?)\s*(\S+)$/);
        if (simpleMatch) {
          const [, name, unit] = simpleMatch;
          materials.push({
            id: generateId(),
            name: name.trim(),
            quantity: '0',
            unit: unit.trim(),
          });
        } else {
          errors.push(`材料格式无法解析: "${matStr}"，正确格式：材料名:数量单位，如"修复纸:50张"`);
        }
      }
    }
    
    return { materials, errors };
  };

  const parsePriority = (str: string): Priority => {
    if (!str.trim()) return 'medium';
    const lowerStr = str.trim().toLowerCase();
    return PRIORITY_MAP[lowerStr] || PRIORITY_MAP[str.trim()] || 'medium';
  };

  const parseStatus = (str: string): ProjectStatus => {
    if (!str.trim()) return 'pending';
    const lowerStr = str.trim().toLowerCase();
    return STATUS_MAP[lowerStr] || STATUS_MAP[str.trim()] || 'pending';
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

  const isDatePast = (dateStr: string): boolean => {
    if (!validateDate(dateStr)) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    return date.getTime() < today.getTime();
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
    
    const hasHeader = Object.keys(COLUMN_MAPPINGS).some(field => 
      COLUMN_MAPPINGS[field].some(alias => 
        firstRow.some(cell => cell.includes(alias) || alias.includes(cell))
      )
    );

    if (hasHeader) {
      order = detectColumnOrder(firstRow);
      dataRows = rows.slice(1);
    } else {
      const defaultOrder: Record<string, number> = {
        bookTitle: 0,
        volumeCount: 1,
        damageTypes: 2,
        deliveryDate: 3,
        notes: 4,
        description: 5,
        restorationSteps: 6,
        materialsUsed: 7,
        priority: 8,
        status: 9,
      };
      order = defaultOrder;
    }
    setColumnOrder(order);

    const defaultDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().split('T')[0];
    })();

    const existingProjects = getProjects();
    const existingKeys = new Set(existingProjects.map(p => `${p.bookTitle.trim()}-${p.volumeCount}`));
    const rowKeys = new Map<string, number[]>();

    let preview: PreviewRow[] = dataRows.map((row, rowIdx) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      
      const getValue = (field: string): string => (row[order[field]] || '').trim();

      const bookTitle = getValue('bookTitle');
      const volumeCountStr = getValue('volumeCount');
      const damageTypesStr = getValue('damageTypes');
      const deliveryDateStr = getValue('deliveryDate');
      const notes = getValue('notes');
      const description = getValue('description');
      const restorationStepsStr = getValue('restorationSteps');
      const materialsUsedStr = getValue('materialsUsed');
      const priorityStr = getValue('priority');
      const statusStr = getValue('status');

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

      const duplicateKey = `${bookTitle.trim()}-${volumeCount}`;
      let isDuplicate = false;
      if (bookTitle.trim()) {
        if (existingKeys.has(duplicateKey)) {
          isDuplicate = true;
          errors.push(`项目"${bookTitle}"(${volumeCount}册)已存在于数据库中`);
        }
        if (rowKeys.has(duplicateKey)) {
          isDuplicate = true;
          const prevRows = rowKeys.get(duplicateKey)!;
          errors.push(`与第${prevRows.map(r => r + 1).join('、')}行的项目重复`);
        }
        if (!rowKeys.has(duplicateKey)) {
          rowKeys.set(duplicateKey, []);
        }
        rowKeys.get(duplicateKey)!.push(rowIdx);
      }

      let damageTypes = parseDamageTypes(damageTypesStr);
      if (damageTypes.length === 0) {
        warnings.push('破损类型为空');
      } else {
        const invalidTypes = damageTypes.filter(t => !DAMAGE_TYPES.includes(t as DamageType));
        if (invalidTypes.length > 0) {
          errors.push(`破损类型"${invalidTypes.join('、')}"不是合法的破损类型`);
        }
      }

      let deliveryDate = formatDate(deliveryDateStr);
      if (!deliveryDateStr) {
        warnings.push(`交付日期为空，默认设为${defaultDate}`);
        deliveryDate = defaultDate;
      } else if (!validateDate(deliveryDate)) {
        errors.push(`交付日期"${deliveryDateStr}"格式无效，需为YYYY-MM-DD格式`);
      } else if (isDatePast(deliveryDate)) {
        warnings.push(`交付日期"${deliveryDate}"已过期`);
      }

      const restorationSteps = parseRestorationSteps(restorationStepsStr);

      const { materials: materialsUsed, errors: materialErrors } = parseMaterialsUsed(materialsUsedStr);
      if (materialErrors.length > 0) {
        errors.push(...materialErrors);
      }

      const priority = parsePriority(priorityStr);
      const status = parseStatus(statusStr);

      if (status === 'delivered') {
        warnings.push('初始状态设为"已交付"，建议确认');
      }

      return {
        bookTitle,
        volumeCount,
        damageTypes,
        deliveryDate,
        notes,
        description,
        restorationSteps,
        materialsUsed,
        priority,
        status,
        errors,
        warnings,
        isDuplicate,
      };
    });

    preview = preview.map(row => {
      const key = `${row.bookTitle.trim()}-${row.volumeCount}`;
      const dupRows = rowKeys.get(key);
      if (dupRows && dupRows.length > 1) {
        return {
          ...row,
          duplicateWith: dupRows.filter((_, i) => i !== dupRows.indexOf(preview.indexOf(row))),
        };
      }
      return row;
    });

    const allMaterials: Map<string, Set<string>> = new Map();
    preview.forEach(row => {
      row.materialsUsed.forEach(mat => {
        if (!allMaterials.has(mat.name)) {
          allMaterials.set(mat.name, new Set());
        }
        allMaterials.get(mat.name)!.add(mat.unit);
      });
    });

    preview = preview.map(row => {
      const newErrors = [...row.errors];
      row.materialsUsed.forEach(mat => {
        const units = allMaterials.get(mat.name);
        if (units && units.size > 1) {
          const otherUnits = Array.from(units).filter(u => u !== mat.unit);
          if (otherUnits.length > 0) {
            newErrors.push(`材料"${mat.name}"单位不一致，当前单位"${mat.unit}"，其他行使用"${otherUnits.join('、')}"`);
          }
        }
      });
      return { ...row, errors: newErrors };
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
        row.deliveryDate = formatDate(value as string);
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
        const { materials, errors } = parseMaterialsUsed(value as string);
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
