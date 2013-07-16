/*
 * Albert Martin
 * Matt Lucasiewicz
 */

var regex = /Ticket\ List.*\(.*\)/;

if (regex.test(document.body.innerText)) {
    chrome.extension.sendRequest({}, function(response) {});

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
        // Add the extra column for Time to SLA
        $("#lockedHeader tr").prepend('<td class="winColName" nowrap style="width:90px">Time to SLA</td>');
        $("#tableContent thead tr").prepend('<td class="winColName" nowrap style="width:90px">Time to SLA</td>');

        // Loop through each row of tickets
        for (i = 0; i < tickets.length; i++) {
            var timezone = tickets[i]['Expiry Timestamp'].slice(-3);
            if(timezone == 'EDT'){
                timezone = '-0400';
            }

            var expire = moment(tickets[i]['Expiry Timestamp'].slice(0,-3)+timezone, 'YYYY-MM-DD HH:mm ZZ');
            var color = 'grey';
            var sla = '';

            // Colour the cell based on whether or not SLA was missed
            var diff = expire.diff(moment(), "minutes");
            if (diff >= 30) {
                color = 'green';
            } else if (diff <= 0){
                color = 'red';
            } else {
                color = 'yellow';
            }

            sla = jQuery.timeago(expire.format());

            // Style the SLA cell and print it out!
            //$('#listRow'+i+' td:nth-child(12)').replaceWith('<td>'+ticket_updated+'</td>');
            $('#listRow'+i).prepend('<td nowrap style="width:90px;background-color:'+color+'" class="slate">'+sla+'</td>');

            //$('#listRow'+i).prepend('<td nowrap style="width:90px;background-color:'+color+'" class="slate">'+expire.format()+'</td>');
            /*
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
             }*/
            sla = null;
        }
    }
}

