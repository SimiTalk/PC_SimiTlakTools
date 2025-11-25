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
        resolve({ data: canvas.toDataURL('image/png'), width: width });
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
        cloneSvgs[item.index].parentNode.replaceChild(img, cloneSvgs[item.index]);
      }
    });

    contentClone.querySelectorAll('svg').forEach(el => el.remove());

    const wordStyles = `
      <style>
        body { font-family: 'Calibri', 'SimSun', sans-serif; font-size: 11pt; }
        h1 { font-size: 24pt; color: #2e74b5; border-bottom: 2px solid #2e74b5; }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        th { background-color: #f2f2f2; border: 1px solid #999; padding: 8px; }
        td { border: 1px solid #999; padding: 8px; }
        img { display: block; margin: 10px auto; max-width: 100%; }
        .mermaid { text-align: center; }
      </style>
    `;

    const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">${wordStyles}</head><body>${contentClone.innerHTML}</body></html>`;

    const converted = htmlDocx.asBlob(fullHtml);
    saveAs(converted, 'markdown_export.docx');

  } catch (e) {
    alert("导出出错: " + e.message);
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}
