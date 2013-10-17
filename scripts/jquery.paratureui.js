(function ($) {
  // Ticket bucket functionality.
  $.fn.ticketBuckets = function(template) {
    var insertTo = this;
    $.get(chrome.extension.getURL(template), function(data){
      $(insertTo).after(data);

      $('h2.user').editable({
        event: 'click',
        callback: function(data) {
          if (data.content) {
            chrome.storage.local.set({
              customQueue1Name: $('h2.user.title1').text(),
              customQueue2Name: $('h2.user.title2').text()
            });
          }
        }
      });
      chrome.storage.local.get('customQueue1Name',function(data){
        if (data.customQueue1Name) {
          $('h2.user.title1').text(data.customQueue1Name);
        }
      });
      chrome.storage.local.get('customQueue2Name',function(data){
        if (data.customQueue2Name) {
          $('h2.user.title2').text(data.customQueue2Name);
        }
      });
      $('td.status').waitFor(function() {
        $('td:has(input), td.assigned-to, td.urgency, td.sla').remove();
        $('td.status, td.date-created, td.date-updated, #winTab__columns, td.ticket-no, td.contact').hide();
        
        $('#tableContent tr.gridRow').each(function(index, item) {
          var statusText = $('td.status', this).text();
          $('div.queue.others').append($('tr#listRow'+index));
          if (statusText == "Needs Reply" || statusText == "Reopened" || $('tr#listRow'+index+':has(.sla-report.sla0)').length) {
            $('div.queue.needsreply').append($('tr#listRow'+index));
          }
          $('tr#listRow'+index+' .summary').html('<a href="'+$('tr#listRow'+index+' .ticket-no a').attr('href')+'">'+$('tr#listRow'+index+' .summary').text()+'</a>');
          $('tr#listRow'+index+' .account').html('<div class="cust-info">'+$('tr#listRow'+index+' .contact').html()+'<br />'+$('tr#listRow'+index+' .account').html()+'</div><span>{</span>').addClass('processed');
          $('tr#listRow'+index+' .summary').after($('tr#listRow'+index+' .account'));
        });

        $('div.queues div.queue').sortable({
          connectWith: 'div.queues div.queue',
          items: '> tr',
          appendTo: 'body',
          revert: 'valid',
          cursor: 'move',
          helper: 'clone',
          update: function(event, ui) {
            var saveValue1 = [];
            var saveValue2 = [];
            $('.user1 tr.gridRow td.ticket-no').each(function(){
              saveValue1.push($(this).attr('value'));
            });
            $('.user2 tr.gridRow td.ticket-no').each(function(){
              saveValue2.push($(this).attr('value'));
            });
            chrome.storage.local.set({
              customQueue1: saveValue1,
              customQueue2: saveValue2
            });
          }
        });

        chrome.storage.local.get('customQueue1',function(data){
          for (i = 0; i < data.customQueue1.length; i++) {
            $('div.queue.user1').append($('tr.gridRow:has(td[value="'+data.customQueue1[i]+'"])'));
          }
        });
        chrome.storage.local.get('customQueue2',function(data){
          for (i = 0; i < data.customQueue2.length; i++) {
            $('div.queue.user2').append($('tr.gridRow:has(td[value="'+data.customQueue2[i]+'"])'));
          }
        });
      });
      $('div.queues div.queue').droppable({
        hoverClass: "ui-state-hover",
      });
    });
  };

  // Parature UI improvements.
  $.fn.paratureUI = function(template) {
    var insertTo = this;
    $.get(chrome.extension.getURL(template), function(data){
      $(insertTo).prepend(data);
    });
  };
}(jQuery));