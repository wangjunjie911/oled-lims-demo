/**
 * Demo 右侧「备注」面板：将页面PRD.md 原文渲染为可读 HTML。
 * 支持标题 / 分隔线 / 段落 / 列表 / 表格 / 引用 / 围栏代码块（mermaid）/ 行内加粗·代码·链接。
 * 用法：window.renderRemarksMarkdown(src) → { html, toc }
 */
(function (global) {
  'use strict';

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** mermaid 源码保留 <br> 等标签，仅防止闭合外层容器 */
  function safeMermaidCode(s) {
    return String(s == null ? '' : s).replace(/<\/(div|script|style)/gi, '<\\/$1');
  }

  function inlineFormat(raw) {
    var s = escHtml(raw);
    // code first so * inside code is not bolded
    s = s.replace(/`([^`]+)`/g, '<code class="remarks-md__code">$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a class="remarks-md__a" href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  }

  function plainHeadingText(s) {
    return String(s || '').replace(/\*\*/g, '').replace(/`/g, '').trim();
  }

  function isHr(line) {
    return /^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
  }

  function isTableSep(line) {
    return /^\s*\|?[\s:|-]+\|[\s:|-]*\|?\s*$/.test(line) && /---/.test(line);
  }

  function isTableRow(line) {
    return /^\s*\|.+\|\s*$/.test(line) || (/^\s*[^|].*\|.*\|/.test(line) && line.indexOf('|') > 0);
  }

  function splitTableCells(line) {
    var t = String(line || '').trim();
    if (t.charAt(0) === '|') t = t.slice(1);
    if (t.charAt(t.length - 1) === '|') t = t.slice(0, -1);
    return t.split('|').map(function (c) { return c.trim(); });
  }

  function isUl(line) {
    return /^\s*[-*+]\s+/.test(line);
  }

  function isOl(line) {
    return /^\s*\d+[.)]\s+/.test(line);
  }

  function listIndent(line) {
    var m = /^(\s*)/.exec(line);
    return m ? m[1].replace(/\t/g, '  ').length : 0;
  }

  function listItemText(line) {
    return line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '');
  }

  /** 无 # 的短标题行：如「数据流转：」「字段信息：」 */
  function isPseudoHeading(line) {
    var t = String(line || '').trim();
    if (!t || t.length > 36) return false;
    if (/^#{1,6}\s/.test(t) || isUl(t) || isOl(t) || isHr(t) || isTableRow(t)) return false;
    if (/^>\s?/.test(t)) return false;
    return /^[\u4e00-\u9fa5A-Za-z0-9（）()\[\]【】\s\/·\-、]+[：:]\s*$/.test(t);
  }

  function renderTable(rows) {
    if (!rows.length) return '';
    var head = rows[0];
    var body = rows.slice(1);
    var html = '<div class="remarks-md__table-wrap"><table class="remarks-md__table"><thead><tr>';
    head.forEach(function (c) {
      html += '<th>' + inlineFormat(c) + '</th>';
    });
    html += '</tr></thead><tbody>';
    body.forEach(function (row) {
      html += '<tr>';
      for (var i = 0; i < head.length; i++) {
        html += '<td>' + inlineFormat(row[i] != null ? row[i] : '') + '</td>';
      }
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderList(items, ordered) {
    var tag = ordered ? 'ol' : 'ul';
    var cls = ordered ? 'remarks-md__ol' : 'remarks-md__ul';
    var html = '<' + tag + ' class="' + cls + '">';
    items.forEach(function (it) {
      html += '<li>' + inlineFormat(it.text);
      if (it.children && it.children.length) {
        html += renderList(it.children, it.childOrdered);
      }
      html += '</li>';
    });
    html += '</' + tag + '>';
    return html;
  }

  /**
   * 将同缩进级别的列表行解析为树
   * @param {{indent:number,ordered:boolean,text:string}[]} flat
   */
  function nestList(flat) {
    if (!flat.length) return { items: [], ordered: false };
    var rootOrdered = flat[0].ordered;
    var stack = [{ indent: -1, items: [], ordered: rootOrdered }];

    flat.forEach(function (node) {
      while (stack.length > 1 && node.indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }
      var parent = stack[stack.length - 1];
      var item = { text: node.text, children: [], childOrdered: false };
      parent.items.push(item);
      if (parent.item) parent.item.childOrdered = node.ordered;
      stack.push({ indent: node.indent, items: item.children, ordered: node.ordered, item: item });
    });

    return { items: stack[0].items, ordered: rootOrdered };
  }

  function renderRemarksMarkdown(src) {
    var raw = String(src == null ? '' : src).replace(/\r\n?/g, '\n');
    var lines = raw.split('\n');
    var toc = [];
    var hIdx = 0;
    var out = [];
    var i = 0;

    function pushHeading(level, text) {
      var plain = plainHeadingText(text);
      var id = 'rm-h-' + (hIdx++);
      toc.push({ id: id, level: level, text: plain });
      var cls = level >= 3 ? 'remarks-md__h3' : (level === 1 ? 'remarks-md__h1' : 'remarks-md__h');
      var tag = level >= 3 ? 'h4' : (level === 1 ? 'h2' : 'h3');
      out.push(
        '<' + tag + ' class="' + cls + '" id="' + id + '" data-rm-level="' + level + '">' +
        inlineFormat(text) +
        '</' + tag + '>'
      );
    }

    while (i < lines.length) {
      var line = lines[i];
      var trimmed = line.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      // ATX headings
      var hm = /^(#{1,6})\s+(.+)$/.exec(trimmed);
      if (hm) {
        pushHeading(Math.min(hm[1].length, 3), hm[2].trim());
        i++;
        continue;
      }

      // Fenced code block（含 mermaid 流程图）
      if (/^```/.test(trimmed)) {
        var fenceOpen = /^```(\w*)\s*$/.exec(trimmed);
        var lang = fenceOpen && fenceOpen[1] ? fenceOpen[1].toLowerCase() : '';
        i++;
        var codeLines = [];
        while (i < lines.length && !/^```\s*$/.test(String(lines[i]).trim())) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++;
        var code = codeLines.join('\n').replace(/\s+$/, '');
        if (lang === 'mermaid') {
          var mid = 'rm-mmd-' + (hIdx++);
          out.push(
            '<div class="remarks-md__mermaid-wrap">' +
            '<div class="remarks-md__mermaid mermaid" id="' + mid + '">' +
            safeMermaidCode(code) +
            '</div></div>'
          );
        } else if (code) {
          out.push('<pre class="remarks-md__pre"><code class="remarks-md__codeblock">' + escHtml(code) + '</code></pre>');
        }
        continue;
      }

      // HR
      if (isHr(trimmed)) {
        out.push('<hr class="remarks-md__hr"/>');
        i++;
        continue;
      }

      // Table
      if (isTableRow(trimmed) && i + 1 < lines.length && isTableSep(lines[i + 1].trim())) {
        var tableRows = [splitTableCells(trimmed)];
        i += 2;
        while (i < lines.length && isTableRow(lines[i].trim()) && !isTableSep(lines[i].trim())) {
          tableRows.push(splitTableCells(lines[i].trim()));
          i++;
        }
        out.push(renderTable(tableRows));
        continue;
      }

      // Blockquote
      if (/^>\s?/.test(trimmed)) {
        var bq = [];
        while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
          bq.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        out.push('<blockquote class="remarks-md__bq">' + inlineFormat(bq.join('\n')) + '</blockquote>');
        continue;
      }

      // Lists
      if (isUl(line) || isOl(line)) {
        var flat = [];
        while (i < lines.length && (isUl(lines[i]) || isOl(lines[i]))) {
          flat.push({
            indent: listIndent(lines[i]),
            ordered: isOl(lines[i]),
            text: listItemText(lines[i])
          });
          i++;
        }
        var nested = nestList(flat);
        out.push(renderList(nested.items, nested.ordered));
        continue;
      }

      // Pseudo section title（无 # 的「数据流转：」等）
      if (isPseudoHeading(trimmed)) {
        var label = trimmed.replace(/[：:]\s*$/, '');
        var id2 = 'rm-h-' + (hIdx++);
        toc.push({ id: id2, level: 2, text: label });
        out.push(
          '<h3 class="remarks-md__h" id="' + id2 + '" data-rm-level="2">' +
          escHtml(label) +
          '</h3>'
        );
        i++;
        continue;
      }

      // Paragraph（合并连续非空、非块起始行）
      var para = [trimmed];
      i++;
      while (i < lines.length) {
        var n = lines[i];
        var nt = n.trim();
        if (!nt) break;
        if (/^#{1,6}\s/.test(nt) || isHr(nt) || isUl(n) || isOl(n) || /^>\s?/.test(nt)) break;
        if (/^```/.test(nt)) break;
        if (isTableRow(nt) && i + 1 < lines.length && isTableSep(lines[i + 1].trim())) break;
        if (isPseudoHeading(nt)) break;
        para.push(nt);
        i++;
      }
      out.push('<p class="remarks-md__p">' + inlineFormat(para.join(' ')) + '</p>');
    }

    return { html: out.join('\n'), toc: toc };
  }

  global.renderRemarksMarkdown = renderRemarksMarkdown;
})(typeof window !== 'undefined' ? window : this);
