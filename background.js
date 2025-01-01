importScripts('jspdf.umd.min.js');

chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: startScanning,
    args: [tab.id]
  });
});

let imagesToProcess = [];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadImage') {
    const filename = request.imageUrl.split('/').pop().split('?')[0];
    imagesToProcess.push({
      url: request.imageUrl,
      filename: filename
    });
    chrome.downloads.download({
      url: request.imageUrl,
      filename: `fb_images/${filename}`
    });
  } else if (request.action === 'closeTab') {
    createPDF().then(() => {
      chrome.tabs.remove(request.tabId);
    });
  }
});

async function createPDF() {
  const { jsPDF } = globalThis.jspdf;
  const doc = new jsPDF('p', 'px', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 0; i < imagesToProcess.length; i++) {
    const imgData = imagesToProcess[i];
    try {
      const response = await fetch(imgData.url);
      const blob = await response.blob();
      const base64data = await convertBlobToBase64(blob);

      if (i > 0) {
        doc.addPage();
      }

      // Add image at full page width
      doc.addImage(base64data, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');

      // Delete the local image file after adding to doc
      const filename = imgData.filename;
      chrome.downloads.search({ filename: filename }, (results) => {
        results.forEach((result) => {
          chrome.downloads.removeFile(result.id);
        });
      });

    } catch (error) {
      console.error('Error processing image:', error);
    }
  }

  // Convert PDF to base64 and download
  const pdfBase64 = doc.output('datauristring');
  chrome.downloads.download({
    url: pdfBase64,
    filename: 'facebook_images.pdf'
  });
  imagesToProcess = [];
}

function convertBlobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function startScanning(tabId) {
  let downloadedUrls = new Set();
  let lastImageCount = 0;
  
  function scanAndDownload() {
    const images = document.querySelectorAll('[data-visualcompletion="media-vc-image"]');
    let newImagesCount = 0;

    images.forEach(img => {
      const imgUrl = img.src;
      const filename = imgUrl.split('/').pop().split('?')[0];
      if (!downloadedUrls.has(filename) && imgUrl) {
        downloadedUrls.add(filename);
        newImagesCount++;
        chrome.runtime.sendMessage({
          action: 'downloadImage',
          imageUrl: imgUrl
        });
      }
    });

    if (newImagesCount > 0) {
      lastImageCount = newImagesCount;
      const nextButton = document.querySelector('[style*="background-position: 0px -25px; background-size: auto; width: 24px; height: 24px; background-repeat: no-repeat; display: inline-block;"]');
      if (nextButton) {
        nextButton.click();
        setTimeout(scanAndDownload, 700);
      }
    } else if (lastImageCount > 0) {
      chrome.runtime.sendMessage({
        action: 'closeTab',
        tabId: tabId
      });
    } else {
      setTimeout(scanAndDownload, 200);
    }
  }

  scanAndDownload();
} 