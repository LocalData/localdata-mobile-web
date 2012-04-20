/* 
  Basic app functionality for the mobile survey. 
*/

// TODO: set this up correctly in a config file.
var map, marker, circle;
var BASEURL = 'http://surveydet.herokuapp.com'; // no trailing slash

var SURVEYID = '1';
var locale = "san francisco"; // our current set of parcels. 
var maps = {
  'san francisco': {
    'json': 'http://a.tiles.mapbox.com/v3/matth.sfparcels.jsonp',
    'interaction': 'setFormParcelSF' // Name of the function that gets parcel info
  },
  'detroit': {
    'json': 'http://a.tiles.mapbox.com/v3/matth.det-parcels2.jsonp',
    'interaction': 'setFormParcelDET'
  }
}

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

/*
Gets the data for a given parcel and displays it.
*/
function loadDataForParcel(parcel_id) {
  console.log("Getting data for parcel");
  $.getJSON(getParcelDataURL(parcel_id), function(data) {
    console.log("Hey thar");
    console.log(data);
  });
}


/*
Update the hidden parcel_id field to set the parcel the user
has selected. Will need to be different for every city. 
*/
function setFormParcelSF(id) {
  // Get the block+lot from the interaction data. 
  // Later on, this will need to be a variable / paramaterized; or 
  // standardized per base layer dataset.
  var blocklot = id.data.blklot;
  var human_readable_location = id.data.from_st;
  if (id.data.from_st != id.data.to_st) {
    human_readable_location += "-" + id.data.to_st;
  };
  human_readable_location += " " + id.data.street + " " + id.data.st_type;
  
  $('#parcel_id').val(blocklot);
  $('h2 .parcel_id').text(human_readable_location);
  
  console.log(id.data);
  loadDataForParcel(blocklot);
}

/*
Moves the marker to indicate the selected parcel.
*/
function selectParcel(m, latlng) {
  m.setLatLng(latlng);
  if(!$('#form').is(":visible")) {
      $('#startpoint').slideToggle();
      $('#form').slideToggle();
  }
  map.removeLayer(circle);
}


function GeoJSONify(o) {
  var text = o.data.polygon;
  text = text.replace('\\','');
  console.log(text);
  var json = jQuery.parseJSON(text);
  console.log(json);
  
  // L.Polygon( <LatLng[]> latlngs, <Polyline options> options? )
  // 
  // var p1 = new L.LatLng(51.509, -0.08),
  //     p2 = new L.LatLng(51.503, -0.06),
  //     p3 = new L.LatLng(51.51, -0.047),
  //     polygonPoints = [p1, p2, p3];
  // 
  // var polygon = new L.Polygon(polygonPoints);
  
  var polypoints = new Array();  
  for (var i = json.coordinates[0].length - 1; i >= 0; i--){
    point = new L.LatLng(json.coordinates[0][i][1], json.coordinates[0][i][0]);
    polypoints.push(point);
  };
  options = {
      color: 'red',
      fillColor: '#f03',
      fillOpacity: 0.5
  };
  var polygon = new L.Polygon(polypoints, options);

  map.addLayer(polygon);
  
}

/*
Serialize a form for submission
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

/* 
Set up the map
*/
wax.tilejson(maps['san francisco']['json'],
  function(tilejson) {
    map = new L.Map('map-div');
    map.addLayer(new wax.leaf.connector(tilejson));
    wax.leaf.interaction()
      .map(map)
      .tilejson(tilejson)
      .on('on', function(o) {
          // Interaction: Handles clicks/taps
          if (o.e.type == 'mouseup') { // was mousemove
              //  console.log(o.formatter({format:'full'}, o.data));
              setFormParcelSF(o);
              GeoJSONify(o);
              selectParcel(marker, map.mouseEventToLatLng(o.e));
          }
      });
    
		map.on('locationfound', onLocationFound);
		map.on('locationerror', onLocationError);
		map.locateAndSetView(18);
		
		// For Detroit testing: 
		// var detroit = new L.LatLng(42.342781, -83.084793);
		// mapsetView(detroit, 18);
    
		function onLocationFound(e) {
	    marker = new L.Marker(e.latlng);
		  map.addLayer(marker);  		  

      // Add the accuracy circle to the map
			var radius = e.accuracy / 2;
			circle = new L.Circle(e.latlng, radius);
			map.addLayer(circle);
		}

		function onLocationError(e) {
			alert(e.message);
		}
});
  

$(document).ready(function(){
    $("#parcelform").submit(function(event) {
      event.preventDefault(); // stop form from submitting normally
      url = $(this).attr('action'); // get the URL from the form action
          
      // serialize the form
      serialized = $('#parcelform').serializeObject();
      console.log("POST url: " + url);
      console.log(serialized);
      
      // post the form
      $.post(url, {responses: [serialized]}, 
        function() {
          console.log("Form successfully posted");
        },
        "text"
      ).error(function(){ 
        console.log("error");
      }).success(function(){
        
      });
      
  });      
});
  
