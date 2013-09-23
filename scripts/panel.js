var cciNode;
var uuid;
var subscriptionNumber;
var siteInfo;
var thermopylae = false;

// Hide elements of the UI so we can show them when certain conditions are met.
$('.navBar button.cci').hide();
$('.dc-only').hide();
$('.thermopylae').hide();

// Highly experimental integration with Thermopylae.
// Only show features that rely on Thermopylae if the backend is running.
var xhr = new XMLHttpRequest();
xhr.open('GET', 'http://localhost:47051', true);
xhr.onreadystatechange = function() {
  if (xhr.readyState == 4 && xhr.responseText) {
    var thermopylaeStatus = JSON.parse(xhr.responseText);
    $('.thermopylae.show').show();
    thermopylae = true;
  }
}
xhr.send();

chrome.tabs.getSelected(function(tab){
  chrome.browserAction.getTitle({ tabId: tab.id }, function(title){
    if (title == 'This site is hosted with Acquia.') {
      chrome.extension.sendRequest({execute: 'getAcquiaMonitor'}, function(response){
        panelInitUI(response);
      });
      $('section').hide();
      $('section#tools').show();
      if (thermopylae) {
        $('li.tabEnvironment').show();
      }
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
      var uuidRegex = /views\-field\-uuid.*\s+.*\/node\/uuid\/(.*)\/cloud/;
      activateCCIButton(cciRegex.exec(xhr.responseText)[1]);
      activateSubscriptionInfo(uuidRegex.exec(xhr.responseText)[1]);
    }
  }
  xhr.send();

  // Credit for this goes to Byron who wrote the original bookmarklet this is distilled from.
  // Currently does not work for non-FPM sites per https://backlog.acquia.com/browse/CL-3541
  var apcPercentage = Math.round(siteInfo.apc_used / siteInfo.apc_total * 1e3) / 10;
  fillMeter('apc', apcPercentage);
}

function activateSubscriptionInfo(initUUID) {
  uuid = initUUID;
  tier = siteInfo.hostname.split('.')[1];

  // We can only get server graphs if this person is a Devcloud customer.
  if (tier == 'devcloud') {
    $('.dc-only').show();

    // This is a really messy way to get the subscription number, but alas it is the only option.
    var xhrSub = new XMLHttpRequest();
    xhrSub.open('GET', 'https://insight.acquia.com/node/uuid/'+uuid+'/cloud', true);
    xhrSub.onreadystatechange = function() {
      if (xhrSub.readyState == 4) {
        var subscriptionNumberRegex = /href\=\"\/cloud\/servers\?s=(\d+)\"/;
        subscriptionNumber = subscriptionNumberRegex.exec(xhrSub.responseText)[1];

        // Now that we have the subscription number we can get the Server graph data.
        var xhrGraph = new XMLHttpRequest();
        // "end_hour" value is expected to be current hour rounded up in seconds.
        var endHour = moment().format('H')*60*60+3600;
        var xhrGraphLocation = 'https://insight.acquia.com/cloud/servers/graph/hardware?s='+subscriptionNumber+'&srv='+siteInfo.hostname.split('.')[0]+'&stats_srv=2253&mode=0&start='+moment().subtract('days', 6).format('MMM D YYYY')+'&start_hour=0&end='+moment().format('MMM D YYYY')+'&end_hour='+endHour;
        xhrGraph.open('GET', xhrGraphLocation, true);
        xhrGraph.onreadystatechange = function() {
          if (xhrGraph.readyState == 4) {
            var serverMonitor = $.parseJSON(xhrGraph.responseText);
            var cpuUsage = serverMonitor[1].arguments[0].slice(0, -1);
            var memoryUsage = serverMonitor[7].arguments[0].slice(0, -1);
            var diskUsage = serverMonitor[7].arguments[0].slice(0, -1);
            console.log(serverMonitor);
            fillMeter('cpu', cpuUsage);
            fillMeter('memory', memoryUsage);
            fillMeter('disk', diskUsage);
          }
        }
        xhrGraph.send();
      }
    }
    xhrSub.send();
  }
  activateEnvironmentInfo();
}

function activateEnvironmentInfo() {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'http://localhost:47051/'+siteInfo.site, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      var environmentInfo = JSON.parse(xhr.responseText)['response'];
      $.each(environmentInfo, function(index, value) {
        $('#environment ul.details').append(
          $('<li>').attr('class', 'docroot').attr('target', index).append(index).append(
            $('<span>').attr('class', 'deployed').append(environmentInfo[index]['deployed'])
          )
        );
        $.each(environmentInfo[index]['servers'], function(serverName, serverValue) {
          $('#environment ul.details').append(
            $('<li>').attr('class', serverName+' servers server__'+index).append(serverName)
          );
        });
      });
      $('#environment ul.details').click(function() {
        var toggleTarget = window.event.srcElement.attributes["target"].value;
        var serverTarget = '#environment ul .server__'+toggleTarget;
        if ($(serverTarget).is(':hidden')) {
          $('#environment ul .servers').hide();
          $(serverTarget).show();
        } else {
          $('#environment ul .servers').hide();
        }
      });
    }
  }
  xhr.send();
}

function fillMeter(meter, percentage) {
  var meterSelector = '.meterBar.'+meter+' .meterFull';
  if (percentage > 85) {
    $(meterSelector).addClass('terrible');
  } else if (percentage < 4 && meter == 'apc') {
    // Host is not on FPM and numbers are inaccurate.
    percentage = 100;
  } else {
    $(meterSelector).addClass('good');
  }
  $(meterSelector).attr('style', 'width: '+percentage+'%;');
}

function activateCCIButton(nodeID) {
  $('h1.title').addClass('cci-button');
  $('h1.title').html('Acquia Tools for @'+siteInfo.site);
  cciNode = nodeID;
  $('.navBar button.cci').click(function(){
    chrome.tabs.create({ url: 'http://cci.acquia.com/node/'+cciNode+'/dashboard' });
  });
  $('.navBar button.cci').show();

  parseCCIDashboardForGoodies(nodeID);
}

function parseCCIDashboardForGoodies(cciNode) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://cci.acquia.com/cci_sub_dashboard/parature_ajax/ajax/'+cciNode, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      var ticketTable = JSON.parse(xhr.responseText)[1]['data'];
      $('#tickets').html(ticketTable);
      $('#tickets table th:nth-child(1)').html('Recent Tickets');
      $('#tickets table td:nth-child(2),#tickets table th:nth-child(2)').hide();
      $('#tickets table td:nth-child(3),#tickets table th:nth-child(3)').hide();
      $('#tickets table td:nth-child(4),#tickets table th:nth-child(4)').hide();
    }
  }
  xhr.send();
}
