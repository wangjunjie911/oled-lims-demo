/**
 * 计量SPC（单图）Demo 辅助：Mock 分析数据 + ECharts option 生成
 * 对齐路由 measure-spc-single / API /spc/single/image/*
 */
(function (global) {
  const CHART_TABS = [
    { key: 'imr', label: 'I-MR图', dual: true, titles: ['I图', 'MR图'] },
    { key: 'xbarR', label: 'Xbar-R图', dual: true, titles: ['Xbar(R)图', 'R图'] },
    { key: 'xbarS', label: 'Xbar-S图', dual: true, titles: ['Xbar(S)图', 'S图'] },
    { key: 'scatterInterval', label: '单值区间图', dual: false, titles: ['单值区间图'] },
    { key: 'cpk', label: 'CPK分析图', dual: false, titles: ['CPK分析图'] },
    { key: 'cpkTrend', label: 'CPK趋势图', dual: false, titles: ['CPK趋势图'] },
    { key: 'passRate', label: '合格率统计图', dual: false, titles: ['合格率统计图'] },
    { key: 'pareto', label: '不合格项分布柏拉图', dual: false, titles: ['不合格项分布柏拉图'] },
  ];

  const REQUIRED_FIELDS = ['日期范围', '物料信息', '检验方案', '检验项'];
  const CTRL_REQUIRED_FIELDS = ['日期范围', '采集方案', '采集项'];

  /** 试用系统选项口径「编码/名称」→ 取名称；无斜杠则原样；数组取首项 */
  function pickLabel(v, fallback) {
    if (Array.isArray(v)) v = v.length ? v[0] : '';
    if (v == null || v === '') return fallback;
    const s = String(v).trim();
    const i = s.indexOf('/');
    return (i >= 0 ? s.slice(i + 1) : s).trim() || fallback;
  }

  /** 双侧 95% t 临界值 t_{0.025, df}，小样本不用 1.96 近似 */
  function tCrit95(df) {
    if (df <= 1) return 12.706;
    if (df === 2) return 4.303;
    if (df === 3) return 3.182;
    if (df === 4) return 2.776;
    if (df === 5) return 2.571;
    if (df < 10) return 2.306;
    if (df < 15) return 2.160;
    if (df < 20) return 2.093;
    if (df < 25) return 2.064;
    if (df < 30) return 2.045;
    if (df < 40) return 2.024;
    if (df < 60) return 2.000;
    if (df < 120) return 1.980;
    return 1.960;
  }

  function statsFromSamples(vals) {
    const n = vals.length;
    if (!n) return { n: 0, mean: 0, std: 0, ciLower: 0, ciUpper: 0 };
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    let ss = 0;
    for (let i = 0; i < n; i++) ss += (vals[i] - mean) * (vals[i] - mean);
    const std = n > 1 ? Math.sqrt(ss / (n - 1)) : 0;
    const me = tCrit95(n - 1) * (std / Math.sqrt(n));
    return { n, mean, std, ciLower: mean - me, ciUpper: mean + me };
  }

  function seededSeries(n, base, amp, seed) {
    const out = [];
    let x = seed || 7;
    for (let i = 0; i < n; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      const r = (x % 1000) / 1000;
      out.push(+(base + (r - 0.5) * amp).toFixed(3));
    }
    return out;
  }

  function ledgerPoints(query) {
    const link = global.QC_SPC_LINK;
    if (!link || !query) return [];
    if (query['采集方案'] || query['产线名称'] || query['采集项']) return [];
    return link.filterQuantPoints(query) || [];
  }

  function buildAnalysis(query, chartKey) {
    const linked = (function () {
      const pts = ledgerPoints(query);
      if (pts.length < 2) return null;
      const a = global.QC_SPC_LINK.toAnalysis(pts, query, chartKey);
      return a || null;
    })();
    if (linked) return linked;
    const isCtrl = !!(query['采集方案'] || query['产线名称'] || query['采集项']);
    const materialRaw = query['物料信息'] || query['产线名称'];
    const material = Array.isArray(materialRaw)
      ? (materialRaw.map((x) => pickLabel(x, '')).filter(Boolean).join('、') || '7N超纯氨特气精馏线')
      : pickLabel(materialRaw, '7N超纯氨特气精馏线');
    const scheme = pickLabel(query['检验方案'] || query['采集方案'], '超纯氨合成精馏采集方案');
    const itemRaw = query['检验项'] || query['采集项'];
    const item = Array.isArray(itemRaw) ? pickLabel(itemRaw[0], isCtrl ? '中控水分' : 'Si2H6') : pickLabel(itemRaw, isCtrl ? '中控水分' : 'Si2H6');
    let unit = isCtrl ? '%' : 'ppm';
    let max = 6.28, min = 5.62, usl = '6.50', lsl = '5.50', ucl = '6.20', lcl = '5.70', cl = '5.95', uwl = '6.10', lwl = '5.80', avg = '5.96', sig = '0.12', cp = '1.39', cpk = '1.42', grade = 'B';
    
    if (item.includes('纯度')) {
      unit = '%'; max = 99.99999; min = 99.99992; usl = '100.00000'; lsl = '99.99990'; ucl = '100.00000'; lcl = '99.99993'; cl = '99.99997'; uwl = '99.99999'; lwl = '99.99994'; avg = '99.99997'; sig = '0.000012'; cp = '1.85'; cpk = '1.78'; grade = 'A+';
    } else if (item.includes('水分') || item.includes('微量水分')) {
      unit = item.includes('ppb') ? 'ppb' : '%';
      if (unit === 'ppb') {
        max = 14.8; min = 5.2; usl = '20.0'; lsl = '0.0'; ucl = '15.0'; lcl = '2.0'; cl = '8.5'; uwl = '12.0'; lwl = '5.0'; avg = '8.6'; sig = '1.25'; cp = '1.72'; cpk = '1.68'; grade = 'A';
      } else {
        max = 0.068; min = 0.024; usl = '0.080'; lsl = '0.010'; ucl = '0.060'; lcl = '0.025'; cl = '0.045'; uwl = '0.055'; lwl = '0.035'; avg = '0.046'; sig = '0.006'; cp = '1.67'; cpk = '1.88'; grade = 'A';
      }
    } else if (item.includes('氧') || item.includes('微量氧') || item.includes('痕量氧')) {
      unit = 'ppb'; max = 7.5; min = 2.1; usl = '10.0'; lsl = '0.0'; ucl = '8.0'; lcl = '1.0'; cl = '4.2'; uwl = '6.5'; lwl = '2.5'; avg = '4.3'; sig = '0.78'; cp = '1.65'; cpk = '1.62'; grade = 'A';
    } else if (item.includes('一氧化碳') || item.includes('CO')) {
      unit = 'ppb'; max = 3.2; min = 0.8; usl = '5.0'; lsl = '0.0'; ucl = '3.5'; lcl = '0.5'; cl = '1.8'; uwl = '2.8'; lwl = '1.0'; avg = '1.9'; sig = '0.38'; cp = '1.90'; cpk = '1.85'; grade = 'A+';
    } else if (item.includes('压力') || item.includes('精馏塔顶压力')) {
      unit = 'kPa'; max = 168.0; min = 146.0; usl = '180.0'; lsl = '140.0'; ucl = '165.0'; lcl = '145.0'; cl = '155.0'; uwl = '162.0'; lwl = '148.0'; avg = '154.8'; sig = '2.60'; cp = '2.10'; cpk = '2.05'; grade = 'A+';
    } else if (item.includes('温度') || item.includes('精馏塔釜温度') || item.includes('脱水温度')) {
      unit = '℃'; max = 107.5; min = 98.6; usl = '115.0'; lsl = '95.0'; ucl = '108.0'; lcl = '98.0'; cl = '103.0'; uwl = '106.0'; lwl = '100.0'; avg = '103.2'; sig = '1.45'; cp = '2.22'; cpk = '2.18'; grade = 'A+';
    } else if (item === '搅拌转速') {
      unit = 'rpm'; max = 125.0; min = 115.0; usl = '130.0'; lsl = '110.0'; ucl = '125.0'; lcl = '115.0'; cl = '120.0'; uwl = '123.0'; lwl = '117.0'; avg = '120.2'; sig = '1.20'; cp = '2.78'; cpk = '2.72'; grade = 'A+';
    } else if (item === '真空度') {
      unit = 'MPa'; max = -0.085; min = -0.098; usl = '-0.080'; lsl = '-0.100'; ucl = '-0.085'; lcl = '-0.097'; cl = '-0.092'; uwl = '-0.087'; lwl = '-0.095'; avg = '-0.092'; sig = '0.002'; cp = '1.67'; cpk = '1.67'; grade = 'A';
    } else if (item === '固含量') {
      unit = '%';
    } else if (item === '电导率') {
      unit = 'μS/cm'; max = 0.085; min = 0.042; usl = '0.100'; lsl = '0.020'; ucl = '0.080'; lcl = '0.040'; cl = '0.060'; uwl = '0.075'; lwl = '0.045'; avg = '0.061'; sig = '0.008'; cp = '1.67'; cpk = '1.58'; grade = 'A';
    } else if (item === '粘度') {
      unit = 'mPa·s'; max = 1.25; min = 0.88; usl = '1.40'; lsl = '0.70'; ucl = '1.20'; lcl = '0.90'; cl = '1.05'; uwl = '1.15'; lwl = '0.95'; avg = '1.04'; sig = '0.06'; cp = '1.94'; cpk = '1.89'; grade = 'A';
    } else if (item === '氨含量') {
      unit = '%'; max = 99.92; min = 99.71; usl = '100'; lsl = 99.50; ucl = '99.95'; lcl = '99.70'; cl = '99.82'; uwl = '99.90'; lwl = '99.74'; avg = '99.83'; sig = '0.04'; cp = '1.72'; cpk = '1.65'; grade = 'A';
    }
    const base = {
      materialInfos: material,
      inspectionSchemeName: scheme,
      sampleCount: 30,
      inspectionItemName: item,
      inspectionItemUnitName: unit,
      viewTypeName: (CHART_TABS.find((t) => t.key === chartKey) || {}).label || '',
      dl: '0.01',
      max: max,
      min: min,
      uslStr: usl,
      lslStr: lsl,
      uclStr: ucl,
      lclStr: lcl,
      clStr: cl,
      uwlStr: uwl,
      lwlStr: lwl,
      averageStr: avg,
      sigmaStr: sig,
      caStr: '0.08',
      cpStr: cp,
      cpuStr: '1.50',
      cplStr: '1.28',
      cpkStr: cpk,
      cpkGrade: grade,
      ooc: 1,
      oos: 0,
      oow: 2,
      oot: 0,
    };
    if (chartKey === 'scatterInterval' || chartKey === 'scatterSingle') {
      const isHardness = item.includes('硬度');
      return {
        materialInfos: material,
        inspectionSchemeName: scheme,
        inspectionItemName: isHardness ? '硬度' : item,
        inspectionItemUnitName: isHardness ? 'HV' : unit,
        viewTypeName: '单值区间图',
        batchCount: 48,
        totalSampleCount: 1448,
        grandMean: isHardness ? '58.86' : (+avg).toFixed(2),
        overallStdDev: isHardness ? '0.84' : (+sig).toFixed(3),
        maxBatchMean: isHardness ? '60.12 (批BF1201)' : (+(+avg * 1.03)).toFixed(2),
        minBatchMean: isHardness ? '56.65 (批BD1016)' : (+(+avg * 0.97)).toFixed(2),
        rangeMean: isHardness ? '3.47' : (+(+avg * 0.06)).toFixed(2),
        pooledStdDev: isHardness ? '0.62' : (+(+sig * 0.8)).toFixed(3),
        avgCiWidth: isHardness ? '0.54' : (+(+sig * 0.55)).toFixed(3),
        outlierCount: 3,
      };
    }
    if (chartKey === 'cpk') {
      return {
        ...base,
        avePositive1sigma: '28.5%',
        avePositive2sigma: '14.2%',
        avePositive3sigma: '3.1%',
        aveNegative1sigma: '27.8%',
        aveNegative2sigma: '15.0%',
        aveNegative3sigma: '4.0%',
        aveOther: '7.4%',
      };
    }
    if (chartKey === 'cpkTrend') {
      return {
        materialInfos: material,
        inspectionSchemeName: scheme,
        sampleCount: 120,
        inspectionItemName: item,
        inspectionItemUnitName: base.inspectionItemUnitName,
        viewTypeName: 'CPK趋势图',
        max: 1.72,
        min: 0.91,
        aLevelNumber: 2,
        bLevelNumber: 5,
        cLevelNumber: 3,
        dLevelNumber: 1,
        eLevelNumber: 0,
      };
    }
    if (chartKey === 'passRate') {
      return {
        statisticsDate: (query['日期范围'] && query['日期范围'][0]) || '2026-09-01',
        materialInfos: material,
        totalNumber: 48,
        qualifiedNumber: 45,
        qualifiedRate: '93.75%',
      };
    }
    if (chartKey === 'pareto') {
      return {
        inspectionItemName: item,
        materialInfos: material,
        totalNumber: 48,
        wrongNumber: 3,
        unQualifiedRate: '6.25%',
        unQualifiedAllRate: '100%',
        unQualifiedAccumulateRate: '100%',
      };
    }
    return base;
  }

  function mrAnalysis(query) {
    const a = buildAnalysis(query, 'imr');
    return {
      materialInfos: a.materialInfos,
      inspectionSchemeName: a.inspectionSchemeName,
      sampleCount: a.sampleCount,
      inspectionItemName: a.inspectionItemName,
      inspectionItemUnitName: a.inspectionItemUnitName,
      viewTypeName: 'MR图',
      max: 0.28,
      min: 0.02,
      uclStr: '0.35',
      lclStr: '0.00',
      clStr: '0.11',
      averageStr: '0.11',
      ooc: 0,
    };
  }

  /**
   * 生成控制图 ECharts option
   * @param {string[]} categories - X轴样本编号
   * @param {number[]} values     - 检验数据序列
   * @param {string}   chartTitle - 图名（I图 / MR图 / Xbar(R)图 ...)
   * @param {object}   limits     - 各限值 {USL, LSL, UCL, LCL, UWL, LWL, CL}
   * @param {string}   itemName   - 检验项名称（用于标题和 series名）
   */
  const SPC_LINE_GROUP_DEFAULT = [
    { label: 'USL/LSL', enabled: true, color: '#FF0000', lineType: '实线', width: 1 },
    { label: 'UCL/LCL', enabled: true, color: '#FFA500', lineType: '虚线', width: 1 },
    { label: 'UWL/LWL', enabled: true, color: '#FFFF00', lineType: '虚线', width: 1 },
    { label: 'CL', enabled: true, color: '#808080', lineType: '虚线', width: 1 },
    { label: 'average', enabled: true, color: '#CCCCCC', lineType: '虚线', width: 1 },
  ];
  const SPC_LIMIT_SELECTED_DEFAULT = {
    I图: ['USL', 'LSL', 'UCL(固定)', 'LCL(固定)', 'CL'],
    MR图: ['UCL(固定)', 'LCL(固定)', 'CL'],
    XbarR图: ['UCL(固定)', 'LCL(固定)', 'CL'],
    R图: ['UCL(固定)', 'LCL(固定)', 'CL'],
    XbarS图: ['UCL(固定)', 'LCL(固定)', 'CL'],
    S图: ['UCL(固定)', 'LCL(固定)', 'CL'],
  };
  const SPC_POINT_DEFAULTS = [
    { label: '正常点', color: '#000000', size: 2 },
    { label: '不合格点', color: '#FF0000', size: 2 },
    { label: '偏差点', color: '#FFA500', size: 2 },
  ];

  function chartKindFromTitle(title) {
    const t = String(title || '');
    if (t.indexOf('Xbar') >= 0 && /S|s/.test(t)) return 'XbarS图';
    if (t.indexOf('Xbar') >= 0) return 'XbarR图';
    if (t.indexOf('MR') >= 0) return 'MR图';
    if (/-R图|R图$/.test(t) && t.indexOf('Xbar') < 0) return 'R图';
    if (/-S图|S图$/.test(t) && t.indexOf('Xbar') < 0) return 'S图';
    return 'I图';
  }

  function lineGroupOf(name) {
    if (name.indexOf('USL') >= 0 || name.indexOf('LSL') >= 0) return 'USL/LSL';
    if (name.indexOf('UWL') >= 0 || name.indexOf('LWL') >= 0) return 'UWL/LWL';
    if (name.indexOf('UCL') >= 0 || name.indexOf('LCL') >= 0) return 'UCL/LCL';
    if (name === 'Average' || name === 'average') return 'average';
    if (name === 'CL') return 'CL';
    return '';
  }

  function getLineCfg(visual, name) {
    const group = lineGroupOf(name);
    const rows = (visual && visual.lines) || SPC_LINE_GROUP_DEFAULT;
    return rows.find((r) => r.label === group) || SPC_LINE_GROUP_DEFAULT.find((r) => r.label === group) || { enabled: true, color: '#808080', lineType: '虚线', width: 1 };
  }

  function getPointCfg(visual, kind) {
    const rows = (visual && visual.points) || SPC_POINT_DEFAULTS;
    const label = kind === 'OOS' ? '不合格点' : (kind ? '偏差点' : '正常点');
    return rows.find((r) => r.label === label) || SPC_POINT_DEFAULTS.find((r) => r.label === label);
  }

  function limitSelectedOf(visual, kind) {
    const map = (visual && visual.limitSelected) || {};
    return (map[kind] && map[kind].length) ? map[kind] : (SPC_LIMIT_SELECTED_DEFAULT[kind] || []);
  }

  function tipAllows(visual, kind, field) {
    const selected = visual && visual.tips && visual.tips[kind];
    if (!selected || !selected.length) return true;
    if (field === 'UCL(计算)' || field === 'UCL(固定)' || field === 'UCL') return selected.includes('UCL');
    if (field === 'LCL(计算)' || field === 'LCL(固定)' || field === 'LCL') return selected.includes('LCL');
    return selected.includes(field);
  }

  function decPlaces(v) {
    const a = Math.abs(Number(v) || 0);
    if (a >= 100) return 1;
    if (a >= 10) return 2;
    if (a >= 1) return 3;
    return 4;
  }

  function roundLimit(v, ref) {
    if (v == null || Number.isNaN(Number(v))) return null;
    return +Number(v).toFixed(decPlaces(ref != null ? ref : v));
  }

  function computeSpreadLimits(values) {
    const n = values.length;
    if (!n) return { mean: null, sigma: null, ucl: null, lcl: null, uwl: null, lwl: null };
    const mean = values.reduce((a, b) => a + b, 0) / n;
    let mr = 0;
    for (let i = 1; i < n; i++) mr += Math.abs(values[i] - values[i - 1]);
    const sigma = n > 1 ? (mr / (n - 1)) / 1.128 : 0;
    return {
      mean: roundLimit(mean, mean),
      sigma: roundLimit(sigma, mean),
      ucl: roundLimit(mean + 3 * sigma, mean),
      lcl: roundLimit(mean - 3 * sigma, mean),
      uwl: roundLimit(mean + 2 * sigma, mean),
      lwl: roundLimit(mean - 2 * sigma, mean),
    };
  }

  function hasLimitVal(v) {
    return v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v));
  }

  function controlLineOption(categories, values, chartTitle, limits, itemName) {
    const L = limits || {};
    const visual = (typeof _activeSpcVisual !== 'undefined' && _activeSpcVisual) || {};
    const kind = chartKindFromTitle(chartTitle);
    const selected = limitSelectedOf(visual, kind);
    const calc = computeSpreadLimits(values);
    const seriesName = itemName || '检验项';
    const fullTitle = itemName ? `${itemName}-${chartTitle}` : chartTitle;
    const n = categories.length;
    const historyStep = (visual.historyTrendType || '历史变更趋势值') === '历史变更趋势值';

    const uclFixed = hasLimitVal(L.UCL) ? Number(L.UCL) : null;
    const lclFixed = hasLimitVal(L.LCL) ? Number(L.LCL) : null;
    const clFixed = hasLimitVal(L.CL) ? Number(L.CL) : calc.mean;
    const usl = hasLimitVal(L.USL) ? Number(L.USL) : null;
    const lsl = hasLimitVal(L.LSL) ? Number(L.LSL) : null;
    const uclUse = selected.includes('UCL(计算)') ? calc.ucl : uclFixed;
    const lclUse = selected.includes('LCL(计算)') ? calc.lcl : lclFixed;
    const uwl = hasLimitVal(L.UWL) ? Number(L.UWL) : calc.uwl;
    const lwl = hasLimitVal(L.LWL) ? Number(L.LWL) : calc.lwl;

    function anomalyType(v) {
      if (usl != null && v > usl) return 'OOS';
      if (lsl != null && v < lsl) return 'OOS';
      if (uclUse != null && v > uclUse) return 'OOC';
      if (lclUse != null && v < lclUse) return 'OOC';
      if (uwl != null && v > uwl) return 'OOW';
      if (lwl != null && v < lwl) return 'OOW';
      return null;
    }

    const ptNormal = getPointCfg(visual, null);
    const ptBad = getPointCfg(visual, 'OOS');
    const ptDev = getPointCfg(visual, 'OOC');
    const coloredData = values.map((v, i) => {
      const a = anomalyType(v);
      const cfg = a === 'OOS' ? ptBad : (a ? ptDev : ptNormal);
      return {
        value: v,
        name: categories[i],
        itemStyle: { color: (cfg && cfg.color) || '#000000', borderColor: '#fff', borderWidth: 1 },
      };
    });
    const symbolSize = Math.max(4, ((ptNormal && ptNormal.size) || 2) * 5);

    function allowLine(selName, groupName, value) {
      if (!hasLimitVal(value)) return false;
      if (selected.length && !selected.includes(selName)) return false;
      const cfg = getLineCfg(visual, groupName);
      return !!(cfg && cfg.enabled !== false);
    }

    function lineSeries(name, y, groupName, steppedFrom) {
      const cfg = getLineCfg(visual, groupName);
      const type = cfg.lineType === '实线' ? 'solid' : 'dashed';
      const data = (historyStep && steppedFrom != null && selIsFixed(name))
        ? categories.map((_, i) => (i < Math.floor(n * 0.55) ? steppedFrom : y))
        : Array(n).fill(y);
      return {
        name,
        type: 'line',
        data,
        symbol: 'none',
        tooltip: { show: false },
        lineStyle: { color: cfg.color, type, width: cfg.width || 1 },
        itemStyle: { color: cfg.color },
        z: 2,
      };
    }
    function selIsFixed(name) {
      return name.indexOf('固定') >= 0 || (name === 'UCL' || name === 'LCL') && selected.includes(name + '(固定)');
    }

    const lineSeriesList = [];
    if (allowLine('UCL(计算)', 'UCL(计算)', calc.ucl)) lineSeriesList.push(lineSeries('UCL(计算)', calc.ucl, 'UCL(计算)'));
    if (allowLine('LCL(计算)', 'LCL(计算)', calc.lcl)) lineSeriesList.push(lineSeries('LCL(计算)', calc.lcl, 'LCL(计算)'));
    if (allowLine('UCL(固定)', 'UCL', uclFixed)) {
      const oldU = uclFixed != null ? roundLimit(uclFixed * 0.96, uclFixed) : null;
      lineSeriesList.push(lineSeries('UCL(固定)', uclFixed, 'UCL', oldU));
    }
    if (allowLine('LCL(固定)', 'LCL', lclFixed)) {
      const oldL = lclFixed != null ? roundLimit(lclFixed * 1.04, lclFixed) : null;
      lineSeriesList.push(lineSeries('LCL(固定)', lclFixed, 'LCL', oldL));
    }
    if (kind === 'I图' && allowLine('UWL', 'UWL', uwl)) lineSeriesList.push(lineSeries('UWL', uwl, 'UWL'));
    if (kind === 'I图' && allowLine('LWL', 'LWL', lwl)) lineSeriesList.push(lineSeries('LWL', lwl, 'LWL'));
    if (allowLine('USL', 'USL', usl)) lineSeriesList.push(lineSeries('USL', usl, 'USL'));
    if (allowLine('LSL', 'LSL', lsl)) lineSeriesList.push(lineSeries('LSL', lsl, 'LSL'));
    const clVal = selected.includes('CL') ? (selected.includes('UCL(计算)') || selected.includes('LCL(计算)') ? calc.mean : clFixed) : null;
    if (allowLine('CL', 'CL', clVal)) lineSeriesList.push(lineSeries('CL', clVal, 'CL'));
    if (allowLine('Average', 'Average', calc.mean)) lineSeriesList.push(lineSeries('Average', calc.mean, 'Average'));

    const yVals = values.concat(lineSeriesList.flatMap((s) => s.data)).filter((v) => hasLimitVal(v)).map(Number);
    const ymin = yVals.length ? Math.min.apply(null, yVals) : 0;
    const ymax = yVals.length ? Math.max.apply(null, yVals) : 1;
    const pad = (ymax - ymin) * 0.12 || Math.abs(ymax) * 0.08 || 1;

    const limitTipMap = [
      { name: 'UCL(计算)', val: calc.ucl },
      { name: 'LCL(计算)', val: calc.lcl },
      { name: 'UCL(固定)', val: uclFixed },
      { name: 'LCL(固定)', val: lclFixed },
      { name: 'UWL', val: uwl },
      { name: 'LWL', val: lwl },
      { name: 'USL', val: usl },
      { name: 'LSL', val: lsl },
      { name: 'CL', val: clVal },
      { name: 'Average', val: calc.mean },
    ];

    function tooltipFormatter(params) {
      if (!params || !params.length) return '';
      const pt = params.find((p) => p.seriesName === seriesName) || params[0];
      const v = pt.value;
      const sampleId = pt.name || pt.axisValue;
      const aType = anomalyType(v);
      let html = `<div style="min-width:180px">`;
      if (tipAllows(visual, kind, '横坐标值')) html += `<div style="font-weight:600;margin-bottom:4px">${sampleId}</div>`;
      if (tipAllows(visual, kind, '样本值')) html += `<div>样本值：<b>${v}</b></div>`;
      if (tipAllows(visual, kind, '异常说明(OOC,OOS,OOT,OOW)') || tipAllows(visual, kind, '异常说明(OOC)')) {
        if (aType === 'OOS') html += `<div style="color:#FF0000;font-weight:600">OOS异常</div>`;
        if (aType === 'OOC') html += `<div style="color:#FFA500;font-weight:600">OOC异常</div>`;
        if (aType === 'OOW') html += `<div style="color:#d4b106;font-weight:600">OOW异常</div>`;
      }
      html += `<div style="margin-top:6px;border-top:1px solid #eee;padding-top:4px">`;
      limitTipMap.forEach((lm) => {
        if (!hasLimitVal(lm.val)) return;
        if (lineSeriesList.every((s) => s.name !== lm.name)) return;
        if (!tipAllows(visual, kind, lm.name)) return;
        const cfg = getLineCfg(visual, lm.name);
        html += `<div style="display:flex;justify-content:space-between;gap:16px">`
          + `<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${cfg.color};margin-right:4px"></span>${lm.name}</span>`
          + `<b>${lm.val}</b></div>`;
      });
      html += `</div></div>`;
      return html;
    }

    return {
      title: { text: fullTitle, left: 'center', top: 6, textStyle: { fontSize: 14, fontWeight: 700, color: '#1a1a2e' } },
      legend: {
        data: lineSeriesList.map((s) => s.name).concat([seriesName]),
        top: 30, left: 16, right: 80, itemWidth: 22, itemHeight: 3,
        textStyle: { fontSize: 11 },
      },
      grid: { left: 60, right: 24, top: 72, bottom: 60 },
      tooltip: { trigger: 'axis', formatter: tooltipFormatter },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { fontSize: 10, rotate: 30, interval: 0 },
        axisLine: { lineStyle: { color: '#d0d0d0' } },
      },
      yAxis: {
        type: 'value',
        name: '值',
        min: +(ymin - pad).toFixed(4),
        max: +(ymax + pad).toFixed(4),
        scale: false,
        nameTextStyle: { fontSize: 12, color: '#555' },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      dataZoom: [
        { type: 'slider', bottom: 4, height: 18, start: 0, end: 100,
          handleStyle: { color: '#4fa3f7' }, fillerColor: 'rgba(79,163,247,0.1)', borderColor: '#d0d0d0' },
        { type: 'inside' },
      ],
      series: lineSeriesList.concat([{
        name: seriesName,
        type: 'line',
        data: coloredData,
        symbolSize,
        symbol: 'circle',
        z: 5,
        lineStyle: { width: 2.5, color: '#4fa3f7' },
        itemStyle: { color: '#4fa3f7' },
      }]),
    };
  }

  let _activeSpcVisual = {};

  function buildChartOptions(chartKey, query, timeRangeType) {
    _activeSpcVisual = (query && query._spcVisual) || {};
    const ledgerPay = (function () {
      const pts = ledgerPoints(query);
      if (pts.length < 2) return null;
      return global.QC_SPC_LINK.chartPayload(pts);
    })();
    if (ledgerPay && (chartKey === 'imr' || chartKey === 'xbarR' || chartKey === 'xbarS' || chartKey === 'scatterInterval' || chartKey === 'scatterSingle' || chartKey === 'cpk' || chartKey === 'cpkTrend' || chartKey === 'passRate' || chartKey === 'pareto')) {
      const itemName = ledgerPay.itemName;
      const limits = ledgerPay.limits;
      const cats = ledgerPay.cats;
      const vals = ledgerPay.vals;
      if (chartKey === 'imr') {
        const mrUcl = Math.max.apply(null, ledgerPay.mr.concat([0])) * 1.15 || 1;
        const mrCl = ledgerPay.mr.length ? ledgerPay.mr.reduce((a, b) => a + b, 0) / ledgerPay.mr.length : 0;
        return [
          controlLineOption(cats, vals, 'I图', limits, itemName),
          controlLineOption(ledgerPay.mrCats, ledgerPay.mr, 'MR图', { UCL: +mrUcl.toFixed(6), CL: +mrCl.toFixed(6), LCL: 0 }, itemName),
        ];
      }
      if (chartKey === 'xbarR') {
        const rUcl = Math.max.apply(null, ledgerPay.r.concat([0])) * 1.15 || 1;
        const rCl = ledgerPay.r.length ? ledgerPay.r.reduce((a, b) => a + b, 0) / ledgerPay.r.length : 0;
        return [
          controlLineOption(ledgerPay.xbarCats, ledgerPay.xbar, 'Xbar(R)图', limits, itemName),
          controlLineOption(ledgerPay.xbarCats, ledgerPay.r, 'R图', { UCL: +rUcl.toFixed(6), CL: +rCl.toFixed(6), LCL: 0 }, itemName),
        ];
      }
      if (chartKey === 'xbarS') {
        const sUcl = Math.max.apply(null, ledgerPay.s.concat([0])) * 1.15 || 1;
        const sCl = ledgerPay.s.length ? ledgerPay.s.reduce((a, b) => a + b, 0) / ledgerPay.s.length : 0;
        return [
          controlLineOption(ledgerPay.xbarCats, ledgerPay.xbar, 'Xbar(S)图', limits, itemName),
          controlLineOption(ledgerPay.xbarCats, ledgerPay.s, 'S图', { UCL: +sUcl.toFixed(6), CL: +sCl.toFixed(6), LCL: 0 }, itemName),
        ];
      }
      /* 其余图种仍走下方通用渲染，但用台账序列替换伪随机 */
      query = Object.assign({}, query, { _ledgerPay: ledgerPay });
    }
    const n = (query && query._ledgerPay && query._ledgerPay.vals.length) || 20;
    const isCtrl = !!(query['采集方案'] || query['产线名称'] || query['采集项']);
    const itemName = (query && query._ledgerPay && query._ledgerPay.itemName) || pickLabel(query['检验项'] || query['采集项'], isCtrl ? '中控水分' : 'Si2H6');
    const lotPrefix = isCtrl ? 'ZK-202609' : 'YP-202609';
    const cats = (query && query._ledgerPay && query._ledgerPay.cats) || Array.from({ length: n }, (_, i) => {
      const d = String(1 + i).padStart(2, '0');
      return `${lotPrefix}${d}`;
    });

    let baseVal = 5.96, amp = 0.38;
    let limits = { USL: 6.5, UCL: 6.2, UWL: 6.1, CL: 5.95, LWL: 5.8, LCL: 5.7, LSL: 5.5 };
    if (itemName.includes('纯度')) {
      baseVal = 99.99997; amp = 0.00003;
      limits = { USL: 100.00000, UCL: 100.00000, UWL: 99.99999, CL: 99.99997, LWL: 99.99994, LCL: 99.99993, LSL: 99.99990 };
    } else if (itemName.includes('水分') || itemName.includes('微量水分')) {
      if (itemName.includes('ppb')) {
        baseVal = 8.5; amp = 2.4;
        limits = { USL: 20.0, UCL: 15.0, UWL: 12.0, CL: 8.5, LWL: 5.0, LCL: 2.0, LSL: 0.0 };
      } else {
        baseVal = 0.045; amp = 0.018;
        limits = { USL: 0.080, UCL: 0.060, UWL: 0.055, CL: 0.045, LWL: 0.035, LCL: 0.025, LSL: 0.010 };
      }
    } else if (itemName.includes('氧') || itemName.includes('微量氧') || itemName.includes('痕量氧')) {
      baseVal = 4.2; amp = 1.5;
      limits = { USL: 10.0, UCL: 8.0, UWL: 6.5, CL: 4.2, LWL: 2.5, LCL: 1.0, LSL: 0.0 };
    } else if (itemName.includes('一氧化碳') || itemName.includes('CO')) {
      baseVal = 1.8; amp = 0.7;
      limits = { USL: 5.0, UCL: 3.5, UWL: 2.8, CL: 1.8, LWL: 1.0, LCL: 0.5, LSL: 0.0 };
    } else if (itemName.includes('压力') || itemName.includes('精馏塔顶压力')) {
      baseVal = 154.8; amp = 5.2;
      limits = { USL: 180.0, UCL: 165.0, UWL: 162.0, CL: 155.0, LWL: 148.0, LCL: 145.0, LSL: 140.0 };
    } else if (itemName.includes('温度') || itemName.includes('精馏塔釜温度') || itemName.includes('脱水温度')) {
      baseVal = 103.2; amp = 2.8;
      limits = { USL: 115.0, UCL: 108.0, UWL: 106.0, CL: 103.0, LWL: 100.0, LCL: 98.0, LSL: 95.0 };
    } else if (itemName === '搅拌转速') {
      baseVal = 120.2; amp = 3.5;
      limits = { USL: 130.0, UCL: 125.0, UWL: 123.0, CL: 120.0, LWL: 117.0, LCL: 115.0, LSL: 110.0 };
    } else if (itemName === '固含量') {
      baseVal = 48.5; amp = 2.2;
      limits = { USL: 52.0, UCL: 50.5, UWL: 50.0, CL: 48.5, LWL: 47.0, LCL: 46.5, LSL: 45.0 };
    } else if (itemName === '热阻') {
      baseVal = 0.85; amp = 0.12;
      limits = { USL: 1.20, UCL: 1.05, UWL: 1.00, CL: 0.85, LWL: 0.70, LCL: 0.65, LSL: 0.50 };
    } else if (itemName === '纯度(%)' || itemName === '超纯氨纯度(%)' || itemName === '氨含量') {
      baseVal = 99.999; amp = 0.0008;
      limits = { USL: 100, UCL: 99.9996, UWL: 99.9994, CL: 99.9990, LWL: 99.9986, LCL: 99.9984, LSL: 99.990 };
    } else if (itemName === '电导率') {
      baseVal = 0.06; amp = 0.025;
      limits = { USL: 0.100, UCL: 0.080, UWL: 0.075, CL: 0.060, LWL: 0.045, LCL: 0.040, LSL: 0.020 };
    } else if (itemName === '粘度') {
      baseVal = 1.05; amp = 0.18;
      limits = { USL: 1.40, UCL: 1.20, UWL: 1.15, CL: 1.05, LWL: 0.95, LCL: 0.90, LSL: 0.70 };
    } else if (String(itemName).indexOf('水分') >= 0) {
      baseVal = 55; amp = 28;
      limits = { USL: 100, UCL: 80, UWL: 72, CL: 55, LWL: 38, LCL: 30, LSL: 0 };
    }
    if (query && query._ledgerPay && query._ledgerPay.limits) {
      limits = Object.assign({}, limits, query._ledgerPay.limits);
      if (query._ledgerPay.limits.stats) {
        baseVal = query._ledgerPay.limits.stats.mean;
        amp = query._ledgerPay.limits.stats.std * 3 || amp;
      }
    }

    const vals = (query && query._ledgerPay && query._ledgerPay.vals) || seededSeries(n, baseVal, amp, query._seed || 11);
    const mr = (query && query._ledgerPay && query._ledgerPay.mr) || seededSeries(n - 1, +(amp * 0.25).toFixed(baseVal > 10 ? 1 : (baseVal > 1 ? 2 : 5)), +(amp * 0.4).toFixed(baseVal > 10 ? 1 : (baseVal > 1 ? 2 : 5)), 19);
    const mrCats = (query && query._ledgerPay && query._ledgerPay.mrCats) || cats.slice(1);
    const mrUcl = +(amp * 0.8).toFixed(baseVal > 10 ? 1 : (baseVal > 1 ? 2 : 5));
    const mrCl = +(amp * 0.25).toFixed(baseVal > 10 ? 1 : (baseVal > 1 ? 2 : 5));

    if (chartKey === 'imr') {
      return [
        controlLineOption(cats, vals, 'I图', limits, itemName),
        controlLineOption(mrCats, mr, 'MR图', { UCL: mrUcl, CL: mrCl, LCL: 0 }, itemName),
      ];
    }
    if (chartKey === 'xbarR') {
      const xbar = seededSeries(n, baseVal, amp * 0.6, 21);
      const r = seededSeries(n, +(amp * 0.4).toFixed(3), +(amp * 0.3).toFixed(3), 23);
      return [
        controlLineOption(cats, xbar, 'Xbar(R)图', limits, itemName),
        controlLineOption(cats, r, 'R图', { UCL: +(amp * 0.8).toFixed(3), CL: +(amp * 0.4).toFixed(3), LCL: 0 }, itemName),
      ];
    }
    if (chartKey === 'xbarS') {
      const xbar = seededSeries(n, baseVal, amp * 0.5, 29);
      const s = seededSeries(n, +(amp * 0.2).toFixed(3), +(amp * 0.15).toFixed(3), 31);
      return [
        controlLineOption(cats, xbar, 'Xbar(S)图', limits, itemName),
        controlLineOption(cats, s, 'S图', { UCL: +(amp * 0.5).toFixed(3), CL: +(amp * 0.2).toFixed(3), LCL: 0 }, itemName),
      ];
    }
    if (chartKey === 'cpk') {
      const mean = baseVal, sigma = +(amp / 3).toFixed(baseVal > 10 ? 2 : (baseVal > 1 ? 3 : 6));
      const usl = limits.USL, lsl = limits.LSL, ucl = limits.UCL, lcl = limits.LCL;
      const hist = [1, 2, 4, 6, 8, 7, 5, 3, 2, 1];
      const step = +((amp * 2) / 10).toFixed(baseVal > 10 ? 2 : (baseVal > 1 ? 3 : 6));
      const bins = hist.map((_, i) => +(mean - amp + i * step).toFixed(baseVal > 10 ? 1 : (baseVal > 1 ? 2 : 5)));
      const binLabels = bins.map(b => String(b));
      // 正态分布密度 * 频率缩放
      function normal(x, m, s) { return Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI)); }
      const totalArea = hist.reduce((a, b) => a + b, 0) * 0.1; // sum * bin_width
      const normalData = bins.map(b => +(normal(b, mean, sigma) * totalArea).toFixed(3));
      const markLines = [
        { xAxis: binLabels.indexOf((usl).toFixed(1)) >= 0 ? (usl).toFixed(1) : undefined, name: 'USL', lineStyle: { type: 'dashed', color: '#F56C6C', width: 1.5 } },
        { xAxis: binLabels.indexOf((lsl).toFixed(1)) >= 0 ? (lsl).toFixed(1) : undefined, name: 'LSL', lineStyle: { type: 'dashed', color: '#F56C6C', width: 1.5 } },
        { xAxis: binLabels.indexOf((ucl).toFixed(1)) >= 0 ? (ucl).toFixed(1) : undefined, name: 'UCL', lineStyle: { type: 'dashed', color: '#E6A23C', width: 1.5 } },
        { xAxis: binLabels.indexOf((lcl).toFixed(1)) >= 0 ? (lcl).toFixed(1) : undefined, name: 'LCL', lineStyle: { type: 'dashed', color: '#E6A23C', width: 1.5 } },
        { xAxis: binLabels.indexOf((mean).toFixed(1)) >= 0 ? (mean).toFixed(1) : '6.0', name: 'Mean', lineStyle: { type: 'solid', color: '#5DE2E7', width: 2 } },
      ].filter(m => m.xAxis != null);
      return [
        {
          title: { text: 'CPK分析图（直方图 + 正态分布）', left: 8, top: 4, textStyle: { fontSize: 13, fontWeight: 600 } },
          tooltip: { trigger: 'axis' },
          legend: { data: ['频数', '正态分布曲线'], top: 28, right: 16 },
          grid: { left: 56, right: 56, top: 56, bottom: 32 },
          xAxis: { type: 'category', data: binLabels, name: '测量值' },
          yAxis: { type: 'value', name: '频数/密度' },
          series: [
            {
              name: '频数',
              type: 'bar',
              data: hist,
              itemStyle: { color: (p) => {
                const x = bins[p.dataIndex];
                if (x > usl || x < lsl) return '#F56C6C';
                if (x > ucl || x < lcl) return '#E6A23C';
                return '#91caff';
              }},
              barWidth: '80%',
            },
            {
              name: '正态分布曲线',
              type: 'line',
              data: normalData,
              smooth: true,
              symbol: 'none',
              lineStyle: { width: 2.5, color: '#1677ff' },
              markLine: {
                symbol: 'none',
                label: { position: 'start', fontSize: 10 },
                data: markLines,
              },
            },
          ],
        },
      ];
    }
    if (chartKey === 'cpkTrend') {
      const isMonth = timeRangeType !== 2;
      const xc = isMonth
        ? ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']
        : ['2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3'];
      const cpk = isMonth ? [1.21, 1.35, 1.48, 1.4, 1.52, 1.42] : [1.18, 1.33, 1.45, 1.42];
      // 根据CPK值对应等级着色
      function cpkColor(v) {
        if (v >= 1.67) return '#52c41a';   // A级 绿
        if (v >= 1.33) return '#1677ff';   // B级 蓝
        if (v >= 1.0)  return '#fa8c16';   // C级 橙
        if (v >= 0.67) return '#f5222d';   // D级 红
        return '#a8071a';                  // E级 深红
      }
      const coloredCpk = cpk.map(v => ({ value: v, itemStyle: { color: cpkColor(v) } }));
      return [
        {
          title: { text: 'CPK趋势图', left: 8, top: 4, textStyle: { fontSize: 13, fontWeight: 600 } },
          tooltip: {
            trigger: 'axis',
            formatter: (params) => {
              const v = params[0].value;
              const grade = v >= 1.67 ? 'A级' : v >= 1.33 ? 'B级' : v >= 1.0 ? 'C级' : v >= 0.67 ? 'D级' : 'E级';
              return `${params[0].axisValue}<br/>CPK: <b>${v}</b> (${grade})`;
            }
          },
          grid: { left: 56, right: 56, top: 48, bottom: 32 },
          xAxis: { type: 'category', data: xc },
          yAxis: { type: 'value', name: 'CPK', min: 0, max: 2.0 },
          visualMap: { show: false, pieces: [
            { min: 1.67, color: '#52c41a' },
            { min: 1.33, max: 1.67, color: '#1677ff' },
            { min: 1.0, max: 1.33, color: '#fa8c16' },
            { min: 0, max: 1.0, color: '#f5222d' },
          ]},
          series: [
            {
              type: 'line',
              data: cpk,
              symbolSize: 10,
              lineStyle: { width: 2 },
              areaStyle: { opacity: 0.06, color: '#1677ff' },
              markLine: {
                symbol: 'none',
                label: { position: 'insideEndTop', fontSize: 10 },
                data: [
                  { yAxis: 1.67, name: 'A级(≥1.67)', lineStyle: { type: 'dashed', color: '#52c41a', width: 1 } },
                  { yAxis: 1.33, name: 'B级(≥1.33)', lineStyle: { type: 'dashed', color: '#1677ff', width: 1 } },
                  { yAxis: 1.0, name: 'C级(≥1.0)', lineStyle: { type: 'dashed', color: '#fa8c16', width: 1 } },
                  { yAxis: 0.67, name: 'D级(≥0.67)', lineStyle: { type: 'dashed', color: '#f5222d', width: 1 } },
                ],
              },
            },
          ],
        },
      ];
    }
    if (chartKey === 'passRate') {
      const xc = ['09-01', '09-05', '09-10', '09-15', '09-20'];
      const rate = [92, 94, 91, 96, 93.75];
      const TARGET = 95;
      return [
        {
          title: { text: '合格率统计图', left: 8, top: 4, textStyle: { fontSize: 13, fontWeight: 600 } },
          tooltip: {
            trigger: 'axis',
            formatter: (params) => {
              const v = params[0].value;
              const flag = v >= TARGET ? '✅ 达标' : '❌ 未达标';
              return `${params[0].axisValue}<br/>合格率: <b>${v}%</b> ${flag}`;
            }
          },
          grid: { left: 56, right: 56, top: 48, bottom: 32 },
          xAxis: { type: 'category', data: xc },
          yAxis: { type: 'value', min: 80, max: 100, axisLabel: { formatter: '{value}%' }, name: '合格率' },
          series: [
            {
              type: 'bar',
              data: rate.map(v => ({
                value: v,
                itemStyle: { color: v >= TARGET ? '#52c41a' : '#ff4d4f', opacity: 0.8 }
              })),
              barWidth: '40%',
              name: '合格率',
              markLine: {
                symbol: 'none',
                data: [{ yAxis: TARGET, name: `目标${TARGET}%`, lineStyle: { type: 'dashed', color: '#1677ff', width: 2 } }],
                label: { position: 'insideEndTop', fontSize: 11, color: '#1677ff' },
              },
            },
            {
              type: 'line',
              data: rate,
              symbol: 'circle',
              symbolSize: 8,
              lineStyle: { width: 2, color: '#1890ff' },
              itemStyle: { color: (p) => rate[p.dataIndex] >= TARGET ? '#52c41a' : '#ff4d4f' },
            },
          ],
        },
      ];
    }
    // 单值区间图（密集的单值实测数据散点群 + 批次均值 + 95%置信区间误差线）
    if (chartKey === 'scatterInterval' || chartKey === 'scatterSingle') {
      const batchCodes = [
        '1CP0901', '1CP0902', 'BC0901', 'BC0902', 'BC0903', 'BC0904', 'BD1001', 'BD1002', 'BD1003', 'BD1004',
        'BD1005', 'BD1006', 'BD1007', 'BD1008', 'BD1009', 'BD1010', 'BD1011', 'BD1012', 'BD1013', 'BD1014',
        'BD1015', 'BD1016', 'BD1017', 'BD1018', 'BD1019', 'BD1020', 'BE1101', 'BE1102', 'BE1103', 'BE1104',
        'BE1105', 'BE1106', 'BE1107', 'BE1108', 'BE1109', 'BE1110', 'BE1111', 'BE1112', 'BE1113', 'BE1114',
        'BF1201', 'BF1202', 'BF1203', 'BF1204', 'BF1205', 'BF1206', 'BF1207', 'BF1208'
      ];
      const isHardness = itemName && itemName.includes('硬度');
      // 完全对齐图三起伏波动（均值56.6~60.1，两处低谷凹坑与高位平原）
      const meanCurve = [
        58.82, 58.70, 58.50, 59.05, 58.80, 58.90, 59.35, 59.18, 59.25, 59.00,
        59.42, 59.40, 59.22, 58.75, 59.28, 58.95, 58.58, 59.12, 58.40, 58.65,
        57.05, 56.65, 57.80, 58.45, 57.25, 58.20, 58.42, 58.50, 58.60, 58.45,
        58.55, 59.00, 58.60, 59.15, 58.60, 59.18, 59.60, 59.68, 59.52, 59.60,
        60.12, 59.40, 59.80, 59.15, 59.50, 58.90, 58.92, 58.75
      ];
      const scale = isHardness ? 1 : (baseVal / 58.86);
      const scatterPoints = [];
      const errorBarData = [];
      const meanPoints = [];
      const batchSummaries = [];

      let prSeed = 47;
      function pr() {
        prSeed = (prSeed * 9301 + 49297) % 233280;
        return prSeed / 233280;
      }
      function prNorm() {
        const u = Math.max(1e-6, pr());
        const v = Math.max(1e-6, pr());
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      }

      batchCodes.forEach((code, idx) => {
        const rawM = meanCurve[idx % meanCurve.length];
        const target = rawM * scale;
        const nSample = 24 + Math.floor(pr() * 12); // 每批 24~35 个密集单值测点
        const popStd = isHardness ? (0.50 + pr() * 0.35) : (amp * 0.28 + pr() * amp * 0.15);
        const dec = isHardness ? 1 : 3;
        const samples = [];
        for (let j = 0; j < nSample; j++) {
          let val = +(target + prNorm() * popStd).toFixed(dec);
          if ((idx === 21 && j < 2) || (idx === 38 && j < 2)) {
            val = +(target - popStd * 2.6).toFixed(dec);
          }
          samples.push(val);
        }
        const st = statsFromSamples(samples);
        const m = +st.mean.toFixed(isHardness ? 2 : 3);
        const std = +st.std.toFixed(3);
        const ciUpper = +st.ciUpper.toFixed(isHardness ? 2 : 3);
        const ciLower = +st.ciLower.toFixed(isHardness ? 2 : 3);

        batchSummaries.push({ batch: code, mean: m, n: nSample, std: std, ciUpper: ciUpper, ciLower: ciLower });
        meanPoints.push([code, m]);
        errorBarData.push([code, ciUpper, ciLower]);

        samples.forEach((val) => {
          scatterPoints.push([code, val]);
        });
      });

      // Y 轴覆盖散点与完整 CI，避免误差棒被截断
      const allY = [];
      scatterPoints.forEach(p => allY.push(p[1]));
      meanPoints.forEach(p => allY.push(p[1]));
      errorBarData.forEach(p => { allY.push(p[1]); allY.push(p[2]); });
      const minVal = Math.min(...allY);
      const maxVal = Math.max(...allY);
      const diff = (maxVal - minVal) || (isHardness ? 2 : (baseVal * 0.05));
      let yMin = 55, yMax = 62, yInterval = 1;
      if (isHardness) {
        yMin = Math.floor(minVal - 0.4);
        yMax = Math.ceil(maxVal + 0.4);
      } else {
        const yDec = baseVal > 10 ? 1 : (baseVal > 1 ? 2 : 4);
        yMin = +(minVal - diff * 0.15).toFixed(yDec);
        yMax = +(maxVal + diff * 0.15).toFixed(yDec);
        yInterval = undefined;
      }

      return [
        {
          title: {
            text: `${isHardness ? '硬度' : itemName} 的单值区间图`,
            subtext: '均值的 95% 置信区间',
            left: 'center',
            top: 8,
            textStyle: { fontSize: 16, fontWeight: 700, color: '#1f2d3d' },
            subtextStyle: { fontSize: 12, color: '#606266', padding: [4, 0, 0, 0] }
          },
          tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(255, 255, 255, 0.96)',
            borderColor: '#e4e7ed',
            borderWidth: 1,
            textStyle: { color: '#303133', fontSize: 12 },
            formatter: (params) => {
              const findBatch = (key) => batchSummaries.find(s => s.batch === key) || batchSummaries[params.dataIndex] || {};
              if (params.seriesName === '批次均值') {
                const b = findBatch(params.value[0]);
                return `<div style="font-weight:bold;margin-bottom:4px;color:#1890ff;">批次: ${b.batch}</div>` +
                       `抽检样本量 n: <b>${b.n}</b><br/>` +
                       `批次均值 Mean: <b>${b.mean}</b><br/>` +
                       `批内标准差 s: <b>${b.std}</b><br/>` +
                       `95% 置信区间: [<b>${b.ciLower}</b>, <b>${b.ciUpper}</b>]`;
              }
              if (params.seriesName === '单值测量数据') {
                const b = findBatch(params.value[0]);
                return `批次号: <b>${b.batch}</b><br/>实测单值: <b>${params.value[1]}</b>`;
              }
              if (params.seriesName === '均值的 95% 置信区间') {
                const b = findBatch(params.value[0]);
                return `<div style="font-weight:bold;margin-bottom:4px;color:#1890ff;">批次: ${b.batch}</div>` +
                       `95% 置信区间: [<b>${b.ciLower}</b>, <b>${b.ciUpper}</b>]<br/>` +
                       `均值 Mean: <b>${b.mean}</b>`;
              }
              return '';
            }
          },
          legend: {
            data: ['单值测量数据', '批次均值', '均值的 95% 置信区间'],
            top: 42,
            right: 24,
            textStyle: { fontSize: 12, color: '#606266' }
          },
          grid: {
            left: 64,
            right: 32,
            top: 76,
            bottom: 64
          },
          xAxis: {
            type: 'category',
            data: batchCodes,
            name: '批次号',
            nameLocation: 'middle',
            nameGap: 42,
            nameTextStyle: {
              fontSize: 13,
              fontWeight: 'bold',
              color: '#303133',
            },
            axisTick: { alignWithLabel: true },
            axisLabel: {
              interval: 0,
              rotate: 45,
              fontSize: 10,
              color: '#606266'
            },
            splitLine: { show: true, lineStyle: { color: '#f2f6fc', type: 'dashed' } }
          },
          yAxis: {
            type: 'value',
            name: isHardness ? '硬度' : itemName,
            nameLocation: 'middle',
            nameGap: 46,
            nameTextStyle: {
              fontSize: 13,
              fontWeight: 'bold',
              color: '#303133',
            },
            min: yMin,
            max: yMax,
            interval: yInterval,
            axisLine: { show: true, lineStyle: { color: '#dcdfe6' } },
            axisTick: { show: true },
            axisLabel: { color: '#606266', fontSize: 11 },
            splitLine: { show: true, lineStyle: { color: '#ebeef5', type: 'solid' } }
          },
          dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            { type: 'slider', show: true, bottom: 4, height: 16, start: 0, end: 100, fillerColor: 'rgba(24,144,255,0.18)' }
          ],
          series: [
            {
              name: '单值测量数据',
              type: 'scatter',
              symbolSize: 5,
              itemStyle: {
                color: '#606266',
                opacity: 0.75
              },
              data: scatterPoints,
              z: 2
            },
            {
              name: '均值的 95% 置信区间',
              type: 'custom',
              clip: false,
              encode: { x: 0, y: [1, 2] },
              renderItem: function (params, api) {
                const xName = api.value(0);
                const high = api.coord([xName, api.value(1)]);
                const low = api.coord([xName, api.value(2)]);
                if (!high || !low) return;
                const halfWidth = 5;
                const style = api.style({
                  stroke: '#1890ff',
                  fill: 'transparent',
                  lineWidth: 1.8
                });
                return {
                  type: 'group',
                  children: [
                    {
                      type: 'line',
                      shape: { x1: high[0], y1: high[1], x2: low[0], y2: low[1] },
                      style: Object.assign({}, style, { lineWidth: 8, stroke: 'rgba(24,144,255,0.01)' })
                    },
                    {
                      type: 'line',
                      shape: { x1: high[0], y1: high[1], x2: low[0], y2: low[1] },
                      style: style
                    },
                    {
                      type: 'line',
                      shape: { x1: high[0] - halfWidth, y1: high[1], x2: high[0] + halfWidth, y2: high[1] },
                      style: style
                    },
                    {
                      type: 'line',
                      shape: { x1: low[0] - halfWidth, y1: low[1], x2: low[0] + halfWidth, y2: low[1] },
                      style: style
                    }
                  ]
                };
              },
              data: errorBarData,
              z: 3
            },
            {
              name: '批次均值',
              type: 'scatter',
              symbolSize: 8,
              itemStyle: {
                color: '#1890ff',
                borderColor: '#ffffff',
                borderWidth: 1.5,
                shadowBlur: 3,
                shadowColor: 'rgba(0,0,0,0.25)'
              },
              data: meanPoints,
              z: 4
            }
          ]
        }
      ];
    }

    // pareto
    const items = [pickLabel(query['检验项'], 'Si2H6'), 'CO2', '外观色泽', '其他'];
    const cnt = [3, 2, 1, 1];
    const total = cnt.reduce((a, b) => a + b, 0);
    let acc = 0;
    const cum = cnt.map((c) => {
      acc += c;
      return +((acc / total) * 100).toFixed(1);
    });
    return [
      {
        title: { text: '不合格项分布柏拉图', left: 8, top: 4, textStyle: { fontSize: 13, fontWeight: 600 } },
        tooltip: { trigger: 'axis' },
        legend: { data: ['不合格数', '累计占比'], top: 28 },
        grid: { left: 56, right: 64, top: 56, bottom: 32 },
        xAxis: { type: 'category', data: items },
        yAxis: [
          { type: 'value', name: '不合格数', splitLine: { show: true } },
          { type: 'value', name: '累计%', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
        ],
        series: [
          { name: '不合格数', type: 'bar', data: cnt, itemStyle: { color: '#1677ff' }, barWidth: '45%' },
          {
            name: '累计占比', type: 'line', yAxisIndex: 1, data: cum,
            itemStyle: { color: '#fa8c16' },
            symbolSize: 8,
            lineStyle: { width: 2 },
            markLine: {
              symbol: 'none',
              data: [{ yAxis: 80, name: '80%基准线', lineStyle: { type: 'dashed', color: '#f5222d', width: 1.5 } }],
              label: { position: 'insideEndTop', fontSize: 10 },
            },
          },
        ],
      },
    ];
  }

  function analysisColumns(chartKey, isSecond) {
    if (isSecond || chartKey === 'imr' && isSecond) {
      /* handled below */
    }
    if (chartKey === 'scatterInterval' || chartKey === 'scatterSingle') {
      return [
        ['物料信息', 'materialInfos'],
        ['检验方案', 'inspectionSchemeName'],
        ['检验项', 'inspectionItemName'],
        ['单位', 'inspectionItemUnitName'],
        ['图类型', 'viewTypeName'],
        ['分析批次数', 'batchCount'],
        ['总测点数', 'totalSampleCount'],
        ['总体均值', 'grandMean'],
        ['总体标准差 σ', 'overallStdDev'],
        ['批均值最大', 'maxBatchMean'],
        ['批均值最小', 'minBatchMean'],
        ['批均值极差', 'rangeMean'],
        ['合并标准差 s_pooled', 'pooledStdDev'],
        ['95% CI 平均跨度', 'avgCiWidth'],
        ['异常离群点数', 'outlierCount'],
      ];
    }
    if (chartKey === 'cpkTrend') {
      return [
        ['物料信息', 'materialInfos'],
        ['检验方案', 'inspectionSchemeName'],
        ['样本总数', 'sampleCount'],
        ['检验项', 'inspectionItemName'],
        ['单位', 'inspectionItemUnitName'],
        ['图类型', 'viewTypeName'],
        ['MAX', 'max'],
        ['MIN', 'min'],
        ['CPK≥1.67；A级', 'aLevelNumber'],
        ['1.33≤CPK<1.67；B级', 'bLevelNumber'],
        ['1.0≤CPK<1.33；C级', 'cLevelNumber'],
        ['0.67≤CPK<1.0；D级', 'dLevelNumber'],
        ['CPK<0.67；E级', 'eLevelNumber'],
      ];
    }
    if (chartKey === 'passRate') {
      return [
        ['统计日期', 'statisticsDate'],
        ['物料信息', 'materialInfos'],
        ['样本总数', 'totalNumber'],
        ['合格样本数', 'qualifiedNumber'],
        ['合格率', 'qualifiedRate'],
      ];
    }
    if (chartKey === 'pareto') {
      return [
        ['检验项名称', 'inspectionItemName'],
        ['物料信息', 'materialInfos'],
        ['样本总数', 'totalNumber'],
        ['不合格数', 'wrongNumber'],
        ['不合格率', 'unQualifiedRate'],
        ['不合格占比', 'unQualifiedAllRate'],
        ['不合格累计占比', 'unQualifiedAccumulateRate'],
      ];
    }
    if (isSecond) {
      return [
        ['物料信息', 'materialInfos'],
        ['检验方案', 'inspectionSchemeName'],
        ['样本总数', 'sampleCount'],
        ['检验项', 'inspectionItemName'],
        ['单位', 'inspectionItemUnitName'],
        ['图类型', 'viewTypeName'],
        ['MAX', 'max'],
        ['MIN', 'min'],
        ['UCL', 'uclStr'],
        ['LCL', 'lclStr'],
        ['CL', 'clStr'],
        ['Average', 'averageStr'],
        ['OOC', 'ooc'],
      ];
    }
    const cols = [
      ['物料信息', 'materialInfos'],
      ['检验方案', 'inspectionSchemeName'],
      ['样本总数', 'sampleCount'],
      ['检验项', 'inspectionItemName'],
      ['单位', 'inspectionItemUnitName'],
      ['图类型', 'viewTypeName'],
      ['D.L', 'dl'],
      ['MAX', 'max'],
      ['MIN', 'min'],
      ['USL', 'uslStr'],
      ['LSL', 'lslStr'],
      ['UCL', 'uclStr'],
      ['LCL', 'lclStr'],
      ['CL', 'clStr'],
      ['UWL', 'uwlStr'],
      ['LWL', 'lwlStr'],
      ['Average', 'averageStr'],
      ['σ', 'sigmaStr'],
      ['Ca', 'caStr'],
      ['Cp', 'cpStr'],
      ['CPU', 'cpuStr'],
      ['CPL', 'cplStr'],
      ['CPK', 'cpkStr'],
      ['CPK等级', 'cpkGrade'],
      ['OOC', 'ooc'],
      ['OOS', 'oos'],
      ['OOW', 'oow'],
      ['OOT', 'oot'],
    ];
    if (chartKey === 'cpk') {
      cols.push(
        ['Ave≤M＜Ave+σ', 'avePositive1sigma'],
        ['Ave+σ≤M＜Ave+2σ', 'avePositive2sigma'],
        ['Ave+2σ≤M＜Ave+3σ', 'avePositive3sigma'],
        ['Ave-σ≤M＜Ave', 'aveNegative1sigma'],
        ['Ave-2σ≤M＜Ave-σ', 'aveNegative2sigma'],
        ['Ave-3σ≤M＜Ave-2σ', 'aveNegative3sigma'],
        ['其他', 'aveOther']
      );
    }
    return cols;
  }

  function sampleRows(query) {
    const compareRows = Array.isArray(query && query._compareRows) ? query._compareRows : null;
    const baseQ = compareRows && compareRows[0] ? compareRows[0] : (query || {});
    const ledgerPts = ledgerPoints(baseQ);
    if (ledgerPts.length) {
      const rows = global.QC_SPC_LINK.toSampleRows(ledgerPts);
      if (baseQ._chartKey === 'scatterInterval' || baseQ._chartKey === 'scatterSingle') {
        const pay = global.QC_SPC_LINK.chartPayload(ledgerPts);
        const groups = (pay && pay.groups) || [];
        return ledgerPts.map((p) => {
          const g = groups.find((x) => x.vals && (x.batch === p.batchNumber || x.batch === p.sampleNum));
          const st = g ? statsFromSamples(g.vals) : statsFromSamples([p.val]);
          return Object.assign({}, global.QC_SPC_LINK.toSampleRows([p])[0], {
            batchMean: +st.mean.toFixed(6),
            ciRange: `[${(+st.ciLower).toFixed(6)}, ${(+st.ciUpper).toFixed(6)}]`,
            measureNo: '#1',
          });
        });
      }
      return rows;
    }
    const isCentralControl = !!(baseQ['采集方案'] || baseQ['产线名称'] || baseQ['采集项']);
    const itemRaw = baseQ['检验项'] || baseQ['采集项'] || (isCentralControl ? '中控水分' : 'Si2H6');
    const item = pickLabel(itemRaw, isCentralControl ? '中控水分' : 'Si2H6');
    let unit = isCentralControl ? '%' : 'W/(m·K)';
    let baseVal = 5.96;
    let amp = 0.4;
    if (item.includes('水分') || item === '中控水分') {
      unit = item.includes('ppb') ? 'ppb' : (item.includes('ppm') ? 'ppm' : '%');
      baseVal = unit === 'ppb' ? 8.6 : (unit === 'ppm' ? 12.5 : 0.045);
      amp = unit === 'ppb' ? 4.0 : (unit === 'ppm' ? 5.0 : 0.018);
    } else if (item.includes('温度') || item === '脱水温度') { unit = '℃'; baseVal = 115.3; amp = 4.0; }
    else if (item.includes('压力') || item === '反应压力') { unit = 'kPa'; baseVal = 184.6; amp = 12.0; }
    else if (item === '搅拌转速') { unit = 'rpm'; baseVal = 120.2; amp = 3.0; }
    else if (item === '固含量') { unit = '%'; baseVal = 45.2; amp = 2.0; }
    else if (item.includes('纯度')) { unit = '%'; baseVal = 99.9995; amp = 0.0004; }
    else if (item === '033/Cu') { unit = 'ppm'; baseVal = 0.33; amp = 0.08; }

    else if (item.includes('硬度')) { unit = 'HV'; baseVal = 58.9; amp = 0.8; }

    if (baseQ._chartKey === 'scatterInterval' || baseQ._chartKey === 'scatterSingle' || (item.includes('硬度') && (!baseQ._chartKey || baseQ._chartKey === 'scatterInterval' || baseQ._chartKey === 'scatterSingle'))) {
      const batchCodes = [
        '1CP0901', '1CP0902', 'BC0901', 'BC0902', 'BC0903', 'BC0904', 'BD1001', 'BD1002', 'BD1003', 'BD1004',
        'BD1005', 'BD1006', 'BD1007', 'BD1008', 'BD1009', 'BD1010', 'BD1011', 'BD1012', 'BD1013', 'BD1014',
        'BD1015', 'BD1016', 'BD1017', 'BD1018', 'BD1019', 'BD1020', 'BE1101', 'BE1102', 'BE1103', 'BE1104',
        'BE1105', 'BE1106', 'BE1107', 'BE1108', 'BE1109', 'BE1110', 'BE1111', 'BE1112', 'BE1113', 'BE1114',
        'BF1201', 'BF1202', 'BF1203', 'BF1204', 'BF1205', 'BF1206', 'BF1207', 'BF1208'
      ];
      const meanCurve = [
        58.82, 58.70, 58.50, 59.05, 58.80, 58.90, 59.35, 59.18, 59.25, 59.00,
        59.42, 59.40, 59.22, 58.75, 59.28, 58.95, 58.58, 59.12, 58.40, 58.65,
        57.05, 56.65, 57.80, 58.45, 57.25, 58.20, 58.42, 58.50, 58.60, 58.45,
        58.55, 59.00, 58.60, 59.15, 58.60, 59.18, 59.60, 59.68, 59.52, 59.60,
        60.12, 59.40, 59.80, 59.15, 59.50, 58.90, 58.92, 58.75
      ];
      const isHardness = item.includes('硬度');
      const scale = isHardness ? 1 : (baseVal / 58.86);
      const rows = [];
      let prSeed = 88;
      function prR() { prSeed = (prSeed * 9301 + 49297) % 233280; return prSeed / 233280; }
      function prN() {
        const u = Math.max(1e-6, prR()), v = Math.max(1e-6, prR());
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      }

      batchCodes.forEach((bCode, bIdx) => {
        const target = meanCurve[bIdx % meanCurve.length] * scale;
        const popStd = isHardness ? 0.62 : (amp * 0.3);
        const nSample = 5;
        const isAnomalyBatch = (bIdx === 21 || bIdx === 24);
        const readings = [];
        for (let j = 0; j < nSample; j++) {
          let reading = +(target + prN() * popStd).toFixed(isHardness ? 1 : 4);
          if (isAnomalyBatch && j === 0) reading = +(target - popStd * 2.5).toFixed(isHardness ? 1 : 4);
          readings.push(reading);
        }
        const st = statsFromSamples(readings);
        const m = +st.mean.toFixed(isHardness ? 2 : 4);
        const ciU = +st.ciUpper.toFixed(isHardness ? 2 : 4);
        const ciL = +st.ciLower.toFixed(isHardness ? 2 : 4);

        readings.forEach((reading, j) => {
          const isOoc = isAnomalyBatch && j === 0;
          const isWarning = !isOoc && Math.abs(reading - m) > st.std * 1.8;
          const status = isOoc ? '不合格' : (isWarning ? '偏差' : '合格');
          const dev = isOoc ? 'OOC' : (isWarning ? 'OOW' : '—');
          const desc = isOoc ? '单值实测异常偏低(低于控制下限)' : (isWarning ? '测点偏离批次均值超过警戒区' : '');

          rows.push({
            inspectResultName: status,
            deviationResultNames: dev,
            abnormalDescription: desc,
            sampleNum: `YP-202609${String(1 + Math.floor(bIdx / 2)).padStart(2, '0')}-${String(j + 1).padStart(2, '0')}`,
            sampleSource: '报检取样',
            materialInfo: baseQ['物料信息'] || 'MAT-SIH4-5N/电子级高纯硅烷(SiH4)',
            supplierInfo: baseQ['供应商信息'] || 'SUP-WH-001/万华化学集团特气事业部',
            customerInfo: baseQ['客户信息'] || '—',
            samplingPointInfo: baseQ['采样点'] || 'SP-IQC-SIH4/SPC采购来料取样点',
            batchNumber: bCode,
            measureNo: `#${j + 1}`,
            inspectFinishTime: `2026-09-${String(1 + Math.floor(bIdx / 2)).padStart(2, '0')} ${10 + j}:15:00`,
            qualityOrderInspectionNo: `BJ-202609${String(100 + bIdx)}`,
            inspectTime: `2026-09-${String(1 + Math.floor(bIdx / 2)).padStart(2, '0')} 09:00:00`,
            itemValue: reading,
            batchMean: m,
            ciRange: `[${ciL}, ${ciU}]`,
            itemTitle: `${item}/${unit} (单值)`,
          });
        });
      });
      return rows;
    }

    const vals = seededSeries(10, baseVal, amp, 41);
    return vals.map((v, i) => ({
      inspectResultName: i === 2 ? '偏差' : '合格',
      deviationResultNames: i === 2 ? 'OOW' : '—',
      abnormalDescription: i === 2 ? '连续点接近警告限' : '',
      sampleNum: isCentralControl ? `ZK-202609${String(10 + i).padStart(2, '0')}` : `YP-202609${String(10 + i).padStart(2, '0')}`,
      sampleSource: isCentralControl ? '中控在线数采' : '报检取样',
      materialInfo: baseQ['物料信息'] || (baseQ['产线名称'] ? `${baseQ['产线名称']} / ${baseQ['车间名称'] || '车间'}` : '7N超纯氨特气精馏线'),
      supplierInfo: baseQ['供应商信息'] || '—',
      customerInfo: baseQ['客户信息'] || '—',
      samplingPointInfo: baseQ['采样点'] || (isCentralControl ? '脱水釜取样阀 / 在线变送器' : '原料仓取样口'),
      inspectionScheme: baseQ['检验方案'] || baseQ['采集方案'] || '—',
      batchNumber: baseQ['物料批号'] || `R201-20260826-${20 + i}`,
      inspectFinishTime: `2026-09-${String(10 + i).padStart(2, '0')} 15:20:00`,
      qualityOrderInspectionNo: isCentralControl ? (baseQ['生产订单号'] || `HBLSCDD260826${20 + i}`) : `BJ-202609${String(100 + i)}`,
      inspectTime: `2026-09-${String(10 + i).padStart(2, '0')} 09:00:00`,
      itemValue: v,
      itemTitle: `${item}/${unit}`,
    }));
  }

  global.SPC_SINGLE_DEMO = {
    CHART_TABS,
    REQUIRED_FIELDS,
    buildAnalysis,
    mrAnalysis,
    buildChartOptions,
    analysisColumns,
    sampleRows,
  };

  /** 计量SPC（多图）：按所选检验项各出一张图（对齐线上 inspectionItemIdList multiple） */
  const MULTI_CHART_TABS = [
    { key: 'i', label: 'I图', dual: false, titles: ['I图'], singleKey: 'imr', optIndex: 0 },
    { key: 'mr', label: 'MR图', dual: false, titles: ['MR图'], singleKey: 'imr', optIndex: 1 },
    { key: 'xbarR', label: 'Xbar(R)图', dual: false, titles: ['Xbar(R)图'], singleKey: 'xbarR', optIndex: 0 },
    { key: 'r', label: 'R图', dual: false, titles: ['R图'], singleKey: 'xbarR', optIndex: 1 },
    { key: 'xbarS', label: 'Xbar(S)图', dual: false, titles: ['Xbar(S)图'], singleKey: 'xbarS', optIndex: 0 },
    { key: 's', label: 'S图', dual: false, titles: ['S图'], singleKey: 'xbarS', optIndex: 1 },
    { key: 'cpk', label: 'CPK分析图', dual: false, titles: ['CPK分析图'], singleKey: 'cpk', optIndex: 0 },
    { key: 'cpkTrend', label: 'CPK趋势图', dual: false, titles: ['CPK趋势图'], singleKey: 'cpkTrend', optIndex: 0 },
    { key: 'passRate', label: '合格率统计图', dual: false, titles: ['合格率统计图'], singleKey: 'passRate', optIndex: 0, singleCol: true },
    { key: 'pareto', label: '不合格项分布柏拉图', dual: false, titles: ['不合格项分布柏拉图'], singleKey: 'pareto', optIndex: 0, singleCol: true },
  ];

  function normalizeInspectItemList(query) {
    const v = query && (query['检验项'] != null ? query['检验项'] : query['采集项']);
    if (Array.isArray(v)) return v.filter((x) => x != null && String(x).trim() !== '');
    if (v == null || v === '') return [];
    return [v];
  }

  function buildMultiChartOptions(chartKey, query, timeRangeType) {
    const tab = MULTI_CHART_TABS.find((t) => t.key === chartKey) || MULTI_CHART_TABS[0];
    const items = normalizeInspectItemList(query);
    const list = items.length ? items : [null];
    return list.map((item, idx) => {
      const q = Object.assign({}, query, {
        检验项: item != null ? item : query['检验项'],
        _seed: 11 + idx * 17,
      });
      const opts = buildChartOptions(tab.singleKey, q, timeRangeType);
      return opts[tab.optIndex] || opts[0];
    });
  }

  function buildMultiTableRows(query, chartKey) {
    const tab = MULTI_CHART_TABS.find((t) => t.key === chartKey) || MULTI_CHART_TABS[0];
    const items = normalizeInspectItemList(query);
    const list = items.length ? items : [query['检验项'] || query['采集项'] || '检验项'];
    return list.map((item, idx) => {
      const q = Object.assign({}, query, {
        检验项: item,
        _seed: 11 + idx * 17,
      });
      let row;
      if (tab.key === 'mr' || tab.key === 'r' || tab.key === 's') {
        row = mrAnalysis(q);
      } else {
        const analysisKey = tab.singleKey === 'imr' && tab.key === 'mr' ? 'imr' : tab.singleKey;
        row = buildAnalysis(q, analysisKey);
      }
      row.viewTypeName = tab.label;
      row.inspectionItemName = pickLabel(item, row.inspectionItemName);
      return row;
    });
  }

  global.SPC_MULTI_DEMO = {
    CHART_TABS: MULTI_CHART_TABS,
    REQUIRED_FIELDS,
    normalizeInspectItemList,
    buildMultiChartOptions,
    buildMultiTableRows,
    analysisColumns,
    sampleRows,
    buildAnalysis,
  };

  // ==========================================
  // 比对SPC（多图）Demo：对齐试用系统 compare-spc-multiple
  // 多行查询条件（每行 1 个检验项/采集项 + Y坐标）→ 多参数双Y / 相关性
  // ==========================================
  const COMPARE_CHART_TABS = [
    { key: 'compare', label: '多参数对比图', dual: false, titles: ['多参数对比图'], singleKey: 'compare', optIndex: 0, singleCol: true },
    { key: 'correlation', label: '相关性分析图', dual: false, titles: ['相关性分析图'], singleKey: 'correlation', optIndex: 0, singleCol: true },
  ];

  const COMPARE_SERIES_COLORS = ['#1677ff', '#fa8c16', '#52c41a', '#722ed1', '#eb2f96', '#13c2c2'];

  /** 试用系统：多行表单 data[]；Demo 用 query._compareRows 传递 */
  function normalizeCompareRows(query) {
    if (!query) return [{}];
    if (Array.isArray(query._compareRows) && query._compareRows.length) return query._compareRows;
    if (Array.isArray(query) && query.length) return query;
    return [query];
  }

  function compareItemRaw(row) {
    return row['检验项'] || row['采集项'] || '';
  }

  function compareItemName(row, fallback) {
    return pickLabel(compareItemRaw(row), fallback || '参数');
  }

  function compareYAxisIndex(row) {
    return String(row['Y坐标'] || '左侧').indexOf('右') >= 0 ? 1 : 0;
  }

  function profileDecimals(profile) {
    const unit = String((profile && profile.unit) || '');
    const base = Number(profile && profile.base) || 0;
    if (unit === '%' && base >= 90) return 6;
    if (unit === 'ppb' || unit === 'ppm') return 3;
    if (Math.abs(base) >= 10) return 2;
    return 4;
  }

  function linreg(xs, ys) {
    const n = xs.length || 1;
    let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < xs.length; i++) {
      sx += xs[i]; sy += ys[i];
      sxx += xs[i] * xs[i];
      sxy += xs[i] * ys[i];
      syy += ys[i] * ys[i];
    }
    const den = n * sxx - sx * sx;
    const slope = den === 0 ? 0 : (n * sxy - sx * sy) / den;
    const intercept = (sy - slope * sx) / n;
    const num = n * sxy - sx * sy;
    const denR = Math.sqrt(Math.max(0, (n * sxx - sx * sx) * (n * syy - sy * sy)));
    const r = denR === 0 ? 0 : num / denR;
    return { slope, intercept, r, r2: r * r, n };
  }

  function corrLevel(r) {
    const a = Math.abs(r);
    if (a >= 0.8) return r >= 0 ? '强正相关' : '强负相关';
    if (a >= 0.5) return r >= 0 ? '中度正相关' : '中度负相关';
    if (a >= 0.3) return r >= 0 ? '弱正相关' : '弱负相关';
    return '基本无线性相关';
  }

  function tipSelected(query, chartKey) {
    const tip = query && query._compareTip;
    if (!tip) return chartKey === 'correlation' ? ['横坐标', '检验项', '样本值'] : ['横坐标', '样本值'];
    return tip[chartKey] || [];
  }

  /** 按检验项估算 Mock 序列量级（与单图控限口径一致） */
  function compareSeriesProfile(itemName) {
    const name = String(itemName || '');
    if (name.includes('纯度') || name.includes('氨含量')) {
      return { base: 99.9995, amp: 0.0006, unit: '%' };
    }
    if (name.includes('水分') || name.includes('微量水分')) {
      if (name.includes('ppb')) return { base: 8.6, amp: 4.5, unit: 'ppb' };
      if (name.includes('ppm')) return { base: 12.5, amp: 6.0, unit: 'ppm' };
      return { base: 0.045, amp: 0.02, unit: '%' };
    }
    if (name.includes('油')) return { base: 1.8, amp: 0.9, unit: 'ppm' };
    if (name.includes('氧')) return { base: 4.3, amp: 2.2, unit: 'ppb' };
    if (name.includes('一氧化碳') || name.includes('CO')) return { base: 1.9, amp: 0.8, unit: 'ppb' };
    if (name.includes('压力')) return { base: 154.8, amp: 8.0, unit: 'kPa' };
    if (name.includes('温度') || name.includes('脱水')) return { base: 115.5, amp: 6.0, unit: '℃' };
    if (name.includes('电导')) return { base: 0.06, amp: 0.025, unit: 'μS/cm' };
    if (name.includes('固含量')) return { base: 48.5, amp: 2.2, unit: '%' };
    if (name.includes('粘度')) return { base: 1.05, amp: 0.18, unit: 'mPa·s' };
    if (name.includes('转速')) return { base: 120.2, amp: 3.5, unit: 'rpm' };
    if (name.includes('真空')) return { base: -0.092, amp: 0.006, unit: 'MPa' };
    const analysis = buildAnalysis({ 检验项: itemName }, 'imr');
    return {
      base: Number(analysis.averageStr) || 10,
      amp: Math.max(0.01, Math.abs(Number(analysis.max) - Number(analysis.min)) || 2),
      unit: analysis.inspectionItemUnitName || '',
    };
  }

  function buildCompareChartOptions(chartKey, query) {
    const rows = normalizeCompareRows(query);
    const n = 24;
    const cats = Array.from({ length: n }, (_, i) => {
      const h = String(8 + Math.floor(i / 2)).padStart(2, '0');
      const m = i % 2 === 0 ? '00' : '30';
      return `09-18 ${h}:${m}`;
    });

    if (chartKey === 'compare') {
      const series = rows.map((row, i) => {
        const item = compareItemName(row, '参数' + (i + 1));
        const profile = compareSeriesProfile(item);
        const yIdx = compareYAxisIndex(row);
        const color = COMPARE_SERIES_COLORS[i % COMPARE_SERIES_COLORS.length];
        const axisTag = yIdx === 1 ? '右轴' : '左轴';
        const pts = ledgerPoints(Object.assign({}, query, row));
        const data = pts.length >= 2 ? pts.map((p) => p.val) : seededSeries(n, profile.base, profile.amp, 55 + i * 17);
        return {
          name: `${item} (${profile.unit || '-'}${profile.unit ? ', ' : ''}${axisTag})`,
          type: 'line',
          yAxisIndex: yIdx,
          data,
          smooth: true,
          symbol: yIdx === 1 ? 'diamond' : 'circle',
          symbolSize: yIdx === 1 ? 8 : 7,
          lineStyle: { width: 2.5, color },
          itemStyle: { color },
          _profile: profile,
          _item: item,
          _cats: pts.length >= 2 ? pts.map((p) => p.sampleNum) : null,
        };
      });

      const leftSeries = series.filter((s) => s.yAxisIndex === 0);
      const rightSeries = series.filter((s) => s.yAxisIndex === 1);
      const leftTitle = leftSeries.length
        ? leftSeries.map((s) => s._item).join(' / ') + (leftSeries[0]._profile.unit ? ` (${leftSeries[0]._profile.unit})` : '')
        : '左轴';
      const rightTitle = rightSeries.length
        ? rightSeries.map((s) => s._item).join(' / ') + (rightSeries[0]._profile.unit ? ` (${rightSeries[0]._profile.unit})` : '')
        : '右轴';
      const titleNames = series.map((s) => s._item).join(' vs ');

      return [{
        title: {
          text: titleNames ? `多参数双Y轴对比走势（${titleNames}）` : '多参数对比图',
          left: 12,
          top: 8,
          textStyle: { fontSize: 14, fontWeight: 600 },
        },
        tooltip: {
          trigger: 'axis',
          formatter: (params) => {
            const sel = tipSelected(query, 'compare');
            if (!params || !params.length) return '';
            const lines = [];
            if (!sel.length || sel.includes('横坐标')) lines.push(params[0].axisValue);
            params.forEach((p) => {
              if (!sel.length || sel.includes('样本值')) lines.push(`${p.marker}${p.seriesName}: <b>${p.data}</b>`);
            });
            return lines.join('<br/>');
          },
        },
        legend: { data: series.map((s) => s.name), top: 32, right: 24 },
        grid: { left: 64, right: 64, top: 68, bottom: 50 },
        xAxis: { type: 'category', data: (series[0] && series[0]._cats) || cats, axisLabel: { fontSize: 10, rotate: 25 } },
        yAxis: [
          {
            type: 'value',
            name: leftTitle,
            position: 'left',
            scale: true,
            axisLine: { show: true, lineStyle: { color: (leftSeries[0] && leftSeries[0].itemStyle.color) || '#1677ff' } },
            splitLine: { lineStyle: { color: '#f0f0f0' } },
          },
          {
            type: 'value',
            name: rightTitle,
            position: 'right',
            scale: true,
            axisLine: { show: true, lineStyle: { color: (rightSeries[0] && rightSeries[0].itemStyle.color) || '#fa8c16' } },
            splitLine: { show: false },
          },
        ],
        series: series.map(({ _profile, _item, ...rest }) => rest),
      }];
    }

    if (chartKey === 'correlation') {
      const r0 = rows[0] || {};
      const r1 = rows[1] || rows[0] || {};
      const xName = compareItemName(r0, '自变量');
      const yName = compareItemName(r1, '因变量');
      const xp = compareSeriesProfile(xName);
      const yp = compareSeriesProfile(yName);
      const xd = profileDecimals(xp);
      const yd = profileDecimals(yp);
      const ampX = Math.max(xp.amp, xp.base >= 90 ? 0.0008 : 0.01);
      const slope0 = -(yp.amp / Math.max(ampX, 0.0001)) * 0.45;
      const intercept0 = yp.base - slope0 * xp.base;
      const px = ledgerPoints(Object.assign({}, query, r0));
      const py = ledgerPoints(Object.assign({}, query, r1));
      const scatterData = [];
      if (px.length >= 2 && py.length >= 2) {
        const m = Math.min(px.length, py.length);
        for (let i = 0; i < m; i++) scatterData.push([+px[i].val.toFixed(xd), +py[i].val.toFixed(yd)]);
      } else {
        let seed = 91;
        for (let i = 0; i < 35; i++) {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          const rx = (seed % 1000) / 1000;
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          const ry = (seed % 1000) / 1000;
          const x = +(xp.base + (rx - 0.5) * ampX * 2).toFixed(xd);
          const y = +(intercept0 + slope0 * x + (ry - 0.5) * yp.amp * 0.45).toFixed(yd);
          scatterData.push([x, y]);
        }
      }
      const fit = linreg(scatterData.map((d) => d[0]), scatterData.map((d) => d[1]));
      const xMin = Math.min(...scatterData.map((d) => d[0]));
      const xMax = Math.max(...scatterData.map((d) => d[0]));
      const lineData = [
        [xMin, +(fit.intercept + fit.slope * xMin).toFixed(yd)],
        [xMax, +(fit.intercept + fit.slope * xMax).toFixed(yd)],
      ];
      const r = +fit.r.toFixed(3);
      const r2 = +fit.r2.toFixed(3);
      const eq = `y = ${fit.slope.toFixed(4)}x ${fit.intercept >= 0 ? '+' : ''}${fit.intercept.toFixed(4)}`;
      const level = corrLevel(fit.r);

      return [{
        title: {
          text: `相关性分析散点图（自变量: ${xName} vs 因变量: ${yName}）`,
          subtext: `线性拟合: ${eq} | 相关系数 r = ${r}（${level}） | 判定系数 R² = ${r2}`,
          left: 12,
          top: 6,
          textStyle: { fontSize: 14, fontWeight: 600 },
          subtextStyle: { fontSize: 12, color: '#1677ff', fontWeight: 500 },
        },
        tooltip: {
          trigger: 'item',
          formatter: (p) => {
            if (p.seriesName === '拟合趋势线') return `线性拟合: ${eq}`;
            const sel = tipSelected(query, 'correlation');
            const lines = [];
            if (!sel.length || sel.includes('横坐标')) lines.push(`${xName}: <b>${p.data[0]} ${xp.unit}</b>`);
            if (sel.includes('检验项')) lines.push(`检验项: ${xName} / ${yName}`);
            if (!sel.length || sel.includes('样本值')) lines.push(`${yName}: <b>${p.data[1]} ${yp.unit}</b>`);
            return (lines.length ? `样本点 ${p.dataIndex + 1}<br/>` : '') + lines.join('<br/>');
          },
        },
        legend: { data: ['实测样本点', '拟合趋势线'], top: 36, right: 24 },
        grid: { left: 72, right: 64, top: 80, bottom: 50 },
        xAxis: { type: 'value', name: `${xName} (${xp.unit})`, min: 'dataMin', max: 'dataMax', scale: true },
        yAxis: { type: 'value', name: `${yName} (${yp.unit})`, min: 'dataMin', max: 'dataMax', scale: true, splitLine: { lineStyle: { color: '#f0f0f0' } } },
        series: [
          {
            name: '实测样本点',
            type: 'scatter',
            data: scatterData,
            symbolSize: 9,
            itemStyle: { color: '#1677ff', opacity: 0.85 },
          },
          {
            name: '拟合趋势线',
            type: 'line',
            data: lineData,
            symbol: 'none',
            lineStyle: { type: 'dashed', color: '#f5222d', width: 2.5 },
          },
        ],
      }];
    }

    return [];
  }

  function buildCompareTableRows(query, chartKey) {
    const rows = normalizeCompareRows(query);

    if (chartKey === 'compare') {
      return rows.map((row, i) => {
        const r = buildAnalysis(row, 'imr');
        const yTag = compareYAxisIndex(row) === 1 ? '右轴' : '左轴';
        r.viewTypeName = `${r.inspectionItemName} (${yTag})`;
        r._rowIndex = i + 1;
        return r;
      });
    }

    if (chartKey === 'correlation') {
      const xName = compareItemName(rows[0] || {}, 'X');
      const yName = compareItemName(rows[1] || rows[0] || {}, 'Y');
      const opts = buildCompareChartOptions('correlation', query);
      const sub = String((opts[0] && opts[0].title && opts[0].title.subtext) || '');
      const rMatch = sub.match(/r = (-?[\d.]+)/);
      const r2Match = sub.match(/R² = ([\d.]+)/);
      const lvMatch = sub.match(/（([^）]+)）/);
      const r = buildAnalysis(rows[1] || rows[0] || {}, 'imr');
      r.viewTypeName = '回归分析';
      r.materialInfos = `${xName} vs ${yName}`;
      r.inspectionItemName = rMatch ? `r = ${rMatch[1]} (${lvMatch ? lvMatch[1] : corrLevel(Number(rMatch[1]))})` : '回归分析';
      r.inspectionItemUnitName = r2Match ? `R² = ${r2Match[1]}` : '';
      r.uslStr = '最小二乘拟合';
      r.lslStr = '时间对齐样本对';
      return [r];
    }

    return [];
  }

  global.SPC_COMPARE_DEMO = {
    CHART_TABS: COMPARE_CHART_TABS,
    REQUIRED_FIELDS: ['日期范围', '物料信息', '检验方案', '检验项', 'Y坐标'],
    REQUIRED_FIELDS_CTRL: ['日期范围', '采集方案', '采集项', 'Y坐标'],
    buildMultiChartOptions: buildCompareChartOptions,
    buildMultiTableRows: buildCompareTableRows,
    analysisColumns,
    sampleRows,
    buildAnalysis,
    normalizeCompareRows,
  };

})(typeof window !== 'undefined' ? window : globalThis);

/**
 * 计数型SPC（多图）Demo 辅助：P图 / NP图 / 定型选项分布图
 * 数据来源：检验数据台账中 itemType=ATTRIBUTE 的定型检验项
 * 暴露为 window.SPC_COUNT_DEMO，接口与 SPC_MULTI_DEMO 一致
 */
(function (global) {
  // ── 图类型 Tab 定义 ──────────────────────────────────────────────────────
  const COUNT_CHART_TABS = [
    { key: 'p',    label: 'P图',               dual: false, titles: ['P图（不合格品率控制图）'],  singleCol: false },
    { key: 'np',   label: 'NP图',              dual: false, titles: ['NP图（不合格品数控制图）'], singleCol: false },
    { key: 'attr', label: '不合格项分布柏拉图', dual: false, titles: ['不合格项分布柏拉图'],       singleCol: true  },
  ];

  const REQUIRED_FIELDS = ['日期范围', '物料信息', '检验方案', '定型检验项'];

  // ── 定型检验项库：各检验项的选项+占比 Mock 数据 ──────────────────────────
  const ATTRIBUTE_PROFILES = {
    '尺寸合格': {
      options: ['合格', '尺寸超差'],
      defectCodes: ['尺寸超差'],
      weights:  [0.78, 0.22],
      colors:   ['#52c41a', '#ff4d4f'],
    },
    '外观合格': {
      options: ['合格', '外观瑕疵'],
      defectCodes: ['外观瑕疵'],
      weights:  [0.86, 0.14],
      colors:   ['#52c41a', '#ff4d4f'],
    },
    '包装完好': {
      options: ['完好', '包装破损'],
      defectCodes: ['包装破损'],
      weights:  [0.93, 0.07],
      colors:   ['#52c41a', '#ff4d4f'],
    },
    '标识正确': {
      options: ['正确', '标识模糊'],
      defectCodes: ['标识模糊'],
      weights:  [0.97, 0.03],
      colors:   ['#52c41a', '#ff4d4f'],
    },
    '外观等级': {
      options: ['优良', '合格', '轻缺陷', '重缺陷'],
      defectCodes: ['轻缺陷', '重缺陷'],   // 视为"不合格"的选项
      weights:  [0.62, 0.22, 0.11, 0.05], // 出现概率
      colors:   ['#52c41a', '#1677ff', '#fa8c16', '#ff4d4f'],
    },
    '气孔有无': {
      options: ['无气孔', '有气孔'],
      defectCodes: ['有气孔'],
      weights:  [0.88, 0.12],
      colors:   ['#52c41a', '#ff4d4f'],
    },
    '气孔无': {
      options: ['无气孔', '有气孔'],
      defectCodes: ['有气孔'],
      weights:  [0.90, 0.10],
      colors:   ['#52c41a', '#ff4d4f'],
    },
    '裂纹检查': {
      options: ['无裂纹', '微裂纹', '明显裂纹'],
      defectCodes: ['微裂纹', '明显裂纹'],
      weights:  [0.84, 0.12, 0.04],
      colors:   ['#52c41a', '#fa8c16', '#ff4d4f'],
    },
    '裂纹无': {
      options: ['无裂纹', '有裂纹'],
      defectCodes: ['有裂纹'],
      weights:  [0.94, 0.06],
      colors:   ['#52c41a', '#ff4d4f'],
    },
    '翘曲合格': {
      options: ['合格', '翘曲超差'],
      defectCodes: ['翘曲超差'],
      weights:  [0.88, 0.12],
      colors:   ['#52c41a', '#ff4d4f'],
    },
    '色泽判定': {
      options: ['正常', '偏浅', '偏深', '异色'],
      defectCodes: ['偏浅', '偏深', '异色'],
      weights:  [0.78, 0.10, 0.09, 0.03],
      colors:   ['#52c41a', '#91caff', '#b37feb', '#ff4d4f'],
    },
    '包装完整性': {
      options: ['完好', '轻微破损', '严重破损'],
      defectCodes: ['轻微破损', '严重破损'],
      weights:  [0.91, 0.07, 0.02],
      colors:   ['#52c41a', '#fa8c16', '#ff4d4f'],
    },
    '合格判定': {
      options: ['合格', '不合格'],
      defectCodes: ['不合格'],
      weights:  [0.87, 0.13],
      colors:   ['#52c41a', '#ff4d4f'],
    },
  };

  const DEFAULT_PROFILE = {
    options: ['合格', '不合格'],
    defectCodes: ['不合格'],
    weights:  [0.87, 0.13],
    colors:   ['#52c41a', '#ff4d4f'],
  };

  function pickLabel(v, fallback) {
    if (Array.isArray(v)) v = v.length ? v[0] : '';
    if (v == null || v === '') return fallback;
    const s = String(v).trim();
    const i = s.indexOf('/');
    return (i >= 0 ? s.slice(i + 1) : s).trim() || fallback;
  }

  function seededInt(seed, mod) {
    let x = (seed * 1103515245 + 12345) & 0x7fffffff;
    return x % mod;
  }

  function getProfile(itemName) {
    const name = String(itemName || '');
    for (const key of Object.keys(ATTRIBUTE_PROFILES)) {
      if (name.includes(key)) return ATTRIBUTE_PROFILES[key];
    }
    return DEFAULT_PROFILE;
  }

  /** 生成 n 个批次的 Mock P图/NP图数据点 */
  function buildBatchSeries(profile, n, fixedSampleSize, seed) {
    const defectSet = new Set(profile.defectCodes);
    const batches = [];
    for (let i = 0; i < n; i++) {
      const sampleSize = fixedSampleSize || (20 + seededInt(seed + i * 7, 11));
      let defectCount = 0;
      for (let j = 0; j < sampleSize; j++) {
        const r = ((seed + i * 31 + j * 13) * 1103515245 + 12345) & 0x7fffffff;
        const ratio = (r % 1000) / 1000;
        let cum = 0;
        for (let k = 0; k < profile.options.length; k++) {
          cum += profile.weights[k];
          if (ratio < cum) {
            if (defectSet.has(profile.options[k])) defectCount++;
            break;
          }
        }
      }
      batches.push({ sampleSize, defectCount, p: defectCount / sampleSize });
    }
    return batches;
  }

  /** 计算 P图控制限 (三倍σ) */
  function calcPLimits(batches) {
    const totalDef = batches.reduce((s, b) => s + b.defectCount, 0);
    const totalN = batches.reduce((s, b) => s + b.sampleSize, 0);
    const pBar = totalDef / totalN;
    const nBar = totalN / batches.length;
    const sigma = Math.sqrt(pBar * (1 - pBar) / nBar);
    return {
      pBar,
      cl: pBar,
      ucl: Math.min(1, pBar + 3 * sigma),
      lcl: Math.max(0, pBar - 3 * sigma),
    };
  }

  /** 计算 NP图控制限 (固定样本量 n) */
  function calcNPLimits(batches, n) {
    const totalDef = batches.reduce((s, b) => s + b.defectCount, 0);
    const pBar = totalDef / (batches.length * n);
    const npBar = pBar * n;
    const sigma = Math.sqrt(npBar * (1 - pBar));
    return {
      pBar,
      npBar,
      cl: npBar,
      ucl: Math.min(n, npBar + 3 * sigma),
      lcl: Math.max(0, npBar - 3 * sigma),
    };
  }

  // ── ECharts option 构建 ─────────────────────────────────────────────────

  function buildPChartOption(itemName, batches, limits, batchLabels) {
    const oocColor = '#ff4d4f';
    const normalColor = '#1677ff';
    const pData = batches.map((b, i) => ({
      value: +(b.p * 100).toFixed(2),
      itemStyle: { color: (b.p > limits.ucl || b.p < limits.lcl) ? oocColor : normalColor },
    }));

    // 计算 Y 轴最大值 (百分比)，确保所有数据点及 UCL 线完全在视窗内，并留出合理余量
    const maxVal = Math.max(...batches.map(b => b.p * 100), limits.ucl * 100);
    let yMax = 10;
    if (maxVal > 50) {
      yMax = Math.min(100, Math.ceil((maxVal * 1.1) / 10) * 10);
    } else if (maxVal > 20) {
      yMax = Math.min(100, Math.ceil((maxVal * 1.15) / 5) * 5);
    } else if (maxVal > 5) {
      yMax = Math.ceil((maxVal * 1.2) / 5) * 5;
    } else {
      yMax = Math.max(5, Math.ceil(maxVal * 1.3));
    }

    return {
      title: {
        text: `${itemName} — P图`,
        left: 14, top: 10,
        textStyle: { fontSize: 13, fontWeight: 600, color: '#1a1a2e' },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const i = params[0].dataIndex;
          const b = batches[i];
          return `批次 ${batchLabels[i]}<br/>样本量 n=${b.sampleSize}<br/>不合格数=${b.defectCount}<br/>不合格率 p=${(b.p*100).toFixed(2)}%<br/>UCL=${(limits.ucl*100).toFixed(2)}%<br/>CL=${(limits.cl*100).toFixed(2)}%<br/>LCL=${(limits.lcl*100).toFixed(2)}%`;
        },
      },
      grid: { left: 52, right: 18, top: 46, bottom: 36 },
      xAxis: {
        type: 'category', data: batchLabels,
        axisLabel: { fontSize: 11, rotate: batchLabels.length > 15 ? 30 : 0 },
      },
      yAxis: {
        type: 'value', name: '不合格品率(%)',
        nameTextStyle: { fontSize: 11 },
        axisLabel: { formatter: '{value}%', fontSize: 11 },
        min: 0,
        max: yMax,
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      series: [
        {
          name: 'p(%)',
          type: 'line', data: pData,
          symbol: 'circle',
          symbolSize: (val, params) => {
            const b = batches[params.dataIndex];
            return (b && (b.p > limits.ucl || b.p < limits.lcl)) ? 9 : 6;
          },
          lineStyle: { width: 2, color: normalColor },
        },
        {
          name: 'UCL', type: 'line',
          data: batches.map(() => +(limits.ucl * 100).toFixed(2)),
          lineStyle: { type: 'dashed', color: '#ff4d4f', width: 1.5 },
          symbol: 'none', itemStyle: { color: '#ff4d4f' },
        },
        {
          name: 'CL', type: 'line',
          data: batches.map(() => +(limits.cl * 100).toFixed(2)),
          lineStyle: { color: '#52c41a', width: 1.5 },
          symbol: 'none', itemStyle: { color: '#52c41a' },
        },
        {
          name: 'LCL', type: 'line',
          data: batches.map(() => Math.max(0, +(limits.lcl * 100).toFixed(2))),
          lineStyle: { type: 'dashed', color: '#ff4d4f', width: 1.5 },
          symbol: 'none', itemStyle: { color: '#ff4d4f' },
        },
      ],
      legend: { data: ['p(%)', 'UCL', 'CL', 'LCL'], top: 10, right: 14, textStyle: { fontSize: 11 } },
    };
  }

  function buildNPChartOption(itemName, batches, limits, n, batchLabels) {
    const oocColor = '#ff4d4f';
    const normalColor = '#722ed1';
    const npData = batches.map((b) => ({
      value: b.defectCount,
      itemStyle: { color: (b.defectCount > limits.ucl || b.defectCount < limits.lcl) ? oocColor : normalColor },
    }));
    return {
      title: {
        text: `${itemName} — NP图`,
        left: 14, top: 10,
        textStyle: { fontSize: 13, fontWeight: 600, color: '#1a1a2e' },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const i = params[0].dataIndex;
          const b = batches[i];
          return `批次 ${batchLabels[i]}<br/>固定样本量 n=${n}<br/>不合格数 np=${b.defectCount}<br/>UCL=${limits.ucl.toFixed(1)}<br/>CL=${limits.cl.toFixed(1)}<br/>LCL=${Math.max(0,limits.lcl).toFixed(1)}`;
        },
      },
      grid: { left: 52, right: 18, top: 46, bottom: 36 },
      xAxis: {
        type: 'category', data: batchLabels,
        axisLabel: { fontSize: 11, rotate: batchLabels.length > 15 ? 30 : 0 },
      },
      yAxis: {
        type: 'value', name: '不合格品数(np)',
        nameTextStyle: { fontSize: 11 },
        axisLabel: { fontSize: 11 },
        min: 0,
        max: Math.ceil(Math.max(...batches.map(b => b.defectCount), limits.ucl) * 1.2) || 5,
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      series: [
        {
          name: 'np',
          type: 'line', data: npData,
          symbol: 'circle',
          symbolSize: (val, params) => {
            const b = batches[params.dataIndex];
            return (b && (b.defectCount > limits.ucl || b.defectCount < limits.lcl)) ? 9 : 6;
          },
          lineStyle: { width: 2, color: normalColor },
        },
        {
          name: 'UCL', type: 'line',
          data: batches.map(() => +limits.ucl.toFixed(2)),
          lineStyle: { type: 'dashed', color: '#ff4d4f', width: 1.5 },
          symbol: 'none', itemStyle: { color: '#ff4d4f' },
        },
        {
          name: 'CL', type: 'line',
          data: batches.map(() => +limits.cl.toFixed(2)),
          lineStyle: { color: '#52c41a', width: 1.5 },
          symbol: 'none', itemStyle: { color: '#52c41a' },
        },
        {
          name: 'LCL', type: 'line',
          data: batches.map(() => Math.max(0, +limits.lcl.toFixed(2))),
          lineStyle: { type: 'dashed', color: '#ff4d4f', width: 1.5 },
          symbol: 'none', itemStyle: { color: '#ff4d4f' },
        },
      ],
      legend: { data: ['np', 'UCL', 'CL', 'LCL'], top: 10, right: 14, textStyle: { fontSize: 11 } },
    };
  }

  function buildAttrDistOption(itemName, profile, batches) {
    const defectSet = new Set(profile.defectCodes);
    const totalSamples = batches.reduce((s, b) => s + b.sampleSize, 0);
    // 统计各选项频次
    const freq = {};
    profile.options.forEach(opt => { freq[opt] = 0; });
    batches.forEach(b => {
      profile.options.forEach((opt, k) => {
        const count = Math.round(b.sampleSize * profile.weights[k]);
        freq[opt] = (freq[opt] || 0) + count;
      });
    });
    const total = Object.values(freq).reduce((s, v) => s + v, 0) || 1;
    const barData = profile.options.map(opt => ({
      name: opt,
      value: freq[opt],
      pct: +((freq[opt] / total) * 100).toFixed(1),
      itemStyle: { color: profile.colors[profile.options.indexOf(opt)] || '#1677ff' },
    }));

    // 柏拉图累计线数据
    let cum = 0;
    const cumulativeData = barData.map(d => { cum += d.pct; return +cum.toFixed(1); });

    return {
      title: {
        text: `${itemName} — 定型选项分布`,
        left: 14, top: 10,
        textStyle: { fontSize: 13, fontWeight: 600, color: '#1a1a2e' },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const i = params[0].dataIndex;
          const d = barData[i];
          const tag = defectSet.has(d.name) ? ' ⚠️不合格' : '';
          return `<b>${d.name}${tag}</b><br/>频次：${d.value}<br/>占比：${d.pct}%<br/>累计：${cumulativeData[i]}%`;
        },
      },
      grid: { left: 56, right: 56, top: 50, bottom: 36 },
      xAxis: {
        type: 'category',
        data: profile.options,
        axisLabel: { fontSize: 12 },
      },
      yAxis: [
        {
          type: 'value', name: '频次',
          nameTextStyle: { fontSize: 11 },
          axisLabel: { fontSize: 11 },
          position: 'left',
        },
        {
          type: 'value', name: '累计占比(%)',
          nameTextStyle: { fontSize: 11 },
          axisLabel: { fontSize: 11, formatter: '{value}%' },
          position: 'right',
          min: 0, max: 100,
        },
      ],
      series: [
        {
          name: '频次',
          type: 'bar',
          data: barData.map(d => ({ value: d.value, itemStyle: d.itemStyle })),
          barMaxWidth: 60,
          label: {
            show: true, position: 'top',
            formatter: (p) => `${p.value}\n(${barData[p.dataIndex].pct}%)`,
            fontSize: 11,
          },
        },
        {
          name: '累计占比',
          type: 'line',
          yAxisIndex: 1,
          data: cumulativeData,
          symbol: 'circle', symbolSize: 7,
          lineStyle: { color: '#1677ff', width: 2, type: 'dashed' },
          itemStyle: { color: '#1677ff' },
          label: { show: false },
        },
        // 不合格线（80%参考线，用于区分主因）
        {
          name: '80%基准',
          type: 'line',
          yAxisIndex: 1,
          data: profile.options.map(() => 80),
          lineStyle: { color: '#ff4d4f', width: 1, type: 'dotted' },
          symbol: 'none', itemStyle: { color: '#ff4d4f' },
        },
      ],
      legend: {
        data: ['频次', '累计占比', '80%基准'],
        top: 10, right: 14, textStyle: { fontSize: 11 },
      },
    };
  }

  // ── 公共入口：按检验项列表批量出图 ──────────────────────────────────────

  // ── 公共入口：按检验项列表批量出图 ──────────────────────────────────────

  function getItemList(query) {
    const v = query && (
      query['定型检验项'] != null ? query['定型检验项'] :
      (query['检验项'] != null ? query['检验项'] :
      (query['采集项'] != null ? query['采集项'] : null))
    );
    if (Array.isArray(v)) {
      const filtered = v.filter(x => x != null && String(x).trim() !== '');
      if (filtered.length) return filtered;
    } else if (v != null && String(v).trim() !== '') {
      return [v];
    }
    return ['尺寸合格', '外观合格', '包装完好', '标识正确'];
  }

  function makeBatchLabels(n) {
    const labels = [];
    const base = new Date(2026, 5, 1); // 2026-06-01 开始
    for (let i = 0; i < n; i++) {
      const d = new Date(base.getTime() + i * 86400000 * 2);
      labels.push(`${d.getMonth()+1}/${d.getDate()}`);
    }
    return labels;
  }

  /** 构建以「检验项目」为 X 轴的不合格项分布柏拉图 */
  function buildMultiItemParetoOption(itemsData, totalSamples, material, scheme) {
    const totalDefects = itemsData.reduce((s, it) => s + it.defectCount, 0) || 1;
    let acc = 0;
    const cumData = itemsData.map(it => {
      acc += it.defectCount;
      return +((acc / totalDefects) * 100).toFixed(1);
    });

    const xLabels = itemsData.map(it => it.name);
    const barData = itemsData.map((it, idx) => {
      const share = +((it.defectCount / totalDefects) * 100).toFixed(1);
      return {
        value: it.defectCount,
        share: share,
        cumShare: cumData[idx],
        defectRate: it.defectRate,
        sampleSize: it.sampleSize,
        itemStyle: {
          color: idx === 0 ? '#ff4d4f' : (idx === 1 ? '#fa8c16' : (idx === 2 ? '#1677ff' : '#52c41a')),
        },
      };
    });

    return {
      title: {
        text: '不合格项分布柏拉图（各检验项缺陷频次与累计占比 Pareto）',
        subtext: `物料：${material || '全部'} ｜ 方案：${scheme || '全部'} ｜ 样本总数：${totalSamples} ｜ 不合格总数：${totalDefects} 件`,
        left: 14, top: 10,
        textStyle: { fontSize: 13, fontWeight: 600, color: '#1a1a2e' },
        subtextStyle: { fontSize: 11, color: '#666' },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const i = params[0].dataIndex;
          const d = barData[i];
          const itemName = xLabels[i];
          const isKey = d.cumShare <= 80 || i === 0;
          const priority = isKey ? '🔴 ★★★ 首要关键缺陷' : (d.cumShare <= 95 ? '🟡 ★★☆ 次要改善项' : '🟢 ★☆☆ 一般问题');
          return `<b>检验项目（X轴）：${itemName}</b><br/>` +
                 `不合格数：<b style="color:#ff4d4f">${d.value}</b> 件<br/>` +
                 `不合格率：${d.defectRate}%<br/>` +
                 `缺陷占比：${d.share}%<br/>` +
                 `累计占比：${d.cumShare}%<br/>` +
                 `改善优先级：${priority}`;
        },
      },
      legend: {
        data: ['不合格数', '累计占比', '80%基准线'],
        top: 10, right: 14, textStyle: { fontSize: 11 },
      },
      grid: { left: 56, right: 56, top: 64, bottom: 40 },
      xAxis: {
        type: 'category',
        data: xLabels,
        axisLabel: { fontSize: 12, fontWeight: 500, rotate: xLabels.length > 6 ? 20 : 0 },
        axisTick: { alignWithLabel: true },
      },
      yAxis: [
        {
          type: 'value',
          name: '不合格数 (件)',
          nameTextStyle: { fontSize: 11 },
          axisLabel: { fontSize: 11 },
          splitLine: { show: true, lineStyle: { type: 'dashed', color: '#eee' } },
        },
        {
          type: 'value',
          name: '累计占比 (%)',
          nameTextStyle: { fontSize: 11 },
          axisLabel: { fontSize: 11, formatter: '{value}%' },
          min: 0, max: 100,
          position: 'right',
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '不合格数',
          type: 'bar',
          data: barData.map(d => ({ value: d.value, itemStyle: d.itemStyle })),
          barMaxWidth: 56,
          label: {
            show: true,
            position: 'top',
            formatter: (p) => `${p.value}件\n(${barData[p.dataIndex].share}%)`,
            fontSize: 11,
          },
        },
        {
          name: '累计占比',
          type: 'line',
          yAxisIndex: 1,
          data: cumData,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { color: '#fa8c16', width: 2.5 },
          itemStyle: { color: '#fa8c16' },
          label: {
            show: true,
            position: 'right',
            formatter: '{c}%',
            fontSize: 10,
            color: '#fa8c16',
          },
        },
        {
          name: '80%基准线',
          type: 'line',
          yAxisIndex: 1,
          data: xLabels.map(() => 80),
          symbol: 'none',
          lineStyle: { color: '#ff4d4f', width: 1.5, type: 'dashed' },
          markLine: {
            symbol: 'none',
            data: [{ yAxis: 80, name: '80%二八分界线' }],
            label: { formatter: '80% 核心改善界限', position: 'insideEndTop', color: '#ff4d4f' },
          },
        },
      ],
    };
  }

  function buildCountChartOptions(chartKey, query) {
    const items = getItemList(query);
    const list = items.length ? items : ['外观合格'];
    const N_BATCHES = 20;
    const FIXED_N = 25; // NP图固定样本量
    const batchLabels = makeBatchLabels(N_BATCHES);
    const material = pickLabel(query['物料信息'], '电子级高纯硅烷(SiH4)');
    const scheme = pickLabel(query['检验方案'], '出厂检验方案');
    function ledgerCountBatches(itemName) {
      if (!global.QC_SPC_LINK || (query && (query['采集方案'] || query['采集项']))) return [];
      return global.QC_SPC_LINK.countBatches(Object.assign({}, query, { 定型检验项: itemName, 检验项: itemName })) || [];
    }

    // 针对「不合格项分布柏拉图」Tab：X 轴放置各个检验项目，综合展示各检验项的缺陷对比
    if (chartKey === 'attr') {
      let totalSamplesAll = 0;
      const itemsData = list.map((itemRaw, idx) => {
        const itemName = pickLabel(itemRaw, '外观合格');
        const profile = getProfile(itemName);
        const seed = 137 + idx * 53;
        const ledgerB = ledgerCountBatches(itemName);
        const batches = ledgerB.length ? ledgerB : buildBatchSeries(profile, N_BATCHES, null, seed);
        const defectCount = batches.reduce((s, b) => s + b.defectCount, 0);
        const sampleSize = batches.reduce((s, b) => s + b.sampleSize, 0);
        totalSamplesAll += sampleSize;
        const defectRate = +((defectCount / sampleSize) * 100).toFixed(2);
        return {
          name: itemName,
          defectCount,
          sampleSize,
          defectRate,
        };
      });

      // 严格按不合格数降序排列
      itemsData.sort((a, b) => b.defectCount - a.defectCount);
      return [buildMultiItemParetoOption(itemsData, totalSamplesAll, material, scheme)];
    }

    return list.map((itemRaw, idx) => {
      const itemName = pickLabel(itemRaw, '外观合格');
      const profile = getProfile(itemName);
      const seed = 137 + idx * 53;
      const ledgerB = ledgerCountBatches(itemName);
      const batches = ledgerB.length ? ledgerB : buildBatchSeries(profile, N_BATCHES, chartKey === 'np' ? FIXED_N : null, seed);
      const labels = ledgerB.length ? ledgerB.map((b) => b.batch) : batchLabels;

      if (chartKey === 'p') {
        const limits = calcPLimits(batches);
        return buildPChartOption(itemName, batches, limits, labels);
      }
      if (chartKey === 'np') {
        const limits = calcNPLimits(batches, FIXED_N);
        return buildNPChartOption(itemName, batches, limits, FIXED_N, labels);
      }
      return buildPChartOption(itemName, batches, calcPLimits(batches), labels);
    });
  }

  // ── 分析表格 ─────────────────────────────────────────────────────────────

  function buildCountTableRows(query, chartKey) {
    const items = getItemList(query);
    const list = items.length ? items : ['外观合格'];
    const FIXED_N = 25;
    const N_BATCHES = 20;
    const material = pickLabel(query['物料信息'], '电子级高纯硅烷(SiH4)');
    const scheme = pickLabel(query['检验方案'], '出厂检验方案');

    if (chartKey === 'attr') {
      // 不合格项分布柏拉图表格：每一行对应一个检验项目，按不合格数降序排列
      const itemsData = list.map((itemRaw, idx) => {
        const itemName = pickLabel(itemRaw, '外观合格');
        const profile = getProfile(itemName);
        const seed = 137 + idx * 53;
        const batches = buildBatchSeries(profile, N_BATCHES, null, seed);
        const totalDef = batches.reduce((s, b) => s + b.defectCount, 0);
        const totalN = batches.reduce((s, b) => s + b.sampleSize, 0);
        const defectRate = +((totalDef / totalN) * 100).toFixed(2);
        return {
          name: itemName,
          defectCount: totalDef,
          sampleSize: totalN,
          defectRate,
        };
      });

      itemsData.sort((a, b) => b.defectCount - a.defectCount);
      const totalDefects = itemsData.reduce((s, it) => s + it.defectCount, 0) || 1;
      let cumDef = 0;

      return itemsData.map((it, idx) => {
        cumDef += it.defectCount;
        const share = +((it.defectCount / totalDefects) * 100).toFixed(1);
        const cumShare = +((cumDef / totalDefects) * 100).toFixed(1);
        const isKey = cumShare <= 80 || idx === 0;
        const priority = isKey ? '★★★ (首要关键)' : (cumShare <= 95 ? '★★☆ (次要改善)' : '★☆☆ (一般影响)');
        return {
          materialInfos: material,
          inspectionSchemeName: scheme,
          inspectionItemName: it.name,
          总样本量: it.sampleSize,
          不合格品数: it.defectCount,
          '不合格率(%)': it.defectRate + '%',
          '缺陷占比(%)': share + '%',
          '累计占比(%)': cumShare + '%',
          改善优先级: priority,
        };
      });
    }

    return list.map((itemRaw, idx) => {
      const itemName = pickLabel(itemRaw, '外观合格');
      const profile = getProfile(itemName);
      const seed = 137 + idx * 53;
      const batches = buildBatchSeries(profile, N_BATCHES, chartKey === 'np' ? FIXED_N : null, seed);
      const totalDef = batches.reduce((s, b) => s + b.defectCount, 0);
      const totalN = batches.reduce((s, b) => s + b.sampleSize, 0);
      const pBar = totalDef / totalN;
      const oocCount = batches.filter(b => {
        if (chartKey === 'np') {
          const lim = calcNPLimits(batches, FIXED_N);
          return b.defectCount > lim.ucl || b.defectCount < lim.lcl;
        }
        const lim = calcPLimits(batches);
        return b.p > lim.ucl || b.p < lim.lcl;
      }).length;

      const pLim = calcPLimits(batches);
      const npLim = chartKey === 'np' ? calcNPLimits(batches, FIXED_N) : null;
      return [{
        materialInfos: material,
        inspectionSchemeName: scheme,
        样本批数: N_BATCHES,
        总样本量: totalN,
        不合格品数: totalDef,
        '平均不合格品率p̄(%)': +(pBar * 100).toFixed(2),
        '平均样本量n̄': chartKey === 'np' ? FIXED_N : +(totalN / N_BATCHES).toFixed(1),
        UCL: chartKey === 'np' ? +npLim.ucl.toFixed(3) : +(pLim.ucl * 100).toFixed(2) + '%',
        CL: chartKey === 'np' ? +npLim.cl.toFixed(3) : +(pLim.cl * 100).toFixed(2) + '%',
        LCL: chartKey === 'np' ? Math.max(0, +npLim.lcl.toFixed(3)) : Math.max(0, +(pLim.lcl * 100).toFixed(2)) + '%',
        OOC点数: oocCount,
        'OOC率(%)': +((oocCount / N_BATCHES) * 100).toFixed(1),
        inspectionItemName: itemName,
        viewTypeName: COUNT_CHART_TABS.find(t => t.key === chartKey)?.label || '',
      }];
    }).flat();
  }

  function countAnalysisColumns(chartKey) {
    if (chartKey === 'attr') {
      return [
        ['物料信息', 'materialInfos'],
        ['检验方案', 'inspectionSchemeName'],
        ['检验项目 (X轴)', 'inspectionItemName'],
        ['总样本量', '总样本量'],
        ['不合格数', '不合格品数'],
        ['不合格率(%)', '不合格率(%)'],
        ['缺陷占比(%)', '缺陷占比(%)'],
        ['累计占比(%)', '累计占比(%)'],
        ['改善优先级', '改善优先级'],
      ];
    }
    return [
      ['物料信息', 'materialInfos'],
      ['检验方案', 'inspectionSchemeName'],
      ['检验项', 'inspectionItemName'],
      ['图类型', 'viewTypeName'],
      ['样本批数', '样本批数'],
      ['总样本量', '总样本量'],
      ['不合格品数', '不合格品数'],
      ['平均不合格品率p̄(%)', '平均不合格品率p̄(%)'],
      ['平均样本量n̄', '平均样本量n̄'],
      ['UCL', 'UCL'],
      ['CL', 'CL'],
      ['LCL', 'LCL'],
      ['OOC点数', 'OOC点数'],
      ['OOC率(%)', 'OOC率(%)'],
    ];
  }

  function countSampleRows(query) {
    const link = global.QC_SPC_LINK;
    if (link && !(query && (query['采集方案'] || query['采集项']))) {
      const pts = link.filterQualPoints(query);
      if (pts.length) {
        return pts.map((p, i) => ({
          序号: i + 1,
          样本编号: p.sampleNum,
          检验项: p.itemName,
          检验结果: p.val,
          是否不合格: p.isDefect ? '是' : '否',
          检验时间: p.inspectTime,
          报检批号: p.batchNumber,
          _fromLedger: true,
        }));
      }
    }
    const items = getItemList(query);
    const rows = [];
    items.forEach((itemRaw, idx) => {
      const itemName = pickLabel(itemRaw, '外观等级');
      const profile = getProfile(itemName);
      for (let i = 0; i < 8; i++) {
        const r = (137 + idx * 53 + i * 29) * 1103515245 & 0x7fffffff;
        const ratio = (r % 1000) / 1000;
        let cum = 0, picked = profile.options[0];
        for (let k = 0; k < profile.options.length; k++) {
          cum += profile.weights[k];
          if (ratio < cum) { picked = profile.options[k]; break; }
        }
        rows.push({
          序号: rows.length + 1,
          样本编号: `S-${String(rows.length + 1).padStart(3, '0')}`,
          检验项: itemName,
          检验结果: picked,
          是否不合格: new Set(profile.defectCodes).has(picked) ? '是' : '否',
          检验时间: `2026-06-${String(1 + i * 2).padStart(2, '0')} 09:30`,
        });
      }
    });
    return rows;
  }

  global.SPC_COUNT_DEMO = {
    CHART_TABS: COUNT_CHART_TABS,
    REQUIRED_FIELDS,
    buildMultiChartOptions: buildCountChartOptions,
    buildMultiTableRows: buildCountTableRows,
    analysisColumns: countAnalysisColumns,
    sampleRows: countSampleRows,
  };

})(typeof window !== 'undefined' ? window : globalThis);
