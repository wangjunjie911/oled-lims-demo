/**
 * 思特瑞 WMS Demo · 数据字典种子与字段绑定
 * - L1 通知/申请类单据各自维护「单据类型」字典（如采购收料通知单单据类型）
 * - L2 执行类单据（入库单/出库单等）无独立字典：单据类型直接继承关联 L1 单据
 * - 物料种类、客户类型、储罐类型等共享字典按模块分组
 * - PC/APP 下拉通过 optionsFor(pageId, field, tab, MOCK.dict) 读取启用项
 */
window.WMS_DICT = (function () {
  function g(id, code, name, parent, remark) {
    return { id: id, 编码: code, 名称: name, 上级字典: parent || '', 备注: remark || '', 系统开发: true, 分组节点: true };
  }
  function t(id, code, name, parent, remark) {
    return { id: id, 编码: code, 名称: name, 上级字典: parent || '', 备注: remark || '', 系统开发: true, 分组节点: false };
  }
  function i(id, typeId, code, name, remark) {
    return {
      id: id, typeId: typeId, 编码: code, 名称: name,
      启用状态: '启用', 创建人: '系统', 创建时间: '2026-08-01 08:00:00', 备注: remark || ''
    };
  }
  function itemsOf(typeId, pairs) {
    return pairs.map(function (p, idx) {
      return i(typeId + '-' + (idx + 1), typeId, p[0], p[1], p[2] || '');
    });
  }

  const types = [
    g('g-mat', 'MOD_MAT', '物料', '', '基础资料 · 物料'),
    g('g-cust', 'MOD_CUST', '客户', '', '基础资料 · 客户'),
    g('g-supp', 'MOD_SUPP', '供应商', '', '基础资料 · 供应商'),

    t('t1', 'MAT_KIND', '物料种类', 'g-mat', '物料主数据分类'),
    t('t2', 'MAT_SPEC', '物料规格', 'g-mat', '电子特气/粉体规格等级'),
    t('t3', 'CUST_TYPE', '客户类型', 'g-cust', ''),
    t('t4', 'SUPP_TYPE', '供应商类型', 'g-supp', ''),

    g('g-lab', 'MOD_LAB', '实验室资料', '', '实验室/检验基础资料'),
    t('d-chrom-col-model', 'CHROM_COL_MODEL', '色谱柱型号', 'g-lab', '色谱柱台账 · 色谱柱型号'),
    t('d-chrom-col-dept', 'CHROM_COL_DEPT', '责任部门', 'g-lab', '色谱柱台账 · 责任部门'),
    t('d-instr-inspect', 'INSTR_INSPECT_UNIT', '定检单位', 'g-lab', '仪器台账 · 定检单位'),
    t('d-instr-calib', 'INSTR_CALIB_UNIT', '外校单位', 'g-lab', '仪器台账 · 外校单位'),
  ];

  const items = []
    .concat(itemsOf('t1', [
      ['RAW', '原材料'], ['AUX', '辅料'], ['SEMI', '半成品'], ['FG', '成品'],
      ['PKG', '包装材料'], ['HAZ', '危化原料'], ['GAS', '气体'], ['LIQ', '液体']
    ]))
    .concat(itemsOf('t2', [
      ['EG5N', '5N (99.999%)'], ['EG7N', '7N'], ['IG', '工业级'],
      ['D50', 'D50=0.5μm'], ['Y2O3', '纯度≥99.99%'], ['NF3', 'NF3≥85%'],
      ['CYL', 'DOT-3AA'], ['EG', '电子级']
    ]))
    .concat(itemsOf('t3', [['DOM_C', '国内客户'], ['FOR_C', '国外客户']]))
    .concat(itemsOf('t4', [['DOM_S', '国内供应商'], ['FOR_S', '国外供应商'], ['OS', '委外加工商']]))
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    .concat(itemsOf('d-chrom-col-model', [
      ['P-7101B', 'P-7101B'], ['P-7101A', 'P-7101A'], ['Amide-1.7', 'Amide-1.7'],
      ['BEH-C18-130A', 'BEH-C18-130A'], ['Gow-mac592', 'Gow-mac592'], ['Gow-mac590', 'Gow-mac590'],
      ['HSS-T3-1.8', 'HSS-T3-1.8'], ['C18-5', 'C18-5'], ['RP-mAb-2.7', 'RP-mAb-2.7']
    ]))
    .concat(itemsOf('d-chrom-col-dept', [
      ['QA', '质检部'], ['RD', '研发部'], ['PROD', '生产部'], ['LAB', '实验室']
    ]))
    .concat(itemsOf('d-instr-inspect', [
      ['JD-01', '中国计量科学研究院'], ['JD-02', '省计量科学研究院'],
      ['JD-03', '市计量测试研究院'], ['JD-04', '国家化学检测中心']
    ]))
    .concat(itemsOf('d-instr-calib', [
      ['WC-01', '赛默飞世尔科技（中国）有限公司'], ['WC-02', '安捷伦科技（中国）有限公司'],
      ['WC-03', '岛津企业管理（中国）有限公司'], ['WC-04', '上海计量测试技术研究院'],
      ['WC-05', '梅特勒-托利多（中国）有限公司']
    ]))
    ;

  const binds = {
    '物料种类': 'MAT_KIND',
    '物料规格': 'MAT_SPEC',
    '客户类型': 'CUST_TYPE',
    '供应商类型': 'SUPP_TYPE',
                                                                                                                                                                                                                                                                                                        '色谱柱型号': 'CHROM_COL_MODEL',
    '责任部门': 'CHROM_COL_DEPT',
    '上次定检单位': 'INSTR_INSPECT_UNIT',
    '上次外校单位': 'INSTR_CALIB_UNIT',
  };

  const appFlows = {
    DOC_PO_IN_NOTICE: ['po-in-serial', 'po-in-count', 'po-in-tank'],
    DOC_PO_RET_NOTICE: ['po-ret-serial', 'po-ret-count'],
    DOC_OS_ISSUE_NOTICE: ['os-issue-serial', 'os-issue-count'],
    DOC_OS_RET_NOTICE: ['os-ret-serial', 'os-ret-count'],
    DOC_OS_RECV_NOTICE: ['os-recv-serial', 'os-recv-count', 'os-recv-tank'],
    DOC_OS_RMA_NOTICE: ['os-rma-serial', 'os-rma-count'],
    DOC_PROD_ISSUE_NOTICE: ['prod-pick-serial', 'prod-pick-count', 'prod-pick-tank'],
    DOC_PROD_RET_NOTICE: ['prod-ret-serial', 'prod-ret-count', 'prod-ret-tank'],
    DOC_PROD_IN_NOTICE: ['prod-in-serial', 'prod-in-count'],
    DOC_CS_RECV_NOTICE: ['trust-recv-serial', 'trust-recv-count', 'trust-recv-tank'],
    DOC_CS_RET_NOTICE: ['trust-ret-serial', 'trust-ret-count'],
    DOC_SO_PREOUT_NOTICE: ['so-preout-serial', 'so-preout-count'],
    DOC_SO_SHIP_NOTICE: ['so-ship-serial', 'so-ship-count'],
    DOC_SO_RET_NOTICE: ['so-rma-serial', 'so-rma-count'],
    DOC_OTH_IN_NOTICE: ['oth-in-serial', 'oth-in-count', 'oth-in-tank'],
    DOC_OTH_OUT_NOTICE: ['oth-out-serial', 'oth-out-count', 'oth-out-tank'],
    DOC_LOAD_NOTICE: ['wh-load'],
    DOC_XFER: ['inner-move'],
    DOC_DIRECT_XFER: ['xfer-serial', 'xfer-count'],
    DOC_SEQ: ['inner-xfer'],
    ST_TYPE: ['stock-take'],
    DOC_SCRAP: ['pkg-scrap'],
    DOC_FREEZE: ['pkg-freeze'],
    DOC_UNFREEZE: ['pkg-unfreeze'],
    DOC_OUTER_SPLIT: ['pkg-outer'],
  };
  Object.keys(appFlows).forEach(function (code) {
    appFlows[code].forEach(function (fid) {
      binds[fid + '|单据类型'] = code;
    });
  });
  binds['stock-take|盘点类型'] = 'ST_TYPE';
  ['prod-pick-serial', 'prod-pick-count', 'prod-pick-tank'].forEach(function (fid) {
    binds[fid + '|领料类型'] = 'PROD_ISSUE_PICK_TYPE';
  });

  const deprecatedTypeCodes = {
    DOC_PO_IN_ORDER: 1, DOC_PO_RET_OUT: 1, DOC_OS_ISSUE_OUT: 1, DOC_OS_RET_IN: 1,
    DOC_OS_RECV_IN: 1, DOC_OS_RMA_OUT: 1, DOC_PROD_ISSUE_OUT: 1, DOC_PROD_RET_IN: 1,
    DOC_PROD_IN_ORDER: 1, DOC_SO_PREOUT_OUT: 1, DOC_SO_SHIP_OUT: 1, DOC_SO_RET_IN: 1
  };
  const deprecatedTypeIds = {
    'd-po-in-o': 1, 'd-po-ret-o': 1, 'd-os-iss-o': 1, 'd-os-ret-o': 1,
    'd-os-rcv-o': 1, 'd-os-rma-o': 1, 'd-pr-iss-o': 1, 'd-pr-ret-o': 1,
    'd-pr-in-o': 1, 'd-so-pre-o': 1, 'd-so-ship-o': 1, 'd-so-ret-in': 1
  };

  function liveDict(mockDict) {
    if (mockDict && Array.isArray(mockDict.types) && mockDict.types.length) return mockDict;
    return { types: types, main: items };
  }
  function typeIdOf(code, dict) {
    const hit = (dict.types || []).find(function (x) { return x.编码 === code; });
    return hit ? hit.id : '';
  }
  function enabledNames(code, mockDict) {
    const dict = liveDict(mockDict);
    const tid = typeIdOf(code, dict);
    if (!tid) return [];
    const names = [];
    (dict.main || []).forEach(function (r) {
      if (r.typeId !== tid) return;
      if (r['启用状态'] === '禁用') return;
      const n = String(r['名称'] || '').trim();
      if (n && names.indexOf(n) < 0) names.push(n);
    });
    return names;
  }
  function resolveCode(pageId, field, tab) {
    if (!field) return '';
    const p = String(pageId || '');
    const tb = String(tab || '');
    if (p && tb && binds[p + '|' + tb + '|' + field]) return binds[p + '|' + tb + '|' + field];
    if (p && binds[p + '|' + field]) return binds[p + '|' + field];
    return binds[field] || '';
  }
  function optionsFor(pageId, field, tab, mockDict) {
    const code = resolveCode(pageId, field, tab);
    if (!code) return null;
    return enabledNames(code, mockDict);
  }
  function firstOption(pageId, field, tab, mockDict) {
    const opts = optionsFor(pageId, field, tab, mockDict) || [];
    return opts[0] || '';
  }
  function mergeInto(target) {
    if (!target) return false;
    if (!target.dict) target.dict = { types: [], main: [] };
    const dict = target.dict;
    dict.types = Array.isArray(dict.types) ? dict.types : [];
    dict.main = Array.isArray(dict.main) ? dict.main : [];
    const before = JSON.stringify({ types: dict.types, main: dict.main });
    const byId = {};
    const byCode = {};
    dict.types.forEach(function (row) {
      if (!row) return;
      if (row.id) byId[row.id] = row;
      if (row.编码) byCode[row.编码] = row;
    });
    types.forEach(function (seed) {
      const exist = byId[seed.id] || byCode[seed.编码];
      if (exist) {
        exist.id = seed.id;
        exist.编码 = seed.编码;
        exist.名称 = seed.名称;
        exist.上级字典 = seed.上级字典;
        exist.系统开发 = true;
        exist.分组节点 = !!seed.分组节点;
        if (!exist.备注) exist.备注 = seed.备注;
        byId[seed.id] = exist;
        byCode[seed.编码] = exist;
      } else {
        const row = Object.assign({}, seed);
        dict.types.push(row);
        byId[row.id] = row;
        byCode[row.编码] = row;
      }
    });
    const itemByKey = {};
    dict.main.forEach(function (row) {
      if (!row) return;
      itemByKey[row.id] = row;
      itemByKey[(row.typeId || '') + '#' + (row.编码 || '')] = row;
    });
    items.forEach(function (seed) {
      const liveType = byId[seed.typeId];
      const liveTypeId = liveType ? liveType.id : seed.typeId;
      const exist = itemByKey[seed.id] || itemByKey[liveTypeId + '#' + seed.编码];
      if (exist) {
        exist.typeId = liveTypeId;
        if (!exist.编码) exist.编码 = seed.编码;
        if (!exist.名称) exist.名称 = seed.名称;
      } else {
        const row = Object.assign({}, seed, { typeId: liveTypeId });
        dict.main.push(row);
        itemByKey[row.id] = row;
      }
    });
    const knownParent = {};
    types.forEach(function (seed) { knownParent[seed.编码] = seed.上级字典; });
    dict.types.forEach(function (row) {
      if (row.分组节点 && !row.上级字典) return;
      const want = knownParent[row.编码];
      if (want != null) row.上级字典 = want;
    });
    const dropTypeIds = {};
    dict.types = dict.types.filter(function (row) {
      if (!row) return false;
      if (deprecatedTypeCodes[row.编码] || deprecatedTypeIds[row.id]) {
        dropTypeIds[row.id] = true;
        return false;
      }
      return true;
    });
    if (Object.keys(dropTypeIds).length) {
      dict.main = dict.main.filter(function (row) {
        return row && !dropTypeIds[row.typeId];
      });
    }
    return before !== JSON.stringify({ types: dict.types, main: dict.main });
  }

  return {
    types: types,
    items: items,
    binds: binds,
    enabledNames: enabledNames,
    resolveCode: resolveCode,
    optionsFor: optionsFor,
    firstOption: firstOption,
    mergeInto: mergeInto,
  };
})();
