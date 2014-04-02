var toolActions = {};

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
