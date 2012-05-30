function NSBForm() {
  // Init
  var form = $(".....");
  
  // Bind stuff here....
  
  
  
  // Private
  
  
  /*
  Serialize an HTML form for submission to the API
  usage: $('#myform').serializeObject();
  */ 
  var serialize = function() {
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


  /*
   * Overrides the default behavior of a form.
   * Data will be submitted to the action URL in the form.
   * The user will not leave the current page
   * successCallback will be called if the submission is successfull
   */
  var ajaxFormSubmit = function(event, form, successCallback) {
    event.preventDefault(); // stop form from submitting normally
    url = form.attr('action');
    // TODO: make submit button inactive. 

    // serialize the form
    serialized = form.serializeObject();
    console.log("POST url: " + url);
    console.log(serialized);

    // Post the form
    var jqxhr = $.post(url, {responses: [{parcel_id:serialized, responses: serialized}]}, 
     function() {
       console.log("Form posted");
     },
     "text"
    ).error(function(){ 
      var result = "";
      for (var key in jqxhr) {
        result += key + ": " + jqxhr[key] + "\n";
      }
      console.log("error: " + result);
    }).success(
      successCallback()
    );

    return this;
  };
  
  /*
   * Update info on the form based on data from postgis.
   * TODO: standardize to expect a certian kind of data. 
   * TODO: test!!!!
   */
  function setFormParcelPostGIS(data) {
    console.log(data);
    var parcel_id = data.parcel_id;
    var human_readable_location = data.address;

    $('.parcel_id').val(parcel_id);
    $('h2 .parcel_id').text(human_readable_location);
  };

  
  /*
   * Remove an option group
   * 
   */
  $('.remove').click(function(){
    var parent = $(this).closest('.opt-group');
    parent.slideToggle('fast', function(){
      parent.remove();
    });
        
    var count = parseInt($('#use-count').attr('value'), 10);
    count = count - 1;
    $('#use-count').attr('value', count);
  });

  /*
   * When the add-another button is clicked, clone the group
   */
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
     console.log("APPEND AFTER ================");
     console.log(append_after);
     console.log(clone);
     append_after.after(clone);
     clone.trigger("create");
   });
   
   
     /*
   * Set the URLs on all forms
   */
  $("form").each(function(index, form) {
    url = getSurveyURL() + $(this).attr('action'); 
    $(this).attr('action', url);
  });


  /* 
   * Clear the form and thank the user after a successful submission
   * TODO: pass in selected_parcel_json
   */
  function successfulSubmit() {
    console.log("Successful submit");
    console.log(selected_parcel_json);

    // Update the responses in the map, in case others added responses in the same
    // area.
    getResponsesInMap();

    $('#form').slideToggle();
    $('#thanks').slideToggle();

    if($('#address-search-prompt').is(":hidden")) {
      $('#address-search-prompt').slideToggle();
    }
    if($('#address-search').is(":visible")) {
      $('#address-search').slideToggle();
    }



    resetForm();
  }


  /* 
   * Handle the parcel survey form being submitted
   */
  $("#parcelform").submit(function(event) {
    
    event.preventDefault(); // stop form from submitting normally
    url = $(this).attr('action'); 
          
    // serialize the form
    serialized = $('#parcelform').serializeObject();
    console.log("Submitting survey results ==============");
    console.log("POST url: " + url);
    console.log(serialized);

    var centroid_lat = parseFloat(selected_centroid.lat);
    var centroid_lng = parseFloat(selected_centroid.lng);
    console.log(centroid_lat, centroid_lng);
    
    responses = {responses: [{
        "source": {"type":"mobile", "collector":collector_name}, 
        "geo_info": {"centroid":[centroid_lat, centroid_lng], parcel_id:serialized.parcel_id}, 
        "parcel_id": serialized.parcel_id, 
        "responses": serialized
    }]};
      
    console.log(responses);
    
    // Post the form
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


  /*
   * Reset the form: clear checkboxes, remove added option groups, reset counts
   */
  function resetForm() {
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

  
  // Public
  this.something = function(){
    privatestuff();
  };
  
  // Getters / Setters

  
}