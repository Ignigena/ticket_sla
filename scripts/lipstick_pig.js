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
    $('section#navbar').append('<div class="mytickets"><a class="button mytickets" target="content" title="My Tickets">{</a><span class="countbadge">0</span></div>');
    $('section#navbar').append('<div class="alltickets"><a class="button tab tickets" action="ticket" target="content" title="Tickets" navurl="/ics/tt/filters.asp" contenturl="/ics/tt/ticketlist.asp?artr=0&filter_status=1415&title=All+Tickets+By+SLA">n</a><span class="countbadge">0</span></div>');
    $('section#navbar').append('<a class="button tab customers" action="customer" title="Customers">&lt;</a>');
    $('section#navbar').append('<a class="button tab subs" action="asset" title="Subscriptions">&gt;</a>');
    $('section#navbar').append('<a class="button tab action" target="reports" title="Reports">g</a>');

    $('section#navbar').append('<a class="button settings" href="https://s5.parature.com/ics/setup/user.asp?userID=5299&task=mod&actionUrl=../service/service.asp" target="content">q</a>');

    $('section#navbar #logo').click(function() {
      if (dept == '15171') {
        menu.document.location.href="javascript:switchDept(15079); void 0";
      } else {
        menu.document.location.href="javascript:switchDept(15171); void 0";
      }
    });
    $('section#navbar .tab').click(function() {
      var action = window.event.srcElement.attributes["action"].value;
      var navURL = window.event.srcElement.attributes["navurl"].value;
      var contentURL = window.event.srcElement.attributes["contenturl"].value;
      menu.document.location.href="javascript:menuClick('"+action+"', '"+navURL+"', '"+contentURL+"');";
    });
  });

  $("#nav").load(function() {
    var myTicketLink = $("#sparentTree201", $('#nav').contents()).attr('href');
    myTicketLink = myTicketLink.replace('filter_status=GroupOpen', 'filter_status=1411,1418,1413,1416');
    myTicketLink = myTicketLink.replace('title=My_Open_Tickets', 'title=My+Active+Tickets');
    $('section#navbar a.mytickets').attr('href', '/ics/tt/'+myTicketLink);

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
  });

  $("iframe[name='content']").load(function() {

    if ($("#ticketform", $("iframe[name='content']").contents()).length) {
      $("#nav").addClass('hidden');
      $("iframe[name='content']").addClass('fullwidth');
    } else {
      $("#nav").removeClass('hidden');
      $("iframe[name='content']").removeClass('fullwidth');
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

function setActiveNav(page) {
  $('section#navbar a').removeClass('active');
  if (page == 'ticketlist.asp') {
    $('section#navbar a.tickets').addClass('active');
  }
}

function currentDepartment() {
  return $("select[name='deptID']", $('#frameMenu').contents())[0].value;
}
