/*!
 * LABELAUTY jQuery Plugin
 *
 * @file: jquery-labelauty.js
 * @author: Francisco Neves (@fntneves)
 * @site: www.francisconeves.com
 * @license: MIT License
 */

// Edited by Jonathan Pyle, 2018-2019

(function ($) {
  $.fn.labelauty = function (options) {
    /*
     * Our default settings
     * Hope you don't need to change anything, with these settings
     */
    var settings = $.extend(
      {
        // Development Mode
        // This will activate console debug messages
        development: false,

        // Trigger Class
        // This class will be used to apply styles
        class: "labelauty",

        // Use icon?
        // If false, then only a text label represents the input
        icon: true,

        // Use text label ?
        // If false, then only an icon represents the input
        label: true,

        // Separator between labels' messages
        // If you use this separator for anything, choose a new one
        separator: "|",

        // Default Checked Message
        // This message will be visible when input is checked
        checked_label: "Checked",

        // Default UnChecked Message
        // This message will be visible when input is unchecked
        unchecked_label: "Unchecked",

        // Force random ID's
        // Replace original ID's with random ID's,
        force_random_id: false,

        // Minimum Label Width
        // This value will be used to apply a minimum width to the text labels
        minimum_width: false,

        // Use the greatest width between two text labels ?
        // If this has a true value, then label width will be the greatest between labels
        same_width: false,
      },
      options,
    );

    /*
     * Let's create the core function
     * It will try to cover all settings and mistakes of using
     */
    return this.each(function () {
      var $object = $(this);
      var selected = $object.is(":checked");
      var type = $object.attr("type");
      var use_icons = true;
      var use_labels = true;
      var labels;
      var labels_object;
      var color;
      var classes;
      var input_id;

      //Get the aria label from the input element
      var aria_label = $object.attr("aria-label");

      // Hide the object form screen readers
      $object.attr("aria-hidden", true);

      // Test if object is a check input
      // Don't mess me up, come on
      if ($object.is(":checkbox") === false && $object.is(":radio") === false)
        return this;

      classes = $object
        .attr("class")
        .split(/\s+/)
        .filter(function (value, index, arr) {
          return value != "da-to-labelauty";
        });
      // Add "labelauty" class to all checkboxes
      // So you can apply some custom styles
      $object.addClass(settings.class);

      // Get the value of "data-labelauty" attribute
      // Then, we have the labels for each case (or not, as we will see)
      labels = $object.attr("data-labelauty");
      color = $object.attr("data-color");

      use_labels = settings.label;
      use_icons = settings.icon;

      // It's time to check if it's going to the right way
      // Null values, more labels than expected or no labels will be handled here
      if (use_labels === true) {
        if (labels == null || labels.length === 0) {
          // If attribute has no label and we want to use, then use the default labels
          labels_object = [settings.unchecked_label, settings.checked_label];
        } else {
          // Ok, ok, it's time to split Checked and Unchecked labels
          // We split, by the "settings.separator" option
          labels_object = labels.split(settings.separator);

          // Now, let's check if exist _only_ two labels
          // If there's more than two, then we do not use labels :(
          // Else, do some additional tests
          if (labels_object.length > 2) {
            use_labels = false;
            debug(
              settings.development,
              "There's more than two labels. LABELAUTY will not use labels.",
            );
          } else {
            // If there's just one label (no split by "settings.separator"), it will be used for both cases
            // Here, we have the possibility of use the same label for both cases
            if (labels_object.length === 1)
              debug(
                settings.development,
                "There's just one label. LABELAUTY will use this one for both cases.",
              );
          }
        }
      }

      /*
       * Let's begin the beauty
       */

      // Start hiding ugly checkboxes
      // Obviously, we don't need native checkboxes :O
      $object.css({ display: "none" });

      // We don't need more data-labelauty attributes!
      // Ok, ok, it's just for beauty improvement
      $object.removeAttr("data-labelauty");

      // Now, grab checkbox ID Attribute for "label" tag use
      // If there's no ID Attribute, then generate a new one
      input_id = $object.attr("id");

      if (
        settings.force_random_id ||
        input_id == null ||
        input_id.trim() === ""
      ) {
        var input_id_number = 1 + Math.floor(Math.random() * 1024000);
        input_id = "labelauty-" + input_id_number;

        // Is there any element with this random ID ?
        // If exists, then increment until get an unused ID
        while ($(input_id).length !== 0) {
          input_id_number++;
          input_id = "labelauty-" + input_id_number;
          debug(
            settings.development,
            "Holy crap, between 1024 thousand numbers, one raised a conflict. Trying again.",
          );
        }

        $object.attr("id", input_id);
      }

      // Now, add necessary tags to make this work
      // Here, we're going to test some control variables and act properly

      var element = jQuery(
        create(
          input_id,
          aria_label,
          selected,
          type,
          labels_object,
          use_labels,
          use_icons,
        ),
      );

      for (var idx = 0; idx < classes.length; idx++) {
        $(element).addClass(classes[idx]);
      }
      if ($object.is(":checked")) {
        $(element).addClass("btn-" + color);
        $(element).removeClass(
          "btn-light bg-secondary-subtle text-light-emphasis",
        );
        $(element).attr("aria-checked", true);
      } else {
        $(element).removeClass("btn-" + color);
        $(element).addClass(
          "btn-light bg-secondary-subtle text-light-emphasis",
        );
        $(element).attr("aria-checked", false);
      }
      var the_name = $object.attr("name");
      if (type == "radio") {
        $object.on("change", function () {
          $object
            .parents(".da-fieldset")
            .first()
            .find(".da-has-error")
            .remove();
          var anyChecked = false;
          $('input.labelauty[name="' + the_name + '"]:enabled').each(
            function () {
              if ($(this).is(":checked")) {
                $(this)
                  .next()
                  .addClass("btn-" + color);
                $(this)
                  .next()
                  .removeClass(
                    "btn-light bg-secondary-subtle text-light-emphasis",
                  );
                $(this).next().attr("aria-checked", true);
                anyChecked = true;
              } else {
                $(this)
                  .next()
                  .removeClass("btn-" + color);
                $(this)
                  .next()
                  .addClass(
                    "btn-light bg-secondary-subtle text-light-emphasis",
                  );
                $(this).next().attr("aria-checked", false);
              }
            },
          );
          if (anyChecked) {
            $('input.labelauty[name="' + the_name + '"]:enabled').each(
              function () {
                if ($(this).is(":checked")) {
                  $(this).next().attr("tabindex", 0);
                } else {
                  $(this).next().attr("tabindex", -1);
                }
              },
            );
          }
        });
      } else {
        $object.on("change", function () {
          $object
            .parents(".da-fieldset")
            .first()
            .find(".da-has-error")
            .remove();
          if ($(this).is(":checked")) {
            $(this)
              .next()
              .addClass("btn-" + color);
            $(this)
              .next()
              .removeClass("btn-light bg-secondary-subtle text-light-emphasis");
            $(this).next().attr("aria-checked", true);
          } else {
            $(this)
              .next()
              .removeClass("btn-" + color);
            $(this)
              .next()
              .addClass("btn-light bg-secondary-subtle text-light-emphasis");
            $(this).next().attr("aria-checked", false);
          }
        });
      }

      element.keydown(function (event) {
        $object.parents(".da-fieldset").first().find(".da-has-error").remove();
        var theCode = event.which || event.keyCode;
        if ($object.closest(".dachoicewithhelp").length > 0) {
          if (theCode === 40) {
            event.preventDefault();
            var nextElement = $object
              .closest(".dachoicewithhelp")
              .next("div")
              .find("label");
            if (nextElement.length) {
              nextElement.focus();
              nextElement.click();
            }
            return false;
          }
          if (theCode === 38) {
            event.preventDefault();
            var prevElement = $object
              .closest(".dachoicewithhelp")
              .prev("div")
              .find("label");
            if (prevElement.length) {
              prevElement.focus();
              prevElement.click();
            }
            return false;
          }
        } else {
          if (theCode === 40) {
            event.preventDefault();
            var nextElement = $object.next("label").next("input").next("label");
            if (nextElement.length) {
              nextElement.focus();
              nextElement.click();
            }
            return false;
          }
          if (theCode === 38) {
            event.preventDefault();
            var prevElement = $object.prev("label");
            if (prevElement.length) {
              prevElement.focus();
              prevElement.click();
            }
            return false;
          }
        }
        if (theCode === 32 || theCode === 13) {
          event.preventDefault();
          if ($object.is(":checked")) {
            $(this).addClass("btn-" + color);
            $(this).removeClass(
              "btn-light bg-secondary-subtle text-light-emphasis",
            );
            $object.prop("checked", false);
            $(this).attr("aria-checked", true);
          } else {
            $(this).addClass("btn-" + color);
            $(this).removeClass(
              "btn-light bg-secondary-subtle text-light-emphasis",
            );
            $object.prop("checked", true);
            $(this).attr("aria-checked", false);
          }
          $object.trigger("change");
        }
      });

      $object.after(element);

      // Now, add "min-width" to label
      // Let's say the truth, a fixed width is more beautiful than a variable width
      if (settings.minimum_width !== false)
        $object
          .next("label[for='" + input_id + "']")
          .css({ "min-width": settings.minimum_width });

      // Now, add "min-width" to label
      // Let's say the truth, a fixed width is more beautiful than a variable width
      if (settings.same_width != false && settings.label == true) {
        var label_object = $object.next("label[for='" + input_id + "']");
        var unchecked_width = getRealWidth(
          label_object.find("span.labelauty-unchecked"),
        );
        var checked_width = getRealWidth(
          label_object.find("span.labelauty-checked"),
        );

        if (unchecked_width > checked_width)
          label_object.find("span.labelauty-checked").width(unchecked_width);
        else label_object.find("span.labelauty-unchecked").width(checked_width);
      }
    });
  };

  /*
   * Tricky code to work with hidden elements, like tabs.
   * Note: This code is based on jquery.actual plugin.
   * https://github.com/dreamerslab/jquery.actual
   */
  function getRealWidth(element) {
    var width = 0;
    var $target = element;
    var css_class = "hidden_element";

    $target = $target.clone().attr("class", css_class).appendTo("body");
    width = $target.width(true);
    $target.remove();

    return width;
  }

  function debug(debug, message) {
    if (debug && window.console && window.console.log)
      window.console.log("jQuery-LABELAUTY: " + message);
  }

  function decode_html(text) {
    text = text.replace(/&amp;/g, "&");
    text = text.replace(/&lt;/g, "<");
    text = text.replace(/&gt;/g, ">");
    text = text.replace(/&quot;/g, '"');
    return text;
  }
  function create(
    input_id,
    aria_label,
    selected,
    type,
    messages_object,
    label,
    icon,
  ) {
    var block;
    var unchecked_message;
    var checked_message;
    var aria = "";

    if (messages_object == null) unchecked_message = checked_message = "";
    else {
      unchecked_message = messages_object[0];

      // If checked message is null, then put the same text of unchecked message
      if (messages_object[1] == null) checked_message = unchecked_message;
      else checked_message = messages_object[1];
    }
    var uncheck_icon;
    if (type == "checkbox") {
      uncheck_icon = '<i class="fa-regular fa-square fa-fw"></i>';
    } else {
      uncheck_icon = '<i class="fa-regular fa-circle fa-fw"></i>';
    }
    var check_icon;
    if (type == "checkbox") {
      check_icon = '<i class="fa-solid fa-check fa-fw"></i>';
    } else {
      check_icon = '<i class="fa-solid fa-check-circle fa-fw"></i>';
    }

    if (aria_label == null) aria = "";
    else
      aria =
        'tabindex="0" role="' +
        type +
        '" aria-checked="' +
        selected +
        '" aria-label="' +
        aria_label +
        '"';

    if (label == true && icon == true) {
      block =
        '<label class="text-start btn btn-light bg-secondary-subtle text-light-emphasis dalabelauty" for="' +
        input_id +
        '" ' +
        aria +
        ">" +
        '<span class="labelauty-unchecked-image text-body-secondary">' +
        uncheck_icon +
        "</span>" +
        '<span class="labelauty-unchecked">' +
        decode_html(unchecked_message) +
        "</span>" +
        '<span class="labelauty-checked-image">' +
        check_icon +
        "</span>" +
        '<span class="labelauty-checked">' +
        decode_html(checked_message) +
        "</span>" +
        "</label>";
    } else if (label == true) {
      block =
        '<label class="text-start btn btn-light bg-secondary-subtle text-light-emphasis dalabelauty" for="' +
        input_id +
        '" ' +
        aria +
        ">" +
        '<span class="labelauty-unchecked">' +
        decode_html(unchecked_message) +
        "</span>" +
        '<span class="labelauty-checked">' +
        decode_html(checked_message) +
        "</span>" +
        "</label>";
    } else {
      block =
        '<label class="text-start btn btn-light bg-secondary-subtle text-light-emphasis dalabelauty" for="' +
        input_id +
        '" ' +
        aria +
        ">" +
        '<span class="labelauty-unchecked-image text-body-secondary">' +
        uncheck_icon +
        "</span>" +
        '<span class="labelauty-checked-image">' +
        check_icon +
        "</span>" +
        "</label>";
    }

    return block;
  }
})(window.jQuery);
