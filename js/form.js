NSB.FormView = function(formContainerId){
  var form = $(formContainerId + ' form');
  var formQuestions = $('#questions'); 
  
  this.init = function(){
    console.log("Initialize form");
    
    // Set the URLs on all forms
    url = NSB.API.getSurveyURL() + form.attr('action'); 
    form.attr('action', url);    
    
    // Listen for objectedSelected, triggered when items on the map are tapped
    $.subscribe("objectSelected", setSelectedObjectInfo);  
    
    // Render the form 
    $.each(NSB.test.questions, function (index, question) {
      console.log("Adding question");
      console.log(question);
      addQuestion(question);
    });
    
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
    url = $(this).attr('action'); 
          
    // Serialize the form
    serialized = form.serializeObject();

    // Get some info about the centroid as floats. 
    var selectedCentroid = NSB.map.getSelectedCentroid();
    var centroidLat = parseFloat(selectedCentroid.lat);
    var centroidLng = parseFloat(selectedCentroid.lng);
    
    console.log("Selected object ID");
    console.log(NSB.selectedObject.id);
    
    // Construct a response in the format we need it.  
    responses = {responses: [{
        "source": {"type":"mobile", "collector":NSB.collectorName}, 
        "geo_info": {
          "centroid":[centroidLat, centroidLng], 
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
  
  
  // Render the form. 
  // ================
  function addQuestion(question, visible, parentID, triggerID) {
    console.log("Adding question");
    console.log(question);
    console.log(question.name);
    
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
    var data = {
      text: question.text,
      id: id,
      parentID: parentID,
      triggerID: triggerID
    };

    // Render the question block template
    var $question = $(_.template($('#question').html(), data));
    if (!visible) {
      $question.hide();
    }
    formQuestions.append($question);

    // Add each answer to the question
    _.each(question.answers, function (answer) {
      
      // The triggerID is used to hide/show other question groups
      var triggerID = _.uniqueId(question.name);
      
      // Set the data used to render the answer
      var data = {
        questionName: question.name,
        id: triggerID,
        value: answer.value,
        text: answer.text
      };
      
      // Render the answer and append it to the fieldset.
      var $answer = $(_.template($('#answer').html(), data));
      $question.append($answer);

      // Add the click handler
      $answer.click(function handleClick(e) {
        // Hide all of the conditional questions, recursively.
        hideSubQ(id);

        // Show the conditional questions for this response.
        $('.control-group[data-trigger=' + triggerID + ']').each(function (i) {
          $(this).show();
        });
      });

      // If there are conditional questions, add them.
      // They are hidden by default.
      if (answer.questions !== undefined) {
        _.each(answer.questions, function (subq) {
          addQuestion(subq, false, id, triggerID);
        });
      }
    });
    
    // After adding each response, we need to make sure that jquery mobile
    // knows to render each form element.
    console.log(form);
    form.trigger("create");
    console.log(form);
  }
  
  
  // Option group stuff 
  // ======================================================
  
  // Show / hide sub questions
  function hideSubQ(parent) {
    $('.control-group[data-parent=' + parent + ']').each(function (i) {
      var $el = $(this);
      $el.hide();

      // Uncheck the answers
      $('input[type=radio]', $el).each(function () {
        $(this).attr('checked', false);
      });

      // Handle conditional questions.
      hideSubQ($el.attr('id'));
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

  // When the add-another button is clicked, clone the group
  $(".add-another").click(function(){  
    
    // Get the parent & make a copy of the template
    var parent = $(this).parent().parent();
    var append_after = parent.find('.opt-group').last();
    var container = $("#template-use .opt-group");
    var clone = container.clone(true); 
    
    // Set the number of times clicked
    var count = parseInt($('#use-count').attr('value'), 10);
    count = count + 1;
    $('#use-count').attr('value', count);
    console.log("count: " + $('#use-count').attr('value'));
    
    // Set IDs and name on form elements to match the count
    clone.find('input').each(function(index) {
      // First, remove old counts
      $(this).attr('id', strip_count($(this).attr('id')));
      $(this).attr('name', strip_count($(this).attr('name')));
    
      // Set counts
      $(this).attr('id', $(this).attr('id') + "-" + count);
      $(this).attr('name', $(this).attr('name') + "-" + count);
    
    });
    
    clone.find('.use-id').text(count);
    
    // Number the fieldsets
    clone.find('fieldset').each(function(index) {
      console.log("Updating fieldset");
      console.log($(this));
      console.log($(this).attr('id'));
    
      // remove old count
      $(this).attr('id', strip_count($(this).attr('id')));
           
      // then, addd new count
      $(this).attr('id', $(this).attr('id') + "-" + count);
    });
    
    // Number the labels
    clone.find('label').each(function(index) {
      $(this).attr('for', strip_count($(this).attr('for')));
    
      //$(this).attr('for', $(this).attr('for').split("-").slice(0, -1).join('-'));
      $(this).attr('for', $(this).attr('for') + "-" + count);
    });
    
    // Show the clone (the template is hidden by default)
    clone.show();
    clone.trigger("create");
    
    // Force jquery mobile to render the form elements
    clone.find('input').each(function(index,elt){
      $(this).removeAttr('data-role');
      $(this).trigger("create");
    });
    
    // Add the clone to the page
    console.log("Append after");
    console.log(append_after);
    console.log(clone);
    append_after.after(clone);
    clone.trigger("create");
  });


  // Trigger form init 
  // ==================
  this.init();
  
};