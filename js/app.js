/* 
 * Basic app functionality for the mobile survey. 
 */

var NSB = {  
  /* 
   * Show the survey & hide the front page after the sign-in form has been 
   * submitted
   */
  init: function() {  
    console.log("Initialize NSB");
    
    // Get the survey, slug, etv.
    NSB.API.getSurveyFromSlug();
    
    // Set the collector name, if we already know it.
    if ($.cookie('collectorName') != null){
      $("#collector_name").val($.cookie('collectorName'));
    }
    
    $("#collector-name-submit").click(function(event) {
      console.log("Setting collector name");
      
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
  },
  
  // We'll use this to keep track of the object currently selected in the app
  selectedObject: {}
  
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
//  
//}); // end onready
  