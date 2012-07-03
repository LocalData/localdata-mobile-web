/* 
 * Basic app functionality for the mobile survey. 
 */


var NSB = {  
  
  /* 
   * Show the survey & hide the front page after the sign-in form has been 
   * submitted
   */
 
  init: function() {  
    $("#collector-name-submit").click(function(event) {
      NSB.collectorName = $("#collector_name").val();
      $("#startpoint h2").html("Welcome, " + NSB.collectorName + "<br>Select a parcel to begin");
      $(".collector").val(NSB.collectorName);
      
      // Set a cookie with the collector's name
      $.cookie("collectorName", NSB.collectorName, { path: '/' });
      
      // Hide the homepage, show the survey
      $('#home-container').slideToggle();
      $('#survey-container').slideToggle();
      $("body").attr("id","survey");
      
      NSB.map = new NSB.MapView('map-div');
      NSB.f = new NSB.FormView('#form');
    }); 
  }
};


$(document).ready(function(){ 
  NSB.init();
});


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
//  
//}); // end onready
  
