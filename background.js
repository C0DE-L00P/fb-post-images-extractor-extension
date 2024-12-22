chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: startScanning,
    args: [tab.id]
  });
});

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadImage') {
    const filename = request.imageUrl.split('/').pop().split('?')[0];
    chrome.downloads.download({
      url: request.imageUrl,
      filename: `fb_images/${filename}`
    });
  } else if (request.action === 'closeTab') {
    chrome.tabs.remove(request.tabId);
  }
});

function startScanning(tabId) {
  let downloadedUrls = new Set();
  let lastImageCount = 0;
  
  function scanAndDownload() {
    const images = document.querySelectorAll('[data-visualcompletion="media-vc-image"]');
    let newImagesCount = 0;

    // Download new images
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

    // If we found new images, continue to next page
    if (newImagesCount > 0) {
      lastImageCount = newImagesCount;
      const nextButton = document.querySelector('[style*="background-position: 0px -25px; background-size: auto; width: 24px; height: 24px; background-repeat: no-repeat; display: inline-block;"]');
      if (nextButton) {
        nextButton.click();
        setTimeout(scanAndDownload, 500); // Small delay to let new images load
      }
    } 
    // If we didn't find new images and last time we did, we're done
    else if (lastImageCount > 0) {
      chrome.runtime.sendMessage({
        action: 'closeTab',
        tabId: tabId
      });
    } 
    // If we haven't found any images yet, try again
    else {
      setTimeout(scanAndDownload, 100);
    }
  }

  scanAndDownload();
} 