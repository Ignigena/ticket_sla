var trustedHosts = [
  'newtab',
  'extensions',
  's5.parature.com'
];

chrome.browserAction.setBadgeBackgroundColor({ color: "#468847" });

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  var pageURL = tab.url;

  if (pageURL !== undefined && changeInfo.status == "complete") {
    var host = pageURL.split('/')[2];

    if (trustedHosts.indexOf(host) == '-1') {
      chrome.storage.local.get('hostCache', function (data) {
        var cachedHosts = {};
        var hostedStatus = false;
        var currentTime = new Date().getTime();

        if (data.hostCache) {
          cachedHosts = JSON.parse(data.hostCache);
        }

        if (!cachedHosts[host] || currentTime >= cachedHosts[host]['cached'] + 86400) {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", "http://" + host + "/ACQUIA_MONITOR", true);
          xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
              var status = xhr.responseText.slice(-8, -1);
              hostedStatus = status == "success";
              cachedHosts[host] = { hosted: hostedStatus, cached: currentTime };
              chrome.storage.local.set({hostCache: JSON.stringify(cachedHosts)});

              updateBrowserAction(hostedStatus);
            }
          };
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

chrome.extension.onRequest.addListener(function (request, sender, sendResponse) {
  var toolFunction = toolActions[request.execute](request);
  $.when(toolFunction).done(function (response) {
    sendResponse(response);
  });
});

// Check the Escalated Advocacy ticket list every 5 minutes for outstanding tickets.
setInterval(function () {
  $.ajax('https://s5.parature.com/ics/tt/ticketlist.asp?filter_queue=3439').done(function (data) {
    $('tbody tr.gridRow', data).each(function () {
      var ticketLink = $('td a.link2', this).first().attr('href').split('ticket_id=')[1];
      var ticketNumber = $('td a.link2', this).first().text().split('-')[1];

      var notify = webkitNotifications.createNotification(
        'slatoolbar.png',
        'Escalated Advocacy',
        'Ticket ' + ticketNumber + ' has been placed in Escalated Advocacy.'
      );
      notify.onclick = function () {
        chrome.tabs.create({ url: "https://s5.parature.com/ics/tt/ticketDetail.asp?ticket_id=" + ticketLink });
      };
      notify.show();
      setTimeout(function () {
        notify.cancel();
      }, 10000);
    });
  });
}, 300000);
