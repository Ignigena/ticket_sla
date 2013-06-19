/*
 * Albert Martin
 */
var regex = /Ticket/;
var myregex = /My.*Ticket/;

// Test the text of the body element against our regular expression.
if (regex.test(document.body.innerText)) {
  // The regular expression produced a match, so notify the background page.
  chrome.extension.sendRequest({}, function(response) {});
} else {
  // No match was found.
  return;
}

// Parse the table for all the tickets.
var tickets = [];
var headers = [];
$('#tableContent thead td').each(function(index, item) {
    headers[index] = $(item).text();
});
$('#tableContent tr.gridRow').has('td').each(function() {
    var arrayItem = {};
    $('td', $(this)).each(function(index, item) {
        if (index == 1) {
          // If this is the "Ticket #" column parse it for the Parature ticket ID URL.
          // We will use this later to parse the actual contents at the ticket page:
          // https://s5.parature.com/ics/tt/ticketDetail.asp?ticket_id=XXXXX
          var ticketregex = /(\d{2,})(?=")/;
          arrayItem[headers[index]] = ticketregex.exec($(item).html())[0];
        } else {
          arrayItem[headers[index]] = $(item).text();
        }
    });
    tickets.push(arrayItem);
});

// Allow future timestamps to show a relative time (SLA)
jQuery.timeago.settings.allowFuture = true;

// Add the extra column for Time to SLA
$("#lockedHeader tr").prepend('<td class="winColName" nowrap style="width:90px">Time to SLA</td>');
$("#tableContent thead tr").prepend('<td class="winColName" nowrap style="width:90px">Time to SLA</td>');

// Define the SLA timeframes (in hours) based on the SLA column values
var SLAdefinition = {
  "Elite (Americas)" : {
    "Low" : "24",
    "Medium" : "2",
    "High" : "1",
    "Critical" : "0.5"
  },
  "Enterprise (Americas)" : {
    "Low" : "24",
    "Medium" : "4",
    "High" : "2",
    "Critical" : "1"
  },
  "Pro Plus (Americas)" : {
    "Low" : "24",
    "Medium" : "8",
    "High" : "4",
    "Critical" : "1"
  },
  "Professional (Americas)" : {
    "Low" : "8",
    "Medium" : "8",
    "High" : "8",
    "Critical" : "8"
  },
  "Developer" : {
    "Low" : "24",
    "Medium" : "4",
    "High" : "2",
    "Critical" : "1"
  },
}
SLAdefinition["Partner"] = SLAdefinition["Enterprise (Americas)"];
SLAdefinition["Enterprise (Europe)"] = SLAdefinition["Enterprise (Americas)"];
SLAdefinition["Enterprise (APJ)"] = SLAdefinition["Enterprise (Americas)"];
SLAdefinition["Pro Plus (Europe)"] = SLAdefinition["Enterprise (Americas)"];
SLAdefinition["Pro Plus (APJ)"] = SLAdefinition["Enterprise (Americas)"];

// Loop through each row of tickets
for (i = 0; i < tickets.length; i++) {
  // Read the date updated stamp
  var ticket_datestamp = tickets[i]['Date Updated'];
  ticket_datestamp = ticket_datestamp.slice(0, -3);
  ticket_datestamp = ticket_datestamp.slice(0, -3);
  // Convert to relative time
  var ticket_updated = jQuery.timeago(ticket_datestamp);
  // is this useful? should we do it for created too?
  // maybe click to toggle between absolute and relative timeframe?

  // Define the customer, urgency, and created columns
  var customer = tickets[i]['SLA'];
  var urgency = tickets[i]['Urgency'];
  var created = moment(tickets[i]['Date Created'].slice(0, -3), 'M/D/YYYY h:mm A');

  // Only if all three are set do we parse.
  if (created != null && customer && urgency) {
    if (SLAdefinition[customer]) {
      // Based on the customer and urgency, grab the SLA timeframe
      var timeline = SLAdefinition[customer][urgency];
      // Add the SLA timeframe to the date the ticket was created
      var sla = created.add('hours', timeline);
    }
  }

  var color = 'grey';

  if (sla != null) {
    // Colour the cell based on whether or not SLA was missed
    if (sla.diff(moment()) >= 1) {
      color = 'green';
    } else {
      color = 'red';
    }

    // todo: fetch the ticket with AJAX and parse it to see if a response has been posted
    // no need to display the "time till SLA" if it's already been ack'd
    // bonus: maybe this changes to a "SLA met" or "SLA missed" state depending on the parsed timestamp of the first response?
    if (myregex.test(document.body.innerText)) {
      if (color=='green') {
        sla = 'HIT';
      } else {
        sla = 'MISSED';
      }
    } else {
      // Change the SLA column to be a relative timestamp
      sla = jQuery.timeago(moment(sla).format());
    }
  } else {
    sla = 'UNKNOWN';
  }

  // Style the SLA cell and print it out!
  $('#listRow'+i+' td:nth-child(12)').replaceWith('<td>'+ticket_updated+'</td>');
  $('#listRow'+i).prepend('<td nowrap style="width:90px;background-color:'+color+'" class="slate">'+sla+'</td>');

  sla = null;
}
