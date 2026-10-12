/**
 * 样品检验台账 → 检验SPC 闭环联通
 * 事实源：MOCK['qc-ledger']（已完成 + 有实测值）
 * 对齐试用系统：SPCSearchDto 按日期/物料/方案/检验项回查台账明细
 * 中控SPC 不走本模块（仍读中控参数台账 / 采集项）
 */
(function (global) {
  const TAB_BAG = {
    purchase: 'purchase-incoming-material',
    process: 'produce-process',
    material: 'produce-material',
  };
  const TAB_ALIAS = {
    purchase: 'purchase',
    'purchase-incoming': 'purchase',
    'purchase-incoming-material': 'purchase',
    incoming: 'purchase',
    process: 'process',
    'produce-process': 'process',
    material: 'material',
    'produce-material': 'material',
  };

  function tokens(v) {
    if (v == null || v === '') return [];
    if (Array.isArray(v)) return v.flatMap(tokens);
    const s = String(v).trim();
    if (!s) return [];
    const parts = s.split('/').map((x) => x.trim()).filter(Boolean);
    return [s].concat(parts);
  }
  function norm(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, '');
  }
  function matchToken(queryVal, ...cands) {
    if (queryVal == null || queryVal === '' || (Array.isArray(queryVal) && !queryVal.length)) return true;
    const q = tokens(queryVal).map(norm).filter(Boolean);
    const c = cands.flatMap(tokens).map(norm).filter(Boolean);
    return q.some((qt) => c.some((ct) => ct === qt || ct.indexOf(qt) >= 0 || qt.indexOf(ct) >= 0));
  }
  function itemAliases(itemName) {
    return [itemName];
  }
  function inferTab(query) {
    const raw = (query && (query._tab || query._spcTab)) || '';
    if (TAB_ALIAS[raw]) return TAB_ALIAS[raw];
    if (query && (query['采集方案'] || query['采集项'] || query['产线名称'])) return '';
    return '';
  }
  function toNum(v) {
    if (v == null || v === '' || v === '—' || v === '-') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function isCompleted(row) {
    const st = row.status != null ? Number(row.status) : (String(row['样品状态'] || '').indexOf('已完成') >= 0 ? 2 : 0);
    return st === 2;
  }
  function rowTime(row) {
    return row.inspectFinishTime || row['检验完成时间'] || row.inspectTime || row['报检时间'] || row.samplingTime || row['取样时间'] || '';
  }
  function inDateRange(range, row) {
    if (!range || !Array.isArray(range) || range.length < 2 || !range[0] || !range[1]) return true;
    const t = String(rowTime(row)).slice(0, 10);
    if (!t) return true;
    return t >= String(range[0]).slice(0, 10) && t <= String(range[1]).slice(0, 10);
  }
  function mockBag() {
    const mock = global.WMS_MOCK_ROWS || {};
    mock['qc-ledger'] = mock['qc-ledger'] || {};
    return mock['qc-ledger'];
  }
  function listRows(tabKey) {
    const bag = mockBag();
    if (tabKey && TAB_BAG[tabKey]) return bag[TAB_BAG[tabKey]] || [];
    return []
      .concat(bag['purchase-incoming-material'] || [])
      .concat(bag['produce-process'] || [])
      .concat(bag['produce-material'] || []);
  }
  function seedClosedLoop() {
    return 0;
  }
  function pointLabel(name) {
    if (!name) return '';
    const pts = ((global.WMS_MOCK_ROWS || {})['sampling-point'] || {}).main || [];
    const p = pts.find((x) => x['采样点名称'] === name);
    return p && p['采样点编码'] ? (p['采样点编码'] + '/' + name) : name;
  }
  function schemeLabel(row) {
    const code = row.inspectionSchemeName || row['检验方案'] || '';
    const label = row.inspectionSchemeLabel || '';
    if (label && String(label).indexOf('/') >= 0) return label;
    const bag = (global.WMS_MOCK_ROWS || {})['insp-scheme'] || {};
    const all = [].concat(bag.incoming || [], bag.process || [], bag.material || [], bag.cylinder || []);
    const hit = all.find((s) => s['方案编码'] === code);
    return hit ? (hit['方案编码'] + '/' + hit['方案名称']) : (label || code);
  }
  function partnerLabel(num, name) {
    if (!num && (!name || name === '—')) return '';
    if (num && name && name !== '—') return num + '/' + name;
    return num || name || '';
  }

  function filterQuantPoints(query) {
    const tab = inferTab(query);
    const rows = listRows(tab);
    const itemQ = query && (query['检验项'] || query['定型检验项']);
    const itemList = Array.isArray(itemQ) ? itemQ.filter(Boolean) : (itemQ ? [itemQ] : []);
    const points = [];
    rows.forEach((row) => {
      if (!isCompleted(row)) return;
      if (!inDateRange(query && query['日期范围'], row)) return;
      if (!matchToken(query && query['物料信息'], row.materialNum, row['物料编码'], row.materialName, row['物料名称'])) return;
      if (!matchToken(query && query['产品/物料'], row.materialNum, row['物料编码'], row.materialName, row['物料名称'])) return;
      if (!matchToken(query && query['检验方案'], row.inspectionSchemeName, row['检验方案'], row.inspectionSchemeLabel)) return;
      if (!matchToken(query && query['采样点'], row.samplingPointName, row['采样点'])) return;
      if (!matchToken(query && query['供应商信息'], row.supplierNum, row['供应商编码'], row.supplierName, row['供应商名称'])) return;
      if (!matchToken(query && query['客户信息'], row.customerNum, row['客户编码'], row.customerName, row['客户名称'])) return;
      (row.rationItems || []).forEach((it) => {
        const val = toNum(it.val);
        if (val == null) return;
        if (itemList.length && !itemList.some((q) => matchToken(q, it.name, it.code, ...itemAliases(it.name)))) return;
        points.push({
          sampleId: row.id,
          sampleNum: row.sampleNum || row['样品编号'],
          sampleSource: row.sampleSource || row['样品来源'],
          materialNum: row.materialNum || row['物料编码'],
          materialName: row.materialName || row['物料名称'],
          materialInfo: (row.materialNum || row['物料编码'] || '') + '/' + (row.materialName || row['物料名称'] || ''),
          samplingPoint: row.samplingPointName || row['采样点'],
          supplierInfo: row.supplierName || row['供应商名称'] || '—',
          customerInfo: row.customerName || row['客户名称'] || '—',
          scheme: row.inspectionSchemeName || row['检验方案'],
          schemeLabel: row.inspectionSchemeLabel || (row.inspectionSchemeName || row['检验方案']),
          batchNumber: row.batchNumber || row['报检批号'],
          inspectFinishTime: row.inspectFinishTime || row['检验完成时间'],
          inspectTime: rowTime(row),
          qualityOrderInspectionNo: row.qualityOrderInspectionNo || row['报检单号'],
          itemName: it.name,
          unit: it.unit || '',
          val,
          usl: toNum(it.usl),
          lsl: toNum(it.lsl),
          ucl: toNum(it.ucl),
          lcl: toNum(it.lcl),
          target: toNum(it.target),
          inspectResult: it.result || row['检验结论'] || '合格',
          deviationResult: it.dev || row['偏差结论'] || '—',
          abnormalDescription: row['异常描述'] || '',
        });
      });
    });
    points.sort((a, b) => String(a.inspectTime).localeCompare(String(b.inspectTime)) || String(a.sampleNum).localeCompare(String(b.sampleNum)));
    return points;
  }

  function filterQualPoints(query) {
    const tab = inferTab(query);
    const rows = listRows(tab);
    const itemQ = query && (query['定型检验项'] || query['检验项']);
    const itemList = Array.isArray(itemQ) ? itemQ.filter(Boolean) : (itemQ ? [itemQ] : []);
    const points = [];
    rows.forEach((row) => {
      if (!isCompleted(row)) return;
      if (!inDateRange(query && query['日期范围'], row)) return;
      if (!matchToken(query && query['物料信息'], row.materialNum, row['物料编码'], row.materialName, row['物料名称'])) return;
      if (!matchToken(query && query['产品/物料'], row.materialNum, row['物料编码'], row.materialName, row['物料名称'])) return;
      if (!matchToken(query && query['检验方案'], row.inspectionSchemeName, row['检验方案'], row.inspectionSchemeLabel)) return;
      (row.qualitativeItems || []).forEach((it) => {
        if (itemList.length && !itemList.some((q) => matchToken(q, it.name))) return;
        const fail = String(it.result || '') === '不合格';
        points.push({
          sampleNum: row.sampleNum || row['样品编号'],
          batchNumber: row.batchNumber || row['报检批号'],
          inspectTime: rowTime(row),
          itemName: it.name,
          val: it.val,
          result: it.result || '合格',
          isDefect: fail,
          materialInfo: (row.materialNum || '') + '/' + (row.materialName || ''),
          scheme: row.inspectionSchemeName || row['检验方案'],
        });
      });
    });
    return points;
  }

  function stats(vals) {
    const n = vals.length;
    if (!n) return { n: 0, mean: 0, std: 0, min: 0, max: 0 };
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    let ss = 0;
    for (let i = 0; i < n; i++) ss += (vals[i] - mean) * (vals[i] - mean);
    const std = n > 1 ? Math.sqrt(ss / (n - 1)) : 0;
    return { n, mean, std, min: Math.min.apply(null, vals), max: Math.max.apply(null, vals) };
  }

  function limitsFromPoints(pts) {
    const s = stats(pts.map((p) => p.val));
    const p0 = pts[0] || {};
    const usl = p0.usl != null ? p0.usl : s.mean + 3 * (s.std || 1);
    const lsl = p0.lsl != null ? p0.lsl : Math.max(0, s.mean - 3 * (s.std || 1));
    const ucl = p0.ucl != null ? p0.ucl : s.mean + 3 * (s.std || 1);
    const lcl = p0.lcl != null ? p0.lcl : s.mean - 3 * (s.std || 1);
    return {
      USL: usl, LSL: lsl, UCL: ucl, LCL: lcl,
      CL: +s.mean.toFixed(6),
      UWL: ucl - (ucl - s.mean) * 0.35,
      LWL: lcl + (s.mean - lcl) * 0.35,
      stats: s,
    };
  }

  function groupXbar(pts) {
    const by = {};
    pts.forEach((p) => {
      const k = p.batchNumber || p.sampleNum;
      (by[k] = by[k] || []).push(p);
    });
    const keys = Object.keys(by);
    const multi = keys.filter((k) => by[k].length >= 2);
    if (multi.length >= 6) {
      return keys.map((k) => ({ batch: k, vals: by[k].map((p) => p.val), time: by[k][0].inspectTime }));
    }
    const groups = [];
    for (let i = 0; i < pts.length; i += 5) {
      const slice = pts.slice(i, i + 5);
      if (slice.length < 2) break;
      groups.push({ batch: slice[0].batchNumber || slice[0].sampleNum, vals: slice.map((p) => p.val), time: slice[0].inspectTime });
    }
    return groups;
  }

  function chartPayload(pts) {
    if (!pts || !pts.length) return null;
    const lim = limitsFromPoints(pts);
    const cats = pts.map((p) => p.sampleNum);
    const vals = pts.map((p) => p.val);
    const groups = groupXbar(pts);
    const xbar = groups.map((g) => +(g.vals.reduce((a, b) => a + b, 0) / g.vals.length).toFixed(6));
    const r = groups.map((g) => +(Math.max.apply(null, g.vals) - Math.min.apply(null, g.vals)).toFixed(6));
    const sArr = groups.map((g) => +stats(g.vals).std.toFixed(6));
    const mr = [];
    for (let i = 1; i < vals.length; i++) mr.push(+Math.abs(vals[i] - vals[i - 1]).toFixed(6));
    return {
      fromLedger: true,
      cats,
      vals,
      mr,
      mrCats: cats.slice(1),
      xbarCats: groups.map((g) => g.batch),
      xbar,
      r,
      s: sArr,
      limits: lim,
      itemName: pts[0].itemName,
      unit: pts[0].unit,
      points: pts,
      groups,
    };
  }

  function toSampleRows(pts) {
    return (pts || []).map((p) => ({
      inspectResultName: p.inspectResult,
      deviationResultNames: p.deviationResult,
      abnormalDescription: p.abnormalDescription || '',
      sampleNum: p.sampleNum,
      sampleSource: p.sampleSource,
      materialInfo: p.materialInfo,
      supplierInfo: p.supplierInfo,
      customerInfo: p.customerInfo,
      samplingPointInfo: p.samplingPoint,
      inspectionScheme: p.schemeLabel || p.scheme,
      batchNumber: p.batchNumber,
      inspectFinishTime: p.inspectFinishTime,
      qualityOrderInspectionNo: p.qualityOrderInspectionNo,
      inspectTime: p.inspectTime,
      itemValue: p.val,
      itemTitle: p.itemName + (p.unit ? '/' + p.unit : ''),
      _fromLedger: true,
    }));
  }

  function toAnalysis(pts, query, chartKey) {
    if (!pts || !pts.length) return null;
    const lim = limitsFromPoints(pts);
    const s = lim.stats;
    const p0 = pts[0];
    const oos = pts.filter((p) => p.inspectResult === '不合格').length;
    const ooc = pts.filter((p) => String(p.deviationResult || '').indexOf('控制') >= 0).length;
    const oow = pts.filter((p) => String(p.deviationResult || '').indexOf('OOW') >= 0).length;
    const oot = pts.filter((p) => String(p.abnormalDescription || '').indexOf('OOT') >= 0).length;
    const pass = pts.length - oos;
    const usl = lim.USL;
    const lsl = lim.LSL;
    const sigma = s.std || 0.000001;
    const cpu = usl != null ? (usl - s.mean) / (3 * sigma) : 0;
    const cpl = lsl != null ? (s.mean - lsl) / (3 * sigma) : 0;
    const cpk = Math.min(cpu || 99, cpl || 99);
    const cp = (usl != null && lsl != null) ? (usl - lsl) / (6 * sigma) : cpk;
    const grade = cpk >= 1.67 ? 'A+' : (cpk >= 1.33 ? 'A' : (cpk >= 1.0 ? 'B' : 'C'));
    const dec = s.mean > 10 ? 2 : (s.mean > 1 ? 4 : 6);
    const base = {
      materialInfos: p0.materialInfo,
      inspectionSchemeName: p0.schemeLabel || p0.scheme,
      sampleCount: pts.length,
      inspectionItemName: p0.itemName,
      inspectionItemUnitName: p0.unit,
      viewTypeName: chartKey || '',
      dl: '—',
      max: +s.max.toFixed(dec),
      min: +s.min.toFixed(dec),
      uslStr: String(lim.USL),
      lslStr: String(lim.LSL),
      uclStr: String(lim.UCL),
      lclStr: String(lim.LCL),
      clStr: String(lim.CL),
      uwlStr: String(+lim.UWL.toFixed(dec)),
      lwlStr: String(+lim.LWL.toFixed(dec)),
      averageStr: s.mean.toFixed(dec),
      sigmaStr: s.std.toFixed(dec),
      caStr: (Math.abs(s.mean - ((lim.USL + lim.LSL) / 2)) / ((lim.USL - lim.LSL) / 2 || 1)).toFixed(3),
      cpStr: cp.toFixed(2),
      cpuStr: cpu.toFixed(2),
      cplStr: cpl.toFixed(2),
      cpkStr: cpk.toFixed(2),
      cpkGrade: grade,
      ooc,
      oos,
      oow,
      oot,
      _fromLedger: true,
    };
    if (chartKey === 'scatterInterval' || chartKey === 'scatterSingle') {
      const groups = groupXbar(pts);
      const means = groups.map((g) => stats(g.vals).mean);
      return {
        materialInfos: p0.materialInfo,
        inspectionSchemeName: p0.schemeLabel || p0.scheme,
        inspectionItemName: p0.itemName,
        inspectionItemUnitName: p0.unit,
        viewTypeName: '单值区间图',
        batchCount: groups.length,
        totalSampleCount: pts.length,
        grandMean: s.mean.toFixed(dec),
        overallStdDev: s.std.toFixed(dec),
        maxBatchMean: means.length ? (Math.max.apply(null, means).toFixed(dec) + ' (' + groups[means.indexOf(Math.max.apply(null, means))].batch + ')') : '—',
        minBatchMean: means.length ? (Math.min.apply(null, means).toFixed(dec) + ' (' + groups[means.indexOf(Math.min.apply(null, means))].batch + ')') : '—',
        rangeMean: means.length > 1 ? (Math.max.apply(null, means) - Math.min.apply(null, means)).toFixed(dec) : '—',
        pooledStdDev: s.std.toFixed(dec),
        avgCiWidth: (1.96 * s.std / Math.sqrt(Math.max(1, pts.length / Math.max(1, groups.length)))).toFixed(dec),
        outlierCount: ooc + oos,
        _fromLedger: true,
      };
    }
    if (chartKey === 'passRate') {
      return {
        statisticsDate: (query && query['日期范围'] && query['日期范围'][0]) || String(p0.inspectTime).slice(0, 10),
        materialInfos: p0.materialInfo,
        totalNumber: pts.length,
        qualifiedNumber: pass,
        qualifiedRate: ((pass / pts.length) * 100).toFixed(2) + '%',
        _fromLedger: true,
      };
    }
    if (chartKey === 'pareto') {
      return {
        inspectionItemName: p0.itemName,
        materialInfos: p0.materialInfo,
        totalNumber: pts.length,
        wrongNumber: oos,
        unQualifiedRate: ((oos / pts.length) * 100).toFixed(2) + '%',
        unQualifiedAllRate: '100%',
        unQualifiedAccumulateRate: '100%',
        _fromLedger: true,
      };
    }
    if (chartKey === 'cpkTrend') {
      return {
        materialInfos: p0.materialInfo,
        inspectionSchemeName: p0.schemeLabel || p0.scheme,
        sampleCount: pts.length,
        inspectionItemName: p0.itemName,
        inspectionItemUnitName: p0.unit,
        viewTypeName: 'CPK趋势图',
        max: +(cpk + 0.2).toFixed(2),
        min: +Math.max(0.5, cpk - 0.3).toFixed(2),
        aLevelNumber: cpk >= 1.67 ? 1 : 0,
        bLevelNumber: cpk >= 1.33 && cpk < 1.67 ? 1 : 0,
        cLevelNumber: cpk >= 1.0 && cpk < 1.33 ? 1 : 0,
        dLevelNumber: cpk < 1.0 ? 1 : 0,
        eLevelNumber: 0,
        _fromLedger: true,
      };
    }
    return base;
  }

  function countBatches(query) {
    const pts = filterQualPoints(query);
    const by = {};
    pts.forEach((p) => {
      const k = p.batchNumber || p.sampleNum;
      by[k] = by[k] || { batch: k, sampleSize: 0, defectCount: 0, time: p.inspectTime, itemName: p.itemName };
      by[k].sampleSize += 1;
      if (p.isDefect) by[k].defectCount += 1;
    });
    return Object.keys(by).sort().map((k) => {
      const b = by[k];
      b.p = b.sampleSize ? b.defectCount / b.sampleSize : 0;
      return b;
    });
  }

  function optionsForTab(tab) {
    const rows = listRows(tab);
    const uniq = (arr) => Array.from(new Set(arr.filter((x) => x && x !== '—')));
    const mats = [];
    const points = [];
    const suppliers = [];
    const customers = [];
    const schemes = [];
    const items = [];
    const quals = [];
    rows.forEach((r) => {
      const num = r.materialNum || r['物料编码'];
      const name = r.materialName || r['物料名称'];
      if (num) mats.push(num + '/' + name);
      points.push(pointLabel(r.samplingPointName || r['采样点']));
      suppliers.push(partnerLabel(r.supplierNum || r['供应商编码'], r.supplierName || r['供应商名称']));
      customers.push(partnerLabel(r.customerNum || r['客户编码'], r.customerName || r['客户名称']));
      schemes.push(schemeLabel(r));
      (r.rationItems || []).forEach((it) => { if (it && it.name) items.push(it.name); });
      (r.qualitativeItems || []).forEach((it) => { if (it && it.name) quals.push(it.name); });
    });
    return {
      物料信息: uniq(mats),
      '产品/物料': uniq(mats),
      采样点: uniq(points),
      供应商信息: uniq(suppliers),
      客户信息: uniq(customers),
      检验方案: uniq(schemes),
      检验项: uniq(items),
      定型检验项: uniq(quals),
    };
  }

  function applyQueryOptions(cfg) {
    if (!cfg || !cfg.pages) return;
    const ids = ['spc-insp-single', 'spc-insp-multi', 'spc-insp-cmp', 'spc-insp-count', 'spc-report-create'];
    ids.forEach((id) => {
      const page = cfg.pages[id];
      if (!page || !page.tabViews) return;
      page.tabViews.forEach((tv) => {
        const tab = TAB_ALIAS[tv.name] || inferTab({ _tab: tv.name });
        if (!tab) return;
        const opts = optionsForTab(tab);
        (tv.queryFields || []).forEach((f) => {
          if (opts[f.name] && opts[f.name].length) f.options = opts[f.name];
        });
      });
    });
  }

  const api = {
    SERIES: [],
    seedClosedLoop,
    filterQuantPoints,
    filterQualPoints,
    chartPayload,
    toSampleRows,
    toAnalysis,
    countBatches,
    optionsForTab,
    applyQueryOptions,
    matchToken,
    inferTab,
  };
  global.QC_SPC_LINK = api;
})(typeof window !== 'undefined' ? window : globalThis);
