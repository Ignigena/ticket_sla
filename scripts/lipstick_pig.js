if ($('#mainFrameSet').length) {
  var logo = {
    '15171' : 'slatoolbar.png',
    '15079' : 'slatoolbar-gardens.png'
  }

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

  $("#frameMenu").load(function() {
    var dept = currentDepartment();
    $('section#navbar').prepend('<img src="'+chrome.extension.getURL(logo[dept])+'" id="logo" title="Switch between queues." />');

    if ($("#messageStart", $('#frameMenu').contents()).length) {
      $('section#navbar').prepend('<div class="notif-warn">s</div>');
      $('section#navbar .notif-warn').click(function() {
        $("#messageStart", $('#frameMenu').contents()).trigger('click');
      });
    }
    $('section#navbar').append('<a class="button mytickets" target="content" title="My Tickets">{</a>');
    $('section#navbar').append('<a class="button tab tickets" target="ticket" title="Tickets">n</a>');
    $('section#navbar').append('<a class="button tab customers" target="customer" title="Customers">&lt;</a>');
    $('section#navbar').append('<a class="button tab subs" target="asset" title="Subscriptions">&gt;</a>');
    $('section#navbar').append('<a class="button tab reports" target="reports" title="Reports">g</a>');

    $('section#navbar').append('<a class="button settings" href="https://s5.parature.com/ics/setup/user.asp?userID=5299&task=mod&actionUrl=../service/service.asp" target="content">q</a>');

    $('section#navbar #logo').click(function() {
      if (dept == '15171') {
        menu.document.location.href="javascript:switchDept(15079); void 0";
      } else {
        menu.document.location.href="javascript:switchDept(15171); void 0";
      }
    });
    $('section#navbar .tab').click(function() {
      var action = window.event.srcElement.attributes["target"].value;
      menu.document.location.href="javascript:menuClick('"+action+"', null, ''); void 0";
    });
  });

  $("#nav").load(function() {
    var myTicketLink = $("#sparentTree201", $('#nav').contents()).attr('href');
    myTicketLink = myTicketLink.replace('filter_status=GroupOpen', 'filter_status=1411,1418,1413,1416');
    myTicketLink = myTicketLink.replace('title=My_Open_Tickets', 'title=My+Active+Tickets');
    $('section#navbar a.mytickets').attr('href', '/ics/tt/'+myTicketLink);
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

function currentDepartment() {
  return $("select[name='deptID']", $('#frameMenu').contents())[0].value;
}
