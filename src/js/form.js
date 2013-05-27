/*jslint nomen: true */
/*globals define: true */

define(function (require) {
  'use strict';

  var $ = require('jquery');
  var _ = require('lib/underscore');
  var api = require('api');
  var settings = require('settings');

  return function (app, formContainerId) {
    var form = $(formContainerId + ' form');
    var formQuestions = $('#questions');
    var repeatCounter = {};
    var timeStarted;
    var $form = $('#form');
    var $submitting = $('#submitting');
    var $thanks = $('#thanks');
    var $thanksOffline = $('#thanks-offline');

    this.init = function(){
      console.log("Initialize form");

      // Listen for objectedSelected, triggered when items on the map are tapped
      $.subscribe("objectSelected", setSelectedObjectInfo);

      $.subscribe('readyForAddressForm', showObjectFreeForm);

      // Render the form
      api.getForm(renderForm);

      // Add a function to serialize the form for submission to the API
      // usage: form.serializeObject();
      form.serializeObject = function() {
        var o = {};
        var a = this.serializeArray();
        $.each(a, function() {
          if (o[this.name] !== undefined) {
            if (!o[this.name].push) {
              o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
          } else {
            o[this.name] = this.value || '';
          }
        });
        return o;
      };
    };

    function showForm() {
      // Set any necessary form context.
      // Right now, only address questions rely on context outside the form.
      // Later, pieces of the form could condition on fields of the selected
      // object.
      var address = app.selectedObject.address;
      if (address !== undefined) {
        $('input:text[data-type="address"]').val(address);
      } else {
        $('input:text[data-type="address"]').val('');
      }

      if(!$form.is(":visible")) {
        $form.slideToggle(400, function(){

          // Make sure the form becomes visible
          // when an object on the map is clicked
          var offset = $form.offset();
          offset.top -= 175; // Keep enough of the map visible
                             // to give the user context
          $('html, body').animate({
            scrollTop: offset.top,
            scrollLeft: offset.left
          });
        });
      }
    }

    // Update the form with information about the selected object.
    // Then, display the form.
    function setSelectedObjectInfo(e) {
      console.log("Showing the form");
      var $addressDOM = $('h2 .parcel_id');

      $addressDOM.fadeOut(400, function() {
        $addressDOM.text(app.selectedObject.humanReadableName.titleCase());
        $addressDOM.fadeIn(400);
      });

      // Record the time to track how long a submission takes
      timeStarted = new Date();

      // Show/hide UI as needed
      showForm();
      if($('#startpoint').is(":visible")) {
        $('#startpoint').hide();
      }
      if($thanks.is(":visible")) {
        $thanks.slideToggle();
      }
      if($thanksOffline.is(":visible")) {
        $thanksOffline.slideToggle();
      }

    }

    // Show the form. Used when the user creates an entry that doesn't
    // correspond to a map object. For example, the form can allow entry of an
    // address, which will later be displayed as a point on the map.
    function showObjectFreeForm() {
      // Record the time to track how long a submission takes
      timeStarted = new Date();

      // Show/hide UI as needed
      showForm();
      if ($('#startpoint').is(":visible")) {
        $('#startpoint').hide();
      }
      if ($('#thanks').is(":visible")) {
        $('#thanks').slideToggle();
      }
    }


    // Form submission .........................................................

    function doSubmit() {
      // Serialize the form
      var serialized = form.serializeObject();

      // Get some info about the centroid as floats.
      var selectedCentroid = app.selectedObject.centroid;
      var centroidLng = parseFloat(selectedCentroid.coordinates[0]);
      var centroidLat = parseFloat(selectedCentroid.coordinates[1]);

      var response = {
        source: {
          type: 'mobile',
          collector: app.collectorName,
          started: timeStarted,             // Time started
          // FIXME: This could be artificially large if we take a while to look
          // up an address. We should compute this earlier.
          finished: new Date()              // Time finished
        },
        geo_info: {
          centroid:[centroidLng, centroidLat],
          geometry: app.selectedObject.geometry,
          humanReadableName: app.selectedObject.humanReadableName,
          parcel_id: app.selectedObject.id // Soon to be deprecated
        },
        parcel_id: app.selectedObject.id, // Soon to be deprecated
        object_id: app.selectedObject.id, // Replaces parcel_id
        responses: serialized
      };

      // Make sure we have a responses property, even if it is empty
      if(!response.hasOwnProperty('responses')) {
        response.responses = {};
      }

      // If there are files, handle them
      var fileItems = $('#parcelform input[type=file]');
      if (fileItems[0] !== undefined && fileItems[0].files !== undefined) {
        // Pull the actual File objects out.
        // TODO: Support more than one file
        var files;
        if (fileItems[0].files.length > 0) {
          files = [{
            fieldName: $('#area input').attr('name'),
            file: fileItems[0].files[0]
          }];
        }

        // Post a response in the appropriate format.
        api.postResponse(response, files);
      } else {
        // Post a response in the appropriate format.
        api.postResponse(response);
      }
    }

    // Handle the parcel survey form being submitted
    form.submit(function(event) {
      console.log("Submitting survey results");

      // Stop form from submitting normally
      event.preventDefault();
      submitFlash();

      if (app.selectedObject && app.selectedObject.hasOwnProperty('centroid')) {
        doSubmit();
      } else {
        var address = $('input:text[data-type="address"]').val();
        api.codeAddress(address, function (error, data) {
          // FIXME deal with offline mode properly in this situation.
          // FIXME handle error

          app.selectedObject = {
            centroid: {
              type: 'Point',
              coordinates: data.coords
            }
          };

          doSubmit();
        });
      }
    });



    function submitThanks() {
      // Publish  a "form submitted" event
      $.publish('successfulSubmit');

      // Hide the form and show the thanks
      $submitting.slideUp();
      if (api.online) {
        $thanks.slideDown();
      } else {
        $thanksOffline.slideDown();
      }

      if($('#address-search-prompt').is(':hidden')) {
        $('#address-search-prompt').slideToggle();
      }
      if($('#address-search').is(':visible')) {
        $('#address-search').slideToggle();
      }

      // Reset the form for the next submission.
      resetForm();
    }

    // Show a brief thank-you message before bringing back a blank form.
    function submitFlash() {
      // Roll up the form & show the "now submitting" message
      if ($('#error').is(':visible')) {
        $('#error').slideToggle();
      }

      $form.slideUp();
      $submitting.slideDown(function () {
        setTimeout(submitThanks, 1000);
      });
    }

    // Reset the form: clear checkboxes, remove added option groups, hide
    // sub options.
    function resetForm() {
      console.log("Resetting form");

      // Clear all checkboxes and radio buttons
      $('input:checkbox').each(function(index){
        var $this = $(this);
        if ($this.prop('checked')) {
          $this.prop('checked', false).checkboxradio('refresh');
        }
      });
      $('input:radio').each(function(index){
        var $this = $(this);
        if ($this.prop('checked')) {
          $this.prop('checked', false).checkboxradio('refresh');
        }
      });
      $('fieldset').each(function(index){
        hideAndClearSubQuestionsFor($(this).attr('id'));
      });

      // Clear text input
      $('input:text').each(function (index) {
        var $this = $(this);
        $this.val('');
      });

      // Clear file upload selections
      $('input[type=file]').each(function (index) {
        $(this).val('');
      });

      // Remove additional repeating groups
      $('.append-to').empty();
    }




    // Render the form ...........................................................
    var renderForm = function() {
      console.log("Form data:");
      console.log(settings.formData);
      $.each(settings.formData.questions, function (index, question) {
        addQuestion(question);
      });
      form.trigger("create");
    };

    /**
     * Keep track of how many times we've seen a question with a given name
     * Return a suffix if we've seen it more than once
     */
    function suffix(name) {
      if(_.has(repeatCounter, name)) {
        repeatCounter[name] += 1;
        return "-" + repeatCounter[name].toString();
      }

      repeatCounter[name] = 1;
      return "";
    }

    function makeClickHandler(id, triggerID) {
      return function handleClick(e) {
        // Hide all of the conditional questions, recursively.
        hideAndClearSubQuestionsFor(id);

        // Show the conditional questions for this response.
        if($(this).prop("checked")) {
          $('.control-group[data-trigger=' + triggerID + ']').each(function (i) {
            $(this).show();
          });

          $('.repeating-button[data-trigger=' + id + ']').each(function (i) {
            $(this).show();
          });
        }
      };
    }

    /*
     * Render questions
     */
    app.boxAnswersByQuestionId = {};
    app.questionsByParentId = {};
    var templates;
    function addQuestion(question, visible, parentID, triggerID, appendTo) {
      // Set default values for questions
      if (visible === undefined) {
        visible = true;
      }
      if (parentID === undefined) {
        parentID = '';
      }
      if (triggerID === undefined) {
        triggerID = '';
      }

      // Load the templates
      if (templates === undefined) {
        templates = {
          question: _.template($('#question').html().trim()),
          answerCheckbox: _.template($('#answer-checkbox').html().trim()),
          answerRadio: _.template($('#answer-radio').html().trim()),
          answerText: _.template($('#answer-text').html().trim()),
          answerFile: _.template($('#answer-file').html().trim()),
          repeatButton: _.template($('#repeat-button').html().trim())
        };
        if (settings.survey.type === 'address-point') {
          templates.answerAddress = _.template($('#answer-address-map').html());
        } else {
          templates.answerAddress = _.template($('#answer-address').html());
        }
      }

      // Give the question an ID based on its name
      var id = _.uniqueId(question.name);

      // Collected the data needed to render the question
      var questionData = {
        text: question.text,
        layout: question.layout,
        info: question.info,
        id: id,
        parentID: parentID,
        triggerID: triggerID
      };

      // Render the questions's fieldset
      var $question = $(templates.question(questionData));
      if (!visible) {
        $question.hide();
      }

      var siblings = app.questionsByParentId[parentID];
      if (siblings === undefined) {
        siblings = [];
        app.questionsByParentId[parentID] = siblings;
      }
      siblings.push($question);


      if (appendTo !== undefined) {
        $(appendTo).append($question);
      }else {
        formQuestions.append($question);
      }

      var suffixed_name = question.name + suffix(question.name);

      // Infoboxes (aka help text for questions)
      if(question.info !== undefined) {
        $question.find(".show-info").click(function(e) {
          var toShow = $(this).attr("data-trigger");
          $("#" + toShow).slideToggle('slow');
        });

        $question.find(".box-close").click(function(e) {
          var $toHide = $(this).parent();
          $toHide.slideUp('slow');
        });
      }

      // TODO: Titles for question groups
      // if(answer.title != undefined) {
      //   console.log("TITLE!------");
      //   var $title = $(_.template($('#title').html(), {title: answer.title} ));
      //   $question.append($title);
      // }

      var questionID = id;

      // Handle questions with no list of predefined answers
      if (question.answers === undefined || question.answers.length === 0) {
        var $answer;
        var value = '';
        var data;

        if (question.type === 'text') {
          if (question.value !== undefined) {
            value = question.value;
          }
          data = {
            questionName: suffixed_name,
            id: _.uniqueId(question.name),
            value: value
          };

          $answer = $(templates.answerText(data));
        } else if (question.type === 'address') {
          data = {
            questionName: suffixed_name,
            id: _.uniqueId(question.name),
            value: ''
          };

          $answer = $(templates.answerAddress(data));
          if (settings.survey.type === 'address-point') {
            $answer.each(function (i, el) {
              if ($(el).hasClass('address-map-button')) {
                $(el).click(function (e) {
                  e.preventDefault();
                  $.publish('mapAddress', [$answer.val()]);
                });
              }
            });
          }
        } else if (question.type === 'file') {
          $answer = $(templates.answerFile({
            questionName: suffixed_name,
            id: _.uniqueId(question.name)
          }));
        }

        $question.append($answer);
      }

      // Add each answer to the question
      _.each(question.answers, function (answer) {
        // The triggerID is used to hide/show other question groups
        var triggerID = _.uniqueId(question.name);

        // TODO: checkbox questions should be consistent with other answer groups
        if(question.type === "checkbox") {
          suffixed_name = answer.name + suffix(answer.name);
          triggerID = suffixed_name; //_.uniqueId(answer.name);
          id = suffixed_name; //_.uniqueId(answer.name);
        }

        // Set the data used to render the answer
        var data = {
          questionName: suffixed_name,
          id: triggerID,
          theme: (answer.theme || "c"),
          value: answer.value,
          text: answer.text
        };

        // Render the answer and append it to the fieldset.
        var $answer;
        var referencesToAnswersForQuestion;

        // If there is more than one answer, this could be multiple choice
        // or a radio group.
        if (question.answers.length > 1) {

          if (question.type === "checkbox") {
            $answer = $(templates.answerCheckbox(data));
          } else {
            $answer = $(templates.answerRadio(data));
          }

          // Store references to the questions for quick retrieval later
          referencesToAnswersForQuestion = app.boxAnswersByQuestionId[questionID];
          if (referencesToAnswersForQuestion === undefined) {
            referencesToAnswersForQuestion = [];
            app.boxAnswersByQuestionId[questionID] = referencesToAnswersForQuestion;
          }
          $answer.filter('input[type="radio"]').each(function (i, el) {
            referencesToAnswersForQuestion.push($(el));
          });
          $answer.filter('input[type="checkbox"]').each(function (i, el) {
            referencesToAnswersForQuestion.push($(el));
          });

        } else {
          $answer = $(templates.answerCheckbox(data));

          // Store references to answers for quick retrieval later
          referencesToAnswersForQuestion = app.boxAnswersByQuestionId[questionID];
          if (referencesToAnswersForQuestion === undefined) {
            referencesToAnswersForQuestion = [];
            app.boxAnswersByQuestionId[questionID] = referencesToAnswersForQuestion;
          }
          $answer.filter('input[type="radio"]').each(function (i, el) {
            referencesToAnswersForQuestion.push($(el));
          });
          $answer.filter('input[type="checkbox"]').each(function (i, el) {
            referencesToAnswersForQuestion.push($(el));
          });
        }

        $question.append($answer);

        // Add the click handlers
        var input = $answer.parent().find('input#' + triggerID);
        if (input.length === 0) {
          input = $answer;
        }

        input.click(makeClickHandler(id, triggerID));

        // If there are conditional questions, add them.
        // They are hidden by default.
        if (answer.questions !== undefined) {
          // If users can repeat those conditional questions:
          if(answer.repeatQuestions !== undefined) {
            var $repeatButton;
            var $repeatBox = $(templates.repeatButton({
              parentID: id,
              triggerID: id
            }));
            formQuestions.append($repeatBox);
            $repeatButton = $repeatBox.find('a');
            var $appendTo = $repeatBox.find('.append-to');

            // If we click the repeat button, add the questions again
            $repeatButton.click(function handleClick(e) {
              e.preventDefault();

              // Append the questions to this answer again!
              _.each(answer.questions, function (subq) {
                addQuestion(subq, true, id, triggerID, $appendTo);
              });

              form.trigger("create");
            });

            _.each(answer.questions, function (subq) {
              // Add the sub questions before the repeatButton
              addQuestion(subq, false, id, triggerID, $appendTo);
            });


          }else {
            _.each(answer.questions, function (subq) {
              // Add the sub questions before the repeatButton
              if(appendTo !== undefined){
                addQuestion(subq, false, id, triggerID, appendTo);
              }else {
                addQuestion(subq, false, id, triggerID);
              }
            });

          } // end repeating answers

        } // end check for sub-answers

      });
    }




    // Option group stuff ......................................................

    // Show / hide sub questions for a given parent
    function hideAndClearSubQuestionsFor(parent) {

      // Get the list of questions associated with that parent
      var questionsToProcess = app.questionsByParentId[parent]; // was var controlGroupQueue
      var answersToProcess = [];

      function handleQuestion(question) {
        var $el = $(question);
        $el.hide();

        // Get the answers we'll need to reset later
        var id = $el.attr('id');
        var answersForQuestion = app.boxAnswersByQuestionId[id];
        if (answersForQuestion !== undefined) {
          answersToProcess = answersToProcess.concat(answersForQuestion);
        }

        // Handle conditional questions.
        var subQuestions = app.questionsByParentId[$el.attr('id')];
        if (subQuestions !== undefined) {
          questionsToProcess = questionsToProcess.concat(subQuestions);
        }
      }

      var i = 0;
      var question;
      while (questionsToProcess !== undefined && i < questionsToProcess.length) {
        question = questionsToProcess[i];
        handleQuestion(question);
        i += 1;
      }

      // Uncheck all the things!
      var j;
      var answersToProcessLength = answersToProcess.length;
      for (j = 0; j < answersToProcessLength; j += 1) {
        if (answersToProcess[j].prop('checked')) {
          answersToProcess[j].prop('checked', false).checkboxradio("refresh");
        }
      }

      $('.repeating-button[data-parent=' + parent + ']').hide();
    }

    // Trigger form init .........................................................
    this.init();

  };
});
