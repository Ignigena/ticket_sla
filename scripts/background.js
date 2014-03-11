var trustedHosts = [
  'newtab',
  'extensions',
];

chrome.browserAction.setBadgeBackgroundColor({ color: "#468847" });

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  pageURL = tab.url;

  if (pageURL !== undefined && changeInfo.status == "complete") {
    var host = pageURL.split('/')[2];

    if (trustedHosts.indexOf(host) == '-1') {
      chrome.storage.local.get('hostCache',function(data){
          var cachedHosts = {};
          var hostedStatus = false;
          var currentTime = new Date().getTime();

          if (data.hostCache) {
            cachedHosts = JSON.parse(data.hostCache);
          }

          if (!cachedHosts[host] || currentTime >= cachedHosts[host]['cached']+86400) {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "http://"+host+"/ACQUIA_MONITOR", true);
            xhr.onreadystatechange = function() {
              if (xhr.readyState == 4) {
                var status = xhr.responseText.slice(-8, -1);
                if (status == "success") {
                  hostedStatus = true;
                } else {
                  hostedStatus = false;
                }
                cachedHosts[host] = { hosted: hostedStatus, cached: currentTime }
                chrome.storage.local.set({hostCache: JSON.stringify(cachedHosts)});

                updateBrowserAction(hostedStatus);
              }
            }
            xhr.send();
          } else {
            hostedStatus = cachedHosts[host]['hosted'];

            updateBrowserAction(hostedStatus);
          }
      });
    }
  }

  function updateBrowserAction(hostedStatus) {
    if (hostedStatus) {
      chrome.browserAction.setIcon({ path: 'toolbar-acquia.png', tabId: tab.id });
      chrome.browserAction.setTitle({ title: "This site is hosted with Acquia.", tabId: tab.id });
    } else {
      chrome.browserAction.setTitle({ title: "Support Tools", tabId: tab.id });
    }
  }
});

chrome.tabs.onCreated.addListener(function(newTab) {
  if (newTab.url && newTab.url.indexOf('https://acquia.zendesk.com/agent/#') == 0) {
    chrome.tabs.query({ url: 'https://acquia.zendesk.com/*' }, function (tabs) {
      if (tabs && tabs[0]) {
        chrome.tabs.update(tabs[0].id, { url: tab.url, highlighted: true });
        chrome.tabs.remove(newTab.id);
      }
    });
  }
});

chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
  var toolFunction = toolActions[request.execute](request);
  $.when(toolFunction).done(function(response){ sendResponse(response); });
});
