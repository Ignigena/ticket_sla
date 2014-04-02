var trustedHosts = [
    'newtab',
    'extensions'
];

chrome.browserAction.setBadgeBackgroundColor({ color: "#468847" });

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    var pageURL = tab.url;

    if (pageURL !== undefined && changeInfo.status == "complete") {
        if (pageURL && pageURL.indexOf("chrome://") != 0) {
            checkZendeskTicketTab(tab, pageURL);
        }

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

                            updateBrowserAction(hostedStatus, tab);
                        }
                    };
                    xhr.send();
                } else {
                    hostedStatus = cachedHosts[host]['hosted'];

                    updateBrowserAction(hostedStatus, tab);
                }
            });
        }
    }
});

chrome.tabs.onCreated.addListener(function (newTab) {
    if (newTab.url) {
        checkZendeskTicketTab(newTab, newTab.url);
    }
});

function updateBrowserAction(hostedStatus, tab) {
    if (hostedStatus) {
        chrome.browserAction.setIcon({ path: 'toolbar-acquia.png', tabId: tab.id });
        chrome.browserAction.setTitle({ title: "This site is hosted with Acquia.", tabId: tab.id });
    } else {
        chrome.browserAction.setTitle({ title: "Support Tools", tabId: tab.id });
    }
}

function checkZendeskTicketTab(tab, tabUrl) {
    if (tabUrl.indexOf('https://acquia.zendesk.com/agent/#') == 0) {
        chrome.tabs.query({ url: 'https://acquia.zendesk.com/*' }, function (tabs) {
            if (tabs && tabs[0]) {
                if (tabs[0].id != tab.id) {
                    // Only merge tabs if the current tab and the first matched tab aren't the same.
                    mergeNewTabWithOriginal(tabs[0], tab);
                }
                else if (tabs.length >= 2 && tabs[1] != tab) {
                    // Allow for merging if the current tab is the first matched tab but another exists.
                    mergeNewTabWithOriginal(tabs[1], tab);
                }
            }
        });
    }
}

function mergeNewTabWithOriginal(originalTab, newTab) {
    if (originalTab.url != newTab.url) {
        chrome.tabs.update(originalTab.id, { url: newTab.url, highlighted: true });
    } else {
        chrome.tabs.update(originalTab.id, { highlighted: true });
    }

    if (originalTab.id != newTab.id) {
        chrome.tabs.remove(newTab.id);
    }
}

chrome.extension.onRequest.addListener(function (request, sender, sendResponse) {
    var toolFunction = toolActions[request.execute](request);
    $.when(toolFunction).done(function (response) {
        sendResponse(response);
    });
});
