import { toPng, toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { format } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import i18n from '@/i18n/config';
import type { Ledger, RenqingRecord } from '@shared/types';
import { EVENT_TYPES } from '@/constants';

// A4尺寸：210mm x 297mm，在96dpi下约为794px x 1123px
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const RECORDS_PER_PAGE = 10;


function getDateLocale() {
  return i18n.language?.startsWith('zh') ? zhCN : enUS;
}

function getDateFormat() {
  return i18n.language?.startsWith('zh') ? 'yyyy年MM月dd日' : 'MMM dd, yyyy';
}

function getNumberLocale() {
  return i18n.language?.startsWith('zh') ? 'zh-CN' : 'en-US';
}

function getCurrencySymbol() {
  return i18n.language?.startsWith('zh') ? '¥' : '$';
}

function formatCurrency(amount: number) {
  return `${getCurrencySymbol()}${amount.toLocaleString(getNumberLocale())}`;
}

function t(key: string, options?: Record<string, unknown>) {
  return i18n.t(key, options) as string;
}

// 创建礼簿封面HTML
function createCoverHTML(ledger: Ledger, records: RenqingRecord[]): string {
  const currentLocale = getDateLocale();
  const dateStr = format(ledger.date, getDateFormat(), { locale: currentLocale });

  return `
    <div style="
      width: ${A4_WIDTH}px;
      height: ${A4_HEIGHT}px;
      background: linear-gradient(135deg, #f43f5e 0%, #e11d48 45%, #be123c 100%);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      color: white;
      font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
      position: relative;
      overflow: hidden;
    ">
      <div style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        opacity: 0.3;
      "></div>

      <div style="text-align: center; z-index: 1; position: relative;">
        <h1 style="
          font-size: 48px;
          font-weight: bold;
          margin-bottom: 20px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        ">${t('ledgerExport.appName')}</h1>

        <h2 style="
          font-size: 36px;
          font-weight: bold;
          margin-bottom: 30px;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        ">${ledger.title}</h2>

        <div style="
          font-size: 24px;
          margin-bottom: 16px;
          opacity: 0.9;
        ">${dateStr}</div>

        ${ledger.description ? `
          <div style="
            max-width: 720px;
            font-size: 18px;
            line-height: 1.8;
            color: rgba(255, 255, 255, 0.92);
            margin-bottom: 32px;
            text-align: center;
            text-shadow: 0 1px 2px rgba(0,0,0,0.1);
          ">${ledger.description}</div>
        ` : ''}

        <div style="
          display: flex;
          gap: 60px;
          margin-bottom: 40px;
        ">
          <div style="text-align: center;">
            <div style="font-size: 18px; opacity: 0.8; margin-bottom: 8px;">${t('dashboard.received')}</div>
            <div style="font-size: 32px; font-weight: bold;">${formatCurrency(ledger.totalReceived)}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 18px; opacity: 0.8; margin-bottom: 8px;">${t('dashboard.given')}</div>
            <div style="font-size: 32px; font-weight: bold;">${formatCurrency(ledger.totalGiven)}</div>
          </div>
        </div>

        <div style="
          font-size: 16px;
          opacity: 0.7;
          border-top: 1px solid rgba(255,255,255,0.3);
          padding-top: 20px;
        ">
          ${t('ledgerExport.totalRecords', { count: records.length })}
        </div>
      </div>
    </div>
  `;
}

// 创建记录页面HTML
function createRecordPageHTML(records: RenqingRecord[], pageIndex: number, totalPages: number, ledger: Ledger): string {
  const startIndex = pageIndex * RECORDS_PER_PAGE;
  const endIndex = Math.min(startIndex + RECORDS_PER_PAGE, records.length);
  const pageRecords = records.slice(startIndex, endIndex);

  const pageNum = t('ledgerExport.page', { page: pageIndex + 1, total: totalPages });

  const pageTotalReceived = pageRecords
    .filter(record => record.type === 'receive')
    .reduce((sum, record) => sum + record.amount, 0);

  const recordsHTML = pageRecords.map((record, index) => {
    const eventTypeLabel = t(EVENT_TYPES.find(et => et.value === record.eventType)?.label || record.eventType);
    const isReceive = record.type === 'receive';

    return `
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 24px;
        border-radius: 16px;
        background: ${index % 2 === 0 ? '#ffffff' : '#fbf1f4'};
        border: 1px solid #f4d1dc;
        margin-bottom: 6px;
      ">
        <div style="flex: 1; min-width: 0;">
          <div style="
            font-size: 18px;
            font-weight: 700;
            color: #111827;
            margin-bottom: 6px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          ">${record.personName}</div>
          <div style="
            font-size: 13px;
            color: #6b7280;
            line-height: 1.6;
            word-break: break-word;
          ">${eventTypeLabel}${record.description ? ` • ${record.description}` : ''}</div>
        </div>
        <div style="
          display: inline-flex;
          align-items: center;
          font-size: 20px;
          line-height: 20px;
          font-weight: 700;
          color: ${isReceive ? '#10b981' : '#ef4444'};
          text-align: right;
        ">
          <span style="margin-right: 4px;margin-bottom: 4px;">${isReceive ? '+' : '-'}</span>
          <span>${getCurrencySymbol()}</span>
          <span>${record.amount.toLocaleString(getNumberLocale())}</span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div style="
      width: ${A4_WIDTH}px;
      height: ${A4_HEIGHT}px;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
      position: relative;
    ">
      <div style="
        padding: 16px 24px;
        background: #ffffff;
        border-bottom: 1px solid #e5e7eb;
      ">
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
        ">
          <div style="min-width: 0;">
            <h3 style="
              font-size: 22px;
              font-weight: 700;
              color: #0f172a;
              margin: 0 0 8px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            ">${ledger.title}</h3>
            <div style="font-size: 12px; color: #64748b; display: flex; flex-wrap: wrap; gap: 12px;">
              <span>${format(ledger.date, getDateFormat(), { locale: getDateLocale() })}</span>
              <span>${t('dashboard.received')}: ${formatCurrency(ledger.totalReceived)}</span>
              <span>${t('dashboard.given')}: ${formatCurrency(ledger.totalGiven)}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
            <div style="
              font-size: 12px;
              color: #475569;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 8px 14px;
              border-radius: 12px;
              height: fit-content;
              text-align: center;
            ">
              <div>${pageNum}</div>
              <div style="margin-top: 4px; font-weight: 600;">${t('ledgerExport.pageSubtotal')}: ${formatCurrency(pageTotalReceived)}</div>
            </div>
          </div>
        </div>
      </div>

      <div style="
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 18px 24px;
      ">
        ${recordsHTML}
      </div>
      <div style="display: flex; align-items: center; padding: 0 24px 12px 24px; gap: 8px; justify-content: flex-end;">
        <div style="font-size: 12px; color: #64748b;">
          <span style="color: #94a3b8; margin-right: 4px;">${t('ledgerExport.generatedTime')}:</span>
          ${format(new Date(), getDateFormat(), { locale: getDateLocale() })}
        </div>
        <div style="font-size: 12px; color: #000;font-weight: 600;">
          ${t('ledgerExport.by')}
        </div>
      </div>
    </div>
  `;
}

// 创建离屏渲染容器
function createOffscreenContainer(): { container: HTMLElement; cleanup: () => void } {
  const container = document.createElement('div');
  // 修复点1：用透明度隐藏而非移出视口
  Object.assign(container.style, {
    width: `${A4_WIDTH}px`,
    height: `${A4_HEIGHT}px`,
    background: 'white',
  });
  document.body.appendChild(container);

  const cleanup = () => {
    container.remove(); // 现代 API 更安全
  };

  return { container, cleanup };
}

// 将HTML转换为图片
async function htmlToImage(
  html: string,
  options: { type?: 'png' | 'jpeg'; quality?: number; pixelRatio?: number } = {}
): Promise<string> {
  const { type = 'png', quality = 1.0, pixelRatio = 2 } = options;
  const { container, cleanup } = createOffscreenContainer();
  try {
    container.innerHTML = html;

    await document.fonts.ready;

    // 等待字体加载
    await new Promise(resolve => setTimeout(resolve, 100));

    if (type === 'jpeg') {
      return await toJpeg(container, {
        width: A4_WIDTH,
        height: A4_HEIGHT,
        quality,
        pixelRatio,
        backgroundColor: '#ffffff',
        style: { transform: 'none !important' }
      });
    }

    return await toPng(container, {
      width: A4_WIDTH,
      height: A4_HEIGHT,
      quality,
      pixelRatio,
      backgroundColor: '#ffffff',
      style: { transform: 'none !important' }
    });
  } catch (error) {
    console.error('HTML转图片失败:', error);
    throw new Error(t('ledgerExport.imageGenerationFailed'));
  } finally {
    cleanup();
  }
}

/**
 * 通用文件下载函数（支持 Base64、ArrayBuffer、Blob 三种输入）
 * 
 * @param data - 文件数据 (支持完整 base64 URL / 纯 base64 字符串 / ArrayBuffer / Blob)
 * @param filename - 下载的文件名（需带扩展名，如 "image.png"）
 * @param mimeType - 可选 MIME 类型（当传入 Blob 时会优先使用其自带 type）
 */
function downloadFile(
  data: string | ArrayBuffer | Blob,
  filename: string,
  mimeType?: string
) {
  // 1️⃣ 处理 Blob 输入（核心修复点）
  if (data instanceof Blob) {
    // 优先使用 Blob 自带的 MIME type，除非用户强制指定新类型
    const finalMimeType = mimeType || data.type || "application/octet-stream";

    // 如果用户指定了不同 MIME type，创建新 Blob
    const finalBlob = mimeType && mimeType !== data.type
      ? new Blob([data], { type: mimeType })
      : data;

    // 2️⃣ 标准下载流程（复用逻辑）
    const url = URL.createObjectURL(finalBlob);
    triggerDownload(url, filename);
    return;
  }

  // 2️⃣ 处理 ArrayBuffer 输入
  if (data instanceof ArrayBuffer) {
    const blob = new Blob([data], {
      type: mimeType || "application/octet-stream"
    });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
    return;
  }

  // 3️⃣ 处理字符串输入（Base64 或纯文本）
  if (typeof data === "string") {
    // 情况A：完整 base64 URL (data:image/png;base64,...)
    if (data.startsWith("data:")) {
      const [meta, base64] = data.split(",");
      const detectedType = mimeType || meta.match(/:(.*?);/)?.[1] || "application/octet-stream";

      // 解码 base64 为二进制
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: detectedType });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, filename);
      return;
    }

    // 情况B：纯 base64 字符串（无 data: 前缀）
    if (mimeType) {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, filename);
      return;
    }

    // 情况C：纯文本（fallback）
    const blob = new Blob([data], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
    return;
  }

  // ❌ 无效输入类型
  throw new Error(t('ledgerExport.invalidDataType'));
}

// 🔁 抽离重复的下载逻辑
function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 导出为单图片（竖向拼接）
export async function exportLedgerAsSingleImage(ledger: Ledger, records: RenqingRecord[]): Promise<void> {
  try {
    const images: string[] = [];

    // 生成封面
    const coverHTML = createCoverHTML(ledger, records);
    const coverImage = await htmlToImage(coverHTML);
    images.push(coverImage);

    // 计算需要的页数
    const totalPages = Math.ceil(records.length / RECORDS_PER_PAGE);

    // 生成记录页面
    for (let i = 0; i < totalPages; i++) {
      const pageHTML = createRecordPageHTML(records, i, totalPages, ledger);
      const pageImage = await htmlToImage(pageHTML);
      images.push(pageImage);
    }

    // 创建拼接容器
    const { container, cleanup } = createOffscreenContainer();
    container.style.height = `${A4_HEIGHT * images.length}px`;
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    // 添加所有图片
    for (const imageData of images) {
      const img = document.createElement('img');
      img.src = imageData;
      img.style.width = '100%';
      img.style.height = `${A4_HEIGHT}px`;
      img.style.objectFit = 'contain';
      container.appendChild(img);
    }

    // 等待图片加载
    await new Promise(resolve => {
      const imgs = container.querySelectorAll('img');
      let loaded = 0;
      imgs.forEach(img => {
        img.onload = () => {
          loaded++;
          if (loaded === imgs.length) resolve(void 0);
        };
      });
    });

    // 生成最终图片
    const finalImage = await toPng(container, {
      width: A4_WIDTH,
      height: A4_HEIGHT * images.length,
      quality: 1.0,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      style: { transform: 'none !important' }
    });
    console.log('finalImage:', finalImage);

    cleanup();

    // 下载图片
    const filename = `${ledger.title}_${t('ledgerExport.ledgerFile')}_${format(new Date(), 'yyyyMMdd')}.png`;
    downloadFile(finalImage, filename, 'image/png');
  } catch (error) {
    console.error('Export single image failed:', error);
    throw new Error(t('ledgerExport.failed'));
  }
}

// 导出为多图片压缩包
export async function exportLedgerAsImageZip(ledger: Ledger, records: RenqingRecord[]): Promise<void> {
  try {
    const zip = new JSZip();
    const images: { name: string; data: string }[] = [];

    // 生成封面
    const coverHTML = createCoverHTML(ledger, records);
    const coverImage = await htmlToImage(coverHTML);
    images.push({ name: `${t('ledgerExport.cover')}.png`, data: coverImage });

    // 计算需要的页数
    const totalPages = Math.ceil(records.length / RECORDS_PER_PAGE);

    // 生成记录页面
    for (let i = 0; i < totalPages; i++) {
      const pageHTML = createRecordPageHTML(records, i, totalPages, ledger);
      const pageImage = await htmlToImage(pageHTML);
      images.push({ name: `${t('ledgerExport.recordPageFile')}_${i + 1}.png`, data: pageImage });
    }

    const realImages = images.reverse(); // 倒序后封面在最后，解压后封面在最前

    // 添加图片到压缩包
    for (const image of realImages) {
      // 将base64转换为blob
      const response = await fetch(image.data);
      const blob = await response.blob();
      zip.file(image.name, blob);
    }

    // 生成并下载压缩包
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const filename = `${ledger.title}_${t('ledgerExport.ledgerFile')}_${format(new Date(), 'yyyyMMdd')}.zip`;
    downloadFile(zipBlob, filename, 'application/zip');

  } catch (error) {
    console.error('导出压缩包失败:', error);
    throw new Error(t('ledgerExport.failed'));
  }
}

// 导出为PDF
export async function exportLedgerAsPDF(ledger: Ledger, records: RenqingRecord[]): Promise<void> {

  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 生成封面图片
    const coverHTML = createCoverHTML(ledger, records);
    const coverImage = await htmlToImage(coverHTML);

    // 添加封面到PDF
    pdf.addImage(coverImage, 'PNG', 0, 0, 210, 297);

    // 计算需要的页数
    const totalPages = Math.ceil(records.length / RECORDS_PER_PAGE);

    // 生成记录页面
    for (let i = 0; i < totalPages; i++) {
      pdf.addPage();
      const pageHTML = createRecordPageHTML(records, i, totalPages, ledger);
      const pageImage = await htmlToImage(pageHTML);
      pdf.addImage(pageImage, 'PNG', 0, 0, 210, 297);
    }

    // 下载PDF
    const filename = `${ledger.title}_${t('ledgerExport.ledgerFile')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
    pdf.save(filename);

  } catch (error) {
    console.error('导出PDF失败:', error);
    throw new Error(t('ledgerExport.failed'));
  }
}