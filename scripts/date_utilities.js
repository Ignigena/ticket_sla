/**
 * Utility functions for date conversion.
 */

/**
 * Convert Parature's text timezones to the UTC equivelant.
 *
 * param string oldtimezone
 *   The Parature timezone.
 *
 * return string
 *   The UTC timezone.
 */
function convertTimezone(oldtimezone) {
    // Remove empty spaces since some timezones are 4 characters long.
    oldtimezone = oldtimezone.replace(" ", "");

    // All valid timezones as defined by Parature and their UTC equivelants.
    validTimezones = {
        "HST" : "-1000",
        "AKST" : "-0900", "AKDT" : "-0800",
        "PST" : "-0800", "PDT" : "-0700",
        "MST" : "-0700", "MDT" : "-0600",
        "CST" : "-0600", "CDT" : "-0500",
        "EST" : "-0500", "EDT" : "-0400",
        "GMT" : "0",
        "WEST" : "+0100", "WET" : "0",
        "BST" : "+0100",
        "CEST" : "+0200", "CET" : "+0100",
        "ITA" : "+0100",
        "EEST" : "+0300", "EET" : "+0200",
        "MSK" : "+0300", "MSD" : "+0300",
        "GST" : "+0400",
        "EKST" : "+0600", "EKT" : "+0600",
        "PKT" : "+0500",
        "IST" : "+0530",
        "AWST" : "+0800", "AWDT" : "+0900",
        "CCT" : "+0800",
        "JST" : "+0900",
        "KST" : "+0900",
        "ACST" : "+0930", "ACDT" : "+1030",
        "AEST" : "+1000", "AEDT" : "+1100"
    };

    // Add an extra space back in the event we've parsed a 3 character timezone.
    return " "+validTimezones[oldtimezone];
}

/**
 * Format the SLA timestamp and cell colouring.
 *
 * param string timestamp
 *   The Expiry Timestamp field.
 *
 * return array
 *   color => SLA status in colour form.
 *   timestamp => The formatted timestamp.
 */
function formatSLATimestamp(timestamp) {
    var color = 'grey';
    var expire = moment(timestamp.slice(0,-3)+"-0400", 'YYYY-MM-DD HH:mm ZZ');

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

/**
 * Makes an existing Parature timestamp relative.
 *
 * param string oldhtml
 *   The existing Parature timestamp.
 *
 * param string dateFormat
 *   The date display format the user has selected.
 *
 * returns string
 *   An HTML string in proper formatting for TimeAgo libary.
 */
function makeExistingDateRelative(oldhtml, dateFormat) {
    // Convert into a proper date format.
    var properDate = generateProperDate(oldhtml, dateFormat)
    properDate = properDate.format();
    // Return HTML to enable conversion into a relative date format.
    return '<abbr class="timeago" title="'+properDate+'">'+properDate+'</abbr>';
}

function generateProperDate(oldDate, dateFormat) {
    // Grab the last four characters to accomodate for four-letter timezones.
    var timezone = oldDate.slice(-4);
    // Replace the four digit timezone with the UTC equivelant.
    oldDate = oldDate.replace(timezone, convertTimezone(timezone));
    console.log(dateFormat);
    // Convert into a proper date format.
    return moment(oldDate, dateFormat);
}

/**
 * Get the currently selected date format from the CSR settings.
 */
function getSelectedDateFormat(row) {
    var defer = new $.Deferred();

    chrome.storage.local.get('paratureUserID',function(data){
        userID = data.paratureUserID;

        if (userID) {
            // If the user ID is stored in Chrome, fetch the date format settings.
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "https://s5.parature.com/ics/setup/user.asp?userID="+userID+"&task=mod", true);
            xhr.onreadystatechange = function() {
              if (xhr.readyState == 4) {
                var possibleFormats = {
                    'mm/dd/yyyy' : 'M/D/YYYY h:mm A ZZ',
                    'mm/dd/yy' : 'M/D/YY h:mm A ZZ',
                    'dd/mm/yyyy' : 'D/M/YYYY h:mm A ZZ',
                    'dd/mm/yy' : 'D/M/YY h:mm A ZZ',
                    'month dd, yyyy' : 'MMMM D, YYYY h:mm A ZZ',
                    'month dd, yy' : 'MMMM D, YYYY h:mm A ZZ',
                };
                var selectedFormat = $('select[name="dateFormat"]', $.parseHTML(xhr.responseText)).val();

                defer.resolve({
                    'format' : possibleFormats[selectedFormat],
                    'row' : row
                });
              }
            }
            xhr.send();
        } else {
            // If the user ID is not stored in Chrome we need to fetch it and store it before we can format the date.
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "https://s5.parature.com/ics/service/top.asp", true);
            xhr.onreadystatechange = function() {
              if (xhr.readyState == 4) {
                var userIDRegex = /.*\?userID=(\d+)/;
                var userIDMatches = userIDRegex.exec(xhr.responseText);

                chrome.storage.local.set({
                    paratureUserID: userIDMatches[1]
                });

                // Now that it's stored, let's try this again.
                ticketListRelativeDates(count);
              }
            }
            xhr.send();
        }
    });

    return defer.promise();
}

/**
 * Convert all Parature dates to relative timestamps.
 *
 * param int count
 *   How many rows need to be converted.
 */
function ticketListRelativeDates(count) {      
    var i = 0;

    var dateCreatedColumn = getColumnIndexByName('Date Created');
    var dateUpdatedColumn = getColumnIndexByName('Date Updated');
    var dateFormat;
    dateFormat = getSelectedDateFormat(0);

    $.when(dateFormat).done(function(status) {
        while (i < count) {
            if (dateCreatedColumn >= 1)
                $('#listRow'+i+' td:nth-child('+dateCreatedColumn+')[value]').html(function(index, oldhtml) { return makeExistingDateRelative(oldhtml, status['format']); });
            if (dateUpdatedColumn >= 1)
                $('#listRow'+i+' td:nth-child('+dateUpdatedColumn+')[value]').html(function(index, oldhtml) { return makeExistingDateRelative(oldhtml, status['format']); });

            i++;
        }

        $('abbr.timeago').timeago();
    });
}
