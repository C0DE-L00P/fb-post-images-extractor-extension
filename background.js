chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: startScanning
  });
});

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadImage') {
    chrome.downloads.download({
      url: request.imageUrl,
      filename: `fb_images/image_${Date.now()}.jpg`
    });
  }
});

function startScanning() {
  let downloadedUrls = new Set();
  
  function scanAndDownload() {
    const images = document.querySelectorAll('[data-visualcompletion="media-vc-image"]');
    let hasNewImages = false;

    for (let img of images) {
      const imgUrl = img.src;
      if (!downloadedUrls.has(imgUrl)) {
        hasNewImages = true;
        downloadedUrls.add(imgUrl);
        
        // Send message to background script to download the image
        chrome.runtime.sendMessage({
          action: 'downloadImage',
          imageUrl: imgUrl
        });
      }
    }

    if (!hasNewImages) {
      console.log('No new images found, stopping...');
      return;
    }

    // Click next button after a delay to allow downloads to start
    setTimeout(() => {
      const nextButton = document.querySelector('[style*="background-position: 0px -25px; background-size: auto; width: 24px; height: 24px; background-repeat: no-repeat; display: inline-block;"]');
      if (nextButton) {
        nextButton.click();
        // Wait for page to load new images
        setTimeout(scanAndDownload, 2000);
      }
    }, 1000);
  }

  scanAndDownload();
} 