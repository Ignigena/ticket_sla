$(document).ready(function() {
  $('#branding_header li.tab.add span#i18n-23').text('recent tickets');
  $('div.popover.add.bottom h3, div.popover .links-section, div.popover.add.bottom .popover-content > button').hide();
  $('.assignee_widget label div.link_light').remove();

  $('#branding_header').bind('DOMSubtreeModified', function() {
    $('.assignee_widget label div.link_light').remove();
  });
});
