  // TODO: set this up correctly
  var map, marker, circle;
  var BASEURL = 'http://localhost:3000';
  var SURVEYID = '1';
  
  var locale = "san francisco"; // our current parcel set
  var maps = {
    'san francisco': {
      'json': 'http://a.tiles.mapbox.com/v3/matth.sf-parcels.jsonp',
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
    $.getJSON(getParcelDataURL(parcel_id), function(data) {
      console.log(data);
    });
  }
  
  
  /*
  Update the hidden parcel_id field to match the parcel the user
  has selected
  */
  function setFormParcelSF(id) {
    // Get the block+lot from the interaction data. 
    // Later on, this will need to be a variable / paramaterized; or 
    // standardized per base layer dataset.
    var blocklot = id.data.BLKLOT;
    var human_readable_location = id.data.FROM_ST;
    if (id.data.FROM_ST != id.data.TO_ST) {
      human_readable_location += "-" + id.data.TO_ST;
    };
    human_readable_location += " " + id.data.STREET + " " + id.data.ST_TYPE;
    
    $('#parcel_id').val(blocklot);
    $('h2 .parcel_id').text(human_readable_location);
    
    console.log(id.data);
    loadDataForParcel(blocklot);
  }
  
  /*
  Moves the marker to indicate the selectedparcel.
  */
  function selectParcel(m, latlng) {
    m.setLatLng(latlng);
    if(!$('#form').is(":visible")) {
        $('#startpoint').slideToggle();
        $('#form').slideToggle();
    }
    map.removeLayer(circle);
  }

  /* 
  Set up the map
  */
  wax.tilejson('http://a.tiles.mapbox.com/v3/matth.sf-parcels.jsonp',
    function(tilejson) {
      map = new L.Map('map-div');
      map.addLayer(new wax.leaf.connector(tilejson));
      wax.leaf.interaction()
        .map(map)
        .tilejson(tilejson)
        .on('on', function(o) {
            // Interaction: Handles clicks/taps
            if (o.e.type == 'mouseup') { // was mousemove
                console.log(o.formatter({format:'full'}, o.data));
                setFormParcelSF(o);
                selectParcel(marker, map.mouseEventToLatLng(o.e));
            }
        });
      
  		map.on('locationfound', onLocationFound);
  		map.on('locationerror', onLocationError);

  		map.locateAndSetView(18);
  		// For Detroit testing: 
  		// var detroit = new L.LatLng(42.342781, -83.084793);
  		// map.setView(detroit, 18);
      
  		function onLocationFound(e) {
		    marker = new L.Marker(e.latlng);
			  map.addLayer(marker);  		  

  			var radius = e.accuracy / 2;
  			circle = new L.Circle(e.latlng, radius);
  			map.addLayer(circle);
  		}

  		function onLocationError(e) {
  			alert(e.message);
  		}
  });
  
  $(document).ready(function(){
      /* attach a submit handler to the form */
      $("#parcelform").submit(function(event) {
        /* stop form from submitting normally */
        event.preventDefault(); 

        $('#parcelform').clearForm();
        /* get some values from elements on the page: */
        var $form = $( this ),
            parcel_id = $form.find( 'input[name="parcel_id"]' ).val(),
            site = $form.find( 'input[name="site"]' ).val(),
            property_use = $form.find( 'input[name="property-use"]' ).val(),
            vacancy = $form.find( 'input[name="vacancy-1"]' ).val(),
            condition = $form.find( 'input[name="condition-1"]' ).val(),
            url = $form.attr( 'action' );

        /* Send the data using post and put the results in a div */
        $.post( url, 
            { responses: [
              {
                parcel_id: parcel_id, 
                responses: {
                    site: site,
                    property_use: property_use,
                    vacancy: vacancy,
                    condition: condition,
                }
              },
            ]},  
            function( data ) {

              // var content = $( data ).find( '#content' );
              // $( "#results" ).empty().append( content );
            }
        );
        
        
    });      
});
  
