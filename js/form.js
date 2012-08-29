NSB.FormView = function(formContainerId){
  var form = $(formContainerId + ' form');
  var formQuestions = $('#questions'); 
  var repeatCounter = {};
  
  this.init = function(){
    console.log("Initialize form");
    
    // Listen for objectedSelected, triggered when items on the map are tapped
    $.subscribe("objectSelected", setSelectedObjectInfo);  
    
    // Render the form 
    NSB.API.getForm(renderForm);
    
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
    

  // Update the form with information about the selected object.
  // Then, display the form.
  var setSelectedObjectInfo = function(e) {
    console.log("Showing the form");
        
    // $('.parcel_id').val(NSB.selectedObject.id);
    $('h2 .parcel_id').text(NSB.selectedObject.humanReadableName);
    
    if(!$('#form').is(":visible")) {
        $('#form').slideToggle();
    }
    if($('#startpoint').is(":visible")) {
      $('#startpoint').slideToggle();
    }
    if($('#thanks').is(":visible")) {
      $('#thanks').slideToggle();
    }
  };


  // Form submission 
  // ===============
  
  // Handle the parcel survey form being submitted
  form.submit(function(event) {
    console.log("Submitting survey results");
    
    // Stop form from submitting normally
    event.preventDefault(); 
    
    var url = NSB.API.getSurveyURL() + form.attr('action'); 
          
    // Serialize the form
    serialized = form.serializeObject();

    // Get some info about the centroid as floats. 
    var selectedCentroid = NSB.selectedObject.centroid;
    console.log(selectedCentroid);
    var centroidLat = parseFloat(selectedCentroid.coordinates[0]);
    var centroidLng = parseFloat(selectedCentroid.coordinates[1]);
    
    console.log("Selected object ID");
    console.log(NSB.selectedObject.id);
    
    // Construct a response in the format we need it.  
    responses = {responses: [{
        "source": {
          "type":"mobile", 
          "collector":NSB.collectorName
        }, 
        "geo_info": {
          "centroid":[centroidLng, centroidLat], 
          "geometry": NSB.selectedObject.geometry,
          "humanReadableName": NSB.selectedObject.humanReadableName, 
          parcel_id: NSB.selectedObject.id // Soon to be deprecated
        }, 
        "parcel_id": NSB.selectedObject.id, // Soon to be deprecated
        "object_id": NSB.selectedObject.id, // Replaces parcel_id
        "responses": serialized
    }]};
    
    console.log("Serialized & responses:");
    console.log(serialized);
    console.log(responses);
    console.log(url);
    
    // Post the form
    // TODO: This will need to use Prashant's browser-safe POSTing
    var jqxhr = $.post(url, responses, function() {
        console.log("Form successfully posted");
      },
      "text").error(function(){ 
      var result = "";
      for (var key in jqxhr) {
        result += key + ": " + jqxhr[key] + "\n";
      }
      console.log("error: " + result);
    }).success(function(){
      successfulSubmit();
    });
  });
  
  // Clear the form and thank the user after a successful submission
  // TODO: pass in selected_parcel_json
  function successfulSubmit() {
    console.log("Successful submit");

    // Publish  a "form submitted" event
    $.publish("successfulSubmit");
    
    // Hide the form and show the thanks
    $('#form').slideToggle();
    $('#thanks').slideToggle();

    if($('#address-search-prompt').is(":hidden")) {
      $('#address-search-prompt').slideToggle();
    }
    if($('#address-search').is(":visible")) {
      $('#address-search').slideToggle();
    }

    // Reset the form for the next submission.
    resetForm();
  }

  // Reset the form: clear checkboxes, remove added option groups, 
  //  reset counts
  function resetForm() {
    console.log("Resetting form");
    
    // Clear all checkboxes and radio buttons
    $('input:checkbox').each(function(index){
      try {
        $(this).attr('checked', false).checkboxradio('refresh',true);
      } catch(e){}
    });
    $('input:radio').each(function(index){
      try {
        $(this).attr('checked', false).checkboxradio('refresh',true);
      } catch(e){}
    });

    // Remove additional template groups (eg use options)
    $('form .template-group').remove();

    // Reset count of template groups
    $('#use-count').attr('value', 1);
  };
  
  
  // Render the form ........................................................
  /* 
   * Keep track of how many times we've seen a question with a given name
   * Return a suffix if we've seen it more than once times
   */ 
  var renderForm = function() {
    console.log("Form data:");
    console.log(NSB.settings.formData);
    $.each(NSB.settings.formData.questions, function (index, question) {
      console.log("Adding question");
      console.log(question);
      addQuestion(question);
    });    
    form.trigger("create");

  };
  
  function suffix(name) {
    if(_.has(repeatCounter, name)) {
      repeatCounter[name] += 1;
      return "-" + repeatCounter[name].toString();
    }
    
    repeatCounter[name] = 1; 
    return "";
  };
    
  // Render the form. 
  // ================
  function addQuestion(question, visible, parentID, triggerID, appendBefore) {
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

    // Give the question an ID based on its name
    var id = _.uniqueId(question.name);

    // Collected the data needed to render the question 
    var questionData = {
      text: question.text,
      id: id,
      parentID: parentID,
      triggerID: triggerID
    };
    
    // Render the question block template
    var $question = $(_.template($('#question').html(), questionData));
    if (!visible) {
      $question.hide();
    }
    
    if (appendBefore !== undefined) {
      $(appendBefore).before($question);
    }else {
      formQuestions.append($question);
    }
    
    var suffixed_name = question.name + suffix(question.name);
    
    // Add each answer to the question
    _.each(question.answers, function (answer) {
      // The triggerID is used to hide/show other question groups
      var triggerID = _.uniqueId(question.name);

      // TODO: checkbox questions should be consistent with other answer groups
      if(question.type === "checkbox") {
        suffixed_name = answer.name + suffix(answer.name);
        triggerID = suffixed_name; //_.uniqueId(answer.name);
        id = suffixed_name; //_.uniqueId(answer.name);
      };
      
      // Set the data used to render the answer
      var data = {
        questionName: suffixed_name,
        id: triggerID,
        value: answer.value,
        text: answer.text
      };

      // Render the answer and append it to the fieldset.
      var $answer;
      
      // If there is more than one answer, this could be multiple choice
      // or a radio group.
      if (question.answers.length > 1) {
        
        if(question.type === "checkbox") {
          $answer = $(_.template($('#answer-checkbox').html(), data));
        }else {
          $answer = $(_.template($('#answer-radio').html(), data));
        }
      }else {
        if(question.type === "text") {
          $answer = $(_.template($('#answer-text').html(), data));
        }else {
          $answer = $(_.template($('#answer-checkbox').html(), data));
        }
      }
      
      // TODO: Titles for question groups
      // if(answer.title != undefined) {
      //   console.log("TITLE!------");
      //   var $title = $(_.template($('#title').html(), {title: answer.title} ));
      //   $question.append($title);
      // }
      
      $question.append($answer);

      // Add the click handler
      $answer.click(function handleClick(e) {
        console.log("Hiding " + id);
        // Hide all of the conditional questions, recursively.
        hideSubQ(id);

        if($(this).prop("checked")) {
          // Show the conditional questions for this response.
          $('.control-group[data-trigger=' + triggerID + ']').each(function (i) {
            $(this).show();
          });
          
          $('.repeating-button[data-trigger=' + id + ']').each(function (i) {            
            $(this).show();
          });
        }else {
          $('.control-group[data-trigger=' + triggerID + ']').each(function (i) {            
            $(this).hide();
          });
          
          $('.repeating-button[data-trigger=' + id + ']').each(function (i) {
            $(this).hide();
          });
          
        };
        
      });

      // If there are conditional questions, add them.
      // They are hidden by default.
      if (answer.questions !== undefined) {
        var repeatButton;
        
                
        // If uses can repeat those conditional questions: 
        if(answer.repeatQuestions !== undefined) {
          $repeatButton = $(_.template($('#repeat-button').html(), {
            parentID: id,
            triggerID: id
          }));
          formQuestions.append($repeatButton);
          // $repeatButton.hide();
          
          // If we click the repeat button, add the questions again
          $repeatButton.click(function handleClick(e) {
            e.preventDefault();

            // Append the questions to this answer again! 
            _.each(answer.questions, function (subq) {
              console.log("Lots ... going on -- get it??");
              addQuestion(subq, true, id, triggerID, $repeatButton);
            });
            
            form.trigger("create");
          });
          
          _.each(answer.questions, function (subq) {
            // Add the sub questions before the repeatButton
            addQuestion(subq, false, id, triggerID, $repeatButton);
          });
          
          
        }else {
          _.each(answer.questions, function (subq) {
            // Add the sub questions before the repeatButton
            if(appendBefore !== undefined){
              addQuestion(subq, false, id, triggerID, appendBefore);
            }else {
              addQuestion(subq, false, id, triggerID);
            }
          });
          
        }; // end repeating answers
        
      }; // end check for sub-answers
      
    });
  };
  
  
  
  // Option group stuff 
  // ======================================================
  
  // Show / hide sub questions
  function hideSubQ(parent) {
    $('.control-group[data-parent=' + parent + ']').each(function (i) {
      var $el = $(this);
      $el.hide();
      
      // Uncheck the answers
      $('input[type=radio]', $el).each(function () {
        $(this).attr('checked', false).checkboxradio("refresh");
      });

      $('input[type=checkbox]', $el).each(function () {
        $(this).attr('checked', false).checkboxradio("refresh");
      });

      // Handle conditional questions.
      hideSubQ($el.attr('id'));
    });
    
    $('.repeating-button[data-parent=' + parent + ']').each(function (i) {
      var $el = $(this);
      $el.hide();
    });
  }
  
  // Remove an option group
  $('.remove').click(function(){
    var parent = $(this).closest('.opt-group');
    parent.slideToggle('fast', function(){
      parent.remove();
    });
        
    var count = parseInt($('#use-count').attr('value'), 10);
    count = count - 1;
    $('#use-count').attr('value', count);
  });


  // Trigger form init 
  // ==================
  this.init();
  
};