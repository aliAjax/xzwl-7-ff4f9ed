import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseCSV,
  matchColumn,
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
  type PreviewRow,
} from './batchImportUtils';

const mockGenerateId = vi.fn(() => 'test-id');

describe('batchImportUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseCSV', () => {
    it('应正确解析基本CSV格式', () => {
      const csv = '书名,册数,破损类型\n永乐大典,5,虫蛀、脱页\n四库全书,12,霉斑、水渍';
      const result = parseCSV(csv);
      expect(result.length).toBe(3);
      expect(result[0]).toEqual(['书名', '册数', '破损类型']);
      expect(result[1]).toEqual(['永乐大典', '5', '虫蛀、脱页']);
      expect(result[2]).toEqual(['四库全书', '12', '霉斑、水渍']);
    });

    it('应正确处理制表符分隔', () => {
      const csv = '书名\t册数\t破损类型\n永乐大典\t5\t虫蛀';
      const result = parseCSV(csv);
      expect(result.length).toBe(2);
      expect(result[0]).toEqual(['书名', '册数', '破损类型']);
    });

    it('应正确处理带引号的字段', () => {
      const csv = '书名,描述\n"永乐大典","珍贵古籍,明代版本"\n"四库全书","清代官修"';
      const result = parseCSV(csv);
      expect(result.length).toBe(3);
      expect(result[1]).toEqual(['永乐大典', '珍贵古籍,明代版本']);
      expect(result[2]).toEqual(['四库全书', '清代官修']);
    });

    it('应正确处理转义引号', () => {
      const csv = '书名,备注\n"古籍","称""珍本"""';
      const result = parseCSV(csv);
      expect(result[1]).toEqual(['古籍', '称"珍本"']);
    });

    it('应忽略空行', () => {
      const csv = '书名,册数\n\n永乐大典,5\n\n四库全书,12\n';
      const result = parseCSV(csv);
      expect(result.length).toBe(3);
    });

    it('空内容应返回空数组', () => {
      expect(parseCSV('')).toEqual([]);
      expect(parseCSV('   \n\n  ')).toEqual([]);
    });

    it('应处理Windows风格换行符', () => {
      const csv = '书名,册数\r\n永乐大典,5\r\n四库全书,12';
      const result = parseCSV(csv);
      expect(result.length).toBe(3);
    });
  });

  describe('matchColumn', () => {
    it('应正确匹配中文列名', () => {
      expect(matchColumn('书名')).toBe('bookTitle');
      expect(matchColumn('册数')).toBe('volumeCount');
      expect(matchColumn('破损类型')).toBe('damageTypes');
      expect(matchColumn('交付日期')).toBe('deliveryDate');
      expect(matchColumn('材料用量')).toBe('materialsUsed');
      expect(matchColumn('优先级')).toBe('priority');
      expect(matchColumn('状态')).toBe('status');
    });

    it('应正确匹配英文列名', () => {
      expect(matchColumn('book')).toBe('bookTitle');
      expect(matchColumn('title')).toBe('bookTitle');
      expect(matchColumn('count')).toBe('volumeCount');
      expect(matchColumn('damage')).toBe('damageTypes');
      expect(matchColumn('delivery')).toBe('deliveryDate');
      expect(matchColumn('materials')).toBe('materialsUsed');
      expect(matchColumn('priority')).toBe('priority');
      expect(matchColumn('status')).toBe('status');
    });

    it('应正确匹配别名', () => {
      expect(matchColumn('图书名称')).toBe('bookTitle');
      expect(matchColumn('数量')).toBe('volumeCount');
      expect(matchColumn('截止日期')).toBe('deliveryDate');
      expect(matchColumn('备注')).toBe('notes');
      expect(matchColumn('修复步骤')).toBe('restorationSteps');
      expect(matchColumn('紧急程度')).toBe('priority');
    });

    it('不匹配的列名应返回null', () => {
      expect(matchColumn('未知字段')).toBeNull();
      expect(matchColumn('xxx')).toBeNull();
    });

    it('应忽略大小写和空格', () => {
      expect(matchColumn('  BOOK  ')).toBe('bookTitle');
      expect(matchColumn('书名 ')).toBe('bookTitle');
    });
  });

  describe('detectColumnOrder', () => {
    it('应正确检测列顺序', () => {
      const headers = ['书名', '册数', '破损类型', '交付日期'];
      const order = detectColumnOrder(headers);
      expect(order.bookTitle).toBe(0);
      expect(order.volumeCount).toBe(1);
      expect(order.damageTypes).toBe(2);
      expect(order.deliveryDate).toBe(3);
    });

    it('应正确处理任意列顺序', () => {
      const headers = ['交付日期', '书名', '优先级', '册数'];
      const order = detectColumnOrder(headers);
      expect(order.deliveryDate).toBe(0);
      expect(order.bookTitle).toBe(1);
      expect(order.priority).toBe(2);
      expect(order.volumeCount).toBe(3);
    });

    it('应忽略无法识别的列', () => {
      const headers = ['书名', '未知列', '册数', '另一列'];
      const order = detectColumnOrder(headers);
      expect(order.bookTitle).toBe(0);
      expect(order.volumeCount).toBe(2);
      expect(Object.keys(order).length).toBe(2);
    });
  });

  describe('parseDamageTypes', () => {
    it('应正确解析顿号分隔的类型', () => {
      expect(parseDamageTypes('虫蛀、脱页、酸化')).toEqual(['虫蛀', '脱页', '酸化']);
    });

    it('应正确解析逗号分隔的类型', () => {
      expect(parseDamageTypes('虫蛀,脱页,酸化')).toEqual(['虫蛀', '脱页', '酸化']);
    });

    it('应正确解析空格分隔的类型', () => {
      expect(parseDamageTypes('虫蛀 脱页 酸化')).toEqual(['虫蛀', '脱页', '酸化']);
    });

    it('应正确解析混合分隔符', () => {
      expect(parseDamageTypes('虫蛀，脱页;酸化')).toEqual(['虫蛀', '脱页', '酸化']);
    });

    it('空内容应返回空数组', () => {
      expect(parseDamageTypes('')).toEqual([]);
      expect(parseDamageTypes('   ')).toEqual([]);
    });

    it('单个类型应返回单元素数组', () => {
      expect(parseDamageTypes('虫蛀')).toEqual(['虫蛀']);
    });

    it('应修剪空格', () => {
      expect(parseDamageTypes(' 虫蛀 , 脱页 ')).toEqual(['虫蛀', '脱页']);
    });
  });

  describe('parseRestorationSteps', () => {
    it('应正确解析顿号分隔的步骤', () => {
      expect(parseRestorationSteps('检查评估、清理除尘、脱酸处理')).toEqual(['检查评估', '清理除尘', '脱酸处理']);
    });

    it('空内容应返回空数组', () => {
      expect(parseRestorationSteps('')).toEqual([]);
    });

    it('应修剪空格', () => {
      expect(parseRestorationSteps(' 检查评估 , 清理除尘 ')).toEqual(['检查评估', '清理除尘']);
    });
  });

  describe('parseMaterialsUsed', () => {
    it('应正确解析标准格式材料', () => {
      const result = parseMaterialsUsed('修复纸:50张; 浆糊:200克', mockGenerateId);
      expect(result.materials.length).toBe(2);
      expect(result.materials[0]).toMatchObject({
        name: '修复纸',
        quantity: '50',
        unit: '张',
      });
      expect(result.materials[1]).toMatchObject({
        name: '浆糊',
        quantity: '200',
        unit: '克',
      });
      expect(result.errors.length).toBe(0);
    });

    it('应正确解析带备注的材料', () => {
      const result = parseMaterialsUsed('修复纸:50张 安徽宣纸; 浆糊:200克', mockGenerateId);
      expect(result.materials[0]).toMatchObject({
        name: '修复纸',
        quantity: '50',
        unit: '张',
        notes: '安徽宣纸',
      });
    });

    it('应正确解析全角冒号', () => {
      const result = parseMaterialsUsed('修复纸：50张', mockGenerateId);
      expect(result.materials[0]).toMatchObject({
        name: '修复纸',
        quantity: '50',
        unit: '张',
      });
    });

    it('缺少单位时应返回错误', () => {
      const result = parseMaterialsUsed('修复纸:50', mockGenerateId);
      expect(result.errors).toContain('材料"修复纸"缺少单位');
    });

    it('格式无法解析时应返回错误', () => {
      const result = parseMaterialsUsed('只有一个词无法解析', mockGenerateId);
      expect(result.errors).toContain('材料格式无法解析: "只有一个词无法解析"，正确格式：材料名:数量单位，如"修复纸:50张"');
    });

    it('简单格式（名称+单位）应解析为数量0', () => {
      const result = parseMaterialsUsed('修复纸 张', mockGenerateId);
      expect(result.materials[0]).toMatchObject({
        name: '修复纸',
        quantity: '0',
        unit: '张',
      });
    });

    it('空内容应返回空数组', () => {
      const result = parseMaterialsUsed('', mockGenerateId);
      expect(result.materials).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('应处理多行材料', () => {
      const result = parseMaterialsUsed('修复纸:50张\n浆糊:200克', mockGenerateId);
      expect(result.materials.length).toBe(2);
    });

    it('应处理小数数量', () => {
      const result = parseMaterialsUsed('修复纸:1.5张', mockGenerateId);
      expect(result.materials[0]).toMatchObject({
        name: '修复纸',
        quantity: '1.5',
        unit: '张',
      });
    });
  });

  describe('parsePriority', () => {
    it('应正确解析中文优先级', () => {
      expect(parsePriority('紧急')).toBe('high');
      expect(parsePriority('高')).toBe('high');
      expect(parsePriority('普通')).toBe('medium');
      expect(parsePriority('中')).toBe('medium');
      expect(parsePriority('低优')).toBe('low');
      expect(parsePriority('低')).toBe('low');
    });

    it('应正确解析英文优先级', () => {
      expect(parsePriority('high')).toBe('high');
      expect(parsePriority('HIGH')).toBe('high');
      expect(parsePriority('medium')).toBe('medium');
      expect(parsePriority('low')).toBe('low');
    });

    it('空内容应返回medium', () => {
      expect(parsePriority('')).toBe('medium');
      expect(parsePriority('  ')).toBe('medium');
    });

    it('未知值应返回medium', () => {
      expect(parsePriority('unknown')).toBe('medium');
    });
  });

  describe('parseStatus', () => {
    it('应正确解析中文状态', () => {
      expect(parseStatus('待评估')).toBe('pending');
      expect(parseStatus('未开始')).toBe('pending');
      expect(parseStatus('修复中')).toBe('restoring');
      expect(parseStatus('进行中')).toBe('restoring');
      expect(parseStatus('待晾干')).toBe('drying');
      expect(parseStatus('待装订')).toBe('binding');
      expect(parseStatus('已交付')).toBe('delivered');
      expect(parseStatus('已完成')).toBe('delivered');
    });

    it('应正确解析英文状态', () => {
      expect(parseStatus('pending')).toBe('pending');
      expect(parseStatus('restoring')).toBe('restoring');
      expect(parseStatus('drying')).toBe('drying');
      expect(parseStatus('binding')).toBe('binding');
      expect(parseStatus('delivered')).toBe('delivered');
    });

    it('空内容应返回pending', () => {
      expect(parseStatus('')).toBe('pending');
    });

    it('未知值应返回pending', () => {
      expect(parseStatus('unknown')).toBe('pending');
    });
  });

  describe('validateDate', () => {
    it('应验证正确的YYYY-MM-DD格式', () => {
      expect(validateDate('2024-01-15')).toBe(true);
      expect(validateDate('2024-12-31')).toBe(true);
      expect(validateDate('2020-02-29')).toBe(true);
    });

    it('应拒绝无效格式', () => {
      expect(validateDate('2024/01/15')).toBe(false);
      expect(validateDate('01-15-2024')).toBe(false);
      expect(validateDate('2024-1-15')).toBe(false);
      expect(validateDate('2024-13-01')).toBe(false);
      expect(validateDate('2024-01-32')).toBe(false);
    });

    it('空内容应返回false', () => {
      expect(validateDate('')).toBe(false);
    });

    it('应拒绝无效日期', () => {
      expect(validateDate('2024-02-30')).toBe(false);
      expect(validateDate('2024-04-31')).toBe(false);
    });
  });

  describe('formatDateForImport', () => {
    it('标准格式应直接返回', () => {
      expect(formatDateForImport('2024-01-15')).toBe('2024-01-15');
    });

    it('应转换斜杠格式', () => {
      expect(formatDateForImport('2024/01/15')).toBe('2024-01-15');
    });

    it('应转换中文日期格式', () => {
      expect(formatDateForImport('2024年1月15日')).toBe('2024-01-15');
      expect(formatDateForImport('2024年01月15号')).toBe('2024-01-15');
    });

    it('应转换纯数字格式', () => {
      expect(formatDateForImport('20240115')).toBe('2024-01-15');
    });

    it('应补零月份和日期', () => {
      expect(formatDateForImport('2024/1/5')).toBe('2024-01-05');
    });

    it('无效格式应原样返回', () => {
      expect(formatDateForImport('invalid')).toBe('invalid');
    });
  });

  describe('isDatePast', () => {
    it('应正确判断过去日期', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const pastStr = pastDate.toISOString().split('T')[0];
      expect(isDatePast(pastStr)).toBe(true);
    });

    it('应正确判断未来日期', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const futureStr = futureDate.toISOString().split('T')[0];
      expect(isDatePast(futureStr)).toBe(false);
    });

    it('今天应不被视为过去', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(isDatePast(today)).toBe(false);
    });

    it('无效日期应返回false', () => {
      expect(isDatePast('invalid')).toBe(false);
    });
  });

  describe('hasHeaderRow', () => {
    it('检测到表头应返回true', () => {
      const rows = [
        ['书名', '册数', '破损类型'],
        ['永乐大典', '5', '虫蛀'],
      ];
      expect(hasHeaderRow(rows)).toBe(true);
    });

    it('未检测到表头应返回false', () => {
      const rows = [
        ['永乐大典', '5', '虫蛀'],
        ['四库全书', '12', '霉斑'],
      ];
      expect(hasHeaderRow(rows)).toBe(false);
    });

    it('空数据应返回false', () => {
      expect(hasHeaderRow([])).toBe(false);
    });
  });

  describe('getDefaultColumnOrder', () => {
    it('应返回默认列顺序', () => {
      const order = getDefaultColumnOrder();
      expect(order.bookTitle).toBe(0);
      expect(order.volumeCount).toBe(1);
      expect(order.damageTypes).toBe(2);
      expect(order.deliveryDate).toBe(3);
      expect(order.notes).toBe(4);
      expect(order.description).toBe(5);
      expect(order.restorationSteps).toBe(6);
      expect(order.materialsUsed).toBe(7);
      expect(order.priority).toBe(8);
      expect(order.status).toBe(9);
    });
  });

  describe('validateAndParseRow', () => {
    const defaultOrder = getDefaultColumnOrder();
    const existingKeys = new Set<string>();
    const rowKeys = new Map<string, number[]>();

    beforeEach(() => {
      existingKeys.clear();
      rowKeys.clear();
    });

    it('应正确解析有效行', () => {
      const row = ['永乐大典', '5', '虫蛀、脱页', '2024-08-15', '', '', '检查评估、修复', '修复纸:50张', '紧急', '待评估'];
      const result = validateAndParseRow(row, defaultOrder, existingKeys, rowKeys, 0, mockGenerateId);

      expect(result.bookTitle).toBe('永乐大典');
      expect(result.volumeCount).toBe(5);
      expect(result.damageTypes).toEqual(['虫蛀', '脱页']);
      expect(result.deliveryDate).toBe('2024-08-15');
      expect(result.priority).toBe('high');
      expect(result.status).toBe('pending');
      expect(result.errors.length).toBe(0);
    });

    it('书名为空应报错', () => {
      const row = ['', '5', '虫蛀', '2024-08-15', '', '', '', '', '', ''];
      const result = validateAndParseRow(row, defaultOrder, existingKeys, rowKeys, 0, mockGenerateId);
      expect(result.errors).toContain('书名为空');
    });

    it('册数无效应报错', () => {
      const row = ['永乐大典', 'abc', '虫蛀', '2024-08-15', '', '', '', '', '', ''];
      const result = validateAndParseRow(row, defaultOrder, existingKeys, rowKeys, 0, mockGenerateId);
      expect(result.errors).toContain('册数"abc"无效，需为正整数');
    });

    it('册数为空应使用默认值并警告', () => {
      const row = ['永乐大典', '', '虫蛀', '2024-08-15', '', '', '', '', '', ''];
      const result = validateAndParseRow(row, defaultOrder, existingKeys, rowKeys, 0, mockGenerateId);
      expect(result.volumeCount).toBe(1);
      expect(result.warnings).toContain('册数为空，默认设为1');
    });

    it('无效破损类型应报错', () => {
      const row = ['永乐大典', '5', '未知类型', '2024-08-15', '', '', '', '', '', ''];
      const result = validateAndParseRow(row, defaultOrder, existingKeys, rowKeys, 0, mockGenerateId);
      expect(result.errors).toContain('破损类型"未知类型"不是合法的破损类型');
    });

    it('破损类型为空应警告', () => {
      const row = ['永乐大典', '5', '', '2024-08-15', '', '', '', '', '', ''];
      const result = validateAndParseRow(row, defaultOrder, existingKeys, rowKeys, 0, mockGenerateId);
      expect(result.warnings).toContain('破损类型为空');
    });

    it('无效日期格式应报错', () => {
      const row = ['永乐大典', '5', '虫蛀', 'invalid', '', '', '', '', '', ''];
      const result = validateAndParseRow(row, defaultOrder, existingKeys, rowKeys, 0, mockGenerateId);
      expect(result.errors).toContain('交付日期"invalid"格式无效，需为YYYY-MM-DD格式');
    });

    it('已过期日期应警告', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      const row = ['永乐大典', '5', '虫蛀', dateStr, '', '', '', '', '', ''];
      const result = validateAndParseRow(row, defaultOrder, existingKeys, rowKeys, 0, mockGenerateId);
      expect(result.warnings).toContain(`交付日期"${dateStr}"已过期`);
    });

    it('日期为空应使用默认值并警告', () => {
      const row = ['永乐大典', '5', '虫蛀', '', '', '', '', '', '', ''];
      const result = validateAndParseRow(row, defaultOrder, existingKeys, rowKeys, 0, mockGenerateId);
      expect(result.deliveryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.warnings.some(w => w.includes('交付日期为空'))).toBe(true);
    });

    it('已存在项目应标记为重复并警告', () => {
      existingKeys.add('永乐大典-5');
      const row = ['永乐大典', '5', '虫蛀', '2024-08-15', '', '', '', '', '', ''];
      const result = validateAndParseRow(row, defaultOrder, existingKeys, rowKeys, 0, mockGenerateId);
      expect(result.isDuplicate).toBe(true);
      expect(result.warnings.some(w => w.includes('已存在于数据库中'))).toBe(true);
    });

    it('同批导入重复项目应标记并警告', () => {
      const row1 = ['永乐大典', '5', '虫蛀', '2024-08-15', '', '', '', '', '', ''];
      const row2 = ['永乐大典', '5', '霉斑', '2024-09-01', '', '', '', '', '', ''];

      validateAndParseRow(row1, defaultOrder, existingKeys, rowKeys, 0, mockGenerateId);
      const result2 = validateAndParseRow(row2, defaultOrder, existingKeys, rowKeys, 1, mockGenerateId);

      expect(result2.isDuplicate).toBe(true);
      expect(result2.warnings.some(w => w.includes('与第1行的项目重复'))).toBe(true);
    });

    it('状态为已交付应警告', () => {
      const row = ['永乐大典', '5', '虫蛀', '2024-08-15', '', '', '', '', '', '已交付'];
      const result = validateAndParseRow(row, defaultOrder, existingKeys, rowKeys, 0, mockGenerateId);
      expect(result.warnings).toContain('初始状态设为"已交付"，建议确认');
    });
  });

  describe('detectMaterialUnitConflicts', () => {
    it('相同材料不同单位应检测到冲突', () => {
      const preview: PreviewRow[] = [
        {
          bookTitle: '古籍A',
          volumeCount: 1,
          damageTypes: [],
          deliveryDate: '2024-08-15',
          notes: '',
          description: '',
          restorationSteps: [],
          materialsUsed: [{ id: '1', name: '浆糊', quantity: '200', unit: '克' }],
          priority: 'medium',
          status: 'pending',
          errors: [],
          warnings: [],
          isDuplicate: false,
        },
        {
          bookTitle: '古籍B',
          volumeCount: 1,
          damageTypes: [],
          deliveryDate: '2024-08-15',
          notes: '',
          description: '',
          restorationSteps: [],
          materialsUsed: [{ id: '2', name: '浆糊', quantity: '2', unit: '瓶' }],
          priority: 'medium',
          status: 'pending',
          errors: [],
          warnings: [],
          isDuplicate: false,
        },
      ];

      const result = detectMaterialUnitConflicts(preview);
      expect(result[0].errors.some(e => e.includes('单位不一致'))).toBe(true);
      expect(result[1].errors.some(e => e.includes('单位不一致'))).toBe(true);
    });

    it('相同材料相同单位不应检测到冲突', () => {
      const preview: PreviewRow[] = [
        {
          bookTitle: '古籍A',
          volumeCount: 1,
          damageTypes: [],
          deliveryDate: '2024-08-15',
          notes: '',
          description: '',
          restorationSteps: [],
          materialsUsed: [{ id: '1', name: '修复纸', quantity: '50', unit: '张' }],
          priority: 'medium',
          status: 'pending',
          errors: [],
          warnings: [],
          isDuplicate: false,
        },
        {
          bookTitle: '古籍B',
          volumeCount: 1,
          damageTypes: [],
          deliveryDate: '2024-08-15',
          notes: '',
          description: '',
          restorationSteps: [],
          materialsUsed: [{ id: '2', name: '修复纸', quantity: '100', unit: '张' }],
          priority: 'medium',
          status: 'pending',
          errors: [],
          warnings: [],
          isDuplicate: false,
        },
      ];

      const result = detectMaterialUnitConflicts(preview);
      expect(result[0].errors.some(e => e.includes('单位不一致'))).toBe(false);
      expect(result[1].errors.some(e => e.includes('单位不一致'))).toBe(false);
    });
  });

  describe('markDuplicateRows', () => {
    it('应标记重复行并设置duplicateWith', () => {
      const rowKeys = new Map<string, number[]>([
        ['永乐大典-5', [0, 2]],
      ]);

      const preview: PreviewRow[] = [
        {
          bookTitle: '永乐大典',
          volumeCount: 5,
          damageTypes: [],
          deliveryDate: '2024-08-15',
          notes: '',
          description: '',
          restorationSteps: [],
          materialsUsed: [],
          priority: 'medium',
          status: 'pending',
          errors: [],
          warnings: [],
          isDuplicate: false,
        },
        {
          bookTitle: '其他古籍',
          volumeCount: 1,
          damageTypes: [],
          deliveryDate: '2024-08-15',
          notes: '',
          description: '',
          restorationSteps: [],
          materialsUsed: [],
          priority: 'medium',
          status: 'pending',
          errors: [],
          warnings: [],
          isDuplicate: false,
        },
        {
          bookTitle: '永乐大典',
          volumeCount: 5,
          damageTypes: [],
          deliveryDate: '2024-09-01',
          notes: '',
          description: '',
          restorationSteps: [],
          materialsUsed: [],
          priority: 'medium',
          status: 'pending',
          errors: [],
          warnings: [],
          isDuplicate: false,
        },
      ];

      const result = markDuplicateRows(preview, rowKeys);
      expect(result[0].isDuplicate).toBe(true);
      expect(result[0].duplicateWith).toEqual([2]);
      expect(result[1].isDuplicate).toBe(false);
      expect(result[2].isDuplicate).toBe(true);
      expect(result[2].duplicateWith).toEqual([0]);
    });
  });
});
