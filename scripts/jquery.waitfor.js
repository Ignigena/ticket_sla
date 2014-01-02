(function ($) {
  $.fn.waitFor = function (fn, interval) {
    interval = typeof interval !== 'undefined' ? interval : 500;
    var waitForCheck = setInterval(function () {
      // Wait until the element is present on the page.
      if ($(this).length) {
        // Stop running the interval loop.
        clearInterval(waitForCheck);
        fn.call();
      }
    }, interval);
  };
}(jQuery));