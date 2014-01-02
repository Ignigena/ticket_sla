// Saves options to localStorage.
function saveOptions() {
  chrome.storage.local.set({
    newWindowTickets: document.getElementById("newWindowTickets").checked,
    chromeNotifications: document.getElementById("chromeNotifications").checked
  });

  // Update status to let user know options were saved.
  var status = document.getElementById("status");
  status.innerHTML = "Options Saved.";
  setTimeout(function () {
    status.innerHTML = "";
  }, 750);
}

// Restores select box state to saved value from localStorage.
function restoreOptions() {
  chrome.storage.local.get('newWindowTickets', function (data) {
    document.getElementById("newWindowTickets").checked = data.newWindowTickets;
  });
  chrome.storage.local.get('chromeNotifications', function (data) {
    document.getElementById("chromeNotifications").checked = data.chromeNotifications;
  });
}
document.addEventListener('DOMContentLoaded', restoreOptions);
$('input').click(saveOptions);