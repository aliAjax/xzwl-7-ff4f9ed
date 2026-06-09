import type { MaterialUsage, Priority, ProjectStatus, DamageType } from '../types';
import { DAMAGE_TYPES } from '../types';

export const COLUMN_MAPPINGS: Record<string, string[]> = {
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

export const PRIORITY_MAP: Record<string, Priority> = {
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

export const STATUS_MAP: Record<string, ProjectStatus> = {
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

export interface ParsedRow {
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

export interface PreviewRow extends ParsedRow {
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
  duplicateWith?: number[];
}

export interface ImportResult {
  success: { row: number; bookTitle: string; projectId: string }[];
  skipped: { row: number; bookTitle: string; reason: string }[];
  failed: { row: number; bookTitle: string; error: string }[];
}

export const parseCSV = (text: string): string[][] => {
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

export const matchColumn = (header: string): string | null => {
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

export const detectColumnOrder = (headers: string[]): Record<string, number> => {
  const order: Record<string, number> = {};
  headers.forEach((header, index) => {
    const field = matchColumn(header);
    if (field) {
      order[field] = index;
    }
  });
  return order;
};

export const parseDamageTypes = (str: string): string[] => {
  if (!str.trim()) return [];
  const separators = [/[,，、;；\s]+/, /\s+/];
  let types: string[] = [];
  for (const sep of separators) {
    types = str.split(sep).map(s => s.trim()).filter(s => s);
    if (types.length > 1) break;
  }
  return types;
};

export const parseRestorationSteps = (str: string): string[] => {
  if (!str.trim()) return [];
  const separators = [/[,，、;；\s]+/, /\s+/];
  let steps: string[] = [];
  for (const sep of separators) {
    steps = str.split(sep).map(s => s.trim()).filter(s => s);
    if (steps.length > 1) break;
  }
  return steps;
};

export const parseMaterialsUsed = (str: string, generateId: () => string): { materials: MaterialUsage[]; errors: string[] } => {
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
      const simpleMatch = matStr.match(/^(.+?)\s+(\S+)$/);
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

export const parsePriority = (str: string): Priority => {
  if (!str.trim()) return 'medium';
  const lowerStr = str.trim().toLowerCase();
  return PRIORITY_MAP[lowerStr] || PRIORITY_MAP[str.trim()] || 'medium';
};

export const parseStatus = (str: string): ProjectStatus => {
  if (!str.trim()) return 'pending';
  const lowerStr = str.trim().toLowerCase();
  return STATUS_MAP[lowerStr] || STATUS_MAP[str.trim()] || 'pending';
};

export const validateDate = (dateStr: string): boolean => {
  if (!dateStr.trim()) return false;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

export const formatDateForImport = (dateStr: string): string => {
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

export const isDatePast = (dateStr: string): boolean => {
  if (!validateDate(dateStr)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
};

export const hasHeaderRow = (rows: string[][]): boolean => {
  if (rows.length === 0) return false;
  const firstRow = rows[0].map(h => h.trim());
  return Object.keys(COLUMN_MAPPINGS).some(field =>
    COLUMN_MAPPINGS[field].some(alias =>
      firstRow.some(cell => cell.includes(alias) || alias.includes(cell))
    )
  );
};

export const getDefaultColumnOrder = (): Record<string, number> => ({
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
});

export const getDefaultDate = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
};

export const validateAndParseRow = (
  row: string[],
  order: Record<string, number>,
  existingKeys: Set<string>,
  rowKeys: Map<string, number[]>,
  rowIdx: number,
  generateId: () => string
): PreviewRow => {
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
      warnings.push(`项目"${bookTitle}"(${volumeCount}册)已存在于数据库中，确认导入时将跳过`);
    }
    if (rowKeys.has(duplicateKey)) {
      isDuplicate = true;
      const prevRows = rowKeys.get(duplicateKey)!;
      warnings.push(`与第${prevRows.map(r => r + 1).join('、')}行的项目重复，确认导入时将跳过`);
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

  const defaultDate = getDefaultDate();
  let deliveryDate = formatDateForImport(deliveryDateStr);
  if (!deliveryDateStr) {
    warnings.push(`交付日期为空，默认设为${defaultDate}`);
    deliveryDate = defaultDate;
  } else if (!validateDate(deliveryDate)) {
    errors.push(`交付日期"${deliveryDateStr}"格式无效，需为YYYY-MM-DD格式`);
  } else if (isDatePast(deliveryDate)) {
    warnings.push(`交付日期"${deliveryDate}"已过期`);
  }

  const restorationSteps = parseRestorationSteps(restorationStepsStr);

  const { materials: materialsUsed, errors: materialErrors } = parseMaterialsUsed(materialsUsedStr, generateId);
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
};

export const detectMaterialUnitConflicts = (preview: PreviewRow[]): PreviewRow[] => {
  const allMaterials: Map<string, Set<string>> = new Map();
  preview.forEach(row => {
    row.materialsUsed.forEach(mat => {
      if (!allMaterials.has(mat.name)) {
        allMaterials.set(mat.name, new Set());
      }
      allMaterials.get(mat.name)!.add(mat.unit);
    });
  });

  return preview.map(row => {
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
};

export const markDuplicateRows = (preview: PreviewRow[], rowKeys: Map<string, number[]>): PreviewRow[] => {
  return preview.map((row, idx) => {
    const key = `${row.bookTitle.trim()}-${row.volumeCount}`;
    const dupRows = rowKeys.get(key);
    if (dupRows && dupRows.length > 1) {
      return {
        ...row,
        isDuplicate: true,
        duplicateWith: dupRows.filter((_, i) => i !== dupRows.indexOf(idx)),
      };
    }
    return row;
  });
};
