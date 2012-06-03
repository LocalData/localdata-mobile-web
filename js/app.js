/* 
  Basic app functionality for the mobile survey. 
*/



// App namespace
var NSB = {
  var collector_name = "";
  
};


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
 * Attempt to center the map on an address using Google's geocoder.
 */
function codeAddress(address) {
  //var address = document.getElementById("address-search").value;
  console.log(address);
  var detroit_address = address + " Detroit, MI"; // for ease of geocoding
  var url = "http://dev.virtualearth.net/REST/v1/Locations/" + detroit_address + "?o=json&key=" + settings.bing_key + "&jsonp=?";

  console.log(url);
  $.getJSON(url, function(data){
    if(data.resourceSets.length > 0){
      console.log(data);
      var point = data.resourceSets[0].resources[0].point;
      console.log(point);
      var latlng = new L.LatLng(point.coordinates[0], point.coordinates[1]);

      var marker = new L.Marker(latlng);
      map.addLayer(marker);
      map.setView(latlng, 18);
    };    
  });
};



/* FORM FUNCTIONS ==========================================================*/



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




/* DOCUMENT READY ==========================================================*/

///* 
// * Main set of event listeners
// */
//$(document).ready(function(){  
//    
//  /* 
//   * Show additional questions based on selected options.
//   */
//   $('[id^="options-use"] input').change(function(){    
//     console.log("Hiding options");
//     console.log(this);    
//
//     // First, find the options groups in the field, and hide + clear them.
//     var opt_group = $(this).closest('.opt-group');
//     opt_group.find('.options').each(function(index){
//       // Hide every options group
//       $(this).hide();
//
//       // Clear out selected options so we don't accidentally submit them
//       $(this).find('input').each(function(index){
//         $(this).attr('checked', false).checkboxradio('refresh',true);
//       });
//     });
//
//     // show selected option group
//     var group_to_show = "#options-" + $(this).attr('id');
//     var parent = $(this).attr('id');
//     $(group_to_show).slideToggle();
//     console.log("Showing options group " + group_to_show);
//   });
//   
//   
//  /*
//   * Show the "search by address" form
//   */
//  $("#address-search-toggle").click(function(){
//    console.log("Toggling address search");
//    $("#address-search").slideToggle();
//    $("#address-search-prompt").slideToggle();
//  });
//  
//  /* 
//   * Search for an address and locate it on the map
//   */
//  $("#address-submit").click(function(){
//    codeAddress($("#address-input").val());
//  });
//  
//  
//  /*
//   * Set the URLs on all forms
//   */
//  $("form").each(function(index, form) {
//    url = getSurveyURL() + $(this).attr('action'); 
//    $(this).attr('action', url);
//  });
//  
//  
//  
//  /*
//   * Show the survey & hide the front page after the sign-in form has been 
//   * submitted
//   */
//  $("#collector-name-submit").click(function(event) {
//    console.log("Button clicked");
//    // Get the value of the collector name
//    // Set a cookie with the name
//    collector_name = $("#collector_name").val();
//    console.log(collector_name);
//    $.cookie("collector-name", collector_name, { path: '/' });
//    $("#startpoint h2").html("Welcome, " + collector_name + 
//      "<br>Select a parcel to begin");
//    $(".collector").val(collector_name);
//    
//    // Hide the homepage, show the survey, draw the map
//    $('#home-container').slideToggle();
//    $('#survey-container').slideToggle();
//    drawMap();
//    
//    // Change the body ID
//    $("body").attr("id","survey");
//  });
//  
//  
//  /*
//   * Show the feedback bar
//   */
//  $("#feedback-show").click(function(event) {
//    $('#feedback-show').slideToggle();
//    $('#feedback-in').slideToggle();
//  });
//  
//  
//  /*
//   * Submit the feedback form 
//   */
//  $("#feedback-form").submit(function(event){ 
//    // set the bounds for debugging.
//    event.preventDefault();
//    $('.bounds').val(getMapBounds(map));
//    ajaxFormSubmit(event, $("#feedback-form"), function() { 
//      console.log("Feedback form submitted successfully");
//      $('#feedback-show').slideToggle();
//      $('#feedback-in').slideToggle();
//    });
//  });
// 
// 
//  
//}); // end onready
  
