// 初始化 Showdown 转换器和 CodeMirror 编辑器
const converter = new showdown.Converter({ tables: true, tasklists: true, strikethrough: true });
const editor = CodeMirror.fromTextArea(document.getElementById("code"), {
  mode: "markdown",
  theme: "neo",
  lineNumbers: true,
  lineWrapping: true
});

// 设置默认内容
editor.setValue(`# Markdown 小助手使用指南事例

欢迎使用 **Markdown 小助手**！这是一个功能强大的在线 Markdown 编辑器。

---

## 🎯 主要功能

### 1. 实时预览
- 左侧编辑，右侧实时预览
- 支持标准 Markdown 语法
- 代码高亮显示

### 2. 预览模式
- 点击顶部 **"👁 预览模式"** 按钮进入全屏预览
- 点击右下角悬浮按钮或顶部按钮退出预览

### 3. 清空编辑器
- 点击左上角 **"🧹 橡皮擦"** 按钮清空内容
- 清空前会弹出确认提示

### 4. 导出 Word
- 点击 **"📄 导出 Word"** 按钮
- 自动将 Markdown 转换为 .docx 文档
- 支持图表导出

---

## 📊 支持的功能

### 表格示例

| 功能 | 说明 | 状态 |
|------|------|------|
| 实时预览 | 编辑即时显示 | ✅ |
| 代码高亮 | 多语言支持 | ✅ |
| Mermaid 图表 | 流程图/时序图 | ✅ |
| Word 导出 | 一键导出文档 | ✅ |

### 代码高亮

\`\`\`javascript
function hello() {
  console.log("Hello, Markdown!");
}
\`\`\`

### Mermaid 流程图

\`\`\`mermaid
graph TD
    A[开始编辑] --> B[实时预览]
    B --> C{满意吗?}
    C -->|是| D[导出 Word]
    C -->|否| A
    D --> E[完成]
\`\`\`

---

## 💡 快速开始

1. 在左侧编辑器输入 Markdown 内容
2. 右侧自动显示预览效果
3. 使用工具栏按钮进行操作

**现在就开始编辑吧！** 🚀
`);

// 渲染 Markdown 预览
let timer;
const render = () => {
  const html = converter.makeHtml(editor.getValue());
  const preview = document.getElementById('preview');
  preview.innerHTML = html;

  preview.querySelectorAll('pre code').forEach(block => {
    if (block.classList.contains('language-mermaid')) {
      const div = document.createElement('div');
      div.classList.add('mermaid');
      div.textContent = block.textContent;
      block.parentElement.replaceWith(div);
    } else {
      hljs.highlightElement(block);
    }
  });

  try {
    mermaid.init(undefined, document.querySelectorAll('.mermaid'));
  } catch (e) {
    console.error('Mermaid initialization error:', e);
  }
};

// 监听编辑器变化
editor.on("change", () => {
  clearTimeout(timer);
  timer = setTimeout(render, 300);
});

// 初始化 Mermaid
mermaid.initialize({ startOnLoad: false, theme: 'default' });
render();

// 清空编辑器功能
function clearEditor() {
  if (confirm('确定要清空编辑器内容吗？')) {
    editor.setValue('');
  }
}

// 切换预览模式
function toggleWideMode() {
  const isWide = document.body.classList.toggle('wide-mode');

  // 获取顶部按钮并更新文字
  const headerBtn = document.getElementById('header-preview-btn');
  if (headerBtn) {
    headerBtn.innerText = isWide ? "❌ 退出预览" : "👁 预览模式";
  }

  // 如果退出了宽屏模式，刷新编辑器防止错位
  if (!isWide) {
    setTimeout(() => editor.refresh(), 50);
  }
}

// SVG 样式内联处理
function inlineStyles(sourceNode, targetNode) {
  const computedStyle = window.getComputedStyle(sourceNode);
  if (computedStyle) {
    let styleStr = "";
    const keys = ['fill', 'stroke', 'stroke-width', 'font-family', 'font-size', 'color', 'background-color'];
    keys.forEach(key => {
      styleStr += `${key}:${computedStyle.getPropertyValue(key)};`;
    });
    targetNode.setAttribute('style', styleStr);
  }
  for (let i = 0; i < sourceNode.children.length; i++) {
    if (i < targetNode.children.length) {
      inlineStyles(sourceNode.children[i], targetNode.children[i]);
    }
  }
}

// SVG 转 PNG
function svgToPng(svgElement) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('SVG render timed out, skipping.');
      resolve(null);
    }, 500);

    try {
      const rect = svgElement.getBoundingClientRect();
      const width = rect.width || 500;
      const height = rect.height || 300;

      const clone = svgElement.cloneNode(true);
      inlineStyles(svgElement, clone);

      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', width);
      clone.setAttribute('height', height);

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(clone);

      const base64Svg = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));

      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      ctx.scale(2, 2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const img = new Image();
      img.onload = () => {
        clearTimeout(timeout);
        ctx.drawImage(img, 0, 0, width, height);
        resolve({ data: canvas.toDataURL('image/png'), width, height });
      };

      img.onerror = (e) => {
        clearTimeout(timeout);
        console.error("Image load failed", e);
        resolve(null);
      };

      img.src = base64Svg;

    } catch (e) {
      clearTimeout(timeout);
      console.error("SVG conversion error", e);
      resolve(null);
    }
  });
}

// 导出 Word 文档
async function exportWord() {
  const btn = document.getElementById('btn-export-word');
  const originalText = btn.innerText;
  btn.disabled = true;

  try {
    const previewEl = document.getElementById('preview');
    const liveSvgs = previewEl.querySelectorAll('.mermaid svg');
    const replacements = [];

    for (let i = 0; i < liveSvgs.length; i++) {
      btn.innerText = `处理图片 ${i + 1}/${liveSvgs.length}...`;
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 50)));

      const pngData = await svgToPng(liveSvgs[i]);
      if (pngData) {
        replacements.push({ index: i, ...pngData });
      }
    }

    btn.innerText = "生成文档...";
    await new Promise(r => setTimeout(r, 50));

    const contentClone = previewEl.cloneNode(true);
    const cloneSvgs = contentClone.querySelectorAll('.mermaid svg');

    replacements.forEach(item => {
      if (cloneSvgs[item.index]) {
        const img = document.createElement('img');
        img.src = item.data;
        img.width = item.width;
        if (item.height) img.height = item.height;
        cloneSvgs[item.index].parentNode.replaceChild(img, cloneSvgs[item.index]);
      }
    });

    contentClone.querySelectorAll('svg').forEach(el => el.remove());

    if (!window.docx) {
      throw new Error('docx 库未加载（请检查网络/CDN）。');
    }

    btn.innerText = '转换内容...';
    await new Promise(r => setTimeout(r, 30));

    const blocks = await htmlElementToDocxBlocks(contentClone);
    if (!blocks.length) {
      blocks.push(new window.docx.Paragraph({ text: '' }));
    }

    btn.innerText = '打包文档...';
    await new Promise(r => setTimeout(r, 30));

    const doc = new window.docx.Document({
      sections: [{
        properties: {},
        children: blocks,
      }],
    });

    const blob = await window.docx.Packer.toBlob(doc);
    saveAs(blob, 'markdown_export.docx');

  } catch (e) {
    alert("导出出错: " + e.message);
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

function isElement(node) {
  return node && node.nodeType === Node.ELEMENT_NODE;
}

function dataUrlToUint8Array(dataUrl) {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || '');
  if (!match) return null;
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const __imageSizeCache = new Map();

function getImageSizeFromDataUrl(dataUrl) {
  if (!dataUrl) return Promise.resolve(null);
  if (__imageSizeCache.has(dataUrl)) return __imageSizeCache.get(dataUrl);

  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });

  __imageSizeCache.set(dataUrl, p);
  return p;
}

function guessImageType(dataUrl) {
  const match = /^data:([^;]+);base64,/.exec(dataUrl || '');
  if (!match) return undefined;
  const mime = match[1].toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpeg';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('webp')) return 'webp';
  return undefined;
}

function splitTextToRuns(text, options = {}) {
  const { TextRun } = window.docx;
  const normalized = (text ?? '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const runs = [];
  lines.forEach((line, idx) => {
    runs.push(new TextRun({ text: line, ...options }));
    if (idx < lines.length - 1) {
      runs.push(new TextRun({ break: 1 }));
    }
  });
  return runs;
}

function headingLevelForTag(tagName) {
  const { HeadingLevel } = window.docx;
  switch ((tagName || '').toUpperCase()) {
    case 'H1': return HeadingLevel.HEADING_1;
    case 'H2': return HeadingLevel.HEADING_2;
    case 'H3': return HeadingLevel.HEADING_3;
    case 'H4': return HeadingLevel.HEADING_4;
    case 'H5': return HeadingLevel.HEADING_5;
    case 'H6': return HeadingLevel.HEADING_6;
    default: return undefined;
  }
}

async function htmlElementToDocxBlocks(rootEl) {
  const { Paragraph, Table, TableRow, TableCell, WidthType, ImageRun, AlignmentType, BorderStyle, TableLayoutType, TextRun } = window.docx;
  const blocks = [];

  const walkChildren = async (container, listContext = null) => {
    const children = Array.from(container.childNodes || []);
    for (const node of children) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (text) {
          blocks.push(new Paragraph({
            children: [new window.docx.TextRun({ text })],
            spacing: { after: 120 },
          }));
        }
        continue;
      }

      if (!isElement(node)) continue;

      const tag = node.tagName.toUpperCase();
      if (tag === 'BR') {
        blocks.push(new Paragraph({ text: '' }));
        continue;
      }

      if (/^H[1-6]$/.test(tag)) {
        const heading = headingLevelForTag(tag);
        blocks.push(new Paragraph({
          text: node.textContent || '',
          heading,
          spacing: { after: 180 },
        }));
        continue;
      }

      if (tag === 'P' || tag === 'DIV') {
        const text = (node.innerText || node.textContent || '').trim();
        if (text) {
          blocks.push(new Paragraph({
            children: splitTextToRuns(text),
            spacing: { after: 120 },
          }));
        } else {
          // 可能包含图片/表格等块级元素
          await walkChildren(node, listContext);
        }
        continue;
      }

      if (tag === 'PRE') {
        const code = (node.innerText || node.textContent || '').replace(/^\n+|\n+$/g, '');
        if (code) {
          blocks.push(new Paragraph({
            children: splitTextToRuns(code, { font: 'Courier New' }),
            spacing: { after: 180 },
          }));
        }
        continue;
      }

      if (tag === 'UL' || tag === 'OL') {
        const isOrdered = tag === 'OL';
        const items = Array.from(node.children).filter(c => isElement(c) && c.tagName.toUpperCase() === 'LI');
        let idx = 1;
        for (const li of items) {
          const text = (li.innerText || li.textContent || '').trim();
          if (!text) continue;
          blocks.push(new Paragraph({
            text: isOrdered ? `${idx++}. ${text}` : text,
            bullet: isOrdered ? undefined : { level: 0 },
            spacing: { after: 60 },
          }));
        }
        continue;
      }

      if (tag === 'IMG') {
        const src = node.getAttribute('src') || '';
        const bytes = dataUrlToUint8Array(src);
        if (bytes) {
          const natural = await getImageSizeFromDataUrl(src);
          const widthAttr = parseInt(node.getAttribute('width') || '', 10);
          const heightAttr = parseInt(node.getAttribute('height') || '', 10);

          const naturalWidth = natural?.width || (Number.isFinite(widthAttr) ? widthAttr : 800);
          const naturalHeight = natural?.height || (Number.isFinite(heightAttr) ? heightAttr : 450);

          const MAX_WIDTH = 560;
          const MIN_WIDTH = 120;
          let targetWidth = Number.isFinite(widthAttr) ? widthAttr : naturalWidth;
          targetWidth = Math.min(Math.max(targetWidth, MIN_WIDTH), MAX_WIDTH);

          const ratio = naturalWidth > 0 ? (naturalHeight / naturalWidth) : 0.6;
          const targetHeight = Math.max(60, Math.round(targetWidth * ratio));
          const imageType = guessImageType(src);

          blocks.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: bytes,
                transformation: { width: targetWidth, height: targetHeight },
                type: imageType,
              }),
            ],
            spacing: { after: 180 },
          }));
        }
        continue;
      }

      if (tag === 'TABLE') {
        // iOS Pages 对百分比宽度/自动布局兼容较差，容易把列挤到极窄导致中文逐字换行。
        // 这里改用固定表格布局 + 固定列宽（DXA/twips）。
        // Letter(8.5in) 宽 12240 twips；左右各 1in 边距(1440*2)后可用宽约 9360。
        const TABLE_WIDTH_DXA = 9360;
        const rows = [];
        const trEls = Array.from(node.querySelectorAll('tr'));

        const firstRowCells = trEls.length
          ? Array.from(trEls[0].children).filter(c => ['TD', 'TH'].includes(c.tagName.toUpperCase()))
          : [];
        const tableColCount = Math.max(firstRowCells.length, 1);
        const tableColWidth = Math.floor(TABLE_WIDTH_DXA / tableColCount);
        const columnWidths = new Array(tableColCount).fill(tableColWidth);

        for (const tr of trEls) {
          const cellEls = Array.from(tr.children).filter(c => ['TD', 'TH'].includes(c.tagName.toUpperCase()));
          const normalizedCells = [];

          for (let i = 0; i < tableColCount; i++) {
            const cellEl = cellEls[i];
            const cellText = cellEl ? (cellEl.innerText || cellEl.textContent || '').trim() : '';
            const isHeader = cellEl ? (cellEl.tagName.toUpperCase() === 'TH') : false;

            normalizedCells.push(new TableCell({
              width: { size: columnWidths[i], type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
                left: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
                right: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
              },
              children: [
                new Paragraph({
                  alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
                  children: isHeader
                    ? [new TextRun({ text: cellText, bold: true })]
                    : [new TextRun({ text: cellText })],
                  spacing: { after: 60 },
                }),
              ],
            }));
          }

          const cells = normalizedCells;
          if (cells.length) rows.push(new TableRow({ children: cells }));
        }

        if (rows.length) {
          blocks.push(new Table({
            // 多数渲染器（Pages/WPS）对表格整体宽度更偏好百分比；列宽用 tblGrid 明确指定。
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            columnWidths,
            rows,
          }));
          blocks.push(new Paragraph({ text: '' }));
        }
        continue;
      }

      // 兜底：继续向下找
      await walkChildren(node, listContext);
    }
  };

  await walkChildren(rootEl);
  return blocks;
}
