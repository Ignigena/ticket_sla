chrome.browserAction.setBadgeBackgroundColor({ color: "#468847" });

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  pageURL = tab.url;

  if (pageURL !== undefined && changeInfo.status == "complete") {
    var host = pageURL.split('/')[2];

    trustedHosts = [
      'newtab',
      's5.parature.com',
    ];

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
      chrome.browserAction.setBadgeText({ text: "√", tabId: tab.id });
      chrome.browserAction.setTitle({ title: "This site is hosted with Acquia.", tabId: tab.id });
    } else {
      chrome.browserAction.setTitle({ title: "Acquia SLA", tabId: tab.id });
    }
  }
});

chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
    // Only display popup alerts if the Chrome Notifications option is set.
    chrome.storage.local.get('chromeNotifications',function(data){
        if(data.chromeNotifications){
            // Set up the alert parameters.
            var notify = webkitNotifications.createNotification(
              'slatoolbar.png',
              request.title,
              request.msg
            );

            if (request.mode == 'load') {
              // Clicking on the alert will load the ticket detail view.
              // Used in a ticket list when one ticket creates a new alert.
              notify.onclick = function(x) { chrome.tabs.create({ url: "https://s5.parature.com/ics/tt/ticketDetail.asp?ticket_id="+request.ticket }); };
            } else {
              // Default behaviour, focus the window that spawned the alert.
              // This is used when composing a message where it would be disruptive to load the same ticket in a new window.
              notify.onclick = function(x) { chrome.tabs.update(sender.tab.id, {active: true}); this.cancel(); };
            }

            // Show the alert.
            notify.show();

            // Automatically hide the alert after 10 seconds.
            setTimeout(function(){ notify.cancel(); }, 10000);
        }
    });
  });