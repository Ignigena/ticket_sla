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
    $('a.util.settings', $('#frameMenu').contents()).waitFor(function() {
      $('#navbar a.settings').prop('href', '/ics' + $('a.util.settings', $('#frameMenu').contents()).attr('href').slice('2'));
    })

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
    $('section#navbar', $('#nav').contents()).waitFor(function() {
      // Get the number of total open tickets.
      $.get('https://s5.parature.com/ics/tt/ticketlist.asp?artr=0&filter_queue=2687,3227,1664,3173,3338,3439,3139,1545,1546,1547,2190,2528,3252,1200,1655', function(data){
        var openTicketsRegex = /countDiv\.innerHTML\ =\ "\((\d+-\d+\ of\ )?(\d+)\)";/
        var openTicketsMatch = openTicketsRegex.exec(data);
        if (openTicketsMatch) {
            $(".alltickets .countbadge").text(openTicketsMatch[2]);
            $(".alltickets .countbadge").addClass('activated');
        }
      });

      callFunctionWithSettings(function(){
        // Process the ticket link now that it exists.
        $('section#navbar a.mytickets').attr('contenturl', '/ics/tt/'+this);

        // Get the number of active CSR tickets.  Ignore those in Needs Reply state.
        $.get('https://s5.parature.com/ics/tt/'+this, function(data){
          var myOpenTicketsRegex = /countDiv\.innerHTML\ =\ "\((\d+-\d+\ of\ )?(\d+)\)";/
          var myOpenTicketsMatch = myOpenTicketsRegex.exec(data);
          $(".mytickets .countbadge").text(myOpenTicketsMatch[2]);
          $(".mytickets .countbadge").addClass('activated');
        });
      }, 'myTicketLink', function() {
        var defer = new $.Deferred();
        $('div.My-Open a.node', $('#nav').contents()).waitFor(function() {
          var myTicketLink = $("div.My-Open a.node", $('#nav').contents()).attr('href');
          if (myTicketLink) {
            myTicketLink = myTicketLink.replace('filter_status=GroupOpen', 'filter_status=1411,1418,1413,1416');
            myTicketLink = myTicketLink.replace('title=My_Open_Tickets', 'title=My+Active+Tickets');
            defer.resolve(myTicketLink);
          }
        });
        return defer.promise();
      });
    });
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

  $('body').paratureUI('../gui/parature.html');
  $('section#canvas').waitFor(function() {
    $("#nav").appendTo("#canvas");
    $("iframe[name='content']").appendTo("#canvas");
    $("#frameMenu").hide();
  },50);
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
    $('div.title').ticketBuckets('../gui/ticketbuckets.html');
  }
}

// Modifications to the Parature ticket page.
if ($('div.ticketCell table:nth-child(1) td.head2').text().trim() == "Ticket Summary") {
  console.log('ticket page');
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

function callFunctionWithSettings(fn, settings, fallback) {
  chrome.storage.local.get(settings,function(data){
    var returnedSetting = data[settings];
    if(!returnedSetting) {
      fallback.call().done(function(results){
        var save = {}
        save[settings]=results;
        chrome.storage.local.set(save);
        fn.call(results);
      });
    } else {
      fn.call(returnedSetting);
    }
  });
}
