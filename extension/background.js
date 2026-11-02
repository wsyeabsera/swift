// Opens the app page. The helper authenticates this extension by its id (chrome-extension://<id>) and a token.
chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: chrome.runtime.getURL('app/index.html') }));
