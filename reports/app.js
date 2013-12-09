var ticketNumbers;
var ticketsProcessed;
var csvFileData;
var ticketsHit = 0;
var ticketsMissed = 0;
var ticketsUnknown = 0;
var ticketRow = 0;

$(document).ready(function() {
  $('#files').bind('change', handleFileSelect);
});

function handleFileSelect(evt) {
  var files = evt.target.files;
  var file = files[0];

  console.log('User uploaded ' + escape(file.name) + ' (' + file.type + ') of size ' + file.size);
  $('#files, #instructions').hide();
  processFile(file);
}

function processFile(file) {
  ticketNumbers = [];
  ticketsProcessed = [];
  var reader = new FileReader();
  reader.readAsText(file);
  reader.onload = function(event){
    var csv = event.target.result;
    csvFileData = $.csv.toArrays(csv);
    for(var row in csvFileData) {
      // Skip the header row.
      if (csvFileData[row][16] != "Ticket Number") {
        ticketNumbers[row] = csvFileData[row][16];
      }
    }
    console.log('Processed ' + ticketNumbers.length + ' rows of Tickets.');
    $('.status').html('Fetching SLA status for <b>' + ticketNumbers.length + '</b> tickets...');

    checkSLA();
  };
  reader.onerror = function(){ alert('Unable to read ' + file.fileName); };
}

function checkSLA() {
  // Ensure all tickets have responded.
  if (ticketRow != ticketsProcessed.length)
    return;

  ticketCheck = batchTicketSelect(5);
  if (ticketCheck.length) {
    $.each(ticketCheck, function(index, value) {
      ticketProcessCheck(value, ticketRow);
      ticketRow++;
    });
  } else {
    $('.status').text('Wrapping up!');
    wrapup();
  }
}

function batchTicketSelect(count) {
  var batchTickets = [];
  for (var i=0; i < count; i++) {
    if (ticketNumbers[1]) {
      batchTickets[i] = ticketNumbers[1];
      ticketNumbers.shift();
    }
  }
  return batchTickets;
}

function ticketProcessCheck(ticketNumber, rowNumber) {
  $.ajax('https://s5.parature.com/link/desk/15066/15171/Ticket/' + ticketNumber.split('-')[1]).done(function(data) {
    // Grab the expiry timestamp field to calculate SLA status.
    var expiryTimestampRegex = /Expiry\ Timestamp\:\&nbsp\;\<\/td\>\<td.*\>(.*)\<\/td\>/;
    var expiryTimestamp = expiryTimestampRegex.exec(data);
    expiryTimestamp = moment(generateProperDate(expiryTimestamp[1], 'YYYY-MM-DD HH:mm ZZ'));

    // Get the internal Parature ticket ID to fetch ticket history.
    var ticketIDNumberRegex = /ticketTasks\.asp\?ticketID=(\d+)/
    var ticketIDNumber = ticketIDNumberRegex.exec(data)[1];

    if (expiryTimestamp.unix() >= 0) {
      // Grab the session key so we can look at the ticket history.
      var sessionKeyRegex = /SessionId\ =\ \'(.*)\'/;
      var sessionKey = sessionKeyRegex.exec(data)[1];
      var slaStatus = checkForSLA(ticketIDNumber, sessionKey, {timestamp:expiryTimestamp.format()});

      // This happens asynchronously so we must wait for it to finish before proceeding.
      $.when(slaStatus).done(function(status) {
        ticketsProcessed[rowNumber] = {
          ticket: ticketNumber,
          sla: expiryTimestamp.format(),
          status: status['hit'],
        };

        if (status['hit']) {
          ticketsHit++;
        } else {
          ticketsMissed++;
        }

        $('.status').html('Fetching SLA status for <b>' + ticketNumbers.length + '</b> tickets...');

        checkSLA();
      });
    } else {
      ticketsUnknown++;

      ticketsProcessed[rowNumber] = {
        ticket: ticketNumber,
        sla: 'n/a',
        status: 'n/a',
      };

      $('.status').html('Fetching SLA status for <b>' + ticketNumbers.length + '</b> tickets...');

      checkSLA();
    }
  });
}

function wrapup() {
  console.log('Updating CSV file field.');

  for(var row in csvFileData) {
    // Skip the header row.
    if (csvFileData[row][16] != "Ticket Number") {
      // If a ticket row has not been processed hold off for now.
      if (!ticketsProcessed[row-1]) {
        return;
      }
      if (ticketsProcessed[row-1]['status'] != 'n/a') {
        csvFileData[row][21] = ticketsProcessed[row-1]['status'] ? '1' : '0';
      }
    }
  }

  var csvContent;
  csvFileData.forEach(function(infoArray, index){
    dataString = infoArray.join('","');
    csvContent += '"' + dataString + '"\n';
  });
  downloadFileFromText('processed_report.csv',csvContent)

  $('#files, #instructions').show();
  $('.status').text('fin.');

  var slaChartData = [{
      value : ticketsHit,
      color : "#468847"
    },
    {
      value : ticketsMissed,
      color : "#b94a48"
    },
    {
      value : ticketsUnknown,
      color : "#949FB1"
    }];
  var ctx = document.getElementById("chart").getContext("2d");
  new Chart(ctx).Doughnut(slaChartData);
}

function downloadFileFromText(filename, content) {
  var a = document.createElement('a');
  var blob = new Blob([ content ], { type : 'text/csv;charset=UTF-8' });
  a.href = window.URL.createObjectURL(blob);
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  delete a;
}