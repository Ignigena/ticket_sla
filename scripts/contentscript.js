/*
 * Albert Martin
 * Matt Lucasiewicz
 */

var ticketListRegex = /Ticket\ List.*\(.*\)/;
var ticketListSLARegex = /Ticket\ List.*Tickets\ By\ SLA.*\(.*\)/;
var ticketDetailRegex = /Ticket\ Description/;
var ticketQueuesRegex = /Filters\s*15066\ -/;
var outOfScopeRegex = /Out\ of\ Scope\?\:\&nbsp\;\<\/td\>\<td\>Yes/;

var ticketsMissed = 0;
var ticketsWarning = 0;
var ticketsGood = 0;

var tickets = [];

// Fix for ticket detail pages not loading full Parature frameset.
// Change introduced by Parature in a silent release that inconveniences some of our tools integration.
if (document.location.href.split('?')[0]) {
    var urlElements = document.location.href.split('?')[0].split('/');
    if (urlElements[urlElements.length-1] == "ticketDetail.asp") {
        var ticketIDNumberRegex = /ticketTasks\.asp\?ticketID=(\d+)/
        var ticketIDNumberMatch = ticketIDNumberRegex.exec(document.body.innerHTML);
        if (ticketIDNumberMatch[1]) {
            window.location.replace("https://s5.parature.com/ics/service/main.asp?ticket_id=" + ticketIDNumberMatch[1]);
        }
    }
}

// DOM manipulation on the ticket queues list.
if (ticketQueuesRegex.test(document.body.innerText)) {
    var allTicketQueues = "2687,3227,1664,3173,3338,3439,3139,1545,1546,1547,2190,2528,3252,1200,1655";
    var ticketViewURL = "https://s5.parature.com/ics/tt/ticketlist.asp?artr=0&filter_queue="+allTicketQueues+"&title=All+Tickets+By+SLA&pageSize=100";
    // Add a link to the "New and Unsassigned" queue at the top of the list.
    $("#mainDiv > div").prepend('<div class="dTreeNode p0 toptier"><img src="../images/ftv2blank.gif" alt=""><img class="nodeIcon" id="iparentTree2" src="/ics/images/ticket/ticketQueueClosed.gif" alt=""><a id="sparentTree2" href="'+ticketViewURL+'" target="content" class="node">All New Tickets</a></div>');

    var xhr = new XMLHttpRequest();
    xhr.open("GET", ticketViewURL, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        var openTicketsRegex = /countDiv\.innerHTML\ =\ "\((\d+-\d+\ of\ )?(\d+)\)";/
        var openTicketsMatch = openTicketsRegex.exec(xhr.responseText);
        var openTickets = openTicketsMatch[2];

        if (openTickets >= 1) {
            $(".toptier a.node").html('<b>All New Tickets</b> <span class="itemCount">('+openTickets+')</span>');
        }
      }
    }
    xhr.send();
}

// If this is the ticket list, process it accordingly.
if ($("#winTab__columns").length) {
    $('#tableContent').waitFor(function() {
        processTicketList()
    });
}

function processTicketList() {
    chrome.storage.local.get('newWindowTickets',function(data){
        if(data.newWindowTickets){
            $("#tableContent tbody tr td a").each(function () {
                $(this).attr('target', '_blank');
            });
        }
    });

    // If this is the "All Tickets" view make sure that Escalated Advocacy tickets get prime treatment.
    if (ticketListSLARegex.test(document.body.innerText)) {
        $('#tableContent').before('<table class="escalated-advocacy" width="100%"></table>');
        $.ajax("https://s5.parature.com/ics/tt/ticketlist.asp?filter_queue=3439").done(function(data) {
            $('table.escalated-advocacy').append($("tr.gridRow", data));
            $('table.escalated-advocacy td:not(:nth-child(2), :nth-child(7), :nth-child(8), :nth-child(9), :nth-child(12), :nth-child(13))').hide();
            $('table.escalated-advocacy tr').addClass('yellow').prepend('<td class="sla-report">Escalated Advocacy</td>');
            // Temporary fix for annoying locked header bug.
            $("#lockedHeader").remove();
        });
    }

    // Parse the table for all the tickets.
    var headers = [];
    $('#tableContent thead td').each(function(index, item) {
        headers[index] = $(item).text().trim();
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
        $("#lockedHeader tr").prepend('<td class="winColName slacolumn" nowrap style="width:90px">Time to SLA</td>');
        $("#tableContent thead tr").prepend('<td class="winColName slacolumn" nowrap style="width:90px">Time to SLA</td>');

        ticketListRelativeDates(tickets.length);

        // Loop through each row of tickets.
        for (i = 0; i < tickets.length; i++) {
            var color = 'grey';
            var sla = 'Unknown';
            var slaRaw;
            var slaStatus;

            // Check to see if the Expiry Timestamp column has synced over to Parature.
            if (tickets[i]['Expiry Timestamp'].length > 0) {
                var expiry = formatSLATimestamp(tickets[i]['Expiry Timestamp']);

                // Relative time until or since the SLA is either hit or missed.
                sla = expiry['timestamp'];
                slaRaw = moment(sla).unix();
                color = expiry['color'];
            } else {
                // Define the customer, urgency, and created columns
                var customer = tickets[i]['SLA'];
                var urgency = tickets[i]['Urgency'];
                var dateFormat;
                dateFormat = getSelectedDateFormat(i);

                $.when(dateFormat).done(function(format) {
                    var created = generateProperDate(tickets[format['row']]['Date Created'], format['format']);

                    var estimatedSLA = legacySLACalculator(created, customer, urgency);
                    estimatedSLA = moment(estimatedSLA.format());

                    if (estimatedSLA) {
                        sla = $.timeago(estimatedSLA.format()) + ' (Estimated)';
                        slaRaw = moment(estimatedSLA.format()).unix();
                        slaStatus = checkForSLA(tickets[format['row']]['Ticket #'], sessionKey, { 'timestamp' : estimatedSLA }, format['row']);
                        estimatedSLA = null;
                    }

                    $('#listRow'+format['row']+' .sla-report').html(sla);

                    $.when(slaStatus).done(function(status) {
                        formatRowBasedOnSLAStatus(status);
                    });
                });
            }

            if (tickets[i]['Onboarding Account'] == 'Yes') {
                $('#tableContent tbody tr:nth-child('+(i+1)+') td:nth-child('+(getColumnIndexByName('Account Name')-1)+')').append(' <b class="onboarding">Onboarding</b>');
            }

            if (tickets[i]['Remote Administration'] == 'Yes') {
                $('#tableContent tbody tr:nth-child('+(i+1)+') td:nth-child('+(getColumnIndexByName('Summary')-1)+')').append(' <b class="ra">(RA)</b>');
            }

            // Grab the session key so we can look at the ticket history.
            var sessionKeyRegex = /getFeedbackResponses\(\'(.*)\'\)/;
            var sessionKey = sessionKeyRegex.exec(document.body.innerHTML)[1];

            if (expiry != null) {
                slaStatus = checkForSLA(tickets[i]['Ticket #'], sessionKey, expiry, i);
                expiry = null;
            }
        
            // Once the SLA status is determined, update the row accordingly.
            $.when(slaStatus).done(function(status) {
                formatRowBasedOnSLAStatus(status);
            });

            // Style the SLA cell and print it out!
            // @todo Allow click to toggle between Relative and Absolute date strings.
            changeTicketStatus(i, color);
            $('#listRow'+i).prepend('<td nowrap class="sla-report sla'+i+'" data-sort-value="'+slaRaw+'"><abbr class="timeago" title="'+sla+'">'+sla+'</abbr></td>');
        }

        // Tidy up the ticket list and sort by SLA if we're on the All Tickets By SLA queue.
        ticketListUITidy(ticketListSLARegex.test(document.body.innerText));

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

// Ticketmine Shortcut!
if ($('#toolbar td.tabs').next().text().trim() == "New Ticket") {
    $('td#folderTabDivider', $('#toolbar td.tabs').next()).after('<td class="winButton ticketmine" nowrap="" style="cursor:pointer; cursor:hand;" onmouseover="this.className=\'winButtonActive\';" onmouseout="this.className=\'winButton\';"><img src="http://ticketmine.network.acquia-sites.com/sites/default/files/manatee.png" border="0" style="HEIGHT:16px; WIDTH:16px;" align="absmiddle">&nbsp;Ticketmine&nbsp;</td>');
    $('td.ticketmine').click(function() {
        // Initialize the GUI.
        $.get(chrome.extension.getURL('gui/ticketmine.html'), function(data) {
            $('body', top.frames["content"].document).html(data);
            $('body', top.frames["content"].document).removeClass('winBackOH').removeClass('winBack');
            $('body', top.frames["content"].document).attr('style','');

            // Initialize the search capabilities.
            $('.ticketmineSearch', top.frames["content"].document).submit(function() {
                var search = $('input.ticketmineTerms', top.frames["content"].document).val();
                if (search) {
                    ticketmineExecute(search);
                }
                return false;
            })
        });
    })
}

function ticketmineExecute(search, page) {
    var ticketmineBody = top.frames["content"].document;

    var spinnerOptions = {
        lines: 13,
        length: 10,
        width: 5,
        radius: 15
    };
    var spinner = new Spinner(spinnerOptions).spin(ticketmineBody.body);
    if (!page) page = 1;

    $.ajax("http://ticketmine.network.acquia-sites.com/search/site/"+search+"?page="+page, {
      error: function() {
        $('.ticketminePager').hide();
        $('p.placeholder', ticketmineBody).show();
        $('p.placeholder', ticketmineBody).text('You are not logged into Ticketmine and so I cannot search.')
      }
    }).done(function(data) {
        $('p.placeholder', ticketmineBody).hide();
        $('#tableContent tbody tr', ticketmineBody).remove();
        $('li.search-result', data).each(function() {
            var title = $('.title', this).html();
            var snippet = $('.search-snippet', this).html();
            var created = $('.search-info', this).text().split(' - ')[1];
            $('#tableContent tbody', ticketmineBody).append('<tr class="gridRow grey"><td class="sla-report">Unknown</td><td>15066-000000</td><td>'+title+'</td><td>'+created+'</td><td></td><td></td><td><b>System Default</b></td></tr><tr><td colspan="7" class="ticketmineSnippet">'+snippet+'</td></tr>')
        });

        // Pager controls.
        var maxPage = $('.pager-last a', data).attr('href').split('?page=')[1];
        $('input.ticketminePrev', ticketmineBody).prop('disabled', (page == 1));
        $('input.ticketmineNext', ticketmineBody).prop('disabled', (page == maxPage));

        $('form.ticketminePager', ticketmineBody).show();
        $('span.ticketmineCount', ticketmineBody).text(' of ' + maxPage);
        $('input.ticketminePage', ticketmineBody).val(page);
        $('form.ticketminePager', ticketmineBody).submit(function() {
            ticketmineExecute(search, $('input.ticketminePage', top.frames["content"].document).val());
            return false;
        })

        $('input.ticketminePrev', ticketmineBody).click(function() {
            ticketmineExecute(search, page-1);
            return false;
        })
        $('input.ticketmineNext', ticketmineBody).click(function() {
            ticketmineExecute(search, page+1);
            return false;
        })

        spinner.stop();
    });
}

// If this is the ticket page, process accordingly.
if ($('div.ticketCell table:nth-child(1) td.head2').text().trim() == "Ticket Summary") {
    if ($('#title').text() != "Edit Ticket" && $('#title').text() != "New Ticket") {
        // Allow for easy copy/paste of ticket links by updating browser URL.
        var ticketNumber = $('#title').text().split(':')[0].split('-')[1];
        window.parent.history.replaceState(null, "Parature", "/link/desk/15066/15171/Ticket/"+ticketNumber);

        // Grab status from Jira tickets that are linked in the "Bug Tracker URL" field.
        $('td:contains("Bug Tracker URL:")').waitFor(function() {
            var jiraTicket = $('td:contains("Bug Tracker URL:")').next().text();
            if (jiraTicket.toLowerCase().indexOf("http") >= 0) {
                var jiraTicketNumber = new String(jiraTicket.split('/').pop());
                if (jiraTicketNumber.length >= 3) {
                    $('td:contains("Bug Tracker URL:")').next().html('<a href="'+jiraTicket+'" target="_blank">'+jiraTicketNumber+'</a>');
                    $.ajax('https://backlog.acquia.com/si/jira.issueviews:issue-xml/'+jiraTicketNumber+'/'+jiraTicketNumber+'.xml').done(function(data) {
                        $('td:contains("Bug Tracker URL:")').next().append(' ('+$(data).find('status').text()+')');
                    });
                }
            }
        });
    }

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

            var sla = formatSLATimestamp(expiryTimestamp);
            var slaStatus = checkForSLA(window.location.search.slice(11), sessionKey, sla);
            var textColor = "white";

            // Once we determine if a response is required, add the banner if necessary.
            $.when(slaStatus).done(function(status) {
                if (!status['response']) {
                    if (outOfScopeRegex.test(document.body.innerHTML)) {
                        $('#ticketLeftCol').prepend('<div id="slaBanner" class="grey"><strong>This ticket has been marked as Out of Scope</strong> A response is still required.</div>');
                    } else {
                        $('#ticketLeftCol').prepend('<div id="slaBanner" class="'+sla['color']+'"><strong>Response required</strong> <abbr class="timeago" title="'+sla['timestamp']+'">'+sla['timestamp']+'</abbr></div>');
                    }
                    $('#ticketLeftCol').css('padding-top','40px');

                    $.timeago.settings.allowFuture = true;
                    $('abbr.timeago').timeago();

                    // Respond to changes in the SLA banner to avoid missing SLA from a forgotten tab.
                    $("abbr.timeago").on('timechanged', function(event, timestamp, timeDifference) {
                        var minuteDifference = (timeDifference / 1000) / 60;

                        // If the ticket is within a 5 minute window of missing SLA, show an alert.
                        if (minuteDifference >= -5 && minuteDifference <= 0) {
                            chrome.extension.sendRequest({execute: 'notification', title: 'Ticket Nearing SLA', msg: 'A ticket you are viewing is 5 minutes or less from missing SLA!'});
                        }
                    });

                    $('#slaBanner').css('width', '-webkit-calc('+$('#ticketLeftCol')[0].style.width+' - 22px)');
                }
            });
        }
    }

    // Adding a Show Tickets button to the customer sidebar in a ticket.
    if ($('.customerToolkitHeader td').length) {
      var customerID = $('.customerToolkitHeader td:contains("Contact")+td a').attr('href').split('?customerID=')[1];
      if (customerID) {
        $('.customerToolkitHeader td:contains("Contact")').append('<input class="viewtickets customer" type="button" value="Show Tickets">');
        $('.customerToolkitHeader td .viewtickets.customer').click(function() {
          window.open('https://s5.parature.com/ics/customer/admmytickets.asp?customerID='+customerID);
        });
      }
      var accountID = $('.customerToolkitHeader td:contains("Account")+td a').attr('href').split('?amID=')[1];
      if (accountID) {
        $('.customerToolkitHeader td:contains("Account")').append('<input class="viewtickets account" type="button" value="Show Tickets">');
        $('.customerToolkitHeader td .viewtickets.account').click(function() {
          window.open('https://s5.parature.com/ics/am/amTickets.asp?amID='+accountID);
        });
      }
    }
}

function formatRowBasedOnSLAStatus(status) {
    var outOfScope;

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
            $('#listRow'+status['row']).removeClass('red yellow green ackd hit').addClass('no-scope');
        }
    });
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

function ticketListUITidy(slaSort) {
    // Remove columns that are redundant or uneccessary.
    hideColumnByColumnName('Expiry Timestamp', 'Ticket Origin', 'Onboarding Account', 'Remote Administration');

    // Remove extra images causing wrapping issues in header.
    $('#tableContent td img').remove();
    
    // Hide these columns as they are unnecessary to the All Tickets view.
    if (slaSort) {
        hideColumnByColumnName('Assigned To', 'Status');
    }

    // Remove the Attachments column.
    $('form div > table tr td:nth-child(4)').hide();

    if (getColumnIndexByName('Status')) {
        $('form div > table tr td:nth-child('+getColumnIndexByName('Status')+')').width('25px');
    }

    // Hack to get the table to resize properly in the window.
    $(".lockedTableHeader").width('1px');
    $(".lockedTableContainer").height(($(".lockedTableContainer").height()-16)+'px');

    var tableHeader = $('#tableContent thead tr').html();
    tableHeader = tableHeader.replace(/<td /g, '<th ').replace(/<\/td>/g, '</th>');
    $('#tableContent thead tr').html(tableHeader);

    $("#tableContent thead th").not(":has(input[name=allCheck])").attr('data-sort', 'string');
    $("#tableContent thead .slacolumn").attr('data-sort', 'int');
    $("#tableContent").stupidtable();

    if (slaSort) {
        $('#tableContent thead th.slacolumn').trigger('click');
    }
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
    if (minutes && newStatus == 'yellow' && (currentStatus != newStatus || minutes >= -5)) {
        minutes = Math.round(-minutes);
        if (minutes <= 1) {
            minutes = 'less than a minute';
        } else {
            minutes = minutes+' minutes';
        }
        ticketNumber = tickets[rowNumber]['Ticket #']
        chrome.extension.sendRequest({execute: 'notification', mode: 'load', ticket: ticketNumber, title: 'Ticket Nearing SLA', msg: 'Ticket '+ticketNumber+' is '+minutes+' from missing SLA!'});
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
    SLAdefinition["Elite (Europe)"] = SLAdefinition["Elite (Americas)"];
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
    for (var column in arguments) {
        var columnIndex = getColumnIndexByName(arguments[column]);
        // Verify the column exists in this view.
        if (columnIndex) {
            // Hide it!
            $('form div > table tr td:nth-child('+columnIndex+')').hide();
        }
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

function checkForOutOfScope(ticketNumber, row) {
    var defer = new $.Deferred();
    var outOfScope = false;

    $.ajax("https://s5.parature.com/ics/tt/ticketDetail.asp?ticket_id="+ticketNumber).done(function(data) {
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
        if (!data[0]['ReturnData']) {
            return;
        }

        // All actions performed on the ticket.
        var ticketActions = data[0]['ReturnData']['Dtos'];

        // For each action, determine whether external communication has been made and whether or not SLA was hit.
        for (i = 0; i < ticketActions.length; i++) {
            var externalCommunication = ticketActions[i]['ActionPerformed']['EmailCustomer'];
            var showToCustomer = ticketActions[i]['ShowToCustomer'];
            var actionDate = ticketActions[i]['ActionDate']+convertTimezone(ticketActions[i]['FormattedDateTime'].slice(-4));

            // Only continue if this is external communication by a Supporta.
            if ((externalCommunication || showToCustomer) && (ticketActions[i]['PerformedByCsr'] != null && ticketActions[i]['PerformedByCsr']['Id'] != 0)) {
                // External communication has been made by a Supporta.
                responseSent = true;
                if (moment(slaTime).diff(moment(actionDate), 'minutes')+moment(actionDate).zone() >= 0) {
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
