// Saves options to localStorage.
function save_options() {
    var select = document.getElementById("newWindowTickets");
    var checked = select.checked;
    chrome.storage.local.set({newWindowTickets: checked});

    // Update status to let user know options were saved.
    var status = document.getElementById("status");
    status.innerHTML = "Options Saved.";
    setTimeout(function() {
        status.innerHTML = "";
    }, 750);
}

// Restores select box state to saved value from localStorage.
function restore_options() {
    chrome.storage.local.get('newWindowTickets',function(data){
        document.getElementById("newWindowTickets").checked=data.newWindowTickets;
    });
}
document.addEventListener('DOMContentLoaded', restore_options);
document.querySelector('#save').addEventListener('click', save_options);