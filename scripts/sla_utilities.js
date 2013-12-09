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
