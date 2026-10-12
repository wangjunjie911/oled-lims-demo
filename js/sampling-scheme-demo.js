/**
 * 抽样方案 Demo：规则族预填、条件规则表校验、分段命中计算、规则描述生成
 * 口径对齐 OLED_PC/基础数据/检验资料/抽样方案.md V1.6
 */
(function (global) {
  'use strict';

  var REPORT_TYPES = ['采购来料检', '生产物料检', '客户回收料'];

  var FAMILY_PRESETS = {
    solid: {
      key: 'solid',
      label: '固体 / 液体原料',
      type: '抽检',
      mode: 'conditional',
      rows: [
        { rangeLeft: 1, rangeRight: 3, ratioType: 'formula', formula: 'n', percent: null, rounding: '进一法' },
        { rangeLeft: 4, rangeRight: null, ratioType: 'formula', formula: 'ceil(sqrt(n)+1)', percent: null, rounding: '进一法' }
      ]
    },
    liquid: {
      key: 'liquid',
      label: '固体 / 液体原料',
      type: '抽检',
      mode: 'conditional',
      rows: [
        { rangeLeft: 1, rangeRight: 3, ratioType: 'formula', formula: 'n', percent: null, rounding: '进一法' },
        { rangeLeft: 4, rangeRight: null, ratioType: 'formula', formula: 'ceil(sqrt(n)+1)', percent: null, rounding: '进一法' }
      ]
    },
    recycle: {
      key: 'recycle',
      label: '回收料 / 溶剂',
      type: '抽检',
      mode: 'conditional',
      rows: [
        { rangeLeft: 1, rangeRight: null, ratioType: 'percent', formula: '', percent: 10, rounding: '进一法' }
      ],
      mergePacks: 10
    },
    tank: {
      key: 'tank',
      label: '罐车',
      type: '抽检',
      mode: 'conditional',
      /* 业务固定上中下 3 点；用常量 3，避免 min(n,3) 在 n=1 时得 1 */
      rows: [
        { rangeLeft: 1, rangeRight: null, ratioType: 'formula', formula: '3', percent: null, rounding: '进一法' }
      ]
    },
    pack: {
      key: 'pack',
      label: '封装',
      type: '抽检',
      mode: 'conditional',
      rows: [
        { rangeLeft: 1, rangeRight: null, ratioType: 'formula', formula: 'n + 1', percent: null, rounding: '进一法' }
      ]
    },
    pdl: {
      key: 'pdl',
      label: 'PDL',
      type: '混样检',
      mode: 'mix',
      mix: { m: 1, rounding: '进一法', fullMix: true, note: '全混：执行态 m = n，仅送 1 样' }
    }
  };

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function ceil1(x) {
    if (!Number.isFinite(x)) return null;
    if (x < 0) return null;
    var base = Math.trunc(x);
    return (x - base) > 1e-10 ? base + 1 : base;
  }

  function floor1(x) {
    if (!Number.isFinite(x) || x < 0) return null;
    return Math.floor(x + 1e-12);
  }

  function applyRound(x, mode) {
    return mode === '舍位法' ? floor1(x) : ceil1(x);
  }

  function inferFamily(matText, typeHint) {
    var s = String(matText || '') + ' ' + String(typeHint || '');
    if (/PDL/i.test(s)) return 'pdl';
    if (/罐车|tank/i.test(s)) return 'tank';
    if (/封装|结构件/i.test(s)) return 'pack';
    if (/回收|溶剂|NMP|recycle|solvent/i.test(s)) return 'recycle';
    if (/液体|氨|气|液/i.test(s)) return 'liquid';
    return 'solid';
  }

  function familyOfKey(key) {
    return FAMILY_PRESETS[key] || FAMILY_PRESETS.solid;
  }

  function presetConfig(familyKey) {
    var f = familyOfKey(familyKey);
    if (f.mode === 'mix') {
      return { mode: 'mix', mix: clone(f.mix || { m: 10, rounding: '进一法' }), rows: [], mergePacks: null };
    }
    return {
      mode: 'conditional',
      rows: clone(f.rows || []),
      mix: null,
      mergePacks: f.mergePacks || null
    };
  }

  function newRuleRow(prev) {
    var left = 1;
    if (prev && prev.rangeRight != null && Number.isFinite(Number(prev.rangeRight))) {
      left = Number(prev.rangeRight) + 1;
    } else if (prev && prev.rangeLeft != null) {
      left = Number(prev.rangeLeft) + 1;
    }
    return {
      rangeLeft: left,
      rangeRight: null,
      ratioType: 'percent',
      percent: 10,
      formula: '',
      rounding: '进一法'
    };
  }

  function rangeText(left, right) {
    return left + '~' + (right == null || right === '' ? '∞' : right);
  }

  function exprText(row) {
    if (!row) return '';
    if (row.ratioType === 'percent') return (row.percent != null ? row.percent : '?') + '% × n';
    return row.formula || '';
  }

  function buildRuleDesc(sampleType, cfg) {
    var t = String(sampleType || '');
    if (t === '全检') return '全检：报检件数全部检验';
    if (t === '免检') return '免检放行，不生成样品';
    if (t === '混样检') {
      var mix = (cfg && cfg.mix) || {};
      if (mix.fullMix) return '混样后仅送 1 个样品';
      return '取样数 = n ÷ M（M=' + (mix.m != null ? mix.m : '?') + '），' + (mix.rounding || '进一法');
    }
    var rows = (cfg && cfg.rows) || [];
    if (!rows.length) return '分段规则：未配置';
    var parts = rows.map(function (r) {
      return rangeText(r.rangeLeft, r.rangeRight) + '（' + exprText(r) + '，' + (r.rounding || '进一法') + '）';
    });
    return '分段规则：' + parts.join('；');
  }

  function validateRuleRows(rows) {
    var list = rows || [];
    if (!list.length) return { ok: false, msg: '请至少配置一条取样规则' };
    if (list.length > 20) return { ok: false, msg: '取样规则最多 20 行' };
    if (Number(list[0].rangeLeft) !== 1) return { ok: false, msg: '首行起始值必须为 1' };
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var L = Number(r.rangeLeft);
      var R = r.rangeRight == null || r.rangeRight === '' ? null : Number(r.rangeRight);
      if (!Number.isInteger(L) || L < 1) return { ok: false, msg: '第 ' + (i + 1) + ' 行：左边界须为正整数' };
      if (R != null && (!Number.isInteger(R) || R <= L)) return { ok: false, msg: '第 ' + (i + 1) + ' 行：右边界需大于左边界' };
      if (R == null && i !== list.length - 1) return { ok: false, msg: '仅最后一行可为 ∞' };
      if (r.ratioType === 'percent') {
        var p = Number(r.percent);
        if (!(p > 0 && p <= 100)) return { ok: false, msg: '第 ' + (i + 1) + ' 行：比例需大于 0 且不超过 100' };
      } else {
        var fe = validateFormula(r.formula);
        if (!fe.ok) return { ok: false, msg: '第 ' + (i + 1) + ' 行：' + fe.msg };
      }
      if (i > 0) {
        var prev = list[i - 1];
        var prevR = prev.rangeRight == null || prev.rangeRight === '' ? null : Number(prev.rangeRight);
        if (prevR == null) return { ok: false, msg: '非末行不可为 ∞，区间需连续' };
        if (prevR + 1 !== L) return { ok: false, msg: '区间需连续（第 ' + i + ' 行右边界 +1 = 第 ' + (i + 1) + ' 行左边界）' };
      }
    }
    return { ok: true };
  }

  function validateFormula(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return { ok: false, msg: '请填写高级公式' };
    if (s.length > 100) return { ok: false, msg: '公式长度不能超过 100' };
    s = s.replace(/√/g, 'sqrt');
    if (!/^[0-9nsqrtceilofm+\-*/().,\s]+$/i.test(s)) return { ok: false, msg: '公式包含非法字符' };
    try {
      evalFormula(s, 9);
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: '公式语法错误' };
    }
  }

  function evalFormula(expr, n) {
    var s = String(expr || '').trim().replace(/√/g, 'sqrt');
    if (!/^[0-9nsqrtceilofm+\-*/().,\s]+$/i.test(s)) throw new Error('illegal');
    var fn = new Function(
      'n', 'sqrt', 'ceil', 'floor', 'min', 'max',
      'return (' + s + ');'
    );
    var v = fn(
      n,
      Math.sqrt,
      function (x) { return ceil1(Number(x)); },
      function (x) { return floor1(Number(x)); },
      Math.min,
      Math.max
    );
    if (!Number.isFinite(v)) throw new Error('nan');
    return v;
  }

  function hitRow(rows, n) {
    for (var i = 0; i < (rows || []).length; i++) {
      var r = rows[i];
      var L = Number(r.rangeLeft);
      var R = r.rangeRight == null || r.rangeRight === '' ? Infinity : Number(r.rangeRight);
      if (n >= L && n <= R) return { row: r, index: i };
    }
    return null;
  }

  function allocateMerge(n, count, packSize) {
    if (!count || count < 1) return [];
    var size = packSize || 10;
    var arr = [];
    var left = n;
    for (var i = 0; i < count; i++) {
      if (i === count - 1) arr.push(left);
      else {
        var take = Math.min(size, left - (count - i - 1));
        if (take < 1) take = 1;
        arr.push(take);
        left -= take;
      }
    }
    return arr;
  }

  function calcMix(mix, nOverride) {
    var n = nOverride != null ? Number(nOverride) : null;
    var rounding = (mix && mix.rounding) || '进一法';
    var fullMix = !!(mix && mix.fullMix);
    var m = fullMix ? n : Number(mix && mix.m);
    if (!Number.isInteger(n) || n < 1) return { ok: false, msg: '请输入试算报检件数 n（正整数）' };
    if (!Number.isInteger(m) || m < 1) return { ok: false, msg: '混样数 M 须为正整数' };
    var raw = n / m;
    var count = applyRound(raw, rounding);
    if (count == null) return { ok: false, msg: '计算结果非法' };
    return {
      ok: true,
      count: count,
      formula: fullMix ? '全混：M = n，取样数 = 1' : '取样数 = n ÷ M',
      process: n + ' ÷ ' + m + ' = ' + raw + (n < m ? '（n < M）' : ''),
      round: rounding + (Number.isInteger(raw) || Math.abs(raw - Math.trunc(raw)) <= 1e-10 ? '，结果为整数无需再取整' : (' → ' + count)),
      hit: '混样检',
      alloc: count > 0 ? allocateMerge(n, count, m) : []
    };
  }

  function calcConditional(rows, n, extra) {
    if (n > 10000) return { ok: false, msg: '包装物数量过大，请拆批后重试' };
    var hit = hitRow(rows, n);
    if (!hit) return { ok: false, msg: '报检件数未命中任何规则区间' };
    var r = hit.row;
    var raw;
    var formula;
    try {
      if (r.ratioType === 'percent') {
        raw = n * (Number(r.percent) / 100);
        formula = Number(r.percent) + '% × n';
      } else {
        raw = evalFormula(r.formula, n);
        formula = r.formula;
      }
    } catch (e) {
      return { ok: false, msg: '公式解析失败' };
    }
    var rounding = r.rounding || '进一法';
    var count = applyRound(raw, rounding);
    if (count == null) return { ok: false, msg: '计算结果非法' };
    var out = {
      ok: true,
      count: count,
      formula: formula,
      process: '命中第 ' + (hit.index + 1) + ' 行 [' + rangeText(r.rangeLeft, r.rangeRight) + '] → ' + formula + ' = ' + (typeof raw === 'number' ? (Number.isInteger(raw) ? raw : Number(raw.toFixed(4))) : raw),
      round: rounding + (Number.isInteger(raw) || Math.abs(raw - Math.trunc(raw)) <= 1e-10 ? '，结果为整数' : (' → ' + count)),
      hit: '第 ' + (hit.index + 1) + ' 行，' + rangeText(r.rangeLeft, r.rangeRight)
    };
    var mergePacks = extra && extra.mergePacks;
    if (mergePacks) {
      out.alloc = allocateMerge(n, count, mergePacks);
      out.round += '；合并分配 ' + JSON.stringify(out.alloc);
    }
    return out;
  }

  function normalizeConfig(row) {
    if (row && row.ruleConfig) {
      var cfg = clone(row.ruleConfig);
      if (cfg.mode === 'mix' && cfg.mix) {
        if (cfg.mix.fullMix == null && cfg.mix.n != null && cfg.mix.m != null && Number(cfg.mix.n) === Number(cfg.mix.m)) {
          cfg.mix.fullMix = true;
        }
        delete cfg.mix.n;
      }
      return cfg;
    }
    var key = (row && row._ruleKey) || 'solid';
    var cfg2 = presetConfig(key);
    var t = (row && row['抽样类型']) || familyOfKey(key).type;
    if (t === '全检' || t === '免检') return { mode: t === '全检' ? 'full' : 'exempt', rows: [], mix: null };
    if (t === '混样检') return cfg2.mode === 'mix' ? cfg2 : { mode: 'mix', mix: { m: 10, rounding: '进一法' }, rows: [] };
    return cfg2;
  }

  function calcScheme(row, n) {
    if (!row) return { ok: false, msg: '请选择抽样方案' };
    if (!Number.isInteger(n) || n < 1) return { ok: false, msg: '包装物总数只能是正整数，不能为 0、负数或非数字' };
    if (n > 10000) return { ok: false, msg: '包装物数量过大，请拆批后重试' };
    var t = String(row['抽样类型'] || '');
    if (t === '全检') {
      return { ok: true, count: n, formula: '样品数量 = n', process: '全检，样品数量 = ' + n, round: '无需进一', hit: '全检' };
    }
    if (t === '免检') {
      return { ok: true, count: 0, formula: '免检不生成样品', process: '免检放行', round: '—', hit: '免检' };
    }
    var cfg = normalizeConfig(row);
    if (t === '混样检' || cfg.mode === 'mix') {
      var mix = Object.assign({}, cfg.mix || {});
      /* 仅显式 fullMix（如 PDL 方案）才全混；普通混样一律 取样数 = n ÷ M */
      return calcMix(mix, n);
    }
    return calcConditional(cfg.rows || [], n, { mergePacks: cfg.mergePacks || (row._ruleKey === 'recycle' ? 10 : null) });
  }

  function materialTypeLabel(familyKey) {
    return (familyOfKey(familyKey).label) || '—';
  }

  global.SamplingSchemeDemo = {
    REPORT_TYPES: REPORT_TYPES,
    FAMILY_PRESETS: FAMILY_PRESETS,
    clone: clone,
    ceil1: ceil1,
    inferFamily: inferFamily,
    familyOfKey: familyOfKey,
    presetConfig: presetConfig,
    newRuleRow: newRuleRow,
    buildRuleDesc: buildRuleDesc,
    validateRuleRows: validateRuleRows,
    validateFormula: validateFormula,
    calcScheme: calcScheme,
    calcMix: calcMix,
    calcConditional: calcConditional,
    normalizeConfig: normalizeConfig,
    materialTypeLabel: materialTypeLabel,
    rangeText: rangeText,
    exprText: exprText
  };
})(typeof window !== 'undefined' ? window : globalThis);
