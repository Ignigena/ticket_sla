if ($('#mainFrameSet').length) {
  var ticketqueue;
  var logo = {
    '15171' : 'slatoolbar.png',
    '15079' : 'slatoolbar-gardens.png'
  }

  murderFrames();

  $("#frameMenu").load(function() {
    var dept = currentDepartment();
    $('section#navbar').prepend('<div class="logo"><img src="'+chrome.extension.getURL(logo[dept])+'" id="logo" title="Switch between queues." /><span class="countbadge">!</span></div>');
    
    var announcementCheck = setInterval(function() {
    var message = $("#messageContent", $('#frameMenu').contents()).text();
      if (message != "") {
        if (message != "No messages") {
          $('section#navbar .logo .countbadge').addClass('activated');
          $('section#navbar .logo .countbadge').click(function() {
            $("#messageStart", $('#frameMenu').contents()).trigger('click');
          });
        }
        clearInterval(announcementCheck);
      }
    }, 500);

    $('section#navbar').append('<div class="mytickets"><a class="button tab mytickets" action="ticket" title="My Tickets" navurl="/ics/tt/filters.asp#mytickets">{</a><span class="countbadge">0</span></div>');
    $('section#navbar').append('<div class="alltickets"><a class="button tab tickets" action="ticket" target="content" title="Tickets" navurl="/ics/tt/filters.asp#all" contenturl="/ics/tt/ticketlist.asp?artr=0&filter_queue=2687,3227,1664,3173,3338,3439,3139,1545,1546,1547,2190,2528,3252,1200,1655&title=All+Tickets+By+SLA">n</a><span class="countbadge">0</span></div>');
    $('section#navbar').append('<a class="button tab customers" action="customer" title="Customers">&lt;</a>');
    $('section#navbar').append('<a class="button tab subs" action="asset" title="Subscriptions">&gt;</a>');
    $('section#navbar').append('<a class="button tab reports" action="reports" title="Reports">g</a>');

    $('section#navbar').append('<a class="button settings" href="https://s5.parature.com/ics/setup/user.asp?userID=5299&task=mod&actionUrl=../service/service.asp" target="content">q</a>');

    $('section#navbar #logo').click(function() {
      if (dept == '15171') {
        menu.document.location.href="javascript:switchDept(15079); void 0";
      } else {
        menu.document.location.href="javascript:switchDept(15171); void 0";
      }
    });
    $('section#navbar .tab').click(function() {
      $("#nav").removeClass('washidden');
      $('section#navbar a').removeClass('active');
      $(window.event.srcElement).addClass('active');
      var action = window.event.srcElement.attributes["action"].value;
      if (window.event.srcElement.attributes["navurl"]) {
        var navURL = window.event.srcElement.attributes["navurl"].value;
        var contentURL = window.event.srcElement.attributes["contenturl"];
        if (contentURL) { contentURL = contentURL.value }
        menu.document.location.href="javascript:menuClick('"+action+"', '"+navURL+"', '"+contentURL+"');";
      } else {
        menu.document.location.href="javascript:menuClick('"+action+"', null, '');";
      }
    });
  });

  $("#nav").load(function() {
    var ticketLinkCheck = setInterval(function() {
        // Wait until the navigation table is loaded by Parature AJAX.
        if ($('div.My-Open a.node', $('#nav').contents()).length) {
            // Stop running the interval loop.
            clearInterval(ticketLinkCheck);
            // Process the ticket link now that it exists.
            var myTicketLink = $("div.My-Open a.node", $('#nav').contents()).attr('href');
            if (myTicketLink) {
              myTicketLink = myTicketLink.replace('filter_status=GroupOpen', 'filter_status=1411,1418,1413,1416');
              myTicketLink = myTicketLink.replace('title=My_Open_Tickets', 'title=My+Active+Tickets');
              $('section#navbar a.mytickets').attr('contenturl', '/ics/tt/'+myTicketLink);
            }

            // Get the number of total open tickets.
            var openTicketCount = new XMLHttpRequest();
            openTicketCount.open("GET", "https://s5.parature.com/ics/tt/ticketlist.asp?artr=0&filter_queue=2687,3227,1664,3173,3338,3439,3139,1545,1546,1547,2190,2528,3252,1200,1655", true);
            openTicketCount.onreadystatechange = function() {
              if (openTicketCount.readyState == 4) {
                var openTicketsRegex = /countDiv\.innerHTML\ =\ "\((\d+-\d+\ of\ )?(\d+)\)";/
                var openTicketsMatch = openTicketsRegex.exec(openTicketCount.responseText);
                if (openTicketsMatch) {
                    $(".alltickets .countbadge").text(openTicketsMatch[2]);
                    $(".alltickets .countbadge").addClass('activated');
                }
              }
            }
            openTicketCount.send();

            if (myTicketLink) {
              // Get the number of active CSR tickets.  Ignore those in Needs Reply state.
              var myTicketCount = new XMLHttpRequest();
              myTicketCount.open("GET", "https://s5.parature.com/ics/tt/"+myTicketLink, true);
              myTicketCount.onreadystatechange = function() {
                if (myTicketCount.readyState == 4) {
                  var myOpenTicketsRegex = /countDiv\.innerHTML\ =\ "\((\d+-\d+\ of\ )?(\d+)\)";/
                  var myOpenTicketsMatch = myOpenTicketsRegex.exec(myTicketCount.responseText);
                  $(".mytickets .countbadge").text(myOpenTicketsMatch[2]);
                  $(".mytickets .countbadge").addClass('activated');
                }
              }
              myTicketCount.send();
            }
        }
    }, 500);
  });

  $("iframe[name='content']").load(function() {
    var frameLocation = $("iframe[name='content']").contents().get(0).location.href;
    frameLocation = frameLocation.split('/');
    frameLocationStripped = frameLocation[frameLocation.length-1].split('?')[0];
    if ((frameLocationStripped == "ticketlist.asp" || frameLocationStripped == "splash.asp") && frameLocation[frameLocation.length-1].split('?')[1]) {
      frameLocationParams = frameLocation[frameLocation.length-1].split('?')[1].split('=');
      frameLocationParams = frameLocationParams[frameLocationParams.length-1];
      frameLocationStripped = frameLocationParams;
    }
    setActiveNav(frameLocationStripped);

    if ($("#ticketform", $("iframe[name='content']").contents()).length) {
      $("#nav").addClass('hidden');
      $("iframe[name='content']").addClass('fullwidth');
    } else {
      $("#nav").removeClass('hidden');
      $("iframe[name='content']").removeClass('fullwidth');
    }

    $('section#navbar').hover(function() {
      if ($("#nav").hasClass('hidden')) {
        $("#nav").removeClass('hidden');
        $("#nav").addClass('washidden');
        $("iframe[name='content']").removeClass('fullwidth');
      }
    });
    $("iframe[name='content']").hover(function() {
      if ($("#nav").hasClass('washidden')) {
        $("#nav").removeClass('washidden');
        $("#nav").addClass('hidden');
        $("iframe[name='content']").addClass('fullwidth');
      }
    });
    if ($("#nav").contents().get(0).location.href.split('#')[1] == 'mytickets' || ticketqueue == 'mine') {
      $('.title .tab.mine', $('#nav').contents()).trigger('click');
      $('.title .tab.mine', $('#nav').contents()).addClass('active');
    } else {
      $('.title .tab.actives', $('#nav').contents()).trigger('click');
      $('.title .tab.actives', $('#nav').contents()).addClass('active');
    }
  });
}

// Frames are evil!
function murderFrames() {
  $("frame[name='bottom']").remove();
  $("frame[name='shady']").remove();

  // New type of the tag
  var replacementTag = 'iframe';

  // Replace all a tags with the type of replacementTag
  $('frame').each(function() {
      var outer = this.outerHTML;

      // Replace opening tag
      var regex = new RegExp('<' + this.tagName, 'i');
      var newTag = outer.replace(regex, '<' + replacementTag);

      // Replace closing tag
      regex = new RegExp('</' + this.tagName, 'i');
      newTag = newTag.replace(regex, '</' + replacementTag);

      $(this).replaceWith(newTag);
  });
  $("frameset#mainFrameSet").wrap('<body>');
  $("iframe").unwrap();

  $('body').prepend('<section id="navbar"></section><section id="canvas"></section>');
  $("#nav").appendTo("#canvas");
  $("iframe[name='content']").appendTo("#canvas");
  $("#frameMenu").hide();
}

// Modifications to the Parature sidebar.
if ($('.folderBack .dTreeNode').length) {
  var title = $.trim($('table.title').text());
  if (title == 'Filters') { title = 'Tickets'; }
  $('body').prepend('<div class="title">'+title+'</div>');
  if (title == 'Tickets') {
    $('div.title').prepend('<div class="tools"><span class="tab actives" show="actives">Active</span><span class="tab mine" show="mine">Mine</span><span class="tab all" show="all">All</span></div>');
    $('.title .tab').click(function() {
      var action = window.event.srcElement.attributes["show"].value;
      if (action == 'actives') {
        $('.folderBack .dTreeNode').show();
        $('.zeroqueue, .parent').hide();
        $('.parent').next().hide();
      } else if (action == 'mine') {
        $('.folderBack .dTreeNode').hide();
        $('div.My-Tickets + div, div.My-Tickets + div div').show();
        $('.zeroqueue, .My-Recent, .My-Open, div.My-Recent + div, div.My-Resolved + div div:nth-child(3)').hide();
      } else {
        $('.folderBack .dTreeNode').show();
      }
      $('.title .tab').removeClass('active');
      $('.title .tab.'+action).addClass('active');
    });
    $('.folderBack .dTreeNode.empty').remove();
    $('.folderBack .dTreeNode:has(a > img)').addClass('parent');
    $('.parent').hide();
    $('.parent').next().hide();

    $('.folderBack .dTreeNode').each(function () {
      if ($(this).text().slice(-3) == '(0)') {
        $(this).addClass('zeroqueue');
      } else {
        $('.itemCount', this).text($('.itemCount', this).text().slice(1,-1));
      }
    });

    $('.zeroqueue').hide();
  }
  $('table.title').remove();
  $('table.subtitle').hide();

  $('.folderBack .parent').each(function() {
    $(this).addClass($(this).text().split('(')[0].replace(' ', '-'));
  });
  $('.folderBack .dTreeNode a:has(img)').attr('style', 'padding: 0;');
  if ($('.folderBack .dTreeNode a img').attr('src') == '../images/ftv2mnode.gif') {
    $('.folderBack .dTreeNode a img').attr('src', '../images/common/icon_doublechevron-down.png');
  } else {
    $('.folderBack .dTreeNode a img').attr('src', '../images/common/icon_doublechevron-up.png');
  }
}

// Modifications to the Parature main page.
if ($('#winTab__title, .winTab.title').length) {
  $('body').prepend('<div class="title">'+$.trim($('#winTab__title, .winTab.title').text())+'</div>');
  $('#countDiv').appendTo('div.title');
  $('body:has(.ticketCell) #winTab__columns').hide();
  $('td.winButton:has(img[title="Mass Action"]), td.winButton:has(img[title="Mass Edit"]), td.winButton:has(img[title="Delete Ticket(s)"])').hide();
  $('#winTab__title, .winTab.title').hide();

  var pageTitle = $('div.title').text().split('-')[1].split('(')[0].trim();
  if (pageTitle == "My Active Tickets") {
    $('div.title').after('<div class="queues"></div>');
    $('div.queues').append('<div class="wrapper"><h2 class="user title1">Important</h2><div class="queue user1"></div></div>');
    $('div.queues').append('<div class="wrapper"><h2>Needs Reply</h2><div class="queue needsreply"></div></div>');
    $('div.queues').append('<div class="wrapper"><h2 class="user title2">Waiting</h2><div class="queue user2"></div></div>');
    $('div.queues').append('<div class="wrapper"><h2>In Progress</h2><div class="queue others"></div></div><div style="clear:both"></div>');
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
    $('div.queues div.queue').droppable({
      accept: '.gridRow',
      drop: function(event, ui) {
        $('.ui-draggable-dragging').hide();
        var draggable = $(ui.draggable[0]);
        $(this).append(draggable);
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
    var ticketListCheck = setInterval(function() {
      // Wait until the ticket table is loaded by Parature AJAX.
      if ($('td.status').length) {
        // Stop running the interval loop.
        clearInterval(ticketListCheck);

        $('td:has(input), td.assigned-to, td.urgency, td.sla').remove();
        $('td.status, td.date-created, td.date-updated, #winTab__columns, td.ticket-no').hide();
        
        $('#tableContent tr.gridRow').each(function(index, item) {
          var statusText = $('td.status', this).text();
          $('div.queue.others').append($('tr#listRow'+index));
          if (statusText == "Needs Reply" || statusText == "Reopened" || $('tr#listRow'+index+':has(.sla-report.sla0)').length) {
            $('div.queue.needsreply').append($('tr#listRow'+index));
          }
          $('tr#listRow'+index+' .summary').html('<a href="'+$('tr#listRow'+index+' .ticket-no a').attr('href')+'">'+$('tr#listRow'+index+' .summary').text()+'</a>');
        });

        $('tr.gridRow').draggable({
          appendTo: 'body',
          revert: 'valid',
          cursor: 'move',
          helper: 'clone'
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
      }
    }, 500);
  }
}

function setActiveNav(page) {
  var pageMatching = {
    'My+Active+Tickets' : 'mytickets',
    'My+Work+In+Progress+Tickets' : 'mytickets',
    'My+Need+More+Info+Tickets' : 'mytickets',
    'My+Needs+Reply+Tickets' : 'mytickets',
    'My+Reopened+Tickets' : 'mytickets',
    'admin' : 'customers',
    'custList.asp' : 'customers',
    'assetsplash.asp' : 'subs',
    'metricsCSR.asp' : 'reports',
    'metricsTicket.asp' : 'reports',
    'metricsTicketActions.asp' : 'reports',
    'service.asp' : 'settings',
  }

  $('section#navbar a').removeClass('active');
  if (pageMatching[page]) {
    $('section#navbar a.'+pageMatching[page]).addClass('active');
    if (pageMatching[page] == 'mytickets') {
      ticketqueue = 'mine';
    }
  } else {
    $('section#navbar a.tickets').addClass('active');
    ticketqueue = 'all';
  }
}

function currentDepartment() {
  return $("select[name='deptID']", $('#frameMenu').contents())[0].value;
}
