if ($('#mainFrameSet').length) {
  var logo = {
    '15171' : 'slatoolbar.png',
    '15079' : 'slatoolbar-gardens.png'
  }

  murderFrames();

  $("#frameMenu").load(function() {
    var dept = currentDepartment();
    $('section#navbar').prepend('<div class="logo"><img src="'+chrome.extension.getURL(logo[dept])+'" id="logo" title="Switch between queues." /><span class="countbadge">!</span></div>');

    if ($("#messageStart", $('#frameMenu').contents()).length) {
      $('section#navbar .logo .countbadge').addClass('activated');
      $('section#navbar .logo .countbadge').click(function() {
        $("#messageStart", $('#frameMenu').contents()).trigger('click');
      });
    }
    $('section#navbar').append('<div class="mytickets"><a class="button tab mytickets" action="ticket" title="My Tickets" navurl="/ics/tt/filters.asp">{</a><span class="countbadge">0</span></div>');
    $('section#navbar').append('<div class="alltickets"><a class="button tab tickets" action="ticket" target="content" title="Tickets" navurl="/ics/tt/filters.asp" contenturl="/ics/tt/ticketlist.asp?artr=0&filter_status=1415&title=All+Tickets+By+SLA">n</a><span class="countbadge">0</span></div>');
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
        var contentURL = window.event.srcElement.attributes["contenturl"].value;
        menu.document.location.href="javascript:menuClick('"+action+"', '"+navURL+"', '"+contentURL+"');";
      } else {
        menu.document.location.href="javascript:menuClick('"+action+"', null, '');";
      }
    });
  });

  $("#nav").load(function() {
    var myTicketLink = $("#sparentTree201", $('#nav').contents()).attr('href');
    if (myTicketLink) {
      myTicketLink = myTicketLink.replace('filter_status=GroupOpen', 'filter_status=1411,1418,1413,1416');
      myTicketLink = myTicketLink.replace('title=My_Open_Tickets', 'title=My+Active+Tickets');
      $('section#navbar a.mytickets').attr('contenturl', '/ics/tt/'+myTicketLink);
    }

    // Get the number of total open tickets.
    var openTicketCount = new XMLHttpRequest();
    openTicketCount.open("GET", "https://s5.parature.com/ics/tt/ticketlist.asp?artr=0&filter_status=1415", true);
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
  });

  $("iframe[name='content']").load(function() {
    var frameLocation = $("iframe[name='content']").contents().get(0).location.href;
    frameLocation = frameLocation.split('/');
    frameLocationStripped = frameLocation[frameLocation.length-1].split('?')[0];
    if (frameLocationStripped == "ticketlist.asp" || frameLocationStripped == "splash.asp") {
      frameLocationParams = frameLocation[frameLocation.length-1].split('?')[1].split('=');
      frameLocationParams = frameLocationParams[frameLocationParams.length-1];
      console.log(frameLocationParams);
      if (frameLocationStripped == "ticketlist.asp" && frameLocationParams != "My+Active+Tickets") {
        frameLocationParams = "ticketlist.asp";
      }
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
  $('.folderBack .dTreeNode').each(function () {
    if ($(this).text().slice(-3) == '(0)') {
      $(this).addClass('zeroqueue');
    }
  });

  $('.zeroqueue').hide();
}

function setActiveNav(page) {
  var pageMatching = {
    'My+Active+Tickets' : 'mytickets',
    'ticketlist.asp' : 'tickets',
    'ticketDetail.asp' : 'tickets',
    'admin' : 'customers',
    'custList.asp' : 'customers',
    'assetsplash.asp' : 'subs',
    'metricsCSR.asp' : 'reports',
    'metricsTicket.asp' : 'reports',
    'metricsTicketActions.asp' : 'reports',
    'service.asp' : 'settings',
  }

  $('section#navbar a').removeClass('active');
  $('section#navbar a.'+pageMatching[page]).addClass('active');
}

function currentDepartment() {
  return $("select[name='deptID']", $('#frameMenu').contents())[0].value;
}
