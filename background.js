chrome.browserAction.setBadgeBackgroundColor({ color: "#468847" });

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  pageURL = tab.url;
  host = pageURL.split('/')[2];

  var xhr = new XMLHttpRequest();
  xhr.open("GET", "http://"+host+"/ACQUIA_MONITOR", true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      var status = xhr.responseText.slice(-8, -1);
      if (status == "success") {
        chrome.browserAction.setBadgeText({ text: "√", tabId: tab.id });
        chrome.browserAction.setTitle({ title: "This site is hosted with Acquia.", tabId: tab.id });
      } else {
        chrome.browserAction.setTitle({ title: "Acquia SLA", tabId: tab.id });
      }
    }
  }
  xhr.send();
});
