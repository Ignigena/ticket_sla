/*
 * Albert Martin
 * Matt Lucasiewicz
 */

var regex = /Ticket\ List.*\(.*\)/;

if (regex.test(document.body.innerText)) {
    chrome.extension.sendRequest({}, function(response) {});
    chrome.storage.local.get('newWindowTickets',function(data){
        if(data.newWindowTickets){
            $("#tableContent tbody tr td a").each(function () {
                $(this).attr('target', '_blank');
            });
        }
    });

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

    if(tickets.length > 0 && 'Expiry Timestamp' in tickets[0]){
        // Add the extra column for Time to SLA.
        $("#lockedHeader tr").prepend('<td class="winColName" nowrap style="width:90px">Time to SLA</td>');
        $("#tableContent thead tr").prepend('<td class="winColName" nowrap style="width:90px">Time to SLA</td>');

        // Loop through each row of tickets.
        for (i = 0; i < tickets.length; i++) {
            var color = 'grey';
            var sla = 'Unknown';

            // Check to see if the Expiry Timestamp column has synced over to Parature.
            if (tickets[i]['Expiry Timestamp'].length > 0) {
                var expire = moment(tickets[i]['Expiry Timestamp'].slice(0,-3)+'-0400', 'YYYY-MM-DD HH:mm ZZ');
            
                // Colour the cell based on whether or not SLA was missed
                var diff = expire.diff(moment(), "minutes");
                if (diff >= 30) {
                    color = 'green';
                } else if (diff <= 0){
                    color = 'red';
                } else {
                    color = 'yellow';
                }

                // @todo Fetch the ticket and parse to see if a response has been posted.

                // Relative time until or since the SLA is either hit or missed.
                sla = jQuery.timeago(expire.format());
            } else {
                // Define the customer, urgency, and created columns
                var customer = tickets[i]['SLA'];
                var urgency = tickets[i]['Urgency'];
                var created = moment(tickets[i]['Date Created'].slice(0, -3), 'M/D/YYYY h:mm A');

                var estimatedSLA = legacySLACalculator(created, customer, urgency);

                if (estimatedSLA) {
                    sla = jQuery.timeago(estimatedSLA.format());
                }
            }

            // Style the SLA cell and print it out!
            // @todo Update the Date Created and Date Updated columns with timeago functionality.
            // @todo Allow click to toggle between Relative and Absolute date strings.
            $('#listRow'+i).prepend('<td nowrap style="width:90px;background-color:'+color+'" class="slate">'+sla+'</td>');
        }
    }
}

// Legacy SLA calculator for those tickets with no Expiry Timestamp populated.
// Returns a value for SLA or NULL if Unknown.
function legacySLACalculator(created, customer, urgency) {
    // If any of these fields are blank no calculation can be performed.
    if (created == null && !customer && !urgency) {
        return;
    }

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

    if (!SLAdefinition[customer]) {
        return;
    } else {
        // Based on the customer and urgency, grab the SLA timeframe.
        var timeline = SLAdefinition[customer][urgency];
        // Add the SLA timeframe to the date the ticket was created and return this value.
        return created.add('hours', timeline);
    }
}
