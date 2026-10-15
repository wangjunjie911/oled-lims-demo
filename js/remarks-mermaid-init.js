/**
 * 备注面板 Mermaid 初始化（ESM，由 Demo HTML 以 type=module 引入）
 */
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'base',
  themeVariables: {
    fontSize: '12px',
    fontFamily: 'PingFang SC, Noto Sans SC, Microsoft YaHei, sans-serif',
    primaryColor: '#EEF2F8',
    primaryBorderColor: '#1A4099',
    primaryTextColor: '#1a3a5c',
    secondaryColor: '#F5F8FC',
    tertiaryColor: '#FAFBFD',
    lineColor: '#8C9BB0',
    edgeLabelBackground: '#ffffff',
  },
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
    padding: 12,
    nodeSpacing: 36,
    rankSpacing: 44,
    wrappingWidth: 160,
    useMaxWidth: true,
  },
});

window.__mermaid = mermaid;
window.__mermaidReady = true;
window.dispatchEvent(new Event('wms-mermaid-ready'));
