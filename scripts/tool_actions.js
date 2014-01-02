var toolActions = {};

toolActions.notification = function notifications(request) {
  // Only display popup alerts if the Chrome Notifications option is set.
  chrome.storage.local.get('chromeNotifications', function (data) {
    if (data.chromeNotifications) {
      // Set up the alert parameters.
      var notify = webkitNotifications.createNotification(
        'slatoolbar.png',
        request.title,
        request.msg
      );

      if (request.mode == 'load') {
        // Clicking on the alert will load the ticket detail view.
        // Used in a ticket list when one ticket creates a new alert.
        notify.onclick = function () {
          chrome.tabs.create({ url: "https://s5.parature.com/ics/tt/ticketDetail.asp?ticket_id=" + request.ticket });
        };
      } else {
        // Default behaviour, focus the window that spawned the alert.
        // This is used when composing a message where it would be disruptive to load the same ticket in a new window.
        notify.onclick = function () {
          chrome.tabs.update(sender.tab.id, {active: true});
          this.cancel();
        };
      }

      // Show the alert.
      notify.show();

      // Automatically hide the alert after 10 seconds.
      setTimeout(function () {
        notify.cancel();
      }, 10000);
    }
  });
};

toolActions.getAcquiaMonitor = function getAcquiaMonitor() {
  var defer = new $.Deferred();

  chrome.tabs.getSelected(function (tab) {
    var host = tab.url.split('/')[2];

    var xhr = new XMLHttpRequest();
    xhr.open("GET", "http://" + host + "/ACQUIA_MONITOR", true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState == 4) {
        var monitor = {};
        var response = xhr.responseText.split("\n");
        $.each(response, function (index, item) {
          var lineDecode = item.split("=");
          monitor[lineDecode[0]] = lineDecode[1];
        });
        defer.resolve(monitor);
      }
    };
    xhr.send();
  });

  return defer.promise();
};

toolActions.pinToWeb = function pinToWeb(request) {
  var current = $.cookie('ah_app_server');

  if (current) {
    if (request.pinTo) {
      $.removeCookie('ah_app_server');
    }
    return('unpinned:' + current + ':' + request.pinTo);
  } else {
    if (request.pinTo) {
      var tmp = request.pinTo.split('.');
      console.log(tmp);
      $.cookie('ah_app_server', tmp[0]);
    }
    return('pinned:' + tmp[0] + ':' + request.pinTo);
  }
};
