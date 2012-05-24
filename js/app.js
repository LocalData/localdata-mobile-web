/* 
  Basic app functionality for the mobile survey. 
*/

// TODO: Abstract these into an object that can be passed around
var map, marker, circle;
var selected_polygon = false;
var selected_centroid = false;
var selected_parcel_json = false;
var collector_name = "";

var CheckIcon = L.Icon.extend({
  options: {
    className: 'CheckIcon',
    iconUrl: 'img/icons/check-16.png',
    shadowUrl: 'img/icons/check-16.png',
  	iconSize: new L.Point(16, 16),
  	shadowSize: new L.Point(16, 16),
  	iconAnchor: new L.Point(8, 8),
  	popupAnchor: new L.Point(8, 8)
  }
});                       

$.fn.clearForm = function() {
  return this.each(function() {
    var type = this.type, tag = this.tagName.toLowerCase();
    if (tag == 'form')
      return $(':input',this).clearForm();
    if (type == 'text' || type == 'password' || tag == 'textarea')
      this.value = '';
    else if (type == 'checkbox' || type == 'radio')
      this.checked = false;
    else if (tag == 'select')
      this.selectedIndex = -1;
  });
};

/*
Generates the URL to retrieve results for a given parcel
*/
function getParcelDataURL(parcel_id) {
  return BASEURL + '/surveys/' + SURVEYID + '/parcels/' + parcel_id + '/responses';
}

function getSurveyURL() {
  return BASEURL + "/surveys/" + SURVEYID;
}

function setFormParcelCarto(data) {
  console.log(data);
  var blocklot = data.blklot;
  var human_readable_location = data.from_st;
  if (data.from_st != data.to_st) {
    human_readable_location += "-" + data.to_st;
  };
  human_readable_location += " " + data.street + " " + data.st_type;
  
  $('.parcel_id').val(blocklot);
  $('h2 .parcel_id').text(human_readable_location);
  
  // loadDataForParcel(blocklot);   // TODO
};


function setFormParcelPostGIS(data) {
  console.log(data);
  var parcel_id = data.parcel_id;
  var human_readable_location = data.address;
  
  $('.parcel_id').val(parcel_id);
  $('h2 .parcel_id').text(human_readable_location);
};


/*
Moves the marker to indicate the selected parcel.
*/
// TODO -- better name
function selectParcel(m, latlng) {
  if(!$('#form').is(":visible")) {
      $('#form').slideToggle();
  }
  if($('#startpoint').is(":visible")) {
    $('#startpoint').slideToggle();
  }
  if($('#thanks').is(":visible")) {
    $('#thanks').slideToggle();
  }
}



/*
 * Adds a checkbox marker to the given point
 */
function addDoneMaker(latlng) {
  var doneIcon = new CheckIcon();
  icon = new L.Marker(latlng, {icon: doneIcon});
  map.addLayer(icon);
  return icon;
}


/* 
 * Outline the given polygon
 */
function highlightPolygon(map, selected_parcel_json) {
  // expects format: 
  // {coordinates: [[x,y], [x,y], ...] }
  
  polygon_json = selected_parcel_json.polygon;
  
  // Remove existing highlighting 
  if(selected_polygon) {
    map.removeLayer(selected_polygon);
  }

  console.log("Polygon JSON");
  console.log(polygon_json);
  
  // Add the new polygon
  var polypoints = new Array();  
  for (var i = polygon_json.coordinates[0].length - 1; i >= 0; i--){
    point = new L.LatLng(polygon_json.coordinates[0][i][1], polygon_json.coordinates[0][i][0]);
    polypoints.push(point);
  };
  options = {
      color: 'red',
      fillColor: 'transparent',
      fillOpacity: 0.5
  };
  selected_polygon = new L.Polygon(polypoints, options);
  map.addLayer(selected_polygon);
  
  return selected_polygon;  
}

/*
 * Trim function: strips whitespace from a string. 
 * Use: " dog".trim() === "dog" //true
 */
if(typeof(String.prototype.trim) === "undefined")
{
    String.prototype.trim = function() 
    {
        return String(this).replace(/^\s+|\s+$/g, '');
    };
}


// Given a Leaflet latlng object, return a JSON object that describes the 
// parcel.
// Attributes: parcel_id (string), address (string), polygon (GeoJSON)
function getPostgresData(latlng, callback) {
  var lat = latlng.lat;
  var lng = latlng.lng; //http://stormy-mountain-3909.herokuapp.com
  var url = 'http://stormy-mountain-3909.herokuapp.com/detroit/parcel?lat=' + lat + '&lng=' + lng;
  console.log(url);
  $.getJSON(url, function(data){
    // Process the results. Strip whitespace. Convert the polygon to geoJSON
    var result = {
      parcel_id: data[0].trim(), 
      address: data[3].trim(),
      polygon: jQuery.parseJSON(data[4]),
      centroid: jQuery.parseJSON(data[5])
    };
    callback(result);
  });
}


function getResponsesInMap(){
  console.log("Getting responses in the map");
  console.log(map.getBounds());
  bounds = map.getBounds();
  southwest = bounds.getSouthWest();
  northeast = bounds.getNorthEast();
  
  serialized_bounds = southwest.lat + "," + southwest.lng + "," + northeast.lat + "," + northeast.lng;
  var url = this.getSurveyURL() + "/responses/in/" + serialized_bounds;
  console.log(url);
  
  $.getJSON(url, function(data){
    console.log(data);
    if(data.responses) {
      $.each(data.responses, function(key, val) {
        p = new L.LatLng(val.geo_info.centroid[0],val.geo_info.centroid[1]);
        addDoneMaker(p);
        console.log(p);
      });
    };
  });
};


/*
Serialize an HTML form for submission to the API
usage: $('#myform').serializeObject();
*/ 
$.fn.serializeObject = function() {
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


function drawMap() {
  /*
    Draw the parcel map on the survey page
  */
  map = new L.Map('map-div', {minZoom:13, maxZoom:18});
  
  // Add a bing layer to the map
  bing = new L.BingLayer(settings.bing_key, 'AerialWithLabels', {maxZoom:21});
  map.addLayer(bing);
   
  // Add the TileMill maps. 
  // Get the JSON url from the settings.
  wax.tilejson(maps[locale]['json'], function(tilejson) {
    map.addLayer(new wax.leaf.connector(tilejson));

    // Highlight parcels when clicked
    map.on('click', function(e) {
      // e contains information about the interaction. 
     // console.log(e);
     getPostgresData(e.latlng, function(data){
       selected_parcel_json = data;
       selected_centroid = new L.LatLng(selected_parcel_json.centroid.coordinates[1], selected_parcel_json.centroid.coordinates[0]);
       setFormParcelPostGIS(data);
       highlightPolygon(map, data);
       selectParcel();
     });
    });
    
    map.on('moveend', function(e) {
      try {
        getResponsesInMap();
      } catch(e){}
    });
    
    // Used for centering the map when we're using geolocation.
    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);

    // Center the map 
    map.locate({setView: true, maxZoom: 18});
    // var sf = new L.LatLng(37.77555050754543, -122.41365958293713);
    // For Detroit testing: 
    //var detroit = new L.LatLng(42.305213, -83.126260);
    //map.setView(detroit, 18);
    

    // Mark a location on the map. 
    // Primarily used with browser-based geolocation (aka "where am I?")
    function onLocationFound(e) {
     // Add the accuracy circle to the map
    	var radius = e.accuracy / 2;
    	circle = new L.Circle(e.latlng, radius);
    	map.addLayer(circle);
    	
    	getResponsesInMap();
    }

    function onLocationError(e) {
    	alert(e.message);
    }
  });
};


/* 
 * Given a map object, return the bounds as a string
 */
function getMapBounds(m) {
  bounds = "";
  bounds += m.getBounds().getNorthWest().toString();
  bounds += " " + m.getBounds().getSouthEast().toString();  
  return bounds;
};


/*
 * Overrides the default behavior of a form.
 * Data will be submitted to the action URL in the form.
 * The user will not leave the current page
 * successCallback will be called if the submission is successfull
 */
function ajaxFormSubmit(event, form, successCallback) {
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

/* FORM FUNCTIONS =========================================================*/
/*
 * Strip a number from a string. Eg:
 * "option-retail-1" => "option-retail"
 */
function strip_count(str) {
  console.log("Strip string");
  l = str.split("-");
  if (l.length == 1) { 
    console.log(l); 
    return l[0]; 
  };
  s = l.slice(0, -1).join("-");
  console.log(s);
  return s;
};

function resetForm() {
   $(this).find('input').each(function(index){
     $(this).attr('checked', false).checkboxradio('refresh',true);
   });
   
   $('.template-group').remove();
};

/* 
 * Clear the form and thank the user after a successful submission
 * TODO: pass in selected_parcel_json
 */
function successfulSubmit() {
  console.log("Successful submit");
  console.log(selected_parcel_json);
  
  getResponsesInMap();
     
  $('#form').slideToggle();
  $('#thanks').slideToggle();
  resetForm();
}




/* DOCUMENT READY ==========================================================*/

/* 
 * Main set of event listeners
 */
$(document).ready(function(){  
  /* 
   * Show additional questions based on selected options.
   */
   $('[id^="options-use"] input').change(function(){    
     console.log("Hiding options");
     console.log(this);    

     // First, find the options groups in the field, and hide + clear them.
     var opt_group = $(this).closest('.opt-group');
     opt_group.find('.options').each(function(index){
       // Hide every options group
       $(this).hide();

       // Clear out selected options so we don't accidentally submit them
       $(this).find('input').each(function(index){
         $(this).attr('checked', false).checkboxradio('refresh',true);
       });
     });

     // show selected option group
     var group_to_show = "#options-" + $(this).attr('id');
     var parent = $(this).attr('id');
     $(group_to_show).slideToggle();
     console.log("Showing options group " + group_to_show);
   });
  
  /*
   * Set the URLs on all forms
   */
  $("form").each(function(index, form) {
    url = getSurveyURL() + $(this).attr('action'); 
    $(this).attr('action', url);
  });
  
  
  /*
   * Remove an option group
   */
  $('.remove').click(function(){
    var parent = $(this).closest('.opt-group');
    parent.slideToggle('fast', function(){
      parent.remove();
    });
    var count = parseInt($('#template-use').attr('count'), 10);
    console.log("count: " + count);
    count = count - 1;
    $('#template-use').attr('count', count);
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
     var count = parseInt($('#template-use').attr('count'), 10);
     console.log("count: " + count);
     count = count + 1;
     $('#template-use').attr('count', count);
     console.log("count: " + $('#template-use').attr('count'));
     
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
   * Show the survey & hide the front page after the sign-in form has been 
   * submitted
   */
  $("#collector-name-submit").click(function(event) {
    console.log("Button clicked");
    // Get the value of the collector name
    // Set a cookie with the name
    collector_name = $("#collector_name").val();
    console.log(collector_name);
    $.cookie("collector-name", collector_name, { path: '/' });
    $("#startpoint h2").html("Welcome, " + collector_name + "<br>Select a parcel to begin");
    $(".collector").val(collector_name);
    
    // Hide the homepage, show the survey, draw the map
    $('#home-container').slideToggle();
    $('#survey-container').slideToggle();
    drawMap();
    
    // Change the body ID
    $("body").attr("id","survey");
  });
  
  
  /*
   * Show the feedback bar
   */
  $("#feedback-show").click(function(event) {
    $('#feedback-show').slideToggle();
    $('#feedback-in').slideToggle();
  });
  
  
  /*
   * Submit the feedback form 
   */
  $("#feedback-form").submit(function(event){ 
    // set the bounds for debugging.
    event.preventDefault();
    $('.bounds').val(getMapBounds(map));
    ajaxFormSubmit(event, $("#feedback-form"), function() { 
      console.log("Feedback form submitted successfully");
      $('#feedback-show').slideToggle();
      $('#feedback-in').slideToggle();
    });
  });
 
 
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
  
}); // end onready
  
