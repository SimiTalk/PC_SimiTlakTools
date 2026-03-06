// 初始化 Markdown 渲染器（markdown-it）和 CodeMirror 编辑器
function createMarkdownRenderer() {
  if (!window.markdownit) {
    throw new Error('markdown-it 未加载（请检查网络/CDN）。');
  }

  const md = window.markdownit({
    html: true,
    linkify: true,
    typographer: true
  });

  // 任务列表 / 脚注 / emoji
  if (typeof window.markdownitTaskLists === 'function') {
    md.use(window.markdownitTaskLists, { enabled: true, label: true, labelAfter: true });
  }
  if (typeof window.markdownitFootnote === 'function') {
    md.use(window.markdownitFootnote);
  }
  if (typeof window.markdownitEmoji === 'function') {
    md.use(window.markdownitEmoji);
  }

  // 折叠块：
  // :::details 标题
  // 内容...
  // :::
  const installDetailsContainer = (containerName) => {
    if (typeof window.markdownitContainer !== 'function') return;

    md.use(window.markdownitContainer, containerName, {
      validate: (params) => {
        const trimmed = params.trim();
        return trimmed === containerName || trimmed.startsWith(containerName + ' ');
      },
      render: (tokens, idx) => {
        const token = tokens[idx];
        if (token.nesting === 1) {
          const info = token.info.trim();
          const title = info.slice(containerName.length).trim() || '详情';
          return `<details class="md-details"><summary>${md.utils.escapeHtml(title)}</summary>\n`;
        }
        return `</details>\n`;
      }
    });
  };

  installDetailsContainer('details');
  installDetailsContainer('collapse');

  return md;
}

const md = createMarkdownRenderer();
const editor = CodeMirror.fromTextArea(document.getElementById("code"), {
  mode: "markdown",
  theme: "neo",
  lineNumbers: true,
  lineWrapping: true
});

function normalizeMarkdownSource(source) {
  if (!source) return '';
  const input = String(source);

  const replaceOutsideBackticks = (line, replacer) => {
    // 保留行内代码：`...` 或 ``...`` 等
    let out = '';
    let i = 0;
    let inSpan = false;
    let spanTicks = 0;
    let segmentStart = 0;

    const flushSegment = (end) => {
      const seg = line.slice(segmentStart, end);
      out += inSpan ? seg : replacer(seg);
    };

    while (i < line.length) {
      if (line[i] !== '`') {
        i++;
        continue;
      }

      // count ticks
      let j = i;
      while (j < line.length && line[j] === '`') j++;
      const tickCount = j - i;

      // flush text before ticks
      flushSegment(i);
      out += line.slice(i, j);

      if (!inSpan) {
        inSpan = true;
        spanTicks = tickCount;
      } else if (tickCount === spanTicks) {
        inSpan = false;
        spanTicks = 0;
      }

      i = j;
      segmentStart = i;
    }

    flushSegment(line.length);
    return out;
  };

  const applyRewrites = (chunk) => {
    let text = chunk;

    // 兼容一种“非主流图片语法”
    // [[img:https://...]] -> ![](https://...)
    text = text.replace(/\[\[img:([^\]]+)\]\]/gi, (_m, url) => {
      const normalizedUrl = String(url).trim();
      return `![](${normalizedUrl})`;
    });

    // 兼容一种“悬浮提示”写法（类似 kramdown）
    // [text](url){:title="..."} -> <a href="url" title="...">text</a>
    // 说明：这是定向兼容，避免引入额外插件。
    text = text.replace(
      /\[([^\]]+)\]\(([^)\s]+)\)\{:\s*title\s*=\s*"([^"]*)"\s*\}/g,
      (_m, label, url, title) => {
        const safeLabel = String(label).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeUrl = String(url).replace(/"/g, '&quot;');
        const safeTitle = String(title).replace(/"/g, '&quot;');
        return `<a href="${safeUrl}" title="${safeTitle}">${safeLabel}</a>`;
      }
    );

    return text;
  };

  // 关键：不要在 fenced code block（``` / ~~~）内做任何替换，避免示例代码被改写成 HTML。
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  let inFence = false;
  let fenceMarker = '';

  const outLines = lines.map((rawLine) => {
    const line = rawLine;
    const fenceMatch = /^\s*(```+|~~~+)/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker[0];
      } else if (marker[0] === fenceMarker) {
        inFence = false;
        fenceMarker = '';
      }
      return line;
    }

    if (inFence) return line;
    return replaceOutsideBackticks(line, applyRewrites);
  });

  return outLines.join('\n');
}

function slugifyHeadingId(raw) {
  const text = String(raw || '').trim().toLowerCase();
  if (!text) return '';
  // 尽量贴近 GitHub 风格：空白 -> -, 去掉大部分标点，保留中英文/数字/下划线/连字符
  return text
    .replace(/[\s\u00A0]+/g, '-')
    .replace(/[“”"'‘’]/g, '')
    .replace(/[()（）\[\]【】{}<>《》]/g, '')
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff\-_]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function ensureHeadingIds(previewRoot) {
  const headings = previewRoot.querySelectorAll('h1,h2,h3,h4,h5,h6');
  const used = new Map();

  headings.forEach(h => {
    if (h.id) {
      used.set(h.id, (used.get(h.id) || 0) + 1);
      return;
    }
    const base = slugifyHeadingId(h.textContent);
    if (!base) return;
    const count = used.get(base) || 0;
    const nextId = count === 0 ? base : `${base}-${count}`;
    used.set(base, count + 1);
    h.id = nextId;
  });
}

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

### 公式（KaTeX）

行内公式：$a^2 + b^2 = c^2$  
块级公式：

$$
E = mc^2
$$

### Mermaid 流程图

\`\`\`mermaid
graph TD
    A[开始编辑] --> B[实时预览]
    B --> C{满意吗?}
    C -->|是| D[导出 Word]
    C -->|否| A
    D --> E[完成]
\`\`\`

### Mermaid 时序图

\`\`\`mermaid
sequenceDiagram
  participant U as 用户
  participant E as 编辑器
  participant P as 预览区
  U->>E: 输入 Markdown
  E->>P: 渲染 HTML
  P-->>U: 显示预览
\`\`\`

### 折叠块（收缩/展开）

:::details 点击展开查看更多

- 支持 **Markdown** 语法
- 支持公式 \`$...$\` / \`$$...$$\`
- 支持 Mermaid 多种图（流程图/时序图/甘特图等）

:::

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
  const html = md.render(normalizeMarkdownSource(editor.getValue()));
  const preview = document.getElementById('preview');
  preview.innerHTML = html;

  // 标题锚点：支持 [xxx](#某标题) 这类跳转
  ensureHeadingIds(preview);

  // Mermaid：将 ```mermaid 代码块替换成 <div class="mermaid">
  preview.querySelectorAll('pre code').forEach(block => {
    const className = block.className || '';
    const isMermaid = /(^|\s)language-mermaid(\s|$)/.test(className) || /(^|\s)lang-mermaid(\s|$)/.test(className);

    if (isMermaid) {
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

  // KaTeX：渲染 $...$ 与 $$...$$
  try {
    if (typeof window.renderMathInElement === 'function') {
      window.renderMathInElement(preview, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false,
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
      });
    }
  } catch (e) {
    console.error('KaTeX render error:', e);
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

let __mathJaxPromise;

function ensureMathJaxLoaded() {
  if (__mathJaxPromise) return __mathJaxPromise;

  __mathJaxPromise = new Promise((resolve, reject) => {
    if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
      window.MathJax.startup.promise.then(resolve).catch(reject);
      return;
    }

    // 配置必须在脚本加载前设置
    window.MathJax = window.MathJax || {
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
      },
      svg: {
        // 使用路径缓存避免依赖字体，导出 PNG 更稳定
        fontCache: 'none',
      },
    };

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
    script.async = true;
    script.onload = () => {
      if (window.MathJax?.startup?.promise) {
        window.MathJax.startup.promise.then(resolve).catch(reject);
      } else {
        resolve();
      }
    };
    script.onerror = () => reject(new Error('MathJax 加载失败（请检查网络/CDN）。'));
    document.head.appendChild(script);
  });

  return __mathJaxPromise;
}

function extractTexFromKatexElement(katexEl) {
  if (!katexEl) return '';
  // KaTeX 默认输出包含 MathML：annotation(encoding="application/x-tex") 存着原始 TeX
  const ann = katexEl.querySelector('annotation[encoding="application/x-tex"]');
  if (ann && ann.textContent) return ann.textContent.trim();
  // 兜底：尝试从可见 HTML 文本取（可能不完整）
  return (katexEl.textContent || '').trim();
}

async function texToPngViaMathJax(tex, { display, sandbox }) {
  if (!tex) return null;
  await ensureMathJaxLoaded();
  if (!window.MathJax?.tex2svg) return null;

  const wrapper = window.MathJax.tex2svg(tex, { display: !!display });
  const svg = wrapper?.querySelector?.('svg');
  if (!svg) return null;

  // 放到 sandbox 里让尺寸可测
  const host = document.createElement('div');
  host.style.display = 'inline-block';
  host.style.padding = '0';
  host.style.margin = '0';
  host.appendChild(svg);
  (sandbox || document.body).appendChild(host);

  try {
    // 等一帧让布局稳定
    await new Promise(r => requestAnimationFrame(() => r()));
    return await svgToPng(svg);
  } finally {
    host.remove();
  }
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

    // KaTeX：导出到 Word 时将公式转为图片，避免变成源码文本
    const sandbox = document.createElement('div');
    sandbox.style.position = 'fixed';
    sandbox.style.left = '-10000px';
    sandbox.style.top = '0';
    sandbox.style.width = '900px';
    sandbox.style.opacity = '0';
    sandbox.style.pointerEvents = 'none';
    sandbox.style.background = '#ffffff';
    document.body.appendChild(sandbox);
    sandbox.appendChild(contentClone);

    try {
      const displayEls = Array.from(contentClone.querySelectorAll('.katex-display'));
      const inlineEls = Array.from(contentClone.querySelectorAll('.katex')).filter(el => !el.closest('.katex-display'));
      const total = displayEls.length + inlineEls.length;
      let done = 0;

      // Display math
      for (const el of displayEls) {
        done++;
        btn.innerText = `处理公式 ${done}/${total}...`;
        await new Promise(r => requestAnimationFrame(() => setTimeout(r, 10)));
        const tex = extractTexFromKatexElement(el);
        const png = await texToPngViaMathJax(tex, { display: true, sandbox }) || await htmlElementToPng(el);
        if (!png) continue;
        const img = document.createElement('img');
        img.setAttribute('src', png.data);
        img.setAttribute('width', String(png.width));
        img.setAttribute('height', String(png.height));
        img.setAttribute('data-math', '1');
        el.replaceWith(img);
      }

      // Inline math
      for (const el of inlineEls) {
        done++;
        btn.innerText = `处理公式 ${done}/${total}...`;
        await new Promise(r => requestAnimationFrame(() => setTimeout(r, 10)));
        const tex = extractTexFromKatexElement(el);
        const png = await texToPngViaMathJax(tex, { display: false, sandbox }) || await htmlElementToPng(el);
        if (!png) continue;
        const img = document.createElement('img');
        img.setAttribute('src', png.data);
        img.setAttribute('width', String(png.width));
        img.setAttribute('height', String(png.height));
        img.setAttribute('data-math', '1');
        img.setAttribute('data-inline', '1');
        el.replaceWith(img);
      }
    } finally {
      // sandbox 会在 blocks 生成完后统一移除
    }

    if (!window.docx) {
      throw new Error('docx 库未加载（请检查网络/CDN）。');
    }

    btn.innerText = '转换内容...';
    await new Promise(r => setTimeout(r, 30));

    const blocks = await htmlElementToDocxBlocks(contentClone);

    if (sandbox && sandbox.parentNode) {
      sandbox.parentNode.removeChild(sandbox);
    }
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

function inlineAllComputedStyles(sourceEl, targetEl) {
  if (!sourceEl || !targetEl) return;
  if (sourceEl.nodeType !== Node.ELEMENT_NODE || targetEl.nodeType !== Node.ELEMENT_NODE) return;

  const style = window.getComputedStyle(sourceEl);
  if (style) {
    let cssText = '';
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      cssText += `${prop}:${style.getPropertyValue(prop)};`;
    }
    targetEl.setAttribute('style', cssText);
  }

  const srcChildren = Array.from(sourceEl.children || []);
  const dstChildren = Array.from(targetEl.children || []);
  for (let i = 0; i < srcChildren.length && i < dstChildren.length; i++) {
    inlineAllComputedStyles(srcChildren[i], dstChildren[i]);
  }
}

function htmlElementToPng(el, options = {}) {
  const scale = Number.isFinite(options.scale) ? options.scale : 2;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 1200;

  return new Promise((resolve) => {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return resolve(null);

    const timeout = setTimeout(() => {
      console.warn('HTML->PNG render timed out, skipping.');
      resolve(null);
    }, timeoutMs);

    try {
      const rect = el.getBoundingClientRect();
      const width = Math.max(1, Math.ceil(rect.width || 1));
      const height = Math.max(1, Math.ceil(rect.height || 1));

      const clone = el.cloneNode(true);
      inlineAllComputedStyles(el, clone);

      const foreign = document.createElement('div');
      foreign.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      foreign.appendChild(clone);
      const serialized = foreign.outerHTML;

      const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
        `<foreignObject x="0" y="0" width="100%" height="100%">${serialized}</foreignObject>` +
        `</svg>`;

      const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      const img = new Image();
      img.onload = () => {
        clearTimeout(timeout);
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve({ data: canvas.toDataURL('image/png'), width, height });
      };
      img.onerror = (e) => {
        clearTimeout(timeout);
        console.error('HTML->PNG image load failed', e);
        resolve(null);
      };
      img.src = svgUrl;
    } catch (e) {
      clearTimeout(timeout);
      console.error('HTML->PNG conversion error', e);
      resolve(null);
    }
  });
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

async function inlineNodeToDocxRunsAsync(node, inherited = {}) {
  const { TextRun, ImageRun } = window.docx;
  if (!node) return [];

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    return splitTextToRuns(text, inherited);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const tag = (node.tagName || '').toUpperCase();
  if (tag === 'BR') return [new TextRun({ break: 1 })];

  // KaTeX 的 MathML/annotation 里会带原始 TeX，必须跳过，否则会在 Word 里出现 \times 等源码
  if (tag === 'MATH' || tag === 'SEMANTICS' || tag === 'ANNOTATION') return [];

  if (tag === 'IMG') {
    const src = node.getAttribute('src') || '';
    const bytes = dataUrlToUint8Array(src);
    if (!bytes) return [];

    const natural = await getImageSizeFromDataUrl(src);
    const widthAttr = parseInt(node.getAttribute('width') || '', 10);
    const heightAttr = parseInt(node.getAttribute('height') || '', 10);
    const naturalWidth = natural?.width || (Number.isFinite(widthAttr) ? widthAttr : 120);
    const naturalHeight = natural?.height || (Number.isFinite(heightAttr) ? heightAttr : 24);

    // Inline: constrain height for baseline alignment
    const isMath = node.getAttribute('data-math') === '1';
    const MAX_H = isMath ? 28 : 22;
    const ratio = naturalHeight > 0 ? (naturalWidth / naturalHeight) : 5;
    const targetHeight = Math.max(12, Math.min(MAX_H, naturalHeight));
    const targetWidth = Math.max(16, Math.round(targetHeight * ratio));

    const imageType = guessImageType(src);
    return [new ImageRun({ data: bytes, transformation: { width: targetWidth, height: targetHeight }, type: imageType })];
  }

  const next = { ...inherited };
  if (tag === 'STRONG' || tag === 'B') next.bold = true;
  if (tag === 'EM' || tag === 'I') next.italics = true;
  if (tag === 'S' || tag === 'DEL' || tag === 'STRIKE') next.strike = true;
  if (tag === 'CODE') next.font = next.font || 'Courier New';

  const runs = [];
  const children = Array.from(node.childNodes || []);
  for (const child of children) {
    runs.push(...await inlineNodeToDocxRunsAsync(child, next));
  }
  return runs;
}

async function inlineContainerToDocxRunsAsync(container, inherited = {}) {
  const { TextRun } = window.docx;
  if (!container) return [new TextRun({ text: '' })];
  const runs = [];
  const children = Array.from(container.childNodes || []);
  for (const child of children) {
    runs.push(...await inlineNodeToDocxRunsAsync(child, inherited));
  }
  if (!runs.length) runs.push(new TextRun({ text: '' }));
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
            alignment: AlignmentType.LEFT,
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
          children: await inlineContainerToDocxRunsAsync(node),
          heading,
          alignment: AlignmentType.LEFT,
          spacing: { after: 180 },
        }));
        continue;
      }

      if (tag === 'P' || tag === 'DIV') {
        // 这里必须按“行内节点”生成 runs，否则会丢失 strong/em 等格式
        const hasBlockChildren = Array.from(node.children || []).some(el => {
          const t = (el.tagName || '').toUpperCase();
          if (t === 'IMG') {
            // 允许行内公式图片不强制拆成块级
            return el.getAttribute('data-inline') !== '1';
          }
          return ['TABLE', 'PRE', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(t);
        });

        if (!hasBlockChildren) {
          blocks.push(new Paragraph({
            alignment: AlignmentType.LEFT,
            children: await inlineContainerToDocxRunsAsync(node),
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
            alignment: AlignmentType.LEFT,
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
          const hasAnyText = (li.innerText || li.textContent || '').trim();
          if (!hasAnyText) continue;

          const prefixRuns = isOrdered
            ? [new TextRun({ text: `${idx++}. ` })]
            : [];

          blocks.push(new Paragraph({
            children: [...prefixRuns, ...await inlineContainerToDocxRunsAsync(li)],
            bullet: isOrdered ? undefined : { level: 0 },
            alignment: AlignmentType.LEFT,
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
          const isMath = node.getAttribute('data-math') === '1';
          const MIN_WIDTH = isMath ? 1 : 120;
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
            const isHeader = cellEl ? (cellEl.tagName.toUpperCase() === 'TH') : false;
            const cellRuns = cellEl
              ? await inlineContainerToDocxRunsAsync(cellEl, isHeader ? { bold: true } : {})
              : [new TextRun({ text: '' })];

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
                  children: cellRuns,
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
