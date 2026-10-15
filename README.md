# Demo 原型源代码（OLED_LIMS）

> **PC Demo** 为 `OLED_LIMS_Demo.html`（自思特瑞 WMS Demo 裁剪）。菜单对齐 `05-项目资料/01-设计文件/试用系统改造清单.md`。
> **APP Demo** 为同目录独立页，由 PC 顶栏 APP 进入，首屏为登录页。

## 入口

- 总览（选 PC / APP）：`OLED_LIMS_项目总览.html`
- PC 登录：`OLED_LIMS_PC_Login.html`（登录成功后进入 PC Demo）
- PC：`OLED_LIMS_Demo.html`
- APP：`OLED_LIMS_APP_Demo.html`

## 文件

| 文件 | 说明 |
| --- | --- |
| `OLED_LIMS_项目总览.html` | Demo 总览，点击 PC / APP 进入对应端 |
| `OLED_LIMS_PC_Login.html` | PC 端登录页（对齐产品登录样式） |
| `OLED_LIMS_Demo.html` | PC Demo 主界面 |
| `OLED_LIMS_APP_Demo.html` | APP 独立 Demo，入口为登录页 |
| `js/page-configs.js` | 功能树菜单 + 页面配置（含 `spc-insp-single` 分析台） |
| `js/spc-single-demo.js` | 计量SPC单图 / 多图 Mock 与 ECharts（`SPC_SINGLE_DEMO` / `SPC_MULTI_DEMO`） |
| `js/mock-rows.js` | 可复用页 Mock |
| `js/page-prd-notes.js` | 可复用页备注 |
| `js/demo-store.js` / `dict-catalog.js` / `remarks-*.js` / `demo-announcements.js` | 运行依赖 |

仓储 Plan、生成脚本、legacy WMS 页配置均已移除。APP 不嵌在 PC 单页内。
