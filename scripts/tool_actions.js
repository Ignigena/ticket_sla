var toolActions = {};

toolActions.notification = function notifications(request) {
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
}
