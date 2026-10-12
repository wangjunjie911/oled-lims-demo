/** Demo 公告（OLED_LIMS） */
(function (global) {
  global.DEMO_ANNOUNCEMENTS = {
    updatedAt: '2026-09-21',
    latestVersion: 'xintao-qms-spc-1.3-spc-compare',
    notes: [
      {
        id: 'spc-compare-v13',
        title: 'xintao-qms-spc-1.3 · 对比SPC(多图)按行出图',
        level: 'info',
        date: '2026-09-21',
        body:
          '对照试用系统 compare-spc-multiple 修复对比出图逻辑：\n' +
          '· 查询区改为多行（添加行 / 复制行 / 删除），每行独立检验项/采集项 + Y坐标\n' +
          '· 多参数对比图按行生成双Y轴序列，底表与图例跟随所选检验项\n' +
          '· 相关性分析图要求恰好两行查询条件\n\n' +
          'Colin：http://colin.mygasmart.com/xintao-spc-demo/pc.html#/spc-insp-cmp'
      },
      {
        id: 'spc-single-style-v12',
        title: 'xintao-qms-spc-1.2 · 计量SPC(单图)对齐试用系统样式',
        level: 'info',
        date: '2026-09-21',
        body:
          '对照试用系统「计量SPC(单图)-采购来料」更新 Demo：\n' +
          '· 查询区「样本过滤 / 检验项」改为 XDivider 蓝字分割线 + 四列栅格\n' +
          '· 控制图切换改为卡片式 Tabs；「I图样本数据」右对齐独立行\n' +
          '· 空态 el-empty；数据分析改为 el-descriptions（vertical/border）\n' +
          '· 选项口径统一「编码/名称」；图表标题取名称段\n\n' +
          'Colin：http://colin.mygasmart.com/xintao-spc-demo/pc.html#/spc-insp-single'
      },
      {
        id: 'qc-ledger-dev-ready-v11',
        title: 'xintao-qms-spc-1.1 · 样品检验台账开放开发',
        level: 'warn',
        date: '2026-09-21',
        body: '样品检验台账原型与 PRD 已对齐，可进入研发排期。侧栏仍保留台账入口。'
      }
    ],
    progress: {
      baseline: 'Demo xintao-qms-spc-1.3-spc-compare',
      summary: {
        total: 3,
        pc: 3,
        app: 0,
        ready: 1,
        pending: 2,
        note: '样品检验台账 🟢 可开发；计量SPC/对比SPC Demo 对齐中。'
      },
      rows: [
        {
          id: 1,
          side: 'PC',
          m1: '质量管理',
          m2: '检验管理',
          m3: '样品检验台账',
          desc: '列表/新增/详情/复测/比对',
          dStatus: '✅ 已完成',
          cStatus: '✅ 已确认',
          devStatus: '🟢 可开发',
          role: '质检化验员',
          time: '2026-09-21'
        },
        {
          id: 2,
          side: 'PC',
          m1: 'SPC 管理',
          m2: '检验 SPC',
          m3: '计量 SPC (单图)',
          desc: '采购来料/过程/物料三态；七图+设置+样本数据',
          dStatus: '🔄 样式对齐',
          cStatus: '—',
          devStatus: '⏳ 待排期',
          role: '质量工程师',
          time: '2026-09-21'
        },
        {
          id: 3,
          side: 'PC',
          m1: 'SPC 管理',
          m2: '检验 SPC',
          m3: '对比 SPC (多图)',
          desc: '多行查询 + 双Y对比 / 相关性',
          dStatus: '🔄 出图对齐',
          cStatus: '—',
          devStatus: '⏳ 待排期',
          role: '质量工程师',
          time: '2026-09-21'
        }
      ]
    },
    updates: [
      {
        version: 'xintao-qms-spc-1.3-spc-compare',
        date: '2026-09-21',
        terminal: 'PC',
        module: '对比SPC(多图)',
        type: '[Fix]',
        summary: '多行查询条件驱动双Y对比/相关性出图，对齐试用系统 compare-spc-multiple'
      },
      {
        version: 'xintao-qms-spc-1.2-spc-single',
        date: '2026-09-21',
        terminal: 'PC',
        module: '计量SPC(单图)',
        type: '[Style]',
        summary: '查询区/Tabs/空态/描述表对齐试用系统 measure-spc-single'
      },
      {
        version: 'xintao-qms-spc-1.1-qc-ledger',
        date: '2026-09-21',
        terminal: 'PC',
        module: '样品检验台账 · 可开发',
        type: '[Ready]',
        summary: '台账原型与 PRD 对齐，开放开发'
      }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
