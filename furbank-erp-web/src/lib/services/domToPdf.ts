import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export interface GeneratePdfOptions {
  filename: string;
}

/**
 * Capture an HTML element and generate a downloadable PDF
 */
export async function generateDomToPdf(
  element: HTMLElement,
  options: GeneratePdfOptions
): Promise<{ success: boolean; error: Error | null; blob?: Blob; filename?: string }> {
  try {
    // A4 dimensions in mm
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Capture the element using html-to-image which respects modern CSS (like oklch)
    const imgData = await toPng(element, {
      pixelRatio: 2, // higher scale for better resolution
      backgroundColor: document.documentElement.classList.contains('dark') ? '#09090b' : '#ffffff', // match standard backgrounds
      skipFonts: false,
    });

    // Calculate image dimensions to fit the PDF
    const imgProps = pdf.getImageProperties(imgData);
    const pdfImgWidth = pdfWidth;
    const pdfImgHeight = (imgProps.height * pdfImgWidth) / imgProps.width;

    // Handle pagination if the image is taller than a single page
    let heightLeft = pdfImgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, pdfImgWidth, pdfImgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft >= 0) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfImgWidth, pdfImgHeight);
      heightLeft -= pdfHeight;
    }

    const blob = pdf.output('blob');

    return {
      success: true,
      error: null,
      blob,
      filename: options.filename,
    };
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    return {
      success: false,
      error: error as Error,
    };
  }
}
