import { toPng } from 'html-to-image';
import { format } from 'date-fns';
import i18n from '@/i18n/config';

function createOffscreenWrapper(container: HTMLElement): { wrapper: HTMLElement; clonedElement: HTMLElement } {
  const clonedElement = container.cloneNode(true) as HTMLElement;
  clonedElement.style.width = `${container.offsetWidth}px`;
  clonedElement.style.boxSizing = 'border-box';
  clonedElement.style.backgroundColor = '#ffffff';
  clonedElement.style.visibility = 'visible';
  clonedElement.style.padding = '8px';

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.top = '0';
  wrapper.style.left = '-9999px';
  wrapper.style.width = `${container.offsetWidth}px`;
  wrapper.style.overflow = 'visible';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.opacity = '0.01';
  wrapper.style.zIndex = '-9999';
  wrapper.style.backgroundColor = '#ffffff';
  wrapper.appendChild(clonedElement);

  document.body.appendChild(wrapper);
  return { wrapper, clonedElement };
}

function removeOffscreenWrapper(wrapper: HTMLElement): void {
  if (wrapper.parentNode) {
    wrapper.parentNode.removeChild(wrapper);
  }
}

export async function exportTimelineAsImage(containerId: string): Promise<void> {
  const container = document.querySelector(containerId) as HTMLElement | null;
  if (!container) {
    throw new Error(i18n.language === 'zh' ? '找不到导出容器' : 'Export container not found');
  }

  const originalCursor = document.body.style.cursor;
  document.body.style.cursor = 'wait';

  try {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const { wrapper, clonedElement } = createOffscreenWrapper(container);
    const exportButton = clonedElement.querySelector('#timeline-export-image-button') as HTMLElement | null;
    if (exportButton) {
      exportButton.style.display = 'none';
    }

    const dataUrl = await toPng(clonedElement, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      cacheBust: true,
      width: container.offsetWidth,
      height: container.scrollHeight,
      style: {
        transform: 'none',
        visibility: 'visible',
        backgroundColor: '#ffffff',
      },
    });

    removeOffscreenWrapper(wrapper);
    document.body.style.cursor = originalCursor;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `timeline_${format(new Date(), 'yyyyMMdd_HHmmss')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const message = i18n.language === 'zh' ? '图片导出成功' : 'Image exported successfully';
    console.log(message);
  } catch (error) {
    document.body.style.cursor = 'auto';
    const errorMessage = error instanceof Error ? error.message : String(error);
    const message = i18n.language === 'zh'
      ? `导出失败: ${errorMessage}`
      : `Export failed: ${errorMessage}`;
    console.error(message);
    throw error;
  }
}
