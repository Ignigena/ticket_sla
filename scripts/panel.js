var cciNode;
var siteInfo;

$('.navBar button.cci').hide();

chrome.tabs.getSelected(function(tab){
  chrome.browserAction.getTitle({ tabId: tab.id }, function(title){
    if (title == 'This site is hosted with Acquia.') {
      chrome.extension.sendRequest({execute: 'getAcquiaMonitor'}, function(response){
        panelInitUI(response);
      });
    }
  });
});

function panelInitUI(monitordata) {
  siteInfo = monitordata;
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://cci.acquia.com/reports/support?field_leg_hosting_site_value_op=%3D&field_leg_hosting_site_value='+siteInfo.site, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      var cciRegex = /views\-field\-uuid.*\s+.*\/node\/(\d+)\/dashboard/;
      activateCCIButton(cciRegex.exec(xhr.responseText)[1]);
    }
  }
  xhr.send();
}

function activateCCIButton(nodeID) {
  $('h1.title').addClass('cci-button');
  $('h1.title').html('Acquia Tools for @'+siteInfo.site);
  cciNode = nodeID;
  $('.navBar button.cci').click(function(){
    chrome.tabs.create({ url: 'http://cci.acquia.com/node/'+cciNode+'/dashboard' });
  });
  $('.navBar button.cci').show();
}
