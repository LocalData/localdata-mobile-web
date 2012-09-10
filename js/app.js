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
    if ($.cookie('collectorName') !== null){
      $("#collector_name").val($.cookie('collectorName'));
    }
    
    $("#collector-name-submit").click(function(event) {
      console.log("Setting collector name");
      
      NSB.collectorName = $("#collector_name").val();      
      $("#startpoint h2").html("Welcome, " + NSB.collectorName + "<br>Tap a parcel to begin");
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
if(typeof(String.prototype.trim) === "undefined") {
  String.prototype.trim = function() {
    return String(this).replace(/^\s+|\s+$/g, '');
  };
}

if(typeof(String.prototype.titleCase) === "undefined") {
  String.prototype.titleCase = function() { 
     return this.toLowerCase().replace(/^.|\s\S/g, function(a) { return a.toUpperCase(); });
  };
}
  