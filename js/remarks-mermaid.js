/**
 * 备注面板：将 .remarks-md__mermaid 渲染为 SVG 流程图
 * 依赖 remarks-mermaid-init.js 预先加载 window.__mermaid
 */
(function (global) {
  'use strict';

  function whenMermaidReady(timeoutMs) {
    if (global.__mermaid) return Promise.resolve(global.__mermaid);
    var wait = typeof timeoutMs === 'number' ? timeoutMs : 8000;
    return new Promise(function (resolve) {
      if (global.__mermaidReady && global.__mermaid) {
        resolve(global.__mermaid);
        return;
      }
      var done = false;
      function finish(m) {
        if (done) return;
        done = true;
        resolve(m || null);
      }
      global.addEventListener('wms-mermaid-ready', function () {
        finish(global.__mermaid);
      }, { once: true });
      setTimeout(function () {
        finish(global.__mermaid || null);
      }, wait);
    });
  }

  /**
   * @param {HTMLElement|null|undefined} container
   * @returns {Promise<void>}
   */
  function renderRemarksMermaid(container) {
    if (!container) return Promise.resolve();
    var nodes = container.querySelectorAll('.remarks-md__mermaid.mermaid');
    if (!nodes.length) return Promise.resolve();

    return whenMermaidReady().then(function (mermaid) {
      if (!mermaid) {
        Array.from(nodes).forEach(function (node) {
          if (!node.querySelector('svg')) {
            node.classList.add('remarks-md__mermaid--err');
            if (!node.getAttribute('data-mmd-err')) {
              node.setAttribute('data-mmd-err', '1');
              node.insertAdjacentHTML(
                'beforeend',
                '<div class="remarks-md__mermaid--err">流程图加载失败，请检查网络后刷新重试</div>'
              );
            }
          }
        });
        return;
      }
      var list = Array.from(nodes).filter(function (node) {
        return !node.querySelector('svg');
      });
      if (!list.length) return;
      list.forEach(function (node) {
        node.removeAttribute('data-mmd-done');
        node.removeAttribute('data-processed');
        node.classList.remove('remarks-md__mermaid--err');
      });
      return mermaid.run({ nodes: list, suppressErrors: true }).then(function () {
        list.forEach(function (node) {
          node.setAttribute('data-mmd-done', '1');
          if (!node.querySelector('svg')) {
            node.classList.add('remarks-md__mermaid--err');
          }
        });
      }).catch(function () {
        list.forEach(function (node) {
          if (!node.querySelector('svg')) {
            node.classList.add('remarks-md__mermaid--err');
          }
        });
      });
    });
  }

  global.renderRemarksMermaid = renderRemarksMermaid;
})(typeof window !== 'undefined' ? window : this);
