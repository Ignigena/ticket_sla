/*
 * Albert Martin
 * Matt Lucasiewicz
 */

var ticketListRegex = /Ticket\ List.*\(.*\)/;
var ticketDetailRegex = /Ticket\ Summary/;

var ticketsMissed = 0;
var ticketsWarning = 0;
var ticketsGood = 0;

// If this is the ticket list, process it accordingly.
if (ticketListRegex.test(document.body.innerText)) {
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
        // Add the SLA filtering buttons.
        ticketListSLAButtons();

        // Add the extra column for Time to SLA.
        $("#lockedHeader tr").prepend('<td class="winColName" nowrap style="width:90px">Time to SLA</td>');
        $("#tableContent thead tr").prepend('<td class="winColName" nowrap style="width:90px">Time to SLA</td>');

        ticketListRelativeDates(tickets.length);

        // Loop through each row of tickets.
        for (i = 0; i < tickets.length; i++) {
            var color = 'grey';
            var sla = 'Unknown';

            // Check to see if the Expiry Timestamp column has synced over to Parature.
            if (tickets[i]['Expiry Timestamp'].length > 0) {
                var expiry = formatTimestamp(tickets[i]['Expiry Timestamp']);

                // Relative time until or since the SLA is either hit or missed.
                sla = expiry['timestamp'];
                color = expiry['color'];
            } else {
                // Define the customer, urgency, and created columns
                var customer = tickets[i]['SLA'];
                var urgency = tickets[i]['Urgency'];
                var created = moment(tickets[i]['Date Created'], 'M/D/YYYY h:mm A zzz');

                var estimatedSLA = legacySLACalculator(created, customer, urgency);

                if (estimatedSLA) {
                    sla = $.timeago(estimatedSLA.format()) + ' (Estimated)';
                }
            }

            // Grab the session key so we can look at the ticket history.
            var sessionKeyRegex = /getFeedbackResponses\(\'(.*)\'\)/;
            var sessionKey = sessionKeyRegex.exec(document.body.innerHTML)[1];
            var slaStatus;
            var outOfScope;

            if (expiry != null) {
                slaStatus = checkForSLA(tickets[i]['Ticket #'], sessionKey, expiry, i);
                expiry = null;
            } else if (estimatedSLA != null) {
                slaStatus = checkForSLA(tickets[i]['Ticket #'], sessionKey, { 'timestamp' : estimatedSLA }, i);
                estimatedSLA = null;
            }
        
            // Once the SLA status is determined, update the row accordingly.
            $.when(slaStatus).done(function(status) {
                if (!status) return;
                if ($('.sla'+status['row']).hasClass('sla-none')) return;

                if (status['hit']) {
                    changeTicketStatus(status['row'], 'hit');
                } else if (status['response']) {
                    changeTicketStatus(status['row'], 'ackd');
                }

                // Check for Out Of Scope tickets, specifically to show appropriate SLA status for Developer tickets.
                outOfScope = checkForOutOfScope(tickets[status['row']]['Ticket #'], status['row']);

                $.when(outOfScope).done(function(status) {
                    if (!status) return;

                    if (status['oos']) {
                        $('.sla'+status['row']).html("Out of Scope");
                        $('#listRow'+status['row']).removeClass('red yellow green').addClass('no-scope');
                    }
                });
            });

            // Style the SLA cell and print it out!
            // @todo Allow click to toggle between Relative and Absolute date strings.
            changeTicketStatus(i, color);
            $('#listRow'+i).prepend('<td nowrap class="sla-report sla'+i+'"><abbr class="timeago" title="'+sla+'">'+sla+'</abbr></td>');
        }

        // A few utility functions to enhance the ticket grid display.
        ticketListUITidy();

        // Update in real time!
        $.timeago.settings.allowFuture = true;
        $('abbr.timeago').timeago();

        // Respond to changes in the SLA status as the timestamps count down.
        $("abbr.timeago").on('timechanged', function(event, timestamp, timeDifference) {
            var minuteDifference = (timeDifference / 1000) / 60;
            var rowNumber = $(this).parent().parent().attr('id').slice(7);

            if (minuteDifference >= -30) {
                if (minuteDifference <= 0) {
                    // SLA warning threshold, 30 minutes remain.
                    changeTicketStatus(rowNumber, 'yellow', minuteDifference);
                } else {
                    // SLA has been missed.
                    changeTicketStatus(rowNumber, 'red');
                }
            }
        });
    }
}

// If this is the ticket page, process accordingly.
if (ticketDetailRegex.test(document.body.innerText)) {
    // If the ticket status is any of these, it will be considered as acknowledged.
    // @todo Need to be smarter with "Needs Reply" since this can sometimes be the status even though no ack.
    var ticketStatusRegex = /Status:.*(Need\ More\ Info|Solution\ Suggested|Reopened|Closed)/;

    // Based on the status, it's possible the ticket has not been acknowledged.
    if (!ticketStatusRegex.test(document.body.innerText)) {
        // Fetch the Expiry Timestamp field from the ticket body.
        var expiryTimestampRegex = /Expiry\ Timestamp:.*(\d{4}-\d{2}-\d{2} \d{2}:\d{2}\ .{3})/;
        var expiryTimestamp = expiryTimestampRegex.exec(document.body.innerText)[1];

        if (expiryTimestamp) {
            // Grab the session key so we can look at the ticket history.
            var sessionKeyRegex = /SessionId\ =\ \'(.*)\'/;
            var sessionKey = sessionKeyRegex.exec(document.body.innerHTML)[1];

            var sla = formatTimestamp(expiryTimestamp);
            var slaStatus = checkForSLA(window.location.search.slice(11), sessionKey, sla);
            var textColor = "white";

            // Once we determine if a response is required, add the banner if necessary.
            $.when(slaStatus).done(function(status) {
                if (!status['response']) {
                    $('#ticketLeftCol').prepend('<div id="slaBanner" class="'+sla['color']+'"><strong>Response required</strong> <abbr class="timeago" title="'+sla['timestamp']+'">'+sla['timestamp']+'</abbr></div>');
                    $('#ticketLeftCol').css('padding-top','40px');

                    $.timeago.settings.allowFuture = true;
                    $('abbr.timeago').timeago();

                    // Respond to changes in the SLA banner to avoid missing SLA from a forgotten tab.
                    $("abbr.timeago").on('timechanged', function(event, timestamp, timeDifference) {
                        var minuteDifference = (timeDifference / 1000) / 60;

                        // If the ticket is within a 5 minute window of missing SLA, show an alert.
                        if (minuteDifference >= -5 && minuteDifference <= 0) {
                            chrome.extension.sendRequest({title: 'Ticket Nearing SLA', msg: 'A ticket you are viewing is 5 minutes or less from missing SLA!'});
                        }
                    });
                }
            });
        }
    }
}

// Allows users to show only tickets which match a certain SLA status.
function toggleBySLA() {
    var toggleTarget = window.event.srcElement.attributes["name"].value;

    if (toggleTarget == "all") {
        $('input.toggleBySLA.SLAall').hide();
        $('tr.gridRow').show();
    } else {
        $('input.toggleBySLA.SLAall').show();
        $('tr.gridRow').hide();
        $('tr.gridRow.'+toggleTarget).show();

        if (toggleTarget == 'green') {
            $('tr.gridRow.hit').show();
        } else if (toggleTarget == 'red') {
            $('tr.gridRow.ackd').show();
        }
    }
}

function ticketListSLAButtons() {
    // Add buttons to allow filtering by the SLA status.
    $('#countDiv').append('&nbsp;&nbsp;<input class="formButton toggleBySLA SLAall" name="all" type="button" value="Show All">');
    $('#countDiv').append('<input class="formButton toggleBySLA SLAred" name="red" type="button" value="Missed SLA">');
    $('#countDiv').append('<input class="formButton toggleBySLA SLAyellow" name="yellow" type="button" value="Warning SLA">');
    $('#countDiv').append('<input class="formButton toggleBySLA SLAgreen" name="green" type="button" value="Good SLA">');
    $('#countDiv').append('<input class="formButton toggleBySLA SLAnone" name="no-scope" type="button" value="Out of Scope">');
    
    // Hide the "Show All" since on page load we are already showing all.
    $('input.toggleBySLA.SLAall').hide();
    // Bind the toggleBySLA() function to the filter buttons.
    $('input.toggleBySLA').click(toggleBySLA);
}

function ticketListUITidy() {
    // Remove the Expiry Timestamp column since it's redundant.
    hideColumnByColumnName('Expiry Timestamp');

    // Remove the Ticket Origin column.
    hideColumnByColumnName('Ticket Origin');

    // Remove the Attachments column.
    $('form div > table tr td:nth-child(4)').hide();

    // Shorten the RA column display.
    $("thead td:contains('Remote Administration')").html("RA");

    // Shorten the Onboarding column display.
    $("thead td:contains('Onboarding Account')").html("Onboarding");

    if (getColumnIndexByName('Status')) {
        $('form div > table tr td:nth-child('+getColumnIndexByName('Status')+')').width('25px');
    }

    // Hack to get the table to resize properly in the window.
    $(".lockedTableHeader").width('1px');
    $(".lockedTableContainer").height(($(".lockedTableContainer").height()-16)+'px');
}

// Change a specific ticket row to a different SLA status.
// Will update the color, language, and filter buttons at the top.
function changeTicketStatus(rowNumber, newStatus, minutes) {
    var currentStatus = $('#listRow'+rowNumber).attr('class');
    currentStatus = currentStatus.replace(/\s/g, "").replace(/gridRow/g, "");

    $('#listRow'+rowNumber).removeClass(currentStatus);
    $('#listRow'+rowNumber).addClass(newStatus);

    if (newStatus == "hit") {
        $('.sla'+rowNumber).html("SLA Hit");
    } else if (newStatus == "ackd") {
        $('.sla'+rowNumber).html("SLA Missed");
    }

    // Only display an alert if the ticket turns yellow after the page loads or has less than 5 minutes left.
    if (newStatus == 'yellow' && (currentStatus != newStatus || minutes >= -5)) {
        minutes = (minutes >= -5) ? 5 : 30;
        ticketNumber = tickets[rowNumber]['Ticket #']
        chrome.extension.sendRequest({mode: 'load', ticket: ticketNumber, title: 'Ticket Nearing SLA', msg: 'Ticket '+ticketNumber+' is '+minutes+' minutes or less from missing SLA!  Click to view.'});
    }

    ticketsMissed = $('tr.red, tr.ackd').length;
    ticketsWarning = $('tr.yellow').length;
    ticketsGood = $('tr.green, tr.hit').length;

    $('.SLAred').attr('value', ticketsMissed+' Missed SLA');
    $('.SLAyellow').attr('value', ticketsWarning+' Warning SLA');
    $('.SLAgreen').attr('value', ticketsGood+' Good SLA');
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

function hideColumnByColumnName(columnName) {
    var columnIndex = getColumnIndexByName(columnName);
    // Verify the column exists in this view.
    if (columnIndex) {
        // Hide it!
        $('form div > table tr td:nth-child('+columnIndex+')').hide();
    }
}

function getColumnIndexByName(columnName) {
    var indexOfKey = 2;
    var columnNumber = $.map(tickets[0], function(val, key) {
        indexOfKey++
        return key == columnName ? indexOfKey : null;
    });

    if (columnNumber >= 1) {
        return columnNumber;
    } else {
        return null;
    }
}

function makeExistingDateRelative(oldhtml, dateFormat) {
    var properDate = moment(oldhtml, dateFormat).format();
    return '<abbr class="timeago" title="'+properDate+'">'+properDate+'</abbr>';
}

function formatTimestamp(timestamp) {
    var color = 'grey';
    var expire = moment(timestamp, 'YYYY-MM-DD HH:mm zzz');

    // Colour the cell based on whether or not SLA was missed
    var diff = expire.diff(moment(), "minutes");
    if (diff >= 30) {
        color = 'green';
    } else if (diff <= 0){
        color = 'red';
    } else {
        color = 'yellow';
    }

    return {
        "color" : color,
        "timestamp" : expire.format(),
    }
}

function checkForOutOfScope(ticketNumber, row) {
    var defer = new $.Deferred();
    var outOfScope = false;

    $.ajax("https://s5.parature.com/ics/tt/ticketDetail.asp?ticket_id="+ticketNumber).done(function(data) {
        var outOfScopeRegex = /Out\ of\ Scope\?\:\&nbsp\;\<\/td\>\<td\>Yes/;

        // If this is the ticket list, process it accordingly.
        if (outOfScopeRegex.test(data)) {
            outOfScope = true;
        }

        defer.resolve({
            'oos' : outOfScope,
            'row' : row
        });
    });

    return defer.promise();
}

function checkForSLA(ticketNumber, sessionKey, slaFormattedTime, row) {
    // Using jQuery's "Deferred" class we can be notified once the request has completed.
    var defer = new $.Deferred();

    var slaTime = slaFormattedTime['timestamp'];
    var responseSent = false;
    var slaHit = false;

    // Post data required by Parature to return a proper response.
    var postData = [{
        "ServiceName" : "Ticket",
        "OperationName" : "FindTicketActionHistory",
        "SessionId" : sessionKey,
        "Arguments" : {
            "search" : "{\"Id\" : "+ticketNumber+",\"PageSize\" : 25,\"PageNumber\" : 1}"
        }
    }];
    
    // Make the AJAX request.
    $.ajax({
        type: "POST",
        url: "https://s5.parature.com/jsonrequest/RequestHandler.aspx",
        data: JSON.stringify(postData),
        dataType: "json",
    }).done(function(data) {
        // All actions performed on the ticket.
        var ticketActions = data[0]['ReturnData']['Dtos'];

        // For each action, determine whether external communication has been made and whether or not SLA was hit.
        for (i = 0; i < ticketActions.length; i++) {
            var externalCommunication = ticketActions[i]['ActionPerformed']['EmailCustomer'];
            var showToCustomer = ticketActions[i]['ShowToCustomer'];
            var actionDate = ticketActions[i]['ActionDate'];

            // Only continue if this is external communication by a Supporta.
            if ((externalCommunication || showToCustomer) && (ticketActions[i]['PerformedByCsr'] != null && ticketActions[i]['PerformedByCsr']['Id'] != 0)) {
                // External communication has been made by a Supporta.
                responseSent = true;
                if (moment(slaTime).diff(moment(actionDate), 'minutes') >= 0) {
                    // SLA has been hit!
                    slaHit = true;
                }
            }
        }

        // Tell the deferred response that all the data is ready to return.
        defer.resolve({
            'response' : responseSent,
            'hit' : slaHit,
            'row' : row
        });
    });

    // We return a promise here to support the asynchronous nature of the request.
    return defer.promise();
}

function ticketListRelativeDates(count) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "https://s5.parature.com/ics/setup/user.asp?userID=5299&task=mod", true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        var possibleFormats = {
            'mm/dd/yyyy' : 'M/D/YYYY h:mm A zzz',
            'mm/dd/yy' : 'M/D/YY h:mm A zzz',
            'dd/mm/yyyy' : 'D/M/YYYY h:mm A zzz',
            'dd/mm/yy' : 'D/M/YY h:mm A zzz',
            'month dd, yyyy' : 'MMMM D, YYYY h:mm A zzz',
            'month dd, yy' : 'MMMM D, YYYY h:mm A zzz',
        };
        var selectedFormat = $('select[name="dateFormat"]', $.parseHTML(xhr.responseText)).val();
        var dateFormat = possibleFormats[selectedFormat];
        var i = 0;

        while (i < count) {
            $('#listRow'+i+' td:nth-child('+getColumnIndexByName('Date Created')+')[value]').html(function(index, oldhtml) { return makeExistingDateRelative(oldhtml, dateFormat); });
            $('#listRow'+i+' td:nth-child('+getColumnIndexByName('Date Updated')+')[value]').html(function(index, oldhtml) { return makeExistingDateRelative(oldhtml, dateFormat); });
            i++;
        }

        $('abbr.timeago').timeago();
      }
    }
    xhr.send();
}
