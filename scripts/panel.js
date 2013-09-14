var cciNode;
var siteInfo;

$('.navBar button.cci').hide();

chrome.tabs.getSelected(function(tab){
  chrome.browserAction.getTitle({ tabId: tab.id }, function(title){
    if (title == 'This site is hosted with Acquia.') {
      chrome.extension.sendRequest({execute: 'getAcquiaMonitor'}, function(response){
        panelInitUI(response);
      });
      $('section').hide();
      $('section#tools').show();
    } else {
      $('li.tabTools').hide();
    }
  });
});

$('#tabBar li img').click(function() {
  var toggleTarget = window.event.srcElement.attributes["target"].value;
  $('section').hide();
  $('section#'+toggleTarget).show();
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

  // Credit for this goes to Byron who wrote the original bookmarklet this is distilled from.
  // Currently does not work for non-FPM sites per https://backlog.acquia.com/browse/CL-3541
  var apcPercentage = Math.round(siteInfo.apc_used / siteInfo.apc_total * 1e3) / 10;
  if (apcPercentage > 85) {
    $('.meterBar .meterFull').addClass('terrible');
  } else if (apcPercentage < 4) {
    // Host is not on FPM and numbers are inaccurate.
    apcPercentage = 100;
  } else {
    $('.meterBar .meterFull').addClass('good');
  }
  $('.meterBar .meterFull').attr('style', 'width: '+apcPercentage+'%;');
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
